/**
 * recommendation routes
 *
 * Thin HTTP handlers for decision-option and recommendation endpoints.
 *
 * Endpoints:
 *   POST   /decision-options                      — create decision options for a request
 *   GET    /decision-options/:opportunityId        — list options for a request
 *   POST   /recommendations/evaluate               — evaluate & rank options
 *   GET    /recommendations/:opportunityId          — get recommendations for a request
 *   PATCH  /recommendations/:resultId/decision      — record user decision
 */

import { Router } from "../http/router";
import { sendJson, sendError } from "../http/json";
import { readJson } from "../http/body";
import { requireRole, maybeRequireManager } from "../authz";
import {
  createDecisionOptions,
  getDecisionOptionsByOpportunity,
} from "../repositories/decisionOptionRepository";
import {
  getRecommendationsByOpportunity,
} from "../repositories/recommendationRepository";
import {
  evaluateRecommendationWorkflow,
  recordUserDecisionWorkflow,
} from "../workflows/recommendationWorkflow";

export function registerRecommendationRoutes(router: Router) {
  // ── POST /decision-options ───────────────────────────────────
  router.post("/decision-options", async ({ req, res, orgId, prisma }) => {
    const user = requireRole(req, res, "MANAGER");
    if (!user) return;

    const body = await readJson(req);
    if (!body || !Array.isArray(body.options) || body.options.length === 0) {
      sendError(res, 400, "BAD_REQUEST", "Missing options array");
      return;
    }

    try {
      const options = body.options.map((o: any) => ({
        orgId,
        opportunityId: o.opportunityId,
        optionType: o.optionType,
        title: o.title || o.optionType,
        description: o.description || "",
        estimatedCost: o.estimatedCost ?? 0,
        estimatedUsefulLifeYears: o.estimatedUsefulLifeYears ?? 0,
        implementationMonths: o.implementationMonths ?? 0,
        tenantDisruptionScore: o.tenantDisruptionScore ?? 0,
        riskReductionScore: o.riskReductionScore ?? 0,
        complianceCoverageScore: o.complianceCoverageScore ?? 0,
        saleAttractivenessScore: o.saleAttractivenessScore ?? 0,
        rentUpliftScore: o.rentUpliftScore ?? 0,
        opexReductionScore: o.opexReductionScore ?? 0,
        lifecycleExtensionScore: o.lifecycleExtensionScore ?? 0,
        modernizationImpactScore: o.modernizationImpactScore ?? 0,
        totalValueCreationScore: o.totalValueCreationScore ?? 0,
        uncertaintyScore: o.uncertaintyScore ?? 0,
        taxProfileJson: o.taxProfileJson ? JSON.stringify(o.taxProfileJson) : null,
        financialProjectionJson: o.financialProjectionJson
          ? JSON.stringify(o.financialProjectionJson)
          : null,
      }));

      const created = await createDecisionOptions(prisma, options);
      sendJson(res, 201, { options: created });
    } catch (err: any) {
      sendError(res, 400, "BAD_REQUEST", err.message);
    }
  });

  // ── GET /decision-options/:opportunityId ─────────────────────
  router.get("/decision-options/:opportunityId", async ({ req, res, orgId, prisma, params }) => {
    if (!maybeRequireManager(req, res)) return;

    const options = await getDecisionOptionsByOpportunity(
      prisma,
      params.opportunityId,
      orgId,
    );
    sendJson(res, 200, { options });
  });

  // ── POST /recommendations/evaluate ───────────────────────────
  router.post("/recommendations/evaluate", async ({ req, res, orgId, prisma }) => {
    const user = requireRole(req, res, "MANAGER");
    if (!user) return;

    const body = await readJson(req);
    if (!body || !body.opportunityId || !body.buildingProfileId || !body.primaryArchetype) {
      sendError(res, 400, "BAD_REQUEST", "Missing required fields: opportunityId, buildingProfileId, primaryArchetype");
      return;
    }

    try {
      const result = await evaluateRecommendationWorkflow(
        { orgId, prisma, actorUserId: user.userId },
        {
          opportunityId: body.opportunityId,
          buildingProfileId: body.buildingProfileId,
          primaryArchetype: body.primaryArchetype,
          secondaryArchetype: body.secondaryArchetype ?? null,
          secondaryMix: body.secondaryMix,
          opportunity: body.opportunity ?? {
            urgency: "normal",
            conditionState: "fair",
            complianceRisk: "low",
          },
          planningHorizonYears: body.planningHorizonYears,
          capexBudgetConstraint: body.capexBudgetConstraint,
          plannedSaleWithin12Months: body.plannedSaleWithin12Months,
        },
      );
      sendJson(res, 200, { recommendation: result.recommendation });
    } catch (err: any) {
      sendError(res, 400, "BAD_REQUEST", err.message);
    }
  });

  // ── GET /recommendations/:opportunityId ──────────────────────
  router.get("/recommendations/:opportunityId", async ({ req, res, orgId, prisma, params }) => {
    if (!maybeRequireManager(req, res)) return;

    const recommendations = await getRecommendationsByOpportunity(
      prisma,
      params.opportunityId,
      orgId,
    );
    sendJson(res, 200, { recommendations });
  });

  // ── PATCH /recommendations/:resultId/decision ────────────────
  router.patch("/recommendations/:resultId/decision", async ({ req, res, orgId, prisma, params }) => {
    const user = requireRole(req, res, "OWNER");
    if (!user) return;

    const body = await readJson(req);
    if (!body || !body.userDecision) {
      sendError(res, 400, "BAD_REQUEST", "Missing userDecision");
      return;
    }

    const validDecisions = ["accepted", "rejected", "deferred"];
    if (!validDecisions.includes(body.userDecision)) {
      sendError(res, 400, "BAD_REQUEST", `userDecision must be one of: ${validDecisions.join(", ")}`);
      return;
    }

    try {
      const result = await recordUserDecisionWorkflow(
        { orgId, prisma, actorUserId: user.userId },
        {
          recommendationId: params.resultId,
          userDecision: body.userDecision,
          userFeedback: body.userFeedback,
        },
      );
      sendJson(res, 200, { recommendation: result.recommendation });
    } catch (err: any) {
      sendError(res, 404, "NOT_FOUND", err.message);
    }
  });
}
