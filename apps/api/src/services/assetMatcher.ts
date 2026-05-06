/**
 * assetMatcher — AI-powered asset resolution for maintenance requests.
 *
 * Given a request description + the list of assets in a unit, asks Claude to
 * identify the most likely affected asset using a single tool call.
 *
 * Falls back to null (no match) if:
 *  - ANTHROPIC_API_KEY is not set
 *  - The AI returns "none" or is uncertain
 *  - The call fails for any reason (non-blocking)
 */

import { getAnthropicClient } from "./aiClient";

export interface AssetCandidate {
  id: string;
  name: string | null;
  topic: string | null;
  type: string | null;
  category: string | null;
}

const SELECT_ASSET_TOOL = {
  name: "selectAsset",
  description:
    "Identify which asset in the unit is most likely affected by the maintenance issue described. Return 'none' if no asset clearly matches.",
  input_schema: {
    type: "object" as const,
    properties: {
      assetId: {
        type: "string",
        description:
          "The id of the best-matching asset, or the string 'none' if no asset clearly matches.",
      },
      confidence: {
        type: "string",
        enum: ["high", "medium", "low"],
        description: "How confident you are in the match.",
      },
      reasoning: {
        type: "string",
        description: "One sentence explaining the match or why none was selected.",
      },
    },
    required: ["assetId", "confidence", "reasoning"],
  },
};

/**
 * Ask Claude to pick the best matching asset for a maintenance request.
 *
 * @returns The matched assetId, or null if no confident match found.
 */
export async function resolveAssetWithAI(
  description: string,
  category: string | null,
  assets: AssetCandidate[]
): Promise<string | null> {
  if (!assets.length) return null;

  // Don't use AI for trivial single-asset units — just return that asset
  // only if its topic/name is highly specific (handled by caller keyword scorer).
  if (!process.env.ANTHROPIC_API_KEY) return null;

  const assetList = assets
    .map(
      (a) =>
        `- id: ${a.id} | name: "${a.name ?? ""}" | topic: ${a.topic ?? "n/a"} | type: ${a.type ?? "n/a"} | category: ${a.category ?? "n/a"}`
    )
    .join("\n");

  const userMessage = `A tenant submitted this maintenance request:

Description: "${description}"
Category: "${category ?? "general"}"

The unit contains these assets:
${assetList}

Which asset (if any) is most likely the one affected by this issue? 
Be conservative — only select an asset if you are reasonably confident it matches the description. 
Return 'none' if the description does not clearly correspond to any listed asset.`;

  try {
    const client = getAnthropicClient();
    const response = await client.messages.create({
      model: "claude-3-5-haiku-20241022", // fast + cheap for this task
      max_tokens: 256,
      tools: [SELECT_ASSET_TOOL],
      tool_choice: { type: "any" },
      messages: [{ role: "user", content: userMessage }],
    });

    const toolUse = response.content.find((b) => b.type === "tool_use");
    if (!toolUse || toolUse.type !== "tool_use") return null;

    const input = toolUse.input as { assetId: string; confidence: string; reasoning: string };
    const { assetId, confidence, reasoning } = input;

    console.log(
      `[ASSET-MATCH] AI selected assetId=${assetId} confidence=${confidence} — ${reasoning}`
    );

    if (assetId === "none" || confidence === "low") return null;

    // Validate the returned id is actually in our list
    const valid = assets.find((a) => a.id === assetId);
    if (!valid) {
      console.warn(`[ASSET-MATCH] AI returned unknown assetId ${assetId} — ignoring`);
      return null;
    }

    return assetId;
  } catch (err: any) {
    console.warn("[ASSET-MATCH] AI call failed (non-blocking):", err.message);
    return null;
  }
}
