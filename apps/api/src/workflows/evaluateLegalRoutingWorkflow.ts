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
 * Orchestrates:
 *   0. Derive canton from request's building
 *   1. Ingest sources scoped to canton (FEDERAL + canton)
 *   2. Call legalDecisionEngine.evaluateRequestLegalDecision
 *   3. Return the decision DTO
 */

import { WorkflowContext } from "./context";
import {
  evaluateRequestLegalDecision,
  type LegalDecisionDTO,
} from "../services/legalDecisionEngine";
import { ingestAllSources } from "../services/legalIngestion";
import {
  cantonFromPostalCode,
  extractPostalCode,
} from "../services/cantonMapping";

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

  // ── 2. Evaluate legal decision (read-only) ─────────────────
  const decision = await evaluateRequestLegalDecision(orgId, requestId);

  return { decision };
}
