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
import { detectDocumentType, PackageDocType, parseBuildingInfo, ExtractedBuildingInfo } from "./packageDetector";
import { mapRentRoll } from "./rentRollMapper";
import { mapRegieLedger } from "./regieLedgerMapper";
import { mapCsvToAccountBalances } from "./csvAccountingMapper";
import { computeBalanceImbalanceCents, ingestStatement, approveStatement } from "./importedStatementService";
import { commitOnboarding, assessRentRollHydration, OnboardingError, OnboardingBillingMode } from "./buildingOnboardingService";
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
  /** True when the building already has ≥1 active unit. When the package carries
   *  a rent roll with unmatched objects, the client must confirm new-unit
   *  creation before commit (the duplication guard). */
  buildingAlreadyPopulated: boolean;
  /** Rent-roll objects that match no existing unit and would be created as NEW
   *  units. 0 when there's no rent roll or every object merges. */
  rentRollNewUnits: number;
  /** Multi-building guardrail — set when the upload appears to mix more than one
   *  building's reports (see BuildingSplitDTO). Commit is blocked when multiple. */
  buildingSplit: BuildingSplitDTO;
  /** Present only when the upload was a PDF: the canonical CSVs extracted from
   *  it, which the client re-submits verbatim at commit (single extraction). */
  extractedFiles?: PackageFile[];
}

export interface PackageCommitResultDTO {
  buildingId: string;
  fiscalYear: number;
  results: { fileName: string; type: PackageDocType; outcome: string; detail: string }[];
  warnings: string[];
}

/** Analysis for the "import into a new building" flow — no building yet, so it
 *  carries the building identity extracted from the package's general-info doc. */
export interface NewBuildingPackageAnalysisDTO {
  extractedBuilding: ExtractedBuildingInfo | null;
  fiscalYear: number;
  documents: PackageDocumentDTO[];
  reconciliation: ReconciliationCheckDTO[];
  warnings: string[];
  /** Multi-building guardrail (see BuildingSplitDTO). */
  buildingSplit: BuildingSplitDTO;
  /** Present only when the upload was a PDF: the canonical CSVs extracted from
   *  it, which the client re-submits verbatim at commit (single extraction). */
  extractedFiles?: PackageFile[];
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

/* ── multi-building guardrail ─────────────────────────────────────────────── */

/**
 * A package is meant to describe ONE building. When a user drops several
 * buildings' reports together (e.g. two rent rolls + two income statements),
 * silently merging them into a single building corrupts the inventory. This
 * detects that case so the caller can block it.
 *
 * - `multiple` + `!ambiguous`: two or more DISTINCT building identities were
 *   found (different rent-roll object-code prefixes, or different general-info
 *   addresses) — a hard error; import one at a time.
 * - `multiple` + `ambiguous`: a singular document (rent roll / income statement
 *   / balance sheet / ledger) appears more than once but we can't tell whether
 *   they're different buildings or different years of the same one — ask.
 */
export interface BuildingSplitDTO {
  multiple: boolean;
  ambiguous: boolean;
  buildings: string[];
  message: string;
}

const SINGULAR_TYPES: PackageDocType[] = ["RENT_ROLL", "GENERAL_LEDGER", "BALANCE_SHEET", "INCOME_STATEMENT"];

const TYPE_PLURAL: Partial<Record<PackageDocType, string>> = {
  RENT_ROLL: "rent rolls",
  GENERAL_LEDGER: "general ledgers",
  BALANCE_SHEET: "balance sheets",
  INCOME_STATEMENT: "income statements",
};

/** Building portion of a régie object code: "531100.01.0001" → "531100". Null
 *  for bare unit numbers (no building prefix, e.g. "0001") — carries no identity. */
function objetBuildingKey(objet: string): string | null {
  const t = (objet ?? "").trim();
  const dot = t.indexOf(".");
  return dot > 0 ? t.slice(0, dot).trim() : null;
}

/** The single building key a rent-roll file is about, or null when its objects
 *  don't share one prefix (bare-numbered rent rolls carry no building code). */
function rentRollBuildingKey(text: string): string | null {
  try {
    const keys = new Set<string>();
    for (const r of mapRentRoll(text).rows) {
      const k = objetBuildingKey(r.objet);
      if (k) keys.add(k);
    }
    return keys.size === 1 ? [...keys][0] : null;
  } catch {
    return null;
  }
}

function normalizeAddress(addr: string): string {
  return addr.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
}

export function detectBuildingSplit(files: { text: string; type: PackageDocType }[]): BuildingSplitDTO {
  const typeCounts = new Map<PackageDocType, number>();
  const rentKeys = new Set<string>();
  const addressByNorm = new Map<string, string>();
  for (const f of files) {
    typeCounts.set(f.type, (typeCounts.get(f.type) ?? 0) + 1);
    if (f.type === "RENT_ROLL") {
      const k = rentRollBuildingKey(f.text);
      if (k) rentKeys.add(k);
    } else if (f.type === "GENERAL_INFO") {
      const info = parseBuildingInfo(f.text);
      if (info?.address) addressByNorm.set(normalizeAddress(info.address), info.address);
    }
  }
  const maxDupSingular = Math.max(0, ...SINGULAR_TYPES.map((t) => typeCounts.get(t) ?? 0));

  // Confirmed: two or more distinct identities (prefer the human-readable address).
  if (addressByNorm.size >= 2 || rentKeys.size >= 2) {
    const buildings = addressByNorm.size >= 2 ? [...addressByNorm.values()] : [...rentKeys].map((k) => `object group ${k}`);
    return {
      multiple: true,
      ambiguous: false,
      buildings,
      message: `These files describe ${buildings.length} different buildings (${buildings.join("; ")}). A package must cover one building — import each building's report separately.`,
    };
  }
  // Ambiguous: duplicate singular docs, but no distinguishing identity.
  if (maxDupSingular >= 2) {
    const dup = SINGULAR_TYPES.filter((t) => (typeCounts.get(t) ?? 0) >= 2).map((t) => TYPE_PLURAL[t] ?? t);
    return {
      multiple: true,
      ambiguous: true,
      buildings: [],
      message: `Found ${dup.join(" and ")} more than once. This usually means two different buildings — but it could be two years of the same one. Import one at a time, or confirm they're the same building.`,
    };
  }
  return { multiple: false, ambiguous: false, buildings: [], message: "" };
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

/** Detect + summarise each file and collect cross-document warnings. Shared by
 *  the existing-building and new-building analyze paths. */
function detectAndSummarize(files: PackageFile[]): {
  documents: PackageDocumentDTO[];
  parsed: Parsed;
  warnings: string[];
  typed: { type: PackageDocType; text: string }[];
  seenTypes: Map<PackageDocType, number>;
} {
  const parsed: Parsed = {};
  const warnings: string[] = [];
  const typed: { type: PackageDocType; text: string }[] = [];
  const seenTypes = new Map<PackageDocType, number>();

  const documents = files.map((f) => {
    const type = detectDocumentType(f.fileName, f.text);
    typed.push({ type, text: f.text });
    seenTypes.set(type, (seenTypes.get(type) ?? 0) + 1);
    if (type === "UNKNOWN") {
      warnings.push(`Could not classify "${f.fileName}" — detected but not imported.`);
      return { fileName: f.fileName, type, summary: {}, detail: "Unrecognised — not included in the package." };
    }
    if (type === "GENERAL_INFO") {
      const info = parseBuildingInfo(f.text);
      return { fileName: f.fileName, type, summary: {}, detail: info ? `Building info — ${info.address}` : "Building info (no readable address)." };
    }
    try {
      return analyzeDocument(f, type, parsed);
    } catch (e) {
      warnings.push(`Failed to read "${f.fileName}" as ${type}: ${errMsg(e)}`);
      return { fileName: f.fileName, type, summary: {}, detail: `Could not parse: ${errMsg(e)}` };
    }
  });

  for (const [type, n] of seenTypes) {
    if (n > 1 && type !== "UNKNOWN" && type !== "GENERAL_INFO") warnings.push(`${n} files were classified as ${type} — only expected one.`);
  }
  if (!seenTypes.has("RENT_ROLL")) warnings.push("No rent roll detected — units, tenants and leases won't be created.");
  if (!seenTypes.has("INCOME_STATEMENT") && !seenTypes.has("BALANCE_SHEET")) {
    warnings.push("No balance sheet or income statement detected — reporting won't be populated for this year.");
  }

  return { documents, parsed, warnings, typed, seenTypes };
}

export async function analyzePackage(
  prisma: PrismaClient,
  orgId: string,
  buildingId: string,
  files: PackageFile[],
): Promise<PackageAnalysisDTO> {
  const building = await inventoryRepo.findBuildingByIdAndOrg(prisma, buildingId, orgId);
  if (!building) throw new OnboardingError("BUILDING_NOT_FOUND", "Building not found");

  const { documents, parsed, warnings, typed } = detectAndSummarize(files);

  // Assess whether the rent roll (if any) would create new units into an
  // already-populated building — the panel surfaces a confirm gate when so.
  let buildingAlreadyPopulated = false;
  let rentRollNewUnits = 0;
  const rentRollFile = files.find((f) => detectDocumentType(f.fileName, f.text) === "RENT_ROLL");
  if (rentRollFile) {
    try {
      const assess = await assessRentRollHydration(prisma, orgId, buildingId, rentRollFile.text);
      buildingAlreadyPopulated = assess.buildingAlreadyPopulated;
      rentRollNewUnits = assess.newUnits;
      if (buildingAlreadyPopulated && rentRollNewUnits > 0) {
        warnings.push(`This building already has units — ${rentRollNewUnits} rent-roll object(s) match none of them. Confirm "create new units" at commit, or they'll be skipped (merges/updates still apply).`);
      }
    } catch {
      /* assessment is advisory — never block analyze on it */
    }
  } else {
    const existing = await inventoryRepo.listUnits(prisma, orgId, buildingId, true);
    buildingAlreadyPopulated = existing.some((u) => u.isActive !== false);
  }

  const buildingSplit = detectBuildingSplit(typed);

  return {
    buildingId,
    buildingName: building.name,
    fiscalYear: detectFiscalYear(typed),
    documents,
    reconciliation: reconcile(parsed),
    warnings,
    buildingAlreadyPopulated,
    rentRollNewUnits,
    buildingSplit,
  };
}

/** Analyze a package for a building that doesn't exist yet: detect the docs and
 *  extract the building's identity (address, fiscal year) from the general-info
 *  doc so the UI can pre-fill the create-building step. No writes. */
export function analyzePackageForNewBuilding(files: PackageFile[]): NewBuildingPackageAnalysisDTO {
  const { documents, parsed, warnings, typed } = detectAndSummarize(files);
  const infoFile = files.find((f) => detectDocumentType(f.fileName, f.text) === "GENERAL_INFO");
  const extractedBuilding = infoFile ? parseBuildingInfo(infoFile.text) : null;
  if (!extractedBuilding) warnings.push("No general-info document detected — enter the building's address manually.");
  const buildingSplit = detectBuildingSplit(typed);
  return {
    extractedBuilding,
    fiscalYear: extractedBuilding?.fiscalYear ?? detectFiscalYear(typed),
    documents,
    reconciliation: reconcile(parsed),
    warnings,
    buildingSplit,
  };
}

/* ── commit ───────────────────────────────────────────────────────────────── */

const COMMIT_ORDER: Record<PackageDocType, number> = {
  RENT_ROLL: 0,
  GENERAL_LEDGER: 1,
  BALANCE_SHEET: 2,
  INCOME_STATEMENT: 2,
  GENERAL_INFO: 9,
  UNKNOWN: 9,
};

export async function commitPackage(
  prisma: PrismaClient,
  orgId: string,
  buildingId: string,
  files: PackageFile[],
  opts: { billingMode: OnboardingBillingMode; fiscalYear: number; actorUserId?: string; allowNewUnits?: boolean; allowMultiBuilding?: boolean },
): Promise<PackageCommitResultDTO> {
  const building = await inventoryRepo.findBuildingByIdAndOrg(prisma, buildingId, orgId);
  if (!building) throw new OnboardingError("BUILDING_NOT_FOUND", "Building not found");

  const allTyped = files.map((f) => ({ ...f, type: detectDocumentType(f.fileName, f.text) }));

  // Multi-building guardrail: never merge more than one building's reports into a
  // single building. A confirmed split (distinct identities) is always blocked;
  // an ambiguous one (duplicate docs, no distinguishing identity) can be
  // overridden by the manager confirming it's a single building.
  const split = detectBuildingSplit(allTyped);
  if (split.multiple && !(split.ambiguous && opts.allowMultiBuilding)) {
    throw new OnboardingError("MULTIPLE_BUILDINGS", split.message);
  }

  const typedFiles = allTyped
    .filter((f) => f.type !== "UNKNOWN" && f.type !== "GENERAL_INFO")
    .sort((a, b) => COMMIT_ORDER[a.type] - COMMIT_ORDER[b.type]);

  const results: PackageCommitResultDTO["results"] = [];
  const warnings: string[] = [];

  for (const f of typedFiles) {
    try {
      if (f.type === "RENT_ROLL") {
        const r = await commitOnboarding(prisma, orgId, buildingId, f.text, {
          billingMode: opts.billingMode,
          actorUserId: opts.actorUserId,
          allowNewUnits: opts.allowNewUnits,
        });
        const skipNote = r.skippedNewUnits > 0 ? `, ${r.skippedNewUnits} new unit(s) skipped (not confirmed)` : "";
        if (r.skippedNewUnits > 0) {
          warnings.push(`${f.fileName}: ${r.skippedNewUnits} object(s) matched no existing unit and were skipped — re-import with "create new units" confirmed to add them.`);
        }
        results.push({
          fileName: f.fileName,
          type: f.type,
          outcome: `${r.created.units} unit(s), ${r.created.tenants} tenant(s), ${r.created.leases} lease(s)${skipNote}`,
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
        // BALANCE_SHEET / INCOME_STATEMENT → ingest, then approve so reporting is
        // populated immediately (the analyze step already reconciled the figures).
        // Approving posts the balance sheet to the ledger and lets the building's
        // yearly review substitute the imported income statement (Phase 1).
        const batch = await ingestStatement(prisma, {
          buffer: Buffer.from(f.text, "utf8"),
          fileName: f.fileName,
          mimeType: "text/csv",
          orgId,
          uploadedBy: opts.actorUserId ?? "system",
          buildingId,
          fiscalYear: opts.fiscalYear || undefined,
          isCsv: true,
        });
        let approved = 0;
        for (const s of batch.statements) {
          if (s.status !== "PENDING_REVIEW") continue;
          try {
            await approveStatement(prisma, s.id, orgId, opts.actorUserId ?? "system");
            approved += 1;
          } catch (e) {
            warnings.push(`${f.fileName}: ingested but not approved — ${errMsg(e)}`);
          }
        }
        results.push({
          fileName: f.fileName,
          type: f.type,
          outcome: approved > 0 ? "imported + approved" : "sent to review",
          detail: approved > 0 ? "Reporting populated." : "Approve it in Finance → Imports.",
        });
      }
    } catch (e) {
      results.push({ fileName: f.fileName, type: f.type, outcome: "failed", detail: errMsg(e) });
      warnings.push(`${f.fileName}: ${errMsg(e)}`);
    }
  }

  return { buildingId, fiscalYear: opts.fiscalYear, results, warnings };
}
