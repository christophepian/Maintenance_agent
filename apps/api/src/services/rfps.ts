/**
 * RFP (Request for Proposal) Service
 *
 * Creates and manages RFPs as a **sidecar workflow**.
 * RFP creation:
 *   - Does NOT create a Job
 *   - Does NOT change Request status
 *   - Does NOT break the Request → Job lifecycle
 *
 * RFPs represent a procurement step only.
 *
 * Data access: via rfpRepository (G9).
 */

import { LegalObligation } from "@prisma/client";
import prisma from "./prismaClient";
import {
  RfpWithRelations,
  findRfpsByOrg,
  findRfpById,
  findRfpByRequestId,
  findRfpsForContractor,
  createRfpWithInvites,
} from "../repositories/rfpRepository";
import type { ListRfpOpts } from "../repositories/rfpRepository";
import {
  findContractorById,
  parseServiceCategories,
} from "../repositories/contractorRepository";

// Re-export for backward compatibility with legalIncludes consumers
export { RFP_FULL_INCLUDE } from "../repositories/rfpRepository";

// ==========================================
// DTOs
// ==========================================

export interface RfpRequestSummaryDTO {
  id: string;
  requestNumber: number;
  description: string;
  category: string | null;
  status: string;
  createdAt: string;
  attachmentCount: number;
}

export interface RfpDTO {
  id: string;
  orgId: string;
  buildingId: string;
  unitId: string | null;
  requestId: string | null;
  cashflowPlanId: string | null;
  cashflowGroupKey: string | null;
  category: string;
  legalObligation: LegalObligation;
  status: string;
  inviteCount: number;
  deadlineAt: string | null;
  awardedContractorId: string | null;
  awardedQuoteId: string | null;
  createdAt: string;
  updatedAt: string;
  building?: { id: string; name: string; address: string };
  unit?: { id: string; unitNumber: string } | null;
  awardedContractor?: { id: string; name: string } | null;
  request?: RfpRequestSummaryDTO | null;
  invites: RfpInviteDTO[];
  quotes: RfpQuoteDTO[];
  quoteCount: number;
}

export interface RfpInviteDTO {
  id: string;
  rfpId: string;
  contractorId: string;
  status: string;
  createdAt: string;
  contractor?: { id: string; name: string; phone: string; email: string };
}

export interface RfpQuoteDTO {
  id: string;
  rfpId: string;
  contractorId: string;
  amountCents: number;
  currency: string;
  vatIncluded: boolean;
  estimatedDurationDays: number | null;
  earliestAvailability: string | null;
  lineItems: any;
  workPlan: string | null;
  assumptions: string | null;
  validUntil: string | null;
  notes: string | null;
  status: string;
  submittedAt: string;
  contractor?: { id: string; name: string };
}

// ==========================================
// Errors
// ==========================================

export class RfpNotFoundError extends Error {
  constructor(id: string) {
    super(`RFP ${id} not found`);
    this.name = "RfpNotFoundError";
  }
}

// ==========================================
// Contractor-safe DTOs (pre-award view)
// ==========================================

/** Request summary visible to contractors — no tenant identity, no full address */
export interface ContractorRfpRequestSummaryDTO {
  id: string;
  requestNumber: number;
  description: string;
  category: string | null;
  createdAt: string;
  attachmentCount: number;
}

/** RFP as seen by a contractor — strips address to postal code, hides tenant info */
export interface ContractorRfpDTO {
  id: string;
  category: string;
  legalObligation: LegalObligation;
  status: string;
  inviteCount: number;
  deadlineAt: string | null;
  createdAt: string;
  updatedAt: string;
  /** Postal code only — full address stripped for pre-award safety */
  postalCode: string | null;
  buildingName: string | null;
  unitNumber: string | null;
  request: ContractorRfpRequestSummaryDTO | null;
  /** Whether this contractor was explicitly invited */
  isInvited: boolean;
  quoteCount: number;
  /** The contractor's own submitted quote (null if not yet submitted) */
  myQuote: RfpQuoteDTO | null;
  /** Job ID — only populated when RFP is AWARDED and a Job was created. */
  jobId: string | null;
}

// ==========================================
// Mappers
// ==========================================

function mapRfpToDTO(rfp: RfpWithRelations): RfpDTO {
  return {
    id: rfp.id,
    orgId: rfp.orgId,
    buildingId: rfp.buildingId,
    unitId: rfp.unitId ?? null,
    requestId: rfp.requestId ?? null,
    cashflowPlanId: rfp.cashflowPlanId ?? null,
    cashflowGroupKey: rfp.cashflowGroupKey ?? null,
    category: rfp.category,
    legalObligation: rfp.legalObligation,
    status: rfp.status,
    inviteCount: rfp.inviteCount,
    deadlineAt: rfp.deadlineAt?.toISOString() ?? null,
    awardedContractorId: rfp.awardedContractorId ?? null,
    awardedQuoteId: rfp.awardedQuoteId ?? null,
    createdAt: rfp.createdAt.toISOString(),
    updatedAt: rfp.updatedAt.toISOString(),
    building: rfp.building ?? undefined,
    unit: rfp.unit ?? null,
    awardedContractor: rfp.awardedContractor ?? null,
    request: rfp.request
      ? {
          id: rfp.request.id,
          requestNumber: rfp.request.requestNumber,
          description: rfp.request.description,
          category: rfp.request.category ?? null,
          status: rfp.request.status,
          createdAt: rfp.request.createdAt.toISOString(),
          attachmentCount: rfp.request._count.attachments,
        }
      : null,
    invites: (rfp.invites ?? []).map((i) => ({
      id: i.id,
      rfpId: i.rfpId,
      contractorId: i.contractorId,
      status: i.status,
      createdAt: i.createdAt.toISOString(),
      contractor: i.contractor ?? undefined,
    })),
    quotes: (rfp.quotes ?? []).map((q) => ({
      id: q.id,
      rfpId: q.rfpId,
      contractorId: q.contractorId,
      amountCents: q.amountCents,
      currency: q.currency,
      vatIncluded: q.vatIncluded,
      estimatedDurationDays: q.estimatedDurationDays ?? null,
      earliestAvailability: q.earliestAvailability?.toISOString() ?? null,
      lineItems: q.lineItems ?? null,
      workPlan: q.workPlan ?? null,
      assumptions: q.assumptions ?? null,
      validUntil: q.validUntil?.toISOString() ?? null,
      notes: q.notes ?? null,
      status: q.status,
      submittedAt: q.submittedAt.toISOString(),
      contractor: q.contractor ?? undefined,
    })),
    quoteCount: rfp.quotes?.length ?? 0,
  };
}

// ==========================================
// Core: createRfpForRequest
// ==========================================

/**
 * Create an RFP for a request based on a legal decision.
 *
 * **Idempotent**: if an RFP already exists for this request, returns it.
 *
 * Contractor selection: contractors matching request category.
 * Invite count: buildingConfig.rfpDefaultInviteCount → 3 (default).
 */
export async function createRfpForRequest(
  orgId: string,
  requestId: string,
  decision: {
    legalObligation: LegalObligation;
    legalTopic: string | null;
  },
): Promise<RfpDTO> {
  // Idempotency: check for existing RFP
  const existing = await findRfpByRequestId(prisma, orgId, requestId);
  if (existing) return mapRfpToDTO(existing);

  // Load request context (creation-specific logic, not a generic query)
  const request = await prisma.request.findUnique({
    where: { id: requestId },
    include: {
      unit: {
        include: {
          building: {
            include: { config: true },
          },
        },
      },
    },
  });

  if (!request || !request.unit) {
    throw new Error(
      `Cannot create RFP: request ${requestId} has no unit assigned`,
    );
  }

  const building = request.unit.building;
  const category = request.category ?? decision.legalTopic ?? "general";

  // Determine invite count
  const inviteCount =
    building.config?.rfpDefaultInviteCount ?? 3;

  // Find contractors matching category
  const contractors = await prisma.contractor.findMany({
    where: {
      orgId,
      isActive: true,
    },
  });

  // Filter by serviceCategories (JSON array stored as string)
  const matchingContractors = contractors.filter((c) => {
    try {
      const cats = JSON.parse(c.serviceCategories);
      return Array.isArray(cats) && cats.includes(category);
    } catch {
      return false;
    }
  });

  // Take up to inviteCount contractors
  const selectedContractors = matchingContractors.slice(0, inviteCount);

  // Auto-routed RFPs are always OPEN so contractors can discover them
  // by category browsing. Invites are an additional direct-notification
  // channel, not a prerequisite for visibility.
  const rfp = await createRfpWithInvites(prisma, {
    orgId,
    buildingId: building.id,
    unitId: request.unit.id,
    requestId,
    category,
    legalObligation: decision.legalObligation,
    status: "OPEN",
    inviteCount,
    contractorIds: selectedContractors.map((c) => c.id),
  });

  return mapRfpToDTO(rfp);
}

// ==========================================
// CRUD
// ==========================================

export async function listRfps(
  orgId: string,
  opts: ListRfpOpts,
): Promise<{ data: RfpDTO[]; total: number }> {
  const { rows, total } = await findRfpsByOrg(prisma, orgId, opts);
  return { data: rows.map(mapRfpToDTO), total };
}

export async function getRfpById(
  orgId: string,
  rfpId: string,
): Promise<RfpDTO> {
  const rfp = await findRfpById(prisma, orgId, rfpId);
  if (!rfp) throw new RfpNotFoundError(rfpId);
  return mapRfpToDTO(rfp);
}

// ==========================================
// Contractor-safe mapper
// ==========================================

/**
 * Map an RFP to a contractor-safe DTO.
 * Strips: full address (keeps postal code only from building.address),
 *         tenant identity, internal manager/owner fields,
 *         invited contractor details (phone/email of others).
 */
function mapRfpToContractorDTO(
  rfp: RfpWithRelations,
  contractorId: string,
): ContractorRfpDTO {
  // Extract postal code from building address (Swiss format: "Street, 1234 City" or "1234 City")
  let postalCode: string | null = null;
  if (rfp.building?.address) {
    const match = rfp.building.address.match(/\b(\d{4})\b/);
    postalCode = match ? match[1] : null;
  }

  const isInvited = (rfp.invites ?? []).some(
    (i) => i.contractorId === contractorId,
  );

  // Find this contractor's own submitted quote (if any)
  const ownQuote = (rfp.quotes ?? []).find(
    (q) => q.contractorId === contractorId,
  );
  const myQuote: RfpQuoteDTO | null = ownQuote
    ? {
        id: ownQuote.id,
        rfpId: ownQuote.rfpId,
        contractorId: ownQuote.contractorId,
        amountCents: ownQuote.amountCents,
        currency: ownQuote.currency,
        vatIncluded: ownQuote.vatIncluded,
        estimatedDurationDays: ownQuote.estimatedDurationDays ?? null,
        earliestAvailability: ownQuote.earliestAvailability?.toISOString() ?? null,
        lineItems: ownQuote.lineItems ?? null,
        workPlan: ownQuote.workPlan ?? null,
        assumptions: ownQuote.assumptions ?? null,
        validUntil: ownQuote.validUntil?.toISOString() ?? null,
        notes: ownQuote.notes ?? null,
        status: ownQuote.status,
        submittedAt: ownQuote.submittedAt.toISOString(),
        contractor: ownQuote.contractor ?? undefined,
      }
    : null;

  return {
    id: rfp.id,
    category: rfp.category,
    legalObligation: rfp.legalObligation,
    status: rfp.status,
    inviteCount: rfp.inviteCount,
    deadlineAt: rfp.deadlineAt?.toISOString() ?? null,
    createdAt: rfp.createdAt.toISOString(),
    updatedAt: rfp.updatedAt.toISOString(),
    postalCode,
    buildingName: rfp.building?.name ?? null,
    unitNumber: rfp.unit?.unitNumber ?? null,
    request: rfp.request
      ? {
          id: rfp.request.id,
          requestNumber: rfp.request.requestNumber,
          description: rfp.request.description,
          category: rfp.request.category ?? null,
          createdAt: rfp.request.createdAt.toISOString(),
          attachmentCount: rfp.request._count.attachments,
        }
      : null,
    isInvited,
    quoteCount: rfp.quotes?.length ?? 0,
    myQuote,
    jobId: rfp.request?.job?.id ?? null,
  };
}

// ==========================================
// Contractor-facing CRUD
// ==========================================

/**
 * List RFPs visible to a contractor (category-matched open + invited).
 * Contractor must exist and belong to org.
 */
export async function listRfpsForContractor(
  orgId: string,
  contractorId: string,
  opts: ListRfpOpts,
): Promise<{ data: ContractorRfpDTO[]; total: number }> {
  const contractor = await findContractorById(prisma, contractorId, orgId);
  if (!contractor) throw new RfpNotFoundError(contractorId);

  const categories = parseServiceCategories(contractor);
  const { rows, total } = await findRfpsForContractor(
    prisma,
    orgId,
    contractorId,
    categories,
    opts,
  );

  return {
    data: rows.map((r) => mapRfpToContractorDTO(r, contractorId)),
    total,
  };
}

/**
 * Get a single RFP for a contractor.
 * Contractor must have visibility (category match or invite).
 */
export async function getContractorRfpById(
  orgId: string,
  contractorId: string,
  rfpId: string,
): Promise<ContractorRfpDTO> {
  const contractor = await findContractorById(prisma, contractorId, orgId);
  if (!contractor) throw new RfpNotFoundError(rfpId);

  const categories = parseServiceCategories(contractor);

  // Use the same visibility query as list (single result)
  const { rows } = await findRfpsForContractor(
    prisma,
    orgId,
    contractorId,
    categories,
    { limit: 1, offset: 0 },
  );

  // findRfpsForContractor returns all matching, but we need a specific ID.
  // Fetch it directly and verify visibility.
  const rfp = await findRfpById(prisma, orgId, rfpId);
  if (!rfp) throw new RfpNotFoundError(rfpId);

  // Verify contractor can see this RFP
  const isInvited = (rfp.invites ?? []).some(
    (i) => i.contractorId === contractorId,
  );
  const hasQuote = (rfp.quotes ?? []).some(
    (q) => q.contractorId === contractorId,
  );
  const categoryMatch =
    rfp.status === "OPEN" && categories.includes(rfp.category);
  if (!isInvited && !categoryMatch && !hasQuote) {
    throw new RfpNotFoundError(rfpId);
  }

  return mapRfpToContractorDTO(rfp, contractorId);
}
