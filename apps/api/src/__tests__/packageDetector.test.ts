import { detectDocumentType } from "../services/packageDetector";

describe("detectDocumentType", () => {
  it("classifies a rent roll", () => {
    const csv = "objet\tlocataire_principal\ttype_objet\tloyer_net_mensuel_chf\n531100.01.0001\tJACCARD\tAppartement\t2646\n";
    expect(detectDocumentType("rentroll.csv", csv)).toBe("RENT_ROLL");
  });

  it("classifies a general ledger (piece + entry text)", () => {
    const csv = "groupe\tcompte\tlibelle_compte\tdate_valeur\tno_piece\ttexte_ecriture\tmontant_chf\n4110\t41100\tEntretien\t21.05.2025\t1073348\tBURGOS / Infiltration\t2964\n";
    expect(detectDocumentType("grandlivre.csv", csv)).toBe("GENERAL_LEDGER");
  });

  it("classifies a balance sheet (Actif/Passif sections)", () => {
    const csv = [
      "section\tgroupe\tsous_groupe\tcompte\tdesignation\tmontant_chf\ttype",
      "Actifs\t100\t1020\t10200\tBanque\t12858.88\tcompte",
      "Passifs\t200\t2000\t20000\tAvances loyer\t11120\tcompte",
    ].join("\n");
    expect(detectDocumentType("bilan.csv", csv)).toBe("BALANCE_SHEET");
  });

  it("classifies an income statement (Produit/Charge sections)", () => {
    const csv = [
      "section\tgroupe\tcompte\tdesignation\tmontant_chf\ttype",
      "Produits\t300\t30000\tLoyer net\t-162672\tcompte",
      "Charges\t411\t41100\tEntretien\t3105.7\tcompte",
    ].join("\n");
    expect(detectDocumentType("compte-resultat.csv", csv)).toBe("INCOME_STATEMENT");
  });

  it("falls back to account-code ranges when there is no section column", () => {
    const bs = "compte\tmontant_chf\n1020\t12858\n2000\t11120\n";
    expect(detectDocumentType("x.csv", bs)).toBe("BALANCE_SHEET");
    const is = "compte\tmontant_chf\n30000\t-162672\n41100\t3105\n";
    expect(detectDocumentType("y.csv", is)).toBe("INCOME_STATEMENT");
  });

  it("returns UNKNOWN for an unrecognised file", () => {
    expect(detectDocumentType("notes.csv", "foo,bar\n1,2\n")).toBe("UNKNOWN");
  });
});
