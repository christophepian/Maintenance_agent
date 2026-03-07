import { Router } from "../http/router";
import { sendError, sendJson } from "../http/json";
import { readJson } from "../http/body";
import { parseBody } from "../http/body";
import { first, getIntParam, getEnumParam } from "../http/query";
import { withRole } from "../http/routeProtection";
import { readRawBody, parseMultipart, MAX_FILE_SIZE, storage } from "../storage/attachments";
import { scanDocument } from "../services/documentScan";
import prisma from "../services/prismaClient";
import {
  CreateRentalApplicationSchema,
  SubmitRentalApplicationSchema,
  OwnerSelectionSchema,
  AdjustScoreSchema,
  OverrideDisqualificationSchema,
} from "../validation/rentalApplications";
import {
  createRentalApplicationDraft,
  submitRentalApplication,
  uploadRentalAttachment,
  getApplication,
  listApplicationsForUnit,
  adjustEvaluation,
  overrideDisqualification,
  listVacantUnits,
} from "../services/rentalApplications";
import { ownerSelectCandidates } from "../services/ownerSelection";
import { listEmails, getEmail } from "../services/emailOutbox";
import { submitRentalApplicationWorkflow } from "../workflows/submitRentalApplicationWorkflow";

/* ══════════════════════════════════════════════════════════════
   Rental Application Routes
   ══════════════════════════════════════════════════════════════

   Public (tenant-facing, no auth):
     GET  /vacant-units
     POST /rental-applications
     POST /rental-applications/:id/submit
     POST /rental-applications/:id/attachments

   Manager:
     GET  /manager/rental-applications       ?unitId=...&view=summary|detail
     GET  /manager/rental-applications/:id
     POST /manager/rental-application-units/:id/adjust-score

   Owner:
     GET  /owner/rental-applications          ?unitId=...
     POST /owner/units/:unitId/select-tenants

   Dev (email sink):
     GET  /dev/emails
     GET  /dev/emails/:id
   ══════════════════════════════════════════════════════════════ */

export function registerRentalRoutes(router: Router) {

  /* ────────────────────────────────────────────────────────────
     PUBLIC: Tenant-facing endpoints (no auth required)
     ──────────────────────────────────────────────────────────── */

  /**
   * List vacant units available for rental applications.
   * Public endpoint — tenants browse before applying.
   */
  router.get("/vacant-units", async ({ res, orgId }) => {
    try {
      const units = await listVacantUnits(orgId);
      sendJson(res, 200, { data: units });
    } catch (e: any) {
      console.error("[RENTAL] listVacantUnits error:", e);
      sendError(res, 500, "DB_ERROR", "Failed to fetch vacant units", e.message);
    }
  });

  /**
   * Scan / OCR a document and return extracted fields.
   * Public — used in the apply wizard to auto-fill applicant details.
   * Multipart: field "file" + optional field "hintDocType".
   */
  router.post("/document-scan", async ({ req, res }) => {
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

      // Optional hint
      const hintPart = parts.find((p) => p.name === "hintDocType");
      const hint = hintPart ? hintPart.data.toString("utf8").trim() : undefined;

      const result = await scanDocument(
        filePart.data,
        filePart.filename!,
        filePart.contentType || "application/octet-stream",
        hint,
      );

      sendJson(res, 200, { data: result });
    } catch (e: any) {
      console.error("[DOC-SCAN] error:", e);
      sendError(res, 500, "INTERNAL_ERROR", "Document scan failed", e.message);
    }
  });

  /**
   * Create a new rental application draft.
   */
  router.post("/rental-applications", async ({ req, res, orgId }) => {
    try {
      const input = await parseBody(req, CreateRentalApplicationSchema);
      const dto = await createRentalApplicationDraft(orgId, input);
      sendJson(res, 201, { data: dto });
    } catch (e: any) {
      if (e.name === "ValidationError" || e.code === "VALIDATION_ERROR") {
        sendError(res, 400, "VALIDATION_ERROR", e.message, e.details);
        return;
      }
      if (e.message?.includes("NOT_FOUND")) {
        sendError(res, 404, "NOT_FOUND", e.message);
        return;
      }
      console.error("[RENTAL] createDraft error:", e);
      sendError(res, 500, "INTERNAL_ERROR", "Failed to create application", e.message);
    }
  });

  /**
   * Submit a rental application (trigger evaluation).
   * Public — tenant finalises their application.
   */
  router.post("/rental-applications/:id/submit", async ({ req, res, orgId, params, prisma }) => {
    try {
      const input = await parseBody(req, SubmitRentalApplicationSchema);
      const { dto } = await submitRentalApplicationWorkflow(
        { orgId, prisma },
        {
          applicationId: params.id,
          signedName: input.signedName,
          meta: {
            ip: req.socket.remoteAddress || "unknown",
            userAgent: req.headers["user-agent"] || "unknown",
          },
        },
      );
      sendJson(res, 200, { data: dto });
    } catch (e: any) {
      if (e.name === "ValidationError" || e.code === "VALIDATION_ERROR") {
        sendError(res, 400, "VALIDATION_ERROR", e.message, e.details);
        return;
      }
      if (e.message?.includes("NOT_FOUND")) {
        sendError(res, 404, "NOT_FOUND", e.message);
        return;
      }
      if (e.message?.includes("ALREADY_SUBMITTED")) {
        sendError(res, 409, "CONFLICT", e.message);
        return;
      }
      console.error("[RENTAL] submit error:", e);
      sendError(res, 500, "INTERNAL_ERROR", "Failed to submit application", e.message);
    }
  });

  /**
   * Upload an attachment for a rental application.
   * Multipart form-data: field "file" + field "meta" (JSON with applicantId, docType).
   */
  router.post("/rental-applications/:id/attachments", async ({ req, res, params }) => {
    try {
      const contentType = req.headers["content-type"] || "";
      const boundaryMatch = contentType.match(/boundary=(.+)/i);

      if (!boundaryMatch) {
        sendError(res, 400, "BAD_REQUEST", "Content-Type must be multipart/form-data with boundary");
        return;
      }

      const rawBody = await readRawBody(req, MAX_FILE_SIZE + 128 * 1024);
      const parts = parseMultipart(rawBody, boundaryMatch[1]);

      // Extract meta JSON
      const metaPart = parts.find((p) => p.name === "meta");
      if (!metaPart) {
        sendError(res, 400, "BAD_REQUEST", 'Missing "meta" field in multipart body');
        return;
      }

      let meta: { applicantId: string; docType: string };
      try {
        meta = JSON.parse(metaPart.data.toString("utf8"));
      } catch {
        sendError(res, 400, "BAD_REQUEST", '"meta" field must be valid JSON');
        return;
      }

      if (!meta.applicantId || !meta.docType) {
        sendError(res, 400, "VALIDATION_ERROR", 'meta must contain applicantId and docType');
        return;
      }

      // Extract file
      const filePart = parts.find((p) => p.name === "file" && p.filename);
      if (!filePart) {
        sendError(res, 400, "BAD_REQUEST", 'Missing "file" field with filename in multipart body');
        return;
      }

      if (filePart.data.length > MAX_FILE_SIZE) {
        sendError(res, 413, "PAYLOAD_TOO_LARGE", `File exceeds ${MAX_FILE_SIZE / (1024 * 1024)}MB limit`);
        return;
      }

      const dto = await uploadRentalAttachment(
        params.id,
        meta.applicantId,
        meta.docType as any,
        {
          buffer: filePart.data,
          fileName: filePart.filename!,
          mimeType: filePart.contentType || "application/octet-stream",
        },
      );

      sendJson(res, 201, { data: dto });
    } catch (e: any) {
      if (e.message?.includes("NOT_FOUND")) {
        sendError(res, 404, "NOT_FOUND", e.message);
        return;
      }
      console.error("[RENTAL] upload error:", e);
      sendError(res, 500, "INTERNAL_ERROR", "Failed to upload attachment", e.message);
    }
  });

  /* ────────────────────────────────────────────────────────────
     MANAGER: Dashboard / Evaluation endpoints
     ──────────────────────────────────────────────────────────── */

  /**
   * List rental applications for a unit (manager dashboard view).
   * Query: unitId (required), view=summary|detail, limit, offset
   */
  router.get(
    "/manager/rental-applications",
    withRole("MANAGER", async ({ res, orgId, query }) => {
      try {
        const unitId = first(query, "unitId");
        if (!unitId) {
          sendError(res, 400, "BAD_REQUEST", "unitId query parameter is required");
          return;
        }

        const view = getEnumParam(query, "view", ["summary", "full"] as const, "summary");
        const list = await listApplicationsForUnit(orgId, unitId, view);
        sendJson(res, 200, { data: list });
      } catch (e: any) {
        console.error("[RENTAL] list applications error:", e);
        sendError(res, 500, "DB_ERROR", "Failed to list applications", e.message);
      }
    }),
  );

  /**
   * Get a single rental application by ID (full detail).
   */
  router.get(
    "/manager/rental-applications/:id",
    withRole("MANAGER", async ({ res, params }) => {
      try {
        const dto = await getApplication(params.id);
        if (!dto) {
          sendError(res, 404, "NOT_FOUND", "Application not found");
          return;
        }
        sendJson(res, 200, { data: dto });
      } catch (e: any) {
        console.error("[RENTAL] getApplication error:", e);
        sendError(res, 500, "DB_ERROR", "Failed to fetch application", e.message);
      }
    }),
  );

  /**
   * Adjust evaluation score for an application-unit (manager override).
   * Body: { adjustedScore?, adjustedFlags?, managerNote? }
   */
  router.post(
    "/manager/rental-application-units/:id/adjust-score",
    withRole("MANAGER", async ({ req, res, params }) => {
      try {
        const input = await parseBody(req, AdjustScoreSchema);
        const dto = await adjustEvaluation(params.id, input);
        sendJson(res, 200, { data: dto });
      } catch (e: any) {
        if (e.name === "ValidationError" || e.code === "VALIDATION_ERROR") {
          sendError(res, 400, "VALIDATION_ERROR", e.message, e.details);
          return;
        }
        if (e.message?.includes("NOT_FOUND")) {
          sendError(res, 404, "NOT_FOUND", e.message);
          return;
        }
        console.error("[RENTAL] adjustScore error:", e);
        sendError(res, 500, "INTERNAL_ERROR", "Failed to adjust score", e.message);
      }
    }),
  );

  /**
   * Manager overrides disqualification for a candidate.
   * Body: { reason: string }
   */
  router.post(
    "/manager/rental-application-units/:id/override-disqualification",
    withRole("MANAGER", async ({ req, res, params }) => {
      try {
        const input = await parseBody(req, OverrideDisqualificationSchema);
        const dto = await overrideDisqualification(params.id, input.reason);
        sendJson(res, 200, { data: dto });
      } catch (e: any) {
        if (e.name === "ValidationError" || e.code === "VALIDATION_ERROR") {
          sendError(res, 400, "VALIDATION_ERROR", e.message, e.details);
          return;
        }
        if (e.message?.includes("NOT_FOUND")) {
          sendError(res, 404, "NOT_FOUND", e.message);
          return;
        }
        if (e.message?.includes("NOT_DISQUALIFIED")) {
          sendError(res, 400, "BAD_REQUEST", "This candidate is not disqualified");
          return;
        }
        console.error("[RENTAL] manager overrideDisqualification error:", e);
        sendError(res, 500, "INTERNAL_ERROR", "Failed to override disqualification", e.message);
      }
    }),
  );

  /**
   * List active tenant selections for manager review.
   * Shows the pipeline of units where the owner has selected candidates,
   * enriched with unit, candidate, lease, and selection status info.
   */
  router.get(
    "/manager/selections",
    withRole("MANAGER", async ({ res, orgId }) => {
      try {
        const selections = await prisma.rentalOwnerSelection.findMany({
          where: {
            unit: { building: { orgId } },
            status: { in: ["AWAITING_SIGNATURE", "FALLBACK_1", "FALLBACK_2", "EXHAUSTED"] },
          },
          include: {
            unit: {
              include: {
                building: { select: { id: true, name: true, address: true } },
                leases: {
                  where: { status: { in: ["DRAFT", "READY_TO_SIGN"] }, isTemplate: false },
                  orderBy: { createdAt: "desc" },
                  take: 1,
                  select: { id: true, status: true, tenantName: true },
                },
              },
            },
            primarySelection: {
              include: {
                application: {
                  include: { applicants: { where: { role: "PRIMARY" }, take: 1 } },
                },
              },
            },
          },
          orderBy: { createdAt: "desc" },
        });

        // Check which buildings have at least one lease template
        const buildingIds = [...new Set(selections.map((s: any) => s.unit?.building?.id).filter(Boolean))];
        const templatesPerBuilding = await prisma.lease.groupBy({
          by: ["templateBuildingId"],
          where: { isTemplate: true, deletedAt: null, templateBuildingId: { in: buildingIds } },
          _count: { id: true },
        });
        const buildingsWithTemplate = new Set(templatesPerBuilding.map((t: any) => t.templateBuildingId));

        const data = selections.map((s: any) => {
          const primaryApplicant = s.primarySelection?.application?.applicants?.[0];
          const lease = s.unit?.leases?.[0] || null;
          const bid = s.unit?.building?.id;
          return {
            id: s.id,
            unitId: s.unitId,
            unitNumber: s.unit?.unitNumber,
            buildingId: bid,
            buildingName: s.unit?.building?.name,
            buildingAddress: s.unit?.building?.address,
            status: s.status,
            deadlineAt: s.deadlineAt.toISOString(),
            createdAt: s.createdAt.toISOString(),
            primaryCandidate: primaryApplicant
              ? {
                  name: `${primaryApplicant.firstName} ${primaryApplicant.lastName}`,
                  email: primaryApplicant.email,
                  phone: primaryApplicant.phone || null,
                  applicationId: s.primarySelection?.applicationId || null,
                }
              : null,
            lease: lease ? { id: lease.id, status: lease.status, tenantName: lease.tenantName } : null,
            hasLeaseTemplate: bid ? buildingsWithTemplate.has(bid) : false,
          };
        });

        sendJson(res, 200, { data });
      } catch (e: any) {
        console.error("[RENTAL] manager listSelections error:", e);
        sendError(res, 500, "DB_ERROR", "Failed to list selections", e.message);
      }
    }),
  );

  /* ────────────────────────────────────────────────────────────
     OWNER: Selection endpoints
     ──────────────────────────────────────────────────────────── */

  /**
   * List rental applications for owner review.
   * Query: unitId (required)
   */
  router.get(
    "/owner/rental-applications",
    withRole("OWNER", async ({ res, orgId, query }) => {
      try {
        const unitId = first(query, "unitId");
        if (!unitId) {
          sendError(res, 400, "BAD_REQUEST", "unitId query parameter is required");
          return;
        }

        const list = await listApplicationsForUnit(orgId, unitId, "summary");
        sendJson(res, 200, { data: list });
      } catch (e: any) {
        console.error("[RENTAL] owner list error:", e);
        sendError(res, 500, "DB_ERROR", "Failed to list applications", e.message);
      }
    }),
  );

  /**
   * Owner selects primary + backup candidates for a unit.
   * Body: { primaryApplicationUnitId, backup1ApplicationUnitId?, backup2ApplicationUnitId? }
   */
  router.post(
    "/owner/units/:unitId/select-tenants",
    withRole("OWNER", async ({ req, res, orgId, params }) => {
      try {
        const input = await parseBody(req, OwnerSelectionSchema);
        const dto = await ownerSelectCandidates(orgId, params.unitId, input);
        sendJson(res, 201, { data: dto });
      } catch (e: any) {
        if (e.name === "ValidationError" || e.code === "VALIDATION_ERROR") {
          sendError(res, 400, "VALIDATION_ERROR", e.message, e.details);
          return;
        }
        if (e.message?.includes("NOT_FOUND") || e.message?.includes("NOT_VACANT")) {
          sendError(res, 404, "NOT_FOUND", e.message);
          return;
        }
        console.error("[RENTAL] selectTenants error:", e);
        sendError(res, 500, "INTERNAL_ERROR", "Failed to process selection", e.message);
      }
    }),
  );

  /**
   * Owner overrides disqualification for a candidate.
   * Body: { reason: string }
   */
  router.post(
    "/owner/rental-application-units/:id/override-disqualification",
    withRole("OWNER", async ({ req, res, params }) => {
      try {
        const input = await parseBody(req, OverrideDisqualificationSchema);
        const dto = await overrideDisqualification(params.id, input.reason);
        sendJson(res, 200, { data: dto });
      } catch (e: any) {
        if (e.name === "ValidationError" || e.code === "VALIDATION_ERROR") {
          sendError(res, 400, "VALIDATION_ERROR", e.message, e.details);
          return;
        }
        if (e.message?.includes("NOT_FOUND")) {
          sendError(res, 404, "NOT_FOUND", e.message);
          return;
        }
        if (e.message?.includes("NOT_DISQUALIFIED")) {
          sendError(res, 400, "BAD_REQUEST", "This candidate is not disqualified");
          return;
        }
        console.error("[RENTAL] overrideDisqualification error:", e);
        sendError(res, 500, "INTERNAL_ERROR", "Failed to override disqualification", e.message);
      }
    }),
  );

  /**
   * List active owner selections (awaiting signature pipeline).
   * Returns selection records enriched with unit, candidate, and lease info.
   */
  router.get(
    "/owner/selections",
    withRole("OWNER", async ({ res, orgId }) => {
      try {
        const selections = await prisma.rentalOwnerSelection.findMany({
          where: {
            unit: { building: { orgId } },
            status: { in: ["AWAITING_SIGNATURE", "FALLBACK_1", "FALLBACK_2"] },
          },
          include: {
            unit: {
              include: {
                building: { select: { id: true, name: true, address: true } },
                leases: {
                  where: { status: { in: ["DRAFT", "READY_TO_SIGN"] }, isTemplate: false },
                  orderBy: { createdAt: "desc" },
                  take: 1,
                  select: { id: true, status: true, tenantName: true },
                },
              },
            },
            primarySelection: {
              include: {
                application: {
                  include: { applicants: { where: { role: "PRIMARY" }, take: 1 } },
                },
              },
            },
          },
          orderBy: { createdAt: "desc" },
        });

        const data = selections.map((s: any) => {
          const primaryApplicant = s.primarySelection?.application?.applicants?.[0];
          const lease = s.unit?.leases?.[0] || null;
          return {
            id: s.id,
            unitId: s.unitId,
            unitNumber: s.unit?.unitNumber,
            buildingName: s.unit?.building?.name,
            buildingAddress: s.unit?.building?.address,
            status: s.status,
            deadlineAt: s.deadlineAt.toISOString(),
            createdAt: s.createdAt.toISOString(),
            primaryCandidate: primaryApplicant
              ? { name: `${primaryApplicant.firstName} ${primaryApplicant.lastName}`, email: primaryApplicant.email }
              : null,
            lease: lease ? { id: lease.id, status: lease.status, tenantName: lease.tenantName } : null,
          };
        });

        sendJson(res, 200, { data });
      } catch (e: any) {
        console.error("[RENTAL] listSelections error:", e);
        sendError(res, 500, "DB_ERROR", "Failed to list selections", e.message);
      }
    }),
  );

  /* ────────────────────────────────────────────────────────────
     ATTACHMENT DOWNLOAD (manager / owner)
     ──────────────────────────────────────────────────────────── */

  /**
   * Download a rental attachment file by its ID.
   * Accessible to MANAGER and OWNER roles.
   */
  router.get("/rental-attachments/:attachmentId/download", async ({ req, res, params }) => {
    try {
      const attachment = await prisma.rentalAttachment.findUnique({
        where: { id: params.attachmentId },
      });
      if (!attachment) {
        sendError(res, 404, "NOT_FOUND", "Attachment not found");
        return;
      }

      const fileExists = await storage.exists(attachment.storageKey);
      if (!fileExists) {
        sendError(res, 404, "NOT_FOUND", "Attachment file not found on disk");
        return;
      }

      const buffer = await storage.get(attachment.storageKey);
      res.writeHead(200, {
        "Content-Type": attachment.mimeType || "application/octet-stream",
        "Content-Length": buffer.length.toString(),
        "Content-Disposition": `inline; filename="${encodeURIComponent(attachment.fileName)}"`,
        "Cache-Control": "private, max-age=3600",
      });
      res.end(buffer);
    } catch (e: any) {
      console.error("[RENTAL] attachment download error:", e);
      sendError(res, 500, "INTERNAL_ERROR", "Failed to download attachment", e.message);
    }
  });

  /**
   * List documents (applicants + their attachments) for a rental application.
   * Returns applicant names, doc types, and attachment metadata.
   */
  router.get("/rental-applications/:id/documents", async ({ res, params }) => {
    try {
      const application = await prisma.rentalApplication.findUnique({
        where: { id: params.id },
        include: {
          applicants: {
            include: { attachments: true },
            orderBy: { createdAt: "asc" as const },
          },
        },
      });
      if (!application) {
        sendError(res, 404, "NOT_FOUND", "Application not found");
        return;
      }

      const data = application.applicants.map((a: any) => ({
        id: a.id,
        role: a.role,
        firstName: a.firstName,
        lastName: a.lastName,
        attachments: (a.attachments || []).map((att: any) => ({
          id: att.id,
          docType: att.docType,
          fileName: att.fileName,
          fileSizeBytes: att.fileSizeBytes,
          mimeType: att.mimeType,
          uploadedAt: att.uploadedAt.toISOString(),
        })),
      }));

      sendJson(res, 200, { data });
    } catch (e: any) {
      console.error("[RENTAL] list documents error:", e);
      sendError(res, 500, "DB_ERROR", "Failed to list documents", e.message);
    }
  });

  /* ────────────────────────────────────────────────────────────
     DEV: Email outbox sink
     ──────────────────────────────────────────────────────────── */

  /**
   * List enqueued emails (dev inspection endpoint).
   * Query: status (optional filter)
   */
  router.get("/dev/emails", async ({ res, orgId, query }) => {
    try {
      const status = first(query, "status") as any;
      const emails = await listEmails(orgId, status ? { status } : {});
      sendJson(res, 200, { data: emails });
    } catch (e: any) {
      console.error("[RENTAL] listEmails error:", e);
      sendError(res, 500, "DB_ERROR", "Failed to list emails", e.message);
    }
  });

  /**
   * Get a single email by ID (dev inspection).
   */
  router.get("/dev/emails/:id", async ({ res, params }) => {
    try {
      const dto = await getEmail(params.id);
      if (!dto) {
        sendError(res, 404, "NOT_FOUND", "Email not found");
        return;
      }
      sendJson(res, 200, { data: dto });
    } catch (e: any) {
      console.error("[RENTAL] getEmail error:", e);
      sendError(res, 500, "DB_ERROR", "Failed to fetch email", e.message);
    }
  });
}
