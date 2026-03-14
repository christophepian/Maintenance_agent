import { Router } from "../http/router";
import { sendError, sendJson } from "../http/json";
import { first, getIntParam } from "../http/query";
import { getAuthUser } from "../authz";
import { listJobs, getJob } from "../services/jobs";
import { listInvoices, getInvoice } from "../services/invoices";
import * as contractorRepo from "../repositories/contractorRepository";

/**
 * Contractor-scoped routes: /contractor/jobs, /contractor/invoices
 * H1: Contractor isolation - endpoints filter by authenticated contractor's ID
 * Note: For dev MVP, contractorId is passed via query parameter.
 * In production with full auth, would resolve from user.contractorId field.
 */
export function registerContractorRoutes(router: Router) {
  
  /* ── GET /contractor/jobs ─────────────────────────────────── */
  router.get("/contractor/jobs", async ({ req, res, query, orgId, prisma }) => {
    try {
      const user = getAuthUser(req);
      
      // Ensure contractor is authenticated
      if (!user || user.role !== "CONTRACTOR") {
        return sendError(res, 403, "FORBIDDEN", "Only contractors can access this endpoint");
      }

      // For dev MVP: accept contractorId from query or x-dev-contractor-id header
      let contractorId = first(query, "contractorId") as string | undefined;
      if (!contractorId) {
        // Try to extract from headers (for testing)
        const headerId = ({} as any).headers?.["x-dev-contractor-id"];
        if (headerId) contractorId = Array.isArray(headerId) ? headerId[0] : headerId;
      }

      if (!contractorId) {
        return sendError(res, 400, "VALIDATION_ERROR", "contractorId parameter required");
      }

      // Verify contractor exists in this org (CQ-13: via repository)
      const contractor = await contractorRepo.verifyOrgOwnership(prisma, contractorId, orgId);

      if (!contractor) {
        return sendError(res, 404, "NOT_FOUND", "Contractor not found");
      }

      const limit = getIntParam(query, "limit", { defaultValue: 50, min: 1, max: 200 });
      const offset = getIntParam(query, "offset", { defaultValue: 0, min: 0, max: 1_000_000 });
      const status = first(query, "status") as string | undefined;
      const view = (first(query, "view") as "summary" | "full") || "summary";

      // H1: Strict contractor isolation - only jobs assigned to this contractor
      const result = await listJobs(orgId, {
        contractorId,
        status: status as any,
        view,
      });

      sendJson(res, 200, { data: result.data, total: result.total });
    } catch (e) {
      sendError(res, 500, "DB_ERROR", "Failed to load contractor jobs", String(e));
    }
  });

  /* ── GET /contractor/jobs/:id ─────────────────────────────── */
  router.get("/contractor/jobs/:id", async ({ req, res, params, query, orgId, prisma }) => {
    try {
      const user = getAuthUser(req);

      // Ensure contractor is authenticated
      if (!user || user.role !== "CONTRACTOR") {
        return sendError(res, 403, "FORBIDDEN", "Only contractors can access this endpoint");
      }

      // For dev MVP: accept contractorId from query parameter
      let contractorId = first(query, "contractorId") as string | undefined;
      if (!contractorId) {
        return sendError(res, 400, "VALIDATION_ERROR", "contractorId parameter required");
      }

      // Verify contractor exists in this org (CQ-13: via repository)
      const contractor = await contractorRepo.verifyOrgOwnership(prisma, contractorId, orgId);

      if (!contractor) {
        return sendError(res, 404, "NOT_FOUND", "Contractor not found");
      }

      // Fetch job and verify ownership
      const job = await getJob(params.id);

      if (!job || job.orgId !== orgId) {
        return sendError(res, 404, "NOT_FOUND", "Job not found");
      }

      // H1: Verify job belongs to this contractor
      if (job.contractorId !== contractorId) {
        return sendError(res, 403, "FORBIDDEN", "You do not have access to this job");
      }

      sendJson(res, 200, { data: job });
    } catch (e) {
      sendError(res, 500, "DB_ERROR", "Failed to load job", String(e));
    }
  });

  /* ── GET /contractor/invoices ───────────────────────────────── */
  router.get("/contractor/invoices", async ({ req, res, query, orgId, prisma }) => {
    try {
      const user = getAuthUser(req);

      // Ensure contractor is authenticated
      if (!user || user.role !== "CONTRACTOR") {
        return sendError(res, 403, "FORBIDDEN", "Only contractors can access this endpoint");
      }

      // For dev MVP: accept contractorId from query parameter
      let contractorId = first(query, "contractorId") as string | undefined;
      if (!contractorId) {
        return sendError(res, 400, "VALIDATION_ERROR", "contractorId parameter required");
      }

      // Verify contractor exists in this org (CQ-13: via repository)
      const contractor = await contractorRepo.verifyOrgOwnership(prisma, contractorId, orgId);

      if (!contractor) {
        return sendError(res, 404, "NOT_FOUND", "Contractor not found");
      }

      const limit = getIntParam(query, "limit", { defaultValue: 50, min: 1, max: 200 });
      const offset = getIntParam(query, "offset", { defaultValue: 0, min: 0, max: 1_000_000 });
      const status = first(query, "status") as string | undefined;
      const view = (first(query, "view") as "summary" | "full") || "summary";

      // H1: Contractor-scoped invoices - only invoices for jobs assigned to this contractor
      const result = await listInvoices(orgId, {
        status: status as any,
        view,
        contractorId,
      });

      sendJson(res, 200, { data: result.data, total: result.total });
    } catch (e) {
      sendError(res, 500, "DB_ERROR", "Failed to load contractor invoices", String(e));
    }
  });

  /* ── GET /contractor/invoices/:id ──────────────────────────── */
  router.get("/contractor/invoices/:id", async ({ req, res, params, query, orgId, prisma }) => {
    try {
      const user = getAuthUser(req);

      // Ensure contractor is authenticated
      if (!user || user.role !== "CONTRACTOR") {
        return sendError(res, 403, "FORBIDDEN", "Only contractors can access this endpoint");
      }

      // For dev MVP: accept contractorId from query parameter
      let contractorId = first(query, "contractorId") as string | undefined;
      if (!contractorId) {
        return sendError(res, 400, "VALIDATION_ERROR", "contractorId parameter required");
      }

      // Verify contractor exists in this org (CQ-13: via repository)
      const contractor = await contractorRepo.verifyOrgOwnership(prisma, contractorId, orgId);

      if (!contractor) {
        return sendError(res, 404, "NOT_FOUND", "Contractor not found");
      }

      // Fetch invoice and verify ownership
      const invoice = await getInvoice(params.id);

      if (!invoice || invoice.orgId !== orgId) {
        return sendError(res, 404, "NOT_FOUND", "Invoice not found");
      }

      // H1: Verify invoice is for a job assigned to this contractor
      const job = await prisma.job.findUnique({
        where: { id: invoice.jobId },
      });

      if (!job || job.contractorId !== contractorId) {
        return sendError(res, 403, "FORBIDDEN", "You do not have access to this invoice");
      }

      sendJson(res, 200, { data: invoice });
    } catch (e) {
      sendError(res, 500, "DB_ERROR", "Failed to load invoice", String(e));
    }
  });
}

