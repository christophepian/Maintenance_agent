import { computeBalanceImbalanceCents, computeStatementSanityFlags, computeContinuityFlags, computeSuggestedCorrections } from "../services/importedStatementService";

describe("computeSuggestedCorrections", () => {
  const exp = (id: string, code: string, name: string, cents: number) => ({ id, documentSection: "EXPENSE", balanceCents: cents, rawAccountCode: code, rawAccountName: name });

  it("suggests restoring gérance to its prior value to make Charges tie out (9→7'134)", () => {
    const current = [exp("b1", "6500", "Honoraires de gérance", 9_00), exp("b2", "6000", "Entretien", 40_000_00), exp("b3", "6200", "Assurances", 8_000_00)];
    const prior = [exp("p1", "6500", "Honoraires de gérance", 7_134_00), exp("p2", "6000", "Entretien", 40_000_00)];
    const statedExpenseCents = 7_134_00 + 40_000_00 + 8_000_00; // the document's own Total Charges
    const s = computeSuggestedCorrections(current, prior, { EXPENSE: statedExpenseCents }, 2023);
    expect(s).toHaveLength(1);
    expect(s[0]).toMatchObject({ balanceId: "b1", currentCents: 9_00, suggestedCents: 7_134_00 });
  });

  it("suggests nothing when the section already ties out", () => {
    const current = [exp("b1", "6500", "Gérance", 7_100_00), exp("b2", "6000", "Entretien", 40_000_00)];
    const prior = [exp("p1", "6500", "Gérance", 7_000_00)];
    expect(computeSuggestedCorrections(current, prior, { EXPENSE: 47_100_00 }, 2023)).toEqual([]);
  });

  it("suggests nothing without stated totals", () => {
    const current = [exp("b1", "6500", "Gérance", 9_00)];
    const prior = [exp("p1", "6500", "Gérance", 7_134_00)];
    expect(computeSuggestedCorrections(current, prior, null, 2023)).toEqual([]);
  });
});

describe("computeContinuityFlags (year-over-year)", () => {
  const exp = (code: string, name: string, cents: number) => ({ documentSection: "EXPENSE", balanceCents: cents, rawAccountCode: code, rawAccountName: name });

  it("flags the 7'134→9 gérance mis-read as a material swing", () => {
    const prior = [exp("6500", "Honoraires de gérance", 7_134_00), exp("6000", "Entretien", 40_000_00)];
    const current = [exp("6500", "Honoraires de gérance", 9_00), exp("6000", "Entretien", 41_000_00)];
    const flags = computeContinuityFlags(current, prior, 2023);
    expect(flags.some((f) => f.code === "YOY_SWING" && /gérance/i.test(f.message))).toBe(true);
  });

  it("flags an account that vanished vs the prior year", () => {
    const prior = [exp("6500", "Honoraires de gérance", 7_000_00), exp("6800", "Intérêts hypothécaires", 12_000_00)];
    const current = [exp("6500", "Honoraires de gérance", 7_100_00)];
    const flags = computeContinuityFlags(current, prior, 2023);
    expect(flags.some((f) => f.code === "YOY_VANISHED")).toBe(true);
  });

  it("does not flag stable year-over-year figures", () => {
    const prior = [exp("6500", "Gérance", 7_000_00), exp("6000", "Entretien", 40_000_00)];
    const current = [exp("6500", "Gérance", 7_200_00), exp("6000", "Entretien", 41_000_00)];
    expect(computeContinuityFlags(current, prior, 2023)).toEqual([]);
  });

  it("returns nothing for balance-sheet rows", () => {
    const prior = [{ documentSection: "ACTIF", balanceCents: 100_00, rawAccountCode: "1000", rawAccountName: "Caisse" }];
    const current = [{ documentSection: "ACTIF", balanceCents: 900_00, rawAccountCode: "1000", rawAccountName: "Caisse" }];
    expect(computeContinuityFlags(current, prior, 2023)).toEqual([]);
  });
});

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
