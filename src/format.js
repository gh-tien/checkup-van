// Display formatters ported from the prototype's fmtDate / toLocaleString use.
// Hermes ships without full Intl grouping, so numbers are grouped by hand.

const M2 = ['01', '02', '03', '04', '05', '06', '07', '08', '09', '10', '11', '12'];
const MON = { jan: 1, feb: 2, mar: 3, apr: 4, may: 5, jun: 6, jul: 7, aug: 8, sep: 9, oct: 10, nov: 11, dec: 12 };
const pad = (n) => String(n).padStart(2, '0');

// The demo snapshot is pinned to this date everywhere (submitCheck, markFixed, approve).
export const TODAY = '24 Aug 2026';

/** Normalise any of "yyyy-mm-dd" | "D Mon YYYY" | "dd/mm/yyyy" to "dd/mm/yyyy". */
export function fmtDate(v) {
  if (v == null || v === '') return '';
  const s = String(v).trim();
  let m = s.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (m) return m[3] + '/' + m[2] + '/' + m[1];
  m = s.match(/^(\d{1,2})\s+([A-Za-z]{3})[a-z]*\s+(\d{4})$/);
  if (m && MON[m[2].toLowerCase()]) return pad(m[1]) + '/' + pad(MON[m[2].toLowerCase()]) + '/' + m[3];
  m = s.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
  if (m) return pad(m[1]) + '/' + pad(m[2]) + '/' + m[3];
  return s;
}

/** "yyyy-mm-dd" | "D Mon YYYY" | "dd/mm/yyyy" → ms epoch, or null. */
export function parseDate(v) {
  if (v == null || v === '') return null;
  const s = String(v).trim();
  let m = s.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (m) return Date.UTC(+m[1], +m[2] - 1, +m[3]);
  m = s.match(/^(\d{1,2})\s+([A-Za-z]{3})[a-z]*\s+(\d{4})$/);
  if (m && MON[m[2].toLowerCase()]) return Date.UTC(+m[3], MON[m[2].toLowerCase()] - 1, +m[1]);
  m = s.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
  if (m) return Date.UTC(+m[3], +m[2] - 1, +m[1]);
  return null;
}

/** Whole days from the pinned demo date until `v` (negative = overdue). null if unparseable. */
export function daysUntil(v) {
  const t = parseDate(v);
  if (t == null) return null;
  const now = parseDate(TODAY);
  return Math.round((t - now) / 86400000);
}

/** 128400 → "128,400" */
export function fmtNum(n) {
  if (n == null || n === '') return '';
  return String(n).replace(/\B(?=(\d{3})+(?!\d))/g, ',');
}

/** 1 → "1 defect", 3 → "3 defects" */
export function plural(n, one, many) {
  return n + ' ' + (n === 1 ? one : (many || one + 's'));
}

// Month-index helper kept for fmtDate's Date branch parity with the prototype.
export function fmtDateObj(d) {
  return pad(d.getDate()) + '/' + M2[d.getMonth()] + '/' + d.getFullYear();
}
