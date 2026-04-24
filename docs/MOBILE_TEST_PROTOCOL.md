# Front-End Mobile Test Protocol — Owner Surface
> Target viewport: 390 × 844 px (iPhone 14). Browser DevTools device emulation.
> All pages are under the `OWNER` role.
>
> **Updated 2026-04-23:** Test cases A2/A3, WR2, P2/P3 revised to reflect dual-render
> pattern (card lists replace horizontal-scroll tables on mobile). New section §12 added
> for ScrollableTabs "More" overflow. New §13 for role isolation on shared pages.
> Dev server now binds `0.0.0.0` — accessible from mobile phones on the same network.

---

## Setup

1. Open browser DevTools → Responsive mode.
2. Set viewport to **390 × 844** (portrait).
3. Log in as an owner account with at least one building, unit, request, job, and invoice.
4. Disable cache (Network → Disable cache).

---

## Global checks (apply to every page)

| # | Check | Pass criteria |
|---|-------|---------------|
| G1 | Sidebar is hidden | No left column visible at 390 px |
| G2 | BottomNav is visible | 4–5 icon tabs + labels fixed at bottom |
| G3 | Page content is not clipped behind BottomNav | Scroll to bottom — last item fully visible above nav bar |
| G4 | UndoToast position | If triggered, toast appears above BottomNav, not behind it |
| G5 | Safe-area padding (iOS) | No content hidden by home indicator notch (test in Safari or emulated safe area) |

---

## Page-by-page checks

### 1. Dashboard — `/owner`

| # | Check | Pass criteria |
|---|-------|---------------|
| D1 | Action items tab strip scrolls | Swipe/drag the tab strip left-right; active tab scrolls into view on change |
| D2 | Summary cards stack vertically | Cards are full-width, not side-by-side |
| D3 | No horizontal overflow | No scrollbar on `<body>`; content fits within 390 px |

---

### 2. Approvals — `/owner/approvals`

| # | Check | Pass criteria |
|---|-------|---------------|
| A1 | Tab strip (Requests / Quotes) scrolls | Both tabs visible; active scrolls into view |
| A2 | Pending approval — card list renders | Rows shown as cards (category, building, cost, status badge); NO horizontal scroll |
| A3 | History — card list renders | Same card pattern; no horizontal table visible on mobile |
| A4 | No content clipped left edge | Row text not cut off by padding |
| A5 | Desktop: full tables visible | At ≥ 640 px both tables render as full tables (not card list) |

---

### 3. Work Requests — `/owner/work-requests`

| # | Check | Pass criteria |
|---|-------|---------------|
| WR1 | 7-tab strip — "More" overflow | At 390 px, visible tabs + "More ▾" button appear; tapping "More" opens a bottom sheet listing hidden tabs |
| WR2 | Request list — card list renders | Requests shown as cards (category, building/unit, status badge); NO horizontal table scroll |
| WR3 | Badge counts visible | Count pills on tabs show correctly after data loads |
| WR4 | Empty state renders | Switch to a tab with 0 results — empty state message is full-width and readable |
| WR5 | Desktop: full table visible | At ≥ 640 px table renders normally (all columns visible, no card list) |

---

### 4. Request Detail — `/owner/requests/[id]`

| # | Check | Pass criteria |
|---|-------|---------------|
| RD1 | Status pipeline fits | 5- or 6-stage pipeline rendered in a single row; labels don't overlap or clip outside viewport |
| RD2 | Owner CTAs are tappable | Reject (left) / Approve (right) buttons ≥ 44 px height, same row, not cropped — destructive always on the left |
| RD3 | Details panel — single column | Building/unit/description in 1 column (md:grid-cols-3 collapses) |
| RD4 | Two-column layout collapses | Asset Recommendation, Photos, Legal Analysis stacked above Tenant/Contractor cards |
| RD5 | Asset recommendation grid | `grid-cols-2` cost comparison row readable at 390 px |

---

## Mobile Card Design Guidelines

Apply these rules to every card/panel that surfaces actions or multi-section content.

### Section spacing — `.card-section`
- Use the `card-section` CSS class on every content section inside a Panel that needs a visual separator from the one above.
- Renders `border-t border-slate-100` + `pt-8 mt-6` on mobile, `pt-10 mt-8` on `sm+`.
- Never hand-roll `border-t pt-4 mt-4` inline — always use `.card-section`.

### Intra-section spacing
- Between a contextual reason sentence and the data fields it introduces, use `pt-4` (not `pt-1`) to create breathing room for scan-reading.

### Dual-action button pair (confirm vs. destructive)
1. **Order:** destructive / cancel action **left**, confirm / primary action **right** (mirrors native mobile Cancel | OK convention).
2. **Width:** `flex flex-1` on each button — equal halves, no wrapping (`flex`, never `flex-wrap`).
3. **Tap target:** minimum `py-2.5` (≥ 44 px rendered height).
4. **Labels:** keep short and scannable (e.g. "✗ Reject" / "✓ Approve") — no full-sentence labels on mobile.

### Data-chip row (labelled fields inside a card)
When a card surfaces 2–4 labelled data chips side by side (e.g. contractor name, quote amount, tender link):
- **Mobile** (`<sm`): `flex flex-wrap gap-x-6 gap-y-2` — chips cluster left, wrap naturally when they don't all fit.
- **Desktop** (`sm+`): add `sm:justify-between` — chips spread to fill the full card width, using available horizontal space evenly.
- Pattern: `className="flex flex-wrap gap-x-6 gap-y-2 sm:justify-between"`
- Do **not** use a fixed gap or grid on desktop — `justify-between` distributes space regardless of chip count.

### Approval / context reason text
- Use a single short clause, not a full paragraph (e.g. "Quoted amount exceeds the auto-approval limit for this building.").
- Place it immediately below the section heading, before the data fields.

---

### 5. Jobs — `/owner/jobs`

| # | Check | Pass criteria |
|---|-------|---------------|
| J1 | Filter bar wraps cleanly | Status / From / To / Building / Unit / Urgency dropdowns wrap to next line, no overflow |
| J2 | Job row header stacks | Category + badge on row 1; urgency + cost + date + chevron on row 2 |
| J3 | Long category names truncate | `truncate` applied — ellipsis shown, not horizontal overflow |
| J4 | Expanded detail readable | Location / Tenant / Contractor cards in 1-column grid (sm:grid-cols-3 collapses) |

---

### 6. Finance (Invoices) — `/owner/finance`

| # | Check | Pass criteria |
|---|-------|---------------|
| F1 | Filter bar wraps | Status + From + To date pickers wrap without overflow |
| F2 | Invoice row header stacks | Invoice# + date + amount on row 1; badge + chevron on row 2, right-aligned |
| F3 | Expanded action buttons wrap | View PDF / View QR / Approve / Dispute buttons wrap to next line, all tappable (≥ 44 px) |

---

### 7. Invoices — `/owner/invoices`

| # | Check | Pass criteria |
|---|-------|---------------|
| I1 | Invoice row header stacks | Title + date on row 1; amount + badge + actions + chevron on row 2 |
| I2 | Action row wraps | Inline action buttons (Download, Approve, Dispute) wrap and remain tappable |

---

### 8. Reporting — `/owner/reporting`

| # | Check | Pass criteria |
|---|-------|---------------|
| R1 | Month strip scrolls | Drag month buttons left — all 12 months reachable; active month scrolls into view |
| R2 | No duplicate scrollbar rendering | Single scrollable strip, not doubled |
| R3 | KPI cards grid | 2-column grid at ≥ 640 px, 1-column at 390 px (confirm sm:grid-cols-2) |
| R4 | Hero section stacks | Cashflow hero is single-column (lg:flex-row collapses to flex-col) |
| R5 | BuildingRow income/expenses | Hidden on small screens (`hidden sm:block`) — only building name and net visible at 390 px |
| R6 | Occupancy grid | 1-column at 390 px, 2-column at ≥ 640 px |

---

### 9. Properties — `/owner/properties`

| # | Check | Pass criteria |
|---|-------|---------------|
| P1 | Buildings / Vacancies tab strip | ScrollableTabs renders; active tab highlighted |
| P2 | Buildings — card list renders | At 390 px: each building shown as a card (name, address, unit count, status badge); NO horizontal table scroll; tapping a card navigates to building detail |
| P3 | Vacancies tab — card list renders | VacanciesPanel shows vacancy cards (building, unit, CHF total, "Fill →" button); awaiting-signature section shows cards; NO horizontal scroll |
| P4 | Building detail — role scoped | Navigating to a building from this page shows `AppShell role="OWNER"` (owner nav, not manager); tabs are: Building information, Units, Tenants, Assets — NOT Documents/Policies/Financials |
| P5 | Desktop: full tables visible | At ≥ 640 px buildings use ConfigurableTable; vacancies use desktop table |

---

### 10. Strategy — `/owner/strategy`

| # | Check | Pass criteria |
|---|-------|---------------|
| S1 | Questionnaire single-column | Steps render as a single-column wizard, no side-by-side layout |
| S2 | Radio options touch targets | Each radio option ≥ 44 px height |
| S3 | Building setup grid collapses | `grid-cols-1 sm:grid-cols-2` → 1 column at 390 px |

---

### 11. Billing Entities — `/owner/billing-entities`

| # | Check | Pass criteria |
|---|-------|---------------|
| BE1 | Page loads without layout shift | BillingEntityManager renders within the page shell |
| BE2 | No horizontal overflow | Content fits within 390 px |

---

## BottomNav "More" drawer

| # | Check | Pass criteria |
|---|-------|---------------|
| M1 | More button appears | If overflow items (Properties) defined, "More" tab appears in BottomNav |
| M2 | NavDrawer slides up | Tapping More opens a BottomSheet with overflow nav items |
| M3 | NavDrawer closes on link tap | Navigating via drawer closes it |
| M4 | Drag-to-close works | Dragging the drawer down > 80 px closes it |
| M5 | Escape closes drawer | Pressing Esc closes the NavDrawer |

---

## 12. ScrollableTabs "More" overflow — tab-level drawer

Applies to any page where the tab strip has more tabs than fit at 390 px (e.g. building
detail with 7 manager tabs, unit detail with 7 tabs, work-requests with 7 tabs).

| # | Check | Pass criteria |
|---|-------|---------------|
| ST1 | "More ▾" button appears | At 390 px, the last visible tab position shows "More ▾" when tabs overflow |
| ST2 | Overflow bottom sheet opens | Tapping "More ▾" slides up a BottomSheet titled "More" listing hidden tab names |
| ST3 | Selecting an overflow tab works | Tapping a tab name in the sheet switches to that tab and closes the sheet |
| ST4 | Active tab is always visible | Switch to a tab that would be in the overflow set — it is promoted to the visible strip, not hidden |
| ST5 | "More" button shows active style | When the active tab is in overflow, the "More ▾" button gets the active tab style |
| ST6 | Drag-to-close works | Dragging the sheet down > 80 px closes it |
| ST7 | Desktop: all tabs visible, no "More" | At ≥ 640 px (or when all tabs fit), "More ▾" does not appear — all tabs render inline |

---

## 13. Role isolation on shared pages

Covers `admin-inventory/buildings/[id]` and `admin-inventory/units/[id]` when accessed
from the owner surface (via `?role=owner` query param).

| # | Check | Pass criteria |
|---|-------|---------------|
| RI1 | AppShell shows owner nav | Navigating from `/owner/properties` → building detail shows owner BottomNav (not manager sidebar/nav) |
| RI2 | Building tabs scoped | Only 4 tabs visible: Building information, Units, Tenants, Assets — no Documents, Policies, Financials |
| RI3 | No Edit button | Building information tab has no Edit/Deactivate controls |
| RI4 | Back link goes to owner properties | Chevron/back button returns to `/owner/properties`, not `/manager/inventory` |
| RI5 | Unit links stay in owner scope | Tapping a unit from the building detail opens `admin-inventory/units/[id]?role=owner` |
| RI6 | Unit page — AppShell shows owner nav | Unit detail accessed from owner surface shows owner BottomNav |
| RI7 | Unit page — tenant name is plain text | Tenant name in unit detail is not a hyperlink (no navigation to manager tenant page) |
| RI8 | Unit page — no "Go to Leases" button | The "Go to Leases" manager link is absent in owner view |
| RI9 | Unit page — back link goes to building | Back link on unit detail goes to `admin-inventory/buildings/[id]?role=owner`, not manager inventory |

---

## Common failure patterns to watch for

- **Content behind BottomNav**: scroll to bottom; if last card is clipped, check `pb-24 md:pb-6` on `<main>`.
- **Horizontal body scroll**: check `document.documentElement.scrollWidth > 390` in console. Usually caused by a table rendered without dual-render: look for `<table>` or `ConfigurableTable` without a `hidden sm:block` wrapper on mobile.
- **Table visible on mobile instead of card list**: check that the card list has `sm:hidden` and the table wrapper has `hidden sm:block`. A missing class means both render simultaneously.
- **Tab strip not scrolling / "More" not appearing**: confirm `ScrollableTabs` is used (not a bare `<div className="tab-strip">`). If "More" doesn't appear when expected, `ResizeObserver` may not have fired yet — try resizing the window.
- **Owner seeing manager UI on shared pages**: confirm `?role=owner` is in the URL. If missing, the shared page defaults to manager context.
- **BottomNav active state wrong**: root pages (`/owner`, `/manager`) require exact-match logic. Sub-pages use prefix match. Check BottomNav `isActive()`.
