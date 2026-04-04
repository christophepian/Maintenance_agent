/**
 * unassignContractorWorkflow
 *
 * Canonical entry point for removing a contractor assignment.
 * Orchestrates:
 *   1. Unassign the contractor
 *   2. Canonical reload + DTO return
 */

import { RequestStatus } from "@prisma/client";
import { WorkflowContext } from "./context";
import { emit } from "../events/bus";
import { findRequestById } from "../repositories/requestRepository";
import { unassignContractor } from "../services/requestAssignment";
import { toDTO, type MaintenanceRequestDTO } from "../services/maintenanceRequests";
import { assertRequestTransition } from "./transitions";

// ─── Input / Output ────────────────────────────────────────────

export interface UnassignContractorInput {
  requestId: string;
}

export interface UnassignContractorResult {
  dto: MaintenanceRequestDTO;
  message: string;
}

// ─── Workflow ──────────────────────────────────────────────────

export async function unassignContractorWorkflow(
  ctx: WorkflowContext,
  input: UnassignContractorInput,
): Promise<UnassignContractorResult> {
  const { prisma } = ctx;
  const { requestId } = input;

  // ── 0. Validate transition ─────────────────────────────────
  const current = await prisma.request.findUnique({
    where: { id: requestId },
    select: { status: true },
  });
  if (!current) throw Object.assign(new Error("Request not found"), { code: "NOT_FOUND" });
  // Idempotent: if already APPROVED, skip transition check — just clear stale contractor
  if (current.status !== RequestStatus.APPROVED) {
    assertRequestTransition(current.status as RequestStatus, RequestStatus.APPROVED);
  }

  // ── 1. Unassign ────────────────────────────────────────────
  const result = await unassignContractor(prisma, requestId);

  // ── 2. Emit event ──────────────────────────────────────────
  emit({
    type: "CONTRACTOR_UNASSIGNED",
    orgId: ctx.orgId,
    actorUserId: ctx.actorUserId,
    payload: { requestId },
  }).catch((err) => console.error("[EVENT] Failed to emit CONTRACTOR_UNASSIGNED", err));

  // ── 3. Canonical reload ────────────────────────────────────
  const reloaded = await findRequestById(prisma, requestId);
  if (!reloaded) throw Object.assign(new Error("Request not found"), { code: "NOT_FOUND" });

  return {
    dto: toDTO(reloaded),
    message: result.message,
  };
}
