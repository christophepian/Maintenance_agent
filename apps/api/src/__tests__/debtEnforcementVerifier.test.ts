/**
 * Debt Enforcement Verifier — unit tests.
 *
 * Tests the shared verifyDebtEnforcement() function with deterministic
 * text inputs covering:
 *   - explicit negative documents (FR, DE, EN)
 *   - explicit positive documents
 *   - ambiguous / generic-header-only documents
 *   - contradictory documents
 *   - OCR-corrupted / garbled text
 *   - empty / very short text
 *   - multilingual negative variants
 */

import {
  verifyDebtEnforcement,
  DebtEnforcementStatus,
} from "../services/scanners/debtEnforcementVerifier";

/* ══════════════════════════════════════════════════════════════
   Helpers
   ══════════════════════════════════════════════════════════════ */

function expectClear(text: string, label?: string) {
  const result = verifyDebtEnforcement(text);
  expect(result.hasDebtEnforcement).toBe(false);
  expect(result.extractStatus).toBe("CLEAR" as DebtEnforcementStatus);
  expect(result.confidenceDelta).toBeGreaterThan(0);
  return result;
}

function expectHasEntries(text: string, label?: string) {
  const result = verifyDebtEnforcement(text);
  expect(result.hasDebtEnforcement).toBe(true);
  expect(result.extractStatus).toBe("HAS_ENTRIES" as DebtEnforcementStatus);
  expect(result.confidenceDelta).toBeGreaterThan(0);
  return result;
}

function expectUnknown(text: string, label?: string) {
  const result = verifyDebtEnforcement(text);
  expect(result.hasDebtEnforcement).toBeNull();
  expect(result.extractStatus).toBe("UNKNOWN" as DebtEnforcementStatus);
  expect(result.confidenceDelta).toBeLessThan(0);
  return result;
}

/* ══════════════════════════════════════════════════════════════
   Test suite
   ══════════════════════════════════════════════════════════════ */

describe("verifyDebtEnforcement", () => {
  // ─── Explicit negative (CLEAR) ─────────────────────────────

  describe("explicit negative → CLEAR", () => {
    it("FR: aucune poursuite", () => {
      expectClear(
        "Office des poursuites de Lausanne\n" +
        "Extrait du registre des poursuites\n" +
        "Nom: Dupont Jean\n" +
        "Résultat: aucune poursuite\n" +
        "Date: 15.01.2026"
      );
    });

    it("FR: néant", () => {
      expectClear(
        "Office des poursuites du district de Genève\n" +
        "Extrait des poursuites\n" +
        "Concerne: Martin Pierre\n" +
        "Poursuites en cours: néant\n" +
        "Date de l'extrait: 20.02.2026"
      );
    });

    it("FR: pas de poursuite", () => {
      expectClear(
        "Office des poursuites de Berne\n" +
        "Il n'y a pas de poursuite enregistrée\n" +
        "Nom: Müller Hans"
      );
    });

    it("FR: aucune inscription", () => {
      expectClear(
        "Registre des poursuites\n" +
        "Aucune inscription\n" +
        "Date: 01.03.2026"
      );
    });

    it("DE: keine Betreibung", () => {
      expectClear(
        "Betreibungsamt Zürich\n" +
        "Betreibungsauskunft\n" +
        "Name: Schmidt Anna\n" +
        "Ergebnis: Keine Betreibung\n" +
        "Datum: 10.03.2026"
      );
    });

    it("DE: keine Einträge", () => {
      expectClear(
        "Betreibungsamt Bern\n" +
        "Betreibungsregisterauszug\n" +
        "Keine Einträge vorhanden\n" +
        "Name: Weber Thomas"
      );
    });

    it("DE: nichts zu verzeichnen", () => {
      expectClear(
        "Betreibungsamt Winterthur\n" +
        "Auskunft:\n" +
        "Es ist nichts zu verzeichnen\n" +
        "Name: Huber Maria"
      );
    });

    it("EN: no enforcement cases", () => {
      expectClear(
        "Debt Enforcement Office\n" +
        "Extract of Enforcement Register\n" +
        "Name: Smith John\n" +
        "Open enforcement cases: none\n" +
        "No enforcement cases found"
      );
    });

    it("EN: no entries", () => {
      expectClear(
        "Debt Enforcement Extract\n" +
        "Result: no entries\n" +
        "Name: Brown Alice"
      );
    });

    it("EN: no proceedings", () => {
      expectClear(
        "Office of Enforcement\n" +
        "No proceedings registered\n" +
        "Date: 2026-01-15"
      );
    });

    it("EN: no outstanding", () => {
      expectClear(
        "Debt enforcement register extract\n" +
        "No outstanding records\n" +
        "Name: Taylor James"
      );
    });

    it("EN: status: clean", () => {
      expectClear(
        "Enforcement office extract\n" +
        "Status: clean\n" +
        "Name: Wilson Kate"
      );
    });

    it("EN: result: none", () => {
      expectClear(
        "Debt enforcement extract\n" +
        "Result: none\n" +
        "Name: Davis Mark"
      );
    });

    it("structured format entries: none", () => {
      expectClear(
        "Debt Enforcement Register\n" +
        "Entries: none\n" +
        "Date: 01.03.2026"
      );
    });
  });

  // ─── Explicit positive (HAS_ENTRIES) ──────────────────────

  describe("explicit positive → HAS_ENTRIES", () => {
    it("CHF amount with creditor", () => {
      expectHasEntries(
        "Office des poursuites de Lausanne\n" +
        "Extrait du registre des poursuites\n" +
        "Nom: Dupont Jean\n" +
        "Créancier: UBS SA\n" +
        "Montant: CHF 5'432.50\n" +
        "Date: 15.01.2026"
      );
    });

    it("Fr. amount", () => {
      expectHasEntries(
        "Betreibungsauskunft\n" +
        "Schuldner: Müller Hans\n" +
        "Betrag: Fr. 12'000.00"
      );
    });

    it("case number (FR)", () => {
      expectHasEntries(
        "Office des poursuites\n" +
        "N° de poursuite: 45678\n" +
        "Débiteur: Martin Pierre"
      );
    });

    it("case number (DE)", () => {
      expectHasEntries(
        "Betreibungsamt Zürich\n" +
        "Betreibungsnummer: 12345\n" +
        "Schuldner: Weber Anna"
      );
    });

    it("Gläubiger explicitly named", () => {
      expectHasEntries(
        "Betreibungsamt Bern\n" +
        "Gläubiger: Swisscom AG\n" +
        "Betrag: CHF 350.00"
      );
    });

    it("poursuite en cours", () => {
      expectHasEntries(
        "Office des poursuites\n" +
        "Poursuite en cours depuis le 01.02.2026\n" +
        "Nom: Dupont Marie"
      );
    });

    it("laufende Betreibung", () => {
      expectHasEntries(
        "Betreibungsamt\n" +
        "Laufende Betreibung vorhanden\n" +
        "Name: Schmidt Thomas"
      );
    });

    it("acte de défaut de bien", () => {
      expectHasEntries(
        "Office des poursuites\n" +
        "Acte de défaut de bien délivré le 15.01.2026\n" +
        "Montant: CHF 8'500.00"
      );
    });

    it("Verlustschein", () => {
      expectHasEntries(
        "Betreibungsamt\n" +
        "Verlustschein ausgestellt am 10.02.2026\n" +
        "Betrag: CHF 3'200.00"
      );
    });

    it("Pfändung with date", () => {
      expectHasEntries(
        "Betreibungsamt\n" +
        "Pfändung vom 15 März 2026\n" +
        "Name: Weber Thomas"
      );
    });

    it("saisie with date", () => {
      expectHasEntries(
        "Office des poursuites\n" +
        "Saisie du 20 janvier 2026\n" +
        "Nom: Martin Jean"
      );
    });

    it("active enforcement (EN)", () => {
      expectHasEntries(
        "Debt Enforcement Office\n" +
        "Active enforcement proceedings\n" +
        "Name: Smith John"
      );
    });

    it("pending enforcement (EN)", () => {
      expectHasEntries(
        "Enforcement Extract\n" +
        "Pending enforcement actions\n" +
        "Name: Brown Alice"
      );
    });

    it("numbered enforcement entries", () => {
      expectHasEntries(
        "Office des poursuites\n" +
        "3 poursuites enregistrées\n" +
        "Nom: Dupont Jean"
      );
    });
  });

  // ─── Ambiguous / generic header only (UNKNOWN) ────────────

  describe("ambiguous / generic header → UNKNOWN", () => {
    it("only header text — Office des poursuites without verdict", () => {
      expectUnknown(
        "Office des poursuites de Lausanne\n" +
        "Extrait du registre des poursuites\n" +
        "Nom: Dupont Jean\n" +
        "Date: 15.01.2026"
      );
    });

    it("only Betreibungsamt header without verdict", () => {
      expectUnknown(
        "Betreibungsamt Zürich\n" +
        "Betreibungsauskunft\n" +
        "Name: Schmidt Anna\n" +
        "Datum: 10.03.2026"
      );
    });

    it("generic enforcement office text without clear signal", () => {
      expectUnknown(
        "Debt Enforcement Office\n" +
        "Register Extract\n" +
        "Name: Smith John\n" +
        "Date: 2026-01-15"
      );
    });

    it("text with just document title and person info", () => {
      expectUnknown(
        "Extrait des poursuites\n" +
        "Concerne: Martin Pierre\n" +
        "Adresse: Rue du Lac 12, 1003 Lausanne"
      );
    });
  });

  // ─── Contradictory evidence (UNKNOWN) ─────────────────────

  describe("contradictory evidence → UNKNOWN", () => {
    it("both 'aucune poursuite' and CHF amount", () => {
      expectUnknown(
        "Office des poursuites\n" +
        "Résultat: aucune poursuite\n" +
        "Montant: CHF 5'000.00\n" +
        "Créancier: UBS SA"
      );
    });

    it("both 'keine Betreibung' and Verlustschein", () => {
      expectUnknown(
        "Betreibungsamt Zürich\n" +
        "Keine Betreibung\n" +
        "Verlustschein vom 10.02.2026"
      );
    });

    it("both 'no entries' and active enforcement", () => {
      expectUnknown(
        "Enforcement Office\n" +
        "No entries found\n" +
        "Active enforcement proceedings since 2026-01-01"
      );
    });

    it("both néant and creditor named", () => {
      expectUnknown(
        "Office des poursuites\n" +
        "Poursuites: néant\n" +
        "Créancier: Helvetia SA"
      );
    });
  });

  // ─── OCR-corrupted / garbled text (UNKNOWN) ───────────────

  describe("OCR-corrupted / garbled text → UNKNOWN", () => {
    it("garbled characters", () => {
      expectUnknown(
        "0ffl<e d3s p0ursu!t3s\n" +
        "Extr@!t du r3g!str3\n" +
        "N0m: D.up0nt J3@n\n" +
        "R3sult@t: @u<un3 ins<ription"
      );
    });

    it("mostly noise", () => {
      expectUnknown(
        "|||///###$$$%%%^^^&&&***((()))===+++\n" +
        "??!!@@##$$%%^^&&**((  \n" +
        "!!!...///---___===+++***"
      );
    });

    it("very short text", () => {
      expectUnknown("hello");
    });

    it("empty string", () => {
      expectUnknown("");
    });
  });

  // ─── Edge cases ───────────────────────────────────────────

  describe("edge cases", () => {
    it("case insensitivity for AUCUNE POURSUITE (uppercase)", () => {
      expectClear(
        "OFFICE DES POURSUITES\n" +
        "AUCUNE POURSUITE\n" +
        "NOM: DUPONT JEAN"
      );
    });

    it("case insensitivity for KEINE BETREIBUNG (mixed case)", () => {
      expectClear(
        "Betreibungsamt Zürich\n" +
        "KEINE BETREIBUNG\n" +
        "Name: Schmidt Anna"
      );
    });

    it("whitespace variations in patterns", () => {
      expectClear(
        "Office des poursuites\n" +
        "aucune   poursuite enregistrée\n" +
        "Nom: Martin Pierre"
      );
    });

    it("colon-value format '0 poursuites'", () => {
      expectClear(
        "Extrait des poursuites\n" +
        ": 0 poursuites\n" +
        "Nom: Dupont Jean"
      );
    });

    it("structured key: néant", () => {
      expectClear(
        "Poursuites: néant\n" +
        "Nom: Martin Pierre"
      );
    });

    it("no records found (EN)", () => {
      expectClear(
        "Debt Enforcement Extract\n" +
        "No records found\n" +
        "Name: Smith John"
      );
    });

    it("SFr amount is treated as positive", () => {
      expectHasEntries(
        "Betreibungsamt\n" +
        "Betrag: SFr. 1'500.00\n" +
        "Schuldner: Weber Thomas"
      );
    });

    it("false positive prevention: document with 'poursuite' in title only", () => {
      // This is the key bug that was fixed.
      // A document titled "Extrait des poursuites" with no clear positive
      // evidence should NOT be classified as HAS_ENTRIES.
      expectUnknown(
        "Extrait des poursuites\n" +
        "Registre des poursuites de Genève\n" +
        "Nom: Dupont Jean\n" +
        "Date: 15.01.2026\n" +
        "Adresse: Rue du Lac 12, 1003 Lausanne"
      );
    });

    it("false positive prevention: document with 'Betreibung' in header only", () => {
      expectUnknown(
        "Betreibungsamt des Kantons Zürich\n" +
        "Betreibungsregisterauszug\n" +
        "Name: Huber Maria\n" +
        "Datum: 10.03.2026"
      );
    });
  });
});
