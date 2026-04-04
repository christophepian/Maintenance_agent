/**
 * contractorBillingSchedules routes
 *
 * Recurring billing schedules for contractor services.
 *
 * Endpoints:
 *   GET    /contractor-billing-schedules              — list (filter by status, contractorId, buildingId)
 *   GET    /contractor-billing-schedules/:id          — single schedule detail
 *   POST   /contractor-billing-schedules              — create a new schedule
 *   PUT    /contractor-billing-schedules/:id          — update schedule
 *   POST   /contractor-billing-schedules/:id/pause    — pause ACTIVE schedule
 *   POST   /contractor-billing-schedules/:id/resume   — resume PAUSED schedule
 *   POST   /contractor-billing-schedules/:id/stop     — stop (complete) schedule
 *   POST   /contractor-billing-schedules/:id/generate — generate next invoice now
 *   DELETE /contractor-billing-schedules/:id          — delete schedule
 */

import { Router } from "../http/router";
import { sendError, sendJson } from "../http/json";
import { first } from "../http/query";
import { maybeRequireManager, requireRole } from "../authz";
import { withAuthRequired } from "../http/routeProtection";
import { readJson } from "../http/body";
import * as contractorBillingRepo from "../repositories/contractorBillingRepository";
import * as contractorBillingService from "../services/contractorBillingService";

// ─── DTO ──────────────────────────────────────────────────────

export interface ContractorBillingScheduleDTO {
  id: string;
  orgId: string;
  contractorId: string;
  status: string;
  description: string;
  frequency: string;
  anchorDay: number;
  nextPeriodStart: string;
  lastGeneratedPeriod: string | null;
  amountCents: number;
  vatRate: number;
  buildingId: string | null;
  completedAt: string | null;
  completionReason: string | null;
  createdAt: string;
  updatedAt: string;
  contractor: {
    id: string;
    name: string;
    email: string;
    phone: string;
    iban: string | null;
    vatNumber: string | null;
    defaultVatRate: number | null;
    isActive: boolean;
  };
  building: {
    id: string;
    name: string;
    address: string;
  } | null;
}

function toDTO(schedule: any): ContractorBillingScheduleDTO {
  return {
    id: schedule.id,
    orgId: schedule.orgId,
    contractorId: schedule.contractorId,
    status: schedule.status,
    description: schedule.description,
    frequency: schedule.frequency,
    anchorDay: schedule.anchorDay,
    nextPeriodStart: schedule.nextPeriodStart.toISOString(),
    lastGeneratedPeriod: schedule.lastGeneratedPeriod
      ? schedule.lastGeneratedPeriod.toISOString()
      : null,
    amountCents: schedule.amountCents,
    vatRate: schedule.vatRate,
    buildingId: schedule.buildingId,
    completedAt: schedule.completedAt
      ? schedule.completedAt.toISOString()
      : null,
    completionReason: schedule.completionReason,
    createdAt: schedule.createdAt.toISOString(),
    updatedAt: schedule.updatedAt.toISOString(),
    contractor: {
      id: schedule.contractor.id,
      name: schedule.contractor.name,
      email: schedule.contractor.email,
      phone: schedule.contractor.phone,
      iban: schedule.contractor.iban,
      vatNumber: schedule.contractor.vatNumber,
      defaultVatRate: schedule.contractor.defaultVatRate,
      isActive: schedule.contractor.isActive,
    },
    building: schedule.building
      ? {
          id: schedule.building.id,
          name: schedule.building.name,
          address: schedule.building.address,
        }
      : null,
  };
}

// ─── Routes ───────────────────────────────────────────────────

export function registerContractorBillingRoutes(router: Router) {
  // ── GET /contractor-billing-schedules ──────────────────────
  router.get(
    "/contractor-billing-schedules",
    withAuthRequired(async ({ req, res, orgId, prisma, query }) => {
      if (!maybeRequireManager(req, res)) return;
      try {
        const statusFilter = first(query, "status") || undefined;
        const contractorIdFilter = first(query, "contractorId") || undefined;
        const buildingIdFilter = first(query, "buildingId") || undefined;
        const frequencyFilter = first(query, "frequency") || undefined;

        const list = await contractorBillingRepo.listSchedules(prisma, orgId, {
          status: statusFilter,
          contractorId: contractorIdFilter,
          buildingId: buildingIdFilter,
          frequency: frequencyFilter,
        });
        sendJson(res, 200, { data: list.map(toDTO) });
      } catch (err: any) {
        console.error("[contractor-billing] list error:", err);
        sendError(res, 500, "INTERNAL_ERROR", err.message);
      }
    }),
  );

  // ── GET /contractor-billing-schedules/:id ──────────────────
  router.get(
    "/contractor-billing-schedules/:id",
    withAuthRequired(async ({ req, res, orgId, prisma, params }) => {
      if (!maybeRequireManager(req, res)) return;
      try {
        const schedule = await contractorBillingRepo.findById(
          prisma,
          params.id,
          orgId,
        );
        if (!schedule) {
          return sendError(res, 404, "NOT_FOUND", "Schedule not found");
        }
        sendJson(res, 200, { data: toDTO(schedule) });
      } catch (err: any) {
        console.error("[contractor-billing] get error:", err);
        sendError(res, 500, "INTERNAL_ERROR", err.message);
      }
    }),
  );

  // ── POST /contractor-billing-schedules ─────────────────────
  router.post(
    "/contractor-billing-schedules",
    withAuthRequired(async ({ req, res, orgId, prisma }) => {
      if (!requireRole(req, res, "MANAGER")) return;
      try {
        const body = await readJson(req);
        if (
          !body.contractorId ||
          !body.description ||
          !body.amountCents ||
          !body.startDate
        ) {
          return sendError(
            res,
            400,
            "BAD_REQUEST",
            "contractorId, description, amountCents, and startDate are required",
          );
        }
        const schedule = await contractorBillingService.createSchedule(
          prisma,
          orgId,
          {
            contractorId: body.contractorId,
            description: body.description,
            frequency: body.frequency || "MONTHLY",
            amountCents: parseInt(body.amountCents, 10),
            vatRate: body.vatRate ? parseFloat(body.vatRate) : undefined,
            anchorDay: body.anchorDay ? parseInt(body.anchorDay, 10) : undefined,
            startDate: body.startDate,
            buildingId: body.buildingId,
          },
        );
        sendJson(res, 201, { data: toDTO(schedule) });
      } catch (err: any) {
        console.error("[contractor-billing] create error:", err);
        sendError(res, 400, "CREATION_ERROR", err.message);
      }
    }),
  );

  // ── PUT /contractor-billing-schedules/:id ──────────────────
  router.put(
    "/contractor-billing-schedules/:id",
    withAuthRequired(async ({ req, res, orgId, prisma, params }) => {
      if (!requireRole(req, res, "MANAGER")) return;
      try {
        const body = await readJson(req);
        const schedule = await contractorBillingService.updateSchedule(
          prisma,
          params.id,
          orgId,
          {
            description: body.description,
            amountCents: body.amountCents
              ? parseInt(body.amountCents, 10)
              : undefined,
            vatRate: body.vatRate ? parseFloat(body.vatRate) : undefined,
            frequency: body.frequency,
            buildingId: body.buildingId,
          },
        );
        sendJson(res, 200, { data: toDTO(schedule) });
      } catch (err: any) {
        console.error("[contractor-billing] update error:", err);
        sendError(res, 400, "UPDATE_ERROR", err.message);
      }
    }),
  );

  // ── POST /contractor-billing-schedules/:id/pause ───────────
  router.post(
    "/contractor-billing-schedules/:id/pause",
    withAuthRequired(async ({ req, res, orgId, prisma, params }) => {
      if (!requireRole(req, res, "MANAGER")) return;
      try {
        const schedule = await contractorBillingService.pauseSchedule(
          prisma,
          params.id,
          orgId,
        );
        sendJson(res, 200, { data: toDTO(schedule) });
      } catch (err: any) {
        console.error("[contractor-billing] pause error:", err);
        sendError(res, 400, "INVALID_STATE", err.message);
      }
    }),
  );

  // ── POST /contractor-billing-schedules/:id/resume ──────────
  router.post(
    "/contractor-billing-schedules/:id/resume",
    withAuthRequired(async ({ req, res, orgId, prisma, params }) => {
      if (!requireRole(req, res, "MANAGER")) return;
      try {
        const schedule = await contractorBillingService.resumeSchedule(
          prisma,
          params.id,
          orgId,
        );
        sendJson(res, 200, { data: toDTO(schedule) });
      } catch (err: any) {
        console.error("[contractor-billing] resume error:", err);
        sendError(res, 400, "INVALID_STATE", err.message);
      }
    }),
  );

  // ── POST /contractor-billing-schedules/:id/stop ────────────
  router.post(
    "/contractor-billing-schedules/:id/stop",
    withAuthRequired(async ({ req, res, orgId, prisma, params }) => {
      if (!requireRole(req, res, "MANAGER")) return;
      try {
        const body = await readJson(req);
        const schedule = await contractorBillingService.stopSchedule(
          prisma,
          params.id,
          orgId,
          body.reason || "MANUAL_STOP",
        );
        sendJson(res, 200, { data: toDTO(schedule) });
      } catch (err: any) {
        console.error("[contractor-billing] stop error:", err);
        sendError(res, 400, "INVALID_STATE", err.message);
      }
    }),
  );

  // ── POST /contractor-billing-schedules/:id/generate ────────
  router.post(
    "/contractor-billing-schedules/:id/generate",
    withAuthRequired(async ({ req, res, orgId, prisma, params }) => {
      if (!requireRole(req, res, "MANAGER")) return;
      try {
        const result = await contractorBillingService.generateInvoiceForSchedule(
          prisma,
          params.id,
          orgId,
        );
        sendJson(res, 200, {
          data: {
            invoiceId: result.invoiceId,
            nextPeriodStart: result.nextPeriodStart.toISOString(),
          },
        });
      } catch (err: any) {
        console.error("[contractor-billing] generate error:", err);
        sendError(res, 400, "GENERATION_ERROR", err.message);
      }
    }),
  );

  // ── DELETE /contractor-billing-schedules/:id ───────────────
  router.delete(
    "/contractor-billing-schedules/:id",
    withAuthRequired(async ({ req, res, orgId, prisma, params }) => {
      if (!requireRole(req, res, "MANAGER")) return;
      try {
        await contractorBillingService.deleteSchedule(
          prisma,
          params.id,
          orgId,
        );
        sendJson(res, 204, null);
      } catch (err: any) {
        console.error("[contractor-billing] delete error:", err);
        sendError(res, 400, "DELETE_ERROR", err.message);
      }
    }),
  );
}
