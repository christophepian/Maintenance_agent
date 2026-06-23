/**
 * Request Event Service
 *
 * Handles request event CRUD operations (CQ-9 resolution).
 * Extracted from routes/requests.ts to move direct Prisma calls
 * out of the route layer.
 */

import { PrismaClient, RequestEventType } from "@prisma/client";
import {
  findRequestExistsById,
  listRequestEventsByRequestId,
  createRequestEventRow,
} from "../repositories/requestRepository";
import { findContractorByIdRaw } from "../repositories/contractorRepository";

// ─── DTOs ──────────────────────────────────────────────────────

export interface RequestEventDTO {
  id: string;
  requestId: string;
  contractorId: string;
  type: string;
  message: string;
  timestamp: Date;
}

// ─── List events ───────────────────────────────────────────────

export async function listRequestEvents(
  prisma: PrismaClient,
  requestId: string,
): Promise<RequestEventDTO[]> {
  const events = await listRequestEventsByRequestId(prisma, requestId);
  return events;
}

// ─── Create event ──────────────────────────────────────────────

export async function createRequestEvent(
  prisma: PrismaClient,
  input: {
    requestId: string;
    contractorId: string;
    type: RequestEventType;
    message: string;
  },
): Promise<RequestEventDTO> {
  // Validate request exists
  const reqExists = await findRequestExistsById(prisma, input.requestId);
  if (!reqExists) {
    throw Object.assign(new Error("Request not found"), { code: "NOT_FOUND" });
  }

  // Validate contractor exists
  const contractorExists = await findContractorByIdRaw(prisma, input.contractorId);
  if (!contractorExists) {
    throw Object.assign(new Error("Contractor not found"), { code: "NOT_FOUND" });
  }

  const event = await createRequestEventRow(prisma, {
    requestId: input.requestId,
    contractorId: input.contractorId,
    type: input.type,
    message: input.message,
  });
  return event;
}
