// Data layer.  The shared database is on the server (see api/); this file keeps a copy in memory so the screens
// stay fast, and keeps it up to date with pull() (called every few seconds = "real time").
//   staff    one row per teacher  { id, name, status:'active'|'relieved', relievedOn, relievedTerm, reason, ... }
//   records  one row per teacher PER SEMESTER { key:'<term>|<staffId>', term, staffId, form, updated }   (<= 50 KB compressed each)
//   files    NPTEL certificates, sent in pieces and kept apart so a teacher's record stays small
import { pack, unpack, RECORD_LIMIT, kb, toB64, fromB64 } from './pack.js';
import { shrinkPhoto } from './imageUtils.js';
import { uid } from './utils.js';
import { api } from './api.js';

const cache = { staff: [], records: new Map() };     // records: key -> { key, term, staffId, updated, form }
const fileCache = new Map();                          // fid -> data URL

// small per-device settings (the selected academic year)
export const getSetting = async (k) => { try { return JSON.parse(localStorage.getItem('grt_' + k)); } catch { return undefined; } };
export const setSetting = async (k, v) => { try { localStorage.setItem('grt_' + k, JSON.stringify(v)); } catch { /* ignore */ } };

export const resetCache = () => { cache.staff = []; cache.records = new Map(); fileCache.clear(); };

const fromServer = async (r) => ({ key: r.key, term: r.term, staffId: r.staffId, updated: r.updated, form: await unpack({ enc: r.enc, z: fromB64(r.z) }) });

// Admin: brings the local copy up to date.  Returns true when something changed.
export async function pull() {
  let changed = false, first = true;
  for (let guard = 0; guard < 400; guard++) {
    const have = {}; cache.records.forEach((v, k) => { have[k] = v.updated; });
    const r = await api('pull', { have });
    if (first) {
      first = false;
      const sig = (a) => JSON.stringify(a.map((s) => [s.id, s.updated, s.status]).sort());
      if (sig(r.staff) !== sig(cache.staff)) changed = true;
      cache.staff = r.staff;
      const alive = new Set(r.manifest.map((m) => m[0]));
      for (const k of [...cache.records.keys()]) if (!alive.has(k)) { cache.records.delete(k); changed = true; }
    }
    for (const rec of r.records) { cache.records.set(rec.key, await fromServer(rec)); changed = true; }
    if (!r.more) break;
  }
  return changed;
}

export const listStaff = async () => cache.staff.slice();
export const listRecords = async () => [...cache.records.values()];

// Teacher access: look one teacher up by full name (their data is fetched automatically)
export async function lookup(name) {
  const r = await api('lookup', { name });
  if (!r.staff) return null;
  return { staff: r.staff, records: await Promise.all(r.records.map(fromServer)) };
}

export async function putStaff(row) {
  await api('putStaff', { staff: row });
  const i = cache.staff.findIndex((s) => s.id === row.id);
  if (i >= 0) cache.staff[i] = row; else cache.staff.push(row);
}
export async function putRecord(row) {
  const { form, ...rest } = row;
  const p = await pack(form);
  const z = toB64(p.z);
  await api('putRecord', { record: { key: rest.key, term: rest.term, staffId: rest.staffId, enc: p.enc, z, updated: rest.updated || Date.now() } });
  cache.records.set(rest.key, { ...rest, form });
  return p.z.length;
}

const CHUNK = 1_000_000;
async function uploadFile(id, data) {
  const total = Math.max(1, Math.ceil(data.length / CHUNK));
  for (let i = 0; i < total; i++) await api('putFile', { chunk: { id, idx: i, total, chunk: data.slice(i * CHUNK, (i + 1) * CHUNK) } });
  fileCache.set(id, data);
}
async function downloadFile(id) {
  if (fileCache.has(id)) return fileCache.get(id);
  const first = await api('getFile', { id, idx: 0 });
  let data = first.chunk;
  for (let i = 1; i < first.total; i++) data += (await api('getFile', { id, idx: i })).chunk;
  fileCache.set(id, data);
  return data;
}

// Moves certificate files to their own storage and keeps the record <= 50 KB (the photo is shrunk if needed).
export async function prepareForStore(form) {
  const f = { ...form, nptel: form.nptel.map((r) => ({ ...r })) };
  for (const r of f.nptel) {
    const file = r.file;
    if (!file) continue;
    if (file.data) { const fid = file.fid || uid(); await uploadFile(fid, file.data); r.file = { name: file.name, type: file.type, fid }; }
    else if (file.fid) r.file = { name: file.name, type: file.type, fid: file.fid };
    else r.file = null;
  }
  let p = await pack(f), step = 0;
  while (p.z.length > RECORD_LIMIT && f.photo && step < 6) { f.photo = await shrinkPhoto(f.photo, step++); p = await pack(f); }
  if (p.z.length > RECORD_LIMIT) throw new Error(`This teacher's details are ${kb(p.z.length)} KB after compression - the limit is 50 KB. Please shorten some long entries.`);
  return { form: f, bytes: p.z.length };
}

// Puts the certificate pictures / PDFs back into a form (for editing or downloading)
export async function hydrate(form) {
  const nptel = await Promise.all(form.nptel.map(async (r) => {
    if (r.file && !r.file.data && r.file.fid) { try { return { ...r, file: { ...r.file, data: await downloadFile(r.file.fid) } }; } catch { return r; } }
    return r;
  }));
  return { ...form, nptel };
}

export const removeStaff = async (id) => {
  await api('deleteStaff', { id });
  cache.staff = cache.staff.filter((s) => s.id !== id);
  for (const [k, v] of [...cache.records]) if (v.staffId === id) cache.records.delete(k);
};

export async function exportAll() {
  await pull();
  const { ids } = await api('fileIds');
  const files = [];
  for (const id of ids) { try { files.push({ id, data: await downloadFile(id) }); } catch { /* skip */ } }
  return { app: 'grt-faculty-register', version: 3, exportedAt: new Date().toISOString(), staff: cache.staff, records: [...cache.records.values()], files };
}
export async function importAll(data) {
  if (!data || data.app !== 'grt-faculty-register' || !Array.isArray(data.staff) || !Array.isArray(data.records)) throw new Error('This is not a Faculty Register backup file.');
  for (const s of data.staff) await putStaff(s);
  for (const r of data.records) {
    let form = r.form;
    if (!form && r.z) form = await unpack({ enc: r.enc, z: r.z instanceof Uint8Array ? r.z : Uint8Array.from(Object.values(r.z)) });   // backup of the older version
    await putRecord({ key: r.key, term: r.term, staffId: r.staffId, updated: r.updated, form });
  }
  for (const x of data.files || []) await uploadFile(x.id, x.data);
  return { staff: data.staff.length, records: data.records.length };
}
export async function clearAll() { await api('clearAll'); resetCache(); }
