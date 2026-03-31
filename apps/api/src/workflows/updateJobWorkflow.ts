/**
 * updateJobWorkflow
 *
 * Canonical entry point for updating a job's status.
 * Delegates to completeJobWorkflow when transitioning to COMPLETED,
 * otherwise performs a direct update via the service layer.
 *
 * CQ-15 resolution: moves completion-check branching out of the route.
 */

import { WorkflowContext } from "./context";
import { completeJobWorkflow } from "./completeJobWorkflow";
import { getJob, updateJob } from "../services/jobs";
import type { JobDTO } from "../services/jobs";

// ─── Input / Output ────────────────────────────────────────────

export interface UpdateJobInput {
  jobId: string;
  status?: string;
  actualCost?: number;
  startedAt?: string;
  completedAt?: string;
}

export interface UpdateJobResult {
  dto: JobDTO;
}

// ─── Workflow ──────────────────────────────────────────────────

export async function updateJobWorkflow(
  ctx: WorkflowContext,
  input: UpdateJobInput,
): Promise<UpdateJobResult> {
  const { orgId } = ctx;

  const job = await getJob(input.jobId);
  if (!job || job.orgId !== orgId) {
    throw Object.assign(new Error("Job not found"), { code: "NOT_FOUND" });
  }

  // Delegate to completeJobWorkflow when transitioning to COMPLETED
  if (input.status === "COMPLETED" && job.status !== "COMPLETED") {
    const result = await completeJobWorkflow(ctx, {
      jobId: input.jobId,
      actualCost: input.actualCost,
      startedAt: input.startedAt,
      completedAt: input.completedAt,
    });
    return { dto: result.dto };
  }

  // Non-completion updates: pass through directly
  const updated = await updateJob(input.jobId, {
    status: input.status as any,
    actualCost: input.actualCost,
    startedAt: input.startedAt ? new Date(input.startedAt) : undefined,
    completedAt: input.completedAt ? new Date(input.completedAt) : undefined,
  });

  return { dto: updated };
}
