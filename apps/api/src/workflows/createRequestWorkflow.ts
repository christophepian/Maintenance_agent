/**
 * createRequestWorkflow
 *
 * THE canonical entry point for creating a maintenance request.
 * Orchestrates the full story:
 *   1. Validate + normalize input (already done by route via Zod)
 *   2. Resolve tenant from phone if needed
 *   3. Initial status is always PENDING_REVIEW
 *   4. Persist the request
 *   5. Emit REQUEST_CREATED event
 *   6. Legal auto-routing: if OBLIGATED → create RFP + transition to RFP_PENDING
 *      Otherwise → stays at PENDING_REVIEW (manager inbox)
 *   7. Canonical reload + DTO return
 *
 * Cost-based approval now happens at quote award time (awardQuoteWorkflow),
 * not at request creation.
 */

import { RequestStatus, ApprovalSource, LegalObligation, PrismaClient } from "@prisma/client";
import { WorkflowContext } from "./context";
import { assertRequestTransition } from "./transitions";
import { emit } from "../events/bus";
import { findRequestById, createRequest as repoCreateRequest, updateRequestStatus, updateRequestAsset } from "../repositories/requestRepository";
import { findAssetsByUnit } from "../repositories/assetRepository";
import { resolveAssetWithAI } from "../services/assetMatcher";
import { getTenantByPhone } from "../services/tenants";
import { getOrgConfig } from "../services/orgConfig";
import { createRfpForRequest } from "../services/rfps";
import { evaluateLegalRoutingWorkflow } from "./evaluateLegalRoutingWorkflow";
import { toDTO, type MaintenanceRequestDTO } from "../services/maintenanceRequests";
import { normalizePhoneToE164 } from "../utils/phoneNormalization";
import type { CreateRequestInput } from "../validation/requests";

// ─── Input / Output ────────────────────────────────────────────

export interface CreateRequestWorkflowInput {
  /** Validated Zod output. */
  input: CreateRequestInput;
  /** Extra fields that may come from the raw body. */
  contactPhone?: string | null;
  tenantId?: string | null;
  unitId?: string | null;
  assetId?: string | null;
}

export interface CreateRequestWorkflowResult {
  dto: MaintenanceRequestDTO;
  /** True if the request was auto-routed to RFP via legal engine. */
  legalAutoRouted: boolean;
}

// ─── Workflow ──────────────────────────────────────────────────

export async function createRequestWorkflow(
  ctx: WorkflowContext,
  wfInput: CreateRequestWorkflowInput,
): Promise<CreateRequestWorkflowResult> {
  const { orgId, prisma } = ctx;
  const { input } = wfInput;

  const description = input.description;
  const category = input.category ?? null;
  const hasEstimatedCost = typeof input.estimatedCost === "number";
  const estimatedCost = hasEstimatedCost ? input.estimatedCost! : null;
  const urgency = input.urgency ?? null;

  // ── 1. Resolve contact phone / tenant ──────────────────────
  let contactPhone: string | null = null;
  if (wfInput.contactPhone) {
    const normalized = normalizePhoneToE164(wfInput.contactPhone);
    if (!normalized) throw Object.assign(new Error("Invalid contactPhone format"), { code: "VALIDATION_ERROR" });
    contactPhone = normalized;
  }

  let tenantId = wfInput.tenantId ?? null;
  let unitId = wfInput.unitId ?? null;
  const assetId = wfInput.assetId ?? null;

  if (contactPhone && !tenantId) {
    const tenant = await getTenantByPhone({ phone: contactPhone, orgId });
    if (tenant) {
      tenantId = tenant.id;
      if (!unitId && tenant.unitId) unitId = tenant.unitId;
    }
  }

  // ── 2. Initial status is always PENDING_REVIEW ─────────────
  // Cost-based approval decisions happen later at quote award time.
  const status: RequestStatus = RequestStatus.PENDING_REVIEW;

  // ── 3. Validate: unitId is required ────────────────────────
  if (!unitId) {
    throw Object.assign(
      new Error("unitId is required — requests cannot be created without a unit"),
      { code: "VALIDATION_ERROR" },
    );
  }

  // ── 4. Persist the request ─────────────────────────────────
  const created = await repoCreateRequest(prisma, {
    orgId,
    description,
    category,
    estimatedCost,
    urgency,
    status,
    contactPhone,
    tenantId,
    unitId,
    assetId,
  });

  // ── 4b. Asset auto-link (AI-powered) ────────────────────────
  // If no assetId was explicitly provided, ask Claude to identify the most
  // likely affected asset from the unit's asset list.
  // Falls back to keyword scoring if the AI call fails or is unavailable.
  if (!assetId && unitId) {
    try {
      const unitAssets = await findAssetsByUnit(prisma, orgId, unitId);
      if (unitAssets.length > 0) {
        let linkedAssetId: string | null = null;

        // ── AI path — only when 2+ assets exist (single-asset units are trivial) ──
        if (process.env.ANTHROPIC_API_KEY && unitAssets.length >= 2) {
          linkedAssetId = await resolveAssetWithAI(
            description ?? "",
            category,
            unitAssets.map((a) => ({
              id: a.id,
              name: a.name ?? null,
              topic: a.topic ?? null,
              type: a.type ?? null,
              category: a.category ?? null,
            }))
          );
        }

        // ── Keyword fallback (used when AI is unavailable or returns null) ──
        if (!linkedAssetId) {
          const descLower = (description ?? "").toLowerCase();
          const catLower  = (category ?? "").toLowerCase();
          const combined  = `${descLower} ${catLower}`;

          const AMBIGUOUS_TOKENS = new Set([
            "glass", "panel", "unit", "door", "wall", "pipe", "floor",
            "ceiling", "cabin", "cover", "frame", "seal", "base",
          ]);

          let bestAsset: string | null = null;
          let bestScore = 0;

          for (const a of unitAssets) {
            let score = 0;
            const topicLower = (a.topic ?? "").toLowerCase().replace(/_/g, " ");
            const nameLower  = (a.name ?? "").toLowerCase();
            const typeLower  = (a.type ?? "").toLowerCase();

            const topicTokens = topicLower.split(/[\s_]+/);
            for (const token of topicTokens) {
              if (token.length >= 4 && !AMBIGUOUS_TOKENS.has(token) && combined.includes(token)) score += 3;
            }
            const nameTokens = nameLower.split(/\s+/);
            for (const token of nameTokens) {
              if (token.length >= 4 && !AMBIGUOUS_TOKENS.has(token) && combined.includes(token)) score += 2;
            }
            if (combined.includes(typeLower)) score += 1;

            if (score > bestScore) { bestScore = score; bestAsset = a.id; }
          }

          if (bestAsset && bestScore >= 3) linkedAssetId = bestAsset;
        }

        if (linkedAssetId) {
          await updateRequestAsset(prisma, created.id, linkedAssetId);
          console.log(`[ASSET-LINK] Linked asset ${linkedAssetId} to request ${created.id}`);
        }
      }
    } catch (linkErr: any) {
      console.warn(`[ASSET-LINK] Auto-link failed for ${created.id} (non-blocking):`, linkErr.message);
    }
  }

  // ── 5. Emit REQUEST_CREATED event ──────────────────────────
  emit({
    type: "REQUEST_CREATED",
    orgId,
    actorUserId: ctx.actorUserId,
    payload: { requestId: created.id, category: created.category, description: created.description },
  }).catch((err) => console.error("[EVENT] Failed to emit REQUEST_CREATED", err));

  // ── 6. Legal auto-routing (OBLIGATED → RFP_PENDING) ────────
  // Only 100% certain legal obligations go directly to RFP.
  // Everything else stays at PENDING_REVIEW for manager triage.
  let legalAutoRouted = false;
  if (category) {
    try {
      const orgConfig = await getOrgConfig(prisma, orgId);

      if (orgConfig.autoLegalRouting) {
        const mapping = await prisma.legalCategoryMapping.findFirst({
          where: {
            requestCategory: category,
            isActive: true,
            OR: [{ orgId }, { orgId: null }],
          },
        });

        if (mapping) {
          // Read-only legal evaluation
          const { decision } = await evaluateLegalRoutingWorkflow(ctx, { requestId: created.id });

          if (decision.legalObligation === LegalObligation.OBLIGATED) {
            // Create RFP and transition to RFP_PENDING
            try {
              const rfp = await createRfpForRequest(orgId, created.id, {
                legalObligation: decision.legalObligation,
                legalTopic: decision.legalTopic,
              });

              assertRequestTransition(RequestStatus.PENDING_REVIEW, RequestStatus.RFP_PENDING);
              await updateRequestStatus(prisma, created.id, RequestStatus.RFP_PENDING, {
                approvalSource: ApprovalSource.LEGAL_OBLIGATION,
              });

              emit({
                type: "LEGAL_AUTO_ROUTED",
                orgId,
                actorUserId: ctx.actorUserId,
                payload: {
                  requestId: created.id,
                  obligation: decision.legalObligation,
                  rfpId: rfp.id,
                  previousStatus: "PENDING_REVIEW",
                  newStatus: "RFP_PENDING",
                },
              }).catch((err) => console.error("[EVENT] Failed to emit LEGAL_AUTO_ROUTED", err));

              legalAutoRouted = true;
              console.log(`[LEGAL] Auto-routed request ${created.id} → RFP (OBLIGATED)`);
            } catch (rfpErr: any) {
              console.warn(`[LEGAL] RFP creation failed for ${created.id}, keeping as PENDING_REVIEW:`, rfpErr.message);
            }
          } else {
            console.log(`[LEGAL] Request ${created.id}: ${decision.legalObligation} → stays PENDING_REVIEW`);
          }
        }
      }
    } catch (err) {
      console.warn(`[LEGAL] Auto-routing failed for request ${created.id}, keeping as PENDING_REVIEW:`, err);
    }
  }

  // ── 7. Canonical reload + DTO ──────────────────────────────
  const reloaded = await findRequestById(prisma, created.id);
  const dto = reloaded ? toDTO(reloaded) : toDTO(created);

  return { dto, legalAutoRouted };
}
