/**
 * Legal Engine Routes
 *
 * Decision endpoint + admin CRUD for legal rules, sources,
 * category mappings, depreciation standards, and evaluations.
 *
 * Route protection:
 *   - Decision: withAuthRequired (any authenticated user)
 *   - Admin: requireOrgViewer (MANAGER or OWNER)
 *   - Mutations: requireOrgViewer with MANAGER check
 */

import { Router, HandlerContext } from "../http/router";
import { sendError, sendJson } from "../http/json";
import { readJson } from "../http/body";
import { first } from "../http/query";
import { requireOrgViewer } from "./helpers";
import {
  RequestNotFoundError,
} from "../services/legalDecisionEngine";
import {
  listRfps,
  getRfpById,
  RfpNotFoundError,
} from "../services/rfps";
import { evaluateLegalRoutingWorkflow } from "../workflows/evaluateLegalRoutingWorkflow";
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
import { LegalSourceStatus, LegalSourceScope } from "@prisma/client";

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

function mapLegalSourceToDTO(source: any): LegalSourceDTO {
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

  // ════════════════════════════════════════════════════════════
  // Admin: Legal Sources
  // ════════════════════════════════════════════════════════════

  router.get("/legal/sources", async ({ req, res, orgId }) => {
    if (!requireOrgViewer(req, res)) return;

    try {
      const sources = await legalSourceRepo.findAll(prisma, orgId);
      sendJson(res, 200, { data: sources.map(mapLegalSourceToDTO) });
    } catch (e: any) {
      console.error("[GET /legal/sources]", e);
      sendError(res, 500, "INTERNAL_ERROR", "Failed to list sources");
    }
  });

  router.post("/legal/sources", async ({ req, res, orgId }) => {
    if (!requireOrgViewer(req, res)) return;

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
    if (!requireOrgViewer(req, res)) return;

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
    if (!requireOrgViewer(req, res)) return;

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
      const variables = await prisma.legalVariable.findMany({
        include: {
          versions: {
            orderBy: { effectiveFrom: "desc" },
            take: 5,
          },
        },
        orderBy: { key: "asc" },
      });
      sendJson(res, 200, { data: variables });
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
      const rules = await prisma.legalRule.findMany({
        include: {
          versions: {
            orderBy: { effectiveFrom: "desc" },
            take: 1,
          },
        },
        orderBy: [{ priority: "desc" }, { key: "asc" }],
      });
      sendJson(res, 200, { data: rules });
    } catch (e: any) {
      console.error("[GET /legal/rules]", e);
      sendError(res, 500, "INTERNAL_ERROR", "Failed to list rules");
    }
  });

  router.post("/legal/rules", async ({ req, res }) => {
    if (!requireOrgViewer(req, res)) return;

    try {
      const body = await readJson(req);
      const parsed = CreateLegalRuleSchema.safeParse(body);
      if (!parsed.success) {
        const msg = parsed.error.issues
          .map((i) => `${i.path.join(".")}: ${i.message}`)
          .join("; ");
        return sendError(res, 400, "VALIDATION_ERROR", msg);
      }

      const {
        dslJson,
        citationsJson,
        summary,
        effectiveFrom,
        ...ruleData
      } = parsed.data;

      const rule = await prisma.legalRule.create({
        data: {
          ...ruleData,
          versions: {
            create: {
              effectiveFrom,
              dslJson: dslJson as any,
              citationsJson: (citationsJson as any) ?? null,
              summary: summary ?? null,
            },
          },
        },
        include: { versions: true },
      });

      sendJson(res, 201, { data: rule });
    } catch (e: any) {
      if (e.code === "P2002") {
        return sendError(res, 409, "CONFLICT", "Rule key already exists");
      }
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
      const mappings = await prisma.legalCategoryMapping.findMany({
        where: {
          OR: [{ orgId }, { orgId: null }],
        },
        orderBy: [{ orgId: "desc" }, { requestCategory: "asc" }],
      });
      sendJson(res, 200, { data: mappings });
    } catch (e: any) {
      console.error("[GET /legal/category-mappings]", e);
      sendError(res, 500, "INTERNAL_ERROR", "Failed to list mappings");
    }
  });

  router.post("/legal/category-mappings", async ({ req, res, orgId }) => {
    if (!requireOrgViewer(req, res)) return;

    try {
      const body = await readJson(req);
      const parsed = CreateCategoryMappingSchema.safeParse(body);
      if (!parsed.success) {
        const msg = parsed.error.issues
          .map((i) => `${i.path.join(".")}: ${i.message}`)
          .join("; ");
        return sendError(res, 400, "VALIDATION_ERROR", msg);
      }

      const mapping = await prisma.legalCategoryMapping.create({
        data: {
          orgId,
          ...parsed.data,
        },
      });
      sendJson(res, 201, { data: mapping });
    } catch (e: any) {
      if (e.code === "P2002") {
        return sendError(
          res,
          409,
          "CONFLICT",
          "Mapping for this category already exists in this org",
        );
      }
      console.error("[POST /legal/category-mappings]", e);
      sendError(res, 500, "INTERNAL_ERROR", "Failed to create mapping");
    }
  });

  router.put("/legal/category-mappings/:id", async ({ req, res, params }) => {
    if (!requireOrgViewer(req, res)) return;

    try {
      const body = await readJson(req);
      const parsed = UpdateCategoryMappingSchema.safeParse(body);
      if (!parsed.success) {
        const msg = parsed.error.issues
          .map((i) => `${i.path.join(".")}: ${i.message}`)
          .join("; ");
        return sendError(res, 400, "VALIDATION_ERROR", msg);
      }

      const existing = await prisma.legalCategoryMapping.findUnique({
        where: { id: params.id },
      });
      if (!existing) {
        return sendError(res, 404, "NOT_FOUND", "Mapping not found");
      }

      const mapping = await prisma.legalCategoryMapping.update({
        where: { id: params.id },
        data: parsed.data,
      });
      sendJson(res, 200, { data: mapping });
    } catch (e: any) {
      console.error("[PUT /legal/category-mappings/:id]", e);
      sendError(res, 500, "INTERNAL_ERROR", "Failed to update mapping");
    }
  });

  router.delete("/legal/category-mappings/:id", async ({ req, res, params }) => {
    if (!requireOrgViewer(req, res)) return;

    try {
      const existing = await prisma.legalCategoryMapping.findUnique({
        where: { id: params.id },
      });
      if (!existing) {
        return sendError(res, 404, "NOT_FOUND", "Mapping not found");
      }

      await prisma.legalCategoryMapping.delete({
        where: { id: params.id },
      });
      sendJson(res, 200, { data: { deleted: true } });
    } catch (e: any) {
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
      // All request categories in use
      const requests = await prisma.request.findMany({
        select: { category: true },
        distinct: ["category"],
      });
      const usedCategories = requests.map((r) => r.category).filter(Boolean) as string[];

      // All mappings (org + global)
      const mappings = await prisma.legalCategoryMapping.findMany({
        where: {
          OR: [{ orgId }, { orgId: null }],
          isActive: true,
        },
        orderBy: [{ orgId: "desc" }, { requestCategory: "asc" }],
      });

      // Keyword map for matching depreciation standards and rules
      const TOPIC_KEYWORDS: Record<string, string[]> = {
        STOVE_COOKTOP: ["STOVE", "COOKTOP", "HOB", "CUISIN", "COOKER"],
        OVEN_APPLIANCE: ["OVEN", "FOUR", "COOKER"],
        DISHWASHER: ["DISHWASHER", "LAVE_VAISSELLE"],
        BATHROOM_PLUMBING: ["BATHROOM", "BATHTUB", "SHOWER", "WC", "TOILET", "BIDET"],
        LIGHTING_ELECTRICAL: ["LIGHT", "SWITCH", "LAMP", "DIMMER"],
        PLUMBING_WATER: ["TAP", "PIPE", "DRAIN", "WATER", "PLUMB", "FAUCET", "SIPHON"],
        GENERAL_MAINTENANCE: [],
      };

      // Get all depreciation standards and rules for counting
      const allDeps = await prisma.depreciationStandard.findMany({
        select: { topic: true, assetType: true, usefulLifeMonths: true },
      });
      const allRules = await prisma.legalRule.findMany({
        where: { key: { startsWith: "CH_RENT_RED" }, isActive: true },
        select: { key: true, id: true },
      });

      // Build coverage for each known category
      const knownCategories = ["stove", "oven", "dishwasher", "bathroom", "lighting", "plumbing", "other"];
      const allCategories = [...new Set([...knownCategories, ...usedCategories])];

      const coverage = allCategories.map((cat) => {
        // Find mapping (org-specific first, then global)
        const orgMapping = mappings.find(
          (m) => m.requestCategory === cat && m.orgId === orgId,
        );
        const globalMapping = mappings.find(
          (m) => m.requestCategory === cat && m.orgId === null,
        );
        const mapping = orgMapping || globalMapping;
        const legalTopic = mapping?.legalTopic || null;
        const scope = orgMapping ? "org" : globalMapping ? "global" : null;

        // Count matching depreciation standards
        const keywords = legalTopic ? (TOPIC_KEYWORDS[legalTopic] || []) : [];
        const depMatches = keywords.length > 0
          ? allDeps.filter((d) =>
              keywords.some((k) => d.topic.toUpperCase().includes(k)),
            )
          : [];

        // Count matching rent reduction rules
        const ruleMatches = keywords.length > 0
          ? allRules.filter((r) =>
              keywords.some((k) => r.key.toUpperCase().includes(k)),
            )
          : [];

        // Build human-readable summaries
        const lifespanMonths = depMatches.map((d) => d.usefulLifeMonths);
        const minLifeYears = lifespanMonths.length > 0 ? Math.round(Math.min(...lifespanMonths) / 12) : null;
        const maxLifeYears = lifespanMonths.length > 0 ? Math.round(Math.max(...lifespanMonths) / 12) : null;

        // Unique readable asset names (e.g. "Bathtub Acrylic" from "BATHTUB_ACRYLIC")
        const readableAssets = [...new Set(depMatches.map((d) =>
          d.topic.replace(/_/g, " ").toLowerCase().replace(/\b\w/g, (c: string) => c.toUpperCase()),
        ))].slice(0, 6);

        // Unique readable rule names
        const readableRules = [...new Set(ruleMatches.map((r) =>
          r.key.replace(/^CH_RENT_RED_/, "").replace(/_/g, " ").toLowerCase().replace(/\b\w/g, (c: string) => c.toUpperCase()),
        ))].slice(0, 5);

        return {
          category: cat,
          mapped: !!mapping,
          legalTopic,
          scope,
          mappingId: mapping?.id || null,
          isActive: mapping?.isActive ?? null,
          depreciationCount: depMatches.length,
          ruleCount: ruleMatches.length,
          depreciationSamples: depMatches.slice(0, 5).map((d) => ({
            topic: d.topic,
            assetType: d.assetType,
            usefulLifeMonths: d.usefulLifeMonths,
          })),
          ruleSamples: ruleMatches.slice(0, 5).map((r) => r.key),
          // Human-friendly summaries for the UI
          lifespanRange: minLifeYears !== null
            ? (minLifeYears === maxLifeYears ? `${minLifeYears} years` : `${minLifeYears}–${maxLifeYears} years`)
            : null,
          readableAssets,
          readableRules,
        };
      });

      sendJson(res, 200, {
        data: coverage,
        summary: {
          totalCategories: allCategories.length,
          mappedCategories: coverage.filter((c) => c.mapped).length,
          unmappedCategories: coverage.filter((c) => !c.mapped).length,
        },
      });
    } catch (e: any) {
      console.error("[GET /legal/category-mappings/coverage]", e);
      sendError(res, 500, "INTERNAL_ERROR", "Failed to compute coverage");
    }
  });

  // ════════════════════════════════════════════════════════════
  // Admin: Depreciation Standards
  // ════════════════════════════════════════════════════════════

  router.get(
    "/legal/depreciation-standards",
    async ({ req, res }) => {
      if (!requireOrgViewer(req, res)) return;

      try {
        const standards = await prisma.depreciationStandard.findMany({
          include: { source: { select: { id: true, name: true } } },
          orderBy: [{ assetType: "asc" }, { topic: "asc" }],
        });
        sendJson(res, 200, { data: standards });
      } catch (e: any) {
        console.error("[GET /legal/depreciation-standards]", e);
        sendError(
          res,
          500,
          "INTERNAL_ERROR",
          "Failed to list depreciation standards",
        );
      }
    },
  );

  router.post(
    "/legal/depreciation-standards",
    async ({ req, res }) => {
      if (!requireOrgViewer(req, res)) return;

      try {
        const body = await readJson(req);
        const parsed = CreateDepreciationStandardSchema.safeParse(body);
        if (!parsed.success) {
          const msg = parsed.error.issues
            .map((i) => `${i.path.join(".")}: ${i.message}`)
            .join("; ");
          return sendError(res, 400, "VALIDATION_ERROR", msg);
        }

        const standard = await prisma.depreciationStandard.create({
          data: parsed.data,
        });
        sendJson(res, 201, { data: standard });
      } catch (e: any) {
        if (e.code === "P2002") {
          return sendError(
            res,
            409,
            "CONFLICT",
            "Depreciation standard for this asset/topic/jurisdiction already exists",
          );
        }
        console.error("[POST /legal/depreciation-standards]", e);
        sendError(
          res,
          500,
          "INTERNAL_ERROR",
          "Failed to create depreciation standard",
        );
      }
    },
  );

  // ════════════════════════════════════════════════════════════
  // Admin: Evaluation Logs
  // ════════════════════════════════════════════════════════════

  router.get("/legal/evaluations", async ({ req, res, query, orgId }) => {
    if (!requireOrgViewer(req, res)) return;

    const limit = Math.min(100, Math.max(1, parseInt(first(query, "limit") ?? "20", 10)));
    const offset = Math.max(0, parseInt(first(query, "offset") ?? "0", 10));
    const obligationFilter = first(query, "obligation");
    const categoryFilter = first(query, "category");
    const requestIdFilter = first(query, "requestId");

    try {
      const where: any = { orgId };
      if (requestIdFilter) where.requestId = requestIdFilter;

      const [rows, total] = await Promise.all([
        prisma.legalEvaluationLog.findMany({
          where,
          orderBy: { createdAt: "desc" },
          take: limit,
          skip: offset,
        }),
        prisma.legalEvaluationLog.count({ where }),
      ]);

      // Flatten contextJson + resultJson into top-level fields
      const data = rows
        .map((row: any) => {
          const ctx = (row.contextJson ?? {}) as Record<string, any>;
          const res = (row.resultJson ?? {}) as Record<string, any>;
          return {
            id: row.id,
            requestId: row.requestId,
            buildingId: row.buildingId,
            unitId: row.unitId,
            createdAt: row.createdAt,
            // from contextJson
            category: ctx.category ?? null,
            canton: ctx.canton ?? null,
            legalTopic: res.legalTopic ?? ctx.legalTopic ?? null,
            // from resultJson
            obligation: res.obligation ?? null,
            confidence: typeof res.confidence === "number" ? res.confidence / 100 : 0,
            reasons: Array.isArray(res.reasons) ? res.reasons : [],
            citations: deduplicateCitations(Array.isArray(res.citations) ? res.citations : []),
            recommendedActions: Array.isArray(res.recommendedActions) ? res.recommendedActions : [],
            depreciationSignal: res.depreciationSignal ?? null,
            matchedRuleCount: res.matchedRuleCount ?? 0,
          };
        })
        .filter((ev: any) => {
          if (obligationFilter && ev.obligation !== obligationFilter) return false;
          if (categoryFilter && ev.category !== categoryFilter) return false;
          return true;
        });

      sendJson(res, 200, { data, total });
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
      const where: any = { orgId, isActive: true };
      if (unitId) where.unitId = unitId;

      const [rows, total] = await Promise.all([
        prisma.asset.findMany({
          where,
          include: {
            unit: { select: { id: true, unitNumber: true, buildingId: true } },
          },
          orderBy: { createdAt: "desc" },
          take: limit,
          skip: offset,
        }),
        prisma.asset.count({ where }),
      ]);
      sendJson(res, 200, { data: rows, total });
    } catch (e: any) {
      console.error("[GET /assets]", e);
      sendError(res, 500, "INTERNAL_ERROR", "Failed to list assets");
    }
  });

  router.post("/assets", async ({ req, res, orgId }) => {
    if (!requireOrgViewer(req, res)) return;

    try {
      const body = await readJson(req);
      const parsed = CreateAssetSchema.safeParse(body);
      if (!parsed.success) {
        const msg = parsed.error.issues
          .map((i) => `${i.path.join(".")}: ${i.message}`)
          .join("; ");
        return sendError(res, 400, "VALIDATION_ERROR", msg);
      }

      const asset = await prisma.asset.create({
        data: {
          orgId,
          ...parsed.data,
        },
      });
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
    if (!requireOrgViewer(req, res)) return;

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

// ════════════════════════════════════════════════════════════
// Helpers
// ════════════════════════════════════════════════════════════

function deduplicateCitations(
  citations: Array<{ article?: string; text?: string; authority?: string }>,
): Array<{ article: string; text: string; authority: string }> {
  const seen = new Set<string>();
  const result: Array<{ article: string; text: string; authority: string }> = [];
  for (const c of citations) {
    const key = `${c.article || ""}|${c.text || ""}|${c.authority || ""}`;
    if (!seen.has(key)) {
      seen.add(key);
      result.push({
        article: c.article || "",
        text: c.text || "",
        authority: c.authority || "",
      });
    }
  }
  return result;
}
