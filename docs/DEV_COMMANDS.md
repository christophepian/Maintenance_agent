# Dev Commands

> Quick reference for local development. All paths relative to repo root.

---

## Start Everything

```bash
# 1. Database (Docker)
cd infra && docker compose up -d

# 2. Backend API (port 3001)
cd apps/api && npm run start:dev > /tmp/api.log 2>&1 &

# 3. Frontend (port 3000)
cd apps/web && npm run dev > /tmp/web.log 2>&1 &
```

Or from root using the npm scripts:

```bash
npm run dev:db
npm run dev:api
npm run dev:web
```

---

## Stop / Kill Everything

```bash
# Kill backend
pkill -f "ts-node.*src/server" || true

# Kill frontend
pkill -f "next dev" || true

# Stop database (data preserved)
cd infra && docker compose stop

# Nuclear option — kill anything on ports 3000 and 3001
lsof -ti:3001 | xargs kill -9 2>/dev/null || true
lsof -ti:3000 | xargs kill -9 2>/dev/null || true
```

---

## Restart Clean

```bash
# Backend clean restart
pkill -f "ts-node.*src/server" || true
cd apps/api && npm run start:dev > /tmp/api.log 2>&1 &

# Frontend clean restart (clears Next.js cache)
pkill -f "next dev" || true
cd apps/web && rm -rf .next
cd apps/web && npm run dev > /tmp/web.log 2>&1 &
```

Or from root:

```bash
npm run dev:clean:api
npm run dev:clean:web
npm run dev:clean:all
```

---

## Check What's Running

```bash
# Are the servers listening?
lsof -nP -iTCP:3000,3001 -sTCP:LISTEN

# Is Docker/Postgres running?
docker ps

# Quick health check
curl -sf http://127.0.0.1:3001/requests?limit=1 && echo "✅ API OK"
curl -sf http://127.0.0.1:3000 && echo "✅ Frontend OK"

# Combined check
lsof -nP -iTCP:3000,3001,5432 -sTCP:LISTEN 2>/dev/null || echo "No listeners found"
echo "---"
docker ps --format "{{.Names}} {{.Status}}" 2>/dev/null || echo "Docker not running"
```

---

## View Logs

```bash
# Backend logs (live)
tail -f /tmp/api.log

# Frontend logs (live)
tail -f /tmp/web.log

# Last 50 lines of each
tail -n 50 /tmp/api.log
tail -n 50 /tmp/web.log

# Docker postgres logs
docker logs maint_agent_pg
```

---

## Database

```bash
# Start postgres
cd infra && docker compose up -d

# Stop postgres (data preserved)
cd infra && docker compose stop

# Connect to postgres directly
docker exec -it maint_agent_pg psql -U postgres -d maint_agent

# Quick row counts
docker exec maint_agent_pg psql -U postgres -d maint_agent -c "
SELECT
  (SELECT COUNT(*) FROM \"Building\") AS buildings,
  (SELECT COUNT(*) FROM \"Unit\") AS units,
  (SELECT COUNT(*) FROM \"Asset\") AS assets,
  (SELECT COUNT(*) FROM \"Lease\") AS leases,
  (SELECT COUNT(*) FROM \"Request\") AS requests;"

# Backup dev data
npm run db:backup

# Apply pending migrations (safe, never resets data)
cd apps/api && npx prisma migrate deploy

# Regenerate Prisma client after schema change
cd apps/api && npx prisma generate

# Check for schema drift (expected output: empty migration)
cd apps/api && npx prisma migrate diff \
  --from-schema-datasource ./prisma/schema.prisma \
  --to-schema-datamodel ./prisma/schema.prisma \
  --script
```

---

## Database Cleanup

Wipes all transactional data while preserving legal engine
reference data (sources, rules, variables, depreciation
standards, category mappings) and rent estimation config.

```bash
# Always backup first
npm run db:backup

# Then run the cleanup script
cat docs/cleanup_dev_db.sql \
  | docker exec -i maint_agent_pg psql -U postgres -d maint_agent
```

Covers all 44 models in correct FK-dependency order.

**Tables preserved:**
LegalSource, LegalVariable, LegalVariableVersion,
LegalRule, LegalRuleVersion, LegalCategoryMapping,
DepreciationStandard, Org

See [cleanup_dev_db.sql](cleanup_dev_db.sql) for the full script.

> **Important:** Read `SCHEMA_REFERENCE.md` before generating any SQL
> or Prisma queries. Use only model names that appear in that file —
> do not infer model names from domain concepts.

---

## Tests

```bash
# Run full test suite (uses maint_agent_test — safe)
cd apps/api && npm test

# Run a single test file
cd apps/api && npm test -- assetInventory

# Run tests in watch mode
cd apps/api && npm run test:watch

# TypeScript check (no output = good)
cd apps/api && npx tsc --noEmit
```

---

## The 30-Second Pre-Commit Smoke Test (G5)

```bash
cd apps/api

# Drift check
npx prisma migrate diff \
  --from-schema-datasource ./prisma/schema.prisma \
  --to-schema-datamodel ./prisma/schema.prisma \
  --script 2>&1 | grep -q "empty migration" \
  && echo "✅ No drift" || echo "❌ DRIFT DETECTED"

# Type check
npx tsc --noEmit && echo "✅ Types OK" || echo "❌ Type errors"

# Server smoke
timeout 8 npx ts-node --transpile-only src/server.ts &
sleep 5
curl -sf 'http://127.0.0.1:3001/requests?limit=1' \
  > /dev/null && echo "✅ API OK" || echo "❌ API FAIL"
kill %1 2>/dev/null
```

---

## Quick Reference Card

| What | Command |
|------|---------|
| Start all | `npm run dev:db && npm run dev:api && npm run dev:web` |
| Kill API | `pkill -f "ts-node.*src/server"` |
| Kill frontend | `pkill -f "next dev"` |
| Kill by port | `lsof -ti:3001 \| xargs kill -9` |
| Check ports | `lsof -nP -iTCP:3000,3001 -sTCP:LISTEN` |
| API logs | `tail -f /tmp/api.log` |
| Frontend logs | `tail -f /tmp/web.log` |
| Run tests | `cd apps/api && npm test` |
| Backup DB | `npm run db:backup` |
| Cleanup DB | `cat docs/cleanup_dev_db.sql \| docker exec -i maint_agent_pg psql -U postgres -d maint_agent` |
| DB connect | `docker exec -it maint_agent_pg psql -U postgres -d maint_agent` |
| Type check | `cd apps/api && npx tsc --noEmit` |
| Drift check | See G5 smoke test above |
