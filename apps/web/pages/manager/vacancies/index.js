import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import AppShell from "../../../components/AppShell";
import PageShell from "../../../components/layout/PageShell";
import PageHeader from "../../../components/layout/PageHeader";
import PageContent from "../../../components/layout/PageContent";
import Panel from "../../../components/layout/Panel";
import { formatDate } from "../../../lib/format";

function authHeaders() {
  if (typeof window === "undefined") return {};
  const token = localStorage.getItem("authToken");
  return token ? { Authorization: `Bearer ${token}` } : {};
}

function selectionStatusBadge(status) {
  const map = {
    AWAITING_SIGNATURE: { label: "Awaiting Signature", cls: "bg-amber-100 text-amber-700" },
    FALLBACK_1: { label: "Fallback 1 Active", cls: "bg-orange-100 text-orange-700" },
    FALLBACK_2: { label: "Fallback 2 Active", cls: "bg-red-100 text-red-700" },
    EXHAUSTED: { label: "Exhausted", cls: "bg-slate-100 text-slate-600" },
  };
  const info = map[status] || { label: status, cls: "bg-slate-100 text-slate-600" };
  return (
    <span className={"inline-flex items-center rounded-full px-2 py-0.5 text-xs font-semibold " + info.cls}>
      {info.label}
    </span>
  );
}

function leaseBadge(lease) {
  if (!lease) return <span className="text-xs text-red-500 font-medium">No lease — action needed</span>;
  const map = {
    DRAFT: { label: "Draft", cls: "bg-slate-100 text-slate-600" },
    READY_TO_SIGN: { label: "Ready to Sign", cls: "bg-blue-100 text-blue-700" },
    SIGNED: { label: "Signed", cls: "bg-green-100 text-green-700" },
  };
  const info = map[lease.status] || { label: lease.status, cls: "bg-slate-100 text-slate-600" };
  return (
    <span className={"inline-flex items-center rounded-full px-2 py-0.5 text-xs font-semibold " + info.cls}>
      {info.label}
    </span>
  );
}

export default function ManagerVacanciesPage() {
  const [units, setUnits] = useState([]);
  const [selections, setSelections] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectionsLoading, setSelectionsLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    loadVacantUnits();
    loadSelections();
  }, []);

  async function loadVacantUnits() {
    setLoading(true);
    setError("");
    try {
      const res = await fetch("/api/vacant-units", { headers: authHeaders() });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data?.message || "Failed to load");
      setUnits(data.data || []);
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }

  async function loadSelections() {
    setSelectionsLoading(true);
    try {
      const res = await fetch("/api/manager/selections", { headers: authHeaders() });
      const data = await res.json().catch(() => ({}));
      if (res.ok) setSelections(data.data || []);
    } catch {
      // Non-critical
    } finally {
      setSelectionsLoading(false);
    }
  }

  const unitsByBuilding = useMemo(() => {
    const map = new Map();
    (units || []).forEach((u) => {
      const bName = u.building?.name || "Unknown";
      if (!map.has(bName)) map.set(bName, { building: u.building, units: [] });
      map.get(bName).units.push(u);
    });
    return Array.from(map.values());
  }, [units]);

  return (
    <AppShell role="MANAGER">
      <PageShell>
        <PageHeader
          title="Vacancies & Lease Pipeline"
          subtitle="Vacant units, applications, and tenant selection status"
          actions={
            <button
              onClick={() => { loadVacantUnits(); loadSelections(); }}
              className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
            >
              Refresh
            </button>
          }
        />

        <PageContent>
          {error && (
            <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{error}</div>
          )}

          {/* ── Tenant Selections Pipeline ─────────────────── */}
          <Panel title={"Tenant Selections" + (selections.length > 0 ? ` (${selections.length})` : "")}>
            {selectionsLoading && <p className="text-sm text-slate-500">Loading selections…</p>}

            {!selectionsLoading && selections.length === 0 && (
              <p className="text-sm text-slate-500 text-center py-4">No active tenant selections.</p>
            )}

            {!selectionsLoading && selections.length > 0 && (
              <div className="overflow-x-auto">
                <table className="min-w-full divide-y divide-slate-200 text-sm">
                  <thead className="bg-slate-50 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">
                    <tr>
                      <th className="px-4 py-3">Building</th>
                      <th className="px-4 py-3">Unit</th>
                      <th className="px-4 py-3">Selected Tenant</th>
                      <th className="px-4 py-3">Status</th>
                      <th className="px-4 py-3">Lease</th>
                      <th className="px-4 py-3">Deadline</th>
                      <th className="px-4 py-3 text-right">Action</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 bg-white">
                    {selections.map((sel) => (
                      <tr key={sel.id} className={!sel.lease ? "bg-amber-50/50" : ""}>
                        <td className="px-4 py-3 text-slate-700">{sel.buildingName || "—"}</td>
                        <td className="px-4 py-3 text-slate-700">{sel.unitNumber || "—"}</td>
                        <td className="px-4 py-3">
                          {sel.primaryCandidate ? (
                            <div>
                              <span className="font-medium text-slate-900">{sel.primaryCandidate.name}</span>
                              <span className="ml-2 text-xs text-slate-400">{sel.primaryCandidate.email}</span>
                            </div>
                          ) : (
                            <span className="text-slate-400">—</span>
                          )}
                        </td>
                        <td className="px-4 py-3">{selectionStatusBadge(sel.status)}</td>
                        <td className="px-4 py-3">
                          {sel.lease ? (
                            <Link
                              href={"/manager/leases/" + sel.lease.id}
                              className="inline-flex items-center gap-1.5 text-indigo-600 hover:underline"
                            >
                              {leaseBadge(sel.lease)}
                            </Link>
                          ) : (
                            leaseBadge(null)
                          )}
                        </td>
                        <td className="px-4 py-3 text-xs text-slate-500">
                          {formatDate(sel.deadlineAt)}
                        </td>
                        <td className="px-4 py-3 text-right">
                          {sel.lease ? (
                            <Link
                              href={"/manager/leases/" + sel.lease.id}
                              className="rounded-lg bg-indigo-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-indigo-700"
                            >
                              View Lease
                            </Link>
                          ) : (
                            <Link
                              href={"/manager/leases/templates?buildingId=" + (sel.buildingId || "")}
                              className="rounded-lg bg-amber-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-amber-700"
                            >
                              Create Lease
                            </Link>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </Panel>

          {/* ── Vacant Units ─────────────────────────────────── */}
          <Panel title="Vacant Units — Open for Applications">
            {loading && <p className="text-sm text-slate-500">Loading…</p>}

            {!loading && units.length === 0 && (
              <p className="text-sm text-slate-500 text-center py-6">No vacant units at this time.</p>
            )}

            {unitsByBuilding.map((group) => (
              <div key={group.building?.id || "unknown"} className="mb-6 last:mb-0">
                <h3 className="text-sm font-semibold text-slate-700 mb-2">
                  {group.building?.name || "Unknown"} — {group.building?.address || ""}
                </h3>
                <div className="overflow-x-auto">
                  <table className="min-w-full divide-y divide-slate-200 text-sm">
                    <thead className="bg-slate-50 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">
                      <tr>
                        <th className="px-4 py-3">Unit</th>
                        <th className="px-4 py-3">Floor</th>
                        <th className="px-4 py-3">Rent (CHF)</th>
                        <th className="px-4 py-3">Charges (CHF)</th>
                        <th className="px-4 py-3 text-right">Applications</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 bg-white">
                      {group.units.map((u) => (
                        <tr key={u.id}>
                          <td className="px-4 py-3 font-medium text-slate-900">{u.unitNumber || "—"}</td>
                          <td className="px-4 py-3 text-slate-600">{u.floor || "—"}</td>
                          <td className="px-4 py-3 text-slate-700">{u.monthlyRentChf ?? "—"}</td>
                          <td className="px-4 py-3 text-slate-700">{u.monthlyChargesChf ?? "—"}</td>
                          <td className="px-4 py-3 text-right">
                            <Link
                              href={"/manager/vacancies/" + u.id + "/applications"}
                              className="rounded-lg bg-indigo-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-indigo-700"
                            >
                              View Applications
                            </Link>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            ))}
          </Panel>
        </PageContent>
      </PageShell>
    </AppShell>
  );
}
