import { useEffect, useState } from "react";

function authHeaders() {
  if (typeof window === "undefined") return {};
  const token = localStorage.getItem("authToken");
  return token ? { Authorization: `Bearer ${token}` } : {};
}

/**
 * Dev/test helper: renders an owner selector bar on owner portal pages.
 * On selection, calls POST /api/dev/switch-owner with the manager token to
 * obtain a fresh JWT for that OWNER user, then persists it as `ownerToken`
 * in localStorage. Calls onSelect() so parent pages can reload their data.
 *
 * Only renders in non-production environments.
 */
export default function OwnerPicker({ onSelect }) {
  const [owners, setOwners] = useState([]);
  const [selected, setSelected] = useState("");
  const [loading, setLoading] = useState(true);
  const [switching, setSwitching] = useState(false);

  useEffect(() => {
    (async () => {
      try {
        const res = await fetch("/api/people/owners?limit=100", { headers: authHeaders() });
        const data = await res.json();
        const list = data?.data || data || [];
        setOwners(list);

        // Pre-select whichever owner token is currently active
        const raw = localStorage.getItem("ownerToken");
        if (raw) {
          try {
            const { userId } = JSON.parse(atob(raw.split(".")[1]));
            if (userId && list.some((o) => o.id === userId)) {
              setSelected(userId);
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
    const ownerId = e.target.value;
    setSelected(ownerId);
    if (!ownerId) {
      localStorage.removeItem("ownerToken");
      onSelect?.(null);
      return;
    }

    setSwitching(true);
    try {
      const res = await fetch("/api/dev/switch-owner", {
        method: "POST",
        headers: { "Content-Type": "application/json", ...authHeaders() },
        body: JSON.stringify({ ownerId }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error?.message || "Failed to switch owner");
      if (data.data?.token) {
        localStorage.setItem("ownerToken", data.data.token);
      }
      onSelect?.(ownerId);
    } catch (err) {
      console.warn("[OwnerPicker] switch error:", err);
    } finally {
      setSwitching(false);
    }
  }

  if (loading) return null;
  if (owners.length === 0) {
    return (
      <div className="px-4 py-2 mb-4 bg-amber-50 border border-amber-300 rounded-lg text-sm text-amber-700">
        ⚠️ No owners found in this org.
      </div>
    );
  }

  const current = owners.find((o) => o.id === selected);

  return (
    <div className="flex items-center gap-2.5 flex-wrap px-4 py-2 mb-4 bg-indigo-50 border border-indigo-300 rounded-lg text-sm">
      <span className="font-semibold text-indigo-900">🏛 Viewing as owner:</span>
      <select
        value={selected}
        onChange={handleChange}
        disabled={switching}
        className="px-2 py-1 rounded-lg border border-indigo-300 text-sm min-w-[240px]"
      >
        <option value="">— Select an owner —</option>
        {owners.map((o) => (
          <option key={o.id} value={o.id}>
            {o.name || o.id.slice(0, 12)}{o.email ? ` (${o.email})` : ""}
          </option>
        ))}
      </select>
      {switching && <span className="text-indigo-700 text-sm">Switching…</span>}
      {current && !switching && (
        <span className="text-muted-text text-xs">
          ID: {current.id.slice(0, 8)}…
        </span>
      )}
    </div>
  );
}
