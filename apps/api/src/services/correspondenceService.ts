/**
 * Correspondence Service
 *
 * AI-assisted letter drafting + send/read/reply logic for the
 * manager → tenant correspondence feature.
 */

import { PrismaClient, LetterTemplateType } from "@prisma/client";
import { enqueueEmail } from "./emailOutbox";
import { trySendImmediate } from "./emailTransport";
import * as userRepo from "../repositories/userRepository";
import { createNotification } from "./notifications";

// ── AI draft ─────────────────────────────────────────────────────────────────

export interface DraftResult {
  subject: string;
  body: string;
}

const TEMPLATE_PROMPTS: Record<LetterTemplateType, string> = {
  GENERAL:
    "Write a professional, friendly general-purpose letter from a property manager to a tenant.",
  MAINTENANCE_NOTICE:
    "Write a professional notice informing tenants of upcoming maintenance, a handyman absence, or a substitute contact person.",
  COMPLIANCE_REQUEST:
    "Write a polite but firm request asking tenants to comply with building regulations (e.g. clearing hallways, noise, parking).",
  FINANCIAL_NOTICE:
    "Write a clear notice regarding a financial matter — reimbursement, charge adjustment, or upcoming cost.",
  SEASONAL:
    "Write a friendly seasonal notice — holiday coverage, emergency contacts, building closure, or seasonal maintenance.",
  LEASE_ADMIN:
    "Write a professional administrative letter regarding lease-related matters — renewal reminder, document request, or administrative update.",
};

export async function generateLetterDraft(
  templateType: LetterTemplateType,
  context: {
    buildingName?: string;
    managerName?: string;
    additionalContext?: string;
    lang?: string;
  },
): Promise<DraftResult> {
  const { getAnthropicClient } = await import("./aiClient");
  const client = getAnthropicClient();

  const lang = context.lang ?? "fr";
  const langLabel = lang === "fr" ? "French" : lang === "de" ? "German" : "English";
  const today = new Date().toLocaleDateString("fr-CH", {
    day: "numeric",
    month: "long",
    year: "numeric",
  });

  const templateInstruction = TEMPLATE_PROMPTS[templateType];

  const prompt = `You are a Swiss property management assistant drafting a formal letter.

Task: ${templateInstruction}

Context:
- Building: ${context.buildingName ?? "(unspecified)"}
- Property manager: ${context.managerName ?? "(unspecified)"}
- Date: ${today}
- Language: ${langLabel}
${context.additionalContext ? `- Additional context: ${context.additionalContext}` : ""}

Requirements:
- Address the tenant formally as "Madame, Monsieur," (FR) or equivalent
- Use "{{tenant_name}}" as a placeholder for the recipient's name if personalising
- Keep the tone professional and concise
- Sign off with the manager's name (or "La Gérance" if unspecified)
- Do NOT include address blocks or date headers — just the letter body

Respond with ONLY valid JSON in this format:
{
  "subject": "short subject line (max 80 chars)",
  "body": "full letter body text"
}`;

  const response = await client.messages.create({
    model: "claude-sonnet-4-6",
    max_tokens: 1200,
    messages: [{ role: "user", content: prompt }],
  });

  const raw = response.content.find((b) => b.type === "text")?.text ?? "";
  const jsonMatch = raw.match(/\{[\s\S]*\}/);
  if (!jsonMatch) throw new Error("No JSON in Claude response");

  const parsed = JSON.parse(jsonMatch[0]) as { subject?: unknown; body?: unknown };
  return {
    subject: typeof parsed.subject === "string" ? parsed.subject : "",
    body: typeof parsed.body === "string" ? parsed.body : raw,
  };
}

// ── Send helpers ──────────────────────────────────────────────────────────────

export async function sendLetterToRecipients(
  prisma: PrismaClient,
  letterId: string,
  tenantIds: string[],
  orgId: string,
): Promise<void> {
  const letter = await prisma.letter.findUnique({ where: { id: letterId } });
  if (!letter) throw new Error("Letter not found");

  // Upsert recipients (idempotent — safe to call on re-send)
  await prisma.letterRecipient.createMany({
    data: tenantIds.map((tenantId) => ({ letterId, tenantId })),
    skipDuplicates: true,
  });

  // Mark letter as sent
  await prisma.letter.update({
    where: { id: letterId },
    data: { status: "SENT", sentAt: new Date() },
  });

  // Enqueue one email per recipient who has an email address
  const tenants = await prisma.tenant.findMany({
    where: { id: { in: tenantIds }, orgId },
    select: { id: true, email: true, name: true },
  });

  for (const tenant of tenants) {
    if (!tenant.email) continue;
    const greeting = tenant.name ? `Chère/Cher ${tenant.name},\n\n` : "";
    const emailBody = `${greeting}${letter.body}`;

    const emailRecord = await enqueueEmail(orgId, {
      toEmail: tenant.email,
      template: "TENANT_LETTER",
      subject: letter.subject,
      bodyText: emailBody,
      metaJson: { letterId, tenantId: tenant.id },
    });

    // Mark email sent timestamp on recipient
    await prisma.letterRecipient.update({
      where: { letterId_tenantId: { letterId, tenantId: tenant.id } },
      data: { emailSentAt: new Date() },
    });

    trySendImmediate(emailRecord.id);
  }
}

// ── Read + respond ────────────────────────────────────────────────────────────

export async function markLetterRead(
  prisma: PrismaClient,
  letterId: string,
  tenantId: string,
): Promise<void> {
  await prisma.letterRecipient.updateMany({
    where: { letterId, tenantId, readAt: null },
    data: { readAt: new Date() },
  });
}

export async function createLetterResponse(
  prisma: PrismaClient,
  letterId: string,
  tenantId: string,
  content: string,
): Promise<void> {
  // Verify tenant is a recipient
  const recipient = await prisma.letterRecipient.findUnique({
    where: { letterId_tenantId: { letterId, tenantId } },
    include: { letter: { select: { orgId: true, subject: true } } },
  });
  if (!recipient) throw Object.assign(new Error("Not a recipient"), { code: "FORBIDDEN" });

  await prisma.letterResponse.create({
    data: { letterId, tenantId, content },
  });

  // Notify all managers in the org
  const { orgId, subject } = recipient.letter;
  const tenant = await prisma.tenant.findUnique({ where: { id: tenantId }, select: { name: true } });
  const tenantLabel = tenant?.name || "A tenant";
  const managers = await userRepo.findManagersByOrg(prisma, orgId);
  for (const mgr of managers) {
    await createNotification({
      orgId,
      userId: mgr.id,
      entityType: "LETTER",
      entityId: letterId,
      eventType: "LETTER_REPLY_RECEIVED",
      message: `${tenantLabel} replied to "${subject}".`,
    });
  }
}
