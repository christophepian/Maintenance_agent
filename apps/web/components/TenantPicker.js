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
      <div style={{
        padding: "8px 16px", marginBottom: 16, backgroundColor: "#fff8e1",
        border: "1px solid #ffe082", borderRadius: 6, fontSize: "0.85em", color: "#7a4a00",
      }}>
        ⚠️ No tenants found in this org.
      </div>
    );
  }

  const current = tenants.find((t) => t.id === selected);

  return (
    <div style={{
      display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap",
      padding: "8px 16px", marginBottom: 16,
      backgroundColor: "#e8f5e9", border: "1px solid #a5d6a7",
      borderRadius: 6, fontSize: "0.85em",
    }}>
      <span style={{ fontWeight: 600, color: "#1b5e20" }}>🏠 Viewing as tenant:</span>
      <select
        value={selected}
        onChange={handleChange}
        disabled={switching}
        style={{ padding: "4px 8px", borderRadius: 4, border: "1px solid #a5d6a7", fontSize: "0.95em", minWidth: 240 }}
      >
        <option value="">— Select a tenant —</option>
        {tenants.map((t) => (
          <option key={t.id} value={t.id}>
            {t.name || t.id.slice(0, 12)} ({t.phone})
          </option>
        ))}
      </select>
      {switching && <span style={{ color: "#388e3c", fontSize: "0.9em" }}>Switching…</span>}
      {current && !switching && (
        <span style={{ color: "#555", fontSize: "0.8em" }}>
          ID: {current.id.slice(0, 8)}…
        </span>
      )}
    </div>
  );
}
