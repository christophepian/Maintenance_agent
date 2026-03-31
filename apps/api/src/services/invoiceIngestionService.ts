/**
 * Invoice Ingestion Service
 *
 * Orchestrates the ingestion pipeline for scanned/uploaded invoices:
 *   1. Receive file buffer + metadata
 *   2. Scan document via DocumentScanner (OCR + field extraction)
 *   3. Store the source file
 *   4. Create an Invoice record with extracted fields + ingestion metadata
 *
 * Confidence-based auto-classification:
 *   ≥ 75 → AUTO_CONFIRMED   (high confidence, no review needed)
 *   50–74 → PENDING_REVIEW   (moderate confidence, human should verify)
 *   < 50 → PENDING_REVIEW    (low confidence, flagged for review)
 */

import { InvoiceDirection, InvoiceSourceChannel, IngestionStatus } from "@prisma/client";
import { scanDocument } from "./documentScan";
import { createInvoice, type CreateInvoiceParams, type InvoiceDTO } from "./invoices";
import { storage } from "../storage/attachments";
import type { ScanResult } from "./documentScanner";
import * as crypto from "crypto";

/* ──────────────────────────────────────────────────────────
   Public interface
   ────────────────────────────────────────────────────────── */

export interface IngestInvoiceInput {
  /** Raw file bytes */
  buffer: Buffer;
  /** Original filename */
  fileName: string;
  /** MIME type */
  mimeType: string;
  /** Organisation ID (from auth context) */
  orgId: string;
  /** How the invoice arrived */
  sourceChannel: InvoiceSourceChannel;
  /** Direction: INCOMING (from supplier) or OUTGOING (to tenant/owner) */
  direction?: InvoiceDirection;
  /** Optional hint for document type detection */
  hintDocType?: string;
}

export interface IngestInvoiceResult {
  /** The created invoice record */
  invoice: InvoiceDTO;
  /** Raw scan result from the scanner */
  scanResult: ScanResult;
  /** Ingestion status assigned based on confidence */
  ingestionStatus: IngestionStatus;
}

/* ──────────────────────────────────────────────────────────
   Core ingestion pipeline
   ────────────────────────────────────────────────────────── */

export async function ingestInvoice(
  input: IngestInvoiceInput,
): Promise<IngestInvoiceResult> {
  const {
    buffer,
    fileName,
    mimeType,
    orgId,
    sourceChannel,
    direction = "INCOMING",
    hintDocType,
  } = input;

  // 1. Scan the document
  console.log(
    `[INVOICE-INGEST] Scanning file="${fileName}" ` +
    `size=${buffer.length} mime=${mimeType} channel=${sourceChannel}`,
  );

  const scanResult = await scanDocument(
    buffer,
    fileName,
    mimeType,
    hintDocType ?? "INVOICE",
  );

  console.log(
    `[INVOICE-INGEST] Scan complete: docType=${scanResult.docType} ` +
    `confidence=${scanResult.confidence} fields=${Object.keys(scanResult.fields).length}`,
  );

  // 2. Store the source file
  const fileKey = `invoices/ingest/${Date.now()}-${crypto.randomBytes(4).toString("hex")}/${fileName}`;
  await storage.put(fileKey, buffer);
  const sourceFileUrl = fileKey;

  // 3. Determine ingestion status from confidence
  const ingestionStatus = classifyConfidence(scanResult.confidence);

  // 4. Map scan fields → CreateInvoiceParams
  const fields = scanResult.fields;
  const totalAmount = typeof fields.totalAmount === "number" ? fields.totalAmount : undefined;
  const subtotalAmount = typeof fields.subtotal === "number" ? fields.subtotal : undefined;
  const vatAmount = typeof fields.vatAmount === "number" ? fields.vatAmount : undefined;

  // For the `amount` param, pass the subtotal (net before VAT) so that
  // createInvoice can recompute subtotal + VAT = total correctly.
  // If we only have the gross total, back-calculate net using the VAT amount.
  let netAmount: number | undefined;
  if (subtotalAmount !== undefined) {
    netAmount = subtotalAmount;
  } else if (totalAmount !== undefined && vatAmount !== undefined) {
    netAmount = totalAmount - vatAmount;
  } else {
    // No VAT breakdown available — use total as-is with 0% VAT rate
    netAmount = totalAmount;
  }

  const params: CreateInvoiceParams = {
    orgId,
    direction,
    sourceChannel,
    ingestionStatus,
    rawOcrText: truncateOcrText(scanResult.summary + "\n---\n" + JSON.stringify(fields)),
    ocrConfidence: scanResult.confidence,
    sourceFileUrl,
    // Map extracted fields — use subtotal so VAT is computed correctly
    amount: netAmount,
    description: buildDescription(scanResult),
    // Optional FK matches (not resolved yet — future slices will add smart matching)
    matchedJobId: undefined,
    matchedLeaseId: undefined,
    matchedBuildingId: undefined,
  };

  // Set invoice dates from scan
  if (fields.invoiceDate && typeof fields.invoiceDate === "string") {
    const parsed = parseDateField(fields.invoiceDate);
    if (parsed) params.issueDate = parsed;
  }
  if (fields.dueDate && typeof fields.dueDate === "string") {
    const parsed = parseDateField(fields.dueDate);
    if (parsed) params.dueDate = parsed;
  }

  // Set vendor as recipient for incoming invoices
  if (typeof fields.vendorName === "string" && fields.vendorName) {
    params.recipientName = fields.vendorName;
  }

  // Map extracted payment details
  // Note: vendorInvoiceNumber is NOT mapped to invoiceNumber (unique constraint
  // per org). It's preserved in the description and rawOcrText/scanResult.
  if (typeof fields.iban === "string" && fields.iban) {
    params.iban = fields.iban;
  }
  if (typeof fields.paymentReference === "string" && fields.paymentReference) {
    params.paymentReference = fields.paymentReference;
  }
  if (typeof fields.currency === "string" && fields.currency) {
    params.currency = fields.currency;
  }

  // Map vendor address fields
  if (typeof fields.vendorAddress === "string" && fields.vendorAddress) {
    params.recipientAddressLine1 = fields.vendorAddress;
  }
  if (typeof fields.billToName === "string" && fields.billToName) {
    // billToName is the customer; for incoming invoices the vendor is the issuer
    // and the bill-to party is our own org — store for reference in description
    params.description = (params.description || "") + `\nBill To: ${fields.billToName}`;
  }

  // VAT rate inference
  if (typeof fields.vatAmount === "number" && totalAmount && totalAmount > 0) {
    const subtotal = typeof fields.subtotal === "number" ? fields.subtotal : totalAmount - fields.vatAmount;
    if (subtotal > 0) {
      params.vatRate = Math.round((fields.vatAmount / subtotal) * 10000) / 100;
    }
  } else if (totalAmount !== undefined && vatAmount === undefined) {
    // No VAT info — set 0% to avoid double-computing VAT on the total
    params.vatRate = 0;
  }

  // 5. Create the invoice record
  const invoice = await createInvoice(params);

  console.log(
    `[INVOICE-INGEST] Created invoice id=${invoice.id} ` +
    `status=${ingestionStatus} confidence=${scanResult.confidence}`,
  );

  return { invoice, scanResult, ingestionStatus };
}

/* ──────────────────────────────────────────────────────────
   Internal helpers
   ────────────────────────────────────────────────────────── */

function classifyConfidence(confidence: number): IngestionStatus {
  if (confidence >= 75) return "AUTO_CONFIRMED";
  return "PENDING_REVIEW";
}

function buildDescription(scan: ScanResult): string {
  const parts: string[] = [];
  if (scan.fields.vendorName) parts.push(`From: ${scan.fields.vendorName}`);
  if (scan.fields.invoiceNumber) parts.push(`Invoice #${scan.fields.invoiceNumber}`);
  if (scan.fields.totalAmount) parts.push(`Total: ${scan.fields.totalAmount}`);
  if (scan.fields.currency) parts.push(`(${scan.fields.currency})`);
  return parts.length > 0
    ? `[Ingested] ${parts.join(" | ")}`
    : "[Ingested] Invoice — details pending review";
}

function truncateOcrText(text: string): string {
  const MAX = 4000;
  return text.length <= MAX ? text : text.substring(0, MAX) + "…";
}

function parseDateField(raw: string): Date | undefined {
  // Try ISO first (yyyy-mm-dd)
  const iso = /^(\d{4})-(\d{2})-(\d{2})$/.exec(raw);
  if (iso) return new Date(`${iso[1]}-${iso[2]}-${iso[3]}T00:00:00Z`);

  // European format (dd.mm.yyyy or dd/mm/yyyy)
  const euro = /^(\d{1,2})[.\/-](\d{1,2})[.\/-](\d{2,4})$/.exec(raw);
  if (euro) {
    let [, d, m, y] = euro;
    if (y.length === 2) y = (parseInt(y) > 50 ? "19" : "20") + y;
    return new Date(`${y}-${m.padStart(2, "0")}-${d.padStart(2, "0")}T00:00:00Z`);
  }

  return undefined;
}
