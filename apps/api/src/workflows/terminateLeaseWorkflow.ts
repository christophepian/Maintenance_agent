/**
 * terminateLeaseWorkflow
 *
 * Canonical entry point for terminating a lease (ACTIVE → TERMINATED).
 * Orchestrates:
 *   1. Fetch lease + org ownership check
 *   2. Assert ACTIVE → TERMINATED transition is valid
 *   3. Persist status change with termination metadata
 *   4. Emit LEASE_STATUS_CHANGED event
 *   5. Return updated lease DTO
 */

import { LeaseStatus } from "@prisma/client";
import { WorkflowContext } from "./context";
import { assertLeaseTransition } from "./transitions";
import { emit } from "../events/bus";
import { findLeaseRaw, updateLease } from "../repositories/leaseRepository";
import { mapLeaseToDTO, type LeaseDTO } from "../services/leases";

// ─── Input / Output ────────────────────────────────────────────

export interface TerminateLeaseInput {
  leaseId: string;
  reason: string;   // MUTUAL | TENANT_NOTICE | LANDLORD_NOTICE | END_OF_TERM | OTHER
  notice?: string;  // free-text notes
}

export interface TerminateLeaseResult {
  dto: LeaseDTO;
}

// ─── Workflow ──────────────────────────────────────────────────

export async function terminateLeaseWorkflow(
  ctx: WorkflowContext,
  input: TerminateLeaseInput,
): Promise<TerminateLeaseResult> {
  const { orgId, prisma } = ctx;
  const { leaseId, reason, notice } = input;

  // ── 1. Fetch + org check ───────────────────────────────────
  const existing = await findLeaseRaw(prisma, leaseId);
  if (!existing || existing.orgId !== orgId) {
    throw Object.assign(new Error("Lease not found"), { code: "NOT_FOUND" });
  }

  // ── 2. Transition guard ────────────────────────────────────
  assertLeaseTransition(existing.status, LeaseStatus.TERMINATED);

  // ── 3. Persist ─────────────────────────────────────────────
  const updated = await updateLease(prisma, leaseId, {
    status: LeaseStatus.TERMINATED,
    terminatedAt: new Date(),
    terminationReason: reason,
    terminationNotice: notice || null,
  });

  // ── 3b. Relist the unit so it re-enters the vacancy pipeline ──
  if (existing.unitId) {
    await prisma.unit.update({
      where: { id: existing.unitId },
      data: { isVacant: true },
    });
  }

  const dto = mapLeaseToDTO(updated);

  // ── 4. Emit event ──────────────────────────────────────────
  emit({
    type: "LEASE_STATUS_CHANGED",
    orgId,
    actorUserId: ctx.actorUserId,
    payload: {
      leaseId,
      fromStatus: existing.status,
      toStatus: LeaseStatus.TERMINATED,
    },
  }).catch((err) => console.error("[EVENT] Failed to emit LEASE_STATUS_CHANGED", err));

  return { dto };
}
