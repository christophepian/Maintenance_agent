/**
 * Unit tests for S3AttachmentStorage (B1 — S3 storage implementation)
 *
 * All AWS SDK calls are mocked — no real S3 buckets or credentials required.
 * Tests cover: put, get, exists, delete, save, and error paths.
 */

/* ── Mocks (must be before imports) ─────────────────────────── */

const mockSend = jest.fn();

jest.mock("@aws-sdk/client-s3", () => ({
  S3Client: jest.fn(() => ({ send: mockSend })),
  PutObjectCommand: jest.fn((input) => ({ _tag: "PutObjectCommand", input })),
  GetObjectCommand: jest.fn((input) => ({ _tag: "GetObjectCommand", input })),
  HeadObjectCommand: jest.fn((input) => ({ _tag: "HeadObjectCommand", input })),
  DeleteObjectCommand: jest.fn((input) => ({ _tag: "DeleteObjectCommand", input })),
}));

/* ── Module reload helpers ───────────────────────────────────── */

function loadStorageModule() {
  // Re-require so env vars and the singleton are evaluated fresh
  jest.resetModules();
  return require("../storage/attachments");
}

/* ── Env setup ───────────────────────────────────────────────── */

const BASE_S3_ENV = {
  ATTACHMENTS_STORAGE: "s3",
  S3_REGION: "us-east-1",
  S3_BUCKET: "test-bucket",
  S3_ACCESS_KEY_ID: "AKIATEST",
  S3_SECRET_ACCESS_KEY: "secret",
};

function withEnv(vars: Record<string, string>, fn: () => void) {
  const saved: Record<string, string | undefined> = {};
  for (const k of Object.keys(vars)) saved[k] = process.env[k];
  Object.assign(process.env, vars);
  try {
    fn();
  } finally {
    for (const [k, v] of Object.entries(saved)) {
      if (v === undefined) delete process.env[k];
      else process.env[k] = v;
    }
  }
}

/* ── Helpers ─────────────────────────────────────────────────── */

/** Create an async iterable that yields the given chunks */
function makeAsyncIterable(chunks: Uint8Array[]): AsyncIterable<Uint8Array> {
  return {
    [Symbol.asyncIterator]() {
      let i = 0;
      return {
        async next() {
          if (i < chunks.length) return { value: chunks[i++], done: false };
          return { value: undefined as any, done: true };
        },
      };
    },
  };
}

/* ── Tests ───────────────────────────────────────────────────── */

describe("LocalDiskStorage (smoke)", () => {
  it("exports storage singleton when backend=local (default)", () => {
    jest.resetModules();
    const saved = process.env.ATTACHMENTS_STORAGE;
    delete process.env.ATTACHMENTS_STORAGE;
    try {
      const mod = require("../storage/attachments");
      expect(mod.storage).toBeDefined();
    } finally {
      if (saved !== undefined) process.env.ATTACHMENTS_STORAGE = saved;
      else delete process.env.ATTACHMENTS_STORAGE;
    }
  });
});

describe("S3AttachmentStorage — constructor validation", () => {
  it("throws if S3_REGION is missing", () => {
    withEnv({ ATTACHMENTS_STORAGE: "s3", S3_BUCKET: "b", S3_ACCESS_KEY_ID: "k", S3_SECRET_ACCESS_KEY: "s" }, () => {
      delete process.env.S3_REGION;
      expect(() => loadStorageModule()).toThrow(/S3_REGION/);
    });
  });

  it("throws if S3_BUCKET is missing", () => {
    withEnv({ ATTACHMENTS_STORAGE: "s3", S3_REGION: "us-east-1", S3_ACCESS_KEY_ID: "k", S3_SECRET_ACCESS_KEY: "s" }, () => {
      delete process.env.S3_BUCKET;
      expect(() => loadStorageModule()).toThrow(/S3_BUCKET/);
    });
  });

  it("throws if S3_ACCESS_KEY_ID is missing", () => {
    withEnv({ ATTACHMENTS_STORAGE: "s3", S3_REGION: "us-east-1", S3_BUCKET: "b", S3_SECRET_ACCESS_KEY: "s" }, () => {
      delete process.env.S3_ACCESS_KEY_ID;
      expect(() => loadStorageModule()).toThrow(/S3_ACCESS_KEY_ID/);
    });
  });

  it("throws if S3_SECRET_ACCESS_KEY is missing", () => {
    withEnv({ ATTACHMENTS_STORAGE: "s3", S3_REGION: "us-east-1", S3_BUCKET: "b", S3_ACCESS_KEY_ID: "k" }, () => {
      delete process.env.S3_SECRET_ACCESS_KEY;
      expect(() => loadStorageModule()).toThrow(/S3_SECRET_ACCESS_KEY/);
    });
  });

  it("initialises successfully with all required env vars", () => {
    withEnv(BASE_S3_ENV, () => {
      expect(() => loadStorageModule()).not.toThrow();
    });
  });
});

describe("S3AttachmentStorage — put()", () => {
  beforeEach(() => mockSend.mockReset());

  it("calls PutObjectCommand with correct bucket and key", async () => {
    withEnv(BASE_S3_ENV, () => {
      const { storage } = loadStorageModule();
      mockSend.mockResolvedValueOnce({});

      return storage.put("invoices/test.pdf", Buffer.from("data")).then(() => {
        expect(mockSend).toHaveBeenCalledTimes(1);
        const cmd = mockSend.mock.calls[0][0];
        expect(cmd.input.Bucket).toBe("test-bucket");
        expect(cmd.input.Key).toBe("invoices/test.pdf");
      });
    });
  });

  it("rejects with error if file exceeds MAX_FILE_SIZE", async () => {
    withEnv(BASE_S3_ENV, () => {
      const mod = loadStorageModule();
      const oversized = Buffer.alloc(mod.MAX_FILE_SIZE + 1);
      return expect(mod.storage.put("key", oversized)).rejects.toThrow(/exceeds maximum size/);
    });
  });
});

describe("S3AttachmentStorage — get()", () => {
  beforeEach(() => mockSend.mockReset());

  it("collects streaming body chunks into a Buffer", async () => {
    withEnv(BASE_S3_ENV, () => {
      const { storage } = loadStorageModule();
      const expected = Buffer.from("hello world");
      mockSend.mockResolvedValueOnce({
        Body: makeAsyncIterable([expected]),
      });

      return storage.get("some/key.pdf").then((result: Buffer) => {
        expect(result).toEqual(expected);
      });
    });
  });

  it("throws if Body is absent", async () => {
    withEnv(BASE_S3_ENV, () => {
      const { storage } = loadStorageModule();
      mockSend.mockResolvedValueOnce({ Body: null });
      return expect(storage.get("missing")).rejects.toThrow(/not found or empty/);
    });
  });
});

describe("S3AttachmentStorage — exists()", () => {
  beforeEach(() => mockSend.mockReset());

  it("returns true when HeadObject succeeds", async () => {
    withEnv(BASE_S3_ENV, () => {
      const { storage } = loadStorageModule();
      mockSend.mockResolvedValueOnce({ ContentLength: 42 });
      return expect(storage.exists("present/key")).resolves.toBe(true);
    });
  });

  it("returns false when HeadObject throws 404", async () => {
    withEnv(BASE_S3_ENV, () => {
      const { storage } = loadStorageModule();
      const err = Object.assign(new Error("Not Found"), { $metadata: { httpStatusCode: 404 } });
      mockSend.mockRejectedValueOnce(err);
      return expect(storage.exists("absent/key")).resolves.toBe(false);
    });
  });

  it("re-throws on non-404 errors", async () => {
    withEnv(BASE_S3_ENV, () => {
      const { storage } = loadStorageModule();
      const err = Object.assign(new Error("Access Denied"), { $metadata: { httpStatusCode: 403 } });
      mockSend.mockRejectedValueOnce(err);
      return expect(storage.exists("key")).rejects.toThrow(/Access Denied/);
    });
  });
});

describe("S3AttachmentStorage — delete()", () => {
  beforeEach(() => mockSend.mockReset());

  it("calls DeleteObjectCommand with correct key", async () => {
    withEnv(BASE_S3_ENV, () => {
      const { storage } = loadStorageModule();
      mockSend.mockResolvedValueOnce({});
      return storage.delete("to/delete.pdf").then(() => {
        const cmd = mockSend.mock.calls[0][0];
        expect(cmd.input.Key).toBe("to/delete.pdf");
        expect(cmd.input.Bucket).toBe("test-bucket");
      });
    });
  });
});

describe("S3AttachmentStorage — save()", () => {
  beforeEach(() => mockSend.mockReset());

  it("returns SaveResult with correct mimeType and non-empty key", async () => {
    withEnv(BASE_S3_ENV, () => {
      const { storage } = loadStorageModule();
      mockSend.mockResolvedValue({});
      const buf = Buffer.from("pdf-content");
      return storage.save(buf, {
        applicationId: "app-1",
        applicantId: "user-1",
        docType: "LEASE",
        fileName: "contract.pdf",
        mimeType: "application/pdf",
      }).then((result: any) => {
        expect(result.mimeType).toBe("application/pdf");
        expect(result.key).toMatch(/app-1\/user-1\/LEASE\/.+contract\.pdf/);
        expect(result.size).toBe(buf.length);
        expect(result.sha256).toHaveLength(64);
      });
    });
  });
});
