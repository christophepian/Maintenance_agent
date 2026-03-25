import { InvoiceStatus, BillingEntityType, Prisma } from '@prisma/client';
import prisma from './prismaClient';
import { INVOICE_FULL_INCLUDE, INVOICE_SUMMARY_INCLUDE } from '../repositories/invoiceRepository';

/** Compile-time type for an Invoice row loaded with INVOICE_FULL_INCLUDE. */
type InvoiceWithFullInclude = Prisma.InvoiceGetPayload<{ include: typeof INVOICE_FULL_INCLUDE }>;
/** Compile-time type for an Invoice row loaded with INVOICE_SUMMARY_INCLUDE. */
type InvoiceWithSummaryInclude = Prisma.InvoiceGetPayload<{ include: typeof INVOICE_SUMMARY_INCLUDE }>;

/**
 * G9: Canonical include tree for Invoice queries.
 * Single source of truth lives in invoiceRepository; re-exported here for backward compat.
 */
export const INVOICE_INCLUDE = INVOICE_FULL_INCLUDE;

export interface CreateInvoiceParams {
  orgId: string;
  jobId: string;
  amount?: number; // CHF (legacy)
  description?: string;
  issuerBillingEntityId?: string;
  recipientName?: string;
  recipientAddressLine1?: string;
  recipientAddressLine2?: string;
  recipientPostalCode?: string;
  recipientCity?: string;
  recipientCountry?: string;
  issueDate?: Date;
  dueDate?: Date;
  vatRate?: number;
  expenseTypeId?: string;
  accountId?: string;
  lineItems?: Array<{
    description: string;
    quantity?: number;
    unitPrice: number; // CHF
    vatRate?: number;
  }>;
}

export interface UpdateInvoiceParams {
  status?: InvoiceStatus;
  amount?: number; // CHF (legacy)
  description?: string;
  issuerBillingEntityId?: string | null;
  recipientName?: string;
  recipientAddressLine1?: string;
  recipientAddressLine2?: string | null;
  recipientPostalCode?: string;
  recipientCity?: string;
  recipientCountry?: string;
  issueDate?: Date | null;
  dueDate?: Date | null;
  vatRate?: number;
  expenseTypeId?: string | null;
  accountId?: string | null;
  lineItems?: Array<{
    description: string;
    quantity?: number;
    unitPrice: number; // CHF
    vatRate?: number;
  }>;
  submittedAt?: Date;
  approvedAt?: Date;
  paidAt?: Date;
}

export interface InvoiceLineItemDTO {
  id: string;
  description: string;
  quantity: number;
  unitPrice: number; // cents
  vatRate: number;
  lineTotal: number; // cents (subtotal + VAT)
}

export interface InvoiceDTO {
  id: string;
  orgId: string;
  jobId: string;
  amount: number; // CHF (legacy)
  description?: string;
  issuerBillingEntityId?: string;
  recipientName: string;
  recipientAddressLine1: string;
  recipientAddressLine2?: string;
  recipientPostalCode: string;
  recipientCity: string;
  recipientCountry: string;
  issueDate?: string;
  dueDate?: string;
  invoiceNumber?: string;
  invoiceNumberFormat: string;
  subtotalAmount: number; // CHF
  vatAmount: number; // CHF
  totalAmount: number; // CHF
  currency: string;
  vatRate: number;
  paymentReference?: string;
  iban?: string;
  status: InvoiceStatus;
  lockedAt?: string;
  submittedAt?: string; // ISO
  approvedAt?: string; // ISO
  paidAt?: string; // ISO
  createdAt: string; // ISO
  updatedAt: string; // ISO
  lineItems: InvoiceLineItemDTO[];
  leaseId?: string | null;
  expenseTypeId?: string | null;
  accountId?: string | null;
  expenseType?: { id: string; name: string; code: string | null } | null;
  account?: { id: string; name: string; code: string | null } | null;
  /** Unit attribution derived from job.request.unit — populated when available */
  unitId?: string | null;
  /** Building attribution derived from job.request.unit.buildingId — populated when available */
  buildingId?: string | null;
}

  /**
   * H5: Summary DTO for list endpoints.
   * Reduces overfetch by omitting line items and address details.
   * Includes expenseCategory and paymentReference for finance pages.
   */
  export interface InvoiceSummaryDTO {
    id: string;
    orgId: string;
    jobId: string;
    status: InvoiceStatus;
    invoiceNumber?: string;
    totalAmount: number; // CHF
    dueDate?: string;
    paidAt?: string;
    createdAt: string;
    description?: string;
    expenseCategory?: string;
    paymentReference?: string;
  }

function toCents(amount: number): number {
  return Math.round(amount * 100);
}

function fromCents(amount: number): number {
  return amount / 100;
}

function parseAddress(address?: string) {
  if (!address) return null;
  const parts = address.split(',').map((part) => part.trim()).filter(Boolean);
  if (parts.length === 0) return null;

  const addressLine1 = parts[0];
  let postalCode = '';
  let city = '';
  let country = 'CH';

  if (parts.length >= 2) {
    const tokens = parts[1].split(' ').map((t) => t.trim()).filter(Boolean);
    if (tokens.length >= 2) {
      postalCode = tokens[0];
      city = tokens.slice(1).join(' ');
    } else if (tokens.length === 1) {
      city = tokens[0];
    }
  }

  if (parts.length >= 3) {
    country = parts[2];
  }

  return { addressLine1, postalCode, city, country };
}

function normalizeLineItems(
  items: CreateInvoiceParams['lineItems'] | UpdateInvoiceParams['lineItems'],
  fallbackDescription?: string,
  fallbackVatRate?: number
) {
  if (!items || items.length === 0) return [];

  return items.map((item) => {
    const quantity = item.quantity && item.quantity > 0 ? Math.floor(item.quantity) : 1;
    const unitPriceCents = toCents(item.unitPrice);
    const vatRate = item.vatRate ?? fallbackVatRate ?? 7.7;
    const subtotalAmount = unitPriceCents * quantity;
    const vatAmount = Math.round((subtotalAmount * vatRate) / 100);
    const lineTotal = subtotalAmount + vatAmount;

    return {
      description: item.description || fallbackDescription || 'Service',
      quantity,
      unitPrice: unitPriceCents,
      vatRate,
      lineTotal,
    };
  });
}

function summarizeTotals(lineItems: ReturnType<typeof normalizeLineItems>) {
  let totalAmount = 0;
  let totalVatAmount = 0;

  lineItems.forEach((item) => {
    const quantity = item.quantity;
    const unitPriceCents = item.unitPrice;
    const vatRate = item.vatRate;
    const subtotalAmount = unitPriceCents * quantity;
    const vatAmount = Math.round((subtotalAmount * vatRate) / 100);
    
    totalAmount += item.lineTotal;
    totalVatAmount += vatAmount;
  });

  return {
    subtotalAmount: totalAmount - totalVatAmount,
    vatAmount: totalVatAmount,
    totalAmount,
  };
}

async function resolveRecipientDetails(orgId: string, jobId: string) {
  const job = await prisma.job.findUnique({
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

  const org = await prisma.org.findUnique({ where: { id: orgId } });
  const building = job?.request?.unit?.building;
  const parsedAddress = parseAddress(building?.address);

  return {
    recipientName: job?.request?.tenant?.name || org?.name || 'Recipient',
    recipientAddressLine1:
      parsedAddress?.addressLine1 || building?.address || 'Unknown address',
    recipientAddressLine2: undefined,
    recipientPostalCode: parsedAddress?.postalCode || '0000',
    recipientCity: parsedAddress?.city || 'Unknown',
    recipientCountry: parsedAddress?.country || 'CH',
  };
}

async function resolveIssuerBillingEntityId(orgId: string, contractorId?: string | null) {
  if (contractorId) {
    const contractorEntity = await prisma.billingEntity.findFirst({
      where: { orgId, contractorId },
    });
    if (contractorEntity) return contractorEntity.id;
  }

  const orgEntity = await prisma.billingEntity.findFirst({
    where: { orgId, type: BillingEntityType.ORG },
  });

  return orgEntity?.id || undefined;
}

export async function issueInvoice(
  invoiceId: string,
  params?: { issuerBillingEntityId?: string; issueDate?: Date; dueDate?: Date }
): Promise<InvoiceDTO> {
  return prisma.$transaction(async (tx) => {
    const invoice = await tx.invoice.findUnique({
      where: { id: invoiceId },
      include: INVOICE_INCLUDE,
    });

    if (!invoice) throw new Error('INVOICE_NOT_FOUND');
    if (invoice.lockedAt || invoice.invoiceNumber) throw new Error('INVOICE_ALREADY_ISSUED');

    const issuerBillingEntityId =
      params?.issuerBillingEntityId || invoice.issuerBillingEntityId || undefined;

    if (!issuerBillingEntityId) throw new Error('ISSUER_BILLING_ENTITY_REQUIRED');

    const issuer = await tx.billingEntity.findUnique({
      where: { id: issuerBillingEntityId },
    });

    if (!issuer) throw new Error('ISSUER_BILLING_ENTITY_NOT_FOUND');

    const issueDate = params?.issueDate || new Date();
    const dueDate = params?.dueDate || new Date(issueDate.getTime() + 30 * 24 * 60 * 60 * 1000);
    const year = issueDate.getUTCFullYear();
    const sequence = issuer.nextInvoiceSequence;
    const invoiceNumber = `${year}-${String(sequence).padStart(3, '0')}`;

    await tx.billingEntity.update({
      where: { id: issuer.id },
      data: { nextInvoiceSequence: issuer.nextInvoiceSequence + 1 },
    });

    const updated = await tx.invoice.update({
      where: { id: invoiceId },
      data: {
        status: "ISSUED",
        issuerBillingEntityId,
        issueDate,
        dueDate,
        invoiceNumber,
        lockedAt: new Date(),
        iban: issuer.iban,
      },
      include: INVOICE_INCLUDE,
    });

    return mapInvoiceToDTO(updated);
  });
}

/**
 * Create an invoice for a completed job.
 */
export async function createInvoice(params: CreateInvoiceParams): Promise<InvoiceDTO> {
  const { orgId, jobId, amount, description } = params;

  // Verify job exists and belongs to org
  const job = await prisma.job.findUnique({
    where: { id: jobId },
    include: { request: { include: { tenant: true, unit: { include: { building: true } } } } },
  });

  if (!job || job.orgId !== orgId) {
    throw new Error(`Job not found or doesn't belong to org: ${jobId}`);
  }

  const fallbackDescription =
    description || job.request?.description || `Invoice for Request #${job.request.id.slice(0, 8)}`;

  const baseLineItems = params.lineItems?.length
    ? params.lineItems
    : amount !== undefined
      ? [
          {
            description: fallbackDescription,
            quantity: 1,
            unitPrice: amount,
            vatRate: params.vatRate,
          },
        ]
      : [];

  const normalizedLineItems = normalizeLineItems(baseLineItems, fallbackDescription, params.vatRate);
  const totals = summarizeTotals(normalizedLineItems);

  const recipientDefaults = await resolveRecipientDetails(orgId, jobId);
  const issuerBillingEntityId =
    params.issuerBillingEntityId ||
    (await resolveIssuerBillingEntityId(orgId, job.contractorId));

  const invoice = await prisma.invoice.create({
    data: {
      org: { connect: { id: orgId } },
      job: { connect: { id: jobId } },
      issuer: issuerBillingEntityId ? { connect: { id: issuerBillingEntityId } } : undefined,
      classifiedExpenseType: params.expenseTypeId ? { connect: { id: params.expenseTypeId } } : undefined,
      classifiedAccount: params.accountId ? { connect: { id: params.accountId } } : undefined,
      recipientName: params.recipientName || recipientDefaults.recipientName,
      recipientAddressLine1:
        params.recipientAddressLine1 || recipientDefaults.recipientAddressLine1,
      recipientAddressLine2:
        params.recipientAddressLine2 ?? recipientDefaults.recipientAddressLine2 ?? null,
      recipientPostalCode:
        params.recipientPostalCode || recipientDefaults.recipientPostalCode,
      recipientCity: params.recipientCity || recipientDefaults.recipientCity,
      recipientCountry: params.recipientCountry || recipientDefaults.recipientCountry,
      issueDate: params.issueDate || null,
      dueDate: params.dueDate || null,
      invoiceNumber: null,
      invoiceNumberFormat: 'YYYY-NNN',
      subtotalAmount: totals.subtotalAmount,
      vatAmount: totals.vatAmount,
      totalAmount: totals.totalAmount,
      currency: 'CHF',
      vatRate: params.vatRate ?? 7.7,
      amount: totals.totalAmount ? Math.round(totals.totalAmount / 100) : 0,
      description: fallbackDescription,
      status: InvoiceStatus.DRAFT,
      submittedAt: new Date(), // Record when the contractor/system submitted the invoice
      lineItems: normalizedLineItems.length
        ? {
            create: normalizedLineItems,
          }
        : undefined,
    },
    include: INVOICE_INCLUDE,
  });

  return mapInvoiceToDTO(invoice);
}

/**
 * Get invoice by ID.
 */
export async function getInvoice(invoiceId: string): Promise<InvoiceDTO | null> {
  const invoice = await prisma.invoice.findUnique({
    where: { id: invoiceId },
    include: INVOICE_INCLUDE,
  });

  return invoice ? mapInvoiceToDTO(invoice) : null;
}

/**
 * List invoices for org with optional filters.
 * H1: Supports contractorId filter for contractor-scoped access.
 * Supports expenseCategory, buildingId, paidAfter, paidBefore filters
 * for finance pages (payments, expenses).
 */
export async function listInvoices(
  orgId: string,
  filters?: {
    jobId?: string;
    status?: InvoiceStatus;
    view?: "summary" | "full";
    contractorId?: string;
    expenseCategory?: string;
    buildingId?: string;
    paidAfter?: string;
    paidBefore?: string;
    expenseTypeId?: string;
    accountId?: string;
  }
): Promise<{ data: InvoiceDTO[] | InvoiceSummaryDTO[]; total: number }> {
  const useSummary = filters?.view === "summary";

  const where: any = {
    orgId,
    ...(filters?.jobId && { jobId: filters.jobId }),
    ...(filters?.status && { status: filters.status }),
    ...(filters?.expenseCategory && { expenseCategory: filters.expenseCategory }),
    ...(filters?.expenseTypeId && { expenseTypeId: filters.expenseTypeId }),
    ...(filters?.accountId && { accountId: filters.accountId }),
  };

  // Contractor and building filters both traverse the job relation
  const jobFilter: any = {};
  if (filters?.contractorId) jobFilter.contractorId = filters.contractorId;
  if (filters?.buildingId) {
    jobFilter.request = { unit: { buildingId: filters.buildingId } };
  }
  if (Object.keys(jobFilter).length > 0) {
    where.job = jobFilter;
  }

  // Date range filters on paidAt
  if (filters?.paidAfter || filters?.paidBefore) {
    where.paidAt = {};
    if (filters?.paidAfter) where.paidAt.gte = new Date(filters.paidAfter);
    if (filters?.paidBefore) where.paidAt.lte = new Date(filters.paidBefore);
  }

  const [invoices, total] = await Promise.all([
    prisma.invoice.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      include: useSummary ? undefined : INVOICE_INCLUDE,
    }),
    prisma.invoice.count({ where }),
  ]);

  const data = useSummary ? invoices.map(mapInvoiceToSummaryDTO) : invoices.map(mapInvoiceToDTO);
  return { data, total };
}

/**
 * Update invoice status and metadata.
 */
export async function updateInvoice(
  invoiceId: string,
  params: UpdateInvoiceParams
): Promise<InvoiceDTO> {
  const existing = await prisma.invoice.findUnique({
    where: { id: invoiceId },
    include: INVOICE_INCLUDE,
  });

  if (!existing) {
    throw new Error('INVOICE_NOT_FOUND');
  }

  const mutatingFields =
    params.lineItems ||
    params.amount !== undefined ||
    params.description !== undefined ||
    params.issuerBillingEntityId !== undefined ||
    params.recipientName !== undefined ||
    params.recipientAddressLine1 !== undefined ||
    params.recipientAddressLine2 !== undefined ||
    params.recipientPostalCode !== undefined ||
    params.recipientCity !== undefined ||
    params.recipientCountry !== undefined ||
    params.issueDate !== undefined ||
    params.dueDate !== undefined ||
    params.vatRate !== undefined;

  if (existing.lockedAt && mutatingFields) {
    throw new Error('INVOICE_LOCKED');
  }

  const fallbackDescription = params.description || existing.description || 'Service';
  const nextLineItems = params.lineItems
    ? normalizeLineItems(params.lineItems, fallbackDescription, params.vatRate || existing.vatRate)
    : null;
  const nextTotals = nextLineItems ? summarizeTotals(nextLineItems) : null;

  const updated = await prisma.$transaction(async (tx) => {
    if (nextLineItems) {
      await tx.invoiceLineItem.deleteMany({ where: { invoiceId } });
    }

    const invoice = await tx.invoice.update({
      where: { id: invoiceId },
      data: {
        ...(params.status !== undefined && { status: params.status }),
        ...(params.amount !== undefined && { amount: Math.round(params.amount) }),
        ...(params.description !== undefined && { description: params.description }),
        ...(params.issuerBillingEntityId !== undefined && {
          issuerBillingEntityId: params.issuerBillingEntityId === null ? null : params.issuerBillingEntityId,
        }),
        ...(params.recipientName !== undefined && { recipientName: params.recipientName }),
        ...(params.recipientAddressLine1 !== undefined && { recipientAddressLine1: params.recipientAddressLine1 }),
        ...(params.recipientAddressLine2 !== undefined && {
          recipientAddressLine2: params.recipientAddressLine2 === null ? null : params.recipientAddressLine2,
        }),
        ...(params.recipientPostalCode !== undefined && { recipientPostalCode: params.recipientPostalCode }),
        ...(params.recipientCity !== undefined && { recipientCity: params.recipientCity }),
        ...(params.recipientCountry !== undefined && { recipientCountry: params.recipientCountry }),
        ...(params.issueDate !== undefined && {
          issueDate: params.issueDate === null ? null : params.issueDate,
        }),
        ...(params.dueDate !== undefined && {
          dueDate: params.dueDate === null ? null : params.dueDate,
        }),
        ...(params.vatRate !== undefined && { vatRate: params.vatRate }),
        ...(params.expenseTypeId !== undefined && {
          expenseTypeId: params.expenseTypeId === null ? null : params.expenseTypeId,
        }),
        ...(params.accountId !== undefined && {
          accountId: params.accountId === null ? null : params.accountId,
        }),
        ...(params.submittedAt !== undefined && { submittedAt: params.submittedAt }),
        ...(params.approvedAt !== undefined && { approvedAt: params.approvedAt }),
        ...(params.paidAt !== undefined && { paidAt: params.paidAt }),
        ...(nextTotals && {
          subtotalAmount: nextTotals.subtotalAmount,
          vatAmount: nextTotals.vatAmount,
          totalAmount: nextTotals.totalAmount,
        }),
      },
      include: INVOICE_INCLUDE,
    });

    if (nextLineItems?.length) {
      await tx.invoiceLineItem.createMany({
        data: nextLineItems.map((item) => ({
          invoiceId: invoice.id,
          ...item,
        })),
      });
      const refreshed = await tx.invoice.findUnique({
        where: { id: invoiceId },
        include: INVOICE_INCLUDE,
      });
      return refreshed || invoice;
    }

    return invoice;
  });

  return mapInvoiceToDTO(updated);
}

/**
 * Approve invoice by owner.
 */
export async function approveInvoice(invoiceId: string): Promise<InvoiceDTO> {
  const invoice = await prisma.invoice.findUnique({
    where: { id: invoiceId },
    include: { ...INVOICE_INCLUDE, job: true },
  });

  if (!invoice) throw new Error('INVOICE_NOT_FOUND');

  if (!invoice.lockedAt) {
    const issuerBillingEntityId =
      invoice.issuerBillingEntityId ||
      (await resolveIssuerBillingEntityId(invoice.orgId, invoice.job?.contractorId));
    await issueInvoice(invoiceId, { issuerBillingEntityId });
  }

  return updateInvoice(invoiceId, {
    status: InvoiceStatus.APPROVED,
    approvedAt: new Date(),
  });
}

/**
 * Mark invoice as paid.
 */
export async function markInvoicePaid(invoiceId: string): Promise<InvoiceDTO> {
  return updateInvoice(invoiceId, {
    status: InvoiceStatus.PAID,
    paidAt: new Date(),
  });
}

/**
 * Mark invoice as disputed (owner has questions).
 */
export async function disputeInvoice(invoiceId: string): Promise<InvoiceDTO> {
  return updateInvoice(invoiceId, {
    status: InvoiceStatus.DISPUTED,
  });
}

/**
 * Get or create invoice for a job.
 * Used when job is marked complete.
 */
export async function getOrCreateInvoiceForJob(
  orgId: string,
  jobId: string,
  amount: number
): Promise<InvoiceDTO> {
  // Check if invoice already exists
  const existing = await prisma.invoice.findFirst({
    where: { jobId },
    include: INVOICE_INCLUDE,
  });

  if (existing) {
    return mapInvoiceToDTO(existing);
  }

  return createInvoice({
    orgId,
    jobId,
    amount,
  });
}

function mapInvoiceToDTO(invoice: InvoiceWithFullInclude): InvoiceDTO {
  const subtotalAmount = invoice.subtotalAmount ?? 0;
  const vatAmount = invoice.vatAmount ?? 0;
  const totalAmount = invoice.totalAmount ?? 0;
  const lineItems = Array.isArray(invoice.lineItems)
    ? invoice.lineItems.map((item: any) => ({
        id: item.id,
        description: item.description,
        quantity: item.quantity,
        unitPrice: fromCents(item.unitPrice),
        vatRate: item.vatRate,
        lineTotal: item.lineTotal, // Already in cents, no conversion needed for internal representation
      }))
    : [];

  return {
    id: invoice.id,
    orgId: invoice.orgId,
    jobId: invoice.jobId,
    amount:
      invoice.amount !== null && invoice.amount !== undefined
        ? invoice.amount
        : fromCents(totalAmount),
    description: invoice.description || undefined,
    issuerBillingEntityId: invoice.issuerBillingEntityId || undefined,
    recipientName: invoice.recipientName,
    recipientAddressLine1: invoice.recipientAddressLine1,
    recipientAddressLine2: invoice.recipientAddressLine2 || undefined,
    recipientPostalCode: invoice.recipientPostalCode,
    recipientCity: invoice.recipientCity,
    recipientCountry: invoice.recipientCountry,
    issueDate: invoice.issueDate ? invoice.issueDate.toISOString() : undefined,
    dueDate: invoice.dueDate ? invoice.dueDate.toISOString() : undefined,
    invoiceNumber: invoice.invoiceNumber || undefined,
    invoiceNumberFormat: invoice.invoiceNumberFormat,
    subtotalAmount: fromCents(subtotalAmount),
    vatAmount: fromCents(vatAmount),
    totalAmount: fromCents(totalAmount),
    currency: invoice.currency,
    vatRate: invoice.vatRate,
    paymentReference: invoice.paymentReference || undefined,
    iban: invoice.iban || undefined,
    status: invoice.status,
    lockedAt: invoice.lockedAt ? invoice.lockedAt.toISOString() : undefined,
    submittedAt: invoice.submittedAt ? invoice.submittedAt.toISOString() : undefined,
    approvedAt: invoice.approvedAt ? invoice.approvedAt.toISOString() : undefined,
    paidAt: invoice.paidAt ? invoice.paidAt.toISOString() : undefined,
    createdAt: invoice.createdAt.toISOString(),
    updatedAt: invoice.updatedAt.toISOString(),
    lineItems,
    leaseId: (invoice as any).leaseId || null,
    expenseTypeId: invoice.expenseTypeId || null,
    accountId: invoice.accountId || null,
    expenseType: (invoice as any).classifiedExpenseType
      ? { id: (invoice as any).classifiedExpenseType.id, name: (invoice as any).classifiedExpenseType.name, code: (invoice as any).classifiedExpenseType.code }
      : null,
    account: (invoice as any).classifiedAccount
      ? { id: (invoice as any).classifiedAccount.id, name: (invoice as any).classifiedAccount.name, code: (invoice as any).classifiedAccount.code }
      : null,
  };
}

  function mapInvoiceToSummaryDTO(invoice: InvoiceWithSummaryInclude): InvoiceSummaryDTO {
    const totalAmount = invoice.totalAmount ?? 0;
    return {
      id: invoice.id,
      orgId: invoice.orgId,
      jobId: invoice.jobId,
      status: invoice.status,
      invoiceNumber: invoice.invoiceNumber || undefined,
      totalAmount: fromCents(totalAmount),
      dueDate: invoice.dueDate ? invoice.dueDate.toISOString() : null as any,
      paidAt: invoice.paidAt ? invoice.paidAt.toISOString() : null as any,
      createdAt: invoice.createdAt.toISOString(),
      description: invoice.description || undefined,
      expenseCategory: invoice.expenseCategory || undefined,
      paymentReference: invoice.paymentReference || undefined,
    };
  }
