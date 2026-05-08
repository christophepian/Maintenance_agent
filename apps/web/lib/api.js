/**
 * Shared API helper for all frontend pages.
 *
 * Token storage key: "authToken" in localStorage.
 * After Supabase Auth migration, this key holds the Supabase access_token
 * (a JWT verified by SUPABASE_JWT_SECRET on the backend).
 *
 * The token is written once at login (see pages/login.js + pages/api/auth/callback.js)
 * and kept fresh by the onAuthStateChange listener in components/AppShell.js.
 *
 * All three helper functions (authHeaders / ownerAuthHeaders / tenantHeaders) read
 * from the same key because Supabase issues one token per user regardless of role.
 * Role-based access is enforced on the backend via app_metadata.appRole.
 */

const TOKEN_KEY = "authToken";

// ── Token helpers ─────────────────────────────────────────────────────────────

/**
 * Write the Supabase access_token to localStorage.
 * Called from the login callback and the onAuthStateChange handler.
 * SSR-safe: no-op on the server.
 */
export function setAuthToken(token) {
  if (typeof window === "undefined") return;
  if (token) {
    localStorage.setItem(TOKEN_KEY, token);
  } else {
    localStorage.removeItem(TOKEN_KEY);
    localStorage.removeItem("role");
  }
}

/**
 * Build Authorization header from the stored Supabase access_token.
 * SSR-safe: returns empty object on the server.
 */
export function authHeaders() {
  if (typeof window === "undefined") return {};
  const token = localStorage.getItem(TOKEN_KEY);
  if (token) return { Authorization: `Bearer ${token}` };
  return {};
}

/**
 * Owner pages use the same Supabase token — alias for authHeaders().
 */
export function ownerAuthHeaders() {
  return authHeaders();
}

/**
 * Tenant portal pages: reads tenantToken only.
 * tenantToken is written by: phone login, TenantPicker (dev switch), tenant-dev-login page.
 * Never falls back to authToken — a manager Supabase JWT would fail requireTenantSession.
 */
export function tenantHeaders() {
  if (typeof window === "undefined") return {};
  const token = localStorage.getItem("tenantToken");
  if (token) return { Authorization: `Bearer ${token}` };
  return {};
}

// ── Fetch wrappers ────────────────────────────────────────────────────────────

/**
 * Fetch with automatic tenant Bearer token.
 * Use this in all tenant-portal pages.
 */
export function tenantFetch(url, opts = {}) {
  const headers = { ...tenantHeaders(), ...opts.headers };
  return fetch(url, { ...opts, headers });
}

/**
 * Fetch with automatic Authorization header.
 * Wraps native fetch — same signature, just adds the Bearer token.
 */
export function fetchWithAuth(url, opts = {}) {
  const headers = { ...authHeaders(), ...opts.headers };
  return fetch(url, { ...opts, headers });
}

/**
 * Fetch JSON with auth, parse response, return { data, error, status, ok }.
 */
export async function apiFetch(url, opts = {}) {
  try {
    const res = await fetchWithAuth(url, opts);
    const json = await res.json();
    return {
      data: json.data ?? json,
      error: json.error ?? null,
      status: res.status,
      ok: res.ok,
    };
  } catch (err) {
    return {
      data: null,
      error: { code: "NETWORK_ERROR", message: err.message },
      status: 0,
      ok: false,
    };
  }
}

/**
 * POST JSON with auth.
 */
export function postWithAuth(url, body) {
  return fetchWithAuth(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

/**
 * PATCH JSON with auth.
 */
export function patchWithAuth(url, body) {
  return fetchWithAuth(url, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

/**
 * DELETE with auth.
 */
export function deleteWithAuth(url) {
  return fetchWithAuth(url, { method: "DELETE" });
}
