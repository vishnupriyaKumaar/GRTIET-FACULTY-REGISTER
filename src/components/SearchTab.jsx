import React, { useMemo, useState } from 'react';
import { nameKey, count } from '../roster.js';
import { fmtDate, ageFromDOB, sumExperience, expRows, expText, filled } from '../utils.js';

const expOf = (rows) => { const t = sumExperience(expRows(filled(rows))); return t ? `${t.y}y ${t.m}m ${t.d}d` : '—'; };

// Search: every teacher of the selected semester with all their information in one table.
export default function SearchTab({ term, items, onView }) {
  const [q, setQ] = useState('');
  const [status, setStatus] = useState('all');
  const rows = items.filter((i) => {
    if (status === 'active' && i.staff.status === 'relieved') return false;
    if (status === 'relieved' && i.staff.status !== 'relieved') return false;
    if (!q.trim()) return true;
    const f = i.form;
    const hay = nameKey([i.staff.name, f.department, f.designation, f.mobile, f.email, f.pan, f.aadhaar, f.annaUnivId, f.aicteId, f.apparId, f.gender, f.community, f.bloodGroup, f.address, f.phdTitle, f.phdFaculty,
      ...f.publications.map((p) => p.title), ...f.fdps.map((p) => p.title), ...f.nptel.map((p) => p.course)].join(' '));
    return nameKey(q).split(' ').every((w) => hay.includes(w));
  });

  return (
    <div>
      <h2>Search Teachers</h2>
      <div className="search-bar">
        <input className="search-in" type="search" value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search by name, department, designation, mobile, e-mail, publication, NPTEL course …" autoFocus />
        <select value={status} onChange={(e) => setStatus(e.target.value)} aria-label="Status"><option value="all">All</option><option value="active">Active</option><option value="relieved">Relieved</option></select>
      </div>
      <p className="card-note">{rows.length} of {items.length} teacher{items.length === 1 ? '' : 's'} in <strong>{term}</strong>. Click a row to see everything about that teacher.</p>
      <div className="tbl-wrap">
        <table className="tbl hover">
          <thead><tr>
            {['S.No', 'Name', 'Department', 'Designation', 'Anna Univ. ID', 'AICTE ID', 'APPAR ID', 'Mobile', 'Email', 'Gender', 'Community', 'Date of Birth', 'Age', 'Date of joining', 'Academic Exp.', 'Industrial Exp.', 'Publications', 'Conferences', 'Workshops', 'FDP', 'NPTEL', 'Patents', 'Status'].map((h) => <th key={h}>{h}</th>)}
          </tr></thead>
          <tbody>
            {rows.length === 0 ? <tr><td colSpan={23} className="muted">{items.length ? 'No teacher matches your search.' : `No teachers in ${term} yet.`}</td></tr> : rows.map((i, n) => {
              const f = i.form; const age = ageFromDOB(f.dob);
              return (
                <tr key={i.staff.id} onClick={() => onView(i.staff.id)} tabIndex={0} onKeyDown={(e) => e.key === 'Enter' && onView(i.staff.id)}>
                  <td>{n + 1}</td><td className="nm">{i.staff.name}</td><td>{f.department}</td><td>{f.designation}</td><td>{f.annaUnivId}</td><td>{f.aicteId}</td><td>{f.apparId}</td><td>{f.mobile}</td><td>{f.email}</td>
                  <td>{f.gender}</td><td>{f.community}</td><td>{fmtDate(f.dob)}</td><td>{age ?? ''}</td><td>{fmtDate(f.joiningDate)}</td>
                  <td>{expOf(f.academic)}</td><td>{expOf(f.industrial)}</td>
                  <td>{count(f.publications)}</td><td>{count(f.conferences)}</td><td>{count(f.workshops)}</td><td>{count(f.fdps)}</td><td>{count(f.nptel)}</td><td>{count(f.patents)}</td>
                  <td>{i.staff.status === 'relieved' ? <span className="badge bad">Relieved {fmtDate(i.staff.relievedOn)}</span> : i.source === 'carried' ? <span className="badge note" title={`Carried from ${i.fromTerm}`}>Carried</span> : <span className="badge ok">Active</span>}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
