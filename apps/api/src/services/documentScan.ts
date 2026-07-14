/**
 * Document scanning / OCR service — thin façade.
 *
 * Delegates to the active DocumentScanner provider (selected via
 * DOCUMENT_SCAN_PROVIDER env var, default "local").
 *
 * Types and the public `scanDocument()` function are re-exported here
 * so that existing consumers (routes/rentalApplications.ts) need no
 * import-path changes.
 */

// ── Re-export canonical types for backward compatibility ──
export type { DetectedDocType, ScanResult } from "./documentScanner";

import { scanner } from "./scanners";
import {
  AzureDocumentIntelligenceScanner,
  type PackageExtractionFile,
} from "./scanners/azureDocumentIntelligenceScanner";

/* ──────────────────────────────────────────────────────────
   Main entry point — delegates to the configured provider
   ────────────────────────────────────────────────────────── */

export async function scanDocument(
  buffer: Buffer,
  fileName: string,
  mimeType: string,
  /** Optional hint from the user about what they're uploading */
  hintDocType?: string,
): Promise<import("./documentScanner").ScanResult> {
  return scanner.scan(buffer, fileName, mimeType, hintDocType);
}

export type { PackageExtractionFile };

/* ──────────────────────────────────────────────────────────
   Régie-package extraction — OCR a whole year-end PDF and emit
   the canonical CSVs the package onboarding pipeline consumes.
   Requires the Azure provider (Azure OCR + Claude); the local
   OCR provider has no LLM, so this throws there rather than
   silently producing nothing.
   ────────────────────────────────────────────────────────── */

let _packageScanner: AzureDocumentIntelligenceScanner | null = null;

export async function extractPackageFromPdf(
  buffer: Buffer,
  fileName: string,
  mimeType: string,
): Promise<PackageExtractionFile[]> {
  const provider = process.env.DOCUMENT_SCAN_PROVIDER || "local";
  if (provider !== "azure") {
    throw new Error(
      "PDF package extraction requires DOCUMENT_SCAN_PROVIDER=azure (Azure OCR + Claude). " +
        `Current provider is "${provider}". Upload CSVs instead, or configure the azure provider.`,
    );
  }
  if (!_packageScanner) _packageScanner = new AzureDocumentIntelligenceScanner();
  return _packageScanner.extractPackage(buffer, fileName, mimeType);
}

