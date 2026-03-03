/**
 * seed-docs-and-cleanup.js
 *
 * 1. Delete duplicate applications (keep one per person per unit)
 * 2. Insert fake attachment records with varying completeness
 * 3. Re-evaluate all submitted applications
 *
 * Usage: node seed-docs-and-cleanup.js
 */

const { PrismaClient } = require("@prisma/client");
const prisma = new PrismaClient();

const TARGET_UNIT = "00390975-d33d-4ad7-b18e-0fe1b2a809fc";

// Document profiles per candidate name → which docs they have
// Valid doc types: IDENTITY, SALARY_PROOF, PERMIT, DEBT_ENFORCEMENT_EXTRACT,
//                  HOUSEHOLD_INSURANCE, STUDENT_PROOF, PARKING_DOCS
// Required: IDENTITY, SALARY_PROOF, DEBT_ENFORCEMENT_EXTRACT
const DOC_PROFILES = {
  "Elena Weber": {
    required: ["IDENTITY", "SALARY_PROOF", "DEBT_ENFORCEMENT_EXTRACT"],
    optional: ["PERMIT", "HOUSEHOLD_INSURANCE", "PARKING_DOCS"],  // 3 optional
  },
  "Sophie Müller": {
    required: ["IDENTITY", "SALARY_PROOF", "DEBT_ENFORCEMENT_EXTRACT"],
    optional: ["HOUSEHOLD_INSURANCE"],  // 1 optional
  },
  "Thomas Fischer": {
    required: ["IDENTITY", "SALARY_PROOF", "DEBT_ENFORCEMENT_EXTRACT"],
    optional: [],  // all required, no optional
  },
  "Marc Dubois": {
    required: ["IDENTITY", "SALARY_PROOF"], // missing debt extract
    optional: [],
  },
  "Anna Keller": {
    required: ["IDENTITY"], // missing salary + debt extract
    optional: [],
  },
  "Luca Bernasconi": {
    required: [], // no docs at all
    optional: [],
  },
  "john doe": {
    required: ["IDENTITY", "SALARY_PROOF"], // missing debt extract
    optional: ["PERMIT"],
  },
  "John Doe": {
    required: ["IDENTITY", "SALARY_PROOF"],
    optional: ["PERMIT"],
  },
};

async function main() {
  console.log("=== Step 1: Remove duplicate applications ===\n");

  // Get all submitted applications for the target unit
  const unitApps = await prisma.rentalApplicationUnit.findMany({
    where: { unitId: TARGET_UNIT },
    include: {
      application: {
        include: {
          applicants: true,
        },
      },
    },
    orderBy: { createdAt: "asc" },
  });

  // Group by primary applicant name
  const byName = {};
  for (const ua of unitApps) {
    const app = ua.application;
    if (app.status === "DRAFT") continue;
    const primary = app.applicants.find((a) => a.role === "PRIMARY");
    if (!primary) continue;
    const name = `${primary.firstName} ${primary.lastName}`;
    if (!byName[name]) byName[name] = [];
    byName[name].push({ unitApp: ua, application: app, primary });
  }

  // Keep oldest, delete duplicates
  const toDelete = [];
  for (const [name, entries] of Object.entries(byName)) {
    if (entries.length > 1) {
      console.log(`  ${name}: ${entries.length} apps → keeping 1, deleting ${entries.length - 1}`);
      // Keep first, delete rest (cascade will remove unitApps, applicants, attachments)
      for (let i = 1; i < entries.length; i++) {
        toDelete.push(entries[i].application.id);
      }
    } else {
      console.log(`  ${name}: 1 app (no duplicates)`);
    }
  }

  if (toDelete.length > 0) {
    const deleted = await prisma.rentalApplication.deleteMany({
      where: { id: { in: toDelete } },
    });
    console.log(`\n  Deleted ${deleted.count} duplicate applications\n`);
  } else {
    console.log("\n  No duplicates to delete\n");
  }

  console.log("=== Step 2: Seed document records ===\n");

  // Re-fetch remaining applications for the target unit
  const remaining = await prisma.rentalApplicationUnit.findMany({
    where: { unitId: TARGET_UNIT },
    include: {
      application: {
        include: {
          applicants: true,
          attachments: true,
        },
      },
    },
  });

  for (const ua of remaining) {
    const app = ua.application;
    if (app.status === "DRAFT") continue;

    const primary = app.applicants.find((a) => a.role === "PRIMARY");
    if (!primary) continue;
    const name = `${primary.firstName} ${primary.lastName}`;
    const profile = DOC_PROFILES[name];

    if (!profile) {
      console.log(`  ${name}: no doc profile defined, skipping`);
      continue;
    }

    // Delete existing attachments (clean slate)
    await prisma.rentalAttachment.deleteMany({
      where: { applicationId: app.id },
    });

    const allDocs = [...profile.required, ...profile.optional];

    if (allDocs.length === 0) {
      console.log(`  ${name}: no docs (intentionally empty)`);
      continue;
    }

    // Create attachment records for each applicant
    for (const applicant of app.applicants) {
      for (const docType of allDocs) {
        await prisma.rentalAttachment.create({
          data: {
            applicationId: app.id,
            applicantId: applicant.id,
            docType,
            fileName: `${docType.toLowerCase()}_${applicant.firstName}.pdf`,
            fileSizeBytes: 50000 + Math.floor(Math.random() * 100000),
            mimeType: "application/pdf",
            storageKey: `test/${app.id}/${applicant.id}/${docType}`,
            sha256: require("crypto").randomBytes(32).toString("hex"),
          },
        });
      }
    }

    console.log(`  ${name}: seeded ${allDocs.length} doc types (${allDocs.join(", ")})`);
  }

  console.log("\n=== Step 3: Re-evaluate all applications ===\n");

  // Import the evaluate function by loading it directly
  // Since this is a JS script running against the compiled output or raw TS,
  // we'll do the evaluation via direct DB update using the same logic

  const REQUIRED_DOC_TYPES = ["IDENTITY", "SALARY_PROOF", "DEBT_ENFORCEMENT_EXTRACT"];

  // Get unit info for scoring
  const unit = await prisma.unit.findUnique({
    where: { id: TARGET_UNIT },
    include: { building: true },
  });

  const monthlyRentChf = unit.monthlyRentChf || 1500;
  const monthlyChargesChf = unit.monthlyChargesChf || 250;
  const incomeMultiplier = 3; // default

  const totalCost = monthlyRentChf + monthlyChargesChf;
  const requiredIncome = incomeMultiplier * totalCost;

  console.log(`  Unit: ${unit.unitNumber} | rent=${monthlyRentChf} + charges=${monthlyChargesChf} | required income=${requiredIncome}\n`);

  // Re-fetch with fresh data
  const appsToEval = await prisma.rentalApplicationUnit.findMany({
    where: { unitId: TARGET_UNIT },
    include: {
      application: {
        include: {
          applicants: true,
          attachments: true,
        },
      },
    },
  });

  const RENTAL_DOC_TYPES = [
    "IDENTITY", "SALARY_PROOF", "DEBT_ENFORCEMENT_EXTRACT",
    "PERMIT", "HOUSEHOLD_INSURANCE", "STUDENT_PROOF", "PARKING_DOCS",
  ];
  const optionalDocTypes = RENTAL_DOC_TYPES.filter((dt) => !REQUIRED_DOC_TYPES.includes(dt));

  const knownEmployers = [
    "google", "ubs", "credit suisse", "novartis", "roche", "zurich insurance",
    "swiss re", "nestle", "abb", "sbb", "post", "swisscom", "migros", "coop",
    "swatch", "lonza", "holcim", "siemens", "accenture", "deloitte", "pwc",
    "kpmg", "ey", "mckinsey", "bcg",
  ];

  const results = [];

  for (const ua of appsToEval) {
    const app = ua.application;
    if (app.status === "DRAFT") continue;

    const applicants = app.applicants;
    const attachments = app.attachments;

    const primary = applicants.find((a) => a.role === "PRIMARY");
    const name = primary ? `${primary.firstName} ${primary.lastName}` : "Unknown";

    // ── Evaluate ──
    const reasons = [];
    const missingDocs = [];
    let disqualified = false;

    // Total income
    const totalMonthlyIncome = applicants.reduce((s, a) => s + (a.netMonthlyIncome || 0), 0);
    const incomeRatio = requiredIncome > 0 ? totalMonthlyIncome / requiredIncome : 999;

    // Income check
    if (totalMonthlyIncome < requiredIncome) {
      disqualified = true;
      reasons.push(`INSUFFICIENT_INCOME: ${totalMonthlyIncome} < ${requiredIncome}`);
    }

    // Doc check
    for (const applicant of applicants) {
      const applicantDocs = attachments
        .filter((att) => att.applicantId === applicant.id)
        .map((att) => att.docType);
      const missing = REQUIRED_DOC_TYPES.filter((dt) => !applicantDocs.includes(dt));
      if (missing.length > 0) {
        disqualified = true;
        for (const doc of missing) missingDocs.push(`${applicant.firstName}: ${doc}`);
        reasons.push(`MISSING_DOCS: ${applicant.firstName} missing ${missing.join(", ")}`);
      }
    }

    // Debt enforcement
    let debtPenalty = 0;
    for (const a of applicants) {
      if (a.hasDebtEnforcement) {
        debtPenalty += 100;
        reasons.push(`DEBT: ${a.firstName}`);
      }
    }

    // Scoring
    const incomeScore = Math.min(400, Math.round(incomeRatio * 200));

    const totalReqDocs = applicants.length * REQUIRED_DOC_TYPES.length;
    const presentDocs = totalReqDocs - missingDocs.length;
    const docScore = totalReqDocs > 0 ? Math.round((presentDocs / totalReqDocs) * 300) : 300;

    let empScore = 0;
    for (const a of applicants) {
      if (a.employedSince) {
        const years = (Date.now() - new Date(a.employedSince).getTime()) / (365.25 * 24 * 60 * 60 * 1000);
        empScore += Math.min(100, Math.round(years * 50));
      }
    }
    empScore = Math.min(200, empScore);

    const scoreTotal = Math.max(0, incomeScore + docScore + empScore - debtPenalty);

    // Confidence
    let confidence = 0;

    // Doc-based (max 50)
    if (attachments.some((a) => a.docType === "SALARY_PROOF")) confidence += 12;
    if (attachments.some((a) => a.docType === "IDENTITY")) confidence += 10;
    if (attachments.some((a) => a.docType === "DEBT_ENFORCEMENT_EXTRACT")) confidence += 8;
    if (missingDocs.length === 0) confidence += 10;
    const optPresent = optionalDocTypes.filter((dt) => attachments.some((a) => a.docType === dt)).length;
    confidence += Math.min(10, optPresent * 2);

    // Data-based (max 50)
    if (applicants.some((a) => a.employer && a.netMonthlyIncome)) confidence += 10;
    if (applicants.some((a) => a.employedSince)) confidence += 8;
    if (incomeRatio >= 1.8) confidence += 12;
    else if (incomeRatio >= 1.3) confidence += 8;
    else if (incomeRatio >= 1.0) confidence += 4;
    if (applicants.some((a) => a.employer && knownEmployers.some((e) => a.employer.toLowerCase().includes(e)))) confidence += 5;
    if (debtPenalty > 0) confidence += 5;
    if (applicants.length > 1) confidence += 5;

    const confidenceScore = Math.min(100, confidence);

    // Update DB
    await prisma.rentalApplicationUnit.update({
      where: { id: ua.id },
      data: {
        scoreTotal,
        confidenceScore,
        disqualified,
        disqualifiedReasons: reasons.length > 0 ? reasons : undefined,
      },
    });

    results.push({ name, scoreTotal, confidenceScore, disqualified, reasons: reasons.slice(0, 2) });
  }

  // Sort by score descending
  results.sort((a, b) => b.scoreTotal - a.scoreTotal);

  // Assign ranks
  console.log("  Results (sorted by score):\n");
  console.log("  Name                  | Score | Conf | Disq | Reasons");
  console.log("  " + "-".repeat(80));

  let rank = 1;
  for (const r of results) {
    const reasonStr = r.reasons.join("; ").substring(0, 40);
    console.log(
      `  ${r.name.padEnd(22)} | ${String(r.scoreTotal).padStart(5)} | ${String(r.confidenceScore).padStart(4)}% | ${r.disqualified ? "YES" : " NO"} | ${reasonStr}`
    );

    // Update rank in DB
    const ua = appsToEval.find((u) => {
      const p = u.application.applicants.find((a) => a.role === "PRIMARY");
      return p && `${p.firstName} ${p.lastName}` === r.name;
    });
    if (ua) {
      await prisma.rentalApplicationUnit.update({
        where: { id: ua.id },
        data: { rank },
      });
    }
    rank++;
  }

  console.log("\n✅ Done! Refresh the UI to see updated scores.");
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
