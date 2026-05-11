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

export interface ImportedStatementDTO {
  id: string;
  orgId: string;
  buildingId: string;
  buildingName: string;
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
  accountBalances: ImportedAccountBalanceDTO[];
  createdAt: string;
  updatedAt: string;
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
): Promise<ImportedStatementDTO> {
  const { buffer, fileName, mimeType, orgId, uploadedBy } = input;

  // 1. Store the source file
  const fileKey = `imported-statements/${orgId}/${Date.now()}-${crypto.randomBytes(4).toString("hex")}/${fileName}`;
  await storage.put(fileKey, buffer);

  // 2. Scan the document
  console.log(`[IMPORT] Scanning file="${fileName}" size=${buffer.length} mime=${mimeType}`);
  const scanResult: ScanResult = await scanDocument(buffer, fileName, mimeType);
  console.log(
    `[IMPORT] Scan complete: docType=${scanResult.docType} confidence=${scanResult.confidence} ` +
    `balances=${scanResult.accountBalances?.length ?? 0} invoiceLines=${scanResult.invoiceLines?.length ?? 0}`,
  );

  // 3. Determine building
  let buildingId = input.buildingId ?? null;
  let buildingMatchConfidence: MatchConfidence | null = buildingId ? MatchConfidence.MANUAL : null;

  if (!buildingId) {
    const addressHint =
      (scanResult.fields.buildingAddress as string | null) ??
      (scanResult.fields.address as string | null) ??
      "";
    if (addressHint) {
      const detected = await detectBuildingFromContent(prisma, orgId, addressHint);
      if (detected) {
        buildingId = detected.buildingId;
        buildingMatchConfidence = detected.confidence;
        console.log(`[IMPORT] Building auto-detected: id=${buildingId} confidence=${buildingMatchConfidence}`);
      }
    }
  }

  if (!buildingId) {
    throw new Error(
      "Could not identify the building from the PDF content. Please supply buildingId explicitly.",
    );
  }

  // 4. Fiscal year
  const fiscalYear =
    input.fiscalYear ??
    (typeof scanResult.fields.fiscalYear === "number" ? scanResult.fields.fiscalYear : null) ??
    new Date().getFullYear();

  // 5. Create the ImportedStatement record (PENDING_REVIEW)
  const periodLabel = scanResult.fields.periodLabel as string | null ?? null;
  const { periodStart, periodEnd } = parsePeriodLabel(periodLabel, fiscalYear);

  const rawOcrText = truncate(
    scanResult.summary + "\n---\n" + JSON.stringify(scanResult.fields),
    8000,
  );

  const statement = await prisma.importedStatement.create({
    data: {
      orgId,
      buildingId,
      fiscalYear,
      periodStart,
      periodEnd,
      status: ImportedStatementStatus.PENDING_REVIEW,
      sourceFileUrl: fileKey,
      uploadedBy,
      ocrConfidence: scanResult.confidence,
      buildingMatchConfidence,
      rawOcrText,
    },
    include: {
      building: { select: { name: true } },
      accountBalances: { include: { account: { select: { name: true, code: true } } } },
    },
  });

  // 6. Match and persist account balances
  if (scanResult.accountBalances && scanResult.accountBalances.length > 0) {
    const orgAccounts = await accountRepo.findAccountsByOrg(prisma, orgId);
    const balanceRows = await Promise.all(
      scanResult.accountBalances.map(async (ab) => {
        const balanceCents = Math.round(ab.balanceChf * 100);
        const match = await matchAccount(orgAccounts, ab.rawAccountCode, ab.rawAccountName, balanceCents);
        return {
          orgId,
          statementId: statement.id,
          accountId: match.accountId,
          rawAccountCode: ab.rawAccountCode,
          rawAccountName: ab.rawAccountName,
          balanceCents,
          balanceType: ab.balanceType,
          matchConfidence: match.confidence,
        };
      }),
    );
    await prisma.importedAccountBalance.createMany({ data: balanceRows });
    console.log(`[IMPORT] Persisted ${balanceRows.length} account balance row(s)`);
  }

  // 7. Create Invoice records for extracted invoice lines
  if (scanResult.invoiceLines && scanResult.invoiceLines.length > 0) {
    for (const line of scanResult.invoiceLines) {
      try {
        const { unitId } = await resolveUnitFromLine(
          prisma, orgId, buildingId, line.unitHint, line.tenantHint,
        );
        const { contractorId } = await resolveContractorFromLine(prisma, orgId, line.vendorName);

        const totalChf = line.totalAmount ?? null;
        const vatChf = line.vatAmount ?? null;
        const subtotalChf = line.subtotal ?? null;

        let netAmount: number | undefined;
        if (subtotalChf != null) netAmount = subtotalChf;
        else if (totalChf != null && vatChf != null) netAmount = totalChf - vatChf;
        else netAmount = totalChf ?? undefined;

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
          dueDate: line.dueDate ? parseDateField(line.dueDate) : undefined,
          matchedJobId: undefined,
          matchedLeaseId: undefined,
          matchedBuildingId: buildingId,
        });
      } catch (lineErr) {
        console.warn(`[IMPORT] Failed to create invoice for line "${line.vendorName}":`, lineErr);
      }
    }
    console.log(`[IMPORT] Processed ${scanResult.invoiceLines.length} invoice line(s)`);
  }

  // 8. Reload with balances and return DTO
  const full = await prisma.importedStatement.findUniqueOrThrow({
    where: { id: statement.id },
    include: {
      building: { select: { name: true } },
      accountBalances: { include: { account: { select: { name: true, code: true } } } },
    },
  });

  return mapDTO(full);
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

  if (!statement) throw new Error("STATEMENT_NOT_FOUND");
  if (statement.status !== ImportedStatementStatus.PENDING_REVIEW) {
    throw new Error(`INVALID_STATUS: statement is ${statement.status}`);
  }

  // Post ledger entries for matched account balances
  const matchedBalances = statement.accountBalances.filter(
    (ab) => ab.accountId && ab.matchConfidence !== MatchConfidence.UNMATCHED,
  );

  if (matchedBalances.length > 0) {
    const periodDate = statement.periodEnd ?? statement.periodStart ?? new Date();
    await postJournalEntries(
      prisma,
      orgId,
      matchedBalances.map((ab) => ({
        accountId: ab.accountId!,
        debitCents: ab.balanceType === "DEBIT" ? ab.balanceCents : 0,
        creditCents: ab.balanceType === "CREDIT" ? ab.balanceCents : 0,
        description: `[Import FY${statement.fiscalYear}] ${ab.rawAccountCode} ${ab.rawAccountName}`,
        reference: `Statement FY${statement.fiscalYear}`,
        sourceType: "IMPORTED_STATEMENT",
        sourceId: statement.id,
        buildingId: statement.buildingId,
        date: periodDate,
      })),
    );
    console.log(`[IMPORT] Posted ${matchedBalances.length} ledger entries for statement ${statementId}`);
  }

  // Confirm all PENDING_REVIEW invoices linked to this source file
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

  // Mark statement approved
  const updated = await prisma.importedStatement.update({
    where: { id: statementId },
    data: { status: ImportedStatementStatus.APPROVED, approvedBy, approvedAt: new Date() },
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

  return { data: items.map(mapDTO), total };
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
  return s ? mapDTO(s) : null;
}

/** Manually update the accountId for an UNMATCHED balance row. */
export async function resolveAccountBalance(
  prisma: PrismaClient,
  balanceId: string,
  accountId: string,
  orgId: string,
): Promise<void> {
  await prisma.importedAccountBalance.updateMany({
    where: { id: balanceId, orgId },
    data: { accountId, matchConfidence: MatchConfidence.MANUAL },
  });
}

/* ══════════════════════════════════════════════════════════════
   Helpers
   ══════════════════════════════════════════════════════════════ */

type StatementWithIncludes = Awaited<ReturnType<PrismaClient["importedStatement"]["findUniqueOrThrow"]>>;

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function mapDTO(s: any): ImportedStatementDTO {
  return {
    id: s.id,
    orgId: s.orgId,
    buildingId: s.buildingId,
    buildingName: s.building?.name ?? "",
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
    accountBalances: (s.accountBalances ?? []).map((ab: any) => ({
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
    createdAt: s.createdAt.toISOString(),
    updatedAt: s.updatedAt.toISOString(),
  };
}

function truncate(text: string, max: number): string {
  return text.length <= max ? text : text.substring(0, max) + "…";
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
