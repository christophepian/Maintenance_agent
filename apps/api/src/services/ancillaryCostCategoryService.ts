/**
 * ancillaryCostCategoryService
 *
 * Canonical Nebenkosten (ancillary cost) taxonomy. The `billability` flag is the
 * legal gate that prevents non-billable landlord costs (mortgage, insurance,
 * property tax, major repairs, building management) from ever being apportioned
 * to a tenant. See docs/ANCILLARY_COSTS_RECONCILIATION.md.
 */

import { CostBillability, DistributionKey } from "@prisma/client";
import prisma from "./prismaClient";
import * as repo from "../repositories/ancillaryCostCategoryRepository";

export interface AncillaryCostCategoryDTO {
  id: string;
  code: string;
  name: string;
  billability: CostBillability;
  defaultKey: DistributionKey;
  isAdminFee: boolean;
  expenseTypeId: string | null;
  accountId: string | null;
  isActive: boolean;
}

type CategoryRow = Awaited<ReturnType<typeof repo.findAncillaryCostCategoryById>>;

export function mapCategoryToDTO(c: NonNullable<CategoryRow>): AncillaryCostCategoryDTO {
  return {
    id: c.id,
    code: c.code,
    name: c.name,
    billability: c.billability,
    defaultKey: c.defaultKey,
    isAdminFee: c.isAdminFee,
    expenseTypeId: c.expenseTypeId,
    accountId: c.accountId,
    isActive: c.isActive,
  };
}

export async function listCategories(
  orgId: string,
  opts: { includeInactive?: boolean } = {},
): Promise<AncillaryCostCategoryDTO[]> {
  const rows = await repo.listAncillaryCostCategories(prisma, orgId, opts);
  return rows.map(mapCategoryToDTO);
}

export async function createCategory(
  orgId: string,
  data: repo.AncillaryCostCategoryWriteData,
): Promise<AncillaryCostCategoryDTO> {
  const created = await repo.createAncillaryCostCategory(prisma, orgId, data);
  return mapCategoryToDTO(created);
}

export async function updateCategory(
  orgId: string,
  id: string,
  data: Partial<repo.AncillaryCostCategoryWriteData>,
): Promise<AncillaryCostCategoryDTO> {
  const existing = await repo.findAncillaryCostCategoryById(prisma, id, orgId);
  if (!existing) throw new Error("Category not found");
  const updated = await repo.updateAncillaryCostCategory(prisma, id, data);
  return mapCategoryToDTO(updated);
}

/** Fetch a category for a lease expense item, asserting org ownership. */
export async function getCategoryForOrg(orgId: string, id: string) {
  return repo.findAncillaryCostCategoryById(prisma, id, orgId);
}

// ─── Default Swiss residential taxonomy ─────────────────────────
interface SeedCategory {
  code: string;
  name: string;
  billability: CostBillability;
  defaultKey: DistributionKey;
  isAdminFee?: boolean;
}

export const DEFAULT_ANCILLARY_CATEGORIES: SeedCategory[] = [
  // Billable ancillary costs (recoverable from the tenant)
  { code: "HEATING_HOTWATER", name: "Chauffage & eau chaude", billability: "BILLABLE", defaultKey: "CONSUMPTION" },
  { code: "WATER_WASTEWATER", name: "Eau & eaux usées", billability: "BILLABLE", defaultKey: "CONSUMPTION" },
  { code: "COMMON_ELECTRICITY", name: "Électricité des communs", billability: "BILLABLE", defaultKey: "SURFACE_AREA" },
  { code: "ELEVATOR", name: "Ascenseur (entretien)", billability: "BILLABLE", defaultKey: "UNIT_COUNT" },
  { code: "CARETAKER_CLEANING", name: "Conciergerie & nettoyage", billability: "BILLABLE", defaultKey: "SURFACE_AREA" },
  { code: "SNOW_REMOVAL", name: "Déneigement", billability: "BILLABLE", defaultKey: "SURFACE_AREA" },
  { code: "GROUNDS", name: "Entretien des extérieurs", billability: "BILLABLE", defaultKey: "SURFACE_AREA" },
  { code: "WASTE_TAX", name: "Taxe déchets", billability: "BILLABLE", defaultKey: "OCCUPANT_COUNT" },
  { code: "TV_CABLE", name: "TV / téléréseau", billability: "BILLABLE", defaultKey: "UNIT_COUNT" },
  { code: "ADMIN_FEE", name: "Frais administratifs (décompte)", billability: "BILLABLE", defaultKey: "SURFACE_AREA", isAdminFee: true },
  // Non-billable landlord costs (never charged to a tenant)
  { code: "MORTGAGE_INTEREST", name: "Intérêts hypothécaires", billability: "NON_BILLABLE", defaultKey: "SURFACE_AREA" },
  { code: "AMORTIZATION", name: "Amortissement", billability: "NON_BILLABLE", defaultKey: "SURFACE_AREA" },
  { code: "BUILDING_INSURANCE", name: "Assurance bâtiment", billability: "NON_BILLABLE", defaultKey: "SURFACE_AREA" },
  { code: "PROPERTY_TAX", name: "Impôt foncier", billability: "NON_BILLABLE", defaultKey: "SURFACE_AREA" },
  { code: "MAJOR_REPAIRS", name: "Grosses réparations / rénovations", billability: "NON_BILLABLE", defaultKey: "SURFACE_AREA" },
  { code: "BUILDING_MANAGEMENT", name: "Gérance de l'immeuble", billability: "NON_BILLABLE", defaultKey: "SURFACE_AREA" },
];

/** Idempotently seed the default taxonomy for an org. Safe to call repeatedly. */
export async function seedDefaultCategories(orgId: string): Promise<number> {
  let count = 0;
  for (const c of DEFAULT_ANCILLARY_CATEGORIES) {
    try {
      await repo.upsertAncillaryCostCategory(prisma, orgId, c);
      count++;
    } catch (e: any) {
      if (e?.code !== "P2002") throw e; // ignore unique races
    }
  }
  return count;
}
