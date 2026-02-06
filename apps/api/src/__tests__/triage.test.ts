import { matchTriage } from "../services/triage";

const appliances = [
  {
    id: "appliance-1",
    name: "Kitchen Oven",
    assetModel: { category: "oven" },
  },
];

describe("triage matcher", () => {
  it("returns oven overheating suggestions", () => {
    const result = matchTriage("oven is overheating", appliances);
    expect(result.detectedCategory).toBe("oven");
    expect(result.suggestions.length).toBeGreaterThan(0);
  });

  it("returns safety guidance for gas smell", () => {
    const result = matchTriage("I smell gas in the kitchen", appliances);
    expect(result.suggestions.length).toBeGreaterThan(0);
    expect(result.suggestions[0].title.toLowerCase()).toContain("safety");
  });
});
