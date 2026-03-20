/**
 * Email Transport Service
 *
 * Bridges the EmailOutbox (DB queue) with an actual SMTP transport.
 *
 * Design:
 *  • If SMTP_HOST is set, uses nodemailer with real SMTP credentials.
 *  • If SMTP_HOST is not set, uses a "dev console" transport that logs
 *    to stdout — no emails leave the machine in development.
 *  • `sendEmail(emailId)` — sends one PENDING email, marks SENT/FAILED.
 *  • `flushPendingEmails()` — processes all PENDING outbox items.
 *  • `trySendImmediate(emailId)` — fire-and-forget for inline use.
 *
 * Layer: service (calls emailOutbox service + prismaClient).
 *
 * Env vars (see .env.example):
 *   SMTP_HOST, SMTP_PORT, SMTP_USER, SMTP_PASS, EMAIL_FROM
 */

import * as nodemailer from "nodemailer";
import { Transporter } from "nodemailer";
import { EmailOutboxStatus } from "@prisma/client";
import prisma from "./prismaClient";
import { markEmailSent, markEmailFailed } from "./emailOutbox";

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

/* ── Transport singleton ───────────────────────────────────── */

let _transporter: Transporter | null = null;
let _isDevMode = false;

/**
 * Returns true if SMTP is configured and transport is available.
 */
export function isSmtpConfigured(): boolean {
  return getSmtpConfig() !== null;
}

/**
 * Creates or returns the cached nodemailer transporter.
 * In dev mode (no SMTP_HOST), returns a "console" transport that
 * logs email details to stdout.
 */
export function getTransporter(): Transporter {
  if (_transporter) return _transporter;

  const config = getSmtpConfig();

  if (config) {
    _transporter = nodemailer.createTransport({
      host: config.host,
      port: config.port,
      secure: config.secure,
      auth: {
        user: config.user,
        pass: config.pass,
      },
    });
    _isDevMode = false;
    console.log(`📧 Email transport: SMTP → ${config.host}:${config.port}`);
  } else {
    // Dev console transport — logs but doesn't send
    _transporter = nodemailer.createTransport({
      jsonTransport: true,
    });
    _isDevMode = true;
    console.log("📧 Email transport: dev console (SMTP_HOST not set — emails logged to stdout)");
  }

  return _transporter;
}

/**
 * Returns true if the transport is in dev/console mode.
 */
export function isDevMode(): boolean {
  getTransporter(); // ensure initialized
  return _isDevMode;
}

/* ── Send functions ────────────────────────────────────────── */

export interface SendResult {
  emailId: string;
  success: boolean;
  messageId?: string;
  error?: string;
}

/**
 * Send a single email by its outbox ID.
 * Loads the record from DB, sends via transport, marks SENT or FAILED.
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

  const config = getSmtpConfig();
  const from = config?.from || "noreply@maintenance-agent.ch";
  const transport = getTransporter();

  try {
    const info = await transport.sendMail({
      from,
      to: email.toEmail,
      subject: email.subject,
      text: email.bodyText,
    });

    if (_isDevMode) {
      console.log(`📧 [DEV] Email → ${email.toEmail} | Subject: ${email.subject}`);
      console.log(`   Template: ${email.template} | ID: ${email.id}`);
    }

    await markEmailSent(emailId);

    return {
      emailId,
      success: true,
      messageId: info.messageId || info.message,
    };
  } catch (err: any) {
    const errorMessage = err?.message || String(err);
    console.error(`📧 FAILED to send email ${emailId}: ${errorMessage}`);

    await markEmailFailed(emailId);

    return {
      emailId,
      success: false,
      error: errorMessage,
    };
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
 * This is used to attempt immediate delivery after enqueueing.
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
  _isDevMode = false;
}
