/**
 * schedulingWorkflow
 *
 * Slice 6: rfp-scheduling-handshake
 *
 * Workflows:
 *   1. proposeSlotsWorkflow   — contractor proposes appointment slots for a PENDING job
 *   2. respondToSlotWorkflow  — tenant accepts or declines a proposed slot
 *   3. processSchedulingEscalations — BG job: notify managers when 72h expire
 *
 * Rules:
 *   - Only the assigned contractor can propose slots for their job
 *   - Only the tenant linked to the request can accept/decline
 *   - Accepting a slot auto-declines all other PROPOSED slots for the same job
 *   - If no slot is accepted within 72h of first proposal, manager gets escalation notification
 */

import { WorkflowContext } from "./context";
import { emit } from "../events/bus";
import {
  createSlots,
  findSlotById,
  findSlotsByJobId,
  updateSlotStatus,
  declineOtherSlots,
  setSchedulingExpiry,
  findExpiredSchedulingJobs,
  clearSchedulingExpiry,
} from "../repositories/schedulingRepository";
import { findJobById } from "../repositories/jobRepository";
import { createNotification } from "../services/notifications";
import type { ProposeSlotsInput } from "../validation/schedulingSchemas";
import type { SlotWithJob } from "../repositories/schedulingRepository";

/* ── Constants ───────────────────────────────────────────────── */

const SCHEDULING_DEADLINE_MS = 72 * 60 * 60 * 1000; // 72 hours

/* ── Errors ──────────────────────────────────────────────────── */

export class SchedulingError extends Error {
  public code: string;
  constructor(code: string, message: string) {
    super(message);
    this.name = "SchedulingError";
    this.code = code;
  }
}

/* ── DTO mapper ──────────────────────────────────────────────── */

export interface AppointmentSlotDTO {
  id: string;
  jobId: string;
  startTime: string;
  endTime: string;
  status: string;
  respondedAt: string | null;
  createdAt: string;
}

function toSlotDTO(slot: SlotWithJob): AppointmentSlotDTO {
  return {
    id: slot.id,
    jobId: slot.jobId,
    startTime: slot.startTime.toISOString(),
    endTime: slot.endTime.toISOString(),
    status: slot.status,
    respondedAt: slot.respondedAt?.toISOString() ?? null,
    createdAt: slot.createdAt.toISOString(),
  };
}

/* ── 1. proposeSlotsWorkflow ─────────────────────────────────── */

export interface ProposeSlotsWorkflowInput {
  jobId: string;
  contractorId: string;
  slots: ProposeSlotsInput["slots"];
}

export interface ProposeSlotsWorkflowResult {
  slots: AppointmentSlotDTO[];
  schedulingExpiresAt: string;
}

export async function proposeSlotsWorkflow(
  ctx: WorkflowContext,
  input: ProposeSlotsWorkflowInput,
): Promise<ProposeSlotsWorkflowResult> {
  const { orgId, prisma, actorUserId } = ctx;
  const { jobId, contractorId, slots: slotsInput } = input;

  // ── 1. Fetch job + verify org scoping ──────────────────────
  const job = await findJobById(prisma, jobId);
  if (!job || job.orgId !== orgId) {
    throw new SchedulingError("NOT_FOUND", "Job not found");
  }

  // ── 2. Job must be PENDING ─────────────────────────────────
  if (job.status !== "PENDING") {
    throw new SchedulingError(
      "INVALID_STATUS",
      `Job is ${job.status}, slots can only be proposed for PENDING jobs`,
    );
  }

  // ── 3. Contractor must be the assigned contractor ──────────
  if (job.contractorId !== contractorId) {
    throw new SchedulingError(
      "FORBIDDEN",
      "Only the assigned contractor can propose slots for this job",
    );
  }

  // ── 4. All proposed times must be in the future ────────────
  const now = new Date();
  for (const s of slotsInput) {
    if (new Date(s.startTime) <= now) {
      throw new SchedulingError(
        "VALIDATION_ERROR",
        "All proposed slots must be in the future",
      );
    }
  }

  // ── 5. Persist slots via repository ────────────────────────
  const created = await createSlots(prisma, {
    orgId,
    jobId,
    slots: slotsInput.map((s) => ({
      startTime: new Date(s.startTime),
      endTime: new Date(s.endTime),
    })),
  });

  // ── 6. Set 72h scheduling deadline (if not already set) ───
  const existingSlots = await findSlotsByJobId(prisma, jobId);
  const hasAccepted = existingSlots.some((s) => s.status === "ACCEPTED");

  let expiresAt: Date;
  if (!hasAccepted && !(job as any).schedulingExpiresAt) {
    expiresAt = new Date(now.getTime() + SCHEDULING_DEADLINE_MS);
    await setSchedulingExpiry(prisma, jobId, expiresAt);
  } else {
    expiresAt = (job as any).schedulingExpiresAt ?? new Date(now.getTime() + SCHEDULING_DEADLINE_MS);
  }

  // ── 7. Emit domain event ──────────────────────────────────
  await emit({
    type: "SLOT_PROPOSED",
    orgId,
    actorUserId,
    payload: {
      jobId,
      requestId: job.requestId,
      contractorId,
      slotIds: created.map((s) => s.id),
      schedulingExpiresAt: expiresAt.toISOString(),
    },
  });

  // ── 8. Notify tenant ──────────────────────────────────────
  const tenantId = job.request?.tenantId;
  if (tenantId) {
    await createNotification({
      orgId,
      userId: tenantId,
      entityType: "SCHEDULING",
      entityId: jobId,
      eventType: "SLOT_PROPOSED",
      message: `New appointment slots proposed for your maintenance request`,
    });
  }

  // ── 9. Return DTO ─────────────────────────────────────────
  return {
    slots: created.map(toSlotDTO),
    schedulingExpiresAt: expiresAt.toISOString(),
  };
}

/* ── 2. respondToSlotWorkflow ────────────────────────────────── */

export interface RespondToSlotWorkflowInput {
  slotId: string;
  tenantId: string;
  action: "accept" | "decline";
}

export interface RespondToSlotWorkflowResult {
  slot: AppointmentSlotDTO;
}

export async function respondToSlotWorkflow(
  ctx: WorkflowContext,
  input: RespondToSlotWorkflowInput,
): Promise<RespondToSlotWorkflowResult> {
  const { orgId, prisma, actorUserId } = ctx;
  const { slotId, tenantId, action } = input;

  // ── 1. Fetch slot + job context ────────────────────────────
  const slot = await findSlotById(prisma, slotId);
  if (!slot) {
    throw new SchedulingError("NOT_FOUND", "Appointment slot not found");
  }

  // ── 2. Org scoping ────────────────────────────────────────
  if (slot.orgId !== orgId) {
    throw new SchedulingError("NOT_FOUND", "Appointment slot not found");
  }

  // ── 3. Slot must be PROPOSED ──────────────────────────────
  if (slot.status !== "PROPOSED") {
    throw new SchedulingError(
      "INVALID_STATUS",
      `Slot is already ${slot.status}`,
    );
  }

  // ── 4. Tenant must own the request linked to this job ─────
  const requestTenantId = slot.job?.request?.tenantId;
  if (!requestTenantId || requestTenantId !== tenantId) {
    throw new SchedulingError(
      "FORBIDDEN",
      "You are not the tenant for this request",
    );
  }

  // ── 5. Persist status change ──────────────────────────────
  const newStatus = action === "accept" ? "ACCEPTED" : "DECLINED";
  const updated = await updateSlotStatus(prisma, slotId, newStatus);

  // ── 6. If accepted → decline all other PROPOSED slots ─────
  if (action === "accept") {
    await declineOtherSlots(prisma, slot.jobId, slotId);
    // Clear the scheduling deadline since appointment is booked
    await clearSchedulingExpiry(prisma, slot.jobId);
  }

  // ── 7. Emit domain event ──────────────────────────────────
  const eventType = action === "accept" ? "SLOT_ACCEPTED" : "SLOT_DECLINED";
  if (action === "accept") {
    await emit({
      type: "SLOT_ACCEPTED",
      orgId,
      actorUserId,
      payload: {
        jobId: slot.jobId,
        requestId: slot.job.requestId,
        slotId,
        startTime: slot.startTime.toISOString(),
        endTime: slot.endTime.toISOString(),
      },
    });
  } else {
    await emit({
      type: "SLOT_DECLINED",
      orgId,
      actorUserId,
      payload: {
        jobId: slot.jobId,
        requestId: slot.job.requestId,
        slotId,
      },
    });
  }

  // ── 8. Notify contractor ──────────────────────────────────
  const contractorId = slot.job.contractorId;
  await createNotification({
    orgId,
    userId: contractorId,
    entityType: "SCHEDULING",
    entityId: slot.jobId,
    eventType: action === "accept" ? "SLOT_ACCEPTED" : "SLOT_DECLINED",
    message:
      action === "accept"
        ? `Tenant accepted your proposed appointment slot`
        : `Tenant declined your proposed appointment slot`,
  });

  // ── 9. If accepted, also notify managers ──────────────────
  if (action === "accept") {
    const managers = await prisma.user.findMany({
      where: { orgId, role: "MANAGER" },
      select: { id: true },
    });
    for (const mgr of managers) {
      await createNotification({
        orgId,
        userId: mgr.id,
        entityType: "SCHEDULING",
        entityId: slot.jobId,
        eventType: "SLOT_ACCEPTED",
        message: `Appointment confirmed for job — ${slot.startTime.toISOString()}`,
      });
    }
  }

  // ── 10. Return DTO ─────────────────────────────────────────
  return { slot: toSlotDTO(updated) };
}

/* ── 3. processSchedulingEscalations (BG job) ────────────────── */

/**
 * Called by the background job scheduler in server.ts.
 * Finds all jobs whose 72h scheduling deadline has passed without
 * an accepted slot, and sends escalation notifications to managers.
 *
 * Returns the number of escalations processed.
 */
export async function processSchedulingEscalations(
  prisma: import("@prisma/client").PrismaClient,
): Promise<number> {
  const expiredJobs = await findExpiredSchedulingJobs(prisma);
  if (expiredJobs.length === 0) return 0;

  let count = 0;
  for (const job of expiredJobs) {
    // Find contractor name for the notification message
    const contractor = await prisma.contractor.findUnique({
      where: { id: job.contractorId },
      select: { name: true },
    });

    // Notify all managers in this org
    const managers = await prisma.user.findMany({
      where: { orgId: job.orgId, role: "MANAGER" },
      select: { id: true },
    });

    for (const mgr of managers) {
      await createNotification({
        orgId: job.orgId,
        userId: mgr.id,
        entityType: "SCHEDULING",
        entityId: job.id,
        eventType: "SCHEDULING_ESCALATED",
        message: `No appointment booked within 72h for job with ${contractor?.name ?? "contractor"} — please follow up`,
      });
    }

    // Emit domain event
    await emit({
      type: "SCHEDULING_ESCALATED",
      orgId: job.orgId,
      actorUserId: null,
      payload: {
        jobId: job.id,
        requestId: job.requestId,
        contractorId: job.contractorId,
      },
    });

    // Clear the expiry so we don't re-escalate on next run
    await clearSchedulingExpiry(prisma, job.id);
    count++;
  }

  return count;
}
