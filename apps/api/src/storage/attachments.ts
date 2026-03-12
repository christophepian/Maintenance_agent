import * as fs from "fs";
import * as path from "path";
import * as crypto from "crypto";

/* ── Configuration ─────────────────────────────────────────── */

const STORAGE_BACKEND = process.env.ATTACHMENTS_STORAGE || "local";

/** Root directory for local file storage (dev only) */
const LOCAL_ROOT = path.resolve(
  process.env.ATTACHMENTS_LOCAL_ROOT ||
    path.join(__dirname, "..", "..", ".data", "uploads"),
);

/** Maximum file size: 5 MB */
export const MAX_FILE_SIZE = 5 * 1024 * 1024;

/* ── Interfaces ────────────────────────────────────────────── */

export interface SaveResult {
  key: string;
  size: number;
  sha256: string;
  mimeType: string;
}

export interface AttachmentStorage {
  save(
    buffer: Buffer,
    opts: {
      applicationId: string;
      applicantId: string;
      docType: string;
      fileName: string;
      mimeType: string;
    },
  ): Promise<SaveResult>;

  /**
   * Generic key-based write. Caller builds the key, storage just persists.
   * Used by maintenance-attachments and any future non-rental uploads.
   */
  put(key: string, buffer: Buffer): Promise<void>;

  get(key: string): Promise<Buffer>;

  getStream(key: string): fs.ReadStream;

  delete(key: string): Promise<void>;

  exists(key: string): Promise<boolean>;
}

/* ── Local Disk Implementation ─────────────────────────────── */

class LocalDiskStorage implements AttachmentStorage {
  private root: string;

  constructor(root: string) {
    this.root = root;
  }

  async save(
    buffer: Buffer,
    opts: {
      applicationId: string;
      applicantId: string;
      docType: string;
      fileName: string;
      mimeType: string;
    },
  ): Promise<SaveResult> {
    if (buffer.length > MAX_FILE_SIZE) {
      throw new Error(`File exceeds maximum size of ${MAX_FILE_SIZE} bytes`);
    }

    // Build storage key: <applicationId>/<applicantId>/<docType>/<uuid>-<fileName>
    const uniqueId = crypto.randomUUID();
    const safeName = opts.fileName.replace(/[^a-zA-Z0-9._-]/g, "_");
    const key = [
      opts.applicationId,
      opts.applicantId,
      opts.docType,
      `${uniqueId}-${safeName}`,
    ].join("/");

    const fullPath = path.join(this.root, key);
    const dir = path.dirname(fullPath);
    await fs.promises.mkdir(dir, { recursive: true });
    await fs.promises.writeFile(fullPath, buffer);

    const sha256 = crypto.createHash("sha256").update(buffer).digest("hex");

    return {
      key,
      size: buffer.length,
      sha256,
      mimeType: opts.mimeType,
    };
  }

  async put(key: string, buffer: Buffer): Promise<void> {
    if (buffer.length > MAX_FILE_SIZE) {
      throw new Error(`File exceeds maximum size of ${MAX_FILE_SIZE} bytes`);
    }
    const fullPath = path.join(this.root, key);
    const dir = path.dirname(fullPath);
    await fs.promises.mkdir(dir, { recursive: true });
    await fs.promises.writeFile(fullPath, buffer);
  }

  async get(key: string): Promise<Buffer> {
    const fullPath = path.join(this.root, key);
    return fs.promises.readFile(fullPath);
  }

  getStream(key: string): fs.ReadStream {
    const fullPath = path.join(this.root, key);
    return fs.createReadStream(fullPath);
  }

  async delete(key: string): Promise<void> {
    const fullPath = path.join(this.root, key);
    try {
      await fs.promises.unlink(fullPath);
    } catch (err: any) {
      // Ignore ENOENT — file already gone (idempotent delete)
      if (err.code !== "ENOENT") throw err;
    }
  }

  async exists(key: string): Promise<boolean> {
    const fullPath = path.join(this.root, key);
    try {
      await fs.promises.access(fullPath, fs.constants.F_OK);
      return true;
    } catch {
      return false;
    }
  }
}

/* ── Factory ───────────────────────────────────────────────── */

function createStorage(): AttachmentStorage {
  switch (STORAGE_BACKEND) {
    case "local":
      return new LocalDiskStorage(LOCAL_ROOT);
    case "s3":
      // Placeholder — S3 integration is Phase 2 backlog
      throw new Error(
        "S3 storage not yet implemented. Set ATTACHMENTS_STORAGE=local or leave unset.",
      );
    default:
      throw new Error(
        `Unknown ATTACHMENTS_STORAGE backend: ${STORAGE_BACKEND}`,
      );
  }
}

/** Singleton storage instance */
export const storage: AttachmentStorage = createStorage();

/* ── Multipart body parser (minimal, no dependencies) ──────── */

/**
 * Parse a raw multipart/form-data body into parts.
 *
 * Returns an array of parts, each with `name`, `filename`, `contentType`,
 * `data` (Buffer), plus any extra form fields as string values.
 *
 * This is intentionally minimal — handles the standard boundary protocol
 * used by browsers without pulling in busboy/multer/formidable.
 */
export interface MultipartPart {
  name: string;
  filename?: string;
  contentType?: string;
  data: Buffer;
}

export function parseMultipart(
  body: Buffer,
  boundary: string,
): MultipartPart[] {
  const parts: MultipartPart[] = [];
  const boundaryBuf = Buffer.from(`--${boundary}`);
  const endBuf = Buffer.from(`--${boundary}--`);

  let pos = 0;

  // Skip preamble: advance to first boundary
  const firstBoundary = body.indexOf(boundaryBuf, pos);
  if (firstBoundary === -1) return parts;
  pos = firstBoundary + boundaryBuf.length;

  while (pos < body.length) {
    // Check for end boundary
    if (body.indexOf(endBuf, pos - boundaryBuf.length - 2) !== -1 &&
        body.indexOf(endBuf, pos - boundaryBuf.length - 2) < pos + 4) {
      break;
    }

    // Skip CRLF after boundary
    if (body[pos] === 0x0d && body[pos + 1] === 0x0a) pos += 2;

    // Find header/body separator (double CRLF)
    const headerEnd = body.indexOf("\r\n\r\n", pos);
    if (headerEnd === -1) break;

    const headerStr = body.subarray(pos, headerEnd).toString("utf8");
    pos = headerEnd + 4; // skip the double CRLF

    // Find next boundary
    const nextBoundary = body.indexOf(boundaryBuf, pos);
    if (nextBoundary === -1) break;

    // Data is everything between header end and next boundary (minus trailing CRLF)
    let dataEnd = nextBoundary;
    if (dataEnd >= 2 && body[dataEnd - 2] === 0x0d && body[dataEnd - 1] === 0x0a) {
      dataEnd -= 2;
    }
    const data = body.subarray(pos, dataEnd);
    pos = nextBoundary + boundaryBuf.length;

    // Parse headers
    const nameMatch = headerStr.match(/name="([^"]+)"/);
    const filenameMatch = headerStr.match(/filename="([^"]+)"/);
    const contentTypeMatch = headerStr.match(/Content-Type:\s*(.+)/i);

    if (nameMatch) {
      parts.push({
        name: nameMatch[1],
        filename: filenameMatch?.[1],
        contentType: contentTypeMatch?.[1]?.trim(),
        data,
      });
    }
  }

  return parts;
}

/**
 * Read the full request body into a Buffer (for multipart handling).
 * Enforces the max file size limit at the request level.
 */
export function readRawBody(
  req: import("http").IncomingMessage,
  maxBytes: number = MAX_FILE_SIZE + 64 * 1024, // file + form fields headroom
): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const chunks: Buffer[] = [];
    let total = 0;

    req.on("data", (chunk: Buffer) => {
      total += chunk.length;
      if (total > maxBytes) {
        reject(new Error(`Request body exceeds ${maxBytes} bytes`));
        req.destroy();
        return;
      }
      chunks.push(chunk);
    });

    req.on("end", () => resolve(Buffer.concat(chunks)));
    req.on("error", reject);
  });
}
