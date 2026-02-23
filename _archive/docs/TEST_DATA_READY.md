# Test Data Seeded ✅

Your database now has test data! Here's what was created:

## Test Data Summary

**Organization:** `default-org`
- Name: Default Org
- Auto-approve limit: 200 CHF

**Building:** Demo Building
- Address: Demo St 1

**Unit:** 1A
- Floor: 1

**Appliance:** Kitchen Oven

**Tenant:** Test Tenant
- Phone: +41790000000

**Contractor:** Test Contractor
- Phone: +41791234567
- Email: contractor@test.com
- Hourly rate: 100 CHF
- Services: plumbing, oven, stove, dishwasher, bathroom, lighting

**Billing Entity:** 
- IBAN: CH9300762011623852957
- VAT Number: CHE-123.456.789
- Default VAT Rate: 7.7%

## Test Requests Created (5)

1. **Leaking pipe in kitchen** (plumbing) - 250 CHF
2. **Oven not heating properly** (oven) - 180 CHF
3. **Dishwasher making noise** (dishwasher) - 120 CHF
4. **Bathroom tap dripping** (plumbing) - 80 CHF
5. **Light fixtures broken** (lighting) - 150 CHF

All requests are set to **APPROVED** status and assigned to the Test Contractor.

---

## Next Steps

1. **Start your backend:**
   ```bash
   cd apps/api
   npm run start:dev
   ```

2. **Start your frontend:**
   ```bash
   cd apps/web
   npm run dev
   ```

3. **Go to the test page:**
   - Visit `http://localhost:3000/test-jobs`
   - Click "Fetch Requests" - you'll now see 5 requests
   - Select a request and create a job
   - Create invoices and test VAT calculations!

4. **Or view invoices directly:**
   - Visit `http://localhost:3000/owner/invoices`
   - Create/manage invoices from the UI

---

## Troubleshooting

**Still showing no requests?**
- Make sure the backend is running
- Try clearing the browser cache
- Refresh the page

**Need more test data?**
- Run the seed script again: `npm run seed`
- Or add more to `prisma/seed.ts` and re-run

Enjoy testing! 🚀
