import { Router } from "../http/router";
import { sendError, sendJson } from "../http/json";
import { readJson } from "../http/body";
import { first, getIntParam } from "../http/query";
import { requireOrgViewer } from "./helpers";
import { createLease, listLeases, getLease, updateLease, markLeaseReadyToSign, cancelLease, storeLeasePdfReference, storeSignedPdfReference, confirmDeposit, activateLease, terminateLease, archiveLease, createLeaseInvoice, listLeaseInvoices } from "../services/leases";
import { createSignatureRequest, listSignatureRequests, getSignatureRequest, sendSignatureRequest, markSignatureRequestSigned } from "../services/signatureRequests";
import { generateLeasePDF } from "../services/leasePDFRenderer";
import { CreateLeaseSchema, UpdateLeaseSchema, ReadyToSignSchema } from "../validation/leases";

export function registerLeaseRoutes(router: Router) {
  // GET /leases
  router.get("/leases", async ({ req, res, query, orgId }) => {
    if (!requireOrgViewer(req, res)) return;
    try {
      const status = first(query, "status") || undefined;
      const unitId = first(query, "unitId") || undefined;
      const applicationId = first(query, "applicationId") || undefined;
      const limit = getIntParam(query, "limit", { defaultValue: 50, min: 1, max: 200 });
      const offset = getIntParam(query, "offset", { defaultValue: 0, min: 0 });
      const leases = await listLeases(orgId, { status, unitId, applicationId, limit, offset });
      sendJson(res, 200, { data: leases });
    } catch (e) {
      sendError(res, 500, "DB_ERROR", "Failed to list leases", String(e));
    }
  });

  // POST /leases
  router.post("/leases", async ({ req, res, orgId }) => {
    if (!requireOrgViewer(req, res)) return;
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
    if (!requireOrgViewer(req, res)) return;
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
    if (!requireOrgViewer(req, res)) return;
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
  router.post("/leases/:id/ready-to-sign", async ({ req, res, params, orgId }) => {
    if (!requireOrgViewer(req, res)) return;
    try {
      const raw = await readJson(req);
      const parsed = ReadyToSignSchema.safeParse(raw);
      if (!parsed.success) return sendError(res, 400, "VALIDATION_ERROR", "Invalid data", parsed.error.flatten());
      const lease = await markLeaseReadyToSign(params.id, orgId);
      const sigReq = await createSignatureRequest({
        orgId,
        leaseId: params.id,
        level: parsed.data.level as any,
        signers: parsed.data.signers,
      });
      sendJson(res, 200, { data: { lease, signatureRequest: sigReq } });
    } catch (e: any) {
      const msg = String(e?.message || e);
      if (msg === "Invalid JSON") return sendError(res, 400, "INVALID_JSON", "Invalid JSON");
      if (msg === "Body too large") return sendError(res, 413, "BODY_TOO_LARGE", "Request body too large");
      if (e.message?.includes("not found")) return sendError(res, 404, "NOT_FOUND", e.message);
      if (e.message?.includes("Only DRAFT")) return sendError(res, 409, "CONFLICT", e.message);
      sendError(res, 500, "DB_ERROR", "Failed to mark lease ready to sign", String(e));
    }
  });

  // POST /leases/:id/cancel
  router.post("/leases/:id/cancel", async ({ req, res, params, orgId }) => {
    if (!requireOrgViewer(req, res)) return;
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
    if (!requireOrgViewer(req, res)) return;
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
    if (!requireOrgViewer(req, res)) return;
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
  router.post("/leases/:id/activate", async ({ req, res, params, orgId }) => {
    if (!requireOrgViewer(req, res)) return;
    try {
      const lease = await activateLease(params.id, orgId);
      sendJson(res, 200, { data: lease });
    } catch (e: any) {
      if (e.message?.includes("not found")) return sendError(res, 404, "NOT_FOUND", e.message);
      if (e.message?.includes("Only SIGNED")) return sendError(res, 409, "CONFLICT", e.message);
      sendError(res, 500, "DB_ERROR", "Failed to activate lease", String(e));
    }
  });

  // POST /leases/:id/terminate
  router.post("/leases/:id/terminate", async ({ req, res, params, orgId }) => {
    if (!requireOrgViewer(req, res)) return;
    try {
      const raw = await readJson(req);
      if (!raw?.reason) return sendError(res, 400, "VALIDATION_ERROR", "reason is required");
      const lease = await terminateLease(params.id, orgId, raw);
      sendJson(res, 200, { data: lease });
    } catch (e: any) {
      const msg = String(e?.message || e);
      if (msg === "Invalid JSON") return sendError(res, 400, "INVALID_JSON", "Invalid JSON");
      if (msg === "Body too large") return sendError(res, 413, "BODY_TOO_LARGE", "Request body too large");
      if (e.message?.includes("not found")) return sendError(res, 404, "NOT_FOUND", e.message);
      if (e.message?.includes("Only ACTIVE")) return sendError(res, 409, "CONFLICT", e.message);
      sendError(res, 500, "DB_ERROR", "Failed to terminate lease", String(e));
    }
  });

  // POST /leases/:id/archive
  router.post("/leases/:id/archive", async ({ req, res, params, orgId }) => {
    if (!requireOrgViewer(req, res)) return;
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
    if (!requireOrgViewer(req, res)) return;
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
    if (!requireOrgViewer(req, res)) return;
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
    if (!requireOrgViewer(req, res)) return;
    try {
      const sr = await markSignatureRequestSigned(params.id, orgId);
      sendJson(res, 200, { data: sr });
    } catch (e: any) {
      if (e.message?.includes("not found")) return sendError(res, 404, "NOT_FOUND", e.message);
      if (e.message?.includes("Only SENT")) return sendError(res, 409, "CONFLICT", e.message);
      sendError(res, 500, "DB_ERROR", "Failed to mark signature request as signed", String(e));
    }
  });
}
