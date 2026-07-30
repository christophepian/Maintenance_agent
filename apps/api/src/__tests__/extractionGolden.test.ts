/**
 * Golden-file regression harness for régie statement extraction.
 *
 * Each fixture in fixtures/extractions/*.json is a captured (or synthetic) set of
 * canonical CSVs — the same shape the vision extractor produces — plus the expected
 * reconciliation status and confidence tier per document. This test replays every
 * fixture through the SAME format-agnostic invariant pipeline the app uses on
 * approval (mapCsvToAccountBalances → reconcileBalances → cross-statement check →
 * computeConfidenceTier) and asserts the verdict hasn't drifted.
 *
 * This is how we scale to many formats without breaking the ones already conquered:
 * every real statement becomes a permanent fixture. Capture new ones with
 *   node apps/api/scripts/capture-extraction-fixture.js <cacheKey|--from-json file> <name>
 * then fill in / refresh the expectations with:
 *   UPDATE_GOLDENS=1 npx jest extractionGolden
 * (review the diff before committing — an UPDATE that flips a GREEN to RED is a bug,
 * not a new baseline).
 */
import * as fs from "fs";
import * as path from "path";
import { mapCsvToAccountBalances, reconcileBalances } from "../services/csvAccountingMapper";
import {
  computeStatementSanityFlags,
  computeCrossStatementResult,
  computeConfidenceTier,
} from "../services/importedStatementService";

const FIXTURES_DIR = path.join(__dirname, "fixtures", "extractions");
const UPDATE = process.env.UPDATE_GOLDENS === "1";

type DocType = "BALANCE_SHEET" | "INCOME_STATEMENT";
interface FixtureDoc { type: DocType; csv: string; ocrConfidence?: number | null }
interface Fixture {
  name: string;
  source?: string;
  documents: FixtureDoc[];
  expect?: Record<string, { reconciliation: string; tier: string }>;
}

/** Parse one canonical CSV into the cents-based balance shape the invariants use. */
function toBalances(csv: string) {
  const { items, statedTotals } = mapCsvToAccountBalances(csv);
  const balances = items.map((i) => ({
    documentSection: i.documentSection,
    balanceCents: Math.round(i.balanceChf * 100),
    balanceType: i.balanceType,
    rawAccountCode: i.rawAccountCode,
    rawAccountName: i.rawAccountName,
    account: null,
  }));
  const statedTotalsCents = Object.fromEntries(
    Object.entries(statedTotals ?? {}).map(([k, v]) => [k, Math.round((v as number) * 100)]),
  );
  return { balances, statedTotalsCents };
}

/** Replay a fixture's documents through the invariant pipeline → verdict per document. */
function replay(fixture: Fixture): Record<string, { reconciliation: string; tier: string }> {
  const docs = fixture.documents.map((d) => ({ ...d, ...toBalances(d.csv) }));
  const bs = docs.find((d) => d.type === "BALANCE_SHEET");
  const is = docs.find((d) => d.type === "INCOME_STATEMENT");
  // Cross-statement result check needs both sides; both statements share the verdict.
  const crossCheck = bs && is ? computeCrossStatementResult(is.balances, bs.balances) : null;

  const out: Record<string, { reconciliation: string; tier: string }> = {};
  for (const d of docs) {
    const reconciliation = reconcileBalances(d.balances, d.statedTotalsCents);
    const sanityFlags = computeStatementSanityFlags(d.balances);
    const confidence = computeConfidenceTier({
      reconciliation,
      crossCheck,
      sanityFlags,
      ocrConfidence: d.ocrConfidence ?? null,
    });
    out[d.type] = { reconciliation: reconciliation.status, tier: confidence.tier };
  }
  return out;
}

const files = fs.existsSync(FIXTURES_DIR)
  ? fs.readdirSync(FIXTURES_DIR).filter((f) => f.endsWith(".json"))
  : [];

describe("extraction golden fixtures (invariant-based regression corpus)", () => {
  it("has at least one fixture", () => {
    expect(files.length).toBeGreaterThan(0);
  });

  for (const file of files) {
    const fixturePath = path.join(FIXTURES_DIR, file);
    const fixture: Fixture = JSON.parse(fs.readFileSync(fixturePath, "utf8"));

    it(`${fixture.name}: reconciliation + confidence tier match the golden`, () => {
      const actual = replay(fixture);

      if (UPDATE) {
        fixture.expect = actual;
        fs.writeFileSync(fixturePath, JSON.stringify(fixture, null, 2) + "\n");
        return; // regenerating baselines — nothing to assert
      }

      expect(fixture.expect).toBeDefined();
      expect(actual).toEqual(fixture.expect);
    });
  }
});
