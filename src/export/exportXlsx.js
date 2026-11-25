import ExcelJS from 'exceljs';
import { LOGO, LOGO_RATIO } from './headerLogo.js';
import {
  TITLE, ENCLOSE_NOTE, GRID, EDU_COLS, eduRows, ACAD_COLS, IND_COLS, EXP_SUB, expTable, EXTRA, extraTable, topRows,
} from './spec.js';
import { imgSize, dataUrlToBytes, isPdfFile } from './img.js';

const COLW = 9.6;                                   // width of each of the 14 grid columns
const thin = { style: 'thin', color: { argb: 'FF000000' } };
const BOX = { top: thin, left: thin, bottom: thin, right: thin };
const FONT = 'Arial';

export async function buildXlsx(f, term = '') {
  const t = topRows(f);
  const wb = new ExcelJS.Workbook();
  wb.creator = 'Team OTC'; wb.title = 'Individual Faculty Data Sheet';
  const ws = wb.addWorksheet('Faculty Data Sheet', {
    pageSetup: { paperSize: 9, orientation: 'portrait', fitToPage: true, fitToWidth: 1, fitToHeight: 0, margins: { left: 0.5, right: 0.5, top: 0.5, bottom: 0.6, header: 0.3, footer: 0.3 } },
    views: [{ showGridLines: false }],
  });
  ws.headerFooter.oddFooter = '&CPage &P of &N';
  for (let c = 1; c <= GRID; c++) ws.getColumn(c).width = COLW;

  let r = 1;
  const need = (spanCols, text) => {                     // row height for wrapped text in merged cells
    const per = spanCols * COLW * 1.08;
    return String(text ?? '').split(/\r?\n/).reduce((n, ln) => n + Math.max(1, Math.ceil(ln.length / per)), 0);
  };
  function put(row, c1, c2, value, o = {}) {
    if (c2 > c1) ws.mergeCells(row, c1, row, c2);
    for (let c = c1; c <= c2; c++) {
      const cell = ws.getCell(row, c);
      if (o.box) cell.border = BOX;
    }
    const cell = ws.getCell(row, c1);
    cell.value = value === undefined || value === null ? '' : value;
    cell.font = { name: FONT, size: o.size ?? 10, bold: !!o.bold, italic: !!o.italic };
    cell.alignment = { horizontal: o.h ?? 'left', vertical: o.v ?? 'middle', wrapText: true, indent: o.indent ?? 0 };
    return cell;
  }
  const setH = (row, lines, min = 20) => { ws.getRow(row).height = Math.max(min, lines * 13.5 + 6); };

  // ---- college logo banner (rows 1-4) --------------------------------------------
  for (let i = 1; i <= 4; i++) ws.getRow(i).height = 30;
  ws.mergeCells(1, 1, 4, 14);
  const lw = 400, lh = Math.round(lw / LOGO_RATIO);
  ws.addImage(wb.addImage({ base64: LOGO, extension: 'png' }), { tl: { col: (14 * COLW * 7 + 14 * 5 - lw) / 2 / (COLW * 7 + 5), row: 0.15 }, ext: { width: lw, height: lh } });

  // ---- title + term + photo box (rows 5-9) -----------------------------------------
  const O = 4;
  for (let i = 1; i <= 5; i++) ws.getRow(O + i).height = 22;
  ws.mergeCells(O + 2, 1, O + 4, 11);
  const tc = put(O + 2, 1, 1, TITLE, { bold: true, size: 14, h: 'center' });
  if (term) tc.value = { richText: [{ text: TITLE + '\n', font: { name: FONT, size: 14, bold: true } }, { text: `Academic Year : ${term}`, font: { name: FONT, size: 11, bold: true } }] };
  ws.mergeCells(O + 1, 12, O + 5, 14);
  for (let rr = 1; rr <= 5; rr++) for (let c = 12; c <= 14; c++) ws.getCell(O + rr, c).border = {
    top: rr === 1 ? { style: 'medium', color: { argb: 'FF000000' } } : undefined,
    bottom: rr === 5 ? { style: 'medium', color: { argb: 'FF000000' } } : undefined,
    left: c === 12 ? { style: 'medium', color: { argb: 'FF000000' } } : undefined,
    right: c === 14 ? { style: 'medium', color: { argb: 'FF000000' } } : undefined,
  };
  if (f.photo) {
    try {
      const id = wb.addImage({ base64: f.photo, extension: 'jpeg' });
      ws.addImage(id, { tl: { col: 11.28, row: O + 0.12 }, ext: { width: 112, height: 136 } });
    } catch { /* ignore bad photo */ }
  }
  r = O + 7;

  // ---- label : value rows -----------------------------------------------------------
  const kv = (label, value, o = {}) => {
    put(r, 1, 4, label, { bold: true, indent: 1 });
    put(r, 5, 5, ':', { bold: true, h: 'center' });
    if (o.label2) {
      put(r, 6, 8, value);
      put(r, 9, 11, o.label2, { bold: true });
      put(r, 12, 12, ':', { bold: true, h: 'center' });
      put(r, 13, 14, o.value2 ?? '');
      setH(r, Math.max(need(3, value), need(2, o.value2)), 21);
    } else {
      put(r, 6, 14, value);
      setH(r, need(9, value), 21);
    }
    r += 1;
  };
  kv('Name of the College', t.college);
  kv('Name of the Department', t.department);
  kv('Name of the faculty member', t.name);
  kv('Present Designation', t.designation);
  kv('Anna University ID', t.annaId);
  kv('AICTE ID', t.aicteId);
  kv('APPAR ID', t.apparId);
  kv('Residential Address', t.address);
  // Contact Nos. : Mobile / Email (two lines)
  put(r, 1, 4, 'Contact Nos.', { bold: true, indent: 1 }); put(r, 5, 5, ':', { bold: true, h: 'center' });
  put(r, 6, 14, 'Mobile  :  ' + (t.mobile || '')); setH(r, 1, 18); r += 1;
  put(r, 1, 4, ''); put(r, 6, 14, 'Email    :  ' + (t.email || '')); setH(r, need(9, t.email) , 18); r += 1;
  kv('Gender', t.gender || 'Male / Female / TG');
  kv('Community', t.community || 'OC / BC / MBC / SC / ST');
  kv('PAN Number', t.pan, { label2: 'Aadhaar Number', value2: t.aadhaar });
  kv('Date of Birth and Age', t.dob, { label2: 'Blood group', value2: t.blood });
  kv('Date of joining the present post', t.joining);
  kv('Scale of pay', t.scale);
  kv('Present basic pay', t.basic);
  kv('Total salary', t.total);
  r += 1;

  // ---- table helpers ------------------------------------------------------------------
  const spans = (cols) => { let c = 1; return cols.map((x) => { const a = c; c += x.span; return [a, c - 1]; }); };
  const heading = (text, tail) => {
    const cell = put(r, 1, 14, text, { bold: true, size: 10.5, indent: 1 });
    if (tail) cell.value = { richText: [{ text: text + ' ', font: { name: FONT, size: 10.5, bold: true } }, { text: tail, font: { name: FONT, size: 10.5, bold: true, italic: true } }] };
    ws.getRow(r).height = 22; r += 1;
  };
  const tableRows = (cols, data, minH = 20, centerFirst = false) => {
    const sp = spans(cols);
    data.forEach((vals) => {
      let lines = 1;
      vals.forEach((v, i) => { put(r, sp[i][0], sp[i][1], v, { box: true, size: 9, h: i === 0 && centerFirst ? 'center' : 'left' }); lines = Math.max(lines, need(cols[i].span, v)); });
      setH(r, lines, minH); r += 1;
    });
  };
  const headRow = (cols) => {
    const sp = spans(cols); let lines = 1;
    cols.forEach((c, i) => { put(r, sp[i][0], sp[i][1], c.h, { box: true, bold: true, size: 9, h: 'center' }); lines = Math.max(lines, need(c.span, c.h)); });
    setH(r, lines, 24); r += 1;
  };

  // ---- I. education --------------------------------------------------------------------
  heading('I. Particulars of Educational Qualification:', '(only completed)');
  headRow(EDU_COLS);
  const eduSp = spans(EDU_COLS);
  eduRows(f).forEach((vals) => {
    let lines = 1;
    vals.forEach((v, i) => { put(r, eduSp[i][0], eduSp[i][1], v, { box: true, size: 9, bold: i === 0, h: i === 0 ? 'center' : 'left' }); lines = Math.max(lines, need(EDU_COLS[i].span, v)); });
    setH(r, lines, 28); r += 1;
  });
  put(r, 1, 14, '* ' + ENCLOSE_NOTE, { bold: true, italic: true, size: 9, indent: 1 }); ws.getRow(r).height = 20; r += 2;

  // ---- I.a / II / III -------------------------------------------------------------------
  put(r, 1, 14, 'I.a.  Additional Qualification  :', { bold: true, indent: 1 }); ws.getRow(r).height = 20; r += 1;
  put(r, 1, 14, 'i. GATE Score (In case of B.E. / B.Tech.) :  ' + (f.gate || ''), { size: 9.5, indent: 4 }); ws.getRow(r).height = 18; r += 1;
  put(r, 1, 14, 'ii. NET / SLET (In case of M.C.A. / M.Sc. / M.A.) :  ' + (f.net || ''), { size: 9.5, indent: 4 }); ws.getRow(r).height = 18; r += 2;
  kv('II. Title of Ph.D. Thesis *', f.phdTitle);
  kv('III. Faculty in which Ph.D. was awarded', f.phdFaculty);
  r += 1;

  // ---- IV / V experience ------------------------------------------------------------------
  const expSection = (title, cols, kind) => {
    heading(title);
    const lead = cols.length, sp = spans(cols);
    // two-level header
    cols.forEach((c, i) => {
      ws.mergeCells(r, sp[i][0], r + 1, sp[i][1]);
      put(r, sp[i][0], sp[i][0], c.h, { box: true, bold: true, size: 9, h: 'center' });
      for (let rr = r; rr <= r + 1; rr++) for (let cc = sp[i][0]; cc <= sp[i][1]; cc++) ws.getCell(rr, cc).border = BOX;
    });
    put(r, lead === 4 ? 12 : 12, 14, 'Experience', { box: true, bold: true, size: 9, h: 'center' });
    ws.getRow(r).height = 20; r += 1;
    const ec = 12;                                                   // Years / Months / Days = columns 12, 13, 14
    EXP_SUB.forEach((h, i) => put(r, ec + i, ec + i, h, { box: true, bold: true, size: 9, h: 'center' }));
    ws.getRow(r).height = 20; r += 1;
    const { body, total } = expTable(kind === 'academic' ? f.academic : f.industrial, kind);
    const rowsData = body.length ? body : [Array(lead + 3).fill('')];
    rowsData.forEach((vals) => {
      let lines = 1;
      vals.forEach((v, i) => {
        if (i < lead) { put(r, sp[i][0], sp[i][1], v, { box: true, size: 9 }); lines = Math.max(lines, need(cols[i].span, v)); }
        else put(r, ec + (i - lead), ec + (i - lead), v, { box: true, size: 9, h: 'center' });
      });
      setH(r, lines, 26); r += 1;
    });
    put(r, 1, 11, 'Total', { box: true, bold: true, size: 9, h: 'right' });
    total.forEach((v, i) => put(r, ec + i, ec + i, v, { box: true, bold: true, size: 9, h: 'center' }));
    ws.getRow(r).height = 22; r += 2;
  };
  expSection('IV. Academic Experience:', ACAD_COLS, 'academic');
  expSection('V. Industrial Experience:', IND_COLS, 'industrial');

  // ---- VII - XII ------------------------------------------------------------------------------------
  for (const sec of EXTRA) {
    heading(`${sec.no}. ${sec.title}`);
    headRow(sec.cols);
    const { rows } = extraTable(f, sec);
    if (rows.length) tableRows(sec.cols, rows, 22, true);
    else { put(r, 1, 14, 'Nil', { box: true, italic: true, size: 9, h: 'center' }); ws.getRow(r).height = 20; r += 1; }
    r += 1;
  }

  ws.pageSetup.printArea = `A1:N${r}`;

  // ---- NPTEL certificates sheet --------------------------------------------------------------------------
  const certs = f.nptel.filter((x) => x.file && x.file.data);
  if (certs.length) {
    const cs = wb.addWorksheet('NPTEL Certificates', { views: [{ showGridLines: false }], pageSetup: { paperSize: 9, fitToPage: true, fitToWidth: 1, fitToHeight: 0 } });
    cs.getColumn(1).width = 3; cs.getColumn(2).width = 100;
    let cr = 1;
    cs.getCell(cr, 2).value = 'NPTEL Certificates'; cs.getCell(cr, 2).font = { name: FONT, size: 14, bold: true }; cs.getRow(cr).height = 26; cr += 2;
    certs.forEach((x, i) => {
      cs.getCell(cr, 2).value = `${i + 1}. ${x.course || x.file.name}`; cs.getCell(cr, 2).font = { name: FONT, size: 11, bold: true }; cr += 1;
      if (isPdfFile(x.file)) {
        cs.getCell(cr, 2).value = `Certificate uploaded as a PDF file (${x.file.name}) - it is included at the end of the PDF download.`;
        cs.getCell(cr, 2).font = { name: FONT, size: 10, italic: true }; cr += 2;
      } else {
        const { w, h } = imgSize(dataUrlToBytes(x.file.data));
        const k = Math.min(640 / w, 800 / h, 1.2), W = Math.round(w * k), H = Math.round(h * k);
        const id = wb.addImage({ base64: x.file.data, extension: /^data:image\/png/.test(x.file.data) ? 'png' : 'jpeg' });
        cs.addImage(id, { tl: { col: 1, row: cr - 1 }, ext: { width: W, height: H } });
        cr += Math.ceil(H / 20) + 2;
      }
    });
  }

  return new Uint8Array(await wb.xlsx.writeBuffer());
}
