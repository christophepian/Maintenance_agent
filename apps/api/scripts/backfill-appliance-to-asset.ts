/**
 * Phase 2 Backfill: Appliance → Asset Migration
 *
 * Creates Asset records for every legacy Appliance row and populates
 * Request.assetId for requests that reference those appliances.
 *
 * Idempotency guarantee:
 *   Asset.legacyApplianceId (unique) stores the source Appliance.id.
 *   Before creating an Asset, the script checks if one already exists
 *   with that legacyApplianceId. If so, it skips creation and reuses
 *   the existing Asset for request linking.
 *
 * Usage:
 *   npx tsx scripts/backfill-appliance-to-asset.ts              # live run
 *   npx tsx scripts/backfill-appliance-to-asset.ts --dry-run     # preview only
 *
 * Safe to re-run any number of times.
 */

import { PrismaClient, AssetType, AssetCategory } from "@prisma/client";

const DRY_RUN = process.argv.includes("--dry-run");

const prisma = new PrismaClient();

// ── Topic derivation ───────────────────────────────────────────

function normalizeTopicKey(topic: string): string {
  return topic
    .trim()
    .replace(/[\s]+/g, "_")
    .replace(/-/g, "_")
    .toUpperCase();
}

/**
 * Derive a topic key for the Asset.
 *
 * Priority:
 *   1. AssetModel.category (if linked) — this is the canonical product category
 *      e.g. "Dishwasher", "Refrigerator". Normalize to UPPER_SNAKE.
 *   2. Appliance.name — fallback when no model is linked.
 *      Normalize to UPPER_SNAKE.
 *
 * Returns { topic, source, ambiguous }.
 * ambiguous=true when falling back to name-based derivation,
 * since names can be freeform and may not match depreciation standards.
 */
function deriveTopic(
  applianceName: string,
  assetModelCategory: string | null | undefined,
): { topic: string; source: string; ambiguous: boolean } {
  if (assetModelCategory && assetModelCategory.trim().length > 0) {
    return {
      topic: normalizeTopicKey(assetModelCategory),
      source: "assetModel.category",
      ambiguous: false,
    };
  }
  return {
    topic: normalizeTopicKey(applianceName),
    source: "appliance.name",
    ambiguous: true,
  };
}

// ── Main ───────────────────────────────────────────────────────

async function main() {
  console.log(`\n🔄 Phase 2 Backfill: Appliance → Asset`);
  console.log(`   Mode: ${DRY_RUN ? "DRY RUN (no writes)" : "LIVE"}\n`);

  // 1. Load all appliances with their asset models
  const appliances = await prisma.appliance.findMany({
    include: { assetModel: true },
    orderBy: { createdAt: "asc" },
  });

  console.log(`📦 Appliances scanned: ${appliances.length}`);

  // 2. Load existing mapping (Assets that already have legacyApplianceId)
  const existingAssets = await prisma.asset.findMany({
    where: { legacyApplianceId: { not: null } },
    select: { id: true, legacyApplianceId: true },
  });
  const existingMap = new Map(
    existingAssets.map((a) => [a.legacyApplianceId!, a.id]),
  );
  console.log(`📎 Already-backfilled Assets: ${existingMap.size}`);

  // 3. Process each appliance
  let created = 0;
  let skipped = 0;
  const ambiguousTopics: { applianceId: string; name: string; topic: string }[] = [];
  // applianceId → assetId mapping for request linking
  const mapping = new Map<string, string>();

  for (const app of appliances) {
    // Already backfilled?
    if (existingMap.has(app.id)) {
      mapping.set(app.id, existingMap.get(app.id)!);
      skipped++;
      continue;
    }

    const { topic, source, ambiguous } = deriveTopic(
      app.name,
      app.assetModel?.category,
    );

    if (ambiguous) {
      ambiguousTopics.push({ applianceId: app.id, name: app.name, topic });
    }

    if (DRY_RUN) {
      console.log(
        `  [DRY] Would create Asset for Appliance ${app.id} ` +
        `(name="${app.name}", topic=${topic}, src=${source})`,
      );
      created++;
      continue;
    }

    const asset = await prisma.asset.create({
      data: {
        orgId: app.orgId,
        unitId: app.unitId,
        type: AssetType.APPLIANCE,
        category: AssetCategory.EQUIPMENT,
        topic,
        name: app.name,
        assetModelId: app.assetModelId ?? undefined,
        serialNumber: app.serial ?? undefined,
        installedAt: app.installDate ?? undefined,
        notes: app.notes ?? undefined,
        isActive: app.isActive,
        brand: app.assetModel?.manufacturer ?? undefined,
        modelNumber: app.assetModel?.model ?? undefined,
        legacyApplianceId: app.id,
      },
    });

    mapping.set(app.id, asset.id);
    created++;
  }

  // 4. Link Requests: set assetId where applianceId is set but assetId is null
  const requestsToUpdate = await prisma.request.findMany({
    where: {
      applianceId: { not: null },
      assetId: null,
    },
    select: { id: true, applianceId: true },
  });

  let requestsUpdated = 0;
  let requestsSkippedNoMapping = 0;

  for (const req of requestsToUpdate) {
    const assetId = mapping.get(req.applianceId!);
    if (!assetId) {
      // This shouldn't happen if all appliances were processed,
      // but guard against it
      requestsSkippedNoMapping++;
      console.warn(
        `  ⚠️  Request ${req.id} has applianceId=${req.applianceId} but no Asset mapping found`,
      );
      continue;
    }

    if (DRY_RUN) {
      console.log(
        `  [DRY] Would set Request ${req.id} assetId=${assetId}`,
      );
      requestsUpdated++;
      continue;
    }

    await prisma.request.update({
      where: { id: req.id },
      data: { assetId },
    });
    requestsUpdated++;
  }

  // 5. Summary
  console.log(`\n${"═".repeat(50)}`);
  console.log(`  BACKFILL SUMMARY ${DRY_RUN ? "(DRY RUN)" : "(LIVE)"}`);
  console.log(`${"═".repeat(50)}`);
  console.log(`  Appliances scanned:          ${appliances.length}`);
  console.log(`  Assets created:              ${created}`);
  console.log(`  Assets skipped (existing):   ${skipped}`);
  console.log(`  Requests updated (assetId):  ${requestsUpdated}`);
  if (requestsSkippedNoMapping > 0) {
    console.log(`  Requests skipped (no map):   ${requestsSkippedNoMapping}`);
  }
  console.log(`  Ambiguous topic derivations: ${ambiguousTopics.length}`);

  if (ambiguousTopics.length > 0) {
    console.log(`\n⚠️  AMBIGUOUS TOPICS (derived from appliance name, not model category):`);
    console.log(`   These may not match depreciation standards. Review and correct if needed.`);
    for (const a of ambiguousTopics) {
      console.log(`   - Appliance ${a.applianceId}: "${a.name}" → topic="${a.topic}"`);
    }
  }

  console.log(`\n✅ Done.\n`);
}

main()
  .catch((e) => {
    console.error("❌ Backfill failed:", e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
