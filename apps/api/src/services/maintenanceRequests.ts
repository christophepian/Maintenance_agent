import { PrismaClient, Prisma, RequestStatus, JobStatus, ApprovalSource, PayingParty, RequestUrgency, RequestType } from "@prisma/client";
import { REQUEST_FULL_INCLUDE, REQUEST_SUMMARY_INCLUDE } from "../repositories/requestRepository";
import { requestTriageWorkflow } from "../workflows/requestTriageWorkflow";

/** Compile-time type for a Request row loaded with REQUEST_FULL_INCLUDE. */
type RequestWithFullInclude = Prisma.RequestGetPayload<{ include: typeof REQUEST_FULL_INCLUDE }>;
/** Compile-time type for a Request row loaded with REQUEST_SUMMARY_INCLUDE. */
type RequestWithSummaryInclude = Prisma.RequestGetPayload<{ include: typeof REQUEST_SUMMARY_INCLUDE }>;

/**
 * Build a Prisma WHERE clause that scopes Requests to a given org.
 * Request now has a direct orgId column (DT-114 migration).
 */
function orgScopeWhere(orgId: string): Prisma.RequestWhereInput {
  return { orgId };
}

export type MaintenanceRequestDTO = {
  id: string;
  orgId: string;
  requestNumber: number;
  description: string;
  category: string | null;
  estimatedCost: number | null;
  status: RequestStatus;

  // ✅ NEW but OPTIONAL to avoid breaking other services
  contactPhone?: string | null;
  tenantId?: string | null;
  unitId?: string | null;
  assetId?: string | null;
  approvalSource?: ApprovalSource | null;
  rejectionReason?: string | null;
  payingParty?: PayingParty;
  urgency?: RequestUrgency;

  assignedContractor: null | {
    id: string;
    name: string;
    phone: string;
    email: string;
    hourlyRate: number;
  };

  /** ID of the most-recent RFP linked to this request, if any. */
  rfpId?: string | null;

  /** Linked job — carries execution state (IN_PROGRESS/COMPLETED) that no longer lives on Request.status */
  job?: {
    id: string;
    status: JobStatus;
    startedAt: string | null;
    completedAt: string | null;
    contractorId: string;
  } | null;

  // optional enrichments
  tenant?: null | {
    id: string;
    name: string | null;
    phone: string;
    email: string | null;
  };
  unit?: null | {
    id: string;
    unitNumber: string;
    floor: string | null;
    building: {
      id: string;
      name: string;
      address: string;
    };
  };
  asset?: null | {
    id: string;
    name: string;
    type: string;
    category: string;
    topic: string;
    serialNumber: string | null;
    brand: string | null;
    modelNumber: string | null;
    installedAt: Date | null;
    notes: string | null;
    assetModel: {
      id: string;
      manufacturer: string;
      model: string;
      category: string;
    } | null;
  };

  // JSON-friendly
  createdAt: string;

  // Triage suggestions (set after REQUEST_CREATED event is processed)
  triageContractorIds?: string[];
  triageBudgetMin?: number | null;
  triageBudgetMax?: number | null;
  triageCompletedAt?: string | null;

  // Request classification + resolution
  requestType?: RequestType;
  resolutionNote?: string | null;
};

  /**
   * H5: Summary DTO for list endpoints.
   * Reduces overfetch by omitting deep nested relations for list views.
   */
  export interface MaintenanceRequestSummaryDTO {
    id: string;
    requestNumber: number;
    status: RequestStatus;
    createdAt: string;
    description: string;
    estimatedCost: number | null;
    category: string | null;
    unitNumber: string | null;
    buildingId: string | null;
    buildingName: string | null;
    assignedContractorName: string | null;
    payingParty?: PayingParty;
    approvalSource?: ApprovalSource | null;
    urgency?: RequestUrgency;
    jobStatus?: JobStatus | null;
    jobCompletedAt?: string | null;
  }

type ListOpts = {
  limit: number;
  offset: number;
  order: "asc" | "desc";
    view?: "summary" | "full";
};

const requestInclude = {
  assignedContractor: {
    select: {
      id: true,
      name: true,
      phone: true,
      email: true,
      hourlyRate: true,
    },
  },
  tenant: {
    select: {
      id: true,
      name: true,
      phone: true,
      email: true,
    },
  },
  unit: {
    select: {
      id: true,
      unitNumber: true,
      floor: true,
      building: {
        select: {
          id: true,
          name: true,
          address: true,
        },
      },
    },
  },
  asset: {
    select: {
      id: true,
      name: true,
      type: true,
      category: true,
      topic: true,
      serialNumber: true,
      brand: true,
      modelNumber: true,
      installedAt: true,
      notes: true,
      assetModel: {
        select: {
          id: true,
          manufacturer: true,
          model: true,
          category: true,
        },
      },
    },
  },
  rfps: {
    select: { id: true, status: true },
    orderBy: { createdAt: "desc" as const },
    take: 1,
  },
  job: {
    select: {
      id: true,
      status: true,
      startedAt: true,
      completedAt: true,
      contractorId: true,
    },
  },
} as const;

  const requestSummaryInclude = {
    assignedContractor: {
      select: {
        name: true,
      },
    },
    unit: {
      select: {
        unitNumber: true,
        building: {
          select: {
            id: true,
            name: true,
          },
        },
      },
    },
    job: {
      select: { id: true, status: true, completedAt: true },
    },
  } as const;

export function toDTO(r: RequestWithFullInclude): MaintenanceRequestDTO {
  return {
    id: r.id,
    orgId: r.orgId,
    requestNumber: r.requestNumber,
    description: r.description,
    category: r.category ?? null,
    estimatedCost: r.estimatedCost ?? null,
    status: r.status,

    // ✅ NEW
    contactPhone: r.contactPhone ?? null,
    tenantId: r.tenantId ?? null,
    unitId: r.unitId ?? null,
    assetId: (r as any).assetId ?? null,
    approvalSource: r.approvalSource ?? null,
    rejectionReason: r.rejectionReason ?? null,
    payingParty: r.payingParty,
    urgency: r.urgency,

    assignedContractor: r.assignedContractor
      ? {
          id: r.assignedContractor.id,
          name: r.assignedContractor.name,
          phone: r.assignedContractor.phone,
          email: r.assignedContractor.email,
          hourlyRate: r.assignedContractor.hourlyRate,
        }
      : null,

    tenant: r.tenant
      ? {
          id: r.tenant.id,
          name: r.tenant.name ?? null,
          phone: r.tenant.phone,
          email: r.tenant.email ?? null,
        }
      : null,

    unit: r.unit ?? null,
    asset: (r as any).asset ?? null,
    rfpId: r.rfps?.[0]?.id ?? null,

    job: (r as any).job
      ? {
          id: (r as any).job.id,
          status: (r as any).job.status as JobStatus,
          startedAt: (r as any).job.startedAt instanceof Date
            ? (r as any).job.startedAt.toISOString()
            : ((r as any).job.startedAt ?? null),
          completedAt: (r as any).job.completedAt instanceof Date
            ? (r as any).job.completedAt.toISOString()
            : ((r as any).job.completedAt ?? null),
          contractorId: (r as any).job.contractorId,
        }
      : null,

    createdAt: r.createdAt instanceof Date ? r.createdAt.toISOString() : String(r.createdAt),

    triageContractorIds: (r as any).triageContractorIds ?? [],
    triageBudgetMin: (r as any).triageBudgetMin ?? null,
    triageBudgetMax: (r as any).triageBudgetMax ?? null,
    triageCompletedAt: (r as any).triageCompletedAt instanceof Date
      ? (r as any).triageCompletedAt.toISOString()
      : ((r as any).triageCompletedAt ?? null),

    requestType: (r as any).requestType ?? RequestType.MAINTENANCE,
    resolutionNote: (r as any).resolutionNote ?? null,
  };
}

export function toSummaryDTO(r: RequestWithSummaryInclude): MaintenanceRequestSummaryDTO {
    return {
      id: r.id,
      requestNumber: r.requestNumber,
      status: r.status,
      description: r.description,
      estimatedCost: r.estimatedCost ?? null,
      category: r.category ?? null,
      unitNumber: r.unit?.unitNumber ?? null,
      buildingId: r.unit?.building?.id ?? null,
      buildingName: r.unit?.building?.name ?? null,
      assignedContractorName: r.assignedContractor?.name ?? null,
      payingParty: r.payingParty,
      approvalSource: r.approvalSource ?? null,
      urgency: r.urgency,
      jobStatus: (r as any).job?.status ?? null,
      jobCompletedAt: (r as any).job?.completedAt instanceof Date
        ? (r as any).job.completedAt.toISOString()
        : ((r as any).job?.completedAt ?? null),
      createdAt: r.createdAt instanceof Date ? r.createdAt.toISOString() : String(r.createdAt),
    };
  }

export async function listMaintenanceRequests(
  prisma: PrismaClient,
  orgId: string,
  opts: ListOpts
  ): Promise<{ data: MaintenanceRequestDTO[] | MaintenanceRequestSummaryDTO[]; total: number }> {
    const useSummary = opts.view === "summary";
    const where = orgScopeWhere(orgId);

  const [rows, total] = await Promise.all([
    prisma.request.findMany({
      where,
      orderBy: { createdAt: opts.order },
      take: opts.limit,
      skip: opts.offset,
      include: useSummary ? requestSummaryInclude : requestInclude,
    }),
    prisma.request.count({ where }),
  ]);

    const data = useSummary ? rows.map(toSummaryDTO) : rows.map(toDTO);
    return { data, total };
}

export async function listOwnerPendingApprovals(
  prisma: PrismaClient,
  orgId: string,
  opts: { buildingId?: string }
): Promise<MaintenanceRequestDTO[]> {
  const baseWhere = orgScopeWhere(orgId);

  const where = opts.buildingId
    ? { ...baseWhere, status: RequestStatus.PENDING_OWNER_APPROVAL, unit: { buildingId: opts.buildingId, orgId } }
    : { ...baseWhere, status: RequestStatus.PENDING_OWNER_APPROVAL };

  const rows = await prisma.request.findMany({
    where,
    orderBy: { createdAt: "desc" },
    include: requestInclude,
  });

  return rows.map(toDTO);
}


// Re-export real implementations from requestAssignment
export { assignContractor, unassignContractor, findMatchingContractor } from './requestAssignment';

export async function getMaintenanceRequestById(
  prisma: PrismaClient,
  id: string
): Promise<MaintenanceRequestDTO | null> {
  const row = await prisma.request.findUnique({
    where: { id },
    include: requestInclude,
  });

  if (!row) return null;

  // Lazy-on-read triage (Slice 2, Option A):
  // Triage normally runs as a deferred handler after REQUEST_CREATED. If it has
  // not completed yet (just-created request, or the deferred handler failed),
  // run it synchronously now so the manager always sees the triage hint on the
  // first request-detail load. Idempotent: only fires while triageCompletedAt
  // is null. Failures are swallowed — the page still renders without the hint.
  if (!(row as any).triageCompletedAt) {
    try {
      await requestTriageWorkflow(prisma, {
        requestId: row.id,
        orgId: row.orgId,
        category: row.category,
      });
      const refreshed = await prisma.request.findUnique({
        where: { id },
        include: requestInclude,
      });
      if (refreshed) return toDTO(refreshed);
    } catch (err) {
      console.error("[TRIAGE] lazy-on-read triage failed", err);
    }
  }

  return toDTO(row);
}

export async function createMaintenanceRequest(
  prisma: PrismaClient,
  input: {
    orgId: string;
    description: string;
    category: string | null;
    estimatedCost: number | null;
    status: RequestStatus;
    contactPhone?: string | null;
    tenantId?: string | null;
    unitId?: string | null;
    assetId?: string | null;
  }
): Promise<MaintenanceRequestDTO> {
  const created = await prisma.request.create({
    data: {
      orgId: input.orgId,
      description: input.description,
      category: input.category,
      estimatedCost: input.estimatedCost,
      status: input.status,

      contactPhone: input.contactPhone ?? null,
      tenantId: input.tenantId ?? null,
      unitId: input.unitId ?? null,
      assetId: input.assetId ?? null,
    },
    include: requestInclude,
  });

  return toDTO(created);
}

export async function updateMaintenanceRequestStatus(
  prisma: PrismaClient,
  id: string,
  status: RequestStatus
): Promise<MaintenanceRequestDTO | null> {
  const updated = await prisma.request.update({
    where: { id },
    data: { status },
    include: requestInclude,
  });

  return updated ? toDTO(updated) : null;
}

// ─── Resolution note ──────────────────────────────────────────────────────────

export async function updateResolutionNote(
  prisma: PrismaClient,
  requestId: string,
  resolutionNote: string | null,
  markResolved: boolean,
): Promise<MaintenanceRequestDTO | null> {
  const data: Prisma.RequestUpdateInput = { resolutionNote };
  if (markResolved) {
    data.status = RequestStatus.COMPLETED;
    data.completedAt = new Date();
  }
  const updated = await prisma.request.update({
    where: { id: requestId },
    data,
    include: REQUEST_FULL_INCLUDE,
  });
  return updated ? toDTO(updated) : null;
}

// ─── Warning letter generation ────────────────────────────────────────────────

export interface WarningLetterResult {
  infringingRules: string[];
  letterText: string;
}

/**
 * Use Claude to analyse the complaint description against the building's house
 * rules and produce:
 *   1. A list of potentially infringed rules (extracted verbatim or summarised)
 *   2. A pre-populated formal warning letter in the manager's preferred language
 */
export async function generateWarningLetter(
  prisma: PrismaClient,
  requestId: string,
  lang: "fr" | "de" | "en" = "fr",
): Promise<WarningLetterResult> {
  // ── 1. Load request + building context ──────────────────────
  const request = await prisma.request.findUnique({
    where: { id: requestId },
    include: {
      tenant: { select: { name: true, phone: true, email: true } },
      unit: {
        select: {
          unitNumber: true,
          building: { select: { name: true, address: true, houseRulesText: true } },
        },
      },
    },
  });

  if (!request) throw Object.assign(new Error("Request not found"), { code: "NOT_FOUND" });

  const building = request.unit?.building;
  const tenantName = request.tenant?.name ?? "Le/La locataire";
  const unitNumber = request.unit?.unitNumber ?? "—";
  const buildingName = building?.name ?? "l'immeuble";
  const buildingAddress = building?.address ?? "";
  const houseRules = building?.houseRulesText ?? null;
  const today = new Date().toLocaleDateString("fr-CH", { day: "numeric", month: "long", year: "numeric" });

  // ── 2. Call Claude ───────────────────────────────────────────
  const { getAnthropicClient } = await import("./aiClient");
  const client = getAnthropicClient();

  const houseRulesSection = houseRules
    ? `\n\nRÈGLEMENT DE LA MAISON (${buildingName}):\n${houseRules.slice(0, 4000)}`
    : "\n\n(Aucun règlement de maison n'est défini pour cet immeuble.)";

  const prompt = `You are a Swiss property management assistant. A tenant has filed the following complaint:\n\n"${request.description}"\n\nBuilding: ${buildingName}, ${buildingAddress}\nComplainant's unit: ${unitNumber}${houseRulesSection}\n\nTask:\n1. Identify which specific house rules (if any) are potentially infringed by the situation described. Return them as a JSON array of short strings (max 150 chars each), or an empty array if no rules apply.\n2. Draft a formal warning letter in ${lang === "fr" ? "French" : lang === "de" ? "German" : "English"} addressed to the neighbor causing the nuisance (recipient details left as placeholders [NOM DU LOCATAIRE CONCERNÉ] and [NUMÉRO D'APPARTEMENT CONCERNÉ]). The letter should:\n   - Be dated ${today}\n   - Come from the property management\n   - Reference the specific house rules violated (if any) or general community living obligations\n   - Request the tenant stop the problematic behaviour\n   - Warn of consequences under CO Art. 257f (notice of termination for persistent breach)\n   - Be professional, firm, and concise\n\nRespond with ONLY valid JSON in this exact format:\n{\n  "infringingRules": ["rule 1", "rule 2"],\n  "letterText": "full letter text here"\n}`;

  const response = await client.messages.create({
    model: "claude-haiku-4-5-20251001",
    max_tokens: 1500,
    messages: [{ role: "user", content: prompt }],
  });

  const raw = response.content.find((b) => b.type === "text")?.text ?? "";

  // ── 3. Parse response ────────────────────────────────────────
  try {
    // Extract JSON block (Claude may wrap in ```json ... ```)
    const jsonMatch = raw.match(/\{[\s\S]*\}/);
    if (!jsonMatch) throw new Error("No JSON found in Claude response");
    const parsed = JSON.parse(jsonMatch[0]) as { infringingRules?: unknown; letterText?: unknown };
    return {
      infringingRules: Array.isArray(parsed.infringingRules)
        ? (parsed.infringingRules as string[]).filter((s) => typeof s === "string")
        : [],
      letterText: typeof parsed.letterText === "string" ? parsed.letterText : raw,
    };
  } catch {
    // Graceful fallback: return raw text as letter with no extracted rules
    return { infringingRules: [], letterText: raw };
  }
}
