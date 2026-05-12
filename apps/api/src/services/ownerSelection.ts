import {
  RentalApplicationUnitStatus,
  RentalOwnerSelectionStatus,
} from "@prisma/client";
import prisma from "./prismaClient";
import { RENTAL_OWNER_SELECTION_INCLUDE } from "./rentalIncludes";
import { OwnerSelectionInput } from "../validation/rentalApplications";
import { enqueueEmail } from "./emailOutbox";
import { listLeaseTemplates, createLeaseFromTemplate, createLeaseInvoice } from "./leases";
import * as rentalAppRepo from '../repositories/rentalApplicationRepository';
import * as inventoryRepo from '../repositories/inventoryRepository';
import * as userRepo from '../repositories/userRepository';

/* ══════════════════════════════════════════════════════════════
   Owner Selection Service
   ══════════════════════════════════════════════════════════════

   Handles:
   - Owner picks primary + 2 backups for a vacant unit
   - Rejects all other candidates
   - Sets unit status → AWAITING_LEASE_SIGNATURE
   - Enqueues emails (selected link + rejection notices)
   - Signature timeout + fallback promotion
   ══════════════════════════════════════════════════════════════ */

/* ── DTOs ──────────────────────────────────────────────────── */

export interface RentalOwnerSelectionDTO {
  id: string;
  unitId: string;
  status: RentalOwnerSelectionStatus;
  createdAt: string;
  decidedAt?: string;
  deadlineAt: string;
  primaryApplicationUnitId: string;
  backup1ApplicationUnitId?: string;
  backup2ApplicationUnitId?: string;
}

function mapSelectionToDTO(s: any): RentalOwnerSelectionDTO {
  return {
    id: s.id,
    unitId: s.unitId,
    status: s.status,
    createdAt: s.createdAt.toISOString(),
    decidedAt: s.decidedAt?.toISOString(),
    deadlineAt: s.deadlineAt.toISOString(),
    primaryApplicationUnitId: s.primaryApplicationUnitId,
    backup1ApplicationUnitId: s.backup1ApplicationUnitId ?? undefined,
    backup2ApplicationUnitId: s.backup2ApplicationUnitId ?? undefined,
  };
}

/* ── Core Operation ────────────────────────────────────────── */

/**
 * Owner selects candidates for a unit.
 *
 * - Marks primary + backups with appropriate statuses
 * - Rejects all other candidates for this unit
 * - Creates RentalOwnerSelection record
 * - Sets unit → not vacant (AWAITING_LEASE_SIGNATURE semantics)
 * - Enqueues rejection emails + selected email
 */
export async function ownerSelectCandidates(
  orgId: string,
  unitId: string,
  input: OwnerSelectionInput,
): Promise<RentalOwnerSelectionDTO> {
  // Validate unit exists, belongs to this org, has no active lease and no pending selection
  const unit = await inventoryRepo.findVacantUnitWithBuildingConfig(prisma, unitId, orgId);
  if (!unit) throw new Error("UNIT_NOT_FOUND_OR_NOT_VACANT");

  // Validate all referenced application-units exist for this unit
  const auIds = [
    input.primaryApplicationUnitId,
    input.backup1ApplicationUnitId,
    input.backup2ApplicationUnitId,
  ].filter(Boolean) as string[];

  const applicationUnits = await rentalAppRepo.findApplicationUnitsByIds(prisma, auIds, unitId);

  const foundIds = new Set(applicationUnits.map((au) => au.id));
  for (const id of auIds) {
    if (!foundIds.has(id)) {
      throw new Error(`APPLICATION_UNIT_NOT_FOUND: ${id}`);
    }
  }

  // Get building config for deadline
  const config = (unit as any).building?.config;
  const deadlineDays = config?.rentalSignatureDeadlineDays || 7;
  const deadlineAt = new Date();
  deadlineAt.setDate(deadlineAt.getDate() + deadlineDays);

  // Transaction: create selection + update statuses + reject others
  const selection = await rentalAppRepo.createOwnerSelectionTransaction(prisma, {
    unitId,
    deadlineAt,
    primaryApplicationUnitId: input.primaryApplicationUnitId,
    backup1ApplicationUnitId: input.backup1ApplicationUnitId,
    backup2ApplicationUnitId: input.backup2ApplicationUnitId,
    auIds,
  });

  // Enqueue rejection emails (outside transaction — non-critical)
  const rejectedAus = await rentalAppRepo.findRejectedApplicationUnitsForUnit(prisma, unitId);

  for (const rau of rejectedAus) {
    const primary = rau.application.applicants[0];
    if (primary?.email) {
      await enqueueEmail(orgId, {
        toEmail: primary.email,
        template: "REJECTED",
        subject: "Rental application update",
        bodyText: `We regret to inform you that your application for this unit has not been selected. Thank you for your interest.`,
        metaJson: {
          applicationId: rau.applicationId,
          unitId,
        },
      });

      // Set retention delete date (+30 days) for rejected attachments
      await rentalAppRepo.updateAttachmentRetention(
        prisma,
        rau.applicationId,
        new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
      );
    }
  }

  // Enqueue selected email for primary
  const primaryAU = applicationUnits.find(
    (au) => au.id === input.primaryApplicationUnitId,
  );
  const primaryApplicant = primaryAU?.application?.applicants?.[0];
  if (primaryApplicant?.email) {
    await enqueueEmail(orgId, {
      toEmail: primaryApplicant.email,
      template: "SELECTED_LEASE_LINK",
      subject: "You have been selected! Review your lease",
      bodyText: `Congratulations! You have been selected for this unit. Please review and sign your lease within ${deadlineDays} days.`,
      metaJson: {
        applicationId: primaryAU!.applicationId,
        unitId,
        selectionId: selection.id,
        deadlineAt: deadlineAt.toISOString(),
      },
    });
  }

  // Auto-generate lease draft from building template (if one exists)
  let leaseId: string | null = null;
  try {
    const buildingId = (unit as any).buildingId || (unit as any).building?.id;
    if (buildingId) {
      const templates = await listLeaseTemplates(orgId, buildingId);
      if (templates.length > 0) {
        const template = templates[0]; // most recent template for this building
        const coApplicants = applicationUnits
          .filter((au) => au.id === input.primaryApplicationUnitId)
          .flatMap((au) => au.application.applicants)
          .filter((a: any) => a.role !== "PRIMARY");
        const coTenantName = coApplicants.length > 0
          ? coApplicants.map((a: any) => `${a.firstName} ${a.lastName}`).join(", ")
          : undefined;

        const lease = await createLeaseFromTemplate(
          template.id,
          orgId,
          unitId,
          {
            tenantName: primaryApplicant
              ? `${primaryApplicant.firstName} ${primaryApplicant.lastName}`
              : "Unknown",
            tenantEmail: primaryApplicant?.email || undefined,
            tenantPhone: (primaryApplicant as any)?.phone || undefined,
            tenantAddress: (primaryApplicant as any)?.currentAddress || undefined,
            tenantZipCity: (primaryApplicant as any)?.currentZipCity || undefined,
            coTenantName,
            applicationId: primaryAU?.applicationId,
          },
        );
        leaseId = lease.id;
        console.log(
          `[RENTAL] Auto-generated lease ${leaseId} from template ${template.id} for unit ${unitId}`,
        );

        // Auto-generate deposit invoice if deposit is defined
        try {
          if (lease.depositChf && lease.depositChf > 0) {
            await createLeaseInvoice(leaseId, orgId, {
              type: 'DEPOSIT',
              amountChf: lease.depositChf,
              description: `Dépôt de garantie — ${lease.tenantName}`,
            });
            console.log(`[RENTAL] Auto-generated deposit invoice for lease ${leaseId}`);
          }
        } catch (invoiceErr) {
          console.error("[RENTAL] Auto deposit invoice failed (non-critical):", invoiceErr);
        }

        // Auto-generate first rent invoice if rent total is defined
        try {
          const firstRentAmount = lease.rentTotalChf ?? lease.netRentChf;
          if (firstRentAmount && firstRentAmount > 0) {
            await createLeaseInvoice(leaseId, orgId, {
              type: 'FIRST_RENT',
              amountChf: firstRentAmount,
              description: `Premier loyer — ${lease.tenantName}`,
            });
            console.log(`[RENTAL] Auto-generated first rent invoice for lease ${leaseId}`);
          }
        } catch (invoiceErr) {
          console.error("[RENTAL] Auto first rent invoice failed (non-critical):", invoiceErr);
        }
      }
    }
  } catch (e) {
    // Non-critical: log but don't fail the selection
    console.error("[RENTAL] Auto lease generation failed (non-critical):", e);
  }

  // Notify manager(s): email + in-app notification
  const candidateName = primaryApplicant
    ? `${primaryApplicant.firstName} ${primaryApplicant.lastName}`
    : "Unknown";
  const unitNumber = (unit as any).unitNumber || unitId.slice(0, 8);
  const buildingId = (unit as any).buildingId || (unit as any).building?.id;

  try {
    // Find all manager users for this org
    const managers = await userRepo.findManagersByOrg(prisma, orgId);

    const { notifyManagerTenantSelected, notifyOwnerTenantSelected } = await import("./notifications");

    for (const mgr of managers) {
      // Email notification
      if (mgr.email) {
        await enqueueEmail(orgId, {
          toEmail: mgr.email,
          template: "MANAGER_TENANT_SELECTED",
          subject: `Tenant selected for unit ${unitNumber}`,
          bodyText: `The owner has selected ${candidateName} as the primary tenant for unit ${unitNumber}.${leaseId ? " A lease draft has been auto-generated." : " No lease template was found — please create a lease manually."}`,
          metaJson: {
            selectionId: selection.id,
            unitId,
            leaseId,
            candidateName,
          },
        });
      }

      // In-app notification
      await notifyManagerTenantSelected(
        selection.id,
        orgId,
        mgr.id,
        unitNumber,
        candidateName,
        buildingId,
      );
    }

    // Fallback: if no manager users exist yet (dev mode), still create a notification for "dev-user"
    if (managers.length === 0) {
      await enqueueEmail(orgId, {
        toEmail: "manager@local",
        template: "MANAGER_TENANT_SELECTED",
        subject: `Tenant selected for unit ${unitNumber}`,
        bodyText: `The owner has selected ${candidateName} as the primary tenant for unit ${unitNumber}.${leaseId ? " A lease draft has been auto-generated." : " No lease template was found — please create a lease manually."}`,
        metaJson: { selectionId: selection.id, unitId, leaseId, candidateName },
      });

      await notifyManagerTenantSelected(
        selection.id,
        orgId,
        "dev-user",
        unitNumber,
        candidateName,
        buildingId,
      );
    }

    // Also notify the owner(s) as a confirmation of their selection
    const owners = await userRepo.findOwnersByOrg(prisma, orgId);
    for (const owner of owners) {
      await notifyOwnerTenantSelected(
        selection.id,
        orgId,
        owner.id,
        unitNumber,
        candidateName,
        buildingId,
      );
    }
  } catch (e) {
    console.error("[RENTAL] Manager notification failed (non-critical):", e);
  }

  const result = mapSelectionToDTO(selection);
  return { ...result, leaseId } as RentalOwnerSelectionDTO & { leaseId?: string | null };
}

/**
 * Handle signature timeout: void lease, promote backup.
 * Called by background job or dev test endpoint.
 */
export async function processSelectionTimeouts(
  now: Date = new Date(),
): Promise<number> {
  // Find selections past deadline that are still awaiting signature
  const expired = await rentalAppRepo.findExpiredSelectionsWithFullInclude(
    prisma, now, RENTAL_OWNER_SELECTION_INCLUDE,
  );

  let processed = 0;

  for (const sel of expired) {
    const orgId = (sel as any).unit?.building?.orgId || "";

    await rentalAppRepo.processSelectionTimeoutTransaction(prisma, {
      id: sel.id,
      unitId: sel.unitId,
      primaryApplicationUnitId: sel.primaryApplicationUnitId,
      backup1ApplicationUnitId: sel.backup1ApplicationUnitId,
      backup2ApplicationUnitId: sel.backup2ApplicationUnitId,
    });

    // Enqueue email to new primary if backup1 was promoted
    if (sel.backup1ApplicationUnitId) {
      const backup1 = (sel as any).backup1Selection;
      const applicant = backup1?.application?.applicants?.[0];
      if (applicant?.email) {
        await enqueueEmail(orgId, {
          toEmail: applicant.email,
          template: "SELECTED_LEASE_LINK",
          subject: "You have been selected! Review your lease",
          bodyText: `You have been moved up to primary selection for this unit. Please review and sign your lease within 7 days.`,
          metaJson: {
            applicationId: backup1.applicationId,
            unitId: sel.unitId,
            selectionId: sel.id,
          },
        });
      }
    }

    processed++;
  }

  return processed;
}

/**
 * Process attachment retention: delete storage objects past retention date.
 */
export async function processAttachmentRetention(
  now: Date = new Date(),
): Promise<number> {
  const { storage } = await import("../storage/attachments");

  const expired = await rentalAppRepo.findExpiredAttachments(prisma, now);

  let deleted = 0;
  for (const att of expired) {
    try {
      await storage.delete(att.storageKey);
      await rentalAppRepo.deleteAttachmentRecord(prisma, att.id);
      deleted++;
    } catch (err) {
      console.error(
        `[RETENTION] Failed to delete attachment ${att.id}:`,
        err,
      );
    }
  }

  return deleted;
}
