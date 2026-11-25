import React, { useMemo, useState } from 'react';
import { SEMESTERS, makeTerm, parseTerm, yearLabel, yearOptions, validStartYear, YEAR_MIN, YEAR_MAX } from '../terms.js';

// Academic Year picker: 2001-2002 ... 2099-2100 in the list; "Edit" lets you type any other year (e.g. 2033 or 2100).
export function TermPicker({ term, onChange, idPrefix = 'term' }) {
  const p = parseTerm(term);
  const years = useMemo(() => yearOptions(p.year), [p.year]);
  const [edit, setEdit] = useState(false);
  const [txt, setTxt] = useState('');
  const [bad, setBad] = useState(false);
  const apply = () => {
    if (!validStartYear(txt)) { setBad(true); return; }
    onChange(makeTerm(Number(txt), p.sem)); setEdit(false); setBad(false);
  };
  return (
    <div className="term-pick">
      <label htmlFor={idPrefix + '-y'}>Academic Year :</label>
      {edit ? (
        <span className="year-edit">
          <input id={idPrefix + '-y'} className={bad ? 'bad' : ''} inputMode="numeric" maxLength={4} autoFocus placeholder="e.g. 2033" value={txt}
            onChange={(e) => { setTxt(e.target.value.replace(/\D/g, '').slice(0, 4)); setBad(false); }}
            onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); apply(); } if (e.key === 'Escape') setEdit(false); }} />
          <span className="year-preview">{validStartYear(txt) ? yearLabel(txt) : 'type the starting year'}</span>
          <button type="button" className="btn-primary small" onClick={apply}>OK</button>
          <button type="button" className="btn-secondary small" onClick={() => { setEdit(false); setBad(false); }}>Cancel</button>
        </span>
      ) : (
        <>
          <select id={idPrefix + '-y'} value={p.year} onChange={(e) => onChange(makeTerm(e.target.value, p.sem))}>
            {years.map((y) => <option key={y} value={y}>{yearLabel(y)}</option>)}
          </select>
          <button type="button" className="btn-secondary small" onClick={() => { setTxt(String(p.year)); setEdit(true); }} title={`The list covers ${YEAR_MIN} to ${YEAR_MAX}. Use Edit to type any other year.`}>✎ Edit year</button>
        </>
      )}
      <select aria-label="Semester" value={p.sem} onChange={(e) => onChange(makeTerm(p.year, e.target.value))}>
        {SEMESTERS.map((s) => <option key={s} value={s}>{s}</option>)}
      </select>
    </div>
  );
}

export default function TermBar({ term, onChange, summary }) {
  return (
    <div className="term-bar" role="region" aria-label="Academic year">
      <TermPicker term={term} onChange={onChange} />
      <strong className="term-now">{term}</strong>
      <span className="term-sum">{summary}</span>
    </div>
  );
}
