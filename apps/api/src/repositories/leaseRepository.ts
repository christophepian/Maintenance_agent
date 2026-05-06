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

import { PrismaClient, LeaseStatus, RequestStatus, JobStatus, Prisma } from "@prisma/client";

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
  const where: Prisma.LeaseWhereInput = { orgId, isTemplate: false, deletedAt: null };
  if (filters.status) where.status = filters.status as LeaseStatus;
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
  data: Prisma.LeaseUncheckedCreateInput,
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
  data: Prisma.LeaseUpdateInput,
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
  data: Prisma.LeaseUpdateInput,
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
  const where: Prisma.LeaseWhereInput = { orgId, isTemplate: true, deletedAt: null };
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
  data: Prisma.TenantUpdateInput,
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
  const where: Prisma.LeaseWhereInput = { orgId, isTemplate: false };
  if (filters.status) where.status = filters.status as LeaseStatus;
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

// ─── Rent Reduction / Legal Engine Lease Lookups ──────────────

/** Select fields needed for rent reduction calculation. */
const LEASE_RENT_SELECT = {
  id: true,
  status: true,
  netRentChf: true,
  startDate: true,
  endDate: true,
} as const;

/**
 * Load a lease by ID with only the fields needed for rent reduction.
 */
export async function findLeaseForRentReduction(
  prisma: PrismaClient,
  leaseId: string,
) {
  return prisma.lease.findUnique({
    where: { id: leaseId },
    select: LEASE_RENT_SELECT,
  });
}

/**
 * Find the most recent active/signed lease for a unit.
 * Returns only the lease id.
 */
export async function findActiveLeaseForUnit(
  prisma: PrismaClient,
  unitId: string,
) {
  return prisma.lease.findFirst({
    where: { unitId, status: { in: ["ACTIVE", "SIGNED"] } },
    orderBy: { startDate: "desc" },
    select: { id: true },
  });
}

/**
 * Find active leases for a building (via unit relation).
 * Returns rentTotalChf for income projection fallback.
 */
export async function findActiveLeasesByBuilding(
  prisma: PrismaClient,
  buildingId: string,
) {
  return prisma.lease.findMany({
    where: { unit: { buildingId }, status: "ACTIVE" },
    select: { rentTotalChf: true },
  });
}

// ─── Tenant lookup with occupancies (tenant portal) ───────────

/** Include for tenant session — occupancies with unit → building + assets. */
export const TENANT_SESSION_INCLUDE = {
  occupancies: {
    include: {
      unit: {
        include: {
          building: true,
          assets: {
            include: {
              assetModel: true,
            },
          },
        },
      },
    },
  },
} as const;

/**
 * Find a tenant by org + phone with full occupancy context for portal session.
 */
export async function findTenantByPhoneWithOccupancies(
  prisma: PrismaClient,
  orgId: string,
  phone: string,
) {
  return prisma.tenant.findUnique({
    where: { orgId_phone: { orgId, phone } },
    include: TENANT_SESSION_INCLUDE,
  });
}

// ─── Lease Expiry / Signature Request Helpers ─────────────────

/** Find the latest signature request sentAt for a lease, used to compute 5-day window. */
export async function findLeaseExpirySignatureRequest(prisma: PrismaClient, leaseId: string) {
  return prisma.signatureRequest.findFirst({
    where: { entityId: leaseId, entityType: "LEASE" },
    orderBy: { createdAt: "desc" },
    select: { sentAt: true },
  });
}

/** Batch-load sentAt for READY_TO_SIGN leases (list view). */
export async function findSignatureRequestsSentAt(
  prisma: PrismaClient,
  leaseIds: string[],
) {
  return prisma.signatureRequest.findMany({
    where: { entityId: { in: leaseIds }, entityType: "LEASE" },
    select: { entityId: true, sentAt: true },
    orderBy: { createdAt: "desc" },
  });
}

/** Update a signature request record. */
export async function updateSignatureRequest(
  prisma: PrismaClient,
  id: string,
  data: Prisma.SignatureRequestUpdateInput,
) {
  return prisma.signatureRequest.update({ where: { id }, data });
}

// ─── Unit vacancy helpers ──────────────────────────────────────

/** Mark a single unit as vacant (no org scope). Used by cancelLease. */
export async function setUnitVacant(prisma: PrismaClient, unitId: string) {
  return prisma.unit.update({ where: { id: unitId }, data: { isVacant: true } });
}

/** Mark a unit as vacant scoped to org (updateMany). */
export async function setUnitVacantByOrg(prisma: PrismaClient, unitId: string, orgId: string) {
  return prisma.unit.updateMany({ where: { id: unitId, orgId }, data: { isVacant: true } });
}

/** Find unit with building include. */
export async function findUnitWithBuilding(prisma: PrismaClient, unitId: string) {
  return prisma.unit.findUnique({ where: { id: unitId }, include: { building: true } });
}

/**
 * Find a unit with nested owners → billingEntity for invoice issuer resolution.
 */
export async function findUnitWithOwnersBillingEntity(prisma: PrismaClient, unitId: string) {
  return prisma.unit.findUnique({
    where: { id: unitId },
    select: {
      building: {
        select: {
          owners: {
            include: { user: { select: { billingEntity: { select: { id: true } } } } },
            take: 1,
          },
        },
      },
    },
  });
}

// ─── Invoice helpers ───────────────────────────────────────────

/** Find all DRAFT invoices for a lease (used in autoActivateLeaseInvoices). */
export async function findDraftInvoicesByLease(
  prisma: PrismaClient,
  leaseId: string,
  orgId: string,
) {
  return prisma.invoice.findMany({ where: { leaseId, orgId, status: "DRAFT" } });
}

/** Find any invoice for a lease — existence check. */
export async function findAnyInvoiceForLease(
  prisma: PrismaClient,
  leaseId: string,
  orgId: string,
) {
  return prisma.invoice.findFirst({ where: { leaseId, orgId } });
}

/** Find monthly rent invoice (idempotency check in generateMonthlyRentInvoices). */
export async function findMonthlyRentInvoice(
  prisma: PrismaClient,
  leaseId: string,
  orgId: string,
  monthStart: Date,
  monthEnd: Date,
) {
  return prisma.invoice.findFirst({
    where: {
      leaseId,
      orgId,
      createdAt: { gte: monthStart, lt: monthEnd },
      description: { contains: "Loyer mensuel" },
    },
  });
}

/** Find all ACTIVE non-template leases for monthly invoicing. */
export async function findActiveLeasesForInvoicing(prisma: PrismaClient, orgId: string) {
  return prisma.lease.findMany({
    where: { orgId, status: LeaseStatus.ACTIVE, isTemplate: false },
    select: {
      id: true,
      tenantName: true,
      netRentChf: true,
      rentTotalChf: true,
      startDate: true,
      endDate: true,
    },
  });
}

// ─── Lease Expense Item helpers ────────────────────────────────

const EXPENSE_ITEM_REPO_INCLUDE = { expenseType: true, account: true } as const;

/** Find a lease (raw) for expense-item validation. */
export async function findLeaseForExpenseItem(prisma: PrismaClient, leaseId: string) {
  return prisma.lease.findUnique({ where: { id: leaseId } });
}

/** Find an expense type by id. */
export async function findExpenseType(prisma: PrismaClient, id: string) {
  return prisma.expenseType.findUnique({ where: { id } });
}

/** Find an account by id. */
export async function findAccount(prisma: PrismaClient, id: string) {
  return prisma.account.findUnique({ where: { id } });
}

/** Find a lease expense item by id. */
export async function findLeaseExpenseItem(prisma: PrismaClient, id: string) {
  return prisma.leaseExpenseItem.findUnique({ where: { id } });
}

/** Create a lease expense item. */
export async function createLeaseExpenseItemRecord(
  prisma: PrismaClient,
  data: Prisma.LeaseExpenseItemCreateInput,
) {
  return prisma.leaseExpenseItem.create({ data, include: EXPENSE_ITEM_REPO_INCLUDE });
}

/** Update a lease expense item. */
export async function updateLeaseExpenseItemRecord(
  prisma: PrismaClient,
  id: string,
  data: Prisma.LeaseExpenseItemUpdateInput,
) {
  return prisma.leaseExpenseItem.update({ where: { id }, data, include: EXPENSE_ITEM_REPO_INCLUDE });
}

/** Delete a lease expense item. */
export async function deleteLeaseExpenseItemRecord(prisma: PrismaClient, id: string) {
  return prisma.leaseExpenseItem.delete({ where: { id } });
}

