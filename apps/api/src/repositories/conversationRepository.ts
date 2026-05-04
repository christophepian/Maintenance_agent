/**
 * Conversation Repository
 *
 * Centralizes all Prisma access for ConversationThread and ConversationMessage.
 * Used by conversationService — never called directly from routes.
 *
 * Note: ConversationChannel and ConversationRole are local string unions until
 * `prisma migrate dev` + `prisma generate` run and emit the enums to @prisma/client.
 */

import { PrismaClient, ConversationChannel, ConversationRole } from "@prisma/client";

export type { ConversationChannel, ConversationRole };

type AnyPrisma = PrismaClient;

// ─── Canonical Include ─────────────────────────────────────────────────────────

export const THREAD_WITH_MESSAGES_INCLUDE = {
  messages: {
    orderBy: { createdAt: "asc" as const },
    take: 20,
  },
} as const;

// ─── Queries ───────────────────────────────────────────────────────────────────

/**
 * Find or create the single thread for a tenant+channel combination.
 * ConversationThread has a unique constraint on [tenantId, channel].
 */
export async function findOrCreateThread(
  prisma: PrismaClient,
  tenantId: string,
  orgId: string,
  channel: ConversationChannel
) {
  const db = prisma as AnyPrisma;
  return db.conversationThread.upsert({
    where: { tenantId_channel: { tenantId, channel } },
    create: { tenantId, orgId, channel },
    update: {},
    include: THREAD_WITH_MESSAGES_INCLUDE,
  });
}

/**
 * Fetch recent messages for a thread, oldest-first, for LLM context window.
 */
export async function getRecentMessages(
  prisma: PrismaClient,
  threadId: string,
  limit = 10
): Promise<Array<{ role: ConversationRole; content: string; intent: string | null; createdAt: Date }>> {
  const db = prisma as AnyPrisma;
  const msgs = await db.conversationMessage.findMany({
    where: { threadId },
    orderBy: { createdAt: "desc" as const },
    take: limit,
    select: { role: true, content: true, intent: true, createdAt: true },
  });
  return (msgs as Array<{ role: ConversationRole; content: string; intent: string | null; createdAt: Date }>).reverse();
}

/**
 * Persist a single conversation turn (inbound or outbound).
 */
export async function addMessage(
  prisma: PrismaClient,
  threadId: string,
  role: ConversationRole,
  content: string,
  intent?: string
) {
  const db = prisma as AnyPrisma;
  return db.conversationMessage.create({
    data: { threadId, role, content, intent: intent ?? null },
  });
}

/**
 * Fetch the 20 most recent messages for a thread, oldest-first.
 * Used by the history endpoint.
 */
export async function getThreadHistory(
  prisma: PrismaClient,
  tenantId: string,
  channel: ConversationChannel
): Promise<Array<{ role: ConversationRole; content: string; intent: string | null; createdAt: Date }>> {
  const db = prisma as AnyPrisma;
  const thread = await db.conversationThread.findUnique({
    where: { tenantId_channel: { tenantId, channel } },
    include: {
      messages: {
        orderBy: { createdAt: "asc" as const },
        take: 20,
        select: { role: true, content: true, intent: true, createdAt: true },
      },
    },
  });
  return thread?.messages ?? [];
}
