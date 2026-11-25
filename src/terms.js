// Academic term helpers.  A term looks like  "2026-2027 (Odd Semester)".
// Odd semester = first half of the year (Jun - Dec), Even semester = second half (Jan - May of the next calendar year).
export const SEMESTERS = ['Odd Semester', 'Even Semester'];

export const makeTerm = (startYear, sem) => `${startYear}-${Number(startYear) + 1} (${sem})`;
export const yearLabel = (startYear) => `${startYear}-${Number(startYear) + 1}`;

export function parseTerm(term) {
  const m = /^(\d{4})-(\d{4}) \((Odd|Even) Semester\)$/.exec(term || '');
  if (!m) return null;
  return { year: Number(m[1]), sem: m[3] === 'Odd' ? 'Odd Semester' : 'Even Semester' };
}

// Sortable number: later term = bigger number.
export function termOrder(term) {
  const p = parseTerm(term);
  if (!p) return -1;
  return p.year * 2 + (p.sem === 'Odd Semester' ? 0 : 1);
}

export function currentTerm(now = new Date()) {
  const y = now.getFullYear(), mo = now.getMonth() + 1;      // 1-12
  if (mo >= 6) return makeTerm(y, 'Odd Semester');             // Jun - Dec
  return makeTerm(y - 1, 'Even Semester');                     // Jan - May
}

// Academic years offered in the list: 2001-2002 ... 2099-2100 (any other year can be typed with the Edit button)
export const YEAR_MIN = 2001, YEAR_MAX = 2099;
export function yearOptions(extra) {
  const out = [];
  for (let y = YEAR_MIN; y <= YEAR_MAX; y++) out.push(y);
  if (extra && !out.includes(extra)) { out.push(extra); out.sort((a, b) => a - b); }
  return out;
}
export const validStartYear = (v) => /^\d{4}$/.test(String(v)) && Number(v) >= 1990 && Number(v) <= 2199;
