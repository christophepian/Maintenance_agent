/**
 * Supabase browser client — for use in React components and client-side hooks.
 *
 * Uses @supabase/ssr createBrowserClient so that session cookies are handled
 * consistently with the server-side client and the edge middleware.
 *
 * Required env vars (public — safe to expose to the browser):
 *   NEXT_PUBLIC_SUPABASE_URL
 *   NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY
 */
import { createBrowserClient } from "@supabase/ssr";

export function createClient() {
  return createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY
  );
}
