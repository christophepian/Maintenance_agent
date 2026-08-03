/**
 * Rent-roll CSV → normalized rows for building onboarding.
 *
 * A régie rent roll lists one row per object (apartment / garage) with its
 * tenant, lease dates, rent and charges. This mapper parses it into
 * `RentRollRow[]`, which the onboarding service turns into Units + Tenants +
 * Leases. Reuses `csvParser` (delimiter auto-detect handles the tab-separated
 * exports) and resolves columns tolerantly (FR/DE aliases), like
 * csvAccountingMapper.
 *
 * Money is whole CHF (matching Unit.monthlyRentChf / Lease.netRentChf); dates
 * are `dd.mm.yyyy`. The trailing `Total` row and blank rows are skipped.
 */

import { parseCsv, parseChf } from "../utils/csvParser";

export interface RentRollRow {
  /** Full object code, e.g. "531100.01.0001". */
  objet: string;
  /** Unit number = last dotted segment of `objet` (e.g. "0001", "9001"). */
  unitNumber: string;
  /** Primary tenant name, or null when the object is vacant. */
  tenantName: string | null;
  isVacant: boolean;
  unitType: "RESIDENTIAL" | "PARKING";
  /** GARAGE for parking objects, else null. */
  parkingKind: "GARAGE" | null;
  floor: string | null;
  rooms: number | null;
  areaSqm: number | null;
  /** Lease start (`entree`), null if absent. */
  startDate: Date | null;
  /** Lease end (`sortie`), null = ongoing. */
  endDate: Date | null;
  /** Net monthly rent, whole CHF. */
  netRentChf: number | null;
  /** Monthly charges advance (`charges_acompte`), whole CHF. */
  chargesChf: number | null;
}

export interface RentRollResult {
  rows: RentRollRow[];
  skipped: string[];
}

/* ── tolerant header resolution ───────────────────────────────────────────── */

function normHeader(h: string): string {
  return h
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]/g, "");
}

const ALIASES: Record<string, string[]> = {
  objet: ["objet", "object", "unite", "unit", "lot", "local", "mietobjekt", "objekt", "noobjet", "numeroobjet"],
  tenantName: ["locataireprincipal", "locataire", "tenant", "mieter", "nom", "name", "occupant"],
  unitType: ["typeobjet", "type", "typelocal", "objektart", "categorie", "nature"],
  floor: ["etage", "floor", "stock", "stockwerk", "niveau"],
  rooms: ["pieces", "rooms", "zimmer", "nbpieces", "nombrepieces"],
  areaSqm: ["m2", "surface", "sqm", "flache", "surfacem2", "m2net"],
  startDate: ["entree", "debut", "start", "startdate", "eintritt", "datedentree", "dateentree", "dateentre"],
  endDate: ["sortie", "fin", "end", "enddate", "austritt", "datedesortie", "datesortie"],
  netRentChf: ["loyernetmensuelchf", "loyernet", "netrent", "nettomiete", "loyernetmensuel", "loyernetchf"],
  grossRentChf: ["loyerbrutmensuelchf", "loyerbrut", "grossrent", "bruttomiete", "loyerbrutmensuel", "loyer"],
  chargesChf: ["chargesacomptechf", "chargesacompte", "charges", "nebenkosten", "acompte", "acomptecharges", "acptcharges"],
};

function resolveHeaders(headers: string[]): Partial<Record<keyof typeof ALIASES, string>> {
  const byNorm = new Map<string, string>();
  for (const h of headers) {
    const n = normHeader(h);
    if (n && !byNorm.has(n)) byNorm.set(n, h);
  }
  const resolved: Partial<Record<string, string>> = {};
  for (const [canonical, aliases] of Object.entries(ALIASES)) {
    for (const alias of aliases) {
      if (byNorm.has(alias)) {
        resolved[canonical] = byNorm.get(alias);
        break;
      }
    }
  }
  return resolved;
}

/* ── field parsers ────────────────────────────────────────────────────────── */

/** Parse a `dd.mm.yyyy` (or `dd/mm/yyyy`, `dd-mm-yyyy`) date to a UTC Date. */
export function parseSwissDate(raw: string | undefined | null): Date | null {
  const t = (raw ?? "").trim();
  if (!t) return null;
  const m = t.match(/^(\d{1,2})[./-](\d{1,2})[./-](\d{2,4})$/);
  if (!m) return null;
  const dd = parseInt(m[1], 10);
  const mm = parseInt(m[2], 10);
  let yyyy = parseInt(m[3], 10);
  if (yyyy < 100) yyyy += yyyy >= 70 ? 1900 : 2000;
  if (mm < 1 || mm > 12 || dd < 1 || dd > 31) return null;
  const d = new Date(Date.UTC(yyyy, mm - 1, dd));
  return isNaN(d.getTime()) ? null : d;
}

function unitNumberFromObjet(objet: string): string {
  const parts = objet.split(".");
  return (parts[parts.length - 1] || objet).trim();
}

/**
 * Parse a room count that may use fraction glyphs or "n 1/2" notation and carry
 * trailing annotations, e.g. "4.5", "2½", "5½ (duplex", "3 1/2". Returns the
 * leading numeric value or null.
 */
export function parseRooms(raw: string | undefined | null): number | null {
  const t = (raw ?? "").trim();
  if (!t) return null;
  const s = t
    .replace(/\s*½/g, ".5")
    .replace(/\s*¼/g, ".25")
    .replace(/\s*¾/g, ".75")
    .replace(/\s*1\/2\b/g, ".5")
    .replace(/\s*1\/4\b/g, ".25")
    .replace(/\s*3\/4\b/g, ".75");
  const m = s.match(/\d+(?:\.\d+)?/);
  return m ? parseFloat(m[0]) : null;
}

const VACANT_RE = /^(vacant|vacthan|leer|libre|inoccup|frei|empty|-)/i;
const TOTAL_RE = /^(total|totaux|somme|summe)/i;

function isGarage(unitTypeRaw: string, objet: string): boolean {
  const t = normHeader(unitTypeRaw);
  if (["garage", "parking", "parc", "box", "placeparc", "placedeparc", "stellplatz", "pkw"].some((k) => t.includes(k))) {
    return true;
  }
  // Fallback: régie parking object codes. Two common schemes:
  //   • last dotted segment 9xxx (e.g. 531100.01.9001)
  //   • a 9-leading group anywhere in the code (e.g. "980 010.12", "980.01")
  const unit = unitNumberFromObjet(objet);
  if (/^9\d{3}$/.test(unit)) return true;
  return /(^|[^0-9])9\d{2}(?=[^0-9]|$)/.test(objet);
}

/**
 * Merge rows that share an `objet`. Some régie état-locatifs list one object's
 * rent across several component rows (Loyer / Acompte chauffage / Forfait), so
 * the same object appears more than once. When that happens we treat the largest
 * component amount as the net rent and the remaining components as charges;
 * other fields take the first non-null value. Single-row objects pass through
 * unchanged so the normal net/charges columns are preserved exactly.
 */
function mergeByObjet(rows: RentRollRow[]): RentRollRow[] {
  const groups = new Map<string, RentRollRow[]>();
  const order: string[] = [];
  for (const r of rows) {
    const g = groups.get(r.objet);
    if (g) g.push(r);
    else {
      groups.set(r.objet, [r]);
      order.push(r.objet);
    }
  }

  return order.map((objet) => {
    const g = groups.get(objet)!;
    if (g.length === 1) return g[0];

    const base: RentRollRow = { ...g[0] };
    for (const r of g.slice(1)) {
      base.tenantName = base.tenantName ?? r.tenantName;
      base.floor = base.floor ?? r.floor;
      base.rooms = base.rooms ?? r.rooms;
      base.areaSqm = base.areaSqm ?? r.areaSqm;
      base.startDate = base.startDate ?? r.startDate;
      base.endDate = base.endDate ?? r.endDate;
      if (r.parkingKind === "GARAGE") {
        base.unitType = "PARKING";
        base.parkingKind = "GARAGE";
      }
    }
    base.isVacant = !base.tenantName;

    // Redistribute the component amounts: largest = net rent, rest = charges.
    const amounts = g
      .flatMap((r) => [r.netRentChf, r.chargesChf])
      .filter((n): n is number => n != null);
    if (amounts.length === 0) {
      base.netRentChf = null;
      base.chargesChf = null;
    } else {
      const net = Math.max(...amounts);
      const charges = amounts.reduce((s, n) => s + n, 0) - net;
      base.netRentChf = net;
      base.chargesChf = charges > 0 ? charges : null;
    }
    return base;
  });
}

/* ── main ─────────────────────────────────────────────────────────────────── */

export function mapRentRoll(text: string): RentRollResult {
  const { headers, rows } = parseCsv(text);
  const h = resolveHeaders(headers);
  const out: RentRollRow[] = [];
  const skipped: string[] = [];

  if (!h.objet) {
    skipped.push(
      `No object column found. Expected one of: objet, unité, lot, Mietobjekt (got: ${headers.join(", ")})`,
    );
    return { rows: out, skipped };
  }

  rows.forEach((row) => {
    const objet = (row[h.objet!] ?? "").trim();
    const tenantRaw = (h.tenantName ? row[h.tenantName] ?? "" : "").trim();

    // Skip the trailing Total row and fully-blank rows (silently).
    if (!objet || TOTAL_RE.test(objet)) return;

    const isVacant = !tenantRaw || VACANT_RE.test(tenantRaw);
    const unitTypeRaw = h.unitType ? row[h.unitType] ?? "" : "";
    const garage = isGarage(unitTypeRaw, objet);

    const netRent = h.netRentChf ? parseChf(row[h.netRentChf]) : null;
    const grossRent = h.grossRentChf ? parseChf(row[h.grossRentChf]) : null;

    out.push({
      objet,
      unitNumber: unitNumberFromObjet(objet),
      tenantName: isVacant ? null : tenantRaw,
      isVacant,
      unitType: garage ? "PARKING" : "RESIDENTIAL",
      parkingKind: garage ? "GARAGE" : null,
      floor: h.floor ? (row[h.floor] ?? "").trim() || null : null,
      rooms: h.rooms ? parseRooms(row[h.rooms]) : null,
      areaSqm: h.areaSqm ? parseChf(row[h.areaSqm]) : null,
      startDate: h.startDate ? parseSwissDate(row[h.startDate]) : null,
      endDate: h.endDate ? parseSwissDate(row[h.endDate]) : null,
      // Prefer net rent; fall back to gross if the file only has gross.
      netRentChf: netRent != null ? Math.round(netRent) : grossRent != null ? Math.round(grossRent) : null,
      chargesChf: h.chargesChf ? (parseChf(row[h.chargesChf]) != null ? Math.round(parseChf(row[h.chargesChf])!) : null) : null,
    });
  });

  return { rows: mergeByObjet(out), skipped };
}
