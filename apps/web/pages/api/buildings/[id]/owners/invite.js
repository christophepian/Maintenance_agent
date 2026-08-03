/**
 * Invite an OWNER scoped to a SINGLE building.
 *
 * Mirrors the manager-invite two-step (inviteUserByEmail → updateUserById), but
 * grants appRole=OWNER and — crucially — links the invitee to exactly ONE
 * building via POST /buildings/:id/owners. Owner surface visibility is the
 * intersection of orgId AND the BuildingOwner link, so a single link = single
 * building scope. MANAGER-gated, scoped to the caller's own org.
 *
 * POST /api/buildings/:id/owners/invite   body: { email, name? }
 */

import { createApiClient, createAdminClient } from "../../../../../lib/supabase/server";

const DEFAULT_ORG_ID = "default-org";
const INVITER_ROLES = ["MANAGER"];

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

  // 1) Provision (or reuse) the Supabase auth user with an OWNER role.
  const admin = createAdminClient();
  let invited = false;
  const { data, error } = await admin.auth.admin.inviteUserByEmail(email, {
    data: appMeta,
    redirectTo: `${process.env.NEXT_PUBLIC_APP_URL}/api/auth/callback`,
  });
  if (error) {
    // Most common: the email already has an account. That's fine — we still want
    // to link the building below so re-invites are idempotent. Only hard-fail on
    // clearly unexpected errors.
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
        error: body?.error?.message || body?.error || "Owner invited but could not be linked to the building",
      });
    }
  } catch (e) {
    return res.status(502).json({ error: `Owner invited but linking failed: ${String(e)}` });
  }

  return res.status(201).json({ ok: true, email, invited });
}
