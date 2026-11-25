// Reads dates written in the many ways people write them in a CV / profile.
// Everything returns ISO dates (YYYY-MM-DD) because that is what the form stores.
const MONTHS = { jan: 1, feb: 2, mar: 3, apr: 4, may: 5, jun: 6, jul: 7, aug: 8, sep: 9, sept: 9, oct: 10, nov: 11, dec: 12,
  january: 1, february: 2, march: 3, april: 4, june: 6, july: 7, august: 8, september: 9, october: 10, november: 11, december: 12 };
const p2 = (n) => String(n).padStart(2, '0');
const dim = (y, m) => new Date(Date.UTC(y, m, 0)).getUTCDate();
const iso = (y, m, d) => (y >= 1900 && y <= 2100 && m >= 1 && m <= 12 && d >= 1 && d <= dim(y, m) ? `${y}-${p2(m)}-${p2(d)}` : '');
const year4 = (s) => { const n = Number(s); return s.length === 2 ? (n < 50 ? 2000 + n : 1900 + n) : n; };
export const NOW_WORDS = /\b(till\s*date|to\s*date|present|continuing|continue|ongoing|current(ly)?|till\s*now|date)\b/i;

const MON = '(jan(?:uary)?|feb(?:ruary)?|mar(?:ch)?|apr(?:il)?|may|jun(?:e)?|jul(?:y)?|aug(?:ust)?|sep(?:t(?:ember)?)?|oct(?:ober)?|nov(?:ember)?|dec(?:ember)?)';

// One date.  edge = 'start' | 'end' decides how a month-only or year-only date is completed.
// -> { iso, approx }   (iso '' when nothing could be read)
export function parseDate(text, edge = 'start') {
  const s = String(text ?? '').replace(/(\d)(st|nd|rd|th)\b/gi, '$1').replace(/[,]/g, ' ').replace(/\s+/g, ' ').trim();
  if (!s) return { iso: '', approx: false };
  let m;
  if ((m = /\b(\d{4})-(\d{1,2})-(\d{1,2})\b/.exec(s))) return { iso: iso(+m[1], +m[2], +m[3]), approx: false };
  if ((m = /\b(\d{1,2})[./\-](\d{1,2})[./\-](\d{4}|\d{2})\b/.exec(s))) return { iso: iso(year4(m[3]), +m[2], +m[1]), approx: false };
  if ((m = new RegExp(`\\b(\\d{1,2})[ \\-]${MON}[ \\-.]*(\\d{4}|\\d{2})\\b`, 'i').exec(s))) return { iso: iso(year4(m[3]), MONTHS[m[2].toLowerCase()], +m[1]), approx: false };
  if ((m = new RegExp(`\\b${MON}[ \\-.]*(\\d{1,2})[ \\-.]+(\\d{4})\\b`, 'i').exec(s))) return { iso: iso(+m[3], MONTHS[m[1].toLowerCase()], +m[2]), approx: false };
  if ((m = new RegExp(`\\b${MON}[ \\-./]*(\\d{4})\\b`, 'i').exec(s))) { const y = +m[2], mo = MONTHS[m[1].toLowerCase()]; return { iso: iso(y, mo, edge === 'end' ? dim(y, mo) : 1), approx: true }; }
  if ((m = /\b(\d{1,2})[./\-](\d{4})\b/.exec(s))) { const y = +m[2], mo = +m[1]; return { iso: iso(y, mo, edge === 'end' ? dim(y, mo) : 1), approx: true }; }
  if ((m = /\b((?:19|20)\d{2})\b/.exec(s))) { const y = +m[1]; return { iso: edge === 'end' ? iso(y, 12, 31) : iso(y, 1, 1), approx: true }; }
  return { iso: '', approx: false };
}

// "13-18 Dec 2022", "22 - 24 Jul 2021", "29.06.2015 - Till date", "31.12.25 to 31.12.27", "20.05.2021", "04 Aug 2018"
// -> { from, to, approx, open }   open = "till date"
export function parseRange(text) {
  const s = String(text ?? '').replace(/[\u2013\u2014\u2212]/g, '-').replace(/\s+/g, ' ').trim();
  if (!s) return { from: '', to: '', approx: false, open: false };
  const open = NOW_WORDS.test(s);
  let m;
  // "13-18 Dec 2022"  /  "13 - 18 December 2022"
  if ((m = new RegExp(`^(\\d{1,2})\\s*-\\s*(\\d{1,2})\\s+${MON}[ ,.]*(\\d{4})`, 'i').exec(s))) {
    const mo = MONTHS[m[3].toLowerCase()], y = +m[4];
    return { from: iso(y, mo, +m[1]), to: iso(y, mo, +m[2]), approx: false, open: false };
  }
  // "28 Dec - 2 Jan 2023" / "28 Dec 2022 - 2 Jan 2023"
  if ((m = new RegExp(`^(\\d{1,2})\\s+${MON}\\s*(\\d{4})?\\s*(?:-|to)\\s*(\\d{1,2})\\s+${MON}[ ,.]*(\\d{4})`, 'i').exec(s))) {
    const y2 = +m[6], mo1 = MONTHS[m[2].toLowerCase()], mo2 = MONTHS[m[5].toLowerCase()];
    const y1 = m[3] ? +m[3] : (mo1 > mo2 ? y2 - 1 : y2);
    return { from: iso(y1, mo1, +m[1]), to: iso(y2, mo2, +m[4]), approx: false, open: false };
  }
  // generic "A - B" / "A to B" with full dates on both sides
  const parts = s.split(/\s+(?:-|to|till|until)\s+|\s*-\s*(?=[A-Za-z]|\d{1,2}[./])/i).map((x) => x.trim()).filter(Boolean);
  if (parts.length >= 2) {
    const a = parseDate(parts[0], 'start');
    const b = open && !/\d{4}|\d{1,2}[./]\d/.test(parts[parts.length - 1]) ? { iso: '', approx: false } : parseDate(parts[parts.length - 1], 'end');
    if (a.iso || b.iso) return { from: a.iso, to: b.iso, approx: a.approx || b.approx, open };
  }
  const one = parseDate(s, 'start');
  return { from: one.iso, to: open ? '' : one.iso, approx: one.approx, open };
}

export const yearOf = (text) => { const m = /\b((?:19|20)\d{2})\b/.exec(String(text ?? '')); return m ? m[1] : ''; };
