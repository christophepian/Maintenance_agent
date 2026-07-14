import {
  emitRentRollCsv,
  emitBuildingInfoCsv,
  emitAccountBalancesCsv,
  type ExtractedRentRollRow,
  type ExtractedBuildingInfoFields,
} from "../services/scanners/packageCsvEmitter";
import type { ExtractedAccountBalance } from "../services/documentScanner";
import { mapRentRoll } from "../services/rentRollMapper";
import { mapCsvToAccountBalances } from "../services/csvAccountingMapper";
import { detectDocumentType, parseBuildingInfo } from "../services/packageDetector";

// The point of these tests: a PDF-extracted structure, serialized by the emitter,
// must round-trip cleanly through the deterministic detector + mappers that the
// existing package pipeline uses. This is what proves "PDF → canonical CSV →
// existing pipeline" holds without ever running OCR or an LLM.

describe("emitRentRollCsv → detect + mapRentRoll round-trip", () => {
  const rows: ExtractedRentRollRow[] = [
    {
      objet: "531100.01.0001",
      tenantName: "JACCARD Jacques-Henri",
      unitType: "Appartement",
      floor: "rez-de-chaussée",
      rooms: 4.5,
      areaSqm: 96,
      entree: "01.12.2016",
      sortie: "",
      loyerNetChf: 2646,
      chargesChf: 190,
      confidence: 0.97,
    },
    {
      objet: "531100.01.9001",
      tenantName: "JACCARD Jacques-Henri",
      unitType: "Garage",
      entree: "01.12.2016",
      loyerNetChf: 150,
      chargesChf: 0,
    },
    // Vacant object — no tenant.
    { objet: "531100.01.9003", tenantName: "", unitType: "Garage", loyerNetChf: 280 },
  ];
  const csv = emitRentRollCsv(rows)!;

  it("classifies as RENT_ROLL", () => {
    expect(detectDocumentType("rentroll.csv", csv)).toBe("RENT_ROLL");
  });

  it("maps apartments, garages, and the vacant object", () => {
    const { rows: mapped, skipped } = mapRentRoll(csv);
    expect(skipped).toEqual([]);
    expect(mapped).toHaveLength(3);

    const apt = mapped.find((r) => r.objet === "531100.01.0001")!;
    expect(apt).toMatchObject({
      unitNumber: "0001",
      tenantName: "JACCARD Jacques-Henri",
      isVacant: false,
      unitType: "RESIDENTIAL",
      parkingKind: null,
      rooms: 4.5,
      areaSqm: 96,
      netRentChf: 2646,
      chargesChf: 190,
    });
    expect(apt.startDate?.toISOString()).toBe("2016-12-01T00:00:00.000Z");

    const garage = mapped.find((r) => r.objet === "531100.01.9001")!;
    expect(garage).toMatchObject({ unitType: "PARKING", parkingKind: "GARAGE", netRentChf: 150 });

    const vacant = mapped.find((r) => r.objet === "531100.01.9003")!;
    expect(vacant).toMatchObject({ isVacant: true, tenantName: null, unitType: "PARKING" });
  });

  it("returns null for an empty row set", () => {
    expect(emitRentRollCsv([])).toBeNull();
  });
});

describe("emitBuildingInfoCsv → detect + parseBuildingInfo round-trip", () => {
  const fields: ExtractedBuildingInfoFields = {
    immeubleAdresse: "Rte Monts-de-Laval 314, 1090 La Croix (Lutry)",
    immeubleReference: "78645",
    periode: "01.01.2025 - 31.12.2025",
    gerance: "RILSA",
  };
  const csv = emitBuildingInfoCsv(fields)!;

  it("classifies as GENERAL_INFO", () => {
    expect(detectDocumentType("infos.csv", csv)).toBe("GENERAL_INFO");
  });

  it("parses building identity (address split + fiscal year)", () => {
    const info = parseBuildingInfo(csv)!;
    expect(info).toMatchObject({
      name: "Rte Monts-de-Laval 314",
      postalCode: "1090",
      city: "La Croix (Lutry)",
      reference: "78645",
      fiscalYear: 2025,
    });
  });

  it("returns null without an address", () => {
    expect(emitBuildingInfoCsv({ immeubleReference: "78645" })).toBeNull();
  });
});

describe("emitAccountBalancesCsv → detect + mapCsvToAccountBalances round-trip", () => {
  const balances: ExtractedAccountBalance[] = [
    { rawAccountCode: "1020", rawAccountName: "Compte courant", balanceChf: 62405.24, balanceType: "DEBIT", documentSection: "ACTIF" },
    { rawAccountCode: "2000", rawAccountName: "Créanciers", balanceChf: -12000, balanceType: "CREDIT", documentSection: "PASSIF" },
    { rawAccountCode: "3000", rawAccountName: "Loyer net", balanceChf: 162672, balanceType: "CREDIT", documentSection: "REVENUE" },
    { rawAccountCode: "4200", rawAccountName: "Entretien", balanceChf: 18400, balanceType: "DEBIT", documentSection: "EXPENSE" },
  ];

  it("balance-sheet file keeps only ACTIF/PASSIF and classifies as BALANCE_SHEET", () => {
    const csv = emitAccountBalancesCsv(balances, "balance")!;
    expect(detectDocumentType("bilan.csv", csv)).toBe("BALANCE_SHEET");
    const { items } = mapCsvToAccountBalances(csv);
    expect(items.map((i) => i.rawAccountCode).sort()).toEqual(["1020", "2000"]);
    expect(items.find((i) => i.rawAccountCode === "1020")?.balanceChf).toBe(62405.24);
  });

  it("income file keeps only REVENUE/EXPENSE and classifies as INCOME_STATEMENT", () => {
    const csv = emitAccountBalancesCsv(balances, "income")!;
    expect(detectDocumentType("resultat.csv", csv)).toBe("INCOME_STATEMENT");
    const { items } = mapCsvToAccountBalances(csv);
    expect(items.map((i) => i.rawAccountCode).sort()).toEqual(["3000", "4200"]);
  });

  it("returns null when a kind has no rows", () => {
    const onlyActif: ExtractedAccountBalance[] = [balances[0]];
    expect(emitAccountBalancesCsv(onlyActif, "income")).toBeNull();
  });
});
