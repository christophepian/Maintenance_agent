# T-01 Audit & Pre-Flight — Findings Report

**Date:** 2026-04-30
**Status:** ✅ Complete
**Gate:** Gate 1 (Infrastructure Setup) — first of 8 tickets

---

## Verification Matrix

| # | Item | Status | Evidence | Action |
|---|------|--------|----------|--------|
| 1 | `_app.js` gates `DEV_MANAGER_TOKEN` on `NODE_ENV !== 'production'` | ✅ Already gated | `apps/web/pages/_app.js:36` — `if (process.env.NODE_ENV === 'production') return;` | None |
| 2 | `proxy.js` correctly forwards binary, headers, status | ✅ Compliant | `apps/web/lib/proxy.js` — sniffs `application/pdf` & `image/png`, forwards via `arrayBuffer()`. Streams forwarded for raw bodies. | None |
| 3 | Client-side `NEXT_PUBLIC_API_BASE_URL` usage | ⚠ 3 pages bypass proxy | `pages/index.js:9`, `pages/tenant-form.js:36`, `pages/admin-inventory/buildings/[id].js:39` | T-08: set `NEXT_PUBLIC_API_BASE_URL=""` in Vercel so they fall back to relative URLs through Next proxy, OR set to public API URL with CORS allowlist. |
| 4 | `isAuthOptional()` semantics | ✅ Safe by default | `authz.ts:8-12` — auth required unless `AUTH_OPTIONAL=true` explicitly set. Server refuses to start in prod if true (`server.ts:62-66`). | None |
| 5 | CORS handler — single `CORS_ORIGIN` | ✅ Works for single domain | `server.ts:170-174` — reads `CORS_ORIGIN`, defaults to empty in prod (deny). | T-08: for Vercel preview deploys (`*.vercel.app`), wrap header in regex check against allowlist; current handler will reject all preview URLs. **Action deferred to T-08.** |
| 6 | Committed secrets scan | ✅ `.env` gitignored, never committed | `git log --all -- apps/api/.env` empty. `.gitignore:58` covers it. | **Live Azure DI key still on disk locally — rotate before public sharing of repo.** Manual user action; flagged in MIGRATION_PLAN line 353. |
| 7 | Node 20 sufficient for `sharp`, `tesseract.js`, `pdfkit` | ✅ All compatible | `sharp@0.34.5` (Node 18.17+), `tesseract.js@7` (Node 14+), `pdfkit@0.17` (Node 12+). | Added `.nvmrc` (`20`) to repo root + `apps/api/`; added `engines.node` to `apps/api/package.json`. |
| 8 | Object-storage decision (B1) | ✅ Resolved 2026-04-30 | `apps/api/src/storage/attachments.ts:14` — `STORAGE_BACKEND` env switches local/S3. `@aws-sdk/client-s3@3` installed. | T-07 will provision Supabase S3-compatible bucket; no code change needed. |

---

## Production Boot Guards (server.ts:54-72) — Confirmed

The server **refuses to start** in `NODE_ENV=production` if any of the following hold:
- `AUTH_SECRET` is unset
- `AUTH_OPTIONAL=true`
- `DEV_IDENTITY_ENABLED=true`

This blocks the most common deployment-time auth bypass mistakes.

---

## Open Items Carried Into T-03 / T-08

1. **`/health` endpoint missing** → T-03 will add `GET /health` returning `{ status: "ok", db: "connected" }` (Render & Vercel uptime probes need this).
2. **CORS allowlist for Vercel preview URLs** → T-08 must extend `server.ts:170` to support a regex/list match against `CORS_ALLOWED_ORIGINS`.
3. **Three client-side `NEXT_PUBLIC_API_BASE_URL` references** → Decide in T-08 whether to:
   - Set the env var to `""` in Vercel (forces relative URLs → Next.js proxy → API), OR
   - Set it to the Render public URL and ensure CORS allows the Vercel domain.
   Recommend option (a) — keeps the API behind a single CORS origin and avoids browser→API token leakage.
4. **Manual: rotate Azure DI key** before any public sharing of repo or screen-recording of `apps/api/.env`.

---

## Artefacts Added

| File | Purpose |
|------|---------|
| `.nvmrc` (root) | Pin Node 20 for any `nvm` user across whole repo |
| `apps/api/.nvmrc` | Render auto-detects Node 20 from this file |
| `apps/api/package.json` `engines.node` | Belt-and-suspenders: enforces `>=20.0.0 <21.0.0` |

---

## Gate 1 Progress

- ✅ T-01 Audit & Pre-Flight (this ticket)
- ✅ T-02 Add `directUrl` to Prisma schema (already done; in `schema.prisma:8`)
- ⏭ T-03 Add `/health` endpoint
- ⏭ T-04 API prod-readiness checklist
- ⏭ T-05 Provision Supabase project
- ⏭ T-06 Provision Render service
- ⏭ T-07 Provision Supabase S3 bucket
- ⏭ T-08 Provision Vercel project + env wiring

**Recommendation:** Proceed directly to T-03 — `/health` endpoint is a 15-min code change with high downstream value (unblocks T-04 / T-06 health probes).
