/**
 * Valeur intrinsèque worksheet.
 *
 * Computes a unit's intrinsic value from its stored inputs:
 *   habitation     = livingAreaSqm × intrinsicPricePerSqmChf
 *   vétusté        = habitation × vetustePct%           (a deduction)
 *   jardin         = gardenAreaSqm × prix/m² × gardenWeightPct%   (default weight 10%)
 *   parking ext.   = extParkingValueChf                  (flat line)
 *   garage         = garageValueChf                      (flat line)
 *   ───────────────────────────────────────────────────────────────
 *   valeur intrinsèque = habitation − vétusté + jardin + parking + garage
 *
 * Frontend mirrors this in apps/web for live editing; keep the two in sync.
 */

export const DEFAULT_GARDEN_WEIGHT_PCT = 10;

export interface UnitValuationInputs {
  livingAreaSqm?: number | null;
  intrinsicPricePerSqmChf?: number | null;
  vetustePct?: number | null;
  gardenAreaSqm?: number | null;
  gardenWeightPct?: number | null;
  extParkingValueChf?: number | null;
  garageValueChf?: number | null;
}

export interface UnitValuationBreakdown {
  habitationChf: number;
  vetusteChf: number; // positive number; subtracted from the total
  gardenChf: number;
  extParkingChf: number;
  garageChf: number;
  intrinsicValueChf: number;
}

export function computeUnitIntrinsicValue(unit: UnitValuationInputs): UnitValuationBreakdown {
  const pricePerSqm = unit.intrinsicPricePerSqmChf ?? 0;
  const habitationChf = (unit.livingAreaSqm ?? 0) * pricePerSqm;
  const vetusteChf = habitationChf * ((unit.vetustePct ?? 0) / 100);
  const gardenWeight = (unit.gardenWeightPct ?? DEFAULT_GARDEN_WEIGHT_PCT) / 100;
  const gardenChf = (unit.gardenAreaSqm ?? 0) * pricePerSqm * gardenWeight;
  const extParkingChf = unit.extParkingValueChf ?? 0;
  const garageChf = unit.garageValueChf ?? 0;

  const intrinsicValueChf =
    habitationChf - vetusteChf + gardenChf + extParkingChf + garageChf;

  return { habitationChf, vetusteChf, gardenChf, extParkingChf, garageChf, intrinsicValueChf };
}
