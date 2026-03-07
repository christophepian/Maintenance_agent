/**
 * evaluateLegalRoutingWorkflow
 *
 * Canonical entry point for evaluating legal obligations for a
 * maintenance request and optionally auto-creating an RFP.
 *
 * Used by:
 *   - GET /requests/:id/legal-decision
 *   - Inline during createRequestWorkflow (via direct service call)
 *
 * Orchestrates:
 *   1. Call legalDecisionEngine.evaluateRequestLegalDecision
 *   2. If OBLIGATED → auto-create RFP (idempotent)
 *   3. Return the decision DTO
 */

import { LegalObligation } from "@prisma/client";
import { WorkflowContext } from "./context";
import {
  evaluateRequestLegalDecision,
  type LegalDecisionDTO,
} from "../services/legalDecisionEngine";
import { createRfpForRequest } from "../services/rfps";

// ─── Input / Output ────────────────────────────────────────────

export interface EvaluateLegalRoutingInput {
  requestId: string;
}

export interface EvaluateLegalRoutingResult {
  decision: LegalDecisionDTO;
}

// ─── Workflow ──────────────────────────────────────────────────

export async function evaluateLegalRoutingWorkflow(
  ctx: WorkflowContext,
  input: EvaluateLegalRoutingInput,
): Promise<EvaluateLegalRoutingResult> {
  const { orgId } = ctx;
  const { requestId } = input;

  // ── 1. Evaluate legal decision ─────────────────────────────
  const decision = await evaluateRequestLegalDecision(orgId, requestId);

  // ── 2. Auto-create RFP if OBLIGATED ────────────────────────
  if (decision.legalObligation === LegalObligation.OBLIGATED) {
    try {
      const rfp = await createRfpForRequest(orgId, requestId, {
        legalObligation: decision.legalObligation,
        legalTopic: decision.legalTopic,
      });
      decision.rfpId = rfp.id;
    } catch (rfpErr: any) {
      console.warn("[legal-decision] RFP creation failed:", rfpErr.message);
    }
  }

  return { decision };
}
