# Contributing to Maintenance Agent

## Testing

### Pre-commit checks

```bash
# From the repo root
npx tsc --noEmit --project apps/api/tsconfig.json   # must produce zero errors
npm test --prefix apps/api                           # must pass all tests (57 suites — last verified 2026-04-03)
```

Both must be green before merging.

---

### Integration test structure

All server-spawning test suites use the shared helpers in
`apps/api/src/__tests__/testHelpers.ts`. Do **not** copy-paste a local `startServer`
function — use the canonical helpers.

```ts
import { ChildProcessWithoutNullStreams } from 'child_process';
import { startTestServer, stopTestServer } from './testHelpers';

const PORT = 3221; // unique — see port registry below
const API_BASE = `http://127.0.0.1:${PORT}`;

describe('My feature', () => {
  let proc: ChildProcessWithoutNullStreams;

  beforeAll(async () => {
    proc = await startTestServer(PORT, { AUTH_OPTIONAL: 'true', NODE_ENV: 'test' });
  }, 20000);

  afterAll(() => stopTestServer(proc));

  it('works', async () => { /* ... */ });
});
```

**Key points:**
- `startTestServer(port, envOverrides?)` — resolves once the server emits `"API running on"`, rejects after 15 s.
- `stopTestServer(proc)` — sends SIGTERM and **awaits full process exit** before resolving. This prevents port leaks between serially-run suites.
- `afterAll` must `return` or `await` the stop call so Jest waits for it.

**Auth modes:**

`AUTH_OPTIONAL: 'true'` bypasses JWT checks — use this for suites that test business
logic rather than auth boundaries. Use `AUTH_OPTIONAL: 'false'` with explicit
`Authorization: Bearer <token>` headers when testing auth enforcement (401/403 gates).

**Token helpers:**

```ts
import { createManagerToken, createContractorToken, createTenantToken, getAuthHeaders } from './testHelpers';

const token = createManagerToken('my-org-id');
const res = await fetch(`${API_BASE}/some-route`, {
  headers: getAuthHeaders(token),
});
```

`AUTH_SECRET` is set to `"test-secret"` globally via `jestSetup.ts` — tokens created
in the test process are automatically valid against all test servers.

---

### Port registry

Every test suite that spawns a server **must use a unique hardcoded port**. Sharing
ports causes `EADDRINUSE` failures.

| Port | Suite |
|------|-------|
| 3101 | auth.manager-gates.test.ts (required-auth server) |
| 3102 | auth.manager-gates.test.ts (optional-auth server) |
| 3103 | ownerDirect.governance.test.ts |
| 3201 | requests.test.ts |
| 3202 | workflows.test.ts |
| 3203 | ownerDirect.foundation.test.ts |
| 3204 | inventory.test.ts |
| 3205 | contracts.test.ts |
| 3206 | rentalContracts.test.ts |
| 3207 | rentalIntegration.test.ts |
| 3208 | legalEngine.test.ts |
| 3209 | assetInventory.test.ts |
| 3210 | ia.test.ts |
| 3211 | maintenanceAttachments.test.ts |
| 3212 | tenantSelfPay.test.ts |
| 3213 | tenantAttachments.test.ts |
| 3214 | contractorRfp.test.ts |
| 3215 | rfpFallback.test.ts |
| 3216 | scheduling.test.ts |
| 3217 | completion.test.ts |
| 3218 | tenantSession.test.ts |
| 3219 | rentEstimation.test.ts |
| 3220 | security2.test.ts |
| 3221 | captureSession.test.ts |
| 3222 | invoiceIngest.test.ts |
| 3223 | assetHealthForecast.test.ts |

**Next available: 3224.** Claim the next port and add it to this table in the same PR.

---

### API contract tests (`contracts.test.ts`)

`src/__tests__/contracts.test.ts` is the **DTO guard-rail**. It asserts the response
envelope shape of every public endpoint so that a renamed field or dropped property
fails a test instead of silently breaking the frontend.

**Add a contract test whenever you:**
- Add a new endpoint
- Change a DTO field name or type
- Add or remove a required field from a response

Pattern:

```ts
describe('GET /my-endpoint?limit=1', () => {
  it('returns envelope with expected shape', async () => {
    const body = await fetchJson('/my-endpoint?limit=1');
    expect(Array.isArray(body.data)).toBe(true);
    expect(typeof body.total).toBe('number'); // if paginated

    if (body.data.length > 0) {
      expectKeys(body.data[0], ['id', 'orgId', 'status', 'createdAt'], 'MyDTO');
    }
  });
});
```

`contracts.test.ts` runs on PORT 3205 with `AUTH_OPTIONAL: 'true'`. Endpoints that
require role-specific tokens (e.g. tenant portal routes) use `getAuthHeaders(createTenantToken())`.

**Update the contract test in the same PR as any DTO change.** If you change a field
name and the contract test fails, update the test — do not delete it.

---

### Architecture guardrails (quick reference)

| Rule | Description |
|------|-------------|
| G1 | No schema migrations without a migration file in `prisma/migrations/` — adding a field to `schema.prisma` without a matching migration breaks all DB-touching tests |
| G2 | Every new Prisma model needs a canonical include constant |
| G9 | Route handlers must not call `prisma` directly — delegate to services or repositories |
| G10 | Update `contracts.test.ts` when changing a DTO |
| G11 | Test DB requires seed after fresh creation (see PROJECT_STATE.md) |
| G12 | Commit every deliverable — no session-long uncommitted work |
| G13 | Frontend + backend = one atomic commit |
| G14 | Session-end: verify nothing valuable is left uncommitted |
| G15 | Never `git stash drop` without inspection; prefer `stash branch` |

Full guardrail list: `PROJECT_OVERVIEW.md`
File-routing map: `apps/api/src/ARCHITECTURE_LOW_CONTEXT_GUIDE.md`
