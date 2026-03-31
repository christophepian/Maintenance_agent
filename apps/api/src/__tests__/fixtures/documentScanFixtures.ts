/**
 * Document scan fixtures — deterministic text inputs for regression testing.
 *
 * Each fixture simulates the text content that would be extracted from a real
 * document after OCR / PDF text extraction. The text is realistic enough to
 * exercise classification and field-extraction logic without requiring binary
 * files, network calls, or actual OCR processing.
 *
 * Naming convention:
 *   DOC_<type>_<variant>
 *
 * All fixtures are sanitized and anonymized — no real personal data.
 */

/* ══════════════════════════════════════════════════════════════
   IDENTITY
   ══════════════════════════════════════════════════════════════ */

/** Swiss identity card — French, with MRZ-like lines */
export const DOC_IDENTITY_SWISS_FR = `
CONFÉDÉRATION SUISSE
CARTE D'IDENTITÉ
Nom: MUELLER
Prénom: Sophie
Date de naissance: 15.06.1990
Nationalité: Suisse
Numéro: C1234567
Sexe: F
`.trim();

/** Passport — English, with MRZ-like machine-readable zone */
export const DOC_IDENTITY_PASSPORT_EN = `
PASSPORT
UNITED KINGDOM OF GREAT BRITAIN
Surname: SMITH
Given Names: John David
Date of Birth: 03 MAR 1985
Nationality: BRITISH
Passport No: AB1234567
Sex: M
P<GBRSMITH<<JOHN<DAVID<<<<<<<<<<<<<<<<<<<<<
AB12345678GBR8503033M2512319<<<<<<<<<<<<<<04
`.trim();

/** German identity document */
export const DOC_IDENTITY_DE = `
BUNDESREPUBLIK DEUTSCHLAND
PERSONALAUSWEIS
Familienname: WEBER
Vorname: Thomas
Geburtsdatum: 22.11.1988
Staatsangehörigkeit: DEUTSCH
Dokumentennummer: T220001234
Geschlecht: M
`.trim();

/* ══════════════════════════════════════════════════════════════
   SALARY PROOF
   ══════════════════════════════════════════════════════════════ */

/** French payslip */
export const DOC_SALARY_FR = `
TechCorp Sàrl
Rue du Lac 14, 1003 Lausanne

FICHE DE SALAIRE — Janvier 2026

Collaborateur: Sophie Mueller
Fonction: Ingénieur logiciel

Salaire brut:  CHF 9'500.00
AVS / AI / APG:  CHF -499.70
Assurance chômage:  CHF -104.50
LPP:  CHF -412.00
Impôt à la source:  CHF -1'235.00

Salaire net:  CHF 7'248.80

Versement sur compte: CH12 3456 7890 1234 5678 9
`.trim();

/** German payslip */
export const DOC_SALARY_DE = `
MechaBau AG
Industriestrasse 42, 8005 Zürich

LOHNABRECHNUNG — Februar 2026

Mitarbeiter: Thomas Weber
Beruf: Projektleiter

Bruttolohn:  CHF 10'200.00
AHV / IV / EO:  CHF -536.50
ALV:  CHF -112.20
BVG:  CHF -520.00
Quellensteuer:  CHF -1'580.00

Nettolohn:  CHF 7'451.30
`.trim();

/** English payslip (minimal) */
export const DOC_SALARY_EN = `
Global Services Ltd
10 Innovation Drive, London EC1A 1BB

PAY SLIP — March 2026

Employee: John Smith
Position: Software Engineer

Gross Pay: GBP 5,800.00
Tax: GBP -1,160.00
NI: GBP -464.00
Pension: GBP -174.00

Net Pay: GBP 4,002.00
`.trim();

/* ══════════════════════════════════════════════════════════════
   DEBT ENFORCEMENT EXTRACT
   ══════════════════════════════════════════════════════════════ */

/** Clean debt extract — French, explicit negative */
export const DOC_DEBT_CLEAN_FR = `
Office des poursuites de Lausanne
Extrait du registre des poursuites

Nom: Mueller Sophie
Adresse: Rue du Lac 14, 1003 Lausanne

Résultat: aucune poursuite

Date de l'extrait: 15.01.2026
`.trim();

/** Clean debt extract — German, explicit negative */
export const DOC_DEBT_CLEAN_DE = `
Betreibungsamt Zürich
Betreibungsauskunft

Name: Weber Thomas
Adresse: Industriestrasse 42, 8005 Zürich

Ergebnis: Keine Betreibung

Datum: 10.02.2026
`.trim();

/** Clean debt extract — "néant" format */
export const DOC_DEBT_CLEAN_NEANT = `
Office des poursuites du district de Genève
Extrait des poursuites

Concerne: Pierre Martin
Poursuites en cours: néant
Actes de défaut de biens: néant

Date: 20.02.2026
`.trim();

/** Positive debt extract — amounts and creditor */
export const DOC_DEBT_POSITIVE_FR = `
Office des poursuites de Lausanne
Extrait du registre des poursuites

Nom: Dupont Marie
Adresse: Av. de Cour 12, 1007 Lausanne

Poursuite en cours depuis le 01.02.2026
N° de poursuite: 45678
Créancier: UBS SA
Montant: CHF 5'432.50

Date de l'extrait: 15.03.2026
`.trim();

/** Positive debt extract — German */
export const DOC_DEBT_POSITIVE_DE = `
Betreibungsamt des Kantons Zürich
Betreibungsregisterauszug

Schuldner: Schmidt Anna
Laufende Betreibung vorhanden
Betreibungsnummer: 12345
Gläubiger: Swisscom AG
Betrag: Fr. 3'200.00

Verlustschein ausgestellt am 10.02.2026
Datum: 05.03.2026
`.trim();

/** Ambiguous debt extract — header only, no clear verdict */
export const DOC_DEBT_AMBIGUOUS = `
Office des poursuites de Lausanne
Extrait du registre des poursuites

Nom: Dupont Jean
Date: 15.01.2026
Adresse: Rue du Lac 12, 1003 Lausanne
`.trim();

/** Noisy / OCR-corrupted debt extract text */
export const DOC_DEBT_NOISY_OCR = `
0ffl<e d3s p0ursu!t3s
Extr@!t du r3g!str3
N0m: D.up0nt J3@n
R3sult@t: @u<un3 ins<ription
D@t3: 15,01.202G
`.trim();

/** Contradictory debt extract — both clean and amounts */
export const DOC_DEBT_CONTRADICTORY = `
Office des poursuites
Résultat: aucune poursuite
Montant: CHF 5'000.00
Créancier: UBS SA
Date: 15.01.2026
`.trim();

/* ══════════════════════════════════════════════════════════════
   PERMIT
   ══════════════════════════════════════════════════════════════ */

/** Swiss residence permit — B type */
export const DOC_PERMIT_B_FR = `
CONFÉDÉRATION SUISSE
TITRE DE SÉJOUR

Permis B
Nom: Garcia
Prénom: Maria
Nationalité: Espagnole
Valable jusqu'au: 31.12.2027
`.trim();

/** German-language permit */
export const DOC_PERMIT_C_DE = `
SCHWEIZERISCHE EIDGENOSSENSCHAFT
AUFENTHALTSBEWILLIGUNG

Bewilligung C
Nachname: Rossi
Vorname: Marco
Staatsangehörigkeit: Italienisch
Gültig bis: 30.06.2028
`.trim();

/* ══════════════════════════════════════════════════════════════
   HOUSEHOLD INSURANCE
   ══════════════════════════════════════════════════════════════ */

/** Household insurance — French */
export const DOC_INSURANCE_FR = `
MOBILIÈRE SUISSE
Société d'assurances

Police d'assurance ménage et responsabilité civile privée

Assuré: Mueller Sophie
N° de police: 12.345.678
Couverture RC privée: CHF 5'000'000
Début: 01.01.2026
`.trim();

/** Household insurance — German, well-known insurer */
export const DOC_INSURANCE_DE = `
ZURICH VERSICHERUNG
Hausratversicherung und Haftpflichtversicherung

Versicherungsnehmer: Weber Thomas
Policennummer: ZH-98765432
Deckung: CHF 3'000'000
Gültig ab: 01.01.2026
`.trim();

/* ══════════════════════════════════════════════════════════════
   UNKNOWN / UNCLASSIFIABLE
   ══════════════════════════════════════════════════════════════ */

/** Invoice-like document (not a recognized doc type for rental) */
export const DOC_UNKNOWN_INVOICE = `
INVOICE #2026-0042
From: CleanCo Services
To: Building Admin GmbH

Description: Hallway cleaning — March 2026
Amount: CHF 450.00
VAT 8.1%: CHF 36.45
Total: CHF 486.45

Payment due: 30.04.2026
`.trim();

/** Random garbled text */
export const DOC_UNKNOWN_GARBLED = `
|||///###$$$%%%^^^&&&***((()))===+++
??!!@@##$$%%^^&&**((
!!!...///---___===+++***
`.trim();

/** Very short text */
export const DOC_UNKNOWN_SHORT = "hello";

/* ══════════════════════════════════════════════════════════════
   Filename fixtures — for classification-by-filename testing
   ══════════════════════════════════════════════════════════════ */

export const FILENAMES = {
  identity: [
    "passport_scan.pdf",
    "carte_identite.jpg",
    "personalausweis.png",
    "ID_card.pdf",
  ],
  salary: [
    "fiche_salaire_jan2026.pdf",
    "lohnabrechnung_feb2026.pdf",
    "pay_slip_march.pdf",
    "bulletin_de_paie.jpg",
  ],
  debt: [
    "extrait_poursuites.pdf",
    "betreibungsauskunft.pdf",
    "debt_enforcement_extract.pdf",
  ],
  permit: [
    "permis_sejour_B.pdf",
    "aufenthaltsbewilligung.jpg",
    "residence_permit.pdf",
  ],
  insurance: [
    "assurance_menage.pdf",
    "hausratversicherung.pdf",
    "rc_insurance.pdf",
    "household_insurance_policy.pdf",
  ],
  unknown: [
    "document.pdf",
    "scan_001.jpg",
    "file.txt",
    "unnamed.pdf",
  ],
} as const;
