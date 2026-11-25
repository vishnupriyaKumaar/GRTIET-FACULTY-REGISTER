// Tests the server rules (api/_lib/core.js) against a pretend Supabase (PostgREST) server, and the file adapter.
//   node scripts/test-api.mjs
import http from 'node:http';
import assert from 'node:assert/strict';
import { makeSupabase, makeFileDb } from '../api/_lib/db.js';
import os from 'node:os'; import path from 'node:path'; import fs from 'node:fs';

// ---- fake PostgREST --------------------------------------------------------------------------------------------
const tables = { staff: [], records: [], files: [], settings: [] };
const PK = { staff: ['id'], records: ['key'], files: ['id', 'idx'], settings: ['k'] };
const srv = http.createServer(async (req, res) => {
  const u = new URL(req.url, 'http://x'); const t = u.pathname.replace('/rest/v1/', '');
  const rows = tables[t]; if (!rows) { res.writeHead(404); res.end('{}'); return; }
  const chunks = []; for await (const c of req) chunks.push(c); const body = chunks.length ? JSON.parse(Buffer.concat(chunks)) : null;
  const match = (r) => [...u.searchParams].every(([k, v]) => {
    if (['select', 'on_conflict'].includes(k)) return true;
    const m = /^(eq|neq|in)\.(.*)$/.exec(v); if (!m) return true;
    if (m[1] === 'eq') return String(r[k]) === m[2];
    if (m[1] === 'neq') return String(r[k]) !== m[2];
    const list = m[2].replace(/^\(|\)$/g, '').split(',').map((x) => x.replace(/^"|"$/g, ''));
    return list.includes(String(r[k]));
  });
  if (req.method === 'GET') { res.writeHead(200, { 'content-type': 'application/json' }); res.end(JSON.stringify(rows.filter(match))); return; }
  if (req.method === 'DELETE') { tables[t] = rows.filter((r) => !match(r)); res.writeHead(204); res.end(); return; }
  if (req.method === 'POST') {
    for (const n of body) { const i = rows.findIndex((r) => PK[t].every((k) => r[k] === n[k])); if (i >= 0) rows[i] = { ...rows[i], ...n }; else rows.push(n); }
    res.writeHead(201); res.end(); return;
  }
  res.writeHead(405); res.end();
});
await new Promise((r) => srv.listen(0, r));
const url = `http://localhost:${srv.address().port}`;
process.env.SUPABASE_URL = url; process.env.SUPABASE_SERVICE_ROLE_KEY = 'k';

// ---- scenario ---------------------------------------------------------------------------------------------------------
async function scenario(label, env) {
  const { handle } = await import('../api/_lib/core.js');
  const { resetDb } = await import('../api/_lib/db.js'); resetDb();
  const call = async (action, body = {}, token) => handle({ action, ...body }, token ? 'Bearer ' + token : '', env);
  assert.equal((await call('ping')).json.configured, true);
  assert.equal((await call('login', { role: 'admin', password: 'wrong' })).status, 401);
  const admin = (await call('login', { role: 'admin', password: 'grtcse@1234' })).json.token;
  const teacher = (await call('login', { role: 'teacher' })).json.token;
  assert.ok(admin && teacher);
  assert.equal((await call('pull', {}, undefined)).status, 401, 'no token');
  assert.equal((await call('pull', {}, admin.slice(0, -3) + 'abc')).status, 401, 'forged token');
  assert.equal((await call('pull', {}, teacher)).status, 403, 'teacher cannot read the register');
  // teacher adds a teacher + record
  const z = Buffer.from('hello').toString('base64');
  assert.equal((await call('putStaff', { staff: { id: 't1', name: 'Dr. Kamal. N.' } }, teacher)).status, 200);
  assert.equal((await call('putRecord', { record: { key: '2026-2027 (Odd Semester)|t1', term: '2026-2027 (Odd Semester)', staffId: 't1', enc: 'raw', z, updated: 5 } }, teacher)).status, 200);
  assert.equal((await call('putRecord', { record: { key: 'x|t1', term: 'x', staffId: 't1', enc: 'gz', z: 'A'.repeat(100000), updated: 1 } }, teacher)).status, 413, 'size cap');
  // teacher can find that name, but not list
  const lk = (await call('lookup', { name: '  dr.  kamal. n. ' }, teacher)).json;
  assert.equal(lk.staff.id, 't1'); assert.equal(lk.records.length, 1);
  // admin pull + incremental
  let p = (await call('pull', { have: {} }, admin)).json;
  assert.equal(p.staff.length, 1); assert.equal(p.records.length, 1); assert.equal(p.manifest.length, 1);
  p = (await call('pull', { have: { '2026-2027 (Odd Semester)|t1': 5 } }, admin)).json;
  assert.equal(p.records.length, 0, 'nothing changed');
  // admin relieves; teacher can no longer save for them and cannot change status
  await call('putStaff', { staff: { id: 't1', name: 'Dr. Kamal. N.', status: 'relieved', relievedTerm: '2026-2027 (Odd Semester)', updated: 9 } }, admin);
  assert.equal((await call('putRecord', { record: { key: '2027-2028 (Odd Semester)|t1', term: '2027-2028 (Odd Semester)', staffId: 't1', enc: 'raw', z, updated: 6 } }, teacher)).status, 403);
  assert.equal((await call('putStaff', { staff: { id: 't1', name: 'Dr. Kamal. N.' } }, teacher)).status, 403);
  // files in pieces
  await call('putFile', { chunk: { id: 'f1', idx: 0, total: 2, chunk: 'AAA' } }, teacher);
  await call('putFile', { chunk: { id: 'f1', idx: 1, total: 2, chunk: 'BBB' } }, teacher);
  const g = (await call('getFile', { id: 'f1', idx: 1 }, admin)).json; assert.equal(g.chunk, 'BBB'); assert.equal(g.total, 2);
  assert.deepEqual((await call('fileIds', {}, admin)).json.ids, ['f1']);
  // password change
  assert.equal((await call('changePassword', { current: 'nope', next: 'abcdef' }, admin)).status, 400);
  assert.equal((await call('changePassword', { current: 'grtcse@1234', next: 'abc' }, admin)).status, 400);
  assert.equal((await call('changePassword', { current: 'grtcse@1234', next: 'newpass1' }, teacher)).status, 403);
  assert.equal((await call('changePassword', { current: 'grtcse@1234', next: 'newpass1' }, admin)).status, 200);
  assert.equal((await call('login', { role: 'admin', password: 'grtcse@1234' })).status, 401);
  assert.equal((await call('login', { role: 'admin', password: 'newpass1' })).status, 200);
  // delete
  assert.equal((await call('deleteStaff', { id: 't1' }, teacher)).status, 403);
  await call('deleteStaff', { id: 't1' }, admin);
  p = (await call('pull', { have: {} }, admin)).json; assert.equal(p.staff.length, 0); assert.equal(p.manifest.length, 0);
  await call('clearAll', {}, admin);
  console.log('PASS', label);
}
await scenario('Supabase adapter (fake PostgREST)', process.env);

const f = path.join(fs.mkdtempSync(path.join(os.tmpdir(), 'grt-')), 'db.json');
const env2 = { LOCAL_DB_FILE: f };
await scenario('file adapter', env2);
srv.close();
