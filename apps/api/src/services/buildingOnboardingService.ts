/**
 * Building onboarding from a régie rent roll.
 *
 * Phase 2: turns a parsed rent roll into a **preview** of the Units / Tenants /
 * Leases that would be created for an (empty) building — no writes. The commit
 * path (create + optional billing activation) lands in a follow-up.
 *
 * Stateless: the preview is derived from the uploaded CSV; commit re-parses the
 * same file. Reuses `rentRollMapper` + the inventory repository.
 */

import { PrismaClient } from "@prisma/client";
import * as inventoryRepo from "../repositories/inventoryRepository";
import { mapRentRoll, RentRollRow } from "./rentRollMapper";

export class OnboardingError extends Error {
  code: string;
  constructor(code: string, message: string) {
    super(message);
    this.code = code;
    this.name = "OnboardingError";
  }
}

export interface OnboardingUnitPreview {
  objet: string;
  unitNumber: string;
  unitType: "RESIDENTIAL" | "PARKING";
  parkingKind: "GARAGE" | null;
  floor: string | null;
  rooms: number | null;
  areaSqm: number | null;
  tenantName: string | null;
  isVacant: boolean;
  startDate: string | null; // ISO
  endDate: string | null;
  netRentChf: number | null;
  chargesChf: number | null;
  /** For garages: the apartment objet whose tenant matches (co-billing pairing). */
  linkedApartmentObjet: string | null;
  /** True when a lease will be created (occupied + has rent). */
  willCreateLease: boolean;
}

export interface OnboardingPreviewDTO {
  buildingId: string;
  buildingName: string;
  summary: {
    totalObjects: number;
    apartments: number;
    garages: number;
    vacant: number;
    tenants: number;
    leases: number;
    annualNetRentChf: number;
  };
  units: OnboardingUnitPreview[];
  warnings: string[];
}

/**
 * Pair each parking object with the apartment held by the same tenant (the
 * régie rent roll lists a tenant's apartment and garage under one name; the
 * parking rent co-bills on the flat's invoice). Returns objet → apartment objet.
 */
export function resolveGarageLinks(rows: RentRollRow[]): Map<string, string | null> {
  const apartmentByTenant = new Map<string, string>();
  for (const r of rows) {
    if (r.unitType === "RESIDENTIAL" && r.tenantName && !apartmentByTenant.has(r.tenantName)) {
      apartmentByTenant.set(r.tenantName, r.objet);
    }
  }
  const links = new Map<string, string | null>();
  for (const r of rows) {
    if (r.unitType === "PARKING") {
      links.set(r.objet, r.tenantName ? apartmentByTenant.get(r.tenantName) ?? null : null);
    }
  }
  return links;
}

/** True when an occupied object carries rent, i.e. a lease should be created. */
export function willCreateLease(r: RentRollRow): boolean {
  return !r.isVacant && !!r.tenantName && (r.netRentChf ?? 0) > 0;
}

export async function previewOnboarding(
  prisma: PrismaClient,
  orgId: string,
  buildingId: string,
  csvText: string,
): Promise<OnboardingPreviewDTO> {
  const building = await inventoryRepo.findBuildingByIdAndOrg(prisma, buildingId, orgId);
  if (!building) throw new OnboardingError("BUILDING_NOT_FOUND", "Building not found");

  const { rows, skipped } = mapRentRoll(csvText);
  if (rows.length === 0) {
    throw new OnboardingError("EMPTY_RENT_ROLL", skipped[0] ?? "No rent-roll rows found in the CSV");
  }

  const links = resolveGarageLinks(rows);
  const warnings = [...skipped];

  const existingUnits = await inventoryRepo.countTotalUnitsByBuilding(prisma, orgId, buildingId);
  if (existingUnits > 0) {
    warnings.push(
      `Building already has ${existingUnits} unit(s). Onboarding is intended for an empty building — importing may create duplicates.`,
    );
  }

  // Duplicate objet codes in the file.
  const seen = new Set<string>();
  for (const r of rows) {
    if (seen.has(r.objet)) warnings.push(`Duplicate object code "${r.objet}" — only the first will be used.`);
    seen.add(r.objet);
  }

  const units: OnboardingUnitPreview[] = rows.map((r) => {
    const linkedApartmentObjet = r.unitType === "PARKING" ? links.get(r.objet) ?? null : null;
    if (r.unitType === "PARKING" && !r.isVacant && !linkedApartmentObjet) {
      warnings.push(`Garage ${r.objet} (${r.tenantName}) has no matching apartment tenant — it will be created standalone.`);
    }
    if (!r.isVacant && (r.netRentChf ?? 0) <= 0) {
      warnings.push(`Object ${r.objet} (${r.tenantName}) is occupied but has no rent — no lease will be created.`);
    }
    return {
      objet: r.objet,
      unitNumber: r.unitNumber,
      unitType: r.unitType,
      parkingKind: r.parkingKind,
      floor: r.floor,
      rooms: r.rooms,
      areaSqm: r.areaSqm,
      tenantName: r.tenantName,
      isVacant: r.isVacant,
      startDate: r.startDate ? r.startDate.toISOString() : null,
      endDate: r.endDate ? r.endDate.toISOString() : null,
      netRentChf: r.netRentChf,
      chargesChf: r.chargesChf,
      linkedApartmentObjet,
      willCreateLease: willCreateLease(r),
    };
  });

  const distinctTenants = new Set(rows.filter((r) => r.tenantName).map((r) => r.tenantName!));
  const annualNetRentChf = rows.reduce((sum, r) => sum + (willCreateLease(r) ? (r.netRentChf ?? 0) * 12 : 0), 0);

  return {
    buildingId,
    buildingName: building.name,
    summary: {
      totalObjects: rows.length,
      apartments: rows.filter((r) => r.unitType === "RESIDENTIAL").length,
      garages: rows.filter((r) => r.unitType === "PARKING").length,
      vacant: rows.filter((r) => r.isVacant).length,
      tenants: distinctTenants.size,
      leases: rows.filter(willCreateLease).length,
      annualNetRentChf,
    },
    units,
    warnings,
  };
}
