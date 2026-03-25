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
import { postInvoiceIssued } from "../services/ledgerService";
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

  // ── 2. Resolve billing entity if not provided ─────────────
  // Auto-resolve from job's contractor, then org-level fallback — mirrors
  // the same logic used by approveInvoice so callers don't need to know IDs.
  let resolvedBillingEntityId = issuerBillingEntityId || invoice.issuerBillingEntityId || undefined;
  if (!resolvedBillingEntityId && invoice.jobId) {
    const job = await prisma.job.findUnique({
      where: { id: invoice.jobId },
      select: { contractorId: true },
    });
    if (job?.contractorId) {
      const contractorEntity = await prisma.billingEntity.findFirst({
        where: { orgId, contractorId: job.contractorId },
        select: { id: true },
      });
      resolvedBillingEntityId = contractorEntity?.id;
    }
    if (!resolvedBillingEntityId) {
      const orgEntity = await prisma.billingEntity.findFirst({
        where: { orgId, type: "ORG" },
        select: { id: true },
      });
      resolvedBillingEntityId = orgEntity?.id;
    }
  }

  // ── 3. Issue invoice ──────────────────────────────────────
  const issued = await issueInvoice(invoiceId, {
    issuerBillingEntityId: resolvedBillingEntityId,
    issueDate,
    dueDate,
  });

  // ── 4. Notify tenant (best-effort) ────────────────────────
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

  // ── 5. Post ledger entry (best-effort) ────────────────────
  postInvoiceIssued(prisma, orgId, issued).catch((err) =>
    console.error("[LEDGER] Failed to post INVOICE_ISSUED", err),
  );

  // ── 6. Emit event ─────────────────────────────────────────
  emit({
    type: "INVOICE_ISSUED",
    orgId,
    actorUserId: ctx.actorUserId,
    payload: { invoiceId, jobId: issued.jobId },
  }).catch((err) => console.error("[EVENT] Failed to emit INVOICE_ISSUED", err));

  return { dto: issued, tenantNotified };
}
