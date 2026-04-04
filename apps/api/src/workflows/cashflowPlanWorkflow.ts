/**
 * cashflowPlanWorkflow
 *
 * Orchestrates lifecycle transitions for CashflowPlan.
 * Status path: DRAFT → SUBMITTED → APPROVED (terminal)
 * Approved plans unlock RFP generation (Slice 4).
 */

import { CashflowPlanStatus } from "@prisma/client";
import { WorkflowContext } from "./context";
import { assertCashflowPlanTransition } from "./transitions";
import { emit } from "../events/bus";
import type {
  CashflowPlanCreatedPayload,
  CashflowPlanSubmittedPayload,
  CashflowPlanApprovedPayload,
} from "../events/types";
import {
  findCashflowPlanById,
  createCashflowPlan,
  updateCashflowPlan,
  addCashflowOverride,
  removeCashflowOverride,
  type CashflowPlanWithRelations,
} from "../repositories/cashflowPlanRepository";

// ─── Input / Output types ──────────────────────────────────────

export interface CreatePlanInput {
  name: string;
  buildingId?: string | null;
  incomeGrowthRatePct?: number;
  openingBalanceCents?: bigint | null;
  horizonMonths?: number;
}

export interface UpdatePlanInput {
  planId: string;
  name?: string;
  incomeGrowthRatePct?: number;
  openingBalanceCents?: bigint | null;
}

export interface AddOverrideInput {
  planId: string;
  assetId: string;
  originalYear: number;
  overriddenYear: number;
}

export interface RemoveOverrideInput {
  planId: string;
  overrideId: string;
}

export interface PlanResult {
  plan: CashflowPlanWithRelations;
}

// ─── Workflow functions ────────────────────────────────────────

export async function createPlanWorkflow(
  ctx: WorkflowContext,
  input: CreatePlanInput,
): Promise<PlanResult> {
  const { orgId, prisma } = ctx;

  const plan = await createCashflowPlan(prisma, {
    orgId,
    name: input.name,
    buildingId: input.buildingId,
    incomeGrowthRatePct: input.incomeGrowthRatePct,
    openingBalanceCents: input.openingBalanceCents,
    horizonMonths: input.horizonMonths,
  });

  emit<"CASHFLOW_PLAN_CREATED">({
    type: "CASHFLOW_PLAN_CREATED",
    orgId,
    actorUserId: ctx.actorUserId,
    payload: { planId: plan.id, name: plan.name } satisfies CashflowPlanCreatedPayload,
  }).catch((err) => console.error("[EVENT] Failed to emit CASHFLOW_PLAN_CREATED", err));

  return { plan };
}

export async function updatePlanWorkflow(
  ctx: WorkflowContext,
  input: UpdatePlanInput,
): Promise<PlanResult> {
  const { orgId, prisma } = ctx;
  const { planId, ...updates } = input;

  const existing = await findCashflowPlanById(prisma, planId, orgId);
  if (!existing) {
    throw Object.assign(new Error("CashflowPlan not found"), { code: "NOT_FOUND" });
  }

  if (existing.status !== CashflowPlanStatus.DRAFT) {
    throw Object.assign(
      new Error("Only DRAFT plans can be edited"),
      { code: "INVALID_STATE" },
    );
  }

  const updated = await updateCashflowPlan(prisma, planId, orgId, {
    ...updates,
    lastComputedAt: null, // mark stale so next GET recomputes
  });

  if (!updated) {
    throw Object.assign(new Error("CashflowPlan not found"), { code: "NOT_FOUND" });
  }

  return { plan: updated };
}

export async function addOverrideWorkflow(
  ctx: WorkflowContext,
  input: AddOverrideInput,
): Promise<PlanResult> {
  const { orgId, prisma } = ctx;

  const existing = await findCashflowPlanById(prisma, input.planId, orgId);
  if (!existing) {
    throw Object.assign(new Error("CashflowPlan not found"), { code: "NOT_FOUND" });
  }
  if (existing.status !== CashflowPlanStatus.DRAFT) {
    throw Object.assign(
      new Error("Overrides can only be added to DRAFT plans"),
      { code: "INVALID_STATE" },
    );
  }

  const override = await addCashflowOverride(prisma, input.planId, orgId, {
    assetId: input.assetId,
    originalYear: input.originalYear,
    overriddenYear: input.overriddenYear,
  });
  if (!override) {
    throw Object.assign(new Error("CashflowPlan not found"), { code: "NOT_FOUND" });
  }

  const reloaded = await findCashflowPlanById(prisma, input.planId, orgId);
  return { plan: reloaded! };
}

export async function removeOverrideWorkflow(
  ctx: WorkflowContext,
  input: RemoveOverrideInput,
): Promise<PlanResult> {
  const { orgId, prisma } = ctx;

  const existing = await findCashflowPlanById(prisma, input.planId, orgId);
  if (!existing) {
    throw Object.assign(new Error("CashflowPlan not found"), { code: "NOT_FOUND" });
  }
  if (existing.status !== CashflowPlanStatus.DRAFT) {
    throw Object.assign(
      new Error("Overrides can only be removed from DRAFT plans"),
      { code: "INVALID_STATE" },
    );
  }

  await removeCashflowOverride(prisma, input.overrideId, input.planId, orgId);

  const reloaded = await findCashflowPlanById(prisma, input.planId, orgId);
  return { plan: reloaded! };
}

export async function submitPlanWorkflow(
  ctx: WorkflowContext,
  input: { planId: string },
): Promise<PlanResult> {
  const { orgId, prisma } = ctx;

  const existing = await findCashflowPlanById(prisma, input.planId, orgId);
  if (!existing) {
    throw Object.assign(new Error("CashflowPlan not found"), { code: "NOT_FOUND" });
  }

  assertCashflowPlanTransition(existing.status, CashflowPlanStatus.SUBMITTED);

  const updated = await updateCashflowPlan(prisma, input.planId, orgId, {
    status: CashflowPlanStatus.SUBMITTED,
  });

  emit<"CASHFLOW_PLAN_SUBMITTED">({
    type: "CASHFLOW_PLAN_SUBMITTED",
    orgId,
    actorUserId: ctx.actorUserId,
    payload: { planId: input.planId } satisfies CashflowPlanSubmittedPayload,
  }).catch((err) => console.error("[EVENT] Failed to emit CASHFLOW_PLAN_SUBMITTED", err));

  return { plan: updated! };
}

export async function approvePlanWorkflow(
  ctx: WorkflowContext,
  input: { planId: string },
): Promise<PlanResult> {
  const { orgId, prisma } = ctx;

  const existing = await findCashflowPlanById(prisma, input.planId, orgId);
  if (!existing) {
    throw Object.assign(new Error("CashflowPlan not found"), { code: "NOT_FOUND" });
  }

  assertCashflowPlanTransition(existing.status, CashflowPlanStatus.APPROVED);

  const updated = await updateCashflowPlan(prisma, input.planId, orgId, {
    status: CashflowPlanStatus.APPROVED,
  });

  emit<"CASHFLOW_PLAN_APPROVED">({
    type: "CASHFLOW_PLAN_APPROVED",
    orgId,
    actorUserId: ctx.actorUserId,
    payload: { planId: input.planId } satisfies CashflowPlanApprovedPayload,
  }).catch((err) => console.error("[EVENT] Failed to emit CASHFLOW_PLAN_APPROVED", err));

  return { plan: updated! };
}
