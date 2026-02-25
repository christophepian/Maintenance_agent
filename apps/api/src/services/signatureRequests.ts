import { SignatureRequestStatus, LeaseStatus } from '@prisma/client';
import prisma from './prismaClient';

// ==========================================
// DTOs
// ==========================================
export interface SignerInfo {
  role: string;  // TENANT | CO_TENANT | LANDLORD
  name: string;
  email: string;
  phone?: string;
}

export interface SignatureRequestDTO {
  id: string;
  orgId: string;
  entityType: string;
  entityId: string;
  provider: string;
  level: string;
  status: string;
  providerEnvelopeId?: string;
  signers: SignerInfo[];
  auditTrailStorageKey?: string;
  sentAt?: string;
  signedAt?: string;
  createdAt: string;
  updatedAt: string;
}

// ==========================================
// Mapper
// ==========================================
function mapToDTO(sr: any): SignatureRequestDTO {
  return {
    id: sr.id,
    orgId: sr.orgId,
    entityType: sr.entityType,
    entityId: sr.entityId,
    provider: sr.provider,
    level: sr.level,
    status: sr.status,
    providerEnvelopeId: sr.providerEnvelopeId || undefined,
    signers: (sr.signersJson as SignerInfo[]) || [],
    auditTrailStorageKey: sr.auditTrailStorageKey || undefined,
    sentAt: sr.sentAt ? sr.sentAt.toISOString() : undefined,
    signedAt: sr.signedAt ? sr.signedAt.toISOString() : undefined,
    createdAt: sr.createdAt.toISOString(),
    updatedAt: sr.updatedAt.toISOString(),
  };
}

// ==========================================
// Create signature request from lease
// ==========================================
export interface CreateSignatureRequestParams {
  orgId: string;
  leaseId: string;
  level?: 'SES' | 'AES' | 'QES';
  signers?: SignerInfo[];
}

export async function createSignatureRequest(
  params: CreateSignatureRequestParams,
): Promise<SignatureRequestDTO> {
  const { orgId, leaseId, level = 'SES' } = params;

  // Load lease to verify + build default signers
  const lease = await prisma.lease.findUnique({ where: { id: leaseId } });
  if (!lease || lease.orgId !== orgId) throw new Error('Lease not found');
  if (lease.status !== LeaseStatus.READY_TO_SIGN && lease.status !== LeaseStatus.DRAFT) {
    throw new Error('Lease must be DRAFT or READY_TO_SIGN to create a signature request');
  }

  // Build signers list: use provided or auto-generate from lease
  let signers = params.signers;
  if (!signers || signers.length === 0) {
    signers = [];
    // Add landlord
    if (lease.landlordName && lease.landlordEmail) {
      signers.push({
        role: 'LANDLORD',
        name: lease.landlordName,
        email: lease.landlordEmail,
        phone: lease.landlordPhone || undefined,
      });
    }
    // Add tenant
    if (lease.tenantName && lease.tenantEmail) {
      signers.push({
        role: 'TENANT',
        name: lease.tenantName,
        email: lease.tenantEmail,
        phone: lease.tenantPhone || undefined,
      });
    }
    // Add co-tenant
    if (lease.coTenantName) {
      signers.push({
        role: 'CO_TENANT',
        name: lease.coTenantName,
        email: '', // co-tenant email not stored on lease currently
      });
    }
  }

  if (signers.length === 0) {
    throw new Error('No signers could be determined. Provide signers or ensure lease has tenant/landlord emails.');
  }

  const sr = await prisma.signatureRequest.create({
    data: {
      orgId,
      entityType: 'LEASE',
      entityId: leaseId,
      provider: 'INTERNAL',
      level,
      status: SignatureRequestStatus.DRAFT,
      signersJson: signers as any,
    },
  });

  return mapToDTO(sr);
}

// ==========================================
// List signature requests
// ==========================================
export interface ListSignatureRequestsFilter {
  entityType?: string;
  entityId?: string;
  status?: string;
}

export async function listSignatureRequests(
  orgId: string,
  filter: ListSignatureRequestsFilter = {},
): Promise<SignatureRequestDTO[]> {
  const where: any = { orgId };
  if (filter.entityType) where.entityType = filter.entityType;
  if (filter.entityId) where.entityId = filter.entityId;
  if (filter.status) where.status = filter.status;

  const results = await prisma.signatureRequest.findMany({
    where,
    orderBy: { createdAt: 'desc' },
  });

  return results.map(mapToDTO);
}

// ==========================================
// Get single signature request
// ==========================================
export async function getSignatureRequest(
  id: string,
  orgId: string,
): Promise<SignatureRequestDTO | null> {
  const sr = await prisma.signatureRequest.findUnique({ where: { id } });
  if (!sr || sr.orgId !== orgId) return null;
  return mapToDTO(sr);
}

// ==========================================
// Send signature request (stub: marks SENT)
// ==========================================
export async function sendSignatureRequest(
  id: string,
  orgId: string,
): Promise<SignatureRequestDTO> {
  const sr = await prisma.signatureRequest.findUnique({ where: { id } });
  if (!sr || sr.orgId !== orgId) throw new Error('Signature request not found');
  if (sr.status !== SignatureRequestStatus.DRAFT) {
    throw new Error('Only DRAFT requests can be sent');
  }

  const updated = await prisma.signatureRequest.update({
    where: { id },
    data: {
      status: SignatureRequestStatus.SENT,
      sentAt: new Date(),
    },
  });

  return mapToDTO(updated);
}

// ==========================================
// Mark signed (dev/testing stub)
// ==========================================
export async function markSignatureRequestSigned(
  id: string,
  orgId: string,
): Promise<SignatureRequestDTO> {
  const sr = await prisma.signatureRequest.findUnique({ where: { id } });
  if (!sr || sr.orgId !== orgId) throw new Error('Signature request not found');
  if (sr.status !== SignatureRequestStatus.SENT) {
    throw new Error('Only SENT requests can be marked as signed');
  }

  // Update signature request
  const updated = await prisma.signatureRequest.update({
    where: { id },
    data: {
      status: SignatureRequestStatus.SIGNED,
      signedAt: new Date(),
    },
  });

  // Update linked lease status to SIGNED
  if (sr.entityType === 'LEASE') {
    await prisma.lease.update({
      where: { id: sr.entityId },
      data: { status: LeaseStatus.SIGNED },
    });
  }

  return mapToDTO(updated);
}
