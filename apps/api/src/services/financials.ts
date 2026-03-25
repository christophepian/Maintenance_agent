import { ExpenseCategory } from "@prisma/client";
import prisma from "./prismaClient";

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

export interface AccountTotalDTO {
  accountId: string;
  accountName: string;
  accountCode: string | null;
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

  // Income breakdown (projected, from lease terms)
  rentalIncomeCents: number;
  serviceChargeIncomeCents: number;

  // Point-in-time balances
  receivablesCents: number; // ISSUED unpaid lease invoices
  payablesCents: number;    // ISSUED/APPROVED unpaid job invoices

  // KPIs
  maintenanceRatio: number;
  costPerUnitCents: number;
  collectionRate: number;

  // Breakdowns
  activeUnitsCount: number;
  expensesByCategory: ExpenseCategoryTotalDTO[];
  topContractorsBySpend: ContractorSpendDTO[];
  expensesByAccount?: AccountTotalDTO[];
}

// ==========================================
// Internal helpers
// ==========================================

/** End of a calendar day in UTC — used for inclusive date-range queries */
function endOfDayUTC(date: Date): Date {
  return new Date(date.toISOString().slice(0, 10) + "T23:59:59.999Z");
}

/** Safe division: returns 0 if denominator is 0 */
function safeDivide(numerator: number, denominator: number): number {
  return denominator === 0 ? 0 : numerator / denominator;
}

// ==========================================
// Ledger-based queries (Option B — single source of truth)
// ==========================================

interface ExpenseLedgerRow {
  debitCents: number;
  sourceId: string | null;
  accountId: string;
  account: { name: string; code: string | null };
}

/**
 * Return all INVOICE_ISSUED expense-account debit entries for this building
 * in [from, endOfDay(to)].  Each row = one leg of a cost invoice journal entry.
 */
async function getExpenseLedgerEntries(
  orgId: string,
  buildingId: string,
  from: Date,
  to: Date,
): Promise<ExpenseLedgerRow[]> {
  const rows = await prisma.ledgerEntry.findMany({
    where: {
      orgId,
      buildingId,
      sourceType: "INVOICE_ISSUED",
      date: { gte: from, lte: endOfDayUTC(to) },
      debitCents: { gt: 0 },
      account: { accountType: "EXPENSE" },
    },
    select: {
      debitCents: true,
      sourceId: true,
      accountId: true,
      account: { select: { name: true, code: true } },
    },
  });
  return rows as ExpenseLedgerRow[];
}

/**
 * Sum of cash received for this building: INVOICE_PAID entries that debit
 * the bank account (code 1020) in [from, endOfDay(to)].
 * For rent invoices paid: Dr Bank(1020) / Cr Receivables(1100) → bank debit = income.
 * For cost invoices paid: Dr Payables(2000) / Cr Bank(1020) → bank credit only, not captured here.
 */
async function getEarnedIncomeFromLedger(
  orgId: string,
  buildingId: string,
  from: Date,
  to: Date,
): Promise<number> {
  const agg = await prisma.ledgerEntry.aggregate({
    where: {
      orgId,
      buildingId,
      sourceType: "INVOICE_PAID",
      date: { gte: from, lte: endOfDayUTC(to) },
      debitCents: { gt: 0 },
      account: { code: "1020" },
    },
    _sum: { debitCents: true },
  });
  return agg._sum.debitCents ?? 0;
}

// ==========================================
// Projected income (from lease terms — unchanged)
// ==========================================

async function getProjectedIncome(
  orgId: string,
  unitIds: string[],
  from: Date,
  to: Date,
): Promise<{ projectedIncomeCents: number; rentalIncomeCents: number; serviceChargeIncomeCents: number }> {
  if (unitIds.length === 0) {
    return { projectedIncomeCents: 0, rentalIncomeCents: 0, serviceChargeIncomeCents: 0 };
  }

  const activeLeases = await prisma.lease.findMany({
    where: {
      orgId,
      unitId: { in: unitIds },
      status: { in: ["ACTIVE", "SIGNED"] },
      startDate: { lt: to },
      OR: [{ endDate: null }, { endDate: { gte: from } }],
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

  const periodDays = (to.getTime() - from.getTime()) / (1000 * 60 * 60 * 24);
  let rentalIncomeCents = 0;
  let serviceChargeIncomeCents = 0;

  for (const lease of activeLeases) {
    const overlapStart = new Date(Math.max(lease.startDate.getTime(), from.getTime()));
    const overlapEnd = new Date(Math.min(
      lease.endDate ? lease.endDate.getTime() : to.getTime(),
      to.getTime(),
    ));
    const overlapDays = Math.max(
      0,
      (overlapEnd.getTime() - overlapStart.getTime()) / (1000 * 60 * 60 * 24),
    );
    const prorate = safeDivide(overlapDays, periodDays);

    rentalIncomeCents += Math.round(
      (lease.netRentChf + (lease.garageRentChf ?? 0) + (lease.otherServiceRentChf ?? 0)) * 100 * prorate,
    );
    serviceChargeIncomeCents += Math.round((lease.chargesTotalChf ?? 0) * 100 * prorate);
  }

  return {
    projectedIncomeCents: rentalIncomeCents + serviceChargeIncomeCents,
    rentalIncomeCents,
    serviceChargeIncomeCents,
  };
}

// ==========================================
// Point-in-time balances
// ==========================================

async function getReceivables(orgId: string, buildingId: string): Promise<number> {
  const units = await prisma.unit.findMany({
    where: { buildingId, orgId, isActive: true },
    select: { id: true },
  });
  const unitIds = units.map((u) => u.id);
  if (unitIds.length === 0) return 0;

  const result = await prisma.invoice.aggregate({
    where: { orgId, status: "ISSUED", lease: { unitId: { in: unitIds } } },
    _sum: { totalAmount: true },
  });
  // totalAmount is stored in cents in the DB
  return result._sum.totalAmount ?? 0;
}

async function getPayables(orgId: string, buildingId: string): Promise<number> {
  const units = await prisma.unit.findMany({
    where: { buildingId, orgId, isActive: true },
    select: { id: true },
  });
  const unitIds = units.map((u) => u.id);
  if (unitIds.length === 0) return 0;

  const result = await prisma.invoice.aggregate({
    where: {
      orgId,
      status: { in: ["ISSUED", "APPROVED"] },
      job: { request: { unitId: { in: unitIds } } },
    },
    _sum: { totalAmount: true },
  });
  // totalAmount is stored in cents in the DB
  return result._sum.totalAmount ?? 0;
}

// ==========================================
// Main entry point
// ==========================================

export async function getBuildingFinancials(
  orgId: string,
  buildingId: string,
  params: { from: string; to: string; forceRefresh?: boolean; groupByAccount?: boolean },
): Promise<BuildingFinancialsDTO> {
  // 1. Validate building exists and belongs to org
  const building = await prisma.building.findFirst({
    where: { id: buildingId, orgId },
    select: { id: true, name: true },
  });
  if (!building) throw new NotFoundError(`Building ${buildingId} not found`);

  // 2. Parse dates — from = start of day, to comparison uses endOfDayUTC in queries
  const from = new Date(params.from + "T00:00:00.000Z");
  const to = new Date(params.to + "T00:00:00.000Z");
  if (isNaN(from.getTime()) || isNaN(to.getTime()))
    throw new ValidationError("Invalid date format. Use YYYY-MM-DD.");
  if (from >= to)
    throw new ValidationError("'from' must be before 'to'.");

  // 2b. Check snapshot cache (unless forceRefresh or groupByAccount)
  if (!params.forceRefresh && !params.groupByAccount) {
    const cached = await prisma.buildingFinancialSnapshot.findUnique({
      where: {
        orgId_buildingId_periodStart_periodEnd: {
          orgId,
          buildingId,
          periodStart: from,
          periodEnd: to,
        },
      },
    });
    if (cached) {
      return {
        buildingId,
        buildingName: building.name,
        from: params.from,
        to: params.to,
        earnedIncomeCents: cached.earnedIncomeCents,
        projectedIncomeCents: cached.projectedIncomeCents,
        expensesTotalCents: cached.expensesTotalCents,
        maintenanceTotalCents: cached.maintenanceTotalCents,
        capexTotalCents: cached.capexTotalCents,
        operatingTotalCents: cached.operatingTotalCents,
        netIncomeCents: cached.netIncomeCents,
        netOperatingIncomeCents: cached.netOperatingIncomeCents,
        rentalIncomeCents: 0,
        serviceChargeIncomeCents: 0,
        receivablesCents: 0,
        payablesCents: 0,
        maintenanceRatio: 0,
        costPerUnitCents: 0,
        collectionRate: 0,
        activeUnitsCount: cached.activeUnitsCount,
        expensesByCategory: [],
        topContractorsBySpend: [],
      };
    }
  }

  // 3. Active units (for count + receivables/payables)
  const units = await prisma.unit.findMany({
    where: { buildingId, orgId, isActive: true },
    select: { id: true },
  });
  const unitIds = units.map((u) => u.id);
  const activeUnitsCount = unitIds.length;

  // 4. Expense ledger entries — INVOICE_ISSUED debit legs on EXPENSE accounts
  const expenseEntries = await getExpenseLedgerEntries(orgId, buildingId, from, to);

  // 5. Aggregate expense totals and account breakdown in one pass
  let expensesTotalCents = 0;
  const accountTotals = new Map<string, { name: string; code: string | null; total: number }>();

  for (const entry of expenseEntries) {
    expensesTotalCents += entry.debitCents;
    const acc = accountTotals.get(entry.accountId);
    if (acc) {
      acc.total += entry.debitCents;
    } else {
      accountTotals.set(entry.accountId, {
        name: entry.account.name,
        code: entry.account.code,
        total: entry.debitCents,
      });
    }
  }

  // 6. Category + contractor breakdowns via batch invoice lookup (sourceId = invoiceId)
  const invoiceIds = [
    ...new Set(
      expenseEntries.map((e) => e.sourceId).filter((id): id is string => id !== null),
    ),
  ];

  let maintenanceTotalCents = 0;
  let capexTotalCents = 0;
  const categoryTotals = new Map<ExpenseCategory, number>();
  const contractorTotals = new Map<string, { name: string; total: number }>();

  if (invoiceIds.length > 0) {
    // Sum debitCents per invoice (in case an invoice has multiple expense legs)
    const invoiceAmounts = new Map<string, number>();
    for (const entry of expenseEntries) {
      if (!entry.sourceId) continue;
      invoiceAmounts.set(entry.sourceId, (invoiceAmounts.get(entry.sourceId) ?? 0) + entry.debitCents);
    }

    const invoices = await prisma.invoice.findMany({
      where: { id: { in: invoiceIds }, orgId },
      select: {
        id: true,
        expenseCategory: true,
        job: {
          select: {
            contractorId: true,
            contractor: { select: { id: true, name: true } },
          },
        },
      },
    });

    for (const inv of invoices) {
      const amountCents = invoiceAmounts.get(inv.id) ?? 0;
      if (amountCents === 0) continue;

      const category = inv.expenseCategory ?? ExpenseCategory.MAINTENANCE;
      categoryTotals.set(category, (categoryTotals.get(category) ?? 0) + amountCents);

      if (category === ExpenseCategory.MAINTENANCE) maintenanceTotalCents += amountCents;
      if (category === ExpenseCategory.CAPEX) capexTotalCents += amountCents;

      const cId = inv.job?.contractorId;
      if (cId) {
        const existing = contractorTotals.get(cId);
        if (existing) {
          existing.total += amountCents;
        } else {
          contractorTotals.set(cId, {
            name: inv.job?.contractor?.name ?? cId,
            total: amountCents,
          });
        }
      }
    }
  }

  // 7. Earned income from ledger (rent payments: bank debit on INVOICE_PAID)
  const earnedIncomeCents = await getEarnedIncomeFromLedger(orgId, buildingId, from, to);

  // 8. Projected income from active leases (prorated)
  const incomeBreakdown = await getProjectedIncome(orgId, unitIds, from, to);

  // 9. Point-in-time outstanding balances
  const [receivablesCents, payablesCents] = await Promise.all([
    getReceivables(orgId, buildingId),
    getPayables(orgId, buildingId),
  ]);

  // 10. Derived totals and KPIs
  const operatingTotalCents = expensesTotalCents - capexTotalCents;
  const netIncomeCents = earnedIncomeCents - expensesTotalCents;
  const netOperatingIncomeCents = earnedIncomeCents - operatingTotalCents;
  const maintenanceRatio = safeDivide(maintenanceTotalCents, earnedIncomeCents);
  const costPerUnitCents = Math.round(safeDivide(expensesTotalCents, activeUnitsCount));
  const collectionRate = safeDivide(earnedIncomeCents, incomeBreakdown.projectedIncomeCents);

  // 11. Format breakdown arrays
  const expensesByCategory: ExpenseCategoryTotalDTO[] = Array.from(categoryTotals.entries())
    .map(([category, totalCents]) => ({ category, totalCents }))
    .sort((a, b) => b.totalCents - a.totalCents);

  const topContractorsBySpend: ContractorSpendDTO[] = Array.from(contractorTotals.entries())
    .map(([contractorId, { name, total }]) => ({
      contractorId,
      contractorName: name,
      totalCents: total,
    }))
    .sort((a, b) => b.totalCents - a.totalCents)
    .slice(0, 10);

  const expensesByAccount: AccountTotalDTO[] | undefined = params.groupByAccount
    ? Array.from(accountTotals.entries())
        .map(([accountId, { name, code, total }]) => ({
          accountId,
          accountName: name,
          accountCode: code,
          totalCents: total,
        }))
        .sort((a, b) => b.totalCents - a.totalCents)
    : undefined;

  // 12. Persist snapshot (upsert keyed on org+building+period)
  await prisma.buildingFinancialSnapshot.upsert({
    where: {
      orgId_buildingId_periodStart_periodEnd: {
        orgId,
        buildingId,
        periodStart: from,
        periodEnd: to,
      },
    },
    update: {
      earnedIncomeCents,
      projectedIncomeCents: incomeBreakdown.projectedIncomeCents,
      expensesTotalCents,
      maintenanceTotalCents,
      capexTotalCents,
      operatingTotalCents,
      netIncomeCents,
      netOperatingIncomeCents,
      activeUnitsCount,
      computedAt: new Date(),
    },
    create: {
      orgId,
      buildingId,
      periodStart: from,
      periodEnd: to,
      earnedIncomeCents,
      projectedIncomeCents: incomeBreakdown.projectedIncomeCents,
      expensesTotalCents,
      maintenanceTotalCents,
      capexTotalCents,
      operatingTotalCents,
      netIncomeCents,
      netOperatingIncomeCents,
      activeUnitsCount,
      computedAt: new Date(),
    },
  });

  return {
    buildingId,
    buildingName: building.name,
    from: params.from,
    to: params.to,
    earnedIncomeCents,
    projectedIncomeCents: incomeBreakdown.projectedIncomeCents,
    expensesTotalCents,
    maintenanceTotalCents,
    capexTotalCents,
    operatingTotalCents,
    netIncomeCents,
    netOperatingIncomeCents,
    rentalIncomeCents: incomeBreakdown.rentalIncomeCents,
    serviceChargeIncomeCents: incomeBreakdown.serviceChargeIncomeCents,
    receivablesCents,
    payablesCents,
    maintenanceRatio: Math.round(maintenanceRatio * 10000) / 10000,
    costPerUnitCents,
    collectionRate: Math.round(collectionRate * 10000) / 10000,
    activeUnitsCount,
    expensesByCategory,
    topContractorsBySpend,
    ...(expensesByAccount !== undefined && { expensesByAccount }),
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
  receivablesCents: number;
  payablesCents: number;
}

export interface PortfolioSummaryDTO {
  from: string;
  to: string;
  totalEarnedIncomeCents: number;
  totalExpensesCents: number;
  totalNetIncomeCents: number;
  avgCollectionRate: number;
  avgMaintenanceRatio: number;
  totalActiveUnits: number;
  buildingsInRed: number;
  buildingCount: number;
  totalReceivablesCents: number;
  totalPayablesCents: number;
  buildings: BuildingSummaryDTO[];
}

function deriveHealth(netIncomeCents: number, collectionRate: number): "green" | "amber" | "red" {
  if (netIncomeCents < 0 || collectionRate < 0.8) return "red";
  if (netIncomeCents === 0 || collectionRate < 0.95) return "amber";
  return "green";
}

export async function getPortfolioSummary(
  orgId: string,
  params: { from: string; to: string },
): Promise<PortfolioSummaryDTO> {
  const buildings = await prisma.building.findMany({
    where: { orgId },
    select: { id: true, name: true },
    orderBy: { name: "asc" },
  });

  const summaries: BuildingSummaryDTO[] = [];
  for (const building of buildings) {
    try {
      const dto = await getBuildingFinancials(orgId, building.id, {
        from: params.from,
        to: params.to,
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
        receivablesCents: dto.receivablesCents,
        payablesCents: dto.payablesCents,
      });
    } catch (e) {
      console.warn(`[portfolio-summary] Skipping building ${building.id}: ${e}`);
    }
  }

  const totalEarned = summaries.reduce((s, b) => s + b.earnedIncomeCents, 0);
  const totalExpenses = summaries.reduce((s, b) => s + b.expensesTotalCents, 0);
  const totalNet = summaries.reduce((s, b) => s + b.netIncomeCents, 0);
  const totalUnits = summaries.reduce((s, b) => s + b.activeUnitsCount, 0);
  const active = summaries.filter((b) => b.earnedIncomeCents > 0 || b.expensesTotalCents > 0);
  const avgCollection = active.length > 0
    ? active.reduce((s, b) => s + b.collectionRate, 0) / active.length : 0;
  const avgMaintenance = active.length > 0
    ? active.reduce((s, b) => s + b.maintenanceRatio, 0) / active.length : 0;

  return {
    from: params.from,
    to: params.to,
    totalEarnedIncomeCents: totalEarned,
    totalExpensesCents: totalExpenses,
    totalNetIncomeCents: totalNet,
    avgCollectionRate: Math.round(avgCollection * 10000) / 10000,
    avgMaintenanceRatio: Math.round(avgMaintenance * 10000) / 10000,
    totalActiveUnits: totalUnits,
    buildingsInRed: summaries.filter((b) => b.health === "red").length,
    buildingCount: summaries.length,
    totalReceivablesCents: summaries.reduce((s, b) => s + b.receivablesCents, 0),
    totalPayablesCents: summaries.reduce((s, b) => s + b.payablesCents, 0),
    buildings: summaries,
  };
}

// ==========================================
// Set expense category on an invoice
// ==========================================

export async function setInvoiceExpenseCategory(
  invoiceId: string,
  orgId: string,
  category: ExpenseCategory,
): Promise<{ id: string; expenseCategory: ExpenseCategory }> {
  const invoice = await prisma.invoice.findFirst({
    where: { id: invoiceId, orgId },
    select: { id: true, jobId: true, expenseCategory: true, job: { select: { requestId: true } } },
  });
  if (!invoice) throw new NotFoundError(`Invoice ${invoiceId} not found`);

  if (invoice.job?.requestId) {
    throw new ConflictError(
      "Cannot re-categorize a job-linked invoice. Job invoices are automatically classified as MAINTENANCE.",
    );
  }

  const updated = await prisma.invoice.update({
    where: { id: invoiceId },
    data: { expenseCategory: category },
    select: { id: true, expenseCategory: true },
  });

  return { id: updated.id, expenseCategory: updated.expenseCategory! };
}

// ==========================================
// Custom error classes
// ==========================================

export class NotFoundError extends Error {
  constructor(message: string) { super(message); this.name = "NotFoundError"; }
}

export class ValidationError extends Error {
  constructor(message: string) { super(message); this.name = "ValidationError"; }
}

export class ConflictError extends Error {
  constructor(message: string) { super(message); this.name = "ConflictError"; }
}
