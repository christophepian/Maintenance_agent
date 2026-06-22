/**
 * creditNotes routes
 *
 * Read access to credit notes (avoirs). Credit notes are created by the system
 * (e.g. charge-reconciliation refunds), so there is no manual POST here.
 *
 * Endpoints:
 *   GET /credit-notes        — list (?leaseId=)
 *   GET /credit-notes/:id    — single with line items
 */

import { Router } from "../http/router";
import { sendError, sendJson } from "../http/json";
import { first } from "../http/query";
import { maybeRequireManager } from "../authz";
import { withAuthRequired } from "../http/routeProtection";
import * as creditNoteService from "../services/creditNoteService";

export function registerCreditNoteRoutes(router: Router) {
  router.get(
    "/credit-notes",
    withAuthRequired(async ({ req, res, orgId, query }) => {
      if (!maybeRequireManager(req, res)) return;
      try {
        const leaseId = first(query, "leaseId") || undefined;
        sendJson(res, 200, { data: await creditNoteService.listCreditNotes(orgId, leaseId) });
      } catch (err: any) {
        console.error("[credit-notes] list error:", err);
        sendError(res, 500, "INTERNAL_ERROR", err.message);
      }
    }),
  );

  router.get(
    "/credit-notes/:id",
    withAuthRequired(async ({ req, res, orgId, params }) => {
      if (!maybeRequireManager(req, res)) return;
      try {
        const dto = await creditNoteService.getCreditNote(orgId, params.id);
        if (!dto) return sendError(res, 404, "NOT_FOUND", "Credit note not found");
        sendJson(res, 200, { data: dto });
      } catch (err: any) {
        console.error("[credit-notes] get error:", err);
        sendError(res, 500, "INTERNAL_ERROR", err.message);
      }
    }),
  );
}
