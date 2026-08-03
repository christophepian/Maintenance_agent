import { OrgMode, PrismaClient } from "@prisma/client";
import {
  findOrgById,
  createOrgRecord,
  findOrgConfig,
  createOrgConfigRecord,
  findOrgConfigWithMode,
  updateOrgConfigRecord,
  updateOrgMode,
  findOrgMode,
} from "../repositories/orgConfigRepository";

export type OrgConfigDTO = {
  autoApproveLimit: number;
  autoLegalRouting: boolean;
  invoiceLeadTimeDays: number;
  mode: OrgMode;
};

export const DEFAULT_ORG_ID = "default-org";

export async function ensureDefaultOrgConfig(prisma: PrismaClient): Promise<void> {
  const orgId = DEFAULT_ORG_ID;
  const org = await findOrgById(prisma, orgId);
  if (!org) {
    await createOrgRecord(prisma, {
      id: orgId,
      name: "Default Org",
      mode: OrgMode.MANAGED,
    });
  }

  const config = await findOrgConfig(prisma, orgId);
  if (!config) {
    await createOrgConfigRecord(prisma, { orgId, autoApproveLimit: 200, autoLegalRouting: false });
  }

  // Seed the default Nebenkosten taxonomy (idempotent; safe on every boot).
  try {
    const { seedDefaultCategories } = await import("./ancillaryCostCategoryService");
    await seedDefaultCategories(orgId);
  } catch (e) {
    console.error("[orgConfig] Failed to seed ancillary cost categories:", e);
  }
}

export async function getOrgConfig(
  prisma: PrismaClient,
  orgId: string = DEFAULT_ORG_ID
): Promise<OrgConfigDTO> {
  const { config, org } = await findOrgConfigWithMode(prisma, orgId);

  if (!config || !org) throw new Error("ORG_CONFIG_NOT_FOUND");

  return { autoApproveLimit: config.autoApproveLimit, autoLegalRouting: config.autoLegalRouting, invoiceLeadTimeDays: config.invoiceLeadTimeDays, mode: org.mode };
}

export async function updateOrgConfig(
  prisma: PrismaClient,
  orgId: string,
  input: { autoApproveLimit?: number; autoLegalRouting?: boolean; invoiceLeadTimeDays?: number; mode?: OrgMode }
): Promise<OrgConfigDTO> {
  const [config, org] = await Promise.all([
    updateOrgConfigRecord(prisma, orgId, {
      autoApproveLimit: input.autoApproveLimit ?? undefined,
      autoLegalRouting: input.autoLegalRouting ?? undefined,
      invoiceLeadTimeDays: input.invoiceLeadTimeDays ?? undefined,
    }),
    input.mode
      ? updateOrgMode(prisma, orgId, input.mode)
      : findOrgMode(prisma, orgId),
  ]);

  if (!org) throw new Error("ORG_NOT_FOUND");

  return { autoApproveLimit: config.autoApproveLimit, autoLegalRouting: config.autoLegalRouting, invoiceLeadTimeDays: config.invoiceLeadTimeDays, mode: org.mode };
}
