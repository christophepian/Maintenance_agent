/**
 * Email Transport Service
 *
 * Bridges the EmailOutbox (DB queue) with an actual delivery provider.
 *
 * Provider priority (first match wins):
 *  1. Resend  — when RESEND_API_KEY is set
 *  2. SMTP    — when SMTP_HOST is set (nodemailer)
 *  3. Dev console — fallback; logs to stdout, nothing leaves the machine
 *
 * Retry logic:
 *  • Each failed send increments retryCount on the EmailOutbox row.
 *  • After MAX_RETRY_COUNT failures the record is marked FAILED permanently.
 *
 * Public API:
 *  • `sendEmail(emailId)`        — send one PENDING email
 *  • `flushPendingEmails()`      — process all PENDING outbox items
 *  • `trySendImmediate(emailId)` — fire-and-forget for inline use
 *
 * Layer: service (calls emailOutbox service + prismaClient).
 *
 * Env vars (see .env.example):
 *   RESEND_API_KEY, EMAIL_FROM_ADDRESS
 *   SMTP_HOST, SMTP_PORT, SMTP_USER, SMTP_PASS, EMAIL_FROM
 */

import * as nodemailer from "nodemailer";
import { Transporter } from "nodemailer";
import { Resend } from "resend";
import { EmailOutboxStatus } from "@prisma/client";
import prisma from "./prismaClient";
import { markEmailSent, markEmailFailed } from "./emailOutbox";

/* ── Constants ─────────────────────────────────────────────── */

const MAX_RETRY_COUNT = 3;

/* ── Configuration ─────────────────────────────────────────── */

export interface SmtpConfig {
  host: string;
  port: number;
  secure: boolean;
  user: string;
  pass: string;
  from: string;
}

/**
 * Read SMTP config from environment. Returns null if SMTP_HOST is not set.
 */
export function getSmtpConfig(): SmtpConfig | null {
  const host = process.env.SMTP_HOST;
  if (!host) return null;

  return {
    host,
    port: parseInt(process.env.SMTP_PORT || "587", 10),
    secure: process.env.SMTP_SECURE === "true",
    user: process.env.SMTP_USER || "",
    pass: process.env.SMTP_PASS || "",
    from: process.env.EMAIL_FROM || "noreply@maintenance-agent.ch",
  };
}

/**
 * Returns the FROM address to use when sending.
 * Priority: EMAIL_FROM_ADDRESS > SMTP config from > hard-coded default.
 */
function getFromAddress(): string {
  if (process.env.EMAIL_FROM_ADDRESS) return process.env.EMAIL_FROM_ADDRESS;
  const smtp = getSmtpConfig();
  if (smtp?.from) return smtp.from;
  return "noreply@maintenance-agent.ch";
}

/* ── Provider detection ────────────────────────────────────── */

type Provider = "resend" | "smtp" | "dev";

function detectProvider(): Provider {
  if (process.env.RESEND_API_KEY) return "resend";
  if (process.env.SMTP_HOST) return "smtp";
  return "dev";
}

/* ── SMTP transport singleton ──────────────────────────────── */

let _transporter: Transporter | null = null;

export function getTransporter(): Transporter {
  if (_transporter) return _transporter;

  const config = getSmtpConfig();
  if (config) {
    _transporter = nodemailer.createTransport({
      host: config.host,
      port: config.port,
      secure: config.secure,
      auth: { user: config.user, pass: config.pass },
    });
    console.log(`📧 Email transport: SMTP → ${config.host}:${config.port}`);
  } else {
    _transporter = nodemailer.createTransport({ jsonTransport: true });
    console.log("📧 Email transport: dev console (no provider configured — emails logged to stdout)");
  }

  return _transporter;
}

/* ── Legacy helpers (kept for external callers) ────────────── */

export function isSmtpConfigured(): boolean {
  return getSmtpConfig() !== null;
}

export function isDevMode(): boolean {
  return detectProvider() === "dev";
}

/* ── Send functions ────────────────────────────────────────── */

export interface SendResult {
  emailId: string;
  success: boolean;
  messageId?: string;
  error?: string;
}

/**
 * Increment retryCount, then mark FAILED if we've hit the limit.
 * Returns true if the record was permanently failed (caller should stop retrying).
 */
async function handleFailedAttempt(emailId: string, errorMessage: string): Promise<boolean> {
  const updated = await prisma.emailOutbox.update({
    where: { id: emailId },
    data: { retryCount: { increment: 1 } },
    select: { retryCount: true },
  });

  if (updated.retryCount >= MAX_RETRY_COUNT) {
    await markEmailFailed(emailId);
    console.error(`📧 Email ${emailId} permanently FAILED after ${updated.retryCount} attempts: ${errorMessage}`);
    return true;
  }

  console.warn(`📧 Email ${emailId} send failed (attempt ${updated.retryCount}/${MAX_RETRY_COUNT}): ${errorMessage}`);
  return false;
}

/**
 * Send a single email by its outbox ID.
 * Loads the record from DB, sends via the active provider, marks SENT or increments retry/FAILED.
 */
export async function sendEmail(emailId: string): Promise<SendResult> {
  const email = await prisma.emailOutbox.findUnique({
    where: { id: emailId },
  });

  if (!email) {
    return { emailId, success: false, error: "Email not found" };
  }

  if (email.status !== "PENDING") {
    return { emailId, success: false, error: `Email status is ${email.status}, not PENDING` };
  }

  const provider = detectProvider();
  const from = getFromAddress();

  /* ── Resend ── */
  if (provider === "resend") {
    const resend = new Resend(process.env.RESEND_API_KEY!);
    try {
      const { data, error } = await resend.emails.send({
        from,
        to: [email.toEmail],
        subject: email.subject,
        text: email.bodyText,
      });

      if (error) {
        await handleFailedAttempt(emailId, error.message);
        return { emailId, success: false, error: error.message };
      }

      await markEmailSent(emailId);
      return { emailId, success: true, messageId: data?.id };
    } catch (err: any) {
      const msg = err?.message || String(err);
      await handleFailedAttempt(emailId, msg);
      return { emailId, success: false, error: msg };
    }
  }

  /* ── SMTP / dev console ── */
  const transport = getTransporter();
  try {
    const info = await transport.sendMail({
      from,
      to: email.toEmail,
      subject: email.subject,
      text: email.bodyText,
    });

    if (provider === "dev") {
      console.log(`📧 [DEV] Email → ${email.toEmail} | Subject: ${email.subject}`);
      console.log(`   Template: ${email.template} | ID: ${email.id}`);
    }

    await markEmailSent(emailId);
    return { emailId, success: true, messageId: info.messageId || info.message };
  } catch (err: any) {
    const msg = err?.message || String(err);
    await handleFailedAttempt(emailId, msg);
    return { emailId, success: false, error: msg };
  }
}

/**
 * Process all PENDING emails in the outbox.
 * Returns an array of results (one per email attempted).
 */
export async function flushPendingEmails(): Promise<SendResult[]> {
  const pendingEmails = await prisma.emailOutbox.findMany({
    where: { status: "PENDING" as EmailOutboxStatus },
    orderBy: { createdAt: "asc" },
  });

  if (pendingEmails.length === 0) {
    return [];
  }

  console.log(`📧 Flushing ${pendingEmails.length} pending email(s)...`);

  const results: SendResult[] = [];
  for (const email of pendingEmails) {
    const result = await sendEmail(email.id);
    results.push(result);
  }

  const sent = results.filter((r) => r.success).length;
  const failed = results.filter((r) => !r.success).length;
  console.log(`📧 Flush complete: ${sent} sent, ${failed} failed`);

  return results;
}

/**
 * Fire-and-forget send for inline use after enqueueEmail().
 * Does not throw — logs errors silently.
 */
export async function trySendImmediate(emailId: string): Promise<void> {
  try {
    await sendEmail(emailId);
  } catch (err: any) {
    console.error(`📧 trySendImmediate failed for ${emailId}:`, err?.message || err);
  }
}

/* ── Testing helpers ───────────────────────────────────────── */

/**
 * Reset the transport singleton (for testing).
 */
export function _resetTransport(): void {
  _transporter = null;
}
