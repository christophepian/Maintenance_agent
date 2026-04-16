/**
 * seed-demo-requests.js
 *
 * Creates 6 requests covering every key lifecycle stage, plus upserting
 * BuildingConfig.requireOwnerApprovalAbove = 800 so the owner-approval
 * flow is actually triggerable.
 *
 * Run AFTER reset-requests.js:
 *   node apps/api/scripts/reset-requests.js
 *   node apps/api/scripts/seed-demo-requests.js
 */

const { PrismaClient } = require("@prisma/client");
const p = new PrismaClient();

const ORG    = "default-org";
const BLDG   = "6de9370d-788d-438e-9be8-3183f52fca1f"; // Legal Test Building (ZH)
const UNIT   = "8a205d5d-3b58-4973-ad8c-1fd08e96b77a"; // L01
const TENANT = "0b81edc3-b352-491e-8de9-d94e05505874"; // Marco Rossi

const PLOMBERIE = "66d01d81-ad83-4c19-a3ab-382ea826613c"; // Plomberie Suisse SA
const ELECTRO   = "d85feee5-7a82-4447-a088-4bc64f9698bc"; // ElectroPro GmbH
const CHAUFFAGE = "dafd501e-8006-49aa-a2b4-25702d299ca5"; // Chauffage et Toitures Sarl
const ALLROUND  = "c26c08cf-e618-49eb-84c5-7b024be43e15"; // AllRound Handwerk AG

(async () => {
  console.log("🌱  Seeding demo requests…\n");

  // ── 0. Upsert BuildingConfig ──────────────────────────────────
  await p.buildingConfig.upsert({
    where:  { buildingId: BLDG },
    update: { requireOwnerApprovalAbove: 800 },
    create: { orgId: ORG, buildingId: BLDG, requireOwnerApprovalAbove: 800 },
  });
  console.log("  ✅  BuildingConfig.requireOwnerApprovalAbove = CHF 800\n");

  // ── 1. PENDING_REVIEW ─────────────────────────────────────────
  const r1 = await p.request.create({
    data: {
      orgId: ORG,
      unitId: UNIT,
      tenantId: TENANT,
      status: "PENDING_REVIEW",
      category: "HVAC",
      urgency: "HIGH",
      description:
        "Heating system not producing heat in bedroom and living room. " +
        "Tenant reports radiators are completely cold despite thermostat set to 22°C.",
      contactPhone: "+41776665544",
      estimatedCost: 350,
    },
  });
  console.log(`  #${String(r1.requestNumber).padEnd(4)} PENDING_REVIEW         ${r1.id}`);

  // ── 2. RFP_PENDING (legally obligated, open RFP, 2 quotes) ───
  const r2 = await p.request.create({
    data: {
      orgId: ORG,
      unitId: UNIT,
      tenantId: TENANT,
      status: "RFP_PENDING",
      category: "Plumbing",
      urgency: "HIGH",
      description:
        "Persistent water leak under kitchen sink causing water damage to cabinet floor. " +
        "Tenant reports water pooling daily. Legal obligation confirmed.",
      contactPhone: "+41776665544",
      estimatedCost: 600,
    },
  });
  const rfp2 = await p.rfp.create({
    data: {
      orgId: ORG,
      buildingId: BLDG,
      unitId: UNIT,
      requestId: r2.id,
      category: "Plumbing",
      legalObligation: "OBLIGATED",
      status: "OPEN",
      inviteCount: 3,
      deadlineAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
    },
  });
  await p.rfpQuote.create({
    data: {
      rfpId: rfp2.id,
      contractorId: PLOMBERIE,
      amountCents: 58000,
      estimatedDurationDays: 1,
      notes: "Replace drain pipe and re-seal. Includes waterproofing of cabinet base.",
      status: "SUBMITTED",
    },
  });
  await p.rfpQuote.create({
    data: {
      rfpId: rfp2.id,
      contractorId: ALLROUND,
      amountCents: 65000,
      estimatedDurationDays: 2,
      notes: "Full inspection, pipe replacement and 2-year leak warranty.",
      status: "SUBMITTED",
    },
  });
  console.log(`  #${String(r2.requestNumber).padEnd(4)} RFP_PENDING            ${r2.id}`);

  // ── 3. PENDING_OWNER_APPROVAL (quote > CHF 800 threshold) ─────
  const r3 = await p.request.create({
    data: {
      orgId: ORG,
      unitId: UNIT,
      tenantId: TENANT,
      status: "PENDING_OWNER_APPROVAL",
      category: "Electrical",
      urgency: "MEDIUM",
      description:
        "Main electrical panel (1985 model) requires full upgrade to meet current Swiss safety " +
        "standards. Flagged by building inspector. Non-emergency but must be resolved within 6 months.",
      contactPhone: "+41776665544",
      estimatedCost: 1200,
    },
  });
  const rfp3 = await p.rfp.create({
    data: {
      orgId: ORG,
      buildingId: BLDG,
      unitId: UNIT,
      requestId: r3.id,
      category: "Electrical",
      legalObligation: "DISCRETIONARY",
      status: "PENDING_OWNER_APPROVAL",
      inviteCount: 3,
      awardedContractorId: ELECTRO,
    },
  });
  const q3Awarded = await p.rfpQuote.create({
    data: {
      rfpId: rfp3.id,
      contractorId: ELECTRO,
      amountCents: 120000, // CHF 1 200 — exceeds 800 threshold
      estimatedDurationDays: 2,
      notes: "Full panel replacement, cabling, and certification. Includes all permits.",
      status: "AWARDED",
    },
  });
  await p.rfpQuote.create({
    data: {
      rfpId: rfp3.id,
      contractorId: ALLROUND,
      amountCents: 150000, // CHF 1 500
      estimatedDurationDays: 3,
      notes: "Premium upgrade with 5-year parts and labour warranty.",
      status: "REJECTED",
    },
  });
  await p.rfp.update({
    where: { id: rfp3.id },
    data:  { awardedQuoteId: q3Awarded.id },
  });
  console.log(`  #${String(r3.requestNumber).padEnd(4)} PENDING_OWNER_APPROVAL ${r3.id}`);

  // ── 4. ASSIGNED (job PENDING) ─────────────────────────────────
  const r4 = await p.request.create({
    data: {
      orgId: ORG,
      unitId: UNIT,
      tenantId: TENANT,
      status: "ASSIGNED",
      category: "Painting",
      urgency: "LOW",
      description:
        "Hallway and kitchen walls need repainting after minor water damage from upstairs unit. " +
        "Surfaces are dry and primed. Contractor confirmed for next week.",
      contactPhone: "+41776665544",
      estimatedCost: 450,
      assignedContractorId: ALLROUND,
    },
  });
  await p.job.create({
    data: {
      orgId: ORG,
      requestId: r4.id,
      contractorId: ALLROUND,
      status: "PENDING",
    },
  });
  console.log(`  #${String(r4.requestNumber).padEnd(4)} ASSIGNED               ${r4.id}`);

  // ── 5. IN_PROGRESS ────────────────────────────────────────────
  const startedAt5 = new Date(Date.now() - 2 * 24 * 60 * 60 * 1000);
  const r5 = await p.request.create({
    data: {
      orgId: ORG,
      unitId: UNIT,
      tenantId: TENANT,
      status: "IN_PROGRESS",
      category: "Roofing",
      urgency: "HIGH",
      description:
        "Roof insulation degraded in two sections above top-floor units. Water ingress detected " +
        "during last rain event. Contractor on site, work in progress.",
      contactPhone: "+41776665544",
      estimatedCost: 2200,
      assignedContractorId: CHAUFFAGE,
      startedAt: startedAt5,
    },
  });
  await p.job.create({
    data: {
      orgId: ORG,
      requestId: r5.id,
      contractorId: CHAUFFAGE,
      status: "IN_PROGRESS",
      startedAt: startedAt5,
    },
  });
  console.log(`  #${String(r5.requestNumber).padEnd(4)} IN_PROGRESS            ${r5.id}`);

  // ── 6. COMPLETED + INVOICED ───────────────────────────────────
  const completedAt6 = new Date(Date.now() - 5 * 24 * 60 * 60 * 1000);
  const r6 = await p.request.create({
    data: {
      orgId: ORG,
      unitId: UNIT,
      tenantId: TENANT,
      status: "COMPLETED",
      category: "Glazing",
      urgency: "MEDIUM",
      description:
        "Double-glazed window in living room cracked due to thermal stress. Replaced with equivalent " +
        "energy-rated unit. Work completed, area clean.",
      contactPhone: "+41776665544",
      estimatedCost: 380,
      assignedContractorId: ALLROUND,
      completedAt: completedAt6,
    },
  });
  const job6 = await p.job.create({
    data: {
      orgId: ORG,
      requestId: r6.id,
      contractorId: ALLROUND,
      status: "COMPLETED",
      actualCost: 38000,
      startedAt: new Date(completedAt6.getTime() - 4 * 60 * 60 * 1000),
      completedAt: completedAt6,
    },
  });
  await p.invoice.create({
    data: {
      orgId: ORG,
      jobId: job6.id,
      contractorId: ALLROUND,
      direction: "OUTGOING",
      sourceChannel: "MANUAL",
      status: "ISSUED",
      amount: 38000,
      subtotalAmount: 35283,
      vatAmount:      2717,
      vatRate:        7.7,
      totalAmount:    38000,
      currency: "CHF",
      description: "Window replacement — Unit L01, Legal Test Building",
      recipientName:         "Marco Rossi",
      recipientAddressLine1: "Teststrasse 1",
      recipientPostalCode:   "8001",
      recipientCity:         "Zürich",
      issueDate: new Date(completedAt6.getTime() + 24 * 60 * 60 * 1000),
      dueDate:   new Date(completedAt6.getTime() + 31 * 24 * 60 * 60 * 1000),
    },
  });
  console.log(`  #${String(r6.requestNumber).padEnd(4)} COMPLETED + INVOICED   ${r6.id}`);

  console.log("\n✅  Done.\n");
  console.log("Manager view:");
  console.log(`  http://localhost:3000/manager/requests/${r1.id}  (PENDING_REVIEW)`);
  console.log(`  http://localhost:3000/manager/requests/${r2.id}  (RFP_PENDING)`);
  console.log(`  http://localhost:3000/manager/requests/${r3.id}  (PENDING_OWNER_APPROVAL)`);
  console.log(`  http://localhost:3000/manager/requests/${r4.id}  (ASSIGNED)`);
  console.log(`  http://localhost:3000/manager/requests/${r5.id}  (IN_PROGRESS)`);
  console.log(`  http://localhost:3000/manager/requests/${r6.id}  (COMPLETED + INVOICED)`);
  console.log("\nOwner view (approval needed):");
  console.log(`  http://localhost:3000/owner/requests/${r3.id}`);

  await p.$disconnect();
})().catch((e) => {
  console.error("❌  Seed failed:", e.message);
  process.exit(1);
});
