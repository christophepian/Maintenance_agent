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
 */

import { RfpStatus, LegalObligation, Prisma } from "@prisma/client";
import prisma from "./prismaClient";
import { RFP_INCLUDE } from "./legalIncludes";

// ==========================================
// DTOs
// ==========================================

export interface RfpDTO {
  id: string;
  orgId: string;
  buildingId: string;
  unitId: string | null;
  requestId: string | null;
  category: string;
  legalObligation: LegalObligation;
  status: RfpStatus;
  inviteCount: number;
  deadlineAt: string | null;
  awardedContractorId: string | null;
  createdAt: string;
  updatedAt: string;
  building?: { id: string; name: string; address: string };
  unit?: { id: string; unitNumber: string } | null;
  awardedContractor?: { id: string; name: string } | null;
  invites: RfpInviteDTO[];
  quotes: RfpQuoteDTO[];
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
  notes: string | null;
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
// Mappers
// ==========================================

function mapRfpToDTO(rfp: any): RfpDTO {
  return {
    id: rfp.id,
    orgId: rfp.orgId,
    buildingId: rfp.buildingId,
    unitId: rfp.unitId ?? null,
    requestId: rfp.requestId ?? null,
    category: rfp.category,
    legalObligation: rfp.legalObligation,
    status: rfp.status,
    inviteCount: rfp.inviteCount,
    deadlineAt: rfp.deadlineAt?.toISOString() ?? null,
    awardedContractorId: rfp.awardedContractorId ?? null,
    createdAt: rfp.createdAt.toISOString(),
    updatedAt: rfp.updatedAt.toISOString(),
    building: rfp.building ?? undefined,
    unit: rfp.unit ?? null,
    awardedContractor: rfp.awardedContractor ?? null,
    invites: (rfp.invites ?? []).map((i: any) => ({
      id: i.id,
      rfpId: i.rfpId,
      contractorId: i.contractorId,
      status: i.status,
      createdAt: i.createdAt.toISOString(),
      contractor: i.contractor ?? undefined,
    })),
    quotes: (rfp.quotes ?? []).map((q: any) => ({
      id: q.id,
      rfpId: q.rfpId,
      contractorId: q.contractorId,
      amountCents: q.amountCents,
      notes: q.notes ?? null,
      submittedAt: q.submittedAt.toISOString(),
      contractor: q.contractor ?? undefined,
    })),
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
  const existing = await prisma.rfp.findFirst({
    where: { requestId, orgId },
    include: RFP_INCLUDE,
  });
  if (existing) return mapRfpToDTO(existing);

  // Load request context
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

  // Create RFP with invites in a transaction
  const rfp = await prisma.$transaction(async (tx) => {
    const created = await tx.rfp.create({
      data: {
        orgId,
        buildingId: building.id,
        unitId: request.unit!.id,
        requestId,
        category,
        legalObligation: decision.legalObligation,
        status: selectedContractors.length > 0 ? "OPEN" : "DRAFT",
        inviteCount,
      },
    });

    // Create invites
    if (selectedContractors.length > 0) {
      await tx.rfpInvite.createMany({
        data: selectedContractors.map((c) => ({
          rfpId: created.id,
          contractorId: c.id,
          status: "INVITED",
        })),
      });
    }

    return created;
  });

  // Reload with includes
  const loaded = await prisma.rfp.findUnique({
    where: { id: rfp.id },
    include: RFP_INCLUDE,
  });

  return mapRfpToDTO(loaded!);
}

// ==========================================
// CRUD
// ==========================================

export interface ListRfpOpts {
  limit: number;
  offset: number;
  status?: RfpStatus;
}

export async function listRfps(
  orgId: string,
  opts: ListRfpOpts,
): Promise<{ data: RfpDTO[]; total: number }> {
  const where: Prisma.RfpWhereInput = { orgId };
  if (opts.status) where.status = opts.status;

  const [rows, total] = await Promise.all([
    prisma.rfp.findMany({
      where,
      include: RFP_INCLUDE,
      orderBy: { createdAt: "desc" },
      take: opts.limit,
      skip: opts.offset,
    }),
    prisma.rfp.count({ where }),
  ]);

  return { data: rows.map(mapRfpToDTO), total };
}

export async function getRfpById(
  orgId: string,
  rfpId: string,
): Promise<RfpDTO> {
  const rfp = await prisma.rfp.findFirst({
    where: { id: rfpId, orgId },
    include: RFP_INCLUDE,
  });
  if (!rfp) throw new RfpNotFoundError(rfpId);
  return mapRfpToDTO(rfp);
}
