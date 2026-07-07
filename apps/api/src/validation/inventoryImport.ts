/**
 * Validation + coercion for the bulk CSV import of buildings & units.
 *
 * CSV cells arrive as strings; we coerce them to the types the create/update
 * services expect, then validate ranges/enums with zod (reusing the same
 * constraints as validation/buildings.ts and validation/units.ts).
 *
 * Money conventions (see SCHEMA_REFERENCE):
 *   - Building valuations are Float CHF.
 *   - Unit monthlyRentChf / monthlyChargesChf are Int *whole* CHF (not cents).
 */

import { z } from "zod";
import {
  UnitType,
  LocationSegment,
  InsulationQuality,
  EnergyLabel,
  HeatingType,
  ParkingKind,
} from "@prisma/client";
import { parseChf } from "../utils/csvParser";

const currentYear = new Date().getFullYear();

/* ── cell coercion helpers ────────────────────────────────────────────────── */

function str(v: string | undefined): string | undefined {
  const t = (v ?? "").trim();
  return t === "" ? undefined : t;
}
function num(v: string | undefined): number | undefined {
  const n = parseChf(v);
  return n == null ? undefined : n;
}
function int(v: string | undefined): number | undefined {
  const n = parseChf(v);
  return n == null ? undefined : Math.round(n);
}
function bool(v: string | undefined): boolean | undefined {
  const t = (v ?? "").trim().toLowerCase();
  if (t === "") return undefined;
  if (["true", "1", "yes", "y", "oui", "vrai", "x"].includes(t)) return true;
  if (["false", "0", "no", "n", "non", "faux"].includes(t)) return false;
  return undefined; // let zod flag genuinely bad values as absent
}
function enumVal(v: string | undefined): string | undefined {
  const t = (v ?? "").trim().toUpperCase();
  return t === "" ? undefined : t;
}

/* ── Building ─────────────────────────────────────────────────────────────── */

export const BUILDING_COLUMNS = [
  "name",
  "address",
  "yearBuilt",
  "hasElevator",
  "hasConcierge",
  "parcelNumber",
  "easementsText",
  "ecaVolumeM3",
  "netAreaSqm",
  "weightedAreaSqm",
  "lotsApartments",
  "lotsGarages",
  "lotsExteriorParking",
  "fiscalValueChf",
  "insuranceValueChf",
  "ppeEstimateChf",
] as const;

export const BuildingImportSchema = z.object({
  name: z.string().min(1, "name is required"),
  address: z.string().optional(),
  yearBuilt: z.number().int().min(1800).max(currentYear + 1).optional(),
  hasElevator: z.boolean().optional(),
  hasConcierge: z.boolean().optional(),
  parcelNumber: z.string().optional(),
  easementsText: z.string().optional(),
  ecaVolumeM3: z.number().nonnegative().optional(),
  netAreaSqm: z.number().nonnegative().optional(),
  weightedAreaSqm: z.number().nonnegative().optional(),
  lotsApartments: z.number().int().min(0).optional(),
  lotsGarages: z.number().int().min(0).optional(),
  lotsExteriorParking: z.number().int().min(0).optional(),
  fiscalValueChf: z.number().nonnegative().optional(),
  insuranceValueChf: z.number().nonnegative().optional(),
  ppeEstimateChf: z.number().nonnegative().optional(),
});
export type BuildingImportInput = z.infer<typeof BuildingImportSchema>;

function coerceBuildingRow(raw: Record<string, string>): Record<string, unknown> {
  return {
    name: str(raw.name),
    address: str(raw.address),
    yearBuilt: int(raw.yearBuilt),
    hasElevator: bool(raw.hasElevator),
    hasConcierge: bool(raw.hasConcierge),
    parcelNumber: str(raw.parcelNumber),
    easementsText: str(raw.easementsText),
    ecaVolumeM3: num(raw.ecaVolumeM3),
    netAreaSqm: num(raw.netAreaSqm),
    weightedAreaSqm: num(raw.weightedAreaSqm),
    lotsApartments: int(raw.lotsApartments),
    lotsGarages: int(raw.lotsGarages),
    lotsExteriorParking: int(raw.lotsExteriorParking),
    fiscalValueChf: num(raw.fiscalValueChf),
    insuranceValueChf: num(raw.insuranceValueChf),
    ppeEstimateChf: num(raw.ppeEstimateChf),
  };
}

/* ── Unit ─────────────────────────────────────────────────────────────────── */

export const UNIT_COLUMNS = [
  "buildingRef",
  "unitNumber",
  "floor",
  "type",
  "parkingKind",
  "livingAreaSqm",
  "rooms",
  "hasBalcony",
  "hasTerrace",
  "hasParking",
  "locationSegment",
  "lastRenovationYear",
  "insulationQuality",
  "energyLabel",
  "heatingType",
  "monthlyRentChf",
  "monthlyChargesChf",
  "intrinsicPricePerSqmChf",
  "vetustePct",
  "gardenAreaSqm",
  "gardenWeightPct",
  "extParkingValueChf",
  "garageValueChf",
  "isListedPublicly",
] as const;

export const UnitImportSchema = z.object({
  buildingRef: z.string().min(1, "buildingRef is required (building id, name, or address)"),
  unitNumber: z.string().min(1, "unitNumber is required"),
  floor: z.string().optional(),
  type: z.nativeEnum(UnitType).optional(),
  parkingKind: z.nativeEnum(ParkingKind).optional(),
  livingAreaSqm: z.number().min(5).max(1000).optional(),
  rooms: z.number().min(0.5).max(20).optional(),
  hasBalcony: z.boolean().optional(),
  hasTerrace: z.boolean().optional(),
  hasParking: z.boolean().optional(),
  locationSegment: z.nativeEnum(LocationSegment).optional(),
  lastRenovationYear: z.number().int().min(1800).max(currentYear + 1).optional(),
  insulationQuality: z.nativeEnum(InsulationQuality).optional(),
  energyLabel: z.nativeEnum(EnergyLabel).optional(),
  heatingType: z.nativeEnum(HeatingType).optional(),
  monthlyRentChf: z.number().int().min(0).max(100000).optional(),
  monthlyChargesChf: z.number().int().min(0).max(50000).optional(),
  intrinsicPricePerSqmChf: z.number().nonnegative().optional(),
  vetustePct: z.number().min(0).max(100).optional(),
  gardenAreaSqm: z.number().nonnegative().optional(),
  gardenWeightPct: z.number().min(0).max(100).optional(),
  extParkingValueChf: z.number().nonnegative().optional(),
  garageValueChf: z.number().nonnegative().optional(),
  isListedPublicly: z.boolean().optional(),
});
export type UnitImportInput = z.infer<typeof UnitImportSchema>;

function coerceUnitRow(raw: Record<string, string>): Record<string, unknown> {
  return {
    buildingRef: str(raw.buildingRef),
    unitNumber: str(raw.unitNumber),
    floor: str(raw.floor),
    type: enumVal(raw.type),
    parkingKind: enumVal(raw.parkingKind),
    livingAreaSqm: num(raw.livingAreaSqm),
    rooms: num(raw.rooms),
    hasBalcony: bool(raw.hasBalcony),
    hasTerrace: bool(raw.hasTerrace),
    hasParking: bool(raw.hasParking),
    locationSegment: enumVal(raw.locationSegment),
    lastRenovationYear: int(raw.lastRenovationYear),
    insulationQuality: enumVal(raw.insulationQuality),
    energyLabel: enumVal(raw.energyLabel),
    heatingType: enumVal(raw.heatingType),
    monthlyRentChf: int(raw.monthlyRentChf),
    monthlyChargesChf: int(raw.monthlyChargesChf),
    intrinsicPricePerSqmChf: num(raw.intrinsicPricePerSqmChf),
    vetustePct: num(raw.vetustePct),
    gardenAreaSqm: num(raw.gardenAreaSqm),
    gardenWeightPct: num(raw.gardenWeightPct),
    extParkingValueChf: num(raw.extParkingValueChf),
    garageValueChf: num(raw.garageValueChf),
    isListedPublicly: bool(raw.isListedPublicly),
  };
}

/* ── unified parse+validate ───────────────────────────────────────────────── */

export type ImportEntity = "BUILDING" | "UNIT";

export interface RowParseResult {
  ok: boolean;
  data?: BuildingImportInput | UnitImportInput;
  error?: string;
}

/** Coerce + validate a single raw CSV row for the given entity type. */
export function validateRow(entity: ImportEntity, raw: Record<string, string>): RowParseResult {
  const coerced = entity === "BUILDING" ? coerceBuildingRow(raw) : coerceUnitRow(raw);
  const schema = entity === "BUILDING" ? BuildingImportSchema : UnitImportSchema;
  const result = schema.safeParse(coerced);
  if (!result.success) {
    const msg = result.error.issues
      .map((i) => `${i.path.join(".") || "row"}: ${i.message}`)
      .join("; ");
    return { ok: false, error: msg };
  }
  return { ok: true, data: result.data };
}

/** Is this row entirely blank (all supported columns empty)? */
export function isBlankRow(entity: ImportEntity, raw: Record<string, string>): boolean {
  const cols = entity === "BUILDING" ? BUILDING_COLUMNS : UNIT_COLUMNS;
  return cols.every((c) => (raw[c] ?? "").trim() === "");
}
