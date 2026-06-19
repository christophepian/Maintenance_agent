import { ExpenseCategory } from "@prisma/client";
import prisma from "./prismaClient";
import * as invoiceRepo from "../repositories/invoiceRepository";
import * as inventoryRepo from "../repositories/inventoryRepository";
import * as leaseRepo from "../repositories/leaseRepository";
import * as snapshotRepo from "../repositories/buildingFinancialSnapshotRepository";
import * as financialsRepo from "../repositories/financialsRepository";
import * as dailySnapshotRepo from "../repositories/portfolioDailySnapshotRepository";
import type { ExpenseLedgerRow, ArrearsAgingDTO } from "../repositories/financialsRepository";

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
  totalUnitsCount: number;
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
  return financialsRepo.findExpenseLedgerEntries(prisma, orgId, buildingId, from, to);
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
  return financialsRepo.aggregateLedgerIncome(prisma, orgId, buildingId, from, to);
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

  const activeLeases = await leaseRepo.findActiveLeasesForProjection(prisma, orgId, unitIds, from, to);

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
  const unitIds = await inventoryRepo.findActiveUnitIdsByBuilding(prisma, orgId, buildingId);
  if (unitIds.length === 0) return 0;

  return invoiceRepo.aggregateIssuedInvoicesForUnits(prisma, orgId, unitIds);
}

async function getPayables(orgId: string, buildingId: string): Promise<number> {
  const unitIds = await inventoryRepo.findActiveUnitIdsByBuilding(prisma, orgId, buildingId);
  if (unitIds.length === 0) return 0;

  return invoiceRepo.aggregatePayableInvoicesForUnits(prisma, orgId, unitIds);
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
  const building = await inventoryRepo.findBuildingByIdAndOrg(prisma, buildingId, orgId);
  if (!building) throw new NotFoundError(`Building ${buildingId} not found`);

  // 2. Parse dates — from = start of day, to comparison uses endOfDayUTC in queries
  const from = new Date(params.from + "T00:00:00.000Z");
  const to = new Date(params.to + "T00:00:00.000Z");
  if (isNaN(from.getTime()) || isNaN(to.getTime()))
    throw new ValidationError("Invalid date format. Use YYYY-MM-DD.");
  if (from >= to)
    throw new ValidationError("'from' must be before 'to'.");

  // 2b. Check snapshot cache — bypass for any period that overlaps the current
  //     calendar month so live payments are always reflected without a force-refresh.
  const startOfCurrentMonth = new Date();
  startOfCurrentMonth.setUTCDate(1);
  startOfCurrentMonth.setUTCHours(0, 0, 0, 0);
  const periodOverlapsCurrentMonth = to >= startOfCurrentMonth;

  if (!params.forceRefresh && !params.groupByAccount && !periodOverlapsCurrentMonth) {
    const cached = await snapshotRepo.findBuildingFinancialSnapshotByPeriod(prisma, orgId, buildingId, from, to);
    if (cached) {
      const [cachedTotalUnits, cachedActiveUnits] = await Promise.all([
        inventoryRepo.countTotalUnitsByBuilding(prisma, orgId, buildingId),
        inventoryRepo.countLeasedUnitsByBuilding(prisma, orgId, buildingId, from, to),
      ]);
      const cachedCollectionRate = Math.min(1, safeDivide(cached.earnedIncomeCents, cached.projectedIncomeCents));
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
        collectionRate: cachedCollectionRate,
        activeUnitsCount: cachedActiveUnits,
        totalUnitsCount: cachedTotalUnits,
        expensesByCategory: [],
        topContractorsBySpend: [],
      };
    }
  }

  const [unitIds, totalUnitsCount, activeUnitsCount] = await Promise.all([
    inventoryRepo.findActiveUnitIdsByBuilding(prisma, orgId, buildingId),
    inventoryRepo.countTotalUnitsByBuilding(prisma, orgId, buildingId),
    inventoryRepo.countLeasedUnitsByBuilding(prisma, orgId, buildingId, from, to),
  ]);

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

    const invoices = await invoiceRepo.findInvoicesForExpenseBreakdown(prisma, orgId, invoiceIds);

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

  // 9b. Invoice-based collection rate — scoped to billing period, not payment date.
  //     Comparing paid/invoiced by billing period means catching up 3 months of
  //     backlogged payments in one go doesn't push the rate above 100 %.
  const [invoicedForPeriodCents, paidForPeriodCents] = await Promise.all([
    financialsRepo.aggregateInvoicedRentForPeriod(prisma, orgId, buildingId, from, to),
    financialsRepo.aggregatePaidRentForPeriod(prisma, orgId, buildingId, from, to),
  ]);

  // 10. Derived totals and KPIs
  const operatingTotalCents = expensesTotalCents - capexTotalCents;
  const netIncomeCents = earnedIncomeCents - expensesTotalCents;
  const netOperatingIncomeCents = earnedIncomeCents - operatingTotalCents;
  const maintenanceRatio = safeDivide(maintenanceTotalCents, earnedIncomeCents);
  const costPerUnitCents = Math.round(safeDivide(expensesTotalCents, activeUnitsCount));
  // Invoice-billing-period rate capped at 100% to prevent catch-up payments
  // inflating the rate above 1.0 when the fallback formula fires.
  const collectionRate = Math.min(1, invoicedForPeriodCents > 0
    ? safeDivide(paidForPeriodCents, invoicedForPeriodCents)
    : safeDivide(earnedIncomeCents, incomeBreakdown.projectedIncomeCents));

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
  await snapshotRepo.upsertBuildingFinancialSnapshot(prisma, orgId, buildingId, from, to, {
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
    totalUnitsCount,
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
  projectedIncomeCents: number;
  expensesTotalCents: number;
  operatingTotalCents: number;
  capexTotalCents: number;
  netIncomeCents: number;
  netOperatingIncomeCents: number;
  collectionRate: number;
  maintenanceRatio: number;
  activeUnitsCount: number;
  totalUnitsCount: number;
  receivablesCents: number;
  payablesCents: number;
}

export interface MonthlyBreakdownDTO {
  month: number; // 1–12
  earnedIncomeCents: number;
  expensesTotalCents: number;
  noiCents: number;
  collectionRate: number;
}

export interface PortfolioSummaryDTO {
  from: string;
  to: string;
  totalEarnedIncomeCents: number;
  totalProjectedIncomeCents: number;
  totalExpensesCents: number;
  totalOperatingCents: number;
  totalCapexCents: number;
  totalNetIncomeCents: number;
  totalNetOperatingIncomeCents: number;
  avgCollectionRate: number;
  avgMaintenanceRatio: number;
  totalActiveUnits: number;
  totalUnits: number;
  buildingsInRed: number;
  buildingCount: number;
  totalReceivablesCents: number;
  totalPayablesCents: number;
  arrears: ArrearsAgingDTO;
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
  ownerId?: string,
): Promise<PortfolioSummaryDTO> {
  const buildings = await inventoryRepo.listBuildings(prisma, orgId, undefined, ownerId);

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
        projectedIncomeCents: dto.projectedIncomeCents,
        expensesTotalCents: dto.expensesTotalCents,
        operatingTotalCents: dto.operatingTotalCents,
        capexTotalCents: dto.capexTotalCents,
        netIncomeCents: dto.netIncomeCents,
        netOperatingIncomeCents: dto.netOperatingIncomeCents,
        collectionRate: dto.collectionRate,
        maintenanceRatio: dto.maintenanceRatio,
        activeUnitsCount: dto.activeUnitsCount,
        totalUnitsCount: dto.totalUnitsCount,
        receivablesCents: dto.receivablesCents,
        payablesCents: dto.payablesCents,
      });
    } catch (e) {
      console.warn(`[portfolio-summary] Skipping building ${building.id}: ${e}`);
    }
  }

  const arrears = await financialsRepo.getArrearsAging(prisma, orgId);

  const totalEarned = summaries.reduce((s, b) => s + b.earnedIncomeCents, 0);
  const totalProjected = summaries.reduce((s, b) => s + b.projectedIncomeCents, 0);
  const totalExpenses = summaries.reduce((s, b) => s + b.expensesTotalCents, 0);
  const totalOperating = summaries.reduce((s, b) => s + b.operatingTotalCents, 0);
  const totalCapex = summaries.reduce((s, b) => s + b.capexTotalCents, 0);
  const totalNet = summaries.reduce((s, b) => s + b.netIncomeCents, 0);
  const totalNOI = summaries.reduce((s, b) => s + b.netOperatingIncomeCents, 0);
  const totalActive = summaries.reduce((s, b) => s + b.activeUnitsCount, 0);
  const totalAllUnits = summaries.reduce((s, b) => s + b.totalUnitsCount, 0);
  const active = summaries.filter((b) => b.earnedIncomeCents > 0 || b.expensesTotalCents > 0);
  // Weighted collection rate: total earned / total projected avoids one building's
  // rate dominating the average when portfolio sizes differ.
  const totalEarnedActive    = active.reduce((s, b) => s + b.earnedIncomeCents, 0);
  const totalProjectedActive = active.reduce((s, b) => s + b.projectedIncomeCents, 0);
  const avgCollection = Math.min(1, totalProjectedActive > 0
    ? safeDivide(totalEarnedActive, totalProjectedActive)
    : (active.length > 0 ? active.reduce((s, b) => s + b.collectionRate, 0) / active.length : 0));
  const avgMaintenance = active.length > 0
    ? active.reduce((s, b) => s + b.maintenanceRatio, 0) / active.length : 0;

  return {
    from: params.from,
    to: params.to,
    totalEarnedIncomeCents: totalEarned,
    totalProjectedIncomeCents: totalProjected,
    totalExpensesCents: totalExpenses,
    totalOperatingCents: totalOperating,
    totalCapexCents: totalCapex,
    totalNetIncomeCents: totalNet,
    totalNetOperatingIncomeCents: totalNOI,
    avgCollectionRate: Math.round(avgCollection * 10000) / 10000,
    avgMaintenanceRatio: Math.round(avgMaintenance * 10000) / 10000,
    totalActiveUnits: totalActive,
    totalUnits: totalAllUnits,
    buildingsInRed: summaries.filter((b) => b.health === "red").length,
    buildingCount: summaries.length,
    totalReceivablesCents: summaries.reduce((s, b) => s + b.receivablesCents, 0),
    totalPayablesCents: summaries.reduce((s, b) => s + b.payablesCents, 0),
    arrears,
    buildings: summaries,
  };
}

// ==========================================
// Monthly breakdown for YTD trendlines
// ==========================================

export async function getPortfolioMonthlyBreakdown(
  orgId: string,
  year: number,
  ownerId?: string,
): Promise<MonthlyBreakdownDTO[]> {
  const now = new Date();
  const currentYear = now.getFullYear();
  const lastMonth = year < currentYear ? 12 : now.getMonth() + 1;

  const results: MonthlyBreakdownDTO[] = [];

  for (let m = 1; m <= lastMonth; m++) {
    const from = `${year}-${String(m).padStart(2, "0")}-01`;
    const lastDay = new Date(year, m, 0).getDate();
    const to   = `${year}-${String(m).padStart(2, "0")}-${String(lastDay).padStart(2, "0")}`;

    try {
      const summary = await getPortfolioSummary(orgId, { from, to }, ownerId);
      results.push({
        month: m,
        earnedIncomeCents: summary.totalEarnedIncomeCents,
        expensesTotalCents: summary.totalExpensesCents,
        noiCents: summary.totalNetOperatingIncomeCents,
        collectionRate: summary.avgCollectionRate,
      });
    } catch {
      results.push({ month: m, earnedIncomeCents: 0, expensesTotalCents: 0, noiCents: 0, collectionRate: 0 });
    }
  }

  return results;
}

// ==========================================
// Set expense category on an invoice
// ==========================================

export async function setInvoiceExpenseCategory(
  invoiceId: string,
  orgId: string,
  category: ExpenseCategory,
): Promise<{ id: string; expenseCategory: ExpenseCategory }> {
  const invoice = await invoiceRepo.findInvoiceByIdAndOrg(prisma, orgId, invoiceId);
  if (!invoice) throw new NotFoundError(`Invoice ${invoiceId} not found`);

  if (invoice.job?.requestId) {
    throw new ConflictError(
      "Cannot re-categorize a job-linked invoice. Job invoices are automatically classified as MAINTENANCE.",
    );
  }

  const updated = await invoiceRepo.updateInvoiceExpenseCategory(prisma, invoiceId, category);

  return { id: updated.id, expenseCategory: updated.expenseCategory! };
}

// ==========================================
// Annual snapshot listing + batch refresh
// ==========================================

export interface AnnualSnapshotDTO {
  periodStart: string; // YYYY-MM-DD
  periodEnd: string;   // YYYY-MM-DD
  earnedIncomeCents: number;
  projectedIncomeCents: number;
  expensesTotalCents: number;
  maintenanceTotalCents: number;
  capexTotalCents: number;
  operatingTotalCents: number;
  netIncomeCents: number;
  netOperatingIncomeCents: number;
  activeUnitsCount: number;
  computedAt: string; // ISO datetime
}

/** List all stored financial snapshots for a building. */
export async function listBuildingSnapshots(
  orgId: string,
  buildingId: string,
): Promise<AnnualSnapshotDTO[]> {
  const building = await inventoryRepo.findBuildingByIdAndOrg(prisma, buildingId, orgId);
  if (!building) throw new NotFoundError(`Building ${buildingId} not found`);

  const rows = await snapshotRepo.findAllSnapshotsForBuilding(prisma, orgId, buildingId);
  return rows.map((r) => ({
    periodStart: r.periodStart.toISOString().slice(0, 10),
    periodEnd: r.periodEnd.toISOString().slice(0, 10),
    earnedIncomeCents: r.earnedIncomeCents,
    projectedIncomeCents: r.projectedIncomeCents,
    expensesTotalCents: r.expensesTotalCents,
    maintenanceTotalCents: r.maintenanceTotalCents,
    capexTotalCents: r.capexTotalCents,
    operatingTotalCents: r.operatingTotalCents,
    netIncomeCents: r.netIncomeCents,
    netOperatingIncomeCents: r.netOperatingIncomeCents,
    activeUnitsCount: r.activeUnitsCount,
    computedAt: r.computedAt.toISOString(),
  }));
}

/**
 * Compute (or refresh) annual financial snapshots for a building.
 *
 * Loops over the last `years` completed fiscal years (Jan 1 → Dec 31)
 * and calls getBuildingFinancials() for each, which upserts the snapshot.
 * Returns the refreshed snapshot list.
 */
export async function computeAnnualSnapshots(
  orgId: string,
  buildingId: string,
  years: number = 5,
): Promise<AnnualSnapshotDTO[]> {
  const building = await inventoryRepo.findBuildingByIdAndOrg(prisma, buildingId, orgId);
  if (!building) throw new NotFoundError(`Building ${buildingId} not found`);

  const currentYear = new Date().getUTCFullYear();
  // Compute the last `years` fully-completed fiscal years (exclude current year)
  for (let y = currentYear - years; y < currentYear; y++) {
    const from = `${y}-01-01`;
    const to = `${y}-12-31`;
    try {
      await getBuildingFinancials(orgId, buildingId, { from, to, forceRefresh: true });
    } catch (e) {
      // Skip years with no data — don't abort the whole refresh
      console.warn(`[computeAnnualSnapshots] Skipping ${y} for building ${buildingId}: ${e}`);
    }
  }

  return listBuildingSnapshots(orgId, buildingId);
}

// ==========================================
// Portfolio time-series
// ==========================================

export type TimeSeriesRange = "1W" | "1M" | "6M" | "1Y" | "2Y" | "5Y" | "10Y";

export interface TimeSeriesPoint {
  periodStart:       string;   // ISO date YYYY-MM-DD
  periodEnd:         string;
  label:             string;   // display label: "Jun", "Q2 2024", "2023", etc.
  noiCents:          number;
  earnedIncomeCents: number;
  expensesCents:     number;
  collectionRate:    number;
  noiMarginPct:      number | null;
  opexRatioPct:      number | null;
  occupancyRate:     number | null;
}

export interface PortfolioTimeSeriesDTO {
  range:          TimeSeriesRange;
  points:         TimeSeriesPoint[];
  earliestDate:   string | null;  // ISO date of earliest available data (for auto-detect)
}

function isoDate(d: Date): string {
  return d.toISOString().slice(0, 10);
}

function monthLabel(year: number, month: number, locale = "en"): string {
  return new Intl.DateTimeFormat(locale, { month: "short" }).format(
    new Date(year, month - 1, 1),
  );
}

function safePct(num: number, den: number): number | null {
  if (den === 0) return null;
  return Math.round((num / den) * 10000) / 10000;
}

function summaryToPoint(
  summary: Awaited<ReturnType<typeof getPortfolioSummary>>,
  periodStart: string,
  periodEnd: string,
  label: string,
): TimeSeriesPoint {
  const noi      = summary.totalNetOperatingIncomeCents;
  const earned   = summary.totalEarnedIncomeCents;
  const expenses = summary.totalExpensesCents;
  return {
    periodStart,
    periodEnd,
    label,
    noiCents:          noi,
    earnedIncomeCents: earned,
    expensesCents:     expenses,
    collectionRate:    summary.avgCollectionRate,
    noiMarginPct:      safePct(noi, earned),
    opexRatioPct:      safePct(expenses, earned),
    occupancyRate:
      summary.totalUnits > 0
        ? Math.round((summary.totalActiveUnits / summary.totalUnits) * 10000) / 10000
        : null,
  };
}

async function getPortfolioMonthlyPoints(
  orgId: string,
  fromYear: number,
  fromMonth: number,
  toYear: number,
  toMonth: number,
  ownerId?: string,
): Promise<TimeSeriesPoint[]> {
  const points: TimeSeriesPoint[] = [];
  let y = fromYear;
  let m = fromMonth;
  const now = new Date();

  while (y < toYear || (y === toYear && m <= toMonth)) {
    if (new Date(y, m - 1, 1) > now) break;
    const from   = `${y}-${String(m).padStart(2, "0")}-01`;
    const lastDay = new Date(y, m, 0).getDate();
    const to     = `${y}-${String(m).padStart(2, "0")}-${String(lastDay).padStart(2, "0")}`;
    const label  = `${monthLabel(y, m)} ${toYear - fromYear >= 1 ? y : ""}`.trim();
    try {
      const summary = await getPortfolioSummary(orgId, { from, to }, ownerId);
      points.push(summaryToPoint(summary, from, to, label));
    } catch {
      // skip months with no data
    }
    m++;
    if (m > 12) { m = 1; y++; }
  }
  return points;
}

async function getPortfolioQuarterlyPoints(
  orgId: string,
  fromYear: number,
  toYear: number,
  ownerId?: string,
): Promise<TimeSeriesPoint[]> {
  const points: TimeSeriesPoint[] = [];
  const now = new Date();

  for (let y = fromYear; y <= toYear; y++) {
    for (let q = 1; q <= 4; q++) {
      const qStart = (q - 1) * 3 + 1;
      const qEnd   = q * 3;
      const from   = `${y}-${String(qStart).padStart(2, "0")}-01`;
      const lastDay = new Date(y, qEnd, 0).getDate();
      const to     = `${y}-${String(qEnd).padStart(2, "0")}-${String(lastDay).padStart(2, "0")}`;
      if (new Date(y, qStart - 1, 1) > now) break;
      try {
        const summary = await getPortfolioSummary(orgId, { from, to }, ownerId);
        points.push(summaryToPoint(summary, from, to, `Q${q} ${y}`));
      } catch {
        // skip quarters with no data
      }
    }
  }
  return points;
}

async function getPortfolioAnnualPoints(
  orgId: string,
  fromYear: number,
  toYear: number,
  ownerId?: string,
): Promise<TimeSeriesPoint[]> {
  const points: TimeSeriesPoint[] = [];
  const now = new Date();

  for (let y = fromYear; y <= toYear; y++) {
    if (y > now.getFullYear()) break;
    const from = `${y}-01-01`;
    const to   = y < now.getFullYear() ? `${y}-12-31` : isoDate(now);
    try {
      const summary = await getPortfolioSummary(orgId, { from, to }, ownerId);
      points.push(summaryToPoint(summary, from, to, String(y)));
    } catch {
      // skip years with no data
    }
  }
  return points;
}

async function getDailyPoints(
  orgId: string,
  from: Date,
  to: Date,
  ownerId?: string,
): Promise<TimeSeriesPoint[]> {
  // Read whatever is already cached
  const cached = await dailySnapshotRepo.findDailySnapshotsInRange(prisma, orgId, from, to);
  const cachedDates = new Set(cached.map((r) => isoDate(r.date)));

  // Compute and store any missing past days on-demand (excludes today — live data)
  const now = new Date();
  const todayStr = isoDate(new Date(now.getFullYear(), now.getMonth(), now.getDate()));
  const cur = new Date(from);
  const compute: Array<{ date: Date; str: string }> = [];
  while (cur <= to) {
    const str = isoDate(cur);
    if (str < todayStr && !cachedDates.has(str)) {
      compute.push({ date: new Date(cur), str });
    }
    cur.setDate(cur.getDate() + 1);
  }

  for (const { date, str } of compute) {
    try {
      const summary = await getPortfolioSummary(orgId, { from: str, to: str }, ownerId);
      const noi     = summary.totalNetOperatingIncomeCents;
      const earned  = summary.totalEarnedIncomeCents;
      const expenses = summary.totalExpensesCents;
      await dailySnapshotRepo.upsertPortfolioDailySnapshot(prisma, orgId, date, {
        noiCents:          noi,
        earnedIncomeCents: earned,
        expensesCents:     expenses,
        collectionRate:    summary.avgCollectionRate,
        noiMarginPct:      safePct(noi, earned),
        opexRatioPct:      safePct(expenses, earned),
        occupancyRate:     summary.totalUnits > 0
          ? Math.round((summary.totalActiveUnits / summary.totalUnits) * 10000) / 10000
          : null,
        activeUnitsCount: summary.totalActiveUnits,
      });
    } catch {
      // skip days where computation fails
    }
  }

  // Re-read after fill
  const rows = await dailySnapshotRepo.findDailySnapshotsInRange(prisma, orgId, from, to);
  return rows.map((r) => ({
    periodStart:       isoDate(r.date),
    periodEnd:         isoDate(r.date),
    label:             new Intl.DateTimeFormat("en", { month: "short", day: "numeric" }).format(r.date),
    noiCents:          r.noiCents,
    earnedIncomeCents: r.earnedIncomeCents,
    expensesCents:     r.expensesCents,
    collectionRate:    r.collectionRate,
    noiMarginPct:      r.noiMarginPct,
    opexRatioPct:      r.opexRatioPct,
    occupancyRate:     r.occupancyRate,
  }));
}

export async function getPortfolioTimeSeries(
  orgId: string,
  range: TimeSeriesRange,
  ownerId?: string,
): Promise<PortfolioTimeSeriesDTO> {
  const now   = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  let points: TimeSeriesPoint[] = [];

  if (range === "1W") {
    const from = new Date(today); from.setDate(today.getDate() - 6);
    points = await getDailyPoints(orgId, from, today, ownerId);
  } else if (range === "1M") {
    const from = new Date(today); from.setDate(today.getDate() - 29);
    points = await getDailyPoints(orgId, from, today, ownerId);
  } else if (range === "6M") {
    const from = new Date(today); from.setMonth(today.getMonth() - 5); from.setDate(1);
    points = await getPortfolioMonthlyPoints(
      orgId,
      from.getFullYear(), from.getMonth() + 1,
      now.getFullYear(), now.getMonth() + 1,
      ownerId,
    );
  } else if (range === "1Y") {
    const from = new Date(today); from.setFullYear(today.getFullYear() - 1); from.setDate(1);
    points = await getPortfolioMonthlyPoints(
      orgId,
      from.getFullYear(), from.getMonth() + 1,
      now.getFullYear(), now.getMonth() + 1,
      ownerId,
    );
  } else if (range === "2Y") {
    const from = new Date(today); from.setFullYear(today.getFullYear() - 2); from.setDate(1);
    points = await getPortfolioMonthlyPoints(
      orgId,
      from.getFullYear(), from.getMonth() + 1,
      now.getFullYear(), now.getMonth() + 1,
      ownerId,
    );
  } else if (range === "5Y") {
    const toYear   = now.getFullYear();
    const fromYear = toYear - 4;
    points = await getPortfolioQuarterlyPoints(orgId, fromYear, toYear, ownerId);
  } else {
    // 10Y
    const toYear   = now.getFullYear();
    const fromYear = toYear - 9;
    points = await getPortfolioAnnualPoints(orgId, fromYear, toYear, ownerId);
  }

  // Auto-detect earliest available data
  const earliest = await dailySnapshotRepo.findEarliestDailySnapshot(prisma, orgId);

  return {
    range,
    points,
    earliestDate: earliest ? isoDate(earliest) : (points[0]?.periodStart ?? null),
  };
}

// ==========================================
// Daily snapshot computation (called by background job)
// ==========================================

export async function computeAndStoreDailyPortfolioSnapshot(
  orgId: string,
  ownerId?: string,
): Promise<boolean> {
  const now       = new Date();
  const yesterday = new Date(now.getFullYear(), now.getMonth(), now.getDate() - 1);

  const alreadyDone = await dailySnapshotRepo.findDailySnapshotExists(
    prisma, orgId, yesterday,
  );
  if (alreadyDone) return false;

  const from = isoDate(yesterday);
  const to   = isoDate(yesterday);

  const summary = await getPortfolioSummary(orgId, { from, to }, ownerId);
  const noi     = summary.totalNetOperatingIncomeCents;
  const earned  = summary.totalEarnedIncomeCents;
  const expenses = summary.totalExpensesCents;

  await dailySnapshotRepo.upsertPortfolioDailySnapshot(prisma, orgId, yesterday, {
    noiCents:          noi,
    earnedIncomeCents: earned,
    expensesCents:     expenses,
    collectionRate:    summary.avgCollectionRate,
    noiMarginPct:      safePct(noi, earned),
    opexRatioPct:      safePct(expenses, earned),
    occupancyRate:
      summary.totalUnits > 0
        ? Math.round((summary.totalActiveUnits / summary.totalUnits) * 10000) / 10000
        : null,
    activeUnitsCount: summary.totalActiveUnits,
  });
  return true;
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

// ==========================================
// Building-level time-series (Reporting tab)
// ==========================================

import * as buildingDailyRepo from "../repositories/buildingDailySnapshotRepository";

export interface BuildingTimeSeriesDTO {
  buildingId:    string;
  range:         TimeSeriesRange;
  points:        TimeSeriesPoint[];
  earliestDate:  string | null;
}

function buildingSummaryToPoint(
  dto: BuildingFinancialsDTO,
  periodStart: string,
  periodEnd: string,
  label: string,
): TimeSeriesPoint {
  const noi      = dto.netOperatingIncomeCents;
  const earned   = dto.earnedIncomeCents;
  const expenses = dto.expensesTotalCents;
  return {
    periodStart,
    periodEnd,
    label,
    noiCents:          noi,
    earnedIncomeCents: earned,
    expensesCents:     expenses,
    collectionRate:    dto.collectionRate,
    noiMarginPct:      safePct(noi, earned),
    opexRatioPct:      safePct(expenses, earned),
    occupancyRate:
      dto.totalUnitsCount > 0
        ? Math.round((dto.activeUnitsCount / dto.totalUnitsCount) * 10000) / 10000
        : null,
  };
}

async function getBuildingMonthlyPoints(
  orgId: string,
  buildingId: string,
  fromYear: number,
  fromMonth: number,
  toYear: number,
  toMonth: number,
): Promise<TimeSeriesPoint[]> {
  const points: TimeSeriesPoint[] = [];
  let y = fromYear;
  let m = fromMonth;
  const now = new Date();

  while (y < toYear || (y === toYear && m <= toMonth)) {
    if (new Date(y, m - 1, 1) > now) break;
    const from    = `${y}-${String(m).padStart(2, "0")}-01`;
    const lastDay = new Date(y, m, 0).getDate();
    const to      = `${y}-${String(m).padStart(2, "0")}-${String(lastDay).padStart(2, "0")}`;
    const label   = `${monthLabel(y, m)} ${toYear - fromYear >= 1 ? y : ""}`.trim();
    try {
      const dto = await getBuildingFinancials(orgId, buildingId, { from, to });
      points.push(buildingSummaryToPoint(dto, from, to, label));
    } catch {
      // skip months with no data
    }
    m++;
    if (m > 12) { m = 1; y++; }
  }
  return points;
}

async function getBuildingQuarterlyPoints(
  orgId: string,
  buildingId: string,
  fromYear: number,
  toYear: number,
): Promise<TimeSeriesPoint[]> {
  const points: TimeSeriesPoint[] = [];
  const now = new Date();

  for (let y = fromYear; y <= toYear; y++) {
    for (let q = 1; q <= 4; q++) {
      const qStart  = (q - 1) * 3 + 1;
      const qEnd    = q * 3;
      const from    = `${y}-${String(qStart).padStart(2, "0")}-01`;
      const lastDay = new Date(y, qEnd, 0).getDate();
      const to      = `${y}-${String(qEnd).padStart(2, "0")}-${String(lastDay).padStart(2, "0")}`;
      if (new Date(y, qStart - 1, 1) > now) break;
      try {
        const dto = await getBuildingFinancials(orgId, buildingId, { from, to });
        points.push(buildingSummaryToPoint(dto, from, to, `Q${q} ${y}`));
      } catch {
        // skip quarters with no data
      }
    }
  }
  return points;
}

async function getBuildingAnnualPoints(
  orgId: string,
  buildingId: string,
  fromYear: number,
  toYear: number,
): Promise<TimeSeriesPoint[]> {
  const points: TimeSeriesPoint[] = [];
  const now = new Date();

  for (let y = fromYear; y <= toYear; y++) {
    if (y > now.getFullYear()) break;
    const from = `${y}-01-01`;
    const to   = y < now.getFullYear() ? `${y}-12-31` : isoDate(now);
    try {
      const dto = await getBuildingFinancials(orgId, buildingId, { from, to });
      points.push(buildingSummaryToPoint(dto, from, to, String(y)));
    } catch {
      // skip years with no data
    }
  }
  return points;
}

async function getBuildingDailyPoints(
  orgId: string,
  buildingId: string,
  from: Date,
  to: Date,
): Promise<TimeSeriesPoint[]> {
  const cached     = await buildingDailyRepo.findBuildingDailySnapshotsInRange(prisma, orgId, buildingId, from, to);
  const cachedDates = new Set(cached.map((r) => isoDate(r.date)));

  const now      = new Date();
  const todayStr = isoDate(new Date(now.getFullYear(), now.getMonth(), now.getDate()));
  const cur      = new Date(from);
  const compute: Array<{ date: Date; str: string }> = [];

  while (cur <= to) {
    const str = isoDate(cur);
    if (str < todayStr && !cachedDates.has(str)) {
      compute.push({ date: new Date(cur), str });
    }
    cur.setDate(cur.getDate() + 1);
  }

  for (const { date, str } of compute) {
    try {
      const dto      = await getBuildingFinancials(orgId, buildingId, { from: str, to: str });
      const noi      = dto.netOperatingIncomeCents;
      const earned   = dto.earnedIncomeCents;
      const expenses = dto.expensesTotalCents;
      await buildingDailyRepo.upsertBuildingDailySnapshot(prisma, orgId, buildingId, date, {
        noiCents:          noi,
        earnedIncomeCents: earned,
        expensesCents:     expenses,
        collectionRate:    dto.collectionRate,
        noiMarginPct:      safePct(noi, earned),
        opexRatioPct:      safePct(expenses, earned),
        occupancyRate:
          dto.totalUnitsCount > 0
            ? Math.round((dto.activeUnitsCount / dto.totalUnitsCount) * 10000) / 10000
            : null,
        activeUnitsCount: dto.activeUnitsCount,
      });
    } catch {
      // skip days where computation fails
    }
  }

  const rows = await buildingDailyRepo.findBuildingDailySnapshotsInRange(prisma, orgId, buildingId, from, to);
  return rows.map((r) => ({
    periodStart:       isoDate(r.date),
    periodEnd:         isoDate(r.date),
    label:             new Intl.DateTimeFormat("en", { month: "short", day: "numeric" }).format(r.date),
    noiCents:          r.noiCents,
    earnedIncomeCents: r.earnedIncomeCents,
    expensesCents:     r.expensesCents,
    collectionRate:    r.collectionRate,
    noiMarginPct:      r.noiMarginPct,
    opexRatioPct:      r.opexRatioPct,
    occupancyRate:     r.occupancyRate,
  }));
}

export async function getBuildingTimeSeries(
  orgId: string,
  buildingId: string,
  range: TimeSeriesRange,
): Promise<BuildingTimeSeriesDTO> {
  const now   = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  let points: TimeSeriesPoint[] = [];

  if (range === "1W") {
    const from = new Date(today); from.setDate(today.getDate() - 6);
    points = await getBuildingDailyPoints(orgId, buildingId, from, today);
  } else if (range === "1M") {
    const from = new Date(today); from.setDate(today.getDate() - 29);
    points = await getBuildingDailyPoints(orgId, buildingId, from, today);
  } else if (range === "6M") {
    const from = new Date(today); from.setMonth(today.getMonth() - 5); from.setDate(1);
    points = await getBuildingMonthlyPoints(
      orgId, buildingId,
      from.getFullYear(), from.getMonth() + 1,
      now.getFullYear(), now.getMonth() + 1,
    );
  } else if (range === "1Y") {
    const from = new Date(today); from.setFullYear(today.getFullYear() - 1); from.setDate(1);
    points = await getBuildingMonthlyPoints(
      orgId, buildingId,
      from.getFullYear(), from.getMonth() + 1,
      now.getFullYear(), now.getMonth() + 1,
    );
  } else if (range === "2Y") {
    const from = new Date(today); from.setFullYear(today.getFullYear() - 2); from.setDate(1);
    points = await getBuildingMonthlyPoints(
      orgId, buildingId,
      from.getFullYear(), from.getMonth() + 1,
      now.getFullYear(), now.getMonth() + 1,
    );
  } else if (range === "5Y") {
    points = await getBuildingQuarterlyPoints(orgId, buildingId, now.getFullYear() - 4, now.getFullYear());
  } else {
    points = await getBuildingAnnualPoints(orgId, buildingId, now.getFullYear() - 9, now.getFullYear());
  }

  const earliest = await buildingDailyRepo.findEarliestBuildingDailySnapshot(prisma, orgId, buildingId);

  return {
    buildingId,
    range,
    points,
    earliestDate: earliest ? isoDate(earliest) : (points[0]?.periodStart ?? null),
  };
}

export async function computeAndStoreDailyBuildingSnapshot(
  orgId: string,
  buildingId: string,
): Promise<boolean> {
  const now       = new Date();
  const yesterday = new Date(now.getFullYear(), now.getMonth(), now.getDate() - 1);
  const from      = isoDate(yesterday);

  // Check if already done
  const existing = await prisma.buildingDailySnapshot.findUnique({
    where: { orgId_buildingId_date: { orgId, buildingId, date: yesterday } },
    select: { id: true },
  });
  if (existing) return false;

  try {
    const dto      = await getBuildingFinancials(orgId, buildingId, { from, to: from });
    const noi      = dto.netOperatingIncomeCents;
    const earned   = dto.earnedIncomeCents;
    const expenses = dto.expensesTotalCents;
    await buildingDailyRepo.upsertBuildingDailySnapshot(prisma, orgId, buildingId, yesterday, {
      noiCents:          noi,
      earnedIncomeCents: earned,
      expensesCents:     expenses,
      collectionRate:    dto.collectionRate,
      noiMarginPct:      safePct(noi, earned),
      opexRatioPct:      safePct(expenses, earned),
      occupancyRate:
        dto.totalUnitsCount > 0
          ? Math.round((dto.activeUnitsCount / dto.totalUnitsCount) * 10000) / 10000
          : null,
      activeUnitsCount: dto.activeUnitsCount,
    });
    return true;
  } catch {
    return false;
  }
}

// ==========================================
// Per-unit financial summaries (Building Reporting tab)
// ==========================================

export interface UnitFinancialSummaryDTO {
  unitId:               string;
  unitNumber:           string;
  floor:                string | null;
  tenantName:           string | null;
  projectedIncomeCents: number;
  earnedIncomeCents:    number;
  expensesCents:        number;
  netIncomeCents:       number;
  collectionRate:       number;
  occupancyRate:        number; // 0 or 1 per unit (vacant / occupied)
}

export async function getUnitFinancialSummaries(
  orgId: string,
  buildingId: string,
  fromStr: string,
  toStr: string,
): Promise<UnitFinancialSummaryDTO[]> {
  const from = new Date(fromStr + "T00:00:00.000Z");
  const to   = new Date(toStr   + "T23:59:59.999Z");

  // Fetch all active units for the building
  const units = await prisma.unit.findMany({
    where: { orgId, buildingId, isActive: true },
    orderBy: [{ unitNumber: "asc" }],
    select: { id: true, unitNumber: true, floor: true },
  });

  if (units.length === 0) return [];

  const unitIds = units.map((u) => u.id);

  // Projected income: OUTGOING invoices issued (not DRAFT) with billing period in range
  const projectedRows = await prisma.invoice.groupBy({
    by: ["leaseId"],
    where: {
      orgId,
      direction: "OUTGOING",
      leaseId: { not: null },
      billingPeriodStart: { gte: from, lte: to },
      status: { not: "DRAFT" },
      lease: { unitId: { in: unitIds } },
    },
    _sum: { totalAmount: true },
  });
  // Need unitId from leaseId — fetch lease→unit mapping
  const leaseIds = projectedRows.map((r) => r.leaseId!).filter(Boolean);
  const leaseUnitMap: Record<string, string> = {};
  if (leaseIds.length > 0) {
    const leases = await prisma.lease.findMany({
      where: { id: { in: leaseIds } },
      select: { id: true, unitId: true },
    });
    for (const l of leases) {
      if (l.unitId) leaseUnitMap[l.id] = l.unitId;
    }
  }
  const projectedByUnit: Record<string, number> = {};
  for (const row of projectedRows) {
    const uid = leaseUnitMap[row.leaseId!];
    if (uid) projectedByUnit[uid] = (projectedByUnit[uid] ?? 0) + (row._sum.totalAmount ?? 0);
  }

  // Earned income: same but status = PAID
  const earnedRows = await prisma.invoice.groupBy({
    by: ["leaseId"],
    where: {
      orgId,
      direction: "OUTGOING",
      leaseId: { not: null },
      billingPeriodStart: { gte: from, lte: to },
      status: "PAID",
      lease: { unitId: { in: unitIds } },
    },
    _sum: { totalAmount: true },
  });
  const earnedByUnit: Record<string, number> = {};
  for (const row of earnedRows) {
    const uid = leaseUnitMap[row.leaseId!];
    if (uid) earnedByUnit[uid] = (earnedByUnit[uid] ?? 0) + (row._sum.totalAmount ?? 0);
  }

  // Expenses: ledger entries with unitId, INVOICE_ISSUED, debit
  const expenseAgg = await prisma.ledgerEntry.groupBy({
    by: ["unitId"],
    where: {
      orgId,
      unitId: { in: unitIds },
      sourceType: "INVOICE_ISSUED",
      date: { gte: from, lte: to },
      debitCents: { gt: 0 },
      account: { accountType: "EXPENSE" },
    },
    _sum: { debitCents: true },
  });
  const expensesByUnit: Record<string, number> = {};
  for (const row of expenseAgg) {
    if (row.unitId) expensesByUnit[row.unitId] = row._sum.debitCents ?? 0;
  }

  // Active leases (for tenant name + occupancy)
  const activeLeases = await prisma.lease.findMany({
    where: {
      unitId: { in: unitIds },
      status: { in: ["ACTIVE", "PENDING"] },
      startDate: { lte: to },
      OR: [{ endDate: null }, { endDate: { gte: from } }],
    },
    select: {
      unitId: true,
      tenantName: true,
    },
    distinct: ["unitId"],
  });
  const leaseByUnit: Record<string, { tenantName: string | null }> = {};
  for (const l of activeLeases) {
    if (l.unitId) leaseByUnit[l.unitId] = { tenantName: l.tenantName };
  }

  return units.map((u) => {
    const projected = projectedByUnit[u.id] ?? 0;
    const earned    = earnedByUnit[u.id]    ?? 0;
    const expenses  = expensesByUnit[u.id]  ?? 0;
    const occupied  = !!leaseByUnit[u.id];
    return {
      unitId:               u.id,
      unitNumber:           u.unitNumber,
      floor:                u.floor,
      tenantName:           leaseByUnit[u.id]?.tenantName ?? null,
      projectedIncomeCents: projected,
      earnedIncomeCents:    earned,
      expensesCents:        expenses,
      netIncomeCents:       earned - expenses,
      collectionRate:       projected > 0 ? Math.min(1, earned / projected) : 0,
      occupancyRate:        occupied ? 1 : 0,
    };
  });
}
