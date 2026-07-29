import { aggregateImportedPnl, classifyRegieExpenseAccount } from "../services/financials";

describe("classifyRegieExpenseAccount", () => {
  const cases: [string, string][] = [
    ["Rénovation immeuble", "CAPEX"],
    ["Rénovation objets", "CAPEX"],
    ["Transformation cuisine", "CAPEX"],
    ["Intérêts hypothécaires", "FINANCING"],
    ["Frais chauffage", "RECOVERABLE"],
    ["Eau", "RECOVERABLE"],
    ["Electricité", "RECOVERABLE"],
    ["Salaires concierges", "RECOVERABLE"],
    ["Conciergeries externes", "RECOVERABLE"],
    ["Entretien des appartements", "OWNER_OPEX"], // upkeep, NOT capex
    ["Entretien immeuble", "OWNER_OPEX"],
    ["Entretien à charge du locataire", "TENANT_RECHARGE"], // tenant-owed receivable, excluded from NOI
    ["Entretien à charge locataire", "TENANT_RECHARGE"],
    ["Travaux refacturés au locataire", "TENANT_RECHARGE"],
    ["Créances locataires irrécouvrables", "OWNER_OPEX"], // bad debt is an owner cost
    ["Assurances", "OWNER_OPEX"],
    ["Honoraires de gérance", "OWNER_OPEX"],
    ["Impôts et taxes", "OWNER_OPEX"],
    ["Frais bancaires ou postaux", "OWNER_OPEX"], // bank fees are not financing
  ];
  it.each(cases)("classifies %s as %s", (name, expected) => {
    expect(classifyRegieExpenseAccount(null, name)).toBe(expected);
  });

  it("does not mistake 'niveau' or 'bureau' for eau", () => {
    expect(classifyRegieExpenseAccount(null, "Frais de bureau")).toBe("OWNER_OPEX");
  });

  it("buckets an income statement, excluding capex + financing from operating", () => {
    const r = aggregateImportedPnl([
      { documentSection: "REVENUE", balanceCents: 10_000_00, rawAccountName: "Loyers", rawAccountCode: "3000", account: null },
      { documentSection: "EXPENSE", balanceCents: 5_000_00, rawAccountName: "Rénovation immeuble", rawAccountCode: "6010", account: null },
      { documentSection: "EXPENSE", balanceCents: 800_00, rawAccountName: "Intérêts hypothécaires", rawAccountCode: "6800", account: null },
      { documentSection: "EXPENSE", balanceCents: 600_00, rawAccountName: "Frais chauffage", rawAccountCode: "4030", account: null },
      { documentSection: "EXPENSE", balanceCents: 400_00, rawAccountName: "Entretien immeuble", rawAccountCode: "4000", account: null },
      { documentSection: "EXPENSE", balanceCents: 300_00, rawAccountName: "Entretien à charge du locataire", rawAccountCode: "4120", account: null },
    ]);
    expect(r.capexCents).toBe(5_000_00);
    expect(r.financingCents).toBe(800_00);
    expect(r.recoverableCents).toBe(600_00);
    expect(r.tenantRechargeCents).toBe(300_00);
    expect(r.ownerOpexCents).toBe(400_00);
    expect(r.expenseCents).toBe(7_100_00); // all five
    // operating (owner opex + recoverable) = expenses − capex − financing − tenant recharge
    expect(r.expenseCents - r.capexCents - r.financingCents - r.tenantRechargeCents).toBe(1_000_00);
  });
});

describe("aggregateImportedPnl", () => {
  it("sums REVENUE and EXPENSE balances and lists expenses by account (desc)", () => {
    const balances = [
      { documentSection: "REVENUE", balanceCents: 16267200, rawAccountName: "Loyer net", rawAccountCode: "3000", account: null },
      { documentSection: "REVENUE", balanceCents: 30160, rawAccountName: "Produit divers", rawAccountCode: "3610", account: null },
      { documentSection: "EXPENSE", balanceCents: 4200000, rawAccountName: "Entretien", rawAccountCode: "6000", account: null },
      { documentSection: "EXPENSE", balanceCents: 780000, rawAccountName: "Admin", rawAccountCode: "6500", account: null },
    ];
    const { revenueCents, expenseCents, expensesByAccount } = aggregateImportedPnl(balances);
    expect(revenueCents).toBe(16297360);
    expect(expenseCents).toBe(4980000);
    // net = revenue − expense
    expect(revenueCents - expenseCents).toBe(11317360);
    // expenses sorted desc, only EXPENSE rows
    expect(expensesByAccount.map((e) => e.accountCode)).toEqual(["6000", "6500"]);
    expect(expensesByAccount[0].totalCents).toBe(4200000);
  });

  it("ignores balance-sheet sections and handles contra (negative) revenue", () => {
    const balances = [
      { documentSection: "ACTIF", balanceCents: 5000, rawAccountName: "Caisse", rawAccountCode: "1000", account: null },
      { documentSection: "PASSIF", balanceCents: 9000, rawAccountName: "Créancier", rawAccountCode: "2000", account: null },
      { documentSection: "REVENUE", balanceCents: 10000, rawAccountName: "Loyers", rawAccountCode: "3000", account: null },
      { documentSection: "REVENUE", balanceCents: -400, rawAccountName: "Rabais", rawAccountCode: "3010", account: null },
    ];
    const { revenueCents, expenseCents } = aggregateImportedPnl(balances);
    expect(revenueCents).toBe(9600); // 10000 − 400, balance-sheet rows ignored
    expect(expenseCents).toBe(0);
  });

  it("prefers the régie's own (raw) name/code but keeps the linked accountId", () => {
    // Régie charts collide with our canonical COA codes (régie 4600 "Honoraires de
    // gestion" == our 4600 "Property Tax"), so the raw line is the faithful label.
    const balances = [
      {
        documentSection: "EXPENSE",
        balanceCents: 1000,
        rawAccountName: "Honoraires de gestion",
        rawAccountCode: "4600",
        account: { id: "acc-1", code: "4600", name: "Property Tax" },
      },
    ];
    const { expensesByAccount } = aggregateImportedPnl(balances);
    expect(expensesByAccount[0]).toMatchObject({ accountId: "acc-1", accountName: "Honoraires de gestion", accountCode: "4600" });
  });
});
