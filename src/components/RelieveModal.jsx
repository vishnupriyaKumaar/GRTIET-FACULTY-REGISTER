import React, { useState } from 'react';
import { todayISO, fmtDate } from '../utils.js';

export default function RelieveModal({ name, term, onCancel, onConfirm }) {
  const [date, setDate] = useState(todayISO());
  const [reason, setReason] = useState('');
  return (
    <div className="modal-back" onClick={onCancel}>
      <div className="modal-card" onClick={(e) => e.stopPropagation()} role="dialog" aria-modal="true" aria-label="Relieve teacher">
        <div className="modal-head"><h3>Relieve {name}</h3><button type="button" className="modal-x" onClick={onCancel} aria-label="Close">&times;</button></div>
        <p className="card-note">Use this when the teacher has left the college. Their data stays as it is in <strong>{term}</strong> and every earlier semester, but it is <strong>not carried into any later semester</strong>.</p>
        <div className="grid">
          <label className="field"><span className="field-label">Relieving date</span><input type="date" value={date} onChange={(e) => setDate(e.target.value)} /></label>
          <label className="field"><span className="field-label">Reason (optional)</span><input value={reason} onChange={(e) => setReason(e.target.value)} placeholder="e.g. Resigned, Retired, Transferred" /></label>
        </div>
        <div className="modal-actions">
          <button type="button" className="btn-secondary" onClick={onCancel}>Cancel</button>
          <button type="button" className="btn-danger" disabled={!date} onClick={() => onConfirm(date, reason.trim())}>Relieve on {fmtDate(date) || '…'}</button>
        </div>
      </div>
    </div>
  );
}
