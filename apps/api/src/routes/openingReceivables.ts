/**
 * Opening Receivable Routes (accounting bridge WS-F)
 *
 *   GET  /opening-receivables?buildingId=     — items + control total + aging
 *   POST /opening-receivables                 — add a per-tenant opening item (MANAGER)
 *   POST /opening-receivables/:id/settle      — record collection, mark settled (MANAGER)
 */

import { Router } from "../http/router";
import { sendError, sendJson } from "../http/json";
import { readJson } from "../http/body";
import { parseQuery, first } from "../http/query";
import { requireAuth, requireAnyRole, getAuthUser } from "../authz";
import { requireOrgViewer } from "./helpers";
import {
  createOpeningReceivable,
  getOpeningReceivableReport,
  settleOpeningReceivable,
} from "../services/openingReceivableService";

export function registerOpeningReceivableRoutes(router: Router) {
  /* ── GET /opening-receivables ──────────────────────────────── */
  router.get("/opening-receivables", async ({ req, res, orgId, prisma }) => {
    if (!requireAuth(req, res)) return;
    if (!requireOrgViewer(req, res)) return;
    const { query } = parseQuery(req.url);
    const buildingId = first(query, "buildingId");
    if (!buildingId) return sendError(res, 400, "MISSING_PARAM", "buildingId is required");
    const data = await getOpeningReceivableReport(prisma, orgId, buildingId);
    sendJson(res, 200, { data });
  });

  /* ── POST /opening-receivables ─────────────────────────────── */
  router.post("/opening-receivables", async ({ req, res, orgId, prisma }) => {
    if (!requireAuth(req, res)) return;
    if (!requireAnyRole(req, res, ["MANAGER"])) return;
    const body = await readJson(req);
    const data = await createOpeningReceivable(prisma, orgId, {
      buildingId: body?.buildingId,
      unitId: body?.unitId ?? null,
      tenantName: body?.tenantName,
      amountCents: Number(body?.amountCents),
      dueDate: body?.dueDate ?? null,
    });
    sendJson(res, 201, { data });
  });

  /* ── POST /opening-receivables/:id/settle ──────────────────── */
  router.post("/opening-receivables/:id/settle", async ({ req, res, params, orgId, prisma }) => {
    if (!requireAuth(req, res)) return;
    if (!requireAnyRole(req, res, ["MANAGER"])) return;
    const userId = getAuthUser(req)?.userId ?? null;
    const data = await settleOpeningReceivable(prisma, orgId, params.id, userId);
    sendJson(res, 200, { data });
  });
}
