// Database adapters.  Production = Supabase (Postgres) through its REST API.  Local test = a JSON file.
//   staff(id, data jsonb, updated)          one row per teacher
//   records(key, term, staff_id, enc, z, updated)   one row per teacher per semester (z = gzip, base64, <= 50 KB)
//   files(id, idx, total, chunk)            NPTEL certificates, cut into pieces
//   settings(k, v jsonb)                    password hash, token secret
import fs from 'node:fs';
import path from 'node:path';

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
  return {
    kind: 'supabase',
    async getSetting(k) { const r = await call('GET', `/settings?k=eq.${q(k)}&select=v`); return r[0]?.v ?? null; },
    async setSetting(k, v) { await upsert('settings', [{ k, v }], 'k'); },
    async listStaff() { return (await call('GET', '/staff?select=id,data,updated')).map((r) => ({ ...r.data, id: r.id })); },
    async putStaff(row) { await upsert('staff', [{ id: row.id, data: row, updated: row.updated || Date.now() }], 'id'); },
    async listRecordMeta() { return (await call('GET', '/records?select=key,term,staff_id,updated')).map((r) => ({ key: r.key, term: r.term, staffId: r.staff_id, updated: Number(r.updated) })); },
    async getRecords(keys) {
      if (!keys.length) return [];
      const out = [];
      for (let i = 0; i < keys.length; i += 40) {
        const part = keys.slice(i, i + 40).map((k) => `"${k.replace(/"/g, '')}"`).join(',');
        const rows = await call('GET', `/records?key=in.(${q(part)})&select=key,term,staff_id,enc,z,updated`);
        rows.forEach((r) => out.push({ key: r.key, term: r.term, staffId: r.staff_id, enc: r.enc, z: r.z, updated: Number(r.updated) }));
      }
      return out;
    },
    async getRecordsOfStaff(id) {
      const rows = await call('GET', `/records?staff_id=eq.${q(id)}&select=key,term,staff_id,enc,z,updated`);
      return rows.map((r) => ({ key: r.key, term: r.term, staffId: r.staff_id, enc: r.enc, z: r.z, updated: Number(r.updated) }));
    },
    async putRecord(r) { await upsert('records', [{ key: r.key, term: r.term, staff_id: r.staffId, enc: r.enc, z: r.z, updated: r.updated }], 'key'); },
    async putFileChunk(c) { await upsert('files', [{ id: c.id, idx: c.idx, total: c.total, chunk: c.chunk }], 'id,idx'); },
    async getFileChunk(id, idx) { const r = await call('GET', `/files?id=eq.${q(id)}&idx=eq.${idx}&select=idx,total,chunk`); return r[0] || null; },
    async fileIds() { return [...new Set((await call('GET', '/files?select=id&idx=eq.0')).map((r) => r.id))]; },
    async deleteFiles(ids) { for (const id of ids) await call('DELETE', `/files?id=eq.${q(id)}`); },
    async deleteStaff(id) { await call('DELETE', `/records?staff_id=eq.${q(id)}`); await call('DELETE', `/staff?id=eq.${q(id)}`); },
    async clearAll() { await call('DELETE', '/records?key=neq.'); await call('DELETE', '/staff?id=neq.'); await call('DELETE', '/files?id=neq.'); },
  };
}

export function makeFileDb(file) {
  const load = () => { try { return JSON.parse(fs.readFileSync(file, 'utf8')); } catch { return { settings: {}, staff: {}, records: {}, files: {} }; } };
  const save = (d) => { fs.mkdirSync(path.dirname(file), { recursive: true }); fs.writeFileSync(file + '.tmp', JSON.stringify(d)); fs.renameSync(file + '.tmp', file); };
  const tx = (fn) => { const d = load(); const r = fn(d); save(d); return r; };
  return {
    kind: 'file',
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
    async deleteStaff(id) { tx((d) => { delete d.staff[id]; Object.keys(d.records).forEach((k) => { if (d.records[k].staffId === id) delete d.records[k]; }); }); },
    async clearAll() { tx((d) => { d.staff = {}; d.records = {}; d.files = {}; }); },
  };
}

let cached;
export function getDb(env = process.env) {
  if (cached) return cached;
  if (env.SUPABASE_URL && (env.SUPABASE_SERVICE_ROLE_KEY || env.SUPABASE_KEY)) cached = makeSupabase(env.SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY || env.SUPABASE_KEY);
  else if (env.LOCAL_DB_FILE) cached = makeFileDb(env.LOCAL_DB_FILE);
  return cached || null;
}
export const resetDb = () => { cached = null; };
