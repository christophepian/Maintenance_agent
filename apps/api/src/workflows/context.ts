/**
 * Workflow Context
 *
 * Shared types passed to every workflow so that they can assert org
 * scope, reference the actor, and access the database.
 */

import { PrismaClient } from "@prisma/client";

export interface WorkflowContext {
  /** Caller's org ID (resolved from auth / header). */
  orgId: string;
  /** Prisma client instance. */
  prisma: PrismaClient;
  /** User who triggered the action (null for system events). */
  actorUserId?: string | null;
}
