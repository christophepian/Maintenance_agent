/**
 * PlanningWorkspace — STEP 1 of the two-step renovation flow: appraise.
 *
 *   1. One bundled "Renovation Opportunities" section: heading + building filter
 *      chips in the header, the Building ▸ Unit ▸ Asset accordion below.
 *   2. On "Simulate", the simulation card slides in full-width beneath the table,
 *      with Financing & Valuation alongside (all assumptions in one place).
 *   3. "Plan this work" creates the DRAFT plan and navigates to STEP 2 — the
 *      dedicated cashflow plan page (timeline + submit for approval).
 *
 * Simulation is single-building: each building section's "Simulate" only bundles
 * that building's assets, so a selection can't span buildings.
 *
 * See EPIC_HISTORY.md (two-step planning workspace).
 */
import { useState, useCallback, useMemo, useRef, useEffect } from "react";
import { useRouter } from "next/router";
import { useTranslation } from "next-i18next";
import { cn } from "../lib/utils";
import RenovationAccordion from "./RenovationAccordion";
import RenovationSimulatorDrawer from "./RenovationSimulatorDrawer";
import FinancingPanel from "./FinancingPanel";
import YieldGoalSeekPanel from "./YieldGoalSeekPanel";

export default function PlanningWorkspace({ buildings: allBuildings = [] }) {
  const router = useRouter();
  const { t } = useTranslation("manager");
  // Building filter: default to all when there's a single building, else none (pick).
  const [selectedBuildingIds, setSelectedBuildingIds] = useState([]);
  const [simItems, setSimItems]           = useState(null);
  const [simBuildingId, setSimBuildingId] = useState(null);
  // Accretive/dilutive annotations emitted by the goal-seek → badge the accordion rows.
  const [annotations, setAnnotations]     = useState(null);
  const simRef = useRef(null);

  // Auto-select: a ?buildingId deep-link (e.g. from the Reporting → Profitability
  // "model how to move this yield" link) wins; otherwise the only building.
  useEffect(() => {
    if (!allBuildings.length) return;
    const wanted = router.query?.buildingId;
    if (wanted && allBuildings.some((b) => b.id === wanted)) { setSelectedBuildingIds([wanted]); return; }
    if (allBuildings.length === 1) setSelectedBuildingIds([allBuildings[0].id]);
  }, [allBuildings, router.query?.buildingId]);

  const selectedBuildings = useMemo(
    () => allBuildings.filter((b) => selectedBuildingIds.includes(b.id)),
    [allBuildings, selectedBuildingIds],
  );

  const toggleBuilding = useCallback((id) => {
    setSelectedBuildingIds((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id],
    );
  }, []);

  const clear = useCallback(() => { setSimItems(null); setSimBuildingId(null); }, []);

  // buildingId is passed in by the accordion (opportunity items don't carry it).
  const onSimulate = useCallback((items, buildingId) => {
    const list = Array.isArray(items) ? items : [];
    setSimItems(list.length ? list : null);
    setSimBuildingId(buildingId ?? null);
  }, []);

  // STEP 1 → STEP 2: scheduling the work creates the plan; go to its cashflow page.
  const onPlanned = useCallback((planId) => {
    if (planId) router.push(`/manager/cashflow/${planId}`);
  }, [router]);

  // Bring the simulation card into view when it opens.
  useEffect(() => {
    if (simItems && simRef.current) {
      simRef.current.scrollIntoView({ behavior: "smooth", block: "start" });
    }
  }, [simItems]);

  const allSelected = allBuildings.length > 0 && selectedBuildingIds.length === allBuildings.length;

  return (
    <div className="space-y-4">
      {/* Quiet toolbar: building filter only. */}
      {allBuildings.length > 0 && (
        <div className="flex flex-wrap items-center gap-1.5">
          <span className="mr-1 text-[11px] font-semibold uppercase tracking-wide text-foreground-dim">{t("planning.building", { defaultValue: "Building" })}</span>
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
              {allSelected ? t("planning.clear", { defaultValue: "Clear" }) : t("planning.selectAll", { defaultValue: "Select all" })}
            </button>
          )}
        </div>
      )}

      {/* Yield goal-seek — collapsed by default; emits accretive/dilutive annotations
          that badge the single opportunity list below (no duplicate asset list). */}
      {selectedBuildings.length === 1 && (
        <YieldGoalSeekPanel building={selectedBuildings[0]} onSimulate={onSimulate} onAnnotationsChange={setAnnotations} />
      )}

      {/* The one opportunity list. */}
      <div>
        <div className="mb-2 flex items-baseline justify-between gap-3">
          <h3 className="m-0 text-sm font-semibold text-foreground">{t("planning.opportunitiesTitle", { defaultValue: "Renovation opportunities" })}</h3>
          <span className="text-xs text-foreground-dim">{t("planning.opportunitiesHint", { defaultValue: "sorted by urgency" })}</span>
        </div>
        <RenovationAccordion buildings={selectedBuildings} onSimulate={onSimulate} annotations={annotations} />
      </div>

      {/* Simulation + financing — full width, brought in beneath the table */}
      {simItems && (
        <div ref={simRef} className="space-y-4 scroll-mt-4">
          <div className="rounded-2xl border border-surface-border bg-surface overflow-hidden">
            {/* Key on the simulated selection so a new bundle remounts the drawer
                with fresh state — otherwise its non-derived state (cost overrides,
                linked plan, chosen scenario, "scheduled" message) leaks from the
                previous run (e.g. a whole-building sim into a single-asset sim). */}
            <RenovationSimulatorDrawer
              key={`${simBuildingId ?? ""}|${simItems.map((i) => i.assetId).join("-")}`}
              embedded
              items={simItems}
              buildingId={simBuildingId}
              onClose={clear}
              onPlanned={onPlanned}
            />
          </div>
          {simBuildingId && (
            <div>
              <div className="mb-2">
                <h4 className="text-sm font-semibold text-foreground m-0">Financing &amp; Valuation</h4>
                <p className="text-xs text-foreground-dim mt-0.5">
                  Building-level — used to compute the levered NPV (DSCR / LTV / equity IRR),
                  shown on the cash plan after you plan the work.
                </p>
              </div>
              <FinancingPanel buildingId={simBuildingId} onChanged={() => {}} />
            </div>
          )}
        </div>
      )}
    </div>
  );
}
