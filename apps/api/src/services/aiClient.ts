/**
 * aiClient — shared Anthropic SDK instance.
 *
 * Lazy-initialised once on first call so the process can boot without
 * ANTHROPIC_API_KEY present (e.g. during unit tests).
 */

import Anthropic from "@anthropic-ai/sdk";

let _client: Anthropic | null = null;

export function getAnthropicClient(): Anthropic {
  if (!_client) {
    const apiKey = process.env.ANTHROPIC_API_KEY;
    if (!apiKey) {
      throw new Error("ANTHROPIC_API_KEY environment variable is not set");
    }
    _client = new Anthropic({ apiKey });
  }
  return _client;
}
