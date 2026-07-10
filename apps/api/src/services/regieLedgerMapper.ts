/**
 * Régie general-ledger (grand livre) CSV → contractor-invoice rows.
 *
 * A régie year-end package includes a transaction-detail export:
 *   groupe | compte | libelle_compte | date_valeur | no_piece | texte_ecriture | montant_chf
 * with one row per accounting entry. The expense rows (account code ≥ 40000)
 * whose `texte_ecriture` is a "SUPPLIER / description" are contractor invoices;
 * some carry a `531100.01.0001:` objet prefix attributing them to a specific unit.
 *
 * We extract those as invoice rows and skip everything that isn't a discrete
 * third-party supplier invoice: revenue (rent) detail, recurring internal
 * charges (management fee, bank/postal fees, rounding) and payroll postings.
 */

import { parseCsv, parseChf } from "../utils/csvParser";
import { parseSwissDate } from "./rentRollMapper";

export interface RegieInvoiceRow {
  compte: string; // account code, e.g. "41200"
  accountName: string; // libelle_compte, e.g. "Entretien des appartements"
  date: Date | null; // date_valeur
  noPiece: string; // supplier/piece number, e.g. "1062728"
  // Idempotency key. Usually the piece number, but when one supplier invoice is
  // split across several accounts (same no_piece on multiple rows, e.g. an SI
  // Lutry bill charged to both electricity and water) the later rows are suffixed
  // with their account code so each line imports instead of being dropped.
  pieceKey: string;
  vendorName: string; // "ACE Electroménager"
  description: string; // "Remplacement 2 ampoules hotte"
  unitObjet: string | null; // "531100.01.0001" when the row is unit-scoped
  unitNumber: string | null; // "0001"
  amountChf: number; // 36.75 (francs, rappen preserved)
}

export interface RegieAccountSummary {
  compte: string;
  accountName: string;
  count: number;
  totalChf: number;
}

export interface RegieLedgerResult {
  invoices: RegieInvoiceRow[];
  skipped: string[];
  summary: {
    total: number;
    totalChf: number;
    unitAttributed: number;
    byAccount: RegieAccountSummary[];
  };
}

/* ── tolerant header resolution (mirrors rentRollMapper) ─────────────────── */

function normHeader(h: string): string {
  return h
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]/g, "");
}

const ALIASES: Record<string, string[]> = {
  compte: ["compte", "konto", "kontonr", "compteno", "nocompte", "account", "accountcode", "code"],
  accountName: ["libellecompte", "libelle", "designation", "bezeichnung", "kontobezeichnung", "accountname", "nomcompte"],
  date: ["datevaleur", "date", "datum", "datepiece", "datecompta", "valuta", "buchungsdatum"],
  noPiece: ["nopiece", "piece", "beleg", "belegnr", "nofacture", "facture", "referenz", "reference", "pieceno"],
  text: ["texteecriture", "texte", "libelleecriture", "buchungstext", "text", "ecriture", "narration"],
  amountChf: ["montantchf", "montant", "betrag", "amount", "chf"],
};

function resolveHeaders(headers: string[]): Partial<Record<keyof typeof ALIASES, string>> {
  const byNorm = new Map<string, string>();
  for (const h of headers) {
    const n = normHeader(h);
    if (n && !byNorm.has(n)) byNorm.set(n, h);
  }
  const resolved: Partial<Record<string, string>> = {};
  for (const [canonical, aliases] of Object.entries(ALIASES)) {
    for (const alias of aliases) {
      if (byNorm.has(alias)) {
        resolved[canonical] = byNorm.get(alias);
        break;
      }
    }
  }
  return resolved;
}

/* ── classification ───────────────────────────────────────────────────────── */

/** Recurring internal charges that are NOT discrete supplier invoices. */
const INTERNAL_CHARGE_CODES = new Set(["46000", "48100", "45905"]);
const INTERNAL_CHARGE_RE = /honoraires de gestion|frais bancaires|frais postaux|arrondi/i;

/** `531100.01.0001: ACE / ...` → { objet, unitNumber, rest }. */
function splitUnitPrefix(text: string): { objet: string | null; unitNumber: string | null; rest: string } {
  const m = text.match(/^\s*(\d{3,}(?:\.\d+){1,})\s*:\s*([\s\S]*)$/);
  if (m) {
    const objet = m[1];
    const unitNumber = objet.split(".").pop() || null;
    return { objet, unitNumber, rest: m[2].trim() };
  }
  return { objet: null, unitNumber: null, rest: text.trim() };
}

/** Split "VENDOR / description" on the first slash. */
function splitVendorDescription(text: string): { vendor: string; description: string } | null {
  const idx = text.indexOf("/");
  if (idx < 0) return null;
  const vendor = text.slice(0, idx).trim();
  const description = text.slice(idx + 1).trim();
  if (!vendor) return null;
  return { vendor, description };
}

/* ── main ─────────────────────────────────────────────────────────────────── */

export function mapRegieLedger(text: string): RegieLedgerResult {
  const { headers, rows } = parseCsv(text);
  const h = resolveHeaders(headers);
  const invoices: RegieInvoiceRow[] = [];
  const skipped: string[] = [];

  if (!h.compte || !h.text || !h.amountChf) {
    skipped.push(
      `Missing required columns. Expected account code, entry text and amount (got: ${headers.join(", ")})`,
    );
    return { invoices, skipped, summary: { total: 0, totalChf: 0, unitAttributed: 0, byAccount: [] } };
  }

  const seenPiece = new Set<string>();
  rows.forEach((row) => {
    const compte = (row[h.compte!] ?? "").trim();
    const rawText = (row[h.text!] ?? "").trim();
    if (!compte || !rawText) return; // blank row

    const code = parseInt(compte, 10);
    // Expenses only: revenue (rent) detail lives below 40000.
    if (!Number.isFinite(code) || code < 40000) return;

    const accountName = (h.accountName ? row[h.accountName] ?? "" : "").trim();

    // Skip recurring internal charges (management fee, bank/postal fees, rounding).
    if (INTERNAL_CHARGE_CODES.has(compte) || INTERNAL_CHARGE_RE.test(accountName)) return;

    const amount = parseChf(row[h.amountChf!]);
    if (amount == null || amount === 0) return;

    const noPiece = (h.noPiece ? row[h.noPiece] ?? "" : "").trim();
    if (!noPiece) return; // payroll / internal postings carry no piece number

    const { objet, unitNumber, rest } = splitUnitPrefix(rawText);
    const vd = splitVendorDescription(rest);
    if (!vd) return; // no "SUPPLIER / description" → not a supplier invoice

    // One supplier invoice split across accounts shares a no_piece across rows;
    // suffix later rows with their account so every line imports.
    const pieceKey = seenPiece.has(noPiece) ? `${noPiece}:${compte}` : noPiece;
    seenPiece.add(noPiece);

    invoices.push({
      compte,
      accountName: accountName || `Account ${compte}`,
      date: h.date ? parseSwissDate(row[h.date]) : null,
      noPiece,
      pieceKey,
      vendorName: vd.vendor,
      description: vd.description || accountName || vd.vendor,
      unitObjet: objet,
      unitNumber,
      amountChf: Math.round(amount * 100) / 100,
    });
  });

  // Per-account rollup for the preview.
  const byAccountMap = new Map<string, RegieAccountSummary>();
  let totalChf = 0;
  let unitAttributed = 0;
  for (const inv of invoices) {
    totalChf += inv.amountChf;
    if (inv.unitNumber) unitAttributed += 1;
    const cur =
      byAccountMap.get(inv.compte) ??
      { compte: inv.compte, accountName: inv.accountName, count: 0, totalChf: 0 };
    cur.count += 1;
    cur.totalChf = Math.round((cur.totalChf + inv.amountChf) * 100) / 100;
    byAccountMap.set(inv.compte, cur);
  }
  const byAccount = [...byAccountMap.values()].sort((a, b) => a.compte.localeCompare(b.compte));

  return {
    invoices,
    skipped,
    summary: {
      total: invoices.length,
      totalChf: Math.round(totalChf * 100) / 100,
      unitAttributed,
      byAccount,
    },
  };
}
