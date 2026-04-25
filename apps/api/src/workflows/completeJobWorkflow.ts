/**
 * completeJobWorkflow
 *
 * Canonical entry point for marking a job as completed.
 * Orchestrates:
 *   1. Validate the job exists and belongs to the org
 *   2. Atomically update Job.status=COMPLETED + mirror Request.status=COMPLETED
 *      in a single $transaction (prevents stuck-at-ASSIGNED if mirror fails)
 *   3. Auto-create invoice when job is COMPLETED (idempotent, outside transaction)
 *   4. Emit JOB_COMPLETED event (outside transaction)
 *   5. Return updated job DTO
 */

import { JobStatus, RequestStatus } from "@prisma/client";
import { WorkflowContext } from "./context";
import { assertJobTransition } from "./transitions";
import { emit } from "../events/bus";
import { getJob } from "../services/jobs";
import { getOrCreateInvoiceForJob } from "../services/invoices";
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

  const completedAt_date = completedAt ? new Date(completedAt) : new Date();

  // ── 3+4. Atomically update Job + mirror COMPLETED onto Request ─
  // Both writes are in one transaction: if either fails the other rolls back.
  // This prevents the request from getting stuck at ASSIGNED while Job = COMPLETED.
  // Invoice creation and event emission happen outside (they are idempotent side effects).
  await ctx.prisma.$transaction(async (tx) => {
    await tx.job.update({
      where: { id: jobId },
      data: {
        status: JobStatus.COMPLETED,
        ...(actualCost !== undefined && { actualCost }),
        ...(startedAt && { startedAt: new Date(startedAt) }),
        completedAt: completedAt_date,
      },
    });

    // Mirror COMPLETED onto the parent Request only if it is currently ASSIGNED
    const req = await tx.request.findUnique({
      where: { id: job.requestId! },
      select: { status: true },
    });
    if (req?.status === RequestStatus.ASSIGNED) {
      await tx.request.update({
        where: { id: job.requestId! },
        data: { status: RequestStatus.COMPLETED },
      });
    }
  });

  // Reload the full DTO via the canonical getJob (includes relations)
  const updated = await getJob(jobId);
  if (!updated) {
    throw Object.assign(new Error("Job not found after completion"), { code: "NOT_FOUND" });
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
