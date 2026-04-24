/**
 * completeJobWorkflow
 *
 * Canonical entry point for marking a job as completed.
 * Orchestrates:
 *   1. Validate the job exists and belongs to the org
 *   2. Update job fields (status, actualCost, dates)
 *   3. Auto-create invoice when job is COMPLETED (idempotent)
 *   4. Return updated job DTO
 */

import { JobStatus, RequestStatus } from "@prisma/client";
import { WorkflowContext } from "./context";
import { assertJobTransition } from "./transitions";
import { emit } from "../events/bus";
import { getJob, updateJob, getOrCreateJobForRequest } from "../services/jobs";
import { getOrCreateInvoiceForJob } from "../services/invoices";
import { updateRequestStatus } from "../repositories/requestRepository";
import type { JobDTO } from "../services/jobs";

// ─── Input / Output ────────────────────────────────────────────

export interface CompleteJobInput {
  jobId: string;
  actualCost?: number;
  startedAt?: string;
  completedAt?: string;
}

export interface CompleteJobResult {
  dto: JobDTO;
  invoiceAutoCreated: boolean;
}

// ─── Workflow ──────────────────────────────────────────────────

export async function completeJobWorkflow(
  ctx: WorkflowContext,
  input: CompleteJobInput,
): Promise<CompleteJobResult> {
  const { orgId } = ctx;
  const { jobId, actualCost, startedAt, completedAt } = input;

  // ── 1. Fetch + org check ───────────────────────────────────
  const job = await getJob(jobId);
  if (!job || job.orgId !== orgId) {
    throw Object.assign(new Error("Job not found"), { code: "NOT_FOUND" });
  }

  // ── 2. Validate transition if going to COMPLETED ──────────
  if (job.status !== "COMPLETED") {
    assertJobTransition(job.status as JobStatus, JobStatus.COMPLETED);
  }

  // ── 3. Update job ─────────────────────────────────────────
  const updated = await updateJob(jobId, {
    status: JobStatus.COMPLETED,
    actualCost,
    startedAt: startedAt ? new Date(startedAt) : undefined,
    completedAt: completedAt ? new Date(completedAt) : new Date(),
  });

  // ── 4. Propagate COMPLETED to the parent Request ──────────
  // The Request no longer carries IN_PROGRESS; COMPLETED on the Request
  // is the authoritative signal for the DONE tab. Only update if the
  // request is currently ASSIGNED (prevents overwriting terminal states).
  if (updated.requestId) {
    try {
      const req = await ctx.prisma.request.findUnique({
        where: { id: updated.requestId },
        select: { status: true },
      });
      if (req?.status === RequestStatus.ASSIGNED) {
        await updateRequestStatus(ctx.prisma, updated.requestId, RequestStatus.COMPLETED);
      }
    } catch (err) {
      console.warn("[completeJobWorkflow] Failed to propagate COMPLETED to Request:", err);
    }
  }

  // ── 5. Auto-create invoice if cost provided ────────────────
  let invoiceAutoCreated = false;
  if (updated.actualCost) {
    try {
      await getOrCreateInvoiceForJob(orgId, jobId, updated.actualCost);
      invoiceAutoCreated = true;
    } catch (err) {
      console.warn("Failed to auto-create invoice for job", jobId, err);
    }
  }

  // ── 5. Emit event ─────────────────────────────────────────
  emit({
    type: "JOB_COMPLETED",
    orgId,
    actorUserId: ctx.actorUserId,
    payload: { jobId, requestId: updated.requestId, invoiceAutoCreated },
  }).catch((err) => console.error("[EVENT] Failed to emit JOB_COMPLETED", err));

  return { dto: updated, invoiceAutoCreated };
}
