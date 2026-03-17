/**
 * Completion & Rating routes — Slice 7: job-completion-ratings
 *
 * Thin HTTP handlers for the job completion lifecycle.
 * Business logic lives in workflows/completionRatingWorkflow.ts.
 *
 * Contractor endpoints:
 *   POST /contractor/jobs/:id/complete           — mark job completed
 *   POST /contractor/jobs/:id/rate               — submit rating after completion
 *
 * Tenant endpoints:
 *   POST /tenant-portal/jobs/:jobId/confirm      — confirm completion
 *   POST /tenant-portal/jobs/:jobId/rate         — submit rating after completion
 *
 * Manager/read endpoint:
 *   GET  /contractors/:id/ratings                — contractor rating history
 */

import { Router } from "../http/router";
import { sendError, sendJson } from "../http/json";
import { first, getIntParam } from "../http/query";
import { parseBody } from "../http/body";
import { requireRole, requireTenantSession, maybeRequireManager } from "../authz";
import {
  contractorCompleteJobWorkflow,
  confirmCompletionWorkflow,
  submitRatingWorkflow,
  CompletionError,
} from "../workflows";
import { ContractorCompleteSchema, SubmitRatingSchema } from "../validation/completionSchemas";
import { findRatingsByContractorId } from "../repositories/ratingRepository";
import * as contractorRepo from "../repositories/contractorRepository";
import type { RatingWithJob } from "../repositories/ratingRepository";

function mapRatingToDTO(r: RatingWithJob) {
  return {
    id: r.id,
    jobId: r.jobId,
    raterRole: r.raterRole,
    score: r.score,
    comment: r.comment,
    createdAt: r.createdAt.toISOString(),
    job: r.job
      ? {
          id: r.job.id,
          requestId: r.job.requestId,
          contractorId: r.job.contractorId,
          description: r.job.request?.description ?? null,
          building: r.job.request?.unit?.building?.name ?? null,
          unit: r.job.request?.unit?.unitNumber ?? null,
        }
      : null,
  };
}

export function registerCompletionRoutes(router: Router) {
  /* ── POST /contractor/jobs/:id/complete ────────────────────── */
  router.post(
    "/contractor/jobs/:id/complete",
    async ({ req, res, params, query, orgId, prisma }) => {
      try {
        const user = requireRole(req, res, "CONTRACTOR");
        if (!user) return;

        const contractorId = first(query, "contractorId") as string | undefined;
        if (!contractorId) {
          return sendError(res, 400, "VALIDATION_ERROR", "contractorId parameter required");
        }

        // Verify contractor org ownership
        const contractor = await contractorRepo.verifyOrgOwnership(prisma, contractorId, orgId);
        if (!contractor) {
          return sendError(res, 404, "NOT_FOUND", "Contractor not found");
        }

        const body = await parseBody(req, ContractorCompleteSchema);

        const result = await contractorCompleteJobWorkflow(
          { orgId, prisma, actorUserId: user.userId },
          {
            jobId: params.id,
            contractorId,
            actualCost: body.actualCost,
            completedAt: body.completedAt,
            notes: body.notes,
          },
        );

        sendJson(res, 200, { data: result.dto });
      } catch (e: any) {
        if (e instanceof CompletionError) {
          const statusMap: Record<string, number> = {
            NOT_FOUND: 404,
            INVALID_STATUS: 409,
            FORBIDDEN: 403,
          };
          return sendError(res, statusMap[e.code] ?? 400, e.code, e.message);
        }
        if (e?.status && typeof e.status === "number" && e.status < 500) {
          return sendError(res, e.status, e.code || "VALIDATION_ERROR", e.message);
        }
        console.error("[POST /contractor/jobs/:id/complete]", e);
        sendError(res, 500, "DB_ERROR", "Failed to complete job", String(e));
      }
    },
  );

  /* ── POST /contractor/jobs/:id/rate ────────────────────────── */
  router.post(
    "/contractor/jobs/:id/rate",
    async ({ req, res, params, query, orgId, prisma }) => {
      try {
        const user = requireRole(req, res, "CONTRACTOR");
        if (!user) return;

        const contractorId = first(query, "contractorId") as string | undefined;
        if (!contractorId) {
          return sendError(res, 400, "VALIDATION_ERROR", "contractorId parameter required");
        }

        // Verify contractor org ownership
        const contractor = await contractorRepo.verifyOrgOwnership(prisma, contractorId, orgId);
        if (!contractor) {
          return sendError(res, 404, "NOT_FOUND", "Contractor not found");
        }

        const body = await parseBody(req, SubmitRatingSchema);

        const result = await submitRatingWorkflow(
          { orgId, prisma, actorUserId: user.userId },
          {
            jobId: params.id,
            raterRole: "CONTRACTOR",
            raterId: contractorId,
            score: body.score,
            comment: body.comment,
          },
        );

        sendJson(res, 201, { data: result.rating });
      } catch (e: any) {
        if (e instanceof CompletionError) {
          const statusMap: Record<string, number> = {
            NOT_FOUND: 404,
            INVALID_STATUS: 409,
            FORBIDDEN: 403,
            DUPLICATE_RATING: 409,
          };
          return sendError(res, statusMap[e.code] ?? 400, e.code, e.message);
        }
        if (e?.status && typeof e.status === "number" && e.status < 500) {
          return sendError(res, e.status, e.code || "VALIDATION_ERROR", e.message);
        }
        console.error("[POST /contractor/jobs/:id/rate]", e);
        sendError(res, 500, "DB_ERROR", "Failed to submit rating", String(e));
      }
    },
  );

  /* ── POST /tenant-portal/jobs/:jobId/confirm ───────────────── */
  router.post(
    "/tenant-portal/jobs/:jobId/confirm",
    async ({ req, res, params, orgId, prisma }) => {
      try {
        const tenantId = requireTenantSession(req, res);
        if (!tenantId) return;

        const result = await confirmCompletionWorkflow(
          { orgId, prisma, actorUserId: tenantId },
          { jobId: params.jobId, tenantId },
        );

        sendJson(res, 200, { data: result.dto });
      } catch (e: any) {
        if (e instanceof CompletionError) {
          const statusMap: Record<string, number> = {
            NOT_FOUND: 404,
            INVALID_STATUS: 409,
            FORBIDDEN: 403,
            ALREADY_CONFIRMED: 409,
          };
          return sendError(res, statusMap[e.code] ?? 400, e.code, e.message);
        }
        console.error("[POST /tenant-portal/jobs/:jobId/confirm]", e);
        sendError(res, 500, "DB_ERROR", "Failed to confirm completion", String(e));
      }
    },
  );

  /* ── POST /tenant-portal/jobs/:jobId/rate ──────────────────── */
  router.post(
    "/tenant-portal/jobs/:jobId/rate",
    async ({ req, res, params, orgId, prisma }) => {
      try {
        const tenantId = requireTenantSession(req, res);
        if (!tenantId) return;

        const body = await parseBody(req, SubmitRatingSchema);

        const result = await submitRatingWorkflow(
          { orgId, prisma, actorUserId: tenantId },
          {
            jobId: params.jobId,
            raterRole: "TENANT",
            raterId: tenantId,
            score: body.score,
            comment: body.comment,
          },
        );

        sendJson(res, 201, { data: result.rating });
      } catch (e: any) {
        if (e instanceof CompletionError) {
          const statusMap: Record<string, number> = {
            NOT_FOUND: 404,
            INVALID_STATUS: 409,
            FORBIDDEN: 403,
            DUPLICATE_RATING: 409,
          };
          return sendError(res, statusMap[e.code] ?? 400, e.code, e.message);
        }
        console.error("[POST /tenant-portal/jobs/:jobId/rate]", e);
        sendError(res, 500, "DB_ERROR", "Failed to submit rating", String(e));
      }
    },
  );

  /* ── GET /contractors/:id/ratings ──────────────────────────── */
  router.get(
    "/contractors/:id/ratings",
    async ({ req, res, params, query, orgId, prisma }) => {
      try {
        if (!maybeRequireManager(req, res)) return;

        const limit = getIntParam(query, "limit", { defaultValue: 50, min: 1, max: 100 });
        const offset = getIntParam(query, "offset", { defaultValue: 0, min: 0 });

        const { ratings, total } = await findRatingsByContractorId(
          prisma,
          params.id,
          { limit, offset },
        );

        sendJson(res, 200, {
          data: ratings.map(mapRatingToDTO),
          pagination: { total, limit, offset },
        });
      } catch (e: any) {
        console.error("[GET /contractors/:id/ratings]", e);
        sendError(res, 500, "DB_ERROR", "Failed to list ratings", String(e));
      }
    },
  );
}
