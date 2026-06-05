/**
 * SANDBOX ONLY — post-login beta trial validation + session recording.
 *
 * Called from AppShell on every mount so that a user whose trial expires
 * mid-session is signed out on their next page load rather than staying
 * in the app indefinitely.
 *
 * Also records a row in beta_user_sessions (scaffold for future login-sharing
 * controls; no blocking enforced yet).
 *
 * Returns { ok: true } when the session is valid.
 * Returns { ok: false, reason: string } when it should not be.
 *
 * In non-sandbox environments this route always returns { ok: true } so it is
 * safe to call unconditionally — the sandbox gate is on the server side.
 */

import { createApiClient, createAdminClient } from "../../../lib/supabase/server";
import { createHash } from "crypto";

export default async function handler(req, res) {
  if (req.method !== "POST") return res.status(405).end();

  // Non-sandbox: always valid — do not gate the main environment.
  if (process.env.NEXT_PUBLIC_SANDBOX !== "true") {
    return res.json({ ok: true });
  }

  const supabase = createApiClient(req, res);
  const { data: { session } } = await supabase.auth.getSession();

  if (!session) {
    return res.status(401).json({ ok: false, reason: "no_session" });
  }

  const admin = createAdminClient();
  const { data: beta, error } = await admin
    .from("beta_testers")
    .select("status, trial_expires_at")
    .ilike("email", session.user.email)
    .maybeSingle();

  if (error) {
    console.error("[beta-validate] Supabase error:", error.message);
    // Fail open on DB errors to avoid locking users out on infra issues.
    return res.json({ ok: true });
  }

  if (!beta) {
    return res.json({ ok: false, reason: "not_registered" });
  }

  if (beta.status !== "active") {
    return res.json({ ok: false, reason: "inactive" });
  }

  if (beta.trial_expires_at && new Date(beta.trial_expires_at) <= new Date()) {
    return res.json({ ok: false, reason: "expired" });
  }

  // Record / update the session row (scaffold — not enforced for blocking yet).
  const rawIp =
    (req.headers["x-forwarded-for"] ?? "").split(",")[0].trim() ||
    req.socket?.remoteAddress ||
    null;
  const ipHash = rawIp
    ? createHash("sha256").update(rawIp).digest("hex")
    : null;

  await admin
    .from("beta_user_sessions")
    .upsert(
      {
        user_id: session.user.id,
        email: session.user.email,
        user_agent: req.headers["user-agent"] ?? null,
        ip_hash: ipHash,
        last_seen_at: new Date().toISOString(),
      },
      { onConflict: "user_id,user_agent" }
    )
    .then(({ error: upsertErr }) => {
      if (upsertErr) console.error("[beta-validate] session upsert:", upsertErr.message);
    });

  return res.json({ ok: true });
}
