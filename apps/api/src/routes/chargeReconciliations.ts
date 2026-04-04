/**
 * chargeReconciliations routes
 *
 * ACOMPTE year-end charge reconciliation for tenant leases.
 *
 * Endpoints:
 *   GET    /charge-reconciliations                 — list (filter by leaseId, fiscalYear, status)
 *   GET    /charge-reconciliations/:id             — single with lines
 *   POST   /charge-reconciliations                 — create for lease + year
 *   PUT    /charge-reconciliations/:id/lines/:lid  — update actual cost on a line
 *   POST   /charge-reconciliations/:id/finalize    — finalize (lock for settlement)
 *   POST   /charge-reconciliations/:id/settle      — generate settlement invoice
 *   POST   /charge-reconciliations/:id/reopen      — reopen FINALIZED back to DRAFT
 *   DELETE /charge-reconciliations/:id             — delete a DRAFT reconciliation
 */

import { Router } from "../http/router";
import { sendError, sendJson } from "../http/json";
import { first } from "../http/query";
import { maybeRequireManager, requireRole } from "../authz";
import { withAuthRequired } from "../http/routeProtection";
import { readJson } from "../http/body";
import * as reconRepo from "../repositories/chargeReconciliationRepository";
import * as reconService from "../services/chargeReconciliationService";

// ─── DTO ──────────────────────────────────────────────────────

export interface ChargeReconciliationLineDTO {
  id: string;
  description: string;
  chargeMode: string;
  acomptePaidCents: number;
  actualCostCents: number;
  balanceCents: number;
}

export interface ChargeReconciliationDTO {
  id: string;
  orgId: string;
  leaseId: string;
  fiscalYear: number;
  status: string;
  totalAcomptePaidCents: number;
  totalActualCostsCents: number;
  balanceCents: number;
  settlementInvoiceId: string | null;
  settledAt: string | null;
  createdAt: string;
  updatedAt: string;
  lineItems: ChargeReconciliationLineDTO[];
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
  settlementInvoice: {
    id: string;
    invoiceNumber: string | null;
    status: string;
    totalAmount: number;
    description: string;
  } | null;
}

function toDTO(r: any): ChargeReconciliationDTO {
  return {
    id: r.id,
    orgId: r.orgId,
    leaseId: r.leaseId,
    fiscalYear: r.fiscalYear,
    status: r.status,
    totalAcomptePaidCents: r.totalAcomptePaidCents,
    totalActualCostsCents: r.totalActualCostsCents,
    balanceCents: r.balanceCents,
    settlementInvoiceId: r.settlementInvoiceId,
    settledAt: r.settledAt ? r.settledAt.toISOString() : null,
    createdAt: r.createdAt.toISOString(),
    updatedAt: r.updatedAt.toISOString(),
    lineItems: (r.lineItems || []).map((l: any) => ({
      id: l.id,
      description: l.description,
      chargeMode: l.chargeMode,
      acomptePaidCents: l.acomptePaidCents,
      actualCostCents: l.actualCostCents,
      balanceCents: l.balanceCents,
    })),
    lease: r.lease
      ? {
          id: r.lease.id,
          tenantName: r.lease.tenantName,
          startDate: (r.lease.startDate as Date).toISOString(),
          endDate: r.lease.endDate
            ? (r.lease.endDate as Date).toISOString()
            : null,
          status: r.lease.status,
          netRentChf: r.lease.netRentChf ?? 0,
          chargesTotalChf: r.lease.chargesTotalChf ?? 0,
          unitId: r.lease.unitId,
        }
      : null,
    settlementInvoice: r.settlementInvoice
      ? {
          id: r.settlementInvoice.id,
          invoiceNumber: r.settlementInvoice.invoiceNumber,
          status: r.settlementInvoice.status,
          totalAmount: r.settlementInvoice.totalAmount,
          description: r.settlementInvoice.description,
        }
      : null,
  };
}

// ─── Routes ───────────────────────────────────────────────────

export function registerChargeReconciliationRoutes(router: Router) {
  // ── GET /charge-reconciliations ─────────────────────────────
  router.get(
    "/charge-reconciliations",
    withAuthRequired(async ({ req, res, orgId, prisma, query }) => {
      if (!maybeRequireManager(req, res)) return;
      try {
        const statusFilter = first(query, "status") as any;
        const leaseIdFilter = first(query, "leaseId") || undefined;
        const yearFilter = first(query, "fiscalYear");

        const list = await reconRepo.listReconciliations(prisma, orgId, {
          status: statusFilter || undefined,
          leaseId: leaseIdFilter,
          fiscalYear: yearFilter ? parseInt(yearFilter, 10) : undefined,
        });
        sendJson(res, 200, { data: list.map(toDTO) });
      } catch (err: any) {
        console.error("[charge-reconciliations] list error:", err);
        sendError(res, 500, "INTERNAL_ERROR", err.message);
      }
    }),
  );

  // ── GET /charge-reconciliations/:id ─────────────────────────
  router.get(
    "/charge-reconciliations/:id",
    withAuthRequired(async ({ req, res, orgId, prisma, params }) => {
      if (!maybeRequireManager(req, res)) return;
      try {
        const recon = await reconRepo.findById(prisma, params.id, orgId);
        if (!recon) {
          return sendError(res, 404, "NOT_FOUND", "Reconciliation not found");
        }
        sendJson(res, 200, toDTO(recon));
      } catch (err: any) {
        console.error("[charge-reconciliations] get error:", err);
        sendError(res, 500, "INTERNAL_ERROR", err.message);
      }
    }),
  );

  // ── POST /charge-reconciliations ────────────────────────────
  router.post(
    "/charge-reconciliations",
    withAuthRequired(async ({ req, res, orgId, prisma }) => {
      if (!requireRole(req, res, "MANAGER")) return;
      try {
        const body = await readJson(req);
        const { leaseId, fiscalYear } = body;
        if (!leaseId || !fiscalYear) {
          return sendError(res, 400, "BAD_REQUEST", "leaseId and fiscalYear are required");
        }
        const year = parseInt(fiscalYear, 10);
        if (isNaN(year) || year < 2000 || year > 2100) {
          return sendError(res, 400, "BAD_REQUEST", "Invalid fiscal year");
        }

        const recon = await reconService.createReconciliation(prisma, {
          orgId,
          leaseId,
          fiscalYear: year,
        });
        sendJson(res, 201, toDTO(recon));
      } catch (err: any) {
        console.error("[charge-reconciliations] create error:", err);
        if (err.message.includes("already exists")) {
          return sendError(res, 409, "CONFLICT", err.message);
        }
        sendError(res, 500, "INTERNAL_ERROR", err.message);
      }
    }),
  );

  // ── PUT /charge-reconciliations/:id/lines/:lid ──────────────
  router.put(
    "/charge-reconciliations/:id/lines/:lid",
    withAuthRequired(async ({ req, res, orgId, prisma, params }) => {
      if (!requireRole(req, res, "MANAGER")) return;
      try {
        const body = await readJson(req);
        const { actualCostCents } = body;
        if (actualCostCents === undefined || typeof actualCostCents !== "number") {
          return sendError(res, 400, "BAD_REQUEST", "actualCostCents (number) is required");
        }
        if (actualCostCents < 0) {
          return sendError(res, 400, "BAD_REQUEST", "actualCostCents must be ≥ 0");
        }

        await reconService.updateLineActualCost(
          prisma,
          params.id,
          params.lid,
          actualCostCents,
          orgId,
        );

        // Return the updated reconciliation
        const updated = await reconRepo.findById(prisma, params.id, orgId);
        sendJson(res, 200, toDTO(updated));
      } catch (err: any) {
        console.error("[charge-reconciliations] update-line error:", err);
        if (err.message.includes("not found")) {
          return sendError(res, 404, "NOT_FOUND", err.message);
        }
        if (err.message.includes("Cannot edit")) {
          return sendError(res, 409, "INVALID_STATE", err.message);
        }
        sendError(res, 500, "INTERNAL_ERROR", err.message);
      }
    }),
  );

  // ── POST /charge-reconciliations/:id/finalize ───────────────
  router.post(
    "/charge-reconciliations/:id/finalize",
    withAuthRequired(async ({ req, res, orgId, prisma, params }) => {
      if (!requireRole(req, res, "MANAGER")) return;
      try {
        const result = await reconService.finalizeReconciliation(
          prisma,
          params.id,
          orgId,
        );
        sendJson(res, 200, toDTO(result));
      } catch (err: any) {
        console.error("[charge-reconciliations] finalize error:", err);
        if (err.message.includes("not found")) {
          return sendError(res, 404, "NOT_FOUND", err.message);
        }
        if (err.message.includes("Cannot finalize") || err.message.includes("missing")) {
          return sendError(res, 409, "INVALID_STATE", err.message);
        }
        sendError(res, 500, "INTERNAL_ERROR", err.message);
      }
    }),
  );

  // ── POST /charge-reconciliations/:id/settle ─────────────────
  router.post(
    "/charge-reconciliations/:id/settle",
    withAuthRequired(async ({ req, res, orgId, prisma, params }) => {
      if (!requireRole(req, res, "MANAGER")) return;
      try {
        const result = await reconService.settleReconciliation(
          prisma,
          params.id,
          orgId,
        );
        sendJson(res, 200, toDTO(result));
      } catch (err: any) {
        console.error("[charge-reconciliations] settle error:", err);
        if (err.message.includes("not found")) {
          return sendError(res, 404, "NOT_FOUND", err.message);
        }
        if (err.message.includes("Cannot settle") || err.message.includes("must be FINALIZED")) {
          return sendError(res, 409, "INVALID_STATE", err.message);
        }
        sendError(res, 500, "INTERNAL_ERROR", err.message);
      }
    }),
  );

  // ── POST /charge-reconciliations/:id/reopen ─────────────────
  router.post(
    "/charge-reconciliations/:id/reopen",
    withAuthRequired(async ({ req, res, orgId, prisma, params }) => {
      if (!requireRole(req, res, "MANAGER")) return;
      try {
        const result = await reconService.reopenReconciliation(
          prisma,
          params.id,
          orgId,
        );
        sendJson(res, 200, toDTO(result));
      } catch (err: any) {
        console.error("[charge-reconciliations] reopen error:", err);
        if (err.message.includes("not found")) {
          return sendError(res, 404, "NOT_FOUND", err.message);
        }
        if (err.message.includes("Cannot reopen")) {
          return sendError(res, 409, "INVALID_STATE", err.message);
        }
        sendError(res, 500, "INTERNAL_ERROR", err.message);
      }
    }),
  );

  // ── DELETE /charge-reconciliations/:id ──────────────────────
  router.delete(
    "/charge-reconciliations/:id",
    withAuthRequired(async ({ req, res, orgId, prisma, params }) => {
      if (!requireRole(req, res, "MANAGER")) return;
      try {
        const existing = await reconRepo.findById(prisma, params.id, orgId);
        if (!existing) {
          return sendError(res, 404, "NOT_FOUND", "Reconciliation not found");
        }
        if (existing.status !== "DRAFT") {
          return sendError(
            res,
            409,
            "INVALID_STATE",
            `Cannot delete a ${existing.status} reconciliation`,
          );
        }
        await reconRepo.deleteReconciliation(prisma, params.id);
        sendJson(res, 200, { success: true });
      } catch (err: any) {
        console.error("[charge-reconciliations] delete error:", err);
        sendError(res, 500, "INTERNAL_ERROR", err.message);
      }
    }),
  );
}
