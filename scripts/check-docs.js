#!/usr/bin/env node
/**
 * Documentation Consistency Checker
 *
 * Lightweight safeguard against doc drift. Run manually or in CI:
 *   node scripts/check-docs.js
 *
 * Checks:
 *  1. All core docs route to PROJECT_OVERVIEW.md as first-read
 *  2. copilot-instructions.md does NOT describe PROJECT_STATE.md as epic history
 *  3. "Do NOT" / "What NOT To Do" sections have matching item counts
 *  4. No broken relative links in scoped docs
 *  5. Repeated counts (models, enums, migrations) are consistent across files
 */

const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
let failures = 0;
let passes = 0;

function pass(msg) { passes++; console.log(`  ✅ ${msg}`); }
function fail(msg) { failures++; console.error(`  ❌ ${msg}`); }

function readDoc(relPath) {
  const full = path.join(ROOT, relPath);
  if (!fs.existsSync(full)) { fail(`File not found: ${relPath}`); return null; }
  return fs.readFileSync(full, 'utf8');
}

// ── Check 1: Routing — all docs point to PROJECT_OVERVIEW.md as first-read ──
console.log('\n🔍 Check 1: Routing to PROJECT_OVERVIEW.md');

const routingFiles = {
  'PROJECT_STATE.md': /start with.*PROJECT_OVERVIEW\.md/i,
  '.github/copilot-instructions.md': /PROJECT_OVERVIEW\.md.*(?:first|guardrails|default first-read|essential)/i,
  'CONTRIBUTING.md': /PROJECT_OVERVIEW\.md/i,
};

for (const [file, pattern] of Object.entries(routingFiles)) {
  const content = readDoc(file);
  if (!content) continue;
  if (pattern.test(content)) {
    pass(`${file} routes to PROJECT_OVERVIEW.md`);
  } else {
    fail(`${file} does NOT route to PROJECT_OVERVIEW.md`);
  }
}

// PROJECT_OVERVIEW.md itself must declare "Read this first"
const overview = readDoc('PROJECT_OVERVIEW.md');
if (overview) {
  if (/read this first/i.test(overview)) {
    pass('PROJECT_OVERVIEW.md declares "Read this first"');
  } else {
    fail('PROJECT_OVERVIEW.md missing "Read this first" declaration');
  }
}

// ── Check 2: copilot-instructions.md must NOT call PROJECT_STATE.md "epic history" ──
console.log('\n🔍 Check 2: No stale epic-history reference in copilot-instructions.md');

const copilot = readDoc('.github/copilot-instructions.md');
if (copilot) {
  // Must not say PROJECT_STATE.md has "epic history" (epics are in EPIC_HISTORY.md)
  if (/PROJECT_STATE\.md.*epic history/i.test(copilot)) {
    fail('copilot-instructions.md describes PROJECT_STATE.md as containing epic history');
  } else {
    pass('copilot-instructions.md does not call PROJECT_STATE.md epic history');
  }
}

// ── Check 3: "Do NOT" section alignment ──
console.log('\n🔍 Check 3: "Do NOT" section alignment');

function countDoNotItems(content, label) {
  // Match lines starting with "- " after a "Do NOT" or "What NOT To Do" heading
  const sectionMatch = content.match(/## (?:Do NOT|What NOT To Do)\s*\n([\s\S]*?)(?=\n---|\n## |\n$)/);
  if (!sectionMatch) return null;
  const items = sectionMatch[1].match(/^- /gm);
  return items ? items.length : 0;
}

if (overview && copilot) {
  const overviewCount = countDoNotItems(overview, 'PROJECT_OVERVIEW.md');
  const copilotCount = countDoNotItems(copilot, 'copilot-instructions.md');

  if (overviewCount === null) {
    fail('PROJECT_OVERVIEW.md: could not find "Do NOT" section');
  } else if (copilotCount === null) {
    fail('copilot-instructions.md: could not find "What NOT To Do" section');
  } else if (overviewCount === copilotCount) {
    pass(`"Do NOT" sections aligned: ${overviewCount} items each`);
  } else {
    fail(`"Do NOT" count mismatch: PROJECT_OVERVIEW.md has ${overviewCount}, copilot-instructions.md has ${copilotCount}`);
  }
}

// ── Check 4: Broken relative links ──
console.log('\n🔍 Check 4: Relative links');

const SCOPED_FILES = [
  'PROJECT_OVERVIEW.md',
  'PROJECT_STATE.md',
  'EPIC_HISTORY.md',
  'SCHEMA_REFERENCE.md',
  'CONTRIBUTING.md',
  '.github/copilot-instructions.md',
];

for (const file of SCOPED_FILES) {
  const content = readDoc(file);
  if (!content) continue;

  // Extract markdown links: [text](path) — skip http/https/mailto/#anchors
  const linkPattern = /\[([^\]]*)\]\(([^)]+)\)/g;
  let match;
  let fileOk = true;
  const fileDir = path.dirname(path.join(ROOT, file));

  while ((match = linkPattern.exec(content)) !== null) {
    let target = match[2];
    // Skip external URLs, anchors, mailto
    if (/^(https?:|mailto:|#)/.test(target)) continue;
    // Strip anchor from path
    target = target.split('#')[0];
    if (!target) continue;

    // Resolve relative to the file's directory
    const resolved = path.resolve(fileDir, target);
    if (!fs.existsSync(resolved)) {
      fail(`${file}: broken link → ${match[2]}`);
      fileOk = false;
    }
  }
  if (fileOk) pass(`${file}: all links valid`);
}

// ── Check 5: Count consistency ──
console.log('\n🔍 Check 5: Count consistency');

const countPatterns = {
  models: /(\d+)\s*models/gi,
  enums: /(\d+)\s*enums/gi,
  migrations: /(\d+)\s*migrations/gi,
};

// Exclude EPIC_HISTORY.md — it contains historical counts that are correct for their era
const COUNT_CHECK_FILES = SCOPED_FILES.filter(f => f !== 'EPIC_HISTORY.md');

for (const [metric, pattern] of Object.entries(countPatterns)) {
  const values = new Map(); // file → Set of values found

  for (const file of COUNT_CHECK_FILES) {
    const content = readDoc(file);
    if (!content) continue;

    let m;
    const regex = new RegExp(pattern.source, pattern.flags);
    while ((m = regex.exec(content)) !== null) {
      const num = parseInt(m[1], 10);
      if (!values.has(file)) values.set(file, new Set());
      values.get(file).add(num);
    }
  }

  // Collect all unique values across files
  const allValues = new Set();
  for (const nums of values.values()) {
    for (const n of nums) allValues.add(n);
  }

  if (allValues.size === 0) {
    // Not mentioned — fine
  } else if (allValues.size === 1) {
    pass(`${metric}: consistent (${[...allValues][0]}) across ${values.size} files`);
  } else {
    const details = [...values.entries()]
      .map(([f, nums]) => `${f}=[${[...nums].join(',')}]`)
      .join(', ');
    fail(`${metric}: inconsistent values — ${details}`);
  }
}

// ── Summary ──
console.log(`\n${'─'.repeat(50)}`);
console.log(`  ${passes} passed, ${failures} failed`);
if (failures > 0) {
  console.log('  ❌ Documentation consistency check FAILED');
  process.exit(1);
} else {
  console.log('  ✅ Documentation consistency check PASSED');
  process.exit(0);
}
