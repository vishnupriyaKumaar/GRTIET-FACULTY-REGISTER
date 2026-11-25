// Shared helpers: dates, experience calculation, formatting. No browser-only APIs,
// so the export code can also be tested in Node (npm run test:export).

export const pad = (n) => String(n).padStart(2, '0');

export function parseISO(s) {
  if (!s || !/^\d{4}-\d{2}-\d{2}$/.test(s)) return null;
  const [y, m, d] = s.split('-').map(Number);
  const dt = new Date(Date.UTC(y, m - 1, d));
  return dt.getUTCFullYear() === y && dt.getUTCMonth() === m - 1 && dt.getUTCDate() === d ? { y, m, d } : null;
}

// 2024-06-01 -> 01/06/2024
export function fmtDate(s) {
  const p = parseISO(s);
  if (p) return `${pad(p.d)}/${pad(p.m)}/${p.y}`;
  return typeof s === 'string' ? s.trim() : '';          // publication / conference dates may be just a year, e.g. 2024
}

const daysInMonth = (y, m) => new Date(Date.UTC(y, m, 0)).getUTCDate(); // m is 1-12

export function todayISO() {
  const n = new Date();
  return `${n.getFullYear()}-${pad(n.getMonth() + 1)}-${pad(n.getDate())}`;
}

// Age in completed years on a given day (default: today)
export function ageFromDOB(dob, onISO = todayISO()) {
  const a = parseISO(dob), b = parseISO(onISO);
  if (!a || !b) return null;
  let age = b.y - a.y;
  if (b.m < a.m || (b.m === a.m && b.d < a.d)) age--;
  return age >= 0 ? age : null;
}

// Experience between joining and relieving, BOTH days counted
// (01/06/2018 -> 31/05/2020 = 2 years 0 months 0 days).
// A blank relieving date means "till date" (today).
export function experience(fromISO, toISO) {
  const a = parseISO(fromISO);
  if (!a) return null;
  let b = parseISO(toISO || todayISO());
  if (!b) return null;
  // add one day to the end date (inclusive counting)
  let { y, m, d } = b;
  d += 1;
  if (d > daysInMonth(y, m)) { d = 1; m += 1; if (m > 12) { m = 1; y += 1; } }
  let Y = y - a.y, M = m - a.m, D = d - a.d;
  if (D < 0) { M -= 1; const pm = m === 1 ? 12 : m - 1, py = m === 1 ? y - 1 : y; D += daysInMonth(py, pm); }
  if (M < 0) { Y -= 1; M += 12; }
  if (Y < 0) return null;
  return { y: Y, m: M, d: D };
}

export function sumExperience(list) {
  let y = 0, m = 0, d = 0, any = false;
  for (const e of list) { if (!e) continue; any = true; y += e.y; m += e.m; d += e.d; }
  if (!any) return null;
  m += Math.floor(d / 30); d %= 30;
  y += Math.floor(m / 12); m %= 12;
  return { y, m, d };
}

export const expRows = (rows) => rows.map((r) => experience(r.from, r.to));
export const expText = (e) => (e ? `${e.y} yr ${e.m} mo ${e.d} d` : '');

// Rows that have at least one filled field (ignoring helper keys)
export const isFilled = (row, ignore = ['id']) => Object.entries(row).some(([k, v]) => !ignore.includes(k) && v && (typeof v !== 'object' || v.data || v.fid));
export const filled = (rows) => rows.filter((r) => isFilled(r));

// Duration in days between two ISO dates (inclusive)
export function durationDays(fromISO, toISO) {
  const a = parseISO(fromISO), b = parseISO(toISO || fromISO);
  if (!a || !b) return '';
  const t = (x) => Date.UTC(x.y, x.m - 1, x.d);
  const n = Math.round((t(b) - t(a)) / 86400000) + 1;
  return n > 0 ? String(n) : '';
}

export const uid = () => Math.random().toString(36).slice(2, 10) + Date.now().toString(36).slice(-4);

// jsPDF's built-in fonts only know Latin-1; replace anything else so the PDF never shows garbage.
export function pdfSafe(s) {
  return String(s ?? '')
    .replace(/[\u2018\u2019]/g, "'").replace(/[\u201C\u201D]/g, '"')
    .replace(/\u20B9/g, 'Rs.')
    .replace(/[^\u0009\u000A\u0020-\u007E\u00A0-\u00FF\u2013\u2014]/g, '?');
}
