import { Router } from "../http/router";
import { sendError, sendJson } from "../http/json";
import { readJson } from "../http/body";
import { first } from "../http/query";
import { getAuthUser, getOrgIdForRequest } from "../authz";
import { requireOrgViewer, requireOwnerAccess, logEvent } from "./helpers";
import { createJob, getJob, listJobs, updateJob } from "../services/jobs";
import { createInvoice, getInvoice, listInvoices, approveInvoice, markInvoicePaid, disputeInvoice, issueInvoice, getOrCreateInvoiceForJob } from "../services/invoices";
import { CreateInvoiceSchema } from "../validation/invoices";
import { generateInvoiceQRBill, getInvoiceQRCodePNG } from "../services/invoiceQRBill";
import { generateInvoicePDF } from "../services/invoicePDF";

export function registerInvoiceRoutes(router: Router) {
  // GET /jobs
  router.get("/jobs", async ({ req, res, query }) => {
    if (!requireOrgViewer(req, res)) return;
    try {
      const orgId = getOrgIdForRequest(req);
      const contractorId = first(query, "contractorId") || undefined;
      const status = first(query, "status") || undefined;
      const jobs = await listJobs(orgId, { contractorId, status: status as any });
      sendJson(res, 200, { data: jobs });
    } catch (e) {
      sendError(res, 500, "DB_ERROR", "Failed to load jobs", String(e));
    }
  });

  // GET /jobs/:id
  router.get("/jobs/:id", async ({ req, res, params }) => {
    if (!requireOrgViewer(req, res)) return;
    try {
      const orgId = getOrgIdForRequest(req);
      const job = await getJob(params.id);
      if (!job || job.orgId !== orgId) return sendError(res, 404, "NOT_FOUND", "Job not found");
      sendJson(res, 200, { data: job });
    } catch (e) {
      sendError(res, 500, "DB_ERROR", "Failed to load job", String(e));
    }
  });

  // PATCH /jobs/:id
  router.patch("/jobs/:id", async ({ req, res, params }) => {
    if (!requireOrgViewer(req, res)) return;
    try {
      const raw = await readJson(req);
      const orgId = getOrgIdForRequest(req);
      const job = await getJob(params.id);
      if (!job || job.orgId !== orgId) return sendError(res, 404, "NOT_FOUND", "Job not found");

      const updated = await updateJob(params.id, {
        status: raw.status,
        actualCost: raw.actualCost,
        startedAt: raw.startedAt ? new Date(raw.startedAt) : undefined,
        completedAt: raw.completedAt ? new Date(raw.completedAt) : undefined,
      });

      // Auto-create invoice when job is marked COMPLETED (idempotent)
      if (raw.status === "COMPLETED" && job.status !== "COMPLETED" && updated.actualCost) {
        try {
          await getOrCreateInvoiceForJob(orgId, params.id, updated.actualCost);
        } catch (err) {
          console.warn("Failed to auto-create invoice for job", params.id, err);
        }
      }

      sendJson(res, 200, { data: updated });
    } catch (e: any) {
      const msg = String(e?.message || e);
      if (msg === "Invalid JSON") return sendError(res, 400, "INVALID_JSON", "Invalid JSON");
      if (msg === "Body too large") return sendError(res, 413, "BODY_TOO_LARGE", "Request body too large");
      sendError(res, 500, "DB_ERROR", "Failed to update job", String(e));
    }
  });

  // GET /invoices
  router.get("/invoices", async ({ req, res, query }) => {
    if (!requireOrgViewer(req, res)) return;
    try {
      const orgId = getOrgIdForRequest(req);
      const jobId = first(query, "jobId") || undefined;
      const status = first(query, "status") || undefined;
      const invoices = await listInvoices(orgId, { jobId, status: status as any });
      sendJson(res, 200, { data: invoices });
    } catch (e) {
      sendError(res, 500, "DB_ERROR", "Failed to load invoices", String(e));
    }
  });

  // POST /invoices
  router.post("/invoices", async ({ req, res }) => {
    if (!requireOrgViewer(req, res)) return;
    try {
      const orgId = getOrgIdForRequest(req);
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
        lineItems: parsed.data.lineItems,
      });

      sendJson(res, 201, { data: created });
    } catch (e: any) {
      const msg = String(e?.message || e);
      if (msg === "Invalid JSON") return sendError(res, 400, "INVALID_JSON", "Invalid JSON");
      if (msg === "Body too large") return sendError(res, 413, "BODY_TOO_LARGE", "Request body too large");
      sendError(res, 500, "DB_ERROR", "Failed to create invoice", String(e));
    }
  });

  // GET /invoices/:id
  router.get("/invoices/:id", async ({ req, res, params }) => {
    if (!requireOrgViewer(req, res)) return;
    try {
      const orgId = getOrgIdForRequest(req);
      const invoice = await getInvoice(params.id);
      if (!invoice || invoice.orgId !== orgId) return sendError(res, 404, "NOT_FOUND", "Invoice not found");
      sendJson(res, 200, { data: invoice });
    } catch (e) {
      sendError(res, 500, "DB_ERROR", "Failed to load invoice", String(e));
    }
  });

  // POST /invoices/:id/issue
  router.post("/invoices/:id/issue", async ({ req, res, prisma, params }) => {
    if (!requireOwnerAccess(req, res)) return;
    try {
      const orgId = getOrgIdForRequest(req);
      const invoice = await getInvoice(params.id);
      if (!invoice || invoice.orgId !== orgId) return sendError(res, 404, "NOT_FOUND", "Invoice not found");

      const issued = await issueInvoice(params.id);

      // Fetch job to get tenantId for notification
      let tenantId: string | undefined = undefined;
      try {
        const job = await prisma.job.findUnique({
          where: { id: issued.jobId },
          include: { request: true },
        });
        tenantId = (job as any)?.request?.tenantId;
      } catch (err) {
        console.warn("Failed to fetch tenantId for invoice notification", err);
      }

      // Trigger notification to tenant (if found)
      try {
        if (tenantId) {
          const { notifyInvoiceStatusChanged } = require("../services/notifications");
          await notifyInvoiceStatusChanged(params.id, orgId, tenantId, "INVOICE_CREATED");
        }
      } catch (notifyErr) {
        console.warn("Failed to send invoice issued notification", notifyErr);
      }

      sendJson(res, 200, { data: issued });
    } catch (e: any) {
      const msg = String(e?.message || e);
      if (msg === "INVOICE_ALREADY_ISSUED") return sendError(res, 400, "ALREADY_ISSUED", "Invoice already issued");
      if (msg === "ISSUER_BILLING_ENTITY_REQUIRED") {
        return sendError(res, 400, "VALIDATION_ERROR", "Invoice issuer billing entity is required before issuing");
      }
      sendError(res, 500, "DB_ERROR", "Failed to issue invoice", String(e));
    }
  });

  // POST /invoices/:id/approve
  router.post("/invoices/:id/approve", async ({ req, res, prisma, params }) => {
    if (!requireOwnerAccess(req, res)) return;
    try {
      const orgId = getOrgIdForRequest(req);
      const invoice = await getInvoice(params.id);
      if (!invoice || invoice.orgId !== orgId) return sendError(res, 404, "NOT_FOUND", "Invoice not found");

      const approved = await approveInvoice(params.id);
      const actor = getAuthUser(req);
      await logEvent(prisma, {
        orgId,
        type: "INVOICE_APPROVED",
        actorUserId: actor?.userId,
        payload: { invoiceId: params.id, amount: approved.amount },
      });

      sendJson(res, 200, { data: approved });
    } catch (e: any) {
      const msg = String(e?.message || e);
      if (msg === "ISSUER_BILLING_ENTITY_REQUIRED") {
        return sendError(res, 400, "VALIDATION_ERROR", "Invoice issuer billing entity is required before approval");
      }
      sendError(res, 500, "DB_ERROR", "Failed to approve invoice", String(e));
    }
  });

  // POST /invoices/:id/mark-paid
  router.post("/invoices/:id/mark-paid", async ({ req, res, prisma, params }) => {
    if (!requireOwnerAccess(req, res)) return;
    try {
      const orgId = getOrgIdForRequest(req);
      const invoice = await getInvoice(params.id);
      if (!invoice || invoice.orgId !== orgId) return sendError(res, 404, "NOT_FOUND", "Invoice not found");

      const paid = await markInvoicePaid(params.id);
      const actor = getAuthUser(req);
      await logEvent(prisma, {
        orgId,
        type: "INVOICE_PAID",
        actorUserId: actor?.userId,
        payload: { invoiceId: params.id, amount: paid.amount },
      });

      sendJson(res, 200, { data: paid });
    } catch (e) {
      sendError(res, 500, "DB_ERROR", "Failed to mark invoice paid", String(e));
    }
  });

  // POST /invoices/:id/dispute
  router.post("/invoices/:id/dispute", async ({ req, res, prisma, params }) => {
    if (!requireOwnerAccess(req, res)) return;
    try {
      const orgId = getOrgIdForRequest(req);
      const invoice = await getInvoice(params.id);
      if (!invoice || invoice.orgId !== orgId) return sendError(res, 404, "NOT_FOUND", "Invoice not found");

      const raw = await readJson(req);
      const disputed = await disputeInvoice(params.id);
      const actor = getAuthUser(req);
      await logEvent(prisma, {
        orgId,
        type: "INVOICE_DISPUTED",
        actorUserId: actor?.userId,
        payload: { invoiceId: params.id, reason: raw?.reason || null },
      });

      sendJson(res, 200, { data: disputed });
    } catch (e: any) {
      const msg = String(e?.message || e);
      if (msg === "Invalid JSON") return sendError(res, 400, "INVALID_JSON", "Invalid JSON");
      if (msg === "Body too large") return sendError(res, 413, "BODY_TOO_LARGE", "Request body too large");
      sendError(res, 500, "DB_ERROR", "Failed to dispute invoice", String(e));
    }
  });

  // GET /owner/invoices
  router.get("/owner/invoices", async ({ req, res, query }) => {
    if (!requireOwnerAccess(req, res)) return;
    try {
      const orgId = getOrgIdForRequest(req);
      const status = first(query, "status") || undefined;
      const invoices = await listInvoices(orgId, { status: status as any });
      sendJson(res, 200, { data: invoices });
    } catch (e) {
      sendError(res, 500, "DB_ERROR", "Failed to load invoices", String(e));
    }
  });

  // GET /invoices/:id/qr-bill
  router.get("/invoices/:id/qr-bill", async ({ req, res, params }) => {
    if (!requireOrgViewer(req, res)) return;
    try {
      const orgId = getOrgIdForRequest(req);
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
    async ({ req, res, params }) => {
      if (!requireOrgViewer(req, res)) return;
      try {
        const orgId = getOrgIdForRequest(req);
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
  router.get("/invoices/:id/pdf", async ({ req, res, params, query }) => {
    if (!requireOrgViewer(req, res)) return;
    try {
      const orgId = getOrgIdForRequest(req);
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
}
