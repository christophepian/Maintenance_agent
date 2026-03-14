import { LeaseStatus } from '@prisma/client';
import prisma from './prismaClient';
import { CreateLeasePayload, UpdateLeasePayload } from '../validation/leases';
import { normalizePhoneToE164 } from '../utils/phoneNormalization';

/**
 * G9: Canonical include tree for Lease queries.
 * All Lease queries that feed mapLeaseToDTO MUST use this constant.
 * If LeaseDTO changes, update this include in the same PR.
 */
export const LEASE_INCLUDE = {
  unit: { include: { building: true } },
} as const;

// ==========================================
// DTOs
// ==========================================
export interface LeaseDTO {
  id: string;
  orgId: string;
  status: LeaseStatus;
  applicationId?: string;
  unitId: string;

  // Template fields
  isTemplate: boolean;
  templateName?: string;
  templateBuildingId?: string;

  // Parties
  landlordName: string;
  landlordAddress: string;
  landlordZipCity: string;
  landlordPhone?: string;
  landlordEmail?: string;
  landlordRepresentedBy?: string;

  tenantName: string;
  tenantAddress?: string;
  tenantZipCity?: string;
  tenantPhone?: string;
  tenantEmail?: string;
  coTenantName?: string;

  // Object
  objectType: string;
  roomsCount?: string;
  floor?: string;
  buildingAddressLines?: string[];
  usageFlags?: Record<string, boolean>;
  serviceSpaces?: Record<string, any>;
  commonInstallations?: Record<string, any>;

  // Dates
  startDate: string;
  isFixedTerm: boolean;
  endDate?: string;
  firstTerminationDate?: string;
  noticeRule: string;
  extendedNoticeText?: string;
  terminationDatesRule: string;
  terminationDatesCustomText?: string;

  // Rent & charges
  netRentChf: number;
  garageRentChf?: number;
  otherServiceRentChf?: number;
  chargesItems?: Array<{ label: string; mode: string; amountChf: number }>;
  chargesTotalChf?: number;
  rentTotalChf?: number;
  chargesSettlementDate?: string;

  paymentDueDayOfMonth?: number;
  paymentRecipient?: string;
  paymentInstitution?: string;
  paymentAccountNumber?: string;
  paymentIban?: string;
  referenceRatePercent?: string;
  referenceRateDate?: string;

  // Deposit
  depositChf?: number;
  depositDueRule: string;
  depositDueDate?: string;

  // Stipulations
  otherStipulations?: string;
  includesHouseRules: boolean;
  otherAnnexesText?: string;

  // Artifacts — draft PDF
  draftPdfStorageKey?: string;
  draftPdfSha256?: string;

  // Artifacts — signed PDF (final executed copy)
  signedPdfStorageKey?: string;
  signedPdfSha256?: string;

  // Deposit payment tracking
  depositPaidAt?: string;
  depositConfirmedBy?: string;
  depositBankRef?: string;

  // Activation & lifecycle
  activatedAt?: string;
  terminatedAt?: string;
  terminationReason?: string;
  terminationNotice?: string;
  archivedAt?: string;

  // Timestamps
  createdAt: string;
  updatedAt: string;

  // Nested
  unit?: {
    id: string;
    unitNumber: string;
    floor?: string;
    type: string;
    building: {
      id: string;
      name: string;
      address: string;
    };
  };
}

// ==========================================
// Mapper
// ==========================================
export function mapLeaseToDTO(lease: any): LeaseDTO {
  return {
    id: lease.id,
    orgId: lease.orgId,
    status: lease.status,
    applicationId: lease.applicationId || undefined,
    unitId: lease.unitId,

    isTemplate: lease.isTemplate || false,
    templateName: lease.templateName || undefined,
    templateBuildingId: lease.templateBuildingId || undefined,

    landlordName: lease.landlordName,
    landlordAddress: lease.landlordAddress,
    landlordZipCity: lease.landlordZipCity,
    landlordPhone: lease.landlordPhone || undefined,
    landlordEmail: lease.landlordEmail || undefined,
    landlordRepresentedBy: lease.landlordRepresentedBy || undefined,

    tenantName: lease.tenantName,
    tenantAddress: lease.tenantAddress || undefined,
    tenantZipCity: lease.tenantZipCity || undefined,
    tenantPhone: lease.tenantPhone || undefined,
    tenantEmail: lease.tenantEmail || undefined,
    coTenantName: lease.coTenantName || undefined,

    objectType: lease.objectType,
    roomsCount: lease.roomsCount || undefined,
    floor: lease.floor || undefined,
    buildingAddressLines: lease.buildingAddressLines || undefined,
    usageFlags: lease.usageFlags || undefined,
    serviceSpaces: lease.serviceSpaces || undefined,
    commonInstallations: lease.commonInstallations || undefined,

    startDate: lease.startDate.toISOString(),
    isFixedTerm: lease.isFixedTerm,
    endDate: lease.endDate ? lease.endDate.toISOString() : undefined,
    firstTerminationDate: lease.firstTerminationDate ? lease.firstTerminationDate.toISOString() : undefined,
    noticeRule: lease.noticeRule,
    extendedNoticeText: lease.extendedNoticeText || undefined,
    terminationDatesRule: lease.terminationDatesRule,
    terminationDatesCustomText: lease.terminationDatesCustomText || undefined,

    netRentChf: lease.netRentChf,
    garageRentChf: lease.garageRentChf ?? undefined,
    otherServiceRentChf: lease.otherServiceRentChf ?? undefined,
    chargesItems: lease.chargesItems || undefined,
    chargesTotalChf: lease.chargesTotalChf ?? undefined,
    rentTotalChf: lease.rentTotalChf ?? undefined,
    chargesSettlementDate: lease.chargesSettlementDate || undefined,

    paymentDueDayOfMonth: lease.paymentDueDayOfMonth ?? undefined,
    paymentRecipient: lease.paymentRecipient || undefined,
    paymentInstitution: lease.paymentInstitution || undefined,
    paymentAccountNumber: lease.paymentAccountNumber || undefined,
    paymentIban: lease.paymentIban || undefined,
    referenceRatePercent: lease.referenceRatePercent || undefined,
    referenceRateDate: lease.referenceRateDate || undefined,

    depositChf: lease.depositChf ?? undefined,
    depositDueRule: lease.depositDueRule,
    depositDueDate: lease.depositDueDate ? lease.depositDueDate.toISOString() : undefined,

    otherStipulations: lease.otherStipulations || undefined,
    includesHouseRules: lease.includesHouseRules,
    otherAnnexesText: lease.otherAnnexesText || undefined,

    draftPdfStorageKey: lease.draftPdfStorageKey || undefined,
    draftPdfSha256: lease.draftPdfSha256 || undefined,

    signedPdfStorageKey: lease.signedPdfStorageKey || undefined,
    signedPdfSha256: lease.signedPdfSha256 || undefined,

    depositPaidAt: lease.depositPaidAt ? lease.depositPaidAt.toISOString() : undefined,
    depositConfirmedBy: lease.depositConfirmedBy || undefined,
    depositBankRef: lease.depositBankRef || undefined,

    activatedAt: lease.activatedAt ? lease.activatedAt.toISOString() : undefined,
    terminatedAt: lease.terminatedAt ? lease.terminatedAt.toISOString() : undefined,
    terminationReason: lease.terminationReason || undefined,
    terminationNotice: lease.terminationNotice || undefined,
    archivedAt: lease.archivedAt ? lease.archivedAt.toISOString() : undefined,

    createdAt: lease.createdAt.toISOString(),
    updatedAt: lease.updatedAt.toISOString(),

    unit: lease.unit ? {
      id: lease.unit.id,
      unitNumber: lease.unit.unitNumber,
      floor: lease.unit.floor || undefined,
      type: lease.unit.type,
      building: lease.unit.building ? {
        id: lease.unit.building.id,
        name: lease.unit.building.name,
        address: lease.unit.building.address,
      } : undefined,
    } : undefined,
  };
}

// ==========================================
// Compute total rent
// ==========================================
function computeRentTotal(
  netRentChf: number,
  garageRentChf?: number | null,
  otherServiceRentChf?: number | null,
  chargesTotalChf?: number | null,
): number {
  return netRentChf
    + (garageRentChf || 0)
    + (otherServiceRentChf || 0)
    + (chargesTotalChf || 0);
}

// ==========================================
// Create lease from unit + tenant info
// ==========================================
export async function createLease(orgId: string, payload: CreateLeasePayload): Promise<LeaseDTO> {
  // Load unit + building for auto-fill
  const unit = await prisma.unit.findUnique({
    where: { id: payload.unitId },
    include: { building: true },
  });

  if (!unit) throw new Error(`Unit not found: ${payload.unitId}`);
  if (unit.orgId !== orgId) throw new Error('Unit does not belong to this org');

  // Load org config for landlord defaults
  const orgConfig = await prisma.orgConfig.findUnique({
    where: { orgId },
  });

  // Compute landlord party (payload overrides → org config → placeholders)
  const landlordName = payload.landlordName || orgConfig?.landlordName || 'À compléter';
  const landlordAddress = payload.landlordAddress || orgConfig?.landlordAddress || '';
  const landlordZipCity = payload.landlordZipCity || orgConfig?.landlordZipCity || '';
  const landlordPhone = payload.landlordPhone || orgConfig?.landlordPhone || undefined;
  const landlordEmail = payload.landlordEmail || orgConfig?.landlordEmail || undefined;
  const landlordRepresentedBy = payload.landlordRepresentedBy || orgConfig?.landlordRepresentedBy || undefined;

  // Compute charges total from line items if not provided
  let chargesTotalChf = payload.chargesTotalChf ?? null;
  if (chargesTotalChf === null && payload.chargesItems?.length) {
    chargesTotalChf = payload.chargesItems.reduce((sum, item) => sum + item.amountChf, 0);
  }

  // Compute rent total
  const rentTotalChf = computeRentTotal(
    payload.netRentChf,
    payload.garageRentChf,
    payload.otherServiceRentChf,
    chargesTotalChf,
  );

  const lease = await prisma.lease.create({
    data: {
      orgId,
      unitId: payload.unitId,
      status: LeaseStatus.DRAFT,

      // Landlord
      landlordName,
      landlordAddress,
      landlordZipCity,
      landlordPhone: landlordPhone || null,
      landlordEmail: landlordEmail || null,
      landlordRepresentedBy: landlordRepresentedBy || null,

      // Tenant
      tenantName: payload.tenantName,
      tenantAddress: payload.tenantAddress || null,
      tenantZipCity: payload.tenantZipCity || null,
      tenantPhone: payload.tenantPhone || null,
      tenantEmail: payload.tenantEmail || null,
      coTenantName: payload.coTenantName || null,

      // Object (auto-fill from unit + building)
      objectType: payload.objectType || 'APPARTEMENT',
      roomsCount: payload.roomsCount || null,
      floor: payload.floor || unit.floor || null,
      buildingAddressLines: [unit.building.address],
      usageFlags: payload.usageFlags || null,
      serviceSpaces: payload.serviceSpaces || null,
      commonInstallations: payload.commonInstallations || null,

      // Dates
      startDate: new Date(payload.startDate),
      isFixedTerm: payload.isFixedTerm || false,
      endDate: payload.endDate ? new Date(payload.endDate) : null,
      firstTerminationDate: payload.firstTerminationDate ? new Date(payload.firstTerminationDate) : null,
      noticeRule: payload.noticeRule || '3_MONTHS',
      extendedNoticeText: payload.extendedNoticeText || null,
      terminationDatesRule: payload.terminationDatesRule || 'END_OF_MONTH_EXCEPT_31_12',
      terminationDatesCustomText: payload.terminationDatesCustomText || null,

      // Rent & charges
      netRentChf: payload.netRentChf,
      garageRentChf: payload.garageRentChf ?? null,
      otherServiceRentChf: payload.otherServiceRentChf ?? null,
      chargesItems: payload.chargesItems || null,
      chargesTotalChf,
      rentTotalChf,
      chargesSettlementDate: payload.chargesSettlementDate || null,

      paymentDueDayOfMonth: payload.paymentDueDayOfMonth || null,
      paymentRecipient: payload.paymentRecipient || null,
      paymentInstitution: payload.paymentInstitution || null,
      paymentAccountNumber: payload.paymentAccountNumber || null,
      paymentIban: payload.paymentIban || null,
      referenceRatePercent: payload.referenceRatePercent || null,
      referenceRateDate: payload.referenceRateDate || null,

      // Deposit
      depositChf: payload.depositChf ?? null,
      depositDueRule: payload.depositDueRule || 'AT_SIGNATURE',
      depositDueDate: payload.depositDueDate ? new Date(payload.depositDueDate) : null,

      // Stipulations
      otherStipulations: payload.otherStipulations || null,
      includesHouseRules: payload.includesHouseRules || false,
      otherAnnexesText: payload.otherAnnexesText || null,
    },
    include: LEASE_INCLUDE,
  });

  return mapLeaseToDTO(lease);
}

// ==========================================
// List leases
// ==========================================
export interface ListLeasesFilter {
  status?: string;
  unitId?: string;
  applicationId?: string;
  limit?: number;
  offset?: number;
}

export async function listLeases(orgId: string, filter: ListLeasesFilter = {}): Promise<{ data: LeaseDTO[]; total: number }> {
  const where: any = { orgId, isTemplate: false };
  if (filter.status) where.status = filter.status;
  if (filter.unitId) where.unitId = filter.unitId;
  if (filter.applicationId) where.applicationId = filter.applicationId;

  const [leases, total] = await Promise.all([
    prisma.lease.findMany({
      where,
      include: LEASE_INCLUDE,
      orderBy: { createdAt: 'desc' },
      take: filter.limit || 50,
      skip: filter.offset || 0,
    }),
    prisma.lease.count({ where }),
  ]);

  return { data: leases.map(mapLeaseToDTO), total };
}

// ==========================================
// Get single lease
// ==========================================
export async function getLease(id: string, orgId: string): Promise<LeaseDTO | null> {
  const lease = await prisma.lease.findUnique({
    where: { id },
    include: LEASE_INCLUDE,
  });

  if (!lease || lease.orgId !== orgId) return null;
  return mapLeaseToDTO(lease);
}

// ==========================================
// Update lease (editable fields only)
// ==========================================
export async function updateLease(id: string, orgId: string, payload: UpdateLeasePayload): Promise<LeaseDTO> {
  const existing = await prisma.lease.findUnique({ where: { id } });
  if (!existing || existing.orgId !== orgId) throw new Error('Lease not found');
  // Templates are always editable; regular leases must be DRAFT
  if (!existing.isTemplate && existing.status !== LeaseStatus.DRAFT) throw new Error('Only DRAFT leases can be edited');

  const data: any = {};

  // Copy provided fields
  const fields = [
    'tenantName', 'tenantAddress', 'tenantZipCity', 'tenantPhone', 'tenantEmail', 'coTenantName',
    'landlordName', 'landlordAddress', 'landlordZipCity', 'landlordPhone', 'landlordEmail', 'landlordRepresentedBy',
    'objectType', 'roomsCount', 'floor', 'usageFlags', 'serviceSpaces', 'commonInstallations',
    'isFixedTerm', 'noticeRule', 'extendedNoticeText', 'terminationDatesRule', 'terminationDatesCustomText',
    'netRentChf', 'garageRentChf', 'otherServiceRentChf', 'chargesItems', 'chargesTotalChf',
    'chargesSettlementDate',
    'paymentDueDayOfMonth', 'paymentRecipient', 'paymentInstitution', 'paymentAccountNumber', 'paymentIban',
    'referenceRatePercent', 'referenceRateDate',
    'depositChf', 'depositDueRule',
    'otherStipulations', 'includesHouseRules', 'otherAnnexesText',
  ];

  for (const f of fields) {
    if ((payload as any)[f] !== undefined) {
      data[f] = (payload as any)[f];
    }
  }

  // Handle date fields
  if (payload.startDate !== undefined) data.startDate = new Date(payload.startDate);
  if (payload.endDate !== undefined) data.endDate = payload.endDate ? new Date(payload.endDate) : null;
  if (payload.firstTerminationDate !== undefined) data.firstTerminationDate = payload.firstTerminationDate ? new Date(payload.firstTerminationDate) : null;
  if (payload.depositDueDate !== undefined) data.depositDueDate = payload.depositDueDate ? new Date(payload.depositDueDate) : null;

  // Recompute rent total if any component changed
  const netRent = data.netRentChf ?? existing.netRentChf;
  const garage = data.garageRentChf !== undefined ? data.garageRentChf : existing.garageRentChf;
  const other = data.otherServiceRentChf !== undefined ? data.otherServiceRentChf : existing.otherServiceRentChf;
  const charges = data.chargesTotalChf !== undefined ? data.chargesTotalChf : existing.chargesTotalChf;
  data.rentTotalChf = computeRentTotal(netRent, garage, other, charges);

  // If this is a template, always ensure it stays DRAFT
  if (existing.isTemplate && existing.status !== LeaseStatus.DRAFT) {
    data.status = LeaseStatus.DRAFT;
  }

  const updated = await prisma.lease.update({
    where: { id },
    data,
    include: LEASE_INCLUDE,
  });

  return mapLeaseToDTO(updated);
}

// ==========================================
// Mark lease as READY_TO_SIGN
// ==========================================
export async function markLeaseReadyToSign(
  id: string,
  orgId: string,
): Promise<LeaseDTO> {
  const existing = await prisma.lease.findUnique({ where: { id } });
  if (!existing || existing.orgId !== orgId) throw new Error('Lease not found');
  if (existing.isTemplate) throw new Error('Cannot change status of a template');
  if (existing.status !== LeaseStatus.DRAFT) throw new Error('Only DRAFT leases can be marked ready to sign');

  // Validate required fields
  if (!existing.tenantName) throw new Error('Tenant name is required');
  if (!existing.netRentChf && existing.netRentChf !== 0) throw new Error('Net rent is required');
  if (!existing.startDate) throw new Error('Start date is required');
  if (!existing.tenantPhone) throw new Error('Tenant phone is required before sending for signature (needed for tenant portal login)');

  // Auto-provision Tenant record + Occupancy so the tenant can log in and see the lease
  await ensureTenantAndOccupancy(existing);

  const updated = await prisma.lease.update({
    where: { id },
    data: { status: LeaseStatus.READY_TO_SIGN },
    include: LEASE_INCLUDE,
  });

  return mapLeaseToDTO(updated);
}

// ==========================================
// Auto-provision Tenant + Occupancy from lease data
// ==========================================
async function ensureTenantAndOccupancy(lease: {
  orgId: string;
  unitId: string;
  tenantName: string;
  tenantPhone: string | null;
  tenantEmail: string | null;
}): Promise<string> {
  const normalizedPhone = normalizePhoneToE164(lease.tenantPhone || '');
  if (!normalizedPhone) throw new Error('Invalid tenant phone number format');

  // Find or create Tenant by (orgId, phone)
  let tenant = await prisma.tenant.findUnique({
    where: { orgId_phone: { orgId: lease.orgId, phone: normalizedPhone } },
  });

  if (!tenant) {
    tenant = await prisma.tenant.create({
      data: {
        orgId: lease.orgId,
        phone: normalizedPhone,
        name: lease.tenantName,
        email: lease.tenantEmail || null,
      },
    });
    console.log(`[LEASE] Auto-created Tenant ${tenant.id} (${lease.tenantName}, ${normalizedPhone})`);
  } else {
    // Update name/email if they changed on the lease
    const updates: any = {};
    if (lease.tenantName && lease.tenantName !== tenant.name) updates.name = lease.tenantName;
    if (lease.tenantEmail && lease.tenantEmail !== tenant.email) updates.email = lease.tenantEmail;
    if (Object.keys(updates).length > 0) {
      await prisma.tenant.update({ where: { id: tenant.id }, data: updates });
    }
  }

  // Find or create Occupancy linking tenant → unit
  const existingOccupancy = await prisma.occupancy.findFirst({
    where: { tenantId: tenant.id, unitId: lease.unitId },
  });

  if (!existingOccupancy) {
    await prisma.occupancy.create({
      data: { tenantId: tenant.id, unitId: lease.unitId },
    });
    console.log(`[LEASE] Auto-created Occupancy for Tenant ${tenant.id} → Unit ${lease.unitId}`);
  }

  return tenant.id;
}

// ==========================================
// Cancel lease
// ==========================================
export async function cancelLease(id: string, orgId: string): Promise<LeaseDTO> {
  const existing = await prisma.lease.findUnique({ where: { id } });
  if (!existing || existing.orgId !== orgId) throw new Error('Lease not found');
  if (existing.isTemplate) throw new Error('Cannot change status of a template');
  if (existing.status === LeaseStatus.SIGNED || existing.status === LeaseStatus.ACTIVE) {
    throw new Error('Cannot cancel a signed or active lease');
  }

  const updated = await prisma.lease.update({
    where: { id },
    data: { status: LeaseStatus.CANCELLED },
    include: LEASE_INCLUDE,
  });

  return mapLeaseToDTO(updated);
}

// ==========================================
// Store PDF reference on lease
// ==========================================
export async function storeLeasePdfReference(
  id: string,
  orgId: string,
  storageKey: string,
  sha256: string,
): Promise<LeaseDTO> {
  const existing = await prisma.lease.findUnique({ where: { id } });
  if (!existing || existing.orgId !== orgId) throw new Error('Lease not found');

  const updated = await prisma.lease.update({
    where: { id },
    data: {
      draftPdfStorageKey: storageKey,
      draftPdfSha256: sha256,
    },
    include: LEASE_INCLUDE,
  });

  return mapLeaseToDTO(updated);
}

// ==========================================
// Phase 5: Store SIGNED PDF reference
// ==========================================
export async function storeSignedPdfReference(
  id: string,
  orgId: string,
  storageKey: string,
  sha256: string,
): Promise<LeaseDTO> {
  const existing = await prisma.lease.findUnique({ where: { id } });
  if (!existing || existing.orgId !== orgId) throw new Error('Lease not found');
  if (existing.status !== LeaseStatus.SIGNED && existing.status !== LeaseStatus.ACTIVE) {
    throw new Error('Only SIGNED or ACTIVE leases can store a signed PDF');
  }

  const updated = await prisma.lease.update({
    where: { id },
    data: {
      signedPdfStorageKey: storageKey,
      signedPdfSha256: sha256,
    },
    include: LEASE_INCLUDE,
  });

  return mapLeaseToDTO(updated);
}

// ==========================================
// Phase 5: Confirm deposit payment
// ==========================================
export interface ConfirmDepositPayload {
  confirmedBy?: string;
  bankRef?: string;
}

export async function confirmDeposit(
  id: string,
  orgId: string,
  payload: ConfirmDepositPayload,
): Promise<LeaseDTO> {
  const existing = await prisma.lease.findUnique({ where: { id } });
  if (!existing || existing.orgId !== orgId) throw new Error('Lease not found');
  if (existing.depositPaidAt) throw new Error('Deposit already confirmed');

  const updated = await prisma.lease.update({
    where: { id },
    data: {
      depositPaidAt: new Date(),
      depositConfirmedBy: payload.confirmedBy || null,
      depositBankRef: payload.bankRef || null,
    },
    include: LEASE_INCLUDE,
  });

  return mapLeaseToDTO(updated);
}

// ==========================================
// Phase 5: Activate lease (SIGNED → ACTIVE)
// ==========================================
export async function activateLease(id: string, orgId: string): Promise<LeaseDTO> {
  const existing = await prisma.lease.findUnique({ where: { id } });
  if (!existing || existing.orgId !== orgId) throw new Error('Lease not found');
  if (existing.status !== LeaseStatus.SIGNED) {
    throw new Error('Only SIGNED leases can be activated');
  }

  const updated = await prisma.lease.update({
    where: { id },
    data: {
      status: LeaseStatus.ACTIVE,
      activatedAt: new Date(),
    },
    include: LEASE_INCLUDE,
  });

  return mapLeaseToDTO(updated);
}

// ==========================================
// Phase 5: Terminate lease (ACTIVE → TERMINATED)
// ==========================================
export interface TerminateLeasePayload {
  reason: string;   // MUTUAL | TENANT_NOTICE | LANDLORD_NOTICE | END_OF_TERM | OTHER
  notice?: string;  // free-text notes
}

export async function terminateLease(
  id: string,
  orgId: string,
  payload: TerminateLeasePayload,
): Promise<LeaseDTO> {
  const existing = await prisma.lease.findUnique({ where: { id } });
  if (!existing || existing.orgId !== orgId) throw new Error('Lease not found');
  if (existing.status !== LeaseStatus.ACTIVE) {
    throw new Error('Only ACTIVE leases can be terminated');
  }

  const updated = await prisma.lease.update({
    where: { id },
    data: {
      status: LeaseStatus.TERMINATED,
      terminatedAt: new Date(),
      terminationReason: payload.reason,
      terminationNotice: payload.notice || null,
    },
    include: LEASE_INCLUDE,
  });

  return mapLeaseToDTO(updated);
}

// ==========================================
// Phase 5: Archive lease (set archivedAt)
// ==========================================
export async function archiveLease(id: string, orgId: string): Promise<LeaseDTO> {
  const existing = await prisma.lease.findUnique({ where: { id } });
  if (!existing || existing.orgId !== orgId) throw new Error('Lease not found');
  if (existing.status !== LeaseStatus.SIGNED &&
      existing.status !== LeaseStatus.ACTIVE &&
      existing.status !== LeaseStatus.TERMINATED &&
      existing.status !== LeaseStatus.CANCELLED) {
    throw new Error('Only SIGNED, ACTIVE, TERMINATED or CANCELLED leases can be archived');
  }
  if (existing.archivedAt) throw new Error('Lease is already archived');

  const updated = await prisma.lease.update({
    where: { id },
    data: { archivedAt: new Date() },
    include: LEASE_INCLUDE,
  });

  return mapLeaseToDTO(updated);
}

// ==========================================
// Phase 5: Create invoice linked to lease
// ==========================================
export interface CreateLeaseInvoicePayload {
  type: 'DEPOSIT' | 'FIRST_RENT' | 'RENT' | 'OTHER';
  description?: string;
  amountChf: number;  // in whole CHF (will be stored as cents)
}

export async function createLeaseInvoice(
  leaseId: string,
  orgId: string,
  payload: CreateLeaseInvoicePayload,
): Promise<any> {
  const lease = await prisma.lease.findUnique({
    where: { id: leaseId },
    include: LEASE_INCLUDE,
  });
  if (!lease || lease.orgId !== orgId) throw new Error('Lease not found');

  // Build description from type
  const descriptions: Record<string, string> = {
    DEPOSIT: `Dépôt de garantie — ${lease.tenantName}`,
    FIRST_RENT: `Premier loyer — ${lease.tenantName}`,
    RENT: `Loyer mensuel — ${lease.tenantName}`,
    OTHER: payload.description || `Facture bail — ${lease.tenantName}`,
  };

  const description = payload.description || descriptions[payload.type] || 'Facture bail';
  const amountCents = Math.round(payload.amountChf * 100);

  // Lease invoices need a jobId (Invoice schema requires it).
  // Use or create a system "Lease Admin" job.
  // Tag the admin Request via contractorNotes since Job has no description field
  // and Request has no orgId field.
  let adminJob = await prisma.job.findFirst({
    where: { orgId, request: { contractorNotes: '__LEASE_ADMIN__' } },
  });

  if (!adminJob) {
    // Need a contractor for the Job (contractorId is required)
    let adminContractor = await prisma.contractor.findFirst({
      where: { orgId },
      orderBy: { createdAt: 'asc' },
    });

    if (!adminContractor) {
      adminContractor = await prisma.contractor.create({
        data: {
          orgId,
          name: 'System Admin',
          phone: '+41000000000',
          email: 'admin@system.local',
          serviceCategories: '[]',
        },
      });
    }

    const adminRequest = await prisma.request.create({
      data: {
        description: 'System: Lease Administration',
        category: 'other',
        status: 'AUTO_APPROVED',
        contractorNotes: '__LEASE_ADMIN__',
      },
    });

    adminJob = await prisma.job.create({
      data: {
        orgId,
        requestId: adminRequest.id,
        contractorId: adminContractor.id,
        status: 'COMPLETED',
      },
    });
  }

  const invoice = await prisma.invoice.create({
    data: {
      orgId,
      jobId: adminJob.id,
      leaseId,
      recipientName: lease.tenantName,
      recipientAddressLine1: lease.tenantAddress || '',
      recipientPostalCode: lease.tenantZipCity?.split(' ')[0] || '',
      recipientCity: lease.tenantZipCity?.split(' ').slice(1).join(' ') || '',
      recipientCountry: 'CH',
      description,
      subtotalAmount: amountCents,
      vatAmount: 0,
      totalAmount: amountCents,
      amount: Math.round(payload.amountChf),  // legacy field (CHF)
      currency: 'CHF',
      vatRate: 0,  // no VAT on rent in Switzerland
      status: 'DRAFT',
      iban: lease.paymentIban || null,
    },
  });

  return {
    id: invoice.id,
    leaseId: invoice.leaseId,
    description: invoice.description,
    totalAmount: invoice.totalAmount,
    totalAmountChf: invoice.totalAmount / 100,
    currency: invoice.currency,
    status: invoice.status,
    createdAt: invoice.createdAt.toISOString(),
  };
}

// ==========================================
// Phase 5: List invoices for a lease
// ==========================================
export async function listLeaseInvoices(leaseId: string, orgId: string): Promise<any[]> {
  const lease = await prisma.lease.findUnique({ where: { id: leaseId } });
  if (!lease || lease.orgId !== orgId) throw new Error('Lease not found');

  const invoices = await prisma.invoice.findMany({
    where: { leaseId, orgId },
    orderBy: { createdAt: 'desc' },
  });

  return invoices.map(inv => ({
    id: inv.id,
    leaseId: inv.leaseId,
    description: inv.description,
    totalAmount: inv.totalAmount,
    totalAmountChf: inv.totalAmount / 100,
    currency: inv.currency,
    status: inv.status,
    invoiceNumber: inv.invoiceNumber,
    issueDate: inv.issueDate?.toISOString() || undefined,
    dueDate: inv.dueDate?.toISOString() || undefined,
    paidAt: inv.paidAt?.toISOString() || undefined,
    createdAt: inv.createdAt.toISOString(),
  }));
}

// ==========================================
// Lease Templates (Rental Application Pipeline)
// ==========================================

/**
 * List lease templates for a building.
 * Templates are leases with isTemplate=true that can be cloned
 * when creating a new lease from a rental application.
 * Soft-deleted templates (deletedAt != null) are excluded.
 */
export async function listLeaseTemplates(
  orgId: string,
  buildingId?: string,
): Promise<LeaseDTO[]> {
  const where: any = { orgId, isTemplate: true, deletedAt: null };
  if (buildingId) where.templateBuildingId = buildingId;

  const templates = await prisma.lease.findMany({
    where,
    include: LEASE_INCLUDE,
    orderBy: { createdAt: 'desc' },
  });

  return templates.map(mapLeaseToDTO);
}

/**
 * Soft-delete a lease template.
 * Only templates (isTemplate=true) can be deleted.
 * Sets deletedAt timestamp instead of removing the record,
 * allowing undo within a grace period.
 */
export async function deleteLeaseTemplate(
  templateId: string,
  orgId: string,
): Promise<void> {
  const template = await prisma.lease.findUnique({ where: { id: templateId } });
  if (!template || template.orgId !== orgId) throw new Error('Template not found');
  if (!template.isTemplate) throw new Error('Lease is not a template — cannot delete');

  await prisma.lease.update({
    where: { id: templateId },
    data: { deletedAt: new Date() },
  });
}

/**
 * Restore a soft-deleted lease template (undo delete).
 * Clears the deletedAt timestamp.
 */
export async function restoreLeaseTemplate(
  templateId: string,
  orgId: string,
): Promise<void> {
  const template = await prisma.lease.findUnique({ where: { id: templateId } });
  if (!template || template.orgId !== orgId) throw new Error('Template not found');
  if (!template.isTemplate) throw new Error('Lease is not a template');
  if (!template.deletedAt) throw new Error('Template is not deleted');

  await prisma.lease.update({
    where: { id: templateId },
    data: { deletedAt: null },
  });
}

/**
 * Create a lease template from an existing lease.
 * Copies all contract terms but marks it as a reusable template.
 */
export async function createLeaseTemplateFromLease(
  leaseId: string,
  orgId: string,
  templateName: string,
  buildingId?: string,
): Promise<LeaseDTO> {
  const source = await prisma.lease.findUnique({
    where: { id: leaseId },
    include: LEASE_INCLUDE,
  });
  if (!source || source.orgId !== orgId) throw new Error('Source lease not found');

  const template = await prisma.lease.create({
    data: {
      orgId,
      unitId: source.unitId,
      isTemplate: true,
      templateBuildingId: buildingId || source.unit?.buildingId || null,
      templateName,
      status: 'DRAFT' as LeaseStatus,

      // Copy all contract terms from source
      landlordName: source.landlordName,
      landlordAddress: source.landlordAddress,
      landlordZipCity: source.landlordZipCity,
      landlordPhone: source.landlordPhone,
      landlordEmail: source.landlordEmail,
      landlordRepresentedBy: source.landlordRepresentedBy,

      tenantName: 'TEMPLATE — will be replaced',
      tenantAddress: null,
      tenantZipCity: null,
      tenantPhone: null,
      tenantEmail: null,
      coTenantName: null,

      objectType: source.objectType,
      roomsCount: source.roomsCount,
      floor: source.floor,
      buildingAddressLines: source.buildingAddressLines as any,
      usageFlags: source.usageFlags as any,
      serviceSpaces: source.serviceSpaces as any,
      commonInstallations: source.commonInstallations as any,

      startDate: source.startDate,
      isFixedTerm: source.isFixedTerm,
      endDate: source.endDate,
      firstTerminationDate: source.firstTerminationDate,
      noticeRule: source.noticeRule,
      extendedNoticeText: source.extendedNoticeText,
      terminationDatesRule: source.terminationDatesRule,
      terminationDatesCustomText: source.terminationDatesCustomText,

      netRentChf: source.netRentChf,
      garageRentChf: source.garageRentChf,
      otherServiceRentChf: source.otherServiceRentChf,
      chargesItems: source.chargesItems as any,
      chargesTotalChf: source.chargesTotalChf,
      rentTotalChf: source.rentTotalChf,
      chargesSettlementDate: source.chargesSettlementDate,

      paymentDueDayOfMonth: source.paymentDueDayOfMonth,
      paymentRecipient: source.paymentRecipient,
      paymentInstitution: source.paymentInstitution,
      paymentAccountNumber: source.paymentAccountNumber,
      paymentIban: source.paymentIban,
      referenceRatePercent: source.referenceRatePercent,
      referenceRateDate: source.referenceRateDate,

      depositChf: source.depositChf,
      depositDueRule: source.depositDueRule,
      depositDueDate: source.depositDueDate,

      otherStipulations: source.otherStipulations,
      includesHouseRules: source.includesHouseRules,
      otherAnnexesText: source.otherAnnexesText,
    },
    include: LEASE_INCLUDE,
  });

  return mapLeaseToDTO(template);
}

/**
 * Create a blank lease template from scratch (no source lease needed).
 * Requires a buildingId so we can pick a placeholder unitId.
 */
export async function createBlankLeaseTemplate(
  orgId: string,
  buildingId: string,
  data: {
    templateName: string;
    landlordName: string;
    landlordAddress: string;
    landlordZipCity: string;
    landlordPhone?: string;
    landlordEmail?: string;
    objectType?: string;
    roomsCount?: string;
    noticeRule?: string;
    paymentDueDayOfMonth?: number;
    paymentIban?: string;
    referenceRatePercent?: string;
    depositDueRule?: string;
    netRentChf?: number;
    chargesTotalChf?: number;
    includesHouseRules?: boolean;
  },
): Promise<LeaseDTO> {
  // Verify building belongs to org
  const building = await prisma.building.findUnique({ where: { id: buildingId } });
  if (!building || building.orgId !== orgId) throw new Error('Building not found');

  // Pick the first unit from the building as a placeholder for the template
  const unit = await prisma.unit.findFirst({
    where: { buildingId, orgId },
    orderBy: { unitNumber: 'asc' },
  });
  if (!unit) throw new Error('Building has no units — create at least one unit first');

  const template = await prisma.lease.create({
    data: {
      orgId,
      unitId: unit.id,
      isTemplate: true,
      templateBuildingId: buildingId,
      templateName: data.templateName,
      status: 'DRAFT' as LeaseStatus,

      landlordName: data.landlordName,
      landlordAddress: data.landlordAddress,
      landlordZipCity: data.landlordZipCity,
      landlordPhone: data.landlordPhone || null,
      landlordEmail: data.landlordEmail || null,

      tenantName: 'TEMPLATE — will be replaced',

      objectType: data.objectType || 'APPARTEMENT',
      roomsCount: data.roomsCount || null,
      buildingAddressLines: [building.address],

      startDate: new Date('2026-05-01'),
      isFixedTerm: false,
      noticeRule: data.noticeRule || '3_MONTHS',
      terminationDatesRule: 'END_OF_MONTH_EXCEPT_31_12',

      netRentChf: data.netRentChf ?? 0,
      chargesTotalChf: data.chargesTotalChf ?? null,
      rentTotalChf: computeRentTotal(data.netRentChf ?? 0, null, null, data.chargesTotalChf ?? null),

      paymentDueDayOfMonth: data.paymentDueDayOfMonth ?? 1,
      paymentIban: data.paymentIban || null,
      referenceRatePercent: data.referenceRatePercent || null,

      depositDueRule: data.depositDueRule || 'AT_SIGNATURE',
      includesHouseRules: data.includesHouseRules ?? true,
    },
    include: LEASE_INCLUDE,
  });

  return mapLeaseToDTO(template);
}

/**
 * Create a new lease from a template, filling in tenant details
 * from a rental application.
 *
 * Used when owner selects a tenant through the rental pipeline.
 */
export async function createLeaseFromTemplate(
  templateId: string,
  orgId: string,
  unitId: string,
  tenantInfo: {
    tenantName: string;
    tenantAddress?: string;
    tenantZipCity?: string;
    tenantPhone?: string;
    tenantEmail?: string;
    coTenantName?: string;
    applicationId?: string;
    startDate?: string;
    netRentChf?: number;
  },
): Promise<LeaseDTO> {
  const template = await prisma.lease.findUnique({
    where: { id: templateId },
    include: LEASE_INCLUDE,
  });
  if (!template || template.orgId !== orgId) throw new Error('Template not found');
  if (!template.isTemplate) throw new Error('Lease is not a template');

  // Look up unit + building for address auto-fill
  const unit = await prisma.unit.findUnique({
    where: { id: unitId },
    include: { building: true },
  });
  if (!unit) throw new Error('Unit not found');

  const lease = await prisma.lease.create({
    data: {
      orgId,
      unitId,
      applicationId: tenantInfo.applicationId || null,
      isTemplate: false,
      status: 'DRAFT' as LeaseStatus,

      // Landlord from template
      landlordName: template.landlordName,
      landlordAddress: template.landlordAddress,
      landlordZipCity: template.landlordZipCity,
      landlordPhone: template.landlordPhone,
      landlordEmail: template.landlordEmail,
      landlordRepresentedBy: template.landlordRepresentedBy,

      // Tenant from application
      tenantName: tenantInfo.tenantName,
      tenantAddress: tenantInfo.tenantAddress || null,
      tenantZipCity: tenantInfo.tenantZipCity || null,
      tenantPhone: tenantInfo.tenantPhone || null,
      tenantEmail: tenantInfo.tenantEmail || null,
      coTenantName: tenantInfo.coTenantName || null,

      // Object from unit
      objectType: template.objectType,
      roomsCount: template.roomsCount,
      floor: unit.floor || template.floor,
      buildingAddressLines: [unit.building.address],
      usageFlags: template.usageFlags as any,
      serviceSpaces: template.serviceSpaces as any,
      commonInstallations: template.commonInstallations as any,

      // Dates — override start date if provided
      startDate: tenantInfo.startDate ? new Date(tenantInfo.startDate) : template.startDate,
      isFixedTerm: template.isFixedTerm,
      endDate: template.endDate,
      firstTerminationDate: template.firstTerminationDate,
      noticeRule: template.noticeRule,
      extendedNoticeText: template.extendedNoticeText,
      terminationDatesRule: template.terminationDatesRule,
      terminationDatesCustomText: template.terminationDatesCustomText,

      // Rent — override if unit has specific rent, else use template
      netRentChf: tenantInfo.netRentChf ?? unit.monthlyRentChf ?? template.netRentChf,
      garageRentChf: template.garageRentChf,
      otherServiceRentChf: template.otherServiceRentChf,
      chargesItems: template.chargesItems as any,
      chargesTotalChf: unit.monthlyChargesChf ?? template.chargesTotalChf,
      rentTotalChf: computeRentTotal(
        tenantInfo.netRentChf ?? unit.monthlyRentChf ?? template.netRentChf,
        template.garageRentChf,
        template.otherServiceRentChf,
        unit.monthlyChargesChf ?? template.chargesTotalChf,
      ),
      chargesSettlementDate: template.chargesSettlementDate,

      paymentDueDayOfMonth: template.paymentDueDayOfMonth,
      paymentRecipient: template.paymentRecipient,
      paymentInstitution: template.paymentInstitution,
      paymentAccountNumber: template.paymentAccountNumber,
      paymentIban: template.paymentIban,
      referenceRatePercent: template.referenceRatePercent,
      referenceRateDate: template.referenceRateDate,

      // Deposit
      depositChf: template.depositChf,
      depositDueRule: template.depositDueRule,
      depositDueDate: template.depositDueDate,

      // Stipulations
      otherStipulations: template.otherStipulations,
      includesHouseRules: template.includesHouseRules,
      otherAnnexesText: template.otherAnnexesText,
    },
    include: LEASE_INCLUDE,
  });

  // Auto-provision Tenant + Occupancy so the tenant can log in immediately
  if (lease.tenantPhone) {
    try {
      await ensureTenantAndOccupancy(lease);
      console.log(`[LEASE] Auto-provisioned tenant from template lease ${lease.id}`);
    } catch (e) {
      console.error(`[LEASE] Auto-provision tenant failed (non-critical):`, e);
    }
  }

  return mapLeaseToDTO(lease);
}