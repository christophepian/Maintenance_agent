/**
 * analyseClaimWorkflow
 *
 * Canonical entry point for producing a complete tenant claim analysis
 * for a maintenance request.
 *
 * Used by:
 *   - GET /requests/:id/claim-analysis
 *   - Tenant portal: GET /tenant-portal/requests/:id/claim-analysis
 *
 * Orchestrates:
 *   1. Call analyseClaimForRequest()
 *   2. Emit CLAIM_ANALYSED domain event
 *   3. Return analysis DTO
 *
 * NOTE: Ingestion (fetching external legal sources) is intentionally NOT
 * performed here. It runs once at server bootstrap and can be triggered
 * manually via POST /legal/ingest. Running it on every read request would
 * add 10–15 seconds of latency (external HTTP + ~200 DB upserts) on every
 * page load.
 *
 * Part of Legal Engine Hardening Phase C (C-2).
 */

import { WorkflowContext } from "./context";
import {
  analyseClaimForRequest,
  type TenantClaimAnalysisDTO,
} from "../services/tenantClaimAnalysis";
import { emit } from "../events/bus";

// ─── Input / Output ────────────────────────────────────────────

export interface AnalyseClaimInput {
  requestId: string;
}

export interface AnalyseClaimResult {
  analysis: TenantClaimAnalysisDTO;
}

// ─── Workflow ──────────────────────────────────────────────────

export async function analyseClaimWorkflow(
  ctx: WorkflowContext,
  input: AnalyseClaimInput,
): Promise<AnalyseClaimResult> {
  const { orgId } = ctx;
  const { requestId } = input;

  // ── 1. Run claim analysis ──────────────────────────────────
  const analysis = await analyseClaimForRequest(orgId, requestId);

  // ── 2. Emit domain event ───────────────────────────────────
  emit({
    type: "CLAIM_ANALYSED",
    orgId,
    actorUserId: ctx.actorUserId,
    payload: {
      requestId,
      legalObligation: analysis.legalObligation,
      confidence: analysis.confidence,
      matchedDefectCount: analysis.matchedDefects.length,
      totalReductionPercent: analysis.rentReduction?.totalReductionPercent ?? null,
      totalReductionChf: analysis.rentReduction?.totalReductionChf ?? null,
    },
  }).catch((err) =>
    console.error("[EVENT] Failed to emit CLAIM_ANALYSED", err),
  );

  return { analysis };
}
