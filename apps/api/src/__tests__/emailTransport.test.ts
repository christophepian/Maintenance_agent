/**
 * Unit tests for S-P0-001-01: Wire SMTP transport
 *
 * Tests emailTransport.ts — SMTP config reading, transporter creation,
 * sendEmail logic, flushPendingEmails, and dev/production mode selection.
 *
 * All DB and nodemailer calls are mocked — no real SMTP or Postgres.
 */

/* ── Mocks (must be before imports) ─────────────────────────── */

const mockSendMail = jest.fn();
const mockCreateTransport = jest.fn(() => ({ sendMail: mockSendMail }));

jest.mock("nodemailer", () => ({
  createTransport: mockCreateTransport,
}));

jest.mock("../services/prismaClient", () => ({
  __esModule: true,
  default: {
    emailOutbox: {
      findUnique: jest.fn(),
      findMany: jest.fn(),
      update: jest.fn(),
    },
  },
}));

jest.mock("../services/emailOutbox", () => ({
  markEmailSent: jest.fn(),
  markEmailFailed: jest.fn(),
}));

/* ── Imports ────────────────────────────────────────────────── */

import prisma from "../services/prismaClient";
import { markEmailSent, markEmailFailed } from "../services/emailOutbox";
import {
  getSmtpConfig,
  getTransporter,
  isSmtpConfigured,
  isDevMode,
  sendEmail,
  flushPendingEmails,
  trySendImmediate,
  _resetTransport,
} from "../services/emailTransport";

/* ── Helpers ────────────────────────────────────────────────── */

const SAMPLE_EMAIL = {
  id: "email-001",
  orgId: "org-001",
  toEmail: "tenant@example.com",
  template: "MISSING_DOCS",
  subject: "Missing documents",
  bodyText: "Please upload your ID.",
  status: "PENDING",
  metaJson: null,
  createdAt: new Date(),
};

function setSmtpEnv() {
  process.env.SMTP_HOST = "smtp.test.com";
  process.env.SMTP_PORT = "465";
  process.env.SMTP_SECURE = "true";
  process.env.SMTP_USER = "testuser";
  process.env.SMTP_PASS = "testpass";
  process.env.EMAIL_FROM = "test@test.com";
}

function clearSmtpEnv() {
  delete process.env.SMTP_HOST;
  delete process.env.SMTP_PORT;
  delete process.env.SMTP_SECURE;
  delete process.env.SMTP_USER;
  delete process.env.SMTP_PASS;
  delete process.env.EMAIL_FROM;
}

/* ── Setup / Teardown ──────────────────────────────────────── */

beforeEach(() => {
  jest.clearAllMocks();
  _resetTransport();
  clearSmtpEnv();
});

afterAll(() => {
  clearSmtpEnv();
});

/* ── getSmtpConfig ─────────────────────────────────────────── */

describe("getSmtpConfig", () => {
  test("returns null when SMTP_HOST is not set", () => {
    expect(getSmtpConfig()).toBeNull();
  });

  test("returns config when SMTP_HOST is set", () => {
    setSmtpEnv();
    const config = getSmtpConfig();
    expect(config).toEqual({
      host: "smtp.test.com",
      port: 465,
      secure: true,
      user: "testuser",
      pass: "testpass",
      from: "test@test.com",
    });
  });

  test("uses default port 587 when SMTP_PORT not set", () => {
    process.env.SMTP_HOST = "smtp.test.com";
    const config = getSmtpConfig()!;
    expect(config.port).toBe(587);
  });

  test("secure defaults to false", () => {
    process.env.SMTP_HOST = "smtp.test.com";
    const config = getSmtpConfig()!;
    expect(config.secure).toBe(false);
  });

  test("uses default FROM address when EMAIL_FROM not set", () => {
    process.env.SMTP_HOST = "smtp.test.com";
    const config = getSmtpConfig()!;
    expect(config.from).toBe("noreply@maintenance-agent.ch");
  });
});

/* ── isSmtpConfigured ──────────────────────────────────────── */

describe("isSmtpConfigured", () => {
  test("false when SMTP_HOST not set", () => {
    expect(isSmtpConfigured()).toBe(false);
  });

  test("true when SMTP_HOST set", () => {
    process.env.SMTP_HOST = "smtp.test.com";
    expect(isSmtpConfigured()).toBe(true);
  });
});

/* ── getTransporter / isDevMode ────────────────────────────── */

describe("getTransporter", () => {
  test("creates jsonTransport in dev mode (no SMTP_HOST)", () => {
    const t = getTransporter();
    expect(mockCreateTransport).toHaveBeenCalledWith({ jsonTransport: true });
    expect(isDevMode()).toBe(true);
    expect(t).toBeDefined();
  });

  test("creates SMTP transport when SMTP_HOST is set", () => {
    setSmtpEnv();
    const t = getTransporter();
    expect(mockCreateTransport).toHaveBeenCalledWith({
      host: "smtp.test.com",
      port: 465,
      secure: true,
      auth: { user: "testuser", pass: "testpass" },
    });
    expect(isDevMode()).toBe(false);
    expect(t).toBeDefined();
  });

  test("returns cached transporter on second call", () => {
    getTransporter();
    getTransporter();
    // createTransport only called once
    expect(mockCreateTransport).toHaveBeenCalledTimes(1);
  });
});

/* ── sendEmail ─────────────────────────────────────────────── */

describe("sendEmail", () => {
  test("returns error if email not found in DB", async () => {
    (prisma.emailOutbox.findUnique as jest.Mock).mockResolvedValue(null);

    const result = await sendEmail("missing-id");
    expect(result).toEqual({
      emailId: "missing-id",
      success: false,
      error: "Email not found",
    });
    expect(mockSendMail).not.toHaveBeenCalled();
  });

  test("returns error if email status is not PENDING", async () => {
    (prisma.emailOutbox.findUnique as jest.Mock).mockResolvedValue({
      ...SAMPLE_EMAIL,
      status: "SENT",
    });

    const result = await sendEmail("email-001");
    expect(result).toEqual({
      emailId: "email-001",
      success: false,
      error: "Email status is SENT, not PENDING",
    });
    expect(mockSendMail).not.toHaveBeenCalled();
  });

  test("sends email and marks SENT on success", async () => {
    (prisma.emailOutbox.findUnique as jest.Mock).mockResolvedValue(SAMPLE_EMAIL);
    mockSendMail.mockResolvedValue({ messageId: "msg-123" });

    const result = await sendEmail("email-001");

    expect(mockSendMail).toHaveBeenCalledWith({
      from: "noreply@maintenance-agent.ch",
      to: "tenant@example.com",
      subject: "Missing documents",
      text: "Please upload your ID.",
    });
    expect(markEmailSent).toHaveBeenCalledWith("email-001");
    expect(markEmailFailed).not.toHaveBeenCalled();
    expect(result.success).toBe(true);
    expect(result.messageId).toBe("msg-123");
  });

  test("uses configured FROM address when SMTP_HOST is set", async () => {
    setSmtpEnv();
    (prisma.emailOutbox.findUnique as jest.Mock).mockResolvedValue(SAMPLE_EMAIL);
    mockSendMail.mockResolvedValue({ messageId: "msg-456" });

    await sendEmail("email-001");

    expect(mockSendMail).toHaveBeenCalledWith(
      expect.objectContaining({ from: "test@test.com" }),
    );
  });

  test("increments retryCount on transport error (not yet FAILED)", async () => {
    (prisma.emailOutbox.findUnique as jest.Mock).mockResolvedValue(SAMPLE_EMAIL);
    mockSendMail.mockRejectedValue(new Error("SMTP connection refused"));
    // retryCount after increment is 1 — below MAX_RETRY_COUNT (3)
    (prisma.emailOutbox.update as jest.Mock).mockResolvedValue({ retryCount: 1 });

    const result = await sendEmail("email-001");

    expect(prisma.emailOutbox.update).toHaveBeenCalledWith(
      expect.objectContaining({ data: { retryCount: { increment: 1 } } }),
    );
    expect(markEmailFailed).not.toHaveBeenCalled();
    expect(markEmailSent).not.toHaveBeenCalled();
    expect(result.success).toBe(false);
    expect(result.error).toBe("SMTP connection refused");
  });

  test("marks FAILED permanently after MAX_RETRY_COUNT failures", async () => {
    (prisma.emailOutbox.findUnique as jest.Mock).mockResolvedValue(SAMPLE_EMAIL);
    mockSendMail.mockRejectedValue(new Error("SMTP connection refused"));
    // retryCount has hit 3 — permanently failed
    (prisma.emailOutbox.update as jest.Mock).mockResolvedValue({ retryCount: 3 });

    const result = await sendEmail("email-001");

    expect(markEmailFailed).toHaveBeenCalledWith("email-001");
    expect(markEmailSent).not.toHaveBeenCalled();
    expect(result.success).toBe(false);
  });
});

/* ── flushPendingEmails ────────────────────────────────────── */

describe("flushPendingEmails", () => {
  test("returns empty array when no pending emails", async () => {
    (prisma.emailOutbox.findMany as jest.Mock).mockResolvedValue([]);

    const results = await flushPendingEmails();
    expect(results).toEqual([]);
    expect(mockSendMail).not.toHaveBeenCalled();
  });

  test("processes all pending emails sequentially", async () => {
    const email2 = { ...SAMPLE_EMAIL, id: "email-002", toEmail: "owner@example.com" };
    (prisma.emailOutbox.findMany as jest.Mock).mockResolvedValue([
      SAMPLE_EMAIL,
      email2,
    ]);
    (prisma.emailOutbox.findUnique as jest.Mock)
      .mockResolvedValueOnce(SAMPLE_EMAIL)
      .mockResolvedValueOnce(email2);
    mockSendMail.mockResolvedValue({ messageId: "msg-flush" });

    const results = await flushPendingEmails();

    expect(results).toHaveLength(2);
    expect(results[0].success).toBe(true);
    expect(results[1].success).toBe(true);
    expect(markEmailSent).toHaveBeenCalledTimes(2);
  });
});

/* ── trySendImmediate ──────────────────────────────────────── */

describe("trySendImmediate", () => {
  test("does not throw on failure", async () => {
    (prisma.emailOutbox.findUnique as jest.Mock).mockRejectedValue(
      new Error("DB down"),
    );

    // Should not throw
    await expect(trySendImmediate("email-001")).resolves.toBeUndefined();
  });

  test("sends email successfully", async () => {
    (prisma.emailOutbox.findUnique as jest.Mock).mockResolvedValue(SAMPLE_EMAIL);
    mockSendMail.mockResolvedValue({ messageId: "msg-imm" });

    await trySendImmediate("email-001");

    expect(mockSendMail).toHaveBeenCalled();
    expect(markEmailSent).toHaveBeenCalledWith("email-001");
  });
});

/* ── _resetTransport ───────────────────────────────────────── */

describe("_resetTransport", () => {
  test("clears the cached transporter", () => {
    getTransporter(); // creates one
    expect(mockCreateTransport).toHaveBeenCalledTimes(1);

    _resetTransport();
    getTransporter(); // should create a new one
    expect(mockCreateTransport).toHaveBeenCalledTimes(2);
  });
});
