import { Router } from "../http/router";
import { sendError, sendJson } from "../http/json";
import { first, getIntParam } from "../http/query";
import { requireRole } from "../authz";
import type { TokenPayload } from "../services/auth";
import { PrismaClient } from "@prisma/client";
import { listJobs, getJob } from "../services/jobs";
import { listInvoices, getInvoice } from "../services/invoices";
import { listRfpsForContractor, getContractorRfpById, RfpNotFoundError } from "../services/rfps";
import { ListContractorRfpsSchema } from "../validation/legal";
import { SubmitQuoteSchema } from "../validation/quoteSchema";
import { parseBody } from "../http/body";
import { submitQuoteWorkflow, QuoteSubmissionError } from "../workflows";
import * as contractorRepo from "../repositories/contractorRepository";
import { findJobRaw } from "../repositories/jobRepository";
import { ContractorCompleteSchema, SubmitRatingSchema } from "../validation/completionSchemas";
import {
  contractorCompleteJobWorkflow,
  submitRatingWorkflow,
  CompletionError,
} from "../workflows/completionRatingWorkflow";

/**
 * Resolve the contractorId for an authenticated request.
 *
 * IDOR prevention: CONTRACTOR users cannot supply an arbitrary contractorId via
 * query parameter — their identity is always derived from their authenticated
 * email, ensuring they can only access their own data.
 *
 * ADMIN users (internal staff) may pass any contractorId via query param so
 * they can inspect contractor data for support / back-office purposes.
 */
async function resolveContractorId(
  prisma: PrismaClient,
  user: TokenPayload,
  queryContractorId: string | undefined,
  orgId: string,
): Promise<string | null> {
  if (user.accessLevel === "ADMIN") {
    return queryContractorId ?? null;
  }
  const row = await prisma.contractor.findFirst({
    where: { email: user.email, orgId },
    select: { id: true },
  });
  return row?.id ?? null;
}

/**
 * Contractor-scoped routes: /contractor/jobs, /contractor/invoices
 * H1: Contractor isolation - contractorId is always resolved from the
 * authenticated user's identity, never from an arbitrary query parameter.
 */
export function registerContractorRoutes(router: Router) {
  
  /* ── GET /contractor/jobs ─────────────────────────────────── */
  router.get("/contractor/jobs", async ({ req, res, query, orgId, prisma }) => {
    try {
      const user = requireRole(req, res, "CONTRACTOR");
      if (!user) return;

      const contractorId = await resolveContractorId(prisma, user, first(query, "contractorId") as string | undefined, orgId);
      if (!contractorId) {
        return sendError(res, 403, "FORBIDDEN", "No contractor record found for this user");
      }

      // Verify contractor exists in this org (CQ-13: via repository)
      const contractor = await contractorRepo.verifyOrgOwnership(prisma, contractorId, orgId);

      if (!contractor) {
        return sendError(res, 404, "NOT_FOUND", "Contractor not found");
      }

      const limit = getIntParam(query, "limit", { defaultValue: 50, min: 1, max: 200 });
      const offset = getIntParam(query, "offset", { defaultValue: 0, min: 0, max: 1_000_000 });
      const status = first(query, "status") as string | undefined;
      const view = (first(query, "view") as "summary" | "full") || "full";

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
      const user = requireRole(req, res, "CONTRACTOR");
      if (!user) return;

      const contractorId = await resolveContractorId(prisma, user, first(query, "contractorId") as string | undefined, orgId);
      if (!contractorId) {
        return sendError(res, 403, "FORBIDDEN", "No contractor record found for this user");
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
      const user = requireRole(req, res, "CONTRACTOR");
      if (!user) return;

      const contractorId = await resolveContractorId(prisma, user, first(query, "contractorId") as string | undefined, orgId);
      if (!contractorId) {
        return sendError(res, 403, "FORBIDDEN", "No contractor record found for this user");
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
      const user = requireRole(req, res, "CONTRACTOR");
      if (!user) return;

      const contractorId = await resolveContractorId(prisma, user, first(query, "contractorId") as string | undefined, orgId);
      if (!contractorId) {
        return sendError(res, 403, "FORBIDDEN", "No contractor record found for this user");
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
      const job = await findJobRaw(prisma, invoice.jobId);

      if (!job || job.contractorId !== contractorId) {
        return sendError(res, 403, "FORBIDDEN", "You do not have access to this invoice");
      }

      sendJson(res, 200, { data: invoice });
    } catch (e) {
      sendError(res, 500, "DB_ERROR", "Failed to load invoice", String(e));
    }
  });

  /* ── GET /contractor/rfps ─────────────────────────────────── */
  router.get("/contractor/rfps", async ({ req, res, query, orgId, prisma }) => {
    try {
      const user = requireRole(req, res, "CONTRACTOR");
      if (!user) return;

      // Resolve contractor identity before Zod parse so we always use the
      // authenticated contractor's ID, not whatever the client sent.
      const contractorId = await resolveContractorId(prisma, user, first(query, "contractorId") as string | undefined, orgId);
      if (!contractorId) {
        return sendError(res, 403, "FORBIDDEN", "No contractor record found for this user");
      }

      const parsed = ListContractorRfpsSchema.safeParse({
        limit: first(query, "limit"),
        offset: first(query, "offset"),
        status: first(query, "status"),
        contractorId,
      });

      if (!parsed.success) {
        const msg = parsed.error.issues
          .map((i) => `${i.path.join(".")}: ${i.message}`)
          .join("; ");
        return sendError(res, 400, "VALIDATION_ERROR", msg);
      }

      // Verify contractor exists in this org (CQ-13: via repository)
      const contractor = await contractorRepo.verifyOrgOwnership(prisma, contractorId, orgId);
      if (!contractor) {
        return sendError(res, 404, "NOT_FOUND", "Contractor not found");
      }

      const result = await listRfpsForContractor(orgId, contractorId, {
        limit: parsed.data.limit ?? 20,
        offset: parsed.data.offset ?? 0,
        status: parsed.data.status,
      });

      sendJson(res, 200, result);
    } catch (e: any) {
      console.error("[GET /contractor/rfps]", e);
      sendError(res, 500, "DB_ERROR", "Failed to load contractor RFPs", String(e));
    }
  });

  /* ── POST /contractor/jobs/:id/complete ─────────────────── */
  router.post("/contractor/jobs/:id/complete", async ({ req, res, params, query, orgId, prisma }) => {
    try {
      const user = requireRole(req, res, "CONTRACTOR");
      if (!user) return;

      const contractorId = await resolveContractorId(prisma, user, first(query, "contractorId") as string | undefined, orgId);
      if (!contractorId) {
        return sendError(res, 403, "FORBIDDEN", "No contractor record found for this user");
      }

      const contractor = await contractorRepo.verifyOrgOwnership(prisma, contractorId, orgId);
      if (!contractor) return sendError(res, 404, "NOT_FOUND", "Contractor not found");

      const body = await parseBody(req, ContractorCompleteSchema);
      const result = await contractorCompleteJobWorkflow(
        { orgId, prisma, actorUserId: contractorId },
        { jobId: params.id, contractorId, ...body },
      );
      sendJson(res, 200, { data: result.dto });
    } catch (e: any) {
      if (e instanceof CompletionError) {
        const statusMap: Record<string, number> = { NOT_FOUND: 404, FORBIDDEN: 403, INVALID_STATUS: 409 };
        return sendError(res, statusMap[e.code] ?? 400, e.code, e.message);
      }
      sendError(res, 500, "DB_ERROR", "Failed to complete job", String(e));
    }
  });

  /* ── POST /contractor/jobs/:id/rate ──────────────────────── */
  router.post("/contractor/jobs/:id/rate", async ({ req, res, params, query, orgId, prisma }) => {
    try {
      const user = requireRole(req, res, "CONTRACTOR");
      if (!user) return;

      const contractorId = await resolveContractorId(prisma, user, first(query, "contractorId") as string | undefined, orgId);
      if (!contractorId) {
        return sendError(res, 403, "FORBIDDEN", "No contractor record found for this user");
      }

      const contractor = await contractorRepo.verifyOrgOwnership(prisma, contractorId, orgId);
      if (!contractor) return sendError(res, 404, "NOT_FOUND", "Contractor not found");

      const body = await parseBody(req, SubmitRatingSchema);
      const score =
        body.score ??
        Math.round(
          ((body.scorePunctuality ?? 0) + (body.scoreAccuracy ?? 0) + (body.scoreCourtesy ?? 0)) / 3,
        );
      const result = await submitRatingWorkflow(
        { orgId, prisma, actorUserId: contractorId },
        {
          jobId: params.id,
          raterRole: "CONTRACTOR",
          raterId: contractorId,
          score,
          scorePunctuality: body.scorePunctuality ?? null,
          scoreAccuracy: body.scoreAccuracy ?? null,
          scoreCourtesy: body.scoreCourtesy ?? null,
          comment: body.comment,
        },
      );
      sendJson(res, 201, { data: result.rating });
    } catch (e: any) {
      if (e instanceof CompletionError) {
        const statusMap: Record<string, number> = {
          NOT_FOUND: 404, FORBIDDEN: 403, INVALID_STATUS: 409, DUPLICATE_RATING: 409,
        };
        return sendError(res, statusMap[e.code] ?? 400, e.code, e.message);
      }
      sendError(res, 500, "DB_ERROR", "Failed to submit rating", String(e));
    }
  });

  /* ── GET /contractor/rfps/:id ─────────────────────────────── */
  router.get("/contractor/rfps/:id", async ({ req, res, params, query, orgId, prisma }) => {
    try {
      const user = requireRole(req, res, "CONTRACTOR");
      if (!user) return;

      const contractorId = await resolveContractorId(prisma, user, first(query, "contractorId") as string | undefined, orgId);
      if (!contractorId) {
        return sendError(res, 403, "FORBIDDEN", "No contractor record found for this user");
      }

      // Verify contractor exists in this org (CQ-13: via repository)
      const contractor = await contractorRepo.verifyOrgOwnership(prisma, contractorId, orgId);
      if (!contractor) {
        return sendError(res, 404, "NOT_FOUND", "Contractor not found");
      }

      const rfp = await getContractorRfpById(orgId, contractorId, params.id);
      sendJson(res, 200, { data: rfp });
    } catch (e: any) {
      if (e instanceof RfpNotFoundError) {
        return sendError(res, 404, "NOT_FOUND", e.message);
      }
      console.error("[GET /contractor/rfps/:id]", e);
      sendError(res, 500, "DB_ERROR", "Failed to load RFP", String(e));
    }
  });

  /* ── POST /contractor/rfps/:id/quotes ─────────────────────── */
  router.post("/contractor/rfps/:id/quotes", async ({ req, res, params, query, orgId, prisma }) => {
    try {
      const user = requireRole(req, res, "CONTRACTOR");
      if (!user) return;

      const contractorId = await resolveContractorId(prisma, user, first(query, "contractorId") as string | undefined, orgId);
      if (!contractorId) {
        return sendError(res, 403, "FORBIDDEN", "No contractor record found for this user");
      }

      // Parse and validate request body
      const quoteData = await parseBody(req, SubmitQuoteSchema);

      // Call workflow (orchestrates validation, persistence, events, notifications)
      const result = await submitQuoteWorkflow(
        { orgId, prisma, actorUserId: user.userId },
        { rfpId: params.id, contractorId, quoteData },
      );

      sendJson(res, 201, { data: result.quote });
    } catch (e: any) {
      if (e instanceof QuoteSubmissionError) {
        const statusMap: Record<string, number> = {
          NOT_FOUND: 404,
          RFP_NOT_OPEN: 409,
          NOT_VISIBLE: 403,
          DUPLICATE_QUOTE: 409,
        };
        const status = statusMap[e.code] ?? 400;
        return sendError(res, status, e.code, e.message);
      }
      // HttpError from parseBody (400 validation, 413 payload too large)
      if ((e as any).status && typeof (e as any).status === "number" && (e as any).status < 500) {
        return sendError(res, (e as any).status, (e as any).code || "VALIDATION_ERROR", e.message);
      }
      console.error("[POST /contractor/rfps/:id/quotes]", e);
      sendError(res, 500, "DB_ERROR", "Failed to submit quote", String(e));
    }
  });
}

