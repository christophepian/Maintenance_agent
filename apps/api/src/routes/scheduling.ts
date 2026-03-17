/**
 * Scheduling routes — Slice 6: rfp-scheduling-handshake
 *
 * Thin HTTP handlers for the scheduling handshake between contractor and tenant.
 * Business logic lives in workflows/schedulingWorkflow.ts.
 *
 * Contractor endpoints:
 *   POST /contractor/jobs/:id/slots      — propose appointment slots
 *   GET  /contractor/jobs/:id/slots      — list slots for a job
 *
 * Tenant endpoints:
 *   GET  /tenant-portal/requests/:requestId/slots  — view proposed slots
 *   POST /tenant-portal/slots/:slotId/accept       — accept a slot
 *   POST /tenant-portal/slots/:slotId/decline       — decline a slot
 */

import { Router } from "../http/router";
import { sendError, sendJson } from "../http/json";
import { first } from "../http/query";
import { parseBody } from "../http/body";
import { requireRole, requireTenantSession } from "../authz";
import {
  proposeSlotsWorkflow,
  respondToSlotWorkflow,
  SchedulingError,
} from "../workflows";
import { findSlotsByJobId } from "../repositories/schedulingRepository";
import { findJobByRequestId } from "../repositories/jobRepository";
import { ProposeSlotsSchema } from "../validation/schedulingSchemas";
import * as contractorRepo from "../repositories/contractorRepository";

export function registerSchedulingRoutes(router: Router) {
  /* ── POST /contractor/jobs/:id/slots ───────────────────────── */
  router.post(
    "/contractor/jobs/:id/slots",
    async ({ req, res, params, query, orgId, prisma }) => {
      try {
        const user = requireRole(req, res, "CONTRACTOR");
        if (!user) return;

        const contractorId = first(query, "contractorId") as string | undefined;
        if (!contractorId) {
          return sendError(res, 400, "VALIDATION_ERROR", "contractorId parameter required");
        }

        // Verify contractor org ownership (CQ-13)
        const contractor = await contractorRepo.verifyOrgOwnership(prisma, contractorId, orgId);
        if (!contractor) {
          return sendError(res, 404, "NOT_FOUND", "Contractor not found");
        }

        const body = await parseBody(req, ProposeSlotsSchema);

        const result = await proposeSlotsWorkflow(
          { orgId, prisma, actorUserId: user.userId },
          { jobId: params.id, contractorId, slots: body.slots },
        );

        sendJson(res, 201, { data: result });
      } catch (e: any) {
        if (e instanceof SchedulingError) {
          const statusMap: Record<string, number> = {
            NOT_FOUND: 404,
            INVALID_STATUS: 409,
            FORBIDDEN: 403,
            VALIDATION_ERROR: 400,
          };
          return sendError(res, statusMap[e.code] ?? 400, e.code, e.message);
        }
        if ((e as any).status && typeof (e as any).status === "number" && (e as any).status < 500) {
          return sendError(res, (e as any).status, (e as any).code || "VALIDATION_ERROR", e.message);
        }
        console.error("[POST /contractor/jobs/:id/slots]", e);
        sendError(res, 500, "DB_ERROR", "Failed to propose slots", String(e));
      }
    },
  );

  /* ── GET /contractor/jobs/:id/slots ────────────────────────── */
  router.get(
    "/contractor/jobs/:id/slots",
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

        const slots = await findSlotsByJobId(prisma, params.id);

        // Filter: only show slots for jobs assigned to this contractor
        const jobSlots = slots.filter((s) => s.job?.contractorId === contractorId);

        sendJson(res, 200, {
          data: jobSlots.map((s) => ({
            id: s.id,
            jobId: s.jobId,
            startTime: s.startTime.toISOString(),
            endTime: s.endTime.toISOString(),
            status: s.status,
            respondedAt: s.respondedAt?.toISOString() ?? null,
            createdAt: s.createdAt.toISOString(),
          })),
        });
      } catch (e: any) {
        console.error("[GET /contractor/jobs/:id/slots]", e);
        sendError(res, 500, "DB_ERROR", "Failed to list slots", String(e));
      }
    },
  );

  /* ── GET /tenant-portal/requests/:requestId/slots ──────────── */
  router.get(
    "/tenant-portal/requests/:requestId/slots",
    async ({ req, res, params, orgId, prisma }) => {
      try {
        const tenantId = requireTenantSession(req, res);
        if (!tenantId) return;

        // Find the job linked to this request
        const job = await findJobByRequestId(prisma, params.requestId);
        if (!job) {
          return sendError(res, 404, "NOT_FOUND", "No job found for this request");
        }

        // Verify tenant owns this request
        if (job.request?.tenantId !== tenantId) {
          return sendError(res, 403, "FORBIDDEN", "Not your request");
        }

        const slots = await findSlotsByJobId(prisma, job.id);

        sendJson(res, 200, {
          data: slots.map((s) => ({
            id: s.id,
            jobId: s.jobId,
            startTime: s.startTime.toISOString(),
            endTime: s.endTime.toISOString(),
            status: s.status,
            respondedAt: s.respondedAt?.toISOString() ?? null,
            createdAt: s.createdAt.toISOString(),
          })),
        });
      } catch (e: any) {
        console.error("[GET /tenant-portal/requests/:requestId/slots]", e);
        sendError(res, 500, "DB_ERROR", "Failed to list slots", String(e));
      }
    },
  );

  /* ── POST /tenant-portal/slots/:slotId/accept ─────────────── */
  router.post(
    "/tenant-portal/slots/:slotId/accept",
    async ({ req, res, params, orgId, prisma }) => {
      try {
        const tenantId = requireTenantSession(req, res);
        if (!tenantId) return;

        const result = await respondToSlotWorkflow(
          { orgId, prisma, actorUserId: tenantId },
          { slotId: params.slotId, tenantId, action: "accept" },
        );

        sendJson(res, 200, { data: result.slot });
      } catch (e: any) {
        if (e instanceof SchedulingError) {
          const statusMap: Record<string, number> = {
            NOT_FOUND: 404,
            INVALID_STATUS: 409,
            FORBIDDEN: 403,
          };
          return sendError(res, statusMap[e.code] ?? 400, e.code, e.message);
        }
        console.error("[POST /tenant-portal/slots/:slotId/accept]", e);
        sendError(res, 500, "DB_ERROR", "Failed to accept slot", String(e));
      }
    },
  );

  /* ── POST /tenant-portal/slots/:slotId/decline ────────────── */
  router.post(
    "/tenant-portal/slots/:slotId/decline",
    async ({ req, res, params, orgId, prisma }) => {
      try {
        const tenantId = requireTenantSession(req, res);
        if (!tenantId) return;

        const result = await respondToSlotWorkflow(
          { orgId, prisma, actorUserId: tenantId },
          { slotId: params.slotId, tenantId, action: "decline" },
        );

        sendJson(res, 200, { data: result.slot });
      } catch (e: any) {
        if (e instanceof SchedulingError) {
          const statusMap: Record<string, number> = {
            NOT_FOUND: 404,
            INVALID_STATUS: 409,
            FORBIDDEN: 403,
          };
          return sendError(res, statusMap[e.code] ?? 400, e.code, e.message);
        }
        console.error("[POST /tenant-portal/slots/:slotId/decline]", e);
        sendError(res, 500, "DB_ERROR", "Failed to decline slot", String(e));
      }
    },
  );
}
