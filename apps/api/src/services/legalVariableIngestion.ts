/**
 * Legal Variable Ingestion Service — S-P0-002-01
 *
 * Bridge between legalIngestion.ts fetchers and LegalVariable DB records.
 *
 * Provides:
 *   - ingestLegalVariable()         — idempotent upsert of a single variable + version
 *   - flushLegalVariableIngestion() — scheduled ingestion of all sources
 *
 * Idempotency key:
 *   - LegalVariable:        key + jurisdiction + canton   (@@unique)
 *   - LegalVariableVersion:  variableId + effectiveFrom   (checked before insert)
 *
 * Canton scope:
 *   - canton=null  → FEDERAL (nationwide)
 *   - canton="ZH"  → canton-specific override
 *
 * Layer: service — calls prismaClient directly (SA-11: legal data is global,
 * no orgId scoping).
 */

import prisma from "./prismaClient";
import {
  ingestAllSources,
  type FetcherResult,
  type IngestionResult,
} from "./legalIngestion";

// ─── Input / Output Types ──────────────────────────────────────

export interface IngestVariableInput {
  /** Variable key, e.g. "REFERENCE_INTEREST_RATE", "CPI_INDEX" */
  key: string;
  /** JSON-serialisable value (number, object, etc.) */
  value: any;
  /** Date the value becomes effective */
  effectiveFrom: Date;
  /** Optional end date (null = still in effect) */
  effectiveTo?: Date | null;
  /** Canton code (null = FEDERAL / nationwide) */
  canton?: string | null;
  /** Optional source ID for traceability */
  sourceId?: string | null;
  /** Human-readable description (used only on first create) */
  description?: string;
}

export interface IngestVariableResult {
  /** The LegalVariable record ID */
  variableId: string;
  /** The new LegalVariableVersion ID, or null if duplicate */
  versionId: string | null;
  /** Whether this was a newly created variable (vs. existing) */
  created: boolean;
}

export interface FlushResult {
  /** Number of LegalSource records processed */
  sourcesProcessed: number;
  /** Total new LegalVariableVersion rows written */
  variablesUpdated: number;
  /** Error messages from failed sources */
  errors: string[];
}

// ─── Core: Upsert a Single Variable + Version ─────────────────

/**
 * Idempotently upsert a legal variable and (optionally) add a new version.
 *
 * 1. Find-or-create the LegalVariable by (key, jurisdiction, canton).
 * 2. If a LegalVariableVersion with the same effectiveFrom already exists
 *    for that variable, skip (idempotent).
 * 3. Otherwise create the version row.
 *
 * @returns IngestVariableResult with the variable ID and version ID (or null).
 */
export async function ingestLegalVariable(
  input: IngestVariableInput,
): Promise<IngestVariableResult> {
  const {
    key,
    value,
    effectiveFrom,
    effectiveTo = null,
    canton = null,
    sourceId = null,
    description,
  } = input;

  const jurisdiction = "CH";

  // Step 1 — Find or create the variable (idempotent on unique constraint)
  let variable = await prisma.legalVariable.findFirst({
    where: { key, jurisdiction, canton },
  });

  let created = false;

  if (!variable) {
    variable = await prisma.legalVariable.create({
      data: {
        key,
        jurisdiction,
        canton,
        description: description ?? `Auto-ingested: ${key}`,
      },
    });
    created = true;
  }

  // Step 2 — Check for existing version (idempotency on effectiveFrom)
  const existingVersion = await prisma.legalVariableVersion.findFirst({
    where: {
      variableId: variable.id,
      effectiveFrom,
    },
  });

  if (existingVersion) {
    return { variableId: variable.id, versionId: null, created: false };
  }

  // Step 3 — Create the new version
  const version = await prisma.legalVariableVersion.create({
    data: {
      variableId: variable.id,
      effectiveFrom,
      effectiveTo,
      valueJson: value,
      sourceId,
      fetchedAt: new Date(),
    },
  });

  return { variableId: variable.id, versionId: version.id, created };
}

// ─── Batch: Ingest from FetcherResult[] ────────────────────────

/**
 * Convenience wrapper: ingest an array of FetcherResult objects
 * (as returned by legalIngestion.ts fetchers) with optional canton/source.
 */
export async function ingestFetcherResults(
  results: FetcherResult[],
  opts?: { canton?: string | null; sourceId?: string | null },
): Promise<{ inserted: number; skipped: number }> {
  let inserted = 0;
  let skipped = 0;

  for (const r of results) {
    const result = await ingestLegalVariable({
      key: r.key,
      value: r.value,
      effectiveFrom: r.effectiveFrom,
      effectiveTo: r.effectiveTo,
      canton: opts?.canton ?? null,
      sourceId: opts?.sourceId ?? null,
    });

    if (result.versionId) {
      inserted++;
    } else {
      skipped++;
    }
  }

  return { inserted, skipped };
}

// ─── Scheduled Flush: Run All Sources ──────────────────────────

/**
 * Run ingestion for all active legal sources.
 *
 * Delegates to `ingestAllSources()` from legalIngestion.ts which already
 * handles source lookup, fetcher dispatch, and LegalVariable writes.
 *
 * Designed to be called from the background job scheduler in server.ts.
 */
export async function flushLegalVariableIngestion(): Promise<FlushResult> {
  const results: IngestionResult[] = await ingestAllSources();

  const sourcesProcessed = results.length;
  const variablesUpdated = results.reduce(
    (sum, r) => sum + r.variablesUpdated,
    0,
  );
  const errors = results
    .filter((r) => r.status === "error")
    .map((r) => `${r.sourceName}: ${r.error}`);

  return { sourcesProcessed, variablesUpdated, errors };
}
