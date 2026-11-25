import React, { useMemo, useRef, useState } from 'react';
import NameBox from './NameBox.jsx';
import FacultyForm from './FacultyForm.jsx';
import { blankForm } from '../constants.js';
import { resolve, staffByName, nameKey } from '../roster.js';
import { isFilled, fmtDate } from '../utils.js';
import { termOrder } from '../terms.js';
import { hydrate } from '../storage.js';
import { kb } from '../pack.js';
import { readFacultyFile } from '../importer/index.js';
import { applyPatch } from '../importer/parse.js';

// Add Teacher: type the name -> if the teacher already exists, all their data is fetched automatically.
export default function AddTab({ term, staff, records, onSave, setMsg, teacherMode, onLookup }) {
  const [name, setName] = useState('');
  const [form, setForm] = useState(blankForm);
  const [match, setMatch] = useState(null);           // { staff, source, fromTerm } | { staff, blocked:true }
  const [saving, setSaving] = useState(false);
  const [busy, setBusy] = useState('');
  const [report, setReport] = useState(null);
  const fileRef = useRef(null);
  const lookTimer = useRef(null);

  const options = useMemo(() => staff.map((s) => ({
    id: s.id, name: s.name, status: s.status, relievedOn: s.relievedOn, sub: s.designation || s.department || '', raw: s,
  })), [staff]);

  const reset = () => { setName(''); setForm(blankForm()); setMatch(null); setReport(null); };

  const upload = async (e) => {
    const file = e.target.files?.[0]; e.target.value = '';
    if (!file) return;
    setReport(null); setBusy('Reading the file…');
    try {
      const res = await readFacultyFile(file, setBusy);
      if (!res.total && !res.photo) { setReport({ bad: true, text: 'No faculty details could be found in this file. Please check that it is a faculty profile / CV (Word, PDF, Excel, text or a clear picture).' }); return; }
      const found = res.patch.name || '';
      const ex = found ? staffByName(staff, found) : null;
      const base = ex && match?.staff?.id !== ex.id ? { ...blankForm(), ...(resolve(ex, records, term) ? await hydrate(resolve(ex, records, term).form) : {}) } : form;
      if (ex && match?.staff?.id !== ex.id) setMatch({ staff: ex, source: 'saved', fromTerm: term });
      const patch = { ...res.patch }; if (res.photo) patch.photo = res.photo;
      const next = applyPatch(base, patch);
      const nm = name.trim() || found;
      if (!name.trim() && found) setName(found);
      setForm({ ...next, name: nm });
      setReport({ ok: true, summary: res.summary, notes: nm ? res.notes : [...res.notes, 'The name could not be found in the file - please type the name in the box above to show the details.'], file: file.name });
    } catch (err) { setReport({ bad: true, text: err?.message || 'Could not read this file.' }); }
    finally { setBusy(''); }
  };

  const pick = async (o, recs) => {
    const s = o.raw || o;
    setName(s.name);
    const r = resolve(s, recs || records, term);
    if (!r) {
      // relieved before this semester (or no data at all)
      if (s.status === 'relieved' && s.relievedTerm && termOrder(term) > termOrder(s.relievedTerm)) { setMatch({ staff: s, blocked: true }); setForm(blankForm()); return; }
      setMatch({ staff: s, source: 'new', fromTerm: '' }); setForm({ ...blankForm(), name: s.name }); return;
    }
    setMatch({ staff: s, source: r.source, fromTerm: r.fromTerm });
    setForm({ ...(await hydrate(r.form)), name: s.name });
  };

  const onName = (v) => {
    setName(v);
    if (match && nameKey(v) !== nameKey(match.staff.name)) { setMatch(null); setForm(blankForm()); }
    if (!match) {
      const ex = staffByName(staff, v);
      if (ex && nameKey(v) === nameKey(ex.name)) pick(ex);   // typed the full name of an existing teacher
      else if (teacherMode && onLookup && v.trim().length >= 3) {                 // teacher access: ask the server for this one name
        clearTimeout(lookTimer.current);
        lookTimer.current = setTimeout(async () => {
          try { const f = await onLookup(v); if (f && nameKey(f.staff.name) === nameKey(v)) pick(f.staff, f.records); } catch { /* ignore */ }
        }, 450);
      }
    }
  };

  const save = async () => {
    if (!name.trim()) { setMsg('Please enter the name of the faculty member.'); return; }
    setSaving(true);
    try {
      const { bytes } = await onSave(match && !match.blocked ? match.staff.id : null, { ...form, name: name.trim() });
      setMsg({ ok: true, text: `${name.trim()} saved for ${term} (${kb(bytes)} KB stored).` });
      reset(); window.scrollTo({ top: 0, behavior: 'smooth' });
    } catch (e) { setMsg(e?.message || 'Could not save.'); } finally { setSaving(false); }
  };

  const showForm = name.trim() && !(match && match.blocked);
  const dirty = isFilled({ ...form, name: '' }, ['id', 'name']);

  return (
    <div>
      <h2>Add New Teacher</h2>
      <NameBox value={name} onChange={onName} onPick={pick} options={options} autoFocus noSuggest={teacherMode}
        extra={(
          <>
            <input ref={fileRef} type="file" hidden onChange={upload} accept=".pdf,.doc,.docx,.xls,.xlsx,.csv,.tsv,.txt,.rtf,.odt,.html,.htm,.json,image/*" />
            <button type="button" className="btn-upload" disabled={!!busy} onClick={() => fileRef.current?.click()} title="Upload a faculty profile / CV - the details are filled in automatically">
              {busy ? '⏳ ' + busy : '📎 Upload File'}
            </button>
          </>
        )} />
      {report?.bad ? <div className="notice bad">{report.text}</div> : null}
      {report?.ok ? (
        <div className="notice ok">
          <strong>✓ Details fetched from {report.file}.</strong> Please check everything below, then press Save.
          <ul className="import-list">{report.summary.map((s) => <li key={s.label}>{s.label}: <strong>{s.count}</strong></li>)}</ul>
          {report.notes.map((n) => <div key={n}>⚠ {n}</div>)}
        </div>
      ) : null}
      {!name.trim() ? <p className="card-note">Type your name (e.g. Dr. Kamal. N.) or press <strong>Upload File</strong> to fill everything from a Word / PDF profile. If you are already in the register, your details are fetched automatically when the full name matches; otherwise a blank sheet opens.</p> : null}

      {match?.blocked ? (
        <div className="notice bad">
          <strong>{match.staff.name} was relieved on {fmtDate(match.staff.relievedOn)} ({match.staff.relievedTerm}).</strong>
          {' '}Their data stopped in that semester and is not carried into <strong>{term}</strong>. To bring them back, open the <em>Relieved</em> tab and press Reinstate.
        </div>
      ) : null}
      {match && !match.blocked && match.source === 'saved' ? <div className="notice ok">✓ <strong>{match.staff.name}</strong> is already in the register for {term}. Their saved data is loaded - you can edit it and press Save.</div> : null}
      {match && !match.blocked && match.source === 'carried' ? <div className="notice ok">✓ Data of <strong>{match.staff.name}</strong> fetched automatically from <strong>{match.fromTerm}</strong>. Check it, change what is new, and press Save to add them to {term}.</div> : null}
      {match && !match.blocked && match.source === 'new' ? <div className="notice">{match.staff.name} is in the register but has no saved details yet.</div> : null}
      {!match && name.trim() ? <div className="notice">New teacher - fill in the details below.</div> : null}

      {showForm ? (
        <>
          <FacultyForm form={form} setForm={setForm} setMsg={setMsg} />
          <div className="form-actions">
            <button type="button" className="btn-primary" disabled={saving} onClick={save}>{saving ? 'Saving…' : 'Save'}</button>
            <button type="button" className="btn-secondary" onClick={() => { if (!dirty || window.confirm('Clear this form?')) reset(); }}>Clear</button>
          </div>
        </>
      ) : null}
    </div>
  );
}
