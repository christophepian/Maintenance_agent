/**
 * Unit tests for S-P0-002-01: Legal Variable Ingestion Service
 *
 * Tests legalVariableIngestion.ts — ingestLegalVariable(), ingestFetcherResults(),
 * flushLegalVariableIngestion().
 *
 * All Prisma and legalIngestion calls are mocked — no real DB or HTTP.
 */

/* ── Mocks (must be before imports) ─────────────────────────── */

const mockLegalVariable = {
  findFirst: jest.fn(),
  create: jest.fn(),
};
const mockLegalVariableVersion = {
  findFirst: jest.fn(),
  create: jest.fn(),
};

jest.mock("../services/prismaClient", () => ({
  __esModule: true,
  default: {
    legalVariable: mockLegalVariable,
    legalVariableVersion: mockLegalVariableVersion,
  },
}));

const mockIngestAllSources = jest.fn();

jest.mock("../services/legalIngestion", () => ({
  ingestAllSources: mockIngestAllSources,
}));

/* ── Imports ────────────────────────────────────────────────── */

import {
  ingestLegalVariable,
  ingestFetcherResults,
  flushLegalVariableIngestion,
  type IngestVariableInput,
  type IngestVariableResult,
  type FlushResult,
} from "../services/legalVariableIngestion";

/* ── Helpers ────────────────────────────────────────────────── */

const BASE_DATE = new Date("2025-12-02T00:00:00Z");
const END_DATE = new Date("2026-06-01T00:00:00Z");

function makeInput(overrides?: Partial<IngestVariableInput>): IngestVariableInput {
  return {
    key: "REFERENCE_INTEREST_RATE",
    value: { rate: 1.75 },
    effectiveFrom: BASE_DATE,
    ...overrides,
  };
}

const VARIABLE_RECORD = {
  id: "var-001",
  key: "REFERENCE_INTEREST_RATE",
  jurisdiction: "CH",
  canton: null,
  description: "Auto-ingested: REFERENCE_INTEREST_RATE",
  createdAt: new Date(),
  updatedAt: new Date(),
};

const VERSION_RECORD = {
  id: "ver-001",
  variableId: "var-001",
  effectiveFrom: BASE_DATE,
  effectiveTo: null,
  valueJson: { rate: 1.75 },
  sourceId: null,
  fetchedAt: new Date(),
  createdAt: new Date(),
};

/* ── Reset ──────────────────────────────────────────────────── */

beforeEach(() => {
  jest.clearAllMocks();
});

/* ── ingestLegalVariable ────────────────────────────────────── */

describe("ingestLegalVariable", () => {
  it("creates a new variable and version when none exist", async () => {
    mockLegalVariable.findFirst.mockResolvedValue(null);
    mockLegalVariable.create.mockResolvedValue(VARIABLE_RECORD);
    mockLegalVariableVersion.findFirst.mockResolvedValue(null);
    mockLegalVariableVersion.create.mockResolvedValue(VERSION_RECORD);

    const result = await ingestLegalVariable(makeInput());

    expect(result.variableId).toBe("var-001");
    expect(result.versionId).toBe("ver-001");
    expect(result.created).toBe(true);

    // Variable created with correct data
    expect(mockLegalVariable.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        key: "REFERENCE_INTEREST_RATE",
        jurisdiction: "CH",
        canton: null,
        description: "Auto-ingested: REFERENCE_INTEREST_RATE",
      }),
    });

    // Version created with correct data
    expect(mockLegalVariableVersion.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        variableId: "var-001",
        effectiveFrom: BASE_DATE,
        effectiveTo: null,
        valueJson: { rate: 1.75 },
        sourceId: null,
      }),
    });
  });

  it("reuses existing variable and creates only a new version", async () => {
    mockLegalVariable.findFirst.mockResolvedValue(VARIABLE_RECORD);
    mockLegalVariableVersion.findFirst.mockResolvedValue(null);
    mockLegalVariableVersion.create.mockResolvedValue(VERSION_RECORD);

    const result = await ingestLegalVariable(makeInput());

    expect(result.variableId).toBe("var-001");
    expect(result.versionId).toBe("ver-001");
    expect(result.created).toBe(false);

    // Variable NOT created — reused
    expect(mockLegalVariable.create).not.toHaveBeenCalled();
    expect(mockLegalVariableVersion.create).toHaveBeenCalled();
  });

  it("skips version creation if effectiveFrom already exists (idempotent)", async () => {
    mockLegalVariable.findFirst.mockResolvedValue(VARIABLE_RECORD);
    mockLegalVariableVersion.findFirst.mockResolvedValue(VERSION_RECORD);

    const result = await ingestLegalVariable(makeInput());

    expect(result.variableId).toBe("var-001");
    expect(result.versionId).toBeNull();
    expect(result.created).toBe(false);

    // Neither variable nor version created
    expect(mockLegalVariable.create).not.toHaveBeenCalled();
    expect(mockLegalVariableVersion.create).not.toHaveBeenCalled();
  });

  it("passes canton through to the variable lookup and creation", async () => {
    mockLegalVariable.findFirst.mockResolvedValue(null);
    mockLegalVariable.create.mockResolvedValue({ ...VARIABLE_RECORD, canton: "ZH" });
    mockLegalVariableVersion.findFirst.mockResolvedValue(null);
    mockLegalVariableVersion.create.mockResolvedValue(VERSION_RECORD);

    await ingestLegalVariable(makeInput({ canton: "ZH" }));

    expect(mockLegalVariable.findFirst).toHaveBeenCalledWith({
      where: { key: "REFERENCE_INTEREST_RATE", jurisdiction: "CH", canton: "ZH" },
    });
    expect(mockLegalVariable.create).toHaveBeenCalledWith({
      data: expect.objectContaining({ canton: "ZH" }),
    });
  });

  it("passes null canton for federal-scope variables", async () => {
    mockLegalVariable.findFirst.mockResolvedValue(null);
    mockLegalVariable.create.mockResolvedValue(VARIABLE_RECORD);
    mockLegalVariableVersion.findFirst.mockResolvedValue(null);
    mockLegalVariableVersion.create.mockResolvedValue(VERSION_RECORD);

    await ingestLegalVariable(makeInput({ canton: undefined }));

    expect(mockLegalVariable.findFirst).toHaveBeenCalledWith({
      where: { key: "REFERENCE_INTEREST_RATE", jurisdiction: "CH", canton: null },
    });
    expect(mockLegalVariable.create).toHaveBeenCalledWith({
      data: expect.objectContaining({ canton: null }),
    });
  });

  it("passes effectiveTo to version when provided", async () => {
    mockLegalVariable.findFirst.mockResolvedValue(VARIABLE_RECORD);
    mockLegalVariableVersion.findFirst.mockResolvedValue(null);
    mockLegalVariableVersion.create.mockResolvedValue({
      ...VERSION_RECORD,
      effectiveTo: END_DATE,
    });

    await ingestLegalVariable(makeInput({ effectiveTo: END_DATE }));

    expect(mockLegalVariableVersion.create).toHaveBeenCalledWith({
      data: expect.objectContaining({ effectiveTo: END_DATE }),
    });
  });

  it("passes sourceId to version when provided", async () => {
    mockLegalVariable.findFirst.mockResolvedValue(VARIABLE_RECORD);
    mockLegalVariableVersion.findFirst.mockResolvedValue(null);
    mockLegalVariableVersion.create.mockResolvedValue({
      ...VERSION_RECORD,
      sourceId: "src-001",
    });

    await ingestLegalVariable(makeInput({ sourceId: "src-001" }));

    expect(mockLegalVariableVersion.create).toHaveBeenCalledWith({
      data: expect.objectContaining({ sourceId: "src-001" }),
    });
  });

  it("uses custom description when provided", async () => {
    mockLegalVariable.findFirst.mockResolvedValue(null);
    mockLegalVariable.create.mockResolvedValue(VARIABLE_RECORD);
    mockLegalVariableVersion.findFirst.mockResolvedValue(null);
    mockLegalVariableVersion.create.mockResolvedValue(VERSION_RECORD);

    await ingestLegalVariable(makeInput({ description: "SNB reference rate" }));

    expect(mockLegalVariable.create).toHaveBeenCalledWith({
      data: expect.objectContaining({ description: "SNB reference rate" }),
    });
  });
});

/* ── ingestFetcherResults ───────────────────────────────────── */

describe("ingestFetcherResults", () => {
  it("inserts new versions and counts correctly", async () => {
    const fetcherResults = [
      { key: "CPI_INDEX", value: 107.1, effectiveFrom: new Date("2025-11-01") },
      { key: "REFERENCE_INTEREST_RATE", value: { rate: 1.75 }, effectiveFrom: BASE_DATE },
    ];

    // First result: new variable + version
    mockLegalVariable.findFirst
      .mockResolvedValueOnce(null) // first call: no variable
      .mockResolvedValueOnce(VARIABLE_RECORD); // second call: existing variable
    mockLegalVariable.create.mockResolvedValueOnce({
      ...VARIABLE_RECORD,
      id: "var-002",
      key: "CPI_INDEX",
    });
    mockLegalVariableVersion.findFirst
      .mockResolvedValueOnce(null) // first: no version
      .mockResolvedValueOnce(VERSION_RECORD); // second: existing version (skip)
    mockLegalVariableVersion.create.mockResolvedValueOnce({
      ...VERSION_RECORD,
      id: "ver-002",
    });

    const result = await ingestFetcherResults(fetcherResults, { canton: "ZH", sourceId: "src-001" });

    expect(result.inserted).toBe(1);
    expect(result.skipped).toBe(1);
  });

  it("returns all skipped when all versions already exist", async () => {
    const fetcherResults = [
      { key: "CPI_INDEX", value: 107.1, effectiveFrom: new Date("2025-11-01") },
    ];

    mockLegalVariable.findFirst.mockResolvedValue(VARIABLE_RECORD);
    mockLegalVariableVersion.findFirst.mockResolvedValue(VERSION_RECORD);

    const result = await ingestFetcherResults(fetcherResults);

    expect(result.inserted).toBe(0);
    expect(result.skipped).toBe(1);
  });

  it("handles empty array", async () => {
    const result = await ingestFetcherResults([]);

    expect(result.inserted).toBe(0);
    expect(result.skipped).toBe(0);
    expect(mockLegalVariable.findFirst).not.toHaveBeenCalled();
  });
});

/* ── flushLegalVariableIngestion ────────────────────────────── */

describe("flushLegalVariableIngestion", () => {
  it("returns aggregated results from ingestAllSources", async () => {
    mockIngestAllSources.mockResolvedValue([
      { sourceId: "s1", sourceName: "SNB", status: "success", variablesUpdated: 1 },
      { sourceId: "s2", sourceName: "BFS", status: "success", variablesUpdated: 2 },
    ]);

    const result: FlushResult = await flushLegalVariableIngestion();

    expect(result.sourcesProcessed).toBe(2);
    expect(result.variablesUpdated).toBe(3);
    expect(result.errors).toEqual([]);
  });

  it("collects error messages from failed sources", async () => {
    mockIngestAllSources.mockResolvedValue([
      { sourceId: "s1", sourceName: "SNB", status: "success", variablesUpdated: 1 },
      { sourceId: "s2", sourceName: "BFS", status: "error", variablesUpdated: 0, error: "Connection refused" },
      { sourceId: "s3", sourceName: "Fedlex", status: "error", variablesUpdated: 0, error: "404 Not Found" },
    ]);

    const result = await flushLegalVariableIngestion();

    expect(result.sourcesProcessed).toBe(3);
    expect(result.variablesUpdated).toBe(1);
    expect(result.errors).toEqual([
      "BFS: Connection refused",
      "Fedlex: 404 Not Found",
    ]);
  });

  it("handles zero sources gracefully", async () => {
    mockIngestAllSources.mockResolvedValue([]);

    const result = await flushLegalVariableIngestion();

    expect(result.sourcesProcessed).toBe(0);
    expect(result.variablesUpdated).toBe(0);
    expect(result.errors).toEqual([]);
  });

  it("delegates to ingestAllSources without canton filter", async () => {
    mockIngestAllSources.mockResolvedValue([]);

    await flushLegalVariableIngestion();

    expect(mockIngestAllSources).toHaveBeenCalledTimes(1);
    expect(mockIngestAllSources).toHaveBeenCalledWith();
  });
});
