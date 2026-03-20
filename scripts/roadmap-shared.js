#!/usr/bin/env node
/**
 * roadmap-shared.js
 *
 * Canonical shared logic for the roadmap toolchain.
 * Single source of truth for:
 *   - Constants (phases, types, statuses, defaults)
 *   - ID generation
 *   - Post-validation target inference
 *   - Testing metadata defaults & backfill
 *   - Status-transition gate checks
 *   - Column assignment (kanban)
 *   - ROADMAP.json I/O
 *
 * Used by: generate-roadmap.js, roadmap-server.js, roadmap-ticket.js
 *
 * Browser code (inline in roadmap.html) mirrors inferPVTargets and gate
 * checks locally because it cannot require() Node modules.  Those mirrors
 * carry a comment pointing here as the canonical source.
 */

const fs = require("fs");
const path = require("path");

const ROOT = path.resolve(__dirname, "..");
const ROADMAP_PATH = path.join(ROOT, "ROADMAP.json");

// ─── Constants ────────────────────────────────────────────────

const VALID_PHASES = ["P0", "P1", "P2", "P3", "P4", "P5"];
const VALID_TYPES = ["user_story", "task", "bug", "spike"];
const VALID_STATUSES = ["planned", "in_progress", "done", "blocked"];

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

// ─── I/O ──────────────────────────────────────────────────────

function readRoadmap() {
  return JSON.parse(fs.readFileSync(ROADMAP_PATH, "utf8"));
}

function writeRoadmap(data) {
  fs.writeFileSync(ROADMAP_PATH, JSON.stringify(data, null, 2) + "\n", "utf8");
}

// ─── ID Generation ────────────────────────────────────────────

function generateId(type, items) {
  const prefixes = { user_story: "US", task: "TASK", bug: "BUG", spike: "SPK" };
  const prefix = prefixes[type] || "ITEM";
  const existing = items
    .map(function(i) { return i.id; })
    .filter(function(id) { return id.startsWith(prefix + "-"); })
    .map(function(id) { return parseInt(id.split("-")[1], 10) || 0; });
  const next = existing.length > 0 ? Math.max.apply(null, existing) + 1 : 1;
  return prefix + "-" + String(next).padStart(3, "0");
}

// ─── Post-Validation Target Inference ─────────────────────────
//
// Canonical version — used by generator, server, and mirrored in browser.
// Derives sensible default post-validation update targets based on the
// ticket's files_expected, type, and description.
//
// IMPORTANT: if you change this function, also update the browser mirror
// `inferPVTargets()` in generate-roadmap.js (inline <script> section).

function inferPostValidationTargets(files, type, description) {
  const targets = [];
  const allFiles = (files || []).map(function(f) { return f.toLowerCase(); });
  const desc = (description || "").toLowerCase();
  const ticketType = (type || "task").toLowerCase();

  const hasRoutes      = allFiles.some(function(f) { return f.includes("/routes/") || f.includes("routes."); });
  const hasServices    = allFiles.some(function(f) { return f.includes("/services/") || f.includes("service."); });
  const hasRepos       = allFiles.some(function(f) { return f.includes("/repositories/") || f.includes("repository."); });
  const hasWorkflows   = allFiles.some(function(f) { return f.includes("/workflows/") || f.includes("workflow."); });
  const hasSchema      = allFiles.some(function(f) { return f.includes("schema.prisma") || f.includes("/prisma/"); });
  const hasMigrations  = allFiles.some(function(f) { return f.includes("/migrations/"); });
  const hasAuth        = allFiles.some(function(f) { return f.includes("authz") || f.includes("auth.") || f.includes("/auth/"); });
  const hasDTO         = allFiles.some(function(f) { return f.includes("/dto") || f.includes("dto.") || f.includes("api-client") || f.includes("openapi"); });
  const hasBlueprint   = allFiles.some(function(f) { return f.includes("blueprint"); });
  const hasRoadmap     = allFiles.some(function(f) { return f.includes("roadmap") || f.includes("generate-roadmap") || f.includes("roadmap-server") || f.includes("roadmap-ticket"); });
  const hasWebPages    = allFiles.some(function(f) { return f.includes("apps/web/") || f.includes("/pages/"); });
  const hasTransitions = allFiles.some(function(f) { return f.includes("transitions"); });
  const hasEvents      = allFiles.some(function(f) { return f.includes("/events/") || f.includes("event."); });
  const hasTests       = allFiles.some(function(f) { return f.includes(".test.") || f.includes(".spec.") || f.includes("/__tests__/"); });
  const hasGovernance  = allFiles.some(function(f) { return f.includes("/governance/"); });
  const hasAuditArea   = desc.includes("audit") || desc.includes("finding") || desc.includes("security") || desc.includes("vulnerability");
  const isBackendChange = hasRoutes || hasServices || hasRepos || hasWorkflows || hasSchema || hasAuth || hasTransitions;

  targets.push("Run validation wizard: click \u2713 VALIDATE on ticket card (or: node scripts/roadmap-ticket.js validate <ID>)");
  if (isBackendChange || hasDTO || hasBlueprint) {
    targets.push("refresh docs/blueprint.html \u2014 cd apps/api && node blueprint.js");
  }
  targets.push("refresh docs/roadmap.html \u2014 node scripts/generate-roadmap.js");
  if (isBackendChange || hasAuth || hasGovernance || hasTransitions || hasEvents || ticketType === "spike") {
    targets.push("refresh PROJECT_STATE.md \u2014 update if architecture decisions, backlog, or layer rules changed");
  }
  if (hasAuth || hasRoutes || hasWorkflows || hasServices || hasRepos || hasGovernance) {
    targets.push("refresh apps/api/src/ARCHITECTURE_LOW_CONTEXT_GUIDE.md \u2014 update if auth helpers, layer rules, or quick reference touched");
  }
  if (hasAuditArea || hasAuth || hasGovernance || ticketType === "bug") {
    targets.push("refresh docs/AUDIT.md \u2014 mark resolved findings, add new findings if applicable");
  }
  if (hasSchema || hasMigrations) {
    targets.push("refresh SCHEMA_REFERENCE.md \u2014 update if Prisma schema changed (new models, fields, enums)");
  }
  if (hasDTO || hasRoutes || hasSchema) {
    targets.push("verify DTO / OpenAPI / api-client sync \u2014 if API shape changed, update all three together");
  }
  if (hasRoadmap) {
    targets.push("review roadmap tooling docs \u2014 update How to Use tab or generator comments if behavior changed");
  }
  if (hasWebPages) {
    targets.push("manual UI verification \u2014 check affected pages in browser at localhost:3000");
  }
  if (hasTests || isBackendChange) {
    targets.push("run full test suite \u2014 npx tsc --noEmit && cd apps/api && npm test");
  }
  targets.push("Commit checklist: npx tsc --noEmit \u2192 npm test \u2192 npm run blueprint");

  return targets;
}

// ─── Testing Metadata Backfill ────────────────────────────────
//
// Injects default testing metadata into custom items that lack it.
// Mutates items in-place for backward compatibility.
// Returns count of items patched.

function backfillTestingDefaults(customItems) {
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

// ─── Status-Transition Gate Checks ────────────────────────────
//
// Single source of truth for what testing metadata is required at each
// status level.  Returns an array of error messages (empty = valid).
//
// IMPORTANT: if you change these rules, also update the browser mirror
// `tfValidateClient()` in generate-roadmap.js (inline <script> section).

function validateStatusTransitionGates(ticket, newStatus) {
  const errors = [];
  if (newStatus === "in_progress") {
    if (!ticket.test_protocol || !(ticket.test_protocol || "").trim()) {
      errors.push("cannot mark in_progress without a test_protocol");
    }
    if (!ticket.required_tests || !Array.isArray(ticket.required_tests) || ticket.required_tests.length === 0) {
      errors.push("cannot mark in_progress without required_tests");
    }
  }
  if (newStatus === "done") {
    if (!ticket.validation_checklist || !Array.isArray(ticket.validation_checklist) || ticket.validation_checklist.length === 0) {
      errors.push("cannot mark done/validated without a validation_checklist");
    }
    if (!ticket.test_protocol || !(ticket.test_protocol || "").trim()) {
      errors.push("cannot mark done/validated without a test_protocol");
    }
    if (!ticket.required_tests || !Array.isArray(ticket.required_tests) || ticket.required_tests.length === 0) {
      errors.push("cannot mark done/validated without required_tests");
    }
  }
  return errors;
}

// ─── Validation Gate Check ────────────────────────────────────
//
// Gate check for the "validate" action — requires all four testing
// metadata fields.  Returns array of missing field names (empty = ready).

function validateGatesForValidation(ticket) {
  const missing = [];
  if (!ticket.test_protocol || !(ticket.test_protocol || "").trim()) missing.push("test_protocol");
  if (!ticket.required_tests || !Array.isArray(ticket.required_tests) || ticket.required_tests.length === 0) missing.push("required_tests");
  if (!ticket.validation_checklist || !Array.isArray(ticket.validation_checklist) || ticket.validation_checklist.length === 0) missing.push("validation_checklist");
  if (!ticket.post_validation || !Array.isArray(ticket.post_validation) || ticket.post_validation.length === 0) missing.push("post_validation");
  return missing;
}

// ─── Column Assignment ────────────────────────────────────────
//
// Determines kanban column for any backlog item.
// Handles both auto-detected items (computedStatus is never "blocked")
// and custom items (may have explicit "blocked" status).

function assignColumn(computedStatus, dependsOn, statusMap) {
  if (computedStatus === "done") return "done";
  if (computedStatus === "in_progress") return "in_progress";
  if (computedStatus === "blocked") return "blocked";
  const deps = dependsOn || [];
  const allDepsDone = deps.length === 0 || deps.every(function(d) { return statusMap[d] === "done"; });
  if (!allDepsDone) return "blocked";
  return "ready";
}

// ─── Exports ──────────────────────────────────────────────────

module.exports = {
  ROOT,
  ROADMAP_PATH,
  VALID_PHASES,
  VALID_TYPES,
  VALID_STATUSES,
  DEFAULT_TEST_PROTOCOL,
  DEFAULT_VALIDATION_CHECKLIST,
  readRoadmap,
  writeRoadmap,
  generateId,
  inferPostValidationTargets,
  backfillTestingDefaults,
  validateStatusTransitionGates,
  validateGatesForValidation,
  assignColumn,
};
