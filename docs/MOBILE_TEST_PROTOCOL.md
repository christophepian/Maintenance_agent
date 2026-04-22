# Front-End Mobile Test Protocol — Owner Surface
> Target viewport: 390 × 844 px (iPhone 14). Browser DevTools device emulation.
> All pages are under the `OWNER` role.

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
| A2 | Pending approval table scrolls horizontally | Drag table left — all columns reachable |
| A3 | History table scrolls horizontally | Same as A2 |
| A4 | No content clipped left edge | Row text not cut off by padding |

---

### 3. Work Requests — `/owner/work-requests`

| # | Check | Pass criteria |
|---|-------|---------------|
| WR1 | 7-tab strip scrollable | Drag tab strip to reveal "RFPs" tab on the right; active tab scrolls into view on click |
| WR2 | Request table scrolls horizontally | All 7 columns (Category, Building/Unit, Status, Cost, Contractor, Created) reachable |
| WR3 | Badge counts visible | Count pills on tabs show correctly after data loads |
| WR4 | Empty state renders | Switch to a tab with 0 results — empty state message is full-width and readable |

---

### 4. Request Detail — `/owner/requests/[id]`

| # | Check | Pass criteria |
|---|-------|---------------|
| RD1 | Status pipeline fits | 5- or 6-stage pipeline rendered in a single row; labels don't overlap or clip outside viewport |
| RD2 | Owner CTAs are tappable | Approve / Reject buttons ≥ 44 px height, not cropped |
| RD3 | Details panel — single column | Building/unit/description in 1 column (md:grid-cols-3 collapses) |
| RD4 | Two-column layout collapses | Asset Recommendation, Photos, Legal Analysis stacked above Tenant/Contractor cards |
| RD5 | Asset recommendation grid | `grid-cols-2` cost comparison row readable at 390 px |

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
| P2 | Buildings table | `ConfigurableTable` renders; sortable headers accessible |
| P3 | Vacancies tab | VacanciesPanel loads; vacancy table scrolls horizontally |

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

## Common failure patterns to watch for

- **Content behind BottomNav**: scroll to bottom; if last card is clipped, check `pb-24 md:pb-6` on `<main>`.
- **Horizontal body scroll**: check `document.documentElement.scrollWidth > 390` in console. Usually caused by a missing `overflow-x-auto` wrapper on a wide table or `whitespace-nowrap` on a flex container.
- **Hydration flash**: resize window from desktop → mobile and back. If layout jumps on first render, `useIsMobile()` SSR-safe default may not be respected.
- **Tab strip not scrolling**: confirm `ScrollableTabs` is used (not a bare `<div className="tab-strip">`). Check globals.css has `overflow-x: auto; scrollbar-width: none` on `.tab-strip`.
- **BottomNav active state wrong**: root pages (`/owner`, `/manager`) require exact-match logic. Sub-pages use prefix match. Check BottomNav `isActive()`.
