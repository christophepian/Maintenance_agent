import { useEffect, useMemo, useState, useRef } from "react";
import Link from "next/link";
import { useRouter } from "next/router";
import AppShell from "../../../components/AppShell";
import PageShell from "../../../components/layout/PageShell";
import PageHeader from "../../../components/layout/PageHeader";
import PageContent from "../../../components/layout/PageContent";
import Panel from "../../../components/layout/Panel";
import { formatDate } from "../../../lib/format";
import ErrorBanner from "../../../components/ui/ErrorBanner";
import { authHeaders } from "../../../lib/api";
import Badge from "../../../components/ui/Badge";
import { selectionVariant, leaseVariant } from "../../../lib/statusVariants";
/**
 * Reusable action dropdown button — renders a "⋯" pill that opens
 * a positioned dropdown with a list of actions.
 */
function ActionDropdown({ actions }) {
  const [open, setOpen] = useState(false);
  const ref = useRef(null);

  // Close on outside click
  useEffect(() => {
    if (!open) return;
    function handleClick(e) {
      if (ref.current && !ref.current.contains(e.target)) setOpen(false);
    }
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, [open]);

  return (
    <div ref={ref} className="relative inline-block text-left">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-50 transition"
      >
        Actions ▾
      </button>
      {open && (
        <div className="absolute right-0 z-20 mt-1 w-48 origin-top-right rounded-lg border border-slate-200 bg-white shadow-lg ring-1 ring-black/5">
          <div className="py-1">
            {actions.map((a, i) => (
              <button
                key={i}
                type="button"
                onClick={() => { if (!a.onClick) return; setOpen(false); a.onClick(); }}
                title={a.title}
                className={"w-full text-left px-4 py-2 text-sm hover:bg-slate-50 transition " + (a.className || "text-slate-700")}
              >
                {a.label}
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
const SELECTION_LABELS = {
  AWAITING_SIGNATURE: "Awaiting Signature",
  FALLBACK_1: "Fallback 1 Active",
  FALLBACK_2: "Fallback 2 Active",
  EXHAUSTED: "No Remaining Candidates",
};
function selectionStatusBadge(status) {
  return (
    <Badge variant={selectionVariant(status)} size="sm">
      {SELECTION_LABELS[status] || status}
    </Badge>
  );
}

function leaseBadge(lease, hasLeaseTemplate) {
  if (!lease && hasLeaseTemplate) return <span className="text-xs text-amber-600 font-medium">No lease — template ready</span>;
  if (!lease) return <span className="text-xs text-red-500 font-medium">No lease template — create one first</span>;
  const LEASE_LABELS = { DRAFT: "Draft", READY_TO_SIGN: "Ready to Sign", SIGNED: "Signed" };
  return (
    <Badge variant={leaseVariant(lease.status)} size="sm">
      {LEASE_LABELS[lease.status] || lease.status}
    </Badge>
  );
}

export default function ManagerVacanciesPage() {
  const router = useRouter();
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

  async function generateLeaseFromTemplate(sel) {
    setError("");
    try {
      // 1. Fetch templates for this building
      const tplRes = await fetch("/api/lease-templates?buildingId=" + sel.buildingId, { headers: authHeaders() });
      const tplJson = await tplRes.json().catch(() => ({}));
      const templates = tplJson.data || [];
      if (templates.length === 0) {
        setError("No lease template found for this building. Please create one first.");
        return;
      }
      const templateId = templates[0].id;

      // 2. Create lease from template
      const candidate = sel.primaryCandidate || {};
      const body = {
        unitId: sel.unitId,
        tenantName: candidate.name || "Unknown",
        tenantEmail: candidate.email || undefined,
        tenantPhone: candidate.phone || undefined,
        applicationId: candidate.applicationId || undefined,
      };
      const createRes = await fetch(`/api/lease-templates/${templateId}/create-lease`, {
        method: "POST",
        headers: { "Content-Type": "application/json", ...authHeaders() },
        body: JSON.stringify(body),
      });
      const createJson = await createRes.json().catch(() => ({}));
      if (!createRes.ok) throw new Error(createJson?.error?.message || "Failed to create lease");

      const newLeaseId = createJson.data?.id;
      if (!newLeaseId) throw new Error("No lease ID returned");

      // 3. Navigate to the new lease editor
      router.push("/manager/leases/" + newLeaseId);
    } catch (e) {
      setError(e.message);
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
          title="Inventory"
          subtitle="Buildings, units, assets and depreciation schedules."
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
          <ErrorBanner error={error} className="text-sm" />

          {/* Inventory tab strip — mirrors /manager/inventory */}
          <div className="tab-strip">
            <Link href="/manager/inventory?tab=buildings" className="tab-btn">Buildings</Link>
            <button className="tab-btn-active">Vacancies</button>
            <Link href="/manager/inventory?tab=assets" className="tab-btn">Assets</Link>
            <Link href="/manager/inventory?tab=decisions" className="tab-btn">Maintenance Decisions</Link>
            <Link href="/manager/inventory?tab=depreciation" className="tab-btn">Depreciation</Link>
          </div>

          {/* ── Tenant Selections Pipeline ─────────────────── */}
          <Panel title={"Tenant Selections" + (selections.length > 0 ? ` (${selections.length})` : "")}>
            {selectionsLoading && <p className="text-sm text-slate-500">Loading selections…</p>}

            {!selectionsLoading && selections.length === 0 && (
              <div className="empty-state"><p className="empty-state-text">No active tenant selections.</p></div>
            )}

            {!selectionsLoading && selections.length > 0 && (
                <table className="inline-table">
                  <thead>
                    <tr>
                      <th>Building</th>
                      <th>Unit</th>
                      <th>Selected Tenant</th>
                      <th>Status</th>
                      <th>Lease</th>
                      <th>Deadline</th>
                      <th className="text-right">Action</th>
                    </tr>
                  </thead>
                  <tbody>
                    {selections.map((sel) => (
                      <tr key={sel.id} className={!sel.lease ? "bg-amber-50/50" : ""}>
                        <td>{sel.buildingName || "—"}</td>
                        <td>{sel.unitNumber || "—"}</td>
                        <td>
                          {sel.primaryCandidate ? (
                            <div>
                              <span className="cell-bold">{sel.primaryCandidate.name}</span>
                              <span className="ml-2 text-xs text-slate-400">{sel.primaryCandidate.email}</span>
                            </div>
                          ) : (
                            <span className="text-slate-400">—</span>
                          )}
                        </td>
                        <td>{selectionStatusBadge(sel.status)}</td>
                        <td>
                          {sel.lease ? (
                            <Link
                              href={"/manager/leases/" + sel.lease.id}
                              className="cell-link inline-flex items-center gap-1.5"
                            >
                              {leaseBadge(sel.lease)}
                            </Link>
                          ) : (
                            leaseBadge(null, sel.hasLeaseTemplate)
                          )}
                        </td>
                        <td>
                          {formatDate(sel.deadlineAt)}
                        </td>
                        <td className="text-right">
                          <ActionDropdown actions={[
                            ...(sel.lease ? [
                              { label: "📄 View Lease Project", onClick: () => router.push("/manager/leases/" + sel.lease.id) },
                            ] : sel.hasLeaseTemplate ? [
                              { label: "📝 Generate Lease from Template", onClick: () => generateLeaseFromTemplate(sel) },
                            ] : [
                              { label: "📐 Create Lease Template", onClick: () => router.push("/manager/leases/templates?buildingId=" + (sel.buildingId || "") + "&autoCreate=true") },
                            ]),
                            { label: "👤 View Candidate", onClick: () => router.push("/manager/vacancies/" + sel.unitId + "/applications") },
                            ...(sel.buildingId ? [
                              { label: "🏢 View Building", onClick: () => router.push("/admin-inventory/buildings/" + sel.buildingId) },
                            ] : []),
                          ]} />
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
            )}
          </Panel>

          {/* ── Vacant Units ─────────────────────────────────── */}
          <Panel title="Vacant Units — Open for Applications">
            {loading && <p className="text-sm text-slate-500">Loading…</p>}

            {!loading && units.length === 0 && (
              <div className="empty-state"><p className="empty-state-text">No vacant units at this time.</p></div>
            )}

            {unitsByBuilding.map((group) => (
              <div key={group.building?.id || "unknown"} className="mb-6 last:mb-0">
                <h3 className="text-sm font-semibold text-slate-700 mb-2">
                  {group.building?.name || "Unknown"} — {group.building?.address || ""}
                </h3>
                <table className="inline-table">
                    <thead>
                      <tr>
                        <th>Unit</th>
                        <th>Floor</th>
                        <th>Rent (CHF)</th>
                        <th>Charges (CHF)</th>
                        <th className="text-right">Applications</th>
                      </tr>
                    </thead>
                    <tbody>
                      {group.units.map((u) => (
                        <tr key={u.id}>
                          <td className="cell-bold">
                            {u.unitNumber || "—"}
                            <div className="text-xs text-slate-400 font-normal mt-0.5">
                              Empty since: {u.vacantSince
                                ? formatDate(u.vacantSince)
                                : "unknown"}
                            </div>
                          </td>
                          <td>{u.floor || "—"}</td>
                          <td>{u.monthlyRentChf ?? "—"}</td>
                          <td>{u.monthlyChargesChf ?? "—"}</td>
                          <td className="text-right">
                            <ActionDropdown actions={[
                              {
                                label: u.applicationCount > 0 ? "📋 View Applications" : "📋 View Applications (none yet)",
                                onClick: u.applicationCount > 0 ? () => router.push("/manager/vacancies/" + u.id + "/applications") : undefined,
                                className: u.applicationCount === 0 ? "opacity-50 cursor-not-allowed text-slate-400" : "text-slate-700",
                                title: u.applicationCount === 0 ? "No applications yet" : undefined,
                              },
                              ...(u.building?.id ? [
                                { label: "🏢 View Building", onClick: () => router.push("/admin-inventory/buildings/" + u.building.id) },
                              ] : []),
                              ...(u.id ? [
                                { label: "🔧 View Unit", onClick: () => router.push("/admin-inventory/units/" + u.id) },
                              ] : []),
                            ]} />
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
              </div>
            ))}
          </Panel>
        </PageContent>
      </PageShell>
    </AppShell>
  );
}
