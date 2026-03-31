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

