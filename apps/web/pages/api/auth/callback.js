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

import { createApiClient } from "../../../lib/supabase/server";

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

  // First-time users: created_at and last_sign_in_at are identical on the very
  // first login (Supabase sets both at the same moment). Redirect them to
  // /set-password so they can create a password before entering the app.
  // On all subsequent logins last_sign_in_at will be older than created_at.
  const user = session.user;
  const isFirstLogin =
    !userMeta.password_set &&
    user.created_at &&
    user.last_sign_in_at &&
    Math.abs(new Date(user.created_at) - new Date(user.last_sign_in_at)) < 5000;

  if (isFirstLogin) {
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
