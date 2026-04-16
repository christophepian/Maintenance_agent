import { useEffect, useState } from "react";

function authHeaders() {
  if (typeof window === "undefined") return {};
  const token = localStorage.getItem("authToken");
  return token ? { Authorization: `Bearer ${token}` } : {};
}

/**
 * Dev/test helper: renders a tenant selector bar.
 * On selection, calls POST /tenant-session with the tenant's phone number to
 * obtain a fresh JWT, then persists tenantToken + tenantSession in localStorage
 * (same keys used by tenantFetch / tenantHeaders).
 * Calls onSelect() so parent pages can reload their data.
 */
export default function TenantPicker({ onSelect }) {
  const [tenants, setTenants] = useState([]);
  const [selected, setSelected] = useState("");
  const [loading, setLoading] = useState(true);
  const [switching, setSwitching] = useState(false);

  useEffect(() => {
    (async () => {
      try {
        const res = await fetch("/api/tenants?limit=100", { headers: authHeaders() });
        const data = await res.json();
        const list = (data?.data || data || []).filter((t) => t.phone);
        setTenants(list);

        // Pre-select whichever tenant is currently in the session
        const raw = localStorage.getItem("tenantSession");
        if (raw) {
          try {
            const session = JSON.parse(raw);
            const currentId = session?.tenant?.id;
            if (currentId && list.some((t) => t.id === currentId)) {
              setSelected(currentId);
            }
          } catch { /* ignore */ }
        }
      } catch {
        // Silently fail
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  async function handleChange(e) {
    const tenantId = e.target.value;
    setSelected(tenantId);
    if (!tenantId) {
      localStorage.removeItem("tenantToken");
      localStorage.removeItem("tenantSession");
      onSelect?.(null);
      return;
    }

    const tenant = tenants.find((t) => t.id === tenantId);
    if (!tenant?.phone) return;

    setSwitching(true);
    try {
      const res = await fetch("/api/tenant-session", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ phone: tenant.phone }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error?.message || "Failed to start session");

      if (data.data?.token) {
        localStorage.setItem("tenantToken", data.data.token);
      }
      localStorage.setItem("tenantSession", JSON.stringify(data.data));
      onSelect?.(tenantId);
    } catch (err) {
      console.warn("[TenantPicker] session error:", err);
    } finally {
      setSwitching(false);
    }
  }

  if (loading) return null;
  if (tenants.length === 0) {
    return (
      <div className="px-4 py-2 mb-4 bg-amber-50 border border-amber-300 rounded-lg text-sm text-amber-700">
        ⚠️ No tenants found in this org.
      </div>
    );
  }

  const current = tenants.find((t) => t.id === selected);

  return (
    <div className="flex items-center gap-2.5 flex-wrap px-4 py-2 mb-4 bg-green-50 border border-green-300 rounded-lg text-sm">
      <span className="font-semibold text-green-900">🏠 Viewing as tenant:</span>
      <select
        value={selected}
        onChange={handleChange}
        disabled={switching}
        className="px-2 py-1 rounded-lg border border-green-300 text-sm min-w-[240px]"
      >
        <option value="">— Select a tenant —</option>
        {tenants.map((t) => (
          <option key={t.id} value={t.id}>
            {t.name || t.id.slice(0, 12)} ({t.phone})
          </option>
        ))}
      </select>
      {switching && <span className="text-green-700 text-sm">Switching…</span>}
      {current && !switching && (
        <span className="text-slate-600 text-xs">
          ID: {current.id.slice(0, 8)}…
        </span>
      )}
    </div>
  );
}
