import { resolveGarageLinks, willCreateLease } from "../services/buildingOnboardingService";
import { mapRentRoll } from "../services/rentRollMapper";

const RENT_ROLL =
  "objet\tlocataire_principal\ttype_objet\tloyer_net_mensuel_chf\n" +
  "531100.01.0001\tJACCARD Jacques-Henri\tAppartement\t2646\n" +
  "531100.01.0101\tFROISSE Marcel\tAppartement\t2920\n" +
  "531100.01.9001\tJACCARD Jacques-Henri\tGarage\t150\n" + // → links to 0001 (same tenant)
  "531100.01.9002\tFROISSE Marcel\tGarage\t280\n" + //         → links to 0101
  "531100.01.9003\tVacant\tGarage\t280\n"; //                  vacant → no link

describe("resolveGarageLinks", () => {
  it("pairs each garage with the apartment held by the same tenant", () => {
    const { rows } = mapRentRoll(RENT_ROLL);
    const links = resolveGarageLinks(rows);
    expect(links.get("531100.01.9001")).toBe("531100.01.0001");
    expect(links.get("531100.01.9002")).toBe("531100.01.0101");
    expect(links.get("531100.01.9003")).toBeNull(); // vacant garage — no tenant to match
  });
});

describe("willCreateLease", () => {
  it("is true only for an occupied object with rent", () => {
    const { rows } = mapRentRoll(RENT_ROLL);
    expect(willCreateLease(rows.find((r) => r.objet === "531100.01.0001")!)).toBe(true);
    expect(willCreateLease(rows.find((r) => r.objet === "531100.01.9003")!)).toBe(false); // vacant
  });

  it("is false when occupied but rent is zero/missing", () => {
    const { rows } = mapRentRoll("objet\tlocataire_principal\tloyer_net_mensuel_chf\n531100.01.0001\tX\t0\n");
    expect(willCreateLease(rows[0])).toBe(false);
  });
});
