/**
 * submitRentalApplicationWorkflow
 *
 * Canonical entry point for submitting a rental application.
 * This is the heaviest rental-application orchestration: validates
 * the application, runs scoring evaluation per unit, persists all
 * updates in a transaction, enqueues missing-docs emails, and
 * notifies managers/owners.
 *
 * Orchestrates:
 *   1.  Fetch application with full includes
 *   2.  Validate status (must be DRAFT)
 *   3.  Assert DRAFT → SUBMITTED transition
 *   4.  Build application data snapshot
 *   5.  Run evaluation for each unit (scoring via rentalRules)
 *   6.  Transaction: mark submitted + update all unit evaluations
 *   7.  Enqueue missing-docs email if applicable
 *   8.  Notify managers/owners of new application
 *   9.  Emit RENTAL_APPLICATION_SUBMITTED event
 *   10. Emit RENTAL_APPLICATION_EVALUATED event
 *   11. Re-fetch with full includes, return DTO
 */

import { WorkflowContext } from "./context";
import { assertRentalApplicationTransition } from "./transitions";
import { emit } from "../events/bus";
import {
  findApplicationForSubmit,
  findApplicationById,
} from "../repositories/rentalApplicationRepository";
import { evaluate } from "../services/rentalRules";
import { enqueueEmail } from "../services/emailOutbox";
import { mapApplicationToDTO, type RentalApplicationDTO } from "../services/rentalApplications";
import { RENTAL_APPLICATION_INCLUDE } from "../services/rentalIncludes";

// ─── Input / Output ────────────────────────────────────────────

export interface SubmitRentalApplicationInput {
  applicationId: string;
  signedName: string;
  /** Request metadata for audit trail. */
  meta: {
    ip: string;
    userAgent: string;
  };
}

export interface SubmitRentalApplicationResult {
  dto: RentalApplicationDTO;
}

// ─── Workflow ──────────────────────────────────────────────────

export async function submitRentalApplicationWorkflow(
  ctx: WorkflowContext,
  input: SubmitRentalApplicationInput,
): Promise<SubmitRentalApplicationResult> {
  const { prisma, orgId } = ctx;
  const { applicationId, signedName, meta } = input;

  // ── 1. Fetch application with full includes ────────────────
  const app = await findApplicationForSubmit(prisma, applicationId);
  if (!app) {
    throw Object.assign(new Error("APPLICATION_NOT_FOUND"), { code: "NOT_FOUND" });
  }

  // ── 2. Validate status ────────────────────────────────────
  if (app.status !== "DRAFT") {
    throw Object.assign(new Error("ALREADY_SUBMITTED"), { code: "CONFLICT" });
  }

  if (!app.applicationUnits || app.applicationUnits.length === 0) {
    throw new Error("NO_UNITS_SELECTED");
  }

  // ── 3. Assert transition ──────────────────────────────────
  assertRentalApplicationTransition(app.status, "SUBMITTED");

  // ── 4. Build application data snapshot ────────────────────
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

  // ── 5. Run evaluation for each unit ───────────────────────
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
      rank: i + 1,
    });
  }

  // ── 6. Transaction: update application + all unit evaluations
  await prisma.$transaction(async (tx: any) => {
    // Mark submitted
    await tx.rentalApplication.update({
      where: { id: applicationId },
      data: {
        status: "SUBMITTED",
        submittedAt: new Date(),
        signedName,
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
  });

  // ── 7. Enqueue missing-docs email if applicable ───────────
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

  // ── 8. Notify managers/owners ─────────────────────────────
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

    const { notifyApplicationSubmitted } = await import("../services/notifications");
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

  // ── 9. Emit APPLICATION_SUBMITTED event ───────────────────
  const primaryApplicant = app.applicants.find((a: any) => a.role === "PRIMARY") || app.applicants[0];
  const applicantName = primaryApplicant
    ? `${(primaryApplicant as any).firstName} ${(primaryApplicant as any).lastName}`
    : "Unknown";

  emit({
    type: "RENTAL_APPLICATION_SUBMITTED",
    orgId: app.orgId,
    actorUserId: ctx.actorUserId,
    payload: {
      applicationId,
      unitIds: evaluationUpdates.map((eu) => eu.unitId),
      applicantName,
    },
  }).catch((err) => console.error("[EVENT] Failed to emit RENTAL_APPLICATION_SUBMITTED", err));

  // ── 10. Emit APPLICATION_EVALUATED event ──────────────────
  emit({
    type: "RENTAL_APPLICATION_EVALUATED",
    orgId: app.orgId,
    actorUserId: ctx.actorUserId,
    payload: {
      applicationId,
      unitEvaluations: evaluationUpdates.map((eu) => ({
        unitId: eu.unitId,
        scoreTotal: eu.scoreTotal,
        disqualified: eu.disqualified,
      })),
    },
  }).catch((err) => console.error("[EVENT] Failed to emit RENTAL_APPLICATION_EVALUATED", err));

  // ── 11. Re-fetch with full includes, return DTO ───────────
  const result = await findApplicationById(prisma, applicationId);
  return { dto: mapApplicationToDTO(result!) };
}
