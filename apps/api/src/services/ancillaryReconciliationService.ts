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
  distributionKey: DistributionKey;
  buildingActualCents: number;
  factor: number | null;
  actualShareCents: number | null;
  requiresManual: boolean; // true when the key can't be auto-computed (e.g. CONSUMPTION / missing data)
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
    const factor = distributionFactor(me, c.key, participants);
    const share = factor == null ? null : Math.round(c.cents * factor);
    if (share != null) billableShareCents += share;
    lines.push({
      categoryId,
      categoryCode: c.code,
      categoryName: c.name,
      distributionKey: c.key,
      buildingActualCents: c.cents,
      factor,
      actualShareCents: share,
      requiresManual: factor == null,
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

/** All billable categories for the org with this building's resolved distribution key. */
export async function getBuildingDistribution(orgId: string, buildingId: string): Promise<DistributionConfigRowDTO[]> {
  const [cats, rows] = await Promise.all([
    prisma.ancillaryCostCategory.findMany({ where: { orgId, isActive: true, billability: "BILLABLE" }, orderBy: { name: "asc" } }),
    repo.findBuildingDistribution(prisma, orgId, buildingId),
  ]);
  const byCat = new Map(rows.map((r) => [r.categoryId, r.key]));
  return cats.map((c) => ({
    categoryId: c.id,
    categoryCode: c.code,
    categoryName: c.name,
    billability: c.billability,
    key: byCat.get(c.id) ?? c.defaultKey,
    isDefault: !byCat.has(c.id),
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
