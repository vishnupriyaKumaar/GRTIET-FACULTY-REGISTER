import React, { useRef, useState } from 'react';
import { passportPhoto, readCertificate } from '../imageUtils.js';
import { experience, expText, isFilled, fmtDate } from '../utils.js';

export function Field({ label, hint, error, wide, children }) {
  return (
    <label className={'field' + (wide ? ' field-wide' : '')}>
      <span className="field-label">{label}</span>
      {children}
      {error ? <span className="field-error">{error}</span> : hint ? <span className="field-hint">{hint}</span> : null}
    </label>
  );
}

export function TextField({ label, value, onChange, type = 'text', hint, error, wide, ...rest }) {
  return (
    <Field label={label} hint={hint} error={error} wide={wide}>
      <input type={type} value={value || ''} onChange={(e) => onChange(e.target.value)} {...rest} />
    </Field>
  );
}

export function AreaField({ label, value, onChange, hint, rows = 3, wide = true, ...rest }) {
  return (
    <Field label={label} hint={hint} wide={wide}>
      <textarea rows={rows} value={value || ''} onChange={(e) => onChange(e.target.value)} {...rest} />
    </Field>
  );
}

export function SelectField({ label, value, onChange, options, wide, hint }) {
  return (
    <Field label={label} wide={wide} hint={hint}>
      <select value={value || ''} onChange={(e) => onChange(e.target.value)}>
        <option value="">Select…</option>
        {options.map((o) => <option key={o} value={o}>{o}</option>)}
      </select>
    </Field>
  );
}

export function Segmented({ label, value, onChange, options }) {
  return (
    <div className="field">
      <span className="field-label">{label}</span>
      <div className="seg" role="radiogroup" aria-label={label}>
        {options.map((o) => (
          <button key={o} type="button" role="radio" aria-checked={value === o} className={'seg-btn' + (value === o ? ' on' : '')} onClick={() => onChange(value === o ? '' : o)}>{o}</button>
        ))}
      </div>
    </div>
  );
}

export function Section({ id, no, title, note, children, actions }) {
  return (
    <section className="sec" id={id}>
      <div className="card-head">
        <h3 className="sec-title">{no ? <span className="sec-no">{no}</span> : null}{title}</h3>
        {actions}
      </div>
      {note ? <p className="card-note">{note}</p> : null}
      {children}
    </section>
  );
}

export function PhotoField({ value, onChange, setMsg }) {
  const ref = useRef(null);
  const pick = async (e) => {
    const file = e.target.files?.[0]; e.target.value = '';
    if (!file) return;
    try { onChange(await passportPhoto(file)); } catch (err) { setMsg(err.message || 'Could not use this picture'); }
  };
  return (
    <div className="photo-field">
      <div className="photo-box" onClick={() => ref.current?.click()} role="button" tabIndex={0} onKeyDown={(e) => e.key === 'Enter' && ref.current?.click()}>
        {value ? <img src={value} alt="Passport size photo" /> : <span>Passport<br />size<br />photo</span>}
      </div>
      <input ref={ref} type="file" accept="image/*" hidden onChange={pick} />
      <div className="photo-actions">
        <button type="button" className="btn-secondary" onClick={() => ref.current?.click()}>{value ? 'Change photo' : 'Upload photo'}</button>
        {value ? <button type="button" className="btn-link" onClick={() => onChange('')}>Remove</button> : null}
      </div>
    </div>
  );
}

export function CertUpload({ value, onChange, setMsg }) {
  const ref = useRef(null);
  const [busy, setBusy] = useState(false);
  const pick = async (e) => {
    const file = e.target.files?.[0]; e.target.value = '';
    if (!file) return;
    setBusy(true);
    try { onChange(await readCertificate(file)); } catch (err) { setMsg(err.message || 'Could not read this file'); } finally { setBusy(false); }
  };
  const isImg = value && value.type !== 'application/pdf';
  return (
    <div className="field field-wide">
      <span className="field-label">Certificate upload (picture or PDF)</span>
      <div className="cert-row">
        {value ? (
          <div className="cert-chip">
            {isImg ? <img src={value.data} alt="" /> : <span className="cert-pdf">PDF</span>}
            <span className="cert-name" title={value.name}>{value.name}</span>
            <button type="button" className="btn-link" onClick={() => onChange(null)}>Remove</button>
          </div>
        ) : <span className="field-hint">No file chosen yet</span>}
        <button type="button" className="btn-secondary" disabled={busy} onClick={() => ref.current?.click()}>{busy ? 'Reading…' : value ? 'Replace file' : 'Upload certificate'}</button>
        <input ref={ref} type="file" accept="image/*,application/pdf" hidden onChange={pick} />
      </div>
    </div>
  );
}

// A list of repeatable entries (publications, workshops ...). `fields` describes the inputs of one entry.
export function RowList({ rows, fields, onAdd, onDel, onChange, addLabel = 'Add another entry', itemName = 'Entry', setMsg, showExp }) {
  return (
    <div className="rows">
      {rows.map((row, i) => {
        const exp = showExp ? experience(row.from, row.to) : null;
        return (
          <div className="row-card" key={row.id}>
            <div className="row-head">
              <strong>{itemName} {i + 1}</strong>
              {showExp && row.from ? <span className="exp-badge">Experience: {expText(exp)}{!row.to ? ' (till date)' : ''}</span> : null}
              {(rows.length > 1 || isFilled(row)) ? <button type="button" className="btn-del" onClick={() => onDel(row.id)} aria-label={`Remove ${itemName} ${i + 1}`}>Remove</button> : null}
            </div>
            <div className="grid">
              {fields.map((f) => {
                if (f.type === 'cert') return <CertUpload key={f.k} value={row[f.k]} onChange={(v) => onChange(row.id, f.k, v)} setMsg={setMsg} />;
                if (f.type === 'select') return <SelectField key={f.k} label={f.label} value={row[f.k]} options={f.options} wide={f.wide} onChange={(v) => onChange(row.id, f.k, v)} />;
                if (f.type === 'flexdate') return <TextField key={f.k} label={f.label} value={fmtDate(row[f.k])} placeholder="DD/MM/YYYY or just the year" inputMode="text" onChange={(v) => onChange(row.id, f.k, v)} />;
                if (f.type === 'area') return <AreaField key={f.k} label={f.label} rows={2} value={row[f.k]} onChange={(v) => onChange(row.id, f.k, v)} />;
                return <TextField key={f.k} label={f.label} type={f.type || 'text'} value={row[f.k]} wide={f.wide} hint={f.hint} placeholder={f.placeholder} inputMode={f.inputMode} onChange={(v) => onChange(row.id, f.k, v)} />;
              })}
            </div>
          </div>
        );
      })}
      <button type="button" className="btn-add" onClick={onAdd}>+ {addLabel}</button>
    </div>
  );
}
