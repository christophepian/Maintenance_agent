/**
 * tenantSelfPayWorkflow
 *
 * When an owner rejects a maintenance request the tenant may choose
 * to proceed at their own expense.  This workflow:
 *
 *   1. Fetch current request + validate existence
 *   2. Verify the tenant owns the request
 *   3. Assert status transition REJECTED → RFP_PENDING
 *   4. Update payingParty to TENANT and transition to RFP_PENDING
 *   5. Create an RFP for the request (re-uses existing RFP service)
 *   6. Notify tenant of confirmation
 *   7. Emit TENANT_SELF_PAY_ACCEPTED domain event
 *   8. Canonical reload + DTO return
 */

import { RequestStatus, PayingParty, LegalObligation } from "@prisma/client";
import { WorkflowContext } from "./context";
import { assertRequestTransition, InvalidTransitionError } from "./transitions";
import { emit } from "../events/bus";
import { findRequestById, findRequestRaw, updateRequestStatus } from "../repositories/requestRepository";
import { toDTO, type MaintenanceRequestDTO } from "../services/maintenanceRequests";
import { createRfpForRequest } from "../services/rfps";
import { notifyTenantSelfPayAccepted } from "../services/notifications";
import { resolveTenantUserId } from "../services/tenantIdentity";

// ─── Input / Output ────────────────────────────────────────────

export interface TenantSelfPayInput {
  requestId: string;
  tenantId: string;
}

export interface TenantSelfPayResult {
  dto: MaintenanceRequestDTO;
  rfpId: string;
}

// ─── Workflow ──────────────────────────────────────────────────

export async function tenantSelfPayWorkflow(
  ctx: WorkflowContext,
  input: TenantSelfPayInput,
): Promise<TenantSelfPayResult> {
  const { orgId, prisma } = ctx;
  const { requestId, tenantId } = input;

  // ── 1. Fetch current request ───────────────────────────────
  const current = await findRequestRaw(prisma, requestId);
  if (!current) {
    throw Object.assign(new Error("Request not found"), { code: "NOT_FOUND" });
  }

  // ── 2. Verify tenant owns the request ──────────────────────
  if (current.tenantId !== tenantId) {
    throw Object.assign(
      new Error("You do not have permission to accept self-pay for this request"),
      { code: "FORBIDDEN" },
    );
  }

  // ── 3. Must be in REJECTED — self-pay only applies after rejection ─
  if (current.status !== RequestStatus.REJECTED) {
    throw new InvalidTransitionError("Request", current.status, "RFP_PENDING");
  }
  assertRequestTransition(current.status, RequestStatus.RFP_PENDING);

  // ── 4. Transition to RFP_PENDING with payingParty = TENANT ─
  await updateRequestStatus(prisma, requestId, RequestStatus.RFP_PENDING, {
    payingParty: PayingParty.TENANT,
  });

  // ── 5. Create RFP (idempotent) ────────────────────────────
  const rfp = await createRfpForRequest(orgId, requestId, {
    legalObligation: LegalObligation.UNKNOWN,
    legalTopic: current.category ?? "general",
  });

  // ── 6. Notify tenant ──────────────────────────────────────
  try {
    const tenantUserId = await resolveTenantUserId(prisma, orgId, tenantId);
    const buildingId = current.unitId
      ? (await prisma.unit.findUnique({ where: { id: current.unitId }, select: { buildingId: true } }))?.buildingId ?? undefined
      : undefined;
    await notifyTenantSelfPayAccepted(requestId, orgId, tenantUserId, buildingId);
  } catch (err) {
    console.error("[tenantSelfPayWorkflow] Failed to notify tenant", err);
  }

  // ── 7. Emit domain event ──────────────────────────────────
  emit({
    type: "TENANT_SELF_PAY_ACCEPTED",
    orgId,
    actorUserId: ctx.actorUserId,
    payload: { requestId, tenantId, rfpId: rfp.id },
  }).catch((err) => console.error("[EVENT] Failed to emit TENANT_SELF_PAY_ACCEPTED", err));

  // ── 8. Canonical reload + DTO return ──────────────────────
  const reloaded = await findRequestById(prisma, requestId);
  return { dto: toDTO(reloaded!), rfpId: rfp.id };
}
