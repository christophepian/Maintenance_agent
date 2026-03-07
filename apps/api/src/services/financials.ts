import { ExpenseCategory } from "@prisma/client";
import prisma from "./prismaClient";

// ==========================================
// G9: Canonical include for financial snapshot queries
// ==========================================
export const FINANCIAL_SNAPSHOT_INCLUDE = {} as const;

// ==========================================
// DTOs
// ==========================================
export interface ExpenseCategoryTotalDTO {
  category: ExpenseCategory;
  totalCents: number;
}

export interface ContractorSpendDTO {
  contractorId: string;
  contractorName: string;
  totalCents: number;
}

export interface BuildingFinancialsDTO {
  buildingId: string;
  buildingName: string;
  from: string; // ISO date
  to: string; // ISO date

  // Core totals (all in cents)
  earnedIncomeCents: number;
  projectedIncomeCents: number;
  expensesTotalCents: number;
  maintenanceTotalCents: number;
  capexTotalCents: number;
  operatingTotalCents: number;
  netIncomeCents: number;
  netOperatingIncomeCents: number;

  // KPIs
  maintenanceRatio: number;
  costPerUnitCents: number;
  collectionRate: number;

  // Breakdowns
  activeUnitsCount: number;
  expensesByCategory: ExpenseCategoryTotalDTO[];
  topContractorsBySpend: ContractorSpendDTO[];
}

// ==========================================
// Internal helpers
// ==========================================

/** Break a [from, to) range into monthly buckets: [monthStart, monthEnd) */
function getMonthBuckets(
  from: Date,
  to: Date
): Array<{ start: Date; end: Date }> {
  const buckets: Array<{ start: Date; end: Date }> = [];
  let cursor = new Date(
    Date.UTC(from.getUTCFullYear(), from.getUTCMonth(), 1)
  );
  const endLimit = to;

  while (cursor < endLimit) {
    const monthStart = new Date(
      Math.max(cursor.getTime(), from.getTime())
    );
    const nextMonth = new Date(
      Date.UTC(cursor.getUTCFullYear(), cursor.getUTCMonth() + 1, 1)
    );
    const monthEnd = new Date(
      Math.min(nextMonth.getTime(), endLimit.getTime())
    );

    if (monthStart < monthEnd) {
      buckets.push({ start: monthStart, end: monthEnd });
    }
    cursor = nextMonth;
  }
  return buckets;
}

/** Safe division: returns 0 if denominator is 0 */
function safeDivide(numerator: number, denominator: number): number {
  return denominator === 0 ? 0 : numerator / denominator;
}

/**
 * Compute financial data for a single month bucket for a building.
 * All money values are in integer cents.
 */
async function computeMonthSnapshot(
  orgId: string,
  buildingId: string,
  periodStart: Date,
  periodEnd: Date
): Promise<{
  earnedIncomeCents: number;
  projectedIncomeCents: number;
  expensesTotalCents: number;
  maintenanceTotalCents: number;
  capexTotalCents: number;
  operatingTotalCents: number;
  netIncomeCents: number;
  netOperatingIncomeCents: number;
  activeUnitsCount: number;
}> {
  // 1. Get all units for this building
  const units = await prisma.unit.findMany({
    where: { buildingId, orgId, isActive: true },
    select: { id: true },
  });
  const unitIds = units.map((u) => u.id);
  const activeUnitsCount = unitIds.length;

  // 2. Earned income: sum of invoice payments where paidAt is within [periodStart, periodEnd)
  //    Only paid invoices linked to leases for units in this building
  const paidInvoices = await prisma.invoice.findMany({
    where: {
      orgId,
      status: "PAID",
      paidAt: { gte: periodStart, lt: periodEnd },
      lease: { unitId: { in: unitIds } },
    },
    select: { totalAmount: true },
  });
  // totalAmount is stored in cents in the DB
  const earnedIncomeCents = paidInvoices.reduce(
    (sum, inv) => sum + inv.totalAmount,
    0
  );

  // 3. Projected income: expected rent from active leases overlapping this period
  //    Prorate for partial months
  const activeLeases = await prisma.lease.findMany({
    where: {
      orgId,
      unitId: { in: unitIds },
      status: { in: ["ACTIVE", "SIGNED"] },
      startDate: { lt: periodEnd },
      OR: [{ endDate: null }, { endDate: { gte: periodStart } }],
      deletedAt: null,
    },
    select: {
      netRentChf: true,
      garageRentChf: true,
      otherServiceRentChf: true,
      chargesTotalChf: true,
      startDate: true,
      endDate: true,
    },
  });

  let projectedIncomeCents = 0;
  const periodDays =
    (periodEnd.getTime() - periodStart.getTime()) / (1000 * 60 * 60 * 24);

  for (const lease of activeLeases) {
    // Total monthly rent in CHF → cents
    const monthlyRentCents =
      (lease.netRentChf + (lease.garageRentChf ?? 0) + (lease.otherServiceRentChf ?? 0) + (lease.chargesTotalChf ?? 0)) * 100;

    // Prorate: overlap days / total period days
    const overlapStart = new Date(
      Math.max(lease.startDate.getTime(), periodStart.getTime())
    );
    const overlapEnd = new Date(
      Math.min(
        lease.endDate ? lease.endDate.getTime() : periodEnd.getTime(),
        periodEnd.getTime()
      )
    );
    const overlapDays =
      Math.max(
        0,
        (overlapEnd.getTime() - overlapStart.getTime()) / (1000 * 60 * 60 * 24)
      );
    const prorateFraction = safeDivide(overlapDays, periodDays);
    projectedIncomeCents += Math.round(monthlyRentCents * prorateFraction);
  }

  // 4. Expenses: sum of paid invoices linked to jobs for units in this building
  //    Categorized by expenseCategory (null = MAINTENANCE for job-linked invoices)
  const expenseInvoices = await prisma.invoice.findMany({
    where: {
      orgId,
      status: { in: ["APPROVED", "PAID"] },
      paidAt: { gte: periodStart, lt: periodEnd },
      job: {
        request: {
          unitId: { in: unitIds },
        },
      },
    },
    select: {
      totalAmount: true,
      expenseCategory: true,
    },
  });

  let expensesTotalCents = 0;
  let maintenanceTotalCents = 0;
  let capexTotalCents = 0;

  for (const inv of expenseInvoices) {
    const amount = inv.totalAmount;
    // Job-linked invoices with no explicit category → MAINTENANCE
    const category = inv.expenseCategory ?? ExpenseCategory.MAINTENANCE;
    expensesTotalCents += amount;

    if (category === ExpenseCategory.MAINTENANCE) {
      maintenanceTotalCents += amount;
    }
    if (category === ExpenseCategory.CAPEX) {
      capexTotalCents += amount;
    }
  }

  const operatingTotalCents = expensesTotalCents - capexTotalCents;
  const netIncomeCents = earnedIncomeCents - expensesTotalCents;
  const netOperatingIncomeCents = earnedIncomeCents - operatingTotalCents;

  return {
    earnedIncomeCents,
    projectedIncomeCents,
    expensesTotalCents,
    maintenanceTotalCents,
    capexTotalCents,
    operatingTotalCents,
    netIncomeCents,
    netOperatingIncomeCents,
    activeUnitsCount,
  };
}

// ==========================================
// Snapshot management
// ==========================================

/** Load or compute a snapshot for a specific month bucket */
async function getOrComputeSnapshot(
  orgId: string,
  buildingId: string,
  periodStart: Date,
  periodEnd: Date,
  forceRefresh: boolean
): Promise<{
  earnedIncomeCents: number;
  projectedIncomeCents: number;
  expensesTotalCents: number;
  maintenanceTotalCents: number;
  capexTotalCents: number;
  operatingTotalCents: number;
  netIncomeCents: number;
  netOperatingIncomeCents: number;
  activeUnitsCount: number;
}> {
  if (!forceRefresh) {
    const existing = await prisma.buildingFinancialSnapshot.findUnique({
      where: {
        orgId_buildingId_periodStart_periodEnd: {
          orgId,
          buildingId,
          periodStart,
          periodEnd,
        },
      },
    });
    if (existing) {
      return {
        earnedIncomeCents: existing.earnedIncomeCents,
        projectedIncomeCents: existing.projectedIncomeCents,
        expensesTotalCents: existing.expensesTotalCents,
        maintenanceTotalCents: existing.maintenanceTotalCents,
        capexTotalCents: existing.capexTotalCents,
        operatingTotalCents: existing.operatingTotalCents,
        netIncomeCents: existing.netIncomeCents,
        netOperatingIncomeCents: existing.netOperatingIncomeCents,
        activeUnitsCount: existing.activeUnitsCount,
      };
    }
  }

  // Compute fresh
  const computed = await computeMonthSnapshot(
    orgId,
    buildingId,
    periodStart,
    periodEnd
  );

  // Upsert snapshot
  await prisma.buildingFinancialSnapshot.upsert({
    where: {
      orgId_buildingId_periodStart_periodEnd: {
        orgId,
        buildingId,
        periodStart,
        periodEnd,
      },
    },
    update: {
      ...computed,
      computedAt: new Date(),
    },
    create: {
      orgId,
      buildingId,
      periodStart,
      periodEnd,
      ...computed,
      computedAt: new Date(),
    },
  });

  return computed;
}

// ==========================================
// Expense breakdown (non-cached — computed live)
// ==========================================

async function getExpensesByCategory(
  orgId: string,
  buildingId: string,
  from: Date,
  to: Date
): Promise<ExpenseCategoryTotalDTO[]> {
  const units = await prisma.unit.findMany({
    where: { buildingId, orgId, isActive: true },
    select: { id: true },
  });
  const unitIds = units.map((u) => u.id);

  const invoices = await prisma.invoice.findMany({
    where: {
      orgId,
      status: { in: ["APPROVED", "PAID"] },
      paidAt: { gte: from, lt: to },
      job: { request: { unitId: { in: unitIds } } },
    },
    select: { totalAmount: true, expenseCategory: true },
  });

  const catMap = new Map<ExpenseCategory, number>();
  for (const inv of invoices) {
    const cat = inv.expenseCategory ?? ExpenseCategory.MAINTENANCE;
    catMap.set(cat, (catMap.get(cat) ?? 0) + inv.totalAmount);
  }

  return Array.from(catMap.entries())
    .map(([category, totalCents]) => ({ category, totalCents }))
    .sort((a, b) => b.totalCents - a.totalCents);
}

async function getTopContractorsBySpend(
  orgId: string,
  buildingId: string,
  from: Date,
  to: Date,
  limit = 10
): Promise<ContractorSpendDTO[]> {
  const units = await prisma.unit.findMany({
    where: { buildingId, orgId, isActive: true },
    select: { id: true },
  });
  const unitIds = units.map((u) => u.id);

  const invoices = await prisma.invoice.findMany({
    where: {
      orgId,
      status: { in: ["APPROVED", "PAID"] },
      paidAt: { gte: from, lt: to },
      job: { request: { unitId: { in: unitIds } } },
    },
    select: {
      totalAmount: true,
      job: {
        select: {
          contractorId: true,
          contractor: { select: { id: true, name: true } },
        },
      },
    },
  });

  const contractorMap = new Map<
    string,
    { contractorId: string; contractorName: string; totalCents: number }
  >();
  for (const inv of invoices) {
    const cId = inv.job.contractorId;
    const existing = contractorMap.get(cId);
    if (existing) {
      existing.totalCents += inv.totalAmount;
    } else {
      contractorMap.set(cId, {
        contractorId: cId,
        contractorName: inv.job.contractor.name,
        totalCents: inv.totalAmount,
      });
    }
  }

  return Array.from(contractorMap.values())
    .sort((a, b) => b.totalCents - a.totalCents)
    .slice(0, limit);
}

// ==========================================
// Main entry point
// ==========================================

export async function getBuildingFinancials(
  orgId: string,
  buildingId: string,
  params: { from: string; to: string; forceRefresh?: boolean }
): Promise<BuildingFinancialsDTO> {
  // 1. Validate building exists and belongs to org
  const building = await prisma.building.findFirst({
    where: { id: buildingId, orgId },
    select: { id: true, name: true },
  });
  if (!building) {
    throw new NotFoundError(`Building ${buildingId} not found`);
  }

  // 2. Parse dates (ISO strings → Date objects)
  const from = new Date(params.from + "T00:00:00.000Z");
  const to = new Date(params.to + "T00:00:00.000Z");

  if (isNaN(from.getTime()) || isNaN(to.getTime())) {
    throw new ValidationError("Invalid date format. Use YYYY-MM-DD.");
  }
  if (from >= to) {
    throw new ValidationError(
      "'from' must be before 'to'. Period is [from, to) exclusive."
    );
  }

  const forceRefresh = params.forceRefresh ?? false;

  // 3. Break range into monthly buckets and aggregate
  const buckets = getMonthBuckets(from, to);

  let totalEarned = 0;
  let totalProjected = 0;
  let totalExpenses = 0;
  let totalMaintenance = 0;
  let totalCapex = 0;
  let totalOperating = 0;
  let totalNetIncome = 0;
  let totalNetOperating = 0;
  let maxActiveUnits = 0;

  for (const bucket of buckets) {
    const snap = await getOrComputeSnapshot(
      orgId,
      buildingId,
      bucket.start,
      bucket.end,
      forceRefresh
    );
    totalEarned += snap.earnedIncomeCents;
    totalProjected += snap.projectedIncomeCents;
    totalExpenses += snap.expensesTotalCents;
    totalMaintenance += snap.maintenanceTotalCents;
    totalCapex += snap.capexTotalCents;
    totalOperating += snap.operatingTotalCents;
    totalNetIncome += snap.netIncomeCents;
    totalNetOperating += snap.netOperatingIncomeCents;
    if (snap.activeUnitsCount > maxActiveUnits) {
      maxActiveUnits = snap.activeUnitsCount;
    }
  }

  // 4. Compute live breakdowns (not cached in snapshot)
  const [expensesByCategory, topContractorsBySpend] = await Promise.all([
    getExpensesByCategory(orgId, buildingId, from, to),
    getTopContractorsBySpend(orgId, buildingId, from, to),
  ]);

  // 5. Compute KPIs
  const maintenanceRatio = safeDivide(totalMaintenance, totalEarned);
  const costPerUnitCents = Math.round(
    safeDivide(totalExpenses, maxActiveUnits)
  );
  const collectionRate = safeDivide(totalEarned, totalProjected);

  return {
    buildingId,
    buildingName: building.name,
    from: params.from,
    to: params.to,
    earnedIncomeCents: totalEarned,
    projectedIncomeCents: totalProjected,
    expensesTotalCents: totalExpenses,
    maintenanceTotalCents: totalMaintenance,
    capexTotalCents: totalCapex,
    operatingTotalCents: totalOperating,
    netIncomeCents: totalNetIncome,
    netOperatingIncomeCents: totalNetOperating,
    maintenanceRatio: Math.round(maintenanceRatio * 10000) / 10000, // 4 decimal places
    costPerUnitCents,
    collectionRate: Math.round(collectionRate * 10000) / 10000,
    activeUnitsCount: maxActiveUnits,
    expensesByCategory,
    topContractorsBySpend,
  };
}

// ==========================================
// Portfolio summary (all buildings)
// ==========================================

export interface BuildingSummaryDTO {
  buildingId: string;
  buildingName: string;
  health: "green" | "amber" | "red";
  earnedIncomeCents: number;
  expensesTotalCents: number;
  netIncomeCents: number;
  collectionRate: number;
  maintenanceRatio: number;
  activeUnitsCount: number;
}

export interface PortfolioSummaryDTO {
  from: string;
  to: string;
  // Aggregates
  totalEarnedIncomeCents: number;
  totalExpensesCents: number;
  totalNetIncomeCents: number;
  avgCollectionRate: number;
  avgMaintenanceRatio: number;
  totalActiveUnits: number;
  buildingsInRed: number;
  buildingCount: number;
  // Per-building
  buildings: BuildingSummaryDTO[];
}

function deriveHealth(
  netIncomeCents: number,
  collectionRate: number
): "green" | "amber" | "red" {
  // Red: negative net income OR collection rate < 80%
  if (netIncomeCents < 0 || collectionRate < 0.8) return "red";
  // Amber: break-even OR collection rate < 95%
  if (netIncomeCents === 0 || collectionRate < 0.95) return "amber";
  return "green";
}

export async function getPortfolioSummary(
  orgId: string,
  params: { from: string; to: string }
): Promise<PortfolioSummaryDTO> {
  // 1. Get all buildings for this org
  const buildings = await prisma.building.findMany({
    where: { orgId },
    select: { id: true, name: true },
    orderBy: { name: "asc" },
  });

  // 2. Fetch financials for each building (reuses snapshot cache)
  const summaries: BuildingSummaryDTO[] = [];
  for (const building of buildings) {
    try {
      const dto = await getBuildingFinancials(orgId, building.id, {
        from: params.from,
        to: params.to,
        forceRefresh: false,
      });
      summaries.push({
        buildingId: dto.buildingId,
        buildingName: dto.buildingName,
        health: deriveHealth(dto.netIncomeCents, dto.collectionRate),
        earnedIncomeCents: dto.earnedIncomeCents,
        expensesTotalCents: dto.expensesTotalCents,
        netIncomeCents: dto.netIncomeCents,
        collectionRate: dto.collectionRate,
        maintenanceRatio: dto.maintenanceRatio,
        activeUnitsCount: dto.activeUnitsCount,
      });
    } catch (e) {
      // Skip buildings that fail (e.g. no units)
      console.warn(`[portfolio-summary] Skipping building ${building.id}: ${e}`);
    }
  }

  // 3. Compute aggregates
  const totalEarned = summaries.reduce((s, b) => s + b.earnedIncomeCents, 0);
  const totalExpenses = summaries.reduce((s, b) => s + b.expensesTotalCents, 0);
  const totalNet = summaries.reduce((s, b) => s + b.netIncomeCents, 0);
  const totalUnits = summaries.reduce((s, b) => s + b.activeUnitsCount, 0);
  const buildingsWithIncome = summaries.filter((b) => b.earnedIncomeCents > 0 || b.expensesTotalCents > 0);
  const avgCollection = buildingsWithIncome.length > 0
    ? buildingsWithIncome.reduce((s, b) => s + b.collectionRate, 0) / buildingsWithIncome.length
    : 0;
  const avgMaintenance = buildingsWithIncome.length > 0
    ? buildingsWithIncome.reduce((s, b) => s + b.maintenanceRatio, 0) / buildingsWithIncome.length
    : 0;
  const buildingsInRed = summaries.filter((b) => b.health === "red").length;

  return {
    from: params.from,
    to: params.to,
    totalEarnedIncomeCents: totalEarned,
    totalExpensesCents: totalExpenses,
    totalNetIncomeCents: totalNet,
    avgCollectionRate: Math.round(avgCollection * 10000) / 10000,
    avgMaintenanceRatio: Math.round(avgMaintenance * 10000) / 10000,
    totalActiveUnits: totalUnits,
    buildingsInRed,
    buildingCount: summaries.length,
    buildings: summaries,
  };
}

// ==========================================
// Set expense category on an invoice
// ==========================================

export async function setInvoiceExpenseCategory(
  invoiceId: string,
  orgId: string,
  category: ExpenseCategory
): Promise<{ id: string; expenseCategory: ExpenseCategory }> {
  // 1. Find invoice with its job relation
  const invoice = await prisma.invoice.findFirst({
    where: { id: invoiceId, orgId },
    select: {
      id: true,
      jobId: true,
      expenseCategory: true,
      job: {
        select: { requestId: true },
      },
    },
  });

  if (!invoice) {
    throw new NotFoundError(`Invoice ${invoiceId} not found`);
  }

  // 2. Job-linked invoices cannot be re-categorized (they're always MAINTENANCE)
  if (invoice.job.requestId) {
    throw new ConflictError(
      "Cannot re-categorize a job-linked invoice. Job invoices are automatically classified as MAINTENANCE."
    );
  }

  // 3. Update category
  const updated = await prisma.invoice.update({
    where: { id: invoiceId },
    data: { expenseCategory: category },
    select: { id: true, expenseCategory: true },
  });

  return {
    id: updated.id,
    expenseCategory: updated.expenseCategory!,
  };
}

// ==========================================
// Custom error classes
// ==========================================

export class NotFoundError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "NotFoundError";
  }
}

export class ValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ValidationError";
  }
}

export class ConflictError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ConflictError";
  }
}
