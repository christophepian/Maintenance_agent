import * as fs from "fs";
import * as path from "path";
import * as crypto from "crypto";
import {
  S3Client,
  PutObjectCommand,
  GetObjectCommand,
  HeadObjectCommand,
  DeleteObjectCommand,
} from "@aws-sdk/client-s3";

/* ── Configuration ─────────────────────────────────────────── */

const STORAGE_BACKEND = process.env.ATTACHMENTS_STORAGE || "local";

/** Root directory for local file storage (dev only) */
const LOCAL_ROOT = path.resolve(
  process.env.ATTACHMENTS_LOCAL_ROOT ||
    path.join(__dirname, "..", "..", ".data", "uploads"),
);

/** Maximum file size for identity / rental-application documents: 5 MB */
export const MAX_FILE_SIZE = 5 * 1024 * 1024;

/** Maximum file size for generic put() uploads (e.g. imported statement PDFs): 25 MB */
export const MAX_PUT_FILE_SIZE = 25 * 1024 * 1024;

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

  /**
   * Resolve a storage key to an absolute path, ensuring it stays within
   * the storage root. Throws if the resolved path would escape the root
   * (path traversal defence for the local-disk backend).
   */
  private _safePath(key: string): string {
    const resolvedRoot = path.resolve(this.root);
    const resolvedFull = path.resolve(path.join(resolvedRoot, key));
    if (resolvedFull !== resolvedRoot && !resolvedFull.startsWith(resolvedRoot + path.sep)) {
      throw new Error(`Invalid storage key: path would escape storage root`);
    }
    return resolvedFull;
  }

  async put(key: string, buffer: Buffer): Promise<void> {
    if (buffer.length > MAX_PUT_FILE_SIZE) {
      throw new Error(`File exceeds maximum size of ${MAX_PUT_FILE_SIZE} bytes`);
    }
    const fullPath = this._safePath(key);
    const dir = path.dirname(fullPath);
    await fs.promises.mkdir(dir, { recursive: true });
    await fs.promises.writeFile(fullPath, buffer);
  }

  async get(key: string): Promise<Buffer> {
    const fullPath = this._safePath(key);
    return fs.promises.readFile(fullPath);
  }

  getStream(key: string): fs.ReadStream {
    const fullPath = this._safePath(key);
    return fs.createReadStream(fullPath);
  }

  async delete(key: string): Promise<void> {
    const fullPath = this._safePath(key);
    try {
      await fs.promises.unlink(fullPath);
    } catch (err: any) {
      // Ignore ENOENT — file already gone (idempotent delete)
      if (err.code !== "ENOENT") throw err;
    }
  }

  async exists(key: string): Promise<boolean> {
    const fullPath = this._safePath(key);
    try {
      await fs.promises.access(fullPath, fs.constants.F_OK);
      return true;
    } catch {
      return false;
    }
  }
}

/* ── S3-Compatible Storage Implementation ──────────────────── */

class S3AttachmentStorage implements AttachmentStorage {
  private client: S3Client;
  private bucket: string;

  constructor() {
    const region = process.env.S3_REGION;
    const bucket = process.env.S3_BUCKET;
    const accessKeyId = process.env.S3_ACCESS_KEY_ID;
    const secretAccessKey = process.env.S3_SECRET_ACCESS_KEY;

    if (!region) throw new Error("S3 storage: S3_REGION is required");
    if (!bucket) throw new Error("S3 storage: S3_BUCKET is required");
    if (!accessKeyId) throw new Error("S3 storage: S3_ACCESS_KEY_ID is required");
    if (!secretAccessKey) throw new Error("S3 storage: S3_SECRET_ACCESS_KEY is required");

    this.bucket = bucket;

    const clientConfig: ConstructorParameters<typeof S3Client>[0] = {
      region,
      credentials: { accessKeyId, secretAccessKey },
    };

    const endpoint = process.env.S3_ENDPOINT;
    if (endpoint) clientConfig.endpoint = endpoint;

    const forcePathStyle = process.env.S3_FORCE_PATH_STYLE;
    if (forcePathStyle === "true") clientConfig.forcePathStyle = true;

    this.client = new S3Client(clientConfig);
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

    const uniqueId = crypto.randomUUID();
    const safeName = opts.fileName.replace(/[^a-zA-Z0-9._-]/g, "_");
    const key = [
      opts.applicationId,
      opts.applicantId,
      opts.docType,
      `${uniqueId}-${safeName}`,
    ].join("/");

    await this.put(key, buffer, opts.mimeType);

    const sha256 = crypto.createHash("sha256").update(buffer).digest("hex");

    return { key, size: buffer.length, sha256, mimeType: opts.mimeType };
  }

  async put(key: string, buffer: Buffer, contentType?: string): Promise<void> {
    if (buffer.length > MAX_PUT_FILE_SIZE) {
      throw new Error(`File exceeds maximum size of ${MAX_PUT_FILE_SIZE} bytes`);
    }
    await this.client.send(
      new PutObjectCommand({
        Bucket: this.bucket,
        Key: key,
        Body: buffer,
        ContentType: contentType,
        ContentLength: buffer.length,
      }),
    );
  }

  async get(key: string): Promise<Buffer> {
    const response = await this.client.send(
      new GetObjectCommand({ Bucket: this.bucket, Key: key }),
    );
    if (!response.Body) {
      throw new Error(`S3 object not found or empty: ${key}`);
    }
    // Body is a Readable stream in Node.js — collect chunks into a Buffer
    const chunks: Uint8Array[] = [];
    for await (const chunk of response.Body as AsyncIterable<Uint8Array>) {
      chunks.push(chunk);
    }
    return Buffer.concat(chunks);
  }

  getStream(_key: string): fs.ReadStream {
    // S3 streaming is async; getStream() is not called anywhere in this codebase.
    throw new Error("getStream() is not supported for S3 storage. Use get() instead.");
  }

  async delete(key: string): Promise<void> {
    await this.client.send(
      new DeleteObjectCommand({ Bucket: this.bucket, Key: key }),
    );
  }

  async exists(key: string): Promise<boolean> {
    try {
      await this.client.send(
        new HeadObjectCommand({ Bucket: this.bucket, Key: key }),
      );
      return true;
    } catch (err: any) {
      // HeadObject throws with $metadata.httpStatusCode 404 or name "NotFound"
      if (
        err.$metadata?.httpStatusCode === 404 ||
        err.name === "NotFound" ||
        err.name === "NoSuchKey"
      ) {
        return false;
      }
      throw err;
    }
  }
}

/* ── Factory ───────────────────────────────────────────────── */

function createStorage(): AttachmentStorage {
  switch (STORAGE_BACKEND) {
    case "local":
      return new LocalDiskStorage(LOCAL_ROOT);
    case "s3":
      return new S3AttachmentStorage();
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
