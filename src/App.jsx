import React, { useCallback, useEffect, useMemo, useState } from 'react';
import Layout from './components/Layout.jsx';
import IntroSplash from './components/IntroSplash.jsx';
import TermBar, { TermPicker } from './components/TermBar.jsx';
import AddTab from './components/AddTab.jsx';
import SearchTab from './components/SearchTab.jsx';
import UpdateTab from './components/UpdateTab.jsx';
import RelievedTab from './components/RelievedTab.jsx';
import StaffDetail from './components/StaffDetail.jsx';
import RelieveModal from './components/RelieveModal.jsx';
import SettingsModal from './components/SettingsModal.jsx';
import { normalizeForm } from './constants.js';
import { uid } from './utils.js';
import { currentTerm, parseTerm } from './terms.js';
import { roster, resolve } from './roster.js';
import { getSetting, setSetting, listStaff, listRecords, putStaff, putRecord, removeStaff, prepareForStore, pull, lookup, resetCache, removeRecord } from './storage.js';
import Login from './components/Login.jsx';
import ChangePasswordModal from './components/ChangePasswordModal.jsx';
import { getRole, setRole } from './auth.js';
import InstallApp from './components/InstallApp.jsx';

const TABS = [['add', 'Add Teacher', '+'], ['search', 'Search', '⌕'], ['update', 'Update', '✎'], ['relieved', 'Relieved', '⎋']];

const Icon = ({ c }) => <span className="tab-ic" aria-hidden="true">{c}</span>;

export default function App() {
  const [introDone, setIntroDone] = useState(false);
  const [role, setRoleState] = useState(getRole());          // '' (not logged in) | 'admin' | 'teacher'
  const authed = !!role;
  const isAdmin = role === 'admin';
  const [pwModal, setPwModal] = useState(false);
  const [ready, setReady] = useState(false);
  const [term, setTermState] = useState(currentTerm());
  const [askTerm, setAskTerm] = useState(false);
  const [staff, setStaff] = useState([]);
  const [records, setRecords] = useState([]);
  const [tab, setTabRaw] = useState('add');
  const setTab = (t) => setTabRaw(isAdmin ? t : 'add');       // a teacher can never leave Add Teacher
  const [selectedId, setSelectedId] = useState(null);
  const [view, setView] = useState(null);              // { id, term }
  const [relieveFor, setRelieveFor] = useState(null);  // staff row
  const [settings, setSettings] = useState(false);
  const [msg, setMsgRaw] = useState('');
  const [busyXlsx, setBusyXlsx] = useState(false);

  const setMsg = useCallback((m) => setMsgRaw(typeof m === 'string' ? (m ? { ok: false, text: m } : '') : m), []);
  useEffect(() => { if (msg?.ok) { const t = setTimeout(() => setMsgRaw(''), 4000); return () => clearTimeout(t); } }, [msg]);

  const roleRef = React.useRef(role); roleRef.current = role;
  const show = async () => { const [s, r] = await Promise.all([listStaff(), listRecords()]); setStaff(s); setRecords(r); };
  // Brings the shared database up to date (admin).  Teachers only ever write, they never download the register.
  const reload = useCallback(async () => {
    if (roleRef.current !== 'admin') { await show(); return; }
    await pull(); await show();
  }, []);

  useEffect(() => {
    const saved = getSetting('term');
    saved.then((v) => { if (v && parseTerm(v)) setTermState(v); else setAskTerm(true); });
  }, []);
  useEffect(() => {
    if (!role) { setReady(false); return undefined; }
    let stop = false;
    (async () => { try { await reload(); } catch (e) { setMsg(e?.message || 'Could not load the register.'); } if (!stop) setReady(true); })();
    return () => { stop = true; };
  }, [role, reload, setMsg]);
  // real time: every 5 seconds (and when the tab is opened again) fetch what other devices changed
  useEffect(() => {
    if (role !== 'admin') return undefined;
    let busy = false;
    const tick = async () => { if (busy || document.hidden) return; busy = true; try { await reload(); } catch { /* retried on the next tick */ } finally { busy = false; } };
    const iv = setInterval(tick, 5000);
    document.addEventListener('visibilitychange', tick); window.addEventListener('online', tick);
    return () => { clearInterval(iv); document.removeEventListener('visibilitychange', tick); window.removeEventListener('online', tick); };
  }, [role, reload]);
  useEffect(() => {
    const end = () => { setRoleState(''); resetCache(); setTabRaw('add'); setSelectedId(null); };
    window.addEventListener('grt-session-ended', end);
    return () => window.removeEventListener('grt-session-ended', end);
  }, []);

  const setTerm = (t) => { setTermState(t); setSetting('term', t); setSelectedId(null); };

  const items = useMemo(() => roster(staff, records, term), [staff, records, term]);
  const activeCount = items.filter((i) => i.staff.status !== 'relieved').length;
  const relievedCount = staff.filter((s) => s.status === 'relieved').length;

  // ---------- writes ----------
  // targetTerm: the academic year / semester to keep this record under (the Update tab can change it)
  const saveTeacher = async (id, form, targetTerm = term) => {
    const f = normalizeForm(form);
    const sid = id || uid();
    const old = staff.find((s) => s.id === sid);
    const { form: stored, bytes } = await prepareForStore({ ...f, name: f.name.trim() });   // certificates -> own store, record <= 50 KB
    await putStaff({ ...(old || { status: 'active', created: Date.now() }), id: sid, name: f.name.trim(), updated: Date.now() });
    await putRecord({ key: `${targetTerm}|${sid}`, term: targetTerm, staffId: sid, form: stored, updated: Date.now() });
    if (targetTerm !== term && records.some((r) => r.key === `${term}|${sid}`)) await removeRecord(`${term}|${sid}`);   // moved to another year / semester
    await reload();
    return { sid, bytes, term: targetTerm };
  };
  const relieve = async (date, reason) => {
    const s = relieveFor;
    await putStaff({ ...s, status: 'relieved', relievedOn: date, relievedTerm: term, reason, updated: Date.now() });
    // make sure the data of this semester is kept exactly as shown
    const r = resolve(s, records, term);
    if (r && r.source === 'carried') await putRecord({ key: `${term}|${s.id}`, term, staffId: s.id, form: r.form, updated: Date.now() });
    setRelieveFor(null); setView(null); await reload();
    setMsg({ ok: true, text: `${s.name} relieved. Their data stops at ${term} and will not appear in later semesters.` });
  };
  const reinstate = async (id) => {
    const s = staff.find((x) => x.id === id);
    if (!window.confirm(`Reinstate ${s.name}? They will be carried into later semesters again.`)) return;
    await putStaff({ ...s, status: 'active', relievedOn: '', relievedTerm: '', reason: '', updated: Date.now() });
    setView(null); await reload(); setMsg({ ok: true, text: `${s.name} reinstated.` });
  };
  const deleteTeacher = async (s) => {
    if (!window.confirm(`Delete ${s.name} and ALL their semester records permanently? Use “Relieve” instead if the teacher only left the college.`)) return;
    await removeStaff(s.id); setSelectedId(null); await reload(); setMsg({ ok: true, text: `${s.name} deleted.` });
  };

  const downloadExcel = async () => {
    if (!items.length) { setMsg(`There are no teachers in ${term} to download.`); return; }
    setBusyXlsx(true);
    try { await (await import('./export/exportRegister.js')).downloadRegister(items, term); setMsg({ ok: true, text: `Excel register for ${term} downloaded.` }); }
    catch (e) { console.error(e); setMsg(`Could not create the Excel file. ${e?.message || ''}`); }
    finally { setBusyXlsx(false); }
  };

  const viewItem = view ? (() => { const s = staff.find((x) => x.id === view.id); return s ? { staff: s, ...(resolve(s, records, view.term) || { form: normalizeForm({ name: s.name }), source: 'new' }) } : null; })() : null;

  const content = (
    <div className="page">
      <div className="actions">
        {isAdmin ? (
          <>
            <button type="button" className="btn-secondary" onClick={downloadExcel} disabled={busyXlsx}><span aria-hidden="true">⬇</span> {busyXlsx ? 'Preparing…' : 'Download Excel'}</button>
            <button type="button" className="btn-secondary" onClick={() => setPwModal(true)}><span aria-hidden="true">🔑</span> Change Password</button>
            <button type="button" className="btn-secondary icon" onClick={() => setSettings(true)} aria-label="Settings and guide" title="Settings, guide, backup, source code">⚙</button>
          </>
        ) : null}
        <InstallApp setMsg={setMsg} />
        <button type="button" className="btn-secondary" onClick={() => { setRole(''); resetCache(); setRoleState(''); setTabRaw('add'); setSelectedId(null); }}><span aria-hidden="true">⎋</span> Logout</button>
      </div>

      <TermBar term={term} onChange={setTerm} summary={isAdmin ? `Full access · ${activeCount} active · ${relievedCount} relieved in total` : 'Teacher access · Add Teacher only'} />

      {msg ? <div className={'toast ' + (msg.ok ? 'ok' : 'bad')} role="status">{msg.text}</div> : null}

      <nav className="tabs" role="tablist" aria-label="Sections">
        {TABS.filter(([id]) => isAdmin || id === 'add').map(([id, label, ic]) => (
          <button key={id} type="button" role="tab" aria-selected={tab === id} className={'tab' + (tab === id ? ' on' : '')} onClick={() => { setTab(id); setMsg(''); }}><Icon c={ic} /> {label}</button>
        ))}
      </nav>

      <section className="panel" role="tabpanel">
        {tab === 'add' ? <AddTab key={term} term={term} staff={staff} records={records} onSave={saveTeacher} setMsg={setMsg} teacherMode={!isAdmin} onLookup={lookup} /> : null}
        {isAdmin && tab === 'search' ? <SearchTab term={term} items={items} onView={(id) => setView({ id, term })} /> : null}
        {isAdmin && tab === 'update' ? <UpdateTab term={term} items={items} selectedId={selectedId} onSelect={setSelectedId} onSave={saveTeacher} onTerm={setTerm} records={records} onRelieve={setRelieveFor} onReinstate={reinstate} onDelete={deleteTeacher} setMsg={setMsg} /> : null}
        {isAdmin && tab === 'relieved' ? <RelievedTab staff={staff} records={records} onView={(id) => setView({ id, term: staff.find((s) => s.id === id)?.relievedTerm || term })} onReinstate={reinstate} /> : null}
      </section>
    </div>
  );

  return (
    <>
      {!introDone ? <IntroSplash onDone={() => setIntroDone(true)} /> : null}
      <Layout>{!authed ? <Login onSuccess={(r) => setRoleState(r)} /> : ready ? content : <p className="loading">Loading…</p>}</Layout>

      {isAdmin && viewItem ? (
        <StaffDetail form={viewItem.form} staff={viewItem.staff} term={view.term} source={viewItem.source} fromTerm={viewItem.fromTerm} setMsg={setMsg}
          onClose={() => setView(null)}
          onEdit={view.term === term && !viewItem.staff.relievedTerm ? () => { setSelectedId(viewItem.staff.id); setTab('update'); setView(null); window.scrollTo({ top: 0 }); } : (view.term === term ? () => { setSelectedId(viewItem.staff.id); setTab('update'); setView(null); } : null)}
          onRelieve={() => setRelieveFor(viewItem.staff)} onReinstate={() => reinstate(viewItem.staff.id)} />
      ) : null}
      {isAdmin && relieveFor ? <RelieveModal name={relieveFor.name} term={term} onCancel={() => setRelieveFor(null)} onConfirm={relieve} /> : null}
      {isAdmin && pwModal ? <ChangePasswordModal onClose={() => setPwModal(false)} setMsg={setMsg} /> : null}
      {isAdmin && settings ? <SettingsModal onClose={() => setSettings(false)} onChanged={reload} setMsg={setMsg} counts={{ staff: staff.length, records: records.length }} /> : null}
      {askTerm && ready && authed ? (
        <div className="modal-back">
          <div className="modal-card" role="dialog" aria-modal="true" aria-label="Select academic year">
            <div className="modal-head"><h3>Select the Academic Year</h3></div>
            <p className="card-note">Everything you add, search or update is recorded for this semester. You can change it any time from the yellow bar at the top.</p>
            <TermPicker term={term} onChange={setTermState} idPrefix="ask" />
            <p className="ask-term"><strong>{term}</strong></p>
            <div className="modal-actions"><button type="button" className="btn-primary" onClick={() => { setSetting('term', term); setAskTerm(false); }}>Continue</button></div>
          </div>
        </div>
      ) : null}
    </>
  );
}