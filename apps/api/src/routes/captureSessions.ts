/**
 * Capture Session Routes
 *
 * Thin HTTP handlers for QR-based phone capture sessions.
 *
 * POST   /capture-sessions              — create session (MANAGER only)
 * GET    /capture-sessions/:id          — poll session status (MANAGER only)
 * GET    /capture-sessions/validate/:token — validate token (public, token-gated)
 * POST   /capture-sessions/:token/upload   — upload file (public, token-gated)
 * POST   /capture-sessions/:token/complete — mark complete (public, token-gated)
 */

import { Router } from "../http/router";
import { sendError, sendJson } from "../http/json";
import { requireAnyRole, getAuthUser } from "../authz";
import { readRawBody, parseMultipart, MAX_FILE_SIZE, storage } from "../storage/attachments";
import {
  createSession,
  validateSessionToken,
  addUploadToSession,
  completeAndIngest,
  getSessionById,
  CaptureSessionError,
} from "../services/captureSessionService";
import * as crypto from "crypto";

// SA-21: In-memory rate limiter for public capture session endpoints (20 calls/IP/minute)
const captureRateMap = new Map<string, { count: number; resetAt: number }>();
const CAPTURE_RATE_LIMIT = 20;
const CAPTURE_RATE_WINDOW_MS = 60_000;

function checkCaptureRateLimit(ip: string): boolean {
  const now = Date.now();
  const entry = captureRateMap.get(ip);
  if (!entry || now >= entry.resetAt) {
    captureRateMap.set(ip, { count: 1, resetAt: now + CAPTURE_RATE_WINDOW_MS });
    return true;
  }
  entry.count++;
  return entry.count <= CAPTURE_RATE_LIMIT;
}

export function registerCaptureSessionRoutes(router: Router) {
  // POST /capture-sessions — create a new capture session (MANAGER only)
  router.post("/capture-sessions", async ({ req, res, orgId }) => {
    if (!requireAnyRole(req, res, ["MANAGER"])) return;
    try {
      const user = getAuthUser(req);
      if (!user) {
        sendError(res, 401, "UNAUTHORIZED", "Authentication required");
        return;
      }

      const result = await createSession(orgId, user.userId);

      sendJson(res, 201, {
        data: result.session,
        token: result.token,
        mobileUrl: result.mobileUrl,
      });
    } catch (e: any) {
      console.error("[CAPTURE-SESSION] create error:", e);
      sendError(res, 500, "INTERNAL_ERROR", "Failed to create capture session", e.message);
    }
  });

  // GET /capture-sessions/:id — poll session status (MANAGER only)
  router.get("/capture-sessions/:id", async ({ req, res, params, orgId }) => {
    if (!requireAnyRole(req, res, ["MANAGER"])) return;
    try {
      const session = await getSessionById(params.id, orgId);
      if (!session) {
        sendError(res, 404, "NOT_FOUND", "Capture session not found");
        return;
      }
      sendJson(res, 200, { data: session });
    } catch (e: any) {
      console.error("[CAPTURE-SESSION] get error:", e);
      sendError(res, 500, "INTERNAL_ERROR", "Failed to get capture session", e.message);
    }
  });

  // GET /capture-sessions/validate/:token — validate session token (public, token-gated)
  router.get("/capture-sessions/validate/:token", async ({ res, params }) => {
    try {
      const { session } = await validateSessionToken(params.token);
      sendJson(res, 200, { data: { status: session.status, expiresAt: session.expiresAt } });
    } catch (e: any) {
      if (e instanceof CaptureSessionError) {
        const status = e.code === "SESSION_EXPIRED" || e.code === "SESSION_COMPLETED" ? 410 : 400;
        sendError(res, status, e.code, e.message);
        return;
      }
      console.error("[CAPTURE-SESSION] validate error:", e);
      sendError(res, 500, "INTERNAL_ERROR", "Validation failed", e.message);
    }
  });

  // POST /capture-sessions/:token/upload — upload file to session (public, token-gated)
  router.post("/capture-sessions/:token/upload", async ({ req, res, params }) => {
    // SA-21: Rate limit public upload endpoint
    const ip = req.socket.remoteAddress || "unknown";
    if (!checkCaptureRateLimit(ip)) {
      return sendJson(res, 429, { error: "Too many requests" });
    }
    try {
      // Validate session first
      const { session, orgId } = await validateSessionToken(params.token);

      // Parse multipart body
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

      // Store the file
      const fileKey = `capture-sessions/${session.id}/${Date.now()}-${crypto.randomBytes(4).toString("hex")}/${filePart.filename}`;
      await storage.put(fileKey, filePart.data);

      // Add to session
      const updated = await addUploadToSession(params.token, fileKey);

      sendJson(res, 200, { data: updated, fileUrl: fileKey });
    } catch (e: any) {
      if (e instanceof CaptureSessionError) {
        const status = e.code === "SESSION_EXPIRED" || e.code === "SESSION_COMPLETED" ? 410
          : e.code === "MAX_UPLOADS_REACHED" ? 429 : 400;
        sendError(res, status, e.code, e.message);
        return;
      }
      console.error("[CAPTURE-SESSION] upload error:", e);
      sendError(res, 500, "INTERNAL_ERROR", "Upload failed", e.message);
    }
  });

  // POST /capture-sessions/:token/complete — complete session and trigger ingestion (public, token-gated)
  router.post("/capture-sessions/:token/complete", async ({ req, res, params }) => {
    // SA-21: Rate limit public complete endpoint
    const ip = req.socket.remoteAddress || "unknown";
    if (!checkCaptureRateLimit(ip)) {
      return sendJson(res, 429, { error: "Too many requests" });
    }
    try {
      const completed = await completeAndIngest(params.token);
      sendJson(res, 200, { data: completed });
    } catch (e: any) {
      if (e instanceof CaptureSessionError) {
        const status = e.code === "SESSION_EXPIRED" || e.code === "SESSION_COMPLETED" ? 410 : 400;
        sendError(res, status, e.code, e.message);
        return;
      }
      console.error("[CAPTURE-SESSION] complete error:", e);
      sendError(res, 500, "INTERNAL_ERROR", "Complete failed", e.message);
    }
  });
}
