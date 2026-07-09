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

import { PrismaClient, LeaseStatus } from "@prisma/client";
import * as inventoryRepo from "../repositories/inventoryRepository";
import * as leaseRepo from "../repositories/leaseRepository";
import { mapRentRoll, RentRollRow } from "./rentRollMapper";
import { createUnit, updateUnit } from "./inventory";
import { createOrGetTenant } from "./tenants";
import { linkTenantToUnit } from "./occupancies";
import { createLease } from "./leases";
import { writeAuditLog } from "./auditLog";
import { activateLeaseWorkflow } from "../workflows/activateLeaseWorkflow";

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
  /** Existing unit this object matches (by number, or floor+rent) — merged, not duplicated. Null = will be created. */
  matchedUnitNumber: string | null;
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
    /** Objects that match an existing unit (by number or floor+rent) and will be merged. */
    matchedExistingUnits: number;
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

/** Normalize a floor label so "rez-de-chaussée" / "Rez de Chaussée" / "RdC" → "0", "1er étage" / "1er" → "1", etc. */
export function normalizeFloor(floor: string | null | undefined): string {
  if (!floor) return "";
  const n = floor.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();
  if (/rez|rdc|parterre|ground|erdgeschoss|planpied/.test(n)) return "0";
  const m = n.match(/-?\d+/);
  return m ? String(parseInt(m[0], 10)) : n.replace(/[^a-z0-9]/g, "");
}

/**
 * A match key for pairing a rent-roll object with an existing unit that uses a
 * different numbering: unit type + normalized floor + net rent. Empty when the
 * floor or rent is missing (then only an exact unit-number match applies).
 */
export function unitMatchKey(unitType: string, floor: string | null | undefined, netRentChf: number | null): string {
  const f = normalizeFloor(floor);
  if (!f || netRentChf == null) return "";
  return `${unitType}|${f}|${netRentChf}`;
}

interface ExistingUnitRef { id: string; unitNumber: string; }
interface ExistingLookup {
  byNumber: Map<string, ExistingUnitRef>;
  byKey: Map<string, ExistingUnitRef | null>; // null = ambiguous (2+ units share the key)
}

function buildExistingLookup(
  units: { id: string; unitNumber: string; type: string; floor: string | null; monthlyRentChf: number | null }[],
): ExistingLookup {
  const byNumber = new Map<string, ExistingUnitRef>();
  const byKey = new Map<string, ExistingUnitRef | null>();
  for (const u of units) {
    const ref = { id: u.id, unitNumber: u.unitNumber };
    byNumber.set(u.unitNumber, ref);
    const key = unitMatchKey(u.type, u.floor, u.monthlyRentChf);
    if (key) byKey.set(key, byKey.has(key) ? null : ref); // second hit → ambiguous
  }
  return { byNumber, byKey };
}

/** Find the existing unit a rent-roll object maps to: exact number first, then floor+rent. */
function matchExistingUnit(r: RentRollRow, lookup: ExistingLookup): ExistingUnitRef | null {
  const byNum = lookup.byNumber.get(r.unitNumber);
  if (byNum) return byNum;
  const key = unitMatchKey(r.unitType, r.floor, r.netRentChf);
  return key ? lookup.byKey.get(key) ?? null : null;
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

  // Match against existing ACTIVE units so onboarding merges (by number, or
  // floor+rent) instead of duplicating a building that's already partly set up.
  const existingUnits = await inventoryRepo.listUnits(prisma, orgId, buildingId, false);
  const lookup = buildExistingLookup(existingUnits);
  let matchedCount = 0;

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
    const matched = matchExistingUnit(r, lookup);
    if (matched) matchedCount += 1;
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
      matchedUnitNumber: matched ? matched.unitNumber : null,
    };
  });

  if (matchedCount > 0) {
    warnings.push(`${matchedCount} object(s) match an existing unit (by number or floor + rent) — those will be merged, not duplicated.`);
  }

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
      matchedExistingUnits: matchedCount,
    },
    units,
    warnings,
  };
}

/* ── Commit ───────────────────────────────────────────────────────────────── */

export type OnboardingBillingMode = "activate" | "snapshot";

export interface OnboardingCommitResult {
  buildingId: string;
  billingMode: OnboardingBillingMode;
  created: { units: number; tenants: number; leases: number; activated: number };
  /** Objects whose unit already existed and were skipped (merge — no duplicates). */
  skippedExistingUnits: number;
  errors: string[];
}

const errMsg = (e: unknown): string => (e instanceof Error ? e.message : String(e));

/**
 * Deterministic non-dialable placeholder phone for an imported tenant (the rent
 * roll carries no phone, but Tenant.phone is required + unique). Same building +
 * name → same phone, so a tenant occupying several objects dedups to one record.
 * Flag/edit later. `+41` + 9 digits satisfies E.164 normalization.
 */
export function synthTenantPhone(buildingId: string, name: string): string {
  const key = `${buildingId}|${name}`;
  let h = 0;
  for (let i = 0; i < key.length; i += 1) h = (Math.imul(h, 31) + key.charCodeAt(i)) >>> 0;
  return `+41${String(h % 1_000_000_000).padStart(9, "0")}`;
}

/** Apply the rich unit fields from a rent-roll row (skips invalid values). */
async function applyUnitFields(orgId: string, unitId: string, r: RentRollRow): Promise<void> {
  const data: Record<string, number> = {};
  if (r.areaSqm != null && r.areaSqm >= 5) data.livingAreaSqm = r.areaSqm; // schema min 5
  if (r.rooms != null && r.rooms >= 0.5) data.rooms = r.rooms;
  if (r.netRentChf != null) data.monthlyRentChf = r.netRentChf;
  if (r.chargesChf != null) data.monthlyChargesChf = r.chargesChf;
  if (Object.keys(data).length > 0) await updateUnit(orgId, unitId, data);
}

/**
 * Create Units + Tenants + Leases for an empty building from a rent roll.
 * billingMode "activate" → leases become ACTIVE and start recurring billing
 * (apartment leases activated before their garages so the parking rent co-bills
 * on the flat's invoice); "snapshot" → leases stay DRAFT (records only).
 * Best-effort: per-object failures are collected, not fatal.
 */
export async function commitOnboarding(
  prisma: PrismaClient,
  orgId: string,
  buildingId: string,
  csvText: string,
  opts: { billingMode: OnboardingBillingMode; actorUserId?: string },
): Promise<OnboardingCommitResult> {
  const building = await inventoryRepo.findBuildingByIdAndOrg(prisma, buildingId, orgId);
  if (!building) throw new OnboardingError("BUILDING_NOT_FOUND", "Building not found");

  const { rows } = mapRentRoll(csvText);
  if (rows.length === 0) throw new OnboardingError("EMPTY_RENT_ROLL", "No rent-roll rows found in the CSV");

  // Merge, don't block: an object matching an existing ACTIVE unit (by number,
  // or floor + rent) is reused, not duplicated. Only missing units are created.
  const existing = await inventoryRepo.listUnits(prisma, orgId, buildingId, false);
  const lookup = buildExistingLookup(existing);

  const links = resolveGarageLinks(rows);
  const errors: string[] = [];
  const unitIdByObjet = new Map<string, string>();
  let unitsCreated = 0;
  let skippedExistingUnits = 0;
  const apartments = rows.filter((r) => r.unitType === "RESIDENTIAL");
  const garages = rows.filter((r) => r.unitType === "PARKING");

  // Pass 1 — apartments (must exist before garages can link to them).
  for (const r of apartments) {
    const match = matchExistingUnit(r, lookup);
    if (match) { unitIdByObjet.set(r.objet, match.id); skippedExistingUnits += 1; continue; }
    try {
      const unit = await createUnit(orgId, buildingId, { unitNumber: r.unitNumber, type: "RESIDENTIAL", floor: r.floor ?? undefined });
      unitIdByObjet.set(r.objet, unit.id);
      await applyUnitFields(orgId, unit.id, r);
      unitsCreated += 1;
    } catch (e) {
      errors.push(`Unit ${r.objet}: ${errMsg(e)}`);
    }
  }

  // Pass 2 — garages, linked to their apartment.
  for (const r of garages) {
    const match = matchExistingUnit(r, lookup);
    if (match) { unitIdByObjet.set(r.objet, match.id); skippedExistingUnits += 1; continue; }
    try {
      const linkedObjet = links.get(r.objet) ?? null;
      const linkedFlatId = linkedObjet ? unitIdByObjet.get(linkedObjet) : undefined;
      const unit = await createUnit(orgId, buildingId, {
        unitNumber: r.unitNumber, type: "PARKING", parkingKind: "GARAGE", floor: r.floor ?? undefined, linkedFlatId,
      });
      unitIdByObjet.set(r.objet, unit.id);
      await applyUnitFields(orgId, unit.id, r);
      unitsCreated += 1;
    } catch (e) {
      errors.push(`Garage ${r.objet}: ${errMsg(e)}`);
    }
  }

  // Pass 3 — tenants (+ occupancy) and DRAFT leases, only where missing.
  const tenantNames = new Set<string>();
  let leaseCount = 0;
  const leasesToActivate: { leaseId: string; isApartment: boolean }[] = [];
  for (const r of [...apartments, ...garages]) {
    const unitId = unitIdByObjet.get(r.objet);
    if (!unitId) continue; // unit creation failed above
    if (r.isVacant || !r.tenantName) {
      if (r.isVacant && !matchExistingUnit(r, lookup)) await inventoryRepo.setUnitVacantByOrg(prisma, unitId, orgId).catch(() => {});
      continue;
    }
    const phone = synthTenantPhone(buildingId, r.tenantName);
    try {
      const tenant = await createOrGetTenant({ orgId, phone, name: r.tenantName });
      await linkTenantToUnit(orgId, tenant.id, unitId); // idempotent occupancy upsert
      tenantNames.add(r.tenantName);
    } catch (e) {
      errors.push(`Tenant ${r.tenantName} (${r.objet}): ${errMsg(e)}`);
    }
    if (willCreateLease(r)) {
      // Skip when a live lease already exists on the unit (incl. DRAFT) — merge, no duplicate.
      const existingLease = await leaseRepo.findAnyLiveLeaseForUnit(prisma, unitId);
      if (existingLease) continue;
      try {
        const startDate = (r.startDate ?? new Date()).toISOString();
        const lease = await createLease(orgId, {
          unitId,
          tenantName: r.tenantName,
          tenantPhone: phone,
          startDate,
          netRentChf: r.netRentChf!,
          ...(r.chargesChf != null ? { chargesTotalChf: r.chargesChf } : {}),
        });
        leaseCount += 1;
        leasesToActivate.push({ leaseId: lease.id, isApartment: r.unitType === "RESIDENTIAL" });
      } catch (e) {
        errors.push(`Lease ${r.objet}: ${errMsg(e)}`);
      }
    }
  }

  // Pass 4 — activation (apartments first, so garage rent co-bills on the flat).
  let activated = 0;
  if (opts.billingMode === "activate") {
    const ordered = [
      ...leasesToActivate.filter((l) => l.isApartment),
      ...leasesToActivate.filter((l) => !l.isApartment),
    ];
    for (const l of ordered) {
      try {
        // Imported leases skip the signature flow — set SIGNED, then activate
        // through the workflow so LEASE_STATUS_CHANGED fires (creates the
        // schedule + first invoice, anchored to the current period).
        await leaseRepo.updateLeaseRaw(prisma, l.leaseId, { status: LeaseStatus.SIGNED });
        await activateLeaseWorkflow({ orgId, prisma, actorUserId: opts.actorUserId }, { leaseId: l.leaseId });
        activated += 1;
      } catch (e) {
        errors.push(`Activate lease ${l.leaseId}: ${errMsg(e)}`);
      }
    }
  }

  await writeAuditLog(prisma, {
    action: "BUILDING_ONBOARDED",
    orgId,
    actorUserId: opts.actorUserId,
    entityType: "Building",
    entityId: buildingId,
    metadata: { billingMode: opts.billingMode, unitsCreated, skippedExistingUnits, tenants: tenantNames.size, leases: leaseCount, activated },
  });

  return {
    buildingId,
    billingMode: opts.billingMode,
    created: { units: unitsCreated, tenants: tenantNames.size, leases: leaseCount, activated },
    skippedExistingUnits,
    errors,
  };
}
