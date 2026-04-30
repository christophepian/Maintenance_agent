/**
 * Request Routes (Refactored)
 *
 * Routes are thin wrappers: parse → auth → validate → workflow → response.
 * All orchestration logic lives in workflows/.
 */

import { RequestStatus, RequestUrgency, ApprovalSource, LegalObligation } from "@prisma/client";
import { Router, HandlerContext } from "../http/router";
import { sendError, sendJson } from "../http/json";
import { readJson } from "../http/body";
import { first, getIntParam, getEnumParam } from "../http/query";
import { getAuthUser, maybeRequireManager, requireRole, requireAnyRole, requireAuth } from "../authz";
import { withAuthRequired } from "../http/routeProtection";
import { requireOwnerAccess, logEvent } from "./helpers";
import { resolveAndScopeRequest, findRequestRaw, updateRequestUrgency, deleteAllRequests, updateRequestAsset, updateRequestStatus } from "../repositories/requestRepository";
import { findAssetById } from "../repositories/assetRepository";
import { findContractorOrgId } from "../repositories/contractorRepository";
import { UpdateRequestStatusSchema } from "../validation/requestStatus";
import { AssignContractorSchema } from "../validation/requestAssignment";
import { CreateRequestSchema } from "../validation/requests";
import {
  listMaintenanceRequests,
  getMaintenanceRequestById,
  listOwnerPendingApprovals,
  updateMaintenanceRequestStatus,
} from "../services/maintenanceRequests";
import type { MaintenanceRequestDTO } from "../services/maintenanceRequests";
import { updateContractorRequestStatus, getContractorAssignedRequests } from "../services/contractorRequests";
import { findMatchingContractor } from "../services/requestAssignment";
import { workRequestFromRequest } from "../services/adapters/workRequestAdapter";
import { listRequestEvents, createRequestEvent } from "../services/requestEventService";
import { getRepairReplaceAnalysis } from "../services/assetInventory";
import { evaluateRequestLegalDecision } from "../services/legalDecisionEngine";
import { getOwnerProfileByOwnerId } from "../repositories/strategyProfileRepository";
import { blendMaintenanceDecision } from "../services/maintenanceDecisionService";
import type { StrategyArchetype } from "../services/strategy/archetypes";
import { getRepairReplaceAnalysis } from "../services/assetInventory";
import { evaluateRequestLegalDecision } from "../services/legalDecisionEngine";
import { getOwnerProfileByOwnerId } from "../repositories/strategyProfileRepository";
import { blendMaintenanceDecision } from "../services/maintenanceDecisionService";
import type { StrategyArchetype } from "../services/strategy/archetypes";

// Workflows
import { createRequestWorkflow } from "../workflows/createRequestWorkflow";
import { approveRequestWorkflow } from "../workflows/approveRequestWorkflow";
import { assignContractorWorkflow } from "../workflows/assignContractorWorkflow";
import { unassignContractorWorkflow } from "../workflows/unassignContractorWorkflow";
import { rejectRequestWorkflow } from "../workflows/ownerRejectWorkflow";
import { InvalidTransitionError } from "../workflows/transitions";
import { evaluateLegalRoutingWorkflow } from "../workflows/evaluateLegalRoutingWorkflow";
import { createRfpForRequest } from "../services/rfps";
import { assertRequestTransition } from "../workflows/transitions";

/* ── Helper: build WorkflowContext from HandlerContext ────────── */

function wfCtx(ctx: HandlerContext) {
  const actor = getAuthUser(ctx.req);
  return {
    orgId: ctx.orgId,
    prisma: ctx.prisma,
    actorUserId: actor?.userId ?? null,
  };
}

/* ── Route registration ──────────────────────────────────────── */

export function registerRequestRoutes(router: Router) {

  /* ── Request events (unchanged — thin already) ─────────────── */

  router.get("/requests/:id/events", withAuthRequired(async ({ res, prisma, params, orgId }) => {
    const req = await resolveAndScopeRequest(prisma, params.id, orgId);
    if (!req) return sendError(res, 404, "NOT_FOUND", "Request not found");
    const events = await listRequestEvents(prisma, req.id);
    sendJson(res, 200, { data: events });
  }));

  router.post("/requests/:id/events", async ({ req, res, prisma, params, orgId }) => {
    if (!requireAnyRole(req, res, ["CONTRACTOR", "MANAGER"])) return;
    const scopedReq = await resolveAndScopeRequest(prisma, params.id, orgId);
    if (!scopedReq) return sendError(res, 404, "NOT_FOUND", "Request not found");
    const raw = await readJson(req);
    const { contractorId, type, message } = raw;
    if (!contractorId || !type || !message) {
      return sendError(res, 400, "VALIDATION_ERROR", "Missing contractorId, type, or message");
    }
    try {
      const event = await createRequestEvent(prisma, {
        requestId: scopedReq.id,
        contractorId,
        type,
        message,
      });
      sendJson(res, 201, { data: event });
    } catch (e: any) {
      if (e.code === "NOT_FOUND") return sendError(res, 404, "NOT_FOUND", e.message);
      sendError(res, 500, "DB_ERROR", "Failed to create event", String(e));
    }
  });

  /* ── Owner pending approvals (thin — just query + respond) ── */

  router.get("/owner/pending-approvals", async ({ req, res, prisma, query, orgId }) => {
    if (!requireOwnerAccess(req, res)) return;
    const buildingId = first(query, "buildingId") || undefined;
    const data = await listOwnerPendingApprovals(prisma, orgId, { buildingId });
    sendJson(res, 200, { data });
  });

  /* ── Owner approve → delegates to approveRequestWorkflow ──── */

  router.post("/requests/:id/owner-approve", async (ctx) => {
    const { req, res, prisma, params, orgId } = ctx;
    if (!requireOwnerAccess(req, res)) return;

    const scopedReq = await resolveAndScopeRequest(prisma, params.id, orgId);
    if (!scopedReq) return sendError(res, 404, "NOT_FOUND", "Request not found");

    const raw = await readJson(req);

    try {
      const result = await approveRequestWorkflow(wfCtx(ctx), {
        requestId: scopedReq.id,
        comment: raw?.comment || null,
        approvalType: "owner",
      });
      sendJson(res, 200, { data: result.dto });
    } catch (e: any) {
      if (e instanceof InvalidTransitionError) {
        return sendError(res, 409, "INVALID_TRANSITION", e.message);
      }
      if (e.code === "NOT_FOUND") return sendError(res, 404, "NOT_FOUND", e.message);
      throw e;
    }
  });

  /* ── Owner reject → delegates to rejectRequestWorkflow ────── */

  router.post("/requests/:id/owner-reject", async (ctx) => {
    const { req, res, prisma, params, orgId } = ctx;
    if (!requireOwnerAccess(req, res)) return;
    const scopedReq = await resolveAndScopeRequest(prisma, params.id, orgId);
    if (!scopedReq) return sendError(res, 404, "NOT_FOUND", "Request not found");
    const raw = await readJson(req);

    try {
      const result = await rejectRequestWorkflow(wfCtx(ctx), {
        requestId: scopedReq.id,
        reason: raw?.reason || null,
      });
      sendJson(res, 200, { data: result.dto });
    } catch (e: any) {
      if (e instanceof InvalidTransitionError || e.code === "INVALID_TRANSITION") {
        return sendError(res, 409, "INVALID_TRANSITION", e.message);
      }
      if (e.code === "NOT_FOUND") return sendError(res, 404, "NOT_FOUND", e.message);
      throw e;
    }
  });

  /* ── Manager reject → delegates to rejectRequestWorkflow ─── */

  router.post("/requests/:id/manager-reject", async (ctx) => {
    const { req, res, prisma, params, orgId } = ctx;
    if (!requireRole(req, res, "MANAGER")) return;
    const scopedReq = await resolveAndScopeRequest(prisma, params.id, orgId);
    if (!scopedReq) return sendError(res, 404, "NOT_FOUND", "Request not found");
    const raw = await readJson(req);

    try {
      const result = await rejectRequestWorkflow(wfCtx(ctx), {
        requestId: scopedReq.id,
        reason: raw?.reason || null,
      });
      sendJson(res, 200, { data: result.dto });
    } catch (e: any) {
      if (e instanceof InvalidTransitionError || e.code === "INVALID_TRANSITION") {
        return sendError(res, 409, "INVALID_TRANSITION", e.message);
      }
      if (e.code === "NOT_FOUND") return sendError(res, 404, "NOT_FOUND", e.message);
      throw e;
    }
  });

  /* ── Status update ─────────────────────────────────────────── */

  router.patch("/requests/:id/status", async (ctx) => {
    const { req, res, prisma, query, params, orgId } = ctx;

    const scopedReq = await resolveAndScopeRequest(prisma, params.id, orgId);
    if (!scopedReq) return sendError(res, 404, "NOT_FOUND", "Request not found");

    const raw = await readJson(req);
    const parsed = UpdateRequestStatusSchema.safeParse(raw);
    if (!parsed.success) return sendError(res, 400, "VALIDATION_ERROR", "Invalid status update", parsed.error.flatten());

    const input = parsed.data;
    const contractorId = first(query, "contractorId") || null;

    // Contractor-scoped status update (unchanged — different flow)
    if (contractorId) {
      if (!requireRole(req, res, "CONTRACTOR")) return;
      const result = await updateContractorRequestStatus(
        prisma, scopedReq.id, contractorId,
        RequestStatus[input.status as keyof typeof RequestStatus],
      );
      if (!result.success) return sendError(res, 400, "UPDATE_FAILED", result.message);
      return sendJson(res, 200, { data: result.data, message: result.message });
    }

    // Manager approval → delegate to workflow
    if (!requireRole(req, res, "MANAGER")) return;

    try {
      const result = await approveRequestWorkflow(wfCtx(ctx), {
        requestId: scopedReq.id,
        approvalType: "manager",
      });
      sendJson(res, 200, { data: result.dto });
    } catch (e: any) {
      if (e instanceof InvalidTransitionError) {
        return sendError(res, 409, "INVALID_TRANSITION", e.message);
      }
      if (e.code === "NOT_FOUND") return sendError(res, 404, "NOT_FOUND", e.message);
      throw e;
    }
  });

  /* ── Urgency update ────────────────────────────────────────── */

  router.patch("/requests/:id/urgency", async (ctx) => {
    const { req, res, prisma, params, orgId } = ctx;
    if (!requireRole(req, res, "MANAGER")) return;

    const scopedReq = await resolveAndScopeRequest(prisma, params.id, orgId);
    if (!scopedReq) return sendError(res, 404, "NOT_FOUND", "Request not found");

    const raw = await readJson(req);
    const urgency = raw?.urgency as string;
    if (!urgency || !Object.values(RequestUrgency).includes(urgency as RequestUrgency)) {
      return sendError(res, 400, "VALIDATION_ERROR", `urgency must be one of: ${Object.values(RequestUrgency).join(", ")}`);
    }

    const updated = await updateRequestUrgency(prisma, scopedReq.id, urgency as RequestUrgency);
    sendJson(res, 200, { data: updated });
  });

  /* ── PATCH /requests/:id/asset — link/unlink asset ─────────── */

  router.patch("/requests/:id/asset", async (ctx) => {
    const { req, res, prisma, params, orgId } = ctx;
    if (!requireRole(req, res, "MANAGER")) return;

    const scopedReq = await resolveAndScopeRequest(prisma, params.id, orgId);
    if (!scopedReq) return sendError(res, 404, "NOT_FOUND", "Request not found");

    const raw = await readJson(req);
    // assetId can be a string (link) or null (unlink)
    const assetId: string | null = raw?.assetId ?? null;

    if (assetId !== null && typeof assetId !== "string") {
      return sendError(res, 400, "VALIDATION_ERROR", "assetId must be a string or null");
    }

    // Verify asset belongs to same org (if linking)
    if (assetId) {
      const asset = await findAssetById(prisma, orgId, assetId);
      if (!asset) return sendError(res, 404, "NOT_FOUND", "Asset not found");
    }

    const updated = await updateRequestAsset(prisma, scopedReq.id, assetId);
    sendJson(res, 200, { data: updated });
  });

  /* ── Manual legal route-to-RFP (for OBLIGATED requests not auto-routed) ── */

  router.post("/requests/:id/route-to-rfp", async (ctx) => {
    const { req, res, prisma, params, orgId } = ctx;
    if (!requireRole(req, res, "MANAGER")) return;

    const scopedReq = await resolveAndScopeRequest(prisma, params.id, orgId);
    if (!scopedReq) return sendError(res, 404, "NOT_FOUND", "Request not found");

    const reqFields = await prisma.request.findUnique({
      where: { id: scopedReq.id },
      select: { status: true },
    });
    if (!reqFields) return sendError(res, 404, "NOT_FOUND", "Request not found");

    if (reqFields.status !== RequestStatus.PENDING_REVIEW) {
      return sendError(res, 409, "INVALID_STATE",
        `Request is ${reqFields.status} — only PENDING_REVIEW requests can be manually routed to RFP`);
    }

    const existingRfp = await prisma.rfp.findFirst({
      where: { requestId: scopedReq.id },
      select: { id: true },
    });
    if (existingRfp) {
      return sendError(res, 409, "ALREADY_ROUTED", "Request already has an RFP");
    }

    try {
      // Re-evaluate legal engine
      const { decision } = await evaluateLegalRoutingWorkflow(wfCtx(ctx), { requestId: scopedReq.id });

      if (decision.legalObligation !== LegalObligation.OBLIGATED) {
        return sendError(res, 422, "NOT_OBLIGATED",
          `Legal engine returned ${decision.legalObligation} — cannot route to RFP`);
      }

      const rfp = await createRfpForRequest(orgId, scopedReq.id, {
        legalObligation: decision.legalObligation,
        legalTopic: decision.legalTopic,
      });

      assertRequestTransition(RequestStatus.PENDING_REVIEW, RequestStatus.RFP_PENDING);
      await updateRequestStatus(prisma, scopedReq.id, RequestStatus.RFP_PENDING, {
        approvalSource: ApprovalSource.LEGAL_OBLIGATION,
      });

      sendJson(res, 200, { data: { rfpId: rfp.id, status: "RFP_PENDING" } });
    } catch (err: any) {
      if (err instanceof InvalidTransitionError) {
        return sendError(res, 409, "INVALID_TRANSITION", err.message);
      }
      console.error("[route-to-rfp]", err);
      sendError(res, 500, "INTERNAL_ERROR", "Failed to route request to RFP");
    }
  });

  router.delete("/__dev/requests", async ({ req, res, prisma }) => {
    if (process.env.NODE_ENV === "production") return sendError(res, 403, "FORBIDDEN", "Not allowed in production");
    // SA-14: Even in dev/staging, require MANAGER auth
    if (!requireRole(req, res, "MANAGER")) return;
    const result = await deleteAllRequests(prisma);
    sendJson(res, 200, { data: { deleted: result.count } });
  });

  /* ── Assignment → delegates to assignContractorWorkflow ────── */

  router.post("/requests/:id/assign", async (ctx) => {
    const { req, res, prisma, params, orgId } = ctx;
    if (!requireRole(req, res, "MANAGER")) return;

    const scopedReq = await resolveAndScopeRequest(prisma, params.id, orgId);
    if (!scopedReq) return sendError(res, 404, "NOT_FOUND", "Request not found");

    const raw = await readJson(req);
    const parsed = AssignContractorSchema.safeParse(raw);
    if (!parsed.success) return sendError(res, 400, "VALIDATION_ERROR", "Invalid assignment data", parsed.error.flatten());

    try {
      const result = await assignContractorWorkflow(wfCtx(ctx), {
        requestId: scopedReq.id,
        contractorId: parsed.data.contractorId,
      });
      sendJson(res, 200, { data: result.dto, message: result.message });
    } catch (e: any) {
      if (e.code === "ASSIGNMENT_FAILED") return sendError(res, 400, "ASSIGNMENT_FAILED", e.message);
      if (e.code === "NOT_FOUND") return sendError(res, 404, "NOT_FOUND", e.message);
      throw e;
    }
  });

  /* ── Unassign → delegates to unassignContractorWorkflow ────── */

  router.delete("/requests/:id/assign", async (ctx) => {
    const { req, res, prisma, params, orgId } = ctx;
    if (!requireRole(req, res, "MANAGER")) return;

    const scopedReq = await resolveAndScopeRequest(prisma, params.id, orgId);
    if (!scopedReq) return sendError(res, 404, "NOT_FOUND", "Request not found");

    try {
      const result = await unassignContractorWorkflow(wfCtx(ctx), {
        requestId: scopedReq.id,
      });
      sendJson(res, 200, { data: result.dto, message: result.message });
    } catch (e: any) {
      if (e instanceof InvalidTransitionError) return sendError(res, 409, "INVALID_TRANSITION", e.message);
      if (e.code === "NOT_FOUND") return sendError(res, 404, "NOT_FOUND", e.message);
      throw e;
    }
  });

  /* ── Suggest contractor (thin — pure query) ────────────────── */

  router.get("/requests/:id/maintenance-decision", async ({ req, res, prisma, params, orgId }) => {
    if (!maybeRequireManager(req, res)) return;

    const scopedReq = await resolveAndScopeRequest(prisma, params.id, orgId);
    if (!scopedReq) return sendError(res, 404, "NOT_FOUND", "Request not found");

    // Load full request with unit → building → owners chain
    const reqRow = await prisma.request.findUnique({
      where: { id: scopedReq.id },
      select: {
        urgency: true,
        estimatedCost: true,
        unit: {
          select: {
            id: true,
            building: {
              select: {
                id: true,
                canton: true,
                address: true,
                owners: { select: { user: { select: { id: true, name: true } } } },
              },
            },
          },
        },
      },
    });
    if (!reqRow) return sendError(res, 404, "NOT_FOUND", "Request not found");

    const unitId   = reqRow.unit?.id ?? null;
    const canton   = reqRow.unit?.building?.canton ?? null;
    const owners   = (reqRow.unit?.building?.owners ?? []).map((o) => o.user);

    // ── 1. Repair-replace signal (non-blocking) ──────────────
    let repairReplaceSignal = null;
    if (unitId) {
      try {
        const items = await getRepairReplaceAnalysis(prisma, orgId, unitId, canton);
        // Pick the most alarming item (highest tier) as the signal
        const tierRank: Record<string, number> = {
          REPLACE: 3, PLAN_REPLACEMENT: 2, MONITOR: 1, REPAIR: 0,
        };
        const sorted = [...items].sort(
          (a, b) => (tierRank[b.recommendation] ?? 0) - (tierRank[a.recommendation] ?? 0),
        );
        if (sorted.length > 0) {
          const top = sorted[0];
          repairReplaceSignal = {
            recommendation:              top.recommendation as any,
            depreciationPct:             top.depreciationPct ?? null,
            repairToReplacementRatio:    top.repairToReplacementRatio ?? null,
            remainingLifeMonths:         top.remainingLifeMonths ?? null,
            breakEvenMonths:             top.breakEvenMonths ?? null,
            cumulativeRepairCostChf:     top.cumulativeRepairCostChf,
            estimatedReplacementCostChf: top.estimatedReplacementCostChf ?? null,
            applianceName:               top.applianceName ?? null,
          };
        }
      } catch (e) {
        console.warn("[maintenance-decision] repair-replace analysis failed (non-blocking):", e);
      }
    }

    // ── 2. Legal obligation (non-blocking, no ingestion re-run) ─
    let legalObligation: "OBLIGATED" | "DISCRETIONARY" | "NOT_APPLICABLE" | null = null;
    try {
      const decision = await evaluateRequestLegalDecision(orgId, scopedReq.id);
      legalObligation = decision.legalObligation as typeof legalObligation;
    } catch (e) {
      console.warn("[maintenance-decision] legal decision failed (non-blocking):", e);
    }

    // ── 3. Owner strategy profiles (non-blocking) ────────────
    let ownerArchetype: StrategyArchetype | null = null;
    let ownerSecondaryArchetype: StrategyArchetype | null = null;
    let ownerDimensions = null;
    if (owners.length > 0) {
      try {
        // Use the first owner's profile (primary building owner)
        const profile = await getOwnerProfileByOwnerId(prisma, owners[0].id, orgId ?? "");
        if (profile) {
          ownerArchetype           = profile.primaryArchetype as StrategyArchetype;
          ownerSecondaryArchetype  = (profile.secondaryArchetype ?? null) as StrategyArchetype | null;
          const dims               = JSON.parse(profile.dimensionsJson);
          ownerDimensions = {
            capexTolerance:          dims.capexTolerance          ?? 50,
            horizon:                 dims.horizon                 ?? 50,
            modernizationPreference: dims.modernizationPreference ?? 50,
            liquiditySensitivity:    dims.liquiditySensitivity    ?? 50,
            saleReadiness:           dims.saleReadiness           ?? 50,
            stabilityPreference:     dims.stabilityPreference     ?? 50,
          };
        }
      } catch (e) {
        console.warn("[maintenance-decision] owner profile failed (non-blocking):", e);
      }
    }

    // ── 4. Blend ─────────────────────────────────────────────
    const result = blendMaintenanceDecision({
      repairReplace:          repairReplaceSignal,
      legalObligation,
      urgency:                reqRow.urgency ?? "MEDIUM",
      estimatedCostChf:       reqRow.estimatedCost ?? null,
      ownerArchetype,
      ownerSecondaryArchetype,
      ownerDimensions,
    });

    sendJson(res, 200, { data: result });
  });

  router.get("/requests/:id/suggest-contractor", async ({ req, res, prisma, params, orgId }) => {
    // SA-13: Auth required for contractor suggestion
    if (!maybeRequireManager(req, res)) return;
    const scopedReq = await resolveAndScopeRequest(prisma, params.id, orgId);
    if (!scopedReq) return sendError(res, 404, "NOT_FOUND", "Request not found");
    const reqRow = await findRequestRaw(prisma, scopedReq.id);
    if (!reqRow) return sendError(res, 404, "NOT_FOUND", "Request not found");
    if (!reqRow.category) return sendJson(res, 200, { data: null });
    const contractor = await findMatchingContractor(prisma, orgId, reqRow.category);
    sendJson(res, 200, { data: contractor });
  });

  router.get("/contractors/match", async ({ req, res, prisma, query, orgId }) => {
    // SA-13: Auth required for contractor matching
    if (!maybeRequireManager(req, res)) return;
    const category = first(query, "category");
    if (!category) return sendError(res, 400, "VALIDATION_ERROR", "Category required");
    const contractor = await findMatchingContractor(prisma, orgId, category);
    sendJson(res, 200, { data: contractor });
  });

  /* ── Single request (thin — pure query) ────────────────────── */

  router.get("/requests/:id", withAuthRequired(async ({ res, prisma, params, orgId }) => {
    const scopedReq = await resolveAndScopeRequest(prisma, params.id, orgId);
    if (!scopedReq) return sendError(res, 404, "NOT_FOUND", "Request not found");
    const found = await getMaintenanceRequestById(prisma, scopedReq.id);
    if (!found) return sendError(res, 404, "NOT_FOUND", "Not found");
    sendJson(res, 200, { data: found });
  }));

  /* ── Contractor requests (thin — pure query) ───────────────── */

  router.get("/requests/contractor/:contractorId", async ({ req, res, prisma, params, orgId }) => {
    if (!requireRole(req, res, "CONTRACTOR")) return;
    const c = await findContractorOrgId(prisma, params.contractorId);
    if (!c || c.orgId !== orgId) return sendError(res, 404, "NOT_FOUND", "Contractor not found");
    const requests = await getContractorAssignedRequests(prisma, params.contractorId);
    sendJson(res, 200, { data: requests });
  });

  router.get("/requests/contractor", async ({ req, res, prisma, query, orgId }) => {
    if (!requireRole(req, res, "CONTRACTOR")) return;
    const cid = first(query, "contractorId");
    if (!cid) return sendError(res, 400, "VALIDATION_ERROR", "Missing contractorId");
    const c = await findContractorOrgId(prisma, cid);
    if (!c || c.orgId !== orgId) return sendError(res, 404, "NOT_FOUND", "Contractor not found");
    const requests = await getContractorAssignedRequests(prisma, cid);
    sendJson(res, 200, { data: requests });
  });

  /* ── List requests (thin — pure query) ─────────────────────── */

  router.get("/requests", withAuthRequired(async ({ res, prisma, query, orgId }) => {
    const limit = getIntParam(query, "limit", { defaultValue: 50, min: 1, max: 2000 });
    const offset = getIntParam(query, "offset", { defaultValue: 0, min: 0, max: 1_000_000 });
    const order = getEnumParam(query, "order", ["asc", "desc"] as const, "asc");
    const view = first(query, "view") as "summary" | "full" | undefined;
    const result = await listMaintenanceRequests(prisma, orgId, { limit, offset, order, view });
    sendJson(res, 200, { data: result.data, total: result.total });
  }));

  /* ── Work requests (aliases — thin) ────────────────────────── */

  router.get("/work-requests", withAuthRequired(async ({ res, prisma, query, orgId }) => {
    const limit = getIntParam(query, "limit", { defaultValue: 50, min: 1, max: 2000 });
    const offset = getIntParam(query, "offset", { defaultValue: 0, min: 0, max: 1_000_000 });
    const order = getEnumParam(query, "order", ["asc", "desc"] as const, "asc");
    const result = await listMaintenanceRequests(prisma, orgId, { limit, offset, order, view: "full" });
    const workRequests = (result.data as MaintenanceRequestDTO[]).map(workRequestFromRequest);
    sendJson(res, 200, { data: workRequests, total: result.total });
  }));

  router.get("/work-requests/:id", withAuthRequired(async ({ res, prisma, params, orgId }) => {
    const scopedReq = await resolveAndScopeRequest(prisma, params.id, orgId);
    if (!scopedReq) return sendError(res, 404, "NOT_FOUND", "Work request not found");
    const request = await getMaintenanceRequestById(prisma, scopedReq.id);
    if (!request) return sendError(res, 404, "NOT_FOUND", "Work request not found");
    sendJson(res, 200, { data: workRequestFromRequest(request) });
  }));

  /* ── Create request → delegates to createRequestWorkflow ──── */

  router.post("/requests", async (ctx) => {
    // SA-12: Upfront auth check — reject unauthenticated requests when AUTH_OPTIONAL=false
    if (!requireAuth(ctx.req, ctx.res)) return;
    try {
      await handleCreateRequest(ctx, false);
    } catch (e: any) {
      const msg = String(e?.message || e);
      if (msg === "Invalid JSON") return sendError(ctx.res, 400, "INVALID_JSON", "Invalid JSON");
      if (msg === "Body too large") return sendError(ctx.res, 413, "BODY_TOO_LARGE", "Request body too large");
      if (e.code === "VALIDATION_ERROR") return sendError(ctx.res, 400, "VALIDATION_ERROR", e.message);
      sendError(ctx.res, 500, "UNKNOWN_ERROR", "Unexpected error", String(e));
    }
  });

  router.post("/work-requests", async (ctx) => {
    // SA-12: Upfront auth check
    if (!requireAuth(ctx.req, ctx.res)) return;
    try {
      await handleCreateRequest(ctx, true);
    } catch (e: any) {
      const msg = String(e?.message || e);
      if (msg === "Invalid JSON") return sendError(ctx.res, 400, "INVALID_JSON", "Invalid JSON");
      if (msg === "Body too large") return sendError(ctx.res, 413, "BODY_TOO_LARGE", "Request body too large");
      if (e.code === "VALIDATION_ERROR") return sendError(ctx.res, 400, "VALIDATION_ERROR", e.message);
      sendError(ctx.res, 500, "UNKNOWN_ERROR", "Unexpected error", String(e));
    }
  });
}

/* ── Thin create handler: parse → validate → workflow → respond ── */

async function handleCreateRequest(ctx: HandlerContext, asWorkRequest: boolean) {
  const { req, res, prisma, orgId } = ctx;

  // Parse body
  const raw = await readJson(req);
  if (raw?.text && !raw?.description) raw.description = raw.text;

  // Validate
  const parsed = CreateRequestSchema.safeParse(raw);
  if (!parsed.success) return sendError(res, 400, "VALIDATION_ERROR", "Invalid request body", parsed.error.flatten());

  // Delegate to workflow
  const result = await createRequestWorkflow(wfCtx(ctx), {
    input: parsed.data,
    contactPhone: (raw as any).contactPhone ?? null,
    tenantId: (raw as any).tenantId ?? null,
    unitId: (raw as any).unitId ?? null,
    assetId: (raw as any).assetId ?? null,
  });

  // Map response format
  if (asWorkRequest) {
    sendJson(res, 201, { data: workRequestFromRequest(result.dto) });
  } else {
    sendJson(res, 201, { data: result.dto });
  }
}
