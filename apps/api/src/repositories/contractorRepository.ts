/**
 * Contractor Repository
 *
 * Centralizes all Prisma access for Contractor entity verification.
 * Route handlers should use these functions instead of ad-hoc
 * prisma.contractor calls for org ownership checks.
 *
 * G3: include must match what DTO mappers access.
 * G9: canonical include constants live here.
 * CQ-13 fix: extracted from routes/contractor.ts
 */

import { PrismaClient, Prisma } from "@prisma/client";

// ─── Canonical Includes ────────────────────────────────────────

/** Minimal include for contractor verification — no relations needed. */
export const CONTRACTOR_INCLUDE = {} as const;

// ─── Query Functions ───────────────────────────────────────────

/**
 * Verify a contractor exists and belongs to the given org.
 * Returns the contractor if found and owned by org, null otherwise.
 * CQ-13: Replaces ad-hoc prisma.contractor.findUnique() in route handlers.
 */
export async function verifyOrgOwnership(
  prisma: PrismaClient,
  contractorId: string,
  orgId: string,
) {
  const contractor = await prisma.contractor.findUnique({
    where: { id: contractorId },
  });

  if (!contractor || contractor.orgId !== orgId) return null;
  return contractor;
}

/**
 * Find a contractor by ID, scoped to org.
 * Returns the full record (including serviceCategories for category matching).
 */
export async function findContractorById(
  prisma: PrismaClient,
  contractorId: string,
  orgId: string,
) {
  const contractor = await prisma.contractor.findUnique({
    where: { id: contractorId },
  });
  if (!contractor || contractor.orgId !== orgId) return null;
  return contractor;
}

/**
 * Parse the JSON serviceCategories string into an array.
 * Returns empty array on parse failure or missing data.
 */
export function parseServiceCategories(contractor: { serviceCategories: string }): string[] {
  try {
    const cats = JSON.parse(contractor.serviceCategories);
    return Array.isArray(cats) ? cats : [];
  } catch {
    return [];
  }
}

/**
 * Find multiple contractors by IDs, scoped to org.
 * Returns only active contractors that belong to the org.
 * Used for bulk validation in re-invite flows.
 */
export async function findContractorsByIds(
  prisma: PrismaClient,
  contractorIds: string[],
  orgId: string,
) {
  return prisma.contractor.findMany({
    where: {
      id: { in: contractorIds },
      orgId,
      isActive: true,
    },
    select: { id: true, name: true },
  });
}

/**
 * Find all active contractors for an org.
 * Used when matching contractors to an RFP by trade group / category.
 */
export async function findActiveByOrg(
  prisma: PrismaClient,
  orgId: string,
): Promise<Array<{ id: string; serviceCategories: string }>> {
  return prisma.contractor.findMany({
    where: { orgId, isActive: true },
    select: { id: true, serviceCategories: true },
  });
}

/**
 * Fetch only the orgId for a contractor — used for lightweight org-scope checks.
 */
export async function findContractorOrgId(prisma: PrismaClient, id: string) {
  return prisma.contractor.findUnique({ where: { id }, select: { orgId: true } });
}

// ─── CRUD for contractors service ─────────────────────────────

/**
 * Find a contractor by id without org-scope check.
 * Used by the contractors service which manages its own scoping.
 */
export async function findContractorByIdRaw(
  prisma: PrismaClient,
  id: string,
) {
  return prisma.contractor.findUnique({ where: { id } });
}

/**
 * List contractors with a count, scoped to an org.
 */
export async function listContractorsWithCount(
  prisma: PrismaClient,
  where: Prisma.ContractorWhereInput,
) {
  const [rows, total] = await Promise.all([
    prisma.contractor.findMany({ where, orderBy: { createdAt: "desc" } }),
    prisma.contractor.count({ where }),
  ]);
  return { rows, total };
}

/**
 * Create a new contractor.
 */
export async function createContractorRecord(
  prisma: PrismaClient,
  data: Prisma.ContractorUncheckedCreateInput,
) {
  return prisma.contractor.create({ data });
}

/**
 * Update a contractor by id.
 */
export async function updateContractorRecord(
  prisma: PrismaClient,
  id: string,
  data: Prisma.ContractorUncheckedUpdateInput,
) {
  return prisma.contractor.update({ where: { id }, data });
}

/**
 * Find contractor by id + org (for validation checks).
 */
export async function findContractorByOrgAndId(
  prisma: PrismaClient,
  id: string,
  orgId: string,
) {
  return prisma.contractor.findFirst({ where: { id, orgId } });
}

/**
 * Find a contractor by email within an org.
 * Used by resolveContractorId to map JWT email → contractor row.
 */
export async function findContractorByOrgAndEmail(
  prisma: PrismaClient,
  email: string,
  orgId: string,
): Promise<{ id: string } | null> {
  return prisma.contractor.findFirst({
    where: { email, orgId },
    select: { id: true },
  });
}

// ─── Triage queries ────────────────────────────────────────────

export type ContractorBasicForTriage = {
  id: string;
  name: string;
  serviceCategories: string;
};

export type ContractorJobHistory = {
  contractorId: string;
  totalJobs: number;
  completedJobs: number;
  onTimeRate: number;    // 0–1
  avgRating: number;     // 0–5 (0 = no ratings)
  categoryMatch: number; // 0 or 1
  buildingMatch: number; // 0 or 1
  invoiceAmounts: number[]; // CHF cents, PAID invoices filtered by category
};

/**
 * Return all active contractors for an org (lightweight).
 */
export async function findContractorsForTriage(
  prisma: PrismaClient,
  orgId: string,
): Promise<ContractorBasicForTriage[]> {
  return prisma.contractor.findMany({
    where: { orgId, isActive: true },
    select: { id: true, name: true, serviceCategories: true },
    orderBy: { name: "asc" },
  });
}

/**
 * Aggregate job history stats for all active contractors in an org.
 * Used by requestTriageService to compute scores.
 */
export async function findContractorJobHistories(
  prisma: PrismaClient,
  orgId: string,
  category: string | null | undefined,
  buildingId: string | null | undefined,
): Promise<Map<string, ContractorJobHistory>> {
  const contractors = await findContractorsForTriage(prisma, orgId);
  const result = new Map<string, ContractorJobHistory>();
  if (contractors.length === 0) return result;

  const contractorIds = contractors.map((c) => c.id);

  const jobs = await prisma.job.findMany({
    where: { orgId, contractorId: { in: contractorIds } },
    select: {
      id: true,
      contractorId: true,
      status: true,
      completedAt: true,
      schedulingExpiresAt: true,
      request: {
        select: {
          category: true,
          unit: {
            select: {
              building: { select: { id: true } },
            },
          },
        },
      },
      ratings: {
        select: { score: true },
      },
      invoices: {
        where: { status: "PAID" },
        select: { totalAmount: true },
      },
    },
  });

  for (const contractor of contractors) {
    const cJobs = jobs.filter((j) => j.contractorId === contractor.id);
    const totalJobs = cJobs.length;
    const completedJobs = cJobs.filter((j) => j.status === "COMPLETED").length;

    const onTimeJobs = cJobs.filter(
      (j) =>
        j.status === "COMPLETED" &&
        (!j.schedulingExpiresAt ||
          !j.completedAt ||
          j.completedAt <= j.schedulingExpiresAt),
    ).length;
    const onTimeRate = completedJobs > 0 ? onTimeJobs / completedJobs : 0;

    const allScores = cJobs.flatMap((j) => j.ratings.map((r) => r.score));
    const avgRating =
      allScores.length > 0
        ? allScores.reduce((a, b) => a + b, 0) / allScores.length
        : 0;

    const categoryMatch =
      category &&
      contractor.serviceCategories.toLowerCase().includes(category.toLowerCase())
        ? 1
        : 0;

    const buildingMatch =
      buildingId &&
      cJobs.some((j) => j.request?.unit?.building?.id === buildingId)
        ? 1
        : 0;

    // Invoice amounts scoped to the requested category
    const invoiceAmounts = cJobs
      .filter(
        (j) =>
          !category ||
          (j.request?.category &&
            j.request.category.toLowerCase() === category.toLowerCase()),
      )
      .flatMap((j) => j.invoices.map((inv) => inv.totalAmount));

    result.set(contractor.id, {
      contractorId: contractor.id,
      totalJobs,
      completedJobs,
      onTimeRate,
      avgRating,
      categoryMatch,
      buildingMatch,
      invoiceAmounts,
    });
  }

  return result;
}

/**
 * Write triage results back to the Request record.
 */
export async function updateRequestTriageFields(
  prisma: PrismaClient,
  requestId: string,
  data: {
    triageContractorIds: string[];
    triageBudgetMin: number | null;
    triageBudgetMax: number | null;
    triageCompletedAt: Date;
  },
): Promise<void> {
  await prisma.request.update({
    where: { id: requestId },
    data: {
      triageContractorIds: data.triageContractorIds,
      triageBudgetMin: data.triageBudgetMin,
      triageBudgetMax: data.triageBudgetMax,
      triageCompletedAt: data.triageCompletedAt,
    },
  });
}
