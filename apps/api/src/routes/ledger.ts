/**
 * Ledger Routes
 *
 * Read-only journal endpoints for the general ledger view.
 * Mutations happen automatically via workflow hooks (invoice issued/paid).
 *
 * Routes:
 *   GET  /ledger                              — paginated journal (filtered)
 *   GET  /ledger/trial-balance                — all accounts with debit/credit totals
 *   GET  /ledger/accounts/:accountId/balance  — balance for a single account
 *   POST /ledger/backfill                     — seed COA + post historical invoice entries
 *
 * Auth: MANAGER or OWNER only.
 */

import { Router } from "../http/router";
import { sendError, sendJson } from "../http/json";
import { readJson } from "../http/body";
import { parseQuery, first, getIntParam } from "../http/query";
import { requireAuth, requireAnyRole } from "../authz";
import { requireOrgViewer } from "./helpers";
import {
  listLedgerEntries,
  getAccountBalance,
  getTrialBalance,
  postInvoiceIssued,
  postInvoicePaid,
  getDraftInvoiceIds,
  getUnpostedIssuedInvoiceIds,
  getUnpostedPaidInvoiceIds,
} from "../services/ledgerService";
import { getInvoice } from "../services/invoices";
import { seedSwissTaxonomy } from "../services/coaService";
import { issueInvoiceWorkflow } from "../workflows/issueInvoiceWorkflow";

export function registerLedgerRoutes(router: Router) {
  /* ── GET /ledger ──────────────────────────────────────────── */
  router.get("/ledger", async ({ req, res, orgId, prisma }) => {
    if (!requireAuth(req, res)) return;
    if (!requireOrgViewer(req, res)) return;

    const { query } = parseQuery(req.url);

    const filters = {
      accountId:   first(query, "accountId"),
      accountCode: first(query, "accountCode"),
      buildingId:  first(query, "buildingId"),
      unitId:      first(query, "unitId"),
      sourceType:  first(query, "sourceType"),
      from:        first(query, "from"),
      to:          first(query, "to"),
      limit:       getIntParam(query, "limit",  { defaultValue: 50,  min: 1, max: 200 }),
      offset:      getIntParam(query, "offset", { defaultValue: 0,   min: 0 }),
    };

    try {
      const result = await listLedgerEntries(prisma, orgId, filters);
      sendJson(res, 200, {
        data: result.data,
        pagination: { total: result.total, limit: filters.limit, offset: filters.offset },
      });
    } catch (e: any) {
      console.error("[GET /ledger]", e);
      sendError(res, 500, "INTERNAL_ERROR", "Failed to load ledger");
    }
  });

  /* ── GET /ledger/trial-balance ────────────────────────────── */
  router.get("/ledger/trial-balance", async ({ req, res, orgId, prisma }) => {
    if (!requireAuth(req, res)) return;
    if (!requireOrgViewer(req, res)) return;

    const { query } = parseQuery(req.url);
    const fromStr = first(query, "from");
    const toStr   = first(query, "to");
    const periodFilter =
      fromStr || toStr
        ? { from: fromStr ? new Date(fromStr) : undefined, to: toStr ? new Date(toStr) : undefined }
        : undefined;

    try {
      const data = await getTrialBalance(prisma, orgId, periodFilter);
      sendJson(res, 200, { data });
    } catch (e: any) {
      console.error("[GET /ledger/trial-balance]", e);
      sendError(res, 500, "INTERNAL_ERROR", "Failed to load trial balance");
    }
  });

  /* ── GET /ledger/accounts/:accountId/balance ──────────────── */
  router.get("/ledger/accounts/:accountId/balance", async ({ req, res, params, orgId, prisma }) => {
    if (!requireAuth(req, res)) return;
    if (!requireOrgViewer(req, res)) return;

    const { query } = parseQuery(req.url);
    const fromStr = first(query, "from");
    const toStr   = first(query, "to");
    const periodFilter =
      fromStr || toStr
        ? { from: fromStr ? new Date(fromStr) : undefined, to: toStr ? new Date(toStr) : undefined }
        : undefined;

    try {
      const data = await getAccountBalance(prisma, orgId, params.accountId, periodFilter);
      if (!data) {
        sendError(res, 404, "NOT_FOUND", "Account not found");
        return;
      }
      sendJson(res, 200, { data });
    } catch (e: any) {
      console.error("[GET /ledger/accounts/:accountId/balance]", e);
      sendError(res, 500, "INTERNAL_ERROR", "Failed to load account balance");
    }
  });

  /* ── POST /ledger/backfill ─────────────────────────────────── */
  router.post("/ledger/backfill", async ({ req, res, orgId, prisma }) => {
    if (!requireAuth(req, res)) return;
    if (!requireAnyRole(req, res, ["MANAGER", "OWNER"])) return;

    let body: any = {};
    try { body = await readJson(req); } catch { /* body is optional */ }
    const seedCoa    = body?.seedCoa    === true;
    const issueDrafts = body?.issueDrafts !== false; // default true

    try {
      // ── 1. Optionally seed Chart of Accounts ───────────────
      let coaAccounts = 0;
      if (seedCoa) {
        const result = await seedSwissTaxonomy(prisma, orgId);
        coaAccounts = result.accounts;
      }

      // ── 2. Issue DRAFT invoices (fires postInvoiceIssued inside workflow) ──
      let invoicesIssued = 0, invoicesIssuedErrors = 0;
      if (issueDrafts) {
        const draftIds = await getDraftInvoiceIds(prisma, orgId);
        for (const invId of draftIds) {
          try {
            await issueInvoiceWorkflow(
              { orgId, prisma, actorUserId: null },
              { invoiceId: invId },
            );
            invoicesIssued++;
          } catch (e: any) {
            // Missing billing entity, already issued, etc. — skip gracefully
            console.warn(`[BACKFILL] Skipping DRAFT invoice ${invId}: ${e.message}`);
            invoicesIssuedErrors++;
          }
        }
      }

      // ── 3. Backfill INVOICE_ISSUED for already-issued invoices ──
      const unpostedIssuedIds = await getUnpostedIssuedInvoiceIds(prisma, orgId);
      let ledgerIssuedPosted = 0, ledgerIssuedSkipped = 0;
      for (const invId of unpostedIssuedIds) {
        const dto = await getInvoice(invId);
        if (!dto) { ledgerIssuedSkipped++; continue; }
        const result = await postInvoiceIssued(prisma, orgId, dto);
        if (result) ledgerIssuedPosted++; else ledgerIssuedSkipped++;
      }

      // ── 4. Backfill INVOICE_PAID for paid invoices ─────────
      const unpostedPaidIds = await getUnpostedPaidInvoiceIds(prisma, orgId);
      let ledgerPaidPosted = 0, ledgerPaidSkipped = 0;
      for (const invId of unpostedPaidIds) {
        const dto = await getInvoice(invId);
        if (!dto) { ledgerPaidSkipped++; continue; }
        const result = await postInvoicePaid(prisma, orgId, dto);
        if (result) ledgerPaidPosted++; else ledgerPaidSkipped++;
      }

      sendJson(res, 200, {
        data: {
          coaSeeded: seedCoa,
          coaAccounts,
          invoicesIssued,
          invoicesIssuedErrors,
          ledgerIssuedPosted,
          ledgerIssuedSkipped,
          ledgerPaidPosted,
          ledgerPaidSkipped,
        },
      });
    } catch (e: any) {
      console.error("[POST /ledger/backfill]", e);
      sendError(res, 500, "INTERNAL_ERROR", "Backfill failed");
    }
  });
}
