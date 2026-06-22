/**
 * creditNoteService
 *
 * Credit notes (avoirs) issued to tenants — currently for charge-reconciliation
 * refunds. Each issued credit note gets a sequential number from its issuing
 * billing entity (CN-YYYY-NNN), assigned transactionally like an invoice number.
 * See docs/ANCILLARY_COSTS_RECONCILIATION.md.
 */

import { PrismaClient } from "@prisma/client";
import prisma from "./prismaClient";
import * as repo from "../repositories/creditNoteRepository";

export interface CreditNoteLineDTO {
  id: string;
  description: string;
  amountCents: number;
}

export interface CreditNoteDTO {
  id: string;
  creditNoteNumber: string | null;
  leaseId: string | null;
  tenantName: string | null;
  amountCents: number;
  currency: string;
  status: string;
  issueDate: string | null;
  description: string | null;
  lineItems: CreditNoteLineDTO[];
}

type Row = NonNullable<Awaited<ReturnType<typeof repo.findCreditNoteById>>>;

export function mapCreditNoteToDTO(c: Row): CreditNoteDTO {
  return {
    id: c.id,
    creditNoteNumber: c.creditNoteNumber,
    leaseId: c.leaseId,
    tenantName: c.lease?.tenantName ?? c.recipientName ?? null,
    amountCents: c.amountCents,
    currency: c.currency,
    status: c.status,
    issueDate: c.issueDate ? c.issueDate.toISOString() : null,
    description: c.description,
    lineItems: c.lineItems.map((l) => ({ id: l.id, description: l.description, amountCents: l.amountCents })),
  };
}

export interface CreateCreditNoteInput {
  orgId: string;
  leaseId?: string | null;
  issuerBillingEntityId?: string | null;
  recipientName?: string | null;
  amountCents: number; // positive magnitude
  description?: string | null;
  issueDate?: Date;
  lineItems: Array<{ description: string; amountCents: number }>;
}

/**
 * Create + issue a credit note. If an issuer billing entity is given, a
 * sequential number is assigned atomically (CN-YYYY-NNN) and the note is ISSUED;
 * otherwise it is left DRAFT without a number.
 */
export async function createCreditNote(
  input: CreateCreditNoteInput,
  client: PrismaClient = prisma,
): Promise<CreditNoteDTO> {
  const issueDate = input.issueDate ?? new Date();
  const created = await client.$transaction(async (tx) => {
    let creditNoteNumber: string | null = null;
    let status = "DRAFT";

    if (input.issuerBillingEntityId) {
      const issuer = await tx.billingEntity.findUnique({ where: { id: input.issuerBillingEntityId } });
      if (issuer) {
        const seq = issuer.nextCreditNoteSequence;
        creditNoteNumber = `CN-${issueDate.getUTCFullYear()}-${String(seq).padStart(3, "0")}`;
        await tx.billingEntity.update({
          where: { id: issuer.id },
          data: { nextCreditNoteSequence: seq + 1 },
        });
        status = "ISSUED";
      }
    }

    return tx.creditNote.create({
      data: {
        orgId: input.orgId,
        leaseId: input.leaseId ?? null,
        issuerBillingEntityId: input.issuerBillingEntityId ?? null,
        recipientName: input.recipientName ?? null,
        amountCents: input.amountCents,
        currency: "CHF",
        status,
        creditNoteNumber,
        issueDate: status === "ISSUED" ? issueDate : null,
        lockedAt: status === "ISSUED" ? new Date() : null,
        description: input.description ?? null,
        lineItems: { create: input.lineItems.map((l) => ({ description: l.description, amountCents: l.amountCents })) },
      },
      include: repo.CREDIT_NOTE_INCLUDE,
    });
  });
  return mapCreditNoteToDTO(created);
}

export async function listCreditNotes(orgId: string, leaseId?: string): Promise<CreditNoteDTO[]> {
  const rows = await repo.listCreditNotes(prisma, orgId, leaseId);
  return rows.map(mapCreditNoteToDTO);
}

export async function getCreditNote(orgId: string, id: string): Promise<CreditNoteDTO | null> {
  const row = await repo.findCreditNoteById(prisma, id, orgId);
  return row ? mapCreditNoteToDTO(row) : null;
}
