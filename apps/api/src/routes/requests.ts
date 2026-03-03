import { RequestStatus, OrgMode } from "@prisma/client";
import { Router, HandlerContext } from "../http/router";
import { sendError, sendJson } from "../http/json";
import { readJson } from "../http/body";
import { first, getIntParam, getEnumParam } from "../http/query";
import { getAuthUser, maybeRequireManager, requireRole } from "../authz";
import { requireOwnerAccess, logEvent } from "./helpers";
import { resolveRequestOrg, assertOrgScope, OrgScopeMismatchError } from "../governance/orgScope";
import { UpdateRequestStatusSchema } from "../validation/requestStatus";
import { AssignContractorSchema } from "../validation/requestAssignment";
import { CreateRequestSchema, CreateRequestInput } from "../validation/requests";
import {
  updateMaintenanceRequestStatus,
  assignContractor,
  unassignContractor,
  findMatchingContractor,
  listMaintenanceRequests,
  getMaintenanceRequestById,
  listOwnerPendingApprovals,
} from "../services/maintenanceRequests";
import type { MaintenanceRequestDTO } from "../services/maintenanceRequests";
import { updateContractorRequestStatus, getContractorAssignedRequests } from "../services/contractorRequests";
import { decideRequestStatus, decideRequestStatusWithRules } from "../services/autoApproval";
import { normalizePhoneToE164 } from "../utils/phoneNormalization";
import { getTenantByPhone } from "../services/tenants";
import { getOrgConfig } from "../services/orgConfig";
import { computeEffectiveConfig } from "../services/buildingConfig";
import { workRequestFromRequest } from "../services/adapters/workRequestAdapter";
import { createJob, getOrCreateJobForRequest } from "../services/jobs";

/* ── Shared: create request (used by POST /requests & POST /work-requests) ── */

async function handleCreateRequest(
  ctx: HandlerContext,
  asWorkRequest: boolean,
) {
  const { req, res, prisma, orgId } = ctx;
  const raw = await readJson(req);
  if (raw?.text && !raw?.description) raw.description = raw.text;

  const parsed = CreateRequestSchema.safeParse(raw);
  if (!parsed.success) return sendError(res, 400, "VALIDATION_ERROR", "Invalid request body", parsed.error.flatten());

  const input: CreateRequestInput = parsed.data;
  const description = input.description;
  const category = input.category ? input.category : null;
  const hasEstimatedCost = typeof input.estimatedCost === "number";
  const estimatedCost = hasEstimatedCost ? input.estimatedCost : null;

  let contactPhone: string | null = null;
  if ((input as any).contactPhone) {
    const normalized = normalizePhoneToE164((input as any).contactPhone);
    if (!normalized) return sendError(res, 400, "VALIDATION_ERROR", "Invalid contactPhone format");
    contactPhone = normalized;
  }

  let tenantId = (input as any).tenantId ?? null;
  let unitId = (input as any).unitId ?? null;
  const applianceId = (input as any).applianceId ?? null;

  if (contactPhone && !tenantId) {
    const tenant = await getTenantByPhone({ phone: contactPhone, orgId });
    if (tenant) {
      tenantId = tenant.id;
      if (!unitId && tenant.unitId) unitId = tenant.unitId;
    }
  }

  let status: RequestStatus = RequestStatus.PENDING_REVIEW;

  if (hasEstimatedCost || category) {
    let unitType: string | null = null;
    let unitNumber: string | null = null;
    let buildingId: string | null = null;
    if (unitId) {
      const unit = await prisma.unit.findUnique({
        where: { id: unitId },
        select: { type: true, unitNumber: true, buildingId: true },
      });
      unitType = unit?.type ?? null;
      unitNumber = unit?.unitNumber ?? null;
      buildingId = unit?.buildingId ?? null;
    }

    const effective = await computeEffectiveConfig(prisma, orgId, buildingId ?? undefined);
    const approvalResult = await decideRequestStatusWithRules(
      prisma, orgId,
      { category, estimatedCost, unitType, unitNumber, buildingId, unitId },
      effective.effectiveAutoApproveLimit,
      unitId,
    );
    status = approvalResult.status;

    if (
      effective.org.mode === "OWNER_DIRECT" &&
      estimatedCost !== null && estimatedCost !== undefined &&
      estimatedCost > effective.effectiveRequireOwnerApprovalAbove
    ) {
      status = RequestStatus.PENDING_OWNER_APPROVAL;
    }
  }

  const created = await prisma.request.create({
    data: { description, category, estimatedCost, status, contactPhone, tenantId, unitId, applianceId },
  });

  if (category) {
    const matchingContractor = await findMatchingContractor(prisma, orgId, category);
    if (matchingContractor) await assignContractor(prisma, created.id, matchingContractor.id);
  }

  const updated = await getMaintenanceRequestById(prisma, created.id);

  if (asWorkRequest) {
    const response = updated
      ? workRequestFromRequest(updated)
      : workRequestFromRequest({
          ...created, assignedContractor: null, tenant: null, unit: null, appliance: null,
          createdAt: created.createdAt.toISOString(),
        } as any);
    sendJson(res, 201, { data: response });
  } else {
    sendJson(res, 201, { data: updated ?? created });
  }
}

/* ── Shared: auto-create job after owner approval ────────────── */

async function autoCreateJobIfNeeded(
  prisma: any, orgId: string, requestId: string, current: any,
) {
  const orgConfig = await getOrgConfig(prisma, orgId);
  if (orgConfig.mode !== OrgMode.OWNER_DIRECT) return;

  const existingJob = await prisma.job.findUnique({ where: { requestId } });
  if (existingJob) return;

  let contractorId = current.assignedContractorId;
  if (!contractorId && current.category) {
    const matching = await findMatchingContractor(prisma, orgId, current.category);
    if (matching) {
      contractorId = matching.id;
      await assignContractor(prisma, requestId, contractorId);
    }
  }
  if (contractorId) {
    await createJob({ orgId, requestId, contractorId });
  }
}

/* ── Route registration ──────────────────────────────────────── */

export function registerRequestRoutes(router: Router) {

  /* ── Request events ────────────────────────────────────────── */

  router.get("/requests/:id/events", async ({ res, prisma, params, orgId }) => {
    const resolution = await resolveRequestOrg(prisma, params.id);
    try { assertOrgScope(orgId, resolution); } catch {
      return sendError(res, 404, "NOT_FOUND", "Request not found");
    }
    const events = await prisma.requestEvent.findMany({
      where: { requestId: params.id },
      orderBy: { timestamp: "asc" },
    });
    sendJson(res, 200, { data: events });
  });

  router.post("/requests/:id/events", async ({ req, res, prisma, params, orgId }) => {
    const resolution = await resolveRequestOrg(prisma, params.id);
    try { assertOrgScope(orgId, resolution); } catch {
      return sendError(res, 404, "NOT_FOUND", "Request not found");
    }
    const raw = await readJson(req);
    const { contractorId, type, message } = raw;
    if (!contractorId || !type || !message) {
      return sendError(res, 400, "VALIDATION_ERROR", "Missing contractorId, type, or message");
    }
    const reqExists = await prisma.request.findUnique({ where: { id: params.id } });
    if (!reqExists) return sendError(res, 404, "NOT_FOUND", "Request not found");
    const contractorExists = await prisma.contractor.findUnique({ where: { id: contractorId } });
    if (!contractorExists) return sendError(res, 404, "NOT_FOUND", "Contractor not found");

    const event = await prisma.requestEvent.create({
      data: { requestId: params.id, contractorId, type, message },
    });
    sendJson(res, 201, { data: event });
  });

  /* ── Owner approvals ───────────────────────────────────────── */

  router.get("/owner/pending-approvals", async ({ req, res, prisma, query, orgId }) => {
    if (!requireOwnerAccess(req, res)) return;
    const buildingId = first(query, "buildingId") || undefined;
    const data = await listOwnerPendingApprovals(prisma, orgId, { buildingId });
    sendJson(res, 200, { data });
  });

  router.post("/requests/:id/owner-approve", async ({ req, res, prisma, params, orgId }) => {
    if (!requireOwnerAccess(req, res)) return;
    const requestId = params.id;
    // Verify org scope
    const resolution = await resolveRequestOrg(prisma, requestId);
    try { assertOrgScope(orgId, resolution); } catch {
      return sendError(res, 404, "NOT_FOUND", "Request not found");
    }
    const raw = await readJson(req);
    const current = await prisma.request.findUnique({ where: { id: requestId } });
    if (!current) return sendError(res, 404, "NOT_FOUND", "Request not found");

    // If already approved, just ensure job exists
    if (current.status === RequestStatus.APPROVED) {
      try { await autoCreateJobIfNeeded(prisma, orgId, requestId, current); } catch (e) {
        console.warn("Failed to auto-create job for already-approved request", requestId, e);
      }
      const found = await getMaintenanceRequestById(prisma, requestId);
      return sendJson(res, 200, { data: found });
    }

    if (
      current.status !== RequestStatus.PENDING_OWNER_APPROVAL &&
      current.status !== RequestStatus.AUTO_APPROVED &&
      current.status !== RequestStatus.PENDING_REVIEW
    ) {
      return sendError(res, 409, "INVALID_TRANSITION", `Cannot owner-approve request from ${current.status}`);
    }

    const updated = await updateMaintenanceRequestStatus(prisma, requestId, RequestStatus.APPROVED);
    if (!updated) return sendError(res, 404, "NOT_FOUND", "Request not found");

    try { await autoCreateJobIfNeeded(prisma, orgId, requestId, current); } catch (err: any) {
      if (!String(err?.message || err).includes("already exists")) {
        console.warn("Failed to auto-create job for request", requestId, err);
      }
    }

    const actor = getAuthUser(req);
    await logEvent(prisma, {
      orgId, type: "OWNER_APPROVED", actorUserId: actor?.userId,
      requestId, payload: { comment: raw?.comment || null },
    });

    sendJson(res, 200, { data: updated });
  });

  router.post("/requests/:id/owner-reject", async ({ req, res, prisma, params, orgId }) => {
    if (!requireOwnerAccess(req, res)) return;
    const requestId = params.id;
    // Verify org scope
    const resolution = await resolveRequestOrg(prisma, requestId);
    try { assertOrgScope(orgId, resolution); } catch {
      return sendError(res, 404, "NOT_FOUND", "Request not found");
    }
    const raw = await readJson(req);
    const current = await prisma.request.findUnique({ where: { id: requestId } });
    if (!current) return sendError(res, 404, "NOT_FOUND", "Request not found");

    if (current.status !== RequestStatus.PENDING_OWNER_APPROVAL) {
      return sendError(res, 409, "INVALID_TRANSITION", `Cannot owner-reject request from ${current.status}`);
    }

    const updated = await updateMaintenanceRequestStatus(prisma, requestId, RequestStatus.PENDING_REVIEW);
    if (!updated) return sendError(res, 404, "NOT_FOUND", "Request not found");

    const actor = getAuthUser(req);
    await logEvent(prisma, {
      orgId, type: "OWNER_REJECTED",
      actorUserId: actor?.userId, requestId,
      payload: { reason: raw?.reason || null },
    });

    sendJson(res, 200, { data: updated });
  });

  /* ── Status update ─────────────────────────────────────────── */

  router.patch("/requests/:id/status", async ({ req, res, prisma, query, params, orgId }) => {
    // Verify org scope
    const resolution = await resolveRequestOrg(prisma, params.id);
    try { assertOrgScope(orgId, resolution); } catch {
      return sendError(res, 404, "NOT_FOUND", "Request not found");
    }

    const raw = await readJson(req);
    const parsed = UpdateRequestStatusSchema.safeParse(raw);
    if (!parsed.success) return sendError(res, 400, "VALIDATION_ERROR", "Invalid status update", parsed.error.flatten());

    const input = parsed.data;
    const contractorId = first(query, "contractorId") || null;

    if (contractorId) {
      if (!requireRole(req, res, "CONTRACTOR")) return;
      const result = await updateContractorRequestStatus(
        prisma, params.id, contractorId,
        RequestStatus[input.status as keyof typeof RequestStatus],
      );
      if (!result.success) return sendError(res, 400, "UPDATE_FAILED", result.message);
      return sendJson(res, 200, { data: result.data, message: result.message });
    }

    if (!maybeRequireManager(req, res)) return;
    const current = await prisma.request.findUnique({ where: { id: params.id } });
    if (!current) return sendError(res, 404, "NOT_FOUND", "Request not found");

    if (current.status === RequestStatus.APPROVED) {
      const found = await getMaintenanceRequestById(prisma, params.id);
      return sendJson(res, 200, { data: found });
    }

    if (current.status !== RequestStatus.PENDING_REVIEW) {
      return sendError(res, 409, "INVALID_TRANSITION", `Cannot change status from ${current.status} to ${input.status}`);
    }

    const updated = await updateMaintenanceRequestStatus(prisma, params.id, RequestStatus.APPROVED);
    if (!updated) return sendError(res, 404, "NOT_FOUND", "Request not found");
    sendJson(res, 200, { data: updated });
  });

  /* ── DEV: delete all requests ──────────────────────────────── */

  router.delete("/__dev/requests", async ({ res, prisma }) => {
    if (process.env.NODE_ENV === "production") return sendError(res, 403, "FORBIDDEN", "Not allowed in production");
    const result = await prisma.request.deleteMany({});
    sendJson(res, 200, { data: { deleted: result.count } });
  });

  /* ── Assignment ────────────────────────────────────────────── */

  router.post("/requests/:id/assign", async ({ req, res, prisma, params, orgId }) => {
    if (!maybeRequireManager(req, res)) return;
    // Verify org scope
    const resolution = await resolveRequestOrg(prisma, params.id);
    try { assertOrgScope(orgId, resolution); } catch {
      return sendError(res, 404, "NOT_FOUND", "Request not found");
    }
    const raw = await readJson(req);
    const parsed = AssignContractorSchema.safeParse(raw);
    if (!parsed.success) return sendError(res, 400, "VALIDATION_ERROR", "Invalid assignment data", parsed.error.flatten());

    const result = await assignContractor(prisma, params.id, parsed.data.contractorId);
    if (!result.success) return sendError(res, 400, "ASSIGNMENT_FAILED", result.message);

    // Auto-create a Job so the contractor sees it in their jobs list
    try {
      await getOrCreateJobForRequest(orgId, params.id, parsed.data.contractorId);
    } catch (e: any) {
      // Non-fatal: assignment succeeded, but job creation failed (log and continue)
      console.warn(`[ASSIGN] Job auto-creation failed for request ${params.id}:`, e?.message);
    }

    const updated = await getMaintenanceRequestById(prisma, params.id);
    if (!updated) return sendError(res, 404, "NOT_FOUND", "Request not found");
    sendJson(res, 200, { data: updated, message: result.message });
  });

  router.delete("/requests/:id/assign", async ({ req, res, prisma, params, orgId }) => {
    if (!maybeRequireManager(req, res)) return;
    // Verify org scope
    const resolution = await resolveRequestOrg(prisma, params.id);
    try { assertOrgScope(orgId, resolution); } catch {
      return sendError(res, 404, "NOT_FOUND", "Request not found");
    }
    const result = await unassignContractor(prisma, params.id);
    const updated = await getMaintenanceRequestById(prisma, params.id);
    if (!updated) return sendError(res, 404, "NOT_FOUND", "Request not found");
    sendJson(res, 200, { data: updated, message: result.message });
  });

  /* ── Suggest contractor ────────────────────────────────────── */

  router.get("/requests/:id/suggest-contractor", async ({ res, prisma, params, orgId }) => {
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

  router.get("/contractors/match", async ({ res, prisma, query, orgId }) => {
    const category = first(query, "category");
    if (!category) return sendError(res, 400, "VALIDATION_ERROR", "Category required");
    const contractor = await findMatchingContractor(prisma, orgId, category);
    sendJson(res, 200, { data: contractor });
  });

  /* ── Single request ────────────────────────────────────────── */

  router.get("/requests/:id", async ({ res, prisma, params, orgId }) => {
    // Verify org ownership
    const resolution = await resolveRequestOrg(prisma, params.id);
    try { assertOrgScope(orgId, resolution); } catch {
      return sendError(res, 404, "NOT_FOUND", "Request not found");
    }
    const found = await getMaintenanceRequestById(prisma, params.id);
    if (!found) return sendError(res, 404, "NOT_FOUND", "Request not found");
    sendJson(res, 200, { data: found });
  });

  /* ── Contractor requests ───────────────────────────────────── */

  router.get("/requests/contractor/:contractorId", async ({ res, prisma, params, orgId }) => {
    // Verify contractor belongs to caller's org
    const c = await prisma.contractor.findUnique({ where: { id: params.contractorId }, select: { orgId: true } });
    if (!c || c.orgId !== orgId) return sendError(res, 404, "NOT_FOUND", "Contractor not found");
    const requests = await getContractorAssignedRequests(prisma, params.contractorId);
    sendJson(res, 200, { data: requests });
  });

  router.get("/requests/contractor", async ({ res, prisma, query, orgId }) => {
    const cid = first(query, "contractorId");
    if (!cid) return sendError(res, 400, "VALIDATION_ERROR", "Missing contractorId");
    const c = await prisma.contractor.findUnique({ where: { id: cid }, select: { orgId: true } });
    if (!c || c.orgId !== orgId) return sendError(res, 404, "NOT_FOUND", "Contractor not found");
    const requests = await getContractorAssignedRequests(prisma, cid);
    sendJson(res, 200, { data: requests });
  });

  /* ── List requests ─────────────────────────────────────────── */

  router.get("/requests", async ({ res, prisma, query, orgId }) => {
    const limit = getIntParam(query, "limit", { defaultValue: 50, min: 1, max: 200 });
    const offset = getIntParam(query, "offset", { defaultValue: 0, min: 0, max: 1_000_000 });
    const order = getEnumParam(query, "order", ["asc", "desc"] as const, "asc");
    const view = first(query, "view") as "summary" | "full" | undefined;
    const data = await listMaintenanceRequests(prisma, orgId, { limit, offset, order, view });
    sendJson(res, 200, { data });
  });

  /* ── Work requests (aliases) ───────────────────────────────── */

  router.get("/work-requests", async ({ res, prisma, query, orgId }) => {
    const limit = getIntParam(query, "limit", { defaultValue: 50, min: 1, max: 200 });
    const offset = getIntParam(query, "offset", { defaultValue: 0, min: 0, max: 1_000_000 });
    const order = getEnumParam(query, "order", ["asc", "desc"] as const, "asc");
    const data = (await listMaintenanceRequests(prisma, orgId, { limit, offset, order, view: "full" })) as MaintenanceRequestDTO[];
    const workRequests = data.map(workRequestFromRequest);
    sendJson(res, 200, { data: workRequests });
  });

  router.get("/work-requests/:id", async ({ res, prisma, params, orgId }) => {
    const resolution = await resolveRequestOrg(prisma, params.id);
    try { assertOrgScope(orgId, resolution); } catch {
      return sendError(res, 404, "NOT_FOUND", "Work request not found");
    }
    const request = await getMaintenanceRequestById(prisma, params.id);
    if (!request) return sendError(res, 404, "NOT_FOUND", "Work request not found");
    sendJson(res, 200, { data: workRequestFromRequest(request) });
  });

  /* ── Create request / work-request ─────────────────────────── */

  router.post("/requests", async (ctx) => {
    try {
      await handleCreateRequest(ctx, false);
    } catch (e: any) {
      const msg = String(e?.message || e);
      if (msg === "Invalid JSON") return sendError(ctx.res, 400, "INVALID_JSON", "Invalid JSON");
      if (msg === "Body too large") return sendError(ctx.res, 413, "BODY_TOO_LARGE", "Request body too large");
      sendError(ctx.res, 500, "UNKNOWN_ERROR", "Unexpected error", String(e));
    }
  });

  router.post("/work-requests", async (ctx) => {
    try {
      await handleCreateRequest(ctx, true);
    } catch (e: any) {
      const msg = String(e?.message || e);
      if (msg === "Invalid JSON") return sendError(ctx.res, 400, "INVALID_JSON", "Invalid JSON");
      if (msg === "Body too large") return sendError(ctx.res, 413, "BODY_TOO_LARGE", "Request body too large");
      sendError(ctx.res, 500, "UNKNOWN_ERROR", "Unexpected error", String(e));
    }
  });
}
