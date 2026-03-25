/**
 * Rating Repository
 *
 * Centralizes all Prisma access for the JobRating entity.
 * Owns canonical include trees so that DTO mappers always receive
 * the correct shape.
 *
 * G3: include must match what DTO mappers access.
 * G9: canonical include constants live here.
 */

import { PrismaClient, RaterRole, Prisma } from "@prisma/client";

// ─── Canonical Includes ────────────────────────────────────────

export const RATING_INCLUDE = {
  job: {
    select: {
      id: true,
      requestId: true,
      contractorId: true,
      request: {
        select: {
          description: true,
          unit: {
            select: {
              unitNumber: true,
              building: { select: { name: true } },
            },
          },
        },
      },
    },
  },
} as const;

export type RatingWithJob = Prisma.JobRatingGetPayload<{ include: typeof RATING_INCLUDE }>;

// ─── Query Functions ───────────────────────────────────────────

/**
 * Create a rating for a job. Unique constraint on [jobId, raterRole]
 * prevents duplicates.
 */
export async function createRating(
  prisma: PrismaClient,
  data: {
    orgId: string;
    jobId: string;
    raterRole: RaterRole;
    score: number;
    scorePunctuality?: number | null;
    scoreAccuracy?: number | null;
    scoreCourtesy?: number | null;
    comment?: string | null;
  },
) {
  return prisma.jobRating.create({
    data: {
      orgId: data.orgId,
      jobId: data.jobId,
      raterRole: data.raterRole,
      score: data.score,
      scorePunctuality: data.scorePunctuality ?? null,
      scoreAccuracy:    data.scoreAccuracy    ?? null,
      scoreCourtesy:    data.scoreCourtesy    ?? null,
      comment: data.comment ?? null,
    },
    include: RATING_INCLUDE,
  });
}

/**
 * Find a rating by job and rater role (check for duplicate).
 */
export async function findRatingForJobByRole(
  prisma: PrismaClient,
  jobId: string,
  raterRole: RaterRole,
) {
  return prisma.jobRating.findUnique({
    where: { jobId_raterRole: { jobId, raterRole } },
  });
}

/**
 * Find all ratings for a specific job.
 */
export async function findRatingsByJobId(prisma: PrismaClient, jobId: string) {
  return prisma.jobRating.findMany({
    where: { jobId },
    include: RATING_INCLUDE,
    orderBy: { createdAt: "desc" },
  });
}

/**
 * Find all ratings for jobs assigned to a specific contractor.
 * Used for contractor history / reputation.
 */
export async function findRatingsByContractorId(
  prisma: PrismaClient,
  contractorId: string,
  opts?: { limit?: number; offset?: number },
) {
  const limit = opts?.limit ?? 50;
  const offset = opts?.offset ?? 0;

  const where = {
    job: { contractorId },
  };

  const [ratings, total] = await Promise.all([
    prisma.jobRating.findMany({
      where,
      include: RATING_INCLUDE,
      orderBy: { createdAt: "desc" },
      take: limit,
      skip: offset,
    }),
    prisma.jobRating.count({ where }),
  ]);

  return { ratings, total };
}
