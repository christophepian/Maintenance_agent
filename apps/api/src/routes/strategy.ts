/**
 * strategy routes
 *
 * Thin HTTP handlers for strategy profile endpoints.
 *
 * Endpoints:
 *   POST /strategy/owner-profile          — create/update owner strategy profile
 *   GET  /strategy/owner-profile/:ownerId — get owner strategy profile
 *   POST /strategy/building-profile       — create/update building strategy profile
 *   GET  /strategy/building-profile/:buildingId — get building strategy profile
 */

import { Router } from "../http/router";
import { sendJson, sendError } from "../http/json";
import { readJson } from "../http/body";
import { requireRole, maybeRequireManager, getAuthUser } from "../authz";
import {
  createOwnerProfileWorkflow,
  updateOwnerProfileWorkflow,
  createBuildingProfileWorkflow,
} from "../workflows/strategyProfileWorkflow";
import {
  getOwnerProfileByOwnerId,
  getBuildingProfileByBuildingId,
} from "../repositories/strategyProfileRepository";
import { createBuilding } from "../repositories/inventoryRepository";
import {
  OwnerProfileDTO,
  BuildingProfileDTO,
} from "../services/strategyProfileService";

export function registerStrategyRoutes(router: Router) {
  // ── POST /strategy/owner-profile ─────────────────────────────
  router.post("/strategy/owner-profile", async ({ req, res, orgId, prisma }) => {
    const user = requireRole(req, res, "OWNER");
    if (!user) return;

    const body = await readJson(req);
    if (!body || !body.answers) {
      sendError(res, 400, "BAD_REQUEST", "Missing answers in request body");
      return;
    }

    const ownerId = body.ownerId || user.userId;

    try {
      const result = await createOwnerProfileWorkflow(
        { orgId, prisma, actorUserId: user.userId },
        { ownerId, answers: body.answers },
      );
      sendJson(res, 200, { profile: result.profile });
    } catch (err: any) {
      sendError(res, 400, "BAD_REQUEST", err.message);
    }
  });

  // ── GET /strategy/owner-profile/:ownerId ─────────────────────
  router.get("/strategy/owner-profile/:ownerId", async ({ req, res, orgId, prisma, params }) => {
    if (!maybeRequireManager(req, res)) {
      // Also allow OWNER to read own profile
      const user = getAuthUser(req);
      if (!user || user.userId !== params.ownerId) return;
    }

    const profile = await getOwnerProfileByOwnerId(prisma, params.ownerId, orgId);
    if (!profile) {
      sendJson(res, 200, { profile: null });
      return;
    }

    // Map to DTO
    const dto: OwnerProfileDTO = {
      id: profile.id,
      ownerId: profile.ownerId,
      primaryArchetype: profile.primaryArchetype,
      secondaryArchetype: profile.secondaryArchetype ?? undefined,
      confidence: profile.confidence,
      userFacingGoalLabel: profile.userFacingGoalLabel,
      dimensions: JSON.parse(profile.dimensionsJson),
      archetypeScores: JSON.parse(profile.archetypeScoresJson),
      contradictionScore: profile.contradictionScore,
      createdAt: profile.createdAt.toISOString(),
      updatedAt: profile.updatedAt.toISOString(),
    };

    sendJson(res, 200, { profile: dto });
  });

  // ── POST /strategy/building-profile ──────────────────────────
  router.post("/strategy/building-profile", async ({ req, res, orgId, prisma }) => {
    const user = requireRole(req, res, "OWNER");
    if (!user) return;

    const body = await readJson(req);
    if (!body || !body.ownerProfileId) {
      sendError(res, 400, "BAD_REQUEST", "Missing ownerProfileId");
      return;
    }

    // Allow inline building creation: { building: { name, address } }
    let buildingId = body.buildingId;
    if (!buildingId && body.building) {
      if (!body.building.name) {
        sendError(res, 400, "BAD_REQUEST", "Building name is required");
        return;
      }
      const created = await createBuilding(prisma, orgId, {
        name: body.building.name,
        address: body.building.address || "",
      });
      buildingId = created.id;
    }
    if (!buildingId) {
      sendError(res, 400, "BAD_REQUEST", "Provide buildingId or building object");
      return;
    }

    try {
      const result = await createBuildingProfileWorkflow(
        { orgId, prisma, actorUserId: user.userId },
        {
          buildingId,
          ownerProfileId: body.ownerProfileId,
          roleIntent: body.roleIntent || "unspecified",
          buildingType: body.buildingType,
          approxUnits: body.approxUnits,
          conditionRating: body.conditionRating,
        },
      );
      sendJson(res, 200, { profile: result.profile });
    } catch (err: any) {
      sendError(res, 400, "BAD_REQUEST", err.message);
    }
  });

  // ── GET /strategy/building-profile/:buildingId ───────────────
  router.get("/strategy/building-profile/:buildingId", async ({ req, res, orgId, prisma, params }) => {
    if (!maybeRequireManager(req, res)) return;

    const profile = await getBuildingProfileByBuildingId(prisma, params.buildingId, orgId);
    if (!profile) {
      sendJson(res, 200, { profile: null });
      return;
    }

    const dto: BuildingProfileDTO = {
      id: profile.id,
      buildingId: profile.buildingId,
      ownerProfileId: profile.ownerProfileId,
      primaryArchetype: profile.primaryArchetype,
      secondaryArchetype: profile.secondaryArchetype ?? undefined,
      confidence: profile.confidence,
      roleIntent: profile.roleIntent,
      buildingType: profile.buildingType,
      approxUnits: profile.approxUnits,
      conditionRating: profile.conditionRating,
      effectiveDimensions: JSON.parse(profile.effectiveDimensionsJson),
      archetypeScores: JSON.parse(profile.archetypeScoresJson),
      building: profile.building ? { id: profile.building.id, name: profile.building.name, yearBuilt: profile.building.yearBuilt } : undefined,
      createdAt: profile.createdAt.toISOString(),
      updatedAt: profile.updatedAt.toISOString(),
    };

    sendJson(res, 200, { profile: dto });
  });
}
