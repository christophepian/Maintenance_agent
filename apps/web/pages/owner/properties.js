import { useState, useEffect } from "react";
import Link from "next/link";
import AppShell from "../../components/AppShell";
import PageShell from "../../components/layout/PageShell";
import PageHeader from "../../components/layout/PageHeader";
import PageContent from "../../components/layout/PageContent";
import Panel from "../../components/layout/Panel";
import { ownerAuthHeaders } from "../../lib/api";

export default function OwnerPropertiesPage() {
  const [buildings, setBuildings] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    loadBuildings();
  }, []);

  async function loadBuildings() {
    setLoading(true);
    setError("");
    try {
      const res = await fetch("/api/buildings", { headers: ownerAuthHeaders() });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data?.message || "Failed to load properties");
      setBuildings(data.data || []);
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <AppShell role="OWNER">
      <PageShell>
        <PageHeader
          title="Properties"
          subtitle="Buildings and units in your portfolio"
          actions={
            <button
              onClick={loadBuildings}
              className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
            >
              Refresh
            </button>
          }
        />
        <PageContent>
          {error && (
            <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700 mb-4">
              {error}
            </div>
          )}

          <Panel bodyClassName="p-0">
            {loading ? (
              <p className="loading-text">Loading properties…</p>
            ) : buildings.length === 0 ? (
              <div className="empty-state">
                <p className="empty-state-text">No properties found.</p>
              </div>
            ) : (
              <table className="inline-table">
                <thead>
                  <tr>
                    <th>Building</th>
                    <th>Address</th>
                    <th>Units</th>
                    <th>Status</th>
                  </tr>
                </thead>
                <tbody>
                  {buildings.map((b) => (
                    <tr key={b.id}>
                      <td className="cell-bold">{b.name}</td>
                      <td className="text-slate-500">{b.address || "—"}</td>
                      <td>{b.unitCount ?? b._count?.units ?? "—"}</td>
                      <td>
                        <span className={
                          "inline-flex items-center rounded-full px-2 py-0.5 text-xs font-semibold " +
                          (b.isActive === false
                            ? "bg-slate-100 text-slate-500"
                            : "bg-green-100 text-green-700")
                        }>
                          {b.isActive === false ? "Inactive" : "Active"}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </Panel>
        </PageContent>
      </PageShell>
    </AppShell>
  );
}
