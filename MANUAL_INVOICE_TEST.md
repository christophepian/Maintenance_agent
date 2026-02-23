# Manual Invoice Model Upgrade Test

This test verifies Slice 8.3 (Invoice Model Upgrade) features end-to-end through the API.

**Prerequisites:**
- Backend running on port 3001: `cd apps/api && npm run start:dev`
- PostgreSQL running: `docker-compose up` (in infra/)
- Database migrations applied

## Test Steps

### 1. Start the backend (if not already running)
```bash
cd apps/api
npm run start:dev
```

Wait for "Server listening on port 3001"

### 2. Test VAT Calculation with Default Rate (7.7%)

Create an invoice with 100 CHF item at default 7.7% VAT. Expected total: 107.7 CHF

```bash
curl -X POST http://localhost:3001/invoices \
  -H "Content-Type: application/json" \
  -d '{
    "orgId": "default-org",
    "jobId": "test-job-1",
    "issuerBillingEntityId": "test-billing-1",
    "recipientName": "Test Client",
    "recipientAddressLine1": "Street 1",
    "recipientPostalCode": "8000",
    "recipientCity": "Zurich",
    "recipientCountry": "CH",
    "lineItems": [
      {
        "description": "Plumbing repair",
        "quantity": 1,
        "unitPrice": 100,
        "vatRate": 7.7
      }
    ]
  }'
```

**Verify:**
- ✅ Response contains `totalAmount: 107.7` (or close to it)
- ✅ Response contains `lineItems[0].lineTotal` in cents (10770)
- ✅ Status is `DRAFT`

Save the invoice ID from the response as `INVOICE_1_ID`

---

### 3. Test VAT Calculation with Multiple Items

Create invoice with 2 items at different quantities:
- Item 1: 2 × 100 CHF = 200 CHF → 215.4 CHF (with 7.7% VAT)
- Item 2: 1 × 150 CHF = 150 CHF → 161.55 CHF (with 7.7% VAT)
- **Expected total: 376.95 CHF**

```bash
curl -X POST http://localhost:3001/invoices \
  -H "Content-Type: application/json" \
  -d '{
    "orgId": "default-org",
    "jobId": "test-job-2",
    "issuerBillingEntityId": "test-billing-1",
    "recipientName": "Test Client",
    "recipientAddressLine1": "Street 1",
    "recipientPostalCode": "8000",
    "recipientCity": "Zurich",
    "recipientCountry": "CH",
    "lineItems": [
      {
        "description": "Item 1",
        "quantity": 2,
        "unitPrice": 100,
        "vatRate": 7.7
      },
      {
        "description": "Item 2",
        "quantity": 1,
        "unitPrice": 150,
        "vatRate": 7.7
      }
    ]
  }'
```

**Verify:**
- ✅ Response contains `totalAmount` approximately 376.95
- ✅ `lineItems.length === 2`

Save the invoice ID as `INVOICE_2_ID`

---

### 4. Test Custom VAT Rate

Create invoice with 3.7% VAT (reduced rate):
- 250 CHF × 3.7% = 9.25 CHF VAT
- **Expected total: 259.25 CHF**

```bash
curl -X POST http://localhost:3001/invoices \
  -H "Content-Type: application/json" \
  -d '{
    "orgId": "default-org",
    "jobId": "test-job-3",
    "issuerBillingEntityId": "test-billing-1",
    "recipientName": "Test Client",
    "recipientAddressLine1": "Street 1",
    "recipientPostalCode": "8000",
    "recipientCity": "Zurich",
    "recipientCountry": "CH",
    "lineItems": [
      {
        "description": "Emergency repair",
        "quantity": 1,
        "unitPrice": 250,
        "vatRate": 3.7
      }
    ]
  }'
```

**Verify:**
- ✅ Response contains `totalAmount` approximately 259.25
- ✅ `vatRate === 3.7`

Save the invoice ID as `INVOICE_3_ID`

---

### 5. Test Invoice Issuance & Sequential Numbering

Issue the first invoice. This should:
- Lock the invoice (`lockedAt` timestamp set)
- Generate sequential invoice number (format: `YYYY-NNN`)
- Increment the billing entity's sequence counter

```bash
curl -X POST http://localhost:3001/invoices/$INVOICE_1_ID/issue \
  -H "Content-Type: application/json" \
  -d '{
    "issuerBillingEntityId": "test-billing-1"
  }'
```

**Verify:**
- ✅ Response contains `invoiceNumber` (e.g., "2026-001")
- ✅ Response contains `lockedAt` timestamp
- ✅ Response status is still `DRAFT` (not yet APPROVED)

---

### 6. Test Sequential Numbering (Second Invoice)

Issue the second invoice and verify sequential numbering:

```bash
curl -X POST http://localhost:3001/invoices/$INVOICE_2_ID/issue \
  -H "Content-Type: application/json" \
  -d '{
    "issuerBillingEntityId": "test-billing-1"
  }'
```

**Verify:**
- ✅ Response contains `invoiceNumber` (e.g., "2026-002")
- ✅ The sequence number is higher than the first invoice

---

### 7. Test Prevention of Re-issuance

Try to issue the first invoice again. Should fail:

```bash
curl -X POST http://localhost:3001/invoices/$INVOICE_1_ID/issue \
  -H "Content-Type: application/json" \
  -d '{
    "issuerBillingEntityId": "test-billing-1"
  }'
```

**Verify:**
- ✅ Response contains error message about invoice already being locked/issued
- ✅ HTTP status is 400 or similar

---

### 8. Test Invoice Approval Workflow

Approve the first invoice (transitions from DRAFT → APPROVED):

```bash
curl -X POST http://localhost:3001/invoices/$INVOICE_1_ID/approve \
  -H "Content-Type: application/json" \
  -d '{}'
```

**Verify:**
- ✅ Response contains `status: "APPROVED"`
- ✅ Response contains `invoiceNumber` (already set)
- ✅ Response contains `iban` from the billing entity

---

### 9. Test Invoice Retrieval

Retrieve an invoice to verify all fields are properly stored:

```bash
curl -X GET http://localhost:3001/invoices/$INVOICE_1_ID
```

**Verify:**
- ✅ Response contains all invoice details (issuer, recipient, amounts, line items)
- ✅ Response contains `iban` field
- ✅ `lineItems[0].lineTotal` is present in cents
- ✅ `totalAmount` matches our calculation

---

### 10. Test Invoice Listing with Status Filter

List all approved invoices:

```bash
curl -X GET "http://localhost:3001/invoices?status=APPROVED"
```

**Verify:**
- ✅ Response is an array of invoices
- ✅ All returned invoices have `status: "APPROVED"`

---

## Summary Checklist

After running all tests, verify:

- [ ] VAT calculations correct with default 7.7% rate
- [ ] VAT calculations correct with custom rates (3.7%)
- [ ] VAT calculations correct with multiple line items
- [ ] Sequential numbering works (2026-001, 2026-002, etc.)
- [ ] Locking prevents re-issuance
- [ ] Approval workflow transitions DRAFT → APPROVED
- [ ] IBAN included on approval
- [ ] Invoice retrieval returns all fields
- [ ] Status filtering works

**If all tests pass: ✅ Slice 8.3 is working correctly!**

---

## Troubleshooting

**"Cannot POST /invoices"**
- Make sure backend is running on port 3001
- Check `npm run start:dev` output for errors

**"jobId not found"** 
- Use a valid job ID from your database, or check if test jobs exist

**"billingEntityId not found"**
- Create a test billing entity first or use "test-billing-1" if it exists

**"invoice not found"**
- Make sure you saved the invoice ID from the response and use it correctly

**Math doesn't match**
- Amounts are in CHF in responses
- Internal calculations use cents (×100)
- Example: 107.7 CHF = 10770 cents
