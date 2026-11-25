import React, { useState } from 'react';
import { usePwaInstall, detectPlatform } from '../pwa.js';

const ShareIcon = () => (
  <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" style={{ verticalAlign: '-3px' }}>
    <path d="M12 3v12" /><path d="M8 7l4-4 4 4" /><path d="M5 12v7a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2v-7" />
  </svg>
);

// Steps for each kind of device.  `me` is highlighted first.
const GUIDES = [
  { id: 'ios', icon: '', title: 'iPhone / iPad (iOS)', steps: [
    <>Open this page in <strong>Safari</strong> (Chrome / Edge on iPhone also work from iOS 16.4).</>,
    <>Tap the <strong>Share</strong> button <ShareIcon /> (bottom bar, or top-right on iPad).</>,
    <>Scroll and tap <strong>Add to Home Screen</strong>, then tap <strong>Add</strong>.</>,
    <>Open <strong>Faculty Sheet</strong> from the Home Screen like any other app.</>,
  ] },
  { id: 'android', icon: '🤖', title: 'Android phone / tablet', steps: [
    <>Open this page in <strong>Chrome</strong> (Edge, Samsung Internet, Brave, Firefox also work).</>,
    <>Tap the <strong>Install App</strong> button on this page - or the <strong>⋮ menu → Install app / Add to Home screen</strong>.</>,
    <>Tap <strong>Install</strong>. The app icon appears in your app list and Home screen.</>,
  ] },
  { id: 'windows', icon: '🪟', title: 'Windows computer', steps: [
    <>Open this page in <strong>Chrome</strong> or <strong>Microsoft Edge</strong>.</>,
    <>Click the <strong>Install App</strong> button on this page - or the <strong>install icon ⊕</strong> at the right end of the address bar - or <strong>⋮ / … menu → Apps → Install this site as an app</strong>.</>,
    <>Click <strong>Install</strong>. It opens in its own window and appears in the Start menu / desktop.</>,
  ] },
  { id: 'mac', icon: '🍎', title: 'Mac', steps: [
    <><strong>Chrome / Edge:</strong> click <strong>Install App</strong> here (or the install icon in the address bar).</>,
    <><strong>Safari 17+:</strong> menu <strong>File → Add to Dock…</strong> → <strong>Add</strong>.</>,
  ] },
  { id: 'linux', icon: '🐧', title: 'Linux / Chromebook', steps: [
    <>Open this page in <strong>Chrome, Chromium, Brave or Edge</strong> (Firefox on Linux cannot install web apps).</>,
    <>Click <strong>Install App</strong> here - or the <strong>install icon</strong> in the address bar - or <strong>⋮ menu → Install … / Cast, save and share → Install page as app</strong>.</>,
    <>Click <strong>Install</strong>. The app appears in your applications menu.</>,
  ] },
];
const guideFor = (os) => GUIDES.find((g) => g.id === (os === 'chromeos' ? 'linux' : os)) || GUIDES[2];

function InstallHelp({ onClose, info }) {
  const first = guideFor(info.os);
  const rest = GUIDES.filter((g) => g.id !== first.id);
  return (
    <div className="modal-back" onClick={onClose}>
      <div className="modal-card install-card" onClick={(e) => e.stopPropagation()} role="dialog" aria-modal="true" aria-label="Install the app">
        <div className="modal-head"><h3>⬇ Install the Faculty Register app</h3><button type="button" className="modal-x" onClick={onClose} aria-label="Close">&times;</button></div>
        <div className="modal-body install-body">
          {info.inApp ? <p className="install-warn">You are inside another app's browser (WhatsApp, Instagram, …). Open this link in <strong>Chrome</strong> or <strong>Safari</strong> first, then install.</p> : null}
          <p className="card-note">Installing gives you an app icon, a full-screen window and it keeps working without internet. It uses almost no space.</p>
          <div className="install-guide me">
            <h4><span aria-hidden="true">{first.icon}</span> {first.title} <em>(this device)</em></h4>
            <ol>{first.steps.map((s, i) => <li key={i}>{s}</li>)}</ol>
          </div>
          <details className="install-more">
            <summary>Steps for other devices</summary>
            {rest.map((g) => (
              <div className="install-guide" key={g.id}>
                <h4><span aria-hidden="true">{g.icon}</span> {g.title}</h4>
                <ol>{g.steps.map((s, i) => <li key={i}>{s}</li>)}</ol>
              </div>
            ))}
          </details>
          <p className="muted-left install-foot">Already installed? Open it from your Start menu, app list or Home Screen. Your saved teachers stay on each device — use <strong>⚙ → Data &amp; Backup</strong> to move them to another one.</p>
        </div>
        <div className="modal-actions"><button type="button" className="btn-primary" onClick={onClose}>OK</button></div>
      </div>
    </div>
  );
}

// One button for every device.  Hidden once the app is running as an installed app.
//   variant 'secondary' (top action bar) | 'primary' (login page, big)
export default function InstallApp({ variant = 'secondary', className = '', setMsg }) {
  const { canInstall, install, installed } = usePwaInstall();
  const [help, setHelp] = useState(false);
  if (installed) return null;
  const info = detectPlatform();
  const go = async () => {
    if (canInstall) {
      const ok = await install();
      if (ok) setMsg?.({ ok: true, text: 'App installed. You can open it from your Home Screen / Start menu.' });
    } else setHelp(true);
  };
  return (
    <>
      <button type="button" className={(variant === 'primary' ? 'install-btn ' : 'btn-secondary ') + className} onClick={go} title="Install this app on your phone or computer">
        <span aria-hidden="true">⬇</span> Install App
      </button>
      {help ? <InstallHelp info={info} onClose={() => setHelp(false)} /> : null}
    </>
  );
}
