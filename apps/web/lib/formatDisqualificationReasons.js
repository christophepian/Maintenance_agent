/**
 * Converts machine-readable disqualification reason strings into
 * human-friendly full sentences for display in the UI.
 *
 * Known reason prefixes:
 *   INSUFFICIENT_INCOME: household income CHF X/mo < required CHF Y/mo (3× rent+charges)
 *   MISSING_REQUIRED_DOCS: Name missing DOC1, DOC2
 *   DEBT_ENFORCEMENT: Name has debt enforcement records
 */

const DOC_TYPE_LABELS = {
  IDENTITY: "identity document (ID / passport)",
  SALARY_PROOF: "salary certificate",
  DEBT_ENFORCEMENT_EXTRACT: "debt enforcement extract",
};

function humaniseDocType(raw) {
  return DOC_TYPE_LABELS[raw] || raw.toLowerCase().replace(/_/g, " ");
}

/**
 * Parse a single reason string and return a human-friendly sentence.
 */
function formatSingleReason(reason) {
  if (!reason || typeof reason !== "string") return reason;

  // --- INSUFFICIENT_INCOME ---
  // e.g. "INSUFFICIENT_INCOME: household income CHF 5200/mo < required CHF 7500/mo (3× rent+charges)"
  const incomeMatch = reason.match(
    /^INSUFFICIENT_INCOME:\s*household income CHF\s*([\d',]+)\/mo\s*<\s*required CHF\s*([\d',]+)\/mo/i
  );
  if (incomeMatch) {
    const actual = incomeMatch[1];
    const required = incomeMatch[2];
    return `The household's combined monthly income of CHF ${actual} does not meet the minimum requirement of CHF ${required} (3× monthly rent and charges).`;
  }

  // --- MISSING_REQUIRED_DOCS ---
  // e.g. "MISSING_REQUIRED_DOCS: Sophie Dubois missing DEBT_ENFORCEMENT_EXTRACT"
  // e.g. "MISSING_REQUIRED_DOCS: Anna Meier missing SALARY_PROOF, DEBT_ENFORCEMENT_EXTRACT"
  const docsMatch = reason.match(
    /^MISSING_REQUIRED_DOCS:\s*(.+?)\s+missing\s+(.+)$/i
  );
  if (docsMatch) {
    const name = docsMatch[1];
    const rawDocs = docsMatch[2].split(/,\s*/);
    const humanDocs = rawDocs.map(humaniseDocType);
    const docList =
      humanDocs.length === 1
        ? humanDocs[0]
        : humanDocs.slice(0, -1).join(", ") + " and " + humanDocs[humanDocs.length - 1];
    return `${name} has not provided the following required document${rawDocs.length > 1 ? "s" : ""}: ${docList}.`;
  }

  // --- DEBT_ENFORCEMENT ---
  // e.g. "DEBT_ENFORCEMENT: Thomas Meier has debt enforcement records"
  const debtMatch = reason.match(
    /^DEBT_ENFORCEMENT:\s*(.+?)\s+has\s+debt\s+enforcement\s+records/i
  );
  if (debtMatch) {
    const name = debtMatch[1];
    return `${name} has active debt enforcement proceedings on record.`;
  }

  // --- Fallback: return as-is but trim the code prefix for readability ---
  const colonIdx = reason.indexOf(": ");
  if (colonIdx > 0 && colonIdx < 40) {
    // Strip the CODE: prefix and capitalise the rest
    const detail = reason.slice(colonIdx + 2).trim();
    return detail.charAt(0).toUpperCase() + detail.slice(1) + (detail.endsWith(".") ? "" : ".");
  }

  return reason;
}

/**
 * Format an array of disqualification reason strings.
 * Accepts string, string[], or nullish. Always returns string[].
 */
export function formatDisqualificationReasons(reasons) {
  if (!reasons) return [];
  const arr = Array.isArray(reasons) ? reasons : [reasons];
  return arr.filter(Boolean).map(formatSingleReason);
}
