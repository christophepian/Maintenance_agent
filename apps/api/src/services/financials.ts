import { ExpenseCategory } from "@prisma/client";
import prisma from "./prismaClient";
import * as invoiceRepo from "../repositories/invoiceRepository";
import * as inventoryRepo from "../repositories/inventoryRepository";
import * as leaseRepo from "../repositories/leaseRepository";
import * as snapshotRepo from "../repositories/buildingFinancialSnapshotRepository";
import * as financialsRepo from "../repositories/financialsRepository";
import * as dailySnapshotRepo from "../repositories/portfolioDailySnapshotRepository";
import * as billingPeriodRepo from "../repositories/billingPeriodRepository";
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
  collectedIncomeCents: number;
  accruedIncomeCents: number;
  expensesTotalCents: number;
  maintenanceTotalCents: number;
  capexTotalCents: number;
  operatingTotalCents: number;
  netIncomeCents: number;
  netOperatingIncomeCents: number;
  /**
   * Recoverable ancillary charges (Nebenkosten) booked to the building cost pool
   * for the period, de-duped against ledger entries by source invoice. Included
   * in expensesTotalCents / operatingTotalCents; exposed separately so a report
   * can show it as a distinct "recoverable ancillary" line vs landlord expenses.
   */
  recoverableAncillaryCents: number;

  // Income breakdown (projected, from lease terms)
  rentalIncomeCents: number;
  serviceChargeIncomeCents: number;

  // Point-in-time balances
  receivablesCents: number; // ISSUED unpaid lease invoices
  payablesCents: number;    // ISSUED/APPROVED unpaid job invoices
  /**
   * Opening receivables/payables carried in from the imported balance sheet
   * (sourceType BALANCE_SHEET_IMPORT on accounts 1100/2000), as of the report
   * end date. UN-AGED — these lumps have no due date / tenant / invoice, so they
   * are surfaced as a distinct "opening balance (from import)" line and are NOT
   * folded into the dueDate arrears buckets. De-duped from invoice activity by
   * sourceType, so they do not overlap receivablesCents/payablesCents.
   */
  openingReceivablesCents: number;
  openingPayablesCents: number;

  // KPIs
  maintenanceRatio: number;
  costPerUnitCents: number;
  collectionRate: number;
  // Raw inputs to collectionRate (paid ÷ invoiced by billing period) — exposed so
  // the portfolio rate can be a true weighted aggregate across buildings.
  invoicedForPeriodCents: number;
  paidForPeriodCents: number;

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
): Promise<{ accruedIncomeCents: number; rentalIncomeCents: number; serviceChargeIncomeCents: number }> {
  if (unitIds.length === 0) {
    return { accruedIncomeCents: 0, rentalIncomeCents: 0, serviceChargeIncomeCents: 0 };
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
    accruedIncomeCents: rentalIncomeCents + serviceChargeIncomeCents,
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

  // Opening balances carried in from the imported balance sheet (point-in-time,
  // as of the report end). Cheap aggregate; computed for both cached and fresh
  // paths. Source-filtered to BALANCE_SHEET_IMPORT so they never double-count
  // invoice-driven receivables/payables. Receivable = debit balance on 1100;
  // payable = credit balance on 2000 (negate the signed result).
  const [openingArSigned, openingApSigned] = await Promise.all([
    financialsRepo.aggregateOpeningBalanceFromImport(prisma, orgId, buildingId, "1100", to),
    financialsRepo.aggregateOpeningBalanceFromImport(prisma, orgId, buildingId, "2000", to),
  ]);
  const openingReceivablesCents = Math.max(0, openingArSigned);
  const openingPayablesCents = Math.max(0, -openingApSigned);

  if (!params.forceRefresh && !params.groupByAccount && !periodOverlapsCurrentMonth) {
    const cached = await snapshotRepo.findBuildingFinancialSnapshotByPeriod(prisma, orgId, buildingId, from, to);
    if (cached) {
      const [cachedTotalUnits, cachedActiveUnits] = await Promise.all([
        inventoryRepo.countTotalUnitsByBuilding(prisma, orgId, buildingId),
        inventoryRepo.countLeasedUnitsByBuilding(prisma, orgId, buildingId, from, to),
      ]);
      const [cachedInvoicedForPeriodCents, cachedPaidForPeriodCents] = await Promise.all([
        financialsRepo.aggregateInvoicedRentForPeriod(prisma, orgId, buildingId, from, to),
        financialsRepo.aggregatePaidRentForPeriod(prisma, orgId, buildingId, from, to),
      ]);
      // Mirror the fresh-path formula so cached periods agree: paid ÷ invoiced by
      // billing period, falling back to earned ÷ projected when nothing was invoiced.
      const cachedCollectionRate = Math.min(1, cachedInvoicedForPeriodCents > 0
        ? safeDivide(cachedPaidForPeriodCents, cachedInvoicedForPeriodCents)
        : safeDivide(cached.collectedIncomeCents, cached.accruedIncomeCents));
      return {
        buildingId,
        buildingName: building.name,
        from: params.from,
        to: params.to,
        collectedIncomeCents: cached.collectedIncomeCents,
        accruedIncomeCents: cached.accruedIncomeCents,
        expensesTotalCents: cached.expensesTotalCents,
        maintenanceTotalCents: cached.maintenanceTotalCents,
        capexTotalCents: cached.capexTotalCents,
        operatingTotalCents: cached.operatingTotalCents,
        netIncomeCents: cached.netIncomeCents,
        netOperatingIncomeCents: cached.netOperatingIncomeCents,
        recoverableAncillaryCents: 0, // already folded into cached expensesTotalCents
        rentalIncomeCents: 0,
        serviceChargeIncomeCents: 0,
        receivablesCents: 0,
        payablesCents: 0,
        openingReceivablesCents,
        openingPayablesCents,
        maintenanceRatio: 0,
        costPerUnitCents: 0,
        collectionRate: cachedCollectionRate,
        invoicedForPeriodCents: cachedInvoicedForPeriodCents,
        paidForPeriodCents: cachedPaidForPeriodCents,
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
  const collectedIncomeCents = await getEarnedIncomeFromLedger(orgId, buildingId, from, to);

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

  // 9c. Recoverable ancillary charges from the cost pool (WS3). De-dupe against
  //     the ledger by source invoice so a charge already posted as an expense
  //     isn't counted twice; scope to the window by the source invoice's date.
  //     Manual cost entries (no source invoice) are trusted by period overlap.
  const ledgerInvoiceIdSet = new Set(invoiceIds);
  const chargeEntries = await billingPeriodRepo.findChargeCostEntriesForBuildingWindow(
    prisma, orgId, buildingId, from, endOfDayUTC(to),
  );
  let recoverableAncillaryCents = 0;     // gross ventilated charges (for display)
  let chargesAlreadyInLedgerCents = 0;   // portion double-represented as a ledger expense
  for (const e of chargeEntries) {
    const d = e.sourceInvoice?.issueDate ?? e.sourceInvoice?.createdAt ?? null;
    if (d && (d < from || d > endOfDayUTC(to))) continue; // outside the window
    recoverableAncillaryCents += e.amountCents;
    if (e.sourceInvoiceId && ledgerInvoiceIdSet.has(e.sourceInvoiceId)) {
      chargesAlreadyInLedgerCents += e.amountCents;
    }
  }
  // Fold only the charges NOT already posted to the ledger into the expense total
  // (operating, never capex) so nothing is double-counted; the gross figure stays
  // exposed for display. Done before deriving KPIs and persisting the snapshot.
  expensesTotalCents += recoverableAncillaryCents - chargesAlreadyInLedgerCents;

  // 10. Derived totals and KPIs
  const operatingTotalCents = expensesTotalCents - capexTotalCents;
  const netIncomeCents = collectedIncomeCents - expensesTotalCents;
  const netOperatingIncomeCents = collectedIncomeCents - operatingTotalCents;
  const maintenanceRatio = safeDivide(maintenanceTotalCents, collectedIncomeCents);
  const costPerUnitCents = Math.round(safeDivide(expensesTotalCents, activeUnitsCount));
  // Invoice-billing-period rate capped at 100% to prevent catch-up payments
  // inflating the rate above 1.0 when the fallback formula fires.
  const collectionRate = Math.min(1, invoicedForPeriodCents > 0
    ? safeDivide(paidForPeriodCents, invoicedForPeriodCents)
    : safeDivide(collectedIncomeCents, incomeBreakdown.accruedIncomeCents));

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
    collectedIncomeCents,
    accruedIncomeCents: incomeBreakdown.accruedIncomeCents,
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
    collectedIncomeCents,
    accruedIncomeCents: incomeBreakdown.accruedIncomeCents,
    expensesTotalCents,
    maintenanceTotalCents,
    capexTotalCents,
    operatingTotalCents,
    netIncomeCents,
    netOperatingIncomeCents,
    recoverableAncillaryCents,
    rentalIncomeCents: incomeBreakdown.rentalIncomeCents,
    serviceChargeIncomeCents: incomeBreakdown.serviceChargeIncomeCents,
    receivablesCents,
    payablesCents,
    openingReceivablesCents,
    openingPayablesCents,
    maintenanceRatio: Math.round(maintenanceRatio * 10000) / 10000,
    costPerUnitCents,
    collectionRate: Math.round(collectionRate * 10000) / 10000,
    invoicedForPeriodCents,
    paidForPeriodCents,
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
  collectedIncomeCents: number;
  accruedIncomeCents: number;
  expensesTotalCents: number;
  operatingTotalCents: number;
  capexTotalCents: number;
  netIncomeCents: number;
  netOperatingIncomeCents: number;
  collectionRate: number;
  invoicedForPeriodCents: number;
  paidForPeriodCents: number;
  maintenanceRatio: number;
  activeUnitsCount: number;
  totalUnitsCount: number;
  receivablesCents: number;
  payablesCents: number;
}

export interface MonthlyBreakdownDTO {
  month: number; // 1–12
  collectedIncomeCents: number;
  expensesTotalCents: number;
  noiCents: number;
  collectionRate: number;
}

export interface PortfolioSummaryDTO {
  from: string;
  to: string;
  totalCollectedIncomeCents: number;
  totalAccruedIncomeCents: number;
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

  const buildingResults = await Promise.allSettled(
    buildings.map((building) =>
      getBuildingFinancials(orgId, building.id, { from: params.from, to: params.to }),
    ),
  );

  const summaries: BuildingSummaryDTO[] = [];
  for (let i = 0; i < buildings.length; i++) {
    const result = buildingResults[i];
    if (result.status === "rejected") {
      console.warn(`[portfolio-summary] Skipping building ${buildings[i].id}: ${result.reason}`);
      continue;
    }
    const dto = result.value;
    summaries.push({
      buildingId: dto.buildingId,
      buildingName: dto.buildingName,
      health: deriveHealth(dto.netIncomeCents, dto.collectionRate),
      collectedIncomeCents: dto.collectedIncomeCents,
      accruedIncomeCents: dto.accruedIncomeCents,
      expensesTotalCents: dto.expensesTotalCents,
      operatingTotalCents: dto.operatingTotalCents,
      capexTotalCents: dto.capexTotalCents,
      netIncomeCents: dto.netIncomeCents,
      netOperatingIncomeCents: dto.netOperatingIncomeCents,
      collectionRate: dto.collectionRate,
      invoicedForPeriodCents: dto.invoicedForPeriodCents,
      paidForPeriodCents: dto.paidForPeriodCents,
      maintenanceRatio: dto.maintenanceRatio,
      activeUnitsCount: dto.activeUnitsCount,
      totalUnitsCount: dto.totalUnitsCount,
      receivablesCents: dto.receivablesCents,
      payablesCents: dto.payablesCents,
    });
  }

  const arrears = await financialsRepo.getArrearsAging(prisma, orgId);

  const totalEarned = summaries.reduce((s, b) => s + b.collectedIncomeCents, 0);
  const totalProjected = summaries.reduce((s, b) => s + b.accruedIncomeCents, 0);
  const totalExpenses = summaries.reduce((s, b) => s + b.expensesTotalCents, 0);
  const totalOperating = summaries.reduce((s, b) => s + b.operatingTotalCents, 0);
  const totalCapex = summaries.reduce((s, b) => s + b.capexTotalCents, 0);
  const totalNet = summaries.reduce((s, b) => s + b.netIncomeCents, 0);
  const totalNOI = summaries.reduce((s, b) => s + b.netOperatingIncomeCents, 0);
  const totalActive = summaries.reduce((s, b) => s + b.activeUnitsCount, 0);
  const totalAllUnits = summaries.reduce((s, b) => s + b.totalUnitsCount, 0);
  const active = summaries.filter((b) => b.collectedIncomeCents > 0 || b.expensesTotalCents > 0);
  // Weighted collection rate: total PAID / total INVOICED across buildings, by
  // billing period — the same invoice-based definition used by the per-building,
  // building-report and unit-report surfaces, so every page agrees. (Previously
  // this used earned/projected, which could exceed 100% — masked by the cap — and
  // disagreed with the inventory page's paid/invoiced rate.)
  const totalInvoicedActive = active.reduce((s, b) => s + b.invoicedForPeriodCents, 0);
  const totalPaidActive     = active.reduce((s, b) => s + b.paidForPeriodCents, 0);
  const avgCollection = Math.min(1, totalInvoicedActive > 0
    ? safeDivide(totalPaidActive, totalInvoicedActive)
    : (active.length > 0 ? active.reduce((s, b) => s + b.collectionRate, 0) / active.length : 0));
  const avgMaintenance = active.length > 0
    ? active.reduce((s, b) => s + b.maintenanceRatio, 0) / active.length : 0;

  return {
    from: params.from,
    to: params.to,
    totalCollectedIncomeCents: totalEarned,
    totalAccruedIncomeCents: totalProjected,
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
        collectedIncomeCents: summary.totalCollectedIncomeCents,
        expensesTotalCents: summary.totalExpensesCents,
        noiCents: summary.totalNetOperatingIncomeCents,
        collectionRate: summary.avgCollectionRate,
      });
    } catch {
      results.push({ month: m, collectedIncomeCents: 0, expensesTotalCents: 0, noiCents: 0, collectionRate: 0 });
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
  collectedIncomeCents: number;
  accruedIncomeCents: number;
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
    collectedIncomeCents: r.collectedIncomeCents,
    accruedIncomeCents: r.accruedIncomeCents,
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
  collectedIncomeCents: number;
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
  const earned   = summary.totalCollectedIncomeCents;
  const expenses = summary.totalExpensesCents;
  return {
    periodStart,
    periodEnd,
    label,
    noiCents:          noi,
    collectedIncomeCents: earned,
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
  const now = new Date();
  const periods: { from: string; to: string; label: string }[] = [];

  let y = fromYear;
  let m = fromMonth;
  while (y < toYear || (y === toYear && m <= toMonth)) {
    if (new Date(y, m - 1, 1) > now) break;
    const from    = `${y}-${String(m).padStart(2, "0")}-01`;
    const lastDay = new Date(y, m, 0).getDate();
    const to      = `${y}-${String(m).padStart(2, "0")}-${String(lastDay).padStart(2, "0")}`;
    const label   = `${monthLabel(y, m)} ${toYear - fromYear >= 1 ? y : ""}`.trim();
    periods.push({ from, to, label });
    m++;
    if (m > 12) { m = 1; y++; }
  }

  const results = await Promise.allSettled(
    periods.map(({ from, to }) => getPortfolioSummary(orgId, { from, to }, ownerId)),
  );

  return results
    .map((r, i) => r.status === "fulfilled" ? summaryToPoint(r.value, periods[i].from, periods[i].to, periods[i].label) : null)
    .filter((p): p is TimeSeriesPoint => p !== null);
}

async function getPortfolioQuarterlyPoints(
  orgId: string,
  fromYear: number,
  toYear: number,
  ownerId?: string,
): Promise<TimeSeriesPoint[]> {
  const now = new Date();
  const periods: { from: string; to: string; label: string }[] = [];

  for (let y = fromYear; y <= toYear; y++) {
    for (let q = 1; q <= 4; q++) {
      const qStart  = (q - 1) * 3 + 1;
      const qEnd    = q * 3;
      const from    = `${y}-${String(qStart).padStart(2, "0")}-01`;
      const lastDay = new Date(y, qEnd, 0).getDate();
      const to      = `${y}-${String(qEnd).padStart(2, "0")}-${String(lastDay).padStart(2, "0")}`;
      if (new Date(y, qStart - 1, 1) > now) break;
      periods.push({ from, to, label: `Q${q} ${y}` });
    }
  }

  const results = await Promise.allSettled(
    periods.map(({ from, to }) => getPortfolioSummary(orgId, { from, to }, ownerId)),
  );

  return results
    .map((r, i) => r.status === "fulfilled" ? summaryToPoint(r.value, periods[i].from, periods[i].to, periods[i].label) : null)
    .filter((p): p is TimeSeriesPoint => p !== null);
}

async function getPortfolioAnnualPoints(
  orgId: string,
  fromYear: number,
  toYear: number,
  ownerId?: string,
): Promise<TimeSeriesPoint[]> {
  const now = new Date();
  const periods: { from: string; to: string; label: string }[] = [];

  for (let y = fromYear; y <= toYear; y++) {
    if (y > now.getFullYear()) break;
    const from = `${y}-01-01`;
    const to   = y < now.getFullYear() ? `${y}-12-31` : isoDate(now);
    periods.push({ from, to, label: String(y) });
  }

  const results = await Promise.allSettled(
    periods.map(({ from, to }) => getPortfolioSummary(orgId, { from, to }, ownerId)),
  );

  return results
    .map((r, i) => r.status === "fulfilled" ? summaryToPoint(r.value, periods[i].from, periods[i].to, periods[i].label) : null)
    .filter((p): p is TimeSeriesPoint => p !== null);
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
      const earned  = summary.totalCollectedIncomeCents;
      const expenses = summary.totalExpensesCents;
      await dailySnapshotRepo.upsertPortfolioDailySnapshot(prisma, orgId, date, {
        noiCents:          noi,
        collectedIncomeCents: earned,
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
    collectedIncomeCents: r.collectedIncomeCents,
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
  const earned  = summary.totalCollectedIncomeCents;
  const expenses = summary.totalExpensesCents;

  await dailySnapshotRepo.upsertPortfolioDailySnapshot(prisma, orgId, yesterday, {
    noiCents:          noi,
    collectedIncomeCents: earned,
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
  const earned   = dto.collectedIncomeCents;
  const expenses = dto.expensesTotalCents;
  return {
    periodStart,
    periodEnd,
    label,
    noiCents:          noi,
    collectedIncomeCents: earned,
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
      const earned   = dto.collectedIncomeCents;
      const expenses = dto.expensesTotalCents;
      await buildingDailyRepo.upsertBuildingDailySnapshot(prisma, orgId, buildingId, date, {
        noiCents:          noi,
        collectedIncomeCents: earned,
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
    collectedIncomeCents: r.collectedIncomeCents,
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
    const earned   = dto.collectedIncomeCents;
    const expenses = dto.expensesTotalCents;
    await buildingDailyRepo.upsertBuildingDailySnapshot(prisma, orgId, buildingId, yesterday, {
      noiCents:          noi,
      collectedIncomeCents: earned,
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
  accruedIncomeCents: number;
  collectedIncomeCents:    number;
  expensesCents:        number;
  /** Apportioned recoverable-charge share from the cost pool, included in expensesCents. */
  apportionedChargesCents: number;
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

  // Active leases (for tenant name + occupancy + charge apportionment)
  const activeLeases = await prisma.lease.findMany({
    where: {
      unitId: { in: unitIds },
      status: { in: ["ACTIVE", "SIGNED"] },
      startDate: { lte: to },
      OR: [{ endDate: null }, { endDate: { gte: from } }],
    },
    select: {
      id: true,
      unitId: true,
      tenantName: true,
    },
    distinct: ["unitId"],
  });
  const leaseByUnit: Record<string, { id: string; tenantName: string | null }> = {};
  for (const l of activeLeases) {
    if (l.unitId) leaseByUnit[l.unitId] = { id: l.id, tenantName: l.tenantName };
  }

  // Apportioned recoverable-charge share per unit (cost pool). Charges are
  // building-level, so they never appear in the per-unit ledger above; without
  // this the "By unit" view shows none of the ventilated Nebenkosten. We use the
  // billing period overlapping the window (same basis as the unit page).
  const apportionedByUnit: Record<string, number> = {};
  const chargePeriod = await billingPeriodRepo.findBillingPeriodOverlappingWindow(prisma, orgId, buildingId, from, to);
  if (chargePeriod) {
    const { apportionForLease } = await import("./ancillaryReconciliationService");
    await Promise.all(
      Object.entries(leaseByUnit).map(async ([unitId, lease]) => {
        try {
          const a = await apportionForLease(orgId, chargePeriod.id, lease.id);
          apportionedByUnit[unitId] = a.totalActualCostsCents;
        } catch { /* no apportionable charges for this unit */ }
      }),
    );
  }

  return units.map((u) => {
    const projected = projectedByUnit[u.id] ?? 0;
    const earned    = earnedByUnit[u.id]    ?? 0;
    const ledgerExp = expensesByUnit[u.id]  ?? 0;
    const charges   = apportionedByUnit[u.id] ?? 0;
    const expenses  = ledgerExp + charges; // charges fold into expenses, mirroring the building total
    const occupied  = !!leaseByUnit[u.id];
    return {
      unitId:               u.id,
      unitNumber:           u.unitNumber,
      floor:                u.floor,
      tenantName:           leaseByUnit[u.id]?.tenantName ?? null,
      accruedIncomeCents: projected,
      collectedIncomeCents:    earned,
      expensesCents:        expenses,
      apportionedChargesCents: charges,
      netIncomeCents:       earned - expenses,
      collectionRate:       projected > 0 ? Math.min(1, earned / projected) : 0,
      occupancyRate:        occupied ? 1 : 0,
    };
  });
}

// ==========================================
// Building period report (for building Reporting tab)
// ==========================================

export interface BuildingMonthlyBreakdownDTO {
  month: number;
  collectedIncomeCents: number;
  expensesTotalCents: number;
  noiCents: number;
  collectionRate: number;
}

export interface BuildingPeriodReportDTO {
  financials:  BuildingFinancialsDTO;
  prevFinancials: BuildingFinancialsDTO | null;
  arrears:     import("../repositories/financialsRepository").ArrearsAgingDTO;
  moveIns:     Array<{ id: string; unitId: string; unitNumber: string; tenantName: string; startDate: string }>;
  moveOuts:    Array<{ id: string; unitId: string; unitNumber: string; tenantName: string; endDate: string }>;
  monthlyData: BuildingMonthlyBreakdownDTO[] | null;
}

export async function getBuildingPeriodReport(
  orgId: string,
  buildingId: string,
  from: string,
  to: string,
  includeMonthly: boolean,
): Promise<BuildingPeriodReportDTO> {
  const building = await inventoryRepo.findBuildingByIdAndOrg(prisma, buildingId, orgId);
  if (!building) throw new NotFoundError(`Building ${buildingId} not found`);

  // Current period financials
  const financials = await getBuildingFinancials(orgId, buildingId, { from, to });

  // Prev period: same duration, immediately before
  const fromDate = new Date(from + "T00:00:00Z");
  const toDate   = new Date(to   + "T00:00:00Z");
  const duration = toDate.getTime() - fromDate.getTime();
  const prevToDate   = new Date(fromDate.getTime() - 1);
  const prevFromDate = new Date(prevToDate.getTime() - duration);
  const prevFrom = prevFromDate.toISOString().slice(0, 10);
  const prevTo   = prevToDate.toISOString().slice(0, 10);
  let prevFinancials: BuildingFinancialsDTO | null = null;
  try {
    prevFinancials = await getBuildingFinancials(orgId, buildingId, { from: prevFrom, to: prevTo });
  } catch { /* prev period may have no data */ }

  // Arrears — scoped to this building's units
  const unitIds = await inventoryRepo.findActiveUnitIdsByBuilding(prisma, orgId, buildingId);
  const rawInvoices = await prisma.invoice.findMany({
    where: {
      orgId,
      direction: "OUTGOING",
      status: "ISSUED",
      lease: { unitId: { in: unitIds } },
    },
    select: { totalAmount: true, dueDate: true },
  });
  const today = new Date();
  let currentCents = 0, o1 = 0, o2 = 0, o3 = 0;
  for (const inv of rawInvoices) {
    const amt = inv.totalAmount ?? 0;
    if (!inv.dueDate) { currentCents += amt; continue; }
    const days = Math.floor((today.getTime() - inv.dueDate.getTime()) / 86400000);
    if (days <= 0) currentCents += amt;
    else if (days <= 30) o1 += amt;
    else if (days <= 60) o2 += amt;
    else o3 += amt;
  }
  const arrears = {
    currentCents, overdue1to30Cents: o1, overdue31to60Cents: o2,
    overdue61plusCents: o3, totalOverdueCents: o1 + o2 + o3,
  };

  // Pre-fetch unit number map for this building (avoids TS inference issues with nested select+where)
  const buildingUnitRows = await prisma.unit.findMany({
    where: { buildingId, orgId },
    select: { id: true, unitNumber: true },
  });
  const unitNumMap: Record<string, string> = {};
  for (const u of buildingUnitRows) unitNumMap[u.id] = u.unitNumber;

  // Move-ins: leases starting in period for this building
  const moveInLeases = await prisma.lease.findMany({
    where: {
      unitId: { in: buildingUnitRows.map((u) => u.id) },
      startDate: { gte: new Date(from + "T00:00:00Z"), lte: new Date(to + "T23:59:59Z") },
      status: { in: ["ACTIVE", "SIGNED", "TERMINATED", "CANCELLED"] },
      isTemplate: false,
    },
    select: { id: true, unitId: true, tenantName: true, startDate: true },
    take: 50,
  });
  const moveOuts_ = await prisma.lease.findMany({
    where: {
      unitId: { in: buildingUnitRows.map((u) => u.id) },
      endDate: { gte: new Date(from + "T00:00:00Z"), lte: new Date(to + "T23:59:59Z") },
      status: { in: ["TERMINATED", "CANCELLED"] },
      isTemplate: false,
    },
    select: { id: true, unitId: true, tenantName: true, endDate: true },
    take: 50,
  });

  // Monthly breakdown (for YTD trendline)
  let monthlyData: BuildingMonthlyBreakdownDTO[] | null = null;
  if (includeMonthly) {
    const year = fromDate.getUTCFullYear();
    const now2 = new Date();
    const lastMonth = year < now2.getFullYear() ? 12 : now2.getMonth() + 1;
    monthlyData = [];
    for (let m = 1; m <= lastMonth; m++) {
      const mf = `${year}-${String(m).padStart(2, "0")}-01`;
      const lastDay = new Date(year, m, 0).getDate();
      const mt = `${year}-${String(m).padStart(2, "0")}-${String(lastDay).padStart(2, "0")}`;
      try {
        const s = await getBuildingFinancials(orgId, buildingId, { from: mf, to: mt });
        monthlyData.push({ month: m, collectedIncomeCents: s.collectedIncomeCents, expensesTotalCents: s.expensesTotalCents, noiCents: s.netOperatingIncomeCents, collectionRate: s.collectionRate });
      } catch {
        monthlyData.push({ month: m, collectedIncomeCents: 0, expensesTotalCents: 0, noiCents: 0, collectionRate: 0 });
      }
    }
  }

  return {
    financials,
    prevFinancials,
    arrears,
    moveIns: moveInLeases.filter(l => l.unitId).map(l => ({
      id: l.id,
      unitId: l.unitId!,
      unitNumber: unitNumMap[l.unitId ?? ""] ?? "?",
      tenantName: l.tenantName,
      startDate: l.startDate.toISOString().slice(0, 10),
    })),
    moveOuts: moveOuts_.filter(l => l.unitId && l.endDate).map(l => ({
      id: l.id,
      unitId: l.unitId!,
      unitNumber: unitNumMap[l.unitId ?? ""] ?? "?",
      tenantName: l.tenantName,
      endDate: l.endDate!.toISOString().slice(0, 10),
    })),
    monthlyData,
  };
}

// ==========================================
// Unit period report (for unit Reporting tab)
// ==========================================

export interface UnitPeriodFinancials {
  accruedIncomeCents: number;
  collectedIncomeCents:    number;
  expensesCents:        number;
  netIncomeCents:       number;
  collectionRate:       number;
}

export interface UnitPeriodReportDTO {
  unitId:     string;
  unitNumber: string;
  from:       string;
  to:         string;
  current:    UnitPeriodFinancials;
  prev:       UnitPeriodFinancials | null;
  currentLease: {
    id:               string;
    tenantName:       string;
    netRentChf:       number;
    startDate:        string;
    endDate:          string | null;
    remainingMonths:  number | null;
    status:           string;
  } | null;
  arrearsCents: number;
  /**
   * The unit's apportioned recoverable-charge share from the building cost pool
   * for the billing period overlapping the window (WS3, passive). null when no
   * active lease / period / cost pool exists. Settling stays an explicit action.
   */
  apportionedChargesCents: number | null;
  monthlyData: Array<{
    month:              number;
    collectedIncomeCents:  number;
    expensesCents:      number;
    noiCents:           number;
  }> | null;
  assetConditionSummary: {
    total:   number;
    good:    number;
    fair:    number;
    poor:    number;
    damaged: number;
  } | null;
}

export async function getUnitPeriodReport(
  orgId:          string,
  unitId:         string,
  fromStr:        string,
  toStr:          string,
  includeMonthly: boolean,
): Promise<UnitPeriodReportDTO> {
  const unit = await prisma.unit.findFirst({
    where: { id: unitId, orgId },
    select: { id: true, unitNumber: true },
  });
  if (!unit) throw new NotFoundError(`Unit ${unitId} not found`);

  // Pre-fetch all lease IDs for this unit (avoids relation-filter TS inference issues)
  const unitLeases = await prisma.lease.findMany({
    where: { unitId, orgId, isTemplate: false },
    select: { id: true },
  });
  const leaseIdList = unitLeases.map((l) => l.id);

  async function computeFinancials(f: Date, t: Date): Promise<UnitPeriodFinancials> {
    const [projAgg, earnedAgg, expAgg] = await Promise.all([
      prisma.invoice.aggregate({
        where: {
          orgId,
          leaseId: { in: leaseIdList },
          direction: "OUTGOING",
          status: { not: "DRAFT" },
          billingPeriodStart: { gte: f, lte: t },
        },
        _sum: { totalAmount: true },
      }),
      prisma.invoice.aggregate({
        where: {
          orgId,
          leaseId: { in: leaseIdList },
          direction: "OUTGOING",
          status: "PAID",
          billingPeriodStart: { gte: f, lte: t },
        },
        _sum: { totalAmount: true },
      }),
      prisma.ledgerEntry.aggregate({
        where: {
          orgId,
          unitId,
          sourceType: "INVOICE_ISSUED",
          date: { gte: f, lte: t },
          debitCents: { gt: 0 },
          account: { accountType: "EXPENSE" },
        },
        _sum: { debitCents: true },
      }),
    ]);
    const projected = projAgg._sum.totalAmount ?? 0;
    const earned    = earnedAgg._sum.totalAmount ?? 0;
    const expenses  = expAgg._sum.debitCents ?? 0;
    return {
      accruedIncomeCents: projected,
      collectedIncomeCents:    earned,
      expensesCents:        expenses,
      netIncomeCents:       earned - expenses,
      collectionRate:       projected > 0 ? Math.min(1, earned / projected) : 0,
    };
  }

  const from = new Date(fromStr + "T00:00:00.000Z");
  const to   = new Date(toStr   + "T23:59:59.999Z");
  const current = await computeFinancials(from, to);

  // Prev period: same duration, immediately before
  const duration  = to.getTime() - from.getTime();
  const prevTo    = new Date(from.getTime() - 1);
  const prevFrom  = new Date(prevTo.getTime() - duration);
  let prev: UnitPeriodFinancials | null = null;
  try { prev = await computeFinancials(prevFrom, prevTo); } catch { /* no prev data */ }

  // Current active lease
  const today = new Date();
  const activeLease = await prisma.lease.findFirst({
    where: { unitId, orgId, status: { in: ["ACTIVE", "SIGNED"] }, isTemplate: false },
    orderBy: { startDate: "desc" },
    select: { id: true, tenantName: true, netRentChf: true, startDate: true, endDate: true, status: true },
  });
  const currentLease = activeLease ? {
    id:              activeLease.id,
    tenantName:      activeLease.tenantName,
    netRentChf:      activeLease.netRentChf,
    startDate:       activeLease.startDate.toISOString().slice(0, 10),
    endDate:         activeLease.endDate?.toISOString().slice(0, 10) ?? null,
    remainingMonths: activeLease.endDate
      ? Math.max(0, Math.round((activeLease.endDate.getTime() - today.getTime()) / (1000 * 60 * 60 * 24 * 30.44)))
      : null,
    status:          activeLease.status,
  } : null;

  // Arrears: outstanding OUTGOING invoices for this unit
  const arrearsAgg = await prisma.invoice.aggregate({
    where: { orgId, leaseId: { in: leaseIdList }, direction: "OUTGOING", status: "ISSUED" },
    _sum: { totalAmount: true },
  });
  const arrearsCents = arrearsAgg._sum.totalAmount ?? 0;

  // Apportioned recoverable-charge share from the cost pool (WS3, passive). Find
  // the billing period overlapping the window and apportion this unit's active
  // lease. Best-effort: any gap (no lease, no period, no costs) yields null.
  let apportionedChargesCents: number | null = null;
  try {
    if (activeLease) {
      const unitRow = await prisma.unit.findFirst({ where: { id: unitId, orgId }, select: { buildingId: true } });
      if (unitRow?.buildingId) {
        const period = await billingPeriodRepo.findBillingPeriodOverlappingWindow(prisma, orgId, unitRow.buildingId, from, to);
        if (period) {
          const { apportionForLease } = await import("./ancillaryReconciliationService");
          const apportion = await apportionForLease(orgId, period.id, activeLease.id);
          apportionedChargesCents = apportion.totalActualCostsCents;
        }
      }
    }
  } catch { /* no apportionable charges for this unit/period */ }

  // Monthly data (YTD)
  let monthlyData: UnitPeriodReportDTO["monthlyData"] = null;
  if (includeMonthly) {
    const year = from.getUTCFullYear();
    const now2 = new Date();
    const lastMonth = year < now2.getFullYear() ? 12 : now2.getMonth() + 1;
    monthlyData = [];
    for (let m = 1; m <= lastMonth; m++) {
      const mf = new Date(`${year}-${String(m).padStart(2, "0")}-01T00:00:00.000Z`);
      const lastDay = new Date(year, m, 0).getDate();
      const mt = new Date(`${year}-${String(m).padStart(2, "0")}-${String(lastDay).padStart(2, "0")}T23:59:59.999Z`);
      try {
        const md = await computeFinancials(mf, mt);
        monthlyData.push({ month: m, collectedIncomeCents: md.collectedIncomeCents, expensesCents: md.expensesCents, noiCents: md.netIncomeCents });
      } catch {
        monthlyData.push({ month: m, collectedIncomeCents: 0, expensesCents: 0, noiCents: 0 });
      }
    }
  }

  // Latest condition report summary
  let assetConditionSummary: UnitPeriodReportDTO["assetConditionSummary"] = null;
  const latestReport = await prisma.unitConditionReport.findFirst({
    where: { unitId, orgId, status: { in: ["SUBMITTED", "APPROVED"] } },
    orderBy: { submittedAt: "desc" },
    select: { items: { select: { condition: true } } },
  });
  if (latestReport) {
    let good = 0, fair = 0, poor = 0, damaged = 0;
    for (const item of latestReport.items) {
      if (item.condition === "GOOD") good++;
      else if (item.condition === "FAIR") fair++;
      else if (item.condition === "POOR") poor++;
      else if (item.condition === "DAMAGED") damaged++;
    }
    assetConditionSummary = { total: latestReport.items.length, good, fair, poor, damaged };
  }

  return {
    unitId: unit.id,
    unitNumber: unit.unitNumber,
    from: fromStr,
    to: toStr,
    current,
    prev,
    currentLease,
    arrearsCents,
    apportionedChargesCents,
    monthlyData,
    assetConditionSummary,
  };
}
