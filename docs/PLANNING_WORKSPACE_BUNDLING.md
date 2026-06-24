# Planning Workspace — Renovation × Cashflow Plan Bundling

**Date:** 2026-06-24
**Status:** Scoping — **approved**, ready to implement (phased). Not started.
**Author:** scoped with Claude
**Supersedes the flow defined in:** [PLANNING_TAB_REARCHITECTURE.md](./PLANNING_TAB_REARCHITECTURE.md) (the 2026-06-19 three-surface flow)

---

## 1. Problem Statement

Today the renovation decision loop spans **three surfaces** and **two NPV engines**:

| Step | Surface | Notes |
|---|---|---|
| Discover | `RenovationAccordion` on `/manager/finance?tab=planning` | pick assets → "Simulate N →" |
| Simulate | `RenovationSimulatorDrawer` (full-screen portal) | NPV computed **client-side** |
| Schedule | "Plan this work" → `CashflowPlan` + `CashflowOverride`s | aligns discount/cap to simulator |
| Validate / govern | `/manager/cashflow/[id]` | NPV recomputed **server-side**; Submit → Approve → RFP |

Pain points:

1. **Two NPV computations** (drawer client-side vs plan server-side). Deliberately reconciled (commit `fedda8a`) but they remain two code paths that can drift — the user must mentally reconcile two numbers.
2. **Multi-surface hop** — simulate → navigate → set financing/assumptions → recalc → submit. The decision loop never closes where the user is looking.
3. **Assumption drift** — discount/cap copied at plan creation only; OBLF/vacancy live only in the simulator.
4. **Plan-collision bug** — "Plan this work" dumps into the *first DRAFT plan* for the building; two simulations can silently merge.

User goal (confirmed): remove **both** the screen-hopping **and** the dual-NPV reconciliation. Chosen direction: **Option C — single planning workspace**, **single-building** scope.

---

## 2. Target Mental Model

```
        ── ONE SCREEN: /manager/finance?tab=planning ──

 DISCOVER            SIMULATE & SCHEDULE          DECIDE
 ───────────────────────────────────────────────────────────────
 Opportunity tree    Action/Timing/Horizon        ★ Verdict INVEST
 Building▸Unit▸Asset  OBLF·Discount·Cap·Vacancy     NPV / equity IRR
 ☑ condition+rec      Per-asset cost + timing       DSCR · LTV
 [working set: N]     breakdown                     Financing summary
                                                    Capex schedule
                                                    [Schedule][Submit]
                              │
              one live DRAFT CashflowPlan (single source of truth)
                              │
                 server-side renovation-aware levered NPV
```

The workspace **is the DRAFT plan's editor.** Selecting assets materialises/locates a DRAFT plan; every control edits that plan; the verdict is always the plan's authoritative server NPV. The plan page becomes the canonical read-only permalink.

---

## 3. Decisions

| # | Question | Decision |
|---|---|---|
| D1 | Bundling level | **C — single workspace** replacing the Planning tab content |
| D2 | NPV source of truth | **Server-side** `GET /cashflow-plans/:id/npv-scenarios` (renovation-aware, levered). Retire the drawer's client-side NPV; keep an optional instant *preview* that is replaced on server response. |
| D3 | Backing store | A **live DRAFT `CashflowPlan`** owned by the workspace; working-set assets = its `CashflowOverride`s |
| D4 | Scope | **Single-building** per working set/decision. Tree may list many buildings; cross-building selection warns/splits. Portfolio plans stay the existing manual flow. |
| D5 | `CashflowPlan` artifact | **Preserved** as decision-of-record with DRAFT→SUBMITTED→APPROVED. "Bundle the creation," do not dissolve the artifact. |
| D6 | Plan detail page | **Kept** as canonical permalink (owner-approval links, notifications). Initially read-only-leaning; Phase 3 redirects it into the workspace with the plan preselected. |
| D7 | Lock on submit | Once SUBMITTED/APPROVED the workspace controls go read-only (mirrors today's plan page) |
| D8 | Plan collision | Workspace owns **one keyed working DRAFT plan** per building; explicit "New plan" to start fresh (fixes the "first DRAFT plan" catch-all) |
| D9 | Recompute cadence | **Debounced** server recompute (~400–600ms) + optimistic client preview to keep sliders responsive |
| D10 | Route | **Keep inside `/manager/finance?tab=planning`** (full-width tab content), not a separate route |
| D11 | Drawer fate | **Keep `RenovationSimulatorDrawer` as an optional focus mode** (full-screen) alongside the embedded `SimulationPanel`; both render the same body |
| D12 | Vacancy & OBLF | **Promote both to first-class override fields** (`vacancyMonths`, `oblfPassthroughPct`) so the server NPV reproduces the simulator exactly and the assumptions persist/are auditable. (Vacancy is currently absent server-side → the unified number is otherwise wrong; OBLF's effect is already captured via uplift but the `%` is promoted for auditability.) |
| D13 | Owner visibility | **Plan permalink only** — owners keep the read-only `/manager/cashflow/[id]`; the workspace stays a manager authoring tool |

---

## 4. Architecture

### 4.1 Layout (responsive)

Full-width within the Planning tab; three regions side by side on desktop, stacked on tablet/mobile (tree → simulate → decide), reusing existing responsive patterns (`ScrollableTabs`, dual-render tables).

| Region | Built from | Changes |
|---|---|---|
| **Left — Opportunities** | `RenovationAccordion.jsx` (as-is; condition + recommendation tags already shipped) | emits the *working set* (selected assetIds) to the workspace instead of opening a drawer |
| **Center — Simulate & schedule** | `RenovationSimulatorDrawer.jsx` controls + per-asset breakdown | extract the simulator body from the full-screen portal into an embeddable `SimulationPanel`; controls write to the live plan |
| **Right — Decide** | `NPVScenariosPanel.js` + `FinancingPanel.jsx` + capex schedule + lifecycle actions | verdict, levered metrics, financing summary, Schedule/Submit/Approve/RFP |

### 4.2 New / refactored components

- `PlanningWorkspace.jsx` — orchestrator: holds the working-set state, the live `planId`, and the debounced sync; lays out the three regions.
- `SimulationPanel.jsx` — the simulator body, decoupled from `createPortal`/full-screen. (The existing drawer can keep wrapping `SimulationPanel` for any remaining standalone use, or be retired.)
- `DecisionPanel.jsx` — composes `NPVScenariosPanel` (mode="plan") + financing summary + capex schedule + action bar.
- `useWorkingPlan(buildingId)` hook — locate/create the keyed DRAFT plan, expose `{ planId, overrides, assumptions, setOverrides, setAssumptions, verdict, recompute }` with debounced server sync.

### 4.3 Data flow

```
select assets ──▶ useWorkingPlan(buildingId)
                    │  locate keyed DRAFT plan or POST /cashflow-plans
                    ▼
working set ──▶ PUT overrides (assetId, years, costChf, uplift, riskAvoided)
controls    ──▶ PUT assumptions (discount, cap, deferYears, propertyValue, OBLF*, vacancy*)
                    │  (debounced)
                    ▼
            GET /cashflow-plans/:id/npv-scenarios  ──▶ DecisionPanel verdict
                    │
            Schedule = persist (already persisted live) → Submit → Approve → RFP
```

\* OBLF passthrough and vacancy currently live only in the simulator and feed the
client NPV via `computeRenovationNoiAdjustments` inputs baked into the override
(`rentUpliftChfPerMonth`, `riskAvoidedChfPerYear`). For one-number unification these
must be representable on the plan/override — see §6 API changes.

---

## 5. Lifecycle & Governance (unchanged contract)

- DRAFT (editable in workspace) → SUBMITTED (workspace read-only) → APPROVED (RFP available).
- Submit/Approve buttons move from the plan page into the DecisionPanel.
- RFP creation (`POST /cashflow-plans/:id/rfps`, APPROVED only) appears in the DecisionPanel.
- Owner-approval notifications and links continue to point at `/manager/cashflow/[id]` (kept as permalink).

---

## 6. API changes

Most plumbing exists. Gaps to close for true single-number unification:

| Need | Today | Change (per D12) |
|---|---|---|
| Vacancy months | **simulator-only — absent from `CashflowOverride` and `computeRenovationNoiAdjustments`**, so the server NPV silently omits vacancy lost-rent | **Add `vacancyMonths Int?` to `CashflowOverride`** (migration) + model it in `npvService`: subtract `monthlyRent × vacancyMonths` as a one-time cost in the work year for Invest, pushed by `deferYears` for Defer. Mirrors the simulator's `-monthlyRentChf × vacancyMonths`. |
| OBLF passthrough % | effect captured via `rentUpliftChfPerMonth`; the `%` itself not stored | **Add `oblfPassthroughPct Float?` to `CashflowOverride`** (migration) for auditability/exact reproduction. The uplift continues to drive NOI; the `%` is stored so the plan can show/re-derive it. |
| Locate keyed working plan | `GET /cashflow-plans?buildingId=` then pick first DRAFT (collision-prone) | workspace tracks its `planId` in URL/query (`?plan=<id>`); **client-side ownership key**, explicit "New plan" to start fresh |
| Batch override upsert | one POST per asset | add `PUT /cashflow-plans/:id/overrides` bulk endpoint to cut N round-trips (perf) |

Migration: one migration adding `vacancyMonths` + `oblfPassthroughPct` to `CashflowOverride` (both nullable → non-breaking; applied via `server.ts` `migrate deploy`). "Plan this work" / the workspace write both fields; `npvService` reads `vacancyMonths`.

All new/changed DB access stays in repositories (G20/G22). No new service/route `prisma.*`.

---

## 7. Phasing

Even as the target is C, ship in three reversible phases behind the existing tab.

### Phase 1 — Compose the screen (no NPV change yet)
- [ ] Extract `SimulationPanel` from the drawer portal (keep drawer as a thin wrapper).
- [ ] `PlanningWorkspace` lays out accordion (left) + SimulationPanel (center) + DecisionPanel (right).
- [ ] Selecting assets drives the center panel inline (no full-screen drawer hop).
- [ ] DecisionPanel shows the server verdict **after** "Schedule" (current data flow).
- [ ] Responsive stack; guardrails (G23/F-UI4/G17) clean.
- **Outcome:** single-screen feel; no behavioural NPV change. Low risk.

### Phase 2 — Unify the NPV
- [ ] `useWorkingPlan` materialises a keyed DRAFT plan on first asset selection.
- [ ] Center controls write overrides/assumptions live (debounced) → server NPV drives the right panel.
- [ ] Retire the drawer's client-side NPV (optional instant preview only).
- [ ] Fix plan-collision: one keyed plan + explicit "New plan".
- **Outcome:** one trustworthy number everywhere.

### Phase 3 — Inline lifecycle
- [ ] Submit / Approve / RFP in DecisionPanel; lock controls on submit.
- [ ] FinancingPanel summary inline; deep-edit still possible.
- [ ] `/manager/cashflow/[id]` redirects into the workspace with the plan loaded (permalink preserved via query).
- **Outcome:** full Option C.

---

## 8. Guardrail & quality considerations

- **G20/G22** — all DB access in repositories; orchestration only in services/routes (both baselines at zero headroom: services 24/212, routes 5/41).
- **G23** — semantic tokens only; mark any genuinely-dynamic `style={{}}` with `/* no-token */`.
- **F-UI4 / F-UI4a** — `cn()`, no inline color maps.
- **G17** — the simulator is currently English-only (`.jsx`); embedding into the i18n'd planning page means new user-facing strings in `.js` must use `t()`. Budget i18n work for SimulationPanel labels if promoted to `.js`.
- **F-UI9** — tables not wrapped in `Panel`.
- Perf — debounce server recompute; consider the bulk overrides endpoint.

---

## 9. Risks & mitigations

| Risk | Mitigation |
|---|---|
| Server NPV per slider feels slow | debounce + optimistic client preview replaced on response |
| Drawer→panel layout rework (portal positioning) | extract body cleanly; keep drawer wrapper during Phase 1 |
| Big surface change hard to roll back | phased behind the existing tab; each phase independently shippable |
| Plan sprawl / collisions | keyed working plan + explicit "New plan" (Phase 2) |
| Cross-building selection in a single-building model | warn + offer per-building split |

---

## 10. Open questions — resolved 2026-06-24

1. **Vacancy/OBLF on the plan** → **Promote both** to first-class override fields (D12). Required for vacancy (server NPV otherwise wrong); OBLF promoted for auditability.
2. **Drawer retirement** → **Keep as optional focus mode** (D11).
3. **Route** → **Keep inside `/manager/finance?tab=planning`** (D10).
4. **Owner visibility** → **Plan permalink only** (D13).
```
