/**
 * POST /api/sandbox/setup
 *
 * Sandbox-only endpoint. Orchestrates first-login persona setup:
 *   1. Calls the Express backend to create Tenant + Contractor placeholder records
 *   2. Writes tenantId, contractorId, ownerId (= prismaUserId) back to Supabase app_metadata
 *
 * Safe to call multiple times — both the backend and Supabase update are idempotent.
 * Only active when NEXT_PUBLIC_SANDBOX=true is set in the Next.js environment.
 */

import { createApiClient, createAdminClient } from "../../../lib/supabase/server";

const API_BASE = process.env.API_BASE_URL || "http://127.0.0.1:3001";

export default async function handler(req, res) {
  if (process.env.NEXT_PUBLIC_SANDBOX !== "true") {
    return res.status(403).json({ error: "Sandbox mode is not enabled" });
  }
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  const supabase = createApiClient(req, res);
  const { data: { session } } = await supabase.auth.getSession();
  if (!session) {
    return res.status(401).json({ error: "Unauthorized" });
  }

  const token = session.access_token;

  // 1. Call Express backend to create DB records
  let setupData;
  try {
    const backendRes = await fetch(`${API_BASE}/sandbox/setup`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
    });
    if (!backendRes.ok) {
      const body = await backendRes.json().catch(() => ({}));
      return res.status(backendRes.status).json({ error: body.error || "Backend setup failed" });
    }
    const json = await backendRes.json();
    setupData = json.data;
  } catch (e) {
    return res.status(502).json({ error: "Could not reach backend", detail: String(e) });
  }

  const { tenantId, contractorId, userId: ownerId } = setupData;

  // 2. Write IDs into Supabase app_metadata so the JWT carries them from next login
  try {
    const admin = createAdminClient();
    const supabaseUserId = session.user.id;
    const { data: existing } = await admin.auth.admin.getUserById(supabaseUserId);
    const currentMeta = existing?.user?.app_metadata ?? {};

    // Only write if not already set (avoids unnecessary token invalidation)
    const needsUpdate =
      currentMeta.tenantId !== tenantId ||
      currentMeta.contractorId !== contractorId ||
      currentMeta.ownerId !== ownerId ||
      currentMeta.prismaUserId !== ownerId;

    if (needsUpdate) {
      await admin.auth.admin.updateUserById(supabaseUserId, {
        app_metadata: {
          ...currentMeta,
          tenantId,
          contractorId,
          ownerId,
          prismaUserId: ownerId,
        },
      });
    }
  } catch (e) {
    // Non-fatal — DB records exist; the user can still browse. Next login will carry the updated JWT.
    console.error("[sandbox/setup] app_metadata update failed:", e);
  }

  return res.status(200).json({ ok: true, tenantId, contractorId, ownerId });
}
