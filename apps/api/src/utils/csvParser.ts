/**
 * Dependency-free, quote-aware CSV parser (RFC 4180-ish).
 *
 * Deliberately hand-rolled to match the codebase convention of avoiding new npm
 * dependencies for parsing (see the hand-rolled multipart parser in
 * storage/attachments.ts). Handles:
 *   - quoted fields with embedded commas and newlines
 *   - escaped quotes inside quoted fields ("" -> ")
 *   - CRLF and LF line endings
 *   - a leading UTF-8 BOM
 *   - a trailing newline (does not emit a spurious empty row)
 *
 * The first non-empty line is treated as the header row. Each data row is
 * returned as a `Record<header, value>`; headers are trimmed. Rows with fewer
 * cells than the header are padded with empty strings; extra cells are ignored.
 */

export interface ParsedCsv {
  headers: string[];
  rows: Record<string, string>[];
}

/** Tokenise raw CSV text into a matrix of string cells. */
function tokenize(text: string): string[][] {
  const rows: string[][] = [];
  let field = "";
  let row: string[] = [];
  let inQuotes = false;
  let i = 0;

  // Strip a leading UTF-8 BOM if present.
  if (text.charCodeAt(0) === 0xfeff) {
    i = 1;
  }

  const pushField = () => {
    row.push(field);
    field = "";
  };
  const pushRow = () => {
    pushField();
    rows.push(row);
    row = [];
  };

  while (i < text.length) {
    const ch = text[i];

    if (inQuotes) {
      if (ch === '"') {
        if (text[i + 1] === '"') {
          // Escaped quote.
          field += '"';
          i += 2;
          continue;
        }
        inQuotes = false;
        i += 1;
        continue;
      }
      field += ch;
      i += 1;
      continue;
    }

    if (ch === '"') {
      inQuotes = true;
      i += 1;
      continue;
    }
    if (ch === ",") {
      pushField();
      i += 1;
      continue;
    }
    if (ch === "\r") {
      // Handle CRLF and lone CR.
      if (text[i + 1] === "\n") i += 1;
      pushRow();
      i += 1;
      continue;
    }
    if (ch === "\n") {
      pushRow();
      i += 1;
      continue;
    }

    field += ch;
    i += 1;
  }

  // Flush the final field/row unless the input ended exactly on a newline
  // (in which case field is "" and row is empty).
  if (field.length > 0 || row.length > 0) {
    pushRow();
  }

  return rows;
}

/**
 * Parse CSV text into headers + row objects.
 * @throws Error if the input has no header row.
 */
export function parseCsv(text: string): ParsedCsv {
  const matrix = tokenize(text ?? "");

  // Drop fully-empty rows (e.g. blank lines between records).
  const nonEmpty = matrix.filter(
    (cells) => !(cells.length === 1 && cells[0].trim() === ""),
  );

  if (nonEmpty.length === 0) {
    throw new Error("CSV is empty — no header row found");
  }

  const headers = nonEmpty[0].map((h) => h.trim());
  const rows: Record<string, string>[] = [];

  for (let r = 1; r < nonEmpty.length; r += 1) {
    const cells = nonEmpty[r];
    const obj: Record<string, string> = {};
    for (let c = 0; c < headers.length; c += 1) {
      obj[headers[c]] = (cells[c] ?? "").trim();
    }
    rows.push(obj);
  }

  return { headers, rows };
}

/**
 * Normalize a Swiss-formatted money string to a number of francs.
 * Accepts thousands separators (apostrophe, space, comma) and a decimal comma
 * or dot: "1'234.50", "1 234,50", "1234.5" -> 1234.5. Returns null for blank
 * or unparseable input.
 */
export function parseChf(raw: string | undefined | null): number | null {
  if (raw == null) return null;
  const trimmed = String(raw).trim();
  if (trimmed === "") return null;

  // Remove currency labels and thousands separators (apostrophes, spaces).
  let s = trimmed.replace(/chf/i, "").replace(/[’'\s]/g, "").trim();

  // If both comma and dot are present, assume the last one is the decimal sep.
  const lastComma = s.lastIndexOf(",");
  const lastDot = s.lastIndexOf(".");
  if (lastComma >= 0 && lastDot >= 0) {
    if (lastComma > lastDot) {
      // European: dot = thousands, comma = decimal.
      s = s.replace(/\./g, "").replace(",", ".");
    } else {
      // Comma = thousands, dot = decimal.
      s = s.replace(/,/g, "");
    }
  } else if (lastComma >= 0) {
    // Only a comma -> treat as decimal separator.
    s = s.replace(",", ".");
  }

  const n = Number(s);
  return Number.isFinite(n) ? n : null;
}
