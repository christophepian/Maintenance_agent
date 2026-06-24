/**
 * DecisionPanel — the "Decide" region of the planning workspace.
 *
 * Phase 1: once a renovation is scheduled into a cashflow plan ("Plan this work"),
 * show the authoritative server-side NPV verdict (Invest / Defer / Neglect) for that
 * plan, plus a link to the full plan page for deep editing / approval / RFP.
 *
 * Later phases move the lifecycle (Submit / Approve / RFP) inline here.
 */
import NPVScenariosPanel from "./NPVScenariosPanel";
import { ArrowRight } from "lucide-react";

export default function DecisionPanel({ planId }) {
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

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between gap-2">
        <h3 className="text-sm font-semibold text-foreground m-0">Decision — NPV verdict</h3>
        <a
          href={`/manager/cashflow/${planId}`}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-1 text-xs font-semibold text-brand hover:underline"
        >
          Open full plan <ArrowRight className="h-3 w-3" />
        </a>
      </div>
      <NPVScenariosPanel mode="plan" fetchUrl={`/api/cashflow-plans/${planId}/npv-scenarios`} />
    </div>
  );
}
