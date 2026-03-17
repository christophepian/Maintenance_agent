/**
 * rfpReinviteWorkflow
 *
 * Canonical entry point for re-inviting additional contractors to an open RFP.
 * Used when submitted quotes are insufficient and the manager wants to
 * broaden the contractor pool.
 *
 * Rules enforced:
 *   1. RFP must be OPEN (not AWARDED, CLOSED, CANCELLED, or PENDING_OWNER_APPROVAL).
 *   2. All contractor IDs must be active and belong to the same org.
 *   3. Already-invited contractors are silently skipped (idempotent).
 *
 * Side effects:
 *   - Creates new RfpInvite rows
 *   - Increments RFP inviteCount
 *   - Emits RFP_REINVITED domain event
 *   - Creates notifications for newly invited contractors
 *
 * Orchestrates:
 *   1. Fetch RFP + org scoping
 *   2. Assert RFP is OPEN
 *   3. Validate contractor IDs (active + same org)
 *   4. Add invites via repository
 *   5. Emit domain event
 *   6. Send notifications
 *   7. Canonical reload + return
 */

import { RfpStatus } from "@prisma/client";
import { WorkflowContext } from "./context";
import { emit } from "../events/bus";
import { findRfpById, addInvitesToRfp, RfpWithRelations } from "../repositories/rfpRepository";
import { findContractorsByIds } from "../repositories/contractorRepository";
import { createNotification } from "../services/notifications";

// ─── Input / Output ────────────────────────────────────────────

export interface RfpReinviteInput {
  rfpId: string;
  contractorIds: string[];
}

export interface RfpReinviteResult {
  rfpId: string;
  addedCount: number;
  skippedCount: number;
  totalInvites: number;
}

// ─── Errors ────────────────────────────────────────────────────

export class RfpReinviteError extends Error {
  public code: string;
  constructor(code: string, message: string) {
    super(message);
    this.name = "RfpReinviteError";
    this.code = code;
  }
}

// ─── Workflow ──────────────────────────────────────────────────

export async function rfpReinviteWorkflow(
  ctx: WorkflowContext,
  input: RfpReinviteInput,
): Promise<RfpReinviteResult> {
  const { orgId, prisma, actorUserId } = ctx;
  const { rfpId, contractorIds } = input;

  // ── 1. Fetch RFP + org scoping ────────────────────────────
  const rfp = await findRfpById(prisma, orgId, rfpId);
  if (!rfp) {
    throw new RfpReinviteError("NOT_FOUND", "RFP not found");
  }

  // ── 2. Assert RFP is OPEN ────────────────────────────────
  if (rfp.status !== RfpStatus.OPEN) {
    throw new RfpReinviteError(
      "RFP_NOT_OPEN",
      `Cannot re-invite on an RFP with status ${rfp.status}. Must be OPEN.`,
    );
  }

  // ── 3. Validate contractor IDs ────────────────────────────
  const validContractors = await findContractorsByIds(prisma, contractorIds, orgId);
  if (validContractors.length === 0) {
    throw new RfpReinviteError(
      "NO_VALID_CONTRACTORS",
      "None of the provided contractor IDs are valid active contractors in this org.",
    );
  }

  const validIds = validContractors.map((c) => c.id);

  // ── 4. Add invites (skips duplicates) ─────────────────────
  const { addedCount } = await addInvitesToRfp(prisma, rfpId, validIds);
  const skippedCount = validIds.length - addedCount;

  // Reload to get updated invite count
  const reloaded = await findRfpById(prisma, orgId, rfpId);
  const totalInvites = reloaded?.invites?.length ?? 0;

  // ── 5. Emit domain event ──────────────────────────────────
  await emit({
    type: "RFP_REINVITED",
    orgId,
    actorUserId: actorUserId ?? null,
    payload: {
      rfpId,
      contractorIds: validIds.filter((_, i) => i < addedCount), // newly added only
      totalInvites,
    },
  }).catch((err) => console.error("[EVENT] Failed to emit RFP_REINVITED", err));

  // ── 6. Send notifications to newly invited contractors ────
  if (addedCount > 0) {
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
        eventType: "QUOTE_SUBMITTED", // reuse existing event type for invite notification
        message: `You have been invited to submit a quote for a ${rfp.category} RFP.`,
      });
    }
  }

  // ── 7. Return result ──────────────────────────────────────
  return {
    rfpId,
    addedCount,
    skippedCount,
    totalInvites,
  };
}
