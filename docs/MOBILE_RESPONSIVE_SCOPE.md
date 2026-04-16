# Mobile Responsive Experience — Implementation Scope

> **v1 — 2026-04-16.** Initial scope based on full codebase audit of `apps/web`. Covers
> all pattern replacements, new shared components, per-page work, and phased delivery plan.
>
> See §10 (Implementation phases) and §11 (Acceptance criteria) — read those first if you
> are deciding whether/when to start.

---

## Goal

Replace desktop-only patterns (wide tables, fixed sidebars, overflow popovers) with
mobile-native equivalents across all roles. The approach is **parallel render paths**:
each heavy component detects the viewport and renders a purpose-built mobile layout rather
than squeezing the desktop layout into a smaller box. No feature is removed on mobile — the
full functionality remains, presented through a different visual contract.

Target: fully usable on a 390px-wide phone (iPhone 15 baseline) for all primary workflows
of every user role (Manager, Owner, Contractor, Tenant).

---

## 0. Current State (read before §2)

The following facts about the existing codebase are directly relevant and must inform
every implementation decision.

| Fact | Impact on mobile work |
|---|---|
| Next.js Pages Router (not App Router) | No RSC / server components — all breakpoint logic is client-side |
| Tailwind CSS v4 with `@theme` tokens | Use existing design tokens; no new color/spacing primitives needed |
| Sidebar hidden at `lg` (1024px) with no replacement | Mobile users have zero navigation right now |
| `ConfigurableTable` has column toggle, drag-reorder, density — desktop only | Must be preserved on desktop; mobile gets a separate card render path |
| `DataTable` wraps with `overflow-x-auto` only | Forces horizontal scroll — not acceptable as a mobile experience |
| Tab strips use `whitespace-nowrap` without scroll container | Overflow on narrow screens today |
| Popovers use `absolute right-0 top-full w-64` | Clips on phones narrower than ~290px; 256px popover width approaches full screen |
| Modals use `max-w-[90vw] max-h-[90vh]` — adequate but not mobile-optimised | Replace with bottom sheets below `sm` |
| `filter-row` class uses `flex gap-3 flex-wrap` | Wraps acceptably — one of the few patterns that degrades well already |
| `apply.js` uses drag-drop document upload | Touch devices need tap-to-browse fallback |

**Architecture invariant:** All new shared components go in `apps/web/components/mobile/`
or alongside the component they replace (e.g. `MobileCardList` next to `DataTable`).
Pages detect mobile via the shared `useIsMobile()` hook and switch render paths explicitly
— not through CSS visibility hacks. Both render paths coexist in the same page file; no
new routes are added.

---

## 1. Product scope

### 1.1 In scope

* Mobile navigation for all four roles (Manager, Owner, Contractor, Tenant)
* Card-list replacement for all data tables across all roles
* Bottom-sheet replacement for popovers and overlays
* Scrollable tab strips replacing fixed-width tab bars
* Accordion/summary sections for financial reporting and dashboards
* Touch-friendly form layouts including the rental application wizard
* Mobile-optimised modals (bottom sheet pattern)
* Viewport meta tag verification and `useIsMobile()` shared hook

### 1.2 Out of scope

* New features not currently on desktop (e.g. push notifications, native app gestures)
* Backend API changes — mobile views consume the same endpoints
* Changes to desktop layouts — all existing desktop behaviour is preserved unchanged
* Offline support or PWA shell
* iOS/Android native apps
* Accessibility audit (related but separate workstream)
* Responsive email templates

### 1.3 Design principles

* Desktop gets the table; mobile gets the card list. One component, two render paths.
* The mobile render path is chosen once — at the page level via `useIsMobile()` — not scattered across individual sub-components.
* Never hide information on mobile. Collapse, paginate, or reorganise — do not omit.
* Touch targets are minimum 44×44px (Apple HIG). Compact density on desktop does not carry over to mobile.
* Navigation is always visible and reachable in one tap. No hamburger-only patterns.

---

## 2. Mobile breakpoint contract

The single detection boundary is **768px** (`md` in Tailwind).

```ts
// apps/web/hooks/useIsMobile.ts
import { useEffect, useState } from 'react';

export function useIsMobile(): boolean {
  const [isMobile, setIsMobile] = useState(false);
  useEffect(() => {
    const mql = window.matchMedia('(max-width: 767px)');
    setIsMobile(mql.matches);
    const handler = (e: MediaQueryListEvent) => setIsMobile(e.matches);
    mql.addEventListener('change', handler);
    return () => mql.removeEventListener('change', handler);
  }, []);
  return isMobile;
}
```

Pages and layout components import this hook and branch:

```jsx
const isMobile = useIsMobile();
return isMobile ? <MobileView ... /> : <DesktopView ... />;
```

CSS responsive utilities (`sm:`, `md:`, `lg:`) remain valid for padding, typography,
and spacing adjustments. The hook is reserved for structural/component switches only.

---

## 3. New shared components required

These are net-new components that do not currently exist. They are the building blocks
used across multiple pages.

### 3.1 `BottomNav` — replaces all role sidebars on mobile

A fixed bottom navigation bar with 4–5 icon+label tabs per role. Sits above the iOS home
indicator (`pb-safe` / `env(safe-area-inset-bottom)`). Renders only below `md`.

```
apps/web/components/mobile/BottomNav.jsx
```

Props:
```ts
interface BottomNavProps {
  items: Array<{
    href: string;
    icon: ReactNode;
    label: string;
    badge?: number;       // for notification counts
  }>;
  moreItems?: Array<{    // items that don't fit in 5 slots → "More" drawer
    href: string;
    icon: ReactNode;
    label: string;
  }>;
}
```

**Per-role navigation sets:**

| Role | Primary tabs (5) | Overflow drawer |
|---|---|---|
| Manager | Dashboard, Requests, Inventory, Finances, People | Cashflow, Leases, Settings |
| Owner | Dashboard, Approvals, Jobs, Invoices, Strategy | Vacancies, Reporting, Settings |
| Contractor | Jobs, RFPs, Invoices, Profile | — |
| Tenant | My Requests, Lease, Documents, — | — |

The "More" tap opens a `NavDrawer` (§3.2) listing overflow items.

### 3.2 `NavDrawer` — slide-up overlay for overflow navigation items

A bottom sheet (see §3.3) pre-configured for navigation. Triggered by the "More" tab in
`BottomNav`. Lists overflow items from `moreItems` as full-width tappable rows with icon
and label. Auto-closes on navigation.

```
apps/web/components/mobile/NavDrawer.jsx
```

### 3.3 `BottomSheet` — replaces popovers and detail overlays on mobile

Slides up from the bottom. Covers 50–90% of screen height. Has a drag handle and closes
on backdrop tap or drag-down. Used for: column config (ConfigurableTable), document
previews, action menus, inline edit panels.

```
apps/web/components/mobile/BottomSheet.jsx
```

Props:
```ts
interface BottomSheetProps {
  open: boolean;
  onClose: () => void;
  title?: string;
  children: ReactNode;
  snapPoints?: ('half' | 'full');  // default 'half'
}
```

### 3.4 `MobileCardList` — replaces all data tables on mobile

Renders a vertically stacked list of cards, one per data row. Each card shows a curated
subset of columns (defined per-usage via `renderCard` prop). A "View details" tap expands
the card inline or navigates to the detail page.

```
apps/web/components/mobile/MobileCardList.jsx
```

Props:
```ts
interface MobileCardListProps<T> {
  data: T[];
  renderCard: (row: T) => ReactNode;       // what to show in collapsed card
  renderExpanded?: (row: T) => ReactNode;  // inline expansion; if omitted, no expansion
  onRowClick?: (row: T) => void;           // navigate to detail page
  keyExtractor: (row: T) => string;
  emptyState?: ReactNode;
  pagination?: ReactNode;                  // pass existing PaginationControls
}
```

### 3.5 `ScrollableTabs` — replaces fixed tab strips on mobile

Wraps the existing `.tab-strip` pattern in a horizontally scrollable container with
`overflow-x-auto scrollbar-none`. Active tab is scrolled into view on mount and on change.
On desktop this component is a transparent pass-through — same visual output as the
current implementation.

```
apps/web/components/mobile/ScrollableTabs.jsx
```

### 3.6 `AccordionSection` — collapsible content block for dashboards and reporting

A section with a header that collapses/expands its children. On desktop it is always
expanded and the toggle is hidden. On mobile it starts collapsed except for the first
section. Used to break dense dashboard and reporting pages into manageable sections.

```
apps/web/components/mobile/AccordionSection.jsx
```

Props:
```ts
interface AccordionSectionProps {
  title: string;
  badge?: string;             // e.g. "3 items" shown in collapsed header
  defaultOpen?: boolean;
  forceOpen?: boolean;        // when true, acts like a plain section (desktop)
  children: ReactNode;
}
```

---

## 4. Layout and navigation changes

### 4.1 `AppShell` — add mobile nav layer

`AppShell` currently renders the role-specific sidebar. On mobile it must also render
`BottomNav` and reserve `pb-20` (or `pb-safe`) bottom padding so content is not obscured.

Changes required:
- Import `useIsMobile` hook
- Below `md`: render `BottomNav` with role-appropriate items; suppress sidebar render
- Above `md`: existing sidebar behaviour unchanged
- Add `pb-20 md:pb-0` to the page content wrapper when `isMobile` is true
- File: `apps/web/components/AppShell.js`

### 4.2 `SidebarLayout` — preserve desktop-only

`SidebarLayout` uses `lg:grid-cols-[260px_minmax(0,1fr)]`. This is correct — the grid
already collapses to single column below `lg`. **No change needed here.** The sidebar
is the component that must be conditionally suppressed (done in AppShell §4.1), not
the layout wrapper.

### 4.3 `PageShell` — add bottom safe area padding

Add `pb-safe` class (or inline `paddingBottom: 'env(safe-area-inset-bottom)'`) to the
outermost wrapper so content clears the iOS home indicator when `BottomNav` is present.

---

## 5. Component-by-component mobile treatment

### 5.1 `ConfigurableTable` — column config as BottomSheet

The desktop `ConfigurableTable` is preserved unchanged. On mobile:
- The gear icon opens a `BottomSheet` instead of the `absolute` popover
- Inside the sheet: column visibility toggles rendered as toggle-switch rows (44px height each)
- Drag-to-reorder is **deferred to Phase 5** — touch drag on mobile is complex; column order
  on mobile is managed by the `renderCard` definition, not column reorder
- Density toggle is removed on mobile (cards have their own density)
- The table itself is not rendered on mobile — `MobileCardList` with a `renderCard` specific
  to the calling page replaces it entirely

### 5.2 `DataTable` — direct swap via `MobileCardList`

`DataTable` is used for simpler table cases. On mobile, pages that use `DataTable` switch
to `MobileCardList`. The `DataTable` component itself gets no changes — the calling page
branches on `useIsMobile()`.

### 5.3 Tab strips (`.tab-strip` class)

All tab strips — in manager dashboard, requests page, inventory, settings, and owner
dashboard — are wrapped in `ScrollableTabs` (§3.5). This is a global find-and-replace
across the affected pages. The `.tab-strip` CSS class in `globals.css` gets `overflow-x-auto
scrollbar-none` added so it scrolls horizontally on mobile even when used raw.

Global change in `globals.css`:
```css
.tab-strip {
  /* existing: flex border-b border-slate-200 mb-5 */
  overflow-x: auto;
  scrollbar-width: none;         /* Firefox */
  -ms-overflow-style: none;      /* IE/Edge */
}
.tab-strip::-webkit-scrollbar { display: none; }
```

### 5.4 Popovers → `BottomSheet`

Any component using `absolute right-0 top-full` positioning for an overlay becomes a
`BottomSheet` on mobile. Affected components:
- `ConfigurableTable` → `ColumnConfigPopover` (§5.1)
- Any inline action menus or filter dropdowns found during page-level work

Detection: wrap the toggle in `isMobile ? <BottomSheet> : <Popover>`.

### 5.5 Modals → full-width bottom sheet

Current modals use `max-w-[90vw]` centered overlays. On mobile these are replaced by
`BottomSheet` with `snapPoints="full"` — the content slides up from the bottom and takes
full height. The backdrop and close behaviour are identical.

Affected: `DocumentsPanel` (currently `fixed inset-0 z-50`), any future modals.

### 5.6 Link cards (`.link-card`, flex justify-between rows)

These are used extensively in manager and owner dashboards for action items. On mobile,
when content is long, the right-side badge/action (`ml-6 shrink-0`) can get squeezed.

Fix: add `flex-wrap` or a `min-w-0` constraint on the left text area. This is a CSS-only
fix, not a structural replacement. Applied globally in `.globals.css`:
```css
/* existing .link-card has: flex items-center justify-between */
/* add: */
.link-card > :first-child { min-width: 0; }
```

---

## 6. Page-by-page mobile work

### 6.1 `pages/manager/requests.js` — CRITICAL (54KB, 10+ column table)

This is the highest-complexity page in the codebase.

**Desktop:** `ConfigurableTable` with columns: #, Status, Building/Unit, Category,
Description, Urgency, Contractor, Est. Cost, Next Approver, Paying Party, Actions.

**Mobile card design:**
```
┌─────────────────────────────────────┐
│ REQ-042          [Urgent] [Pending] │
│ 14 Rue de Rive · Apt 3B             │
│ Plumbing — Water damage in bathroom │
│ Est. CHF 1,200 · Müller AG          │
│                        [Review →]   │
└─────────────────────────────────────┘
```
Card shows: request number, status pill, urgency badge, building + unit, category + short
description, estimated cost, contractor name. "Review →" navigates to the request detail
page (which itself needs a mobile pass — see §6.6).

Status tabs (Overview, Pending Review, Owner Approval, RFP Open, Auto-Approved, Active,
Completed, RFPs) → wrapped in `ScrollableTabs`.

Filter row (search, status, urgency, contractor dropdowns) → stacked vertically as full-width
inputs on mobile using the existing `.filter-row` flex-wrap behaviour (already adequate).

### 6.2 `pages/manager/inventory.js` — HIGH (23KB, 4 tabs, nested tables)

Four tabs: Buildings, Vacancies, Assets, Maintenance Decisions (+ Depreciation sub-panel).

**Buildings tab mobile card:**
```
┌─────────────────────────────────────┐
│ Rue de Rive 14                      │
│ Geneva · 12 units                   │
│ Residential · Good condition        │
│                      [Open →]       │
└─────────────────────────────────────┘
```

**Assets tab mobile card:** Asset name, category, manufacturer, useful life remaining
(as a progress bar or "X yrs left"), replacement cost.

**Depreciation Standards** — dense table with Scope, Useful Life, Replacement Cost columns
→ `MobileCardList` with each row showing scope name + useful life + cost on three lines.

**Maintenance Decisions** — same card-list treatment.

### 6.3 `pages/owner/reporting.js` — HIGH (33KB, timeline + financial grid)

The month strip navigation (`overflow-x-auto, scrollbar-none`) already works on mobile.

Financial sections (currently a dense grid of line items per month) →  `AccordionSection`
per reporting category. Each section shows its total in the header when collapsed:
```
┌─────────────────────────────────────┐
│ ▶ Operating Expenses    CHF 4,230   │
├─────────────────────────────────────┤
│ ▼ Capital Expenditures  CHF 18,400  │
│   Roof repair ··· CHF 12,000        │
│   HVAC replacement ·· CHF 6,400     │
└─────────────────────────────────────┘
```

Year/month navigation header stays sticky at top (existing behaviour is already adequate).
"Show X more" buttons within expanded sections are preserved.

### 6.4 `pages/manager/index.js` — MEDIUM (23KB, dashboard)

**KPI cards:** Currently a flex/grid row of metric cards. On mobile: horizontally
swipeable row of KPI cards (use `overflow-x-auto snap-x snap-mandatory` — no JS needed).

**Action Items tabs:** 5 tabs → `ScrollableTabs`. Each tab's content is a list of link
cards (§5.6) — these already stack vertically and are adequate on mobile with the
link-card fix applied.

**Health indicators** (traffic-light dots per building): rendered as a vertical list
on mobile instead of a grid row. One building per row with its health dots.

### 6.5 `pages/owner/index.js` — MEDIUM (20KB, dashboard)

Same pattern as manager dashboard. Tab strip → `ScrollableTabs`. Link card action items
→ link-card fix applied. Financial summary KPIs → horizontally swipeable card row.

### 6.6 Request detail page (manager and owner views)

The detail page for a single request is accessed from the card list. It must be audited
and made mobile-friendly as part of Phase 3 (since it is the landing point from the
mobile card tap). Specific issues:
- Side-by-side layout of request info + timeline → single column stack on mobile
- Inline editing forms → full-width inputs
- Document attachments panel → bottom sheet (§5.5)
- Contractor picker → bottom sheet selection overlay

### 6.7 `pages/owner/invoices.js` — MEDIUM (18KB)

Invoice list → `MobileCardList`. Each card: invoice number, building, amount, due date,
status pill. Tap → full invoice detail (already a separate view or expandable).

Invoice detail view: two-column layout → single-column stack. Line item table →
`MobileCardList` with item name, quantity, unit price, total per card.

### 6.8 `pages/owner/approvals.js` — MEDIUM (18KB)

Approval request list → `MobileCardList`. Card: request title, building, urgency, estimated
cost, requested contractor, approve/reject actions as two full-width buttons at card bottom.

Inline approve/reject actions must be touch-target compliant (minimum 44px height).

### 6.9 `pages/owner/jobs.js` — MEDIUM (13KB)

Job list → `MobileCardList`. Card: job reference, contractor, status, scheduled date,
building. Tap → detail view (single-column layout).

### 6.10 `pages/owner/strategy.js` — LOW (existing page, mostly forms)

Strategy questionnaire: already single-column radio button screens — adequate on mobile.
Strategy display screen and building setup screen: single-column layouts — verify padding
and touch targets but no structural change needed.

### 6.11 `pages/apply.js` — HIGH (60KB, 3-step wizard + document upload)

**Step indicator:** 3-step horizontal stepper → verify it does not overflow on 390px.
Condense labels if needed ("1. Property" / "2. Details" / "3. Review").

**Step 1 — Unit selection + documents:**
- Unit grid (already `grid-cols-1 md:grid-cols-2`) — adequate
- Document upload: drag-drop zone is unusable on touch. Replace with:
  ```jsx
  <input type="file" multiple accept="..." />
  ```
  styled as a tappable button on mobile. The drag-drop zone is kept on desktop.

**Step 2 — Applicant details:**
- Multi-column form rows → single column on mobile. Any `grid grid-cols-2` collapses
  to `grid-cols-1` below `md`.

**Step 3 — Review + signature:**
- Review summary: stacked list — already adequate
- Signature pad: verify canvas sizing on mobile. Set `width: 100%` on the container.

### 6.12 `pages/manager/settings.js` — LOW (33KB, forms + tables)

5 tabs → `ScrollableTabs`. Building list table → `MobileCardList`. Form sections (org
info, notification preferences, integrations) are already single-column — verify input
sizing and button placement. Legal sources CRUD table → `MobileCardList`.

### 6.13 Finance pages (`pages/manager/finance/*`) — MEDIUM

Ledger, billing entities, and invoice pages follow the same pattern as §6.7. Audit each
page and apply `MobileCardList` for any table, `ScrollableTabs` for any tab strip, and
link-card fix for any flex justify-between row.

### 6.14 Contractor pages — LOW

`pages/contractor/rfps.js` and related pages: the contractor role has fewer data-dense
surfaces. RFP list → `MobileCardList`. The existing `grid grid-cols-2 sm:grid-cols-4`
patterns on the contractor index are already adequate.

### 6.15 Tenant pages — LOW

Tenant pages already use responsive grid patterns (`grid-cols-1 md:grid-cols-2`).
Verify tab strips and form layouts but no structural replacement expected.

---

## 7. Global CSS changes

All changes are additions to existing rules — nothing in `globals.css` is removed.

```css
/* Tab strip: horizontal scroll on mobile */
.tab-strip {
  overflow-x: auto;
  scrollbar-width: none;
  -ms-overflow-style: none;
}
.tab-strip::-webkit-scrollbar { display: none; }

/* Link card: prevent left content from overflowing */
.link-card > *:first-child { min-width: 0; }

/* Bottom safe area for pages with BottomNav */
.has-bottom-nav {
  padding-bottom: calc(5rem + env(safe-area-inset-bottom));
}
```

Viewport meta tag: verify `_document.js` or `_app.js` includes:
```html
<meta name="viewport" content="width=device-width, initial-scale=1" />
```
This is likely present via Next.js defaults but must be confirmed.

---

## 8. New file structure

```txt
apps/web/
  hooks/
    useIsMobile.ts                (new — shared detection hook)
  components/
    mobile/
      BottomNav.jsx               (new — §3.1)
      NavDrawer.jsx               (new — §3.2)
      BottomSheet.jsx             (new — §3.3)
      MobileCardList.jsx          (new — §3.4)
      ScrollableTabs.jsx          (new — §3.5)
      AccordionSection.jsx        (new — §3.6)
      index.js                    (new — barrel export)
```

No new pages or API routes. No backend changes.

---

## 9. What is NOT changing

* All desktop layouts — preserved exactly as they are today
* All API endpoints and data shapes
* The `ConfigurableTable` desktop feature set (column toggle, drag-reorder, density)
* Existing Tailwind responsive utilities (`sm:`, `md:`, `lg:`) used for padding/typography
* Any existing component that already degrades acceptably (contractor index grids, tenant pages)

---

## 10. Implementation phases

> **Sequencing note:** Phases 1–2 are prerequisites for all subsequent phases. A page-level
> mobile pass (Phase 3+) is not possible without the navigation and shared components in place.
> Phases 3–6 can be parallelised across roles once Phase 2 is complete.

### Phase 1 — Foundation

* `useIsMobile()` hook
* `BottomSheet` component
* `ScrollableTabs` component
* `AccordionSection` component
* Global CSS additions (§7)
* Viewport meta tag verification

**Deliverable:** Shared primitives are in place. No visible change for users yet.

### Phase 2 — Navigation

* `BottomNav` component with items for all four roles
* `NavDrawer` component for overflow items
* `AppShell` wiring: `isMobile` → render `BottomNav`, suppress sidebar, add `pb-20`
* `PageShell` bottom safe area padding

**Deliverable:** Mobile users can navigate between all sections. This is the highest-impact
change — nothing else matters if navigation is broken.

### Phase 3 — Data tables (Manager role)

* `MobileCardList` component
* `pages/manager/requests.js` — card list + scrollable tabs + bottom sheet column config
* `pages/manager/inventory.js` — card list per tab, nested depreciation table
* Request detail page mobile layout (single-column, bottom sheet for documents)

**Deliverable:** The manager's two heaviest pages are fully usable on a phone.

### Phase 4 — Dashboards and reporting

* `pages/manager/index.js` — swipeable KPI cards, scrollable action tabs
* `pages/owner/index.js` — same pattern
* `pages/owner/reporting.js` — accordion sections, preserved month strip
* `pages/owner/strategy.js` — verify only; likely adequate
* `pages/manager/settings.js` — scrollable tabs, card lists

**Deliverable:** Dashboards and reporting are usable on mobile.

### Phase 5 — Owner role data pages + apply wizard

* `pages/owner/approvals.js`
* `pages/owner/invoices.js`
* `pages/owner/jobs.js`
* `pages/apply.js` — document upload tap-to-browse, single-column form steps, signature pad

**Deliverable:** Owner-facing pages complete. Public rental application usable on phone.

### Phase 6 — Finance and remaining pages

* `pages/manager/finance/*` — all finance sub-pages
* `pages/contractor/rfps.js` and related contractor pages
* Tenant pages — verify and fix any remaining issues
* Link-card global fix applied and verified across all pages
* End-to-end pass on all roles at 390px

**Deliverable:** All roles fully functional on mobile. Ready for QA.

---

## 11. Acceptance criteria

A mobile implementation is complete when:

* A Manager can view, filter, and open any request from a 390px phone without horizontal scroll
* A Manager can navigate between Dashboard, Requests, Inventory, and Finances in one tap each
* An Owner can approve a request, view an invoice, and access reporting from a phone
* A Tenant can submit a maintenance request and view their lease from a phone
* A Contractor can view and respond to RFPs from a phone
* The rental application wizard (`/apply`) is completable end-to-end on a phone including document upload
* No primary action is reachable only via horizontal scroll
* All touch targets are ≥ 44×44px
* Bottom navigation is visible and functional in all role portals at < 768px
* Desktop layouts at ≥ 768px are pixel-identical to the current implementation

---

## 12. Non-functional requirements

* `useIsMobile()` must not cause hydration mismatches — initial SSR render returns `false`; hook updates after mount
* `BottomSheet` open/close must animate at 60fps — use `transform: translateY` not `height`
* `MobileCardList` must not re-render on scroll — cards are not virtualised in v1 (acceptable for current data volumes); revisit if lists exceed ~200 items
* No new dependencies — all new components use React, Tailwind, and lucide-react (already installed)
* `BottomNav` uses `position: fixed` — verify it does not conflict with existing fixed elements (`UndoToast` at bottom, any `sticky` headers)
* `UndoToast` bottom offset must be increased by the BottomNav height (`5rem`) when on mobile

---

## 13. Testing guidance

### Per-component

* `BottomSheet` — open/close, drag-down dismiss, backdrop tap dismiss, snap points
* `MobileCardList` — empty state, pagination passthrough, expand/collapse if used
* `BottomNav` — active state correct per route, badge count, overflow drawer opens
* `ScrollableTabs` — active tab scrolls into view, tab change fires correctly

### Per-page (manual QA on device or 390px devtools)

* Requests page: can see all requests, filter, open detail
* Inventory page: can browse all four tabs, open a building detail
* Reporting page: can navigate months, expand/collapse sections
* Apply wizard: all 3 steps, document upload, signature
* Settings: all 5 tabs, can add/edit a building or legal source

### Regression

* At 1280px (desktop): take screenshots before and after each phase, confirm no layout change
* At 390px: confirm no horizontal overflow on any page (use Chrome devtools overflow highlight)

---

## 14. Success indicators

These are observable without instrumentation — useful for the first manual review after
each phase.

| Indicator | How to verify |
|---|---|
| Navigation reachable on phone | Load any role portal at 390px; confirm BottomNav visible with correct items |
| No table forces horizontal scroll | Requests page at 390px — no horizontal scrollbar on the table area |
| Reporting is scannable | Reporting page at 390px — sections collapsed, totals visible without scrolling past first screen |
| Apply wizard completable | Go through all 3 steps at 390px without layout breaks or inaccessible inputs |
| Desktop unchanged | Screenshot comparison at 1280px before/after each phase |
