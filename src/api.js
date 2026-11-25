// Talks to the server (/api/app).  Every teacher and record lives in the shared online database,
// so the same data shows on every phone, tablet and computer.
const TOKEN = 'grt_token';
export const getToken = () => { try { return sessionStorage.getItem(TOKEN) || ''; } catch { return ''; } };
export const setToken = (t) => { try { t ? sessionStorage.setItem(TOKEN, t) : sessionStorage.removeItem(TOKEN); } catch { /* ignore */ } };

export class ApiError extends Error { constructor(msg, code) { super(msg); this.code = code; } }

export async function api(action, body = {}) {
  let r;
  try {
    r = await fetch('/api/app', { method: 'POST', headers: { 'Content-Type': 'application/json', ...(getToken() ? { Authorization: 'Bearer ' + getToken() } : {}) }, body: JSON.stringify({ action, ...body }), cache: 'no-store' });
  } catch { throw new ApiError('No internet connection - the server could not be reached.', 'OFFLINE'); }
  let j = null; try { j = await r.json(); } catch { /* not json */ }
  if (!r.ok) {
    const e = j?.error || '';
    if (r.status === 401 && e === 'SESSION') { setToken(''); window.dispatchEvent(new Event('grt-session-ended')); throw new ApiError('Your session ended. Please log in again.', 'SESSION'); }
    if (r.status === 503 || e === 'NOT_CONFIGURED') throw new ApiError('The online database is not connected yet. See SETUP-DATABASE.md.', 'NOT_CONFIGURED');
    if (r.status === 404 && !j) throw new ApiError('The server part of the app was not found. Run it with "npm run dev" or deploy it on Vercel.', 'NOT_CONFIGURED');
    throw new ApiError(e || `Server error (${r.status}).`, 'SERVER');
  }
  return j || {};
}
