/**
 * ancillaryReconciliationService
 *
 * Phase 2: building cost pool (BillingPeriod + CostEntry) and distribution-key
 * apportionment of actual costs across leases. Replaces manual per-lease actual
 * cost entry. See docs/ANCILLARY_COSTS_RECONCILIATION.md.
 *
 * Supported keys in Phase 2: SURFACE_AREA, UNIT_COUNT, OCCUPANT_COUNT, FIXED_SHARE.
 * CONSUMPTION is deferred (needs meter readings) → flagged requiresManual.
 */

import { DistributionKey } from "@prisma/client";
import prisma from "./prismaClient";
import * as repo from "../repositories/billingPeriodRepository";

export const ADMIN_FEE_CAP_PERMILLE = 30; // 3%

// ─── DTOs ───────────────────────────────────────────────────────
export interface CostEntryDTO {
  id: string;
  categoryId: string;
  categoryCode: string;
  categoryName: string;
  billability: string;
  amountCents: number;
  sourceInvoiceId: string | null;
  note: string | null;
}

export interface BillingPeriodDTO {
  id: string;
  buildingId: string;
  buildingName: string | null;
  startDate: string;
  endDate: string;
  status: string;
  adminFeeRatePermille: number;
  totalCostsCents: number;
  totalBillableCostsCents: number;
  costEntries: CostEntryDTO[];
}

type PeriodRow = NonNullable<Awaited<ReturnType<typeof repo.findBillingPeriodById>>>;

export function mapBillingPeriodToDTO(p: PeriodRow): BillingPeriodDTO {
  const entries = p.costEntries.map((e) => ({
    id: e.id,
    categoryId: e.categoryId,
    categoryCode: e.category.code,
    categoryName: e.category.name,
    billability: e.category.billability,
    amountCents: e.amountCents,
    sourceInvoiceId: e.sourceInvoiceId,
    note: e.note,
  }));
  return {
    id: p.id,
    buildingId: p.buildingId,
    buildingName: p.building?.name ?? null,
    startDate: p.startDate.toISOString(),
    endDate: p.endDate.toISOString(),
    status: p.status,
    adminFeeRatePermille: p.adminFeeRatePermille,
    totalCostsCents: entries.reduce((s, e) => s + e.amountCents, 0),
    totalBillableCostsCents: entries.filter((e) => e.billability === "BILLABLE").reduce((s, e) => s + e.amountCents, 0),
    costEntries: entries,
  };
}

// ─── Distribution factor (clé de répartition) ───────────────────
/**
 * This participant's share [0..1] of a building cost under the given key.
 * Returns null when the basis can't be computed (no data, or CONSUMPTION).
 */
export function distributionFactor(
  participant: repo.LeaseParticipant,
  key: DistributionKey,
  participants: repo.LeaseParticipant[],
): number | null {
  switch (key) {
    case "UNIT_COUNT":
      return participants.length > 0 ? 1 / participants.length : null;
    case "SURFACE_AREA": {
      const total = participants.reduce((s, p) => s + (p.areaSqm ?? 0), 0);
      if (total <= 0 || participant.areaSqm == null) return null;
      return participant.areaSqm / total;
    }
    case "OCCUPANT_COUNT": {
      const total = participants.reduce((s, p) => s + (p.occupantCount ?? 0), 0);
      if (total <= 0 || participant.occupantCount == null) return null;
      return participant.occupantCount / total;
    }
    case "FIXED_SHARE":
      return participant.fixedSharePermille != null ? participant.fixedSharePermille / 1000 : null;
    case "CONSUMPTION":
    default:
      return null; // metering deferred to a later phase
  }
}

export interface ApportionedLine {
  categoryId: string;
  categoryCode: string;
  categoryName: string;
  distributionKey: DistributionKey; // the effective key used (post-fallback)
  buildingActualCents: number;
  factor: number | null;
  actualShareCents: number | null;
  requiresManual: boolean; // true when even the fallback key can't be computed (no surface areas)
  usedConsumptionFallback: boolean; // true when a CONSUMPTION key was ventilated by surface area (no meters)
}

export interface ApportionmentResult {
  billingPeriodId: string;
  leaseId: string;
  lines: ApportionedLine[];
  billableShareCents: number; // sum of computable billable shares
  adminFeeCents: number;
  totalActualCostsCents: number; // billableShare + adminFee
}

/**
 * Apportion a billing period's BILLABLE building costs to one lease.
 * Non-billable categories are excluded (legal gate). The lease must be an
 * active participant on the building.
 */
export async function apportionForLease(
  orgId: string,
  billingPeriodId: string,
  leaseId: string,
): Promise<ApportionmentResult> {
  const period = await repo.findBillingPeriodById(prisma, billingPeriodId, orgId);
  if (!period) throw new Error("Billing period not found");

  const participants = await repo.findBuildingLeaseParticipants(prisma, orgId, period.buildingId);
  const me = participants.find((p) => p.leaseId === leaseId);
  if (!me) throw new Error("Lease is not an active participant on this building");

  // Per-building per-category distribution overrides (fallback: category default).
  const configRows = await repo.findBuildingDistribution(prisma, orgId, period.buildingId);
  const keyByCategory = new Map(configRows.map((r) => [r.categoryId, r.key]));

  // Sum building actuals per BILLABLE category.
  const perCategory = new Map<string, { code: string; name: string; key: DistributionKey; cents: number }>();
  for (const e of period.costEntries) {
    if (e.category.billability !== "BILLABLE") continue;
    const key = keyByCategory.get(e.categoryId) ?? e.category.defaultKey;
    const acc = perCategory.get(e.categoryId);
    if (acc) acc.cents += e.amountCents;
    else perCategory.set(e.categoryId, { code: e.category.code, name: e.category.name, key, cents: e.amountCents });
  }

  const lines: ApportionedLine[] = [];
  let billableShareCents = 0;
  for (const [categoryId, c] of perCategory) {
    // WS4: when a CONSUMPTION category has no meter data, ventilate by surface
    // area (flagged) instead of falling to "requiresManual" — so heating/water
    // still distribute. True per-unit metering remains deferred.
    let effectiveKey: DistributionKey = c.key;
    let factor = distributionFactor(me, effectiveKey, participants);
    let usedConsumptionFallback = false;
    if (factor == null && c.key === "CONSUMPTION") {
      effectiveKey = "SURFACE_AREA";
      factor = distributionFactor(me, effectiveKey, participants);
      usedConsumptionFallback = true;
    }
    const share = factor == null ? null : Math.round(c.cents * factor);
    if (share != null) billableShareCents += share;
    lines.push({
      categoryId,
      categoryCode: c.code,
      categoryName: c.name,
      distributionKey: effectiveKey,
      buildingActualCents: c.cents,
      factor,
      actualShareCents: share,
      requiresManual: factor == null,
      usedConsumptionFallback,
    });
  }

  const rate = Math.min(period.adminFeeRatePermille, ADMIN_FEE_CAP_PERMILLE);
  const adminFeeCents = Math.round((billableShareCents * rate) / 1000);

  return {
    billingPeriodId,
    leaseId,
    lines,
    billableShareCents,
    adminFeeCents,
    totalActualCostsCents: billableShareCents + adminFeeCents,
  };
}

// ─── Cost-pool CRUD ─────────────────────────────────────────────
export async function listPeriods(orgId: string, buildingId?: string): Promise<BillingPeriodDTO[]> {
  const rows = await repo.listBillingPeriods(prisma, orgId, buildingId);
  return rows.map(mapBillingPeriodToDTO);
}

export async function getPeriod(orgId: string, id: string): Promise<BillingPeriodDTO | null> {
  const p = await repo.findBillingPeriodById(prisma, id, orgId);
  return p ? mapBillingPeriodToDTO(p) : null;
}

export async function createPeriod(
  orgId: string,
  input: { buildingId: string; startDate: string; endDate: string; adminFeeRatePermille?: number },
): Promise<BillingPeriodDTO> {
  const building = await prisma.building.findFirst({ where: { id: input.buildingId, orgId } });
  if (!building) throw new Error("Building not found or wrong org");
  const start = new Date(input.startDate);
  const end = new Date(input.endDate);
  if (isNaN(start.getTime()) || isNaN(end.getTime()) || start >= end) {
    throw new Error("Invalid period: startDate must be before endDate");
  }
  assertAdminFeeCap(input.adminFeeRatePermille);
  const created = await repo.createBillingPeriod(prisma, orgId, {
    buildingId: input.buildingId,
    startDate: start,
    endDate: end,
    adminFeeRatePermille: input.adminFeeRatePermille,
  });
  return mapBillingPeriodToDTO(created);
}

export async function updatePeriod(
  orgId: string,
  id: string,
  input: { status?: string; adminFeeRatePermille?: number },
): Promise<BillingPeriodDTO> {
  const existing = await repo.findBillingPeriodById(prisma, id, orgId);
  if (!existing) throw new Error("Billing period not found");
  if (input.status !== undefined && !["OPEN", "CLOSED"].includes(input.status)) {
    throw new Error("status must be OPEN or CLOSED");
  }
  assertAdminFeeCap(input.adminFeeRatePermille);
  const updated = await repo.updateBillingPeriod(prisma, id, input);
  return mapBillingPeriodToDTO(updated);
}

export async function addCostEntry(
  orgId: string,
  billingPeriodId: string,
  input: { categoryId: string; amountCents: number; sourceInvoiceId?: string | null; note?: string | null },
): Promise<BillingPeriodDTO> {
  const period = await repo.findBillingPeriodById(prisma, billingPeriodId, orgId);
  if (!period) throw new Error("Billing period not found");
  if (period.status === "CLOSED") throw new Error("Cannot add cost entries to a CLOSED period");
  const category = await prisma.ancillaryCostCategory.findFirst({ where: { id: input.categoryId, orgId } });
  if (!category) throw new Error("Category not found or wrong org");
  await repo.createCostEntry(prisma, {
    billingPeriodId,
    categoryId: input.categoryId,
    amountCents: input.amountCents,
    sourceInvoiceId: input.sourceInvoiceId ?? null,
    note: input.note ?? null,
  });
  return (await getPeriod(orgId, billingPeriodId))!;
}

/**
 * Qualify an INCOMING invoice as a building cost: attribute it to the period's
 * building (if not already) and create a CostEntry linked to it. Atomic-ish.
 */
export async function qualifyInvoiceAsCost(
  orgId: string,
  billingPeriodId: string,
  input: { invoiceId: string; categoryId: string },
): Promise<BillingPeriodDTO> {
  const period = await repo.findBillingPeriodById(prisma, billingPeriodId, orgId);
  if (!period) throw new Error("Billing period not found");
  if (period.status === "CLOSED") throw new Error("Cannot add cost entries to a CLOSED period");

  const invoice = await prisma.invoice.findFirst({ where: { id: input.invoiceId, orgId } });
  if (!invoice) throw new Error("Invoice not found");
  if ((invoice as any).direction !== "INCOMING") throw new Error("Only incoming invoices can be qualified as building costs");

  const category = await prisma.ancillaryCostCategory.findFirst({ where: { id: input.categoryId, orgId } });
  if (!category) throw new Error("Category not found or wrong org");

  const already = await prisma.costEntry.findFirst({ where: { sourceInvoiceId: input.invoiceId, billingPeriod: { orgId } } });
  if (already) throw new Error("This invoice has already been qualified");

  // Attribute the invoice to the building if it isn't yet.
  if (!invoice.buildingId) {
    await prisma.invoice.update({ where: { id: invoice.id }, data: { buildingId: period.buildingId } });
  }

  await repo.createCostEntry(prisma, {
    billingPeriodId,
    categoryId: input.categoryId,
    amountCents: invoice.totalAmount ?? 0,
    sourceInvoiceId: invoice.id,
    note: invoice.invoiceNumber || invoice.description || null,
  });
  return (await getPeriod(orgId, billingPeriodId))!;
}

/**
 * WS2 — charge → cost-pool bridge. On approval of an invoice classified as a
 * CHARGE (Nebenkosten) with a building + ancillary charge category and no unit,
 * book it as an actual building cost. The period is resolved by the invoice date
 * (issue date, else creation date); an OPEN calendar-year period is auto-created
 * when none exists. Idempotent on sourceInvoiceId: a re-approval (or an edited
 * amount/category) updates the existing CostEntry rather than duplicating it.
 *
 * Best-effort: callers invoke this without blocking approval. It silently no-ops
 * when the invoice isn't a fully-classified charge, and throws only on a genuine
 * conflict (e.g. the resolved period is CLOSED) so the caller can log it.
 */
export async function bridgeChargeInvoiceToCostPool(orgId: string, invoiceId: string): Promise<void> {
  const invoice = await prisma.invoice.findFirst({ where: { id: invoiceId, orgId } });
  if (!invoice) return;
  if ((invoice as any).costNature !== "CHARGE") return; // direct cost / unclassified → not a pool entry
  const categoryId = (invoice as any).ancillaryCategoryId as string | null;
  if (!invoice.buildingId || !categoryId) return; // not fully classified yet

  const category = await prisma.ancillaryCostCategory.findFirst({ where: { id: categoryId, orgId } });
  if (!category) throw new Error("Charge category not found or wrong org");

  const amountCents = invoice.totalAmount ?? 0;
  const note = invoice.invoiceNumber || invoice.description || null;

  // Idempotent on sourceInvoiceId — keep the entry in sync on re-approval.
  const existing = await prisma.costEntry.findFirst({
    where: { sourceInvoiceId: invoiceId, billingPeriod: { orgId } },
    include: { billingPeriod: { select: { status: true } } },
  });
  if (existing) {
    if (existing.billingPeriod.status === "CLOSED") return; // settled — leave it
    await repo.updateCostEntry(prisma, existing.id, { amountCents, categoryId, note });
    return;
  }

  // Resolve the period by invoice date; auto-create an OPEN calendar-year period.
  const refDate = invoice.issueDate ?? invoice.createdAt;
  let period = await repo.findBillingPeriodForDate(prisma, orgId, invoice.buildingId, refDate);
  if (period && period.status === "CLOSED") {
    throw new Error("The billing period for this charge is CLOSED; reopen it or adjust the invoice date");
  }
  if (!period) {
    const year = refDate.getUTCFullYear();
    const start = new Date(Date.UTC(year, 0, 1, 0, 0, 0, 0));
    const end = new Date(Date.UTC(year, 11, 31, 23, 59, 59, 999));
    try {
      period = await repo.createBillingPeriod(prisma, orgId, { buildingId: invoice.buildingId, startDate: start, endDate: end });
    } catch (e: any) {
      if (e?.code !== "P2002") throw e; // a concurrent create won — re-fetch
      period = await repo.findBillingPeriodForDate(prisma, orgId, invoice.buildingId, refDate);
      if (!period || period.status === "CLOSED") throw e;
    }
  }

  await repo.createCostEntry(prisma, {
    billingPeriodId: period.id,
    categoryId,
    amountCents,
    sourceInvoiceId: invoice.id,
    note,
  });
}

export async function removeCostEntry(orgId: string, billingPeriodId: string, entryId: string): Promise<BillingPeriodDTO> {
  const period = await repo.findBillingPeriodById(prisma, billingPeriodId, orgId);
  if (!period) throw new Error("Billing period not found");
  if (period.status === "CLOSED") throw new Error("Cannot modify cost entries on a CLOSED period");
  const entry = await repo.findCostEntryById(prisma, entryId);
  if (!entry || entry.billingPeriodId !== billingPeriodId) throw new Error("Cost entry not found");
  await repo.deleteCostEntry(prisma, entryId);
  return (await getPeriod(orgId, billingPeriodId))!;
}

// ─── Per-building distribution config (v2 C2) ──────────────────
export interface DistributionConfigRowDTO {
  categoryId: string;
  categoryCode: string;
  categoryName: string;
  billability: string;
  key: DistributionKey;
  isDefault: boolean; // true = using the category default (no building override)
}

/**
 * All billable categories for the org with this building's resolved distribution
 * key. WS4: lazily auto-seeds a BuildingChargeDistribution row from the category
 * default for any category missing one, so the editor is never empty and the
 * config is persistent (a manager can then override per category).
 */
export async function getBuildingDistribution(orgId: string, buildingId: string): Promise<DistributionConfigRowDTO[]> {
  const building = await prisma.building.findFirst({ where: { id: buildingId, orgId }, select: { id: true } });
  if (!building) throw new Error("Building not found or wrong org");

  const [cats, rows] = await Promise.all([
    prisma.ancillaryCostCategory.findMany({ where: { orgId, isActive: true, billability: "BILLABLE" }, orderBy: { name: "asc" } }),
    repo.findBuildingDistribution(prisma, orgId, buildingId),
  ]);
  const byCat = new Map(rows.map((r) => [r.categoryId, r.key]));

  // Seed missing rows from category defaults (idempotent, ignores unique races).
  const missing = cats.filter((c) => !byCat.has(c.id));
  for (const c of missing) {
    try {
      await repo.upsertBuildingDistribution(prisma, orgId, buildingId, c.id, c.defaultKey);
      byCat.set(c.id, c.defaultKey);
    } catch (e: any) {
      if (e?.code !== "P2002") throw e;
      byCat.set(c.id, c.defaultKey);
    }
  }

  return cats.map((c) => ({
    categoryId: c.id,
    categoryCode: c.code,
    categoryName: c.name,
    billability: c.billability,
    key: byCat.get(c.id) ?? c.defaultKey,
    isDefault: false, // every category now has a persisted row
  }));
}

export async function setBuildingDistribution(
  orgId: string,
  buildingId: string,
  categoryId: string,
  key: DistributionKey,
): Promise<DistributionConfigRowDTO[]> {
  const building = await prisma.building.findFirst({ where: { id: buildingId, orgId } });
  if (!building) throw new Error("Building not found or wrong org");
  const category = await prisma.ancillaryCostCategory.findFirst({ where: { id: categoryId, orgId } });
  if (!category) throw new Error("Category not found or wrong org");
  await repo.upsertBuildingDistribution(prisma, orgId, buildingId, categoryId, key);
  return getBuildingDistribution(orgId, buildingId);
}

// ─── Unit reconciliation (v2 C4) ───────────────────────────────
export interface UnitReconciliationPreview {
  leaseId: string;
  tenantName: string | null;
  billingPeriodId: string;
  periodStart: string;
  periodEnd: string;
  advancesPaidCents: number;
  actualCostsCents: number; // apportioned billable share + admin fee
  adminFeeCents: number;
  deltaCents: number; // actual − advances (>0 tenant owes; <0 refund)
  isRefund: boolean;
  lines: ApportionedLine[];
}

async function activeLeaseForUnit(orgId: string, unitId: string) {
  return prisma.lease.findFirst({
    where: { orgId, unitId, status: "ACTIVE", isTemplate: false },
    select: { id: true, tenantName: true },
  });
}

/** Advances paid vs apportioned actual for a unit's active lease over a period. */
export async function getUnitReconciliationPreview(
  orgId: string,
  unitId: string,
  billingPeriodId: string,
): Promise<UnitReconciliationPreview> {
  const lease = await activeLeaseForUnit(orgId, unitId);
  if (!lease) throw new Error("No active lease on this unit");
  const period = await repo.findBillingPeriodById(prisma, billingPeriodId, orgId);
  if (!period) throw new Error("Billing period not found");

  const apportion = await apportionForLease(orgId, billingPeriodId, lease.id);
  const advancesPaidCents = await getChargesAdvancesPaidCents(orgId, lease.id, period.startDate, period.endDate);
  const actualCostsCents = apportion.totalActualCostsCents;
  const deltaCents = actualCostsCents - advancesPaidCents;

  return {
    leaseId: lease.id,
    tenantName: lease.tenantName,
    billingPeriodId,
    periodStart: period.startDate.toISOString(),
    periodEnd: period.endDate.toISOString(),
    advancesPaidCents,
    actualCostsCents,
    adminFeeCents: apportion.adminFeeCents,
    deltaCents,
    isRefund: deltaCents < 0,
    lines: apportion.lines,
  };
}

/**
 * Settle a unit's charges for a period: records a FINALIZED ChargeReconciliation
 * (single aggregate line: advances vs actual) and runs the existing settle engine
 * → a debit invoice (tenant owes) or a credit note (refund), plus the 30-day
 * inspection window. One reconciliation per lease per fiscal year.
 */
export async function settleUnitReconciliation(
  orgId: string,
  unitId: string,
  billingPeriodId: string,
) {
  const preview = await getUnitReconciliationPreview(orgId, unitId, billingPeriodId);
  const period = await repo.findBillingPeriodById(prisma, billingPeriodId, orgId);
  if (!period) throw new Error("Billing period not found");
  const fiscalYear = period.startDate.getUTCFullYear();

  const existing = await prisma.chargeReconciliation.findFirst({ where: { orgId, leaseId: preview.leaseId, fiscalYear } });
  if (existing) throw new Error(`A reconciliation already exists for this lease and ${fiscalYear}`);

  const recon = await prisma.chargeReconciliation.create({
    data: {
      orgId,
      leaseId: preview.leaseId,
      fiscalYear,
      status: "FINALIZED",
      billingPeriodId,
      adminFeeCents: preview.adminFeeCents,
      totalAcomptePaidCents: preview.advancesPaidCents,
      totalActualCostsCents: preview.actualCostsCents,
      balanceCents: preview.deltaCents,
      lineItems: {
        create: [{
          description: `Décompte de charges ${fiscalYear}`,
          chargeMode: "ACOMPTE",
          acomptePaidCents: preview.advancesPaidCents,
          actualCostCents: preview.actualCostsCents,
          balanceCents: preview.deltaCents,
        }],
      },
    },
  });

  // Reuse the settle engine (credit note / invoice + inspection window).
  const { settleReconciliation } = await import("./chargeReconciliationService");
  return settleReconciliation(prisma, recon.id, orgId);
}

// ─── Charges advances paid (v2 C3) ─────────────────────────────
/**
 * Total charges advance a tenant paid over [from, to] — the sum of all
 * isChargeAdvance line items on their issued OUTGOING (rent) invoices whose
 * billing period falls in the window.
 */
export async function getChargesAdvancesPaidCents(
  orgId: string,
  leaseId: string,
  from: Date,
  to: Date,
): Promise<number> {
  const agg = await prisma.invoiceLineItem.aggregate({
    where: {
      isChargeAdvance: true,
      invoice: {
        orgId,
        leaseId,
        direction: "OUTGOING",
        status: { not: "DRAFT" },
        billingPeriodStart: { gte: from, lte: to },
      },
    },
    _sum: { lineTotal: true },
  });
  return agg._sum.lineTotal ?? 0;
}

// ─── Flat-rate (forfait) calculation ───────────────────────────
export interface FlatRateResult {
  categoryId: string;
  distributionKey: DistributionKey;
  basisYears: number; // number of prior CLOSED periods used
  avgAnnualBuildingCents: number;
  factor: number | null;
  monthlyFlatRateCents: number | null;
  requiresManual: boolean;
}

/**
 * Suggested FLAT_RATE (forfait) monthly amount for a lease+category, per Swiss
 * practice: the average actual building cost of the preceding (up to 3) CLOSED
 * periods, apportioned to this lease, divided by 12. Inert (basisYears 0) until
 * cost-pool history exists. No reconciliation is produced for flat-rate charges.
 */
export async function calculateFlatRate(
  orgId: string,
  leaseId: string,
  categoryId: string,
): Promise<FlatRateResult> {
  const category = await prisma.ancillaryCostCategory.findFirst({ where: { id: categoryId, orgId } });
  if (!category) throw new Error("Category not found");
  const lease = await prisma.lease.findFirst({ where: { id: leaseId, orgId }, select: { unit: { select: { buildingId: true } } } });
  if (!lease?.unit?.buildingId) throw new Error("Lease or building not found");
  const buildingId = lease.unit.buildingId;

  const periods = await repo.findClosedBillingPeriodsForBuilding(prisma, orgId, buildingId, 3);
  const annualTotals = periods.map((p) =>
    p.costEntries.filter((e) => e.categoryId === categoryId).reduce((s, e) => s + e.amountCents, 0),
  );
  const basisYears = annualTotals.length;
  const avgAnnualBuildingCents = basisYears > 0 ? Math.round(annualTotals.reduce((s, v) => s + v, 0) / basisYears) : 0;

  const participants = await repo.findBuildingLeaseParticipants(prisma, orgId, buildingId);
  const me = participants.find((p) => p.leaseId === leaseId);
  const factor = me ? distributionFactor(me, category.defaultKey, participants) : null;
  const monthlyFlatRateCents = factor == null ? null : Math.round((avgAnnualBuildingCents * factor) / 12);

  return {
    categoryId,
    distributionKey: category.defaultKey,
    basisYears,
    avgAnnualBuildingCents,
    factor,
    monthlyFlatRateCents,
    requiresManual: factor == null,
  };
}

function assertAdminFeeCap(permille?: number): void {
  if (permille != null && (permille < 0 || permille > ADMIN_FEE_CAP_PERMILLE)) {
    throw new Error(`adminFeeRatePermille must be between 0 and ${ADMIN_FEE_CAP_PERMILLE} (3%)`);
  }
}
