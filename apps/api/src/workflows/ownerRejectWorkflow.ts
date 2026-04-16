/**
 * rejectRequestWorkflow (formerly ownerRejectWorkflow)
 *
 * Canonical entry point for rejecting a maintenance request.
 * Supports both manager rejection (from PENDING_REVIEW) and
 * owner rejection (from PENDING_OWNER_APPROVAL).
 *
 * After rejection the tenant may choose to self-pay (tenantSelfPayWorkflow).
 *
 * Orchestrates:
 *   1. Fetch current request + validate existence
 *   2. Assert state transition is valid
 *   3. Persist status change with approvalSource + rejectionReason
 *   4. Emit REQUEST_REJECTED domain event
 *   5. Notify tenant (in-app notification with self-pay offer)
 *   6. Canonical reload + DTO return
 */

import { RequestStatus, ApprovalSource } from "@prisma/client";
import { WorkflowContext } from "./context";
import { assertRequestTransition } from "./transitions";
import { emit } from "../events/bus";
import { findRequestById, findRequestRaw, updateRequestStatus } from "../repositories/requestRepository";
import { toDTO, type MaintenanceRequestDTO } from "../services/maintenanceRequests";
import { notifyTenantOwnerRejected } from "../services/notifications";
import { resolveTenantUserId } from "../services/tenantIdentity";

// ─── Input / Output ────────────────────────────────────────────

export interface RejectRequestInput {
  requestId: string;
  reason?: string | null;
}

export interface RejectRequestResult {
  dto: MaintenanceRequestDTO;
}

/** @deprecated Use RejectRequestInput instead */
export type OwnerRejectInput = RejectRequestInput;
/** @deprecated Use RejectRequestResult instead */
export type OwnerRejectResult = RejectRequestResult;

// ─── Rejectable statuses ───────────────────────────────────────

const REJECTABLE_STATUSES: RequestStatus[] = [
  RequestStatus.PENDING_REVIEW,           // manager rejects
  RequestStatus.PENDING_OWNER_APPROVAL,   // owner rejects
];

// ─── Workflow ──────────────────────────────────────────────────

export async function rejectRequestWorkflow(
  ctx: WorkflowContext,
  input: RejectRequestInput,
): Promise<RejectRequestResult> {
  const { orgId, prisma } = ctx;
  const { requestId, reason } = input;

  // ── 1. Fetch current request ───────────────────────────────
  const current = await findRequestRaw(prisma, requestId);
  if (!current) {
    throw Object.assign(new Error("Request not found"), { code: "NOT_FOUND" });
  }

  // ── 2. Assert transition is valid ──────────────────────────
  if (!REJECTABLE_STATUSES.includes(current.status)) {
    throw Object.assign(
      new Error(`Cannot reject request in status ${current.status}`),
      { code: "INVALID_TRANSITION" },
    );
  }
  assertRequestTransition(current.status, RequestStatus.REJECTED);

  // ── 3. Persist status + approval source + rejection reason ─
  await updateRequestStatus(prisma, requestId, RequestStatus.REJECTED, {
    approvalSource: ApprovalSource.REJECTED,
    rejectionReason: reason ?? null,
  });

  // ── 4. Emit domain event ───────────────────────────────────
  emit({
    type: "REQUEST_REJECTED",
    orgId,
    actorUserId: ctx.actorUserId,
    payload: { requestId, reason: reason || null },
  }).catch((err) => console.error("[EVENT] Failed to emit REQUEST_REJECTED", err));

  // ── 5. Notify tenant ───────────────────────────────────────
  if (current.tenantId) {
    try {
      const tenantUserId = await resolveTenantUserId(prisma, orgId, current.tenantId);
      const buildingId = current.unitId
        ? (await prisma.unit.findUnique({ where: { id: current.unitId }, select: { buildingId: true } }))?.buildingId ?? undefined
        : undefined;
      await notifyTenantOwnerRejected(requestId, orgId, tenantUserId, reason, buildingId);
    } catch (err) {
      console.error("[rejectRequestWorkflow] Failed to notify tenant", err);
    }
  }

  // ── 6. Canonical reload + DTO return ───────────────────────
  const reloaded = await findRequestById(prisma, requestId);
  return { dto: toDTO(reloaded!) };
}

/** @deprecated Use rejectRequestWorkflow instead */
export const ownerRejectWorkflow = rejectRequestWorkflow;
