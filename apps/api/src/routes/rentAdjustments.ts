/**
 * rentAdjustments routes
 *
 * Swiss rent indexation (CPI-based) and manual rent adjustments.
 *
 * Endpoints:
 *   GET    /rent-adjustments              — list (filter by leaseId, status, adjustmentType)
 *   GET    /rent-adjustments/:id          — single adjustment detail
 *   POST   /rent-adjustments/compute      — compute CPI-based indexation
 *   POST   /rent-adjustments/manual       — create manual adjustment
 *   POST   /rent-adjustments/:id/approve  — approve DRAFT → APPROVED
 *   POST   /rent-adjustments/:id/apply    — apply APPROVED → update lease + schedule
 *   POST   /rent-adjustments/:id/reject   — reject DRAFT
 *   DELETE /rent-adjustments/:id          — delete DRAFT adjustment
 */

import { Router } from "../http/router";
import { sendError, sendJson } from "../http/json";
import { first } from "../http/query";
import { maybeRequireManager, requireRole } from "../authz";
import { withAuthRequired } from "../http/routeProtection";
import { readJson } from "../http/body";
import * as rentAdjustmentRepo from "../repositories/rentAdjustmentRepository";
import * as rentAdjustmentService from "../services/rentAdjustmentService";

// ─── DTO ──────────────────────────────────────────────────────

export interface RentAdjustmentDTO {
  id: string;
  orgId: string;
  leaseId: string;
  adjustmentType: string;
  status: string;
  effectiveDate: string;
  previousRentCents: number;
  newRentCents: number;
  adjustmentCents: number;
  cpiOldIndex: number | null;
  cpiNewIndex: number | null;
  referenceRateOld: string | null;
  referenceRateNew: string | null;
  calculationDetails: any;
  approvedAt: string | null;
  appliedAt: string | null;
  rejectedAt: string | null;
  rejectionReason: string | null;
  createdAt: string;
  updatedAt: string;
  lease: {
    id: string;
    tenantName: string;
    netRentChf: number;
    startDate: string;
    endDate: string | null;
    status: string;
    indexClauseType: string;
    cpiBaseIndex: number | null;
    initialNetRentChf: number | null;
    lastIndexationDate: string | null;
  };
}

function toDTO(adj: any): RentAdjustmentDTO {
  return {
    id: adj.id,
    orgId: adj.orgId,
    leaseId: adj.leaseId,
    adjustmentType: adj.adjustmentType,
    status: adj.status,
    effectiveDate: adj.effectiveDate.toISOString(),
    previousRentCents: adj.previousRentCents,
    newRentCents: adj.newRentCents,
    adjustmentCents: adj.adjustmentCents,
    cpiOldIndex: adj.cpiOldIndex ? Number(adj.cpiOldIndex) : null,
    cpiNewIndex: adj.cpiNewIndex ? Number(adj.cpiNewIndex) : null,
    referenceRateOld: adj.referenceRateOld,
    referenceRateNew: adj.referenceRateNew,
    calculationDetails: adj.calculationDetails,
    approvedAt: adj.approvedAt ? adj.approvedAt.toISOString() : null,
    appliedAt: adj.appliedAt ? adj.appliedAt.toISOString() : null,
    rejectedAt: adj.rejectedAt ? adj.rejectedAt.toISOString() : null,
    rejectionReason: adj.rejectionReason,
    createdAt: adj.createdAt.toISOString(),
    updatedAt: adj.updatedAt.toISOString(),
    lease: {
      id: adj.lease.id,
      tenantName: adj.lease.tenantName,
      netRentChf: adj.lease.netRentChf,
      startDate: (adj.lease.startDate as Date).toISOString(),
      endDate: adj.lease.endDate
        ? (adj.lease.endDate as Date).toISOString()
        : null,
      status: adj.lease.status,
      indexClauseType: adj.lease.indexClauseType,
      cpiBaseIndex: adj.lease.cpiBaseIndex ? Number(adj.lease.cpiBaseIndex) : null,
      initialNetRentChf: adj.lease.initialNetRentChf,
      lastIndexationDate: adj.lease.lastIndexationDate
        ? (adj.lease.lastIndexationDate as Date).toISOString()
        : null,
    },
  };
}

// ─── Routes ───────────────────────────────────────────────────

export function registerRentAdjustmentRoutes(router: Router) {
  // ── GET /rent-adjustments ───────────────────────────────────
  router.get(
    "/rent-adjustments",
    withAuthRequired(async ({ req, res, orgId, prisma, query }) => {
      if (!maybeRequireManager(req, res)) return;
      try {
        const statusFilter = first(query, "status") || undefined;
        const leaseIdFilter = first(query, "leaseId") || undefined;
        const typeFilter = first(query, "adjustmentType") || undefined;

        const list = await rentAdjustmentRepo.listRentAdjustments(
          prisma,
          orgId,
          { status: statusFilter, leaseId: leaseIdFilter, adjustmentType: typeFilter },
        );
        sendJson(res, 200, { data: list.map(toDTO) });
      } catch (err: any) {
        console.error("[rent-adjustments] list error:", err);
        sendError(res, 500, "INTERNAL_ERROR", err.message);
      }
    }),
  );

  // ── GET /rent-adjustments/:id ───────────────────────────────
  router.get(
    "/rent-adjustments/:id",
    withAuthRequired(async ({ req, res, orgId, prisma, params }) => {
      if (!maybeRequireManager(req, res)) return;
      try {
        const adj = await rentAdjustmentRepo.findById(prisma, params.id, orgId);
        if (!adj) {
          return sendError(res, 404, "NOT_FOUND", "Rent adjustment not found");
        }
        sendJson(res, 200, { data: toDTO(adj) });
      } catch (err: any) {
        console.error("[rent-adjustments] get error:", err);
        sendError(res, 500, "INTERNAL_ERROR", err.message);
      }
    }),
  );

  // ── POST /rent-adjustments/compute ──────────────────────────
  router.post(
    "/rent-adjustments/compute",
    withAuthRequired(async ({ req, res, orgId, prisma }) => {
      if (!requireRole(req, res, "MANAGER")) return;
      try {
        const body = await readJson(req);
        if (!body.leaseId || !body.cpiNewIndex || !body.effectiveDate) {
          return sendError(
            res,
            400,
            "BAD_REQUEST",
            "leaseId, cpiNewIndex, and effectiveDate are required",
          );
        }
        const adj = await rentAdjustmentService.computeIndexation(prisma, orgId, {
          leaseId: body.leaseId,
          cpiNewIndex: parseFloat(body.cpiNewIndex),
          effectiveDate: body.effectiveDate,
          referenceRateNew: body.referenceRateNew,
        });
        sendJson(res, 201, { data: toDTO(adj) });
      } catch (err: any) {
        console.error("[rent-adjustments] compute error:", err);
        sendError(res, 400, "COMPUTATION_ERROR", err.message);
      }
    }),
  );

  // ── POST /rent-adjustments/manual ───────────────────────────
  router.post(
    "/rent-adjustments/manual",
    withAuthRequired(async ({ req, res, orgId, prisma }) => {
      if (!requireRole(req, res, "MANAGER")) return;
      try {
        const body = await readJson(req);
        if (!body.leaseId || !body.newRentCents || !body.effectiveDate) {
          return sendError(
            res,
            400,
            "BAD_REQUEST",
            "leaseId, newRentCents, and effectiveDate are required",
          );
        }
        const adj = await rentAdjustmentService.createManualAdjustment(
          prisma,
          orgId,
          {
            leaseId: body.leaseId,
            newRentCents: parseInt(body.newRentCents, 10),
            effectiveDate: body.effectiveDate,
            reason: body.reason,
          },
        );
        sendJson(res, 201, { data: toDTO(adj) });
      } catch (err: any) {
        console.error("[rent-adjustments] manual error:", err);
        sendError(res, 400, "CREATION_ERROR", err.message);
      }
    }),
  );

  // ── POST /rent-adjustments/:id/approve ──────────────────────
  router.post(
    "/rent-adjustments/:id/approve",
    withAuthRequired(async ({ req, res, orgId, prisma, params }) => {
      if (!requireRole(req, res, "MANAGER")) return;
      try {
        const adj = await rentAdjustmentService.approveAdjustment(
          prisma,
          params.id,
          orgId,
        );
        sendJson(res, 200, { data: toDTO(adj) });
      } catch (err: any) {
        console.error("[rent-adjustments] approve error:", err);
        sendError(res, 400, "INVALID_STATE", err.message);
      }
    }),
  );

  // ── POST /rent-adjustments/:id/apply ────────────────────────
  router.post(
    "/rent-adjustments/:id/apply",
    withAuthRequired(async ({ req, res, orgId, prisma, params }) => {
      if (!requireRole(req, res, "MANAGER")) return;
      try {
        const adj = await rentAdjustmentService.applyAdjustment(
          prisma,
          params.id,
          orgId,
        );
        sendJson(res, 200, { data: toDTO(adj) });
      } catch (err: any) {
        console.error("[rent-adjustments] apply error:", err);
        sendError(res, 400, "INVALID_STATE", err.message);
      }
    }),
  );

  // ── POST /rent-adjustments/:id/reject ───────────────────────
  router.post(
    "/rent-adjustments/:id/reject",
    withAuthRequired(async ({ req, res, orgId, prisma, params }) => {
      if (!requireRole(req, res, "MANAGER")) return;
      try {
        const body = await readJson(req);
        const adj = await rentAdjustmentService.rejectAdjustment(
          prisma,
          params.id,
          orgId,
          body.reason,
        );
        sendJson(res, 200, { data: toDTO(adj) });
      } catch (err: any) {
        console.error("[rent-adjustments] reject error:", err);
        sendError(res, 400, "INVALID_STATE", err.message);
      }
    }),
  );

  // ── DELETE /rent-adjustments/:id ────────────────────────────
  router.delete(
    "/rent-adjustments/:id",
    withAuthRequired(async ({ req, res, orgId, prisma, params }) => {
      if (!requireRole(req, res, "MANAGER")) return;
      try {
        await rentAdjustmentService.deleteAdjustment(prisma, params.id, orgId);
        sendJson(res, 204, null);
      } catch (err: any) {
        console.error("[rent-adjustments] delete error:", err);
        sendError(res, 400, "DELETE_ERROR", err.message);
      }
    }),
  );
}
