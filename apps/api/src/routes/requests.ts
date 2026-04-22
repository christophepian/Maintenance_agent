/**
 * Request Routes (Refactored)
 *
 * Routes are thin wrappers: parse → auth → validate → workflow → response.
 * All orchestration logic lives in workflows/.
 */

import { RequestStatus, RequestUrgency } from "@prisma/client";
import { Router, HandlerContext } from "../http/router";
import { sendError, sendJson } from "../http/json";
import { readJson } from "../http/body";
import { first, getIntParam, getEnumParam } from "../http/query";
import { getAuthUser, maybeRequireManager, requireRole, requireAnyRole, requireAuth } from "../authz";
import { withAuthRequired } from "../http/routeProtection";
import { requireOwnerAccess, logEvent } from "./helpers";
import { resolveAndScopeRequest, findRequestRaw, updateRequestUrgency, deleteAllRequests } from "../repositories/requestRepository";
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

// Workflows
import { createRequestWorkflow } from "../workflows/createRequestWorkflow";
import { approveRequestWorkflow } from "../workflows/approveRequestWorkflow";
import { assignContractorWorkflow } from "../workflows/assignContractorWorkflow";
import { unassignContractorWorkflow } from "../workflows/unassignContractorWorkflow";
import { rejectRequestWorkflow } from "../workflows/ownerRejectWorkflow";
import { InvalidTransitionError } from "../workflows/transitions";

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
      const asset = await prisma.asset.findFirst({ where: { id: assetId, orgId } });
      if (!asset) return sendError(res, 404, "NOT_FOUND", "Asset not found");
    }

    const updated = await prisma.request.update({
      where: { id: scopedReq.id },
      data: { assetId },
      select: { id: true, assetId: true },
    });
    sendJson(res, 200, { data: updated });
  });

  /* ── DEV: delete all requests ──────────────────────────────── */

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
