import React, { useEffect, useRef, useState } from 'react';
import { exportAll, importAll, clearAll } from '../storage.js';
import { kb } from '../pack.js';
import InstallApp from './InstallApp.jsx';

const Sec = ({ title, children, open }) => (
  <details className="acc" open={open}><summary>{title}</summary><div className="acc-body">{children}</div></details>
);

// The gear icon: everything about the app - how to use it, how to run it in VS Code, backup, source code.
export default function SettingsModal({ onClose, onChanged, setMsg, counts }) {
  const ref = useRef(null);
  const [busy, setBusy] = useState(false);
  const [usage, setUsage] = useState('');
  useEffect(() => { navigator.storage?.estimate?.().then((e) => e?.usage != null && setUsage(`${(e.usage / 1048576).toFixed(2)} MB`)).catch(() => {}); }, [counts.records]);

  const backup = async () => {
    const data = await exportAll();
    const url = URL.createObjectURL(new Blob([JSON.stringify(data)], { type: 'application/json' }));
    const a = document.createElement('a'); a.href = url; a.download = `GRT_Faculty_Register_Backup_${new Date().toISOString().slice(0, 10)}.json`;
    document.body.appendChild(a); a.click(); a.remove(); setTimeout(() => URL.revokeObjectURL(url), 4000);
    setMsg({ ok: true, text: 'Backup file downloaded. Keep it safe - it holds every teacher and every semester.' });
  };
  const restore = async (e) => {
    const file = e.target.files?.[0]; e.target.value = '';
    if (!file) return;
    setBusy(true);
    try { const r = await importAll(JSON.parse(await file.text())); await onChanged(); setMsg({ ok: true, text: `Restored ${r.staff} teachers and ${r.records} semester records.` }); onClose(); }
    catch (err) { setMsg({ ok: false, text: err.message || 'Could not read this backup file.' }); }
    finally { setBusy(false); }
  };
  const wipe = async () => {
    if (!window.confirm('Delete ALL teachers and ALL semesters from the online database for EVERY device? Download a backup first. This cannot be undone.')) return;
    await clearAll(); await onChanged(); setMsg({ ok: true, text: 'All data deleted.' }); onClose();
  };

  return (
    <div className="modal-back" onClick={onClose}>
      <div className="modal-card detail settings" onClick={(e) => e.stopPropagation()} role="dialog" aria-modal="true" aria-label="Settings and guide">
        <div className="modal-head"><h3>⚙ Settings &amp; Guide</h3><button type="button" className="modal-x" onClick={onClose} aria-label="Close">&times;</button></div>
        <div className="modal-body">
          <Sec title="1. About the App" open>
            <p><strong>Faculty Records Register</strong> - GRT Institute of Engineering and Technology, Department of Computer Science and Engineering.</p>
            <p>It keeps the <em>Individual Faculty Data Sheet (Annexure – II)</em> of every teacher, semester by semester, and prints it as PDF, Word or Excel with the college logo header, the academic year and the semester.</p>
            <ul>
              <li><strong>Add Teacher</strong> – new teacher, or fetch an existing teacher's data automatically for a new semester.</li>
              <li><strong>Search</strong> – all teachers of a semester in one table; click a row for everything about the teacher.</li>
              <li><strong>Update</strong> – edit any detail, relieve, delete or download.</li>
              <li><strong>Relieved</strong> – teachers who left; their data stops in the semester of relieving.</li>
            </ul>
            <p className="muted-left">Made by Team OTC · Batch 2024-2028 · Stored: {counts.staff} teachers, {counts.records} semester records{usage ? ` · browser storage used ${usage}` : ''}.</p>
          </Sec>

          <Sec title="2. How to Use (quick start)">
            <ol>
              <li>Open the app: <strong>Teacher Access</strong> (no password – Add Teacher only) or <strong>Admin Login</strong> (password – full access).</li>
              <li>Choose the <strong>Academic Year</strong> (2001-2002 … 2099-2100) and semester in the yellow bar. For any other year press <strong>✎ Edit year</strong> and type it (e.g. 2033 or 2100).</li>
              <li>Open <strong>Add Teacher</strong>, type the name, fill the sheet and press <strong>Save</strong>.</li>
              <li>Next semester: change the yellow bar to the new semester, type the teacher's name, pick it from the list – all data appears automatically. Edit what changed and press <strong>Save</strong>.</li>
              <li>If a teacher leaves: <strong>Update → pick the teacher → Relieve</strong>. Later semesters will not show that teacher.</li>
              <li>Download one teacher's sheet from <strong>Search → click the row</strong> (or from Update). Download the whole semester with <strong>Download Excel</strong> at the top (it includes every teacher's profile photo).</li>
              <li>Take a <strong>backup</strong> (below) now and then.</li>
              <li>Open the same web link on any phone or computer - everything is shared and updates live.</li>
            </ol>
          </Sec>

          <Sec title="3. User Guide (every tab)">
            <h5>Add Teacher</h5>
            <p><strong>📎 Upload File</strong> (right of the name box): upload a faculty profile / CV as Word, PDF, Excel, text or a clear picture and the details are filled into the right places - check them, then press Save. Scanned pictures need internet for reading and may need more corrections. Sections now include Professional Body Membership, Awards and Recognitions, Ph.D. Scholars Guided and Administrative / Institutional Responsibilities. The name box shows matching teachers as you type. A new name opens a blank sheet (photo, personal details, Anna University / AICTE / APPAR IDs, qualification, experience, publications, conferences, workshops, FDP, NPTEL, patents). <strong>Save</strong> stores it for the selected semester.</p>
            <h5>Search</h5>
            <p>Type a name, designation, mobile, e-mail, ID, publication title or NPTEL course. Use the <em>All / Active / Relieved</em> filter. Click a row to see the full record and download PDF, Word or Excel.</p>
            <h5>Update</h5>
            <p>Pick a teacher (search box or the cards). Change anything and press <strong>Save Changes</strong>. <strong>Relieve</strong> asks for the relieving date. <strong>Delete teacher</strong> removes the teacher from every semester.</p>
            <h5>Relieved</h5>
            <p>Lists teachers who left, with date and reason. <strong>Reinstate</strong> brings them back if it was a mistake.</p>
            <h5>NPTEL certificates</h5>
            <p>Upload a picture (it is compressed automatically) or a PDF up to <strong>5 MB</strong>. Certificates are stored separately, so a teacher's own record always stays within <strong>50 KB</strong> (compressed).</p>
            <h5>Passport photo</h5>
            <p>Shrunk automatically to keep the record small. If a record is still too big, the app reduces the photo further.</p>
            <h5>Teacher Access and Admin Login</h5>
            <p><strong>Teacher Access</strong> opens only <em>Add Teacher</em>: a teacher types the full name (e.g. <em>Dr. Kamal. N.</em>), fills or checks the sheet and presses Save. Teachers cannot see the Search, Update or Relieved tabs, other teachers' names, backups or settings. <strong>Admin Login</strong> asks for the password and opens everything.</p>
            <h5>Academic Year</h5>
            <p>The list covers 2001 to 2099. To add a year outside it, press <strong>✎ Edit year</strong>, type the starting year and press OK.</p>
            <h5>Password</h5>
            <p>Use <strong>Change Password</strong> at the top. <strong>Logout</strong> locks the app again. If the password is forgotten, the owner can reset it by deleting the row <code>pwhash</code> in the Supabase table <code>settings</code> - the password becomes <code>grtcse@1234</code> again.</p>
          </Sec>

          <Sec title="4. How to Run in VS Code">
            <ol>
              <li>Install <strong>Node.js 18 or newer</strong> from nodejs.org and <strong>VS Code</strong> from code.visualstudio.com.</li>
              <li>Download the source ZIP (section 6 below) and <strong>unzip</strong> it.</li>
              <li>VS Code → <strong>File → Open Folder…</strong> → choose the <code>grt-faculty-data-sheet</code> folder.</li>
              <li>Open the terminal: <strong>Terminal → New Terminal</strong>.</li>
              <li>Run <code>npm install</code> (only the first time, needs internet).</li>
              <li>Run <code>npm run dev</code>, then open <code>http://localhost:5173</code> in Chrome. (This starts the app <em>and</em> a small local test database stored in <code>.data/db.json</code>.)</li>
              <li>Edit files inside <code>src/</code> – the page refreshes by itself.</li>
              <li>Windows shortcut: double-click <code>RUN.bat</code>. Mac / Linux: <code>bash RUN.sh</code>.</li>
            </ol>
            <p><strong>Where things are:</strong> <code>src/App.jsx</code> (page &amp; tabs) · <code>src/components/</code> (forms, tabs, login, settings) · <code>src/export/</code> (PDF / Word / Excel) · <code>src/index.css</code> (colours &amp; look – change the colours at the top) · <code>src/auth.js</code> (default password) · <code>public/</code> (logos, background).</p>
            <p><strong>Put it online for all devices (Vercel + Supabase, both free):</strong> follow <code>SETUP-DATABASE.md</code> in the project folder - create the free Supabase database, run <code>SETUP-DATABASE.sql</code>, add 2 settings in Vercel, deploy.</p>
          </Sec>

          <Sec title="5. Data &amp; Backup">
            <p className="muted-left">Records live in the shared <em>online database</em>, so the same teachers appear on every phone, tablet and computer within a few seconds (see the green <strong>● Live</strong> badge at the top). A backup file is still a good safety copy - and <em>Restore</em> puts it back for everyone.</p>
            <div className="btn-col">
              <button type="button" className="btn-secondary wide" onClick={backup}>⬇ Download backup (all teachers, all semesters)</button>
              <button type="button" className="btn-secondary wide" disabled={busy} onClick={() => ref.current?.click()}>{busy ? 'Restoring…' : '⬆ Restore from a backup file'}</button>
              <input ref={ref} type="file" accept="application/json,.json" hidden onChange={restore} />
              <button type="button" className="btn-del wide" onClick={wipe}>Delete ALL data (every device)</button>
            </div>
          </Sec>

          <Sec title="6. Install the App (phone / computer)">
            <p className="muted-left">Install it like a normal app - Android, iPhone / iPad, Windows, Mac, Linux and Chromebook. It also opens without internet after the first visit.</p>
            <div className="btn-col"><InstallApp setMsg={setMsg} className="wide" /></div>
            <p className="muted-left">If the button shows steps instead of installing directly: iPhone / iPad → <strong>Share → Add to Home Screen</strong>; Mac Safari → <strong>File → Add to Dock</strong>.</p>
          </Sec>

          <Sec title="7. Source Code (ZIP for future changes)" open>
            <p className="muted-left">Download the full project to modify the app later (open it in VS Code as described in section 4).</p>
            <a className="btn-primary link-btn" href="/downloads/grt-faculty-register-source.zip" download>⬇ Download Source Code ZIP</a>
          </Sec>
        </div>
      </div>
    </div>
  );
}
