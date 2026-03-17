/**
 * rfpDirectAssignWorkflow
 *
 * Canonical entry point for bypassing quote collection and directly
 * assigning a contractor to the request linked to an RFP.
 *
 * Rules enforced:
 *   1. RFP must be OPEN (not yet awarded, closed, or cancelled).
 *   2. RFP must have a linked request.
 *   3. Contractor must be active and belong to the same org.
 *   4. Delegates actual contractor assignment to the existing
 *      assignContractorWorkflow (reuses assignment + job creation).
 *
 * Side effects:
 *   - Closes the RFP (OPEN → CLOSED) + rejects any submitted quotes
 *   - Assigns contractor to the linked request (via assignContractorWorkflow)
 *   - Auto-creates a Job (via assignContractorWorkflow)
 *   - Emits RFP_DIRECT_ASSIGNED domain event
 *   - Creates notification for assigned contractor
 *
 * Orchestrates:
 *   1. Fetch RFP + org scoping
 *   2. Assert RFP is OPEN
 *   3. Validate linked request exists
 *   4. Validate contractor (active + same org)
 *   5. Close RFP + reject submitted quotes (via repository)
 *   6. Assign contractor via existing assignContractorWorkflow
 *   7. Emit domain event
 *   8. Send notification
 *   9. Return result
 */

import { RfpStatus } from "@prisma/client";
import { WorkflowContext } from "./context";
import { assertRfpTransition } from "./transitions";
import { emit } from "../events/bus";
import { findRfpById, closeRfpForDirectAssign } from "../repositories/rfpRepository";
import { findContractorById } from "../repositories/contractorRepository";
import { assignContractorWorkflow } from "./assignContractorWorkflow";
import { createNotification } from "../services/notifications";

// ─── Input / Output ────────────────────────────────────────────

export interface RfpDirectAssignInput {
  rfpId: string;
  contractorId: string;
}

export interface RfpDirectAssignResult {
  rfpId: string;
  requestId: string;
  contractorId: string;
  jobCreated: boolean;
  rfpStatus: string;
}

// ─── Errors ────────────────────────────────────────────────────

export class RfpDirectAssignError extends Error {
  public code: string;
  constructor(code: string, message: string) {
    super(message);
    this.name = "RfpDirectAssignError";
    this.code = code;
  }
}

// ─── Workflow ──────────────────────────────────────────────────

export async function rfpDirectAssignWorkflow(
  ctx: WorkflowContext,
  input: RfpDirectAssignInput,
): Promise<RfpDirectAssignResult> {
  const { orgId, prisma, actorUserId } = ctx;
  const { rfpId, contractorId } = input;

  // ── 1. Fetch RFP + org scoping ────────────────────────────
  const rfp = await findRfpById(prisma, orgId, rfpId);
  if (!rfp) {
    throw new RfpDirectAssignError("NOT_FOUND", "RFP not found");
  }

  // ── 2. Assert RFP is OPEN ────────────────────────────────
  if (rfp.status !== RfpStatus.OPEN) {
    throw new RfpDirectAssignError(
      "RFP_NOT_OPEN",
      `Cannot directly assign on an RFP with status ${rfp.status}. Must be OPEN.`,
    );
  }

  // ── 3. Validate linked request ────────────────────────────
  if (!rfp.requestId) {
    throw new RfpDirectAssignError(
      "NO_LINKED_REQUEST",
      "This RFP has no linked maintenance request. Cannot assign contractor.",
    );
  }

  // ── 4. Validate contractor ────────────────────────────────
  const contractor = await findContractorById(prisma, contractorId, orgId);
  if (!contractor) {
    throw new RfpDirectAssignError(
      "CONTRACTOR_NOT_FOUND",
      "Contractor not found or not active in this org.",
    );
  }

  // ── 5. Close RFP (transition guard) ──────────────────────
  assertRfpTransition(rfp.status as RfpStatus, RfpStatus.CLOSED);
  await closeRfpForDirectAssign(prisma, rfpId);

  // ── 6. Assign contractor via existing workflow ────────────
  let jobCreated = false;
  try {
    const assignResult = await assignContractorWorkflow(ctx, {
      requestId: rfp.requestId,
      contractorId,
    });
    jobCreated = assignResult.jobCreated;
  } catch (e: any) {
    // Assignment failed — log but don't undo the RFP close
    // (the manager can re-open or create a new RFP)
    console.error(`[rfpDirectAssign] Contractor assignment failed:`, e?.message);
    throw new RfpDirectAssignError(
      "ASSIGNMENT_FAILED",
      `RFP closed but contractor assignment failed: ${e?.message}`,
    );
  }

  // ── 7. Emit domain event ──────────────────────────────────
  await emit({
    type: "RFP_DIRECT_ASSIGNED",
    orgId,
    actorUserId: actorUserId ?? null,
    payload: {
      rfpId,
      requestId: rfp.requestId,
      contractorId,
      jobCreated,
    },
  }).catch((err) => console.error("[EVENT] Failed to emit RFP_DIRECT_ASSIGNED", err));

  // ── 8. Notify assigned contractor ─────────────────────────
  const contractorUsers = await prisma.user.findMany({
    where: { orgId, role: "CONTRACTOR" },
    select: { id: true },
  });

  for (const u of contractorUsers) {
    await createNotification({
      orgId,
      userId: u.id,
      buildingId: rfp.buildingId,
      entityType: "RFP",
      entityId: rfpId,
      eventType: "CONTRACTOR_ASSIGNED",
      message: `You have been directly assigned to a ${rfp.category} maintenance request.`,
    });
  }

  // ── 9. Return result ──────────────────────────────────────
  return {
    rfpId,
    requestId: rfp.requestId,
    contractorId,
    jobCreated,
    rfpStatus: "CLOSED",
  };
}
