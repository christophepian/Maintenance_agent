/**
 * mortgageRepository
 *
 * Canonical Prisma access for Mortgage records and Building valuation fields.
 * All queries are org-scoped. Routes must not call Prisma directly.
 */

import { PrismaClient, AmortizationType } from "@prisma/client";

// ─── Queries ───────────────────────────────────────────────────

export async function listMortgagesByBuilding(
  prisma: PrismaClient,
  orgId: string,
  buildingId: string,
) {
  return prisma.mortgage.findMany({
    where: { orgId, buildingId },
    orderBy: { createdAt: "asc" },
  });
}

export async function findMortgageById(
  prisma: PrismaClient,
  id: string,
  orgId: string,
) {
  return prisma.mortgage.findFirst({ where: { id, orgId } });
}

/** All mortgages for a set of buildings — used by the levered NPV layer. */
export async function listMortgagesForBuildings(
  prisma: PrismaClient,
  orgId: string,
  buildingIds: string[],
) {
  return prisma.mortgage.findMany({
    where: { orgId, buildingId: { in: buildingIds } },
    orderBy: { createdAt: "asc" },
  });
}

// ─── Mutations ─────────────────────────────────────────────────

export interface MortgageWriteData {
  lenderName?: string | null;
  originalPrincipalChf: number;
  currentBalanceChf: number;
  interestRatePct: number;
  amortizationType: AmortizationType;
  annualAmortizationChf?: number | null;
  startDate?: Date | null;
  fixedUntil?: Date | null;
  maturityDate?: Date | null;
}

export async function createMortgage(
  prisma: PrismaClient,
  orgId: string,
  buildingId: string,
  data: MortgageWriteData,
) {
  return prisma.mortgage.create({
    data: { orgId, buildingId, ...data },
  });
}

export async function updateMortgage(
  prisma: PrismaClient,
  id: string,
  orgId: string,
  data: Partial<MortgageWriteData>,
) {
  // Org-scoped mutation (defense-in-depth): updateMany so the orgId filter is
  // enforced at the DB even if a caller skips the pre-check. Refetch the row to
  // preserve the previous return contract.
  await prisma.mortgage.updateMany({ where: { id, orgId }, data });
  return prisma.mortgage.findFirst({ where: { id, orgId } });
}

export async function deleteMortgage(prisma: PrismaClient, id: string, orgId: string) {
  return prisma.mortgage.deleteMany({ where: { id, orgId } });
}

// ─── Building valuation ────────────────────────────────────────

export async function findBuildingValuation(
  prisma: PrismaClient,
  orgId: string,
  buildingId: string,
) {
  return prisma.building.findFirst({
    where: { id: buildingId, orgId },
    select: { id: true, name: true, marketValueChf: true, marketValueAt: true },
  });
}

export async function updateBuildingValuation(
  prisma: PrismaClient,
  orgId: string,
  buildingId: string,
  marketValueChf: number | null,
) {
  const result = await prisma.building.updateMany({
    where: { id: buildingId, orgId },
    data: {
      marketValueChf,
      marketValueAt: marketValueChf != null ? new Date() : null,
    },
  });
  return result.count > 0;
}
