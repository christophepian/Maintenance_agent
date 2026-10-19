/**
 * Demo régie package — synthetic, deterministic, safe to publish.
 *
 * Produces the same canonical CSVs the PDF scanner emits (packageCsvEmitter), so
 * the demo building is populated by the REAL onboarding pipeline
 * (commitPackage → rent-roll mapper, accounting mapper, régie ledger mapper)
 * rather than by fabricated rows written straight to the tables. What a demo
 * visitor sees on the Reporting tab is therefore genuinely processed data, and
 * it exercises the same code path a régie's own package would.
 *
 * Everything here is invented: the building, the tenants, the vendors and every
 * figure. No real régie data is used, because the demo link is public.
 *
 * Deterministic by design — same fiscal year in, same package out — so re-seeding
 * is idempotent and the numbers a demo is walked through never move.
 */

import {
  emitRentRollCsv,
  emitBuildingInfoCsv,
  emitAccountBalancesCsv,
  emitGrandLivreCsv,
  type ExtractedRentRollRow,
  type ExtractedLedgerRow,
} from "./scanners/packageCsvEmitter";
import type { ExtractedAccountBalance } from "./documentScanner";
import type { PackageFile } from "./packageOnboardingService";

/** Régie object prefix — the rent roll and ledger share it so per-unit expense
 *  attribution (the `531100.01.NNNN:` prefix) resolves against real units. */
const OBJECT_PREFIX = "742300.01";

export const DEMO_BUILDING_NAME = "Résidence des Charmilles";
export const DEMO_BUILDING_ADDRESS = "18 rue des Charmilles, 1203 Genève";

/** One apartment in the demo building. Rents are Geneva-plausible for the size. */
interface DemoUnit {
  suffix: string;
  tenant: string;   // "" ⇒ vacant
  type: string;
  floor: string;
  rooms: number;
  areaSqm: number;
  entree: string;
  netRentChf: number;
  chargesChf: number;
}

const APARTMENTS: DemoUnit[] = [
  { suffix: "0001", tenant: "MARCHAND Sylvie",    type: "Appartement", floor: "rez-de-chaussée", rooms: 3.5, areaSqm: 78,  entree: "01.04.2018", netRentChf: 1980, chargesChf: 180 },
  { suffix: "0002", tenant: "BRUNNER Thomas",     type: "Appartement", floor: "rez-de-chaussée", rooms: 2.5, areaSqm: 58,  entree: "01.09.2021", netRentChf: 1610, chargesChf: 140 },
  { suffix: "0003", tenant: "DA SILVA Marco",     type: "Appartement", floor: "1er étage",       rooms: 4.5, areaSqm: 102, entree: "15.07.2016", netRentChf: 2540, chargesChf: 220 },
  { suffix: "0004", tenant: "KELLER Andrea",      type: "Appartement", floor: "1er étage",       rooms: 3.5, areaSqm: 80,  entree: "01.02.2020", netRentChf: 2050, chargesChf: 180 },
  { suffix: "0005", tenant: "NGUYEN Thi Lan",     type: "Appartement", floor: "2e étage",        rooms: 4.5, areaSqm: 104, entree: "01.11.2019", netRentChf: 2620, chargesChf: 220 },
  { suffix: "0006", tenant: "ROSSI Giulia",       type: "Appartement", floor: "2e étage",        rooms: 2.5, areaSqm: 56,  entree: "01.06.2023", netRentChf: 1690, chargesChf: 140 },
  { suffix: "0007", tenant: "FAVRE Olivier",      type: "Appartement", floor: "3e étage",        rooms: 3.5, areaSqm: 79,  entree: "01.03.2017", netRentChf: 2010, chargesChf: 180 },
  // Deliberately vacant — the occupancy KPI and the vacancy watch item are only
  // interesting when the building isn't implausibly 100% let.
  { suffix: "0008", tenant: "",                   type: "Appartement", floor: "3e étage",        rooms: 4.5, areaSqm: 101, entree: "",           netRentChf: 2580, chargesChf: 220 },
];

const PARKING: DemoUnit[] = [
  { suffix: "9001", tenant: "MARCHAND Sylvie", type: "Place de parc", floor: "sous-sol", rooms: 0, areaSqm: 0, entree: "01.04.2018", netRentChf: 160, chargesChf: 0 },
  { suffix: "9002", tenant: "DA SILVA Marco",  type: "Place de parc", floor: "sous-sol", rooms: 0, areaSqm: 0, entree: "15.07.2016", netRentChf: 160, chargesChf: 0 },
  { suffix: "9003", tenant: "NGUYEN Thi Lan",  type: "Place de parc", floor: "sous-sol", rooms: 0, areaSqm: 0, entree: "01.11.2019", netRentChf: 160, chargesChf: 0 },
  { suffix: "9004", tenant: "",                type: "Place de parc", floor: "sous-sol", rooms: 0, areaSqm: 0, entree: "",           netRentChf: 160, chargesChf: 0 },
];

const ALL_UNITS = [...APARTMENTS, ...PARKING];

/** Gross potential rent for a full year, in CHF (net rent only). */
function annualPotentialRentChf(): number {
  return ALL_UNITS.reduce((sum, u) => sum + u.netRentChf * 12, 0);
}

/** Rent actually earned — the vacant objects contribute nothing. */
function annualCollectedRentChf(): number {
  return ALL_UNITS.filter((u) => u.tenant).reduce((sum, u) => sum + u.netRentChf * 12, 0);
}

function annualChargesChf(): number {
  return ALL_UNITS.filter((u) => u.tenant).reduce((sum, u) => sum + u.chargesChf * 12, 0);
}

/* ── Operating expenses ───────────────────────────────────────────────────────
 * One line per régie expense account, each with the vendor postings that make it
 * up. Amounts are CHF for the year; `unit` attributes a posting to one object so
 * the per-unit cost breakdown on the Reporting tab has something to show.
 */
interface DemoExpense {
  account: string;
  accountName: string;
  postings: { month: number; day: number; vendor: string; description: string; chf: number; unit?: string }[];
}

function demoExpenses(year: number): DemoExpense[] {
  return [
    {
      account: "60100",
      accountName: "Chauffage et eau chaude",
      postings: [
        { month: 1,  day: 15, vendor: "SIG Genève",            description: "Décompte chauffage janvier",   chf: 4820 },
        { month: 3,  day: 12, vendor: "SIG Genève",            description: "Décompte chauffage février",   chf: 4310 },
        { month: 10, day: 8,  vendor: "SIG Genève",            description: "Livraison mazout",             chf: 6240 },
        { month: 12, day: 18, vendor: "SIG Genève",            description: "Décompte chauffage novembre",  chf: 3980 },
      ],
    },
    {
      account: "60200",
      accountName: "Eau et épuration",
      postings: [
        { month: 4,  day: 3,  vendor: "SIG Genève",            description: "Eau 1er semestre",             chf: 2740 },
        { month: 10, day: 3,  vendor: "SIG Genève",            description: "Eau 2e semestre",              chf: 2610 },
      ],
    },
    {
      account: "60300",
      accountName: "Électricité communs",
      postings: [
        { month: 2,  day: 20, vendor: "SIG Genève",            description: "Électricité communs T1",       chf: 890 },
        { month: 8,  day: 20, vendor: "SIG Genève",            description: "Électricité communs T3",       chf: 810 },
      ],
    },
    {
      account: "61100",
      accountName: "Conciergerie et nettoyage",
      postings: [
        { month: 3,  day: 31, vendor: "Net & Clair Sàrl",      description: "Conciergerie T1",              chf: 3600 },
        { month: 6,  day: 30, vendor: "Net & Clair Sàrl",      description: "Conciergerie T2",              chf: 3600 },
        { month: 9,  day: 30, vendor: "Net & Clair Sàrl",      description: "Conciergerie T3",              chf: 3600 },
        { month: 12, day: 31, vendor: "Net & Clair Sàrl",      description: "Conciergerie T4",              chf: 3600 },
      ],
    },
    {
      account: "61200",
      accountName: "Entretien des appartements",
      postings: [
        { month: 2,  day: 11, vendor: "Sanitaires Perret SA",  description: "Remplacement mitigeur cuisine", chf: 680,  unit: "0003" },
        { month: 5,  day: 22, vendor: "ACE Électroménager",    description: "Réparation lave-vaisselle",     chf: 540,  unit: "0005" },
        { month: 7,  day: 9,  vendor: "Peinture Dubois",       description: "Remise en état après départ",   chf: 4250, unit: "0008" },
        { month: 9,  day: 17, vendor: "Sanitaires Perret SA",  description: "Détartrage chauffe-eau",        chf: 390,  unit: "0001" },
        { month: 11, day: 26, vendor: "Vitrerie Genevoise",    description: "Remplacement double vitrage",   chf: 1180, unit: "0007" },
      ],
    },
    {
      account: "61300",
      accountName: "Entretien parties communes",
      postings: [
        { month: 4,  day: 14, vendor: "Ascenseurs Schindler",  description: "Contrat entretien ascenseur",   chf: 2980 },
        { month: 6,  day: 5,  vendor: "Jardins du Léman",      description: "Entretien extérieurs",          chf: 1640 },
        { month: 10, day: 21, vendor: "Électricité Moret",     description: "Éclairage cage d'escalier",     chf: 760 },
      ],
    },
    {
      account: "62100",
      accountName: "Assurances immeuble",
      postings: [
        { month: 1,  day: 10, vendor: "Bâloise Assurances",    description: "Prime RC + incendie",           chf: 5420 },
      ],
    },
    {
      account: "63100",
      accountName: "Honoraires de gérance",
      postings: [
        { month: 3,  day: 31, vendor: "Régie Léman SA",        description: "Honoraires de gérance T1",      chf: 2870 },
        { month: 6,  day: 30, vendor: "Régie Léman SA",        description: "Honoraires de gérance T2",      chf: 2870 },
        { month: 9,  day: 30, vendor: "Régie Léman SA",        description: "Honoraires de gérance T3",      chf: 2870 },
        { month: 12, day: 31, vendor: "Régie Léman SA",        description: "Honoraires de gérance T4",      chf: 2870 },
      ],
    },
    {
      account: "64100",
      accountName: "Impôts et taxes",
      postings: [
        { month: 5,  day: 30, vendor: "État de Genève",        description: "Taxe immobilière " + year,      chf: 3240 },
      ],
    },
  ];
}

function totalExpensesChf(year: number): number {
  return demoExpenses(year).reduce(
    (sum, e) => sum + e.postings.reduce((s, p) => s + p.chf, 0),
    0,
  );
}

const pad2 = (n: number) => String(n).padStart(2, "0");
const dmy = (year: number, month: number, day: number) => `${pad2(day)}.${pad2(month)}.${year}`;

/* ── The package ─────────────────────────────────────────────────────────────── */

/**
 * Build one fiscal year's canonical package. `yearOffset` shifts the rent a
 * little so year-over-year comparisons on the Reporting tab aren't flat: an
 * older year is billed slightly lower, as an indexed Swiss lease would be.
 */
export function buildDemoPackage(fiscalYear: number, opts?: { rentFactor?: number }): PackageFile[] {
  const rentFactor = opts?.rentFactor ?? 1;
  const round = (n: number) => Math.round(n);

  // 1. Building identity
  const infoCsv = emitBuildingInfoCsv({
    immeubleAdresse: DEMO_BUILDING_ADDRESS,
    immeubleReference: OBJECT_PREFIX.split(".")[0],
    periode: `01.01.${fiscalYear} - 31.12.${fiscalYear}`,
  });

  // 2. Rent roll
  const rentRollRows: ExtractedRentRollRow[] = ALL_UNITS.map((u) => ({
    objet: `${OBJECT_PREFIX}.${u.suffix}`,
    tenantName: u.tenant,
    unitType: u.type,
    floor: u.floor || null,
    rooms: u.rooms || null,
    areaSqm: u.areaSqm || null,
    entree: u.entree || null,
    sortie: "",
    loyerNetChf: round(u.netRentChf * rentFactor),
    chargesChf: u.chargesChf,
  }));
  const rentRollCsv = emitRentRollCsv(rentRollRows);

  // 3. Income statement — revenue from the let objects, expenses from the ledger
  const revenueChf = round(annualCollectedRentChf() * rentFactor);
  const chargesChf = round(annualChargesChf() * rentFactor);
  const expensesChf = totalExpensesChf(fiscalYear);
  const incomeBalances: ExtractedAccountBalance[] = [
    { rawAccountCode: "41000", rawAccountName: "Produits locatifs", balanceChf: revenueChf, balanceType: "CREDIT", documentSection: "REVENUE" },
    { rawAccountCode: "41200", rawAccountName: "Charges refacturées", balanceChf: chargesChf, balanceType: "CREDIT", documentSection: "REVENUE" },
    ...demoExpenses(fiscalYear).map((e) => ({
      rawAccountCode: e.account,
      rawAccountName: e.accountName,
      balanceChf: e.postings.reduce((s, p) => s + p.chf, 0),
      balanceType: "DEBIT" as const,
      documentSection: "EXPENSE" as const,
    })),
  ];
  const incomeCsv = emitAccountBalancesCsv(incomeBalances, "income", {
    REVENUE: revenueChf + chargesChf,
    EXPENSE: expensesChf,
  });

  // 4. Balance sheet — kept deliberately simple but two-sided and balancing.
  const cashChf = round(revenueChf * 0.18);
  const receivablesChf = round(revenueChf * 0.04);
  const propertyChf = 6_450_000;
  const actifTotal = cashChf + receivablesChf + propertyChf;
  const mortgageChf = 3_900_000;
  const payablesChf = round(expensesChf * 0.09);
  const depositsChf = round(annualCollectedRentChf() * rentFactor * 0.25);
  const equityChf = actifTotal - mortgageChf - payablesChf - depositsChf;
  const balanceBalances: ExtractedAccountBalance[] = [
    { rawAccountCode: "1020", rawAccountName: "Banque",                       balanceChf: cashChf,        balanceType: "DEBIT",  documentSection: "ACTIF" },
    { rawAccountCode: "1100", rawAccountName: "Débiteurs locataires",         balanceChf: receivablesChf, balanceType: "DEBIT",  documentSection: "ACTIF" },
    { rawAccountCode: "1600", rawAccountName: "Immeuble",                     balanceChf: propertyChf,    balanceType: "DEBIT",  documentSection: "ACTIF" },
    { rawAccountCode: "2000", rawAccountName: "Créanciers",                   balanceChf: payablesChf,    balanceType: "CREDIT", documentSection: "PASSIF" },
    { rawAccountCode: "2030", rawAccountName: "Garanties de loyer",           balanceChf: depositsChf,    balanceType: "CREDIT", documentSection: "PASSIF" },
    { rawAccountCode: "2400", rawAccountName: "Dette hypothécaire",           balanceChf: mortgageChf,    balanceType: "CREDIT", documentSection: "PASSIF" },
    { rawAccountCode: "2800", rawAccountName: "Capital propre",               balanceChf: equityChf,      balanceType: "CREDIT", documentSection: "PASSIF" },
  ];
  const balanceCsv = emitAccountBalancesCsv(balanceBalances, "balance", {
    ACTIF: actifTotal,
    PASSIF: mortgageChf + payablesChf + depositsChf + equityChf,
  });

  // 5. General ledger — the postings behind the expense accounts. The unit
  //    prefix is what drives per-unit expense attribution downstream.
  // Piece numbers must be unique ACROSS fiscal years: the ledger import is
  // idempotent on the piece key, so a second year reusing 1001.. would be
  // silently dropped as already-imported and that year's vendor invoices would
  // never appear. Namespacing by year keeps each year's postings distinct.
  let piece = fiscalYear * 10000;
  const ledgerRows: ExtractedLedgerRow[] = [];
  for (const e of demoExpenses(fiscalYear)) {
    for (const p of e.postings) {
      piece += 1;
      const prefix = p.unit ? `${OBJECT_PREFIX}.${p.unit}: ` : "";
      ledgerRows.push({
        compte: e.account,
        accountName: e.accountName,
        dateValeur: dmy(fiscalYear, p.month, p.day),
        noPiece: String(piece),
        texteEcriture: `${prefix}${p.vendor} / ${p.description}`,
        montantChf: p.chf,
      });
    }
  }
  const ledgerCsv = emitGrandLivreCsv(ledgerRows);

  const files: PackageFile[] = [];
  if (infoCsv) files.push({ fileName: `informations-${fiscalYear}.csv`, text: infoCsv });
  if (rentRollCsv) files.push({ fileName: `etat-locatif-${fiscalYear}.csv`, text: rentRollCsv });
  if (balanceCsv) files.push({ fileName: `bilan-${fiscalYear}.csv`, text: balanceCsv });
  if (incomeCsv) files.push({ fileName: `compte-exploitation-${fiscalYear}.csv`, text: incomeCsv });
  if (ledgerCsv) files.push({ fileName: `grand-livre-${fiscalYear}.csv`, text: ledgerCsv });
  return files;
}

/** Headline figures, for logging and for the seeder's response. */
export function demoPackageSummary(fiscalYear: number, rentFactor = 1) {
  return {
    potentialRentChf: Math.round(annualPotentialRentChf() * rentFactor),
    collectedRentChf: Math.round(annualCollectedRentChf() * rentFactor),
    expensesChf: totalExpensesChf(fiscalYear),
    units: ALL_UNITS.length,
    vacantUnits: ALL_UNITS.filter((u) => !u.tenant).length,
  };
}
