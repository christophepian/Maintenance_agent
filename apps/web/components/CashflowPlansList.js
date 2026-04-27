/**
 * CashflowPlansList — self-fetching cashflow plan list + create modal.
 *
 * Extracted from /manager/cashflow/index.js so the same UI can be
 * embedded as a tab panel in /manager/finance (Planning tab).
 *
 * Exposes openModal() via forwardRef so the parent PageHeader CTA
 * can trigger the create modal without lifting state.
 */
import { useState, useEffect, useCallback, useMemo, forwardRef, useImperativeHandle } from "react";
import { useRouter } from "next/router";
import ConfigurableTable from "./ConfigurableTable";
import { useLocalSort, clientSort } from "../lib/tableUtils";
import Badge from "./ui/Badge";
import { authHeaders } from "../lib/api";
import { formatDate } from "../lib/format";
import { planVariant } from "../lib/statusVariants";
import { cn } from "../lib/utils";

// ─── Constants ────────────────────────────────────────────────────────────────

const STALE_THRESHOLD_MS = 7 * 24 * 60 * 60 * 1000;

// ─── Helpers ──────────────────────────────────────────────────────────────────

function isPlanStale(plan) {
  if (!plan.lastComputedAt) return false;
  return Date.now() - new Date(plan.lastComputedAt).getTime() > STALE_THRESHOLD_MS;
}

// ─── Sorting ──────────────────────────────────────────────────────────────────

const STATUS_ORDER = { SUBMITTED: 0, DRAFT: 1, APPROVED: 2 };

function planFieldExtractor(plan, field) {
  switch (field) {
    case "name":     return (plan.name || "").toLowerCase();
    case "status":   return STATUS_ORDER[plan.status] ?? 9;
    case "scope":    return plan.buildingId ? 1 : 0;
    case "horizon":  return plan.horizonMonths ?? 0;
    case "growth":   return plan.incomeGrowthRatePct ?? 0;
    case "computed": return plan.lastComputedAt || "";
    case "created":  return plan.createdAt || "";
    default:         return "";
  }
}

// ─── Create Plan Modal ────────────────────────────────────────────────────────

function CreatePlanModal({ buildings, onClose, onCreate }) {
  const [form, setForm] = useState({
    name: "",
    buildingId: "",
    incomeGrowthRatePct: 0,
    openingBalanceChf: "",
    horizonMonths: 60,
  });
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");

  function set(key, val) {
    setForm((f) => ({ ...f, [key]: val }));
  }

  async function handleSubmit(e) {
    e.preventDefault();
    if (!form.name.trim()) { setError("Plan name is required."); return; }
    setSubmitting(true);
    setError("");
    try {
      const body = {
        name: form.name.trim(),
        incomeGrowthRatePct: Number(form.incomeGrowthRatePct) || 0,
        horizonMonths: Number(form.horizonMonths) || 60,
      };
      if (form.buildingId) body.buildingId = form.buildingId;
      if (form.openingBalanceChf !== "") {
        const chf = parseFloat(form.openingBalanceChf);
        if (!isNaN(chf)) body.openingBalanceCents = Math.round(chf * 100);
      }
      const res = await fetch("/api/cashflow-plans", {
        method: "POST",
        headers: { "Content-Type": "application/json", ...authHeaders() },
        body: JSON.stringify(body),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json?.error?.message || "Failed to create plan");
      onCreate(json.data);
    } catch (e) {
      setError(String(e?.message || e));
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="fixed inset-0 bg-black/40 z-50 flex items-start justify-center pt-20 px-4">
      <div className="bg-white rounded-xl shadow-xl p-6 w-full max-w-lg">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-base font-semibold text-slate-800">New cashflow plan</h2>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600 text-lg leading-none" aria-label="Close">×</button>
        </div>

        {error && <div className="error-banner mb-3" role="alert">{error}</div>}

        <form onSubmit={handleSubmit} className="flex flex-col gap-3">
          <div className="flex flex-col gap-1">
            <label className="text-xs font-medium text-slate-600">Plan name *</label>
            <input
              className="edit-input"
              placeholder="e.g. 2026–2030 CapEx plan"
              value={form.name}
              onChange={(e) => set("name", e.target.value)}
            />
          </div>

          <div className="flex flex-col gap-1">
            <label className="text-xs font-medium text-slate-600">Building (leave empty for portfolio)</label>
            <select
              className="edit-input"
              value={form.buildingId}
              onChange={(e) => set("buildingId", e.target.value)}
            >
              <option value="">— Portfolio level —</option>
              {buildings.map((b) => (
                <option key={b.id} value={b.id}>{b.name}</option>
              ))}
            </select>
          </div>

          <div className="flex gap-3">
            <div className="flex flex-col gap-1 flex-1">
              <label className="text-xs font-medium text-slate-600">Income growth rate (% / year)</label>
              <input
                type="number"
                step="0.1"
                min="0"
                max="20"
                className="edit-input"
                value={form.incomeGrowthRatePct}
                onChange={(e) => set("incomeGrowthRatePct", e.target.value)}
              />
            </div>
            <div className="flex flex-col gap-1 flex-1">
              <label className="text-xs font-medium text-slate-600">Horizon (months)</label>
              <input
                type="number"
                min="12"
                max="120"
                step="12"
                className="edit-input"
                value={form.horizonMonths}
                onChange={(e) => set("horizonMonths", e.target.value)}
              />
            </div>
          </div>

          <div className="flex flex-col gap-1">
            <label className="text-xs font-medium text-slate-600">Opening balance (CHF, optional)</label>
            <input
              type="number"
              min="0"
              step="100"
              className="edit-input"
              placeholder="e.g. 50000"
              value={form.openingBalanceChf}
              onChange={(e) => set("openingBalanceChf", e.target.value)}
            />
            <span className="text-xs text-slate-400">Leave empty to show net flows only. Can be added later.</span>
          </div>

          <div className="flex justify-end gap-2 pt-2">
            <button type="button" onClick={onClose} className="button-secondary text-sm">
              Cancel
            </button>
            <button
              type="submit"
              disabled={submitting}
              className="button-primary text-sm disabled:opacity-50"
            >
              {submitting ? "Creating…" : "Create plan"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

// ─── Main Component ───────────────────────────────────────────────────────────

const CashflowPlansList = forwardRef(function CashflowPlansList(_props, ref) {
  const router = useRouter();
  const [plans, setPlans] = useState([]);
  const [buildings, setBuildings] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [showModal, setShowModal] = useState(false);

  // Expose openModal() to parent (e.g. Finance PageHeader CTA)
  useImperativeHandle(ref, () => ({
    openModal: () => setShowModal(true),
  }));

  const loadPlans = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const res = await fetch("/api/cashflow-plans", { headers: authHeaders() });
      const json = await res.json();
      if (!res.ok) throw new Error(json?.error?.message || "Failed to load plans");
      setPlans(json.data || []);
    } catch (e) {
      setError(String(e?.message || e));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { loadPlans(); }, [loadPlans]);

  useEffect(() => {
    fetch("/api/buildings", { headers: authHeaders() })
      .then((r) => r.json())
      .then((d) => setBuildings(d?.data || []))
      .catch(() => {});
  }, []);

  function handleCreated(plan) {
    setShowModal(false);
    router.push(`/manager/cashflow/${plan.id}`);
  }

  const submittedPlans = plans.filter((p) => p.status === "SUBMITTED");
  const approvedPlans  = plans.filter((p) => p.status === "APPROVED");

  const { sortField, sortDir, handleSort } = useLocalSort("status", "asc");
  const sorted = useMemo(
    () => clientSort(plans, sortField, sortDir, planFieldExtractor),
    [plans, sortField, sortDir],
  );

  const buildingMap = {};
  buildings.forEach((b) => { buildingMap[b.id] = b.name; });

  const planColumns = useMemo(() => [
    {
      id: "name",
      label: "Name",
      sortable: true,
      alwaysVisible: true,
      render: (p) => <span className="font-medium text-slate-900">{p.name}</span>,
    },
    {
      id: "status",
      label: "Status",
      sortable: true,
      defaultVisible: true,
      render: (p) => (
        <Badge variant={planVariant(p.status)}>
          {p.status}
        </Badge>
      ),
    },
    {
      id: "scope",
      label: "Scope",
      sortable: true,
      defaultVisible: true,
      render: (p) => (
        <span className="text-slate-600">
          {p.buildingId ? (buildingMap[p.buildingId] || "Building") : "Portfolio"}
        </span>
      ),
    },
    {
      id: "horizon",
      label: "Horizon",
      sortable: true,
      defaultVisible: true,
      render: (p) => <span className="text-slate-600">{p.horizonMonths} mo</span>,
    },
    {
      id: "growth",
      label: "Growth",
      sortable: true,
      defaultVisible: true,
      render: (p) => <span className="text-slate-600">{p.incomeGrowthRatePct ?? 0}%</span>,
    },
    {
      id: "computed",
      label: "Last computed",
      sortable: true,
      defaultVisible: true,
      render: (p) => {
        const stale = isPlanStale(p);
        return p.lastComputedAt ? (
          <span className={stale ? "text-amber-600 font-medium" : "text-slate-600"}>
            {formatDate(p.lastComputedAt)}
            {stale && " (stale)"}
          </span>
        ) : (
          <span className="text-slate-400">—</span>
        );
      },
    },
    {
      id: "created",
      label: "Created",
      sortable: true,
      defaultVisible: true,
      render: (p) => <span className="text-slate-500 text-xs">{formatDate(p.createdAt)}</span>,
    },
    {
      id: "openingBalance",
      label: "Opening Balance",
      sortable: false,
      defaultVisible: false,
      render: (p) => (
        <span className="text-slate-600">
          {typeof p.openingBalanceChf === "number"
            ? `CHF ${p.openingBalanceChf.toLocaleString()}`
            : "—"}
        </span>
      ),
    },
  ], [buildingMap]);

  if (loading) return <p className="loading-text">Loading plans…</p>;

  return (
    <>
      {error && <div className="error-banner mb-4" role="alert">{error}</div>}

      {plans.length === 0 ? (
        <div className="empty-state">
          <p className="empty-state-text">No cashflow plans yet. Use "New plan" to get started.</p>
        </div>
      ) : (
        <>
          <ConfigurableTable
            tableId="cashflow-plans"
            columns={planColumns}
            data={sorted}
            rowKey="id"
            sortField={sortField}
            sortDir={sortDir}
            onSort={handleSort}
            onRowClick={(plan) => router.push(`/manager/cashflow/${plan.id}`)}
            emptyState="No plans match your criteria."
          />
          <div className="px-3 py-2 text-xs text-slate-400 border-t border-slate-100">
            {plans.length} plan{plans.length !== 1 ? "s" : ""}
            {submittedPlans.length > 0 && ` · ${submittedPlans.length} pending approval`}
            {approvedPlans.length > 0 && ` · ${approvedPlans.length} approved`}
          </div>
        </>
      )}

      {showModal && (
        <CreatePlanModal
          buildings={buildings}
          onClose={() => setShowModal(false)}
          onCreate={handleCreated}
        />
      )}
    </>
  );
});

export default CashflowPlansList;
