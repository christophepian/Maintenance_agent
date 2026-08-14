/**
 * Password gate for the standalone product-overview deployment.
 *
 * HTTP Basic Auth against SITE_PASSWORD — any username is accepted, so the
 * recipient only needs the link and the password. The browser remembers the
 * credentials for the session, so it is asked once.
 *
 * Fails CLOSED: if SITE_PASSWORD is not set on the deployment, nothing is
 * served at all. An unprotected page is never the fallback.
 *
 * To rotate: change the env var in the Vercel project and redeploy.
 */

import { next } from "@vercel/edge";

export const config = {
  // Everything except Vercel's own internal endpoints.
  matcher: "/((?!_vercel/).*)",
};

/** Length-safe comparison so a wrong guess costs the same time as a right one. */
function constantTimeEqual(a, b) {
  if (typeof a !== "string" || typeof b !== "string" || a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

function askForPassword() {
  return new Response("Password required.", {
    status: 401,
    headers: {
      "WWW-Authenticate": 'Basic realm="Propfolio — Product Overview", charset="UTF-8"',
      "Content-Type": "text/plain; charset=utf-8",
      "Cache-Control": "no-store",
    },
  });
}

export default function middleware(request) {
  const expected = process.env.SITE_PASSWORD;

  if (!expected) {
    return new Response(
      "This deployment has no SITE_PASSWORD configured, so it serves nothing. " +
        "Set SITE_PASSWORD in the Vercel project settings and redeploy.",
      { status: 503, headers: { "Content-Type": "text/plain; charset=utf-8" } }
    );
  }

  const header = request.headers.get("authorization") || "";
  if (header.startsWith("Basic ")) {
    let decoded = "";
    try {
      decoded = atob(header.slice(6));
    } catch {
      return askForPassword();
    }
    const separator = decoded.indexOf(":");
    if (separator !== -1 && constantTimeEqual(decoded.slice(separator + 1), expected)) {
      return next();
    }
  }

  return askForPassword();
}
