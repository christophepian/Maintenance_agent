content = open('/Users/christophepian/Documents/Maintenance_Agent/docs/AUDIT.md').read()

# Remove any corrupted content appended by prior shell heredoc attempts
marker = "\n---\n\n## Area 5"
if marker in content:
    content = content[:content.index(marker)]

addition = "\n---\n\n## Area 5 — Architecture Compliance (new 2026-05-06)\n\n"
addition += "### ARCH-1 · Service layer direct Prisma access (362 calls, 54 files) (LOW)\n\n"
addition += "- **File(s):** `apps/api/src/services/` (54 files)\n"
addition += "- **Description:** 362 direct `prisma.*` calls exist in service files, bypassing the repository layer. "
addition += "Architecture rule: services MUST delegate to repositories. No direct Prisma client usage in `src/services/`. "
addition += "Heaviest offenders: `leases.ts` (31), `legalService.ts` (20), `ledgerService.ts` (16), `tenants.ts` (15), "
addition += "`rentalApplications.ts` (15), `invoices.ts` (15), `financials.ts` (15).\n"
addition += "- **Impact:** Inline include trees, duplicated query logic, no canonical type safety from `GetPayload`, "
addition += "impossible to enforce include constants across callers.\n"
addition += "- **Fix:** Migrate in 5 slices (DT-120 to DT-124) sorted by call-count ascending. Each slice routes "
addition += "service calls through existing or new repository functions with canonical `_INCLUDE` constants.\n"
addition += "- **Status:** Open — tracked as epic DT-120 / DT-121 / DT-122 / DT-123 / DT-124 in ROADMAP.json\n\n"
addition += "### ARCH-2 · Repository layer `any` type violations (22 instances, 8 files) (LOW)\n\n"
addition += "- **File(s):** `apps/api/src/repositories/` (8 files)\n"
addition += "- **Description:** 22 meaningful `: any` instances. By file: `invoiceRepository.ts` (1 — `where: any`), "
addition += "`leaseRepository.ts` (4 — `data: any`), `rentalApplicationRepository.ts` (3 — `data: any`), "
addition += "`rfpRepository.ts` (1 — `lineItems?: any`), `recommendationRepository.ts` (1 — `userDecision: any`), "
addition += "`rentAdjustmentRepository.ts` (1 — `calculationDetails?: any`), "
addition += "`strategyProfileRepository.ts` (9 — enum fields typed as any), `taxRuleRepository.ts` (2 — `citationsJson?: any`).\n"
addition += "- **Impact:** Bypasses Prisma generated input type validation; silent type mismatches can corrupt persisted "
addition += "data without compile-time detection. Violates G2/G3 (typed DTO mappers).\n"
addition += "- **Fix:** Replace with `Prisma.LeaseUpdateInput`, `Prisma.JsonValue`, enum literals from `@prisma/client`, etc. "
addition += "Self-contained one-session pass (no schema changes needed).\n"
addition += "- **Status:** Open — tracked as DT-125 in ROADMAP.json\n"

open('/Users/christophepian/Documents/Maintenance_Agent/docs/AUDIT.md', 'w').write(content + addition)
lines = len((content + addition).splitlines())
print(f"Done. Final line count: {lines}")
