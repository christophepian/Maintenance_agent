# Slice 8+ PRD: Notifications, Swiss Invoicing, Scheduling

**Status:** Backlog / Planning  
**Target:** Post-Slice 7 (Portal UIs complete)

---

## 1. Purpose

This PRD defines the requirements for:

- Building-scoped in-app notifications
- Swiss-compliant invoice upgrade with QR-bill support
- Web-native invoice pages with PDF export
- Scheduling groundwork (contractor ↔ tenant appointments)

The goal is to:

- Improve operational clarity
- Enable frictionless Swiss payment via QR-bill
- Support SLA-dependent billing flows
- Maintain architectural integrity with the existing system
- Preserve database persistence guarantees
- Align with current test structure and governance model

---

## 2. Scope

### Included

- Building-scoped in-app notification system
- `BillingEntity` model (invoice emitter)
- Sequential invoice numbering per `BillingEntity`
- VAT-inclusive invoice model
- Invoice line items
- Invoice locking on issuance
- QR-bill generation (Swiss QR standard)
- Invoice webpage rendering
- PDF download
- `Appointment` model (half-hour slots)
- Tests for all new models, services, and endpoints

### Not Included

- Email notifications
- SMS notifications
- eBill integration
- Payment processing inside the app
- SaaS subscription billing
- Bank reconciliation automation

---

## 3. Architectural Principles (Must Be Respected)

- **Raw HTTP server** (no Express, no Nest)
- **Prisma ORM** for data persistence
- **PostgreSQL** persistent via Docker volume
- **Zod validation** required for new endpoints
- **Org-scoped data access** enforced
- **Role-based governance enforcement** (OWNER_DIRECT vs MANAGED)
- **Jest test coverage** mandatory for all new code
- **No destructive DB operations** without explicit user approval
- **All new models must be org-scoped** unless justified otherwise
- **Atomic transactions** for critical operations (invoice issuance, appointment booking)

---

## 4. Feature A — Building-Scoped In-App Notifications

### 4.1 Objective

Deliver in-app notifications routed per building to:

- Owners
- Contractors
- Managers
- Tenants (limited cases)

### 4.2 Notification Scope Rules

Notifications must be tied to:

- `requestId`
- `jobId`
- `invoiceId`

Each notification must optionally include:

- `buildingId` (nullable but used when applicable)

### 4.3 Trigger Events

#### Tenant

Only when request:

- is approved
- and contractor is assigned

Combined message: "Request approved - contractor assigned"

#### Contractor

- Request assigned
- Invoice disputed
- Invoice approved
- Invoice paid

#### Owner

- Request pending owner approval
- Invoice created
- Invoice status changes

#### Manager (if MANAGED mode)

- Request pending review
- Invoice disputed
- Owner rejected request

### 4.4 Data Model

```prisma
model Notification {
  id        String   @id @default(uuid())
  orgId     String
  userId    String
  buildingId String?  // nullable, but used when request/job/invoice belongs to building

  // Entity reference
  entityType String  // REQUEST | JOB | INVOICE
  entityId   String  // requestId, jobId, or invoiceId

  // Event
  eventType  String  // REQUEST_APPROVED | INVOICE_CREATED | etc.
  message    String?

  // Read status
  readAt     DateTime?

  // Timestamps
  createdAt  DateTime @default(now())

  @@unique([orgId, userId, entityType, entityId, eventType])
  @@index([orgId, userId])
  @@index([orgId, buildingId])
}
```

All rows must be **org-scoped**.

### 4.5 DoD — Notifications

Each slice must include:

- **Validation:**
  - Zod schema for notification creation (if any user-facing endpoint)
  - Event type must be in allowed list

- **Integration tests:**
  - Notification created on trigger event
  - Correct building-scoped routing
  - Only correct users receive notification
  - Role access tests (OWNER_DIRECT vs MANAGED)
  - No cross-org leakage
  - Mark as read functionality

- **API Endpoints:**
  - `GET /notifications` (user's unread notifications)
  - `GET /notifications/:id/read` (mark as read)
  - `DELETE /notifications/:id` (dismiss)

- **UI:**
  - Notification list page
  - Unread badge count in sidebar
  - Real-time updates (polling or WebSocket future)

---

## 5. Feature B — Swiss-Compliant Invoicing Upgrade

### 5.1 Objectives

- Support SLA-dependent invoice flows
- Sequential invoice numbering per emitter
- VAT included by default
- QR-bill compatible data
- Invoice locking on issuance
- Web page rendering + PDF export

### 5.2 Billing Entity Model

#### 5.2.1 Rationale

Invoice numbering and IBAN belong to issuer, not the generic Invoice.

#### 5.2.2 Model

```prisma
model BillingEntity {
  id                   String  @id @default(uuid())
  orgId                String
  org                  Org     @relation(fields: [orgId], references: [id])

  // Emitter type
  type                 String  // CONTRACTOR | ORG | OWNER

  // Billing details
  name                 String
  addressLine1         String
  addressLine2         String?
  postalCode           String
  city                 String
  country              String  @default("CH")

  // Swiss payment
  iban                 String  // Required for QR-bill
  vatNumber            String? // CHE-123.456.789

  // Invoice defaults
  defaultVatRate       Float   @default(7.7) // Swiss VAT, percent
  nextInvoiceSequence  Int     @default(1)

  // Relations
  invoices             Invoice[]

  // Timestamps
  createdAt            DateTime @default(now())
  updatedAt            DateTime @updatedAt

  @@unique([orgId, type])
  @@index([orgId])
}
```

#### 5.2.3 Rules

- **IBAN required** for all BillingEntities
- **VAT default included** (7.7% for Switzerland)
- **Invoice number assigned only at issuance**
- **Sequence increment must be atomic transaction**
- **Invoice number immutable** once assigned
- One `BillingEntity` per org per type (CONTRACTOR | ORG | OWNER)

---

## 6. Invoice Model Upgrade

### 6.1 New Fields

```prisma
model Invoice {
  id                      String  @id @default(uuid())
  orgId                   String
  jobId                   String  @unique
  job                     Job     @relation(fields: [jobId], references: [id])

  // Issuer & recipient
  issuerBillingEntityId   String
  issuer                  BillingEntity @relation(fields: [issuerBillingEntityId], references: [id])

  // Recipient (debtor)
  recipientName           String
  recipientAddressLine1   String
  recipientAddressLine2   String?
  recipientPostalCode     String
  recipientCity           String
  recipientCountry        String  @default("CH")

  // Dates
  issueDate               DateTime?
  dueDate                 DateTime?

  // Invoice numbering
  invoiceNumber           String?  // null until issued, then immutable (e.g. "2026-001")
  invoiceNumberFormat     String   @default("YYYY-NNN") // year-sequence

  // Amounts (CHF)
  subtotalAmount          Int      // cents
  vatAmount               Int      // cents
  totalAmount             Int      // cents
  currency                String   @default("CHF")
  vatRate                 Float    @default(7.7)

  // Payment
  paymentReference        String?  // Swiss ORF/ISR reference
  iban                    String?  // Issuer IBAN (copied at issuance)

  // Status
  status                  String   @default("DRAFT") // DRAFT | APPROVED | PAID | DISPUTED | ISSUED
  lockedAt                DateTime? // Set when DRAFT → APPROVED

  // Line items
  lineItems               InvoiceLineItem[]

  // Timestamps
  createdAt               DateTime @default(now())
  updatedAt               DateTime @updatedAt

  @@unique([orgId, invoiceNumber])
  @@index([orgId, jobId])
  @@index([issuerBillingEntityId])
}
```

### 6.2 Line Items

```prisma
model InvoiceLineItem {
  id            String  @id @default(uuid())
  invoiceId     String
  invoice       Invoice @relation(fields: [invoiceId], references: [id], onDelete: Cascade)

  description   String
  quantity      Float   @default(1.0)
  unitPrice     Int     // cents
  vatRate       Float   @default(7.7)
  lineTotal     Int     // cents (calculated: quantity * unitPrice)

  createdAt     DateTime @default(now())

  @@index([invoiceId])
}
```

### 6.3 Issuance Logic

When invoice transitions from `DRAFT` → `APPROVED` (or explicit issuance):

```typescript
// Pseudo-code
async function issueInvoice(invoiceId: string, orgId: string) {
  return await prisma.$transaction(async (tx) => {
    // 1. Lock invoice
    const invoice = await tx.invoice.findUnique({ where: { id: invoiceId } });
    if (invoice.invoiceNumber) throw new Error("Already issued");

    // 2. Read issuer & sequence
    const issuer = await tx.billingEntity.findUnique({
      where: { id: invoice.issuerBillingEntityId }
    });

    // 3. Increment sequence atomically
    const updated = await tx.billingEntity.update({
      where: { id: issuer.id },
      data: { nextInvoiceSequence: issuer.nextInvoiceSequence + 1 }
    });

    // 4. Assign invoice number (immutable)
    const invoiceNumber = `${new Date().getFullYear()}-${String(issuer.nextInvoiceSequence).padStart(3, "0")}`;

    // 5. Persist
    return await tx.invoice.update({
      where: { id: invoiceId },
      data: {
        invoiceNumber,
        issueDate: new Date(),
        dueDate: addDays(new Date(), 30), // Example SLA
        lockedAt: new Date(),
        status: "ISSUED"
      }
    });
  });
}
```

**Key guarantees:**

- Invoice number assigned exactly once
- No race condition in sequence
- Atomic all-or-nothing

---

## 7. Swiss QR-Bill Support

### 7.1 Requirements

Invoice must support:

- IBAN
- Creditor details (from `BillingEntity`)
- Debtor details (from Invoice recipient fields)
- Amount (CHF, from `totalAmount`)
- Reference number (structured or unstructured)
- Structured QR payload

QR must:

- Follow [Swiss QR-bill standard](https://www.swiss-qr-bill.ch)
- Be renderable on web page (SVG or PNG)
- Be included in PDF
- Be machine-readable by Swiss mobile banking apps

### 7.2 QR-Bill Data

```typescript
interface SwissQRBillPayload {
  qrType: "SPC";            // Swiss Payment Code
  version: "0200";          // Version
  coding: "1";              // UTF-8
  amount: string;           // CHF amount, e.g. "1234.56"
  currency: "CHF";
  creditorName: string;
  creditorAddressLine1: string;
  creditorPostalCode: string;
  creditorCity: string;
  creditorCountry: string;
  iban: string;
  reference: string;        // e.g. "000000000000000123000000005"
  unstructuredMessage?: string;
  debtorName: string;
  debtorAddressLine1: string;
  debtorPostalCode: string;
  debtorCity: string;
  debtorCountry: string;
}
```

### 7.3 DoD — QR-Bill

- Zod validation for QR payload structure
- Snapshot test for QR generation (ensure deterministic)
- QR code generates without errors
- PDF contains QR image
- Amount + reference validated in test
- Swiss QR-bill validator passes (mock or real)

---

## 8. Invoice Rendering

### 8.1 Web Invoice Page

Route: `GET /invoices/:id` (webpage, not JSON)

Must include:

- **Header:** Issuer name, logo placeholder, issue date
- **Metadata:** Invoice number, due date, payment terms
- **Link to request/job/building:** Contextual navigation
- **Line items table:**
  - Description
  - Quantity × Unit price
  - VAT rate
  - Line total
- **Summary:**
  - Subtotal (CHF)
  - VAT amount
  - Total (CHF)
- **Payment section:**
  - IBAN
  - Reference number
  - Due date + SLA note
- **QR-bill visual block:**
  - SVG or embedded PNG
  - Machine-readable
  - Print-ready size

### 8.2 PDF Export

Route: `GET /invoices/:id/pdf`

- Deterministic layout (same content as webpage)
- Same fields as web page
- Embedded QR code image
- Proper formatting for Swiss print standard (A4, margins)
- File name: `Invoice-{invoiceNumber}-{date}.pdf`

### 8.3 Frontend UI

- Invoice list page with filters (status, due date, building)
- Invoice detail with render
- Download PDF button

---

## 9. Scheduling Groundwork

### 9.1 Objective

Enable contractor ↔ tenant appointment scheduling for job execution.

### 9.2 Appointment Model

```prisma
model Appointment {
  id            String   @id @default(uuid())
  orgId         String
  org           Org      @relation(fields: [orgId], references: [id])

  // References
  requestId     String?
  request       Request? @relation(fields: [requestId], references: [id], onDelete: SetNull)

  jobId         String?
  job           Job?     @relation(fields: [jobId], references: [id], onDelete: SetNull)

  buildingId    String?
  building      Building? @relation(fields: [buildingId], references: [id], onDelete: SetNull)

  // Time slot (30-minute fixed)
  startAt       DateTime // ISO 8601 in Europe/Zurich
  endAt         DateTime // Always startAt + 30 minutes

  // Status
  status        String   @default("PROPOSED") // PROPOSED | CONFIRMED | CANCELLED | COMPLETED

  // Metadata
  createdByRole String   // Who created: TENANT | CONTRACTOR | OWNER
  notes         String?

  createdAt     DateTime @default(now())
  updatedAt     DateTime @updatedAt

  @@unique([jobId, startAt])
  @@index([orgId, buildingId])
  @@index([jobId])
}
```

### 9.3 Constraints

- **Timezone:** `Europe/Zurich` (always)
- **Slot duration:** 30-minute fixed (immutable)
- **Contractor calendar:** Treated as single calendar (no per-contractor multi-slot validation yet)
- **Overlaps:** No confirmed appointments can overlap
- **Confirmation:** Tenant can confirm one proposed appointment per job

### 9.4 Appointment Lifecycle

1. **PROPOSED:** Contractor or owner suggests time slot
2. **CONFIRMED:** Tenant accepts slot
3. **CANCELLED:** Any party cancels (with optional reason)
4. **COMPLETED:** Appointment finished, job marked COMPLETED

### 9.5 Validation Rules

- `endAt` must equal `startAt + 30 minutes` (enforced in setter)
- `startAt` must be in future
- `startAt` must be on half-hour boundary (e.g., 14:00, 14:30, 15:00)
- No overlapping confirmed appointments for same job/building
- Tenant can only confirm (not create) appointments on own request

### 9.6 DoD — Appointments

- Zod validation for slot creation
- Validation: slot length exactly 30 min
- Validation: no overlapping confirmed appointments
- Tenant can confirm one of proposed appointments
- Integration tests for full lifecycle
- Role access enforced (contractor can propose, tenant can confirm)
- Tests for timezone handling (ensure UTC ↔ Zurich conversion correct)

---

## 10. Slice Breakdown

### Slice 8.1 — Notification Core

- Notification model + org-scoping
- Event trigger logic (on request approval, invoice status change, etc.)
- In-app listing endpoint
- Mark-as-read endpoint
- Integration tests
- Frontend: notification list page, unread badge

**Estimated scope:** 40–60 hours

### Slice 8.2 — BillingEntity

- Prisma model
- CRUD services
- Zod validation
- Unique constraint (one per org per type)
- Integration tests
- Frontend: billing entity management UI

**Estimated scope:** 20–30 hours

### Slice 8.3 — Invoice Model Upgrade

- Extended Invoice model with issuer, recipient, VAT
- Line items model + CRUD
- VAT calculation service
- Invoice locking logic
- Atomic issuance transaction
- Integration tests for numbering, locking, VAT

**Estimated scope:** 40–60 hours

### Slice 8.4 — QR-Bill Integration

- Swiss QR-bill payload builder
- QR code generation (library: qrcode, sharp, or similar)
- QR payload validation
- Web page render endpoint
- Snapshot tests
- Integration test for QR structure

**Estimated scope:** 30–40 hours

### Slice 8.5 — PDF Generation

- Server-side PDF renderer (library: pdfkit, puppeteer, or html2pdf)
- Embed QR code in PDF
- Deterministic layout
- Swiss print standard compliance
- PDF endpoint
- Tests for PDF structure

**Estimated scope:** 30–50 hours

### Slice 8.6 — Appointment Model

- Prisma model
- CRUD services
- Validation (no overlaps, 30-min slots, future only)
- Lifecycle transitions
- Timezone handling (Europe/Zurich)
- Integration tests
- Frontend: appointment proposal/confirmation UI

**Estimated scope:** 30–40 hours

---

## 11. Testing Requirements (Mandatory)

Each slice must:

- ✅ **Pass all existing 59 tests**
- ✅ **Add new integration tests** (minimum 5–10 per slice)
- ✅ **Test cross-org isolation** (no leakage)
- ✅ **Test OWNER_DIRECT governance** (role access)
- ✅ **Use non-destructive migrations** (additive only)
- ✅ **Never use destructive `prisma migrate reset`**
- ✅ **Be compatible with persistent DB volume** (Docker volume survives restarts)

---

## 12. Non-Functional Requirements

- **Atomic invoice issuance:** No race conditions in numbering
- **No cross-org leakage:** All queries must include orgId filter
- **Performance:** Acceptable under current raw HTTP architecture
- **Prisma migrations:** Additive only, never destructive
- **Database:** Always persistent (Docker volume `maint_agent_pgdata`)
- **Concurrency:** Transactions where atomic guarantees needed

---

## 13. Acceptance Criteria

The epic is complete when:

- ✅ Building-scoped notifications working end-to-end
- ✅ Invoice numbering per emitter working (no race conditions)
- ✅ VAT calculation accurate (default 7.7%)
- ✅ QR-bill valid and machine-readable
- ✅ Invoice webpage renders correctly
- ✅ PDF downloadable and QR-scannable
- ✅ Appointments functional (no overlaps, 30-min slots)
- ✅ All tests passing (59 existing + new coverage)
- ✅ No destructive DB commands used
- ✅ All models org-scoped
- ✅ Role-based governance enforced
- ✅ No cross-org leakage

---

## 14. Next Steps

To proceed with implementation:

1. **Slice prioritization:** Start with Slice 8.2 (BillingEntity) to unblock Slice 8.3 (Invoice upgrade)
2. **Slice 8.1 (Notifications)** can run in parallel
3. **Slice 8.4–8.5 (QR + PDF)** depend on Slice 8.3
4. **Slice 8.6 (Appointments)** independent and can start anytime

**For each slice:**

- Generate prompt-ready instructions
- Include migration boilerplate
- Include test template
- Include API endpoint template

Would you like:

- [ ] Break this into prompt-ready slice instructions?
- [ ] Refine the QR-bill + PDF generation technical approach?
- [ ] Add pricing model for invoicing (optional)?
- [ ] Add notification real-time updates via WebSocket (optional)?
