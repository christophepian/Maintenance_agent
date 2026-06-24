/**
 * PlanningWorkspace — single-screen renovation → cashflow-plan workspace.
 *
 *   Idle    — the Opportunities accordion takes the full width (readable).
 *   Active  — once you "Simulate", it splits: accordion (left) | simulator (right);
 *             the Decision panel (server NPV verdict) appears below once work is
 *             scheduled. No empty placeholder trays are ever shown.
 *
 * Phase 1 (per docs/PLANNING_WORKSPACE_BUNDLING.md): composition only — the data
 * flow is unchanged. Selecting assets simulates inline instead of opening the
 * full-screen drawer.
 */
import { useState, useCallback, useMemo } from "react";
import { cn } from "../lib/utils";
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

  const clear = useCallback(() => { setSimItems(null); setPlannedId(null); }, []);

  const simBuildingId = useMemo(() => {
    if (!simItems?.length) return null;
    const bId = simItems[0]?.buildingId;
    return buildings?.find((b) => b.id === bId)?.id ?? bId ?? buildings?.[0]?.id ?? null;
  }, [simItems, buildings]);

  const active = !!simItems;

  return (
    <div className={cn("grid gap-4 items-start", active ? "lg:grid-cols-12" : "grid-cols-1")}>
      {/* Opportunities — full width when idle, left column when simulating */}
      <div className={cn("min-w-0", active && "lg:col-span-4")}>
        <RenovationAccordion buildings={buildings} onSimulate={onSimulate} />
      </div>

      {/* Simulate & decide — only rendered once something is being simulated */}
      {active && (
        <div className="lg:col-span-8 min-w-0 space-y-4">
          <div className="rounded-2xl border border-surface-border bg-surface overflow-hidden">
            <RenovationSimulatorDrawer
              embedded
              items={simItems}
              buildingId={simBuildingId}
              onClose={clear}
              onPlanned={setPlannedId}
            />
          </div>
          {plannedId && <DecisionPanel planId={plannedId} />}
        </div>
      )}
    </div>
  );
}
