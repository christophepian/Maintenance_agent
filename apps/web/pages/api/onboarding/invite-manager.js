/**
 * Self-service manager invite — onboarding "Connections" step.
 *
 * Lets an authenticated OWNER / OWNER+MANAGER (or MANAGER) invite a manager
 * (e.g. their régie) into their OWN org. Unlike /api/admin/users (ADMIN-only),
 * this is scoped to the caller's orgId and can only ever grant the MANAGER role
 * at APP_USER access — it cannot mint admins or cross-org access.
 *
 * POST /api/onboarding/invite-manager   body: { email }
 */

import { createApiClient, createAdminClient } from "../../../lib/supabase/server";

const DEFAULT_ORG_ID = "default-org";
// Roles allowed to invite a manager during onboarding.
const INVITER_ROLES = ["OWNER", "MANAGER"];

export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  const email = String(req.body?.email || "").trim().toLowerCase();
  if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return res.status(400).json({ error: "A valid email is required" });
  }

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

  // Invite into the caller's own org, as a MANAGER app user.
  const orgId = meta.orgId || DEFAULT_ORG_ID;
  const appMeta = { accessLevel: "APP_USER", appRole: "MANAGER", orgId };

  const admin = createAdminClient();
  const { data, error } = await admin.auth.admin.inviteUserByEmail(email, {
    data: appMeta,
    redirectTo: `${process.env.NEXT_PUBLIC_APP_URL}/api/auth/callback`,
  });
  if (error) {
    // Most common: the email already has an account. Surface it softly.
    return res.status(409).json({ error: error.message || "Could not send the invite" });
  }

  // inviteUserByEmail stores `data` as user_metadata; the callback/middleware
  // read app_metadata, so set it explicitly (same as the admin invite flow).
  const { error: metaError } = await admin.auth.admin.updateUserById(data.user.id, {
    app_metadata: appMeta,
  });
  if (metaError) return res.status(500).json({ error: metaError.message });

  return res.status(201).json({ ok: true, email });
}
