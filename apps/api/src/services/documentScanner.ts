/**
 * Document Scanner — provider interface.
 *
 * Defines the contract that any document-scanning backend must satisfy.
 * The local OCR implementation (tesseract + sharp) is the default;
 * future providers (Azure Document Intelligence, Google Document AI, etc.)
 * implement the same interface.
 */

/* ──────────────────────────────────────────────────────────
   Shared types (canonical home — re-exported by documentScan.ts)
   ────────────────────────────────────────────────────────── */

export type DetectedDocType =
  | "IDENTITY"        // passport / ID card
  | "SALARY_PROOF"    // pay-slip
  | "DEBT_ENFORCEMENT_EXTRACT"
  | "PERMIT"          // residence permit
  | "HOUSEHOLD_INSURANCE"
  | "INVOICE"         // supplier / contractor invoice
  | "UNKNOWN";

export interface ScanResult {
  /** Detected document type */
  docType: DetectedDocType;
  /** 0-100 confidence that this doc type detection is correct */
  confidence: number;
  /** Extracted key-value fields relevant to this doc type */
  fields: Record<string, string | number | boolean | null>;
  /** Human-readable description of what was extracted */
  summary: string;
}

/* ──────────────────────────────────────────────────────────
   Provider interface
   ────────────────────────────────────────────────────────── */

export interface DocumentScanner {
  /**
   * Scan a document buffer and return structured extraction results.
   *
   * @param buffer    Raw file bytes (PDF, JPEG, PNG, etc.)
   * @param fileName  Original filename — used for doc-type heuristics
   * @param mimeType  MIME type of the uploaded file
   * @param hintDocType Optional user-supplied hint for the document type
   */
  scan(
    buffer: Buffer,
    fileName: string,
    mimeType: string,
    hintDocType?: string,
  ): Promise<ScanResult>;
}
