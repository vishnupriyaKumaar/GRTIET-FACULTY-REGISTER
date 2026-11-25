// Which teachers belong to a semester, and what data they have in it.
//
//  * A teacher who has a saved record for the selected semester -> that record.
//  * An ACTIVE teacher with no record yet -> the most recent EARLIER record is carried forward
//    (that is the "automatic fetch" when a new semester starts).
//  * A RELIEVED teacher stops in the semester in which they were relieved: they are listed up to
//    and including that semester, and never carried into any later semester.
import { termOrder } from './terms.js';
import { normalizeForm } from './constants.js';

export const nameKey = (s) => String(s || '').trim().replace(/\s+/g, ' ').toLowerCase();

export function recordsOf(records, staffId) {
  return records.filter((r) => r.staffId === staffId).sort((a, b) => termOrder(a.term) - termOrder(b.term));
}

// Latest record at or before `term` (null when the teacher has none that early)
export function latestUpTo(records, staffId, term) {
  const t = termOrder(term);
  const list = recordsOf(records, staffId).filter((r) => termOrder(r.term) <= t);
  return list.length ? list[list.length - 1] : null;
}

export const isStoppedFor = (staff, term) =>
  staff.status === 'relieved' && staff.relievedTerm && termOrder(term) > termOrder(staff.relievedTerm);

// -> { staff, form, source:'saved'|'carried', fromTerm, relievedHere }
export function resolve(staff, records, term) {
  if (isStoppedFor(staff, term)) return null;
  const exact = records.find((r) => r.key === `${term}|${staff.id}`);
  if (exact) return { staff, form: normalizeForm(exact.form), source: 'saved', fromTerm: term };
  const prev = latestUpTo(records, staff.id, term);
  if (prev) return { staff, form: normalizeForm(prev.form), source: 'carried', fromTerm: prev.term };
  return null;
}

export function roster(staffList, records, term) {
  return staffList
    .map((s) => resolve(s, records, term))
    .filter(Boolean)
    .sort((a, b) => nameKey(a.form.name || a.staff.name).localeCompare(nameKey(b.form.name || b.staff.name)));
}

export const staffByName = (staffList, name) => staffList.find((s) => nameKey(s.name) === nameKey(name));

// Counts shown in the register table
export const count = (rows) => (rows || []).filter((r) => Object.entries(r).some(([k, v]) => k !== 'id' && v && (typeof v !== 'object' || v.data || v.fid))).length;
