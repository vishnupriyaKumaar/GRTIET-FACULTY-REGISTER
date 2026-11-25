import React from 'react';
import DownloadBar from './DownloadBar.jsx';
import { COLLEGE } from '../constants.js';
import { fmtDate, ageFromDOB, expText } from '../utils.js';
import { EDU_COLS, eduRows, ACAD_COLS, IND_COLS, EXP_SUB, expTable, EXTRA, extraTable } from '../export/spec.js';

function Table({ cols, rows, foot }) {
  return (
    <div className="tbl-wrap">
      <table className="tbl">
        <thead><tr>{cols.map((c) => <th key={c}>{c}</th>)}</tr></thead>
        <tbody>
          {rows.length ? rows.map((r, i) => <tr key={i}>{r.map((c, j) => <td key={j}>{c}</td>)}</tr>) : <tr><td colSpan={cols.length} className="muted">Nothing entered</td></tr>}
          {foot ? <tr className="tfoot">{foot.map((c, j) => <td key={j}>{c}</td>)}</tr> : null}
        </tbody>
      </table>
    </div>
  );
}

// Everything stored about one teacher in one semester, read-only.
export default function StaffDetail({ form, staff, term, source, fromTerm, term: t, onEdit, onRelieve, onReinstate, onClose, setMsg }) {
  const age = ageFromDOB(form.dob);
  const kv = [
    ['Name of the College', COLLEGE], ['Department', form.department], ['Name of the faculty member', form.name || staff.name], ['Present Designation', form.designation], ['Anna University ID', form.annaUnivId], ['AICTE ID', form.aicteId], ['APPAR ID', form.apparId],
    ['Residential Address', form.address], ['Mobile', form.mobile], ['Email', form.email], ['Gender', form.gender], ['Community', form.community],
    ['PAN Number', form.pan], ['Aadhaar Number', form.aadhaar], ['Date of Birth', form.dob ? `${fmtDate(form.dob)}${age !== null ? ` (${age} years)` : ''}` : ''],
    ['Blood group', form.bloodGroup], ['Date of joining', fmtDate(form.joiningDate)], ['Scale of pay', form.scaleOfPay], ['Basic pay', form.basicPay], ['Total salary', form.totalSalary],
  ];
  const ac = expTable(form.academic, 'academic'), ind = expTable(form.industrial, 'industrial');
  const expFoot = (cols, tot) => [...Array(cols - 1).fill('').map((_, i) => (i === cols - 2 ? 'Total' : '')), ...tot];
  return (
    <div className="modal-back" onClick={onClose}>
      <div className="modal-card detail" onClick={(e) => e.stopPropagation()} role="dialog" aria-modal="true" aria-label="Teacher details">
        <div className="modal-head">
          <h3>{form.name || staff.name}</h3>
          <button type="button" className="modal-x" onClick={onClose} aria-label="Close">&times;</button>
        </div>
        <div className="detail-badges">
          <span className="badge term">{term}</span>
          {staff.status === 'relieved' ? <span className="badge bad">Relieved {fmtDate(staff.relievedOn)}{staff.reason ? ` · ${staff.reason}` : ''}</span> : <span className="badge ok">Active</span>}
          {source === 'carried' ? <span className="badge note">Carried forward from {fromTerm} - not edited in this semester yet</span> : null}
        </div>
        <div className="modal-body detail-body">
          <div className="detail-top">
            {form.photo ? <img className="detail-photo" src={form.photo} alt="Passport size photo" /> : <div className="detail-photo empty">No photo</div>}
            <dl className="kv">{kv.map(([k, v]) => <div key={k}><dt>{k}</dt><dd>{v || '—'}</dd></div>)}</dl>
          </div>

          <h4>I. Educational Qualification</h4>
          <Table cols={EDU_COLS.map((c) => c.h)} rows={eduRows(form)} />
          <h4>I.a – III. Additional Qualification, Ph.D.</h4>
          <dl className="kv one">
            <div><dt>GATE Score</dt><dd>{form.gate || '—'}</dd></div><div><dt>NET / SLET</dt><dd>{form.net || '—'}</dd></div>
            <div><dt>Title of Ph.D. Thesis</dt><dd>{form.phdTitle || '—'}</dd></div><div><dt>Faculty of Ph.D.</dt><dd>{form.phdFaculty || '—'}</dd></div>
          </dl>
          <h4>IV. Academic Experience</h4>
          <Table cols={[...ACAD_COLS.map((c) => c.h), ...EXP_SUB]} rows={ac.body} foot={ac.body.length ? expFoot(ACAD_COLS.length + 3, ac.total) : null} />
          <h4>V. Industrial Experience</h4>
          <Table cols={[...IND_COLS.map((c) => c.h), ...EXP_SUB]} rows={ind.body} foot={ind.body.length ? expFoot(IND_COLS.length + 3, ind.total) : null} />
          {EXTRA.map((s) => (
            <React.Fragment key={s.key}>
              <h4>{s.no}. {s.title}</h4>
              <Table cols={s.cols.map((c) => c.h)} rows={extraTable(form, s).rows} />
            </React.Fragment>
          ))}
        </div>
        <div className="detail-actions">
          <DownloadBar form={form} term={term} setMsg={setMsg} compact />
          <div className="detail-btns">
            {onEdit ? <button type="button" className="btn-secondary" onClick={onEdit}>Edit in Update</button> : null}
            {staff.status === 'relieved'
              ? (onReinstate ? <button type="button" className="btn-secondary" onClick={onReinstate}>Reinstate</button> : null)
              : (onRelieve ? <button type="button" className="btn-danger" onClick={onRelieve}>Relieve</button> : null)}
          </div>
        </div>
      </div>
    </div>
  );
}
