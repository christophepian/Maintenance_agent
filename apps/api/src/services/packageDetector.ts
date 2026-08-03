/**
 * Régie package detector — classify an uploaded CSV as one of the four
 * year-end documents so the package onboarder can route each file to the right
 * mapper. Deterministic header + content heuristics; the cross-document
 * reconciliation downstream catches any misroute.
 */

import { parseCsv } from "../utils/csvParser";

export type PackageDocType =
  | "RENT_ROLL"
  | "GENERAL_LEDGER"
  | "BALANCE_SHEET"
  | "INCOME_STATEMENT"
  | "GENERAL_INFO"
  | "UNKNOWN";

function normHeader(h: string): string {
  return h
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]/g, "");
}

/** Does the header set contain any header matching one of the given normalized aliases? */
function hasHeader(norms: Set<string>, aliases: string[]): boolean {
  return aliases.some((a) => norms.has(a));
}

const OBJET = ["objet", "object", "unite", "lot", "local", "mietobjekt", "objekt", "noobjet"];
const LOCATAIRE = ["locataireprincipal", "locataire", "tenant", "mieter", "occupant"];
const LOYER = ["loyernetmensuelchf", "loyernet", "loyerbrutmensuelchf", "loyerbrut", "loyer", "netrent", "grossrent"];
const NO_PIECE = ["nopiece", "piece", "beleg", "belegnr", "nofacture", "pieceno"];
const TEXTE = ["texteecriture", "texte", "libelleecriture", "buchungstext", "ecriture"];
const DATE_VALEUR = ["datevaleur", "datepiece", "datecompta", "buchungsdatum", "valuta"];
const COMPTE = ["compte", "konto", "kontonr", "nocompte", "accountcode", "code"];
const MONTANT = ["montantchf", "montant", "betrag", "solde", "saldo", "balancechf", "balance", "amount"];
const SECTION = ["section", "classe", "rubrique", "kategorie"];
const INFO_KEY = ["champ", "field", "cle", "clé", "key", "attribut", "rubrique"];
const INFO_VAL = ["valeur", "value", "wert", "contenu"];

const ACTIF_RE = /actif|aktiv|asset/;
const PASSIF_RE = /passif|passiv|liabilit|fremdkapital|eigenkapital/;
const REVENUE_RE = /produit|ertrag|revenue|income/;
const EXPENSE_RE = /charge|aufwand|expense|cost/;

/**
 * Classify a CSV document. `fileName` is a weak hint; content is authoritative.
 */
export function detectDocumentType(fileName: string, text: string): PackageDocType {
  let headers: string[];
  let rows: Record<string, string>[];
  try {
    ({ headers, rows } = parseCsv(text));
  } catch {
    return "UNKNOWN";
  }
  const norms = new Set(headers.map(normHeader).filter(Boolean));

  // General info — a key/value sheet (champ/valeur) carrying the building's
  // address, reference and period. Detected before the financial docs.
  if (hasHeader(norms, INFO_KEY) && hasHeader(norms, INFO_VAL)) {
    const keyCol = headers.find((h) => INFO_KEY.includes(normHeader(h)));
    if (keyCol) {
      const keys = rows.map((r) => normHeader(r[keyCol] ?? ""));
      if (keys.some((k) => k.includes("immeuble") || k.includes("adresse") || k.includes("building") || k.includes("address"))) {
        return "GENERAL_INFO";
      }
    }
  }

  // Rent roll — one row per object with a tenant/rent.
  if (hasHeader(norms, OBJET) && (hasHeader(norms, LOCATAIRE) || hasHeader(norms, LOYER))) {
    return "RENT_ROLL";
  }

  // General ledger — transaction detail (piece number + entry text per row).
  if (hasHeader(norms, NO_PIECE) && hasHeader(norms, TEXTE)) {
    return "GENERAL_LEDGER";
  }
  if (hasHeader(norms, DATE_VALEUR) && hasHeader(norms, COMPTE) && hasHeader(norms, TEXTE)) {
    return "GENERAL_LEDGER";
  }

  // Account-summary shape (compte + amount) → balance sheet vs income statement.
  if (hasHeader(norms, COMPTE) && hasHeader(norms, MONTANT)) {
    const sectionKey = headers.find((h) => SECTION.includes(normHeader(h)));
    if (sectionKey) {
      let bs = 0;
      let is = 0;
      for (const r of rows) {
        const s = normHeader(r[sectionKey] ?? "");
        if (ACTIF_RE.test(s) || PASSIF_RE.test(s)) bs++;
        else if (REVENUE_RE.test(s) || EXPENSE_RE.test(s)) is++;
      }
      if (bs > 0 || is > 0) return bs >= is ? "BALANCE_SHEET" : "INCOME_STATEMENT";
    }
    // No usable section column — fall back to account-code ranges.
    const compteKey = headers.find((h) => COMPTE.includes(normHeader(h)));
    if (compteKey) {
      let bs = 0;
      let is = 0;
      for (const r of rows) {
        const code = parseInt((r[compteKey] ?? "").trim(), 10);
        if (!Number.isFinite(code)) continue;
        const lead = Math.floor(code / Math.pow(10, String(code).length - 1));
        if (lead === 1 || lead === 2) bs++;
        else if (lead >= 3) is++;
      }
      if (bs > 0 || is > 0) return bs >= is ? "BALANCE_SHEET" : "INCOME_STATEMENT";
    }
  }

  return "UNKNOWN";
}

export interface ExtractedBuildingInfo {
  name: string;
  address: string;
  city: string | null;
  postalCode: string | null;
  reference: string | null;
  fiscalYear: number | null;
}

/**
 * Extract a building's identity from a régie "general info" CSV (champ/valeur):
 * the address (split into street/postal/city), an optional reference and the
 * reporting fiscal year (from a `periode` like "01.01.2025 - 31.12.2025").
 * Returns null when there's no usable address.
 */
export function parseBuildingInfo(text: string): ExtractedBuildingInfo | null {
  let headers: string[];
  let rows: Record<string, string>[];
  try {
    ({ headers, rows } = parseCsv(text));
  } catch {
    return null;
  }
  const keyCol = headers.find((h) => INFO_KEY.includes(normHeader(h)));
  const valCol = headers.find((h) => INFO_VAL.includes(normHeader(h)));
  if (!keyCol || !valCol) return null;

  const kv = new Map<string, string>();
  for (const r of rows) {
    const k = normHeader(r[keyCol] ?? "");
    const v = (r[valCol] ?? "").trim();
    if (k) kv.set(k, v);
  }

  const addressRaw = (kv.get("immeubleadresse") ?? kv.get("adresse") ?? kv.get("address") ?? kv.get("buildingaddress") ?? "").trim();
  if (!addressRaw) return null;

  // "Rte Monts-de-Laval 314, 1090 La Croix (Lutry)" → street + "1090 La Croix (Lutry)"
  const parts = addressRaw.split(",").map((s) => s.trim()).filter(Boolean);
  const street = parts[0] || addressRaw;
  const tail = parts.slice(1).join(", ").trim();
  let city: string | null = null;
  let postalCode: string | null = null;
  const m = tail.match(/^(\d{4,5})\s+(.+)$/);
  if (m) {
    postalCode = m[1];
    city = m[2].trim();
  } else if (tail) {
    city = tail;
  }

  const reference = (kv.get("immeublereference") ?? kv.get("reference") ?? "").trim() || null;

  let fiscalYear: number | null = null;
  const years = (kv.get("periode") ?? "").match(/\d{4}/g);
  if (years && years.length) fiscalYear = parseInt(years[years.length - 1], 10); // end-of-period year

  return { name: street, address: addressRaw, city, postalCode, reference, fiscalYear };
}
