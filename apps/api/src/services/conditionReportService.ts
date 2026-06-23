import { PrismaClient, ConditionReportType, ConditionReportStatus, ItemCondition } from "@prisma/client";
import * as repo from "../repositories/conditionReportRepository";

// ── Condition ordering (lower = better) ───────────────────────────────────────

const CONDITION_ORDINAL: Record<ItemCondition, number> = {
  NOT_INSPECTED: -1,
  GOOD: 0,
  FAIR: 1,
  POOR: 2,
  DAMAGED: 3,
};

export function isWorse(a: ItemCondition, b: ItemCondition): boolean {
  // NOT_INSPECTED is the seeded default, not a quality grade — without a rating
  // on both sides we can't claim deterioration, so never flag it as a delta.
  if (a === "NOT_INSPECTED" || b === "NOT_INSPECTED") return false;
  return CONDITION_ORDINAL[a] > CONDITION_ORDINAL[b];
}

// ── DTO types ─────────────────────────────────────────────────────────────────

export interface DeltaItem {
  itemId: string;
  roomLabel: string;
  itemLabel: string;
  moveOutCondition: ItemCondition;
  moveInCondition: ItemCondition | null;
  isDelta: boolean;
  photoCount: number;
}

export interface ReportWithDelta {
  report: repo.ReportFull;
  delta: DeltaItem[] | null;       // null for MOVE_IN reports
  deltaCount: number;
  hasUnphotoedDeltas: boolean;
}

// ── Delta computation ──────────────────────────────────────────────────────────

export async function attachDelta(
  prisma: PrismaClient,
  report: repo.ReportFull,
): Promise<ReportWithDelta> {
  if (report.type === ConditionReportType.MOVE_IN) {
    return { report, delta: null, deltaCount: 0, hasUnphotoedDeltas: false };
  }

  const moveIn = await repo.findMoveInForLease(prisma, report.leaseId);

  const delta: DeltaItem[] = report.items.map((outItem) => {
    let moveInCondition: ItemCondition | null = null;

    if (moveIn) {
      // Try exact asset match first, then room+label string match
      const matched =
        (outItem.assetId
          ? moveIn.items.find((i) => i.assetId === outItem.assetId)
          : undefined) ??
        moveIn.items.find(
          (i) =>
            i.roomLabel.toLowerCase() === outItem.roomLabel.toLowerCase() &&
            i.itemLabel.toLowerCase() === outItem.itemLabel.toLowerCase(),
        );

      if (matched) moveInCondition = matched.condition;
    }

    const isDelta =
      moveInCondition !== null && isWorse(outItem.condition, moveInCondition);

    return {
      itemId: outItem.id,
      roomLabel: outItem.roomLabel,
      itemLabel: outItem.itemLabel,
      moveOutCondition: outItem.condition,
      moveInCondition,
      isDelta,
      photoCount: outItem.photos.length,
    };
  });

  const deltaCount = delta.filter((d) => d.isDelta).length;
  const hasUnphotoedDeltas = delta.some((d) => d.isDelta && d.photoCount === 0);

  return { report, delta, deltaCount, hasUnphotoedDeltas };
}

// ── Submit validation ──────────────────────────────────────────────────────────

export type SubmitValidationError =
  | { code: "WRONG_STATUS"; current: ConditionReportStatus }
  | { code: "UNPHOTOED_DELTAS"; items: string[] };

export async function validateSubmit(
  prisma: PrismaClient,
  report: repo.ReportFull,
): Promise<SubmitValidationError | null> {
  if (report.status !== ConditionReportStatus.PENDING) {
    return { code: "WRONG_STATUS", current: report.status };
  }

  if (report.type === ConditionReportType.MOVE_OUT) {
    const { delta } = await attachDelta(prisma, report);
    if (delta) {
      const missing = delta
        .filter((d) => d.isDelta && d.photoCount === 0)
        .map((d) => `${d.roomLabel} — ${d.itemLabel}`);
      if (missing.length > 0) {
        return { code: "UNPHOTOED_DELTAS", items: missing };
      }
    }
  }

  return null;
}

// ── Auto-creation from lease ───────────────────────────────────────────────────

export async function createReportFromLease(
  prisma: PrismaClient,
  leaseId: string,
  type: ConditionReportType,
): Promise<void> {
  const lease = await prisma.lease.findUnique({
    where: { id: leaseId },
    include: {
      unit: {
        include: {
          building: {
            include: { config: { select: { conditionReportDeadlineDays: true } } },
          },
          occupancies: {
            select: { tenantId: true },
            take: 1,
          },
        },
      },
    },
  });

  if (!lease || !lease.unitId) {
    console.warn(`[CONDITION-REPORT] Skipping — lease ${leaseId} has no unit`);
    return;
  }

  const tenantId = lease.unit?.occupancies?.[0]?.tenantId;
  if (!tenantId) {
    console.warn(`[CONDITION-REPORT] Skipping — no active occupant for lease ${leaseId}`);
    return;
  }

  // Guard: don't create duplicate (idempotent)
  const existing = await prisma.unitConditionReport.findFirst({
    where: { leaseId, type },
  });
  if (existing) return;

  const deadlineDays = lease.unit?.building?.config?.conditionReportDeadlineDays ?? 7;
  const dueAt = new Date();
  dueAt.setDate(dueAt.getDate() + deadlineDays);

  await repo.createReport(prisma, {
    orgId: lease.orgId,
    unitId: lease.unitId,
    tenantId,
    leaseId,
    type,
    dueAt,
  });

  console.log(
    `[CONDITION-REPORT] Created ${type} report for lease ${leaseId}, due ${dueAt.toISOString()}`,
  );
}
