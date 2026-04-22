/**
 * completionRatingWorkflow
 *
 * Companion workflows for the job completion lifecycle (Slice 7):
 *   1. contractorCompleteJobWorkflow — contractor marks job completed
 *   2. confirmCompletionWorkflow — tenant confirms completion
 *   3. submitRatingWorkflow — contractor or tenant rates the other party
 *
 * The contractor completion delegates to the existing completeJobWorkflow
 * and adds contractor-specific guards.
 */

import { JobStatus, RaterRole } from "@prisma/client";
import { WorkflowContext } from "./context";
import { emit } from "../events/bus";
import { completeJobWorkflow } from "./completeJobWorkflow";
import { findJobById, updateJobRecord } from "../repositories/jobRepository";
import {
  createRating,
  findRatingForJobByRole,
} from "../repositories/ratingRepository";
import { createNotification } from "../services/notifications";
import { issueInvoiceWorkflow } from "./issueInvoiceWorkflow";
import { assetRepo } from "../repositories";
import type { JobDTO } from "../services/jobs";

// ─── Error class ───────────────────────────────────────────────

export class CompletionError extends Error {
  public readonly code: string;
  constructor(code: string, message: string) {
    super(message);
    this.name = "CompletionError";
    this.code = code;
  }
}

// ─── Contractor Complete ───────────────────────────────────────

export interface ContractorCompleteInput {
  jobId: string;
  contractorId: string;
  actualCost?: number;
  completedAt?: string;
  notes?: string;
  interventionType?: "REPAIR" | "REPLACEMENT";
}

export interface ContractorCompleteResult {
  dto: JobDTO;
  invoiceAutoCreated: boolean;
}

/**
 * Contractor marks a job as completed.
 * Guards: job must exist, belong to org, be assigned to this contractor,
 * and be in PENDING or IN_PROGRESS status.
 *
 * Delegates actual transition to completeJobWorkflow (reuse, not duplication).
 * Then notifies the tenant that work is done and they can confirm.
 */
export async function contractorCompleteJobWorkflow(
  ctx: WorkflowContext,
  input: ContractorCompleteInput,
): Promise<ContractorCompleteResult> {
  const { orgId, prisma } = ctx;

  // 1. Fetch + guard
  const job = await findJobById(prisma, input.jobId);
  if (!job || job.orgId !== orgId) {
    throw new CompletionError("NOT_FOUND", "Job not found");
  }
  if (job.contractorId !== input.contractorId) {
    throw new CompletionError("FORBIDDEN", "Not your job");
  }
  if (job.status === "COMPLETED" || job.status === "INVOICED") {
    throw new CompletionError("INVALID_STATUS", "Job is already completed");
  }

  // 2. Delegate to existing completeJobWorkflow
  const result = await completeJobWorkflow(ctx, {
    jobId: input.jobId,
    actualCost: input.actualCost,
    completedAt: input.completedAt,
  });

  // 3. Auto-log AssetIntervention if request has a linked asset
  const assetId = job.request?.assetId;
  if (assetId && input.interventionType) {
    try {
      await assetRepo.addIntervention(prisma, assetId, {
        type: input.interventionType as any,
        interventionDate: input.completedAt ? new Date(input.completedAt) : new Date(),
        costChf: input.actualCost ?? null,
        jobId: input.jobId,
        notes: input.notes ?? null,
      });
    } catch (err) {
      console.warn("[completionRating] Failed to auto-log intervention", err);
    }
  }

  // 4. Notify tenant that work is done (if tenant exists)
  const tenantId = job.request?.tenantId;
  if (tenantId) {
    try {
      // Find a user associated with this tenant for notification
      // Tenant notifications use tenantId as userId (matching existing pattern)
      await createNotification({
        orgId,
        userId: tenantId,
        entityType: "JOB",
        entityId: job.id,
        eventType: "JOB_COMPLETED" as any,
        message: `Work has been completed for your maintenance request. Please confirm the completion.`,
      });
    } catch (err) {
      console.warn("[completionRating] Failed to notify tenant", err);
    }
  }

  return result;
}

// ─── Tenant Confirm Completion ─────────────────────────────────

export interface ConfirmCompletionInput {
  jobId: string;
  tenantId: string;
}

export interface ConfirmCompletionResult {
  dto: JobDTO;
}

/**
 * Tenant confirms that the intervention was completed.
 * Guards: job must be COMPLETED, tenant must own the request.
 * Sets confirmedAt timestamp.
 */
export async function confirmCompletionWorkflow(
  ctx: WorkflowContext,
  input: ConfirmCompletionInput,
): Promise<ConfirmCompletionResult> {
  const { orgId, prisma } = ctx;

  // 1. Fetch + guard
  const job = await findJobById(prisma, input.jobId);
  if (!job || job.orgId !== orgId) {
    throw new CompletionError("NOT_FOUND", "Job not found");
  }
  if (job.status !== "COMPLETED" && job.status !== "INVOICED") {
    throw new CompletionError("INVALID_STATUS", "Job is not completed yet");
  }
  if (job.request?.tenantId !== input.tenantId) {
    throw new CompletionError("FORBIDDEN", "Not your request");
  }
  if (job.confirmedAt) {
    throw new CompletionError("ALREADY_CONFIRMED", "Completion already confirmed");
  }

  // 2. Set confirmedAt
  const updated = await updateJobRecord(prisma, job.id, {
    confirmedAt: new Date(),
  });

  // 3. Emit event
  emit({
    type: "JOB_CONFIRMED",
    orgId,
    actorUserId: ctx.actorUserId,
    payload: {
      jobId: job.id,
      requestId: job.requestId,
      tenantId: input.tenantId,
    },
  }).catch((err) => console.error("[EVENT] Failed to emit JOB_CONFIRMED", err));

  // 4. Notify contractor
  try {
    await createNotification({
      orgId,
      userId: job.contractorId,
      entityType: "JOB",
      entityId: job.id,
      eventType: "JOB_CONFIRMED" as any,
      message: `The tenant has confirmed completion of the job. You can now submit a rating.`,
    });
  } catch (err) {
    console.warn("[completionRating] Failed to notify contractor", err);
  }

  // 5. Map to DTO — import service mapper
  const { getJob } = require("../services/jobs");
  const dto = await getJob(job.id);

  return { dto: dto! };
}

// ─── Rating Submission ─────────────────────────────────────────

export interface SubmitRatingInput {
  jobId: string;
  raterRole: "CONTRACTOR" | "TENANT";
  /** For CONTRACTOR: the contractorId; for TENANT: the tenantId */
  raterId: string;
  score: number;
  scorePunctuality?: number | null;
  scoreAccuracy?: number | null;
  scoreCourtesy?: number | null;
  comment?: string;
}

export interface SubmitRatingResult {
  rating: {
    id: string;
    jobId: string;
    raterRole: string;
    score: number;
    scorePunctuality: number | null;
    scoreAccuracy: number | null;
    scoreCourtesy: number | null;
    comment: string | null;
    createdAt: string;
  };
}

/**
 * Submit a rating for a completed job.
 * Guards:
 *   - Job must be COMPLETED or INVOICED
 *   - Rater must be the contractor or own-tenant for the job
 *   - One rating per rater role per job (enforced by DB unique + pre-check)
 */
export async function submitRatingWorkflow(
  ctx: WorkflowContext,
  input: SubmitRatingInput,
): Promise<SubmitRatingResult> {
  const { orgId, prisma } = ctx;

  // 1. Fetch + guard
  const job = await findJobById(prisma, input.jobId);
  if (!job || job.orgId !== orgId) {
    throw new CompletionError("NOT_FOUND", "Job not found");
  }
  if (job.status !== "COMPLETED" && job.status !== "INVOICED") {
    throw new CompletionError("INVALID_STATUS", "Job is not completed yet");
  }

  // 2. Verify rater identity
  if (input.raterRole === "CONTRACTOR") {
    if (job.contractorId !== input.raterId) {
      throw new CompletionError("FORBIDDEN", "Not your job");
    }
  } else {
    // TENANT
    if (job.request?.tenantId !== input.raterId) {
      throw new CompletionError("FORBIDDEN", "Not your request");
    }
  }

  // 3. Check for duplicate
  const existing = await findRatingForJobByRole(
    prisma,
    input.jobId,
    input.raterRole as RaterRole,
  );
  if (existing) {
    throw new CompletionError("DUPLICATE_RATING", "You have already rated this job");
  }

  // 4. Create rating
  const rating = await createRating(prisma, {
    orgId,
    jobId: input.jobId,
    raterRole: input.raterRole as RaterRole,
    score: input.score,
    scorePunctuality: input.scorePunctuality ?? null,
    scoreAccuracy:    input.scoreAccuracy    ?? null,
    scoreCourtesy:    input.scoreCourtesy    ?? null,
    comment: input.comment ?? null,
  });

  // 5. Emit event
  emit({
    type: "RATING_SUBMITTED",
    orgId,
    actorUserId: ctx.actorUserId,
    payload: {
      jobId: input.jobId,
      ratingId: rating.id,
      raterRole: input.raterRole,
      score: input.score,
    },
  }).catch((err) => console.error("[EVENT] Failed to emit RATING_SUBMITTED", err));

  // 6. Notify the other party
  const recipientId =
    input.raterRole === "CONTRACTOR" ? job.request?.tenantId : job.contractorId;
  if (recipientId) {
    try {
      await createNotification({
        orgId,
        userId: recipientId,
        entityType: "RATING",
        entityId: rating.id,
        eventType: "RATING_SUBMITTED" as any,
        message: `A rating has been submitted for a completed job.`,
      });
    } catch (err) {
      console.warn("[completionRating] Failed to notify rating recipient", err);
    }
  }

  // 7. Auto-issue draft invoice once BOTH parties have rated
  //    This triggers the ledger posting for owner-addressed invoices.
  try {
    const otherRole: RaterRole =
      input.raterRole === "CONTRACTOR" ? RaterRole.TENANT : RaterRole.CONTRACTOR;
    const otherRating = await findRatingForJobByRole(prisma, input.jobId, otherRole);

    if (otherRating) {
      // Both rated — find the DRAFT invoice for this job and issue it
      const draftInvoice = await prisma.invoice.findFirst({
        where: { jobId: input.jobId, status: "DRAFT" },
        select: { id: true },
      });
      if (draftInvoice) {
        await issueInvoiceWorkflow(
          { orgId, prisma, actorUserId: ctx.actorUserId ?? "system" },
          { invoiceId: draftInvoice.id },
        );
        console.info(`[completionRating] Auto-issued invoice ${draftInvoice.id} after both parties rated job ${input.jobId}`);
      }
    }
  } catch (err) {
    // Non-blocking — invoice can still be issued manually
    console.warn("[completionRating] Auto-invoice issue failed (non-blocking):", err);
  }

  return {
    rating: {
      id: rating.id,
      jobId: rating.jobId,
      raterRole: rating.raterRole,
      score: rating.score,
      scorePunctuality: rating.scorePunctuality,
      scoreAccuracy:    rating.scoreAccuracy,
      scoreCourtesy:    rating.scoreCourtesy,
      comment: rating.comment,
      createdAt: rating.createdAt.toISOString(),
    },
  };
}
