/**
 * Next.js Edge Middleware — auth enforcement.
 *
 * Runs before every matched request. Checks the Supabase session cookie and
 * gates routes based on app_metadata.accessLevel:
 *
 *   ADMIN          → full access: app + all /docs pages
 *   APP_USER       → app only (no /docs access)
 *   DOCS_INVESTOR  → /docs/pitchdeck.html + app (no other /docs pages)
 *   (no session)   → redirect to /login
 *
 * Docs-only paths (static HTML files in public/docs/) are protected here;
 * the client-side JS gate in those files has been removed.
 *
 * Public paths (login, auth callback, static assets) are always allowed through.
 */

import { createServerClient } from "@supabase/ssr";
import { NextResponse } from "next/server";

// Paths that never require auth
const PUBLIC_PATHS = [
  "/login",
  "/reset-password",      // unauthenticated users arrive here with a ?code= from email
  "/set-password",        // handles its own session check client-side
  "/api/",               // all API proxy routes — Render backend enforces its own auth
  "/_next",
  "/favicon",
  "/website",             // static marketing assets (e.g. login hero image) under public/website
  "/capture",             // mobile invoice capture — token-gated, no Supabase session required
];

// /docs pages accessible to DOCS_INVESTOR (and ADMIN)
const INVESTOR_DOCS = ["/docs/pitchdeck.html"];

// All other /docs pages require ADMIN
const isDocsPath = (path) => path.startsWith("/docs/");
const isInvestorDoc = (path) => INVESTOR_DOCS.some((p) => path === p || path.startsWith(p));
const isAdminPath = (path) => path.startsWith("/admin");

export async function middleware(request) {
  const { pathname } = request.nextUrl;

  // Allow public paths through unconditionally
  if (PUBLIC_PATHS.some((p) => pathname.startsWith(p))) {
    return NextResponse.next();
  }

  // Create a response we can attach refreshed cookies to
  const response = NextResponse.next({ request });

  // Build Supabase server client that reads/writes the session cookies
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          for (const { name, value, options } of cookiesToSet) {
            request.cookies.set(name, value);
            response.cookies.set(name, value, options);
          }
        },
      },
    }
  );

  // Retrieve the current session (refreshes if expired)
  const {
    data: { session },
  } = await supabase.auth.getSession();

  const loginUrl = new URL("/login", request.url);

  // ── No session → redirect to login ────────────────────────────────────────
  if (!session) {
    // Preserve the intended destination so we can redirect after login
    loginUrl.searchParams.set("next", pathname);
    return NextResponse.redirect(loginUrl);
  }

  const accessLevel = session.user?.app_metadata?.accessLevel;

  // ── /docs/* — enforce access level ────────────────────────────────────────
  if (isDocsPath(pathname)) {
    if (accessLevel === "ADMIN") {
      return response; // admin sees everything
    }
    if (accessLevel === "DOCS_INVESTOR" && isInvestorDoc(pathname)) {
      // Signal to the static HTML that this is an investor-only session so it
      // can hide hub-bar links the investor is not allowed to visit.
      response.cookies.set("ma_docs_role", "investor", {
        path: "/",
        sameSite: "lax",
        httpOnly: false, // must be readable by client-side JS in the static HTML
        secure: process.env.NODE_ENV === "production",
        maxAge: 60 * 60 * 8, // 8 hours
      });
      return response; // investor sees pitchdeck only
    }
    // All other cases: forbidden — redirect to login with error hint
    loginUrl.searchParams.set("error", "forbidden");
    return NextResponse.redirect(loginUrl);
  }

  // ── /admin/* — require ADMIN ───────────────────────────────────────────────
  if (isAdminPath(pathname)) {
    if (accessLevel !== "ADMIN") {
      return NextResponse.redirect(new URL("/manager", request.url));
    }
    return response;
  }

  // ── App routes — any authenticated session is fine ────────────────────────
  // The backend enforces appRole on individual API endpoints.
  return response;
}

export const config = {
  matcher: [
    /*
     * Match all paths except:
     * - _next/static  (static assets)
     * - _next/image   (image optimisation)
     * - favicon.ico
     */
    "/((?!_next/static|_next/image|favicon\\.ico).*)",
  ],
};
