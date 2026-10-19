# Public onboarding demo — setup runbook

The demo link walks anyone through the first-login wizard with no account, then
signs them into a **read-only** demo account and lands them on a real building's
Reporting tab, populated by a synthetic régie package run through the real
onboarding pipeline.

This runs on the **sandbox stack only** (isolated Vercel + Render + Supabase).
It is inert everywhere else: `/api/demo/session` 404s unless
`NEXT_PUBLIC_SANDBOX=true`, and the `/sandbox/*` routes are not registered
unless `SANDBOX_MODE=true`.

Final link: `https://<sandbox-vercel-url>/onboarding?demo=1`

---

## What is already built

| Piece | Where |
|---|---|
| Synthetic régie package (deterministic, no real data) | `apps/api/src/services/demoPackage.ts` |
| Seeder — runs the package through `commitPackage` | `apps/api/src/services/demoSeedService.ts` |
| `POST /sandbox/demo-seed` (SANDBOX_MODE only) | `apps/api/src/routes/sandbox.ts` |
| `demoReadOnly` claim + choke-point guard | `apps/api/src/services/auth.ts`, `apps/api/src/server.ts` |
| `POST /api/demo/session` — session mint | `apps/web/pages/api/demo/session.js` |
| Wizard finish → building Reporting tab | `apps/web/pages/onboarding/index.js` |

## Steps that need your hands

These need credentials to the **sandbox** Supabase project (`ccxmfgaterriqownbtud`),
Render service and Vercel project, which the coding environment doesn't have.

### 1. Create the demo user (sandbox Supabase → SQL editor)

Use `apps/api/scripts/create-supabase-user.sql` (the single `DO $$` block
version — omit `phone`/`phone_change`, see the sandbox notes). Give it a real
password; that password becomes `DEMO_ACCOUNT_PASSWORD`.

Suggested identity: `demo@stoneiq.ch`.

### 2. Mark the account read-only and give it an org

```sql
update auth.users
set raw_app_meta_data = raw_app_meta_data
  || '{"appRole":"OWNER","accessLevel":"APP_USER","demoReadOnly":true,"orgId":"demo-org"}'::jsonb
where email = 'demo@stoneiq.ch';
```

`demoReadOnly` is what makes the API refuse every mutating request from this
account. **Without it `/api/demo/session` refuses to hand out the session**, so a
misconfiguration fails closed rather than exposing a writable public account.

Use a dedicated `orgId` (e.g. `demo-org`) so the demo building can never mix with
a real tester's data. Make sure a matching `Org` row exists in the sandbox
database, or building creation fails on the foreign key:

```sql
insert into "Org" (id, name) values ('demo-org', 'StoneIQ Demo')
on conflict (id) do nothing;
```

### 3. Allowlist it (sandbox gates login on `beta_testers`)

```sql
insert into public.beta_testers (email, status, trial_starts_at, trial_expires_at)
values ('demo@stoneiq.ch', 'active', now(), now() + interval '10 years');
```

### 4. Set the Vercel env vars (sandbox project, all environments)

```
DEMO_ACCOUNT_EMAIL=demo@stoneiq.ch
DEMO_ACCOUNT_PASSWORD=<the password from step 1>
```

`NEXT_PUBLIC_SANDBOX=true` should already be set. Confirm Deployment Protection
is **off** on the sandbox project, or external visitors get an SSO wall.

### 5. Promote the code to the sandbox branch

```bash
git checkout sandbox && git merge main && git push origin sandbox && git checkout main
```

(Never the other direction — see the deploy notes.) If Vercel doesn't pick the
push up, trigger the deploy hook listed in the sandbox notes.

### 6. Smoke-test

1. Open `https://<sandbox-vercel-url>/onboarding?demo=1` in a private window.
2. Walk the wizard; finish.
3. You should land on the demo building's **Reporting** tab with populated KPIs
   and a year-over-year comparison.
4. Try to edit something — it must fail with `DEMO_READ_ONLY`.

## Expected seeded figures

Deterministic, so a demo can be scripted around them. For the last complete
fiscal year:

- 12 units (8 apartments + 4 parking), 2 deliberately vacant
- 7 tenants, 10 leases, 26 vendor invoices per year
- Two fiscal years imported and approved, so YoY is populated
- NOI ≈ CHF 121,520 against ≈ CHF 116,329 the prior year
- Ledger imbalance 0

## Notes / limits

- The Render free tier cold-starts in 30–60s. The first demo visit after an idle
  period may be slow or error; a reload fixes it.
- The demo account is shared. Anything a visitor "changes" is refused by the API,
  so concurrent visitors can't disturb each other — but they do see the same
  building, so it is not a per-visitor sandbox.
- The seeder is idempotent and skips a fiscal year that already has an approved
  income statement, so repeat sign-ins don't accumulate statements.
