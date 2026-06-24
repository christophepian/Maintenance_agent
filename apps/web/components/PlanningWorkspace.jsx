/**
 * PlanningWorkspace — single-screen renovation → cashflow-plan workspace.
 *
 * Layout (vertical, full-width — no cramped columns):
 *   1. One bundled "Renovation Opportunities" section: heading + building filter
 *      chips in the header, the Building ▸ Unit ▸ Asset accordion below.
 *   2. On "Simulate", the simulation card slides in full-width beneath the table.
 *   3. Once work is scheduled, the Decision panel (server NPV verdict) appears below.
 *
 * NPV is single-building, so simulating a selection that spans buildings is blocked.
 *
 * Phase 1 (per docs/PLANNING_WORKSPACE_BUNDLING.md): composition only — data flow
 * unchanged.
 */
import { useState, useCallback, useMemo, useRef, useEffect } from "react";
import { cn } from "../lib/utils";
import RenovationAccordion from "./RenovationAccordion";
import RenovationSimulatorDrawer from "./RenovationSimulatorDrawer";
import DecisionPanel from "./DecisionPanel";

export default function PlanningWorkspace({ buildings: allBuildings = [] }) {
  // Building filter: default to all when there's a single building, else none (pick).
  const [selectedBuildingIds, setSelectedBuildingIds] = useState([]);
  const [simItems, setSimItems]   = useState(null);
  const [plannedId, setPlannedId] = useState(null);
  const [simError, setSimError]   = useState("");
  const simRef = useRef(null);

  // Auto-select the only building once loaded.
  useEffect(() => {
    if (allBuildings.length === 1) setSelectedBuildingIds([allBuildings[0].id]);
  }, [allBuildings]);

  const selectedBuildings = useMemo(
    () => allBuildings.filter((b) => selectedBuildingIds.includes(b.id)),
    [allBuildings, selectedBuildingIds],
  );

  const toggleBuilding = useCallback((id) => {
    setSelectedBuildingIds((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id],
    );
  }, []);

  const clear = useCallback(() => { setSimItems(null); setPlannedId(null); setSimError(""); }, []);

  // NPV is single-building → block a selection that spans buildings.
  const onSimulate = useCallback((items) => {
    const list = Array.isArray(items) ? items : [];
    const ids = [...new Set(list.map((i) => i.buildingId))];
    if (ids.length > 1) {
      setSimError("Select assets from a single building to simulate them together.");
      setSimItems(null);
      setPlannedId(null);
      return;
    }
    setSimError("");
    setSimItems(list.length ? list : null);
    setPlannedId(null);
  }, []);

  const simBuildingId = useMemo(() => {
    if (!simItems?.length) return null;
    const bId = simItems[0]?.buildingId;
    return allBuildings.find((b) => b.id === bId)?.id ?? bId ?? null;
  }, [simItems, allBuildings]);

  // Bring the simulation card into view when it opens.
  useEffect(() => {
    if (simItems && simRef.current) {
      simRef.current.scrollIntoView({ behavior: "smooth", block: "start" });
    }
  }, [simItems]);

  const allSelected = allBuildings.length > 0 && selectedBuildingIds.length === allBuildings.length;

  return (
    <div className="space-y-4">
      {/* Bundled header: title + description + building filter chips */}
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <h3 className="text-sm font-semibold text-foreground m-0">Renovation Opportunities</h3>
          <p className="text-xs text-foreground-dim mt-0.5 max-w-2xl">
            Assets at risk of end-of-life or flagged in condition reports, sorted by urgency.
            Select a bundle and simulate to compute NPV, then plan the work into a cashflow plan.
          </p>
        </div>
        {allBuildings.length > 0 && (
          <div className="flex flex-wrap items-center gap-1.5">
            {allBuildings.map((b) => {
              const on = selectedBuildingIds.includes(b.id);
              return (
                <button
                  key={b.id}
                  type="button"
                  onClick={() => toggleBuilding(b.id)}
                  className={cn(
                    "rounded-full px-3 py-1 text-xs font-medium border transition-colors",
                    on ? "bg-brand text-white border-brand"
                       : "border-surface-border text-foreground-dim hover:bg-surface-subtle",
                  )}
                >
                  {b.name}
                </button>
              );
            })}
            {allBuildings.length > 1 && (
              <button
                type="button"
                onClick={() => setSelectedBuildingIds(allSelected ? [] : allBuildings.map((b) => b.id))}
                className="text-xs text-brand hover:underline ml-1"
              >
                {allSelected ? "Clear" : "Select all"}
              </button>
            )}
          </div>
        )}
      </div>

      {/* Opportunities accordion (full width) */}
      <RenovationAccordion buildings={selectedBuildings} onSimulate={onSimulate} />

      {simError && (
        <p className="text-xs text-destructive-text">{simError}</p>
      )}

      {/* Simulation card — full width, brought in beneath the table */}
      {simItems && (
        <div ref={simRef} className="rounded-2xl border border-surface-border bg-surface overflow-hidden scroll-mt-4">
          <RenovationSimulatorDrawer
            embedded
            items={simItems}
            buildingId={simBuildingId}
            onClose={clear}
            onPlanned={setPlannedId}
          />
        </div>
      )}

      {/* Decision verdict — only once work is scheduled */}
      {plannedId && <DecisionPanel planId={plannedId} />}
    </div>
  );
}
