import { useEffect, useState, useMemo } from "react";
import Link from "next/link";
import AppShell from "../../../components/AppShell";
import PageShell from "../../../components/layout/PageShell";
import PageHeader from "../../../components/layout/PageHeader";
import PageContent from "../../../components/layout/PageContent";
import Panel from "../../../components/layout/Panel";
import { authHeaders } from "../../../lib/api";
import { ErrorBanner } from "../../../components/ui";

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
          <ErrorBanner error={error} onDismiss={() => setError("")} />

          {/* Search */}
          <div className="mb-4">
            <input
              type="text"
              placeholder="Search buildings…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="px-3 py-1.5 rounded-lg border border-slate-300 text-sm w-[300px]"
            />
          </div>

          {loading ? (
            <p>Loading buildings...</p>
          ) : filtered.length === 0 ? (
            <Panel>
              <p className="m-0">No buildings found.</p>
            </Panel>
          ) : (
            <div className="overflow-x-auto">
              <table className="inline-table">
                <thead>
                  <tr>
                    <th>Name</th>
                    <th>Address</th>
                    <th>Canton</th>
                    <th>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {filtered.map((b) => (
                    <tr key={b.id}>
                      <td className="cell-bold">
                        <Link href={`/admin-inventory/buildings/${b.id}`} className="text-brand-dark hover:underline">
                          {b.name || "Unnamed"}
                        </Link>
                      </td>
                      <td>{b.address || "—"}</td>
                      <td>{b.canton || "—"}</td>
                      <td>
                        <Link
                          href={`/admin-inventory/buildings/${b.id}`}
                          className="px-2.5 py-1 rounded text-xs bg-blue-50 text-blue-800 border border-blue-300 no-underline inline-block"
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
