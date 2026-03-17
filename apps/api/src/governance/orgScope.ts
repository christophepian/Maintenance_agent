/**
 * Org Scope Enforcement
 *
 * Since the `Request` model has NO orgId column, we must resolve org
 * membership by traversing nullable FK chains to entities that DO have
 * orgId (Tenant, Unit, Appliance, Contractor).
 *
 * This module provides:
 *  - resolveRequestOrg: best-effort org resolution for a Request
 *  - assertOrgScope: throws 403 if resolved org ≠ caller org
 *  - requireOrgScopeForRequest: convenience wrapper used in routes
 */

import { PrismaClient } from "@prisma/client";

// ────────────── Resolve Request → orgId ──────────────────────

export type OrgResolution =
  | { resolved: true; orgId: string; via: string }
  | { resolved: false; orgId: null; via: "none" };

/**
 * Resolve the orgId that owns a Request by walking its nullable FK
 * chains in priority order:
 *   1. unit.orgId       (most reliable — unit always has orgId)
 *   2. tenant.orgId
 *   3. appliance.orgId
 *   4. assignedContractor.orgId
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
      unitId: true,
      tenantId: true,
      applianceId: true,
      assignedContractorId: true,
      unit: { select: { orgId: true } },
      tenant: { select: { orgId: true } },
      appliance: { select: { orgId: true } },
      assignedContractor: { select: { orgId: true } },
    },
  });

  if (!row) return { resolved: false, orgId: null, via: "none" };

  if (row.unit?.orgId) return { resolved: true, orgId: row.unit.orgId, via: "unit" };
  if (row.tenant?.orgId) return { resolved: true, orgId: row.tenant.orgId, via: "tenant" };
  if (row.appliance?.orgId) return { resolved: true, orgId: row.appliance.orgId, via: "appliance" };
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

// ────────────── Resolve Appliance → orgId ────────────────────

/**
 * Appliance has a direct orgId column.
 */
export async function resolveApplianceOrg(
  prisma: PrismaClient,
  applianceId: string,
): Promise<OrgResolution> {
  const row = await prisma.appliance.findUnique({
    where: { id: applianceId },
    select: { orgId: true },
  });
  if (!row) return { resolved: false, orgId: null, via: "none" };
  return { resolved: true, orgId: row.orgId, via: "appliance" };
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
