// Database adapters.  Production = Firebase Firestore (key kept only in Vercel environment variables).
// Local test (npm run dev) = a JSON file.
//   staff(id, data, updated)                       one document per teacher
//   records(key, term, staffId, enc, z, updated)   one per teacher per semester (z = gzip, base64, <= 50 KB)
//   files(id_idx: id, idx, total, chunk)           NPTEL certificates, cut into pieces
//   settings(k, v)                                 password hash, token secret, change counter
// "version" is a counter that every write changes.  Other devices ask for it first (1 read), and only
// download data when it changed - this keeps the free Firebase read quota safe.
import fs from 'node:fs';
import path from 'node:path';

export function makeFileDb(file) {
  const load = () => { try { return JSON.parse(fs.readFileSync(file, 'utf8')); } catch { return { settings: {}, staff: {}, records: {}, files: {} }; } };
  const save = (d) => { fs.mkdirSync(path.dirname(file), { recursive: true }); fs.writeFileSync(file + '.tmp', JSON.stringify(d)); fs.renameSync(file + '.tmp', file); };
  const tx = (fn) => { const d = load(); const r = fn(d); d.settings.version = Date.now() + Math.random(); save(d); return r; };
  return {
    kind: 'file',
    async getVersion() { return load().settings.version ?? 0; },
    async getSetting(k) { return load().settings[k] ?? null; },
    async setSetting(k, v) { tx((d) => { d.settings[k] = v; }); },
    async listStaff() { return Object.values(load().staff); },
    async putStaff(row) { tx((d) => { d.staff[row.id] = row; }); },
    async listRecordMeta() { return Object.values(load().records).map(({ key, term, staffId, updated }) => ({ key, term, staffId, updated })); },
    async getRecords(keys) { const d = load(); return keys.map((k) => d.records[k]).filter(Boolean); },
    async getRecordsOfStaff(id) { return Object.values(load().records).filter((r) => r.staffId === id); },
    async putRecord(r) { tx((d) => { d.records[r.key] = r; }); },
    async putFileChunk(c) { tx((d) => { (d.files[c.id] ||= {})[c.idx] = { idx: c.idx, total: c.total, chunk: c.chunk }; }); },
    async getFileChunk(id, idx) { return load().files[id]?.[idx] || null; },
    async fileIds() { return Object.keys(load().files); },
    async deleteFiles(ids) { tx((d) => { ids.forEach((i) => { delete d.files[i]; }); }); },
    async deleteRecord(key) { tx((d) => { delete d.records[key]; }); },
    async deleteStaff(id) { tx((d) => { delete d.staff[id]; Object.keys(d.records).forEach((k) => { if (d.records[k].staffId === id) delete d.records[k]; }); }); },
    async clearAll() { tx((d) => { d.staff = {}; d.records = {}; d.files = {}; }); },
  };
}

// ---- Firebase (Firestore) -----------------------------------------------------------------------------------------------
// collections: staff/{id}  records/{key}  files/{id_idx}  settings/{k}      (one Firestore document <= 1 MiB: records <= 50 KB, file pieces <= 0.8 MB)
export function makeFirestore(getFs) {
  const col = async (n) => (await getFs()).collection(n);
  const doc = async (n, id) => (await col(n)).doc(String(id));
  const all = async (n) => (await (await col(n)).get()).docs.map((d) => d.data());
  const rec = (d) => ({ key: d.key, term: d.term, staffId: d.staffId, enc: d.enc, z: d.z, updated: Number(d.updated) });
  const bump = async () => { await (await doc('settings', 'version')).set({ v: Date.now() + Math.random() }); };
  const wipe = async (n) => { const c = await col(n); const snap = await c.get(); for (const d of snap.docs) await d.ref.delete(); };
  return {
    kind: 'firebase',
    async getVersion() { const d = await (await doc('settings', 'version')).get(); return d.exists ? d.data().v : 0; },
    async getSetting(k) { const d = await (await doc('settings', k)).get(); return d.exists ? d.data().v ?? null : null; },
    async setSetting(k, v) { await (await doc('settings', k)).set({ v }); },
    async listStaff() { return (await all('staff')).map((d) => d.data); },
    async putStaff(row) { await (await doc('staff', row.id)).set({ data: row, updated: row.updated || Date.now() }); await bump(); },
    async listRecordMeta() { return (await (await (await col('records')).select('key', 'term', 'staffId', 'updated')).get()).docs.map((x) => x.data()).map((d) => ({ key: d.key, term: d.term, staffId: d.staffId, updated: Number(d.updated) })); },
    async getRecords(keys) { const out = []; for (const k of keys) { const d = await (await doc('records', k)).get(); if (d.exists) out.push(rec(d.data())); } return out; },
    async getRecordsOfStaff(id) { return (await (await (await col('records')).where('staffId', '==', String(id))).get()).docs.map((d) => rec(d.data())); },
    async putRecord(r) { await (await doc('records', r.key)).set({ key: r.key, term: r.term, staffId: r.staffId, enc: r.enc, z: r.z, updated: r.updated }); await bump(); },
    async putFileChunk(c) { await (await doc('files', `${c.id}_${c.idx}`)).set({ id: c.id, idx: c.idx, total: c.total, chunk: c.chunk }); },
    async getFileChunk(id, idx) { const d = await (await doc('files', `${id}_${idx}`)).get(); return d.exists ? { idx: d.data().idx, total: d.data().total, chunk: d.data().chunk } : null; },
    async fileIds() { return (await (await (await col('files')).select('id', 'idx')).get()).docs.map((x) => x.data()).filter((d) => d.idx === 0).map((d) => d.id); },
    async deleteFiles(ids) { for (const id of ids) { const snap = await (await (await col('files')).where('id', '==', id)).get(); for (const d of snap.docs) await d.ref.delete(); } },
    async deleteStaff(id) {
      const snap = await (await (await col('records')).where('staffId', '==', String(id))).get();
      for (const d of snap.docs) await d.ref.delete();
      await (await doc('staff', id)).delete();
      await bump();
    },
    async deleteRecord(key) { await (await doc('records', key)).delete(); await bump(); },
    async clearAll() { await wipe('records'); await wipe('staff'); await wipe('files'); await bump(); },
  };
}

async function realFirestore(env) {
  const mod = await import('firebase-admin/app'); const fsm = await import('firebase-admin/firestore');
  let raw = env.FIREBASE_SERVICE_ACCOUNT.trim();
  if (!raw.startsWith('{')) raw = Buffer.from(raw, 'base64').toString('utf8');
  const sa = JSON.parse(raw); if (sa.private_key) sa.private_key = sa.private_key.replace(/\\n/g, '\n');
  const app = mod.getApps().length ? mod.getApp() : mod.initializeApp({ credential: mod.cert(sa) });
  return fsm.getFirestore(app);
}

let cached;
export function getDb(env = process.env) {
  if (cached) return cached;
  if (env.FIREBASE_SERVICE_ACCOUNT) { let p; cached = makeFirestore(() => (p ||= realFirestore(env))); }
  else if (env.LOCAL_DB_FILE) cached = makeFileDb(env.LOCAL_DB_FILE);
  return cached || null;
}
export const resetDb = () => { cached = null; };
export const injectDb = (db) => { cached = db; };   // used by the tests