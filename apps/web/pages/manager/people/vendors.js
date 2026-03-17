import { useEffect, useState, useMemo } from "react";
import { useRouter } from "next/router";
import Link from "next/link";
import AppShell from "../../../components/AppShell";
import PageShell from "../../../components/layout/PageShell";
import PageHeader from "../../../components/layout/PageHeader";
import PageContent from "../../../components/layout/PageContent";
import Panel from "../../../components/layout/Panel";
import SortableHeader from "../../../components/SortableHeader";
import { useTableSort, clientSort } from "../../../lib/tableUtils";
import { authHeaders } from "../../../lib/api";

const VENDOR_SORT_FIELDS = ["name", "phone", "email", "hourlyRate"];

function vendorFieldExtractor(c, field) {
  switch (field) {
    case "name": return (c.name || "").toLowerCase();
    case "phone": return c.phone || "";
    case "email": return (c.email || "").toLowerCase();
    case "hourlyRate": return c.hourlyRate ?? -1;
    default: return "";
  }
}
export default function PeopleVendorsPage() {
  const router = useRouter();
  const [contractors, setContractors] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [search, setSearch] = useState("");

  useEffect(() => {
    loadContractors();
  }, []);

  async function loadContractors() {
    setLoading(true);
    setError("");
    try {
      const res = await fetch("/api/people/vendors", { headers: authHeaders() });
      const json = await res.json();
      if (!res.ok) throw new Error(json?.error?.message || "Failed to load contractors");
      setContractors(json?.data || []);
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }

  const filtered = contractors.filter((c) => {
    if (!search) return true;
    const q = search.toLowerCase();
    return (
      (c.name || "").toLowerCase().includes(q) ||
      (c.email || "").toLowerCase().includes(q) ||
      (c.phone || "").includes(q)
    );
  });

  const { sortField, sortDir, handleSort } = useTableSort(router, VENDOR_SORT_FIELDS, { defaultField: "name", defaultDir: "asc" });
  const sortedVendors = useMemo(() => clientSort(filtered, sortField, sortDir, vendorFieldExtractor), [filtered, sortField, sortDir]);

  return (
    <AppShell role="MANAGER">
      <PageShell variant="embedded">
        <PageHeader
          title="Contractors"
          subtitle={`${contractors.length} contractor${contractors.length !== 1 ? "s" : ""}`}
        />
        <PageContent>
          <Panel>
            <div className="mb-4">
              <input
                type="text"
                placeholder="Search by name, email, or phone…"
                className="input text-sm w-full max-w-sm"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
            </div>

            {loading && <p className="text-sm text-slate-500">Loading…</p>}
            {error && <p className="text-sm text-red-600">{error}</p>}

            {!loading && !error && filtered.length === 0 && (
              <div className="empty-state">
                <p className="empty-state-text">{search ? "No contractors match your search." : "No contractors found."}</p>
              </div>
            )}

            {!loading && filtered.length > 0 && (
              <table className="inline-table">
                  <thead>
                    <tr>
                      <SortableHeader label="Name" field="name" sortField={sortField} sortDir={sortDir} onSort={handleSort} />
                      <SortableHeader label="Phone" field="phone" sortField={sortField} sortDir={sortDir} onSort={handleSort} />
                      <SortableHeader label="Email" field="email" sortField={sortField} sortDir={sortDir} onSort={handleSort} />
                      <SortableHeader label="Rate" field="hourlyRate" sortField={sortField} sortDir={sortDir} onSort={handleSort} />
                      <th></th>
                    </tr>
                  </thead>
                  <tbody>
                    {sortedVendors.map((c) => (
                      <tr key={c.id}>
                        <td className="cell-bold">{c.name || "—"}</td>
                        <td>{c.phone || "—"}</td>
                        <td>{c.email || "—"}</td>
                        <td>
                          {c.hourlyRate != null ? `CHF ${c.hourlyRate}/h` : "—"}
                        </td>
                        <td className="text-right">
                          <Link
                            href={`/manager/people/vendors/${c.id}`}
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
