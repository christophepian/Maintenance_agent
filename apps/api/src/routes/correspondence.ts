/**
 * Correspondence routes — manager → tenant formal letters.
 *
 * Manager endpoints:
 *   GET    /correspondence              — list letters (drafts + sent)
 *   POST   /correspondence              — create draft
 *   GET    /correspondence/:id          — letter detail + recipients + responses
 *   PATCH  /correspondence/:id          — update draft
 *   DELETE /correspondence/:id          — delete draft
 *   POST   /correspondence/:id/ai-draft — generate AI draft
 *   POST   /correspondence/:id/send     — send to recipients
 *
 * Tenant endpoints:
 *   GET    /tenant-portal/letters        — tenant inbox
 *   GET    /tenant-portal/letters/:id    — read letter (marks readAt)
 *   POST   /tenant-portal/letters/:id/respond — tenant reply
 *
 * Owner endpoints:
 *   GET    /owner/letters?buildingId=   — read-only view for a building
 */

import { Router } from "../http/router";
import { sendError, sendJson } from "../http/json";
import { readJson } from "../http/body";
import { maybeRequireManager, requireTenantSession, requireOwnerSession } from "../authz";
import { LetterTemplateType, LetterStatus } from "@prisma/client";
import {
  generateLetterDraft,
  sendLetterToRecipients,
  markLetterRead,
  createLetterResponse,
} from "../services/correspondenceService";

const VALID_TEMPLATE_TYPES = Object.values(LetterTemplateType);

export function registerCorrespondenceRoutes(router: Router) {

  // ── GET /correspondence — list manager's letters ──────────────────────────
  router.get("/correspondence", async ({ req, res, orgId, prisma }) => {
    if (!maybeRequireManager(req, res)) return;
    try {
      const letters = await prisma.letter.findMany({
        where: { orgId },
        include: {
          _count: { select: { recipients: true, responses: true } },
        },
        orderBy: { createdAt: "desc" },
      });
      sendJson(res, 200, {
        data: letters.map((l) => ({
          id: l.id,
          subject: l.subject,
          templateType: l.templateType,
          status: l.status,
          lang: l.lang,
          sentAt: l.sentAt,
          createdAt: l.createdAt,
          recipientCount: l._count.recipients,
          responseCount: l._count.responses,
        })),
      });
    } catch (e) {
      sendError(res, 500, "DB_ERROR", "Failed to list letters", String(e));
    }
  });

  // ── POST /correspondence — create draft ───────────────────────────────────
  router.post("/correspondence", async ({ req, res, orgId, prisma }) => {
    if (!maybeRequireManager(req, res)) return;
    try {
      const body = await readJson(req) as any;
      const letter = await prisma.letter.create({
        data: {
          orgId,
          subject: body.subject ?? "",
          body: body.body ?? "",
          templateType: VALID_TEMPLATE_TYPES.includes(body.templateType)
            ? body.templateType
            : LetterTemplateType.GENERAL,
          lang: ["fr", "de", "en"].includes(body.lang) ? body.lang : "fr",
          status: LetterStatus.DRAFT,
        },
      });
      sendJson(res, 201, { data: letter });
    } catch (e) {
      sendError(res, 500, "DB_ERROR", "Failed to create letter", String(e));
    }
  });

  // ── GET /correspondence/:id — letter detail ───────────────────────────────
  router.get("/correspondence/:id", async ({ req, res, orgId, prisma, params }) => {
    if (!maybeRequireManager(req, res)) return;
    try {
      const letter = await prisma.letter.findFirst({
        where: { id: params.id, orgId },
        include: {
          recipients: {
            include: { tenant: { select: { id: true, name: true, email: true, phone: true } } },
          },
          responses: {
            include: { tenant: { select: { id: true, name: true } } },
            orderBy: { createdAt: "asc" },
          },
        },
      });
      if (!letter) return sendError(res, 404, "NOT_FOUND", "Letter not found");
      sendJson(res, 200, { data: letter });
    } catch (e) {
      sendError(res, 500, "DB_ERROR", "Failed to fetch letter", String(e));
    }
  });

  // ── PATCH /correspondence/:id — update draft ──────────────────────────────
  router.patch("/correspondence/:id", async ({ req, res, orgId, prisma, params }) => {
    if (!maybeRequireManager(req, res)) return;
    try {
      const letter = await prisma.letter.findFirst({ where: { id: params.id, orgId } });
      if (!letter) return sendError(res, 404, "NOT_FOUND", "Letter not found");
      if (letter.status !== LetterStatus.DRAFT) {
        return sendError(res, 409, "CONFLICT", "Only draft letters can be edited");
      }
      const body = await readJson(req) as any;
      const updated = await prisma.letter.update({
        where: { id: params.id },
        data: {
          ...(body.subject !== undefined && { subject: body.subject }),
          ...(body.body !== undefined && { body: body.body }),
          ...(VALID_TEMPLATE_TYPES.includes(body.templateType) && { templateType: body.templateType }),
          ...(["fr", "de", "en"].includes(body.lang) && { lang: body.lang }),
        },
      });
      sendJson(res, 200, { data: updated });
    } catch (e) {
      sendError(res, 500, "DB_ERROR", "Failed to update letter", String(e));
    }
  });

  // ── DELETE /correspondence/:id — delete draft ─────────────────────────────
  router.delete("/correspondence/:id", async ({ req, res, orgId, prisma, params }) => {
    if (!maybeRequireManager(req, res)) return;
    try {
      const letter = await prisma.letter.findFirst({ where: { id: params.id, orgId } });
      if (!letter) return sendError(res, 404, "NOT_FOUND", "Letter not found");
      if (letter.status !== LetterStatus.DRAFT) {
        return sendError(res, 409, "CONFLICT", "Only draft letters can be deleted");
      }
      await prisma.letter.delete({ where: { id: params.id } });
      sendJson(res, 200, { data: { ok: true } });
    } catch (e) {
      sendError(res, 500, "DB_ERROR", "Failed to delete letter", String(e));
    }
  });

  // ── POST /correspondence/:id/ai-draft — AI generation ────────────────────
  router.post("/correspondence/:id/ai-draft", async ({ req, res, orgId, prisma, params }) => {
    if (!maybeRequireManager(req, res)) return;
    try {
      const letter = await prisma.letter.findFirst({ where: { id: params.id, orgId } });
      if (!letter) return sendError(res, 404, "NOT_FOUND", "Letter not found");

      const body = await readJson(req).catch(() => ({})) as any;

      // Pull building name from first recipient's building if available, else from body
      let buildingName = body.buildingName as string | undefined;
      if (!buildingName) {
        const firstRecipient = await prisma.letterRecipient.findFirst({
          where: { letterId: params.id },
          include: {
            tenant: {
              include: {
                occupancies: {
                  include: { unit: { include: { building: { select: { name: true } } } } },
                  take: 1,
                },
              },
            },
          },
        });
        buildingName = firstRecipient?.tenant?.occupancies?.[0]?.unit?.building?.name;
      }

      const draft = await generateLetterDraft(letter.templateType, {
        buildingName,
        managerName: body.managerName,
        additionalContext: body.additionalContext,
        lang: letter.lang,
      });

      // Update the letter with the generated draft
      await prisma.letter.update({
        where: { id: params.id },
        data: { subject: draft.subject, body: draft.body },
      });

      sendJson(res, 200, { data: draft });
    } catch (e: any) {
      console.error("[correspondence/ai-draft]", e);
      sendError(res, 500, "AI_ERROR", "Failed to generate draft", String(e));
    }
  });

  // ── POST /correspondence/:id/send — send to recipients ───────────────────
  router.post("/correspondence/:id/send", async ({ req, res, orgId, prisma, params }) => {
    if (!maybeRequireManager(req, res)) return;
    try {
      const letter = await prisma.letter.findFirst({ where: { id: params.id, orgId } });
      if (!letter) return sendError(res, 404, "NOT_FOUND", "Letter not found");
      if (!letter.subject.trim() || !letter.body.trim()) {
        return sendError(res, 400, "VALIDATION_ERROR", "Subject and body are required before sending");
      }

      const body = await readJson(req) as any;
      const tenantIds: string[] = Array.isArray(body.tenantIds) ? body.tenantIds : [];
      if (tenantIds.length === 0) {
        return sendError(res, 400, "VALIDATION_ERROR", "At least one recipient is required");
      }

      // Verify all tenants belong to this org
      const validTenants = await prisma.tenant.findMany({
        where: { id: { in: tenantIds }, orgId },
        select: { id: true },
      });
      if (validTenants.length !== tenantIds.length) {
        return sendError(res, 400, "VALIDATION_ERROR", "Some tenants are invalid");
      }

      await sendLetterToRecipients(prisma, params.id, tenantIds, orgId);
      sendJson(res, 200, { data: { ok: true, recipientCount: tenantIds.length } });
    } catch (e: any) {
      console.error("[correspondence/send]", e);
      sendError(res, 500, "DB_ERROR", "Failed to send letter", String(e));
    }
  });

  // ── GET /tenant-portal/letters — tenant inbox ─────────────────────────────
  router.get("/tenant-portal/letters", async ({ req, res, orgId, prisma }) => {
    const tenantId = requireTenantSession(req, res);
    if (!tenantId) return;
    try {
      const recipients = await prisma.letterRecipient.findMany({
        where: { tenantId, letter: { orgId, status: LetterStatus.SENT } },
        include: { letter: { select: { id: true, subject: true, sentAt: true, templateType: true } } },
        orderBy: { letter: { sentAt: "desc" } },
      });
      sendJson(res, 200, {
        data: recipients.map((r) => ({
          letterId: r.letterId,
          subject: r.letter.subject,
          templateType: r.letter.templateType,
          sentAt: r.letter.sentAt,
          readAt: r.readAt,
          unread: !r.readAt,
        })),
      });
    } catch (e) {
      sendError(res, 500, "DB_ERROR", "Failed to list letters", String(e));
    }
  });

  // ── GET /tenant-portal/letters/:id — read letter ──────────────────────────
  router.get("/tenant-portal/letters/:id", async ({ req, res, orgId, prisma, params }) => {
    const tenantId = requireTenantSession(req, res);
    if (!tenantId) return;
    try {
      const recipient = await prisma.letterRecipient.findUnique({
        where: { letterId_tenantId: { letterId: params.id, tenantId } },
        include: {
          letter: {
            include: {
              responses: {
                where: { tenantId },
                orderBy: { createdAt: "asc" },
              },
            },
          },
        },
      });
      if (!recipient || recipient.letter.orgId !== orgId) {
        return sendError(res, 404, "NOT_FOUND", "Letter not found");
      }

      // Mark as read
      await markLetterRead(prisma, params.id, tenantId);

      sendJson(res, 200, {
        data: {
          id: recipient.letter.id,
          subject: recipient.letter.subject,
          body: recipient.letter.body,
          templateType: recipient.letter.templateType,
          sentAt: recipient.letter.sentAt,
          readAt: recipient.readAt ?? new Date(),
          responses: recipient.letter.responses,
        },
      });
    } catch (e) {
      sendError(res, 500, "DB_ERROR", "Failed to fetch letter", String(e));
    }
  });

  // ── POST /tenant-portal/letters/:id/respond — tenant reply ───────────────
  router.post("/tenant-portal/letters/:id/respond", async ({ req, res, orgId, prisma, params }) => {
    const tenantId = requireTenantSession(req, res);
    if (!tenantId) return;
    try {
      const body = await readJson(req) as any;
      const content = typeof body.content === "string" ? body.content.trim() : "";
      if (!content) return sendError(res, 400, "VALIDATION_ERROR", "Content is required");
      if (content.length > 4000) return sendError(res, 400, "VALIDATION_ERROR", "Response too long");

      await createLetterResponse(prisma, params.id, tenantId, content);
      sendJson(res, 201, { data: { ok: true } });
    } catch (e: any) {
      if (e.code === "FORBIDDEN") return sendError(res, 403, "FORBIDDEN", "Not a recipient");
      sendError(res, 500, "DB_ERROR", "Failed to save response", String(e));
    }
  });

  // ── GET /owner/letters — owner read-only view ─────────────────────────────
  router.get("/owner/letters", async ({ req, res, orgId, prisma, query }) => {
    const ownerId = requireOwnerSession(req, res);
    if (!ownerId) return;
    try {
      const buildingId = Array.isArray(query.buildingId)
        ? query.buildingId[0]
        : query.buildingId as string | undefined;

      // Verify building belongs to this owner
      if (buildingId) {
        const ownership = await prisma.buildingOwner.findFirst({
          where: { userId: ownerId, buildingId, building: { orgId } },
        });
        if (!ownership) return sendError(res, 403, "FORBIDDEN", "Not your building");
      }

      // Find tenants in this owner's buildings
      const units = await prisma.unit.findMany({
        where: { orgId, ...(buildingId ? { buildingId } : {}) },
        select: { id: true },
      });
      const unitIds = units.map((u) => u.id);

      const occupancies = await prisma.occupancy.findMany({
        where: { unitId: { in: unitIds } },
        select: { tenantId: true },
      });
      const tenantIds = [...new Set(occupancies.map((o) => o.tenantId))];

      const letters = await prisma.letter.findMany({
        where: {
          orgId,
          status: LetterStatus.SENT,
          recipients: { some: { tenantId: { in: tenantIds } } },
        },
        include: { _count: { select: { recipients: true } } },
        orderBy: { sentAt: "desc" },
      });

      sendJson(res, 200, {
        data: letters.map((l) => ({
          id: l.id,
          subject: l.subject,
          templateType: l.templateType,
          sentAt: l.sentAt,
          recipientCount: l._count.recipients,
        })),
      });
    } catch (e) {
      sendError(res, 500, "DB_ERROR", "Failed to list letters", String(e));
    }
  });
}
