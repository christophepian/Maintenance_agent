import { useEffect, useState, useMemo } from "react";
import Link from "next/link";
import AppShell from "../../../components/AppShell";
import PageShell from "../../../components/layout/PageShell";
import PageHeader from "../../../components/layout/PageHeader";
import PageContent from "../../../components/layout/PageContent";
import Panel from "../../../components/layout/Panel";
import { authHeaders } from "../../../lib/api";

export default function BuildingsListPage() {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [buildings, setBuildings] = useState([]);
  const [search, setSearch] = useState("");

  useEffect(() => {
    async function load() {
      setLoading(true);
      setError("");
      try {
        const res = await fetch("/api/buildings", { headers: authHeaders() });
        const data = await res.json();
        if (!res.ok) throw new Error(data?.error?.message || "Failed to load buildings");
        setBuildings(data?.data || []);
      } catch (e) {
        setError(String(e?.message || e));
      } finally {
        setLoading(false);
      }
    }
    load();
  }, []);

  const filtered = useMemo(() => {
    if (!search) return buildings;
    const q = search.toLowerCase();
    return buildings.filter(
      (b) =>
        (b.name || "").toLowerCase().includes(q) ||
        (b.address || "").toLowerCase().includes(q)
    );
  }, [buildings, search]);

  return (
    <AppShell role="MANAGER">
      <PageShell>
        <PageHeader title="Buildings" />
        <PageContent>
          {error && (
            <Panel style={{ backgroundColor: "#fff0f0", borderColor: "#ffb3b3" }}>
              <strong className="text-err-text">Error:</strong> {error}
              <button onClick={() => setError("")} style={{ marginLeft: 12, fontSize: "0.85em" }}>Dismiss</button>
            </Panel>
          )}

          {/* Search */}
          <div style={{ marginBottom: 16 }}>
            <input
              type="text"
              placeholder="Search buildings…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              style={{ padding: "6px 12px", borderRadius: 4, border: "1px solid #ccc", fontSize: "0.9em", width: 300 }}
            />
          </div>

          {loading ? (
            <p>Loading buildings...</p>
          ) : filtered.length === 0 ? (
            <Panel>
              <p className="m-0">No buildings found.</p>
            </Panel>
          ) : (
            <div style={{ overflowX: "auto" }}>
              <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "0.9em" }}>
                <thead>
                  <tr style={{ borderBottom: "2px solid #ddd", textAlign: "left" }}>
                    <th style={{ padding: "8px 6px" }}>Name</th>
                    <th style={{ padding: "8px 6px" }}>Address</th>
                    <th style={{ padding: "8px 6px" }}>Canton</th>
                    <th style={{ padding: "8px 6px" }}>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {filtered.map((b) => (
                    <tr key={b.id} style={{ borderBottom: "1px solid #eee" }}>
                      <td style={{ padding: "8px 6px", fontWeight: 600 }}>
                        <Link href={`/admin-inventory/buildings/${b.id}`} style={{ color: "#0b3a75", textDecoration: "none" }}>
                          {b.name || "Unnamed"}
                        </Link>
                      </td>
                      <td style={{ padding: "8px 6px" }}>{b.address || "—"}</td>
                      <td style={{ padding: "8px 6px" }}>{b.canton || "—"}</td>
                      <td style={{ padding: "8px 6px" }}>
                        <Link
                          href={`/admin-inventory/buildings/${b.id}`}
                          style={{
                            padding: "4px 10px", borderRadius: 4, fontSize: "0.8em",
                            backgroundColor: "#e3f2fd", color: "#0b3a75", border: "1px solid #90caf9",
                            textDecoration: "none", display: "inline-block",
                          }}
                        >
                          View
                        </Link>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </PageContent>
      </PageShell>
    </AppShell>
  );
}
