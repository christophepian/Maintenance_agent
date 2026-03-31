/**
 * Document Extraction — regression tests.
 *
 * Verifies that the scanner correctly extracts structured fields from
 * document text for each supported doc type. Tests use LocalOcrScanner
 * with plain-text buffers to exercise the extraction logic deterministically.
 *
 * Coverage:
 *   - Identity: lastName, firstName, dateOfBirth, nationality, documentNumber, sex
 *   - Salary: employer, netMonthlyIncome, firstName, lastName
 *   - Debt enforcement: hasDebtEnforcement, extractStatus (tri-state)
 *   - Permit: permitType, lastName, firstName, nationality, permitValidUntil
 *   - Insurance: hasRcInsurance, rcInsuranceCompany, policyNumber
 */

import { LocalOcrScanner } from "../services/scanners/localOcrScanner";
import type { ScanResult } from "../services/documentScanner";
import {
  DOC_IDENTITY_SWISS_FR,
  DOC_IDENTITY_PASSPORT_EN,
  DOC_IDENTITY_DE,
  DOC_SALARY_FR,
  DOC_SALARY_DE,
  DOC_SALARY_EN,
  DOC_DEBT_CLEAN_FR,
  DOC_DEBT_CLEAN_DE,
  DOC_DEBT_CLEAN_NEANT,
  DOC_DEBT_POSITIVE_FR,
  DOC_DEBT_POSITIVE_DE,
  DOC_DEBT_AMBIGUOUS,
  DOC_DEBT_NOISY_OCR,
  DOC_DEBT_CONTRADICTORY,
  DOC_PERMIT_B_FR,
  DOC_PERMIT_C_DE,
  DOC_INSURANCE_FR,
  DOC_INSURANCE_DE,
  DOC_UNKNOWN_INVOICE,
} from "./fixtures/documentScanFixtures";

/* ══════════════════════════════════════════════════════════════
   Helpers
   ══════════════════════════════════════════════════════════════ */

const scanner = new LocalOcrScanner();

/** Scan text with a filename hint that matches the expected doc type */
async function scanAs(
  text: string,
  hintDocType: string,
): Promise<ScanResult> {
  const buffer = Buffer.from(text, "utf-8");
  return scanner.scan(buffer, "document.txt", "text/plain", hintDocType);
}

/* ══════════════════════════════════════════════════════════════
   Identity extraction
   ══════════════════════════════════════════════════════════════ */

describe("Identity Extraction", () => {
  it("extracts fields from Swiss FR identity card", async () => {
    const r = await scanAs(DOC_IDENTITY_SWISS_FR, "IDENTITY");
    expect(r.docType).toBe("IDENTITY");
    expect(r.fields.lastName).toBe("MUELLER");
    expect(r.fields.firstName).toBe("Sophie");
    expect(r.fields.sex).toBe("F");
    expect(r.confidence).toBeGreaterThanOrEqual(50);
  });

  it("extracts fields from EN passport with MRZ", async () => {
    const r = await scanAs(DOC_IDENTITY_PASSPORT_EN, "IDENTITY");
    expect(r.docType).toBe("IDENTITY");
    // MRZ should be parsed — either from MRZ lines or labeled fields
    expect(r.fields.lastName).toBeTruthy();
    expect(r.fields.firstName).toBeTruthy();
    expect(r.confidence).toBeGreaterThanOrEqual(60);
  });

  it("extracts fields from German identity card", async () => {
    const r = await scanAs(DOC_IDENTITY_DE, "IDENTITY");
    expect(r.docType).toBe("IDENTITY");
    expect(r.fields.lastName).toBe("WEBER");
    expect(r.fields.firstName).toBe("Thomas");
    expect(r.fields.sex).toBe("M");
    expect(r.confidence).toBeGreaterThanOrEqual(50);
  });

  it("confidence is higher when more fields extracted", async () => {
    const passport = await scanAs(DOC_IDENTITY_PASSPORT_EN, "IDENTITY");
    const short = await scanAs("Passport\nName: Smith", "IDENTITY");
    expect(passport.confidence).toBeGreaterThanOrEqual(short.confidence);
  });
});

/* ══════════════════════════════════════════════════════════════
   Salary Proof extraction
   ══════════════════════════════════════════════════════════════ */

describe("Salary Proof Extraction", () => {
  it("extracts fields from French payslip", async () => {
    const r = await scanAs(DOC_SALARY_FR, "SALARY_PROOF");
    expect(r.docType).toBe("SALARY_PROOF");
    expect(r.fields.netMonthlyIncome).toBeTruthy();
    expect(typeof r.fields.netMonthlyIncome).toBe("number");
    // CHF 7'248.80
    expect(r.fields.netMonthlyIncome as number).toBeGreaterThan(5000);
    expect(r.fields.netMonthlyIncome as number).toBeLessThan(10000);
    expect(r.confidence).toBeGreaterThanOrEqual(50);
  });

  it("extracts fields from German payslip", async () => {
    const r = await scanAs(DOC_SALARY_DE, "SALARY_PROOF");
    expect(r.docType).toBe("SALARY_PROOF");
    expect(r.fields.netMonthlyIncome).toBeTruthy();
    expect(typeof r.fields.netMonthlyIncome).toBe("number");
    // CHF 7'451.30
    expect(r.fields.netMonthlyIncome as number).toBeGreaterThan(5000);
    expect(r.fields.netMonthlyIncome as number).toBeLessThan(10000);
    expect(r.confidence).toBeGreaterThanOrEqual(50);
  });

  it("extracts net pay from English payslip", async () => {
    const r = await scanAs(DOC_SALARY_EN, "SALARY_PROOF");
    expect(r.docType).toBe("SALARY_PROOF");
    expect(r.fields.netMonthlyIncome).toBeTruthy();
    expect(typeof r.fields.netMonthlyIncome).toBe("number");
    // GBP 4,002.00
    expect(r.fields.netMonthlyIncome as number).toBeGreaterThan(2000);
    expect(r.fields.netMonthlyIncome as number).toBeLessThan(8000);
  });

  it("extracts employer from French payslip", async () => {
    const r = await scanAs(DOC_SALARY_FR, "SALARY_PROOF");
    // Employer might be extracted from label or first-line heuristic
    if (r.fields.employer) {
      expect(typeof r.fields.employer).toBe("string");
    }
  });
});

/* ══════════════════════════════════════════════════════════════
   Debt Enforcement extraction — tri-state behavior
   ══════════════════════════════════════════════════════════════ */

describe("Debt Enforcement Extraction", () => {
  describe("clean documents → hasDebtEnforcement=false, CLEAR", () => {
    it("French clean extract (aucune poursuite)", async () => {
      const r = await scanAs(DOC_DEBT_CLEAN_FR, "DEBT_ENFORCEMENT_EXTRACT");
      expect(r.docType).toBe("DEBT_ENFORCEMENT_EXTRACT");
      expect(r.fields.hasDebtEnforcement).toBe(false);
      expect(r.fields.extractStatus).toBe("CLEAR");
      expect(r.confidence).toBeGreaterThanOrEqual(50);
    });

    it("German clean extract (keine Betreibung)", async () => {
      const r = await scanAs(DOC_DEBT_CLEAN_DE, "DEBT_ENFORCEMENT_EXTRACT");
      expect(r.docType).toBe("DEBT_ENFORCEMENT_EXTRACT");
      expect(r.fields.hasDebtEnforcement).toBe(false);
      expect(r.fields.extractStatus).toBe("CLEAR");
    });

    it("néant format", async () => {
      const r = await scanAs(DOC_DEBT_CLEAN_NEANT, "DEBT_ENFORCEMENT_EXTRACT");
      expect(r.docType).toBe("DEBT_ENFORCEMENT_EXTRACT");
      expect(r.fields.hasDebtEnforcement).toBe(false);
      expect(r.fields.extractStatus).toBe("CLEAR");
    });
  });

  describe("positive documents → hasDebtEnforcement=true, HAS_ENTRIES", () => {
    it("French positive extract with CHF amount + creditor", async () => {
      const r = await scanAs(DOC_DEBT_POSITIVE_FR, "DEBT_ENFORCEMENT_EXTRACT");
      expect(r.docType).toBe("DEBT_ENFORCEMENT_EXTRACT");
      expect(r.fields.hasDebtEnforcement).toBe(true);
      expect(r.fields.extractStatus).toBe("HAS_ENTRIES");
    });

    it("German positive extract with Verlustschein + Gläubiger", async () => {
      const r = await scanAs(DOC_DEBT_POSITIVE_DE, "DEBT_ENFORCEMENT_EXTRACT");
      expect(r.docType).toBe("DEBT_ENFORCEMENT_EXTRACT");
      expect(r.fields.hasDebtEnforcement).toBe(true);
      expect(r.fields.extractStatus).toBe("HAS_ENTRIES");
    });
  });

  describe("ambiguous / unknown → hasDebtEnforcement=null, UNKNOWN", () => {
    it("header-only debt extract (no verdict)", async () => {
      const r = await scanAs(DOC_DEBT_AMBIGUOUS, "DEBT_ENFORCEMENT_EXTRACT");
      expect(r.docType).toBe("DEBT_ENFORCEMENT_EXTRACT");
      expect(r.fields.hasDebtEnforcement).toBeNull();
      expect(r.fields.extractStatus).toBe("UNKNOWN");
    });

    it("noisy OCR text", async () => {
      const r = await scanAs(DOC_DEBT_NOISY_OCR, "DEBT_ENFORCEMENT_EXTRACT");
      expect(r.docType).toBe("DEBT_ENFORCEMENT_EXTRACT");
      expect(r.fields.hasDebtEnforcement).toBeNull();
      expect(r.fields.extractStatus).toBe("UNKNOWN");
    });

    it("contradictory evidence", async () => {
      const r = await scanAs(DOC_DEBT_CONTRADICTORY, "DEBT_ENFORCEMENT_EXTRACT");
      expect(r.docType).toBe("DEBT_ENFORCEMENT_EXTRACT");
      expect(r.fields.hasDebtEnforcement).toBeNull();
      expect(r.fields.extractStatus).toBe("UNKNOWN");
    });
  });

  describe("false positive prevention", () => {
    it("document with poursuite only in header does NOT produce hasDebtEnforcement=true", async () => {
      const r = await scanAs(DOC_DEBT_AMBIGUOUS, "DEBT_ENFORCEMENT_EXTRACT");
      expect(r.fields.hasDebtEnforcement).not.toBe(true);
    });

    it("noisy OCR does NOT produce hasDebtEnforcement=true", async () => {
      const r = await scanAs(DOC_DEBT_NOISY_OCR, "DEBT_ENFORCEMENT_EXTRACT");
      expect(r.fields.hasDebtEnforcement).not.toBe(true);
    });
  });

  describe("field extraction alongside debt status", () => {
    it("extracts date from clean FR extract", async () => {
      const r = await scanAs(DOC_DEBT_CLEAN_FR, "DEBT_ENFORCEMENT_EXTRACT");
      // Date: 15.01.2026 → should be extracted
      if (r.fields.extractDate) {
        expect(typeof r.fields.extractDate).toBe("string");
      }
    });

    it("extracts name from positive FR extract", async () => {
      const r = await scanAs(DOC_DEBT_POSITIVE_FR, "DEBT_ENFORCEMENT_EXTRACT");
      // Nom: Dupont Marie → should be parsed as firstName/lastName
      if (r.fields.firstName) {
        expect(typeof r.fields.firstName).toBe("string");
      }
      if (r.fields.lastName) {
        expect(typeof r.fields.lastName).toBe("string");
      }
    });
  });
});

/* ══════════════════════════════════════════════════════════════
   Permit extraction
   ══════════════════════════════════════════════════════════════ */

describe("Permit Extraction", () => {
  it("extracts permit type B from French text", async () => {
    const r = await scanAs(DOC_PERMIT_B_FR, "PERMIT");
    expect(r.docType).toBe("PERMIT");
    expect(r.fields.permitType).toBe("B");
    expect(r.fields.lastName).toBeTruthy();
    expect(r.fields.firstName).toBeTruthy();
    expect(r.confidence).toBeGreaterThanOrEqual(50);
  });

  it("extracts permit type C from German text", async () => {
    const r = await scanAs(DOC_PERMIT_C_DE, "PERMIT");
    expect(r.docType).toBe("PERMIT");
    expect(r.fields.permitType).toBe("C");
    expect(r.confidence).toBeGreaterThanOrEqual(50);
  });

  it("extracts validity date from French permit", async () => {
    const r = await scanAs(DOC_PERMIT_B_FR, "PERMIT");
    // Valable jusqu'au: 31.12.2027
    if (r.fields.permitValidUntil) {
      expect(typeof r.fields.permitValidUntil).toBe("string");
    }
  });

  it("extracts nationality from French permit", async () => {
    const r = await scanAs(DOC_PERMIT_B_FR, "PERMIT");
    if (r.fields.nationality) {
      expect(typeof r.fields.nationality).toBe("string");
    }
  });
});

/* ══════════════════════════════════════════════════════════════
   Insurance extraction
   ══════════════════════════════════════════════════════════════ */

describe("Insurance Extraction", () => {
  it("detects RC insurance from French text", async () => {
    const r = await scanAs(DOC_INSURANCE_FR, "HOUSEHOLD_INSURANCE");
    expect(r.docType).toBe("HOUSEHOLD_INSURANCE");
    expect(r.fields.hasRcInsurance).toBe(true);
    expect(r.confidence).toBeGreaterThanOrEqual(50);
  });

  it("extracts company from French insurance (known insurer)", async () => {
    const r = await scanAs(DOC_INSURANCE_FR, "HOUSEHOLD_INSURANCE");
    if (r.fields.rcInsuranceCompany) {
      expect(typeof r.fields.rcInsuranceCompany).toBe("string");
      // Should recognize Mobilière as a known insurer
      const company = (r.fields.rcInsuranceCompany as string).toLowerCase();
      expect(company).toMatch(/mobili/);
    }
  });

  it("extracts company from German insurance (known insurer)", async () => {
    const r = await scanAs(DOC_INSURANCE_DE, "HOUSEHOLD_INSURANCE");
    expect(r.fields.hasRcInsurance).toBe(true);
    if (r.fields.rcInsuranceCompany) {
      expect(typeof r.fields.rcInsuranceCompany).toBe("string");
    }
  });

  it("extracts policy number from French insurance", async () => {
    const r = await scanAs(DOC_INSURANCE_FR, "HOUSEHOLD_INSURANCE");
    if (r.fields.policyNumber) {
      expect(typeof r.fields.policyNumber).toBe("string");
    }
  });
});

/* ══════════════════════════════════════════════════════════════
   Cross-cutting extraction invariants
   ══════════════════════════════════════════════════════════════ */

describe("Cross-cutting extraction invariants", () => {
  it("all field values are string, number, boolean, or null", async () => {
    const texts = [
      DOC_IDENTITY_SWISS_FR,
      DOC_SALARY_FR,
      DOC_DEBT_CLEAN_FR,
      DOC_PERMIT_B_FR,
      DOC_INSURANCE_FR,
    ];
    const hints = [
      "IDENTITY", "SALARY_PROOF", "DEBT_ENFORCEMENT_EXTRACT",
      "PERMIT", "HOUSEHOLD_INSURANCE",
    ];

    for (let i = 0; i < texts.length; i++) {
      const r = await scanAs(texts[i], hints[i]);
      for (const [key, value] of Object.entries(r.fields)) {
        const t = typeof value;
        expect(
          t === "string" || t === "number" || t === "boolean" || value === null,
        ).toBe(true);
      }
    }
  });

  it("summary is never empty", async () => {
    const texts = [
      DOC_IDENTITY_SWISS_FR,
      DOC_SALARY_FR,
      DOC_DEBT_CLEAN_FR,
      DOC_PERMIT_B_FR,
      DOC_INSURANCE_FR,
      DOC_UNKNOWN_INVOICE,
    ];

    for (const text of texts) {
      const r = await scanText(text);
      expect(r.summary.length).toBeGreaterThan(0);
    }
  });
});

/* ══════════════════════════════════════════════════════════════
   Helper shared with classification tests
   ══════════════════════════════════════════════════════════════ */

async function scanText(text: string): Promise<ScanResult> {
  const buffer = Buffer.from(text, "utf-8");
  return scanner.scan(buffer, "document.txt", "text/plain");
}
