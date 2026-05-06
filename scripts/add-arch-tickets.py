import json

r = json.load(open('ROADMAP.json'))

new_tickets = [
  {
    "id": "DT-120",
    "source_intake_ids": [],
    "title": "ARCH-1 Slice 1/5 — Service→Repository: tiny services (1-2 Prisma calls each)",
    "goal": "Eliminate direct prisma.* calls from 15 small service files by routing each call through an existing or new repository function. These files each have only 1-2 raw Prisma calls making them fast, low-risk wins that establish the pattern for subsequent slices.",
    "phase": "P0",
    "order": 120,
    "status": "ready",
    "product_area": "architecture",
    "parent_feature_id": None,
    "depends_on": [],
    "files_to_modify": [
      "src/services/rfps.ts (2 calls)",
      "src/services/rentReductionCalculator.ts (2 calls)",
      "src/services/overdueInvoiceService.ts (2 calls)",
      "src/services/invoiceIngestionService.ts (2 calls)",
      "src/services/capexProjectionService.ts (2 calls)",
      "src/services/userService.ts (2 calls)",
      "src/services/tenantClaimAnalysis.ts (2 calls)",
      "src/services/tenantSession.ts (1 call)",
      "src/services/replacementCostService.ts (1 call)",
      "src/services/leasePDFRenderer.ts (1 call)",
      "src/services/invoiceQRBill.ts (1 call)",
      "src/services/invoicePDF.ts (1 call)",
      "src/services/inventory.ts (1 call)",
      "src/services/defectMatcher.ts (1 call)",
      "src/services/captureSessionService.ts (1 call)"
    ],
    "in_scope": [
      "For each call: either add a new function to an existing matching repository, or create a minimal new repository if none fits",
      "Replace prisma.X.findFirst/findMany/create/update/delete with the new repo call",
      "Export canonical include constants for any new repo functions that return full model objects",
      "No schema changes"
    ],
    "out_of_scope": [
      "Services with 3+ Prisma calls (handled in slices 2-5)",
      "Workflow-layer changes",
      "New API routes or frontend changes"
    ],
    "acceptance_criteria": [
      "All 15 service files have zero direct prisma.* calls",
      "npx tsc --noEmit returns 0 errors",
      "npm test passes all suites"
    ],
    "tests_to_add_or_update": [
      "No new integration tests required — existing coverage exercises these code paths",
      "Verify existing tests still pass after refactor"
    ],
    "test_protocol": [
      "npx tsc --noEmit — zero TypeScript errors",
      "npm test — all 67 suites pass",
      "grep -rn 'prisma\\.' apps/api/src/services/<file> for each listed file — should return 0"
    ],
    "validation_checklist": [
      "All 15 service files have zero direct prisma.* calls",
      "No TypeScript errors",
      "All tests pass",
      "No layer violations introduced (no new prisma.* in routes/workflows)",
      "Blueprint regenerated (npm run blueprint)"
    ],
    "post_validation_updates": [
      "Update docs/AUDIT.md ARCH-1 progress note",
      "Update PROJECT_STATE.md service layer stats",
      "npm run blueprint",
      "Commit and push"
    ],
    "canonical_implementation_prompt": (
      "## ARCH-1 Slice 1/5 — Service->Repository: tiny services\n\n"
      "**Goal:** Remove all direct prisma.* calls from 15 service files that each have only 1-2 calls.\n\n"
      "**Architecture rule:** services MUST delegate to repositories. No direct prisma.* in src/services/.\n\n"
      "**Pattern:**\n"
      "1. Identify the Prisma model being accessed (e.g. prisma.rfp.findFirst)\n"
      "2. Find the matching repository (e.g. rfpRepository.ts)\n"
      "3. Add a new function if needed\n"
      "4. Replace the service call with the repo function\n"
      "5. Import the repo function in the service\n\n"
      "**Files (priority order):**\n"
      "- src/services/rfps.ts (2 calls)\n"
      "- src/services/rentReductionCalculator.ts (2 calls)\n"
      "- src/services/overdueInvoiceService.ts (2 calls)\n"
      "- src/services/invoiceIngestionService.ts (2 calls)\n"
      "- src/services/capexProjectionService.ts (2 calls)\n"
      "- src/services/userService.ts (2 calls)\n"
      "- src/services/tenantClaimAnalysis.ts (2 calls)\n"
      "- src/services/tenantSession.ts (1 call)\n"
      "- src/services/replacementCostService.ts (1 call)\n"
      "- src/services/leasePDFRenderer.ts (1 call)\n"
      "- src/services/invoiceQRBill.ts (1 call)\n"
      "- src/services/invoicePDF.ts (1 call)\n"
      "- src/services/inventory.ts (1 call)\n"
      "- src/services/defectMatcher.ts (1 call)\n"
      "- src/services/captureSessionService.ts (1 call)\n\n"
      "**Guard:** After each file, run npx tsc --noEmit to catch type breaks immediately."
    ),
    "refinement_status": "refined",
    "refinement_notes": [],
    "refined_at": "2026-05-06T00:00:00.000Z"
  },
  {
    "id": "DT-121",
    "source_intake_ids": [],
    "title": "ARCH-1 Slice 2/5 — Service->Repository: small services (3-6 Prisma calls each)",
    "goal": "Continue ARCH-1 migration by eliminating direct prisma.* calls from 19 service files with 3-6 calls each. Depends on Slice 1 establishing the pattern.",
    "phase": "P0",
    "order": 121,
    "status": "capture",
    "product_area": "architecture",
    "depends_on": ["DT-120"],
    "files_to_modify": [
      "src/services/depreciation.ts (3)",
      "src/services/assetInventory.ts (3)",
      "src/services/emailTransport.ts (3)",
      "src/services/rentAdjustmentService.ts (3)",
      "src/services/rentalSelectionService.ts (3)",
      "src/services/tenantIdentity.ts (3)",
      "src/services/emailOutbox.ts (5)",
      "src/services/recurringBillingService.ts (5)",
      "src/services/contractorRequests.ts (5)",
      "src/services/cashflowPlanningService.ts (4)",
      "src/services/contractorBillingService.ts (4)",
      "src/services/legalVariableIngestion.ts (4)",
      "src/services/requestEventService.ts (4)",
      "src/services/requestAssignment.ts (4)",
      "src/services/maintenanceRequests.ts (6)",
      "src/services/buildingConfig.ts (6)",
      "src/services/chargeReconciliationService.ts (6)",
      "src/services/bootstrapLegalEngine.ts (6)",
      "src/services/contractors.ts (6)"
    ],
    "in_scope": [
      "Same pattern as Slice 1: add repo functions, replace service calls",
      "For transaction blocks (prisma.$transaction): wrap in a dedicated repo transaction helper if the operation is atomic",
      "No schema changes"
    ],
    "out_of_scope": ["Services with 7+ calls (Slices 3-5)", "Frontend changes"],
    "acceptance_criteria": [
      "All 19 listed service files have zero direct prisma.* calls",
      "npx tsc --noEmit returns 0 errors",
      "npm test passes all suites"
    ],
    "tests_to_add_or_update": ["Existing suite coverage sufficient"],
    "test_protocol": ["npx tsc --noEmit", "npm test — all 67 suites pass"],
    "validation_checklist": ["Zero prisma.* in all 19 files", "0 TS errors", "Tests pass", "Blueprint regenerated"],
    "post_validation_updates": ["Update AUDIT.md ARCH-1 progress", "npm run blueprint", "Commit"],
    "canonical_implementation_prompt": (
      "## ARCH-1 Slice 2/5 — Service->Repository: small services (3-6 calls)\n\n"
      "Depends on DT-120 (Slice 1) being complete. Follow the same pattern:\n"
      "identify call -> add repo function with canonical include -> replace service call -> tsc check after each file.\n\n"
      "19 files in priority order (fewest calls first):\n"
      "depreciation.ts, assetInventory.ts, emailTransport.ts, rentAdjustmentService.ts,\n"
      "rentalSelectionService.ts, tenantIdentity.ts, cashflowPlanningService.ts,\n"
      "contractorBillingService.ts, legalVariableIngestion.ts, requestEventService.ts,\n"
      "requestAssignment.ts, emailOutbox.ts, recurringBillingService.ts, contractorRequests.ts,\n"
      "maintenanceRequests.ts, buildingConfig.ts, chargeReconciliationService.ts,\n"
      "bootstrapLegalEngine.ts, contractors.ts"
    ),
    "refinement_status": "refined",
    "refinement_notes": [],
    "refined_at": "2026-05-06T00:00:00.000Z"
  },
  {
    "id": "DT-122",
    "source_intake_ids": [],
    "title": "ARCH-1 Slice 3/5 — Service->Repository: medium services (7-11 Prisma calls each)",
    "goal": "Migrate 9 service files with 7-11 Prisma calls each. These files may require creating new repository modules or significant extensions to existing ones.",
    "phase": "P1",
    "order": 122,
    "status": "capture",
    "product_area": "architecture",
    "depends_on": ["DT-121"],
    "files_to_modify": [
      "src/services/jobs.ts (8)",
      "src/services/unitConfig.ts (7)",
      "src/services/orgConfig.ts (9)",
      "src/services/occupancies.ts (9)",
      "src/services/signatureRequests.ts (9)",
      "src/services/rentEstimation.ts (9)",
      "src/services/approvalRules.ts (10)",
      "src/services/billingEntities.ts (10)",
      "src/services/legalDecisionEngine.ts (10)"
    ],
    "in_scope": [
      "Full extraction of all prisma.* calls to matching repositories",
      "May require new repository files if none exist for the model",
      "Transaction blocks extracted to repo-level transaction helpers"
    ],
    "out_of_scope": ["Services with 11+ calls (Slices 4-5)"],
    "acceptance_criteria": [
      "All 9 listed service files have zero direct prisma.* calls",
      "npx tsc --noEmit returns 0 errors",
      "npm test passes all suites"
    ],
    "tests_to_add_or_update": ["Any new repository module should have a corresponding includeIntegrity test entry"],
    "test_protocol": ["npx tsc --noEmit", "npm test — all suites pass"],
    "validation_checklist": ["Zero prisma.* in all 9 files", "0 TS errors", "Tests pass", "Blueprint regenerated"],
    "post_validation_updates": ["Update AUDIT.md ARCH-1 progress", "npm run blueprint", "Commit"],
    "canonical_implementation_prompt": (
      "## ARCH-1 Slice 3/5 — Service->Repository: medium services (7-11 calls)\n\n"
      "Depends on DT-121. Files: jobs.ts, unitConfig.ts, orgConfig.ts, occupancies.ts,\n"
      "signatureRequests.ts, rentEstimation.ts, approvalRules.ts, billingEntities.ts, legalDecisionEngine.ts.\n\n"
      "For each: grep the prisma.* calls, map to model, route through existing or new repo.\n"
      "Create new repo files if the model has no existing repository.\n"
      "All new repo files must export a canonical _INCLUDE constant."
    ),
    "refinement_status": "refined",
    "refinement_notes": [],
    "refined_at": "2026-05-06T00:00:00.000Z"
  },
  {
    "id": "DT-123",
    "source_intake_ids": [],
    "title": "ARCH-1 Slice 4/5 — Service->Repository: large services (11-16 Prisma calls each)",
    "goal": "Migrate 8 high-call services. These services often have complex multi-model queries and transaction chains; extraction will likely require new repository modules and careful DTO alignment.",
    "phase": "P1",
    "order": 123,
    "status": "capture",
    "product_area": "architecture",
    "depends_on": ["DT-122"],
    "files_to_modify": [
      "src/services/notifications.ts (11)",
      "src/services/ownerSelection.ts (11)",
      "src/services/tenantPortal.ts (13)",
      "src/services/legalIngestion.ts (14)",
      "src/services/financials.ts (15)",
      "src/services/invoices.ts (15)",
      "src/services/rentalApplications.ts (15)",
      "src/services/tenants.ts (15)"
    ],
    "in_scope": [
      "Full prisma.* extraction for all 8 files",
      "Transaction blocks remain in service layer as orchestration but delegate individual queries to repos",
      "DTO types must remain consistent using GetPayload with canonical include constants"
    ],
    "out_of_scope": ["leases.ts, ledgerService.ts, legalService.ts (Slice 5)"],
    "acceptance_criteria": [
      "All 8 listed service files have zero direct prisma.* calls",
      "npx tsc --noEmit returns 0 errors",
      "npm test passes all suites",
      "Contract tests for GET /requests, GET /invoices still pass"
    ],
    "tests_to_add_or_update": ["Verify contract test suite (requests.test.ts, invoiceWorkflows.test.ts) still passes"],
    "test_protocol": ["npx tsc --noEmit", "npm test — all suites pass"],
    "validation_checklist": ["Zero prisma.* in all 8 files", "0 TS errors", "Tests pass", "Contract tests pass", "Blueprint regenerated"],
    "post_validation_updates": ["Update AUDIT.md ARCH-1 progress", "npm run blueprint", "Commit"],
    "canonical_implementation_prompt": (
      "## ARCH-1 Slice 4/5 — Service->Repository: large services (11-16 calls)\n\n"
      "Depends on DT-122. Files: notifications.ts, ownerSelection.ts, tenantPortal.ts,\n"
      "legalIngestion.ts, financials.ts, invoices.ts, rentalApplications.ts, tenants.ts.\n\n"
      "Key patterns to watch:\n"
      "- ownerSelection.ts: heavy prisma.$transaction usage — keep transaction in service,\n"
      "  extract individual query helpers to repo\n"
      "- financials.ts: complex multi-model joins — map each to existing repos\n"
      "- invoices.ts: contract-tested endpoint — run requests.test.ts + invoiceWorkflows.test.ts after each change"
    ),
    "refinement_status": "refined",
    "refinement_notes": [],
    "refined_at": "2026-05-06T00:00:00.000Z"
  },
  {
    "id": "DT-124",
    "source_intake_ids": [],
    "title": "ARCH-1 Slice 5/5 — Service->Repository: heaviest services (leases, ledger, legal)",
    "goal": "Final ARCH-1 slice. Migrates the three largest offenders: leases.ts (31 calls), legalService.ts (20), ledgerService.ts (16). Completing this slice achieves 0 direct prisma.* calls in all service files — full architecture compliance.",
    "phase": "P1",
    "order": 124,
    "status": "capture",
    "product_area": "architecture",
    "depends_on": ["DT-123"],
    "files_to_modify": [
      "src/services/leases.ts (31 calls — heaviest file)",
      "src/services/legalService.ts (20 calls)",
      "src/services/ledgerService.ts (16 calls)"
    ],
    "in_scope": [
      "Full prisma.* extraction for all 3 files",
      "leases.ts: likely requires 10-15 new repo functions in leaseRepository.ts",
      "legalService.ts: extend legalSourceRepository.ts and legalCategoryMappingRepository.ts",
      "ledgerService.ts: extend ledgerRepository.ts",
      "All new repo functions must use canonical include constants (G9)"
    ],
    "out_of_scope": ["Frontend changes", "Schema changes"],
    "acceptance_criteria": [
      "grep -rn 'prisma\\.' apps/api/src/services/ returns 0 lines",
      "npx tsc --noEmit returns 0 errors",
      "npm test passes all 67 suites",
      "Contract tests for GET /leases/:id pass",
      "AUDIT.md ARCH-1 marked resolved"
    ],
    "tests_to_add_or_update": [
      "leases.test.ts — full coverage after refactor",
      "legalEngine.test.ts — verify legal service calls work through repos"
    ],
    "test_protocol": [
      "npx tsc --noEmit",
      "npm test",
      "grep -rn 'prisma\\.' apps/api/src/services/ | wc -l — must be 0"
    ],
    "validation_checklist": [
      "0 prisma.* calls in any service file",
      "0 TS errors",
      "All tests pass",
      "AUDIT.md ARCH-1 resolved",
      "Blueprint regenerated"
    ],
    "post_validation_updates": [
      "Mark ARCH-1 resolved in docs/AUDIT.md",
      "Update PROJECT_STATE.md architecture compliance section",
      "npm run blueprint",
      "Commit with message: arch: ARCH-1 complete - 0 direct Prisma calls in service layer"
    ],
    "canonical_implementation_prompt": (
      "## ARCH-1 Slice 5/5 — Final: leases, legalService, ledgerService\n\n"
      "This is the capstone slice. On completion, grep -rn 'prisma\\.' apps/api/src/services/ must return 0.\n\n"
      "**leases.ts (31 calls):** Go line by line. Most calls are findFirst/findMany/update on\n"
      "Lease, Occupancy, Unit, User, Building. Map each to leaseRepository.ts or occupancyRepository.ts.\n"
      "For transaction blocks, keep the $transaction wrapper in the service, extract the individual operations.\n\n"
      "**legalService.ts (20 calls):** Most should map to legalSourceRepository.ts\n"
      "and legalCategoryMappingRepository.ts which already exist.\n\n"
      "**ledgerService.ts (16 calls):** Most map to ledgerRepository.ts (which exists).\n\n"
      "Run npx tsc --noEmit after every file. Run npm test at the end."
    ),
    "refinement_status": "refined",
    "refinement_notes": [],
    "refined_at": "2026-05-06T00:00:00.000Z"
  },
  {
    "id": "DT-125",
    "source_intake_ids": [],
    "title": "ARCH-2 — Repository any-type hardening (22 instances, 8 files)",
    "goal": "Replace all 22 any-typed parameters and return types in repository files with proper Prisma-generated input types. Improves type safety, prevents silent data corruption, and brings repositories into full compliance with G2/G3.",
    "phase": "P0",
    "order": 125,
    "status": "ready",
    "product_area": "architecture",
    "depends_on": [],
    "files_to_modify": [
      "src/repositories/invoiceRepository.ts — jobFilter: any -> Prisma.JobWhereInput",
      "src/repositories/leaseRepository.ts — data: any x4 -> Prisma.LeaseUpdateInput / LeaseCreateInput",
      "src/repositories/rentalApplicationRepository.ts — data: any x3 -> Prisma.RentalApplicationUpdateInput",
      "src/repositories/rfpRepository.ts — lineItems?: any -> Prisma.JsonValue",
      "src/repositories/recommendationRepository.ts — userDecision: any -> Prisma.JsonValue",
      "src/repositories/rentAdjustmentRepository.ts — calculationDetails?: any -> Prisma.JsonValue",
      "src/repositories/taxRuleRepository.ts — citationsJson: any x2 -> Prisma.JsonValue",
      "src/repositories/strategyProfileRepository.ts — enum fields any x9 -> Prisma enum literals"
    ],
    "in_scope": [
      "Replace data: any with the correct Prisma generated input type (LeaseUpdateInput, etc.)",
      "Replace where: any / filter objects with proper WhereInput types",
      "Replace JSON blob fields (citationsJson, lineItems, calculationDetails, userDecision) with Prisma.JsonValue",
      "Replace enum-typed fields (secondaryArchetype, roleIntent, conditionRating) with the generated Prisma enum type"
    ],
    "out_of_scope": [
      "Services (ARCH-1 handles those)",
      "Catch clause e: any — standard TypeScript pattern, not a violation",
      "New schema changes or migrations"
    ],
    "acceptance_criteria": [
      "grep -rn ': any' apps/api/src/repositories/ | grep -v 'catch\\|e: any\\|err: any\\|error: any' returns 0 lines",
      "npx tsc --noEmit returns 0 errors",
      "npm test passes all suites"
    ],
    "tests_to_add_or_update": ["Existing includeIntegrity.test.ts verifies includes; no new tests needed"],
    "test_protocol": [
      "npx tsc --noEmit — zero TypeScript errors",
      "npm test — all 67 suites pass"
    ],
    "validation_checklist": [
      "0 remaining any in repositories (excl. catch)",
      "0 TS errors",
      "Tests pass",
      "Blueprint regenerated"
    ],
    "post_validation_updates": [
      "Mark ARCH-2 resolved in docs/AUDIT.md",
      "npm run blueprint",
      "Commit"
    ],
    "canonical_implementation_prompt": (
      "## ARCH-2 — Repository any-type hardening\n\n"
      "Replace all meaningful any types in apps/api/src/repositories/ with proper Prisma types.\n\n"
      "**Import pattern:**\n"
      "import { Prisma } from '@prisma/client';\n"
      "// Then use: Prisma.LeaseUpdateInput, Prisma.LeaseCreateInput, Prisma.JobWhereInput, Prisma.JsonValue\n\n"
      "**For enum fields** (secondaryArchetype, roleIntent, conditionRating in strategyProfileRepository.ts):\n"
      "import the enum directly from @prisma/client\n\n"
      "**Files in order:**\n"
      "1. invoiceRepository.ts\n"
      "2. leaseRepository.ts\n"
      "3. rentalApplicationRepository.ts\n"
      "4. rfpRepository.ts\n"
      "5. recommendationRepository.ts\n"
      "6. rentAdjustmentRepository.ts\n"
      "7. taxRuleRepository.ts\n"
      "8. strategyProfileRepository.ts\n\n"
      "Run npx tsc --noEmit after each file."
    ),
    "refinement_status": "refined",
    "refinement_notes": [],
    "refined_at": "2026-05-06T00:00:00.000Z"
  }
]

r['draft_tickets'].extend(new_tickets)

with open('ROADMAP.json', 'w') as f:
    json.dump(r, f, indent=2, ensure_ascii=False)

print(f"Done. Total draft_tickets: {len(r['draft_tickets'])}")
print("New tickets added: DT-120, DT-121, DT-122, DT-123, DT-124, DT-125")
