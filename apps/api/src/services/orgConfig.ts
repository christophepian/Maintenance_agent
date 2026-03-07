import { OrgMode, PrismaClient } from "@prisma/client";

export type OrgConfigDTO = {
  autoApproveLimit: number;
  autoLegalRouting: boolean;
  mode: OrgMode;
};

export const DEFAULT_ORG_ID = "default-org";

export async function ensureDefaultOrgConfig(prisma: PrismaClient): Promise<void> {
  const orgId = DEFAULT_ORG_ID;
  const org = await prisma.org.findUnique({ where: { id: orgId } });
  if (!org) {
    await prisma.org.create({
      data: {
        id: orgId,
        name: "Default Org",
        mode: OrgMode.MANAGED,
      },
    });
  }

  const config = await prisma.orgConfig.findUnique({ where: { orgId } });
  if (!config) {
    await prisma.orgConfig.create({
      data: { orgId, autoApproveLimit: 200, autoLegalRouting: false },
    });
  }
}

export async function getOrgConfig(
  prisma: PrismaClient,
  orgId: string = DEFAULT_ORG_ID
): Promise<OrgConfigDTO> {
  const [config, org] = await Promise.all([
    prisma.orgConfig.findUnique({ where: { orgId } }),
    prisma.org.findUnique({ where: { id: orgId }, select: { mode: true } }),
  ]);

  if (!config || !org) throw new Error("ORG_CONFIG_NOT_FOUND");

  return { autoApproveLimit: config.autoApproveLimit, autoLegalRouting: config.autoLegalRouting, mode: org.mode };
}

export async function updateOrgConfig(
  prisma: PrismaClient,
  orgId: string,
  input: { autoApproveLimit?: number; autoLegalRouting?: boolean; mode?: OrgMode }
): Promise<OrgConfigDTO> {
  const [config, org] = await Promise.all([
    prisma.orgConfig.update({
      where: { orgId },
      data: {
        autoApproveLimit: input.autoApproveLimit ?? undefined,
        autoLegalRouting: input.autoLegalRouting ?? undefined,
      },
    }),
    input.mode
      ? prisma.org.update({ where: { id: orgId }, data: { mode: input.mode } })
      : prisma.org.findUnique({ where: { id: orgId }, select: { mode: true } }),
  ]);

  if (!org) throw new Error("ORG_NOT_FOUND");

  return { autoApproveLimit: config.autoApproveLimit, autoLegalRouting: config.autoLegalRouting, mode: org.mode };
}
