import { aggregateImportedPnl } from "../services/financials";

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

  it("prefers the linked account's code/name over the raw values", () => {
    const balances = [
      {
        documentSection: "EXPENSE",
        balanceCents: 1000,
        rawAccountName: "raw name",
        rawAccountCode: "6000",
        account: { id: "acc-1", code: "6000", name: "Entretien courant" },
      },
    ];
    const { expensesByAccount } = aggregateImportedPnl(balances);
    expect(expensesByAccount[0]).toMatchObject({ accountId: "acc-1", accountName: "Entretien courant", accountCode: "6000" });
  });
});
