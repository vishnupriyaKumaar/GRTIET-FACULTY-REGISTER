import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';
import { pdfSafe, fmtDate } from '../utils.js';
import { LOGO, LOGO_RATIO } from './headerLogo.js';
import {
  TITLE, ENCLOSE_NOTE, GRID, EDU_COLS, eduRows, ACAD_COLS, IND_COLS, EXP_SUB, expTable, EXTRA, extraTable, topRows,
} from './spec.js';

const S = pdfSafe;
const PW = 210, PH = 297, ML = 18, MR = 18, MT = 14, MB = 18;
const CW = PW - ML - MR;
const mm = (span) => (span / GRID) * CW;

export async function buildPdf(f, term = '') {
  const doc = new jsPDF({ unit: 'mm', format: 'a4', orientation: 'portrait', compress: true });
  const t = topRows(f);
  let y = MT;

  const need = (h) => { if (y + h > PH - MB) { doc.addPage(); y = MT; } };
  const setF = (style, size) => { doc.setFont('helvetica', style); doc.setFontSize(size); doc.setTextColor(0); };
  const afterTable = (gap = 6) => { y = doc.lastAutoTable.finalY + gap; };

  // ---- college logo banner (header) ----------------------------------------
  const lw = 100, lh = lw / LOGO_RATIO;
  doc.addImage(LOGO, 'PNG', (PW - lw) / 2, y, lw, lh, undefined, 'FAST');
  y += lh + 5;

  // ---- title + photo box -------------------------------------------------
  const boxW = 28, boxH = 34, boxX = PW - MR - boxW;
  doc.setDrawColor(0); doc.setLineWidth(0.5); doc.rect(boxX, y, boxW, boxH);
  if (f.photo) {
    try { doc.addImage(f.photo, 'JPEG', boxX + 0.4, y + 0.4, boxW - 0.8, boxH - 0.8, undefined, 'FAST'); } catch { /* ignore a bad photo */ }
  }
  setF('bold', 12);
  doc.text(TITLE, (ML + boxX) / 2, y + 14, { align: 'center' });
  if (term) { setF('bold', 10.5); doc.text(`Academic Year : ${S(term)}`, (ML + boxX) / 2, y + 22, { align: 'center' }); }
  y += boxH + 8;

  // ---- label : value rows ------------------------------------------------
  const LX = ML + 4, CX = ML + 67, VX = ML + 72, VW = PW - MR - VX;
  const row = (label, value, opts = {}) => {
    const lines = doc.splitTextToSize(S(value) || ' ', opts.vw || VW);
    const h = Math.max(6.6, lines.length * 4.2 + 2.4);
    need(h);
    setF('bold', 9); doc.text(label, LX, y + 4);
    doc.text(':', CX, y + 4);
    setF('normal', 9); doc.text(lines, VX, y + 4);
    y += h;
  };
  row('Name of the College', t.college);
  row('Name of the Department', t.department);
  row('Name of the faculty member', t.name);
  row('Present Designation', t.designation);
  row('Anna University ID', t.annaId);
  row('AICTE ID', t.aicteId);
  row('APPAR ID', t.apparId);
  row('Residential Address', t.address);
  // Contact Nos. : Mobile / Email on two lines
  need(12);
  setF('bold', 9); doc.text('Contact Nos.', LX, y + 4); doc.text(':', CX, y + 4);
  setF('normal', 9); doc.text('Mobile', VX, y + 4); doc.text(':', VX + 12, y + 4); doc.text(S(t.mobile), VX + 15, y + 4);
  doc.text('Email', VX, y + 8.6); doc.text(':', VX + 12, y + 8.6); doc.text(S(t.email), VX + 15, y + 8.6);
  y += 13;
  row('Gender', t.gender || 'Male / Female / TG');
  row('Community', t.community || 'OC / BC / MBC / SC / ST');
  // PAN | Aadhaar on one line
  need(7);
  setF('bold', 9); doc.text('PAN Number', LX, y + 4); doc.text(':', CX, y + 4);
  setF('normal', 9); doc.text(S(t.pan), VX, y + 4);
  const AX = ML + 112;
  setF('bold', 9); doc.text('Aadhaar Number', AX, y + 4); doc.text(':', AX + 27, y + 4);
  setF('normal', 9); doc.text(S(t.aadhaar), AX + 30, y + 4);
  y += 7;
  // DOB + Age | Blood group
  need(7);
  setF('bold', 9); doc.text('Date of Birth and Age', LX, y + 4); doc.text(':', CX, y + 4);
  setF('normal', 9); doc.text(S(t.dob), VX, y + 4);
  setF('bold', 9); doc.text('Blood group:', AX, y + 4);
  setF('normal', 9); doc.text(S(t.blood), AX + 24, y + 4);
  y += 7;
  row('Date of joining the present post', t.joining);
  row('Scale of pay', t.scale);
  row('Present basic pay', t.basic);
  row('Total salary', t.total);
  y += 3;

  // ---- helpers for headings / tables --------------------------------------
  const heading = (text, italicTail, room = 38) => {
    need(room); setF('bold', 9.5); doc.text(S(text), ML + 4, y + 4);
    if (italicTail) { const w = doc.getTextWidth(S(text) + ' '); doc.setFont('helvetica', 'bolditalic'); doc.text(S(italicTail), ML + 4 + w, y + 4); }
    y += 7;
  };
  const tableBase = {
    theme: 'grid', margin: { left: ML, right: MR, top: MT, bottom: MB },
    styles: { font: 'helvetica', fontSize: 8, textColor: 0, lineColor: 0, lineWidth: 0.25, cellPadding: 1.6, valign: 'middle', overflow: 'linebreak' },
    headStyles: { fillColor: 255, textColor: 0, fontStyle: 'bold', fontSize: 7, halign: 'center', valign: 'middle', lineWidth: 0.25, lineColor: 0, cellPadding: 0.9 },
    footStyles: { fillColor: 255, textColor: 0, fontStyle: 'bold', lineWidth: 0.25, lineColor: 0 },
    bodyStyles: { fillColor: 255 },
    showHead: 'everyPage', showFoot: 'lastPage', pageBreak: 'auto', rowPageBreak: 'avoid',
  };
  const colStyles = (cols) => Object.fromEntries(cols.map((c, i) => [i, { cellWidth: mm(c.span) }]));

  // ---- I. education ---------------------------------------------------------
  heading('I. Particulars of Educational Qualification:', '(only completed)');
  autoTable(doc, {
    ...tableBase, startY: y,
    head: [EDU_COLS.map((c) => S(c.h))],
    body: eduRows(f).map((r) => r.map(S)),
    columnStyles: { ...colStyles(EDU_COLS), 0: { cellWidth: mm(1), fontStyle: 'bold', halign: 'center' } },
    bodyStyles: { fillColor: 255, minCellHeight: 9 },
  });
  afterTable(2.5);
  setF('bolditalic', 8); doc.text('* ' + ENCLOSE_NOTE, ML + 2, y + 2); y += 8;

  // ---- I.a / II / III -----------------------------------------------------
  need(30);
  setF('bold', 9); doc.text('I.a.  Additional Qualification', ML + 4, y + 4); doc.text(':', CX, y + 4); y += 6.5;
  const sub = (label, val) => {
    const lines = doc.splitTextToSize(S(val) || ' ', VW);
    need(lines.length * 4 + 3);
    setF('bold', 8.5); doc.text(label, ML + 14, y + 3.5);
    setF('normal', 9); doc.text(lines, ML + 14 + doc.getTextWidth(label) + 2, y + 3.5);   // value follows label
    y += Math.max(5.5, lines.length * 4 + 1.5);
  };
  sub('i. GATE Score (In case of B.E. / B.Tech.) :', f.gate);
  sub('ii. NET / SLET (In case of M.C.A. / M.Sc. / M.A.) :', f.net);
  y += 2;
  row('II. Title of Ph.D. Thesis *', f.phdTitle);
  row('III. Faculty in which Ph.D. was awarded', f.phdFaculty);
  y += 3;

  // ---- IV / V experience ---------------------------------------------------
  const expSection = (title, cols, kind) => {
    heading(title);
    const { body, total } = expTable(kind === 'academic' ? f.academic : f.industrial, kind);
    const lead = cols.length;
    const head = [
      [...cols.map((c) => ({ content: S(c.h), rowSpan: 2 })), { content: 'Experience', colSpan: 3 }],
      EXP_SUB.map((h) => ({ content: h })),
    ];
    const rows = body.length ? body.map((r) => r.map(S)) : [Array(lead + 3).fill('')];
    autoTable(doc, {
      ...tableBase, startY: y, head,
      body: rows,
      foot: [[{ content: 'Total', colSpan: lead, styles: { halign: 'right' } }, ...total.map((v) => ({ content: v, styles: { halign: 'center' } }))]],
      columnStyles: { ...colStyles(cols), [lead]: { cellWidth: mm(1), halign: 'center' }, [lead + 1]: { cellWidth: mm(1), halign: 'center' }, [lead + 2]: { cellWidth: mm(1), halign: 'center' } },
      bodyStyles: { fillColor: 255, minCellHeight: 8 },
    });
    afterTable(6);
  };
  expSection('IV. Academic Experience:', ACAD_COLS, 'academic');
  expSection('V. Industrial Experience:', IND_COLS, 'industrial');

  // ---- VII - XII extra sections -------------------------------------------
  for (const sec of EXTRA) {
    heading(`${sec.no}. ${sec.title}`);
    const { rows } = extraTable(f, sec);
    const nCols = sec.cols.length;
    const body = rows.length ? rows.map((r) => r.map(S)) : [[{ content: 'Nil', colSpan: nCols, styles: { halign: 'center', fontStyle: 'italic' } }]];
    autoTable(doc, {
      ...tableBase, startY: y,
      head: [sec.cols.map((c) => S(c.h))],
      body,
      columnStyles: { ...colStyles(sec.cols), 0: { cellWidth: mm(sec.cols[0].span), halign: 'center' } },
      bodyStyles: { fillColor: 255, minCellHeight: 7 },
    });
    afterTable(6);
  }

  // ---- page footer: Page x of y ------------------------------------------
  const pages = doc.getNumberOfPages();
  for (let i = 1; i <= pages; i++) {
    doc.setPage(i); setF('normal', 8);
    doc.text(`Page ${i} of ${pages}`, PW / 2, PH - 9, { align: 'center' });
  }

  let bytes = new Uint8Array(doc.output('arraybuffer'));

  // ---- NPTEL certificates appended as extra pages ---------------------------
  const certs = f.nptel.filter((r) => r.file && r.file.data);
  if (certs.length) bytes = await appendCertificates(bytes, certs);
  return bytes;
}

const b64 = (dataUrl) => {
  const s = dataUrl.slice(dataUrl.indexOf(',') + 1);
  const bin = atob(s); const u = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) u[i] = bin.charCodeAt(i);
  return u;
};

async function appendCertificates(mainBytes, certs) {
  const { PDFDocument, StandardFonts, rgb } = await import('pdf-lib');
  const out = await PDFDocument.load(mainBytes);
  const font = await out.embedFont(StandardFonts.HelveticaBold);
  const W = 595.28, H = 841.89, M = 42;
  let n = 0;
  for (const r of certs) {
    n += 1;
    const title = S(`NPTEL Certificate ${n}: ${r.course || r.file.name}`).slice(0, 90);
    const isPdf = (r.file.type || '').includes('pdf') || /^data:application\/pdf/.test(r.file.data);
    try {
      if (isPdf) {
        const src = await PDFDocument.load(b64(r.file.data), { ignoreEncryption: true });
        const pages = await out.copyPages(src, src.getPageIndices());
        pages.forEach((p) => out.addPage(p));
      } else {
        const bytes = b64(r.file.data);
        const img = /^data:image\/png/.test(r.file.data) ? await out.embedPng(bytes) : await out.embedJpg(bytes);
        const page = out.addPage([W, H]);
        page.drawText(title, { x: M, y: H - M - 6, size: 12, font, color: rgb(0, 0, 0) });
        const maxW = W - 2 * M, maxH = H - 2 * M - 30;
        const k = Math.min(maxW / img.width, maxH / img.height, 1.6);
        const w = img.width * k, h = img.height * k;
        page.drawImage(img, { x: (W - w) / 2, y: H - M - 30 - h, width: w, height: h });
        page.drawRectangle({ x: (W - w) / 2, y: H - M - 30 - h, width: w, height: h, borderColor: rgb(0, 0, 0), borderWidth: 0.5 });
      }
    } catch (e) {
      const page = out.addPage([W, H]);
      page.drawText(title, { x: M, y: H - M - 6, size: 12, font });
      page.drawText('The uploaded file could not be embedded: ' + S(r.file.name), { x: M, y: H - M - 30, size: 10, font });
    }
  }
  return new Uint8Array(await out.save());
}
