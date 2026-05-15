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
      /g[eé]rance/i, /liegenschaft/i,
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
      "PERMIT", "HOUSEHOLD_INSURANCE", "INVOICE", "FINANCIAL_STATEMENT",
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

  // ── Check strong structural indicators first so documents that mention
  //    insurance *as a section* (e.g. Swiss "décompte de gérance" reports) are
  //    not misclassified as HOUSEHOLD_INSURANCE. ─────────────────────────────

  // Swiss property management financial statement keywords (FR/DE) — checked first
  // because these reports frequently reference insurance as a sub-section.
  if (
    /bilan|jahresrechnung|bilanz|soldes\s*des\s*comptes|cl[oô]ture\s*annuelle|jahresabschluss|gesamtabrechnung/i.test(text) ||
    /d[eé]compte.*g[eé]rance|abrechnun.*liegenschaft|liegenschaftsabrechnung/i.test(text) ||
    /compte\s*de\s*r[eé]sultat|compte\s*de\s*gestion|r[eé]capitulatif.*comptes/i.test(text) ||
    /d[eé]compte\s*annuel|relevé.*compte.*g[eé]rance/i.test(text)
  ) {
    return "FINANCIAL_STATEMENT";
  }

  if (/passport|carte\s*d'identit|ausweis|identity\s*card/i.test(text))
    return "IDENTITY";
  if (/salary|salaire|lohn|gehalt|fiche\s*de\s*paie|pay\s*slip/i.test(text))
    return "SALARY_PROOF";
  if (/poursuite|betreibung|debt\s*enforcement|schuldbetreibung/i.test(text))
    return "DEBT_ENFORCEMENT_EXTRACT";
  if (/permis|permit|aufenthalt|bewilligung|s[eé]jour/i.test(text))
    return "PERMIT";
  if (/invoice|facture|rechnung|\bbill\b|total\s*(amount|due|chf|eur)|montant\s*(total|d[ûu])|gesamtbetrag/i.test(text))
    return "INVOICE";
  if (/assurance|versicherung|insurance|responsabilit[eé]|haftpflicht/i.test(text))
    return "HOUSEHOLD_INSURANCE";

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
    "Each entry should represent one distinct invoice or charge found in the document. " +
    "Only include entries whose vendor name OR total amount you can read directly from the OCR text.",
  input_schema: {
    type: "object",
    required: ["invoices"],
    properties: {
      invoices: {
        type: "array",
        items: {
          type: "object",
          required: ["confidence"],
          properties: {
            confidence: {
              type: "number",
              description:
                "Your confidence (0.0–1.0) that this invoice line is genuinely present in the source text. " +
                "Use 0.9+ only when vendor name AND amount are both clearly readable. " +
                "Use 0.5–0.7 when one of the two is inferred. " +
                "Use below 0.5 only if you are uncertain — these will be discarded.",
            },
            vendorName:       { type: "string",  description: "Contractor or supplier name, exactly as printed" },
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

const EXTRACTION_SYSTEM_PROMPT =
  "You are a financial document extraction assistant for Swiss property management statements. " +
  "Extract ONLY information that is explicitly present in the OCR text provided. " +
  "Never infer, estimate, or generate values that are not clearly readable in the source. " +
  "If a field cannot be read directly from the text, omit it entirely.";

/**
 * Extract account balances from one chunk of OCR text.
 * Uses a dedicated forced tool call so balances are always extracted regardless
 * of whether invoice content is also present in the chunk.
 */
async function extractBalancesFromChunk(
  client: ReturnType<typeof getAnthropicClient>,
  content: string,
  chunkIndex: number,
  totalChunks: number,
): Promise<{
  fields: Record<string, string | number | boolean | null>;
  accountBalances: ExtractedAccountBalance[];
}> {
  const chunkLabel = totalChunks > 1 ? ` (chunk ${chunkIndex + 1} of ${totalChunks})` : "";

  const response = await client.messages.create({
    model: "claude-haiku-4-5-20251001",
    max_tokens: 8192,
    temperature: 0,
    system: EXTRACTION_SYSTEM_PROMPT,
    tools: [FINANCIAL_STATEMENT_BALANCE_TOOL] as unknown as Parameters<typeof client.messages.create>[0]["tools"],
    tool_choice: { type: "tool", name: "extractAccountBalances" },
    messages: [
      {
        role: "user",
        content:
          `Extract ALL account balance rows from this section of a Swiss property management document${chunkLabel}. ` +
          "Call extractAccountBalances with EVERY account-balance line you find — include every row, no matter how many there are. " +
          "If the same account name appears multiple times with the same balance, extract it only once. " +
          "Omit fields not clearly present in the text; do not guess.\n\n" +
          `OCR text:\n${content}`,
      },
    ],
  });

  const fields: Record<string, string | number | boolean | null> = {};
  let accountBalances: ExtractedAccountBalance[] = [];

  for (const block of response.content) {
    if (block.type !== "tool_use" || block.name !== "extractAccountBalances") continue;
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

  return { fields, accountBalances };
}

/**
 * Extract invoice lines from one chunk of OCR text.
 * Only called when invoice signals are present in the content.
 */
async function extractInvoicesFromChunk(
  client: ReturnType<typeof getAnthropicClient>,
  content: string,
  chunkIndex: number,
  totalChunks: number,
): Promise<ExtractedInvoiceLine[]> {
  const chunkLabel = totalChunks > 1 ? ` (chunk ${chunkIndex + 1} of ${totalChunks})` : "";

  const response = await client.messages.create({
    model: "claude-haiku-4-5-20251001",
    max_tokens: 4096,
    temperature: 0,
    system: EXTRACTION_SYSTEM_PROMPT,
    tools: [FINANCIAL_STATEMENT_INVOICE_TOOL] as unknown as Parameters<typeof client.messages.create>[0]["tools"],
    tool_choice: { type: "tool", name: "extractInvoiceLines" },
    messages: [
      {
        role: "user",
        content:
          `Extract every individual invoice or charge from this section of a Swiss property management document${chunkLabel}. ` +
          "Include only entries where the vendor name OR total amount is clearly readable in the text. " +
          "Set confidence to reflect how clearly each entry appears in the source. " +
          "Omit fields not clearly present; do not guess.\n\n" +
          `OCR text:\n${content}`,
      },
    ],
  });

  for (const block of response.content) {
    if (block.type !== "tool_use" || block.name !== "extractInvoiceLines") continue;
    const input = block.input as {
      invoices?: Array<{
        confidence?: number;
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
    return (input.invoices ?? [])
      .filter((inv) => {
        const conf = typeof inv.confidence === "number" ? inv.confidence : 1;
        if (conf < 0.6) return false;
        if (!inv.vendorName && inv.totalAmount == null) return false;
        return true;
      })
      .map((inv) => ({
        confidence:       inv.confidence       ?? null,
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
  return [];
}

/**
 * Extract account balances (and optionally invoice lines) from one chunk of
 * OCR text. Keeps two separate tool calls so balance extraction is always
 * guaranteed regardless of what other content the chunk contains.
 *
 * @deprecated Use extractBalancesFromChunk / extractInvoicesFromChunk directly.
 * Kept temporarily for the invoice-only pass in extractFinancialStatementWithClaude.
 */
async function extractChunkWithClaude(
  client: ReturnType<typeof getAnthropicClient>,
  content: string,
  chunkIndex: number,
  totalChunks: number,
): Promise<{
  fields: Record<string, string | number | boolean | null>;
  accountBalances: ExtractedAccountBalance[];
  invoiceLines: ExtractedInvoiceLine[];
}> {
  // Always extract balances first via dedicated forced call
  const { fields, accountBalances } = await extractBalancesFromChunk(client, content, chunkIndex, totalChunks);

  // Extract invoices in a second call only when invoice signals are present
  const hasInvoiceContent =
    /facture|rechnung|invoice|\btotal\s*(?:chf|eur)\b|montant\s*total/i.test(content);
  const invoiceLines = hasInvoiceContent
    ? await extractInvoicesFromChunk(client, content, chunkIndex, totalChunks)
    : [];

  return { fields, accountBalances, invoiceLines };
}

/**
 * Split OCR content into page-sized chunks using Azure page span data when
 * available, otherwise fall back to character-based splitting.
 */
function splitIntoPageChunks(
  fullContent: string,
  pages: Array<{ spans?: Array<{ offset: number; length: number }> }> | undefined,
  maxCharsPerChunk: number,
): string[] {
  // Try Azure page spans first — gives accurate page-boundary splitting
  if (pages && pages.length > 0) {
    const pageTexts: string[] = pages.map((page) => {
      if (!page.spans || page.spans.length === 0) return "";
      const start = page.spans[0].offset;
      const end = page.spans[page.spans.length - 1].offset + page.spans[page.spans.length - 1].length;
      return fullContent.substring(start, end);
    }).filter((t) => t.trim().length > 0);

    if (pageTexts.length > 0) {
      // Batch pages into chunks that stay within the char limit
      const chunks: string[] = [];
      let current = "";
      for (const pageText of pageTexts) {
        if (current.length + pageText.length > maxCharsPerChunk && current.length > 0) {
          chunks.push(current.trim());
          current = pageText;
        } else {
          current += (current ? "\n\n" : "") + pageText;
        }
      }
      if (current.trim()) chunks.push(current.trim());
      return chunks;
    }
  }

  // Fallback: split on form-feed characters (common PDF page break encoding)
  const ffPages = fullContent.split(/\f/).filter((p) => p.trim().length > 0);
  if (ffPages.length > 1) {
    const chunks: string[] = [];
    let current = "";
    for (const p of ffPages) {
      if (current.length + p.length > maxCharsPerChunk && current.length > 0) {
        chunks.push(current.trim());
        current = p;
      } else {
        current += (current ? "\n\n" : "") + p;
      }
    }
    if (current.trim()) chunks.push(current.trim());
    return chunks;
  }

  // Last resort: split at sentence/line boundaries near the size limit
  if (fullContent.length <= maxCharsPerChunk) return [fullContent];
  const chunks: string[] = [];
  let pos = 0;
  while (pos < fullContent.length) {
    let end = pos + maxCharsPerChunk;
    if (end < fullContent.length) {
      // Find a clean line break near the boundary
      const breakAt = fullContent.lastIndexOf("\n", end);
      if (breakAt > pos + maxCharsPerChunk * 0.5) end = breakAt;
    }
    chunks.push(fullContent.substring(pos, end).trim());
    pos = end;
  }
  return chunks.filter((c) => c.length > 0);
}

/* ══════════════════════════════════════════════════════════════
   Page classification — one cheap Claude call to label each page
   ══════════════════════════════════════════════════════════════ */

type PageClass = "COVER_LETTER" | "BALANCE_SHEET" | "INCOME_STATEMENT" | "INVOICE" | "OTHER";

/** A contiguous group of same-type pages forming one extractable section. */
export interface DocumentSection {
  sectionType: "BALANCE_SHEET" | "INCOME_STATEMENT" | "INVOICES";
  pageTexts: string[];
}

/**
 * Classify each page of a multi-page document with a single Claude Haiku call.
 *
 * Returns one label per page:
 *   BALANCE_SHEET    — Bilan / balance sheet with closing asset/liability positions
 *   INCOME_STATEMENT — Compte de résultat / P&L / Betriebsrechnung with revenue/expense rows
 *   INVOICE          — vendor invoice or receipt with invoice number, supplier, total
 *   COVER_LETTER     — introductory letter or transmittal page, skip
 *   OTHER            — TOC, tenant list, état locatif, property description, skip
 *
 * Returns null on any error so the caller can fall back to the unfiltered path.
 */
async function classifyPages(
  client: ReturnType<typeof getAnthropicClient>,
  pageTexts: string[],
): Promise<PageClass[] | null> {
  if (pageTexts.length === 0) return null;

  const snippets = pageTexts
    .map((t, i) => `--- Page ${i + 1} ---\n${t.substring(0, 500).trim()}`)
    .join("\n\n");

  try {
    const response = await client.messages.create({
      model: "claude-haiku-4-5-20251001",
      max_tokens: 1024,
      temperature: 0,
      tools: [
        {
          name: "classifyDocumentPages",
          description:
            "Classify each page of a Swiss property management document into one of five categories.",
          input_schema: {
            type: "object" as const,
            required: ["pages"],
            properties: {
              pages: {
                type: "array",
                description:
                  "One classification per page, in page order. Must have exactly as many entries as pages provided.",
                items: {
                  type: "object",
                  required: ["pageNumber", "class"],
                  properties: {
                    pageNumber: { type: "number" },
                    class: {
                      type: "string",
                      enum: ["COVER_LETTER", "BALANCE_SHEET", "INCOME_STATEMENT", "INVOICE", "OTHER"],
                      description:
                        "BALANCE_SHEET: Bilan or balance sheet — closing positions for assets (actifs), liabilities (passifs), equity. Account codes typically 1xxx–3xxx. " +
                        "INCOME_STATEMENT: Compte de résultat, Betriebsrechnung, compte de gestion, P&L — revenue and expense rows for a period. Account codes typically 4xxx–8xxx. " +
                        "INVOICE: a vendor invoice, receipt, or Facture with an invoice number, supplier name, and CHF total. " +
                        "COVER_LETTER: introductory or transmittal letter with no financial data. " +
                        "OTHER: table of contents, tenant list, état locatif, property description, annexes, or anything that does not fit above.",
                    },
                  },
                },
              },
            },
          },
        },
      ],
      tool_choice: { type: "tool", name: "classifyDocumentPages" },
      messages: [
        {
          role: "user",
          content:
            `Classify each page of this Swiss property management PDF (${pageTexts.length} pages total). ` +
            `Distinguish carefully between BALANCE_SHEET (closing positions) and INCOME_STATEMENT (period revenue/expenses). ` +
            `Return exactly one entry per page.\n\nPage snippets:\n${snippets}`,
        },
      ],
    });

    const toolUse = response.content.find((b) => b.type === "tool_use");
    if (!toolUse || toolUse.type !== "tool_use") return null;

    const input = toolUse.input as { pages: Array<{ pageNumber: number; class: string }> };
    if (!Array.isArray(input.pages) || input.pages.length === 0) return null;

    const result: PageClass[] = new Array(pageTexts.length).fill("OTHER");
    for (const entry of input.pages) {
      const idx = entry.pageNumber - 1;
      if (idx >= 0 && idx < pageTexts.length) {
        result[idx] = entry.class as PageClass;
      }
    }

    console.log(
      `[DOC-SCAN] Page classification: ` +
      result.map((c, i) => `p${i + 1}=${c}`).join(", "),
    );
    return result;
  } catch (err) {
    console.warn(
      "[DOC-SCAN] Page classification failed — treating all pages as balance sheet:",
      err instanceof Error ? err.message : err,
    );
    return null;
  }
}

/**
 * Group per-page classifications into logical sections.
 * Contiguous pages of the same extractable type are merged.
 * COVER_LETTER and OTHER pages are dropped.
 * All INVOICE pages (even non-contiguous) are collected into one INVOICES section.
 */
function groupIntoSections(pageTexts: string[], classes: PageClass[]): DocumentSection[] {
  const sections: DocumentSection[] = [];

  // Collect invoice pages separately — they may be scattered
  const invoicePages = pageTexts.filter((_, i) => classes[i] === "INVOICE");

  // Walk contiguous runs for BALANCE_SHEET and INCOME_STATEMENT
  let i = 0;
  while (i < classes.length) {
    const cls = classes[i];
    if (cls !== "BALANCE_SHEET" && cls !== "INCOME_STATEMENT") { i++; continue; }

    const sectionType = cls === "BALANCE_SHEET" ? "BALANCE_SHEET" : "INCOME_STATEMENT";
    const pages: string[] = [pageTexts[i]];
    i++;
    while (i < classes.length && classes[i] === cls) {
      pages.push(pageTexts[i]);
      i++;
    }
    sections.push({ sectionType, pageTexts: pages });
  }

  if (invoicePages.length > 0) {
    sections.push({ sectionType: "INVOICES", pageTexts: invoicePages });
  }

  return sections;
}

/**
 * Extract account balances (and optionally invoice lines) from a financial
 * statement PDF by processing it in page-sized chunks.
 * Non-blocking: returns empty arrays on missing API key or any runtime error.
 */
async function extractFinancialStatementWithClaude(
  content: string,
  pages?: Array<{ spans?: Array<{ offset: number; length: number }> }>,
  pageTexts?: string[],
): Promise<{
  fields: Record<string, string | number | boolean | null>;
  accountBalances: ExtractedAccountBalance[];
  invoiceLines: ExtractedInvoiceLine[];
}> {
  const empty = { fields: {}, accountBalances: [], invoiceLines: [] };
  if (!content) return empty;

  // ~10 k chars per chunk ≈ 2.5 k input tokens.
  // Each output balance row ≈ 60 tokens; at 10 k chars a chunk typically has
  // 20-40 rows → ~2400 output tokens — well within the 8192-token budget.
  // Keeping chunks small is critical: one giant 30 k chunk causes Claude to
  // hit max_tokens mid-list and truncate silently.
  const MAX_CHARS_PER_CHUNK = 10_000;

  try {
    const client = getAnthropicClient();

    // ── Page classification ────────────────────────────────────────────────
    // Classify pages to separate balance sheet, income statement, and invoice pages.
    // Falls back to treating everything as balance-sheet content on classification failure.
    let balanceSheetTexts: string[] = pageTexts ?? [];
    let incomeStatementTexts: string[] = [];
    let invoiceOnlyPageTexts: string[] = [];

    if (pageTexts && pageTexts.length > 1) {
      const classes = await classifyPages(client, pageTexts);
      if (classes) {
        balanceSheetTexts    = pageTexts.filter((_, i) => classes[i] === "BALANCE_SHEET");
        incomeStatementTexts = pageTexts.filter((_, i) => classes[i] === "INCOME_STATEMENT");
        invoiceOnlyPageTexts = pageTexts.filter((_, i) => classes[i] === "INVOICE");
        const skipped = classes.filter((c) => c === "COVER_LETTER" || c === "OTHER").length;
        console.log(
          `[DOC-SCAN] Page filter: ${balanceSheetTexts.length} balance-sheet, ` +
          `${incomeStatementTexts.length} income-statement, ` +
          `${invoiceOnlyPageTexts.length} invoice-only, ${skipped} skipped`,
        );
      }
    }

    // Combine balance sheet + income statement pages for account balance extraction.
    // If classification filtered everything out, fall back to full content.
    const financialPageTexts = [...balanceSheetTexts, ...incomeStatementTexts];
    const financialContent = financialPageTexts.length > 0
      ? financialPageTexts.join("\n\n")
      : content;

    const chunks = splitIntoPageChunks(financialContent, undefined, MAX_CHARS_PER_CHUNK);
    console.log(
      `[DOC-SCAN] Financial statement: contentLen=${financialContent.length} → ${chunks.length} chunk(s) for Claude`,
    );

    let mergedFields: Record<string, string | number | boolean | null> = {};
    const allBalances: ExtractedAccountBalance[] = [];
    const allInvoiceLines: ExtractedInvoiceLine[] = [];
    // Deduplicate account balances across chunks by (normalizedName, amount, direction).
    // Using name+amount+type rather than rawAccountCode because the OCR produces
    // inconsistent codes for the same account (e.g. "1020", "10200", "100" for Bank).
    const seenBalances = new Set<string>();
    // Track seen invoices to deduplicate across overlapping chunks.
    // Key: vendor|invoiceNumber|amount — all three must match to be considered duplicate.
    const seenInvoices = new Set<string>();

    for (let i = 0; i < chunks.length; i++) {
      let chunkResult: Awaited<ReturnType<typeof extractBalancesFromChunk>>;
      try {
        chunkResult = await extractBalancesFromChunk(client, chunks[i], i, chunks.length);
      } catch (chunkErr) {
        console.warn(
          `[DOC-SCAN] Chunk ${i + 1}/${chunks.length} failed — skipping chunk, keeping prior results. ` +
          `Error: ${chunkErr instanceof Error ? chunkErr.message : chunkErr}`,
        );
        continue;
      }

      // Merge metadata fields (first non-null value wins)
      for (const [k, v] of Object.entries(chunkResult.fields)) {
        if (v !== null && v !== undefined && mergedFields[k] == null) {
          mergedFields[k] = v;
        }
      }

      // Append balances, deduplicating by name+amount+direction across chunks
      for (const b of chunkResult.accountBalances) {
        const key = [
          b.rawAccountName.trim().toLowerCase().replace(/\s+/g, " "),
          String(b.balanceChf),
          b.balanceType,
        ].join("|");
        if (!seenBalances.has(key)) {
          seenBalances.add(key);
          allBalances.push(b);
        }
      }

      console.log(
        `[DOC-SCAN] Chunk ${i + 1}/${chunks.length}: ` +
        `${chunkResult.accountBalances.length} balance(s) → running total ${allBalances.length}`,
      );
    }

    // ── Dedicated pass for invoice-attachment pages ────────────────────────
    if (invoiceOnlyPageTexts.length > 0) {
      const invoiceChunks = splitIntoPageChunks(
        invoiceOnlyPageTexts.join("\n\n"), undefined, MAX_CHARS_PER_CHUNK,
      );
      console.log(
        `[DOC-SCAN] Invoice-only pass: ${invoiceOnlyPageTexts.length} page(s) → ${invoiceChunks.length} chunk(s)`,
      );
      for (let i = 0; i < invoiceChunks.length; i++) {
        try {
          const lines = await extractInvoicesFromChunk(client, invoiceChunks[i], i, invoiceChunks.length);
          for (const inv of lines) {
            const key = [
              (inv.vendorName ?? "").trim().toLowerCase(),
              (inv.invoiceNumber ?? "").trim().toLowerCase(),
              String(inv.totalAmount ?? ""),
            ].join("|");
            if (!seenInvoices.has(key)) { seenInvoices.add(key); allInvoiceLines.push(inv); }
          }
        } catch {
          console.warn(`[DOC-SCAN] Invoice chunk ${i + 1}/${invoiceChunks.length} failed — skipping`);
        }
      }
    }

    // Final dedup pass — catches within-chunk duplicates that the per-chunk
    // seenBalances Set cannot catch (same account extracted twice on the same page).
    const finalBalances: ExtractedAccountBalance[] = [];
    const finalBalanceKeys = new Set<string>();
    for (const b of allBalances) {
      const key = [
        b.rawAccountName.trim().toLowerCase().replace(/\s+/g, " "),
        String(b.balanceChf),
        b.balanceType,
      ].join("|");
      if (!finalBalanceKeys.has(key)) {
        finalBalanceKeys.add(key);
        finalBalances.push(b);
      }
    }
    if (finalBalances.length !== allBalances.length) {
      console.log(
        `[DOC-SCAN] Final dedup: ${allBalances.length - finalBalances.length} within-chunk duplicate balance(s) removed`,
      );
    }

    const finalInvoiceLines: ExtractedInvoiceLine[] = [];
    const finalInvoiceKeys = new Set<string>();
    for (const inv of allInvoiceLines) {
      const key = [
        (inv.vendorName ?? "").trim().toLowerCase(),
        (inv.invoiceNumber ?? "").trim().toLowerCase(),
        String(inv.totalAmount ?? ""),
      ].join("|");
      if (!finalInvoiceKeys.has(key)) {
        finalInvoiceKeys.add(key);
        finalInvoiceLines.push(inv);
      }
    }

    return { fields: mergedFields, accountBalances: finalBalances, invoiceLines: finalInvoiceLines };
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
   Azure result shape
   ══════════════════════════════════════════════════════════════ */

interface AzureAnalyzeResult {
  content: string;
  kvPairs: KvPair[];
  fields: Record<string, DocumentFieldOutput>;
  pageCount: number;
  /** Full text for each individual page, in order. Used for page classification. */
  pageTexts: string[];
}

/* ══════════════════════════════════════════════════════════════
   PDF page splitter — one single-page PDF buffer per page.
   Bypasses Azure F0 tier's 2-page-per-request limit.
   ══════════════════════════════════════════════════════════════ */

async function splitPdfIntoPages(pdfBuffer: Buffer): Promise<Buffer[]> {
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  const { PDFDocument } = require("pdf-lib") as typeof import("pdf-lib");
  const srcDoc = await PDFDocument.load(pdfBuffer);
  const count = srcDoc.getPageCount();
  const pages: Buffer[] = [];
  for (let i = 0; i < count; i++) {
    const singlePage = await PDFDocument.create();
    const [copied] = await singlePage.copyPages(srcDoc, [i]);
    singlePage.addPage(copied);
    pages.push(Buffer.from(await singlePage.save()));
  }
  return pages;
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

  /** Submit one buffer to Azure and poll to completion. */
  private async analyzeWithAzure(
    buf: Buffer,
    contentType: AzureContentType,
    modelId: string,
  ): Promise<AzureAnalyzeResult> {
    const { getLongRunningPoller, isUnexpected } =
      require("@azure-rest/ai-document-intelligence") as typeof import("@azure-rest/ai-document-intelligence");

    const initialResponse = await this.client
      .path("/documentModels/{modelId}:analyze", modelId)
      .post({ contentType, body: buf });

    if (isUnexpected(initialResponse)) {
      const errBody = (initialResponse as any).body;
      throw new Error(
        `Azure Document Intelligence analysis failed: ${errBody?.error?.message ?? JSON.stringify(errBody)}`,
      );
    }

    const poller = getLongRunningPoller(this.client, initialResponse);
    const result = await poller.pollUntilDone();
    const analyzeResult: AnalyzeResultOutput | undefined =
      (result as any).body?.analyzeResult;

    if (!analyzeResult) {
      throw new Error("Azure Document Intelligence returned no analyzeResult in the response.");
    }

    const content = analyzeResult.content ?? "";
    // Extract per-page text from Azure's span offsets
    const pageTexts: string[] = (analyzeResult.pages ?? []).map((page: any) => {
      const spans: Array<{ offset: number; length: number }> = page.spans ?? [];
      if (spans.length === 0) return "";
      const start = spans[0].offset;
      const end = spans[spans.length - 1].offset + spans[spans.length - 1].length;
      return content.substring(start, end);
    });
    return {
      content,
      kvPairs: (analyzeResult.keyValuePairs ?? [])
        .filter((kv: any) => kv.key?.content && kv.value?.content)
        .map((kv: any) => ({ key: kv.key.content as string, value: kv.value!.content as string })),
      fields: analyzeResult.documents?.[0]?.fields ?? {},
      pageCount: analyzeResult.pages?.length ?? 0,
      pageTexts,
    };
  }

  /**
   * Split a PDF into single-page buffers and analyze each with Azure,
   * 5 pages at a time. Merges all text and KV pairs.
   * Works on both F0 (2-page limit) and S0 tiers.
   */
  private async analyzePdfPageByPage(
    pdfBuffer: Buffer,
    contentType: AzureContentType,
    modelId: string,
  ): Promise<AzureAnalyzeResult> {
    const CONCURRENCY = 5;
    const pageBuffers = await splitPdfIntoPages(pdfBuffer);
    console.log(`[DOC-SCAN] PDF split into ${pageBuffers.length} page(s) for per-page Azure analysis`);

    const pageContents: string[] = new Array(pageBuffers.length).fill("");
    const allKvPairs: KvPair[] = [];
    let firstFields: Record<string, DocumentFieldOutput> = {};

    for (let batch = 0; batch < pageBuffers.length; batch += CONCURRENCY) {
      const slice = pageBuffers.slice(batch, batch + CONCURRENCY);
      const results = await Promise.all(
        slice.map((pageBuf, idx) =>
          this.analyzeWithAzure(pageBuf, contentType, modelId).catch((err) => {
            console.warn(
              `[DOC-SCAN] Page ${batch + idx + 1}/${pageBuffers.length} failed: ` +
              (err instanceof Error ? err.message : String(err)),
            );
            return { content: "", kvPairs: [], fields: {}, pageCount: 0, pageTexts: [] } as AzureAnalyzeResult;
          }),
        ),
      );
      for (let i = 0; i < results.length; i++) {
        pageContents[batch + i] = results[i].content;
        allKvPairs.push(...results[i].kvPairs);
        if (!Object.keys(firstFields).length && Object.keys(results[i].fields).length) {
          firstFields = results[i].fields;
        }
      }
      console.log(
        `[DOC-SCAN] Pages ${batch + 1}–${Math.min(batch + CONCURRENCY, pageBuffers.length)}/${pageBuffers.length} analyzed`,
      );
    }

    const fullContent = pageContents.join("\n\n");
    console.log(`[DOC-SCAN] Per-page merge complete: ${pageBuffers.length} pages, contentLen=${fullContent.length}`);
    return { content: fullContent, kvPairs: allKvPairs, fields: firstFields, pageCount: pageBuffers.length, pageTexts: pageContents };
  }

  async scan(
    buffer: Buffer,
    fileName: string,
    mimeType: string,
    hintDocType?: string,
  ): Promise<ScanResult> {
    // 1. Detect doc type from filename / hint
    let docType = detectDocType(fileName, hintDocType);

    // 2. Resolve content type and best Azure model for the initial doc type
    const contentType: AzureContentType =
      MIME_MAP[mimeType] || "application/octet-stream";

    const effectiveModel =
      docType === "IDENTITY" || docType === "PERMIT" ? "prebuilt-idDocument"
      : docType === "INVOICE"                        ? "prebuilt-invoice"
      :                                                this.modelId;

    console.log(
      `[DOC-SCAN] Azure: analyzing file="${fileName}" ` +
      `mime=${mimeType} model=${effectiveModel} (base=${this.modelId}) initialDocType=${docType}`,
    );

    // 3. Submit to Azure. PDFs are split page-by-page to bypass the F0 tier's
    //    2-page-per-request limit. On S0 this is also safe (just more calls).
    let azureResult: AzureAnalyzeResult;
    if (mimeType === "application/pdf") {
      azureResult = await this.analyzePdfPageByPage(buffer, contentType, effectiveModel);
    } else {
      azureResult = await this.analyzeWithAzure(buffer, contentType, effectiveModel);
    }

    let { content: fullContent, kvPairs, fields: azureFields } = azureResult;

    // 4. Refine doc type from content if still UNKNOWN
    docType = refineDocTypeFromContent(docType, fullContent);

    console.log(
      `[DOC-SCAN] Azure: analysis complete. ` +
      `contentLen=${fullContent.length} docType=${docType} ` +
      `pages=${azureResult.pageCount} kvPairs=${kvPairs.length}`,
    );

    // 5. Two-pass re-analysis: if content detection upgraded the doc type to one
    //    that benefits from a specialized model, re-run on non-PDF files only.
    //    PDFs were already processed page-by-page above; re-analyzing all 17 pages
    //    again would be wasteful and unnecessary.
    if (mimeType !== "application/pdf") {
      const specializedModel =
        docType === "IDENTITY" || docType === "PERMIT" ? "prebuilt-idDocument"
        : docType === "INVOICE"                        ? "prebuilt-invoice"
        : null;

      if (specializedModel && specializedModel !== effectiveModel) {
        console.log(
          `[DOC-SCAN] Azure: re-analyzing with specialized model=${specializedModel} ` +
          `(docType detected from content as ${docType})`,
        );
        try {
          const retryResult = await this.analyzeWithAzure(buffer, contentType, specializedModel);
          azureFields = retryResult.fields;
          kvPairs = retryResult.kvPairs;
          console.log(
            `[DOC-SCAN] Azure: re-analysis complete. kvPairs=${kvPairs.length}`,
          );
        } catch (retryErr) {
          console.warn(
            `[DOC-SCAN] Azure: re-analysis failed, continuing with first-pass results:`,
            retryErr instanceof Error ? retryErr.message : retryErr,
          );
        }
      }
    }

    // 6. Normalize fields per doc type
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
        // Azure gives us the raw text; Claude structures the account rows.
        // Pass pageTexts so the classifier can skip cover letters and route
        // invoice attachments to a separate extraction pass.
        const fsResult = await extractFinancialStatementWithClaude(
          fullContent, undefined, azureResult.pageTexts,
        );
        fields = fsResult.fields;
        accountBalances = fsResult.accountBalances;
        if (fsResult.invoiceLines.length > 0) {
          invoiceLines = fsResult.invoiceLines;
        }
        fields._balanceCount = accountBalances.length;
        break;
      }
      case "UNKNOWN":
      default:
        fields = {};
        break;
    }

    // 7. Claude enrichment — fill remaining null fields from raw OCR text
    //    (skipped for FINANCIAL_STATEMENT — handled by extractFinancialStatementWithClaude)
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

    // 8. Raw text preview + extraction metadata for the review UI
    //    Show first 4000 chars so managers can verify page coverage.
    const PREVIEW_CHARS = 4000;
    if (fullContent.length > 0 && fullContent.length <= PREVIEW_CHARS) {
      fields._rawTextPreview = fullContent;
    } else if (fullContent.length > PREVIEW_CHARS) {
      fields._rawTextPreview = fullContent.substring(0, PREVIEW_CHARS) + "…";
    }
    fields._pagesAnalyzed = azureResult.pageCount;
    fields._contentLength = fullContent.length;

    // 9. Compute confidence
    const confidence =
      Object.keys(azureFields).length > 0
        ? averageConfidence(azureFields)
        : docType !== "UNKNOWN" ? 30 : 10;

    // 10. Generate summary
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
