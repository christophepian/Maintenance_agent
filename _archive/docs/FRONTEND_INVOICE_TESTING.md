# Frontend Testing Guide - Slice 8.3 Invoice Model Upgrade

You can test the Invoice features directly through the Next.js frontend! Here are the main pages:

## 1. Test Page (Best for Development)

**URL:** `http://localhost:3000/test-jobs`

This is the best place to start. It has an interactive test interface with a live log.

### Steps:

1. Start the frontend:
   ```bash
   cd apps/web
   npm run dev
   ```

2. Open browser to `http://localhost:3000/test-jobs`

3. **Fetch Invoices**
   - Click "Fetch Invoices"
   - You should see a list of all invoices with their details
   - Check that VAT amounts are calculated correctly in the display

4. **Create an Invoice**
   - You'll need a Job first, so:
     - Click "Fetch Requests"
     - Select a request
     - Click "Create Job" (or "Approve Request" first if needed)
   - Once you have a job, select it
   - Click "Create Invoice for Job"
   - Enter invoice amount
   - Click "Create Invoice"
   - Verify the response shows:
     - ✅ Invoice ID
     - ✅ Status: DRAFT
     - ✅ VAT calculations correct
     - ✅ Line items with `lineTotal` field

5. **Approve Invoice**
   - Select an invoice from the list
   - Click "Approve Invoice"
   - Verify:
     - ✅ Status changes to APPROVED
     - ✅ Invoice number is assigned (format: YYYY-NNN)
     - ✅ IBAN is included

6. **Mark as Paid**
   - Select an APPROVED invoice
   - Click "Mark as Paid"
   - Verify:
     - ✅ Status changes to PAID
     - ✅ `paidAt` timestamp is set

---

## 2. Owner Invoices Page

**URL:** `http://localhost:3000/owner/invoices`

This is a real UI page for the Owner role to manage invoices.

### Features to Test:

1. **Invoice List**
   - Navigate to the page
   - You should see all invoices in a table
   - Verify columns show:
     - Invoice ID
     - Amount (in CHF)
     - Status (with color coding)
     - Actions

2. **Filter by Status**
   - Use the dropdown filter at top-right
   - Select "DRAFT", "APPROVED", "PAID", "DISPUTED"
   - Verify list updates with correct invoices

3. **Approve Invoice**
   - Find a DRAFT invoice
   - Click "Approve" button
   - Invoice should change to APPROVED status
   - Invoice number should appear

4. **Mark as Paid**
   - Find an APPROVED invoice
   - Click "Mark Paid" button
   - Status should change to PAID
   - A paid date should appear

5. **Dispute Invoice**
   - Find any invoice
   - Click "Dispute" button
   - Status should change to DISPUTED
   - Invoice details should show dispute reason (if implemented)

---

## 3. Invoice Details (if available)

Some pages may have invoice detail views showing:
- ✅ Line items with VAT breakdown
- ✅ Issuer (billing entity) info and IBAN
- ✅ Recipient details
- ✅ Invoice number and due date
- ✅ Payment reference

---

## What to Verify for Slice 8.3

When testing through the frontend, check:

### VAT Calculations ✅
- [ ] Default 7.7% VAT applied correctly
- [ ] Custom VAT rates work
- [ ] Multiple line items calculate totals correctly
- [ ] Subtotal, VAT, and total amounts are accurate

### Invoice Numbering ✅
- [ ] Invoice number format is YYYY-NNN (e.g., 2026-001)
- [ ] Numbers increment sequentially per billing entity
- [ ] Invoice is locked after numbering (no re-edits)

### Invoice Lifecycle ✅
- [ ] DRAFT → APPROVED transition works
- [ ] APPROVED → PAID transition works
- [ ] DRAFT invoices can't be marked paid
- [ ] APPROVED invoices show paid date when marked paid

### Invoice Data ✅
- [ ] Line items display with descriptions, quantities, unit prices
- [ ] `lineTotal` field shows (in cents or CHF depending on context)
- [ ] Issuer IBAN appears after approval
- [ ] Recipient details are preserved
- [ ] Invoice number persists after creation

---

## Troubleshooting

**"Invoices list is empty"**
- Create some jobs and invoices first using the test-jobs page
- Then refresh the owner/invoices page

**"Invoice status not updating"**
- Make sure the backend is running: `cd apps/api && npm run start:dev`
- Check browser console for network errors
- Verify the invoice ID is correct

**"VAT amounts look wrong"**
- Remember: API responses show amounts in CHF
- Internal calculations use cents (×100)
- 107.7 CHF = 10770 cents

**"Can't create invoice"**
- Need a valid Job first
- Job must belong to the org
- Try using the test-jobs page to create jobs

---

## Frontend File Locations

If you want to look at the code:
- Owner Invoices page: [apps/web/pages/owner/invoices.js](apps/web/pages/owner/invoices.js)
- Test page: [apps/web/pages/test-jobs.js](apps/web/pages/test-jobs.js)
- API proxy routes: [apps/web/pages/api/invoices/](apps/web/pages/api/invoices/)

---

## Quick Start Command

```bash
# Terminal 1: Backend
cd apps/api
npm run start:dev

# Terminal 2: Database (if not running)
cd infra
docker-compose up

# Terminal 3: Frontend
cd apps/web
npm run dev

# Then open http://localhost:3000/test-jobs
```

Enjoy testing! 🚀
