import { mapRentRoll, parseSwissDate, parseRooms } from "../services/rentRollMapper";

// The real régie rent-roll sample (tab-separated).
const RENT_ROLL =
  "objet\tlocataire_principal\ttype_objet\tetage\tpieces\tm2\tentree\tsortie\tloyer_brut_mensuel_chf\tloyer_net_mensuel_chf\tcharges_acompte_chf\tcharges_forfait_chf\ttva_chf\n" +
  "531100.01.0001\tJACCARD Jacques-Henri\tAppartement\trez-de-chaussée\t4.5\t96\t01.12.2016\t\t2836\t2646\t190\t0\t0\n" +
  "531100.01.0101\tFROISSE Marcel\tAppartement\t1er étage\t4.5\t96\t01.10.2015\t\t3200\t2920\t280\t0\t0\n" +
  "531100.01.9001\tJACCARD Jacques-Henri\tGarage\trez-de-chaussée\t\t0\t01.12.2016\t\t150\t150\t0\t0\t0\n" +
  "531100.01.9003\tVacant\tGarage\trez-de-chaussée\t\t0\t01.06.2020\t\t280\t280\t0\t0\t0\n" +
  "Total\t\t\t\t\t388\t\t\t14386\t13556\t830\t0\t0\n";

describe("parseSwissDate", () => {
  it("parses dd.mm.yyyy", () => {
    expect(parseSwissDate("01.12.2016")?.toISOString()).toBe("2016-12-01T00:00:00.000Z");
  });
  it("returns null for blank / invalid", () => {
    expect(parseSwissDate("")).toBeNull();
    expect(parseSwissDate("32.13.2020")).toBeNull();
    expect(parseSwissDate("nope")).toBeNull();
  });
});

describe("mapRentRoll", () => {
  it("maps apartments and garages, skips the Total row", () => {
    const { rows, skipped } = mapRentRoll(RENT_ROLL);
    expect(skipped).toEqual([]);
    expect(rows).toHaveLength(4); // Total row dropped

    const apt = rows.find((r) => r.objet === "531100.01.0001")!;
    expect(apt).toMatchObject({
      unitNumber: "0001",
      tenantName: "JACCARD Jacques-Henri",
      isVacant: false,
      unitType: "RESIDENTIAL",
      parkingKind: null,
      floor: "rez-de-chaussée",
      rooms: 4.5,
      areaSqm: 96,
      netRentChf: 2646,
      chargesChf: 190,
    });
    expect(apt.startDate?.toISOString()).toBe("2016-12-01T00:00:00.000Z");
    expect(apt.endDate).toBeNull();

    const garage = rows.find((r) => r.objet === "531100.01.9001")!;
    expect(garage).toMatchObject({ unitType: "PARKING", parkingKind: "GARAGE", netRentChf: 150 });
  });

  it("treats 'Vacant' as no tenant", () => {
    const { rows } = mapRentRoll(RENT_ROLL);
    const vac = rows.find((r) => r.objet === "531100.01.9003")!;
    expect(vac.isVacant).toBe(true);
    expect(vac.tenantName).toBeNull();
  });

  it("detects garages by the 9xxx object code even without a type column", () => {
    const csv = "objet\tlocataire_principal\tloyer_net_mensuel_chf\n531100.01.9002\tFROISSE Marcel\t280\n";
    const { rows } = mapRentRoll(csv);
    expect(rows[0]).toMatchObject({ unitType: "PARKING", parkingKind: "GARAGE" });
  });

  it("reports a clear note when no object column is present", () => {
    const { rows, skipped } = mapRentRoll("foo;bar\n1;2");
    expect(rows).toEqual([]);
    expect(skipped[0]).toMatch(/No object column/);
  });
});

describe("parseRooms", () => {
  it("parses decimals, fraction glyphs and n/2 notation, ignoring annotations", () => {
    expect(parseRooms("4.5")).toBe(4.5);
    expect(parseRooms("2½")).toBe(2.5);
    expect(parseRooms("5½ (duplex")).toBe(5.5);
    expect(parseRooms("3 1/2")).toBe(3.5);
    expect(parseRooms("2")).toBe(2);
    expect(parseRooms("Gar.")).toBeNull();
    expect(parseRooms("")).toBeNull();
  });
});

// A second régie (GALLAND) whose état locatif splits each object's rent across
// component lines and uses a different code scheme. The engine must still land
// one clean unit per object regardless of layout.
describe("mapRentRoll — cross-format robustness (component-split rent roll)", () => {
  it("merges component lines (Loyer + Acompte) into one object with net + charges", () => {
    const csv =
      "objet;locataire;type;etage;pieces;m2;entree;sortie;loyer_net;charges_acompte\n" +
      "410 010.16;Natalia HENDRIX MORRISSON;Appartement;1e;2;0;15.04.2024;;1350;\n" +
      "410 010.16;;;;;;;;140;\n";
    const { rows } = mapRentRoll(csv);
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({
      objet: "410 010.16",
      tenantName: "Natalia HENDRIX MORRISSON",
      isVacant: false,
      unitType: "RESIDENTIAL",
      rooms: 2,
      netRentChf: 1350,
      chargesChf: 140,
    });
  });

  it("keeps a single-row object's net/charges columns exactly as given", () => {
    const csv =
      "objet;locataire;type;loyer_net;charges_acompte\n" +
      "410 020.14;Gael CASANOVA;Appartement;1850;250\n";
    const { rows } = mapRentRoll(csv);
    expect(rows[0]).toMatchObject({ netRentChf: 1850, chargesChf: 250 });
  });

  it("detects a garage from a 9-leading code group and 'Loyer garage' type", () => {
    const csv =
      "objet;locataire;type;pieces;loyer_net\n" +
      "980 010.12;Raphaël FAUVE;Loyer garage;;130\n";
    const { rows } = mapRentRoll(csv);
    expect(rows[0]).toMatchObject({ unitType: "PARKING", parkingKind: "GARAGE", netRentChf: 130 });
  });

  it("does not mis-type a commercial local as parking", () => {
    const csv =
      "objet;locataire;type;m2;loyer_net\n" +
      "400 010.09;Vacant;Loc.commer;107;1700\n";
    const { rows } = mapRentRoll(csv);
    expect(rows[0]).toMatchObject({ unitType: "RESIDENTIAL", parkingKind: null, isVacant: true });
  });
});
