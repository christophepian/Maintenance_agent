/**
 * ownerRejectWorkflow
 *
 * Canonical entry point for owner rejection of a maintenance request.
 * Transitions PENDING_OWNER_APPROVAL → OWNER_REJECTED (terminal).
 *
 * Orchestrates:
 *   1. Fetch current request + validate existence
 *   2. Assert state transition is valid (PENDING_OWNER_APPROVAL → OWNER_REJECTED)
 *   3. Persist status change with approvalSource + rejectionReason
 *   4. Emit OWNER_REJECTED domain event
 *   5. Canonical reload + DTO return
 */

import { RequestStatus, ApprovalSource } from "@prisma/client";
import { WorkflowContext } from "./context";
import { assertRequestTransition } from "./transitions";
import { emit } from "../events/bus";
import { findRequestById, findRequestRaw, updateRequestStatus } from "../repositories/requestRepository";
import { toDTO, type MaintenanceRequestDTO } from "../services/maintenanceRequests";

// ─── Input / Output ────────────────────────────────────────────

export interface OwnerRejectInput {
  requestId: string;
  reason?: string | null;
}

export interface OwnerRejectResult {
  dto: MaintenanceRequestDTO;
}

// ─── Workflow ──────────────────────────────────────────────────

export async function ownerRejectWorkflow(
  ctx: WorkflowContext,
  input: OwnerRejectInput,
): Promise<OwnerRejectResult> {
  const { orgId, prisma } = ctx;
  const { requestId, reason } = input;

  // ── 1. Fetch current request ───────────────────────────────
  const current = await findRequestRaw(prisma, requestId);
  if (!current) {
    throw Object.assign(new Error("Request not found"), { code: "NOT_FOUND" });
  }

  // ── 2. Assert transition is valid ──────────────────────────
  assertRequestTransition(current.status, RequestStatus.OWNER_REJECTED);

  // ── 3. Persist status + approval source + rejection reason ─
  await updateRequestStatus(prisma, requestId, RequestStatus.OWNER_REJECTED, {
    approvalSource: ApprovalSource.OWNER_REJECTED,
    rejectionReason: reason ?? null,
  });

  // ── 4. Emit domain event ───────────────────────────────────
  emit({
    type: "OWNER_REJECTED",
    orgId,
    actorUserId: ctx.actorUserId,
    payload: { requestId, reason: reason || null },
  }).catch((err) => console.error("[EVENT] Failed to emit OWNER_REJECTED", err));

  // ── 5. Canonical reload + DTO return ───────────────────────
  const reloaded = await findRequestById(prisma, requestId);
  return { dto: toDTO(reloaded!) };
}
