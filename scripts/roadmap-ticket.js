#!/usr/bin/env node
/**
 * roadmap-ticket.js
 *
 * CLI tool for managing tickets in ROADMAP.json.
 * Operates on the custom_items[] array — the operator-created work items.
 *
 * Commands:
 *   create   — add a new custom ticket
 *   start    — set status to in_progress
 *   complete — set status to done
 *   block    — set status to blocked
 *   edit     — modify fields on an existing ticket
 *   list     — show all custom items
 *   next     — show the next chronological ticket from the full queue
 *
 * Usage:
 *   node scripts/roadmap-ticket.js create --phase P1 --title "As a manager..." --type task
 *   node scripts/roadmap-ticket.js start US-001
 *   node scripts/roadmap-ticket.js complete US-001
 *   node scripts/roadmap-ticket.js edit US-001 --status done --notes "Updated criteria"
 *   node scripts/roadmap-ticket.js list
 *   node scripts/roadmap-ticket.js next
 *
 * After any mutation, run `npm run roadmap` to regenerate docs/roadmap.html.
 * If roadmap:watch is running, regeneration is automatic.
 */

const fs = require("fs");
const path = require("path");

const ROOT = path.resolve(__dirname, "..");
const ROADMAP_PATH = path.join(ROOT, "ROADMAP.json");const shared = require("./roadmap-shared");
// ─── Helpers ──────────────────────────────────────────────────

function readRoadmap() {
  if (!fs.existsSync(ROADMAP_PATH)) {
    console.error("✘ ROADMAP.json not found at", ROADMAP_PATH);
    process.exit(1);
  }
  return JSON.parse(fs.readFileSync(ROADMAP_PATH, "utf8"));
}

function writeRoadmap(data) {
  fs.writeFileSync(ROADMAP_PATH, JSON.stringify(data, null, 2) + "\n", "utf8");
}

function parseArgs(args) {
  const result = { _positional: [] };
  for (let i = 0; i < args.length; i++) {
    if (args[i].startsWith("--")) {
      const key = args[i].slice(2);
      const val = (i + 1 < args.length && !args[i + 1].startsWith("--")) ? args[++i] : true;
      result[key] = val;
    } else {
      result._positional.push(args[i]);
    }
  }
  return result;
}

// Delegated to shared module — single source of truth
const generateId = shared.generateId;

// ─── Commands ─────────────────────────────────────────────────

function cmdCreate(opts) {
  if (!opts.title) {
    console.error("✘ --title is required");
    console.error("  Usage: node scripts/roadmap-ticket.js create --phase P1 --title \"...\" --type task");
    process.exit(1);
  }

  const roadmap = readRoadmap();
  if (!roadmap.custom_items) roadmap.custom_items = [];

  const type = opts.type || "task";
  const id = generateId(type, roadmap.custom_items);

  const item = {
    id: id,
    phase: opts.phase || "P1",
    title: opts.title,
    type: type,
    status: opts.status || "planned",
  };
  if (opts.persona) item.persona = opts.persona;
  if (opts.ticket) item.ticket = opts.ticket;
  if (opts.notes) item.notes = opts.notes;

  // Backfill required testing metadata (canonical defaults from roadmap-shared.js)
  shared.backfillTestingDefaults([item]);

  roadmap.custom_items.push(item);
  writeRoadmap(roadmap);

  console.log("✔ Created " + id + ": " + item.title);
  console.log("  Phase: " + item.phase + " · Type: " + item.type + " · Status: " + item.status);
  console.log("\n  Run 'npm run roadmap' to regenerate roadmap.html");
}

function cmdStart(id) {
  if (!id) {
    console.error("✘ Ticket ID required. Usage: node scripts/roadmap-ticket.js start <ID>");
    process.exit(1);
  }
  setStatus(id, "in_progress", "Started");
}

function cmdComplete(id) {
  if (!id) {
    console.error("✘ Ticket ID required. Usage: node scripts/roadmap-ticket.js complete <ID>");
    process.exit(1);
  }
  setStatus(id, "done", "Completed");
}

function cmdBlock(id) {
  if (!id) {
    console.error("✘ Ticket ID required. Usage: node scripts/roadmap-ticket.js block <ID>");
    process.exit(1);
  }
  setStatus(id, "blocked", "Blocked");
}

function setStatus(id, newStatus, verb) {
  const roadmap = readRoadmap();
  const items = roadmap.custom_items || [];
  const idx = items.findIndex(function (i) { return i.id === id; });

  if (idx === -1) {
    // Also check features and slices — allow marking those too
    var found = false;
    for (var fi = 0; fi < (roadmap.features || []).length; fi++) {
      var f = roadmap.features[fi];
      if (f.id === id) {
        // Can't set status on auto-detected features directly — need manual override
        console.log("⚠ " + id + " is an auto-detected feature. Set its status via detection signals, not manually.");
        console.log("  To override, add a 'status' field to the feature in ROADMAP.json.");
        return;
      }
      var slices = f.slices || [];
      for (var si = 0; si < slices.length; si++) {
        if (slices[si].id === id) {
          console.log("⚠ " + id + " is an auto-detected slice. Its status is derived from completion_signals.");
          return;
        }
      }
    }
    console.error("✘ Ticket " + id + " not found in custom_items[]");
    process.exit(1);
  }

  // ── Status-transition gates (canonical logic in roadmap-shared.js) ──
  var ticket = items[idx];
  var gateErrors = shared.validateStatusTransitionGates(ticket, newStatus);
  if (gateErrors.length > 0) {
    console.error("✘ Cannot " + verb.toLowerCase() + " " + id + ":");
    gateErrors.forEach(function(e) { console.error("  " + e); });
    process.exit(1);
  }

  var oldStatus = items[idx].status;
  items[idx].status = newStatus;
  writeRoadmap(roadmap);
  console.log("✔ " + verb + " " + id + ": " + items[idx].title + " (" + oldStatus + " → " + newStatus + ")");
  console.log("\n  Run 'npm run roadmap' to regenerate roadmap.html");
}

function cmdEdit(id, opts) {
  if (!id) {
    console.error("✘ Ticket ID required. Usage: node scripts/roadmap-ticket.js edit <ID> --field value");
    process.exit(1);
  }

  const roadmap = readRoadmap();
  const items = roadmap.custom_items || [];
  const idx = items.findIndex(function (i) { return i.id === id; });

  if (idx === -1) {
    console.error("✘ Ticket " + id + " not found in custom_items[]");
    process.exit(1);
  }

  const scalarFields = ["title", "phase", "type", "status", "persona", "ticket", "notes", "description", "test-protocol", "parent-feature", "order"];
  const arrayFields = ["acceptance-criteria", "required-tests", "validation-checklist", "post-validation", "files-expected", "depends-on"];
  const editable = scalarFields.concat(arrayFields);
  let changed = [];

  for (const field of scalarFields) {
    const key = field.replace(/-/g, "_");
    if (opts[field] !== undefined) {
      items[idx][key] = field === "order" ? parseInt(opts[field], 10) : opts[field];
      changed.push(key);
    }
  }
  for (const field of arrayFields) {
    const key = field.replace(/-/g, "_");
    if (opts[field] !== undefined) {
      items[idx][key] = String(opts[field]).split(",").map(function(s) { return s.trim(); }).filter(Boolean);
      changed.push(key);
    }
  }

  if (changed.length === 0) {
    console.log("⚠ No fields to update. Editable fields: " + editable.join(", "));
    return;
  }

  writeRoadmap(roadmap);
  console.log("✔ Updated " + id + ": " + changed.join(", "));
  console.log("  Run 'npm run roadmap' to regenerate roadmap.html");
}

function cmdList() {
  const roadmap = readRoadmap();
  const items = roadmap.custom_items || [];

  if (items.length === 0) {
    console.log("No custom tickets yet. Use 'create' to add one.");
    return;
  }

  console.log("Custom Tickets (" + items.length + "):\n");
  const statusIcons = { planned: "○", in_progress: "◐", done: "●", blocked: "⊘" };

  for (const item of items) {
    const icon = statusIcons[item.status] || "?";
    console.log(
      "  " + icon + " " + item.id.padEnd(10) +
      item.phase.padEnd(4) +
      item.type.padEnd(13) +
      item.status.padEnd(13) +
      item.title
    );
  }
}

function cmdNext() {
  // Uses the full 9-rule ranking from the generator (single source of truth).
  // Reads the recommendations JSON produced by: node scripts/generate-roadmap.js
  const recsPath = path.join(ROOT, "docs", "roadmap-recs.json");

  let recsData;
  try {
    recsData = JSON.parse(fs.readFileSync(recsPath, "utf8"));
  } catch (e) {
    console.log("⚠ No recommendations found. Run: node scripts/generate-roadmap.js first.");
    return;
  }

  if (!recsData.next_id) {
    console.log("✔ All items are done or blocked!");
    console.log("  Open docs/roadmap.html for the full queue.");
    return;
  }

  const recs = recsData.recommendations || [];
  const next = recs.find(function (r) { return r.id === recsData.next_id; }) || recs[0];
  if (!next) {
    console.log("⚠ No actionable recommendations found.");
    return;
  }

  console.log("NEXT UP (from chronological queue — 9-rule ranking):");
  console.log("  " + next.id + " · " + next.phase + " · " + next.type);
  console.log("  " + next.title);
  if (next.parentTitle) console.log("  ↳ " + next.parentId + ": " + next.parentTitle);
  if (next.reasons && next.reasons.length > 0) {
    console.log("  Why: " + next.reasons.join(" · "));
  }
  console.log("\n  Total in queue: " + (recsData.total_in_queue || "?"));
  console.log("  Generated: " + (recsData.generated_at || "unknown"));
  console.log("\n  For the full top 5 and prompts, open docs/roadmap.html");
}

function cmdValidate(id) {
  if (!id) {
    console.error("✘ Ticket ID required. Usage: node scripts/roadmap-ticket.js validate <ID>");
    process.exit(1);
  }

  const roadmap = readRoadmap();
  const items = roadmap.custom_items || [];
  const idx = items.findIndex(function (i) { return i.id === id; });

  if (idx === -1) {
    console.error("✘ Ticket " + id + " not found in custom_items[]");
    process.exit(1);
  }

  const ticket = items[idx];

  // Gate checks (canonical logic in roadmap-shared.js)
  const missing = shared.validateGatesForValidation(ticket);
  if (missing.length > 0) {
    console.error("✘ Cannot validate " + id + " — missing: " + missing.join(", "));
    console.error("  Edit the ticket to add the missing fields first.");
    process.exit(1);
  }

  console.log("");
  console.log("═════════════════════════════════════════════════════════");
  console.log("  VALIDATE TICKET: " + id);
  console.log("  " + ticket.title);
  console.log("═════════════════════════════════════════════════════════");
  console.log("");

  // Step 1: Test Protocol
  console.log("STEP 1 — Test Protocol");
  console.log("─────────────────────────────────────────────");
  var protocolSteps = ticket.test_protocol.split("\n");
  for (var pi = 0; pi < protocolSteps.length; pi++) {
    console.log("  □ " + protocolSteps[pi]);
  }
  console.log("\n  Run these commands and confirm all pass.\n");

  // Step 2: Validation Checklist
  console.log("STEP 2 — Validation Checklist");
  console.log("─────────────────────────────────────────────");
  for (var ci = 0; ci < ticket.validation_checklist.length; ci++) {
    console.log("  □ " + ticket.validation_checklist[ci]);
  }
  console.log("");

  // Step 3: Context Refresh
  console.log("STEP 3 — Context Refresh");
  console.log("─────────────────────────────────────────────");
  console.log("  Auto-refresh (run these):");
  console.log("    cd apps/api && node blueprint.js     # → docs/blueprint.html");
  console.log("    node scripts/generate-roadmap.js     # → docs/roadmap.html");
  console.log("");
  console.log("  Manual review (check if affected):");
  console.log("    □ PROJECT_STATE.md                  — update backlog/epic history if changed");
  console.log("    □ apps/api/src/ARCHITECTURE_LOW_CONTEXT_GUIDE.md — update if auth/layer rules touched");
  console.log("    □ docs/AUDIT.md                     — mark resolved findings, add new ones");
  console.log("    □ SCHEMA_REFERENCE.md               — update if Prisma schema changed");
  console.log("");

  // Step 4: Post-Validation
  console.log("STEP 4 — Post-Validation");
  console.log("─────────────────────────────────────────────");
  for (var vi = 0; vi < ticket.post_validation.length; vi++) {
    console.log("  □ " + ticket.post_validation[vi]);
  }
  console.log("");

  // Mark validated
  ticket.status = "done";
  ticket.validated_at = new Date().toISOString();
  items[idx] = ticket;
  writeRoadmap(roadmap);

  console.log("✔ Validated " + id + " → status: done · validated_at: " + ticket.validated_at);
  console.log("\n  Run 'npm run roadmap' to regenerate roadmap.html");
}

// ─── Main ─────────────────────────────────────────────────────

function main() {
  const args = process.argv.slice(2);
  const opts = parseArgs(args);
  const command = opts._positional[0];
  const id = opts._positional[1];

  switch (command) {
    case "create":
      cmdCreate(opts);
      break;
    case "start":
      cmdStart(id);
      break;
    case "complete":
      cmdComplete(id);
      break;
    case "block":
      cmdBlock(id);
      break;
    case "edit":
      cmdEdit(id, opts);
      break;
    case "list":
      cmdList();
      break;
    case "next":
      cmdNext();
      break;
    case "validate":
      cmdValidate(id);
      break;
    default:
      console.log("roadmap-ticket — CLI for ROADMAP.json ticket management\n");
      console.log("Commands:");
      console.log("  create   --phase P1 --title \"...\" --type task [--persona manager] [--ticket GH-123] [--notes \"...\"]");
      console.log("  start    <ID>              Set status → in_progress");
      console.log("  complete <ID>              Set status → done");
      console.log("  block    <ID>              Set status → blocked");
      console.log("  edit     <ID> --field val  Update any field");
      console.log("  list                       Show all custom tickets");
      console.log("  next                       Show next chronological ticket");
      console.log("  validate <ID>              Guided validation wizard + mark done");
      console.log("\nExamples:");
      console.log("  node scripts/roadmap-ticket.js create --phase P1 --title \"Add tenant portal search\" --type task");
      console.log("  node scripts/roadmap-ticket.js start TASK-001");
      console.log("  node scripts/roadmap-ticket.js complete TASK-001");
      console.log("  node scripts/roadmap-ticket.js validate TASK-001");
      console.log("  node scripts/roadmap-ticket.js list");
      break;
  }
}

main();
