/**
 * Correspondence Repository
 *
 * Canonical include constants (G9) and query helpers for the Letter /
 * LetterRecipient / LetterResponse entities.
 */

import { PrismaClient, LetterStatus } from "@prisma/client";

// ─── Canonical Includes ────────────────────────────────────────

export const LETTER_LIST_INCLUDE = {
  _count: { select: { recipients: true, responses: true } },
} as const;

export const LETTER_DETAIL_INCLUDE = {
  recipients: {
    include: { tenant: { select: { id: true, name: true, email: true, phone: true } } },
  },
  responses: {
    include: { tenant: { select: { id: true, name: true } } },
    orderBy: { createdAt: "asc" as const },
  },
} as const;

export const LETTER_RECIPIENT_BUILDING_INCLUDE = {
  tenant: {
    include: {
      occupancies: {
        include: { unit: { include: { building: { select: { name: true } } } } },
        take: 1,
      },
    },
  },
} as const;

export const TENANT_INBOX_INCLUDE = {
  letter: { select: { id: true, subject: true, sentAt: true, templateType: true } },
} as const;

export const OWNER_LETTER_LIST_INCLUDE = {
  _count: { select: { recipients: true } },
} as const;

// ─── Query Functions ───────────────────────────────────────────

export async function findLettersByOrg(prisma: PrismaClient, orgId: string) {
  return prisma.letter.findMany({
    where: { orgId },
    include: LETTER_LIST_INCLUDE,
    orderBy: { createdAt: "desc" },
  });
}

export async function findLetterDetail(prisma: PrismaClient, id: string, orgId: string) {
  return prisma.letter.findFirst({
    where: { id, orgId },
    include: LETTER_DETAIL_INCLUDE,
  });
}

export async function findLetterByIdAndOrg(prisma: PrismaClient, id: string, orgId: string) {
  return prisma.letter.findFirst({ where: { id, orgId } });
}

export async function findFirstRecipientWithBuilding(prisma: PrismaClient, letterId: string) {
  return prisma.letterRecipient.findFirst({
    where: { letterId },
    include: LETTER_RECIPIENT_BUILDING_INCLUDE,
  });
}

export async function findTenantInbox(
  prisma: PrismaClient,
  tenantId: string,
  orgId: string,
) {
  return prisma.letterRecipient.findMany({
    where: { tenantId, letter: { orgId, status: LetterStatus.SENT } },
    include: TENANT_INBOX_INCLUDE,
    orderBy: { letter: { sentAt: "desc" } },
  });
}

export async function findTenantLetterRead(
  prisma: PrismaClient,
  letterId: string,
  tenantId: string,
) {
  return prisma.letterRecipient.findUnique({
    where: { letterId_tenantId: { letterId, tenantId } },
    include: {
      letter: {
        include: {
          responses: {
            where: { tenantId },
            orderBy: { createdAt: "asc" as const },
          },
        },
      },
    },
  });
}

export async function findSentLettersForTenants(
  prisma: PrismaClient,
  orgId: string,
  tenantIds: string[],
  buildingId?: string,
) {
  void buildingId; // filtering done by caller before passing tenantIds
  return prisma.letter.findMany({
    where: {
      orgId,
      status: LetterStatus.SENT,
      recipients: { some: { tenantId: { in: tenantIds } } },
    },
    include: OWNER_LETTER_LIST_INCLUDE,
    orderBy: { sentAt: "desc" },
  });
}
