/**
 * buildingStrategyResolver — pure resolution of a building's effective strategy mandate.
 *
 * Precedence (mirrors the cashflow-plan NPV path):
 *   1. Explicit BuildingStrategyProfile → source "building" (authoritative).
 *   2. No building profile → the building owners' portfolio profiles → source "owner-portfolio"
 *      (a default, flagged as such). The effective archetype/dims default to the first owner's
 *      profile; callers that need the full set (e.g. verdict reconciliation) get `ownerProfiles`.
 *   3. No profiles at all → source "none".
 *
 * Pure: takes already-fetched repository shapes (no Prisma) so it stays G20-clean and unit-testable.
 * The DB reads live in the route via strategyProfileRepository.
 */

export type StrategySourceKind = "building" | "owner-portfolio" | "none";

export interface ResolvedOwnerProfile {
  archetype: string | null;
  dims: Record<string, number> | null;
  goalLabel: string | null;
}

export interface ResolvedBuildingStrategy {
  hasProfile: boolean;
  source: StrategySourceKind;
  /** Effective archetype used to rank & frame the agenda (the mandate switcher can override). */
  archetype: string | null;
  roleIntent: string | null;
  /** Effective 0–100 dimension vector for ranking. */
  dims: Record<string, number> | null;
  /** owner-portfolio only: number of owner profiles considered. */
  ownerProfileCount?: number;
  /** owner-portfolio only: each owner's resolved profile, for verdict reconciliation. */
  ownerProfiles?: ResolvedOwnerProfile[];
}

/** Minimal shapes the resolver reads — a subset of the repo payloads. */
export interface BuildingProfileInput {
  primaryArchetype: string | null;
  roleIntent: string | null;
  effectiveDimensionsJson: string;
}
export interface OwnerProfileInput {
  primaryArchetype: string | null;
  dimensionsJson: string;
  userFacingGoalLabel: string | null;
}

function parseDims(json: string | null | undefined): Record<string, number> | null {
  if (!json) return null;
  try {
    const parsed = JSON.parse(json);
    return parsed && typeof parsed === "object" ? (parsed as Record<string, number>) : null;
  } catch {
    return null;
  }
}

export function resolveBuildingStrategy(
  buildingProfile: BuildingProfileInput | null,
  ownerProfiles: OwnerProfileInput[],
): ResolvedBuildingStrategy {
  // 1. Explicit building profile wins.
  if (buildingProfile) {
    return {
      hasProfile: true,
      source: "building",
      archetype: buildingProfile.primaryArchetype ?? null,
      roleIntent: buildingProfile.roleIntent ?? null,
      dims: parseDims(buildingProfile.effectiveDimensionsJson),
    };
  }

  // 2. Owner-portfolio fallback.
  const resolved: ResolvedOwnerProfile[] = ownerProfiles.map((p) => ({
    archetype: p.primaryArchetype ?? null,
    dims: parseDims(p.dimensionsJson),
    goalLabel: p.userFacingGoalLabel ?? null,
  }));

  if (resolved.length === 0) {
    return { hasProfile: false, source: "none", archetype: null, roleIntent: null, dims: null };
  }

  // Effective default = the first owner's profile; the mandate switcher lets the user
  // explore the others, and callers can reconcile across `ownerProfiles` for the verdict.
  return {
    hasProfile: true,
    source: "owner-portfolio",
    archetype: resolved[0].archetype,
    roleIntent: null,
    dims: resolved[0].dims,
    ownerProfileCount: resolved.length,
    ownerProfiles: resolved,
  };
}
