import { uid } from './utils.js';

export const COLLEGE = 'GRT Institute of Engineering and Technology';
export const GENDERS = ['Male', 'Female', 'TG'];
export const COMMUNITIES = ['OC', 'BC', 'MBC', 'SC', 'ST'];
export const BLOOD_GROUPS = ['A+', 'A-', 'B+', 'B-', 'AB+', 'AB-', 'O+', 'O-'];
export const INDEXED_OPTIONS = ['Scopus', 'Web of Science', 'SCI / SCIE', 'UGC CARE', 'Google Scholar', 'Not Indexed', 'Other'];
export const WORKSHOP_ROLES = ['Participant', 'Resource Person', 'Organizer / Coordinator'];
export const FDP_MODES = ['Offline', 'Online', 'Hybrid'];
export const NPTEL_GRADES = ['Elite + Gold', 'Elite + Silver', 'Elite', 'Successfully Completed'];
export const PATENT_STATUS = ['Filed', 'Published', 'Granted'];
export const MEMBER_GRADES = ['Member', 'Associate Member', 'Fellow', 'Life Member', 'Student Member'];
export const AWARD_LEVELS = ['Institute', 'State', 'National', 'International'];
export const SCHOLAR_STATUS = ['Ongoing', 'Submitted', 'Awarded'];
export const SCHOLAR_ROLES = ['Guide', 'Co-Guide'];

export const EDU_KEYS = ['UG', 'PG', 'PhD'];
export const EDU_LABEL = { UG: 'UG', PG: 'PG', PhD: 'Ph.D.' };

const eduRow = () => ({ degree: '', specialization: '', year: '', college: '', university: '', marks: '', cls: '' });

export const blankRows = {
  academic: () => ({ id: uid(), college: '', designation: '', from: '', to: '' }),
  industrial: () => ({ id: uid(), org: '', designation: '', nature: '', from: '', to: '' }),
  publications: () => ({ id: uid(), title: '', date: '', publisher: '', indexed: '', authors: '', doi: '', issn: '' }),
  conferences: () => ({ id: uid(), title: '', authors: '', date: '', conference: '' }),
  workshops: () => ({ id: uid(), title: '', organizer: '', venue: '', from: '', to: '', role: '' }),
  fdps: () => ({ id: uid(), title: '', organizer: '', mode: '', from: '', to: '' }),
  nptel: () => ({ id: uid(), course: '', duration: '', session: '', score: '', grade: '', file: null }),
  patents: () => ({ id: uid(), title: '', number: '', date: '', status: '', inventors: '' }),
  memberships: () => ({ id: uid(), body: '', number: '', grade: '', validity: '' }),
  awards: () => ({ id: uid(), title: '', body: '', year: '', level: '' }),
  scholars: () => ({ id: uid(), name: '', university: '', regYear: '', status: '', role: '' }),
  duties: () => ({ id: uid(), responsibility: '', committee: '', period: '' }),
};

export const blankForm = () => ({
  department: '', name: '', designation: '', annaUnivId: '', aicteId: '', apparId: '', address: '', mobile: '', email: '',
  gender: '', community: '', pan: '', aadhaar: '', dob: '', bloodGroup: '',
  joiningDate: '', scaleOfPay: '', basicPay: '', totalSalary: '', photo: '',
  education: { UG: eduRow(), PG: eduRow(), PhD: eduRow() },
  gate: '', net: '', phdTitle: '', phdFaculty: '',
  academic: [blankRows.academic()],
  industrial: [blankRows.industrial()],
  publications: [blankRows.publications()],
  conferences: [blankRows.conferences()],
  workshops: [blankRows.workshops()],
  fdps: [blankRows.fdps()],
  nptel: [blankRows.nptel()],
  patents: [blankRows.patents()],
  memberships: [blankRows.memberships()],
  awards: [blankRows.awards()],
  scholars: [blankRows.scholars()],
  duties: [blankRows.duties()],
});

// Old saved sheets stay loadable if fields are added later
export function normalizeForm(data) {
  const b = blankForm();
  const out = { ...b, ...(data || {}) };
  out.education = { UG: { ...b.education.UG, ...(data?.education?.UG || {}) }, PG: { ...b.education.PG, ...(data?.education?.PG || {}) }, PhD: { ...b.education.PhD, ...(data?.education?.PhD || {}) } };
  for (const k of Object.keys(blankRows)) {
    const arr = Array.isArray(data?.[k]) && data[k].length ? data[k] : [blankRows[k]()];
    out[k] = arr.map((r) => ({ ...blankRows[k](), ...r }));
  }
  return out;
}
