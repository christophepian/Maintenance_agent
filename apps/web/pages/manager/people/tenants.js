import { useEffect, useState } from "react";
import Link from "next/link";
import AppShell from "../../../components/AppShell";
import PageShell from "../../../components/layout/PageShell";
import PageHeader from "../../../components/layout/PageHeader";
import PageContent from "../../../components/layout/PageContent";
import Panel from "../../../components/layout/Panel";
import { authHeaders } from "../../../lib/api";
export default function PeopleTenantsPage() {
  const [tenants, setTenants] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [search, setSearch] = useState("");

  useEffect(() => {
    loadTenants();
  }, []);

  async function loadTenants() {
    setLoading(true);
    setError("");
    try {
      const res = await fetch("/api/people/tenants", { headers: authHeaders() });
      const json = await res.json();
      if (!res.ok) throw new Error(json?.error?.message || "Failed to load tenants");
      setTenants(json?.data || []);
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }

  const filtered = tenants.filter((t) => {
    if (!search) return true;
    const q = search.toLowerCase();
    return (
      (t.name || "").toLowerCase().includes(q) ||
      (t.email || "").toLowerCase().includes(q) ||
      (t.phone || "").includes(q) ||
      (t.unit?.unitNumber || "").toLowerCase().includes(q)
    );
  });

  return (
    <AppShell role="MANAGER">
      <PageShell variant="embedded">
        <PageHeader
          title="Tenants"
          subtitle={`${tenants.length} tenant${tenants.length !== 1 ? "s" : ""}`}
        />
        <PageContent>
          <Panel>
            <div className="mb-4">
              <input
                type="text"
                placeholder="Search by name, email, phone, or unit…"
                className="input text-sm w-full max-w-sm"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
            </div>

            {loading && <p className="text-sm text-slate-500">Loading…</p>}
            {error && <p className="text-sm text-red-600">{error}</p>}

            {!loading && !error && filtered.length === 0 && (
              <div className="empty-state">
                <p className="empty-state-text">{search ? "No tenants match your search." : "No tenants found."}</p>
              </div>
            )}

            {!loading && filtered.length > 0 && (
              <table className="inline-table">
                  <thead>
                    <tr>
                      <th>Name</th>
                      <th>Phone</th>
                      <th>Email</th>
                      <th>Unit</th>
                      <th></th>
                    </tr>
                  </thead>
                  <tbody>
                    {filtered.map((t) => (
                      <tr key={t.id}>
                        <td className="cell-bold">{t.name || "—"}</td>
                        <td>{t.phone || "—"}</td>
                        <td>{t.email || "—"}</td>
                        <td>
                          {t.unit ? `${t.unit.unitNumber}${t.unit.floor ? ` (Floor ${t.unit.floor})` : ""}` : "—"}
                        </td>
                        <td className="text-right">
                          <Link
                            href={`/manager/people/tenants/${t.id}`}
                            className="text-blue-600 hover:text-blue-800 text-xs font-medium"
                          >
                            View →
                          </Link>
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
