/**
 * Régie-package extraction tools — the single source of truth for the Claude
 * tools, parsers and helpers that turn a régie report into the structured rows
 * the deterministic mappers consume (see packageCsvEmitter).
 *
 * Both scanner providers use these unchanged:
 *   • AzureDocumentIntelligenceScanner — OCRs the PDF, then runs each tool over
 *     the extracted text.
 *   • ClaudeVisionScanner — hands the PDF pages to Claude directly (vision), so
 *     table structure is preserved and no external OCR vendor is needed.
 *
 * Keeping the tool definitions here (not in a provider) means the extraction
 * prompt is tuned in exactly one place regardless of how the pages are read.
 */

import type Anthropic from "@anthropic-ai/sdk";
import type { ExtractedAccountBalance } from "../documentScanner";
import type { ExtractedRentRollRow, ExtractedBuildingInfoFields } from "./packageCsvEmitter";

/** One synthetic canonical CSV produced from a régie PDF, ready for the package pipeline. */
export interface PackageExtractionFile {
  fileName: string;
  text: string;
}

/* ── Swiss accounting helpers ─────────────────────────────────────────────── */

export function normalizeSwissAccountCode(code: string): string {
  const trimmed = code.trim();
  // If it's purely numeric and longer than 4 digits, truncate to 4.
  if (/^\d{5,}$/.test(trimmed)) {
    return trimmed.substring(0, 4);
  }
  return trimmed;
}

/**
 * Derive the double-entry ledger direction from a document section and the sign
 * of the amount. ACTIF: +DEBIT/−CREDIT · PASSIF: +CREDIT/−DEBIT ·
 * REVENUE: +CREDIT/−DEBIT · EXPENSE: +DEBIT/−CREDIT.
 */
export function deriveLedgerDirection(
  section: "ACTIF" | "PASSIF" | "REVENUE" | "EXPENSE" | "OTHER",
  amount: number,
): "DEBIT" | "CREDIT" {
  const positive = amount >= 0;
  switch (section) {
    case "ACTIF":   return positive ? "DEBIT" : "CREDIT";
    case "PASSIF":  return positive ? "CREDIT" : "DEBIT";
    case "REVENUE": return positive ? "CREDIT" : "DEBIT";
    case "EXPENSE": return positive ? "DEBIT" : "CREDIT";
    default:        return positive ? "DEBIT" : "CREDIT";
  }
}

/* ── extraction tools ─────────────────────────────────────────────────────── */

/** Claude tool for extracting account balance rows from a financial statement. */
export const STATEMENT_BALANCE_TOOL = {
  name: "extractAccountBalances",
  description:
    "Extract account balance rows from a Swiss property management financial statement. " +
    "For each row record the documentSection from the nearest printed section header: " +
    "ACTIF (Actifs/Aktiven), PASSIF (Passifs/Passiven), REVENUE (Produits/Ertrag), EXPENSE (Charges/Aufwand), OTHER when unclear. " +
    "IMPORTANT — equity and result accounts: 'Bénéfice de l'exercice', 'Résultat net', 'Report bénéfices-pertes' are PASSIF equity rows even if they appear after income data. " +
    "IMPORTANT — ignore an owner current-account statement (compte / décompte propriétaire: solde reporté, résultat d'exploitation, versements/prélèvements propriétaires, amortissements hypothécaires) — those are equity movements, not bilan or P&L accounts; do not extract them. " +
    "IMPORTANT — signed amounts: preserve negative signs exactly as printed. A negative under ACTIF is a contra-asset — keep it negative, keep documentSection=ACTIF. Never flip the section due to a negative sign. " +
    "IMPORTANT — no hierarchy double-counting: Swiss balance sheets often show a parent subtotal AND the detail rows that make it up, all under the same account code. " +
    "Example: '1295 Acomptes -24'900' is the subtotal of '1295 Frais chauffage -4'980' + '1295 Frais exploitation -19'920'. " +
    "Extract the DETAIL rows only (the leaves). Skip any row whose amount equals the exact sum of other rows you are already extracting with the same code. " +
    "If there are no detail sub-rows, extract the parent row. " +
    "IMPORTANT — multi-column layouts (Montant / Débit / Crédit): use each account's own line amount from the 'Montant' column on the leaf row. A parent's Débit or Crédit column shows only its subtotal — do NOT emit that subtotal as if it were a separate account. " +
    "IMPORTANT — carry-forward rows: running page-break totals labelled 'A reporter', 'Report', 'Report/Report' or 'Übertrag' are NOT accounts — never emit them. (A coded equity account such as 'Report bénéfices-pertes' with its own account code IS a real account — keep it.) " +
    "IMPORTANT — account codes: Swiss chart uses 3- to 5-digit codes, sometimes with a sub-suffix (e.g. '1020', '4200', '3000-00', '4050-10'). Extract the code from the leftmost column ONLY. " +
    "IMPORTANT — amounts: Swiss format: apostrophe=thousands, period=decimal: 62'405.24 → 62405.24. European format: period=thousands, comma=decimal: 62.405,24 → 62405.24. " +
    "Return balanceChf as a plain signed JSON number, never a formatted string.",
  input_schema: {
    type: "object",
    required: ["balances"],
    properties: {
      fiscalYear: { type: "integer", description: "Fiscal year of the statement, e.g. 2024" },
      periodLabel: { type: "string", description: "Human-readable period label as it appears in the document, e.g. '01.01.2024 – 31.12.2024'" },
      buildingAddress: { type: "string", description: "Property address if mentioned in the document" },
      balances: {
        type: "array",
        description: "All account balance rows found in the document",
        items: {
          type: "object",
          required: ["rawAccountCode", "rawAccountName", "balanceChf", "documentSection"],
          properties: {
            rawAccountCode: { type: "string", description: "Account code from the leftmost column only, e.g. '1020', '4200', '3000-00'." },
            rawAccountName: { type: "string", description: "Account name as printed, e.g. 'Compte courant propriétaires'" },
            balanceChf: { type: "number", description: "Signed closing balance in CHF as a plain decimal number. Negative values are valid (e.g. -16736.80 for a deduction within the Actifs section)." },
            documentSection: { type: "string", enum: ["ACTIF", "PASSIF", "REVENUE", "EXPENSE", "OTHER"], description: "Section header this row falls under. ACTIF=assets, PASSIF=liabilities/equity, REVENUE=income, EXPENSE=charges. Never change the section because the amount is negative." },
          },
        },
      },
    },
  },
} as const;

/** Claude tool for extracting the rent roll (état locatif) from a régie package. */
export const RENT_ROLL_TOOL = {
  name: "extractRentRoll",
  description:
    "Extract the rent roll (état locatif / tenant schedule) from a Swiss property management document. " +
    "Use ONLY the état locatif — the schedule listing the monthly rent per object. IGNORE rent-collection tables " +
    "(état des encaissements) and tenant-balance tables (situation des soldes): those show annual amounts due/received, not monthly rent. " +
    "Return exactly ONE entry per rental object. Record the primary tenant, the object type, entry/exit dates, " +
    "and the NET monthly rent (loyer net mensuel — never the gross/brut figure). Mark empty objects as vacant. " +
    "Skip any 'Total'/'Totaux'/'Totaux mensuels'/'Totaux annuels' summary row. " +
    "IMPORTANT — rent split across component rows: some état-locatifs list one object's rent on several lines " +
    "(e.g. 'Loyer', 'Acompte chauffage et eau', 'Forfait chauffage & EC', 'Loyer garage'). Merge them into the " +
    "SINGLE object entry: netRentChf = the 'Loyer' (base rent) component; chargesChf = the SUM of the " +
    "acompte/forfait heating & charges components. Never emit a separate entry per component line. " +
    "IMPORTANT — object type: infer it from any available cue — a type column, the floor label ('Gar.' = garage), " +
    "or the rent-component label: 'Loyer garage' → parking/garage, 'Loyer commercial' / 'Loc.commer' → commercial " +
    "local, plain 'Loyer' → residential. Object codes may use spaces and dots (e.g. '980 010.12', '531100.01.9001'); " +
    "a 9-leading group (9xx / 900 / 980 / 990) indicates parking. " +
    "IMPORTANT — dates: entree = lease start (Début location / entrée). sortie = move-out date ONLY. If the row " +
    "shows a contractual term end (Echéance / échéance) but the tenant has not left, leave sortie empty.",
  input_schema: {
    type: "object",
    required: ["objects"],
    properties: {
      objects: {
        type: "array",
        description: "Every rental object row in the état locatif.",
        items: {
          type: "object",
          required: ["objet", "confidence"],
          properties: {
            objet: { type: "string", description: "Full object code exactly as printed, e.g. '531100.01.0001' or '410 010.16'." },
            tenantName: { type: "string", description: "Primary tenant name. Omit, or use 'Vacant', if the object is empty." },
            unitType: { type: "string", description: "Object type: 'Appartement'/residential, 'Garage'/'Parking' (incl. rows labelled 'Loyer garage' or floor 'Gar.'), or 'Commercial' (rows labelled 'Loyer commercial' / 'Loc.commer')." },
            floor: { type: "string", description: "Floor / étage as printed." },
            rooms: { type: "number", description: "Number of rooms (pièces), e.g. 4.5." },
            areaSqm: { type: "number", description: "Area in m²." },
            entree: { type: "string", description: "Lease start date, DD.MM.YYYY." },
            sortie: { type: "string", description: "Move-out date, DD.MM.YYYY. Omit if ongoing (a contractual Echéance is NOT a move-out)." },
            netRentChf: { type: "number", description: "NET monthly rent in CHF (loyer net mensuel), a plain number. Never the gross/brut figure." },
            chargesChf: { type: "number", description: "Monthly charges advance in CHF (charges/acompte/forfait), a plain number." },
            confidence: { type: "number", description: "Your confidence (0.0–1.0) that this row is read correctly from the source." },
          },
        },
      },
    },
  },
} as const;

/** Claude tool for extracting the building's identity from the general-info/cover page. */
export const BUILDING_INFO_TOOL = {
  name: "extractBuildingInfo",
  description:
    "Extract the building/property identity from the general-info or cover page of a Swiss régie report. " +
    "This is property identity, not financial data.",
  input_schema: {
    type: "object",
    required: [],
    properties: {
      immeubleAdresse: {
        type: "string",
        description:
          "Full building address including street, and postal code + city when shown, e.g. 'Rte Monts-de-Laval 314, 1090 La Croix (Lutry)' or 'Rue des Chevaux 4'.",
      },
      immeubleReference: { type: "string", description: "Management reference number for the building, e.g. '78645' or '5015'." },
      periode: { type: "string", description: "Reporting period exactly as printed, e.g. '01.01.2024 - 31.12.2024'." },
      gerance: { type: "string", description: "Property management company (régie / gérance)." },
      proprietaire: { type: "string", description: "Owner name(s)." },
    },
  },
} as const;

/* ── tool-output parsers (schema → typed rows) ────────────────────────────── */

/**
 * Some models double-encode a forced tool's output — returning the whole result
 * as a JSON string, or nesting it as a string inside its array field. Unwrap both
 * so the parsers always see a plain object. `arrayKey` (e.g. "balances",
 * "objects") is the field expected to hold the array.
 */
function unwrapDoubleEncoded(input: unknown, arrayKey?: string): Record<string, unknown> {
  let v: unknown = input;
  if (typeof v === "string") {
    try { v = JSON.parse(v); } catch { return {}; }
  }
  if (!v || typeof v !== "object") return {};
  const obj = v as Record<string, unknown>;
  if (arrayKey && typeof obj[arrayKey] === "string") {
    try {
      const inner = JSON.parse(obj[arrayKey] as string);
      if (Array.isArray(inner)) return { ...obj, [arrayKey]: inner };
      if (inner && typeof inner === "object") return { ...obj, ...(inner as Record<string, unknown>) };
    } catch { /* leave as-is */ }
  }
  return obj;
}

export function parseRentRollToolInput(input: unknown): ExtractedRentRollRow[] {
  const objects = unwrapDoubleEncoded(input, "objects").objects;
  if (!Array.isArray(objects)) return [];
  return objects
    .filter((o) => typeof o.objet === "string" && o.objet.trim())
    .map((o) => ({
      objet: (o.objet as string).trim(),
      tenantName: typeof o.tenantName === "string" ? o.tenantName : null,
      unitType: typeof o.unitType === "string" ? o.unitType : null,
      floor: typeof o.floor === "string" ? o.floor : null,
      rooms: typeof o.rooms === "number" ? o.rooms : null,
      areaSqm: typeof o.areaSqm === "number" ? o.areaSqm : null,
      entree: typeof o.entree === "string" ? o.entree : null,
      sortie: typeof o.sortie === "string" ? o.sortie : null,
      loyerNetChf: typeof o.netRentChf === "number" ? o.netRentChf : null,
      chargesChf: typeof o.chargesChf === "number" ? o.chargesChf : null,
      confidence: typeof o.confidence === "number" ? o.confidence : null,
    }));
}

export function parseBuildingInfoToolInput(input: unknown): ExtractedBuildingInfoFields | null {
  const i = unwrapDoubleEncoded(input);
  const address = typeof i?.immeubleAdresse === "string" ? i.immeubleAdresse.trim() : "";
  if (!address) return null;
  return {
    immeubleAdresse: address,
    immeubleReference: typeof i?.immeubleReference === "string" ? i.immeubleReference : null,
    periode: typeof i?.periode === "string" ? i.periode : null,
    gerance: typeof i?.gerance === "string" ? i.gerance : null,
    proprietaire: typeof i?.proprietaire === "string" ? i.proprietaire : null,
  };
}

export function parseBalancesToolInput(input: unknown): {
  fields: Record<string, string | number | boolean | null>;
  accountBalances: ExtractedAccountBalance[];
} {
  const i = unwrapDoubleEncoded(input, "balances") as {
    fiscalYear?: number;
    periodLabel?: string;
    buildingAddress?: string;
    balances?: Array<{ rawAccountCode: string; rawAccountName: string; balanceChf: number; documentSection?: string }>;
  } | null;
  const fields: Record<string, string | number | boolean | null> = {};
  if (i?.fiscalYear) fields.fiscalYear = i.fiscalYear;
  if (i?.periodLabel) fields.periodLabel = i.periodLabel;
  if (i?.buildingAddress) fields.buildingAddress = i.buildingAddress;

  const rawBalances = Array.isArray(i?.balances) ? i.balances : [];
  const accountBalances = rawBalances
    .filter((b) => b.rawAccountCode && b.rawAccountName && typeof b.balanceChf === "number")
    .map((b) => {
      const section = (["ACTIF", "PASSIF", "REVENUE", "EXPENSE", "OTHER"].includes(b.documentSection ?? "")
        ? b.documentSection!
        : "OTHER") as "ACTIF" | "PASSIF" | "REVENUE" | "EXPENSE" | "OTHER";
      return {
        rawAccountCode: normalizeSwissAccountCode(b.rawAccountCode),
        rawAccountName: b.rawAccountName,
        balanceChf: b.balanceChf, // preserve sign — negative = contra/deduction
        documentSection: section,
        balanceType: deriveLedgerDirection(section, b.balanceChf),
      };
    });
  return { fields, accountBalances };
}

/* ── forced-tool runner ───────────────────────────────────────────────────── */

/**
 * Run a single forced tool call and return the tool's input object (or null).
 * `content` is either OCR text (Azure path) or a content-block array carrying a
 * native PDF document block (vision path) — the tools are identical either way.
 */
export async function runForcedTool(
  client: Anthropic,
  opts: {
    model: string;
    system: string;
    content: string | Anthropic.Messages.ContentBlockParam[];
    tools: readonly unknown[];
    toolName: string;
    maxTokens: number;
  },
): Promise<unknown | null> {
  const response = await client.messages.create({
    model: opts.model,
    max_tokens: opts.maxTokens,
    // NB: newer models (e.g. claude-sonnet-5) deprecate `temperature` — omit it.
    // Determinism for extraction comes from the forced tool_choice, not sampling.
    system: opts.system,
    tools: opts.tools as unknown as Anthropic.Messages.Tool[],
    tool_choice: { type: "tool", name: opts.toolName },
    messages: [{ role: "user", content: opts.content }],
  });
  for (const block of response.content) {
    if (block.type === "tool_use" && block.name === opts.toolName) return block.input;
  }
  return null;
}
