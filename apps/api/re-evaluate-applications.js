/**
 * Re-evaluate all submitted rental application-units using the updated engine.
 * Run: node apps/api/re-evaluate-applications.js
 */
const { PrismaClient } = require("@prisma/client");
const prisma = new PrismaClient();

// Inline the evaluate function since we can't import TS directly
// We'll call the backend API to trigger re-evaluation instead,
// or directly update via Prisma using the same logic.

// Actually, let's just delete all application-units and re-submit
// the applications to trigger fresh evaluation. Simpler approach:
// call the backend submit endpoint again for each app.

const API = "http://127.0.0.1:3001";

async function main() {
  // Get all submitted applications with their application-units
  const apps = await prisma.rentalApplication.findMany({
    where: { status: "SUBMITTED" },
    include: {
      applicants: true,
      attachments: true,
      applicationUnits: {
        include: {
          unit: {
            include: {
              building: { include: { config: true } },
            },
          },
        },
      },
    },
  });

  console.log(`Found ${apps.length} submitted applications to re-evaluate\n`);

  for (const app of apps) {
    console.log(`Re-evaluating: ${app.id} (${app.applicants[0]?.firstName} ${app.applicants[0]?.lastName})`);

    for (const au of app.applicationUnits) {
      const unit = au.unit;
      const config = unit?.building?.config;
      const monthlyRentChf = unit?.monthlyRentChf || 0;
      const monthlyChargesChf = unit?.monthlyChargesChf || 0;
      const incomeMultiplier = config?.rentalIncomeMultiplier || 3;

      // Rebuild evaluation input
      const totalCost = monthlyRentChf + monthlyChargesChf;
      const requiredIncome = incomeMultiplier * totalCost;
      const totalMonthlyIncome = app.applicants.reduce((s, a) => s + (a.netMonthlyIncome || 0), 0);
      const incomeRatio = requiredIncome > 0 ? totalMonthlyIncome / requiredIncome : 999;

      const attachments = app.attachments.map(a => ({ applicantId: a.applicantId, docType: a.docType }));

      // --- Replicate confidence logic from updated rentalRules.ts ---
      let confidence = 0;

      // Document-based (max 50)
      if (attachments.some(a => a.docType === "SALARY_PROOF")) confidence += 12;
      if (attachments.some(a => a.docType === "IDENTITY")) confidence += 10;
      if (attachments.some(a => a.docType === "DEBT_ENFORCEMENT_EXTRACT")) confidence += 8;

      const REQUIRED_DOC_TYPES = ["IDENTITY", "SALARY_PROOF", "DEBT_ENFORCEMENT_EXTRACT"];
      let missingCount = 0;
      for (const applicant of app.applicants) {
        const applicantDocs = attachments.filter(a => a.applicantId === applicant.id).map(a => a.docType);
        missingCount += REQUIRED_DOC_TYPES.filter(dt => !applicantDocs.includes(dt)).length;
      }
      if (missingCount === 0) confidence += 10;

      const OPTIONAL_DOC_TYPES = ["PERMIT", "HOUSEHOLD_INSURANCE", "STUDENT_PROOF", "PARKING_DOCS"];
      const optionalPresent = OPTIONAL_DOC_TYPES.filter(dt => attachments.some(a => a.docType === dt)).length;
      confidence += Math.min(10, optionalPresent * 2);

      // Data-based (max 50)
      if (app.applicants.some(a => a.employer && a.netMonthlyIncome)) confidence += 10;
      if (app.applicants.some(a => a.employedSince)) confidence += 8;

      if (incomeRatio >= 1.8) confidence += 12;
      else if (incomeRatio >= 1.3) confidence += 8;
      else if (incomeRatio >= 1.0) confidence += 4;

      const knownEmployers = [
        "google", "ubs", "credit suisse", "novartis", "roche", "zurich insurance",
        "swiss re", "nestle", "abb", "sbb", "post", "swisscom", "migros", "coop",
        "swatch", "lonza", "holcim", "siemens", "accenture", "deloitte", "pwc",
        "kpmg", "ey", "mckinsey", "bcg",
      ];
      if (app.applicants.some(a => a.employer && knownEmployers.some(e => a.employer.toLowerCase().includes(e)))) {
        confidence += 5;
      }

      const hasDebt = app.applicants.some(a => a.hasDebtEnforcement);
      if (hasDebt) confidence += 5;

      if (app.applicants.length > 1) confidence += 5;

      const confidenceScore = Math.min(100, confidence);

      // --- Replicate score logic ---
      const incomeScore = Math.min(400, Math.round(incomeRatio * 200));

      const totalRequiredDocs = app.applicants.length * REQUIRED_DOC_TYPES.length;
      const totalPresentDocs = totalRequiredDocs - missingCount;
      const docCompletenessScore = totalRequiredDocs > 0 ? Math.round((totalPresentDocs / totalRequiredDocs) * 300) : 300;

      let employmentStabilityScore = 0;
      for (const a of app.applicants) {
        if (a.employedSince) {
          const years = (Date.now() - new Date(a.employedSince).getTime()) / (365.25 * 24 * 60 * 60 * 1000);
          employmentStabilityScore += Math.min(100, Math.round(years * 50));
        }
      }
      employmentStabilityScore = Math.min(200, employmentStabilityScore);

      let debtPenalty = 0;
      for (const a of app.applicants) {
        if (a.hasDebtEnforcement) debtPenalty += 100;
      }

      const scoreTotal = Math.max(0, incomeScore + docCompletenessScore + employmentStabilityScore - debtPenalty);

      const disqualified = totalMonthlyIncome < requiredIncome || missingCount > 0;
      const reasons = [];
      if (totalMonthlyIncome < requiredIncome) reasons.push(`INSUFFICIENT_INCOME: CHF ${totalMonthlyIncome} < CHF ${requiredIncome}`);
      if (missingCount > 0) reasons.push(`MISSING_REQUIRED_DOCS: ${missingCount} documents missing`);
      if (hasDebt) reasons.push("DEBT_ENFORCEMENT: applicant has debt enforcement records");

      await prisma.rentalApplicationUnit.update({
        where: { id: au.id },
        data: {
          scoreTotal,
          confidenceScore,
          disqualified,
          disqualifiedReasons: reasons,
        },
      });

      console.log(`  Unit ${unit?.unitNumber}: score=${scoreTotal}, confidence=${confidenceScore}%, disqualified=${disqualified}`);
    }
  }

  console.log("\n✅ All applications re-evaluated!");
  await prisma.$disconnect();
}

main().catch(e => { console.error(e); process.exit(1); });
