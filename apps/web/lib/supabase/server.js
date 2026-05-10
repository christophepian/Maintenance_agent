/**
 * Supabase server-side client — for use in Next.js API routes.
 *
 * Reads/writes session cookies via the Next.js req/res objects so the session
 * is synchronised with what the browser and middleware see.
 *
 * Required env vars (server-side only — never exposed to the browser):
 *   NEXT_PUBLIC_SUPABASE_URL              (shared with client)
 *   NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY  (shared with client)
 *   SUPABASE_SECRET_KEY                   (server-only — never use in browser client)
 */
import { createServerClient } from "@supabase/ssr";

/**
 * Standard server client — uses the anon key.
 * Use this in API routes that need to read the current session.
 *
 * @param {import("next").NextApiRequest} req
 * @param {import("next").NextApiResponse} res
 */
export function createApiClient(req, res) {
  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY,
    {
      cookies: {
        getAll() {
          // Parse cookie header into array of { name, value } objects
          const raw = req.headers.cookie || "";
          return raw.split(";").map((c) => {
            const idx = c.indexOf("=");
            return {
              name: c.slice(0, idx).trim(),
              value: c.slice(idx + 1).trim(),
            };
          });
        },
        setAll(cookiesToSet) {
          const existing = res.getHeader("Set-Cookie") || [];
          const headers = Array.isArray(existing) ? existing : [existing];
          for (const { name, value, options } of cookiesToSet) {
            const opts = options || {};
            let cookie = `${name}=${value}; Path=${opts.path || "/"}`;
            if (opts.maxAge != null) cookie += `; Max-Age=${opts.maxAge}`;
            if (opts.domain) cookie += `; Domain=${opts.domain}`;
            if (opts.secure) cookie += `; Secure`;
            if (opts.httpOnly) cookie += `; HttpOnly`;
            if (opts.sameSite) cookie += `; SameSite=${opts.sameSite}`;
            headers.push(cookie);
          }
          res.setHeader("Set-Cookie", headers);
        },
      },
    }
  );
}

/**
 * Admin client — uses the service role key, bypasses RLS.
 * Use ONLY in server-side admin routes (never in the browser).
 */
export function createAdminClient() {
  const { createClient } = require("@supabase/supabase-js");
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.SUPABASE_SECRET_KEY,
    { auth: { autoRefreshToken: false, persistSession: false } }
  );
}
