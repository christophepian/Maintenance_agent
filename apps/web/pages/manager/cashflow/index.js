import { useState, useEffect, useCallback, useMemo } from "react";
import { useRouter } from "next/router";
import Link from "next/link";
import AppShell from "../../../components/AppShell";
import PageShell from "../../../components/layout/PageShell";
import PageHeader from "../../../components/layout/PageHeader";
import PageContent from "../../../components/layout/PageContent";
import Panel from "../../../components/layout/Panel";
import ConfigurableTable from "../../../components/ConfigurableTable";
import { authHeaders, apiFetch } from "../../../lib/api";
import { formatDate } from "../../../lib/format";

import { cn } from "../../../lib/utils";
// ─── Constants ───────────────────────────────────────────────────────────────

const STATUS_BADGE = {
  DRAFT: "bg-slate-100 text-slate-600",
  SUBMITTED: "bg-blue-100 text-blue-700",
  APPROVED: "bg-green-100 text-green-700",
};

const STALE_THRESHOLD_MS = 7 * 24 * 60 * 60 * 1000;

// ─── Helpers ─────────────────────────────────────────────────────────────────

function isPlanStale(plan) {
  if (!plan.lastComputedAt) return false;
  return Date.now() - new Date(plan.lastComputedAt).getTime() > STALE_THRESHOLD_MS;
}

// ─── Sorting ─────────────────────────────────────────────────────────────────

const STATUS_ORDER = { SUBMITTED: 0, DRAFT: 1, APPROVED: 2 };

function usePlanSort(plans) {
  const [sortField, setSortField] = useState("status");
  const [sortDir, setSortDir] = useState("asc");

  function handleSort(field) {
    if (field === sortField) {
      setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    } else {
      setSortField(field);
      setSortDir("asc");
    }
  }

  const sorted = [...plans].sort((a, b) => {
    let cmp = 0;
    switch (sortField) {
      case "name":
        cmp = a.name.localeCompare(b.name);
        break;
      case "status":
        cmp = (STATUS_ORDER[a.status] ?? 9) - (STATUS_ORDER[b.status] ?? 9);
        break;
      case "scope":
        cmp = (a.buildingId ? 1 : 0) - (b.buildingId ? 1 : 0);
        break;
      case "horizon":
        cmp = a.horizonMonths - b.horizonMonths;
        break;
      case "growth":
        cmp = (a.incomeGrowthRatePct ?? 0) - (b.incomeGrowthRatePct ?? 0);
        break;
      case "computed":
        cmp = (a.lastComputedAt || "").localeCompare(b.lastComputedAt || "");
        break;
      case "created":
        cmp = a.createdAt.localeCompare(b.createdAt);
        break;
      default:
        break;
    }
    return sortDir === "asc" ? cmp : -cmp;
  });

  return { sorted, sortField, sortDir, handleSort };
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

        {error && <div className="notice notice-err mb-3">{error}</div>}

        <form onSubmit={handleSubmit} className="flex flex-col gap-3">
          <div className="flex flex-col gap-1">
            <label className="text-xs font-medium text-slate-600">Plan name *</label>
            <input
              className="border border-slate-300 rounded px-2.5 py-1.5 text-sm"
              placeholder="e.g. 2026–2030 CapEx plan"
              value={form.name}
              onChange={(e) => set("name", e.target.value)}
            />
          </div>

          <div className="flex flex-col gap-1">
            <label className="text-xs font-medium text-slate-600">Building (leave empty for portfolio)</label>
            <select
              className="border border-slate-300 rounded px-2.5 py-1.5 text-sm"
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
                className="border border-slate-300 rounded px-2.5 py-1.5 text-sm"
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
                className="border border-slate-300 rounded px-2.5 py-1.5 text-sm"
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
              className="border border-slate-300 rounded px-2.5 py-1.5 text-sm"
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
              className="bg-blue-600 text-white text-sm font-medium px-4 py-1.5 rounded hover:bg-blue-700 disabled:opacity-50"
            >
              {submitting ? "Creating…" : "Create plan"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function CashflowPlansPage() {
  const router = useRouter();
  const [plans, setPlans] = useState([]);
  const [buildings, setBuildings] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [showModal, setShowModal] = useState(false);

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

  const draftPlans = plans.filter((p) => p.status === "DRAFT");
  const submittedPlans = plans.filter((p) => p.status === "SUBMITTED");
  const approvedPlans = plans.filter((p) => p.status === "APPROVED");

  const { sorted, sortField, sortDir, handleSort } = usePlanSort(plans);

  // Build a lookup of building names for the scope column
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
        <span className={cn("status-pill", STATUS_BADGE[p.status] || "bg-slate-100 text-slate-600")}>
          {p.status}
        </span>
      ),
    },
    {
      id: "scope",
      label: "Scope",
      sortable: true,
      defaultVisible: true,
      render: (p) => <span className="text-slate-600">{p.buildingId ? (buildingMap[p.buildingId] || "Building") : "Portfolio"}</span>,
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
          <span className="text-slate-400">\u2014</span>
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
      render: (p) => <span className="text-slate-600">{typeof p.openingBalanceChf === "number" ? `CHF ${p.openingBalanceChf.toLocaleString()}` : "\u2014"}</span>,
    },
  ], [buildingMap]);

  return (
    <AppShell role="MANAGER">
      <PageShell>
        <PageHeader
          title="Cashflow Planning"
          subtitle="Named scenarios bridging financial actuals with forward-looking CapEx forecasts."
          actions={
            <button
              onClick={() => setShowModal(true)}
              className="bg-blue-600 text-white text-sm font-medium px-4 py-1.5 rounded hover:bg-blue-700"
            >
              New plan
            </button>
          }
        />
        <PageContent>
          {error && <div className="notice notice-err mb-4">{error}</div>}

          {loading ? (
            <p className="loading-text">Loading plans…</p>
          ) : plans.length === 0 ? (
            <Panel>
              <div className="empty-state">
                <p className="empty-state-text">No cashflow plans yet. Create one to get started.</p>
              </div>
            </Panel>
          ) : (
            <Panel>
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
            </Panel>
          )}
        </PageContent>
      </PageShell>

      {showModal && (
        <CreatePlanModal
          buildings={buildings}
          onClose={() => setShowModal(false)}
          onCreate={handleCreated}
        />
      )}
    </AppShell>
  );
}
