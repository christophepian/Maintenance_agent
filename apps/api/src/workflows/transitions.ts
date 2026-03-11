/**
 * State Transition Discipline
 *
 * Central transition policies for domain entities.
 * All status changes MUST go through these helpers so that
 * invalid transitions are rejected in exactly one place.
 */

import { RequestStatus, JobStatus, InvoiceStatus, LeaseStatus } from "@prisma/client";

// ─── Request Transitions ───────────────────────────────────────

const VALID_REQUEST_TRANSITIONS: Record<string, RequestStatus[]> = {
  [RequestStatus.PENDING_REVIEW]: [
    RequestStatus.RFP_PENDING,               // legal obligation → RFP
    RequestStatus.PENDING_OWNER_APPROVAL,    // no/unknown obligation → owner
  ],
  [RequestStatus.RFP_PENDING]: [
    RequestStatus.AUTO_APPROVED,             // avg quotes ≤ threshold
    RequestStatus.PENDING_OWNER_APPROVAL,    // avg quotes > threshold
  ],
  [RequestStatus.PENDING_OWNER_APPROVAL]: [
    RequestStatus.APPROVED,                  // owner approves (post-RFP cost approval)
    RequestStatus.RFP_PENDING,               // owner approves → RFP created
    RequestStatus.OWNER_REJECTED,            // owner rejects (terminal)
  ],
  [RequestStatus.AUTO_APPROVED]: [
    RequestStatus.IN_PROGRESS,               // contractor books appointment
  ],
  [RequestStatus.APPROVED]: [
    RequestStatus.ASSIGNED,
    RequestStatus.IN_PROGRESS,
  ],
  [RequestStatus.ASSIGNED]: [
    RequestStatus.IN_PROGRESS,
    RequestStatus.COMPLETED,
  ],
  [RequestStatus.IN_PROGRESS]: [
    RequestStatus.COMPLETED,
  ],
  [RequestStatus.COMPLETED]: [],
  [RequestStatus.OWNER_REJECTED]: [],        // terminal
};

export class InvalidTransitionError extends Error {
  public readonly code = "INVALID_TRANSITION";
  constructor(entity: string, from: string, to: string) {
    super(`Cannot transition ${entity} from ${from} to ${to}`);
    this.name = "InvalidTransitionError";
  }
}

/**
 * Assert that a request status transition is valid.
 * Throws InvalidTransitionError if not.
 */
export function assertRequestTransition(
  from: RequestStatus,
  to: RequestStatus,
): void {
  const allowed = VALID_REQUEST_TRANSITIONS[from];
  if (!allowed || !allowed.includes(to)) {
    throw new InvalidTransitionError("Request", from, to);
  }
}

/**
 * Check if a request status transition is valid (non-throwing).
 */
export function canTransitionRequest(from: RequestStatus, to: RequestStatus): boolean {
  const allowed = VALID_REQUEST_TRANSITIONS[from];
  return !!allowed && allowed.includes(to);
}

// ─── Job Transitions ───────────────────────────────────────────

const VALID_JOB_TRANSITIONS: Record<string, JobStatus[]> = {
  [JobStatus.PENDING]: [JobStatus.IN_PROGRESS, JobStatus.COMPLETED],
  [JobStatus.IN_PROGRESS]: [JobStatus.COMPLETED],
  [JobStatus.COMPLETED]: [JobStatus.INVOICED],
  [JobStatus.INVOICED]: [],
};

export function assertJobTransition(from: JobStatus, to: JobStatus): void {
  const allowed = VALID_JOB_TRANSITIONS[from];
  if (!allowed || !allowed.includes(to)) {
    throw new InvalidTransitionError("Job", from, to);
  }
}

export function canTransitionJob(from: JobStatus, to: JobStatus): boolean {
  const allowed = VALID_JOB_TRANSITIONS[from];
  return !!allowed && allowed.includes(to);
}

// ─── Invoice Transitions ───────────────────────────────────────

const VALID_INVOICE_TRANSITIONS: Record<string, InvoiceStatus[]> = {
  [InvoiceStatus.DRAFT]: [InvoiceStatus.ISSUED, InvoiceStatus.APPROVED],
  [InvoiceStatus.ISSUED]: [InvoiceStatus.APPROVED, InvoiceStatus.DISPUTED],
  [InvoiceStatus.APPROVED]: [InvoiceStatus.PAID, InvoiceStatus.DISPUTED],
  [InvoiceStatus.DISPUTED]: [InvoiceStatus.APPROVED, InvoiceStatus.DRAFT],
  [InvoiceStatus.PAID]: [],
};

export function assertInvoiceTransition(from: InvoiceStatus, to: InvoiceStatus): void {
  const allowed = VALID_INVOICE_TRANSITIONS[from];
  if (!allowed || !allowed.includes(to)) {
    throw new InvalidTransitionError("Invoice", from, to);
  }
}

export function canTransitionInvoice(from: InvoiceStatus, to: InvoiceStatus): boolean {
  const allowed = VALID_INVOICE_TRANSITIONS[from];
  return !!allowed && allowed.includes(to);
}

// ─── Lease Transitions ─────────────────────────────────────────

const VALID_LEASE_TRANSITIONS: Record<string, LeaseStatus[]> = {
  [LeaseStatus.DRAFT]: [LeaseStatus.READY_TO_SIGN, LeaseStatus.CANCELLED],
  [LeaseStatus.READY_TO_SIGN]: [LeaseStatus.SIGNED, LeaseStatus.CANCELLED],
  [LeaseStatus.SIGNED]: [LeaseStatus.ACTIVE],
  [LeaseStatus.ACTIVE]: [LeaseStatus.TERMINATED],
  [LeaseStatus.TERMINATED]: [],
  [LeaseStatus.CANCELLED]: [],
};

export function assertLeaseTransition(from: LeaseStatus, to: LeaseStatus): void {
  const allowed = VALID_LEASE_TRANSITIONS[from];
  if (!allowed || !allowed.includes(to)) {
    throw new InvalidTransitionError("Lease", from, to);
  }
}

export function canTransitionLease(from: LeaseStatus, to: LeaseStatus): boolean {
  const allowed = VALID_LEASE_TRANSITIONS[from];
  return !!allowed && allowed.includes(to);
}

// ─── Rental Application Transitions ────────────────────────────

/**
 * Rental applications use string statuses (not Prisma enum for
 * ApplicationUnitStatus).  The application-level lifecycle is:
 *   DRAFT → SUBMITTED
 * The per-unit lifecycle is managed separately by ownerSelection.
 */
const VALID_RENTAL_APPLICATION_TRANSITIONS: Record<string, string[]> = {
  DRAFT: ["SUBMITTED"],
  SUBMITTED: [], // terminal for the application itself
};

export function assertRentalApplicationTransition(from: string, to: string): void {
  const allowed = VALID_RENTAL_APPLICATION_TRANSITIONS[from];
  if (!allowed || !allowed.includes(to)) {
    throw new InvalidTransitionError("RentalApplication", from, to);
  }
}

export function canTransitionRentalApplication(from: string, to: string): boolean {
  const allowed = VALID_RENTAL_APPLICATION_TRANSITIONS[from];
  return !!allowed && allowed.includes(to);
}
