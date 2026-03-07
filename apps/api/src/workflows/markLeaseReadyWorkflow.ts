/**
 * markLeaseReadyWorkflow
 *
 * Canonical entry point for marking a lease as READY_TO_SIGN.
 * This is the heaviest lease orchestration: validates required fields,
 * auto-provisions Tenant + Occupancy records, and transitions status.
 *
 * Orchestrates:
 *   1. Fetch lease + org ownership check
 *   2. Reject templates
 *   3. Assert DRAFT → READY_TO_SIGN transition is valid
 *   4. Validate required fields (tenantName, netRentChf, startDate, tenantPhone)
 *   5. Auto-provision Tenant + Occupancy (ensureTenantAndOccupancy)
 *   6. Persist status change
 *   7. Emit LEASE_STATUS_CHANGED event
 *   8. Return updated lease DTO
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

// ─── Input / Output ────────────────────────────────────────────

export interface MarkLeaseReadyInput {
  leaseId: string;
}

export interface MarkLeaseReadyResult {
  dto: LeaseDTO;
}

// ─── Workflow ──────────────────────────────────────────────────

export async function markLeaseReadyWorkflow(
  ctx: WorkflowContext,
  input: MarkLeaseReadyInput,
): Promise<MarkLeaseReadyResult> {
  const { orgId, prisma } = ctx;
  const { leaseId } = input;

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

  return { dto };
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
    console.log(`[LEASE] Auto-created Tenant ${tenant.id} (${lease.tenantName}, ${normalizedPhone})`);
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
