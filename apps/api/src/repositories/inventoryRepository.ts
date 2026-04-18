/**
 * Inventory Repository
 *
 * Centralizes all Prisma access for Building, Unit, Appliance, and
 * AssetModel entities.  Route handlers and services should use these
 * functions instead of ad-hoc prisma calls.
 *
 * G3: include must match what DTO mappers / callers access.
 * G9: canonical include constants live here.
 */

import { PrismaClient, UnitType, LocationSegment, InsulationQuality, EnergyLabel, HeatingType } from "@prisma/client";

// ─── Canonical Includes (G9) ───────────────────────────────────

/** Full include for building detail views — units with appliances, owners, config. */
export const BUILDING_FULL_INCLUDE = {
  units: {
    include: {
      appliances: true,
    },
  },
  owners: true,
  config: true,
} as const;

/** Lighter include for building list views. */
export const BUILDING_LIST_INCLUDE = {
  units: true,
  config: true,
} as const;

/** Full include for unit detail views — appliances + parent building with config. */
export const UNIT_FULL_INCLUDE = {
  appliances: true,
  building: {
    include: {
      config: true,
    },
  },
} as const;

/** Include for appliance detail — asset model + parent unit/building chain. */
export const APPLIANCE_INCLUDE = {
  assetModel: true,
  unit: {
    include: {
      building: true,
    },
  },
} as const;

// ─── Helpers ───────────────────────────────────────────────────

const activeFilter = (includeInactive?: boolean) =>
  includeInactive ? {} : { isActive: true };

// ─── Buildings ─────────────────────────────────────────────────

export async function listBuildings(
  prisma: PrismaClient,
  orgId: string,
  includeInactive?: boolean,
) {
  return prisma.building.findMany({
    where: { orgId, ...activeFilter(includeInactive) },
    orderBy: { createdAt: "desc" },
  });
}

export async function findBuildingByIdAndOrg(
  prisma: PrismaClient,
  buildingId: string,
  orgId: string,
) {
  return prisma.building.findFirst({ where: { id: buildingId, orgId } });
}

/**
 * Deep fetch for the building detail page.
 * Includes: owners (BuildingOwner→User), units.occupancies.tenant, units.leases (ACTIVE).
 * G3/G9: include must match what the DTO mapper accesses.
 */
export async function findBuildingByIdDeep(
  prisma: PrismaClient,
  buildingId: string,
  orgId: string,
) {
  return prisma.building.findFirst({
    where: { id: buildingId, orgId },
    include: {
      owners: {
        include: {
          user: {
            select: { id: true, name: true, email: true },
          },
        },
      },
      units: {
        where: { isActive: true },
        include: {
          occupancies: {
            include: {
              tenant: {
                select: { id: true, name: true, phone: true, email: true },
              },
            },
          },
          leases: {
            where: { status: "ACTIVE", deletedAt: null },
            select: {
              id: true,
              tenantName: true,
              tenantPhone: true,
              tenantEmail: true,
              startDate: true,
              unitId: true,
            },
          },
        },
      },
    },
  });
}

export async function createBuilding(
  prisma: PrismaClient,
  orgId: string,
  data: { name: string; address: string },
) {
  return prisma.building.create({
    data: {
      orgId,
      name: data.name,
      address: data.address,
    },
  });
}

export async function updateBuilding(
  prisma: PrismaClient,
  buildingId: string,
  data: {
    name?: string;
    address?: string;
    yearBuilt?: number;
    hasElevator?: boolean;
    hasConcierge?: boolean;
    managedSince?: Date | null;
  },
) {
  return prisma.building.update({
    where: { id: buildingId },
    data: {
      name: data.name ?? undefined,
      address: data.address ?? undefined,
      yearBuilt: data.yearBuilt ?? undefined,
      hasElevator: data.hasElevator ?? undefined,
      hasConcierge: data.hasConcierge ?? undefined,
      managedSince: data.managedSince !== undefined ? data.managedSince : undefined,
    },
  });
}

export async function deactivateBuilding(
  prisma: PrismaClient,
  buildingId: string,
) {
  return prisma.building.update({
    where: { id: buildingId },
    data: { isActive: false },
  });
}

// ─── Units ─────────────────────────────────────────────────────

export async function listUnits(
  prisma: PrismaClient,
  orgId: string,
  buildingId: string,
  includeInactive?: boolean,
  type?: UnitType,
) {
  return prisma.unit.findMany({
    where: {
      orgId,
      buildingId,
      ...activeFilter(includeInactive),
      ...(type ? { type } : {}),
    },
    include: {
      leases: {
        where: { status: "ACTIVE", deletedAt: null },
        select: { id: true, tenantName: true, startDate: true },
      },
    },
    orderBy: { unitNumber: "asc" },
  });
}

/**
 * List all units across all buildings for an org.
 * Used by the GET /units route.
 */
export async function listAllUnitsForOrg(
  prisma: PrismaClient,
  orgId: string,
  includeInactive?: boolean,
) {
  return prisma.unit.findMany({
    where: {
      building: { orgId, ...(includeInactive ? {} : { isActive: true }) },
      ...(includeInactive ? {} : { isActive: true }),
    },
    include: { building: true },
    orderBy: { createdAt: "desc" },
  });
}

export async function findUnitByIdAndOrg(
  prisma: PrismaClient,
  unitId: string,
  orgId: string,
) {
  return prisma.unit.findFirst({
    where: { id: unitId, orgId },
    include: { building: true },
  });
}

export async function createUnit(
  prisma: PrismaClient,
  orgId: string,
  buildingId: string,
  data: { unitNumber: string; floor?: string | null; type?: UnitType },
) {
  return prisma.unit.create({
    data: {
      buildingId,
      orgId,
      unitNumber: data.unitNumber,
      floor: data.floor ?? null,
      type: data.type ?? UnitType.RESIDENTIAL,
    },
  });
}

export async function updateUnit(
  prisma: PrismaClient,
  unitId: string,
  data: {
    unitNumber?: string;
    floor?: string;
    type?: UnitType;
    livingAreaSqm?: number;
    rooms?: number;
    hasBalcony?: boolean;
    hasTerrace?: boolean;
    hasParking?: boolean;
    locationSegment?: LocationSegment;
    lastRenovationYear?: number;
    insulationQuality?: InsulationQuality;
    energyLabel?: EnergyLabel;
    heatingType?: HeatingType;
    monthlyRentChf?: number | null;
    monthlyChargesChf?: number | null;
  },
) {
  return prisma.unit.update({
    where: { id: unitId },
    data: {
      unitNumber: data.unitNumber ?? undefined,
      floor: data.floor ?? undefined,
      type: data.type ?? undefined,
      livingAreaSqm: data.livingAreaSqm ?? undefined,
      rooms: data.rooms ?? undefined,
      hasBalcony: data.hasBalcony ?? undefined,
      hasTerrace: data.hasTerrace ?? undefined,
      hasParking: data.hasParking ?? undefined,
      locationSegment: data.locationSegment ?? undefined,
      lastRenovationYear: data.lastRenovationYear ?? undefined,
      insulationQuality: data.insulationQuality ?? undefined,
      energyLabel: data.energyLabel ?? undefined,
      heatingType: data.heatingType ?? undefined,
      ...(data.monthlyRentChf !== undefined ? { monthlyRentChf: data.monthlyRentChf } : {}),
      ...(data.monthlyChargesChf !== undefined ? { monthlyChargesChf: data.monthlyChargesChf } : {}),
    },
  });
}

export async function deactivateUnit(
  prisma: PrismaClient,
  unitId: string,
) {
  return prisma.unit.update({
    where: { id: unitId },
    data: { isActive: false },
  });
}

export async function countActiveUnits(
  prisma: PrismaClient,
  buildingId: string,
) {
  return prisma.unit.count({
    where: { buildingId, isActive: true },
  });
}

// ─── Appliances ────────────────────────────────────────────────

export async function listAppliances(
  prisma: PrismaClient,
  orgId: string,
  unitId: string,
  includeInactive?: boolean,
) {
  return prisma.appliance.findMany({
    where: { orgId, unitId, ...activeFilter(includeInactive) },
    include: { assetModel: true },
    orderBy: { createdAt: "desc" },
  });
}

export async function findApplianceByIdAndOrg(
  prisma: PrismaClient,
  applianceId: string,
  orgId: string,
) {
  return prisma.appliance.findFirst({ where: { id: applianceId, orgId } });
}

export async function createAppliance(
  prisma: PrismaClient,
  orgId: string,
  unitId: string,
  data: {
    name: string;
    assetModelId?: string | null;
    serial?: string | null;
    installDate?: Date | null;
    notes?: string | null;
  },
) {
  return prisma.appliance.create({
    data: {
      unitId,
      orgId,
      name: data.name,
      assetModelId: data.assetModelId ?? null,
      serial: data.serial ?? null,
      installDate: data.installDate ?? null,
      notes: data.notes ?? null,
    },
    include: { assetModel: true },
  });
}

export async function updateAppliance(
  prisma: PrismaClient,
  applianceId: string,
  data: {
    name?: string;
    assetModelId?: string;
    serial?: string;
    installDate?: Date;
    notes?: string;
  },
) {
  return prisma.appliance.update({
    where: { id: applianceId },
    data: {
      name: data.name ?? undefined,
      assetModelId: data.assetModelId ?? undefined,
      serial: data.serial ?? undefined,
      installDate: data.installDate ?? undefined,
      notes: data.notes ?? undefined,
    },
    include: { assetModel: true },
  });
}

export async function deactivateAppliance(
  prisma: PrismaClient,
  applianceId: string,
) {
  return prisma.appliance.update({
    where: { id: applianceId },
    data: { isActive: false },
  });
}

export async function countActiveAppliances(
  prisma: PrismaClient,
  unitId: string,
) {
  return prisma.appliance.count({
    where: { unitId, isActive: true },
  });
}

export async function countRequestsForAppliance(
  prisma: PrismaClient,
  applianceId: string,
) {
  return prisma.request.count({ where: { applianceId } });
}

// ─── Asset Models ──────────────────────────────────────────────

export async function listAssetModels(
  prisma: PrismaClient,
  orgId: string,
  includeInactive?: boolean,
) {
  return prisma.assetModel.findMany({
    where: {
      ...activeFilter(includeInactive),
      OR: [{ orgId: null }, { orgId }],
    },
    orderBy: [{ category: "asc" }, { manufacturer: "asc" }, { model: "asc" }],
  });
}

export async function findAssetModelById(
  prisma: PrismaClient,
  modelId: string,
) {
  return prisma.assetModel.findFirst({ where: { id: modelId } });
}

export async function createAssetModel(
  prisma: PrismaClient,
  orgId: string,
  data: {
    manufacturer: string;
    model: string;
    category: string;
    specs?: string | null;
  },
) {
  return prisma.assetModel.create({
    data: {
      orgId,
      manufacturer: data.manufacturer,
      model: data.model,
      category: data.category,
      specs: data.specs ?? null,
      isActive: true,
    },
  });
}

export async function updateAssetModel(
  prisma: PrismaClient,
  modelId: string,
  data: {
    manufacturer?: string;
    model?: string;
    category?: string;
    specs?: string;
  },
) {
  return prisma.assetModel.update({
    where: { id: modelId },
    data: {
      manufacturer: data.manufacturer ?? undefined,
      model: data.model ?? undefined,
      category: data.category ? data.category.trim() : undefined,
      specs: data.specs ?? undefined,
    },
  });
}

export async function deactivateAssetModel(
  prisma: PrismaClient,
  modelId: string,
) {
  return prisma.assetModel.update({
    where: { id: modelId },
    data: { isActive: false },
  });
}

export async function countAppliancesForAssetModel(
  prisma: PrismaClient,
  modelId: string,
) {
  return prisma.appliance.count({ where: { assetModelId: modelId } });
}

// ─── Building Owners ───────────────────────────────────────────

export async function findBuildingOwners(
  prisma: PrismaClient,
  buildingId: string,
) {
  return prisma.buildingOwner.findMany({
    where: { buildingId },
    include: {
      user: {
        select: { id: true, name: true, email: true },
      },
    },
    orderBy: { createdAt: "asc" },
  });
}

export async function findBuildingOwnersWithTaxRate(
  prisma: PrismaClient,
  buildingId: string,
) {
  return prisma.buildingOwner.findMany({
    where: { buildingId },
    include: {
      user: {
        select: { id: true, name: true, email: true, marginalTaxRate: true },
      },
    },
    orderBy: { createdAt: "asc" },
  });
}

/**
 * Add an owner to a building.  Silently returns existing row if the
 * pair already exists (idempotent).
 */
export async function addBuildingOwner(
  prisma: PrismaClient,
  buildingId: string,
  userId: string,
) {
  try {
    return await prisma.buildingOwner.create({
      data: { buildingId, userId },
      include: {
        user: {
          select: { id: true, name: true, email: true },
        },
      },
    });
  } catch (e: any) {
    // Unique constraint violation → already linked, return existing
    if (e?.code === "P2002") {
      return prisma.buildingOwner.findFirst({
        where: { buildingId, userId },
        include: {
          user: {
            select: { id: true, name: true, email: true },
          },
        },
      });
    }
    throw e;
  }
}

/**
 * Remove an owner from a building.  Uses deleteMany for idempotency
 * (returns 0 if not found, never throws).
 */
export async function removeBuildingOwner(
  prisma: PrismaClient,
  buildingId: string,
  userId: string,
) {
  return prisma.buildingOwner.deleteMany({
    where: { buildingId, userId },
  });
}

/**
 * Return all OWNER-role users in an org (candidates for assignment).
 */
export async function findOrgOwners(
  prisma: PrismaClient,
  orgId: string,
) {
  return prisma.user.findMany({
    where: { orgId, role: "OWNER" },
    select: { id: true, name: true, email: true },
    orderBy: { name: "asc" },
  });
}

/**
 * Return all OWNER-role users in an org with billing entity data.
 * Used by GET /people/owners.
 */
export async function findOrgOwnersWithBilling(
  prisma: PrismaClient,
  orgId: string,
) {
  return prisma.user.findMany({
    where: { orgId, role: "OWNER" },
    include: { billingEntity: { select: { id: true, name: true, iban: true } } },
    orderBy: { name: "asc" },
  });
}

/**
 * Find a user by email within an org. Used for duplicate checks.
 */
export async function findUserByOrgAndEmail(
  prisma: PrismaClient,
  orgId: string,
  email: string,
) {
  return prisma.user.findFirst({ where: { orgId, email } });
}

/**
 * Create an owner user with hashed password.
 */
export async function createOwnerUser(
  prisma: PrismaClient,
  data: { orgId: string; name: string; email: string; passwordHash: string },
) {
  return prisma.user.create({
    data: { orgId: data.orgId, name: data.name, email: data.email, passwordHash: data.passwordHash, role: "OWNER" },
  });
}

/**
 * Find a user by ID within an org and verify they have the OWNER role.
 * Returns the user if found and is an owner, null otherwise.
 */
export async function findOrgOwnerById(
  prisma: PrismaClient,
  orgId: string,
  userId: string,
): Promise<{ id: string; role: string } | null> {
  const user = await prisma.user.findFirst({
    where: { id: userId, orgId },
    select: { id: true, role: true },
  });
  return user;
}
