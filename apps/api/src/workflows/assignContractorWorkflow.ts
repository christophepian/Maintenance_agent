/**
 * assignContractorWorkflow
 *
 * Canonical entry point for assigning a contractor to a request.
 * Orchestrates:
 *   1. Validate contractor exists and is active
 *   2. Assign contractor to request
 *   3. Auto-create a Job so the contractor sees it
 *   4. Canonical reload + DTO return
 */

import { WorkflowContext } from "./context";
import { emit } from "../events/bus";
import { findRequestById } from "../repositories/requestRepository";
import { assignContractor } from "../services/requestAssignment";
import { getOrCreateJobForRequest } from "../services/jobs";
import { toDTO, type MaintenanceRequestDTO } from "../services/maintenanceRequests";

// ─── Input / Output ────────────────────────────────────────────

export interface AssignContractorInput {
  requestId: string;
  contractorId: string;
}

export interface AssignContractorResult {
  dto: MaintenanceRequestDTO;
  message: string;
  jobCreated: boolean;
}

// ─── Workflow ──────────────────────────────────────────────────

export async function assignContractorWorkflow(
  ctx: WorkflowContext,
  input: AssignContractorInput,
): Promise<AssignContractorResult> {
  const { orgId, prisma } = ctx;
  const { requestId, contractorId } = input;

  // ── 1. Assign contractor ───────────────────────────────────
  const result = await assignContractor(prisma, requestId, contractorId);
  if (!result.success) {
    throw Object.assign(new Error(result.message), { code: "ASSIGNMENT_FAILED" });
  }

  // ── 2. Auto-create job ─────────────────────────────────────
  let jobCreated = false;
  try {
    await getOrCreateJobForRequest(orgId, requestId, contractorId);
    jobCreated = true;
  } catch (e: any) {
    // Non-fatal: assignment succeeded, but job creation failed
    console.warn(`[ASSIGN] Job auto-creation failed for request ${requestId}:`, e?.message);
  }

  // ── 3. Emit event ──────────────────────────────────────────
  emit({
    type: "CONTRACTOR_ASSIGNED",
    orgId,
    actorUserId: ctx.actorUserId,
    payload: { requestId, contractorId, jobCreated },
  }).catch((err) => console.error("[EVENT] Failed to emit CONTRACTOR_ASSIGNED", err));

  // ── 4. Canonical reload ────────────────────────────────────
  const reloaded = await findRequestById(prisma, requestId);
  if (!reloaded) throw Object.assign(new Error("Request not found"), { code: "NOT_FOUND" });

  return {
    dto: toDTO(reloaded),
    message: result.message,
    jobCreated,
  };
}
