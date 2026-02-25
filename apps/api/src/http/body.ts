import * as http from "http";
import { z } from "zod";
import { InvalidJsonError, PayloadTooLargeError, ValidationError } from "./errors";

/**
 * Reliable JSON body reader (buffer-based).
 *
 * Throws `InvalidJsonError` (400) or `PayloadTooLargeError` (413) — both
 * extend `HttpError`, so the Router's error handler will auto-map them.
 */
export function readJson(req: http.IncomingMessage): Promise<any> {
  return new Promise((resolve, reject) => {
    const chunks: Buffer[] = [];

    req.on("data", (chunk) => {
      chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
      const total = chunks.reduce((n, b) => n + b.length, 0);
      if (total > 1_000_000) {
        reject(new PayloadTooLargeError());
        req.destroy();
      }
    });

    req.on("end", () => {
      const text = Buffer.concat(chunks).toString("utf8");
      if (!text) return resolve({});
      try {
        resolve(JSON.parse(text));
      } catch {
        reject(new InvalidJsonError());
      }
    });

    req.on("error", reject);
  });
}

/**
 * Read JSON body **and** validate against a Zod schema in one step.
 *
 * Throws:
 *  • `InvalidJsonError`   (400) — malformed JSON
 *  • `PayloadTooLargeError` (413) — body > 1 MB
 *  • `ValidationError`    (400) — Zod schema mismatch
 *
 * All extend `HttpError`, so handlers can simply let them propagate and
 * the Router will auto-respond with the correct status + code.
 *
 * Example:
 *   const input = await parseBody(req, UpdateOrgConfigSchema);
 *   // `input` is fully typed as z.infer<typeof UpdateOrgConfigSchema>
 */
export async function parseBody<T>(
  req: http.IncomingMessage,
  schema: z.ZodType<T>,
): Promise<T> {
  const raw = await readJson(req);
  const result = schema.safeParse(raw);
  if (!result.success) {
    throw new ValidationError("Invalid request body", result.error.flatten());
  }
  return result.data;
}
