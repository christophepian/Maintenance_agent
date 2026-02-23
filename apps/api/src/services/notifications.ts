import { PrismaClient } from '@prisma/client';
import {
  CreateNotificationInput,
  NotificationDTO,
  NotificationEventType,
  ListNotificationsInput,
} from '../validation/notifications';

const prisma = new PrismaClient();

/**
 * Create or update a notification (idempotent via unique constraint)
 * If a notification with the same org, user, entity, and event already exists, it's re-created with updated timestamp
 */
export async function createNotification(
  input: CreateNotificationInput
): Promise<NotificationDTO> {
  // First, try to delete any existing notification with the same unique key
  // This ensures we always get a fresh timestamp
  await prisma.notification.deleteMany({
    where: {
      orgId: input.orgId,
      userId: input.userId,
      entityType: input.entityType,
      entityId: input.entityId,
      eventType: input.eventType,
    },
  });

  const notification = await prisma.notification.create({
    data: {
      orgId: input.orgId,
      userId: input.userId,
      buildingId: input.buildingId || null,
      entityType: input.entityType,
      entityId: input.entityId,
      eventType: input.eventType,
      message: input.message || null,
      readAt: null,
    },
  });

  return mapNotificationToDTO(notification);
}

/**
 * Get unread notifications for a user
 */
export async function getUserNotifications(
  input: ListNotificationsInput
): Promise<{ notifications: NotificationDTO[]; total: number }> {
  const unreadOnly = input.unreadOnly ?? false;
  const limit = input.limit ?? 20;
  const offset = input.offset ?? 0;

  const where = {
    orgId: input.orgId,
    userId: input.userId,
    ...(unreadOnly && { readAt: null }),
  };

  const [notifications, total] = await Promise.all([
    prisma.notification.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      take: limit,
      skip: offset,
    }),
    prisma.notification.count({ where }),
  ]);

  return {
    notifications: notifications.map(mapNotificationToDTO),
    total,
  };
}

/**
 * Mark a notification as read
 */
export async function markNotificationAsRead(
  notificationId: string,
  orgId: string
): Promise<NotificationDTO> {
  const notification = await prisma.notification.update({
    where: { id: notificationId },
    data: { readAt: new Date() },
  });

  // Verify org ownership
  if (notification.orgId !== orgId) {
    throw new Error('Notification does not belong to this org');
  }

  return mapNotificationToDTO(notification);
}

/**
 * Mark all unread notifications for a user as read
 */
export async function markAllNotificationsAsRead(
  orgId: string,
  userId: string
): Promise<number> {
  const result = await prisma.notification.updateMany({
    where: {
      orgId,
      userId,
      readAt: null,
    },
    data: { readAt: new Date() },
  });

  return result.count;
}

/**
 * Delete (dismiss) a notification
 */
export async function deleteNotification(
  notificationId: string,
  orgId: string
): Promise<void> {
  const notification = await prisma.notification.findUniqueOrThrow({
    where: { id: notificationId },
  });

  // Verify org ownership
  if (notification.orgId !== orgId) {
    throw new Error('Notification does not belong to this org');
  }

  await prisma.notification.delete({
    where: { id: notificationId },
  });
}

/**
 * Get unread count for a user
 */
export async function getUnreadNotificationCount(
  orgId: string,
  userId: string
): Promise<number> {
  return prisma.notification.count({
    where: {
      orgId,
      userId,
      readAt: null,
    },
  });
}

/**
 * Create notifications for request approval event
 * Notifies: tenant (if request has unit), contractors (if contractor assigned)
 */
export async function notifyRequestApproved(
  requestId: string,
  orgId: string,
  tenantId?: string,
  contractorId?: string,
  buildingId?: string
): Promise<void> {
  const notifications: CreateNotificationInput[] = [];

  // Notify tenant that request was approved and contractor assigned
  if (tenantId) {
    notifications.push({
      orgId,
      userId: tenantId,
      buildingId,
      entityType: 'REQUEST',
      entityId: requestId,
      eventType: 'REQUEST_APPROVED',
      message: 'Your request has been approved. A contractor has been assigned.',
    });
  }

  // Notify contractor of assignment
  if (contractorId) {
    notifications.push({
      orgId,
      userId: contractorId,
      buildingId,
      entityType: 'REQUEST',
      entityId: requestId,
      eventType: 'CONTRACTOR_ASSIGNED',
      message: 'You have been assigned a new maintenance request.',
    });
  }

  for (const notif of notifications) {
    await createNotification(notif);
  }
}

/**
 * Create notification for pending owner approval
 */
export async function notifyRequestPendingOwnerApproval(
  requestId: string,
  orgId: string,
  ownerId: string,
  buildingId?: string
): Promise<void> {
  await createNotification({
    orgId,
    userId: ownerId,
    buildingId,
    entityType: 'REQUEST',
    entityId: requestId,
    eventType: 'REQUEST_PENDING_OWNER_APPROVAL',
    message: 'A maintenance request requires your approval.',
  });
}

/**
 * Create notification for pending manager review
 */
export async function notifyRequestPendingReview(
  requestId: string,
  orgId: string,
  managerId: string,
  buildingId?: string
): Promise<void> {
  await createNotification({
    orgId,
    userId: managerId,
    buildingId,
    entityType: 'REQUEST',
    entityId: requestId,
    eventType: 'REQUEST_PENDING_REVIEW',
    message: 'A maintenance request requires your review.',
  });
}

/**
 * Create notification for owner rejection
 */
export async function notifyOwnerRejected(
  requestId: string,
  orgId: string,
  managerId: string,
  buildingId?: string
): Promise<void> {
  await createNotification({
    orgId,
    userId: managerId,
    buildingId,
    entityType: 'REQUEST',
    entityId: requestId,
    eventType: 'OWNER_REJECTED',
    message: 'A maintenance request has been rejected by the owner.',
  });
}

/**
 * Create notification for invoice status changes
 */
export async function notifyInvoiceStatusChanged(
  invoiceId: string,
  orgId: string,
  recipientId: string,
  eventType: 'INVOICE_CREATED' | 'INVOICE_APPROVED' | 'INVOICE_PAID' | 'INVOICE_DISPUTED',
  buildingId?: string
): Promise<void> {
  const messages: Record<string, string> = {
    INVOICE_CREATED: 'A new invoice has been created.',
    INVOICE_APPROVED: 'An invoice has been approved.',
    INVOICE_PAID: 'An invoice has been marked as paid.',
    INVOICE_DISPUTED: 'An invoice has been disputed.',
  };

  await createNotification({
    orgId,
    userId: recipientId,
    buildingId,
    entityType: 'INVOICE',
    entityId: invoiceId,
    eventType: eventType as NotificationEventType,
    message: messages[eventType],
  });
}

/**
 * Create notification for job status changes
 */
export async function notifyJobStatusChanged(
  jobId: string,
  orgId: string,
  recipientId: string,
  eventType: 'JOB_CREATED' | 'JOB_STARTED' | 'JOB_COMPLETED',
  buildingId?: string
): Promise<void> {
  const messages: Record<string, string> = {
    JOB_CREATED: 'A new job has been created.',
    JOB_STARTED: 'A job has been started.',
    JOB_COMPLETED: 'A job has been completed.',
  };

  await createNotification({
    orgId,
    userId: recipientId,
    buildingId,
    entityType: 'JOB',
    entityId: jobId,
    eventType: eventType as NotificationEventType,
    message: messages[eventType],
  });
}

/**
 * Helper: map Prisma notification to DTO
 */
function mapNotificationToDTO(notification: any): NotificationDTO {
  return {
    id: notification.id,
    orgId: notification.orgId,
    userId: notification.userId,
    buildingId: notification.buildingId,
    entityType: notification.entityType,
    entityId: notification.entityId,
    eventType: notification.eventType,
    message: notification.message,
    readAt: notification.readAt ? notification.readAt.toISOString() : null,
    createdAt: notification.createdAt.toISOString(),
  };
}
