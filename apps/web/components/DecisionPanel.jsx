/**
 * DecisionPanel — the "Decide" region of the planning workspace.
 *
 * Once a renovation is scheduled into a cashflow plan ("Plan this work"), this
 * shows the authoritative server-side NPV verdict (Invest / Defer / Neglect) plus
 * the plan's financing and lifecycle — Submit → Approve — so the whole decision
 * loop happens on one screen. RFP generation (post-approval) stays on the full
 * plan page, reachable via the link.
 */
import { useState, useEffect, useCallback } from "react";
import { ArrowRight } from "lucide-react";
import { cn } from "../lib/utils";
import { authHeaders } from "../lib/api";
import NPVScenariosPanel from "./NPVScenariosPanel";
import FinancingPanel from "./FinancingPanel";

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

  const loadPlan = useCallback(async () => {
    if (!planId) return;
    try {
      const res = await fetch(`/api/cashflow-plans/${planId}`, { headers: authHeaders() });
      const json = await res.json();
      if (res.ok) setPlan(json.data);
    } catch { /* non-critical */ }
  }, [planId]);

  useEffect(() => { loadPlan(); }, [loadPlan]);

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

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between gap-2 flex-wrap">
        <div className="flex items-center gap-2 min-w-0">
          <h3 className="text-sm font-semibold text-foreground m-0">Decision — NPV verdict</h3>
          {status && (
            <span className={cn("status-pill", STATUS_BADGE[status] || "bg-surface-hover text-muted-text")}>
              {status}
            </span>
          )}
        </div>
        <a
          href={`/manager/cashflow/${planId}`}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-1 text-xs font-semibold text-brand hover:underline"
        >
          Open full plan <ArrowRight className="h-3 w-3" />
        </a>
      </div>

      {/* Financing (mortgage + market value) drives the levered metrics */}
      {plan?.buildingId && (
        <FinancingPanel buildingId={plan.buildingId} onChanged={() => setNpvRefreshKey((k) => k + 1)} />
      )}

      <NPVScenariosPanel
        key={npvRefreshKey}
        mode="plan"
        fetchUrl={`/api/cashflow-plans/${planId}/npv-scenarios`}
      />

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
              {isDraft ? "Submit this plan for owner / manager approval." : "Approve to enable RFP generation."}
            </p>
          </div>
        </div>
      )}

      {isApproved && (
        <div className="rounded-xl border border-success-ring bg-success-light p-3">
          <p className="text-xs text-success-text">
            Plan approved.{" "}
            <a
              href={`/manager/cashflow/${planId}`}
              target="_blank"
              rel="noopener noreferrer"
              className="font-semibold underline underline-offset-2"
            >
              Open the plan
            </a>{" "}
            to generate RFPs from the scheduled work.
          </p>
        </div>
      )}
    </div>
  );
}
