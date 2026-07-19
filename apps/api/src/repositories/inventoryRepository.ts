/**
 * Inventory Repository
 *
 * Centralizes all Prisma access for Building, Unit, and
 * AssetModel entities.  Route handlers and services should use these
 * functions instead of ad-hoc prisma calls.
 *
 * G3: include must match what DTO mappers / callers access.
 * G9: canonical include constants live here.
 */

import { PrismaClient, UnitType, LocationSegment, InsulationQuality, EnergyLabel, HeatingType, LeaseStatus, RentalOwnerSelectionStatus, ParkingKind } from "@prisma/client";

// ─── Canonical Includes (G9) ───────────────────────────────────

/** Full include for building detail views — units, owners, config. */
export const BUILDING_FULL_INCLUDE = {
  units: true,
  owners: true,
  config: true,
} as const;

/** Lighter include for building list views. */
export const BUILDING_LIST_INCLUDE = {
  units: true,
  config: true,
} as const;

/** Full include for unit detail views — parent building with config. */
export const UNIT_FULL_INCLUDE = {
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
  ownerId?: string,
  managerId?: string,
) {
  return prisma.building.findMany({
    where: {
      orgId,
      ...activeFilter(includeInactive),
      ...(ownerId    ? { owners: { some: { userId: ownerId } } } : {}),
      ...(managerId  ? { OR: [{ managerId: null }, { managerId }] } : {}),
    },
    include: {
      manager: { select: { id: true, name: true, email: true } },
    },
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
      manager: { select: { id: true, name: true, email: true } },
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
              netRentChf: true,
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
  data: { name: string; address: string; managerId?: string | null; city?: string | null; postalCode?: string | null },
) {
  return prisma.building.create({
    data: {
      orgId,
      name: data.name,
      address: data.address,
      ...(data.managerId ? { managerId: data.managerId } : {}),
      ...(data.city ? { city: data.city } : {}),
      ...(data.postalCode ? { postalCode: data.postalCode } : {}),
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
    houseRulesText?: string | null;
    parcelNumber?: string | null;
    easementsText?: string | null;
    ecaVolumeM3?: number | null;
    netAreaSqm?: number | null;
    weightedAreaSqm?: number | null;
    lotsApartments?: number | null;
    lotsGarages?: number | null;
    lotsExteriorParking?: number | null;
    constructionDate?: Date | null;
    lastRenovationDate?: Date | null;
    fiscalValueChf?: number | null;
    insuranceValueChf?: number | null;
    ppeEstimateChf?: number | null;
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
      houseRulesText: data.houseRulesText !== undefined ? data.houseRulesText : undefined,
      parcelNumber: data.parcelNumber !== undefined ? data.parcelNumber : undefined,
      easementsText: data.easementsText !== undefined ? data.easementsText : undefined,
      ecaVolumeM3: data.ecaVolumeM3 !== undefined ? data.ecaVolumeM3 : undefined,
      netAreaSqm: data.netAreaSqm !== undefined ? data.netAreaSqm : undefined,
      weightedAreaSqm: data.weightedAreaSqm !== undefined ? data.weightedAreaSqm : undefined,
      lotsApartments: data.lotsApartments !== undefined ? data.lotsApartments : undefined,
      lotsGarages: data.lotsGarages !== undefined ? data.lotsGarages : undefined,
      lotsExteriorParking: data.lotsExteriorParking !== undefined ? data.lotsExteriorParking : undefined,
      constructionDate: data.constructionDate !== undefined ? data.constructionDate : undefined,
      lastRenovationDate: data.lastRenovationDate !== undefined ? data.lastRenovationDate : undefined,
      fiscalValueChf: data.fiscalValueChf !== undefined ? data.fiscalValueChf : undefined,
      insuranceValueChf: data.insuranceValueChf !== undefined ? data.insuranceValueChf : undefined,
      ppeEstimateChf: data.ppeEstimateChf !== undefined ? data.ppeEstimateChf : undefined,
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

/** Lightweight unit ownership check (id + orgId only — no include). */
export async function findUnitExistsByIdAndOrg(
  prisma: PrismaClient,
  unitId: string,
  orgId: string,
) {
  return prisma.unit.findFirst({ where: { id: unitId, orgId }, select: { id: true } });
}

/** Find unit with building → config cascade for effective-config computation. */
export async function findUnitWithBuildingConfig(
  prisma: PrismaClient,
  unitId: string,
  orgId: string,
) {
  return prisma.unit.findFirst({
    where: { id: unitId, orgId },
    include: { building: { include: { config: true } } },
  });
}

export async function findUnitByIdAndOrg(
  prisma: PrismaClient,
  unitId: string,
  orgId: string,
) {
  return prisma.unit.findFirst({
    where: { id: unitId, orgId },
    include: {
      building: true,
      // SIGNED + ACTIVE = binding leases. Rent/charges are exposed so callers can
      // mirror the contractual figure and block divergent unit-level edits.
      leases: {
        where: { status: { in: ["SIGNED", "ACTIVE"] } },
        select: {
          id: true,
          tenantName: true,
          startDate: true,
          endDate: true,
          status: true,
          netRentChf: true,
          chargesTotalChf: true,
        },
      },
      // The flat this parking spot is assigned to (if any), and — for a flat —
      // the parking spots linked to it. Summaries only.
      linkedFlat: { select: { id: true, unitNumber: true, type: true } },
      parkingSpots: {
        where: { isActive: true },
        select: { id: true, unitNumber: true, parkingKind: true, monthlyRentChf: true, type: true },
        orderBy: { unitNumber: "asc" },
      },
    },
  });
}

export async function createUnit(
  prisma: PrismaClient,
  orgId: string,
  buildingId: string,
  data: { unitNumber: string; floor?: string | null; type?: UnitType; parkingKind?: ParkingKind | null; linkedFlatId?: string | null },
) {
  return prisma.unit.create({
    data: {
      buildingId,
      orgId,
      unitNumber: data.unitNumber,
      floor: data.floor ?? null,
      type: data.type ?? UnitType.RESIDENTIAL,
      parkingKind: data.parkingKind ?? null,
      linkedFlatId: data.linkedFlatId ?? null,
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
    parkingKind?: ParkingKind | null;
    linkedFlatId?: string | null;
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
    intrinsicPricePerSqmChf?: number | null;
    vetustePct?: number | null;
    gardenAreaSqm?: number | null;
    gardenWeightPct?: number | null;
    extParkingValueChf?: number | null;
    garageValueChf?: number | null;
    isListedPublicly?: boolean;
  },
) {
  return prisma.unit.update({
    where: { id: unitId },
    data: {
      unitNumber: data.unitNumber ?? undefined,
      floor: data.floor ?? undefined,
      type: data.type ?? undefined,
      ...(data.parkingKind !== undefined ? { parkingKind: data.parkingKind } : {}),
      ...(data.linkedFlatId !== undefined ? { linkedFlatId: data.linkedFlatId } : {}),
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
      ...(data.intrinsicPricePerSqmChf !== undefined ? { intrinsicPricePerSqmChf: data.intrinsicPricePerSqmChf } : {}),
      ...(data.vetustePct !== undefined ? { vetustePct: data.vetustePct } : {}),
      ...(data.gardenAreaSqm !== undefined ? { gardenAreaSqm: data.gardenAreaSqm } : {}),
      ...(data.gardenWeightPct !== undefined ? { gardenWeightPct: data.gardenWeightPct } : {}),
      ...(data.extParkingValueChf !== undefined ? { extParkingValueChf: data.extParkingValueChf } : {}),
      ...(data.garageValueChf !== undefined ? { garageValueChf: data.garageValueChf } : {}),
      ...(data.isListedPublicly !== undefined ? { isListedPublicly: data.isListedPublicly } : {}),
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

/** Re-activate a previously deactivated unit (used by onboarding-merge to reuse it). */
export async function reactivateUnit(
  prisma: PrismaClient,
  unitId: string,
) {
  return prisma.unit.update({
    where: { id: unitId },
    data: { isActive: true },
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

/**
 * Per-unit valuation-worksheet inputs + living area for the active units of a
 * building. Used by the unit-profitability report to value units and allocate
 * building overhead pro-rata by area.
 */
export async function findUnitsWithValuationForBuilding(
  prisma: PrismaClient,
  orgId: string,
  buildingId: string,
) {
  return prisma.unit.findMany({
    where: { orgId, buildingId, isActive: true },
    select: {
      id: true,
      livingAreaSqm: true,
      intrinsicPricePerSqmChf: true,
      vetustePct: true,
      gardenAreaSqm: true,
      gardenWeightPct: true,
      extParkingValueChf: true,
      garageValueChf: true,
    },
  });
}

// ─── Market price per zip ──────────────────────────────────────

export async function findMarketPriceByZip(
  prisma: PrismaClient,
  orgId: string,
  postalCode: string,
) {
  return prisma.marketPricePerZip.findUnique({
    where: { orgId_postalCode: { orgId, postalCode } },
  });
}

export async function upsertMarketPriceByZip(
  prisma: PrismaClient,
  orgId: string,
  data: { postalCode: string; city?: string | null; pricePerSqmChf: number; source?: string | null; asOf?: Date | null },
) {
  return prisma.marketPricePerZip.upsert({
    where: { orgId_postalCode: { orgId, postalCode: data.postalCode } },
    create: {
      orgId,
      postalCode: data.postalCode,
      city: data.city ?? null,
      pricePerSqmChf: data.pricePerSqmChf,
      source: data.source ?? "manual",
      asOf: data.asOf ?? null,
    },
    update: {
      city: data.city ?? null,
      pricePerSqmChf: data.pricePerSqmChf,
      source: data.source ?? "manual",
      asOf: data.asOf ?? null,
    },
  });
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

/** Canonical include for owner detail: billingEntity + ownedBuildings → building */
export const OWNER_DETAIL_INCLUDE = {
  billingEntity: true,
  ownedBuildings: {
    include: {
      building: { select: { id: true, name: true, address: true } },
    },
  },
} as const;

/**
 * Find an OWNER user by ID within an org with full billing + buildings include.
 */
export async function findOrgOwnerByIdFull(
  prisma: PrismaClient,
  orgId: string,
  userId: string,
) {
  return prisma.user.findFirst({
    where: { id: userId, orgId, role: "OWNER" },
    include: OWNER_DETAIL_INCLUDE,
  });
}

/**
 * Update an OWNER user's name and/or email.
 */
export async function updateOwnerUser(
  prisma: PrismaClient,
  userId: string,
  data: { name?: string; email?: string },
) {
  return prisma.user.update({ where: { id: userId }, data });
}

/**
 * Sync all active org buildings to a given owner via BuildingOwner rows.
 * Uses ON CONFLICT DO NOTHING — safe to call multiple times.
 * Returns count of newly inserted rows.
 */
export async function syncAllBuildingsForOwner(
  prisma: PrismaClient,
  orgId: string,
  userId: string,
): Promise<number> {
  return prisma.$executeRaw`
    INSERT INTO "BuildingOwner" (id, "buildingId", "userId")
    SELECT gen_random_uuid(), id, ${userId}
    FROM "Building"
    WHERE "orgId" = ${orgId} AND "isActive" = true
    ON CONFLICT DO NOTHING
  `;
}

/**
 * Fetch depreciation standards for asset-topic autocomplete.
 * Optionally filtered by assetType.
 */
export async function findDepreciationTopicSuggestions(
  prisma: PrismaClient,
  assetType?: string,
) {
  const where: Record<string, unknown> = {};
  if (assetType) where.assetType = assetType;
  return prisma.depreciationStandard.findMany({
    where,
    select: { topic: true, assetType: true, usefulLifeMonths: true },
    distinct: ["topic", "assetType"],
    orderBy: { topic: "asc" },
  });
}

/**
 * Fetch distinct asset topics for an org, for asset-topic autocomplete.
 * Optionally filtered by assetType (stored as `type` on Asset).
 */
export async function findAssetTopicSuggestions(
  prisma: PrismaClient,
  orgId: string,
  assetType?: string,
) {
  const where: Record<string, unknown> = { orgId, isActive: true };
  if (assetType) where.type = assetType;
  return prisma.asset.findMany({
    where,
    select: { topic: true, type: true },
    distinct: ["topic", "type"],
    orderBy: { topic: "asc" },
  });
}

// ─── Helpers for lease / rent-estimation services ──────────────

/** Find a unit by id with parent building (no org scope — caller validates). */
export async function findUnitWithBuilding(prisma: PrismaClient, unitId: string) {
  return prisma.unit.findUnique({ where: { id: unitId }, include: { building: true } });
}

/** Find a unit with deep owners → billingEntity for invoice issuer resolution. */
export async function findUnitWithOwnersBillingEntity(prisma: PrismaClient, unitId: string) {
  return prisma.unit.findUnique({
    where: { id: unitId },
    select: {
      building: {
        select: {
          owners: {
            include: { user: { select: { billingEntity: { select: { id: true } } } } },
            take: 1,
          },
        },
      },
    },
  });
}

/** Mark a single unit as vacant (no org scope). */
export async function setUnitVacant(prisma: PrismaClient, unitId: string) {
  return prisma.unit.update({ where: { id: unitId }, data: { isVacant: true } });
}

/** Mark a unit as vacant scoped to org (updateMany). */
export async function setUnitVacantByOrg(prisma: PrismaClient, unitId: string, orgId: string) {
  return prisma.unit.updateMany({ where: { id: unitId, orgId }, data: { isVacant: true } });
}

/** Find a building by id (bare, no includes). */
export async function findBuildingById(prisma: PrismaClient, buildingId: string) {
  return prisma.building.findUnique({ where: { id: buildingId } });
}

/** Find the first unit in a building (template placeholder selection). */
export async function findFirstUnitInBuilding(
  prisma: PrismaClient,
  buildingId: string,
  orgId: string,
) {
  return prisma.unit.findFirst({
    where: { buildingId, orgId },
    orderBy: { unitNumber: "asc" },
  });
}

/**
 * Find units for bulk rent estimate.
 * The select constant must come from the caller (rentEstimation service).
 */
export async function findUnitsForRentEstimate(
  prisma: PrismaClient,
  where: Record<string, unknown>,
  select: Record<string, unknown>,
) {
  return (prisma.unit.findMany as any)({ where, select });
}

/** Find a single unit for rent estimate using caller-supplied select. */
export async function findUnitForRentEstimate(
  prisma: PrismaClient,
  unitId: string,
  orgId: string,
  select: Record<string, unknown>,
) {
  return (prisma.unit.findFirst as any)({ where: { id: unitId, orgId }, select });
}

/** Find IDs of all active units for a building (for financial aggregations). */
export async function findActiveUnitIdsByBuilding(
  prisma: PrismaClient,
  orgId: string,
  buildingId: string,
) {
  const units = await prisma.unit.findMany({
    where: { buildingId, orgId, isActive: true },
    select: { id: true },
  });
  return units.map((u) => u.id);
}

/** Count all units for a building (active + inactive). Used for occupancy rate denominator. */
export async function countTotalUnitsByBuilding(
  prisma: PrismaClient,
  orgId: string,
  buildingId: string,
): Promise<number> {
  return prisma.unit.count({ where: { buildingId, orgId } });
}

/**
 * Count DISTINCT active units that had a lease overlapping the given period.
 * Includes TERMINATED leases whose tenure overlapped the period so that
 * historical reports reflect true occupancy rather than current-state leases.
 *
 * Counts units (not lease rows): a unit with a mid-period tenant turnover has two
 * overlapping leases but is still one occupied unit, so occupancy can never exceed
 * the total unit count. (Counting leases here caused >100% occupancy — 2026-07-19.)
 */
export async function countLeasedUnitsByBuilding(
  prisma: PrismaClient,
  orgId: string,
  buildingId: string,
  from: Date,
  to: Date,
): Promise<number> {
  return prisma.unit.count({
    where: {
      orgId,
      buildingId,
      isActive: true,
      leases: {
        some: {
          status: { in: ["ACTIVE", "SIGNED", "TERMINATED"] },
          startDate: { lt: to },
          OR: [{ endDate: null }, { endDate: { gte: from } }],
        },
      },
    },
  });
}

/** Find a building config by building ID. */
export async function findBuildingConfigById(
  prisma: PrismaClient,
  buildingId: string,
) {
  return prisma.buildingConfig.findUnique({ where: { buildingId } });
}

/** Find a vacant unit for owner selection, with building + config include.
 * A unit is eligible for selection when it has no active/signed lease and
 * no pending RentalOwnerSelection — matching the criteria used by findVacantUnits.
 * Note: isVacant defaults to false on new units and is only set by specific
 * flows (lease termination, selection exhaustion), so we do NOT gate on it here.
 */
export async function findVacantUnitWithBuildingConfig(
  prisma: PrismaClient,
  unitId: string,
  orgId: string,
) {
  return prisma.unit.findFirst({
    where: {
      id: unitId,
      building: { orgId },
      leases: {
        none: {
          status: { in: [LeaseStatus.ACTIVE, LeaseStatus.READY_TO_SIGN, LeaseStatus.SIGNED] },
          deletedAt: null,
        },
      },
      ownerSelections: {
        none: {
          status: {
            in: [
              RentalOwnerSelectionStatus.AWAITING_SIGNATURE,
              RentalOwnerSelectionStatus.FALLBACK_1,
              RentalOwnerSelectionStatus.FALLBACK_2,
              RentalOwnerSelectionStatus.SIGNED,
            ],
          },
        },
      },
    },
    include: { building: { include: { config: true } } },
  });
}

