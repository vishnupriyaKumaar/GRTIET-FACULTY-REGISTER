import React from 'react';
import { fmtDate } from '../utils.js';
import { recordsOf } from '../roster.js';

// Teachers who left the college. Their data stops at the semester they were relieved in.
export default function RelievedTab({ staff, records, onView, onReinstate }) {
  const list = staff.filter((s) => s.status === 'relieved').sort((a, b) => String(b.relievedOn).localeCompare(String(a.relievedOn)));
  return (
    <div>
      <h2>Relieved Teachers</h2>
      <p className="card-note">These teachers have left the college. Their records are kept exactly as they were up to the semester of relieving, and are not carried into later semesters.</p>
      <div className="tbl-wrap">
        <table className="tbl hover">
          <thead><tr>{['S.No', 'Name', 'Designation', 'Department', 'Relieving date', 'Relieved in', 'Reason', 'Semesters on record', ''].map((h) => <th key={h}>{h}</th>)}</tr></thead>
          <tbody>
            {list.length === 0 ? <tr><td colSpan={9} className="muted">No relieved teachers.</td></tr> : list.map((s, n) => {
              const recs = recordsOf(records, s.id); const last = recs[recs.length - 1];
              return (
                <tr key={s.id}>
                  <td>{n + 1}</td><td className="nm">{s.name}</td><td>{last?.form.designation}</td><td>{last?.form.department}</td><td>{fmtDate(s.relievedOn)}</td><td>{s.relievedTerm}</td><td>{s.reason}</td><td>{recs.length}</td>
                  <td className="row-btns"><button type="button" className="btn-secondary" onClick={() => onView(s.id)}>View</button> <button type="button" className="btn-secondary" onClick={() => onReinstate(s.id)}>Reinstate</button></td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
