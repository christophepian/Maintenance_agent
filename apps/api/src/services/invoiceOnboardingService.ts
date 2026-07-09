/**
 * Invoice onboarding — hydrate a building's expense history from a régie
 * general-ledger (grand livre) CSV.
 *
 * Extracts discrete third-party contractor invoices (see regieLedgerMapper),
 * attributes each to the building (and unit, when the row is unit-scoped),
 * classifies it under an expense account matching the régie account code, and
 * — on commit — creates an INCOMING invoice, issues it at its historical date,
 * and posts the accrual to the ledger so it feeds the building's NOI for that
 * fiscal year. Reporting substitution (imported income statement) still wins for
 * years that have one, so covered years are never double-counted.
 *
 * Idempotent: each imported invoice carries `paymentReference = "GL:<no_piece>"`;
 * a re-commit skips piece numbers already present on the building.
 */

import { PrismaClient } from "@prisma/client";
import * as inventoryRepo from "../repositories/inventoryRepository";
import * as invoiceRepo from "../repositories/invoiceRepository";
import * as billingEntityRepo from "../repositories/billingEntityRepository";
import { findAccountByOrgAndCode, upsertAccount } from "../repositories/accountRepository";
import { createInvoice, updateInvoice, issueInvoice } from "./invoices";
import { postInvoiceIssued } from "./ledgerService";
import { writeAuditLog } from "./auditLog";
import { mapRegieLedger } from "./regieLedgerMapper";
import { OnboardingError } from "./buildingOnboardingService";

const REF_PREFIX = "GL:";
const PAYABLE_CODE = "2000";

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
  posted: number;
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
    await invoiceRepo.findBuildingInvoicePaymentRefs(prisma, orgId, buildingId, REF_PREFIX),
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
  const existingRefs = new Set(
    await invoiceRepo.findBuildingInvoicePaymentRefs(prisma, orgId, buildingId, REF_PREFIX),
  );

  // Resolve the ORG billing entity once — issuing an invoice requires it, and
  // ensure the payable account exists so the accrual posting doesn't skip.
  const orgBillingEntity = await billingEntityRepo.findOrgBillingEntity(prisma, orgId);
  await ensureExpenseAccount(prisma, orgId, PAYABLE_CODE, "Kreditoren"); // idempotent; keeps a real code
  if (!orgBillingEntity) {
    errors.push(
      "No organisation billing entity found — invoices were created but could not be issued or posted to the ledger.",
    );
  }

  let created = 0;
  let posted = 0;
  let skipped = 0;

  const accountCache = new Map<string, string>(); // compte → accountId

  for (const r of invoices) {
    const ref = `${REF_PREFIX}${r.noPiece}`;
    if (existingRefs.has(ref)) {
      skipped += 1;
      continue;
    }

    try {
      // Expense account by régie code (cached per commit).
      let accountId = accountCache.get(r.compte);
      if (!accountId) {
        const acc = await ensureExpenseAccount(prisma, orgId, r.compte, r.accountName);
        accountId = acc.id;
        accountCache.set(r.compte, accountId);
      }

      const unitId = r.unitNumber ? unitByNumber.get(r.unitNumber) ?? null : null;

      // 1. Create the INCOMING invoice (rappen preserved via a single VAT-free line).
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

      // 2. Attribute to building (and unit when known).
      await updateInvoice(invoice.id, { buildingId, unitId });
      existingRefs.add(ref);
      created += 1;

      // 3. Issue at the historical date + post the accrual so it feeds NOI.
      if (orgBillingEntity && r.date) {
        try {
          const issued = await issueInvoice(invoice.id, {
            issuerBillingEntityId: orgBillingEntity.id,
            issueDate: r.date,
          });
          const result = await postInvoiceIssued(prisma, orgId, issued);
          if (result) posted += 1;
        } catch (e) {
          errors.push(`Piece ${r.noPiece}: created but not posted — ${e instanceof Error ? e.message : String(e)}`);
        }
      }
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
    metadata: { created, posted, skipped },
  }).catch(() => {});

  return { buildingId, created, posted, skippedAlreadyImported: skipped, errors };
}
