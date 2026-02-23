# Slice 8 — Digital Lease Generation + Signature-Ready Workflow (Phase 1)

**Status:** Specification + Implementation Plan  
**Date:** 2026-02-23  
**Target Completion:** Estimated 2-3 weeks (iterative)

---

## Overview

When a rental application is approved, generate a lease draft using the ImmoScout24 template and pre-fill as much as possible from existing data (application + inventory/unit/building + org config). Produce a PDF draft for review and then a "SignatureRequest" placeholder so we can plug in AES/QES later without refactor.

---

## 1. Prisma Schema Changes

### New Models

#### A. Lease Model

```prisma
enum LeaseStatus {
  DRAFT
  READY_TO_SIGN
  SIGNED
  CANCELLED
}

enum TerminationDatesRule {
  END_OF_MONTH_EXCEPT_31_12
  CUSTOM_LOCAL_DATES
}

enum DepositDueType {
  AT_SIGNATURE
  BY_START_DATE
  BY_DATE
}

enum UsageType {
  APARTMENT
  FAMILY_APARTMENT
  SECONDARY_RESIDENCE
  HOLIDAY
  FURNISHED_ROOM
  FURNISHED_APARTMENT
}

model Lease {
  id                    String   @id @default(uuid())
  orgId                 String
  applicationId         String?  // link to rental application (future)
  unitId                String
  
  // Status & lifecycle
  status                LeaseStatus @default(DRAFT)
  
  // Duration & termination
  startDate             DateTime
  isFixedTerm           Boolean  @default(false)
  endDate               DateTime?
  firstTerminationDate  DateTime?
  terminationNoticeMonths Int?
  terminationDatesRule  TerminationDatesRule @default(END_OF_MONTH_EXCEPT_31_12)
  terminationDatesCustomText String?
  
  // Parties (auto-filled from application + org)
  tenantName            String
  tenantAddress         String?
  tenantNpa             String?
  tenantLocality        String?
  tenantPhone           String?
  tenantEmail           String?
  coTenantName          String?
  coTenantAddress       String?
  
  // Rent & charges
  netRentChf            Int
  garageRentChf         Int?
  otherServiceRentChf   Int?
  chargesTotalChf       Int?
  rentTotalChf          Int      // computed: net + charges + garage
  chargesLineItems      Json?    // [{ label, mode, amountChf }]
  
  // Payment
  paymentDueDayOfMonth  Int      @default(1)
  paymentRecipient      String?
  paymentInstitution    String?
  paymentAccountNumber  String?
  paymentIban           String?
  
  // Reference rate & deposit
  referenceRatePercent  Decimal?
  referenceRateDate     DateTime?
  depositChf            Int
  depositDue            DepositDueType @default(AT_SIGNATURE)
  depositDueDate        DateTime?
  
  // Unit & spaces
  unitType              String?  // apartment, house, room, etc. (from Unit.type)
  roomCount             Int?
  floor                 Int?
  unitNumber            String?
  buildingAddress       String?
  
  // Included spaces & common areas
  includedSpaces        Json?    // [{ type: "CELLAR"|"ATTIC"|"STORAGE"|"GARAGE", count }]
  commonAreas           Json?    // [{ type: "GARDEN"|"LAUNDRY"|"DRYER"|"OTHER", included: bool }]
  
  // Usage & restrictions
  usageType             UsageType @default(APARTMENT)
  petsAllowed           Boolean  @default(false)
  petsOverrideText      String?
  
  // Annexes & stipulations
  otherStipulations     String?
  includesHouseRules    Boolean  @default(false)
  otherAnnexesText      String?
  
  // PDF artifacts
  draftPdfStorageKey    String?
  signedPdfStorageKey   String?
  draftPdfSha256        String?
  signedPdfSha256       String?
  
  // Timestamps
  createdAt             DateTime @default(now())
  updatedAt             DateTime @updatedAt
  
  // Relations
  org                   Org      @relation(fields: [orgId], references: [id])
  unit                  Unit     @relation(fields: [unitId], references: [id])
  signatureRequests     SignatureRequest[]
  
  @@index([orgId])
  @@index([unitId])
  @@index([applicationId])
  @@index([status])
}
```

#### B. SignatureRequest Model

```prisma
enum SignatureProvider {
  INTERNAL
  DOCUSIGN
  SKRIBBLE
}

enum SignatureLevel {
  SES  // Simple Electronic Signature
  AES  // Advanced Electronic Signature
  QES  // Qualified Electronic Signature
}

enum SignatureRequestStatus {
  DRAFT
  SENT
  SIGNED
  DECLINED
  EXPIRED
  ERROR
}

enum SignerRole {
  TENANT
  CO_TENANT
  LANDLORD
}

model SignatureRequest {
  id                      String   @id @default(uuid())
  orgId                   String
  
  // Entity reference
  entityType              String   @default("LEASE")  // "LEASE", "APPLICATION"
  entityId                String   // leaseId or applicationId
  
  // Provider & level
  provider                SignatureProvider @default(INTERNAL)
  level                   SignatureLevel @default(SES)
  status                  SignatureRequestStatus @default(DRAFT)
  
  // Provider-specific
  providerEnvelopeId      String?
  
  // Signers
  signers                 Json     // [{ role, name, email, phone }]
  
  // Audit trail
  auditTrailStorageKey    String?
  
  // Timestamps
  createdAt               DateTime @default(now())
  updatedAt               DateTime @updatedAt
  sentAt                  DateTime?
  signedAt                DateTime?
  
  // Relations
  org                     Org      @relation(fields: [orgId], references: [id])
  lease                   Lease?   @relation(fields: [entityId], references: [id])
  
  @@index([orgId])
  @@index([entityType, entityId])
  @@index([status])
}
```

### Update Org Model

Add landlord/party info to `OrgConfig` (temporary; later support building override):

```prisma
model OrgConfig {
  // ... existing fields ...
  
  // Landlord party info
  landlordName          String?
  landlordAddress       String?
  landlordNpa           String?
  landlordLocality      String?
  landlordPhone         String?
  landlordEmail         String?
  landlordRepresentedBy String?  // "Représenté(e) par"
  
  // ... rest of model ...
}
```

### Update Unit Model

Add financial fields (optional but recommended for rent pre-fill):

```prisma
model Unit {
  // ... existing fields ...
  
  // Financial (optional)
  monthlyNetRentChf    Int?      // asking rent
  estimatedChargesChf  Int?
  garageSlotsAvailable Int?
  
  // ... rest of model ...
}
```

---

## 2. Field Auto-Fill Strategy

### From Rental Application → Lease Parties

**Source:** Approved RentalApplication entity  
**Target:** Lease tenant fields

Auto-fill:
- `tenantName` ← application.primaryApplicant.fullName
- `tenantAddress` ← application.primaryApplicant.address
- `tenantNpa` ← application.primaryApplicant.npa
- `tenantLocality` ← application.primaryApplicant.locality
- `tenantPhone` ← application.primaryApplicant.phone
- `tenantEmail` ← application.primaryApplicant.email
- `coTenantName` ← application.coApplicant.fullName (if present)
- `coTenantAddress` ← application.coApplicant.address (if present)

### From Org/OrgConfig → Landlord Party

**Source:** OrgConfig  
**Target:** Lease document header

Fields (not stored in Lease, but rendered in PDF):
- Landlord name, address, phone, email
- Represented by (e.g., property manager name)

**Implementation note:** For Phase 1, store in OrgConfig; later add BuildingConfig override.

### From Unit/Building Inventory → "Objet du bail"

**Source:** Unit + Building  
**Target:** Lease unit section

Auto-fill:
- `unitType` ← Unit.type (or Unit.unitType enum)
- `roomCount` ← Unit.roomCount (if stored)
- `floor` ← Unit.floor (if stored)
- `unitNumber` ← Unit.unitNumber
- `buildingAddress` ← Building.address (from unit's building)
- `includedSpaces` ← Unit.includedSpaces (if pre-configured)

### From Application → Service Spaces

**Source:** RentalApplication.requestedSpaces  
**Target:** Lease.includedSpaces

If application says parking/garage requested:
- Pre-check garage checkbox
- Leave count blank for PM to fill

### From Listing/Unit Financials → Rent Section

**Source:** Unit.monthlyNetRentChf, application.agreedRent  
**Target:** Lease rent fields

Auto-fill:
- `netRentChf` ← application.agreedRent || Unit.monthlyNetRentChf (PM can override)
- `garageRentChf` ← 0 (PM fills in if needed)
- `chargesTotalChf` ← Unit.estimatedChargesChf (PM can override)

---

## 3. Backend API Scope

### Lease Endpoints

#### POST /leases
Create lease draft from approved application.

**Request:**
```json
{
  "applicationId": "uuid",
  "unitId": "uuid"
}
```

**Behavior:**
1. Load application (check status = APPROVED)
2. Load unit + building
3. Load org config
4. Create Lease with auto-filled fields
5. Return 201 + lease object

**Access:** Manager or Owner

#### GET /leases?status=&applicationId=&unitId=

List leases (with filters).

**Query params:**
- `status` (DRAFT, READY_TO_SIGN, SIGNED, CANCELLED)
- `applicationId`
- `unitId`
- `limit`, `offset`

**Access:** Manager or Owner (only their org)

#### GET /leases/:id

Retrieve single lease.

**Access:** Manager or Owner (same org)

#### PATCH /leases/:id

Update editable fields.

**Editable fields:**
- Tenant info (name, address, phone, email)
- Co-tenant info
- Rent/charges/garage
- Payment details
- Deposit amount/due date
- Included spaces
- Termination dates & rule
- Stipulations
- Usage type, pets clause
- Annexes

**Not editable:** status, createdAt, PDF keys, sha256

**Access:** Manager or Owner

#### POST /leases/:id/generate-pdf

Generate draft PDF from current lease state.

**Behavior:**
1. Validate required fields
2. Call LeasePDFRenderer to generate PDF bytes
3. Store PDF (in-memory or S3-like storage)
4. Update lease.draftPdfStorageKey + draftPdfSha256
5. Return storageKey + download URL

**Access:** Manager or Owner

#### POST /leases/:id/ready-to-sign

Mark lease as READY_TO_SIGN and create SignatureRequest.

**Request:**
```json
{
  "level": "SES|AES|QES",
  "signerRole": "TENANT|CO_TENANT|LANDLORD"
}
```

**Behavior:**
1. Validate lease.status == DRAFT
2. Check required fields
3. Set lease.status = READY_TO_SIGN
4. Create SignatureRequest with signers array
5. Return 200 + lease + signatureRequest

**Access:** Manager or Owner

### SignatureRequest Endpoints

#### GET /signature-requests?entityType=&entityId=

List signature requests.

**Query params:**
- `entityType` (LEASE, APPLICATION)
- `entityId`
- `status`

**Access:** Manager or Owner (same org)

#### POST /signature-requests/:id/send

Send signature request (stub for now).

**Behavior (INTERNAL provider):**
1. Mark status = SENT
2. Record sentAt timestamp
3. (Later: send email to signers; for now: no-op)
4. Return 200

**Access:** Manager or Owner

#### POST /signature-requests/:id/mark-signed

Mark as signed (dev/testing stub).

**Behavior:**
1. Mark status = SIGNED
2. Record signedAt timestamp
3. Update linked lease.status = SIGNED
4. Return 200

**Access:** Manager or Owner (dev mode only; later gated)

---

## 4. PDF Generation

### Architecture

Create a `services/leasePDFRenderer.ts` that generates a clean, searchable PDF matching the ImmoScout24 template structure.

**Sections to include:**

1. **Parties (1.1/1.2):**
   - Landlord name, address, phone, email
   - Tenant(s) name, address, phone, email

2. **Object (2):**
   - Unit type, address, rooms, floor, unit number
   - Included spaces (cellar, attic, storage, garage)
   - Common areas (garden, laundry, etc.)

3. **Duration/Termination (3–4):**
   - Start date, fixed-term, end date
   - Termination notice period
   - Termination dates rule

4. **Rent/Charges/Payment (5–6):**
   - Net rent, garage rent, other services
   - Charges line items
   - Total rent
   - Payment due day
   - Payment recipient & account details

5. **Deposit (7):**
   - Deposit amount
   - Due date & condition

6. **Usage & Restrictions:**
   - Usage type (apartment, secondary, furnished, etc.)
   - Pets policy

7. **Other Stipulations (15):**
   - House rules attached
   - Other annexes
   - Free-text stipulations

8. **Signature Blocks:**
   - Landlord signature line
   - Tenant(s) signature line(s)
   - Date line

### Implementation Choice (Phase 1)

**Option 1: Generate clean PDF from scratch (recommended)**

Use an existing PDF library already in your project (likely from the invoice PDF generation). Create a layout-based renderer:

```typescript
// apps/api/src/services/leasePDFRenderer.ts

export class LeasePDFRenderer {
  async renderToPdf(lease: Lease & { org: Org, unit: Unit }): Promise<Buffer> {
    // Build document structure
    // Apply layout, typography, spacing
    // Render to PDF bytes
    // Return Buffer
  }
}
```

**Pros:**
- Easy to maintain
- Fully searchable text
- No brittle coordinate mapping
- Consistent with existing invoice PDFs

**Cons:**
- Doesn't look identical to original form (acceptable for MVP)

---

## 5. Frontend Scope

### Routes & Pages

#### /manager/leases (NEW)

**Page:** List all leases

Features:
- Table with columns: Unit, Tenant, Status, Start Date, Actions
- Filters: Status, Unit
- "Create Lease" button (from approved application)
- Link to lease editor

Styling: Reuse existing SaaS table components (PageShell, Section, etc.)

#### /manager/leases/[id] (NEW)

**Page:** Lease draft editor

Layout: Header + Accordion sections

**Header:**
- Lease status badge
- Breadcrumb navigation
- Actions: "Generate PDF", "Download PDF", "Mark Ready to Sign", "Save"

**Sections (Accordion/Cards):**
1. Parties (Landlord + Tenant info)
2. Object (Unit, rooms, address, included spaces)
3. Dates & Termination (Start, end, notice period, rule)
4. Rent & Charges (Net, garage, other services, line items)
5. Payment (Due day, recipient, account, IBAN)
6. Deposit (Amount, due date)
7. Usage & Restrictions (Type, pets)
8. Stipulations & Annexes (Text, house rules, other)

**Interactions:**
- Auto-populated fields on creation
- Editable text/number inputs
- Checkbox groups (included spaces, common areas, usage type)
- "Generate PDF" → calls API → shows download link
- "Mark Ready to Sign" → opens modal for signer info → creates SignatureRequest

**Styling:** Consistent with manager dashboard (Tailwind, SaaS primitives)

#### Integration: Approved Application → Create Lease

Wherever you show an approved rental application:

Add button: "Create Lease Draft"

Calls: `POST /api/leases { applicationId, unitId }`

Redirect to: `/manager/leases/[id]`

### Next.js API Proxy Routes

Add routes:

```
/api/leases.js (GET + POST)
/api/leases/[id].js (GET + PATCH)
/api/leases/[id]/generate-pdf.js (POST)
/api/leases/[id]/ready-to-sign.js (POST)
/api/signature-requests.js (GET + POST)
/api/signature-requests/[id].js (GET)
/api/signature-requests/[id]/send.js (POST)
/api/signature-requests/[id]/mark-signed.js (POST)
```

Each proxy forwards to backend with org/auth context.

---

## 6. Tests

### Test Suite: leases.test.ts

```typescript
describe('Leases', () => {
  it('POST /leases creates draft from approved application', async () => {
    // create org, building, unit, application (APPROVED)
    // POST /leases { applicationId, unitId }
    // expect 201, lease.status == DRAFT
    // expect tenant fields auto-filled
    // expect unit fields auto-filled
  })

  it('GET /leases lists by org and filters by status', async () => {
    // create multiple leases
    // GET /leases?status=DRAFT
    // expect filtered results
  })

  it('PATCH /leases/:id updates editable fields', async () => {
    // create lease
    // PATCH with new rent, dates, deposit
    // expect 200, fields persisted
  })

  it('POST /leases/:id/generate-pdf creates storage key + sha256', async () => {
    // create lease with all required fields
    // POST generate-pdf
    // expect 200, draftPdfStorageKey populated, draftPdfSha256 computed
    // expect PDF buffer is valid
  })

  it('POST /leases/:id/ready-to-sign creates SignatureRequest', async () => {
    // create lease (DRAFT)
    // POST ready-to-sign { level: "SES" }
    // expect 200, lease.status = READY_TO_SIGN
    // expect SignatureRequest created with signers
  })
})
```

### Test Suite: signatureRequests.test.ts

```typescript
describe('SignatureRequests', () => {
  it('creates SignatureRequest with correct signers', async () => {
    // create lease
    // create signatureRequest via ready-to-sign
    // expect signers array populated
    // expect status = DRAFT
  })

  it('POST /signature-requests/:id/send marks SENT', async () => {
    // create signatureRequest
    // POST send
    // expect status = SENT, sentAt recorded
  })

  it('POST /signature-requests/:id/mark-signed marks SIGNED', async () => {
    // create signatureRequest
    // POST mark-signed
    // expect status = SIGNED, signedAt recorded
    // expect linked lease.status = SIGNED
  })
})
```

---

## 7. Acceptance Criteria

- [ ] From an approved application, manager clicks "Create Lease" → gets lease draft with tenant identity/address auto-filled and unit/building address populated
- [ ] Manager can edit rent/charges/dates/payment/deposit and save
- [ ] Manager can generate and download a draft PDF
- [ ] Manager can set lease to READY_TO_SIGN, which creates a SignatureRequest (provider INTERNAL, level selectable SES/AES/QES but not enforced)
- [ ] All endpoints are manager/owner protected
- [ ] Tests pass (full suite)

---

## 8. Implementation Notes

### Data Modeling

1. **Don't over-model checkboxes:** Store service-space/common-installation selections as JSON (array of objects) for speed.
   
   Example:
   ```json
   "includedSpaces": [
     { "type": "CELLAR", "count": 1 },
     { "type": "GARAGE", "count": 2 }
   ]
   ```

2. **Keep landlord party data in OrgConfig first** (fast path). Later, add BuildingConfig override if needed.

3. **Don't implement actual signing ceremony now.** Just the request status machine (DRAFT → SENT → SIGNED) with provider/level fields for future DocuSign/Skribble integration.

4. **PDF storage:** For Phase 1, assume in-memory or simple file-based. Later add S3/cloud storage if needed.

5. **Validation:**
   - Lease requires: startDate, netRentChf, depositChf, unitId
   - SignatureRequest creation requires: lease status = DRAFT, signers array non-empty

### Dependencies

- **PDF library:** Reuse existing (likely already in project from invoice PDFs)
- **Validation:** Zod schemas for Lease + SignatureRequest
- **Access control:** Existing manager/owner helpers (requireRole, etc.)

---

## 9. Next Steps (Not This Slice)

- **Slice 8, Phase 2:** Tenant view portal (read-only lease + sign UI stub)
- **Slice 8, Phase 3:** DocuSign integration (provider = DOCUSIGN, real envelope ID)
- **Slice 8, Phase 4:** Skribble integration (provider = SKRIBBLE, QES enforcement)
- **Slice 8, Phase 5:** Payment & archive (signed PDF storage, link to invoice)

---

## Git Workflow

```bash
# Create feature branch
git checkout -b feature/slice-8-digital-lease-phase-1

# Implement in phases:
# 1. Prisma schema + migrations
# 2. Backend services + validation
# 3. API endpoints
# 4. PDF renderer
# 5. Frontend UI
# 6. Tests
# 7. Final cleanup + PR

# Commit frequently with clear messages
git commit -m "feat: add Lease and SignatureRequest models"
git commit -m "feat: implement lease CRUD endpoints"
git commit -m "feat: add LeasePDFRenderer service"
git commit -m "feat: add manager lease editor UI"
git commit -m "test: add comprehensive lease tests"
```

---

## Estimated Timeline

- **Schema + migrations:** 1 day
- **Backend services + endpoints:** 3–4 days
- **PDF renderer:** 2 days
- **Frontend UI:** 3 days
- **Tests:** 1–2 days
- **Buffer & iteration:** 2–3 days

**Total: 2–3 weeks (iterative delivery)**

---

## Questions for Clarification

1. **PDF Library:** Should I reuse the same library from invoice PDFs (e.g., PDFKit, pdfmake, etc.)? What's your preference?
2. **RentalApplication Model:** Do you have this modeled in Prisma already, or should I assume a future structure?
3. **Storage:** For Phase 1, in-memory PDF bytes are fine, or do you want basic file storage?
4. **Signer Info:** Should signer email/phone come from tenant data, or is it a manual entry field?
5. **Start Date:** Should default to today + 1 month, or let PM specify?

---

**Status:** Ready for implementation approval  
**Last updated:** 2026-02-23
