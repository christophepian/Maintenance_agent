/**
 * CSV → accounting extraction mapper.
 *
 * Turns parsed CSV rows into the SAME shapes the OCR+Claude scanner produces
 * (`ExtractedAccountBalance` / `ExtractedInvoiceLine`), so the CSV import can
 * reuse the entire imported-statement review-gate + ledger-posting pipeline
 * unchanged. A CSV is simply a deterministic alternative to OCR extraction.
 *
 * All monetary values stay in CHF (francs) — the downstream `persistBalances`
 * and `createInvoice` convert to cents. See importedStatementService.ts.
 */

import type { ExtractedAccountBalance, ExtractedInvoiceLine } from "./documentScanner";
import { parseCsv, parseChf } from "../utils/csvParser";

type DocumentSection = ExtractedAccountBalance["documentSection"];

/**
 * One reconciliation check: the extracted leaf accounts for a scope, compared
 * against the value the source document itself declares (its own "Total …"
 * rows). Turns "did we parse it right?" into a checkable invariant.
 */
export interface ReconciliationLine {
  scope: string;              // e.g. "Actifs", "Passifs", "Bilan (Actif = Passif)"
  computedChf: number;        // sum of extracted leaf accounts
  statedChf: number | null;   // the document's own declared total (null if absent)
  diffChf: number;            // computed − stated
  ok: boolean;                // within rounding tolerance
}

export interface CsvMapResult<T> {
  items: T[];
  /** Human-readable notes about skipped/invalid rows, surfaced to the manager. */
  skipped: string[];
  /** Present for account balances: extracted-vs-document-declared totals. */
  reconciliation?: ReconciliationLine[];
}

/* ── Templates (exact headers the parser expects) ─────────────────────────── */

export const ACCOUNT_BALANCE_TEMPLATE_HEADERS = [
  "accountCode",
  "accountName",
  "balanceChf",
  "documentSection",
] as const;

export const INVOICE_TEMPLATE_HEADERS = [
  "invoiceDate",
  "dueDate",
  "vendorName",
  "description",
  "subtotalChf",
  "vatChf",
  "totalChf",
  "currency",
  "iban",
  "paymentReference",
  "unitHint",
  "tenantHint",
  "invoiceNumber",
] as const;

/* ── Account-balance mapping ──────────────────────────────────────────────── */

/**
 * Derive the document section from a Swiss KMU account code when the CSV omits
 * the optional `documentSection` column.
 *   1xxx = Assets → ACTIF · 2xxx = Liabilities/Equity → PASSIF
 *   3xxx = Revenue → REVENUE · 4xxx–8xxx = Expenses → EXPENSE
 */
function deriveSection(code: string): DocumentSection {
  const digits = code.trim().replace(/\D/g, "");
  if (!digits) return "OTHER";
  switch (parseInt(digits[0], 10)) {
    case 1:  return "ACTIF";
    case 2:  return "PASSIF";
    case 3:  return "REVENUE";
    case 4:
    case 5:
    case 6:
    case 7:
    case 8:  return "EXPENSE";
    default: return "OTHER";
  }
}

/**
 * Ledger direction from section + sign (matches the scanner's convention):
 *   ACTIF/EXPENSE  positive → DEBIT,  negative → CREDIT
 *   PASSIF/REVENUE positive → CREDIT, negative → DEBIT
 *   OTHER          positive → DEBIT,  negative → CREDIT
 */
function deriveBalanceType(section: DocumentSection, chf: number): "DEBIT" | "CREDIT" {
  const positiveIsDebit = section === "ACTIF" || section === "EXPENSE" || section === "OTHER";
  const isPositive = chf >= 0;
  return positiveIsDebit === isPositive ? "DEBIT" : "CREDIT";
}

function normalizeSectionInput(raw: string | undefined): DocumentSection | null {
  if (!raw) return null;
  const up = raw.trim().toUpperCase();
  if (up === "ACTIF" || up === "PASSIF" || up === "REVENUE" || up === "EXPENSE" || up === "OTHER") {
    return up as DocumentSection;
  }
  // Common French/German section words.
  if (["ACTIFS", "AKTIVEN", "AKTIVA", "ASSET", "ASSETS"].includes(up)) return "ACTIF";
  if (["PASSIFS", "PASSIVEN", "PASSIVA", "LIABILITY", "LIABILITIES", "EQUITY", "FONDS PROPRES"].includes(up)) return "PASSIF";
  if (["PRODUITS", "PRODUIT", "REVENUS", "ERTRAG", "ERTRÄGE", "REVENUE"].includes(up)) return "REVENUE";
  if (["CHARGES", "CHARGE", "AUFWAND", "EXPENSE", "EXPENSES"].includes(up)) return "EXPENSE";
  return null;
}

/* ── Tolerant header resolution (real-world exports rarely use template names) ─ */

/** lowercase, strip accents, drop all non-alphanumerics → stable lookup key. */
function normHeader(h: string): string {
  return h
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "") // strip combining diacritics (é→e)
    .toLowerCase()
    .replace(/[^a-z0-9]/g, "");
}

const HEADER_ALIASES: Record<string, string[]> = {
  accountCode: ["accountcode", "compte", "ncompte", "nocompte", "numerocompte", "numcompte", "comptenumero", "konto", "kontonummer", "kontonr", "code", "accountno", "accountnumber", "numero"],
  accountName: ["accountname", "libelle", "designation", "intitule", "bezeichnung", "kontobezeichnung", "description", "texte", "text", "nom", "name", "wording", "compteintitule"],
  balanceChf: ["balancechf", "balance", "solde", "soldechf", "saldo", "montant", "montantchf", "betrag", "amount", "valeur", "soldefinal"],
  debit: ["debit", "debitchf", "soll", "debita"],
  credit: ["credit", "creditchf", "haben", "credita"],
  documentSection: ["documentsection", "section", "classe", "class", "categorie", "kategorie", "rubrique", "groupe", "group"],
  rowType: ["type", "typeligne", "typedeligne", "rowtype", "niveau", "level", "nature"],
};

/**
 * Normalized `type`-column values that mark a structural/aggregate row (section
 * title, group header, subtotal, total) rather than a postable account. When a
 * type column is present these rows are skipped silently — importing them would
 * double-count. Anything else (e.g. "compte"/"account") is treated as a leaf.
 */
const NON_LEAF_ROW_TYPES = new Set([
  "groupe", "sousgroupe", "total", "soustotal", "totalgeneral", "grandtotal",
  "totalsection", "sousdetail", "detail", "section", "titre", "entete",
  "categorie", "rubrique", "subtotal", "summary", "header",
]);

/**
 * Designations of a year-end result line. Such a line is booked as an equity
 * account even though hierarchical exports present it as a code-less total
 * (e.g. "Bénéfice", "Résultat de l'exercice"). Restricted to balance-sheet
 * sections so P&L result subtotals aren't mistaken for it.
 */
const RESULT_KEYWORDS = ["benefice", "perte", "resultat", "gewinn", "verlust", "ergebnis"];
/** Swiss KMU chart: 2979 = résultat de l'exercice (equity). */
const RESULT_ACCOUNT_CODE = "2979";

function isResultDesignation(name: string): boolean {
  const n = normHeader(name);
  if (!n || n.startsWith("total")) return false;
  return RESULT_KEYWORDS.some((k) => n.startsWith(k));
}

/** Map each canonical field to the actual header key present in the CSV, if any. */
function resolveHeaders(headers: string[]): Partial<Record<keyof typeof HEADER_ALIASES, string>> {
  const byNorm = new Map<string, string>();
  for (const h of headers) {
    const n = normHeader(h);
    if (n && !byNorm.has(n)) byNorm.set(n, h);
  }
  const resolved: Partial<Record<string, string>> = {};
  for (const [canonical, aliases] of Object.entries(HEADER_ALIASES)) {
    for (const alias of aliases) {
      if (byNorm.has(alias)) {
        resolved[canonical] = byNorm.get(alias);
        break;
      }
    }
  }
  return resolved;
}

export function mapCsvToAccountBalances(text: string): CsvMapResult<ExtractedAccountBalance> {
  const { headers, rows } = parseCsv(text);
  const h = resolveHeaders(headers);
  const items: ExtractedAccountBalance[] = [];
  const skipped: string[] = [];
  // The document's own declared section grand-totals (from total_section rows) —
  // ground truth for reconciliation.
  const statedTotals = new Map<DocumentSection, number>();

  if (!h.accountCode) {
    skipped.push(
      `No account-code column found. Expected one of: accountCode, Compte, Konto, Code (got: ${headers.join(", ")})`,
    );
    return { items, skipped };
  }
  if (!h.balanceChf && !(h.debit || h.credit)) {
    skipped.push(
      `No balance column found. Expected a Solde/Montant/balanceChf column, or Débit + Crédit columns (got: ${headers.join(", ")})`,
    );
    return { items, skipped };
  }

  rows.forEach((row, i) => {
    const rawType = h.rowType ? normHeader(String(row[h.rowType] ?? "")) : "";
    const code = (row[h.accountCode!] ?? "").trim();
    const name = (h.accountName ? row[h.accountName] ?? "" : "").trim();

    // Resolve the balance: prefer a single signed balance column, else Débit/Crédit.
    let chf: number | null = null;
    let explicitType: "DEBIT" | "CREDIT" | null = null;
    if (h.balanceChf) {
      chf = parseChf(row[h.balanceChf]);
    } else {
      const d = h.debit ? parseChf(row[h.debit]) : null;
      const c = h.credit ? parseChf(row[h.credit]) : null;
      if (d != null && d !== 0) {
        chf = d;
        explicitType = "DEBIT";
      } else if (c != null && c !== 0) {
        chf = c;
        explicitType = "CREDIT";
      }
    }

    const explicitSection = normalizeSectionInput(h.documentSection ? row[h.documentSection] : undefined);

    // Year-end result line (e.g. "Bénéfice") — the export presents it as a
    // code-less total, but it must be booked into equity for the bilan to
    // balance. Handled BEFORE the structural-row skip (it is a `total` row).
    if (!code && chf != null && isResultDesignation(name) && (explicitSection === "ACTIF" || explicitSection === "PASSIF")) {
      items.push({
        rawAccountCode: RESULT_ACCOUNT_CODE,
        rawAccountName: name,
        balanceChf: chf,
        balanceType: deriveBalanceType(explicitSection, chf),
        documentSection: explicitSection,
      });
      return;
    }

    // Skip structural/aggregate rows silently so they don't double-count
    // (section titles, group headers, subtotals, sub-detail breakdowns).
    if (rawType && NON_LEAF_ROW_TYPES.has(rawType)) {
      // A section grand-total is the document's own ground truth — keep it for
      // reconciliation before discarding the row.
      if (rawType === "totalsection" && explicitSection && chf != null) {
        statedTotals.set(explicitSection, chf);
      }
      return;
    }

    if (!code && !name && chf == null) return; // silently skip fully-blank rows
    if (!code) {
      skipped.push(`Row ${i + 2}: missing account code`);
      return;
    }
    if (chf == null) {
      skipped.push(`Row ${i + 2} (${code}): missing or invalid balance`);
      return;
    }

    const section = explicitSection ?? deriveSection(code);
    items.push({
      rawAccountCode: code,
      rawAccountName: name || code,
      balanceChf: chf,
      balanceType: explicitType ?? deriveBalanceType(section, chf),
      documentSection: section,
    });
  });

  return { items, skipped, reconciliation: buildReconciliation(items, statedTotals) };
}

const round2 = (n: number): number => Math.round(n * 100) / 100;

/**
 * Reconcile the extracted leaf accounts against the document's own declared
 * section totals, plus the Actif = Passif identity. A 1-rappen tolerance
 * absorbs rounding. Returns [] when the document declares no totals to check.
 */
function buildReconciliation(
  items: ExtractedAccountBalance[],
  statedTotals: Map<DocumentSection, number>,
): ReconciliationLine[] {
  const TOL = 0.01;
  const computed = new Map<DocumentSection, number>();
  for (const it of items) {
    computed.set(it.documentSection, (computed.get(it.documentSection) ?? 0) + it.balanceChf);
  }

  const lines: ReconciliationLine[] = [];
  const SECTION_LABELS: [DocumentSection, string][] = [
    ["ACTIF", "Actifs"], ["PASSIF", "Passifs"], ["REVENUE", "Produits"], ["EXPENSE", "Charges"],
  ];
  for (const [section, label] of SECTION_LABELS) {
    const stated = statedTotals.get(section);
    if (stated == null) continue;
    const c = round2(computed.get(section) ?? 0);
    const diff = round2(c - stated);
    lines.push({ scope: label, computedChf: c, statedChf: round2(stated), diffChf: diff, ok: Math.abs(diff) <= TOL });
  }

  // Balance-sheet identity: total assets must equal total liabilities + equity.
  const actif = computed.get("ACTIF");
  const passif = computed.get("PASSIF");
  if (actif != null && passif != null) {
    const diff = round2(actif - passif);
    lines.push({ scope: "Bilan (Actif = Passif)", computedChf: round2(actif), statedChf: round2(passif), diffChf: diff, ok: Math.abs(diff) <= TOL });
  }
  return lines;
}

/* ── Invoice mapping ──────────────────────────────────────────────────────── */

function orNull(v: string | undefined): string | null {
  const t = (v ?? "").trim();
  return t === "" ? null : t;
}

export function mapCsvToInvoiceLines(text: string): CsvMapResult<ExtractedInvoiceLine> {
  const { rows } = parseCsv(text);
  const items: ExtractedInvoiceLine[] = [];
  const skipped: string[] = [];

  rows.forEach((row, i) => {
    const total = parseChf(row.totalChf);
    const subtotal = parseChf(row.subtotalChf);
    const vat = parseChf(row.vatChf);
    const vendor = orNull(row.vendorName);
    const description = orNull(row.description);

    // A line needs at least an amount to be meaningful.
    if (total == null && subtotal == null && !vendor && !description) return; // blank row
    if (total == null && subtotal == null) {
      skipped.push(`Row ${i + 2}: missing both totalChf and subtotalChf`);
      return;
    }

    items.push({
      vendorName: vendor,
      invoiceNumber: orNull(row.invoiceNumber),
      invoiceDate: orNull(row.invoiceDate),
      dueDate: orNull(row.dueDate),
      totalAmount: total,
      vatAmount: vat,
      subtotal,
      currency: orNull(row.currency),
      iban: orNull(row.iban),
      paymentReference: orNull(row.paymentReference),
      description,
      unitHint: orNull(row.unitHint),
      tenantHint: orNull(row.tenantHint),
      confidence: 1, // deterministic — never dropped by the 0.6 confidence gate
    });
  });

  return { items, skipped };
}
