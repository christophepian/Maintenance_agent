# Copilot Instructions for Maintenance Agent

## Project Overview
Web-first MVP for routing tenant maintenance requests directly to contractors with minimal property manager involvement. Built with Node.js + TypeScript backend (raw HTTP, no Express/Nest in production) and Next.js frontend.

## Architecture Patterns

### Backend: Raw HTTP Server (NOT NestJS at Runtime)
- **File:** [apps/api/src/server.ts](apps/api/src/server.ts) — uses `http.createServer()` with custom routing
- **Why:** Minimal dependencies; NestJS files exist but are disabled (see `requests.controller.ts` and `app.module.ts`)
- **Port:** 3001
- **Routing:** Manual URL parsing with regex matchers (e.g., `matchRequestById()` for `/requests/{id}`)
- **Error handling:** Centralized via `sendError()` and `sendJson()` utilities in [apps/api/src/http/](apps/api/src/http/)

### Data Flow: Request Lifecycle
1. Tenant submits request → Next.js frontend `POST /api/requests` → proxied to backend `POST /requests`
2. Backend validates via Zod ([apps/api/src/validation/requests.ts](apps/api/src/validation/requests.ts))
3. Auto-approval logic: `decideRequestStatus()` compares `estimatedCost` against org's `autoApproveLimit` (CHF)
4. Creates record in Prisma → PostgreSQL; returns UUID and status

### Database: Prisma + PostgreSQL
- **Schema:** [apps/api/prisma/schema.prisma](apps/api/prisma/schema.prisma)
- **Key tables:** `Request`, `Org`, `OrgConfig` (stores `autoApproveLimit` per tenant)
- **Migrations:** [apps/api/prisma/migrations/](apps/api/prisma/migrations/) — do NOT edit past migrations; use `prisma migrate dev --name <description>`
- **Validation state:** `RequestStatus` enum: `PENDING_REVIEW`, `AUTO_APPROVED`, `APPROVED`

### Frontend: Next.js Pages Router
- **Location:** [apps/web/](apps/web/)
- **API routes as proxy:** [apps/web/pages/api/](apps/web/pages/api/) proxies requests to backend (sets `API_BASE_URL` env var, defaults to `http://127.0.0.1:3001`)
- **Port:** 3000

## Key Conventions

### Validation: Zod + Manual Normalization
- Category whitelist: `["stove", "oven", "dishwasher", "bathroom", "lighting"]`
- Description: 10–2000 chars, auto-trimmed and collapse whitespace
- `estimatedCost`: optional, CHF (integer), 0–100000
- See [apps/api/src/validation/](apps/api/src/validation/) for schemas

### DTOs: Nullable Fields Become Undefined
- Services return `MaintenanceRequestDTO` with `category?` and `estimatedCost?` (omitted if null)
- Example: [apps/api/src/services/maintenanceRequests.ts](apps/api/src/services/maintenanceRequests.ts#L34-L42)

### Temporary Auth: Default Org
- No auth implemented; hardcoded `DEFAULT_ORG_ID = "default-org"`
- All requests use this org; org config auto-created on startup

## Development Workflows

### Start Services (Local)
```bash
# Backend
cd apps/api && npm run start:dev  # Watch mode with ts-node

# Frontend (separate terminal)
cd apps/web && npm run dev

# Database (Docker)
docker-compose up  # Starts PostgreSQL on 5432

# Quick check running services
lsof -nP -iTCP:3000,3001 -sTCP:LISTEN
```

### Database Migrations
```bash
cd apps/api

# Create new migration (generates SQL + auto-runs)
npx prisma migrate dev --name <description>

# Reset (dangerous: drops all data)
npx prisma migrate reset

# Inspect schema
npx prisma studio  # GUI at http://localhost:5555
```

### Build Backend
```bash
cd apps/api
npm run build  # Outputs to dist/
npm run start  # Runs dist/main.js (NestJS entry, NOT used in dev)
```

## Integration Points

### Backend ↔ Frontend
- Frontend proxies `GET /api/requests`, `POST /api/requests`, `POST /api/requests/approve` to backend
- Raw body handling: frontend manually parses JSON (backend provides `readJson()` util)
- Query params: passed through as-is (limit, offset, order)

### Approval Workflow
- `POST /requests/approve?id={uuid}` updates status to `APPROVED` (overrides auto-approval)
- Used by property manager to manually approve `PENDING_REVIEW` requests

### Env Configuration
- **Backend:** `API_BASE_URL` (for backend when proxy needs to call itself)
- **Backend:** `DATABASE_URL` (Prisma; see `.env` / `.env.example`)
- **Frontend:** `API_BASE_URL` (defaults to `http://127.0.0.1:3001`)
- **Port:** `PORT` env var (defaults: 3001 for API, 3000 for web)

## Testing Patterns
- Manual testing via curl (see context for example commands)
- No unit tests in repo yet; focus on integration testing against running services
- Validate with Zod early; assume data shape is correct after schema parse

## Gotchas & Legacy Code
- **NestJS files exist but are unused at runtime:** Controllers, modules disabled or ignored
- **_archive/ folder:** Contains legacy server.ts backup; do NOT reference
- **prisma.service.ts.disabled:** NestJS Prisma integration disabled; use direct `PrismaClient` instead
- **Query parsing:** Custom implementation; no qs library; watch for edge cases in `parseUrl()` and parameter coercion
