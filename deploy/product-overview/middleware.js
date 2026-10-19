/**
 * Password gate for the standalone product-overview deployment.
 *
 * A form + cookie, not HTTP Basic Auth: Vercel strips the WWW-Authenticate
 * header from Edge Middleware responses, so a browser given a 401 has nothing
 * to prompt with and simply renders the body as text.
 *
 * Flow:
 *   any request without a valid cookie  → the unlock page (401)
 *   POST /__unlock with the password    → sets the cookie, redirects back
 *   any request with a valid cookie     → the site
 *
 * The cookie holds the SHA-256 of the password, never the password itself, and
 * is HttpOnly + Secure + SameSite=Lax.
 *
 * Fails CLOSED: with SITE_PASSWORD unset nothing is served at all. An
 * unprotected page is never the fallback.
 *
 * To rotate: change SITE_PASSWORD in the Vercel project and redeploy — every
 * existing cookie stops matching immediately.
 */

import { next } from "@vercel/edge";

export const config = {
  // Everything except Vercel's own internal endpoints.
  matcher: "/((?!_vercel/).*)",
};

const COOKIE = "po_gate";
const MAX_AGE = 60 * 60 * 24 * 30; // 30 days
const UNLOCK_PATH = "/__unlock";

async function sha256Hex(value) {
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(value));
  return Array.from(new Uint8Array(digest))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

/** Length-safe comparison so a wrong guess costs the same time as a right one. */
function constantTimeEqual(a, b) {
  if (typeof a !== "string" || typeof b !== "string" || a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

function readCookie(request, name) {
  const header = request.headers.get("cookie");
  if (!header) return null;
  for (const part of header.split(";")) {
    const eq = part.indexOf("=");
    if (eq === -1) continue;
    if (part.slice(0, eq).trim() === name) return part.slice(eq + 1).trim();
  }
  return null;
}

/** Only ever redirect back to a path on this site. */
function safeTarget(value) {
  if (typeof value !== "string" || !value.startsWith("/") || value.startsWith("//")) return "/";
  return value;
}

function escapeHtml(value) {
  return value.replace(/[&<>"']/g, (c) =>
    ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]
  );
}

function unlockPage({ failed, target }) {
  const html = `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="robots" content="noindex, nofollow">
<title>Propfolio — Product Overview</title>
<link rel="icon" href="data:image/svg+xml,%3Csvg%20xmlns%3D%22http%3A//www.w3.org/2000/svg%22%20viewBox%3D%220%200%2032%2032%22%3E%3Crect%20width%3D%2232%22%20height%3D%2232%22%20rx%3D%227%22%20fill%3D%22%234f46e5%22/%3E%3Ctext%20x%3D%2216%22%20y%3D%2223.5%22%20font-family%3D%22Georgia%2Cserif%22%20font-size%3D%2221%22%20font-weight%3D%22700%22%20fill%3D%22%23ffffff%22%20text-anchor%3D%22middle%22%3EP%3C/text%3E%3C/svg%3E">
<style>
  :root {
    --bg: #f8f9fc; --surface: #fff; --border: #e2e6f0;
    --text: #1a1f36; --text-secondary: #6b7280; --brand: #4f46e5; --rose: #e11d48;
  }
  * { box-sizing: border-box; }
  body {
    margin: 0; min-height: 100vh; display: flex; align-items: center; justify-content: center;
    padding: 24px; background: linear-gradient(160deg, #fff 0%, #f5f3ff 50%, #eff6ff 100%);
    font-family: 'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
    color: var(--text);
  }
  .card {
    width: 100%; max-width: 380px; background: var(--surface);
    border: 1px solid var(--border); border-radius: 14px; padding: 30px 28px;
    box-shadow: 0 1px 3px rgba(0,0,0,.08), 0 8px 32px rgba(0,0,0,.06);
  }
  .mark {
    width: 38px; height: 38px; border-radius: 10px; background: var(--brand); color: #fff;
    display: flex; align-items: center; justify-content: center;
    font-family: Georgia, serif; font-size: 20px; font-weight: 700; margin-bottom: 18px;
  }
  h1 { font-size: 17px; font-weight: 700; margin: 0 0 6px; letter-spacing: -.2px; }
  p.sub { font-size: 13.5px; line-height: 1.55; color: var(--text-secondary); margin: 0 0 20px; }
  label { display: block; font-size: 12.5px; font-weight: 600; margin-bottom: 6px; }
  input {
    width: 100%; padding: 10px 12px; font-size: 14px; font-family: inherit; color: var(--text);
    background: var(--bg); border: 1px solid var(--border); border-radius: 8px;
  }
  input:focus { outline: 2px solid var(--brand); outline-offset: 1px; border-color: var(--brand); }
  button {
    width: 100%; margin-top: 14px; padding: 11px 16px; font-family: inherit;
    font-size: 14px; font-weight: 600; color: #fff; background: var(--brand);
    border: 0; border-radius: 8px; cursor: pointer; transition: background .15s;
  }
  button:hover { background: #4338ca; }
  button:focus-visible { outline: 2px solid var(--brand); outline-offset: 2px; }
  .error {
    font-size: 12.5px; color: var(--rose); margin: 12px 0 0;
  }
  .foot { font-size: 11.5px; color: var(--text-secondary); margin: 18px 0 0; }
</style>
</head>
<body>
  <main class="card">
    <div class="mark" aria-hidden="true">P</div>
    <h1>Product overview</h1>
    <p class="sub">This page is private. Enter the password you were sent to open it.</p>
    <form method="POST" action="${UNLOCK_PATH}">
      <input type="hidden" name="next" value="${escapeHtml(target)}">
      <label for="password">Password</label>
      <input id="password" name="password" type="password" autocomplete="current-password"
             autofocus required aria-describedby="${failed ? "err" : "hint"}">
      <button type="submit">Open</button>
      ${failed ? '<p class="error" id="err" role="alert">That password is not right. Try again.</p>' : ""}
    </form>
    <p class="foot" id="hint">Propfolio — Swiss property investment platform</p>
  </main>
</body>
</html>`;
  return new Response(html, {
    status: 401,
    headers: { "content-type": "text/html; charset=utf-8", "cache-control": "no-store" },
  });
}

export default async function middleware(request) {
  const expected = process.env.SITE_PASSWORD;

  if (!expected) {
    return new Response(
      "This deployment has no SITE_PASSWORD configured, so it serves nothing. " +
        "Set SITE_PASSWORD in the Vercel project settings and redeploy.",
      { status: 503, headers: { "content-type": "text/plain; charset=utf-8" } }
    );
  }

  const url = new URL(request.url);
  const token = await sha256Hex(expected);

  // ── Submitting the form ───────────────────────────────────────────────────
  if (request.method === "POST" && url.pathname === UNLOCK_PATH) {
    const body = new URLSearchParams(await request.text());
    const target = safeTarget(body.get("next"));
    const supplied = await sha256Hex(body.get("password") || "");

    if (constantTimeEqual(supplied, token)) {
      return new Response(null, {
        status: 303,
        headers: {
          location: target,
          "cache-control": "no-store",
          "set-cookie": `${COOKIE}=${token}; Path=/; Max-Age=${MAX_AGE}; HttpOnly; Secure; SameSite=Lax`,
        },
      });
    }
    return unlockPage({ failed: true, target });
  }

  // A GET on the unlock path is someone reloading after a submit — send them home.
  if (url.pathname === UNLOCK_PATH) {
    return new Response(null, { status: 303, headers: { location: "/" } });
  }

  // ── Already unlocked ──────────────────────────────────────────────────────
  if (constantTimeEqual(readCookie(request, COOKIE) || "", token)) {
    return next();
  }

  return unlockPage({ failed: false, target: url.pathname + url.search });
}
