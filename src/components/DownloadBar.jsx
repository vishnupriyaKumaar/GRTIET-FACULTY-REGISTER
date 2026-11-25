import React, { useState } from 'react';
import { download } from '../export/index.js';
import { hydrate } from '../storage.js';

const BTNS = [
  { kind: 'pdf', label: 'PDF', icon: 'PDF' },
  { kind: 'docx', label: 'Word', icon: 'DOC' },
  { kind: 'xlsx', label: 'Excel', icon: 'XLS' },
];

// Downloads ONE teacher's Annexure - II data sheet (PDF / Word / Excel).
export default function DownloadBar({ form, term, setMsg, compact }) {
  const [busy, setBusy] = useState('');
  const go = async (kind) => {
    setBusy(kind); setMsg('');
    try { await download(kind, await hydrate(form), term); setMsg({ ok: true, text: `${kind.toUpperCase()} file downloaded.` }); }
    catch (e) { console.error(e); setMsg({ ok: false, text: `Could not create the ${kind.toUpperCase()} file. ${e?.message || ''}` }); }
    finally { setBusy(''); }
  };
  return (
    <div className={'dl-grid' + (compact ? ' compact' : '')}>
      {BTNS.map((b) => (
        <button key={b.kind} type="button" className={'dl-btn dl-' + b.kind} disabled={!!busy} onClick={() => go(b.kind)}>
          <span className="dl-icon">{b.icon}</span>
          <span>{busy === b.kind ? 'Preparing…' : `Download ${b.label}`}</span>
        </button>
      ))}
    </div>
  );
}
