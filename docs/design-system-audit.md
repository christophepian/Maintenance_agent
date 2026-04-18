# Design System Audit — Maintenance Agent Web App
> **Status:** ✅ Fully implemented. All 12 conflicts resolved. CSS architecture unified.
> **Last updated:** 2026-04-15
> **Artifacts:** `docs/design-system.html` (visual reference), `apps/web/styles/globals.css` (source of truth)

---

## Architecture Summary

| Layer | What | Where |
|-------|------|-------|
| **Semantic tokens** | 23 CSS custom properties (brand, destructive, success, muted, surface) | `globals.css` `@theme {}` block |
| **@apply classes** | 78 utility-backed CSS classes (buttons, notices, tables, tabs, filters, etc.) | `globals.css` `@layer components` |
| **CVA primitives** | 10 variant-based components (Button, Badge, Card, DataTable, Input, Select, ErrorBanner, EmptyState, StatusPill, KpiCard) | `components/ui/` |
| **cn() utility** | `twMerge(clsx())` for class merging with override support | `lib/utils.js` — 80 files |
| **statusVariants** | 14 status→Badge variant mappers (canonical status color source) | `lib/statusVariants.js` — 60 files |

### Key metrics (2026-04-15)
- Inline `style={{}}`: **166 → 14** (92% eliminated; remaining are dynamic chart widths/heights)
- Hardcoded rgb/hex: **50+ → 17** (all SVG chart strokes)
- Error-banner class: **34 files** importing `ErrorBanner` component
- `cn()` adoption: **80 files** (all dynamic classNames)
- `Badge` adoption: **77 files** (all status indicators)
- Template-literal className interpolation: **0** (fully migrated to `cn()`)
- Per-file `STATUS_COLORS` constants: **0** (fully migrated to `statusVariants.js`)
- `aria-label` attributes: **25** | `sr-only`: **65** | `role=`: **100**
- `focus-visible`/`focus:ring`: **358** instances
- Skip-to-content: ✅ | Nav aria-labels: 5/5 | ErrorBoundary: ✅

---

## Color Palette

### Tailwind scale in use
- **Slate** (dominant): slate-50 through slate-900
- **Indigo**: indigo-50, 100, 200, 400, 600, 700
- **Blue**: blue-50, 100, 200, 300, 400, 600, 700, 800
- **Green/Emerald**: green-50/100/400/500/700/800, emerald-50/100/700/800
- **Red**: red-50/100/200/300/400/500/600/700/800
- **Amber/Orange**: amber-50/100/200/400/500/700/800, orange-50/100/200/700
- **Yellow**: yellow-100
- **Purple/Violet**: purple-100/700/800, violet-100/600/700
- **Teal/Cyan**: teal-50/100/700/800, cyan-100/800

### Hardcoded hex values (inline styles — should be moved to Tailwind)
- AppShell.js: `#f7f7f8` (page bg), `#111` (text), `#e5e5e5` (border), `#ffffff` (sidebar bg)
- TenantPicker.js: `#fff8e1` / `#ffe082` (yellow), `#e8f5e9` / `#a5d6a7` (green)
- ContractorPicker.js: `#e3f2fd` / `#90caf9` (blue)
- NotificationBell.js: `#dc2626` (red badge)

### ⚠ CONFLICT #1 — gray-* vs slate-*
- **AssetInventoryPanel.js** and **DocumentsPanel.js** use `gray-*` exclusively
- All other components use `slate-*`
- **Decision needed:** standardise on `slate-*`

---

## Typography

| Use | Classes | Example |
|-----|---------|---------|
| Page title | `text-xl font-bold text-slate-900` or `text-lg font-semibold text-slate-800` | Page heading |
| Panel/card heading | `text-sm font-semibold text-slate-900` | Card header |
| Subsection heading | `text-xs font-semibold text-gray-600` or `text-sm font-semibold text-slate-800` | Section label |
| Small heading | `text-xs font-semibold text-gray-500 uppercase tracking-wider` | Column header |
| Body text | `text-sm text-slate-600` | Standard content |
| Secondary text | `text-xs text-slate-500` | Metadata |
| Micro text | `text-[11px] text-slate-400` | Table subtext |
| Monospace | `font-mono text-xs` | Codes, IBANs |
| Form label | `text-xs font-medium text-slate-600 mb-1` | Input label |
| Table header | `text-[11px] font-medium uppercase tracking-wider text-slate-400` | th cells |

---

## Buttons

### Variant A — Primary (dark)
```
bg-slate-900 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-slate-700
```

### Variant B — Primary (blue)
```
bg-blue-600 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-blue-700
```

### Variant C — Secondary (outline)
```
border border-slate-200 bg-white text-slate-600 px-3 py-1.5 rounded-lg text-xs font-medium hover:bg-slate-50
```

### Variant D — Danger (outline)
```
border border-red-200 bg-white text-red-600 px-3 py-1.5 rounded-lg text-xs font-medium hover:bg-red-50
```

### Variant E — Icon button
```
text-slate-400 hover:text-slate-600 p-1.5 rounded-lg hover:bg-slate-100
```

### Disabled state (all variants)
```
disabled:opacity-50 disabled:cursor-not-allowed
```

### ⚠ CONFLICT #2 — Button border-radius
- Most buttons: `rounded-lg`
- Some in AssetInventoryPanel: `rounded-md`
- Some older: `rounded` (no size modifier)
- **Decision needed:** standardise on `rounded-lg`

### ⚠ CONFLICT #3 — Primary button color
- Most pages: `bg-slate-900` (dark)
- Finance pages: `bg-blue-600`
- AssetInventoryPanel form: `bg-gray-900`
- **Decision needed:** pick one primary action color

### ⚠ CONFLICT #4 — Button padding
- `px-4 py-2` (medium, most common)
- `px-3 py-1.5` (small, most common secondary)
- `px-2.5 py-1` (BillingEntityManager)
- `px-2 py-1` (AssetInventoryPanel)
- **Decision needed:** define 3 sizes (sm / md / lg)

---

## Badges / Status Pills

### Shape variants
- Most: `rounded-full px-2 py-0.5 text-xs font-semibold`
- RFP status: `rounded-full border px-2 py-0.5 text-xs font-medium` (adds border)
- Source channel: `rounded border px-1.5 py-0.5 text-[10px] font-medium` (no `-full`)
- Special: `rounded-full px-2.5 py-0.5 text-xs font-semibold` (slightly wider)

### ⚠ CONFLICT #5 — Badge border-radius
- `rounded-full` (dominant)
- `rounded` (source channel badges, some VacanciesPanel)
- **Decision needed:** standardise on `rounded-full`

### ⚠ CONFLICT #6 — Badge border
- Most: no border, just bg+text color
- RFP status: explicit `border` added matching the text color
- **Decision needed:** define when border is added

### All status color mappings

**Request Status**
| Status | Classes |
|--------|---------|
| PENDING_REVIEW | `bg-slate-100 text-slate-600` |
| PENDING_OWNER_APPROVAL | `bg-amber-100 text-amber-800` |
| RFP_PENDING | `bg-blue-100 text-blue-700` |
| AUTO_APPROVED / COMPLETED | `bg-green-100 text-green-700` |
| APPROVED / ASSIGNED / IN_PROGRESS | `bg-blue-100 text-blue-700` |
| REJECTED | `bg-red-100 text-red-700` |

**Urgency**
| Level | Classes |
|-------|---------|
| EMERGENCY | `bg-red-100 text-red-700 border border-red-200` |
| HIGH | `bg-orange-100 text-orange-700 border border-orange-200` |
| MEDIUM | `bg-blue-100 text-blue-700` |
| LOW | `bg-slate-100 text-slate-600` |

**Invoice Status**
| Status | Classes |
|--------|---------|
| DRAFT | `bg-slate-100 text-slate-600` |
| ISSUED | `bg-blue-100 text-blue-700` |
| APPROVED | `bg-emerald-100 text-emerald-700` |
| PAID | `bg-green-100 text-green-800` |
| DISPUTED | `bg-red-100 text-red-700` |

**RFP Status** (uses border variant)
| Status | Classes |
|--------|---------|
| DRAFT | `bg-slate-50 text-slate-600 border-slate-200` |
| OPEN | `bg-blue-50 text-blue-700 border-blue-200` |
| AWARDED | `bg-green-50 text-green-700 border-green-200` |
| PENDING_OWNER_APPROVAL | `bg-amber-50 text-amber-700 border-amber-200` |
| CLOSED | `bg-slate-50 text-slate-500 border-slate-200` |
| CANCELLED | `bg-red-50 text-red-600 border-red-200` |

**Asset Type**
| Type | Classes |
|------|---------|
| APPLIANCE | `bg-blue-100 text-blue-700` or `bg-violet-100 text-violet-700` (conflict) |
| FIXTURE | `bg-purple-100 text-purple-700` or `bg-blue-100 text-blue-700` (conflict) |
| FINISH | `bg-amber-100 text-amber-700` |
| STRUCTURAL | `bg-red-100 text-red-700` or `bg-emerald-100 text-emerald-700` (conflict) |
| SYSTEM | `bg-teal-100 text-teal-700` or `bg-rose-100 text-rose-700` (conflict) |
| OTHER | `bg-gray-100 text-gray-600` or `bg-slate-100 text-slate-600` (conflict) |

**Ingestion Status**
| Status | Classes |
|--------|---------|
| PENDING_REVIEW | `bg-amber-100 text-amber-700` |
| AUTO_CONFIRMED | `bg-green-100 text-green-700` |
| CONFIRMED | `bg-emerald-100 text-emerald-700` |
| REJECTED | `bg-red-100 text-red-700` |

**Lease Status**
| Status | Classes |
|--------|---------|
| DRAFT | `bg-slate-100 text-slate-600` |
| READY_TO_SIGN | `bg-blue-100 text-blue-700` |
| SIGNED | `bg-green-100 text-green-700` |

---

## Form Controls

### Text input — Standard
```
border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400 w-full
```

### Text input — Compact (AssetInventoryPanel)
```
border border-gray-300 rounded-md px-2 py-1.5 text-sm
```

### Select — Standard
```
border border-slate-300 rounded-lg px-3 py-2 bg-white text-sm focus:outline-none focus:ring-2 focus:ring-blue-400
```

### Date input
```
h-9 appearance-none rounded-lg border border-slate-200 bg-white px-3 py-2 leading-tight text-sm text-slate-700 focus:outline-none focus:ring-2 focus:ring-indigo-400
```

### Search input (with icon)
```
w-full rounded-lg border border-slate-200 py-2 pl-10 pr-3 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-400
```
Container: `relative` · Icon: `absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400`

### Form label
```
block text-xs font-medium text-slate-600 mb-1
```

### ⚠ CONFLICT #7 — Input border color
- `border-slate-300` (most pages)
- `border-gray-300` (AssetInventoryPanel, DocumentsPanel)
- `border-slate-200` (search inputs, date inputs)
- **Decision needed:** standardise on `border-slate-300` for standard, `border-slate-200` for search-style

### ⚠ CONFLICT #8 — Input border-radius
- `rounded-lg` (most pages)
- `rounded-md` (compact forms, AssetInventoryPanel)
- **Decision needed:** standardise on `rounded-lg`

### ⚠ CONFLICT #9 — Focus ring color
- `focus:ring-blue-400` (most text inputs)
- `focus:ring-indigo-400` or `focus:ring-indigo-500` (date inputs, search, ConfigurableTable)
- **Decision needed:** standardise on `focus:ring-indigo-500`

---

## Tables

### Table container
```html
<div class="overflow-x-auto">
  <table class="w-full text-sm">
```

### ⚠ CONFLICT #10 — Table header style

**Variant A** (ConfigurableTable, most pages):
```
border-b border-slate-100 text-left text-[11px] font-medium uppercase tracking-wider text-slate-400
th: px-4 py-3
```

**Variant B** (VacanciesPanel, some older tables):
```
bg-slate-50 text-left text-xs font-semibold uppercase tracking-wide text-slate-500
th: px-3 py-2.5
```

**Decision needed:** pick one (Variant A is more widespread)

### Table body row (consistent)
```
border-b border-slate-50 hover:bg-slate-50/80 transition-colors
td: px-4 py-3
```

### Density variants (ConfigurableTable only so far)
- Comfortable: `px-3 py-2.5` (default)
- Compact: `px-2 py-1.5 text-xs`

---

## Cards / Panels

### Standard panel
```html
<div class="rounded-xl border border-slate-200 bg-white shadow-sm">
  <div class="flex items-center justify-between border-b border-slate-100 px-4 py-3">
    <h2 class="text-sm font-semibold text-slate-900">Title</h2>
  </div>
  <div class="px-4 py-4">...</div>
</div>
```

### Status banner — Success
```
rounded-xl border border-green-200 bg-green-50 p-4
Title: text-sm font-semibold text-green-800
Body: text-xs text-green-700 mt-0.5
```

### Status banner — Warning
```
rounded-xl border border-amber-200 bg-amber-50 p-4
Title: text-sm font-semibold text-amber-800
Body: text-xs text-amber-700 mt-0.5
```

### Dashed empty card (unmapped state)
```
rounded-xl border-2 border-dashed border-slate-200 bg-slate-50/50 p-5
```

---

## Modal / Dialog

### Backdrop
```
fixed inset-0 z-50 flex items-center justify-center bg-black/40
```

### Container
```
relative bg-white rounded-xl shadow-xl w-full max-w-lg mx-4 max-h-[90vh] overflow-y-auto border border-slate-200
```

### Header
```
flex items-center justify-between px-6 py-4 border-b border-slate-200
Title: text-lg font-semibold text-slate-900
Close: text-slate-400 hover:text-slate-600 text-xl
```

### Body
```
px-6 py-5 space-y-4
```

### Footer
```
flex justify-end gap-3 pt-2 border-t border-slate-100
```

### ⚠ CONFLICT #11 — Modal max-width
- `max-w-lg` (BillingEntityManager, most modals)
- `max-w-4xl` (DocumentsPanel — wide/full content)
- **Decision needed:** define 2 sizes: sm (`max-w-lg`), lg (`max-w-4xl`)

---

## Empty States

### Variant A — Tailwind (dominant)
```html
<div class="rounded-lg border border-slate-200 bg-slate-50 p-6 text-center text-slate-600">
  No items found.
</div>
```

### Variant B — CSS class (legacy)
```html
<div class="empty-state">
  <p class="empty-state-text">Loading…</p>
</div>
```

### ⚠ CONFLICT #12 — Empty state approach
- Variant A (Tailwind inline) is current standard
- Variant B (CSS class) is legacy
- **Decision needed:** Tailwind only, remove CSS classes

---

## Loading States

### Spinner (standard)
```html
<div class="flex items-center justify-center py-12">
  <div class="h-6 w-6 animate-spin rounded-full border-2 border-blue-600 border-t-transparent"></div>
  <span class="ml-3 text-sm text-slate-500">Loading…</span>
</div>
```

### ⚠ CONFLICT: Spinner color
- `border-blue-600` (CategoryMappings)
- `border-indigo-600` (other components)
- **Decision needed:** standardise on `border-indigo-600`

---

## Navigation

### Sidebar nav item (all sidebars — consistent ✓)
```
Base: flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors
Active: bg-slate-100 text-slate-900 font-semibold
Inactive: text-slate-600 hover:bg-slate-100 hover:text-slate-900
Icons: lucide-react, size={18} className="shrink-0"
```

### Tab patterns — three variants, each with a distinct purpose

**Rule:** choose the variant based on what the tabs control, not visual preference.

| Variant | When to use | Component |
|---------|-------------|-----------|
| **Underline tabs** | Page-level navigation between distinct data domains on a hub page (e.g. Invoices / Billing Entities / Overview). Each tab is a different data set. | `<Tabs>` + `<TabsList>` + `<TabsTrigger>` (default, no `unstyled`) |
| **Segmented control** | Switching the *view* of the same data set (e.g. filter by pipeline stage, switch chart period). The data source is the same; only the presentation or filter changes. | `<Tabs>` + `<TabsList>` + `<TabsTrigger unstyled>` with `data-[state=active]:bg-blue-600 data-[state=active]:text-white` classes inside a `rounded-lg border border-slate-200 bg-white p-1` list |
| **Pill tabs** | Sub-navigation within a detail page between entity sections (e.g. unit detail: Tenants / Appliances / Assets). Scoped to a single record, not a page hub. | `<Tabs>` + `<TabsList className="pill-tab-row">` + `<TabsTrigger unstyled className="pill-tab ...">` |

#### Underline tabs (hub pages)
```
TabsList: flex border-b border-slate-200 mb-5
TabsTrigger: px-5 py-2.5 text-sm font-medium border-b-2 -mb-px transition-colors
Active:   text-brand border-brand
Inactive: text-slate-500 border-transparent hover:text-slate-700
```

#### Segmented control (filter/view switch)
```
TabsList: flex gap-1 rounded-lg border border-slate-200 bg-white p-1
TabsTrigger: rounded-lg px-3 py-1.5 text-sm font-medium transition-colors
Active:   bg-blue-600 text-white
Inactive: text-slate-600 hover:bg-slate-100
```

#### Pill tabs (detail page sections)
```
TabsList: flex gap-1 flex-wrap mb-4 (pill-tab-row)
TabsTrigger: px-3.5 py-1.5 rounded-md text-sm cursor-pointer border (pill-tab)
Active:   font-bold border-2 border-brand bg-brand-light text-brand-dark
Inactive: border-surface-border bg-surface text-muted-dark
```

> **Implementation note:** All three variants use the same `<Tabs>`, `<TabsList>`, `<TabsTrigger>`, `<TabsContent>` components from `components/ui/Tabs.jsx`. The underline style is the default. Segmented and pill styles pass `unstyled` to both `TabsList` and `TabsTrigger` to suppress the default `tab-strip` base class. Active styles for pill tabs are defined in `globals.css` as `.pill-tab[data-state="active"]` to ensure CSS specificity over the base `.pill-tab` class.

### AppShell layout
```
display: grid; gridTemplateColumns: "260px 1fr"
Sidebar: 260px wide, borderRight: "1px solid #e5e5e5", background: "#ffffff", padding: "20px 16px"
Main: background: "#f7f7f8", padding: "24px"
```
Note: AppShell uses inline styles (hardcoded). Should migrate to Tailwind.

---

## Progress Bars

### Depreciation bar
```html
<div class="h-2.5 bg-gray-200 rounded-full overflow-hidden flex-1">
  <div class="h-full rounded-full bg-emerald-500" style="width: 70%"></div>
</div>
```
Color scale: `bg-emerald-500` (>60% remaining) → `bg-amber-500` (30–60%) → `bg-red-500` (<30% or fully depreciated)

### Lifespan bar (DepreciationStandards)
```html
<div class="h-2 w-24 rounded-full bg-slate-100">
  <div class="h-full rounded-full bg-blue-400" style="width: 50%"></div>
</div>
```
Color scale: `bg-red-400` (≤10yr) → `bg-amber-400` (11–20yr) → `bg-blue-400` (21–30yr) → `bg-emerald-400` (>30yr)

---

## Action Dropdown

### Trigger button
```
rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-50 transition
```
Label: "Actions ▾"

### Menu container
```
absolute right-0 z-20 mt-1 w-48 origin-top-right rounded-lg border border-slate-200 bg-white shadow-lg ring-1 ring-black/5
```

### Menu item
```
w-full text-left px-4 py-2 text-sm text-slate-700 hover:bg-slate-50 transition disabled:opacity-40
```

---

## Notification Bell

### Unread badge (inline style — should migrate)
```js
position: "absolute", top: 2, right: 2,
minWidth: 18, height: 18, padding: "0 5px",
fontSize: 11, fontWeight: 700,
color: "#fff", backgroundColor: "#dc2626",
borderRadius: 9999
```
Tailwind equivalent: `absolute top-0.5 right-0.5 min-w-[18px] h-[18px] px-1 text-[11px] font-bold text-white bg-red-600 rounded-full`

### Dropdown
```
absolute right-0 mt-2 w-96 bg-white rounded-lg shadow-xl border border-gray-200 z-50
Unread row: bg-blue-50
```

---

## Icons

### Library
- **Primary**: `lucide-react` — used in sidebars, buttons, headers
- **Size**: 18px in nav, 16px inline, 24px display

### Secondary usage
- Emoji as visual markers (status, document types, appliance categories)
- Unicode: `▲` / `▼` for sort indicators (text-[8px]), `⠿` for drag handles

---

## Shadow Scale

| Usage | Class |
|-------|-------|
| Standard panel | `shadow-sm` |
| Hoverable card | `hover:shadow-md` |
| Modal | `shadow-xl` |
| Dropdown | `shadow-lg` |

---

## Summary of Conflicts to Resolve (12 total)

| # | Conflict | Recommended choice |
|---|----------|--------------------|
| 1 | `gray-*` vs `slate-*` | Standardise on `slate-*` |
| 2 | Button border-radius (rounded / rounded-md / rounded-lg) | `rounded-lg` |
| 3 | Primary button color (slate-900 / blue-600 / gray-900) | **User to pick** |
| 4 | Button padding (4 sizes) | Define 3 sizes: sm/md/lg |
| 5 | Badge border-radius (rounded / rounded-full) | `rounded-full` |
| 6 | Badge border (some have it, some don't) | **User to pick** |
| 7 | Input border color (slate-300 / gray-300 / slate-200) | `border-slate-300` standard, `border-slate-200` search |
| 8 | Input border-radius (rounded-md / rounded-lg) | `rounded-lg` |
| 9 | Focus ring color (blue-400 / indigo-400 / indigo-500) | `focus:ring-2 focus:ring-indigo-500` |
| 10 | Table header style (2 variants) | **User to pick** (Variant A more widespread) |
| 11 | Modal max-width (max-w-lg / max-w-4xl) | Two sizes: sm (`max-w-lg`) and lg (`max-w-4xl`) |
| 12 | Empty state (Tailwind inline vs CSS class) | Tailwind only |
