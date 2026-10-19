import { buildDemoPackage, demoPackageSummary } from "../services/demoPackage";
import { detectDocumentType } from "../services/packageDetector";
import { mapRentRoll } from "../services/rentRollMapper";
import { mapCsvToAccountBalances } from "../services/csvAccountingMapper";
import { mapRegieLedger } from "../services/regieLedgerMapper";

describe("demo package round-trips through the real pipeline", () => {
  const files = buildDemoPackage(2025);
  const byType = Object.fromEntries(
    files.map((f) => [detectDocumentType(f.fileName, f.text), f]),
  );

  it("emits every document type the reporting tab needs", () => {
    expect(Object.keys(byType).sort()).toEqual(
      ["BALANCE_SHEET", "GENERAL_INFO", "GENERAL_LEDGER", "INCOME_STATEMENT", "RENT_ROLL"].sort(),
    );
  });

  it("rent roll maps to units, tenants and the vacant objects", () => {
    const { rows, skipped } = mapRentRoll(byType.RENT_ROLL.text);
    expect(skipped).toEqual([]);
    expect(rows).toHaveLength(12);
    expect(rows.filter((r: any) => r.isVacant)).toHaveLength(2);
    expect(rows.filter((r: any) => r.unitType === "PARKING")).toHaveLength(4);
  });

  it("income statement maps, with revenue and expense sections and stated totals", () => {
    const { items, skipped, statedTotals } = mapCsvToAccountBalances(byType.INCOME_STATEMENT.text);
    expect(skipped).toEqual([]);
    expect(items.some((i) => i.documentSection === "REVENUE")).toBe(true);
    expect(items.filter((i) => i.documentSection === "EXPENSE").length).toBeGreaterThan(5);
    // Extracted expense lines must tie out to the document's own stated total,
    // or the statement can never be approved (and reporting stays empty).
    const expenseSum = items
      .filter((i) => i.documentSection === "EXPENSE")
      .reduce((s, i) => s + i.balanceChf, 0);
    expect(expenseSum).toBeCloseTo(statedTotals!.EXPENSE!, 2);
  });

  it("balance sheet balances — ACTIF equals PASSIF", () => {
    const { items, skipped } = mapCsvToAccountBalances(byType.BALANCE_SHEET.text);
    expect(skipped).toEqual([]);
    const side = (s: string) =>
      items.filter((i) => i.documentSection === s).reduce((a, i) => a + i.balanceChf, 0);
    expect(side("ACTIF")).toBeCloseTo(side("PASSIF"), 2);
  });

  it("general ledger maps to vendor invoices, some attributed to a unit", () => {
    const { invoices, skipped, summary } = mapRegieLedger(byType.GENERAL_LEDGER.text);
    expect(skipped).toEqual([]);
    expect(invoices.length).toBeGreaterThan(15);
    expect(invoices.every((i) => i.vendorName && i.pieceKey)).toBe(true);
    // Per-unit attribution is what drives the unit-cost breakdown on Reporting.
    expect(summary.unitAttributed).toBeGreaterThan(0);
  });

  it("gives each fiscal year distinct piece numbers", () => {
    // The ledger import dedupes on the piece key — years sharing piece numbers
    // would silently drop the second year's vendor invoices.
    const pieces = (year: number) =>
      new Set(
        mapRegieLedger(
          buildDemoPackage(year).find((f) => detectDocumentType(f.fileName, f.text) === "GENERAL_LEDGER")!.text,
        ).invoices.map((i) => i.pieceKey),
      );
    const a = pieces(2024);
    const b = pieces(2025);
    expect(a.size).toBeGreaterThan(15);
    expect([...a].filter((p) => b.has(p))).toEqual([]);
  });

  it("is deterministic", () => {
    expect(buildDemoPackage(2025)).toEqual(files);
  });

  it("reports a plausible summary", () => {
    const s = demoPackageSummary(2025);
    expect(s.units).toBe(12);
    expect(s.vacantUnits).toBe(2);
    expect(s.collectedRentChf).toBeGreaterThan(0);
    expect(s.expensesChf).toBeGreaterThan(0);
  });
});
