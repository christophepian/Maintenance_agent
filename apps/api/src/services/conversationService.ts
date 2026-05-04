/**
 * Conversation Service
 *
 * Channel-agnostic core for tenant AI conversations.
 * Receives a normalised turn (tenantId, orgId, channel, messageText),
 * calls the Claude API, resolves the intent, executes any action,
 * and persists both turns via conversationRepository.
 *
 * No channel-specific logic lives here — adapters handle that.
 * This service is the single source of conversation truth for all channels.
 */

import Anthropic from "@anthropic-ai/sdk";
import { PrismaClient } from "@prisma/client";
import {
  findOrCreateThread,
  getRecentMessages,
  addMessage,
} from "../repositories/conversationRepository";
import { buildSystemPrompt } from "./conversationPrompts";
import {
  findTenantUnitId,
  findTenantRequests,
} from "../repositories/tenantPortalRepository";
import { createRequestWorkflow } from "../workflows/createRequestWorkflow";

import type { ConversationChannel } from "../repositories/conversationRepository";
export type { ConversationChannel };

// ─── Types ─────────────────────────────────────────────────────────────────────

export type ConversationIntent =
  | "reportIssue"
  | "checkStatus"
  | "generalAnswer"
  | "unknown";

export interface ConversationTurnInput {
  tenantId: string;
  orgId: string;
  channel: ConversationChannel;
  messageText: string;
}

export interface ConversationTurnResult {
  replyText: string;
  intent: ConversationIntent;
  actionTaken: boolean;
}

// ─── Tool definitions for Claude ───────────────────────────────────────────────

const CONVERSATION_TOOLS: Anthropic.Tool[] = [
  {
    name: "reportIssue",
    description:
      "Create a new maintenance request when the tenant describes a problem that needs fixing. Use this when the tenant reports a broken, leaking, malfunctioning, or damaged item in their property.",
    input_schema: {
      type: "object" as const,
      properties: {
        description: {
          type: "string",
          description:
            "Clear description of the issue. Must be at least 10 characters and describe the problem specifically.",
        },
        category: {
          type: "string",
          description:
            "Category of the issue, e.g. plumbing, heating, electrical, general",
        },
        urgency: {
          type: "string",
          enum: ["LOW", "MEDIUM", "HIGH"],
          description:
            "Urgency level. HIGH for safety issues or no water/heat, MEDIUM for significant problems, LOW for minor inconveniences.",
        },
        replyToTenant: {
          type: "string",
          description:
            "The message to send back to the tenant confirming the request was created and describing next steps.",
        },
      },
      required: ["description", "urgency", "replyToTenant"],
    },
  },
  {
    name: "checkStatus",
    description:
      "Look up the status of the tenant's existing maintenance requests. Use when the tenant asks about progress, timelines, or what's happening with their requests.",
    input_schema: {
      type: "object" as const,
      properties: {
        replyToTenant: {
          type: "string",
          description: "The message to send back to the tenant with the status information.",
        },
      },
      required: ["replyToTenant"],
    },
  },
  {
    name: "generalAnswer",
    description:
      "Answer a general question about property management, processes, or the tenant's situation without taking any system action.",
    input_schema: {
      type: "object" as const,
      properties: {
        replyToTenant: {
          type: "string",
          description: "The answer to send back to the tenant.",
        },
      },
      required: ["replyToTenant"],
    },
  },
];

// ─── Service ───────────────────────────────────────────────────────────────────

let _anthropicClient: Anthropic | null = null;

function getAnthropicClient(): Anthropic {
  if (!_anthropicClient) {
    const apiKey = process.env.ANTHROPIC_API_KEY;
    if (!apiKey) {
      throw new Error("ANTHROPIC_API_KEY environment variable is not set");
    }
    _anthropicClient = new Anthropic({ apiKey });
  }
  return _anthropicClient;
}

/**
 * Process a single conversation turn.
 * Finds or creates the thread, calls Claude API, executes the resolved action,
 * and persists both the inbound and outbound messages.
 */
export async function handleTurn(
  prisma: PrismaClient,
  input: ConversationTurnInput
): Promise<ConversationTurnResult> {
  const { tenantId, orgId, channel, messageText } = input;

  // 1. Find or create thread
  const thread = await findOrCreateThread(prisma, tenantId, orgId, channel);

  // 2. Fetch recent history for context window (last 10 turns = 20 messages)
  const history = await getRecentMessages(prisma, thread.id, 20);

  // 3. Build messages array for Claude API
  const claudeMessages: Anthropic.MessageParam[] = (history as Array<{ role: string; content: string }>).map(
    (m): Anthropic.MessageParam => ({
      role: m.role === "TENANT" ? "user" : "assistant",
      content: m.content,
    })
  );
  claudeMessages.push({ role: "user", content: messageText });

  // 4. Call Claude API with tool use
  const client = getAnthropicClient();
  const response = await client.messages.create({
    model: "claude-haiku-4-5-20251001",
    max_tokens: 1024,
    system: buildSystemPrompt(orgId, tenantId),
    tools: CONVERSATION_TOOLS,
    messages: claudeMessages,
  });

  // 5. Resolve intent and execute action
  let replyText = "I'm sorry, I couldn't process your request. Please try again or contact your property manager directly.";
  let intent: ConversationIntent = "unknown";
  let actionTaken = false;

  // Find a tool_use block if present
  const toolUseBlock = response.content.find((b) => b.type === "tool_use");
  const textBlock = response.content.find((b) => b.type === "text");

  if (toolUseBlock && toolUseBlock.type === "tool_use") {
    intent = toolUseBlock.name as ConversationIntent;
    const toolInput = toolUseBlock.input as Record<string, string>;

    if (intent === "reportIssue") {
      replyText = await executeReportIssue(prisma, { tenantId, orgId }, toolInput);
      actionTaken = true;
    } else if (intent === "checkStatus") {
      replyText = await executeCheckStatus(prisma, tenantId, toolInput);
      actionTaken = true;
    } else {
      // generalAnswer
      intent = "generalAnswer";
      replyText = toolInput.replyToTenant ?? replyText;
    }
  } else if (textBlock && textBlock.type === "text") {
    // Claude returned plain text without tool use
    intent = "generalAnswer";
    replyText = textBlock.text;
  }

  // 6. Persist both turns
  await addMessage(prisma, thread.id, "TENANT", messageText);
  await addMessage(prisma, thread.id, "ASSISTANT", replyText, intent);

  return { replyText, intent, actionTaken };
}

// ─── Action executors ─────────────────────────────────────────────────────────

async function executeReportIssue(
  prisma: PrismaClient,
  ctx: { tenantId: string; orgId: string },
  toolInput: Record<string, string>
): Promise<string> {
  try {
    const unitId = await findTenantUnitId(prisma, ctx.tenantId);

    const { dto } = await createRequestWorkflow(
      { orgId: ctx.orgId, prisma, actorUserId: null },
      {
        input: {
          description: toolInput.description,
          category: toolInput.category || undefined,
        },
        tenantId: ctx.tenantId,
        unitId: unitId ?? undefined,
      }
    );

    const baseReply = toolInput.replyToTenant ?? "Your maintenance request has been received.";
    return `${baseReply} (Reference: ${dto.id.slice(0, 8).toUpperCase()})`;
  } catch (err) {
    // If workflow fails, return a graceful message rather than crashing the chat
    console.error("[conversationService] createRequestWorkflow failed:", err);
    return "I've noted your issue but encountered a problem creating the request automatically. Please use the maintenance request form or contact your property manager directly.";
  }
}

async function executeCheckStatus(
  prisma: PrismaClient,
  tenantId: string,
  toolInput: Record<string, string>
): Promise<string> {
  try {
    const requests = await findTenantRequests(prisma, tenantId);
    if (requests.length === 0) {
      return "You don't have any open maintenance requests at the moment.";
    }

    // The LLM already composed the status reply from its training data knowledge
    // of what statuses mean. Return its reply enriched with actual data.
    const openRequests = requests.filter(
      (r) => r.status !== "COMPLETED" && r.status !== "REJECTED"
    );

    if (openRequests.length === 0) {
      return "All your previous maintenance requests have been resolved.";
    }

    // Use the LLM's reply as a base; it already has the right tone.
    // Append a factual list of open requests.
    const lines = openRequests.slice(0, 3).map((r) => {
      const status = r.status.replace(/_/g, " ").toLowerCase();
      const desc = r.description.slice(0, 60);
      return `• ${desc}${r.description.length > 60 ? "…" : ""} — ${status}`;
    });

    const header = toolInput.replyToTenant
      ? `${toolInput.replyToTenant}\n\n`
      : "Here are your open requests:\n\n";

    return `${header}${lines.join("\n")}`;
  } catch (err) {
    console.error("[conversationService] findTenantRequests failed:", err);
    return toolInput.replyToTenant ?? "I couldn't retrieve your request status right now. Please try again shortly.";
  }
}
