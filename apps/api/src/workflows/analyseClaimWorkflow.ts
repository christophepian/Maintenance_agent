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
 *   1. Validate request exists and belongs to org
 *   2. Ingest latest legal sources (non-blocking)
 *   3. Call analyseClaimForRequest()
 *   4. Emit CLAIM_ANALYSED domain event
 *   5. Return analysis DTO
 *
 * Part of Legal Engine Hardening Phase C (C-2).
 */

import { WorkflowContext } from "./context";
import {
  analyseClaimForRequest,
  type TenantClaimAnalysisDTO,
} from "../services/tenantClaimAnalysis";
import { ingestAllSources } from "../services/legalIngestion";
import {
  cantonFromPostalCode,
  extractPostalCode,
} from "../services/cantonMapping";
import { emit } from "../events/bus";

// ─── Input / Output ────────────────────────────────────────────

export interface AnalyseClaimInput {
  requestId: string;
}

export interface AnalyseClaimResult {
  analysis: TenantClaimAnalysisDTO;
}

// ─── Helpers ───────────────────────────────────────────────────

/**
 * Derive canton from a request's building for source ingestion scoping.
 */
async function deriveCantonForIngestion(
  prisma: import("@prisma/client").PrismaClient,
  requestId: string,
): Promise<string | null> {
  const request = await prisma.request.findUnique({
    where: { id: requestId },
    select: {
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
  if (building.canton) return building.canton;

  const postalCode = extractPostalCode(building.address);
  if (!postalCode) return null;

  return cantonFromPostalCode(postalCode);
}

// ─── Workflow ──────────────────────────────────────────────────

export async function analyseClaimWorkflow(
  ctx: WorkflowContext,
  input: AnalyseClaimInput,
): Promise<AnalyseClaimResult> {
  const { orgId, prisma } = ctx;
  const { requestId } = input;

  // ── 1. Ingest latest legal sources (non-blocking) ──────────
  let canton: string | null = null;
  try {
    canton = await deriveCantonForIngestion(prisma, requestId);
    if (canton) {
      await ingestAllSources(canton);
    } else {
      await ingestAllSources();
    }
  } catch (ingestionErr: any) {
    // Ingestion failure should not block analysis
    console.warn("[claim-analysis] Ingestion failed (non-blocking):", ingestionErr.message);
  }

  // ── 2. Run claim analysis ──────────────────────────────────
  const analysis = await analyseClaimForRequest(orgId, requestId);

  // ── 3. Emit domain event ───────────────────────────────────
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
