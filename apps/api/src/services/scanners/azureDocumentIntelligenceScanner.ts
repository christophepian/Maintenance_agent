/**
 * Azure Document Intelligence Scanner.
 *
 * Implements DocumentScanner via Azure AI Document Intelligence REST API.
 * Uses the prebuilt-document model (configurable via env var) to extract
 * key-value pairs, then normalizes them into the same ScanResult field
 * keys that LocalOcrScanner produces.
 *
 * Required env vars:
 *   AZURE_DOCUMENT_INTELLIGENCE_ENDPOINT — e.g. https://my-resource.cognitiveservices.azure.com
 *   AZURE_DOCUMENT_INTELLIGENCE_KEY      — API key
 *
 * Optional env vars:
 *   AZURE_DOCUMENT_INTELLIGENCE_MODEL    — model id (default: "prebuilt-document")
 */

import type {
  DocumentScanner,
  DetectedDocType,
  ScanResult,
  ExtractedAccountBalance,
  ExtractedInvoiceLine,
} from "../documentScanner";
import { verifyDebtEnforcement } from "./debtEnforcementVerifier";
import { getAnthropicClient } from "../aiClient";

/* ══════════════════════════════════════════════════════════════
   Types from the Azure SDK — imported lazily to keep cold-start
   fast when the provider is not "azure".
   ══════════════════════════════════════════════════════════════ */

import type {
  DocumentIntelligenceClient,
} from "@azure-rest/ai-document-intelligence";

import type {
  DocumentFieldOutput,
  AnalyzeResultOutput,
} from "@azure-rest/ai-document-intelligence";

/* ══════════════════════════════════════════════════════════════
   MIME → content-type mapping accepted by the SDK
   ══════════════════════════════════════════════════════════════ */

type AzureContentType =
  | "application/octet-stream"
  | "application/pdf"
  | "image/jpeg"
  | "image/png"
  | "image/tiff"
  | "image/bmp"
  | "image/heif";

const MIME_MAP: Record<string, AzureContentType> = {
  "application/pdf": "application/pdf",
  "image/jpeg": "image/jpeg",
  "image/jpg": "image/jpeg",
  "image/png": "image/png",
  "image/tiff": "image/tiff",
  "image/bmp": "image/bmp",
  "image/heif": "image/heif",
};

/* ══════════════════════════════════════════════════════════════
   Document-type detection (same regex logic as LocalOcrScanner)
   ══════════════════════════════════════════════════════════════ */

const DOC_PATTERNS: { type: DetectedDocType; patterns: RegExp[] }[] = [
  {
    type: "IDENTITY",
    patterns: [
      /passport/i, /identity/i, /identit[eé]/i, /carte.*identit/i,
      /ausweis/i, /\bid[\s_-]?card/i,
      // catch filenames like "ChristophePian-ID2025.pdf" or "scan_ID_2024.jpg"
      /\bID\d{2,4}\b/, /[-_]ID[-_.]/i, /^ID[^a-z]/,
    ],
  },
  {
    type: "SALARY_PROOF",
    patterns: [
      /salary/i, /salaire/i, /pay[\s_-]?slip/i, /fiche.*paie/i,
      /lohn/i, /gehalt/i, /bulletin.*paie/i, /revenue/i,
    ],
  },
  {
    type: "DEBT_ENFORCEMENT_EXTRACT",
    patterns: [
      /debt/i, /enforcement/i, /poursuite/i, /betreibung/i,
      /extrait.*poursuite/i, /schuld/i,
    ],
  },
  {
    type: "PERMIT",
    patterns: [
      /permit/i, /permis/i, /aufenthalt/i, /bewilligung/i,
      /residence/i, /s[eé]jour/i,
    ],
  },
  {
    type: "INVOICE",
    patterns: [
      /invoice/i, /facture/i, /rechnung/i, /\bbill\b/i,
      /quittung/i, /devis/i, /offerte/i, /gutschrift/i,
    ],
  },
  {
    type: "FINANCIAL_STATEMENT",
    patterns: [
      /bilan/i, /jahresrechnung/i, /bilanz/i,
      /compte.*r[eé]sultat/i, /jahresabschluss/i,
      /cl[oô]ture.*annuelle/i, /soldes.*comptes/i,
      /closing.*balance/i, /r[eé]capitulatif.*comptes/i,
      /decompte.*annuel/i, /d[eé]compte.*g[eé]rance/i,
      /abrechnun/i, /gesamtabrechnung/i,
      /relevé.*compte/i, /extrait.*compte/i,
    ],
  },
  {
    type: "HOUSEHOLD_INSURANCE",
    patterns: [
      /insurance/i, /assurance/i, /versicherung/i,
      /rc[\s_-]?priv/i, /responsabilit[eé]/i, /haftpflicht/i,
      /household/i, /m[eé]nage/i,
    ],
  },
];

function detectDocType(
  fileName: string,
  hintDocType?: string,
): DetectedDocType {
  // User-supplied hint takes priority
  if (hintDocType) {
    const upper = hintDocType.toUpperCase().replace(/[\s-]/g, "_") as DetectedDocType;
    const valid: DetectedDocType[] = [
      "IDENTITY", "SALARY_PROOF", "DEBT_ENFORCEMENT_EXTRACT",
      "PERMIT", "HOUSEHOLD_INSURANCE", "INVOICE",
    ];
    if (valid.includes(upper)) return upper;
  }

  // Match by filename
  for (const { type, patterns } of DOC_PATTERNS) {
    if (patterns.some((p) => p.test(fileName))) return type;
  }

  return "UNKNOWN";
}

/* ══════════════════════════════════════════════════════════════
   Content-based doc-type refinement (post-analysis)
   ══════════════════════════════════════════════════════════════ */

function refineDocTypeFromContent(
  initialType: DetectedDocType,
  content: string,
): DetectedDocType {
  if (initialType !== "UNKNOWN") return initialType;

  const text = content.toLowerCase();

  if (/passport|carte\s*d'identit|ausweis|identity\s*card/i.test(text))
    return "IDENTITY";
  if (/salary|salaire|lohn|gehalt|fiche\s*de\s*paie|pay\s*slip/i.test(text))
    return "SALARY_PROOF";
  if (/poursuite|betreibung|debt\s*enforcement|schuldbetreibung/i.test(text))
    return "DEBT_ENFORCEMENT_EXTRACT";
  if (/permis|permit|aufenthalt|bewilligung|s[eé]jour/i.test(text))
    return "PERMIT";
  if (/assurance|versicherung|insurance|responsabilit[eé]|haftpflicht/i.test(text))
    return "HOUSEHOLD_INSURANCE";
  if (/invoice|facture|rechnung|\bbill\b|total\s*(amount|due|chf|eur)|montant\s*(total|d[ûu])|gesamtbetrag/i.test(text))
    return "INVOICE";

  if (/bilan|jahresrechnung|bilanz|soldes\s*des\s*comptes|cl[oô]ture\s*annuelle|jahresabschluss|d[eé]compte.*g[eé]rance|gesamtabrechnung/i.test(text))
    return "FINANCIAL_STATEMENT";

  return "UNKNOWN";
}

/* ══════════════════════════════════════════════════════════════
   Azure field → ScanResult field normalization helpers
   ══════════════════════════════════════════════════════════════ */

/**
 * Extract a string value from a DocumentFieldOutput.
 * Handles the SDK's union-typed value properties.
 */
function fieldToString(field: DocumentFieldOutput | undefined): string | null {
  if (!field) return null;
  if (field.valueString !== undefined) return field.valueString;
  if (field.content !== undefined) return field.content;
  if (field.valueDate !== undefined) return field.valueDate;
  if (field.valuePhoneNumber !== undefined) return field.valuePhoneNumber;
  if (field.valueCountryRegion !== undefined) return field.valueCountryRegion;
  if (field.valueInteger !== undefined) return String(field.valueInteger);
  if (field.valueNumber !== undefined) return String(field.valueNumber);
  return null;
}

function fieldToNumber(field: DocumentFieldOutput | undefined): number | null {
  if (!field) return null;
  if (field.valueNumber !== undefined) return field.valueNumber;
  if (field.valueInteger !== undefined) return field.valueInteger;
  if (field.valueCurrency !== undefined) return field.valueCurrency.amount;
  // Try parsing content as a number
  if (field.content) {
    const cleaned = field.content.replace(/[^\d.,\-]/g, "").replace(",", ".");
    const n = parseFloat(cleaned);
    if (!isNaN(n)) return n;
  }
  return null;
}

/**
 * Compute average confidence across all extracted fields.
 * Clamp to [30, 95] to match LocalOcrScanner range.
 */
function averageConfidence(
  fields: Record<string, DocumentFieldOutput>,
): number {
  const confidences = Object.values(fields)
    .map((f) => f.confidence)
    .filter((c): c is number => c !== undefined);
  if (confidences.length === 0) return 30;
  const avg = confidences.reduce((a, b) => a + b, 0) / confidences.length;
  return Math.max(30, Math.min(95, Math.round(avg * 100)));
}

/* ══════════════════════════════════════════════════════════════
   Per-doc-type field normalization
   ──────────────────────────────────────────────────────────────
   Each function maps Azure prebuilt-document key-value pairs
   into the same field names that LocalOcrScanner produces,
   so downstream consumers are provider-agnostic.
   ══════════════════════════════════════════════════════════════ */

function normalizeIdentityFields(
  azureFields: Record<string, DocumentFieldOutput>,
  kvPairs: Array<{ key: string; value: string }>,
  content: string,
): Record<string, string | number | boolean | null> {
  const fields: Record<string, string | number | boolean | null> = {};

  // 1a. Flatten MachineReadableZone sub-fields — passports return most structured
  //     data nested under MRZ rather than at the top level of documents[0].fields.
  //     Top-level fields win; MRZ fills in what's missing.
  const mrzObject = (azureFields["MachineReadableZone"] as any)?.valueObject as
    Record<string, DocumentFieldOutput> | undefined;
  if (mrzObject) {
    for (const [k, v] of Object.entries(mrzObject)) {
      if (!azureFields[k]) {
        azureFields[k] = v;
      }
    }
  }

  // 1b. Azure structured fields (populated by prebuilt-idDocument)
  fields.lastName =
    fieldToString(azureFields["LastName"]) ??
    fieldToString(azureFields["Surname"]) ??
    findKvValue(kvPairs, /last\s*name|nom|nachname|surname/i);

  fields.firstName =
    fieldToString(azureFields["FirstName"]) ??
    fieldToString(azureFields["GivenNames"]) ??
    findKvValue(kvPairs, /first\s*name|pr[eé]nom|vorname|given\s*name/i);

  fields.dateOfBirth =
    fieldToString(azureFields["DateOfBirth"]) ??
    fieldToString(azureFields["BirthDate"]) ??
    findKvValue(kvPairs, /date.*birth|date.*naissance|geburtsdatum/i);

  fields.expiryDate =
    fieldToString(azureFields["DateOfExpiration"]) ??
    fieldToString(azureFields["ExpirationDate"]) ??
    findKvValue(kvPairs, /expir|valid.*until|valable\s*jusqu|g[uü]ltig\s*bis/i);

  fields.nationality =
    fieldToString(azureFields["Nationality"]) ??
    fieldToString(azureFields["CountryRegion"]) ??
    findKvValue(kvPairs, /national|citiz|staatsangeh/i);

  fields.documentNumber =
    fieldToString(azureFields["DocumentNumber"]) ??
    findKvValue(kvPairs, /document\s*(no|number|nr)|passeport\s*n|pass\s*nr/i);

  fields.sex =
    fieldToString(azureFields["Sex"]) ??
    fieldToString(azureFields["Gender"]) ??
    findKvValue(kvPairs, /\bsex\b|\bgender\b|\bsexe\b|\bgeschlecht\b/i);

  // 2. Content-based regex fallbacks (Swiss / European ID cards, MRZ lines)
  //    Applied only when structured extraction yielded nothing.

  if (!fields.lastName) {
    const m = content.match(
      /(?:^|\n)\s*(?:nom|name|nachname|familienname|surname)\s*[:\n]+\s*([A-ZÀÂÄÉÈÊËÏÎÔÖÙÛÜÇ][A-ZÀÂÄÉÈÊËÏÎÔÖÙÛÜÇ\s-]{1,30})/im,
    );
    if (m) fields.lastName = m[1].trim();
  }

  if (!fields.firstName) {
    const m = content.match(
      /(?:^|\n)\s*(?:pr[eé]nom|given\s*names?|vornamen?)\s*[:\n]+\s*([A-ZÀÂÄÉÈÊËÏÎÔÖÙÛÜÇ][A-ZÀÂÄÉÈÊËÏÎÔÖÙÛÜÇ\s-]{1,30})/im,
    );
    if (m) fields.firstName = m[1].trim();
  }

  if (!fields.dateOfBirth) {
    // Swiss DD.MM.YYYY, ISO YYYY-MM-DD, or DD/MM/YYYY
    const m = content.match(/\b(\d{2}[./]\d{2}[./]\d{4}|\d{4}-\d{2}-\d{2})\b/);
    if (m) fields.dateOfBirth = m[1];
  }

  if (!fields.sex) {
    // Standalone M or F — avoid matching middle of longer words
    const m = content.match(/(?:^|[\s:/|])([MF])(?=$|[\s:/|<])/m);
    if (m) fields.sex = m[1];
  }

  if (!fields.documentNumber) {
    // Swiss ID: letter + 7-8 digits; passports: letter + 8 digits
    const m = content.match(/\b([A-Z]\d{7,8})\b/);
    if (m) fields.documentNumber = m[1];
  }

  if (!fields.nationality) {
    // Label-based extraction
    const labelM = content.match(
      /(?:nationalit[eé]|nationality|staatsangeh[öo]rigkeit)\s*[:\n]\s*([A-Z]{2,3})/i,
    );
    if (labelM) {
      fields.nationality = labelM[1];
    } else if (/\bCHE\b/.test(content) || /\b(?:SUISSE|SCHWEIZER|SVIZZERO)\b/i.test(content)) {
      fields.nationality = "CHE";
    } else {
      // MRZ line: 3-letter country code after < separators
      const mrzM = content.match(/[A-Z]{2}<([A-Z]{3})</);
      if (mrzM) fields.nationality = mrzM[1];
    }
  }

  return fields;
}

function normalizeSalaryFields(
  azureFields: Record<string, DocumentFieldOutput>,
  kvPairs: Array<{ key: string; value: string }>,
): Record<string, string | number | boolean | null> {
  const fields: Record<string, string | number | boolean | null> = {};

  fields.employer =
    fieldToString(azureFields["Employer"]) ??
    fieldToString(azureFields["CompanyName"]) ??
    findKvValue(kvPairs, /employer|employeur|arbeitgeber|company|soci[eé]t[eé]/i);

  const netAmount = fieldToNumber(azureFields["NetPay"]) ??
    fieldToNumber(azureFields["NetAmount"]) ??
    parseNumberFromKv(kvPairs, /net\s*(pay|amount|salary|salaire)|salaire\s*net|nettolohn/i);
  fields.netMonthlyIncome = netAmount;

  const grossAmount = fieldToNumber(azureFields["GrossPay"]) ??
    fieldToNumber(azureFields["GrossAmount"]) ??
    parseNumberFromKv(kvPairs, /gross|brut|brutto/i);
  fields._grossAmount = grossAmount;

  fields.firstName =
    fieldToString(azureFields["FirstName"]) ??
    fieldToString(azureFields["EmployeeName"]) ??
    findKvValue(kvPairs, /first\s*name|pr[eé]nom|vorname/i);

  fields.lastName =
    fieldToString(azureFields["LastName"]) ??
    findKvValue(kvPairs, /last\s*name|nom|nachname|surname/i);

  fields.salaryPeriod =
    fieldToString(azureFields["PayPeriod"]) ??
    fieldToString(azureFields["Period"]) ??
    findKvValue(kvPairs, /period|p[eé]riode|zeitraum|mois/i);

  fields.jobTitle =
    fieldToString(azureFields["JobTitle"]) ??
    fieldToString(azureFields["Position"]) ??
    findKvValue(kvPairs, /job\s*title|position|fonction|beruf|poste/i);

  return fields;
}

function normalizeDebtFields(
  azureFields: Record<string, DocumentFieldOutput>,
  kvPairs: Array<{ key: string; value: string }>,
  content: string,
): Record<string, string | number | boolean | null> {
  const fields: Record<string, string | number | boolean | null> = {};

  // Debt-enforcement classification (shared verifier)
  const verification = verifyDebtEnforcement(content);
  fields.hasDebtEnforcement = verification.hasDebtEnforcement;

  // Azure structured status field takes priority, then shared verifier status
  fields.extractStatus =
    fieldToString(azureFields["Status"]) ??
    findKvValue(kvPairs, /status|statut|stand/i) ??
    verification.extractStatus;

  fields.extractDate =
    fieldToString(azureFields["Date"]) ??
    fieldToString(azureFields["ExtractDate"]) ??
    findKvValue(kvPairs, /date|datum/i);

  fields.firstName =
    fieldToString(azureFields["FirstName"]) ??
    findKvValue(kvPairs, /first\s*name|pr[eé]nom|vorname/i);

  fields.lastName =
    fieldToString(azureFields["LastName"]) ??
    findKvValue(kvPairs, /last\s*name|nom|nachname/i);

  return fields;
}

function normalizePermitFields(
  azureFields: Record<string, DocumentFieldOutput>,
  kvPairs: Array<{ key: string; value: string }>,
  content: string,
): Record<string, string | number | boolean | null> {
  const fields: Record<string, string | number | boolean | null> = {};

  // Extract permit type letter (B, C, L, G, etc.)
  const permitTypeRaw =
    fieldToString(azureFields["PermitType"]) ??
    fieldToString(azureFields["DocumentType"]) ??
    findKvValue(kvPairs, /permit\s*type|type.*permis|bewilligungsart/i);

  if (permitTypeRaw) {
    const match = permitTypeRaw.match(/\b([A-Z])\b/);
    fields.permitType = match ? match[1] : permitTypeRaw;
  } else {
    // Try to extract from content
    const contentMatch = content.match(/(?:permis|permit|bewilligung)\s*([A-Z])\b/i);
    fields.permitType = contentMatch ? contentMatch[1].toUpperCase() : null;
  }

  fields.lastName =
    fieldToString(azureFields["LastName"]) ??
    fieldToString(azureFields["Surname"]) ??
    findKvValue(kvPairs, /last\s*name|nom|nachname|surname/i);

  fields.firstName =
    fieldToString(azureFields["FirstName"]) ??
    fieldToString(azureFields["GivenNames"]) ??
    findKvValue(kvPairs, /first\s*name|pr[eé]nom|vorname/i);

  fields.nationality =
    fieldToString(azureFields["Nationality"]) ??
    fieldToString(azureFields["CountryRegion"]) ??
    findKvValue(kvPairs, /national|citiz|staatsangeh/i);

  fields.permitValidUntil =
    fieldToString(azureFields["ExpirationDate"]) ??
    fieldToString(azureFields["DateOfExpiration"]) ??
    findKvValue(kvPairs, /valid\s*until|expir|valable|g[uü]ltig\s*bis/i);

  return fields;
}

function normalizeInsuranceFields(
  azureFields: Record<string, DocumentFieldOutput>,
  kvPairs: Array<{ key: string; value: string }>,
): Record<string, string | number | boolean | null> {
  const fields: Record<string, string | number | boolean | null> = {};

  // If we identified this as insurance, it has RC insurance
  fields.hasRcInsurance = true;

  fields.rcInsuranceCompany =
    fieldToString(azureFields["CompanyName"]) ??
    fieldToString(azureFields["InsurerName"]) ??
    findKvValue(kvPairs, /company|compagnie|versicherung|assur(eur|ance)|insurer/i);

  fields.policyNumber =
    fieldToString(azureFields["PolicyNumber"]) ??
    fieldToString(azureFields["ContractNumber"]) ??
    findKvValue(kvPairs, /policy|police|polizze|contract|contrat|vertrag/i);

  return fields;
}

function normalizeInvoiceFields(
  azureFields: Record<string, DocumentFieldOutput>,
  kvPairs: Array<{ key: string; value: string }>,
  content: string,
): Record<string, string | number | boolean | null> {
  const fields: Record<string, string | number | boolean | null> = {};

  fields.vendorName =
    fieldToString(azureFields["VendorName"]) ??
    fieldToString(azureFields["CompanyName"]) ??
    fieldToString(azureFields["SupplierName"]) ??
    findKvValue(kvPairs, /vendor|supplier|fournisseur|lieferant|company|soci[eé]t[eé]|firma/i);
  // Regex fallback: "From: <vendor name>" pattern
  if (!fields.vendorName) {
    const vendorMatch = content.match(/(?:from|de|von|fournisseur|supplier|vendor)\s*[:;]\s*([^\n]{3,60})/i);
    if (vendorMatch) fields.vendorName = vendorMatch[1].trim();
  }

  fields.invoiceNumber =
    fieldToString(azureFields["InvoiceId"]) ??
    fieldToString(azureFields["InvoiceNumber"]) ??
    findKvValue(kvPairs, /invoice\s*(no|number|nr|#|n°)|facture\s*(no|num|n°|nr)|rechnung\s*(nr|nummer|no)/i);
  // Regex fallback: "Invoice Number: XXX" or "Facture N° XXX" or "Rechnung Nr. XXX"
  if (!fields.invoiceNumber) {
    const invNoMatch = content.match(
      /(?:invoice\s*(?:no|number|nr|#|n°)|facture\s*(?:no|num|n°|nr)|rechnung\s*(?:nr|nummer|no))[\s.:]*\s*([A-Za-z0-9][\w\-\/]{2,30})/i,
    );
    if (invNoMatch) fields.invoiceNumber = invNoMatch[1].trim();
  }

  fields.invoiceDate =
    fieldToString(azureFields["InvoiceDate"]) ??
    fieldToString(azureFields["Date"]) ??
    findKvValue(kvPairs, /invoice\s*date|date\s*(de\s*)?facture|rechnungsdatum|datum/i);
  // Regex fallback: "Invoice Date: dd.mm.yyyy"
  if (!fields.invoiceDate) {
    const dateMatch = content.match(
      /(?:invoice\s*date|date\s*(?:de\s*)?facture|rechnungsdatum|datum)\s*[:;]?\s*(\d{1,2}[.\/-]\d{1,2}[.\/-]\d{2,4})/i,
    );
    if (dateMatch) fields.invoiceDate = dateMatch[1].trim();
  }

  fields.dueDate =
    fieldToString(azureFields["DueDate"]) ??
    fieldToString(azureFields["PaymentDueDate"]) ??
    findKvValue(kvPairs, /due\s*date|[eé]ch[eé]ance|f[aä]lligkeits?datum|zahlbar\s*bis/i);
  // Regex fallback: "Due Date: dd.mm.yyyy"
  if (!fields.dueDate) {
    const dueMatch = content.match(
      /(?:due\s*date|[eé]ch[eé]ance|f[aä]lligkeits?datum|zahlbar\s*bis)\s*[:;]?\s*(\d{1,2}[.\/-]\d{1,2}[.\/-]\d{2,4})/i,
    );
    if (dueMatch) fields.dueDate = dueMatch[1].trim();
  }

  const totalAmount =
    fieldToNumber(azureFields["InvoiceTotal"]) ??
    fieldToNumber(azureFields["TotalAmount"]) ??
    fieldToNumber(azureFields["AmountDue"]) ??
    parseNumberFromKv(kvPairs, /total\s*(amount|due|ttc)?|montant\s*(total|ttc|d[ûu])|gesamtbetrag|endbetrag/i);
  // Regex fallback: "Total: CHF 1178.29" or "Gesamtbetrag: 1'178.29"
  if (totalAmount != null) {
    fields.totalAmount = totalAmount;
  } else {
    const totalMatch = content.match(
      /(?:total|montant\s*(?:total|ttc|d[ûu])|gesamtbetrag|endbetrag)\s*[:;]?\s*(?:CHF|EUR|USD)?\s*([\d'',. ]+(?:\.\d{2}))/i,
    );
    if (totalMatch) {
      const cleaned = totalMatch[1].replace(/['', ]/g, "");
      const n = parseFloat(cleaned);
      if (!isNaN(n)) fields.totalAmount = n;
    }
  }

  const vatAmount =
    fieldToNumber(azureFields["TotalTax"]) ??
    fieldToNumber(azureFields["VATAmount"]) ??
    parseNumberFromKv(kvPairs, /vat|tva|mwst|mehrwertsteuer|tax/i);
  // Regex fallback: "VAT (8.1%): CHF 88.29"
  if (vatAmount != null) {
    fields.vatAmount = vatAmount;
  } else {
    const vatMatch = content.match(
      /(?:vat|tva|mwst|mehrwertsteuer|tax)\s*(?:\([^)]*\))?\s*[:;]?\s*(?:CHF|EUR|USD)?\s*([\d'',. ]+(?:\.\d{2}))/i,
    );
    if (vatMatch) {
      const cleaned = vatMatch[1].replace(/['', ]/g, "");
      const n = parseFloat(cleaned);
      if (!isNaN(n)) fields.vatAmount = n;
    }
  }

  const subtotal =
    fieldToNumber(azureFields["SubTotal"]) ??
    parseNumberFromKv(kvPairs, /sub\s*total|sous[\s-]*total|netto|zwischensumme|montant\s*ht/i);
  // Regex fallback: "Subtotal: CHF 1090.00"
  if (subtotal != null) {
    fields.subtotal = subtotal;
  } else {
    const subMatch = content.match(
      /(?:sub\s*total|sous[\s-]*total|netto|zwischensumme|montant\s*ht)\s*[:;]?\s*(?:CHF|EUR|USD)?\s*([\d'',. ]+(?:\.\d{2}))/i,
    );
    if (subMatch) {
      const cleaned = subMatch[1].replace(/['', ]/g, "");
      const n = parseFloat(cleaned);
      if (!isNaN(n)) fields.subtotal = n;
    }
  }

  fields.currency =
    fieldToString(azureFields["CurrencyCode"]) ??
    findKvValue(kvPairs, /currency|devise|w[aä]hrung/i);
  // Infer CHF/EUR from content if not explicit
  if (!fields.currency) {
    if (/\bCHF\b/i.test(content)) fields.currency = "CHF";
    else if (/\bEUR\b/i.test(content)) fields.currency = "EUR";
  }

  fields.iban =
    findKvValue(kvPairs, /iban/i);
  if (!fields.iban) {
    const ibanMatch = content.match(/\b([A-Z]{2}\d{2}\s?[A-Z0-9\s]{10,30})\b/);
    if (ibanMatch) fields.iban = ibanMatch[1].replace(/\s/g, "");
  }

  fields.paymentReference =
    fieldToString(azureFields["PaymentReference"]) ??
    fieldToString(azureFields["ReferenceNumber"]) ??
    findKvValue(kvPairs, /reference|r[eé]f[eé]rence|referenz/i);
  // Regex fallback: "Reference: RF18 5390 0754 7034"
  if (!fields.paymentReference) {
    const refMatch = content.match(
      /(?:reference|r[eé]f[eé]rence|referenz)\s*[:;]?\s*([A-Z0-9][\w\s\-]{5,40})/i,
    );
    if (refMatch) fields.paymentReference = refMatch[1].trim();
  }

  fields.vendorAddress =
    fieldToString(azureFields["VendorAddress"]) ??
    fieldToString(azureFields["SupplierAddress"]) ??
    findKvValue(kvPairs, /address|adresse|anschrift/i);

  // Regex fallback: "Bill To: <name>" for recipientName on incoming invoices
  if (!fields.billToName) {
    const billToMatch = content.match(
      /(?:bill\s*to|factur[eé]\s*[àa]|rechnungsempf[äa]nger|destinataire)\s*[:;]?\s*([^\n]{3,60})/i,
    );
    if (billToMatch) fields.billToName = billToMatch[1].trim();
  }

  return fields;
}

/* ══════════════════════════════════════════════════════════════
   Key-value pair helpers
   ══════════════════════════════════════════════════════════════ */

interface KvPair {
  key: string;
  value: string;
}

function findKvValue(
  kvPairs: KvPair[],
  keyPattern: RegExp,
): string | null {
  const match = kvPairs.find((kv) => keyPattern.test(kv.key));
  return match?.value?.trim() || null;
}

function parseNumberFromKv(
  kvPairs: KvPair[],
  keyPattern: RegExp,
): number | null {
  const raw = findKvValue(kvPairs, keyPattern);
  if (!raw) return null;
  const cleaned = raw.replace(/[^\d.,\-]/g, "").replace(",", ".");
  const n = parseFloat(cleaned);
  return isNaN(n) ? null : n;
}

/* ══════════════════════════════════════════════════════════════
   Claude enrichment — fills null fields from raw OCR text
   ══════════════════════════════════════════════════════════════ */

/** Claude tool for extracting account balance rows from a financial statement. */
const FINANCIAL_STATEMENT_BALANCE_TOOL = {
  name: "extractAccountBalances",
  description:
    "Extract the list of account closing balances from a Swiss property management financial statement or balance sheet. " +
    "Return every account line found: its code, name, balance amount, and whether it is a debit or credit balance.",
  input_schema: {
    type: "object",
    required: ["balances"],
    properties: {
      fiscalYear: {
        type: "integer",
        description: "Fiscal year of the statement, e.g. 2024",
      },
      periodLabel: {
        type: "string",
        description: "Human-readable period label as it appears in the document, e.g. '01.01.2024 – 31.12.2024'",
      },
      buildingAddress: {
        type: "string",
        description: "Property address if mentioned in the document",
      },
      balances: {
        type: "array",
        description: "All account balance rows found in the document",
        items: {
          type: "object",
          required: ["rawAccountCode", "rawAccountName", "balanceChf", "balanceType"],
          properties: {
            rawAccountCode: { type: "string", description: "Account code as printed, e.g. '1020' or '4200'" },
            rawAccountName: { type: "string", description: "Account name as printed, e.g. 'Bank account'" },
            balanceChf: { type: "number", description: "Closing balance amount in CHF (positive number)" },
            balanceType: { type: "string", enum: ["DEBIT", "CREDIT"], description: "DEBIT for asset/expense accounts, CREDIT for liability/income accounts" },
          },
        },
      },
    },
  },
} as const;

/** Claude tool for extracting invoice lines from a financial statement that also contains invoices. */
const FINANCIAL_STATEMENT_INVOICE_TOOL = {
  name: "extractInvoiceLines",
  description:
    "Extract any individual invoice or expense line items from a Swiss property management document. " +
    "Each entry should represent one distinct invoice or charge found in the document.",
  input_schema: {
    type: "object",
    required: ["invoices"],
    properties: {
      invoices: {
        type: "array",
        items: {
          type: "object",
          properties: {
            vendorName:       { type: "string",  description: "Contractor or supplier name" },
            invoiceNumber:    { type: "string",  description: "Invoice or reference number" },
            invoiceDate:      { type: "string",  description: "Invoice date, DD.MM.YYYY if possible" },
            dueDate:          { type: "string",  description: "Payment due date" },
            totalAmount:      { type: "number",  description: "Total invoice amount in CHF (including VAT)" },
            vatAmount:        { type: "number",  description: "VAT amount in CHF" },
            subtotal:         { type: "number",  description: "Net amount before VAT" },
            currency:         { type: "string",  description: "Currency code, e.g. CHF" },
            iban:             { type: "string",  description: "Payee IBAN" },
            paymentReference: { type: "string",  description: "Payment reference number" },
            description:      { type: "string",  description: "What the invoice is for" },
            unitHint:         { type: "string",  description: "Apartment or unit number mentioned, e.g. 'Apt 3B'" },
            tenantHint:       { type: "string",  description: "Tenant name mentioned on the invoice" },
          },
        },
      },
    },
  },
} as const;

/** Per-doc-type tool schemas for Claude field extraction */
const CLAUDE_EXTRACTION_TOOLS: Partial<Record<DetectedDocType, object>> = {
  IDENTITY: {
    name: "extractIdentityFields",
    description: "Extract structured fields from an identity document (passport, national ID card) OCR text.",
    input_schema: {
      type: "object",
      properties: {
        firstName:      { type: "string", description: "Given name(s) / prénom(s) / Vorname(n)" },
        lastName:       { type: "string", description: "Surname / nom de famille / Nachname" },
        dateOfBirth:    { type: "string", description: "Date of birth — DD.MM.YYYY if possible" },
        sex:            { type: "string", enum: ["M", "F"], description: "Sex: M or F" },
        documentNumber: { type: "string", description: "Document or passport number" },
        nationality:    { type: "string", description: "ISO 3-letter country code, e.g. CHE, FRA, DEU" },
        expiryDate:     { type: "string", description: "Document expiry / validity date" },
      },
    },
  },
  SALARY_PROOF: {
    name: "extractSalaryFields",
    description: "Extract structured fields from a salary slip / pay slip OCR text.",
    input_schema: {
      type: "object",
      properties: {
        firstName:        { type: "string", description: "Employee first name" },
        lastName:         { type: "string", description: "Employee last name" },
        employer:         { type: "string", description: "Employer / company name" },
        netMonthlyIncome: { type: "number", description: "Net monthly income (number, no currency symbol)" },
        salaryPeriod:     { type: "string", description: "Pay period, e.g. 'January 2026'" },
        jobTitle:         { type: "string", description: "Job title / position" },
      },
    },
  },
  PERMIT: {
    name: "extractPermitFields",
    description: "Extract structured fields from a Swiss residence permit OCR text.",
    input_schema: {
      type: "object",
      properties: {
        firstName:        { type: "string", description: "Holder first name" },
        lastName:         { type: "string", description: "Holder surname" },
        permitType:       { type: "string", description: "Permit category letter: B, C, G, L, F, N, S…" },
        nationality:      { type: "string", description: "ISO 3-letter country code" },
        permitValidUntil: { type: "string", description: "Permit expiry / validity date" },
      },
    },
  },
  DEBT_ENFORCEMENT_EXTRACT: {
    name: "extractDebtFields",
    description: "Extract structured fields from a Swiss debt enforcement extract (extrait des poursuites) OCR text.",
    input_schema: {
      type: "object",
      properties: {
        firstName:          { type: "string",  description: "Subject first name" },
        lastName:           { type: "string",  description: "Subject surname" },
        hasDebtEnforcement: { type: "boolean", description: "True if active enforcement proceedings found" },
        extractStatus:      { type: "string",  description: "Status text from the extract" },
        extractDate:        { type: "string",  description: "Date of the extract" },
      },
    },
  },
};

/**
 * Ask Claude Haiku to extract / complete document fields from raw OCR text.
 * Non-blocking: returns {} on missing API key or any runtime error.
 * Only called when at least one non-private field is still null.
 */
async function enrichFieldsWithClaude(
  content: string,
  docType: DetectedDocType,
): Promise<Record<string, string | number | boolean | null>> {
  const toolDef = CLAUDE_EXTRACTION_TOOLS[docType];
  if (!toolDef || !content) return {};

  try {
    const client = getAnthropicClient();
    const response = await client.messages.create({
      model: "claude-haiku-4-5-20251001",
      max_tokens: 512,
      tools: [toolDef as Parameters<typeof client.messages.create>[0]["tools"][number]],
      tool_choice: { type: "any" },
      messages: [{
        role: "user",
        content:
          `Extract the structured fields from this ${docType.replace(/_/g, " ").toLowerCase()} document OCR text. ` +
          `Omit any field not clearly present in the text — do not guess.\n\nOCR text:\n${content}`,
      }],
    });

    const toolUse = response.content.find((b) => b.type === "tool_use");
    if (!toolUse || toolUse.type !== "tool_use") return {};

    const raw = toolUse.input as Record<string, unknown>;
    const result: Record<string, string | number | boolean | null> = {};
    for (const [k, v] of Object.entries(raw)) {
      if (v !== undefined && v !== "") {
        result[k] = v as string | number | boolean | null;
      }
    }
    return result;
  } catch (err) {
    console.warn(
      `[DOC-SCAN] Claude enrichment skipped:`,
      err instanceof Error ? err.message : err,
    );
    return {};
  }
}

/**
 * Extract account balances (and optionally invoice lines) from a financial
 * statement PDF using two parallel Claude Haiku tool-use calls.
 * Non-blocking: returns empty arrays on missing API key or any runtime error.
 */
async function extractFinancialStatementWithClaude(content: string): Promise<{
  fields: Record<string, string | number | boolean | null>;
  accountBalances: ExtractedAccountBalance[];
  invoiceLines: ExtractedInvoiceLine[];
}> {
  const empty = { fields: {}, accountBalances: [], invoiceLines: [] };
  if (!content) return empty;

  try {
    const client = getAnthropicClient();

    // Determine whether this document also contains invoice lines.
    // Simple heuristic: look for invoice-pattern keywords in content.
    const hasInvoiceContent =
      /facture|rechnung|invoice|\btotal\s*(?:chf|eur)\b|montant\s*total/i.test(content);

    const tools = hasInvoiceContent
      ? [FINANCIAL_STATEMENT_BALANCE_TOOL, FINANCIAL_STATEMENT_INVOICE_TOOL]
      : [FINANCIAL_STATEMENT_BALANCE_TOOL];

    const response = await client.messages.create({
      model: "claude-haiku-4-5-20251001",
      max_tokens: 8192,
      tools: tools as unknown as Parameters<typeof client.messages.create>[0]["tools"],
      tool_choice: { type: "any" },
      messages: [
        {
          role: "user",
          content:
            "Extract ALL account balance rows and any invoice lines from this Swiss property management document. " +
            "You MUST call extractAccountBalances with EVERY account-balance line in the document — " +
            "do not stop after the first page, process the entire document from start to finish. " +
            (hasInvoiceContent
              ? "Also call extractInvoiceLines with every individual invoice or charge you find. "
              : "") +
            "If a field is not clearly present in the text, omit it — do not guess.\n\n" +
            `Document OCR text:\n${content}`,
        },
      ],
    });

    let fields: Record<string, string | number | boolean | null> = {};
    let accountBalances: ExtractedAccountBalance[] = [];
    let invoiceLines: ExtractedInvoiceLine[] = [];

    for (const block of response.content) {
      if (block.type !== "tool_use") continue;

      if (block.name === "extractAccountBalances") {
        const input = block.input as {
          fiscalYear?: number;
          periodLabel?: string;
          buildingAddress?: string;
          balances?: Array<{
            rawAccountCode: string;
            rawAccountName: string;
            balanceChf: number;
            balanceType: "DEBIT" | "CREDIT";
          }>;
        };
        if (input.fiscalYear) fields.fiscalYear = input.fiscalYear;
        if (input.periodLabel) fields.periodLabel = input.periodLabel;
        if (input.buildingAddress) fields.buildingAddress = input.buildingAddress;
        accountBalances = (input.balances ?? [])
          .filter((b) => b.rawAccountCode && b.rawAccountName && typeof b.balanceChf === "number")
          .map((b) => ({
            rawAccountCode: b.rawAccountCode,
            rawAccountName: b.rawAccountName,
            balanceChf: b.balanceChf,
            balanceType: b.balanceType === "CREDIT" ? "CREDIT" : "DEBIT",
          }));
      }

      if (block.name === "extractInvoiceLines") {
        const input = block.input as {
          invoices?: Array<{
            vendorName?: string;
            invoiceNumber?: string;
            invoiceDate?: string;
            dueDate?: string;
            totalAmount?: number;
            vatAmount?: number;
            subtotal?: number;
            currency?: string;
            iban?: string;
            paymentReference?: string;
            description?: string;
            unitHint?: string;
            tenantHint?: string;
          }>;
        };
        invoiceLines = (input.invoices ?? []).map((inv) => ({
          vendorName:       inv.vendorName       ?? null,
          invoiceNumber:    inv.invoiceNumber     ?? null,
          invoiceDate:      inv.invoiceDate       ?? null,
          dueDate:          inv.dueDate           ?? null,
          totalAmount:      inv.totalAmount       ?? null,
          vatAmount:        inv.vatAmount         ?? null,
          subtotal:         inv.subtotal          ?? null,
          currency:         inv.currency          ?? null,
          iban:             inv.iban              ?? null,
          paymentReference: inv.paymentReference  ?? null,
          description:      inv.description       ?? null,
          unitHint:         inv.unitHint          ?? null,
          tenantHint:       inv.tenantHint        ?? null,
        }));
      }
    }

    console.log(
      `[DOC-SCAN] Financial statement extraction: ` +
      `${accountBalances.length} balance row(s), ${invoiceLines.length} invoice line(s)`,
    );

    return { fields, accountBalances, invoiceLines };
  } catch (err) {
    console.warn(
      "[DOC-SCAN] Financial statement Claude extraction skipped:",
      err instanceof Error ? err.message : err,
    );
    return empty;
  }
}

/* ══════════════════════════════════════════════════════════════
   Summary generators (match LocalOcrScanner output style)
   ══════════════════════════════════════════════════════════════ */

function generateSummary(
  docType: DetectedDocType,
  fields: Record<string, string | number | boolean | null>,
): string {
  const nonNull = Object.entries(fields)
    .filter(([k, v]) => v !== null && !k.startsWith("_"))
    .length;

  switch (docType) {
    case "IDENTITY": {
      const name = [fields.firstName, fields.lastName].filter(Boolean).join(" ");
      return name
        ? `Identity document for ${name}. Extracted ${nonNull} fields via Azure Document Intelligence.`
        : `Identity document detected. Extracted ${nonNull} fields via Azure Document Intelligence.`;
    }
    case "SALARY_PROOF": {
      const income = fields.netMonthlyIncome;
      return income
        ? `Salary proof — net income: ${income}. Extracted ${nonNull} fields via Azure Document Intelligence.`
        : `Salary proof detected. Extracted ${nonNull} fields via Azure Document Intelligence.`;
    }
    case "DEBT_ENFORCEMENT_EXTRACT": {
      const status = fields.hasDebtEnforcement ? "has debt enforcement records" : "clean";
      return `Debt enforcement extract — ${status}. Extracted ${nonNull} fields via Azure Document Intelligence.`;
    }
    case "PERMIT": {
      const type = fields.permitType ?? "unknown";
      return `Residence permit (type ${type}). Extracted ${nonNull} fields via Azure Document Intelligence.`;
    }
    case "HOUSEHOLD_INSURANCE":
      return `Household/RC insurance document. Extracted ${nonNull} fields via Azure Document Intelligence.`;
    case "INVOICE": {
      const vendor = fields.vendorName ?? "unknown vendor";
      const total = fields.totalAmount;
      return total
        ? `Invoice from ${vendor} — total: ${total}. Extracted ${nonNull} fields via Azure Document Intelligence.`
        : `Invoice from ${vendor}. Extracted ${nonNull} fields via Azure Document Intelligence.`;
    }
    case "FINANCIAL_STATEMENT": {
      const year = fields.fiscalYear ?? "unknown year";
      const balanceCount = (fields._balanceCount as number) ?? 0;
      return `Financial statement for fiscal year ${year}. ${balanceCount} account balance row(s) extracted via Azure + Claude.`;
    }
    case "UNKNOWN":
    default:
      return `Document type could not be determined. Extracted ${nonNull} fields via Azure Document Intelligence.`;
  }
}

/* ══════════════════════════════════════════════════════════════
   AzureDocumentIntelligenceScanner
   ══════════════════════════════════════════════════════════════ */

export class AzureDocumentIntelligenceScanner implements DocumentScanner {
  private client: DocumentIntelligenceClient;
  private modelId: string;

  constructor() {
    const endpoint = process.env.AZURE_DOCUMENT_INTELLIGENCE_ENDPOINT;
    const key = process.env.AZURE_DOCUMENT_INTELLIGENCE_KEY;

    if (!endpoint || !key) {
      throw new Error(
        "Azure Document Intelligence scanner requires AZURE_DOCUMENT_INTELLIGENCE_ENDPOINT " +
        "and AZURE_DOCUMENT_INTELLIGENCE_KEY environment variables.",
      );
    }

    this.modelId =
      process.env.AZURE_DOCUMENT_INTELLIGENCE_MODEL || "prebuilt-layout";

    // Dynamic import to avoid loading Azure SDK when provider is "local"
    // — but constructor is sync, so we eagerly import here.
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const createClient =
      require("@azure-rest/ai-document-intelligence").default as typeof import("@azure-rest/ai-document-intelligence").default;
    const { AzureKeyCredential } =
      require("@azure/core-auth") as typeof import("@azure/core-auth");

    this.client = createClient(endpoint, new AzureKeyCredential(key));

    console.log(
      `[DOC-SCAN] Azure Document Intelligence scanner initialized ` +
      `(endpoint=${endpoint}, model=${this.modelId})`,
    );
  }

  async scan(
    buffer: Buffer,
    fileName: string,
    mimeType: string,
    hintDocType?: string,
  ): Promise<ScanResult> {
    // 1. Detect doc type from filename / hint
    let docType = detectDocType(fileName, hintDocType);

    // 2. Resolve content type for Azure
    const contentType: AzureContentType =
      MIME_MAP[mimeType] || "application/octet-stream";

    // 2b. Select the best Azure model for this doc type.
    //     prebuilt-idDocument gives structured FirstName, LastName, DateOfBirth, etc.
    //     prebuilt-invoice gives structured VendorName, InvoiceTotal, etc.
    //     prebuilt-layout is the generic fallback for other doc types.
    const effectiveModel = docType === "IDENTITY" || docType === "PERMIT"
      ? "prebuilt-idDocument"
      : docType === "INVOICE"
        ? "prebuilt-invoice"
        : this.modelId;

    console.log(
      `[DOC-SCAN] Azure: analyzing file="${fileName}" ` +
      `mime=${mimeType} model=${effectiveModel} (base=${this.modelId}) initialDocType=${docType}`,
    );

    // 3. Submit document for analysis (long-running operation)
    const { getLongRunningPoller, isUnexpected } =
      require("@azure-rest/ai-document-intelligence") as typeof import("@azure-rest/ai-document-intelligence");

    const initialResponse = await this.client
      .path("/documentModels/{modelId}:analyze", effectiveModel)
      .post({
        contentType,
        body: buffer,
      });

    if (isUnexpected(initialResponse)) {
      const errBody = (initialResponse as any).body;
      const msg = errBody?.error?.message ?? JSON.stringify(errBody);
      throw new Error(`Azure Document Intelligence analysis failed: ${msg}`);
    }

    // 4. Poll until complete
    const poller = getLongRunningPoller(this.client, initialResponse);
    const result = await poller.pollUntilDone();

    const analyzeResult: AnalyzeResultOutput | undefined =
      (result as any).body?.analyzeResult;

    if (!analyzeResult) {
      throw new Error(
        "Azure Document Intelligence returned no analyzeResult in the response.",
      );
    }

    // 5. Extract full text content
    const fullContent = analyzeResult.content || "";

    // 6. Refine doc type from content if still UNKNOWN
    docType = refineDocTypeFromContent(docType, fullContent);

    console.log(
      `[DOC-SCAN] Azure: analysis complete. ` +
      `contentLen=${fullContent.length} docType=${docType} ` +
      `pages=${analyzeResult.pages?.length ?? 0} ` +
      `documents=${analyzeResult.documents?.length ?? 0} ` +
      `kvPairs=${analyzeResult.keyValuePairs?.length ?? 0}`,
    );

    // 7. Collect Azure structured fields from analyzed documents
    let azureFields: Record<string, DocumentFieldOutput> =
      analyzeResult.documents?.[0]?.fields ?? {};

    // 8. Collect key-value pairs for fallback matching
    let kvPairs: KvPair[] = (analyzeResult.keyValuePairs ?? [])
      .filter((kv) => kv.key?.content && kv.value?.content)
      .map((kv) => ({
        key: kv.key.content!,
        value: kv.value!.content!,
      }));

    // 7b. Two-pass re-analysis: if content detection changed the doc type to one
    //     that benefits from a specialized model (and we used a generic one), re-run.
    const specializedModel =
      docType === "IDENTITY" || docType === "PERMIT" ? "prebuilt-idDocument"
      : docType === "INVOICE" ? "prebuilt-invoice"
      : null;

    if (specializedModel && specializedModel !== effectiveModel) {
      console.log(
        `[DOC-SCAN] Azure: re-analyzing with specialized model=${specializedModel} ` +
        `(docType detected from content as ${docType})`,
      );
      try {
        const retryResponse = await this.client
          .path("/documentModels/{modelId}:analyze", specializedModel)
          .post({ contentType, body: buffer });

        if (!isUnexpected(retryResponse)) {
          const retryPoller = getLongRunningPoller(this.client, retryResponse);
          const retryResult = await retryPoller.pollUntilDone();
          const retryAnalyzeResult: AnalyzeResultOutput | undefined =
            (retryResult as any).body?.analyzeResult;

          if (retryAnalyzeResult) {
            azureFields = retryAnalyzeResult.documents?.[0]?.fields ?? {};
            kvPairs = (retryAnalyzeResult.keyValuePairs ?? [])
              .filter((kv) => kv.key?.content && kv.value?.content)
              .map((kv) => ({ key: kv.key.content!, value: kv.value!.content! }));
            console.log(
              `[DOC-SCAN] Azure: re-analysis complete. ` +
              `documents=${retryAnalyzeResult.documents?.length ?? 0} ` +
              `kvPairs=${kvPairs.length}`,
            );
          }
        }
      } catch (retryErr) {
        console.warn(
          `[DOC-SCAN] Azure: re-analysis failed, continuing with first-pass results:`,
          retryErr instanceof Error ? retryErr.message : retryErr,
        );
      }
    }

    // 9. Normalize fields per doc type
    let fields: Record<string, string | number | boolean | null>;
    let accountBalances: import("../documentScanner").ExtractedAccountBalance[] | undefined;
    let invoiceLines: import("../documentScanner").ExtractedInvoiceLine[] | undefined;

    switch (docType) {
      case "IDENTITY":
        fields = normalizeIdentityFields(azureFields, kvPairs, fullContent);
        break;
      case "SALARY_PROOF":
        fields = normalizeSalaryFields(azureFields, kvPairs);
        break;
      case "DEBT_ENFORCEMENT_EXTRACT":
        fields = normalizeDebtFields(azureFields, kvPairs, fullContent);
        break;
      case "PERMIT":
        fields = normalizePermitFields(azureFields, kvPairs, fullContent);
        break;
      case "HOUSEHOLD_INSURANCE":
        fields = normalizeInsuranceFields(azureFields, kvPairs);
        break;
      case "INVOICE":
        fields = normalizeInvoiceFields(azureFields, kvPairs, fullContent);
        break;
      case "FINANCIAL_STATEMENT": {
        // Financial statements use Claude for the heavy lifting — Azure layout
        // gives us the raw text; Claude structures the account balance rows.
        const fsResult = await extractFinancialStatementWithClaude(fullContent);
        fields = fsResult.fields;
        accountBalances = fsResult.accountBalances;
        // Only include invoiceLines if Claude found at least one
        if (fsResult.invoiceLines.length > 0) {
          invoiceLines = fsResult.invoiceLines;
        }
        // Store balance count in fields for summary generation
        fields._balanceCount = accountBalances.length;
        break;
      }
      case "UNKNOWN":
      default:
        fields = {};
        break;
    }

    // 9b. Claude enrichment — fill any remaining null fields from raw OCR text
    // Skipped for FINANCIAL_STATEMENT (handled entirely by extractFinancialStatementWithClaude)
    if (docType !== "UNKNOWN" && docType !== "FINANCIAL_STATEMENT" && fullContent) {
      const nullFields = Object.entries(fields).filter(([k, v]) => !k.startsWith("_") && v === null);
      if (nullFields.length > 0) {
        console.log(`[DOC-SCAN] Claude enrichment: ${nullFields.length} null field(s) — querying claude-haiku…`);
        const claudeFields = await enrichFieldsWithClaude(fullContent, docType);
        let filled = 0;
        for (const [k, v] of Object.entries(claudeFields)) {
          if (fields[k] === null || fields[k] === undefined) {
            fields[k] = v;
            filled++;
          }
        }
        if (filled > 0) {
          console.log(`[DOC-SCAN] Claude filled ${filled} field(s): ${Object.keys(claudeFields).join(", ")}`);
        }
      }
    }

    // 10. Add raw text preview (first 2000 chars, matching local scanner)
    if (fullContent.length > 0 && fullContent.length <= 2000) {
      fields._rawTextPreview = fullContent;
    } else if (fullContent.length > 2000) {
      fields._rawTextPreview = fullContent.substring(0, 2000) + "…";
    }

    // 11. Compute confidence
    const confidence =
      Object.keys(azureFields).length > 0
        ? averageConfidence(azureFields)
        : docType !== "UNKNOWN"
          ? 30
          : 10;

    // 12. Generate summary
    const summary = generateSummary(docType, fields);

    return {
      docType,
      confidence,
      fields,
      summary,
      ...(accountBalances !== undefined ? { accountBalances } : {}),
      ...(invoiceLines !== undefined ? { invoiceLines } : {}),
    };
  }
}
