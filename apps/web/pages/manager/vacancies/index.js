import { useEffect, useMemo, useState, useRef } from "react";
import Link from "next/link";
import { useRouter } from "next/router";
import AppShell from "../../../components/AppShell";
import PageShell from "../../../components/layout/PageShell";
import PageHeader from "../../../components/layout/PageHeader";
import PageContent from "../../../components/layout/PageContent";
import Panel from "../../../components/layout/Panel";
import { formatDate } from "../../../lib/format";
import { authHeaders } from "../../../lib/api";

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
                onClick={() => { setOpen(false); a.onClick(); }}
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

function leaseBadge(lease, hasLeaseTemplate) {
  if (!lease && hasLeaseTemplate) return <span className="text-xs text-amber-600 font-medium">No lease — template ready</span>;
  if (!lease) return <span className="text-xs text-red-500 font-medium">No lease template — create one first</span>;
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
                            leaseBadge(null, sel.hasLeaseTemplate)
                          )}
                        </td>
                        <td className="px-4 py-3 text-xs text-slate-500">
                          {formatDate(sel.deadlineAt)}
                        </td>
                        <td className="px-4 py-3 text-right">
                          <ActionDropdown actions={[
                            ...(sel.lease ? [
                              { label: "📄 View Lease Project", onClick: () => router.push("/manager/leases/" + sel.lease.id) },
                            ] : sel.hasLeaseTemplate ? [
                              { label: "📝 Generate Lease from Template", onClick: () => generateLeaseFromTemplate(sel) },
                            ] : [
                              { label: "📐 Create Lease Template", onClick: () => router.push("/manager/leases/templates?buildingId=" + (sel.buildingId || "")) },
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
                            <ActionDropdown actions={[
                              { label: "📋 View Applications", onClick: () => router.push("/manager/vacancies/" + u.id + "/applications") },
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
              </div>
            ))}
          </Panel>
        </PageContent>
      </PageShell>
    </AppShell>
  );
}
