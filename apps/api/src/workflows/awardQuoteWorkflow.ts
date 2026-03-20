/**
 * awardQuoteWorkflow
 *
 * Canonical entry point for awarding a quote on an RFP.
 *
 * Rules enforced:
 *   1. RFP must be OPEN or PENDING_OWNER_APPROVAL.
 *   2. Quote must exist on the RFP and be SUBMITTED.
 *   3. Exactly one quote can be awarded per RFP.
 *   4. If building threshold requires owner approval and actor is MANAGER,
 *      route to PENDING_OWNER_APPROVAL instead of direct award.
 *   5. OWNER role can always award (no threshold check).
 *
 * Side effects:
 *   - Emits QUOTE_AWARDED domain event
 *   - Emits QUOTE_REJECTED for losing quotes
 *   - Creates notification for winning contractor
 *   - Creates notification for each rejected contractor
 *   - Creates notification for managers when routed to owner approval
 *
 * Orchestrates:
 *   1. Fetch RFP + org scoping
 *   2. Assert RFP is in awardable state (OPEN or PENDING_OWNER_APPROVAL)
 *   3. Fetch and validate winning quote
 *   4. Compute effective threshold via buildingConfig
 *   5. Decide: direct award or route to owner approval
 *   6. Persist: update RFP status + quote statuses
 *   7. Emit domain events
 *   8. Send notifications
 *   9. Canonical reload + DTO return
 */

import { RfpStatus, RfpQuoteStatus } from "@prisma/client";
import { RequestStatus } from "@prisma/client";
import { WorkflowContext } from "./context";
import { assertRfpTransition, assertRequestTransition, canTransitionRequest } from "./transitions";
import { emit } from "../events/bus";
import { updateRequestStatus } from "../repositories/requestRepository";
import { assignContractor } from "../services/requestAssignment";
import {
  findRfpById,
  findQuoteById,
  updateRfpForAward,
  updateQuoteStatus,
  rejectOtherQuotes,
} from "../repositories/rfpRepository";
import { computeEffectiveConfig } from "../services/buildingConfig";
import { createNotification } from "../services/notifications";
import { getOrCreateJobForRequest } from "../services/jobs";

// ─── Input / Output ────────────────────────────────────────────

export interface AwardQuoteWorkflowInput {
  rfpId: string;
  quoteId: string;
  actorRole: "MANAGER" | "OWNER";
}

export interface AwardQuoteWorkflowResult {
  rfpId: string;
  quoteId: string;
  status: "AWARDED" | "PENDING_OWNER_APPROVAL";
  awardedContractorId: string | null;
  ownerApprovalRequired: boolean;
}

// ─── Errors ────────────────────────────────────────────────────

export class AwardQuoteError extends Error {
  public code: string;
  constructor(code: string, message: string) {
    super(message);
    this.name = "AwardQuoteError";
    this.code = code;
  }
}

// ─── Workflow ──────────────────────────────────────────────────

export async function awardQuoteWorkflow(
  ctx: WorkflowContext,
  input: AwardQuoteWorkflowInput,
): Promise<AwardQuoteWorkflowResult> {
  const { orgId, prisma, actorUserId } = ctx;
  const { rfpId, quoteId, actorRole } = input;

  // ── 1. Fetch RFP + org scoping ────────────────────────────
  const rfp = await findRfpById(prisma, orgId, rfpId);
  if (!rfp) {
    throw new AwardQuoteError("NOT_FOUND", "RFP not found");
  }

  // ── 2. Assert RFP is in awardable state ───────────────────
  const rfpStatus = rfp.status as RfpStatus;
  if (rfpStatus !== RfpStatus.OPEN && rfpStatus !== RfpStatus.PENDING_OWNER_APPROVAL) {
    throw new AwardQuoteError(
      "RFP_NOT_AWARDABLE",
      `RFP is ${rfp.status}, cannot award. Must be OPEN or PENDING_OWNER_APPROVAL.`,
    );
  }

  // If PENDING_OWNER_APPROVAL, only OWNER can complete the award
  if (rfpStatus === RfpStatus.PENDING_OWNER_APPROVAL && actorRole !== "OWNER") {
    throw new AwardQuoteError(
      "OWNER_APPROVAL_REQUIRED",
      "This RFP requires owner approval. Only an OWNER can complete the award.",
    );
  }

  // ── 3. Fetch and validate winning quote ───────────────────
  const quote = await findQuoteById(prisma, quoteId, rfpId);
  if (!quote) {
    throw new AwardQuoteError("QUOTE_NOT_FOUND", "Quote not found on this RFP");
  }

  if (quote.status !== RfpQuoteStatus.SUBMITTED) {
    throw new AwardQuoteError(
      "QUOTE_NOT_SUBMITTABLE",
      `Quote is ${quote.status}, not SUBMITTED`,
    );
  }

  // ── 4. Compute effective threshold ────────────────────────
  let ownerApprovalRequired = false;

  if (actorRole === "MANAGER") {
    try {
      const config = await computeEffectiveConfig(prisma, orgId, rfp.buildingId);
      const threshold = config.effectiveRequireOwnerApprovalAbove;
      // If the quote amount (in cents) exceeds the threshold (in cents),
      // route to owner approval
      const thresholdCents = threshold * 100;
      if (quote.amountCents > thresholdCents) {
        ownerApprovalRequired = true;
      }
    } catch (e: any) {
      // If config lookup fails (no org config), allow manager to award directly
      console.warn(`[awardQuoteWorkflow] Config lookup failed for building ${rfp.buildingId}:`, e.message);
    }
  }
  // OWNER always has direct award authority — no threshold check

  // ── 5. Decide and persist ─────────────────────────────────

  if (ownerApprovalRequired) {
    // Route to owner approval: RFP → PENDING_OWNER_APPROVAL
    assertRfpTransition(rfpStatus, RfpStatus.PENDING_OWNER_APPROVAL);

    await updateRfpForAward(prisma, rfpId, {
      status: RfpStatus.PENDING_OWNER_APPROVAL,
      awardedContractorId: quote.contractorId,
      awardedQuoteId: quoteId,
    });

    // ── 6. Emit event ─────────────────────────────────────
    await emit({
      type: "QUOTE_AWARDED",
      orgId,
      actorUserId: actorUserId ?? null,
      payload: {
        rfpId,
        quoteId,
        contractorId: quote.contractorId,
        amountCents: quote.amountCents,
        awardedByRole: actorRole,
        ownerApprovalRequired: true,
      },
    }).catch((err) => console.error("[EVENT] Failed to emit QUOTE_AWARDED", err));

    // ── 7. Notify: owner approval needed ────────────────
    const owners = await prisma.user.findMany({
      where: { orgId, role: "OWNER" },
      select: { id: true },
    });

    for (const owner of owners) {
      await createNotification({
        orgId,
        userId: owner.id,
        buildingId: rfp.buildingId,
        entityType: "RFP",
        entityId: rfpId,
        eventType: "QUOTE_AWARDED",
        message: `Quote of CHF ${(quote.amountCents / 100).toFixed(2)} by ${quote.contractor?.name ?? "contractor"} requires your approval.`,
      });
    }

    return {
      rfpId,
      quoteId,
      status: "PENDING_OWNER_APPROVAL",
      awardedContractorId: quote.contractorId,
      ownerApprovalRequired: true,
    };
  }

  // ── Direct award ────────────────────────────────────────
  assertRfpTransition(rfpStatus, RfpStatus.AWARDED);

  // Update quote status to AWARDED
  await updateQuoteStatus(prisma, quoteId, RfpQuoteStatus.AWARDED);

  // Reject all other submitted quotes
  const rejectedCount = await rejectOtherQuotes(prisma, rfpId, quoteId);

  // Update RFP to AWARDED
  await updateRfpForAward(prisma, rfpId, {
    status: RfpStatus.AWARDED,
    awardedContractorId: quote.contractorId,
    awardedQuoteId: quoteId,
  });

  // ── 5b. Create Job + assign contractor to request ────────
  if (rfp.requestId) {
    await getOrCreateJobForRequest(orgId, rfp.requestId, quote.contractorId);

    // Assign contractor FK on the request
    await assignContractor(prisma, rfp.requestId, quote.contractorId);

    // Transition request → ASSIGNED (guard: only if the transition is valid)
    const request = await prisma.request.findUnique({ where: { id: rfp.requestId }, select: { status: true } });
    if (request && canTransitionRequest(request.status as RequestStatus, RequestStatus.ASSIGNED)) {
      await updateRequestStatus(prisma, rfp.requestId, RequestStatus.ASSIGNED);
    }
  }

  // ── 6. Emit events ───────────────────────────────────────
  await emit({
    type: "QUOTE_AWARDED",
    orgId,
    actorUserId: actorUserId ?? null,
    payload: {
      rfpId,
      quoteId,
      contractorId: quote.contractorId,
      amountCents: quote.amountCents,
      awardedByRole: actorRole,
      ownerApprovalRequired: false,
    },
  }).catch((err) => console.error("[EVENT] Failed to emit QUOTE_AWARDED", err));

  // Emit QUOTE_REJECTED for each losing quote
  const rejectedQuotes = await prisma.rfpQuote.findMany({
    where: { rfpId, status: RfpQuoteStatus.REJECTED },
    include: { contractor: { select: { id: true, name: true, email: true } } },
  });

  for (const rq of rejectedQuotes) {
    await emit({
      type: "QUOTE_REJECTED",
      orgId,
      actorUserId: actorUserId ?? null,
      payload: {
        rfpId,
        quoteId: rq.id,
        contractorId: rq.contractorId,
      },
    }).catch((err) => console.error("[EVENT] Failed to emit QUOTE_REJECTED", err));
  }

  // ── 7. Send notifications ────────────────────────────────

  // Notify winning contractor — find user by matching contractor email
  if (quote.contractor?.email) {
    const winnerUser = await prisma.user.findFirst({
      where: { orgId, email: quote.contractor.email, role: "CONTRACTOR" },
      select: { id: true },
    });
    if (winnerUser) {
      await createNotification({
        orgId,
        userId: winnerUser.id,
        buildingId: rfp.buildingId,
        entityType: "RFP",
        entityId: rfpId,
        eventType: "QUOTE_AWARDED",
        message: `Your quote of CHF ${(quote.amountCents / 100).toFixed(2)} has been selected!`,
      });
    } else {
      console.warn(
        `[awardQuoteWorkflow] No user found for winning contractor ${quote.contractor.name} (${quote.contractor.email})`,
      );
    }
  }

  // Notify rejected contractors — find each contractor's user by email
  for (const rq of rejectedQuotes) {
    if (rq.contractor?.email) {
      const rejectedUser = await prisma.user.findFirst({
        where: { orgId, email: rq.contractor.email, role: "CONTRACTOR" },
        select: { id: true },
      });
      if (rejectedUser) {
        await createNotification({
          orgId,
          userId: rejectedUser.id,
          buildingId: rfp.buildingId,
          entityType: "RFP",
          entityId: rfpId,
          eventType: "QUOTE_REJECTED",
          message: `The RFP for ${rfp.category} has been awarded to another contractor. Thank you for your submission.`,
        });
      } else {
        console.warn(
          `[awardQuoteWorkflow] No user found for rejected contractor ${rq.contractor.name} (${rq.contractor.email})`,
        );
      }
    }
  }

  return {
    rfpId,
    quoteId,
    status: "AWARDED",
    awardedContractorId: quote.contractorId,
    ownerApprovalRequired: false,
  };
}
