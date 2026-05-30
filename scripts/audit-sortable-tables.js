#!/usr/bin/env node
/**
 * audit-sortable-tables.js
 *
 * Finds every wide-table <th> that is NOT a SortableHeader in pages/
 * so you can fix all sortable columns in one pass.
 *
 * Usage:
 *   node scripts/audit-sortable-tables.js
 *   node scripts/audit-sortable-tables.js --details   # show th text too
 *
 * Exit 0 always (informational only — not a hard gate).
 */

const fs = require("fs");
const path = require("path");
const showDetails = process.argv.includes("--details");

const PAGES_DIR = path.join(__dirname, "../apps/web/pages");

function walk(dir) {
  const entries = fs.readdirSync(dir, { withFileTypes: true });
  const files = [];
  for (const e of entries) {
    const full = path.join(dir, e.name);
    if (e.isDirectory()) files.push(...walk(full));
    else if (e.name.endsWith(".js")) files.push(full);
  }
  return files;
}

const files = walk(PAGES_DIR);

// Per-file results
const issues = [];   // { file, table, unsortedTh, sortedTh, arrays }
const clean  = [];

for (const file of files) {
  const src = fs.readFileSync(file, "utf8");

  // Only care about files that have a data-table or ConfigurableTable
  const hasTable = src.includes("data-table") || src.includes("ConfigurableTable");
  if (!hasTable) continue;

  // Skip files that are entirely exempt (e.g. pure ledger/accounting display tables)
  if (src.includes("sortable-audit-exempt")) continue;

  const rel = path.relative(process.cwd(), file);

  // Count SortableHeader usages
  const sortableCount = (src.match(/<SortableHeader/g) || []).length;

  // Count plain <th> (not in SortableHeader, not empty, not colspan)
  // We look for <th> that are NOT immediately preceded by SortableHeader on the same line
  const lines = src.split("\n");
  const unsortedThs = [];
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    if (/<th[^>]*>/.test(line) && !/<th[^>]*><\/th>/.test(line) && !line.includes("SortableHeader")) {
      // Skip empty th, colSpan th (action columns)
      const content = line.replace(/<th[^>]*>/, "").replace(/<\/th>/, "").trim();
      if (content && !content.startsWith("{") && !/colSpan/.test(line)) {
        unsortedThs.push({ lineNo: i + 1, text: content });
      }
    }
  }

  // Detect whether .map() arrays match between mobile cards and wide table
  const mapMatches = src.match(/\{([a-zA-Z_$][a-zA-Z0-9_$]*)\.(?:slice\([^)]+\)\.)?map\(/g) || [];
  const mapArrays = [...new Set(mapMatches.map(m => m.replace(/\{/, "").replace(/\.(?:slice.*)?\.?map\(/, "")))];

  if (unsortedThs.length > 0) {
    issues.push({ file: rel, unsortedThs, sortableCount, mapArrays });
  } else {
    clean.push(rel);
  }
}

// ── Output ──────────────────────────────────────────────────────────────────

if (issues.length === 0) {
  console.log("✅  All tables have SortableHeaders on all non-action columns.");
  process.exit(0);
}

console.log(`\n⚠️  ${issues.length} file(s) have plain <th> columns that could be sortable:\n`);

for (const { file, unsortedThs, sortableCount, mapArrays } of issues) {
  console.log(`  📄 ${file}  (${sortableCount} SortableHeader already)`);
  if (showDetails) {
    for (const { lineNo, text } of unsortedThs) {
      console.log(`       L${lineNo}: <th>${text}</th>`);
    }
    if (mapArrays.length > 1) {
      console.log(`       ⚠  Multiple .map() arrays — check mobile+wide lists use same sorted var: [${mapArrays.join(", ")}]`);
    }
  } else {
    console.log(`       ${unsortedThs.length} unsorted th(s): ${unsortedThs.map(t => `"${t.text}"`).join(", ")}`);
  }
}

console.log(`\nRun with --details for line numbers.\n`);
