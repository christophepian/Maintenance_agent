# Tenant-Isolation Hardening — Scope

Structural follow-up to the 2026-06-30 isolation audit (`docs/PERFORMANCE_AUDIT_2026-06-30.md` Tier-1 #3) and the IDOR fixes shipped in PR #2. Goal: make cross-tenant scoping **impossible to forget**, rather than relying on every author remembering a relation-chain filter — the failure mode behind the 9 IDOR leaks.

Two independent workstreams.

---

## Workstream A — tighten "fragile" mutation repos (quick win, no migration)

Mutations scoped only by a route/service pre-check, with an unscoped repo `where: { id }`. Not leaks today (the pre-checks hold), but a future caller dropping the guard would leak. Add `orgId` to the repo where-clause so they're safe by construction.

- `mortgageRepository.updateMortgage` / `deleteMortgage` → `where: { id, orgId }`
- `billingPeriodRepository.updateBillingPeriod` → `where: { id, orgId }`
- `billingPeriodRepository.deleteCostEntry` → scope via `billingPeriod: { orgId }`

Pattern: Prisma 5 extended-where-unique (`update({ where: { id, orgId } })`) or the established `updateMany/deleteMany({ where: { id, orgId } })`. Callers (mortgage routes, `ancillaryReconciliationService.updatePeriod` / `removeCostEntry`) pass `orgId`. Regression test asserts cross-org update/delete is a no-op/throws.

**This document's PR ships Workstream A.**

---

## Workstream B — `orgId` denormalization (the structural fix)

### Scope: which models
Of the 32 models without `orgId`, **exclude** `Org` itself, the global reference tables (`LegalRule(+Version)`, `LegalSource`, `LegalVariable(+Version)`, `TaxRule(+Version)`, `DepreciationStandard`, `ReplacementBenchmark` — canton/FEDERAL-scoped, shared across orgs), and `BuildingOwner` (join, low exposure). **In scope: 21 tenant-scoped children**, each with one parent already carrying `orgId`:

| Parent (has orgId) | Children |
|---|---|
| Invoice | InvoiceLineItem |
| BillingPeriod | CostEntry |
| Rfp | RfpQuote, RfpInvite |
| ChargeReconciliation | ChargeReconciliationLine |
| CashflowPlan | CashflowOverride |
| Lease | LeaseExpenseItem |
| CreditNote | CreditNoteLine |
| RentalApplication | RentalApplicationUnit, RentalAttachment, RentalApplicant |
| UnitConditionReport → Item | UnitConditionReportItem, UnitConditionReportPhoto (2-hop) |
| Request | RequestEvent, MaintenanceAttachment |
| Asset | AssetIntervention |
| Letter | LetterRecipient, LetterResponse |
| Unit/Tenant | Occupancy, RentalOwnerSelection |
| ConversationThread | ConversationMessage |

### Per-model migration pattern (mirrors DT-114 `20260323120000_add_request_orgid`)
Data is tiny now (pre-pilot) — the ideal window. Per model:
1. `ADD COLUMN "orgId" TEXT;` (nullable)
2. Backfill: `UPDATE "<Child>" c SET "orgId" = p."orgId" FROM "<Parent>" p WHERE c."<parentId>" = p.id;` (2-hop join for `UnitConditionReportPhoto`)
3. Assert zero nulls → `SET NOT NULL` + `@@index([orgId])` + FK `org Org @relation(..., onDelete: Cascade)`
4. RLS already blanket-enabled on public tables — verify the new column needs no policy change.

### Consumer updates per model (G2/G3 "update all consumers")
1. schema + migration
2. **Every `prisma.<model>.create` site must set `orgId`** (from parent row / request context) — the main work and the trap. NOT NULL + FK makes a miss fail **loudly** at runtime/tests, not silently.
3. Repo finders/mutations switch from relation-chain scoping to `where: { id, orgId }`
4. Extend isolation + contract tests

### Regression guardrail (so it can't return)
- **Structural backstop (free):** NOT NULL + FK → a create without `orgId` fails by construction.
- **New ratchet `G24`** (modeled on G20/G22 in `scripts/guardrails.sh`): flags `prisma.<scopedChild>.findUnique({ where: { id` in routes/services (forces `findFirst` + `orgId`).
- **Parametrized cross-org isolation test** (generalizing `tenantIsolationIdor.test.ts`) over every scoped child — covers even models not yet denormalized.

### Phasing (each phase = 1 migration batch + consumer updates + test + 1 PR)
- **Phase 1 — financial children (8):** InvoiceLineItem, CostEntry, RfpQuote, RfpInvite, ChargeReconciliationLine, CashflowOverride, LeaseExpenseItem, CreditNoteLine. Establishes the pattern + test harness.
- **Phase 2 — PII / IDOR-cluster backstop (7):** RentalApplicationUnit, RentalAttachment, RentalApplicant, UnitConditionReportItem, UnitConditionReportPhoto, RequestEvent, MaintenanceAttachment. Structurally locks the leaks PR #2 patched.
- **Phase 3 — remainder (6):** AssetIntervention, LetterRecipient, LetterResponse, Occupancy, RentalOwnerSelection, ConversationMessage.

### Effort & risk
- Per model ~½–1 day (migration + backfill + create-site sweep + repo/consumer + test). Per phase ~1 week; ~2.5–3 weeks total, fully incremental.
- Risk low-silent / high-loud: NOT NULL + FK fails immediately in CI. Backfills trivial on pre-pilot data.

### Recommended lean scope
A + Phase 1 + Phase 2 + the parametrized isolation test (covers Phase 3 models via relation-scoping until denormalized) ≈ 90% of the risk reduction in ~2 weeks.
