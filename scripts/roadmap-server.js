#!/usr/bin/env node
/**
 * roadmap-server.js
 *
 * Minimal local write-back server for the roadmap toolchain.
 * Serves the generated roadmap.html and provides a REST API
 * that writes ticket mutations directly to ROADMAP.json,
 * then regenerates roadmap.html in-process.
 *
 * ROADMAP.json remains the single source of truth — no parallel DB.
 *
 * Endpoints:
 *   GET  /                    → serves docs/roadmap.html
 *   GET  /api/roadmap         → full ROADMAP.json (for form population)
 *   GET  /api/tickets         → list custom_items[]
 *   POST /api/tickets         → create a new ticket
 *   PUT  /api/tickets/:id     → update an existing ticket
 *   POST /api/tickets/:id/dup → duplicate a ticket
 *   POST /api/tickets/:id/validate → validate ticket + context refresh + mark done
 *   POST /api/tickets/:id/infer-targets → infer post-validation update targets from files + type
 *   DELETE /api/tickets/:id   → remove a ticket
 *   POST /api/context-refresh → run blueprint + roadmap regeneration
 *   POST /api/recommendations → regenerate + return ranked top-5 with movement
 *   POST /api/regenerate      → regenerate roadmap.html without mutation
 *   GET  /api/intake          → list intake_items[] + draft_tickets[]
 *   POST /api/intake          → create a new intake item
 *   POST /api/intake/parse    → parse unstructured text → atomic intake items (no persist)
 *   POST /api/intake/bulk-ingest → full pipeline: parse → create → triage → draft (Prompt H)
 *   POST /api/intake/auto-triage → batch auto-triage all raw/triaged intake items
 *   PUT  /api/intake/:id      → update an intake item
 *   GET  /api/intake/:id/clarify-questions → generate 1-3 targeted clarify questions
 *   PUT  /api/intake/:id/clarify → save clarify context, re-triage, parse answer → transition to triaged
 *   DELETE /api/intake/:id    → delete an intake item
 *   POST /api/intake/:id/triage → triage intake into concerns → draft tickets
 *   PUT  /api/drafts/:id      → update a draft ticket
 *   DELETE /api/drafts/:id    → delete a draft ticket
 *   POST /api/drafts/:id/refine  → enrich draft with project context
 *   POST /api/drafts/:id/promote → promote draft → executable custom item
 *
 * After any mutation, roadmap.html is regenerated and the response
 * includes { ok: true, ticket: {...}, regenerated: true }.
 *
 * Usage:
 *   node scripts/roadmap-server.js          # port 8111
 *   ROADMAP_PORT=9000 node scripts/roadmap-server.js
 */

const http = require("http");
const fs = require("fs");
const path = require("path");
const { execSync } = require("child_process");
const shared = require("./roadmap-shared");
const parser = require("./roadmap-parser");

const ROOT = path.resolve(__dirname, "..");
const ROADMAP_PATH = path.join(ROOT, "ROADMAP.json");
const HTML_PATH = path.join(ROOT, "docs", "roadmap.html");
const GENERATOR = path.join(ROOT, "scripts", "generate-roadmap.js");
const PORT = parseInt(process.env.ROADMAP_PORT || "8111", 10);

// ─── Helpers ──────────────────────────────────────────────────

function readRoadmap() {
  return JSON.parse(fs.readFileSync(ROADMAP_PATH, "utf8"));
}

function writeRoadmap(data) {
  fs.writeFileSync(ROADMAP_PATH, JSON.stringify(data, null, 2) + "\n", "utf8");
}

function regenerate() {
  try {
    execSync("node " + JSON.stringify(GENERATOR), {
      cwd: ROOT,
      stdio: "pipe",
      timeout: 30000,
    });
    return true;
  } catch (e) {
    console.error("⚠ Regeneration failed:", e.message);
    return false;
  }
}

function runContextRefresh() {
  var results = [];

  // 1. Blueprint regeneration (apps/api/blueprint.js → docs/blueprint.html)
  try {
    execSync("node blueprint.js", {
      cwd: path.join(ROOT, "apps", "api"),
      stdio: "pipe",
      timeout: 30000,
    });
    results.push({ target: "docs/blueprint.html", status: "ok", method: "auto" });
  } catch (e) {
    results.push({ target: "docs/blueprint.html", status: "error", method: "auto", error: e.message });
  }

  // 2. Roadmap regeneration
  var roadmapOk = regenerate();
  results.push({ target: "docs/roadmap.html", status: roadmapOk ? "ok" : "error", method: "auto" });

  // 3. Manual review targets (cannot be auto-refreshed)
  var manualTargets = [
    { file: "PROJECT_STATE.md", reason: "Update backlog, epic history, and guardrails if architecture decisions changed" },
    { file: "apps/api/src/ARCHITECTURE_LOW_CONTEXT_GUIDE.md", reason: "Update auth helpers, layer rules, or quick reference if touched" },
    { file: "docs/AUDIT.md", reason: "Mark resolved findings, add new findings if any" },
    { file: "SCHEMA_REFERENCE.md", reason: "Update if Prisma schema changed (new models, fields, enums)" },
  ];

  return { automated: results, manual_review: manualTargets };
}

function jsonResponse(res, status, data) {
  res.writeHead(status, {
    "Content-Type": "application/json",
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type",
  });
  res.end(JSON.stringify(data));
}

function readBody(req) {
  return new Promise(function (resolve, reject) {
    let body = "";
    req.on("data", function (chunk) { body += chunk; });
    req.on("end", function () {
      try { resolve(JSON.parse(body)); }
      catch (e) { reject(new Error("Invalid JSON")); }
    });
    req.on("error", reject);
  });
}

// ─── Validation ───────────────────────────────────────────────

// Canonical constants — single source of truth in roadmap-shared.js
const VALID_PHASES = shared.VALID_PHASES;
const VALID_TYPES = shared.VALID_TYPES;
const VALID_STATUSES = shared.VALID_STATUSES;

function validateTicket(data, roadmap, isUpdate) {
  const errors = [];

  // Collect all known IDs for dependency validation
  const knownIds = new Set();
  for (const f of (roadmap.features || [])) {
    knownIds.add(f.id);
    for (const s of (f.slices || [])) knownIds.add(s.id);
  }
  for (const c of (roadmap.custom_items || [])) knownIds.add(c.id);

  if (!isUpdate && !data.id) errors.push("id is required");
  if (!data.title || !data.title.trim()) errors.push("title is required");
  if (!data.phase) errors.push("phase is required");
  else if (!VALID_PHASES.includes(data.phase)) errors.push("phase must be one of: " + VALID_PHASES.join(", "));
  if (!data.type) errors.push("type is required");
  else if (!VALID_TYPES.includes(data.type)) errors.push("type must be one of: " + VALID_TYPES.join(", "));
  if (data.status && !VALID_STATUSES.includes(data.status)) errors.push("status must be one of: " + VALID_STATUSES.join(", "));

  if (data.order === undefined || data.order === null || data.order === "") {
    errors.push("order/sequence is required (integer)");
  } else if (typeof data.order !== "number" || !Number.isInteger(data.order)) {
    errors.push("order must be an integer");
  }

  // Acceptance criteria
  if (!data.acceptance_criteria || !Array.isArray(data.acceptance_criteria) || data.acceptance_criteria.length === 0) {
    errors.push("acceptance_criteria is required (at least one criterion)");
  }

  // Test requirements (tests_to_add_or_update)
  if (!data.required_tests || !Array.isArray(data.required_tests) || data.required_tests.length === 0) {
    errors.push("required_tests is required (at least one test requirement)");
  }

  // Test protocol
  if (!data.test_protocol || !data.test_protocol.trim()) {
    errors.push("test_protocol is required");
  }

  // Validation checklist
  if (!data.validation_checklist || !Array.isArray(data.validation_checklist) || data.validation_checklist.length === 0) {
    errors.push("validation_checklist is required (at least one completion gate)");
  }

  // Post-validation
  if (!data.post_validation || !Array.isArray(data.post_validation) || data.post_validation.length === 0) {
    errors.push("post_validation is required (at least one step)");
  }

  // ── Status-transition gates (canonical logic in roadmap-shared.js) ──
  errors.push(...shared.validateStatusTransitionGates(data, data.status));

  // Dependency references must be valid
  if (data.depends_on && Array.isArray(data.depends_on)) {
    for (const dep of data.depends_on) {
      // During creation, skip the item's own ID
      if (!knownIds.has(dep) && dep !== data.id) {
        errors.push("dependency '" + dep + "' is not a known feature/slice/ticket ID");
      }
    }
  }

  // Parent feature must be valid
  if (data.parent_feature) {
    const parentExists = (roadmap.features || []).some(function (f) { return f.id === data.parent_feature; });
    if (!parentExists) {
      errors.push("parent_feature '" + data.parent_feature + "' is not a known feature ID");
    }
  }

  return errors;
}

// ─── ID Generation ────────────────────────────────────────────

// Delegated to shared module — single source of truth
const generateId = shared.generateId;

// ─── Route Handlers ───────────────────────────────────────────

function handleGetRoadmap(req, res) {
  const roadmap = readRoadmap();
  jsonResponse(res, 200, roadmap);
}

function handleListTickets(req, res) {
  const roadmap = readRoadmap();
  jsonResponse(res, 200, { tickets: roadmap.custom_items || [] });
}

function handleCreateTicket(req, res) {
  return readBody(req).then(function (data) {
    const roadmap = readRoadmap();
    if (!roadmap.custom_items) roadmap.custom_items = [];

    // Auto-generate ID if not provided
    if (!data.id) {
      data.id = generateId(data.type || "task", roadmap.custom_items);
    }

    // Check for duplicate ID
    const exists = roadmap.custom_items.some(function (c) { return c.id === data.id; });
    if (exists) {
      return jsonResponse(res, 409, { ok: false, errors: ["Ticket with ID '" + data.id + "' already exists"] });
    }

    // Validate
    const errors = validateTicket(data, roadmap, false);
    if (errors.length > 0) {
      return jsonResponse(res, 400, { ok: false, errors: errors });
    }

    // Build the ticket object with all fields
    const ticket = {
      id: data.id,
      phase: data.phase,
      title: data.title.trim(),
      type: data.type || "task",
      status: data.status || "planned",
      description: (data.description || "").trim(),
      order: data.order,
      acceptance_criteria: data.acceptance_criteria,
      required_tests: data.required_tests,
      test_protocol: data.test_protocol,
      validation_checklist: data.validation_checklist || [],
      post_validation: data.post_validation,
    };

    // Optional fields
    if (data.persona) ticket.persona = data.persona;
    if (data.ticket) ticket.ticket = data.ticket;
    if (data.notes) ticket.notes = data.notes;
    if (data.depends_on && data.depends_on.length > 0) ticket.depends_on = data.depends_on;
    if (data.parent_feature) ticket.parent_feature = data.parent_feature;
    if (data.files_expected && data.files_expected.length > 0) ticket.files_expected = data.files_expected;

    roadmap.custom_items.push(ticket);
    writeRoadmap(roadmap);

    const regenerated = regenerate();
    jsonResponse(res, 201, { ok: true, ticket: ticket, regenerated: regenerated });
  }).catch(function (e) {
    jsonResponse(res, 400, { ok: false, errors: [e.message] });
  });
}

function handleUpdateTicket(req, res, ticketId) {
  return readBody(req).then(function (data) {
    const roadmap = readRoadmap();
    if (!roadmap.custom_items) roadmap.custom_items = [];

    const idx = roadmap.custom_items.findIndex(function (c) { return c.id === ticketId; });
    if (idx === -1) {
      return jsonResponse(res, 404, { ok: false, errors: ["Ticket '" + ticketId + "' not found"] });
    }

    // Merge data onto existing ticket
    const existing = roadmap.custom_items[idx];
    const merged = Object.assign({}, existing, data, { id: ticketId }); // id cannot change

    // Validate merged result
    const errors = validateTicket(merged, roadmap, true);
    if (errors.length > 0) {
      return jsonResponse(res, 400, { ok: false, errors: errors });
    }

    roadmap.custom_items[idx] = merged;
    writeRoadmap(roadmap);

    const regenerated = regenerate();
    jsonResponse(res, 200, { ok: true, ticket: merged, regenerated: regenerated });
  }).catch(function (e) {
    jsonResponse(res, 400, { ok: false, errors: [e.message] });
  });
}

function handleDuplicateTicket(req, res, ticketId) {
  const roadmap = readRoadmap();
  if (!roadmap.custom_items) roadmap.custom_items = [];

  const source = roadmap.custom_items.find(function (c) { return c.id === ticketId; });
  if (!source) {
    return jsonResponse(res, 404, { ok: false, errors: ["Ticket '" + ticketId + "' not found"] });
  }

  const newId = generateId(source.type || "task", roadmap.custom_items);
  const dup = Object.assign({}, source, {
    id: newId,
    title: source.title + " (copy)",
    status: "planned",
  });

  roadmap.custom_items.push(dup);
  writeRoadmap(roadmap);

  const regenerated = regenerate();
  jsonResponse(res, 201, { ok: true, ticket: dup, regenerated: regenerated });
}

function handleDeleteTicket(req, res, ticketId) {
  const roadmap = readRoadmap();
  if (!roadmap.custom_items) roadmap.custom_items = [];

  const idx = roadmap.custom_items.findIndex(function (c) { return c.id === ticketId; });
  if (idx === -1) {
    return jsonResponse(res, 404, { ok: false, errors: ["Ticket '" + ticketId + "' not found"] });
  }

  const removed = roadmap.custom_items.splice(idx, 1)[0];
  writeRoadmap(roadmap);

  const regenerated = regenerate();
  jsonResponse(res, 200, { ok: true, removed: removed, regenerated: regenerated });
}

function handleRegenerate(req, res) {
  const regenerated = regenerate();
  if (regenerated) {
    jsonResponse(res, 200, { ok: true, regenerated: true });
  } else {
    jsonResponse(res, 500, { ok: false, errors: ["Regeneration failed"] });
  }
}

function handleValidateTicket(req, res, ticketId) {
  return readBody(req).then(function (data) {
    var roadmap = readRoadmap();
    if (!roadmap.custom_items) roadmap.custom_items = [];

    var idx = roadmap.custom_items.findIndex(function (c) { return c.id === ticketId; });
    if (idx === -1) {
      return jsonResponse(res, 404, { ok: false, errors: ["Ticket '" + ticketId + "' not found"] });
    }

    var ticket = roadmap.custom_items[idx];

    // Gate checks (canonical logic in roadmap-shared.js)
    var gateMissing = shared.validateGatesForValidation(ticket);
    if (gateMissing.length > 0) {
      return jsonResponse(res, 400, { ok: false, errors: gateMissing.map(function(m) { return m + " is missing"; }), gate: "validation_prerequisites" });
    }

    // Caller must confirm protocol + checklist were verified
    if (!data.protocol_confirmed) {
      return jsonResponse(res, 400, { ok: false, errors: ["protocol_confirmed must be true — confirm test protocol first"], gate: "protocol" });
    }
    if (!data.checklist_confirmed) {
      return jsonResponse(res, 400, { ok: false, errors: ["checklist_confirmed must be true — confirm validation checklist first"], gate: "checklist" });
    }

    // Run context refresh (blueprint + roadmap + manual targets)
    var refreshResults = runContextRefresh();

    // Compute post-validation targets (explicit or inferred)
    var pvTargets = (ticket.post_validation && ticket.post_validation.length > 0)
      ? ticket.post_validation
      : inferPostValidationTargetsServer(ticket.files_expected || [], ticket.type || "task", ticket.description || "");
    var pvInferred = !(ticket.post_validation && ticket.post_validation.length > 0);

    // Mark ticket as done + record validation timestamp
    ticket.status = "done";
    ticket.validated_at = new Date().toISOString();
    roadmap.custom_items[idx] = ticket;
    writeRoadmap(roadmap);

    jsonResponse(res, 200, {
      ok: true,
      ticket: ticket,
      refresh: refreshResults,
      post_validation_targets: pvTargets,
      targets_inferred: pvInferred,
      regenerated: true,
    });
  }).catch(function (e) {
    jsonResponse(res, 400, { ok: false, errors: [e.message] });
  });
}

// ─── Intake Handlers ──────────────────────────────────────────
//
// Lifecycle: raw → triaged → drafted → promoted | parked | duplicate
//
//   raw:       freshly pasted, unprocessed
//   triaged:   product_area + proposed_phase assigned, concerns extracted
//   drafted:   one or more DT-xxx draft tickets generated from this item
//   promoted:  all linked drafts promoted to executable custom_items[]
//   parked:    intentionally deferred — may be revisited later
//   duplicate: identified as duplicate of existing feature/ticket
//
// A raw intake item should NEVER automatically become executable unless
// it is clearly atomic and sufficiently scoped.

var INTAKE_STATUSES = ["capture", "clarify", "review", "promoted", "parked", "duplicate"];
var DRAFT_STATUSES  = ["review", "ready", "promoted", "discarded"];

function generateIntakeId(items) {
  var nums = items.map(function(i) { return parseInt((i.id || "").replace("INT-", ""), 10) || 0; });
  var next = nums.length > 0 ? Math.max.apply(null, nums) + 1 : 1;
  return "INT-" + String(next).padStart(3, "0");
}

function generateDraftId(items) {
  var nums = items.map(function(i) { return parseInt((i.id || "").replace("DT-", ""), 10) || 0; });
  var next = nums.length > 0 ? Math.max.apply(null, nums) + 1 : 1;
  return "DT-" + String(next).padStart(3, "0");
}

/** Default shape for a new intake item — all optional fields included */
function intakeDefaults() {
  return {
    id: null,
    title: null,
    raw_text: "",
    status: "capture",
    source: "manual_paste",
    product_area: null,
    related_feature_ids: [],
    proposed_phase: null,
    dependencies: [],
    split_recommended: false,
    draft_ticket_ids: [],
    triage_notes: "",
    constraints: [],
    recommended_action: null,
    scope_size: null,
    proposed_parent_feature: null,
    proposed_split_plan: [],
    note_type: null,
    duplicate_of: null,
    created_at: "",
    updated_at: "",
  };
}

/** Default shape for a new draft ticket — all optional fields included */
function draftDefaults() {
  return {
    id: null,
    source_intake_ids: [],
    title: "",
    goal: "",
    phase: null,
    order: null,
    status: "review",
    product_area: "",
    parent_feature_id: null,
    depends_on: [],
    files_to_modify: [],
    files_to_inspect: [],
    in_scope: [],
    out_of_scope: [],
    acceptance_criteria: [],
    tests_to_add_or_update: [],
    test_protocol: [],
    validation_checklist: [],
    post_validation_updates: [],
    canonical_implementation_prompt: "",
    // Story context fields (populated by refine)
    parent_story_id: null,
    parent_story_title: null,
    parent_story_raw_text: null,
    sibling_ticket_ids: [],
    slice_rationale: null,
    sequence_role: null,
    story_intent: null,
    story_success_outcome: null,
    implementation_shape: null,
    risk_notes: [],
    context_bundle: null,
    // Testing metadata (enriched by refine)
    tests_to_add: [],
    tests_to_update: [],
    regression_checks: [],
    // Refinement tracking
    refinement_status: "unrefined",
    refinement_notes: [],
    refined_at: null,
  };
}

function handleListIntake(req, res) {
  var roadmap = readRoadmap();
  jsonResponse(res, 200, {
    ok: true,
    intake_items: roadmap.intake_items || [],
    draft_tickets: roadmap.draft_tickets || [],
  });
}

function handleCreateIntake(req, res) {
  return readBody(req).then(function(data) {
    if (!data.raw_text || !data.raw_text.trim()) {
      return jsonResponse(res, 400, { ok: false, errors: ["raw_text is required"] });
    }
    var roadmap = readRoadmap();
    if (!roadmap.intake_items) roadmap.intake_items = [];

    var now = new Date().toISOString();
    var item = Object.assign(intakeDefaults(), {
      id: generateIntakeId(roadmap.intake_items),
      raw_text: data.raw_text.trim(),
      source: (data.source || "manual_paste").trim(),
      status: "capture",
      created_at: now,
      updated_at: now,
    });
    // Apply any optional fields from the request
    if (data.title) item.title = data.title.trim();
    if (data.product_area) item.product_area = data.product_area;
    if (data.related_feature_ids) item.related_feature_ids = data.related_feature_ids;
    if (data.proposed_phase) item.proposed_phase = data.proposed_phase;
    if (data.dependencies) item.dependencies = data.dependencies;
    if (data.constraints) item.constraints = data.constraints;

    roadmap.intake_items.push(item);
    writeRoadmap(roadmap);
    var regenerated = regenerate();
    jsonResponse(res, 201, { ok: true, item: item, regenerated: regenerated });
  }).catch(function(e) {
    jsonResponse(res, 400, { ok: false, errors: [e.message] });
  });
}

function handleParseIntake(req, res) {
  return readBody(req).then(function(data) {
    if (!data.text || !data.text.trim()) {
      return jsonResponse(res, 400, { ok: false, errors: ["text is required"] });
    }
    var opts = {};
    if (data.source) opts.source = data.source;
    if (data.product_area) opts.product_area = data.product_area;
    var items = parser.parseIntakeBlob(data.text, opts);
    jsonResponse(res, 200, { ok: true, items: items, count: items.length });
  }).catch(function(e) {
    jsonResponse(res, 400, { ok: false, errors: [e.message] });
  });
}

/**
 * Prompt H — Full bulk ingestion pipeline.
 * Parses raw text → creates intake items → auto-triages each → auto-drafts executable items.
 * Preserves parent-story coherence for splits; uses anti-over-splitting heuristics.
 *
 * POST /api/intake/bulk-ingest
 * Body: { text: "...", source?: "...", product_area?: "..." }
 */
function handleBulkIngest(req, res) {
  return readBody(req).then(function(data) {
    if (!data.text || !data.text.trim()) {
      return jsonResponse(res, 400, { ok: false, errors: ["text is required"] });
    }
    var opts = {};
    if (data.source) opts.source = data.source;
    if (data.product_area) opts.product_area = data.product_area;

    // Phase 1: Parse into intake items
    var parsedItems = parser.parseIntakeBlob(data.text, opts);
    if (parsedItems.length === 0) {
      return jsonResponse(res, 200, { ok: true, items: [], drafts: [], summary: { parsed: 0, created: 0, triaged: 0, drafted: 0, split: 0, parked: 0, duplicate: 0 } });
    }

    var roadmap = readRoadmap();
    if (!roadmap.intake_items) roadmap.intake_items = [];
    if (!roadmap.draft_tickets) roadmap.draft_tickets = [];

    var context = {
      features: roadmap.features || [],
      custom_items: roadmap.custom_items || [],
      intake_items: roadmap.intake_items,
    };

    var summary = { parsed: parsedItems.length, created: 0, triaged: 0, drafted: 0, split: 0, parked: 0, duplicate: 0 };
    var createdItems = [];
    var createdDrafts = [];

    for (var pi = 0; pi < parsedItems.length; pi++) {
      var parsed = parsedItems[pi];
      var now = new Date().toISOString();
      // Phase 2: Create intake item
      var item = Object.assign(intakeDefaults(), {
        id: generateIntakeId(roadmap.intake_items),
        raw_text: parsed.raw_text || "",
        title: parsed.title || "",
        source: parsed.source || opts.source || "bulk_ingest",
        product_area: parsed.product_area || opts.product_area || "",
        note_type: parsed.note_type || null,
        dependencies: parsed.dependencies || [],
        split_recommended: parsed.split_recommended || false,
        section_heading: parsed.section_heading || null,
        created_at: now,
        updated_at: now,
      });
      roadmap.intake_items.push(item);
      // Update context for subsequent items
      context.intake_items = roadmap.intake_items;
      summary.created++;

      // Phase 3: Auto-triage
      var triageResult = parser.triageIntakeItem(item, context);
      item.recommended_action = triageResult.recommended_action;
      item.scope_size = triageResult.scope_size;
      item.proposed_phase = triageResult.proposed_phase || item.proposed_phase;
      item.proposed_parent_feature = triageResult.proposed_parent_feature;
      item.proposed_split_plan = triageResult.proposed_split_plan;
      item.triage_notes = triageResult.triage_notes;
      item.related_feature_ids = triageResult.related_feature_ids;
      item.dependencies = triageResult.dependencies || item.dependencies;
      item.product_area = triageResult.product_area || item.product_area;
      item.note_type = triageResult.note_type || item.note_type;
      item.duplicate_of = triageResult.duplicate_of;
      if (triageResult.split_confidence) item.split_confidence = triageResult.split_confidence;
      if (triageResult.split_strategy) item.split_strategy = triageResult.split_strategy;
      if (triageResult.why_not_one_ticket) item.why_not_one_ticket = triageResult.why_not_one_ticket;
      if (triageResult.anti_split_reasons) item.anti_split_reasons = triageResult.anti_split_reasons;
      item.status = "clarify";
      item.updated_at = new Date().toISOString();
      summary.triaged++;

      // Phase 4: Handle based on recommended action
      if (triageResult.recommended_action === "duplicate") {
        item.status = "duplicate";
        summary.duplicate++;
        createdItems.push(item);
        continue;
      }
      if (triageResult.recommended_action === "park") {
        item.status = "parked";
        summary.parked++;
        createdItems.push(item);
        continue;
      }

      // Phase 5: Auto-draft — split items become multiple drafts; others become one
      var shouldSplit = triageResult.recommended_action === "split"
        && triageResult.proposed_split_plan
        && triageResult.proposed_split_plan.length >= 2;

      if (shouldSplit) {
        // Use promoteIntakeItem to produce split drafts with full context
        var triage = {
          recommended_action: "split",
          scope_size: item.scope_size,
          proposed_phase: item.proposed_phase,
          proposed_parent_feature: item.proposed_parent_feature,
          proposed_split_plan: triageResult.proposed_split_plan,
          triage_notes: item.triage_notes,
          related_feature_ids: item.related_feature_ids || [],
          dependencies: item.dependencies || [],
          product_area: item.product_area,
          note_type: item.note_type,
          duplicate_of: null,
        };
        var promoteResult = parser.promoteIntakeItem(item, triage, context);
        var splitDrafts = [];
        for (var di = 0; di < promoteResult.drafts.length; di++) {
          var spec = promoteResult.drafts[di];
          var draft = Object.assign(draftDefaults(), spec, {
            id: generateDraftId(roadmap.draft_tickets.concat(createdDrafts).concat(splitDrafts)),
          });
          splitDrafts.push(draft);
        }
        roadmap.draft_tickets = roadmap.draft_tickets.concat(splitDrafts);
        createdDrafts = createdDrafts.concat(splitDrafts);
        item.draft_ticket_ids = splitDrafts.map(function(d) { return d.id; });
        item.status = "review";
        summary.split++;
        summary.drafted += splitDrafts.length;
      } else if (triageResult.recommended_action === "execute" || triageResult.recommended_action === "attach") {
        // Create a single draft ticket
        var singleDraft = Object.assign(draftDefaults(), {
          id: generateDraftId(roadmap.draft_tickets.concat(createdDrafts)),
          source_intake_ids: [item.id],
          title: item.title || "(untitled)",
          goal: item.triage_notes || item.raw_text.substring(0, 200),
          phase: item.proposed_phase || null,
          order: 1,
          status: "review",
          product_area: item.product_area || "",
          parent_feature_id: (item.related_feature_ids && item.related_feature_ids[0]) || null,
          depends_on: item.dependencies || [],
        });
        roadmap.draft_tickets.push(singleDraft);
        createdDrafts.push(singleDraft);
        item.draft_ticket_ids = [singleDraft.id];
        item.status = "review";
        summary.drafted++;
      } else if (triageResult.recommended_action === "blocked") {
        // Create draft but mark as blocked
        var blockedDraft = Object.assign(draftDefaults(), {
          id: generateDraftId(roadmap.draft_tickets.concat(createdDrafts)),
          source_intake_ids: [item.id],
          title: item.title || "(untitled)",
          goal: item.triage_notes || item.raw_text.substring(0, 200),
          phase: item.proposed_phase || null,
          order: 1,
          status: "blocked",
          product_area: item.product_area || "",
          parent_feature_id: (item.related_feature_ids && item.related_feature_ids[0]) || null,
          depends_on: item.dependencies || [],
        });
        roadmap.draft_tickets.push(blockedDraft);
        createdDrafts.push(blockedDraft);
        item.draft_ticket_ids = [blockedDraft.id];
        item.status = "review";
        summary.drafted++;
      }

      item.updated_at = new Date().toISOString();
      createdItems.push(item);
    }

    writeRoadmap(roadmap);
    var regenerated = regenerate();

    jsonResponse(res, 200, {
      ok: true,
      items: createdItems,
      drafts: createdDrafts,
      summary: summary,
      regenerated: regenerated,
    });
  }).catch(function(e) {
    jsonResponse(res, 400, { ok: false, errors: [e.message] });
  });
}

/**
 * Generate 1–3 targeted clarify questions for an intake item.
 * Inspects the item's current state and the roadmap context to find gaps.
 *
 * GET /api/intake/:id/clarify-questions
 */
function handleClarifyQuestions(req, res, intakeId) {
  var roadmap = readRoadmap();
  if (!roadmap.intake_items) roadmap.intake_items = [];

  var item = roadmap.intake_items.find(function(i) { return i.id === intakeId; });
  if (!item) return jsonResponse(res, 404, { ok: false, errors: ["Intake '" + intakeId + "' not found"] });

  var context = {
    features: roadmap.features || [],
    custom_items: roadmap.custom_items || [],
    intake_items: roadmap.intake_items,
  };

  var result = parser.generateClarifyQuestions(item, context);
  jsonResponse(res, 200, { ok: true, questions: result.questions, summary: result.summary });
}

/**
 * Save clarify context from Stage 2 of the pipeline.
 * After saving context to triage_notes:
 *   1. Re-runs triageIntakeItem with the enriched item
 *   2. Applies all triage fields
 *   3. Parses the user's free-text answer to fill specific fields
 *   4. Sets status = "clarify"
 *   5. Writes and regenerates
 *
 * PUT /api/intake/:id/clarify
 * Body: { context: "user's answer text", questions: [...] }
 */
function handleClarifyIntake(req, res, intakeId) {
  return readBody(req).then(function(data) {
    if (!data.context || !data.context.trim()) {
      return jsonResponse(res, 400, { ok: false, errors: ["context is required"] });
    }
    var roadmap = readRoadmap();
    if (!roadmap.intake_items) roadmap.intake_items = [];

    var idx = roadmap.intake_items.findIndex(function(i) { return i.id === intakeId; });
    if (idx === -1) return jsonResponse(res, 404, { ok: false, errors: ["Intake '" + intakeId + "' not found"] });

    var item = roadmap.intake_items[idx];

    // Step 1: Append context to triage_notes
    var existing = (item.triage_notes || "").trim();
    item.triage_notes = existing ? existing + " | " + data.context.trim() : data.context.trim();

    // Step 2: Re-run triage with enriched item
    var context = {
      features: roadmap.features || [],
      custom_items: roadmap.custom_items || [],
      intake_items: roadmap.intake_items,
    };
    var triageResult = parser.triageIntakeItem(item, context);

    // Step 3: Apply triage fields (only fill empty fields)
    if (!item.recommended_action) item.recommended_action = triageResult.recommended_action;
    if (!item.scope_size) item.scope_size = triageResult.scope_size;
    if (!item.proposed_phase) item.proposed_phase = triageResult.proposed_phase;
    if (!item.proposed_parent_feature) item.proposed_parent_feature = triageResult.proposed_parent_feature;
    if (!item.proposed_split_plan || item.proposed_split_plan.length === 0) item.proposed_split_plan = triageResult.proposed_split_plan;
    if (!item.related_feature_ids || item.related_feature_ids.length === 0) item.related_feature_ids = triageResult.related_feature_ids;
    if (!item.dependencies || item.dependencies.length === 0) item.dependencies = triageResult.dependencies;
    if (!item.product_area) item.product_area = triageResult.product_area;
    if (!item.note_type) item.note_type = triageResult.note_type;
    if (!item.duplicate_of) item.duplicate_of = triageResult.duplicate_of;
    if (triageResult.split_confidence && !item.split_confidence) item.split_confidence = triageResult.split_confidence;
    if (triageResult.split_strategy && !item.split_strategy) item.split_strategy = triageResult.split_strategy;

    // Step 4: Parse answer into specific fields
    // Re-generate (or use provided) questions to know which fills apply
    var questions = data.questions;
    if (!questions || questions.length === 0) {
      var qResult = parser.generateClarifyQuestions(item, context);
      questions = qResult.questions;
    }
    var fieldsFilled = parser.parseAnswerIntoFields(data.context, questions, item, context);

    // Step 5: Set status and timestamp
    item.status = "clarify";
    item.updated_at = new Date().toISOString();

    roadmap.intake_items[idx] = item;
    writeRoadmap(roadmap);
    var regenerated = regenerate();
    jsonResponse(res, 200, {
      ok: true,
      item: item,
      triage: triageResult,
      fields_filled: fieldsFilled,
      regenerated: regenerated,
    });
  }).catch(function(e) {
    jsonResponse(res, 400, { ok: false, errors: [e.message] });
  });
}

/**
 * Auto-triage a single intake item using heuristic rules.
 * Applies heuristics, matches against existing features/tickets, and
 * persists the triage result onto the intake item.
 *
 * POST /api/intake/:id/auto-triage
 * Body: { apply: true } (optional — empty body or {} also applies)
 */
function handleAutoTriageSingle(req, res, intakeId) {
  return readBody(req).catch(function() { return {}; }).then(function(data) {
    var roadmap = readRoadmap();
    if (!roadmap.intake_items) roadmap.intake_items = [];

    var idx = roadmap.intake_items.findIndex(function(i) { return i.id === intakeId; });
    if (idx === -1) return jsonResponse(res, 404, { ok: false, errors: ["Intake '" + intakeId + "' not found"] });

    var item = roadmap.intake_items[idx];
    var context = {
      features: roadmap.features || [],
      custom_items: roadmap.custom_items || [],
      intake_items: roadmap.intake_items,
    };

    var result = parser.triageIntakeItem(item, context);

    // Apply triage results to the intake item if requested (default: true)
    var shouldApply = data.apply !== false;
    if (shouldApply) {
      item.recommended_action = result.recommended_action;
      item.scope_size = result.scope_size;
      item.proposed_phase = result.proposed_phase || item.proposed_phase;
      item.proposed_parent_feature = result.proposed_parent_feature;
      item.proposed_split_plan = result.proposed_split_plan;
      item.triage_notes = result.triage_notes;
      item.related_feature_ids = result.related_feature_ids;
      item.dependencies = result.dependencies;
      item.product_area = result.product_area || item.product_area;
      item.note_type = result.note_type;
      item.duplicate_of = result.duplicate_of;
      // Prompt G — split assessment metadata
      if (result.split_confidence) item.split_confidence = result.split_confidence;
      if (result.split_strategy) item.split_strategy = result.split_strategy;
      if (result.why_not_one_ticket) item.why_not_one_ticket = result.why_not_one_ticket;
      if (result.anti_split_reasons) item.anti_split_reasons = result.anti_split_reasons;
      if (item.status === "capture") item.status = "clarify";
      item.updated_at = new Date().toISOString();

      roadmap.intake_items[idx] = item;
      writeRoadmap(roadmap);
      var regenerated = regenerate();
      jsonResponse(res, 200, { ok: true, item: item, triage: result, regenerated: regenerated });
    } else {
      // Dry run — return result without persisting
      jsonResponse(res, 200, { ok: true, item: item, triage: result, applied: false });
    }
  }).catch(function(e) {
    jsonResponse(res, 400, { ok: false, errors: [e.message] });
  });
}

/**
 * Batch auto-triage: triage all raw/triaged intake items at once.
 *
 * POST /api/intake/auto-triage
 * Body: { apply: true } (optional — if true, persist triage fields)
 */
function handleAutoTriageBatch(req, res) {
  return readBody(req).then(function(data) {
    var roadmap = readRoadmap();
    if (!roadmap.intake_items) roadmap.intake_items = [];

    var context = {
      features: roadmap.features || [],
      custom_items: roadmap.custom_items || [],
      intake_items: roadmap.intake_items,
    };

    var results = parser.triageAll(roadmap.intake_items, context);
    var triaged = Object.keys(results);

    var shouldApply = data.apply !== false;
    if (shouldApply) {
      for (var i = 0; i < roadmap.intake_items.length; i++) {
        var item = roadmap.intake_items[i];
        var r = results[item.id];
        if (!r) continue;
        item.recommended_action = r.recommended_action;
        item.scope_size = r.scope_size;
        item.proposed_phase = r.proposed_phase || item.proposed_phase;
        item.proposed_parent_feature = r.proposed_parent_feature;
        item.proposed_split_plan = r.proposed_split_plan;
        item.triage_notes = r.triage_notes;
        item.related_feature_ids = r.related_feature_ids;
        item.dependencies = r.dependencies;
        item.product_area = r.product_area || item.product_area;
        item.note_type = r.note_type;
        item.duplicate_of = r.duplicate_of;
        // Prompt G — split assessment metadata
        if (r.split_confidence) item.split_confidence = r.split_confidence;
        if (r.split_strategy) item.split_strategy = r.split_strategy;
        if (r.why_not_one_ticket) item.why_not_one_ticket = r.why_not_one_ticket;
        if (r.anti_split_reasons) item.anti_split_reasons = r.anti_split_reasons;
        if (item.status === "capture") item.status = "clarify";
        item.updated_at = new Date().toISOString();
      }
      writeRoadmap(roadmap);
      var regenerated = regenerate();
      jsonResponse(res, 200, { ok: true, triaged_count: triaged.length, results: results, regenerated: regenerated });
    } else {
      jsonResponse(res, 200, { ok: true, triaged_count: triaged.length, results: results, applied: false });
    }
  }).catch(function(e) {
    jsonResponse(res, 400, { ok: false, errors: [e.message] });
  });
}

// ─── Intake Promotion Handlers ────────────────────────────────
//
// Convert triaged intake items into fully-scoped draft tickets.
// Uses the promotion engine in roadmap-parser.js.
//
// POST /api/intake/:id/promote  → single intake → draft tickets
// POST /api/intake/promote-all  → batch promote all triaged items

/**
 * Promote a single intake item to draft ticket(s).
 *
 * Requirements:
 *   - Item must be status "clarify" with a recommended_action
 *   - Duplicates and parked items are linked/flagged, not promoted
 *   - Result includes fully-scoped draft specs
 */
function handlePromoteIntakeSingle(req, res, intakeId) {
  return readBody(req).then(function(data) {
    var roadmap = readRoadmap();
    if (!roadmap.intake_items) roadmap.intake_items = [];
    if (!roadmap.draft_tickets) roadmap.draft_tickets = [];

    var idx = roadmap.intake_items.findIndex(function(i) { return i.id === intakeId; });
    if (idx === -1) return jsonResponse(res, 404, { ok: false, errors: ["Intake '" + intakeId + "' not found"] });

    var item = roadmap.intake_items[idx];

    // Gate: must be triaged
    if (item.status !== "clarify") {
      return jsonResponse(res, 400, { ok: false, errors: ["Item must be triaged before promotion. Current status: " + item.status] });
    }
    if (!item.recommended_action) {
      return jsonResponse(res, 400, { ok: false, errors: ["Item has no recommended_action. Run auto-triage first."] });
    }

    // Build triage result from stored data
    var triage = {
      recommended_action: item.recommended_action,
      scope_size: item.scope_size,
      proposed_phase: item.proposed_phase,
      proposed_parent_feature: item.proposed_parent_feature,
      proposed_split_plan: item.proposed_split_plan || [],
      triage_notes: item.triage_notes,
      related_feature_ids: item.related_feature_ids || [],
      dependencies: item.dependencies || [],
      product_area: item.product_area,
      note_type: item.note_type,
      duplicate_of: item.duplicate_of,
    };

    var context = {
      features: roadmap.features || [],
      custom_items: roadmap.custom_items || [],
      intake_items: roadmap.intake_items,
    };

    var result = parser.promoteIntakeItem(item, triage, context);

    // Handle duplicate action — mark item and link
    if (result.action === "duplicate") {
      item.status = "duplicate";
      item.updated_at = new Date().toISOString();
      roadmap.intake_items[idx] = item;
      writeRoadmap(roadmap);
      var regenerated = regenerate();
      return jsonResponse(res, 200, { ok: true, action: "duplicate", item: item, drafts: [], notes: result.notes, regenerated: regenerated });
    }

    // Handle park action — mark item as parked
    if (result.action === "park") {
      item.status = "parked";
      item.updated_at = new Date().toISOString();
      roadmap.intake_items[idx] = item;
      writeRoadmap(roadmap);
      var regenerated2 = regenerate();
      return jsonResponse(res, 200, { ok: true, action: "park", item: item, drafts: [], notes: result.notes, regenerated: regenerated2 });
    }

    // Create draft tickets from promotion result
    var createdDrafts = [];
    for (var di = 0; di < result.drafts.length; di++) {
      var spec = result.drafts[di];
      var draft = Object.assign(draftDefaults(), spec, {
        id: generateDraftId(roadmap.draft_tickets.concat(createdDrafts)),
      });
      createdDrafts.push(draft);
    }

    // Wire up dependency chains for blocked items (prerequisite → main)
    if (result.action === "blocked" && createdDrafts.length > 1) {
      var mainDraft = createdDrafts[createdDrafts.length - 1]; // last one is the main
      var prereqIds = [];
      for (var pi = 0; pi < createdDrafts.length - 1; pi++) {
        prereqIds.push(createdDrafts[pi].id);
      }
      mainDraft.depends_on = prereqIds;
    }

    // Persist drafts and update intake item
    roadmap.draft_tickets = roadmap.draft_tickets.concat(createdDrafts);
    item.draft_ticket_ids = (item.draft_ticket_ids || []).concat(createdDrafts.map(function(d) { return d.id; }));
    item.status = "review";
    item.updated_at = new Date().toISOString();
    roadmap.intake_items[idx] = item;

    writeRoadmap(roadmap);
    var regenerated3 = regenerate();
    jsonResponse(res, 200, {
      ok: true,
      action: result.action,
      item: item,
      drafts: createdDrafts,
      notes: result.notes,
      regenerated: regenerated3,
    });
  }).catch(function(e) {
    jsonResponse(res, 400, { ok: false, errors: [e.message] });
  });
}

/**
 * Batch promote all triaged intake items.
 * Skips items already drafted/promoted, duplicates, and parked.
 */
function handlePromoteIntakeBatch(req, res) {
  return readBody(req).then(function(data) {
    var roadmap = readRoadmap();
    if (!roadmap.intake_items) roadmap.intake_items = [];
    if (!roadmap.draft_tickets) roadmap.draft_tickets = [];

    var context = {
      features: roadmap.features || [],
      custom_items: roadmap.custom_items || [],
      intake_items: roadmap.intake_items,
    };

    var allCreated = [];
    var promotedCount = 0;
    var skippedCount = 0;
    var itemResults = {};

    for (var i = 0; i < roadmap.intake_items.length; i++) {
      var item = roadmap.intake_items[i];
      if (item.status !== "clarify") { skippedCount++; continue; }
      if (!item.recommended_action) { skippedCount++; continue; }

      var triage = {
        recommended_action: item.recommended_action,
        scope_size: item.scope_size,
        proposed_phase: item.proposed_phase,
        proposed_parent_feature: item.proposed_parent_feature,
        proposed_split_plan: item.proposed_split_plan || [],
        triage_notes: item.triage_notes,
        related_feature_ids: item.related_feature_ids || [],
        dependencies: item.dependencies || [],
        product_area: item.product_area,
        note_type: item.note_type,
        duplicate_of: item.duplicate_of,
      };

      var result = parser.promoteIntakeItem(item, triage, context);

      // Handle non-draft results
      if (result.action === "duplicate") {
        item.status = "duplicate";
        item.updated_at = new Date().toISOString();
        itemResults[item.id] = { action: "duplicate", drafts: 0, notes: result.notes };
        continue;
      }
      if (result.action === "park") {
        item.status = "parked";
        item.updated_at = new Date().toISOString();
        itemResults[item.id] = { action: "park", drafts: 0, notes: result.notes };
        continue;
      }

      // Create draft tickets
      var createdDrafts = [];
      for (var di = 0; di < result.drafts.length; di++) {
        var spec = result.drafts[di];
        var draft = Object.assign(draftDefaults(), spec, {
          id: generateDraftId(roadmap.draft_tickets.concat(allCreated).concat(createdDrafts)),
        });
        createdDrafts.push(draft);
      }

      // Wire blocked deps
      if (result.action === "blocked" && createdDrafts.length > 1) {
        var mainDraft = createdDrafts[createdDrafts.length - 1];
        var prereqIds = [];
        for (var pi = 0; pi < createdDrafts.length - 1; pi++) {
          prereqIds.push(createdDrafts[pi].id);
        }
        mainDraft.depends_on = prereqIds;
      }

      // Persist
      roadmap.draft_tickets = roadmap.draft_tickets.concat(createdDrafts);
      allCreated = allCreated.concat(createdDrafts);
      item.draft_ticket_ids = (item.draft_ticket_ids || []).concat(createdDrafts.map(function(d) { return d.id; }));
      item.status = "review";
      item.updated_at = new Date().toISOString();
      promotedCount++;
      itemResults[item.id] = { action: result.action, drafts: createdDrafts.length, notes: result.notes };
    }

    // ── Auto-refine all newly created drafts ──
    var refinedCount = 0;
    var refineSkipped = 0;
    if (allCreated.length > 0) {
      // Build project context once (same as handleRefineDraft)
      var projectState = "";
      var architectureGuide = "";
      var auditDoc = "";
      try { projectState = fs.readFileSync(path.join(ROOT, "PROJECT_STATE.md"), "utf8"); } catch(e) { /* optional */ }
      try { architectureGuide = fs.readFileSync(path.join(ROOT, "apps/api/src/ARCHITECTURE_LOW_CONTEXT_GUIDE.md"), "utf8"); } catch(e) { /* optional */ }
      try { auditDoc = fs.readFileSync(path.join(ROOT, "docs/AUDIT.md"), "utf8"); } catch(e) { /* optional */ }

      var models = [], enums = [], workflows = [], routes = [], services = [];
      try {
        var schemaText = fs.readFileSync(path.join(ROOT, "apps/api/prisma/schema.prisma"), "utf8");
        models = (schemaText.match(/^model\s+(\w+)\s*\{/gm) || []).map(function(m) { return m.replace(/^model\s+/, "").replace(/\s*\{$/, ""); });
        enums = (schemaText.match(/^enum\s+(\w+)\s*\{/gm) || []).map(function(m) { return m.replace(/^enum\s+/, "").replace(/\s*\{$/, ""); });
      } catch(e) {}
      try { workflows = fs.readdirSync(path.join(ROOT, "apps/api/src/workflows")).filter(function(f) { return f.endsWith(".ts") && !f.startsWith("index"); }); } catch(e) {}
      try { routes = fs.readdirSync(path.join(ROOT, "apps/api/src/routes")).filter(function(f) { return f.endsWith(".ts") && !f.startsWith("index"); }); } catch(e) {}
      try { services = fs.readdirSync(path.join(ROOT, "apps/api/src/services")).filter(function(f) { return f.endsWith(".ts") && !f.startsWith("index"); }); } catch(e) {}

      var projectContext = {
        projectState: projectState,
        architectureGuide: architectureGuide,
        auditDoc: auditDoc,
        features: roadmap.features || [],
        customItems: roadmap.custom_items || [],
        intakeItems: roadmap.intake_items || [],
        draftTickets: roadmap.draft_tickets,
        models: models,
        enums: enums,
        workflows: workflows,
        routes: routes,
        services: services,
      };

      for (var ri = 0; ri < allCreated.length; ri++) {
        var draftToRefine = allCreated[ri];
        try {
          var refResult = parser.refineDraft(draftToRefine, projectContext);
          // Merge refined draft back into roadmap.draft_tickets
          var dIdx = roadmap.draft_tickets.findIndex(function(d) { return d.id === draftToRefine.id; });
          if (dIdx !== -1) roadmap.draft_tickets[dIdx] = refResult.draft;
          // Also update allCreated reference
          allCreated[ri] = refResult.draft;
          refinedCount++;
        } catch(refErr) {
          refineSkipped++;
        }
      }
    }

    writeRoadmap(roadmap);
    var regenerated = regenerate();
    jsonResponse(res, 200, {
      ok: true,
      promoted_count: promotedCount,
      skipped_count: skippedCount,
      total_drafts_created: allCreated.length,
      refine_summary: { refined: refinedCount, skipped: refineSkipped },
      results: itemResults,
      regenerated: regenerated,
    });
  }).catch(function(e) {
    jsonResponse(res, 400, { ok: false, errors: [e.message] });
  });
}

function handleUpdateIntake(req, res, intakeId) {
  return readBody(req).then(function(data) {
    var roadmap = readRoadmap();
    if (!roadmap.intake_items) roadmap.intake_items = [];

    var idx = roadmap.intake_items.findIndex(function(i) { return i.id === intakeId; });
    if (idx === -1) return jsonResponse(res, 404, { ok: false, errors: ["Intake '" + intakeId + "' not found"] });

    var item = roadmap.intake_items[idx];
    // Allow updating any field — validate status enum
    var editableStrings = ["title", "raw_text", "source", "product_area", "proposed_phase", "triage_notes"];
    for (var fi = 0; fi < editableStrings.length; fi++) {
      var key = editableStrings[fi];
      if (data[key] !== undefined) item[key] = data[key];
    }
    if (data.status !== undefined) {
      if (INTAKE_STATUSES.indexOf(data.status) === -1) {
        return jsonResponse(res, 400, { ok: false, errors: ["Invalid status '" + data.status + "'. Valid: " + INTAKE_STATUSES.join(", ")] });
      }
      item.status = data.status;
    }
    if (data.related_feature_ids) item.related_feature_ids = data.related_feature_ids;
    if (data.dependencies) item.dependencies = data.dependencies;
    if (data.constraints) item.constraints = data.constraints;
    if (data.split_recommended !== undefined) item.split_recommended = !!data.split_recommended;
    if (data.draft_ticket_ids) item.draft_ticket_ids = data.draft_ticket_ids;
    // Triage fields
    if (data.recommended_action !== undefined) item.recommended_action = data.recommended_action;
    if (data.scope_size !== undefined) item.scope_size = data.scope_size;
    if (data.proposed_parent_feature !== undefined) item.proposed_parent_feature = data.proposed_parent_feature;
    if (data.proposed_split_plan !== undefined) item.proposed_split_plan = data.proposed_split_plan;
    if (data.note_type !== undefined) item.note_type = data.note_type;
    if (data.duplicate_of !== undefined) item.duplicate_of = data.duplicate_of;
    item.updated_at = new Date().toISOString();

    roadmap.intake_items[idx] = item;
    writeRoadmap(roadmap);
    var regenerated = regenerate();
    jsonResponse(res, 200, { ok: true, item: item, regenerated: regenerated });
  }).catch(function(e) {
    jsonResponse(res, 400, { ok: false, errors: [e.message] });
  });
}

function handleDeleteIntake(req, res, intakeId) {
  var roadmap = readRoadmap();
  if (!roadmap.intake_items) roadmap.intake_items = [];

  var idx = roadmap.intake_items.findIndex(function(i) { return i.id === intakeId; });
  if (idx === -1) return jsonResponse(res, 404, { ok: false, errors: ["Intake '" + intakeId + "' not found"] });

  var removed = roadmap.intake_items.splice(idx, 1)[0];
  writeRoadmap(roadmap);
  var regenerated = regenerate();
  jsonResponse(res, 200, { ok: true, removed: removed, regenerated: regenerated });
}

// ─── Split Handler ────────────────────────────────────────────
//
// Splits an intake item into multiple focused draft tickets.
// Uses the parser's split plan generator + promotion engine.
//
// POST /api/intake/:id/split
// Body: { split_titles: ["title1", "title2", ...] } (optional override)
//
// Flow:
//   1. Generate split plan from raw_text (or use user-supplied titles)
//   2. Store plan as proposed_split_plan on the item
//   3. Force recommended_action = "split" and triage metadata
//   4. Run promote pipeline (creates full canonical draft tickets)
//   5. Persist everything, regenerate HTML

function handleSplitIntake(req, res, intakeId) {
  return readBody(req).then(function(data) {
    var roadmap = readRoadmap();
    if (!roadmap.intake_items) roadmap.intake_items = [];
    if (!roadmap.draft_tickets) roadmap.draft_tickets = [];

    var idx = roadmap.intake_items.findIndex(function(i) { return i.id === intakeId; });
    if (idx === -1) return jsonResponse(res, 404, { ok: false, errors: ["Intake '" + intakeId + "' not found"] });

    var item = roadmap.intake_items[idx];

    // Gate: cannot split items that already have draft tickets
    if (item.status === "review" || item.status === "promoted") {
      return jsonResponse(res, 400, { ok: false, errors: ["Item already has drafts (status: " + item.status + "). Delete existing drafts first."] });
    }

    var context = {
      features: roadmap.features || [],
      custom_items: roadmap.custom_items || [],
      intake_items: roadmap.intake_items,
    };

    // Step 1: Generate or accept a split plan
    var splitPlan;
    if (data.split_titles && Array.isArray(data.split_titles) && data.split_titles.length >= 2) {
      // User supplied explicit split titles
      splitPlan = data.split_titles.map(function(t) {
        return { title: String(t).trim().substring(0, 200), scope_hint: "tbd" };
      }).filter(function(p) { return p.title.length > 0; });
    } else {
      // Auto-generate: run triage to get context, then use its split plan
      var triageResult = parser.triageIntakeItem(item, context);
      splitPlan = triageResult.proposed_split_plan || [];

      // If triage didn't produce a split plan (e.g. item was classified as "execute"),
      // force-generate one from the raw text
      if (splitPlan.length < 2) {
        splitPlan = parser.generateSplitPlan
          ? parser.generateSplitPlan(item.raw_text || "", item.note_type || "feature_request", item.product_area || "")
          : [];
      }

      // Last resort: if still no plan, split by sentences/bullets
      if (splitPlan.length < 2) {
        var rawText = item.raw_text || "";
        var lines = rawText.split(/[\n\r]+/).map(function(l){ return l.trim(); }).filter(function(l){ return l.length > 10; });
        var bullets = lines.filter(function(l) { return /^[-•*]\s|^\d+[.)]\s/.test(l); });
        if (bullets.length >= 2) {
          splitPlan = bullets.map(function(b) {
            var clean = b.replace(/^[-•*\d.)]+\s*/, "").trim();
            return { title: clean.substring(0, 200), scope_hint: "tbd" };
          });
        } else {
          var sentences = rawText.split(/[.!?]\s+/).filter(function(s) { return s.trim().length > 15; });
          if (sentences.length >= 2) {
            splitPlan = sentences.map(function(s) {
              return { title: s.trim().substring(0, 200), scope_hint: "tbd" };
            });
          }
        }
      }

      // If still can't split, use triage metadata to augment
      if (splitPlan.length < 2) {
        return jsonResponse(res, 400, { ok: false, errors: [
          "Could not generate a split plan from this item's text. " +
          "Try providing explicit titles via split_titles: [\"Part 1\", \"Part 2\", ...]"
        ] });
      }

      // Apply triage metadata to item if not already triaged
      if (triageResult) {
        item.product_area = triageResult.product_area || item.product_area;
        item.note_type = triageResult.note_type || item.note_type;
        item.dependencies = triageResult.dependencies || item.dependencies || [];
        item.related_feature_ids = triageResult.related_feature_ids || item.related_feature_ids || [];
        if (!item.proposed_phase) item.proposed_phase = triageResult.proposed_phase;
      }
    }

    // Step 2: Force split triage state on the item
    item.recommended_action = "split";
    item.scope_size = item.scope_size || "large";
    item.proposed_split_plan = splitPlan;
    item.split_recommended = true;
    item.status = "clarify"; // needs to be triaged for promote to work
    item.triage_notes = (item.triage_notes ? item.triage_notes + " | " : "") +
      "Split into " + splitPlan.length + " parts via split action.";
    item.updated_at = new Date().toISOString();
    roadmap.intake_items[idx] = item;

    // Step 3: Run the full promote pipeline (creates canonical draft tickets)
    var triage = {
      recommended_action: "split",
      scope_size: item.scope_size,
      proposed_phase: item.proposed_phase,
      proposed_parent_feature: item.proposed_parent_feature,
      proposed_split_plan: splitPlan,
      triage_notes: item.triage_notes,
      related_feature_ids: item.related_feature_ids || [],
      dependencies: item.dependencies || [],
      product_area: item.product_area,
      note_type: item.note_type,
      duplicate_of: null,
    };

    var result = parser.promoteIntakeItem(item, triage, context);

    // Step 4: Create draft tickets
    var createdDrafts = [];
    for (var di = 0; di < result.drafts.length; di++) {
      var spec = result.drafts[di];
      var draft = Object.assign(draftDefaults(), spec, {
        id: generateDraftId(roadmap.draft_tickets.concat(createdDrafts)),
      });
      createdDrafts.push(draft);
    }

    // Step 5: Persist
    roadmap.draft_tickets = roadmap.draft_tickets.concat(createdDrafts);
    item.draft_ticket_ids = (item.draft_ticket_ids || []).concat(createdDrafts.map(function(d) { return d.id; }));
    item.status = "review";
    item.updated_at = new Date().toISOString();
    roadmap.intake_items[idx] = item;

    writeRoadmap(roadmap);
    var regenerated = regenerate();

    jsonResponse(res, 200, {
      ok: true,
      action: "split",
      item: item,
      drafts: createdDrafts,
      split_plan: splitPlan,
      notes: result.notes,
      regenerated: regenerated,
    });
  }).catch(function(e) {
    jsonResponse(res, 400, { ok: false, errors: [e.message] });
  });
}

/**
 * Triage an intake item: parse raw_text into structured concerns,
 * assign product_area + proposed_phase, generate DT-xxx draft tickets.
 *
 * Transition: raw → triaged (if just annotating) or raw → drafted (if also creating drafts)
 *
 * Body shape:
 *   {
 *     product_area: "invoicing",
 *     proposed_phase: "P1",
 *     triage_notes: "...",
 *     split_recommended: true,
 *     related_feature_ids: ["F-P1-002"],
 *     drafts: [                       // optional — create DT-xxx tickets
 *       { title: "...", goal: "...", ... }
 *     ]
 *   }
 */
function handleTriageIntake(req, res, intakeId) {
  return readBody(req).then(function(data) {
    var roadmap = readRoadmap();
    if (!roadmap.intake_items) roadmap.intake_items = [];
    if (!roadmap.draft_tickets) roadmap.draft_tickets = [];

    var idx = roadmap.intake_items.findIndex(function(i) { return i.id === intakeId; });
    if (idx === -1) return jsonResponse(res, 404, { ok: false, errors: ["Intake '" + intakeId + "' not found"] });

    var item = roadmap.intake_items[idx];

    // Apply triage metadata
    if (data.product_area) item.product_area = data.product_area;
    if (data.proposed_phase) item.proposed_phase = data.proposed_phase;
    if (data.triage_notes) item.triage_notes = data.triage_notes;
    if (data.related_feature_ids) item.related_feature_ids = data.related_feature_ids;
    if (data.constraints) item.constraints = data.constraints;
    if (data.dependencies) item.dependencies = data.dependencies;
    if (data.split_recommended !== undefined) item.split_recommended = !!data.split_recommended;
    if (data.title) item.title = data.title.trim();
    item.updated_at = new Date().toISOString();

    // Create draft tickets if provided
    var drafts = [];
    var draftSpecs = data.drafts || [];
    if (draftSpecs.length > 0) {
      for (var ci = 0; ci < draftSpecs.length; ci++) {
        var spec = draftSpecs[ci];
        if (!spec.title) continue;
        var draft = Object.assign(draftDefaults(), {
          id: generateDraftId(roadmap.draft_tickets.concat(drafts)),
          source_intake_ids: [intakeId],
          title: spec.title,
          goal: spec.goal || "",
          phase: spec.phase || item.proposed_phase || null,
          order: spec.order || ci + 1,
          status: "review",
          product_area: spec.product_area || item.product_area || "",
          parent_feature_id: spec.parent_feature_id || (item.related_feature_ids && item.related_feature_ids[0]) || null,
        });
        // Optional fields
        if (spec.depends_on) draft.depends_on = spec.depends_on;
        if (spec.files_to_modify) draft.files_to_modify = spec.files_to_modify;
        if (spec.in_scope) draft.in_scope = spec.in_scope;
        if (spec.out_of_scope) draft.out_of_scope = spec.out_of_scope;
        if (spec.acceptance_criteria) draft.acceptance_criteria = spec.acceptance_criteria;
        if (spec.tests_to_add_or_update) draft.tests_to_add_or_update = spec.tests_to_add_or_update;
        drafts.push(draft);
      }
      roadmap.draft_tickets = roadmap.draft_tickets.concat(drafts);
      item.draft_ticket_ids = (item.draft_ticket_ids || []).concat(drafts.map(function(d) { return d.id; }));
      // Transition: raw → drafted (drafts were created)
      item.status = "review";
    } else {
      // No drafts — just triaging (annotating)
      // Transition: raw → triaged
      item.status = "clarify";
    }

    roadmap.intake_items[idx] = item;
    writeRoadmap(roadmap);
    var regenerated = regenerate();
    jsonResponse(res, 200, { ok: true, item: item, drafts: drafts, regenerated: regenerated });
  }).catch(function(e) {
    jsonResponse(res, 400, { ok: false, errors: [e.message] });
  });
}

// ─── Draft Handlers ───────────────────────────────────────────
//
// Lifecycle: draft → ready → promoted | discarded
//
//   draft:     created from triage, fields still incomplete
//   ready:     all required fields filled, awaiting human review
//   promoted:  moved to custom_items[] as an executable ticket
//   discarded: rejected during review — kept for audit trail
//
// Executable tickets (custom_items[]) remain the ONLY items used
// by chronological development mode.

function handleUpdateDraft(req, res, draftId) {
  return readBody(req).then(function(data) {
    var roadmap = readRoadmap();
    if (!roadmap.draft_tickets) roadmap.draft_tickets = [];

    var idx = roadmap.draft_tickets.findIndex(function(d) { return d.id === draftId; });
    if (idx === -1) return jsonResponse(res, 404, { ok: false, errors: ["Draft '" + draftId + "' not found"] });

    var draft = roadmap.draft_tickets[idx];
    // Validate status enum if changing
    if (data.status !== undefined) {
      if (DRAFT_STATUSES.indexOf(data.status) === -1) {
        return jsonResponse(res, 400, { ok: false, errors: ["Invalid status '" + data.status + "'. Valid: " + DRAFT_STATUSES.join(", ")] });
      }
      draft.status = data.status;
    }
    // Scalar fields
    var editableScalars = [
      "title", "goal", "phase", "order", "product_area", "parent_feature_id",
      "parent_story_id", "parent_story_title", "parent_story_raw_text",
      "slice_rationale", "sequence_role", "story_intent", "story_success_outcome",
      "implementation_shape", "refinement_status", "refined_at"
    ];
    for (var fi = 0; fi < editableScalars.length; fi++) {
      var key = editableScalars[fi];
      if (data[key] !== undefined) draft[key] = data[key];
    }
    // String fields beyond scalars
    if (data.canonical_implementation_prompt !== undefined) draft.canonical_implementation_prompt = data.canonical_implementation_prompt;
    // Object fields
    if (data.context_bundle !== undefined) draft.context_bundle = data.context_bundle;
    // Array fields
    var editableArrays = [
      "source_intake_ids", "depends_on", "files_to_modify", "files_to_inspect",
      "in_scope", "out_of_scope", "acceptance_criteria",
      "tests_to_add_or_update", "test_protocol",
      "validation_checklist", "post_validation_updates",
      "sibling_ticket_ids", "risk_notes", "refinement_notes",
      "tests_to_add", "tests_to_update", "regression_checks"
    ];
    for (var ai = 0; ai < editableArrays.length; ai++) {
      var aKey = editableArrays[ai];
      if (data[aKey]) draft[aKey] = data[aKey];
    }

    roadmap.draft_tickets[idx] = draft;
    writeRoadmap(roadmap);
    var regenerated = regenerate();
    jsonResponse(res, 200, { ok: true, draft: draft, regenerated: regenerated });
  }).catch(function(e) {
    jsonResponse(res, 400, { ok: false, errors: [e.message] });
  });
}

// ─── Refine Draft Handler ─────────────────────────────────────
//
// Enriches a draft ticket using project context files:
//   PROJECT_STATE.md, ARCHITECTURE_LOW_CONTEXT_GUIDE.md, AUDIT.md,
//   sibling tickets, roadmap features, codebase signals.
//
// POST /api/drafts/:id/refine
// Body: {} (no parameters needed — context is read from disk)
//
// Idempotent: re-refining does not overwrite manually-edited fields.

function handleRefineDraft(req, res, draftId) {
  // Drain the request body (no payload needed for refine)
  return new Promise(function(resolve) {
    var chunks = [];
    req.on("data", function(c) { chunks.push(c); });
    req.on("end", resolve);
  }).then(function() {
    var roadmap = readRoadmap();
    if (!roadmap.draft_tickets) roadmap.draft_tickets = [];

    var idx = roadmap.draft_tickets.findIndex(function(d) { return d.id === draftId; });
    if (idx === -1) return jsonResponse(res, 404, { ok: false, errors: ["Draft '" + draftId + "' not found"] });

    var draft = roadmap.draft_tickets[idx];

    // Gate: cannot refine promoted drafts
    if (draft.status === "promoted") {
      return jsonResponse(res, 400, { ok: false, errors: ["Cannot refine a promoted draft"] });
    }

    // Read project context files from disk
    var projectState = "";
    var architectureGuide = "";
    var auditDoc = "";
    try { projectState = fs.readFileSync(path.join(ROOT, "PROJECT_STATE.md"), "utf8"); } catch(e) { /* optional */ }
    try { architectureGuide = fs.readFileSync(path.join(ROOT, "apps/api/src/ARCHITECTURE_LOW_CONTEXT_GUIDE.md"), "utf8"); } catch(e) { /* optional */ }
    try { auditDoc = fs.readFileSync(path.join(ROOT, "docs/AUDIT.md"), "utf8"); } catch(e) { /* optional */ }

    // Read codebase signals (lightweight — just file lists)
    var models = [], enums = [], workflows = [], routes = [], services = [];
    try {
      var schemaText = fs.readFileSync(path.join(ROOT, "apps/api/prisma/schema.prisma"), "utf8");
      models = (schemaText.match(/^model\s+(\w+)\s*\{/gm) || []).map(function(m) { return m.replace(/^model\s+/, "").replace(/\s*\{$/, ""); });
      enums = (schemaText.match(/^enum\s+(\w+)\s*\{/gm) || []).map(function(m) { return m.replace(/^enum\s+/, "").replace(/\s*\{$/, ""); });
    } catch(e) { /* schema not found */ }
    try { workflows = fs.readdirSync(path.join(ROOT, "apps/api/src/workflows")).filter(function(f) { return f.endsWith(".ts") && !f.startsWith("index"); }); } catch(e) {}
    try { routes = fs.readdirSync(path.join(ROOT, "apps/api/src/routes")).filter(function(f) { return f.endsWith(".ts") && !f.startsWith("index"); }); } catch(e) {}
    try { services = fs.readdirSync(path.join(ROOT, "apps/api/src/services")).filter(function(f) { return f.endsWith(".ts") && !f.startsWith("index"); }); } catch(e) {}

    var projectContext = {
      projectState: projectState,
      architectureGuide: architectureGuide,
      auditDoc: auditDoc,
      features: roadmap.features || [],
      customItems: roadmap.custom_items || [],
      intakeItems: roadmap.intake_items || [],
      draftTickets: roadmap.draft_tickets,
      models: models,
      enums: enums,
      workflows: workflows,
      routes: routes,
      services: services,
    };

    // Run the refinement engine
    var result = parser.refineDraft(draft, projectContext);

    // Merge refined draft back (preserve any fields added during refinement)
    roadmap.draft_tickets[idx] = result.draft;

    writeRoadmap(roadmap);
    var regenerated = regenerate();

    jsonResponse(res, 200, {
      ok: true,
      draft: result.draft,
      changes: result.changes,
      refinement_status: result.refinement_status,
      notes: result.notes,
      regenerated: regenerated,
    });
  }).catch(function(e) {
    jsonResponse(res, 400, { ok: false, errors: [e.message] });
  });
}

function handleDeleteDraft(req, res, draftId) {
  var roadmap = readRoadmap();
  if (!roadmap.draft_tickets) roadmap.draft_tickets = [];

  var idx = roadmap.draft_tickets.findIndex(function(d) { return d.id === draftId; });
  if (idx === -1) return jsonResponse(res, 404, { ok: false, errors: ["Draft '" + draftId + "' not found"] });

  var removed = roadmap.draft_tickets.splice(idx, 1)[0];
  writeRoadmap(roadmap);
  var regenerated = regenerate();
  jsonResponse(res, 200, { ok: true, removed: removed, regenerated: regenerated });
}

// ─── Prompt F — Refine All From Epic Handler ──────────────────
//
// POST /api/intake/:id/refine-all
// Batch-refine all child draft tickets from one parent intake item.

function handleRefineAllFromEpic(req, res, intakeId) {
  return new Promise(function(resolve) {
    var chunks = [];
    req.on("data", function(c) { chunks.push(c); });
    req.on("end", resolve);
  }).then(function() {
    var roadmap = readRoadmap();
    if (!roadmap.intake_items) roadmap.intake_items = [];
    if (!roadmap.draft_tickets) roadmap.draft_tickets = [];

    var parentIdx = roadmap.intake_items.findIndex(function(i) { return i.id === intakeId; });
    if (parentIdx === -1) return jsonResponse(res, 404, { ok: false, errors: ["Intake '" + intakeId + "' not found"] });

    var parentItem = roadmap.intake_items[parentIdx];
    var childDraftIds = parentItem.draft_ticket_ids || [];

    if (childDraftIds.length === 0) {
      return jsonResponse(res, 400, { ok: false, errors: ["Intake '" + intakeId + "' has no child draft tickets"] });
    }

    var childDrafts = childDraftIds.map(function(dtId) {
      return roadmap.draft_tickets.find(function(d) { return d.id === dtId; });
    }).filter(Boolean);

    if (childDrafts.length === 0) {
      return jsonResponse(res, 400, { ok: false, errors: ["No matching draft tickets found for IDs: " + childDraftIds.join(", ")] });
    }

    // Read project context
    var projectState = "";
    var architectureGuide = "";
    var auditDoc = "";
    try { projectState = fs.readFileSync(path.join(ROOT, "PROJECT_STATE.md"), "utf8"); } catch(e) {}
    try { architectureGuide = fs.readFileSync(path.join(ROOT, "apps/api/src/ARCHITECTURE_LOW_CONTEXT_GUIDE.md"), "utf8"); } catch(e) {}
    try { auditDoc = fs.readFileSync(path.join(ROOT, "docs/AUDIT.md"), "utf8"); } catch(e) {}

    var models = [], enums = [], workflows = [], routes = [], services = [];
    try {
      var schemaText = fs.readFileSync(path.join(ROOT, "apps/api/prisma/schema.prisma"), "utf8");
      models = (schemaText.match(/^model\s+(\w+)\s*\{/gm) || []).map(function(m) { return m.replace(/^model\s+/, "").replace(/\s*\{$/, ""); });
      enums = (schemaText.match(/^enum\s+(\w+)\s*\{/gm) || []).map(function(m) { return m.replace(/^enum\s+/, "").replace(/\s*\{$/, ""); });
    } catch(e) {}
    try { workflows = fs.readdirSync(path.join(ROOT, "apps/api/src/workflows")).filter(function(f) { return f.endsWith(".ts") && !f.startsWith("index"); }); } catch(e) {}
    try { routes = fs.readdirSync(path.join(ROOT, "apps/api/src/routes")).filter(function(f) { return f.endsWith(".ts") && !f.startsWith("index"); }); } catch(e) {}
    try { services = fs.readdirSync(path.join(ROOT, "apps/api/src/services")).filter(function(f) { return f.endsWith(".ts") && !f.startsWith("index"); }); } catch(e) {}

    var projectContext = {
      projectState: projectState,
      architectureGuide: architectureGuide,
      auditDoc: auditDoc,
      features: roadmap.features || [],
      customItems: roadmap.custom_items || [],
      intakeItems: roadmap.intake_items || [],
      draftTickets: roadmap.draft_tickets,
      models: models, enums: enums,
      workflows: workflows, routes: routes, services: services,
    };

    var result = parser.refineAllFromEpic(parentItem, childDrafts, projectContext);

    // Merge refined drafts back
    for (var ri = 0; ri < result.results.length; ri++) {
      var refined = result.results[ri].draft;
      var dIdx = roadmap.draft_tickets.findIndex(function(d) { return d.id === refined.id; });
      if (dIdx >= 0) roadmap.draft_tickets[dIdx] = refined;
    }

    writeRoadmap(roadmap);
    var regenerated = regenerate();

    jsonResponse(res, 200, {
      ok: true,
      summary: result.summary,
      shared_bundle: result.shared_bundle,
      results: result.results.map(function(r) {
        return { id: r.draft.id, refinement_status: r.refinement_status, changes: r.changes.length };
      }),
      regenerated: regenerated,
    });
  }).catch(function(e) {
    jsonResponse(res, 400, { ok: false, errors: [e.message] });
  });
}

// ─── Prompt C — Mark Ready Handler ────────────────────────────
//
// POST /api/drafts/:id/mark-ready
// Validates readiness, generates canonical Copilot prompt, marks draft as ready.

function handleMarkReady(req, res, draftId) {
  return new Promise(function(resolve) {
    var chunks = [];
    req.on("data", function(c) { chunks.push(c); });
    req.on("end", resolve);
  }).then(function() {
    var roadmap = readRoadmap();
    if (!roadmap.draft_tickets) roadmap.draft_tickets = [];

    var idx = roadmap.draft_tickets.findIndex(function(d) { return d.id === draftId; });
    if (idx === -1) return jsonResponse(res, 404, { ok: false, errors: ["Draft '" + draftId + "' not found"] });

    var draft = roadmap.draft_tickets[idx];

    if (draft.status === "promoted") {
      return jsonResponse(res, 400, { ok: false, errors: ["Cannot mark a promoted draft as ready"] });
    }

    // Build context for validation
    var projectContext = {
      features: roadmap.features || [],
      customItems: roadmap.custom_items || [],
      intakeItems: roadmap.intake_items || [],
      draftTickets: roadmap.draft_tickets,
    };

    // Run readiness validation (Prompt C)
    var validation = parser.validateDraftReadiness(draft, projectContext);

    if (!validation.ready) {
      return jsonResponse(res, 400, {
        ok: false,
        ready: false,
        issues: validation.issues,
        errors: ["Draft is not ready: " + validation.issues.length + " issue(s) found"],
      });
    }

    // Generate canonical Copilot prompt (Prompt C)
    draft.copilot_prompt = parser.generateCanonicalCopilotPrompt(draft, projectContext);
    draft.canonical_implementation_prompt = draft.copilot_prompt;
    draft.ready_for_copilot = true;
    draft.status = "ready";
    draft.ready_at = new Date().toISOString();

    roadmap.draft_tickets[idx] = draft;
    writeRoadmap(roadmap);
    var regenerated = regenerate();

    jsonResponse(res, 200, {
      ok: true,
      ready: true,
      draft: draft,
      issues: [],
      regenerated: regenerated,
    });
  }).catch(function(e) {
    jsonResponse(res, 400, { ok: false, errors: [e.message] });
  });
}

// ─── Prompt E — Story Sync on Validation ──────────────────────
//
// POST /api/drafts/:id/story-sync
// After a ticket is validated/done, update parent story state.

function handleStorySync(req, res, draftId) {
  return new Promise(function(resolve) {
    var chunks = [];
    req.on("data", function(c) { chunks.push(c); });
    req.on("end", resolve);
  }).then(function() {
    var roadmap = readRoadmap();
    if (!roadmap.draft_tickets) roadmap.draft_tickets = [];

    var draft = roadmap.draft_tickets.find(function(d) { return d.id === draftId; });
    if (!draft) return jsonResponse(res, 404, { ok: false, errors: ["Draft '" + draftId + "' not found"] });

    var parentIntakeId = draft.parent_story_id || (draft.source_intake_ids && draft.source_intake_ids[0]);
    if (!parentIntakeId) {
      return jsonResponse(res, 200, { ok: true, message: "No parent story to sync", progress: null });
    }

    // Compute story progress
    var progress = parser.computeStoryProgress(parentIntakeId, roadmap.draft_tickets, roadmap.custom_items || []);

    // Update parent intake item state
    if (progress && roadmap.intake_items) {
      var intakeIdx = roadmap.intake_items.findIndex(function(i) { return i.id === parentIntakeId; });
      if (intakeIdx >= 0) {
        var intake = roadmap.intake_items[intakeIdx];
        intake.story_state = progress.state;
        intake.story_progress = progress;
        intake.updated_at = new Date().toISOString();
        roadmap.intake_items[intakeIdx] = intake;
      }
    }

    writeRoadmap(roadmap);
    var regenerated = regenerate();

    jsonResponse(res, 200, {
      ok: true,
      progress: progress,
      regenerated: regenerated,
    });
  }).catch(function(e) {
    jsonResponse(res, 400, { ok: false, errors: [e.message] });
  });
}

// ─── Prompt J — Next Ticket Handler ───────────────────────────
//
// GET /api/next-ticket
// Selects the best next ticket to work on.

function handleNextTicket(req, res) {
  var roadmap = readRoadmap();
  var result = parser.selectNextTicket(
    roadmap.custom_items || [],
    roadmap.draft_tickets || [],
    roadmap.intake_items || []
  );

  jsonResponse(res, 200, {
    ok: true,
    selection: result,
  });
}

/**
 * Promote a draft ticket to an executable custom_item.
 *
 * Transition: draft_ticket.status → "promoted", new custom_item created.
 * Also marks all source intake items as "promoted" if all their drafts are promoted.
 *
 * The promoted ticket receives:
 *   - A proper custom_items[] ID (via shared.generateId)
 *   - Testing metadata backfilled via shared.backfillTestingDefaults
 *   - Lineage notes linking back to INT-xxx and DT-xxx
 */
function handlePromoteDraft(req, res, draftId) {
  var roadmap = readRoadmap();
  if (!roadmap.draft_tickets) roadmap.draft_tickets = [];
  if (!roadmap.custom_items) roadmap.custom_items = [];

  var idx = roadmap.draft_tickets.findIndex(function(d) { return d.id === draftId; });
  if (idx === -1) return jsonResponse(res, 404, { ok: false, errors: ["Draft '" + draftId + "' not found"] });

  var draft = roadmap.draft_tickets[idx];
  if (draft.status === "promoted") {
    return jsonResponse(res, 400, { ok: false, errors: ["Draft '" + draftId + "' is already promoted to " + (draft.promoted_to || "unknown")] });
  }

  // Infer type from ticket shape — default to "task"
  var ticketType = "task";
  if (draft.title && /\bbug\b/i.test(draft.title)) ticketType = "bug";
  if (draft.goal && /\bspike\b/i.test(draft.goal)) ticketType = "spike";

  // Generate a proper custom_item ID
  var newId = shared.generateId(ticketType, roadmap.custom_items);

  // Build lineage note
  var lineage = "[from " + (draft.source_intake_ids || []).join(", ") + " via " + draft.id + "]";

  // Build the executable ticket
  var ticket = {
    id: newId,
    phase: draft.phase || "P1",
    title: draft.title,
    type: ticketType,
    status: "planned",
    description: draft.goal || "",
    order: draft.order || 1,
    acceptance_criteria: (draft.acceptance_criteria && draft.acceptance_criteria.length > 0)
      ? draft.acceptance_criteria
      : ["Feature works as described"],
    notes: lineage,
  };
  if (draft.parent_feature_id) ticket.parent_feature = draft.parent_feature_id;
  if (draft.files_to_modify && draft.files_to_modify.length > 0) ticket.files_expected = draft.files_to_modify;
  if (draft.depends_on && draft.depends_on.length > 0) ticket.depends_on = draft.depends_on;

  // Backfill testing metadata from shared defaults
  shared.backfillTestingDefaults([ticket]);

  // If the draft has richer test metadata, overlay it
  if (draft.tests_to_add_or_update && draft.tests_to_add_or_update.length > 0) {
    ticket.required_tests = draft.tests_to_add_or_update;
  }
  if (draft.test_protocol && draft.test_protocol.length > 0) {
    ticket.test_protocol = draft.test_protocol.join("\n");
  }
  if (draft.validation_checklist && draft.validation_checklist.length > 0) {
    ticket.validation_checklist = draft.validation_checklist;
  }
  if (draft.post_validation_updates && draft.post_validation_updates.length > 0) {
    ticket.post_validation = draft.post_validation_updates;
  }
  if (draft.canonical_implementation_prompt) {
    ticket.implementation_prompt = draft.canonical_implementation_prompt;
  }
  if (draft.in_scope && draft.in_scope.length > 0) {
    ticket.in_scope = draft.in_scope;
  }
  if (draft.out_of_scope && draft.out_of_scope.length > 0) {
    ticket.out_of_scope = draft.out_of_scope;
  }
  if (draft.product_area) {
    ticket.product_area = draft.product_area;
  }
  if (draft.goal) {
    ticket.description = draft.goal;
  }

  roadmap.custom_items.push(ticket);

  // Mark draft as promoted
  draft.status = "promoted";
  draft.promoted_to = newId;
  roadmap.draft_tickets[idx] = draft;

  // Check if all drafts from each source intake are promoted → mark intake "promoted"
  var sourceIds = draft.source_intake_ids || [];
  for (var si = 0; si < sourceIds.length; si++) {
    var intakeIdx = (roadmap.intake_items || []).findIndex(function(i) { return i.id === sourceIds[si]; });
    if (intakeIdx === -1) continue;
    var intake = roadmap.intake_items[intakeIdx];
    var allDraftIds = intake.draft_ticket_ids || [];
    var allPromoted = allDraftIds.length > 0 && allDraftIds.every(function(dtId) {
      var dt = (roadmap.draft_tickets || []).find(function(d) { return d.id === dtId; });
      return dt && dt.status === "promoted";
    });
    if (allPromoted) {
      intake.status = "promoted";
      intake.updated_at = new Date().toISOString();
      roadmap.intake_items[intakeIdx] = intake;
    }
  }

  writeRoadmap(roadmap);
  var regenerated = regenerate();
  jsonResponse(res, 200, {
    ok: true,
    ticket: ticket,
    draft: draft,
    regenerated: regenerated,
  });
}

function handleContextRefresh(req, res) {
  var results = runContextRefresh();
  jsonResponse(res, 200, { ok: true, refresh: results });
}

function handleRecommendations(req, res) {
  // Regenerate to get fresh data from the full planning engine
  var ok = regenerate();
  if (!ok) {
    return jsonResponse(res, 500, { ok: false, errors: ["Regeneration failed"] });
  }
  // Read the recommendations JSON produced by the generator
  var recsPath = path.join(ROOT, "docs", "roadmap-recs.json");
  try {
    var recsData = JSON.parse(fs.readFileSync(recsPath, "utf8"));
    jsonResponse(res, 200, { ok: true, data: recsData });
  } catch (e) {
    jsonResponse(res, 500, { ok: false, errors: ["Could not read recommendations: " + e.message] });
  }
}

// ─── Post-Validation Target Inference ─────────────────────────
// Server-side mirror of the generator's inferPostValidationTargets().
// Derives sensible defaults from files_expected, type, and description.
// Rules: do NOT blindly refresh everything — only emit targets whose
// trigger conditions match the ticket's files and affected areas.

function inferPostValidationTargetsServer(files, type, description) {
  return shared.inferPostValidationTargets(files, type, description);
  /* --- Original body below is unreachable — canonical logic in roadmap-shared.js --- */
  var targets = [];
  var allFiles = (files || []).map(function(f) { return f.toLowerCase(); });
  var desc = (description || "").toLowerCase();
  var tt = (type || "task").toLowerCase();

  var hasRoutes      = allFiles.some(function(f) { return f.indexOf("/routes/") >= 0 || f.indexOf("routes.") >= 0; });
  var hasServices    = allFiles.some(function(f) { return f.indexOf("/services/") >= 0 || f.indexOf("service.") >= 0; });
  var hasRepos       = allFiles.some(function(f) { return f.indexOf("/repositories/") >= 0 || f.indexOf("repository.") >= 0; });
  var hasWorkflows   = allFiles.some(function(f) { return f.indexOf("/workflows/") >= 0 || f.indexOf("workflow.") >= 0; });
  var hasSchema      = allFiles.some(function(f) { return f.indexOf("schema.prisma") >= 0 || f.indexOf("/prisma/") >= 0; });
  var hasMigrations  = allFiles.some(function(f) { return f.indexOf("/migrations/") >= 0; });
  var hasAuth        = allFiles.some(function(f) { return f.indexOf("authz") >= 0 || f.indexOf("auth.") >= 0 || f.indexOf("/auth/") >= 0; });
  var hasDTO         = allFiles.some(function(f) { return f.indexOf("/dto") >= 0 || f.indexOf("dto.") >= 0 || f.indexOf("api-client") >= 0 || f.indexOf("openapi") >= 0; });
  var hasBlueprint   = allFiles.some(function(f) { return f.indexOf("blueprint") >= 0; });
  var hasRoadmap     = allFiles.some(function(f) { return f.indexOf("roadmap") >= 0 || f.indexOf("generate-roadmap") >= 0; });
  var hasWebPages    = allFiles.some(function(f) { return f.indexOf("apps/web/") >= 0 || f.indexOf("/pages/") >= 0; });
  var hasTransitions = allFiles.some(function(f) { return f.indexOf("transitions") >= 0; });
  var hasEvents      = allFiles.some(function(f) { return f.indexOf("/events/") >= 0 || f.indexOf("event.") >= 0; });
  var hasTests       = allFiles.some(function(f) { return f.indexOf(".test.") >= 0 || f.indexOf(".spec.") >= 0 || f.indexOf("/__tests__/") >= 0; });
  var hasGovernance  = allFiles.some(function(f) { return f.indexOf("/governance/") >= 0; });
  var hasAuditArea   = desc.indexOf("audit") >= 0 || desc.indexOf("finding") >= 0 || desc.indexOf("security") >= 0 || desc.indexOf("vulnerability") >= 0;
  var isBackend      = hasRoutes || hasServices || hasRepos || hasWorkflows || hasSchema || hasAuth || hasTransitions;

  targets.push("Run validation wizard: click \u2713 VALIDATE on ticket card");
  if (isBackend || hasDTO || hasBlueprint) targets.push("refresh docs/blueprint.html \u2014 cd apps/api && node blueprint.js");
  targets.push("refresh docs/roadmap.html \u2014 node scripts/generate-roadmap.js");
  if (isBackend || hasAuth || hasGovernance || hasTransitions || hasEvents || tt === "spike") targets.push("refresh PROJECT_STATE.md \u2014 update if architecture decisions changed");
  if (hasAuth || hasRoutes || hasWorkflows || hasServices || hasRepos || hasGovernance) targets.push("refresh apps/api/src/ARCHITECTURE_LOW_CONTEXT_GUIDE.md \u2014 update if auth/layers touched");
  if (hasAuditArea || hasAuth || hasGovernance || tt === "bug") targets.push("refresh docs/AUDIT.md \u2014 mark resolved findings, add new ones");
  if (hasSchema || hasMigrations) targets.push("refresh SCHEMA_REFERENCE.md \u2014 update if schema changed");
  if (hasDTO || hasRoutes || hasSchema) targets.push("verify DTO / OpenAPI / api-client sync");
  if (hasRoadmap) targets.push("review roadmap tooling docs \u2014 update How to Use tab if behavior changed");
  if (hasWebPages) targets.push("manual UI verification \u2014 check affected pages in browser");
  if (hasTests || isBackend) targets.push("run full test suite \u2014 npx tsc --noEmit && npm test");
  targets.push("Commit checklist: npx tsc --noEmit \u2192 npm test \u2192 npm run blueprint");

  return targets;
}

function handleInferTargets(req, res, ticketId) {
  var roadmap = readRoadmap();
  if (!roadmap.custom_items) roadmap.custom_items = [];

  var ticket = roadmap.custom_items.find(function(c) { return c.id === ticketId; });
  if (!ticket) {
    return jsonResponse(res, 404, { ok: false, errors: ["Ticket '" + ticketId + "' not found"] });
  }

  var targets = inferPostValidationTargetsServer(
    ticket.files_expected || [],
    ticket.type || "task",
    ticket.description || ""
  );

  jsonResponse(res, 200, {
    ok: true,
    ticket_id: ticketId,
    targets: targets,
    has_explicit: (ticket.post_validation && ticket.post_validation.length > 0),
    explicit_targets: ticket.post_validation || [],
  });
}

// ─── Server ───────────────────────────────────────────────────

const server = http.createServer(function (req, res) {
  const method = req.method;
  const url = req.url.split("?")[0]; // strip query params

  // CORS preflight
  if (method === "OPTIONS") {
    res.writeHead(200, {
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type",
    });
    return res.end();
  }

  // Health check — lets the roadmap UI detect whether the server is running
  if (method === "GET" && url === "/api/health") {
    return jsonResponse(res, 200, { ok: true });
  }

  // Static: serve roadmap.html
  if (method === "GET" && (url === "/" || url === "/index.html" || url === "/roadmap.html")) {
    if (!fs.existsSync(HTML_PATH)) {
      regenerate();
    }
    if (fs.existsSync(HTML_PATH)) {
      res.writeHead(200, { "Content-Type": "text/html; charset=utf-8" });
      return res.end(fs.readFileSync(HTML_PATH, "utf8"));
    }
    return jsonResponse(res, 500, { error: "roadmap.html not found" });
  }

  // API routes
  if (method === "GET" && url === "/api/roadmap") return handleGetRoadmap(req, res);
  if (method === "GET" && url === "/api/tickets") return handleListTickets(req, res);
  if (method === "POST" && url === "/api/tickets") return handleCreateTicket(req, res);
  if (method === "POST" && url === "/api/regenerate") return handleRegenerate(req, res);
  if (method === "POST" && url === "/api/context-refresh") return handleContextRefresh(req, res);
  if (method === "POST" && url === "/api/recommendations") return handleRecommendations(req, res);
  if (method === "GET" && url === "/api/next-ticket") return handleNextTicket(req, res);

  // /api/intake routes
  if (method === "GET" && url === "/api/intake") return handleListIntake(req, res);
  if (method === "POST" && url === "/api/intake") return handleCreateIntake(req, res);
  if (method === "POST" && url === "/api/intake/parse") return handleParseIntake(req, res);
  if (method === "POST" && url === "/api/intake/bulk-ingest") return handleBulkIngest(req, res);
  if (method === "POST" && url === "/api/intake/auto-triage") return handleAutoTriageBatch(req, res);
  if (method === "POST" && url === "/api/intake/promote-all") return handlePromoteIntakeBatch(req, res);

  var intakeMatch = url.match(/^\/api\/intake\/([^/]+?)(?:\/(triage|auto-triage|promote|split|refine-all|clarify|clarify-questions))?$/);
  if (intakeMatch) {
    var intakeId = decodeURIComponent(intakeMatch[1]);
    var intakeAction = intakeMatch[2];
    if (method === "GET" && intakeAction === "clarify-questions") return handleClarifyQuestions(req, res, intakeId);
    if (method === "PUT" && !intakeAction) return handleUpdateIntake(req, res, intakeId);
    if (method === "PUT" && intakeAction === "clarify") return handleClarifyIntake(req, res, intakeId);
    if (method === "DELETE" && !intakeAction) return handleDeleteIntake(req, res, intakeId);
    if (method === "POST" && intakeAction === "triage") return handleTriageIntake(req, res, intakeId);
    if (method === "POST" && intakeAction === "auto-triage") return handleAutoTriageSingle(req, res, intakeId);
    if (method === "POST" && intakeAction === "promote") return handlePromoteIntakeSingle(req, res, intakeId);
    if (method === "POST" && intakeAction === "split") return handleSplitIntake(req, res, intakeId);
    if (method === "POST" && intakeAction === "refine-all") return handleRefineAllFromEpic(req, res, intakeId);
  }

  // /api/drafts routes
  var draftMatch = url.match(/^\/api\/drafts\/([^/]+?)(?:\/(promote|refine|mark-ready|story-sync))?$/);
  if (draftMatch) {
    var draftId = decodeURIComponent(draftMatch[1]);
    var draftAction = draftMatch[2];
    if (method === "PUT" && !draftAction) return handleUpdateDraft(req, res, draftId);
    if (method === "DELETE" && !draftAction) return handleDeleteDraft(req, res, draftId);
    if (method === "POST" && draftAction === "promote") return handlePromoteDraft(req, res, draftId);
    if (method === "POST" && draftAction === "refine") return handleRefineDraft(req, res, draftId);
    if (method === "POST" && draftAction === "mark-ready") return handleMarkReady(req, res, draftId);
    if (method === "POST" && draftAction === "story-sync") return handleStorySync(req, res, draftId);
  }

  // /api/tickets/:id routes
  const ticketMatch = url.match(/^\/api\/tickets\/([^/]+?)(?:\/(dup|validate|infer-targets))?$/);
  if (ticketMatch) {
    const ticketId = decodeURIComponent(ticketMatch[1]);
    const action = ticketMatch[2]; // "dup", "validate", "infer-targets" or undefined

    if (method === "PUT" && !action) return handleUpdateTicket(req, res, ticketId);
    if (method === "POST" && action === "dup") return handleDuplicateTicket(req, res, ticketId);
    if (method === "POST" && action === "validate") return handleValidateTicket(req, res, ticketId);
    if (method === "POST" && action === "infer-targets") return handleInferTargets(req, res, ticketId);
    if (method === "DELETE" && !action) return handleDeleteTicket(req, res, ticketId);
  }

  // 404
  jsonResponse(res, 404, { error: "Not found" });
});

server.listen(PORT, function () {
  console.log("\n🗺️  Roadmap Server running on http://localhost:" + PORT);
  console.log("   ROADMAP.json → " + ROADMAP_PATH);
  console.log("   roadmap.html → " + HTML_PATH);
  console.log("\n   Open http://localhost:" + PORT + " in your browser.\n");
  console.log("   API:");
  console.log("     GET  /api/roadmap          → full ROADMAP.json");
  console.log("     GET  /api/tickets           → list custom_items");
  console.log("     POST /api/tickets           → create ticket");
  console.log("     PUT  /api/tickets/:id       → update ticket");
  console.log("     POST /api/tickets/:id/dup   → duplicate ticket");
  console.log("     POST /api/tickets/:id/validate → validate + mark done");
  console.log("     POST /api/tickets/:id/infer-targets → infer update targets");
  console.log("     DELETE /api/tickets/:id     → delete ticket");
  console.log("     POST /api/context-refresh   → refresh blueprint + roadmap");
  console.log("     POST /api/recommendations   → regenerate + return top 5");
  console.log("     POST /api/regenerate        → regenerate only");
  console.log("     GET  /api/intake            → list intake items + drafts");
  console.log("     POST /api/intake            → create intake item");
  console.log("     PUT  /api/intake/:id        → update intake item");
  console.log("     DELETE /api/intake/:id      → delete intake item");
  console.log("     POST /api/intake/:id/triage → triage → draft tickets");
  console.log("     POST /api/intake/auto-triage → batch auto-triage all raw/triaged");
  console.log("     POST /api/intake/:id/auto-triage → auto-triage single item");
  console.log("     POST /api/intake/:id/promote → promote intake → draft tickets");
  console.log("     POST /api/intake/:id/split → split intake into multiple draft tickets");
  console.log("     POST /api/intake/promote-all → batch promote all triaged items");
  console.log("     PUT  /api/drafts/:id        → update draft ticket");
  console.log("     DELETE /api/drafts/:id      → delete draft ticket");
  console.log("     POST /api/drafts/:id/refine  → enrich draft with project context");
  console.log("     POST /api/drafts/:id/mark-ready → validate + generate Copilot prompt");
  console.log("     POST /api/drafts/:id/story-sync → sync parent story progress");
  console.log("     POST /api/drafts/:id/promote → promote draft → custom item");
  console.log("     POST /api/intake/:id/refine-all → batch refine all children");
  console.log("     GET  /api/next-ticket       → select next ready ticket\n");
});
