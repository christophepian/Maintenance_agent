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
  | "FINANCIAL_STATEMENT" // property manager balance sheet / closing accounts
  | "UNKNOWN";

/** One closing-balance line extracted from a financial statement. */
export interface ExtractedAccountBalance {
  rawAccountCode: string;
  rawAccountName: string;
  /**
   * Signed amount in CHF. Negative values represent contra-accounts or deductions
   * within their section (e.g. a negative line under Actifs reduces total assets).
   * Converted to signed cents at ingestion time.
   */
  balanceChf: number;
  /**
   * Ledger direction derived from documentSection + sign.
   * ACTIF positive → DEBIT; ACTIF negative → CREDIT; PASSIF positive → CREDIT; etc.
   */
  balanceType: "DEBIT" | "CREDIT";
  /**
   * Section from the document header this row appears under.
   * ACTIF / PASSIF for balance sheets; REVENUE / EXPENSE for P&L.
   * Used for the section-based balance check (sum ACTIF = sum PASSIF).
   */
  documentSection: "ACTIF" | "PASSIF" | "REVENUE" | "EXPENSE" | "OTHER";
}

/** One invoice line extracted from a multi-document PDF. */
export interface ExtractedInvoiceLine {
  vendorName?: string | null;
  invoiceNumber?: string | null;
  invoiceDate?: string | null;
  dueDate?: string | null;
  totalAmount?: number | null;
  vatAmount?: number | null;
  subtotal?: number | null;
  currency?: string | null;
  iban?: string | null;
  paymentReference?: string | null;
  description?: string | null;
  /** Unit number hint extracted from invoice (e.g. "Apt 3B") */
  unitHint?: string | null;
  /** Tenant name hint extracted from invoice */
  tenantHint?: string | null;
  /**
   * Model's confidence (0.0–1.0) that this entry is genuinely present in the
   * source text.  Lines below 0.6 are dropped before invoice creation.
   */
  confidence?: number | null;
}

export interface ScanResult {
  /** Detected document type */
  docType: DetectedDocType;
  /** 0-100 confidence that this doc type detection is correct */
  confidence: number;
  /** Extracted key-value fields relevant to this doc type */
  fields: Record<string, string | number | boolean | null>;
  /** Human-readable description of what was extracted */
  summary: string;
  /**
   * Populated for FINANCIAL_STATEMENT (and mixed PDFs that contain a balance sheet).
   * Each entry is one account-balance line extracted from the document.
   */
  accountBalances?: ExtractedAccountBalance[];
  /**
   * Populated for FINANCIAL_STATEMENT (and mixed PDFs that also contain invoice lines).
   * Each entry represents one distinct invoice found in the document.
   */
  invoiceLines?: ExtractedInvoiceLine[];
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
