export type QueryParams = Record<string, string[]>;

/**
 * Parse query string from a raw URL like "/requests?limit=50&order=desc"
 * into a multi-value map.
 */
export function parseQuery(url?: string): { path: string; query: QueryParams } {
  const raw = url || "/";
  const [path, qs = ""] = raw.split("?", 2);
  const query: QueryParams = {};

  if (!qs) return { path, query };

  for (const part of qs.split("&")) {
    if (!part) continue;
    const [kRaw, vRaw = ""] = part.split("=", 2);
    const k = decodeURIComponent(kRaw || "").trim();
    if (!k) continue;

    const v = decodeURIComponent(vRaw || "");
    if (!query[k]) query[k] = [];
    query[k].push(v);
  }

  return { path, query };
}

export function first(query: QueryParams, key: string): string | undefined {
  const v = query[key];
  if (!v || v.length === 0) return undefined;
  return v[0];
}

export function getIntParam(
  query: QueryParams,
  key: string,
  opts: { defaultValue: number; min?: number; max?: number }
): number {
  const raw = first(query, key);
  if (raw == null || raw === "") return opts.defaultValue;

  const n = Number(raw);
  if (!Number.isFinite(n) || !Number.isInteger(n)) return opts.defaultValue;

  if (opts.min != null && n < opts.min) return opts.min;
  if (opts.max != null && n > opts.max) return opts.max;

  return n;
}

export function getEnumParam<T extends readonly string[]>(
  query: QueryParams,
  key: string,
  allowed: T,
  defaultValue: T[number]
): T[number] {
  const raw = first(query, key);
  if (!raw) return defaultValue;
  return (allowed as readonly string[]).includes(raw) ? (raw as T[number]) : defaultValue;
}
