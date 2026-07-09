import { mapRentRoll, parseSwissDate } from "../services/rentRollMapper";

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
