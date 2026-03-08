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
 *   0. Derive canton from request's building
 *   1. Ingest sources scoped to canton (FEDERAL + canton)
 *   2. Call legalDecisionEngine.evaluateRequestLegalDecision
 *   3. If OBLIGATED → auto-create RFP (idempotent)
 *   4. Return the decision DTO
 */

import { LegalObligation } from "@prisma/client";
import { WorkflowContext } from "./context";
import {
  evaluateRequestLegalDecision,
  type LegalDecisionDTO,
} from "../services/legalDecisionEngine";
import { createRfpForRequest } from "../services/rfps";
import { ingestAllSources } from "../services/legalIngestion";
import {
  cantonFromPostalCode,
  extractPostalCode,
} from "../services/cantonMapping";
import { REQUEST_LEGAL_DECISION_INCLUDE } from "../services/legalIncludes";

// ─── Input / Output ────────────────────────────────────────────

export interface EvaluateLegalRoutingInput {
  requestId: string;
}

export interface EvaluateLegalRoutingResult {
  decision: LegalDecisionDTO;
}

// ─── Helpers ───────────────────────────────────────────────────

/**
 * Derive canton from a request's building.
 * Reuses the same cantonMapping helpers as legalDecisionEngine
 * but does NOT write back to the building (that's the engine's job).
 */
async function deriveCantonFromRequest(
  prisma: import("@prisma/client").PrismaClient,
  requestId: string,
): Promise<string | null> {
  const request = await prisma.request.findUnique({
    where: { id: requestId },
    include: {
      unit: {
        select: {
          building: {
            select: { canton: true, address: true },
          },
        },
      },
    },
  });

  if (!request?.unit?.building) return null;

  const building = request.unit.building;

  // Use persisted canton if available
  if (building.canton) return building.canton;

  // Fall back to postal code derivation
  const postalCode = extractPostalCode(building.address);
  if (!postalCode) return null;

  return cantonFromPostalCode(postalCode);
}

// ─── Workflow ──────────────────────────────────────────────────

export async function evaluateLegalRoutingWorkflow(
  ctx: WorkflowContext,
  input: EvaluateLegalRoutingInput,
): Promise<EvaluateLegalRoutingResult> {
  const { orgId, prisma } = ctx;
  const { requestId } = input;

  // ── 0. Derive canton from request's building ───────────────
  let canton: string | null = null;
  try {
    canton = await deriveCantonFromRequest(prisma, requestId);
  } catch (err: any) {
    console.warn("[legal-routing] Could not derive canton:", err.message);
  }

  // ── 1. Ingest sources scoped to canton ─────────────────────
  try {
    if (canton) {
      await ingestAllSources(canton);
      console.log(`[legal-routing] Ingested sources for canton=${canton}`);
    } else {
      await ingestAllSources(); // all sources fallback
      console.log("[legal-routing] Ingested all sources (no canton)");
    }
  } catch (ingestionErr: any) {
    // Ingestion failure should not block evaluation
    console.warn("[legal-routing] Ingestion failed (non-blocking):", ingestionErr.message);
  }

  // ── 2. Evaluate legal decision ─────────────────────────────
  const decision = await evaluateRequestLegalDecision(orgId, requestId);

  // ── 3. Auto-create RFP if OBLIGATED ────────────────────────
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
