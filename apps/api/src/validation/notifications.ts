import { z } from 'zod';

export const NotificationEventTypeSchema = z.enum([
  'REQUEST_APPROVED',
  'REQUEST_PENDING_REVIEW',
  'REQUEST_PENDING_OWNER_APPROVAL',
  'CONTRACTOR_ASSIGNED',
  'CONTRACTOR_REJECTED',
  'JOB_CREATED',
  'JOB_STARTED',
  'JOB_COMPLETED',
  'INVOICE_CREATED',
  'INVOICE_APPROVED',
  'INVOICE_PAID',
  'INVOICE_DISPUTED',
  'OWNER_REJECTED',
  'TENANT_SELF_PAY_ACCEPTED',
  'TENANT_SELECTED',
  'LEASE_READY_TO_SIGN',
  'LEASE_SIGNED',
  'APPLICATION_SUBMITTED',
  'QUOTE_SUBMITTED',
  'QUOTE_AWARDED',
  'QUOTE_REJECTED',
  'SLOT_PROPOSED',
  'SLOT_ACCEPTED',
  'SLOT_DECLINED',
  'SCHEDULING_ESCALATED',
  'JOB_CONFIRMED',
  'RATING_SUBMITTED',
  'INVOICE_OVERDUE',
]);

export type NotificationEventType = z.infer<typeof NotificationEventTypeSchema>;

export const NotificationEntityTypeSchema = z.enum(['REQUEST', 'JOB', 'INVOICE', 'SELECTION', 'LEASE', 'APPLICATION', 'RFP', 'SCHEDULING', 'RATING']);

export type NotificationEntityType = z.infer<typeof NotificationEntityTypeSchema>;

// Schema for creating a notification (internal use)
export const CreateNotificationSchema = z.object({
  orgId: z.string().min(1),
  userId: z.string().min(1),
  buildingId: z.string().uuid().optional().nullable(),
  entityType: NotificationEntityTypeSchema,
  entityId: z.string().uuid(),
  eventType: NotificationEventTypeSchema,
  message: z.string().optional().nullable(),
});

export type CreateNotificationInput = z.infer<typeof CreateNotificationSchema>;

// Schema for marking notification as read
export const MarkNotificationReadSchema = z.object({
  id: z.string().uuid(),
  orgId: z.string().min(1),
});

// Notification DTO (returned from API)
export const NotificationDTOSchema = z.object({
  id: z.string(),
  orgId: z.string(),
  userId: z.string(),
  buildingId: z.string().nullable(),
  entityType: z.string(),
  entityId: z.string(),
  eventType: z.string(),
  message: z.string().nullable(),
  readAt: z.string().datetime().nullable(),
  createdAt: z.string().datetime(),
});

export type NotificationDTO = z.infer<typeof NotificationDTOSchema>;

// Query schema for listing notifications
export const ListNotificationsSchema = z.object({
  orgId: z.string().min(1),
  userId: z.string().min(1),
  unreadOnly: z.boolean().optional(),
  limit: z.number().int().positive().optional().default(20),
  offset: z.number().int().nonnegative().optional().default(0),
});

export type ListNotificationsInput = z.infer<typeof ListNotificationsSchema>;
