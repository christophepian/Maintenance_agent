/**
 * issueInvoiceWorkflow
 *
 * Canonical entry point for issuing an invoice.
 * Orchestrates:
 *   1. Validate invoice exists and belongs to org
 *   2. Call issueInvoice service (locks, assigns number, sets dates)
 *   3. Notify tenant if applicable
 *   4. Return issued invoice DTO
 */

import { WorkflowContext } from "./context";
import { emit } from "../events/bus";
import { findJobById } from "../repositories/jobRepository";
import { getInvoice, issueInvoice } from "../services/invoices";
import { notifyInvoiceStatusChanged } from "../services/notifications";
import type { InvoiceDTO } from "../services/invoices";

// ─── Input / Output ────────────────────────────────────────────

export interface IssueInvoiceInput {
  invoiceId: string;
  issuerBillingEntityId?: string;
  issueDate?: Date;
  dueDate?: Date;
}

export interface IssueInvoiceResult {
  dto: InvoiceDTO;
  tenantNotified: boolean;
}

// ─── Workflow ──────────────────────────────────────────────────

export async function issueInvoiceWorkflow(
  ctx: WorkflowContext,
  input: IssueInvoiceInput,
): Promise<IssueInvoiceResult> {
  const { orgId, prisma } = ctx;
  const { invoiceId, issuerBillingEntityId, issueDate, dueDate } = input;

  // ── 1. Validate invoice exists and belongs to org ──────────
  const invoice = await getInvoice(invoiceId);
  if (!invoice || invoice.orgId !== orgId) {
    throw Object.assign(new Error("Invoice not found"), { code: "NOT_FOUND" });
  }

  // ── 2. Issue invoice ──────────────────────────────────────
  const issued = await issueInvoice(invoiceId, {
    issuerBillingEntityId,
    issueDate,
    dueDate,
  });

  // ── 3. Notify tenant (best-effort) ────────────────────────
  let tenantNotified = false;
  try {
    const job = await findJobById(prisma, issued.jobId);
    const tenantId = (job as any)?.request?.tenantId;

    if (tenantId) {
      await notifyInvoiceStatusChanged(invoiceId, orgId, tenantId, "INVOICE_CREATED");
      tenantNotified = true;
    }
  } catch (notifyErr) {
    console.warn("Failed to send invoice issued notification", notifyErr);
  }

  // ── 4. Emit event ─────────────────────────────────────────
  emit({
    type: "INVOICE_ISSUED",
    orgId,
    actorUserId: ctx.actorUserId,
    payload: { invoiceId, jobId: issued.jobId },
  }).catch((err) => console.error("[EVENT] Failed to emit INVOICE_ISSUED", err));

  return { dto: issued, tenantNotified };
}
