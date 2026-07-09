import { resolveGarageLinks, willCreateLease, normalizeFloor, unitMatchKey } from "../services/buildingOnboardingService";
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

describe("normalizeFloor", () => {
  it("maps ground-floor variants to 0", () => {
    for (const f of ["Rez de Chaussée", "rez-de-chaussée", "RdC", "rez", "Parterre"]) {
      expect(normalizeFloor(f)).toBe("0");
    }
  });
  it("extracts the floor number from labels", () => {
    expect(normalizeFloor("1er")).toBe("1");
    expect(normalizeFloor("1er étage")).toBe("1");
    expect(normalizeFloor("2ème étage")).toBe("2");
    expect(normalizeFloor("3eme")).toBe("3");
    expect(normalizeFloor("2")).toBe("2");
  });
  it("returns empty for null/blank", () => {
    expect(normalizeFloor(null)).toBe("");
    expect(normalizeFloor("")).toBe("");
  });
});

describe("unitMatchKey", () => {
  it("matches the same flat across different numbering (floor + net rent)", () => {
    // old vacant shell "1er" (net 2920) vs rent-roll "0101" (1er étage, net 2920)
    expect(unitMatchKey("RESIDENTIAL", "1er", 2920)).toBe(unitMatchKey("RESIDENTIAL", "1er étage", 2920));
    // ground floor: "Rez de Chaussée"/2646 ↔ "rez-de-chaussée"/2646
    expect(unitMatchKey("RESIDENTIAL", "Rez de Chaussée", 2646)).toBe(unitMatchKey("RESIDENTIAL", "rez-de-chaussée", 2646));
  });
  it("does not match across type or differing rent", () => {
    expect(unitMatchKey("PARKING", "0", 150)).not.toBe(unitMatchKey("RESIDENTIAL", "0", 150));
    expect(unitMatchKey("RESIDENTIAL", "1", 2920)).not.toBe(unitMatchKey("RESIDENTIAL", "1", 3000));
  });
  it("is empty when floor or rent is missing", () => {
    expect(unitMatchKey("RESIDENTIAL", null, 2920)).toBe("");
    expect(unitMatchKey("RESIDENTIAL", "1er", null)).toBe("");
  });
});
