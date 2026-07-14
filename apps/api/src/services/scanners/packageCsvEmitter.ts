/**
 * Package CSV emitter.
 *
 * Serializes structured data extracted from a régie PDF into the *exact* CSV
 * format the deterministic package mappers already consume (rentRollMapper,
 * packageDetector.parseBuildingInfo, csvAccountingMapper). This is the hinge of
 * the "PDF → canonical CSV → existing pipeline" design: the LLM produces these
 * structured rows, this pure module turns them into CSV text, and the existing
 * detect → map → reconcile → commit path takes over unchanged.
 *
 * Pure and side-effect-free — fully unit-testable without OCR or an LLM. Every
 * header here is chosen to normalize (NFD-strip-accents, lowercase, drop
 * non-alphanumerics) onto an alias the corresponding mapper recognizes, and the
 * `;` delimiter is used so tenant/vendor names containing commas don't confuse
 * the parser's header-line delimiter detection.
 */

import type { ExtractedAccountBalance } from "../documentScanner";

/** One rent-roll object as read from the *état locatif* section. */
export interface ExtractedRentRollRow {
  /** Full object code, e.g. "531100.01.0001". Required. */
  objet: string;
  /** Primary tenant, or null/"Vacant" when the object is empty. */
  tenantName?: string | null;
  /** Free-text object type as printed (e.g. "Appartement", "Garage"). */
  unitType?: string | null;
  floor?: string | null;
  rooms?: number | null;
  areaSqm?: number | null;
  /** Lease start, dd.mm.yyyy as printed. */
  entree?: string | null;
  /** Lease end, dd.mm.yyyy as printed, empty when ongoing. */
  sortie?: string | null;
  /** Net monthly rent in CHF. */
  loyerNetChf?: number | null;
  /** Monthly charges advance in CHF. */
  chargesChf?: number | null;
  /** Extraction confidence 0–1, carried for review (not emitted to CSV). */
  confidence?: number | null;
}

/** Building identity fields from the general-info section. */
export interface ExtractedBuildingInfoFields {
  /** Full address, e.g. "Rte Monts-de-Laval 314, 1090 La Croix (Lutry)". */
  immeubleAdresse?: string | null;
  immeubleReference?: string | null;
  /** Reporting period as printed, e.g. "01.01.2025 - 31.12.2025". */
  periode?: string | null;
  gerance?: string | null;
  proprietaire?: string | null;
}

const DELIM = ";";

/** Quote a cell only when it contains the delimiter, a quote, or a newline. */
function cell(v: string | number | null | undefined): string {
  if (v == null) return "";
  const s = String(v);
  if (s.includes(DELIM) || s.includes('"') || s.includes("\n") || s.includes("\r")) {
    return `"${s.replace(/"/g, '""')}"`;
  }
  return s;
}

/** Plain numeric cell (no thousands separators, up to 2 decimals), "" for null. */
function num(v: number | null | undefined): string {
  if (v == null || !Number.isFinite(v)) return "";
  return String(Math.round(v * 100) / 100);
}

function toCsv(headers: string[], rows: string[][]): string {
  return [headers.join(DELIM), ...rows.map((r) => r.join(DELIM))].join("\n");
}

/**
 * Rent roll → the CSV `rentRollMapper` parses. Headers normalize onto its
 * aliases (`objet`, `locataire`, `type`, `etage`, `pieces`, `m2`, `entree`,
 * `sortie`, `loyernet`, `chargesacompte`). Vacant objects emit "Vacant" so the
 * mapper's VACANT_RE flags them. Returns null when there are no rows.
 */
export function emitRentRollCsv(rows: ExtractedRentRollRow[]): string | null {
  const clean = rows.filter((r) => r.objet && r.objet.trim());
  if (clean.length === 0) return null;
  const headers = [
    "objet",
    "locataire",
    "type",
    "etage",
    "pieces",
    "m2",
    "entree",
    "sortie",
    "loyer_net",
    "charges_acompte",
  ];
  const body = clean.map((r) => [
    cell(r.objet.trim()),
    cell(r.tenantName && r.tenantName.trim() ? r.tenantName.trim() : "Vacant"),
    cell(r.unitType ?? ""),
    cell(r.floor ?? ""),
    num(r.rooms),
    num(r.areaSqm),
    cell(r.entree ?? ""),
    cell(r.sortie ?? ""),
    num(r.loyerNetChf),
    num(r.chargesChf),
  ]);
  return toCsv(headers, body);
}

/**
 * Building identity → the key/value CSV `parseBuildingInfo` +
 * `detectDocumentType` (GENERAL_INFO) consume. `champ`/`valeur` are the
 * INFO_KEY/INFO_VAL headers; the `immeuble_adresse` row carries the address the
 * parser splits into name/street/postal/city. Returns null when no address is
 * present (the parser would reject it anyway).
 */
export function emitBuildingInfoCsv(fields: ExtractedBuildingInfoFields): string | null {
  const address = (fields.immeubleAdresse ?? "").trim();
  if (!address) return null;
  const kv: [string, string][] = [["immeuble_adresse", address]];
  if (fields.immeubleReference && fields.immeubleReference.trim()) {
    kv.push(["immeuble_reference", fields.immeubleReference.trim()]);
  }
  if (fields.periode && fields.periode.trim()) kv.push(["periode", fields.periode.trim()]);
  if (fields.gerance && fields.gerance.trim()) kv.push(["gerance", fields.gerance.trim()]);
  if (fields.proprietaire && fields.proprietaire.trim()) {
    kv.push(["proprietaire", fields.proprietaire.trim()]);
  }
  return toCsv(["champ", "valeur"], kv.map(([k, v]) => [cell(k), cell(v)]));
}

/**
 * Account balances → the accounting CSV `csvAccountingMapper` consumes, split
 * by kind so each file classifies as exactly one statement: "balance" keeps
 * ACTIF/PASSIF rows (→ BALANCE_SHEET), "income" keeps REVENUE/EXPENSE rows
 * (→ INCOME_STATEMENT). Headers normalize onto `accountcode`/`accountname`/
 * `balancechf`/`section`. Returns null when the kind has no rows.
 */
export function emitAccountBalancesCsv(
  balances: ExtractedAccountBalance[],
  kind: "balance" | "income",
): string | null {
  const wanted =
    kind === "balance"
      ? new Set(["ACTIF", "PASSIF"])
      : new Set(["REVENUE", "EXPENSE"]);
  const rows = balances.filter((b) => wanted.has(b.documentSection));
  if (rows.length === 0) return null;
  const body = rows.map((b) => [
    cell(b.rawAccountCode),
    cell(b.rawAccountName),
    num(b.balanceChf),
    cell(b.documentSection),
  ]);
  return toCsv(["accountCode", "accountName", "balanceChf", "section"], body);
}
