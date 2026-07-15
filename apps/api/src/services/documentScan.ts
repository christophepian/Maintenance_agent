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
import { AzureDocumentIntelligenceScanner } from "./scanners/azureDocumentIntelligenceScanner";
import { ClaudeVisionScanner } from "./scanners/claudeVisionScanner";
import type { PackageExtractionFile } from "./scanners/packageExtraction";

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
   Régie-package extraction — read a whole year-end PDF and emit
   the canonical CSVs the package onboarding pipeline consumes.

   Provider (PACKAGE_EXTRACTION_PROVIDER):
     "claude" (default) — Claude reads the PDF pages directly
       (vision). Preserves table structure and needs only
       ANTHROPIC_API_KEY, so it runs anywhere the app runs.
     "azure" — Azure Document Intelligence OCR → Claude on text.
       A fallback for degraded/scanned PDFs; needs Azure creds.
   ────────────────────────────────────────────────────────── */

let _visionScanner: ClaudeVisionScanner | null = null;
let _azurePackageScanner: AzureDocumentIntelligenceScanner | null = null;

export async function extractPackageFromPdf(
  buffer: Buffer,
  fileName: string,
  mimeType: string,
): Promise<PackageExtractionFile[]> {
  const provider = process.env.PACKAGE_EXTRACTION_PROVIDER || "claude";
  if (provider === "azure") {
    if (!_azurePackageScanner) _azurePackageScanner = new AzureDocumentIntelligenceScanner();
    return _azurePackageScanner.extractPackage(buffer, fileName, mimeType);
  }
  if (!_visionScanner) _visionScanner = new ClaudeVisionScanner();
  return _visionScanner.extractPackage(buffer, fileName, mimeType);
}

