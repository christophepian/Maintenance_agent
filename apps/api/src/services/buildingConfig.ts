import { PrismaClient } from "@prisma/client";
import {
  findBuildingConfig,
  findBuildingForConfig,
  upsertBuildingConfigRecord,
  findEffectiveConfigData,
} from "../repositories/buildingConfigRepository";

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
  return findBuildingConfig(prisma, orgId, buildingId);
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
  const building = await findBuildingForConfig(prisma, orgId, buildingId);
  if (!building) return null;

  return upsertBuildingConfigRecord(
    prisma,
    orgId,
    buildingId,
    {
      orgId,
      buildingId,
      autoApproveLimit: payload.autoApproveLimit ?? null,
      emergencyAutoDispatch: payload.emergencyAutoDispatch ?? null,
      requireOwnerApprovalAbove: payload.requireOwnerApprovalAbove ?? null,
    },
    {
      autoApproveLimit: payload.autoApproveLimit !== undefined ? payload.autoApproveLimit : undefined,
      emergencyAutoDispatch: payload.emergencyAutoDispatch !== undefined ? payload.emergencyAutoDispatch : undefined,
      requireOwnerApprovalAbove: payload.requireOwnerApprovalAbove !== undefined ? payload.requireOwnerApprovalAbove : undefined,
    },
  );
}

export async function computeEffectiveConfig(
  prisma: PrismaClient,
  orgId: string,
  buildingId?: string
): Promise<EffectiveConfig> {
  const { orgConfig, buildingOverride, org } = await findEffectiveConfigData(
    prisma,
    orgId,
    buildingId,
  );
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
