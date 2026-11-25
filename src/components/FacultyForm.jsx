import React, { useMemo } from 'react';
import { Field, TextField, AreaField, SelectField, Segmented, Section, PhotoField, RowList } from './Fields.jsx';
import {
  COLLEGE, GENDERS, COMMUNITIES, BLOOD_GROUPS, INDEXED_OPTIONS, WORKSHOP_ROLES, FDP_MODES, NPTEL_GRADES, PATENT_STATUS,
  EDU_KEYS, EDU_LABEL, blankRows,
  MEMBER_GRADES, AWARD_LEVELS, SCHOLAR_STATUS, SCHOLAR_ROLES,
} from '../constants.js';
import { ageFromDOB, expRows, sumExperience, expText, isFilled } from '../utils.js';

const digits = (v, n) => v.replace(/\D/g, '').slice(0, n);

// All the faculty-sheet sections (Personal, I - XVI).  Used by the Add Teacher tab and the Update tab.
export default function FacultyForm({ form, setForm, setMsg }) {
  const set = (k, v) => setForm((f) => ({ ...f, [k]: v }));
  const setEdu = (k, field, v) => setForm((f) => ({ ...f, education: { ...f.education, [k]: { ...f.education[k], [field]: v } } }));
  const rowOps = (key) => ({
    rows: form[key],
    onChange: (id, field, v) => setForm((f) => ({ ...f, [key]: f[key].map((r) => (r.id === id ? { ...r, [field]: v } : r)) })),
    onAdd: () => setForm((f) => ({ ...f, [key]: [...f[key], blankRows[key]()] })),
    onDel: (id) => setForm((f) => { const left = f[key].filter((r) => r.id !== id); return { ...f, [key]: left.length ? left : [blankRows[key]()] }; }),
    setMsg,
  });
  const age = ageFromDOB(form.dob);
  const acadTotal = useMemo(() => sumExperience(expRows(form.academic.filter((r) => isFilled(r)))), [form.academic]);
  const indTotal = useMemo(() => sumExperience(expRows(form.industrial.filter((r) => isFilled(r)))), [form.industrial]);
  const errors = {
    mobile: form.mobile && form.mobile.length !== 10 ? 'Mobile number should have 10 digits' : '',
    email: form.email && !/^\S+@\S+\.\S+$/.test(form.email) ? 'Enter a valid e-mail address' : '',
    pan: form.pan && !/^[A-Z]{5}[0-9]{4}[A-Z]$/.test(form.pan) ? 'PAN looks like ABCDE1234F' : '',
    aadhaar: form.aadhaar && form.aadhaar.length !== 12 ? 'Aadhaar number should have 12 digits' : '',
  };

  return (
    <div className="ffm">
  {/* ---------------- Personal ---------------- */}
  <Section id="personal" no="" title="Faculty Details" note="Fill in the details exactly as you want them printed on the sheet.">
    <PhotoField value={form.photo} onChange={(v) => set('photo', v)} setMsg={setMsg} />
    <div className="grid">
      <TextField label="Name of the College" value={COLLEGE} onChange={() => {}} readOnly wide className="ro" />
      <TextField label="Name of the Department" value={form.department} onChange={(v) => set('department', v)} wide placeholder="e.g. Computer Science and Engineering" />
      <TextField label="Present Designation" value={form.designation} onChange={(v) => set('designation', v)} wide placeholder="e.g. Assistant Professor" />
      <TextField label="Anna University ID" value={form.annaUnivId} onChange={(v) => set('annaUnivId', v.trim())} />
      <TextField label="AICTE ID" value={form.aicteId} onChange={(v) => set('aicteId', v.trim())} />
      <TextField label="APPAR ID" value={form.apparId} onChange={(v) => set('apparId', v.trim())} />
      <AreaField label="Residential Address" value={form.address} onChange={(v) => set('address', v)} rows={2} />
      <TextField label="Contact No. – Mobile" value={form.mobile} onChange={(v) => set('mobile', digits(v, 10))} inputMode="numeric" error={errors.mobile} placeholder="10 digit mobile number" />
      <TextField label="Contact No. – Email" type="email" value={form.email} onChange={(v) => set('email', v.trim())} error={errors.email} />
      <Segmented label="Gender" value={form.gender} onChange={(v) => set('gender', v)} options={GENDERS} />
      <Segmented label="Community" value={form.community} onChange={(v) => set('community', v)} options={COMMUNITIES} />
      <TextField label="PAN Number" value={form.pan} onChange={(v) => set('pan', v.toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 10))} error={errors.pan} placeholder="ABCDE1234F" />
      <TextField label="Aadhaar Number" value={form.aadhaar} onChange={(v) => set('aadhaar', digits(v, 12))} inputMode="numeric" error={errors.aadhaar} placeholder="12 digit Aadhaar number" />
      <TextField label="Date of Birth" type="date" value={form.dob} onChange={(v) => set('dob', v)} hint={age !== null ? `Age: ${age} years (printed with the date)` : 'Age is worked out automatically'} />
      <SelectField label="Blood group" value={form.bloodGroup} onChange={(v) => set('bloodGroup', v)} options={BLOOD_GROUPS} />
      <TextField label="Date of joining the present post" type="date" value={form.joiningDate} onChange={(v) => set('joiningDate', v)} />
      <TextField label="Scale of pay" value={form.scaleOfPay} onChange={(v) => set('scaleOfPay', v)} />
      <TextField label="Present basic pay" value={form.basicPay} onChange={(v) => set('basicPay', v)} inputMode="decimal" />
      <TextField label="Total salary" value={form.totalSalary} onChange={(v) => set('totalSalary', v)} inputMode="decimal" />
    </div>
  </Section>

  {/* ---------------- I. Education ---------------- */}
  <Section id="education" no="I." title="Particulars of Educational Qualification" note="Only completed qualifications. Enclose copies of certificates duly attested by the faculty member and the Principal as proof.">
    {EDU_KEYS.map((k) => {
      const e = form.education[k];
      return (
        <div className="row-card" key={k}>
          <div className="row-head"><strong>{EDU_LABEL[k]}</strong></div>
          <div className="grid">
            <TextField label="Name of the Degree" value={e.degree} onChange={(v) => setEdu(k, 'degree', v)} />
            <TextField label="Specialization" value={e.specialization} onChange={(v) => setEdu(k, 'specialization', v)} />
            <TextField label="Year of Passing" value={e.year} onChange={(v) => setEdu(k, 'year', digits(v, 4))} inputMode="numeric" placeholder="YYYY" />
            <TextField label="Name of the College" value={e.college} onChange={(v) => setEdu(k, 'college', v)} />
            <TextField label="Name of the University" value={e.university} onChange={(v) => setEdu(k, 'university', v)} />
            <TextField label="% of Marks / Grades obtained" value={e.marks} onChange={(v) => setEdu(k, 'marks', v)} />
            <TextField label="Class obtained" value={e.cls} onChange={(v) => setEdu(k, 'cls', v)} />
          </div>
        </div>
      );
    })}
  </Section>

  {/* ---------------- I.a, II, III ---------------- */}
  <Section id="addl" no="I.a." title="Additional Qualification, Ph.D. Thesis">
    <div className="grid">
      <TextField label="i. GATE Score (In case of B.E. / B.Tech.)" value={form.gate} onChange={(v) => set('gate', v)} wide />
      <TextField label="ii. NET / SLET (In case of M.C.A. / M.Sc. / M.A.)" value={form.net} onChange={(v) => set('net', v)} wide />
      <AreaField label="II. Title of Ph.D. Thesis" value={form.phdTitle} onChange={(v) => set('phdTitle', v)} rows={2} />
      <TextField label="III. Faculty in which Ph.D. was awarded" value={form.phdFaculty} onChange={(v) => set('phdFaculty', v)} wide />
    </div>
  </Section>

  {/* ---------------- IV. Academic experience ---------------- */}
  <Section id="academic" no="IV." title="Academic Experience" note="Years, months and days are calculated from the dates (both days counted). Leave the relieving date empty if you are still working there.">
    <RowList {...rowOps('academic')} itemName="College" addLabel="Add another college" showExp fields={[
      { k: 'college', label: 'Name of the College', wide: true },
      { k: 'designation', label: 'Designation' },
      { k: 'from', label: 'Joining Date', type: 'date' },
      { k: 'to', label: 'Relieving Date', type: 'date', hint: 'Empty = till date' },
    ]} />
    <div className="total-bar">Total academic experience: <strong>{acadTotal ? expText(acadTotal) : '—'}</strong></div>
  </Section>

  {/* ---------------- V. Industrial experience ---------------- */}
  <Section id="industrial" no="V." title="Industrial Experience">
    <RowList {...rowOps('industrial')} itemName="Organisation" addLabel="Add another organisation" showExp fields={[
      { k: 'org', label: 'Name of the Organisation', wide: true },
      { k: 'designation', label: 'Designation' },
      { k: 'nature', label: 'Nature of Work' },
      { k: 'from', label: 'Joining Date', type: 'date' },
      { k: 'to', label: 'Relieving Date', type: 'date', hint: 'Empty = till date' },
    ]} />
    <div className="total-bar">Total industrial experience: <strong>{indTotal ? expText(indTotal) : '—'}</strong></div>
  </Section>

  {/* ---------------- VII. Publications ---------------- */}
  <Section id="publications" no="VII." title="Publication Details">
    <RowList {...rowOps('publications')} itemName="Publication" addLabel="Add another publication" fields={[
      { k: 'title', label: 'Title of the Paper', type: 'area', wide: true },
      { k: 'date', label: 'Date of Publication', type: 'flexdate' },
      { k: 'publisher', label: 'Publisher Name' },
      { k: 'indexed', label: 'Indexed', type: 'select', options: INDEXED_OPTIONS },
      { k: 'authors', label: 'Author Name', hint: 'Separate several authors with commas' },
      { k: 'doi', label: 'DOI / No' },
      { k: 'issn', label: 'ISSN / ISBN No' },
    ]} />
  </Section>

  {/* ---------------- VIII. Conference ---------------- */}
  <Section id="conferences" no="VIII." title="Conference Details">
    <RowList {...rowOps('conferences')} itemName="Conference paper" addLabel="Add another conference" fields={[
      { k: 'title', label: 'Title of the Paper', type: 'area', wide: true },
      { k: 'authors', label: 'Author Name' },
      { k: 'date', label: 'Date', type: 'flexdate' },
      { k: 'conference', label: 'Conference Name', wide: true },
    ]} />
  </Section>

  {/* ---------------- IX. Workshop ---------------- */}
  <Section id="workshops" no="IX." title="Workshop Details">
    <RowList {...rowOps('workshops')} itemName="Workshop" addLabel="Add another workshop" fields={[
      { k: 'title', label: 'Title of the Workshop', wide: true },
      { k: 'organizer', label: 'Organized By' },
      { k: 'venue', label: 'Venue' },
      { k: 'from', label: 'From', type: 'date' },
      { k: 'to', label: 'To', type: 'date' },
      { k: 'role', label: 'Role', type: 'select', options: WORKSHOP_ROLES },
    ]} />
  </Section>

  {/* ---------------- X. FDP ---------------- */}
  <Section id="fdps" no="X." title="Faculty Development Programme (FDP)">
    <RowList {...rowOps('fdps')} itemName="FDP" addLabel="Add another FDP" fields={[
      { k: 'title', label: 'Title of the FDP', wide: true },
      { k: 'organizer', label: 'Organized By' },
      { k: 'mode', label: 'Mode', type: 'select', options: FDP_MODES },
      { k: 'from', label: 'From', type: 'date' },
      { k: 'to', label: 'To', type: 'date' },
    ]} />
  </Section>

  {/* ---------------- XI. NPTEL ---------------- */}
  <Section id="nptel" no="XI." title="NPTEL Courses" note="Upload the certificate as a picture (JPG / PNG - compressed automatically) or a PDF up to 5 MB. Pictures are shown at the end of the Word and PDF files; PDF certificates are added to the end of the PDF file.">
    <RowList {...rowOps('nptel')} itemName="NPTEL course" addLabel="Add another NPTEL course" fields={[
      { k: 'course', label: 'Course Name', wide: true },
      { k: 'duration', label: 'Duration (weeks)', inputMode: 'numeric' },
      { k: 'session', label: 'Session', placeholder: 'e.g. Jul–Oct 2024' },
      { k: 'score', label: 'Final Score (%)', inputMode: 'decimal' },
      { k: 'grade', label: 'Grade / Certificate', type: 'select', options: NPTEL_GRADES },
      { k: 'file', type: 'cert' },
    ]} />
  </Section>

  {/* ---------------- XII. Patent ---------------- */}
  <Section id="patents" no="XII." title="Patent Details">
    <RowList {...rowOps('patents')} itemName="Patent" addLabel="Add another patent" fields={[
      { k: 'title', label: 'Title of the Patent', type: 'area', wide: true },
      { k: 'number', label: 'Application / Patent No' },
      { k: 'date', label: 'Date of Filing', type: 'date' },
      { k: 'status', label: 'Status', type: 'select', options: PATENT_STATUS },
      { k: 'inventors', label: 'Inventor(s)' },
    ]} />
  </Section>


  {/* ---------------- XIII. Professional body membership ---------------- */}
  <Section id="memberships" no="XIII." title="Professional Body Membership">
    <RowList {...rowOps('memberships')} itemName="Membership" addLabel="Add another membership" fields={[
      { k: 'body', label: 'Professional Body', wide: true, placeholder: 'e.g. IEEE, CSI, ISTE' },
      { k: 'number', label: 'Membership No.' },
      { k: 'grade', label: 'Grade (Member / Fellow / Life Member)', type: 'select', options: MEMBER_GRADES },
      { k: 'validity', label: 'Valid From - To', placeholder: 'e.g. 18.09.2020 to 17.09.2025' },
    ]} />
  </Section>

  {/* ---------------- XIV. Awards and recognitions ---------------- */}
  <Section id="awards" no="XIV." title="Awards and Recognitions">
    <RowList {...rowOps('awards')} itemName="Award" addLabel="Add another award" fields={[
      { k: 'title', label: 'Award / Recognition', type: 'area', wide: true },
      { k: 'body', label: 'Awarding Body' },
      { k: 'year', label: 'Year', inputMode: 'numeric', placeholder: 'e.g. 2023' },
      { k: 'level', label: 'Level (Institute / State / National / Intl.)', type: 'select', options: AWARD_LEVELS },
    ]} />
  </Section>

  {/* ---------------- XV. Ph.D. scholars guided ---------------- */}
  <Section id="scholars" no="XV." title="Ph.D. Scholars Guided">
    <RowList {...rowOps('scholars')} itemName="Scholar" addLabel="Add another scholar" fields={[
      { k: 'name', label: 'Scholar Name' },
      { k: 'university', label: 'University' },
      { k: 'regYear', label: 'Registration Year', inputMode: 'numeric', placeholder: 'e.g. 2022' },
      { k: 'status', label: 'Status (Ongoing / Awarded)', type: 'select', options: SCHOLAR_STATUS },
      { k: 'role', label: 'Role (Guide / Co-Guide)', type: 'select', options: SCHOLAR_ROLES },
    ]} />
  </Section>

  {/* ---------------- XVI. Administrative / institutional responsibilities ---------------- */}
  <Section id="duties" no="XVI." title="Administrative / Institutional Responsibilities">
    <RowList {...rowOps('duties')} itemName="Responsibility" addLabel="Add another responsibility" fields={[
      { k: 'responsibility', label: 'Responsibility', type: 'area', wide: true, placeholder: 'e.g. NBA Coordinator, Placement Coordinator' },
      { k: 'committee', label: 'Committee / Cell' },
      { k: 'period', label: 'Period (From - To)', placeholder: 'e.g. 29.06.2015 - Till date' },
    ]} />
  </Section>

    </div>
  );
}
