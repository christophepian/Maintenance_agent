/**
 * SANDBOX ONLY — pre-OTP beta tester allowlist check.
 *
 * Called from the login page before signInWithOtp to prevent non-allowlisted
 * or expired users from even receiving a magic link.
 *
 * This route is a no-op (404) in any non-sandbox environment so it cannot
 * accidentally gate the main / staging auth flow.
 *
 * POST { email: string }
 * → { allowed: true }
 * → { allowed: false, reason: "not_registered" | "inactive" | "expired" }
 */

import { createAdminClient } from "../../../lib/supabase/server";

export default async function handler(req, res) {
  if (process.env.NEXT_PUBLIC_SANDBOX !== "true") {
    return res.status(404).json({ error: "Not found" });
  }

  if (req.method !== "POST") {
    return res.status(405).end();
  }

  const { email } = req.body ?? {};
  if (!email || typeof email !== "string") {
    return res.status(400).json({ allowed: false, reason: "missing_email" });
  }

  const admin = createAdminClient();
  const { data, error } = await admin
    .from("beta_testers")
    .select("status, trial_expires_at")
    .ilike("email", email.trim())
    .maybeSingle();

  if (error) {
    console.error("[beta-check] Supabase error:", error.message);
    // Fail open so a DB issue doesn't permanently lock all beta testers out.
    return res.json({ allowed: true });
  }

  if (!data) {
    return res.json({ allowed: false, reason: "not_registered" });
  }

  if (data.status !== "active") {
    return res.json({ allowed: false, reason: "inactive" });
  }

  if (data.trial_expires_at && new Date(data.trial_expires_at) <= new Date()) {
    return res.json({ allowed: false, reason: "expired" });
  }

  return res.json({ allowed: true });
}
