import { ExpenseCategory } from "@prisma/client";
import prisma from "./prismaClient";
import * as invoiceRepo from "../repositories/invoiceRepository";
import * as inventoryRepo from "../repositories/inventoryRepository";
import * as leaseRepo from "../repositories/leaseRepository";
import * as snapshotRepo from "../repositories/buildingFinancialSnapshotRepository";
import * as financialsRepo from "../repositories/financialsRepository";
import type { ExpenseLedgerRow } from "../repositories/financialsRepository";

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

  const unitIds = await inventoryRepo.findActiveUnitIdsByBuilding(prisma, orgId, buildingId);
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
