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
    /** Objects that match no existing unit and would be created as NEW units. */
    newUnits: number;
  };
  /** True when the building already has ≥1 active unit — a commit that creates
   *  new units then needs explicit confirmation (see `commitOnboarding` gate). */
  buildingAlreadyPopulated: boolean;
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
 *
 * NOTE: rent is NOT stable across fiscal years (it changes with indexation /
 * turnover), so this key only merges when re-importing the *same* year. For a
 * different year, prefer `unitStableKey`. Kept as a secondary signal for units
 * that carry no rooms/area (e.g. a rent roll with only floor + rent columns).
 */
export function unitMatchKey(unitType: string, floor: string | null | undefined, netRentChf: number | null): string {
  const f = normalizeFloor(floor);
  if (!f || netRentChf == null) return "";
  return `${unitType}|${f}|${netRentChf}`;
}

/**
 * A rent-INDEPENDENT match key: unit type + normalized floor + rooms. The
 * physical identity of a flat (which floor, how many rooms) is stable across
 * fiscal years and across report formats, whereas its rent — and, in practice,
 * even its reported m² (gross vs net/weighted surface differs between a régie's
 * documents) — are NOT. So this is what lets a 2023 report merge into the unit a
 * 2025 report created instead of duplicating it. Area is deliberately excluded:
 * two reads of the same flat routinely disagree on m² by >10% (verified on real
 * data: RdC 110 m² vs 0001 96 m² for the same flat). Empty when too sparse to
 * identify confidently (needs floor + rooms), then matching falls back to
 * rent/number, and finally the populated-building gate catches anything unmatched.
 */
export function unitStableKey(
  unitType: string,
  floor: string | null | undefined,
  rooms: number | null | undefined,
  area?: number | null | undefined, // accepted for call-site symmetry; not part of the key
): string {
  void area;
  const f = normalizeFloor(floor);
  const r = rooms != null && Number.isFinite(rooms) ? String(rooms) : "";
  if (!f || !r) return "";
  return `${unitType}|${f}|${r}`;
}

interface ExistingUnitRef { id: string; unitNumber: string; isActive: boolean; }
interface ExistingLookup {
  byNumber: Map<string, ExistingUnitRef>;         // all units (incl. deactivated) — numbers stay unique
  byStableKey: Map<string, ExistingUnitRef | null>; // ACTIVE units only, rent-independent; null = ambiguous
  byKey: Map<string, ExistingUnitRef | null>;     // ACTIVE units only, floor+rent; null = ambiguous
  activeCount: number;                            // populated-building gate
}

interface ExistingUnitRow {
  id: string;
  unitNumber: string;
  type: string;
  floor: string | null;
  monthlyRentChf: number | null;
  rooms?: number | null;
  livingAreaSqm?: number | null;
  isActive?: boolean;
}

function buildExistingLookup(units: ExistingUnitRow[]): ExistingLookup {
  const byNumber = new Map<string, ExistingUnitRef>();
  const byStableKey = new Map<string, ExistingUnitRef | null>();
  const byKey = new Map<string, ExistingUnitRef | null>();
  let activeCount = 0;
  for (const u of units) {
    const isActive = u.isActive !== false;
    const ref = { id: u.id, unitNumber: u.unitNumber, isActive };
    byNumber.set(u.unitNumber, ref); // numbers are unique per building regardless of active
    if (isActive) {
      activeCount += 1;
      const sKey = unitStableKey(u.type, u.floor, u.rooms, u.livingAreaSqm);
      if (sKey) byStableKey.set(sKey, byStableKey.has(sKey) ? null : ref); // second active hit → ambiguous
      const key = unitMatchKey(u.type, u.floor, u.monthlyRentChf);
      if (key) byKey.set(key, byKey.has(key) ? null : ref);
    }
  }
  return { byNumber, byStableKey, byKey, activeCount };
}

/**
 * Find the existing unit a rent-roll object maps to. Tries, in order of
 * reliability: the rent-independent stable key (floor+rooms+area — bridges two
 * fiscal years), then floor+rent (same-year re-import), then an exact number
 * match against ANY unit (incl. deactivated — their number stays reserved).
 * A key that resolved to `null` (ambiguous — two active units share it) is
 * skipped so we never merge into the wrong unit.
 */
function matchExistingUnit(r: RentRollRow, lookup: ExistingLookup): ExistingUnitRef | null {
  const sKey = unitStableKey(r.unitType, r.floor, r.rooms, r.areaSqm);
  const byStable = sKey ? lookup.byStableKey.get(sKey) : undefined;
  if (byStable) return byStable;
  const key = unitMatchKey(r.unitType, r.floor, r.netRentChf);
  const byKey = key ? lookup.byKey.get(key) : undefined;
  if (byKey) return byKey;
  return lookup.byNumber.get(r.unitNumber) ?? null;
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

  // Match against existing units (incl. deactivated — their number is still
  // reserved) so onboarding merges instead of duplicating a partly-set-up building.
  const existingUnits = await inventoryRepo.listUnits(prisma, orgId, buildingId, true);
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

  const newUnits = rows.length - matchedCount;
  const buildingAlreadyPopulated = lookup.activeCount > 0;
  if (matchedCount > 0) {
    warnings.push(`${matchedCount} object(s) match an existing unit (by floor + rooms + area, or number) — those will be merged, not duplicated.`);
  }
  if (buildingAlreadyPopulated && newUnits > 0) {
    warnings.push(`${newUnits} object(s) match no existing unit — importing into an already-populated building will only create them if you confirm new units at commit.`);
  }

  const distinctTenants = new Set(rows.filter((r) => r.tenantName).map((r) => normalizeTenantName(r.tenantName!)));
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
      newUnits,
    },
    buildingAlreadyPopulated,
    units,
    warnings,
  };
}

/**
 * Lightweight assessment of what a rent roll would do to a building's inventory,
 * without producing the full preview. Used by the package analyze step to decide
 * whether to surface a "confirm new units" gate. Read-only.
 */
export async function assessRentRollHydration(
  prisma: PrismaClient,
  orgId: string,
  buildingId: string,
  csvText: string,
): Promise<{ buildingAlreadyPopulated: boolean; matchedUnits: number; newUnits: number }> {
  const existing = await inventoryRepo.listUnits(prisma, orgId, buildingId, true);
  const lookup = buildExistingLookup(existing);
  const { rows } = mapRentRoll(csvText);
  let matched = 0;
  for (const r of rows) if (matchExistingUnit(r, lookup)) matched += 1;
  return {
    buildingAlreadyPopulated: lookup.activeCount > 0,
    matchedUnits: matched,
    newUnits: rows.length - matched,
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
  /** Objects with no existing match that were NOT created because the building is
   *  already populated and new-unit creation wasn't confirmed (the duplication
   *  guard). Re-run with `allowNewUnits` to create them. */
  skippedNewUnits: number;
  errors: string[];
}

const errMsg = (e: unknown): string => (e instanceof Error ? e.message : String(e));

/**
 * Canonicalize a tenant name so formatting variance between two extractions of
 * the same document (accents, civilité titles, punctuation, case, spacing,
 * token order) collapses to one identity. This is a FORMATTING normalizer, not
 * a fuzzy/partial matcher — "JACCARD Jacques-Henri" and "Jaccard, jacques henri"
 * collapse, but two genuinely different names never do. Used as the dedup key so
 * re-importing the same tenant across report layouts doesn't triple the record.
 */
export function normalizeTenantName(name: string): string {
  const cleaned = name
    .normalize("NFD").replace(/[̀-ͯ]/g, "") // strip accents
    .toUpperCase()
    .replace(/\b(M|MR|MME|MLLE|MRS|MS|DR|PROF)\.?\b/g, " ") // drop civilité titles
    .replace(/[^A-Z0-9]+/g, " ") // punctuation/hyphens → space
    .trim();
  return cleaned.split(/\s+/).filter(Boolean).sort().join(" ");
}

/**
 * Deterministic non-dialable placeholder phone for an imported tenant (the rent
 * roll carries no phone, but Tenant.phone is required + unique). Same building +
 * normalized name → same phone, so a tenant occupying several objects — or
 * re-imported from another year's report with different name formatting — dedups
 * to one record. Flag/edit later. `+41` + 9 digits satisfies E.164 normalization.
 */
export function synthTenantPhone(buildingId: string, name: string): string {
  const key = `${buildingId}|${normalizeTenantName(name)}`;
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
  opts: { billingMode: OnboardingBillingMode; actorUserId?: string; allowNewUnits?: boolean },
): Promise<OnboardingCommitResult> {
  const building = await inventoryRepo.findBuildingByIdAndOrg(prisma, buildingId, orgId);
  if (!building) throw new OnboardingError("BUILDING_NOT_FOUND", "Building not found");

  const { rows } = mapRentRoll(csvText);
  if (rows.length === 0) throw new OnboardingError("EMPTY_RENT_ROLL", "No rent-roll rows found in the CSV");

  // Merge, don't block: an object matching an existing unit (by stable
  // floor+rooms+area, floor+rent on an active unit, or exact number incl. a
  // deactivated unit whose number is still reserved) is reused, not duplicated.
  // A matched deactivated unit is reactivated.
  const existing = await inventoryRepo.listUnits(prisma, orgId, buildingId, true);
  const lookup = buildExistingLookup(existing);

  // Duplication guard: into an ALREADY-POPULATED building, an object that matches
  // no existing unit is NOT auto-created unless the caller explicitly confirmed
  // new units. This is what stops a different year's / different-format report
  // from spawning parallel units. An empty building (first import) creates freely.
  const gateNewUnits = lookup.activeCount > 0 && !opts.allowNewUnits;

  const links = resolveGarageLinks(rows);
  const errors: string[] = [];
  const unitIdByObjet = new Map<string, string>();
  let unitsCreated = 0;
  let skippedExistingUnits = 0;
  let skippedNewUnits = 0;
  const apartments = rows.filter((r) => r.unitType === "RESIDENTIAL");
  const garages = rows.filter((r) => r.unitType === "PARKING");

  // Reactivate + backfill a matched deactivated unit so its reserved number is reused.
  const reviveIfInactive = async (match: ExistingUnitRef, r: RentRollRow) => {
    if (!match.isActive) {
      await inventoryRepo.reactivateUnit(prisma, match.id);
      await applyUnitFields(orgId, match.id, r);
    }
  };

  // Pass 1 — apartments (must exist before garages can link to them).
  for (const r of apartments) {
    const match = matchExistingUnit(r, lookup);
    if (match) {
      unitIdByObjet.set(r.objet, match.id);
      skippedExistingUnits += 1;
      try { await reviveIfInactive(match, r); } catch (e) { errors.push(`Unit ${r.objet}: ${errMsg(e)}`); }
      continue;
    }
    if (gateNewUnits) { skippedNewUnits += 1; continue; } // populated building, new unit not confirmed
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
    const linkedObjet = links.get(r.objet) ?? null;
    const linkedFlatId = linkedObjet ? unitIdByObjet.get(linkedObjet) : undefined;
    const match = matchExistingUnit(r, lookup);
    if (match) {
      unitIdByObjet.set(r.objet, match.id);
      skippedExistingUnits += 1;
      try {
        await reviveIfInactive(match, r);
        // Re-point the link to the (now current) apartment unit.
        if (linkedFlatId) await updateUnit(orgId, match.id, { linkedFlatId });
      } catch (e) {
        errors.push(`Garage ${r.objet}: ${errMsg(e)}`);
      }
      continue;
    }
    if (gateNewUnits) { skippedNewUnits += 1; continue; } // populated building, new garage not confirmed
    try {
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
      // Don't duplicate a live lease on the unit. But if one already exists and
      // isn't ACTIVE yet (e.g. a prior snapshot import left it DRAFT), still queue
      // it for activation so a re-run heals occupancy.
      const existingLease = await leaseRepo.findAnyLiveLeaseForUnit(prisma, unitId);
      if (existingLease) {
        if (existingLease.status !== LeaseStatus.ACTIVE) {
          leasesToActivate.push({ leaseId: existingLease.id, isApartment: r.unitType === "RESIDENTIAL" });
        }
        continue;
      }
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
  } else {
    // Snapshot: mark leases ACTIVE so the unit shows its tenant as occupied, but
    // create NO billing schedule — processRecurringBilling only bills existing
    // schedules, so these active-but-unscheduled leases never generate invoices.
    for (const l of leasesToActivate) {
      try {
        await leaseRepo.updateLeaseRaw(prisma, l.leaseId, { status: LeaseStatus.ACTIVE, activatedAt: new Date() });
      } catch (e) {
        errors.push(`Occupy lease ${l.leaseId}: ${errMsg(e)}`);
      }
    }
  }

  await writeAuditLog(prisma, {
    action: "BUILDING_ONBOARDED",
    orgId,
    actorUserId: opts.actorUserId,
    entityType: "Building",
    entityId: buildingId,
    metadata: { billingMode: opts.billingMode, unitsCreated, skippedExistingUnits, skippedNewUnits, tenants: tenantNames.size, leases: leaseCount, activated },
  });

  return {
    buildingId,
    billingMode: opts.billingMode,
    created: { units: unitsCreated, tenants: tenantNames.size, leases: leaseCount, activated },
    skippedExistingUnits,
    skippedNewUnits,
    errors,
  };
}
