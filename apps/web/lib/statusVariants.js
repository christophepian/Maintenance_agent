/**
 * Shared status → Badge variant mappings.
 *
 * Each map returns a Badge/StatusPill `variant` string that maps to the
 * design-system's semantic color tokens. This eliminates per-file
 * STATUS_COLORS / URGENCY_COLORS objects with raw Tailwind classes.
 *
 * Usage:
 *   import Badge from "../components/ui/Badge";
 *   import { invoiceVariant } from "../lib/statusVariants";
 *   <Badge variant={invoiceVariant(status)}>{status}</Badge>
 */

/* ── Invoice status ──────────────────────────────────────────── */
const INVOICE_MAP = {
  DRAFT: "muted",
  ISSUED: "info",
  APPROVED: "success",
  PAID: "success",
  DISPUTED: "destructive",
};
export function invoiceVariant(status) {
  return INVOICE_MAP[status] || "default";
}

/* ── Job status ──────────────────────────────────────────────── */
const JOB_MAP = {
  PENDING: "muted",
  IN_PROGRESS: "info",
  COMPLETED: "success",
  INVOICED: "brand",
};
export function jobVariant(status) {
  return JOB_MAP[status] || "default";
}

/* ── Request status ──────────────────────────────────────────── */
const REQUEST_MAP = {
  PENDING_REVIEW: "warning",
  PENDING_OWNER_APPROVAL: "brand",
  AUTO_APPROVED: "success",
  APPROVED: "success",
  RFP_PENDING: "info",
  ASSIGNED: "info",
  IN_PROGRESS: "info",
  COMPLETED: "muted",
  OWNER_REJECTED: "destructive",
  REJECTED: "destructive",
};
export function requestVariant(status) {
  return REQUEST_MAP[status] || "default";
}

/* ── RFP status ──────────────────────────────────────────────── */
const RFP_MAP = {
  DRAFT: "muted",
  OPEN: "info",
  EVALUATING: "warning",
  AWARDED: "success",
  PENDING_OWNER_APPROVAL: "warning",
  CLOSED: "muted",
  CANCELLED: "destructive",
};
export function rfpVariant(status) {
  return RFP_MAP[status] || "default";
}

/* ── Quote status ────────────────────────────────────────────── */
const QUOTE_MAP = {
  SUBMITTED: "info",
  AWARDED: "success",
  REJECTED: "warning",
};
export function quoteVariant(status) {
  return QUOTE_MAP[status] || "default";
}

/* ── Invite status ───────────────────────────────────────────── */
const INVITE_MAP = {
  INVITED: "info",
  DECLINED: "destructive",
  RESPONDED: "success",
};
export function inviteVariant(status) {
  return INVITE_MAP[status] || "default";
}

/* ── Urgency ─────────────────────────────────────────────────── */
const URGENCY_MAP = {
  LOW: "muted",
  MEDIUM: "info",
  HIGH: "warning",
  EMERGENCY: "destructive",
};
export function urgencyVariant(urgency) {
  return URGENCY_MAP[urgency] || "default";
}

/* ── Ingestion / OCR pipeline ────────────────────────────────── */
const INGESTION_MAP = {
  PENDING: "muted",
  PROCESSING: "info",
  COMPLETED: "success",
  FAILED: "destructive",
  PARTIAL: "warning",
  PENDING_REVIEW: "warning",
  AUTO_CONFIRMED: "success",
  CONFIRMED: "success",
  REJECTED: "destructive",
};
export function ingestionVariant(status) {
  return INGESTION_MAP[status] || "default";
}

/* ── Lease / occupancy ───────────────────────────────────────── */
const LEASE_MAP = {
  ACTIVE: "success",
  EXPIRED: "destructive",
  PENDING: "warning",
  DRAFT: "muted",
  READY_TO_SIGN: "info",
  SIGNED: "success",
  TERMINATED: "destructive",
};
export function leaseVariant(status) {
  return LEASE_MAP[status] || "default";
}

/* ── Vacancy selection pipeline ──────────────────────────────── */
const SELECTION_MAP = {
  NEW: "info",
  SCREENING: "warning",
  SHORTLISTED: "brand",
  SELECTED: "success",
  REJECTED: "destructive",
  WITHDRAWN: "muted",
  AWAITING_SIGNATURE: "warning",
  FALLBACK_1: "warning",
  FALLBACK_2: "destructive",
  EXHAUSTED: "muted",
};
export function selectionVariant(status) {
  return SELECTION_MAP[status] || "default";
}

/* ── Chart-of-accounts type ──────────────────────────────────── */
const ACCOUNT_TYPE_MAP = {
  ASSET: "info",
  LIABILITY: "warning",
  EQUITY: "brand",
  REVENUE: "success",
  EXPENSE: "destructive",
};
export function accountTypeVariant(type) {
  return ACCOUNT_TYPE_MAP[type] || "default";
}

/* ── Legal rule status ───────────────────────────────────────── */
const LEGAL_MAP = {
  ACTIVE: "success",
  DRAFT: "muted",
  ARCHIVED: "default",
  ERROR: "destructive",
  INACTIVE: "muted",
};
export function legalVariant(status) {
  return LEGAL_MAP[status] || "default";
}

/* ── Tax classification ──────────────────────────────────────── */
const TAX_MAP = {
  DEDUCTIBLE: "success",
  VALUE_ENHANCING: "info",
  MIXED: "warning",
  NOT_DEDUCTIBLE: "destructive",
  WERTERHALTEND: "success",
  WERTVERMEHREND: "destructive",
  ENERGY_ENVIRONMENT: "info",
};
export function taxVariant(category) {
  return TAX_MAP[category] || "default";
}

/* ── Billing entity type ─────────────────────────────────────── */
const BILLING_ENTITY_MAP = {
  ORG: "info",
  CONTRACTOR: "warning",
  OWNER: "success",
};
export function billingEntityVariant(type) {
  return BILLING_ENTITY_MAP[type] || "default";
}

/* ── Charge reconciliation status ────────────────────────────── */
const RECONCILIATION_MAP = {
  DRAFT: "info",
  FINALIZED: "warning",
  SETTLED: "success",
};
export function reconciliationVariant(status) {
  return RECONCILIATION_MAP[status] || "default";
}

/* ── Appointment slot status ─────────────────────────────────── */
const SLOT_MAP = {
  PROPOSED: "warning",
  ACCEPTED: "success",
  DECLINED: "destructive",
};
export function slotVariant(status) {
  return SLOT_MAP[status] || "default";
}

/* ── Rent adjustment status ──────────────────────────────────── */
const RENT_ADJUSTMENT_MAP = {
  DRAFT: "warning",
  APPROVED: "info",
  APPLIED: "success",
  REJECTED: "destructive",
};
export function rentAdjustmentVariant(status) {
  return RENT_ADJUSTMENT_MAP[status] || "default";
}

/* ── Signature request status ────────────────────────────────── */
const SIGNER_MAP = {
  DRAFT: "muted",
  SENT: "info",
  SIGNED: "success",
};
export function signerVariant(status) {
  return SIGNER_MAP[status] || "default";
}

/* ── Rent review / reconciliation inline status ──────────────── */
const RENT_REVIEW_MAP = {
  DRAFT: "info",
  FINALIZED: "warning",
  SETTLED: "success",
};
export function rentReviewVariant(status) {
  return RENT_REVIEW_MAP[status] || "default";
}

/* ── Billing schedule status ─────────────────────────────────── */
const BILLING_SCHEDULE_MAP = {
  ACTIVE: "success",
  PAUSED: "warning",
  COMPLETED: "muted",
};
export function billingScheduleVariant(status) {
  return BILLING_SCHEDULE_MAP[status] || "default";
}
