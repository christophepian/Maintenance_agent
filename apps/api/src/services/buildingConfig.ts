import { PrismaClient } from "@prisma/client";

export type BuildingConfigDTO = {
  id: string;
  orgId: string;
  buildingId: string;
  autoApproveLimit: number | null;
  emergencyAutoDispatch: boolean | null;
  requireOwnerApprovalAbove: number | null;
  createdAt: Date;
  updatedAt: Date;
};

export type EffectiveConfig = {
  org: { autoApproveLimit: number; mode: string };
  buildingOverride?: BuildingConfigDTO | null;
  effectiveAutoApproveLimit: number;
  effectiveEmergencyAutoDispatch: boolean;
  effectiveRequireOwnerApprovalAbove: number;
};

export async function getBuildingConfig(
  prisma: PrismaClient,
  orgId: string,
  buildingId: string
): Promise<BuildingConfigDTO | null> {
  return prisma.buildingConfig.findFirst({ where: { orgId, buildingId } });
}

export async function upsertBuildingConfig(
  prisma: PrismaClient,
  orgId: string,
  buildingId: string,
  payload: {
    autoApproveLimit?: number | null;
    emergencyAutoDispatch?: boolean | null;
    requireOwnerApprovalAbove?: number | null;
  }
): Promise<BuildingConfigDTO | null> {
  const building = await prisma.building.findFirst({ where: { id: buildingId, orgId } });
  if (!building) return null;

  return prisma.buildingConfig.upsert({
    where: { buildingId },
    create: {
      orgId,
      buildingId,
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

export async function computeEffectiveConfig(
  prisma: PrismaClient,
  orgId: string,
  buildingId?: string
): Promise<EffectiveConfig> {
  const [orgConfig, buildingOverride] = await Promise.all([
    prisma.orgConfig.findUnique({ where: { orgId } }),
    buildingId
      ? prisma.buildingConfig.findFirst({ where: { orgId, buildingId } })
      : Promise.resolve(null),
  ]);

  const org = await prisma.org.findUnique({ where: { id: orgId }, select: { mode: true } });
  if (!orgConfig || !org) throw new Error("ORG_CONFIG_NOT_FOUND");

  const effectiveAutoApproveLimit =
    buildingOverride?.autoApproveLimit ?? orgConfig.autoApproveLimit;
  const effectiveEmergencyAutoDispatch =
    buildingOverride?.emergencyAutoDispatch ?? false;
  const effectiveRequireOwnerApprovalAbove =
    buildingOverride?.requireOwnerApprovalAbove ?? orgConfig.autoApproveLimit;

  return {
    org: { autoApproveLimit: orgConfig.autoApproveLimit, mode: org.mode },
    buildingOverride,
    effectiveAutoApproveLimit,
    effectiveEmergencyAutoDispatch,
    effectiveRequireOwnerApprovalAbove,
  };
}
