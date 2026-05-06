/**
 * Notification Repository
 *
 * Centralizes all Prisma access for the Notification model.
 * G3/G9: canonical query/mutation helpers — no inline include trees in services.
 */

import { PrismaClient, Prisma } from "@prisma/client";

// ─── Query Functions ──────────────────────────────────────────

/** Delete all notifications matching a where clause (idempotent upsert helper). */
export async function deleteMatchingNotifications(
  prisma: PrismaClient,
  where: Prisma.NotificationWhereInput,
) {
  return prisma.notification.deleteMany({ where });
}

/** Create a new notification record. */
export async function createNotificationRecord(
  prisma: PrismaClient,
  data: Prisma.NotificationUncheckedCreateInput,
) {
  return prisma.notification.create({ data });
}

/** Find notifications + total count for a user (paginated). */
export async function findNotificationsWithCount(
  prisma: PrismaClient,
  where: Prisma.NotificationWhereInput,
  limit: number,
  offset: number,
) {
  return Promise.all([
    prisma.notification.findMany({
      where,
      orderBy: { createdAt: "desc" },
      take: limit,
      skip: offset,
    }),
    prisma.notification.count({ where }),
  ]);
}

/** Update a single notification by ID. */
export async function updateNotificationRecord(
  prisma: PrismaClient,
  id: string,
  data: Prisma.NotificationUncheckedUpdateInput,
) {
  return prisma.notification.update({ where: { id }, data });
}

/** Mark all unread notifications for a user as read. Returns count. */
export async function markAllNotificationsAsRead(
  prisma: PrismaClient,
  orgId: string,
  userId: string,
) {
  const result = await prisma.notification.updateMany({
    where: { orgId, userId, readAt: null },
    data: { readAt: new Date() },
  });
  return result.count;
}

/** Find a notification by ID; throws if not found. */
export async function findNotificationByIdOrThrow(
  prisma: PrismaClient,
  id: string,
) {
  return prisma.notification.findUniqueOrThrow({ where: { id } });
}

/** Delete a single notification by ID. */
export async function deleteNotificationRecord(
  prisma: PrismaClient,
  id: string,
) {
  return prisma.notification.delete({ where: { id } });
}

/** Count notifications matching a where clause. */
export async function countNotifications(
  prisma: PrismaClient,
  where: Prisma.NotificationWhereInput,
) {
  return prisma.notification.count({ where });
}
