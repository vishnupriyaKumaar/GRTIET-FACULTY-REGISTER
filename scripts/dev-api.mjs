// Local API for "npm run dev" and the tests: same code as the Vercel function, data kept in .data/db.json
import http from 'node:http';
import path from 'node:path';
process.env.LOCAL_DB_FILE ||= process.env.LOCAL_DB_FILE || path.resolve('.data/db.json');
const { handle } = await import('../api/_lib/core.js');
const port = Number(process.env.API_PORT || 3001);
http.createServer(async (req, res) => {
  if (req.url.split('?')[0] !== '/api/app' || req.method !== 'POST') { res.writeHead(404); res.end(); return; }
  const chunks = []; for await (const c of req) chunks.push(c);
  let body = {}; try { body = JSON.parse(Buffer.concat(chunks).toString() || '{}'); } catch { /* ignore */ }
  const { status, json } = await handle(body, req.headers.authorization);
  res.writeHead(status, { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' }); res.end(JSON.stringify(json));
}).listen(port, () => console.log(`Local API on http://localhost:${port}  (data: ${process.env.LOCAL_DB_FILE})`));
