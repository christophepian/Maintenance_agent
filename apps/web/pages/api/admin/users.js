/**
 * Admin users API — server-side Supabase user management.
 *
 * All operations use the service-role key (bypasses RLS, never sent to the browser).
 * Every request is verified to belong to an ADMIN session before proceeding.
 *
 * GET  /api/admin/users             → list all users + their app_metadata
 * POST /api/admin/users/invite      → invite a new user (sends magic link email)
 * POST /api/admin/users/revoke      → disable a user (revoke access)
 * POST /api/admin/users/update-role → update app_metadata for an existing user
 */

import { createApiClient, createAdminClient } from "../../../lib/supabase/server";

const ACCESS_LEVELS = ["ADMIN", "APP_USER", "DOCS_INVESTOR"];
const APP_ROLES = ["MANAGER", "CONTRACTOR", "OWNER", "TENANT"];
const DEFAULT_ORG_ID = "default-org";

async function requireAdmin(req, res) {
  const supabase = createApiClient(req, res);
  const { data: { session } } = await supabase.auth.getSession();
  if (!session) {
    res.status(401).json({ error: "Unauthorized" });
    return null;
  }
  if (session.user?.app_metadata?.accessLevel !== "ADMIN") {
    res.status(403).json({ error: "Forbidden" });
    return null;
  }
  return session;
}

export default async function handler(req, res) {
  const { action } = req.query;

  // ── GET /api/admin/users — list users ──────────────────────────────────────
  if (req.method === "GET") {
    if (!(await requireAdmin(req, res))) return;

    const admin = createAdminClient();
    const { data, error } = await admin.auth.admin.listUsers({ perPage: 200 });
    if (error) return res.status(500).json({ error: error.message });

    const users = data.users.map((u) => ({
      id: u.id,
      email: u.email,
      createdAt: u.created_at,
      lastSignIn: u.last_sign_in_at,
      accessLevel: u.app_metadata?.accessLevel ?? null,
      appRole: u.app_metadata?.appRole ?? null,
      tenantId: u.app_metadata?.tenantId ?? null,
      ownerId: u.app_metadata?.ownerId ?? null,
      banned: u.banned ?? false,
    }));

    return res.status(200).json({ users });
  }

  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  if (!(await requireAdmin(req, res))) return;

  const admin = createAdminClient();

  // ── POST invite ────────────────────────────────────────────────────────────
  if (action === "invite") {
    const { email, accessLevel, appRole } = req.body ?? {};

    if (!email || !ACCESS_LEVELS.includes(accessLevel)) {
      return res.status(400).json({ error: "email and valid accessLevel are required" });
    }
    if (appRole && !APP_ROLES.includes(appRole)) {
      return res.status(400).json({ error: "Invalid appRole" });
    }

    const appMeta = {
      accessLevel,
      appRole: appRole || null,
      orgId: DEFAULT_ORG_ID,
    };

    // Step 1: invite — sends the single-use magic link email.
    // Note: inviteUserByEmail stores `data` as user_metadata, NOT app_metadata.
    // The callback reads app_metadata, so we must set it explicitly in step 2.
    const { data, error } = await admin.auth.admin.inviteUserByEmail(email, {
      data: appMeta,
      redirectTo: `${process.env.NEXT_PUBLIC_APP_URL}/api/auth/callback`,
    });

    if (error) return res.status(500).json({ error: error.message });

    // Step 2: write app_metadata so the callback and middleware can read the
    // access level immediately when the user clicks the link.
    const { error: metaError } = await admin.auth.admin.updateUserById(
      data.user.id,
      { app_metadata: appMeta }
    );

    if (metaError) return res.status(500).json({ error: metaError.message });

    return res.status(201).json({ user: data.user });
  }

  // ── POST revoke ────────────────────────────────────────────────────────────
  if (action === "revoke") {
    const { userId } = req.body ?? {};
    if (!userId) return res.status(400).json({ error: "userId is required" });

    const { error } = await admin.auth.admin.updateUserById(userId, { ban_duration: "876600h" }); // ~100 years
    if (error) return res.status(500).json({ error: error.message });

    return res.status(200).json({ ok: true });
  }

  // ── POST update-role ───────────────────────────────────────────────────────
  if (action === "update-role") {
    const { userId, accessLevel, appRole, tenantId, ownerId } = req.body ?? {};

    if (!userId || !ACCESS_LEVELS.includes(accessLevel)) {
      return res.status(400).json({ error: "userId and valid accessLevel are required" });
    }

    const { data: existing } = await admin.auth.admin.getUserById(userId);
    const currentMeta = existing?.user?.app_metadata ?? {};
    const previousOwnerId = currentMeta.ownerId ?? null;

    // Build updated metadata — omit tenantId/ownerId keys entirely when null
    // so stale nulls don't accumulate in JWT claims.
    const updatedMeta = {
      ...currentMeta,
      accessLevel,
      appRole: appRole || null,
    };
    if (tenantId) {
      updatedMeta.tenantId = tenantId;
    } else {
      delete updatedMeta.tenantId;
    }
    if (ownerId) {
      updatedMeta.ownerId = ownerId;
    } else {
      delete updatedMeta.ownerId;
    }

    const { error } = await admin.auth.admin.updateUserById(userId, {
      app_metadata: updatedMeta,
    });

    if (error) return res.status(500).json({ error: error.message });

    // When ownerId is newly set (or changed), sync BuildingOwner rows so the
    // owner surface immediately shows all active buildings.
    if (ownerId && ownerId !== previousOwnerId) {
      try {
        const apiBase = process.env.API_BASE_URL || "http://127.0.0.1:3001";
        const supabase = createApiClient(req, res);
        const { data: { session } } = await supabase.auth.getSession();
        const token = session?.access_token;
        await fetch(`${apiBase}/people/owners/${ownerId}/sync-buildings`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            ...(token ? { Authorization: `Bearer ${token}` } : {}),
          },
        });
      } catch {
        // Non-fatal — metadata was saved; buildings can be synced manually
      }
    }

    return res.status(200).json({ ok: true });
  }

  return res.status(400).json({ error: "Unknown action" });
}
