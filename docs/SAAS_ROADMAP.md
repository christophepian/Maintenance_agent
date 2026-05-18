# Sencilo — SaaS Delivery Roadmap

**Created:** 2026-05-18  
**Scope:** Two-phase plan for distributing Sencilo as a multi-tenant SaaS product.  
**Baseline:** 1009 tests · 0 TS errors · 92/96 audit findings resolved · Supabase auth live · RLS enabled on all 72 tables.

---

## Phase 1 — Closed Beta (White-Glove Provisioning)

> **Goal:** Safely onboard 3–10 hand-picked property management firms with complete data isolation between them. Admin provisions every account. No self-service. No payment integration.

### Acceptance criteria for Phase 1 go-live
- [ ] A second org can be provisioned in under 10 minutes without touching raw SQL.
- [ ] A MANAGER from Org A cannot read, write, or enumerate any data belonging to Org B.
- [ ] Any beta participant's access can be revoked within 5 minutes.
- [ ] Public-facing routes (triage, listings) correctly scope to the right org.
- [ ] Login brute-force is rate-limited.

---

### B-1 · Fix public routes hardcoded to `DEFAULT_ORG_ID` 🔴 CRITICAL

**Why it blocks beta:** The moment a second org exists, `POST /triage`, `GET /listings`, `GET /vacant-units`, `POST /rental-applications`, and all capture-session routes will all silently operate against `"default-org"`. A tenant of Org B submitting a maintenance triage would create a `Request` inside Org A.

**Files to change:**
- `apps/api/src/server.ts` — the three `isPublicRentalRoute`, `isPublicCaptureRoute`, and auth-route dispatch blocks that pass `DEFAULT_ORG_ID`.

**Design decision — org discriminator on public routes:**  
Choose one strategy and apply it consistently:

| Option | Mechanism | Notes |
|--------|-----------|-------|
| **A** — Org slug in URL path | `/o/:orgSlug/triage`, `/o/:orgSlug/listings` | Clean URLs, requires frontend changes |
| **B** — `X-Org-Id` request header | Set by the Next.js proxy layer | No URL change, easier short-term |
| **C** — Custom subdomain | `orgslug.sencilo.ch` → resolved server-side | Best UX long-term, complex infra |

**Recommended for beta:** Option B — the Next.js proxy already wraps every API call; add a `NEXT_PUBLIC_ORG_ID` env var per deployment and have the proxy inject `X-Org-Id`. Server reads it on public routes, validates it is a real org (DB lookup), then dispatches with that `orgId`.

**Implementation steps:**
1. Add `NEXT_PUBLIC_ORG_ID` to `apps/web/.env.local` (and Vercel per-deployment env).
2. Update `proxyToBackend()` in `apps/web/lib/api.js` to inject `X-Org-Id: process.env.NEXT_PUBLIC_ORG_ID` on every request.
3. In `server.ts`, replace the three `DEFAULT_ORG_ID` dispatch blocks with:
   ```typescript
   const publicOrgId = req.headers["x-org-id"] as string | undefined;
   if (!publicOrgId) { sendError(res, 400, "MISSING_ORG", "Org context required"); return; }
   const org = await prisma.org.findUnique({ where: { id: publicOrgId } });
   if (!org) { sendError(res, 404, "NOT_FOUND", "Org not found"); return; }
   const handled = await router.dispatch(req, res, path, query, publicOrgId, prisma);
   ```
4. Update `triage` and public listing frontend pages to pass no explicit orgId (it comes from the header).

**Effort:** 1 day

---

### B-2 · Admin provisioning API — replace raw SQL workflow 🔴 CRITICAL

**Why it blocks beta:** Today onboarding a new org requires: (1) running `create-supabase-user.sql` in the Supabase SQL Editor, (2) manually running `UPDATE auth.users SET raw_app_meta_data = ...`. This is error-prone and does not scale past 2–3 orgs.

**New endpoints (guarded by `ADMIN_API_KEY` header — a long random secret in env, never a JWT):**

```
POST /admin/orgs
  Body: { name, mode? }
  Creates: Org + OrgConfig (defaults)
  Returns: { orgId, name }

POST /admin/orgs/:orgId/users
  Body: { email, name, role, supabaseId? }
  Creates: User row; optionally sets Supabase app_metadata via Admin API
  Returns: { userId, email, role, orgId }

PATCH /admin/users/:userId/deactivate
  Sets: User.isActive = false (see B-4)
  Returns: { userId, deactivatedAt }

GET /admin/orgs
  Returns: [{ orgId, name, userCount, createdAt }]
```

**Files to create/change:**
- `apps/api/src/routes/admin.ts` — new route file, all routes guarded by `requireAdminApiKey()`.
- `apps/api/src/services/adminService.ts` — org + user creation logic, Supabase Admin API call.
- Register in `server.ts`.

**Security:** The `ADMIN_API_KEY` check must short-circuit before any JWT logic runs. Never expose these endpoints in the OpenAPI spec or the `api-client` package.

**Effort:** 1–2 days

---

### B-3 · `User.isActive` flag — access revocation 🔴 HIGH

**Why it blocks beta:** If a beta participant leaves or misbehaves, there is no way to revoke access short of deleting rows in two databases.

**Schema change:**
```prisma
model User {
  // ...existing fields...
  isActive     Boolean  @default(true)
  deactivatedAt DateTime?
}
```

**Auth check:** In `server.ts` `resolvePrismaUserId()` (the function that maps Supabase UUID → Prisma User), after resolving the user, check `user.isActive`. If `false`, respond `403 ACCOUNT_DISABLED` before the request reaches any route handler.

**Migration:** `npx prisma migrate dev --name add_user_is_active`

**Effort:** 0.5 day (schema + one auth check + admin endpoint from B-2)

---

### B-4 · Rate-limit `POST /auth/login` 🟡 HIGH

**Why it matters for beta:** `POST /triage` is already rate-limited (10 req/min/IP, SA-18). Login is not. A compromised beta participant's email could be brute-forced.

**Implementation:** Apply the same in-memory IP rate limiter pattern already in `routes/captureSessions.ts` (SA-21):

```typescript
// At top of registerAuthRoutes()
const LOGIN_RATE_LIMIT = 10; // per minute per IP
const loginRateLimitMap = new Map<string, { count: number; resetAt: number }>();

function checkLoginRateLimit(ip: string): boolean { /* same pattern as SA-21 */ }
```

Apply to: `POST /auth/login`, `POST /auth/register` (even though registration is locked, the endpoint is public).

**Effort:** 2 hours

---

### B-5 · RLS defence-in-depth policies on top-10 sensitive tables 🟡 HIGH

**Why it matters for beta:** RLS is enabled on all 72 tables but has zero policies (intentional per 2026-05-13 note). The app layer enforces `orgId` filtering, but ARCH-1 leaves 362 service-level Prisma calls that may or may not include `orgId` in every query path. RLS policies are the safety net that catches what the app misses.

**Approach — application-level `app.current_org_id` setting:**

Add a Prisma middleware (or a helper called at the top of each request) that sets a PostgreSQL session variable:
```sql
SET LOCAL app.current_org_id = '<orgId>';
```

Then add RLS policies on the 10 highest-sensitivity tables:

```sql
-- Example for Building (repeat pattern for all tables)
CREATE POLICY org_isolation ON "Building"
  AS PERMISSIVE FOR ALL
  TO PUBLIC
  USING (org_id = current_setting('app.current_org_id', true));
```

**Tables to cover (priority order):**
1. `Building` — contains property addresses
2. `Tenant` — PII
3. `Lease` — financial contracts
4. `Invoice` — financial records
5. `Request` — maintenance history
6. `Job` — contractor work orders
7. `User` — user accounts
8. `LedgerEntry` — accounting data
9. `CaptureSession` — uploaded documents
10. `BillingEntity` — payment details

**Caveat:** The service_role key (used by the API) bypasses RLS. The policies only fire if a future code path uses the `anon` or `authenticated` role directly against Supabase PostgREST. Still valuable as a defence-in-depth layer and for future-proofing.

**Effort:** 1 day (migration + integration test verifying RLS fires on direct PostgREST call)

---

### B-6 · Audit ARCH-1 service calls for missing `orgId` filters 🟡 HIGH

**Why it matters for beta:** The 362 direct `prisma.*` calls in services (DT-120–DT-124) are the code-level risk. Most already pass `orgId` (spot-check above confirmed `invoices.ts`, `leases.ts`, `chargeReconciliationService.ts` all guard correctly). The real risk is in the less-tested paths.

**Scoped beta task (not the full DT-120–124 migration):** Audit each of the seven heaviest offenders for *missing* `orgId` filters specifically. A full repository-layer migration can wait for Phase 2.

**Files to audit and patch (by call count):**
| File | Calls | Action |
|------|-------|--------|
| `services/leases.ts` | 31 | Spot-check each `findUnique` — verify ID lookups are followed by `if (result.orgId !== orgId) throw` |
| `services/legalService.ts` | 20 | Audit `listVariables`, `listRules`, `listEvaluations` — must include `where: { orgId }` |
| `services/ledgerService.ts` | 16 | Audit `getLedgerEntries`, `getAccountBalance` — both use `const where: any = { orgId }` (confirmed safe) |
| `services/tenants.ts` | 15 | Audit `getTenant`, `listTenants` for orgId presence |
| `services/rentalApplications.ts` | 15 | Audit `listApplications`, `getApplication` for orgId presence |
| `services/invoices.ts` | 15 | Confirmed safe — `orgId` always in `where` |
| `services/financials.ts` | 15 | Audit building financial snapshots for orgId scoping |

**Output:** A short internal report documenting which calls were verified safe and which needed a patch. Add a regression test for each patched call.

**Effort:** 2–3 days

---

### B-7 · `GET /health` endpoint 🟢 LOW

**Why useful for beta:** Render's health-check currently relies on process uptime. A real health endpoint (`SELECT 1` against the DB) enables zero-downtime redeploys and early alert on DB connection loss.

```typescript
router.get("/health", async ({ res, prisma }) => {
  await prisma.$queryRaw`SELECT 1`;
  sendJson(res, 200, { status: "ok", timestamp: new Date().toISOString() });
});
```

**Effort:** 1 hour

---

### Phase 1 Summary

| ID | Priority | Effort | Deliverable |
|----|----------|--------|-------------|
| B-1 | 🔴 Critical | 1 day | Org-discriminated public routes via `X-Org-Id` header |
| B-2 | 🔴 Critical | 1–2 days | `POST /admin/orgs`, `POST /admin/orgs/:id/users`, `GET /admin/orgs` |
| B-3 | 🔴 High | 0.5 day | `User.isActive` + deactivation in auth middleware |
| B-4 | 🟡 High | 2 hours | Rate-limit `POST /auth/login` and `/auth/register` |
| B-5 | 🟡 High | 1 day | RLS policies on 10 sensitive tables |
| B-6 | 🟡 High | 2–3 days | ARCH-1 orgId audit of 7 heaviest service files |
| B-7 | 🟢 Low | 1 hour | `GET /health` with DB ping |
| **Total** | | **~7–9 days** | |

---

---

## Phase 2 — Full SaaS Target Operating Model

> **Goal:** Any property manager in Switzerland can discover Sencilo, create an account, invite their team, choose a plan, pay by card, and be fully operational — all without human intervention. Admin retains super-admin tooling for support and compliance.

### Acceptance criteria for Phase 2 go-live
- [ ] A new customer can sign up, provision their org, and create their first property in under 15 minutes.
- [ ] A new team member can accept an email invitation and access the correct org with no admin action.
- [ ] Subscription state is enforced — expired or over-limit orgs are gracefully blocked.
- [ ] An org can request data export and account deletion (GDPR compliance).
- [ ] Staging and production use separate Supabase projects.
- [ ] MFA is available (opt-in) for MANAGER accounts.

---

### S-1 · Org self-registration flow 🔴 CRITICAL

**Scope:** End-to-end path from `/signup` to a fully provisioned org with the first MANAGER logged in.

**Backend — new `POST /orgs` endpoint (public, rate-limited):**
```typescript
// Body: { orgName, adminEmail, adminName }
// 1. Create Org + OrgConfig
// 2. Call Supabase Admin API: createUser({ email, password: auto-generated })
// 3. Set raw_app_meta_data: { appRole: "MANAGER", orgId: newOrg.id, accessLevel: "ADMIN" }
// 4. Create User row in Prisma { orgId, role: MANAGER, supabaseId }
// 5. Trigger Supabase magic-link email so admin sets their password on first login
// Returns: { orgId, userId } — 201
```

**Frontend — `/signup` page:**
- Org name, admin full name, email fields.
- On submit: calls `POST /orgs` → redirects to `/login` with a success banner ("Check your email to complete setup").
- Bilingual (EN/FR) using `common` namespace.

**Rate limiting:** 5 org creations per IP per hour (abuse prevention).

**Files to create/change:**
- `apps/api/src/routes/orgs.ts` — new route file.
- `apps/api/src/services/orgProvisioningService.ts` — org + user creation + Supabase Admin API call.
- `apps/web/pages/signup.js` — new page (unauthenticated).
- `apps/web/pages/api/orgs/index.js` — proxy.
- `apps/web/public/locales/en/common.json` + `fr/common.json` — signup strings.

**Effort:** 3–4 days

---

### S-2 · Team invitation system 🔴 CRITICAL

**Scope:** A MANAGER can invite colleagues (MANAGER, CONTRACTOR, OWNER roles) and they can onboard themselves via a time-limited signed link.

**Schema additions:**
```prisma
model Invitation {
  id          String           @id @default(uuid())
  orgId       String
  email       String
  role        Role
  token       String           @unique @default(uuid())
  expiresAt   DateTime
  acceptedAt  DateTime?
  createdBy   String           /// User.id of the inviting MANAGER
  createdAt   DateTime         @default(now())
  org         Org              @relation(fields: [orgId], references: [id], onDelete: Cascade)

  @@index([orgId])
  @@index([token])
}
```

**New endpoints:**
```
POST   /orgs/:orgId/invitations     — MANAGER only; create + send email
GET    /invitations/:token          — public; returns { email, role, orgName, expired }
POST   /invitations/:token/accept   — public; body: { name, password }
                                      → creates Supabase user + Prisma User row
DELETE /orgs/:orgId/invitations/:id — MANAGER only; revoke pending invite
GET    /orgs/:orgId/invitations     — MANAGER only; list pending invites
```

**Frontend pages:**
- `/invite/[token]` — accept form (name + password fields), shows org name and role.
- `/manager/settings/team` — list of users in org + pending invites; invite button opens a modal.

**Email delivery:** Use the existing `EmailOutbox` model / email service for the invitation email. Template: subject "You've been invited to {orgName} on Sencilo", body with the accept link (`/invite/{token}`).

**Effort:** 4–5 days

---

### S-3 · Subscription & billing (Stripe) 🔴 CRITICAL

**Scope:** Plan tiers, payment, and enforcement gates.

**Schema additions:**
```prisma
model Plan {
  id              String         @id @default(uuid())
  name            String         // "Starter" | "Pro" | "Enterprise"
  priceChfCents   Int            // Monthly price
  maxUnits        Int?           // null = unlimited
  maxUsers        Int?
  maxBuildings    Int?
  stripePriceId   String         @unique
  subscriptions   Subscription[]
}

model Subscription {
  id                    String             @id @default(uuid())
  orgId                 String             @unique
  planId                String
  stripeCustomerId      String
  stripeSubscriptionId  String             @unique
  status                SubscriptionStatus @default(TRIALING)
  currentPeriodEnd      DateTime
  cancelledAt           DateTime?
  createdAt             DateTime           @default(now())
  updatedAt             DateTime           @updatedAt
  org                   Org                @relation(fields: [orgId], references: [id])
  plan                  Plan               @relation(fields: [planId], references: [id])

  @@index([orgId])
}

enum SubscriptionStatus {
  TRIALING
  ACTIVE
  PAST_DUE
  CANCELLED
  PAUSED
}
```

**Backend work:**
- `POST /billing/checkout` — MANAGER only; creates Stripe Checkout Session; returns `{ checkoutUrl }`.
- `POST /billing/portal` — MANAGER only; creates Stripe Customer Portal session.
- `POST /webhooks/stripe` — public, signature-verified; handles `invoice.paid`, `invoice.payment_failed`, `customer.subscription.deleted`, `customer.subscription.updated`.
- `GET /billing/subscription` — MANAGER only; returns current plan + status.
- `planEnforcementMiddleware` — called inside router dispatch for mutating routes; reads org's `Subscription`, checks limits (unit count, user count), returns `402 PLAN_LIMIT_EXCEEDED` with a clear message if over.

**Frontend pages:**
- `/pricing` — public marketing page showing plan tiers.
- `/manager/settings/billing` — shows current plan, usage meters, "Upgrade" / "Manage" buttons.
- `/manager/settings/billing/checkout` — Stripe Checkout redirect handler.

**Trial period:** All new orgs start with a 14-day `TRIALING` subscription at the Pro plan. No card required during trial.

**Effort:** 6–8 days

---

### S-4 · Full ARCH-1 service → repository migration 🟡 HIGH

**Scope:** Complete DT-120 through DT-124 — migrate all 362 direct `prisma.*` calls in services to use repository functions with canonical `_INCLUDE` constants. This is required before GA to:
- Make `orgId` scoping auditable in one place per model (the repository).
- Enable RLS policies that rely on repository-level consistency.
- Eliminate `any` type risks that slipped through DT-125.

**Slices (from ROADMAP.json):**
| Slice | Files | Call count |
|-------|-------|-----------|
| DT-120 | `leases.ts`, `rentalApplications.ts` | ~46 |
| DT-121 | `legalService.ts`, `ledgerService.ts` | ~36 |
| DT-122 | `tenants.ts`, `invoices.ts` | ~30 |
| DT-123 | `financials.ts`, `chargeReconciliationService.ts`, `recurringBillingService.ts` | ~40 |
| DT-124 | Remaining 27 service files | ~210 |

**Effort:** 8–12 days (can be parallelised across slices)

---

### S-5 · Per-org Org settings UI + user management 🟡 HIGH

**Scope:** Self-service admin panel for MANAGER role.

**Pages to build:**
- `/manager/settings` — hub page with tabs: General | Team | Billing | Landlord Info.
- **General tab:** Edit org name, `OrgConfig` fields (auto-approve limit, invoice lead time), org mode.
- **Team tab:** List all `User` rows for the org; show role badge, joined date, active status. Actions: Invite (opens modal, see S-2), Deactivate (calls `PATCH /admin/users/:id/deactivate`), Change role.
- **Landlord Info tab:** Edit `OrgConfig` landlord fields (name, address, zip/city, phone, email, representative) — already in the schema, not yet exposed in UI.
- **Billing tab:** Delegate to S-3 billing page.

**Effort:** 3–4 days

---

### S-6 · GDPR — data export and org deletion 🟡 HIGH

**Scope:** Compliance with GDPR Art. 17 (erasure) and Art. 20 (portability).

**Data export:**
- `POST /orgs/:orgId/export` — MANAGER only, triggers an async job that serialises all org data to a JSON zip (buildings, units, tenants, leases, invoices, requests).
- Deliver via email link (pre-signed storage URL, 24-hour TTL).

**Org deletion:**
- `DELETE /orgs/:orgId` — MANAGER only, guarded by: (1) active subscription must be cancelled, (2) confirmation token sent to admin email.
- Cascades via Prisma `onDelete: Cascade` (already set on most relations).
- Revokes all Supabase auth users in the org via Admin API.

**Effort:** 3–4 days

---

### S-7 · MFA (TOTP) for MANAGER accounts 🟡 MEDIUM

**Scope:** Supabase already supports TOTP MFA via `supabase.auth.mfa.*`. Wire it into the login flow.

**Changes:**
- Post-login: check `supabase.auth.mfa.getAuthenticatorAssuranceLevel()`. If MANAGER and AAL < `aal2`, redirect to `/mfa-challenge`.
- `/mfa-challenge` — enter TOTP code page.
- `/manager/settings/security` — enrol/unenrol authenticator app.

**Policy (recommended):** MFA opt-in for all roles during trial; MFA required for MANAGER on Pro/Enterprise plans.

**Effort:** 2–3 days

---

### S-8 · Org-discriminated public routes via org slug (URL-based) 🟢 MEDIUM

**Scope:** Upgrade the beta `X-Org-Id` header approach (B-1) to proper URL-based org discrimination.

**Changes:**
- Add `slug String @unique` to the `Org` model (migration + auto-derive from name on creation).
- Public routes become: `/o/:slug/triage`, `/o/:slug/listings`, `/o/:slug/rental-applications`.
- Frontend: update triage page and listing page URLs.
- Server: resolve slug → orgId before dispatch.

This enables white-label sub-paths (`sencilo.ch/o/my-property-mgmt/triage`) without custom domains.

**Effort:** 2 days

---

### S-9 · Separate Supabase projects per environment 🟢 MEDIUM

**Why it matters:** Currently staging and production share a Supabase project. A staging JWT is technically valid against the production DB if the `AUTH_SECRET` is the same. Before GA, use separate Supabase projects (or Supabase branch environments) to enforce environment isolation.

**Changes:**
- Create a new Supabase project for production.
- Update Render and Vercel env vars (`SUPABASE_URL`, `SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`) per environment.
- Re-run `scripts/create-supabase-user.sql` in production project.
- Document in `docs/DEV_COMMANDS.md`.

**Effort:** 0.5 day (mostly config, no code changes)

---

### S-10 · Per-org activity/audit log 🟢 LOW

**Scope:** Surface the existing `Event` table (already in schema, partially populated) as a per-org audit trail visible to MANAGER.

**Changes:**
- Ensure every workflow emits an `Event` record (audit existing workflows for gaps).
- `GET /orgs/:orgId/events` — MANAGER only; paginated; filterable by type, date range, actorUserId.
- `/manager/settings/activity` tab — table of recent events with actor, type, timestamp.

**Effort:** 2–3 days

---

### Phase 2 Summary

| ID | Priority | Effort | Deliverable |
|----|----------|--------|-------------|
| S-1 | 🔴 Critical | 3–4 days | Self-registration `/signup` + `POST /orgs` |
| S-2 | 🔴 Critical | 4–5 days | Invitation system (schema + routes + UI) |
| S-3 | 🔴 Critical | 6–8 days | Stripe subscriptions, plan tiers, enforcement middleware |
| S-4 | 🟡 High | 8–12 days | Full ARCH-1 service → repository migration (DT-120–124) |
| S-5 | 🟡 High | 3–4 days | Org settings UI (General, Team, Landlord Info, Billing tabs) |
| S-6 | 🟡 High | 3–4 days | GDPR data export + org deletion |
| S-7 | 🟡 Medium | 2–3 days | MFA (TOTP) via Supabase `auth.mfa.*` |
| S-8 | 🟢 Medium | 2 days | URL-based org slug (upgrade from X-Org-Id header) |
| S-9 | 🟢 Medium | 0.5 day | Separate Supabase projects (staging vs production) |
| S-10 | 🟢 Low | 2–3 days | Per-org activity/audit log UI |
| **Total** | | **~34–46 days** | |

---

## Combined Effort Overview

| Phase | Focus | Calendar estimate |
|-------|-------|------------------|
| Phase 1 — Beta | Data isolation, admin provisioning, revocation | 7–9 engineering days |
| Phase 2 — SaaS GA | Self-service, billing, compliance, architecture hardening | 34–46 engineering days |
| **Total to GA** | | **~41–55 engineering days** |

---

## Dependency Graph

```
B-1 (public route org fix)    ──► must ship before any 2nd org is provisioned
B-2 (admin provisioning API)  ──► unlocks beta onboarding
B-3 (isActive flag)           ──► B-2 (deactivate endpoint lives there)
B-4 (login rate limit)        ──► independent
B-5 (RLS policies)            ──► independent (but more valuable after B-6)
B-6 (ARCH-1 audit)            ──► independent; feeds into S-4

S-1 (self-registration)       ──► S-2 (invitations assume an org exists)
S-2 (invitations)             ──► S-5 (team management UI)
S-3 (Stripe billing)          ──► S-1 (subscription created at org sign-up)
S-4 (full ARCH-1 migration)   ──► B-6 (beta audit is a prerequisite pass)
S-6 (GDPR)                    ──► S-3 (deletion must cancel subscription first)
S-8 (org slugs)               ──► S-1 (slug assigned at org creation)
S-9 (separate Supabase)       ──► must complete before S-1 goes live in production
```

---

## What is Already Production-Ready (no action needed)

- Per-org `orgId` scoping on all 72 schema models.
- JWT + Supabase auth with role enforcement (`requireRole`, `requireAnyRole`, `requireTenantSession`).
- `ALLOW_PUBLIC_REGISTRATION=false` locks down self-registration in production.
- `Request` model has `orgId` (historical gap now resolved in schema).
- Contractor IDOR fixed — identity derived from JWT email, never a query param.
- RLS enabled on all 72 tables (policies are Phase 1 B-5 work).
- Pre-commit hook blocks `.env*` files and secret patterns (G18).
- Production boot guards prevent `AUTH_OPTIONAL=true` or `DEV_IDENTITY_ENABLED=true` from shipping.
- Bilingual EN/FR UI — all strings via `next-i18next`.
- Supabase magic-link + password login, first-time `/set-password` flow, `/reset-password` PKCE exchange.
