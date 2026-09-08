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

// Kept in sync with lib/demo/serve.js — inlined rather than imported so the
// edge bundle doesn't pull the fixture JSON in.
const DEMO_BUILDING_ID = "demo-building";
const DEMO_ID_PREFIX = "demo-";

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
// Only the real /admin area (admin/users) is ADMIN-gated — NOT /admin-inventory,
// which is the shared buildings/units inventory that managers AND owners use.
const isAdminPath = (path) => path === "/admin" || path.startsWith("/admin/");

export async function middleware(request) {
  const { pathname } = request.nextUrl;

  // ── Locale preference redirect ─────────────────────────────────────────────
  // If the user has previously chosen a non-default locale (persisted in the
  // NEXT_LOCALE cookie by LocaleSwitcher), redirect bare URLs to the locale-
  // prefixed variant so the chosen language survives cross-page navigation.
  // Skip static assets, API proxy routes, and paths that are already prefixed.
  const NON_DEFAULT_LOCALES = ["fr"];
  const preferredLocale = request.cookies.get("NEXT_LOCALE")?.value;
  if (
    preferredLocale &&
    NON_DEFAULT_LOCALES.includes(preferredLocale) &&
    request.nextUrl.locale !== preferredLocale &&
    !pathname.startsWith("/_next") &&
    !pathname.startsWith("/api/") &&
    !pathname.startsWith("/favicon")
  ) {
    const url = request.nextUrl.clone();
    url.pathname = `/${preferredLocale}${pathname}`;
    return NextResponse.redirect(url);
  }

  // Allow public paths through unconditionally
  if (PUBLIC_PATHS.some((p) => pathname.startsWith(p))) {
    return NextResponse.next();
  }

  // ── Public demo ───────────────────────────────────────────────────────────
  // /onboarding?demo=1 is a self-contained, session-less walkthrough of the
  // first-login wizard (nothing is persisted — every write is stubbed client
  // side), and it ends on the demo building's page. Both are let through so the
  // whole story can be shown without an account.
  //
  // The building page is safe unauthenticated because the ONLY id allowed here
  // is the demo one, and the API routes answer it from a static snapshot rather
  // than the backend (see lib/demo/serve.js) — no real building is reachable.
  if (pathname.startsWith("/onboarding") && request.nextUrl.searchParams.get("demo") === "1") {
    return NextResponse.next();
  }
  // The demo journey spans three pages: the building, the planning workspace it
  // hands off to, and the cashflow plan the simulator ends on. All are safe
  // unauthenticated because the ONLY ids reachable are the demo ones, and the
  // API routes answer those from a static snapshot rather than the backend
  // (see lib/demo/serve.js) — no real building, unit or plan is reachable.
  if (pathname === `/admin-inventory/buildings/${DEMO_BUILDING_ID}`) {
    return NextResponse.next();
  }
  if (pathname.startsWith(`/manager/cashflow/${DEMO_ID_PREFIX}`)) {
    return NextResponse.next();
  }
  // The planning workspace isn't addressed by id, so it carries the demo
  // building in its query instead.
  if (
    pathname === "/manager/finance" &&
    request.nextUrl.searchParams.get("buildingId") === DEMO_BUILDING_ID
  ) {
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

  // ── DOCS_INVESTOR — pitchdeck only, no app access ────────────────────────
  // Redirect any non-docs path back to the pitchdeck so the investor never
  // sees the app navigation or other pages.
  if (accessLevel === "DOCS_INVESTOR" && !isDocsPath(pathname)) {
    return NextResponse.redirect(new URL("/docs/pitchdeck.html", request.url));
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
