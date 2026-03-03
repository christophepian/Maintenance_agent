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
      <div style={{
        padding: "8px 16px", marginBottom: 16, backgroundColor: "#fff8e1",
        border: "1px solid #ffe082", borderRadius: 6, fontSize: "0.85em", color: "#7a4a00",
      }}>
        ⚠️ No contractors found. Assign a contractor to a request first on the{" "}
        <a href="/manager/requests" style={{ color: "#0b3a75" }}>Manager Requests</a> page.
      </div>
    );
  }

  return (
    <div style={{
      display: "flex", alignItems: "center", gap: 10,
      padding: "8px 16px", marginBottom: 16,
      backgroundColor: "#e3f2fd", border: "1px solid #90caf9",
      borderRadius: 6, fontSize: "0.85em",
    }}>
      <span style={{ fontWeight: 600, color: "#0b3a75" }}>🧑‍🔧 Viewing as contractor:</span>
      <select
        value={selected}
        onChange={handleChange}
        style={{ padding: "4px 8px", borderRadius: 4, border: "1px solid #90caf9", fontSize: "0.95em", minWidth: 220 }}
      >
        <option value="">— All (no filter) —</option>
        {contractors.map((c) => (
          <option key={c.id} value={c.id}>
            {c.name || c.companyName || c.id.slice(0, 12)} {c.email ? `(${c.email})` : ""}
          </option>
        ))}
      </select>
      {selected && (
        <span style={{ color: "#666", fontSize: "0.8em" }}>
          ID: {selected.slice(0, 8)}…
        </span>
      )}
    </div>
  );
}
