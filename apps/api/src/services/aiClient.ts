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
    // Ride out transient 429 / 5xx / 529 "overloaded_error" (the API returns
    // x-should-retry: true) with the SDK's exponential backoff, instead of failing
    // a whole — expensive — vision extraction on a momentary capacity blip. The
    // SDK default is only 2 retries; bump it so a brief overload is invisible.
    _client = new Anthropic({ apiKey, maxRetries: 6 });
  }
  return _client;
}
