# Implementation Plan: Hard Blockers B1 and B2

> **Copilot / agent — read this section before writing any code.**

## Read first

1. `PROJECT_OVERVIEW.md` — guardrails, architecture, task routing
2. `apps/api/src/ARCHITECTURE_LOW_CONTEXT_GUIDE.md` — file-level lookup
3. `PROJECT_STATE.md` — canonical reference, full guardrail prose
4. `docs/AUDIT.md` — check any open findings that touch files you are about to modify
5. `apps/api/blueprint.js` — understand the existing storage and schema surface before adding anything

Obey all guardrails exactly. Preserve existing behaviour unless the step-by-step instructions below explicitly require a change.

## Inspect before writing any code

**For B2 (Prisma `directUrl`):**
1. Read `apps/api/prisma/schema.prisma` — confirm the `datasource db` block currently has only `url` and no `directUrl`.
2. Read `apps/api/.env.example` — confirm `DIRECT_URL` is not yet documented.
3. Read `.github/workflows/ci.yml` — confirm `DIRECT_URL` is absent from the `env:` block.

**For B1 (S3 storage):**
1. Read `apps/api/src/storage/attachments.ts` in full — understand the `AttachmentStorage` interface, `LocalDiskStorage`, the factory `createStorage()`, and the existing `case "s3": throw` stub.
2. Grep for every call site of `storage.` across `apps/api/src/` — confirm none need interface changes, only the factory implementation.
3. Read `apps/api/package.json` — confirm `@aws-sdk/client-s3` is not yet a dependency.
4. Read `apps/api/src/__tests__/` listing — confirm no `storage.test.ts` exists yet.

## Output a short confirmation before coding

Before writing a single line of implementation code, state:
- The exact current content of the `datasource db` block (B2)
- The exact current content of the `case "s3"` branch (B1)
- The complete list of `storage.*` call sites found (B1)
- Whether any existing test file already covers the storage module
- Confirmation that the `AttachmentStorage` interface requires no changes — only the factory

If any of these findings contradict the plan below, stop and flag the discrepancy rather than proceeding.

## Architecture rules for this work

- No business logic in routes; no direct Prisma calls outside repositories
- `prisma db push` is banned — use `prisma migrate dev --name <desc>` for any schema change
- The B2 migration must produce an **empty SQL body** — if `migrate dev` outputs DDL, stop and investigate
- The S3 implementation class belongs inside `apps/api/src/storage/attachments.ts` — do not create a new file
- No route, workflow, service, or repository file needs to change for either blocker
- Local dev must remain unaffected: `ATTACHMENTS_STORAGE=local` must continue to work without any S3 env vars present

---

**Status:** Planning only — no code written yet  
**Prerequisite:** `docs/MIGRATION_PLAN.md` must be read first for full context  
**Date:** 2026-04-29

---

## B2 — Add `directUrl` to Prisma Datasource

**Why it's needed:** Supabase's runtime connection URL goes through PgBouncer (port 6543, `?pgbouncer=true`). PgBouncer uses transaction-mode pooling, which is incompatible with `prisma migrate deploy` because migrations require a persistent session-mode connection. Prisma's `directUrl` field tells Prisma Client to use one URL for runtime queries and a different URL for migrations. Without it, `migrate deploy` on Render will fail.

**Scope:** One file changed, one empty migration, two env var updates.  
**Risk:** Zero — the generated migration body is empty; no table or column is modified.  
**Time estimate:** 30 minutes.

---

### B2 Step-by-Step

#### Step 1 — Edit `schema.prisma`

File: `apps/api/prisma/schema.prisma`

Change the `datasource db` block from:
```prisma
datasource db {
  provider = "postgresql"
  url      = env("DATABASE_URL")
}
```

To:
```prisma
datasource db {
  provider  = "postgresql"
  url       = env("DATABASE_URL")
  directUrl = env("DIRECT_URL")
}
```

No other changes to the schema file.

#### Step 2 — Generate and verify the empty migration

```bash
cd apps/api
npx prisma migrate dev --name add-direct-url-datasource
```

Expected output contains: `The migration '..._add_direct_url_datasource' was created and applied.`  
The generated migration SQL file must be empty (only comments, no DDL statements):
```
-- This is an empty migration.
```

If the migration file contains any SQL, stop and investigate — do not proceed.

#### Step 3 — Regenerate Prisma client

```bash
cd apps/api
npx prisma generate
```

Expected: clean output with no errors.

#### Step 4 — Verify zero drift

```bash
cd apps/api
npx prisma migrate diff \
  --from-schema-datasource ./prisma/schema.prisma \
  --to-schema-datamodel ./prisma/schema.prisma \
  --script
```

Expected output: `-- This is an empty migration.`  
If any SQL appears, do not commit — investigate the source of drift.

#### Step 5 — Update `.env.example`

File: `apps/api/.env.example`

Add below the `DATABASE_URL` line:
```
# DIRECT_URL is required when DATABASE_URL goes through a connection pooler (e.g. Supabase PgBouncer).
# For local Docker dev, set DIRECT_URL to the same value as DATABASE_URL.
# On Render, set DIRECT_URL to the Supabase direct connection URL (port 5432, no pgbouncer param).
DIRECT_URL=postgresql://user:password@localhost:5432/maint_agent
```

Do not change any other line in `.env.example`.

#### Step 6 — Update local `.env` for dev

File: `apps/api/.env`

Add (local dev — no PgBouncer, so direct URL = database URL):
```
DIRECT_URL=postgresql://postgres:postgres@localhost:5432/maint_agent?schema=public
```

This is a dev-only convenience. Without it, Prisma will fall back to `DATABASE_URL` for both runtime and migration paths, which is correct for local Postgres (no pooler).

> **Note:** `DIRECT_URL` is optional when `DATABASE_URL` already points to a direct TCP connection. Setting it to the same value is harmless and future-proofs the dev setup.

#### Step 7 — Update CI env vars

File: `.github/workflows/ci.yml`

In the top-level `env:` block, add `DIRECT_URL`:
```yaml
env:
  DATABASE_URL: postgresql://postgres:postgres@localhost:5432/maint_agent_test
  DIRECT_URL: postgresql://postgres:postgres@localhost:5432/maint_agent_test
  NODE_ENV: test
```

For the CI test database there is no PgBouncer, so `DIRECT_URL = DATABASE_URL`. This ensures `prisma migrate deploy` in CI continues to work correctly once Render starts using a separate `DIRECT_URL`.

#### Step 8 — Run CI checks locally and commit

```bash
cd apps/api
npx tsc --noEmit       # must pass
npm test               # must pass
```

Then commit all four changed files together:
```
apps/api/prisma/schema.prisma
apps/api/prisma/migrations/<timestamp>_add_direct_url_datasource/migration.sql
apps/api/.env.example
.github/workflows/ci.yml
```

Commit message: `feat(db): add Prisma directUrl for Supabase PgBouncer compatibility`

Push and verify CI is green before proceeding to B1.

---

### B2 Files Changed Summary

| File | Change |
|------|--------|
| `apps/api/prisma/schema.prisma` | +1 line: `directUrl = env("DIRECT_URL")` |
| `apps/api/prisma/migrations/<ts>_add_direct_url_datasource/migration.sql` | New file — empty migration |
| `apps/api/.env.example` | +2 lines documenting `DIRECT_URL` |
| `apps/api/.env` | +1 line (local dev convenience — not committed if `.env` is gitignored) |
| `.github/workflows/ci.yml` | +1 env line: `DIRECT_URL` |

### B2 Render Configuration (after code is deployed)

In Render dashboard → service → Environment:
```
DATABASE_URL = postgresql://postgres:[PWD]@db.[REF].supabase.co:6543/postgres?pgbouncer=true&connection_limit=1
DIRECT_URL   = postgresql://postgres:[PWD]@db.[REF].supabase.co:5432/postgres
```

The Render start command `npx prisma migrate deploy && node dist/server.js` will use `DIRECT_URL` for the migration step and `DATABASE_URL` for the runtime Prisma client.

---

---

## B1 — Replace Local File Storage with S3-Compatible Object Storage

**Why it's needed:** `apps/api/src/storage/attachments.ts` writes files to the local filesystem (`./uploads/`). Render's filesystem is ephemeral — every deploy wipes it. Any file uploaded (maintenance attachment, rental application document, OCR invoice source image, capture session photo) is permanently lost on the next Render deploy or instance restart.

**What needs to happen:** Implement the `s3` branch of the existing `createStorage()` factory in `storage/attachments.ts`. The interface (`AttachmentStorage`) and all callers are already correct — only the factory switch needs a real implementation.

**Provider choice:** Use the AWS SDK v3 S3 client (`@aws-sdk/client-s3`). This SDK is compatible with:
- **AWS S3** (the most mature, recommended for production)
- **Supabase Storage** (supports the S3 protocol — keeps all infrastructure on one platform)
- **Cloudflare R2** (S3-compatible, no egress fees)
- **MinIO** (self-hosted, useful for integration tests)

The implementation is provider-agnostic — the same code works for all four. Provider selection is a configuration decision (bucket URL + credentials), not a code decision.

**Scope:** One new dependency, one file changed (the storage factory), one new class added to `storage/attachments.ts`, env vars updated.  
**Risk:** Low — all callers go through the `storage` singleton; no route or workflow changes. Local dev continues using `ATTACHMENTS_STORAGE=local` unchanged.  
**Time estimate:** 3–4 hours including tests.

---

### B1 Architecture: What Already Exists

The storage module is well-structured. The interface is defined, all callers are correct, and the `s3` branch is already present in the factory — it just throws. The plan is to replace that throw with a real implementation.

```
apps/api/src/storage/attachments.ts
  ├── AttachmentStorage interface (save, put, get, getStream, delete, exists)
  ├── LocalDiskStorage class (fully implemented)
  ├── createStorage() factory:
  │     case "local" → LocalDiskStorage ✅
  │     case "s3"    → throws Error     ← REPLACE THIS
  └── export const storage = createStorage()

Call sites (all already use the interface, zero changes needed to these files):
  ├── workflows/uploadMaintenanceAttachmentWorkflow.ts  → storage.put()
  ├── services/rentalApplications.ts                    → storage.save()
  ├── services/ownerSelection.ts                        → storage.delete()
  ├── services/invoiceIngestionService.ts               → storage.put()
  ├── routes/captureSessions.ts                         → storage.put()
  ├── routes/invoices.ts                                → storage.exists(), storage.get()
  ├── routes/maintenanceAttachments.ts                  → storage.exists(), storage.get()
  ├── routes/rentalApplications.ts                      → storage.exists(), storage.get()
  └── services/captureSessionService.ts                 → storage.get()
```

---

### B1 Step-by-Step

#### Step 1 — Add the AWS SDK v3 dependency

```bash
cd apps/api
npm install @aws-sdk/client-s3
```

This adds `@aws-sdk/client-s3` to `apps/api/package.json` dependencies. The SDK is modular (v3) — only the S3 client is installed.

**Verify:** `apps/api/package.json` now has `"@aws-sdk/client-s3"` in `dependencies`.

#### Step 2 — Implement `S3AttachmentStorage` in `storage/attachments.ts`

This is the only file that changes. The implementation replaces the `throw` in the `s3` factory branch.

**New env vars consumed by the S3 implementation:**

| Variable | Purpose | Required |
|----------|---------|---------|
| `S3_BUCKET` | Bucket name | Yes |
| `S3_REGION` | AWS region (e.g. `eu-central-1`) | Yes |
| `S3_ACCESS_KEY_ID` | AWS access key ID (or Supabase S3 access key) | Yes |
| `S3_SECRET_ACCESS_KEY` | AWS secret access key (or Supabase S3 secret) | Yes |
| `S3_ENDPOINT` | Custom endpoint URL | Only for Supabase/R2/MinIO (not AWS) |
| `S3_FORCE_PATH_STYLE` | `"true"` for path-style URLs | Only for Supabase/MinIO |

**Implementation to add inside `storage/attachments.ts`**, replacing the existing `s3` throw:

```typescript
import {
  S3Client,
  PutObjectCommand,
  GetObjectCommand,
  DeleteObjectCommand,
  HeadObjectCommand,
} from "@aws-sdk/client-s3";
import type { Readable } from "stream";

class S3AttachmentStorage implements AttachmentStorage {
  private client: S3Client;
  private bucket: string;

  constructor() {
    const region = process.env.S3_REGION;
    const bucket = process.env.S3_BUCKET;
    const accessKeyId = process.env.S3_ACCESS_KEY_ID;
    const secretAccessKey = process.env.S3_SECRET_ACCESS_KEY;
    const endpoint = process.env.S3_ENDPOINT;
    const forcePathStyle = process.env.S3_FORCE_PATH_STYLE === "true";

    if (!region || !bucket || !accessKeyId || !secretAccessKey) {
      throw new Error(
        "S3 storage requires S3_REGION, S3_BUCKET, S3_ACCESS_KEY_ID, S3_SECRET_ACCESS_KEY"
      );
    }

    this.bucket = bucket;
    this.client = new S3Client({
      region,
      credentials: { accessKeyId, secretAccessKey },
      ...(endpoint ? { endpoint, forcePathStyle } : {}),
    });
  }

  async save(buffer: Buffer, opts: {
    applicationId: string;
    applicantId: string;
    docType: string;
    fileName: string;
    mimeType: string;
  }): Promise<SaveResult> {
    if (buffer.length > MAX_FILE_SIZE) {
      throw new Error(`File exceeds maximum size of ${MAX_FILE_SIZE} bytes`);
    }
    const uniqueId = crypto.randomUUID();
    const safeName = opts.fileName.replace(/[^a-zA-Z0-9._-]/g, "_");
    const key = [
      opts.applicationId,
      opts.applicantId,
      opts.docType,
      `${uniqueId}-${safeName}`,
    ].join("/");

    await this.put(key, buffer, opts.mimeType);

    const sha256 = crypto.createHash("sha256").update(buffer).digest("hex");
    return { key, size: buffer.length, sha256, mimeType: opts.mimeType };
  }

  async put(key: string, buffer: Buffer, mimeType?: string): Promise<void> {
    if (buffer.length > MAX_FILE_SIZE) {
      throw new Error(`File exceeds maximum size of ${MAX_FILE_SIZE} bytes`);
    }
    await this.client.send(new PutObjectCommand({
      Bucket: this.bucket,
      Key: key,
      Body: buffer,
      ContentType: mimeType ?? "application/octet-stream",
    }));
  }

  async get(key: string): Promise<Buffer> {
    const response = await this.client.send(new GetObjectCommand({
      Bucket: this.bucket,
      Key: key,
    }));
    const stream = response.Body as Readable;
    const chunks: Buffer[] = [];
    for await (const chunk of stream) {
      chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
    }
    return Buffer.concat(chunks);
  }

  getStream(key: string): fs.ReadStream {
    // S3 doesn't return a Node.js ReadStream — callers currently use get() not getStream().
    // If a streaming path is added later, replace this with a proper passthrough stream.
    throw new Error(
      "S3AttachmentStorage.getStream() is not implemented. Use get() instead."
    );
  }

  async delete(key: string): Promise<void> {
    await this.client.send(new DeleteObjectCommand({
      Bucket: this.bucket,
      Key: key,
    }));
  }

  async exists(key: string): Promise<boolean> {
    try {
      await this.client.send(new HeadObjectCommand({
        Bucket: this.bucket,
        Key: key,
      }));
      return true;
    } catch (err: any) {
      if (err.$metadata?.httpStatusCode === 404 || err.name === "NotFound") {
        return false;
      }
      throw err;
    }
  }
}
```

**Update the factory to use it:**
```typescript
function createStorage(): AttachmentStorage {
  switch (STORAGE_BACKEND) {
    case "local":
      return new LocalDiskStorage(LOCAL_ROOT);
    case "s3":
      return new S3AttachmentStorage();  // ← replace the throw with this
    default:
      throw new Error(
        `Unknown ATTACHMENTS_STORAGE backend: ${STORAGE_BACKEND}`,
      );
  }
}
```

**Notes on the implementation:**
- `put()` on the interface currently has signature `put(key: string, buffer: Buffer): Promise<void>`. The S3 implementation accepts an optional `mimeType` third argument (used internally by `save()`). The public interface signature is unchanged — existing callers pass only `key` and `buffer`.
- `getStream()` is on the `AttachmentStorage` interface but is not called anywhere in the codebase (confirmed by grep). The throw is safe. A proper streaming implementation can be added later if needed.
- The `Readable` import comes from Node's `stream` module — no new dependency.

#### Step 3 — Update `.env.example` with S3 variables

File: `apps/api/.env.example`

Replace the `# ── File storage ──` section:
```
# ── File storage ──────────────────────────────────────────────────────────────
ATTACHMENTS_STORAGE=local               # "local" | "s3"
ATTACHMENTS_LOCAL_ROOT=./uploads        # Root path for local attachment storage (dev only)

# S3-compatible object storage (required when ATTACHMENTS_STORAGE=s3)
# Works with AWS S3, Supabase Storage, Cloudflare R2, or any S3-compatible provider.
S3_BUCKET=maint-agent-attachments
S3_REGION=eu-central-1
S3_ACCESS_KEY_ID=your-access-key-id
S3_SECRET_ACCESS_KEY=your-secret-access-key
# S3_ENDPOINT=https://xxx.supabase.co/storage/v1/s3   # Only for Supabase/R2/MinIO
# S3_FORCE_PATH_STYLE=true                              # Only for Supabase/MinIO
```

#### Step 4 — Write unit tests for S3AttachmentStorage

File: `apps/api/src/__tests__/storage.test.ts` (new file)

The tests should cover both backends without needing a real S3 connection. Use a mock or a local S3-compatible service.

**Option A (recommended): Mock the S3Client**

```typescript
// Mock @aws-sdk/client-s3 before importing the storage module
jest.mock("@aws-sdk/client-s3", () => {
  const mockSend = jest.fn();
  return {
    S3Client: jest.fn().mockImplementation(() => ({ send: mockSend })),
    PutObjectCommand: jest.fn(),
    GetObjectCommand: jest.fn(),
    DeleteObjectCommand: jest.fn(),
    HeadObjectCommand: jest.fn(),
    __mockSend: mockSend,
  };
});
```

Tests to write:
1. `LocalDiskStorage.put() writes a file to disk; get() reads it back; exists() returns true; delete() removes it; exists() returns false`
2. `S3AttachmentStorage constructor throws if S3_BUCKET is missing`
3. `S3AttachmentStorage.put() calls PutObjectCommand with correct bucket and key`
4. `S3AttachmentStorage.get() reads a Readable stream response from S3 and returns a Buffer`
5. `S3AttachmentStorage.exists() returns true when HeadObjectCommand succeeds`
6. `S3AttachmentStorage.exists() returns false when HeadObjectCommand returns 404`
7. `S3AttachmentStorage.delete() calls DeleteObjectCommand`
8. `S3AttachmentStorage.save() generates a structured key and calls put()`
9. `createStorage() returns LocalDiskStorage when ATTACHMENTS_STORAGE=local`
10. `createStorage() returns S3AttachmentStorage when ATTACHMENTS_STORAGE=s3 and vars are set`
11. `createStorage() throws on unknown backend`

**Option B: Integration test with local MinIO (more thorough but heavier setup)**

Add a MinIO service to a test docker-compose or use the `@testcontainers/localstack` package. Only worth it if the team plans to test upload/download flows end-to-end. Out of scope for this blocker resolution.

#### Step 5 — Manual integration test (staging only, before production)

Once Render staging is deployed with `ATTACHMENTS_STORAGE=s3` and real S3 credentials:

```bash
# Upload a test file via maintenance attachment endpoint
TOKEN=$(curl -s -X POST https://maint-agent-api-staging.onrender.com/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"manager@local.dev","password":"..."}' | jq -r '.token')

# Find a request ID from staging
REQUEST_ID=$(curl -s -H "Authorization: Bearer $TOKEN" \
  "https://maint-agent-api-staging.onrender.com/requests?limit=1" \
  | jq -r '.data[0].id')

# Upload a file
curl -s -X POST \
  -H "Authorization: Bearer $TOKEN" \
  -F "file=@/tmp/test-attachment.pdf" \
  "https://maint-agent-api-staging.onrender.com/maintenance-attachments/$REQUEST_ID"
# Expected: 201 with attachment record including storageKey

# Re-deploy the Render service (to simulate a redeploy wipe)
# Then try to download the same file:
ATTACHMENT_ID=<id from upload response>
curl -sf -H "Authorization: Bearer $TOKEN" \
  "https://maint-agent-api-staging.onrender.com/maintenance-attachments/$ATTACHMENT_ID/download" \
  -o /tmp/downloaded.pdf
file /tmp/downloaded.pdf
# Expected: PDF survives the redeploy — this is the key test
```

#### Step 6 — Commit

Files in the commit:
```
apps/api/package.json              (+ @aws-sdk/client-s3 dependency)
apps/api/package-lock.json         (updated lockfile)
apps/api/src/storage/attachments.ts (S3AttachmentStorage class + factory update)
apps/api/src/__tests__/storage.test.ts (new test file)
apps/api/.env.example               (S3 vars documented)
```

Commit message: `feat(storage): implement S3-compatible object storage backend`

---

### B1 Provider Setup: Three Options

The code is the same for all three. Only the env vars differ.

---

#### Option A: Supabase Storage (recommended for simplest setup)

Supabase Storage supports the S3 protocol. Using it keeps all infrastructure on one platform.

**Setup steps:**
1. Supabase Dashboard → Storage → Create bucket: `maint-agent-attachments`
2. Set bucket to **Private** (files are served only via signed URLs or direct download — the API handles auth)
3. Supabase Dashboard → Project Settings → API → Storage S3 credentials:
   - Enable S3 protocol
   - Copy the `Access Key ID` and `Secret Access Key`
4. Note the S3 endpoint: `https://<PROJECT_REF>.supabase.co/storage/v1/s3`

**Render env vars:**
```
ATTACHMENTS_STORAGE=s3
S3_BUCKET=maint-agent-attachments
S3_REGION=eu-central-1          # use the region you chose for the Supabase project
S3_ACCESS_KEY_ID=<from Supabase dashboard>
S3_SECRET_ACCESS_KEY=<from Supabase dashboard>
S3_ENDPOINT=https://<PROJECT_REF>.supabase.co/storage/v1/s3
S3_FORCE_PATH_STYLE=true
```

**Trade-offs:**
- ✅ Single vendor (Supabase for DB + Storage)
- ✅ No separate AWS account needed
- ✅ Free tier: 1 GB storage, 2 GB bandwidth/month
- ⚠️ Less mature than AWS S3 (fewer advanced features)
- ⚠️ The S3 SDK is tested against this but is not the canonical Supabase Storage SDK — monitor for any edge cases

---

#### Option B: AWS S3

The most mature and well-documented option.

**Setup steps:**
1. AWS Console → S3 → Create bucket: `maint-agent-attachments-staging` (separate bucket per environment)
2. Region: `eu-central-1` (Frankfurt, matching Render/Supabase)
3. Block public access: ✅ all blocked (files served only by the API)
4. IAM → Create policy with minimum permissions:
   ```json
   {
     "Version": "2012-10-17",
     "Statement": [{
       "Effect": "Allow",
       "Action": ["s3:PutObject", "s3:GetObject", "s3:DeleteObject", "s3:HeadObject"],
       "Resource": "arn:aws:s3:::maint-agent-attachments-staging/*"
     }]
   }
   ```
5. IAM → Create user → Attach policy → Generate access keys

**Render env vars:**
```
ATTACHMENTS_STORAGE=s3
S3_BUCKET=maint-agent-attachments-staging
S3_REGION=eu-central-1
S3_ACCESS_KEY_ID=<IAM access key>
S3_SECRET_ACCESS_KEY=<IAM secret key>
# S3_ENDPOINT not needed for AWS S3
# S3_FORCE_PATH_STYLE not needed for AWS S3
```

**Trade-offs:**
- ✅ Most mature and battle-tested
- ✅ Separate AWS account already in use (Azure DI key suggests some cloud familiarity)
- ✅ Lifecycle policies, object versioning, cross-region replication available
- ⚠️ Requires an AWS account and IAM management
- ⚠️ Different vendor from Supabase/Render

---

#### Option C: Cloudflare R2

Zero egress fees — no charge for downloading files. Useful if attachment downloads are high-volume.

**Setup steps:**
1. Cloudflare Dashboard → R2 → Create bucket: `maint-agent-attachments`
2. R2 → Manage R2 API tokens → Create token with `Object Read & Write` on the bucket
3. Note the S3-compatible endpoint: `https://<ACCOUNT_ID>.r2.cloudflarestorage.com`

**Render env vars:**
```
ATTACHMENTS_STORAGE=s3
S3_BUCKET=maint-agent-attachments
S3_REGION=auto              # R2 uses "auto" as the region
S3_ACCESS_KEY_ID=<R2 access key>
S3_SECRET_ACCESS_KEY=<R2 secret key>
S3_ENDPOINT=https://<ACCOUNT_ID>.r2.cloudflarestorage.com
S3_FORCE_PATH_STYLE=false   # R2 uses virtual-hosted style
```

**Trade-offs:**
- ✅ Zero egress fees
- ✅ S3-compatible, globally distributed
- ⚠️ Less standard than AWS S3
- ⚠️ Requires a Cloudflare account

---

### B1 Files Changed Summary

| File | Change |
|------|--------|
| `apps/api/package.json` | Add `@aws-sdk/client-s3` to `dependencies` |
| `apps/api/package-lock.json` | Updated lockfile |
| `apps/api/src/storage/attachments.ts` | Add `S3AttachmentStorage` class; import AWS SDK types; update factory `case "s3"` |
| `apps/api/src/__tests__/storage.test.ts` | New test file (11 test cases) |
| `apps/api/.env.example` | Document S3 env vars |

**Zero changes to any route file, workflow file, service file, or repository file.** All callers continue to import `storage` from `../storage/attachments` and call the same interface methods.

---

### B1 Local Dev Impact

**None.** Local dev continues to use:
```
ATTACHMENTS_STORAGE=local
ATTACHMENTS_LOCAL_ROOT=./uploads
```

The `S3AttachmentStorage` constructor is never called when `ATTACHMENTS_STORAGE=local`. The new dependency (`@aws-sdk/client-s3`) is installed but dormant during local dev.

---

### B1 Migration of Existing Files (Staging Only)

If the staging database has records with `storageKey` values pointing to files that existed in a previous local-disk staging deploy, those keys will exist in the DB but the files will not be in S3 (since they were never uploaded there). Those records will return 404 on download.

**Remedy for staging:** Re-seed or accept this as a known limitation of staging (files uploaded before the S3 migration are lost — this was already the case with local disk storage, since every redeploy wiped the files anyway).

**No action needed for production:** Production will start fresh with S3 from day one. There are no pre-existing production files to migrate.

---

### Combined Rollout Order

These two blockers are independent — B2 must land first because it must reach production before `migrate deploy` runs against Supabase. B1 can be developed in parallel and deployed to staging once a bucket is provisioned.

```
T-02 (B2 — directUrl)            ← land first, unblocks Supabase setup
  └─ T-05 (Supabase staging DB)  ← requires B2 in production
  └─ T-06 (Render staging API)   ← requires B2

B1 (file storage)                ← can develop in parallel with T-02
  └─ Provision S3 bucket         ← platform setup, any time after provider decision
  └─ Deploy to Render staging    ← set ATTACHMENTS_STORAGE=s3 in staging env vars
  └─ Integration smoke test      ← upload, redeploy, download — file survives
  └─ Required before production
```

---

### Definition of Done

**B2 is done when:**
- [ ] `schema.prisma` has `directUrl = env("DIRECT_URL")`
- [ ] The generated migration SQL is empty
- [ ] `npx prisma migrate diff` returns "empty migration"
- [ ] `.env.example` documents `DIRECT_URL`
- [ ] CI passes with `DIRECT_URL` set
- [ ] On Render, `npx prisma migrate deploy` completes without error against Supabase

**B1 is done when:**
- [ ] `@aws-sdk/client-s3` is in `apps/api/package.json`
- [ ] `S3AttachmentStorage` is implemented in `storage/attachments.ts`
- [ ] All 11 unit tests pass
- [ ] CI passes (existing tests + new storage tests)
- [ ] On Render staging: a file uploaded via the API survives a service redeploy
- [ ] `ATTACHMENTS_STORAGE=local` in `.env` is unchanged — local dev unaffected
