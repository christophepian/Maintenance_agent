/**
 * billingSchedules routes
 *
 * Manages recurring billing schedules for tenant leases.
 *
 * Endpoints:
 *   GET    /billing-schedules               — list all schedules for org
 *   GET    /billing-schedules/:id           — fetch single schedule
 *   POST   /billing-schedules/:id/pause     — pause active schedule
 *   POST   /billing-schedules/:id/resume    — resume paused schedule
 *
 * Schedules are created/completed automatically by lease lifecycle events.
 * Manual create/delete is not exposed — use lease activation/termination.
 */

import { Router } from "../http/router";
import { sendError, sendJson } from "../http/json";
import { first } from "../http/query";
import { maybeRequireManager, requireRole } from "../authz";
import { withAuthRequired } from "../http/routeProtection";
import {
  BILLING_SCHEDULE_INCLUDE,
  findScheduleById,
  listSchedules,
  pauseSchedule,
  resumeSchedule,
} from "../repositories/recurringBillingRepository";

// ─── DTO ──────────────────────────────────────────────────────

export interface BillingScheduleDTO {
  id: string;
  orgId: string;
  leaseId: string;
  status: string;
  anchorDay: number;
  nextPeriodStart: string;
  lastGeneratedPeriod: string | null;
  baseRentCents: number;
  totalChargesCents: number;
  createdAt: string;
  updatedAt: string;
  completedAt: string | null;
  completionReason: string | null;
  lease: {
    id: string;
    tenantName: string;
    startDate: string;
    endDate: string | null;
    status: string;
    netRentChf: number;
    chargesTotalChf: number;
    unitId: string;
  } | null;
}

function toBillingScheduleDTO(s: any): BillingScheduleDTO {
  return {
    id: s.id,
    orgId: s.orgId,
    leaseId: s.leaseId,
    status: s.status,
    anchorDay: s.anchorDay,
    nextPeriodStart: s.nextPeriodStart.toISOString(),
    lastGeneratedPeriod: s.lastGeneratedPeriod
      ? s.lastGeneratedPeriod.toISOString()
      : null,
    baseRentCents: s.baseRentCents,
    totalChargesCents: s.totalChargesCents,
    createdAt: s.createdAt.toISOString(),
    updatedAt: s.updatedAt.toISOString(),
    completedAt: s.completedAt ? s.completedAt.toISOString() : null,
    completionReason: s.completionReason,
    lease: s.lease
      ? {
          id: s.lease.id,
          tenantName: s.lease.tenantName,
          startDate: (s.lease.startDate as Date).toISOString(),
          endDate: s.lease.endDate
            ? (s.lease.endDate as Date).toISOString()
            : null,
          status: s.lease.status,
          netRentChf: s.lease.netRentChf ?? 0,
          chargesTotalChf: s.lease.chargesTotalChf ?? 0,
          unitId: s.lease.unitId,
        }
      : null,
  };
}

// ─── Routes ───────────────────────────────────────────────────

export function registerBillingScheduleRoutes(router: Router) {
  // ── GET /billing-schedules ──────────────────────────────────
  router.get(
    "/billing-schedules",
    withAuthRequired(async ({ req, res, orgId, prisma, query }) => {
      if (!maybeRequireManager(req, res)) return;
      try {
        const statusFilter = first(query, "status") as
          | "ACTIVE"
          | "PAUSED"
          | "COMPLETED"
          | undefined;
        const leaseIdFilter = first(query, "leaseId") || undefined;

        const schedules = await listSchedules(prisma, orgId, statusFilter as any, leaseIdFilter);
        sendJson(res, 200, { data: schedules.map(toBillingScheduleDTO) });
      } catch (err: any) {
        console.error("[billing-schedules] list error:", err);
        sendError(res, 500, "INTERNAL_ERROR", err.message);
      }
    }),
  );

  // ── GET /billing-schedules/:id ──────────────────────────────
  router.get(
    "/billing-schedules/:id",
    withAuthRequired(async ({ req, res, orgId, prisma, params }) => {
      if (!maybeRequireManager(req, res)) return;
      try {
        const schedule = await findScheduleById(prisma, params.id, orgId);
        if (!schedule) {
          return sendError(res, 404, "NOT_FOUND", "Billing schedule not found");
        }
        sendJson(res, 200, toBillingScheduleDTO(schedule));
      } catch (err: any) {
        console.error("[billing-schedules] get error:", err);
        sendError(res, 500, "INTERNAL_ERROR", err.message);
      }
    }),
  );

  // ── POST /billing-schedules/:id/pause ───────────────────────
  router.post(
    "/billing-schedules/:id/pause",
    withAuthRequired(async ({ req, res, orgId, prisma, params }) => {
      if (!requireRole(req, res, "MANAGER")) return;
      try {
        const existing = await findScheduleById(prisma, params.id, orgId);
        if (!existing) {
          return sendError(res, 404, "NOT_FOUND", "Billing schedule not found");
        }
        if (existing.status !== "ACTIVE") {
          return sendError(
            res,
            409,
            "INVALID_STATE",
            `Cannot pause schedule in ${existing.status} state`,
          );
        }
        const updated = await pauseSchedule(prisma, params.id);
        sendJson(res, 200, toBillingScheduleDTO(updated as any));
      } catch (err: any) {
        console.error("[billing-schedules] pause error:", err);
        sendError(res, 500, "INTERNAL_ERROR", err.message);
      }
    }),
  );

  // ── POST /billing-schedules/:id/resume ──────────────────────
  router.post(
    "/billing-schedules/:id/resume",
    withAuthRequired(async ({ req, res, orgId, prisma, params }) => {
      if (!requireRole(req, res, "MANAGER")) return;
      try {
        const existing = await findScheduleById(prisma, params.id, orgId);
        if (!existing) {
          return sendError(res, 404, "NOT_FOUND", "Billing schedule not found");
        }
        if (existing.status !== "PAUSED") {
          return sendError(
            res,
            409,
            "INVALID_STATE",
            `Cannot resume schedule in ${existing.status} state`,
          );
        }
        const updated = await resumeSchedule(prisma, params.id);
        sendJson(res, 200, toBillingScheduleDTO(updated as any));
      } catch (err: any) {
        console.error("[billing-schedules] resume error:", err);
        sendError(res, 500, "INTERNAL_ERROR", err.message);
      }
    }),
  );
}
