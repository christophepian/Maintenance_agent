# Schema Reference

> **Extracted from PROJECT_STATE.md** — this is the canonical schema reference.
> Do not duplicate schema entries in PROJECT_STATE.md; that file contains a pointer here.

## Database Schema (Prisma)

**Status: ACTIVE AND IN USE — 72 migrations** (shadow DB replay verified clean 2026-03-30)

**Last verified:** 2026-04-03

### Models (64 total)

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
| **Contractor** | orgId, name, phone, email, hourlyRate, serviceCategories (JSON), isActive, addressLine1?, addressLine2?, postalCode?, city?, country?, iban?, vatNumber?, defaultVatRate? | → Requests, Jobs, BillingEntity, RfpInvites, RfpQuotes, Invoices[], ContractorBillingSchedule[] |
| **Request** | **requestNumber** (@default(autoincrement()) @unique), description, category?, estimatedCost?, status, contactPhone, assignedContractorId?, tenantId?, unitId?, applianceId?, contractorNotes, startedAt?, completedAt?, updatedAt, approvalSource? (ApprovalSource), rejectionReason?, payingParty (PayingParty, default LANDLORD) | → Contractor, Tenant, Unit, Appliance, Job, RequestEvents, MaintenanceAttachments |
| **MaintenanceAttachment** | requestId, fileName, mimeType, storageKey, sizeBytes, uploadedBy?, createdAt | → Request |
| **RequestEvent** | requestId, type (RequestEventType), contractorId (required), message | → Request, Contractor |
| **Event** | orgId, type, actorUserId?, requestId?, payload (JSON) | (standalone) |
| **Job** | orgId, requestId (unique), **contractorId** (required), status, actualCost, startedAt?, completedAt? | → Request, Contractor, Invoices |
| **Invoice** | orgId, **jobId** (required), leaseId?, issuer fields, recipient fields, amounts in cents, status, lineItems, **expenseTypeId?**, **accountId?**, direction (InvoiceDirection), sourceChannel (InvoiceSourceChannel), ingestionStatus (IngestionStatus)?, ocrConfidence?, rawOcrText?, sourceFileUrl?, **contractorId?**, **contractorBillingScheduleId?** | → Job, Lease, BillingEntity, InvoiceLineItems, ExpenseType?, Account?, Contractor?, ContractorBillingSchedule? |
| **InvoiceLineItem** | invoiceId, description, quantity, unitPrice (cents), vatRate, lineTotal | → Invoice |
| **BillingEntity** | orgId, type, contractorId?, name, address, iban, vatNumber | → Org, Contractor |
| **ApprovalRule** | orgId, buildingId?, name, priority, conditions (JSON), action, isActive | → Org, Building |
| **Notification** | orgId, userId, buildingId?, entityType, entityId, eventType, message?, readAt | → Org, Building |
| **Lease** | orgId, status, unitId, 40+ fields (parties, object, dates, rent, deposit, PDF refs, lifecycle timestamps), **indexClauseType?** (IndexClauseType), **cpiBaseIndex?**, **initialNetRentChf?**, **lastIndexationDate?** | → Org, Unit, SignatureRequests, Invoices, RecurringBillingSchedule?, RentAdjustment[], ChargeReconciliation[], LeaseExpenseItem[] |
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
| **AppointmentSlot** | orgId, jobId, startTime, endTime, status (SlotStatus, default PROPOSED), respondedAt? | → Job, Org |
| **JobRating** | orgId, jobId, raterRole (RaterRole), score (Int), comment? | → Job, Org (@@unique jobId+raterRole) |
| **ExpenseType** | orgId, name, description?, code?, isActive | → Org, ExpenseMappings, Invoices (@@unique orgId+name) |
| **Account** | orgId, name, code?, accountType (default EXPENSE), isActive | → Org, ExpenseMappings, Invoices (@@unique orgId+name) |
| **ExpenseMapping** | orgId, expenseTypeId, accountId, buildingId? (null=org-wide default) | → Org, ExpenseType, Account, Building? (@@unique orgId+expenseTypeId+buildingId) |
| **LeaseExpenseItem** | leaseId, expenseTypeId?, accountId?, description, mode (ChargeMode: ACOMPTE/FORFAIT), amountChf, isActive | → Lease, ExpenseType?, Account? |
| **CaptureSession** | orgId, createdBy (userId), token (unique), status (CaptureSessionStatus), expiresAt, sourceChannel, targetType, uploadedFileUrls (String[]), createdInvoiceId? | → Org |
| **LedgerEntry** | orgId, date, accountId, debitCents, creditCents, description, reference?, sourceType?, sourceId?, journalId (groups posting legs), buildingId?, unitId?, createdBy? | → Org, Account, Building?, Unit? |
| **CashflowPlan** | orgId, buildingId?, name, status (CashflowPlanStatus), incomeGrowthRatePct, openingBalanceCents (BigInt?), horizonMonths, lastComputedAt? | → Org, Building?, CashflowOverride[], Rfp[] |
| **CashflowOverride** | planId, assetId, originalYear, overriddenYear | → CashflowPlan, Asset |
| **TaxRule** | jurisdiction, canton?, assetType, topic, scope (LegalRuleScope), isActive | → TaxRuleVersion[] |
| **TaxRuleVersion** | ruleId, effectiveFrom, effectiveTo?, classification (TaxClassification), deductiblePct, confidence, notes?, citationsJson? | → TaxRule |
| **ReplacementBenchmark** | assetType, topic, lowChf, medianChf, highChf, sourceNotes?, isActive | (standalone — unique on assetType+topic) |
| **RecurringBillingSchedule** | orgId, leaseId, status (BillingScheduleStatus), anchorDay, nextPeriodStart, lastGeneratedPeriod?, baseRentCents, totalChargesCents | → Org, Lease |
| **RentAdjustment** | orgId, leaseId, adjustmentType (RentAdjustmentType), status (RentAdjustmentStatus), effectiveDate, previousRentCents, newRentCents, adjustmentCents, cpiOldIndex?, cpiNewIndex?, referenceRateOld?, referenceRateNew?, calculationDetails?, approvedAt?, appliedAt?, rejectedAt?, rejectionReason? | → Org, Lease |
| **ChargeReconciliation** | orgId, leaseId, fiscalYear, status (ChargeReconciliationStatus), totalAcompteCents?, totalActualCents?, balanceCents?, settledAt? | → Org, Lease, ChargeReconciliationLine[] |
| **ChargeReconciliationLine** | reconciliationId, expenseTypeId?, description, acompteCents, actualCents | → ChargeReconciliation, ExpenseType? |
| **ContractorBillingSchedule** | orgId, contractorId, status (BillingScheduleStatus), description, frequency (BillingFrequency), anchorDay, nextPeriodStart, lastGeneratedPeriod?, amountCents, vatRate, buildingId?, completedAt?, completionReason? | → Org, Contractor, Building?, Invoice[] |

### Key Enums (55 total) <!-- 49 prior + BillingScheduleStatus + IndexClauseType + RentAdjustmentType + RentAdjustmentStatus + ChargeReconciliationStatus + BillingFrequency -->
- `RequestStatus`: PENDING_REVIEW, AUTO_APPROVED, APPROVED, **RFP_PENDING**, ASSIGNED, IN_PROGRESS, COMPLETED, PENDING_OWNER_APPROVAL, **OWNER_REJECTED**
- `ApprovalSource`: SYSTEM_AUTO, OWNER_APPROVED, OWNER_REJECTED, LEGAL_OBLIGATION
- `PayingParty`: LANDLORD, TENANT
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
- `LegalRuleScope`: FEDERAL, CANTONAL
- `SlotStatus`: PROPOSED, ACCEPTED, DECLINED, EXPIRED
- `RaterRole`: TENANT, MANAGER
- `ChargeMode`: ACOMPTE, FORFAIT
- `CaptureSessionStatus`: CREATED, ACTIVE, COMPLETED, EXPIRED, CANCELLED
- `InvoiceDirection`: OUTGOING, INCOMING
- `InvoiceSourceChannel`: MANUAL, BROWSER_UPLOAD, EMAIL_PDF, MOBILE_CAPTURE
- `IngestionStatus`: PENDING_REVIEW, CONFIRMED, AUTO_CONFIRMED, REJECTED
- `RfpQuoteStatus`: SUBMITTED, AWARDED, REJECTED
- `RequestUrgency`: LOW, MEDIUM, HIGH, EMERGENCY
- `CashflowPlanStatus`: DRAFT, SUBMITTED, APPROVED
- `TaxClassification`: WERTERHALTEND, WERTVERMEHREND, MIXED
- `BillingScheduleStatus`: ACTIVE, PAUSED, COMPLETED
- `IndexClauseType`: NONE, CPI_100, CPI_40_REFRATE_60
- `RentAdjustmentType`: CPI_INDEXATION, REFERENCE_RATE_CHANGE, MANUAL
- `RentAdjustmentStatus`: DRAFT, APPROVED, APPLIED, REJECTED
- `ChargeReconciliationStatus`: DRAFT, FINALIZED, SETTLED
- `BillingFrequency`: MONTHLY, QUARTERLY, SEMI_ANNUAL, ANNUAL

### ⚠️ Schema Gotchas (fields that DON'T exist where you'd expect)
- **`Job` has NO `description`** — use `Request.description` via the relation
- **`Appliance` has NO `category`** — category lives on `AssetModel`, accessed via `appliance.assetModel.category`
- **`Job.contractorId` is REQUIRED** — every Job must reference an active Contractor

---

## Request.orgId — Completed (H6 Reference)

**Status: ✅ Done — 2026-04-19 (migrations 75–76)**

`Request.orgId` is now a required, FK-backed column pointing to `Org`.

- All 332 rows backfilled (238 orphaned rows set to `'default-org'` directly; remaining via unit/tenant/contractor FK chain).
- FK constraint `Request_orgId_fkey` added (migration 75).
- `@default("")` placeholder dropped (migration 76).
- Schema drift: clean (`-- This is an empty migration.`).

**How scope checks work now:**

All route-level checks use `resolveAndScopeRequest(prisma, idOrNumber, orgId)` from `requestRepository.ts`, which does a single query: `prisma.request.findFirst({ where: { id, orgId } })`. Service-level checks use `request.orgId !== callerOrgId` directly after `findUnique`.

`resolveRequestOrg()` in `governance/orgScope.ts` is **no longer called** from routes, workflows, or services. It remains in the codebase for the `orgIsolation.test.ts` test suite only.

<!-- completed 2026-04-19 -->
