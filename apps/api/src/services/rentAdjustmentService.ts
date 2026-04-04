/**
 * Rent Adjustment Service
 *
 * Implements Swiss rent indexation logic:
 *  - CPI_100: newRent = initialRent × (newCPI / baseCPI)
 *  - CPI_40_REFRATE_60: mixed formula (40% CPI change + 60% ref rate change)
 *  - MANUAL: manager enters new rent directly
 *
 * Lifecycle: DRAFT → APPROVED → APPLIED
 *                  → REJECTED
 *
 * When APPLIED, updates:
 *  - Lease.netRentChf
 *  - Lease.lastIndexationDate
 *  - RecurringBillingSchedule.baseRentCents
 */
import { PrismaClient, Prisma } from "@prisma/client";
import * as rentAdjustmentRepo from "../repositories/rentAdjustmentRepository";

// ─── Calculation Helpers ───────────────────────────────────────

interface CpiIndexationInput {
  initialRentCents: number;
  cpiBase: number; // CPI at lease start / last indexation
  cpiCurrent: number; // Current CPI
}

/**
 * 100% CPI-indexed rent calculation.
 * Formula: newRent = initialRent × (currentCPI / baseCPI)
 * Rounded to nearest CHF (100 cents).
 */
function calculateCpi100(input: CpiIndexationInput): number {
  const ratio = input.cpiCurrent / input.cpiBase;
  const rawCents = input.initialRentCents * ratio;
  // Round to nearest 100 cents (1 CHF)
  return Math.round(rawCents / 100) * 100;
}

/**
 * 40% CPI + 60% reference rate mixed formula.
 * Swiss standard: the CPI component drives 40% of the adjustment,
 * and the reference rate component drives 60%.
 *
 * For simplicity, we calculate:
 *   cpiAdjustment = initialRent × 0.40 × ((currentCPI / baseCPI) - 1)
 *   refRateAdjustment = initialRent × 0.60 × ((oldRate - newRate) / oldRate) × factor
 *
 * Note: Reference rate decreases = rent decrease; increases = rent increase.
 * The "factor" is typically 0.4 per 0.25% change (Swiss practice).
 * For simplicity we use direct proportional change.
 */
function calculateCpi40RefRate60(
  input: CpiIndexationInput & {
    referenceRateOld: number;
    referenceRateNew: number;
  },
): number {
  // CPI component: 40% weight
  const cpiChange = input.cpiCurrent / input.cpiBase - 1;
  const cpiComponent = input.initialRentCents * 0.4 * cpiChange;

  // Reference rate component: 60% weight
  // Each 0.25% change in reference rate → proportional rent change
  const rateDiff = input.referenceRateNew - input.referenceRateOld;
  const rateChangePct = input.referenceRateOld > 0
    ? rateDiff / input.referenceRateOld
    : 0;
  const refRateComponent = input.initialRentCents * 0.6 * rateChangePct;

  const newRentCents = input.initialRentCents + cpiComponent + refRateComponent;
  // Round to nearest 100 cents (1 CHF)
  return Math.round(newRentCents / 100) * 100;
}

// ─── Service Functions ─────────────────────────────────────────

/**
 * Compute a new rent adjustment for a CPI-indexed lease.
 * Auto-calculates the new rent based on the lease's index clause.
 */
export async function computeIndexation(
  prisma: PrismaClient,
  orgId: string,
  input: {
    leaseId: string;
    cpiNewIndex: number;
    effectiveDate: string; // ISO date
    referenceRateNew?: string; // Required for CPI_40_REFRATE_60
  },
) {
  // Fetch the lease
  const lease = await prisma.lease.findFirst({
    where: { id: input.leaseId, orgId },
    include: { billingSchedule: true },
  });
  if (!lease) throw new Error("Lease not found");
  if (lease.indexClauseType === "NONE") {
    throw new Error("Lease has no index clause — cannot compute indexation");
  }
  if (!lease.cpiBaseIndex) {
    throw new Error(
      "Lease has no CPI base index set — update the lease first",
    );
  }

  const cpiBase = Number(lease.cpiBaseIndex);
  const cpiNew = input.cpiNewIndex;

  // Use initialNetRentChf if available, else current netRentChf
  const baseRentChf = lease.initialNetRentChf ?? lease.netRentChf;
  const baseRentCents = baseRentChf * 100;
  const currentRentCents = lease.netRentChf * 100;

  let newRentCents: number;
  let calculationDetails: any;

  if (lease.indexClauseType === "CPI_100") {
    newRentCents = calculateCpi100({
      initialRentCents: baseRentCents,
      cpiBase,
      cpiCurrent: cpiNew,
    });
    calculationDetails = {
      formula: "CPI_100",
      initialRentCents: baseRentCents,
      cpiBase,
      cpiNew,
      ratio: cpiNew / cpiBase,
      newRentCents,
    };
  } else if (lease.indexClauseType === "CPI_40_REFRATE_60") {
    const refRateOld = lease.referenceRatePercent
      ? parseFloat(lease.referenceRatePercent)
      : 0;
    const refRateNew = input.referenceRateNew
      ? parseFloat(input.referenceRateNew)
      : refRateOld;

    newRentCents = calculateCpi40RefRate60({
      initialRentCents: baseRentCents,
      cpiBase,
      cpiCurrent: cpiNew,
      referenceRateOld: refRateOld,
      referenceRateNew: refRateNew,
    });
    calculationDetails = {
      formula: "CPI_40_REFRATE_60",
      initialRentCents: baseRentCents,
      cpiBase,
      cpiNew,
      cpiRatio: cpiNew / cpiBase,
      referenceRateOld: refRateOld,
      referenceRateNew: refRateNew,
      newRentCents,
    };
  } else {
    throw new Error(`Unknown index clause type: ${lease.indexClauseType}`);
  }

  const adjustmentCents = newRentCents - currentRentCents;

  return rentAdjustmentRepo.createRentAdjustment(prisma, {
    orgId,
    leaseId: input.leaseId,
    adjustmentType: "CPI_INDEXATION",
    effectiveDate: new Date(input.effectiveDate),
    previousRentCents: currentRentCents,
    newRentCents,
    adjustmentCents,
    cpiOldIndex: cpiBase,
    cpiNewIndex: cpiNew,
    referenceRateOld: lease.referenceRatePercent || undefined,
    referenceRateNew: input.referenceRateNew,
    calculationDetails,
  });
}

/**
 * Create a manual rent adjustment (manager sets new rent directly).
 */
export async function createManualAdjustment(
  prisma: PrismaClient,
  orgId: string,
  input: {
    leaseId: string;
    newRentCents: number;
    effectiveDate: string;
    reason?: string;
  },
) {
  const lease = await prisma.lease.findFirst({
    where: { id: input.leaseId, orgId },
  });
  if (!lease) throw new Error("Lease not found");

  const currentRentCents = lease.netRentChf * 100;
  const adjustmentCents = input.newRentCents - currentRentCents;

  return rentAdjustmentRepo.createRentAdjustment(prisma, {
    orgId,
    leaseId: input.leaseId,
    adjustmentType: "MANUAL",
    effectiveDate: new Date(input.effectiveDate),
    previousRentCents: currentRentCents,
    newRentCents: input.newRentCents,
    adjustmentCents,
    calculationDetails: { reason: input.reason || "Manual adjustment" },
  });
}

/**
 * Approve a DRAFT adjustment.
 */
export async function approveAdjustment(
  prisma: PrismaClient,
  adjustmentId: string,
  orgId: string,
) {
  const adj = await rentAdjustmentRepo.findById(prisma, adjustmentId, orgId);
  if (!adj) throw new Error("Rent adjustment not found");
  if (adj.status !== "DRAFT") {
    throw new Error(`Cannot approve adjustment in ${adj.status} status`);
  }
  return rentAdjustmentRepo.approveAdjustment(prisma, adjustmentId, orgId);
}

/**
 * Reject a DRAFT adjustment.
 */
export async function rejectAdjustment(
  prisma: PrismaClient,
  adjustmentId: string,
  orgId: string,
  reason?: string,
) {
  const adj = await rentAdjustmentRepo.findById(prisma, adjustmentId, orgId);
  if (!adj) throw new Error("Rent adjustment not found");
  if (adj.status !== "DRAFT") {
    throw new Error(`Cannot reject adjustment in ${adj.status} status`);
  }
  return rentAdjustmentRepo.rejectAdjustment(prisma, adjustmentId, orgId, reason);
}

/**
 * Apply an APPROVED adjustment:
 * 1. Update Lease.netRentChf, Lease.lastIndexationDate
 * 2. Update RecurringBillingSchedule.baseRentCents
 * 3. Mark adjustment as APPLIED
 */
export async function applyAdjustment(
  prisma: PrismaClient,
  adjustmentId: string,
  orgId: string,
) {
  const adj = await rentAdjustmentRepo.findById(prisma, adjustmentId, orgId);
  if (!adj) throw new Error("Rent adjustment not found");
  if (adj.status !== "APPROVED") {
    throw new Error(`Cannot apply adjustment in ${adj.status} status — must be APPROVED first`);
  }

  const newRentChf = Math.round(adj.newRentCents / 100);

  // Use a transaction to ensure atomicity
  return prisma.$transaction(async (tx: any) => {
    // 1. Update lease rent
    await tx.lease.update({
      where: { id: adj.leaseId },
      data: {
        netRentChf: newRentChf,
        lastIndexationDate: adj.effectiveDate,
        // If this is the first adjustment, save the original rent
        initialNetRentChf: adj.lease.initialNetRentChf ?? adj.lease.netRentChf,
      },
    });

    // 2. Update billing schedule if exists
    const schedule = await tx.recurringBillingSchedule.findUnique({
      where: { leaseId: adj.leaseId },
    });
    if (schedule && schedule.status === "ACTIVE") {
      await tx.recurringBillingSchedule.update({
        where: { id: schedule.id },
        data: { baseRentCents: adj.newRentCents },
      });
    }

    // 3. Mark adjustment as applied
    return tx.rentAdjustment.update({
      where: { id: adjustmentId },
      data: {
        status: "APPLIED",
        appliedAt: new Date(),
      },
      include: rentAdjustmentRepo.RENT_ADJUSTMENT_INCLUDE,
    });
  });
}

/**
 * Delete a DRAFT adjustment.
 */
export async function deleteAdjustment(
  prisma: PrismaClient,
  adjustmentId: string,
  orgId: string,
) {
  const adj = await rentAdjustmentRepo.findById(prisma, adjustmentId, orgId);
  if (!adj) throw new Error("Rent adjustment not found");
  if (adj.status !== "DRAFT") {
    throw new Error("Can only delete DRAFT adjustments");
  }
  await rentAdjustmentRepo.deleteRentAdjustment(prisma, adjustmentId, orgId);
}
