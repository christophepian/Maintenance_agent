/**
 * Deterministic formatting helpers – safe for SSR + hydration.
 *
 * Node.js and browsers use different ICU data, which means that
 * `toLocaleString()`, `toLocaleDateString()`, and `Intl.NumberFormat`
 * can return different Unicode characters (e.g. U+00A0 vs U+202F for
 * narrow non-breaking space in "de-CH" currency formatting). This
 * produces React hydration mismatch errors.
 *
 * All helpers below use plain string manipulation so the output is
 * identical on server and client.
 */

/**
 * Format a number as CHF currency.
 *   formatChf(7500)   → "CHF 7'500"
 *   formatChf(7500.3) → "CHF 7'500.30"
 *   formatChf(null)   → "—"
 */
export function formatChf(value) {
  if (value == null || !Number.isFinite(Number(value))) return "—";
  const num = Number(value);
  const hasDecimals = num % 1 !== 0;
  const str = hasDecimals ? num.toFixed(2) : num.toFixed(0);
  const [intPart, decPart] = str.split(".");
  const formatted = intPart.replace(/\B(?=(\d{3})+(?!\d))/g, "'");
  return decPart ? `CHF ${formatted}.${decPart}` : `CHF ${formatted}`;
}

/**
 * Format a number as CHF currency from cents.
 *   formatChfCents(750000) → "CHF 7'500.00"
 */
export function formatChfCents(cents) {
  if (cents == null || !Number.isFinite(Number(cents))) return "—";
  return formatChf(Number(cents) / 100);
}

/**
 * Format a number with Swiss thousands separator (apostrophe).
 *   formatNumber(7500) → "7'500"
 */
export function formatNumber(value) {
  if (value == null || !Number.isFinite(Number(value))) return "—";
  const num = Number(value);
  const hasDecimals = num % 1 !== 0;
  const str = hasDecimals ? num.toFixed(2) : num.toFixed(0);
  const [intPart, decPart] = str.split(".");
  const formatted = intPart.replace(/\B(?=(\d{3})+(?!\d))/g, "'");
  return decPart ? `${formatted}.${decPart}` : formatted;
}

const MONTHS_SHORT = [
  "Jan", "Feb", "Mar", "Apr", "May", "Jun",
  "Jul", "Aug", "Sep", "Oct", "Nov", "Dec",
];

/**
 * Format an ISO date string as "dd.MM.yyyy".
 *   formatDate("2026-01-15T10:00:00Z") → "15.01.2026"
 *   formatDate(null)                    → "—"
 */
export function formatDate(iso) {
  if (!iso) return "—";
  const d = new Date(iso);
  if (isNaN(d.getTime())) return "—";
  const dd = String(d.getDate()).padStart(2, "0");
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const yyyy = d.getFullYear();
  return `${dd}.${mm}.${yyyy}`;
}

/**
 * Format an ISO date string as "dd.MM.yyyy HH:mm".
 *   formatDateTime("2026-01-15T14:30:00Z") → "15.01.2026 15:30" (local TZ)
 */
export function formatDateTime(iso) {
  if (!iso) return "—";
  const d = new Date(iso);
  if (isNaN(d.getTime())) return "—";
  const dd = String(d.getDate()).padStart(2, "0");
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const yyyy = d.getFullYear();
  const hh = String(d.getHours()).padStart(2, "0");
  const min = String(d.getMinutes()).padStart(2, "0");
  return `${dd}.${mm}.${yyyy} ${hh}:${min}`;
}

/**
 * Format an ISO date string as "15 Jan 2026" (long human-readable).
 *   formatDateLong("2026-01-15T10:00:00Z") → "15 Jan 2026"
 */
export function formatDateLong(iso) {
  if (!iso) return "—";
  const d = new Date(iso);
  if (isNaN(d.getTime())) return "—";
  return `${d.getDate()} ${MONTHS_SHORT[d.getMonth()]} ${d.getFullYear()}`;
}

/**
 * Format a percentage.
 *   formatPercent(0.875) → "87.5%"
 */
export function formatPercent(value) {
  if (!Number.isFinite(value)) return "0%";
  return `${(value * 100).toFixed(1)}%`;
}
