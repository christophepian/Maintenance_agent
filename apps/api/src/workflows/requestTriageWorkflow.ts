/**
 * requestTriageWorkflow
 *
 * Async handler for the REQUEST_CREATED event.
 * Enriches the request with contractor suggestions and a budget hint,
 * then marks triageCompletedAt.
 *
 * Always async — never blocks the create-request path.
 * Errors are swallowed (bus pattern) — triageCompletedAt is only set
 * on success so the manager sees no stale panel on failure.
 */

import { PrismaClient } from "@prisma/client";
import { computeTriage } from "../services/requestTriageService";
import { updateRequestTriageFields } from "../repositories/contractorRepository";

export async function requestTriageWorkflow(
  prisma: PrismaClient,
  opts: {
    requestId: string;
    orgId: string;
    category: string | null | undefined;
  },
): Promise<void> {
  const { requestId, orgId, category } = opts;

  // Resolve the buildingId for the request (needed for building-match scoring)
  const request = await prisma.request.findUnique({
    where: { id: requestId },
    select: {
      unit: {
        select: {
          building: { select: { id: true } },
        },
      },
    },
  });
  const buildingId = request?.unit?.building?.id ?? null;

  const result = await computeTriage(prisma, { orgId, category, buildingId });

  await updateRequestTriageFields(prisma, requestId, {
    triageContractorIds: result.contractorIds,
    triageBudgetMin: result.budgetMin,
    triageBudgetMax: result.budgetMax,
    triageCompletedAt: new Date(),
  });
}
