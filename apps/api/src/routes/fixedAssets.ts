/**
 * Fixed Asset Routes (accounting bridge WS-D)
 *
 *   GET  /fixed-assets?buildingId=        — capitalized-asset register
 *   POST /fixed-assets/run-depreciation   — post straight-line depreciation due (MANAGER)
 */

import { Router } from "../http/router";
import { sendError, sendJson } from "../http/json";
import { readJson } from "../http/body";
import { parseQuery, first } from "../http/query";
import { requireAuth, requireAnyRole } from "../authz";
import { requireOrgViewer } from "./helpers";
import { listFixedAssets, runDepreciation } from "../services/fixedAssetService";

export function registerFixedAssetRoutes(router: Router) {
  /* ── GET /fixed-assets ─────────────────────────────────────── */
  router.get("/fixed-assets", async ({ req, res, orgId, prisma }) => {
    if (!requireAuth(req, res)) return;
    if (!requireOrgViewer(req, res)) return;
    const { query } = parseQuery(req.url);
    const buildingId = first(query, "buildingId");
    const data = await listFixedAssets(prisma, orgId, buildingId);
    sendJson(res, 200, { data });
  });

  /* ── POST /fixed-assets/run-depreciation ───────────────────── */
  router.post("/fixed-assets/run-depreciation", async ({ req, res, orgId, prisma }) => {
    if (!requireAuth(req, res)) return;
    if (!requireAnyRole(req, res, ["MANAGER"])) return;
    let body: { asOf?: string } = {};
    try { body = await readJson(req); } catch { /* body optional */ }
    const asOf = body?.asOf ? new Date(body.asOf) : new Date();
    if (isNaN(asOf.getTime())) return sendError(res, 400, "VALIDATION_ERROR", "Invalid asOf date");
    const data = await runDepreciation(prisma, orgId, asOf);
    sendJson(res, 200, { data });
  });
}
