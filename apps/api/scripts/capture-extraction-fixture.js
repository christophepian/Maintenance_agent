/**
 * Capture a real régie extraction into a golden fixture for the regression corpus.
 *
 * Reads a stored vision extraction (the canonical CSVs) and writes a fixture that
 * `extractionGolden.test.ts` replays through the invariant pipeline. This is how we
 * lock in each new format we conquer: one fixture per statement, forever guarded.
 *
 * Usage (from apps/api):
 *   # by cache key (needs DATABASE_URL pointing at the DB that holds the extraction)
 *   node scripts/capture-extraction-fixture.js "<cacheKey>" <fixture-name>
 *   # newest package extraction, no key needed
 *   node scripts/capture-extraction-fixture.js --latest <fixture-name>
 *   # from a payload JSON exported via Supabase SQL (no DB access needed):
 *   #   SELECT payload FROM "ExtractionCache" WHERE "cacheKey" = '...';   → save as payload.json
 *   node scripts/capture-extraction-fixture.js --from-json payload.json <fixture-name>
 *
 * Then fill in the expectations and review them:
 *   UPDATE_GOLDENS=1 npx jest extractionGolden
 *   git diff apps/api/src/__tests__/fixtures/extractions/   # sanity-check GREEN/RED before commit
 */
const fs = require("fs");
const path = require("path");

const OUT_DIR = path.join(__dirname, "..", "src", "__tests__", "fixtures", "extractions");

/** Classify a canonical CSV by the section labels it carries (format-agnostic). */
function classify(text) {
  const t = String(text).toUpperCase();
  const hasBs = /;ACTIF|;PASSIF/.test(t);
  const hasIs = /;REVENUE|;EXPENSE/.test(t);
  if (hasBs && !hasIs) return "BALANCE_SHEET";
  if (hasIs && !hasBs) return "INCOME_STATEMENT";
  return null; // rent roll / general ledger / mixed — not part of the BS/IS invariant set
}

async function loadPayload(args) {
  const jsonIdx = args.indexOf("--from-json");
  if (jsonIdx !== -1) {
    const file = args[jsonIdx + 1];
    if (!file) throw new Error("--from-json requires a file path");
    const raw = JSON.parse(fs.readFileSync(file, "utf8"));
    // Accept either the payload array directly, or a [{ payload: [...] }] SQL result.
    return Array.isArray(raw) ? raw : raw.payload ?? raw[0]?.payload;
  }
  const { PrismaClient } = require("@prisma/client");
  const p = new PrismaClient();
  try {
    const latest = args.includes("--latest");
    const cacheKey = args.find((a) => !a.startsWith("--") && a.includes("|"));
    const row = await p.extractionCache.findFirst({
      where: latest ? { cacheKey: { contains: "|pkg|" } } : { cacheKey },
      orderBy: { createdAt: "desc" },
    });
    if (!row) throw new Error(`No ExtractionCache row for ${latest ? "--latest pkg" : cacheKey}`);
    return row.payload;
  } finally {
    await p.$disconnect();
  }
}

(async () => {
  const args = process.argv.slice(2);
  const name = args[args.length - 1];
  if (!name || name.startsWith("--") || name.includes("|")) {
    console.error("Usage: node scripts/capture-extraction-fixture.js <cacheKey|--latest|--from-json file> <fixture-name>");
    process.exit(1);
  }

  const payload = await loadPayload(args);
  if (!Array.isArray(payload)) throw new Error("Payload is not an array of { fileName, text } files");

  const documents = [];
  for (const f of payload) {
    const text = f.text ?? f.csv;
    if (!text) continue;
    const type = classify(text);
    if (type) documents.push({ type, fileName: f.fileName ?? null, csv: text });
  }
  if (documents.length === 0) {
    console.error("No balance-sheet / income-statement CSVs found in the payload.");
    process.exit(1);
  }

  const fixture = {
    name,
    source: `captured from ExtractionCache (${documents.length} document(s): ${documents.map((d) => d.type).join(", ")})`,
    documents,
    // `expect` intentionally omitted — run `UPDATE_GOLDENS=1 npx jest extractionGolden`
    // to fill it from the current pipeline, then review the GREEN/RED before committing.
  };

  fs.mkdirSync(OUT_DIR, { recursive: true });
  const outPath = path.join(OUT_DIR, `${name}.json`);
  fs.writeFileSync(outPath, JSON.stringify(fixture, null, 2) + "\n");
  console.log(`Wrote ${outPath} with ${documents.length} document(s).`);
  console.log("Next: UPDATE_GOLDENS=1 npx jest extractionGolden  → then review + commit.");
})().catch((e) => {
  console.error(e.message || e);
  process.exit(1);
});
