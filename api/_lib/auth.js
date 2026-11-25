// Password hashing (scrypt) and signed tokens (HMAC).  No dependencies - Node built-ins only.
import crypto from 'node:crypto';

export const DEFAULT_PASSWORD = 'grtcse@1234';
const b64u = (b) => Buffer.from(b).toString('base64url');

export function hashPassword(pw, salt = crypto.randomBytes(16).toString('hex')) {
  return `scrypt:${salt}:${crypto.scryptSync(pw, salt, 32).toString('hex')}`;
}
export function verifyPassword(pw, stored) {
  if (!stored) return pw === DEFAULT_PASSWORD;
  const [, salt, hex] = String(stored).split(':');
  const a = Buffer.from(crypto.scryptSync(pw, salt, 32).toString('hex')), b = Buffer.from(hex || '');
  return a.length === b.length && crypto.timingSafeEqual(a, b);
}
export function signToken(role, secret, ttlMs = 12 * 3600e3) {
  const body = b64u(JSON.stringify({ role, exp: Date.now() + ttlMs }));
  return body + '.' + crypto.createHmac('sha256', secret).update(body).digest('base64url');
}
export function readToken(token, secret) {
  const [body, sig] = String(token || '').split('.');
  if (!body || !sig) return null;
  const good = crypto.createHmac('sha256', secret).update(body).digest('base64url');
  if (sig.length !== good.length || !crypto.timingSafeEqual(Buffer.from(sig), Buffer.from(good))) return null;
  try { const p = JSON.parse(Buffer.from(body, 'base64url').toString()); return p.exp > Date.now() ? p : null; } catch { return null; }
}
