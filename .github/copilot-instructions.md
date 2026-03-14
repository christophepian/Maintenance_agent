# Copilot Instructions — Maintenance Agent

## Before Every Session

Read these files in full before writing any code:
1. `PROJECT_STATE.md` — guardrails, architecture decisions, backlog, epic history
2. `apps/api/src/ARCHITECTURE_LOW_CONTEXT_GUIDE.md` — compact auth helpers, layer rules, quick reference
3. `docs/AUDIT.md` — open findings; check if any apply to files you are about to touch

For schema work also read:
- `SCHEMA_REFERENCE.md`
- `apps/api/prisma/schema.prisma`

---

## Project Overview

Full-stack Swiss property management platform. Monorepo with Node.js + TypeScript backend and Next.js frontend.

| | |
|-|-|
| Backend | Raw `http.createServer()` — no Express/NestJS. Port 3001. |
| Frontend | Next.js Pages Router. Port 3000. |
| Database | PostgreSQL 16 via Docker. Prisma ORM. 45 models · 35 enums · 34 migrations. |
| Auth | JWT-based. Role enum: MANAGER, CONTRACTOR, TENANT, OWNER. |
| Personas | Manager · Contractor · Tenant · Owner |

---

## Architecture Rules (Non-negotiable)

**Layer order — always flow top to bottom, never skip:**
```
routes → workflows → services → repositories → Prisma → PostgreSQL
```

- **Routes** — thin HTTP handlers only. Parse input, call workflow, return response. No business logic, no direct Prisma calls.
- **Workflows** — orchestration only. Delegate to services. Emit domain events. Own status transitions.
- **Services** — domain logic. No raw Prisma calls — use repositories.
- **Repositories** — canonical Prisma access. Always use exported include constants (e.g. `JOB_INCLUDE`). Never define inline include trees.
- **transitions.ts** — all status transition rules live here. Nowhere else.

---

## Database Rules (G1, G8 — Hard Gates)
```bash
# ALWAYS use migrations
npx prisma migrate dev --name <description>
npx prisma generate

# NEVER use — banned
prisma db push        # creates drift
prisma migrate reset  # destroys data
docker-compose down -v  # destroys volume
```

One known exception: LKDE epic used `db push` for shadow DB replay issue — this is a documented one-time exception, not a precedent.

---

## Auth Helpers — `apps/api/src/authz.ts`

| Helper | Use case |
|--------|----------|
| `requireAuth(req, res)` | Any authenticated route |
| `maybeRequireManager(req, res)` | MANAGER or OWNER reads only |
| `requireRole(req, res, role)` | Single role enforcement |
| `requireAnyRole(req, res, roles[])` | Multi-role e.g. `['CONTRACTOR', 'MANAGER']` |
| `requireTenantSession(req, res)` | Tenant-portal routes — returns `tenantId` or null |
| `getOrgIdForRequest(req)` | Returns `string \| null` — null in production if unauthenticated |

**Usage pattern — always check return value:**
```typescript
if (!maybeRequireManager(req, res)) return;
const tenantId = requireTenantSession(req, res);
if (!tenantId) return;
```

**Production boot guards — server refuses to start if:**
- `AUTH_OPTIONAL=true`
- `DEV_IDENTITY_ENABLED=true`
- `AUTH_SECRET` not set

---

## Prisma / DTO Rules (G2, G3, G9)

- Every repository must export a canonical include constant
- Every DTO mapper must use `Prisma.XGetPayload<{ include: typeof X_INCLUDE }>` — never `any`
- Never define inline `include: { ... }` objects in routes or services
- When adding a model field: update schema → migration → repository include → DTO mapper → OpenAPI → api-client → tests — all together

---

## Testing Rules (G5, G7, G10)

- CI is a hard gate — 6 checks must pass before merge
- Jest runs with `maxWorkers: 1` — integration tests are serial
- Contract tests required for: `GET /requests`, `GET /jobs`, `GET /invoices`, `GET /leases/:id`
- After any backend change: `npx tsc --noEmit` → `npm test` → `npm run blueprint`

---

## Commit Checklist

Before every commit:
- [ ] `npx tsc --noEmit` — 0 errors
- [ ] `npm test` — all tests pass
- [ ] `npm run blueprint` — docs sync (runs automatically via pre-commit hook)

---

## Monorepo Structure
```
Maintenance_Agent/
├── apps/api/src/
│   ├── routes/          # Thin HTTP handlers
│   ├── workflows/       # Orchestration + domain events
│   ├── services/        # Domain logic
│   ├── repositories/    # Prisma access + canonical includes (9 repos)
│   ├── events/          # Domain event bus
│   └── governance/      # Org scoping + authz
├── apps/api/prisma/
│   ├── schema.prisma    # 45 models · 35 enums
│   └── migrations/      # 34 dirs — never edit past migrations
├── apps/web/pages/      # 185 pages (UI + API proxies)
├── apps/web/styles/
│   └── globals.css       # Tailwind + CSS variables + @layer components (F8)
├── packages/api-client/ # Typed DTOs + fetch methods
├── infra/               # Docker — PostgreSQL 16
├── docs/
│   ├── blueprint.html   # Live architecture blueprint
│   ├── AUDIT.md         # 82 findings · 20 resolved
│   └── FRONTEND_INVENTORY.md
└── .github/
    └── copilot-instructions.md  # This file
```

---

## Known Open Issues (check `docs/AUDIT.md` for full list)

- **SA-10–SA-20** — security findings still open (role enforcement, org scoping, rate limiting)
- **CQ-1–CQ-15** — layer violations in routes (legal.ts worst offender)
- **TC-1–TC-3, TC-6–TC-15** — test coverage gaps
- **Multi-org** — `Request` has no `orgId`; `DEFAULT_ORG_ID` still in `authz.ts` fallback (dev only)
- **Legal DSL** — `LegalVariable` values not wired into DSL condition evaluation

---

## Key Schema Gotchas

- `Request` — no `orgId` (scoped via unit→building FK chain)
- `Job` — no `description` (use `Request.description`)
- `Appliance` — no `category` (lives on `AssetModel`)
- `Job.contractorId` — required, not optional

---

## What NOT To Do

- Do not put business logic in routes
- Do not call Prisma directly from routes or services — use repositories
- Do not define inline include trees — use canonical constants
- Do not use `prisma db push` under any circumstances
- Do not add inline styles to manager pages — use Tailwind classes or `@layer components` in globals.css
- Do not change `maybeRequireManager` to allow writes — use `requireRole('MANAGER')` for mutations
- Do not accept `tenantId` as a query param on tenant-portal routes — use `requireTenantSession()`
