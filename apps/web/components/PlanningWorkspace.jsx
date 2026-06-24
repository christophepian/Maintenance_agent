/**
 * PlanningWorkspace — single-screen renovation → cashflow-plan workspace.
 *
 * Composes the three regions of the bundled flow on one screen:
 *   Left   — Opportunities (RenovationAccordion)
 *   Center — Simulate & schedule (RenovationSimulatorDrawer, embedded)
 *   Right  — Decide (DecisionPanel: server NPV verdict for the scheduled plan)
 *
 * Phase 1 (per docs/PLANNING_WORKSPACE_BUNDLING.md): composition only — the
 * data flow is unchanged. Selecting assets simulates inline instead of opening
 * the full-screen drawer; the verdict appears after "Plan this work".
 */
import { useState, useCallback, useMemo } from "react";
import RenovationAccordion from "./RenovationAccordion";
import RenovationSimulatorDrawer from "./RenovationSimulatorDrawer";
import DecisionPanel from "./DecisionPanel";

export default function PlanningWorkspace({ buildings }) {
  const [simItems, setSimItems]   = useState(null);
  const [plannedId, setPlannedId] = useState(null);

  // A new simulation clears any prior decision verdict.
  const onSimulate = useCallback((items) => {
    setSimItems(items && items.length ? items : null);
    setPlannedId(null);
  }, []);

  const simBuildingId = useMemo(() => {
    if (!simItems?.length) return null;
    const bId = simItems[0]?.buildingId;
    return buildings?.find((b) => b.id === bId)?.id ?? bId ?? buildings?.[0]?.id ?? null;
  }, [simItems, buildings]);

  return (
    <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 items-start">
      {/* Left — Opportunities */}
      <div className="lg:col-span-4 xl:col-span-3">
        <RenovationAccordion buildings={buildings} onSimulate={onSimulate} />
      </div>

      {/* Right — Simulate & decide */}
      <div className="lg:col-span-8 xl:col-span-9 space-y-4 min-w-0">
        {simItems ? (
          <div className="rounded-2xl border border-surface-border bg-surface overflow-hidden">
            <RenovationSimulatorDrawer
              embedded
              items={simItems}
              buildingId={simBuildingId}
              onPlanned={setPlannedId}
            />
          </div>
        ) : (
          <div className="rounded-2xl border border-dashed border-surface-border bg-surface p-8 text-center">
            <p className="text-sm font-medium text-foreground">Simulate a renovation</p>
            <p className="text-xs text-foreground-dim mt-1 max-w-md mx-auto">
              Select one or more assets on the left and choose “Simulate” to model the
              NPV here, then schedule the work into a cashflow plan.
            </p>
          </div>
        )}

        <DecisionPanel planId={plannedId} />
      </div>
    </div>
  );
}
