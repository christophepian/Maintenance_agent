import {
  RentalApplicationStatus,
  RentalApplicationUnitStatus,
  ApplicantRole,
  RentalDocType,
} from "@prisma/client";
import prisma from "./prismaClient";
import {
  RENTAL_APPLICATION_INCLUDE,
  RENTAL_APPLICATION_UNIT_INCLUDE,
  RENTAL_APPLICATION_SUMMARY_SELECT,
} from "./rentalIncludes";
import {
  CreateRentalApplicationInput,
  SubmitRentalApplicationInput,
  AdjustScoreInput,
  REQUIRED_DOC_TYPES,
} from "../validation/rentalApplications";
import { evaluate } from "./rentalRules";
import { enqueueEmail } from "./emailOutbox";
import { storage, MAX_FILE_SIZE } from "../storage/attachments";

/* ══════════════════════════════════════════════════════════════
   DTOs
   ══════════════════════════════════════════════════════════════ */

export interface RentalApplicantDTO {
  id: string;
  role: ApplicantRole;
  firstName: string;
  lastName: string;
  birthdate?: string;
  nationality?: string;
  civilStatus?: string;
  permitType?: string;
  phone?: string;
  email?: string;
  currentAddress?: string;
  currentZipCity?: string;
  employer?: string;
  jobTitle?: string;
  workLocation?: string;
  employedSince?: string;
  netMonthlyIncome?: number;
  hasDebtEnforcement?: boolean;
  attachments?: RentalAttachmentDTO[];
}

export interface RentalAttachmentDTO {
  id: string;
  applicantId: string;
  docType: RentalDocType;
  fileName: string;
  fileSizeBytes: number;
  mimeType: string;
  uploadedAt: string;
}

export interface RentalApplicationUnitDTO {
  id: string;
  applicationId: string;
  unitId: string;
  status: RentalApplicationUnitStatus;
  scoreTotal?: number;
  confidenceScore?: number;
  disqualified: boolean;
  disqualifiedReasons?: any;
  rank?: number;
  managerScoreDelta?: number;
  managerOverrideReason?: string;
  createdAt: string;
  unit?: {
    id: string;
    unitNumber: string;
    monthlyRentChf?: number;
    monthlyChargesChf?: number;
    building?: {
      id: string;
      name: string;
      address: string;
    };
  };
}

export interface RentalApplicationDTO {
  id: string;
  orgId: string;
  status: RentalApplicationStatus;
  createdAt: string;
  updatedAt: string;
  submittedAt?: string;
  signedName?: string;
  signedAt?: string;

  // Current housing
  currentLandlordName?: string;
  currentLandlordAddress?: string;
  currentLandlordPhone?: string;
  reasonForLeaving?: string;
  desiredMoveInDate?: string;

  // Household
  householdSize?: number;
  hasPets?: boolean;
  petsDescription?: string;
  hasRcInsurance?: boolean;
  rcInsuranceCompany?: string;
  hasVehicle?: boolean;
  vehicleDescription?: string;
  needsParking?: boolean;
  remarks?: string;

  // Relations
  applicants?: RentalApplicantDTO[];
  applicationUnits?: RentalApplicationUnitDTO[];
}

export interface RentalApplicationSummaryDTO {
  id: string;
  orgId: string;
  status: RentalApplicationStatus;
  createdAt: string;
  submittedAt?: string;
  householdSize?: number;
  primaryApplicantName?: string;
  totalMonthlyIncome?: number;
  applicantCount: number;
  unitApplications: {
    id: string;
    unitId: string;
    status: RentalApplicationUnitStatus;
    scoreTotal?: number;
    confidenceScore?: number;
    disqualified: boolean;
    disqualifiedReasons?: any;
    overrideReason?: string;
    rank?: number;
  }[];
}

/* ══════════════════════════════════════════════════════════════
   Mappers
   ══════════════════════════════════════════════════════════════ */

function mapApplicantToDTO(a: any): RentalApplicantDTO {
  const dto: RentalApplicantDTO = {
    id: a.id,
    role: a.role,
    firstName: a.firstName,
    lastName: a.lastName,
  };
  if (a.birthdate) dto.birthdate = a.birthdate.toISOString();
  if (a.nationality) dto.nationality = a.nationality;
  if (a.civilStatus) dto.civilStatus = a.civilStatus;
  if (a.permitType) dto.permitType = a.permitType;
  if (a.phone) dto.phone = a.phone;
  if (a.email) dto.email = a.email;
  if (a.currentAddress) dto.currentAddress = a.currentAddress;
  if (a.currentZipCity) dto.currentZipCity = a.currentZipCity;
  if (a.employer) dto.employer = a.employer;
  if (a.jobTitle) dto.jobTitle = a.jobTitle;
  if (a.workLocation) dto.workLocation = a.workLocation;
  if (a.employedSince) dto.employedSince = a.employedSince.toISOString();
  if (a.netMonthlyIncome != null) dto.netMonthlyIncome = a.netMonthlyIncome;
  if (a.hasDebtEnforcement != null) dto.hasDebtEnforcement = a.hasDebtEnforcement;
  if (a.attachments) {
    dto.attachments = a.attachments.map(mapAttachmentToDTO);
  }
  return dto;
}

function mapAttachmentToDTO(a: any): RentalAttachmentDTO {
  return {
    id: a.id,
    applicantId: a.applicantId,
    docType: a.docType,
    fileName: a.fileName,
    fileSizeBytes: a.fileSizeBytes,
    mimeType: a.mimeType,
    uploadedAt: a.uploadedAt.toISOString(),
  };
}

function mapApplicationUnitToDTO(au: any): RentalApplicationUnitDTO {
  const dto: RentalApplicationUnitDTO = {
    id: au.id,
    applicationId: au.applicationId,
    unitId: au.unitId,
    status: au.status,
    disqualified: au.disqualified,
    createdAt: au.createdAt.toISOString(),
  };
  if (au.scoreTotal != null) dto.scoreTotal = au.scoreTotal;
  if (au.confidenceScore != null) dto.confidenceScore = au.confidenceScore;
  if (au.disqualifiedReasons) dto.disqualifiedReasons = au.disqualifiedReasons;
  if (au.rank != null) dto.rank = au.rank;
  if (au.managerScoreDelta != null) dto.managerScoreDelta = au.managerScoreDelta;
  if (au.managerOverrideReason) dto.managerOverrideReason = au.managerOverrideReason;
  if (au.unit) {
    dto.unit = {
      id: au.unit.id,
      unitNumber: au.unit.unitNumber,
      monthlyRentChf: au.unit.monthlyRentChf ?? undefined,
      monthlyChargesChf: au.unit.monthlyChargesChf ?? undefined,
      building: au.unit.building
        ? {
            id: au.unit.building.id,
            name: au.unit.building.name,
            address: au.unit.building.address,
          }
        : undefined,
    };
  }
  return dto;
}

export function mapApplicationToDTO(app: any): RentalApplicationDTO {
  const dto: RentalApplicationDTO = {
    id: app.id,
    orgId: app.orgId,
    status: app.status,
    createdAt: app.createdAt.toISOString(),
    updatedAt: app.updatedAt.toISOString(),
  };
  if (app.submittedAt) dto.submittedAt = app.submittedAt.toISOString();
  if (app.signedName) dto.signedName = app.signedName;
  if (app.signedAt) dto.signedAt = app.signedAt.toISOString();
  if (app.currentLandlordName) dto.currentLandlordName = app.currentLandlordName;
  if (app.currentLandlordAddress) dto.currentLandlordAddress = app.currentLandlordAddress;
  if (app.currentLandlordPhone) dto.currentLandlordPhone = app.currentLandlordPhone;
  if (app.reasonForLeaving) dto.reasonForLeaving = app.reasonForLeaving;
  if (app.desiredMoveInDate) dto.desiredMoveInDate = app.desiredMoveInDate.toISOString();
  if (app.householdSize != null) dto.householdSize = app.householdSize;
  if (app.hasPets != null) dto.hasPets = app.hasPets;
  if (app.petsDescription) dto.petsDescription = app.petsDescription;
  if (app.hasRcInsurance != null) dto.hasRcInsurance = app.hasRcInsurance;
  if (app.rcInsuranceCompany) dto.rcInsuranceCompany = app.rcInsuranceCompany;
  if (app.hasVehicle != null) dto.hasVehicle = app.hasVehicle;
  if (app.vehicleDescription) dto.vehicleDescription = app.vehicleDescription;
  if (app.needsParking != null) dto.needsParking = app.needsParking;
  if (app.remarks) dto.remarks = app.remarks;

  if (app.applicants) {
    dto.applicants = app.applicants.map(mapApplicantToDTO);
  }
  if (app.applicationUnits) {
    dto.applicationUnits = app.applicationUnits.map(mapApplicationUnitToDTO);
  }
  return dto;
}

function mapApplicationToSummaryDTO(app: any): RentalApplicationSummaryDTO {
  const primary = app.applicants?.find((a: any) => a.role === "PRIMARY");
  const totalIncome = (app.applicants || []).reduce(
    (sum: number, a: any) => sum + (a.netMonthlyIncome || 0),
    0,
  );

  return {
    id: app.id,
    orgId: app.orgId,
    status: app.status,
    createdAt: app.createdAt.toISOString(),
    submittedAt: app.submittedAt?.toISOString(),
    householdSize: app.householdSize ?? undefined,
    primaryApplicantName: primary
      ? `${primary.firstName} ${primary.lastName}`
      : undefined,
    totalMonthlyIncome: totalIncome || undefined,
    applicantCount: app.applicants?.length || 0,
    unitApplications: (app.applicationUnits || []).map((au: any) => ({
      id: au.id,
      unitId: au.unitId,
      status: au.status,
      scoreTotal: au.scoreTotal ?? undefined,
      confidenceScore: au.confidenceScore ?? undefined,
      disqualified: au.disqualified,
      disqualifiedReasons: au.disqualifiedReasons ?? undefined,
      overrideReason: au.managerOverrideReason ?? undefined,
      rank: au.rank ?? undefined,
    })),
  };
}

/* ══════════════════════════════════════════════════════════════
   Service Functions
   ══════════════════════════════════════════════════════════════ */

/**
 * Create a draft rental application (public, no auth).
 */
export async function createRentalApplicationDraft(
  orgId: string,
  input: CreateRentalApplicationInput,
): Promise<RentalApplicationDTO> {
  // Verify all selected units exist, are vacant, and belong to this org
  const units = await prisma.unit.findMany({
    where: {
      id: { in: input.unitIds },
      building: { orgId },
      isVacant: true,
      isActive: true,
    },
    select: { id: true },
  });

  const foundIds = new Set(units.map((u) => u.id));
  const missing = input.unitIds.filter((id) => !foundIds.has(id));
  if (missing.length > 0) {
    throw new Error(`Units not found or not vacant: ${missing.join(", ")}`);
  }

  // Create application + applicants in a transaction
  const app = await prisma.$transaction(async (tx) => {
    const application = await tx.rentalApplication.create({
      data: {
        orgId,
        status: "DRAFT",
        currentLandlordName: input.currentLandlordName,
        currentLandlordAddress: input.currentLandlordAddress,
        currentLandlordPhone: input.currentLandlordPhone,
        reasonForLeaving: input.reasonForLeaving,
        desiredMoveInDate: input.desiredMoveInDate
          ? new Date(input.desiredMoveInDate)
          : undefined,
        householdSize: input.householdSize,
        hasPets: input.hasPets,
        petsDescription: input.petsDescription,
        hasRcInsurance: input.hasRcInsurance,
        rcInsuranceCompany: input.rcInsuranceCompany,
        hasVehicle: input.hasVehicle,
        vehicleDescription: input.vehicleDescription,
        needsParking: input.needsParking,
        remarks: input.remarks,
        applicants: {
          create: input.applicants.map((a) => ({
            role: a.role as ApplicantRole,
            firstName: a.firstName,
            lastName: a.lastName,
            birthdate: a.birthdate ? new Date(a.birthdate) : undefined,
            nationality: a.nationality,
            civilStatus: a.civilStatus,
            permitType: a.permitType,
            phone: a.phone,
            email: a.email,
            currentAddress: a.currentAddress,
            currentZipCity: a.currentZipCity,
            employer: a.employer,
            jobTitle: a.jobTitle,
            workLocation: a.workLocation,
            employedSince: a.employedSince
              ? new Date(a.employedSince)
              : undefined,
            netMonthlyIncome: a.netMonthlyIncome,
            hasDebtEnforcement: a.hasDebtEnforcement,
          })),
        },
        // Pre-create the unit associations (status=SUBMITTED after submit, but
        // stored as SUBMITTED already — evaluation will run on submit)
        applicationUnits: {
          create: input.unitIds.map((unitId) => ({
            unitId,
            status: "SUBMITTED" as RentalApplicationUnitStatus,
          })),
        },
      },
      include: RENTAL_APPLICATION_INCLUDE,
    });

    return application;
  });

  return mapApplicationToDTO(app);
}

/**
 * Submit a draft application: validate completeness, capture signature,
 * run evaluation per unit, enqueue missing-docs emails.
 */
export async function submitRentalApplication(
  applicationId: string,
  input: SubmitRentalApplicationInput,
  meta: { ip?: string; userAgent?: string },
): Promise<RentalApplicationDTO> {
  // Fetch the full application
  const app = await prisma.rentalApplication.findUnique({
    where: { id: applicationId },
    include: RENTAL_APPLICATION_INCLUDE,
  });

  if (!app) throw new Error("APPLICATION_NOT_FOUND");
  if (app.status !== "DRAFT") throw new Error("APPLICATION_ALREADY_SUBMITTED");

  // Must have at least 1 applicant
  if (!app.applicants || app.applicants.length === 0) {
    throw new Error("NO_APPLICANTS");
  }

  // Must have at least 1 unit selected
  if (!app.applicationUnits || app.applicationUnits.length === 0) {
    throw new Error("NO_UNITS_SELECTED");
  }

  // Build application data snapshot
  const applicationDataJson = {
    applicants: app.applicants.map((a: any) => ({
      id: a.id,
      role: a.role,
      firstName: a.firstName,
      lastName: a.lastName,
      netMonthlyIncome: a.netMonthlyIncome,
      employer: a.employer,
      hasDebtEnforcement: a.hasDebtEnforcement,
    })),
    householdSize: app.householdSize,
    submittedAt: new Date().toISOString(),
  };

  // Run evaluation for each unit and prepare updates
  const evaluationUpdates: Array<{
    id: string;
    unitId: string;
    scoreTotal: number;
    confidenceScore: number;
    disqualified: boolean;
    disqualifiedReasons: any;
    evaluationJson: any;
    rank: number;
  }> = [];

  for (let i = 0; i < app.applicationUnits.length; i++) {
    const au = app.applicationUnits[i] as any;
    const unit = au.unit;
    const building = unit?.building;

    // Load building config for rental policy
    const config = building
      ? await prisma.buildingConfig.findUnique({
          where: { buildingId: building.id },
        })
      : null;

    const evalResult = evaluate({
      applicants: app.applicants as any[],
      attachments: app.attachments as any[],
      monthlyRentChf: unit?.monthlyRentChf || 0,
      monthlyChargesChf: unit?.monthlyChargesChf || 0,
      incomeMultiplier: (config as any)?.rentalIncomeMultiplier || 3,
    });

    evaluationUpdates.push({
      id: au.id,
      unitId: au.unitId,
      scoreTotal: evalResult.scoreTotal,
      confidenceScore: evalResult.confidenceScore,
      disqualified: evalResult.disqualified,
      disqualifiedReasons: evalResult.reasons,
      evaluationJson: evalResult,
      rank: i + 1, // initial rank by submission order; manager can reorder
    });
  }

  // Transaction: update application + all unit evaluations
  const updated = await prisma.$transaction(async (tx) => {
    // Mark submitted
    const updatedApp = await tx.rentalApplication.update({
      where: { id: applicationId },
      data: {
        status: "SUBMITTED",
        submittedAt: new Date(),
        signedName: input.signedName,
        signedAt: new Date(),
        signatureIp: meta.ip || null,
        signatureUserAgent: meta.userAgent || null,
        applicationDataJson,
      },
    });

    // Update each unit application with evaluation
    for (const eu of evaluationUpdates) {
      await tx.rentalApplicationUnit.update({
        where: { id: eu.id },
        data: {
          scoreTotal: eu.scoreTotal,
          confidenceScore: eu.confidenceScore,
          disqualified: eu.disqualified,
          disqualifiedReasons: eu.disqualifiedReasons,
          evaluationJson: eu.evaluationJson,
          rank: eu.rank,
        },
      });
    }

    return updatedApp;
  });

  // Enqueue missing-docs email if applicable (non-disqualified by income but missing docs)
  for (const eu of evaluationUpdates) {
    const evalJson = eu.evaluationJson;
    if (
      evalJson.missingDocs &&
      evalJson.missingDocs.length > 0 &&
      !evalJson.incomeDisqualified
    ) {
      const primaryApplicant = app.applicants.find(
        (a: any) => a.role === "PRIMARY",
      );
      if (primaryApplicant?.email) {
        await enqueueEmail(app.orgId, {
          toEmail: primaryApplicant.email,
          template: "MISSING_DOCS",
          subject: "Missing documents for your rental application",
          bodyText: `Your application is missing the following documents: ${evalJson.missingDocs.join(", ")}. Please upload them to complete your dossier.`,
          metaJson: {
            applicationId: app.id,
            unitId: eu.unitId,
            missingDocs: evalJson.missingDocs,
          },
        });
      }
    }
  }

  // Notify managers and owners of the new application
  try {
    const primaryApplicant = app.applicants.find((a: any) => a.role === "PRIMARY") || app.applicants[0];
    const applicantName = primaryApplicant
      ? `${(primaryApplicant as any).firstName} ${(primaryApplicant as any).lastName}`
      : "Unknown";
    const unitNumbers = (app.applicationUnits as any[]).map(
      (au: any) => au.unit?.unitNumber || au.unitId.slice(0, 8),
    );
    const firstUnit = (app.applicationUnits as any[])[0];
    const buildingId = firstUnit?.unit?.buildingId || firstUnit?.unit?.building?.id;

    const { notifyApplicationSubmitted } = await import("./notifications");
    await notifyApplicationSubmitted(
      applicationId,
      app.orgId,
      applicantName,
      unitNumbers,
      buildingId,
    );
  } catch (notifErr) {
    console.error("[RENTAL] Application notification failed (non-critical):", notifErr);
  }

  // Re-fetch with full includes for the response
  const result = await prisma.rentalApplication.findUnique({
    where: { id: applicationId },
    include: RENTAL_APPLICATION_INCLUDE,
  });

  return mapApplicationToDTO(result!);
}

/**
 * Upload an attachment for a rental application.
 */
export async function uploadRentalAttachment(
  applicationId: string,
  applicantId: string,
  docType: RentalDocType,
  file: { buffer: Buffer; fileName: string; mimeType: string },
): Promise<RentalAttachmentDTO> {
  if (file.buffer.length > MAX_FILE_SIZE) {
    throw new Error(`File exceeds maximum size of ${MAX_FILE_SIZE} bytes`);
  }

  // Verify application and applicant exist
  const app = await prisma.rentalApplication.findUnique({
    where: { id: applicationId },
    include: { applicants: { where: { id: applicantId } } },
  });

  if (!app) throw new Error("APPLICATION_NOT_FOUND");
  if (!app.applicants || app.applicants.length === 0) {
    throw new Error("APPLICANT_NOT_FOUND");
  }

  // Store file
  const saved = await storage.save(file.buffer, {
    applicationId,
    applicantId,
    docType,
    fileName: file.fileName,
    mimeType: file.mimeType,
  });

  // Create DB record
  const attachment = await prisma.rentalAttachment.create({
    data: {
      applicationId,
      applicantId,
      docType,
      fileName: file.fileName,
      fileSizeBytes: saved.size,
      mimeType: saved.mimeType,
      storageKey: saved.key,
      sha256: saved.sha256,
    },
  });

  return mapAttachmentToDTO(attachment);
}

/**
 * Get a single application by ID (full detail).
 */
export async function getApplication(
  applicationId: string,
): Promise<RentalApplicationDTO | null> {
  const app = await prisma.rentalApplication.findUnique({
    where: { id: applicationId },
    include: RENTAL_APPLICATION_INCLUDE,
  });

  return app ? mapApplicationToDTO(app) : null;
}

/**
 * List applications for a given unit (manager/owner view).
 * Returns ranked list with evaluation data.
 */
export async function listApplicationsForUnit(
  orgId: string,
  unitId: string,
  view: "summary" | "full" = "summary",
): Promise<RentalApplicationSummaryDTO[] | RentalApplicationDTO[]> {
  // Find all application-unit links for this unit (only submitted applications)
  const applicationUnits = await prisma.rentalApplicationUnit.findMany({
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
      { disqualified: "asc" }, // non-disqualified first
      { scoreTotal: "desc" },
    ],
  });

  const apps = applicationUnits.map((au) => au.application);

  if (view === "full") {
    return apps.map(mapApplicationToDTO);
  }
  return apps.map(mapApplicationToSummaryDTO);
}

/**
 * Manager adjusts the evaluation score for an application-unit.
 */
export async function adjustEvaluation(
  applicationUnitId: string,
  input: AdjustScoreInput,
): Promise<RentalApplicationUnitDTO> {
  const au = await prisma.rentalApplicationUnit.findUnique({
    where: { id: applicationUnitId },
    include: {
      unit: { include: { building: true } },
    },
  });

  if (!au) throw new Error("APPLICATION_UNIT_NOT_FOUND");

  const newScore = (au.scoreTotal || 0) + input.scoreDelta;

  const updated = await prisma.rentalApplicationUnit.update({
    where: { id: applicationUnitId },
    data: {
      scoreTotal: newScore,
      managerScoreDelta: (au.managerScoreDelta || 0) + input.scoreDelta,
      managerOverrideReason: input.reason,
      managerOverrideJson: (input.overrideJson as any) || undefined,
    },
    include: {
      unit: { include: { building: true } },
    },
  });

  return mapApplicationUnitToDTO(updated);
}

/**
 * Owner/Manager overrides disqualification for an application-unit.
 * Sets disqualified=false and records the override reason.
 */
export async function overrideDisqualification(
  applicationUnitId: string,
  reason: string,
): Promise<RentalApplicationUnitDTO> {
  const au = await prisma.rentalApplicationUnit.findUnique({
    where: { id: applicationUnitId },
    include: { unit: { include: { building: true } } },
  });

  if (!au) throw new Error("APPLICATION_UNIT_NOT_FOUND");
  if (!au.disqualified) throw new Error("NOT_DISQUALIFIED");

  const updated = await prisma.rentalApplicationUnit.update({
    where: { id: applicationUnitId },
    data: {
      disqualified: false,
      managerOverrideReason: reason,
      managerOverrideJson: {
        type: "disqualification_override",
        previousReasons: au.disqualifiedReasons,
        overriddenAt: new Date().toISOString(),
        reason,
      },
    },
    include: { unit: { include: { building: true } } },
  });

  return mapApplicationUnitToDTO(updated);
}

/**
 * List vacant units (public endpoint).
 */
export async function listVacantUnits(orgId: string) {
  const units = await prisma.unit.findMany({
    where: {
      building: { orgId },
      isVacant: true,
      isActive: true,
    },
    include: {
      building: {
        select: {
          id: true,
          name: true,
          address: true,
          city: true,
          postalCode: true,
        },
      },
      leases: {
        where: { status: { in: ["TERMINATED", "SIGNED"] } },
        orderBy: { endDate: "desc" },
        take: 1,
        select: { endDate: true, terminatedAt: true },
      },
      _count: { select: { rentalApplicationUnits: true } },
    },
    orderBy: [{ building: { name: "asc" } }, { unitNumber: "asc" }],
  });

  return units.map((u) => ({
    id: u.id,
    unitNumber: u.unitNumber,
    floor: u.floor,
    rooms: u.rooms,
    monthlyRentChf: u.monthlyRentChf,
    monthlyChargesChf: u.monthlyChargesChf,
    vacantSince: u.leases[0]?.endDate ?? u.leases[0]?.terminatedAt ?? null,
    applicationCount: u._count.rentalApplicationUnits,
    building: u.building
      ? {
          id: u.building.id,
          name: u.building.name,
          address: u.building.address,
          city: u.building.city,
          postalCode: u.building.postalCode,
        }
      : undefined,
  }));
}
