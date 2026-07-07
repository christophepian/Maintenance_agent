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

export interface CsvMapResult<T> {
  items: T[];
  /** Human-readable notes about skipped/invalid rows, surfaced to the manager. */
  skipped: string[];
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
  return null;
}

export function mapCsvToAccountBalances(text: string): CsvMapResult<ExtractedAccountBalance> {
  const { rows } = parseCsv(text);
  const items: ExtractedAccountBalance[] = [];
  const skipped: string[] = [];

  rows.forEach((row, i) => {
    const code = (row.accountCode ?? "").trim();
    const name = (row.accountName ?? "").trim();
    const chf = parseChf(row.balanceChf);

    if (!code && !name) return; // silently skip fully-blank rows
    if (!code) {
      skipped.push(`Row ${i + 2}: missing accountCode`);
      return;
    }
    if (chf == null) {
      skipped.push(`Row ${i + 2} (${code}): missing or invalid balanceChf`);
      return;
    }

    const section = normalizeSectionInput(row.documentSection) ?? deriveSection(code);
    items.push({
      rawAccountCode: code,
      rawAccountName: name || code,
      balanceChf: chf,
      balanceType: deriveBalanceType(section, chf),
      documentSection: section,
    });
  });

  return { items, skipped };
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
