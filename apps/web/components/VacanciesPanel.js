import { useEffect, useState, useCallback } from "react";
import Link from "next/link";
import Panel from "./layout/Panel";
import ErrorBanner from "./ui/ErrorBanner";
import { formatDate } from "../lib/format";
import { authHeaders } from "../lib/api";
import Badge from "./ui/Badge";
import { selectionVariant, leaseVariant } from "../lib/statusVariants";

const SELECTION_LABELS = {
  AWAITING_SIGNATURE: "Awaiting Signature",
  FALLBACK_1: "Fallback 1 Active",
  FALLBACK_2: "Fallback 2 Active",
};
function statusBadge(status) {
  return (
    <Badge variant={selectionVariant(status)} size="sm">
      {SELECTION_LABELS[status] || status}
    </Badge>
  );
}

function leaseBadge(lease) {
  if (!lease) return <span className="text-xs text-slate-400">No lease yet</span>;
  const LEASE_LABELS = { DRAFT: "Draft", READY_TO_SIGN: "Ready to Sign", SIGNED: "Signed" };
  return (
    <Badge variant={leaseVariant(lease.status)} size="sm">
      {LEASE_LABELS[lease.status] || lease.status}
    </Badge>
  );
}

/**
 * Shared vacancies panel — renders vacant units table + awaiting-signature pipeline.
 * Used by both /owner/vacancies and /manager/inventory (vacancies tab).
 *
 * @param {Object} props
 * @param {"OWNER"|"MANAGER"} props.role — controls action link paths
 * @param {number} [props.refreshKey] — increment to trigger data reload
 */
export default function VacanciesPanel({ role = "OWNER", refreshKey = 0 }) {
  const [vacancyRows, setVacancyRows] = useState([]);
  const [selections, setSelections] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectionsLoading, setSelectionsLoading] = useState(true);
  const [error, setError] = useState("");

  const fetchJson = useCallback(async (path) => {
    const res = await fetch(path, { headers: authHeaders() });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      throw new Error(data?.error || data?.message || "Request failed");
    }
    return data;
  }, []);

  const loadVacancies = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const vacantRes = await fetchJson("/api/vacant-units");
      const vacantUnits = vacantRes.data || [];

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
  }, [fetchJson]);

  const loadSelections = useCallback(async () => {
    setSelectionsLoading(true);
    try {
      const res = await fetchJson("/api/owner/selections");
      setSelections(res.data || []);
    } catch {
      // Non-critical — silently degrade
    } finally {
      setSelectionsLoading(false);
    }
  }, [fetchJson]);

  useEffect(() => {
    loadVacancies();
    loadSelections();
  }, [refreshKey, loadVacancies, loadSelections]);

  // Build action paths based on role
  const fillPath = (unitId) =>
    role === "MANAGER"
      ? `/manager/vacancies/${unitId}/fill`
      : `/owner/vacancies/${unitId}/fill`;

  const candidatesPath = (unitId) =>
    role === "MANAGER"
      ? `/manager/vacancies/${unitId}/applications`
      : `/owner/vacancies/${unitId}/candidates`;

  return (
    <>
      <ErrorBanner error={error} className="text-sm" />

      <Panel>
        {loading && <div className="text-sm text-slate-600">Loading vacancies...</div>}

        {!loading && vacancyRows.length === 0 && (
          <div className="rounded-lg border border-slate-200 bg-slate-50 p-6 text-center text-slate-600">
            No vacant residential units detected.
          </div>
        )}

        {!loading && vacancyRows.length > 0 && (
          <>
            {/* Mobile: card list */}
            <div className="sm:hidden divide-y divide-slate-100">
              {vacancyRows.map((unit) => (
                <div key={unit.id} className="px-4 py-3 flex items-center justify-between gap-3">
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-medium text-slate-900 truncate">{unit.buildingName}</p>
                    <p className="text-xs text-slate-500 mt-0.5">
                      Unit {unit.unitNumber || "—"}
                      {(unit.monthlyRentChf != null || unit.monthlyChargesChf != null) && (
                        <span className="ml-2 font-medium text-slate-700">
                          CHF {(unit.monthlyRentChf || 0) + (unit.monthlyChargesChf || 0)}.-
                        </span>
                      )}
                    </p>
                  </div>
                  <Link
                    href={fillPath(unit.id)}
                    className="shrink-0 rounded-lg border border-green-200 bg-green-50 px-3 py-2 text-xs font-semibold text-green-700 hover:bg-green-100"
                  >
                    Fill →
                  </Link>
                </div>
              ))}
            </div>
            {/* Desktop: table */}
            <table className="hidden sm:table min-w-full divide-y divide-slate-200 text-sm">
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
                      {unit.monthlyRentChf != null ? `CHF ${unit.monthlyRentChf}.-` : "—"}
                    </td>
                    <td className="px-4 py-3 text-slate-700">
                      {unit.monthlyChargesChf != null ? `CHF ${unit.monthlyChargesChf}.-` : "—"}
                    </td>
                    <td className="px-4 py-3 font-semibold text-slate-900">
                      {unit.monthlyRentChf != null || unit.monthlyChargesChf != null
                        ? `CHF ${(unit.monthlyRentChf || 0) + (unit.monthlyChargesChf || 0)}.-`
                        : "—"}
                    </td>
                    <td className="px-4 py-3">
                      {unit.candidateCount > 0 ? (
                        <Badge variant="brand" size="sm">{unit.candidateCount}</Badge>
                      ) : (
                        <span className="text-slate-400 text-xs">None yet</span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-right">
                      <div className="flex items-center justify-end gap-2">
                        <Link href={fillPath(unit.id)} className="rounded-lg border border-green-200 bg-green-50 px-3 py-2 text-xs font-semibold text-green-700 hover:bg-green-100">
                          Fill vacancy →
                        </Link>
                        <Link href={candidatesPath(unit.id)} className="rounded-lg border border-indigo-200 bg-indigo-50 px-3 py-2 text-xs font-semibold text-indigo-700 hover:bg-indigo-100">
                          Review candidates
                        </Link>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </>
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
          <>
            {/* Mobile: card list */}
            <div className="sm:hidden divide-y divide-slate-100">
              {selections.map((sel) => (
                <div key={sel.id} className="px-4 py-3 flex items-start justify-between gap-3">
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-medium text-slate-900 truncate">
                      {sel.buildingName || "—"}{sel.unitNumber ? ` · ${sel.unitNumber}` : ""}
                    </p>
                    {sel.primaryCandidate && (
                      <p className="text-xs text-slate-500 mt-0.5 truncate">{sel.primaryCandidate.name}</p>
                    )}
                  </div>
                  {statusBadge(sel.status)}
                </div>
              ))}
            </div>
            {/* Desktop: table */}
            <table className="hidden sm:table min-w-full divide-y divide-slate-200 text-sm">
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
                        <span className="inline-flex items-center gap-1.5">{leaseBadge(sel.lease)}</span>
                      ) : leaseBadge(null)}
                    </td>
                    <td className="px-4 py-3 text-xs text-slate-500">{formatDate(sel.deadlineAt)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </>
        )}
      </Panel>
    </>
  );
}
