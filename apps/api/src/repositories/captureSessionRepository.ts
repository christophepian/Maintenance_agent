/**
 * Capture Session Repository
 *
 * G9: Canonical Prisma access for the CaptureSession model.
 * All queries use the exported CAPTURE_SESSION_INCLUDE constant.
 */

import { Prisma, CaptureSessionStatus } from "@prisma/client";
import prisma from "../services/prismaClient";

/* ──────────────────────────────────────────────────────────
   G9: Canonical include constant
   ────────────────────────────────────────────────────────── */

export const CAPTURE_SESSION_INCLUDE = {} as const satisfies Prisma.CaptureSessionInclude;

/** Compile-time type for a CaptureSession row loaded with CAPTURE_SESSION_INCLUDE. */
export type CaptureSessionWithInclude = Prisma.CaptureSessionGetPayload<{
  include: typeof CAPTURE_SESSION_INCLUDE;
}>;

/* ──────────────────────────────────────────────────────────
   Repository functions
   ────────────────────────────────────────────────────────── */

export async function createCaptureSession(
  data: Prisma.CaptureSessionCreateInput,
): Promise<CaptureSessionWithInclude> {
  return prisma.captureSession.create({
    data,
    include: CAPTURE_SESSION_INCLUDE,
  });
}

export async function findCaptureSessionByToken(
  token: string,
): Promise<CaptureSessionWithInclude | null> {
  return prisma.captureSession.findUnique({
    where: { token },
    include: CAPTURE_SESSION_INCLUDE,
  });
}

export async function findCaptureSessionById(
  id: string,
): Promise<CaptureSessionWithInclude | null> {
  return prisma.captureSession.findUnique({
    where: { id },
    include: CAPTURE_SESSION_INCLUDE,
  });
}

export async function updateCaptureSession(
  id: string,
  data: Prisma.CaptureSessionUpdateInput,
): Promise<CaptureSessionWithInclude> {
  return prisma.captureSession.update({
    where: { id },
    data,
    include: CAPTURE_SESSION_INCLUDE,
  });
}

export async function listCaptureSessionsByOrg(
  orgId: string,
  filters?: { status?: CaptureSessionStatus },
): Promise<CaptureSessionWithInclude[]> {
  const where: Prisma.CaptureSessionWhereInput = { orgId };
  if (filters?.status) where.status = filters.status;

  return prisma.captureSession.findMany({
    where,
    include: CAPTURE_SESSION_INCLUDE,
    orderBy: { createdAt: "desc" },
  });
}

/**
 * Mark expired sessions as EXPIRED.
 * Called periodically or on-demand to clean up stale sessions.
 */
export async function expireOldSessions(): Promise<number> {
  const result = await prisma.captureSession.updateMany({
    where: {
      status: { in: ["CREATED", "ACTIVE"] },
      expiresAt: { lt: new Date() },
    },
    data: { status: "EXPIRED" },
  });
  return result.count;
}
