// "Download Excel" button at the top: one row per teacher of the selected semester, every key detail.
import ExcelJS from 'exceljs';
import { fmtDate, ageFromDOB, sumExperience, expRows, filled } from '../utils.js';
import { count } from '../roster.js';
import { COLLEGE } from '../constants.js';
import { LOGO, LOGO_RATIO } from './headerLogo.js';

// passport photo box in the 'Photo' column (same 28:34 shape as the photo on the sheet)
const PHOTO_W = 78, PHOTO_H = Math.round(78 * 34 / 28), PHOTO_ROW_H = 84;   // pixels, pixels, points
const expTxt = (rows) => { const t = sumExperience(expRows(filled(rows))); return t ? `${t.y} yr ${t.m} mo ${t.d} d` : ''; };
const edu = (f, k) => { const e = f.education[k]; return [e.degree, e.specialization, e.year, e.college, e.university, e.marks, e.cls].filter(Boolean).join(', '); };

export async function buildRegister(items, term) {
  const wb = new ExcelJS.Workbook();
  wb.creator = 'Team OTC'; wb.title = `Faculty Register ${term}`;
  const ws = wb.addWorksheet('Faculty Register', { views: [{ state: 'frozen', ySplit: 6, xSplit: 3 }] });
  const cols = [
    ['S.No', 6], ['Photo', 15], ['Name', 28], ['Department', 26], ['Designation', 22], ['Anna University ID', 18], ['AICTE ID', 16], ['APPAR ID', 16], ['Mobile', 14], ['Email', 28], ['Gender', 9], ['Community', 11], ['PAN', 13], ['Aadhaar', 15],
    ['Date of Birth', 13], ['Age', 6], ['Blood Group', 10], ['Date of Joining', 14], ['Scale of Pay', 14], ['Basic Pay', 12], ['Total Salary', 12], ['Address', 34],
    ['UG', 40], ['PG', 40], ['Ph.D.', 40], ['GATE', 12], ['NET / SLET', 12], ['Ph.D. Thesis Title', 34], ['Ph.D. Faculty', 20],
    ['Academic Experience', 18], ['Industrial Experience', 18], ['Publications', 11], ['Conferences', 11], ['Workshops', 11], ['FDP', 7], ['NPTEL', 8], ['Patents', 9], ['Memberships', 12], ['Awards', 9], ['Ph.D. Scholars', 12], ['Admin Duties', 11],
    ['Status', 12], ['Relieving Date', 14], ['Reason', 20], ['Data Source', 22],
  ];
  cols.forEach(([, w], i) => { ws.getColumn(i + 1).width = w; });
  for (let i = 1; i <= 4; i++) ws.getRow(i).height = 30;
  ws.mergeCells(1, 1, 4, 8);
  ws.addImage(wb.addImage({ base64: LOGO, extension: 'png' }), { tl: { col: 0.2, row: 0.15 }, ext: { width: 400, height: Math.round(400 / LOGO_RATIO) } });
  ws.mergeCells(5, 1, 5, 8); ws.getCell(5, 1).value = `Faculty Records Register  -  Academic Year: ${term}`; ws.getCell(5, 1).font = { name: 'Arial', bold: true, size: 12, color: { argb: 'FF3B0764' } };
  const head = ws.getRow(6);
  cols.forEach(([h], i) => {
    const c = head.getCell(i + 1); c.value = h;
    c.font = { name: 'Arial', bold: true, size: 10, color: { argb: 'FFFFFFFF' } };
    c.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF3B0764' } };
    c.alignment = { horizontal: 'center', vertical: 'middle', wrapText: true };
    c.border = { top: { style: 'thin' }, left: { style: 'thin' }, bottom: { style: 'thin' }, right: { style: 'thin' } };
  });
  head.height = 30;
  items.forEach((it, n) => {
    const f = it.form, s = it.staff, age = ageFromDOB(f.dob);
    const vals = [n + 1, f.photo ? '' : 'No photo', s.name, f.department, f.designation, f.annaUnivId, f.aicteId, f.apparId, f.mobile, f.email, f.gender, f.community, f.pan, f.aadhaar, fmtDate(f.dob), age ?? '', f.bloodGroup, fmtDate(f.joiningDate), f.scaleOfPay, f.basicPay, f.totalSalary, f.address,
      edu(f, 'UG'), edu(f, 'PG'), edu(f, 'PhD'), f.gate, f.net, f.phdTitle, f.phdFaculty, expTxt(f.academic), expTxt(f.industrial),
      count(f.publications), count(f.conferences), count(f.workshops), count(f.fdps), count(f.nptel), count(f.patents), count(f.memberships), count(f.awards), count(f.scholars), count(f.duties),
      s.status === 'relieved' ? 'Relieved' : 'Active', fmtDate(s.relievedOn), s.reason || '', it.source === 'carried' ? `Carried from ${it.fromTerm}` : 'Saved this semester'];
    const row = ws.addRow(vals);
    row.height = PHOTO_ROW_H;                                   // tall enough for the passport photo
    if (f.photo) {
      try {
        const id = wb.addImage({ base64: f.photo, extension: f.photo.startsWith('data:image/png') ? 'png' : 'jpeg' });
        ws.addImage(id, { tl: { col: 1.12, row: row.number - 1 + 0.06 }, ext: { width: PHOTO_W, height: PHOTO_H }, editAs: 'oneCell' });
      } catch { row.getCell(2).value = 'No photo'; }              // a damaged photo never breaks the whole Excel
    }
    row.eachCell({ includeEmpty: true }, (c) => {
      c.font = { name: 'Arial', size: 10 }; c.alignment = { vertical: 'middle', wrapText: true, ...(c.col === 2 || c.col === 1 ? { horizontal: 'center' } : {}) };
      c.border = { top: { style: 'thin', color: { argb: 'FFBBBBBB' } }, left: { style: 'thin', color: { argb: 'FFBBBBBB' } }, bottom: { style: 'thin', color: { argb: 'FFBBBBBB' } }, right: { style: 'thin', color: { argb: 'FFBBBBBB' } } };
    });
  });
  ws.autoFilter = { from: { row: 6, column: 1 }, to: { row: 6, column: cols.length } };
  return wb.xlsx.writeBuffer();
}

export async function downloadRegister(items, term) {
  const bytes = await buildRegister(items, term);
  const url = URL.createObjectURL(new Blob([bytes], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' }));
  const a = document.createElement('a'); a.href = url; a.download = `Faculty_Register_${term.replace(/[^A-Za-z0-9]+/g, '_').replace(/_+$/, '')}.xlsx`;
  document.body.appendChild(a); a.click(); a.remove(); setTimeout(() => URL.revokeObjectURL(url), 4000);
}
