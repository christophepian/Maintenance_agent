import { PrismaClient } from "@prisma/client";

const MAX_RETRIES = 3;

export async function enqueue(
  prisma: PrismaClient,
  orgId: string,
  toPhone: string,
  body: string,
) {
  return prisma.whatsAppOutbox.create({
    data: { orgId, toPhone, body },
  });
}

export async function dequeuePending(prisma: PrismaClient, limit = 20) {
  return prisma.whatsAppOutbox.findMany({
    where: { status: "PENDING", retryCount: { lt: MAX_RETRIES } },
    orderBy: { createdAt: "asc" },
    take: limit,
  });
}

export async function markSent(prisma: PrismaClient, id: string) {
  return prisma.whatsAppOutbox.update({
    where: { id },
    data: { status: "SENT", sentAt: new Date() },
  });
}

export async function markFailed(
  prisma: PrismaClient,
  id: string,
  errorMessage: string,
) {
  return prisma.whatsAppOutbox.update({
    where: { id },
    data: { status: "FAILED", errorMessage },
  });
}

export async function incrementRetry(prisma: PrismaClient, id: string) {
  return prisma.whatsAppOutbox.update({
    where: { id },
    data: { retryCount: { increment: 1 } },
  });
}
