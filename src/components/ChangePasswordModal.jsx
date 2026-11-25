import React, { useState } from 'react';
import PasswordInput from './PasswordInput.jsx';
import { changePassword } from '../auth.js';

export default function ChangePasswordModal({ onClose, setMsg }) {
  const [cur, setCur] = useState(''), [nw, setNw] = useState(''), [again, setAgain] = useState('');
  const [err, setErr] = useState(''), [busy, setBusy] = useState(false);
  const submit = async (e) => {
    e.preventDefault(); setErr('');
    if (nw !== again) { setErr('The two new passwords are not the same.'); return; }
    setBusy(true);
    try { await changePassword(cur, nw); setMsg({ ok: true, text: 'Password changed. Use the new password next time you open the app.' }); onClose(); }
    catch (x) { setErr(x.message || 'Could not change the password.'); } finally { setBusy(false); }
  };
  return (
    <div className="modal-back" onClick={onClose}>
      <form className="modal-card" onClick={(e) => e.stopPropagation()} onSubmit={submit} role="dialog" aria-modal="true" aria-label="Change password">
        <div className="modal-head"><h3>Change Password</h3><button type="button" className="modal-x" onClick={onClose} aria-label="Close">&times;</button></div>
        <div className="pw-fields">
          <label className="field"><span className="field-label">Current password</span><PasswordInput value={cur} onChange={setCur} autoFocus /></label>
          <label className="field"><span className="field-label">New password (at least 6 characters)</span><PasswordInput value={nw} onChange={setNw} autoComplete="new-password" /></label>
          <label className="field"><span className="field-label">Confirm new password</span><PasswordInput value={again} onChange={setAgain} autoComplete="new-password" /></label>
        </div>
        {err ? <div className="notice bad">{err}</div> : null}
        <div className="modal-actions">
          <button type="button" className="btn-secondary" onClick={onClose}>Cancel</button>
          <button type="submit" className="btn-primary" disabled={busy || !cur || !nw}>{busy ? 'Saving…' : 'Change Password'}</button>
        </div>
      </form>
    </div>
  );
}
