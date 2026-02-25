/**
 * G10: API Contract Tests — Prevent Silent DTO Drift
 *
 * These tests assert the response shape of key endpoints.
 * If a DTO changes, these tests will catch missing/renamed fields.
 * Update contract expectations in the same PR as any DTO change.
 */

const API_BASE = process.env.API_BASE_URL || 'http://127.0.0.1:3001';

async function fetchJson(path: string) {
  const res = await fetch(`${API_BASE}${path}`);
  if (!res.ok) throw new Error(`${res.status} ${res.statusText} for ${path}`);
  return res.json();
}

// ── Helper: check that an object has all expected keys ──
function expectKeys(obj: Record<string, any>, keys: string[], label: string) {
  for (const key of keys) {
    expect(obj).toHaveProperty(key);
  }
}

describe('G10: API Contract Tests', () => {
  // ── Requests ──
  describe('GET /requests?limit=1', () => {
    it('returns an array with expected request shape', async () => {
      const body = await fetchJson('/requests?limit=1');
      expect(Array.isArray(body.data)).toBe(true);

      if (body.data.length > 0) {
        const req = body.data[0];
        expectKeys(req, [
          'id', 'description', 'status', 'createdAt',
        ], 'Request');

        // category and estimatedCost are optional but should not be unexpected types
        if (req.category !== undefined) {
          expect(typeof req.category).toBe('string');
        }
        if (req.estimatedCost !== undefined) {
          expect(typeof req.estimatedCost).toBe('number');
        }
      }
    });
  });

  // ── Jobs ──
  describe('GET /jobs?limit=1', () => {
    it('returns an array with expected job shape', async () => {
      const body = await fetchJson('/jobs?limit=1');
      expect(Array.isArray(body.data)).toBe(true);

      if (body.data.length > 0) {
        const job = body.data[0];
        expectKeys(job, [
          'id', 'orgId', 'requestId', 'contractorId', 'status',
          'createdAt', 'updatedAt',
        ], 'Job');

        // Nested request should be present
        if (job.request) {
          expectKeys(job.request, ['description'], 'Job.request');
        }

        // Nested contractor should be present
        if (job.contractor) {
          expectKeys(job.contractor, ['id', 'name', 'phone', 'email'], 'Job.contractor');
        }
      }
    });
  });

  // ── Invoices ──
  describe('GET /invoices?limit=1', () => {
    it('returns an array with expected invoice shape', async () => {
      const body = await fetchJson('/invoices?limit=1');
      expect(Array.isArray(body.data)).toBe(true);

      if (body.data.length > 0) {
        const inv = body.data[0];
        expectKeys(inv, [
          'id', 'orgId', 'jobId', 'status',
          'recipientName', 'recipientAddressLine1',
          'recipientPostalCode', 'recipientCity', 'recipientCountry',
          'subtotalAmount', 'vatAmount', 'totalAmount', 'currency',
          'createdAt', 'updatedAt',
        ], 'Invoice');

        // lineItems must be an array
        expect(Array.isArray(inv.lineItems)).toBe(true);

        if (inv.lineItems.length > 0) {
          expectKeys(inv.lineItems[0], [
            'id', 'description', 'quantity', 'unitPrice', 'vatRate', 'lineTotal',
          ], 'InvoiceLineItem');
        }
      }
    });
  });

  // ── Leases ──
  describe('GET /leases?limit=1', () => {
    it('returns an array with expected lease shape', async () => {
      const body = await fetchJson('/leases?limit=1');
      expect(Array.isArray(body.data)).toBe(true);

      if (body.data.length > 0) {
        const lease = body.data[0];
        expectKeys(lease, [
          'id', 'orgId', 'status', 'unitId',
          'landlordName', 'landlordAddress', 'landlordZipCity',
          'tenantName',
          'objectType',
          'startDate', 'isFixedTerm', 'noticeRule', 'terminationDatesRule',
          'netRentChf',
          'depositDueRule', 'includesHouseRules',
          'createdAt', 'updatedAt',
        ], 'Lease');

        // Nested unit should be present with building
        if (lease.unit) {
          expectKeys(lease.unit, ['id', 'unitNumber', 'type'], 'Lease.unit');
          if (lease.unit.building) {
            expectKeys(lease.unit.building, ['id', 'name', 'address'], 'Lease.unit.building');
          }
        }
      }
    });
  });

  // ── Contractors (bonus) ──
  describe('GET /contractors?limit=1', () => {
    it('returns an array with expected contractor shape', async () => {
      const body = await fetchJson('/contractors?limit=1');
      expect(Array.isArray(body.data)).toBe(true);

      if (body.data.length > 0) {
        const c = body.data[0];
        expectKeys(c, [
          'id', 'name', 'phone', 'email',
        ], 'Contractor');
      }
    });
  });
});
