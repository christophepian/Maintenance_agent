# Dev Commands

> Quick reference for local development. All paths relative to repo root.

---

## Start Everything

```bash
cd /Users/christophepian/Documents/Maintenance_Agent/apps/web && npx next dev -p 3000
```

Or from root using the npm scripts:

```bash
npm run dev:db
npm run dev:api
npm run dev:web
```

Roadmap server (optional — port 8111):

```bash
node scripts/roadmap-server.js &
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
lsof -nP -iTCP:3000,3001,8111 -sTCP:LISTEN

# Is Docker/Postgres running?
docker ps

# Quick health check
curl -sf http://127.0.0.1:3001/requests?limit=1 && echo "✅ API OK"
curl -sf http://127.0.0.1:3000 && echo "✅ Frontend OK"
curl -sf http://127.0.0.1:8111/api/roadmap && echo "✅ Roadmap OK"

# Combined check
lsof -nP -iTCP:3000,3001,5432,8111 -sTCP:LISTEN 2>/dev/null || echo "No listeners found"
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

## Roadmap System

The roadmap server runs on **port 8111** and operates on `ROADMAP.json` (no database).
Dashboard HTML is generated to `docs/roadmap.html`.

```bash
# Start the roadmap server
node scripts/roadmap-server.js &

# Regenerate roadmap HTML (phases, intake, drafts, signals tabs)
node scripts/generate-roadmap.js

# Open dashboard in browser
open http://localhost:8111

# Stop roadmap server
lsof -ti:8111 | xargs kill 2>/dev/null

# Quick API check
curl -s http://localhost:8111/api/roadmap | python3 -c "import sys,json; r=json.load(sys.stdin); print(f'Features: {len(r.get(\"features\",[])):}  Intake: {len(r.get(\"intake_items\",[])):}  Drafts: {len(r.get(\"draft_tickets\",[])):}')"
```

### Intake Pipeline (intake → triage → draft → promote)

```bash
# Create an intake item
curl -s -X POST http://localhost:8111/api/intake \
  -H 'Content-Type: application/json' \
  -d '{"raw_text": "Add bulk job close feature", "source": "manual"}'

# Auto-triage all raw/triaged items
curl -s -X POST http://localhost:8111/api/intake/auto-triage \
  -H 'Content-Type: application/json' -d '{}'

# Promote a single item to draft ticket
curl -s -X POST http://localhost:8111/api/intake/INT-001/promote \
  -H 'Content-Type: application/json' -d '{}'

# Batch promote all triaged items
curl -s -X POST http://localhost:8111/api/intake/promote-all \
  -H 'Content-Type: application/json' -d '{}'

# Refresh top-5 recommendations
curl -s -X POST http://localhost:8111/api/recommendations \
  -H 'Content-Type: application/json' -d '{}'
```

### Roadmap CLI (ticket management)

```bash
# Create a new custom ticket interactively
node scripts/roadmap-ticket.js

# Validate a ticket
node scripts/roadmap-ticket.js validate T-001
```

---

## Quick Reference Card

| What | Command |
|------|---------|
| Start all | `npm run dev:db && npm run dev:api && npm run dev:web` |
| Kill API | `pkill -f "ts-node.*src/server"` |
| Kill frontend | `pkill -f "next dev"` |
| Kill by port | `lsof -ti:3001 \| xargs kill -9` |
| Check ports | `lsof -nP -iTCP:3000,3001,8111 -sTCP:LISTEN` |
| API logs | `tail -f /tmp/api.log` |
| Frontend logs | `tail -f /tmp/web.log` |
| Run tests | `cd apps/api && npm test` |
| Backup DB | `npm run db:backup` |
| Cleanup DB | `cat docs/cleanup_dev_db.sql \| docker exec -i maint_agent_pg psql -U postgres -d maint_agent` |
| DB connect | `docker exec -it maint_agent_pg psql -U postgres -d maint_agent` |
| Type check | `cd apps/api && npx tsc --noEmit` |
| Drift check | See G5 smoke test above |
| Start roadmap | `node scripts/roadmap-server.js &` |
| Stop roadmap | `lsof -ti:8111 \| xargs kill` |
| Regen roadmap | `node scripts/generate-roadmap.js` |
| Open roadmap | `open http://localhost:8111` |
| Blueprint | `cd apps/api && npm run blueprint` |