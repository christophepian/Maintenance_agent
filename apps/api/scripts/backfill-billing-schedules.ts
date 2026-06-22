/**
 * backfill-billing-schedules
 *
 * One-off remediation for leases that were activated BEFORE the lease-activation
 * paths reliably emitted LEASE_STATUS_CHANGED (see fix in tenantPortal.ts /
 * activateLeaseWorkflow.ts). Those leases are ACTIVE but never got a
 * RecurringBillingSchedule, so no monthly rent invoices are generated.
 *
 * For every ACTIVE, non-template lease that lacks a schedule, this creates the
 * schedule with a correct nextPeriodStart:
 *   - If the lease already has an OUTGOING invoice (a legacy first-rent invoice),
 *     the activation month is treated as already billed → nextPeriodStart is set
 *     to the 1st of the FOLLOWING month so the engine does not re-bill it.
 *   - Otherwise nextPeriodStart = activation date, so the production background
 *     job (processRecurringBilling) bills the activation month normally.
 *
 * With --fix-stuck-invoices, any DRAFT OUTGOING invoice that has no billing
 * period gets its period set to the activation month and is ISSUED via the
 * issueInvoice SERVICE (NOT the workflow) so NO tenant notification is sent.
 *
 * Usage (from apps/api, with the target DB in env):
 *   npx tsx scripts/backfill-billing-schedules.ts                       # dry-run
 *   npx tsx scripts/backfill-billing-schedules.ts --apply               # create schedules
 *   npx tsx scripts/backfill-billing-schedules.ts --apply --fix-stuck-invoices
 */

import { PrismaClient } from "@prisma/client";
import { createScheduleForLease } from "../src/services/recurringBillingService";
import * as billingRepo from "../src/repositories/recurringBillingRepository";
import { issueInvoice } from "../src/services/invoices";

const prisma = new PrismaClient();
const APPLY = process.argv.includes("--apply");
const FIX_STUCK = process.argv.includes("--fix-stuck-invoices");

function firstOfMonth(d: Date): Date {
  return new Date(d.getFullYear(), d.getMonth(), 1);
}
function lastDayOfMonth(d: Date): Date {
  return new Date(d.getFullYear(), d.getMonth() + 1, 0);
}
function firstOfNextMonth(d: Date): Date {
  return new Date(d.getFullYear(), d.getMonth() + 1, 1);
}
function chf(cents: number) {
  return (cents / 100).toFixed(2);
}

async function main() {
  console.log(
    `\n=== Backfill billing schedules ===\nMode: ${APPLY ? "APPLY" : "DRY-RUN"}` +
      `  fix-stuck-invoices: ${FIX_STUCK ? "YES" : "no"}\n`,
  );

  // ACTIVE, non-template leases that have no billing schedule.
  const leases = await prisma.lease.findMany({
    where: {
      status: "ACTIVE",
      isTemplate: false,
      billingSchedule: null,
    },
    select: {
      id: true,
      orgId: true,
      tenantName: true,
      unitId: true,
      activatedAt: true,
      startDate: true,
      netRentChf: true,
      expenseItems: {
        where: { isActive: true },
        select: { amountChf: true },
      },
    },
  });

  console.log(`Found ${leases.length} ACTIVE lease(s) without a billing schedule.\n`);

  let schedulesCreated = 0;
  let invoicesFixed = 0;

  for (const lease of leases) {
    const netRentChf = lease.netRentChf ?? 0;
    const totalChargesChf = lease.expenseItems.reduce((s, i) => s + (i.amountChf ?? 0), 0);
    const activationDate = lease.activatedAt ?? lease.startDate ?? new Date();

    console.log(`── Lease ${lease.id} (${lease.tenantName ?? "?"}) ──`);
    console.log(
      `   activation=${activationDate.toISOString().slice(0, 10)} ` +
        `netRent=${netRentChf} charges=${totalChargesChf} CHF`,
    );

    if (netRentChf <= 0) {
      console.log(`   ⚠️  netRentChf is 0 — skipping (cannot bill rent).\n`);
      continue;
    }

    const existingInvoices = await prisma.invoice.findMany({
      where: { leaseId: lease.id, direction: "OUTGOING" },
      select: { id: true, status: true, totalAmount: true, billingPeriodStart: true, description: true },
    });
    const alreadyBilledActivationMonth = existingInvoices.length > 0;

    const nextPeriodStart = alreadyBilledActivationMonth
      ? firstOfNextMonth(activationDate)
      : firstOfMonth(activationDate) <= activationDate && activationDate.getDate() === 1
        ? firstOfMonth(activationDate)
        : activationDate;

    console.log(
      `   existing OUTGOING invoices: ${existingInvoices.length}` +
        ` → schedule nextPeriodStart=${nextPeriodStart.toISOString().slice(0, 10)}` +
        (alreadyBilledActivationMonth ? " (activation month treated as billed)" : ""),
    );

    if (APPLY) {
      const schedule = await createScheduleForLease(prisma, {
        orgId: lease.orgId,
        leaseId: lease.id,
        activationDate,
        netRentChf,
        totalChargesChf,
      });
      // Align nextPeriodStart / lastGeneratedPeriod to avoid re-billing.
      if (alreadyBilledActivationMonth) {
        await billingRepo.advanceSchedule(
          prisma,
          schedule.id,
          firstOfMonth(activationDate),
          nextPeriodStart,
        );
      }
      console.log(`   ✅ created schedule ${schedule.id}`);
      schedulesCreated++;
    } else {
      console.log(`   (dry-run) would create schedule`);
    }

    // Fix stuck DRAFT invoices with no billing period so reporting picks them up.
    if (FIX_STUCK) {
      const stuck = existingInvoices.filter(
        (inv) => inv.status === "DRAFT" && inv.billingPeriodStart === null,
      );
      for (const inv of stuck) {
        const pStart = firstOfMonth(activationDate);
        const pEnd = lastDayOfMonth(activationDate);
        console.log(
          `   stuck invoice ${inv.id} (${inv.description ?? ""}, ${chf(inv.totalAmount)} CHF):` +
            ` set period ${pStart.toISOString().slice(0, 10)}..${pEnd.toISOString().slice(0, 10)} + ISSUE (no notification)`,
        );
        if (APPLY) {
          await prisma.invoice.update({
            where: { id: inv.id },
            data: { billingPeriodStart: pStart, billingPeriodEnd: pEnd },
          });
          try {
            await issueInvoice(inv.id, { issueDate: activationDate });
            console.log(`   ✅ issued invoice ${inv.id}`);
            invoicesFixed++;
          } catch (e: any) {
            console.error(`   ❌ failed to issue ${inv.id}: ${e?.message ?? e}`);
          }
        } else {
          console.log(`   (dry-run) would set period + issue`);
        }
      }
    }
    console.log("");
  }

  console.log(`=== Summary ===`);
  console.log(`Schedules ${APPLY ? "created" : "to create"}: ${APPLY ? schedulesCreated : leases.length}`);
  if (FIX_STUCK) console.log(`Stuck invoices ${APPLY ? "fixed" : "to fix"}: ${APPLY ? invoicesFixed : "(see above)"}`);
  if (!APPLY) console.log(`\nDry-run only. Re-run with --apply (and --fix-stuck-invoices) to execute.`);
}

main()
  .catch((e) => {
    console.error("❌ Error:", e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
