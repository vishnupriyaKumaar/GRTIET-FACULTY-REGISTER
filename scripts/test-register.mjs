// Self-test of the "Download Excel" register: builds ./test-output/register.xlsx with a Photo column.
// Run:  npm run test:register
import fs from 'node:fs';
import { blankForm } from '../src/constants.js';
import { buildRegister } from '../src/export/exportRegister.js';

const photo = fs.existsSync('/tmp/photo.b64') ? fs.readFileSync('/tmp/photo.b64', 'utf8') : '';
const mk = (name, withPhoto) => ({ staff: { id: name, name, status: 'active' }, form: { ...blankForm(), name, designation: 'Assistant Professor', department: 'CSE', photo: withPhoto ? photo : '' }, source: 'saved', fromTerm: '2026-2027 (Odd Semester)' });
const bytes = await buildRegister([mk('Dr. A. Kumar', true), mk('Ms. B. Devi', false), mk('Mr. C. Raj', true)], '2026-2027 (Odd Semester)');
fs.mkdirSync('test-output', { recursive: true });
fs.writeFileSync('test-output/register.xlsx', bytes);
console.log('OK - test-output/register.xlsx (' + bytes.byteLength + ' bytes)');
