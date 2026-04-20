/**
 * Topic Normalization — Canonical Topic Key
 *
 * `topic` is the PRIMARY depreciation key in the asset domain model.
 * Depreciation standards, replacement benchmarks, and cost estimation all
 * match on topic. Matching MUST be canonicalized to avoid silent misses
 * caused by case differences ("Kitchen" vs "kitchen"), leading/trailing
 * whitespace, or inconsistent separators ("parquet mosaic" vs "PARQUET_MOSAIC").
 *
 * Normalization rules (applied in order):
 *   1. Trim leading/trailing whitespace
 *   2. Collapse internal whitespace runs to a single underscore
 *   3. Replace hyphens with underscores
 *   4. Convert to UPPER_CASE
 *
 * Examples:
 *   "Kitchen"            → "KITCHEN"
 *   " parquet mosaic  "  → "PARQUET_MOSAIC"
 *   "Parquet-Mosaic"     → "PARQUET_MOSAIC"
 *   "DISHWASHER"         → "DISHWASHER"
 *   "stove cooktop"      → "STOVE_COOKTOP"
 *
 * ─── Future: Controlled Vocabulary ──────────────────────────────
 *
 * Today topic is a free-text string and this normalizer handles the most
 * common equivalence classes. The next step would be a controlled vocabulary
 * (either a Prisma enum or a `TopicRegistry` reference table) so that:
 *   - Invalid topics are rejected at creation time
 *   - Autocomplete/dropdown in the UI replaces free-text input
 *   - Depreciation standard seeding guarantees coverage
 *
 * That registry would fit as:
 *   model TopicRegistry { key String @id; label String; assetType AssetType }
 * ...or as a simple enum if the list is small and stable.
 * For now, free-text + normalization is the incremental approach.
 */

/**
 * Normalize a topic value to its canonical key form.
 *
 * This function MUST be used wherever topic-based matching occurs:
 *   - Depreciation standard lookup (resolveUsefulLife)
 *   - Replacement benchmark lookup (findBenchmark)
 *   - Historical replacement cost queries
 *   - Asset upsert dedup matching
 *   - DTO mapping (topicKey field)
 */
export function normalizeTopicKey(topic: string): string {
  return topic
    .trim()
    .replace(/[\s]+/g, "_")   // whitespace runs → underscore
    .replace(/-/g, "_")       // hyphens → underscore
    .toUpperCase();
}
