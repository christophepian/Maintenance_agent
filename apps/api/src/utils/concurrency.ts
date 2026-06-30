/**
 * Bounded-concurrency async map.
 *
 * Runs `fn` over `items` with at most `limit` invocations in flight at once,
 * preserving input order in the returned array. Used where a naive
 * `Promise.all(items.map(fn))` would fan out far enough to saturate the Prisma
 * connection pool (which defaults to ~`num_cpus * 2 + 1` when no
 * `connection_limit` is set) — e.g. portfolio aggregation where each item
 * itself issues many queries.
 *
 * A rejection from any `fn` rejects the whole call (same semantics as
 * Promise.all); handle per-item failures inside `fn` if partial results are
 * desired.
 */
export async function mapWithConcurrency<T, R>(
  items: readonly T[],
  limit: number,
  fn: (item: T, index: number) => Promise<R>,
): Promise<R[]> {
  const results = new Array<R>(items.length);
  if (items.length === 0) return results;
  const effectiveLimit = Math.max(1, Math.min(limit, items.length));

  let cursor = 0;
  async function worker(): Promise<void> {
    while (cursor < items.length) {
      const index = cursor++;
      results[index] = await fn(items[index], index);
    }
  }

  await Promise.all(Array.from({ length: effectiveLimit }, () => worker()));
  return results;
}
