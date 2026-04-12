/**
 * Legal Engine Routes
 *
 * Decision endpoint + admin CRUD for legal rules, sources,
 * category mappings, depreciation standards, and evaluations.
 *
 * Route protection:
 *   - Decision: withAuthRequired (any authenticated user)
 *   - Admin reads: requireOrgViewer (MANAGER or OWNER)
 *   - Mutations: requireRole('MANAGER')
 *   - RFP award: requireAnyRole(['MANAGER', 'OWNER'])
 */

import { Router, HandlerContext } from "../http/router";
import { sendError, sendJson } from "../http/json";
import { readJson, parseBody } from "../http/body";
import { first } from "../http/query";
import { requireOrgViewer } from "./helpers";
import { requireAnyRole, requireRole, getAuthUser } from "../authz";
import {
  RequestNotFoundError,
} from "../services/legalDecisionEngine";
import {
  listRfps,
  getRfpById,
  RfpNotFoundError,
} from "../services/rfps";
import { evaluateLegalRoutingWorkflow } from "../workflows/evaluateLegalRoutingWorkflow";
import { analyseClaimWorkflow } from "../workflows/analyseClaimWorkflow";
import { awardQuoteWorkflow, AwardQuoteError } from "../workflows";
import { rfpReinviteWorkflow, RfpReinviteError } from "../workflows";
import { rfpDirectAssignWorkflow, RfpDirectAssignError } from "../workflows";
import { AwardQuoteSchema } from "../validation/awardQuoteSchema";
import { ReinviteContractorsSchema, DirectAssignContractorSchema } from "../validation/rfpFallbackSchemas";
import {
  ingestSource,
  ingestAllSources,
} from "../services/legalIngestion";
import {
  ListRfpsSchema,
  CreateCategoryMappingSchema,
  UpdateCategoryMappingSchema,
  CreateDepreciationStandardSchema,
  CreateLegalRuleSchema,
  CreateLegalSourceSchema,
  UpdateLegalSourceSchema,
  CreateAssetSchema,
} from "../validation/legal";
import prisma from "../services/prismaClient";
import * as legalSourceRepo from "../repositories/legalSourceRepository";
import * as assetRepo from "../repositories/assetRepository";
import {
  listVariables,
  listRules,
  createRule,
  listCategoryMappings,
  createCategoryMapping,
  updateCategoryMapping,
  deleteCategoryMapping,
  getMappingCoverage,
  listEvaluations,
  listDepreciationStandards,
  createDepreciationStandard,
  LegalConflictError,
  LegalNotFoundError,
  LegalForbiddenError,
} from "../services/legalService";
import { LegalSourceStatus, LegalSourceScope, LegalSource } from "@prisma/client";

// ─── LegalSource DTO + Mapper ──────────────────────────────────

export interface LegalSourceDTO {
  id: string;
  name: string;
  url: string | null;
  jurisdiction: string;
  scope: LegalSourceScope;
  fetcherType: string | null;
  parserType: string | null;
  updateFrequency: string | null;
  status: LegalSourceStatus;
  lastCheckedAt: string | null;
  lastSuccessAt: string | null;
  lastError: string | null;
  createdAt: string;
  updatedAt: string;
}

function mapLegalSourceToDTO(source: LegalSource): LegalSourceDTO {
  return {
    id: source.id,
    name: source.name,
    url: source.url ?? null,
    jurisdiction: source.jurisdiction,
    scope: source.scope,
    fetcherType: source.fetcherType ?? null,
    parserType: source.parserType ?? null,
    updateFrequency: source.updateFrequency ?? null,
    status: source.status,
    lastCheckedAt: source.lastCheckedAt?.toISOString() ?? null,
    lastSuccessAt: source.lastSuccessAt?.toISOString() ?? null,
    lastError: source.lastError ?? null,
    createdAt: source.createdAt.toISOString(),
    updatedAt: source.updatedAt.toISOString(),
  };
}


export function registerLegalRoutes(router: Router) {
  // ════════════════════════════════════════════════════════════
  // Decision Endpoint
  // ════════════════════════════════════════════════════════════

  /**
   * GET /requests/:id/legal-decision
   *
   * Evaluates legal obligations for a maintenance request.
   * If obligation = OBLIGATED, auto-creates an RFP (idempotent).
   */
  router.get(
    "/requests/:id/legal-decision",
    async ({ req, res, params, orgId }) => {
      if (!requireOrgViewer(req, res)) return;

      try {
        const result = await evaluateLegalRoutingWorkflow(
          { orgId, prisma },
          { requestId: params.id },
        );

        sendJson(res, 200, { data: result.decision });
      } catch (e: any) {
        if (e instanceof RequestNotFoundError) {
          return sendError(res, 404, "NOT_FOUND", e.message);
        }
        if (e.name === "OrgScopeMismatchError") {
          return sendError(res, 403, "FORBIDDEN", e.message);
        }
        console.error("[GET /requests/:id/legal-decision]", e);
        sendError(res, 500, "INTERNAL_ERROR", "Legal evaluation failed");
      }
    },
  );

  // ════════════════════════════════════════════════════════════
  // Claim Analysis Endpoint
  // ════════════════════════════════════════════════════════════

  /**
   * GET /requests/:id/claim-analysis
   *
   * Produces a complete tenant claim analysis including defect
   * classification, matched ASLOCA precedents, rent reduction
   * calculation, tenant guidance, and temporal context.
   */
  router.get(
    "/requests/:id/claim-analysis",
    async ({ req, res, params, orgId }) => {
      if (!requireOrgViewer(req, res)) return;

      try {
        const result = await analyseClaimWorkflow(
          { orgId, prisma },
          { requestId: params.id },
        );

        sendJson(res, 200, { data: result.analysis });
      } catch (e: any) {
        if (e instanceof RequestNotFoundError) {
          return sendError(res, 404, "NOT_FOUND", e.message);
        }
        if (e.name === "OrgScopeMismatchError") {
          return sendError(res, 403, "FORBIDDEN", e.message);
        }
        console.error("[GET /requests/:id/claim-analysis]", e);
        sendError(res, 500, "INTERNAL_ERROR", "Claim analysis failed");
      }
    },
  );

  // ════════════════════════════════════════════════════════════
  // RFP Endpoints
  // ════════════════════════════════════════════════════════════

  /**
   * GET /rfps
   */
  router.get("/rfps", async ({ req, res, query, orgId }) => {
    if (!requireOrgViewer(req, res)) return;

    const parsed = ListRfpsSchema.safeParse({
      limit: first(query, "limit"),
      offset: first(query, "offset"),
      status: first(query, "status"),
    });

    if (!parsed.success) {
      const msg = parsed.error.issues
        .map((i) => `${i.path.join(".")}: ${i.message}`)
        .join("; ");
      return sendError(res, 400, "VALIDATION_ERROR", msg);
    }

    try {
      const result = await listRfps(orgId, {
        limit: parsed.data.limit ?? 20,
        offset: parsed.data.offset ?? 0,
        status: parsed.data.status,
      });
      sendJson(res, 200, result);
    } catch (e: any) {
      console.error("[GET /rfps]", e);
      sendError(res, 500, "INTERNAL_ERROR", "Failed to list RFPs");
    }
  });

  /**
   * GET /rfps/:id
   */
  router.get("/rfps/:id", async ({ req, res, params, orgId }) => {
    if (!requireOrgViewer(req, res)) return;

    try {
      const rfp = await getRfpById(orgId, params.id);
      sendJson(res, 200, { data: rfp });
    } catch (e: any) {
      if (e instanceof RfpNotFoundError) {
        return sendError(res, 404, "NOT_FOUND", e.message);
      }
      console.error("[GET /rfps/:id]", e);
      sendError(res, 500, "INTERNAL_ERROR", "Failed to load RFP");
    }
  });

  /**
   * POST /rfps/:id/award
   *
   * Award a quote on an RFP. MANAGER or OWNER only.
   * If building threshold requires owner approval and actor is MANAGER,
   * routes to PENDING_OWNER_APPROVAL instead of direct award.
   */
  router.post("/rfps/:id/award", async ({ req, res, params, orgId }) => {
    if (!requireAnyRole(req, res, ["MANAGER", "OWNER"])) return;

    const body = await parseBody(req, AwardQuoteSchema);

    const user = getAuthUser(req);
    const actorRole = user?.role as "MANAGER" | "OWNER";

    try {
      const result = await awardQuoteWorkflow(
        { orgId, prisma, actorUserId: user?.userId ?? null },
        {
          rfpId: params.id,
          quoteId: body.quoteId,
          actorRole,
        },
      );

      sendJson(res, 200, { data: result });
    } catch (e: any) {
      if (e instanceof AwardQuoteError) {
        switch (e.code) {
          case "NOT_FOUND":
          case "QUOTE_NOT_FOUND":
            return sendError(res, 404, e.code, e.message);
          case "RFP_NOT_AWARDABLE":
          case "QUOTE_NOT_SUBMITTABLE":
            return sendError(res, 409, e.code, e.message);
          case "OWNER_APPROVAL_REQUIRED":
            return sendError(res, 403, e.code, e.message);
          default:
            return sendError(res, 400, e.code, e.message);
        }
      }
      console.error("[POST /rfps/:id/award]", e);
      sendError(res, 500, "INTERNAL_ERROR", "Failed to award quote");
    }
  });

  /**
   * POST /rfps/:id/reinvite
   *
   * Re-invite additional contractors to an open RFP.
   * MANAGER only.
   */
  router.post("/rfps/:id/reinvite", async ({ req, res, params, orgId }) => {
    if (!requireRole(req, res, "MANAGER")) return;

    const body = await parseBody(req, ReinviteContractorsSchema);
    const user = getAuthUser(req);

    try {
      const result = await rfpReinviteWorkflow(
        { orgId, prisma, actorUserId: user?.userId ?? null },
        { rfpId: params.id, contractorIds: body.contractorIds },
      );
      sendJson(res, 200, { data: result });
    } catch (e: any) {
      if (e instanceof RfpReinviteError) {
        switch (e.code) {
          case "NOT_FOUND":
            return sendError(res, 404, e.code, e.message);
          case "RFP_NOT_OPEN":
            return sendError(res, 409, e.code, e.message);
          case "NO_VALID_CONTRACTORS":
            return sendError(res, 400, e.code, e.message);
          default:
            return sendError(res, 400, e.code, e.message);
        }
      }
      console.error("[POST /rfps/:id/reinvite]", e);
      sendError(res, 500, "INTERNAL_ERROR", "Failed to reinvite contractors");
    }
  });

  /**
   * POST /rfps/:id/direct-assign
   *
   * Bypass quote collection and directly assign a contractor.
   * Closes the RFP and assigns the contractor to the linked request.
   * MANAGER only.
   */
  router.post("/rfps/:id/direct-assign", async ({ req, res, params, orgId }) => {
    if (!requireRole(req, res, "MANAGER")) return;

    const body = await parseBody(req, DirectAssignContractorSchema);
    const user = getAuthUser(req);

    try {
      const result = await rfpDirectAssignWorkflow(
        { orgId, prisma, actorUserId: user?.userId ?? null },
        { rfpId: params.id, contractorId: body.contractorId },
      );
      sendJson(res, 200, { data: result });
    } catch (e: any) {
      if (e instanceof RfpDirectAssignError) {
        switch (e.code) {
          case "NOT_FOUND":
            return sendError(res, 404, e.code, e.message);
          case "RFP_NOT_OPEN":
            return sendError(res, 409, e.code, e.message);
          case "NO_LINKED_REQUEST":
          case "CONTRACTOR_NOT_FOUND":
            return sendError(res, 400, e.code, e.message);
          case "ASSIGNMENT_FAILED":
            return sendError(res, 500, e.code, e.message);
          default:
            return sendError(res, 400, e.code, e.message);
        }
      }
      console.error("[POST /rfps/:id/direct-assign]", e);
      sendError(res, 500, "INTERNAL_ERROR", "Failed to directly assign contractor");
    }
  });

  // ════════════════════════════════════════════════════════════
  // Admin: Legal Sources
  // ════════════════════════════════════════════════════════════

  router.get("/legal/sources", async ({ req, res, orgId }) => {
    if (!requireOrgViewer(req, res)) return;

    // SA-11: LegalSource is intentionally global (jurisdiction-scoped, no orgId)
    // — statutory sources like CO 259a are shared across all orgs.
    try {
      const sources = await legalSourceRepo.findAll(prisma, orgId);
      sendJson(res, 200, { data: sources.map(mapLegalSourceToDTO) });
    } catch (e: any) {
      console.error("[GET /legal/sources]", e);
      sendError(res, 500, "INTERNAL_ERROR", "Failed to list sources");
    }
  });

  router.post("/legal/sources", async ({ req, res, orgId }) => {
    if (!requireRole(req, res, 'MANAGER')) return;

    // SA-11: LegalSource is intentionally global — see GET /legal/sources comment.
    try {
      const body = await readJson(req);
      const parsed = CreateLegalSourceSchema.safeParse(body);
      if (!parsed.success) {
        const msg = parsed.error.issues
          .map((i) => `${i.path.join(".")}: ${i.message}`)
          .join("; ");
        return sendError(res, 400, "VALIDATION_ERROR", msg);
      }

      const source = await legalSourceRepo.create(prisma, parsed.data);
      sendJson(res, 201, { data: mapLegalSourceToDTO(source) });
    } catch (e: any) {
      console.error("[POST /legal/sources]", e);
      sendError(res, 500, "INTERNAL_ERROR", "Failed to create source");
    }
  });

  // LegalSource IDs may be UUIDs or slug-style strings (e.g. "asloca-depreciation"),
  // so we use addCustom with a broader regex instead of the standard :id (UUID-only).
  const LEGAL_SOURCE_ID_PATTERN = /^\/legal\/sources\/([a-zA-Z0-9_-]+)$/;

  router.addCustom(
    "PATCH",
    LEGAL_SOURCE_ID_PATTERN,
    ["id"],
    async ({ req, res, params }) => {
    if (!requireRole(req, res, 'MANAGER')) return;

    try {
      const id = params?.id;
      if (!id) return sendError(res, 400, "MISSING_PARAM", "id is required");

      const existing = await legalSourceRepo.findById(prisma, id);
      if (!existing) return sendError(res, 404, "NOT_FOUND", "Legal source not found");

      const body = await readJson(req);
      const parsed = UpdateLegalSourceSchema.safeParse(body);
      if (!parsed.success) {
        const msg = parsed.error.issues
          .map((i) => `${i.path.join(".")}: ${i.message}`)
          .join("; ");
        return sendError(res, 400, "VALIDATION_ERROR", msg);
      }

      const updated = await legalSourceRepo.update(prisma, id, parsed.data);
      sendJson(res, 200, { data: mapLegalSourceToDTO(updated) });
    } catch (e: any) {
      console.error("[PATCH /legal/sources/:id]", e);
      sendError(res, 500, "INTERNAL_ERROR", "Failed to update source");
    }
  },
    "PATCH /legal/sources/:id",
  );

  router.addCustom(
    "DELETE",
    LEGAL_SOURCE_ID_PATTERN,
    ["id"],
    async ({ req, res, params }) => {
    if (!requireRole(req, res, 'MANAGER')) return;

    try {
      const id = params?.id;
      if (!id) return sendError(res, 400, "MISSING_PARAM", "id is required");

      const existing = await legalSourceRepo.findById(prisma, id);
      if (!existing) return sendError(res, 404, "NOT_FOUND", "Legal source not found");

      const linked = await legalSourceRepo.hasLinkedData(prisma, id);
      if (linked) {
        return sendError(
          res,
          409,
          "CONFLICT",
          "Source has linked data and cannot be deleted. Deactivate it instead.",
        );
      }

      await legalSourceRepo.remove(prisma, id);
      res.writeHead(204);
      res.end();
    } catch (e: any) {
      console.error("[DELETE /legal/sources/:id]", e);
      sendError(res, 500, "INTERNAL_ERROR", "Failed to delete source");
    }
  },
    "DELETE /legal/sources/:id",
  );

  // ════════════════════════════════════════════════════════════
  // Admin: Legal Variables
  // ════════════════════════════════════════════════════════════

  router.get("/legal/variables", async ({ req, res }) => {
    if (!requireOrgViewer(req, res)) return;
    try {
      sendJson(res, 200, { data: await listVariables() });
    } catch (e: any) {
      console.error("[GET /legal/variables]", e);
      sendError(res, 500, "INTERNAL_ERROR", "Failed to list variables");
    }
  });

  // ════════════════════════════════════════════════════════════
  // Admin: Legal Rules
  // ════════════════════════════════════════════════════════════

  router.get("/legal/rules", async ({ req, res }) => {
    if (!requireOrgViewer(req, res)) return;
    try {
      sendJson(res, 200, { data: await listRules() });
    } catch (e: any) {
      console.error("[GET /legal/rules]", e);
      sendError(res, 500, "INTERNAL_ERROR", "Failed to list rules");
    }
  });

  router.post("/legal/rules", async ({ req, res }) => {
    if (!requireRole(req, res, 'MANAGER')) return;
    try {
      const body = await readJson(req);
      const parsed = CreateLegalRuleSchema.safeParse(body);
      if (!parsed.success) {
        const msg = parsed.error.issues.map((i) => `${i.path.join(".")}: ${i.message}`).join("; ");
        return sendError(res, 400, "VALIDATION_ERROR", msg);
      }
      const rule = await createRule(parsed.data);
      sendJson(res, 201, { data: rule });
    } catch (e: any) {
      if (e instanceof LegalConflictError) return sendError(res, 409, "CONFLICT", e.message);
      console.error("[POST /legal/rules]", e);
      sendError(res, 500, "INTERNAL_ERROR", "Failed to create rule");
    }
  });

  // ════════════════════════════════════════════════════════════
  // Admin: Category Mappings
  // ════════════════════════════════════════════════════════════

  router.get("/legal/category-mappings", async ({ req, res, orgId }) => {
    if (!requireOrgViewer(req, res)) return;
    try {
      sendJson(res, 200, { data: await listCategoryMappings(orgId) });
    } catch (e: any) {
      console.error("[GET /legal/category-mappings]", e);
      sendError(res, 500, "INTERNAL_ERROR", "Failed to list mappings");
    }
  });

  router.post("/legal/category-mappings", async ({ req, res, orgId }) => {
    if (!requireRole(req, res, 'MANAGER')) return;
    try {
      const body = await readJson(req);
      const parsed = CreateCategoryMappingSchema.safeParse(body);
      if (!parsed.success) {
        const msg = parsed.error.issues.map((i) => `${i.path.join(".")}: ${i.message}`).join("; ");
        return sendError(res, 400, "VALIDATION_ERROR", msg);
      }
      sendJson(res, 201, { data: await createCategoryMapping(orgId, parsed.data) });
    } catch (e: any) {
      if (e instanceof LegalConflictError) return sendError(res, 409, "CONFLICT", e.message);
      console.error("[POST /legal/category-mappings]", e);
      sendError(res, 500, "INTERNAL_ERROR", "Failed to create mapping");
    }
  });

  router.put("/legal/category-mappings/:id", async ({ req, res, params, orgId }) => {
    if (!requireRole(req, res, 'MANAGER')) return;
    try {
      const body = await readJson(req);
      const parsed = UpdateCategoryMappingSchema.safeParse(body);
      if (!parsed.success) {
        const msg = parsed.error.issues.map((i) => `${i.path.join(".")}: ${i.message}`).join("; ");
        return sendError(res, 400, "VALIDATION_ERROR", msg);
      }
      sendJson(res, 200, { data: await updateCategoryMapping(params.id, orgId, parsed.data) });
    } catch (e: any) {
      if (e instanceof LegalNotFoundError) return sendError(res, 404, "NOT_FOUND", e.message);
      if (e instanceof LegalForbiddenError) return sendError(res, 403, "FORBIDDEN", e.message);
      console.error("[PUT /legal/category-mappings/:id]", e);
      sendError(res, 500, "INTERNAL_ERROR", "Failed to update mapping");
    }
  });

  router.delete("/legal/category-mappings/:id", async ({ req, res, params, orgId }) => {
    if (!requireRole(req, res, 'MANAGER')) return;
    try {
      await deleteCategoryMapping(params.id, orgId);
      sendJson(res, 200, { data: { deleted: true } });
    } catch (e: any) {
      if (e instanceof LegalNotFoundError) return sendError(res, 404, "NOT_FOUND", e.message);
      if (e instanceof LegalForbiddenError) return sendError(res, 403, "FORBIDDEN", e.message);
      console.error("[DELETE /legal/category-mappings/:id]", e);
      sendError(res, 500, "INTERNAL_ERROR", "Failed to delete mapping");
    }
  });

  /**
   * GET /legal/category-mappings/coverage
   *
   * Returns coverage analysis: for each request category, shows the mapped
   * legal topic plus counts of matching depreciation standards and rules.
   */
  router.get("/legal/category-mappings/coverage", async ({ req, res, orgId }) => {
    if (!requireOrgViewer(req, res)) return;
    try {
      const result = await getMappingCoverage(orgId);
      sendJson(res, 200, result);
    } catch (e: any) {
      console.error("[GET /legal/category-mappings/coverage]", e);
      sendError(res, 500, "INTERNAL_ERROR", "Failed to compute coverage");
    }
  });

  // ════════════════════════════════════════════════════════════
  // Admin: Depreciation Standards
  // ════════════════════════════════════════════════════════════

  router.get("/legal/depreciation-standards", async ({ req, res }) => {
    if (!requireOrgViewer(req, res)) return;
    try {
      sendJson(res, 200, { data: await listDepreciationStandards() });
    } catch (e: any) {
      console.error("[GET /legal/depreciation-standards]", e);
      sendError(res, 500, "INTERNAL_ERROR", "Failed to list depreciation standards");
    }
  });

  router.post("/legal/depreciation-standards", async ({ req, res }) => {
    if (!requireRole(req, res, 'MANAGER')) return;
    try {
      const body = await readJson(req);
      const parsed = CreateDepreciationStandardSchema.safeParse(body);
      if (!parsed.success) {
        const msg = parsed.error.issues.map((i) => `${i.path.join(".")}: ${i.message}`).join("; ");
        return sendError(res, 400, "VALIDATION_ERROR", msg);
      }
      sendJson(res, 201, { data: await createDepreciationStandard(parsed.data) });
    } catch (e: any) {
      if (e instanceof LegalConflictError) return sendError(res, 409, "CONFLICT", e.message);
      console.error("[POST /legal/depreciation-standards]", e);
      sendError(res, 500, "INTERNAL_ERROR", "Failed to create depreciation standard");
    }
  });

  // ════════════════════════════════════════════════════════════
  // Admin: Evaluation Logs
  // ════════════════════════════════════════════════════════════

  router.get("/legal/evaluations", async ({ req, res, query, orgId }) => {
    if (!requireOrgViewer(req, res)) return;
    try {
      const result = await listEvaluations({
        orgId,
        limit: Math.min(100, Math.max(1, parseInt(first(query, "limit") ?? "20", 10))),
        offset: Math.max(0, parseInt(first(query, "offset") ?? "0", 10)),
        obligationFilter: first(query, "obligation") ?? undefined,
        categoryFilter: first(query, "category") ?? undefined,
        requestIdFilter: first(query, "requestId") ?? undefined,
      });
      sendJson(res, 200, result);
    } catch (e: any) {
      console.error("[GET /legal/evaluations]", e);
      sendError(res, 500, "INTERNAL_ERROR", "Failed to list evaluations");
    }
  });

  // ════════════════════════════════════════════════════════════
  // Admin: Assets
  // ════════════════════════════════════════════════════════════

  router.get("/assets", async ({ req, res, query, orgId }) => {
    if (!requireOrgViewer(req, res)) return;

    const unitId = first(query, "unitId");
    const limit = Math.min(100, Math.max(1, parseInt(first(query, "limit") ?? "50", 10)));
    const offset = Math.max(0, parseInt(first(query, "offset") ?? "0", 10));

    try {
      const { rows, total } = await assetRepo.findAssetsForOrg(prisma, orgId, {
        unitId: unitId ?? undefined,
        limit,
        offset,
      });
      sendJson(res, 200, { data: rows, total });
    } catch (e: any) {
      console.error("[GET /assets]", e);
      sendError(res, 500, "INTERNAL_ERROR", "Failed to list assets");
    }
  });

  router.post("/assets", async ({ req, res, orgId }) => {
    if (!requireRole(req, res, 'MANAGER')) return;

    try {
      const body = await readJson(req);
      const parsed = CreateAssetSchema.safeParse(body);
      if (!parsed.success) {
        const msg = parsed.error.issues
          .map((i) => `${i.path.join(".")}: ${i.message}`)
          .join("; ");
        return sendError(res, 400, "VALIDATION_ERROR", msg);
      }

      const asset = await assetRepo.createAssetSimple(prisma, orgId, parsed.data);
      sendJson(res, 201, { data: asset });
    } catch (e: any) {
      console.error("[POST /assets]", e);
      sendError(res, 500, "INTERNAL_ERROR", "Failed to create asset");
    }
  });

  // ════════════════════════════════════════════════════════════
  // Admin: Ingestion Trigger
  // ════════════════════════════════════════════════════════════

  router.post("/legal/ingest", async ({ req, res }) => {
    if (!requireRole(req, res, 'MANAGER')) return;

    try {
      const body = await readJson(req).catch(() => ({}));
      const sourceId = (body as any)?.sourceId;

      let results;
      if (sourceId) {
        const result = await ingestSource(sourceId);
        results = [result];
      } else {
        results = await ingestAllSources();
      }

      sendJson(res, 200, { data: results });
    } catch (e: any) {
      console.error("[POST /legal/ingest]", e);
      sendError(res, 500, "INTERNAL_ERROR", "Ingestion failed");
    }
  });
}

