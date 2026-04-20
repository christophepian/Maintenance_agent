/**
 * Lease Repository
 *
 * Centralizes all Prisma access for the Lease entity.
 * Owns the canonical include trees so that DTO mappers always receive
 * the correct shape.  Route handlers and workflows should use these
 * functions instead of ad-hoc prisma.lease calls.
 *
 * G3: include must match what DTO mappers access.
 * G9: canonical include constants live here.
 */

import { PrismaClient, LeaseStatus, RequestStatus, JobStatus } from "@prisma/client";

// ─── Canonical Includes ────────────────────────────────────────

/** Full include for single-lease and full-list views. */
export const LEASE_FULL_INCLUDE = {
  unit: { include: { building: true } },
  expenseItems: { include: { expenseType: true, account: true } },
} as const;

// ─── Query Helpers ─────────────────────────────────────────────

/** Find a single lease by ID with full include. */
export async function findLeaseById(
  prisma: PrismaClient,
  id: string,
) {
  return prisma.lease.findUnique({
    where: { id },
    include: LEASE_FULL_INCLUDE,
  });
}

/** Find a lease by ID, returning raw (no include) for status checks. */
export async function findLeaseRaw(
  prisma: PrismaClient,
  id: string,
) {
  return prisma.lease.findUnique({ where: { id } });
}

/** List leases for an org with optional filters. */
export async function listLeases(
  prisma: PrismaClient,
  orgId: string,
  filters: {
    status?: string;
    unitId?: string;
    applicationId?: string;
    expenseTypeId?: string;
    startDateFrom?: Date;
    startDateTo?: Date;
    endDateFrom?: Date;
    endDateTo?: Date;
    limit?: number;
    offset?: number;
  } = {},
) {
  const where: any = { orgId, isTemplate: false, deletedAt: null };
  if (filters.status) where.status = filters.status;
  if (filters.unitId) where.unitId = filters.unitId;
  if (filters.applicationId) where.applicationId = filters.applicationId;
  if (filters.expenseTypeId) where.expenseItems = { some: { expenseTypeId: filters.expenseTypeId } };
  if (filters.startDateFrom || filters.startDateTo) {
    where.startDate = {
      ...(filters.startDateFrom && { gte: filters.startDateFrom }),
      ...(filters.startDateTo && { lte: filters.startDateTo }),
    };
  }
  if (filters.endDateFrom || filters.endDateTo) {
    where.endDate = {
      ...(filters.endDateFrom && { gte: filters.endDateFrom }),
      ...(filters.endDateTo && { lte: filters.endDateTo }),
    };
  }
  return prisma.lease.findMany({
    where,
    include: LEASE_FULL_INCLUDE,
    orderBy: { createdAt: "desc" },
    take: filters.limit ?? 50,
    skip: filters.offset ?? 0,
  });
}

// ─── Mutation Helpers ──────────────────────────────────────────

/** Create a new lease record. */
export async function createLease(
  prisma: PrismaClient,
  data: any,
) {
  return prisma.lease.create({
    data,
    include: LEASE_FULL_INCLUDE,
  });
}

/** Update a lease by ID. */
export async function updateLease(
  prisma: PrismaClient,
  id: string,
  data: any,
) {
  return prisma.lease.update({
    where: { id },
    data,
    include: LEASE_FULL_INCLUDE,
  });
}

/** Update a lease by ID (raw, no include). */
export async function updateLeaseRaw(
  prisma: PrismaClient,
  id: string,
  data: any,
) {
  return prisma.lease.update({
    where: { id },
    data,
  });
}

// ─── Template Queries ──────────────────────────────────────────

/** Find lease templates for an org, optionally filtered by building. */
export async function findTemplates(
  prisma: PrismaClient,
  orgId: string,
  buildingId?: string,
) {
  const where: any = { orgId, isTemplate: true, deletedAt: null };
  if (buildingId) where.templateBuildingId = buildingId;

  return prisma.lease.findMany({
    where,
    include: LEASE_FULL_INCLUDE,
    orderBy: { createdAt: "desc" },
  });
}

// ─── Tenant + Occupancy Provisioning ───────────────────────────

/** Find a tenant by org + phone (unique constraint). */
export async function findTenantByOrgPhone(
  prisma: PrismaClient,
  orgId: string,
  phone: string,
) {
  return prisma.tenant.findUnique({
    where: { orgId_phone: { orgId, phone } },
  });
}

/** Create a new tenant record. */
export async function createTenant(
  prisma: PrismaClient,
  data: { orgId: string; phone: string; name: string; email: string | null },
) {
  return prisma.tenant.create({ data });
}

/** Update a tenant record. */
export async function updateTenant(
  prisma: PrismaClient,
  id: string,
  data: any,
) {
  return prisma.tenant.update({ where: { id }, data });
}

/** Find an occupancy linking tenant to unit. */
export async function findOccupancy(
  prisma: PrismaClient,
  tenantId: string,
  unitId: string,
) {
  return prisma.occupancy.findFirst({
    where: { tenantId, unitId },
  });
}

/** Create an occupancy record. */
export async function createOccupancy(
  prisma: PrismaClient,
  data: { tenantId: string; unitId: string },
) {
  return prisma.occupancy.create({ data });
}

// ─── Invoice Support ───────────────────────────────────────────

/** Find the admin job used for lease-related invoices. */
export async function findAdminJob(
  prisma: PrismaClient,
  orgId: string,
) {
  return prisma.job.findFirst({
    where: { orgId, request: { contractorNotes: "__LEASE_ADMIN__" } },
  });
}

/** Find or create the first contractor for the org (admin purposes). */
export async function findOrCreateAdminContractor(
  prisma: PrismaClient,
  orgId: string,
) {
  let contractor = await prisma.contractor.findFirst({
    where: { orgId },
    orderBy: { createdAt: "asc" },
  });

  if (!contractor) {
    contractor = await prisma.contractor.create({
      data: {
        orgId,
        name: "System Admin",
        phone: "+41000000000",
        email: "admin@system.local",
        serviceCategories: "[]",
      },
    });
  }
  return contractor;
}

// ─── Lease Count ───────────────────────────────────────────────

/** Count leases matching filter criteria (for pagination). */
export async function countLeases(
  prisma: PrismaClient,
  orgId: string,
  filters: { status?: string; unitId?: string; applicationId?: string; expenseTypeId?: string } = {},
) {
  const where: any = { orgId, isTemplate: false };
  if (filters.status) where.status = filters.status;
  if (filters.unitId) where.unitId = filters.unitId;
  if (filters.applicationId) where.applicationId = filters.applicationId;
  if (filters.expenseTypeId) where.expenseItems = { some: { expenseTypeId: filters.expenseTypeId } };
  return prisma.lease.count({ where });
}

// ─── Invoice Support (cross-model scaffolding) ────────────────

/** Create a system admin Request for lease invoice scaffolding. */
export async function createAdminRequest(
  prisma: PrismaClient,
  data: { orgId: string; description: string; category: string; status: RequestStatus; contractorNotes: string },
) {
  return prisma.request.create({ data });
}

/** Create a system admin Job for lease invoice scaffolding. */
export async function createAdminJob(
  prisma: PrismaClient,
  data: { orgId: string; requestId: string; contractorId: string; status: JobStatus },
) {
  return prisma.job.create({ data });
}

/** Create an invoice (used for lease-linked invoices). */
export async function createInvoice(
  prisma: PrismaClient,
  data: Record<string, unknown>,
) {
  return prisma.invoice.create({ data: data as any });
}

/** List invoices for a lease. */
export async function listInvoicesByLease(
  prisma: PrismaClient,
  leaseId: string,
  orgId: string,
) {
  return prisma.invoice.findMany({
    where: { leaseId, orgId },
    orderBy: { createdAt: "desc" },
  });
}
