import { Router, HandlerContext } from "../http/router";
import { sendError, sendJson } from "../http/json";
import { readJson } from "../http/body";
import { first } from "../http/query";
import { getAuthUser } from "../authz";
import { requireOrgViewer, logEvent } from "./helpers";
import { requireAnyRole } from "../authz";
import { getJob, listJobs } from "../services/jobs";
import { createInvoice, getInvoice, listInvoices, getOrCreateInvoiceForJob } from "../services/invoices";
import { CreateInvoiceSchema } from "../validation/invoices";
import { generateInvoiceQRBill, getInvoiceQRCodePNG } from "../services/invoiceQRBill";
import { generateInvoicePDF } from "../services/invoicePDF";
import { completeJobWorkflow } from "../workflows/completeJobWorkflow";
import { updateJobWorkflow } from "../workflows/updateJobWorkflow";
import { issueInvoiceWorkflow } from "../workflows/issueInvoiceWorkflow";
import { approveInvoiceWorkflow } from "../workflows/approveInvoiceWorkflow";
import { payInvoiceWorkflow } from "../workflows/payInvoiceWorkflow";
import { disputeInvoiceWorkflow } from "../workflows/disputeInvoiceWorkflow";
import { InvalidTransitionError } from "../workflows/transitions";
import { ingestInvoice } from "../services/invoiceIngestionService";
import { readRawBody, parseMultipart, MAX_FILE_SIZE } from "../storage/attachments";
import { InvoiceSourceChannel, InvoiceDirection } from "@prisma/client";

export function registerInvoiceRoutes(router: Router) {
  // GET /jobs
  router.get("/jobs", async ({ req, res, query, orgId }) => {
    if (!requireOrgViewer(req, res)) return;
    try {
      const contractorId = first(query, "contractorId") || undefined;
      const status = first(query, "status") || undefined;
      const view = first(query, "view") as "summary" | "full" | undefined;
      const result = await listJobs(orgId, { contractorId, status: status as any, view });
      sendJson(res, 200, { data: result.data, total: result.total });
    } catch (e) {
      sendError(res, 500, "DB_ERROR", "Failed to load jobs", String(e));
    }
  });

  // GET /jobs/:id
  router.get("/jobs/:id", async ({ req, res, params, orgId }) => {
    if (!requireOrgViewer(req, res)) return;
    try {
      const job = await getJob(params.id);
      if (!job || job.orgId !== orgId) return sendError(res, 404, "NOT_FOUND", "Job not found");
      sendJson(res, 200, { data: job });
    } catch (e) {
      sendError(res, 500, "DB_ERROR", "Failed to load job", String(e));
    }
  });

  // PATCH /jobs/:id — delegates to updateJobWorkflow
  router.patch("/jobs/:id", async ({ req, res, params, orgId, prisma }) => {
    if (!requireOrgViewer(req, res)) return;
    try {
      const raw = await readJson(req);
      const actor = getAuthUser(req);
      const result = await updateJobWorkflow(
        { orgId, prisma, actorUserId: actor?.userId ?? null },
        { jobId: params.id, status: raw.status, actualCost: raw.actualCost, startedAt: raw.startedAt, completedAt: raw.completedAt },
      );
      sendJson(res, 200, { data: result.dto });
    } catch (e: any) {
      if (e instanceof InvalidTransitionError) return sendError(res, 409, "INVALID_TRANSITION", e.message);
      if (e.code === "NOT_FOUND") return sendError(res, 404, "NOT_FOUND", e.message);
      const msg = String(e?.message || e);
      if (msg === "Invalid JSON") return sendError(res, 400, "INVALID_JSON", "Invalid JSON");
      if (msg === "Body too large") return sendError(res, 413, "BODY_TOO_LARGE", "Request body too large");
      sendError(res, 500, "DB_ERROR", "Failed to update job", String(e));
    }
  });

  // GET /invoices
  router.get("/invoices", async ({ req, res, query, orgId }) => {
    if (!requireOrgViewer(req, res)) return;
    try {
      const jobId = first(query, "jobId") || undefined;
      const status = first(query, "status") || undefined;
      const contractorId = first(query, "contractorId") || undefined;
      const expenseCategory = first(query, "expenseCategory") || undefined;
      const buildingId = first(query, "buildingId") || undefined;
      const paidAfter = first(query, "paidAfter") || undefined;
      const paidBefore = first(query, "paidBefore") || undefined;
      const expenseTypeId = first(query, "expenseTypeId") || undefined;
      const accountId = first(query, "accountId") || undefined;
      const direction = first(query, "direction") || undefined;
      const ingestionStatus = first(query, "ingestionStatus") || undefined;
      const view = first(query, "view") as "summary" | "full" | undefined;
      const result = await listInvoices(orgId, { jobId, status: status as any, view, contractorId, expenseCategory, buildingId, paidAfter, paidBefore, expenseTypeId, accountId, direction, ingestionStatus });
      sendJson(res, 200, { data: result.data, total: result.total });
    } catch (e) {
      sendError(res, 500, "DB_ERROR", "Failed to load invoices", String(e));
    }
  });

  // POST /invoices
  // Contractor-created invoices are auto-issued (DRAFT → ISSUED).
  // Manager-created invoices stay in DRAFT for manual review.
  router.post("/invoices", async ({ req, res, prisma, orgId }) => {
    if (!requireOrgViewer(req, res)) return;
    try {
      const raw = await readJson(req);
      const parsed = CreateInvoiceSchema.safeParse(raw);
      if (!parsed.success) return sendError(res, 400, "VALIDATION_ERROR", "Invalid invoice", parsed.error.flatten());

      const created = await createInvoice({
        orgId,
        jobId: parsed.data.jobId,
        amount: parsed.data.amount,
        description: parsed.data.description,
        issuerBillingEntityId: parsed.data.issuerBillingEntityId,
        recipientName: parsed.data.recipientName,
        recipientAddressLine1: parsed.data.recipientAddressLine1,
        recipientAddressLine2: parsed.data.recipientAddressLine2,
        recipientPostalCode: parsed.data.recipientPostalCode,
        recipientCity: parsed.data.recipientCity,
        recipientCountry: parsed.data.recipientCountry,
        issueDate: parsed.data.issueDate ? new Date(parsed.data.issueDate) : undefined,
        dueDate: parsed.data.dueDate ? new Date(parsed.data.dueDate) : undefined,
        vatRate: parsed.data.vatRate,
        expenseTypeId: parsed.data.expenseTypeId,
        accountId: parsed.data.accountId,
        lineItems: parsed.data.lineItems,
        // INV-HUB ingestion fields
        direction: (parsed.data as any).direction,
        sourceChannel: (parsed.data as any).sourceChannel,
        ingestionStatus: (parsed.data as any).ingestionStatus,
        matchedJobId: (parsed.data as any).matchedJobId,
        matchedLeaseId: (parsed.data as any).matchedLeaseId,
        matchedBuildingId: (parsed.data as any).matchedBuildingId,
      });

      // Auto-issue when the caller is a contractor
      const actor = getAuthUser(req);
      if (actor?.role === "CONTRACTOR") {
        try {
          const issued = await issueInvoiceWorkflow(
            { orgId, prisma, actorUserId: actor.userId },
            { invoiceId: created.id },
          );
          return sendJson(res, 201, { data: issued.dto });
        } catch {
          // If auto-issue fails (e.g. missing billing entity), still return the DRAFT
        }
      }

      sendJson(res, 201, { data: created });
    } catch (e: any) {
      const msg = String(e?.message || e);
      if (msg === "Invalid JSON") return sendError(res, 400, "INVALID_JSON", "Invalid JSON");
      if (msg === "Body too large") return sendError(res, 413, "BODY_TOO_LARGE", "Request body too large");
      sendError(res, 500, "DB_ERROR", "Failed to create invoice", String(e));
    }
  });

  // GET /invoices/:id
  router.get("/invoices/:id", async ({ req, res, params, orgId }) => {
    if (!requireOrgViewer(req, res)) return;
    try {
      const invoice = await getInvoice(params.id);
      if (!invoice || invoice.orgId !== orgId) return sendError(res, 404, "NOT_FOUND", "Invoice not found");
      sendJson(res, 200, { data: invoice });
    } catch (e) {
      sendError(res, 500, "DB_ERROR", "Failed to load invoice", String(e));
    }
  });

  // PATCH /invoices/:id — update invoice fields (DRAFT only)
  router.patch("/invoices/:id", async ({ req, res, params, orgId }) => {
    if (!requireAnyRole(req, res, ["MANAGER", "OWNER"])) return;
    try {
      const body = await readJson(req);
      const { updateInvoice } = await import("../services/invoices");
      const updated = await updateInvoice(params.id, {
        ...(body.issuerBillingEntityId !== undefined ? { issuerBillingEntityId: body.issuerBillingEntityId } : {}),
        ...(body.recipientName !== undefined ? { recipientName: body.recipientName } : {}),
        ...(body.description !== undefined ? { description: body.description } : {}),
      });
      sendJson(res, 200, { data: updated });
    } catch (e: any) {
      const msg = String(e?.message || e);
      if (msg === "INVOICE_NOT_FOUND") return sendError(res, 404, "NOT_FOUND", "Invoice not found");
      if (msg === "INVOICE_LOCKED") return sendError(res, 400, "INVOICE_LOCKED", "Invoice is locked and cannot be edited");
      sendError(res, 500, "DB_ERROR", "Failed to update invoice", String(e));
    }
  });

  // POST /invoices/:id/issue → delegates to issueInvoiceWorkflow
  router.post("/invoices/:id/issue", async ({ req, res, prisma, params, orgId }) => {
    if (!requireAnyRole(req, res, ["MANAGER", "OWNER"])) return;
    try {
      const actor = getAuthUser(req);
      // Accept optional body params (issuerBillingEntityId for ingested invoices)
      let body: any = {};
      try { body = await readJson(req); } catch { /* empty body is fine */ }
      const result = await issueInvoiceWorkflow(
        { orgId, prisma, actorUserId: actor?.userId ?? null },
        {
          invoiceId: params.id,
          issuerBillingEntityId: body?.issuerBillingEntityId,
        },
      );
      sendJson(res, 200, { data: result.dto });
    } catch (e: any) {
      const msg = String(e?.message || e);
      if (e.code === "NOT_FOUND" || msg === "INVOICE_NOT_FOUND") return sendError(res, 404, "NOT_FOUND", "Invoice not found");
      if (msg === "INVOICE_ALREADY_ISSUED") return sendError(res, 400, "ALREADY_ISSUED", "Invoice already issued");
      if (msg === "ISSUER_BILLING_ENTITY_REQUIRED") {
        return sendError(res, 400, "VALIDATION_ERROR", "Invoice issuer billing entity is required before issuing");
      }
      sendError(res, 500, "DB_ERROR", "Failed to issue invoice", String(e));
    }
  });

  // POST /invoices/:id/approve
  router.post("/invoices/:id/approve", async ({ req, res, prisma, params, orgId }) => {
    if (!requireAnyRole(req, res, ["MANAGER", "OWNER"])) return;
    try {
      const actor = getAuthUser(req);
      const result = await approveInvoiceWorkflow(
        { orgId, prisma, actorUserId: actor?.userId ?? null },
        { invoiceId: params.id },
      );
      sendJson(res, 200, { data: result.dto });
    } catch (e: any) {
      if (e instanceof InvalidTransitionError) return sendError(res, 409, "INVALID_TRANSITION", e.message);
      if (e.code === "NOT_FOUND") return sendError(res, 404, "NOT_FOUND", e.message);
      const msg = String(e?.message || e);
      if (msg === "ISSUER_BILLING_ENTITY_REQUIRED") {
        return sendError(res, 400, "VALIDATION_ERROR", "Invoice issuer billing entity is required before approval");
      }
      sendError(res, 500, "DB_ERROR", "Failed to approve invoice", String(e));
    }
  });

  // POST /invoices/:id/mark-paid
  router.post("/invoices/:id/mark-paid", async ({ req, res, prisma, params, orgId }) => {
    if (!requireAnyRole(req, res, ["MANAGER", "OWNER"])) return;
    try {
      const actor = getAuthUser(req);
      const result = await payInvoiceWorkflow(
        { orgId, prisma, actorUserId: actor?.userId ?? null },
        { invoiceId: params.id },
      );
      sendJson(res, 200, { data: result.dto });
    } catch (e: any) {
      if (e instanceof InvalidTransitionError) return sendError(res, 409, "INVALID_TRANSITION", e.message);
      if (e.code === "NOT_FOUND") return sendError(res, 404, "NOT_FOUND", e.message);
      sendError(res, 500, "DB_ERROR", "Failed to mark invoice paid", String(e));
    }
  });

  // POST /invoices/:id/dispute
  router.post("/invoices/:id/dispute", async ({ req, res, prisma, params, orgId }) => {
    if (!requireAnyRole(req, res, ["MANAGER", "OWNER"])) return;
    try {
      const actor = getAuthUser(req);
      let reason: string | undefined;
      try {
        const raw = await readJson(req);
        reason = raw?.reason;
      } catch {
        // Body is optional for dispute
      }
      const result = await disputeInvoiceWorkflow(
        { orgId, prisma, actorUserId: actor?.userId ?? null },
        { invoiceId: params.id, reason },
      );
      sendJson(res, 200, { data: result.dto });
    } catch (e: any) {
      if (e instanceof InvalidTransitionError) return sendError(res, 409, "INVALID_TRANSITION", e.message);
      if (e.code === "NOT_FOUND") return sendError(res, 404, "NOT_FOUND", e.message);
      sendError(res, 500, "DB_ERROR", "Failed to dispute invoice", String(e));
    }
  });

  // GET /owner/invoices
  router.get("/owner/invoices", async ({ req, res, query, orgId }) => {
    if (!requireAnyRole(req, res, ["MANAGER", "OWNER"])) return;
    try {
      const status = first(query, "status") || undefined;
        const view = first(query, "view") as "summary" | "full" | undefined;
        const result = await listInvoices(orgId, { status: status as any, view });
      sendJson(res, 200, { data: result.data, total: result.total });
    } catch (e) {
      sendError(res, 500, "DB_ERROR", "Failed to load invoices", String(e));
    }
  });

  // GET /invoices/:id/qr-bill
  router.get("/invoices/:id/qr-bill", async ({ req, res, params, orgId }) => {
    if (!requireOrgViewer(req, res)) return;
    try {
      const qrBill = await generateInvoiceQRBill(params.id, orgId);
      sendJson(res, 200, { data: qrBill });
    } catch (e: any) {
      const msg = String(e?.message || e);
      if (msg.includes("not found")) return sendError(res, 404, "NOT_FOUND", "Invoice not found");
      sendError(res, 500, "DB_ERROR", "Failed to generate QR-bill", String(e));
    }
  });

  // GET /invoices/:id/qr-code.png — custom regex because of the dot in the path
  router.addCustom(
    "GET",
    /^\/invoices\/([a-f0-9-]{36})\/qr-code\.png$/i,
    ["id"],
    async ({ req, res, params, orgId }) => {
      if (!requireOrgViewer(req, res)) return;
      try {
        const pngBuffer = await getInvoiceQRCodePNG(params.id, orgId);
        res.writeHead(200, {
          "Content-Type": "image/png",
          "Content-Length": pngBuffer.length,
        });
        res.end(pngBuffer);
      } catch (e: any) {
        const msg = String(e?.message || e);
        if (res.headersSent) { res.end(); return; }
        if (msg.includes("not found")) return sendError(res, 404, "NOT_FOUND", "Invoice not found");
        sendError(res, 500, "DB_ERROR", "Failed to generate QR code", String(e));
      }
    },
    "GET /invoices/:id/qr-code.png",
  );

  // GET /invoices/:id/pdf
  router.get("/invoices/:id/pdf", async ({ req, res, params, query, orgId }) => {
    if (!requireOrgViewer(req, res)) return;
    try {
      const includeQRBillParam = first(query, "includeQRBill") || "true";
      const includeQRBill = includeQRBillParam !== "false";
      console.log(`[PDF] Generating PDF for invoice ${params.id}, includeQRBill=${includeQRBill}`);
      const pdfBuffer = await generateInvoicePDF(params.id, orgId, { includeQRBill });

      console.log(`[PDF] Generated ${pdfBuffer.length} bytes, sending...`);
      const fileName = `invoice-${new Date().toISOString().split("T")[0]}.pdf`;
      res.writeHead(200, {
        "Content-Type": "application/pdf",
        "Content-Length": pdfBuffer.length,
        "Content-Disposition": `attachment; filename="${fileName}"`,
      });
      res.end(pdfBuffer);
      console.log(`[PDF] PDF sent successfully`);
    } catch (e: any) {
      const msg = String(e?.message || e);
      console.error(`[PDF] Error: ${msg}`, e);
      if (res.headersSent) { res.end(); return; }
      if (msg.includes("not found")) return sendError(res, 404, "NOT_FOUND", "Invoice not found");
      if (msg.includes("Unauthorized")) return sendError(res, 403, "FORBIDDEN", "You do not have access to this invoice");
      sendError(res, 500, "PDF_ERROR", "Failed to generate PDF", String(e));
    }
  });

  // POST /invoices/ingest — scan and ingest an invoice document
  router.post("/invoices/ingest", async ({ req, res, orgId }) => {
    if (!requireAnyRole(req, res, ["MANAGER"])) return;
    try {
      const contentType = req.headers["content-type"] || "";
      const boundaryMatch = contentType.match(/boundary=(.+)/i);

      if (!boundaryMatch) {
        sendError(res, 400, "BAD_REQUEST", "Content-Type must be multipart/form-data with boundary");
        return;
      }

      const rawBody = await readRawBody(req, MAX_FILE_SIZE + 128 * 1024);
      const parts = parseMultipart(rawBody, boundaryMatch[1]);

      const filePart = parts.find((p) => p.name === "file" && p.filename);
      if (!filePart) {
        sendError(res, 400, "BAD_REQUEST", 'Missing "file" field with filename');
        return;
      }

      if (filePart.data.length > MAX_FILE_SIZE) {
        sendError(res, 413, "PAYLOAD_TOO_LARGE", `File exceeds ${MAX_FILE_SIZE / (1024 * 1024)}MB limit`);
        return;
      }

      // Optional metadata fields from form parts
      const sourceChannelPart = parts.find((p) => p.name === "sourceChannel");
      const directionPart = parts.find((p) => p.name === "direction");
      const hintPart = parts.find((p) => p.name === "hintDocType");

      const sourceChannelRaw = sourceChannelPart?.data.toString("utf8").trim() || "BROWSER_UPLOAD";
      const directionRaw = directionPart?.data.toString("utf8").trim() || "INCOMING";

      // Validate sourceChannel enum
      const validChannels: InvoiceSourceChannel[] = ["MANUAL", "BROWSER_UPLOAD", "EMAIL_PDF", "MOBILE_CAPTURE"];
      const sourceChannel = validChannels.includes(sourceChannelRaw as InvoiceSourceChannel)
        ? (sourceChannelRaw as InvoiceSourceChannel)
        : "BROWSER_UPLOAD" as InvoiceSourceChannel;

      // Validate direction enum
      const validDirections: InvoiceDirection[] = ["INCOMING", "OUTGOING"];
      const direction = validDirections.includes(directionRaw as InvoiceDirection)
        ? (directionRaw as InvoiceDirection)
        : "INCOMING";

      const hint = hintPart ? hintPart.data.toString("utf8").trim() : undefined;

      const result = await ingestInvoice({
        buffer: filePart.data,
        fileName: filePart.filename!,
        mimeType: filePart.contentType || "application/octet-stream",
        orgId,
        sourceChannel,
        direction,
        hintDocType: hint,
      });

      sendJson(res, 201, {
        data: result.invoice,
        scanResult: {
          docType: result.scanResult.docType,
          confidence: result.scanResult.confidence,
          fields: result.scanResult.fields,
          summary: result.scanResult.summary,
        },
        ingestionStatus: result.ingestionStatus,
      });
    } catch (e: any) {
      console.error("[INVOICE-INGEST] error:", e);
      sendError(res, 500, "INTERNAL_ERROR", "Invoice ingestion failed", e.message);
    }
  });
}
