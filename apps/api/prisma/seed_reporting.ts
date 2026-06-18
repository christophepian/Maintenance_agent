/**
 * Reporting dev seed — populates data to trigger all "What to watch" items:
 *   - Arrears 61+ days (red)
 *   - Arrears 31–60 days (amber)
 *   - Collection rate < 95%
 *   - Vacancy < 90%
 *   - Income below projection
 *   - Buildings in red (negative NOI)
 *   - Payables concentration
 *   - Tenant churn (move-in this month)
 */

import { PrismaClient, LeaseStatus, InvoiceStatus, InvoiceDirection, ExpenseCategory } from "@prisma/client";
import { randomUUID } from "crypto";
import { DEFAULT_ORG_ID } from "../src/services/orgConfig";

const prisma = new PrismaClient();
const orgId = DEFAULT_ORG_ID;

const TODAY = new Date("2026-06-17");
const daysAgo = (n: number) => new Date(TODAY.getTime() - n * 86400000);
const cents = (chf: number) => Math.round(chf * 100);

async function getOrCreateAccount(code: string, name: string, accountType: string) {
  const existing = await prisma.account.findFirst({ where: { orgId, code } });
  if (existing) return existing;
  return prisma.account.create({
    data: { orgId, code, name, accountType },
  });
}

async function main() {
  // ── COA (minimal set needed for ledger entries) ───────────────
  const acct1020 = await getOrCreateAccount("1020", "Bank / Cash",         "ASSET");
  const acct1100 = await getOrCreateAccount("1100", "Rent Receivables",    "ASSET");
  const acct2000 = await getOrCreateAccount("2000", "Accounts Payable",    "LIABILITY");
  const acct3200 = await getOrCreateAccount("3200", "Rental Income",       "REVENUE");
  const acct4200 = await getOrCreateAccount("4200", "Maintenance Expense", "EXPENSE");

  // ── Buildings ─────────────────────────────────────────────────
  const [bldA, bldB, bldC] = await Promise.all([
    upsertBuilding("Tour Bellevue",      "12 Route de Chêne",  "Genève",   "1208", "GE"),
    upsertBuilding("Résidence du Lac",   "8 Chemin du Lac",    "Lausanne", "1006", "VD"),
    upsertBuilding("Immeuble Vieux-Port","3 Quai des Bergues", "Genève",   "1201", "GE"),
  ]);

  // ── Units — bldA full, bldB partial vacancy, bldC heavy vacancy
  const unitsA = await createUnits(bldA.id, ["A101","A102","A103","A104","A201","A202"], 3);
  const unitsB = await createUnits(bldB.id, ["B101","B102","B103","B104","B201","B202","B203","B204"], 2.5);
  const unitsC = await createUnits(bldC.id, ["C101","C102","C103","C104","C105"], 3.5);

  // bldA: all 6 occupied  → 100% occupancy
  // bldB: 5 of 8 occupied → 62.5% occupancy (vacancy flag)
  // bldC: 3 of 5 occupied → 60% occupancy

  // ── Leases ────────────────────────────────────────────────────
  // bldA — all units have active leases, CHF 2 000/mo each
  const leasesA = await Promise.all(unitsA.map((u, i) =>
    upsertLease(u.id, `tenant-a${i}@example.com`, `Tenant A${i+1}`, 2000, "2025-01-01", null)
  ));

  // bldB — only 5 leases (3 units vacant)
  const leasesB = await Promise.all(unitsB.slice(0, 5).map((u, i) =>
    upsertLease(u.id, `tenant-b${i}@example.com`, `Tenant B${i+1}`, 1800, "2025-03-01", null)
  ));

  // bldC — 3 leases, one ended last month (move-out), one started this month (move-in)
  const leaseC0 = await upsertLease(unitsC[0].id, "tenant-c0@example.com", "Tenant C1", 2500, "2024-06-01", null);
  const leaseC1 = await upsertLease(unitsC[1].id, "tenant-c1@example.com", "Tenant C2", 2500, "2024-06-01", "2026-05-31"); // moved out
  const leaseC2 = await upsertLease(unitsC[2].id, "tenant-c2@example.com", "Tenant C3", 2500, "2026-06-10", null);          // moved in this month

  // ── June 2026 rent invoices ───────────────────────────────────
  const junStart = new Date("2026-06-01");
  const junEnd   = new Date("2026-06-30");
  const junDue   = new Date("2026-06-05"); // standard due date = 5th of month

  // bldA — 6 invoices: 5 PAID, 1 ISSUED (slight collection shortfall)
  for (let i = 0; i < 5; i++) {
    const inv = await createRentInvoice(leasesA[i].id, unitsA[i].id, 2000, junStart, junEnd, junDue, "PAID");
    await postPaidLedger(inv.id, bldA.id, cents(2000), acct1020.id, acct1100.id, acct3200.id, daysAgo(5));
  }
  await createRentInvoice(leasesA[5].id, unitsA[5].id, 2000, junStart, junEnd, junDue, "ISSUED");
  // → collection rate for bldA = 5/6 ≈ 83%

  // bldB — 5 invoices: 4 PAID, 1 ISSUED 45 days overdue (arrears 31–60)
  for (let i = 0; i < 4; i++) {
    const inv = await createRentInvoice(leasesB[i].id, unitsB[i].id, 1800, junStart, junEnd, junDue, "PAID");
    await postPaidLedger(inv.id, bldB.id, cents(1800), acct1020.id, acct1100.id, acct3200.id, daysAgo(3));
  }
  // May invoice never paid — 45 days overdue
  const mayStart = new Date("2026-05-01");
  const mayEnd   = new Date("2026-05-31");
  const mayDue   = new Date("2026-05-05"); // due 43 days ago → 31–60 bucket
  await createRentInvoice(leasesB[4].id, unitsB[4].id, 1800, mayStart, mayEnd, mayDue, "ISSUED");

  // bldC — 1 PAID, 1 ISSUED 75 days overdue (arrears 61+), 1 partial (new move-in, prorated)
  const inv_c0 = await createRentInvoice(leaseC0.id, unitsC[0].id, 2500, junStart, junEnd, junDue, "PAID");
  await postPaidLedger(inv_c0.id, bldC.id, cents(2500), acct1020.id, acct1100.id, acct3200.id, daysAgo(2));

  // April invoice never paid — 73 days overdue → 61+ bucket
  const aprStart = new Date("2026-04-01");
  const aprEnd   = new Date("2026-04-30");
  const aprDue   = new Date("2026-04-05");
  await createRentInvoice(leaseC0.id, unitsC[0].id, 2500, aprStart, aprEnd, aprDue, "ISSUED");

  // Move-in invoice (prorated, CHF 1 750 for ~21 days in June)
  const inv_c2 = await createRentInvoice(leaseC2.id, unitsC[2].id, 1750, new Date("2026-06-10"), junEnd, junDue, "ISSUED");

  // ── Expense invoices for bldC (heavy maintenance — buildings in red) ──
  await createExpenseInvoice(bldC.id, 4200, "Emergency boiler replacement", "APPROVED", acct2000.id, acct4200.id, daysAgo(10));
  await createExpenseInvoice(bldC.id, 3100, "Roof membrane repair", "ISSUED", acct2000.id, acct4200.id, daysAgo(8));

  // ── Unpaid contractor invoice on bldA (payables concentration) ──
  await createExpenseInvoice(bldA.id, 8500, "Full electrical inspection (Q2)", "ISSUED", acct2000.id, acct4200.id, daysAgo(15));

  console.log("✅ Reporting seed complete.");
  console.log("   bldA: 6 units, 5/6 paid → collection 83%, payables spike");
  console.log("   bldB: 8 units, 5 leased (62% occupancy), 1 invoice 43d overdue");
  console.log("   bldC: 5 units, 3 leased (60% occupancy), 1 invoice 73d overdue, heavy expenses → red");
  console.log("   Move-in: leaseC2 (June 10) — churn flag");
}

// ── Helpers ───────────────────────────────────────────────────

async function upsertBuilding(name: string, address: string, city: string, postalCode: string, canton: string) {
  const existing = await prisma.building.findFirst({ where: { orgId, name } });
  if (existing) return existing;
  return prisma.building.create({ data: { orgId, name, address, city, postalCode, canton } });
}

async function createUnits(buildingId: string, numbers: string[], rooms: number) {
  const results = [];
  for (const unitNumber of numbers) {
    const existing = await prisma.unit.findFirst({ where: { buildingId, unitNumber } });
    if (existing) { results.push(existing); continue; }
    results.push(await prisma.unit.create({ data: { orgId, buildingId, unitNumber, rooms } }));
  }
  return results;
}

async function upsertLease(unitId: string, tenantEmail: string, tenantName: string, netRentChf: number, startDate: string, endDate: string | null) {
  const existing = await prisma.lease.findFirst({ where: { orgId, unitId, tenantEmail } });
  if (existing) return existing;
  const status: LeaseStatus = endDate && new Date(endDate) < TODAY ? "TERMINATED" : "ACTIVE";
  return prisma.lease.create({
    data: {
      orgId,
      unitId,
      tenantEmail,
      tenantName,
      netRentChf,
      status,
      startDate: new Date(startDate),
      endDate: endDate ? new Date(endDate) : null,
      landlordName: "Dev Owner SA",
      landlordAddress: "1 Rue de la Paix",
      landlordZipCity: "1200 Genève",
    },
  });
}

async function createRentInvoice(
  leaseId: string, unitId: string, amountChf: number,
  billingStart: Date, billingEnd: Date, dueDate: Date, status: string,
) {
  const existing = await prisma.invoice.findFirst({
    where: { orgId, leaseId, billingPeriodStart: billingStart, status: status as InvoiceStatus },
  });
  if (existing) return existing;
  return prisma.invoice.create({
    data: {
      orgId,
      direction: InvoiceDirection.OUTGOING,
      leaseId,
      status: status as InvoiceStatus,
      amount: cents(amountChf),
      totalAmount: cents(amountChf),
      dueDate,
      billingPeriodStart: billingStart,
      billingPeriodEnd: billingEnd,
      description: `Loyer ${billingStart.toLocaleDateString("fr-CH", { month: "long", year: "numeric" })}`,
      issueDate: billingStart,
    },
  });
}

async function postPaidLedger(
  invoiceId: string, buildingId: string, amountCents: number,
  bankAccountId: string, receivablesAccountId: string, revenueAccountId: string,
  date: Date,
) {
  const existing = await prisma.ledgerEntry.findFirst({ where: { orgId, sourceId: invoiceId, sourceType: "INVOICE_PAID" } });
  if (existing) return;
  // Dr Bank (1020), Cr Receivables (1100)
  const jid = randomUUID();
  await prisma.ledgerEntry.createMany({
    data: [
      { orgId, buildingId, journalId: jid, sourceType: "INVOICE_PAID", sourceId: invoiceId, accountId: bankAccountId,        debitCents: amountCents, creditCents: 0,           date, description: "Rent received — bank" },
      { orgId, buildingId, journalId: jid, sourceType: "INVOICE_PAID", sourceId: invoiceId, accountId: receivablesAccountId, debitCents: 0,           creditCents: amountCents, date, description: "Rent received — clear receivable" },
    ],
  });
}

async function createExpenseInvoice(
  buildingId: string, amountChf: number, description: string, status: string,
  payablesAccountId: string, expenseAccountId: string, date: Date,
) {
  const inv = await prisma.invoice.create({
    data: {
      orgId,
      direction: InvoiceDirection.INCOMING,
      status: status as InvoiceStatus,
      amount: cents(amountChf),
      totalAmount: cents(amountChf),
      description,
      matchedBuildingId: buildingId,
      expenseCategory: ExpenseCategory.MAINTENANCE,
      issueDate: date,
    },
  });
  // Dr Expense (4200), Cr Payables (2000)
  const jid = randomUUID();
  await prisma.ledgerEntry.createMany({
    data: [
      { orgId, buildingId, journalId: jid, sourceType: "INVOICE_ISSUED", sourceId: inv.id, accountId: expenseAccountId,  debitCents: cents(amountChf), creditCents: 0,                date, description: `${description} — expense` },
      { orgId, buildingId, journalId: jid, sourceType: "INVOICE_ISSUED", sourceId: inv.id, accountId: payablesAccountId, debitCents: 0,               creditCents: cents(amountChf), date, description: `${description} — payable` },
    ],
  });
  return inv;
}

main()
  .catch((e) => { console.error(e); process.exit(1); })
  .finally(() => prisma.$disconnect());
