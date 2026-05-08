/**
 * evaluateLegalRoutingWorkflow
 *
 * READ-ONLY evaluation of legal obligations for a maintenance request.
 * Returns the legal decision DTO without any side effects.
 *
 * All routing mutations (RFP creation, status transitions) happen in
 * createRequestWorkflow (at creation) or approveRequestWorkflow (on
 * manager approval), not here.
 *
 * Used by:
 *   - GET /requests/:id/legal-decision  (read-only endpoint)
 *   - createRequestWorkflow             (reads decision, then writes if OBLIGATED)
 *
 * NOTE: Ingestion (fetching external legal sources) is intentionally NOT
 * performed here. It runs once at server bootstrap and can be triggered
 * manually via POST /legal/ingest. Running it on every read request would
 * add 10–15 seconds of latency (external HTTP + ~200 DB upserts) on every
 * page load.
 */

import { WorkflowContext } from "./context";
import {
  evaluateRequestLegalDecision,
  type LegalDecisionDTO,
} from "../services/legalDecisionEngine";

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

  const decision = await evaluateRequestLegalDecision(orgId, requestId);

  return { decision };
}
