/**
 * Overdue Invoice Detection Service (INT-032)
 *
 * Runs as a background job (via server.ts scheduler).
 * Detects invoices where dueDate + 48h < now and status is ISSUED or APPROVED.
 * Creates in-app notifications for managers and enqueues email alerts.
 *
 * Idempotent: uses the Notification unique constraint
 * (orgId, userId, entityType, entityId, eventType) to skip already-notified invoices.
 */

import { PrismaClient } from "@prisma/client";
import { createNotification } from "./notifications";
import { enqueueEmail } from "./emailOutbox";

/* ── Configuration ─────────────────────────────────────────── */

/** Grace period after dueDate before considering an invoice overdue (ms) */
const OVERDUE_GRACE_MS =
  Number(process.env.OVERDUE_GRACE_HOURS || 48) * 60 * 60 * 1000;

/* ── Main entry point ──────────────────────────────────────── */

/**
 * Scan for overdue invoices and create notifications + emails.
 * Returns the number of newly notified invoices.
 */
export async function processOverdueInvoices(
  prisma: PrismaClient,
): Promise<number> {
  const cutoff = new Date(Date.now() - OVERDUE_GRACE_MS);

  // Find invoices that are overdue: dueDate is past the grace period,
  // status is ISSUED or APPROVED (actively owed), and not yet paid/cancelled.
  const overdueInvoices = await prisma.invoice.findMany({
    where: {
      dueDate: { lt: cutoff },
      status: { in: ["ISSUED", "APPROVED"] },
    },
    select: {
      id: true,
      orgId: true,
      invoiceNumber: true,
      amount: true,
      totalAmount: true,
      dueDate: true,
      recipientName: true,
      lease: {
        select: {
          id: true,
          tenantName: true,
          tenantEmail: true,
          unit: {
            select: {
              unitNumber: true,
              building: { select: { id: true, name: true } },
            },
          },
        },
      },
    },
  });

  if (overdueInvoices.length === 0) return 0;

  // Collect all org IDs to batch-query managers
  const orgIds = [...new Set(overdueInvoices.map((inv) => inv.orgId))];

  const managersByOrg = new Map<string, { id: string; email: string }[]>();
  for (const orgId of orgIds) {
    const managers = await prisma.user.findMany({
      where: { orgId, role: "MANAGER" },
      select: { id: true, email: true },
    });
    managersByOrg.set(orgId, managers);
  }

  let notifiedCount = 0;

  for (const inv of overdueInvoices) {
    const displayAmount = ((inv.totalAmount || inv.amount) / 100).toFixed(2);
    const invLabel = inv.invoiceNumber || inv.id.slice(0, 8);
    const dueDateStr = inv.dueDate!.toISOString().split("T")[0];
    const buildingId = inv.lease?.unit?.building?.id ?? undefined;
    const buildingName = inv.lease?.unit?.building?.name ?? "N/A";
    const unitNumber = inv.lease?.unit?.unitNumber ?? "N/A";
    const tenantName = inv.recipientName || inv.lease?.tenantName || "Unknown";

    const managers = managersByOrg.get(inv.orgId) ?? [];

    // ── In-app notifications for managers ─────────────────
    let wasNew = false;
    for (const mgr of managers) {
      try {
        await createNotification({
          orgId: inv.orgId,
          userId: mgr.id,
          buildingId,
          entityType: "INVOICE",
          entityId: inv.id,
          eventType: "INVOICE_OVERDUE",
          message: `Invoice ${invLabel} (CHF ${displayAmount}) for ${tenantName} is overdue (due ${dueDateStr}).`,
        });
        wasNew = true;
      } catch {
        // Unique constraint violation → already notified, skip
      }
    }

    // ── Email alerts (manager + tenant) ───────────────────
    if (wasNew) {
      const subject = `Overdue Invoice: ${invLabel} — CHF ${displayAmount}`;
      const bodyLines = [
        `Invoice ${invLabel} is overdue.`,
        ``,
        `Tenant: ${tenantName}`,
        `Building: ${buildingName}, Unit: ${unitNumber}`,
        `Amount: CHF ${displayAmount}`,
        `Due date: ${dueDateStr}`,
        ``,
        `Please follow up on this outstanding payment.`,
      ];

      // Email each manager
      for (const mgr of managers) {
        if (mgr.email) {
          await enqueueEmail(inv.orgId, {
            toEmail: mgr.email,
            template: "INVOICE_OVERDUE",
            subject,
            bodyText: bodyLines.join("\n"),
            metaJson: { invoiceId: inv.id, invoiceNumber: invLabel },
          });
        }
      }

      // Email the tenant (via lease.tenantEmail)
      const tenantEmail = inv.lease?.tenantEmail;
      if (tenantEmail) {
        await enqueueEmail(inv.orgId, {
          toEmail: tenantEmail,
          template: "INVOICE_OVERDUE",
          subject: `Payment Reminder: Invoice ${invLabel} — CHF ${displayAmount}`,
          bodyText: [
            `Dear ${tenantName},`,
            ``,
            `This is a reminder that invoice ${invLabel} for CHF ${displayAmount} was due on ${dueDateStr} and remains unpaid.`,
            ``,
            `Building: ${buildingName}, Unit: ${unitNumber}`,
            ``,
            `Please arrange payment at your earliest convenience.`,
          ].join("\n"),
          metaJson: { invoiceId: inv.id, invoiceNumber: invLabel },
        });
      }

      notifiedCount++;
    }
  }

  return notifiedCount;
}
