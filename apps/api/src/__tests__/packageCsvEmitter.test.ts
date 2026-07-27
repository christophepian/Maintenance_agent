import {
  emitRentRollCsv,
  emitBuildingInfoCsv,
  emitAccountBalancesCsv,
  emitGrandLivreCsv,
  type ExtractedRentRollRow,
  type ExtractedBuildingInfoFields,
  type ExtractedLedgerRow,
} from "../services/scanners/packageCsvEmitter";
import type { ExtractedAccountBalance } from "../services/documentScanner";
import { mapRentRoll } from "../services/rentRollMapper";
import { mapCsvToAccountBalances } from "../services/csvAccountingMapper";
import { mapRegieLedger } from "../services/regieLedgerMapper";
import { parseLedgerToolInput } from "../services/scanners/packageExtraction";
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

describe("emitGrandLivreCsv → detect + mapRegieLedger round-trip", () => {
  // Real 'Entretien des appartements' (41200) detail transcribed from a régie
  // annual report — each line carries the 531100.01.<unit> objet prefix, plus a
  // couple of building-level lines (41100/41300) that must stay unit-less.
  const rows: ExtractedLedgerRow[] = [
    { compte: "41100", accountName: "Entretien de l'immeuble", dateValeur: "21.05.2025", noPiece: "1073348", texteEcriture: "G. BURGOS Sàrl / Recherche d'infiltration d'eau", montantChf: 2964.0 },
    { compte: "41200", accountName: "Entretien des appartements", dateValeur: "08.01.2025", noPiece: "1062728", texteEcriture: "531100.01.0001: ACE Electroménager / Remplacement 2 ampoules hotte", montantChf: 36.75 },
    { compte: "41200", accountName: "Entretien des appartements", dateValeur: "17.02.2025", noPiece: "1067046", texteEcriture: "531100.01.0001: TP MENUISERIE / Fourniture+pose aérateurs fenêtres", montantChf: 845.0 },
    { compte: "41200", accountName: "Entretien des appartements", dateValeur: "28.05.2025", noPiece: "1073755", texteEcriture: "531100.01.0201: LIAUDET PIAL SA / Curage HP dérivations SDB", montantChf: 452.4 },
    { compte: "41200", accountName: "Entretien des appartements", dateValeur: "10.10.2025", noPiece: "1083025", texteEcriture: "531100.01.0101: PLATEFORME SA / Destruction de 2 grosses pierres dans la cour", montantChf: 1335.05 },
    { compte: "41200", accountName: "Entretien des appartements", dateValeur: "17.01.2025", noPiece: "1065720", texteEcriture: "531100.01.0301: DVM Carrelage / Fermeture du muret de la baignoire", montantChf: 451.0 },
    // Building-level: no objet prefix → must NOT be attributed to a unit.
    { compte: "41300", accountName: "Entretien des extérieurs", dateValeur: "06.01.2025", noPiece: "1063769", texteEcriture: "MILLE ET UN JARDINS Sàrl / Remise en place des graviers", montantChf: 965.0 },
    // Internal recurring charge: must be skipped by the mapper.
    { compte: "46000", accountName: "Honoraires de gestion", dateValeur: "31.01.2025", noPiece: "48700", texteEcriture: "RILSA SA / 4.000% Honoraires de gestion", montantChf: 609.95 },
  ];
  const csv = emitGrandLivreCsv(rows)!;

  it("classifies as GENERAL_LEDGER", () => {
    expect(detectDocumentType("grandlivre.csv", csv)).toBe("GENERAL_LEDGER");
  });

  it("keeps 5-digit account codes intact (not truncated to 4)", () => {
    expect(csv).toContain("41200;");
    expect(csv).not.toContain("4120;");
  });

  it("attributes unit-prefixed lines and leaves building-level lines unit-less", () => {
    const { invoices } = mapRegieLedger(csv);
    const byUnit: Record<string, number> = {};
    for (const inv of invoices.filter((i) => i.compte === "41200")) {
      byUnit[inv.unitNumber!] = Math.round(((byUnit[inv.unitNumber!] ?? 0) + inv.amountChf) * 100) / 100;
    }
    expect(byUnit).toEqual({ "0001": 881.75, "0101": 1335.05, "0201": 452.4, "0301": 451.0 });

    const jardins = invoices.find((i) => i.vendorName.startsWith("MILLE ET UN JARDINS"))!;
    expect(jardins.unitNumber).toBeNull();

    // The management fee (46000) is an internal charge → not a supplier invoice.
    expect(invoices.some((i) => i.compte === "46000")).toBe(false);
  });

  it("returns null when no row carries entry text", () => {
    expect(emitGrandLivreCsv([{ compte: "41200", texteEcriture: "", montantChf: 10 }])).toBeNull();
  });
});

describe("parseLedgerToolInput", () => {
  it("keeps valid rows, coerces a numeric noPiece, drops rows missing code/text/amount", () => {
    const rows = parseLedgerToolInput({
      rows: [
        { compte: "41200", accountName: "Entretien", dateValeur: "08.01.2025", noPiece: 1062728, texteEcriture: "531100.01.0001: ACE / ampoules", montantChf: 36.75 },
        { compte: "", texteEcriture: "no code", montantChf: 5 }, // dropped: blank code
        { compte: "41200", texteEcriture: "", montantChf: 5 }, // dropped: blank text
        { compte: "41300", texteEcriture: "JARDINS / graviers" }, // dropped: no amount
      ],
    });
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({ compte: "41200", noPiece: "1062728", montantChf: 36.75 });
  });

  it("unwraps a double-encoded tool payload (rows as a JSON string)", () => {
    const rows = parseLedgerToolInput({
      rows: JSON.stringify([{ compte: "41200", texteEcriture: "531100.01.0201: X / y", montantChf: 10 }]),
    });
    expect(rows).toHaveLength(1);
    expect(rows[0].compte).toBe("41200");
  });

  it("returns [] for malformed input", () => {
    expect(parseLedgerToolInput(null)).toEqual([]);
    expect(parseLedgerToolInput({ nope: 1 })).toEqual([]);
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

  it("does not emit a one-sided bilan (owner-account page → no ACTIF+PASSIF pair)", () => {
    // An owner current-account statement can yield only equity-ish (PASSIF) rows;
    // a balance sheet needs both sides, so no junk bilan should be produced.
    const passifOnly: ExtractedAccountBalance[] = [
      { rawAccountCode: "2850", rawAccountName: "Versements propriétaires", balanceChf: 104528.4, balanceType: "CREDIT", documentSection: "PASSIF" },
      { rawAccountCode: "2240", rawAccountName: "Amortissements hypothécaires", balanceChf: 10400, balanceType: "CREDIT", documentSection: "PASSIF" },
    ];
    expect(emitAccountBalancesCsv(passifOnly, "balance")).toBeNull();
  });
});
