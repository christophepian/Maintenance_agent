/**
 * One-time ledger backfill
 *
 * Posts INVOICE_ISSUED and INVOICE_PAID ledger entries for all historical
 * invoices that transitioned to ISSUED/APPROVED/PAID before the ledger
 * service existed. Safe to run multiple times — skips invoices that already
 * have an entry.
 *
 * Prerequisites:
 *   - Chart of Accounts must be seeded for each org (POST /coa/seed or
 *     `seedSwissTaxonomy`). If accounts 4200/2000/1020 are missing the
 *     posting is silently skipped by ledgerService — this script warns you.
 *
 * Usage:
 *   npx ts-node --transpile-only scripts/backfillLedger.ts
 *   npx ts-node --transpile-only scripts/backfillLedger.ts --orgId=<id>
 *   npx ts-node --transpile-only scripts/backfillLedger.ts --seed-coa --issue-drafts
 *
 * Dry-run (inspect only, no writes):
 *   DRY_RUN=1 npx ts-node --transpile-only scripts/backfillLedger.ts
 */

import { PrismaClient, InvoiceStatus } from "@prisma/client";
import { getInvoice } from "../src/services/invoices";
import { postInvoiceIssued, postInvoicePaid } from "../src/services/ledgerService";
import { seedSwissTaxonomy } from "../src/services/coaService";
import { issueInvoiceWorkflow } from "../src/workflows/issueInvoiceWorkflow";

const prisma = new PrismaClient();
const DRY_RUN     = process.env.DRY_RUN === "1";
const SEED_COA    = process.argv.includes("--seed-coa");
const ISSUE_DRAFTS = process.argv.includes("--issue-drafts");

// Parse optional --orgId=<value> CLI arg
const orgIdArg = process.argv.find((a) => a.startsWith("--orgId="))?.split("=")[1];

async function getOrgsToProcess(): Promise<string[]> {
  if (orgIdArg) return [orgIdArg];
  const orgs = await prisma.org.findMany({ select: { id: true } });
  return orgs.map((o) => o.id);
}

async function checkAccounts(orgId: string): Promise<boolean> {
  const needed = ["4200", "2000", "1020"];
  const found = await prisma.account.findMany({
    where: { orgId, code: { in: needed }, isActive: true },
    select: { code: true },
  });
  const foundCodes = found.map((a) => a.code);
  const missing = needed.filter((c) => !foundCodes.includes(c));
  if (missing.length > 0) {
    console.warn(`  ⚠  Org ${orgId}: accounts ${missing.join(", ")} not seeded — posting will be skipped`);
    console.warn(`     Run POST /coa/seed for this org first, then re-run this script`);
    return false;
  }
  return true;
}

async function backfillOrg(orgId: string) {
  console.log(`\nOrg ${orgId}`);

  // Optionally seed COA first
  if (SEED_COA) {
    if (DRY_RUN) {
      console.log("  [DRY RUN] Would seed Swiss Kontenplan");
    } else {
      const result = await seedSwissTaxonomy(prisma, orgId);
      console.log(`  COA seeded: ${result.accounts} accounts, ${result.expenseTypes} expense types`);
    }
  }

  // Issue DRAFT invoices via workflow (which also fires postInvoiceIssued)
  if (ISSUE_DRAFTS) {
    const drafts = await prisma.invoice.findMany({
      where: { orgId, status: InvoiceStatus.DRAFT },
      select: { id: true },
    });
    console.log(`  DRAFT invoices to issue: ${drafts.length}`);
    if (!DRY_RUN) {
      let ok = 0, skip = 0;
      for (const inv of drafts) {
        try {
          await issueInvoiceWorkflow({ orgId, prisma, actorUserId: null }, { invoiceId: inv.id });
          ok++;
        } catch (e: any) {
          console.warn(`  Skipping DRAFT ${inv.id}: ${e.message}`);
          skip++;
        }
      }
      console.log(`  Issued: ✓ ${ok}  skipped ${skip}`);
    }
  }

  // Check accounts before bothering to query invoices
  const accountsOk = await checkAccounts(orgId);

  // Collect sourceIds already in ledger for this org
  const existingIssued = new Set(
    (await prisma.ledgerEntry.findMany({
      where: { orgId, sourceType: "INVOICE_ISSUED" },
      select: { sourceId: true },
    })).map((e) => e.sourceId).filter(Boolean) as string[],
  );
  const existingPaid = new Set(
    (await prisma.ledgerEntry.findMany({
      where: { orgId, sourceType: "INVOICE_PAID" },
      select: { sourceId: true },
    })).map((e) => e.sourceId).filter(Boolean) as string[],
  );

  // Invoices that need INVOICE_ISSUED
  const needIssued = await prisma.invoice.findMany({
    where: {
      orgId,
      status: { in: [InvoiceStatus.ISSUED, InvoiceStatus.APPROVED, InvoiceStatus.PAID] },
    },
    select: { id: true, status: true },
    orderBy: { createdAt: "asc" },
  });

  const toIssue = needIssued.filter((i) => !existingIssued.has(i.id));
  const toPay   = needIssued.filter((i) => i.status === InvoiceStatus.PAID && !existingPaid.has(i.id));

  console.log(`  INVOICE_ISSUED to post: ${toIssue.length}  (already posted: ${existingIssued.size})`);
  console.log(`  INVOICE_PAID   to post: ${toPay.length}  (already posted: ${existingPaid.size})`);

  if (DRY_RUN) {
    console.log("  [DRY RUN] — no writes performed");
    return;
  }

  if (!accountsOk) {
    console.log("  Skipping writes — required accounts missing");
    return;
  }

  // Post INVOICE_ISSUED
  let issuedOk = 0, issuedSkipped = 0, issuedErr = 0;
  for (const inv of toIssue) {
    try {
      const dto = await getInvoice(inv.id);
      if (!dto) { issuedSkipped++; continue; }
      const result = await postInvoiceIssued(prisma, orgId, dto);
      if (result) { issuedOk++; } else { issuedSkipped++; }
    } catch (e) {
      console.error(`  Error posting INVOICE_ISSUED for ${inv.id}:`, e);
      issuedErr++;
    }
  }
  console.log(`  INVOICE_ISSUED: ✓ ${issuedOk}  skipped ${issuedSkipped}  errors ${issuedErr}`);

  // Post INVOICE_PAID
  let paidOk = 0, paidSkipped = 0, paidErr = 0;
  for (const inv of toPay) {
    try {
      const dto = await getInvoice(inv.id);
      if (!dto) { paidSkipped++; continue; }
      const result = await postInvoicePaid(prisma, orgId, dto);
      if (result) { paidOk++; } else { paidSkipped++; }
    } catch (e) {
      console.error(`  Error posting INVOICE_PAID for ${inv.id}:`, e);
      paidErr++;
    }
  }
  console.log(`  INVOICE_PAID:   ✓ ${paidOk}  skipped ${paidSkipped}  errors ${paidErr}`);
}

async function main() {
  console.log(DRY_RUN ? "=== Ledger backfill (DRY RUN) ===" : "=== Ledger backfill ===");

  const orgIds = await getOrgsToProcess();
  console.log(`Processing ${orgIds.length} org(s)${orgIdArg ? ` (filtered: ${orgIdArg})` : ""}`);

  for (const orgId of orgIds) {
    await backfillOrg(orgId);
  }

  console.log("\nDone.");
}

main()
  .catch((e) => { console.error(e); process.exit(1); })
  .finally(() => prisma.$disconnect());
