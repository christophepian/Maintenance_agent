/**
 * Org Scope Enforcement
 *
 * The `Request` model has a direct orgId column (DT-114). Resolution
 * reads it first; FK chain fallback handles any pre-migration rows
 * with an empty orgId.
 *
 * This module provides:
 *  - resolveRequestOrg: org resolution for a Request
 *  - assertOrgScope: throws 403 if resolved org ≠ caller org
 *  - requireOrgScopeForRequest: convenience wrapper used in routes
 */

import { PrismaClient } from "@prisma/client";

// ────────────── Resolve Request → orgId ──────────────────────

export type OrgResolution =
  | { resolved: true; orgId: string; via: string }
  | { resolved: false; orgId: null; via: "none" };

/**
 * Resolve the orgId that owns a Request.
 *
 * Primary: read Request.orgId directly (DT-114 migration).
 * Fallback: walk FK chains for any pre-migration rows with orgId="".
 *
 * Returns { resolved: true, orgId, via } or { resolved: false }.
 */
export async function resolveRequestOrg(
  prisma: PrismaClient,
  requestId: string,
): Promise<OrgResolution> {
  const row = await prisma.request.findUnique({
    where: { id: requestId },
    select: {
      orgId: true,
      unitId: true,
      tenantId: true,
      assignedContractorId: true,
      unit: { select: { orgId: true } },
      tenant: { select: { orgId: true } },
      assignedContractor: { select: { orgId: true } },
    },
  });

  if (!row) return { resolved: false, orgId: null, via: "none" };

  // Primary: direct orgId (all rows post-DT-114 migration)
  if (row.orgId) return { resolved: true, orgId: row.orgId, via: "request" };

  // Fallback: FK chains (pre-migration rows with empty orgId)
  if (row.unit?.orgId) return { resolved: true, orgId: row.unit.orgId, via: "unit" };
  if (row.tenant?.orgId) return { resolved: true, orgId: row.tenant.orgId, via: "tenant" };
  if (row.assignedContractor?.orgId) return { resolved: true, orgId: row.assignedContractor.orgId, via: "contractor" };

  return { resolved: false, orgId: null, via: "none" };
}

// ────────────── Resolve Job → orgId ──────────────────────────

/**
 * Job has a direct orgId column, so resolution is trivial.
 */
export async function resolveJobOrg(
  prisma: PrismaClient,
  jobId: string,
): Promise<OrgResolution> {
  const row = await prisma.job.findUnique({
    where: { id: jobId },
    select: { orgId: true },
  });
  if (!row) return { resolved: false, orgId: null, via: "none" };
  return { resolved: true, orgId: row.orgId, via: "job" };
}

// ────────────── Resolve Invoice → orgId ──────────────────────

/**
 * Invoice has a direct orgId column.
 */
export async function resolveInvoiceOrg(
  prisma: PrismaClient,
  invoiceId: string,
): Promise<OrgResolution> {
  const row = await prisma.invoice.findUnique({
    where: { id: invoiceId },
    select: { orgId: true },
  });
  if (!row) return { resolved: false, orgId: null, via: "none" };
  return { resolved: true, orgId: row.orgId, via: "invoice" };
}

// ────────────── Resolve Lease → orgId ────────────────────────

/**
 * Lease has a direct orgId column.
 */
export async function resolveLeaseOrg(
  prisma: PrismaClient,
  leaseId: string,
): Promise<OrgResolution> {
  const row = await prisma.lease.findUnique({
    where: { id: leaseId },
    select: { orgId: true },
  });
  if (!row) return { resolved: false, orgId: null, via: "none" };
  return { resolved: true, orgId: row.orgId, via: "lease" };
}


// ────────────── Resolve Asset → orgId ────────────────────────

/**
 * Asset has a direct orgId column.
 */
export async function resolveAssetOrg(
  prisma: PrismaClient,
  assetId: string,
): Promise<OrgResolution> {
  const row = await prisma.asset.findUnique({
    where: { id: assetId },
    select: { orgId: true },
  });
  if (!row) return { resolved: false, orgId: null, via: "none" };
  return { resolved: true, orgId: row.orgId, via: "asset" };
}

// ────────────── Assertion helper ─────────────────────────────

/**
 * Compare the caller's orgId against the entity's resolved orgId.
 *
 * Throws a typed error that route handlers should catch and map to 403.
 * If the entity's org can't be resolved (all FK chains null), we
 * allow access in dev mode but reject in production.
 */
export class OrgScopeMismatchError extends Error {
  constructor(
    public callerOrgId: string,
    public entityOrgId: string | null,
    public via: string,
  ) {
    super(`Org scope mismatch: caller=${callerOrgId} entity=${entityOrgId} via=${via}`);
    this.name = "OrgScopeMismatchError";
  }
}

export function assertOrgScope(
  callerOrgId: string,
  resolution: OrgResolution,
): void {
  if (!resolution.resolved) {
    // Entity has no org chain at all (orphan request with all null FKs).
    // In production this is a hard reject; in dev allow it.
    if (process.env.NODE_ENV === "production") {
      throw new OrgScopeMismatchError(callerOrgId, null, "none");
    }
    return; // dev: allow orphans
  }

  if (resolution.orgId !== callerOrgId) {
    throw new OrgScopeMismatchError(callerOrgId, resolution.orgId, resolution.via);
  }
}
