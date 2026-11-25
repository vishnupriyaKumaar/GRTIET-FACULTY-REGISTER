// Quick self-test: builds a sample PDF, Word and Excel file in ./test-output
// Run:  npm run test:export
import fs from 'node:fs';
import { blankForm } from '../src/constants.js';
import { buildPdf } from '../src/export/exportPdf.js';
import { buildDocx } from '../src/export/exportDocx.js';
import { buildXlsx } from '../src/export/exportXlsx.js';

const read = (p) => (fs.existsSync(p) ? fs.readFileSync(p, 'utf8') : '');
const f = blankForm();
Object.assign(f, { annaUnivId: 'AU-12345', aicteId: '1-4567890', apparId: '9876-5432-1098',
  department: 'Computer Science and Engineering', name: 'Dr. A. Sample Kumar', designation: 'Assistant Professor',
  address: 'No. 12, Anna Nagar Main Road, Tiruttani, Tiruvallur District, Tamil Nadu - 631209',
  mobile: '9876543210', email: 'sample.kumar@grt.edu.in', gender: 'Male', community: 'BC',
  pan: 'ABCDE1234F', aadhaar: '123456789012', dob: '1988-07-15', bloodGroup: 'O+', joiningDate: '2018-06-01',
  scaleOfPay: '15600-39100 (AGP 6000)', basicPay: '56,100', totalSalary: '78,500',
  gate: 'GATE 2012 - Score 612', net: 'Not applicable', phdTitle: 'Deep learning approaches for crop disease detection', phdFaculty: 'Information and Communication Engineering',
  other: 'Member of IEEE and ISTE.\nCoordinator of the Departmental Association.',
  photo: read('/tmp/photo.b64'),
});
f.education.UG = { degree: 'B.E.', specialization: 'CSE', year: '2010', college: 'ABC Engineering College', university: 'Anna University', marks: '78.5%', cls: 'First' };
f.education.PG = { degree: 'M.E.', specialization: 'Software Engineering', year: '2012', college: 'XYZ Institute of Technology', university: 'Anna University', marks: '8.4 CGPA', cls: 'First - Distinction' };
f.education.PhD = { degree: 'Ph.D.', specialization: 'Computer Science', year: '2019', college: 'Anna University', university: 'Anna University', marks: '-', cls: '-' };
f.academic = [
  { id: 'a1', college: 'Sri Ram Engineering College', designation: 'Assistant Professor', from: '2012-07-02', to: '2018-05-31' },
  { id: 'a2', college: 'GRT Institute of Engineering and Technology', designation: 'Assistant Professor', from: '2018-06-01', to: '' },
];
f.industrial = [{ id: 'i1', org: 'TCS', designation: 'Systems Engineer', nature: 'Software development', from: '2010-08-01', to: '2012-06-30' }];
f.publications = [
  { id: 'p1', title: 'Crop disease detection using lightweight CNN', date: '2023-03-14', publisher: 'Elsevier', indexed: 'Scopus', authors: 'A. Sample Kumar, B. Rao', doi: '10.1016/j.example.2023.01.001', issn: '1234-5678' },
  { id: 'p2', title: 'A survey on edge AI', date: '2024-01-20', publisher: 'IEEE', indexed: 'Web of Science', authors: 'A. Sample Kumar', doi: '10.1109/ACCESS.2024.1', issn: '2169-3536' },
];
f.conferences = [{ id: 'c1', title: 'Smart attendance using face recognition', authors: 'A. Sample Kumar', date: '2022-11-05', conference: 'International Conference on Computing, Chennai' }];
f.workshops = [{ id: 'w1', title: 'Hands-on workshop on Cloud Computing', organizer: 'IIT Madras', venue: 'Chennai', from: '2023-05-02', to: '2023-05-04', role: 'Participant' }];
f.fdps = [{ id: 'f1', title: 'FDP on Machine Learning', organizer: 'NITTTR Chennai', mode: 'Online', from: '2024-06-10', to: '2024-06-14' }];
f.nptel = [
  { id: 'n1', course: 'Programming, Data Structures and Algorithms using Python', duration: '12', session: 'Jul-Oct 2023', score: '78', grade: 'Elite', file: { name: 'python-cert.jpg', type: 'image/jpeg', data: read('/tmp/cert.b64') } },
  { id: 'n2', course: 'Cloud Computing', duration: '8', session: 'Jan-Mar 2024', score: '65', grade: 'Successfully Completed', file: null },
];
f.patents = [{ id: 't1', title: 'Smart irrigation controller', number: '202341012345', date: '2023-02-10', status: 'Published', inventors: 'A. Sample Kumar; B. Rao' }];

fs.mkdirSync('test-output', { recursive: true });
fs.writeFileSync('test-output/sample.pdf', await buildPdf(f, '2026-2027 (Odd Semester)'));
fs.writeFileSync('test-output/sample.docx', await buildDocx(f, '2026-2027 (Odd Semester)'));
fs.writeFileSync('test-output/sample.xlsx', await buildXlsx(f, '2026-2027 (Odd Semester)'));
// empty form should also work
const e = blankForm();
fs.writeFileSync('test-output/empty.pdf', await buildPdf(e));
fs.writeFileSync('test-output/empty.docx', await buildDocx(e));
fs.writeFileSync('test-output/empty.xlsx', await buildXlsx(e));
console.log('OK - files written to test-output/');
