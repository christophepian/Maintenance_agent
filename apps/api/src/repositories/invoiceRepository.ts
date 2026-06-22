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

import { PrismaClient, InvoiceStatus, Prisma, ExpenseCategory } from "@prisma/client";

// ─── Canonical Includes ────────────────────────────────────────

/**
 * Full include for single-invoice detail views.
 * Must stay in sync with mapInvoiceToDTO in services/invoices.ts.
 */
export const INVOICE_FULL_INCLUDE = {
  lineItems: true,
  classifiedExpenseType: true,
  classifiedAccount: true,
  job: { select: { requestId: true } },
} as const;

/**
 * H5: Summary include (no line items) for list views.
 * Must stay in sync with mapInvoiceToSummaryDTO in services/invoices.ts.
 */
export const INVOICE_SUMMARY_INCLUDE = {
  issuer: { select: { name: true } },
  job: {
    select: {
      request: {
        select: {
          unit: {
            select: {
              unitNumber: true,
              building: { select: { name: true } },
            },
          },
        },
      },
    },
  },
  // Rent invoices carry the unit/building via the lease; ingested/manual invoices
  // may be directly attributed. Include all paths so the Building/Unit column
  // resolves regardless of how the invoice is linked.
  lease: {
    select: {
      unit: {
        select: { unitNumber: true, building: { select: { name: true } } },
      },
    },
  },
  attributedUnit: {
    select: { unitNumber: true, building: { select: { name: true } } },
  },
  attributedBuilding: { select: { name: true } },
} as const;

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
  expenseCategory?: string;
  buildingId?: string;
  paidAfter?: string;   // ISO date string
  paidBefore?: string;  // ISO date string
}

/**
 * List invoices scoped to an org, with optional filters.
 * Supports filtering by expenseCategory, buildingId (via job→request→unit),
 * and paidAfter/paidBefore date range.
 */
export async function findInvoicesByOrg(prisma: PrismaClient, opts: ListInvoiceOpts) {
  const useSummary = opts.view === "summary";

  const where: Prisma.InvoiceWhereInput = {
    orgId: opts.orgId,
    ...(opts.jobId && { jobId: opts.jobId }),
    ...(opts.status && { status: opts.status as InvoiceStatus }),
    ...(opts.expenseCategory && { expenseCategory: opts.expenseCategory as ExpenseCategory }),
  };

  // Contractor and building filters both traverse the job relation
  const jobFilter: Prisma.JobWhereInput = {};
  if (opts.contractorId) jobFilter.contractorId = opts.contractorId;
  if (opts.buildingId) {
    jobFilter.request = { unit: { buildingId: opts.buildingId } };
  }
  if (Object.keys(jobFilter).length > 0) {
    where.job = jobFilter;
  }

  // Date range filters on paidAt
  if (opts.paidAfter || opts.paidBefore) {
    where.paidAt = {};
    if (opts.paidAfter) where.paidAt.gte = new Date(opts.paidAfter);
    if (opts.paidBefore) where.paidAt.lte = new Date(opts.paidBefore);
  }

  return prisma.invoice.findMany({
    where,
    orderBy: { createdAt: "desc" },
    include: useSummary ? INVOICE_SUMMARY_INCLUDE : INVOICE_FULL_INCLUDE,
  });
}

// ─── Overdue + PDF / QR Lookups ───────────────────────────────

/** Select for overdue invoice scanning — includes nested lease/unit/building. */
export const INVOICE_OVERDUE_SELECT = {
  id: true,
  orgId: true,
  invoiceNumber: true,
  amount: true,
  totalAmount: true,
  dueDate: true,
  recipientName: true,
  lease: {
    select: {
      id: true,
      tenantName: true,
      tenantEmail: true,
      unit: {
        select: {
          unitNumber: true,
          building: { select: { id: true, name: true } },
        },
      },
    },
  },
} as const;

/** Include for QR-bill generation — issuer + job. */
export const INVOICE_QR_INCLUDE = {
  issuer: true,
  job: true,
} as const;

/** Include for PDF generation — line items + issuer. */
export const INVOICE_PDF_INCLUDE = {
  lineItems: true,
  issuer: true,
} as const;

/**
 * Find invoices overdue by a given cutoff date.
 */
export async function findOverdueInvoices(
  prisma: PrismaClient,
  cutoff: Date,
) {
  return prisma.invoice.findMany({
    where: {
      dueDate: { lt: cutoff },
      status: { in: ["ISSUED", "APPROVED"] },
    },
    select: INVOICE_OVERDUE_SELECT,
  });
}

/**
 * Fetch invoice with issuer and job for QR-bill generation.
 */
export async function findInvoiceWithIssuerAndJob(
  prisma: PrismaClient,
  id: string,
) {
  return prisma.invoice.findUnique({
    where: { id },
    include: INVOICE_QR_INCLUDE,
  });
}

/**
 * Fetch invoice with line items and issuer for PDF generation.
 */
export async function findInvoiceWithLineItemsAndIssuer(
  prisma: PrismaClient,
  id: string,
) {
  return prisma.invoice.findUnique({
    where: { id },
    include: INVOICE_PDF_INCLUDE,
  });
}

/**
 * Create a new invoice with optional line items.
 * Used by contractor billing service for recurring schedule invoices.
 */
export async function createInvoiceRecord(
  prisma: PrismaClient,
  data: Prisma.InvoiceUncheckedCreateInput,
) {
  return prisma.invoice.create({ data });
}

/** Create an invoice and return it with full include (for invoices.ts createInvoice). */
export async function createInvoiceWithInclude(
  prisma: PrismaClient,
  data: Prisma.InvoiceCreateInput,
) {
  return prisma.invoice.create({ data, include: INVOICE_FULL_INCLUDE });
}

/** Find a job with recipient context (request+tenant+unit+building) for invoice creation. */
export async function findJobWithRecipientContext(
  prisma: PrismaClient,
  jobId: string,
) {
  return prisma.job.findUnique({
    where: { id: jobId },
    include: {
      request: {
        include: {
          tenant: true,
          unit: { include: { building: true } },
        },
      },
    },
  });
}

/** Find an invoice with full include + job for approveInvoice. */
export async function findInvoiceWithJob(
  prisma: PrismaClient,
  id: string,
) {
  return prisma.invoice.findUnique({
    where: { id },
    include: { ...INVOICE_FULL_INCLUDE, job: true },
  });
}

/** Find invoices by IDs for expense breakdown (financials service). */
export async function findInvoicesForExpenseBreakdown(
  prisma: PrismaClient,
  orgId: string,
  invoiceIds: string[],
) {
  return prisma.invoice.findMany({
    where: { id: { in: invoiceIds }, orgId },
    select: {
      id: true,
      expenseCategory: true,
      job: {
        select: {
          contractorId: true,
          contractor: { select: { id: true, name: true } },
        },
      },
    },
  });
}

/** Find a single invoice by ID and orgId (for setInvoiceExpenseCategory). */
export async function findInvoiceByIdAndOrg(
  prisma: PrismaClient,
  orgId: string,
  id: string,
) {
  return prisma.invoice.findFirst({
    where: { id, orgId },
    select: { id: true, jobId: true, expenseCategory: true, job: { select: { requestId: true } } },
  });
}

/** Update the expenseCategory field on an invoice. */
export async function updateInvoiceExpenseCategory(
  prisma: PrismaClient,
  id: string,
  category: ExpenseCategory,
) {
  return prisma.invoice.update({
    where: { id },
    data: { expenseCategory: category },
    select: { id: true, expenseCategory: true },
  });
}

/** Aggregate total of ISSUED invoices for a set of unit IDs (receivables). */
export async function aggregateIssuedInvoicesForUnits(
  prisma: PrismaClient,
  orgId: string,
  unitIds: string[],
) {
  const result = await prisma.invoice.aggregate({
    where: { orgId, status: "ISSUED", lease: { unitId: { in: unitIds } } },
    _sum: { totalAmount: true },
  });
  return result._sum.totalAmount ?? 0;
}

/** Aggregate total of ISSUED/APPROVED job invoices for a set of unit IDs (payables). */
export async function aggregatePayableInvoicesForUnits(
  prisma: PrismaClient,
  orgId: string,
  unitIds: string[],
) {
  const result = await prisma.invoice.aggregate({
    where: {
      orgId,
      status: { in: ["ISSUED", "APPROVED"] },
      job: { request: { unitId: { in: unitIds } } },
    },
    _sum: { totalAmount: true },
  });
  return result._sum.totalAmount ?? 0;
}

/** Return ids of invoices matching the given statuses (for backfill helpers). */
export async function findInvoiceIdsByStatuses(
  prisma: PrismaClient,
  orgId: string,
  statuses: InvoiceStatus[],
): Promise<string[]> {
  const rows = await prisma.invoice.findMany({
    where: { orgId, status: { in: statuses } },
    select: { id: true },
    orderBy: { createdAt: "asc" },
  });
  return rows.map((r) => r.id);
}

/**
 * Paginated invoice list with count — canonical list query.
 * Returns [rows, total] tuple matching the where/include callers provide.
 *
 * `total` always reflects the full result set (ignores take/skip) so callers
 * can render "showing X–Y of N" and drive pagination controls.
 */
export async function findInvoicesWithCount(
  prisma: PrismaClient,
  where: Prisma.InvoiceWhereInput,
  include: Prisma.InvoiceInclude,
  orderBy: Prisma.InvoiceOrderByWithRelationInput = { createdAt: "desc" },
  pagination?: { take?: number; skip?: number },
): Promise<[Awaited<ReturnType<typeof prisma.invoice.findMany>>, number]> {
  return Promise.all([
    prisma.invoice.findMany({
      where,
      include,
      orderBy,
      ...(pagination?.take != null && { take: pagination.take }),
      ...(pagination?.skip != null && { skip: pagination.skip }),
    }),
    prisma.invoice.count({ where }),
  ]);
}

/**
 * Sum of `totalAmount` (cents) across the full where set — used to render an
 * accurate aggregate total alongside a paginated list.
 */
export async function sumInvoiceTotals(
  prisma: PrismaClient,
  where: Prisma.InvoiceWhereInput,
): Promise<number> {
  const result = await prisma.invoice.aggregate({ where, _sum: { totalAmount: true } });
  return result._sum.totalAmount ?? 0;
}

