// Database adapters.  Production = Supabase OR Firebase Firestore (keys kept only in Vercel environment variables;
// Supabase is used when SUPABASE_URL is set, otherwise Firebase when FIREBASE_SERVICE_ACCOUNT is set).
// Local test (npm run dev) = a JSON file.
//   staff(id, data, updated)                       one document per teacher
//   records(key, term, staffId, enc, z, updated)   one per teacher per semester (z = gzip, base64, <= 50 KB)
//   files(id_idx: id, idx, total, chunk)           NPTEL certificates, cut into pieces
//   settings(k, v)                                 password hash, token secret, change counter
// "version" is a counter that every write changes.  Other devices ask for it first (1 read), and only
// download data when it changed - this keeps the free database quota safe.
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

// ---- Supabase (Postgres, through its REST API) ---------------------------------------------------------------------------
//   tables: staff(id, data, updated)  records(key, term, staff_id, enc, z, updated)  files(id, idx, total, chunk)  settings(k, v)
export function makeSupabase(url, key, fetchImpl = fetch) {
  const base = url.replace(/\/+$/, '') + '/rest/v1';
  const H = { apikey: key, Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' };
  const call = async (method, p, body, extra = {}) => {
    const r = await fetchImpl(base + p, { method, headers: { ...H, ...extra }, body: body === undefined ? undefined : JSON.stringify(body) });
    const t = await r.text();
    if (!r.ok) { const e = new Error(`Database error ${r.status}: ${t.slice(0, 200)}`); e.status = r.status; throw e; }
    return t ? JSON.parse(t) : null;
  };
  const q = (s) => encodeURIComponent(s);
  const upsert = (table, rows, conflict) => call('POST', `/${table}?on_conflict=${conflict}`, rows, { Prefer: 'resolution=merge-duplicates,return=minimal' });
  const bump = () => upsert('settings', [{ k: 'version', v: Date.now() + Math.random() }], 'k');
  const recOf = (r) => ({ key: r.key, term: r.term, staffId: r.staff_id, enc: r.enc, z: r.z, updated: Number(r.updated) });
  return {
    kind: 'supabase',
    async getVersion() { const r = await call('GET', '/settings?k=eq.version&select=v'); return r[0]?.v ?? 0; },
    async getSetting(k) { const r = await call('GET', `/settings?k=eq.${q(k)}&select=v`); return r[0]?.v ?? null; },
    async setSetting(k, v) { await upsert('settings', [{ k, v }], 'k'); },
    async listStaff() { return (await call('GET', '/staff?select=id,data,updated')).map((r) => ({ ...r.data, id: r.id })); },
    async putStaff(row) { await upsert('staff', [{ id: row.id, data: row, updated: row.updated || Date.now() }], 'id'); await bump(); },
    async listRecordMeta() { return (await call('GET', '/records?select=key,term,staff_id,updated')).map((r) => ({ key: r.key, term: r.term, staffId: r.staff_id, updated: Number(r.updated) })); },
    async getRecords(keys) {
      const out = [];
      for (let i = 0; i < keys.length; i += 40) {
        const part = keys.slice(i, i + 40).map((k) => `"${k.replace(/"/g, '')}"`).join(',');
        (await call('GET', `/records?key=in.(${q(part)})&select=key,term,staff_id,enc,z,updated`)).forEach((r) => out.push(recOf(r)));
      }
      return out;
    },
    async getRecordsOfStaff(id) { return (await call('GET', `/records?staff_id=eq.${q(id)}&select=key,term,staff_id,enc,z,updated`)).map(recOf); },
    async putRecord(r) { await upsert('records', [{ key: r.key, term: r.term, staff_id: r.staffId, enc: r.enc, z: r.z, updated: r.updated }], 'key'); await bump(); },
    async putFileChunk(c) { await upsert('files', [{ id: c.id, idx: c.idx, total: c.total, chunk: c.chunk }], 'id,idx'); },
    async getFileChunk(id, idx) { const r = await call('GET', `/files?id=eq.${q(id)}&idx=eq.${idx}&select=idx,total,chunk`); return r[0] || null; },
    async fileIds() { return [...new Set((await call('GET', '/files?select=id&idx=eq.0')).map((r) => r.id))]; },
    async deleteFiles(ids) { for (const id of ids) await call('DELETE', `/files?id=eq.${q(id)}`); },
    async deleteRecord(key) { await call('DELETE', `/records?key=eq.${q(key)}`); await bump(); },
    async deleteStaff(id) { await call('DELETE', `/records?staff_id=eq.${q(id)}`); await call('DELETE', `/staff?id=eq.${q(id)}`); await bump(); },
    async clearAll() { await call('DELETE', '/records?key=neq.'); await call('DELETE', '/staff?id=neq.'); await call('DELETE', '/files?id=neq.'); await bump(); },
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
  const sk = env.SUPABASE_SERVICE_ROLE_KEY || env.SUPABASE_KEY;
  if (env.SUPABASE_URL && sk) cached = makeSupabase(env.SUPABASE_URL, sk);                       // Supabase (if its keys are set in Vercel)
  else if (env.FIREBASE_SERVICE_ACCOUNT) { let p; cached = makeFirestore(() => (p ||= realFirestore(env))); }
  else if (env.LOCAL_DB_FILE) cached = makeFileDb(env.LOCAL_DB_FILE);
  return cached || null;
}
export const resetDb = () => { cached = null; };
export const injectDb = (db) => { cached = db; };   // used by the tests