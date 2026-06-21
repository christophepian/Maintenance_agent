/**
 * mortgages routes — building debt + valuation entry.
 *
 * Feeds the levered (FCFE) NPV layer: LTV, DSCR, WACC, equity IRR.
 * All mutating endpoints require MANAGER role; GETs allow manager/dev.
 *
 * Endpoints:
 *   GET    /buildings/:id/mortgages    — list mortgages + current valuation
 *   POST   /buildings/:id/mortgages    — add a mortgage
 *   PUT    /buildings/:id/valuation    — set market value
 *   PUT    /mortgages/:id              — update a mortgage
 *   DELETE /mortgages/:id              — remove a mortgage
 */

import { Router } from "../http/router";
import { sendError, sendJson } from "../http/json";
import { readJson } from "../http/body";
import { maybeRequireManager, requireRole } from "../authz";
import { withAuthRequired } from "../http/routeProtection";
import {
  listMortgagesByBuilding,
  findMortgageById,
  createMortgage,
  updateMortgage,
  deleteMortgage,
  findBuildingValuation,
  updateBuildingValuation,
  type MortgageWriteData,
} from "../repositories/mortgageRepository";
import {
  CreateMortgageSchema,
  UpdateMortgageSchema,
  UpdateValuationSchema,
} from "../validation/mortgages";

function toDate(v: string | null | undefined): Date | null | undefined {
  if (v === undefined) return undefined;
  if (v === null) return null;
  return new Date(v);
}

export function registerMortgageRoutes(router: Router) {

  // ── GET /buildings/:id/mortgages ─────────────────────────────
  router.get("/buildings/:id/mortgages", withAuthRequired(async ({ req, res, orgId, prisma, params }) => {
    if (!maybeRequireManager(req, res)) return;
    try {
      const valuation = await findBuildingValuation(prisma, orgId, params.id);
      if (!valuation) {
        sendError(res, 404, "NOT_FOUND", "Building not found");
        return;
      }
      const mortgages = await listMortgagesByBuilding(prisma, orgId, params.id);
      sendJson(res, 200, {
        data: {
          marketValueChf: valuation.marketValueChf,
          marketValueAt: valuation.marketValueAt,
          mortgages,
        },
      });
    } catch (e) {
      sendError(res, 500, "DB_ERROR", "Failed to list mortgages", String(e));
    }
  }));

  // ── POST /buildings/:id/mortgages ────────────────────────────
  router.post("/buildings/:id/mortgages", withAuthRequired(async ({ req, res, orgId, prisma, params }) => {
    if (!requireRole(req, res, "MANAGER")) return;
    try {
      const building = await findBuildingValuation(prisma, orgId, params.id);
      if (!building) {
        sendError(res, 404, "NOT_FOUND", "Building not found");
        return;
      }
      const parsed = CreateMortgageSchema.safeParse(await readJson(req));
      if (!parsed.success) {
        sendError(res, 400, "VALIDATION_ERROR", "Invalid mortgage data", parsed.error.flatten());
        return;
      }
      const d = parsed.data;
      const data: MortgageWriteData = {
        lenderName: d.lenderName ?? null,
        originalPrincipalChf: d.originalPrincipalChf,
        currentBalanceChf: d.currentBalanceChf,
        interestRatePct: d.interestRatePct,
        amortizationType: d.amortizationType,
        annualAmortizationChf: d.annualAmortizationChf ?? null,
        startDate: toDate(d.startDate) ?? null,
        fixedUntil: toDate(d.fixedUntil) ?? null,
        maturityDate: toDate(d.maturityDate) ?? null,
      };
      const mortgage = await createMortgage(prisma, orgId, params.id, data);
      sendJson(res, 201, { data: mortgage });
    } catch (e) {
      sendError(res, 500, "DB_ERROR", "Failed to create mortgage", String(e));
    }
  }));

  // ── PUT /buildings/:id/valuation ─────────────────────────────
  router.put("/buildings/:id/valuation", withAuthRequired(async ({ req, res, orgId, prisma, params }) => {
    if (!requireRole(req, res, "MANAGER")) return;
    try {
      const parsed = UpdateValuationSchema.safeParse(await readJson(req));
      if (!parsed.success) {
        sendError(res, 400, "VALIDATION_ERROR", "Invalid valuation data", parsed.error.flatten());
        return;
      }
      const ok = await updateBuildingValuation(prisma, orgId, params.id, parsed.data.marketValueChf ?? null);
      if (!ok) {
        sendError(res, 404, "NOT_FOUND", "Building not found");
        return;
      }
      const valuation = await findBuildingValuation(prisma, orgId, params.id);
      sendJson(res, 200, { data: valuation });
    } catch (e) {
      sendError(res, 500, "DB_ERROR", "Failed to update valuation", String(e));
    }
  }));

  // ── PUT /mortgages/:id ───────────────────────────────────────
  router.put("/mortgages/:id", withAuthRequired(async ({ req, res, orgId, prisma, params }) => {
    if (!requireRole(req, res, "MANAGER")) return;
    try {
      const existing = await findMortgageById(prisma, params.id, orgId);
      if (!existing) {
        sendError(res, 404, "NOT_FOUND", "Mortgage not found");
        return;
      }
      const parsed = UpdateMortgageSchema.safeParse(await readJson(req));
      if (!parsed.success) {
        sendError(res, 400, "VALIDATION_ERROR", "Invalid mortgage data", parsed.error.flatten());
        return;
      }
      const d = parsed.data;
      const data: Partial<MortgageWriteData> = {
        ...(d.lenderName !== undefined ? { lenderName: d.lenderName ?? null } : {}),
        ...(d.originalPrincipalChf !== undefined ? { originalPrincipalChf: d.originalPrincipalChf } : {}),
        ...(d.currentBalanceChf !== undefined ? { currentBalanceChf: d.currentBalanceChf } : {}),
        ...(d.interestRatePct !== undefined ? { interestRatePct: d.interestRatePct } : {}),
        ...(d.amortizationType !== undefined ? { amortizationType: d.amortizationType } : {}),
        ...(d.annualAmortizationChf !== undefined ? { annualAmortizationChf: d.annualAmortizationChf ?? null } : {}),
        ...(d.startDate !== undefined ? { startDate: toDate(d.startDate) } : {}),
        ...(d.fixedUntil !== undefined ? { fixedUntil: toDate(d.fixedUntil) } : {}),
        ...(d.maturityDate !== undefined ? { maturityDate: toDate(d.maturityDate) } : {}),
      };
      const mortgage = await updateMortgage(prisma, params.id, data);
      sendJson(res, 200, { data: mortgage });
    } catch (e) {
      sendError(res, 500, "DB_ERROR", "Failed to update mortgage", String(e));
    }
  }));

  // ── DELETE /mortgages/:id ────────────────────────────────────
  router.delete("/mortgages/:id", withAuthRequired(async ({ req, res, orgId, prisma, params }) => {
    if (!requireRole(req, res, "MANAGER")) return;
    try {
      const existing = await findMortgageById(prisma, params.id, orgId);
      if (!existing) {
        sendError(res, 404, "NOT_FOUND", "Mortgage not found");
        return;
      }
      await deleteMortgage(prisma, params.id);
      sendJson(res, 200, { message: "Mortgage deleted" });
    } catch (e) {
      sendError(res, 500, "DB_ERROR", "Failed to delete mortgage", String(e));
    }
  }));
}
