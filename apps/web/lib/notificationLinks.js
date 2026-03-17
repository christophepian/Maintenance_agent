/**
 * Centralized notification deep-link resolver.
 *
 * Given a notification object ({ entityType, entityId, eventType }) and a role
 * string, returns the best URL for the user to navigate to — or null when no
 * meaningful destination exists.
 *
 * Design rules:
 * - Deep-link to the entity detail page when one exists (uses entityId).
 * - Fall back to the relevant list page when no detail page exists.
 * - Return null for entity/role combos that have no page at all.
 * - Never throw — graceful degradation is preferred.
 */

/**
 * @param {{ entityType?: string; entityId?: string; eventType?: string }} notif
 * @param {string} role — MANAGER | OWNER | CONTRACTOR | TENANT
 * @returns {string | null}
 */
export function getNotificationLink(notif, role) {
  const { entityType, entityId, eventType } = notif || {};
  const r = (role || '').toUpperCase();

  switch (r) {
    case 'TENANT':
      return resolveTenant(entityType, entityId, eventType);
    case 'CONTRACTOR':
      return resolveContractor(entityType, entityId, eventType);
    case 'OWNER':
      return resolveOwner(entityType, entityId, eventType);
    case 'MANAGER':
      return resolveManager(entityType, entityId, eventType);
    default:
      return null;
  }
}

// ── Tenant ──────────────────────────────────────────────────────────────────

function resolveTenant(entityType, entityId, eventType) {
  switch (entityType) {
    case 'LEASE':
      return entityId ? `/tenant/leases/${entityId}` : null;
    case 'INVOICE':
      return '/tenant/invoices';
    case 'REQUEST':
      return '/tenant/requests';
    case 'JOB':
      return '/tenant/requests'; // tenant has no job page; requests page is closest context
    case 'SCHEDULING':
      return '/tenant/requests';
    default:
      break;
  }

  // Fallback on eventType when entityType is missing or unexpected
  if (eventType) {
    if (eventType.startsWith('INVOICE_')) return '/tenant/invoices';
    if (eventType.startsWith('LEASE_'))   return null; // no entityId, can't deep-link
    if (eventType.startsWith('JOB_'))     return '/tenant/requests';
    if (eventType.startsWith('REQUEST_') || eventType === 'OWNER_REJECTED' || eventType === 'TENANT_SELF_PAY_ACCEPTED') return '/tenant/requests';
  }

  return null;
}

// ── Contractor ──────────────────────────────────────────────────────────────

function resolveContractor(entityType, entityId, _eventType) {
  switch (entityType) {
    case 'JOB':
      return entityId ? `/contractor/jobs/${entityId}` : '/contractor/jobs';
    case 'INVOICE':
      return '/contractor/invoices';
    case 'RFP':
      return entityId ? `/contractor/rfps/${entityId}` : '/contractor/rfps';
    case 'SCHEDULING':
      // SCHEDULING entityId is the jobId — link to job detail
      return entityId ? `/contractor/jobs/${entityId}` : '/contractor/jobs';
    case 'RATING':
      // RATING entityId is the jobId
      return entityId ? `/contractor/jobs/${entityId}` : '/contractor/jobs';
    default:
      return null;
  }
}

// ── Owner ───────────────────────────────────────────────────────────────────

function resolveOwner(entityType, entityId, eventType) {
  switch (entityType) {
    case 'LEASE':
      // No owner-specific lease page exists; manager detail page works with shared auth
      return entityId ? `/manager/leases/${entityId}` : null;
    case 'REQUEST':
      return '/owner/approvals';
    case 'JOB':
      return '/owner/jobs';
    case 'INVOICE':
      return '/owner/invoices';
    case 'RFP':
      return entityId ? `/owner/rfps/${entityId}` : '/owner/rfps';
    case 'SELECTION':
      return '/owner/vacancies';
    case 'APPLICATION':
      return '/owner/vacancies';
    default:
      break;
  }

  // eventType-based fallbacks
  if (eventType === 'REQUEST_PENDING_OWNER_APPROVAL' || eventType === 'OWNER_REJECTED') {
    return '/owner/approvals';
  }
  if (eventType === 'TENANT_SELECTED') return '/owner/vacancies';
  if (eventType === 'APPLICATION_SUBMITTED') return '/owner/vacancies';

  return null;
}

// ── Manager (default) ───────────────────────────────────────────────────────

function resolveManager(entityType, entityId, eventType) {
  switch (entityType) {
    case 'LEASE':
      return entityId ? `/manager/leases/${entityId}` : '/manager/leases';
    case 'REQUEST':
      return '/manager/work-requests';
    case 'JOB':
      return '/manager/work-requests'; // manager has no dedicated job detail page
    case 'INVOICE':
      return '/manager/finance/invoices';
    case 'RFP':
      return entityId ? `/manager/rfps/${entityId}` : '/manager/rfps';
    case 'SELECTION':
      return '/manager/vacancies';
    case 'APPLICATION':
      return entityId
        ? `/manager/rental-applications/${entityId}`
        : '/manager/vacancies';
    case 'SCHEDULING':
      return '/manager/work-requests';
    case 'RATING':
      return '/manager/work-requests';
    default:
      break;
  }

  // eventType-based fallbacks
  if (eventType) {
    if (eventType.startsWith('REQUEST_') || eventType === 'CONTRACTOR_ASSIGNED' || eventType === 'CONTRACTOR_REJECTED' || eventType === 'OWNER_REJECTED') {
      return '/manager/work-requests';
    }
    if (eventType === 'TENANT_SELECTED') return '/manager/vacancies';
    if (eventType === 'APPLICATION_SUBMITTED') return '/manager/vacancies';
  }

  return null;
}
