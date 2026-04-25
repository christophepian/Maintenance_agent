/**
 * approveRequestWorkflow
 *
 * Canonical entry point for approving a maintenance request.
 *
 * Two paths:
 *   A) Manager approves from PENDING_REVIEW → create RFP + transition to RFP_PENDING
 *   B) Owner approves from PENDING_OWNER_APPROVAL → APPROVED,
 *      complete the pending RFP award, create job
 *
 * Orchestrates:
 *   1. Fetch current request
 *   2. Validate transition
 *   3. Route to appropriate approval path
 *   4. Emit domain event
 *   5. Canonical reload + DTO return
 */

import { RequestStatus, OrgMode, PrismaClient, ApprovalSource, LegalObligation, RfpStatus } from "@prisma/client";
import { WorkflowContext } from "./context";
import { InvalidTransitionError, assertRequestTransition } from "./transitions";
import { emit } from "../events/bus";
import { findRequestById, findRequestRaw, updateRequestStatus } from "../repositories/requestRepository";
import { findJobByRequestIdRaw } from "../repositories/jobRepository";
import { toDTO, type MaintenanceRequestDTO } from "../services/maintenanceRequests";
import { findMatchingContractor, assignContractor } from "../services/requestAssignment";
import { getOrgConfig } from "../services/orgConfig";
import { createJob } from "../services/jobs";
import { createRfpForRequest } from "../services/rfps";
import { awardQuoteWorkflow } from "./awardQuoteWorkflow";

// ─── Input / Output ────────────────────────────────────────────

export interface ApproveRequestInput {
  requestId: string;
  comment?: string | null;
  /** "manager" for PATCH /requests/:id/status, "owner" for POST /requests/:id/owner-approve */
  approvalType: "manager" | "owner";
}

export interface ApproveRequestResult {
  dto: MaintenanceRequestDTO;
  /** True if a job was auto-created as part of the approval. */
  jobAutoCreated: boolean;
  /** True if the request was already approved (idempotent). */
  alreadyApproved: boolean;
}

// ─── Allowed source statuses ───────────────────────────────────

/** Manager can approve requests sitting in PENDING_REVIEW → creates RFP */
const MANAGER_APPROVABLE_STATUSES: RequestStatus[] = [
  RequestStatus.PENDING_REVIEW,
];

/** Owner can approve requests sitting in PENDING_OWNER_APPROVAL (post-quote cost check) */
const OWNER_APPROVABLE_STATUSES: RequestStatus[] = [
  RequestStatus.PENDING_OWNER_APPROVAL,
];

// ─── Workflow ──────────────────────────────────────────────────

export async function approveRequestWorkflow(
  ctx: WorkflowContext,
  input: ApproveRequestInput,
): Promise<ApproveRequestResult> {
  const { orgId, prisma } = ctx;
  const { requestId, comment, approvalType } = input;

  // ── 1. Fetch current request ───────────────────────────────
  const current = await findRequestRaw(prisma, requestId);
  if (!current) throw Object.assign(new Error("Request not found"), { code: "NOT_FOUND" });

  // ── 2. Idempotency: already approved → just ensure job exists
  if (current.status === RequestStatus.APPROVED) {
    await autoCreateJobIfNeeded(prisma, orgId, requestId, current);
    const reloaded = await findRequestById(prisma, requestId);
    return {
      dto: toDTO(reloaded!),
      jobAutoCreated: false,
      alreadyApproved: true,
    };
  }

  // ── 3. Validate transition ─────────────────────────────────
  const allowedStatuses = approvalType === "owner"
    ? OWNER_APPROVABLE_STATUSES
    : MANAGER_APPROVABLE_STATUSES;

  if (!allowedStatuses.includes(current.status)) {
    throw new InvalidTransitionError("Request", current.status, "APPROVED");
  }

  // ── 4A. Manager approves from PENDING_REVIEW → create RFP + RFP_PENDING
  if (
    approvalType === "manager" &&
    current.status === RequestStatus.PENDING_REVIEW
  ) {
    assertRequestTransition(current.status, RequestStatus.RFP_PENDING);

    // Create the RFP (manager gave the green light — collect quotes)
    let rfpId: string | null = null;
    try {
      const rfp = await createRfpForRequest(orgId, requestId, {
        legalObligation: LegalObligation.UNKNOWN,
        legalTopic: current.category,
      });
      rfpId = rfp.id;
    } catch (rfpErr: any) {
      console.warn(`[approve] RFP creation failed for ${requestId}:`, rfpErr.message);
    }

    await updateRequestStatus(prisma, requestId, RequestStatus.RFP_PENDING, {
      approvalSource: ApprovalSource.SYSTEM_AUTO,
    });

    emit({
      type: "REQUEST_APPROVED",
      orgId,
      actorUserId: ctx.actorUserId,
      payload: { requestId, comment: comment || null, rfpId, newStatus: "RFP_PENDING" },
    }).catch((err) => console.error("[EVENT] Failed to emit REQUEST_APPROVED", err));

    const reloaded = await findRequestById(prisma, requestId);
    return {
      dto: toDTO(reloaded!),
      jobAutoCreated: false,
      alreadyApproved: false,
    };
  }

  // ── 4B. Owner approves from PENDING_OWNER_APPROVAL → APPROVED → ASSIGNED
  //        The APPROVED intermediate state and the final ASSIGNED write are wrapped
  //        in a single transaction so the request can never get stuck at APPROVED.
  //        Note: emit() and createNotification() calls inside awardQuoteWorkflow are
  //        fire-and-forget side effects outside the DB transaction — they will not roll
  //        back if the transaction fails, which is acceptable.
  if (
    approvalType === "owner" &&
    current.status === RequestStatus.PENDING_OWNER_APPROVAL
  ) {
    assertRequestTransition(current.status, RequestStatus.APPROVED);

    let jobAutoCreated = false;
    try {
      await prisma.$transaction(async (tx: any) => {
        // Set APPROVED inside the transaction
        await tx.request.update({
          where: { id: requestId },
          data: { status: RequestStatus.APPROVED, approvalSource: ApprovalSource.OWNER_APPROVED },
        });

        // Find the RFP and complete the award (also writes ASSIGNED) inside the same tx
        const pendingRfp = await tx.rfp.findFirst({
          where: { requestId, status: RfpStatus.PENDING_OWNER_APPROVAL },
          select: { id: true, awardedQuoteId: true },
        });

        if (pendingRfp?.awardedQuoteId) {
          await awardQuoteWorkflow(
            { ...ctx, prisma: tx as unknown as PrismaClient },
            { rfpId: pendingRfp.id, quoteId: pendingRfp.awardedQuoteId, actorRole: "OWNER" },
          );
          jobAutoCreated = true;
        }
      });
    } catch (rfpErr: any) {
      throw Object.assign(
        new Error(`Owner approval failed: ${rfpErr.message}`),
        { code: "OWNER_APPROVAL_FAILED" },
      );
    }

    emit({
      type: "OWNER_APPROVED",
      orgId,
      actorUserId: ctx.actorUserId,
      payload: { requestId, comment: comment || null },
    }).catch((err) => console.error("[EVENT] Failed to emit OWNER_APPROVED", err));

    const reloaded = await findRequestById(prisma, requestId);
    return {
      dto: toDTO(reloaded!),
      jobAutoCreated,
      alreadyApproved: false,
    };
  }

  // ── 4C. Fallback: direct approve (backwards compat) ────────
  await updateRequestStatus(prisma, requestId, RequestStatus.APPROVED, {
    approvalSource: approvalType === "owner"
      ? ApprovalSource.OWNER_APPROVED
      : ApprovalSource.SYSTEM_AUTO,
  });

  let jobAutoCreated = false;
  try {
    jobAutoCreated = await autoCreateJobIfNeeded(prisma, orgId, requestId, current);
  } catch (err: any) {
    if (!String(err?.message || err).includes("already exists")) {
      console.warn("Failed to auto-create job for request", requestId, err);
    }
  }

  const eventType = approvalType === "owner" ? "OWNER_APPROVED" : "REQUEST_APPROVED";
  emit({
    type: eventType,
    orgId,
    actorUserId: ctx.actorUserId,
    payload: { requestId, comment: comment || null },
  }).catch((err) => console.error(`[EVENT] Failed to emit ${eventType}`, err));

  const reloaded = await findRequestById(prisma, requestId);
  return {
    dto: toDTO(reloaded!),
    jobAutoCreated,
    alreadyApproved: false,
  };
}

// ─── Internal: auto-create job in owner-direct mode ────────────

async function autoCreateJobIfNeeded(
  prisma: PrismaClient,
  orgId: string,
  requestId: string,
  current: any,
): Promise<boolean> {
  const orgConfig = await getOrgConfig(prisma, orgId);
  if (orgConfig.mode !== OrgMode.OWNER_DIRECT) return false;

  const existingJob = await findJobByRequestIdRaw(prisma, requestId);
  if (existingJob) return false;

  let contractorId = current.assignedContractorId;
  if (!contractorId && current.category) {
    const matching = await findMatchingContractor(prisma, orgId, current.category);
    if (matching) {
      contractorId = matching.id;
      await assignContractor(prisma, requestId, contractorId);
    }
  }

  if (contractorId) {
    await createJob({ orgId, requestId, contractorId });
    return true;
  }

  return false;
}
