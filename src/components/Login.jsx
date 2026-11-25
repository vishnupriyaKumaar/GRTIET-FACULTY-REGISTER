import React, { useEffect, useState } from 'react';
import PasswordInput from './PasswordInput.jsx';
import { login } from '../auth.js';
import { api } from '../api.js';
import InstallApp from './InstallApp.jsx';

// Shown after the intro.  Step 1: choose Teacher access (no password, Add Teacher only) or Admin login (password, full access).
export default function Login({ onSuccess }) {
  const [step, setStep] = useState('choose');          // 'choose' | 'admin'
  const [pw, setPw] = useState('');
  const [err, setErr] = useState('');
  const [busy, setBusy] = useState(false);

  const [conf, setConf] = useState(null);            // null = checking, true/false
  useEffect(() => { api('ping').then((r) => setConf(!!r.configured)).catch(() => setConf(false)); }, []);
  const enter = async (role) => {
    setBusy(true); setErr('');
    try { onSuccess(await login(role)); } catch (e) { setErr(e.message || 'Could not log in.'); } finally { setBusy(false); }
  };
  const submit = async (e) => {
    e.preventDefault();
    if (!pw) { setErr('Please enter the password.'); return; }
    setBusy(true); setErr('');
    try { onSuccess(await login('admin', pw)); } catch (x) { setErr(x.message || 'Incorrect password.'); setPw(''); }
    setBusy(false);
  };

  const head = (
    <>
      <img className="login-logo" src="/logo-full.png" alt="GRT Institute of Engineering and Technology" />
      <h1 className="login-title">Faculty Records Register</h1>
    </>
  );

  if (step === 'choose') {
    return (
      <div className="login-card">
        {head}
        <p className="login-sub">Choose how you want to open the register</p>
        {conf === false ? <div className="notice bad">The online database is not connected yet, so the register cannot open. The owner must finish the one-time setup in <strong>SETUP-DATABASE.md</strong>.</div> : null}
        {err ? <div className="login-err" role="alert">{err}</div> : null}
        <button type="button" className="role-btn teacher" disabled={busy} onClick={() => enter('teacher')}>
          <span className="role-ic" aria-hidden="true">👩‍🏫</span>
          <span><strong>Teacher Access</strong><small>No password · Add Teacher section only</small></span>
        </button>
        <button type="button" className="role-btn admin" onClick={() => { setStep('admin'); setErr(''); }}>
          <span className="role-ic" aria-hidden="true">🔒</span>
          <span><strong>Admin Login</strong><small>Password required · Full access</small></span>
        </button>
        <div className="install-row">
          <InstallApp variant="primary" />
          <small>Works on Android, iPhone / iPad, Windows, Mac and Linux</small>
        </div>
      </div>
    );
  }

  return (
    <form className="login-card" onSubmit={submit}>
      {head}
      <button type="button" className="login-back" onClick={() => { setStep('choose'); setPw(''); setErr(''); }}>← Back</button>
      <p className="login-sub">Enter the Admin password to open full access</p>
      <label className="login-label" htmlFor="login-pw">PASSWORD</label>
      <PasswordInput id="login-pw" value={pw} onChange={(v) => { setPw(v); setErr(''); }} autoFocus />
      <div className="login-err" role="alert">{err}</div>
      <button type="submit" className="login-btn" disabled={busy}>
        <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><rect x="3" y="11" width="18" height="11" rx="2" /><path d="M7 11V7a5 5 0 0 1 10 0v4" /></svg>
        {busy ? 'Checking…' : 'Login as Admin'}
      </button>
    </form>
  );
}
