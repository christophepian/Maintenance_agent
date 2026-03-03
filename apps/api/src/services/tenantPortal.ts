/**
 * Tenant Portal — read-only lease access & acceptance stub
 *
 * Tenants identify via phone → unitId; they can only see leases
 * that are READY_TO_SIGN, SIGNED, or ACTIVE on their unit.
 */
import { LeaseStatus, SignatureRequestStatus } from '@prisma/client';
import prisma from './prismaClient';

// ==========================================
// DTOs — Tenant-facing (subset of full LeaseDTO)
// ==========================================
export interface TenantLeaseDTO {
  id: string;
  status: LeaseStatus;
  unitId: string;

  landlordName: string;
  tenantName: string;
  coTenantName?: string;

  objectType: string;
  roomsCount?: string;
  floor?: string;

  startDate: string;
  isFixedTerm: boolean;
  endDate?: string;
  noticeRule: string;

  netRentChf: number;
  garageRentChf?: number;
  otherServiceRentChf?: number;
  chargesTotalChf?: number;
  rentTotalChf?: number;

  depositChf?: number;
  depositDueRule: string;

  otherStipulations?: string;
  includesHouseRules: boolean;

  createdAt: string;
  updatedAt: string;

  // Nested unit/building info
  unit?: {
    id: string;
    unitNumber: string;
    floor?: string;
    building: {
      id: string;
      name: string;
      address: string;
    };
  };

  // Signature info (if any active request exists)
  signatureStatus?: string;
  tenantAcceptedAt?: string;
  activatedAt?: string;
  depositPaidAt?: string;
  depositDueDate?: string;
}

// ==========================================
// Mapper
// ==========================================
function mapToTenantLeaseDTO(lease: any, signatureReq?: any): TenantLeaseDTO {
  return {
    id: lease.id,
    status: lease.status,
    unitId: lease.unitId,

    landlordName: lease.landlordName,
    tenantName: lease.tenantName,
    coTenantName: lease.coTenantName || undefined,

    objectType: lease.objectType,
    roomsCount: lease.roomsCount || undefined,
    floor: lease.floor || undefined,

    startDate: lease.startDate.toISOString(),
    isFixedTerm: lease.isFixedTerm,
    endDate: lease.endDate ? lease.endDate.toISOString() : undefined,
    noticeRule: lease.noticeRule,

    netRentChf: lease.netRentChf,
    garageRentChf: lease.garageRentChf ?? undefined,
    otherServiceRentChf: lease.otherServiceRentChf ?? undefined,
    chargesTotalChf: lease.chargesTotalChf ?? undefined,
    rentTotalChf: lease.rentTotalChf ?? undefined,

    depositChf: lease.depositChf ?? undefined,
    depositDueRule: lease.depositDueRule,

    otherStipulations: lease.otherStipulations || undefined,
    includesHouseRules: lease.includesHouseRules,

    createdAt: lease.createdAt.toISOString(),
    updatedAt: lease.updatedAt.toISOString(),

    unit: lease.unit ? {
      id: lease.unit.id,
      unitNumber: lease.unit.unitNumber,
      floor: lease.unit.floor || undefined,
      building: lease.unit.building ? {
        id: lease.unit.building.id,
        name: lease.unit.building.name,
        address: lease.unit.building.address,
      } : undefined,
    } : undefined,

    signatureStatus: signatureReq?.status || undefined,
    tenantAcceptedAt: signatureReq?.signedAt ? signatureReq.signedAt.toISOString() : undefined,
    activatedAt: lease.activatedAt ? lease.activatedAt.toISOString() : undefined,
    depositPaidAt: lease.depositPaidAt ? lease.depositPaidAt.toISOString() : undefined,
    depositDueDate: lease.depositDueDate ? lease.depositDueDate.toISOString() : undefined,
  };
}

// ==========================================
// TENANT-VISIBLE STATUSES: only non-draft
// ==========================================
const TENANT_VISIBLE_STATUSES: LeaseStatus[] = [LeaseStatus.READY_TO_SIGN, LeaseStatus.SIGNED, LeaseStatus.ACTIVE];

// ==========================================
// List leases for a tenant (across all occupied units)
// ==========================================
export async function listTenantLeases(
  tenantId: string,
  orgId: string,
  unitId?: string,
): Promise<TenantLeaseDTO[]> {
  // If unitId provided, verify that specific occupancy
  // Otherwise, get ALL units this tenant occupies
  let unitIds: string[];
  if (unitId) {
    const occupancy = await prisma.occupancy.findFirst({
      where: { tenantId, unitId },
    });
    if (!occupancy) {
      throw new Error('Tenant does not occupy this unit');
    }
    unitIds = [unitId];
  } else {
    const occupancies = await prisma.occupancy.findMany({
      where: { tenantId },
      select: { unitId: true },
    });
    unitIds = occupancies.map((o) => o.unitId);
    if (unitIds.length === 0) {
      return [];
    }
  }

  const leases = await prisma.lease.findMany({
    where: {
      orgId,
      unitId: { in: unitIds },
      status: { in: TENANT_VISIBLE_STATUSES },
    },
    include: {
      unit: { include: { building: true } },
      signatureRequests: {
        where: { entityType: 'LEASE' },
        orderBy: { createdAt: 'desc' },
        take: 1,
      },
    },
    orderBy: { createdAt: 'desc' },
  });

  return leases.map((l) =>
    mapToTenantLeaseDTO(l, l.signatureRequests?.[0] || undefined),
  );
}

// ==========================================
// Get single lease for tenant
// ==========================================
export async function getTenantLease(
  leaseId: string,
  tenantId: string,
  orgId: string,
): Promise<TenantLeaseDTO | null> {
  const lease = await prisma.lease.findUnique({
    where: { id: leaseId },
    include: {
      unit: { include: { building: true } },
      signatureRequests: {
        where: { entityType: 'LEASE' },
        orderBy: { createdAt: 'desc' },
        take: 1,
      },
    },
  });

  if (!lease) return null;
  if (lease.orgId !== orgId) return null;
  if (!TENANT_VISIBLE_STATUSES.includes(lease.status)) return null;

  // Verify tenant occupies the lease's unit
  const occupancy = await prisma.occupancy.findFirst({
    where: { tenantId, unitId: lease.unitId },
  });
  if (!occupancy) return null;

  return mapToTenantLeaseDTO(lease, lease.signatureRequests?.[0] || undefined);
}

// ==========================================
// Tenant accepts/signs a lease (stub)
// ==========================================
export interface TenantAcceptResult {
  lease: TenantLeaseDTO;
  signatureRequest: {
    id: string;
    status: string;
    signedAt?: string;
  };
}

export async function tenantAcceptLease(
  leaseId: string,
  tenantId: string,
  orgId: string,
): Promise<TenantAcceptResult> {
  // Load lease
  const lease = await prisma.lease.findUnique({
    where: { id: leaseId },
    include: {
      unit: { include: { building: true } },
      signatureRequests: {
        where: { entityType: 'LEASE' },
        orderBy: { createdAt: 'desc' },
      },
    },
  });

  if (!lease) throw new Error('Lease not found');
  if (lease.orgId !== orgId) throw new Error('Lease not found');

  // Verify tenant occupies the lease's unit
  const occupancy = await prisma.occupancy.findFirst({
    where: { tenantId, unitId: lease.unitId },
  });
  if (!occupancy) throw new Error('Tenant does not occupy this unit');
  if (lease.status !== LeaseStatus.READY_TO_SIGN) {
    throw new Error('Only READY_TO_SIGN leases can be accepted');
  }

  // Find the active signature request (DRAFT or SENT)
  let sigReq = lease.signatureRequests.find(
    (sr) => sr.status === SignatureRequestStatus.SENT || sr.status === SignatureRequestStatus.DRAFT,
  );

  if (!sigReq) {
    throw new Error('No active signature request found for this lease');
  }

  // Mark signature request as SIGNED (stub — real e-sign would go through provider)
  const updatedSigReq = await prisma.signatureRequest.update({
    where: { id: sigReq.id },
    data: {
      status: SignatureRequestStatus.SIGNED,
      signedAt: new Date(),
    },
  });

  // Auto-activate: READY_TO_SIGN → SIGNED → ACTIVE in one step
  const updatedLease = await prisma.lease.update({
    where: { id: leaseId },
    data: {
      status: LeaseStatus.ACTIVE,
      activatedAt: new Date(),
    },
    include: {
      unit: { include: { building: true } },
      signatureRequests: {
        where: { entityType: 'LEASE' },
        orderBy: { createdAt: 'desc' },
        take: 1,
      },
    },
  });

  // Auto-generate first rent invoice
  try {
    const { createLeaseInvoice } = await import('./leases');
    const rentTotal = updatedLease.rentTotalChf || updatedLease.netRentChf || 0;
    if (rentTotal > 0) {
      await createLeaseInvoice(leaseId, orgId, {
        type: 'FIRST_RENT',
        amountChf: rentTotal,
      });
      console.log(`[LEASE] Auto-created first rent invoice for lease ${leaseId} — CHF ${rentTotal}`);
    }
  } catch (invoiceErr) {
    // Don't fail the signing if invoice creation has an issue
    console.error(`[LEASE] Failed to auto-create first rent invoice for lease ${leaseId}:`, invoiceErr);
  }

  // Mark the RentalOwnerSelection as SIGNED (removes from "Awaiting Signature" pipeline)
  try {
    const unitId = updatedLease.unitId;
    const sel = await prisma.rentalOwnerSelection.findFirst({
      where: { unitId, status: 'AWAITING_SIGNATURE' },
    });
    if (sel) {
      await prisma.rentalOwnerSelection.update({
        where: { id: sel.id },
        data: { status: 'SIGNED' },
      });
      console.log(`[LEASE] Updated selection ${sel.id} → SIGNED for unit ${unitId}`);
    }
  } catch (selErr) {
    console.error(`[LEASE] Failed to update selection status:`, selErr);
  }

  // Notify managers that the tenant has signed
  try {
    const { notifyManagerLeaseSigned } = await import('./notifications');
    const managers = await prisma.user.findMany({
      where: { orgId, role: 'MANAGER' },
      select: { id: true },
    });
    const unitNumber = updatedLease.unit?.unitNumber || 'unknown';
    const buildingId = updatedLease.unit?.building?.id;
    for (const mgr of managers) {
      await notifyManagerLeaseSigned(
        leaseId, orgId, mgr.id,
        updatedLease.tenantName, unitNumber, buildingId
      );
    }
  } catch (notifErr) {
    console.error(`[LEASE] Failed to notify managers of lease signing:`, notifErr);
  }

  // Notify owners that the tenant has signed
  try {
    const { notifyOwnerLeaseSigned } = await import('./notifications');
    const owners = await prisma.user.findMany({
      where: { orgId, role: 'OWNER' },
      select: { id: true },
    });
    const unitNumber = updatedLease.unit?.unitNumber || 'unknown';
    const buildingId = updatedLease.unit?.building?.id;
    for (const owner of owners) {
      await notifyOwnerLeaseSigned(
        leaseId, orgId, owner.id,
        updatedLease.tenantName, unitNumber, buildingId
      );
    }
  } catch (notifErr) {
    console.error(`[LEASE] Failed to notify owners of lease signing:`, notifErr);
  }

  return {
    lease: mapToTenantLeaseDTO(updatedLease, updatedLease.signatureRequests?.[0]),
    signatureRequest: {
      id: updatedSigReq.id,
      status: updatedSigReq.status,
      signedAt: updatedSigReq.signedAt ? updatedSigReq.signedAt.toISOString() : undefined,
    },
  };
}
