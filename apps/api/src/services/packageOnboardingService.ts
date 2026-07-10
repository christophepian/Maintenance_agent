/**
 * Package onboarding — ingest a régie's whole year-end package in one step.
 *
 * A manager drops several CSVs (balance sheet, income statement, rent roll,
 * general ledger, in any combination). We detect what each file is, run the
 * matching mapper, and cross-check the documents against each other (rent-roll
 * net × 12 vs income-statement rental income; general-ledger totals vs the
 * income statement; balance-sheet Actif = Passif). `analyzePackage` is read-only
 * — it returns the document inventory + reconciliation so the manager can see
 * "✓ ties out / ⚠ off by X" before committing. `commitPackage` then routes each
 * file to its onboarder in dependency order (rent roll → general ledger →
 * statements), reusing the existing per-document flows.
 */

import { PrismaClient } from "@prisma/client";
import * as inventoryRepo from "../repositories/inventoryRepository";
import { detectDocumentType, PackageDocType } from "./packageDetector";
import { mapRentRoll } from "./rentRollMapper";
import { mapRegieLedger } from "./regieLedgerMapper";
import { mapCsvToAccountBalances } from "./csvAccountingMapper";
import { computeBalanceImbalanceCents, ingestStatement } from "./importedStatementService";
import { commitOnboarding, OnboardingError, OnboardingBillingMode } from "./buildingOnboardingService";
import { commitInvoiceOnboarding } from "./invoiceOnboardingService";

export interface PackageFile {
  fileName: string;
  text: string;
}

export interface PackageDocumentDTO {
  fileName: string;
  type: PackageDocType;
  summary: Record<string, number>;
  detail: string;
}

export interface ReconciliationCheckDTO {
  label: string;
  expectedChf: number;
  actualChf: number;
  deltaChf: number;
  ok: boolean;
  note: string;
}

export interface PackageAnalysisDTO {
  buildingId: string;
  buildingName: string;
  fiscalYear: number;
  documents: PackageDocumentDTO[];
  reconciliation: ReconciliationCheckDTO[];
  warnings: string[];
}

export interface PackageCommitResultDTO {
  buildingId: string;
  fiscalYear: number;
  results: { fileName: string; type: PackageDocType; outcome: string; detail: string }[];
  warnings: string[];
}

const round2 = (n: number): number => Math.round(n * 100) / 100;
const errMsg = (e: unknown): string => (e instanceof Error ? e.message : String(e));

/* ── per-document analysis ────────────────────────────────────────────────── */

interface Parsed {
  rentRoll?: { objects: number; tenants: number; annualNetRentChf: number };
  gl?: { contractorInvoices: number; grossExpenseChf: number; grossRevenueChf: number };
  bs?: { actifChf: number; passifChf: number; imbalanceChf: number };
  is?: { revenueChf: number; expenseChf: number; rentalIncomeChf: number };
}

function analyzeDocument(file: PackageFile, type: PackageDocType, into: Parsed): PackageDocumentDTO {
  if (type === "RENT_ROLL") {
    const { rows } = mapRentRoll(file.text);
    const tenants = new Set(rows.filter((r) => !r.isVacant && r.tenantName).map((r) => r.tenantName));
    const annualNetRentChf = round2(
      rows.filter((r) => !r.isVacant).reduce((s, r) => s + (r.netRentChf ?? 0), 0) * 12,
    );
    into.rentRoll = { objects: rows.length, tenants: tenants.size, annualNetRentChf };
    return {
      fileName: file.fileName,
      type,
      summary: { objects: rows.length, tenants: tenants.size, annualNetRentChf },
      detail: `${rows.length} object(s), ${tenants.size} tenant(s), CHF ${annualNetRentChf.toLocaleString("de-CH")}/yr net`,
    };
  }

  if (type === "GENERAL_LEDGER") {
    const { summary } = mapRegieLedger(file.text);
    into.gl = {
      contractorInvoices: summary.total,
      grossExpenseChf: summary.grossExpenseChf,
      grossRevenueChf: summary.grossRevenueChf,
    };
    return {
      fileName: file.fileName,
      type,
      summary: { contractorInvoices: summary.total, grossExpenseChf: summary.grossExpenseChf, grossRevenueChf: summary.grossRevenueChf },
      detail: `${summary.total} contractor invoice(s); gross expenses CHF ${summary.grossExpenseChf.toLocaleString("de-CH")}`,
    };
  }

  // BALANCE_SHEET / INCOME_STATEMENT share the account-balance mapper.
  const { items } = mapCsvToAccountBalances(file.text);
  if (type === "BALANCE_SHEET") {
    const actifChf = round2(items.filter((b) => b.documentSection === "ACTIF").reduce((s, b) => s + b.balanceChf, 0));
    const passifChf = round2(items.filter((b) => b.documentSection === "PASSIF").reduce((s, b) => s + b.balanceChf, 0));
    const imbCents = computeBalanceImbalanceCents(
      items.map((b) => ({ rawAccountCode: b.rawAccountCode, balanceCents: Math.round(b.balanceChf * 100), balanceType: b.balanceType, documentSection: b.documentSection })),
    );
    const imbalanceChf = imbCents == null ? 0 : round2(imbCents / 100);
    into.bs = { actifChf, passifChf, imbalanceChf };
    return {
      fileName: file.fileName,
      type,
      summary: { actifChf, passifChf, imbalanceChf },
      detail: `Actif CHF ${actifChf.toLocaleString("de-CH")} · Passif CHF ${passifChf.toLocaleString("de-CH")}`,
    };
  }

  // INCOME_STATEMENT
  const revenueChf = round2(Math.abs(items.filter((b) => b.documentSection === "REVENUE").reduce((s, b) => s + b.balanceChf, 0)));
  const expenseChf = round2(Math.abs(items.filter((b) => b.documentSection === "EXPENSE").reduce((s, b) => s + b.balanceChf, 0)));
  const rentalIncomeChf = round2(
    Math.abs(items.filter((b) => (b.rawAccountCode ?? "").replace(/\D/g, "").startsWith("300")).reduce((s, b) => s + b.balanceChf, 0)),
  ) || revenueChf;
  into.is = { revenueChf, expenseChf, rentalIncomeChf };
  return {
    fileName: file.fileName,
    type,
    summary: { revenueChf, expenseChf, rentalIncomeChf },
    detail: `Revenue CHF ${revenueChf.toLocaleString("de-CH")} · Expenses CHF ${expenseChf.toLocaleString("de-CH")}`,
  };
}

/* ── cross-document reconciliation ────────────────────────────────────────── */

function check(label: string, expected: number, actual: number, tolerancePct: number, note: string): ReconciliationCheckDTO {
  const delta = round2(actual - expected);
  const tol = Math.max(1, Math.abs(expected) * tolerancePct);
  return { label, expectedChf: round2(expected), actualChf: round2(actual), deltaChf: delta, ok: Math.abs(delta) <= tol, note };
}

function reconcile(p: Parsed): ReconciliationCheckDTO[] {
  const checks: ReconciliationCheckDTO[] = [];

  if (p.rentRoll && p.is) {
    checks.push(check(
      "Rent roll × 12 vs income-statement rental income",
      p.is.rentalIncomeChf,
      p.rentRoll.annualNetRentChf,
      0.05,
      "Annualised net rent from the rent roll should approximate the statement's rental income (small gaps are normal from mid-year moves/vacancy).",
    ));
  }
  if (p.gl && p.is) {
    checks.push(check(
      "General-ledger expenses vs income-statement expenses",
      p.is.expenseChf,
      p.gl.grossExpenseChf,
      0.01,
      "The ledger summed by account is the income statement's expense detail — these should tie out closely.",
    ));
    checks.push(check(
      "General-ledger revenue vs income-statement revenue",
      p.is.revenueChf,
      p.gl.grossRevenueChf,
      0.01,
      "Ledger revenue rows summed should match the income statement's revenue.",
    ));
  }
  if (p.bs) {
    checks.push(check(
      "Balance sheet: Actif = Passif",
      0,
      p.bs.imbalanceChf,
      0,
      p.bs.imbalanceChf === 0 ? "Balanced." : "The balance sheet does not balance — check the import.",
    ));
  }
  return checks;
}

/* ── fiscal-year detection ────────────────────────────────────────────────── */

function detectFiscalYear(files: { type: PackageDocType; text: string }[]): number {
  const years = new Map<number, number>();
  for (const f of files) {
    if (f.type !== "GENERAL_LEDGER") continue;
    for (const m of f.text.matchAll(/\b\d{1,2}[./-]\d{1,2}[./-](\d{4})\b/g)) {
      const y = parseInt(m[1], 10);
      if (y >= 2000 && y <= 2100) years.set(y, (years.get(y) ?? 0) + 1);
    }
  }
  let best = 0;
  let bestCount = -1;
  for (const [y, c] of years) if (c > bestCount) { best = y; bestCount = c; }
  return best || new Date().getUTCFullYear();
}

/* ── analyze ──────────────────────────────────────────────────────────────── */

export async function analyzePackage(
  prisma: PrismaClient,
  orgId: string,
  buildingId: string,
  files: PackageFile[],
): Promise<PackageAnalysisDTO> {
  const building = await inventoryRepo.findBuildingByIdAndOrg(prisma, buildingId, orgId);
  if (!building) throw new OnboardingError("BUILDING_NOT_FOUND", "Building not found");

  const parsed: Parsed = {};
  const warnings: string[] = [];
  const typed: { type: PackageDocType; text: string }[] = [];
  const seenTypes = new Map<PackageDocType, number>();

  const documents = files.map((f) => {
    const type = detectDocumentType(f.fileName, f.text);
    typed.push({ type, text: f.text });
    seenTypes.set(type, (seenTypes.get(type) ?? 0) + 1);
    if (type === "UNKNOWN") {
      warnings.push(`Could not classify "${f.fileName}" — skipped. Expected a balance sheet, income statement, rent roll or general ledger.`);
      return { fileName: f.fileName, type, summary: {}, detail: "Unrecognised — not included in the package." };
    }
    try {
      return analyzeDocument(f, type, parsed);
    } catch (e) {
      warnings.push(`Failed to read "${f.fileName}" as ${type}: ${errMsg(e)}`);
      return { fileName: f.fileName, type, summary: {}, detail: `Could not parse: ${errMsg(e)}` };
    }
  });

  for (const [type, n] of seenTypes) {
    if (n > 1 && type !== "UNKNOWN") warnings.push(`${n} files were classified as ${type} — only expected one.`);
  }
  if (!seenTypes.has("RENT_ROLL")) warnings.push("No rent roll detected — units, tenants and leases won't be created.");
  if (!seenTypes.has("INCOME_STATEMENT") && !seenTypes.has("BALANCE_SHEET")) {
    warnings.push("No balance sheet or income statement detected — reporting won't be populated for this year.");
  }

  const detectedYear = detectFiscalYear(typed);

  return {
    buildingId,
    buildingName: building.name,
    fiscalYear: detectedYear,
    documents,
    reconciliation: reconcile(parsed),
    warnings,
  };
}

/* ── commit ───────────────────────────────────────────────────────────────── */

const COMMIT_ORDER: Record<PackageDocType, number> = {
  RENT_ROLL: 0,
  GENERAL_LEDGER: 1,
  BALANCE_SHEET: 2,
  INCOME_STATEMENT: 2,
  UNKNOWN: 9,
};

export async function commitPackage(
  prisma: PrismaClient,
  orgId: string,
  buildingId: string,
  files: PackageFile[],
  opts: { billingMode: OnboardingBillingMode; fiscalYear: number; actorUserId?: string },
): Promise<PackageCommitResultDTO> {
  const building = await inventoryRepo.findBuildingByIdAndOrg(prisma, buildingId, orgId);
  if (!building) throw new OnboardingError("BUILDING_NOT_FOUND", "Building not found");

  const typedFiles = files
    .map((f) => ({ ...f, type: detectDocumentType(f.fileName, f.text) }))
    .filter((f) => f.type !== "UNKNOWN")
    .sort((a, b) => COMMIT_ORDER[a.type] - COMMIT_ORDER[b.type]);

  const results: PackageCommitResultDTO["results"] = [];
  const warnings: string[] = [];

  for (const f of typedFiles) {
    try {
      if (f.type === "RENT_ROLL") {
        const r = await commitOnboarding(prisma, orgId, buildingId, f.text, {
          billingMode: opts.billingMode,
          actorUserId: opts.actorUserId,
        });
        results.push({
          fileName: f.fileName,
          type: f.type,
          outcome: `${r.created.units} unit(s), ${r.created.tenants} tenant(s), ${r.created.leases} lease(s)`,
          detail: r.errors.length ? `${r.errors.length} issue(s)` : "ok",
        });
      } else if (f.type === "GENERAL_LEDGER") {
        const r = await commitInvoiceOnboarding(prisma, orgId, buildingId, f.text, { actorUserId: opts.actorUserId });
        results.push({
          fileName: f.fileName,
          type: f.type,
          outcome: `${r.created} invoice(s), ${r.vendorsLinked} vendor(s)`,
          detail: r.errors.length ? `${r.errors.length} issue(s)` : "ok",
        });
      } else {
        // BALANCE_SHEET / INCOME_STATEMENT → into the imported-statement review
        // gate (not auto-approved; the manager approves in finance/Imports).
        await ingestStatement(prisma, {
          buffer: Buffer.from(f.text, "utf8"),
          fileName: f.fileName,
          mimeType: "text/csv",
          orgId,
          uploadedBy: opts.actorUserId ?? "system",
          buildingId,
          fiscalYear: opts.fiscalYear || undefined,
          isCsv: true,
        });
        results.push({
          fileName: f.fileName,
          type: f.type,
          outcome: "sent to review",
          detail: "Approve it in Finance → Imports to populate reporting.",
        });
      }
    } catch (e) {
      results.push({ fileName: f.fileName, type: f.type, outcome: "failed", detail: errMsg(e) });
      warnings.push(`${f.fileName}: ${errMsg(e)}`);
    }
  }

  return { buildingId, fiscalYear: opts.fiscalYear, results, warnings };
}
