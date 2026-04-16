/**
 * reset-requests.js
 *
 * Truncates all request-lifecycle data for the default org while leaving
 * reference data intact (buildings, units, tenants, contractors, org config,
 * users, building config).
 *
 * Deletion order respects FK constraints:
 *   Invoices → Jobs → RFPs (cascades quotes+invites) → Requests
 *   (cascades events+attachments) → orphan Events → EvaluationLogs
 *
 * Usage:  node apps/api/scripts/reset-requests.js
 */

const { PrismaClient } = require("@prisma/client");
const p = new PrismaClient();

const ORG = "default-org";

(async () => {
  console.log(`⚠️  Resetting all request/job/invoice data for org "${ORG}"…\n`);

  // 1. Invoices (reference jobId → must go before jobs)
  const inv = await p.invoice.deleteMany({ where: { orgId: ORG } });
  console.log(`  🗑  Invoices:          ${inv.count}`);

  // 2. Jobs (cascade: AssetIntervention, AppointmentSlot, JobRating)
  const jobs = await p.job.deleteMany({ where: { orgId: ORG } });
  console.log(`  🗑  Jobs:              ${jobs.count}`);

  // 3. RFPs (cascade: RfpQuote, RfpInvite)
  const rfps = await p.rfp.deleteMany({ where: { orgId: ORG } });
  console.log(`  🗑  RFPs:              ${rfps.count}`);

  // 4. Requests (cascade: RequestEvent, MaintenanceAttachment)
  const reqs = await p.request.deleteMany({ where: { orgId: ORG } });
  console.log(`  🗑  Requests:          ${reqs.count}`);

  // 5. Domain Event log entries tied to requests
  const evts = await p.event.deleteMany({
    where: { orgId: ORG, requestId: { not: null } },
  });
  console.log(`  🗑  Domain events:     ${evts.count}`);

  // 6. Legal evaluation logs (requestId column, no cascade)
  const evals = await p.legalEvaluationLog.deleteMany({
    where: { orgId: ORG },
  });
  console.log(`  🗑  Evaluation logs:   ${evals.count}`);

  console.log("\n✅  Done — reference data (buildings, tenants, contractors, org config) untouched.");
  await p.$disconnect();
})().catch((e) => {
  console.error("❌  Reset failed:", e.message);
  process.exit(1);
});
