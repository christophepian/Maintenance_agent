import { EmailOutboxStatus, EmailTemplate } from "@prisma/client";
import prisma from "./prismaClient";
import { trySendImmediate } from "./emailTransport";

/* ══════════════════════════════════════════════════════════════
   EmailOutbox Service
   ══════════════════════════════════════════════════════════════

   Emails are stored in the DB outbox with status PENDING.
   When emailTransport.ts is configured (SMTP_HOST set), enqueue
   attempts immediate delivery via SMTP and marks SENT/FAILED.
   When SMTP_HOST is not set (dev mode), emails are logged to
   stdout and remain visible via the dev sink endpoint.
   ══════════════════════════════════════════════════════════════ */

/* ── DTOs ──────────────────────────────────────────────────── */

export interface EmailOutboxDTO {
  id: string;
  orgId: string;
  toEmail: string;
  template: EmailTemplate;
  subject: string;
  bodyText: string;
  status: EmailOutboxStatus;
  metaJson?: any;
  createdAt: string;
}

/* ── Mapper ────────────────────────────────────────────────── */

function mapEmailToDTO(e: any): EmailOutboxDTO {
  return {
    id: e.id,
    orgId: e.orgId,
    toEmail: e.toEmail,
    template: e.template,
    subject: e.subject,
    bodyText: e.bodyText,
    status: e.status,
    metaJson: e.metaJson ?? undefined,
    createdAt: e.createdAt.toISOString(),
  };
}

/* ── Service Functions ─────────────────────────────────────── */

/**
 * Enqueue an email in the outbox.
 * Writes to DB with status PENDING, then attempts immediate delivery
 * via the configured transport (fire-and-forget — does not block the caller).
 */
export async function enqueueEmail(
  orgId: string,
  params: {
    toEmail: string;
    template: EmailTemplate;
    subject: string;
    bodyText: string;
    metaJson?: any;
  },
): Promise<EmailOutboxDTO> {
  const email = await prisma.emailOutbox.create({
    data: {
      orgId,
      toEmail: params.toEmail,
      template: params.template,
      subject: params.subject,
      bodyText: params.bodyText,
      status: "PENDING",
      metaJson: params.metaJson || undefined,
    },
  });

  // Attempt immediate delivery (fire-and-forget — never throws)
  trySendImmediate(email.id);

  return mapEmailToDTO(email);
}

/**
 * List emails in the outbox (dev sink view).
 */
export async function listEmails(
  orgId: string,
  filters?: {
    status?: EmailOutboxStatus;
    template?: EmailTemplate;
    limit?: number;
    offset?: number;
  },
): Promise<EmailOutboxDTO[]> {
  const emails = await prisma.emailOutbox.findMany({
    where: {
      orgId,
      ...(filters?.status && { status: filters.status }),
      ...(filters?.template && { template: filters.template }),
    },
    orderBy: { createdAt: "desc" },
    take: filters?.limit || 50,
    skip: filters?.offset || 0,
  });

  return emails.map(mapEmailToDTO);
}

/**
 * Get a single email by ID.
 */
export async function getEmail(emailId: string): Promise<EmailOutboxDTO | null> {
  const email = await prisma.emailOutbox.findUnique({
    where: { id: emailId },
  });
  return email ? mapEmailToDTO(email) : null;
}

/**
 * Mark an email as sent (dev helper / future provider callback).
 */
export async function markEmailSent(emailId: string): Promise<EmailOutboxDTO> {
  const email = await prisma.emailOutbox.update({
    where: { id: emailId },
    data: { status: "SENT" },
  });
  return mapEmailToDTO(email);
}

/**
 * Mark an email as failed (provider callback).
 */
export async function markEmailFailed(emailId: string): Promise<EmailOutboxDTO> {
  const email = await prisma.emailOutbox.update({
    where: { id: emailId },
    data: { status: "FAILED" },
  });
  return mapEmailToDTO(email);
}
