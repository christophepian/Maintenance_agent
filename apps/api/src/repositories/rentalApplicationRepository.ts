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

import { PrismaClient, LeaseStatus, ApplicantRole, Prisma, RentalOwnerSelectionStatus, RentalApplicationUnitStatus, RentalDocType, UnitType } from "@prisma/client";
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

/** Find vacant, active units for an org. Optionally restrict to specific unit IDs. */
export async function findVacantUnits(
  prisma: PrismaClient,
  orgId: string,
  unitIds?: string[],
) {
  return prisma.unit.findMany({
    where: {
      building: { orgId },
      isActive: true,
      type: UnitType.RESIDENTIAL,
      ...(unitIds ? { id: { in: unitIds } } : {}),
      leases: {
        none: {
          status: { in: [LeaseStatus.ACTIVE, LeaseStatus.READY_TO_SIGN, LeaseStatus.SIGNED] },
          deletedAt: null,
        },
      },
      ownerSelections: {
        none: {
          status: {
            in: [
              RentalOwnerSelectionStatus.AWAITING_SIGNATURE,
              RentalOwnerSelectionStatus.FALLBACK_1,
              RentalOwnerSelectionStatus.FALLBACK_2,
              RentalOwnerSelectionStatus.SIGNED,
            ],
          },
        },
      },
    },
    include: {
      building: {
        select: { id: true, name: true, address: true, city: true, postalCode: true },
      },
      leases: {
        orderBy: { endDate: "desc" as const },
        take: 1,
        select: { endDate: true, terminatedAt: true },
      },
      _count: { select: { rentalApplicationUnits: true } },
    },
    orderBy: [{ building: { name: "asc" } }, { unitNumber: "asc" }],
  });
}

// ─── Mutation Helpers ──────────────────────────────────────────

/** Update a rental application by ID. */
export async function updateApplication(
  prisma: PrismaClient,
  id: string,
  data: Prisma.RentalApplicationUpdateInput,
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
  data: Prisma.RentalApplicationUnitUpdateInput,
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
  data: Prisma.RentalApplicationUnitUpdateInput,
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
    docType: RentalDocType;
    fileName: string;
    fileSizeBytes: number;
    mimeType: string;
    storageKey: string;
    sha256: string;
  },
) {
  return prisma.rentalAttachment.create({ data });
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

// ─── Owner Selection Functions ─────────────────────────────────

/** Find an owner selection for a unit by status. */
export async function findOwnerSelectionByUnitStatus(
  prisma: PrismaClient,
  unitId: string,
  status: RentalOwnerSelectionStatus,
) {
  return prisma.rentalOwnerSelection.findFirst({
    where: { unitId, status },
  });
}

/** Update a rental owner selection record by id. */
export async function updateOwnerSelectionRecord(
  prisma: PrismaClient,
  id: string,
  data: Prisma.RentalOwnerSelectionUpdateInput,
) {
  return prisma.rentalOwnerSelection.update({ where: { id }, data });
}

/**
 * Find the most recent owner selection for a unit with backup candidate includes.
 * Used in lease expiry flow to promote the backup candidate.
 */
export async function findOwnerSelectionForUnitWithBackup(
  prisma: PrismaClient,
  unitId: string,
) {
  return prisma.rentalOwnerSelection.findFirst({
    where: { unitId },
    orderBy: { createdAt: "desc" },
    include: {
      backup1Selection: {
        include: {
          application: {
            include: { applicants: { where: { role: ApplicantRole.PRIMARY }, take: 1 } },
          },
        },
      },
    },
  });
}

/** Find expired selections (past deadline, still AWAITING_SIGNATURE). */
export async function findExpiredSelections(prisma: PrismaClient, now: Date) {
  return prisma.rentalOwnerSelection.findMany({
    where: { status: RentalOwnerSelectionStatus.AWAITING_SIGNATURE, deadlineAt: { lte: now } },
    include: {
      unit: { include: { building: { select: { orgId: true } } } },
    },
  });
}

/** Find attachments past their retention delete date. */
export async function findExpiredAttachments(prisma: PrismaClient, now: Date) {
  return prisma.rentalAttachment.findMany({
    where: { retentionDeleteAt: { lte: now } },
  });
}

/** Delete a rental attachment by id. */
export async function deleteAttachmentRecord(prisma: PrismaClient, id: string) {
  return prisma.rentalAttachment.delete({ where: { id } });
}

/** Set retentionDeleteAt on all attachments for an application. */
export async function updateAttachmentRetention(
  prisma: PrismaClient,
  applicationId: string,
  retentionDeleteAt: Date,
) {
  return prisma.rentalAttachment.updateMany({
    where: { applicationId },
    data: { retentionDeleteAt },
  });
}

// ─── Owner Selection Queries ───────────────────────────────────

/**
 * Find application-units by IDs scoped to a unit (for candidate validation).
 */
export async function findApplicationUnitsByIds(
  prisma: PrismaClient,
  auIds: string[],
  unitId: string,
) {
  return prisma.rentalApplicationUnit.findMany({
    where: { id: { in: auIds }, unitId },
    include: {
      application: {
        include: { applicants: { where: { role: ApplicantRole.PRIMARY }, take: 1 } },
      },
    },
  });
}

/**
 * Find rejected application-units for a unit (for rejection emails).
 */
export async function findRejectedApplicationUnitsForUnit(
  prisma: PrismaClient,
  unitId: string,
) {
  return prisma.rentalApplicationUnit.findMany({
    where: { unitId, status: RentalApplicationUnitStatus.REJECTED },
    include: {
      application: {
        include: { applicants: { where: { role: ApplicantRole.PRIMARY }, take: 1 } },
      },
    },
  });
}

/**
 * Find expired selections with full RENTAL_OWNER_SELECTION_INCLUDE.
 */
export async function findExpiredSelectionsWithFullInclude(
  prisma: PrismaClient,
  now: Date,
  include: Record<string, unknown>,
) {
  return (prisma.rentalOwnerSelection.findMany as any)({
    where: { status: "AWAITING_SIGNATURE", deadlineAt: { lte: now } },
    include,
  });
}

/**
 * Process a selection timeout in a transaction:
 * - Void primary
 * - Promote backup1 if present, otherwise mark EXHAUSTED and re-open unit
 */
export async function processSelectionTimeoutTransaction(
  prisma: PrismaClient,
  sel: {
    id: string;
    unitId: string;
    primaryApplicationUnitId: string;
    backup1ApplicationUnitId?: string | null;
    backup2ApplicationUnitId?: string | null;
  },
) {
  return prisma.$transaction(async (tx: Prisma.TransactionClient) => {
    await tx.rentalApplicationUnit.update({
      where: { id: sel.primaryApplicationUnitId },
      data: { status: "VOIDED" },
    });

    if (sel.backup1ApplicationUnitId) {
      await tx.rentalApplicationUnit.update({
        where: { id: sel.backup1ApplicationUnitId },
        data: { status: "SELECTED_PRIMARY" },
      });

      const newDeadline = new Date();
      newDeadline.setDate(newDeadline.getDate() + 7);

      await tx.rentalOwnerSelection.update({
        where: { id: sel.id },
        data: {
          status: "FALLBACK_1",
          primaryApplicationUnitId: sel.backup1ApplicationUnitId,
          backup1ApplicationUnitId: sel.backup2ApplicationUnitId || null,
          backup2ApplicationUnitId: null,
          deadlineAt: newDeadline,
        },
      });
    } else {
      await tx.rentalOwnerSelection.update({
        where: { id: sel.id },
        data: { status: "EXHAUSTED" },
      });
      await tx.unit.update({
        where: { id: sel.unitId },
        data: { isVacant: true },
      });
    }
  });
}

/**
 * Create owner selection in a transaction:
 * - Create RentalOwnerSelection record
 * - Update selected application unit statuses
 * - Reject all other submitted application units for this unit
 * - Mark unit as not vacant
 */
export async function createOwnerSelectionTransaction(
  prisma: PrismaClient,
  params: {
    unitId: string;
    deadlineAt: Date;
    primaryApplicationUnitId: string;
    backup1ApplicationUnitId?: string | null;
    backup2ApplicationUnitId?: string | null;
    auIds: string[];
  },
) {
  return prisma.$transaction(async (tx: Prisma.TransactionClient) => {
    const sel = await tx.rentalOwnerSelection.create({
      data: {
        unitId: params.unitId,
        decidedAt: new Date(),
        deadlineAt: params.deadlineAt,
        primaryApplicationUnitId: params.primaryApplicationUnitId,
        backup1ApplicationUnitId: params.backup1ApplicationUnitId || null,
        backup2ApplicationUnitId: params.backup2ApplicationUnitId || null,
        status: "AWAITING_SIGNATURE",
      },
    });

    await tx.rentalApplicationUnit.update({
      where: { id: params.primaryApplicationUnitId },
      data: { status: "SELECTED_PRIMARY" },
    });
    if (params.backup1ApplicationUnitId) {
      await tx.rentalApplicationUnit.update({
        where: { id: params.backup1ApplicationUnitId },
        data: { status: "SELECTED_BACKUP_1" },
      });
    }
    if (params.backup2ApplicationUnitId) {
      await tx.rentalApplicationUnit.update({
        where: { id: params.backup2ApplicationUnitId },
        data: { status: "SELECTED_BACKUP_2" },
      });
    }

    const selectedIds = new Set(params.auIds);
    await tx.rentalApplicationUnit.updateMany({
      where: {
        unitId: params.unitId,
        id: { notIn: Array.from(selectedIds) },
        status: "SUBMITTED",
      },
      data: { status: "REJECTED" },
    });

    await tx.unit.update({
      where: { id: params.unitId },
      data: { isVacant: false },
    });

    return sel;
  });
}
