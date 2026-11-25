// Maps the blocks read from an uploaded file (see extract.js) onto the faculty form.
// It works from the COLUMN HEADINGS and the "Label : value" names, not from fixed positions,
// so different layouts (this app's own sheet, the NBA "Faculty Profile", CV tables, Excel lists) all work.
import { parseDate, parseRange, yearOf, NOW_WORDS } from './dates.js';
import { GENDERS, COMMUNITIES, INDEXED_OPTIONS, FDP_MODES, MEMBER_GRADES, AWARD_LEVELS, SCHOLAR_STATUS, SCHOLAR_ROLES, blankRows, normalizeForm } from '../constants.js';

const clean = (s) => String(s ?? '').replace(/\s+/g, ' ').trim();
const low = (s) => clean(s).toLowerCase();
const isDash = (s) => /^[-\u2013\u2014_.\s]*$/.test(String(s ?? ''));
const isNA = (s) => isDash(s) || /^[-\u2013\u2014\s]*(n\/?a|nil|none|not applicable|no)[-\u2013\u2014\s.]*$/i.test(clean(s));
const val = (s) => (isNA(s) ? '' : clean(s));
const pickOpt = (s, options, aliases = {}) => {
  const t = low(s); if (!t) return '';
  for (const [k, v] of Object.entries(aliases)) if (new RegExp(k, 'i').test(t)) return v;
  return options.find((o) => t === o.toLowerCase()) || options.find((o) => t.includes(o.toLowerCase())) || '';
};

// ---------- "Label : value" personal fields -------------------------------------------------------------
const LABELS = [
  ['name', /^(name of (the )?(faculty|teacher|staff|employee)( member)?|faculty name|teacher name|staff name|name)\s*:?$/],
  ['department', /^(name of (the )?)?(department|dept\.?)( name)?\s*:?$/],
  ['designation', /designation|present post|current post/],
  ['joiningDate', /date of joining|joining date|date of appointment|date of joining the present post/],
  ['aicte', /aicte/], ['apar', /apar\b|apaar/], ['anna', /anna univ/],
  ['address', /address/], ['mobile', /mobile|phone|contact (no|number)/], ['email', /e-?mail/],
  ['gender', /^(gender|sex)\b/], ['community', /community|caste/],
  ['pan', /^pan\b|pan (no|number)|permanent account/], ['aadhaar', /aadhaar|aadhar/],
  ['dob', /date of birth|d\.?o\.?b\b/], ['bloodGroup', /blood/],
  ['scaleOfPay', /scale of pay/], ['basicPay', /basic pay/], ['totalSalary', /total salary|gross salary/],
  ['gate', /^gate\b/], ['net', /^(net|slet)\b|net\s*\/\s*slet/], ['phdTitle', /title of (the )?ph\.?\s?d/], ['phdFaculty', /faculty of (the )?ph\.?\s?d/],
];
const labelKeys = (cell) => {
  const t = low(cell).replace(/\s*:\s*$/, '');
  if (!t || t.length > 70) return [];
  return LABELS.filter(([, re]) => re.test(t)).map(([k]) => k);
};

function setPersonal(out, key, raw, notes) {
  const v = val(raw);
  if (!v || out[key]) return;
  switch (key) {
    case 'mobile': { let d = v.replace(/\D/g, ''); if (d.length > 10) d = d.slice(-10); if (d.length === 10) out.mobile = d; break; }
    case 'aadhaar': { const d = v.replace(/\D/g, ''); if (d.length === 12) out.aadhaar = d; else notes.add('Aadhaar number must have 12 digits - not filled.'); break; }
    case 'pan': { const m = /[A-Z]{5}\d{4}[A-Z]/.exec(v.toUpperCase().replace(/\s/g, '')); if (m) out.pan = m[0]; break; }
    case 'email': { const m = /[^\s,;<>()]+@[^\s,;<>()]+\.[A-Za-z]{2,}/.exec(v); if (m) out.email = m[0]; break; }
    case 'gender': { const g = pickOpt(v, GENDERS, { '^(m|male|man)$': 'Male', '^(f|female|woman)$': 'Female', 'trans': 'TG' }); if (g) out.gender = g; break; }
    case 'community': { const c = pickOpt(v, [...COMMUNITIES].reverse()); if (c) out.community = c; break; }
    case 'dob': case 'joiningDate': { const d = parseDate(v).iso; if (d) out[key] = d; break; }
    case 'bloodGroup': { const m = /\b(AB|A|B|O)\s*(\+|-|positive|negative|ve)/i.exec(v); if (m) out.bloodGroup = m[1].toUpperCase() + (/^\+|pos/i.test(m[2]) ? '+' : '-'); break; }
    case 'aicte': {
      const parts = v.split(/[\/,;|]+|\s{2,}/).map(clean).filter(Boolean);
      out.aicte = parts[0] || v; if (parts[1] && !out.apar) out.apar = parts[1]; break;
    }
    default: out[key] = v;
  }
}

function collectPairs(blocks, skipTids, notes) {
  const out = {};
  const both = new Set();
  const take = (cells) => {
    for (let i = 0; i < cells.length; i++) {
      const keys = labelKeys(cells[i]);
      if (!keys.length) continue;
      let j = i + 1;
      while (j < cells.length && !clean(cells[j])) j++;
      if (j >= cells.length || labelKeys(cells[j]).length) continue;
      if (keys.includes('aicte') && keys.includes('apar')) {
        const parts = val(cells[j]).split(/[\/,;|]+|\s{2,}/).map(clean).filter(Boolean);
        if (parts[0] && !out.aicte) out.aicte = parts[0];
        if (parts[1] && !out.apar) out.apar = parts[1];
        both.add(i);
      } else keys.slice(0, 1).forEach((k) => setPersonal(out, k, cells[j], notes));
      i = j;
    }
  };
  for (const b of blocks) {
    if (b.t === 'row') { if (!skipTids.has(b.tid)) take(b.cells); }
    else {
      const m = /^([^:]{2,70}):\s*(.+)$/.exec(b.text);
      if (m && labelKeys(m[1]).length) take([m[1], m[2]]);
    }
  }
  return out;
}

// ---------- tables -------------------------------------------------------------------------------------------------
const SPECS = {
  education: { cat: /categor|level/, degree: /degree|qualification|course/, spec: /special|branch|discipline|subject/, college: /college/, univ: /univ|institut/, year: /year|passing/, marks: /%|cgpa|marks|percent|grade obtained/, cls: /class|division|grade/ },
  experience: { inst: /institution|organi[sz]ation|college|employer|company|name of|^institute/, desig: /designation|post|position/, type: /type|nature/, from: /from|joining|start/, to: /^to\b|relieving|end|till|leaving/, period: /period|duration/ },
  pubCombined: { type: /^type/, title: /title/, venue: /journal|conference|publisher|name/, indexed: /index/, year: /year|date/, ref: /doi|issn|isbn/ },
  publications: { title: /title/, date: /date|year/, publisher: /publisher|journal/, indexed: /index/, authors: /author/, doi: /doi/, issn: /issn|isbn/ },
  conferences: { title: /title/, authors: /author/, date: /date|year/, conference: /conference|name/ },
  workshops: { title: /title|workshop/, organizer: /organi[sz]ed|organi[sz]er|conducted/, venue: /venue|place/, from: /from/, to: /^to\b/, role: /role/ },
  fdps: { title: /title|fdp/, organizer: /organi[sz]ed|organi[sz]er|conducted/, mode: /mode/, from: /from/, to: /^to\b/ },
  fdpMix: { title: /title|fdp|workshop/, organizer: /organi[sz]ed|organi[sz]er|conducted|institute|agency/, duration: /duration|date|period|dates/, mode: /mode/, cert: /certificate/ },
  nptel: { course: /course/, duration: /weeks|duration/, session: /session/, score: /score|marks|%/, grade: /grade|certificate/ },
  patents: { title: /title/, type: /type/, number: /(patent|application).*no|number/, date: /filing|filed/, agency: /agency|funding/, amount: /amount|₹|rs/, status: /status|duration|remarks/, inventors: /inventor/ },
  memberships: { body: /body|society|association|organi[sz]ation|institution/, number: /\bno\b|number|id/, grade: /grade|type|category/, validity: /valid|period|from|year/ },
  awards: { title: /award|recogni|title|honou?r/, body: /body|agency|organi[sz]|presented|given|institution/, year: /year|date/, level: /level/ },
  scholars: { name: /scholar|student|name/, univ: /univ|institut/, regYear: /year|regist/, status: /status/, role: /role/ },
  duties: { resp: /responsib|duty|duties|role|position|activity/, committee: /committee|cell|body|unit/, period: /period|duration|from|year/ },
};

function mapCols(header, spec) {
  const idx = {};
  header.forEach((h, i) => {
    const t = low(h);
    if (!t) return;
    for (const [k, re] of Object.entries(spec)) if (idx[k] === undefined && re.test(t)) { idx[k] = i; break; }
  });
  return idx;
}

// What kind of table has this header?  (checked in this order)
function classify(header, heading) {
  const h = header.map(low).join(' | ');
  const hd = low(heading);
  if (!h.replace(/\|/g, '').trim()) return '';
  if (/membership/.test(h) && /(body|society|no)/.test(h)) return 'memberships';
  if (/scholar/.test(h)) return 'scholars';
  if (/(^|\| )award|recognition/.test(h) && !/publication|title of the paper/.test(h)) return 'awards';
  if (/responsib/.test(h)) return 'duties';
  if (/course name|nptel/.test(h) && !/fdp|workshop/.test(h)) return 'nptel';
  if (/degree/.test(h) && /(university|institut|college|special|passing|year)/.test(h)) return 'education';
  if (/title of the workshop/.test(h)) return 'workshops';
  if (/title of the fdp/.test(h)) return 'fdps';
  if (/title of the patent|patent/.test(h) && /title/.test(h)) return 'patents';
  if (/^type/.test(h) && /title/.test(h) && /(journal|conf|book|publication)/.test(h)) return 'pubCombined';
  if (/title of (the )?(paper|publication|article)/.test(h) && /conference name/.test(h)) return 'conferences';
  if (/title of (the )?(paper|publication|article)/.test(h) && /(publisher|indexed)/.test(h)) return 'publications';
  if (/title/.test(h) && /(fdp|workshop|certification|sttp|course|programme|program)/.test(h) && /(organi[sz]ed|duration|date)/.test(h)) return 'fdpMix';
  if (/designation/.test(h) && /(institution|organi[sz]ation|college|employer|company)/.test(h) && /(from|joining|period|duration)/.test(h)) return 'experience';
  if (/title/.test(h) && /(sponsored|consultancy|patent|funding)/.test(h)) return 'patents';
  // heading as a tie-break for plain headers
  if (/membership/.test(hd)) return 'memberships';
  if (/award/.test(hd)) return 'awards';
  return '';
}

const NOTITLE = /^(s\.?\s?no\.?|sl\.?\s?no\.?|#|no\.?)$/i;
const dropIndex = (cells, header) => { const first = low(header[0]); return NOTITLE.test(first) || first === '' ? cells.slice(1) : cells; };

function rowsFor(table, kind) {
  // header = first row (among the first 3) that classifies; data rows = the rest
  let hi = -1;
  for (let i = 0; i < Math.min(3, table.rows.length); i++) { const k = classify(table.rows[i], table.heading); if (k) { hi = i; kind = k; break; } }
  if (hi < 0) return null;
  const header = table.rows[hi].map(clean);
  const hasIndex = NOTITLE.test(low(header[0])) || (header[0] === '' && header.length > 2);
  const cols = mapCols(hasIndex ? header.slice(1) : header, SPECS[kind]);
  const data = table.rows.slice(hi + 1).map((r) => (hasIndex ? r.slice(1) : r));
  return { kind, cols, data };
}

const cell = (r, cols, k) => (cols[k] === undefined ? '' : clean(r[cols[k]]));
const mapIndexed = (s) => {
  const t = low(s); if (!t) return '';
  if (/scopus/.test(t)) return 'Scopus';
  if (/web of science|wos/.test(t)) return 'Web of Science';
  if (/sci/.test(t)) return 'SCI / SCIE';
  if (/ugc/.test(t)) return 'UGC CARE';
  if (/google/.test(t)) return 'Google Scholar';
  if (/not indexed|^no$|nil/.test(t)) return 'Not Indexed';
  return 'Other';
};
const splitRef = (s) => {
  const t = clean(s); if (!t) return { doi: '', issn: '' };
  const m = /10\.\d{4,9}\/[^\s;,]+/.exec(t);
  const doi = m ? m[0].replace(/[.)]+$/, '') : '';
  let rest = t.replace(/(doi\s*[:/]?\s*)?10\.\d{4,9}\/[^\s;,]+/i, '').replace(/^\s*[;,/:]+|[;,/:]+\s*$/g, '').replace(/^(doi)\b[\s:/]*/i, '').trim();
  rest = rest.replace(/^[;,/:\s]+|[;,/:\s]+$/g, '');
  return { doi, issn: rest };
};

const ROW_TOTAL = /^(total|grand total|s\.?no)/i;

function build(kind, cols, data, ctx, out, stats) {
  const push = (key, row) => { (out[key] ||= []).push(row); };
  for (const r of data) {
    const first = low(r.find((c) => clean(c)) || '');
    if (!first || ROW_TOTAL.test(first)) continue;
    if (r.filter((c) => clean(c)).length === 1 && isNA(r.find((c) => clean(c)))) continue;       // "-NA-"
    switch (kind) {
      case 'education': {
        const degree = val(cell(r, cols, 'degree')); if (!degree) break;
        const catRaw = cell(r, cols, 'cat');
        const t = low(catRaw + ' ' + degree);
        let key = '';
        if (/ph\.?\s?d|doctor/.test(t)) key = 'PhD';
        else if (/\bm\.?\s?(e|tech|sc|phil|ca|com|a|b\.?a|s)\b|master|\bpg\b|post\s?grad|mba|mca/.test(t)) key = 'PG';
        else if (/\bb\.?\s?(e|tech|sc|ca|com|a|b\.?a|s|arch)\b|bachelor|\bug\b|under\s?grad|diploma|\bd\.?\s?e\.?\s?e\.?\b/.test(t)) key = 'UG';
        if (!key) { stats.notes.add(`Could not tell if "${degree}" is UG, PG or Ph.D. - please add it by hand.`); break; }
        const e = out.education ||= {};
        if (e[key]) { stats.notes.add(`More than one ${key === 'PhD' ? 'Ph.D.' : key} qualification found - only the first was filled.`); break; }
        let college = val(cell(r, cols, 'college')), univ = val(cell(r, cols, 'univ'));
        e[key] = { degree, specialization: val(cell(r, cols, 'spec')), year: yearOf(cell(r, cols, 'year')) || val(cell(r, cols, 'year')), college, university: univ, marks: val(cell(r, cols, 'marks')), cls: val(cell(r, cols, 'cls')) };
        break;
      }
      case 'experience': {
        const inst = val(cell(r, cols, 'inst')); if (!inst) break;
        const desig = val(cell(r, cols, 'desig'));
        let from = parseDate(cell(r, cols, 'from'), 'start'), toCell = cell(r, cols, 'to'), to = parseDate(toCell, 'end'), approx = from.approx || to.approx;
        if (!from.iso && cols.period !== undefined) { const g = parseRange(cell(r, cols, 'period')); if (g.from) { from = { iso: g.from }; to = { iso: g.to }; approx = g.approx; } }
        if (NOW_WORDS.test(toCell)) to = { iso: '' };
        if (approx) stats.notes.add('Some experience dates had only a month or year - they were filled as the 1st / last day. Please check them.');
        const type = low(cell(r, cols, 'type'));
        const isInd = /industr|corporate|company|software|private/.test(type) && !/teach|academic/.test(type) || /research/.test(type) && !/teach|academic/.test(type) || (!type && /industr/.test(ctx));
        if (isInd) push('industrial', { ...blankRows.industrial(), org: inst, designation: desig, nature: /research/.test(type) ? 'Research' : '', from: from.iso, to: to.iso });
        else push('academic', { ...blankRows.academic(), college: inst, designation: desig, from: from.iso, to: to.iso });
        break;
      }
      case 'pubCombined': {
        const title = val(cell(r, cols, 'title')); if (!title) break;
        const t = low(cell(r, cols, 'type')), venue = val(cell(r, cols, 'venue')), year = yearOf(cell(r, cols, 'year')) || val(cell(r, cols, 'year'));
        if (/conf|proceed|symposium|seminar/.test(t)) push('conferences', { ...blankRows.conferences(), title, date: year, conference: venue });
        else { const ref = splitRef(cell(r, cols, 'ref')); push('publications', { ...blankRows.publications(), title, date: year, publisher: venue, indexed: mapIndexed(cell(r, cols, 'indexed')), doi: ref.doi, issn: ref.issn }); }
        break;
      }
      case 'publications': {
        const title = val(cell(r, cols, 'title')); if (!title) break;
        push('publications', { ...blankRows.publications(), title, date: yearOf(cell(r, cols, 'date')) ? (parseDate(cell(r, cols, 'date')).approx ? yearOf(cell(r, cols, 'date')) : parseDate(cell(r, cols, 'date')).iso) : val(cell(r, cols, 'date')), publisher: val(cell(r, cols, 'publisher')), indexed: mapIndexed(cell(r, cols, 'indexed')), authors: val(cell(r, cols, 'authors')), doi: val(cell(r, cols, 'doi')), issn: val(cell(r, cols, 'issn')) });
        break;
      }
      case 'conferences': {
        const title = val(cell(r, cols, 'title')); if (!title) break;
        const d = cell(r, cols, 'date'), pd = parseDate(d);
        push('conferences', { ...blankRows.conferences(), title, authors: val(cell(r, cols, 'authors')), date: pd.iso && !pd.approx ? pd.iso : (yearOf(d) || val(d)), conference: val(cell(r, cols, 'conference')) });
        break;
      }
      case 'workshops': case 'fdps': {
        const title = val(cell(r, cols, 'title')); if (!title) break;
        const f = parseDate(cell(r, cols, 'from')).iso, t = parseDate(cell(r, cols, 'to')).iso || f;
        if (kind === 'workshops') push('workshops', { ...blankRows.workshops(), title, organizer: val(cell(r, cols, 'organizer')), venue: val(cell(r, cols, 'venue')), from: f, to: t, role: pickOpt(cell(r, cols, 'role'), ['Participant', 'Resource Person', 'Organizer / Coordinator'], { 'resource|speaker|invited': 'Resource Person', 'organi|coordinat|convener': 'Organizer / Coordinator', 'particip|attend': 'Participant' }) });
        else push('fdps', { ...blankRows.fdps(), title, organizer: val(cell(r, cols, 'organizer')), mode: pickOpt(cell(r, cols, 'mode'), FDP_MODES), from: f, to: t });
        break;
      }
      case 'fdpMix': {
        const title = val(cell(r, cols, 'title')); if (!title) break;
        const g = parseRange(cell(r, cols, 'duration')), mode = pickOpt(cell(r, cols, 'mode'), FDP_MODES) || (/online|virtual|webinar/i.test(title) ? 'Online' : '');
        const organizer = val(cell(r, cols, 'organizer'));
        if (/nptel|swayam|coursera|udemy|edx|mooc/i.test(title)) { stats.notes.add('NPTEL / online-course rows are not copied (they need the certificate file) - add them in the NPTEL section.'); break; }
        if (/workshop/i.test(title)) push('workshops', { ...blankRows.workshops(), title, organizer, from: g.from, to: g.to, role: '' });
        else push('fdps', { ...blankRows.fdps(), title, organizer, mode, from: g.from, to: g.to });
        break;
      }
      case 'patents': {
        const typeCell = low(cell(r, cols, 'type'));
        if (typeCell && !/patent/.test(typeCell)) { stats.skipped.projects++; break; }
        const title = val(cell(r, cols, 'title')); if (!title) break;
        const st = clean(cell(r, cols, 'status'));
        const num = val(cell(r, cols, 'number')) || (/(?:patent|application|app\.?)\s*(?:no\.?|number)?\s*[:\-]?\s*([A-Z0-9][\w\/\-]{4,})/i.exec(st) || [])[1] || '';
        const status = /grant/i.test(st) ? 'Granted' : /publi/i.test(st) ? 'Published' : /fil|appl/i.test(st) ? 'Filed' : '';
        const dateCell = cell(r, cols, 'date');
        push('patents', { ...blankRows.patents(), title, number: num, date: dateCell ? parseDate(dateCell).iso : (/filed\s*(on)?\s*([\d./-]+)/i.exec(st) ? parseDate(/filed\s*(?:on)?\s*([\d./-]+)/i.exec(st)[1]).iso : ''), status, inventors: val(cell(r, cols, 'inventors')) });
        break;
      }
      case 'memberships': {
        const body = val(cell(r, cols, 'body')); if (!body) break;
        push('memberships', { ...blankRows.memberships(), body, number: val(cell(r, cols, 'number')), grade: val(cell(r, cols, 'grade')) && (pickOpt(cell(r, cols, 'grade'), MEMBER_GRADES) || val(cell(r, cols, 'grade'))), validity: val(cell(r, cols, 'validity')) });
        break;
      }
      case 'awards': {
        const title = val(cell(r, cols, 'title')); if (!title) break;
        push('awards', { ...blankRows.awards(), title, body: val(cell(r, cols, 'body')), year: yearOf(cell(r, cols, 'year')) || val(cell(r, cols, 'year')), level: pickOpt(cell(r, cols, 'level'), AWARD_LEVELS, { 'intl|international|world': 'International' }) });
        break;
      }
      case 'scholars': {
        const name = val(cell(r, cols, 'name')); if (!name) break;
        push('scholars', { ...blankRows.scholars(), name, university: val(cell(r, cols, 'univ')), regYear: yearOf(cell(r, cols, 'regYear')) || val(cell(r, cols, 'regYear')), status: pickOpt(cell(r, cols, 'status'), SCHOLAR_STATUS, { 'award|complet|degree': 'Awarded', 'submit': 'Submitted', 'ongoing|pursuing|progress|registered': 'Ongoing' }), role: pickOpt(cell(r, cols, 'role'), SCHOLAR_ROLES, { 'co.?guide|joint': 'Co-Guide', 'guide|supervisor': 'Guide' }) });
        break;
      }
      case 'duties': {
        const responsibility = val(cell(r, cols, 'resp')); if (!responsibility) break;
        push('duties', { ...blankRows.duties(), responsibility, committee: val(cell(r, cols, 'committee')), period: val(cell(r, cols, 'period')) });
        break;
      }
      default: break;
    }
  }
}

const SECTION_LABEL = { education: 'Educational qualification', academic: 'Academic experience', industrial: 'Industrial experience', publications: 'Publications', conferences: 'Conferences', workshops: 'Workshops', fdps: 'FDPs', patents: 'Patents', memberships: 'Professional body memberships', awards: 'Awards and recognitions', scholars: 'Ph.D. scholars guided', duties: 'Administrative responsibilities' };

// blocks -> { patch, summary:[{label,count}], notes:[], total }
export function parseBlocks(blocks) {
  const notes = new Set();
  const stats = { notes, skipped: { projects: 0 } };

  // group table rows
  const tables = []; const byTid = new Map();
  let heading = '', prevHeading = '';
  for (const b of blocks) {
    if (b.t === 'p') { if (b.text.length <= 140) { prevHeading = heading; heading = b.text; } continue; }
    let t = byTid.get(b.tid);
    if (!t) { t = { tid: b.tid, heading, rows: [] }; byTid.set(b.tid, t); tables.push(t); }
    t.rows.push(b.cells);
  }

  const out = {};
  const dataTids = new Set();
  for (const t of tables) {
    const r = rowsFor(t, '');
    if (!r) continue;
    dataTids.add(t.tid);
    build(r.kind, r.cols, r.data, low(t.heading), out, stats);
  }
  const personal = collectPairs(blocks, dataTids, notes);

  const patch = {};
  const map = { name: 'name', department: 'department', designation: 'designation', joiningDate: 'joiningDate', aicte: 'aicteId', apar: 'apparId', anna: 'annaUnivId', address: 'address', mobile: 'mobile', email: 'email', gender: 'gender', community: 'community', pan: 'pan', aadhaar: 'aadhaar', dob: 'dob', bloodGroup: 'bloodGroup', scaleOfPay: 'scaleOfPay', basicPay: 'basicPay', totalSalary: 'totalSalary', gate: 'gate', net: 'net', phdTitle: 'phdTitle', phdFaculty: 'phdFaculty' };
  let personalCount = 0;
  for (const [k, f] of Object.entries(map)) if (personal[k]) { patch[f] = personal[k]; personalCount++; }
  if (patch.pan) patch.pan = patch.pan.toUpperCase();
  const summary = [];
  if (personalCount) summary.push({ label: 'Personal details', count: personalCount });
  for (const [k, v] of Object.entries(out)) {
    if (k === 'education') { patch.education = v; summary.push({ label: SECTION_LABEL[k], count: Object.keys(v).length }); }
    else if (v.length) { patch[k] = v; summary.push({ label: SECTION_LABEL[k], count: v.length }); }
  }
  if (stats.skipped.projects) notes.add(`${stats.skipped.projects} sponsored project / consultancy row(s) were not copied (the sheet has no section for them).`);
  return { patch, summary, notes: [...notes], total: summary.reduce((a, s) => a + s.count, 0) };
}

// Puts the found values into a form.  Found values replace what was there; anything not found is left untouched.
export function applyPatch(form, patch) {
  const f = normalizeForm(form);
  const out = { ...f, education: { ...f.education } };
  for (const [k, v] of Object.entries(patch)) {
    if (k === 'education') for (const [ek, ev] of Object.entries(v)) out.education[ek] = { ...f.education[ek], ...ev };
    else if (Array.isArray(v)) out[k] = v;
    else out[k] = v;
  }
  return out;
}
