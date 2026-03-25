/**
 * payInvoiceWorkflow
 *
 * Canonical entry point for marking an invoice as paid.
 * Orchestrates:
 *   1. Validate invoice exists and belongs to org
 *   2. Transition guard (assertInvoiceTransition)
 *   3. Mark invoice as paid
 *   4. Transition job → INVOICED if still COMPLETED
 *   5. Emit INVOICE_PAID event
 *   6. Return paid invoice DTO
 */

import { InvoiceStatus, JobStatus } from "@prisma/client";
import { WorkflowContext } from "./context";
import { assertInvoiceTransition, canTransitionJob } from "./transitions";
import { emit } from "../events/bus";
import { getInvoice, markInvoicePaid } from "../services/invoices";
import { findJobRaw, updateJobRecord } from "../repositories/jobRepository";
import { postInvoicePaid } from "../services/ledgerService";
import type { InvoiceDTO } from "../services/invoices";

// ─── Input / Output ────────────────────────────────────────────

export interface PayInvoiceInput {
  invoiceId: string;
}

export interface PayInvoiceResult {
  dto: InvoiceDTO;
  jobTransitioned: boolean;
}

// ─── Workflow ──────────────────────────────────────────────────

export async function payInvoiceWorkflow(
  ctx: WorkflowContext,
  input: PayInvoiceInput,
): Promise<PayInvoiceResult> {
  const { orgId, prisma } = ctx;
  const { invoiceId } = input;

  // ── 1. Validate invoice exists and belongs to org ──────────
  const invoice = await getInvoice(invoiceId);
  if (!invoice || invoice.orgId !== orgId) {
    throw Object.assign(new Error("Invoice not found"), { code: "NOT_FOUND" });
  }

  // ── 2. Transition guard ────────────────────────────────────
  assertInvoiceTransition(invoice.status, InvoiceStatus.PAID);

  // ── 3. Mark invoice as paid ────────────────────────────────
  const paid = await markInvoicePaid(invoiceId);

  // ── 4. Transition job → INVOICED (best-effort) ─────────────
  let jobTransitioned = false;
  try {
    const job = await findJobRaw(prisma, paid.jobId);
    if (job && canTransitionJob(job.status, JobStatus.INVOICED)) {
      await updateJobRecord(prisma, job.id, { status: JobStatus.INVOICED });
      jobTransitioned = true;
    }
  } catch (err) {
    console.warn("Failed to transition job to INVOICED after payment", err);
  }

  // ── 5. Post ledger entry (best-effort) ────────────────────
  postInvoicePaid(prisma, orgId, paid).catch((err) =>
    console.error("[LEDGER] Failed to post INVOICE_PAID", err),
  );

  // ── 6. Emit event ──────────────────────────────────────────
  emit({
    type: "INVOICE_PAID",
    orgId,
    actorUserId: ctx.actorUserId,
    payload: { invoiceId, jobId: paid.jobId, jobTransitioned },
  }).catch((err) => console.error("[EVENT] Failed to emit INVOICE_PAID", err));

  return { dto: paid, jobTransitioned };
}
