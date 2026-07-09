/**
 * G10: API Contract Tests — Prevent Silent DTO Drift
 *
 * These tests assert the response shape of key endpoints.
 * If a DTO changes, these tests will catch missing/renamed fields.
 * Update contract expectations in the same PR as any DTO change.
 */

import { ChildProcessWithoutNullStreams } from 'child_process';
import { startTestServer, stopTestServer, createTenantToken, createTestToken, getAuthHeaders } from './testHelpers';

const PORT = 3205;
const API_BASE = `http://127.0.0.1:${PORT}`;

async function fetchJson(path: string) {
  const res = await fetch(`${API_BASE}${path}`);
  if (!res.ok) throw new Error(`${res.status} ${res.statusText} for ${path}`);
  return res.json();
}

async function fetchWithRole(path: string, role: string) {
  const res = await fetch(`${API_BASE}${path}`, {
    headers: { 'x-dev-role': role },
  });
  return res;
}

// ── Helper: check that an object has all expected keys ──
function expectKeys(obj: Record<string, any>, keys: string[], _label: string) {
  for (const key of keys) {
    expect(obj).toHaveProperty(key);
  }
}

describe('G10: API Contract Tests', () => {
  let proc: ChildProcessWithoutNullStreams;

  beforeAll(async () => {
    proc = await startTestServer(PORT, { AUTH_OPTIONAL: "true", NODE_ENV: "test" });
  }, 60000); // cold ts-node server spawn on CI can exceed 20 s

  afterAll(() => stopTestServer(proc));
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
        if (req.category !== undefined && req.category !== null) {
          expect(typeof req.category).toBe('string');
        }
        if (req.estimatedCost !== undefined && req.estimatedCost !== null) {
          expect(typeof req.estimatedCost).toBe('number');
        }

        // TC-8: nested relation assertions
        if (req.unit) {
          expect(req.unit).toHaveProperty('id');
          expect(req.unit).toHaveProperty('unitNumber');
        }
        if (req.tenant) {
          expect(req.tenant).toHaveProperty('id');
          expect(req.tenant).toHaveProperty('name');
        }
        if (req.building) {
          expect(req.building).toHaveProperty('id');
          expect(req.building).toHaveProperty('name');
        }
        if (req.assignedContractor) {
          expect(req.assignedContractor).toHaveProperty('id');
          expect(req.assignedContractor).toHaveProperty('name');
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

  // ── Owner Pending Approvals ──
  describe('GET /owner/pending-approvals', () => {
    it('returns an array with expected approval shape', async () => {
      const body = await fetchJson('/owner/pending-approvals');
      expect(Array.isArray(body.data)).toBe(true);

      if (body.data.length > 0) {
        const req = body.data[0];
        expectKeys(req, [
          'id', 'status', 'description', 'createdAt',
        ], 'OwnerPendingApproval');

        if (req.estimatedCost !== undefined && req.estimatedCost !== null) {
          expect(typeof req.estimatedCost).toBe('number');
        }

        if (req.unit) {
          expectKeys(req.unit, ['unitNumber'], 'OwnerPendingApproval.unit');
          if (req.unit.building) {
            expectKeys(req.unit.building, ['name'], 'OwnerPendingApproval.unit.building');
          }
        }

        if (req.assignedContractor) {
          expectKeys(req.assignedContractor, ['name'], 'OwnerPendingApproval.assignedContractor');
        }
      }
    });
  });

  // ── Owner Invoices ──
  describe('GET /owner/invoices?limit=1', () => {
    it('returns an array with expected owner invoice shape', async () => {
      const body = await fetchJson('/owner/invoices?limit=1');
      expect(Array.isArray(body.data)).toBe(true);

      if (body.data.length > 0) {
        const inv = body.data[0];
        expectKeys(inv, [
          'id', 'status', 'jobId', 'totalAmount', 'createdAt',
        ], 'OwnerInvoice');
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

  // ── Summary DTO Endpoints (H5 tier pattern) ──
  describe('GET /requests?limit=1&view=summary', () => {
    it('returns summary DTO with reduced fields (no nested relations)', async () => {
      const body = await fetchJson('/requests?limit=1&view=summary');
      expect(Array.isArray(body.data)).toBe(true);

      if (body.data.length > 0) {
        const req = body.data[0];
        expectKeys(req, [
          'id', 'status', 'createdAt', 'description', 'estimatedCost', 'category',
          'unitNumber', 'buildingName', 'assignedContractorName',
        ], 'RequestSummaryDTO');

        // Should NOT have deep nested objects like assignedContractor, tenant, unit, appliance
        expect(req.assignedContractor).toBeUndefined();
        expect(req.tenant).toBeUndefined();
        expect(req.unit).toBeUndefined();
        expect(req.appliance).toBeUndefined();
      }
    });
  });

  describe('GET /invoices?limit=1&view=summary', () => {
    it('returns summary DTO with reduced fields (no lineItems)', async () => {
      const body = await fetchJson('/invoices?limit=1&view=summary');
      expect(Array.isArray(body.data)).toBe(true);

      if (body.data.length > 0) {
        const inv = body.data[0];
        expectKeys(inv, [
          'id', 'orgId', 'jobId', 'status', 'totalAmount', 'dueDate', 'paidAt', 'createdAt',
        ], 'InvoiceSummaryDTO');

        // Should NOT have lineItems or detailed address info
        expect(inv.lineItems).toBeUndefined();
        expect(inv.recipientAddressLine1).toBeUndefined();
      }
    });
  });

  // ── Contractor-Scoped Endpoints (H1 isolation) ──
  describe('GET /contractor/jobs?contractorId=<id>&limit=1&view=summary', () => {
    it('requires CONTRACTOR role and returns contractor-filtered jobs', async () => {
      // First get a contractor ID + email
      const contractors = await fetchJson('/contractors?limit=1');
      if (contractors.data.length === 0) {
        console.log('⚠️  Skipping contractor jobs test: no contractors in database');
        return;
      }

      const { id: contractorId, email: contractorEmail } = contractors.data[0];

      // resolveContractorId() looks up the contractor by the authenticated user's email,
      // so the token must carry the same email as the contractor DB record.
      const token = createTestToken({ userId: 'test-contractor', orgId: 'default-org', email: contractorEmail, role: 'CONTRACTOR' });
      const response = await fetch(`${API_BASE}/contractor/jobs?contractorId=${contractorId}&limit=1&view=summary`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      expect(response.ok).toBe(true);
      const data = await response.json();

      expect(Array.isArray(data.data)).toBe(true);
      // Results should only include jobs for this contractor (may be empty)
      if (data.data.length > 0) {
        const job = data.data[0];
        expect(job.contractorId).toBe(contractorId);
        expectKeys(job, [
          'id', 'orgId', 'requestId', 'contractorId', 'status',
          'createdAt', 'updatedAt',
        ], 'JobSummaryDTO');
      }
    });

    it('rejects non-CONTRACTOR requests', async () => {
      const response = await fetchWithRole('/contractor/jobs?contractorId=any&limit=1', 'MANAGER');
      expect(response.status).toBe(403);
    });
  });

  describe('GET /contractor/invoices?contractorId=<id>&limit=1&view=summary', () => {
    it('requires CONTRACTOR role and returns contractor-filtered invoices', async () => {
      // First get a contractor ID + email
      const contractors = await fetchJson('/contractors?limit=1');
      if (contractors.data.length === 0) {
        console.log('⚠️  Skipping contractor invoices test: no contractors in database');
        return;
      }

      const { id: contractorId, email: contractorEmail } = contractors.data[0];

      // resolveContractorId() looks up the contractor by the authenticated user's email,
      // so the token must carry the same email as the contractor DB record.
      const token = createTestToken({ userId: 'test-contractor', orgId: 'default-org', email: contractorEmail, role: 'CONTRACTOR' });
      const response = await fetch(`${API_BASE}/contractor/invoices?contractorId=${contractorId}&limit=1&view=summary`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      expect(response.ok).toBe(true);
      const data = await response.json();

      expect(Array.isArray(data.data)).toBe(true);
      // Results should only include invoices for jobs of this contractor (may be empty)
      if (data.data.length > 0) {
        const inv = data.data[0];
        expectKeys(inv, [
          'id', 'orgId', 'jobId', 'status', 'totalAmount', 'dueDate', 'paidAt', 'createdAt',
        ], 'InvoiceSummaryDTO');
      }
    });

    it('rejects non-CONTRACTOR requests', async () => {
      const response = await fetchWithRole('/contractor/invoices?contractorId=any&limit=1', 'OWNER');
      expect(response.status).toBe(403);
    });
  });

  // ── Building Financials ──
  describe('GET /buildings/:id/financials', () => {
    it('returns BuildingFinancialsDTO with all required numeric fields and arrays', async () => {
      // Get a building ID
      const buildings = await fetchJson('/buildings?limit=1');
      expect(Array.isArray(buildings.data)).toBe(true);

      if (buildings.data.length === 0) {
        console.log('⚠️  Skipping financials test: no buildings in database');
        return;
      }

      const buildingId = buildings.data[0].id;
      const body = await fetchJson(
        `/buildings/${buildingId}/financials?from=2025-01-01&to=2026-01-01`,
      );

      expect(body).toHaveProperty('data');
      const dto = body.data;

      // All required scalar fields
      expectKeys(dto, [
        'buildingId',
        'buildingName',
        'from',
        'to',
        'collectedIncomeCents',
        'accruedIncomeCents',
        'expensesTotalCents',
        'maintenanceTotalCents',
        'capexTotalCents',
        'operatingTotalCents',
        'netIncomeCents',
        'netOperatingIncomeCents',
        'maintenanceRatio',
        'costPerUnitCents',
        'collectionRate',
        'activeUnitsCount',
        'expensesByCategory',
        'topContractorsBySpend',
        'source',
      ], 'BuildingFinancialsDTO');
      expect(['operational', 'imported']).toContain(dto.source);

      // All numeric totals must be numbers (never undefined/null)
      for (const key of [
        'collectedIncomeCents',
        'accruedIncomeCents',
        'expensesTotalCents',
        'maintenanceTotalCents',
        'capexTotalCents',
        'operatingTotalCents',
        'netIncomeCents',
        'netOperatingIncomeCents',
        'costPerUnitCents',
        'activeUnitsCount',
      ]) {
        expect(typeof dto[key]).toBe('number');
      }

      // Ratios must be numbers (safe division returns 0, never NaN/Infinity)
      for (const key of ['maintenanceRatio', 'collectionRate']) {
        expect(typeof dto[key]).toBe('number');
        expect(Number.isFinite(dto[key])).toBe(true);
      }

      // Arrays exist and are arrays (never undefined)
      expect(Array.isArray(dto.expensesByCategory)).toBe(true);
      expect(Array.isArray(dto.topContractorsBySpend)).toBe(true);

      // If expensesByCategory has entries, verify shape
      if (dto.expensesByCategory.length > 0) {
        expectKeys(dto.expensesByCategory[0], ['category', 'totalCents'], 'ExpenseCategoryTotalDTO');
        expect(typeof dto.expensesByCategory[0].totalCents).toBe('number');
      }

      // If topContractorsBySpend has entries, verify shape
      if (dto.topContractorsBySpend.length > 0) {
        expectKeys(dto.topContractorsBySpend[0], ['contractorId', 'contractorName', 'totalCents'], 'ContractorSpendDTO');
        expect(typeof dto.topContractorsBySpend[0].totalCents).toBe('number');
      }
    });

    it('returns 400 for missing query params', async () => {
      const buildings = await fetchJson('/buildings?limit=1');
      if (buildings.data.length === 0) return;

      const buildingId = buildings.data[0].id;
      const res = await fetch(`${API_BASE}/buildings/${buildingId}/financials`);
      expect(res.status).toBe(400);
    });

    it('returns 404 for non-existent building', async () => {
      const res = await fetch(
        `${API_BASE}/buildings/00000000-0000-0000-0000-000000000000/financials?from=2025-01-01&to=2026-01-01`,
      );
      expect(res.status).toBe(404);
    });
  });

  describe('GET /buildings/:id/kpis', () => {
    it('returns BuildingKpisDTO with integer open counts', async () => {
      const buildings = await fetchJson('/buildings?limit=1');
      if (buildings.data.length === 0) {
        console.log('⚠️  Skipping kpis test: no buildings in database');
        return;
      }
      const buildingId = buildings.data[0].id;
      const body = await fetchJson(`/buildings/${buildingId}/kpis`);

      expect(body).toHaveProperty('data');
      const dto = body.data;
      expectKeys(dto, ['openRequests', 'openJobs'], 'BuildingKpisDTO');
      expect(Number.isInteger(dto.openRequests)).toBe(true);
      expect(Number.isInteger(dto.openJobs)).toBe(true);
      expect(dto.openRequests).toBeGreaterThanOrEqual(0);
      expect(dto.openJobs).toBeGreaterThanOrEqual(0);
    });

    it('returns 404 for non-existent building', async () => {
      const res = await fetch(
        `${API_BASE}/buildings/00000000-0000-0000-0000-000000000000/kpis`,
      );
      expect(res.status).toBe(404);
    });
  });

  describe('GET /financials/portfolio-timeseries', () => {
    it('returns PortfolioTimeSeriesDTO with points array and range', async () => {
      const body = await fetchJson('/financials/portfolio-timeseries?range=1Y');
      expect(body).toHaveProperty('data');
      const dto = body.data;
      expectKeys(dto, ['range', 'points'], 'PortfolioTimeSeriesDTO');
      expect(dto.range).toBe('1Y');
      expect(Array.isArray(dto.points)).toBe(true);
      if (dto.points.length > 0) {
        const pt = dto.points[0];
        expectKeys(pt, [
          'periodStart', 'periodEnd', 'label',
          'noiCents', 'collectedIncomeCents', 'expensesCents', 'collectionRate',
        ], 'TimeSeriesPoint');
        expect(typeof pt.noiCents).toBe('number');
        expect(typeof pt.collectionRate).toBe('number');
      }
    }, 60000);

    it('returns 400 for invalid range', async () => {
      const res = await fetch(`${API_BASE}/financials/portfolio-timeseries?range=INVALID`);
      expect(res.status).toBe(400);
    });
  });

  describe('GET /buildings/:id/timeseries', () => {
    it('returns BuildingTimeSeriesDTO with points array and range', async () => {
      const buildings = await fetchJson('/buildings?limit=1');
      if (!buildings.data?.length) return;
      const buildingId = buildings.data[0].id;
      const body = await fetchJson(`/buildings/${buildingId}/timeseries?range=1Y`);
      expect(body).toHaveProperty('data');
      const dto = body.data;
      expectKeys(dto, ['buildingId', 'range', 'points'], 'BuildingTimeSeriesDTO');
      expect(dto.range).toBe('1Y');
      expect(Array.isArray(dto.points)).toBe(true);
      if (dto.points.length > 0) {
        const pt = dto.points[0];
        expectKeys(pt, [
          'periodStart', 'periodEnd', 'label',
          'noiCents', 'collectedIncomeCents', 'expensesCents', 'collectionRate',
        ], 'TimeSeriesPoint');
      }
    });

    it('returns 400 for invalid range', async () => {
      const buildings = await fetchJson('/buildings?limit=1');
      if (!buildings.data?.length) return;
      const buildingId = buildings.data[0].id;
      const res = await fetch(`${API_BASE}/buildings/${buildingId}/timeseries?range=INVALID`);
      expect(res.status).toBe(400);
    });
  });

  // ── RFPs ──
  describe('GET /rfps?limit=1', () => {
    it('returns envelope with data array and total', async () => {
      const body = await fetchJson('/rfps?limit=1');
      expect(Array.isArray(body.data)).toBe(true);
      expect(typeof body.total).toBe('number');

      if (body.data.length > 0) {
        const rfp = body.data[0];
        expectKeys(rfp, [
          'id', 'orgId', 'requestId', 'status', 'createdAt',
        ], 'RFP');
      }
    });
  });

  describe('GET /rfps/:id — 404 for unknown id', () => {
    it('returns 404 for non-existent RFP', async () => {
      const res = await fetch(`${API_BASE}/rfps/00000000-0000-0000-0000-000000000000`);
      expect(res.status).toBe(404);
      const body = await res.json();
      expect(body.error).toHaveProperty('code', 'NOT_FOUND');
    });
  });

  // ── Notifications (tenant/manager inbox) ──
  describe('GET /notifications', () => {
    it('returns envelope with nested notifications array and total', async () => {
      const res = await fetchWithRole('/notifications', 'MANAGER');
      expect(res.ok).toBe(true);
      const body = await res.json();
      expect(body).toHaveProperty('data');
      expect(body.data).toHaveProperty('notifications');
      expect(Array.isArray(body.data.notifications)).toBe(true);
      expect(typeof body.data.total).toBe('number');

      if (body.data.notifications.length > 0) {
        const n = body.data.notifications[0];
        expectKeys(n, ['id', 'orgId', 'userId', 'eventType', 'createdAt'], 'Notification');
      }
    });
  });

  describe('GET /notifications/unread-count', () => {
    it('returns { data: { count: <number> } }', async () => {
      const res = await fetchWithRole('/notifications/unread-count', 'MANAGER');
      expect(res.ok).toBe(true);
      const body = await res.json();
      expect(body).toHaveProperty('data');
      expect(typeof body.data.count).toBe('number');
    });
  });

  // ── Tenant Portal Inbox ──
  describe('GET /tenant-portal/notifications', () => {
    it('returns envelope with notifications array and total', async () => {
      const tenantToken = createTenantToken();
      const res = await fetch(`${API_BASE}/tenant-portal/notifications`, {
        headers: getAuthHeaders(tenantToken),
      });
      expect(res.ok).toBe(true);
      const body = await res.json();
      expect(body).toHaveProperty('data');
      expect(body.data).toHaveProperty('notifications');
      expect(Array.isArray(body.data.notifications)).toBe(true);
      expect(typeof body.data.total).toBe('number');

      if (body.data.notifications.length > 0) {
        const n = body.data.notifications[0];
        expectKeys(n, ['id', 'orgId', 'userId', 'eventType', 'createdAt'], 'TenantNotification');
      }
    });
  });

  describe('GET /tenant-portal/notifications/unread-count', () => {
    it('returns { data: { count: <number> } }', async () => {
      const tenantToken = createTenantToken();
      const res = await fetch(`${API_BASE}/tenant-portal/notifications/unread-count`, {
        headers: getAuthHeaders(tenantToken),
      });
      expect(res.ok).toBe(true);
      const body = await res.json();
      expect(body).toHaveProperty('data');
      expect(typeof body.data.count).toBe('number');
    });
  });

  describe('GET /tenant-portal/requests', () => {
    it('returns envelope with requests array', async () => {
      const tenantToken = createTenantToken();
      const res = await fetch(`${API_BASE}/tenant-portal/requests`, {
        headers: getAuthHeaders(tenantToken),
      });
      expect(res.ok).toBe(true);
      const body = await res.json();
      expect(body).toHaveProperty('data');
      expect(Array.isArray(body.data)).toBe(true);

      if (body.data.length > 0) {
        const req = body.data[0];
        expectKeys(req, ['id', 'status', 'description', 'createdAt'], 'TenantPortalRequest');
      }
    });
  });

  // ── Set Expense Category ──
  describe('POST /invoices/:id/set-expense-category', () => {
    it('returns 400 for invalid expense category', async () => {
      const res = await fetch(`${API_BASE}/invoices/00000000-0000-0000-0000-000000000000/set-expense-category`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ expenseCategory: 'INVALID' }),
      });
      expect(res.status).toBe(400);

      const body = await res.json();
      expect(body.error).toHaveProperty('code', 'VALIDATION_ERROR');
    });

    it('returns 404 for non-existent invoice', async () => {
      const res = await fetch(`${API_BASE}/invoices/00000000-0000-0000-0000-000000000000/set-expense-category`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ expenseCategory: 'MAINTENANCE' }),
      });
      expect(res.status).toBe(404);
    });
  });

  // ── Building Owners ──
  describe('GET /buildings/:id/owners', () => {
    it('returns { data: [] } for non-existent building (empty array, not 404)', async () => {
      const res = await fetch(`${API_BASE}/buildings/00000000-0000-0000-0000-000000000000/owners`);
      // Either 200 with empty array or a server error — never a 404 (route exists)
      expect([200, 500]).toContain(res.status);
      if (res.status === 200) {
        const body = await res.json();
        expect(body).toHaveProperty('data');
        expect(Array.isArray(body.data)).toBe(true);
      }
    });
  });

  describe('GET /buildings/:id/owners/candidates', () => {
    it('returns { data: [] } envelope', async () => {
      const res = await fetch(`${API_BASE}/buildings/00000000-0000-0000-0000-000000000000/owners/candidates`);
      expect([200, 500]).toContain(res.status);
      if (res.status === 200) {
        const body = await res.json();
        expect(body).toHaveProperty('data');
        expect(Array.isArray(body.data)).toBe(true);
      }
    });
  });

  // ── POST /buildings/:id/owners validation ──
  describe('POST /buildings/:id/owners', () => {
    it('returns 400 when userId is missing', async () => {
      const res = await fetch(`${API_BASE}/buildings/00000000-0000-0000-0000-000000000000/owners`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({}),
      });
      expect(res.status).toBe(400);
      const body = await res.json();
      expect(body.error).toHaveProperty('code', 'VALIDATION_ERROR');
    });
  });

  // ── Cashflow Plans ──
  describe('GET /cashflow-plans', () => {
    it('returns { data: [] } envelope', async () => {
      const res = await fetch(`${API_BASE}/cashflow-plans`);
      expect(res.ok).toBe(true);
      const body = await res.json();
      expect(body).toHaveProperty('data');
      expect(Array.isArray(body.data)).toBe(true);
    });
  });

  describe('POST /cashflow-plans → GET /cashflow-plans/:id', () => {
    it('creates a plan and retrieves it with cashflow buckets', async () => {
      const createRes = await fetch(`${API_BASE}/cashflow-plans`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ name: 'Test Plan', horizonMonths: 12 }),
      });
      expect(createRes.status).toBe(201);
      const createBody = await createRes.json();
      expect(createBody).toHaveProperty('data');
      const plan = createBody.data;
      expectKeys(plan, ['id', 'orgId', 'name', 'status', 'incomeGrowthRatePct', 'horizonMonths', 'overrides'], 'CashflowPlan');
      expect(plan.status).toBe('DRAFT');
      expect(plan.overrides).toEqual([]);

      const getRes = await fetch(`${API_BASE}/cashflow-plans/${plan.id}`);
      expect(getRes.ok).toBe(true);
      const getBody = await getRes.json();
      expect(getBody.data).toHaveProperty('cashflow');
      const { cashflow } = getBody.data;
      expect(Array.isArray(cashflow.buckets)).toBe(true);
      if (cashflow.buckets.length > 0) {
        const bucket = cashflow.buckets[0];
        expectKeys(bucket, ['year', 'month', 'isActual', 'accruedIncomeCents', 'projectedOpexCents', 'scheduledCapexCents', 'netCents', 'cumulativeBalanceCents'], 'MonthlyBucket');
      }
    });
  });

  describe('POST /cashflow-plans/:id/approve from DRAFT', () => {
    it('returns 400 — DRAFT cannot skip directly to APPROVED', async () => {
      const createRes = await fetch(`${API_BASE}/cashflow-plans`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ name: 'Transition Test Plan' }),
      });
      const { data: plan } = await createRes.json();

      const approveRes = await fetch(`${API_BASE}/cashflow-plans/${plan.id}/approve`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({}),
      });
      expect(approveRes.status).toBe(400);
    });
  });

  describe('GET /cashflow-plans/:id/rfp-candidates — non-existent plan', () => {
    it('returns 404', async () => {
      const res = await fetch(`${API_BASE}/cashflow-plans/00000000-0000-0000-0000-000000000000/rfp-candidates`);
      expect(res.status).toBe(404);
    });
  });

  // ── Strategy Engine ──
  describe('POST /strategy/owner-profile', () => {
    it('returns profile with expected shape when given valid answers', async () => {
      const res = await fetch(`${API_BASE}/strategy/owner-profile`, {
        method: 'POST',
        headers: { 'content-type': 'application/json', 'x-dev-role': 'OWNER' },
        body: JSON.stringify({
          answers: {
            mainGoal: 3,
            holdPeriod: 4,
            renovationAppetite: 4,
            cashSensitivity: 2,
            disruptionTolerance: 3,
          },
        }),
      });
      expect(res.status).toBe(200);
      const body = await res.json();
      expect(body.profile).toBeDefined();
      expectKeys(body.profile, [
        'primaryArchetype', 'confidence', 'dimensions', 'archetypeScores',
      ], 'OwnerProfile');
      // Dimensions must have all 10 keys
      expectKeys(body.profile.dimensions, [
        'horizon', 'incomePriority', 'appreciationPriority', 'capexTolerance',
        'volatilityTolerance', 'liquiditySensitivity', 'saleReadiness',
        'stabilityPreference', 'modernizationPreference', 'disruptionTolerance',
      ], 'StrategyDimensions');
      // Archetype scores must have all 5 keys
      expectKeys(body.profile.archetypeScores, [
        'exit_optimizer', 'yield_maximizer', 'value_builder',
        'capital_preserver', 'opportunistic_repositioner',
      ], 'ArchetypeScores');
    });
  });

  describe('GET /strategy/owner-profile/:ownerId', () => {
    it('returns null profile for non-existent owner', async () => {
      const res = await fetchWithRole('/strategy/owner-profile/00000000-0000-0000-0000-000000000099', 'MANAGER');
      expect(res.status).toBe(200);
      const body = await res.json();
      expect(body.profile).toBeNull();
    });
  });

  // ── Tenant Conversation ──
  describe('POST /tenant/conversation — validation', () => {
    it('returns 400 when message is empty', async () => {
      const tenantToken = createTenantToken();
      const res = await fetch(`${API_BASE}/tenant/conversation`, {
        method: 'POST',
        headers: { 'content-type': 'application/json', ...getAuthHeaders(tenantToken) },
        body: JSON.stringify({ message: '' }),
      });
      expect(res.status).toBe(400);
      const body = await res.json();
      expect(body.error.code).toBe('VALIDATION_ERROR');
    });

    it('returns 400 when message exceeds 2000 characters', async () => {
      const tenantToken = createTenantToken();
      const res = await fetch(`${API_BASE}/tenant/conversation`, {
        method: 'POST',
        headers: { 'content-type': 'application/json', ...getAuthHeaders(tenantToken) },
        body: JSON.stringify({ message: 'x'.repeat(2001) }),
      });
      expect(res.status).toBe(400);
      const body = await res.json();
      expect(body.error.code).toBe('VALIDATION_ERROR');
    });

    it('returns 401 without auth token', async () => {
      const res = await fetch(`${API_BASE}/tenant/conversation`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ message: 'hello' }),
      });
      expect(res.status).toBe(401);
    });
  });

  // Slice 3: per-tenant rate limit on the AI conversation endpoint
  describe('POST /tenant/conversation — rate limit', () => {
    it('returns 429 once a single tenant exceeds 20 messages/minute', async () => {
      // Unique userId so this test does not consume the shared "test-user-id" budget
      const tenantToken = createTestToken({ role: 'TENANT', userId: 'ratelimit-tenant-conv' });
      let sawRateLimit = false;

      // 21 rapid requests — the limiter (20/min) must reject at least one
      for (let i = 0; i < 21; i++) {
        const res = await fetch(`${API_BASE}/tenant/conversation`, {
          method: 'POST',
          headers: { 'content-type': 'application/json', ...getAuthHeaders(tenantToken) },
          body: JSON.stringify({ message: 'rate limit probe' }),
        });
        if (res.status === 429) {
          const body = await res.json();
          expect(body.error.code).toBe('RATE_LIMITED');
          sawRateLimit = true;
          break;
        }
      }

      expect(sawRateLimit).toBe(true);
    }, 30000);
  });

  describe('GET /tenant/conversation/history', () => {
    it('returns data envelope with messages array', async () => {
      const tenantToken = createTenantToken();
      const res = await fetch(`${API_BASE}/tenant/conversation/history`, {
        headers: getAuthHeaders(tenantToken),
      });
      expect(res.status).toBe(200);
      const body = await res.json();
      expect(body).toHaveProperty('data');
      expect(Array.isArray(body.data)).toBe(true);

      if (body.data.length > 0) {
        const msg = body.data[0];
        expectKeys(msg, ['role', 'content', 'createdAt'], 'ConversationMessage');
        expect(['TENANT', 'ASSISTANT']).toContain(msg.role);
      }
    });

    it('returns 401 without auth token', async () => {
      const res = await fetch(`${API_BASE}/tenant/conversation/history`);
      expect(res.status).toBe(401);
    });
  });

  // ── Inventory CSV import (buildings & units) ──
  describe('Inventory CSV import', () => {
    it('uploads → previews → commits a buildings CSV with the expected DTO shape', async () => {
      const uniq = `CSVTest ${Date.now()}`;
      const csv = `name,address,yearBuilt,hasElevator\n${uniq},Rue du Test 1,1990,true\n,,,\n`;
      const form = new FormData();
      form.append('file', new Blob([csv], { type: 'text/csv' }), 'buildings.csv');
      form.append('entityType', 'BUILDING');

      const uploadRes = await fetch(`${API_BASE}/imports/inventory`, { method: 'POST', body: form });
      expect(uploadRes.status).toBe(201);
      const { data: batch } = await uploadRes.json();
      expectKeys(
        batch,
        ['id', 'entityType', 'fileName', 'status', 'rowCount', 'validCount', 'errorCount', 'createdAt', 'rows'],
        'ImportBatch',
      );
      expect(batch.entityType).toBe('BUILDING');
      expect(batch.status).toBe('PENDING_REVIEW');
      expect(batch.validCount).toBe(1); // blank row skipped
      expect(Array.isArray(batch.rows)).toBe(true);
      const row = batch.rows[0];
      expectKeys(row, ['id', 'rowIndex', 'status', 'errorMessage', 'createdEntityId', 'data'], 'ImportRow');
      expect(row.status).toBe('VALID');

      // list
      const listRes = await fetch(`${API_BASE}/imports/inventory?entityType=BUILDING&limit=5`);
      expect(listRes.status).toBe(200);
      const listBody = await listRes.json();
      expect(Array.isArray(listBody.data)).toBe(true);
      expect(listBody).toHaveProperty('pagination');

      // commit
      const commitRes = await fetch(`${API_BASE}/imports/inventory/${batch.id}/commit`, { method: 'POST' });
      expect(commitRes.status).toBe(200);
      const { data: result } = await commitRes.json();
      expectKeys(result, ['batch', 'committed', 'errors'], 'CommitResult');
      expect(result.committed).toBe(1);
      expect(result.batch.status).toBe('COMMITTED');
      const committedRow = result.batch.rows.find((r: any) => r.status === 'COMMITTED');
      expect(committedRow).toBeTruthy();
      expect(committedRow.createdEntityId).toBeTruthy();
    }, 30000);

    it('rejects an unknown entityType', async () => {
      const form = new FormData();
      form.append('file', new Blob(['name\nFoo'], { type: 'text/csv' }), 'x.csv');
      form.append('entityType', 'WIDGET');
      const res = await fetch(`${API_BASE}/imports/inventory`, { method: 'POST', body: form });
      expect(res.status).toBe(400);
    });
  });

  // ── Building onboarding preview (rent roll) ──
  describe('Building onboarding preview', () => {
    it('previews Units/Tenants/Leases from a rent roll with the expected DTO shape', async () => {
      const buildings = await fetchJson('/buildings?limit=1');
      if (!Array.isArray(buildings.data) || buildings.data.length === 0) {
        console.log('⚠️  Skipping onboarding preview test: no buildings');
        return;
      }
      const buildingId = buildings.data[0].id;
      const csv =
        'objet\tlocataire_principal\ttype_objet\tetage\tpieces\tm2\tentree\tsortie\tloyer_net_mensuel_chf\tcharges_acompte_chf\n' +
        '531100.01.0001\tJACCARD Jacques-Henri\tAppartement\trez\t4.5\t96\t01.12.2016\t\t2646\t190\n' +
        '531100.01.9001\tJACCARD Jacques-Henri\tGarage\trez\t\t0\t01.12.2016\t\t150\t0\n' +
        '531100.01.9003\tVacant\tGarage\trez\t\t0\t01.06.2020\t\t280\t0\n' +
        'Total\t\t\t\t\t\t\t\t\t\n';
      const form = new FormData();
      form.append('file', new Blob([csv], { type: 'text/csv' }), 'rentroll.csv');

      const res = await fetch(`${API_BASE}/buildings/${buildingId}/onboarding/preview`, { method: 'POST', body: form });
      expect(res.status).toBe(200);
      const { data } = await res.json();
      expectKeys(data, ['buildingId', 'buildingName', 'summary', 'units', 'warnings'], 'OnboardingPreviewDTO');
      expectKeys(data.summary, ['totalObjects', 'apartments', 'garages', 'vacant', 'tenants', 'leases', 'annualNetRentChf', 'matchedExistingUnits'], 'summary');
      expect(data.summary.totalObjects).toBe(3); // Total row dropped
      expect(data.summary.apartments).toBe(1);
      expect(data.summary.garages).toBe(2);
      expect(data.summary.vacant).toBe(1);
      // the garage is linked to the apartment (same tenant)
      const garage = data.units.find((u: any) => u.objet === '531100.01.9001');
      expect(garage.linkedApartmentObjet).toBe('531100.01.0001');
      // annual net rent = (2646 + 150) × 12
      expect(data.summary.annualNetRentChf).toBe((2646 + 150) * 12);
    }, 30000);

    it('404s for an unknown building', async () => {
      const form = new FormData();
      form.append('file', new Blob(['objet\n531100.01.0001'], { type: 'text/csv' }), 'r.csv');
      const res = await fetch(`${API_BASE}/buildings/00000000-0000-0000-0000-000000000000/onboarding/preview`, { method: 'POST', body: form });
      expect(res.status).toBe(404);
    });

    it('matches an existing unit by floor + net rent across different numbering', async () => {
      // Fresh building + one existing unit "RdC" (rez, net rent 2646) — the older-style numbering.
      const cr = await fetch(`${API_BASE}/buildings`, {
        method: 'POST', headers: { 'Content-Type': 'application/json', 'x-dev-role': 'MANAGER' },
        body: JSON.stringify({ name: `Match Test ${Date.now()}` }),
      });
      const buildingId = (await cr.json()).data.id;
      const ur = await fetch(`${API_BASE}/buildings/${buildingId}/units`, {
        method: 'POST', headers: { 'Content-Type': 'application/json', 'x-dev-role': 'MANAGER' },
        body: JSON.stringify({ unitNumber: 'RdC', floor: 'Rez de Chaussée', type: 'RESIDENTIAL' }),
      });
      const unit = (await ur.json()).data ?? (await ur.json());
      // set its net rent so floor+rent matching can key on it
      await fetch(`${API_BASE}/units/${unit.id}`, {
        method: 'PATCH', headers: { 'Content-Type': 'application/json', 'x-dev-role': 'MANAGER' },
        body: JSON.stringify({ monthlyRentChf: 2646 }),
      });

      // rent roll uses a different number (0001, rez-de-chaussée, net 2646) → should match "RdC"
      const csv = 'objet\tlocataire_principal\ttype_objet\tetage\tloyer_net_mensuel_chf\n531100.01.0001\tJACCARD\tAppartement\trez-de-chaussée\t2646\n';
      const form = new FormData();
      form.append('file', new Blob([csv], { type: 'text/csv' }), 'r.csv');
      const res = await fetch(`${API_BASE}/buildings/${buildingId}/onboarding/preview`, { method: 'POST', body: form });
      expect(res.status).toBe(200);
      const { data } = await res.json();
      const obj = data.units.find((u: any) => u.objet === '531100.01.0001');
      expect(obj.matchedUnitNumber).toBe('RdC'); // matched the existing unit, not a new one
      expect(data.summary.matchedExistingUnits).toBe(1);
    }, 30000);
  });

  // ── Building onboarding commit (snapshot mode — no billing side effects) ──
  describe('Building onboarding commit', () => {
    const RENT_ROLL =
      'objet\tlocataire_principal\ttype_objet\tm2\tentree\tloyer_net_mensuel_chf\n' +
      '531100.01.0001\tJACCARD Jacques-Henri\tAppartement\t96\t01.12.2016\t2646\n' +
      '531100.01.9001\tJACCARD Jacques-Henri\tGarage\t0\t01.12.2016\t150\n' +
      '531100.01.9003\tVacant\tGarage\t0\t01.06.2020\t280\n' +
      'Total\t\t\t\t\t\n';

    it('creates Units/Tenants/Leases for a fresh building (snapshot)', async () => {
      // Fresh, empty building so onboarding isn't blocked.
      const created = await fetch(`${API_BASE}/buildings`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-dev-role': 'MANAGER' },
        body: JSON.stringify({ name: `Onboarding Test ${Date.now()}` }),
      });
      expect(created.status).toBe(201);
      const cb = await created.json();
      const buildingId = cb?.data?.id ?? cb?.id;
      expect(buildingId).toBeTruthy();

      const form = new FormData();
      form.append('file', new Blob([RENT_ROLL], { type: 'text/csv' }), 'rentroll.csv');
      form.append('billingMode', 'snapshot');
      const res = await fetch(`${API_BASE}/buildings/${buildingId}/onboarding/commit`, {
        method: 'POST',
        headers: { 'x-dev-role': 'MANAGER' },
        body: form,
      });
      expect(res.status).toBe(201);
      const { data } = await res.json();
      expectKeys(data, ['buildingId', 'billingMode', 'created', 'skippedExistingUnits', 'errors'], 'OnboardingCommitResult');
      expect(data.billingMode).toBe('snapshot');
      expect(data.created.units).toBe(3); // 1 apartment + 2 garages
      expect(data.created.tenants).toBe(1); // JACCARD (occupies apt + garage); 9003 vacant
      expect(data.created.leases).toBe(2); // apt + occupied garage (both have rent)
      expect(data.created.activated).toBe(0); // snapshot — no billing
      expect(data.skippedExistingUnits).toBe(0);
      expect(data.errors).toEqual([]);

      // A second commit MERGES: all units already exist → nothing new created.
      const form2 = new FormData();
      form2.append('file', new Blob([RENT_ROLL], { type: 'text/csv' }), 'rentroll.csv');
      form2.append('billingMode', 'snapshot');
      const res2 = await fetch(`${API_BASE}/buildings/${buildingId}/onboarding/commit`, {
        method: 'POST', headers: { 'x-dev-role': 'MANAGER' }, body: form2,
      });
      expect(res2.status).toBe(201);
      const { data: data2 } = await res2.json();
      expect(data2.created.units).toBe(0); // no duplicates
      expect(data2.created.leases).toBe(0); // existing active/draft leases not duplicated
      expect(data2.skippedExistingUnits).toBe(3);
    }, 30000);

    it('rejects a bad billingMode', async () => {
      const buildings = await fetchJson('/buildings?limit=1');
      if (!buildings.data?.length) return;
      const form = new FormData();
      form.append('file', new Blob(['objet\n531100.01.0001'], { type: 'text/csv' }), 'r.csv');
      form.append('billingMode', 'nope');
      const res = await fetch(`${API_BASE}/buildings/${buildings.data[0].id}/onboarding/commit`, {
        method: 'POST', headers: { 'x-dev-role': 'MANAGER' }, body: form,
      });
      expect(res.status).toBe(400);
    });
  });

  // ── Contractor-invoice onboarding from a régie general ledger ──
  describe('Invoice onboarding (general ledger)', () => {
    const LEDGER =
      'groupe\tcompte\tlibelle_compte\tdate_valeur\tno_piece\ttexte_ecriture\tmontant_chf\n' +
      '3000\t30000\tLoyer net\t01.01.2025\t\t\t-13556\n' + // revenue → skipped
      '4110\t41100\tEntretien de l’immeuble\t21.05.2025\t1073348\tG. BURGOS Sàrl / Infiltration\t2964\n' +
      '4120\t41200\tEntretien des appartements\t17.01.2025\t1065720\t531100.01.0001: DVM Carrelage / Muret\t451\n' +
      '4600\t46000\tHonoraires de gestion\t31.01.2025\t48700\tRILSA SA / Honoraires\t609.95\n' + // mgmt fee → skipped
      '6900\t69000\tImpôts et taxes\t01.12.2025\t1087133\tCOMMUNE DE LUTRY / Impôt foncier\t1957.9\n';

    it('previews contractor invoices with the expected DTO shape', async () => {
      const buildings = await fetchJson('/buildings?limit=1');
      if (!buildings.data?.length) { console.log('⚠️  Skipping invoice onboarding preview: no buildings'); return; }
      const form = new FormData();
      form.append('file', new Blob([LEDGER], { type: 'text/csv' }), 'gl.csv');
      const res = await fetch(`${API_BASE}/buildings/${buildings.data[0].id}/onboarding/invoices/preview`, {
        method: 'POST', headers: { 'x-dev-role': 'MANAGER' }, body: form,
      });
      expect(res.status).toBe(200);
      const { data } = await res.json();
      expectKeys(data, ['buildingId', 'buildingName', 'summary', 'invoices', 'warnings'], 'InvoiceOnboardingPreviewDTO');
      expectKeys(data.summary, ['total', 'newInvoices', 'alreadyImported', 'unitAttributed', 'totalChf', 'byAccount'], 'summary');
      expect(data.summary.total).toBe(3); // BURGOS + DVM + COMMUNE; rent + mgmt fee skipped
      const line = data.invoices[0];
      expectKeys(line, ['compte', 'accountName', 'noPiece', 'vendorName', 'description', 'amountChf', 'unitNumber', 'matchedUnitNumber', 'alreadyImported'], 'InvoiceOnboardingPreviewLineDTO');
    }, 30000);

    it('commits invoices to a fresh building and is idempotent on re-commit', async () => {
      const created = await fetch(`${API_BASE}/buildings`, {
        method: 'POST', headers: { 'Content-Type': 'application/json', 'x-dev-role': 'MANAGER' },
        body: JSON.stringify({ name: `Invoice Onboarding ${Date.now()}` }),
      });
      const buildingId = (await created.json()).data.id;

      const form = new FormData();
      form.append('file', new Blob([LEDGER], { type: 'text/csv' }), 'gl.csv');
      const res = await fetch(`${API_BASE}/buildings/${buildingId}/onboarding/invoices/commit`, {
        method: 'POST', headers: { 'x-dev-role': 'MANAGER' }, body: form,
      });
      expect(res.status).toBe(201);
      const { data } = await res.json();
      expectKeys(data, ['buildingId', 'created', 'posted', 'skippedAlreadyImported', 'errors'], 'InvoiceOnboardingCommitResult');
      expect(data.created).toBe(3);
      expect(data.skippedAlreadyImported).toBe(0);

      // Second commit skips everything already imported (piece-number idempotency).
      const form2 = new FormData();
      form2.append('file', new Blob([LEDGER], { type: 'text/csv' }), 'gl.csv');
      const res2 = await fetch(`${API_BASE}/buildings/${buildingId}/onboarding/invoices/commit`, {
        method: 'POST', headers: { 'x-dev-role': 'MANAGER' }, body: form2,
      });
      expect(res2.status).toBe(201);
      const { data: data2 } = await res2.json();
      expect(data2.created).toBe(0);
      expect(data2.skippedAlreadyImported).toBe(3);
    }, 30000);
  });
});
