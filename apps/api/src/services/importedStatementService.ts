/**
 * Imported Statement Service
 *
 * Orchestrates the full pipeline for property manager PDF ingestion:
 *
 *   1. scanDocument()          — Azure OCR + Claude extraction
 *   2. detectBuilding()        — fuzzy-match building from PDF content
 *   3. createImportedStatement() — persist statement shell (status=PROCESSING → PENDING_REVIEW)
 *   4. matchAndCreateInvoices() — contractor/unit resolution + Invoice records
 *   5. matchAccountBalances()   — COA matching (exact code → fuzzy name → Claude → UNMATCHED)
 *   6. approveStatement()       — post ledger entries, flip status to APPROVED
 *   7. rejectStatement()        — flip status to REJECTED, no ledger posting
 *
 * Data only reaches the owner surface after step 6.
 */

import { v4 as uuidv4 } from "uuid";
import {
  PrismaClient,
  ImportedStatementStatus,
  StatementSectionType,
  MatchConfidence,
  InvoiceSourceChannel,
  InvoiceDirection,
  InvoiceStatus,
  IngestionStatus,
} from "@prisma/client";
import type { ExtractedAccountBalance, ExtractedInvoiceLine, ScanResult } from "./documentScanner";
import { scanDocument } from "./documentScan";
import { storage } from "../storage/attachments";
import { getAnthropicClient } from "./aiClient";
import { createInvoice } from "./invoices";
import { postJournalEntries } from "./ledgerService";
import * as accountRepo from "../repositories/accountRepository";
import * as crypto from "crypto";

/* ══════════════════════════════════════════════════════════════
   DTOs
   ══════════════════════════════════════════════════════════════ */

export interface UploadBatchDTO {
  id: string;
  orgId: string;
  sourceFileUrl: string;
  fileName: string;
  uploadedBy: string;
  createdAt: string;
  statements: ImportedStatementDTO[];
}

export interface ImportedStatementDTO {
  id: string;
  orgId: string;
  uploadBatchId: string | null;
  sectionType: StatementSectionType;
  buildingId: string | null;
  buildingName: string | null;
  fiscalYear: number;
  periodStart: string | null;
  periodEnd: string | null;
  status: ImportedStatementStatus;
  sourceFileUrl: string;
  uploadedBy: string;
  approvedBy: string | null;
  approvedAt: string | null;
  ocrConfidence: number | null;
  buildingMatchConfidence: MatchConfidence | null;
  notes: string | null;
  /** Raw OCR dump: summary + extracted fields JSON — for manager review */
  rawOcrText: string | null;
  accountBalances: ImportedAccountBalanceDTO[];
  /**
   * Accounting equation check: sum(DEBIT balances) − sum(CREDIT balances) in cents.
   * Zero means balanced; a non-zero value means the extraction is incomplete or contains errors.
   * Null when no account balances have been extracted yet.
   */
  balanceImbalanceCents: number | null;
  /** Invoices created from this statement (matched by sourceFileUrl) */
  linkedInvoices: LinkedInvoiceDTO[];
  createdAt: string;
  updatedAt: string;
}

export interface LinkedInvoiceDTO {
  id: string;
  description: string | null;
  recipientName: string | null;
  /** Amount in cents (same as Invoice.amount) */
  totalCents: number | null;
  currency: string | null;
  issueDate: string | null;
  status: string;
}

export interface ImportedAccountBalanceDTO {
  id: string;
  rawAccountCode: string;
  rawAccountName: string;
  balanceCents: number;
  balanceType: string;
  matchConfidence: MatchConfidence;
  accountId: string | null;
  accountName: string | null;
  accountCode: string | null;
}

/* ══════════════════════════════════════════════════════════════
   Ingest input
   ══════════════════════════════════════════════════════════════ */

export interface IngestStatementInput {
  buffer: Buffer;
  fileName: string;
  mimeType: string;
  orgId: string;
  /** Explicitly supplied buildingId — overrides PDF content detection */
  buildingId?: string;
  fiscalYear?: number;
  uploadedBy: string;
  /** Manager-supplied document type hint — bypasses auto-detection */
  hintDocType?: string;
}

/* ══════════════════════════════════════════════════════════════
   Error class
   ══════════════════════════════════════════════════════════════ */

export class ImportedStatementError extends Error {
  constructor(
    public readonly code: string,
    message: string,
  ) {
    super(message);
    this.name = "ImportedStatementError";
  }
}

/* ══════════════════════════════════════════════════════════════
   Building detection
   ══════════════════════════════════════════════════════════════ */

/**
 * Try to identify the building from PDF content by fuzzy-matching the
 * extracted building address against Building records in the org.
 * Returns { buildingId, confidence } or null when no match is found.
 */
export async function detectBuildingFromContent(
  prisma: PrismaClient,
  orgId: string,
  addressHint: string,
): Promise<{ buildingId: string; confidence: MatchConfidence } | null> {
  if (!addressHint.trim()) return null;

  const buildings = await prisma.building.findMany({
    where: { orgId, isActive: true },
    select: { id: true, name: true, address: true, city: true },
  });

  if (buildings.length === 0) return null;

  const normalised = addressHint.toLowerCase().replace(/[^a-z0-9]/g, " ").trim();

  // 1. Check if any building address is contained in or contains the hint
  for (const b of buildings) {
    const bAddr = (b.address + " " + (b.city ?? "")).toLowerCase().replace(/[^a-z0-9]/g, " ").trim();
    if (bAddr && (normalised.includes(bAddr) || bAddr.includes(normalised))) {
      return { buildingId: b.id, confidence: MatchConfidence.FUZZY };
    }
  }

  // 2. Word-overlap scoring
  const hintWords = new Set(normalised.split(/\s+/).filter((w) => w.length > 2));
  let bestScore = 0;
  let bestId: string | null = null;

  for (const b of buildings) {
    const bAddr = (b.address + " " + (b.name ?? "") + " " + (b.city ?? ""))
      .toLowerCase()
      .replace(/[^a-z0-9]/g, " ");
    const bWords = new Set(bAddr.split(/\s+/).filter((w) => w.length > 2));
    const overlap = [...hintWords].filter((w) => bWords.has(w)).length;
    const score = overlap / Math.max(hintWords.size, 1);
    if (score > bestScore) {
      bestScore = score;
      bestId = b.id;
    }
  }

  if (bestId && bestScore >= 0.5) {
    return { buildingId: bestId, confidence: MatchConfidence.FUZZY };
  }

  return null;
}

/* ══════════════════════════════════════════════════════════════
   COA account matching
   ══════════════════════════════════════════════════════════════ */

interface AccountRow {
  id: string;
  name: string;
  code: string | null;
}

/**
 * Match a single extracted account balance row to an Account in the org's COA.
 * Order: exact code → name fuzzy → Claude Haiku classification → UNMATCHED.
 */
async function matchAccount(
  orgAccounts: AccountRow[],
  rawCode: string,
  rawName: string,
  balanceCents: number,
): Promise<{ accountId: string | null; confidence: MatchConfidence }> {
  // 1. Exact code match
  const exactCode = orgAccounts.find(
    (a) => a.code && a.code.trim() === rawCode.trim(),
  );
  if (exactCode) return { accountId: exactCode.id, confidence: MatchConfidence.AUTO };

  // 2. Name fuzzy match (case-insensitive substring)
  const nameNorm = rawName.toLowerCase().trim();
  const fuzzy = orgAccounts.find(
    (a) =>
      a.name.toLowerCase().includes(nameNorm) ||
      nameNorm.includes(a.name.toLowerCase()),
  );
  if (fuzzy) return { accountId: fuzzy.id, confidence: MatchConfidence.FUZZY };

  // 3. Claude Haiku classification
  try {
    const client = getAnthropicClient();
    const accountList = orgAccounts
      .map((a) => `${a.code ?? "—"} | ${a.name}`)
      .join("\n");

    const response = await client.messages.create({
      model: "claude-haiku-4-5-20251001",
      max_tokens: 256,
      tools: [
        {
          name: "classifyAccount",
          description: "Pick the best matching account from the chart of accounts for a given expense/balance line.",
          input_schema: {
            type: "object" as const,
            required: ["accountCode", "confidence"],
            properties: {
              accountCode: { type: "string", description: "The code of the best matching account, exactly as listed" },
              confidence:  { type: "number", description: "Confidence 0–1 that this is the correct account" },
            },
          },
        },
      ],
      tool_choice: { type: "any" },
      messages: [
        {
          role: "user",
          content:
            `Match this account line to the closest account in the chart of accounts below.\n\n` +
            `Account line: "${rawCode} ${rawName}" (balance: CHF ${(balanceCents / 100).toFixed(2)})\n\n` +
            `Chart of accounts (code | name):\n${accountList}\n\n` +
            `Return the account code and your confidence (0–1). If no reasonable match exists, return confidence 0.`,
        },
      ],
    });

    const toolUse = response.content.find((b) => b.type === "tool_use");
    if (toolUse && toolUse.type === "tool_use") {
      const input = toolUse.input as { accountCode: string; confidence: number };
      if (input.confidence >= 0.85) {
        const matched = orgAccounts.find((a) => a.code === input.accountCode);
        if (matched) return { accountId: matched.id, confidence: MatchConfidence.CLAUDE };
      }
    }
  } catch {
    // Claude unavailable — fall through to UNMATCHED
  }

  return { accountId: null, confidence: MatchConfidence.UNMATCHED };
}

/* ══════════════════════════════════════════════════════════════
   Unit + Contractor resolution
   ══════════════════════════════════════════════════════════════ */

async function resolveUnitFromLine(
  prisma: PrismaClient,
  orgId: string,
  buildingId: string,
  unitHint: string | null | undefined,
  tenantHint: string | null | undefined,
): Promise<{ unitId: string | null; confidence: "matched" | "unmatched" }> {
  if (!unitHint && !tenantHint) return { unitId: null, confidence: "unmatched" };

  const units = await prisma.unit.findMany({
    where: { buildingId, orgId, isActive: true },
    include: {
      occupancies: {
        include: { tenant: { select: { name: true } } },
      },
    },
  });

  // Try unit number match first
  if (unitHint) {
    const normalised = unitHint.replace(/[^a-z0-9]/gi, "").toLowerCase();
    const matched = units.find(
      (u) => u.unitNumber.replace(/[^a-z0-9]/gi, "").toLowerCase() === normalised,
    );
    if (matched) return { unitId: matched.id, confidence: "matched" };
  }

  // Try tenant name match
  if (tenantHint) {
    const normalised = tenantHint.toLowerCase();
    for (const u of units) {
      const tenantMatch = u.occupancies.some(
        (o) => o.tenant.name.toLowerCase().includes(normalised) || normalised.includes(o.tenant.name.toLowerCase()),
      );
      if (tenantMatch) return { unitId: u.id, confidence: "matched" };
    }
  }

  return { unitId: null, confidence: "unmatched" };
}

async function resolveContractorFromLine(
  prisma: PrismaClient,
  orgId: string,
  vendorName: string | null | undefined,
): Promise<{ contractorId: string | null; isNew: boolean }> {
  if (!vendorName?.trim()) return { contractorId: null, isNew: false };

  const normalised = vendorName.trim().toLowerCase();

  // Exact match
  const exact = await prisma.contractor.findFirst({
    where: { orgId, name: { equals: vendorName.trim(), mode: "insensitive" }, isActive: true },
  });
  if (exact) return { contractorId: exact.id, isNew: false };

  // Partial match
  const partial = await prisma.contractor.findFirst({
    where: {
      orgId,
      isActive: true,
      OR: [
        { name: { contains: normalised, mode: "insensitive" } },
        { name: { contains: vendorName.trim().split(/\s+/)[0], mode: "insensitive" } },
      ],
    },
  });
  if (partial) return { contractorId: partial.id, isNew: false };

  // Create a stub contractor — inactive, pending manual review
  const created = await prisma.contractor.create({
    data: {
      orgId,
      name: vendorName.trim(),
      phone: "pending",
      email: "",
      hourlyRate: 0,
      serviceCategories: "",
      isActive: false, // marked inactive until manager reviews
    },
  });
  console.log(`[IMPORT] Created stub contractor "${vendorName}" (id=${created.id}) — pending review`);
  return { contractorId: created.id, isNew: true };
}

/* ══════════════════════════════════════════════════════════════
   Main ingest pipeline
   ══════════════════════════════════════════════════════════════ */

export async function ingestStatement(
  prisma: PrismaClient,
  input: IngestStatementInput,
): Promise<UploadBatchDTO> {
  const { buffer, fileName, mimeType, orgId, uploadedBy, hintDocType } = input;

  // 1. Store the source file
  const fileKey = `imported-statements/${orgId}/${Date.now()}-${crypto.randomBytes(4).toString("hex")}/${fileName}`;
  await storage.put(fileKey, buffer);

  // 2. Validate explicit buildingId if supplied
  let buildingId = input.buildingId ?? null;
  if (buildingId) {
    const building = await prisma.building.findFirst({ where: { id: buildingId, orgId } });
    if (!building) throw new ImportedStatementError("BUILDING_NOT_FOUND", "Building not found");
  }

  const fiscalYear = input.fiscalYear ?? new Date().getFullYear();

  // 3. Create the UploadBatch — one per PDF upload
  const batch = await prisma.uploadBatch.create({
    data: { orgId, sourceFileUrl: fileKey, fileName, uploadedBy },
  });

  // 4. Create one placeholder ImportedStatement per expected section type so the
  //    UI can show "processing" immediately. The background job will either
  //    populate these or create/delete as it discovers the actual sections.
  //    For now we create a single BALANCE_SHEET placeholder; the background job
  //    will create additional section statements as it classifies pages.
  const placeholder = await prisma.importedStatement.create({
    data: {
      orgId,
      uploadBatchId: batch.id,
      sectionType: StatementSectionType.BALANCE_SHEET,
      buildingId,
      fiscalYear,
      periodStart: new Date(`${fiscalYear}-01-01T00:00:00Z`),
      periodEnd:   new Date(`${fiscalYear}-12-31T00:00:00Z`),
      status: ImportedStatementStatus.PROCESSING,
      sourceFileUrl: fileKey,
      uploadedBy,
      buildingMatchConfidence: buildingId ? MatchConfidence.MANUAL : null,
    },
    include: {
      building: { select: { name: true } },
      accountBalances: { include: { account: { select: { name: true, code: true } } } },
    },
  });

  // 5. Kick off background processing (non-blocking — response already sent)
  setImmediate(() => {
    runIngestionBackground(
      prisma, batch.id, placeholder.id, orgId, buffer, fileName, mimeType,
      fiscalYear, buildingId, fileKey, hintDocType,
    ).catch((err) => {
      console.error(`[IMPORT] Unhandled error in background ingestion for batch ${batch.id}:`, err);
    });
  });

  return mapBatchDTO(batch, [placeholder]);
}

/**
 * Heavy ingestion work: OCR scan → section classification → per-section statement creation.
 * Creates one ImportedStatement per detected section (BALANCE_SHEET, INCOME_STATEMENT, INVOICES).
 * The placeholder statement created by ingestStatement() is reused for the first financial section.
 */
async function runIngestionBackground(
  prisma: PrismaClient,
  batchId: string,
  placeholderStatementId: string,
  orgId: string,
  buffer: Buffer,
  fileName: string,
  mimeType: string,
  fiscalYear: number,
  buildingId: string | null,
  fileKey: string,
  hintDocType: string | undefined,
): Promise<void> {
  const markPlaceholderFailed = async (msg: string) => {
    try {
      await prisma.importedStatement.update({
        where: { id: placeholderStatementId },
        data: { status: ImportedStatementStatus.PENDING_REVIEW, notes: `Processing error: ${msg}` },
      });
    } catch { /* best-effort */ }
  };

  try {
    // 1. Scan document (OCR + Claude extraction)
    console.log(`[IMPORT] [bg] batch=${batchId} Scanning "${fileName}" size=${buffer.length}${hintDocType ? ` hint=${hintDocType}` : ""}`);
    const scanResult: ScanResult = await scanDocument(buffer, fileName, mimeType, hintDocType);
    console.log(
      `[IMPORT] [bg] Scan complete: docType=${scanResult.docType} confidence=${scanResult.confidence} ` +
      `balances=${scanResult.accountBalances?.length ?? 0} invoices=${scanResult.invoiceLines?.length ?? 0}`,
    );

    // 2. Detect building once — shared across all sections
    let finalBuildingId = buildingId;
    let finalBuildingMatchConf: MatchConfidence | null = buildingId ? MatchConfidence.MANUAL : null;
    if (!finalBuildingId) {
      const structuredAddress =
        (scanResult.fields.buildingAddress as string | null) ??
        (scanResult.fields.address as string | null);
      const ocrAddress = structuredAddress ?? extractAddressFromText(
        (scanResult.fields._rawTextPreview as string | null) ?? "",
      );
      if (ocrAddress) {
        const detected = await detectBuildingFromContent(prisma, orgId, ocrAddress);
        if (detected) {
          finalBuildingId = detected.buildingId;
          finalBuildingMatchConf = detected.confidence;
          console.log(`[IMPORT] [bg] Building auto-detected: id=${finalBuildingId} conf=${finalBuildingMatchConf}`);
        }
      }
      if (!finalBuildingId) console.log("[IMPORT] [bg] Building not identified — manager must assign.");
    }

    // 3. Parse period
    const detectedFiscalYear =
      (typeof scanResult.fields.fiscalYear === "number" ? scanResult.fields.fiscalYear : null) ?? fiscalYear;
    const periodLabel = scanResult.fields.periodLabel as string | null ?? null;
    const { periodStart, periodEnd } = parsePeriodLabel(periodLabel, detectedFiscalYear);
    const rawOcrText = truncate(scanResult.summary + "\n---\n" + JSON.stringify(scanResult.fields), 8000);

    const commonStatementData = {
      buildingId: finalBuildingId,
      buildingMatchConfidence: finalBuildingMatchConf,
      fiscalYear: detectedFiscalYear,
      periodStart,
      periodEnd,
      ocrConfidence: scanResult.confidence,
      rawOcrText,
      status: ImportedStatementStatus.PENDING_REVIEW,
    };

    const orgAccounts = await accountRepo.findAccountsByOrg(prisma, orgId);

    // 4. Classify accounts into balance-sheet vs income-statement by account code prefix.
    //    Swiss chart of accounts: 1xxx–2xxx = balance sheet, 3xxx–8xxx = income statement.
    const allBalances = scanResult.accountBalances ?? [];
    const bsBalances = allBalances.filter((b) => isBalanceSheetAccount(b.rawAccountCode));
    const isBalances = allBalances.filter((b) => !isBalanceSheetAccount(b.rawAccountCode));

    // 5. Populate the placeholder statement as BALANCE_SHEET (or INCOME_STATEMENT if no BS rows)
    const firstSectionType = bsBalances.length > 0 || isBalances.length === 0
      ? StatementSectionType.BALANCE_SHEET
      : StatementSectionType.INCOME_STATEMENT;
    const firstSectionBalances = firstSectionType === StatementSectionType.BALANCE_SHEET ? bsBalances : isBalances;

    await prisma.importedStatement.update({
      where: { id: placeholderStatementId },
      data: { ...commonStatementData, sectionType: firstSectionType },
    });

    if (firstSectionBalances.length > 0) {
      await persistBalances(prisma, orgId, placeholderStatementId, firstSectionBalances, orgAccounts);
    }

    // 6. Create a separate INCOME_STATEMENT record if we have both section types
    if (bsBalances.length > 0 && isBalances.length > 0) {
      const isStatement = await prisma.importedStatement.create({
        data: {
          orgId,
          uploadBatchId: batchId,
          sectionType: StatementSectionType.INCOME_STATEMENT,
          sourceFileUrl: fileKey,
          uploadedBy: (await prisma.uploadBatch.findFirst({ where: { id: batchId }, select: { uploadedBy: true } }))?.uploadedBy ?? "",
          ...commonStatementData,
        },
      });
      await persistBalances(prisma, orgId, isStatement.id, isBalances, orgAccounts);
      console.log(`[IMPORT] [bg] Created INCOME_STATEMENT section: id=${isStatement.id} rows=${isBalances.length}`);
    }

    // 7. Create Invoice records from extracted invoice lines
    const invoiceLines = scanResult.invoiceLines ?? [];
    if (invoiceLines.length > 0) {
      // Create a dedicated INVOICES section statement to group them
      let invoiceStatementId: string | null = null;
      if (finalBuildingId) {
        const uploader = (await prisma.uploadBatch.findFirst({ where: { id: batchId }, select: { uploadedBy: true } }))?.uploadedBy ?? "";
        const invStatement = await prisma.importedStatement.create({
          data: {
            orgId,
            uploadBatchId: batchId,
            sectionType: StatementSectionType.INVOICES,
            sourceFileUrl: fileKey,
            uploadedBy: uploader,
            ...commonStatementData,
          },
        });
        invoiceStatementId = invStatement.id;
        console.log(`[IMPORT] [bg] Created INVOICES section: id=${invStatement.id}`);
      }

      for (const line of invoiceLines) {
        try {
          await resolveUnitFromLine(prisma, orgId, finalBuildingId ?? "", line.unitHint, line.tenantHint);
          await resolveContractorFromLine(prisma, orgId, line.vendorName);

          const totalChf    = line.totalAmount ?? null;
          const vatChf      = line.vatAmount   ?? null;
          const subtotalChf = line.subtotal    ?? null;
          let netAmount: number | undefined;
          if (subtotalChf != null)                     netAmount = subtotalChf;
          else if (totalChf != null && vatChf != null) netAmount = totalChf - vatChf;
          else                                          netAmount = totalChf ?? undefined;

          await createInvoice({
            orgId,
            direction: InvoiceDirection.INCOMING,
            sourceChannel: InvoiceSourceChannel.BROWSER_UPLOAD,
            ingestionStatus: IngestionStatus.PENDING_REVIEW,
            rawOcrText: truncate(JSON.stringify(line), 4000),
            ocrConfidence: scanResult.confidence,
            sourceFileUrl: fileKey,
            amount: netAmount,
            description: line.description ?? `[Imported] ${line.vendorName ?? "Invoice"}`,
            recipientName: line.vendorName ?? undefined,
            iban: line.iban ?? undefined,
            paymentReference: line.paymentReference ?? undefined,
            currency: line.currency ?? undefined,
            vatRate: vatChf != null && netAmount ? Math.round((vatChf / netAmount) * 10000) / 100 : 0,
            issueDate: line.invoiceDate ? parseDateField(line.invoiceDate) : undefined,
            dueDate:   line.dueDate     ? parseDateField(line.dueDate)     : undefined,
            matchedJobId:      undefined,
            matchedLeaseId:    undefined,
            matchedBuildingId: finalBuildingId ?? undefined,
          });
        } catch (lineErr) {
          console.warn(`[IMPORT] [bg] Failed to create invoice for "${line.vendorName}":`, lineErr);
        }
      }

      // Mark the INVOICES section as PENDING_REVIEW if created
      if (invoiceStatementId) {
        await prisma.importedStatement.update({
          where: { id: invoiceStatementId },
          data: { status: ImportedStatementStatus.PENDING_REVIEW },
        });
      }
      console.log(`[IMPORT] [bg] Processed ${invoiceLines.length} invoice line(s)`);
    }

  } catch (err) {
    const errorMsg = err instanceof Error ? err.message : String(err);
    console.error(`[IMPORT] [bg] Processing failed for batch ${batchId}: ${errorMsg}`);
    await markPlaceholderFailed(errorMsg);
  }
}

/**
 * Returns true for balance-sheet account codes.
 * Swiss Kontenrahmen KMU:
 *   1xxx = Assets (Aktiven)        → balance sheet
 *   2xxx = Liabilities/Equity      → balance sheet
 *   3xxx = Revenue (Nettoerlöse)   → income statement  ← NOT balance sheet
 *   4xxx–8xxx = Expenses           → income statement
 */
function isBalanceSheetAccount(code: string): boolean {
  const trimmed = code.trim().replace(/\D/g, "");
  if (!trimmed) return true; // default to balance sheet when unknown
  const first = parseInt(trimmed[0], 10);
  return first >= 1 && first <= 2;
}

/** Match and persist a set of extracted account balances for a statement. */
async function persistBalances(
  prisma: PrismaClient,
  orgId: string,
  statementId: string,
  balances: ExtractedAccountBalance[],
  orgAccounts: Awaited<ReturnType<typeof accountRepo.findAccountsByOrg>>,
): Promise<void> {
  const rows = await Promise.all(
    balances.map(async (ab) => {
      const balanceCents = Math.round(ab.balanceChf * 100);
      const match = await matchAccount(orgAccounts, ab.rawAccountCode, ab.rawAccountName, balanceCents);
      return {
        orgId,
        statementId,
        accountId: match.accountId,
        rawAccountCode: ab.rawAccountCode,
        rawAccountName: ab.rawAccountName,
        balanceCents,
        balanceType: ab.balanceType,
        matchConfidence: match.confidence,
      };
    }),
  );
  await prisma.importedAccountBalance.createMany({ data: rows });
  console.log(`[IMPORT] [bg] Persisted ${rows.length} balance row(s) for statement ${statementId}`);
}

/* ══════════════════════════════════════════════════════════════
   Approval workflow
   ══════════════════════════════════════════════════════════════ */

export async function approveStatement(
  prisma: PrismaClient,
  statementId: string,
  orgId: string,
  approvedBy: string,
): Promise<ImportedStatementDTO> {
  const statement = await prisma.importedStatement.findFirst({
    where: { id: statementId, orgId },
    include: {
      building: { select: { name: true } },
      accountBalances: { include: { account: { select: { name: true, code: true } } } },
    },
  });

  if (!statement) throw new ImportedStatementError("NOT_FOUND", "Statement not found");
  if (statement.status !== ImportedStatementStatus.PENDING_REVIEW) {
    throw new ImportedStatementError("INVALID_STATUS", `Statement is ${statement.status} — only PENDING_REVIEW statements can be approved`);
  }
  if (!statement.buildingId) {
    throw new ImportedStatementError("BUILDING_REQUIRED", "A building must be assigned before this statement can be approved");
  }

  const isIncomeStatement = statement.sectionType === StatementSectionType.INCOME_STATEMENT;

  // For income statements: check whether the building already has ledger activity for this
  // fiscal year. If yes, store as reference-only (no journal entries). The manager can see
  // the data for comparison but the existing ledger is the authoritative source.
  let referenceOnly = false;
  if (isIncomeStatement) {
    const periodStart = statement.periodStart ?? new Date(`${statement.fiscalYear}-01-01T00:00:00Z`);
    const periodEnd   = statement.periodEnd   ?? new Date(`${statement.fiscalYear}-12-31T00:00:00Z`);
    const existingActivity = await prisma.ledgerEntry.count({
      where: {
        orgId,
        buildingId: statement.buildingId,
        date: { gte: periodStart, lte: periodEnd },
        sourceType: { not: "IMPORTED_STATEMENT" },
      },
    });
    if (existingActivity > 0) {
      referenceOnly = true;
      console.log(
        `[IMPORT] Income statement ${statementId} approved as REFERENCE ONLY — ` +
        `${existingActivity} existing ledger entries found for FY${statement.fiscalYear}`,
      );
    }
  }

  if (!referenceOnly) {
    // Resolve an accountId for every balance row.
    // For rows already matched (AUTO / FUZZY / CLAUDE / MANUAL) use the stored accountId.
    // For UNMATCHED rows, find an existing account by code or name, or auto-create a stub
    // so that every balance line always produces a ledger entry on approval.
    const periodDate = statement.periodEnd ?? statement.periodStart ?? new Date();

    const legs: Array<{
      accountId: string;
      debitCents: number;
      creditCents: number;
      description: string;
      reference: string;
      sourceType: string;
      sourceId: string;
      buildingId: string | null;
      date: Date;
    }> = [];

    let autoCreated = 0;
    let alreadyMatched = 0;

    for (const ab of statement.accountBalances) {
      let resolvedAccountId = ab.accountId ?? null;

      if (!resolvedAccountId) {
        // Try to find an existing account by code first, then by name
        const byCode = await prisma.account.findFirst({
          where: { orgId, code: ab.rawAccountCode.trim() },
        });

        if (byCode) {
          resolvedAccountId = byCode.id;
          await prisma.importedAccountBalance.update({
            where: { id: ab.id },
            data: { accountId: byCode.id, matchConfidence: MatchConfidence.AUTO },
          });
        } else {
          // Auto-create a stub account using Swiss code-range convention for account type
          const code = ab.rawAccountCode.trim();
          const firstDigit = parseInt(code[0] ?? "4", 10);
          const accountType =
            firstDigit === 1 ? "ASSET"
            : firstDigit === 2 ? "LIABILITY"
            : firstDigit === 3 ? "REVENUE"
            : "EXPENSE";

          const safeName = `${ab.rawAccountName} (${code})`;
          let created: { id: string };
          try {
            created = await prisma.account.create({
              data: { orgId, name: safeName, code, accountType },
            });
          } catch {
            const fallback = await prisma.account.findFirst({ where: { orgId, code } });
            if (!fallback) throw new Error(`Could not find or create account ${code}`);
            created = fallback;
          }
          resolvedAccountId = created.id;
          await prisma.importedAccountBalance.update({
            where: { id: ab.id },
            data: { accountId: created.id, matchConfidence: MatchConfidence.AUTO },
          });
          autoCreated++;
        }
      } else {
        alreadyMatched++;
      }

      legs.push({
        accountId: resolvedAccountId,
        debitCents:  ab.balanceType === "DEBIT"  ? ab.balanceCents : 0,
        creditCents: ab.balanceType === "CREDIT" ? ab.balanceCents : 0,
        description: `[Import FY${statement.fiscalYear}] ${ab.rawAccountCode} ${ab.rawAccountName}`,
        reference:   `Statement FY${statement.fiscalYear}`,
        sourceType:  "IMPORTED_STATEMENT",
        sourceId:    statement.id,
        buildingId:  statement.buildingId,
        date:        periodDate,
      });
    }

    if (legs.length > 0) {
      await postJournalEntries(prisma, orgId, legs);
      console.log(
        `[IMPORT] Posted ${legs.length} ledger entries for statement ${statementId} ` +
        `(${alreadyMatched} pre-matched, ${autoCreated} auto-created accounts)`,
      );
    } else {
      console.warn(`[IMPORT] No account balances found for statement ${statementId} — nothing posted`);
    }
  }

  // Confirm all PENDING_REVIEW invoices linked to this source file (INVOICES section only)
  if (statement.sectionType === StatementSectionType.INVOICES) {
    await prisma.invoice.updateMany({
      where: {
        orgId,
        sourceFileUrl: statement.sourceFileUrl,
        ingestionStatus: IngestionStatus.PENDING_REVIEW,
      },
      data: {
        ingestionStatus: IngestionStatus.CONFIRMED,
        status: InvoiceStatus.ISSUED,
      },
    });
  }

  // Mark statement approved; record whether this was reference-only
  const approvalNotes = referenceOnly
    ? `Approved as reference only — existing ledger activity found for FY${statement.fiscalYear}. No journal entries posted.`
    : null;

  const updated = await prisma.importedStatement.update({
    where: { id: statementId },
    data: {
      status: ImportedStatementStatus.APPROVED,
      approvedBy,
      approvedAt: new Date(),
      ...(approvalNotes ? { notes: approvalNotes } : {}),
    },
    include: {
      building: { select: { name: true } },
      accountBalances: { include: { account: { select: { name: true, code: true } } } },
    },
  });

  return mapDTO(updated);
}

export async function rejectStatement(
  prisma: PrismaClient,
  statementId: string,
  orgId: string,
  notes?: string,
): Promise<ImportedStatementDTO> {
  const statement = await prisma.importedStatement.findFirst({
    where: { id: statementId, orgId },
  });
  if (!statement) throw new Error("STATEMENT_NOT_FOUND");
  if (statement.status !== ImportedStatementStatus.PENDING_REVIEW) {
    throw new Error(`INVALID_STATUS: statement is ${statement.status}`);
  }

  const updated = await prisma.importedStatement.update({
    where: { id: statementId },
    data: {
      status: ImportedStatementStatus.REJECTED,
      ...(notes ? { notes } : {}),
    },
    include: {
      building: { select: { name: true } },
      accountBalances: { include: { account: { select: { name: true, code: true } } } },
    },
  });

  return mapDTO(updated);
}

/* ══════════════════════════════════════════════════════════════
   List / get
   ══════════════════════════════════════════════════════════════ */

const STATEMENT_INCLUDE = {
  building: { select: { name: true } },
  accountBalances: { include: { account: { select: { name: true, code: true } } } },
} as const;

export async function listBatches(
  prisma: PrismaClient,
  orgId: string,
  opts: { limit?: number; offset?: number } = {},
): Promise<{ data: UploadBatchDTO[]; total: number }> {
  const [batches, total] = await Promise.all([
    prisma.uploadBatch.findMany({
      where: { orgId },
      orderBy: { createdAt: "desc" },
      take: opts.limit ?? 50,
      skip: opts.offset ?? 0,
      include: {
        statements: { include: STATEMENT_INCLUDE, orderBy: { sectionType: "asc" } },
      },
    }),
    prisma.uploadBatch.count({ where: { orgId } }),
  ]);
  return { data: batches.map((b) => mapBatchDTO(b, b.statements)), total };
}

export async function listStatements(
  prisma: PrismaClient,
  orgId: string,
  opts: {
    buildingId?: string;
    status?: ImportedStatementStatus;
    fiscalYear?: number;
    limit?: number;
    offset?: number;
  } = {},
): Promise<{ data: ImportedStatementDTO[]; total: number }> {
  const where = {
    orgId,
    ...(opts.buildingId ? { buildingId: opts.buildingId } : {}),
    ...(opts.status ? { status: opts.status } : {}),
    ...(opts.fiscalYear ? { fiscalYear: opts.fiscalYear } : {}),
  };

  const [items, total] = await Promise.all([
    prisma.importedStatement.findMany({
      where,
      orderBy: { createdAt: "desc" },
      take: opts.limit ?? 50,
      skip: opts.offset ?? 0,
      include: {
        building: { select: { name: true } },
        accountBalances: { include: { account: { select: { name: true, code: true } } } },
      },
    }),
    prisma.importedStatement.count({ where }),
  ]);

  return { data: items.map((s) => mapDTO(s)), total };
}

export async function getStatement(
  prisma: PrismaClient,
  statementId: string,
  orgId: string,
): Promise<ImportedStatementDTO | null> {
  const s = await prisma.importedStatement.findFirst({
    where: { id: statementId, orgId },
    include: {
      building: { select: { name: true } },
      accountBalances: { include: { account: { select: { name: true, code: true } } } },
    },
  });
  if (!s) return null;

  const linkedInvoices = await prisma.invoice.findMany({
    where: { orgId, sourceFileUrl: s.sourceFileUrl },
    select: {
      id: true,
      description: true,
      recipientName: true,
      amount: true,
      currency: true,
      issueDate: true,
      status: true,
    },
    orderBy: { createdAt: "asc" },
  });

  return mapDTO(s, linkedInvoices);
}

/** Assign (or reassign) the building for a PENDING_REVIEW statement. */
export async function assignBuilding(
  prisma: PrismaClient,
  statementId: string,
  orgId: string,
  buildingId: string,
): Promise<ImportedStatementDTO> {
  const building = await prisma.building.findFirst({ where: { id: buildingId, orgId } });
  if (!building) throw new ImportedStatementError("BUILDING_NOT_FOUND", "Building not found in this org");

  const updated = await prisma.importedStatement.updateMany({
    where: { id: statementId, orgId, status: ImportedStatementStatus.PENDING_REVIEW },
    data: { buildingId, buildingMatchConfidence: MatchConfidence.MANUAL },
  });
  if (updated.count === 0) {
    throw new ImportedStatementError("NOT_FOUND", "Statement not found or not in PENDING_REVIEW status");
  }

  const s = await prisma.importedStatement.findUniqueOrThrow({
    where: { id: statementId },
    include: {
      building: { select: { name: true } },
      accountBalances: { include: { account: { select: { name: true, code: true } } } },
    },
  });
  return mapDTO(s);
}

/** Permanently delete a single imported statement and its related ledger entries. */
export async function deleteStatement(
  prisma: PrismaClient,
  statementId: string,
  orgId: string,
): Promise<void> {
  const statement = await prisma.importedStatement.findFirst({
    where: { id: statementId, orgId },
  });
  if (!statement) throw new ImportedStatementError("NOT_FOUND", "Statement not found");
  // LedgerEntry has no FK cascade to ImportedStatement — delete orphans first.
  await prisma.ledgerEntry.deleteMany({
    where: { orgId, sourceType: "IMPORTED_STATEMENT", sourceId: statementId },
  });
  // Deletes statement + cascades to ImportedAccountBalance.
  await prisma.importedStatement.delete({ where: { id: statementId } });
}

/** Permanently delete ALL imported statements for an org. Returns the count deleted. */
export async function deleteAllStatements(
  prisma: PrismaClient,
  orgId: string,
): Promise<number> {
  const rows = await prisma.importedStatement.findMany({
    where: { orgId },
    select: { id: true },
  });
  if (rows.length === 0) return 0;
  const ids = rows.map((r) => r.id);
  await prisma.ledgerEntry.deleteMany({
    where: { orgId, sourceType: "IMPORTED_STATEMENT", sourceId: { in: ids } },
  });
  await prisma.importedStatement.deleteMany({ where: { orgId } });
  return ids.length;
}

/* ══════════════════════════════════════════════════════════════
   Ledger preview (dry-run — no side effects)
   ══════════════════════════════════════════════════════════════ */

export interface LedgerPreviewEntry {
  balanceId: string;
  rawAccountCode: string;
  rawAccountName: string;
  /** Existing accountId if already resolved, null if would be auto-created */
  accountId: string | null;
  accountName: string | null;
  /** True when no existing account was found — approval would auto-create one */
  willAutoCreate: boolean;
  debitCents: number;
  creditCents: number;
  description: string;
}

export interface LedgerPreviewDTO {
  entries: LedgerPreviewEntry[];
  totalDebitCents: number;
  totalCreditCents: number;
  /** Rows where an account exists (already matched or findable by code) */
  matchedCount: number;
  /** Rows where approval would auto-create a new COA account */
  autoCreateCount: number;
}

/**
 * Dry-run the approval account-resolution step.
 * Returns what journal entries WOULD be posted without committing anything.
 */
export async function getLedgerPreview(
  prisma: PrismaClient,
  statementId: string,
  orgId: string,
): Promise<LedgerPreviewDTO> {
  const statement = await prisma.importedStatement.findFirst({
    where: { id: statementId, orgId },
    include: {
      accountBalances: { include: { account: { select: { name: true, code: true } } } },
    },
  });
  if (!statement) throw new ImportedStatementError("NOT_FOUND", "Statement not found");

  const periodDate = statement.periodEnd ?? statement.periodStart ?? new Date();
  const entries: LedgerPreviewEntry[] = [];
  let matchedCount = 0;
  let autoCreateCount = 0;

  for (const ab of statement.accountBalances) {
    let accountId: string | null = ab.accountId ?? null;
    let accountName: string | null = ab.account?.name ?? null;
    let willAutoCreate = false;

    if (!accountId) {
      // Check if an account with this code exists — same logic as approveStatement
      const byCode = await prisma.account.findFirst({
        where: { orgId, code: ab.rawAccountCode.trim() },
        select: { id: true, name: true },
      });
      if (byCode) {
        accountId = byCode.id;
        accountName = byCode.name;
        matchedCount++;
      } else {
        // Would be auto-created on approval
        willAutoCreate = true;
        accountName = `${ab.rawAccountName} (${ab.rawAccountCode.trim()})`;
        autoCreateCount++;
      }
    } else {
      matchedCount++;
    }

    entries.push({
      balanceId: ab.id,
      rawAccountCode: ab.rawAccountCode,
      rawAccountName: ab.rawAccountName,
      accountId,
      accountName,
      willAutoCreate,
      debitCents:  ab.balanceType === "DEBIT"  ? ab.balanceCents : 0,
      creditCents: ab.balanceType === "CREDIT" ? ab.balanceCents : 0,
      description: `[Import FY${statement.fiscalYear}] ${ab.rawAccountCode} ${ab.rawAccountName}`,
    });
  }

  const totalDebitCents  = entries.reduce((s, e) => s + e.debitCents,  0);
  const totalCreditCents = entries.reduce((s, e) => s + e.creditCents, 0);

  return { entries, totalDebitCents, totalCreditCents, matchedCount, autoCreateCount };
}

/* ══════════════════════════════════════════════════════════════
   Re-extraction (re-run scanner on the already-stored file)
   ══════════════════════════════════════════════════════════════ */

/**
 * Wipe all statements in the batch, reset the placeholder, and re-run the
 * full sectioned pipeline from the stored file.
 */
export async function reExtractStatement(
  prisma: PrismaClient,
  statementId: string,
  orgId: string,
  hintDocType: string,
): Promise<ImportedStatementDTO> {
  const statement = await prisma.importedStatement.findFirst({
    where: { id: statementId, orgId },
    include: {
      building: { select: { name: true } },
      accountBalances: { include: { account: { select: { name: true, code: true } } } },
    },
  });
  if (!statement) throw new ImportedStatementError("NOT_FOUND", "Statement not found");
  if (statement.status === ImportedStatementStatus.APPROVED) {
    throw new ImportedStatementError("INVALID_STATUS", "Approved statements cannot be re-extracted");
  }

  let buffer: Buffer;
  try {
    buffer = await storage.get(statement.sourceFileUrl);
  } catch {
    throw new ImportedStatementError("FILE_NOT_FOUND", "Source file could not be retrieved from storage");
  }

  // If this statement belongs to a batch, wipe all sibling sections (except APPROVED ones)
  // so the re-extraction starts clean.
  if (statement.uploadBatchId) {
    const siblings = await prisma.importedStatement.findMany({
      where: {
        uploadBatchId: statement.uploadBatchId,
        orgId,
        id: { not: statementId },
        status: { not: ImportedStatementStatus.APPROVED },
      },
      select: { id: true },
    });
    for (const sib of siblings) {
      await prisma.importedAccountBalance.deleteMany({ where: { statementId: sib.id } });
      await prisma.importedStatement.delete({ where: { id: sib.id } });
    }
  }

  // Reset this statement as the placeholder for the new run
  await prisma.importedAccountBalance.deleteMany({ where: { statementId } });
  const reset = await prisma.importedStatement.update({
    where: { id: statementId },
    data: {
      sectionType: StatementSectionType.BALANCE_SHEET,
      status: ImportedStatementStatus.PROCESSING,
      rawOcrText: null,
      ocrConfidence: null,
      notes: null,
    },
    include: {
      building: { select: { name: true } },
      accountBalances: { include: { account: { select: { name: true, code: true } } } },
    },
  });

  const fileName = statement.sourceFileUrl.split("/").pop() ?? "document.pdf";
  const mimeType = fileName.endsWith(".pdf") ? "application/pdf" : "application/octet-stream";
  const batchId = statement.uploadBatchId ?? statementId; // fallback: treat statement itself as batch key

  setImmediate(() => {
    runIngestionBackground(
      prisma, batchId, statementId, orgId, buffer, fileName, mimeType,
      statement.fiscalYear, statement.buildingId, statement.sourceFileUrl, hintDocType,
    ).catch((err) => {
      console.error(`[IMPORT] Unhandled error in re-extraction for ${statementId}:`, err);
    });
  });

  return mapDTO(reset);
}

/**
 * Delete a single balance row. Only allowed on PENDING_REVIEW statements.
 */
export async function deleteAccountBalance(
  prisma: PrismaClient,
  balanceId: string,
  orgId: string,
): Promise<void> {
  const existing = await prisma.importedAccountBalance.findFirst({
    where: { id: balanceId, orgId },
    include: { statement: { select: { status: true } } },
  });
  if (!existing) throw new ImportedStatementError("NOT_FOUND", "Balance row not found");
  if (existing.statement.status !== ImportedStatementStatus.PENDING_REVIEW) {
    throw new ImportedStatementError(
      "INVALID_STATUS",
      "Only balance rows on PENDING_REVIEW statements can be deleted",
    );
  }
  await prisma.importedAccountBalance.delete({ where: { id: balanceId } });
}

/**
 * Return a single upload batch with its child statements.
 * Used by the detail page to render the sibling-section navigation bar.
 */
export async function getBatch(
  prisma: PrismaClient,
  batchId: string,
  orgId: string,
): Promise<UploadBatchDTO | null> {
  const batch = await prisma.uploadBatch.findFirst({
    where: { id: batchId, orgId },
    include: {
      statements: { include: STATEMENT_INCLUDE, orderBy: { sectionType: "asc" } },
    },
  });
  if (!batch) return null;
  return mapBatchDTO(batch, batch.statements);
}

/**
 * Update fields on an existing balance row.
 * Any combination of accountId, balanceCents, and balanceType may be supplied.
 * Setting accountId always flips matchConfidence to MANUAL.
 */
export async function updateAccountBalance(
  prisma: PrismaClient,
  balanceId: string,
  orgId: string,
  update: {
    accountId?: string;
    balanceCents?: number;
    balanceType?: string;
  },
): Promise<void> {
  const data: Record<string, unknown> = {};
  if (update.accountId !== undefined) {
    data.accountId = update.accountId;
    data.matchConfidence = MatchConfidence.MANUAL;
  }
  if (update.balanceCents !== undefined) data.balanceCents = update.balanceCents;
  if (update.balanceType !== undefined) data.balanceType = update.balanceType;
  await prisma.importedAccountBalance.updateMany({
    where: { id: balanceId, orgId },
    data,
  });
}

/**
 * Manually add a balance row to a PENDING_REVIEW statement.
 * COA account resolution is optional — approval will auto-create an account
 * when accountId is absent, just like it does for UNMATCHED extracted rows.
 */
export async function createAccountBalance(
  prisma: PrismaClient,
  statementId: string,
  orgId: string,
  input: {
    rawAccountCode: string;
    rawAccountName: string;
    balanceCents: number;
    balanceType: string;
    accountId?: string;
  },
): Promise<void> {
  const statement = await prisma.importedStatement.findFirst({
    where: { id: statementId, orgId, status: ImportedStatementStatus.PENDING_REVIEW },
  });
  if (!statement) {
    throw new ImportedStatementError(
      "NOT_FOUND",
      "Statement not found or not in PENDING_REVIEW status",
    );
  }
  await prisma.importedAccountBalance.create({
    data: {
      orgId,
      statementId,
      rawAccountCode: input.rawAccountCode,
      rawAccountName: input.rawAccountName,
      balanceCents: input.balanceCents,
      balanceType: input.balanceType,
      accountId: input.accountId ?? null,
      matchConfidence: input.accountId ? MatchConfidence.MANUAL : MatchConfidence.UNMATCHED,
    },
  });
}

/* ══════════════════════════════════════════════════════════════
   Helpers
   ══════════════════════════════════════════════════════════════ */

type StatementWithIncludes = Awaited<ReturnType<PrismaClient["importedStatement"]["findUniqueOrThrow"]>>;

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function mapBatchDTO(batch: any, statements: any[]): UploadBatchDTO {
  return {
    id: batch.id,
    orgId: batch.orgId,
    sourceFileUrl: batch.sourceFileUrl,
    fileName: batch.fileName,
    uploadedBy: batch.uploadedBy,
    createdAt: batch.createdAt.toISOString(),
    statements: statements.map((s) => mapDTO(s)),
  };
}

function mapDTO(s: any, linkedInvoices: any[] = []): ImportedStatementDTO {
  const balances: any[] = s.accountBalances ?? [];

  // Accounting equation: Assets (DEBIT) = Liabilities + Equity (CREDIT)
  // Any non-zero imbalance means the extraction is incomplete or contains errors.
  let balanceImbalanceCents: number | null = null;
  if (balances.length > 0) {
    let debitTotal = 0;
    let creditTotal = 0;
    for (const ab of balances) {
      if (ab.balanceType === "DEBIT")  debitTotal  += ab.balanceCents;
      else                             creditTotal += ab.balanceCents;
    }
    balanceImbalanceCents = debitTotal - creditTotal;
  }

  return {
    id: s.id,
    orgId: s.orgId,
    uploadBatchId: s.uploadBatchId ?? null,
    sectionType: s.sectionType ?? StatementSectionType.BALANCE_SHEET,
    buildingId: s.buildingId,
    buildingName: s.building?.name ?? null,
    fiscalYear: s.fiscalYear,
    periodStart: s.periodStart ? s.periodStart.toISOString() : null,
    periodEnd: s.periodEnd ? s.periodEnd.toISOString() : null,
    status: s.status,
    sourceFileUrl: s.sourceFileUrl,
    uploadedBy: s.uploadedBy,
    approvedBy: s.approvedBy ?? null,
    approvedAt: s.approvedAt ? s.approvedAt.toISOString() : null,
    ocrConfidence: s.ocrConfidence ?? null,
    buildingMatchConfidence: s.buildingMatchConfidence ?? null,
    notes: s.notes ?? null,
    rawOcrText: s.rawOcrText ?? null,
    accountBalances: balances.map((ab: any) => ({
      id: ab.id,
      rawAccountCode: ab.rawAccountCode,
      rawAccountName: ab.rawAccountName,
      balanceCents: ab.balanceCents,
      balanceType: ab.balanceType,
      matchConfidence: ab.matchConfidence,
      accountId: ab.accountId ?? null,
      accountName: ab.account?.name ?? null,
      accountCode: ab.account?.code ?? null,
    })),
    balanceImbalanceCents,
    linkedInvoices: linkedInvoices.map((inv: any) => ({
      id: inv.id,
      description: inv.description ?? null,
      recipientName: inv.recipientName ?? null,
      totalCents: inv.amount ?? null,
      currency: inv.currency ?? null,
      issueDate: inv.issueDate ? new Date(inv.issueDate).toISOString() : null,
      status: inv.status,
    })),
    createdAt: s.createdAt.toISOString(),
    updatedAt: s.updatedAt.toISOString(),
  };
}

function truncate(text: string, max: number): string {
  return text.length <= max ? text : text.substring(0, max) + "…";
}

/**
 * Attempt to pull a street address out of raw OCR text using Swiss/FR address
 * patterns.  Used as a fallback when the document scanner did not populate
 * `fields.buildingAddress` (e.g. because the doc was misclassified).
 *
 * Matches lines like:
 *   "Rte Monts-de-Laval 314"
 *   "Route de la Forêt 12A"
 *   "Rue du Lac 5, 1234 Villette"
 *   "Bahnhofstrasse 13"
 */
function extractAddressFromText(text: string): string | null {
  if (!text) return null;
  // Street type prefixes (FR / DE) followed by a street name and a number
  const pattern =
    /\b(?:rue|route|rte|avenue|av|chemin|ch|allée|boulevard|blvd|strasse|str|weg|gasse|platz|place)\b[^0-9\n]{2,40}\d{1,4}[a-z]?/gi;
  const matches = text.match(pattern);
  if (!matches || matches.length === 0) return null;
  // Return the longest match (most specific address)
  return matches.sort((a, b) => b.length - a.length)[0].trim();
}

function parseDateField(raw: string): Date | undefined {
  const iso = /^(\d{4})-(\d{2})-(\d{2})$/.exec(raw);
  if (iso) return new Date(`${iso[1]}-${iso[2]}-${iso[3]}T00:00:00Z`);
  const euro = /^(\d{1,2})[./\-](\d{1,2})[./\-](\d{2,4})$/.exec(raw);
  if (euro) {
    let [, d, m, y] = euro;
    if (y.length === 2) y = (parseInt(y) > 50 ? "19" : "20") + y;
    return new Date(`${y}-${m.padStart(2, "0")}-${d.padStart(2, "0")}T00:00:00Z`);
  }
  return undefined;
}

function parsePeriodLabel(
  label: string | null,
  fiscalYear: number,
): { periodStart: Date | null; periodEnd: Date | null } {
  if (!label) {
    return {
      periodStart: new Date(`${fiscalYear}-01-01T00:00:00Z`),
      periodEnd: new Date(`${fiscalYear}-12-31T00:00:00Z`),
    };
  }
  // Try "DD.MM.YYYY – DD.MM.YYYY" or "DD.MM.YYYY - DD.MM.YYYY"
  const m = label.match(
    /(\d{1,2}[./]\d{1,2}[./]\d{2,4})\s*[–\-]\s*(\d{1,2}[./]\d{1,2}[./]\d{2,4})/,
  );
  if (m) {
    return {
      periodStart: parseDateField(m[1]) ?? new Date(`${fiscalYear}-01-01T00:00:00Z`),
      periodEnd: parseDateField(m[2]) ?? new Date(`${fiscalYear}-12-31T00:00:00Z`),
    };
  }
  return {
    periodStart: new Date(`${fiscalYear}-01-01T00:00:00Z`),
    periodEnd: new Date(`${fiscalYear}-12-31T00:00:00Z`),
  };
}
