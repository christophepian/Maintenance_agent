/**
 * Supabase Auth callback handler.
 *
 * Supabase redirects here after:
 *   - Magic link click
 *   - Password reset link click
 *   - Invite link click
 *
 * The URL will contain either:
 *   ?code=<pkce_code>           (PKCE flow — magic links, invites)
 *   #access_token=...           (implicit flow — handled client-side in login.js)
 *
 * This handler exchanges the PKCE code for a session, sets the session cookie,
 * then redirects the user to the appropriate page based on their access_level.
 *
 * Configure in Supabase dashboard:
 *   Authentication → URL Configuration → Redirect URLs
 *   Add: https://<your-domain>/api/auth/callback
 */

import { createApiClient, createAdminClient } from "../../../lib/supabase/server";

const ROLE_HOME = {
  MANAGER: "/manager",
  CONTRACTOR: "/contractor",
  OWNER: "/owner",
  TENANT: "/tenant/inbox",
};

export default async function handler(req, res) {
  const { code, next } = req.query;

  if (!code) {
    // No code — redirect to login with an error
    return res.redirect(302, "/login?error=missing_code");
  }

  const supabase = createApiClient(req, res);

  const { data, error } = await supabase.auth.exchangeCodeForSession(String(code));

  if (error || !data.session) {
    console.error("[auth/callback] exchangeCodeForSession failed:", error?.message);
    return res.redirect(302, "/login?error=auth_failed");
  }

  const { session } = data;
  const meta = session.user?.app_metadata ?? {};
  const userMeta = session.user?.user_metadata ?? {};
  const accessLevel = meta.accessLevel;
  const appRole = meta.appRole;

  // SANDBOX: validate beta tester status after every magic link click.
  // This is a second line of defence — the login form already calls beta-check
  // before sending the OTP, but we re-validate here to catch edge cases such
  // as a trial that expired between OTP send and link click.
  if (process.env.NEXT_PUBLIC_SANDBOX === "true") {
    const admin = createAdminClient();
    const { data: beta } = await admin
      .from("beta_testers")
      .select("status, trial_expires_at")
      .ilike("email", session.user.email)
      .maybeSingle();

    const isValidBeta =
      beta &&
      beta.status === "active" &&
      (!beta.trial_expires_at || new Date(beta.trial_expires_at) > new Date());

    if (!isValidBeta) {
      const reason = !beta ? "not_allowed" : beta.status !== "active" ? "not_allowed" : "expired";
      return res.redirect(302, `/login?reason=${reason}`);
    }
  }

  // First-time users: no password_set flag in user_metadata.
  // In sandbox, skip this entirely — magic link is the only auth method and
  // there is no password to set. Go straight to the app.
  const isFirstLogin = !userMeta.password_set;

  // DOCS_INVESTOR never sets a password — skip straight to the pitchdeck.
  if (isFirstLogin && process.env.NEXT_PUBLIC_SANDBOX !== "true" && accessLevel !== "DOCS_INVESTOR") {
    const dest = next ? `/set-password?next=${encodeURIComponent(next)}` : "/set-password";
    return res.redirect(302, dest);
  }

  // Determine redirect target
  let target = next || null;

  if (!target) {
    if (accessLevel === "DOCS_INVESTOR") {
      target = "/docs/pitchdeck.html";
    } else if (appRole && ROLE_HOME[appRole]) {
      target = ROLE_HOME[appRole];
    } else if (accessLevel === "ADMIN") {
      target = "/manager";
    } else {
      target = "/";
    }
  }

  return res.redirect(302, target);
}
