/**
 * POST /api/demo/session
 *
 * Hands the public onboarding demo a real, READ-ONLY session so the walkthrough
 * can end on the actual building page with actual reporting, instead of stopping
 * at the login screen.
 *
 * What this deliberately is NOT: a way to log in as anybody. It signs in one
 * fixed account whose credentials live only in server env, and it does so only
 * when every one of these holds:
 *
 *   - NEXT_PUBLIC_SANDBOX === "true"   (the isolated sandbox stack only — this
 *                                       endpoint does not function in prod)
 *   - DEMO_ACCOUNT_EMAIL / DEMO_ACCOUNT_PASSWORD are both configured
 *   - that account carries app_metadata.demoReadOnly, which the API enforces by
 *     refusing every mutating request from its token (see apps/api/src/server.ts)
 *
 * The read-only claim is checked here too and the session is thrown away if it's
 * missing: a misconfigured demo account must fail closed rather than hand a
 * public visitor a writable session.
 *
 * After signing in, the demo building is (idempotently) seeded so the Reporting
 * tab has data, and its id is returned for the client to redirect to.
 */

import { createClient } from "@supabase/supabase-js";

const API_BASE = process.env.API_BASE_URL || "http://127.0.0.1:3001";

export default async function handler(req, res) {
  if (process.env.NEXT_PUBLIC_SANDBOX !== "true") {
    return res.status(404).json({ error: "Not found" });
  }
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  const email = process.env.DEMO_ACCOUNT_EMAIL;
  const password = process.env.DEMO_ACCOUNT_PASSWORD;
  if (!email || !password) {
    return res.status(503).json({ error: "Demo account is not configured" });
  }

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !key) {
    return res.status(503).json({ error: "Supabase is not configured" });
  }

  // A throwaway client: no cookie persistence, so this sign-in can't leak into
  // the server's own session handling.
  const supabase = createClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  const { data, error } = await supabase.auth.signInWithPassword({ email, password });
  if (error || !data?.session) {
    console.error("[demo/session] sign-in failed:", error?.message);
    return res.status(502).json({ error: "Could not start the demo session" });
  }

  // Fail closed: never hand out a session that the API would let write.
  const meta = data.session.user?.app_metadata ?? {};
  const readOnly = meta.demoReadOnly === true || meta.demoReadOnly === "true";
  if (!readOnly) {
    console.error("[demo/session] demo account is missing app_metadata.demoReadOnly — refusing");
    return res.status(503).json({ error: "Demo account is not configured correctly" });
  }

  // Seed the demo building. Idempotent, and non-fatal: a seeding hiccup should
  // still let the visitor into the app rather than dead-ending the demo.
  let buildingId = null;
  try {
    const seedRes = await fetch(`${API_BASE}/sandbox/demo-seed`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${data.session.access_token}`,
      },
    });
    if (seedRes.ok) {
      const json = await seedRes.json();
      buildingId = json?.data?.buildingId ?? null;
    } else {
      console.error("[demo/session] seed failed:", seedRes.status);
    }
  } catch (e) {
    console.error("[demo/session] seed unreachable:", String(e));
  }

  return res.status(200).json({
    accessToken: data.session.access_token,
    refreshToken: data.session.refresh_token,
    buildingId,
  });
}
