import {
  Document, Packer, Paragraph, TextRun, Table, TableRow, TableCell, WidthType, AlignmentType, BorderStyle,
  VerticalAlign, ImageRun, Footer, PageNumber, PageBreak, ShadingType, TableLayoutType,
} from 'docx';
import { LOGO, LOGO_RATIO } from './headerLogo.js';
import {
  TITLE, ENCLOSE_NOTE, GRID, EDU_COLS, eduRows, ACAD_COLS, IND_COLS, EXP_SUB, expTable, EXTRA, extraTable, topRows,
} from './spec.js';
import { dataUrlToBytes, imgKind, imgSize, isPdfFile } from './img.js';

const FONT = 'Arial';
const PAGE_W = 11906, PAGE_H = 16838, MARGIN = 1020;
const CW = PAGE_W - 2 * MARGIN;                       // 9866 DXA
const unit = CW / GRID;
const W = (span) => Math.round(span * unit);
const NONE = { style: BorderStyle.NONE, size: 0, color: 'FFFFFF' };
const LINE = { style: BorderStyle.SINGLE, size: 4, color: '000000' };
const noBorders = { top: NONE, bottom: NONE, left: NONE, right: NONE };
const allBorders = { top: LINE, bottom: LINE, left: LINE, right: LINE };

const run = (text, o = {}) => new TextRun({ text: String(text ?? ''), font: FONT, size: o.size ?? 18, bold: o.bold, italics: o.italics });
const para = (children, o = {}) => new Paragraph({ children: Array.isArray(children) ? children : [children], alignment: o.align, spacing: { before: o.before ?? 0, after: o.after ?? 0 }, keepNext: o.keepNext, indent: o.indent });
const lines = (text, o = {}) => String(text ?? '').split(/\r?\n/).map((ln) => para(run(ln, o), { after: 0 }));

function cell(children, width, o = {}) {
  return new TableCell({
    children, width: { size: width, type: WidthType.DXA }, columnSpan: o.span, rowSpan: o.rowSpan,
    verticalAlign: o.v ?? VerticalAlign.CENTER, borders: o.borders ?? allBorders,
    margins: { top: 50, bottom: 50, left: 50, right: 50 },
    shading: o.fill ? { type: ShadingType.CLEAR, fill: o.fill, color: 'auto' } : undefined,
  });
}
function tcell(text, width, o = {}) {
  const ps = String(text ?? '').split(/\r?\n/).map((ln) => para(run(ln, { size: o.size ?? 16, bold: o.bold, italics: o.italics }), { align: o.align }));
  return cell(ps, width, o);
}
const row = (cells, o = {}) => new TableRow({ children: cells, cantSplit: true, tableHeader: o.header, height: o.h ? { value: o.h, rule: 'atLeast' } : undefined });
const table = (rows, widths) => new Table({ rows, width: { size: widths.reduce((a, b) => a + b, 0), type: WidthType.DXA }, columnWidths: widths, layout: TableLayoutType.FIXED });

function heading(text, tail) {
  const kids = [run(text, { bold: true, size: 19 })];
  if (tail) kids.push(run(' ' + tail, { bold: true, italics: true, size: 19 }));
  return para(kids, { before: 200, after: 90, keepNext: true, indent: { left: 140 } });
}

// ---- label : value table (borderless), 6 columns so two pairs can share a line ----
const KV = [3300, 260, 2650, 1700, 260, 1696];
function kv(label, value, o = {}) {
  const vals = String(value ?? '').split(/\r?\n/).map((ln) => para(run(ln, { size: 18 })));
  const cells = [
    cell([para(run(label, { bold: true, size: 18 }))], KV[0], { borders: noBorders }),
    cell([para(run(':', { bold: true, size: 18 }))], KV[1], { borders: noBorders }),
  ];
  if (o.label2) {
    cells.push(cell(vals, KV[2], { borders: noBorders }));
    cells.push(cell([para(run(o.label2, { bold: true, size: 18 }))], KV[3], { borders: noBorders }));
    cells.push(cell([para(run(':', { bold: true, size: 18 }))], KV[4], { borders: noBorders }));
    cells.push(cell([para(run(o.value2 ?? '', { size: 18 }))], KV[5], { borders: noBorders }));
  } else {
    cells.push(cell(o.valueParas || vals, KV[2] + KV[3] + KV[4] + KV[5], { borders: noBorders, span: 4 }));
  }
  return row(cells, { h: 330 });
}

function bodyTable(cols, header2, rowsData, totalRow, nilText) {
  // cols: [{h, span}] + optional 3 experience columns (header2 = true)
  const widths = cols.map((c) => W(c.span));
  const headCells = cols.map((c) => tcell(c.h, W(c.span), { bold: true, align: AlignmentType.CENTER, size: 14 }));
  const rows = [row(headCells, { header: true })];
  if (nilText && !rowsData.length) rows.push(row([tcell(nilText, widths.reduce((a, b) => a + b, 0), { span: cols.length, align: AlignmentType.CENTER, italics: true })], { h: 330 }));
  else rowsData.forEach((r) => rows.push(row(r.map((v, i) => tcell(v, widths[i], { align: i === 0 && cols[0].h === 'S.No' ? AlignmentType.CENTER : undefined })), { h: 330 })));
  return table(rows, widths);
}

function expTableDocx(cols, data) {
  const lead = cols.length;
  const widths = [...cols.map((c) => W(c.span)), W(1), W(1), W(1)];
  const head1 = [...cols.map((c, i) => tcell(c.h, widths[i], { bold: true, align: AlignmentType.CENTER, rowSpan: 2, size: 14 })), tcell('Experience', W(3), { bold: true, align: AlignmentType.CENTER, span: 3, size: 14 })];
  const head2 = EXP_SUB.map((h, i) => tcell(h, W(1), { bold: true, align: AlignmentType.CENTER, size: 14 }));
  const rows = [row(head1, { header: true }), row(head2, { header: true })];
  const body = data.body.length ? data.body : [Array(lead + 3).fill('')];
  body.forEach((r) => rows.push(row(r.map((v, i) => tcell(v, widths[i], { align: i >= lead ? AlignmentType.CENTER : undefined })), { h: 400 })));
  const leadW = widths.slice(0, lead).reduce((a, b) => a + b, 0);
  rows.push(row([tcell('Total', leadW, { bold: true, align: AlignmentType.RIGHT, span: lead }), ...data.total.map((v) => tcell(v, W(1), { bold: true, align: AlignmentType.CENTER }))], { h: 330 }));
  return table(rows, widths);
}

export async function buildDocx(f, term = '') {
  const t = topRows(f);
  const children = [];

  // ---- college logo banner (header) -------------------------------------------
  children.push(new Paragraph({ alignment: AlignmentType.CENTER, spacing: { after: 120 }, children: [new ImageRun({ type: 'png', data: dataUrlToBytes(LOGO), transformation: { width: 380, height: Math.round(380 / LOGO_RATIO) } })] }));

  // ---- title + photo box ----------------------------------------------------
  const photoW = 1620, titleW = CW - photoW;
  let photoPara = para(run(' '));
  if (f.photo) {
    const bytes = dataUrlToBytes(f.photo);
    photoPara = new Paragraph({ alignment: AlignmentType.CENTER, children: [new ImageRun({ type: imgKind(f.photo), data: bytes, transformation: { width: 100, height: 126 } })] });
  }
  children.push(table([
    new TableRow({
      height: { value: 1980, rule: 'exact' }, cantSplit: true,
      children: [
        cell([para(run(TITLE, { bold: true, size: 24 }), { align: AlignmentType.CENTER }), ...(term ? [para(run(`Academic Year : ${term}`, { bold: true, size: 20 }), { align: AlignmentType.CENTER, before: 120 })] : [])], titleW, { borders: noBorders }),
        cell([photoPara], photoW, { borders: { top: { style: BorderStyle.SINGLE, size: 12, color: '000000' }, bottom: { style: BorderStyle.SINGLE, size: 12, color: '000000' }, left: { style: BorderStyle.SINGLE, size: 12, color: '000000' }, right: { style: BorderStyle.SINGLE, size: 12, color: '000000' } }, v: VerticalAlign.CENTER }),
      ],
    }),
  ], [titleW, photoW]));
  children.push(para(run(' '), { after: 120 }));

  // ---- label : value rows ---------------------------------------------------
  const contact = [
    para([run('Mobile', { size: 18 }), run('   :  ' + (t.mobile || ''), { size: 18 })]),
    para([run('Email', { size: 18 }), run('     :  ' + (t.email || ''), { size: 18 })]),
  ];
  children.push(table([
    kv('Name of the College', t.college),
    kv('Name of the Department', t.department),
    kv('Name of the faculty member', t.name),
    kv('Present Designation', t.designation),
    kv('Anna University ID', t.annaId),
    kv('AICTE ID', t.aicteId),
    kv('APPAR ID', t.apparId),
    kv('Residential Address', t.address),
    kv('Contact Nos.', '', { valueParas: contact }),
    kv('Gender', t.gender || 'Male / Female / TG'),
    kv('Community', t.community || 'OC / BC / MBC / SC / ST'),
    kv('PAN Number', t.pan, { label2: 'Aadhaar Number', value2: t.aadhaar }),
    kv('Date of Birth and Age', t.dob, { label2: 'Blood group', value2: t.blood }),
    kv('Date of joining the present post', t.joining),
    kv('Scale of pay', t.scale),
    kv('Present basic pay', t.basic),
    kv('Total salary', t.total),
  ], KV));

  // ---- I. education ---------------------------------------------------------
  children.push(heading('I. Particulars of Educational Qualification:', '(only completed)'));
  const eduW = EDU_COLS.map((c) => W(c.span));
  const eduHead = row(EDU_COLS.map((c, i) => tcell(c.h, eduW[i], { bold: true, align: AlignmentType.CENTER, size: 14 })), { header: true });
  const eduBody = eduRows(f).map((r) => row(r.map((v, i) => tcell(v, eduW[i], { bold: i === 0, align: i === 0 ? AlignmentType.CENTER : undefined })), { h: 520 }));
  children.push(table([eduHead, ...eduBody], eduW));
  children.push(para(run('* ' + ENCLOSE_NOTE, { bold: true, italics: true, size: 16 }), { before: 60, after: 100, indent: { left: 100 } }));

  // ---- I.a / II / III -------------------------------------------------------
  children.push(para(run('I.a.  Additional Qualification  :', { bold: true, size: 18 }), { indent: { left: 140 }, after: 40, keepNext: true }));
  children.push(para([run('i. GATE Score (In case of B.E. / B.Tech.) : ', { bold: true, size: 17 }), run(f.gate || '', { size: 18 })], { indent: { left: 560 }, after: 30 }));
  children.push(para([run('ii. NET / SLET (In case of M.C.A. / M.Sc. / M.A.) : ', { bold: true, size: 17 }), run(f.net || '', { size: 18 })], { indent: { left: 560 }, after: 100 }));
  children.push(table([kv('II. Title of Ph.D. Thesis *', f.phdTitle), kv('III. Faculty in which Ph.D. was awarded', f.phdFaculty)], KV));

  // ---- IV / V ---------------------------------------------------------------
  children.push(heading('IV. Academic Experience:'));
  children.push(expTableDocx(ACAD_COLS, expTable(f.academic, 'academic')));
  children.push(heading('V. Industrial Experience:'));
  children.push(expTableDocx(IND_COLS, expTable(f.industrial, 'industrial')));

  // ---- VII - XII ------------------------------------------------------------
  for (const sec of EXTRA) {
    children.push(heading(`${sec.no}. ${sec.title}`));
    const { rows } = extraTable(f, sec);
    children.push(bodyTable(sec.cols, false, rows, null, 'Nil'));
  }

  // ---- NPTEL certificates (pictures; PDF uploads are listed) ---------------------
  const certs = f.nptel.filter((r) => r.file && r.file.data);
  if (certs.length) {
    children.push(new Paragraph({ children: [new PageBreak()] }));
    children.push(para(run('NPTEL Certificates', { bold: true, size: 24 }), { after: 160 }));
    certs.forEach((r, i) => {
      children.push(para(run(`${i + 1}. ${r.course || r.file.name}`, { bold: true, size: 18 }), { before: 160, after: 80, keepNext: true }));
      if (isPdfFile(r.file)) {
        children.push(para(run(`Certificate uploaded as a PDF file (${r.file.name}). It is included at the end of the PDF download.`, { italics: true, size: 17 })));
      } else {
        const bytes = dataUrlToBytes(r.file.data);
        const { w, h } = imgSize(bytes);
        const k = Math.min(600 / w, 760 / h, 1);
        children.push(new Paragraph({ alignment: AlignmentType.CENTER, children: [new ImageRun({ type: imgKind(r.file.data), data: bytes, transformation: { width: Math.round(w * k), height: Math.round(h * k) } })] }));
      }
    });
  }

  const doc = new Document({
    creator: 'Team OTC', title: 'Individual Faculty Data Sheet', description: 'GRT Institute of Engineering and Technology',
    styles: { default: { document: { run: { font: FONT, size: 18 } } } },
    sections: [{
      properties: { page: { size: { width: PAGE_W, height: PAGE_H }, margin: { top: 900, bottom: 1000, left: MARGIN, right: MARGIN } } },
      footers: { default: new Footer({ children: [new Paragraph({ alignment: AlignmentType.CENTER, children: [run('Page ', { size: 16 }), new TextRun({ children: [PageNumber.CURRENT], font: FONT, size: 16 }), run(' of ', { size: 16 }), new TextRun({ children: [PageNumber.TOTAL_PAGES], font: FONT, size: 16 })] })] }) },
      children,
    }],
  });
  return new Uint8Array(await Packer.toArrayBuffer(doc));
}
