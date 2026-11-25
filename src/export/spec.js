// ONE description of the sheet, used by the PDF, Word and Excel exports so all three
// have exactly the same sections, columns and order.
// `span` = column width out of a 14-column grid (Excel merges cells by it; PDF/Word use it as width).
import { fmtDate, durationDays, expRows, sumExperience, filled, ageFromDOB } from '../utils.js';
import { COLLEGE, EDU_KEYS, EDU_LABEL } from '../constants.js';

export const GRID = 14;
export const TITLE = 'INDIVIDUAL FACULTY DATA SHEET';
export const ENCLOSE_NOTE = 'Enclose copies of certificates duly attested by the faculty member and the Principal as proof.';

// Section I - education
export const EDU_COLS = [
  { h: 'Category', span: 1 }, { h: 'Name of the Degree', span: 2 }, { h: 'Specialization', span: 2 },
  { h: 'Year of Passing', span: 1 }, { h: 'Name of the College', span: 3 }, { h: 'Name of the University', span: 3 },
  { h: '% of Marks / Grades obtained', span: 1 }, { h: 'Class obtained', span: 1 },
];
export const eduRows = (f) => EDU_KEYS.map((k) => {
  const e = f.education[k];
  return [EDU_LABEL[k], e.degree, e.specialization, e.year, e.college, e.university, e.marks, e.cls];
});

// Sections IV and V - experience (two-level header: "Experience" over Years / Months / Days)
export const ACAD_COLS = [
  { h: 'Name of the College', span: 4 }, { h: 'Designation', span: 3 }, { h: 'Joining Date', span: 2 }, { h: 'Relieving Date', span: 2 },
];
export const IND_COLS = [
  { h: 'Name of the Organisation', span: 3 }, { h: 'Designation', span: 2 }, { h: 'Nature of Work', span: 2 }, { h: 'Joining Date', span: 2 }, { h: 'Relieving Date', span: 2 },
];
export const EXP_SUB = ['Years', 'Months', 'Days'];
const relieve = (r) => (r.from && !r.to ? 'Till date' : fmtDate(r.to));
export function expTable(rows, kind) {
  const list = filled(rows);
  const exps = expRows(list);
  const body = list.map((r, i) => {
    const e = exps[i];
    const lead = kind === 'academic'
      ? [r.college, r.designation, fmtDate(r.from), relieve(r)]
      : [r.org, r.designation, r.nature, fmtDate(r.from), relieve(r)];
    return [...lead, e ? String(e.y) : '', e ? String(e.m) : '', e ? String(e.d) : ''];
  });
  const t = sumExperience(exps);
  return { body, total: t ? [String(t.y), String(t.m), String(t.d)] : ['', '', ''] };
}

// Extra sections VII - XII
export const EXTRA = [
  {
    key: 'publications', no: 'VII', title: 'Publication Details',
    cols: [
      { h: 'S.No', span: 1 }, { h: 'Title of the Paper', span: 2 }, { h: 'Date of Publication', span: 2 }, { h: 'Publisher Name', span: 2 },
      { h: 'Indexed', span: 1 }, { h: 'Author Name', span: 2 }, { h: 'DOI / No', span: 2 }, { h: 'ISSN / ISBN No', span: 2 },
    ],
    row: (r) => [r.title, fmtDate(r.date), r.publisher, r.indexed, r.authors, r.doi, r.issn],
  },
  {
    key: 'conferences', no: 'VIII', title: 'Conference Details',
    cols: [{ h: 'S.No', span: 1 }, { h: 'Title of the Paper', span: 5 }, { h: 'Author Name', span: 3 }, { h: 'Date', span: 2 }, { h: 'Conference Name', span: 3 }],
    row: (r) => [r.title, r.authors, fmtDate(r.date), r.conference],
  },
  {
    key: 'workshops', no: 'IX', title: 'Workshop Details',
    cols: [{ h: 'S.No', span: 1 }, { h: 'Title of the Workshop', span: 3 }, { h: 'Organized By', span: 2 }, { h: 'Venue', span: 2 }, { h: 'From', span: 2 }, { h: 'To', span: 2 }, { h: 'Role', span: 2 }],
    row: (r) => [r.title, r.organizer, r.venue, fmtDate(r.from), fmtDate(r.to), r.role],
  },
  {
    key: 'fdps', no: 'X', title: 'Faculty Development Programme (FDP)',
    cols: [{ h: 'S.No', span: 1 }, { h: 'Title of the FDP', span: 4 }, { h: 'Organized By', span: 3 }, { h: 'Mode', span: 1 }, { h: 'From', span: 2 }, { h: 'To', span: 2 }, { h: 'Days', span: 1 }],
    row: (r) => [r.title, r.organizer, r.mode, fmtDate(r.from), fmtDate(r.to), durationDays(r.from, r.to)],
  },
  {
    key: 'nptel', no: 'XI', title: 'NPTEL Courses',
    cols: [{ h: 'S.No', span: 1 }, { h: 'Course Name', span: 4 }, { h: 'Weeks', span: 1 }, { h: 'Session', span: 2 }, { h: 'Score (%)', span: 1 }, { h: 'Grade / Certificate', span: 2 }, { h: 'Certificate File', span: 3 }],
    row: (r) => [r.course, r.duration, r.session, r.score, r.grade, r.file ? r.file.name : ''],
  },
  {
    key: 'patents', no: 'XII', title: 'Patent Details',
    cols: [{ h: 'S.No', span: 1 }, { h: 'Title of the Patent', span: 4 }, { h: 'Application / Patent No', span: 3 }, { h: 'Date of Filing', span: 2 }, { h: 'Status', span: 2 }, { h: 'Inventor(s)', span: 2 }],
    row: (r) => [r.title, r.number, fmtDate(r.date), r.status, r.inventors],
  },
  {
    key: 'memberships', no: 'XIII', title: 'Professional Body Membership',
    cols: [{ h: 'S.No', span: 1 }, { h: 'Professional Body', span: 5 }, { h: 'Membership No.', span: 3 }, { h: 'Grade (Member / Fellow / Life Member)', span: 2 }, { h: 'Valid From - To', span: 3 }],
    row: (r) => [r.body, r.number, r.grade, r.validity],
  },
  {
    key: 'awards', no: 'XIV', title: 'Awards and Recognitions',
    cols: [{ h: 'S.No', span: 1 }, { h: 'Award / Recognition', span: 5 }, { h: 'Awarding Body', span: 4 }, { h: 'Year', span: 1 }, { h: 'Level', span: 3 }],
    row: (r) => [r.title, r.body, r.year, r.level],
  },
  {
    key: 'scholars', no: 'XV', title: 'Ph.D. Scholars Guided',
    cols: [{ h: 'S.No', span: 1 }, { h: 'Scholar Name', span: 3 }, { h: 'University', span: 3 }, { h: 'Registration Year', span: 2 }, { h: 'Status (Ongoing / Awarded)', span: 2 }, { h: 'Role (Guide / Co-Guide)', span: 3 }],
    row: (r) => [r.name, r.university, r.regYear, r.status, r.role],
  },
  {
    key: 'duties', no: 'XVI', title: 'Administrative / Institutional Responsibilities',
    cols: [{ h: 'S.No', span: 1 }, { h: 'Responsibility', span: 7 }, { h: 'Committee / Cell', span: 3 }, { h: 'Period (From - To)', span: 3 }],
    row: (r) => [r.responsibility, r.committee, r.period],
  },
];

// Only the rows the person actually filled, numbered; at least one empty numbered row when nothing is filled.
export function extraTable(f, sec) {
  const list = filled(f[sec.key]);
  const rows = list.map((r, i) => [String(i + 1), ...sec.row(r)]);
  return { rows, rawRows: list };
}

// Top block: label : value rows (shared order)
export function topRows(f) {
  const age = ageFromDOB(f.dob);
  return {
    college: COLLEGE,
    department: f.department, name: f.name, designation: f.designation, annaId: f.annaUnivId, aicteId: f.aicteId, apparId: f.apparId, address: f.address,
    mobile: f.mobile, email: f.email, gender: f.gender, community: f.community,
    pan: f.pan, aadhaar: /^\d{12}$/.test(f.aadhaar || '') ? f.aadhaar.replace(/(\d{4})(?=\d)/g, '$1 ') : f.aadhaar,
    dob: f.dob ? `${fmtDate(f.dob)}${age !== null ? `  (${age} years)` : ''}` : '', blood: f.bloodGroup,
    joining: fmtDate(f.joiningDate), scale: f.scaleOfPay, basic: f.basicPay, total: f.totalSalary,
  };
}

export const fileSafeName = (f) => {
  const n = (f.name || 'Faculty').trim().replace(/[^A-Za-z0-9]+/g, '_').replace(/^_+|_+$/g, '');
  return `Faculty_Data_Sheet_${n || 'Faculty'}`;
};
