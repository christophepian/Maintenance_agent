/**
 * Backfill script — re-triggers legal routing for all PENDING_REVIEW
 * requests that have a unitId. Run once manually.
 *
 * Safe to re-run — evaluateLegalRoutingWorkflow is idempotent:
 * RFP creation checks for existing RFP, status update only fires
 * if current status is still PENDING_REVIEW.
 *
 * Never run against maint_agent_test (dev DB only).
 */

import prisma from "../src/services/prismaClient";
import { evaluateLegalRoutingWorkflow } from "../src/workflows/evaluateLegalRoutingWorkflow";

const DEFAULT_ORG_ID = process.env.DEFAULT_ORG_ID || "default-org";

async function run() {
  const stuck = await prisma.request.findMany({
    where: {
      status: "PENDING_REVIEW",
      unitId: { not: null },
    },
    select: { id: true, category: true, unitId: true },
    orderBy: { createdAt: "asc" },
  });

  console.log(`Found ${stuck.length} PENDING_REVIEW requests with a unit. Re-routing...`);

  const results = { rfpPending: 0, ownerApproval: 0, stayed: 0, failed: 0 };

  for (const req of stuck) {
    try {
      await evaluateLegalRoutingWorkflow(
        { orgId: DEFAULT_ORG_ID, prisma },
        { requestId: req.id },
      );

      const updated = await prisma.request.findUnique({
        where: { id: req.id },
        select: { status: true },
      });

      const newStatus = updated?.status;
      if (newStatus === "RFP_PENDING")              results.rfpPending++;
      else if (newStatus === "PENDING_OWNER_APPROVAL") results.ownerApproval++;
      else                                            results.stayed++;

      console.log(`  ${req.category?.padEnd(20)} → ${newStatus}`);
    } catch (err: any) {
      results.failed++;
      console.error(`  FAILED ${req.id} (${req.category}): ${err.message}`);
    }
  }

  console.log("\n=== Backfill Results ===");
  console.log(`  RFP_PENDING:            ${results.rfpPending}`);
  console.log(`  PENDING_OWNER_APPROVAL: ${results.ownerApproval}`);
  console.log(`  Still PENDING_REVIEW:   ${results.stayed}  (graceful degradation)`);
  console.log(`  Failed:                 ${results.failed}`);

  await prisma.$disconnect();
}

run().catch((e) => { console.error(e); process.exit(1); });
