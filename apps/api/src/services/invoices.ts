import { InvoiceStatus, BillingEntityType, Prisma, InvoiceDirection, InvoiceSourceChannel, IngestionStatus, CostNature } from '@prisma/client';
import prisma from './prismaClient';
import { INVOICE_FULL_INCLUDE, INVOICE_SUMMARY_INCLUDE, findInvoicesWithCount } from '../repositories/invoiceRepository';
import * as invoiceRepo from '../repositories/invoiceRepository';
import * as billingEntityRepo from '../repositories/billingEntityRepository';
import * as orgConfigRepo from '../repositories/orgConfigRepository';

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
  jobId?: string;
  amount?: number; // CHF (legacy)
  description?: string;
  issuerBillingEntityId?: string;
  // Raw issuer text (from OCR)
  issuerName?: string;
  issuerAddressLine1?: string;
  issuerPostalCode?: string;
  issuerCity?: string;
  issuerCountry?: string;
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
  // INV-HUB ingestion fields
  direction?: InvoiceDirection;
  sourceChannel?: InvoiceSourceChannel;
  ingestionStatus?: IngestionStatus;
  rawOcrText?: string;
  ocrConfidence?: number;
  sourceFileUrl?: string;
  matchedJobId?: string;
  matchedLeaseId?: string;
  matchedBuildingId?: string;
  // Extracted payment details (from OCR / ingestion)
  iban?: string;
  paymentReference?: string;
  currency?: string;
}

export interface UpdateInvoiceParams {
  status?: InvoiceStatus;
  amount?: number; // CHF (legacy)
  description?: string;
  issuerBillingEntityId?: string | null;
  // Raw issuer text fields
  issuerName?: string | null;
  issuerAddressLine1?: string | null;
  issuerPostalCode?: string | null;
  issuerCity?: string | null;
  issuerCountry?: string | null;
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
  // Building/unit attribution
  buildingId?: string | null;
  unitId?: string | null;
  // Ancillary cost classification (v3): nature + charge category
  costNature?: CostNature | null;
  ancillaryCategoryId?: string | null;
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
  jobId: string | null;
  requestId?: string | null;
  amount: number; // CHF (legacy)
  description?: string;
  issuerBillingEntityId?: string;
  // Raw issuer text (OCR-extracted or manually entered)
  issuerName?: string | null;
  issuerAddressLine1?: string | null;
  issuerPostalCode?: string | null;
  issuerCity?: string | null;
  issuerCountry?: string | null;
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
  expenseCategory?: string | null;
  expenseType?: { id: string; name: string; code: string | null } | null;
  account?: { id: string; name: string; code: string | null } | null;
  /** Unit attribution derived from job.request.unit — populated when available */
  unitId?: string | null;
  /** Building attribution derived from job.request.unit.buildingId — populated when available */
  buildingId?: string | null;
  // Ancillary cost classification (v3 remediation)
  costNature?: CostNature | null;
  ancillaryCategoryId?: string | null;
  ancillaryCategory?: { id: string; code: string; name: string } | null;
  // INV-HUB ingestion fields
  direction: InvoiceDirection;
  sourceChannel: InvoiceSourceChannel;
  ingestionStatus?: IngestionStatus | null;
  rawOcrText?: string | null;
  ocrConfidence?: number | null;
  sourceFileUrl?: string | null;
  matchedJobId?: string | null;
  matchedLeaseId?: string | null;
  matchedBuildingId?: string | null;
  // Recurring billing fields
  isBackfilled: boolean;
  billingPeriodStart?: string | null;
  billingPeriodEnd?: string | null;
  billingScheduleId?: string | null;
}

  /**
   * H5: Summary DTO for list endpoints.
   * Reduces overfetch by omitting line items and address details.
   * Includes expenseCategory and paymentReference for finance pages.
   */
  export interface InvoiceSummaryDTO {
    id: string;
    orgId: string;
    jobId: string | null;
    leaseId?: string | null;
    status: InvoiceStatus;
    invoiceNumber?: string;
    totalAmount: number; // CHF
    dueDate?: string;
    paidAt?: string;
    createdAt: string;
    description?: string;
    expenseCategory?: string;
    paymentReference?: string;
    issuerName?: string;
    recipientName?: string;
    unitNumber?: string;
    buildingName?: string;
    buildingId?: string | null;
    // INV-HUB ingestion fields
    direction: InvoiceDirection;
    sourceChannel: InvoiceSourceChannel;
    ingestionStatus?: IngestionStatus | null;
    // Recurring billing fields
    isBackfilled: boolean;
    billingPeriodStart?: string | null;
    billingPeriodEnd?: string | null;
    billingScheduleId?: string | null;
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
  const job = await invoiceRepo.findJobWithRecipientContext(prisma, jobId);

  const org = await orgConfigRepo.findOrgById(prisma, orgId);
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

async function resolveIssuerBillingEntityId(
  orgId: string,
  contractorId?: string | null,
  preferOrg?: boolean,
) {
  if (!preferOrg && contractorId) {
    const contractorEntity = await billingEntityRepo.findBillingEntityByContractor(prisma, contractorId, orgId);
    if (contractorEntity) return contractorEntity.id;
  }

  const orgEntity = await billingEntityRepo.findOrgBillingEntity(prisma, orgId);

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

    // Lease invoices use the already-stamped issuerBillingEntityId (set at creation time).
    // If not stamped yet, fall back to ORG billing entity (skipping contractor resolution).
    const isLeaseInvoice = !!(invoice as any).leaseId;
    const resolvedIssuerBillingEntityId = isLeaseInvoice
      ? (invoice.issuerBillingEntityId || await resolveIssuerBillingEntityId(invoice.orgId, null, true))
      : (invoice.issuerBillingEntityId || await resolveIssuerBillingEntityId(invoice.orgId, (invoice as any).job?.contractorId));
    const issuerBillingEntityId = params?.issuerBillingEntityId || resolvedIssuerBillingEntityId;

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
 * Create an invoice, optionally linked to a job.
 * When jobId is provided, verifies the job exists and resolves recipient/issuer from it.
 * When jobId is omitted (incoming invoices), uses params directly.
 */
export async function createInvoice(params: CreateInvoiceParams): Promise<InvoiceDTO> {
  const { orgId, jobId, amount, description } = params;

  // Resolve job-related context when a job is linked
  let job: Awaited<ReturnType<typeof invoiceRepo.findJobWithRecipientContext>> | null = null;
  if (jobId) {
    job = await invoiceRepo.findJobWithRecipientContext(prisma, jobId);

    if (!job || job.orgId !== orgId) {
      throw new Error(`Job not found or doesn't belong to org: ${jobId}`);
    }
  }

  const fallbackDescription =
    description || job?.request?.description || 'Invoice';

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

  // Resolve recipient and issuer from job when available, otherwise use params
  const recipientDefaults = jobId
    ? await resolveRecipientDetails(orgId, jobId)
    : {
        recipientName: 'Unknown',
        recipientAddressLine1: 'Unknown',
        recipientAddressLine2: undefined,
        recipientPostalCode: '0000',
        recipientCity: 'Unknown',
        recipientCountry: 'CH',
      };
  const issuerBillingEntityId =
    params.issuerBillingEntityId ||
    (job ? await resolveIssuerBillingEntityId(orgId, job.contractorId) : undefined);

  const invoice = await invoiceRepo.createInvoiceWithInclude(prisma, {
    org: { connect: { id: orgId } },
      ...(jobId ? { job: { connect: { id: jobId } } } : {}),
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
      // For ingested invoices, the vendor's invoice number is stored in the
      // description and rawOcrText. The invoiceNumber column is reserved for
      // system-generated numbers assigned during issueInvoice() and has a
      // unique constraint per org.
      invoiceNumber: null,
      invoiceNumberFormat: 'YYYY-NNN',
      subtotalAmount: totals.subtotalAmount,
      vatAmount: totals.vatAmount,
      totalAmount: totals.totalAmount,
      currency: params.currency ?? 'CHF',
      ...(params.iban ? { iban: params.iban } : {}),
      ...(params.paymentReference ? { paymentReference: params.paymentReference } : {}),
      vatRate: params.vatRate ?? 7.7,
      amount: totals.totalAmount ? Math.round(totals.totalAmount / 100) : 0,
      description: fallbackDescription,
      status: InvoiceStatus.DRAFT,
      submittedAt: new Date(),
      // INV-HUB ingestion fields
      direction: params.direction ?? 'OUTGOING',
      sourceChannel: params.sourceChannel ?? 'MANUAL',
      ...(params.ingestionStatus ? { ingestionStatus: params.ingestionStatus } : {}),
      ...(params.rawOcrText ? { rawOcrText: params.rawOcrText } : {}),
      ...(params.ocrConfidence !== undefined ? { ocrConfidence: params.ocrConfidence } : {}),
      ...(params.sourceFileUrl ? { sourceFileUrl: params.sourceFileUrl } : {}),
      ...(params.matchedJobId ? { matchedJobId: params.matchedJobId } : {}),
      ...(params.matchedLeaseId ? { matchedLeaseId: params.matchedLeaseId } : {}),
      ...(params.matchedBuildingId ? { matchedBuildingId: params.matchedBuildingId } : {}),
      ...(params.issuerName ? { issuerName: params.issuerName } : {}),
      ...(params.issuerAddressLine1 ? { issuerAddressLine1: params.issuerAddressLine1 } : {}),
      ...(params.issuerPostalCode ? { issuerPostalCode: params.issuerPostalCode } : {}),
      ...(params.issuerCity ? { issuerCity: params.issuerCity } : {}),
      ...(params.issuerCountry ? { issuerCountry: params.issuerCountry } : {}),
      lineItems: normalizedLineItems.length
        ? {
            create: normalizedLineItems,
          }
        : undefined,
  });

  return mapInvoiceToDTO(invoice);
}

/**
 * Get invoice by ID.
 */
export async function getInvoice(invoiceId: string): Promise<InvoiceDTO | null> {
  const invoice = await invoiceRepo.findInvoiceById(prisma, invoiceId);
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
    statusIn?: InvoiceStatus[];
    view?: "summary" | "full";
    contractorId?: string;
    expenseCategory?: string;
    buildingId?: string;
    paidAfter?: string;
    paidBefore?: string;
    createdAfter?: string;
    createdBefore?: string;
    expenseTypeId?: string;
    accountId?: string;
    direction?: string;
    ingestionStatus?: string;
    unitId?: string;
    ownerId?: string;
    search?: string;
    sortField?: string;
    sortDir?: "asc" | "desc";
    categorized?: boolean;
    includeSum?: boolean;
    limit?: number;
    offset?: number;
  }
): Promise<{ data: InvoiceDTO[] | InvoiceSummaryDTO[]; total: number; sumTotalAmount?: number }> {
  const useSummary = filters?.view === "summary";

  const where: any = {
    orgId,
    ...(filters?.jobId && { jobId: filters.jobId }),
    ...(filters?.statusIn?.length ? { status: { in: filters.statusIn } } : filters?.status ? { status: filters.status } : {}),
    ...(filters?.expenseCategory && { expenseCategory: filters.expenseCategory }),
    ...(filters?.expenseTypeId && { expenseTypeId: filters.expenseTypeId }),
    ...(filters?.accountId && { accountId: filters.accountId }),
    ...(filters?.direction && { direction: filters.direction }),
    ...(filters?.ingestionStatus && { ingestionStatus: filters.ingestionStatus }),
  };

  // Restrict to invoices that carry an expense category (expenses surface).
  if (filters?.categorized && !filters?.expenseCategory) {
    where.expenseCategory = { not: null };
  }

  // Free-text search across invoiceNumber / recipientName / description (case-insensitive).
  const searchTerm = filters?.search?.trim();
  const searchClause: any[] | null = searchTerm
    ? [
        { invoiceNumber: { contains: searchTerm, mode: "insensitive" } },
        { recipientName: { contains: searchTerm, mode: "insensitive" } },
        { description: { contains: searchTerm, mode: "insensitive" } },
      ]
    : null;

  // Contractor and building filters both traverse the job relation
  // Only apply job-based filters when jobId is not null
  const jobFilter: any = {};
  if (filters?.contractorId) jobFilter.contractorId = filters.contractorId;
  if (filters?.buildingId) {
    jobFilter.request = { unit: { buildingId: filters.buildingId } };
  }
  if (filters?.unitId) {
    jobFilter.request = { ...jobFilter.request, unitId: filters.unitId };
  }
  if (Object.keys(jobFilter).length > 0) {
    const orClauses: any[] = [{ job: jobFilter }];
    // Match invoices directly attributed to this building/unit, or to a lease on
    // the unit. NOTE: do NOT add a bare `{ jobId: null }` clause here — it would
    // match every job-less invoice in the org (all rent + all ingested bills),
    // bypassing the unit/building filter entirely. Job-less invoices that truly
    // belong to this unit/building are caught by the attribution clauses below.
    if (filters?.unitId) orClauses.push({ lease: { unitId: filters.unitId } });
    if (filters?.buildingId) orClauses.push({ buildingId: filters.buildingId });
    // Rent invoices are lease-linked; traverse lease → unit → building so a
    // building view includes rent for all its units.
    if (filters?.buildingId) orClauses.push({ lease: { unit: { buildingId: filters.buildingId } } });
    if (filters?.unitId) orClauses.push({ unitId: filters.unitId });
    where.OR = orClauses;
  } else if (filters?.unitId) {
    where.OR = [
      { job: { request: { unitId: filters.unitId } } },
      { lease: { unitId: filters.unitId } },
      { unitId: filters.unitId },
    ];
  } else if (filters?.buildingId) {
    // buildingId-only — include direct attribution (no job filter needed separately)
    where.OR = [
      { job: { request: { unit: { buildingId: filters.buildingId } } } },
      { buildingId: filters.buildingId },
    ];
  }

  // Date range filters on paidAt
  if (filters?.paidAfter || filters?.paidBefore) {
    where.paidAt = {};
    if (filters?.paidAfter) where.paidAt.gte = new Date(filters.paidAfter);
    if (filters?.paidBefore) where.paidAt.lte = new Date(filters.paidBefore);
  }

  // Date range filters on createdAt (owner invoice surface)
  if (filters?.createdAfter || filters?.createdBefore) {
    where.createdAt = {};
    if (filters?.createdAfter) where.createdAt.gte = new Date(filters.createdAfter);
    if (filters?.createdBefore) where.createdAt.lte = new Date(filters.createdBefore);
  }

  // Owner scoping: restrict to buildings owned by the user
  if (filters?.ownerId) {
    const ownerBuildingFilter = { owners: { some: { userId: filters.ownerId } } };
    const ownerOrClauses: any[] = [
      { job: { request: { unit: { building: ownerBuildingFilter } } } },
      { lease: { unit: { building: ownerBuildingFilter } } },
    ];
    if (where.OR) {
      // Intersect: existing OR (job/building filter) AND owner filter
      where.AND = [{ OR: where.OR }, { OR: ownerOrClauses }];
      delete where.OR;
    } else {
      where.OR = ownerOrClauses;
    }
  }

  // Fold free-text search in as an AND constraint so it intersects all other filters.
  if (searchClause) {
    const andList: any[] = where.AND ? [...where.AND] : [];
    if (where.OR) {
      andList.push({ OR: where.OR });
      delete where.OR;
    }
    andList.push({ OR: searchClause });
    where.AND = andList;
  }

  // Server-side sort — whitelist scalar columns; default newest-first.
  const SORTABLE: Record<string, true> = {
    createdAt: true,
    issueDate: true,
    dueDate: true,
    paidAt: true,
    totalAmount: true,
    amount: true,
    invoiceNumber: true,
    recipientName: true,
    status: true,
  };
  const sortField = filters?.sortField && SORTABLE[filters.sortField] ? filters.sortField : "createdAt";
  const sortDir: "asc" | "desc" = filters?.sortDir === "asc" ? "asc" : "desc";
  const orderBy: any = { [sortField]: sortDir };

  const [invoices, total] = await findInvoicesWithCount(
    prisma,
    where,
    useSummary ? INVOICE_SUMMARY_INCLUDE : INVOICE_INCLUDE,
    orderBy,
    {
      ...(filters?.limit != null && { take: filters.limit }),
      ...(filters?.offset != null && { skip: filters.offset }),
    },
  );

  const data = useSummary ? invoices.map(mapInvoiceToSummaryDTO) : invoices.map(mapInvoiceToDTO);

  if (filters?.includeSum) {
    const sumCents = await invoiceRepo.sumInvoiceTotals(prisma, where);
    return { data, total, sumTotalAmount: fromCents(sumCents) };
  }
  return { data, total };
}

/**
 * Update invoice status and metadata.
 */
export async function updateInvoice(
  invoiceId: string,
  params: UpdateInvoiceParams
): Promise<InvoiceDTO> {
  const existing = await invoiceRepo.findInvoiceById(prisma, invoiceId);

  if (!existing) {
    throw new Error('INVOICE_NOT_FOUND');
  }

  // Coerce empty-string FK attributes to null. The invoice page sends unitId: ""
  // (and buildingId/ancillaryCategoryId: "") when no value is chosen; an empty
  // string is an invalid FK and would fail the write. See ANCILLARY_COSTS_V3.
  if ((params.unitId as any) === '') params.unitId = null;
  if ((params.buildingId as any) === '') params.buildingId = null;
  if ((params.ancillaryCategoryId as any) === '') params.ancillaryCategoryId = null;

  const mutatingFields =
    params.lineItems ||
    params.amount !== undefined ||
    params.description !== undefined ||
    params.issuerBillingEntityId !== undefined ||
    params.issuerName !== undefined ||
    params.issuerAddressLine1 !== undefined ||
    params.issuerPostalCode !== undefined ||
    params.issuerCity !== undefined ||
    params.issuerCountry !== undefined ||
    params.recipientName !== undefined ||
    params.recipientAddressLine1 !== undefined ||
    params.recipientAddressLine2 !== undefined ||
    params.recipientPostalCode !== undefined ||
    params.recipientCity !== undefined ||
    params.recipientCountry !== undefined ||
    params.issueDate !== undefined ||
    params.dueDate !== undefined ||
    params.vatRate !== undefined;

  // building/unit attribution, expenseType/account and cost classification never
  // lock — they're metadata
  const isAttributionOnly =
    !mutatingFields &&
    (params.buildingId !== undefined || params.unitId !== undefined ||
     params.expenseTypeId !== undefined || params.accountId !== undefined ||
     params.costNature !== undefined || params.ancillaryCategoryId !== undefined);

  if (existing.lockedAt && mutatingFields && !isAttributionOnly) {
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
        ...(params.issuerName !== undefined && { issuerName: params.issuerName }),
        ...(params.issuerAddressLine1 !== undefined && { issuerAddressLine1: params.issuerAddressLine1 }),
        ...(params.issuerPostalCode !== undefined && { issuerPostalCode: params.issuerPostalCode }),
        ...(params.issuerCity !== undefined && { issuerCity: params.issuerCity }),
        ...(params.issuerCountry !== undefined && { issuerCountry: params.issuerCountry }),
        ...(params.buildingId !== undefined && { buildingId: params.buildingId }),
        ...(params.unitId !== undefined && { unitId: params.unitId }),
        ...(params.costNature !== undefined && { costNature: params.costNature }),
        ...(params.ancillaryCategoryId !== undefined && {
          ancillaryCategoryId: params.ancillaryCategoryId === null ? null : params.ancillaryCategoryId,
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

  // Keep the ledger (and cost pool) in sync when attribution/classification changes
  // on an already-posted invoice. Posting captured the building/unit at issue time;
  // a later change must backfill those columns, or reporting scoped by unitId/
  // buildingId reads zero for the newly-attributed unit. See ANCILLARY_COSTS_V3.
  const attributionChanged = params.buildingId !== undefined || params.unitId !== undefined;
  const natureChanged = params.costNature !== undefined || params.ancillaryCategoryId !== undefined;
  if (attributionChanged || natureChanged) {
    const isCharge = (updated as any).costNature === 'CHARGE';
    await prisma.ledgerEntry.updateMany({
      where: { orgId: existing.orgId, sourceId: invoiceId, sourceType: { in: ['INVOICE_ISSUED', 'INVOICE_PAID'] } },
      data: {
        ...(params.buildingId !== undefined && { buildingId: params.buildingId }),
        // A recoverable charge is building-level — clear any unit on its ledger legs.
        ...(isCharge ? { unitId: null } : params.unitId !== undefined ? { unitId: params.unitId } : {}),
      },
    });
    // If an already-approved invoice is (re)classified as a charge, make sure its
    // cost-pool entry exists (the approval-time bridge ran before classification).
    if (isCharge && (updated as any).status === 'APPROVED') {
      const { bridgeChargeInvoiceToCostPool } = await import('./ancillaryReconciliationService');
      bridgeChargeInvoiceToCostPool(existing.orgId, invoiceId).catch((e) =>
        console.error('[ANCILLARY] post-hoc charge bridge failed', e),
      );
    }
  }

  return mapInvoiceToDTO(updated);
}

/**
 * Swap issuer ↔ recipient raw text fields.
 * Clears issuerBillingEntityId so the manager re-links the correct billing entity.
 */
export async function swapInvoiceParties(invoiceId: string): Promise<InvoiceDTO> {
  const existing = await invoiceRepo.findInvoiceById(prisma, invoiceId);
  if (!existing) throw new Error('INVOICE_NOT_FOUND');

  const inv = existing as any;

  const updated = await prisma.invoice.update({
    where: { id: invoiceId },
    data: {
      issuerBillingEntityId: null,
      issuerName:         inv.recipientName         || null,
      issuerAddressLine1: inv.recipientAddressLine1 || null,
      issuerPostalCode:   inv.recipientPostalCode   || null,
      issuerCity:         inv.recipientCity         || null,
      issuerCountry:      inv.recipientCountry      || null,
      recipientName:         inv.issuerName         || 'Unknown',
      recipientAddressLine1: inv.issuerAddressLine1 || 'Unknown',
      recipientPostalCode:   inv.issuerPostalCode   || '0000',
      recipientCity:         inv.issuerCity         || 'Unknown',
      recipientCountry:      inv.issuerCountry      || 'CH',
    },
    include: INVOICE_INCLUDE,
  });

  return mapInvoiceToDTO(updated);
}

/**
 * Approve invoice by owner.
 */
export async function approveInvoice(invoiceId: string): Promise<InvoiceDTO> {
  const invoice = await invoiceRepo.findInvoiceWithJob(prisma, invoiceId);

  if (!invoice) throw new Error('INVOICE_NOT_FOUND');

  if (!invoice.lockedAt) {
    const isLeaseInvoice = !!(invoice as any).leaseId;
    const issuerBillingEntityId =
      invoice.issuerBillingEntityId ||
      (await resolveIssuerBillingEntityId(
        invoice.orgId,
        isLeaseInvoice ? null : invoice.job?.contractorId,
        isLeaseInvoice,
      ));
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
  const existing = await invoiceRepo.findInvoiceByJobId(prisma, jobId);

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
        lineTotal: fromCents(item.lineTotal),
      }))
    : [];

  return {
    id: invoice.id,
    orgId: invoice.orgId,
    jobId: invoice.jobId,
    requestId: (invoice as any).job?.requestId ?? null,
    amount:
      invoice.amount !== null && invoice.amount !== undefined
        ? invoice.amount
        : fromCents(totalAmount),
    description: invoice.description || undefined,
    issuerBillingEntityId: invoice.issuerBillingEntityId || undefined,
    issuerName: (invoice as any).issuerName ?? null,
    issuerAddressLine1: (invoice as any).issuerAddressLine1 ?? null,
    issuerPostalCode: (invoice as any).issuerPostalCode ?? null,
    issuerCity: (invoice as any).issuerCity ?? null,
    issuerCountry: (invoice as any).issuerCountry ?? null,
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
    expenseCategory: invoice.expenseCategory || null,
    expenseType: (invoice as any).classifiedExpenseType
      ? { id: (invoice as any).classifiedExpenseType.id, name: (invoice as any).classifiedExpenseType.name, code: (invoice as any).classifiedExpenseType.code }
      : null,
    account: (invoice as any).classifiedAccount
      ? { id: (invoice as any).classifiedAccount.id, name: (invoice as any).classifiedAccount.name, code: (invoice as any).classifiedAccount.code }
      : null,
    // INV-HUB ingestion fields
    direction: (invoice as any).direction ?? 'OUTGOING',
    sourceChannel: (invoice as any).sourceChannel ?? 'MANUAL',
    ingestionStatus: (invoice as any).ingestionStatus ?? null,
    rawOcrText: (invoice as any).rawOcrText ?? null,
    ocrConfidence: (invoice as any).ocrConfidence ?? null,
    sourceFileUrl: (invoice as any).sourceFileUrl ?? null,
    matchedJobId: (invoice as any).matchedJobId ?? null,
    matchedLeaseId: (invoice as any).matchedLeaseId ?? null,
    matchedBuildingId: (invoice as any).matchedBuildingId ?? null,
    // Recurring billing fields
    isBackfilled: (invoice as any).isBackfilled ?? false,
    billingPeriodStart: (invoice as any).billingPeriodStart
      ? (invoice as any).billingPeriodStart.toISOString()
      : null,
    billingPeriodEnd: (invoice as any).billingPeriodEnd
      ? (invoice as any).billingPeriodEnd.toISOString()
      : null,
    billingScheduleId: (invoice as any).billingScheduleId ?? null,
    buildingId: (invoice as any).buildingId ?? null,
    unitId: (invoice as any).unitId ?? null,
    costNature: (invoice as any).costNature ?? null,
    ancillaryCategoryId: (invoice as any).ancillaryCategoryId ?? null,
    ancillaryCategory: (invoice as any).ancillaryCategory
      ? {
          id: (invoice as any).ancillaryCategory.id,
          code: (invoice as any).ancillaryCategory.code,
          name: (invoice as any).ancillaryCategory.name,
        }
      : null,
  };
}

  function mapInvoiceToSummaryDTO(invoice: InvoiceWithSummaryInclude): InvoiceSummaryDTO {
    const totalAmount = invoice.totalAmount ?? 0;
    // Resolve unit/building across all linkage paths: maintenance (job → request),
    // rent (lease → unit), and direct attribution (attributedUnit/attributedBuilding).
    const unit = (invoice as any).job?.request?.unit
      || (invoice as any).lease?.unit
      || (invoice as any).attributedUnit;
    const buildingName = unit?.building?.name || (invoice as any).attributedBuilding?.name || undefined;
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
      leaseId: invoice.leaseId ?? null,
      issuerName: (invoice as any).issuer?.name || undefined,
      recipientName: invoice.recipientName || undefined,
      unitNumber: unit?.unitNumber || undefined,
      buildingName,
      buildingId: (invoice as any).buildingId ?? null,
      // INV-HUB ingestion fields
      direction: (invoice as any).direction ?? 'OUTGOING',
      sourceChannel: (invoice as any).sourceChannel ?? 'MANUAL',
      ingestionStatus: (invoice as any).ingestionStatus ?? null,
      // Recurring billing fields
      isBackfilled: (invoice as any).isBackfilled ?? false,
      billingPeriodStart: (invoice as any).billingPeriodStart
        ? (invoice as any).billingPeriodStart.toISOString()
        : null,
      billingPeriodEnd: (invoice as any).billingPeriodEnd
        ? (invoice as any).billingPeriodEnd.toISOString()
        : null,
      billingScheduleId: (invoice as any).billingScheduleId ?? null,
    };
  }
