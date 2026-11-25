import React, { useEffect, useMemo, useState } from 'react';
import NameBox from './NameBox.jsx';
import FacultyForm from './FacultyForm.jsx';
import DownloadBar from './DownloadBar.jsx';
import { fmtDate } from '../utils.js';
import { nameKey } from '../roster.js';
import { hydrate } from '../storage.js';
import { kb } from '../pack.js';

// Update: pick a teacher of the selected semester, edit every detail, save, relieve or download.
export default function UpdateTab({ term, items, selectedId, onSelect, onSave, onRelieve, onReinstate, onDelete, setMsg }) {
  const [q, setQ] = useState('');
  const cur = items.find((i) => i.staff.id === selectedId) || null;
  const [form, setForm] = useState(null);
  const [saving, setSaving] = useState(false);

  // load the chosen teacher's data into the editor
  useEffect(() => { let on = true; setForm(null); if (cur) hydrate(cur.form).then((f) => on && setForm({ ...f, name: cur.staff.name })); return () => { on = false; }; }, [selectedId, term, cur?.source, cur?.fromTerm]);   // eslint-disable-line

  const options = useMemo(() => items.map((i) => ({ id: i.staff.id, name: i.staff.name, status: i.staff.status, relievedOn: i.staff.relievedOn, sub: i.form.designation || i.form.department || '', raw: i })), [items]);
  const shown = items.filter((i) => !q.trim() || nameKey(i.staff.name).includes(nameKey(q)) || nameKey(i.form.department).includes(nameKey(q)));

  const save = async () => {
    if (!form.name.trim()) { setMsg('The name cannot be empty.'); return; }
    setSaving(true);
    try { const { bytes } = await onSave(cur.staff.id, { ...form, name: form.name.trim() }); setMsg({ ok: true, text: `Updated ${form.name.trim()} for ${term} (${kb(bytes)} KB stored).` }); }
    catch (e) { setMsg(e?.message || 'Could not save.'); } finally { setSaving(false); }
  };

  return (
    <div>
      <h2>Update Teacher</h2>
      <NameBox label="Search Faculty Name" value={q} onChange={setQ} options={options} placeholder="Type a name, then pick it"
        onPick={(o) => { onSelect(o.id); setQ(''); window.scrollTo({ top: 0 }); }} />

      {!cur ? (
        <>
          <p className="card-note">Pick a teacher below (or search by name) to edit every detail for <strong>{term}</strong>.</p>
          {items.length === 0 ? <div className="notice">No teachers in {term} yet. Add one in the <em>Add Teacher</em> tab.</div> : (
            <div className="pick-grid">
              {shown.map((i) => (
                <button type="button" key={i.staff.id} className="pick-card" onClick={() => onSelect(i.staff.id)}>
                  <strong>{i.staff.name}</strong>
                  <span>{i.form.designation || '—'} · {i.form.department || '—'}</span>
                  <em className={i.staff.status === 'relieved' ? 'st bad' : i.source === 'carried' ? 'st note' : 'st ok'}>
                    {i.staff.status === 'relieved' ? `Relieved ${fmtDate(i.staff.relievedOn)}` : i.source === 'carried' ? `Carried from ${i.fromTerm}` : 'Saved'}
                  </em>
                </button>
              ))}
            </div>
          )}
        </>
      ) : form ? (
        <>
          <div className="edit-head">
            <TextName value={form.name} onChange={(v) => setForm((f) => ({ ...f, name: v }))} />
            <button type="button" className="btn-secondary" onClick={() => onSelect(null)}>← All teachers</button>
          </div>
          {cur.staff.status === 'relieved' ? <div className="notice bad">Relieved on <strong>{fmtDate(cur.staff.relievedOn)}</strong>{cur.staff.reason ? ` (${cur.staff.reason})` : ''}. Data stops after {cur.staff.relievedTerm}.</div> : null}
          {cur.source === 'carried' ? <div className="notice ok">Data was carried forward from <strong>{cur.fromTerm}</strong>. Press Save to keep it as the {term} record.</div> : null}
          <FacultyForm form={form} setForm={setForm} setMsg={setMsg} />
          <div className="form-actions">
            <button type="button" className="btn-primary" disabled={saving} onClick={save}>{saving ? 'Saving…' : 'Save Changes'}</button>
            {cur.staff.status === 'relieved'
              ? <button type="button" className="btn-secondary" onClick={() => onReinstate(cur.staff.id)}>Reinstate</button>
              : <button type="button" className="btn-danger" onClick={() => onRelieve(cur.staff)}>Relieve (left the college)</button>}
            <button type="button" className="btn-del" onClick={() => onDelete(cur.staff)}>Delete teacher</button>
          </div>
          <h3 className="sec-title" style={{ marginTop: 22 }}>Download this teacher's data sheet</h3>
          <DownloadBar form={form} term={term} setMsg={setMsg} />
        </>
      ) : null}
    </div>
  );
}

function TextName({ value, onChange }) {
  return (
    <div className="namebox"><label className="inline-label" htmlFor="edit-name">Name :</label>
      <div className="namebox-wrap"><input id="edit-name" value={value} onChange={(e) => onChange(e.target.value)} /></div></div>
  );
}
