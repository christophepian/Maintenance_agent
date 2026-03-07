/**
 * activateLeaseWorkflow
 *
 * Canonical entry point for activating a lease (SIGNED → ACTIVE).
 * Orchestrates:
 *   1. Fetch lease + org ownership check
 *   2. Assert SIGNED → ACTIVE transition is valid
 *   3. Persist status change with activatedAt timestamp
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

export interface ActivateLeaseInput {
  leaseId: string;
}

export interface ActivateLeaseResult {
  dto: LeaseDTO;
}

// ─── Workflow ──────────────────────────────────────────────────

export async function activateLeaseWorkflow(
  ctx: WorkflowContext,
  input: ActivateLeaseInput,
): Promise<ActivateLeaseResult> {
  const { orgId, prisma } = ctx;
  const { leaseId } = input;

  // ── 1. Fetch + org check ───────────────────────────────────
  const existing = await findLeaseRaw(prisma, leaseId);
  if (!existing || existing.orgId !== orgId) {
    throw Object.assign(new Error("Lease not found"), { code: "NOT_FOUND" });
  }

  // ── 2. Transition guard ────────────────────────────────────
  assertLeaseTransition(existing.status, LeaseStatus.ACTIVE);

  // ── 3. Persist ─────────────────────────────────────────────
  const updated = await updateLease(prisma, leaseId, {
    status: LeaseStatus.ACTIVE,
    activatedAt: new Date(),
  });

  const dto = mapLeaseToDTO(updated);

  // ── 4. Emit event ──────────────────────────────────────────
  emit({
    type: "LEASE_STATUS_CHANGED",
    orgId,
    actorUserId: ctx.actorUserId,
    payload: {
      leaseId,
      fromStatus: existing.status,
      toStatus: LeaseStatus.ACTIVE,
    },
  }).catch((err) => console.error("[EVENT] Failed to emit LEASE_STATUS_CHANGED", err));

  return { dto };
}
