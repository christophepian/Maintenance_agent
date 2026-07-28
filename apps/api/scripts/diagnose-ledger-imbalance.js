/**
 * Diagnose (and optionally repair) a building's ledger trial-balance imbalance.
 *
 * A non-zero trial balance means UNBALANCED journal entries were posted — almost
 * always an imported opening balance that didn't tie out, and/or entries orphaned
 * by a past delete/re-import (before the sourceType-cleanup fix). This decomposes
 * the imbalance by source statement, flags entries whose statement no longer
 * exists (orphans), and can sweep those orphans.
 *
 * Usage (run from apps/api, with DATABASE_URL pointing at the target DB):
 *   node scripts/diagnose-ledger-imbalance.js <buildingId>                # read-only
 *   node scripts/diagnose-ledger-imbalance.js <buildingId> --fix-orphans  # + delete orphans
 *
 * READ-ONLY by default. --fix-orphans only deletes import-sourced entries whose
 * ImportedStatement no longer exists (safe — nothing owns them). Entries from a
 * still-existing statement are NOT touched — correct those by editing/re-importing
 * that statement in Finance → Imports.
 */
const { PrismaClient } = require("@prisma/client");
const p = new PrismaClient();

const buildingId = process.argv[2];
const doFix = process.argv.includes("--fix-orphans");
const IMPORT_TYPES = ["BALANCE_SHEET_IMPORT", "INCOME_STATEMENT_IMPORT", "IMPORTED_STATEMENT"];
const chf = (c) => (c / 100).toLocaleString("de-CH", { minimumFractionDigits: 2 });
const sum = (arr, f) => arr.reduce((s, e) => s + f(e), 0);

(async () => {
  if (!buildingId) {
    console.error("Usage: node scripts/diagnose-ledger-imbalance.js <buildingId> [--fix-orphans]");
    process.exit(1);
  }
  const b = await p.building.findUnique({ where: { id: buildingId }, select: { id: true, name: true, orgId: true } });
  if (!b) { console.error("Building not found:", buildingId); process.exit(1); }
  console.log(`\nBuilding: ${b.name || "(unnamed)"}  ${b.id}\n`);

  const where = { orgId: b.orgId, buildingId };
  const all = await p.ledgerEntry.findMany({ where, select: { debitCents: true, creditCents: true, sourceType: true, sourceId: true } });
  const tb = sum(all, (e) => e.debitCents - e.creditCents);
  console.log(`Total ledger entries: ${all.length}`);
  console.log(`Trial balance (Σdebit − Σcredit): CHF ${chf(tb)}   ${Math.abs(tb) <= 1 ? "✓ balanced" : "⛔ OUT OF BALANCE"}\n`);

  // Imbalance contribution by sourceType — a balanced source nets to 0.
  const bySource = {};
  for (const e of all) {
    const k = e.sourceType || "(none)";
    (bySource[k] ??= { n: 0, imb: 0 });
    bySource[k].n++; bySource[k].imb += e.debitCents - e.creditCents;
  }
  console.log("By sourceType (imbalance contribution):");
  for (const [k, v] of Object.entries(bySource).sort((a, b) => Math.abs(b[1].imb) - Math.abs(a[1].imb))) {
    console.log(`  ${k.padEnd(24)} entries=${String(v.n).padStart(5)}   imbalance=CHF ${chf(v.imb)}`);
  }

  // Import entries: is the source statement still present?
  const imp = all.filter((e) => IMPORT_TYPES.includes(e.sourceType) && e.sourceId);
  const sourceIds = [...new Set(imp.map((e) => e.sourceId))];
  const existing = new Set((await p.importedStatement.findMany({ where: { id: { in: sourceIds } }, select: { id: true } })).map((s) => s.id));
  const bySid = {};
  for (const e of imp) {
    const k = e.sourceId;
    (bySid[k] ??= { n: 0, imb: 0, orphan: !existing.has(k) });
    bySid[k].n++; bySid[k].imb += e.debitCents - e.creditCents;
  }
  const orphanSids = Object.entries(bySid).filter(([, v]) => v.orphan).map(([sid]) => sid);
  console.log(`\nImport-sourced statements posting to this ledger: ${sourceIds.length} (${orphanSids.length} ORPHANED — statement no longer exists)`);
  for (const [sid, v] of Object.entries(bySid).sort((a, b) => Math.abs(b[1].imb) - Math.abs(a[1].imb))) {
    console.log(`  ${v.orphan ? "ORPHAN" : "live  "}  ${sid.slice(0, 8)}   entries=${String(v.n).padStart(4)}   imbalance=CHF ${chf(v.imb)}`);
  }
  const orphanImb = sum(imp.filter((e) => !existing.has(e.sourceId)), (e) => e.debitCents - e.creditCents);
  const orphanCount = imp.filter((e) => !existing.has(e.sourceId)).length;
  console.log(`\nOrphaned entries: ${orphanCount}   imbalance from orphans: CHF ${chf(orphanImb)}`);
  console.log(`Imbalance from still-existing statements: CHF ${chf(tb - orphanImb)} (fix by correcting those statements in Finance → Imports)`);

  if (doFix && orphanSids.length > 0) {
    const res = await p.ledgerEntry.deleteMany({ where: { ...where, sourceType: { in: IMPORT_TYPES }, sourceId: { in: orphanSids } } });
    const after = await p.ledgerEntry.findMany({ where, select: { debitCents: true, creditCents: true } });
    console.log(`\n🧹 Deleted ${res.count} orphaned import ledger entries.`);
    console.log(`New trial balance: CHF ${chf(sum(after, (e) => e.debitCents - e.creditCents))}`);
  } else if (!doFix && orphanCount > 0) {
    console.log("\n(Dry run — re-run with --fix-orphans to delete the ORPHAN entries above.)");
  }

  await p.$disconnect();
})().catch(async (e) => { console.error(e); await p.$disconnect(); process.exit(1); });
