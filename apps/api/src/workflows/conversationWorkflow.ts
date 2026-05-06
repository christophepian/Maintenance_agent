/**
 * Conversation Workflow
 *
 * Orchestration layer for tenant conversation turns.
 * Calls conversationService.handleTurn and emits the CONVERSATION_TURN domain event.
 */

import { WorkflowContext } from "./context";
import { handleTurn, ConversationChannel, ConversationTurnResult } from "../services/conversationService";
import { emit } from "../events/bus";

export interface ConversationTurnWorkflowInput {
  tenantId: string;
  channel: ConversationChannel;
  messageText: string;
}

export async function processTurnWorkflow(
  ctx: WorkflowContext,
  input: ConversationTurnWorkflowInput
): Promise<ConversationTurnResult> {
  const { orgId, prisma } = ctx;

  const result = await handleTurn(prisma, {
    tenantId: input.tenantId,
    orgId,
    channel: input.channel,
    messageText: input.messageText,
  });

  emit({
    type: "CONVERSATION_TURN",
    orgId,
    payload: {
      orgId,
      tenantId: input.tenantId,
      channel: input.channel,
      intent: result.intent,
      actionTaken: result.actionTaken,
    },
  });

  return result;
}
