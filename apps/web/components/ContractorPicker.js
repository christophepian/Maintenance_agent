import { useEffect, useState } from "react";

function authHeaders() {
  if (typeof window === "undefined") return {};
  const token = localStorage.getItem("authToken");
  return token ? { Authorization: `Bearer ${token}` } : {};
}

/**
 * Dev/test helper: renders a contractor selector bar.
 * Persists the choice in localStorage("contractorId") and calls `onSelect(id)`
 * whenever the selection changes so the parent page can reload its data.
 */
export default function ContractorPicker({ onSelect }) {
  const [contractors, setContractors] = useState([]);
  const [selected, setSelected] = useState("");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      try {
        // Load full contractor list (uses /api/contractors proxy → backend)
        const res = await fetch("/api/contractors", { headers: authHeaders() });
        const data = await res.json();
        const list = data?.data || data || [];
        setContractors(list);

        // Pre-select from localStorage if already set
        const stored = localStorage.getItem("contractorId");
        if (stored && list.some((c) => c.id === stored)) {
          setSelected(stored);
        }
      } catch {
        // Silently fail — picker just stays empty
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  function handleChange(e) {
    const id = e.target.value;
    setSelected(id);
    if (id) {
      localStorage.setItem("contractorId", id);
    } else {
      localStorage.removeItem("contractorId");
    }
    onSelect?.(id || null);
  }

  if (loading) return null;
  if (contractors.length === 0) {
    return (
      <div className="px-4 py-2 mb-4 bg-amber-50 border border-amber-300 rounded-lg text-sm text-amber-700">
        ⚠️ No contractors found. Assign a contractor to a request first on the{" "}
        <a href="/manager/requests" className="text-blue-800">Manager Requests</a> page.
      </div>
    );
  }

  return (
    <div className="flex items-center gap-2.5 px-4 py-2 mb-4 bg-blue-50 border border-blue-300 rounded-lg text-sm">
      <span className="font-semibold text-blue-800">🧑‍🔧 Viewing as contractor:</span>
      <select
        value={selected}
        onChange={handleChange}
        className="px-2 py-1 rounded-lg border border-blue-300 text-sm min-w-[220px]"
      >
        <option value="">— All (no filter) —</option>
        {contractors.map((c) => (
          <option key={c.id} value={c.id}>
            {c.name || c.companyName || c.id.slice(0, 12)} {c.email ? `(${c.email})` : ""}
          </option>
        ))}
      </select>
      {selected && (
        <span className="text-slate-500 text-xs">
          ID: {selected.slice(0, 8)}…
        </span>
      )}
    </div>
  );
}
