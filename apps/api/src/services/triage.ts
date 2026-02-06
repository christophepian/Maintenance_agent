import type { PrismaClient } from "@prisma/client";
import type { TriageInput } from "../validation/triage";

export type TriageSuggestion = {
  title: string;
  steps: string[];
};

export type TriageResult = {
  detectedCategory?: string;
  candidateApplianceIds?: string[];
  suggestions: TriageSuggestion[];
  needsClarification?: boolean;
  clarifyingQuestion?: string;
};

type ApplianceLike = {
  id: string;
  name: string;
  assetModel?: { category?: string | null } | null;
};

const applianceKeywords: Record<string, string[]> = {
  oven: ["oven"],
  stove: ["stove", "hob", "range", "cooker", "cooktop"],
  dishwasher: ["dishwasher"],
  bathroom: ["bathroom", "toilet", "sink", "shower", "bath"],
  lighting: ["light", "lamp", "bulb", "fixture", "lighting"],
};

const symptomKeywords: Record<string, string[]> = {
  overheating: ["overheating", "too hot", "overheats", "burning"],
  not_heating: ["not heating", "no heat", "cold", "won't heat"],
  leaking: ["leak", "leaking", "water leak", "drip"],
  no_power: ["no power", "won't turn on", "won't start", "dead"],
  tripping_breaker: ["tripping", "breaker", "fuse"],
  smell_burning: ["burning smell", "smoke", "sparks"],
  flooding: ["flood", "flooding", "water everywhere"],
  gas_smell: ["gas smell", "gas leak", "smell gas", "smell of gas"],
};

const suggestionCatalog: Record<string, Record<string, TriageSuggestion>> = {
  oven: {
    overheating: {
      title: "Oven overheating — quick checks",
      steps: [
        "Turn off the oven and let it cool completely.",
        "Confirm the temperature setting and mode (bake vs grill).",
        "If the temperature still spikes, avoid further use and request service.",
      ],
    },
    not_heating: {
      title: "Oven not heating — quick checks",
      steps: [
        "Make sure the oven is set to a heating mode (not just light/fan).",
        "Check if the circuit breaker has tripped and reset if safe.",
        "If it still won’t heat, request a repair.",
      ],
    },
  },
  dishwasher: {
    leaking: {
      title: "Dishwasher leaking — quick checks",
      steps: [
        "Pause the dishwasher and check the door seal for debris.",
        "Ensure the unit is level and not overloaded.",
        "If leaking continues, request service.",
      ],
    },
    no_power: {
      title: "Dishwasher won’t start — quick checks",
      steps: [
        "Confirm the door is fully latched.",
        "Check the breaker and reset if safe.",
        "If it still won’t start, request service.",
      ],
    },
  },
  lighting: {
    no_power: {
      title: "Lighting not working — quick checks",
      steps: [
        "Try replacing the bulb if safe to do so.",
        "Check the wall switch and nearby breakers.",
        "If multiple lights are out, request service.",
      ],
    },
  },
  bathroom: {
    leaking: {
      title: "Bathroom leak — quick checks",
      steps: [
        "Turn off the tap/valve if you can locate it.",
        "Dry the area and observe where the leak starts.",
        "If leaking continues, request service.",
      ],
    },
  },
  stove: {
    not_heating: {
      title: "Stove not heating — quick checks",
      steps: [
        "Confirm the correct burner is selected.",
        "Check if the breaker has tripped and reset if safe.",
        "If it still won’t heat, request service.",
      ],
    },
  },
};

function findCategory(message: string): string | undefined {
  const lower = message.toLowerCase();
  for (const [category, keywords] of Object.entries(applianceKeywords)) {
    if (keywords.some((k) => lower.includes(k))) return category;
  }
  return undefined;
}

function findSymptom(message: string): string | undefined {
  const lower = message.toLowerCase();
  for (const [symptom, keywords] of Object.entries(symptomKeywords)) {
    if (keywords.some((k) => lower.includes(k))) return symptom;
  }
  return undefined;
}

function isEmergency(symptom?: string) {
  return symptom === "gas_smell" || symptom === "smell_burning" || symptom === "flooding";
}

export function matchTriage(message: string, appliances: ApplianceLike[]): TriageResult {
  const detectedCategory = findCategory(message);
  const detectedSymptom = findSymptom(message);

  if (isEmergency(detectedSymptom)) {
    return {
      detectedCategory,
      suggestions: [
        {
          title: "Safety first",
          steps: [
            "If you smell gas, see smoke, or notice flooding, stop using the appliance immediately.",
            "If you feel unsafe, leave the area and contact emergency services.",
            "We can dispatch a contractor as soon as possible.",
          ],
        },
      ],
    };
  }

  let candidateApplianceIds: string[] | undefined;
  if (detectedCategory) {
    const keywords = applianceKeywords[detectedCategory] || [];
    const matches = appliances.filter((appliance) => {
      const nameMatch = keywords.some((k) => appliance.name.toLowerCase().includes(k));
      const modelMatch = appliance.assetModel?.category
        ? keywords.some((k) => appliance.assetModel?.category?.toLowerCase().includes(k))
        : false;
      return nameMatch || modelMatch;
    });
    candidateApplianceIds = matches.map((a) => a.id);
  }

  const suggestions: TriageSuggestion[] = [];
  if (detectedCategory && detectedSymptom) {
    const suggestion = suggestionCatalog[detectedCategory]?.[detectedSymptom];
    if (suggestion) suggestions.push(suggestion);
  }

  if (!suggestions.length && detectedCategory) {
    suggestions.push({
      title: "Quick checks",
      steps: [
        "Confirm the appliance is powered and safely connected.",
        "Check nearby breakers or switches if applicable.",
        "If the issue persists, request a repair.",
      ],
    });
  }

  if (!detectedCategory) {
    const availableCategories = Array.from(
      new Set(
        appliances
          .map((a) => a.assetModel?.category || a.name)
          .filter(Boolean)
          .map((v) => String(v).toLowerCase())
      )
    );

    return {
      suggestions,
      needsClarification: true,
      clarifyingQuestion:
        availableCategories.length > 0
          ? `Is this about ${availableCategories.join(", ")}?`
          : "Is this about your oven, stove, dishwasher, bathroom, or lighting?",
    };
  }

  return {
    detectedCategory,
    candidateApplianceIds,
    suggestions,
  };
}

export async function triageIssue(prisma: PrismaClient, input: TriageInput): Promise<TriageResult> {
  const appliances = await prisma.appliance.findMany({
    where: { unitId: input.unitId },
    select: {
      id: true,
      name: true,
      assetModel: {
        select: {
          category: true,
        },
      },
    },
  });

  return matchTriage(input.message, appliances);
}
