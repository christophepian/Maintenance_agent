import { computeBalanceImbalanceCents, computeStatementSanityFlags } from "../services/importedStatementService";

describe("computeStatementSanityFlags", () => {
  const rev = (name: string, cents: number) => ({ documentSection: "REVENUE", balanceCents: cents, rawAccountName: name });
  const exp = (name: string, cents: number) => ({ documentSection: "EXPENSE", balanceCents: cents, rawAccountName: name });

  it("flags a management fee mis-read as CHF 9 (the 7'134→9 case)", () => {
    const flags = computeStatementSanityFlags([
      rev("Loyers nets", 200_000_00),
      exp("Honoraires de gérance", 9_00),
      exp("Entretien", 40_000_00),
      exp("Assurances", 8_000_00),
    ]);
    expect(flags.some((f) => f.code === "FEE_IMPLAUSIBLY_LOW")).toBe(true);
  });

  it("does not flag a plausible ~4% management fee", () => {
    const flags = computeStatementSanityFlags([
      rev("Loyers nets", 200_000_00),
      exp("Honoraires de gérance", 8_000_00), // 4%
      exp("Entretien", 40_000_00),
      exp("Assurances", 8_000_00),
    ]);
    expect(flags.some((f) => f.code.startsWith("FEE_"))).toBe(false);
  });

  it("flags one expense account dominating the total", () => {
    const flags = computeStatementSanityFlags([
      rev("Loyers", 100_000_00),
      exp("Rénovation", 90_000_00),
      exp("Assurances", 5_000_00),
      exp("Frais divers", 5_000_00),
    ]);
    expect(flags.some((f) => f.code === "DOMINANT_EXPENSE")).toBe(true);
  });

  it("returns nothing for a balance sheet (no P&L rows)", () => {
    expect(computeStatementSanityFlags([
      { documentSection: "ACTIF", balanceCents: 100_00, rawAccountName: "Caisse" },
      { documentSection: "PASSIF", balanceCents: 100_00, rawAccountName: "Créancier" },
    ])).toEqual([]);
  });
});

describe("computeBalanceImbalanceCents", () => {
  it("uses documentSection for the Actif/Passif split — an asset-coded account placed in Passifs counts as Passif", () => {
    // 11200 "Créances diverses" (3.85) has an asset-range code but the régie
    // placed it under Passifs. By section it balances; by code it would be off
    // by 2 × 3.85 = 7.70.
    const balances = [
      { rawAccountCode: "10200", balanceCents: 10000, balanceType: "DEBIT", documentSection: "ACTIF" },
      { rawAccountCode: "11200", balanceCents: 385, balanceType: "CREDIT", documentSection: "PASSIF" },
      { rawAccountCode: "20000", balanceCents: 9615, balanceType: "CREDIT", documentSection: "PASSIF" },
    ];
    expect(computeBalanceImbalanceCents(balances)).toBe(0); // was 770 under code-only bucketing
  });

  it("falls back to the account code when documentSection is not a balance-sheet side (OCR mislabel of equity 2900 as REVENUE)", () => {
    const balances = [
      { rawAccountCode: "10000", balanceCents: 10000, balanceType: "DEBIT", documentSection: "ACTIF" },
      { rawAccountCode: "2900", balanceCents: 10000, balanceType: "CREDIT", documentSection: "REVENUE" },
    ];
    expect(computeBalanceImbalanceCents(balances)).toBe(0); // 2900 → code prefix → Passif
  });

  it("returns net income for a P&L (not zero)", () => {
    const balances = [
      { rawAccountCode: "3000", balanceCents: 100000, balanceType: "CREDIT", documentSection: "REVENUE" },
      { rawAccountCode: "4000", balanceCents: 30000, balanceType: "DEBIT", documentSection: "EXPENSE" },
    ];
    expect(computeBalanceImbalanceCents(balances)).toBe(70000);
  });

  it("returns null when there are no balances", () => {
    expect(computeBalanceImbalanceCents([])).toBeNull();
  });
});
