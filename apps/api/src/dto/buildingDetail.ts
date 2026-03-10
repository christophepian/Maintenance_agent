/**
 * Building Detail DTO
 *
 * Maps the deep-included Building (with owners→user, units.occupancies.tenant,
 * units.leases) into a flat, frontend-friendly shape.
 *
 * Tenant merge logic:
 *   - Occupancy + Lease → source "BOTH"
 *   - Lease only        → source "LEASE"
 *   - Occupancy only    → source "DIRECTORY"
 * Deduplicate by tenantPhone (since Lease has no FK to Tenant).
 */

// ─── DTO interfaces ────────────────────────────────────────────

export interface OwnerDTO {
  id: string;
  name: string;
  email: string | null;
}

export interface BuildingTenantDTO {
  /** Tenant.id when from occupancy; synthesized key when lease-only */
  tenantId: string;
  name: string;
  phone: string;
  email: string | null;
  unitNumber: string;
  unitId: string;
  moveInDate: string | null;   // ISO date from lease.startDate
  source: "BOTH" | "LEASE" | "DIRECTORY";
}

export interface BuildingDetailDTO {
  id: string;
  orgId: string;
  name: string;
  address: string;
  yearBuilt: number | null;
  hasElevator: boolean;
  hasConcierge: boolean;
  managedSince: string | null; // ISO datetime
  canton: string | null;
  createdAt: string;
  updatedAt: string;
  isActive: boolean;
  owners: OwnerDTO[];
  tenants: BuildingTenantDTO[];
}

// ─── Type for Prisma deep query result ─────────────────────────

type DeepBuilding = {
  id: string;
  orgId: string;
  name: string;
  address: string;
  yearBuilt: number | null;
  hasElevator: boolean;
  hasConcierge: boolean;
  managedSince: Date | null;
  canton: string | null;
  createdAt: Date;
  updatedAt: Date;
  isActive: boolean;
  owners: {
    user: { id: string; name: string; email: string | null };
  }[];
  units: {
    id: string;
    unitNumber: string;
    occupancies: {
      tenant: { id: string; name: string | null; phone: string; email: string | null };
    }[];
    leases: {
      id: string;
      tenantName: string;
      tenantPhone: string | null;
      tenantEmail: string | null;
      startDate: Date;
      unitId: string;
    }[];
  }[];
};

// ─── Mapper ────────────────────────────────────────────────────

export function mapBuildingToDetailDTO(b: DeepBuilding): BuildingDetailDTO {
  // Owners — sourced from BuildingOwner junction
  const owners: OwnerDTO[] = b.owners.map((o) => ({
    id: o.user.id,
    name: o.user.name,
    email: o.user.email,
  }));

  // Tenant merge: deduplicate by (phone, unitId) pair
  const tenantMap = new Map<string, BuildingTenantDTO>();

  for (const unit of b.units) {
    // 1. Index occupancy tenants
    for (const occ of unit.occupancies) {
      const key = `${occ.tenant.phone}::${unit.id}`;
      tenantMap.set(key, {
        tenantId: occ.tenant.id,
        name: occ.tenant.name || "Unknown",
        phone: occ.tenant.phone,
        email: occ.tenant.email,
        unitNumber: unit.unitNumber,
        unitId: unit.id,
        moveInDate: null,    // will be patched if lease match found
        source: "DIRECTORY", // upgraded to BOTH if lease match found
      });
    }

    // 2. Merge leases
    for (const lease of unit.leases) {
      const phone = lease.tenantPhone || "";
      const key = `${phone}::${unit.id}`;
      const existing = tenantMap.get(key);
      if (existing) {
        // Occupancy already exists → upgrade to BOTH
        existing.source = "BOTH";
        existing.moveInDate = lease.startDate.toISOString();
        // Prefer lease name if occupancy name was "Unknown"
        if (existing.name === "Unknown" && lease.tenantName) {
          existing.name = lease.tenantName;
        }
        // Fill email from lease if missing
        if (!existing.email && lease.tenantEmail) {
          existing.email = lease.tenantEmail;
        }
      } else {
        // Lease-only tenant
        tenantMap.set(key, {
          tenantId: `lease:${lease.id}`,
          name: lease.tenantName,
          phone: phone,
          email: lease.tenantEmail,
          unitNumber: unit.unitNumber,
          unitId: unit.id,
          moveInDate: lease.startDate.toISOString(),
          source: "LEASE",
        });
      }
    }
  }

  return {
    id: b.id,
    orgId: b.orgId,
    name: b.name,
    address: b.address,
    yearBuilt: b.yearBuilt,
    hasElevator: b.hasElevator,
    hasConcierge: b.hasConcierge,
    managedSince: b.managedSince ? b.managedSince.toISOString() : null,
    canton: b.canton,
    createdAt: b.createdAt.toISOString(),
    updatedAt: b.updatedAt.toISOString(),
    isActive: b.isActive,
    owners,
    tenants: Array.from(tenantMap.values()),
  };
}
