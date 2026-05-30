import { PrismaClient, Prisma, NotificationEventType } from '@prisma/client';

export const NOTIFICATION_PREFERENCE_INCLUDE = {} as const;

export type NotificationPreferenceRecord = Prisma.NotificationPreferenceGetPayload<{
  include: typeof NOTIFICATION_PREFERENCE_INCLUDE;
}>;

// ── Queries ──────────────────────────────────────────────────────────────────

export async function findPreferencesByUser(
  prisma: PrismaClient,
  userId: string,
  orgId: string,
): Promise<NotificationPreferenceRecord[]> {
  return prisma.notificationPreference.findMany({
    where: { userId, orgId },
  });
}

export async function findPreference(
  prisma: PrismaClient,
  userId: string,
  orgId: string,
  eventType: NotificationEventType,
): Promise<NotificationPreferenceRecord | null> {
  return prisma.notificationPreference.findUnique({
    where: { userId_orgId_eventType: { userId, orgId, eventType } },
  });
}

// ── Mutations ─────────────────────────────────────────────────────────────────

export async function upsertPreference(
  prisma: PrismaClient,
  userId: string,
  orgId: string,
  eventType: NotificationEventType,
  inApp: boolean,
): Promise<NotificationPreferenceRecord> {
  return prisma.notificationPreference.upsert({
    where: { userId_orgId_eventType: { userId, orgId, eventType } },
    create: { userId, orgId, eventType, inApp },
    update: { inApp },
  });
}

export async function bulkUpsertPreferences(
  prisma: PrismaClient,
  userId: string,
  orgId: string,
  prefs: Array<{ eventType: NotificationEventType; inApp: boolean }>,
): Promise<void> {
  await prisma.$transaction(
    prefs.map(({ eventType, inApp }) =>
      prisma.notificationPreference.upsert({
        where: { userId_orgId_eventType: { userId, orgId, eventType } },
        create: { userId, orgId, eventType, inApp },
        update: { inApp },
      }),
    ),
  );
}

// ── Default helper ────────────────────────────────────────────────────────────

/**
 * Returns inApp preference for a given user+event.
 * Absent row = true (opt-out model: default is ON).
 */
export async function isInAppEnabled(
  prisma: PrismaClient,
  userId: string,
  orgId: string,
  eventType: NotificationEventType,
): Promise<boolean> {
  const pref = await findPreference(prisma, userId, orgId, eventType);
  return pref === null ? true : pref.inApp;
}
