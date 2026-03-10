/**
 * Rental Application Repository
 *
 * Centralizes all Prisma access for the RentalApplication entity.
 * Re-exports include constants from services/rentalIncludes so that
 * consumers have a single import source.
 *
 * G3: include must match what DTO mappers access.
 * G9: canonical include constants live here (delegated to rentalIncludes).
 */

import { PrismaClient, LeaseStatus, ApplicantRole } from "@prisma/client";
import {
  RENTAL_APPLICATION_INCLUDE,
  RENTAL_APPLICATION_UNIT_INCLUDE,
} from "../services/rentalIncludes";

// Re-export includes so consumers can import from one place
export { RENTAL_APPLICATION_INCLUDE, RENTAL_APPLICATION_UNIT_INCLUDE };

// ─── Query Helpers ─────────────────────────────────────────────

/** Find a rental application by ID with full include. */
export async function findApplicationById(
  prisma: PrismaClient,
  id: string,
) {
  return prisma.rentalApplication.findUnique({
    where: { id },
    include: RENTAL_APPLICATION_INCLUDE,
  });
}

/** Find a rental application by ID with full include for submit flow. */
export async function findApplicationForSubmit(
  prisma: PrismaClient,
  id: string,
) {
  return prisma.rentalApplication.findUnique({
    where: { id },
    include: {
      ...RENTAL_APPLICATION_INCLUDE,
      applicationUnits: {
        include: {
          unit: {
            include: {
              building: true,
            },
          },
        },
      },
    },
  });
}

/** Find application-unit records for a specific unit (submitted apps only). */
export async function findApplicationUnitsForUnit(
  prisma: PrismaClient,
  unitId: string,
  orgId: string,
  view: "summary" | "full" = "summary",
) {
  return prisma.rentalApplicationUnit.findMany({
    where: {
      unitId,
      application: { orgId, status: "SUBMITTED" },
    },
    include: {
      application: {
        include:
          view === "full"
            ? RENTAL_APPLICATION_INCLUDE
            : {
                applicants: {
                  select: {
                    id: true,
                    role: true,
                    firstName: true,
                    lastName: true,
                    netMonthlyIncome: true,
                  },
                  orderBy: { createdAt: "asc" as const },
                },
                applicationUnits: {
                  select: {
                    id: true,
                    unitId: true,
                    status: true,
                    scoreTotal: true,
                    confidenceScore: true,
                    disqualified: true,
                    disqualifiedReasons: true,
                    managerOverrideReason: true,
                    rank: true,
                  },
                },
              },
      },
    },
    orderBy: [
      { disqualified: "asc" },
      { scoreTotal: "desc" },
    ],
  });
}

/** Find vacant, active units for an org. */
export async function findVacantUnits(
  prisma: PrismaClient,
  orgId: string,
) {
  return prisma.unit.findMany({
    where: {
      building: { orgId },
      isVacant: true,
      isActive: true,
    },
    include: {
      building: {
        select: { id: true, name: true, address: true },
      },
    },
    orderBy: [{ building: { name: "asc" } }, { unitNumber: "asc" }],
  });
}

// ─── Mutation Helpers ──────────────────────────────────────────

/** Update a rental application by ID. */
export async function updateApplication(
  prisma: PrismaClient,
  id: string,
  data: any,
) {
  return prisma.rentalApplication.update({
    where: { id },
    data,
  });
}

/** Update a rental application unit by ID. */
export async function updateApplicationUnit(
  prisma: PrismaClient,
  id: string,
  data: any,
) {
  return prisma.rentalApplicationUnit.update({
    where: { id },
    data,
  });
}

/** Update application unit with include for DTO mapping. */
export async function updateApplicationUnitWithInclude(
  prisma: PrismaClient,
  id: string,
  data: any,
) {
  return prisma.rentalApplicationUnit.update({
    where: { id },
    data,
    include: {
      unit: { include: { building: true } },
    },
  });
}

/** Find an application unit by ID with include. */
export async function findApplicationUnitById(
  prisma: PrismaClient,
  id: string,
) {
  return prisma.rentalApplicationUnit.findUnique({
    where: { id },
    include: {
      unit: { include: { building: true } },
    },
  });
}

/** Create a rental attachment record. */
export async function createAttachment(
  prisma: PrismaClient,
  data: {
    applicationId: string;
    applicantId: string;
    docType: string;
    fileName: string;
    fileSizeBytes: number;
    mimeType: string;
    storageKey: string;
    sha256: string;
  },
) {
  return prisma.rentalAttachment.create({ data: data as any });
}

/** Find application with applicants only (for upload validation). */
export async function findApplicationWithApplicants(
  prisma: PrismaClient,
  applicationId: string,
  applicantId: string,
) {
  return prisma.rentalApplication.findUnique({
    where: { id: applicationId },
    include: { applicants: { where: { id: applicantId } } },
  });
}

// ─── Canonical Includes for Attachments (CQ-14 fix) ───────────

/** Include for listing application documents with applicant attachments. */
export const RENTAL_DOCUMENTS_INCLUDE = {
  applicants: {
    include: { attachments: true },
    orderBy: { createdAt: "asc" as const },
  },
} as const;

/**
 * Find a rental attachment by ID.
 * CQ-14: Replaces ad-hoc prisma.rentalAttachment.findUnique() in routes.
 */
export async function findAttachmentById(
  prisma: PrismaClient,
  attachmentId: string,
) {
  return prisma.rentalAttachment.findUnique({
    where: { id: attachmentId },
  });
}

/**
 * Find an application with applicant documents for the documents listing endpoint.
 * CQ-14: Replaces ad-hoc prisma.rentalApplication.findUnique() with inline include.
 */
export async function findApplicationDocuments(
  prisma: PrismaClient,
  applicationId: string,
) {
  return prisma.rentalApplication.findUnique({
    where: { id: applicationId },
    include: RENTAL_DOCUMENTS_INCLUDE,
  });
}

// ─── Canonical Include for Selection Pipeline ──────────────────

/** Shared include for owner/manager selection pipeline queries. */
export const SELECTION_PIPELINE_INCLUDE = {
  unit: {
    include: {
      building: { select: { id: true, name: true, address: true } },
      leases: {
        where: { status: { in: [LeaseStatus.DRAFT, LeaseStatus.READY_TO_SIGN] }, isTemplate: false },
        orderBy: { createdAt: "desc" as const },
        take: 1,
        select: { id: true, status: true, tenantName: true },
      },
    },
  },
  primarySelection: {
    include: {
      application: {
        include: { applicants: { where: { role: ApplicantRole.PRIMARY }, take: 1 } },
      },
    },
  },
};
