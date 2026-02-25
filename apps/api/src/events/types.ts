/**
 * Typed domain event definitions.
 *
 * Every domain event has a discriminated `type` field and a typed
 * `payload`.  Handlers register for specific event types and receive
 * the full `DomainEvent` object.
 *
 * Events are fire-and-forget within the current process; they are
 * NOT distributed across replicas (yet).  The event bus persists
 * them to the `Event` table for audit/replay.
 *
 * To add a new event:
 * 1. Add an entry to `DomainEventMap` below.
 * 2. Optionally add a handler in `events/handlers.ts`.
 */

/* ── Event payload types ────────────────────────────────────── */

export interface RequestApprovedPayload {
  requestId: string;
  comment?: string | null;
}

export interface RequestRejectedPayload {
  requestId: string;
  reason?: string | null;
}

export interface RequestCreatedPayload {
  requestId: string;
  category?: string | null;
  description: string;
}

export interface RequestStatusChangedPayload {
  requestId: string;
  fromStatus: string;
  toStatus: string;
}

export interface JobCreatedPayload {
  jobId: string;
  requestId: string;
}

export interface InvoiceIssuedPayload {
  invoiceId: string;
  amount: number;
}

export interface InvoiceApprovedPayload {
  invoiceId: string;
  amount: number;
}

export interface InvoicePaidPayload {
  invoiceId: string;
  amount: number;
}

export interface InvoiceDisputedPayload {
  invoiceId: string;
  reason?: string | null;
}

export interface LeaseStatusChangedPayload {
  leaseId: string;
  fromStatus: string;
  toStatus: string;
}

/* ── Event map: type → payload ──────────────────────────────── */

export interface DomainEventMap {
  REQUEST_CREATED: RequestCreatedPayload;
  REQUEST_STATUS_CHANGED: RequestStatusChangedPayload;
  OWNER_APPROVED: RequestApprovedPayload;
  OWNER_REJECTED: RequestRejectedPayload;
  JOB_CREATED: JobCreatedPayload;
  INVOICE_ISSUED: InvoiceIssuedPayload;
  INVOICE_APPROVED: InvoiceApprovedPayload;
  INVOICE_PAID: InvoicePaidPayload;
  INVOICE_DISPUTED: InvoiceDisputedPayload;
  LEASE_STATUS_CHANGED: LeaseStatusChangedPayload;
}

export type DomainEventType = keyof DomainEventMap;

/* ── Domain event envelope ──────────────────────────────────── */

export interface DomainEvent<T extends DomainEventType = DomainEventType> {
  /** Discriminated event type */
  type: T;
  /** The org this event belongs to */
  orgId: string;
  /** User who triggered the action (null for system events) */
  actorUserId?: string | null;
  /** Typed payload */
  payload: DomainEventMap[T];
  /** Timestamp (ISO 8601) — auto-set by the bus if omitted */
  timestamp?: string;
}
