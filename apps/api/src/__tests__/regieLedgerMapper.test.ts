import { mapRegieLedger } from "../services/regieLedgerMapper";

/**
 * Representative slice of a real régie grand livre, one case per branch:
 * rent detail, vacancy, tenant reimbursement, unit-scoped repair, building-level
 * repair, management fee, bank fee, rounding, salary, insurance, misc, tax.
 */
const SAMPLE = [
  "groupe\tcompte\tlibelle_compte\tdate_valeur\tno_piece\ttexte_ecriture\tmontant_chf",
  "3000\t30000\tLoyer net\t01.01.2025\t\t\t-13556", // revenue detail → skip
  "3800\t38000\tVacant Loyer net\t01.01.2025\t\t\t280", // revenue-side vacancy → skip
  "3610\t36030\tRemboursements locataires\t19.11.2025\t25011\tBRICELET Nick / Débouchage siphon\t-301.6", // <40000 → skip
  "4110\t41100\tEntretien de l'immeuble\t21.05.2025\t1073348\tG. BURGOS Sàrl / Recherche d'infiltration d'eau\t2964", // building-level → keep
  "4120\t41200\tEntretien des appartements\t17.01.2025\t1065720\t531100.01.0301: DVM Carrelage / Fermeture du muret\t451", // unit-scoped → keep
  "4130\t41300\tEntretien des extérieurs\t22.01.2025\t1063771\tMILLE ET UN JARDINS Sàrl / Entretien extérieurs 2024\t5602", // keep
  "4300\t43000\tAssurances\t01.01.2025\t1065728\tZURICH / Prime 2025-2026\t2248.7", // keep
  "4000\t40000\tConciergerie\t30.06.2024\t\tSalaire chauffeur\t-221.9", // no piece, no supplier → skip
  "4590\t45905\tDifférences d'arrondi f. acc.\t30.06.2024\t\tRépartition différence d'arrondi\t-0.05", // rounding → skip
  "4600\t46000\tHonoraires de gestion\t31.01.2025\t48700\tRILSA SA / 4.000% Honoraires\t609.95", // management fee → skip
  "4800\t48000\tFrais divers\t03.01.2025\t1063183\tCHAMBRE VAUDOISE IMMOBILIÈRE / Cotisation 2025\t120", // misc third-party → keep
  "4800\t48100\tFrais bancaires ou postaux\t31.01.2025\t29946\tCS Janvier 2025\t0.3", // bank fee → skip
  "6900\t69000\tImpôts et taxes\t01.12.2025\t1087133\tCOMMUNE DE LUTRY / Impôt foncier 2025\t1957.9", // keep
].join("\n");

describe("mapRegieLedger", () => {
  const { invoices, summary } = mapRegieLedger(SAMPLE);

  it("keeps only discrete third-party contractor invoices", () => {
    expect(invoices).toHaveLength(6);
    const codes = invoices.map((i) => i.compte).sort();
    expect(codes).toEqual(["41100", "41200", "41300", "43000", "48000", "69000"].sort());
  });

  it("excludes revenue, management fee, bank fees, rounding and payroll", () => {
    const codes = invoices.map((i) => i.compte);
    expect(codes).not.toContain("30000"); // rent
    expect(codes).not.toContain("36030"); // tenant reimbursement
    expect(codes).not.toContain("46000"); // management fee
    expect(codes).not.toContain("48100"); // bank fees
    expect(codes).not.toContain("45905"); // rounding
    expect(codes).not.toContain("40000"); // salary
  });

  it("splits vendor / description and strips the unit prefix", () => {
    const dvm = invoices.find((i) => i.compte === "41200")!;
    expect(dvm.vendorName).toBe("DVM Carrelage");
    expect(dvm.description).toBe("Fermeture du muret");
    expect(dvm.unitObjet).toBe("531100.01.0301");
    expect(dvm.unitNumber).toBe("0301");
  });

  it("leaves building-level invoices with no unit", () => {
    const zurich = invoices.find((i) => i.compte === "43000")!;
    expect(zurich.vendorName).toBe("ZURICH");
    expect(zurich.unitNumber).toBeNull();
  });

  it("preserves rappen and parses the Swiss date", () => {
    const zurich = invoices.find((i) => i.compte === "43000")!;
    expect(zurich.amountChf).toBe(2248.7);
    expect(zurich.date?.toISOString().slice(0, 10)).toBe("2025-01-01");
  });

  it("disambiguates one supplier invoice split across accounts (same no_piece)", () => {
    const split = [
      "groupe\tcompte\tlibelle_compte\tdate_valeur\tno_piece\ttexte_ecriture\tmontant_chf",
      "4500\t45000\tElectricité\t10.07.2025\t1077159\tSI LUTRY / Acpte électricité\t797",
      "4560\t45600\tEau\t10.07.2025\t1077159\tSI LUTRY / Acpte eau\t336.55",
    ].join("\n");
    const { invoices } = mapRegieLedger(split);
    expect(invoices).toHaveLength(2); // both lines kept, not deduped away
    const keys = invoices.map((i) => i.pieceKey).sort();
    expect(keys).toEqual(["1077159", "1077159:45600"]); // first bare, later suffixed by account
    expect(invoices.map((i) => i.amountChf).sort((a, b) => a - b)).toEqual([336.55, 797]);
  });

  it("summarises count, total and unit attribution", () => {
    expect(summary.total).toBe(6);
    expect(summary.unitAttributed).toBe(1);
    expect(summary.totalChf).toBeCloseTo(2964 + 451 + 5602 + 2248.7 + 120 + 1957.9, 2);
    expect(summary.byAccount.map((a) => a.compte)).toEqual(
      ["41100", "41200", "41300", "43000", "48000", "69000"],
    );
  });
});
