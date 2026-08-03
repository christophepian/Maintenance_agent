import { detectBuildingSplit } from "../services/packageOnboardingService";

const rentRoll = (prefix: string) =>
  `objet\tlocataire_principal\ttype_objet\tloyer_net_mensuel_chf\n` +
  `${prefix}.01.0001\tJACCARD Jacques\tAppartement\t2646\n` +
  `${prefix}.01.0101\tFROISSE Marcel\tAppartement\t2920\n`;

const info = (addr: string) => `champ;valeur\nimmeuble_adresse;${addr}\n`;
const anyStatement = "compte;montant_chf;section\n3000;-50000;Produit\n";

describe("detectBuildingSplit", () => {
  it("passes a clean single-building package", () => {
    const r = detectBuildingSplit([
      { type: "RENT_ROLL", text: rentRoll("531100") },
      { type: "INCOME_STATEMENT", text: anyStatement },
      { type: "GENERAL_INFO", text: info("Rte des Monts 314, 1090 Lutry") },
    ]);
    expect(r.multiple).toBe(false);
  });

  it("flags two rent rolls with different object-code prefixes as distinct buildings", () => {
    const r = detectBuildingSplit([
      { type: "RENT_ROLL", text: rentRoll("531100") },
      { type: "RENT_ROLL", text: rentRoll("487200") },
    ]);
    expect(r.multiple).toBe(true);
    expect(r.ambiguous).toBe(false);
    expect(r.buildings.length).toBe(2);
  });

  it("flags two general-info sheets with different addresses as distinct buildings", () => {
    const r = detectBuildingSplit([
      { type: "GENERAL_INFO", text: info("Rte des Monts 314, 1090 Lutry") },
      { type: "GENERAL_INFO", text: info("Av de la Gare 5, 1003 Lausanne") },
    ]);
    expect(r.multiple).toBe(true);
    expect(r.ambiguous).toBe(false);
    expect(r.buildings.length).toBe(2);
  });

  it("treats duplicate statements with no distinguishing identity as ambiguous (ask)", () => {
    const r = detectBuildingSplit([
      { type: "INCOME_STATEMENT", text: anyStatement },
      { type: "INCOME_STATEMENT", text: anyStatement },
    ]);
    expect(r.multiple).toBe(true);
    expect(r.ambiguous).toBe(true);
    expect(r.buildings.length).toBe(0);
  });

  it("does not confirm distinct buildings when two rent rolls share a prefix (ambiguous at most)", () => {
    const r = detectBuildingSplit([
      { type: "RENT_ROLL", text: rentRoll("531100") },
      { type: "RENT_ROLL", text: rentRoll("531100") },
    ]);
    expect(r.ambiguous).toBe(true); // same identity, but duplicate type → ask
    expect(r.buildings.length).toBe(0);
  });

  it("bare-numbered rent rolls carry no building key → single rent roll is fine", () => {
    const bare = "objet\tlocataire_principal\tloyer_net_mensuel_chf\n0001\tX\t2000\n0101\tY\t2100\n";
    const r = detectBuildingSplit([{ type: "RENT_ROLL", text: bare }]);
    expect(r.multiple).toBe(false);
  });
});
