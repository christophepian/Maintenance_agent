# Schema Reference

> **Extracted from PROJECT_STATE.md** — this is the canonical schema reference.
> Do not duplicate schema entries in PROJECT_STATE.md; that file contains a pointer here.

## Database Schema (Prisma)

**Status: ACTIVE AND IN USE — 32 migrations + `db push` for LKDE tables (shadow DB issue with legacy Lease migration prevents `migrate dev`)**

**Last verified:** 2026-03-10

### Models (45 total)

| Model | Key Fields | Relations |
|-------|-----------|-----------|
| **Org** | id, name, mode (MANAGED/OWNER_DIRECT) | → OrgConfig, Users, Buildings, Contractors, ... |
| **OrgConfig** | orgId, autoApproveLimit, **autoLegalRouting** (Boolean, default false), landlord fields | → Org |
| **User** | orgId, role (TENANT/CONTRACTOR/MANAGER/OWNER), email, passwordHash | → Org, BuildingOwners |
| **Building** | orgId, name, address, isActive, managedSince?, canton?, cantonDerivedAt?, yearBuilt?, hasElevator, hasConcierge | → Units, BuildingConfig, ApprovalRules, Notifications, BuildingOwners |
| **BuildingOwner** | id, buildingId, userId, createdAt; @@unique([buildingId, userId]), @@index([buildingId]), @@index([userId]) | → Building, User |
| **BuildingConfig** | buildingId, orgId, autoApproveLimit, emergencyAutoDispatch, requireOwnerApprovalAbove?, rfpDefaultInviteCount?, rentalIncomeMultiplier?, rentalSignatureDeadlineDays?, rentalManualReviewConfidenceThreshold? | → Building, Org |
| **Unit** | buildingId, orgId, unitNumber, floor, type (RESIDENTIAL/COMMON_AREA), isActive, isVacant, monthlyRentChf?, monthlyChargesChf?, livingAreaSqm?, rooms?, hasBalcony, hasTerrace, hasParking, locationSegment?, lastRenovationYear?, insulationQuality?, energyLabel?, heatingType? | → Building, Occupancies, Appliances, Requests, Leases, UnitConfig, Assets, Rfps |
| **UnitConfig** | unitId, orgId, autoApproveLimit, emergencyAutoDispatch, requireOwnerApprovalAbove? | → Unit, Org |
| **Tenant** | orgId, name, phone (E.164), email, isActive | → Occupancies, Requests |
| **Occupancy** | tenantId, unitId (unique pair) | → Tenant, Unit |
| **Appliance** | unitId, orgId, assetModelId?, name, serial, isActive, installDate?, notes? | → Unit, AssetModel, Requests |
| **AssetModel** | orgId?, manufacturer, model, **category**, specs, isActive | → Appliances |
| **Contractor** | orgId, name, phone, email, hourlyRate, serviceCategories (JSON), isActive, addressLine1?, addressLine2?, postalCode?, city?, country?, iban?, vatNumber?, defaultVatRate? | → Requests, Jobs, BillingEntity, RfpInvites, RfpQuotes |
| **Request** | description, category?, estimatedCost?, status, contactPhone, assignedContractorId?, tenantId?, unitId?, applianceId?, contractorNotes, startedAt?, completedAt? | → Contractor, Tenant, Unit, Appliance, Job, RequestEvents |
| **RequestEvent** | requestId, type (RequestEventType), contractorId (required), message | → Request, Contractor |
| **Event** | orgId, type, actorUserId?, requestId?, payload (JSON) | (standalone) |
| **Job** | orgId, requestId (unique), **contractorId** (required), status, actualCost, startedAt?, completedAt? | → Request, Contractor, Invoices |
| **Invoice** | orgId, **jobId** (required), leaseId?, issuer fields, recipient fields, amounts in cents, status, lineItems | → Job, Lease, BillingEntity, InvoiceLineItems |
| **InvoiceLineItem** | invoiceId, description, quantity, unitPrice (cents), vatRate, lineTotal | → Invoice |
| **BillingEntity** | orgId, type, contractorId?, name, address, iban, vatNumber | → Org, Contractor |
| **ApprovalRule** | orgId, buildingId?, name, priority, conditions (JSON), action, isActive | → Org, Building |
| **Notification** | orgId, userId, buildingId?, entityType, entityId, eventType, message?, readAt | → Org, Building |
| **Lease** | orgId, status, unitId, 40+ fields (parties, object, dates, rent, deposit, PDF refs, lifecycle timestamps) | → Org, Unit, SignatureRequests, Invoices |
| **SignatureRequest** | orgId, entityType, entityId, provider, level, status, signersJson, providerEnvelopeId?, auditTrailStorageKey?, sentAt?, signedAt? | → Org, Lease |
| **RentalApplication** | orgId, status (RentalApplicationStatus), householdSize?, desiredMoveInDate?, hasPets?, petsDescription?, currentLandlordName?, currentLandlordAddress?, currentLandlordPhone?, reasonForLeaving?, remarks, hasRcInsurance?, rcInsuranceCompany?, hasVehicle?, vehicleDescription?, needsParking?, signedName?, signedAt?, signatureIp?, signatureUserAgent?, submittedAt?, applicationDataJson? | → Org, Applicants, Attachments, ApplicationUnits |
| **RentalApplicant** | applicationId, role (PRIMARY/CO_APPLICANT), firstName, lastName, birthdate?, nationality, civilStatus?, permitType, phone?, email?, currentAddress?, currentZipCity?, employer, jobTitle?, workLocation?, employedSince?, netMonthlyIncome?, hasDebtEnforcement? | → RentalApplication |
| **RentalAttachment** | applicationId, applicantId, docType (RentalDocType), fileName, fileSizeBytes, mimeType, storageKey, sha256, uploadedAt, retentionDeleteAt? | → RentalApplication, RentalApplicant |
| **RentalApplicationUnit** | applicationId, unitId, status (RentalApplicationUnitStatus), evaluationJson, scoreTotal, confidenceScore, disqualified, disqualifiedReasons (Json?), rank, managerScoreDelta, managerOverrideJson, managerOverrideReason | → RentalApplication, Unit |
| **RentalOwnerSelection** | unitId, status (RentalOwnerSelectionStatus), primaryApplicationUnitId, backup1ApplicationUnitId?, backup2ApplicationUnitId?, deadlineAt, decidedAt? | → Unit, RentalApplicationUnits |
| **EmailOutbox** | orgId, template (EmailTemplate), toEmail, subject, bodyText, status (EmailOutboxStatus), metaJson? | → Org |
| **BuildingFinancialSnapshot** | orgId, buildingId, periodStart, periodEnd, earnedIncomeCents, projectedIncomeCents, expensesTotalCents, maintenanceTotalCents, capexTotalCents, operatingTotalCents, netIncomeCents, netOperatingIncomeCents, activeUnitsCount, computedAt | → Org, Building |
| **RentEstimationConfig** | orgId, canton?, baseRentPerSqmChfMonthly, locationCoefs (prime/standard/periphery), ageCoefs (new/mid/old/veryOld), energyCoefJson (Json), chargesBase (optimistic/pessimistic), heatingChargeAdjJson (Json), serviceChargeAdj (elevator/concierge), chargesMinClamp, chargesMaxClamp | → Org |
| **LegalSource** | name, jurisdiction, **scope** (LegalSourceScope, default FEDERAL), url?, updateFrequency?, fetcherType?, parserType?, status (LegalSourceStatus), lastCheckedAt?, lastSuccessAt?, lastError? | → LegalVariableVersions, DepreciationStandards |
| **LegalVariable** | key (unique per jurisdiction+canton), jurisdiction, canton?, unit?, description? | → LegalVariableVersions |
| **LegalVariableVersion** | variableId, effectiveFrom, effectiveTo?, valueJson (Json), sourceId?, fetchedAt? | → LegalVariable, LegalSource |
| **LegalRule** | key (@@unique global), ruleType (LegalRuleType), authority (LegalAuthority), jurisdiction, canton?, priority, isActive | → LegalRuleVersions |
| **LegalRuleVersion** | ruleId, effectiveFrom, effectiveTo?, dslJson (Json), citationsJson (Json?), summary? | → LegalRule |
| **LegalEvaluationLog** | orgId, buildingId?, unitId?, requestId?, contextJson, contextHash, resultJson, matchedRuleVersionIdsJson? | → Org |
| **LegalCategoryMapping** | orgId?, requestCategory, legalTopic, isActive | → Org (unique on orgId+requestCategory) |
| **Asset** | orgId, unitId, type (AssetType), topic, name, installedAt?, lastRenovatedAt?, replacedAt?, brand?, modelNumber?, serialNumber?, notes?, isPresent (default true), isActive (default true), assetModelId? | → Org, Unit, AssetInterventions |
| **AssetIntervention** | assetId, type (AssetInterventionType: REPAIR/REPLACEMENT), interventionDate, costChf?, jobId?, notes? | → Asset, Job |
| **DepreciationStandard** | jurisdiction, canton?, assetType (AssetType), topic, usefulLifeMonths (Int), authority (LegalAuthority), sourceId?, notes? | (standalone, unique on jurisdiction+canton+assetType+topic) |
| **Rfp** | orgId, buildingId (required), requestId?, unitId?, category, legalObligation (LegalObligation), status (RfpStatus), inviteCount (default 3), deadlineAt?, awardedContractorId? | → Org, Building, Request, Unit, RfpInvites, RfpQuotes |
| **RfpInvite** | rfpId, contractorId, status (RfpInviteStatus) | → Rfp, Contractor |
| **RfpQuote** | rfpId, contractorId, amountCents (Int), notes?, submittedAt | → Rfp, Contractor |

### Key Enums (35 total)
- `RequestStatus`: PENDING_REVIEW, AUTO_APPROVED, APPROVED, **RFP_PENDING**, ASSIGNED, IN_PROGRESS, COMPLETED, PENDING_OWNER_APPROVAL
- `RequestEventType`: ARRIVED, PARTS_ORDERED, COMPLETED, NOTE, OTHER, OWNER_APPROVED, OWNER_REJECTED, TENANT_SELECTED
- `JobStatus`: PENDING, IN_PROGRESS, COMPLETED, INVOICED
- `InvoiceStatus`: DRAFT, ISSUED, APPROVED, DISPUTED, PAID
- `LeaseStatus`: DRAFT, READY_TO_SIGN, SIGNED, ACTIVE, TERMINATED, CANCELLED
- `SignatureRequestStatus`: DRAFT, SENT, SIGNED, DECLINED, EXPIRED, ERROR
- `SignatureProvider`: INTERNAL, DOCUSIGN, SKRIBBLE
- `SignatureLevel`: SES, AES, QES
- `Role`: TENANT, CONTRACTOR, MANAGER, OWNER
- `OrgMode`: MANAGED, OWNER_DIRECT
- `UnitType`: RESIDENTIAL, COMMON_AREA
- `BillingEntityType`: CONTRACTOR, ORG, OWNER
- `RuleAction`: AUTO_APPROVE, REQUIRE_MANAGER_REVIEW, REQUIRE_OWNER_APPROVAL
- `NotificationEventType`: REQUEST_APPROVED, REQUEST_PENDING_REVIEW, REQUEST_PENDING_OWNER_APPROVAL, CONTRACTOR_ASSIGNED, CONTRACTOR_REJECTED, JOB_CREATED, JOB_STARTED, JOB_COMPLETED, INVOICE_CREATED, INVOICE_APPROVED, INVOICE_PAID, INVOICE_DISPUTED, OWNER_REJECTED, TENANT_SELECTED, LEASE_READY_TO_SIGN, LEASE_SIGNED, APPLICATION_SUBMITTED
- `RentalApplicationStatus`: DRAFT, SUBMITTED
- `RentalApplicationUnitStatus`: SUBMITTED, REJECTED, SELECTED_PRIMARY, SELECTED_BACKUP_1, SELECTED_BACKUP_2, AWAITING_SIGNATURE, SIGNED, VOIDED
- `RentalOwnerSelectionStatus`: AWAITING_SIGNATURE, FALLBACK_1, FALLBACK_2, EXHAUSTED, SIGNED, VOIDED
- `RentalDocType`: IDENTITY, SALARY_PROOF, PERMIT, DEBT_ENFORCEMENT_EXTRACT, HOUSEHOLD_INSURANCE, STUDENT_PROOF, PARKING_DOCS
- `ApplicantRole`: PRIMARY, CO_APPLICANT
- `EmailOutboxStatus`: PENDING, SENT, FAILED
- `EmailTemplate`: MISSING_DOCS, REJECTED, SELECTED_LEASE_LINK, MANAGER_TENANT_SELECTED
- `ExpenseCategory`: MAINTENANCE, UTILITIES, CLEANING, INSURANCE, TAX, ADMIN, CAPEX, OTHER
- `LegalAuthority`: STATUTE, INDUSTRY_STANDARD
- `LegalRuleType`: MAINTENANCE_OBLIGATION, DEPRECIATION, RENT_INDEXATION, TERMINATION_DEADLINE
- `LegalObligation`: OBLIGATED, DISCRETIONARY, TENANT_RESPONSIBLE, UNKNOWN
- `LegalSourceStatus`: ACTIVE, INACTIVE, ERROR
- `LegalSourceScope`: FEDERAL, AG, AL, AR, AI, BE, BL, BS, FR, GE, GL, GR, JU, LU, NE, NW, OW, SG, SH, SO, SZ, TG, TI, UR, VD, VS, ZG, ZH
- `AssetType`: APPLIANCE, FIXTURE, FINISH, STRUCTURAL, SYSTEM, OTHER
- `AssetInterventionType`: REPAIR, REPLACEMENT
- `LocationSegment`: PRIME, STANDARD, PERIPHERY
- `InsulationQuality`: UNKNOWN, POOR, AVERAGE, GOOD, EXCELLENT
- `EnergyLabel`: A, B, C, D, E, F, G
- `HeatingType`: HEAT_PUMP, DISTRICT, GAS, OIL, ELECTRIC, UNKNOWN
- `RfpStatus`: DRAFT, OPEN, CLOSED, AWARDED, CANCELLED
- `RfpInviteStatus`: INVITED, DECLINED, RESPONDED

### ⚠️ Schema Gotchas (fields that DON'T exist where you'd expect)
- **`Request` has NO `orgId`** — requests are not directly org-scoped (they inherit scope through unit/building)
- **`Job` has NO `description`** — use `Request.description` via the relation
- **`Appliance` has NO `category`** — category lives on `AssetModel`, accessed via `appliance.assetModel.category`
- **`Job.contractorId` is REQUIRED** — every Job must reference an active Contractor

---

## Request.orgId Migration Path (H6 Reference)

**Context:** The `Request` model currently has **no `orgId` field**. Org scope is resolved dynamically via FK traversal using `resolveRequestOrg()` in `governance/orgScope.ts`, which walks:
- `unit → building → org` (if `unitId` present)
- `tenant → org` (if `tenantId` present)
- `appliance → org` (if `applianceId` present)
- `contractor → org` (if `assignedContractorId` present)

This works but adds query complexity and prevents direct org filtering on `Request` queries.

**Migration Steps (when needed):**

1. **Schema Change** — Add nullable `orgId` to Request:
   ```prisma
   model Request {
     // ... existing fields
     orgId     String?  // Nullable initially for backfill
     org       Org?     @relation(fields: [orgId], references: [id])
   }
   ```
   Run: `npx prisma migrate dev --name add_request_orgid`

2. **Backfill Data** — Populate `orgId` from FK chain:
   ```sql
   -- Via unit
   UPDATE "Request"
   SET "orgId" = (
     SELECT "Building"."orgId"
     FROM "Unit"
     JOIN "Building" ON "Unit"."buildingId" = "Building"."id"
     WHERE "Unit"."id" = "Request"."unitId"
   )
   WHERE "unitId" IS NOT NULL AND "orgId" IS NULL;

   -- Via tenant
   UPDATE "Request"
   SET "orgId" = (SELECT "orgId" FROM "Tenant" WHERE "id" = "Request"."tenantId")
   WHERE "tenantId" IS NOT NULL AND "orgId" IS NULL;

   -- Via contractor
   UPDATE "Request"
   SET "orgId" = (SELECT "orgId" FROM "Contractor" WHERE "id" = "Request"."assignedContractorId")
   WHERE "assignedContractorId" IS NOT NULL AND "orgId" IS NULL;
   ```
   Test: `SELECT COUNT(*) FROM "Request" WHERE "orgId" IS NULL;` → should be 0

3. **Make Required** — Change schema to non-nullable:
   ```prisma
   orgId     String   @default("default-org")  // or remove default after backfill
   ```
   Run: `npx prisma migrate dev --name require_request_orgid`

4. **Update Queries** — Change all `listMaintenanceRequests()` / `listOwnerPendingApprovals()` to filter directly:
   ```typescript
   const requests = await prisma.request.findMany({
     where: { orgId },  // Direct filter, no FK traversal
     // ...
   });
   ```

5. **Keep Resolvers for Validation** — `resolveRequestOrg()` remains useful for assertions:
   ```typescript
   const resolvedOrgId = await resolveRequestOrg(prisma, requestId);
   assertOrgScope(orgId, resolvedOrgId, "Request");  // Cross-check
   ```

6. **Drift Check** — Verify zero drift after migration:
   ```bash
   npx prisma migrate diff \
     --from-schema-datasource ./prisma/schema.prisma \
     --to-schema-datamodel ./prisma/schema.prisma \
     --script
   ```
   Expected: `-- This is an empty migration.`

7. **Update DTOs & Tests** (per H4):
   - Add `orgId` to `MaintenanceRequestDTO` interface
   - Update `mapRequestToDTO()` mapper
   - Update OpenAPI spec + typed client
   - Update contract tests

**When to execute:**
- Multi-org feature lands (multiple real tenants in production)
- Query performance becomes measurably slow (profile first)
- **NOT before** — avoid premature schema churn

**Estimated effort:** 2–3 hours (schema + backfill + query updates + tests)

<!-- reviewed 2026-03-10 -->
