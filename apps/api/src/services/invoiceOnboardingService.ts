/**
 * Invoice onboarding — hydrate a building's expense history from a régie
 * general-ledger (grand livre) CSV.
 *
 * Extracts discrete third-party contractor invoices (see regieLedgerMapper),
 * attributes each to the building (and unit, when the row is unit-scoped),
 * links a deduplicated vendor Contractor (so reporting can rank spend by
 * vendor), and classifies it under an expense account matching the régie code.
 *
 * REFERENCE-ONLY: the invoices are NOT posted to the ledger. A régie year-end
 * package's imported balance sheet + income statement are the financial source
 * of truth for those historical years (reporting substitution already serves
 * NOI from the imported income statement). Posting the invoices would double-
 * count the imported bilan's payables and unbalance the balance sheet by the
 * P&L result, so onboarded invoices exist purely as attributed records for
 * per-unit maintenance history and vendor-spend analytics.
 *
 * Idempotent + self-healing: each imported invoice carries
 * `paymentReference = "GL:<no_piece>"`; a re-commit skips piece numbers already
 * present, reverses any ledger accrual a prior (posting) import left behind, and
 * backfills the vendor link on existing rows.
 */

import { PrismaClient } from "@prisma/client";
import * as inventoryRepo from "../repositories/inventoryRepository";
import * as invoiceRepo from "../repositories/invoiceRepository";
import * as contractorRepo from "../repositories/contractorRepository";
import * as ledgerRepo from "../repositories/ledgerEntryRepository";
import { findAccountByOrgAndCode, upsertAccount } from "../repositories/accountRepository";
import { createInvoice, updateInvoice } from "./invoices";
import { createContractor } from "./contractors";
import { writeAuditLog } from "./auditLog";
import { mapRegieLedger } from "./regieLedgerMapper";
import { OnboardingError } from "./buildingOnboardingService";

const REF_PREFIX = "GL:";
const REVERSIBLE_SOURCE_TYPES = ["INVOICE_ISSUED", "INVOICE_PAID"];

/* ── DTOs ─────────────────────────────────────────────────────────────────── */

export interface InvoiceOnboardingPreviewLine {
  compte: string;
  accountName: string;
  date: string | null; // ISO
  noPiece: string;
  vendorName: string;
  description: string;
  amountChf: number;
  unitNumber: string | null; // from the objet prefix
  matchedUnitNumber: string | null; // existing unit it will attribute to (null = building-level)
  alreadyImported: boolean; // a prior commit already created this piece
}

export interface InvoiceOnboardingPreviewDTO {
  buildingId: string;
  buildingName: string;
  summary: {
    total: number;
    newInvoices: number;
    alreadyImported: number;
    unitAttributed: number;
    totalChf: number;
    byAccount: { compte: string; accountName: string; count: number; totalChf: number }[];
  };
  invoices: InvoiceOnboardingPreviewLine[];
  warnings: string[];
}

export interface InvoiceOnboardingCommitResult {
  buildingId: string;
  created: number;
  vendorsLinked: number;
  reversedLedgerEntries: number; // accrual postings a prior import left behind
  skippedAlreadyImported: number;
  errors: string[];
}

/* ── helpers ──────────────────────────────────────────────────────────────── */

/** Find or create an EXPENSE account for the régie account code. */
async function ensureExpenseAccount(prisma: PrismaClient, orgId: string, code: string, name: string) {
  const existing = await findAccountByOrgAndCode(prisma, orgId, code);
  if (existing) return existing;
  return upsertAccount(prisma, orgId, name, { code, accountType: "EXPENSE" });
}

/** Deterministic, non-dialable sentinels so a vendor Contractor provisions cleanly. */
function synthVendorContact(orgId: string, name: string): { phone: string; email: string; slug: string } {
  const key = `${orgId}|${name.trim().toLowerCase()}`;
  let h = 0;
  for (let i = 0; i < key.length; i++) h = (Math.imul(h, 31) + key.charCodeAt(i)) >>> 0;
  const slug = name.trim().toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "") || "vendor";
  return {
    phone: `+41${String(h % 1_000_000_000).padStart(9, "0")}`,
    email: `${slug}.${h.toString(36)}@imported.vendor`,
    slug,
  };
}

/** Find (by deterministic email) or create a vendor Contractor; returns its id. */
async function ensureVendorContractor(
  prisma: PrismaClient,
  orgId: string,
  name: string,
  cache: Map<string, string>,
): Promise<string> {
  const cached = cache.get(name);
  if (cached) return cached;
  const contact = synthVendorContact(orgId, name);
  const existing = await contractorRepo.findContractorByOrgAndEmail(prisma, contact.email, orgId);
  const id = existing
    ? existing.id
    : (
        await createContractor(prisma, orgId, {
          name,
          phone: contact.phone,
          email: contact.email,
          serviceCategories: ["IMPORTED"],
        })
      ).id;
  cache.set(name, id);
  return id;
}

/** unitNumber → existing unit id, from active + inactive units (exact match). */
async function buildUnitLookup(prisma: PrismaClient, orgId: string, buildingId: string) {
  const units = await inventoryRepo.listUnits(prisma, orgId, buildingId, true);
  const byNumber = new Map<string, string>();
  for (const u of units) {
    if (!byNumber.has(u.unitNumber)) byNumber.set(u.unitNumber, u.id);
  }
  return byNumber;
}

const isoDate = (d: Date | null): string | null => (d ? d.toISOString().slice(0, 10) : null);

/* ── preview ──────────────────────────────────────────────────────────────── */

export async function previewInvoiceOnboarding(
  prisma: PrismaClient,
  orgId: string,
  buildingId: string,
  csvText: string,
): Promise<InvoiceOnboardingPreviewDTO> {
  const building = await inventoryRepo.findBuildingByIdAndOrg(prisma, buildingId, orgId);
  if (!building) throw new OnboardingError("BUILDING_NOT_FOUND", "Building not found");

  const { invoices, skipped, summary } = mapRegieLedger(csvText);
  const warnings = [...skipped];

  const unitByNumber = await buildUnitLookup(prisma, orgId, buildingId);
  const existingRefs = new Set(
    (await invoiceRepo.findBuildingImportedInvoices(prisma, orgId, buildingId, REF_PREFIX)).map(
      (i) => i.paymentReference,
    ),
  );

  let newInvoices = 0;
  let alreadyImported = 0;
  let unmatchedUnits = 0;

  const lines: InvoiceOnboardingPreviewLine[] = invoices.map((r) => {
    const matchedUnitId = r.unitNumber ? unitByNumber.get(r.unitNumber) : undefined;
    const matchedUnitNumber = matchedUnitId ? r.unitNumber : null;
    if (r.unitNumber && !matchedUnitId) unmatchedUnits += 1;
    const already = existingRefs.has(`${REF_PREFIX}${r.noPiece}`);
    if (already) alreadyImported += 1;
    else newInvoices += 1;
    return {
      compte: r.compte,
      accountName: r.accountName,
      date: isoDate(r.date),
      noPiece: r.noPiece,
      vendorName: r.vendorName,
      description: r.description,
      amountChf: r.amountChf,
      unitNumber: r.unitNumber,
      matchedUnitNumber,
      alreadyImported: already,
    };
  });

  if (unmatchedUnits > 0) {
    warnings.push(
      `${unmatchedUnits} invoice(s) reference a unit that doesn't exist on this building yet — they'll be attributed to the building only. Onboard the rent roll first to attribute them per unit.`,
    );
  }

  return {
    buildingId,
    buildingName: building.name,
    summary: {
      total: summary.total,
      newInvoices,
      alreadyImported,
      unitAttributed: summary.unitAttributed,
      totalChf: summary.totalChf,
      byAccount: summary.byAccount,
    },
    invoices: lines,
    warnings,
  };
}

/* ── commit ───────────────────────────────────────────────────────────────── */

export async function commitInvoiceOnboarding(
  prisma: PrismaClient,
  orgId: string,
  buildingId: string,
  csvText: string,
  opts: { actorUserId?: string } = {},
): Promise<InvoiceOnboardingCommitResult> {
  const building = await inventoryRepo.findBuildingByIdAndOrg(prisma, buildingId, orgId);
  if (!building) throw new OnboardingError("BUILDING_NOT_FOUND", "Building not found");

  const { invoices } = mapRegieLedger(csvText);
  const errors: string[] = [];

  const unitByNumber = await buildUnitLookup(prisma, orgId, buildingId);
  const existing = await invoiceRepo.findBuildingImportedInvoices(prisma, orgId, buildingId, REF_PREFIX);
  const existingRefs = new Set(existing.map((i) => i.paymentReference));

  // Heal prior (posting) imports: reverse any ledger accrual left on already-
  // imported invoices so the balance sheet isn't corrupted by phantom payables.
  const reversedLedgerEntries = await ledgerRepo.deleteLedgerEntriesBySource(
    prisma,
    orgId,
    existing.map((i) => i.id),
    REVERSIBLE_SOURCE_TYPES,
  );

  const accountCache = new Map<string, string>(); // compte → accountId
  const vendorCache = new Map<string, string>(); // vendorName → contractorId
  let created = 0;
  let vendorsLinked = 0;
  let skipped = 0;

  // Backfill the vendor link on already-imported invoices missing one.
  for (const inv of existing) {
    if (inv.contractorId) continue;
    // Match the ref back to a parsed row to recover the vendor name.
    const row = invoices.find((r) => `${REF_PREFIX}${r.noPiece}` === inv.paymentReference);
    if (!row) continue;
    try {
      const contractorId = await ensureVendorContractor(prisma, orgId, row.vendorName, vendorCache);
      await updateInvoice(inv.id, { contractorId });
      vendorsLinked += 1;
    } catch (e) {
      errors.push(`Piece ${row.noPiece}: vendor link failed — ${e instanceof Error ? e.message : String(e)}`);
    }
  }

  for (const r of invoices) {
    const ref = `${REF_PREFIX}${r.noPiece}`;
    if (existingRefs.has(ref)) {
      skipped += 1;
      continue;
    }

    try {
      let accountId = accountCache.get(r.compte);
      if (!accountId) {
        const acc = await ensureExpenseAccount(prisma, orgId, r.compte, r.accountName);
        accountId = acc.id;
        accountCache.set(r.compte, accountId);
      }
      const contractorId = await ensureVendorContractor(prisma, orgId, r.vendorName, vendorCache);
      const unitId = r.unitNumber ? unitByNumber.get(r.unitNumber) ?? null : null;

      // Create the INCOMING invoice (rappen preserved via a single VAT-free line).
      // No issuer billing entity: the vendor is the issuer (issuerName), and these
      // are reference records, not invoices we issue.
      const invoice = await createInvoice({
        orgId,
        description: `${r.vendorName} / ${r.description}`.slice(0, 500),
        issuerName: r.vendorName,
        issueDate: r.date ?? undefined,
        direction: "INCOMING",
        sourceChannel: "BROWSER_UPLOAD",
        ingestionStatus: "CONFIRMED",
        paymentReference: ref,
        accountId,
        currency: "CHF",
        vatRate: 0,
        lineItems: [{ description: r.description || r.vendorName, quantity: 1, unitPrice: r.amountChf, vatRate: 0 }],
      });

      // Attribute to building/unit/vendor (reference-only — no ledger posting).
      await updateInvoice(invoice.id, { buildingId, unitId, contractorId });
      existingRefs.add(ref);
      created += 1;
      vendorsLinked += 1;
    } catch (e) {
      errors.push(`Piece ${r.noPiece} (${r.vendorName}): ${e instanceof Error ? e.message : String(e)}`);
    }
  }

  await writeAuditLog(prisma, {
    orgId,
    actorUserId: opts.actorUserId ?? null,
    action: "BUILDING_INVOICES_ONBOARDED",
    entityType: "Building",
    entityId: buildingId,
    metadata: { created, vendorsLinked, reversedLedgerEntries, skipped },
  });

  return {
    buildingId,
    created,
    vendorsLinked,
    reversedLedgerEntries,
    skippedAlreadyImported: skipped,
    errors,
  };
}
