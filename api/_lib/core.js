// All server rules in one place.  handle(body, authHeader, env) -> { status, json }
import crypto from 'node:crypto';
import { getDb } from './db.js';
import { hashPassword, verifyPassword, signToken, readToken } from './auth.js';

const MAX_Z = 90000;            // base64 chars of one compressed record (50 KB of bytes = ~68,300 chars)
const MAX_CHUNK = 800_000;
const PAGE = 30;                // records sent per pull
const nameKey = (s) => String(s || '').trim().replace(/\s+/g, ' ').toLowerCase();
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const bad = (status, error) => ({ status, json: { error } });
const ok = (json = {}) => ({ status: 200, json });

async function secretOf(db, env) {
  if (env.AUTH_SECRET) return env.AUTH_SECRET;
  let s = await db.getSetting('secret');
  if (!s) { s = crypto.randomBytes(32).toString('hex'); await db.setSetting('secret', s); }
  return s;
}
const cleanStaff = (s) => ({ ...s, id: String(s.id), name: String(s.name || '').trim().slice(0, 200) });

export async function handle(body, authHeader, env = process.env) {
  const db = getDb(env);
  const action = body?.action;
  if (action === 'ping') return ok({ ok: true, configured: !!db, store: db?.kind || null });
  if (!db) return bad(503, 'NOT_CONFIGURED');
  try {
    const secret = await secretOf(db, env);

    if (action === 'login') {
      if (body.role === 'teacher') return ok({ token: signToken('teacher', secret), role: 'teacher' });
      if (body.role === 'admin') {
        const stored = await db.getSetting('pwhash');
        if (!verifyPassword(String(body.password || ''), stored)) { await sleep(600); return bad(401, 'Incorrect password.'); }
        return ok({ token: signToken('admin', secret), role: 'admin' });
      }
      return bad(400, 'Unknown role.');
    }

    const tok = readToken((authHeader || '').replace(/^Bearer\s+/i, ''), secret);
    if (!tok) return bad(401, 'SESSION');
    const admin = tok.role === 'admin';
    const needAdmin = () => (admin ? null : bad(403, 'This needs the Admin login.'));

    switch (action) {
      case 'changePassword': {
        const d = needAdmin(); if (d) return d;
        if (!verifyPassword(String(body.current || ''), await db.getSetting('pwhash'))) { await sleep(600); return bad(400, 'Current password is wrong.'); }
        const next = String(body.next || '');
        if (next.length < 6) return bad(400, 'New password must have at least 6 characters.');
        await db.setSetting('pwhash', hashPassword(next));
        return ok();
      }
      case 'pull': {
        const d = needAdmin(); if (d) return d;
        const version = await db.getVersion();
        if (body.version && body.version === version) return ok({ same: true, version });   // nothing changed: 1 cheap read
        const have = body.have || {};
        const [staff, meta] = await Promise.all([db.listStaff(), db.listRecordMeta()]);
        const need = meta.filter((m) => !have[m.key] || have[m.key] !== m.updated).map((m) => m.key);
        const send = await db.getRecords(need.slice(0, PAGE));
        return ok({ version, staff, manifest: meta.map((m) => [m.key, m.updated]), records: send, more: need.length > PAGE });
      }
      case 'deleteRecord': {                       // NEW: used when a record is moved to another academic year / semester
        const d = needAdmin(); if (d) return d;
        await db.deleteRecord(String(body.key)); return ok();
      }
      case 'lookup': {
        const q = nameKey(body.name); if (!q) return ok({ staff: null, records: [] });
        const s = (await db.listStaff()).find((x) => nameKey(x.name) === q);
        return ok({ staff: s || null, records: s ? await db.getRecordsOfStaff(s.id) : [] });
      }
      case 'putStaff': {
        const row = cleanStaff(body.staff || {});
        if (!row.name) return bad(400, 'Name is required.');
        if (!admin) {
          const old = (await db.listStaff()).find((x) => x.id === row.id);
          if (old && old.status === 'relieved') return bad(403, 'This teacher has been relieved. Ask the Admin to reinstate.');
          const keep = old ? { ...old, name: row.name, updated: Date.now() } : { id: row.id, name: row.name, status: 'active', created: Date.now(), updated: Date.now() };
          await db.putStaff(keep); return ok();
        }
        await db.putStaff(row); return ok();
      }
      case 'putRecord': {
        const r = body.record || {};
        if (!r.key || !r.staffId || !r.term || typeof r.z !== 'string') return bad(400, 'Bad record.');
        if (r.z.length > MAX_Z) return bad(413, 'This teacher\'s details are larger than 50 KB after compression.');
        if (!admin) {
          const old = (await db.listStaff()).find((x) => x.id === r.staffId);
          if (old && old.status === 'relieved') return bad(403, 'This teacher has been relieved. Ask the Admin to reinstate.');
        }
        await db.putRecord({ key: String(r.key), term: String(r.term), staffId: String(r.staffId), enc: r.enc === 'raw' ? 'raw' : 'gz', z: r.z, updated: Number(r.updated) || Date.now() });
        return ok();
      }
      case 'putFile': {
        const c = body.chunk || {};
        if (!c.id || typeof c.chunk !== 'string' || c.chunk.length > MAX_CHUNK) return bad(400, 'Bad file piece.');
        await db.putFileChunk({ id: String(c.id), idx: Number(c.idx) || 0, total: Number(c.total) || 1, chunk: c.chunk });
        return ok();
      }
      case 'getFile': {
        const c = await db.getFileChunk(String(body.id), Number(body.idx) || 0);
        return c ? ok(c) : bad(404, 'File not found.');
      }
      case 'deleteStaff': {
        const d = needAdmin(); if (d) return d;
        const recs = await db.getRecordsOfStaff(String(body.id));
        const fids = [];
        for (const r of recs) {
          try { const raw = Buffer.from(r.z, 'base64'); const { gunzipSync } = await import('node:zlib'); const form = JSON.parse((r.enc === 'gz' ? gunzipSync(raw) : raw).toString()); (form.nptel || []).forEach((n) => n.file?.fid && fids.push(n.file.fid)); } catch { /* ignore */ }
        }
        await db.deleteStaff(String(body.id));
        if (fids.length) await db.deleteFiles(fids);
        return ok();
      }
      case 'clearAll': { const d = needAdmin(); if (d) return d; await db.clearAll(); return ok(); }
      case 'fileIds': { const d = needAdmin(); if (d) return d; return ok({ ids: await db.fileIds() }); }
      default: return bad(400, 'Unknown action.');
    }
  } catch (e) {
    console.error('api error', e);
    return bad(500, 'The database could not be reached. ' + (e.message || ''));
  }
}