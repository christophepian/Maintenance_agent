/**
 * Rental Selection Service
 *
 * Shared business logic for listing rental owner selections.
 * Used by both manager and owner route handlers (CQ-2 resolution).
 *
 * Extracted from routes/rentalApplications.ts to eliminate ~80-line
 * handler duplication and move business logic out of routes.
 */

import { PrismaClient } from "@prisma/client";
import * as rentalApplicationRepo from "../repositories/rentalApplicationRepository";

// ─── DTOs ──────────────────────────────────────────────────────

export interface SelectionDTO {
  id: string;
  unitId: string;
  unitNumber: string | null;
  buildingId?: string;
  buildingName: string | null;
  buildingAddress: string | null;
  status: string;
  deadlineAt: string;
  createdAt: string;
  primaryCandidate: {
    name: string;
    email: string | null;
    phone?: string | null;
    applicationId?: string | null;
  } | null;
  lease: {
    id: string;
    status: string;
    tenantName: string | null;
  } | null;
  hasLeaseTemplate?: boolean;
}

// ─── Manager selections ────────────────────────────────────────

/**
 * List active tenant selections for manager review.
 * Includes EXHAUSTED status and hasLeaseTemplate enrichment.
 */
export async function listManagerSelections(
  prisma: PrismaClient,
  orgId: string,
): Promise<SelectionDTO[]> {
  const selections = await prisma.rentalOwnerSelection.findMany({
    where: {
      unit: { building: { orgId } },
      status: { in: ["AWAITING_SIGNATURE", "FALLBACK_1", "FALLBACK_2", "EXHAUSTED"] },
    },
    include: rentalApplicationRepo.SELECTION_PIPELINE_INCLUDE,
    orderBy: { createdAt: "desc" },
  });

  // Check which buildings have at least one lease template
  const buildingIds = [
    ...new Set(selections.map((s: any) => s.unit?.building?.id).filter(Boolean)),
  ];
  const templatesPerBuilding = await prisma.lease.groupBy({
    by: ["templateBuildingId"],
    where: {
      isTemplate: true,
      deletedAt: null,
      templateBuildingId: { in: buildingIds },
    },
    _count: { id: true },
  });
  const buildingsWithTemplate = new Set(
    templatesPerBuilding.map((t: any) => t.templateBuildingId),
  );

  return selections.map((s: any) => mapSelectionToDTO(s, buildingsWithTemplate));
}

// ─── Owner selections ──────────────────────────────────────────

/**
 * List active owner selections (awaiting signature pipeline).
 * Excludes EXHAUSTED status and hasLeaseTemplate.
 */
export async function listOwnerSelections(
  prisma: PrismaClient,
  orgId: string,
): Promise<SelectionDTO[]> {
  const selections = await prisma.rentalOwnerSelection.findMany({
    where: {
      unit: { building: { orgId } },
      status: { in: ["AWAITING_SIGNATURE", "FALLBACK_1", "FALLBACK_2"] },
    },
    include: rentalApplicationRepo.SELECTION_PIPELINE_INCLUDE,
    orderBy: { createdAt: "desc" },
  });

  return selections.map((s: any) => mapSelectionToDTO(s));
}

// ─── Shared mapper ─────────────────────────────────────────────

function mapSelectionToDTO(
  s: any,
  buildingsWithTemplate?: Set<string>,
): SelectionDTO {
  const primaryApplicant = s.primarySelection?.application?.applicants?.[0];
  const lease = s.unit?.leases?.[0] || null;
  const bid = s.unit?.building?.id;

  const dto: SelectionDTO = {
    id: s.id,
    unitId: s.unitId,
    unitNumber: s.unit?.unitNumber,
    buildingName: s.unit?.building?.name,
    buildingAddress: s.unit?.building?.address,
    status: s.status,
    deadlineAt: s.deadlineAt.toISOString(),
    createdAt: s.createdAt.toISOString(),
    primaryCandidate: primaryApplicant
      ? {
          name: `${primaryApplicant.firstName} ${primaryApplicant.lastName}`,
          email: primaryApplicant.email,
        }
      : null,
    lease: lease
      ? { id: lease.id, status: lease.status, tenantName: lease.tenantName }
      : null,
  };

  // Manager-only enrichments
  if (buildingsWithTemplate) {
    dto.buildingId = bid;
    if (dto.primaryCandidate && primaryApplicant) {
      dto.primaryCandidate.phone = primaryApplicant.phone || null;
      dto.primaryCandidate.applicationId =
        s.primarySelection?.applicationId || null;
    }
    dto.hasLeaseTemplate = bid ? buildingsWithTemplate.has(bid) : false;
  }

  return dto;
}
