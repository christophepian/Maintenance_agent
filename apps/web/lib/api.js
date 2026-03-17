/**
 * Shared API helper for all frontend pages.
 *
 * Provides a single `fetchWithAuth()` function that automatically attaches
 * the correct auth headers (JWT for manager/owner/contractor, session for tenant).
 *
 * Usage:
 *   import { fetchWithAuth } from "../lib/api";  // adjust path as needed
 *   const res = await fetchWithAuth("/api/requests");
 *   const data = await res.json();
 */

/**
 * Build auth headers from localStorage tokens.
 * SSR-safe: returns empty object on server.
 */
export function authHeaders() {
  if (typeof window === "undefined") return {};
  const token = localStorage.getItem("authToken");
  if (token) return { Authorization: `Bearer ${token}` };
  return {};
}

/**
 * Build owner auth headers from localStorage.
 * SSR-safe: returns empty object on server.
 */
export function ownerAuthHeaders() {
  if (typeof window === "undefined") return {};
  const token = localStorage.getItem("ownerToken");
  if (token) return { Authorization: `Bearer ${token}` };
  return {};
}

/**
 * Build tenant auth headers from localStorage.
 * SSR-safe: returns empty object on server.
 */
export function tenantHeaders() {
  if (typeof window === "undefined") return {};
  const token = localStorage.getItem("tenantToken");
  if (token) return { Authorization: `Bearer ${token}` };
  return {};
}

/**
 * Fetch with automatic tenant Bearer token.
 * Use this in all tenant-portal pages.
 *
 * @param {string} url - Relative URL (e.g. "/api/tenant-portal/notifications")
 * @param {RequestInit} [opts] - Standard fetch options
 * @returns {Promise<Response>}
 */
export function tenantFetch(url, opts = {}) {
  const headers = {
    ...tenantHeaders(),
    ...opts.headers,
  };
  return fetch(url, { ...opts, headers });
}

/**
 * Fetch with automatic auth headers.
 * Wraps native fetch — same signature, just adds Authorization / tenant headers.
 *
 * @param {string} url - Relative URL (e.g. "/api/requests") or absolute
 * @param {RequestInit} [opts] - Standard fetch options
 * @returns {Promise<Response>}
 */
export function fetchWithAuth(url, opts = {}) {
  const headers = {
    ...authHeaders(),
    ...opts.headers,
  };
  return fetch(url, { ...opts, headers });
}

/**
 * Fetch JSON with auth, parse response, and return { data, error, status }.
 * Convenience wrapper for the common pattern.
 *
 * @param {string} url
 * @param {RequestInit} [opts]
 * @returns {Promise<{ data: any, error: any, status: number, ok: boolean }>}
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
