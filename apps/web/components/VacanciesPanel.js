import { useEffect, useState, useCallback } from "react";
import Link from "next/link";
import Panel from "./layout/Panel";
import ConfigurableTable from "./ConfigurableTable";
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

      {loading ? (
        <p className="loading-text">Loading vacancies…</p>
      ) : (
        <ConfigurableTable
          tableId="vacancies-vacant-units"
          columns={[
            { id: "building", label: "Building", sortable: false, defaultVisible: true,
              render: (u) => u.buildingName },
            { id: "unit", label: "Unit", sortable: false, defaultVisible: true,
              render: (u) => u.unitNumber || "—" },
            { id: "rent", label: "Rent", sortable: false, defaultVisible: true,
              render: (u) => u.monthlyRentChf != null ? `CHF ${u.monthlyRentChf}.-` : "—" },
            { id: "charges", label: "Charges", sortable: false, defaultVisible: true,
              render: (u) => u.monthlyChargesChf != null ? `CHF ${u.monthlyChargesChf}.-` : "—" },
            { id: "total", label: "Total", sortable: false, defaultVisible: true, className: "font-semibold",
              render: (u) => u.monthlyRentChf != null || u.monthlyChargesChf != null
                ? `CHF ${(u.monthlyRentChf || 0) + (u.monthlyChargesChf || 0)}.-`
                : "—" },
            { id: "candidates", label: "Candidates", sortable: false, defaultVisible: true,
              render: (u) => u.candidateCount > 0
                ? <Badge variant="brand" size="sm">{u.candidateCount}</Badge>
                : <span className="text-slate-400 text-xs">None yet</span> },
            { id: "actions", label: "Actions", sortable: false, alwaysVisible: true, className: "text-right", headerClassName: "text-right",
              render: (u) => (
                <div className="flex items-center justify-end gap-2">
                  <Link href={fillPath(u.id)} className="rounded-lg border border-green-200 bg-green-50 px-3 py-2 text-xs font-semibold text-green-700 hover:bg-green-100">
                    Fill vacancy →
                  </Link>
                  <Link href={candidatesPath(u.id)} className="rounded-lg border border-indigo-200 bg-indigo-50 px-3 py-2 text-xs font-semibold text-indigo-700 hover:bg-indigo-100">
                    Review candidates
                  </Link>
                </div>
              ) },
          ]}
          data={vacancyRows}
          rowKey="id"
          emptyState={<p className="empty-state-text">No vacant residential units detected.</p>}
        />
      )}

      {/* ── Awaiting Signature Pipeline ─────────────────── */}
      <Panel title="Awaiting Signature" bodyClassName="p-0">
        {selectionsLoading ? (
          <p className="loading-text px-4 py-3">Loading pipeline…</p>
        ) : (
          <ConfigurableTable
            tableId="vacancies-awaiting-signature"
            columns={[
              { id: "building", label: "Building", sortable: false, defaultVisible: true,
                render: (sel) => sel.buildingName || "—" },
              { id: "unit", label: "Unit", sortable: false, defaultVisible: true,
                render: (sel) => sel.unitNumber || "—" },
              { id: "candidate", label: "Primary Candidate", sortable: false, defaultVisible: true,
                render: (sel) => sel.primaryCandidate
                  ? <span><span className="font-medium text-slate-900">{sel.primaryCandidate.name}</span><span className="ml-2 text-xs text-slate-400">{sel.primaryCandidate.email}</span></span>
                  : <span className="text-slate-400">—</span> },
              { id: "status", label: "Status", sortable: false, defaultVisible: true,
                render: (sel) => statusBadge(sel.status) },
              { id: "lease", label: "Lease", sortable: false, defaultVisible: true,
                render: (sel) => leaseBadge(sel.lease) },
              { id: "deadline", label: "Deadline", sortable: false, defaultVisible: true,
                render: (sel) => formatDate(sel.deadlineAt) },
            ]}
            data={selections}
            rowKey="id"
            emptyState={<p className="empty-state-text">No units awaiting tenant signature.</p>}
          />
        )}
      </Panel>
    </>
  );
}
