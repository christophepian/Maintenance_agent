/**
 * SANDBOX-ONLY email-free login.
 *
 * The sandbox's built-in email sender is rate-limited and its magic links are
 * flaky on preview domains (otp_expired / "invalid link"). This endpoint mints a
 * session SERVER-SIDE — it generates a one-time token via the admin API and
 * verifies it immediately in-process (no email, no clickable link, no browser
 * round-trip through Supabase's /verify), sets the session cookie, and redirects
 * the caller straight into the app.
 *
 * Gated on:
 *   - NEXT_PUBLIC_SANDBOX === "true"  (404 otherwise — never active in prod)
 *   - a shared secret in SANDBOX_DEV_LOGIN_SECRET, passed as ?key=
 *
 * Usage:
 *   /api/dev/login?key=<SECRET>&email=christophepian13@gmail.com
 *   optional &next=/owner to force a destination.
 */

import { createApiClient, createAdminClient } from "../../../lib/supabase/server";
import { resolveLandingPath } from "../../../lib/roleRouting";

export default async function handler(req, res) {
  if (process.env.NEXT_PUBLIC_SANDBOX !== "true") {
    return res.status(404).json({ error: "Not found" });
  }

  const secret = process.env.SANDBOX_DEV_LOGIN_SECRET;
  if (!secret) {
    return res.status(503).json({ error: "SANDBOX_DEV_LOGIN_SECRET is not set on this deployment" });
  }
  if (req.query.key !== secret) {
    return res.status(401).json({ error: "Unauthorized" });
  }

  const email = String(req.query.email || "").trim().toLowerCase();
  if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return res.status(400).json({ error: "A valid ?email= is required" });
  }

  const admin = createAdminClient();

  // 1. Generate a one-time magic-link token for this user (no email is sent).
  const { data: link, error: genErr } = await admin.auth.admin.generateLink({
    type: "magiclink",
    email,
  });
  if (genErr || !link?.properties?.hashed_token) {
    return res.status(400).json({ error: genErr?.message || "Could not generate a login token for that email" });
  }

  // 2. Verify it in-process against a cookie-bound server client — this sets the
  //    session cookie on the response without any browser round-trip.
  const supabase = createApiClient(req, res);
  const { data: verified, error: verErr } = await supabase.auth.verifyOtp({
    type: "magiclink",
    token_hash: link.properties.hashed_token,
  });
  if (verErr || !verified?.session) {
    return res.status(400).json({ error: verErr?.message || "Could not establish a session" });
  }

  // 3. Route to the right landing page.
  const meta = verified.session.user?.app_metadata ?? {};
  const userMeta = verified.session.user?.user_metadata ?? {};
  const nextParam = typeof req.query.next === "string" && req.query.next.startsWith("/") ? req.query.next : undefined;
  const target = resolveLandingPath({ appMeta: meta, userMeta, next: nextParam }) || "/";

  return res.redirect(302, target);
}
