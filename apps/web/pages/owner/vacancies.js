import { useEffect, useState } from "react";
import Link from "next/link";
import AppShell from "../../components/AppShell";
import PageShell from "../../components/layout/PageShell";
import PageHeader from "../../components/layout/PageHeader";
import PageContent from "../../components/layout/PageContent";
import Panel from "../../components/layout/Panel";
import { formatDate } from "../../lib/format";
import { authHeaders } from "../../lib/api";
function statusBadge(status) {
  const map = {
    AWAITING_SIGNATURE: { label: "Awaiting Signature", cls: "bg-amber-100 text-amber-700" },
    FALLBACK_1: { label: "Fallback 1 Active", cls: "bg-orange-100 text-orange-700" },
    FALLBACK_2: { label: "Fallback 2 Active", cls: "bg-red-100 text-red-700" },
  };
  const info = map[status] || { label: status, cls: "bg-slate-100 text-slate-600" };
  return (
    <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-semibold ${info.cls}`}>
      {info.label}
    </span>
  );
}

function leaseBadge(lease) {
  if (!lease) return <span className="text-xs text-slate-400">No lease yet</span>;
  const map = {
    DRAFT: { label: "Draft", cls: "bg-slate-100 text-slate-600" },
    READY_TO_SIGN: { label: "Ready to Sign", cls: "bg-blue-100 text-blue-700" },
    SIGNED: { label: "Signed", cls: "bg-green-100 text-green-700" },
  };
  const info = map[lease.status] || { label: lease.status, cls: "bg-slate-100 text-slate-600" };
  return (
    <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-semibold ${info.cls}`}>
      {info.label}
    </span>
  );
}

export default function OwnerVacanciesPage() {
  const [vacancyRows, setVacancyRows] = useState([]);
  const [selections, setSelections] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectionsLoading, setSelectionsLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    loadVacancies();
    loadSelections();
  }, []);

  async function fetchJson(path) {
    const res = await fetch(path, { headers: authHeaders() });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      throw new Error(data?.error || data?.message || "Request failed");
    }
    return data;
  }

  async function loadVacancies() {
    setLoading(true);
    setError("");
    try {
      // Use the rental pipeline's vacant-units endpoint (isVacant=true)
      const vacantRes = await fetchJson("/api/vacant-units");
      const vacantUnits = vacantRes.data || [];

      // For each vacant unit, fetch candidate count
      const rows = await Promise.all(
        vacantUnits.map(async (unit) => {
          let candidateCount = 0;
          try {
            const appsRes = await fetchJson(
              `/api/owner/rental-applications?unitId=${unit.id}`
            );
            candidateCount = (appsRes.data || []).length;
          } catch {
            // ignore — may not have applications yet
          }
          return {
            ...unit,
            buildingName: unit.building?.name || "—",
            buildingAddress: unit.building?.address || "",
            candidateCount,
          };
        })
      );

      setVacancyRows(rows);
    } catch (err) {
      setError(err?.message || "Failed to load vacancies");
    } finally {
      setLoading(false);
    }
  }

  async function loadSelections() {
    setSelectionsLoading(true);
    try {
      const res = await fetchJson("/api/owner/selections");
      setSelections(res.data || []);
    } catch {
      // Non-critical — silently degrade
    } finally {
      setSelectionsLoading(false);
    }
  }

  return (
    <AppShell role="OWNER">
      <PageShell>
        <PageHeader
          title="Vacancies"
          subtitle="Vacant units open for rental applications"
          actions={
            <button
              onClick={() => { loadVacancies(); loadSelections(); }}
              className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
            >
              Refresh
            </button>
          }
        />

        <PageContent>
          {error && (
            <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
              {error}
            </div>
          )}

          <Panel>
            {loading && <div className="text-sm text-slate-600">Loading vacancies...</div>}

            {!loading && vacancyRows.length === 0 && (
              <div className="rounded-lg border border-slate-200 bg-slate-50 p-6 text-center text-slate-600">
                No vacant residential units detected.
              </div>
            )}

            {!loading && vacancyRows.length > 0 && (
              <div className="overflow-x-auto">
                <table className="min-w-full divide-y divide-slate-200 text-sm">
                  <thead className="bg-slate-50 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">
                    <tr>
                      <th className="px-4 py-3">Building</th>
                      <th className="px-4 py-3">Unit</th>
                      <th className="px-4 py-3">Rent</th>
                      <th className="px-4 py-3">Charges</th>
                      <th className="px-4 py-3">Total</th>
                      <th className="px-4 py-3">Candidates</th>
                      <th className="px-4 py-3 text-right">Action</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 bg-white">
                    {vacancyRows.map((unit) => (
                      <tr key={unit.id}>
                        <td className="px-4 py-3 text-slate-700">{unit.buildingName}</td>
                        <td className="px-4 py-3 text-slate-700">{unit.unitNumber || "—"}</td>
                        <td className="px-4 py-3 text-slate-700">
                          {unit.monthlyRentChf != null
                            ? `CHF ${unit.monthlyRentChf}.-`
                            : "—"}
                        </td>
                        <td className="px-4 py-3 text-slate-700">
                          {unit.monthlyChargesChf != null
                            ? `CHF ${unit.monthlyChargesChf}.-`
                            : "—"}
                        </td>
                        <td className="px-4 py-3 font-semibold text-slate-900">
                          {unit.monthlyRentChf != null || unit.monthlyChargesChf != null
                            ? `CHF ${(unit.monthlyRentChf || 0) + (unit.monthlyChargesChf || 0)}.-`
                            : "—"}
                        </td>
                        <td className="px-4 py-3">
                          {unit.candidateCount > 0 ? (
                            <span className="inline-flex items-center rounded-full bg-indigo-100 px-2 py-0.5 text-xs font-semibold text-indigo-700">
                              {unit.candidateCount}
                            </span>
                          ) : (
                            <span className="text-slate-400 text-xs">None yet</span>
                          )}
                        </td>
                        <td className="px-4 py-3 text-right">
                          <div className="flex items-center justify-end gap-2">
                            <Link
                              href={`/owner/vacancies/${unit.id}/fill`}
                              className="rounded-lg border border-green-200 bg-green-50 px-3 py-2 text-xs font-semibold text-green-700 hover:bg-green-100"
                            >
                              Fill vacancy →
                            </Link>
                            <Link
                              href={`/owner/vacancies/${unit.id}/candidates`}
                              className="rounded-lg border border-indigo-200 bg-indigo-50 px-3 py-2 text-xs font-semibold text-indigo-700 hover:bg-indigo-100"
                            >
                              Review candidates
                            </Link>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </Panel>

          {/* ── Awaiting Signature Pipeline ─────────────────── */}
          <Panel title="Awaiting Signature">
            {selectionsLoading && <div className="text-sm text-slate-600">Loading pipeline...</div>}

            {!selectionsLoading && selections.length === 0 && (
              <div className="rounded-lg border border-slate-200 bg-slate-50 p-6 text-center text-slate-600">
                No units awaiting tenant signature.
              </div>
            )}

            {!selectionsLoading && selections.length > 0 && (
              <div className="overflow-x-auto">
                <table className="min-w-full divide-y divide-slate-200 text-sm">
                  <thead className="bg-slate-50 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">
                    <tr>
                      <th className="px-4 py-3">Building</th>
                      <th className="px-4 py-3">Unit</th>
                      <th className="px-4 py-3">Primary Candidate</th>
                      <th className="px-4 py-3">Status</th>
                      <th className="px-4 py-3">Lease</th>
                      <th className="px-4 py-3">Deadline</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 bg-white">
                    {selections.map((sel) => (
                      <tr key={sel.id}>
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
                        <td className="px-4 py-3">{statusBadge(sel.status)}</td>
                        <td className="px-4 py-3">
                          {sel.lease ? (
                            <span className="inline-flex items-center gap-1.5">
                              {leaseBadge(sel.lease)}
                            </span>
                          ) : (
                            leaseBadge(null)
                          )}
                        </td>
                        <td className="px-4 py-3 text-xs text-slate-500">
                          {formatDate(sel.deadlineAt)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </Panel>
        </PageContent>
      </PageShell>
    </AppShell>
  );
}
