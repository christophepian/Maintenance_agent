/**
 * statementDocRequestService
 *
 * Inspection-rights workflow (Phase 4): once a charge statement is issued
 * (reconciliation SETTLED), the tenant may request the supporting documents
 * (factures, relevés, clés de répartition) within the ~30-day inspection window.
 * See docs/ANCILLARY_COSTS_RECONCILIATION.md.
 */

import prisma from "./prismaClient";
import * as repo from "../repositories/statementDocRequestRepository";
import * as reconRepo from "../repositories/chargeReconciliationRepository";
import * as billingRepo from "../repositories/billingPeriodRepository";

export interface DocRequestDTO {
  id: string;
  reconciliationId: string;
  status: string;
  note: string | null;
  requestedAt: string;
  fulfilledAt: string | null;
}

type Row = Awaited<ReturnType<typeof repo.findDocRequestById>>;

function toDTO(r: NonNullable<Row>): DocRequestDTO {
  return {
    id: r.id,
    reconciliationId: r.reconciliationId,
    status: r.status,
    note: r.note,
    requestedAt: r.requestedAt.toISOString(),
    fulfilledAt: r.fulfilledAt ? r.fulfilledAt.toISOString() : null,
  };
}

export async function createDocRequest(
  orgId: string,
  reconciliationId: string,
  note?: string | null,
): Promise<DocRequestDTO> {
  const recon = await reconRepo.findById(prisma, reconciliationId, orgId);
  if (!recon) throw new Error("Reconciliation not found");
  if (recon.status !== "SETTLED" || !recon.issuedAt) {
    throw new Error("Statement not yet issued — no inspection right until the reconciliation is settled");
  }
  if (recon.inspectionDeadline && new Date() > recon.inspectionDeadline) {
    throw new Error("Inspection window has closed");
  }
  const created = await repo.createDocRequest(prisma, { orgId, reconciliationId, note });
  return toDTO(created);
}

export async function listDocRequests(orgId: string, reconciliationId: string): Promise<DocRequestDTO[]> {
  const rows = await repo.listByReconciliation(prisma, orgId, reconciliationId);
  return rows.map(toDTO);
}

export async function fulfillDocRequest(orgId: string, id: string): Promise<DocRequestDTO> {
  const existing = await repo.findDocRequestById(prisma, id, orgId);
  if (!existing) throw new Error("Doc request not found");
  const updated = await repo.markFulfilled(prisma, id);
  return toDTO(updated);
}

export interface SupportingDocumentDTO {
  categoryCode: string;
  categoryName: string;
  amountCents: number;
  sourceInvoiceId: string | null;
  note: string | null;
}

/**
 * The supporting documents behind a statement: the cost-pool entries (with their
 * source invoices) of the billing period the reconciliation was apportioned from.
 */
export async function getSupportingDocuments(
  orgId: string,
  reconciliationId: string,
): Promise<SupportingDocumentDTO[]> {
  const recon = await reconRepo.findById(prisma, reconciliationId, orgId);
  if (!recon) throw new Error("Reconciliation not found");
  if (!recon.billingPeriodId) return [];
  const period = await billingRepo.findBillingPeriodById(prisma, recon.billingPeriodId, orgId);
  if (!period) return [];
  return period.costEntries.map((e) => ({
    categoryCode: e.category.code,
    categoryName: e.category.name,
    amountCents: e.amountCents,
    sourceInvoiceId: e.sourceInvoiceId,
    note: e.note,
  }));
}
