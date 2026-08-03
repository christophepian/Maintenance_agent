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
import RenovationAccordion from "./RenovationAccordion";
import RenovationSimulatorDrawer from "./RenovationSimulatorDrawer";
import FinancingPanel from "./FinancingPanel";
import { authHeaders } from "../lib/api";

export default function PlanningWorkspace({ buildings: allBuildings = [] }) {
  const router = useRouter();
  const { t } = useTranslation("manager");
  // Building filter: default to all when there's a single building, else none (pick).
  const [selectedBuildingIds, setSelectedBuildingIds] = useState([]);
  const [simItems, setSimItems]           = useState(null);
  const [simBuildingId, setSimBuildingId] = useState(null);
  // Accretive/dilutive annotations (derived from the goal-seek) → badge the accordion rows.
  const [annotations, setAnnotations]     = useState(null);
  const simRef = useRef(null);
  const firedKeyRef = useRef(null); // one-shot guard for the ?simulate=accretive deep-link

  // Auto-select: a ?buildingId deep-link (from Reporting → "Plan improvements →")
  // wins; otherwise the only building.
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

  // Single-building: the goal-seek and simulation are per-building, so selection is
  // a dropdown, not multi-select pills.
  const selectBuilding = useCallback((id) => { setSelectedBuildingIds(id ? [id] : []); }, []);

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

  // The goal-seek now lives under Reporting; Planning derives the accretive/dilutive
  // badges itself (from the same endpoint) and honours the ?simulate=accretive
  // deep-link "Plan improvements →" sends, auto-opening the simulator on the works.
  useEffect(() => {
    const id = selectedBuildingIds.length === 1 ? selectedBuildingIds[0] : null;
    if (!id) { setAnnotations(null); return; }
    const to = new Date(); const from = new Date(to);
    from.setFullYear(from.getFullYear() - 1); from.setDate(from.getDate() + 1);
    const iso = (d) => d.toISOString().slice(0, 10);
    let cancelled = false;
    Promise.all([
      fetch(`/api/buildings/${id}/yield-goalseek?from=${iso(from)}&to=${iso(to)}&target=3&mgmtFeePct=5`, { headers: authHeaders() }).then((r) => r.json()).catch(() => null),
      fetch(`/api/buildings/${id}/renovation-opportunities`, { headers: authHeaders() }).then((r) => r.json()).catch(() => null),
    ]).then(([gs, op]) => {
      if (cancelled) return;
      const lines = gs?.data?.levers?.renovation?.lines ?? [];
      const opps = Array.isArray(op?.data) ? op.data : [];
      if (lines.length) {
        const map = {};
        for (const l of lines) {
          const label = l.accretive ? t("planning.goalSeek.accretive", { defaultValue: "Accretive" }) : t("planning.goalSeek.dilutive", { defaultValue: "NPV+ / dilutive" });
          map[l.assetId] = { accretive: l.accretive, label: `${label} · ${l.marginalYieldPct.toFixed(1)}%` };
        }
        setAnnotations(map);
      } else setAnnotations(null);
      // One-shot simulate handoff (keyed on building so a later navigation re-fires).
      const key = `${id}|${router.query?.simulate}`;
      if (router.query?.simulate === "accretive" && firedKeyRef.current !== key && lines.length && opps.length) {
        const ids = new Set(lines.filter((l) => l.accretive).map((l) => l.assetId));
        const items = opps.filter((o) => ids.has(o.assetId));
        if (items.length) { firedKeyRef.current = key; onSimulate(items, id); }
      }
    });
    return () => { cancelled = true; };
  }, [selectedBuildingIds, router.query?.simulate, t, onSimulate]);

  // Bring the simulation card into view when it opens.
  useEffect(() => {
    if (simItems && simRef.current) {
      simRef.current.scrollIntoView({ behavior: "smooth", block: "start" });
    }
  }, [simItems]);

  return (
    <div className="space-y-4">
      {/* Building selector — single-building (goal-seek + simulation are per-building). */}
      {allBuildings.length > 0 && (
        <div className="flex flex-wrap items-center gap-2">
          <label htmlFor="planning-building" className="text-[11px] font-semibold uppercase tracking-wide text-foreground-dim">{t("planning.building", { defaultValue: "Building" })}</label>
          <select
            id="planning-building"
            value={selectedBuildingIds[0] ?? ""}
            onChange={(e) => selectBuilding(e.target.value)}
            className="rounded-lg border border-surface-border bg-surface px-3 py-1.5 text-sm text-foreground"
          >
            {allBuildings.length !== 1 && <option value="">{t("planning.selectBuilding", { defaultValue: "Select a building…" })}</option>}
            {allBuildings.map((b) => <option key={b.id} value={b.id}>{b.name}</option>)}
          </select>
        </div>
      )}

      {/* The one opportunity list — accretive/dilutive badges come from the goal-seek
          endpoint (derived above); the tool itself now lives under Reporting. */}
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
