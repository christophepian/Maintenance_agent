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
import { useTranslation } from "next-i18next";
import ConfigurableTable from "./ConfigurableTable";
import { useLocalSort, clientSort } from "../lib/tableUtils";
import Badge from "./ui/Badge";
import { authHeaders, ownerAuthHeaders } from "../lib/api";
import { formatDate } from "../lib/format";
import { planVariant } from "../lib/statusVariants";
import { cn } from "../lib/utils";
import { isPlanStale } from "../lib/planStale";

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
  const { t } = useTranslation("manager");
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

  // Dialog a11y (CR-016): Escape closes the modal.
  useEffect(() => {
    const onKey = (e) => { if (e.key === "Escape") onClose(); };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [onClose]);

  async function handleSubmit(e) {
    e.preventDefault();
    if (!form.name.trim()) { setError(t("cashflowPlan.nameRequired")); return; }
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
    <div
      className="fixed inset-0 bg-black/40 z-50 flex items-start justify-center pt-20 px-4"
      onClick={onClose}
    >
      <div
        className="bg-surface rounded-xl shadow-xl p-6 w-full max-w-lg"
        role="dialog"
        aria-modal="true"
        aria-label={t("cashflowPlan.newPlan", { defaultValue: "New cashflow plan" })}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-base font-semibold text-foreground">New cashflow plan</h2>
          <button onClick={onClose} className="text-foreground-dim hover:text-muted-text text-lg leading-none" aria-label="Close">×</button>
        </div>

        {error && <div className="error-banner mb-3" role="alert">{error}</div>}

        <form onSubmit={handleSubmit} className="flex flex-col gap-3">
          <div className="flex flex-col gap-1">
            <label className="text-xs font-medium text-muted-text">{t("label.name", { ns: "common" })} *</label>
            <input
              className="edit-input"
              placeholder={t("cashflowPlan.namePlaceholder")}
              value={form.name}
              onChange={(e) => set("name", e.target.value)}
            />
          </div>

          <div className="flex flex-col gap-1">
            <label className="text-xs font-medium text-muted-text">Building (leave empty for portfolio)</label>
            <select
              className="edit-input"
              value={form.buildingId}
              onChange={(e) => set("buildingId", e.target.value)}
            >
              <option value="">— {t("cashflowPlan.portfolio")} —</option>
              {buildings.map((b) => (
                <option key={b.id} value={b.id}>{b.name}</option>
              ))}
            </select>
          </div>

          <div className="flex gap-3">
            <div className="flex flex-col gap-1 flex-1">
              <label className="text-xs font-medium text-muted-text">Income growth rate (% / year)</label>
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
              <label className="text-xs font-medium text-muted-text">Horizon (months)</label>
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
            <label className="text-xs font-medium text-muted-text">Opening balance (CHF, optional)</label>
            <input
              type="number"
              min="0"
              step="100"
              className="edit-input"
              placeholder="e.g. 50000"
              value={form.openingBalanceChf}
              onChange={(e) => set("openingBalanceChf", e.target.value)}
            />
            <span className="text-xs text-foreground-dim">Leave empty to show net flows only. Can be added later.</span>
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
              {submitting ? t("cashflowPlan.creating") : t("cashflowPlan.create")}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

// ─── Main Component ───────────────────────────────────────────────────────────

const CashflowPlansList = forwardRef(function CashflowPlansList({ ownerMode = false }, ref) {
  const { t } = useTranslation("manager");
  const router = useRouter();
  const hdrs = ownerMode ? ownerAuthHeaders : authHeaders;
  const [plans, setPlans] = useState([]);
  const [buildings, setBuildings] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [showModal, setShowModal] = useState(false);
  const [approving, setApproving] = useState(null); // planId being approved
  const [search, setSearch] = useState("");

  // Expose openModal() to parent (e.g. Finance PageHeader CTA)
  useImperativeHandle(ref, () => ({
    openModal: () => setShowModal(true),
  }));

  const loadPlans = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const res = await fetch("/api/cashflow-plans", { headers: hdrs() });
      const json = await res.json();
      if (!res.ok) throw new Error(json?.error?.message || "Failed to load plans");
      setPlans(json.data || []);
    } catch (e) {
      setError(String(e?.message || e));
    } finally {
      setLoading(false);
    }
  }, [hdrs]);

  useEffect(() => { loadPlans(); }, [loadPlans]);

  useEffect(() => {
    fetch("/api/buildings", { headers: hdrs() })
      .then((r) => r.json())
      .then((d) => setBuildings(d?.data || []))
      .catch(() => {});
  }, [hdrs]);

  async function handleApprove(planId) {
    setApproving(planId);
    setError("");
    try {
      const res = await fetch(`/api/cashflow-plans/${planId}/approve`, {
        method: "POST",
        headers: { "Content-Type": "application/json", ...hdrs() },
        body: JSON.stringify({}),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json?.error?.message || "Failed to approve plan");
      await loadPlans();
    } catch (e) {
      setError(String(e?.message || e));
    } finally {
      setApproving(null);
    }
  }

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

  const q = search.trim().toLowerCase();
  const filtered = q
    ? sorted.filter((p) =>
        (p.name || "").toLowerCase().includes(q) ||
        (p.buildingId ? (buildingMap[p.buildingId] || "").toLowerCase().includes(q) : "portfolio".includes(q)) ||
        (p.status || "").toLowerCase().includes(q)
      )
    : sorted;

  const planColumns = useMemo(() => [
    {
      id: "name",
      label: "Name",
      sortable: true,
      alwaysVisible: true,
      render: (p) => <span className="font-medium text-foreground">{p.name}</span>,
    },
    {
      id: "status",
      label: "Status",
      sortable: true,
      defaultVisible: true,
      render: (p) => (
        <div className="flex items-center gap-1.5">
          <Badge variant={planVariant(p.status)}>{p.status}</Badge>
          {p.lastVerdictScenario && (
            <span className={cn(
              "rounded-full px-2 py-0.5 text-xs font-semibold",
              p.lastVerdictScenario === "invest"  && "bg-green-100 text-green-700",
              p.lastVerdictScenario === "defer"   && "bg-amber-100 text-amber-700",
              p.lastVerdictScenario === "neglect" && "bg-slate-100 text-slate-600",
            )}>
              {p.lastVerdictScenario.charAt(0).toUpperCase() + p.lastVerdictScenario.slice(1)}
            </span>
          )}
        </div>
      ),
    },
    {
      id: "scope",
      label: "Scope",
      sortable: true,
      defaultVisible: true,
      render: (p) => (
        <span className="text-muted-text">
          {p.buildingId ? (buildingMap[p.buildingId] || t("cashflowPlan.building")) : t("cashflowPlan.portfolio")}
        </span>
      ),
    },
    {
      id: "horizon",
      label: "Horizon",
      sortable: true,
      defaultVisible: true,
      render: (p) => <span className="text-muted-text">{p.horizonMonths} mo</span>,
    },
    {
      id: "growth",
      label: "Growth",
      sortable: true,
      defaultVisible: true,
      render: (p) => <span className="text-muted-text">{p.incomeGrowthRatePct ?? 0}%</span>,
    },
    {
      id: "computed",
      label: "Last computed",
      sortable: true,
      defaultVisible: true,
      render: (p) => {
        const stale = isPlanStale(p);
        return p.lastComputedAt ? (
          <span className={stale ? "text-amber-600 font-medium" : "text-muted-text"}>
            {formatDate(p.lastComputedAt)}
            {stale && " (stale)"}
          </span>
        ) : (
          <span className="text-foreground-dim">—</span>
        );
      },
    },
    {
      id: "created",
      label: "Created",
      sortable: true,
      defaultVisible: true,
      render: (p) => <span className="text-muted text-xs">{formatDate(p.createdAt)}</span>,
    },
    {
      id: "openingBalance",
      label: "Opening Balance",
      sortable: false,
      defaultVisible: false,
      render: (p) => (
        <span className="text-muted-text">
          {typeof p.openingBalanceChf === "number"
            ? `CHF ${p.openingBalanceChf.toLocaleString()}`
            : "—"}
        </span>
      ),
    },
    ...(ownerMode ? [{
      id: "approve",
      label: "",
      sortable: false,
      alwaysVisible: true,
      className: "text-right",
      headerClassName: "text-right",
      render: (p) => p.status === "SUBMITTED" ? (
        <button
          type="button"
          disabled={approving === p.id}
          onClick={(e) => { e.stopPropagation(); handleApprove(p.id); }}
          className="rounded-lg bg-green-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-green-700 disabled:opacity-50 transition"
        >
          {approving === p.id ? "Approving…" : "Approve"}
        </button>
      ) : null,
    }] : []),
  ], [buildingMap, ownerMode, approving]);

  if (loading) return <p className="loading-text">Loading plans…</p>;

  return (
    <>
      {error && <div className="error-banner mb-4" role="alert">{error}</div>}

      {/* Pending approval banner — owner mode only */}
      {ownerMode && submittedPlans.length > 0 && (
        <div className="mb-4 flex items-center gap-3 rounded-lg border border-amber-200 bg-amber-50 px-4 py-3">
          <span className="text-lg">📋</span>
          <div className="flex-1">
            <p className="text-sm font-semibold text-amber-700">
              {submittedPlans.length} plan{submittedPlans.length !== 1 ? "s" : ""} awaiting your approval
            </p>
            <p className="text-xs text-amber-600">Review and approve submitted cashflow plans</p>
          </div>
        </div>
      )}

      {/* Toolbar: search + New Plan */}
      <div className="flex items-center gap-2 mb-3">
        <input
          type="search"
          placeholder="Search plans…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="filter-input flex-1 min-w-0 mb-0"
          aria-label="Search cashflow plans"
        />
        {!ownerMode && (
          <button
            type="button"
            onClick={() => setShowModal(true)}
            className="flex shrink-0 items-center gap-1.5 rounded-lg border border-brand bg-brand px-3 py-2 text-sm font-medium text-white hover:bg-brand-dark transition-colors"
          >
            ＋ New Plan
          </button>
        )}
      </div>

      {plans.length === 0 ? (
        <div className="empty-state">
          <p className="empty-state-text">No cashflow plans yet. Use "New plan" to get started.</p>
        </div>
      ) : (
        <>
          <ConfigurableTable
            tableId="cashflow-plans"
            columns={planColumns}
            data={filtered}
            rowKey="id"
            sortField={sortField}
            sortDir={sortDir}
            onSort={handleSort}
            onRowClick={(plan) => router.push(`/manager/cashflow/${plan.id}`)}
            emptyState="No plans match your criteria."
            mobileCard={(p) => {
              const stale = isPlanStale(p);
              return (
                <div className="table-card">
                  <div className="flex items-start justify-between gap-2">
                    <span className="font-medium text-foreground text-sm">{p.name}</span>
                    <div className="flex items-center gap-1.5 shrink-0">
                      {p.lastVerdictScenario && (
                        <span className={cn(
                          "rounded-full px-2 py-0.5 text-xs font-semibold",
                          p.lastVerdictScenario === "invest"  && "bg-green-100 text-green-700",
                          p.lastVerdictScenario === "defer"   && "bg-amber-100 text-amber-700",
                          p.lastVerdictScenario === "neglect" && "bg-slate-100 text-slate-600",
                        )}>
                          {p.lastVerdictScenario.charAt(0).toUpperCase() + p.lastVerdictScenario.slice(1)}
                        </span>
                      )}
                      <Badge variant={planVariant(p.status)}>{p.status}</Badge>
                    </div>
                  </div>
                  <p className="text-xs text-muted mt-1">
                    {p.buildingId ? (buildingMap[p.buildingId] || t("cashflowPlan.building")) : t("cashflowPlan.portfolio")}
                    {" · "}{p.horizonMonths} mo
                    {p.incomeGrowthRatePct != null && ` · ${p.incomeGrowthRatePct}% growth`}
                  </p>
                  {p.lastComputedAt && (
                    <p className={cn("text-xs mt-0.5", stale ? "text-amber-600 font-medium" : "text-foreground-dim")}>
                      Computed {formatDate(p.lastComputedAt)}{stale ? " (stale)" : ""}
                    </p>
                  )}
                </div>
              );
            }}
          />
          <div className="px-3 py-2 text-xs text-foreground-dim border-t border-surface-divider">
            {filtered.length !== plans.length
              ? `${filtered.length} of ${plans.length} plan${plans.length !== 1 ? "s" : ""}`
              : `${plans.length} plan${plans.length !== 1 ? "s" : ""}`}
            {submittedPlans.length > 0 && ` · ${submittedPlans.length} pending approval`}
            {approvedPlans.length > 0 && ` · ${approvedPlans.length} approved`}
          </div>
        </>
      )}

      {showModal && !ownerMode && (
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
