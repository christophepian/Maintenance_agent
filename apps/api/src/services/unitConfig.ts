import { PrismaClient } from "@prisma/client";

export type UnitConfigDTO = {
  id: string;
  orgId: string;
  unitId: string;
  autoApproveLimit: number | null;
  emergencyAutoDispatch: boolean | null;
  requireOwnerApprovalAbove: number | null;
  createdAt: Date;
  updatedAt: Date;
};

export type EffectiveUnitConfig = {
  org: { autoApproveLimit: number };
  building?: { autoApproveLimit: number | null; emergencyAutoDispatch: boolean | null; requireOwnerApprovalAbove: number | null } | null;
  unit?: UnitConfigDTO | null;
  effectiveAutoApproveLimit: number;
  effectiveEmergencyAutoDispatch: boolean;
  effectiveRequireOwnerApprovalAbove: number;
};

export async function getUnitConfig(
  prisma: PrismaClient,
  orgId: string,
  unitId: string
): Promise<UnitConfigDTO | null> {
  return prisma.unitConfig.findFirst({ where: { orgId, unitId } });
}

export async function upsertUnitConfig(
  prisma: PrismaClient,
  orgId: string,
  unitId: string,
  payload: {
    autoApproveLimit?: number | null;
    emergencyAutoDispatch?: boolean | null;
    requireOwnerApprovalAbove?: number | null;
  }
): Promise<UnitConfigDTO | null> {
  const unit = await prisma.unit.findFirst({ where: { id: unitId, orgId } });
  if (!unit) return null;

  return prisma.unitConfig.upsert({
    where: { unitId },
    create: {
      orgId,
      unitId,
      autoApproveLimit: payload.autoApproveLimit ?? null,
      emergencyAutoDispatch: payload.emergencyAutoDispatch ?? null,
      requireOwnerApprovalAbove: payload.requireOwnerApprovalAbove ?? null,
    },
    update: {
      autoApproveLimit: payload.autoApproveLimit !== undefined ? payload.autoApproveLimit : undefined,
      emergencyAutoDispatch: payload.emergencyAutoDispatch !== undefined ? payload.emergencyAutoDispatch : undefined,
      requireOwnerApprovalAbove: payload.requireOwnerApprovalAbove !== undefined ? payload.requireOwnerApprovalAbove : undefined,
    },
  });
}

export async function deleteUnitConfig(
  prisma: PrismaClient,
  orgId: string,
  unitId: string
): Promise<boolean> {
  const result = await prisma.unitConfig.deleteMany({
    where: { orgId, unitId },
  });
  return result.count > 0;
}

export async function computeEffectiveUnitConfig(
  prisma: PrismaClient,
  orgId: string,
  unitId: string
): Promise<EffectiveUnitConfig> {
  const [orgConfig, unitOverride, unit] = await Promise.all([
    prisma.orgConfig.findUnique({ where: { orgId } }),
    prisma.unitConfig.findFirst({ where: { orgId, unitId } }),
    prisma.unit.findFirst({ where: { id: unitId, orgId }, include: { building: { include: { config: true } } } }),
  ]);

  if (!orgConfig || !unit) throw new Error("ORG_CONFIG_OR_UNIT_NOT_FOUND");

  const buildingConfig = unit.building?.config || null;

  // Three-tier cascade: Unit > Building > Org
  const effectiveAutoApproveLimit =
    unitOverride?.autoApproveLimit ??
    buildingConfig?.autoApproveLimit ??
    orgConfig.autoApproveLimit;

  const effectiveEmergencyAutoDispatch =
    unitOverride?.emergencyAutoDispatch ??
    buildingConfig?.emergencyAutoDispatch ??
    false;

  const effectiveRequireOwnerApprovalAbove =
    unitOverride?.requireOwnerApprovalAbove ??
    buildingConfig?.requireOwnerApprovalAbove ??
    orgConfig.autoApproveLimit;

  return {
    org: { autoApproveLimit: orgConfig.autoApproveLimit },
    building: buildingConfig ? {
      autoApproveLimit: buildingConfig.autoApproveLimit,
      emergencyAutoDispatch: buildingConfig.emergencyAutoDispatch,
      requireOwnerApprovalAbove: buildingConfig.requireOwnerApprovalAbove,
    } : null,
    unit: unitOverride,
    effectiveAutoApproveLimit,
    effectiveEmergencyAutoDispatch,
    effectiveRequireOwnerApprovalAbove,
  };
}
