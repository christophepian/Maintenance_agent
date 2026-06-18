# Epic: Portfolio Performance Canvas — Multi-Period Reporting

> **Status:** Scoping / pre-implementation
> **Owner:** Christophe Pian
> **Last updated:** 2026-06-18

---

## Goal

Give the property owner a financial-instrument-grade time-series view of portfolio health — with a range picker (1W · 1M · 6M · 1Y · 2Y · 5Y · 10Y), a multi-line "Performance Canvas" (inspired by the Blue Ocean Strategy Canvas in the pitchdeck), and clean in-page navigation between the existing period analysis and the new canvas view.

The current reporting page answers "how did this month / this YTD perform?" The canvas answers "where is the portfolio heading over time?"

---

## Guardrail review (against PROJECT_OVERVIEW.md)

| Rule | Impact on this epic |
|------|-------------------|
| **G1/G8 — migrations only** | `PortfolioWeeklySnapshot` (Slice 1b) requires `prisma migrate dev`, never `db push` |
| **G2/G3 — update all consumers** | New `PortfolioTimeSeriesDTO` must be added to openapi.yaml + api-client + contracts.test.ts in the same PR as the endpoint |
| **G9 — canonical includes** | New repository fn must export a constant; no ad-hoc `include: {}` in routes/services |
| **G10 — contract tests** | `GET /financials/portfolio-timeseries` must get a contract test entry |
| **G12/G13 — atomic commits** | Frontend chart + backend endpoint ship together; never leave one side uncommitted |
| **G16 — no `getInitialProps`** | Chart.js loaded via `next/dynamic` with `ssr: false` to prevent `document`/`window` access at SSR time |
| **G17 — all strings via `t()`** | Range picker labels (1W, 1M…), canvas axis labels, legend — all in `en/owner.json` + `fr/owner.json` |
| **F-UI4 — no template-literal classNames** | `cn()` mandatory for all dynamic className composition in new components |
| **F-UI9 — mobile** | Canvas chart gets a mobile-friendly fallback (simplified single-metric view or horizontal scroll with `min-w-0`) |
| **F-UI11 — ScrollableTabs** | If we add a tab strip to switch views, it must use `<ScrollableTabs>` not a bare `<div className="tab-strip">` |
| **Auth** | `maybeRequireManager` only for reads; `ownerId` scoping already handled by `getPortfolioSummary(orgId, params, ownerId)` — no change needed |

---

## Architecture constraints

### Data availability

`BuildingFinancialSnapshot` stores `{ orgId, buildingId, periodStart, periodEnd, ...metrics }`. It is an arbitrary-period cache: any call to `getBuildingFinancials()` that doesn't overlap the current calendar month reads from the cache (or writes it on first call). Subsequent calls for the same period are free.

`getPortfolioSummary(orgId, { from, to }, ownerId)` aggregates across all buildings for any window and is already proven for monthly breakdown.

`getPortfolioMonthlyBreakdown(year)` iterates month-by-month using the cache — past months are fast.

### Granularity reality check

| Range | Natural resolution | Data source | Feasibility |
|-------|-------------------|-------------|-------------|
| **1W** | Daily (7 points) | Live ledger queries — NO daily snapshot exists | ⚠️ Slow without a daily snapshot model; 7 × N-buildings live queries |
| **1M** | Weekly (4–5 points) | Live ledger queries | ⚠️ Same issue |
| **6M** | Monthly (6 points) | `getPortfolioMonthlyBreakdown` + snapshot cache | ✅ Fast |
| **1Y** | Monthly (12 points) | Same | ✅ Fast |
| **2Y** | Monthly (24 points) | Same | ✅ Acceptable |
| **5Y** | Quarterly (20 points) | New `getPortfolioQuarterlyBreakdown` — 4 calls/year × snapshot cache | ✅ Fast |
| **10Y** | Annual (10 points) | New `getPortfolioAnnualBreakdown` — 1 call/year × snapshot cache | ✅ Fast |

**Key constraint:** 1W and 1M require daily/weekly resolution which does not exist in the snapshot cache. Two options:
- **Option A (recommended):** Cap minimum resolution at monthly (1M = last 30 days vs prior 30 days, single-point comparison rather than a chart); 6M is the shortest time-series range.
- **Option B (heavier):** Add a `PortfolioDailySnapshot` model + a nightly background job to pre-compute and cache daily rollups. Unlocks true 1W/1M charts but adds schema complexity and a cron dependency.

→ **Decision needed from Christophe** (see Open Questions).

### Chart library

The monthly trendline in the current page is a dependency-free SVG component (`MonthlyTrendChart`). For the multi-line canvas with 5+ series, 8 dimensions, smooth curves, and a legend, a hand-rolled SVG becomes unmaintainable. **Chart.js** is the right call — it's already used in the pitchdeck. Load it via `next/dynamic({ ssr: false })` to satisfy G16.

### Navigation design

The current `TimelineHeader` (sticky, top of page) controls the **period analysis** view: which month/year the hero, KPI table, watch items, and drivers refer to.

The canvas is a different mental model — it's a *window* (last 2 years) not a *point* (June 2026). These must not share state or fight over the same controls.

Proposed structure:

```
TimelineHeader (sticky)               ← unchanged; controls period analysis
│
├── [Period Analysis tab]             ← current page content
│   Hero + KPI expandable
│   Monthly trendline (YTD only)
│   Drivers / Watch items
│   By-property breakdown
│   Occupancy movements
│
└── [Performance Canvas tab]          ← new
    Range picker  1W · 1M · 6M · 1Y · 2Y · 5Y · 10Y
    Metric selector  NOI · Collection · Occupancy · Expenses · …
    Multi-line chart (time → value, one line per year OR one line per metric)
    Canvas view toggle (time-series ↔ profile canvas)
```

The tab strip lives just below the `TimelineHeader`, above the page content, using `<ScrollableTabs>` (F-UI11).

---

## Slices

### Slice 1 — Backend: portfolio time-series endpoint (est. 1 day)

**New service function:** `getPortfolioTimeSeries(orgId, params, ownerId)`

```typescript
interface TimeSeriesParams {
  range: '6M' | '1Y' | '2Y' | '5Y' | '10Y';  // no 1W/1M until Option B decided
}

interface TimeSeriesPoint {
  periodStart: string;   // ISO date
  periodEnd:   string;
  noiCents:              number;
  earnedIncomeCents:     number;
  expensesCents:         number;
  collectionRate:        number;
  noiMargin:             number | null;
  opexRatio:             number | null;
  occupancyRate:         number | null;
}

interface PortfolioTimeSeriesDTO {
  range:  string;
  points: TimeSeriesPoint[];
}
```

Resolution per range:
- `6M` / `1Y` / `2Y` → monthly points via `getPortfolioMonthlyBreakdown` (already exists, extend to accept `fromYear` + month window)
- `5Y` → new `getPortfolioQuarterlyBreakdown`: Q1–Q4 per year, 5 years back
- `10Y` → new `getPortfolioAnnualBreakdown`: Jan 1–Dec 31 per year, 10 years back

All lean on `getBuildingFinancials` + snapshot cache — no new schema for monthly/quarterly/annual resolution.

**New route:** `GET /financials/portfolio-timeseries?range=1Y`
- Auth: `maybeRequireManager` (owner read)
- `ownerId` scoped via existing pattern
- Response: `{ data: PortfolioTimeSeriesDTO }`

**Guardrail checklist:**
- [ ] Add to `openapi.yaml` with `PortfolioTimeSeriesDTO` + `TimeSeriesPoint` schemas
- [ ] Add `packages/api-client` export
- [ ] Add `GET /financials/portfolio-timeseries` entry to `contracts.test.ts`
- [ ] Add Next.js proxy: `apps/web/pages/api/financials/portfolio-timeseries.js`

---

### Slice 2 — Frontend: Performance Canvas tab + range picker (est. 1.5 days)

**New tab in reporting page**

Add a two-tab strip below `TimelineHeader`:

```
[ Period Analysis ]  [ Performance Canvas ]
```

Uses `<ScrollableTabs activeIndex={activeTab}>` (F-UI11 compliant).

`activeTab` stored in `useState(0)` — no URL param needed (ephemeral view preference).

**Range picker component**

```
1W  1M  6M  1Y  2Y  5Y  10Y
```

Pill strip, selected pill = `bg-slate-900 text-white`, others = `text-muted-text hover:bg-surface-hover`. Follows existing month-chip pattern in `TimelineHeader`. 1W and 1M either disabled (Option A) or enabled (Option B).

**`PortfolioCanvasChart` component**

Loaded via:
```js
const PortfolioCanvasChart = dynamic(
  () => import("../../components/PortfolioCanvasChart"),
  { ssr: false }
);
```

Internal: Chart.js `line` chart.

Two sub-modes toggled by a small icon button (top-right of the chart card):

1. **Time-series mode** (default) — X = time (months/quarters/years), Y = metric value. One line per selected metric. Metric selector above chart: `NOI · Earned · Expenses · Collection Rate · NOI Margin · Occupancy`. Multi-select allowed (up to 3 lines to avoid clutter). Y-axis auto-scales per selection.

2. **Profile canvas mode** — X = KPI dimension (7 fixed labels), Y = normalized 0–10 score. One line per year (up to 5 years). Current/most-recent year = bold brand colour; prior years = descending opacity, dashed. Mirrors the Blue Ocean canvas aesthetic. Normalization: each dimension independently scaled to its own max across the visible window; "lower is better" dimensions (Expenses, OpEx Ratio) are inverted (score = 10 − raw_normalized × 10).

**Data flow:**
```
activeRange → fetch /api/financials/portfolio-timeseries?range=X
           → PortfolioTimeSeriesDTO
           → client-side normalization for profile canvas mode
           → Chart.js datasets
```

Uses `useDetailResource` hook (already in `lib/hooks/`) for fetch + loading state.

**Loading state:** skeleton pulse on chart area (same pattern as KPI table rows).

**Mobile:** time-series mode renders normally (Chart.js is responsive). Profile canvas mode on mobile shows a simplified single-year vs prior-year comparison table instead of the 5-line canvas (too dense on a 375px screen).

**i18n:** All new strings in `en/owner.json` + `fr/owner.json` under `reporting.canvas.*`.

---

### Slice 3 — Navigation integration (est. 0.5 days)

- Add `ScrollableTabs` wrapping `[Period Analysis, Performance Canvas]` below `TimelineHeader`, above page content
- Wire `activeTab` state so the existing page content (`hero`, `KPI section`, `monthly trendline`, `drivers`, `watch items`, `by-property`) renders only when `activeTab === 0`
- Canvas section renders only when `activeTab === 1`
- `TimelineHeader` remains visible in both tabs (period context still useful in canvas tab as a reference anchor)
- Ensure no horizontal overflow on mobile (F-UI9)
- EN/FR tab label keys added

---

### Slice 1b (optional — Option B only) — Daily snapshot infrastructure (est. 2 days)

Only if 1W/1M time-series charts are required.

**New Prisma model:**
```prisma
model PortfolioDailySnapshot {
  id            String   @id @default(cuid())
  orgId         String
  date          DateTime @db.Date
  noiCents      Int
  earnedCents   Int
  expensesCents Int
  collectionRate Float
  occupancyRate Float?
  computedAt    DateTime @default(now())

  org  Org @relation(fields: [orgId], references: [id])

  @@unique([orgId, date])
  @@index([orgId, date])
}
```

**Background job:** A nightly cron (via `CronCreate` in the harness or a Render cron service) calls `getPortfolioSummary` for the prior day and upserts into `PortfolioDailySnapshot`. First run backfills up to 30 days.

**Cost:** 1 migration, 1 new repository, 1 cron route, schema/openapi/contract test updates. Adds ~30 rows/day per org.

---

## File map

| File | Change |
|------|--------|
| `apps/api/src/services/financials.ts` | Add `getPortfolioTimeSeries`, `getPortfolioQuarterlyBreakdown`, `getPortfolioAnnualBreakdown` |
| `apps/api/src/routes/financials.ts` | Add `GET /financials/portfolio-timeseries` route |
| `apps/api/openapi.yaml` | Add `PortfolioTimeSeriesDTO`, `TimeSeriesPoint`, new operation |
| `packages/api-client/index.ts` | Export new fetch fn |
| `apps/api/src/__tests__/contracts.test.ts` | Add contract test for new endpoint |
| `apps/web/pages/api/financials/portfolio-timeseries.js` | Next.js proxy |
| `apps/web/components/PortfolioCanvasChart.jsx` | New Chart.js component (dynamic-imported) |
| `apps/web/pages/owner/reporting.js` | Tab strip, range picker, canvas section, tab state |
| `apps/web/public/locales/en/owner.json` | `reporting.canvas.*` keys |
| `apps/web/public/locales/fr/owner.json` | Same, French |
| *(Option B only)* `apps/api/prisma/schema.prisma` | `PortfolioDailySnapshot` model |
| *(Option B only)* `apps/api/prisma/migrations/…` | Migration for above |

---

## What is NOT in scope

- Per-building time-series breakdown (portfolio-level only in this epic)
- WALT, cap rate, LTV, DSCR, IRR — tracked separately in `reporting_enhancements.md`
- Export to CSV/PDF of the canvas
- Annotations or events overlaid on the chart (e.g. "new building added")
- Real-time / live-updating chart

---

## Open questions — answers needed before Slice 1 starts

1. **1W / 1M granularity (the biggest decision):**
   Option A = skip 1W/1M, start range picker at 6M (fast, no schema change).
   Option B = add `PortfolioDailySnapshot` + nightly cron to unlock true 1W/1M charts (adds ~2 days and a migration).
   Which do you prefer?

2. **Default chart mode:**
   Should the canvas open in **time-series mode** (X = time, one line per metric — more familiar, like a Bloomberg terminal) or **profile canvas mode** (X = dimensions, one line per year — more strategic, like the Blue Ocean canvas)?
   Or is one of the two modes not needed?

3. **Metric selection in time-series mode:**
   Should the user be able to pick which metrics to display (multi-select up to 3), or should we show a fixed set (e.g. always NOI + Collection Rate + Occupancy)?

4. **Tab vs toggle:**
   "Period Analysis / Performance Canvas" as a **tab strip** (replaces content below) vs a **section toggle** (canvas appears below the existing content, always visible if you scroll down)?
   Tab strip = cleaner navigation. Section toggle = no mode-switching, everything on one scroll.

5. **How many years of data does the platform have?**
   The platform appears to have been live since ~2024. A 10Y range would show 8 empty years. Should we auto-detect the earliest snapshot and cap the range picker to only show ranges with data? Or keep the full picker and show "No data" gracefully?
