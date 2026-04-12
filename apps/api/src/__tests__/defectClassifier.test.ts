/**
 * Tests: Defect Classifier (B-1)
 *
 * Unit tests for keyword extraction, severity detection, affected area parsing,
 * and duration parsing from free-text tenant complaints.
 */

import { extractDefectSignals, DefectSignals } from "../services/defectClassifier";

describe("defectClassifier — extractDefectSignals", () => {
  // ==========================================
  // French complaints
  // ==========================================

  describe("French complaints", () => {
    it("detects mould in bedroom with duration", () => {
      const signals = extractDefectSignals(
        "Il y a de la moisissure noire sur le mur de la chambre depuis 3 mois"
      );
      expect(signals.keywords.some((k) => k.term === "moisissure")).toBe(true);
      expect(signals.inferredCategories[0]).toBe("Humidité");
      expect(signals.affectedArea.rooms).toContain("chambre");
      expect(signals.duration.months).toBe(3);
      expect(signals.duration.ongoing).toBe(true); // "depuis" → ongoing
    });

    it("detects heating failure as critical", () => {
      const signals = extractDefectSignals(
        "Nous sommes sans chauffage depuis 2 semaines, il fait très froid"
      );
      expect(signals.keywords.some((k) => k.term === "chauffage")).toBe(true);
      expect(signals.inferredCategories).toContain("Température");
      expect(signals.severity).toBe("critical"); // "sans chauffage"
      expect(signals.duration.seasonal).toBe(true);
    });

    it("detects broken dishwasher", () => {
      const signals = extractDefectSignals("Le lave-vaisselle est en panne");
      expect(signals.keywords.some((k) => k.term === "lave-vaisselle")).toBe(true);
      expect(signals.keywords.some((k) => k.term === "panne")).toBe(true);
      expect(signals.inferredCategories).toContain("Défauts");
    });

    it("detects water infiltration", () => {
      const signals = extractDefectSignals(
        "Infiltration d'eau par le plafond de la cuisine"
      );
      expect(signals.keywords.some((k) => k.term === "infiltration")).toBe(true);
      expect(signals.inferredCategories[0]).toBe("Dégâts d'eau");
      expect(signals.affectedArea.rooms).toContain("cuisine");
    });

    it("detects renovation noise as immission", () => {
      const signals = extractDefectSignals(
        "Travaux de chantier sous les fenêtres, bruit insupportable depuis 6 mois"
      );
      expect(signals.inferredCategories).toContain("Rénovations");
      expect(signals.inferredCategories).toContain("Immissions");
      expect(signals.duration.months).toBe(6);
    });

    it("detects severe mould with percentage", () => {
      const signals = extractDefectSignals(
        "Moisissure grave, 80% de la pièce est touchée"
      );
      expect(signals.severity).toBe("critical"); // 80% → critical
      expect(signals.affectedArea.percentAffected).toBe(80);
    });

    it("detects elevator outage", () => {
      const signals = extractDefectSignals("L'ascenseur est en panne depuis 1 mois");
      expect(signals.keywords.some((k) => k.term === "ascenseur")).toBe(true);
      expect(signals.inferredCategories).toContain("Défauts");
      expect(signals.duration.months).toBe(1);
    });
  });

  // ==========================================
  // German complaints
  // ==========================================

  describe("German complaints", () => {
    it("detects Schimmel (mould)", () => {
      const signals = extractDefectSignals(
        "Es gibt Schimmel im Schlafzimmer seit 4 Monaten"
      );
      expect(signals.keywords.some((k) => k.term === "schimmel")).toBe(true);
      expect(signals.inferredCategories[0]).toBe("Humidité");
      expect(signals.affectedArea.rooms).toContain("chambre");
      expect(signals.duration.months).toBe(4);
    });

    it("detects Heizung defect", () => {
      const signals = extractDefectSignals("Die Heizung funktioniert nicht");
      expect(signals.keywords.some((k) => k.term === "heizung")).toBe(true);
      expect(signals.inferredCategories).toContain("Température");
      expect(signals.duration.seasonal).toBe(true);
    });

    it("detects Wasserschaden", () => {
      const signals = extractDefectSignals(
        "Wasserschaden in der Küche, die nasse Decke"
      );
      expect(signals.inferredCategories[0]).toBe("Dégâts d'eau");
      expect(signals.affectedArea.rooms).toContain("cuisine");
    });

    it("detects Lärm (noise)", () => {
      const signals = extractDefectSignals(
        "Lärm von der Baustelle seit 3 Monaten"
      );
      expect(signals.inferredCategories).toContain("Immissions");
      expect(signals.inferredCategories).toContain("Rénovations");
      expect(signals.duration.months).toBe(3);
    });
  });

  // ==========================================
  // English complaints
  // ==========================================

  describe("English complaints", () => {
    it("detects mold in bathroom", () => {
      const signals = extractDefectSignals(
        "There is mold in the bathroom, it has been here for 2 months"
      );
      expect(signals.keywords.some((k) => k.term === "mold")).toBe(true);
      expect(signals.inferredCategories[0]).toBe("Humidité");
      expect(signals.affectedArea.rooms).toContain("salle de bain");
      expect(signals.duration.months).toBe(2);
    });

    it("detects water leak", () => {
      const signals = extractDefectSignals(
        "Water leak from the ceiling in the kitchen"
      );
      expect(signals.keywords.some((k) => k.term === "leak")).toBe(true);
      expect(signals.inferredCategories[0]).toBe("Dégâts d'eau");
      expect(signals.affectedArea.rooms).toContain("cuisine");
    });

    it("detects broken elevator", () => {
      const signals = extractDefectSignals("The elevator has been broken for 3 weeks");
      expect(signals.keywords.some((k) => k.term === "elevator")).toBe(true);
      expect(signals.keywords.some((k) => k.term === "broken")).toBe(true);
      expect(signals.inferredCategories).toContain("Défauts");
      expect(signals.duration.months).toBe(1); // 3 weeks ≈ 1 month
    });

    it("detects noise immission", () => {
      const signals = extractDefectSignals(
        "Constant noise and smoke from the neighbor"
      );
      expect(signals.inferredCategories[0]).toBe("Immissions");
    });

    it("detects heating problem in living room", () => {
      const signals = extractDefectSignals(
        "No heating in the living room since November"
      );
      expect(signals.keywords.some((k) => k.term === "heating")).toBe(true);
      expect(signals.inferredCategories).toContain("Température");
      expect(signals.affectedArea.rooms).toContain("séjour");
      expect(signals.duration.seasonal).toBe(true);
    });
  });

  // ==========================================
  // Severity detection
  // ==========================================

  describe("severity detection", () => {
    it("returns critical for 'inhabitable'", () => {
      const s = extractDefectSignals("L'appartement est inhabitable à cause de l'humidité");
      expect(s.severity).toBe("critical");
    });

    it("returns critical for 'sans eau'", () => {
      const s = extractDefectSignals("Nous sommes sans eau depuis 3 jours");
      expect(s.severity).toBe("critical");
    });

    it("returns severe for 'pourrissement'", () => {
      const s = extractDefectSignals("Pourrissement du parquet dans la chambre");
      expect(s.severity).toBe("severe");
    });

    it("returns moderate for 'traces'", () => {
      const s = extractDefectSignals("Traces de moisissure sur le mur");
      expect(s.severity).toBe("moderate");
    });

    it("returns mild for 'léger'", () => {
      const s = extractDefectSignals("Léger problème de peinture");
      expect(s.severity).toBe("mild");
    });

    it("returns moderate (default) for unqualified defect with keywords", () => {
      const s = extractDefectSignals("Il y a une fuite");
      expect(s.severity).toBe("moderate");
    });
  });

  // ==========================================
  // Edge cases
  // ==========================================

  describe("edge cases", () => {
    it("returns empty signals for empty string", () => {
      const s = extractDefectSignals("");
      expect(s.keywords).toEqual([]);
      expect(s.inferredCategories).toEqual([]);
      expect(s.severity).toBe("mild");
    });

    it("returns empty signals for null input", () => {
      const s = extractDefectSignals(null as any);
      expect(s.keywords).toEqual([]);
    });

    it("returns empty signals for non-defect text", () => {
      const s = extractDefectSignals("I would like to schedule a visit next Tuesday");
      expect(s.keywords).toEqual([]);
      expect(s.inferredCategories).toEqual([]);
    });

    it("uses category parameter as additional signal", () => {
      const s = extractDefectSignals("Something is wrong", "PLUMBING");
      // "plumbing" doesn't match any keyword, but description alone produces nothing
      expect(s.keywords).toEqual([]);
    });

    it("uses category matching for appliances", () => {
      const s = extractDefectSignals("Not working properly", "dishwasher");
      expect(s.keywords.some((k) => k.term === "dishwasher")).toBe(true);
      expect(s.inferredCategories).toContain("Défauts");
    });

    it("detects multiple rooms", () => {
      const s = extractDefectSignals(
        "Moisissure dans la chambre, la cuisine et la salle de bain"
      );
      expect(s.affectedArea.rooms).toContain("chambre");
      expect(s.affectedArea.rooms).toContain("cuisine");
      expect(s.affectedArea.rooms).toContain("salle de bain");
    });

    it("detects room count from pièces", () => {
      const s = extractDefectSignals("Appartement 4.5 pièces affecté par l'humidité");
      expect(s.affectedArea.roomCount).toBe(4.5);
    });

    it("handles mixed language input", () => {
      const s = extractDefectSignals(
        "There is Schimmel in the bedroom, il y a aussi une fuite"
      );
      expect(s.inferredCategories).toContain("Humidité");
      expect(s.inferredCategories).toContain("Dégâts d'eau");
    });
  });

  // ==========================================
  // Duration parsing
  // ==========================================

  describe("duration parsing", () => {
    it("parses 'depuis 3 mois'", () => {
      const s = extractDefectSignals("Problème depuis 3 mois");
      expect(s.duration.months).toBe(3);
      expect(s.duration.ongoing).toBe(true);
    });

    it("parses 'for 2 years'", () => {
      const s = extractDefectSignals("This has been a problem for 2 years");
      expect(s.duration.months).toBe(24);
    });

    it("parses 'seit 6 Monaten'", () => {
      const s = extractDefectSignals("Schimmel seit 6 Monaten");
      expect(s.duration.months).toBe(6);
      expect(s.duration.ongoing).toBe(true);
    });

    it("detects ongoing without explicit duration", () => {
      const s = extractDefectSignals("Le problème persiste toujours");
      expect(s.duration.ongoing).toBe(true);
      expect(s.duration.months).toBeUndefined();
    });

    it("detects seasonal for heating keywords", () => {
      const s = extractDefectSignals("Problème de chauffage");
      expect(s.duration.seasonal).toBe(true);
    });

    it("does not mark non-heating defects as seasonal", () => {
      const s = extractDefectSignals("Lave-vaisselle en panne");
      expect(s.duration.seasonal).toBe(false);
    });
  });
});
