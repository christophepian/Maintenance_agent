/**
 * approveInvoiceWorkflow
 *
 * Canonical entry point for approving an invoice.
 * Orchestrates:
 *   1. Validate invoice exists and belongs to org
 *   2. Transition guard (assertInvoiceTransition)
 *   3. Delegate to approveInvoice service (auto-issues if needed)
 *   4. Emit INVOICE_APPROVED event
 *   5. Return approved invoice DTO
 */

import { InvoiceStatus } from "@prisma/client";
import { WorkflowContext } from "./context";
import { assertInvoiceTransition } from "./transitions";
import { emit } from "../events/bus";
import { getInvoice, approveInvoice } from "../services/invoices";
import type { InvoiceDTO } from "../services/invoices";
import { postInvoiceIssued } from "../services/ledgerService";

// ─── Input / Output ────────────────────────────────────────────

export interface ApproveInvoiceInput {
  invoiceId: string;
}

export interface ApproveInvoiceResult {
  dto: InvoiceDTO;
}

// ─── Workflow ──────────────────────────────────────────────────

export async function approveInvoiceWorkflow(
  ctx: WorkflowContext,
  input: ApproveInvoiceInput,
): Promise<ApproveInvoiceResult> {
  const { orgId, prisma } = ctx;
  const { invoiceId } = input;

  // ── 1. Validate invoice exists and belongs to org ──────────
  const invoice = await getInvoice(invoiceId);
  if (!invoice || invoice.orgId !== orgId) {
    throw Object.assign(new Error("Invoice not found"), { code: "NOT_FOUND" });
  }

  // ── 2. Transition guard ────────────────────────────────────
  assertInvoiceTransition(invoice.status, InvoiceStatus.APPROVED);

  // Capture pre-approval status to detect auto-issue path
  const wasAutoIssued = invoice.status === InvoiceStatus.DRAFT;

  // ── 3. Approve invoice (auto-issues if not yet issued) ─────
  const approved = await approveInvoice(invoiceId);

  // ── 3a. Post INVOICE_ISSUED ledger entry when DRAFT was auto-issued ──
  // DRAFT → APPROVED skips issueInvoiceWorkflow, so we must post here.
  if (wasAutoIssued) {
    postInvoiceIssued(prisma, orgId, approved).catch((err) =>
      console.error("[LEDGER] Failed to post INVOICE_ISSUED (auto-issue path)", err),
    );
  }

  // ── 4. Emit event ──────────────────────────────────────────
  emit({
    type: "INVOICE_APPROVED",
    orgId,
    actorUserId: ctx.actorUserId,
    payload: { invoiceId, jobId: approved.jobId },
  }).catch((err) => console.error("[EVENT] Failed to emit INVOICE_APPROVED", err));

  return { dto: approved };
}
