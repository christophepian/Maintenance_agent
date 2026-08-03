/**
 * Self-service role selection — first-login onboarding.
 *
 * Unlike /api/admin/users (which lets an ADMIN set anyone's role), this route
 * only ever writes app_metadata for the CURRENT authenticated user, and only
 * to the self-service-allowed roles (Owner / Manager / Owner+Manager). Tenant
 * and Contractor are relationship-based and cannot be self-selected here.
 *
 * The write uses the service-role key (app_metadata is not user-writable), so
 * the client must call supabase.auth.refreshSession() afterwards to pull a JWT
 * carrying the new appRole/capabilities claims.
 *
 * POST /api/onboarding/role   body: { primaryRole: "OWNER"|"MANAGER"|"OWNER_MANAGER" }
 */

import { createApiClient, createAdminClient } from "../../../lib/supabase/server";

const DEFAULT_ORG_ID = "default-org";

// primaryRole → { appRole (drives home + nav), capabilities (what tooling shows) }
const ROLE_MAP = {
  OWNER: { appRole: "OWNER", capabilities: ["OWNER"] },
  MANAGER: { appRole: "MANAGER", capabilities: ["MANAGER"] },
  // Self-managing owner: lands on the owner surface, but can switch into the
  // manager surface via the capability-aware view switcher.
  OWNER_MANAGER: { appRole: "OWNER", capabilities: ["OWNER", "MANAGER"] },
};

export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  const { primaryRole } = req.body ?? {};
  const mapped = ROLE_MAP[primaryRole];
  if (!mapped) {
    return res.status(400).json({ error: "Invalid primaryRole" });
  }

  // Authenticate the caller — we only ever mutate their own metadata.
  const supabase = createApiClient(req, res);
  const {
    data: { session },
  } = await supabase.auth.getSession();
  if (!session) {
    return res.status(401).json({ error: "Unauthorized" });
  }

  const userId = session.user.id;
  const currentMeta = session.user.app_metadata ?? {};

  // DOCS_INVESTOR must never gain app access via self-service.
  if (currentMeta.accessLevel === "DOCS_INVESTOR") {
    return res.status(403).json({ error: "Forbidden" });
  }

  const updatedMeta = {
    ...currentMeta,
    accessLevel: currentMeta.accessLevel || "APP_USER",
    orgId: currentMeta.orgId || DEFAULT_ORG_ID,
    appRole: mapped.appRole,
    capabilities: mapped.capabilities,
  };

  const admin = createAdminClient();
  const { error } = await admin.auth.admin.updateUserById(userId, {
    app_metadata: updatedMeta,
  });
  if (error) return res.status(500).json({ error: error.message });

  return res.status(200).json({
    ok: true,
    appRole: mapped.appRole,
    capabilities: mapped.capabilities,
  });
}
