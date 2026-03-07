/**
 * disputeInvoiceWorkflow
 *
 * Canonical entry point for disputing an invoice.
 * Orchestrates:
 *   1. Validate invoice exists and belongs to org
 *   2. Transition guard (assertInvoiceTransition)
 *   3. Delegate to disputeInvoice service
 *   4. Emit INVOICE_DISPUTED event
 *   5. Return disputed invoice DTO
 */

import { InvoiceStatus } from "@prisma/client";
import { WorkflowContext } from "./context";
import { assertInvoiceTransition } from "./transitions";
import { emit } from "../events/bus";
import { getInvoice, disputeInvoice } from "../services/invoices";
import type { InvoiceDTO } from "../services/invoices";

// ─── Input / Output ────────────────────────────────────────────

export interface DisputeInvoiceInput {
  invoiceId: string;
  reason?: string;
}

export interface DisputeInvoiceResult {
  dto: InvoiceDTO;
}

// ─── Workflow ──────────────────────────────────────────────────

export async function disputeInvoiceWorkflow(
  ctx: WorkflowContext,
  input: DisputeInvoiceInput,
): Promise<DisputeInvoiceResult> {
  const { orgId } = ctx;
  const { invoiceId, reason } = input;

  // ── 1. Validate invoice exists and belongs to org ──────────
  const invoice = await getInvoice(invoiceId);
  if (!invoice || invoice.orgId !== orgId) {
    throw Object.assign(new Error("Invoice not found"), { code: "NOT_FOUND" });
  }

  // ── 2. Transition guard ────────────────────────────────────
  assertInvoiceTransition(invoice.status, InvoiceStatus.DISPUTED);

  // ── 3. Dispute invoice ─────────────────────────────────────
  const disputed = await disputeInvoice(invoiceId);

  // ── 4. Emit event ──────────────────────────────────────────
  emit({
    type: "INVOICE_DISPUTED",
    orgId,
    actorUserId: ctx.actorUserId,
    payload: { invoiceId, jobId: disputed.jobId, reason: reason || null },
  }).catch((err) => console.error("[EVENT] Failed to emit INVOICE_DISPUTED", err));

  return { dto: disputed };
}
