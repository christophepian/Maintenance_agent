/**
 * /tenant-dev-login — Dev/staging impersonation tool.
 *
 * Lists all tenants with active occupancies. Clicking one issues a real
 * tenant JWT (via POST /__dev/tenant-login) and stores it in:
 *   - localStorage.tenantToken   (read by tenantHeaders())
 *   - localStorage.authToken     (fallback read by tenantHeaders())
 *   - localStorage.tenantSession (read by tenant pages for name/unit display)
 *
 * This page only works when AUTH_OPTIONAL=true is set on the API server.
 * It is intentionally not translated — it is a dev/QA tool, not user-facing.
 */
import { useState, useEffect } from "react";
import { useRouter } from "next/router";
import { withTranslations } from "../lib/i18n";

export default function TenantDevLoginPage() {
  const router = useRouter();
  const [tenants, setTenants] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [loggingIn, setLoggingIn] = useState(null);

  useEffect(() => {
    async function fetchTenants() {
      setLoading(true);
      setError("");
      try {
        const res = await fetch("/api/dev/tenant-list");
        const data = await res.json();
        if (!res.ok) {
          if (res.status === 403) {
            setError("This page is only available when AUTH_OPTIONAL=true is set on the API server.");
          } else {
            setError(data?.error?.message || data?.error || "Failed to load tenants");
          }
          return;
        }
        setTenants(data?.data || []);
      } catch (e) {
        setError(String(e?.message || e));
      } finally {
        setLoading(false);
      }
    }
    fetchTenants();
  }, []);

  async function loginAs(tenant) {
    setLoggingIn(tenant.id);
    setError("");
    try {
      const res = await fetch("/api/dev/tenant-login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ tenantId: tenant.id }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data?.error?.message || data?.error || "Login failed");
        return;
      }
      const { token, ...session } = data.data;
      // Write token to both keys so tenantHeaders() picks it up regardless of path
      localStorage.setItem("tenantToken", token);
      localStorage.setItem("authToken", token);
      localStorage.setItem("tenantSession", JSON.stringify({ ...session, token }));
      router.push("/tenant/requests");
    } catch (e) {
      setError(String(e?.message || e));
    } finally {
      setLoggingIn(null);
    }
  }

  // Clear current tenant session
  function logout() {
    localStorage.removeItem("tenantToken");
    localStorage.removeItem("tenantSession");
    setError("");
  }

  const currentSession = typeof window !== "undefined"
    ? (() => { try { return JSON.parse(localStorage.getItem("tenantSession") || "null"); } catch { return null; } })()
    : null;

  return (
    <div className="min-h-screen bg-slate-50 px-4 py-10">
      <div className="mx-auto max-w-lg">
        {/* Header */}
        <div className="mb-6 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3">
          <p className="text-sm font-semibold text-amber-800">🛠 Dev / QA tool</p>
          <p className="text-xs text-amber-700 mt-0.5">
            Select a tenant to impersonate. Only available when{" "}
            <code className="font-mono bg-amber-100 px-1 rounded">AUTH_OPTIONAL=true</code>{" "}
            is set on the API.
          </p>
        </div>

        <h1 className="text-xl font-bold text-slate-900 mb-2">Log in as Tenant</h1>
        <p className="text-sm text-slate-500 mb-6">
          Click a tenant below to start a session and navigate the full tenant portal.
        </p>

        {/* Current session banner */}
        {currentSession?.tenant && (
          <div className="mb-4 flex items-center justify-between rounded-xl border border-green-200 bg-green-50 px-4 py-3">
            <div>
              <p className="text-sm font-semibold text-green-800">
                Currently logged in as: {currentSession.tenant.name || currentSession.tenant.id}
              </p>
              {currentSession.unit && (
                <p className="text-xs text-green-700 mt-0.5">
                  {currentSession.building?.name} · Unit {currentSession.unit.unitNumber}
                </p>
              )}
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={() => router.push("/tenant/requests")}
                className="rounded-lg bg-green-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-green-700 transition"
              >
                Open portal →
              </button>
              <button
                onClick={logout}
                className="rounded-lg border border-green-300 bg-white px-3 py-1.5 text-xs font-medium text-green-700 hover:bg-green-50 transition"
              >
                Clear
              </button>
            </div>
          </div>
        )}

        {error && (
          <div className="mb-4 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
            {error}
          </div>
        )}

        {loading ? (
          <p className="text-sm text-slate-500">Loading tenants…</p>
        ) : tenants.length === 0 ? (
          <div className="rounded-xl border border-slate-200 bg-white px-6 py-8 text-center">
            <p className="text-sm text-slate-500">No tenants with active occupancies found.</p>
            <p className="text-xs text-slate-400 mt-1">
              Create a tenant and assign them to a unit first.
            </p>
          </div>
        ) : (
          <div className="space-y-2">
            {tenants.map((tenant) => {
              const occ = tenant.occupancies?.[0];
              const unit = occ?.unit;
              const building = unit?.building;
              const isLoggingIn = loggingIn === tenant.id;
              return (
                <button
                  key={tenant.id}
                  type="button"
                  disabled={!!loggingIn}
                  onClick={() => loginAs(tenant)}
                  className="w-full rounded-xl border border-slate-200 bg-white px-4 py-3 text-left hover:bg-slate-50 hover:border-indigo-300 transition disabled:opacity-50 focus-visible:ring-2 focus-visible:ring-indigo-400"
                >
                  <div className="flex items-center justify-between gap-3">
                    <div className="min-w-0">
                      <p className="text-sm font-semibold text-slate-900 truncate">
                        {tenant.name || "(no name)"}
                      </p>
                      <p className="text-xs text-slate-500 mt-0.5">
                        {building?.name ? `${building.name} · ` : ""}
                        {unit ? `Unit ${unit.unitNumber}` : "No active unit"}
                        {unit?.floor ? ` · Floor ${unit.floor}` : ""}
                      </p>
                      {tenant.phone && (
                        <p className="text-xs text-slate-400 mt-0.5 font-mono">{tenant.phone}</p>
                      )}
                    </div>
                    <span className="shrink-0 text-xs font-medium text-indigo-600">
                      {isLoggingIn ? "Logging in…" : "Log in →"}
                    </span>
                  </div>
                </button>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}

export const getStaticProps = withTranslations(["common", "tenant"]);
