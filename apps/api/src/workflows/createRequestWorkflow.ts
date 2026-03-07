/**
 * createRequestWorkflow
 *
 * THE canonical entry point for creating a maintenance request.
 * Orchestrates the full story:
 *   1. Validate + normalize input (already done by route via Zod)
 *   2. Resolve tenant from phone if needed
 *   3. Determine initial status (rules engine → threshold → pending)
 *   4. Owner-direct mode: bump to PENDING_OWNER_APPROVAL if above limit
 *   5. Persist the request
 *   6. Emit REQUEST_CREATED event
 *   7. Legal auto-routing (if enabled + category mapped + OBLIGATED)
 *   8. Contractor auto-match (only when legal routing did NOT consume)
 *   9. Canonical reload + DTO return
 */

import { RequestStatus, OrgMode, PrismaClient } from "@prisma/client";
import { WorkflowContext } from "./context";
import { emit } from "../events/bus";
import { findRequestById, createRequest as repoCreateRequest, updateRequestStatus } from "../repositories/requestRepository";
import { getTenantByPhone } from "../services/tenants";
import { getOrgConfig } from "../services/orgConfig";
import { computeEffectiveConfig } from "../services/buildingConfig";
import { decideRequestStatusWithRules } from "../services/autoApproval";
import { findMatchingContractor, assignContractor } from "../services/requestAssignment";
import { evaluateRequestLegalDecision } from "../services/legalDecisionEngine";
import { createRfpForRequest } from "../services/rfps";
import { toDTO, type MaintenanceRequestDTO } from "../services/maintenanceRequests";
import { normalizePhoneToE164 } from "../utils/phoneNormalization";
import type { CreateRequestInput } from "../validation/requests";

// ─── Input / Output ────────────────────────────────────────────

export interface CreateRequestWorkflowInput {
  /** Validated Zod output. */
  input: CreateRequestInput;
  /** Extra fields that may come from the raw body. */
  contactPhone?: string | null;
  tenantId?: string | null;
  unitId?: string | null;
  applianceId?: string | null;
}

export interface CreateRequestWorkflowResult {
  dto: MaintenanceRequestDTO;
  /** True if the request was auto-routed to RFP via legal engine. */
  legalAutoRouted: boolean;
}

// ─── Workflow ──────────────────────────────────────────────────

export async function createRequestWorkflow(
  ctx: WorkflowContext,
  wfInput: CreateRequestWorkflowInput,
): Promise<CreateRequestWorkflowResult> {
  const { orgId, prisma } = ctx;
  const { input } = wfInput;

  const description = input.description;
  const category = input.category ?? null;
  const hasEstimatedCost = typeof input.estimatedCost === "number";
  const estimatedCost = hasEstimatedCost ? input.estimatedCost! : null;

  // ── 1. Resolve contact phone / tenant ──────────────────────
  let contactPhone: string | null = null;
  if (wfInput.contactPhone) {
    const normalized = normalizePhoneToE164(wfInput.contactPhone);
    if (!normalized) throw Object.assign(new Error("Invalid contactPhone format"), { code: "VALIDATION_ERROR" });
    contactPhone = normalized;
  }

  let tenantId = wfInput.tenantId ?? null;
  let unitId = wfInput.unitId ?? null;
  const applianceId = wfInput.applianceId ?? null;

  if (contactPhone && !tenantId) {
    const tenant = await getTenantByPhone({ phone: contactPhone, orgId });
    if (tenant) {
      tenantId = tenant.id;
      if (!unitId && tenant.unitId) unitId = tenant.unitId;
    }
  }

  // ── 2. Determine initial status ────────────────────────────
  let status: RequestStatus = RequestStatus.PENDING_REVIEW;

  if (hasEstimatedCost || category) {
    let unitType: string | null = null;
    let unitNumber: string | null = null;
    let buildingId: string | null = null;

    if (unitId) {
      const unit = await prisma.unit.findUnique({
        where: { id: unitId },
        select: { type: true, unitNumber: true, buildingId: true },
      });
      unitType = unit?.type ?? null;
      unitNumber = unit?.unitNumber ?? null;
      buildingId = unit?.buildingId ?? null;
    }

    const effective = await computeEffectiveConfig(prisma, orgId, buildingId ?? undefined);
    const approvalResult = await decideRequestStatusWithRules(
      prisma, orgId,
      { category, estimatedCost, unitType, unitNumber, buildingId, unitId },
      effective.effectiveAutoApproveLimit,
      unitId ?? undefined,
    );
    status = approvalResult.status;

    // ── 3. Owner-direct mode override ────────────────────────
    if (
      effective.org.mode === "OWNER_DIRECT" &&
      estimatedCost !== null &&
      estimatedCost > effective.effectiveRequireOwnerApprovalAbove
    ) {
      status = RequestStatus.PENDING_OWNER_APPROVAL;
    }
  }

  // ── 4. Persist the request ─────────────────────────────────
  const created = await repoCreateRequest(prisma, {
    description,
    category,
    estimatedCost,
    status,
    contactPhone,
    tenantId,
    unitId,
    applianceId,
  });

  // ── 5. Emit REQUEST_CREATED event ──────────────────────────
  emit({
    type: "REQUEST_CREATED",
    orgId,
    actorUserId: ctx.actorUserId,
    payload: { requestId: created.id, category: created.category, description: created.description },
  }).catch((err) => console.error("[EVENT] Failed to emit REQUEST_CREATED", err));

  // ── 6. Legal auto-routing (graceful degradation) ───────────
  let legalAutoRouted = false;
  if (category) {
    try {
      const orgConfig = await getOrgConfig(prisma, orgId);

      if (orgConfig.autoLegalRouting) {
        const mapping = await prisma.legalCategoryMapping.findFirst({
          where: {
            requestCategory: category,
            isActive: true,
            OR: [{ orgId }, { orgId: null }],
          },
        });

        if (mapping) {
          const decision = await evaluateRequestLegalDecision(orgId, created.id);

          if (decision.legalObligation === "OBLIGATED") {
            const rfp = await createRfpForRequest(orgId, created.id, {
              legalObligation: decision.legalObligation as any,
              legalTopic: decision.legalTopic,
            });

            const previousStatus = created.status;
            await updateRequestStatus(prisma, created.id, RequestStatus.RFP_PENDING);

            legalAutoRouted = true;

            emit({
              type: "LEGAL_AUTO_ROUTED",
              orgId,
              actorUserId: ctx.actorUserId,
              payload: {
                requestId: created.id,
                obligation: decision.legalObligation,
                rfpId: rfp.id,
                previousStatus: String(previousStatus),
                newStatus: "RFP_PENDING",
              },
            }).catch((err) => console.error("[EVENT] Failed to emit LEGAL_AUTO_ROUTED", err));

            console.log(`[LEGAL] Auto-routed request ${created.id} → RFP ${rfp.id} (OBLIGATED)`);
          } else {
            console.log(`[LEGAL] Request ${created.id}: ${decision.legalObligation} — no auto-route`);
          }
        }
      }
    } catch (err) {
      console.warn(`[LEGAL] Auto-routing failed for request ${created.id}, keeping as ${created.status}:`, err);
    }
  }

  // ── 7. Contractor auto-match (skipped when legal-routed) ───
  if (category && !legalAutoRouted) {
    const matchingContractor = await findMatchingContractor(prisma, orgId, category);
    if (matchingContractor) await assignContractor(prisma, created.id, matchingContractor.id);
  }

  // ── 8. Canonical reload + DTO ──────────────────────────────
  const reloaded = await findRequestById(prisma, created.id);
  const dto = reloaded ? toDTO(reloaded) : toDTO(created);

  return { dto, legalAutoRouted };
}
