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
  rfpId?: string | null;
  newStatus?: string;
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
  amount?: number;
  jobId?: string;
}

export interface InvoiceApprovedPayload {
  invoiceId: string;
  amount?: number;
  jobId?: string;
}

export interface InvoicePaidPayload {
  invoiceId: string;
  amount?: number;
  jobId?: string;
  jobTransitioned?: boolean;
}

export interface InvoiceDisputedPayload {
  invoiceId: string;
  reason?: string | null;
  jobId?: string;
}

export interface LeaseStatusChangedPayload {
  leaseId: string;
  fromStatus: string;
  toStatus: string;
}

export interface RentalApplicationSubmittedPayload {
  applicationId: string;
  unitIds: string[];
  applicantName: string;
}

export interface RentalApplicationEvaluatedPayload {
  applicationId: string;
  unitEvaluations: Array<{
    unitId: string;
    scoreTotal: number;
    disqualified: boolean;
  }>;
}

export interface LegalAutoRoutedPayload {
  requestId: string;
  obligation: string;       // LegalObligation enum value
  rfpId: string | null;     // non-null when OBLIGATED → RFP created
  previousStatus: string;
  newStatus: string;
}

export interface ContractorAssignedPayload {
  requestId: string;
  contractorId: string;
  jobCreated: boolean;
}

export interface ContractorUnassignedPayload {
  requestId: string;
}

export interface JobCompletedPayload {
  jobId: string;
  requestId: string;
  invoiceAutoCreated: boolean;
}

export interface MaintenanceAttachmentUploadedPayload {
  attachmentId: string;
  requestId: string;
  fileName: string;
}

export interface TenantSelfPayAcceptedPayload {
  requestId: string;
  tenantId: string;
  rfpId: string;
}

/* ── Event map: type → payload ──────────────────────────────── */

export interface DomainEventMap {
  REQUEST_CREATED: RequestCreatedPayload;
  REQUEST_APPROVED: RequestApprovedPayload;
  REQUEST_STATUS_CHANGED: RequestStatusChangedPayload;
  LEGAL_AUTO_ROUTED: LegalAutoRoutedPayload;
  OWNER_APPROVED: RequestApprovedPayload;
  OWNER_REJECTED: RequestRejectedPayload;
  CONTRACTOR_ASSIGNED: ContractorAssignedPayload;
  CONTRACTOR_UNASSIGNED: ContractorUnassignedPayload;
  JOB_CREATED: JobCreatedPayload;
  JOB_COMPLETED: JobCompletedPayload;
  INVOICE_ISSUED: InvoiceIssuedPayload;
  INVOICE_APPROVED: InvoiceApprovedPayload;
  INVOICE_PAID: InvoicePaidPayload;
  INVOICE_DISPUTED: InvoiceDisputedPayload;
  LEASE_STATUS_CHANGED: LeaseStatusChangedPayload;
  RENTAL_APPLICATION_SUBMITTED: RentalApplicationSubmittedPayload;
  RENTAL_APPLICATION_EVALUATED: RentalApplicationEvaluatedPayload;
  MAINTENANCE_ATTACHMENT_UPLOADED: MaintenanceAttachmentUploadedPayload;
  TENANT_SELF_PAY_ACCEPTED: TenantSelfPayAcceptedPayload;
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
