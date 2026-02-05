import { PrismaClient } from "@prisma/client";

export type OrgConfigDTO = {
  autoApproveLimit: number;
};

export const DEFAULT_ORG_ID = "default-org";

export async function getOrgConfig(prisma: PrismaClient): Promise<OrgConfigDTO> {
  const config = await prisma.orgConfig.findUnique({
    where: { orgId: DEFAULT_ORG_ID },
  });

  if (!config) throw new Error("ORG_CONFIG_NOT_FOUND");

  return { autoApproveLimit: config.autoApproveLimit };
}

export async function updateOrgConfig(
  prisma: PrismaClient,
  autoApproveLimit: number
): Promise<OrgConfigDTO> {
  const updated = await prisma.orgConfig.update({
    where: { orgId: DEFAULT_ORG_ID },
    data: { autoApproveLimit },
  });

  return { autoApproveLimit: updated.autoApproveLimit };
}
