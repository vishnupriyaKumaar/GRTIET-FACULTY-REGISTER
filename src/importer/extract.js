// Reads an uploaded file (Word, PDF, Excel, CSV, text, HTML, RTF, OpenDocument, or a picture / scan)
// and turns it into a flat list of blocks:
//   { t: 'p',   text }                       a paragraph / heading / "Label : value" line
//   { t: 'row', tid, cells: [text, ...] }    one table row (rows of the same table share `tid`)
// parse.js then maps these blocks to the faculty form.
import JSZip from 'jszip';
import { pageSegments, gridTables } from './pdfgrid.js';

const clean = (s) => String(s ?? '').replace(/[ ​]/g, ' ').replace(/[ \t]+/g, ' ').trim();
let TID = 0;
const newTid = () => ++TID;

// --- plain lines -> blocks (used by text, CSV, PDF, OCR, ODT, RTF) ---------------------------------
// each line is an array of cells; a line with one cell is a paragraph, 2+ cells is a table row.
export function linesToBlocks(lines) {
  const blocks = [];
  let tid = 0;
  for (const cells of lines) {
    const c = cells.map(clean);
    const real = c.filter(Boolean);
    if (!real.length) { tid = 0; continue; }
    if (real.length === 1 && c.length === 1) { blocks.push({ t: 'p', text: real[0] }); tid = 0; continue; }
    if (!tid) tid = newTid();
    blocks.push({ t: 'row', tid, cells: c });
  }
  return blocks;
}
const splitTextLine = (line) => (line.includes('\t') ? line.split('\t') : line.includes('|') && line.split('|').length >= 3 ? line.split('|') : line.split(/ {3,}/));

// --- DOCX --------------------------------------------------------------------------------------------
const W = 'http://schemas.openxmlformats.org/wordprocessingml/2006/main';
const kids = (n) => Array.from(n.childNodes || []).filter((x) => x.nodeType === 1);
const ln = (n) => n.localName || String(n.nodeName).replace(/^.*:/, '');
const deep = (n, name, out = []) => { for (const k of kids(n)) { if (ln(k) === name) out.push(k); deep(k, name, out); } return out; };
const attr = (n, name) => n.getAttributeNS?.(W, name) ?? n.getAttribute?.('w:' + name);

function paraText(p) {
  let out = '';
  const walk = (n) => {
    for (const k of kids(n)) {
      const name = ln(k);
      if (name === 't') out += k.textContent;
      else if (name === 'tab') out += ' ';
      else if (name === 'br' || name === 'cr') out += ' ';
      else if (name === 'tbl') continue;
      else walk(k);
    }
  };
  walk(p);
  return clean(out);
}

async function fromDocx(buf) {
  const zip = await JSZip.loadAsync(buf);
  const doc = zip.file('word/document.xml');
  if (!doc) throw new Error('This Word file looks damaged.');
  const xml = new DOMParser().parseFromString(await doc.async('string'), 'application/xml');
  const body = deep(xml.documentElement, 'body')[0] || xml.documentElement;
  const blocks = [];
  let imageRid = '';
  const noteImage = (node) => { if (imageRid) return; const b = deep(node, 'blip')[0]; if (b) imageRid = b.getAttribute('r:embed') || ''; };

  const walk = (parent) => {
    for (const n of kids(parent)) {
      const name = ln(n);
      if (name === 'p') { noteImage(n); const t = paraText(n); if (t) blocks.push({ t: 'p', text: t }); }
      else if (name === 'tbl') {
        const tid = newTid();
        for (const tr of kids(n).filter((x) => ln(x) === 'tr')) {
          const cells = [];
          for (const tc of kids(tr).filter((x) => ln(x) === 'tc')) {
            noteImage(tc);
            const pr = kids(tc).find((x) => ln(x) === 'tcPr');
            const vm = pr && kids(pr).find((x) => ln(x) === 'vMerge');
            if (vm && attr(vm, 'val') !== 'restart') { cells.push(''); continue; }                  // continuation of a merged cell
            cells.push(clean(deep(tc, 'p').filter((p) => !deep(p, 'tbl').length).map(paraText).filter(Boolean).join(' ')));
          }
          if (cells.some(Boolean)) blocks.push({ t: 'row', tid, cells });
        }
      } else if (name === 'sdt' || name === 'sdtContent' || name === 'customXml') walk(n);
    }
  };
  walk(body);

  let photo = null;
  if (imageRid) {
    try {
      const rels = await zip.file('word/_rels/document.xml.rels').async('string');
      const m = new RegExp(`<Relationship[^>]*Id="${imageRid}"[^>]*Target="([^"]+)"`).exec(rels) || new RegExp(`<Relationship[^>]*Target="([^"]+)"[^>]*Id="${imageRid}"`).exec(rels);
      const f = m && zip.file('word/' + m[1].replace(/^\//, '').replace(/^word\//, ''));
      if (f) { const bytes = await f.async('uint8array'); if (bytes.length > 1500) photo = { bytes, type: /\.png$/i.test(m[1]) ? 'image/png' : 'image/jpeg' }; }
    } catch { /* no photo */ }
  }
  return { blocks, photo };
}

// --- PDF (text layer, positions -> cells) -----------------------------------------------------------
// items: [{ x, y, w, h, str }]  -> lines of cells.  Used for PDF text and for OCR words.
export function itemsToLines(items) {
  const rows = [];
  for (const it of items.filter((i) => clean(i.str))) {
    const tol = Math.max(2.5, it.h * 0.45);
    let r = rows.find((q) => Math.abs(q.y - it.y) <= tol);
    if (!r) { r = { y: it.y, h: it.h, items: [] }; rows.push(r); }
    r.items.push(it);
  }
  rows.sort((a, b) => b.y - a.y);                                    // PDF y grows upwards
  const lines = rows.map((r) => {
    r.items.sort((a, b) => a.x - b.x);
    const cells = []; let cur = null;
    for (const it of r.items) {
      const gap = cur ? it.x - cur.end : 0;
      if (!cur || gap > Math.max(7, it.h * 0.9)) { cur = { x: it.x, end: it.x + it.w, text: it.str }; cells.push(cur); }
      else { cur.text += (gap > it.h * 0.12 ? ' ' : '') + it.str; cur.end = it.x + it.w; }
    }
    return { y: r.y, h: r.h, cells };
  });
  // a wrapped line inside a table cell (small vertical gap, starts under an earlier cell) joins that cell
  const out = [];
  for (const L of lines) {
    const prev = out[out.length - 1];
    if (prev && prev.cells.length >= 2 && prev.y - L.y <= prev.h * 1.45 && L.cells.every((c) => prev.cells.some((p) => Math.abs(p.x - c.x) <= 4))) {
      L.cells.forEach((c) => { const p = prev.cells.find((q) => Math.abs(q.x - c.x) <= 4); p.text += ' ' + c.text; });
      prev.y = L.y;
    } else out.push(L);
  }
  return out.map((L) => Object.assign(L.cells.map((c) => c.text), { y: L.y }));
}

async function fromPdf(buf, onStatus) {
  const pdfjs = await import('pdfjs-dist/build/pdf.min.mjs');
  const worker = (await import('pdfjs-dist/build/pdf.worker.min.mjs?url')).default;
  pdfjs.GlobalWorkerOptions.workerSrc = worker;
  const pdf = await pdfjs.getDocument({ data: new Uint8Array(buf) }).promise;
  const lines = [];
  const blocks = [];
  for (let p = 1; p <= pdf.numPages; p++) {
    const page = await pdf.getPage(p);
    const tc = await page.getTextContent();
    const items = tc.items.filter((i) => 'str' in i).map((i) => ({ x: i.transform[4], y: i.transform[5], w: i.width, h: Math.abs(i.transform[3]) || 10, str: i.str }));
    let tables = [], rest = items;
    try {
      const { H, V } = pageSegments(await page.getOperatorList(), pdfjs.OPS);
      ({ tables, rest } = gridTables(items, H, V, page.view));
    } catch { tables = []; rest = items; }
    // paragraphs / loose lines and ruled tables, in page order (top to bottom)
    const units = [];
    const loose = itemsToLines(rest);
    loose.forEach((cells) => units.push({ y: cells.y, kind: 'line', cells }));
    tables.forEach((t) => units.push({ y: t.top + 0.5, kind: 'table', t }));
    units.sort((a, b) => b.y - a.y);
    let run = [];
    const flush = () => { if (run.length) { blocks.push(...linesToBlocks(run)); run = []; } };
    for (const u of units) {
      if (u.kind === 'line') { run.push(u.cells); lines.push(u.cells); }
      else { flush(); const tid = newTid(); u.t.rows.forEach((cells) => { if (cells.some(Boolean)) blocks.push({ t: 'row', tid, cells }); }); lines.push(u.t.rows.flat()); }
    }
    flush();
  }
  const textLen = lines.flat().join('').length;
  if (textLen < 60) return fromScan(pdf, onStatus);               // scanned PDF -> OCR
  return { blocks, photo: null };
}

// --- pictures / scanned PDFs: OCR (needs internet once to fetch the language data) -------------------
async function ocrCanvas(canvas, onStatus) {
  const { createWorker } = await import('tesseract.js');
  const worker = await createWorker('eng', 1, { logger: (m) => { if (m.status === 'recognizing text') onStatus?.(`Reading the picture… ${Math.round((m.progress || 0) * 100)}%`); } });
  try {
    const { data } = await worker.recognize(canvas, {}, { blocks: true });
    const words = [];
    for (const b of data.blocks || []) for (const p of b.paragraphs || []) for (const l of p.lines || []) for (const w of l.words || [])
      words.push({ x: w.bbox.x0, y: -w.bbox.y0, w: w.bbox.x1 - w.bbox.x0, h: w.bbox.y1 - w.bbox.y0, str: w.text });
    return itemsToLines(words);
  } finally { await worker.terminate(); }
}
async function fromScan(pdf, onStatus) {
  const lines = [];
  for (let p = 1; p <= Math.min(pdf.numPages, 6); p++) {
    onStatus?.(`Reading scanned page ${p}…`);
    const page = await pdf.getPage(p);
    const vp = page.getViewport({ scale: 2 });
    const c = document.createElement('canvas'); c.width = vp.width; c.height = vp.height;
    await page.render({ canvasContext: c.getContext('2d'), viewport: vp }).promise;
    lines.push(...await ocrCanvas(c, onStatus), []);
  }
  return { blocks: linesToBlocks(lines), photo: null };
}
async function fromImage(file, onStatus) {
  onStatus?.('Reading the picture…');
  const url = URL.createObjectURL(file);
  try {
    const img = await new Promise((res, rej) => { const i = new Image(); i.onload = () => res(i); i.onerror = () => rej(new Error('Could not open this picture.')); i.src = url; });
    const k = Math.min(2, 2400 / Math.max(img.width, img.height));
    const c = document.createElement('canvas'); c.width = Math.round(img.width * k); c.height = Math.round(img.height * k);
    c.getContext('2d').drawImage(img, 0, 0, c.width, c.height);
    return { blocks: linesToBlocks(await ocrCanvas(c, onStatus)), photo: null };
  } finally { URL.revokeObjectURL(url); }
}

// --- Excel / CSV ---------------------------------------------------------------------------------------
const cellText = (v) => {
  if (v == null) return '';
  if (v instanceof Date) return `${String(v.getUTCDate()).padStart(2, '0')}.${String(v.getUTCMonth() + 1).padStart(2, '0')}.${v.getUTCFullYear()}`;
  if (typeof v === 'object') return v.richText ? v.richText.map((r) => r.text).join('') : v.text != null ? String(v.text) : v.result != null ? String(v.result) : '';
  return String(v);
};
async function fromXlsx(buf) {
  const ExcelJS = (await import('exceljs')).default;
  const wb = new ExcelJS.Workbook();
  await wb.xlsx.load(buf);
  const lines = [];
  wb.eachSheet((ws) => {
    ws.eachRow({ includeEmpty: false }, (row) => { const cells = []; row.eachCell({ includeEmpty: true }, (c, i) => { cells[i - 1] = cellText(c.value); }); lines.push(Array.from(cells, (x) => x || '')); });
    lines.push([]);
  });
  return { blocks: linesToBlocks(lines), photo: null };
}
function csvLines(text) {
  const delim = text.split('\n', 1)[0].includes('\t') ? '\t' : text.split('\n', 1)[0].split(';').length > text.split('\n', 1)[0].split(',').length ? ';' : ',';
  const out = []; let row = [], cur = '', q = false;
  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (q) { if (ch === '"' && text[i + 1] === '"') { cur += '"'; i++; } else if (ch === '"') q = false; else cur += ch; }
    else if (ch === '"') q = true;
    else if (ch === delim) { row.push(cur); cur = ''; }
    else if (ch === '\n' || ch === '\r') { if (ch === '\r' && text[i + 1] === '\n') i++; row.push(cur); out.push(row); row = []; cur = ''; }
    else cur += ch;
  }
  row.push(cur); out.push(row);
  return out;
}

// --- HTML / RTF / ODT / text -------------------------------------------------------------------------------
function fromHtml(html) {
  const d = new DOMParser().parseFromString(html, 'text/html');
  d.querySelectorAll('script,style').forEach((x) => x.remove());
  const blocks = [];
  const walk = (n) => {
    for (const k of Array.from(n.children || [])) {
      const tag = k.tagName.toLowerCase();
      if (tag === 'table') {
        const tid = newTid();
        k.querySelectorAll('tr').forEach((tr) => { const cells = Array.from(tr.children).filter((c) => /^t[hd]$/i.test(c.tagName)).map((c) => clean(c.textContent)); if (cells.some(Boolean)) blocks.push({ t: 'row', tid, cells }); });
      } else if (/^(p|h[1-6]|li|div|span|pre|blockquote|td)$/.test(tag) && !k.querySelector('table,p,div,li,h1,h2,h3,h4,h5,h6')) { const t = clean(k.textContent); if (t) blocks.push({ t: 'p', text: t }); }
      else walk(k);
    }
  };
  walk(d.body);
  return { blocks, photo: null };
}
const fromRtf = (txt) => linesToBlocks(txt
  .replace(/\\par[d]?/g, '\n').replace(/\\(?:tab|cell)\b/g, '\t').replace(/\\row\b/g, '\n')
  .replace(/\\'([0-9a-f]{2})/gi, (_, h) => String.fromCharCode(parseInt(h, 16)))
  .replace(/\{\\\*[^{}]*\}/g, '').replace(/\\[a-z]+-?\d* ?/gi, '').replace(/[{}]/g, '')
  .split('\n').map(splitTextLine));
async function fromOdt(buf) {
  const zip = await JSZip.loadAsync(buf);
  const f = zip.file('content.xml');
  if (!f) throw new Error('Could not read this document.');
  const xml = (await f.async('string')).replace(/<\/text:p>|<\/text:h>|<\/table:table-row>/g, '\n').replace(/<\/table:table-cell>/g, '\t').replace(/<[^>]+>/g, '');
  return { blocks: linesToBlocks(xml.split('\n').map((l) => l.split('\t'))), photo: null };
}

const readText = async (file) => {
  const buf = await file.arrayBuffer();
  const u8 = new Uint8Array(buf);
  if (u8[0] === 0xff && u8[1] === 0xfe) return new TextDecoder('utf-16le').decode(buf);
  return new TextDecoder('utf-8').decode(buf);
};

// ------------------------------------------------------------------------------------------------------------
export async function extractBlocks(file, onStatus) {
  TID = 0;
  const name = (file.name || '').toLowerCase();
  const type = file.type || '';
  const buf = await file.arrayBuffer();
  const sig = new Uint8Array(buf.slice(0, 8));
  const isZip = sig[0] === 0x50 && sig[1] === 0x4b;
  const isPdf = sig[0] === 0x25 && sig[1] === 0x50 && sig[2] === 0x44 && sig[3] === 0x46;
  const isOle = sig[0] === 0xd0 && sig[1] === 0xcf && sig[2] === 0x11 && sig[3] === 0xe0;     // old .doc / .xls

  onStatus?.('Reading the file…');
  if (isPdf || name.endsWith('.pdf')) return fromPdf(buf, onStatus);
  if (isOle) throw new Error('This is an old Word / Excel (.doc / .xls) file. Please open it and use Save As → .docx / .xlsx (or PDF), then upload again.');
  if (isZip) {
    const zip = await JSZip.loadAsync(buf);
    if (zip.file('word/document.xml')) return fromDocx(buf);
    if (zip.file('xl/workbook.xml')) return fromXlsx(buf);
    if (zip.file('content.xml')) return fromOdt(buf);
    throw new Error('This file type is not supported. Please upload a Word, PDF, Excel, text file or a clear picture.');
  }
  if (type.startsWith('image/') || /\.(png|jpe?g|webp|bmp|gif|tiff?)$/.test(name)) return fromImage(file, onStatus);
  const text = await readText(file);
  if (/\.html?$/.test(name) || /^\s*<(!doctype|html)/i.test(text)) return fromHtml(text);
  if (/\.rtf$/.test(name) || text.startsWith('{\\rtf')) return { blocks: fromRtf(text), photo: null };
  if (/\.(csv|tsv)$/.test(name)) return { blocks: linesToBlocks(csvLines(text)), photo: null };
  if (/\.json$/.test(name)) { try { return { blocks: linesToBlocks(JSON.stringify(JSON.parse(text), null, 1).split('\n').map((l) => [l.replace(/[{}\[\],"]/g, ' ').replace(/:\s*/, '\t')])), photo: null }; } catch { /* plain text below */ } }
  return { blocks: linesToBlocks(text.split(/\r?\n/).map(splitTextLine)), photo: null };
}
