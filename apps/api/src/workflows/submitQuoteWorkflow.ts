/**
 * submitQuoteWorkflow
 *
 * Canonical entry point for a contractor submitting a quote on an RFP.
 *
 * Rules enforced:
 *   1. Contractor must exist and belong to the same org as the RFP.
 *   2. RFP must be OPEN.
 *   3. Contractor must have visibility (category match or invite).
 *   4. One quote per contractor per RFP (@@unique enforced at DB level,
 *      but we check first for a friendly error).
 *   5. Quote is immutable once submitted (no update endpoint).
 *
 * Side effects:
 *   - Emits QUOTE_SUBMITTED domain event
 *   - Creates notification for managers
 */

import { WorkflowContext } from "./context";
import { emit } from "../events/bus";
import {
  findRfpById,
  findQuoteByContractorAndRfp,
  createQuoteForRfp,
} from "../repositories/rfpRepository";
import {
  findContractorById,
  parseServiceCategories,
} from "../repositories/contractorRepository";
import { createNotification } from "../services/notifications";
import type { SubmitQuoteInput } from "../validation/quoteSchema";

// ─── Input / Output ────────────────────────────────────────────

export interface SubmitQuoteWorkflowInput {
  rfpId: string;
  contractorId: string;
  quoteData: SubmitQuoteInput;
}

export interface SubmitQuoteWorkflowResult {
  quote: {
    id: string;
    rfpId: string;
    contractorId: string;
    amountCents: number;
    currency: string;
    vatIncluded: boolean;
    estimatedDurationDays: number | null;
    earliestAvailability: string | null;
    lineItems: any;
    workPlan: string | null;
    assumptions: string | null;
    validUntil: string | null;
    notes: string | null;
    submittedAt: string;
    contractor?: { id: string; name: string };
  };
}

// ─── Errors ────────────────────────────────────────────────────

export class QuoteSubmissionError extends Error {
  public code: string;
  constructor(code: string, message: string) {
    super(message);
    this.name = "QuoteSubmissionError";
    this.code = code;
  }
}

// ─── Workflow ──────────────────────────────────────────────────

export async function submitQuoteWorkflow(
  ctx: WorkflowContext,
  input: SubmitQuoteWorkflowInput,
): Promise<SubmitQuoteWorkflowResult> {
  const { orgId, prisma, actorUserId } = ctx;
  const { rfpId, contractorId, quoteData } = input;

  // ── 1. Verify contractor exists + org scoping ──────────────
  const contractor = await findContractorById(prisma, contractorId, orgId);
  if (!contractor) {
    throw new QuoteSubmissionError("NOT_FOUND", "Contractor not found in this org");
  }

  // ── 2. Fetch RFP + verify org scoping ─────────────────────
  const rfp = await findRfpById(prisma, orgId, rfpId);
  if (!rfp) {
    throw new QuoteSubmissionError("NOT_FOUND", "RFP not found");
  }

  // ── 3. RFP must be OPEN ───────────────────────────────────
  if (rfp.status !== "OPEN") {
    throw new QuoteSubmissionError(
      "RFP_NOT_OPEN",
      `RFP is ${rfp.status}, not accepting quotes`,
    );
  }

  // ── 4. Contractor must have visibility ────────────────────
  const categories = parseServiceCategories(contractor);
  const isInvited = (rfp.invites ?? []).some(
    (i) => i.contractorId === contractorId,
  );
  const categoryMatch = categories.includes(rfp.category);
  if (!isInvited && !categoryMatch) {
    throw new QuoteSubmissionError(
      "NOT_VISIBLE",
      "Contractor does not have access to this RFP",
    );
  }

  // ── 5. One quote per contractor (friendly check) ──────────
  const existing = await findQuoteByContractorAndRfp(prisma, rfpId, contractorId);
  if (existing) {
    throw new QuoteSubmissionError(
      "DUPLICATE_QUOTE",
      "You have already submitted a quote for this RFP",
    );
  }

  // ── 6. Persist via repository ─────────────────────────────
  const quote = await createQuoteForRfp(prisma, {
    rfpId,
    contractorId,
    amountCents: quoteData.amountCents,
    currency: quoteData.currency,
    vatIncluded: quoteData.vatIncluded,
    estimatedDurationDays: quoteData.estimatedDurationDays ?? null,
    earliestAvailability: quoteData.earliestAvailability
      ? new Date(quoteData.earliestAvailability)
      : null,
    lineItems: quoteData.lineItems ?? null,
    workPlan: quoteData.workPlan,
    assumptions: quoteData.assumptions ?? null,
    validUntil: quoteData.validUntil
      ? new Date(quoteData.validUntil)
      : null,
    notes: quoteData.notes ?? null,
  });

  // ── 7. Emit domain event ──────────────────────────────────
  await emit({
    type: "QUOTE_SUBMITTED",
    orgId,
    actorUserId: actorUserId ?? null,
    payload: {
      rfpId,
      quoteId: quote.id,
      contractorId,
      amountCents: quoteData.amountCents,
    },
  });

  // ── 8. Notify managers ────────────────────────────────────
  //    Find all MANAGER users in this org and create a notification.
  const managers = await prisma.user.findMany({
    where: { orgId, role: "MANAGER" },
    select: { id: true },
  });

  for (const mgr of managers) {
    await createNotification({
      orgId,
      userId: mgr.id,
      buildingId: rfp.buildingId,
      entityType: "RFP",
      entityId: rfpId,
      eventType: "QUOTE_SUBMITTED",
      message: `New quote received from ${contractor.name}: CHF ${(quoteData.amountCents / 100).toFixed(2)}`,
    });
  }

  // ── 9. Return DTO ─────────────────────────────────────────
  return {
    quote: {
      id: quote.id,
      rfpId: quote.rfpId,
      contractorId: quote.contractorId,
      amountCents: quote.amountCents,
      currency: quote.currency,
      vatIncluded: quote.vatIncluded,
      estimatedDurationDays: quote.estimatedDurationDays ?? null,
      earliestAvailability: quote.earliestAvailability?.toISOString() ?? null,
      lineItems: quote.lineItems ?? null,
      workPlan: quote.workPlan ?? null,
      assumptions: quote.assumptions ?? null,
      validUntil: quote.validUntil?.toISOString() ?? null,
      notes: quote.notes ?? null,
      submittedAt: quote.submittedAt.toISOString(),
      contractor: quote.contractor ?? undefined,
    },
  };
}
