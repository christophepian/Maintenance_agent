import {
  mapCsvToAccountBalances,
  mapCsvToInvoiceLines,
} from "../services/csvAccountingMapper";

describe("mapCsvToAccountBalances", () => {
  it("maps rows and derives section + balanceType from the account code", () => {
    const csv =
      "accountCode,accountName,balanceChf\n" +
      "1000,Caisse,1'234.50\n" + // ACTIF positive → DEBIT
      "2000,Créanciers,5000\n" + // PASSIF positive → CREDIT
      "3000,Produits,-200\n"; //   REVENUE negative → DEBIT
    const { items, skipped } = mapCsvToAccountBalances(csv);
    expect(skipped).toEqual([]);
    expect(items).toEqual([
      { rawAccountCode: "1000", rawAccountName: "Caisse", balanceChf: 1234.5, balanceType: "DEBIT", documentSection: "ACTIF" },
      { rawAccountCode: "2000", rawAccountName: "Créanciers", balanceChf: 5000, balanceType: "CREDIT", documentSection: "PASSIF" },
      { rawAccountCode: "3000", rawAccountName: "Produits", balanceChf: -200, balanceType: "DEBIT", documentSection: "REVENUE" },
    ]);
  });

  it("honours an explicit documentSection column over the derived one", () => {
    const csv = "accountCode,accountName,balanceChf,documentSection\n9999,Suspense,100,PASSIF";
    const { items } = mapCsvToAccountBalances(csv);
    expect(items[0].documentSection).toBe("PASSIF");
    expect(items[0].balanceType).toBe("CREDIT"); // PASSIF positive → CREDIT
  });

  it("skips rows missing a code or an amount, with notes", () => {
    const csv =
      "accountCode,accountName,balanceChf\n" +
      ",Orphan,100\n" + //     missing code
      "4000,Charges,abc\n" + // unparseable amount
      "4001,Charges OK,50\n";
    const { items, skipped } = mapCsvToAccountBalances(csv);
    expect(items.map((i) => i.rawAccountCode)).toEqual(["4001"]);
    expect(skipped).toHaveLength(2);
    expect(skipped[0]).toMatch(/missing account code/);
    expect(skipped[1]).toMatch(/invalid balance/);
  });

  it("resolves French headers (Compte/Libellé/Solde) case/accent-insensitively", () => {
    const csv = "Compte;Libellé;Solde\n1000;Caisse;1'234.50\n2000;Créanciers;5000";
    const { items, skipped } = mapCsvToAccountBalances(csv);
    expect(skipped).toEqual([]);
    expect(items).toHaveLength(2);
    expect(items[0]).toMatchObject({ rawAccountCode: "1000", rawAccountName: "Caisse", balanceChf: 1234.5, documentSection: "ACTIF" });
    expect(items[1]).toMatchObject({ rawAccountCode: "2000", documentSection: "PASSIF" });
  });

  it("handles a trial balance with separate Débit / Crédit columns", () => {
    const csv =
      "Compte;Désignation;Débit;Crédit\n" +
      "1000;Caisse;1234.50;\n" + //   asset in debit
      "2000;Créanciers;;5000.00\n" + // liability in credit
      "3000;Produits;;9000";
    const { items, skipped } = mapCsvToAccountBalances(csv);
    expect(skipped).toEqual([]);
    expect(items[0]).toMatchObject({ rawAccountCode: "1000", balanceChf: 1234.5, balanceType: "DEBIT", documentSection: "ACTIF" });
    expect(items[1]).toMatchObject({ rawAccountCode: "2000", balanceChf: 5000, balanceType: "CREDIT", documentSection: "PASSIF" });
    expect(items[2]).toMatchObject({ rawAccountCode: "3000", balanceType: "CREDIT", documentSection: "REVENUE" });
  });

  it("reports a clear note when no recognizable columns are present", () => {
    const { items, skipped } = mapCsvToAccountBalances("foo;bar\n1;2");
    expect(items).toEqual([]);
    expect(skipped[0]).toMatch(/No account-code column/);
  });

  it("handles a hierarchical export with a type column (imports only leaf accounts)", () => {
    const csv =
      "section\tgroupe\tsous_groupe\tcompte\tdesignation\tmontant_chf\ttype\n" +
      "Produit\t300\t\t\tProduit des loyers\t\tgroupe\n" +
      "Produit\t300\t3000\t\tLoyers pour tiers\t\tsous_groupe\n" +
      "Produit\t300\t3000\t30000\tLoyer net\t162672\tcompte\n" +
      "Produit\t300\t3000\t\tTotal Loyers\t162672\ttotal\n" +
      "Produit\t300\t\t\tTotal Produit des loyers\t162672\ttotal\n" +
      "Actif\t100\t1000\t10000\tCaisse\t5000\tcompte\n";
    const { items, skipped } = mapCsvToAccountBalances(csv);
    expect(skipped).toEqual([]); // groupe/sous_groupe/total rows skipped silently
    expect(items).toHaveLength(2); // only the two type=compte rows
    expect(items[0]).toMatchObject({
      rawAccountCode: "30000",
      rawAccountName: "Loyer net",
      balanceChf: 162672,
      documentSection: "REVENUE",
      balanceType: "CREDIT",
    });
    expect(items[1]).toMatchObject({
      rawAccountCode: "10000",
      documentSection: "ACTIF",
      balanceType: "DEBIT",
    });
  });
});

describe("mapCsvToInvoiceLines", () => {
  it("maps invoice rows with Swiss-formatted amounts in CHF", () => {
    const csv =
      "invoiceDate,vendorName,description,subtotalChf,vatChf,totalChf,currency,iban\n" +
      "2026-03-01,Acme SA,Plumbing,1'000.00,77.00,1'077.00,CHF,CH93...\n";
    const { items, skipped } = mapCsvToInvoiceLines(csv);
    expect(skipped).toEqual([]);
    expect(items[0]).toMatchObject({
      vendorName: "Acme SA",
      description: "Plumbing",
      subtotal: 1000,
      vatAmount: 77,
      totalAmount: 1077,
      currency: "CHF",
      confidence: 1,
    });
  });

  it("skips rows with no amount and blank rows", () => {
    const csv =
      "vendorName,totalChf,subtotalChf\n" +
      "NoAmount Ltd,,\n" + // has vendor but no amount → skipped with note
      ",,\n" + //            fully blank → silently skipped
      "Good Ltd,42,\n";
    const { items, skipped } = mapCsvToInvoiceLines(csv);
    expect(items).toHaveLength(1);
    expect(items[0].vendorName).toBe("Good Ltd");
    expect(items[0].totalAmount).toBe(42);
    expect(skipped).toHaveLength(1);
    expect(skipped[0]).toMatch(/missing both totalChf and subtotalChf/);
  });

  it("returns nulls for omitted optional fields", () => {
    const csv = "totalChf\n99.90";
    const { items } = mapCsvToInvoiceLines(csv);
    expect(items[0]).toMatchObject({
      totalAmount: 99.9,
      vendorName: null,
      iban: null,
      invoiceNumber: null,
    });
  });
});
