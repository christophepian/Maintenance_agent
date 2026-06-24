/**
 * DecisionPanel — the "Decide" region of the planning workspace.
 *
 * Once a renovation is scheduled into a cashflow plan ("Plan this work"), this
 * hosts the whole decide-and-govern surface inline (no leaving the page):
 *   status · financing · NPV assumptions · NPV verdict · Submit → Approve · RFP.
 * The full plan page reuses the same shared components.
 */
import { useState, useEffect, useCallback } from "react";
import { ChevronDown, ChevronUp } from "lucide-react";
import { cn } from "../lib/utils";
import { authHeaders } from "../lib/api";
import NPVScenariosPanel from "./NPVScenariosPanel";
import FinancingPanel from "./FinancingPanel";
import AssumptionsPanel from "./cashflow/AssumptionsPanel";
import RfpCandidatesPanel from "./cashflow/RfpCandidatesPanel";
import CapexEventTable from "./cashflow/CapexEventTable";

const STATUS_BADGE = {
  DRAFT:     "bg-warning-light text-warning-text",
  SUBMITTED: "bg-info-light text-info-text",
  APPROVED:  "bg-success-light text-success-text",
};

export default function DecisionPanel({ planId }) {
  const [plan, setPlan] = useState(null);
  const [actionLoading, setActionLoading] = useState(false);
  const [actionError, setActionError] = useState("");
  const [npvRefreshKey, setNpvRefreshKey] = useState(0);
  const [showDetails, setShowDetails] = useState(false);

  const loadPlan = useCallback(async () => {
    if (!planId) return;
    try {
      const res = await fetch(`/api/cashflow-plans/${planId}`, { headers: authHeaders() });
      const json = await res.json();
      if (res.ok) setPlan(json.data);
    } catch { /* non-critical */ }
  }, [planId]);

  useEffect(() => { loadPlan(); }, [loadPlan]);

  // Assumptions/financing edits → reload the plan and recompute the verdict.
  const refreshAfterEdit = useCallback(() => {
    loadPlan();
    setNpvRefreshKey((k) => k + 1);
  }, [loadPlan]);

  const handleAction = useCallback(async (endpoint) => {
    setActionLoading(true);
    setActionError("");
    try {
      const res = await fetch(`/api/cashflow-plans/${planId}/${endpoint}`, {
        method: "POST",
        headers: { "Content-Type": "application/json", ...authHeaders() },
        body: "{}",
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json?.error?.message || "Action failed");
      await loadPlan();
    } catch (e) {
      setActionError(String(e?.message || e));
    } finally {
      setActionLoading(false);
    }
  }, [planId, loadPlan]);

  if (!planId) {
    return (
      <div className="rounded-2xl border border-dashed border-surface-border bg-surface p-6 text-center">
        <p className="text-sm font-medium text-foreground">Decision</p>
        <p className="text-xs text-foreground-dim mt-1 max-w-md mx-auto">
          Schedule a renovation with “Plan this work” to see its NPV verdict —
          Invest / Defer / Neglect — computed from the cashflow plan.
        </p>
      </div>
    );
  }

  const status = plan?.status;
  const isDraft = status === "DRAFT";
  const isSubmitted = status === "SUBMITTED";
  const isApproved = status === "APPROVED";

  const buckets = plan?.cashflow?.buckets || [];
  const timingRecs = plan?.cashflow?.timingRecommendations || [];
  const alignmentMap = plan?.strategyOverlay?.items?.reduce((m, it) => { m[it.assetId] = it; return m; }, {}) || {};

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2 min-w-0">
        <h3 className="text-sm font-semibold text-foreground m-0">Decision — NPV verdict</h3>
        {status && (
          <span className={cn("status-pill", STATUS_BADGE[status] || "bg-surface-hover text-muted-text")}>
            {status}
          </span>
        )}
      </div>

      {/* Financing (mortgage + market value) drives the levered metrics */}
      {plan?.buildingId && (
        <FinancingPanel buildingId={plan.buildingId} onChanged={refreshAfterEdit} />
      )}

      {/* NPV assumptions — editable while DRAFT */}
      {plan && <AssumptionsPanel plan={plan} isDraft={isDraft} onUpdated={refreshAfterEdit} />}

      <NPVScenariosPanel
        key={npvRefreshKey}
        mode="plan"
        fetchUrl={`/api/cashflow-plans/${planId}/npv-scenarios`}
      />

      {/* Plan details — the capex schedule (override-timing editor), collapsed by default */}
      <div className="rounded-xl border border-surface-border bg-surface">
        <button
          type="button"
          onClick={() => setShowDetails((v) => !v)}
          className="flex w-full items-center justify-between gap-2 px-3 py-2 text-xs font-semibold text-foreground-dim hover:text-foreground transition-colors"
        >
          <span>Plan details — capex schedule</span>
          {showDetails ? <ChevronUp className="h-3.5 w-3.5" /> : <ChevronDown className="h-3.5 w-3.5" />}
        </button>
        {showDetails && (
          <div className="px-3 pb-3">
            <CapexEventTable
              buckets={buckets}
              overrides={plan?.overrides}
              timingRecommendations={timingRecs}
              planId={planId}
              isDraft={isDraft}
              onRefresh={refreshAfterEdit}
              alignmentMap={alignmentMap}
            />
          </div>
        )}
      </div>

      {/* Lifecycle: Submit → Approve */}
      {(isDraft || isSubmitted) && (
        <div className="rounded-xl border border-surface-border bg-surface p-3 space-y-2">
          {actionError && <p className="text-xs text-destructive-text">{actionError}</p>}
          <div className="flex flex-wrap items-center gap-3">
            {isDraft && (
              <button
                onClick={() => handleAction("submit")}
                disabled={actionLoading}
                className="rounded-lg bg-brand px-4 py-2 text-sm font-medium text-white hover:bg-brand-dark disabled:opacity-50 transition-colors"
              >
                {actionLoading ? "Submitting…" : "Submit for approval"}
              </button>
            )}
            {isSubmitted && (
              <button
                onClick={() => handleAction("approve")}
                disabled={actionLoading}
                className="rounded-lg bg-brand px-4 py-2 text-sm font-medium text-white hover:bg-brand-dark disabled:opacity-50 transition-colors"
              >
                {actionLoading ? "Approving…" : "Approve plan"}
              </button>
            )}
            <p className="text-xs text-foreground-dim">
              {isDraft ? "Submit this plan for owner / manager approval." : "Approve to generate RFPs from the scheduled work."}
            </p>
          </div>
        </div>
      )}

      {/* RFP generation — inline, once approved */}
      {isApproved && (
        <div className="space-y-2">
          <h4 className="text-xs font-semibold text-foreground uppercase tracking-wide m-0">RFP candidates</h4>
          <RfpCandidatesPanel planId={planId} />
        </div>
      )}
    </div>
  );
}
