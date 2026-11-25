import React, { useState } from 'react';
import { nameKey } from '../roster.js';
import { fmtDate } from '../utils.js';

// "Name of the faculty member :" box with a suggestion list of teachers already in the register.
export default function NameBox({ label = 'Name of the Faculty Member', value, onChange, onPick, options, placeholder = 'e.g. Dr. Kamal. N.', autoFocus, noSuggest, extra }) {
  const [open, setOpen] = useState(false);
  const q = nameKey(value);
  const list = q && !noSuggest ? options.filter((o) => nameKey(o.name).includes(q)).slice(0, 8) : [];
  return (
    <div className="namebox">
      <label className="inline-label" htmlFor="namebox-input">{label} :</label>
      <div className="namebox-wrap">
        <input id="namebox-input" value={value} autoFocus={autoFocus} autoComplete="off" placeholder={placeholder}
          onChange={(e) => { onChange(e.target.value); setOpen(true); }}
          onFocus={() => setOpen(true)}
          onBlur={() => setTimeout(() => setOpen(false), 150)}
          onKeyDown={(e) => { if (e.key === 'Enter') { const exact = options.find((o) => nameKey(o.name) === q); if (exact) { onPick(exact); setOpen(false); } } }} />
        {open && list.length ? (
          <ul className="suggest" role="listbox">
            {list.map((o) => (
              <li key={o.id} role="option" onMouseDown={(e) => { e.preventDefault(); onPick(o); setOpen(false); }}>
                <strong>{o.name}</strong>
                <span>{o.sub}{o.status === 'relieved' ? ` · Relieved ${fmtDate(o.relievedOn)}` : ''}</span>
              </li>
            ))}
          </ul>
        ) : null}
      </div>
      {extra}
    </div>
  );
}
