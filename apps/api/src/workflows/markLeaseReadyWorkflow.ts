/**
 * markLeaseReadyWorkflow
 *
 * Canonical entry point for marking a lease as READY_TO_SIGN.
 * This is the heaviest lease orchestration: validates required fields,
 * auto-provisions Tenant + Occupancy records, transitions status, and
 * creates + immediately sends the SignatureRequest so sentAt is populated.
 *
 * Orchestrates:
 *   1. Fetch lease + org ownership check
 *   2. Reject templates
 *   3. Assert DRAFT → READY_TO_SIGN transition is valid
 *   4. Validate required fields (tenantName, netRentChf, startDate, tenantPhone)
 *   5. Auto-provision Tenant + Occupancy (ensureTenantAndOccupancy)
 *   6. Persist status change
 *   7. Emit LEASE_STATUS_CHANGED event
 *   8. Create SignatureRequest (DRAFT) then immediately send it (SENT + sentAt)
 *   9. Return updated lease DTO + sent SignatureRequest
 */

import { LeaseStatus } from "@prisma/client";
import { WorkflowContext } from "./context";
import { assertLeaseTransition } from "./transitions";
import { emit } from "../events/bus";
import {
  findLeaseRaw,
  updateLease,
  findTenantByOrgPhone,
  createTenant,
  updateTenant,
  findOccupancy,
  createOccupancy,
} from "../repositories/leaseRepository";
import { mapLeaseToDTO, type LeaseDTO } from "../services/leases";
import { normalizePhoneToE164 } from "../utils/phoneNormalization";
import {
  createSignatureRequest,
  sendSignatureRequest,
  type SignatureRequestDTO,
  type SignerInfo,
} from "../services/signatureRequests";
import { notifyTenantLeaseReady } from "../services/notifications";
import { resolveTenantUserId } from "../services/tenantIdentity";

// ─── Input / Output ────────────────────────────────────────────

export interface MarkLeaseReadyInput {
  leaseId: string;
  level?: 'SES' | 'AES' | 'QES';
  signers?: SignerInfo[];
}

export interface MarkLeaseReadyResult {
  dto: LeaseDTO;
  signatureRequest: SignatureRequestDTO;
}

// ─── Workflow ──────────────────────────────────────────────────

export async function markLeaseReadyWorkflow(
  ctx: WorkflowContext,
  input: MarkLeaseReadyInput,
): Promise<MarkLeaseReadyResult> {
  const { orgId, prisma } = ctx;
  const { leaseId, level, signers } = input;

  // ── 1. Fetch + org check ───────────────────────────────────
  const existing = await findLeaseRaw(prisma, leaseId);
  if (!existing || existing.orgId !== orgId) {
    throw Object.assign(new Error("Lease not found"), { code: "NOT_FOUND" });
  }

  // ── 2. Reject templates ───────────────────────────────────
  if (existing.isTemplate) {
    throw new Error("Cannot change status of a template");
  }

  // ── 3. Transition guard ────────────────────────────────────
  assertLeaseTransition(existing.status, LeaseStatus.READY_TO_SIGN);

  // ── 4. Validate required fields ───────────────────────────
  if (!existing.tenantName) throw new Error("Tenant name is required");
  if (!existing.netRentChf && existing.netRentChf !== 0) throw new Error("Net rent is required");
  if (!existing.startDate) throw new Error("Start date is required");
  if (!existing.tenantPhone) {
    throw new Error("Tenant phone is required before sending for signature (needed for tenant portal login)");
  }

  // ── 5. Auto-provision Tenant + Occupancy ──────────────────
  await ensureTenantAndOccupancy(prisma, {
    orgId: existing.orgId,
    unitId: existing.unitId,
    tenantName: existing.tenantName,
    tenantPhone: existing.tenantPhone,
    tenantEmail: existing.tenantEmail,
  });

  // ── 6. Persist ─────────────────────────────────────────────
  const updated = await updateLease(prisma, leaseId, {
    status: LeaseStatus.READY_TO_SIGN,
  });

  const dto = mapLeaseToDTO(updated);

  // ── 7. Emit event ──────────────────────────────────────────
  emit({
    type: "LEASE_STATUS_CHANGED",
    orgId,
    actorUserId: ctx.actorUserId,
    payload: {
      leaseId,
      fromStatus: existing.status,
      toStatus: LeaseStatus.READY_TO_SIGN,
    },
  }).catch((err) => console.error("[EVENT] Failed to emit LEASE_STATUS_CHANGED", err));

  // ── 8. Create + send SignatureRequest ──────────────────────
  // Creating in DRAFT then immediately sending ensures sentAt is always
  // populated, which is the canonical source for sentForSignatureAt in
  // LeaseDTO (batch-joined in listLeases).
  const draftSigReq = await createSignatureRequest({ orgId, leaseId, level, signers });
  const signatureRequest = await sendSignatureRequest(draftSigReq.id, orgId);

  // ── 9. Notify tenant that lease is ready to sign ───────────
  try {
    if (existing.unitId) {
      const occupancy = await prisma.occupancy.findFirst({
        where: { unitId: existing.unitId },
        include: { tenant: true },
      });
      if (occupancy?.tenant) {
        const userId = await resolveTenantUserId(prisma, orgId, occupancy.tenantId);
        const unit = await prisma.unit.findUnique({
          where: { id: existing.unitId },
          include: { building: true },
        });
        await notifyTenantLeaseReady(
          leaseId, orgId, userId,
          unit?.unitNumber || "unknown",
          unit?.building?.name || "Property",
          unit?.buildingId || undefined,
        );
      }
    }
  } catch (notifErr) {
    console.error("[LEASE-WORKFLOW] Failed to notify tenant of ready-to-sign:", notifErr);
  }

  return { dto, signatureRequest };
}

// ─── Private: Tenant + Occupancy provisioning ──────────────────

async function ensureTenantAndOccupancy(
  prisma: WorkflowContext["prisma"],
  lease: {
    orgId: string;
    unitId: string;
    tenantName: string;
    tenantPhone: string | null;
    tenantEmail: string | null;
  },
): Promise<string> {
  const normalizedPhone = normalizePhoneToE164(lease.tenantPhone || "");
  if (!normalizedPhone) throw new Error("Invalid tenant phone number format");

  // Find or create Tenant by (orgId, phone)
  let tenant = await findTenantByOrgPhone(prisma, lease.orgId, normalizedPhone);

  if (!tenant) {
    tenant = await createTenant(prisma, {
      orgId: lease.orgId,
      phone: normalizedPhone,
      name: lease.tenantName,
      email: lease.tenantEmail || null,
    });
    console.log(`[LEASE] Auto-created Tenant ${tenant.id}`); // PII omitted intentionally
  } else {
    // Update name/email if they changed on the lease
    const updates: any = {};
    if (lease.tenantName && lease.tenantName !== tenant.name) updates.name = lease.tenantName;
    if (lease.tenantEmail && lease.tenantEmail !== tenant.email) updates.email = lease.tenantEmail;
    if (Object.keys(updates).length > 0) {
      await updateTenant(prisma, tenant.id, updates);
    }
  }

  // Find or create Occupancy linking tenant → unit
  const existingOccupancy = await findOccupancy(prisma, tenant.id, lease.unitId);

  if (!existingOccupancy) {
    await createOccupancy(prisma, { tenantId: tenant.id, unitId: lease.unitId });
    console.log(`[LEASE] Auto-created Occupancy for Tenant ${tenant.id} → Unit ${lease.unitId}`);
  }

  return tenant.id;
}
