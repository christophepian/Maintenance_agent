/**
 * cashflowPlans routes
 *
 * All mutating endpoints require MANAGER role.
 * GET endpoints use maybeRequireManager (manager or dev-mode).
 *
 * Endpoints:
 *   GET    /cashflow-plans                          — list
 *   POST   /cashflow-plans                          — create
 *   GET    /cashflow-plans/:id                      — fetch + recompute cashflow
 *   PUT    /cashflow-plans/:id                      — update name / income growth / opening balance
 *   POST   /cashflow-plans/:id/overrides            — add timing override
 *   DELETE /cashflow-plans/:id/overrides/:oid       — remove timing override
 *   POST   /cashflow-plans/:id/submit               — DRAFT → SUBMITTED
 *   POST   /cashflow-plans/:id/approve              — SUBMITTED → APPROVED
 *   GET    /cashflow-plans/:id/rfp-candidates                               — list RFP candidates (APPROVED only)
 *   POST   /cashflow-plans/:id/rfp-candidates/:groupKey/create-rfp          — create RFP from a candidate group
 */

import { Router } from "../http/router";
import { sendError, sendJson } from "../http/json";
import { readJson } from "../http/body";
import { first } from "../http/query";
import { maybeRequireManager, requireRole, getAuthUser } from "../authz";
import { withAuthRequired } from "../http/routeProtection";
import { CashflowPlanStatus } from "@prisma/client";
import {
  listCashflowPlans,
  findCashflowPlanById,
  updateCashflowPlan,
} from "../repositories/cashflowPlanRepository";
import {
  createPlanWorkflow,
  updatePlanWorkflow,
  addOverrideWorkflow,
  removeOverrideWorkflow,
  submitPlanWorkflow,
  approvePlanWorkflow,
} from "../workflows/cashflowPlanWorkflow";
import { InvalidTransitionError } from "../workflows/transitions";
import {
  computeMonthlyCashflow,
  computeRfpCandidates,
} from "../services/cashflowPlanningService";
import { computeStrategyOverlay } from "../services/strategyAlignmentService";
import { getBuildingProfileByBuildingId } from "../repositories/strategyProfileRepository";
import {
  findRfpByCashflowGroup,
  createRfpWithInvites,
} from "../repositories/rfpRepository";
import { findBuildingIdForAsset } from "../repositories/cashflowPlanRepository";
import { findActiveByOrg as findActiveContractorsByOrg } from "../repositories/contractorRepository";
import {
  CreateCashflowPlanSchema,
  UpdateCashflowPlanSchema,
  AddOverrideSchema,
} from "../validation/cashflowPlans";

export function registerCashflowPlanRoutes(router: Router) {

  // ── GET /cashflow-plans ──────────────────────────────────────
  router.get("/cashflow-plans", withAuthRequired(async ({ req, res, orgId, prisma, query }) => {
    if (!maybeRequireManager(req, res)) return;
    try {
      const buildingId = first(query, "buildingId") ?? undefined;
      const plans = await listCashflowPlans(prisma, orgId, buildingId);
      sendJson(res, 200, { data: plans.map(serializePlan) });
    } catch (e) {
      sendError(res, 500, "DB_ERROR", "Failed to list cashflow plans", String(e));
    }
  }));

  // ── POST /cashflow-plans ─────────────────────────────────────
  router.post("/cashflow-plans", withAuthRequired(async ({ req, res, orgId, prisma }) => {
    if (!requireRole(req, res, "MANAGER")) return;
    const actorUserId = getAuthUser(req)?.userId ?? null;
    try {
      const body = await readJson(req);
      const parsed = CreateCashflowPlanSchema.safeParse(body);
      if (!parsed.success) {
        sendError(res, 400, "VALIDATION_ERROR", "Invalid request body", parsed.error.message);
        return;
      }
      const { data } = parsed;
      const { plan } = await createPlanWorkflow(
        { orgId, prisma, actorUserId },
        {
          name: data.name,
          buildingId: data.buildingId,
          incomeGrowthRatePct: data.incomeGrowthRatePct,
          openingBalanceCents:
            data.openingBalanceCents != null ? BigInt(data.openingBalanceCents) : null,
          horizonMonths: data.horizonMonths,
        },
      );
      sendJson(res, 201, { data: serializePlan(plan) });
    } catch (e) {
      sendError(res, 500, "DB_ERROR", "Failed to create cashflow plan", String(e));
    }
  }));

  // ── GET /cashflow-plans/:id ──────────────────────────────────
  router.get("/cashflow-plans/:id", withAuthRequired(async ({ req, res, orgId, prisma, params }) => {
    if (!maybeRequireManager(req, res)) return;
    try {
      const plan = await findCashflowPlanById(prisma, params.id, orgId);
      if (!plan) {
        sendError(res, 404, "NOT_FOUND", "CashflowPlan not found");
        return;
      }
      const cashflow = await computeMonthlyCashflow(prisma, plan, orgId);
      // Stamp lastComputedAt
      await updateCashflowPlan(prisma, plan.id, orgId, { lastComputedAt: new Date() });

      // Strategy overlay: if building has a strategy profile, compute alignment tags
      let strategyOverlay = null;
      if (plan.buildingId) {
        const profile = await getBuildingProfileByBuildingId(prisma, plan.buildingId, orgId);
        if (profile) {
          // Collect all unique capex items across all buckets
          const allCapexItems = new Map<string, { assetId: string; assetName: string; estimatedCostCents: number; tradeGroup: string }>();
          for (const bucket of cashflow.buckets) {
            for (const item of bucket.capexItems) {
              if (!allCapexItems.has(item.assetId)) {
                allCapexItems.set(item.assetId, {
                  assetId: item.assetId,
                  assetName: item.assetName,
                  estimatedCostCents: item.estimatedCostCents,
                  tradeGroup: item.tradeGroup,
                });
              }
            }
          }
          if (allCapexItems.size > 0) {
            strategyOverlay = computeStrategyOverlay(
              Array.from(allCapexItems.values()),
              {
                primaryArchetype: profile.primaryArchetype,
                secondaryArchetype: profile.secondaryArchetype,
              },
            );
          }
        }
      }

      sendJson(res, 200, {
        data: {
          ...serializePlan(plan),
          cashflow,
          strategyOverlay,
        },
      });
    } catch (e) {
      sendError(res, 500, "DB_ERROR", "Failed to fetch cashflow plan", String(e));
    }
  }));

  // ── PUT /cashflow-plans/:id ──────────────────────────────────
  router.put("/cashflow-plans/:id", withAuthRequired(async ({ req, res, orgId, prisma, params }) => {
    if (!requireRole(req, res, "MANAGER")) return;
    const actorUserId = getAuthUser(req)?.userId ?? null;
    try {
      const body = await readJson(req);
      const parsed = UpdateCashflowPlanSchema.safeParse(body);
      if (!parsed.success) {
        sendError(res, 400, "VALIDATION_ERROR", "Invalid request body", parsed.error.message);
        return;
      }
      const { data } = parsed;
      const { plan } = await updatePlanWorkflow(
        { orgId, prisma, actorUserId },
        {
          planId: params.id,
          name: data.name,
          incomeGrowthRatePct: data.incomeGrowthRatePct,
          openingBalanceCents:
            data.openingBalanceCents != null ? BigInt(data.openingBalanceCents) : undefined,
        },
      );
      sendJson(res, 200, { data: serializePlan(plan) });
    } catch (e: any) {
      if (e.code === "NOT_FOUND") {
        sendError(res, 404, "NOT_FOUND", "CashflowPlan not found");
      } else if (e.code === "INVALID_STATE") {
        sendError(res, 400, "INVALID_STATE", e.message);
      } else {
        sendError(res, 500, "DB_ERROR", "Failed to update cashflow plan", String(e));
      }
    }
  }));

  // ── POST /cashflow-plans/:id/overrides ───────────────────────
  router.post("/cashflow-plans/:id/overrides", withAuthRequired(async ({ req, res, orgId, prisma, params }) => {
    if (!requireRole(req, res, "MANAGER")) return;
    const actorUserId = getAuthUser(req)?.userId ?? null;
    try {
      const body = await readJson(req);
      const parsed = AddOverrideSchema.safeParse(body);
      if (!parsed.success) {
        sendError(res, 400, "VALIDATION_ERROR", "Invalid request body", parsed.error.message);
        return;
      }
      const { plan } = await addOverrideWorkflow(
        { orgId, prisma, actorUserId },
        { planId: params.id, ...parsed.data },
      );
      sendJson(res, 201, { data: serializePlan(plan) });
    } catch (e: any) {
      if (e.code === "NOT_FOUND") {
        sendError(res, 404, "NOT_FOUND", "CashflowPlan not found");
      } else if (e.code === "INVALID_STATE") {
        sendError(res, 400, "INVALID_STATE", e.message);
      } else {
        sendError(res, 500, "DB_ERROR", "Failed to add override", String(e));
      }
    }
  }));

  // ── DELETE /cashflow-plans/:id/overrides/:oid ────────────────
  router.delete("/cashflow-plans/:id/overrides/:oid", withAuthRequired(async ({ req, res, orgId, prisma, params }) => {
    if (!requireRole(req, res, "MANAGER")) return;
    const actorUserId = getAuthUser(req)?.userId ?? null;
    try {
      await removeOverrideWorkflow(
        { orgId, prisma, actorUserId },
        { planId: params.id, overrideId: params.oid },
      );
      sendJson(res, 200, { data: { deleted: true } });
    } catch (e: any) {
      if (e.code === "NOT_FOUND") {
        sendError(res, 404, "NOT_FOUND", "CashflowPlan not found");
      } else if (e.code === "INVALID_STATE") {
        sendError(res, 400, "INVALID_STATE", e.message);
      } else {
        sendError(res, 500, "DB_ERROR", "Failed to remove override", String(e));
      }
    }
  }));

  // ── POST /cashflow-plans/:id/submit ──────────────────────────
  router.post("/cashflow-plans/:id/submit", withAuthRequired(async ({ req, res, orgId, prisma, params }) => {
    if (!requireRole(req, res, "MANAGER")) return;
    const actorUserId = getAuthUser(req)?.userId ?? null;
    try {
      const { plan } = await submitPlanWorkflow(
        { orgId, prisma, actorUserId },
        { planId: params.id },
      );
      sendJson(res, 200, { data: serializePlan(plan) });
    } catch (e: any) {
      if (e.code === "NOT_FOUND") {
        sendError(res, 404, "NOT_FOUND", "CashflowPlan not found");
      } else if (e instanceof InvalidTransitionError) {
        sendError(res, 400, "INVALID_TRANSITION", e.message);
      } else {
        sendError(res, 500, "DB_ERROR", "Failed to submit cashflow plan", String(e));
      }
    }
  }));

  // ── POST /cashflow-plans/:id/approve ─────────────────────────
  router.post("/cashflow-plans/:id/approve", withAuthRequired(async ({ req, res, orgId, prisma, params }) => {
    if (!requireRole(req, res, "MANAGER")) return;
    const actorUserId = getAuthUser(req)?.userId ?? null;
    try {
      const { plan } = await approvePlanWorkflow(
        { orgId, prisma, actorUserId },
        { planId: params.id },
      );
      sendJson(res, 200, { data: serializePlan(plan) });
    } catch (e: any) {
      if (e.code === "NOT_FOUND") {
        sendError(res, 404, "NOT_FOUND", "CashflowPlan not found");
      } else if (e instanceof InvalidTransitionError) {
        sendError(res, 400, "INVALID_TRANSITION", e.message);
      } else {
        sendError(res, 500, "DB_ERROR", "Failed to approve cashflow plan", String(e));
      }
    }
  }));

  // ── GET /cashflow-plans/:id/rfp-candidates ───────────────────
  router.get("/cashflow-plans/:id/rfp-candidates", withAuthRequired(async ({ req, res, orgId, prisma, params }) => {
    if (!maybeRequireManager(req, res)) return;
    try {
      const plan = await findCashflowPlanById(prisma, params.id, orgId);
      if (!plan) {
        sendError(res, 404, "NOT_FOUND", "CashflowPlan not found");
        return;
      }
      if (plan.status !== CashflowPlanStatus.APPROVED) {
        sendError(
          res,
          400,
          "INVALID_STATE",
          "RFP candidates are only available for APPROVED plans",
        );
        return;
      }
      const candidates = await computeRfpCandidates(prisma, plan, orgId);
      sendJson(res, 200, { data: candidates });
    } catch (e) {
      sendError(res, 500, "DB_ERROR", "Failed to compute RFP candidates", String(e));
    }
  }));

  // ── POST /cashflow-plans/:id/rfp-candidates/:groupKey/create-rfp ──
  router.post(
    "/cashflow-plans/:id/rfp-candidates/:groupKey/create-rfp",
    withAuthRequired(async ({ req, res, orgId, prisma, params }) => {
      if (!requireRole(req, res, "MANAGER")) return;
      try {
        const plan = await findCashflowPlanById(prisma, params.id, orgId);
        if (!plan) {
          sendError(res, 404, "NOT_FOUND", "CashflowPlan not found");
          return;
        }
        if (plan.status !== CashflowPlanStatus.APPROVED) {
          sendError(res, 400, "INVALID_STATE", "RFP can only be created from an APPROVED plan");
          return;
        }

        const groupKey = params.groupKey;

        // Idempotency: return existing RFP if already created for this group
        const existing = await findRfpByCashflowGroup(prisma, plan.id, groupKey);
        if (existing) {
          sendJson(res, 200, { data: { rfpId: existing.id, alreadyExisted: true } });
          return;
        }

        // Resolve the candidate for this groupKey
        const candidates = await computeRfpCandidates(prisma, plan, orgId);
        const candidate = candidates.find((c) => c.groupKey === groupKey);
        if (!candidate) {
          sendError(res, 404, "NOT_FOUND", `RFP candidate group '${groupKey}' not found`);
          return;
        }

        // Determine buildingId — required for RFP
        const buildingId = plan.buildingId ?? (
          candidate.assets.length > 0
            ? await findBuildingIdForAsset(prisma, candidate.assets[0].assetId)
            : null
        );
        if (!buildingId) {
          sendError(res, 400, "INVALID_STATE", "Cannot create RFP: no building resolved for this candidate group");
          return;
        }

        // Build title and scope from candidate
        const assetSummary = candidate.assets
          .map((a) => `${a.assetName} (CHF ${(a.estimatedCostCents / 100).toLocaleString("de-CH")})`)
          .join(", ");
        const title = `${candidate.tradeGroup} — ${candidate.scheduledYear} CapEx (${candidate.assets.length} asset${candidate.assets.length !== 1 ? "s" : ""})`;
        const scopeDescription = `Assets: ${assetSummary}. Suggested send date: ${candidate.suggestedRfpSendDate}.`;

        // Find matching contractors by category
        const contractors = await findActiveContractorsByOrg(prisma, orgId);
        const matching = contractors.filter((c) => {
          try {
            const cats = JSON.parse(c.serviceCategories);
            return Array.isArray(cats) && cats.some((cat: string) =>
              cat.toLowerCase().includes(candidate.tradeGroup.toLowerCase()) ||
              candidate.tradeGroup.toLowerCase().includes(cat.toLowerCase()),
            );
          } catch {
            return false;
          }
        }).slice(0, 3);

        const rfp = await createRfpWithInvites(prisma, {
          orgId,
          buildingId,
          cashflowPlanId: plan.id,
          cashflowGroupKey: groupKey,
          category: candidate.tradeGroup,
          legalObligation: "UNKNOWN",
          status: "OPEN",
          inviteCount: matching.length || 3,
          contractorIds: matching.map((c) => c.id),
        });

        sendJson(res, 201, { data: { rfpId: rfp.id, title, scopeDescription, alreadyExisted: false } });
      } catch (e) {
        sendError(res, 500, "DB_ERROR", "Failed to create RFP from cashflow plan", String(e));
      }
    }),
  );
}

// ─── Serialization helper (BigInt → number for JSON) ──────────

function serializePlan(plan: any): any {
  return {
    ...plan,
    openingBalanceCents:
      plan.openingBalanceCents != null ? Number(plan.openingBalanceCents) : null,
  };
}
