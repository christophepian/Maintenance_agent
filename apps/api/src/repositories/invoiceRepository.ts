/**
 * Invoice Repository
 *
 * Centralizes all Prisma access for the Invoice entity.
 * Owns canonical include trees so that DTO mappers always receive
 * the correct shape.
 *
 * G3: include must match what DTO mappers access.
 * G9: canonical include constants live here.
 */

import { PrismaClient, InvoiceStatus } from "@prisma/client";

// ─── Canonical Includes ────────────────────────────────────────

/**
 * Full include for single-invoice detail views.
 * Must stay in sync with mapInvoiceToDTO in services/invoices.ts.
 */
export const INVOICE_FULL_INCLUDE = {
  lineItems: true,
} as const;

/**
 * H5: Summary include (no line items) for list views.
 * Must stay in sync with mapInvoiceToSummaryDTO in services/invoices.ts.
 */
export const INVOICE_SUMMARY_INCLUDE = {} as const;

// ─── Query Functions ───────────────────────────────────────────

/**
 * Fetch a single invoice by ID with full canonical include.
 */
export async function findInvoiceById(prisma: PrismaClient, id: string) {
  return prisma.invoice.findUnique({
    where: { id },
    include: INVOICE_FULL_INCLUDE,
  });
}

/**
 * Fetch a single invoice by ID (minimal, no includes).
 */
export async function findInvoiceRaw(prisma: PrismaClient, id: string) {
  return prisma.invoice.findUnique({ where: { id } });
}

/**
 * Find the first invoice for a given job.
 */
export async function findInvoiceByJobId(prisma: PrismaClient, jobId: string) {
  return prisma.invoice.findFirst({
    where: { jobId },
    include: INVOICE_FULL_INCLUDE,
  });
}

export interface ListInvoiceOpts {
  orgId: string;
  jobId?: string;
  status?: InvoiceStatus;
  contractorId?: string;
  view?: "summary" | "full";
}

/**
 * List invoices scoped to an org, with optional filters.
 */
export async function findInvoicesByOrg(prisma: PrismaClient, opts: ListInvoiceOpts) {
  const useSummary = opts.view === "summary";
  return prisma.invoice.findMany({
    where: {
      orgId: opts.orgId,
      ...(opts.jobId && { jobId: opts.jobId }),
      ...(opts.status && { status: opts.status }),
      ...(opts.contractorId && { job: { contractorId: opts.contractorId } }),
    },
    orderBy: { createdAt: "desc" },
    include: useSummary ? INVOICE_SUMMARY_INCLUDE : INVOICE_FULL_INCLUDE,
  });
}
