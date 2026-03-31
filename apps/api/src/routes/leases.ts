import { Router } from "../http/router";
import { sendError, sendJson } from "../http/json";
import { readJson } from "../http/body";
import { first, getIntParam } from "../http/query";
import { requireOrgViewer } from "./helpers";
import { requireRole } from "../authz";
import { createLease, listLeases, getLease, updateLease, cancelLease, storeLeasePdfReference, storeSignedPdfReference, confirmDeposit, archiveLease, handleLeaseExpiry, createLeaseInvoice, listLeaseInvoices, listLeaseTemplates, deleteLeaseTemplate, restoreLeaseTemplate, createLeaseTemplateFromLease, createBlankLeaseTemplate, createLeaseFromTemplate, createLeaseExpenseItem, updateLeaseExpenseItem, deleteLeaseExpenseItem } from "../services/leases";
import { createSignatureRequest, listSignatureRequests, getSignatureRequest, sendSignatureRequest, markSignatureRequestSigned } from "../services/signatureRequests";
import { generateLeasePDF } from "../services/leasePDFRenderer";
import { CreateLeaseSchema, UpdateLeaseSchema, ReadyToSignSchema, CreateExpenseItemSchema, UpdateExpenseItemSchema } from "../validation/leases";
import { findLeaseRaw } from "../repositories/leaseRepository";
import { activateLeaseWorkflow } from "../workflows/activateLeaseWorkflow";
import { terminateLeaseWorkflow } from "../workflows/terminateLeaseWorkflow";
import { markLeaseReadyWorkflow } from "../workflows/markLeaseReadyWorkflow";

export function registerLeaseRoutes(router: Router) {
  // GET /leases
  router.get("/leases", async ({ req, res, query, orgId }) => {
    if (!requireOrgViewer(req, res)) return;
    try {
      const status = first(query, "status") || undefined;
      const unitId = first(query, "unitId") || undefined;
      const applicationId = first(query, "applicationId") || undefined;
      const expenseTypeId = first(query, "expenseTypeId") || undefined;
      const startDateFrom = first(query, "startDateFrom") || undefined;
      const startDateTo = first(query, "startDateTo") || undefined;
      const endDateFrom = first(query, "endDateFrom") || undefined;
      const endDateTo = first(query, "endDateTo") || undefined;
      const limit = getIntParam(query, "limit", { defaultValue: 50, min: 1, max: 200 });
      const offset = getIntParam(query, "offset", { defaultValue: 0, min: 0 });
      const result = await listLeases(orgId, { status, unitId, applicationId, expenseTypeId, startDateFrom, startDateTo, endDateFrom, endDateTo, limit, offset });
      sendJson(res, 200, { data: result.data, total: result.total });
    } catch (e) {
      sendError(res, 500, "DB_ERROR", "Failed to list leases", String(e));
    }
  });

  // POST /leases
  router.post("/leases", async ({ req, res, orgId }) => {
    if (!requireRole(req, res, 'MANAGER')) return;
    try {
      const raw = await readJson(req);
      const parsed = CreateLeaseSchema.safeParse(raw);
      if (!parsed.success) return sendError(res, 400, "VALIDATION_ERROR", "Invalid lease data", parsed.error.flatten());
      const lease = await createLease(orgId, parsed.data);
      sendJson(res, 201, { data: lease });
    } catch (e: any) {
      if (e.message?.includes("not found")) return sendError(res, 404, "NOT_FOUND", e.message);
      sendError(res, 500, "DB_ERROR", "Failed to create lease", String(e));
    }
  });

  // GET /leases/:id
  router.get("/leases/:id", async ({ req, res, params, orgId }) => {
    if (!requireOrgViewer(req, res)) return;
    try {
      const lease = await getLease(params.id, orgId);
      if (!lease) return sendError(res, 404, "NOT_FOUND", "Lease not found");
      sendJson(res, 200, { data: lease });
    } catch (e) {
      sendError(res, 500, "DB_ERROR", "Failed to get lease", String(e));
    }
  });

  // PATCH /leases/:id
  router.patch("/leases/:id", async ({ req, res, params, orgId }) => {
    if (!requireRole(req, res, 'MANAGER')) return;
    try {
      const raw = await readJson(req);
      const parsed = UpdateLeaseSchema.safeParse(raw);
      if (!parsed.success) return sendError(res, 400, "VALIDATION_ERROR", "Invalid lease data", parsed.error.flatten());
      const lease = await updateLease(params.id, orgId, parsed.data);
      sendJson(res, 200, { data: lease });
    } catch (e: any) {
      if (e.message?.includes("not found")) return sendError(res, 404, "NOT_FOUND", e.message);
      if (e.message?.includes("Only DRAFT")) return sendError(res, 409, "CONFLICT", e.message);
      sendError(res, 500, "DB_ERROR", "Failed to update lease", String(e));
    }
  });

  // POST /leases/:id/generate-pdf
  router.post("/leases/:id/generate-pdf", async ({ req, res, params, orgId }) => {
    if (!requireRole(req, res, 'MANAGER')) return;
    try {
      const { buffer, sha256 } = await generateLeasePDF(params.id, orgId);
      const storageKey = `lease-pdf/${params.id}/${Date.now()}.pdf`;
      await storeLeasePdfReference(params.id, orgId, storageKey, sha256);
      res.writeHead(200, {
        "content-type": "application/pdf",
        "content-disposition": `attachment; filename="lease-${params.id.slice(0, 8)}.pdf"`,
        "content-length": buffer.length.toString(),
        "x-pdf-sha256": sha256,
        "x-storage-key": storageKey,
      });
      res.end(buffer);
    } catch (e: any) {
      if (res.headersSent) { res.end(); return; }
      if (e.message?.includes("not found")) return sendError(res, 404, "NOT_FOUND", e.message);
      sendError(res, 500, "PDF_ERROR", "Failed to generate lease PDF", String(e));
    }
  });

  // POST /leases/:id/ready-to-sign
  router.post("/leases/:id/ready-to-sign", async ({ req, res, params, orgId, prisma }) => {
    if (!requireRole(req, res, 'MANAGER')) return;
    try {
      const raw = await readJson(req);
      const parsed = ReadyToSignSchema.safeParse(raw);
      if (!parsed.success) return sendError(res, 400, "VALIDATION_ERROR", "Invalid data", parsed.error.flatten());

      // Workflow handles: validate, provision tenant, transition DRAFT → READY_TO_SIGN,
      // create SignatureRequest, immediately send it, and notify tenant.
      const { dto: lease, signatureRequest: sigReq } = await markLeaseReadyWorkflow(
        { orgId, prisma },
        { leaseId: params.id, level: parsed.data.level as any, signers: parsed.data.signers },
      );

      sendJson(res, 200, { data: { lease, signatureRequest: sigReq } });
    } catch (e: any) {
      const msg = String(e?.message || e);
      if (msg === "Invalid JSON") return sendError(res, 400, "INVALID_JSON", "Invalid JSON");
      if (msg === "Body too large") return sendError(res, 413, "BODY_TOO_LARGE", "Request body too large");
      if (e.message?.includes("not found")) return sendError(res, 404, "NOT_FOUND", e.message);
      if (e.message?.includes("Only DRAFT")) return sendError(res, 409, "CONFLICT", e.message);
      if (e.message?.includes("Tenant phone") || e.message?.includes("phone number format")) return sendError(res, 422, "VALIDATION_ERROR", e.message);
      sendError(res, 500, "DB_ERROR", "Failed to mark lease ready to sign", String(e));
    }
  });

  // POST /leases/:id/resend-for-signature
  // Remediation path for READY_TO_SIGN leases that have no SENT SignatureRequest.
  // Creates a new SignatureRequest and immediately sends it so sentForSignatureAt
  // is populated on the next GET /leases response. Safe to call multiple times —
  // listLeases picks the most-recent sentAt per lease.
  router.post("/leases/:id/resend-for-signature", async ({ req, res, params, orgId, prisma }) => {
    if (!requireRole(req, res, 'MANAGER')) return;
    try {
      const existing = await findLeaseRaw(prisma, params.id);
      if (!existing || existing.orgId !== orgId) return sendError(res, 404, "NOT_FOUND", "Lease not found");
      if (existing.status !== 'READY_TO_SIGN') return sendError(res, 409, "CONFLICT", "Only READY_TO_SIGN leases can be re-sent for signature");
      const draft = await createSignatureRequest({ orgId, leaseId: params.id });
      const sent = await sendSignatureRequest(draft.id, orgId);
      sendJson(res, 200, { data: sent });
    } catch (e: any) {
      if (e.message?.includes("not found")) return sendError(res, 404, "NOT_FOUND", e.message);
      sendError(res, 500, "DB_ERROR", "Failed to resend for signature", String(e));
    }
  });

  // POST /leases/:id/cancel
  router.post("/leases/:id/cancel", async ({ req, res, params, orgId }) => {
    if (!requireRole(req, res, 'MANAGER')) return;
    try {
      const lease = await cancelLease(params.id, orgId);
      sendJson(res, 200, { data: lease });
    } catch (e: any) {
      if (e.message?.includes("not found")) return sendError(res, 404, "NOT_FOUND", e.message);
      if (e.message?.includes("Cannot cancel")) return sendError(res, 409, "CONFLICT", e.message);
      sendError(res, 500, "DB_ERROR", "Failed to cancel lease", String(e));
    }
  });

  // POST /leases/:id/store-signed-pdf
  router.post("/leases/:id/store-signed-pdf", async ({ req, res, params, orgId }) => {
    if (!requireRole(req, res, 'MANAGER')) return;
    try {
      const raw = await readJson(req);
      if (!raw?.storageKey || !raw?.sha256) return sendError(res, 400, "VALIDATION_ERROR", "storageKey and sha256 are required");
      const lease = await storeSignedPdfReference(params.id, orgId, raw.storageKey, raw.sha256);
      sendJson(res, 200, { data: lease });
    } catch (e: any) {
      const msg = String(e?.message || e);
      if (msg === "Invalid JSON") return sendError(res, 400, "INVALID_JSON", "Invalid JSON");
      if (msg === "Body too large") return sendError(res, 413, "BODY_TOO_LARGE", "Request body too large");
      if (e.message?.includes("not found")) return sendError(res, 404, "NOT_FOUND", e.message);
      if (e.message?.includes("Only SIGNED")) return sendError(res, 409, "CONFLICT", e.message);
      sendError(res, 500, "DB_ERROR", "Failed to store signed PDF", String(e));
    }
  });

  // POST /leases/:id/confirm-deposit
  router.post("/leases/:id/confirm-deposit", async ({ req, res, params, orgId }) => {
    if (!requireRole(req, res, 'MANAGER')) return;
    try {
      const raw = await readJson(req);
      const lease = await confirmDeposit(params.id, orgId, raw || {});
      sendJson(res, 200, { data: lease });
    } catch (e: any) {
      const msg = String(e?.message || e);
      if (msg === "Invalid JSON") return sendError(res, 400, "INVALID_JSON", "Invalid JSON");
      if (msg === "Body too large") return sendError(res, 413, "BODY_TOO_LARGE", "Request body too large");
      if (e.message?.includes("not found")) return sendError(res, 404, "NOT_FOUND", e.message);
      if (e.message?.includes("already confirmed")) return sendError(res, 409, "CONFLICT", e.message);
      sendError(res, 500, "DB_ERROR", "Failed to confirm deposit", String(e));
    }
  });

  // POST /leases/:id/activate
  router.post("/leases/:id/activate", async ({ req, res, params, orgId, prisma }) => {
    if (!requireRole(req, res, 'MANAGER')) return;
    try {
      const { dto } = await activateLeaseWorkflow(
        { orgId, prisma },
        { leaseId: params.id },
      );
      sendJson(res, 200, { data: dto });
    } catch (e: any) {
      if (e.message?.includes("not found")) return sendError(res, 404, "NOT_FOUND", e.message);
      if (e.code === "INVALID_TRANSITION" || e.message?.includes("Only SIGNED")) return sendError(res, 409, "CONFLICT", e.message);
      sendError(res, 500, "DB_ERROR", "Failed to activate lease", String(e));
    }
  });

  // POST /leases/:id/terminate
  router.post("/leases/:id/terminate", async ({ req, res, params, orgId, prisma }) => {
    if (!requireRole(req, res, 'MANAGER')) return;
    try {
      const raw = await readJson(req);
      if (!raw?.reason) return sendError(res, 400, "VALIDATION_ERROR", "reason is required");
      const { dto } = await terminateLeaseWorkflow(
        { orgId, prisma },
        { leaseId: params.id, reason: raw.reason, notice: raw.notice },
      );
      sendJson(res, 200, { data: dto });
    } catch (e: any) {
      const msg = String(e?.message || e);
      if (msg === "Invalid JSON") return sendError(res, 400, "INVALID_JSON", "Invalid JSON");
      if (msg === "Body too large") return sendError(res, 413, "BODY_TOO_LARGE", "Request body too large");
      if (e.message?.includes("not found")) return sendError(res, 404, "NOT_FOUND", e.message);
      if (e.code === "INVALID_TRANSITION" || e.message?.includes("Only ACTIVE")) return sendError(res, 409, "CONFLICT", e.message);
      sendError(res, 500, "DB_ERROR", "Failed to terminate lease", String(e));
    }
  });

  // POST /leases/:id/archive
  router.post("/leases/:id/archive", async ({ req, res, params, orgId }) => {
    if (!requireRole(req, res, 'MANAGER')) return;
    try {
      const lease = await archiveLease(params.id, orgId);
      sendJson(res, 200, { data: lease });
    } catch (e: any) {
      if (e.message?.includes("not found")) return sendError(res, 404, "NOT_FOUND", e.message);
      if (e.message?.includes("already archived")) return sendError(res, 409, "CONFLICT", e.message);
      if (e.message?.includes("Only SIGNED")) return sendError(res, 409, "CONFLICT", e.message);
      sendError(res, 500, "DB_ERROR", "Failed to archive lease", String(e));
    }
  });

  // POST /leases/:id/handle-expiry
  router.post("/leases/:id/handle-expiry", async ({ req, res, params, orgId }) => {
    if (!requireRole(req, res, 'MANAGER')) return;
    try {
      const result = await handleLeaseExpiry(params.id, orgId);
      sendJson(res, 200, { data: result });
    } catch (e: any) {
      if (e.message?.includes("not found")) return sendError(res, 404, "NOT_FOUND", e.message);
      if (e.message?.includes("Only READY_TO_SIGN")) return sendError(res, 409, "CONFLICT", e.message);
      if (e.message?.includes("not yet expired")) return sendError(res, 422, "NOT_EXPIRED", e.message);
      sendError(res, 500, "DB_ERROR", "Failed to handle lease expiry", String(e));
    }
  });

  // GET /leases/:id/invoices
  router.get("/leases/:id/invoices", async ({ req, res, params, orgId }) => {
    if (!requireOrgViewer(req, res)) return;
    try {
      const invoices = await listLeaseInvoices(params.id, orgId);
      sendJson(res, 200, { data: invoices });
    } catch (e: any) {
      if (e.message?.includes("not found")) return sendError(res, 404, "NOT_FOUND", e.message);
      sendError(res, 500, "DB_ERROR", "Failed to list lease invoices", String(e));
    }
  });

  // POST /leases/:id/invoices
  router.post("/leases/:id/invoices", async ({ req, res, params, orgId }) => {
    if (!requireRole(req, res, 'MANAGER')) return;
    try {
      const raw = await readJson(req);
      if (!raw?.type || !raw?.amountChf) return sendError(res, 400, "VALIDATION_ERROR", "type and amountChf are required");
      const invoice = await createLeaseInvoice(params.id, orgId, raw);
      sendJson(res, 201, { data: invoice });
    } catch (e: any) {
      if (e.message?.includes("not found")) return sendError(res, 404, "NOT_FOUND", e.message);
      sendError(res, 500, "DB_ERROR", "Failed to create lease invoice", String(e));
    }
  });

  /* ── Signature Requests ────────────────────────────────────── */

  // GET /signature-requests
  router.get("/signature-requests", async ({ req, res, query, orgId }) => {
    if (!requireOrgViewer(req, res)) return;
    try {
      const entityType = first(query, "entityType") || undefined;
      const entityId = first(query, "entityId") || undefined;
      const status = first(query, "status") || undefined;
      const results = await listSignatureRequests(orgId, { entityType, entityId, status });
      sendJson(res, 200, { data: results });
    } catch (e) {
      sendError(res, 500, "DB_ERROR", "Failed to list signature requests", String(e));
    }
  });

  // GET /signature-requests/:id
  router.get("/signature-requests/:id", async ({ req, res, params, orgId }) => {
    if (!requireOrgViewer(req, res)) return;
    try {
      const sr = await getSignatureRequest(params.id, orgId);
      if (!sr) return sendError(res, 404, "NOT_FOUND", "Signature request not found");
      sendJson(res, 200, { data: sr });
    } catch (e) {
      sendError(res, 500, "DB_ERROR", "Failed to get signature request", String(e));
    }
  });

  // POST /signature-requests/:id/send
  router.post("/signature-requests/:id/send", async ({ req, res, params, orgId }) => {
    if (!requireRole(req, res, 'MANAGER')) return;
    try {
      const sr = await sendSignatureRequest(params.id, orgId);
      sendJson(res, 200, { data: sr });
    } catch (e: any) {
      if (e.message?.includes("not found")) return sendError(res, 404, "NOT_FOUND", e.message);
      if (e.message?.includes("Only DRAFT")) return sendError(res, 409, "CONFLICT", e.message);
      sendError(res, 500, "DB_ERROR", "Failed to send signature request", String(e));
    }
  });

  // POST /signature-requests/:id/mark-signed
  router.post("/signature-requests/:id/mark-signed", async ({ req, res, params, orgId }) => {
    if (!requireRole(req, res, 'MANAGER')) return;
    try {
      const sr = await markSignatureRequestSigned(params.id, orgId);
      sendJson(res, 200, { data: sr });
    } catch (e: any) {
      if (e.message?.includes("not found")) return sendError(res, 404, "NOT_FOUND", e.message);
      if (e.message?.includes("Only SENT")) return sendError(res, 409, "CONFLICT", e.message);
      sendError(res, 500, "DB_ERROR", "Failed to mark signature request as signed", String(e));
    }
  });

  /* ── Lease Templates (Rental Pipeline) ────────────────────── */

  // GET /lease-templates?buildingId=...
  router.get("/lease-templates", async ({ req, res, query, orgId }) => {
    if (!requireOrgViewer(req, res)) return;
    try {
      const buildingId = first(query, "buildingId") || undefined;
      const templates = await listLeaseTemplates(orgId, buildingId);
      sendJson(res, 200, { data: templates, total: templates.length });
    } catch (e) {
      sendError(res, 500, "DB_ERROR", "Failed to list lease templates", String(e));
    }
  });

  // POST /lease-templates (create blank template from scratch)
  router.post("/lease-templates", async ({ req, res, orgId }) => {
    if (!requireRole(req, res, 'MANAGER')) return;
    try {
      const body = await readJson(req);
      if (!body.buildingId || !body.landlordName || !body.landlordAddress || !body.landlordZipCity) {
        return sendError(res, 400, "VALIDATION_ERROR", "buildingId, landlordName, landlordAddress, and landlordZipCity are required");
      }
      const template = await createBlankLeaseTemplate(orgId, body.buildingId, {
        templateName: body.templateName,
        landlordName: body.landlordName,
        landlordAddress: body.landlordAddress,
        landlordZipCity: body.landlordZipCity,
        landlordPhone: body.landlordPhone,
        landlordEmail: body.landlordEmail,
        objectType: body.objectType,
        roomsCount: body.roomsCount,
        noticeRule: body.noticeRule,
        paymentDueDayOfMonth: body.paymentDueDayOfMonth,
        paymentIban: body.paymentIban,
        referenceRatePercent: body.referenceRatePercent,
        depositDueRule: body.depositDueRule,
        netRentChf: body.netRentChf,
        chargesTotalChf: body.chargesTotalChf,
        includesHouseRules: body.includesHouseRules,
      });
      sendJson(res, 201, { data: template });
    } catch (e: any) {
      const msg = String(e?.message || e);
      if (msg === "Invalid JSON") return sendError(res, 400, "INVALID_JSON", "Invalid JSON");
      if (msg === "Body too large") return sendError(res, 413, "BODY_TOO_LARGE", "Request body too large");
      if (e.message?.includes("not found")) return sendError(res, 404, "NOT_FOUND", e.message);
      if (e.message?.includes("no units")) return sendError(res, 400, "BAD_REQUEST", e.message);
      sendError(res, 500, "DB_ERROR", "Failed to create lease template", String(e));
    }
  });

  // POST /lease-templates/from-lease
  router.post("/lease-templates/from-lease", async ({ req, res, orgId }) => {
    if (!requireRole(req, res, 'MANAGER')) return;
    try {
      const body = await readJson(req);
      if (!body.leaseId || !body.templateName) {
        return sendError(res, 400, "VALIDATION_ERROR", "leaseId and templateName are required");
      }
      const template = await createLeaseTemplateFromLease(
        body.leaseId,
        orgId,
        body.templateName,
        body.buildingId,
      );
      sendJson(res, 201, { data: template });
    } catch (e: any) {
      if (e.message?.includes("not found")) return sendError(res, 404, "NOT_FOUND", e.message);
      sendError(res, 500, "DB_ERROR", "Failed to create lease template", String(e));
    }
  });

  // DELETE /lease-templates/:id
  router.delete("/lease-templates/:id", async ({ req, res, params, orgId }) => {
    if (!requireRole(req, res, 'MANAGER')) return;
    try {
      await deleteLeaseTemplate(params.id, orgId);
      sendJson(res, 200, { ok: true });
    } catch (e: any) {
      if (e.message?.includes("not found")) return sendError(res, 404, "NOT_FOUND", e.message);
      if (e.message?.includes("not a template")) return sendError(res, 400, "BAD_REQUEST", e.message);
      sendError(res, 500, "DB_ERROR", "Failed to delete lease template", String(e));
    }
  });

  // POST /lease-templates/:id/restore
  router.post("/lease-templates/:id/restore", async ({ req, res, params, orgId }) => {
    if (!requireRole(req, res, 'MANAGER')) return;
    try {
      await restoreLeaseTemplate(params.id, orgId);
      sendJson(res, 200, { ok: true });
    } catch (e: any) {
      if (e.message?.includes("not found")) return sendError(res, 404, "NOT_FOUND", e.message);
      if (e.message?.includes("not deleted")) return sendError(res, 400, "BAD_REQUEST", e.message);
      sendError(res, 500, "DB_ERROR", "Failed to restore lease template", String(e));
    }
  });

  // POST /lease-templates/:id/create-lease
  router.post("/lease-templates/:id/create-lease", async ({ req, res, params, orgId }) => {
    if (!requireRole(req, res, 'MANAGER')) return;
    try {
      const body = await readJson(req);
      if (!body.unitId || !body.tenantName) {
        return sendError(res, 400, "VALIDATION_ERROR", "unitId and tenantName are required");
      }
      const lease = await createLeaseFromTemplate(params.id, orgId, body.unitId, {
        tenantName: body.tenantName,
        tenantAddress: body.tenantAddress,
        tenantZipCity: body.tenantZipCity,
        tenantPhone: body.tenantPhone,
        tenantEmail: body.tenantEmail,
        coTenantName: body.coTenantName,
        applicationId: body.applicationId,
        startDate: body.startDate,
        netRentChf: body.netRentChf,
      });
      sendJson(res, 201, { data: lease });
    } catch (e: any) {
      if (e.message?.includes("not found")) return sendError(res, 404, "NOT_FOUND", e.message);
      if (e.message?.includes("not a template")) return sendError(res, 400, "BAD_REQUEST", e.message);
      sendError(res, 500, "DB_ERROR", "Failed to create lease from template", String(e));
    }
  });

  // ─── LeaseExpenseItem CRUD ──────────────────────────────

  // POST /leases/:id/expense-items
  router.post("/leases/:id/expense-items", async ({ req, res, params, orgId }) => {
    if (!requireRole(req, res, 'MANAGER')) return;
    try {
      const body = await readJson(req);
      const parsed = CreateExpenseItemSchema.safeParse(body);
      if (!parsed.success) {
        return sendError(res, 400, "VALIDATION_ERROR", parsed.error.issues.map(i => i.message).join("; "));
      }
      const item = await createLeaseExpenseItem(orgId, params.id, parsed.data);
      sendJson(res, 201, { data: item });
    } catch (e: any) {
      if (e.message?.includes("not found")) return sendError(res, 404, "NOT_FOUND", e.message);
      sendError(res, 500, "DB_ERROR", "Failed to create expense item", String(e));
    }
  });

  // PATCH /leases/:id/expense-items/:itemId
  router.patch("/leases/:id/expense-items/:itemId", async ({ req, res, params, orgId }) => {
    if (!requireRole(req, res, 'MANAGER')) return;
    try {
      const body = await readJson(req);
      const parsed = UpdateExpenseItemSchema.safeParse(body);
      if (!parsed.success) {
        return sendError(res, 400, "VALIDATION_ERROR", parsed.error.issues.map(i => i.message).join("; "));
      }
      const item = await updateLeaseExpenseItem(orgId, params.id, params.itemId, parsed.data);
      sendJson(res, 200, { data: item });
    } catch (e: any) {
      if (e.message?.includes("not found")) return sendError(res, 404, "NOT_FOUND", e.message);
      sendError(res, 500, "DB_ERROR", "Failed to update expense item", String(e));
    }
  });

  // DELETE /leases/:id/expense-items/:itemId
  router.delete("/leases/:id/expense-items/:itemId", async ({ req, res, params, orgId }) => {
    if (!requireRole(req, res, 'MANAGER')) return;
    try {
      await deleteLeaseExpenseItem(orgId, params.id, params.itemId);
      sendJson(res, 200, { data: { success: true } });
    } catch (e: any) {
      if (e.message?.includes("not found")) return sendError(res, 404, "NOT_FOUND", e.message);
      sendError(res, 500, "DB_ERROR", "Failed to delete expense item", String(e));
    }
  });
}
