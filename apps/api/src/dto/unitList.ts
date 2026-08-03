/**
 * Unit List DTO
 *
 * Maps units (with included leases/occupancies) to a frontend-friendly shape
 * that carries occupancy on TWO independent axes:
 *
 *   1. occupancyStatus: "OCCUPIED" | "VACANT" — is someone in it? Driven by
 *      tenancy, NEVER by rent. A unit is OCCUPIED when it has an active lease,
 *      OR its own occupancy record, OR (for a parking spot) it's linked to an
 *      occupied flat. So a co-billed garage — whose rent rides on the flat's
 *      lease and is often 0 on the spot itself — correctly reads OCCUPIED.
 *   2. listed: boolean — are we marketing it? The `isVacant` field is the
 *      legacy "available / accepting applications" flag; a vacant unit can be
 *      listed or not, independently of the occupancy axis.
 *
 * (Previously these were collapsed into one enum where "LISTED" replaced
 * "VACANT" and occupancy was inferred from the unit's own lease alone, which
 * wrongly marked rent-0 co-billed parking as vacant.)
 */

// ─── DTO interfaces ────────────────────────────────────────────

export type OccupancyStatus = "OCCUPIED" | "VACANT";

export interface UnitListDTO {
  id: string;
  buildingId: string;
  orgId: string;
  unitNumber: string;
  floor: string | null;
  type: string;
  parkingKind: string | null;
  linkedFlatId: string | null;
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
  /** Marketed / accepting applications (the `isVacant` availability flag). */
  listed: boolean;
  tenantName: string | null;
  moveInDate: string | null;
}

// ─── Prisma result type (from listUnits with lease/occupancy include) ────

type UnitWithLeases = {
  id: string;
  buildingId: string;
  orgId: string;
  unitNumber: string;
  floor: string | null;
  type: string;
  parkingKind: string | null;
  linkedFlatId: string | null;
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
  occupancies?: { tenant: { name: string | null } }[];
  linkedFlat?: { leases: { id: string }[]; occupancies: { id: string }[] } | null;
};

// ─── Occupancy derivation (shared by the list mapper + single-unit route) ──

export interface OccupancyResult {
  occupancyStatus: OccupancyStatus;
  listed: boolean;
  tenantName: string | null;
  moveInDate: string | null;
}

/**
 * Derive the two-axis occupancy from normalized tenancy signals. Occupied when
 * ANY of: an active lease on the unit, an occupancy record on the unit, or (for
 * a parking spot) the linked flat is itself occupied. Rent plays no part.
 */
export function computeOccupancy(input: {
  isVacant: boolean;
  activeLease: { tenantName: string | null; startDate: Date } | null;
  occupancyTenantName: string | null;
  linkedFlatOccupied: boolean;
}): OccupancyResult {
  const occupied = !!input.activeLease || !!input.occupancyTenantName || input.linkedFlatOccupied;
  return {
    occupancyStatus: occupied ? "OCCUPIED" : "VACANT",
    // "Listed" (marketed / accepting applications) is only meaningful for a
    // vacant unit — so an occupied unit that still carries a stale `isVacant`
    // flag doesn't show a spurious Listed tag.
    listed: !occupied && input.isVacant,
    tenantName: input.activeLease?.tenantName ?? input.occupancyTenantName ?? null,
    moveInDate: input.activeLease?.startDate ? input.activeLease.startDate.toISOString() : null,
  };
}

// ─── Mapper ────────────────────────────────────────────────────

export function mapUnitToListDTO(unit: UnitWithLeases): UnitListDTO {
  const lease = unit.leases[0] ?? null; // list query pre-filters to ACTIVE
  const linkedFlat = unit.linkedFlat ?? null;
  const { occupancyStatus, listed, tenantName, moveInDate } = computeOccupancy({
    isVacant: unit.isVacant,
    activeLease: lease ? { tenantName: lease.tenantName ?? null, startDate: lease.startDate } : null,
    occupancyTenantName: unit.occupancies?.[0]?.tenant?.name ?? null,
    linkedFlatOccupied: !!linkedFlat && ((linkedFlat.leases?.length ?? 0) > 0 || (linkedFlat.occupancies?.length ?? 0) > 0),
  });

  return {
    id: unit.id,
    buildingId: unit.buildingId,
    orgId: unit.orgId,
    unitNumber: unit.unitNumber,
    floor: unit.floor,
    type: unit.type,
    parkingKind: unit.parkingKind ?? null,
    linkedFlatId: unit.linkedFlatId ?? null,
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
    listed,
    tenantName,
    moveInDate,
  };
}
