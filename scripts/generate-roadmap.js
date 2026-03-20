#!/usr/bin/env node
/**
 * generate-roadmap.js
 *
 * Zero-dependency roadmap generator for Maintenance Agent.
 * Reads ROADMAP.json + scans codebase → outputs docs/roadmap.html
 *
 * Produces the same IBM Plex dark-grid visual design as the architecture blueprint.
 *
 * ─── Status Aggregation Rules (single source of truth) ─────────
 *
 * The roadmap tracks features and optional sub-feature slices.
 * Status flows UPWARD from the lowest actionable items:
 *
 *   slice status  → auto-detected from completion_signals, or manual fallback
 *   feature status → aggregated from slices (if any), or auto-detected directly
 *   phase status   → derived purely from its contained features (never manual)
 *   global stats   → derived from backlog items (slices when present, else features)
 *
 * Allowed statuses: planned | in_progress | blocked | done
 *
 * Feature aggregation from slices:
 *   all slices done            → feature = done
 *   any slice in_progress/done → feature = in_progress
 *   all slices planned/blocked → feature = planned
 *
 * Phase derivation from features:
 *   all features done              → DONE
 *   any feature in_progress/done   → IN PROGRESS
 *   else                           → PLANNED
 *
 * Global counters use buildBacklogItems() — the flat list of lowest
 * actionable work items (slices when a feature has them, feature otherwise).
 * This ensures stat-grid numbers match the Backlog kanban exactly.
 *
 * "Blocked" = planned item with at least one unmet dependency.
 * Blocked items are counted separately (not lumped into planned).
 *
 * A "planning health" check detects if feature-level aggregation
 * disagrees with backlog-item aggregation and renders a warning.
 *
 * Usage: node scripts/generate-roadmap.js
 */

const fs = require("fs");
const path = require("path");

const ROOT = path.resolve(__dirname, "..");
const ROADMAP_PATH = path.join(ROOT, "ROADMAP.json");
const OUTPUT_PATH = path.join(ROOT, "docs", "roadmap.html");
const SCHEMA_PATH = path.join(ROOT, "apps/api/prisma/schema.prisma");
const WORKFLOWS_DIR = path.join(ROOT, "apps/api/src/workflows");
const ROUTES_DIR = path.join(ROOT, "apps/api/src/routes");
const SERVICES_DIR = path.join(ROOT, "apps/api/src/services");
const MIGRATIONS_DIR = path.join(ROOT, "apps/api/prisma/migrations");
const PAGES_DIR = path.join(ROOT, "apps/web/pages");
const shared = require("./roadmap-shared");

// ─── Codebase Scanning ────────────────────────────────────────

function readSchema() {
  try { return fs.readFileSync(SCHEMA_PATH, "utf8"); } catch { return ""; }
}

function getModels(schema) {
  return (schema.match(/^model\s+(\w+)\s*\{/gm) || []).map(m => m.replace(/^model\s+/, "").replace(/\s*\{$/, ""));
}

function getEnums(schema) {
  return (schema.match(/^enum\s+(\w+)\s*\{/gm) || []).map(m => m.replace(/^enum\s+/, "").replace(/\s*\{$/, ""));
}

function getMigrationCount() {
  try { return fs.readdirSync(MIGRATIONS_DIR).filter(d => fs.statSync(path.join(MIGRATIONS_DIR, d)).isDirectory()).length; } catch { return 0; }
}

function getTsFiles(dir) {
  try { return fs.readdirSync(dir).filter(f => f.endsWith(".ts") && !f.startsWith("index")); } catch { return []; }
}

function getEnvKeys() {
  const keys = new Set();
  for (const name of [".env", ".env.local", ".env.production"]) {
    try {
      const content = fs.readFileSync(path.join(ROOT, name), "utf8");
      for (const line of content.split("\n")) {
        const match = line.match(/^([A-Z_][A-Z0-9_]*)=/);
        if (match) keys.add(match[1]);
      }
    } catch { /* file doesn't exist */ }
  }
  return keys;
}

function getGitInfo() {
  try {
    const head = fs.readFileSync(path.join(ROOT, ".git/HEAD"), "utf8").trim();
    let branch = "detached", commit = "unknown";
    if (head.startsWith("ref:")) {
      branch = head.replace("ref: refs/heads/", "");
      try { commit = fs.readFileSync(path.join(ROOT, ".git", head.replace("ref: ", "")), "utf8").trim().slice(0, 7); } catch {}
    } else { commit = head.slice(0, 7); }
    return { branch, commit };
  } catch { return { branch: "unknown", commit: "unknown" }; }
}

// ─── Detection Engine ─────────────────────────────────────────

function runDetection(check, signals) {
  switch (check.type) {
    case "model_exists":
      return signals.models.includes(check.name);
    case "model_field": {
      if (check.model) {
        const re = new RegExp(`model\\s+${check.model}\\s*\\{[^}]*${check.field}`, "m");
        return re.test(signals.schema);
      }
      return signals.schema.includes(check.field);
    }
    case "enum_exists":
      return signals.enums.includes(check.name);
    case "workflow_exists":
      return signals.workflows.some(f => f.replace(".ts", "") === check.name);
    case "file_exists":
    case "page_exists":
      try { fs.accessSync(path.join(ROOT, check.path)); return true; } catch { return false; }
    case "env_key":
      return signals.envKeys.has(check.key);
    case "audit_finding": {
      try {
        const audit = fs.readFileSync(path.join(ROOT, "docs/AUDIT.md"), "utf8");
        const term = check.name || check.key || "";
        return term ? audit.includes(term) : false;
      } catch { return false; }
    }
    default:
      return false;
  }
}

function getFeatureStatus(detection, signals) {
  if (!detection || !detection.checks || detection.checks.length === 0) return { status: "planned", signal: "no detection configured" };
  const checks = detection.checks;
  let passed = 0;
  let lastSignal = "";
  for (const check of checks) {
    const ok = runDetection(check, signals);
    if (ok) {
      passed++;
      lastSignal = `${check.type}: ${check.name || check.field || check.path || check.key} \u2714`;
    } else {
      lastSignal = describeFailedCheck(check);
    }
  }
  if (passed === checks.length) return { status: "done", signal: lastSignal };
  if (passed > 0) return { status: "in_progress", signal: lastSignal };
  return { status: "planned", signal: lastSignal };
}

function describeFailedCheck(check) {
  switch (check.type) {
    case "env_key": return `env key ${check.key} not configured`;
    case "file_exists": return `${check.path} not yet created`;
    case "page_exists": return `${check.path} not yet created`;
    case "model_exists": return `model ${check.name} not in schema yet`;
    case "model_field": return `${check.model || ""}.${check.field} not in schema yet`;
    case "enum_exists": return `enum ${check.name} not in schema yet`;
    case "workflow_exists": return `workflow ${check.name} not yet created`;
    default: return `unknown detection type: ${check.type}`;
  }
}

// ─── Slice-Level Detection & Status Aggregation ───────────────
//
// When a feature has an optional `slices[]` array, each slice can carry its
// own `completion_signals[]` — a simplified form of the feature-level
// detection checks.  The generator evaluates each signal against the same
// codebase signals used for feature detection, then aggregates slice
// outcomes back into an overall feature status.
//
// Aggregation rules:
//   • Feature has no slices → use existing feature-level detection (unchanged).
//   • Feature has slices:
//       – Each slice's status is computed from its completion_signals (if any),
//         falling back to the manually-set slice.status, then to "planned".
//       – Feature status = all-done → "done",
//                          any done/in_progress → "in_progress",
//                          else → "planned".
//   • The feature-level `signal` text shows "N/M slices done".
//

/**
 * Evaluate a single slice completion_signal against codebase signals.
 * Maps the simplified { type, value } format to the existing runDetection()
 * check format used by feature-level detection.
 */
function runSliceSignal(sig, signals) {
  const t = sig.type;
  const v = sig.value;
  switch (t) {
    case "file_exists":
    case "page_exists":
      return runDetection({ type: t, path: v }, signals);
    case "env_key":
      return runDetection({ type: "env_key", key: v }, signals);
    case "model_exists":
      return runDetection({ type: "model_exists", name: v }, signals);
    case "model_field": {
      // value can be "Model.field" or just "field"
      const parts = v.split(".");
      return parts.length === 2
        ? runDetection({ type: "model_field", model: parts[0], field: parts[1] }, signals)
        : runDetection({ type: "model_field", field: v }, signals);
    }
    case "enum_exists":
      return runDetection({ type: "enum_exists", name: v }, signals);
    case "workflow_exists":
      return runDetection({ type: "workflow_exists", name: v }, signals);
    default:
      return false;
  }
}

/**
 * Compute the status of a single slice.
 * If the slice has completion_signals, evaluate them (all pass → done,
 * some pass → in_progress, none → planned).
 * Otherwise fall back to the manual slice.status, then to "planned".
 */
function getSliceStatus(slice, signals) {
  const sigs = slice.completion_signals;
  if (!sigs || sigs.length === 0) {
    // No auto-detection — use the manual status or default to "planned"
    return { status: slice.status || "planned", signal: "manual" };
  }
  let passed = 0;
  let lastSignal = "";
  for (const sig of sigs) {
    if (runSliceSignal(sig, signals)) {
      passed++;
      lastSignal = `${sig.type}: ${sig.value} \u2714`;
    } else {
      lastSignal = `${sig.type}: ${sig.value} \u2718`;
    }
  }
  if (passed === sigs.length) return { status: "done", signal: lastSignal };
  if (passed > 0) return { status: "in_progress", signal: lastSignal };
  return { status: "planned", signal: lastSignal };
}

/**
 * Aggregate feature status from its slices.
 * Returns the same { status, signal } shape as getFeatureStatus().
 * Only called when feature.slices is a non-empty array.
 *
 * Aggregation rule:
 *   all done            → done
 *   any done/in_progress → in_progress
 *   else                → planned  (covers all-planned AND all-blocked)
 */
function aggregateFeatureFromSlices(slicesComputed) {
  const total = slicesComputed.length;
  const doneCount = slicesComputed.filter(s => s.computedStatus === "done").length;
  const ipCount = slicesComputed.filter(s => s.computedStatus === "in_progress").length;
  const signal = `${doneCount}/${total} slices done`;
  if (doneCount === total) return { status: "done", signal };
  if (doneCount > 0 || ipCount > 0) return { status: "in_progress", signal };
  return { status: "planned", signal };
}

// ─── Centralized Roadmap Statistics ───────────────────────────
//
// aggregateRoadmapStats() is the SINGLE SOURCE OF TRUTH for all
// counts displayed in the stat grid, phase headers, and footer.
//
// It derives everything from backlogItems — the flat list of lowest
// actionable work items (slices when a feature has them, else the
// feature itself).  This guarantees the stat grid matches the Backlog
// kanban column counts exactly.
//
// It also computes per-phase stats from that same item list so phase
// headers are consistent.
//
// Finally it runs a planning health check: if feature-level totals
// disagree with backlog-item totals, it flags a mismatch.

function aggregateRoadmapStats(backlogItems, computed, phases) {
  // ── Global counts from backlog items (single source) ──
  const totalItems = backlogItems.length;
  const doneItems = backlogItems.filter(i => i.column === "done").length;
  const inProgressItems = backlogItems.filter(i => i.column === "in_progress").length;
  const blockedItems = backlogItems.filter(i => i.column === "blocked").length;
  const readyItems = backlogItems.filter(i => i.column === "ready").length;
  const plannedItems = readyItems + blockedItems; // not-started = ready + blocked
  const pct = totalItems > 0 ? Math.round((doneItems / totalItems) * 100) : 0;

  // ── Per-phase stats (from the same backlog items) ──
  // Maps phase id → { done, inProgress, blocked, ready, total, pct, status }
  const phaseStats = {};
  for (const phase of phases) {
    const items = backlogItems.filter(i => i.phase === phase.id);
    const done = items.filter(i => i.column === "done").length;
    const ip = items.filter(i => i.column === "in_progress").length;
    const blk = items.filter(i => i.column === "blocked").length;
    const rdy = items.filter(i => i.column === "ready").length;
    const total = items.length;
    const p = total > 0 ? Math.round((done / total) * 100) : 0;

    // Phase status derived purely from contained items — never from manual phase.status
    let status;
    if (total > 0 && done === total) status = "DONE";
    else if (done > 0 || ip > 0) status = "IN PROGRESS";
    else status = phase.id === "P5" ? "FUTURE" : "PLANNED";

    phaseStats[phase.id] = { done, inProgress: ip, blocked: blk, ready: rdy, total, pct: p, status };
  }

  // ── Planning health check ──
  // Detects real disagreements between feature-level aggregation and
  // backlog-item (slice) aggregation.  Two kinds of genuine mismatch:
  //   1. Feature says "done" but has non-done slices (under-counting work)
  //   2. All slices of a feature are done but feature says NOT done (stale aggregation)
  // Raw count comparison (featureDone vs doneItems) is intentionally NOT
  // checked because features expand into N items via slices — different
  // units, different counts, and that is expected.

  const featureDone = computed.filter(f => f.computedStatus === "done").length;
  const featureIP = computed.filter(f => f.computedStatus === "in_progress").length;
  const featurePlanned = computed.length - featureDone - featureIP;

  const mismatches = [];

  // Check per-feature consistency: does the feature status agree with its slices?
  for (const f of computed) {
    const sc = f.slicesComputed || [];
    if (sc.length === 0) continue; // no slices → nothing to compare
    const sliceDone = sc.filter(s => s.computedStatus === "done").length;
    const sliceIP = sc.filter(s => s.computedStatus === "in_progress").length;
    if (f.computedStatus === "done" && sliceDone < sc.length) {
      mismatches.push(`${f.id}: feature says done but ${sc.length - sliceDone} slice(s) are not`);
    }
    if (f.computedStatus === "planned" && (sliceDone > 0 || sliceIP > 0)) {
      mismatches.push(`${f.id}: feature says planned but ${sliceDone + sliceIP} slice(s) are done/in_progress`);
    }
  }

  // Check if a phase has DONE features but non-done backlog items
  for (const phase of phases) {
    const ps = phaseStats[phase.id];
    const phaseFeatures = computed.filter(f => f.phase === phase.id);
    const featureDoneInPhase = phaseFeatures.filter(f => f.computedStatus === "done").length;
    if (featureDoneInPhase > 0 && ps.done < ps.total && featureDoneInPhase === phaseFeatures.length && ps.done < ps.total) {
      mismatches.push(`${phase.id}: all features done but ${ps.total - ps.done} items remain`);
    }
  }

  const healthy = mismatches.length === 0;

  return {
    // Global
    totalItems, doneItems, inProgressItems, blockedItems, readyItems, plannedItems, pct,
    // Also expose feature-level counts for the Phases tab (which shows feature cards)
    totalFeatures: computed.length, featureDone, featureIP, featurePlanned,
    // Per-phase
    phaseStats,
    // Health
    healthy, mismatches,
  };
}

// ─── Backlog Builder (slice-first) ────────────────────────────
//
// Builds a flat array of work items for the Kanban board.
// When a feature has slices, each slice becomes its own card (with a
// back-reference to the parent feature).  Features without slices
// produce a single feature-level card.
//
// Column assignment:
//   done         → computedStatus === "done"
//   in_progress  → computedStatus === "in_progress"
//   blocked      → planned but at least one dependency is not done
//   ready        → planned and all dependencies are done (or none)
//

function buildBacklogItems(computed) {
  // Index all known statuses (features + slices) for dependency resolution
  const statusMap = {};
  for (const f of computed) {
    statusMap[f.id] = f.computedStatus;
    for (const s of (f.slicesComputed || [])) {
      statusMap[s.id] = s.computedStatus;
    }
  }

  const items = [];

  for (let fi = 0; fi < computed.length; fi++) {
    const f = computed[fi];
    const sc = f.slicesComputed || [];

    if (sc.length > 0) {
      // ── Slice-level cards ──
      for (let si = 0; si < sc.length; si++) {
        const s = sc[si];
        const deps = s.depends_on || [];
        const allDepsDone = deps.length === 0 || deps.every(d => statusMap[d] === "done");
        let column;
        if (s.computedStatus === "done") column = "done";
        else if (s.computedStatus === "in_progress") column = "in_progress";
        else if (!allDepsDone) column = "blocked";
        else column = "ready";

        items.push({
          id: s.id, title: s.title, parentId: f.id, parentTitle: f.title,
          phase: f.phase, type: s.type || "task", description: f.description || "",
          column, computedStatus: s.computedStatus, depends_on: deps,
          pendingDeps: deps.filter(d => statusMap[d] !== "done"),
          files: s.files_expected || [], isSlice: true,
          acceptance_criteria: s.acceptance_criteria || [],
          prompt_template: s.prompt_template || null,
          featureIndex: fi, sliceIndex: si,
        });
      }
    } else {
      // ── Feature-level card ──
      const deps = f.depends_on || [];
      const allDepsDone = deps.length === 0 || deps.every(d => statusMap[d] === "done");
      let column;
      if (f.computedStatus === "done") column = "done";
      else if (f.computedStatus === "in_progress") column = "in_progress";
      else if (!allDepsDone) column = "blocked";
      else column = "ready";

      items.push({
        id: f.id, title: f.title, parentId: null, parentTitle: null,
        phase: f.phase, type: f.type || "task", description: f.description || "",
        column, computedStatus: f.computedStatus, depends_on: deps,
        pendingDeps: deps.filter(d => statusMap[d] !== "done"),
        files: [...(f.hooks_new || []), ...(f.hooks_existing || [])],
        isSlice: false,
        featureIndex: fi, sliceIndex: 0,
      });
    }
  }

  return items;
}

// ─── Custom → Backlog Adapter ─────────────────────────────────
//
// Converts custom_items into the same shape as buildBacklogItems output
// so they participate in the chronological queue and recommendation engine.
// Called separately — custom items are merged into allBacklogItems for
// ranking but kept out of stats to avoid skewing phase progress bars.
//

function customItemsToBacklog(customItems, computed) {
  var statusMap = {};
  for (var fi = 0; fi < computed.length; fi++) {
    statusMap[computed[fi].id] = computed[fi].computedStatus;
    var sc = computed[fi].slicesComputed || [];
    for (var si = 0; si < sc.length; si++) statusMap[sc[si].id] = sc[si].computedStatus;
  }
  for (var ci2 = 0; ci2 < customItems.length; ci2++) {
    statusMap[customItems[ci2].id] = customItems[ci2].status || "planned";
  }

  var baseIndex = computed.length;
  var items = [];

  for (var ci = 0; ci < customItems.length; ci++) {
    var c = customItems[ci];
    var deps = c.depends_on || [];
    var allDepsDone = deps.length === 0;
    if (!allDepsDone) {
      allDepsDone = true;
      for (var di = 0; di < deps.length; di++) {
        if (statusMap[deps[di]] !== "done") { allDepsDone = false; break; }
      }
    }
    var column;
    if (c.status === "done") column = "done";
    else if (c.status === "in_progress") column = "in_progress";
    else if (c.status === "blocked" || !allDepsDone) column = "blocked";
    else column = "ready";

    var parentTitle = null;
    if (c.parent_feature) {
      for (var pf = 0; pf < computed.length; pf++) {
        if (computed[pf].id === c.parent_feature) { parentTitle = computed[pf].title; break; }
      }
    }

    items.push({
      id: c.id, title: c.title,
      parentId: c.parent_feature || null, parentTitle: parentTitle,
      phase: c.phase, type: c.type || "task",
      description: c.description || "",
      column: column, computedStatus: c.status || "planned",
      depends_on: deps,
      pendingDeps: deps.filter(function(d) { return statusMap[d] !== "done"; }),
      files: c.files_expected || [],
      isSlice: false, isCustom: true,
      acceptance_criteria: c.acceptance_criteria || [],
      required_tests: c.required_tests || [],
      test_protocol: c.test_protocol || "",
      validation_checklist: c.validation_checklist || [],
      featureIndex: baseIndex + (c.order !== undefined ? c.order : ci),
      sliceIndex: 0,
    });
  }
  return items;
}

// ─── Chronological Development Order Engine ───────────────────
//
// Single ranking engine used for BOTH the full chronological queue
// and the top-N recommendations.  All ordering is computed here in
// the generator — no DOM heuristics.
//
// ─── Ranking Rules (deterministic) ────────────────────────────
//
//   Rule 1 — Lower phase first:  P0 > P1 > P2 > P3 > P4 …
//   Rule 2 — Within a phase, declared order in ROADMAP.json
//            (featureIndex assigned by buildBacklogItems)
//   Rule 3 — Within a feature, slice order (sliceIndex)
//   Rule 4 — Skip done items (filtered out)
//   Rule 5 — Ready/in-progress before blocked
//            (blocked = has at least one incomplete dependency)
//   Rule 6 — Prefer ready items; among equally-ready items,
//            prefer smallest/most-localized scope
//            (slice < feature; fewer files < more files)
//   Rule 7 — Unblockers first: items that unlock more downstream
//            items rank higher among otherwise-equal candidates
//   Rule 8 — Testing-ready: items with complete testing metadata
//            (test_protocol + required_tests + validation_checklist)
//            rank above equally-ready items without it
//   Rule 9 — If still tied, preserve source order (stable sort)
//
// Each item is annotated with:
//   - rank        (1-based position)
//   - reasons[]   (human-readable explanation of why it ranks here)
//   - blockedBy[] (pending dependency ids + titles, if blocked)
//   - unlocks     (count of items this item's completion would unblock)
//   - scope       ("slice" | "feature", + file count)
//
// Returns:
//   {
//     queue: [...all non-done items in ranked order...],
//     next:  first actionable (ready/in_progress) item, or null
//   }
//
// computeRecommendations() returns the top N from the same queue.
//
// ──────────────────────────────────────────────────────────────

function computeChronologicalQueue(backlogItems, phases) {
  // ── Phase ordering lookup ──
  var phaseOrder = {};
  phases.forEach(function(p, i) { phaseOrder[p.id] = i; });
  var phaseCount = phases.length;

  // ── Dependant count: how many items each id would unblock ──
  var dependantCount = {};
  var dependantTitles = {};  // id → [titles of items it blocks]
  for (var di = 0; di < backlogItems.length; di++) {
    var deps = backlogItems[di].depends_on || [];
    for (var dj = 0; dj < deps.length; dj++) {
      var depId = deps[dj];
      dependantCount[depId] = (dependantCount[depId] || 0) + 1;
      if (!dependantTitles[depId]) dependantTitles[depId] = [];
      dependantTitles[depId].push(backlogItems[di].title);
    }
  }

  // ── Filter out done items (Rule 4) ──
  var active = backlogItems.filter(function(i) { return i.column !== "done"; });

  // ── Scope metric: file count as a proxy for implementation size ──
  function scopeSize(item) {
    return (item.files || []).length;
  }

  // ── Primary sort: deterministic chronological order ──
  // Rules 1-3, 6, 7 expressed as a comparator.
  active.sort(function(a, b) {
    // Rule 1: lower phase first
    var pa = phaseOrder[a.phase] !== undefined ? phaseOrder[a.phase] : 99;
    var pb = phaseOrder[b.phase] !== undefined ? phaseOrder[b.phase] : 99;
    if (pa !== pb) return pa - pb;

    // Rule 2: declared feature order within a phase
    var fa = a.featureIndex !== undefined ? a.featureIndex : 999;
    var fb = b.featureIndex !== undefined ? b.featureIndex : 999;
    if (fa !== fb) return fa - fb;

    // Rule 3: slice order within a feature
    var sa = a.sliceIndex !== undefined ? a.sliceIndex : 999;
    var sb = b.sliceIndex !== undefined ? b.sliceIndex : 999;
    if (sa !== sb) return sa - sb;

    // Rule 6a: slices (smaller scope) before whole features
    if (a.isSlice && !b.isSlice) return -1;
    if (!a.isSlice && b.isSlice) return 1;

    // Rule 6b: fewer files = smaller scope
    var sza = scopeSize(a);
    var szb = scopeSize(b);
    if (sza !== szb) return sza - szb;

    // Rule 7: unblockers first — items that unlock more downstream items rank higher
    var ua = dependantCount[a.id] || 0;
    var ub = dependantCount[b.id] || 0;
    if (ua !== ub) return ub - ua;

    // Rule 8: items with complete testing metadata rank higher
    var ta = (a.test_protocol && a.test_protocol.trim() && (a.required_tests || []).length > 0 && (a.validation_checklist || []).length > 0) ? 0 : 1;
    var tb = (b.test_protocol && b.test_protocol.trim() && (b.required_tests || []).length > 0 && (b.validation_checklist || []).length > 0) ? 0 : 1;
    if (ta !== tb) return ta - tb;

    // Rule 9: stable — preserve insertion order
    return 0;
  });

  // ── Partition: ready/in_progress first, then blocked (Rule 5) ──
  var actionable = [];
  var blocked = [];
  for (var ai = 0; ai < active.length; ai++) {
    if (active[ai].column === "ready" || active[ai].column === "in_progress") {
      actionable.push(active[ai]);
    } else {
      blocked.push(active[ai]);
    }
  }
  var queue = actionable.concat(blocked);

  // ── Build title lookup for blocker descriptions ──
  var titleMap = {};
  for (var ti = 0; ti < backlogItems.length; ti++) {
    titleMap[backlogItems[ti].id] = backlogItems[ti].title;
  }

  // ── Annotate each item with rank, reasons, blockedBy, unlocks, scope ──
  for (var qi = 0; qi < queue.length; qi++) {
    var item = queue[qi];
    var reasons = [];
    var rank = qi + 1;

    // Why this phase?
    var pIdx = phaseOrder[item.phase] !== undefined ? phaseOrder[item.phase] : -1;
    if (pIdx === 0) reasons.push("P0 critical-path — highest priority phase");
    else if (pIdx >= 0) reasons.push(item.phase + " — phase position " + (pIdx + 1) + "/" + phaseCount);

    // Readiness
    if (item.column === "in_progress") {
      reasons.push("already in progress");
    } else if (item.column === "ready") {
      reasons.push("all dependencies met — ready now");
    } else if (item.column === "blocked") {
      reasons.push("blocked — waiting on " + (item.pendingDeps || []).length + " dependency(ies)");
    }

    // Scope
    var fileCount = scopeSize(item);
    if (item.isSlice) {
      reasons.push("concrete slice (" + fileCount + " file" + (fileCount !== 1 ? "s" : "") + ")");
    } else {
      reasons.push("feature-level (" + fileCount + " hook" + (fileCount !== 1 ? "s" : "") + ")");
    }

    // Declared order
    reasons.push("declared position: feature #" + ((item.featureIndex || 0) + 1) +
      (item.isSlice ? ", slice #" + ((item.sliceIndex || 0) + 1) : ""));

    // Unlock value
    var unlocks = dependantCount[item.id] || 0;
    if (unlocks > 0) {
      reasons.push("completing this unlocks " + unlocks + " downstream item" + (unlocks > 1 ? "s" : ""));
    }

    // Testing completeness
    var testComplete = (item.test_protocol && item.test_protocol.trim() && (item.required_tests || []).length > 0 && (item.validation_checklist || []).length > 0);
    if (testComplete) reasons.push("testing metadata complete");

    // Custom item indicator
    if (item.isCustom) reasons.push("custom ticket");

    // Blocked-by detail (with titles)
    var blockedBy = [];
    if (item.pendingDeps && item.pendingDeps.length > 0) {
      for (var bi = 0; bi < item.pendingDeps.length; bi++) {
        var bId = item.pendingDeps[bi];
        blockedBy.push({ id: bId, title: titleMap[bId] || "(unknown)" });
      }
    }

    // Attach annotations (non-destructive — spread into new object)
    queue[qi] = Object.assign({}, item, {
      rank: rank,
      reasons: reasons,
      blockedBy: blockedBy,
      unlocks: unlocks,
      scope: item.isSlice ? "slice" : "feature",
      scopeFileCount: fileCount,
    });
  }

  return { queue: queue, next: actionable.length > 0 ? queue[0] : null };
}

// ─── Recommendation Engine ────────────────────────────────────
//
// Returns the top N items from the chronological queue.
// Uses computeChronologicalQueue() as the single ranking source
// so the "next ticket" and "top 5" always agree.
//
// Items are returned with all queue annotations (rank, reasons,
// blockedBy, unlocks, scope).  The rec panel renders reasons as
// the "why this is next" explanation for each card.
//
// Prioritisation (9-rule ranking):
//   1. Earliest ready ticket in phase order
//   2. Unblockers ahead of isolated work
//   3. Small/local tickets above large ambiguous tickets
//   4. Tickets with complete testing metadata above equally ready ones
//
// computeRecommendationsEx() adds movement tracking against the
// previous snapshot stored in ROADMAP.json _meta.last_recommendations.
//

function computeRecommendations(backlogItems, phases, limit) {
  limit = limit || 5;
  var chrono = computeChronologicalQueue(backlogItems, phases);
  return chrono.queue.slice(0, limit);
}

function computeRecommendationsEx(backlogItems, phases, limit, previousRecs) {
  limit = limit || 5;
  var chrono = computeChronologicalQueue(backlogItems, phases);
  var recs = chrono.queue.slice(0, limit);

  // Movement tracking: compare with previous snapshot
  var prevRankMap = {};
  if (previousRecs && Array.isArray(previousRecs)) {
    for (var pi = 0; pi < previousRecs.length; pi++) {
      prevRankMap[previousRecs[pi].id] = previousRecs[pi].rank;
    }
  }
  var hasPrev = Object.keys(prevRankMap).length > 0;

  for (var ri = 0; ri < recs.length; ri++) {
    var rec = recs[ri];
    if (!hasPrev) {
      rec.movement = 0;
      rec.movementLabel = "\u2014";  // em-dash = first generation
    } else {
      var prevRank = prevRankMap[rec.id];
      if (prevRank === undefined) {
        rec.movement = null;
        rec.movementLabel = "NEW";
      } else {
        var diff = prevRank - rec.rank;
        rec.movement = diff;
        rec.movementLabel = diff > 0 ? "\u2191" + diff : diff < 0 ? "\u2193" + Math.abs(diff) : "\u2014";
      }
    }
  }

  return { items: recs, total: chrono.queue.length, next: chrono.next };
}

// ─── HTML Helpers ─────────────────────────────────────────────

function esc(s) {
  return String(s || "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}

// ─── Planning Console Helpers ─────────────────────────────────

function computeReadyFeatures(computed, phases) {
  const statusMap = {};
  for (const f of computed) statusMap[f.id] = f.computedStatus;

  const ready = [];
  const blocked = [];

  for (const f of computed) {
    if (f.computedStatus === "done") continue;
    const deps = f.depends_on || [];
    const allDepsDone = deps.length === 0 || deps.every(depId => statusMap[depId] === "done");
    if (allDepsDone) {
      ready.push(f);
    } else {
      const pendingDeps = deps.filter(depId => statusMap[depId] !== "done");
      blocked.push({ ...f, pendingDeps });
    }
  }

  const phaseOrder = phases.map(p => p.id);
  const sorter = (a, b) => {
    const pa = phaseOrder.indexOf(a.phase);
    const pb = phaseOrder.indexOf(b.phase);
    if (pa !== pb) return pa - pb;
    return (a.priority || 99) - (b.priority || 99);
  };

  ready.sort(sorter);
  blocked.sort(sorter);

  return { ready, blocked };
}

// ─── Context Derivation Helpers ────────────────────────────────
//
// These helpers analyse a feature/item's hooks, description, and detection
// config against the live codebase signals (models, workflows, routes,
// services, repositories) to produce compact, task-aware context that
// gets embedded directly inside generated Copilot prompts.
//
// The goal: every prompt carries enough architectural context to start
// implementing without needing to manually grep the codebase first.

/**
 * Fuzzy-match a hook or keyword string against a list of file basenames.
 * Returns matching basenames (without .ts).  Matching rules:
 *   1. Exact match (lowered) — "invoiceService" matches "invoices" or "invoiceService"
 *   2. Substring containment — "Lease" matches "leases", "leaseService", etc.
 *   3. Model→file heuristic — "Invoice model" → looks for "invoice" prefix
 */
function fuzzyMatchFiles(term, fileList) {
  const t = term.toLowerCase()
    .replace(/\s*(model|service|workflow|route|repository|enum|pattern|module)s?\s*/gi, " ")
    .trim();
  const words = t.split(/\s+/).filter(w => w.length > 2);
  const matches = new Set();
  for (const f of fileList) {
    const fl = f.replace(/\.ts$/, "").toLowerCase();
    // Exact or near-exact
    if (fl === t.replace(/\s+/g, "")) { matches.add(f.replace(/\.ts$/, "")); continue; }
    // Any word from the term appears as prefix/substring in filename
    for (const w of words) {
      if (fl.includes(w) || w.includes(fl)) {
        matches.add(f.replace(/\.ts$/, ""));
      }
    }
  }
  return [...matches];
}

/**
 * Derive task-relevant codebase context for a feature or backlog item.
 *
 * @param {object} item       - feature or backlog item (has hooks_existing, hooks_new, description, detection, etc.)
 * @param {object} signals    - { models, enums, workflows, routes, services, schema }
 * @param {object} roadmap    - full roadmap (for project summary, phases)
 * @param {object} stats      - aggregateRoadmapStats output (for focus phase)
 * @param {object[]} computed - computed features array
 * @returns {object} { productSummary, focusPhase, whyNow, relevantModels, relevantWorkflows, relevantRoutes, relevantServices, constraints }
 */
function deriveTaskContext(item, signals, roadmap, stats, computed) {
  const project = roadmap.project || {};

  // ── Product summary (1-2 lines, static + dynamic) ──
  const totalModels = signals.models.length;
  const totalWorkflows = signals.workflows.length;
  const productSummary = (project.name || "Maintenance Agent") + " — " +
    (project.subtitle || "Swiss property management platform") + ".\n" +
    "Stack: Node.js raw http.createServer (port 3001) · Next.js Pages Router (port 3000) · PostgreSQL 16 · Prisma ORM (" +
    totalModels + " models).";

  // ── Current focus phase (highest priority non-done phase with activity) ──
  const phases = roadmap.phases || [];
  let focusPhase = null;
  for (const ph of phases) {
    const ps = stats.phaseStats[ph.id];
    if (!ps) continue;
    if (ps.status === "DONE" || ps.status === "FUTURE") continue;
    // First non-done, non-future phase is the focus
    focusPhase = { id: ph.id, name: ph.name, goal: ph.goal, status: ps.status,
      done: ps.done, total: ps.total, pct: ps.pct };
    break;
  }

  // ── Why this task matters now ──
  const phase = phases.find(ph => ph.id === item.phase);
  let whyNow = "";
  if (focusPhase && item.phase === focusPhase.id) {
    whyNow = "This task is in the current focus phase (" + focusPhase.id + ": " + focusPhase.name + ", " + focusPhase.pct + "% done). ";
  } else if (focusPhase && phases.findIndex(p => p.id === item.phase) < phases.findIndex(p => p.id === focusPhase.id)) {
    whyNow = "This is a foundational task from " + item.phase + " that should have been completed before " + focusPhase.id + ". Prioritize. ";
  } else {
    whyNow = "This task is in " + item.phase + " (" + (phase ? phase.name : "future") + "). ";
  }
  // Dependency unlock info
  const unlocks = (computed || []).filter(f =>
    (f.depends_on || []).includes(item.id || item.parentId)
  );
  if (unlocks.length > 0) {
    whyNow += "Completing it unblocks " + unlocks.length + " downstream feature" + (unlocks.length > 1 ? "s" : "") +
      " (" + unlocks.slice(0, 3).map(u => u.id).join(", ") + (unlocks.length > 3 ? ", \u2026" : "") + ").";
  }

  // ── Collect all hook/keyword terms for matching ──
  const allTerms = [
    ...(item.hooks_existing || []),
    ...(item.hooks_new || []),
  ];
  // Also extract key nouns from description
  const desc = item.description || "";
  const descWords = desc.match(/\b[A-Z][a-zA-Z]{3,}\b/g) || [];
  // Filter out common English words
  const stopWords = new Set(["This", "That", "These", "Those", "Without", "When", "Where", "What", "Which",
    "From", "With", "Before", "After", "First", "Input", "Output", "Build",
    "Wire", "Replace", "Create", "Extend", "Generate", "Accept", "Link",
    "Clear", "Track", "Connect", "Every", "Explicitly", "Swiss", "Month"]);
  const descNouns = [...new Set(descWords.filter(w => !stopWords.has(w)))];
  allTerms.push(...descNouns);

  // Also add detection-based terms
  if (item.detection && item.detection.checks) {
    for (const ch of item.detection.checks) {
      if (ch.name) allTerms.push(ch.name);
      if (ch.field) allTerms.push(ch.field);
      if (ch.path) {
        const base = ch.path.split("/").pop().replace(/\.ts$/, "");
        allTerms.push(base);
      }
    }
  }

  // ── Match against codebase signals ──
  const matchedModels = new Set();
  const matchedWorkflows = new Set();
  const matchedRoutes = new Set();
  const matchedServices = new Set();

  for (const term of allTerms) {
    for (const m of fuzzyMatchFiles(term, signals.models.map(x => x))) matchedModels.add(m);
    for (const w of fuzzyMatchFiles(term, signals.workflows)) matchedWorkflows.add(w.replace(/\.ts$/, ""));
    for (const r of fuzzyMatchFiles(term, signals.routes)) matchedRoutes.add(r.replace(/\.ts$/, ""));
    for (const s of fuzzyMatchFiles(term, signals.services)) matchedServices.add(s.replace(/\.ts$/, ""));
  }

  // Cap at 8 most relevant per category
  const relevantModels = [...matchedModels].slice(0, 8);
  const relevantWorkflows = [...matchedWorkflows].slice(0, 6);
  const relevantRoutes = [...matchedRoutes].slice(0, 5);
  const relevantServices = [...matchedServices].slice(0, 6);

  // ── Inferred architectural constraints ──
  const constraints = [];
  if (relevantModels.length > 0) {
    constraints.push("DB models involved — use repository pattern, not direct Prisma in routes/services.");
  }
  if (relevantWorkflows.length > 0) {
    constraints.push("Existing workflows found — extend them or follow the same event-driven pattern.");
  }
  if (item.type === "wire" || item.type === "infra") {
    constraints.push("Integration task — isolate external adapter behind a service interface.");
  }
  if (item.type === "refactor") {
    constraints.push("Refactor — preserve existing API contracts and test coverage.");
  }
  if ((item.hooks_new || []).some(h => /service/i.test(h))) {
    constraints.push("New service needed — place in apps/api/src/services/, inject via function params.");
  }
  if ((item.hooks_new || []).some(h => /workflow/i.test(h))) {
    constraints.push("New workflow needed — place in apps/api/src/workflows/, emit domain events.");
  }

  return {
    productSummary,
    focusPhase,
    whyNow,
    relevantModels,
    relevantWorkflows,
    relevantRoutes,
    relevantServices,
    constraints,
  };
}

/**
 * Format the derived context as a compact text block for embedding in prompts.
 * Returns a multi-line string with ### headers.
 */
function formatContextBlock(ctx) {
  let out = "";

  out += "### Project Context\n";
  out += ctx.productSummary + "\n";
  if (ctx.focusPhase) {
    out += "Current focus: " + ctx.focusPhase.id + " \u2014 " + ctx.focusPhase.name +
      " (" + ctx.focusPhase.pct + "% done, " + ctx.focusPhase.done + "/" + ctx.focusPhase.total + " items).\n";
  }

  out += "\n### Why This Task Matters Now\n";
  out += ctx.whyNow + "\n";

  if (ctx.relevantModels.length > 0) {
    out += "\n### Relevant Models (already in schema.prisma)\n";
    out += ctx.relevantModels.join(", ") + "\n";
  }
  if (ctx.relevantWorkflows.length > 0) {
    out += "\n### Relevant Workflows (apps/api/src/workflows/)\n";
    out += ctx.relevantWorkflows.map(w => w + ".ts").join(", ") + "\n";
  }
  if (ctx.relevantRoutes.length > 0 || ctx.relevantServices.length > 0) {
    out += "\n### Relevant Routes & Services\n";
    if (ctx.relevantRoutes.length > 0) out += "Routes: " + ctx.relevantRoutes.map(r => r + ".ts").join(", ") + "\n";
    if (ctx.relevantServices.length > 0) out += "Services: " + ctx.relevantServices.map(s => s + ".ts").join(", ") + "\n";
  }
  if (ctx.constraints.length > 0) {
    out += "\n### Task-Specific Constraints\n";
    for (const c of ctx.constraints) out += "- " + c + "\n";
  }

  return out;
}

/**
 * Build a compact "After Completion" HTML panel for a prompt card.
 * Enhanced with full post-validation refresh protocol.
 * @param {string} itemId - Feature/slice ID for the verify step
 * @param {string|null} nextRecTitle - Title of the next recommended item (if any)
 */
function formatAfterCompletionHtml(itemId, nextRecTitle) {
  let html = '<div class="ac-panel">';
  html += '<div class="ac-panel-head">Post-Validation Protocol</div>';
  html += '<ol>';
  html += '<li><strong>Validate</strong> — <code>npx tsc --noEmit</code> → <code>cd apps/api && npm test</code> → all pass</li>';
  html += '<li><strong>Mark complete</strong> — <code>node scripts/roadmap-ticket.js complete ' + esc(itemId) + '</code></li>';
  html += '<li><strong>Regenerate</strong> — <code>npm run roadmap</code> (auto if using roadmap:watch)</li>';
  html += '<li><strong>Verify signals</strong> — open roadmap.html → confirm <code>' + esc(itemId) + '</code> shows <strong style="color:var(--p0)">DONE</strong></li>';
  html += '<li><strong>Sync docs</strong> — <code>npm run blueprint</code></li>';
  html += '<li><strong>Commit</strong> — all 3 checks: tsc · test · blueprint</li>';
  if (nextRecTitle) {
    html += '<li><strong>Next ticket</strong> → <strong style="color:var(--accent-cyan)">' + esc(nextRecTitle) + '</strong> (from chronological queue)</li>';
  } else {
    html += '<li><strong>Next ticket</strong> — check NEXT UP hero on roadmap.html</li>';
  }
  html += '</ol>';
  html += '<div class="ac-note">After every ticket: roadmap refreshes context, recalculates queue order, updates all guiding files.</div>';
  html += '</div>';
  return html;
}

// ═══════════════════════════════════════════════════════════════
// Testing Metadata Helpers
//
// backfillTestingDefaults() — injects default testing metadata
// into old custom items that lack it (backward compat).
//
// computeTestingCompleteness() — returns badge info for any item.
// ═══════════════════════════════════════════════════════════════

const DEFAULT_TEST_PROTOCOL =
  "1. npx tsc --noEmit \u2014 zero TypeScript errors\n"
  + "2. npm test \u2014 all tests pass\n"
  + "3. npm run blueprint \u2014 architecture docs sync\n"
  + "4. Ticket-specific verification: verify acceptance criteria manually\n"
  + "5. Regression checks: verify adjacent features still work\n"
  + "6. API contract sync: if API changed, verify DTOs/OpenAPI/api-client match\n"
  + "7. UI verification: if UI changed, manual check in browser\n"
  + "8. Edge cases: verify behavior with missing/null data";

const DEFAULT_VALIDATION_CHECKLIST = [
  "All acceptance criteria verified",
  "No TypeScript errors (npx tsc --noEmit)",
  "All tests pass (npm test)",
  "No layer violations introduced",
  "Blueprint regenerated (npm run blueprint)",
];

/**
 * Inject default testing metadata into custom items that lack it.
 * Mutates the array items in-place for backward compatibility.
 * Returns count of items backfilled.
 */
function backfillTestingDefaults(customItems) {
  return shared.backfillTestingDefaults(customItems);
  /* --- Original body below is unreachable — canonical logic in roadmap-shared.js --- */
  let count = 0;
  for (const c of customItems) {
    let patched = false;
    if (!c.required_tests || !Array.isArray(c.required_tests) || c.required_tests.length === 0) {
      c.required_tests = [
        "Verify feature works as described in acceptance criteria",
        "No regressions in existing test suite",
      ];
      patched = true;
    }
    if (!c.test_protocol || !c.test_protocol.trim()) {
      c.test_protocol = DEFAULT_TEST_PROTOCOL;
      patched = true;
    }
    if (!c.validation_checklist || !Array.isArray(c.validation_checklist) || c.validation_checklist.length === 0) {
      c.validation_checklist = DEFAULT_VALIDATION_CHECKLIST.slice();
      patched = true;
    }
    if (!c.post_validation || !Array.isArray(c.post_validation) || c.post_validation.length === 0) {
      c.post_validation = [
        "Run validation wizard: click \u2713 VALIDATE on ticket card (or: node scripts/roadmap-ticket.js validate " + c.id + ")",
        "Auto-refresh: cd apps/api && node blueprint.js \u2192 docs/blueprint.html",
        "Auto-refresh: node scripts/generate-roadmap.js \u2192 docs/roadmap.html",
        "Manual review: PROJECT_STATE.md \u2014 update if architecture decisions changed",
        "Manual review: ARCHITECTURE_LOW_CONTEXT_GUIDE.md \u2014 update if auth/layers touched",
        "Manual review: docs/AUDIT.md \u2014 mark resolved findings, add new ones",
        "Manual review: SCHEMA_REFERENCE.md \u2014 update if schema changed",
        "Commit: npx tsc --noEmit \u2192 npm test \u2192 npm run blueprint",
      ];
      patched = true;
    }
    if (!c.acceptance_criteria || !Array.isArray(c.acceptance_criteria) || c.acceptance_criteria.length === 0) {
      c.acceptance_criteria = ["Feature works as described"];
      patched = true;
    }
    if (c.order === undefined || c.order === null) {
      c.order = 1;
      patched = true;
    }
    if (patched) count++;
  }
  return count;
}

// ═══════════════════════════════════════════════════════════════
// Post-Validation Target Inference
//
// inferPostValidationTargets(files, type, description)
//   Derives sensible default post-validation update targets based on the
//   ticket's files_expected, type, and description. Does NOT blindly
//   include everything — only targets whose refresh conditions match.
//
//   Returns string[] — each string is a user-readable update instruction.
// ═══════════════════════════════════════════════════════════════

function inferPostValidationTargets(files, type, description) {
  return shared.inferPostValidationTargets(files, type, description);
  /* --- Original body below is unreachable — canonical logic in roadmap-shared.js --- */
  const targets = [];
  const allFiles = (files || []).map(f => f.toLowerCase());
  const desc = (description || "").toLowerCase();
  const ticketType = (type || "task").toLowerCase();

  // ── Pattern matchers ──
  const hasRoutes      = allFiles.some(f => f.includes("/routes/") || f.includes("routes."));
  const hasServices    = allFiles.some(f => f.includes("/services/") || f.includes("service."));
  const hasRepos       = allFiles.some(f => f.includes("/repositories/") || f.includes("repository."));
  const hasWorkflows   = allFiles.some(f => f.includes("/workflows/") || f.includes("workflow."));
  const hasSchema      = allFiles.some(f => f.includes("schema.prisma") || f.includes("/prisma/"));
  const hasMigrations  = allFiles.some(f => f.includes("/migrations/"));
  const hasAuth        = allFiles.some(f => f.includes("authz") || f.includes("auth.") || f.includes("/auth/"));
  const hasDTO         = allFiles.some(f => f.includes("/dto") || f.includes("dto.") || f.includes("api-client") || f.includes("openapi"));
  const hasBlueprint   = allFiles.some(f => f.includes("blueprint"));
  const hasRoadmap     = allFiles.some(f => f.includes("roadmap") || f.includes("generate-roadmap") || f.includes("roadmap-server") || f.includes("roadmap-ticket"));
  const hasWebPages    = allFiles.some(f => f.includes("apps/web/") || f.includes("/pages/"));
  const hasTransitions = allFiles.some(f => f.includes("transitions"));
  const hasEvents      = allFiles.some(f => f.includes("/events/") || f.includes("event."));
  const hasTests       = allFiles.some(f => f.includes(".test.") || f.includes(".spec.") || f.includes("/__tests__/"));
  const hasGovernance  = allFiles.some(f => f.includes("/governance/"));
  const hasAuditArea   = desc.includes("audit") || desc.includes("finding") || desc.includes("security") || desc.includes("vulnerability");
  const isBackendChange = hasRoutes || hasServices || hasRepos || hasWorkflows || hasSchema || hasAuth || hasTransitions;

  // ── 1. Always-present: validation wizard + commit checklist ──
  targets.push("Run validation wizard: click \u2713 VALIDATE on ticket card (or: node scripts/roadmap-ticket.js validate <ID>)");

  // ── 2. Blueprint refresh — if any backend / API structural change ──
  if (isBackendChange || hasDTO || hasBlueprint) {
    targets.push("refresh docs/blueprint.html — cd apps/api && node blueprint.js");
  }

  // ── 3. Roadmap regeneration — always (keeps queue/recs fresh) ──
  targets.push("refresh docs/roadmap.html — node scripts/generate-roadmap.js");

  // ── 4. PROJECT_STATE.md — architecture decisions, backlog, layer changes ──
  if (isBackendChange || hasAuth || hasGovernance || hasTransitions || hasEvents || ticketType === "spike") {
    targets.push("refresh PROJECT_STATE.md — update if architecture decisions, backlog, or layer rules changed");
  }

  // ── 5. ARCHITECTURE_LOW_CONTEXT_GUIDE.md — auth helpers, layer rules ──
  if (hasAuth || hasRoutes || hasWorkflows || hasServices || hasRepos || hasGovernance) {
    targets.push("refresh apps/api/src/ARCHITECTURE_LOW_CONTEXT_GUIDE.md — update if auth helpers, layer rules, or quick reference touched");
  }

  // ── 6. docs/AUDIT.md — audit-sensitive changes ──
  if (hasAuditArea || hasAuth || hasGovernance || ticketType === "bug") {
    targets.push("refresh docs/AUDIT.md — mark resolved findings, add new findings if applicable");
  }

  // ── 7. SCHEMA_REFERENCE.md — schema changes ──
  if (hasSchema || hasMigrations) {
    targets.push("refresh SCHEMA_REFERENCE.md — update if Prisma schema changed (new models, fields, enums)");
  }

  // ── 8. DTO / OpenAPI / api-client sync — API contract changes ──
  if (hasDTO || hasRoutes || hasSchema) {
    targets.push("verify DTO / OpenAPI / api-client sync — if API shape changed, update all three together");
  }

  // ── 9. Roadmap tooling comments — if roadmap system itself changed ──
  if (hasRoadmap) {
    targets.push("review roadmap tooling docs — update How to Use tab or generator comments if behavior changed");
  }

  // ── 10. UI verification — if frontend changed ──
  if (hasWebPages) {
    targets.push("manual UI verification — check affected pages in browser at localhost:3000");
  }

  // ── 11. Test suite — always ──
  if (hasTests || isBackendChange) {
    targets.push("run full test suite — npx tsc --noEmit && cd apps/api && npm test");
  }

  // ── 12. Commit checklist — always last ──
  targets.push("Commit checklist: npx tsc --noEmit \u2192 npm test \u2192 npm run blueprint");

  return targets;
}

/**
 * Compute testing completeness for any item.
 * Returns { score, max, label, cssClass, missing[] }
 */
function computeTestingCompleteness(item) {
  const missing = [];
  let score = 0;
  const max = 3;

  const tests = item.required_tests || [];
  const protocol = item.test_protocol || "";
  const checklist = item.validation_checklist || [];

  if (tests.length > 0) score++; else missing.push("tests");
  if (protocol.trim()) score++; else missing.push("protocol");
  if (checklist.length > 0) score++; else missing.push("checklist");

  let cssClass, label;
  if (score === max) {
    cssClass = "test-badge-ok";
    label = "\u2714 TESTS " + score + "/" + max;
  } else if (score > 0) {
    cssClass = "test-badge-warn";
    label = "\u26A0 TESTS " + score + "/" + max;
  } else {
    cssClass = "test-badge-missing";
    label = "\u2718 TESTS 0/" + max;
  }

  return { score, max, label, cssClass, missing };
}

/**
 * Generate HTML badge for testing completeness.
 */
function testBadgeHtml(item) {
  const tc = computeTestingCompleteness(item);
  return '<span class="test-badge ' + tc.cssClass + '">' + tc.label + '</span>';
}

/**
 * Generate a warning banner when testing metadata is incomplete.
 * Returns empty string if complete.
 */
function testWarnHtml(item) {
  const tc = computeTestingCompleteness(item);
  if (tc.score === tc.max) return "";
  const warnClass = tc.score === 0 ? "test-warn-banner test-warn-error" : "test-warn-banner";
  return '<div class="' + warnClass + '">\u26A0 Missing: ' + tc.missing.join(", ") + ' \u2014 ticket cannot be validated without all testing metadata</div>';
}

/**
 * Render a VALIDATE button for tickets with complete testing metadata.
 * Shows "VALIDATED" label for already-validated tickets.
 */
function validateBtnHtml(item) {
  if (item.status === "done") {
    if (item.validated_at) return '<span style="font-family:\'IBM Plex Mono\',monospace;font-size:10px;color:#2ecc8a;opacity:.7">\u2713 VALIDATED</span>';
    return '<button class="vw-validate-btn" onclick="tfValidateTicket(\'' + item.id.replace(/'/g, "\\'") + '\')">\u2713 VALIDATE</button>';
  }
  var tc = computeTestingCompleteness(item);
  if (tc.score < tc.max) return '';
  return '<button class="vw-validate-btn" onclick="tfValidateTicket(\'' + item.id.replace(/'/g, "\\'") + '\')">\u2713 VALIDATE</button>';
}

// ═══════════════════════════════════════════════════════════════
// Canonical Implementation Prompt Generator
//
// Single generator used for ALL ticket types: features, slices,
// custom items, backlog cards, recommendations, and NEXT UP hero.
//
// Structure mirrors the project's copilot-instructions and produces
// a ready-to-paste Copilot prompt with:
//   1. Preamble — read guardrail docs
//   2. Before-writing-code inspection checklist
//   3. Architecture rules (shared, never duplicated)
//   4. Ticket-specific sections (goal, files, scope, tests, etc.)
// ═══════════════════════════════════════════════════════════════

/**
 * Normalise any item shape (feature, backlog item, custom item) into
 * a uniform ticket object the canonical prompt can consume.
 */
function normaliseTicketItem(item, roadmap, computed) {
  const statusMap = {};
  for (const f of computed) {
    statusMap[f.id] = { title: f.title, status: f.computedStatus };
    for (const s of (f.slicesComputed || [])) {
      statusMap[s.id] = { title: s.title, status: s.computedStatus };
    }
  }

  const phase = roadmap.phases.find(p => p.id === item.phase);

  // Resolve parent feature (for slices or custom items with parent_feature)
  let parentFeature = null;
  if (item.parentId) {
    parentFeature = computed.find(f => f.id === item.parentId);
  } else if (item.parent_feature) {
    parentFeature = computed.find(f => f.id === item.parent_feature);
  } else if (!item.isSlice && !item.isCustom) {
    parentFeature = computed.find(f => f.id === item.id);
  }

  // Collect files — from files_expected, files, or hooks
  const files = item.files_expected || item.files || [];
  if (files.length === 0 && parentFeature) {
    // For feature-level items, derive from hooks
    files.push(...(parentFeature.hooks_new || []), ...(parentFeature.hooks_existing || []));
  }

  // Build dependency info with statuses
  const depIds = item.depends_on || [];
  const deps = depIds.map(depId => {
    const d = statusMap[depId];
    return d ? { id: depId, title: d.title, status: d.status }
             : { id: depId, title: "(unknown)", status: "unknown" };
  });
  const pendingDeps = deps.filter(d => d.status !== "done");

  // Slices info (for feature-level items)
  const slicesComputed = item.slicesComputed || [];

  return {
    id: item.id,
    title: item.title,
    phase: phase ? { id: phase.id, name: phase.name, goal: phase.goal } : { id: item.phase, name: item.phase, goal: "" },
    type: item.type || "task",
    status: item.computedStatus || item.status || "planned",
    description: item.description || "",
    files: files,
    deps: deps,
    pendingDeps: pendingDeps,
    acceptance_criteria: item.acceptance_criteria || [],
    required_tests: item.required_tests || [],
    test_protocol: item.test_protocol || null,
    validation_checklist: item.validation_checklist || [],
    post_validation: item.post_validation || [],
    notes: item.notes || "",

    // Parent / slice context
    isSlice: !!item.isSlice,
    isCustom: !!item.isCustom,
    parentId: item.parentId || item.parent_feature || null,
    parentTitle: item.parentTitle || (parentFeature ? parentFeature.title : null),
    parentFeature: parentFeature,
    slicesComputed: slicesComputed,

    // Optional enrichment fields
    persona: item.persona || null,
    ticket: item.ticket || null,
    priority: item.priority || null,
    effort: item.effort || null,
    prompt_template: item.prompt_template || null,

    // Hooks (from parent feature or self)
    hooks_existing: (parentFeature || item).hooks_existing || [],
    hooks_new: (parentFeature || item).hooks_new || [],
    detection: (parentFeature || item).detection || null,
  };
}

/**
 * Generate the canonical implementation prompt for any ticket.
 *
 * Works with features (from computed[]), backlog items (from
 * buildBacklogItems()), and custom items (from custom_items[]).
 *
 * @param {object} rawItem   - The raw item (any shape)
 * @param {object} roadmap   - Full ROADMAP.json
 * @param {object[]} computed - Computed features array
 * @param {object} signals   - Codebase signals
 * @param {object} stats     - Aggregate stats
 * @returns {string} Ready-to-paste prompt text
 */
function generateCanonicalPrompt(rawItem, roadmap, computed, signals, stats) {
  const t = normaliseTicketItem(rawItem, roadmap, computed);

  let p = "";

  // ═══ §1 — PREAMBLE ═══
  p += "Read PROJECT_STATE.md, apps/api/src/ARCHITECTURE_LOW_CONTEXT_GUIDE.md, docs/AUDIT.md, and blueprint.js first and obey all guardrails exactly. ";
  p += "Preserve existing behavior unless explicitly required for consistency or safety.\n\n";

  // ═══ §2 — BEFORE WRITING CODE ═══
  p += "Before writing code:\n";
  p += "1. Inspect the current relevant UI/page/feature entry point and identify exactly where the target section or behavior is rendered.\n";
  p += "2. Inspect existing shared components, helpers, workflows, and UI patterns already used in the relevant area.\n";
  p += "3. Inspect the backend source of truth for the relevant data and behavior.\n";
  p += "4. Review blueprint.js so you do not duplicate existing UI, API shape, shared component logic, workflows, or business logic.\n";
  p += "5. Output a short implementation plan before coding, including:\n";
  p += "   - where the current data/behavior is computed\n";
  p += "   - whether the current page already receives enough data\n";
  p += "   - whether UI-only changes are sufficient or a backend DTO/read-model extension is needed\n\n";

  // ═══ §3 — ARCHITECTURE RULES ═══
  p += "Architecture rules:\n";
  p += "- Keep routes thin.\n";
  p += "- Put orchestration in workflows.\n";
  p += "- Keep Prisma access in repositories.\n";
  p += "- Keep status rules in transitions.\n";
  p += "- Emit domain events only from workflows.\n";
  p += "- If an API contract changes, update DTO / include / OpenAPI / api-client / tests together.\n";
  p += "- Reuse existing shared UI patterns/components where possible.\n";
  p += "- Do not create a second source-of-truth implementation if one already exists.\n";
  p += "- Raw http.createServer \u2014 no Express/NestJS.\n";
  p += "- Use canonical include constants from repositories \u2014 no inline include trees.\n\n";

  // ═══ §4 — TICKET IDENTITY ═══
  p += "---\n\n";
  p += "## " + t.id + ": " + t.title + "\n\n";

  // ── Slice name / context ──
  if (t.isSlice && t.parentId) {
    p += "Slice of: " + t.parentId + " \u2014 " + (t.parentTitle || "") + "\n";
  } else if (t.isCustom && t.parentId) {
    p += "Parent feature: " + t.parentId + " \u2014 " + (t.parentTitle || "") + "\n";
  }
  p += "Phase: " + t.phase.id + " \u2014 " + t.phase.name + "\n";
  p += "Type: " + t.type + "\n";
  if (t.persona) p += "Persona: " + t.persona + "\n";
  if (t.priority) p += "Priority: " + t.priority + "/5\n";
  if (t.effort) p += "Effort: " + t.effort.toUpperCase() + "\n";
  if (t.ticket) p += "Ticket ref: " + t.ticket + "\n";
  p += "\n";

  // ── Goal ──
  p += "### Goal\n";
  p += t.description + "\n";
  if (t.phase.goal) {
    p += "\nPhase goal: " + t.phase.goal + "\n";
  }
  p += "\n";

  // ── Primary workflow affected ──
  // Derive from context engine
  const ctxItem = Object.assign({}, rawItem, {
    hooks_existing: t.hooks_existing,
    hooks_new: t.hooks_new,
    detection: t.detection,
  });
  let ctx = null;
  if (signals && stats) {
    ctx = deriveTaskContext(ctxItem, signals, roadmap, stats, computed);
  }
  if (ctx && ctx.relevantWorkflows.length > 0) {
    p += "### Primary workflow affected\n";
    p += ctx.relevantWorkflows.map(w => w + ".ts").join(", ") + "\n\n";
  }

  // ── Files to modify — in order ──
  if (t.files.length > 0) {
    p += "### Files to modify \u2014 in order\n";
    for (const f of t.files) p += "- " + f + "\n";
    p += "\n";
  }

  // ── Auth ──
  // Derive from persona or parent feature
  if (t.persona) {
    const authMap = {
      manager: "requireRole(req, res, 'MANAGER') or maybeRequireManager(req, res) for reads",
      tenant: "requireTenantSession(req, res) \u2014 never accept tenantId as query param",
      owner: "requireRole(req, res, 'OWNER') or maybeRequireManager(req, res) for reads",
      contractor: "requireAnyRole(req, res, ['CONTRACTOR', 'MANAGER'])",
    };
    p += "### Auth\n";
    p += (authMap[t.persona] || "requireAuth(req, res)") + "\n\n";
  }

  // ── In scope ──
  p += "### In scope\n";
  if (t.acceptance_criteria.length > 0) {
    for (const ac of t.acceptance_criteria) p += "- " + ac + "\n";
  } else if (t.slicesComputed.length > 0) {
    // For feature-level: list slices as scope
    for (const s of t.slicesComputed) {
      const mark = s.computedStatus === "done" ? "\u2714" : s.computedStatus === "in_progress" ? "\u25B6" : "\u25CB";
      p += mark + " " + s.id + ": " + s.title + "\n";
    }
  } else {
    p += "- " + t.title + "\n";
  }
  p += "\n";

  // ── Out of scope ──
  p += "### Out of scope\n";
  p += "- Unrelated refactors or features not listed above\n";
  p += "- Changes to models or APIs not required by this ticket\n";
  if (t.pendingDeps.length > 0) {
    p += "- Implementing blocked dependencies (" + t.pendingDeps.map(d => d.id).join(", ") + ") \u2014 those are separate tickets\n";
  }
  p += "\n";

  // ── Implementation requirements ──
  p += "### Implementation requirements\n";
  if (t.hooks_existing.length > 0) {
    p += "Existing hooks (already in codebase):\n";
    for (const h of t.hooks_existing) p += "- " + h + "\n";
  }
  if (t.hooks_new.length > 0) {
    p += "New hooks (to create):\n";
    for (const h of t.hooks_new) p += "- " + h + "\n";
  }
  if (t.prompt_template) {
    p += "Implementation hint: " + t.prompt_template + "\n";
  }
  // Slice breakdown for feature-level items
  if (t.slicesComputed.length > 0) {
    p += "Implementation slices (" + t.slicesComputed.filter(s => s.computedStatus === "done").length + "/" + t.slicesComputed.length + " done):\n";
    for (const s of t.slicesComputed) {
      const mark = s.computedStatus === "done" ? "\u2714" : s.computedStatus === "in_progress" ? "\u25B6" : "\u25CB";
      p += mark + " " + s.id + ": " + s.title + " [" + (s.type || "task") + "]\n";
      if (s.files_expected && s.files_expected.length > 0) {
        p += "  files: " + s.files_expected.join(", ") + "\n";
      }
      if (s.acceptance_criteria && s.acceptance_criteria.length > 0) {
        for (const ac of s.acceptance_criteria) p += "  \u2022 " + ac + "\n";
      }
      if (s.prompt_template) p += "  hint: " + s.prompt_template + "\n";
    }
  }
  if (t.deps.length > 0) {
    p += "Dependencies:\n";
    for (const d of t.deps) p += "- " + d.id + ": " + d.title + " (" + d.status + ")\n";
    if (t.pendingDeps.length > 0) {
      p += "Blocked by: " + t.pendingDeps.map(d => d.id).join(", ") + "\n";
    }
  }
  if (t.hooks_existing.length === 0 && t.hooks_new.length === 0 && !t.prompt_template && t.slicesComputed.length === 0 && t.deps.length === 0) {
    p += "- Follow standard layer conventions for this ticket type\n";
  }
  p += "\n";

  // ── Derived architectural context ──
  if (ctx) {
    p += formatContextBlock(ctx);
    p += "\n";
  }

  // ── Required output before code ──
  p += "### Required output before code\n";
  p += "Output a short implementation plan including:\n";
  p += "- Where the current data/behavior is computed\n";
  p += "- Whether the current page already receives enough data\n";
  p += "- Whether UI-only changes are sufficient or a backend DTO/read-model extension is needed\n";
  p += "- Files to touch, in order\n\n";

  // ── Definition of done ──
  p += "### Definition of done\n";
  if (t.acceptance_criteria.length > 0) {
    for (const ac of t.acceptance_criteria) p += "- [ ] " + ac + "\n";
  } else {
    p += "- [ ] Feature works as described in Goal\n";
  }
  p += "- [ ] No TypeScript errors (`npx tsc --noEmit`)\n";
  p += "- [ ] All existing tests still pass\n";
  p += "- [ ] No layer violations introduced\n";
  p += "- [ ] Blueprint regenerated (`npm run blueprint`)\n\n";

  // ── Tests to add/update ──
  p += "### Tests to add/update\n";
  const itemTests = t.required_tests;
  if (itemTests.length > 0) {
    for (const test of itemTests) p += "- [ ] " + test + "\n";
  } else {
    // Derive defaults from files
    const allFiles = t.files;
    const hasRoute = allFiles.some(f => f.includes("route"));
    const hasWorkflow = allFiles.some(f => f.includes("workflow"));
    const hasService = allFiles.some(f => f.includes("service"));
    const hasRepo = allFiles.some(f => f.includes("repositor"));
    if (hasRepo || hasService) p += "- [ ] Unit tests for service/repository functions\n";
    if (hasRoute) p += "- [ ] Integration test for API endpoint(s)\n";
    if (hasWorkflow) p += "- [ ] Workflow state-transition tests\n";
    const contractEndpoints = ["/requests", "/jobs", "/invoices", "/leases"];
    const needsContract = contractEndpoints.some(ep =>
      (t.title + " " + t.description).toLowerCase().includes(ep.replace("/", ""))
    );
    if (needsContract) p += "- [ ] Contract test (required for GET endpoint)\n";
    if (!hasRoute && !hasWorkflow && !hasService && !hasRepo) {
      p += "- [ ] Verify feature detection signals pass after implementation\n";
    }
    p += "- [ ] No regressions in existing test suite\n";
  }
  p += "\n";

  // ── Test protocol ──
  p += "### Test protocol\n";
  if (t.test_protocol) {
    p += t.test_protocol + "\n";
  } else {
    p += "Run in order \u2014 all must pass before marking complete:\n";
    p += "1. `npx tsc --noEmit` \u2014 zero TypeScript errors\n";
    p += "2. `npm test` \u2014 all tests pass\n";
    p += "3. `npm run blueprint` \u2014 architecture docs sync\n";
    p += "4. Ticket-specific verification: verify acceptance criteria manually\n";
    p += "5. Regression checks: verify adjacent features still work\n";
    p += "6. API contract sync: if API changed, verify DTOs/OpenAPI/api-client match\n";
    p += "7. UI verification: if UI changed, manual check in browser\n";
    p += "8. Edge cases: verify behavior with missing/null data\n";
  }
  p += "\n";

  // ── Validation checklist ──
  p += "### Validation checklist\n";
  if (t.validation_checklist.length > 0) {
    for (const v of t.validation_checklist) p += "- [ ] " + v + "\n";
  } else {
    p += "- [ ] All acceptance criteria verified\n";
    p += "- [ ] No TypeScript errors (npx tsc --noEmit)\n";
    p += "- [ ] All tests pass (npm test)\n";
    p += "- [ ] No layer violations introduced\n";
    p += "- [ ] Blueprint regenerated (npm run blueprint)\n";
  }
  p += "\n";

  // ── Post-validation updates ──
  // Use ticket's explicit post_validation if present; otherwise infer from files + type
  const pvItems = t.post_validation.length > 0
    ? t.post_validation
    : inferPostValidationTargets(t.files, t.type, t.description);
  p += "### Post-validation updates\n";
  if (pvItems.length > 0) {
    for (const pv of pvItems) p += "- " + pv + "\n";
    if (t.post_validation.length === 0) {
      p += "\n_(auto-inferred from files and ticket type — override via post_validation field)_\n";
    }
  } else {
    p += "- Run validation wizard, refresh blueprint + roadmap, commit with tsc/test/blueprint\n";
  }

  p += "\nFocus exclusively on this task. Do not refactor unrelated code.\n";

  return p;
}

// Backward-compatible aliases used by call sites
function generateCopilotPrompt(feature, roadmap, computed, signals, stats) {
  return generateCanonicalPrompt(feature, roadmap, computed, signals, stats);
}
function generateTicketPrompt(item, roadmap, computed, signals, stats) {
  return generateCanonicalPrompt(item, roadmap, computed, signals, stats);
}

// ─── CSS ──────────────────────────────────────────────────────

const CSS = `
@import url('https://fonts.googleapis.com/css2?family=IBM+Plex+Mono:wght@400;500;600&family=IBM+Plex+Sans:wght@300;400;500;600&display=swap');
:root{--bg:#0a0c10;--surface:#111318;--surface2:#181c24;--border:#1e2433;--border2:#2a3045;--text:#c8d0e0;--text-dim:#5a6580;--text-bright:#eef0f5;--accent-blue:#3d7eff;--accent-cyan:#00d4c8;--line:rgba(255,255,255,.06);--p0:#2ecc8a;--p1:#3d7eff;--p2:#9b6dff;--p3:#f5a623;--p4:#ff7c3a}
*{margin:0;padding:0;box-sizing:border-box}
body{background:var(--bg);color:var(--text);font-family:'IBM Plex Sans',sans-serif;font-size:15px;line-height:1.5}
body::before{content:'';position:fixed;inset:0;background-image:linear-gradient(var(--line) 1px,transparent 1px),linear-gradient(90deg,var(--line) 1px,transparent 1px);background-size:40px 40px;pointer-events:none;z-index:0}
.page{position:relative;z-index:1;max-width:1400px;margin:0 auto;padding:40px 32px 80px}
.header{display:flex;align-items:flex-start;justify-content:space-between;margin-bottom:28px;padding-bottom:20px;border-bottom:1px solid var(--border2)}
.doc-label{font-family:'IBM Plex Mono',monospace;font-size:12px;letter-spacing:.2em;text-transform:uppercase;color:var(--accent-blue);margin-bottom:8px}
.doc-title{font-size:28px;font-weight:600;color:var(--text-bright);letter-spacing:-.02em}
.doc-subtitle{font-size:15px;color:var(--text-dim);margin-top:4px}
.header-meta{text-align:right;font-family:'IBM Plex Mono',monospace;font-size:13px;color:var(--text-dim);line-height:1.8}
.meta-val{color:var(--text)}
.live-badge{display:inline-flex;align-items:center;gap:5px;background:rgba(46,204,138,.1);border:1px solid rgba(46,204,138,.3);border-radius:3px;padding:2px 8px;font-size:12px;color:#5ed9a0;font-family:'IBM Plex Mono',monospace;margin-bottom:6px}
.live-dot{width:6px;height:6px;border-radius:50%;background:#2ecc8a;animation:pulse 2s infinite}
@keyframes pulse{0%,100%{opacity:1}50%{opacity:.4}}
.stat-grid{display:grid;grid-template-columns:repeat(7,1fr);gap:1px;background:var(--border);border:1px solid var(--border);border-radius:6px;overflow:hidden;margin-bottom:12px}
.health-bar{display:flex;align-items:center;gap:8px;padding:6px 12px;border-radius:4px;font-family:'IBM Plex Mono',monospace;font-size:12px;margin-bottom:20px}
.health-ok{background:rgba(46,204,138,.06);border:1px solid rgba(46,204,138,.2);color:#5ed9a0}
.health-warn{background:rgba(245,166,35,.06);border:1px solid rgba(245,166,35,.2);color:#f5a623}
.stat-cell{background:var(--surface);padding:14px;text-align:center}
.stat-num{font-family:'IBM Plex Mono',monospace;font-size:24px;font-weight:600;display:block;line-height:1;margin-bottom:4px}
.stat-label{font-size:12px;color:var(--text-dim);letter-spacing:.08em;text-transform:uppercase}
.tab-nav{display:flex;gap:2px;margin-bottom:20px;border-bottom:1px solid var(--border2)}
.tab-btn{padding:7px 14px;font-size:13px;font-weight:500;letter-spacing:.06em;text-transform:uppercase;color:var(--text-dim);cursor:pointer;border:none;background:none;border-bottom:2px solid transparent;margin-bottom:-1px;font-family:'IBM Plex Mono',monospace;transition:all .1s}
.tab-btn:hover{color:var(--text)}.tab-btn.active{color:var(--accent-blue);border-bottom-color:var(--accent-blue)}
.tab-pane{display:none}.tab-pane.active{display:block}
.filter-bar{display:flex;gap:6px;margin-bottom:16px;flex-wrap:wrap;align-items:center}
.filter-btn{padding:4px 10px;font-family:'IBM Plex Mono',monospace;font-size:12px;border:1px solid var(--border2);border-radius:3px;background:var(--surface);color:var(--text-dim);cursor:pointer;transition:all .1s}
.filter-btn:hover{color:var(--text)}.filter-btn.active{color:var(--accent-blue);border-color:rgba(61,126,255,.4);background:rgba(61,126,255,.08)}
.phase-block{border:1px solid var(--border);border-radius:6px;overflow:hidden;margin-bottom:14px}
.phase-head{display:flex;align-items:center;gap:12px;padding:10px 16px}
.phase-badge{font-family:'IBM Plex Mono',monospace;font-size:11px;font-weight:600;letter-spacing:.15em;padding:2px 7px;border-radius:2px;border:1px solid}
.phase-title{font-size:16px;font-weight:600;color:var(--text-bright)}
.phase-window{font-family:'IBM Plex Mono',monospace;font-size:12px;color:var(--text-dim)}
.phase-goal{font-size:13px;color:var(--text-dim);padding:8px 16px;background:var(--surface2);font-style:italic;border-bottom:1px solid var(--border)}
.phase-progress{display:flex;align-items:center;gap:10px;padding:6px 16px;background:var(--surface2);border-bottom:1px solid var(--border)}
.phase-progress-bar{flex:1;height:4px;background:var(--border2);border-radius:2px;max-width:200px}
.phase-progress-fill{height:100%;border-radius:2px;background:var(--p0)}
.phase-body{padding:14px 16px;background:var(--surface)}
.feature-grid{display:grid;grid-template-columns:1fr 1fr;gap:8px;margin-bottom:10px}
.feature-card{background:var(--surface2);border:1px solid var(--border);border-radius:4px;padding:10px 12px;transition:border-color .15s}
.feature-card:hover{border-color:var(--border2)}
.feature-card[data-status="done"]{border-left:3px solid var(--p0)}
.feature-card[data-status="in_progress"]{border-left:3px solid var(--p3)}
.feature-card[data-status="blocked"]{border-left:3px solid #ff5a5a}
.feature-card-head{display:flex;align-items:flex-start;gap:7px;margin-bottom:5px}
.status-dot{width:8px;height:8px;border-radius:50%;flex-shrink:0;margin-top:3px}
.feature-name{font-size:14px;font-weight:600;color:var(--text-bright);flex:1}
.feature-type{font-family:'IBM Plex Mono',monospace;font-size:11px;padding:1px 5px;border-radius:2px;border:1px solid;white-space:nowrap;flex-shrink:0;margin-top:2px}
.type-wire{color:#b899ff;border-color:rgba(155,109,255,.3);background:rgba(155,109,255,.08)}
.type-build{color:#7aaeff;border-color:rgba(61,126,255,.3);background:rgba(61,126,255,.08)}
.type-extend{color:#4de8e0;border-color:rgba(0,212,200,.3);background:rgba(0,212,200,.08)}
.type-product{color:#f5c060;border-color:rgba(245,166,35,.3);background:rgba(245,166,35,.08)}
.type-infra{color:#ff8080;border-color:rgba(255,90,90,.3);background:rgba(255,90,90,.08)}
.type-refactor{color:#5ed9a0;border-color:rgba(46,204,138,.3);background:rgba(46,204,138,.08)}
.type-story{color:#4de8e0;border-color:rgba(0,212,200,.3);background:rgba(0,212,200,.08)}
.type-task{color:#c8d0e0;border-color:rgba(200,208,224,.2);background:rgba(200,208,224,.05)}
.type-bug{color:#ff8080;border-color:rgba(255,90,90,.3);background:rgba(255,90,90,.08)}
.type-spike{color:#b899ff;border-color:rgba(155,109,255,.3);background:rgba(155,109,255,.08)}
.feature-status-bar{display:flex;gap:10px;margin-bottom:5px;flex-wrap:wrap;overflow:hidden}
.feature-desc{font-size:13px;color:var(--text-dim);line-height:1.5;margin-bottom:7px}
.feature-hooks{display:flex;flex-wrap:wrap;gap:4px}
.hook{font-family:'IBM Plex Mono',monospace;font-size:11px;padding:2px 5px;border-radius:2px;background:rgba(255,255,255,.04);border:1px solid var(--border2);color:var(--text-dim)}
.hook.exists{color:#5ed9a0;border-color:rgba(46,204,138,.25);background:rgba(46,204,138,.06)}
.hook.new{color:#f5c060;border-color:rgba(245,166,35,.25);background:rgba(245,166,35,.06)}
.hook.blocked{color:#ff8080;border-color:rgba(255,90,90,.25);background:rgba(255,90,90,.06)}
.custom-items-block{border-top:1px solid var(--border);margin-top:10px;padding-top:10px}
.custom-item{background:var(--bg);border:1px solid var(--border);border-radius:4px;padding:9px 12px;margin-bottom:6px}
.custom-item-head{display:flex;align-items:center;gap:8px;margin-bottom:5px;flex-wrap:wrap}
.custom-item-type{font-family:'IBM Plex Mono',monospace;font-size:11px;padding:1px 5px;border-radius:2px;border:1px solid}
.custom-item-persona{font-family:'IBM Plex Mono',monospace;font-size:12px;color:var(--accent-cyan);background:rgba(0,212,200,.08);border:1px solid rgba(0,212,200,.2);padding:1px 5px;border-radius:2px}
.custom-item-ticket{font-family:'IBM Plex Mono',monospace;font-size:12px;color:var(--accent-blue);background:rgba(61,126,255,.08);border:1px solid rgba(61,126,255,.2);padding:1px 5px;border-radius:2px}
.custom-item-title{font-size:14px;font-weight:500;color:var(--text-bright);margin-bottom:4px}
.custom-item-notes{font-size:13px;color:var(--text-dim);font-style:italic}
.intake-section{margin-bottom:20px}
.intake-section-title{font-family:'IBM Plex Mono',monospace;font-size:13px;font-weight:600;letter-spacing:.08em;text-transform:uppercase;color:var(--text-bright);margin-bottom:10px;display:flex;align-items:center;gap:8px}
.intake-section-title .count-badge{font-size:11px;padding:1px 6px;border-radius:8px;background:var(--surface2);color:var(--text-dim);border:1px solid var(--border2)}
.intake-card{background:var(--bg);border:1px solid var(--border);border-radius:4px;padding:10px 12px;margin-bottom:6px}
.intake-card-head{display:flex;align-items:center;gap:8px;margin-bottom:5px;flex-wrap:wrap}
.intake-status{font-family:'IBM Plex Mono',monospace;font-size:11px;padding:1px 5px;border-radius:2px;border:1px solid}
.intake-status-raw{color:var(--accent-blue);border-color:rgba(61,126,255,.3);background:rgba(61,126,255,.08)}
.intake-status-triaged{color:var(--accent-cyan);border-color:rgba(0,212,200,.3);background:rgba(0,212,200,.08)}
.intake-status-drafted{color:var(--p3);border-color:rgba(245,166,35,.3);background:rgba(245,166,35,.08)}
.intake-status-promoted{color:var(--p0);border-color:rgba(0,255,136,.3);background:rgba(0,255,136,.08)}
.intake-status-parked{color:var(--text-dim);border-color:var(--border2);background:var(--surface2)}
.intake-status-duplicate{color:#c87040;border-color:rgba(200,112,64,.3);background:rgba(200,112,64,.08)}
.intake-meta-row{display:flex;gap:6px;flex-wrap:wrap;margin-top:4px}
.intake-meta-tag{font-family:'IBM Plex Mono',monospace;font-size:11px;padding:1px 5px;border-radius:2px;border:1px solid var(--border2);color:var(--text-dim)}
.intake-meta-tag-area{color:var(--accent-cyan);border-color:rgba(0,212,200,.2)}
.intake-meta-tag-phase{color:var(--p1);border-color:rgba(61,126,255,.2)}
.intake-scope-list{font-family:'IBM Plex Mono',monospace;font-size:11px;color:var(--text-dim);margin:4px 0 0 12px;line-height:1.8}
.intake-raw{font-size:13px;color:var(--text);white-space:pre-wrap;line-height:1.6;margin:6px 0}
.intake-concern{background:var(--surface2);border:1px solid var(--border2);border-radius:3px;padding:6px 10px;margin:4px 0;font-size:12px}
.intake-concern-summary{color:var(--text-bright);font-weight:500}
.intake-concern-meta{color:var(--text-dim);font-family:'IBM Plex Mono',monospace;font-size:11px;margin-top:2px}
.draft-card{background:var(--bg);border:1px solid var(--border);border-radius:4px;padding:10px 12px;margin-bottom:6px;border-left:3px solid var(--accent-blue)}
.draft-card-head{display:flex;align-items:center;gap:8px;margin-bottom:5px;flex-wrap:wrap}
.draft-status{font-family:'IBM Plex Mono',monospace;font-size:11px;padding:1px 5px;border-radius:2px;border:1px solid}
.draft-status-draft{color:var(--accent-blue);border-color:rgba(61,126,255,.3);background:rgba(61,126,255,.08)}
.draft-status-ready{color:var(--p0);border-color:rgba(0,255,136,.3);background:rgba(0,255,136,.08)}
.draft-status-promoted{color:var(--accent-cyan);border-color:rgba(0,212,200,.3);background:rgba(0,212,200,.08)}
.draft-status-discarded{color:var(--text-dim);border-color:var(--border2);background:var(--surface2)}
.refinement-badge{font-family:'IBM Plex Mono',monospace;font-size:10px;padding:1px 5px;border-radius:2px;border:1px solid;margin-left:4px}
.refinement-unrefined{color:#888;border-color:#555;background:rgba(136,136,136,.08)}
.refinement-refined{color:var(--accent-blue);border-color:rgba(61,126,255,.3);background:rgba(61,126,255,.08)}
.refinement-refined_blocked{color:#ff5252;border-color:rgba(255,82,82,.3);background:rgba(255,82,82,.08)}
.refinement-ready_candidate{color:var(--p0);border-color:rgba(0,255,136,.3);background:rgba(0,255,136,.12)}
.draft-story-context{font-size:11px;color:var(--text-dim);margin-top:6px;padding:6px 8px;background:rgba(167,139,250,.06);border:1px solid rgba(167,139,250,.15);border-radius:3px}
.draft-story-context .label{text-transform:uppercase;letter-spacing:.05em;color:rgba(167,139,250,.8);font-size:10px;margin-bottom:2px}
.draft-sibling-tag{font-family:'IBM Plex Mono',monospace;font-size:11px;padding:1px 5px;border-radius:2px;color:rgba(167,139,250,.9);border:1px solid rgba(167,139,250,.2);background:rgba(167,139,250,.06);cursor:default}
.intake-form{margin-bottom:16px}
.intake-form textarea{width:100%;min-height:120px;background:var(--bg);border:1px solid var(--border);border-radius:4px;padding:10px;color:var(--text);font-family:'IBM Plex Mono',monospace;font-size:13px;resize:vertical;box-sizing:border-box}
.intake-form textarea:focus{outline:none;border-color:var(--accent-blue)}
.intake-form-row{display:flex;gap:8px;margin-top:8px;align-items:center}
.intake-form input[type="text"]{background:var(--bg);border:1px solid var(--border);border-radius:4px;padding:5px 10px;color:var(--text);font-family:'IBM Plex Mono',monospace;font-size:13px;flex:1}
.intake-btn{font-family:'IBM Plex Mono',monospace;font-size:12px;padding:4px 12px;border-radius:3px;border:1px solid;cursor:pointer;letter-spacing:.04em}
.intake-btn-primary{background:var(--accent-blue);color:#000;border-color:var(--accent-blue)}
.intake-btn-primary:hover{opacity:.85}
.intake-btn-secondary{background:transparent;color:var(--text-dim);border-color:var(--border2)}
.intake-btn-secondary:hover{color:var(--text);border-color:var(--text-dim)}
.intake-btn-promote{background:var(--p0);color:#000;border-color:var(--p0)}
.intake-btn-promote:hover{opacity:.85}
.intake-btn-danger{background:transparent;color:#ff5252;border-color:rgba(255,82,82,.3)}
.intake-btn-danger:hover{background:rgba(255,82,82,.1)}
.intake-empty{padding:40px;text-align:center;color:var(--text-dim);font-family:'IBM Plex Mono',monospace;font-size:14px}
.intake-toolbar{display:flex;gap:8px;margin-bottom:16px;flex-wrap:wrap;align-items:center}
.intake-toolbar-group{display:flex;gap:6px;align-items:center}
.intake-toolbar-spacer{flex:1}
.intake-filter-bar{display:flex;gap:4px;margin-bottom:14px;flex-wrap:wrap;align-items:center}
.intake-filter-btn{padding:3px 9px;font-family:'IBM Plex Mono',monospace;font-size:11px;border:1px solid var(--border2);border-radius:3px;background:var(--surface);color:var(--text-dim);cursor:pointer;transition:all .1s;text-transform:uppercase;letter-spacing:.06em}
.intake-filter-btn:hover{color:var(--text)}.intake-filter-btn.active{color:var(--accent-blue);border-color:rgba(61,126,255,.4);background:rgba(61,126,255,.08)}
.intake-bulk-panel{background:var(--surface);border:1px solid var(--border);border-radius:6px;padding:14px;margin-bottom:16px;display:none}
.intake-bulk-panel.open{display:block}
.intake-bulk-panel textarea{width:100%;min-height:180px;background:var(--bg);border:1px solid var(--border);border-radius:4px;padding:10px;color:var(--text);font-family:'IBM Plex Mono',monospace;font-size:13px;resize:vertical;box-sizing:border-box;margin-bottom:8px}
.intake-bulk-panel textarea:focus{outline:none;border-color:var(--accent-blue)}
.intake-bulk-preview{background:var(--bg);border:1px solid var(--border);border-radius:4px;padding:10px;margin:8px 0;max-height:300px;overflow-y:auto;display:none}
.intake-bulk-preview.open{display:block}
.intake-bulk-item{padding:6px 8px;border-bottom:1px solid var(--border);font-size:13px;color:var(--text);font-family:'IBM Plex Mono',monospace;display:flex;gap:8px;align-items:flex-start}
.intake-bulk-item:last-child{border-bottom:none}
.intake-bulk-num{color:var(--accent-blue);font-weight:600;min-width:20px}
.intake-card-body{margin-top:6px}
.intake-raw-preview{font-size:13px;color:var(--text);line-height:1.5;max-height:48px;overflow:hidden;white-space:pre-wrap}
.intake-raw-preview.expanded{max-height:none}
.intake-raw-toggle{font-family:'IBM Plex Mono',monospace;font-size:11px;color:var(--accent-blue);cursor:pointer;margin-top:2px;border:none;background:none;padding:0}
.intake-card-actions{display:flex;gap:4px;margin-top:8px;padding-top:6px;border-top:1px solid var(--border);flex-wrap:wrap}
.intake-action-rec{display:inline-flex;align-items:center;gap:4px;padding:2px 8px;border-radius:3px;font-family:'IBM Plex Mono',monospace;font-size:11px;border:1px solid;margin-left:auto}
.intake-rec-triage{color:var(--accent-blue);border-color:rgba(61,126,255,.3);background:rgba(61,126,255,.06)}
.intake-rec-draft{color:var(--accent-cyan);border-color:rgba(0,212,200,.3);background:rgba(0,212,200,.06)}
.intake-rec-review{color:var(--p3);border-color:rgba(245,166,35,.3);background:rgba(245,166,35,.06)}
.intake-rec-done{color:var(--p0);border-color:rgba(0,255,136,.3);background:rgba(0,255,136,.06)}
.intake-rec-parked{color:var(--text-dim);border-color:var(--border2);background:var(--surface2)}
.intake-edit-overlay{position:fixed;top:0;left:0;right:0;bottom:0;background:rgba(0,0,0,.7);z-index:1000;display:none;justify-content:center;align-items:flex-start;padding:60px 20px;overflow-y:auto}
.intake-edit-overlay.open{display:flex}
.intake-edit-panel{background:var(--surface);border:1px solid var(--border);border-radius:8px;width:100%;max-width:600px;padding:20px}
.intake-edit-panel h3{font-family:'IBM Plex Mono',monospace;font-size:15px;color:var(--text-bright);margin:0 0 14px 0;letter-spacing:.04em}
.intake-edit-row{margin-bottom:10px}
.intake-edit-row label{display:block;font-family:'IBM Plex Mono',monospace;font-size:11px;color:var(--text-dim);text-transform:uppercase;letter-spacing:.08em;margin-bottom:3px}
.intake-edit-row input,.intake-edit-row textarea,.intake-edit-row select{width:100%;background:var(--bg);border:1px solid var(--border);border-radius:4px;padding:6px 10px;color:var(--text);font-family:'IBM Plex Mono',monospace;font-size:13px;box-sizing:border-box}
.intake-edit-row textarea{min-height:80px;resize:vertical}
.intake-edit-row select{appearance:none;-webkit-appearance:none}
.intake-edit-actions{display:flex;gap:8px;margin-top:14px;justify-content:flex-end}
.intake-triage-panel{margin-top:8px;padding:8px 10px;background:var(--surface2);border:1px solid var(--border);border-radius:4px;font-family:'IBM Plex Mono',monospace;font-size:12px}
.intake-triage-row{display:flex;align-items:center;gap:6px;margin-bottom:4px;flex-wrap:wrap}
.intake-triage-row:last-child{margin-bottom:0}
.intake-triage-label{color:var(--text-dim);font-size:11px;text-transform:uppercase;letter-spacing:.06em;min-width:60px}
.intake-triage-val{color:var(--text)}
.intake-action-badge{display:inline-flex;align-items:center;gap:3px;padding:2px 7px;border-radius:3px;font-size:11px;font-weight:600;border:1px solid;text-transform:uppercase;letter-spacing:.04em}
.action-execute{color:var(--p0);border-color:rgba(0,255,136,.3);background:rgba(0,255,136,.06)}
.action-split{color:var(--accent-cyan);border-color:rgba(0,212,200,.3);background:rgba(0,212,200,.06)}
.action-attach{color:var(--accent-blue);border-color:rgba(61,126,255,.3);background:rgba(61,126,255,.06)}
.action-blocked{color:#ff5a5a;border-color:rgba(255,90,90,.3);background:rgba(255,90,90,.06)}
.action-duplicate{color:var(--p3);border-color:rgba(245,166,35,.3);background:rgba(245,166,35,.06)}
.action-park{color:var(--text-dim);border-color:var(--border2);background:var(--surface)}
.scope-badge{display:inline-flex;padding:1px 6px;border-radius:2px;font-size:11px;border:1px solid var(--border2);color:var(--text-dim)}
.scope-small{color:var(--p0);border-color:rgba(0,255,136,.2)}.scope-medium{color:var(--accent-blue);border-color:rgba(61,126,255,.2)}.scope-large{color:var(--p3);border-color:rgba(245,166,35,.2)}.scope-epic{color:#ff5a5a;border-color:rgba(255,90,90,.2)}
.intake-split-plan{margin-top:4px;padding-left:12px;list-style:none}
.intake-split-plan li{font-size:11px;color:var(--text-dim);padding:1px 0}.intake-split-plan li::before{content:'\u2192 ';color:var(--accent-cyan)}
.pipeline-bar{display:flex;gap:2px;margin-bottom:20px;background:var(--surface);border:1px solid var(--border);border-radius:6px;overflow:hidden}
.pipeline-seg{flex:1;padding:10px 14px;cursor:pointer;text-align:center;transition:background .15s;border-right:1px solid var(--border)}
.pipeline-seg:last-child{border-right:none}
.pipeline-seg:hover{background:var(--surface2)}
.pipeline-seg.active{background:rgba(61,126,255,.08)}
.pipeline-seg-label{font-family:'IBM Plex Mono',monospace;font-size:12px;font-weight:600;letter-spacing:.06em;text-transform:uppercase;color:var(--text-dim)}
.pipeline-seg.active .pipeline-seg-label{color:var(--accent-blue)}
.pipeline-seg-count{font-family:'IBM Plex Mono',monospace;font-size:22px;font-weight:700;color:var(--text-bright);margin-top:2px}
.pipeline-seg.active .pipeline-seg-count{color:var(--accent-blue)}
.pipeline-stage{display:none}.pipeline-stage.active{display:block}
.pipeline-feedback{padding:6px 12px;border-radius:4px;font-family:'IBM Plex Mono',monospace;font-size:12px;margin-bottom:8px;display:none;animation:pfIn .3s}
.pipeline-feedback.success{display:block;background:rgba(46,204,138,.1);border:1px solid rgba(46,204,138,.3);color:var(--p0)}
.pipeline-feedback.error{display:block;background:rgba(255,82,82,.1);border:1px solid rgba(255,82,82,.3);color:#ff5252}
@keyframes pfIn{from{opacity:0;transform:translateY(-4px)}to{opacity:1;transform:none}}
.capture-card{background:var(--bg);border:1px solid var(--border);border-radius:4px;padding:12px;margin-bottom:8px}
.capture-card-title{font-size:14px;font-weight:600;color:var(--text-bright);margin-bottom:4px}
.capture-card-text{font-size:13px;color:var(--text);line-height:1.5;max-height:72px;overflow:hidden;white-space:pre-wrap}.capture-card-text.expanded{max-height:none}
.capture-card-actions{display:flex;gap:6px;margin-top:10px;padding-top:8px;border-top:1px solid var(--border);flex-wrap:wrap}
.ready-epic{background:var(--surface);border:1px solid var(--border);border-radius:6px;margin-bottom:12px;overflow:hidden}
.ready-epic-head{padding:10px 14px;display:flex;align-items:center;gap:8px;border-bottom:1px solid var(--border)}
.ready-epic-title{font-size:14px;font-weight:600;color:var(--text-bright);flex:1}
.ready-epic-body{padding:8px}
.ready-story{background:var(--bg);border:1px solid var(--border);border-radius:4px;padding:10px 12px;margin-bottom:6px}
.ready-story-head{display:flex;align-items:center;gap:8px;margin-bottom:4px}
.ready-story-dot{width:8px;height:8px;border-radius:50%;flex-shrink:0}
.ready-story-dot-green{background:var(--p0)}.ready-story-dot-yellow{background:var(--p3)}.ready-story-dot-red{background:#ff5252}
.ready-story-title{font-size:13px;font-weight:500;color:var(--text-bright);flex:1}
.ready-unblock{background:rgba(255,82,82,.06);border:1px solid rgba(255,82,82,.2);border-radius:3px;padding:6px 8px;margin-top:6px;font-size:12px;color:var(--text-dim)}
.ready-prompt-toggle{font-family:'IBM Plex Mono',monospace;font-size:11px;color:var(--accent-blue);cursor:pointer;border:none;background:none;padding:0;margin-top:4px}
.ready-prompt-block{display:none;margin-top:6px;background:rgba(0,0,0,.3);border:1px solid var(--border);border-radius:4px;padding:10px;font-family:'IBM Plex Mono',monospace;font-size:12px;color:var(--text);white-space:pre-wrap;max-height:300px;overflow-y:auto}
.ready-prompt-block.open{display:block}
.ready-prompt-actions{display:flex;gap:6px;margin-top:6px}
.panel{background:var(--surface);border:1px solid var(--border);border-radius:6px;overflow:hidden;margin-bottom:16px}
.panel-head{padding:9px 13px;background:var(--surface2);border-bottom:1px solid var(--border);display:flex;align-items:center;gap:8px}
.panel-head-dot{width:7px;height:7px;border-radius:50%;flex-shrink:0}
.panel-head-title{font-size:13px;font-weight:600;letter-spacing:.08em;text-transform:uppercase;color:var(--text-bright)}
.panel-body{padding:12px 14px}
.signal-table{width:100%;border-collapse:collapse}
.signal-table th{text-align:left;padding:6px 10px;background:var(--surface2);border-bottom:1px solid var(--border2);font-family:'IBM Plex Mono',monospace;font-size:11px;letter-spacing:.1em;color:var(--text-dim);text-transform:uppercase}
.signal-table td{padding:6px 10px;border-bottom:1px solid var(--border);font-family:'IBM Plex Mono',monospace;font-size:12px}
.signal-table tr:last-child td{border-bottom:none}
.three-col{display:grid;grid-template-columns:1fr 1fr 1fr;gap:12px}
.note-box{background:rgba(245,166,35,.06);border:1px solid rgba(245,166,35,.2);border-radius:4px;padding:7px 11px;font-size:13px;color:#c8a050;font-family:'IBM Plex Mono',monospace;margin-bottom:16px}
.note-box::before{content:'\u26A0  '}
.howto-code{background:var(--surface2);border:1px solid var(--border);border-radius:4px;padding:12px;margin:8px 0;color:var(--accent-cyan);font-family:'IBM Plex Mono',monospace;font-size:13px;line-height:1.9}
.footer{margin-top:40px;padding-top:16px;border-top:1px solid var(--border);display:flex;justify-content:space-between;align-items:center;font-family:'IBM Plex Mono',monospace;font-size:12px;color:var(--text-dim)}
.kanban-board{display:grid;grid-template-columns:repeat(4,1fr);gap:12px;min-height:300px}
.kanban-col{background:var(--surface);border:1px solid var(--border);border-radius:6px;overflow:hidden;display:flex;flex-direction:column}
.kanban-col-head{padding:10px 14px;background:var(--surface2);border-bottom:1px solid var(--border);display:flex;align-items:center;gap:8px}
.kanban-col-title{font-family:'IBM Plex Mono',monospace;font-size:12px;font-weight:600;letter-spacing:.1em;text-transform:uppercase}
.kanban-col-count{font-family:'IBM Plex Mono',monospace;font-size:12px;padding:1px 6px;border-radius:8px;background:rgba(255,255,255,.06);color:var(--text-dim)}
.kanban-col-body{padding:8px;display:flex;flex-direction:column;gap:6px;flex:1;overflow-y:auto}
.kanban-card{background:var(--bg);border:1px solid var(--border);border-radius:4px;padding:10px;transition:border-color .15s}
.kanban-card:hover{border-color:var(--border2)}
.kanban-card-title{font-size:13px;font-weight:500;color:var(--text-bright);margin-bottom:6px;line-height:1.4}
.kanban-card-meta{display:flex;gap:4px;flex-wrap:wrap;align-items:center}
.slice-list{display:flex;flex-direction:column;gap:10px}
.slice-card{background:var(--surface);border:1px solid var(--border);border-radius:6px;padding:14px 16px;transition:border-color .15s}
.slice-card:hover{border-color:var(--border2)}
.slice-card.ready{border-left:3px solid var(--p0)}
.slice-card.blocked{border-left:3px solid #ff5a5a;opacity:.7}
.slice-card-head{display:flex;align-items:center;gap:10px;margin-bottom:8px;flex-wrap:wrap}
.slice-card-title{font-size:15px;font-weight:600;color:var(--text-bright)}
.slice-card-desc{font-size:13px;color:var(--text-dim);margin-bottom:8px;line-height:1.5}
.slice-card-hooks{display:flex;flex-wrap:wrap;gap:4px;margin-bottom:8px}
.slice-card-deps{font-family:'IBM Plex Mono',monospace;font-size:12px;color:var(--text-dim);display:flex;gap:8px;flex-wrap:wrap}
.dep-done{color:var(--p0)}.dep-pending{color:#ff5a5a}
.ready-badge{font-family:'IBM Plex Mono',monospace;font-size:11px;padding:2px 7px;border-radius:2px;background:rgba(46,204,138,.1);border:1px solid rgba(46,204,138,.3);color:#5ed9a0}
.blocked-badge{font-family:'IBM Plex Mono',monospace;font-size:11px;padding:2px 7px;border-radius:2px;background:rgba(255,90,90,.1);border:1px solid rgba(255,90,90,.3);color:#ff8080}
.prompt-card{background:var(--surface);border:1px solid var(--border);border-radius:6px;overflow:hidden;margin-bottom:12px}
.prompt-card-head{display:flex;align-items:center;gap:10px;padding:10px 14px;background:var(--surface2);border-bottom:1px solid var(--border)}
.prompt-card-body{padding:14px;font-family:'IBM Plex Mono',monospace;font-size:13px;line-height:1.8;color:var(--text);white-space:pre-wrap;background:var(--bg);border:1px solid var(--border);margin:10px;border-radius:4px;max-height:300px;overflow-y:auto}
.copy-btn{margin-left:auto;padding:4px 10px;font-family:'IBM Plex Mono',monospace;font-size:12px;border:1px solid var(--border2);border-radius:3px;background:var(--surface);color:var(--text-dim);cursor:pointer;transition:all .15s}
.copy-btn:hover{color:var(--accent-cyan);border-color:rgba(0,212,200,.4)}
.copy-btn.copied{color:var(--p0);border-color:rgba(46,204,138,.4)}
.section-label{font-family:'IBM Plex Mono',monospace;font-size:13px;font-weight:600;letter-spacing:.1em;text-transform:uppercase;color:var(--text-dim);margin-bottom:10px;display:flex;align-items:center;gap:8px}
.section-label-dot{width:8px;height:8px;border-radius:50%;flex-shrink:0}
@media(max-width:900px){.kanban-board{grid-template-columns:1fr 1fr}}
@media(max-width:600px){.kanban-board{grid-template-columns:1fr}}
.slice-progress{display:flex;align-items:center;gap:8px;margin-top:6px;padding-top:6px;border-top:1px solid var(--border)}
.slice-progress-bar{flex:0 0 60px;height:3px;background:var(--border2);border-radius:2px}
.slice-progress-fill{height:100%;border-radius:2px;background:var(--p0)}
.slice-progress-text{font-family:'IBM Plex Mono',monospace;font-size:11px;color:var(--text-dim)}
.slice-toggle{font-family:'IBM Plex Mono',monospace;font-size:11px;color:var(--accent-blue);cursor:pointer;border:none;background:none;padding:0;margin-left:auto}
.slice-toggle:hover{text-decoration:underline}
.slice-detail-list{margin-top:6px;display:flex;flex-direction:column;gap:4px}
.slice-row{display:flex;align-items:center;gap:6px;padding:4px 6px;background:var(--bg);border:1px solid var(--border);border-radius:3px;font-size:12px}
.slice-row-dot{width:6px;height:6px;border-radius:50%;flex-shrink:0}
.slice-row-title{color:var(--text);flex:1;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.slice-row-type{font-family:'IBM Plex Mono',monospace;font-size:10px;padding:1px 4px;border-radius:2px;border:1px solid var(--border2);color:var(--text-dim)}
.slice-row-signal{font-family:'IBM Plex Mono',monospace;font-size:10px;color:var(--text-dim);overflow:hidden;text-overflow:ellipsis;white-space:nowrap;max-width:140px}
.bl-card-head{display:flex;gap:4px;align-items:center;flex-wrap:wrap;margin-bottom:6px}
.bl-card-id{font-family:'IBM Plex Mono',monospace;font-size:10px;color:var(--text-dim);margin-left:auto}
.bl-card-title{font-size:13px;font-weight:600;color:var(--text-bright);line-height:1.4;margin-bottom:4px}
.bl-card-parent{font-family:'IBM Plex Mono',monospace;font-size:11px;color:var(--accent-blue);margin-bottom:4px;opacity:.8}
.bl-card-desc{font-size:12px;color:var(--text-dim);line-height:1.4;margin-bottom:6px;display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical;overflow:hidden}
.bl-card-files{display:flex;flex-wrap:wrap;gap:3px;margin-bottom:4px}
.bl-card-file{font-family:'IBM Plex Mono',monospace;font-size:10px;padding:1px 4px;border-radius:2px;background:rgba(0,212,200,.06);border:1px solid rgba(0,212,200,.15);color:var(--accent-cyan)}
.bl-blocked-by{font-family:'IBM Plex Mono',monospace;font-size:11px;color:#ff8080;background:rgba(255,90,90,.06);border:1px solid rgba(255,90,90,.15);border-radius:3px;padding:3px 6px;margin-top:4px}
.bl-filter-group{display:inline-flex;gap:4px;align-items:center;flex-wrap:wrap}
.rec-panel{background:var(--surface);border:1px solid var(--border);border-radius:6px;overflow:hidden;margin-bottom:24px}
.rec-panel-head{padding:10px 16px;background:var(--surface2);border-bottom:1px solid var(--border);display:flex;align-items:center;gap:10px}
.rec-panel-head-title{font-family:'IBM Plex Mono',monospace;font-size:13px;font-weight:600;letter-spacing:.1em;text-transform:uppercase;color:var(--text-bright)}
.rec-grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(260px,1fr));gap:8px;padding:12px}
.rec-item{background:var(--bg);border:1px solid var(--border);border-radius:4px;padding:10px 12px;display:flex;gap:10px;transition:border-color .15s}
.rec-item:hover{border-color:var(--border2)}
.rec-item.unblocked{border-left:3px solid var(--p0)}
.rec-item.blocked{border-left:3px solid #ff5a5a;opacity:.75}
.rec-rank{font-family:'IBM Plex Mono',monospace;font-size:20px;font-weight:600;color:var(--accent-blue);flex-shrink:0;width:22px;text-align:center;line-height:1}
.rec-body{flex:1;min-width:0}
.rec-meta{display:flex;gap:4px;align-items:center;flex-wrap:wrap;margin-bottom:4px}
.rec-title{font-size:13px;font-weight:600;color:var(--text-bright);line-height:1.4;margin-bottom:3px}
.rec-parent{font-family:'IBM Plex Mono',monospace;font-size:11px;color:var(--accent-blue);opacity:.8;margin-bottom:3px}
.rec-reason{font-size:12px;color:var(--text-dim);line-height:1.4;margin-bottom:4px}
.rec-files{display:flex;flex-wrap:wrap;gap:3px}
.rec-file{font-family:'IBM Plex Mono',monospace;font-size:10px;padding:1px 4px;border-radius:2px;background:rgba(0,212,200,.06);border:1px solid rgba(0,212,200,.15);color:var(--accent-cyan)}
.rec-blocked{font-family:'IBM Plex Mono',monospace;font-size:11px;color:#ff8080;margin-top:3px}
.tp-toggle{font-family:'IBM Plex Mono',monospace;font-size:11px;color:var(--accent-blue);cursor:pointer;background:rgba(61,126,255,.08);border:1px solid rgba(61,126,255,.2);border-radius:3px;padding:2px 8px;margin-top:6px;transition:all .15s;display:inline-block}
.tp-toggle:hover{background:rgba(61,126,255,.15);color:var(--text-bright)}
.tp-block{margin-top:8px}
.tp-body{font-family:'IBM Plex Mono',monospace;font-size:12px;line-height:1.7;color:var(--text);white-space:pre-wrap;background:var(--surface2);border:1px solid var(--border);border-radius:4px;padding:10px 12px;max-height:260px;overflow-y:auto;user-select:text}
.tp-actions{display:flex;gap:6px;margin-top:4px}
.tp-copy{font-family:'IBM Plex Mono',monospace;font-size:11px;border:1px solid var(--border2);border-radius:3px;background:var(--surface);color:var(--text-dim);cursor:pointer;padding:3px 8px;transition:all .15s}
.tp-copy:hover{color:var(--accent-cyan);border-color:rgba(0,212,200,.4)}
.tp-copy.copied{color:var(--p0);border-color:rgba(46,204,138,.4)}
.test-badge{font-family:'IBM Plex Mono',monospace;font-size:10px;padding:1px 5px;border-radius:2px;display:inline-flex;align-items:center;gap:3px;letter-spacing:.03em}
.test-badge-ok{color:#2ecc8a;border:1px solid rgba(46,204,138,.3);background:rgba(46,204,138,.08)}
.test-badge-warn{color:#f0c040;border:1px solid rgba(240,192,64,.3);background:rgba(240,192,64,.08)}
.test-badge-missing{color:#ff5a5a;border:1px solid rgba(255,90,90,.3);background:rgba(255,90,90,.08)}
.test-warn-banner{font-family:'IBM Plex Mono',monospace;font-size:11px;color:#f0c040;background:rgba(240,192,64,.06);border:1px solid rgba(240,192,64,.2);border-radius:3px;padding:3px 8px;margin-top:4px;display:flex;align-items:center;gap:4px}
.test-warn-banner.test-warn-error{color:#ff5a5a;background:rgba(255,90,90,.06);border-color:rgba(255,90,90,.2)}
.vw-validate-btn{font-family:'IBM Plex Mono',monospace;font-size:10px;padding:2px 7px;border-radius:3px;cursor:pointer;border:1px solid rgba(46,204,138,.4);background:rgba(46,204,138,.08);color:#2ecc8a;letter-spacing:.04em;transition:all .15s}
.vw-validate-btn:hover{background:rgba(46,204,138,.18);color:#3de89e}
.vw-overlay{display:none;position:fixed;inset:0;background:rgba(0,0,0,.7);z-index:2000;justify-content:center;align-items:flex-start;padding:40px 20px;overflow-y:auto}
.vw-overlay.open{display:flex}
.vw-panel{background:var(--surface);border:1px solid var(--border2);border-radius:8px;width:100%;max-width:680px;padding:28px;font-family:'IBM Plex Sans',sans-serif}
.vw-header{margin-bottom:20px}
.vw-title{font-family:'IBM Plex Mono',monospace;font-size:16px;font-weight:600;color:var(--text-bright);margin-bottom:10px}
.vw-steps{display:flex;gap:4px}
.vw-step{font-family:'IBM Plex Mono',monospace;font-size:12px;padding:3px 10px;border-radius:3px;color:var(--text-dim);background:var(--surface2);border:1px solid var(--border)}
.vw-step.active{color:var(--accent-cyan);border-color:rgba(0,212,200,.4);background:rgba(0,212,200,.06)}
.vw-step.done{color:#2ecc8a;border-color:rgba(46,204,138,.3);background:rgba(46,204,138,.06)}
.vw-step-body{display:none}
.vw-step-body.active{display:block}
.vw-step-title{font-size:15px;font-weight:600;color:var(--text-bright);margin-bottom:6px}
.vw-step-desc{font-size:13px;color:var(--text-dim);margin-bottom:14px}
.vw-check-item{display:flex;align-items:flex-start;gap:8px;padding:6px 10px;border:1px solid var(--border);border-radius:4px;margin-bottom:4px;cursor:pointer;transition:background .12s;font-size:13px;color:var(--text)}
.vw-check-item:hover{background:var(--surface2)}
.vw-check-item input[type=checkbox]{margin-top:2px;accent-color:#2ecc8a}
.vw-sub-title{font-family:'IBM Plex Mono',monospace;font-size:12px;font-weight:600;color:var(--text-dim);margin:14px 0 6px;text-transform:uppercase;letter-spacing:.06em}
.vw-refresh-target{font-size:13px;color:var(--text);padding:4px 10px;border-left:2px solid var(--accent-blue);margin-bottom:4px}
.vw-refresh-target code{font-family:'IBM Plex Mono',monospace;font-size:12px;color:var(--accent-cyan)}
.vw-refresh-btn{font-family:'IBM Plex Mono',monospace;font-size:12px;padding:6px 16px;border:1px solid rgba(0,212,200,.4);border-radius:4px;background:rgba(0,212,200,.08);color:var(--accent-cyan);cursor:pointer;margin:10px 0;letter-spacing:.03em;transition:all .15s}
.vw-refresh-btn:hover{background:rgba(0,212,200,.16)}
.vw-refresh-btn:disabled{opacity:.5;cursor:not-allowed}
.vw-nav{display:flex;gap:8px;margin-top:20px;justify-content:flex-end}
.vw-btn{font-family:'IBM Plex Mono',monospace;font-size:12px;padding:6px 16px;border-radius:4px;cursor:pointer;letter-spacing:.03em;transition:all .15s}
.vw-btn-secondary{border:1px solid var(--border2);background:var(--surface);color:var(--text-dim)}
.vw-btn-secondary:hover{color:var(--text);border-color:var(--text-dim)}
.vw-btn-primary{border:1px solid rgba(0,212,200,.4);background:rgba(0,212,200,.08);color:var(--accent-cyan)}
.vw-btn-primary:hover{background:rgba(0,212,200,.16)}
.vw-btn-validate{border:1px solid rgba(46,204,138,.5);background:rgba(46,204,138,.1);color:#2ecc8a;font-weight:600}
.vw-btn-validate:hover{background:rgba(46,204,138,.2)}
.vw-btn-validate:disabled{opacity:.5;cursor:not-allowed}
.vw-errors{font-family:'IBM Plex Mono',monospace;font-size:12px;color:#ff5a5a;margin-top:10px;min-height:14px}
.vw-success{font-family:'IBM Plex Mono',monospace;font-size:12px;color:#2ecc8a;margin-top:6px;min-height:14px}
.ws-bar{display:flex;gap:3px;margin-top:6px;align-items:center}
.ws-btn{font-family:'IBM Plex Mono',monospace;font-size:10px;padding:2px 6px;border-radius:3px;cursor:pointer;border:1px solid var(--border2);background:var(--surface);color:var(--text-dim);transition:all .12s;text-transform:uppercase;letter-spacing:.04em}
.ws-btn:hover{color:var(--text);border-color:var(--border2)}
.ws-btn.ws-active{font-weight:600}
.ws-btn[data-ws='drafting'].ws-active{color:#b48eff;border-color:rgba(180,142,255,.4);background:rgba(180,142,255,.08)}
.ws-btn[data-ws='implementing'].ws-active{color:#00d4c8;border-color:rgba(0,212,200,.4);background:rgba(0,212,200,.08)}
.kanban-card.ws-drafting{border-left:3px solid rgba(180,142,255,.6)}
.kanban-card.ws-implementing{border-left:3px solid rgba(0,212,200,.7)}
.kanban-card.ws-drafting .bl-card-title::before{content:'✎ ';color:#b48eff;font-size:12px}
.kanban-card.ws-implementing .bl-card-title::before{content:'▶ ';color:#00d4c8;font-size:12px}
.ws-session-bar{display:flex;gap:6px;align-items:center;margin-left:auto}
.ws-session-btn{font-family:'IBM Plex Mono',monospace;font-size:11px;padding:3px 8px;border-radius:3px;cursor:pointer;border:1px solid var(--border2);background:var(--surface);color:var(--text-dim);transition:all .12s}
.ws-session-btn:hover{color:var(--text);border-color:var(--accent-blue)}
.ws-session-btn.ws-filter-on{color:var(--accent-cyan);border-color:rgba(0,212,200,.4);background:rgba(0,212,200,.06)}
.ws-session-count{font-family:'IBM Plex Mono',monospace;font-size:11px;color:var(--text-dim)}
.ac-panel{margin-top:8px;padding:7px 10px;border:1px solid rgba(46,204,138,.18);border-radius:4px;background:rgba(46,204,138,.04);font-family:'IBM Plex Mono',monospace;font-size:11px;line-height:1.65;color:var(--text-dim)}
.ac-panel-head{font-size:11px;font-weight:600;color:var(--p0);text-transform:uppercase;letter-spacing:.06em;margin-bottom:4px;display:flex;align-items:center;gap:4px}
.ac-panel-head::before{content:'✓';display:inline-block;width:13px;height:13px;line-height:13px;text-align:center;border-radius:50%;background:rgba(46,204,138,.12);color:var(--p0);font-size:10px}
.ac-panel ol{margin:0;padding-left:16px}
.ac-panel li{margin-bottom:1px}
.ac-panel code{font-size:11px;padding:1px 4px;border-radius:2px;background:rgba(255,255,255,.05);color:var(--text)}
.ac-panel .ac-note{margin-top:3px;font-size:10px;color:var(--text-dim);opacity:.7;font-style:italic}
.next-up{background:linear-gradient(135deg,rgba(0,212,200,.06),rgba(61,126,255,.06));border:1px solid rgba(0,212,200,.25);border-radius:8px;padding:18px 22px;margin-bottom:20px;position:relative;overflow:hidden}
.next-up::before{content:'';position:absolute;top:0;left:0;width:4px;height:100%;background:linear-gradient(180deg,var(--accent-cyan),var(--accent-blue))}
.next-up-label{font-family:'IBM Plex Mono',monospace;font-size:11px;letter-spacing:.2em;text-transform:uppercase;color:var(--accent-cyan);margin-bottom:8px;display:flex;align-items:center;gap:8px}
.next-up-pulse{width:8px;height:8px;border-radius:50%;background:var(--accent-cyan);animation:pulse 2s infinite}
.next-up-title{font-size:18px;font-weight:600;color:var(--text-bright);margin-bottom:6px}
.next-up-meta{display:flex;gap:8px;align-items:center;flex-wrap:wrap;margin-bottom:10px}
.next-up-desc{font-size:13px;color:var(--text-dim);line-height:1.5;margin-bottom:10px;max-width:700px}
.next-up-actions{display:flex;gap:8px;align-items:center}
.next-up-btn{font-family:'IBM Plex Mono',monospace;font-size:12px;padding:5px 12px;border-radius:4px;cursor:pointer;border:1px solid;transition:all .15s}
.next-up-btn-primary{color:var(--accent-cyan);border-color:rgba(0,212,200,.4);background:rgba(0,212,200,.1)}
.next-up-btn-primary:hover{background:rgba(0,212,200,.2);color:var(--text-bright)}
.next-up-btn-secondary{color:var(--text-dim);border-color:var(--border2);background:var(--surface)}
.next-up-btn-secondary:hover{color:var(--text);border-color:var(--accent-blue)}
.next-up-queue{font-family:'IBM Plex Mono',monospace;font-size:11px;color:var(--text-dim);margin-top:10px;padding-top:8px;border-top:1px solid rgba(255,255,255,.06)}
.next-up-queue-item{display:inline-flex;align-items:center;gap:4px;margin-right:12px;padding:2px 0}
.next-up-queue-num{color:var(--text-dim);width:14px;text-align:right}
.next-up-queue-title{color:var(--text);max-width:180px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.ticket-form-overlay{display:none;position:fixed;inset:0;background:rgba(0,0,0,.6);z-index:100;align-items:center;justify-content:center}
.ticket-form-overlay.open{display:flex}
.ticket-form{background:var(--surface);border:1px solid var(--border2);border-radius:8px;padding:24px;width:640px;max-width:92vw;max-height:85vh;overflow-y:auto}
.ticket-form h3{font-size:16px;font-weight:600;color:var(--text-bright);margin-bottom:16px;font-family:'IBM Plex Mono',monospace}
.ticket-form label{display:block;font-family:'IBM Plex Mono',monospace;font-size:12px;color:var(--text-dim);letter-spacing:.08em;text-transform:uppercase;margin-bottom:4px;margin-top:12px}
.ticket-form label .tf-req{color:#ff5a5a}
.ticket-form input,.ticket-form select,.ticket-form textarea{width:100%;padding:7px 10px;font-family:'IBM Plex Mono',monospace;font-size:13px;background:var(--bg);border:1px solid var(--border2);border-radius:4px;color:var(--text);outline:none;transition:border-color .15s;box-sizing:border-box}
.ticket-form input:focus,.ticket-form select:focus,.ticket-form textarea:focus{border-color:var(--accent-blue)}
.ticket-form textarea{min-height:60px;resize:vertical}
.ticket-form .tf-row{display:grid;grid-template-columns:1fr 1fr;gap:0 16px}
.ticket-form .tf-row-3{display:grid;grid-template-columns:1fr 1fr 1fr;gap:0 12px}
.ticket-form .tf-section{margin-top:20px;padding-top:14px;border-top:1px solid var(--border)}
.ticket-form .tf-section-title{font-family:'IBM Plex Mono',monospace;font-size:13px;font-weight:600;color:var(--accent-cyan);letter-spacing:.05em;margin-bottom:2px}
.ticket-form .tf-hint{font-family:'IBM Plex Mono',monospace;font-size:11px;color:var(--text-dim);margin-top:2px}
.ticket-form .tf-list-input{display:flex;gap:6px;margin-bottom:4px}
.ticket-form .tf-list-input input{flex:1}
.ticket-form .tf-list-input button{flex-shrink:0;padding:4px 10px;font-family:'IBM Plex Mono',monospace;font-size:11px;border:1px solid var(--border2);background:var(--bg);color:var(--text-dim);border-radius:3px;cursor:pointer}
.ticket-form .tf-list-input button:hover{border-color:var(--accent-blue);color:var(--text)}
.ticket-form .tf-list-items{display:flex;flex-direction:column;gap:3px}
.ticket-form .tf-list-item{display:flex;align-items:center;gap:6px;padding:3px 8px;background:var(--bg);border:1px solid var(--border);border-radius:3px;font-family:'IBM Plex Mono',monospace;font-size:12px;color:var(--text)}
.ticket-form .tf-list-item .tf-list-rm{margin-left:auto;cursor:pointer;color:#ff5a5a;opacity:.6;font-size:13px}
.ticket-form .tf-list-item .tf-list-rm:hover{opacity:1}
.ticket-form-actions{display:flex;gap:8px;margin-top:18px;justify-content:flex-end;flex-wrap:wrap}
.tf-errors{margin-top:10px;padding:8px 12px;background:rgba(255,90,90,.08);border:1px solid rgba(255,90,90,.3);border-radius:4px;font-family:'IBM Plex Mono',monospace;font-size:12px;color:#ff5a5a;line-height:1.6;display:none}
.tf-errors.visible{display:block}
.tf-success{margin-top:10px;padding:8px 12px;background:rgba(46,204,138,.08);border:1px solid rgba(46,204,138,.3);border-radius:4px;font-family:'IBM Plex Mono',monospace;font-size:12px;color:var(--p0);line-height:1.6;display:none}
.tf-success.visible{display:block}
.tf-saving{opacity:.6;pointer-events:none}
.tf-edit-btn{font-family:'IBM Plex Mono',monospace;font-size:10px;padding:2px 6px;border:1px solid var(--border2);background:var(--bg);color:var(--text-dim);border-radius:3px;cursor:pointer;transition:all .15s}
.tf-edit-btn:hover{border-color:var(--accent-blue);color:var(--accent-blue)}
.tf-dup-btn{font-family:'IBM Plex Mono',monospace;font-size:10px;padding:2px 6px;border:1px solid var(--border2);background:var(--bg);color:var(--text-dim);border-radius:3px;cursor:pointer;transition:all .15s}
.tf-dup-btn:hover{border-color:var(--p2);color:var(--p2)}
.tf-del-btn{font-family:'IBM Plex Mono',monospace;font-size:10px;padding:2px 6px;border:1px solid rgba(255,90,90,.2);background:var(--bg);color:rgba(255,90,90,.6);border-radius:3px;cursor:pointer;transition:all .15s}
.tf-del-btn:hover{border-color:#ff5a5a;color:#ff5a5a}
.rec-refresh-btn{font-family:'IBM Plex Mono',monospace;font-size:11px;padding:3px 10px;border:1px solid var(--accent-cyan);border-radius:3px;background:transparent;color:var(--accent-cyan);cursor:pointer;margin-left:8px;transition:all .15s}
.rec-refresh-btn:hover{background:rgba(46,204,220,.1);box-shadow:0 0 6px rgba(46,204,220,.15)}
.rec-refresh-btn.loading{opacity:.5;cursor:wait}
.rec-timestamp{font-family:'IBM Plex Mono',monospace;font-size:11px;color:var(--text-dim);padding:4px 14px;border-bottom:1px solid var(--border1)}
.rec-movement{font-family:'IBM Plex Mono',monospace;font-size:10px;padding:1px 5px;border-radius:2px;font-weight:600}
.rec-move-up{color:#2ecc8a;background:rgba(46,204,138,.1);border:1px solid rgba(46,204,138,.2)}
.rec-move-down{color:#ff5a5a;background:rgba(255,90,90,.1);border:1px solid rgba(255,90,90,.2)}
.rec-move-new{color:#7aaeff;background:rgba(61,126,255,.1);border:1px solid rgba(61,126,255,.2)}
.rec-move-same{color:var(--text-dim);background:transparent;border:1px solid var(--border2)}
.tf-infer-btn{font-family:'IBM Plex Mono',monospace;font-size:10px;padding:2px 8px;border:1px solid var(--accent-cyan);background:transparent;color:var(--accent-cyan);border-radius:3px;cursor:pointer;margin-left:8px;transition:all .15s}
.tf-infer-btn:hover{background:rgba(46,204,220,.12);box-shadow:0 0 6px rgba(46,204,220,.15)}
.pv-inferred-note{font-family:'IBM Plex Mono',monospace;font-size:10px;color:var(--text-dim);padding:2px 0;font-style:italic}
.vw-pv-section{margin-top:10px;border-top:1px solid var(--border1);padding-top:8px}
.vw-pv-title{font-family:'IBM Plex Mono',monospace;font-size:12px;font-weight:600;color:var(--accent-cyan);margin-bottom:4px}
.vw-pv-note{font-family:'IBM Plex Mono',monospace;font-size:10px;color:var(--text-dim);font-style:italic;margin-top:4px}
`;

// ─── HTML Generator ───────────────────────────────────────────

function generateHtml(roadmap, signals, git) {
  const features = roadmap.features || [];
  const phases = roadmap.phases || [];
  const customItems = roadmap.custom_items || [];
  const project = roadmap.project || {};

  // ── Backfill old custom items missing testing metadata ──
  const backfilled = backfillTestingDefaults(customItems);
  if (backfilled > 0) {
    console.log("   \u2139 Backfilled testing defaults on " + backfilled + " custom item(s)");
  }

  // Compute statuses for all features.
  // If a feature has slices[], compute each slice's status from its
  // completion_signals, then aggregate into the feature status.
  // Otherwise fall back to feature-level detection (original behavior).
  const computed = features.map(f => {
    const rawSlices = f.slices || [];
    if (rawSlices.length > 0) {
      // ── Slice-based aggregation ──
      const slicesComputed = rawSlices.map(s => {
        const det = getSliceStatus(s, signals);
        return {
          id:        s.id        || "?",
          title:     s.title     || "Untitled slice",
          type:      s.type      || "task",
          status:    s.status    || "planned",           // manual fallback
          depends_on:        s.depends_on        || [],
          files_expected:    s.files_expected    || [],
          acceptance_criteria: s.acceptance_criteria || [],
          completion_signals:  s.completion_signals  || [],
          prompt_template:     s.prompt_template     || null,
          computedStatus: det.status,
          signal:         det.signal,
        };
      });
      const agg = aggregateFeatureFromSlices(slicesComputed);
      return { ...f, computedStatus: agg.status, signal: agg.signal, slicesComputed };
    }
    // ── Feature-level detection (unchanged) ──
    const det = getFeatureStatus(f.detection, signals);
    return { ...f, computedStatus: det.status, signal: det.signal, slicesComputed: [] };
  });

  // Build backlog items FIRST — they are the source of truth for all stats.
  // (Moved above stat computation so aggregateRoadmapStats can use them.)
  const backlogItems = buildBacklogItems(computed);

  // ── Merge custom items into a unified pool for recommendations ──
  const customBacklog = customItemsToBacklog(customItems, computed);
  const allBacklogItems = backlogItems.concat(customBacklog);

  // ─── Centralized stats (single source of truth) ───
  // All global counters, phase statuses, and health checks derive from
  // the same backlogItems list.  See aggregateRoadmapStats() for rules.
  // NOTE: stats use feature/slice backlogItems only (not custom) to keep
  // phase progress bars aligned with auto-detected feature status.
  const stats = aggregateRoadmapStats(backlogItems, computed, phases);

  // ─── Chronological queue (strict execution order) ───
  // Uses allBacklogItems so custom tickets participate in the queue.
  const chronoQueue = computeChronologicalQueue(allBacklogItems, phases);

  // Propagate chrono annotations back to backlogItems so kanban/rec cards can use them
  const chronoLookup = {};
  for (const cq of chronoQueue.queue) {
    chronoLookup[cq.id] = cq;
  }
  for (const bi of backlogItems) {
    const ann = chronoLookup[bi.id];
    if (ann) {
      bi.rank = ann.rank;
      bi.reasons = ann.reasons;
      bi.blockedBy = ann.blockedBy;
      bi.unlocks = ann.unlocks;
      bi.scope = ann.scope;
      bi.scopeFileCount = ann.scopeFileCount;
    }
  }

  const now = new Date().toISOString().replace("T", " ").slice(0, 19) + " UTC";

  // ─── Planning console ───
  const { ready: readyFeatures, blocked: blockedFeatures } = computeReadyFeatures(computed, phases);

  // Phase color map
  const phaseColorVar = { P0: "--p0", P1: "--p1", P2: "--p2", P3: "--p3", P4: "--p4" };

  // Status dot color
  function statusDotColor(status) {
    if (status === "done") return "var(--p0)";
    if (status === "in_progress") return "var(--p3)";
    if (status === "blocked") return "#ff5a5a";
    return "#5a6580";
  }

  // Status label
  function statusLabel(status) {
    const map = { done: "DONE", in_progress: "IN PROGRESS", blocked: "BLOCKED", planned: "PLANNED" };
    return map[status] || "PLANNED";
  }

  // Status color for text
  function statusTextColor(status) {
    if (status === "done") return "var(--p0)";
    if (status === "in_progress") return "var(--p3)";
    if (status === "blocked") return "#ff5a5a";
    return "#5a6580";
  }

  // Phase status label — derived purely from backlog items via stats.
  // Never reads manual phase.status from ROADMAP.json.
  function phaseStatusLabel(phase) {
    const ps = stats.phaseStats[phase.id];
    return ps ? ps.status : "PLANNED";
  }

  // ─── Slice block renderer (inline within feature cards) ───
  // Renders a compact progress bar + collapsible slice list when a
  // feature has slicesComputed[].  Returns empty string otherwise.
  function renderSliceBlock(f) {
    const sc = f.slicesComputed;
    if (!sc || sc.length === 0) return "";
    const total = sc.length;
    const done = sc.filter(s => s.computedStatus === "done").length;
    const pctSlice = Math.round((done / total) * 100);
    const fid = f.id.replace(/[^a-zA-Z0-9]/g, "_");

    let rows = "";
    for (const s of sc) {
      rows += '<div class="slice-row">'
        + '<div class="slice-row-dot" style="background:' + statusDotColor(s.computedStatus) + '"></div>'
        + '<span class="slice-row-title" title="' + esc(s.title) + '">' + esc(s.title) + '</span>'
        + (s.type ? '<span class="slice-row-type">' + esc(s.type) + '</span>' : '')
        + '<span class="slice-row-signal" title="' + esc(s.signal) + '">' + esc(s.signal) + '</span>'
        + '</div>';
    }

    return '\n    <div class="slice-progress">'
      + '<div class="slice-progress-bar"><div class="slice-progress-fill" style="width:' + pctSlice + '%"></div></div>'
      + '<span class="slice-progress-text">' + done + '/' + total + ' slices</span>'
      + '<button class="slice-toggle" onclick="toggleSlices(\'' + fid + '\')">show slices</button>'
      + '</div>'
      + '<div class="slice-detail-list" id="slices_' + fid + '" style="display:none">'
      + rows
      + '</div>';
  }

  // ─── Build phase blocks ───
  let phasesHtml = "";
  for (const phase of phases) {
    const pf = computed.filter(f => f.phase === phase.id);
    const pc = customItems.filter(c => c.phase === phase.id);
    // Use centralized per-phase stats for progress bar & status label.
    // ps counts actionable items (slices when present), so the bar
    // reflects true granularity, not just feature-level aggregation.
    const ps = stats.phaseStats[phase.id] || { done: 0, inProgress: 0, blocked: 0, ready: 0, total: 0, pct: 0, status: "PLANNED" };
    const colorVar = phaseColorVar[phase.id] || "--text-dim";
    const phaseStatus = phaseStatusLabel(phase);
    const phaseStatusColor = phaseStatus === "IN PROGRESS" ? "var(--p3)" : phaseStatus === "DONE" ? "var(--p0)" : "var(--text-dim)";

    let featureCards = "";
    for (const f of pf) {
      const hooksExisting = (f.hooks_existing || []).map(h => `<span class="hook exists">${esc(h)}</span>`).join("");
      const hooksNew = (f.hooks_new || []).map(h => `<span class="hook new">${esc(h)}</span>`).join("");
      const hooksBlocked = (f.hooks_blocked || []).map(h => `<span class="hook blocked">${esc(h)}</span>`).join("");

      featureCards += `<div class="feature-card" data-status="${f.computedStatus}">
    <div class="feature-card-head">
      <div class="status-dot" style="background:${statusDotColor(f.computedStatus)}"></div>
      <div class="feature-name">${esc(f.title)}</div>
      <div class="feature-type type-${f.type}">${esc(f.type.toUpperCase())}</div>
    </div>
    <div class="feature-status-bar">
      <span style="font-family:'IBM Plex Mono',monospace;font-size:11px;color:${statusTextColor(f.computedStatus)}">${statusLabel(f.computedStatus)}</span>
      <span style="font-family:'IBM Plex Mono',monospace;font-size:11px;color:var(--text-dim)">${esc(f.id)}</span>
      <span style="font-family:'IBM Plex Mono',monospace;font-size:11px;color:var(--text-dim);overflow:hidden;text-overflow:ellipsis;white-space:nowrap" title="${esc(f.signal)}">${esc(f.signal)}</span>
    </div>
    <div class="feature-desc">${esc(f.description)}</div>
    <div class="feature-hooks">${hooksExisting}${hooksNew}${hooksBlocked}</div>${renderSliceBlock(f)}
  </div>`;
    }

    // Custom items within phase
    let customBlock = "";
    if (pc.length > 0) {
      customBlock = `<div class="custom-items-block">`;
      for (const c of pc) {
        const typeClass = `type-${c.type === "user_story" ? "story" : c.type}`;
        const phTpId = 'ph_' + c.id.replace(/[^a-zA-Z0-9]/g, '_');
        const phItem = Object.assign({}, c, { isCustom: true });
        const phTpText = generateCanonicalPrompt(phItem, roadmap, computed, signals, stats);
        customBlock += `<div class="custom-item">
      <div class="custom-item-head">
        <div class="status-dot" style="background:${statusDotColor(c.status)};width:6px;height:6px"></div>
        <span class="custom-item-type ${typeClass}">${esc(c.type)}</span>
        ${testBadgeHtml(c)}
        ${c.persona ? `<span class="custom-item-persona">${esc(c.persona)}</span>` : ""}
        ${c.ticket ? `<span class="custom-item-ticket">${esc(c.ticket)}</span>` : ""}
        <span style="font-family:'IBM Plex Mono',monospace;font-size:11px;color:${statusTextColor(c.status)}">${statusLabel(c.status)}</span>
        ${validateBtnHtml(c)}
      </div>
      <div class="custom-item-title">${esc(c.title)}</div>
      ${c.notes ? `<div class="custom-item-notes">${esc(c.notes)}</div>` : ""}
      ${testWarnHtml(c)}
      <button class="tp-toggle" onclick="toggleTP('${phTpId}')">▶ SHOW PROMPT</button>
      <div class="tp-block" id="tp-${phTpId}" style="display:none">
        <div class="tp-body">${esc(phTpText)}</div>
        <div class="tp-actions"><button class="tp-copy" onclick="copyTP(this,'${phTpId}')">COPY</button></div>
      </div>
    </div>`;
      }
      customBlock += `</div>`;
    }

    const phaseDataStatus = phaseStatus === "IN PROGRESS" ? "in_progress" : phaseStatus === "DONE" ? "done" : phase.id === "P5" ? "future" : "planned";

    phasesHtml += `<div class="phase-block" data-phase="${phase.id}" data-status="${phaseDataStatus}">
      <div class="phase-head" style="background:var(${colorVar})15;border-bottom:1px solid var(${colorVar})30">
        <div class="phase-badge" style="color:var(${colorVar});border-color:var(${colorVar})40;background:var(${colorVar})10">${esc(phase.id)}</div>
        <div class="phase-title">${esc(phase.name)}</div>
        <div class="phase-window">${esc(phase.window)}</div>
        <div style="margin-left:auto;font-family:'IBM Plex Mono',monospace;font-size:12px;color:${phaseStatusColor}">${phaseStatus}</div>
      </div>
      <div class="phase-goal">${esc(phase.goal)}</div>
      <div class="phase-progress">
    <div class="phase-progress-bar"><div class="phase-progress-fill" style="width:${ps.pct}%"></div></div>
    <span style="font-family:'IBM Plex Mono',monospace;font-size:12px;color:var(--text-dim)">${ps.done}/${ps.total} done \u00B7 ${ps.inProgress} in progress${ps.blocked > 0 ? ' \u00B7 ' + ps.blocked + ' blocked' : ''} \u00B7 ${ps.pct}%</span>
  </div>
      <div class="phase-body">
        <div class="feature-grid">${featureCards}</div>
        ${customBlock}
      </div>
    </div>`;
  }

  // ─── Compute recommendations early (needed by prompt After Completion panels) ───
  const previousRecs = (roadmap._meta && roadmap._meta.last_recommendations) || [];
  const recsResult = computeRecommendationsEx(allBacklogItems, phases, 5, previousRecs);
  const recommendations = recsResult.items;

  // ─── Custom items tab ───
  let customTabHtml = "";
  if (customItems.length > 0) {
    for (const c of customItems) {
      const typeClass = `type-${c.type === "user_story" ? "story" : c.type}`;
      const acHtml = (c.acceptance_criteria || []).map(a => '<li style="font-size:12px;color:var(--text-dim)">' + esc(a) + '</li>').join("");
      const depsHtml = (c.depends_on || []).map(d => '<span style="font-family:\'IBM Plex Mono\',monospace;font-size:11px;padding:1px 5px;border:1px solid var(--border2);border-radius:2px;color:var(--accent-blue)">' + esc(d) + '</span>').join(" ");
      // Generate canonical prompt for this custom item
      const cTpId = 'ci_' + c.id.replace(/[^a-zA-Z0-9]/g, '_');
      const cItem = Object.assign({}, c, { isCustom: true });
      const cTpText = generateCanonicalPrompt(cItem, roadmap, computed, signals, stats);
      customTabHtml += `<div class="custom-item" style="margin-bottom:10px" data-ticket-id="${esc(c.id)}">
      <div class="custom-item-head">
        <div class="status-dot" style="background:${statusDotColor(c.status)};width:6px;height:6px"></div>
        <span style="font-family:'IBM Plex Mono',monospace;font-size:12px;color:var(--text-dim)">${esc(c.id)}</span>
        <span style="font-family:'IBM Plex Mono',monospace;font-size:12px;color:var(--text-dim)">${esc(c.phase)}</span>
        <span class="custom-item-type ${typeClass}">${esc(c.type)}</span>
        ${testBadgeHtml(c)}
        ${c.persona ? `<span class="custom-item-persona">${esc(c.persona)}</span>` : ""}
        ${c.ticket ? `<span class="custom-item-ticket">${esc(c.ticket)}</span>` : ""}
        ${c.order !== undefined ? `<span style="font-family:'IBM Plex Mono',monospace;font-size:11px;color:var(--text-dim)">#${c.order}</span>` : ""}
        <span style="font-family:'IBM Plex Mono',monospace;font-size:11px;color:${statusTextColor(c.status)};margin-left:auto">${statusLabel(c.status)}</span>
        <button class="tf-edit-btn" onclick="tfEditTicket('${esc(c.id)}')">\u270E EDIT</button>
        <button class="tf-dup-btn" onclick="tfDuplicateTicket('${esc(c.id)}')">\u2398 DUP</button>
        <button class="tf-del-btn" onclick="tfDeleteTicket('${esc(c.id)}')">\u2716</button>
        ${validateBtnHtml(c)}
      </div>
      <div class="custom-item-title">${esc(c.title)}</div>
      ${c.description ? `<div class="custom-item-notes">${esc(c.description)}</div>` : ""}
      ${c.notes ? `<div class="custom-item-notes">${esc(c.notes)}</div>` : ""}
      ${depsHtml ? `<div style="margin-top:4px;display:flex;gap:4px;flex-wrap:wrap">${depsHtml}</div>` : ""}
      ${acHtml ? `<ul style="margin:4px 0 0 14px;padding:0">${acHtml}</ul>` : ""}
      ${testWarnHtml(c)}
      <button class="tp-toggle" onclick="toggleTP('${cTpId}')">\u25B6 SHOW PROMPT</button>
      <div class="tp-block" id="tp-${cTpId}" style="display:none">
        <div class="tp-body">${esc(cTpText)}</div>
        <div class="tp-actions"><button class="tp-copy" onclick="copyTP(this,'${cTpId}')">COPY</button></div>
        ${formatAfterCompletionHtml(c.id, recommendations.length > 0 ? recommendations[0].title : null)}
      </div>
    </div>`;
    }
  } else {
    customTabHtml = `<div style="padding:40px;text-align:center;color:var(--text-dim);font-family:'IBM Plex Mono',monospace;font-size:14px">No custom items yet.<br><br>Click <strong style="color:var(--accent-cyan)">+ NEW TICKET</strong> in the Backlog tab or use the button below.<br><br><button class="next-up-btn next-up-btn-primary" onclick="openTicketForm()">+ NEW TICKET</button></div>`;
  }

  // ─── Intake tab — 4-stage pipeline ───
  const intakeItems = roadmap.intake_items || [];
  const draftTickets = roadmap.draft_tickets || [];

  // Stage classification
  const stage1Items = intakeItems.filter(i => i.status === 'raw');
  const stage2Items = intakeItems.filter(i => i.status === 'triaged');
  const stage3Intake = intakeItems.filter(i => i.status === 'drafted');
  const stage3Drafts = draftTickets.filter(d => d.status === 'draft');
  const stage4Drafts = draftTickets.filter(d => d.status === 'ready' || d.ready_for_copilot);

  // ── Stage 1 cards (Capture) ──
  let stage1Html = '';
  for (const item of stage1Items) {
    // Build signal line based on triage hints
    let signalLine = 'Will create one story.';
    const isDup = item.recommended_action === 'duplicate';
    if (item.split_recommended) {
      signalLine = 'This covers a few different things \u2014 will become an epic with multiple stories.';
    } else if (isDup) {
      let dupTitle = '';
      if (item.duplicate_of) {
        const dupItem = intakeItems.find(function(x) { return x.id === item.duplicate_of; });
        dupTitle = dupItem ? (dupItem.title || (dupItem.raw_text || '').substring(0, 60)) : item.duplicate_of;
      }
      signalLine = dupTitle ? 'Looks similar to: ' + dupTitle.substring(0, 60) : 'Looks similar to another note you\u2019ve captured.';
    } else if (item.recommended_action === 'blocked') {
      signalLine = 'Something needs to be resolved before this can be built.';
    } else if (item.scope_size === 'epic') {
      signalLine = 'This is a large topic \u2014 will be broken down into stories.';
    }
    const showArea = item.product_area && item.product_area !== 'general';
    stage1Html += '<div class="capture-card" data-intake-id="' + esc(item.id) + '" data-intake-status="' + esc(item.status) + '">'
      + '<div style="font-size:14px;color:var(--text);line-height:1.6;margin-bottom:8px">' + esc(item.title || item.raw_text || '') + '</div>'
      + '<div style="display:flex;align-items:center;gap:8px;margin-bottom:10px">'
      + (showArea ? '<span class="intake-meta-tag intake-meta-tag-area">' + esc(item.product_area) + '</span>' : '')
      + '<span style="font-size:13px;color:var(--text-dim)">' + esc(signalLine) + '</span>'
      + '</div>'
      + '<div class="capture-card-actions">'
      + (isDup
        ? '<button class="intake-btn intake-btn-primary" onclick="captureQueueIt(\'' + esc(item.id) + '\')">' + '\u2713 Looks good, queue both</button>'
          + '<button class="intake-btn intake-btn-secondary" onclick="intakePark(\'' + esc(item.id) + '\')">' + 'Skip this one</button>'
        : '<button class="intake-btn intake-btn-primary" onclick="captureQueueIt(\'' + esc(item.id) + '\')">' + '\u2713 Looks good</button>'
          + '<button class="intake-btn intake-btn-secondary" onclick="intakeEdit(\'' + esc(item.id) + '\')">' + 'Add context</button>'
          + '<button class="intake-btn intake-btn-secondary" onclick="intakePark(\'' + esc(item.id) + '\')" style="margin-left:auto">' + 'Skip for now</button>'
      )
      + '</div></div>';
  }

  // ── Stage 2 cards (Clarify) ──
  let stage2Html = '';
  for (const item of stage2Items) {
    stage2Html += '<div class="capture-card" data-intake-id="' + esc(item.id) + '" data-intake-status="' + esc(item.status) + '" style="border-left:3px solid var(--accent-cyan)">'
      + '<div style="font-size:14px;color:var(--text);line-height:1.6;margin-bottom:10px">' + esc(item.title || item.raw_text || '') + '</div>'
      + '<div id="clarify-q-' + esc(item.id) + '" style="margin-bottom:8px"><span style="font-size:12px;color:var(--text-dim)">Loading questions\u2026</span></div>'
      + '<textarea id="clarify-answer-' + esc(item.id) + '" style="display:none;width:100%;min-height:80px;background:var(--bg);border:1px solid var(--border);border-radius:4px;padding:10px;color:var(--text);font-family:\'IBM Plex Mono\',monospace;font-size:13px;resize:vertical;box-sizing:border-box;margin-bottom:8px" placeholder="Answer in plain language \u2014 no technical details needed"></textarea>'
      + '<div class="capture-card-actions">'
      + '<button class="intake-btn intake-btn-primary" id="clarify-submit-' + esc(item.id) + '" onclick="clarifySubmitAnswer(\'' + esc(item.id) + '\')">' + 'Done, queue it</button>'
      + '<button class="intake-btn intake-btn-secondary" onclick="clarifyQueueIt(\'' + esc(item.id) + '\')">' + 'Skip, queue anyway</button>'
      + '</div>'
      + '<div id="clarify-fb-' + esc(item.id) + '" style="display:none;font-size:12px;color:var(--p0);margin-top:6px"></div>'
      + '</div>';
  }

  // ── Stage 3 cards (Review) ──
  let stage3Html = '';
  for (const item of stage3Intake) {
    if (!item.title && !(item.raw_text || '').trim()) continue;
    const showArea = item.product_area && item.product_area !== 'general';
    const titleText = item.title || (item.raw_text || '').substring(0, 80);
    stage3Html += '<div class="capture-card" data-intake-id="' + esc(item.id) + '" data-intake-status="' + esc(item.status) + '" style="border-left:3px solid var(--p3)">'
      + '<div style="font-size:14px;color:var(--text);line-height:1.5;margin-bottom:6px">' + esc(titleText) + '</div>'
      + '<div style="display:flex;align-items:center;gap:8px">'
      + (showArea ? '<span class="intake-meta-tag intake-meta-tag-area">' + esc(item.product_area) + '</span>' : '')
      + (item.split_recommended ? '<span class="intake-meta-tag" style="color:var(--p3);border-color:rgba(245,166,35,.3)">Multiple topics</span>' : '')
      + '</div>'
      + '</div>';
  }
  // Orphan drafts (no parent intake) in Review stage
  const parentedDraftIds = new Set(stage3Intake.flatMap(i => i.draft_ticket_ids || []));
  const orphanDrafts = stage3Drafts.filter(d => !parentedDraftIds.has(d.id));
  for (const child of orphanDrafts) {
    const showArea = child.product_area && child.product_area !== 'general';
    stage3Html += '<div class="capture-card" data-draft-id="' + esc(child.id) + '" data-draft-status="' + esc(child.status) + '" style="border-left:3px solid var(--p3)">'
      + '<div style="font-size:14px;color:var(--text);line-height:1.5;margin-bottom:6px">' + esc((child.title || '').substring(0, 80)) + '</div>'
      + (showArea ? '<div><span class="intake-meta-tag intake-meta-tag-area">' + esc(child.product_area) + '</span></div>' : '')
      + '</div>';
  }

  // ── Stage 4 cards (Ready) — grouped by parent intake item ──
  let stage4Html = '';
  const readyByParent = {};
  for (const d of stage4Drafts) {
    const parentId = (d.source_intake_ids && d.source_intake_ids[0]) || '_orphan';
    if (!readyByParent[parentId]) readyByParent[parentId] = [];
    readyByParent[parentId].push(d);
  }
  for (const [parentId, drafts] of Object.entries(readyByParent)) {
    const parentItem = intakeItems.find(i => i.id === parentId);
    const epicTitle = parentItem ? (parentItem.title || (parentItem.raw_text || '').substring(0, 80)) : 'Standalone tickets';
    const sp = (parentItem && parentItem.story_progress) || {};
    const progressPct = sp.progress_pct || 0;
    let storyCards = '';
    for (const d of drafts) {
      const isBlocked = d.refinement_status === 'refined_blocked';
      const isReady = d.ready_for_copilot || d.status === 'ready';
      const dotCls = isBlocked ? 'ready-story-dot-red' : (isReady ? 'ready-story-dot-green' : 'ready-story-dot-yellow');
      let blockHtml = '';
      if (isBlocked) {
        const blockers = (d.depends_on || []).map(dep => esc(dep)).join(', ');
        const risks = (d.risk_notes || []).map(r => esc(r)).join('; ');
        blockHtml = '<div class="ready-unblock"><strong>To unblock:</strong> ' + (blockers || risks || 'Resolve dependencies') + '</div>';
      }
      const hasPrompt = d.canonical_implementation_prompt && d.canonical_implementation_prompt.trim();
      const promptId = 'ready-prompt-' + d.id.replace(/[^a-zA-Z0-9]/g, '_');
      let promptHtml = '';
      if (hasPrompt) {
        promptHtml = '<button class="ready-prompt-toggle" onclick="toggleReadyPrompt(\'' + promptId + '\')">\u25B8 Show Copilot prompt</button>'
          + '<div class="ready-prompt-block" id="' + promptId + '">' + esc(d.canonical_implementation_prompt) + '</div>'
          + '<div class="ready-prompt-actions" id="' + promptId + '-actions" style="display:none">'
          + '<button class="intake-btn intake-btn-primary" onclick="copyReadyPrompt(\'' + promptId + '\')">\uD83D\uDCCB Copy</button>'
          + '<button class="intake-btn intake-btn-promote" onclick="draftPromote(\'' + esc(d.id) + '\')">\u2B06 Start this ticket</button>'
          + '</div>';
      }
      const testOk = (d.test_protocol && d.test_protocol.length > 0) && (d.tests_to_add_or_update && d.tests_to_add_or_update.length > 0);
      const testBadge = testOk ? '\u2713 tests' : '\u26A0 tests';
      const testColor = testOk ? 'var(--p0)' : '#ff8080';
      const shapeColors = { full_stack: 'var(--accent-blue)', backend_only: 'var(--p0)', ui_only: 'var(--accent-cyan)', blocked: '#ff5252' };
      // Build enrichment chips
      var shapeLabel = d.implementation_shape ? d.implementation_shape.replace(/_/g, ' ') : '';
      var shapeTag = shapeLabel ? '<span class="intake-meta-tag" style="font-size:10px;color:' + (shapeColors[d.implementation_shape] || 'var(--text-dim)') + ';border-color:' + (shapeColors[d.implementation_shape] || 'var(--border)') + '">' + esc(shapeLabel) + '</span>' : '';
      var riskHtml = '';
      if (d.risk_notes && d.risk_notes.length > 0) {
        riskHtml = '<div style="font-size:11px;color:#ff8080;margin:2px 0 0 16px">\u26A0 ' + d.risk_notes.length + ' risk note' + (d.risk_notes.length !== 1 ? 's' : '') + ': ' + esc(d.risk_notes[0]) + (d.risk_notes.length > 1 ? ' (+' + (d.risk_notes.length - 1) + ' more)' : '') + '</div>';
      }
      var fileChips = '';
      var fList = d.files_to_modify || [];
      if (fList.length > 0) {
        var shown = fList.slice(0, 3).map(function(f) { return '<span style="font-family:\'IBM Plex Mono\',monospace;font-size:10px;padding:1px 5px;border-radius:2px;background:rgba(61,126,255,.08);border:1px solid rgba(61,126,255,.2);color:var(--accent-blue)">' + esc(f.split('/').pop()) + '</span>'; }).join('');
        fileChips = '<div style="display:flex;flex-wrap:wrap;gap:4px;margin:4px 0 0 16px">' + shown + (fList.length > 3 ? '<span style="font-family:\'IBM Plex Mono\',monospace;font-size:10px;color:var(--text-dim)">+' + (fList.length - 3) + ' more</span>' : '') + '</div>';
      }
      storyCards += '<div class="ready-story" data-draft-id="' + esc(d.id) + '">'
        + '<div class="ready-story-head">'
        + '<span class="ready-story-dot ' + dotCls + '"></span>'
        + '<span class="ready-story-title">' + esc(d.title || d.id) + '</span>'
        + '<span style="font-family:\'IBM Plex Mono\',monospace;font-size:10px;color:' + testColor + '">' + testBadge + '</span>'
        + shapeTag
        + '<button class="intake-btn intake-btn-secondary" onclick="draftEdit(\'' + esc(d.id) + '\')" style="font-size:10px;padding:2px 8px">\u270E</button>'
        + '</div>'
        + (d.goal ? '<div style="font-size:12px;color:var(--text-dim);margin:2px 0 0 16px">' + esc(d.goal) + '</div>' : '')
        + riskHtml
        + fileChips
        + blockHtml
        + promptHtml
        + '</div>';
    }
    const progressBar = progressPct > 0 ? '<div style="display:flex;align-items:center;gap:6px;padding:4px 14px">'
      + '<div style="flex:1;height:4px;background:rgba(255,255,255,.06);border-radius:2px;overflow:hidden">'
      + '<div style="width:' + progressPct + '%;height:100%;background:var(--p0);border-radius:2px"></div>'
      + '</div>'
      + '<span style="font-family:\'IBM Plex Mono\',monospace;font-size:11px;color:var(--text-dim)">' + progressPct + '%</span>'
      + '</div>' : '';
    stage4Html += '<div class="ready-epic">'
      + '<div class="ready-epic-head">'
      + (parentId !== '_orphan' ? '<span style="font-family:\'IBM Plex Mono\',monospace;font-size:11px;color:var(--text-dim)">' + esc(parentId) + '</span>' : '')
      + '<div class="ready-epic-title">' + esc(epicTitle) + '</div>'
      + '<span style="font-family:\'IBM Plex Mono\',monospace;font-size:11px;color:var(--text-dim)">' + drafts.length + ' ticket' + (drafts.length !== 1 ? 's' : '') + '</span>'
      + '</div>'
      + progressBar
      + '<div class="ready-epic-body">' + storyCards + '</div>'
      + '</div>';
  }

  // Build edit overlay HTML
  const intakeEditHtml = '<div class="intake-edit-overlay" id="intake-edit-overlay">'
    + '<div class="intake-edit-panel">'
    + '<h3>\u270E Edit Intake Item: <span id="ie-id"></span></h3>'
    + '<div class="intake-edit-row"><label>Title</label><input type="text" id="ie-title"></div>'
    + '<div class="intake-edit-row"><label>Raw Text</label><textarea id="ie-raw-text"></textarea></div>'
    + '<div class="intake-edit-row"><label>Status</label><select id="ie-status"><option value="raw">raw</option><option value="triaged">triaged</option><option value="drafted">drafted</option><option value="parked">parked</option><option value="duplicate">duplicate</option></select></div>'
    + '<div class="intake-edit-row"><label>Source</label><input type="text" id="ie-source"></div>'
    + '<div class="intake-edit-row"><label>Product Area</label><input type="text" id="ie-area"></div>'
    + '<div class="intake-edit-row"><label>Proposed Phase</label><input type="text" id="ie-phase" placeholder="e.g. P1, P2"></div>'
    + '<div class="intake-edit-row"><label>Related Features (comma-separated)</label><input type="text" id="ie-related"></div>'
    + '<div class="intake-edit-row"><label>Dependencies (comma-separated)</label><input type="text" id="ie-deps"></div>'
    + '<div class="intake-edit-row"><label>Constraints (comma-separated)</label><input type="text" id="ie-constraints"></div>'
    + '<div class="intake-edit-row"><label>Triage Notes</label><textarea id="ie-triage-notes" style="min-height:50px"></textarea></div>'
    + '<div class="intake-edit-row" style="display:flex;align-items:center;gap:6px"><input type="checkbox" id="ie-split-rec" style="width:auto"><label style="margin:0;display:inline">Split Recommended</label></div>'
    + '<div style="border-top:1px solid var(--border);margin:12px 0;padding-top:10px"><span style="font-family:\'IBM Plex Mono\',monospace;font-size:11px;color:var(--text-dim);text-transform:uppercase;letter-spacing:.08em">Triage Result (auto-filled by \u26A1 Auto-Triage)</span></div>'
    + '<div class="intake-edit-row"><label>Recommended Action</label><select id="ie-action"><option value="">--</option><option value="execute">Execute</option><option value="split">Split</option><option value="attach">Attach</option><option value="blocked">Blocked</option><option value="duplicate">Duplicate</option><option value="park">Park</option></select></div>'
    + '<div class="intake-edit-row"><label>Scope Size</label><select id="ie-scope"><option value="">--</option><option value="small">Small</option><option value="medium">Medium</option><option value="large">Large</option><option value="epic">Epic</option></select></div>'
    + '<div class="intake-edit-row"><label>Note Type</label><input type="text" id="ie-note-type" placeholder="e.g. bug, feature_request, ui_polish"></div>'
    + '<div class="intake-edit-row"><label>Duplicate Of</label><input type="text" id="ie-dup-of" placeholder="e.g. INT-003"></div>'
    + '<div class="intake-edit-actions">'
    + '<button class="intake-btn intake-btn-secondary" onclick="intakeEditClose()">CANCEL</button>'
    + '<button class="intake-btn intake-btn-primary" onclick="intakeEditSave()">SAVE</button>'
    + '</div>'
    + '</div></div>';

  const draftEditHtml = '<div class="intake-edit-overlay" id="draft-edit-overlay">'
    + '<div class="intake-edit-panel" style="max-width:680px">'
    + '<h3>\u270E Edit Draft Ticket: <span id="de-id"></span></h3>'
    + '<div class="intake-edit-row"><label>Title</label><input type="text" id="de-title"></div>'
    + '<div class="intake-edit-row"><label>Goal</label><textarea id="de-goal" style="min-height:50px"></textarea></div>'
    + '<div style="display:flex;gap:8px">'
    + '<div class="intake-edit-row" style="flex:1"><label>Phase</label><input type="text" id="de-phase" placeholder="e.g. P1"></div>'
    + '<div class="intake-edit-row" style="flex:1"><label>Order</label><input type="number" id="de-order" min="1"></div>'
    + '</div>'
    + '<div style="display:flex;gap:8px">'
    + '<div class="intake-edit-row" style="flex:1"><label>Product Area</label><input type="text" id="de-area"></div>'
    + '<div class="intake-edit-row" style="flex:1"><label>Parent Feature ID</label><input type="text" id="de-parent" placeholder="e.g. F-INV"></div>'
    + '</div>'
    + '<div class="intake-edit-row"><label>Depends On (comma-separated)</label><input type="text" id="de-depends"></div>'
    + '<div style="border-top:1px solid var(--border);margin:12px 0;padding-top:10px"><span style="font-family:\'IBM Plex Mono\',monospace;font-size:11px;color:var(--text-dim);text-transform:uppercase;letter-spacing:.08em">Scope</span></div>'
    + '<div class="intake-edit-row"><label>In Scope (one per line)</label><textarea id="de-in-scope" style="min-height:60px"></textarea></div>'
    + '<div class="intake-edit-row"><label>Out of Scope (one per line)</label><textarea id="de-out-scope" style="min-height:40px"></textarea></div>'
    + '<div class="intake-edit-row"><label>Files to Modify (one per line)</label><textarea id="de-files" style="min-height:60px"></textarea></div>'
    + '<div style="border-top:1px solid var(--border);margin:12px 0;padding-top:10px"><span style="font-family:\'IBM Plex Mono\',monospace;font-size:11px;color:var(--text-dim);text-transform:uppercase;letter-spacing:.08em">Acceptance &amp; Testing</span></div>'
    + '<div class="intake-edit-row"><label>Acceptance Criteria (one per line)</label><textarea id="de-ac" style="min-height:80px"></textarea></div>'
    + '<div class="intake-edit-row"><label>Tests to Add/Update (one per line)</label><textarea id="de-tests" style="min-height:50px"></textarea></div>'
    + '<div class="intake-edit-row"><label>Test Protocol (one per line)</label><textarea id="de-protocol" style="min-height:60px"></textarea></div>'
    + '<div class="intake-edit-row"><label>Validation Checklist (one per line)</label><textarea id="de-checklist" style="min-height:60px"></textarea></div>'
    + '<div class="intake-edit-row"><label>Post-Validation Updates (one per line)</label><textarea id="de-post-val" style="min-height:40px"></textarea></div>'
    + '<div style="border-top:1px solid var(--border);margin:12px 0;padding-top:10px"><span style="font-family:\'IBM Plex Mono\',monospace;font-size:11px;color:var(--text-dim);text-transform:uppercase;letter-spacing:.08em">Canonical Implementation Prompt</span></div>'
    + '<div class="intake-edit-row"><label>Prompt (full text)</label><textarea id="de-prompt" style="min-height:120px;font-size:12px"></textarea></div>'
    + '<div class="intake-edit-actions">'
    + '<button class="intake-btn intake-btn-secondary" onclick="draftEditClose()">CANCEL</button>'
    + '<button class="intake-btn intake-btn-primary" onclick="draftEditSave()">SAVE</button>'
    + '</div>'
    + '</div></div>';

  const intakeTabHtml = `
    <!-- Pipeline bar -->
    <div class="pipeline-bar" id="pipeline-bar">
      <div class="pipeline-seg active" onclick="pipelineSwitch(1)" data-stage="1">
        <div class="pipeline-seg-label">1 \u00B7 Capture</div>
        <div class="pipeline-seg-count">${stage1Items.length}</div>
      </div>
      <div class="pipeline-seg" onclick="pipelineSwitch(2)" data-stage="2">
        <div class="pipeline-seg-label">2 \u00B7 Clarify</div>
        <div class="pipeline-seg-count">${stage2Items.length}</div>
      </div>
      <div class="pipeline-seg" onclick="pipelineSwitch(3)" data-stage="3">
        <div class="pipeline-seg-label">3 \u00B7 Review</div>
        <div class="pipeline-seg-count">${stage3Intake.length + stage3Drafts.length}</div>
      </div>
      <div class="pipeline-seg" onclick="pipelineSwitch(4)" data-stage="4">
        <div class="pipeline-seg-label">4 \u00B7 Ready</div>
        <div class="pipeline-seg-count">${stage4Drafts.length}</div>
      </div>
    </div>

    <!-- Feedback bar -->
    <div class="pipeline-feedback" id="pipeline-feedback"></div>

    <!-- Stage 1: Capture -->
    <div class="pipeline-stage active" id="pipeline-stage-1">
      <div class="intake-toolbar">
        <div class="intake-toolbar-group">
          <button class="intake-btn intake-btn-primary" onclick="intakeFormToggle()">\u2795 NEW</button>
          <button class="intake-btn intake-btn-secondary" onclick="intakeBulkToggle()">\uD83D\uDCCB PASTE BULK</button>
        </div>
        <div class="intake-toolbar-spacer"></div>
        <span style="font-family:'IBM Plex Mono',monospace;font-size:11px;color:var(--text-dim)">${stage1Items.length} item${stage1Items.length !== 1 ? 's' : ''} to review</span>
      </div>

      <!-- Inline form -->
      <div class="intake-form" id="intakeFormBlock" style="display:none">
        <textarea id="intakeRawText" placeholder="Paste product notes, meeting minutes, feature requests, bug reports\u2026"></textarea>
        <div class="intake-form-row">
          <input type="text" id="intakeTitle" placeholder="Title (optional)">
          <input type="text" id="intakeSource" placeholder="Source (e.g. meeting, retro)">
          <input type="text" id="intakeArea" placeholder="Product area">
          <button class="intake-btn intake-btn-primary" onclick="intakeSubmit()">\u2795 ADD</button>
          <button class="intake-btn intake-btn-secondary" onclick="intakeFormToggle()">CANCEL</button>
        </div>
      </div>

      <!-- Bulk paste panel -->
      <div class="intake-bulk-panel" id="intakeBulkPanel">
        <div style="font-family:'IBM Plex Mono',monospace;font-size:13px;color:var(--text-bright);margin-bottom:8px">\uD83D\uDCCB Paste Bulk Notes</div>
        <div style="font-size:12px;color:var(--text-dim);margin-bottom:8px">Paste meeting minutes, backlog dumps, or feature requests. Click <strong style="color:var(--accent-blue)">PARSE</strong> to split into items.</div>
        <textarea id="intakeBulkText" placeholder="Paste a large block of text here\u2026"></textarea>
        <div class="intake-form-row">
          <input type="text" id="intakeBulkSource" placeholder="Source (e.g. meeting-2026-03-19)">
          <input type="text" id="intakeBulkArea" placeholder="Product area">
          <button class="intake-btn intake-btn-primary" onclick="intakeBulkParse()">\uD83D\uDD0D PARSE</button>
          <button class="intake-btn intake-btn-secondary" onclick="intakeBulkToggle()">CLOSE</button>
        </div>
        <div class="intake-bulk-preview" id="intakeBulkPreview"></div>
        <div id="intakeBulkActions" style="display:none;margin-top:8px">
          <button class="intake-btn intake-btn-promote" onclick="intakeBulkCreate()">\u2705 CREATE ALL</button>
          <button class="intake-btn intake-btn-primary" onclick="intakeBulkIngest()">\u26A1 FULL INGEST</button>
          <span id="intakeBulkCount" style="font-family:'IBM Plex Mono',monospace;font-size:12px;color:var(--text-dim);margin-left:8px"></span>
        </div>
      </div>

      ${stage1Html || '<div class="intake-empty">No new items.<br><br>Click <strong style="color:var(--accent-blue)">\u2795 NEW</strong> or <strong style="color:var(--accent-blue)">\uD83D\uDCCB PASTE BULK</strong> to add items.</div>'}
    </div>

    <!-- Stage 2: Clarify -->
    <div class="pipeline-stage" id="pipeline-stage-2">
      <div class="intake-toolbar">
        <div class="intake-toolbar-group">
          <button class="intake-btn intake-btn-primary" onclick="clarifyQueueAll()">\u2705 Queue all for review</button>
        </div>
        <div class="intake-toolbar-spacer"></div>
        <span style="font-family:'IBM Plex Mono',monospace;font-size:11px;color:var(--text-dim)">${stage2Items.length} item${stage2Items.length !== 1 ? 's' : ''} to review</span>
      </div>
      ${stage2Html || '<div class="intake-empty">Nothing to clarify.<br><br>Items move here after you queue them from Capture.</div>'}
    </div>

    <!-- Stage 3: Review -->
    <div class="pipeline-stage" id="pipeline-stage-3">
      <div style="border-left:4px solid var(--accent-blue);padding:8px 12px;margin:0 0 10px;font-size:12px;color:var(--text-dim);background:rgba(61,126,255,.06);border-radius:0 4px 4px 0">Review what\u2019s queued below. When you\u2019re ready, turn everything into epics and stories in one go \u2014 the system handles splitting, dependencies, and implementation details.</div>
      <div class="intake-toolbar">
        <div class="intake-toolbar-group">
          <button class="intake-btn intake-btn-primary" id="processAllBtn" onclick="processAllDrafts()">\u2728 Turn into epics &amp; stories</button>
        </div>
        <div class="intake-toolbar-spacer"></div>
        <span style="font-family:'IBM Plex Mono',monospace;font-size:11px;color:var(--text-dim)">${(stage3Intake.length + stage3Drafts.length) > 0 ? (stage3Intake.length + stage3Drafts.length) + ' note' + ((stage3Intake.length + stage3Drafts.length) !== 1 ? 's' : '') + ' ready \u2014 click to generate stories' : 'Nothing here yet \u2014 go back to Capture and queue some notes'}</span>
      </div>
      ${stage3Html || '<div class="intake-empty">Nothing here yet.<br><br>Go back to Capture, add some notes, then queue them through Clarify.</div>'}
    </div>

    <!-- Stage 4: Ready -->
    <div class="pipeline-stage" id="pipeline-stage-4">
      <div class="intake-toolbar">
        <div class="intake-toolbar-group">
          <button class="intake-btn intake-btn-secondary" onclick="showNextTicket()">\u25B6 NEXT TICKET</button>
        </div>
        <div class="intake-toolbar-spacer"></div>
        <span style="font-family:'IBM Plex Mono',monospace;font-size:11px;color:var(--text-dim)">${stage4Drafts.length} ticket${stage4Drafts.length !== 1 ? 's' : ''} ready</span>
      </div>
      ${stage4Html || '<div class="intake-empty">Your epics and stories will appear here once you review your notes and click <strong style="color:var(--accent-blue)">\u2728 Turn into epics &amp; stories</strong>.</div>'}
    </div>

    <!-- Edit overlays -->
    ${intakeEditHtml}
    ${draftEditHtml}`;

  // ─── Signals tab ───
  let signalRows = "";
  for (const f of computed) {
    const detType = f.detection && f.detection.checks && f.detection.checks.length > 0 ? f.detection.checks[0].type : "none";
    signalRows += `<tr><td style="color:var(--text)">${esc(f.id)}</td><td style="color:${statusTextColor(f.computedStatus)}">${statusLabel(f.computedStatus)}</td><td style="color:var(--text-dim)">${esc(f.signal)}</td><td style="color:var(--text-dim)">${esc(detType)}</td></tr>`;
  }

  // Codebase signal panels
  const modelsListHtml = signals.models.length > 0
    ? signals.models.map(m => esc(m)).join(" \u00B7 ")
    : "schema.prisma not found";
  const workflowsListHtml = signals.workflows.length > 0
    ? signals.workflows.map(w => esc(w.replace(".ts", ""))).join(" \u00B7 ")
    : "workflows/ not found";
  const routesListHtml = signals.routes.length > 0
    ? signals.routes.map(r => esc(r.replace(".ts", ""))).join(" \u00B7 ")
    : "routes/ not found";

  // ─── Build backlog kanban (slice-first) ───
  // backlogItems already built above (before stats computation).
  const blPhases = [...new Set(backlogItems.map(i => i.phase))].sort();
  const blTypes = [...new Set(backlogItems.map(i => i.type))].sort();

  const blCols = [
    { key: "ready", label: "READY", color: "var(--p0)" },
    { key: "in_progress", label: "IN PROGRESS", color: "var(--p3)" },
    { key: "blocked", label: "BLOCKED", color: "#ff5a5a" },
    { key: "done", label: "DONE", color: "var(--text-dim)" },
  ];

  // ── Filter bar ──
  let backlogTabHtml = '<div class="filter-bar">';
  backlogTabHtml += '<span class="bl-filter-group" id="bl-phase-group"><span style="font-family:\'IBM Plex Mono\',monospace;font-size:12px;color:var(--text-dim)">Phase:</span>';
  backlogTabHtml += '<button class="filter-btn active" data-val="all" onclick="blFilter(this)">ALL</button>';
  for (const ph of blPhases) {
    const cVar = phaseColorVar[ph] || "--text-dim";
    backlogTabHtml += '<button class="filter-btn" data-val="' + ph + '" onclick="blFilter(this)" style="color:var(' + cVar + ')">' + ph + '</button>';
  }
  backlogTabHtml += '</span>';
  backlogTabHtml += '<span class="bl-filter-group" id="bl-type-group" style="margin-left:12px"><span style="font-family:\'IBM Plex Mono\',monospace;font-size:12px;color:var(--text-dim)">Type:</span>';
  backlogTabHtml += '<button class="filter-btn active" data-val="all" onclick="blFilter(this)">ALL</button>';
  for (const tp of blTypes) {
    backlogTabHtml += '<button class="filter-btn" data-val="' + tp + '" onclick="blFilter(this)">' + esc(tp.toUpperCase()) + '</button>';
  }
  backlogTabHtml += '</span>';
  backlogTabHtml += '<span class="ws-session-bar">';
  backlogTabHtml += '<button class="ws-session-btn" onclick="openTicketForm()" title="Create a new custom ticket">\u2795 NEW TICKET</button>';
  backlogTabHtml += '<span class="ws-session-count" id="ws-count"></span>';
  backlogTabHtml += '<button class="ws-session-btn" id="ws-filter-btn" onclick="wsFilterActive()">MY ACTIVE</button>';
  backlogTabHtml += '<button class="ws-session-btn" onclick="wsClearAll()" title="Clear all local working states">CLEAR SESSION</button>';
  backlogTabHtml += '</span></div>';

  // ── Kanban columns ──
  backlogTabHtml += '<div class="kanban-board" id="bl-board">';
  for (const col of blCols) {
    const colItems = backlogItems.filter(i => i.column === col.key);
    let cards = "";
    for (const item of colItems) {
      const cVar = phaseColorVar[item.phase] || "--text-dim";
      const tClass = "type-" + (item.type === "user_story" ? "story" : item.type);
      const shortDesc = item.description.length > 100 ? item.description.slice(0, 100) + "\u2026" : item.description;
      const filesHtml = item.files.slice(0, 3).map(function(f) {
        const bn = f.split("/").pop();
        return '<span class="bl-card-file" title="' + esc(f) + '">' + esc(bn) + '</span>';
      }).join("");
      const parentHtml = item.isSlice && item.parentId
        ? '<div class="bl-card-parent">\u21B3 ' + esc(item.parentId) + ': ' + esc(item.parentTitle) + '</div>'
        : "";
      // Use blockedBy[] (with titles) if available from chrono engine, else fall back to pendingDeps
      let blockedHtml = "";
      if (item.column === "blocked" && item.blockedBy && item.blockedBy.length > 0) {
        blockedHtml = '<div class="bl-blocked-by">\u26D4 Blocked by: '
          + item.blockedBy.map(function(b) { return '<strong>' + esc(b.id) + '</strong> ' + esc(b.title); }).join(" \u00B7 ")
          + '</div>';
      } else if (item.column === "blocked" && item.pendingDeps.length > 0) {
        blockedHtml = '<div class="bl-blocked-by">\u26D4 Blocked by: '
          + item.pendingDeps.map(function(d) { return esc(d); }).join(" \u00B7 ")
          + '</div>';
      }

      const tpId = item.id.replace(/[^a-zA-Z0-9]/g, '_');
      const tpText = generateTicketPrompt(item, roadmap, computed, signals, stats);

      cards += '<div class="kanban-card" data-bl-phase="' + esc(item.phase) + '" data-bl-type="' + esc(item.type) + '" data-bl-id="' + esc(item.id) + '">'
        + '<div class="bl-card-head">'
        + '<div class="phase-badge" style="color:var(' + cVar + ');border-color:var(' + cVar + ')40;background:var(' + cVar + ')10;font-size:10px;padding:1px 5px">' + esc(item.phase) + '</div>'
        + '<div class="feature-type ' + tClass + '" style="font-size:10px">' + esc(item.type.toUpperCase()) + '</div>'
        + (item.isSlice ? '<span style="font-family:\'IBM Plex Mono\',monospace;font-size:10px;padding:1px 4px;border-radius:2px;background:rgba(61,126,255,.08);border:1px solid rgba(61,126,255,.2);color:#7aaeff">slice</span>' : '')
        + testBadgeHtml(item)
        + '<span class="bl-card-id">' + esc(item.id) + '</span>'
        + '</div>'
        + '<div class="bl-card-title">' + esc(item.title) + '</div>'
        + parentHtml
        + '<div class="bl-card-desc">' + esc(shortDesc) + '</div>'
        + (filesHtml ? '<div class="bl-card-files">' + filesHtml + '</div>' : '')
        + blockedHtml
        + '<div class="ws-bar">'
        + '<button class="ws-btn" data-ws="drafting" onclick="wsToggle(this)">DRAFTING</button>'
        + '<button class="ws-btn" data-ws="implementing" onclick="wsToggle(this)">IMPLEMENTING</button>'
        + '</div>'
        + '<button class="tp-toggle" onclick="toggleTP(\'' + tpId + '\')">\u25B6 SHOW PROMPT</button>'
        + '<div class="tp-block" id="tp-' + tpId + '" style="display:none">'
        + '<div class="tp-body">' + esc(tpText) + '</div>'
        + '<div class="tp-actions"><button class="tp-copy" onclick="copyTP(this,\'' + tpId + '\')">COPY</button></div>'
        + formatAfterCompletionHtml(item.id, recommendations.length > 0 ? recommendations[0].title : null)
        + '</div>'
        + '</div>';
    }
    backlogTabHtml += '<div class="kanban-col">'
      + '<div class="kanban-col-head">'
      + '<div style="width:8px;height:8px;border-radius:50%;background:' + col.color + '"></div>'
      + '<div class="kanban-col-title" style="color:' + col.color + '">' + col.label + '</div>'
      + '<div class="kanban-col-count">' + colItems.length + '</div>'
      + '</div>'
      + '<div class="kanban-col-body">' + (cards || '<div style="padding:20px;text-align:center;color:var(--text-dim);font-family:\'IBM Plex Mono\',monospace;font-size:12px">Empty</div>') + '</div>'
      + '</div>';
  }
  backlogTabHtml += '</div>';

  // ─── Build "Next Recommended" panel (top of page) ───
  let recPanelHtml = "";
  if (recommendations.length > 0) {
    let recCards = "";
    for (let ri = 0; ri < recommendations.length; ri++) {
      const r = recommendations[ri];
      const cVar = phaseColorVar[r.phase] || "--text-dim";
      const tClass = "type-" + (r.type === "user_story" ? "story" : r.type);
      const isBlocked = r.column === "blocked";
      const stateClass = isBlocked ? "blocked" : "unblocked";
      const stateBadge = isBlocked
        ? '<span class="blocked-badge">BLOCKED</span>'
        : '<span class="ready-badge">READY</span>';
      const parentHtml = r.isSlice && r.parentTitle
        ? '<div class="rec-parent">\u21B3 ' + esc(r.parentId) + ': ' + esc(r.parentTitle) + '</div>'
        : '';
      const reasonText = r.reasons.join(" \u00B7 ");
      const filesHtml = (r.files || []).slice(0, 3).map(function(f) {
        const bn = f.split("/").pop();
        return '<span class="rec-file" title="' + esc(f) + '">' + esc(bn) + '</span>';
      }).join("");
      // Use new blockedBy[] (with titles) for rich blocker display
      let blockedHtml = '';
      if (isBlocked && r.blockedBy && r.blockedBy.length > 0) {
        blockedHtml = '<div class="rec-blocked">\u26D4 Blocked by: '
          + r.blockedBy.map(function(b) { return '<strong>' + esc(b.id) + '</strong> ' + esc(b.title); }).join(" \u00B7 ")
          + '</div>';
      } else if (isBlocked && r.pendingDeps && r.pendingDeps.length > 0) {
        blockedHtml = '<div class="rec-blocked">\u26D4 ' + r.pendingDeps.map(function(d) { return esc(d); }).join(" \u00B7 ") + '</div>';
      }

      const recTpId = 'rec_' + r.id.replace(/[^a-zA-Z0-9]/g, '_');
      const recTpText = generateTicketPrompt(r, roadmap, computed, signals, stats);

      recCards += '<div class="rec-item ' + stateClass + '"'
        + ' data-rec-id="' + esc(r.id) + '"'
        + '>'
        + '<div class="rec-rank">' + (r.rank || ri + 1) + '</div>'
        + '<div class="rec-body">'
        + '<div class="rec-meta">'
        + (function() {
            var ml = r.movementLabel || '\u2014';
            var mc = ml === 'NEW' ? 'rec-move-new'
              : (r.movement > 0) ? 'rec-move-up'
              : (r.movement < 0) ? 'rec-move-down'
              : 'rec-move-same';
            return '<span class="rec-movement ' + mc + '">' + esc(ml) + '</span>';
          })()
        + stateBadge
        + '<div class="phase-badge" style="color:var(' + cVar + ');border-color:var(' + cVar + ')40;background:var(' + cVar + ')10;font-size:10px;padding:1px 5px">' + esc(r.phase) + '</div>'
        + '<div class="feature-type ' + tClass + '" style="font-size:10px">' + esc(r.type.toUpperCase()) + '</div>'
        + (r.isSlice ? '<span style="font-family:\'IBM Plex Mono\',monospace;font-size:10px;padding:1px 4px;border-radius:2px;background:rgba(61,126,255,.08);border:1px solid rgba(61,126,255,.2);color:#7aaeff">slice</span>' : '')
        + (r.isCustom ? '<span style="font-family:\'IBM Plex Mono\',monospace;font-size:10px;padding:1px 4px;border-radius:2px;background:rgba(46,204,220,.08);border:1px solid rgba(46,204,220,.2);color:var(--accent-cyan)">ticket</span>' : '')
        + testBadgeHtml(r)
        + (r.unlocks > 0 ? '<span style="font-family:\'IBM Plex Mono\',monospace;font-size:10px;padding:1px 4px;border-radius:2px;background:rgba(46,204,138,.08);border:1px solid rgba(46,204,138,.2);color:#5ed9a0">unlocks ' + r.unlocks + '</span>' : '')
        + '<span style="font-family:\'IBM Plex Mono\',monospace;font-size:10px;color:var(--text-dim);margin-left:auto">' + esc(r.id) + '</span>'
        + '</div>'
        + '<div class="rec-title">' + esc(r.title) + '</div>'
        + parentHtml
        + '<div class="rec-reason">\u2192 ' + esc(reasonText) + '</div>'
        + (filesHtml ? '<div class="rec-files">' + filesHtml + '</div>' : '')
        + blockedHtml
        + '<button class="tp-toggle" onclick="toggleTP(\'' + recTpId + '\')">\u25B6 SHOW PROMPT</button>'
        + '<div class="tp-block" id="tp-' + recTpId + '" style="display:none">'
        + '<div class="tp-body">' + esc(recTpText) + '</div>'
        + '<div class="tp-actions"><button class="tp-copy" onclick="copyTP(this,\'' + recTpId + '\')">COPY</button></div>'
        + formatAfterCompletionHtml(r.id, (ri + 1 < recommendations.length) ? recommendations[ri + 1].title : null)
        + '</div>'
        + '</div></div>';
    }

    recPanelHtml = '<div class="rec-panel" id="rec-panel">'
      + '<div class="rec-panel-head">'
      + '<div class="panel-head-dot" style="background:var(--accent-cyan)"></div>'
      + '<div class="rec-panel-head-title">Next Recommended \u2014 Top ' + recommendations.length + '</div>'
      + '<span style="font-family:\'IBM Plex Mono\',monospace;font-size:11px;color:var(--text-dim);margin-left:auto">chronological \u00B7 dependency-aware \u00B7 9-rule ranking</span>'
      + '<button class="rec-refresh-btn" id="rec-refresh-btn" onclick="refreshTop5()">\u21BB REFRESH TOP 5</button>'
      + '</div>'
      + '<div class="rec-timestamp" id="rec-timestamp">Generated: ' + now + ' \u00B7 ' + recsResult.total + ' items in queue</div>'
      + '<div class="rec-grid" id="rec-grid">' + recCards + '</div>'
      + '</div>';
  }

  // ─── Build next slices ───
  let slicesTabHtml = "";

  if (readyFeatures.length > 0) {
    slicesTabHtml += '<div class="section-label"><div class="section-label-dot" style="background:var(--p0)"></div> READY TO START (' + readyFeatures.length + ')</div>';
    slicesTabHtml += '<div class="slice-list" style="margin-bottom:24px">';
    for (const f of readyFeatures) {
      const cVar = phaseColorVar[f.phase] || "--text-dim";
      const hNew = (f.hooks_new || []).map(h => '<span class="hook new">' + esc(h) + '</span>').join("");
      const hExist = (f.hooks_existing || []).map(h => '<span class="hook exists">' + esc(h) + '</span>').join("");
      const depHtml = (f.depends_on || []).map(depId => {
        const dep = computed.find(d => d.id === depId);
        return dep ? '<span class="dep-done">' + esc(dep.id) + ' \u2714</span>' : '<span class="dep-pending">' + esc(depId) + ' ?</span>';
      }).join("");

      slicesTabHtml += '<div class="slice-card ready">'
        + '<div class="slice-card-head">'
        + '<span class="ready-badge">READY</span>'
        + '<div class="phase-badge" style="color:var(' + cVar + ');border-color:var(' + cVar + ')40;background:var(' + cVar + ')10">' + esc(f.phase) + '</div>'
        + '<span class="slice-card-title">' + esc(f.title) + '</span>'
        + '<div class="feature-type type-' + f.type + '">' + esc(f.type.toUpperCase()) + '</div>'
        + (f.priority ? '<span style="font-family:\'IBM Plex Mono\',monospace;font-size:12px;color:var(--p3)">Priority ' + f.priority + '/5</span>' : '')
        + '<span style="font-family:\'IBM Plex Mono\',monospace;font-size:12px;color:var(--text-dim);margin-left:auto">' + esc(f.id) + '</span>'
        + '</div>'
        + '<div class="slice-card-desc">' + esc(f.description) + '</div>'
        + '<div class="slice-card-hooks">' + hExist + hNew + '</div>'
        + (depHtml ? '<div class="slice-card-deps">Dependencies: ' + depHtml + '</div>' : '')
        + '</div>';
    }
    slicesTabHtml += '</div>';
  }

  if (blockedFeatures.length > 0) {
    slicesTabHtml += '<div class="section-label"><div class="section-label-dot" style="background:#ff5a5a"></div> BLOCKED BY DEPENDENCIES (' + blockedFeatures.length + ')</div>';
    slicesTabHtml += '<div class="slice-list">';
    for (const f of blockedFeatures) {
      const cVar = phaseColorVar[f.phase] || "--text-dim";
      const depHtml = (f.depends_on || []).map(depId => {
        const dep = computed.find(d => d.id === depId);
        const isDone = dep && dep.computedStatus === "done";
        return isDone ? '<span class="dep-done">' + esc(depId) + ' \u2714</span>' : '<span class="dep-pending">' + esc(depId) + ' \u2718</span>';
      }).join("");

      slicesTabHtml += '<div class="slice-card blocked">'
        + '<div class="slice-card-head">'
        + '<span class="blocked-badge">BLOCKED</span>'
        + '<div class="phase-badge" style="color:var(' + cVar + ');border-color:var(' + cVar + ')40;background:var(' + cVar + ')10">' + esc(f.phase) + '</div>'
        + '<span class="slice-card-title">' + esc(f.title) + '</span>'
        + '<span style="font-family:\'IBM Plex Mono\',monospace;font-size:12px;color:var(--text-dim);margin-left:auto">' + esc(f.id) + '</span>'
        + '</div>'
        + '<div class="slice-card-desc">' + esc(f.description) + '</div>'
        + '<div class="slice-card-deps">Blocked by: ' + depHtml + '</div>'
        + '</div>';
    }
    slicesTabHtml += '</div>';
  }

  if (readyFeatures.length === 0 && blockedFeatures.length === 0) {
    slicesTabHtml = '<div style="padding:40px;text-align:center;color:var(--p0);font-family:IBM Plex Mono,monospace;font-size:15px">\uD83C\uDF89 All features complete!</div>';
  }

  // ─── Build copilot prompts ───
  let promptsTabHtml = "";

  if (readyFeatures.length > 0) {
    promptsTabHtml += '<div style="background:rgba(61,126,255,.06);border:1px solid rgba(61,126,255,.2);border-radius:4px;padding:7px 11px;font-size:13px;color:#7aaeff;font-family:\'IBM Plex Mono\',monospace;margin-bottom:16px">\u2139\uFE0F  Each prompt below is a complete context block for GitHub Copilot. Click COPY and paste into Copilot Chat to start implementing.</div>';

    for (let i = 0; i < readyFeatures.length; i++) {
      const f = readyFeatures[i];
      const promptText = generateCopilotPrompt(f, roadmap, computed, signals, stats);
      const cVar = phaseColorVar[f.phase] || "--text-dim";

      promptsTabHtml += '<div class="prompt-card">'
        + '<div class="prompt-card-head">'
        + '<div class="phase-badge" style="color:var(' + cVar + ');border-color:var(' + cVar + ')40;background:var(' + cVar + ')10">' + esc(f.phase) + '</div>'
        + '<span style="font-size:14px;font-weight:600;color:var(--text-bright)">' + esc(f.title) + '</span>'
        + '<span style="font-family:\'IBM Plex Mono\',monospace;font-size:12px;color:var(--text-dim)">' + esc(f.id) + '</span>'
        + '<button class="copy-btn" onclick="copyPrompt(this,' + i + ')">COPY</button>'
        + '</div>'
        + '<div class="prompt-card-body" id="prompt-' + i + '">' + esc(promptText) + '</div>'
        + formatAfterCompletionHtml(f.id, recommendations.length > 0 ? recommendations[0].title : null)
        + '</div>';
    }
  } else {
    promptsTabHtml = '<div style="padding:40px;text-align:center;color:var(--p0);font-family:IBM Plex Mono,monospace;font-size:15px">\uD83C\uDF89 All features complete \u2014 no prompts to generate!</div>';
  }

  // ─── Build NEXT UP hero card (chronological) ───
  let nextUpHtml = "";
  if (chronoQueue.next) {
    const nu = chronoQueue.next;
    const nuCVar = phaseColorVar[nu.phase] || "--text-dim";
    const nuTClass = "type-" + (nu.type === "user_story" ? "story" : nu.type);
    const nuTpId = "nextup_" + nu.id.replace(/[^a-zA-Z0-9]/g, "_");
    const nuTpText = generateTicketPrompt(nu, roadmap, computed, signals, stats);
    const nuDesc = nu.description.length > 200 ? nu.description.slice(0, 200) + "\u2026" : nu.description;
    const nuParent = nu.isSlice && nu.parentId
      ? '<span style="font-family:\'IBM Plex Mono\',monospace;font-size:12px;color:var(--accent-blue);opacity:.8">\u21B3 ' + esc(nu.parentId) + ': ' + esc(nu.parentTitle) + '</span>'
      : '';

    // Explanation: why is this item next?
    const nuReasons = (nu.reasons || []).join(" · ");
    const nuExplanation = nuReasons
      ? '<div style="font-family:\'IBM Plex Mono\',monospace;font-size:12px;color:var(--accent-cyan);margin-bottom:8px;line-height:1.6">'
        + '\u2192 ' + esc(nuReasons) + '</div>'
      : '';

    // Queue preview — show next 5 items after the first
    let queuePreview = "";
    var previewItems = chronoQueue.queue.slice(1, 6);
    if (previewItems.length > 0) {
      queuePreview = '<div class="next-up-queue">Queue: ';
      for (var qi = 0; qi < previewItems.length; qi++) {
        var qItem = previewItems[qi];
        var qBlocked = qItem.column === "blocked" ? " \u26D4" : "";
        queuePreview += '<span class="next-up-queue-item">'
          + '<span class="next-up-queue-num">' + (qi + 2) + '.</span>'
          + '<span class="next-up-queue-title">' + esc(qItem.title) + qBlocked + '</span>'
          + '</span>';
      }
      if (chronoQueue.queue.length > 6) {
        queuePreview += '<span style="color:var(--text-dim)">+' + (chronoQueue.queue.length - 6) + ' more</span>';
      }
      queuePreview += '</div>';
    }

    nextUpHtml = '<div class="next-up">'
      + '<div class="next-up-label"><span class="next-up-pulse"></span>NEXT UP \u2014 CHRONOLOGICAL QUEUE (' + chronoQueue.queue.length + ' remaining)</div>'
      + '<div class="next-up-title">' + esc(nu.title) + '</div>'
      + '<div class="next-up-meta">'
      + '<div class="phase-badge" style="color:var(' + nuCVar + ');border-color:var(' + nuCVar + ')40;background:var(' + nuCVar + ')10">' + esc(nu.phase) + '</div>'
      + '<div class="feature-type ' + nuTClass + '">' + esc(nu.type.toUpperCase()) + '</div>'
      + (nu.isSlice ? '<span style="font-family:\'IBM Plex Mono\',monospace;font-size:11px;padding:2px 6px;border-radius:2px;background:rgba(61,126,255,.08);border:1px solid rgba(61,126,255,.2);color:#7aaeff">slice</span>' : '')
      + testBadgeHtml(nu)
      + '<span style="font-family:\'IBM Plex Mono\',monospace;font-size:12px;color:var(--text-dim)">' + esc(nu.id) + '</span>'
      + (nu.unlocks > 0 ? '<span style="font-family:\'IBM Plex Mono\',monospace;font-size:11px;padding:2px 6px;border-radius:2px;background:rgba(46,204,138,.08);border:1px solid rgba(46,204,138,.2);color:#5ed9a0">unlocks ' + nu.unlocks + '</span>' : '')
      + nuParent
      + '</div>'
      + nuExplanation
      + '<div class="next-up-desc">' + esc(nuDesc) + '</div>'
      + '<div class="next-up-actions">'
      + '<button class="next-up-btn next-up-btn-primary" onclick="toggleTP(\'' + nuTpId + '\')">SHOW FULL PROMPT</button>'
      + '<button class="next-up-btn next-up-btn-secondary" onclick="copyNextUpPrompt()">COPY PROMPT</button>'
      + '</div>'
      + '<div class="tp-block" id="tp-' + nuTpId + '" style="display:none">'
      + '<div class="tp-body" id="nextup-prompt-body">' + esc(nuTpText) + '</div>'
      + '<div class="tp-actions"><button class="tp-copy" onclick="copyTP(this,\'' + nuTpId + '\')">COPY</button></div>'
      + '</div>'
      + queuePreview
      + '</div>';
  }

  // ─── Build ticket form (modal) — full-featured with all required fields ───
  // Collect all known IDs for dependency autocomplete
  const allKnownIds = [];
  for (const f of computed) {
    allKnownIds.push({ id: f.id, title: f.title, type: "feature" });
    for (const s of (f.slicesComputed || [])) {
      allKnownIds.push({ id: s.id, title: s.title, type: "slice" });
    }
  }
  for (const c of customItems) {
    allKnownIds.push({ id: c.id, title: c.title, type: "custom" });
  }

  // Phase options for select
  const phaseOpts = phases.map(function (p) {
    return '<option value="' + esc(p.id) + '">' + esc(p.id) + ' \u2014 ' + esc(p.name) + '</option>';
  }).join("");

  // Feature options for parent_feature select
  const featureOpts = '<option value="">— none —</option>'
    + computed.map(function (f) {
      return '<option value="' + esc(f.id) + '">' + esc(f.id) + ': ' + esc(f.title) + '</option>';
    }).join("");

  const ticketFormHtml = '<div class="ticket-form-overlay" id="ticket-form-overlay">'
    + '<div class="ticket-form">'
    + '<h3 id="tf-heading">\u2795 Create Ticket</h3>'

    // ── Row 1: ID + Phase + Order ──
    + '<div class="tf-row-3">'
    + '<div><label>ID <span class="tf-req">*</span></label>'
    + '<input id="tf-id" type="text" placeholder="auto-generated" /></div>'
    + '<div><label>Phase <span class="tf-req">*</span></label>'
    + '<select id="tf-phase">' + phaseOpts + '</select></div>'
    + '<div><label>Order <span class="tf-req">*</span></label>'
    + '<input id="tf-order" type="number" min="1" value="1" /></div>'
    + '</div>'

    // ── Title ──
    + '<label>Title <span class="tf-req">*</span></label>'
    + '<input id="tf-title" type="text" placeholder="As a manager, I want..." />'

    // ── Row 2: Type + Status + Persona ──
    + '<div class="tf-row-3">'
    + '<div><label>Type</label>'
    + '<select id="tf-type"><option value="task">task</option><option value="user_story">user_story</option><option value="bug">bug</option><option value="spike">spike</option></select></div>'
    + '<div><label>Status</label>'
    + '<select id="tf-status"><option value="planned">planned</option><option value="in_progress">in_progress</option><option value="blocked">blocked</option><option value="done">done</option></select></div>'
    + '<div><label>Persona</label>'
    + '<select id="tf-persona"><option value="">—</option><option value="manager">manager</option><option value="tenant">tenant</option><option value="owner">owner</option><option value="contractor">contractor</option></select></div>'
    + '</div>'

    // ── Row 3: Ticket Ref + Parent Feature ──
    + '<div class="tf-row">'
    + '<div><label>Ticket Ref</label>'
    + '<input id="tf-ticket" type="text" placeholder="GH-123" /></div>'
    + '<div><label>Parent Feature</label>'
    + '<select id="tf-parent">' + featureOpts + '</select></div>'
    + '</div>'

    // ── Description ──
    + '<label>Description</label>'
    + '<textarea id="tf-desc" placeholder="Detailed task description..." rows="3"></textarea>'

    // ── Dependencies ──
    + '<div class="tf-section">'
    + '<div class="tf-section-title">Dependencies</div>'
    + '<div class="tf-hint">Reference IDs of items this ticket depends on</div>'
    + '<div class="tf-list-input"><input id="tf-dep-input" type="text" placeholder="e.g. F-P0-001" list="tf-dep-list" />'
    + '<button onclick="tfAddDep()">+ ADD</button></div>'
    + '<datalist id="tf-dep-list">' + allKnownIds.map(function (k) { return '<option value="' + esc(k.id) + '">' + esc(k.title) + '</option>'; }).join("") + '</datalist>'
    + '<div class="tf-list-items" id="tf-deps"></div>'
    + '</div>'

    // ── Files Expected ──
    + '<div class="tf-section">'
    + '<div class="tf-section-title">Files Expected</div>'
    + '<div class="tf-list-input"><input id="tf-file-input" type="text" placeholder="apps/api/src/services/..." />'
    + '<button onclick="tfAddFile()">+ ADD</button></div>'
    + '<div class="tf-list-items" id="tf-files"></div>'
    + '</div>'

    // ── Acceptance Criteria ──
    + '<div class="tf-section">'
    + '<div class="tf-section-title">Acceptance Criteria <span class="tf-req">*</span></div>'
    + '<div class="tf-list-input"><input id="tf-ac-input" type="text" placeholder="Feature does X when Y" />'
    + '<button onclick="tfAddAC()">+ ADD</button></div>'
    + '<div class="tf-list-items" id="tf-acs"></div>'
    + '</div>'

    // ── Required Tests ──
    + '<div class="tf-section">'
    + '<div class="tf-section-title">Required Tests <span class="tf-req">*</span></div>'
    + '<div class="tf-list-input"><input id="tf-test-input" type="text" placeholder="Unit test for service function" />'
    + '<button onclick="tfAddTest()">+ ADD</button></div>'
    + '<div class="tf-list-items" id="tf-tests"></div>'
    + '</div>'

    // ── Test Protocol ──
    + '<div class="tf-section">'
    + '<div class="tf-section-title">Test Protocol <span class="tf-req">*</span></div>'
    + '<textarea id="tf-test-protocol" rows="8" placeholder="1. npx tsc --noEmit\n2. npm test\n3. npm run blueprint">1. npx tsc --noEmit \u2014 zero TypeScript errors\n2. npm test \u2014 all tests pass\n3. npm run blueprint \u2014 architecture docs sync\n4. Ticket-specific verification: verify acceptance criteria manually\n5. Regression checks: verify adjacent features still work\n6. API contract sync: if API changed, verify DTOs/OpenAPI/api-client match\n7. UI verification: if UI changed, manual check in browser\n8. Edge cases: verify behavior with missing/null data</textarea>'
    + '</div>'

    // ── Validation Checklist ──
    + '<div class="tf-section">'
    + '<div class="tf-section-title">Validation Checklist <span class="tf-req">*</span></div>'
    + '<div class="tf-list-input"><input id="tf-val-input" type="text" placeholder="No layer violations introduced" />'
    + '<button onclick="tfAddVal()">+ ADD</button></div>'
    + '<div class="tf-list-items" id="tf-vals"></div>'
    + '</div>'

    // ── Post-Validation Protocol ──
    + '<div class="tf-section">'
    + '<div class="tf-section-title">Post-Validation Protocol <span class="tf-req">*</span> <button class="tf-infer-btn" onclick="tfInferPV()" title="Infer from files_expected + ticket type">\u26A1 INFER FROM FILES</button></div>'
    + '<div class="tf-list-input"><input id="tf-pv-input" type="text" placeholder="Run validation wizard or: node scripts/roadmap-ticket.js validate ID" />'
    + '<button onclick="tfAddPV()">+ ADD</button></div>'
    + '<div class="tf-list-items" id="tf-pvs"></div>'
    + '</div>'

    // ── Notes ──
    + '<label>Notes</label>'
    + '<textarea id="tf-notes" placeholder="Additional context..." rows="2"></textarea>'

    // ── Errors / Success ──
    + '<div class="tf-errors" id="tf-errors"></div>'
    + '<div class="tf-success" id="tf-success"></div>'

    // ── Hidden: edit mode tracking ──
    + '<input type="hidden" id="tf-mode" value="create" />'
    + '<input type="hidden" id="tf-edit-id" value="" />'

    // ── Actions ──
    + '<div class="ticket-form-actions">'
    + '<button class="next-up-btn next-up-btn-secondary" onclick="closeTicketForm()">CANCEL</button>'
    + '<button class="next-up-btn next-up-btn-secondary" id="tf-btn-save" onclick="tfSave()">SAVE TICKET</button>'
    + '<button class="next-up-btn next-up-btn-primary" id="tf-btn-save-refresh" onclick="tfSaveAndRefresh()">SAVE &amp; REFRESH</button>'
    + '</div>'
    + '</div></div>'

    // ── Embed all known IDs as JSON for client JS validation ──
    + '<script>var TF_KNOWN_IDS=' + JSON.stringify(allKnownIds.map(function (k) { return k.id; })) + ';</script>'
    + '<script>var TF_CUSTOM_ITEMS=' + JSON.stringify(customItems) + ';</script>'
    + '<script>var RECS_DATA=' + JSON.stringify({
        recommendations: recommendations.map(function(r) {
          var tc = computeTestingCompleteness(r);
          return {
            id: r.id, rank: r.rank, title: r.title, phase: r.phase,
            type: r.type, column: r.column, isSlice: !!r.isSlice,
            isCustom: !!r.isCustom, parentId: r.parentId || null,
            parentTitle: r.parentTitle || null, reasons: r.reasons || [],
            unlocks: r.unlocks || 0, scopeFileCount: r.scopeFileCount || 0,
            movement: r.movement, movementLabel: r.movementLabel || "\u2014",
            hasCompleteTests: tc.score === tc.max,
            files: (r.files || []).slice(0, 5),
            blockedBy: r.blockedBy || [],
          };
        }),
        generated_at: now,
        total_in_queue: recsResult.total,
        next_id: recsResult.next ? recsResult.next.id : null,
      }) + ';</script>';

  // ─── Validate Wizard HTML ───
  const validateWizardHtml = '<div class="vw-overlay" id="validate-wizard-overlay">'
    + '<div class="vw-panel">'
    + '<div class="vw-header">'
    + '<div class="vw-title">\u2713 Validate Ticket: <span id="vw-ticket-id"></span></div>'
    + '<div class="vw-steps">'
    + '<span class="vw-step active" id="vw-step-ind-1">1. Test Protocol</span>'
    + '<span class="vw-step" id="vw-step-ind-2">2. Checklist</span>'
    + '<span class="vw-step" id="vw-step-ind-3">3. Context Refresh</span>'
    + '</div></div>'

    // Step 1: Test Protocol
    + '<div class="vw-step-body active" id="vw-body-1">'
    + '<div class="vw-step-title">Confirm Test Protocol</div>'
    + '<div class="vw-step-desc">Run each step below and check it off. All steps must be confirmed to proceed.</div>'
    + '<div id="vw-protocol-items"></div>'
    + '</div>'

    // Step 2: Validation Checklist
    + '<div class="vw-step-body" id="vw-body-2">'
    + '<div class="vw-step-title">Confirm Validation Checklist</div>'
    + '<div class="vw-step-desc">Verify each completion gate is met:</div>'
    + '<div id="vw-checklist-items"></div>'
    + '</div>'

    // Step 3: Context Refresh
    + '<div class="vw-step-body" id="vw-body-3">'
    + '<div class="vw-step-title">Context Refresh</div>'
    + '<div class="vw-step-desc">Refresh project context files so they stay aligned with the changes you just validated.</div>'
    + '<div class="vw-sub-title">Auto-refresh (via server)</div>'
    + '<div id="vw-refresh-auto-items"></div>'
    + '<button class="vw-refresh-btn" id="vw-refresh-btn" onclick="vwRunRefresh()">\u25b6 RUN CONTEXT REFRESH</button>'
    + '<div id="vw-refresh-results"></div>'
    + '<div class="vw-sub-title">Post-validation update targets</div>'
    + '<div class="vw-step-desc">Review each target derived from the ticket files and type. Check off items addressed \u2014 not every target needs action for every ticket.</div>'
    + '<div id="vw-refresh-manual-items"></div>'
    + '</div>'

    // Navigation
    + '<div class="vw-nav">'
    + '<button class="vw-btn vw-btn-secondary" id="vw-btn-back" onclick="vwPrevStep()" style="display:none">\u2190 BACK</button>'
    + '<button class="vw-btn vw-btn-secondary" onclick="closeValidateWizard()">CANCEL</button>'
    + '<button class="vw-btn vw-btn-primary" id="vw-btn-next" onclick="vwNextStep()">NEXT \u2192</button>'
    + '<button class="vw-btn vw-btn-validate" id="vw-btn-complete" onclick="vwComplete()" style="display:none">\u2713 MARK VALIDATED</button>'
    + '</div>'
    + '<div class="vw-errors" id="vw-errors"></div>'
    + '<div class="vw-success" id="vw-success"></div>'
    + '</div></div>';

  // ─── Full HTML ───
  const htmlString = `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>${esc(project.name || "Maintenance Agent")} \u2014 Roadmap</title>
<style>${CSS}</style>
</head>
<body>
<div class="page">

<div class="header">
  <div>
    <div class="live-badge"><span class="live-dot"></span> AUTO-GENERATED \u2014 ${now}</div>
    <div class="doc-label">Product Roadmap \u00B7 ROADMAP.json + codebase signals</div>
    <div class="doc-title">${esc(project.name || "Maintenance Agent")} \u2192 Property Platform</div>
    <div class="doc-subtitle">${esc(project.subtitle || "")}</div>
  </div>
  <div class="header-meta">
    <div>Branch <span class="meta-val">${esc(git.branch)}</span></div>
    <div>Commit <span class="meta-val">${esc(git.commit)}</span></div>
    <div>Models <span class="meta-val">${signals.models.length}</span> \u00B7 Enums <span class="meta-val">${signals.enums.length}</span></div>
    <div>Workflows <span class="meta-val">${signals.workflows.length}</span> \u00B7 Routes <span class="meta-val">${signals.routes.length}</span></div>
    <div>Migrations <span class="meta-val">${signals.migrationCount}</span></div>
  </div>
</div>

<div class="stat-grid">
  <div class="stat-cell"><span class="stat-num" style="color:var(--p0)">${stats.doneItems}</span><span class="stat-label">Done</span></div>
  <div class="stat-cell"><span class="stat-num" style="color:var(--p3)">${stats.inProgressItems}</span><span class="stat-label">In Progress</span></div>
  <div class="stat-cell"><span class="stat-num" style="color:#ff5a5a">${stats.blockedItems}</span><span class="stat-label">Blocked</span></div>
  <div class="stat-cell"><span class="stat-num" style="color:var(--accent-cyan)">${stats.readyItems}</span><span class="stat-label">Ready</span></div>
  <div class="stat-cell"><span class="stat-num" style="color:var(--text-dim)">${stats.plannedItems}</span><span class="stat-label">Not Started</span></div>
  <div class="stat-cell"><span class="stat-num" style="color:var(--text-bright)">${stats.totalItems}</span><span class="stat-label">Total Items</span></div>
  <div class="stat-cell"><span class="stat-num" style="color:var(--text-bright)">${stats.pct}%</span><span class="stat-label">Complete</span></div>
</div>
${stats.healthy
  ? '<div class="health-bar health-ok">\u2714 Planning health: all aggregations consistent \u00B7 ' + stats.totalItems + ' items across ' + stats.totalFeatures + ' features</div>'
  : '<div class="health-bar health-warn">\u26A0 Aggregation mismatch detected: ' + stats.mismatches.map(m => esc(m)).join(' \u00B7 ') + '</div>'
}

${nextUpHtml}

${recPanelHtml}

<div class="tab-nav">
  <button class="tab-btn active" onclick="switchTab('phases',this)">Phases</button>
  <button class="tab-btn" onclick="switchTab('backlog',this)">Backlog</button>
  <button class="tab-btn" onclick="switchTab('slices',this)">Next Slices</button>
  <button class="tab-btn" onclick="switchTab('prompts',this)">Copilot Prompts</button>
  <button class="tab-btn" onclick="switchTab('custom',this)">Custom Items</button>
  <button class="tab-btn" onclick="switchTab('intake',this)">Intake</button>
  <button class="tab-btn" onclick="switchTab('signals',this)">Codebase Signals</button>
  <button class="tab-btn" onclick="switchTab('howto',this)">How to Use</button>
</div>

<div class="tab-pane active" id="tab-phases">
  <div class="filter-bar">
    <span style="font-family:'IBM Plex Mono',monospace;font-size:12px;color:var(--text-dim)">Filter:</span>
    <button class="filter-btn active" onclick="filterPhases('all',this)">ALL</button>
    <button class="filter-btn" onclick="filterPhases('in_progress',this)">IN PROGRESS</button>
    <button class="filter-btn" onclick="filterPhases('planned',this)">PLANNED</button>
    <button class="filter-btn" onclick="filterPhases('done',this)" style="color:var(--p0)">DONE</button>
  </div>
  ${phasesHtml}
</div>

<div class="tab-pane" id="tab-backlog">
  ${backlogTabHtml}
</div>

<div class="tab-pane" id="tab-slices">
  ${slicesTabHtml}
</div>

<div class="tab-pane" id="tab-prompts">
  ${promptsTabHtml}
</div>

<div class="tab-pane" id="tab-custom">
  <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:12px">
    <div class="note-box" style="margin:0;flex:1">Custom tickets are stored in ROADMAP.json custom_items[] \u00B7 Types: user_story \u00B7 task \u00B7 bug \u00B7 spike</div>
    <button class="next-up-btn next-up-btn-primary" style="margin-left:12px;white-space:nowrap" onclick="openTicketForm()">\u2795 NEW TICKET</button>
  </div>
  ${customTabHtml}
</div>

<div class="tab-pane" id="tab-intake">
  ${intakeTabHtml}
</div>

<div class="tab-pane" id="tab-signals">
  <div class="panel">
    <div class="panel-head"><div class="panel-head-dot" style="background:var(--accent-blue)"></div><div class="panel-head-title">Detection Results \u2014 ${computed.length} features tracked</div></div>
    <div class="panel-body">
      <table class="signal-table">
        <thead><tr><th>ID</th><th>Status</th><th>Signal</th><th>Detection Type</th></tr></thead>
        <tbody>${signalRows}</tbody>
      </table>
    </div>
  </div>
  <div class="three-col">
    <div class="panel">
      <div class="panel-head"><div class="panel-head-dot" style="background:var(--p0)"></div><div class="panel-head-title">Models (${signals.models.length})</div></div>
      <div class="panel-body" style="font-family:'IBM Plex Mono',monospace;font-size:12px;color:var(--text-dim);line-height:1.8">${modelsListHtml}</div>
    </div>
    <div class="panel">
      <div class="panel-head"><div class="panel-head-dot" style="background:var(--p1)"></div><div class="panel-head-title">Workflows (${signals.workflows.length})</div></div>
      <div class="panel-body" style="font-family:'IBM Plex Mono',monospace;font-size:12px;color:var(--text-dim);line-height:1.8">${workflowsListHtml}</div>
    </div>
    <div class="panel">
      <div class="panel-head"><div class="panel-head-dot" style="background:var(--p2)"></div><div class="panel-head-title">Routes (${signals.routes.length})</div></div>
      <div class="panel-body" style="font-family:'IBM Plex Mono',monospace;font-size:12px;color:var(--text-dim);line-height:1.8">${routesListHtml}</div>
    </div>
  </div>
</div>

<div class="tab-pane" id="tab-howto">
  <div class="panel"><div class="panel-body" style="font-family:'IBM Plex Mono',monospace;font-size:13px;line-height:2.2;color:var(--text)">
    <span style="color:var(--p0)">\u25A0</span> <strong>Auto-detection</strong> \u2014 features update automatically when you ship code.<br>
    &nbsp;&nbsp;Script reads schema.prisma \u00B7 workflows/ \u00B7 services/ \u00B7 .env files.<br>
    &nbsp;&nbsp;When a signal is found in your codebase, the card auto-marks DONE.<br><br>
    <span style="color:var(--accent-cyan)">\u25A0</span> <strong>Ticket Management (UI)</strong> \u2014 create, edit, duplicate, and delete tickets directly from the roadmap page.<br>
    &nbsp;&nbsp;<strong>1. Start the server:</strong> <span style="color:var(--accent-cyan)">npm run roadmap:serve</span> (starts on port 8111)<br>
    &nbsp;&nbsp;<strong>2. Open in browser:</strong> <span style="color:var(--accent-cyan)">http://localhost:8111</span><br>
    &nbsp;&nbsp;<strong>3. Create:</strong> Click <strong>+ NEW TICKET</strong> in the Backlog tab or Custom Items tab. Fill in the form, then click SAVE &amp; REFRESH.<br>
    &nbsp;&nbsp;<strong>4. Edit:</strong> Click <strong>\u270E EDIT</strong> on any custom item card to open the form pre-filled with that ticket\u2019s data.<br>
    &nbsp;&nbsp;<strong>5. Duplicate:</strong> Click <strong>\u2398 DUP</strong> to clone a ticket (status resets to planned, title gets \u201C(copy)\u201D suffix).<br>
    &nbsp;&nbsp;<strong>6. Delete:</strong> Click <strong>\u2716</strong> to remove a ticket (with confirmation prompt).<br>
    &nbsp;&nbsp;Every save writes to ROADMAP.json \u2192 regenerates roadmap.html \u2192 reloads the page.<br><br>
    <span style="color:var(--p1)">\u25A0</span> <strong>Ticket Management (CLI)</strong> \u2014 alternative via terminal:<br>
    &nbsp;&nbsp;<span style="color:var(--accent-cyan)">node scripts/roadmap-ticket.js create</span> \u2014 guided interactive creation<br>
    &nbsp;&nbsp;<span style="color:var(--accent-cyan)">node scripts/roadmap-ticket.js edit &lt;ID&gt;</span> \u2014 edit a ticket by ID<br>
    &nbsp;&nbsp;<span style="color:var(--accent-cyan)">node scripts/roadmap-ticket.js start|complete|block &lt;ID&gt;</span> \u2014 change ticket status<br>
    &nbsp;&nbsp;<span style="color:var(--accent-cyan)">node scripts/roadmap-ticket.js validate &lt;ID&gt;</span> \u2014 guided validation wizard + mark done<br>
    &nbsp;&nbsp;<span style="color:var(--accent-cyan)">node scripts/roadmap-ticket.js list</span> \u2014 list all custom items<br>
    &nbsp;&nbsp;<span style="color:var(--accent-cyan)">node scripts/roadmap-ticket.js next</span> \u2014 show next recommended item<br><br>
    <span style="color:var(--p1)">\u25A0</span> <strong>Adding tickets via JSON</strong> \u2014 edit ROADMAP.json \u2192 custom_items[]:<br>
    <div class="howto-code">  {<br>
&nbsp;&nbsp;"id": "US-001",&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;<span style="color:var(--text-dim)">// auto-generated, or US-XXX | TASK-XXX | BUG-XXX | SPK-XXX</span><br>
&nbsp;&nbsp;"phase": "P1",&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;<span style="color:var(--text-dim)">// P0 | P1 | P2 | P3 | P4 | P5</span><br>
&nbsp;&nbsp;"title": "As a landlord, I want ...",<br>
&nbsp;&nbsp;"type": "user_story",&nbsp;<span style="color:var(--text-dim)">// user_story | task | bug | spike</span><br>
&nbsp;&nbsp;"order": 1,&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;<span style="color:var(--text-dim)">// chronological sequence within phase</span><br>
&nbsp;&nbsp;"depends_on": ["F-P0-001"],&nbsp;&nbsp;&nbsp;<span style="color:var(--text-dim)">// references to dependencies</span><br>
&nbsp;&nbsp;"parent_feature": "F-P1-001",<span style="color:var(--text-dim)">// attach to a feature</span><br>
&nbsp;&nbsp;"acceptance_criteria": ["..."],<br>
&nbsp;&nbsp;"required_tests": ["..."],<br>
&nbsp;&nbsp;"test_protocol": "1. npx tsc --noEmit\\n2. npm test",<br>
&nbsp;&nbsp;"validation_checklist": ["..."],<br>
&nbsp;&nbsp;"post_validation": ["..."],<br>
&nbsp;&nbsp;"persona": "owner",&nbsp;&nbsp;&nbsp;<span style="color:var(--text-dim)">// owner | tenant | manager | contractor</span><br>
&nbsp;&nbsp;"ticket": "GH-142",&nbsp;&nbsp;<span style="color:var(--text-dim)">// GitHub / Linear / Jira ref, or null</span><br>
&nbsp;&nbsp;"status": "planned",&nbsp;&nbsp;<span style="color:var(--text-dim)">// planned | in_progress | done | blocked</span><br>
&nbsp;&nbsp;"notes": "additional context"<br>
  }</div>
    <span style="color:var(--p2)">\u25A0</span> <strong>Regenerating</strong><br>
    &nbsp;&nbsp;<span style="color:var(--accent-cyan)">node scripts/generate-roadmap.js</span> \u2014 generate once<br>
    &nbsp;&nbsp;<span style="color:var(--accent-cyan)">npm run roadmap:watch</span> \u2014 watch mode (auto-regenerates on schema or ROADMAP.json change)<br>
    &nbsp;&nbsp;<span style="color:var(--accent-cyan)">npm run roadmap:serve</span> \u2014 serve with live API on port 8111 (auto-regenerates on ticket save)<br>
    &nbsp;&nbsp;Open <span style="color:var(--accent-cyan)">http://localhost:8111</span> or use VS Code Live Server on <span style="color:var(--accent-cyan)">docs/roadmap.html</span><br><br>
    <span style="color:var(--p3)">\u25A0</span> <strong>Wiring a new feature for auto-detection</strong> \u2014 add a detection block to features[] in ROADMAP.json:<br>
    &nbsp;&nbsp;model_exists \u00B7 model_field \u00B7 enum_exists \u00B7 workflow_exists \u00B7 file_exists \u00B7 page_exists \u00B7 env_key<br><br>
    <span style="color:var(--p4)">\u25A0</span> <strong>Required fields for new tickets</strong><br>
    &nbsp;&nbsp;title \u00B7 phase \u00B7 order \u00B7 type \u00B7 acceptance_criteria (1+) \u00B7 required_tests (1+) \u00B7 test_protocol \u00B7 validation_checklist (1+) \u00B7 post_validation (1+)<br>
    &nbsp;&nbsp;Dependency refs must point to existing feature/slice/custom IDs. Parent feature must exist in ROADMAP.json.<br><br>
    <span style="color:var(--p4)">\u25A0</span> <strong>Testing metadata gates</strong><br>
    &nbsp;&nbsp;\u2022 A ticket <em>cannot be saved</em> without required_tests, test_protocol, and validation_checklist.<br>
    &nbsp;&nbsp;\u2022 A ticket <em>cannot be marked in_progress</em> without a test_protocol and required_tests.<br>
    &nbsp;&nbsp;\u2022 A ticket <em>cannot be marked done/validated</em> unless validation_checklist exists.<br><br>
    <span style="color:var(--p0)">\u25A0</span> <strong>Validation Workflow</strong> \u2014 the preferred way to mark a ticket done:<br>
    &nbsp;&nbsp;<strong>1.</strong> Click <strong>\u2713 VALIDATE</strong> on any ticket card with complete testing metadata.<br>
    &nbsp;&nbsp;<strong>2. Step 1:</strong> Confirm each test protocol step was executed (check all boxes).<br>
    &nbsp;&nbsp;<strong>3. Step 2:</strong> Confirm each validation checklist item is met (check all boxes).<br>
    &nbsp;&nbsp;<strong>4. Step 3:</strong> Run context refresh (auto-refreshes blueprint + roadmap via server API).<br>
    &nbsp;&nbsp;&nbsp;&nbsp;\u2022 Review manual targets: PROJECT_STATE.md \u00B7 ARCHITECTURE_LOW_CONTEXT_GUIDE.md \u00B7 docs/AUDIT.md \u00B7 SCHEMA_REFERENCE.md<br>
    &nbsp;&nbsp;<strong>5.</strong> Click <strong>\u2713 MARK VALIDATED</strong> \u2192 ticket status \u2192 done + validated_at timestamp recorded.<br>
    &nbsp;&nbsp;CLI equivalent: <span style="color:var(--accent-cyan)">node scripts/roadmap-ticket.js validate &lt;ID&gt;</span><br>
    &nbsp;&nbsp;API equivalent: <span style="color:var(--accent-cyan)">POST /api/tickets/:id/validate</span> with <code>{ protocol_confirmed: true, checklist_confirmed: true }</code><br><br>
    <span style="color:var(--p0)">\u25A0</span> <strong>Context Refresh API</strong><br>
    &nbsp;&nbsp;<span style="color:var(--accent-cyan)">POST /api/context-refresh</span> \u2014 runs blueprint + roadmap generation, returns auto + manual targets.<br><br>
    <span style="color:var(--accent-cyan)">\u25A0</span> <strong>Refresh Top 5</strong> \u2014 live-refresh the "Next Recommended \u2014 Top 5" panel:<br>
    &nbsp;&nbsp;\u2022 Click <strong>\u21BB REFRESH TOP 5</strong> in the rec panel header (requires roadmap server running).<br>
    &nbsp;&nbsp;\u2022 The server re-reads ROADMAP.json, re-scans the codebase, and runs the full 9-rule ranking engine.<br>
    &nbsp;&nbsp;\u2022 Updated recommendations replace the current cards without a page reload (tabs/filters preserved).<br>
    &nbsp;&nbsp;\u2022 Each card shows: movement badge (\u2191/\u2193/NEW/\u2014), rank, reasons, and phase.<br>
    &nbsp;&nbsp;\u2022 A timestamp shows when the recommendations were last refreshed.<br>
    &nbsp;&nbsp;\u2022 API: <span style="color:var(--accent-cyan)">POST /api/recommendations</span> \u2014 returns JSON with ranked items + movement data.<br>
    &nbsp;&nbsp;\u2022 File: <span style="color:var(--accent-cyan)">docs/roadmap-recs.json</span> \u2014 written on every generation with full recommendation data.<br>
    &nbsp;&nbsp;\u2022 Prioritisation: phase order \u2192 unblockers \u2192 small scope \u2192 testing metadata complete.
  </div></div>
</div>

<div class="footer">
  <div>${esc(project.name || "Maintenance Agent")} \u00B7 ${now} \u00B7 ${esc(git.branch)}@${esc(git.commit)} \u00B7 scripts/generate-roadmap.js</div>
  <div style="display:flex;gap:14px"><span style="color:var(--p0)">\u25CF Done</span><span style="color:var(--p3)">\u25CF In Progress</span><span style="color:var(--text-dim)">\u25CF Planned</span><span style="color:#ff5a5a">\u25CF Blocked</span></div>
</div>

${ticketFormHtml}

${validateWizardHtml}

</div>
<script>
/* ── Core UI helpers ────────────────────────────────────────── */
function switchTab(id,btn){document.querySelectorAll('.tab-btn').forEach(b=>b.classList.remove('active'));document.querySelectorAll('.tab-pane').forEach(p=>p.classList.remove('active'));document.getElementById('tab-'+id).classList.add('active');btn.classList.add('active')}
function filterPhases(filter,btn){document.querySelectorAll('.filter-btn').forEach(b=>b.classList.remove('active'));btn.classList.add('active');document.querySelectorAll('.phase-block').forEach(block=>{if(filter==='all'){block.style.display='';return}const s=block.dataset.status;const hasFeatureMatch=[...block.querySelectorAll('.feature-card')].some(c=>c.dataset.status===filter);block.style.display=(s===filter||hasFeatureMatch)?'':'none'})}
function copyPrompt(btn,i){const el=document.getElementById('prompt-'+i);navigator.clipboard.writeText(el.textContent).then(()=>{btn.textContent='COPIED \u2714';btn.classList.add('copied');setTimeout(()=>{btn.textContent='COPY';btn.classList.remove('copied')},2000)})}
function toggleSlices(fid){const el=document.getElementById('slices_'+fid);if(!el)return;const btn=el.previousElementSibling.querySelector('.slice-toggle');if(el.style.display==='none'){el.style.display='';btn.textContent='hide slices'}else{el.style.display='none';btn.textContent='show slices'}}
function blFilter(btn){var g=btn.parentElement;g.querySelectorAll('.filter-btn').forEach(function(b){b.classList.remove('active')});btn.classList.add('active');var pb=document.querySelector('#bl-phase-group .filter-btn.active');var tb=document.querySelector('#bl-type-group .filter-btn.active');var ph=pb?pb.getAttribute('data-val'):'all';var tp=tb?tb.getAttribute('data-val'):'all';document.querySelectorAll('#bl-board .kanban-card').forEach(function(c){var sp=ph==='all'||c.getAttribute('data-bl-phase')===ph;var st=tp==='all'||c.getAttribute('data-bl-type')===tp;c.style.display=(sp&&st)?'':'none'})}
function toggleTP(id){var el=document.getElementById('tp-'+id);if(!el)return;var btn=el.previousElementSibling;if(el.style.display==='none'){el.style.display='block';btn.textContent='\u25BC HIDE PROMPT'}else{el.style.display='none';btn.textContent='\u25B6 SHOW PROMPT'}}
function copyTP(btn,id){var el=document.querySelector('#tp-'+id+' .tp-body');if(!el)return;navigator.clipboard.writeText(el.textContent).then(function(){btn.textContent='COPIED \u2714';btn.classList.add('copied');setTimeout(function(){btn.textContent='COPY';btn.classList.remove('copied')},2000)})}

/* ── Working-State Session Controls ─────────────────────────── */
var WS_KEY='roadmap_ws';
function wsLoad(){try{return JSON.parse(localStorage.getItem(WS_KEY))||{}}catch(e){return{}}}
function wsSave(m){localStorage.setItem(WS_KEY,JSON.stringify(m))}
function wsApplyCard(card){var id=card.getAttribute('data-bl-id');if(!id)return;var m=wsLoad();var st=m[id]||null;card.classList.remove('ws-drafting','ws-implementing');card.querySelectorAll('.ws-btn').forEach(function(b){b.classList.remove('ws-active')});if(st){card.classList.add('ws-'+st);var btn=card.querySelector('.ws-btn[data-ws="'+st+'"]');if(btn)btn.classList.add('ws-active')}}
function wsToggle(btn){var card=btn.closest('.kanban-card');var id=card.getAttribute('data-bl-id');if(!id)return;var ws=btn.getAttribute('data-ws');var m=wsLoad();if(m[id]===ws){delete m[id]}else{m[id]=ws}wsSave(m);wsApplyCard(card);wsUpdateCount()}
function wsUpdateCount(){var m=wsLoad();var n=Object.keys(m).length;var el=document.getElementById('ws-count');if(el)el.textContent=n>0?n+' active':''}
function wsFilterActive(){var btn=document.getElementById('ws-filter-btn');var on=btn.classList.toggle('ws-filter-on');var m=wsLoad();document.querySelectorAll('#bl-board .kanban-card').forEach(function(c){if(!on){c.style.display='';return}var id=c.getAttribute('data-bl-id');c.style.display=m[id]?'':'none'})}
function wsClearAll(){if(!confirm('Clear all local working states?'))return;localStorage.removeItem(WS_KEY);document.querySelectorAll('#bl-board .kanban-card').forEach(function(c){c.classList.remove('ws-drafting','ws-implementing');c.querySelectorAll('.ws-btn').forEach(function(b){b.classList.remove('ws-active')});c.style.display=''});var fb=document.getElementById('ws-filter-btn');if(fb)fb.classList.remove('ws-filter-on');wsUpdateCount()}
(function wsInit(){document.querySelectorAll('#bl-board .kanban-card').forEach(wsApplyCard);wsUpdateCount()})()

/* ── Tab Persistence (survive reload) ───────────────────────── */
var TAB_KEY = 'roadmap_active_tab';
function reloadKeepTab() {
  var activeBtn = document.querySelector('.tab-btn.active');
  if (activeBtn) {
    var onclick = activeBtn.getAttribute('onclick') || '';
    var m = onclick.match(/switchTab\\('([^']+)'/);
    if (m) sessionStorage.setItem(TAB_KEY, m[1]);
  }
  location.reload();
}
(function restoreTab() {
  var saved = sessionStorage.getItem(TAB_KEY);
  if (!saved) return;
  sessionStorage.removeItem(TAB_KEY);
  var pane = document.getElementById('tab-' + saved);
  if (!pane) return;
  var btn = document.querySelector('.tab-btn[onclick*="switchTab(\\'' + saved + '\\'"]');
  if (btn) switchTab(saved, btn);
})();

/* ── Toast Notification ──────────────────────────────────────── */
(function initToast() {
  if (document.getElementById('rm-toast')) return;
  var d = document.createElement('div');
  d.id = 'rm-toast';
  d.style.cssText = 'position:fixed;bottom:28px;right:28px;z-index:99999;display:flex;flex-direction:column;gap:8px;pointer-events:none';
  document.body.appendChild(d);
})();
function showToast(msg, type) {
  type = type || 'success';
  var colors = { success:'#00d4c8', error:'#ff5252', info:'var(--accent-blue)', warn:'#f5a623' };
  var icons = { success:'\\u2713', error:'\\u2716', info:'\\u24D8', warn:'\\u26A0' };
  var t = document.createElement('div');
  t.style.cssText = 'pointer-events:auto;padding:10px 18px;border-radius:8px;font-size:13px;font-family:Inter,system-ui,sans-serif;color:#fff;background:rgba(30,32,44,.95);border:1px solid ' + (colors[type]||colors.info) + ';box-shadow:0 4px 24px rgba(0,0,0,.4);opacity:0;transform:translateY(12px);transition:opacity .3s,transform .3s;max-width:420px;word-break:break-word';
  t.innerHTML = '<span style="color:' + (colors[type]||colors.info) + ';margin-right:6px">' + (icons[type]||'') + '</span>' + msg.replace(/\\n/g,'<br>');
  var container = document.getElementById('rm-toast');
  container.appendChild(t);
  requestAnimationFrame(function(){ t.style.opacity='1'; t.style.transform='translateY(0)'; });
  setTimeout(function(){
    t.style.opacity='0'; t.style.transform='translateY(12px)';
    setTimeout(function(){ t.remove(); }, 350);
  }, 3500);
}

/* ── NEXT UP prompt copy ────────────────────────────────────── */
function copyNextUpPrompt(){var el=document.getElementById('nextup-prompt-body');if(!el)return;navigator.clipboard.writeText(el.textContent).then(function(){var btn=document.querySelector('.next-up-actions .next-up-btn-secondary');if(btn){btn.textContent='COPIED \u2714';setTimeout(function(){btn.textContent='COPY PROMPT'},2000)}})}

/* ═══════════════════════════════════════════════════════════════
   Refresh Top 5 — live recommendations refresh via API
   Calls POST /api/recommendations, updates the rec panel DOM
   without a full page reload so tabs/filters are preserved.
   ═══════════════════════════════════════════════════════════════ */

function escH(s){return String(s||'').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;')}

function buildRecCardHtml(r, ri) {
  var isBlocked = r.column === 'blocked';
  var stateClass = isBlocked ? 'blocked' : 'unblocked';
  var stateBadge = isBlocked
    ? '<span class="blocked-badge">BLOCKED</span>'
    : '<span class="ready-badge">READY</span>';
  var parentHtml = r.isSlice && r.parentTitle
    ? '<div class="rec-parent">\\u21b3 ' + escH(r.parentId) + ': ' + escH(r.parentTitle) + '</div>'
    : '';
  var reasonText = (r.reasons || []).join(' \\u00b7 ');
  var filesHtml = (r.files || []).slice(0, 3).map(function(f) {
    var bn = f.split('/').pop();
    return '<span class="rec-file" title="' + escH(f) + '">' + escH(bn) + '</span>';
  }).join('');
  var blockedHtml = '';
  if (isBlocked && r.blockedBy && r.blockedBy.length > 0) {
    blockedHtml = '<div class="rec-blocked">\\u26d4 Blocked by: '
      + r.blockedBy.map(function(b){ return '<strong>' + escH(b.id) + '</strong> ' + escH(b.title); }).join(' \\u00b7 ')
      + '</div>';
  }
  var phaseColors = { P0: '--p0', P1: '--p1', P2: '--p2', P3: '--p3', P4: '--p4' };
  var cVar = phaseColors[r.phase] || '--text-dim';
  var tClass = 'type-' + (r.type === 'user_story' ? 'story' : r.type);

  var ml = r.movementLabel || '\\u2014';
  var mc = ml === 'NEW' ? 'rec-move-new'
    : (r.movement > 0) ? 'rec-move-up'
    : (r.movement < 0) ? 'rec-move-down'
    : 'rec-move-same';
  var moveBadge = '<span class="rec-movement ' + mc + '">' + escH(ml) + '</span>';

  return '<div class="rec-item ' + stateClass + '" data-rec-id="' + escH(r.id) + '">'
    + '<div class="rec-rank">' + (r.rank || ri + 1) + '</div>'
    + '<div class="rec-body">'
    + '<div class="rec-meta">'
    + moveBadge
    + stateBadge
    + '<div class="phase-badge" style="color:var(' + cVar + ');border-color:var(' + cVar + ')40;background:var(' + cVar + ')10;font-size:10px;padding:1px 5px">' + escH(r.phase) + '</div>'
    + '<div class="feature-type ' + tClass + '" style="font-size:10px">' + escH((r.type || 'task').toUpperCase()) + '</div>'
    + (r.isSlice ? '<span style="font-family:\\'IBM Plex Mono\\',monospace;font-size:10px;padding:1px 4px;border-radius:2px;background:rgba(61,126,255,.08);border:1px solid rgba(61,126,255,.2);color:#7aaeff">slice</span>' : '')
    + (r.isCustom ? '<span style="font-family:\\'IBM Plex Mono\\',monospace;font-size:10px;padding:1px 4px;border-radius:2px;background:rgba(46,204,220,.08);border:1px solid rgba(46,204,220,.2);color:var(--accent-cyan)">ticket</span>' : '')
    + (r.hasCompleteTests ? '<span class="test-badge test-badge-ok">\\u2714 TESTS 3/3</span>' : '')
    + (r.unlocks > 0 ? '<span style="font-family:\\'IBM Plex Mono\\',monospace;font-size:10px;padding:1px 4px;border-radius:2px;background:rgba(46,204,138,.08);border:1px solid rgba(46,204,138,.2);color:#5ed9a0">unlocks ' + r.unlocks + '</span>' : '')
    + '<span style="font-family:\\'IBM Plex Mono\\',monospace;font-size:10px;color:var(--text-dim);margin-left:auto">' + escH(r.id) + '</span>'
    + '</div>'
    + '<div class="rec-title">' + escH(r.title) + '</div>'
    + parentHtml
    + '<div class="rec-reason">\\u2192 ' + escH(reasonText) + '</div>'
    + (filesHtml ? '<div class="rec-files">' + filesHtml + '</div>' : '')
    + blockedHtml
    + '<div style="font-family:\\'IBM Plex Mono\\',monospace;font-size:11px;color:var(--text-dim);margin-top:6px;padding-top:6px;border-top:1px solid var(--border1)">Reload page for full prompts</div>'
    + '</div></div>';
}

function refreshTop5() {
  var btn = document.getElementById('rec-refresh-btn');
  if (!btn) return;
  btn.classList.add('loading');
  btn.textContent = '\\u23f3 REFRESHING...';

  fetch(TF_API + '/api/recommendations', { method: 'POST' })
    .then(function(r) { return r.json(); })
    .then(function(d) {
      btn.classList.remove('loading');
      btn.textContent = '\\u21bb REFRESH TOP 5';

      if (!d.ok || !d.data || !d.data.recommendations) {
        alert('Refresh failed: ' + ((d.errors || []).join(', ') || 'unknown error'));
        return;
      }

      var recs = d.data.recommendations;
      var ts = d.data.generated_at || new Date().toISOString();
      var total = d.data.total_in_queue || '?';

      // Update timestamp
      var tsEl = document.getElementById('rec-timestamp');
      if (tsEl) tsEl.textContent = 'Refreshed: ' + ts + ' \\u00b7 ' + total + ' items in queue';

      // Update rec panel title count
      var titleEl = document.querySelector('.rec-panel-head-title');
      if (titleEl) titleEl.textContent = 'Next Recommended \\u2014 Top ' + recs.length;

      // Rebuild cards
      var grid = document.getElementById('rec-grid');
      if (!grid) return;

      var html = '';
      for (var i = 0; i < recs.length; i++) {
        html += buildRecCardHtml(recs[i], i);
      }
      grid.innerHTML = html;

      // Flash the panel to indicate refresh
      var panel = document.getElementById('rec-panel');
      if (panel) {
        panel.style.boxShadow = '0 0 12px rgba(46,204,220,.3)';
        setTimeout(function() { panel.style.boxShadow = ''; }, 1200);
      }

      // Update embedded data for any subsequent client-side use
      if (typeof RECS_DATA !== 'undefined') {
        RECS_DATA.recommendations = recs;
        RECS_DATA.generated_at = ts;
        RECS_DATA.total_in_queue = total;
      }
    })
    .catch(function(e) {
      btn.classList.remove('loading');
      btn.textContent = '\\u21bb REFRESH TOP 5';
      alert('Server not running? Start with: node scripts/roadmap-server.js\\n\\nError: ' + e.message);
    });
}

/* ═══════════════════════════════════════════════════════════════
   Ticket Form — Create / Edit / Duplicate / Delete
   Writes to ROADMAP.json via roadmap-server.js API (port 8111),
   then reloads with regenerated HTML.

   Fallback: if the server is not running, generates a CLI command
   the user can paste into a terminal.
   ═══════════════════════════════════════════════════════════════ */

var TF_API = (function(){
  /* Auto-detect server: same origin if served by roadmap-server, else localhost:8111 */
  var loc = window.location;
  if (loc.protocol === 'http:' || loc.protocol === 'https:') {
    return loc.origin;
  }
  return 'http://localhost:8111';
})();

/* ── List helpers for multi-value fields ──────────────────── */
function tfListAdd(inputId, containerId) {
  var inp = document.getElementById(inputId);
  var val = inp.value.trim();
  if (!val) return;
  var container = document.getElementById(containerId);
  var div = document.createElement('div');
  div.className = 'tf-list-item';
  div.innerHTML = '<span>' + val.replace(/</g,'&lt;') + '</span><span class="tf-list-rm" onclick="this.parentElement.remove()">\u2716</span>';
  container.appendChild(div);
  inp.value = '';
  inp.focus();
}
function tfListGet(containerId) {
  var items = document.getElementById(containerId).querySelectorAll('.tf-list-item span:first-child');
  return Array.from(items).map(function(s){ return s.textContent; }).filter(Boolean);
}
function tfListSet(containerId, arr) {
  var container = document.getElementById(containerId);
  container.innerHTML = '';
  (arr || []).forEach(function(val) {
    var div = document.createElement('div');
    div.className = 'tf-list-item';
    div.innerHTML = '<span>' + val.replace(/</g,'&lt;') + '</span><span class="tf-list-rm" onclick="this.parentElement.remove()">\u2716</span>';
    container.appendChild(div);
  });
}

/* Shortcut add-buttons wired to the inline + ADD buttons */
function tfAddDep(){ tfListAdd('tf-dep-input','tf-deps'); }
function tfAddFile(){ tfListAdd('tf-file-input','tf-files'); }
function tfAddAC(){ tfListAdd('tf-ac-input','tf-acs'); }
function tfAddTest(){ tfListAdd('tf-test-input','tf-tests'); }
function tfAddVal(){ tfListAdd('tf-val-input','tf-vals'); }
function tfAddPV(){ tfListAdd('tf-pv-input','tf-pvs'); }

/* ── Infer post-validation targets from files + type ───── */
function tfInferPV() {
  var files = tfListGet('tf-files');
  var ticketType = document.getElementById('tf-type').value || 'task';
  var desc = document.getElementById('tf-desc').value || '';
  var targets = inferPVTargets(files, ticketType, desc);
  if (targets.length === 0) {
    alert('No files_expected set \u2014 add files first, then infer.');
    return;
  }
  tfListSet('tf-pvs', targets);
}

/**
 * Client-side mirror of the server inferPostValidationTargets().
 * Derives post-validation update targets from files, type, description.
 */
function inferPVTargets(files, type, description) {
  var targets = [];
  var allFiles = (files || []).map(function(f){ return f.toLowerCase(); });
  var desc = (description || '').toLowerCase();
  var tt = (type || 'task').toLowerCase();

  var hasRoutes      = allFiles.some(function(f){ return f.indexOf('/routes/') >= 0 || f.indexOf('routes.') >= 0; });
  var hasServices    = allFiles.some(function(f){ return f.indexOf('/services/') >= 0 || f.indexOf('service.') >= 0; });
  var hasRepos       = allFiles.some(function(f){ return f.indexOf('/repositories/') >= 0 || f.indexOf('repository.') >= 0; });
  var hasWorkflows   = allFiles.some(function(f){ return f.indexOf('/workflows/') >= 0 || f.indexOf('workflow.') >= 0; });
  var hasSchema      = allFiles.some(function(f){ return f.indexOf('schema.prisma') >= 0 || f.indexOf('/prisma/') >= 0; });
  var hasMigrations  = allFiles.some(function(f){ return f.indexOf('/migrations/') >= 0; });
  var hasAuth        = allFiles.some(function(f){ return f.indexOf('authz') >= 0 || f.indexOf('auth.') >= 0 || f.indexOf('/auth/') >= 0; });
  var hasDTO         = allFiles.some(function(f){ return f.indexOf('/dto') >= 0 || f.indexOf('dto.') >= 0 || f.indexOf('api-client') >= 0 || f.indexOf('openapi') >= 0; });
  var hasBlueprint   = allFiles.some(function(f){ return f.indexOf('blueprint') >= 0; });
  var hasRoadmap     = allFiles.some(function(f){ return f.indexOf('roadmap') >= 0 || f.indexOf('generate-roadmap') >= 0 || f.indexOf('roadmap-server') >= 0 || f.indexOf('roadmap-ticket') >= 0; });
  var hasWebPages    = allFiles.some(function(f){ return f.indexOf('apps/web/') >= 0 || f.indexOf('/pages/') >= 0; });
  var hasTransitions = allFiles.some(function(f){ return f.indexOf('transitions') >= 0; });
  var hasEvents      = allFiles.some(function(f){ return f.indexOf('/events/') >= 0 || f.indexOf('event.') >= 0; });
  var hasTests       = allFiles.some(function(f){ return f.indexOf('.test.') >= 0 || f.indexOf('.spec.') >= 0 || f.indexOf('/__tests__/') >= 0; });
  var hasGovernance  = allFiles.some(function(f){ return f.indexOf('/governance/') >= 0; });
  var hasAuditArea   = desc.indexOf('audit') >= 0 || desc.indexOf('finding') >= 0 || desc.indexOf('security') >= 0 || desc.indexOf('vulnerability') >= 0;
  var isBackend      = hasRoutes || hasServices || hasRepos || hasWorkflows || hasSchema || hasAuth || hasTransitions;

  targets.push('Run validation wizard: click \\u2713 VALIDATE on ticket card');
  if (isBackend || hasDTO || hasBlueprint) targets.push('refresh docs/blueprint.html \\u2014 cd apps/api && node blueprint.js');
  targets.push('refresh docs/roadmap.html \\u2014 node scripts/generate-roadmap.js');
  if (isBackend || hasAuth || hasGovernance || hasTransitions || hasEvents || tt === 'spike') targets.push('refresh PROJECT_STATE.md \\u2014 update if architecture decisions changed');
  if (hasAuth || hasRoutes || hasWorkflows || hasServices || hasRepos || hasGovernance) targets.push('refresh apps/api/src/ARCHITECTURE_LOW_CONTEXT_GUIDE.md \\u2014 update if auth/layers touched');
  if (hasAuditArea || hasAuth || hasGovernance || tt === 'bug') targets.push('refresh docs/AUDIT.md \\u2014 mark resolved findings, add new ones');
  if (hasSchema || hasMigrations) targets.push('refresh SCHEMA_REFERENCE.md \\u2014 update if schema changed');
  if (hasDTO || hasRoutes || hasSchema) targets.push('verify DTO / OpenAPI / api-client sync');
  if (hasRoadmap) targets.push('review roadmap tooling docs \\u2014 update How to Use tab if behavior changed');
  if (hasWebPages) targets.push('manual UI verification \\u2014 check affected pages in browser');
  if (hasTests || isBackend) targets.push('run full test suite \\u2014 npx tsc --noEmit && npm test');
  targets.push('Commit checklist: npx tsc --noEmit \\u2192 npm test \\u2192 npm run blueprint');

  return targets;
}

/* Enter-key adds to list instead of submitting */
['tf-dep-input','tf-file-input','tf-ac-input','tf-test-input','tf-val-input','tf-pv-input'].forEach(function(id){
  var el = document.getElementById(id);
  if(el) el.addEventListener('keydown',function(e){
    if(e.key==='Enter'){e.preventDefault();el.nextElementSibling.click();}
  });
});

/* ── Form open / close / reset ───────────────────────────── */
function tfReset() {
  document.getElementById('tf-mode').value = 'create';
  document.getElementById('tf-edit-id').value = '';
  document.getElementById('tf-heading').textContent = '\u2795 Create Ticket';
  document.getElementById('tf-id').value = '';
  document.getElementById('tf-id').removeAttribute('readonly');
  document.getElementById('tf-phase').selectedIndex = 0;
  document.getElementById('tf-order').value = '1';
  document.getElementById('tf-title').value = '';
  document.getElementById('tf-type').value = 'task';
  document.getElementById('tf-status').value = 'planned';
  document.getElementById('tf-persona').value = '';
  document.getElementById('tf-ticket').value = '';
  document.getElementById('tf-parent').value = '';
  document.getElementById('tf-desc').value = '';
  document.getElementById('tf-notes').value = '';
  document.getElementById('tf-test-protocol').value = '1. npx tsc --noEmit \u2014 zero TypeScript errors\\n2. npm test \u2014 all tests pass\\n3. npm run blueprint \u2014 architecture docs sync\\n4. Ticket-specific verification: verify acceptance criteria manually\\n5. Regression checks: verify adjacent features still work\\n6. API contract sync: if API changed, verify DTOs/OpenAPI/api-client match\\n7. UI verification: if UI changed, manual check in browser\\n8. Edge cases: verify behavior with missing/null data';
  tfListSet('tf-deps', []);
  tfListSet('tf-files', []);
  tfListSet('tf-acs', []);
  tfListSet('tf-tests', ['Verify feature works as described in acceptance criteria','No regressions in existing test suite']);
  tfListSet('tf-vals', ['All acceptance criteria verified','No TypeScript errors (npx tsc --noEmit)','All tests pass (npm test)','No layer violations introduced','Blueprint regenerated (npm run blueprint)']);
  tfListSet('tf-pvs', ['Run validation wizard: click \u2713 VALIDATE on ticket card','Auto-refresh: cd apps/api && node blueprint.js','Auto-refresh: node scripts/generate-roadmap.js','Manual review: PROJECT_STATE.md \u2014 update if architecture changed','Manual review: ARCHITECTURE_LOW_CONTEXT_GUIDE.md \u2014 update if auth/layers touched','Manual review: docs/AUDIT.md \u2014 mark resolved findings','Manual review: SCHEMA_REFERENCE.md \u2014 update if schema changed','Commit: npx tsc --noEmit \u2192 npm test \u2192 npm run blueprint']);
  tfHideErrors();
  tfHideSuccess();
}

function openTicketForm() {
  tfReset();
  document.getElementById('ticket-form-overlay').classList.add('open');
}

function closeTicketForm() {
  document.getElementById('ticket-form-overlay').classList.remove('open');
}

document.getElementById('ticket-form-overlay').addEventListener('click',function(e){
  if(e.target===this) closeTicketForm();
});

/* ── Populate form from existing ticket (edit mode) ──────── */
function tfEditTicket(ticketId) {
  var ticket = (typeof TF_CUSTOM_ITEMS !== 'undefined' ? TF_CUSTOM_ITEMS : []).find(function(c){ return c.id === ticketId; });
  if (!ticket) { alert('Ticket not found: ' + ticketId); return; }

  tfReset();
  document.getElementById('tf-mode').value = 'edit';
  document.getElementById('tf-edit-id').value = ticketId;
  document.getElementById('tf-heading').textContent = '\u270E Edit Ticket: ' + ticketId;
  document.getElementById('tf-id').value = ticketId;
  document.getElementById('tf-id').setAttribute('readonly','readonly');
  document.getElementById('tf-phase').value = ticket.phase || 'P1';
  document.getElementById('tf-order').value = ticket.order !== undefined ? ticket.order : 1;
  document.getElementById('tf-title').value = ticket.title || '';
  document.getElementById('tf-type').value = ticket.type || 'task';
  document.getElementById('tf-status').value = ticket.status || 'planned';
  document.getElementById('tf-persona').value = ticket.persona || '';
  document.getElementById('tf-ticket').value = ticket.ticket || '';
  document.getElementById('tf-parent').value = ticket.parent_feature || '';
  document.getElementById('tf-desc').value = ticket.description || '';
  document.getElementById('tf-notes').value = ticket.notes || '';
  document.getElementById('tf-test-protocol').value = ticket.test_protocol || '';

  tfListSet('tf-deps', ticket.depends_on || []);
  tfListSet('tf-files', ticket.files_expected || []);
  tfListSet('tf-acs', ticket.acceptance_criteria || []);
  tfListSet('tf-tests', ticket.required_tests || []);
  tfListSet('tf-vals', ticket.validation_checklist || []);
  tfListSet('tf-pvs', ticket.post_validation || []);

  document.getElementById('ticket-form-overlay').classList.add('open');
}

/* ── Duplicate ticket via API ────────────────────────────── */
function tfDuplicateTicket(ticketId) {
  if (!confirm('Duplicate ticket ' + ticketId + '?')) return;
  fetch(TF_API + '/api/tickets/' + encodeURIComponent(ticketId) + '/dup', { method: 'POST' })
    .then(function(r){ return r.json(); })
    .then(function(d){
      if (d.ok) { showToast('Duplicated as ' + d.ticket.id, 'success'); reloadKeepTab(); }
      else { alert('Error: ' + (d.errors||[]).join(', ')); }
    })
    .catch(function(e){ alert('Server not running? ' + e.message); });
}

/* ── Delete ticket via API ───────────────────────────────── */
function tfDeleteTicket(ticketId) {
  if (!confirm('Delete ticket ' + ticketId + '? This cannot be undone.')) return;
  fetch(TF_API + '/api/tickets/' + encodeURIComponent(ticketId), { method: 'DELETE' })
    .then(function(r){ return r.json(); })
    .then(function(d){
      if (d.ok) { showToast('Deleted ' + ticketId, 'success'); reloadKeepTab(); }
      else { alert('Error: ' + (d.errors||[]).join(', ')); }
    })
    .catch(function(e){ alert('Server not running? ' + e.message); });
}

/* ── Error / Success display ─────────────────────────────── */
function tfShowErrors(errors) {
  var el = document.getElementById('tf-errors');
  el.innerHTML = errors.map(function(e){ return '\u2716 ' + e; }).join('<br>');
  el.classList.add('visible');
}
function tfHideErrors() {
  var el = document.getElementById('tf-errors');
  el.innerHTML = '';
  el.classList.remove('visible');
}
function tfShowSuccess(msg) {
  var el = document.getElementById('tf-success');
  el.textContent = '\u2714 ' + msg;
  el.classList.add('visible');
}
function tfHideSuccess() {
  var el = document.getElementById('tf-success');
  el.textContent = '';
  el.classList.remove('visible');
}

/* ── Collect form data ───────────────────────────────────── */
function tfCollectData() {
  return {
    id: document.getElementById('tf-id').value.trim(),
    phase: document.getElementById('tf-phase').value,
    order: parseInt(document.getElementById('tf-order').value, 10) || 0,
    title: document.getElementById('tf-title').value.trim(),
    type: document.getElementById('tf-type').value,
    status: document.getElementById('tf-status').value,
    persona: document.getElementById('tf-persona').value || undefined,
    ticket: document.getElementById('tf-ticket').value.trim() || undefined,
    parent_feature: document.getElementById('tf-parent').value || undefined,
    description: document.getElementById('tf-desc').value.trim(),
    notes: document.getElementById('tf-notes').value.trim() || undefined,
    depends_on: tfListGet('tf-deps'),
    files_expected: tfListGet('tf-files'),
    acceptance_criteria: tfListGet('tf-acs'),
    required_tests: tfListGet('tf-tests'),
    test_protocol: document.getElementById('tf-test-protocol').value.trim(),
    validation_checklist: tfListGet('tf-vals'),
    post_validation: tfListGet('tf-pvs'),
  };
}

/* ── Client-side validation (mirrors server) ─────────────── */
function tfValidateClient(data) {
  var errors = [];
  if (!data.title) errors.push('title is required');
  if (!data.phase) errors.push('phase is required');
  if (!data.order && data.order !== 0) errors.push('order/sequence is required');
  if (!data.acceptance_criteria || data.acceptance_criteria.length === 0) errors.push('at least one acceptance criterion is required');
  if (!data.required_tests || data.required_tests.length === 0) errors.push('at least one test requirement is required');
  if (!data.test_protocol) errors.push('test protocol is required');
  if (!data.validation_checklist || data.validation_checklist.length === 0) errors.push('at least one validation checklist item is required');
  if (!data.post_validation || data.post_validation.length === 0) errors.push('at least one post-validation step is required');
  // Status-transition gates
  if (data.status === 'in_progress') {
    if (!data.test_protocol) errors.push('cannot mark in_progress without a test_protocol');
    if (!data.required_tests || data.required_tests.length === 0) errors.push('cannot mark in_progress without required_tests');
  }
  if (data.status === 'done') {
    if (!data.validation_checklist || data.validation_checklist.length === 0) errors.push('cannot mark done/validated without a validation_checklist');
    if (!data.test_protocol) errors.push('cannot mark done/validated without a test_protocol');
    if (!data.required_tests || data.required_tests.length === 0) errors.push('cannot mark done/validated without required_tests');
  }
  // Check dependency refs
  if (data.depends_on && data.depends_on.length > 0 && typeof TF_KNOWN_IDS !== 'undefined') {
    data.depends_on.forEach(function(dep){
      if (TF_KNOWN_IDS.indexOf(dep) === -1 && dep !== data.id) {
        errors.push('unknown dependency: ' + dep);
      }
    });
  }
  return errors;
}

/* ── Save (create or update) ─────────────────────────────── */
function tfSave(callback) {
  tfHideErrors();
  tfHideSuccess();
  var data = tfCollectData();
  var clientErrors = tfValidateClient(data);
  if (clientErrors.length > 0) { tfShowErrors(clientErrors); return; }

  var mode = document.getElementById('tf-mode').value;
  var isEdit = mode === 'edit';
  var url = isEdit
    ? TF_API + '/api/tickets/' + encodeURIComponent(document.getElementById('tf-edit-id').value)
    : TF_API + '/api/tickets';
  var method = isEdit ? 'PUT' : 'POST';

  // Show saving state
  document.querySelector('.ticket-form').classList.add('tf-saving');

  fetch(url, {
    method: method,
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  })
  .then(function(r){ return r.json().then(function(d){ return { status: r.status, data: d }; }); })
  .then(function(result){
    document.querySelector('.ticket-form').classList.remove('tf-saving');
    if (result.data.ok) {
      tfShowSuccess((isEdit ? 'Updated' : 'Created') + ' ' + result.data.ticket.id + (result.data.regenerated ? ' \u2014 roadmap regenerated' : ''));
      if (callback) callback(result.data);
    } else {
      tfShowErrors(result.data.errors || ['Unknown error']);
    }
  })
  .catch(function(e){
    document.querySelector('.ticket-form').classList.remove('tf-saving');
    tfShowErrors(['Server not reachable. Start it with: node scripts/roadmap-server.js','Error: ' + e.message]);
  });
}

function tfSaveAndRefresh() {
  tfSave(function(){
    setTimeout(function(){ reloadKeepTab(); }, 600);
  });
}

/* \u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550
   Validate Wizard \u2014 3-step guided validation flow
   Step 1: Confirm test protocol   (all steps checked)
   Step 2: Confirm validation checklist (all items checked)
   Step 3: Context refresh   (auto + manual review targets)
   Then mark ticket as validated (done + validated_at).
   \u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550 */
var VW_TICKET = null;
var VW_STEP = 1;
var VW_REFRESH_DONE = false;

function tfValidateTicket(ticketId) {
  var ticket = (typeof TF_CUSTOM_ITEMS !== 'undefined' ? TF_CUSTOM_ITEMS : []).find(function(c){ return c.id === ticketId; });
  if (!ticket) { alert('Ticket not found: ' + ticketId); return; }

  /* Gate check \u2014 testing metadata must be complete */
  var missing = [];
  if (!(ticket.required_tests||[]).length) missing.push('required_tests');
  if (!(ticket.test_protocol||'').trim()) missing.push('test_protocol');
  if (!(ticket.validation_checklist||[]).length) missing.push('validation_checklist');
  if (!(ticket.post_validation||[]).length) missing.push('post_validation');
  if (missing.length > 0) {
    alert('Cannot validate \u2014 missing: ' + missing.join(', ') + '\\nEdit the ticket first to add testing metadata.');
    return;
  }

  VW_TICKET = ticket;
  VW_STEP = 1;
  VW_REFRESH_DONE = false;

  document.getElementById('vw-ticket-id').textContent = ticketId + ' \u2014 ' + ticket.title;

  /* Populate Step 1: protocol steps as checkboxes */
  var protocolSteps = (ticket.test_protocol || '').split('\\n').filter(Boolean);
  var protHtml = protocolSteps.map(function(s, i) {
    return '<label class="vw-check-item"><input type="checkbox" class="vw-proto-cb" data-idx="' + i + '" /><span>' + s.replace(/</g,'&lt;') + '</span></label>';
  }).join('');
  document.getElementById('vw-protocol-items').innerHTML = protHtml;

  /* Populate Step 2: checklist items as checkboxes */
  var checklist = ticket.validation_checklist || [];
  var clHtml = checklist.map(function(s, i) {
    return '<label class="vw-check-item"><input type="checkbox" class="vw-cl-cb" data-idx="' + i + '" /><span>' + s.replace(/</g,'&lt;') + '</span></label>';
  }).join('');
  document.getElementById('vw-checklist-items').innerHTML = clHtml;

  /* Populate Step 3: refresh targets — derived from ticket's post_validation or inferred */
  document.getElementById('vw-refresh-auto-items').innerHTML =
    '<div class="vw-refresh-target"><strong>docs/blueprint.html</strong> \u2014 <code>cd apps/api && node blueprint.js</code></div>'
    + '<div class="vw-refresh-target"><strong>docs/roadmap.html</strong> \u2014 <code>node scripts/generate-roadmap.js</code></div>';

  /* Use ticket's explicit post_validation, or infer from files + type */
  var pvItems = (ticket.post_validation && ticket.post_validation.length > 0)
    ? ticket.post_validation
    : inferPVTargets(ticket.files_expected || [], ticket.type || 'task', ticket.description || '');
  var isInferred = !(ticket.post_validation && ticket.post_validation.length > 0);

  /* Build manual review targets from ticket-specific post_validation items */
  var pvHtml = '';
  pvItems.forEach(function(pv) {
    pvHtml += '<label class="vw-check-item"><input type="checkbox" class="vw-manual-cb" /><span>'
      + pv.replace(/</g,'&lt;') + '</span></label>';
  });
  if (isInferred) {
    pvHtml += '<div class="vw-pv-note">\\u26A1 Auto-inferred from files_expected + ticket type. Edit the ticket to override.</div>';
  }
  document.getElementById('vw-refresh-manual-items').innerHTML = pvHtml;

  document.getElementById('vw-refresh-results').innerHTML = '';
  var refreshBtn = document.getElementById('vw-refresh-btn');
  refreshBtn.textContent = '\u25b6 RUN CONTEXT REFRESH';
  refreshBtn.disabled = false;
  document.getElementById('vw-errors').innerHTML = '';
  document.getElementById('vw-success').innerHTML = '';
  var completeBtn = document.getElementById('vw-btn-complete');
  completeBtn.textContent = '\u2713 MARK VALIDATED';
  completeBtn.disabled = false;

  vwShowStep(1);
  document.getElementById('validate-wizard-overlay').classList.add('open');
}

function vwShowStep(n) {
  VW_STEP = n;
  for (var i = 1; i <= 3; i++) {
    var ind = document.getElementById('vw-step-ind-' + i);
    ind.classList.toggle('active', i === n);
    ind.classList.toggle('done', i < n);
    document.getElementById('vw-body-' + i).classList.toggle('active', i === n);
  }
  document.getElementById('vw-btn-back').style.display = n > 1 ? '' : 'none';
  document.getElementById('vw-btn-next').style.display = n < 3 ? '' : 'none';
  document.getElementById('vw-btn-complete').style.display = n === 3 ? '' : 'none';
  document.getElementById('vw-errors').innerHTML = '';
}

function vwNextStep() {
  if (VW_STEP === 1) {
    var unchecked = document.querySelectorAll('.vw-proto-cb:not(:checked)');
    if (unchecked.length > 0) {
      document.getElementById('vw-errors').innerHTML = '\u2716 Confirm all ' + unchecked.length + ' protocol step(s) before proceeding';
      return;
    }
    vwShowStep(2);
  } else if (VW_STEP === 2) {
    var uncheckedCl = document.querySelectorAll('.vw-cl-cb:not(:checked)');
    if (uncheckedCl.length > 0) {
      document.getElementById('vw-errors').innerHTML = '\u2716 Confirm all ' + uncheckedCl.length + ' checklist item(s) before proceeding';
      return;
    }
    vwShowStep(3);
  }
}

function vwPrevStep() {
  if (VW_STEP > 1) vwShowStep(VW_STEP - 1);
}

function vwRunRefresh() {
  var btn = document.getElementById('vw-refresh-btn');
  btn.textContent = '\u23f3 RUNNING...';
  btn.disabled = true;
  document.getElementById('vw-refresh-results').innerHTML = '<div style="color:var(--text-dim)">Running context refresh (blueprint + roadmap)...</div>';

  fetch(TF_API + '/api/context-refresh', { method: 'POST' })
    .then(function(r){ return r.json(); })
    .then(function(d) {
      btn.textContent = '\u2714 REFRESH COMPLETE';
      VW_REFRESH_DONE = true;
      var html = '';
      if (d.ok && d.refresh) {
        (d.refresh.automated || []).forEach(function(r) {
          var icon = r.status === 'ok' ? '\u2714' : '\u2716';
          var color = r.status === 'ok' ? 'var(--p0)' : '#ff5a5a';
          html += '<div style="font-family:\\'IBM Plex Mono\\',monospace;font-size:12px;color:' + color + ';padding:2px 0">' + icon + ' ' + r.target + '</div>';
        });
        if (d.refresh.manual_review && d.refresh.manual_review.length > 0) {
          html += '<div style="font-size:12px;color:var(--text-dim);margin-top:6px">\u2713 Auto-refresh complete. Check the manual review targets below if applicable.</div>';
        }
      }
      document.getElementById('vw-refresh-results').innerHTML = html;
    })
    .catch(function(e) {
      btn.textContent = '\u2716 REFRESH FAILED \u2014 click to retry';
      btn.disabled = false;
      document.getElementById('vw-refresh-results').innerHTML = '<div style="color:#ff5a5a;font-size:12px">Error: ' + e.message + '<br>Is the roadmap server running? Start with: node scripts/roadmap-server.js</div>';
    });
}

function vwComplete() {
  if (!VW_REFRESH_DONE) {
    document.getElementById('vw-errors').innerHTML = '\u2716 Run the context refresh first (click \u25b6 RUN CONTEXT REFRESH above)';
    return;
  }

  var btn = document.getElementById('vw-btn-complete');
  btn.textContent = '\u23f3 VALIDATING...';
  btn.disabled = true;

  fetch(TF_API + '/api/tickets/' + encodeURIComponent(VW_TICKET.id) + '/validate', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ protocol_confirmed: true, checklist_confirmed: true }),
  })
  .then(function(r){ return r.json(); })
  .then(function(d) {
    if (d.ok) {
      document.getElementById('vw-success').innerHTML = '\u2714 Ticket ' + VW_TICKET.id + ' validated \u2014 status: done \u00b7 validated_at: ' + (d.ticket.validated_at || 'now');
      setTimeout(function(){ reloadKeepTab(); }, 1500);
    } else {
      btn.textContent = '\u2713 MARK VALIDATED';
      btn.disabled = false;
      document.getElementById('vw-errors').innerHTML = '\u2716 ' + (d.errors || []).join(', ');
    }
  })
  .catch(function(e) {
    btn.textContent = '\u2713 MARK VALIDATED';
    btn.disabled = false;
    document.getElementById('vw-errors').innerHTML = '\u2716 Server error: ' + e.message;
  });
}

function closeValidateWizard() {
  document.getElementById('validate-wizard-overlay').classList.remove('open');
}

document.getElementById('validate-wizard-overlay').addEventListener('click', function(e) {
  if (e.target === this) closeValidateWizard();
});

/* ── Intake / Draft Functions ─────────────────────────────── */

/* ── Pipeline Navigation ─────────────────────────── */

function pipelineSwitch(stage) {
  document.querySelectorAll('.pipeline-seg').forEach(function(s) { s.classList.remove('active'); });
  document.querySelectorAll('.pipeline-stage').forEach(function(s) { s.classList.remove('active'); });
  var seg = document.querySelector('.pipeline-seg[data-stage="' + stage + '"]');
  var panel = document.getElementById('pipeline-stage-' + stage);
  if (seg) seg.classList.add('active');
  if (panel) panel.classList.add('active');
  // Auto-load clarify questions when switching to Stage 2
  if (stage === 2) {
    var cards = panel ? panel.querySelectorAll('[data-intake-id]') : [];
    cards.forEach(function(c) {
      var iid = c.getAttribute('data-intake-id');
      if (iid && typeof loadClarifyQuestions === 'function') loadClarifyQuestions(iid);
    });
  }
}

function pipelineFeedback(msg, type) {
  var el = document.getElementById('pipeline-feedback');
  if (!el) return;
  el.className = 'pipeline-feedback ' + (type || 'success');
  el.textContent = msg;
  setTimeout(function() { el.className = 'pipeline-feedback'; el.textContent = ''; }, 4000);
}

function captureQueueIt(intakeId) {
  var card = document.querySelector('[data-intake-id="' + intakeId + '"]');
  if (card) card.style.opacity = '0.5';
  fetch(TF_API + '/api/intake/' + encodeURIComponent(intakeId) + '/auto-triage', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ apply: true })
  })
  .then(function(r){ return r.json(); })
  .then(function(d){
    if (d.ok) { pipelineFeedback('Queued ' + intakeId + ' for review', 'success'); reloadKeepTab(); }
    else { pipelineFeedback('Error: ' + (d.errors||[]).join(', '), 'error'); if (card) card.style.opacity = ''; }
  })
  .catch(function(e){ pipelineFeedback('Server error: ' + e.message, 'error'); if (card) card.style.opacity = ''; });
}

// ── Clarify questions state ──
var _clarifyQuestionsCache = {};

function loadClarifyQuestions(intakeId) {
  if (_clarifyQuestionsCache[intakeId]) return; // already loading or loaded
  _clarifyQuestionsCache[intakeId] = 'loading';
  var area = document.getElementById('clarify-q-' + intakeId);
  if (!area) return;
  fetch(TF_API + '/api/intake/' + encodeURIComponent(intakeId) + '/clarify-questions')
  .then(function(r){ return r.json(); })
  .then(function(d){
    if (!d.ok || !d.questions || d.questions.length === 0) {
      area.innerHTML = '<div style="font-size:13px;color:var(--text);line-height:1.8">What is the main business goal here \u2014 what problem does this solve for the user?</div>';
      _clarifyQuestionsCache[intakeId] = [{ id:'q1', text:'What is the main business goal?', reason:'fallback', fills:['story_intent','story_success_outcome'] }];
    } else {
      var html = '';
      for (var i = 0; i < d.questions.length; i++) {
        html += '<div style="font-size:13px;color:var(--text);line-height:1.8">' + d.questions[i].text + '</div>';
      }
      area.innerHTML = html;
      _clarifyQuestionsCache[intakeId] = d.questions;
    }
    var ta = document.getElementById('clarify-answer-' + intakeId);
    if (ta) ta.style.display = '';
  })
  .catch(function(e){
    area.innerHTML = '<div style="font-size:13px;color:var(--text);line-height:1.8">What is the main business goal here \u2014 what problem does this solve for the user?</div>';
    _clarifyQuestionsCache[intakeId] = [{ id:'q1', text:'What is the main business goal?', reason:'fallback', fills:['story_intent','story_success_outcome'] }];
    var ta = document.getElementById('clarify-answer-' + intakeId);
    if (ta) ta.style.display = '';
  });
}

// Auto-load clarify questions for visible Stage 2 cards on page init
(function initClarifyQuestions() {
  var stage2 = document.getElementById('pipeline-stage-2');
  if (!stage2 || !stage2.classList.contains('active')) return;
  var cards = stage2.querySelectorAll('[data-intake-id]');
  cards.forEach(function(c) {
    var iid = c.getAttribute('data-intake-id');
    if (iid) loadClarifyQuestions(iid);
  });
})();

function clarifySubmitAnswer(intakeId) {
  var ta = document.getElementById('clarify-answer-' + intakeId);
  var answerText = ta ? ta.value.trim() : '';
  if (!answerText) {
    pipelineFeedback('Please type an answer first', 'error');
    return;
  }
  var card = document.querySelector('[data-intake-id="' + intakeId + '"]');
  var submitBtn = document.getElementById('clarify-submit-' + intakeId);
  if (submitBtn) { submitBtn.textContent = '\u27F3 Saving\u2026'; submitBtn.disabled = true; }
  var questions = _clarifyQuestionsCache[intakeId];
  if (!Array.isArray(questions)) questions = [];
  fetch(TF_API + '/api/intake/' + encodeURIComponent(intakeId) + '/clarify', {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ context: answerText, questions: questions })
  })
  .then(function(r){ return r.json(); })
  .then(function(d){
    if (d.ok) {
      // Show feedback bar with fields that were auto-filled
      var fb = document.getElementById('clarify-fb-' + intakeId);
      if (fb && d.fields_filled && d.fields_filled.length > 0) {
        var msg = 'Got it \u2014 set ' + d.fields_filled.map(function(f){
          var val = d.item ? d.item[f] : '';
          var label = f.replace(/_/g, ' ');
          return val ? label + ' to ' + val : label;
        }).join(', ') + '.';
        fb.textContent = msg;
        fb.style.display = '';
      } else if (fb) {
        fb.textContent = 'Got it \u2014 context saved, item triaged.';
        fb.style.display = '';
      }
      // After 1.5s, move to Stage 3 via promote
      setTimeout(function(){
        fetch(TF_API + '/api/intake/' + encodeURIComponent(intakeId) + '/promote', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' }
        })
        .then(function(r2){ return r2.json(); })
        .then(function(d2){
          if (d2.ok) {
            var cnt = (d2.drafts || []).length;
            pipelineFeedback('Created ' + cnt + ' ticket' + (cnt !== 1 ? 's' : '') + ' from ' + intakeId, 'success');
          }
          reloadKeepTab();
        })
        .catch(function(){ reloadKeepTab(); });
      }, 1500);
    } else {
      pipelineFeedback('Error: ' + (d.errors || []).join(', '), 'error');
      if (submitBtn) { submitBtn.textContent = '\u2713 Submit & queue'; submitBtn.disabled = false; }
    }
  })
  .catch(function(e){
    pipelineFeedback('Server error: ' + e.message, 'error');
    if (submitBtn) { submitBtn.textContent = '\u2713 Submit & queue'; submitBtn.disabled = false; }
  });
}

function clarifyQueueIt(intakeId) {
  // Skip questions — promote directly
  var card = document.querySelector('[data-intake-id="' + intakeId + '"]');
  if (card) card.style.opacity = '0.5';
  fetch(TF_API + '/api/intake/' + encodeURIComponent(intakeId) + '/promote', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' }
  })
  .then(function(r){ return r.json(); })
  .then(function(d){
    if (d.ok) {
      var cnt = (d.drafts || []).length;
      pipelineFeedback('Created ' + cnt + ' ticket' + (cnt !== 1 ? 's' : '') + ' from ' + intakeId, 'success');
      reloadKeepTab();
    } else {
      pipelineFeedback('Error: ' + (d.error || (d.errors||[]).join(', ')), 'error');
      if (card) card.style.opacity = '';
    }
  })
  .catch(function(e){ pipelineFeedback('Server error: ' + e.message, 'error'); if (card) card.style.opacity = ''; });
}

function clarifyQueueAll() {
  if (!confirm('Queue all clarified items for review?')) return;
  fetch(TF_API + '/api/intake/promote-all', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' }
  })
  .then(function(r){ return r.json(); })
  .then(function(d){
    if (d.ok) {
      pipelineFeedback('Queued ' + d.promoted_count + ' items, created ' + d.drafts_created + ' tickets', 'success');
      reloadKeepTab();
    } else {
      pipelineFeedback('Error: ' + (d.error || (d.errors||[]).join(', ')), 'error');
    }
  })
  .catch(function(e){ pipelineFeedback('Server error: ' + e.message, 'error'); });
}

function processAllDrafts() {
  var btn = document.getElementById('processAllBtn');
  if (btn) { btn.textContent = '\u27F3 Building your backlog\u2026'; btn.disabled = true; }
  // Try batch refine all drafts in draft status
  var draftCards = document.querySelectorAll('[data-draft-status="draft"]');
  var ids = [];
  draftCards.forEach(function(c) {
    var did = c.getAttribute('data-draft-id');
    if (did) ids.push(did);
  });
  // Also collect from parent intake cards
  document.querySelectorAll('[data-intake-status="drafted"]').forEach(function(c) {
    c.style.opacity = '0.5';
  });
  // Use promote-all as fallback if no individual drafts
  if (ids.length === 0) {
    fetch(TF_API + '/api/intake/promote-all', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' }
    })
    .then(function(r){ return r.json(); })
    .then(function(d){
      if (d.ok) {
        var rs = d.refine_summary || {};
        var msg = 'Done \u2014 ' + (d.promoted_count || 0) + ' epic(s) with ' + (d.total_drafts_created || 0) + ' stories ready to implement';
        if (rs.refined) msg += ' \u00B7 ' + rs.refined + ' linked to your codebase';
        var blockedCount = (rs.skipped || 0);
        if (blockedCount > 0) msg += ' \u00B7 ' + blockedCount + ' blocked (see Ready tab for what to resolve)';
        pipelineFeedback(msg, 'success');
        pipelineSwitch(4);
        setTimeout(function(){ reloadKeepTab(); }, 800);
      } else {
        pipelineFeedback('Error: ' + (d.error || (d.errors||[]).join(', ')), 'error');
      }
      if (btn) { btn.textContent = '\u2728 Turn into epics & stories'; btn.disabled = false; }
    })
    .catch(function(e){
      pipelineFeedback('Server error: ' + e.message, 'error');
      if (btn) { btn.textContent = '\u2728 Turn into epics & stories'; btn.disabled = false; }
    });
    return;
  }
  // Refine each draft sequentially
  var refined = 0;
  function refineNext(idx) {
    if (idx >= ids.length) {
      pipelineFeedback('Done \u2014 ' + refined + ' of ' + ids.length + ' stories refined and ready to implement', 'success');
      if (btn) { btn.textContent = '\u2728 Turn into epics & stories'; btn.disabled = false; }
      pipelineSwitch(4);
      setTimeout(function(){ reloadKeepTab(); }, 800);
      return;
    }
    fetch(TF_API + '/api/drafts/' + encodeURIComponent(ids[idx]) + '/refine', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' }
    })
    .then(function(r){ return r.json(); })
    .then(function(d){ if (d.ok) refined++; refineNext(idx + 1); })
    .catch(function(){ refineNext(idx + 1); });
  }
  refineNext(0);
}

function toggleReadyPrompt(promptId) {
  var el = document.getElementById(promptId);
  var actions = document.getElementById(promptId + '-actions');
  if (!el) return;
  var isOpen = el.classList.contains('open');
  el.classList.toggle('open');
  if (actions) actions.style.display = isOpen ? 'none' : 'flex';
  // Update toggle button text
  var btn = el.previousElementSibling;
  if (btn && btn.classList.contains('ready-prompt-toggle')) {
    btn.textContent = isOpen ? '\u25B8 Show Copilot prompt' : '\u25BE Hide Copilot prompt';
  }
}

function copyReadyPrompt(promptId) {
  var el = document.getElementById(promptId);
  if (!el) return;
  var text = el.textContent;
  if (navigator.clipboard && navigator.clipboard.writeText) {
    navigator.clipboard.writeText(text).then(function() {
      pipelineFeedback('Prompt copied to clipboard', 'success');
    }).catch(function() {
      fallbackCopy(el);
    });
  } else {
    fallbackCopy(el);
  }
  function fallbackCopy(node) {
    var range = document.createRange();
    range.selectNodeContents(node);
    var sel = window.getSelection();
    sel.removeAllRanges();
    sel.addRange(range);
    document.execCommand('copy');
    sel.removeAllRanges();
    pipelineFeedback('Prompt copied to clipboard', 'success');
  }
}

var _bulkParsedItems = [];

function intakeFormToggle() {
  var el = document.getElementById('intakeFormBlock');
  el.style.display = el.style.display === 'none' ? '' : 'none';
}

function intakeBulkToggle() {
  var el = document.getElementById('intakeBulkPanel');
  el.classList.toggle('open');
  if (!el.classList.contains('open')) {
    document.getElementById('intakeBulkPreview').classList.remove('open');
    document.getElementById('intakeBulkActions').style.display = 'none';
    _bulkParsedItems = [];
  }
}

function intakeSubmit() {
  var raw = document.getElementById('intakeRawText').value.trim();
  if (!raw) { alert('Please paste some text first.'); return; }
  var title = document.getElementById('intakeTitle').value.trim() || null;
  var source = document.getElementById('intakeSource').value.trim() || 'manual_paste';
  var area = document.getElementById('intakeArea').value.trim() || null;
  fetch(TF_API + '/api/intake', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ raw_text: raw, title: title, source: source, product_area: area })
  })
  .then(function(r){ return r.json(); })
  .then(function(d){
    if (d.ok) { showToast('Intake item created', 'success'); reloadKeepTab(); }
    else { alert('Error: ' + (d.errors||[]).join(', ')); }
  })
  .catch(function(e){ alert('Server not running? ' + e.message); });
}

function intakeBulkParse() {
  var text = document.getElementById('intakeBulkText').value.trim();
  if (!text) { alert('Paste some text first.'); return; }
  var source = document.getElementById('intakeBulkSource').value.trim() || 'bulk_paste';
  var area = document.getElementById('intakeBulkArea').value.trim() || null;
  var preview = document.getElementById('intakeBulkPreview');
  preview.innerHTML = '<div style="padding:12px;color:#94a3b8;">Parsing\u2026</div>';
  preview.classList.add('open');
  fetch(TF_API + '/api/intake/parse', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ text: text, source: source, product_area: area })
  })
  .then(function(r){ return r.json(); })
  .then(function(d){
    if (!d.ok) { alert('Parse error: ' + (d.errors||[]).join(', ')); preview.innerHTML = ''; return; }
    _bulkParsedItems = d.items;
    var html = '';
    for (var j = 0; j < d.items.length; j++) {
      var it = d.items[j];
      var badges = '';
      if (it.note_type) badges += '<span class="tag">' + it.note_type.replace(/_/g,' ') + '</span>';
      if (it.product_area) badges += '<span class="tag tag-area">' + it.product_area + '</span>';
      if (it.split_recommended) badges += '<span class="tag tag-warn">\u2702 split</span>';
      if (it.dependencies && it.dependencies.length) badges += '<span class="tag tag-dep">\u26d3 ' + it.dependencies.length + ' dep</span>';
      var title = it.title ? it.title.replace(/</g, '&lt;') : '(no title)';
      var raw = it.raw_text.length > 160 ? it.raw_text.substring(0, 160).replace(/</g, '&lt;') + '\u2026' : it.raw_text.replace(/</g, '&lt;');
      html += '<div class="intake-bulk-item">';
      html += '<span class="intake-bulk-num">' + (j+1) + '.</span>';
      html += '<div style="flex:1"><div style="font-weight:600;margin-bottom:2px;">' + title + '</div>';
      html += '<div style="font-size:0.8em;color:#94a3b8;margin-bottom:4px;">' + raw + '</div>';
      html += '<div style="display:flex;gap:4px;flex-wrap:wrap;">' + badges + '</div>';
      html += '</div></div>';
    }
    preview.innerHTML = html;
    document.getElementById('intakeBulkActions').style.display = 'flex';
    document.getElementById('intakeBulkCount').textContent = d.items.length + ' items parsed';
  })
  .catch(function(e){ alert('Server not running? ' + e.message); preview.innerHTML = ''; });
}

function intakeBulkCreate() {
  if (_bulkParsedItems.length === 0) { alert('Parse first.'); return; }
  var source = document.getElementById('intakeBulkSource').value.trim() || 'bulk_paste';
  var area = document.getElementById('intakeBulkArea').value.trim() || null;
  var created = 0;
  var total = _bulkParsedItems.length;
  function createNext(idx) {
    if (idx >= total) {
      showToast('Created ' + created + ' of ' + total + ' intake items', 'success');
      setTimeout(function(){ reloadKeepTab(); }, 800);
      return;
    }
    var it = _bulkParsedItems[idx];
    var payload = {
      raw_text: it.raw_text || it,
      source: it.source || source,
      product_area: area || it.product_area || null,
    };
    if (it.title) payload.title = it.title;
    if (it.dependencies && it.dependencies.length) payload.dependencies = it.dependencies;
    fetch(TF_API + '/api/intake', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    })
    .then(function(r){ return r.json(); })
    .then(function(d){ if (d.ok) created++; createNext(idx + 1); })
    .catch(function(){ createNext(idx + 1); });
  }
  if (!confirm('Create ' + total + ' intake items from parsed text?')) return;
  createNext(0);
}

function intakeBulkIngest() {
  var text = document.getElementById('intakeBulkText').value.trim();
  if (!text) { alert('Paste some text first.'); return; }
  var source = document.getElementById('intakeBulkSource').value.trim() || 'bulk_ingest';
  var area = document.getElementById('intakeBulkArea').value.trim() || null;
  if (!confirm('Full ingest pipeline: parse \\u2192 create \\u2192 auto-triage \\u2192 auto-draft.\\n\\nThis will create intake items AND draft tickets in one shot.\\nProceed?')) return;
  var preview = document.getElementById('intakeBulkPreview');
  preview.innerHTML = '<div style="padding:12px;color:#94a3b8;">\\u26A1 Running full ingest pipeline\\u2026</div>';
  preview.classList.add('open');
  fetch(TF_API + '/api/intake/bulk-ingest', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ text: text, source: source, product_area: area })
  })
  .then(function(r){ return r.json(); })
  .then(function(d){
    if (!d.ok) { alert('Ingest error: ' + (d.errors||[]).join(', ')); return; }
    var s = d.summary || {};
    showToast('Bulk ingest: ' + (s.created||0) + ' created, ' + (s.triaged||0) + ' triaged, ' + (s.drafted||0) + ' drafted', 'success');
    setTimeout(function(){ reloadKeepTab(); }, 800);
  })
  .catch(function(e){ alert('Server not running? ' + e.message); });
}

function intakeTriage(intakeId) {
  var card = document.querySelector('[data-intake-id="' + intakeId + '"]');
  if (!card) return;
  var rawEl = card.querySelector('.intake-raw-preview');
  var rawText = rawEl ? rawEl.textContent.trim() : '';
  var titleEl = card.querySelector('.custom-item-title');
  var title = titleEl ? titleEl.textContent.trim() : '';
  var draftTitle = prompt('Draft ticket title:', title || rawText.substring(0, 120));
  if (draftTitle === null) return;
  if (!draftTitle.trim()) { alert('Title is required.'); return; }
  var draftGoal = prompt('Goal / description (optional):', rawText.substring(0, 200));
  if (draftGoal === null) draftGoal = '';
  fetch(TF_API + '/api/intake/' + encodeURIComponent(intakeId) + '/triage', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ drafts: [{ title: draftTitle.trim(), goal: draftGoal.trim() }] })
  })
  .then(function(r){ return r.json(); })
  .then(function(d){
    if (d.ok) { showToast('Triaged ' + intakeId, 'success'); reloadKeepTab(); }
    else { alert('Error: ' + (d.errors||[]).join(', ')); }
  })
  .catch(function(e){ alert('Server not running? ' + e.message); });
}

function intakeSplit(intakeId) {
  var card = document.querySelector('[data-intake-id="' + intakeId + '"]');
  if (!card) return;

  // Show split plan preview if available, otherwise just confirm
  var splitPlanEl = card.querySelector('.intake-split-plan');
  var msg = 'Split ' + intakeId + ' into focused draft tickets?\\n\\n';
  if (splitPlanEl) {
    var planItems = splitPlanEl.querySelectorAll('li');
    msg += 'Proposed plan (' + planItems.length + ' parts):\\n';
    planItems.forEach(function(li, i) { msg += (i+1) + '. ' + li.textContent.trim() + '\\n'; });
  } else {
    msg += 'The system will analyze the text and generate a split plan automatically.';
  }
  msg += '\\n\\nFull draft tickets with scope, tests, and acceptance criteria will be generated.\\nProceed?';
  if (!confirm(msg)) return;

  // Dim the card to show processing
  card.style.opacity = '0.5';
  card.style.pointerEvents = 'none';

  fetch(TF_API + '/api/intake/' + encodeURIComponent(intakeId) + '/split', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({})
  })
  .then(function(r){ return r.json(); })
  .then(function(d){
    if (d.ok) {
      var cnt = (d.drafts || []).length;
      showToast('Split ' + intakeId + ' into ' + cnt + ' draft ticket' + (cnt !== 1 ? 's' : ''), 'success');
      setTimeout(function(){ reloadKeepTab(); }, 800);
    } else {
      alert('Split failed: ' + (d.errors||[]).join(', '));
      card.style.opacity = '';
      card.style.pointerEvents = '';
    }
  })
  .catch(function(e){
    alert('Server not running? ' + e.message);
    card.style.opacity = '';
    card.style.pointerEvents = '';
  });
}

function intakePark(intakeId) {
  fetch(TF_API + '/api/intake/' + encodeURIComponent(intakeId), {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ status: 'parked' })
  })
  .then(function(r){ return r.json(); })
  .then(function(d){
    if (d.ok) { showToast('Parked ' + intakeId, 'info'); reloadKeepTab(); }
    else { alert('Error: ' + (d.errors||[]).join(', ')); }
  })
  .catch(function(e){ alert('Server not running? ' + e.message); });
}

function intakeMarkDuplicate(intakeId) {
  if (!confirm('Mark ' + intakeId + ' as duplicate?')) return;
  fetch(TF_API + '/api/intake/' + encodeURIComponent(intakeId), {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ status: 'duplicate' })
  })
  .then(function(r){ return r.json(); })
  .then(function(d){
    if (d.ok) { showToast('Marked ' + intakeId + ' as duplicate', 'info'); reloadKeepTab(); }
    else { alert('Error: ' + (d.errors||[]).join(', ')); }
  })
  .catch(function(e){ alert('Server not running? ' + e.message); });
}

function intakeDelete(intakeId) {
  if (!confirm('Delete intake ' + intakeId + '? This cannot be undone.')) return;
  fetch(TF_API + '/api/intake/' + encodeURIComponent(intakeId), { method: 'DELETE' })
  .then(function(r){ return r.json(); })
  .then(function(d){
    if (d.ok) { showToast('Deleted ' + intakeId, 'success'); reloadKeepTab(); }
    else { alert('Error: ' + (d.errors||[]).join(', ')); }
  })
  .catch(function(e){ alert('Server not running? ' + e.message); });
}

function intakeAutoTriage(intakeId) {
  var card = document.querySelector('[data-intake-id="' + intakeId + '"]');
  if (card) card.style.opacity = '0.5';
  fetch(TF_API + '/api/intake/' + encodeURIComponent(intakeId) + '/auto-triage', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ apply: true })
  })
  .then(function(r){ return r.json(); })
  .then(function(d){
    if (d.ok) { showToast('Auto-triaged ' + intakeId, 'success'); reloadKeepTab(); }
    else { alert('Error: ' + (d.errors||[]).join(', ')); if (card) card.style.opacity = ''; }
  })
  .catch(function(e){ alert('Server not running? ' + e.message); if (card) card.style.opacity = ''; });
}

function intakeAutoTriageAll() {
  if (!confirm('Auto-triage all raw/triaged intake items?')) return;
  document.querySelectorAll('.intake-card').forEach(function(c) {
    var st = c.getAttribute('data-intake-status');
    if (st === 'raw' || st === 'triaged') c.style.opacity = '0.5';
  });
  fetch(TF_API + '/api/intake/auto-triage', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ apply: true })
  })
  .then(function(r){ return r.json(); })
  .then(function(d){
    if (d.ok) { showToast('Auto-triaged ' + d.triaged_count + ' items', 'success'); reloadKeepTab(); }
    else { alert('Error: ' + (d.errors||[]).join(', ')); reloadKeepTab(); }
  })
  .catch(function(e){ alert('Server not running? ' + e.message); reloadKeepTab(); });
}

/* intakeFilter removed — replaced by pipeline stages */

function intakeEdit(intakeId) {
  fetch(TF_API + '/api/intake')
  .then(function(r){ return r.json(); })
  .then(function(d) {
    if (!d.ok) return;
    var item = d.intake_items.find(function(i){ return i.id === intakeId; });
    if (!item) { alert('Item not found'); return; }
    document.getElementById('ie-id').textContent = item.id;
    document.getElementById('ie-id').setAttribute('data-id', item.id);
    document.getElementById('ie-title').value = item.title || '';
    document.getElementById('ie-raw-text').value = item.raw_text || '';
    document.getElementById('ie-status').value = item.status || 'raw';
    document.getElementById('ie-source').value = item.source || '';
    document.getElementById('ie-area').value = item.product_area || '';
    document.getElementById('ie-phase').value = item.proposed_phase || '';
    document.getElementById('ie-related').value = (item.related_feature_ids || []).join(', ');
    document.getElementById('ie-deps').value = (item.dependencies || []).join(', ');
    document.getElementById('ie-constraints').value = (item.constraints || []).join(', ');
    document.getElementById('ie-triage-notes').value = item.triage_notes || '';
    document.getElementById('ie-split-rec').checked = !!item.split_recommended;
    document.getElementById('ie-action').value = item.recommended_action || '';
    document.getElementById('ie-scope').value = item.scope_size || '';
    document.getElementById('ie-note-type').value = item.note_type || '';
    document.getElementById('ie-dup-of').value = item.duplicate_of || '';
    document.getElementById('intake-edit-overlay').classList.add('open');
  })
  .catch(function(e){ alert('Error loading data: ' + e.message); });
}

function intakeEditSave() {
  var id = document.getElementById('ie-id').getAttribute('data-id');
  var data = {
    title: document.getElementById('ie-title').value.trim() || null,
    raw_text: document.getElementById('ie-raw-text').value.trim(),
    status: document.getElementById('ie-status').value,
    source: document.getElementById('ie-source').value.trim() || null,
    product_area: document.getElementById('ie-area').value.trim() || null,
    proposed_phase: document.getElementById('ie-phase').value.trim() || null,
    related_feature_ids: document.getElementById('ie-related').value.split(',').map(function(s){ return s.trim(); }).filter(Boolean),
    dependencies: document.getElementById('ie-deps').value.split(',').map(function(s){ return s.trim(); }).filter(Boolean),
    constraints: document.getElementById('ie-constraints').value.split(',').map(function(s){ return s.trim(); }).filter(Boolean),
    triage_notes: document.getElementById('ie-triage-notes').value.trim(),
    split_recommended: document.getElementById('ie-split-rec').checked,
    recommended_action: document.getElementById('ie-action').value || null,
    scope_size: document.getElementById('ie-scope').value || null,
    note_type: document.getElementById('ie-note-type').value.trim() || null,
    duplicate_of: document.getElementById('ie-dup-of').value.trim() || null,
  };
  fetch(TF_API + '/api/intake/' + encodeURIComponent(id), {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data)
  })
  .then(function(r){ return r.json(); })
  .then(function(d){
    if (d.ok) { showToast('Saved changes', 'success'); reloadKeepTab(); }
    else { alert('Error: ' + (d.errors||[]).join(', ')); }
  })
  .catch(function(e){ alert('Server not running? ' + e.message); });
}

function intakeEditClose() {
  document.getElementById('intake-edit-overlay').classList.remove('open');
}

document.getElementById('intake-edit-overlay').addEventListener('click', function(e) {
  if (e.target === this) intakeEditClose();
});

function toggleRawPreview(rawId, btn) {
  var el = document.getElementById('raw-' + rawId);
  if (!el) return;
  el.classList.toggle('expanded');
  btn.textContent = el.classList.contains('expanded') ? '\\u25BE show less' : '\\u25B8 show more';
}

/* ── Intake Promote ──────────────────────────────── */

function intakePromote(intakeId) {
  var card = document.querySelector('[data-intake-id="' + intakeId + '"]');
  if (card) card.style.opacity = '0.5';
  fetch(TF_API + '/api/intake/' + encodeURIComponent(intakeId) + '/promote', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' }
  })
  .then(function(r){ return r.json(); })
  .then(function(d){
    if (d.ok) {
      var cnt = (d.drafts || []).length;
      showToast('Promoted ' + intakeId + ' → ' + cnt + ' draft ticket' + (cnt !== 1 ? 's' : ''), 'success');
      reloadKeepTab();
    } else {
      alert('Error: ' + (d.error || (d.errors||[]).join(', ')));
      if (card) card.style.opacity = '';
    }
  })
  .catch(function(e){ alert('Server not running? ' + e.message); if (card) card.style.opacity = ''; });
}

function intakePromoteAll() {
  if (!confirm('Promote ALL triaged intake items to fully-scoped draft tickets?')) return;
  document.querySelectorAll('.intake-card').forEach(function(c) {
    if (c.getAttribute('data-intake-status') === 'triaged') c.style.opacity = '0.5';
  });
  fetch(TF_API + '/api/intake/promote-all', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' }
  })
  .then(function(r){ return r.json(); })
  .then(function(d){
    if (d.ok) {
      showToast('Promoted ' + d.promoted_count + ' items → ' + d.drafts_created + ' draft tickets', 'success');
      reloadKeepTab();
    } else {
      alert('Error: ' + (d.error || (d.errors||[]).join(', ')));
      reloadKeepTab();
    }
  })
  .catch(function(e){ alert('Server not running? ' + e.message); reloadKeepTab(); });
}

/* ── Draft Detail Toggle ────────────────────────── */

function toggleDraftDetail(detailId) {
  var el = document.getElementById(detailId);
  if (!el) return;
  var btn = el.parentNode.querySelector('[onclick*="toggleDraftDetail"]');
  if (el.style.display === 'none') {
    el.style.display = '';
    if (btn) btn.textContent = '\\u25BE DETAILS';
  } else {
    el.style.display = 'none';
    if (btn) btn.textContent = '\\u25B8 DETAILS';
  }
}

/* ── Scroll-to-Draft Navigation ─────────────────── */

function scrollToDraft(draftId) {
  var card = document.querySelector('[data-draft-id="' + draftId + '"]');
  if (!card) return;
  // Expand detail panel if collapsed
  var detailDiv = card.querySelector('[id^="draft-detail-"]');
  if (detailDiv && detailDiv.style.display === 'none') {
    toggleDraftDetail(detailDiv.id);
  }
  // Scroll into view
  card.scrollIntoView({ behavior: 'smooth', block: 'center' });
  // Flash highlight
  card.style.transition = 'box-shadow .3s ease';
  card.style.boxShadow = '0 0 0 2px var(--accent-cyan), 0 0 16px rgba(0,212,200,.35)';
  setTimeout(function() {
    card.style.boxShadow = '';
    setTimeout(function() { card.style.transition = ''; }, 400);
  }, 1800);
}

/* ── Draft Edit Overlay ─────────────────────────── */

function draftEdit(draftId) {
  fetch(TF_API + '/api/drafts')
  .then(function(r){ return r.json(); })
  .then(function(d) {
    if (!d.ok) { alert('Error loading drafts'); return; }
    var draft = d.draft_tickets.find(function(dt){ return dt.id === draftId; });
    if (!draft) { alert('Draft not found'); return; }
    document.getElementById('de-id').textContent = draft.id;
    document.getElementById('de-id').setAttribute('data-id', draft.id);
    document.getElementById('de-title').value = draft.title || '';
    document.getElementById('de-goal').value = draft.goal || '';
    document.getElementById('de-phase').value = draft.phase || '';
    document.getElementById('de-order').value = draft.order || '';
    document.getElementById('de-area').value = draft.product_area || '';
    document.getElementById('de-parent').value = draft.parent_feature_id || '';
    document.getElementById('de-depends').value = (draft.depends_on || []).join(', ');
    document.getElementById('de-files').value = (draft.files_to_modify || []).join('\\n');
    document.getElementById('de-in-scope').value = (draft.in_scope || []).join('\\n');
    document.getElementById('de-out-scope').value = (draft.out_of_scope || []).join('\\n');
    document.getElementById('de-ac').value = (draft.acceptance_criteria || []).join('\\n');
    document.getElementById('de-tests').value = (draft.tests_to_add_or_update || []).join('\\n');
    document.getElementById('de-protocol').value = (draft.test_protocol || []).join('\\n');
    document.getElementById('de-checklist').value = (draft.validation_checklist || []).join('\\n');
    document.getElementById('de-post-val').value = (draft.post_validation_updates || []).join('\\n');
    document.getElementById('de-prompt').value = draft.canonical_implementation_prompt || '';
    document.getElementById('draft-edit-overlay').classList.add('open');
  })
  .catch(function(e){ alert('Error loading data: ' + e.message); });
}

function draftEditClose() {
  document.getElementById('draft-edit-overlay').classList.remove('open');
}

function draftEditSave() {
  var id = document.getElementById('de-id').getAttribute('data-id');
  function splitLines(elId) {
    return document.getElementById(elId).value.split('\\n').map(function(s){ return s.trim(); }).filter(Boolean);
  }
  var data = {
    title: document.getElementById('de-title').value.trim() || null,
    goal: document.getElementById('de-goal').value.trim() || null,
    phase: document.getElementById('de-phase').value.trim() || null,
    order: parseInt(document.getElementById('de-order').value, 10) || null,
    product_area: document.getElementById('de-area').value.trim() || null,
    parent_feature_id: document.getElementById('de-parent').value.trim() || null,
    depends_on: document.getElementById('de-depends').value.split(',').map(function(s){ return s.trim(); }).filter(Boolean),
    files_to_modify: splitLines('de-files'),
    in_scope: splitLines('de-in-scope'),
    out_of_scope: splitLines('de-out-scope'),
    acceptance_criteria: splitLines('de-ac'),
    tests_to_add_or_update: splitLines('de-tests'),
    test_protocol: splitLines('de-protocol'),
    validation_checklist: splitLines('de-checklist'),
    post_validation_updates: splitLines('de-post-val'),
    canonical_implementation_prompt: document.getElementById('de-prompt').value.trim() || null,
  };
  fetch(TF_API + '/api/drafts/' + encodeURIComponent(id), {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data)
  })
  .then(function(r){ return r.json(); })
  .then(function(d){
    if (d.ok) { showToast('Draft saved', 'success'); reloadKeepTab(); }
    else { alert('Error: ' + (d.errors||[]).join(', ')); }
  })
  .catch(function(e){ alert('Server not running? ' + e.message); });
}

document.getElementById('draft-edit-overlay').addEventListener('click', function(e) {
  if (e.target === this) draftEditClose();
});

function draftMarkReady(draftId) {
  var card = document.querySelector('[data-draft-id="' + draftId + '"]');
  if (card) card.style.opacity = '0.5';
  fetch(TF_API + '/api/drafts/' + encodeURIComponent(draftId) + '/mark-ready', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' }
  })
  .then(function(r){ return r.json(); })
  .then(function(d){
    if (card) card.style.opacity = '1';
    if (d.ok && d.ready) {
      showToast('\u2713 Ticket is ready for execution! Copilot prompt generated.', 'success');
      reloadKeepTab();
    } else if (d.issues && d.issues.length > 0) {
      alert('Cannot mark as ready — ' + d.issues.length + ' issue(s):\\n\\n- ' + d.issues.join('\\n- ') + '\\n\\nRefine the draft first to resolve these issues.');
    } else {
      alert('Error: ' + (d.errors || []).join(', '));
    }
  })
  .catch(function(e){
    if (card) card.style.opacity = '1';
    alert('Server not running? ' + e.message);
  });
}

function draftPromote(draftId) {
  if (!confirm('Promote draft ' + draftId + ' to an executable custom item?')) return;
  fetch(TF_API + '/api/drafts/' + encodeURIComponent(draftId) + '/promote', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' }
  })
  .then(function(r){ return r.json(); })
  .then(function(d){
    if (d.ok) {
      showToast('Promoted! New ticket: ' + (d.ticket && d.ticket.id || 'unknown'), 'success');
      reloadKeepTab();
    }
    else { alert('Error: ' + (d.errors||[]).join(', ')); }
  })
  .catch(function(e){ alert('Server not running? ' + e.message); });
}

function draftDelete(draftId) {
  if (!confirm('Delete draft ' + draftId + '?')) return;
  fetch(TF_API + '/api/drafts/' + encodeURIComponent(draftId), { method: 'DELETE' })
  .then(function(r){ return r.json(); })
  .then(function(d){
    if (d.ok) { showToast('Deleted ' + draftId, 'success'); reloadKeepTab(); }
    else { alert('Error: ' + (d.errors||[]).join(', ')); }
  })
  .catch(function(e){ alert('Server not running? ' + e.message); });
}

// Prompt G — Keep as One (override split recommendation)
function intakeKeepAsOne(intakeId) {
  fetch(TF_API + '/api/intake/' + encodeURIComponent(intakeId), {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ split_recommended: false, recommended_action: 'execute', triage_notes: 'User chose to keep as one ticket (override low-confidence split)' })
  })
  .then(function(r){ return r.json(); })
  .then(function(d){
    if (d.ok) { showToast('Kept ' + intakeId + ' as one ticket', 'info'); reloadKeepTab(); }
    else { alert('Error: ' + (d.errors||[]).join(', ')); }
  })
  .catch(function(e){ alert('Server not running? ' + e.message); });
}

// Prompt E — Story sync (call after draft promotion)
function draftStorySync(draftId) {
  fetch(TF_API + '/api/drafts/' + encodeURIComponent(draftId) + '/story-sync', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' }
  })
  .then(function(r){ return r.json(); })
  .then(function(d){
    if (d.ok && d.progress) {
      console.log('Story synced:', d.progress);
    }
  })
  .catch(function(e){ console.warn('Story sync failed:', e.message); });
}

// Prompt J — Next ticket selection
function showNextTicket() {
  fetch(TF_API + '/api/next-ticket')
  .then(function(r){ return r.json(); })
  .then(function(d){
    if (d.ok && d.selection && d.selection.ticket) {
      var t = d.selection.ticket;
      var msg = 'Next ticket: ' + (t.id || 'unknown') + '\\n' + (t.title || '') + '\\n\\nReason: ' + (d.selection.reason || '');
      if (d.selection.parent_context) {
        msg += '\\n\\nParent story: ' + (d.selection.parent_context.parent_story_id || '');
        if (d.selection.parent_context.story_progress) {
          msg += ' (' + d.selection.parent_context.story_progress.state + ' - ' + d.selection.parent_context.story_progress.progress_pct + '%)';
        }
      }
      alert(msg);
    } else {
      alert(d.selection ? d.selection.reason : 'No ticket selection available');
    }
  })
  .catch(function(e){ alert('Server not running? ' + e.message); });
}

</script>
</body>
</html>`;

  // Build the recommendations data object for API / file output
  const recsData = {
    recommendations: recommendations.map(function(r) {
      var tc = computeTestingCompleteness(r);
      return {
        id: r.id, rank: r.rank, title: r.title, phase: r.phase,
        type: r.type, column: r.column, isSlice: !!r.isSlice,
        isCustom: !!r.isCustom, parentId: r.parentId || null,
        parentTitle: r.parentTitle || null, reasons: r.reasons || [],
        unlocks: r.unlocks || 0, scopeFileCount: r.scopeFileCount || 0,
        movement: r.movement, movementLabel: r.movementLabel || "\u2014",
        hasCompleteTests: tc.score === tc.max,
        files: (r.files || []).slice(0, 5),
        blockedBy: r.blockedBy || [],
      };
    }),
    generated_at: now,
    total_in_queue: recsResult.total,
    next_id: recsResult.next ? recsResult.next.id : null,
  };

  return { html: htmlString, recsData: recsData };
}

// ─── Main ─────────────────────────────────────────────────────

function main() {
  console.log("\uD83D\uDD0D Reading ROADMAP.json...");
  if (!fs.existsSync(ROADMAP_PATH)) {
    console.error("\u274C ROADMAP.json not found at", ROADMAP_PATH);
    process.exit(1);
  }

  const roadmap = JSON.parse(fs.readFileSync(ROADMAP_PATH, "utf8"));

  console.log("\uD83D\uDCCA Reading codebase signals...");
  const schema = readSchema();
  const models = getModels(schema);
  const enums = getEnums(schema);
  const migrationCount = getMigrationCount();
  const workflows = getTsFiles(WORKFLOWS_DIR);
  const routes = getTsFiles(ROUTES_DIR);
  const services = getTsFiles(SERVICES_DIR);
  const envKeys = getEnvKeys();

  console.log(`   Models: ${models.length} \u00B7 Enums: ${enums.length} \u00B7 Migrations: ${migrationCount}`);
  console.log(`   Workflows: ${workflows.length} \u00B7 Routes: ${routes.length}`);

  const signals = { models, enums, schema, migrationCount, workflows, routes, services, envKeys };
  const git = getGitInfo();

  console.log("\u26A1 Generating HTML...");
  const result = generateHtml(roadmap, signals, git);

  const docsDir = path.dirname(OUTPUT_PATH);
  if (!fs.existsSync(docsDir)) fs.mkdirSync(docsDir, { recursive: true });

  fs.writeFileSync(OUTPUT_PATH, result.html, "utf8");
  console.log(`\u2705 Written \u2192 ${path.relative(ROOT, OUTPUT_PATH)}`);

  // Write recommendations JSON for API access
  const recsPath = path.join(path.dirname(OUTPUT_PATH), "roadmap-recs.json");
  fs.writeFileSync(recsPath, JSON.stringify(result.recsData, null, 2) + "\n", "utf8");
  console.log(`\u2705 Recommendations \u2192 ${path.relative(ROOT, recsPath)}`);

  // Save recommendations snapshot for movement tracking on next generation
  if (!roadmap._meta) roadmap._meta = { version: "2.0.0" };
  roadmap._meta.last_recommendations = result.recsData.recommendations.map(function(r) {
    return { id: r.id, rank: r.rank, title: r.title };
  });
  roadmap._meta.last_recommendations_at = result.recsData.generated_at;
  fs.writeFileSync(ROADMAP_PATH, JSON.stringify(roadmap, null, 2) + "\n", "utf8");
  console.log(`\u2705 Snapshot saved to ROADMAP.json _meta.last_recommendations`);
}

main();
