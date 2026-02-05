# Maintenance Agent — Project Audit

**Audit Date:** 2026-02-05

---

## 1. Project Overview

- **Purpose:** Web-first MVP for routing tenant maintenance requests directly to contractors, minimizing property manager involvement.
- **Tech Stack:**
  - Backend: Node.js + TypeScript, raw HTTP server (no Express/NestJS at runtime), Prisma ORM, PostgreSQL (Docker)
  - Frontend: Next.js (Pages Router), React, API proxy routes
  - DevOps: Docker Compose, GitHub Actions CI/CD

## 2. Architecture & Key Patterns

- **Backend:**
  - Entry: `apps/api/src/server.ts` (manual routing, custom error handling)
  - Validation: Zod schemas in `apps/api/src/validation/`
  - Data: Prisma models, migrations in `apps/api/prisma/`
  - Org config: Auto-approval limit per org, hardcoded default org for now
- **Frontend:**
  - Pages: `/`, `/manager`, `/admin-inventory`, `/contractor`, `/contractors`, `/flows`
  - API proxy: `apps/web/pages/api/` forwards to backend
  - Navigation: `flows.js` indexes all main flows for QA and onboarding
- **Database:**
  - PostgreSQL 16 (Docker)
  - Prisma migrations, schema in sync with code

## 3. Recent Changes (since last audit)

- All main UI pages are now discoverable and testable from `flows.js`
- 404 and fetch errors resolved by improved troubleshooting workflow (cache clearing, process management, server restarts)
- Documentation updated: troubleshooting, navigation, and onboarding steps clarified
- Backend and frontend startup, migration, and log inspection steps validated

## 4. Code Quality & Structure

- **Monorepo:**
  - `apps/` (api, web), `infra/` (docker-compose), `packages/` (shared), `_archive/` (legacy)
- **Dead code:** Legacy NestJS files present but not used at runtime; clearly marked/disabled
- **Validation:** Zod schemas, DTO normalization, category whitelists
- **Testing:** Manual integration via curl, no automated unit tests yet
- **CI/CD:** GitHub Actions for type-checking and build

## 5. Developer Workflow & Troubleshooting

- **Startup:**
  - DB: `docker compose up` in `infra/`
  - Backend: `npm run start:dev` in `apps/api`
  - Frontend: `npm run dev` in `apps/web`
- **Troubleshooting:**
  - Clear Next.js cache (`rm -rf .next`), kill stale processes, restart servers
  - Check ports: `lsof -nP -iTCP:3000,3001 -sTCP:LISTEN`
  - Logs: `/tmp/api.log`, `/tmp/web.log`
- **Navigation:**
  - Use `flows.js` for QA, onboarding, and regression testing

## 6. Risks & Backlog

- **Risks:**
  - No authentication/authorization yet
  - No automated tests
  - Legacy code may confuse new devs
- **Backlog:**
  - Contractor portal, notifications, scheduling, invoicing, media uploads
  - Tenant identification by phone, asset context, automated scheduling

## 7. State Integrity

- Filesystem, DB schema, and documentation are in sync
- Project is stable and ready for further development or onboarding

---

**End of Audit — 2026-02-05**
