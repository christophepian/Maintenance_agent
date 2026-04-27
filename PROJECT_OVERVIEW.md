# Maintenance Agent — Project Overview

> **Read this first.** This is the primary entry-point document for routine implementation work.
> It contains the essential rules and navigation needed for most coding tasks.
> Deeper docs are linked below — open them only when your task requires it.

Swiss property management platform. Monorepo: Node.js + TypeScript backend (raw `http.createServer`, port 3001), Next.js Pages Router frontend (port 3000), PostgreSQL 16 via Docker (Prisma ORM). Four personas: Manager, Contractor, Tenant, Owner. JWT auth with role enforcement.

---

## What to Read When

| Your task | Read this | Why |
|-----------|-----------|-----|
| Any code change | **This file** (PROJECT_OVERVIEW.md) | Guardrails, architecture, routing |
| "Which file do I change?" | [ARCHITECTURE_LOW_CONTEXT_GUIDE.md](apps/api/src/ARCHITECTURE_LOW_CONTEXT_GUIDE.md) | File-level lookup for 16 common change types |
| Schema / model change | [SCHEMA_REFERENCE.md](SCHEMA_REFERENCE.md) | Full models table, enums, migration path |
| Testing / dev workflow | [CONTRIBUTING.md](CONTRIBUTING.md) | Port registry, test helpers, contract test pattern |
| Audit / open issues | [docs/AUDIT.md](docs/AUDIT.md) | 94 findings, 91 resolved, 3 remaining |
| Full current-state reference | [PROJECT_STATE.md](PROJECT_STATE.md) | Guardrail details, backlog, state integrity |
| Epic history / past work | [EPIC_HISTORY.md](EPIC_HISTORY.md) | Completed slice narratives |
| Design system visual spec | [docs/design-system.html](docs/design-system.html) | Token reference, component gallery, decided conflicts |
| Frontend page inventory | [docs/FRONTEND_INVENTORY.md](docs/FRONTEND_INVENTORY.md) | 247 pages, archetypes, conformance |
| Dev commands | [docs/DEV_COMMANDS.md](docs/DEV_COMMANDS.md) | Start/stop/clean/seed recipes |

---

## Architecture at a Glance

### Backend Layers (strict top-to-bottom — never skip)

```
routes → workflows → services → repositories → Prisma → PostgreSQL
```

- **Routes** — thin HTTP handlers. Parse input, call workflow, return response. No business logic.
- **Workflows** — orchestration. Delegate to services, emit domain events, own status transitions.
- **Services** — domain logic. No raw Prisma calls.
- **Repositories** — canonical Prisma access. Exported include constants only.
- **transitions.ts** — all status transition rules. Nowhere else.

### Frontend

- Next.js Pages Router. `apps/web/pages/api/` proxies to backend via `proxyToBackend()` (127/127 conforming).
- Styling: Tailwind v4.1 + semantic tokens (`@theme {}`) + CVA components + `@apply` classes in `globals.css`. No inline styles, no JS style objects.

#### Layout Primitives (mandatory nesting order)

```
AppShell [role="CONTRACTOR"|"TENANT"|"OWNER"]  — sidebar + main area
  PageShell                                      — max-width + padding
    PageHeader [title, subtitle, backLink, actions, breadcrumbs]
      PageContent                                — content column
        Panel [title, bodyClassName]             — white card section
```

#### Shared UI Components (`components/ui/`)

| Component | Purpose |
|-----------|--------|
| `Button` | 10 variants: `primary`, `secondary`, `ghost`, `outline`, `destructive`, `destructiveGhost`, `warning`, `warningGhost`, `neutral`, `link` |
| `Badge` + `statusVariants.js` | Status indicators — always use a mapper, never inline color maps |
| `DetailGrid` / `DetailItem` | Key-value grid for record metadata |
| `DetailList` / `DetailRow` | Vertical key-value list |
| `ActionBar` | Bottom-anchored action button strip |
| `Modal` / `ModalFooter` | Overlay dialog with standardized footer layout |
| `ResourceShell` | Wraps loading / error / not-found / ready states — replaces early-return guards |
| `ErrorBanner` | `role="alert"` error display — renders nothing when error is falsy |
| `EmptyState` | Centered empty/no-data placeholder |
| `Card`, `DataTable`, `Input`, `Select`, `StatusPill`, `KpiCard` | Other CVA primitives |

Barrel export: `import { Button, Badge, ResourceShell, ... } from "../../components/ui";`

#### Shared Hooks (`lib/hooks/`)

| Hook | Purpose |
|------|--------|
| `useDetailResource(url, fetchFn?)` | Replaces useState+useCallback+useEffect fetch boilerplate. Returns `{ data, setData, loading, error, refresh }`. Skips fetch when URL is falsy. Unwraps `json.data` if present. |
| `useAction()` | Wraps mutation pending state. Returns `{ pending, run }`. Use `run(key, asyncFn)` for keyed or `run(asyncFn)` for boolean pending. |

#### Format Helpers (`lib/format.js`)

`formatChf`, `formatChfCents`, `formatDate`, `formatDateLong`, `formatDateTime`, `formatPercent`, `formatNumber` — SSR-safe, deterministic. Never define inline format functions.

#### Migrating Old Pages

When touching an older detail page, check for these patterns and migrate:
1. **useState+useCallback+useEffect fetch triple** → replace with `useDetailResource`
2. **Early-return loading/error/not-found guards** → wrap content with `ResourceShell`
3. **try/finally pending-state wrappers** → replace with `useAction().run()`
4. **Inline `fmt()` / `formatDate()` / `formatChf()`** → import from `lib/format.js`
5. **Per-file `STATUS_COLORS` / color maps** → use `statusVariants.js` + `Badge`
6. **Custom modal markup** → use `Modal` / `ModalFooter`
7. **Repeated metadata grids** → use `DetailGrid` / `DetailItem`

> Full rules and canonical table: [PROJECT_STATE.md](PROJECT_STATE.md) §F-UI8.

### Database

- PostgreSQL 16 via Docker. Prisma ORM. 64 models · 55 enums · 72 migrations.
- Dev DB: `maint_agent` | Test DB: `maint_agent_test` (isolated).

---

## Essential Guardrails

These are condensed from [PROJECT_STATE.md](PROJECT_STATE.md) §Guardrails. The full prose with examples lives there.

### G1/G8: Migrations Only — `db push` Is Banned

```bash
# ALWAYS
npx prisma migrate dev --name <description>
npx prisma generate

# NEVER — no exceptions
prisma db push
prisma migrate reset
docker-compose down -v
```

After any schema change, verify zero drift:
```bash
npx prisma migrate diff \
  --from-schema-datasource ./prisma/schema.prisma \
  --to-schema-datamodel ./prisma/schema.prisma --script
# Expected: "This is an empty migration."
```

### G2/G3: New Fields — Update All Consumers

When adding a field to a Prisma model, update **all of these in the same PR:**
1. `schema.prisma` + migration
2. Repository include constant (e.g. `REQUEST_FULL_INCLUDE`)
3. DTO interface + mapper function
4. Validation schema (if user-facing)
5. OpenAPI spec + `api-client`
6. Contract test in `contracts.test.ts`

### G9: Canonical Includes — No Ad-Hoc Include Trees

Every repository exports a canonical include constant. DTO mappers use `Prisma.XGetPayload<{ include: typeof X_INCLUDE }>`. Never define inline `include: { ... }` in routes or services.

### G10: Contract Tests

`contracts.test.ts` guards DTO shape for key endpoints. Update it in the same PR as any DTO change.

### Auth Invariants (F1)

Production server refuses to boot if:
- `AUTH_OPTIONAL=true`
- `DEV_IDENTITY_ENABLED=true`
- `AUTH_SECRET` not set

`maybeRequireManager` is for reads only. Use `requireRole('MANAGER')` for mutations.

### Frontend Styling (F-UI4/F8)

Three-layer CSS architecture on **Tailwind v4.1**:

1. **Semantic tokens** — 23 CSS custom properties in `globals.css @theme {}` (brand, destructive, success, muted, surface + variants)
2. **@apply classes** — 78 utility-backed CSS classes in `globals.css @layer components` (buttons, notices, tables, tabs, filters, forms)
3. **CVA primitives** — 10 variant-based components in `components/ui/` (Button, Badge, Card, DataTable, Input, Select, ErrorBanner, EmptyState, StatusPill, KpiCard)

- **`cn()`** = `twMerge(clsx())` in `lib/utils.js` — **mandatory** for all dynamic className composition (replaces template-literal interpolation)
- **`statusVariants.js`** — 20 status→Badge variant mappers. All status indicators use `<Badge variant={mapper(status)}>`. Never define per-file color constants.
- **Inline Tailwind utilities** (e.g. `className="rounded-2xl border ..."`) — fine for one-off styling
- **Never:** static `style={{}}`, hardcoded hex/rgb, new `.css` files, `tailwind.config.js` theme extensions (TW v4 uses `@theme {}` in CSS), `className={\`...${x}\`}` template literals, per-file `STATUS_COLORS` objects
- **Design reference:** [docs/design-system.html](docs/design-system.html) — visual spec with architecture summary
- **Accessibility baseline:** skip-to-content link in AppShell, `<nav aria-label>` on all sidebars, `aria-label` on icon-only buttons, `sr-only` for visual-only indicators, `role="alert"` on error banners, `focus-visible:ring` on interactive elements

See [PROJECT_STATE.md](PROJECT_STATE.md) §F-UI1–F-UI8 for full hub/detail page rules.

---

## Schema Gotchas

Always check [SCHEMA_REFERENCE.md](SCHEMA_REFERENCE.md) for the full list. Key traps:

- `Request` has **no `orgId`** — scope inherited via unit → building FK chain
- `Job` has **no `description`** — use `Request.description` via the relation
- `Appliance` has **no `category`** — lives on `AssetModel`
- `Job.contractorId` is **required**, not optional

---

## Auth Helpers — `apps/api/src/authz.ts`

| Helper | Use case |
|--------|----------|
| `requireAuth(req, res)` | Any authenticated route — returns user or 401 |
| `maybeRequireManager(req, res)` | MANAGER or OWNER reads only |
| `requireRole(req, res, role)` | Single role enforcement |
| `requireAnyRole(req, res, roles[])` | Multi-role e.g. `['CONTRACTOR', 'MANAGER']` |
| `requireTenantSession(req, res)` | Tenant-portal — returns `tenantId` or null |
| `getOrgIdForRequest(req)` | Returns `string | null` — null in production if unauthenticated |

**Always check the return value and return early:**
```typescript
if (!maybeRequireManager(req, res)) return;
const tenantId = requireTenantSession(req, res);
if (!tenantId) return;
```

---

## Task Routing

### API change (add endpoint / modify response)
1. Read [ARCHITECTURE_LOW_CONTEXT_GUIDE.md](apps/api/src/ARCHITECTURE_LOW_CONTEXT_GUIDE.md) → "Where to Change Things"
2. Add route handler in `src/routes/` → workflow in `src/workflows/` → service/repository
3. Update `openapi.yaml` + `packages/api-client` + `contracts.test.ts`
4. Add Next.js proxy in `apps/web/pages/api/` if frontend needs it

### Frontend UI change
1. Read [PROJECT_STATE.md](PROJECT_STATE.md) §F-UI1–F-UI8 for layout rules
2. Hub pages → copy `_template_hub.js`. Detail pages → copy `_template_detail.js`
3. Use shared primitives first: `ResourceShell`, `useDetailResource`, `useAction`, `DetailGrid`, `ActionBar`, `Modal`
4. Styles in `globals.css` only. Reusable UI → extract to `apps/web/components/`

### Schema change
1. Read [SCHEMA_REFERENCE.md](SCHEMA_REFERENCE.md) for the full model
2. Edit `schema.prisma` → `npx prisma migrate dev --name <desc>` → `npx prisma generate`
3. Update repository include → DTO mapper → OpenAPI → api-client → contract test (all in same PR)
4. Verify drift is zero

### Audit / debugging
1. Read [docs/AUDIT.md](docs/AUDIT.md) — check if any open findings (3 remaining) apply
2. Check [PROJECT_STATE.md](PROJECT_STATE.md) §12 Backlog for known debt
3. Test DB issues → see G11 in PROJECT_STATE.md for seed steps

---

## Safe Code Change Checklist

Before every commit:

```bash
cd apps/api

# 1. Types
npx tsc --noEmit

# 2. Tests
npm test

# 3. Blueprint sync (also runs automatically via pre-commit hook)
npm run blueprint

# 4. Verify nothing is left uncommitted (G12/G14)
git status && git stash list
```

### G12–G15: Session & Commit Safety

- **G12** — Commit every deliverable (>100 new lines → stop and commit)
- **G13** — Frontend + backend = one atomic commit (never leave UI as only uncommitted layer)
- **G14** — Session-end: `git status && git stash list && git diff --stat` before closing
- **G15** — Never `git stash drop` without `git stash show --stat`; prefer `git stash branch wip/<name>`

After schema changes, also run:
```bash
npx prisma migrate diff \
  --from-schema-datasource ./prisma/schema.prisma \
  --to-schema-datamodel ./prisma/schema.prisma --script
# Must output "empty migration"
```

---

## Do NOT

- Put business logic in routes — use workflows/services
- Call Prisma directly from routes or services — use repositories
- Define inline `include: { ... }` — use canonical constants
- Use `prisma db push` — ever, under any circumstances
- Add inline `style={{}}` — use Tailwind classes, `@apply` classes, or CVA components from `components/ui/`
- Change `maybeRequireManager` to allow writes — use `requireRole('MANAGER')`
- Accept `tenantId` as a query param on tenant-portal routes — use `requireTenantSession()`
- Add non-English labels, seed data, or UI text — English only (F-UI7)
- Skip contract test updates when changing DTOs
- Run `docker-compose down -v` or `prisma migrate reset` without explicit approval
- Define per-file `STATUS_COLORS` / `URGENCY_COLORS` / color-map objects — use `statusVariants.js` mappers with `<Badge>`
- Use template-literal className interpolation (`className={\`... ${x}\`}`) — use `cn()` from `lib/utils.js`
- Duplicate detail-page fetch boilerplate (useState+useCallback+useEffect) — use `useDetailResource`
- Duplicate loading/error/not-found early-return guards — use `ResourceShell`
- Duplicate try/finally pending-state wrappers — use `useAction`
- Write one-off action button class stacks — use `Button` variants (`warning`, `destructiveGhost`, `neutral`, etc.)
- Define inline format functions (`fmt`, `formatDate`, `formatChf`) — import from `lib/format.js`
- Create icon-only `<button>` without `aria-label`
- Add `<input>` / `<select>` without an associated `<label>`, `aria-label`, or `placeholder`
- Introduce horizontal scroll on any page — viewport width is the hard max. `html, body` enforce `overflow-x: hidden` globally; use `min-w-0`, `truncate`, or responsive grids for wide content
- Render a `<table>` or `ConfigurableTable` without a mobile card-list alternative — use the dual-render pattern (`sm:hidden` card list + `hidden sm:block` table) so mobile users never need to scroll horizontally (F-UI9)
- Use a bare `<div className="tab-strip">` — always use `<ScrollableTabs activeIndex={...}>` so overflow tabs collapse into a "More" bottom sheet instead of clipping (F-UI11)
- Hardcode `role="MANAGER"` in a shared page — read `role` from `router.query` and derive `isOwner` to scope AppShell, tabs, edit controls, and internal links (F-UI10)

---

## Current System Snapshot

65 suites · 980 tests · 0 TS errors · 91/94 audit findings resolved. Strategy Engine & Capture Hardening epic complete (3-phase strategy engine with 56 tests, Azure OCR activation, invoice source-file serving). Responsive polish pass complete: dual-render pattern (F-UI9) applied to 18+ pages across all 4 personas; PENDING_REVIEW CTA fix; timeline stage bug fixed; `manager-reject` proxy created; tenant scheduling UX improved.

For full counts, state integrity verification, and Document Integrity table, see [PROJECT_STATE.md](PROJECT_STATE.md).

For the complete epic/slice history, see [EPIC_HISTORY.md](EPIC_HISTORY.md).
