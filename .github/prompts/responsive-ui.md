# Responsive UI — Implementation Prompts

This file contains three sequential implementation slices. Run them in order. Each slice
is self-contained and includes its own inspection, architecture, and definition-of-done
instructions. Do not start a later slice until the earlier one passes its DoD.

---

## Context for all slices

**What this epic is:**
The application is currently desktop-only. 93 UI pages have no responsive behaviour.
AppShell uses a hardcoded 260px sidebar with inline styles. No media queries exist in
globals.css. This epic makes the full application usable on mobile without a separate
codebase, app install, or WhatsApp dependency.

**Why this is the right investment before multichannel:**
- A mobile-optimised web portal + web push notifications covers 80% of the WhatsApp
  multichannel value at a fraction of the infrastructure complexity.
- The owner and tenant portals are the primary mobile surfaces — owners approving
  requests, tenants checking request status. Both are currently unusable on a phone.
- Responsive design validates whether owners and tenants will engage via mobile web
  before committing to Twilio/Meta dependencies.

**Current state (from audit):**
- `Panel.jsx`, `PageHeader.jsx`, `SidebarLayout.jsx` — partially responsive (sm: prefixes
  for flex direction only). All other components: desktop-only inline styles.
- `AppShell` — hardcoded `gridTemplateColumns: "260px 1fr"` inline style. No collapse
  behaviour. This is the blocker for all mobile usage.
- `globals.css` — no `@media` rules. `.main-container` fixed at 980px max-width.
  `.inline-table` has no horizontal scroll fallback.
- All four sidebar components (`ManagerSidebar`, `OwnerSidebar`, `ContractorSidebar`,
  `TenantSidebar`) use inline styles, no responsive behaviour.

**Design principles for all slices:**
- **Mobile-first within new code** — write `base` styles for mobile, add `md:` / `lg:`
  overrides for larger screens in any new or modified component.
- **Do not rewrite working desktop layouts** — add responsive behaviour on top. The
  desktop experience must be identical after each slice.
- **No new CSS files** — all responsive additions go into `globals.css` `@layer
  components` or as Tailwind responsive prefixes in JSX. This enforces F-UI4.
- **No JS-based responsive logic** (no `window.innerWidth` checks, no resize listeners)
  unless absolutely required for the hamburger menu state. CSS handles layout; JS
  handles only the open/close toggle.
- **Test on 375px width** (iPhone SE) as the minimum target. All content must be
  readable and actionable at this width.
- **Tables are the hardest problem** — see the table strategy section below.

**Table strategy (applies to all slices):**
Inline tables on small screens get one of three treatments depending on column count:

| Columns | Treatment |
|---|---|
| ≤ 3 | Horizontal scroll (`overflow-x: auto` wrapper) |
| 4–6 | Horizontal scroll on mobile (`md:` removes scroll) |
| > 6 or complex | Card-view on mobile: each row becomes a stacked card |

Do not implement card-view in Slice 1. Horizontal scroll is sufficient for Slices 1–2.
Card-view is only needed for the most complex manager tables (Slice 3).

**Out of scope for all slices:**
- Native app or PWA shell (service worker, offline support) — separate epic.
- Web push notifications — separate epic, can be layered after this one.
- Dark mode.
- Tablet-specific layouts — design for mobile (≤ 768px) and desktop (≥ 1024px). The
  `md:` breakpoint (768px) is the single inflection point.
- Accessibility improvements beyond what responsive refactoring naturally introduces.

---

## Slice 1 of 3 — Shell, sidebar, and global styles

Read `PROJECT_OVERVIEW.md` first (entry point), then
`apps/api/src/ARCHITECTURE_LOW_CONTEXT_GUIDE.md` (lookup), then `PROJECT_STATE.md`
(canonical reference), and `apps/api/blueprint.js`. Obey all guardrails exactly.
Preserve existing desktop behaviour unless explicitly required for this slice.

### Slice name: `responsive-shell`

**Goal:** Make `AppShell`, all four sidebar components, `Panel`, `PageHeader`, and
`globals.css` fully responsive. After this slice, every page in the application will
be navigable on a phone — content may still overflow horizontally, but the shell,
sidebar, and navigation will work correctly. Slices 2 and 3 fix page-level content.

This is the highest-leverage slice: all page content sits inside AppShell. Fix the
shell and every page benefits immediately without touching individual page files.

### Before writing code

1. Read `apps/web/components/AppShell.jsx` (or `.js`). Record:
   - The exact inline style that sets the sidebar width (`gridTemplateColumns`).
   - How the sidebar is conditionally shown/hidden (if at all).
   - Whether there is any existing mobile state management.
2. Read all four sidebar components:
   `apps/web/components/ManagerSidebar.jsx`,
   `apps/web/components/OwnerSidebar.jsx`,
   `apps/web/components/ContractorSidebar.jsx`,
   `apps/web/components/TenantSidebar.jsx`.
   Record: how nav items are rendered, whether any item uses inline styles, whether
   there is an active-state pattern you must preserve.
3. Read `apps/web/components/Panel.jsx` and `apps/web/components/PageHeader.jsx`.
   Note which responsive prefixes already exist — do not duplicate or conflict.
4. Read `apps/web/styles/globals.css` in full. Note:
   - All existing component classes (`.tab-strip`, `.inline-table`, `.panel`, etc.)
   - The `.main-container` max-width rule.
   - The `:root` CSS variables — you may need to add mobile-specific values.
5. Read `apps/web/pages/_app.js` to understand how AppShell is instantiated and whether
   layout varies by role/route.
6. Output a short implementation plan before writing any code:
   - The hamburger open/close state management approach (local React state in AppShell).
   - Which inline styles on AppShell will be replaced with Tailwind classes.
   - Which globals.css classes need responsive additions.

### Architecture rules

- Replace inline style objects in AppShell and sidebar components with Tailwind classes.
  This is the one place in this epic where existing inline styles must be replaced (not
  just supplemented) — the inline `gridTemplateColumns` string physically prevents CSS
  responsive overrides.
- Hamburger menu state: single `const [sidebarOpen, setSidebarOpen] = useState(false)`
  in AppShell. Pass `onClose` to the sidebar overlay. Do not use Context or a global
  store for this.
- The sidebar on mobile is a **full-height overlay** (fixed position, z-index above
  content, semi-transparent backdrop). On desktop (`md:` and above) it reverts to the
  current static left column. This is the standard pattern — do not invent a novel one.
- Close the sidebar overlay when: (a) the backdrop is clicked, (b) a nav item is
  clicked, (c) screen width crosses the `md:` breakpoint (use a `useEffect` with a
  `matchMedia` listener for this — remove the listener on unmount).
- The hamburger button is only visible on mobile (`md:hidden`). It lives in a top bar
  that is only visible on mobile (`md:hidden`). Do not add a persistent top bar on
  desktop.

### Changes to existing files — in this order

1. `apps/web/styles/globals.css`
   - Add responsive wrapper for tables:
     ```css
     .table-responsive {
       overflow-x: auto;
       -webkit-overflow-scrolling: touch;
     }
     ```
   - Make `.main-container` add safe horizontal padding on mobile:
     ```css
     /* existing rule stays; add inside it: */
     padding-left: max(1rem, env(safe-area-inset-left));
     padding-right: max(1rem, env(safe-area-inset-right));
     ```
   - `.tab-strip` — add `overflow-x: auto; white-space: nowrap;` so tabs scroll
     horizontally on narrow screens instead of wrapping or overflowing.
   - `.inline-table` — wrap usage in `.table-responsive` (see JSX changes below); no
     change to the table class itself.
   - `.panel` (if it exists as a component class) — ensure `padding` uses a smaller
     value on mobile if it is currently fixed. Use a CSS variable or add a media query:
     `@media (max-width: 767px) { .panel-body { padding: 0.75rem; } }`

2. `apps/web/components/AppShell.jsx`
   - Remove the inline `style={{ gridTemplateColumns: "260px 1fr" }}` (and any similar
     inline layout styles).
   - Replace with Tailwind grid classes:
     - Mobile: single column, sidebar hidden by default.
     - Desktop (`md:`): two-column grid with 260px sidebar.
     - Example: `className="grid md:grid-cols-[260px_minmax(0,1fr)] min-h-screen"`
   - Add hamburger state and mobile top bar (mobile-only, `md:hidden`):
     - Top bar: `fixed top-0 left-0 right-0 h-12 bg-white border-b flex items-center
       px-4 z-30 md:hidden`
     - Hamburger button inside the top bar: renders three lines (use an SVG or a simple
       `div` stack — no icon library dependency unless one is already in use).
     - App name / logo in the top bar (same as what appears in the desktop sidebar header
       if one exists).
   - Add sidebar overlay for mobile:
     - Backdrop: `fixed inset-0 bg-black/40 z-40 md:hidden` — visible only when
       `sidebarOpen === true`.
     - Sidebar panel on mobile: `fixed top-0 left-0 h-full w-64 bg-white z-50 md:hidden
       transform transition-transform duration-200` — `translate-x-0` when open,
       `-translate-x-full` when closed.
   - On desktop, the sidebar renders in its normal grid column (unchanged).
   - Add top padding to main content area on mobile to clear the fixed top bar:
     `pt-12 md:pt-0`

3. `apps/web/components/ManagerSidebar.jsx` (and Owner/Contractor/Tenant variants)
   - Replace any inline `style` objects with equivalent Tailwind classes.
   - Accept an `onClose` prop. Call `onClose()` on every nav item click (no-op on
     desktop since the overlay isn't rendered there).
   - Ensure the active nav item style uses a Tailwind class, not an inline style.
   - Do not change the nav item structure, icons, or links.

4. `apps/web/components/Panel.jsx`
   - Already has partial responsive behaviour. Verify the `bodyClassName` prop is
     applied correctly and that the panel header stacks properly at `sm:` breakpoint.
     Fix any issues found — do not add new responsive behaviour beyond what is needed.

5. `apps/web/components/PageHeader.jsx`
   - Already has partial responsive behaviour. Same as Panel — fix any issues, don't
     over-engineer.

6. Wrap every `<table className="inline-table">` in the shared layout components (if
   any tables exist in components rather than pages) with
   `<div className="table-responsive">`. Do not touch page-level tables in this slice —
   that is Slices 2 and 3.

### Files to modify

- `apps/web/styles/globals.css` — responsive additions above.
- `apps/web/components/AppShell.jsx` — responsive shell + hamburger.
- All four sidebar components — inline style removal + `onClose` prop.
- `apps/web/components/Panel.jsx` — minor fixes if needed.
- `apps/web/components/PageHeader.jsx` — minor fixes if needed.
- `docs/FRONTEND_INVENTORY.md` — no new files; no count change needed.
- `PROJECT_STATE.md` — no Document Integrity count change (no new routes/models).

### Definition of done

- [ ] `npx tsc --noEmit --project apps/api/tsconfig.json` — zero errors.
- [ ] `npm test --prefix apps/api` — all suites pass (backend tests unaffected).
- [ ] `next build` — zero errors, zero new warnings.
- [ ] At 375px viewport width: sidebar is hidden, hamburger button is visible, tapping
  hamburger opens the sidebar overlay, tapping a nav item closes it and navigates.
- [ ] At 1024px viewport width: sidebar is static in left column, hamburger is hidden,
  desktop layout is pixel-identical to pre-slice state.
- [ ] `.tab-strip` on a hub page (e.g. `/manager/requests`) scrolls horizontally on
  mobile without wrapping or overflowing the viewport.
- [ ] No inline `style={{ gridTemplateColumns }}` remains in AppShell.

---

## Slice 2 of 3 — Owner and tenant portal pages

Read `PROJECT_OVERVIEW.md` first, then `apps/api/src/ARCHITECTURE_LOW_CONTEXT_GUIDE.md`,
then `PROJECT_STATE.md`. Slice 1 must be complete and green before starting.

### Slice name: `responsive-owner-tenant`

**Goal:** Make all owner portal pages and all tenant portal pages fully usable on a
375px-wide phone. These are the highest-priority personas for mobile — owners approving
requests, tenants checking maintenance status. After this slice, both portals are
production-ready on mobile.

### Before writing code

1. Read `docs/FRONTEND_INVENTORY.md`. Extract the complete list of:
   - Owner portal UI pages (`apps/web/pages/owner/`)
   - Tenant portal UI pages (`apps/web/pages/tenant/`)
   Record page count and note which pages have tables vs forms vs stat cards.
2. Open 3–4 owner pages and 3–4 tenant pages. For each, note:
   - Whether it uses `.inline-table` (needs `.table-responsive` wrapper).
   - Whether it uses a grid for stat cards (needs responsive `grid-cols-` changes).
   - Whether forms have fixed-width inputs (need `w-full` on mobile).
   - Whether there are side-by-side panels that should stack on mobile.
3. Read `apps/web/components/` for any shared components used exclusively by owner or
   tenant pages (e.g. `AssetInventoryPanel.js`, `DepreciationStandards.js`). Note their
   layout patterns — you will make them responsive here.

### Architecture rules

- Work page by page. Do not do a global find-and-replace. Each page needs a deliberate
  read before editing.
- For each page, the change set is typically:
  1. Wrap `<table className="inline-table">` in `<div className="table-responsive">`.
  2. Change stat card grids from `grid-cols-4` to `grid-cols-2 md:grid-cols-4`.
  3. Change side-by-side panel pairs from `flex gap-4` to `flex flex-col md:flex-row gap-4`.
  4. Add `w-full` to form inputs that have a fixed width.
  5. Add `text-sm` on mobile for dense data (optional — only if content overflows).
- Do not change any data fetching, business logic, or API calls. Pure layout changes only.
- If a page uses inline `style={{ width: "X%" }}` for layout (not for specific visual
  reasons), replace with equivalent Tailwind classes.
- Follow F-UI4: no new inline styles, no new CSS files.

### Page-by-page approach

For each page file:
1. Read the file.
2. Identify the layout issues from the patterns above.
3. Make the minimal changes to fix them.
4. Move to the next page.

Commit after completing all owner pages, then again after all tenant pages. Do not
batch both portals into one commit.

### Files to modify

Every `.js` file in:
- `apps/web/pages/owner/` (UI pages only, not `pages/api/`)
- `apps/web/pages/tenant/` (UI pages only, not `pages/api/`)
- Any components in `apps/web/components/` used exclusively or primarily by these pages.

### Definition of done

- [ ] `next build` — zero errors.
- [ ] At 375px: every owner portal page renders without horizontal overflow (no
  content cut off, no horizontal scrollbar on the page body).
- [ ] At 375px: every tenant portal page renders without horizontal overflow.
- [ ] Tables on owner/tenant pages are wrapped in `.table-responsive` and scroll
  horizontally on mobile rather than overflowing.
- [ ] Stat card grids stack to 2 columns on mobile.
- [ ] Forms are full-width on mobile — no fixed-width inputs that overflow.
- [ ] At 1024px: all owner and tenant pages are pixel-identical to pre-slice state.

---

## Slice 3 of 3 — Manager portal pages

Read `PROJECT_OVERVIEW.md` first, then `apps/api/src/ARCHITECTURE_LOW_CONTEXT_GUIDE.md`,
then `PROJECT_STATE.md`. Slices 1 and 2 must be complete and green before starting.

### Slice name: `responsive-manager`

**Goal:** Make all manager portal pages fully usable on mobile. The manager portal is the
most complex surface — hub pages with many-column tables, forms with multiple sections,
cashflow charts, and dense data grids. This slice requires the card-view table pattern
for the most complex tables.

### Before writing code

1. Read `docs/FRONTEND_INVENTORY.md`. Extract the complete list of manager UI pages
   (`apps/web/pages/manager/`). Group them by complexity:
   - **Simple** (stat cards, short lists, forms): likely responsive with horizontal
     scroll + grid-cols fix only.
   - **Medium** (hub pages with 4–6 column tables): horizontal scroll sufficient.
   - **Complex** (tables with > 6 columns, or where horizontal scroll is unusable
     because the row content itself is too dense): needs card-view on mobile.
2. For each complex table, read the page file and record:
   - Column names and which 2–3 are essential on mobile (e.g. name, status, date).
   - Whether rows are clickable (the card must preserve the click target).
   - Whether there are inline actions (approve/reject buttons inside rows).
3. Read `apps/web/pages/manager/requests.js` — this is the reference hub page.
   Understand its tab + table structure before touching any other hub page.
4. Check `apps/web/pages/manager/cashflow/` — cashflow pages may have charts. Note
   whether any charting library is in use and whether it has built-in responsive support.

### Card-view pattern for complex tables

For tables where horizontal scroll is insufficient, implement a responsive card-view:

```jsx
{/* Desktop: normal table */}
<div className="table-responsive hidden md:block">
  <table className="inline-table">
    {/* existing table unchanged */}
  </table>
</div>

{/* Mobile: card list */}
<div className="md:hidden space-y-3 px-4 py-3">
  {rows.map(row => (
    <div key={row.id} className="bg-white border rounded-lg p-3 space-y-1"
         onClick={() => router.push(`/manager/requests/${row.id}`)}>
      <div className="flex justify-between items-start">
        <span className="font-medium text-sm">{row.primaryField}</span>
        <span className="status-pill">{row.status}</span>
      </div>
      <div className="text-xs text-gray-500">{row.secondaryField}</div>
      {row.hasInlineAction && (
        <div className="flex gap-2 pt-1">
          {/* inline action buttons */}
        </div>
      )}
    </div>
  ))}
</div>
```

Rules for card-view:
- Show maximum 3 fields per card (primary, secondary, status/badge).
- Preserve all click targets and inline actions.
- Use `hidden md:block` / `md:hidden` to toggle — pure CSS, no JS.
- Never duplicate data fetching. Both views render from the same data array.
- Add card-view only where horizontal scroll is genuinely unusable. When in doubt,
  use horizontal scroll.

### Cashflow and chart pages

If cashflow pages use a charting library (check `apps/web/pages/manager/cashflow/`):
- Wrap chart containers in a div with `w-full overflow-hidden`.
- If the chart library supports `width="100%"` or a responsive prop, use it.
- If the chart renders at a fixed pixel width and has no responsive mode, wrap it in
  `overflow-x: auto` and add a `// TODO: replace with responsive chart library` comment.
  Do not block this slice on replacing a charting library.

### Page-by-page approach

Work through manager pages in this order (simplest to most complex):
1. Detail/sub-pages (single-record views, forms) — horizontal scroll + grid fix only.
2. Hub pages with simple tables (≤ 4 columns) — horizontal scroll.
3. Hub pages with medium tables (4–6 columns) — horizontal scroll.
4. Hub pages with complex tables (> 6 columns or dense rows) — card-view pattern.
5. Cashflow and finance pages — chart wrapping.

Commit after each group. Do not batch all manager pages into one commit.

### Files to modify

Every `.js` file in:
- `apps/web/pages/manager/` (UI pages only, not `pages/api/`)
- Any components in `apps/web/components/` used primarily by manager pages.

### Definition of done

- [ ] `next build` — zero errors, zero new warnings.
- [ ] At 375px: every manager page renders without horizontal overflow on the page body.
- [ ] Tables with ≤ 6 columns: horizontal scroll works, all content is accessible.
- [ ] Tables with > 6 columns or card-view implementation: card list renders on mobile,
  desktop table renders on `md:` and above, both use the same data source.
- [ ] Hub page tab strips scroll horizontally on mobile (from Slice 1 globals fix).
- [ ] Cashflow chart pages: charts do not overflow the viewport.
- [ ] At 1024px: all manager pages are pixel-identical to pre-slice state.
- [ ] `npm test --prefix apps/api` — all suites pass (backend unaffected).
- [ ] `next build` — clean.
