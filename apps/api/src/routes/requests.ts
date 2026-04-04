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
import { resolveRequestOrg, assertOrgScope } from "../governance/orgScope";
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
import { ownerRejectWorkflow } from "../workflows/ownerRejectWorkflow";
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
    const resolution = await resolveRequestOrg(prisma, params.id);
    try { assertOrgScope(orgId, resolution); } catch {
      return sendError(res, 404, "NOT_FOUND", "Request not found");
    }
    const events = await listRequestEvents(prisma, params.id);
    sendJson(res, 200, { data: events });
  }));

  router.post("/requests/:id/events", async ({ req, res, prisma, params, orgId }) => {
    if (!requireAnyRole(req, res, ["CONTRACTOR", "MANAGER"])) return;
    const resolution = await resolveRequestOrg(prisma, params.id);
    try { assertOrgScope(orgId, resolution); } catch {
      return sendError(res, 404, "NOT_FOUND", "Request not found");
    }
    const raw = await readJson(req);
    const { contractorId, type, message } = raw;
    if (!contractorId || !type || !message) {
      return sendError(res, 400, "VALIDATION_ERROR", "Missing contractorId, type, or message");
    }
    try {
      const event = await createRequestEvent(prisma, {
        requestId: params.id,
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

    // Org scope check
    const resolution = await resolveRequestOrg(prisma, params.id);
    try { assertOrgScope(orgId, resolution); } catch {
      return sendError(res, 404, "NOT_FOUND", "Request not found");
    }

    const raw = await readJson(req);

    try {
      const result = await approveRequestWorkflow(wfCtx(ctx), {
        requestId: params.id,
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

  /* ── Owner reject → delegates to ownerRejectWorkflow ─────── */

  router.post("/requests/:id/owner-reject", async (ctx) => {
    const { req, res, prisma, params, orgId } = ctx;
    if (!requireOwnerAccess(req, res)) return;
    const requestId = params.id;
    const resolution = await resolveRequestOrg(prisma, requestId);
    try { assertOrgScope(orgId, resolution); } catch {
      return sendError(res, 404, "NOT_FOUND", "Request not found");
    }
    const raw = await readJson(req);

    try {
      const result = await ownerRejectWorkflow(wfCtx(ctx), {
        requestId,
        reason: raw?.reason || null,
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

  /* ── Status update ─────────────────────────────────────────── */

  router.patch("/requests/:id/status", async (ctx) => {
    const { req, res, prisma, query, params, orgId } = ctx;

    const resolution = await resolveRequestOrg(prisma, params.id);
    try { assertOrgScope(orgId, resolution); } catch {
      return sendError(res, 404, "NOT_FOUND", "Request not found");
    }

    const raw = await readJson(req);
    const parsed = UpdateRequestStatusSchema.safeParse(raw);
    if (!parsed.success) return sendError(res, 400, "VALIDATION_ERROR", "Invalid status update", parsed.error.flatten());

    const input = parsed.data;
    const contractorId = first(query, "contractorId") || null;

    // Contractor-scoped status update (unchanged — different flow)
    if (contractorId) {
      if (!requireRole(req, res, "CONTRACTOR")) return;
      const result = await updateContractorRequestStatus(
        prisma, params.id, contractorId,
        RequestStatus[input.status as keyof typeof RequestStatus],
      );
      if (!result.success) return sendError(res, 400, "UPDATE_FAILED", result.message);
      return sendJson(res, 200, { data: result.data, message: result.message });
    }

    // Manager approval → delegate to workflow
    if (!requireRole(req, res, "MANAGER")) return;

    try {
      const result = await approveRequestWorkflow(wfCtx(ctx), {
        requestId: params.id,
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

    const resolution = await resolveRequestOrg(prisma, params.id);
    try { assertOrgScope(orgId, resolution); } catch {
      return sendError(res, 404, "NOT_FOUND", "Request not found");
    }

    const raw = await readJson(req);
    const urgency = raw?.urgency as string;
    if (!urgency || !Object.values(RequestUrgency).includes(urgency as RequestUrgency)) {
      return sendError(res, 400, "VALIDATION_ERROR", `urgency must be one of: ${Object.values(RequestUrgency).join(", ")}`);
    }

    const updated = await prisma.request.update({
      where: { id: params.id },
      data: { urgency: urgency as RequestUrgency },
      include: { assignedContractor: { select: { id: true, name: true, phone: true, email: true, hourlyRate: true } }, tenant: { select: { id: true, name: true, phone: true, email: true } }, unit: { select: { id: true, unitNumber: true, floor: true, building: { select: { id: true, name: true, address: true } } } }, appliance: { select: { id: true, name: true, serial: true, installDate: true, notes: true, assetModel: { select: { id: true, manufacturer: true, model: true, category: true } } } } },
    });
    sendJson(res, 200, { data: updated });
  });

  /* ── DEV: delete all requests ──────────────────────────────── */

  router.delete("/__dev/requests", async ({ req, res, prisma }) => {
    if (process.env.NODE_ENV === "production") return sendError(res, 403, "FORBIDDEN", "Not allowed in production");
    // SA-14: Even in dev/staging, require MANAGER auth
    if (!requireRole(req, res, "MANAGER")) return;
    const result = await prisma.request.deleteMany({});
    sendJson(res, 200, { data: { deleted: result.count } });
  });

  /* ── Assignment → delegates to assignContractorWorkflow ────── */

  router.post("/requests/:id/assign", async (ctx) => {
    const { req, res, prisma, params, orgId } = ctx;
    if (!requireRole(req, res, "MANAGER")) return;

    const resolution = await resolveRequestOrg(prisma, params.id);
    try { assertOrgScope(orgId, resolution); } catch {
      return sendError(res, 404, "NOT_FOUND", "Request not found");
    }

    const raw = await readJson(req);
    const parsed = AssignContractorSchema.safeParse(raw);
    if (!parsed.success) return sendError(res, 400, "VALIDATION_ERROR", "Invalid assignment data", parsed.error.flatten());

    try {
      const result = await assignContractorWorkflow(wfCtx(ctx), {
        requestId: params.id,
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

    const resolution = await resolveRequestOrg(prisma, params.id);
    try { assertOrgScope(orgId, resolution); } catch {
      return sendError(res, 404, "NOT_FOUND", "Request not found");
    }

    try {
      const result = await unassignContractorWorkflow(wfCtx(ctx), {
        requestId: params.id,
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
    const resolution = await resolveRequestOrg(prisma, params.id);
    try { assertOrgScope(orgId, resolution); } catch {
      return sendError(res, 404, "NOT_FOUND", "Request not found");
    }
    const reqRow = await prisma.request.findUnique({ where: { id: params.id } });
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
    const resolution = await resolveRequestOrg(prisma, params.id);
    try { assertOrgScope(orgId, resolution); } catch {
      return sendError(res, 404, "NOT_FOUND", "Request not found");
    }
    const found = await getMaintenanceRequestById(prisma, params.id);
    if (!found) return sendError(res, 404, "NOT_FOUND", "Request not found");
    sendJson(res, 200, { data: found });
  }));

  /* ── Contractor requests (thin — pure query) ───────────────── */

  router.get("/requests/contractor/:contractorId", async ({ req, res, prisma, params, orgId }) => {
    if (!requireRole(req, res, "CONTRACTOR")) return;
    const c = await prisma.contractor.findUnique({ where: { id: params.contractorId }, select: { orgId: true } });
    if (!c || c.orgId !== orgId) return sendError(res, 404, "NOT_FOUND", "Contractor not found");
    const requests = await getContractorAssignedRequests(prisma, params.contractorId);
    sendJson(res, 200, { data: requests });
  });

  router.get("/requests/contractor", async ({ req, res, prisma, query, orgId }) => {
    if (!requireRole(req, res, "CONTRACTOR")) return;
    const cid = first(query, "contractorId");
    if (!cid) return sendError(res, 400, "VALIDATION_ERROR", "Missing contractorId");
    const c = await prisma.contractor.findUnique({ where: { id: cid }, select: { orgId: true } });
    if (!c || c.orgId !== orgId) return sendError(res, 404, "NOT_FOUND", "Contractor not found");
    const requests = await getContractorAssignedRequests(prisma, cid);
    sendJson(res, 200, { data: requests });
  });

  /* ── List requests (thin — pure query) ─────────────────────── */

  router.get("/requests", withAuthRequired(async ({ res, prisma, query, orgId }) => {
    const limit = getIntParam(query, "limit", { defaultValue: 50, min: 1, max: 200 });
    const offset = getIntParam(query, "offset", { defaultValue: 0, min: 0, max: 1_000_000 });
    const order = getEnumParam(query, "order", ["asc", "desc"] as const, "asc");
    const view = first(query, "view") as "summary" | "full" | undefined;
    const result = await listMaintenanceRequests(prisma, orgId, { limit, offset, order, view });
    sendJson(res, 200, { data: result.data, total: result.total });
  }));

  /* ── Work requests (aliases — thin) ────────────────────────── */

  router.get("/work-requests", withAuthRequired(async ({ res, prisma, query, orgId }) => {
    const limit = getIntParam(query, "limit", { defaultValue: 50, min: 1, max: 200 });
    const offset = getIntParam(query, "offset", { defaultValue: 0, min: 0, max: 1_000_000 });
    const order = getEnumParam(query, "order", ["asc", "desc"] as const, "asc");
    const result = await listMaintenanceRequests(prisma, orgId, { limit, offset, order, view: "full" });
    const workRequests = (result.data as MaintenanceRequestDTO[]).map(workRequestFromRequest);
    sendJson(res, 200, { data: workRequests, total: result.total });
  }));

  router.get("/work-requests/:id", withAuthRequired(async ({ res, prisma, params, orgId }) => {
    const resolution = await resolveRequestOrg(prisma, params.id);
    try { assertOrgScope(orgId, resolution); } catch {
      return sendError(res, 404, "NOT_FOUND", "Work request not found");
    }
    const request = await getMaintenanceRequestById(prisma, params.id);
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
    applianceId: (raw as any).applianceId ?? null,
  });

  // Map response format
  if (asWorkRequest) {
    sendJson(res, 201, { data: workRequestFromRequest(result.dto) });
  } else {
    sendJson(res, 201, { data: result.dto });
  }
}
