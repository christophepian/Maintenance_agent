import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { getNotificationLink } from '../lib/notificationLinks.js';

// ─── Helper ─────────────────────────────────────────────────────────────────

function n(entityType, entityId, eventType) {
  return { entityType, entityId, eventType };
}

// ─── MANAGER ────────────────────────────────────────────────────────────────

describe('getNotificationLink — MANAGER', () => {
  it('REQUEST → /manager/work-requests', () => {
    assert.equal(getNotificationLink(n('REQUEST', 'r1', 'REQUEST_APPROVED'), 'MANAGER'), '/manager/work-requests');
    assert.equal(getNotificationLink(n('REQUEST', 'r1', 'REQUEST_PENDING_REVIEW'), 'MANAGER'), '/manager/work-requests');
    assert.equal(getNotificationLink(n('REQUEST', 'r1', 'OWNER_REJECTED'), 'MANAGER'), '/manager/work-requests');
  });

  it('JOB → /manager/work-requests', () => {
    assert.equal(getNotificationLink(n('JOB', 'j1', 'JOB_CREATED'), 'MANAGER'), '/manager/work-requests');
    assert.equal(getNotificationLink(n('JOB', 'j1', 'JOB_COMPLETED'), 'MANAGER'), '/manager/work-requests');
  });

  it('INVOICE → /manager/finance/invoices', () => {
    assert.equal(getNotificationLink(n('INVOICE', 'i1', 'INVOICE_CREATED'), 'MANAGER'), '/manager/finance/invoices');
  });

  it('LEASE with entityId → detail page', () => {
    assert.equal(getNotificationLink(n('LEASE', 'l1', 'LEASE_SIGNED'), 'MANAGER'), '/manager/leases/l1');
  });

  it('LEASE without entityId → list page', () => {
    assert.equal(getNotificationLink(n('LEASE', null, 'LEASE_SIGNED'), 'MANAGER'), '/manager/leases');
  });

  it('RFP with entityId → detail page', () => {
    assert.equal(getNotificationLink(n('RFP', 'rfp1', 'QUOTE_SUBMITTED'), 'MANAGER'), '/manager/rfps/rfp1');
  });

  it('RFP without entityId → list page', () => {
    assert.equal(getNotificationLink(n('RFP', null, 'QUOTE_SUBMITTED'), 'MANAGER'), '/manager/rfps');
  });

  it('APPLICATION with entityId → detail page', () => {
    assert.equal(getNotificationLink(n('APPLICATION', 'app1', 'APPLICATION_SUBMITTED'), 'MANAGER'), '/manager/rental-applications/app1');
  });

  it('APPLICATION without entityId → vacancies list', () => {
    assert.equal(getNotificationLink(n('APPLICATION', null, 'APPLICATION_SUBMITTED'), 'MANAGER'), '/manager/vacancies');
  });

  it('SELECTION → /manager/vacancies', () => {
    assert.equal(getNotificationLink(n('SELECTION', 's1', 'TENANT_SELECTED'), 'MANAGER'), '/manager/vacancies');
  });

  it('SCHEDULING → /manager/work-requests', () => {
    assert.equal(getNotificationLink(n('SCHEDULING', 'j1', 'SLOT_PROPOSED'), 'MANAGER'), '/manager/work-requests');
    assert.equal(getNotificationLink(n('SCHEDULING', 'j1', 'SCHEDULING_ESCALATED'), 'MANAGER'), '/manager/work-requests');
  });

  it('RATING → /manager/work-requests', () => {
    assert.equal(getNotificationLink(n('RATING', 'j1', 'RATING_SUBMITTED'), 'MANAGER'), '/manager/work-requests');
  });

  it('eventType fallbacks when entityType missing', () => {
    assert.equal(getNotificationLink(n(null, 'r1', 'REQUEST_APPROVED'), 'MANAGER'), '/manager/work-requests');
    assert.equal(getNotificationLink(n(null, 'r1', 'CONTRACTOR_ASSIGNED'), 'MANAGER'), '/manager/work-requests');
    assert.equal(getNotificationLink(n(null, 's1', 'TENANT_SELECTED'), 'MANAGER'), '/manager/vacancies');
    assert.equal(getNotificationLink(n(null, 'a1', 'APPLICATION_SUBMITTED'), 'MANAGER'), '/manager/vacancies');
  });
});

// ─── OWNER ──────────────────────────────────────────────────────────────────

describe('getNotificationLink — OWNER', () => {
  it('REQUEST → /owner/approvals', () => {
    assert.equal(getNotificationLink(n('REQUEST', 'r1', 'REQUEST_PENDING_OWNER_APPROVAL'), 'OWNER'), '/owner/approvals');
  });

  it('JOB → /owner/jobs', () => {
    assert.equal(getNotificationLink(n('JOB', 'j1', 'JOB_COMPLETED'), 'OWNER'), '/owner/jobs');
  });

  it('INVOICE → /owner/invoices', () => {
    assert.equal(getNotificationLink(n('INVOICE', 'i1', 'INVOICE_APPROVED'), 'OWNER'), '/owner/invoices');
  });

  it('LEASE with entityId → manager lease detail (shared)', () => {
    assert.equal(getNotificationLink(n('LEASE', 'l1', 'LEASE_SIGNED'), 'OWNER'), '/manager/leases/l1');
  });

  it('RFP with entityId → /owner/rfps/id', () => {
    assert.equal(getNotificationLink(n('RFP', 'rfp1', 'QUOTE_SUBMITTED'), 'OWNER'), '/owner/rfps/rfp1');
  });

  it('SELECTION → /owner/vacancies', () => {
    assert.equal(getNotificationLink(n('SELECTION', 's1', 'TENANT_SELECTED'), 'OWNER'), '/owner/vacancies');
  });

  it('APPLICATION → /owner/vacancies', () => {
    assert.equal(getNotificationLink(n('APPLICATION', 'a1', 'APPLICATION_SUBMITTED'), 'OWNER'), '/owner/vacancies');
  });

  it('eventType fallbacks for owner approval events', () => {
    assert.equal(getNotificationLink(n(null, 'r1', 'REQUEST_PENDING_OWNER_APPROVAL'), 'OWNER'), '/owner/approvals');
    assert.equal(getNotificationLink(n(null, 'r1', 'OWNER_REJECTED'), 'OWNER'), '/owner/approvals');
  });
});

// ─── CONTRACTOR ─────────────────────────────────────────────────────────────

describe('getNotificationLink — CONTRACTOR', () => {
  it('JOB with entityId → detail page', () => {
    assert.equal(getNotificationLink(n('JOB', 'j1', 'JOB_CREATED'), 'CONTRACTOR'), '/contractor/jobs/j1');
  });

  it('JOB without entityId → list page', () => {
    assert.equal(getNotificationLink(n('JOB', null, 'JOB_CREATED'), 'CONTRACTOR'), '/contractor/jobs');
  });

  it('INVOICE → /contractor/invoices', () => {
    assert.equal(getNotificationLink(n('INVOICE', 'i1', 'INVOICE_PAID'), 'CONTRACTOR'), '/contractor/invoices');
  });

  it('RFP with entityId → detail page', () => {
    assert.equal(getNotificationLink(n('RFP', 'rfp1', 'QUOTE_SUBMITTED'), 'CONTRACTOR'), '/contractor/rfps/rfp1');
    assert.equal(getNotificationLink(n('RFP', 'rfp1', 'QUOTE_AWARDED'), 'CONTRACTOR'), '/contractor/rfps/rfp1');
    assert.equal(getNotificationLink(n('RFP', 'rfp1', 'QUOTE_REJECTED'), 'CONTRACTOR'), '/contractor/rfps/rfp1');
  });

  it('SCHEDULING → job detail (entityId = jobId)', () => {
    assert.equal(getNotificationLink(n('SCHEDULING', 'j1', 'SLOT_PROPOSED'), 'CONTRACTOR'), '/contractor/jobs/j1');
    assert.equal(getNotificationLink(n('SCHEDULING', 'j1', 'SLOT_ACCEPTED'), 'CONTRACTOR'), '/contractor/jobs/j1');
  });

  it('RATING → job detail (entityId = jobId)', () => {
    assert.equal(getNotificationLink(n('RATING', 'j1', 'RATING_SUBMITTED'), 'CONTRACTOR'), '/contractor/jobs/j1');
  });

  it('unknown entityType → null', () => {
    assert.equal(getNotificationLink(n('LEASE', 'l1', 'LEASE_SIGNED'), 'CONTRACTOR'), null);
  });
});

// ─── TENANT ─────────────────────────────────────────────────────────────────

describe('getNotificationLink — TENANT', () => {
  it('LEASE with entityId → detail page', () => {
    assert.equal(getNotificationLink(n('LEASE', 'l1', 'LEASE_READY_TO_SIGN'), 'TENANT'), '/tenant/leases/l1');
    assert.equal(getNotificationLink(n('LEASE', 'l1', 'LEASE_SIGNED'), 'TENANT'), '/tenant/leases/l1');
  });

  it('LEASE without entityId → null', () => {
    assert.equal(getNotificationLink(n('LEASE', null, 'LEASE_READY_TO_SIGN'), 'TENANT'), null);
  });

  it('INVOICE → /tenant/invoices', () => {
    assert.equal(getNotificationLink(n('INVOICE', 'i1', 'INVOICE_CREATED'), 'TENANT'), '/tenant/invoices');
  });

  it('REQUEST → /tenant/requests', () => {
    assert.equal(getNotificationLink(n('REQUEST', 'r1', 'REQUEST_APPROVED'), 'TENANT'), '/tenant/requests');
    assert.equal(getNotificationLink(n('REQUEST', 'r1', 'OWNER_REJECTED'), 'TENANT'), '/tenant/requests');
    assert.equal(getNotificationLink(n('REQUEST', 'r1', 'TENANT_SELF_PAY_ACCEPTED'), 'TENANT'), '/tenant/requests');
  });

  it('JOB → /tenant/requests (closest context)', () => {
    assert.equal(getNotificationLink(n('JOB', 'j1', 'JOB_STARTED'), 'TENANT'), '/tenant/requests');
    assert.equal(getNotificationLink(n('JOB', 'j1', 'JOB_COMPLETED'), 'TENANT'), '/tenant/requests');
  });

  it('SCHEDULING → /tenant/requests', () => {
    assert.equal(getNotificationLink(n('SCHEDULING', 'j1', 'SLOT_PROPOSED'), 'TENANT'), '/tenant/requests');
  });

  it('eventType fallback for INVOICE_* without entityType', () => {
    assert.equal(getNotificationLink(n(null, 'i1', 'INVOICE_CREATED'), 'TENANT'), '/tenant/invoices');
  });

  it('unknown → null', () => {
    assert.equal(getNotificationLink(n('RFP', 'rfp1', 'QUOTE_SUBMITTED'), 'TENANT'), null);
  });
});

// ─── Edge cases ─────────────────────────────────────────────────────────────

describe('getNotificationLink — edge cases', () => {
  it('null/undefined notif → null', () => {
    assert.equal(getNotificationLink(null, 'MANAGER'), null);
    assert.equal(getNotificationLink(undefined, 'MANAGER'), null);
  });

  it('empty notif object → null', () => {
    assert.equal(getNotificationLink({}, 'MANAGER'), null);
  });

  it('unknown role → null', () => {
    assert.equal(getNotificationLink(n('JOB', 'j1', 'JOB_CREATED'), 'ADMIN'), null);
  });

  it('case-insensitive role matching', () => {
    assert.equal(getNotificationLink(n('JOB', 'j1', 'JOB_CREATED'), 'manager'), '/manager/work-requests');
    assert.equal(getNotificationLink(n('JOB', 'j1', 'JOB_CREATED'), 'Contractor'), '/contractor/jobs/j1');
  });

  it('missing role → null', () => {
    assert.equal(getNotificationLink(n('JOB', 'j1', 'JOB_CREATED'), null), null);
    assert.equal(getNotificationLink(n('JOB', 'j1', 'JOB_CREATED'), ''), null);
  });
});
