/**
 * Document Scanner factory.
 *
 * Reads DOCUMENT_SCAN_PROVIDER env var and returns the appropriate
 * DocumentScanner implementation. Follows the same pattern as
 * storage/attachments.ts (interface → class → factory → singleton).
 *
 * Supported providers:
 *   "local" — LocalOcrScanner (tesseract.js + sharp + pdf-parse)
 *   "azure" — AzureDocumentIntelligenceScanner (Azure AI Document Intelligence)
 *
 * Optional fallback:
 *   DOCUMENT_SCAN_FALLBACK_PROVIDER — if set and the primary provider throws,
 *   the scanner retries with this fallback provider before propagating the error.
 */

import type { DocumentScanner, ScanResult } from "../documentScanner";
import { LocalOcrScanner } from "./localOcrScanner";
import { AzureDocumentIntelligenceScanner } from "./azureDocumentIntelligenceScanner";

const SCAN_PROVIDER = process.env.DOCUMENT_SCAN_PROVIDER || "local";
const FALLBACK_PROVIDER = process.env.DOCUMENT_SCAN_FALLBACK_PROVIDER || "";

function instantiateScanner(provider: string): DocumentScanner {
  switch (provider) {
    case "local":
      return new LocalOcrScanner();
    case "azure":
      return new AzureDocumentIntelligenceScanner();
    default:
      throw new Error(
        `Unknown DOCUMENT_SCAN_PROVIDER: "${provider}". Supported: "local" | "azure".`,
      );
  }
}

/**
 * Wraps a primary scanner with optional fallback.
 * If the primary throws and a fallback provider is configured,
 * the error is logged and the fallback scanner is tried instead.
 */
class FallbackScanner implements DocumentScanner {
  private primary: DocumentScanner;
  private fallback: DocumentScanner | null;

  constructor(primary: DocumentScanner, fallbackProvider: string) {
    this.primary = primary;
    this.fallback = fallbackProvider ? instantiateScanner(fallbackProvider) : null;
  }

  async scan(
    buffer: Buffer,
    fileName: string,
    mimeType: string,
    hintDocType?: string,
  ): Promise<ScanResult> {
    try {
      return await this.primary.scan(buffer, fileName, mimeType, hintDocType);
    } catch (err) {
      if (!this.fallback) throw err;

      console.error(
        `[DOC-SCAN] Primary scanner (${SCAN_PROVIDER}) failed, ` +
        `falling back to "${FALLBACK_PROVIDER}":`,
        err instanceof Error ? err.message : err,
      );

      return this.fallback.scan(buffer, fileName, mimeType, hintDocType);
    }
  }
}

function createScanner(): DocumentScanner {
  const primary = instantiateScanner(SCAN_PROVIDER);

  // No fallback needed if none configured or same as primary
  if (!FALLBACK_PROVIDER || FALLBACK_PROVIDER === SCAN_PROVIDER) {
    return primary;
  }

  return new FallbackScanner(primary, FALLBACK_PROVIDER);
}

/** Singleton scanner instance */
export const scanner: DocumentScanner = createScanner();
