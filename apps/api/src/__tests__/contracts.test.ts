/**
 * G10: API Contract Tests — Prevent Silent DTO Drift
 *
 * These tests assert the response shape of key endpoints.
 * If a DTO changes, these tests will catch missing/renamed fields.
 * Update contract expectations in the same PR as any DTO change.
 */

import { spawn, ChildProcessWithoutNullStreams } from 'child_process';
import * as path from 'path';

const API_ROOT = path.resolve(__dirname, '..', '..');
const TS_NODE = path.resolve(API_ROOT, 'node_modules', '.bin', 'ts-node');
const PORT = 3205;
const API_BASE = `http://127.0.0.1:${PORT}`;

function startServer(envOverrides: Record<string, string>, port: number) {
  return new Promise<ChildProcessWithoutNullStreams>((resolve, reject) => {
    const child = spawn(TS_NODE, ['--transpile-only', 'src/server.ts'], {
      cwd: API_ROOT,
      env: {
        ...process.env,
        PORT: String(port),
        AUTH_SECRET: 'test-secret',
        ...envOverrides,
      },
      stdio: ['ignore', 'pipe', 'pipe'],
    });

    const onData = (data: Buffer) => {
      const text = data.toString();
      if (text.includes('API running on')) {
        cleanup();
        resolve(child);
      }
    };

    const onError = (err: Error) => {
      cleanup();
      reject(err);
    };

    const cleanup = () => {
      clearTimeout(timer);
      child.stdout.off('data', onData);
      child.stderr.off('data', onData);
      child.off('error', onError);
    };

    child.stdout.on('data', onData);
    child.stderr.on('data', onData);
    child.on('error', onError);

    const timer = setTimeout(() => {
      cleanup();
      reject(new Error('Server did not start within 15s'));
    }, 15000);
  });
}

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
function expectKeys(obj: Record<string, any>, keys: string[], label: string) {
  for (const key of keys) {
    expect(obj).toHaveProperty(key);
  }
}

describe('G10: API Contract Tests', () => {
  let proc: ChildProcessWithoutNullStreams;

  beforeAll(async () => {
    proc = await startServer({ AUTH_OPTIONAL: "true", NODE_ENV: "test" }, PORT);
  }, 20000);

  afterAll(() => {
    if (proc) proc.kill();
  });
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

        // Should NOT have lineItems or detailed recipient info
        expect(inv.lineItems).toBeUndefined();
        expect(inv.recipientName).toBeUndefined();
        expect(inv.recipientAddressLine1).toBeUndefined();
      }
    });
  });

  // ── Contractor-Scoped Endpoints (H1 isolation) ──
  describe('GET /contractor/jobs?contractorId=<id>&limit=1&view=summary', () => {
    it('requires CONTRACTOR role and returns contractor-filtered jobs', async () => {
      // First get a contractor ID
      const contractors = await fetchJson('/contractors?limit=1');
      if (contractors.data.length === 0) {
        console.log('⚠️  Skipping contractor jobs test: no contractors in database');
        return;
      }

      const contractorId = contractors.data[0].id;

      // Test with CONTRACTOR role
      const response = await fetchWithRole(`/contractor/jobs?contractorId=${contractorId}&limit=1&view=summary`, 'CONTRACTOR');
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
      // First get a contractor ID
      const contractors = await fetchJson('/contractors?limit=1');
      if (contractors.data.length === 0) {
        console.log('⚠️  Skipping contractor invoices test: no contractors in database');
        return;
      }

      const contractorId = contractors.data[0].id;

      // Test with CONTRACTOR role
      const response = await fetchWithRole(`/contractor/invoices?contractorId=${contractorId}&limit=1&view=summary`, 'CONTRACTOR');
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
        'earnedIncomeCents',
        'projectedIncomeCents',
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
      ], 'BuildingFinancialsDTO');

      // All numeric totals must be numbers (never undefined/null)
      for (const key of [
        'earnedIncomeCents',
        'projectedIncomeCents',
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
        expectKeys(n, ['id', 'orgId', 'userId', 'type', 'isRead', 'createdAt'], 'Notification');
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
});
