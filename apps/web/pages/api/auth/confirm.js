/**
 * Supabase SSR token-hash confirmation route.
 *
 * The default magic-link flow relies on Supabase's /verify endpoint issuing a
 * PKCE `?code` that /api/auth/callback then exchanges. On some projects/domains
 * that handshake fails (verify never issues the code → "Invalid login link").
 *
 * This route is the Supabase-recommended SSR alternative: the email link carries
 * a `token_hash`, and WE verify it server-side with verifyOtp — no PKCE, no
 * redirect-allowlist dance, no browser round-trip through /verify. It sets the
 * session cookie and redirects the user in.
 *
 * Point the magic-link email template at:
 *   {{ .SiteURL }}/api/auth/confirm?token_hash={{ .TokenHash }}&type=magiclink
 * (Site URL must be the app's base URL, no path.)
 */

import { createApiClient } from "../../../lib/supabase/server";
import { resolveLandingPath } from "../../../lib/roleRouting";

export default async function handler(req, res) {
  const tokenHash = typeof req.query.token_hash === "string" ? req.query.token_hash : "";
  const type = typeof req.query.type === "string" ? req.query.type : "magiclink";
  const nextParam =
    typeof req.query.next === "string" && req.query.next.startsWith("/") ? req.query.next : undefined;

  if (!tokenHash) {
    return res.redirect(302, "/login?error=missing_code");
  }

  const supabase = createApiClient(req, res);
  const { data, error } = await supabase.auth.verifyOtp({ token_hash: tokenHash, type });

  if (error || !data?.session) {
    console.error("[auth/confirm] verifyOtp failed:", error?.message);
    return res.redirect(302, "/login?error=auth_failed");
  }

  const meta = data.session.user?.app_metadata ?? {};
  const userMeta = data.session.user?.user_metadata ?? {};
  const target = resolveLandingPath({ appMeta: meta, userMeta, next: nextParam }) || "/";
  return res.redirect(302, target);
}
