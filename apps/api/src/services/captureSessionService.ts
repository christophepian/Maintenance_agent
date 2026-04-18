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
import * as os from "os";
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
   Helpers
   ────────────────────────────────────────────────────────── */

function getLocalNetworkIp(): string {
  const interfaces = os.networkInterfaces();
  for (const nets of Object.values(interfaces)) {
    for (const net of nets || []) {
      if (net.family === "IPv4" && !net.internal) return net.address;
    }
  }
  return "localhost";
}

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
  purpose: "invoice-capture" | "maintenance-capture";
  requestId?: string;
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
  options?: { targetType?: string; requestId?: string },
): Promise<{ session: CaptureSessionDTO; token: string; mobileUrl: string }> {
  const targetType = options?.targetType || "INVOICE";
  const expiresAt = new Date(Date.now() + SESSION_TTL_MINUTES * 60 * 1000);

  // Create session record first to get the ID
  const session = await createCaptureSession({
    org: { connect: { id: orgId } },
    createdBy: userId,
    token: "placeholder", // will be updated with signed JWT
    expiresAt,
    sourceChannel: "MOBILE_CAPTURE",
    targetType,
  });

  // Generate signed token with session ID embedded
  const purpose = targetType === "MAINTENANCE_REQUEST" ? "maintenance-capture" as const : "invoice-capture" as const;
  const tokenPayload: CaptureTokenPayload = {
    sessionId: session.id,
    orgId,
    purpose,
    ...(options?.requestId ? { requestId: options.requestId } : {}),
  };
  const token = jwt.sign(tokenPayload, AUTH_SECRET, {
    expiresIn: SESSION_TTL_MINUTES * 60,
  });

  // Update session with the real token
  const updated = await updateCaptureSession(session.id, { token });

  // Build mobile URL using session ID (short!) — phone resolves ID → JWT on load
  // Use LAN IP so phones on the same network can reach the dev server
  const baseUrl = process.env.FRONTEND_URL || `http://${getLocalNetworkIp()}:3000`;
  const mobileUrl = `${baseUrl}/capture/${session.id}`;

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

  if (payload.purpose !== "invoice-capture" && payload.purpose !== "maintenance-capture") {
    throw new CaptureSessionError("INVALID_TOKEN", "Token is not for a valid capture purpose");
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
 * Resolve a session ID to its JWT token (public, for QR-code short-URL flow).
 * Returns the token if the session is valid; throws if expired/completed.
 */
export async function resolveSessionToken(
  sessionId: string,
): Promise<{ token: string }> {
  const session = await findCaptureSessionById(sessionId);
  if (!session) {
    throw new CaptureSessionError("SESSION_NOT_FOUND", "Capture session not found");
  }
  if (session.status === "COMPLETED") {
    throw new CaptureSessionError("SESSION_COMPLETED", "This capture session has already been completed");
  }
  if (session.status === "EXPIRED" || session.status === "CANCELLED") {
    throw new CaptureSessionError("SESSION_EXPIRED", "This capture session has expired");
  }
  if (session.expiresAt < new Date()) {
    await updateCaptureSession(session.id, { status: "EXPIRED" });
    throw new CaptureSessionError("SESSION_EXPIRED", "This capture session has expired");
  }
  return { token: session.token };
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
 *
 * Important: ingestion runs BEFORE status is set to COMPLETED so that the
 * desktop polling loop only sees COMPLETED once the invoice record exists.
 */
export async function completeAndIngest(
  token: string,
): Promise<CaptureSessionDTO> {
  const { sessionId, orgId, session } = await validateSessionToken(token);

  // Decode token to check purpose / requestId
  let payload: CaptureTokenPayload;
  try {
    payload = jwt.verify(token, AUTH_SECRET) as CaptureTokenPayload;
  } catch {
    payload = { sessionId, orgId, purpose: "invoice-capture" };
  }

  // ── Maintenance-request flow: attach files to the request ────────
  if (payload.purpose === "maintenance-capture" && payload.requestId) {
    if (session.uploadedFileUrls.length > 0) {
      const { storage } = await import("../storage/attachments");
      const prismaModule = await import("./prismaClient");
      const prisma = prismaModule.default;

      console.log(
        `[CAPTURE-SESSION] Maintenance session ${sessionId}: attaching ` +
        `${session.uploadedFileUrls.length} file(s) to request ${payload.requestId}`,
      );

      for (const fileUrl of session.uploadedFileUrls) {
        try {
          const fileName = fileUrl.split("/").pop() || "capture.jpg";
          const fileBuffer = await storage.get(fileUrl);
          const mimeType = fileName.match(/\.pdf$/i) ? "application/pdf"
            : fileName.match(/\.png$/i) ? "image/png"
            : "image/jpeg";

          await prisma.maintenanceAttachment.create({
            data: {
              requestId: payload.requestId,
              fileName,
              mimeType,
              sizeBytes: fileBuffer.length,
              storageKey: fileUrl,
            },
          });
        } catch (attachErr: any) {
          console.error(`[CAPTURE-SESSION] Attach failed for ${fileUrl}:`, attachErr.message);
        }
      }
    }

    const completed = await updateCaptureSession(sessionId, { status: "COMPLETED" });
    console.log(`[CAPTURE-SESSION] Maintenance session ${sessionId} marked COMPLETED.`);
    return mapSessionToDTO(completed);
  }

  // ── Invoice flow (original) ─────────────────────────────────────
  let createdInvoiceId: string | null = null;

  if (session.uploadedFileUrls.length > 0) {
    // Dynamic import to avoid circular dependency
    const { ingestInvoice } = await import("./invoiceIngestionService");
    const { storage } = await import("../storage/attachments");

    console.log(
      `[CAPTURE-SESSION] Session ${sessionId} has ${session.uploadedFileUrls.length} file(s). ` +
      `Running ingestion before marking complete...`,
    );

    for (const fileUrl of session.uploadedFileUrls) {
      try {
        const fileBuffer = await storage.get(fileUrl);
        const fileName = fileUrl.split("/").pop() || "capture.jpg";
        const mimeType = fileName.match(/\.pdf$/i) ? "application/pdf"
          : fileName.match(/\.png$/i) ? "image/png"
          : "image/jpeg";

        const result = await ingestInvoice({
          buffer: fileBuffer,
          fileName,
          mimeType,
          orgId,
          sourceChannel: "MOBILE_CAPTURE",
          direction: "INCOMING",
        });

        // Keep the first successfully created invoice ID
        if (!createdInvoiceId && result.invoice?.id) {
          createdInvoiceId = result.invoice.id;
        }
      } catch (ingestErr: any) {
        console.error(`[CAPTURE-SESSION] Ingestion failed for ${fileUrl}:`, ingestErr.message);
        // Continue with other files — don't fail the entire completion
      }
    }
  }

  // Mark COMPLETED only after ingestion finishes, and link the created invoice
  const completed = await updateCaptureSession(sessionId, {
    status: "COMPLETED",
    ...(createdInvoiceId ? { createdInvoiceId } : {}),
  });

  console.log(
    `[CAPTURE-SESSION] Session ${sessionId} marked COMPLETED. ` +
    `createdInvoiceId=${createdInvoiceId ?? "none"}`,
  );

  return mapSessionToDTO(completed);
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
