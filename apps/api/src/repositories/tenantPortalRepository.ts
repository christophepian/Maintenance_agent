/**
 * Tenant Portal Repository
 *
 * Centralizes Prisma queries used by tenant-portal route handlers.
 * Extracted from routes/auth.ts to comply with the routes→services→repos layer rule.
 */

import { PrismaClient } from "@prisma/client";
import { LEASE_FULL_INCLUDE } from "./leaseRepository";

// ─── Canonical Includes ────────────────────────────────────────

/** Include tree for tenant request listings. */
export const TENANT_REQUEST_INCLUDE = {
  unit: { select: { unitNumber: true, building: { select: { name: true } } } },
  assignedContractor: { select: { name: true } },
  job: {
    select: {
      id: true,
      status: true,
      confirmedAt: true,
      completedAt: true,
      ratings: { select: { raterRole: true, score: true } },
    },
  },
} as const;

// ─── Queries ───────────────────────────────────────────────────

/**
 * Find all maintenance requests for a tenant, with relations for the tenant portal listing.
 */
export async function findTenantRequests(prisma: PrismaClient, tenantId: string) {
  return prisma.request.findMany({
    where: { tenantId },
    orderBy: { createdAt: "desc" as const },
    include: TENANT_REQUEST_INCLUDE,
  });
}

/**
 * Resolve the first unitId for a tenant via their occupancy records.
 */
export async function findTenantUnitId(prisma: PrismaClient, tenantId: string) {
  const occupancy = await prisma.occupancy.findFirst({
    where: { tenantId },
    select: { unitId: true },
  });
  return occupancy?.unitId ?? null;
}

/**
 * Find all unit IDs for a tenant's occupancies.
 */
export async function findTenantUnitIds(prisma: PrismaClient, tenantId: string) {
  const occupancies = await prisma.occupancy.findMany({
    where: { tenantId },
    select: { unitId: true },
  });
  return occupancies.map((o: { unitId: string }) => o.unitId);
}

/**
 * Find leases for given unit IDs within an org.
 */
export async function findLeasesByUnitIds(
  prisma: PrismaClient,
  orgId: string,
  unitIds: string[]
) {
  return prisma.lease.findMany({
    where: { orgId, unitId: { in: unitIds } },
    include: LEASE_FULL_INCLUDE,
  });
}

/**
 * Find invoices linked to given leases.
 */
export async function findInvoicesByLeaseIds(
  prisma: PrismaClient,
  orgId: string,
  leaseIds: string[]
) {
  return prisma.invoice.findMany({
    where: { orgId, leaseId: { in: leaseIds } },
    orderBy: { createdAt: "desc" as const },
  });
}

/**
 * Find job-based invoices for a tenant (via job→request→tenantId).
 */
export async function findJobInvoicesByTenant(
  prisma: PrismaClient,
  orgId: string,
  tenantId: string
) {
  return prisma.invoice.findMany({
    where: {
      orgId,
      job: { request: { tenantId } },
    },
    include: {
      job: {
        include: {
          request: {
            include: {
              unit: { include: { building: true } },
            },
          },
        },
      },
    },
    orderBy: { createdAt: "desc" as const },
  });
}

/**
 * Check if a tenant owns an invoice (via lease→unit occupancy or job→request).
 * Returns true if the tenant has access, false otherwise.
 */
export async function verifyTenantInvoiceOwnership(
  prisma: PrismaClient,
  invoiceId: string,
  tenantId: string
): Promise<{ invoice: any; owned: boolean }> {
  const invoice = await prisma.invoice.findUnique({ where: { id: invoiceId } });
  if (!invoice) return { invoice: null, owned: false };

  let owned = false;
  if (invoice.leaseId) {
    const lease = await prisma.lease.findUnique({ where: { id: invoice.leaseId } });
    if (lease) {
      const occ = await prisma.occupancy.findFirst({
        where: { tenantId, unitId: lease.unitId },
      });
      if (occ) owned = true;
    }
  }
  if (!owned && invoice.jobId) {
    const job = await prisma.job.findUnique({
      where: { id: invoice.jobId },
      include: { request: true },
    });
    if (job?.request?.tenantId === tenantId) owned = true;
  }

  return { invoice, owned };
}

/**
 * Create a user + contractor pair (dev-only endpoint).
 */
export async function createContractorUser(
  prisma: PrismaClient,
  orgId: string,
  data: { email: string; name: string; passwordHash: string; phone: string }
) {
  const user = await prisma.user.create({
    data: { orgId, email: data.email, name: data.name, passwordHash: data.passwordHash, role: "CONTRACTOR" },
  });
  const contractor = await prisma.contractor.create({
    data: {
      orgId: String(orgId),
      name: String(data.name),
      phone: String(data.phone),
      email: String(data.email),
      serviceCategories: JSON.stringify(["general"]),
    },
  });
  return { userId: user.id, contractorId: contractor.id };
}
