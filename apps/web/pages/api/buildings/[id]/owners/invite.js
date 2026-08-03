/**
 * Invite an OWNER scoped to a SINGLE building.
 *
 * Grants appRole=OWNER and links the invitee to exactly ONE building via
 * POST /buildings/:id/owners. Owner-surface visibility is the intersection of
 * orgId AND the BuildingOwner link, so a single link = single-building scope.
 * MANAGER-gated, scoped to the caller's own org.
 *
 * Two environments, two provisioning paths:
 *   - Production: send a Supabase invite email (inviteUserByEmail). The invitee
 *     clicks it, sets a password, and lands on /owner.
 *   - Sandbox: there is no real email delivery and every login is gated on the
 *     `beta_testers` allowlist. So we create a CONFIRMED OWNER user directly
 *     (no email — the tester just signs in with a normal magic link) and add
 *     them to `beta_testers` so the sandbox gate lets them in.
 *
 * POST /api/buildings/:id/owners/invite   body: { email, name? }
 */

import { createApiClient, createAdminClient } from "../../../../../lib/supabase/server";

const DEFAULT_ORG_ID = "default-org";
const INVITER_ROLES = ["MANAGER"];

// Sandbox has few users; a single page is plenty to resolve an email → auth user.
async function findAuthUserByEmail(admin, email) {
  const { data, error } = await admin.auth.admin.listUsers({ page: 1, perPage: 1000 });
  if (error || !data?.users) return null;
  return data.users.find((u) => (u.email || "").toLowerCase() === email) || null;
}

export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  const buildingId = String(req.query.id || "").trim();
  if (!buildingId) return res.status(400).json({ error: "Missing building id" });

  const email = String(req.body?.email || "").trim().toLowerCase();
  if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return res.status(400).json({ error: "A valid email is required" });
  }
  const name = String(req.body?.name || "").trim();

  const supabase = createApiClient(req, res);
  const {
    data: { session },
  } = await supabase.auth.getSession();
  if (!session) return res.status(401).json({ error: "Unauthorized" });

  const meta = session.user.app_metadata ?? {};
  const caps = meta.capabilities || [];
  const canInvite =
    INVITER_ROLES.includes(meta.appRole) || caps.some((c) => INVITER_ROLES.includes(c));
  if (!canInvite) return res.status(403).json({ error: "Forbidden" });

  const orgId = meta.orgId || DEFAULT_ORG_ID;
  const appMeta = { accessLevel: "APP_USER", appRole: "OWNER", orgId };
  const isSandbox = process.env.NEXT_PUBLIC_SANDBOX === "true";

  // 1) Provision (or reuse) the Supabase auth user with an OWNER role.
  const admin = createAdminClient();
  let invited = false;

  if (isSandbox) {
    // Create a confirmed OWNER user (no email is sent).
    const { error: createErr } = await admin.auth.admin.createUser({
      email,
      email_confirm: true,
      app_metadata: appMeta,
    });
    if (createErr) {
      const msg = String(createErr.message || "").toLowerCase();
      const exists = msg.includes("already") || msg.includes("registered") || msg.includes("exist");
      if (!exists) return res.status(500).json({ error: createErr.message });
      // Already exists → make sure they carry OWNER access for this org.
      const found = await findAuthUserByEmail(admin, email);
      if (found) {
        await admin.auth.admin.updateUserById(found.id, {
          app_metadata: { ...(found.app_metadata || {}), ...appMeta },
        });
      }
    }
    // Allowlist them (active, no expiry) so the sandbox beta gate passes.
    const { error: betaErr } = await admin
      .from("beta_testers")
      .upsert({ email, status: "active", trial_expires_at: null }, { onConflict: "email" });
    if (betaErr) console.error("[owners/invite] beta_testers upsert failed:", betaErr.message);
  } else {
    // Production: send a Supabase invite email (single-use magic link).
    const { data, error } = await admin.auth.admin.inviteUserByEmail(email, {
      data: appMeta,
      redirectTo: `${process.env.NEXT_PUBLIC_APP_URL}/api/auth/callback`,
    });
    if (error) {
      // Most common: the email already has an account. That's fine — we still
      // want to link the building below so re-invites are idempotent. Only
      // hard-fail on clearly unexpected errors.
      const msg = String(error.message || "").toLowerCase();
      const alreadyExists = msg.includes("already") || msg.includes("registered") || msg.includes("exist");
      if (!alreadyExists) {
        return res.status(409).json({ error: error.message || "Could not send the invite" });
      }
    } else {
      invited = true;
      // inviteUserByEmail stores `data` as user_metadata; the callback/middleware
      // read app_metadata, so set it explicitly (same as the manager invite flow).
      const { error: metaError } = await admin.auth.admin.updateUserById(data.user.id, {
        app_metadata: appMeta,
      });
      if (metaError) return res.status(500).json({ error: metaError.message });
    }
  }

  // 2) Create-or-reuse the Prisma OWNER user (by email) and link this ONE building.
  //    The API bridges Supabase↔Prisma by email, so the same email here suffices.
  try {
    const apiBase = process.env.API_BASE_URL || "http://127.0.0.1:3001";
    const token = session.access_token;
    const linkRes = await fetch(`${apiBase}/buildings/${buildingId}/owners`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
      body: JSON.stringify({ email, name }),
    });
    if (!linkRes.ok) {
      const body = await linkRes.json().catch(() => null);
      return res.status(linkRes.status).json({
        error: body?.error?.message || body?.error || "Owner provisioned but could not be linked to the building",
      });
    }
  } catch (e) {
    return res.status(502).json({ error: `Owner provisioned but linking failed: ${String(e)}` });
  }

  return res.status(201).json({ ok: true, email, invited, sandbox: isSandbox });
}
