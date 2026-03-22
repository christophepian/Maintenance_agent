# Contributing to Maintenance Agent

## Testing

### Running tests

```bash
# All tests
npm test --prefix apps/api

# Type-check (no emit)
npx tsc --noEmit --project apps/api/tsconfig.json

# Both before committing
npx tsc --noEmit --project apps/api/tsconfig.json && npm test --prefix apps/api
```

All 518 tests must pass before merging. Zero TypeScript errors required.

---

### Integration test structure

Each test suite that needs a live API server follows the same pattern:

```ts
import { spawn, ChildProcessWithoutNullStreams } from 'child_process';
import * as path from 'path';

const API_ROOT = path.resolve(__dirname, '..', '..');
const TS_NODE  = path.resolve(API_ROOT, 'node_modules', '.bin', 'ts-node');
const PORT     = 3205; // unique — see port registry below
const API_BASE = `http://127.0.0.1:${PORT}`;

function startServer(envOverrides: Record<string, string>, port: number) {
  return new Promise<ChildProcessWithoutNullStreams>((resolve, reject) => {
    const child = spawn(TS_NODE, ['--transpile-only', 'src/server.ts'], {
      cwd: API_ROOT,
      env: {
        ...process.env,
        PORT: String(port),
        AUTH_SECRET: 'test-secret',
        AUTH_OPTIONAL: 'false',
        NODE_ENV: 'test',
        BG_JOBS_ENABLED: 'false',
        ...envOverrides,
      },
      stdio: ['ignore', 'pipe', 'pipe'],
    });

    const onData = (data: Buffer) => {
      if (data.toString().includes('API running on')) { cleanup(); resolve(child); }
    };
    const onError = (err: Error) => { cleanup(); reject(err); };
    const cleanup = () => {
      clearTimeout(timer);
      child.stdout.off('data', onData);
      child.stderr.off('data', onData);
      child.off('error', onError);
    };

    child.stdout.on('data', onData);
    child.stderr.on('data', onData);
    child.on('error', onError);
    const timer = setTimeout(() => { cleanup(); reject(new Error('Server did not start within 15s')); }, 15000);
  });
}

describe('My feature', () => {
  let proc: ChildProcessWithoutNullStreams;

  beforeAll(async () => {
    proc = await startServer({ AUTH_OPTIONAL: 'true' }, PORT);
  }, 20000);

  afterAll(() => { if (proc) proc.kill(); });

  it('works', async () => { /* ... */ });
});
```

**AUTH_OPTIONAL: 'true'** bypasses JWT checks. Use `AUTH_OPTIONAL: 'false'` with explicit
`Authorization: Bearer <token>` headers when testing auth behaviour.

For token generation use the helpers in `src/__tests__/testHelpers.ts`:

```ts
import { createManagerToken, createContractorToken, getAuthHeaders } from './testHelpers';

const token = createManagerToken('my-org-id');
const res = await fetch(`${API_BASE}/some-route`, {
  headers: { ...getAuthHeaders(token) },
});
```

---

### Port registry

Every test suite that spawns a server **must use a unique hardcoded port**. Sharing ports
causes `EADDRINUSE` failures in parallel runs.

| Port | Suite |
|------|-------|
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

**Next available: 3220.** When adding a new suite, claim the next port and add it to this table
in the same PR.

---

### API contract tests (`contracts.test.ts`)

`src/__tests__/contracts.test.ts` is the **DTO guard-rail**. It asserts the response envelope
shape of every public endpoint so that a renamed field or dropped property fails a test instead
of silently breaking the frontend.

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

**Update the contract test in the same PR as any DTO change.** If you change a field name and
the contract test fails, update the test — do not delete it.

---

### Architecture guardrails (quick reference)

| Rule | Description |
|------|-------------|
| G1 | No schema migrations without a migration file in `prisma/migrations/` |
| G2 | Every new Prisma model needs a canonical include constant |
| G9 | Route handlers must not call `prisma` directly — delegate to services or repositories |
| G10 | Update `contracts.test.ts` when changing a DTO |
| G11 | No stub services — every service must have real implementation |

Full guardrail list: `apps/api/src/ARCHITECTURE_LOW_CONTEXT_GUIDE.md`
