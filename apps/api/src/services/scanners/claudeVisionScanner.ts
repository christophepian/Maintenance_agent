/**
 * Claude-native package extraction — reads the régie PDF pages directly (vision)
 * instead of OCR-to-text, so the table structure (columns, row/cell binding) is
 * preserved. This is what a flattened-OCR path loses, and it's the source of the
 * hardest cases: multi-column Montant/Débit/Crédit statements, rent split across
 * component rows, tenant names detached from their row.
 *
 * Requires only ANTHROPIC_API_KEY (no external OCR vendor), so the whole package
 * pipeline runs anywhere the app runs — including locally for validation.
 *
 * The whole PDF is sent once (cached) and each section is extracted with the same
 * forced tools the Azure path uses (see packageExtraction), so the canonical-CSV
 * hinge and everything downstream is identical.
 */

import type Anthropic from "@anthropic-ai/sdk";
import { getAnthropicClient } from "../aiClient";
import {
  emitRentRollCsv,
  emitBuildingInfoCsv,
  emitAccountBalancesCsv,
} from "./packageCsvEmitter";
import {
  RENT_ROLL_TOOL,
  BUILDING_INFO_TOOL,
  STATEMENT_BALANCE_TOOL,
  parseRentRollToolInput,
  parseBuildingInfoToolInput,
  parseBalancesToolInput,
  runForcedTool,
  type PackageExtractionFile,
} from "./packageExtraction";

const VISION_SYSTEM_PROMPT =
  "You are a financial document extraction assistant for Swiss property management reports. " +
  "You are given the report pages directly. Extract ONLY information explicitly present in the document. " +
  "Never infer, estimate, or invent values. If a field cannot be read, omit it.";

/** Extraction model — a stronger tier than the OCR-text path, since reading dense
 *  financial tables from the page image is harder. Overridable via env. */
const VISION_MODEL = process.env.PACKAGE_EXTRACTION_MODEL || "claude-sonnet-5";

export class ClaudeVisionScanner {
  async extractPackage(
    buffer: Buffer,
    fileName: string,
    mimeType: string,
  ): Promise<PackageExtractionFile[]> {
    if (mimeType !== "application/pdf") {
      throw new Error(`ClaudeVisionScanner only supports application/pdf (got ${mimeType}).`);
    }

    const client = getAnthropicClient();
    const base = fileName.replace(/\.[^.]+$/, "").replace(/[^\w.-]+/g, "_") || "package";

    const documentBlock = {
      type: "document",
      source: { type: "base64", media_type: "application/pdf", data: buffer.toString("base64") },
    } as unknown as Anthropic.Messages.ContentBlockParam;

    // One tool per call. Passing all three tools at once made the model
    // double-encode its output (wrapping the result as a JSON string), so each
    // section gets its own single-tool call — reliable, at the cost of re-sending
    // the PDF per section (fine for a one-time, human-gated onboarding).
    const call = (tool: unknown, instruction: string, toolName: string, maxTokens: number) =>
      runForcedTool(client, {
        model: VISION_MODEL,
        system: VISION_SYSTEM_PROMPT,
        content: [documentBlock, { type: "text", text: instruction }],
        tools: [tool],
        toolName,
        maxTokens,
      });

    const files: PackageExtractionFile[] = [];

    // Building identity.
    const infoInput = await call(
      BUILDING_INFO_TOOL,
      "This is a Swiss régie property report. Find the cover / general-info page and extract the building identity: " +
        "address (with postal code and city if shown), management reference, reporting period, régie and owner.",
      "extractBuildingInfo",
      512,
    );
    const info = parseBuildingInfoToolInput(infoInput);
    if (info) {
      const csv = emitBuildingInfoCsv(info);
      if (csv) files.push({ fileName: `${base}__infos.csv`, text: csv });
    }

    // Rent roll → units/tenants/leases.
    const rentRollInput = await call(
      RENT_ROLL_TOOL,
      "Find the état locatif (the schedule of monthly rents, one row per object) and extract EVERY object. " +
        "Merge each object's component lines (Loyer + Acompte/Forfait) into one entry. " +
        "Ignore the rent-collection (encaissements) and tenant-balance (situation des soldes) tables.",
      "extractRentRoll",
      8192,
    );
    const rentRoll = emitRentRollCsv(parseRentRollToolInput(rentRollInput));
    if (rentRoll) files.push({ fileName: `${base}__rentroll.csv`, text: rentRoll });

    // Balance sheet + income statement → split by section.
    const balancesInput = await call(
      STATEMENT_BALANCE_TOOL,
      "Extract the account balances from the balance sheet (bilan: Actifs / Passifs) and the income statement " +
        "(compte de résultat / compte de gestion: Produits / Charges). Ignore the owner current-account statement " +
        "(compte propriétaire). In multi-column layouts read each account's own Montant, not a parent Débit/Crédit subtotal.",
      "extractAccountBalances",
      8192,
    );
    const { accountBalances } = parseBalancesToolInput(balancesInput);
    const bilan = emitAccountBalancesCsv(accountBalances, "balance");
    if (bilan) files.push({ fileName: `${base}__bilan.csv`, text: bilan });
    const resultat = emitAccountBalancesCsv(accountBalances, "income");
    if (resultat) files.push({ fileName: `${base}__resultat.csv`, text: resultat });

    console.log(
      `[PKG-VISION] ${VISION_MODEL} extracted ${files.length} CSV(s) from ${fileName}: ` +
        files.map((f) => f.fileName).join(", "),
    );
    return files;
  }
}
