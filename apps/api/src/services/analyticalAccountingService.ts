/**
 * Analytical Accounting Service (accounting bridge WS-C)
 *
 * The accountant's lens for one building over a fiscal year:
 *  - equity bridge: opening equity + period result − distributions = closing equity
 *  - account movements: opening → debit → credit → closing per account
 *  - position + KPIs: net assets (NAV), mortgage, property value, LTV
 *
 * Equity is the economic residual regardless of how the books bucket it:
 *   equity(asOf) = (assets − all liabilities) + equity-account balances
 *               = differenceCents(asOf) + Σ(2800–2999 balances)
 * This holds whether or not the year has been closed into retained earnings.
 *
 * Reuses getBalanceSheet (position at a date) and aggregatePnlBalances (result);
 * all Prisma access stays in repositories (G20).
 */

import { PrismaClient } from "@prisma/client";
import { NotFoundError } from "../http/errors";
import { getBalanceSheet, BalanceSheetReport } from "./ledgerService";
import { findBuildingByIdAndOrg } from "../repositories/inventoryRepository";
import { aggregatePnlBalances } from "../repositories/fiscalPeriodCloseRepository";
import { aggregateAccountMovements, AccountMovement } from "../repositories/financialsRepository";

function codeNum(code: string | null): number {
  const n = parseInt((code ?? "").replace(/\D/g, ""), 10);
  return isNaN(n) ? -1 : n;
}
const isEquityLine = (code: string | null) => {
  const n = codeNum(code);
  return n >= 2800 && n <= 2999;
};
const isMortgageLine = (code: string | null) => code === "2300" || code === "2350";

function equityOf(bs: BalanceSheetReport): number {
  const equityAccounts = bs.liabilities
    .filter((l) => isEquityLine(l.accountCode))
    .reduce((s, l) => s + l.displayCents, 0);
  return bs.differenceCents + equityAccounts;
}

export interface AnalyticalReport {
  buildingId: string;
  buildingName: string;
  fiscalYear: number;
  equityBridge: {
    openingEquityCents: number;
    periodResultCents: number;
    distributionsCents: number;
    closingEquityCents: number;
  };
  position: { totalAssetsCents: number; liabilitiesCents: number; equityCents: number };
  kpis: {
    navCents: number;
    mortgageCents: number;
    propertyValueCents: number | null;
    ltvPct: number | null;
  };
  accountMovements: AccountMovement[];
}

export async function getAnalyticalReport(
  prisma: PrismaClient,
  orgId: string,
  buildingId: string,
  fiscalYear: number,
): Promise<AnalyticalReport> {
  const building = await findBuildingByIdAndOrg(prisma, buildingId, orgId);
  if (!building) throw new NotFoundError(`Building ${buildingId} not found`);

  const periodStart = new Date(Date.UTC(fiscalYear, 0, 1, 0, 0, 0, 0));
  const periodEnd = new Date(Date.UTC(fiscalYear, 11, 31, 23, 59, 59, 999));
  const dayBefore = new Date(periodStart.getTime() - 1);

  const [bsOpen, bsClose, pnl, accountMovements] = await Promise.all([
    getBalanceSheet(prisma, orgId, buildingId, dayBefore),
    getBalanceSheet(prisma, orgId, buildingId, periodEnd),
    aggregatePnlBalances(prisma, orgId, buildingId, periodStart, periodEnd),
    aggregateAccountMovements(prisma, orgId, buildingId, periodStart, periodEnd),
  ]);

  const openingEquityCents = equityOf(bsOpen);
  const closingEquityCents = equityOf(bsClose);
  // Operating result for the period = revenue − expense = Σ(credit − debit) over P&L.
  const periodResultCents = pnl.reduce((s, a) => s + (a.creditCents - a.debitCents), 0);
  // Residual equity movement not explained by the result (owner draws/contributions).
  const distributionsCents = closingEquityCents - openingEquityCents - periodResultCents;

  const mortgageCents = bsClose.liabilities
    .filter((l) => isMortgageLine(l.accountCode))
    .reduce((s, l) => s + l.displayCents, 0);
  const propertyValueCents =
    building.marketValueChf != null ? Math.round(building.marketValueChf * 100) : null;
  const ltvPct =
    propertyValueCents && propertyValueCents > 0
      ? Math.round((mortgageCents / propertyValueCents) * 10000) / 100
      : null;

  return {
    buildingId,
    buildingName: building.name,
    fiscalYear,
    equityBridge: { openingEquityCents, periodResultCents, distributionsCents, closingEquityCents },
    position: {
      totalAssetsCents: bsClose.totalAssetsCents,
      liabilitiesCents: bsClose.totalAssetsCents - closingEquityCents,
      equityCents: closingEquityCents,
    },
    kpis: { navCents: closingEquityCents, mortgageCents, propertyValueCents, ltvPct },
    accountMovements,
  };
}
