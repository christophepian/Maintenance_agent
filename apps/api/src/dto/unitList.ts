/**
 * Unit List DTO
 *
 * Maps units (with included active leases) to a frontend-friendly shape
 * that includes a derived occupancy status indicator.
 *
 * Occupancy logic:
 *   - Has ACTIVE lease       → "OCCUPIED" (tenantName + moveInDate from lease)
 *   - No ACTIVE lease + isVacant=true  → "LISTED" (accepting applications)
 *   - No ACTIVE lease + isVacant=false → "VACANT"
 */

// ─── DTO interfaces ────────────────────────────────────────────

export type OccupancyStatus = "OCCUPIED" | "VACANT" | "LISTED";

export interface UnitListDTO {
  id: string;
  buildingId: string;
  orgId: string;
  unitNumber: string;
  floor: string | null;
  type: string;
  isActive: boolean;
  isVacant: boolean;
  monthlyRentChf: number | null;
  monthlyChargesChf: number | null;
  livingAreaSqm: number | null;
  rooms: number | null;
  hasBalcony: boolean;
  hasTerrace: boolean;
  hasParking: boolean;
  createdAt: string;
  updatedAt: string;
  occupancyStatus: OccupancyStatus;
  tenantName: string | null;
  moveInDate: string | null;
}

// ─── Prisma result type (from listUnits with lease include) ────

type UnitWithLeases = {
  id: string;
  buildingId: string;
  orgId: string;
  unitNumber: string;
  floor: string | null;
  type: string;
  isActive: boolean;
  isVacant: boolean;
  monthlyRentChf: number | null;
  monthlyChargesChf: number | null;
  livingAreaSqm: number | null;
  rooms: number | null;
  hasBalcony: boolean;
  hasTerrace: boolean;
  hasParking: boolean;
  createdAt: Date;
  updatedAt: Date;
  leases: {
    id: string;
    tenantName: string;
    startDate: Date;
  }[];
};

// ─── Mapper ────────────────────────────────────────────────────

function deriveOccupancyStatus(unit: UnitWithLeases): {
  occupancyStatus: OccupancyStatus;
  tenantName: string | null;
  moveInDate: string | null;
} {
  const activeLease = unit.leases[0] ?? null;

  if (activeLease) {
    return {
      occupancyStatus: "OCCUPIED",
      tenantName: activeLease.tenantName ?? null,
      moveInDate: activeLease.startDate.toISOString(),
    };
  } else if (unit.isVacant) {
    return {
      occupancyStatus: "LISTED",
      tenantName: null,
      moveInDate: null,
    };
  } else {
    return {
      occupancyStatus: "VACANT",
      tenantName: null,
      moveInDate: null,
    };
  }
}

export function mapUnitToListDTO(unit: UnitWithLeases): UnitListDTO {
  const { occupancyStatus, tenantName, moveInDate } = deriveOccupancyStatus(unit);

  return {
    id: unit.id,
    buildingId: unit.buildingId,
    orgId: unit.orgId,
    unitNumber: unit.unitNumber,
    floor: unit.floor,
    type: unit.type,
    isActive: unit.isActive,
    isVacant: unit.isVacant,
    monthlyRentChf: unit.monthlyRentChf,
    monthlyChargesChf: unit.monthlyChargesChf,
    livingAreaSqm: unit.livingAreaSqm,
    rooms: unit.rooms,
    hasBalcony: unit.hasBalcony,
    hasTerrace: unit.hasTerrace,
    hasParking: unit.hasParking,
    createdAt: unit.createdAt.toISOString(),
    updatedAt: unit.updatedAt.toISOString(),
    occupancyStatus,
    tenantName,
    moveInDate,
  };
}
