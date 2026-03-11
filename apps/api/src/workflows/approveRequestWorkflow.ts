/**
 * approveRequestWorkflow
 *
 * Canonical entry point for approving a maintenance request.
 * Handles both manager approval (PATCH /requests/:id/status → APPROVED)
 * and owner approval (POST /requests/:id/owner-approve).
 *
 * Orchestrates:
 *   1. Fetch current request
 *   2. Validate transition
 *   3. Update status → APPROVED
 *   4. Auto-create job in OWNER_DIRECT mode (if contractor available)
 *   5. Emit domain event
 *   6. Canonical reload + DTO return
 */

import { RequestStatus, OrgMode, PrismaClient, ApprovalSource, LegalObligation } from "@prisma/client";
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

const OWNER_APPROVABLE_STATUSES: RequestStatus[] = [
  RequestStatus.PENDING_OWNER_APPROVAL,
  RequestStatus.AUTO_APPROVED,
  RequestStatus.PENDING_REVIEW,
];

const MANAGER_APPROVABLE_STATUSES: RequestStatus[] = [
  RequestStatus.PENDING_REVIEW,
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

  // ── 4. Owner approves from PENDING_OWNER_APPROVAL → create RFP + RFP_PENDING
  if (
    approvalType === "owner" &&
    current.status === RequestStatus.PENDING_OWNER_APPROVAL
  ) {
    assertRequestTransition(current.status, RequestStatus.RFP_PENDING);

    // Create the RFP now (owner just gave the green light)
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
      approvalSource: ApprovalSource.OWNER_APPROVED,
    });

    emit({
      type: "OWNER_APPROVED",
      orgId,
      actorUserId: ctx.actorUserId,
      payload: { requestId, comment: comment || null, rfpId, newStatus: "RFP_PENDING" },
    }).catch((err) => console.error("[EVENT] Failed to emit OWNER_APPROVED", err));

    const reloaded = await findRequestById(prisma, requestId);
    return {
      dto: toDTO(reloaded!),
      jobAutoCreated: false,
      alreadyApproved: false,
    };
  }

  // ── 4b. All other approval paths → APPROVED ───────────────
  await updateRequestStatus(prisma, requestId, RequestStatus.APPROVED, {
    approvalSource: approvalType === "owner"
      ? ApprovalSource.OWNER_APPROVED
      : ApprovalSource.SYSTEM_AUTO,
  });

  // ── 5. Auto-create job in owner-direct mode ────────────────
  let jobAutoCreated = false;
  try {
    jobAutoCreated = await autoCreateJobIfNeeded(prisma, orgId, requestId, current);
  } catch (err: any) {
    if (!String(err?.message || err).includes("already exists")) {
      console.warn("Failed to auto-create job for request", requestId, err);
    }
  }

  // ── 6. Emit event ─────────────────────────────────────────
  const eventType = approvalType === "owner" ? "OWNER_APPROVED" : "REQUEST_APPROVED";
  emit({
    type: eventType,
    orgId,
    actorUserId: ctx.actorUserId,
    payload: { requestId, comment: comment || null },
  }).catch((err) => console.error(`[EVENT] Failed to emit ${eventType}`, err));

  // ── 7. Canonical reload ────────────────────────────────────
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
