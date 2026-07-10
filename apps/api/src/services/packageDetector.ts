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
