/**
 * Capture Session Service
 *
 * Manages short-lived capture sessions for QR-based phone handoff.
 * A manager creates a session on desktop → gets a QR code → user
 * scans with phone → captures photos → submits → triggers ingestion.
 *
 * Security:
 *   - Session token is a signed JWT scoped to { sessionId, orgId, purpose }
 *   - 15-minute expiry
 *   - Token grants upload-only access — no account info
 *   - Completed/expired sessions reject all further requests
 */

import * as jwt from "jsonwebtoken";
import {
  createCaptureSession,
  findCaptureSessionByToken,
  findCaptureSessionById,
  updateCaptureSession,
  listCaptureSessionsByOrg,
  expireOldSessions,
} from "../repositories/captureSessionRepository";
import type { CaptureSessionWithInclude } from "../repositories/captureSessionRepository";
import { CaptureSessionStatus } from "@prisma/client";

/* ──────────────────────────────────────────────────────────
   Constants
   ────────────────────────────────────────────────────────── */

const SESSION_TTL_MINUTES = 15;
const AUTH_SECRET = process.env.AUTH_SECRET || "dev-secret-key-change-in-prod";
const MAX_UPLOADS_PER_SESSION = 20;

/* ──────────────────────────────────────────────────────────
   Token payload
   ────────────────────────────────────────────────────────── */

interface CaptureTokenPayload {
  sessionId: string;
  orgId: string;
  purpose: "invoice-capture";
}

/* ──────────────────────────────────────────────────────────
   Public DTOs
   ────────────────────────────────────────────────────────── */

export interface CaptureSessionDTO {
  id: string;
  orgId: string;
  createdBy: string;
  status: CaptureSessionStatus;
  expiresAt: string;
  targetType: string;
  uploadedFileUrls: string[];
  createdInvoiceId: string | null;
  createdAt: string;
}

export function mapSessionToDTO(s: CaptureSessionWithInclude): CaptureSessionDTO {
  return {
    id: s.id,
    orgId: s.orgId,
    createdBy: s.createdBy,
    status: s.status,
    expiresAt: s.expiresAt.toISOString(),
    targetType: s.targetType,
    uploadedFileUrls: s.uploadedFileUrls,
    createdInvoiceId: s.createdInvoiceId,
    createdAt: s.createdAt.toISOString(),
  };
}

/* ──────────────────────────────────────────────────────────
   Service functions
   ────────────────────────────────────────────────────────── */

/**
 * Create a new capture session.
 * Returns the session + signed token + mobile URL data.
 */
export async function createSession(
  orgId: string,
  userId: string,
): Promise<{ session: CaptureSessionDTO; token: string; mobileUrl: string }> {
  const expiresAt = new Date(Date.now() + SESSION_TTL_MINUTES * 60 * 1000);

  // Create session record first to get the ID
  const session = await createCaptureSession({
    org: { connect: { id: orgId } },
    createdBy: userId,
    token: "placeholder", // will be updated with signed JWT
    expiresAt,
    sourceChannel: "MOBILE_CAPTURE",
    targetType: "INVOICE",
  });

  // Generate signed token with session ID embedded
  const tokenPayload: CaptureTokenPayload = {
    sessionId: session.id,
    orgId,
    purpose: "invoice-capture",
  };
  const token = jwt.sign(tokenPayload, AUTH_SECRET, {
    expiresIn: SESSION_TTL_MINUTES * 60,
  });

  // Update session with the real token
  const updated = await updateCaptureSession(session.id, { token });

  // Build mobile URL (frontend will use this for QR)
  const baseUrl = process.env.FRONTEND_URL || "http://localhost:3000";
  const mobileUrl = `${baseUrl}/capture/${token}`;

  return {
    session: mapSessionToDTO(updated),
    token,
    mobileUrl,
  };
}

/**
 * Validate a capture session token.
 * Returns the session if valid; throws if expired/invalid/completed.
 */
export async function validateSessionToken(
  token: string,
): Promise<{ session: CaptureSessionDTO; sessionId: string; orgId: string }> {
  // 1. Verify JWT signature and expiry
  let payload: CaptureTokenPayload;
  try {
    payload = jwt.verify(token, AUTH_SECRET) as CaptureTokenPayload;
  } catch (err) {
    throw new CaptureSessionError("TOKEN_EXPIRED", "Session token is expired or invalid");
  }

  if (payload.purpose !== "invoice-capture") {
    throw new CaptureSessionError("INVALID_TOKEN", "Token is not for invoice capture");
  }

  // 2. Load session from DB
  const session = await findCaptureSessionByToken(token);
  if (!session) {
    throw new CaptureSessionError("SESSION_NOT_FOUND", "Capture session not found");
  }

  // 3. Check session status
  if (session.status === "COMPLETED") {
    throw new CaptureSessionError("SESSION_COMPLETED", "This capture session has already been completed");
  }
  if (session.status === "EXPIRED" || session.status === "CANCELLED") {
    throw new CaptureSessionError("SESSION_EXPIRED", "This capture session has expired");
  }
  if (session.expiresAt < new Date()) {
    // Mark as expired in DB
    await updateCaptureSession(session.id, { status: "EXPIRED" });
    throw new CaptureSessionError("SESSION_EXPIRED", "This capture session has expired");
  }

  // 4. Mark as ACTIVE if still CREATED
  if (session.status === "CREATED") {
    const activated = await updateCaptureSession(session.id, { status: "ACTIVE" });
    return {
      session: mapSessionToDTO(activated),
      sessionId: payload.sessionId,
      orgId: payload.orgId,
    };
  }

  return {
    session: mapSessionToDTO(session),
    sessionId: payload.sessionId,
    orgId: payload.orgId,
  };
}

/**
 * Add an uploaded file URL to the session.
 * Enforces max uploads per session.
 */
export async function addUploadToSession(
  token: string,
  fileUrl: string,
): Promise<CaptureSessionDTO> {
  const { session, sessionId } = await validateSessionToken(token);

  if (session.uploadedFileUrls.length >= MAX_UPLOADS_PER_SESSION) {
    throw new CaptureSessionError(
      "MAX_UPLOADS_REACHED",
      `Maximum ${MAX_UPLOADS_PER_SESSION} uploads per session`,
    );
  }

  const updated = await updateCaptureSession(sessionId, {
    uploadedFileUrls: { push: fileUrl },
    status: "ACTIVE",
  });

  return mapSessionToDTO(updated);
}

/**
 * Mark session as complete.
 * Returns the completed session with all uploaded file URLs.
 */
export async function completeSession(
  token: string,
): Promise<CaptureSessionDTO> {
  const { sessionId } = await validateSessionToken(token);

  const completed = await updateCaptureSession(sessionId, {
    status: "COMPLETED",
  });

  return mapSessionToDTO(completed);
}

/**
 * Get a session by ID (for manager polling).
 */
export async function getSessionById(
  id: string,
  orgId: string,
): Promise<CaptureSessionDTO | null> {
  const session = await findCaptureSessionById(id);
  if (!session || session.orgId !== orgId) return null;
  return mapSessionToDTO(session);
}

/**
 * List sessions for an org.
 */
export async function listSessionsByOrg(
  orgId: string,
  status?: CaptureSessionStatus,
): Promise<CaptureSessionDTO[]> {
  const sessions = await listCaptureSessionsByOrg(orgId, status ? { status } : undefined);
  return sessions.map(mapSessionToDTO);
}

/**
 * Expire old sessions. Call periodically.
 */
export { expireOldSessions };

/**
 * Complete a session and trigger invoice ingestion for uploaded files (CQ-37 resolution).
 * Extracted from routes/captureSessions.ts to consolidate orchestration in the service layer.
 */
export async function completeAndIngest(
  token: string,
): Promise<CaptureSessionDTO> {
  const { orgId } = await validateSessionToken(token);
  const completed = await completeSession(token);

  if (completed.uploadedFileUrls.length > 0) {
    // Dynamic import to avoid circular dependency
    const { ingestInvoice } = await import("./invoiceIngestionService");
    const { storage } = await import("../storage/attachments");

    console.log(
      `[CAPTURE-SESSION] Session ${completed.id} completed with ${completed.uploadedFileUrls.length} file(s). ` +
      `Triggering ingestion...`,
    );

    for (const fileUrl of completed.uploadedFileUrls) {
      try {
        const fileBuffer = await storage.get(fileUrl);
        const fileName = fileUrl.split("/").pop() || "capture.jpg";
        const mimeType = fileName.match(/\.pdf$/i) ? "application/pdf"
          : fileName.match(/\.png$/i) ? "image/png"
          : "image/jpeg";

        await ingestInvoice({
          buffer: fileBuffer,
          fileName,
          mimeType,
          orgId,
          sourceChannel: "MOBILE_CAPTURE",
          direction: "INCOMING",
        });
      } catch (ingestErr: any) {
        console.error(`[CAPTURE-SESSION] Ingestion failed for ${fileUrl}:`, ingestErr.message);
        // Continue with other files — don't fail the entire completion
      }
    }
  }

  return completed;
}

/* ──────────────────────────────────────────────────────────
   Error class
   ────────────────────────────────────────────────────────── */

export class CaptureSessionError extends Error {
  code: string;
  constructor(code: string, message: string) {
    super(message);
    this.name = "CaptureSessionError";
    this.code = code;
  }
}
