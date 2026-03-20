#!/usr/bin/env node
/**
 * roadmap-parser.js
 *
 * Deterministic unstructured-intake parser for the roadmap system.
 * Takes pasted product notes (meeting minutes, bullet lists, mixed
 * headings) and splits them into clean atomic intake items.
 *
 * Design principles:
 *   - Deterministic: no LLM, no randomness, same input → same output
 *   - Readable: every heuristic is an explicit rule with comments
 *   - Lossless: raw_text always preserves the original wording
 *   - Source-order: output items follow the order they appeared in input
 *   - Section-aware: headings propagate product_area to child bullets
 *
 * Usage (library):
 *   const { parseIntakeBlob } = require("./roadmap-parser");
 *   const items = parseIntakeBlob(text, { source: "meeting" });
 *
 * Usage (CLI, for testing):
 *   echo "..." | node scripts/roadmap-parser.js
 *   node scripts/roadmap-parser.js < notes.txt
 */

// ─── Section Heading Detection ────────────────────────────────
//
// A "heading" is a line that names a product area or domain.
// We recognize two patterns:
//   1. Lines that are all-caps, title-case, or end with ":"
//   2. Markdown-style headings (# ... or ## ...)
// Headings are NOT emitted as intake items — they set context.

const HEADING_PATTERNS = [
  /^#{1,4}\s+(.+)$/,                       // Markdown: # Heading
  /^([A-Z][A-Za-z /&-]+):?\s*$/,           // Title Case Line (optionally ending with :)
  /^([A-Z][A-Z /&-]{4,})\s*$/,             // ALL CAPS LINE (5+ chars)
  /^[-=]{3,}\s*$/,                          // Separator lines (---, ===) — skip
];

function isHeading(line) {
  for (var i = 0; i < HEADING_PATTERNS.length; i++) {
    if (HEADING_PATTERNS[i].test(line)) return true;
  }
  return false;
}

function extractHeadingText(line) {
  // Try markdown first
  var md = line.match(/^#{1,4}\s+(.+)$/);
  if (md) return md[1].replace(/:$/, "").trim();
  // Title-case or ALL-CAPS line
  return line.replace(/:$/, "").trim();
}

// ─── Product Area Inference ───────────────────────────────────
//
// Maps section headings and keywords → canonical product_area values.
// The first matching rule wins.

const AREA_RULES = [
  { pattern: /owner\s*dashboard|owner\s*portal|owner/i,           area: "owner-portal" },
  { pattern: /tenant\s*dashboard|tenant\s*portal|tenant/i,        area: "tenant-portal" },
  { pattern: /contractor\s*dashboard|contractor\s*portal/i,       area: "contractor-portal" },
  { pattern: /lease|bail|contract\s*management/i,                  area: "leases" },
  { pattern: /legal\s*engine|legal\s*dsl|legal\s*variable/i,      area: "legal-engine" },
  { pattern: /inventory|appliance|asset|equipment/i,               area: "inventory" },
  { pattern: /work\s*request|maintenance\s*request|request/i,      area: "requests" },
  { pattern: /job|work\s*order/i,                                  area: "jobs" },
  { pattern: /invoice|billing|payment|accounting|vat|finance/i,    area: "invoicing" },
  { pattern: /rfp|request\s*for\s*proposal|quote/i,               area: "rfp" },
  { pattern: /notification|email|sms|alert/i,                     area: "notifications" },
  { pattern: /document|pdf|upload|file|attachment/i,               area: "documents" },
  { pattern: /navigation|sidebar|menu|breadcrumb|layout/i,        area: "navigation" },
  { pattern: /dashboard|overview|summary|reporting|analytics/i,    area: "reporting" },
  { pattern: /auth|login|session|permission|role/i,                area: "auth" },
  { pattern: /building|property|unit|address/i,                   area: "buildings" },
  { pattern: /schedule|calendar|appointment/i,                     area: "scheduling" },
  { pattern: /search|filter|sort/i,                                area: "search" },
  { pattern: /ui|style|css|design|polish|color|font|icon/i,       area: "ui-polish" },
  { pattern: /api|endpoint|route|backend/i,                       area: "api" },
  { pattern: /test|coverage|jest|integration/i,                   area: "testing" },
  { pattern: /migration|schema|prisma|database/i,                 area: "database" },
];

function inferProductArea(text, sectionArea) {
  // Section heading takes priority as baseline
  // But if the note itself mentions a more specific area, use that
  for (var i = 0; i < AREA_RULES.length; i++) {
    if (AREA_RULES[i].pattern.test(text)) {
      return AREA_RULES[i].area;
    }
  }
  return sectionArea || null;
}

function inferAreaFromHeading(headingText) {
  for (var i = 0; i < AREA_RULES.length; i++) {
    if (AREA_RULES[i].pattern.test(headingText)) {
      return AREA_RULES[i].area;
    }
  }
  return null;
}

// ─── Note Type Classification ─────────────────────────────────
//
// Classify each note by its likely type based on keyword matching.
// Returns a string label. The first matching rule wins.

const TYPE_RULES = [
  { pattern: /\bbug\b|broken|crash|error|doesn't work|not working|404|500|wrong|regression|misalign/i,
    type: "bug" },
  { pattern: /\bpolish\b|cosmetic|align|spacing|padding|margin|font|color|icon|border|radius|shadow|style|css|visual|pixel|layout\s*(fix|tweak)|ui\s*(fix|tweak|issue)|look\s*and\s*feel/i,
    type: "ui_polish" },
  { pattern: /workflow|process|status\s*transition|lifecycle|approval|pipeline|automat/i,
    type: "workflow_improvement" },
  { pattern: /report|dashboard|chart|graph|metric|kpi|analytics|summary|export\s*csv|export\s*pdf|statistic/i,
    type: "reporting" },
  { pattern: /legal\s*engine|legal\s*dsl|legal\s*variable|clause|template\s*engine/i,
    type: "legal_engine_cleanup" },
  { pattern: /integrat|webhook|api\s*connect|third.?party|external|sync\s*with|import\s*from|connect\s*to/i,
    type: "integration" },
  { pattern: /add\s*ability|allow\s*user|enable|new\s*feature|support\s*for|implement|create\s*a|build\s*a|should\s*be\s*able|want\s*to|need\s*to\s*be\s*able/i,
    type: "feature_request" },
];

function inferNoteType(text) {
  for (var i = 0; i < TYPE_RULES.length; i++) {
    if (TYPE_RULES[i].pattern.test(text)) {
      return TYPE_RULES[i].type;
    }
  }
  return "feature_request";  // default — most intake is feature work
}

// ─── Dependency Detection ─────────────────────────────────────
//
// Detect language that implies this item has dependencies or blockers.
// Returns an array of dependency hint strings extracted from the text.

const DEPENDENCY_PATTERNS = [
  { pattern: /depends?\s*on\s+(.+?)(?:\.|,|$)/i,                  extract: 1 },
  { pattern: /requires?\s+(.+?)(?:\s*(?:first|before|to\s*be))/i, extract: 1 },
  { pattern: /blocked\s*by\s+(.+?)(?:\.|,|$)/i,                   extract: 1 },
  { pattern: /after\s+(.+?)\s+(?:is|are)\s+(?:done|complete|ready)/i, extract: 1 },
  { pattern: /needs?\s+(.+?)\s+(?:first|before)/i,                extract: 1 },
  { pattern: /requires?\s+mapping/i,                               extract: 0, hint: "requires mapping" },
  { pattern: /to\s*be\s*analysed\s*further|tbd|to\s*be\s*determined/i, extract: 0, hint: "needs analysis" },
  { pattern: /not\s*(?:yet\s*)?(?:working|implemented|wired|connected)/i, extract: 0, hint: "not yet implemented" },
  { pattern: /at\s*the\s*moment\s*it'?s?\s*(?:there\s*)?but\s*not\s*working/i, extract: 0, hint: "exists but not working" },
];

function detectDependencies(text) {
  var deps = [];
  for (var i = 0; i < DEPENDENCY_PATTERNS.length; i++) {
    var rule = DEPENDENCY_PATTERNS[i];
    var m = text.match(rule.pattern);
    if (m) {
      if (rule.hint) {
        deps.push(rule.hint);
      } else if (rule.extract && m[rule.extract]) {
        deps.push(m[rule.extract].trim());
      }
    }
  }
  return deps;
}

// ─── Split Detection (Prompt G — anti-over-splitting) ─────────
//
// Conservative split heuristics. A story should be split ONLY if:
//   - It spans clearly separable layers or workflows
//   - It has independent prerequisites
//   - It cannot be executed safely in one ticket
//   - It contains mixed concerns (bug + workflow + UX + integration)
//   - It would produce an unreasonably large Copilot prompt if kept whole
//
// A story should NOT be split if:
//   - The resulting children lose the user-visible outcome
//   - The resulting children are too tiny / purely mechanical
//   - The story is coherent and executable as one unit
//   - Children cannot be validated independently

function detectSplitRecommended(text) {
  var result = assessSplitDecision(text);
  return result.should_split;
}

/**
 * assessSplitDecision(rawText, noteType, productArea, splitPlan)
 *
 * Returns a rich split assessment with confidence and strategy.
 * @returns {{ should_split, split_confidence, split_strategy, why_not_one_ticket, anti_split_reasons }}
 */
function assessSplitDecision(rawText, noteType, productArea, splitPlan) {
  var text = rawText || "";
  var result = {
    should_split: false,
    split_confidence: "low",
    split_strategy: null,
    why_not_one_ticket: null,
    anti_split_reasons: [],
  };

  if (!text || text.length < 80) return result;

  // --- Pro-split signals (weighted) ---
  var splitScore = 0;
  var splitReasons = [];

  // Multiple sentences with different concerns (3+)
  var sentences = text.split(/[.!?]\s+/).filter(function(s) { return s.trim().length > 15; });
  if (sentences.length >= 5) { splitScore += 3; splitReasons.push("5+ distinct sentences"); }
  else if (sentences.length >= 3) { splitScore += 1; }

  // Explicit conjunctions joining separate concerns
  if (/(?:^|[.;])\s*(?:also|additionally|plus|and\s+also|on\s+top\s+of\s+that|separately)/i.test(text)) {
    splitScore += 2; splitReasons.push("Explicit separate-concern conjunctions");
  }

  // Sub-bullets or numbered sub-items (3+)
  var bullets = text.split(/[\n\r]/).filter(function(l) { return /^[-•*]\s|^\d+[.)]\s/.test(l.trim()); });
  if (bullets.length >= 4) { splitScore += 3; splitReasons.push(bullets.length + " sub-items"); }
  else if (bullets.length >= 2) { splitScore += 1; }

  // Mixed concern keywords (bug + feature, API + UI, schema + frontend)
  var hasBugRef = /\bbug\b|\bfix\b|\bbroken\b|\bcrash/i.test(text);
  var hasFeatureRef = /\badd\b|\bcreate\b|\bimplement\b|\bnew\b/i.test(text);
  var hasApiRef = /\bapi\b|\bendpoint\b|\broute\b|\bservice\b/i.test(text);
  var hasUiRef = /\bui\b|\bpage\b|\bscreen\b|\bfrontend\b|\bdashboard/i.test(text);
  var hasSchemaRef = /\bschema\b|\bmigration\b|\bmodel\b|\bprisma/i.test(text);
  var mixedCount = [hasBugRef && hasFeatureRef, hasApiRef && hasUiRef, hasSchemaRef && hasUiRef]
    .filter(Boolean).length;
  if (mixedCount >= 1) { splitScore += 2; splitReasons.push("Mixed concerns (e.g. bug+feature, API+UI)"); }

  // Very long (likely multiple concerns)
  if (text.length > 600) { splitScore += 2; splitReasons.push("Very long text (" + text.length + " chars)"); }
  else if (text.length > 400) { splitScore += 1; }

  // --- Anti-split signals (reduce score) ---
  var antiReasons = [];

  // Short coherent text → keep as one
  if (text.length < 200 && sentences.length <= 2) {
    splitScore -= 3; antiReasons.push("Short, coherent text — executable as one unit");
  }

  // Single domain / single layer → likely one ticket
  if (!hasApiRef && !hasSchemaRef && hasUiRef) {
    splitScore -= 1; antiReasons.push("Single-layer work (UI only)");
  }
  if (!hasUiRef && !hasSchemaRef && hasApiRef) {
    splitScore -= 1; antiReasons.push("Single-layer work (API only)");
  }

  // If the split would produce < 2 meaningful children, don't split
  if (splitPlan && splitPlan.length > 0) {
    var thinCount = 0;
    for (var ci = 0; ci < splitPlan.length; ci++) {
      if (detectThinChild(splitPlan[ci].title || "", text)) thinCount++;
    }
    if (thinCount > splitPlan.length / 2) {
      splitScore -= 3; antiReasons.push("Most children would be too thin to validate independently");
    }
  }

  // Cohesive single-verb-phrase title → likely one ticket
  if (sentences.length <= 2 && !/\band\b.*\band\b/i.test(text)) {
    splitScore -= 1; antiReasons.push("Cohesive single concern");
  }

  result.anti_split_reasons = antiReasons;

  // --- Decision ---
  if (splitScore >= 4) {
    result.should_split = true;
    result.split_confidence = "high";
  } else if (splitScore >= 2) {
    result.should_split = true;
    result.split_confidence = "medium";
  } else if (splitScore >= 1) {
    result.should_split = true;
    result.split_confidence = "low";
  } else {
    result.should_split = false;
    result.split_confidence = "low";
  }

  // --- Strategy ---
  if (result.should_split) {
    result.split_strategy = assignSplitStrategy(text, noteType, productArea);
    result.why_not_one_ticket = generateWhyNotOneTicket(splitReasons, text);
  }

  return result;
}

function assignSplitStrategy(text, noteType, productArea) {
  var t = (text || "").toLowerCase();
  // Blocked prerequisites
  if (/\bprerequisite\b|\bbefore\b.*\bcan\b|\bneeds?\b.*\bfirst\b|\bunblock/i.test(t)) return "blocked_prereqs";
  // Phased: mentions phases, stages, iterative delivery
  if (/\bphase\b|\bstage\b|\biter/i.test(t) || /\bfirst\b.*\bthen\b/i.test(t)) return "phased";
  // Layered: spans API + UI + schema
  var layers = 0;
  if (/\bapi\b|\bendpoint\b|\broute\b|\bservice\b/i.test(t)) layers++;
  if (/\bui\b|\bpage\b|\bfrontend\b|\bdashboard/i.test(t)) layers++;
  if (/\bschema\b|\bmigration\b|\bmodel\b/i.test(t)) layers++;
  if (layers >= 2) return "layered";
  // Workflow steps: sequential actions
  if (/\bthen\b|\bafter\b|\bnext\b|\bonce\b.*\bis\b/i.test(t)) return "workflow_steps";
  return "phased";
}

function generateWhyNotOneTicket(splitReasons, text) {
  if (splitReasons.length === 0) return "Scope is large enough to warrant focused slices";
  return splitReasons.slice(0, 3).join("; ") + ".";
}

function detectThinChild(childTitle, parentRawText) {
  if (!childTitle) return true;
  var t = childTitle.trim().toLowerCase();
  // Too short to be meaningful
  if (t.length < 15) return true;
  // Purely mechanical / procedural without user-visible outcome
  if (/^update\s|^change\s|^modify\s|^move\s|^rename\s/i.test(t) && t.length < 40) return true;
  // Just a file name or path
  if (/^[a-z]+\.(ts|js|css|json)$/i.test(t)) return true;
  return false;
}

function detectFoundationalChild(childTitle) {
  var t = (childTitle || "").toLowerCase();
  return /schema|migration|model|prisma|prerequisite|foundation|enable|unblock|prepare|setup/i.test(t);
}

// ─── Title Normalization ──────────────────────────────────────
//
// Create a clean, concise title from raw note text.
// Strategy:
//   1. Take first sentence or first line (whichever is shorter)
//   2. Strip bullet/number prefixes
//   3. Capitalize first letter
//   4. Truncate at 120 chars

function normalizeTitle(rawText) {
  var text = rawText.trim();

  // Strip bullet/number prefix
  text = text.replace(/^(?:\d+[.)]\s*|[-•*]\s*|>\s*)/, "");

  // Take first sentence (up to period, question mark, exclamation)
  var firstSentence = text.match(/^(.+?)[.!?](?:\s|$)/);
  if (firstSentence) {
    text = firstSentence[1].trim();
  } else {
    // Take first line
    var firstLine = text.split(/\n/)[0].trim();
    text = firstLine;
  }

  // Remove leading conjunctions
  text = text.replace(/^(?:and\s+|but\s+|also\s+|then\s+|so\s+)/i, "");

  // Capitalize first letter
  if (text.length > 0) {
    text = text[0].toUpperCase() + text.slice(1);
  }

  // Truncate
  if (text.length > 120) {
    text = text.substring(0, 117) + "\u2026";
  }

  return text || null;
}

// ─── Line Classification ──────────────────────────────────────
//
// Classify each line: heading, bullet, continuation, blank

function classifyLine(line) {
  var trimmed = line.trim();
  if (trimmed.length === 0) return { type: "blank", text: trimmed };
  if (/^[-=]{3,}\s*$/.test(trimmed)) return { type: "separator", text: trimmed };
  if (isHeading(trimmed)) return { type: "heading", text: trimmed };
  if (/^(?:\d+[.)]\s|[-•*]\s|>\s)/.test(trimmed)) return { type: "bullet", text: trimmed };
  // Indented continuation of a bullet
  if (/^\s{2,}/.test(line) && trimmed.length > 0) return { type: "continuation", text: trimmed };
  // Standalone text line (likely a bullet without marker)
  return { type: "text", text: trimmed };
}

// ─── Main Parser ──────────────────────────────────────────────

/**
 * parseIntakeBlob(text, opts)
 *
 * Splits unstructured text into atomic intake items.
 *
 * @param {string} text  - Raw pasted text blob
 * @param {object} [opts]
 * @param {string} [opts.source]       - Source label (default: "bulk_paste")
 * @param {string} [opts.product_area] - Override product area for all items
 * @returns {Array<object>} Array of intake item shapes (without id/timestamps)
 */
function parseIntakeBlob(text, opts) {
  opts = opts || {};
  var source = opts.source || "bulk_paste";
  var overrideArea = opts.product_area || null;

  var lines = text.split(/\n/);
  var classified = lines.map(classifyLine);

  // ── Phase 1: Group lines into raw chunks ──
  // A chunk is either a single heading or a block of content lines
  // (bullet + continuations). Blanks separate chunks.

  var chunks = [];
  var currentChunk = null;
  var currentSection = null;  // nearest section heading text

  for (var i = 0; i < classified.length; i++) {
    var cl = classified[i];

    if (cl.type === "blank" || cl.type === "separator") {
      // Flush current chunk
      if (currentChunk) {
        chunks.push(currentChunk);
        currentChunk = null;
      }
      continue;
    }

    if (cl.type === "heading") {
      // Flush any pending chunk
      if (currentChunk) {
        chunks.push(currentChunk);
        currentChunk = null;
      }
      currentSection = extractHeadingText(cl.text);
      // Don't emit headings as chunks — they just set context
      continue;
    }

    if (cl.type === "bullet") {
      // Each bullet starts a new chunk
      if (currentChunk) {
        chunks.push(currentChunk);
      }
      currentChunk = {
        rawLines: [cl.text],
        section: currentSection,
        lineIndex: i,
      };
      continue;
    }

    if (cl.type === "continuation") {
      if (currentChunk) {
        currentChunk.rawLines.push(cl.text);
      } else {
        // Orphan continuation — treat as new chunk
        currentChunk = {
          rawLines: [cl.text],
          section: currentSection,
          lineIndex: i,
        };
      }
      continue;
    }

    // "text" type — standalone line
    if (cl.type === "text") {
      // If we're in a chunk and this looks like it continues, append
      if (currentChunk && (i > 0 && classified[i - 1].type !== "blank")) {
        currentChunk.rawLines.push(cl.text);
      } else {
        // Start new chunk
        if (currentChunk) {
          chunks.push(currentChunk);
        }
        currentChunk = {
          rawLines: [cl.text],
          section: currentSection,
          lineIndex: i,
        };
      }
      continue;
    }
  }
  // Flush last chunk
  if (currentChunk) {
    chunks.push(currentChunk);
  }

  // ── Phase 2: Convert chunks → intake items ──
  var items = [];
  for (var c = 0; c < chunks.length; c++) {
    var chunk = chunks[c];
    var rawText = chunk.rawLines.join("\n");

    // Strip bullet prefix for analysis but keep in raw_text
    var cleanText = rawText.replace(/^(?:\d+[.)]\s*|[-•*]\s*|>\s*)/, "");

    var sectionArea = chunk.section ? inferAreaFromHeading(chunk.section) : null;
    var productArea = overrideArea || inferProductArea(cleanText, sectionArea);
    // If section had a name but no area rule matched, use the section name as-is
    if (!productArea && chunk.section) {
      productArea = chunk.section.toLowerCase().replace(/\s+/g, "-");
    }

    var title = normalizeTitle(rawText);
    var noteType = inferNoteType(cleanText);
    var dependencies = detectDependencies(cleanText);
    var splitRec = detectSplitRecommended(cleanText);

    items.push({
      raw_text: rawText,
      title: title,
      source: source,
      product_area: productArea,
      note_type: noteType,
      dependencies: dependencies,
      split_recommended: splitRec,
      section_heading: chunk.section || null,
      source_line: chunk.lineIndex + 1,  // 1-based for humans
    });
  }

  return items;
}

// ─── CLI mode ─────────────────────────────────────────────────

if (require.main === module) {
  var input = "";
  process.stdin.setEncoding("utf-8");
  process.stdin.on("data", function(chunk) { input += chunk; });
  process.stdin.on("end", function() {
    if (!input.trim()) {
      console.error("Usage: echo '...' | node scripts/roadmap-parser.js");
      process.exit(1);
    }
    var items = parseIntakeBlob(input);
    console.log(JSON.stringify(items, null, 2));
    console.error("\n" + items.length + " items parsed.");
    var splits = items.filter(function(i) { return i.split_recommended; }).length;
    if (splits > 0) {
      console.error(splits + " items marked split_recommended.");
    }
    var withDeps = items.filter(function(i) { return i.dependencies.length > 0; }).length;
    if (withDeps > 0) {
      console.error(withDeps + " items have detected dependencies.");
    }
  });
}

// ─── Contextual Triage Engine ─────────────────────────────────
//
// Given an intake item and the full roadmap context, determine:
//   - recommended_action: execute | split | attach | blocked | duplicate | park
//   - scope_size: small | medium | large | epic
//   - proposed_phase
//   - proposed_parent_feature (if attach)
//   - proposed_split_plan (if split)
//   - triage_notes (human-readable reasoning)
//   - related_feature_ids
//   - dependencies
//
// Design: deterministic heuristics, no LLM. Roadmap context gives us
// features[] and custom_items[] to match against.

/**
 * SCOPE_SIZE heuristics:
 *   small  — UI-only tweak, single file, single concern, < 100 chars
 *   medium — touches 1-2 layers, clear scope, 1 ticket
 *   large  — touches 3+ layers or requires new model/migration
 *   epic   — multiple teams/layers, unknown rules, needs decomposition
 */

var SCOPE_KEYWORDS = {
  small: [
    /\b(fix|tweak|adjust|rename|typo|align|spacing|padding|margin|icon|color|css|style|label|tooltip|placeholder)\b/i,
    /\bui[\s-]*(fix|tweak|polish)\b/i,
  ],
  large: [
    /\b(migration|schema\s*change|new\s*model|new\s*table|new\s*entity)\b/i,
    /\b(api\s*endpoint|new\s*route|new\s*workflow|new\s*service)\b/i,
    /\b(dashboard|portal|page)\b/i,
  ],
  epic: [
    /\b(integration|third[\s-]*party|e[\s-]*sign|bank\s*import|payment\s*gateway)\b/i,
    /\b(cross[\s-]*cutting|platform[\s-]*wide|all\s*portals|all\s*roles)\b/i,
    /\b(regulation|compliance|gdpr|legal\s*requirement|canton)\b/i,
    /\b(redesign|overhaul|rewrite|rebuild)\b.*,.*,.*,/i, // 3+ comma-separated items after redesign
    /\b(entire|full|complete)\s+(portal|system|platform|module)\b/i,
  ],
};

function inferScopeSize(text, noteType, deps, splitRec) {
  var t = (text || "").toLowerCase();

  // Epic indicators
  for (var i = 0; i < SCOPE_KEYWORDS.epic.length; i++) {
    if (SCOPE_KEYWORDS.epic[i].test(t)) return "epic";
  }
  // Count comma-separated items — 5+ components is epic
  var commaCount = (t.match(/,/g) || []).length;
  if (commaCount >= 4) return "epic";
  // Dependencies with unresolved blockers → at least large
  if (deps && deps.length >= 2) return "large";
  if (deps && deps.length > 0) {
    for (var di = 0; di < deps.length; di++) {
      if (/needs analysis|tbd|not yet/i.test(deps[di])) return "large";
    }
  }
  // Split recommended → at least medium
  if (splitRec) return "medium";

  // Small indicators
  for (var si = 0; si < SCOPE_KEYWORDS.small.length; si++) {
    if (SCOPE_KEYWORDS.small[si].test(t)) return "small";
  }
  if (noteType === "ui_polish" || noteType === "bug") {
    if (t.length < 120) return "small";
    return "medium";
  }

  // Large indicators
  for (var li = 0; li < SCOPE_KEYWORDS.large.length; li++) {
    if (SCOPE_KEYWORDS.large[li].test(t)) return "large";
  }

  return "medium"; // default
}

/**
 * Text similarity — simple word-overlap Jaccard coefficient.
 * Returns a score 0..1.
 */
function wordSet(text) {
  return (text || "").toLowerCase().replace(/[^a-z0-9\s]/g, "").split(/\s+/).filter(function(w) { return w.length > 2; });
}

function jaccard(setA, setB) {
  if (setA.length === 0 || setB.length === 0) return 0;
  var mapA = {};
  for (var i = 0; i < setA.length; i++) mapA[setA[i]] = 1;
  var mapB = {};
  for (var k = 0; k < setB.length; k++) mapB[setB[k]] = 1;
  var inter = 0;
  var unionMap = {};
  for (var ai in mapA) { unionMap[ai] = 1; }
  for (var bi in mapB) {
    if (mapA[bi]) inter++;
    unionMap[bi] = 1;
  }
  var unionSize = Object.keys(unionMap).length;
  return unionSize > 0 ? inter / unionSize : 0;
}

/**
 * Find the best matching feature or custom item in the roadmap.
 * Returns { id, title, score } or null.
 */
function findRelatedItem(intakeText, intakeArea, features, customItems) {
  var intakeWords = wordSet(intakeText);
  var bestMatch = null;
  var bestScore = 0;
  var threshold = 0.15; // minimum similarity

  // Search features
  for (var fi = 0; fi < features.length; fi++) {
    var f = features[fi];
    var fText = (f.title || "") + " " + (f.description || "");
    var fWords = wordSet(fText);
    var score = jaccard(intakeWords, fWords);
    // Boost if same area
    if (intakeArea && f.product_area && intakeArea === f.product_area) score += 0.1;
    // Boost based on title keyword overlap
    var titleWords = wordSet(f.title || "");
    var titleScore = jaccard(intakeWords, titleWords);
    score = Math.max(score, titleScore * 1.2);
    if (score > bestScore && score >= threshold) {
      bestScore = score;
      bestMatch = { id: f.id, title: f.title || "", score: score, type: "feature" };
    }
  }

  // Search custom items
  for (var ci = 0; ci < customItems.length; ci++) {
    var c = customItems[ci];
    var cText = (c.title || "") + " " + (c.description || "");
    var cWords = wordSet(cText);
    var score2 = jaccard(intakeWords, cWords);
    if (intakeArea && c.product_area && intakeArea === c.product_area) score2 += 0.1;
    if (score2 > bestScore && score2 >= threshold) {
      bestScore = score2;
      bestMatch = { id: c.id, title: c.title || "", score: score2, type: "custom_item" };
    }
  }

  return bestMatch;
}

/**
 * Check for duplicates among existing intake items.
 * Returns { id, title, score } or null.
 */
function findDuplicate(intakeText, intakeId, allIntakeItems) {
  var intakeWords = wordSet(intakeText);
  var bestMatch = null;
  var bestScore = 0;
  var dupThreshold = 0.5;

  for (var i = 0; i < allIntakeItems.length; i++) {
    var other = allIntakeItems[i];
    if (other.id === intakeId) continue;
    if (other.status === "duplicate") continue;
    var otherText = (other.title || "") + " " + (other.raw_text || "");
    var otherWords = wordSet(otherText);
    var score = jaccard(intakeWords, otherWords);
    if (score > bestScore && score >= dupThreshold) {
      bestScore = score;
      bestMatch = { id: other.id, title: other.title || other.raw_text.substring(0, 80), score: score };
    }
  }

  return bestMatch;
}

/**
 * Infer proposed phase from scope, area, and dependencies.
 */
function inferPhase(scopeSize, noteType, deps, relatedFeature) {
  // If we found a related feature, inherit its phase
  if (relatedFeature && relatedFeature.id) {
    var phaseMatch = relatedFeature.id.match(/^F-(P\d)/);
    if (phaseMatch) return phaseMatch[1];
  }
  // Bugs and small UI fixes → P0 (fix now)
  if (noteType === "bug" && scopeSize === "small") return "P0";
  if (noteType === "ui_polish" && scopeSize === "small") return "P0";
  // Items with unresolved deps → P2+
  if (deps && deps.length > 0) {
    for (var i = 0; i < deps.length; i++) {
      if (/needs analysis|tbd|not yet/i.test(deps[i])) return "P3";
    }
    return "P2";
  }
  // Epic → P3+
  if (scopeSize === "epic") return "P3";
  // Large → P2
  if (scopeSize === "large") return "P2";
  // Medium → P1
  if (scopeSize === "medium") return "P1";
  // Small → P0
  return "P0";
}

/**
 * Generate a split plan for multi-concern items.
 * Returns an array of { title, scope_hint } objects.
 */
function generateSplitPlan(rawText, noteType, productArea) {
  var lines = rawText.split(/\n/).map(function(l) { return l.trim(); }).filter(function(l) { return l.length > 10; });
  var plan = [];

  // If there are bullet sub-items, each becomes a draft
  var bulletLines = lines.filter(function(l) { return /^[-•*]\s|^\d+[.)]\s/.test(l); });
  if (bulletLines.length >= 2) {
    for (var i = 0; i < bulletLines.length; i++) {
      var title = normalizeTitle(bulletLines[i]);
      plan.push({ title: title || bulletLines[i].substring(0, 100), scope_hint: "tbd" });
    }
    return plan;
  }

  // Split sentences — separate concerns
  var sentences = rawText.split(/[.!?]\s+/).filter(function(s) { return s.trim().length > 15; });
  if (sentences.length >= 2) {
    for (var si = 0; si < sentences.length; si++) {
      var sTitle = normalizeTitle(sentences[si]);
      plan.push({ title: sTitle || sentences[si].substring(0, 100), scope_hint: "tbd" });
    }
    return plan;
  }

  // Fallback: split by "and" / "also"
  var parts = rawText.split(/\s+(?:and\s+also|and\s+|also\s+|additionally\s*,?\s*)/i).filter(function(p) { return p.trim().length > 15; });
  if (parts.length >= 2) {
    for (var pi = 0; pi < parts.length; pi++) {
      var pTitle = normalizeTitle(parts[pi]);
      plan.push({ title: pTitle || parts[pi].substring(0, 100), scope_hint: "tbd" });
    }
    return plan;
  }

  return plan;
}

/**
 * triageIntakeItem(item, context)
 *
 * Core triage function. Takes a single intake item and the roadmap context,
 * returns a triage result object.
 *
 * @param {object} item - An intake item (must have raw_text, title, product_area, dependencies, split_recommended)
 * @param {object} context - { features: [], custom_items: [], intake_items: [] }
 * @returns {object} Triage result:
 *   {
 *     recommended_action: "execute"|"split"|"attach"|"blocked"|"duplicate"|"park",
 *     scope_size: "small"|"medium"|"large"|"epic",
 *     proposed_phase: "P0".."P5"|null,
 *     proposed_parent_feature: { id, title, score, type }|null,
 *     proposed_split_plan: [{ title, scope_hint }]|[],
 *     triage_notes: "...",
 *     related_feature_ids: [...],
 *     dependencies: [...],
 *     product_area: "...",
 *   }
 */
function triageIntakeItem(item, context) {
  var features = context.features || [];
  var customItems = context.custom_items || [];
  var allIntake = context.intake_items || [];

  var rawText = item.raw_text || "";
  var cleanText = rawText.replace(/^(?:\d+[.)]\s*|[-•*]\s*|>\s*)/, "");
  var title = item.title || normalizeTitle(rawText);
  var combined = (title || "") + " " + cleanText;

  // Infer missing fields
  var noteType = item.note_type || inferNoteType(cleanText);
  var productArea = item.product_area || inferProductArea(cleanText, null);
  var deps = (item.dependencies && item.dependencies.length > 0)
    ? item.dependencies
    : detectDependencies(cleanText);
  var splitRec = (item.split_recommended !== undefined)
    ? item.split_recommended
    : detectSplitRecommended(cleanText);

  // 1. Scope size
  var scopeSize = inferScopeSize(combined, noteType, deps, splitRec);

  // 2. Find related existing feature/ticket
  var relatedFeature = findRelatedItem(combined, productArea, features, customItems);

  // 3. Check for duplicates
  var duplicate = findDuplicate(combined, item.id, allIntake);

  // 4. Infer phase
  var proposedPhase = item.proposed_phase || inferPhase(scopeSize, noteType, deps, relatedFeature);

  // 5. Generate split plan if needed
  var splitPlan = [];
  var splitAssessment = null;
  if (splitRec) {
    splitPlan = generateSplitPlan(rawText, noteType, productArea);
    // Run rich assessment (Prompt G)
    splitAssessment = assessSplitDecision(rawText, noteType, productArea, splitPlan);
    // Override split recommendation if anti-split heuristics are strong
    if (splitAssessment && !splitAssessment.should_split) {
      splitRec = false;
      splitPlan = [];
    }
  }

  // 6. Determine recommended action
  var action = "execute"; // default: one ticket
  var notes = [];

  // Duplicate check first
  if (duplicate && duplicate.score >= 0.5) {
    action = "duplicate";
    notes.push("Likely duplicate of " + duplicate.id + " (" + duplicate.title.substring(0, 60) + ") — similarity: " + Math.round(duplicate.score * 100) + "%");
  }
  // Blocked: unresolved deps with "needs analysis", "tbd", "not yet"
  else if (deps.length > 0) {
    var hasBlocker = false;
    for (var di = 0; di < deps.length; di++) {
      if (/needs analysis|tbd|not yet implemented|not yet working|requires mapping/i.test(deps[di])) {
        hasBlocker = true;
        break;
      }
    }
    if (hasBlocker && scopeSize === "epic") {
      action = "park";
      notes.push("Epic scope with unresolved prerequisites — park until dependencies are met.");
    } else if (hasBlocker) {
      action = "blocked";
      notes.push("Has unresolved dependency: " + deps.join(", ") + ". Cannot execute until resolved.");
    } else {
      // Has deps but they're resolvable
      if (splitRec && splitPlan.length >= 2) {
        action = "split";
        notes.push("Multiple concerns detected + dependencies. Split into " + splitPlan.length + " focused tickets.");
      } else if (relatedFeature && relatedFeature.score >= 0.25) {
        action = "attach";
        notes.push("Related to existing " + relatedFeature.type + " " + relatedFeature.id + " (" + relatedFeature.title.substring(0, 50) + "). Consider attaching as sub-task.");
      } else {
        action = "execute";
        notes.push("Has dependencies (" + deps.join(", ") + ") but appears resolvable.");
      }
    }
  }
  // Split: multiple concerns
  else if (splitRec && splitPlan.length >= 2) {
    action = "split";
    notes.push("Contains " + splitPlan.length + " distinct concerns. Split recommended.");
    if (noteType === "bug" || noteType === "ui_polish") {
      notes.push("Mixed " + noteType.replace(/_/g, " ") + " + feature work — separate for cleaner tracking.");
    }
  }
  // Attach: strong match to existing feature
  else if (relatedFeature && relatedFeature.score >= 0.3) {
    action = "attach";
    notes.push("Strong match to " + relatedFeature.type + " " + relatedFeature.id + " (" + relatedFeature.title.substring(0, 50) + "). Attach or extend.");
  }
  // Epic: too large to execute as-is
  else if (scopeSize === "epic") {
    action = "split";
    notes.push("Epic-sized item. Needs decomposition into smaller tickets before execution.");
  }
  // Default: executable
  else {
    if (scopeSize === "small" && (noteType === "ui_polish" || noteType === "bug")) {
      notes.push("Small " + noteType.replace(/_/g, " ") + " — clear scope, executable as one ticket.");
    } else if (scopeSize === "small") {
      notes.push("Small scope — one focused ticket.");
    } else if (scopeSize === "medium") {
      notes.push("Medium scope — single ticket, may need detailed acceptance criteria.");
    } else {
      notes.push("Large scope — executable but may benefit from sub-tasks.");
    }
  }

  // Add context notes
  if (relatedFeature && action !== "attach" && action !== "duplicate") {
    notes.push("Related: " + relatedFeature.id + " (" + relatedFeature.title.substring(0, 50) + ")");
  }

  // Compile related feature IDs
  var relatedIds = (item.related_feature_ids || []).slice();
  if (relatedFeature && relatedIds.indexOf(relatedFeature.id) === -1) {
    relatedIds.push(relatedFeature.id);
  }

  return {
    recommended_action: action,
    scope_size: scopeSize,
    proposed_phase: proposedPhase,
    proposed_parent_feature: relatedFeature || null,
    proposed_split_plan: splitPlan,
    triage_notes: notes.join(" | "),
    related_feature_ids: relatedIds,
    dependencies: deps,
    product_area: productArea || item.product_area || null,
    note_type: noteType,
    duplicate_of: duplicate ? duplicate.id : null,
    // Prompt G — split assessment metadata
    split_confidence: splitAssessment ? splitAssessment.split_confidence : null,
    split_strategy: splitAssessment ? splitAssessment.split_strategy : null,
    why_not_one_ticket: splitAssessment ? splitAssessment.why_not_one_ticket : null,
    anti_split_reasons: splitAssessment ? splitAssessment.anti_split_reasons : [],
  };
}

/**
 * triageAll(intakeItems, context)
 *
 * Batch triage all intake items. Returns a map: { [intakeId]: triageResult }
 */
function triageAll(intakeItems, context) {
  var results = {};
  for (var i = 0; i < intakeItems.length; i++) {
    var item = intakeItems[i];
    // Only triage raw and triaged items
    if (item.status !== "raw" && item.status !== "triaged") continue;
    results[item.id] = triageIntakeItem(item, context);
  }
  return results;
}

// ─── Intake-to-Draft Promotion Engine ─────────────────────────
//
// Converts triaged intake items into fully-scoped draft ticket specs.
// Uses triage results (recommended_action, scope, area, split plan,
// parent feature, dependencies) to generate clean, executable drafts.
//
// Promotion rules:
//   execute   → 1 draft ticket
//   split     → N draft tickets (from split plan or decomposition)
//   attach    → 1 draft ticket with parent_feature_id set
//   blocked   → 1 blocked draft + optional prerequisite drafts
//   duplicate → no drafts (link only)
//   park      → no drafts (status stays parked)
//
// Every draft includes the full canonical ticket model:
//   title, goal, phase, order, product_area, dependencies,
//   parent_feature_id, files_to_modify, in_scope, out_of_scope,
//   acceptance_criteria, tests_to_add_or_update, test_protocol,
//   validation_checklist, post_validation_updates,
//   canonical_implementation_prompt

// ─── File path inference ──────────────────────────────────────
//
// Infer likely files_to_modify based on product_area and note_type.
// Maps known areas to canonical project paths.

var AREA_FILE_MAP = {
  "invoicing":         { routes: "apps/api/src/routes/invoices.ts", services: "apps/api/src/services/invoice.service.ts", repos: "apps/api/src/repositories/invoice.repository.ts", workflows: "apps/api/src/workflows/invoice.workflow.ts", pages: "apps/web/pages/manager/invoices/" },
  "jobs":              { routes: "apps/api/src/routes/jobs.ts", services: "apps/api/src/services/job.service.ts", repos: "apps/api/src/repositories/job.repository.ts", workflows: "apps/api/src/workflows/job.workflow.ts", pages: "apps/web/pages/manager/jobs/" },
  "requests":          { routes: "apps/api/src/routes/requests.ts", services: "apps/api/src/services/request.service.ts", repos: "apps/api/src/repositories/request.repository.ts", workflows: "apps/api/src/workflows/request.workflow.ts", pages: "apps/web/pages/manager/requests/" },
  "leases":            { routes: "apps/api/src/routes/leases.ts", services: "apps/api/src/services/lease.service.ts", repos: "apps/api/src/repositories/lease.repository.ts", pages: "apps/web/pages/manager/leases/" },
  "buildings":         { routes: "apps/api/src/routes/buildings.ts", services: "apps/api/src/services/building.service.ts", repos: "apps/api/src/repositories/building.repository.ts", pages: "apps/web/pages/manager/buildings/" },
  "tenant-portal":     { routes: "apps/api/src/routes/tenant-portal.ts", pages: "apps/web/pages/tenant/" },
  "owner-portal":      { routes: "apps/api/src/routes/owner-portal.ts", pages: "apps/web/pages/owner/" },
  "contractor-portal": { routes: "apps/api/src/routes/contractors.ts", pages: "apps/web/pages/contractor/" },
  "legal-engine":      { routes: "apps/api/src/routes/legal.ts", services: "apps/api/src/services/legal.service.ts", pages: "apps/web/pages/manager/legal/" },
  "inventory":         { routes: "apps/api/src/routes/inventory.ts", repos: "apps/api/src/repositories/inventory.repository.ts", pages: "apps/web/pages/manager/inventory/" },
  "rfp":               { routes: "apps/api/src/routes/rfp.ts", services: "apps/api/src/services/rfp.service.ts", workflows: "apps/api/src/workflows/rfp.workflow.ts", pages: "apps/web/pages/manager/rfp/" },
  "documents":         { routes: "apps/api/src/routes/documents.ts", services: "apps/api/src/services/document.service.ts", pages: "apps/web/pages/manager/documents/" },
  "notifications":     { routes: "apps/api/src/routes/notifications.ts", services: "apps/api/src/services/notification.service.ts", workflows: "apps/api/src/workflows/notification.workflow.ts" },
  "auth":              { routes: "apps/api/src/authz.ts", governance: "apps/api/src/governance/" },
  "application-wizard":{ routes: "apps/api/src/routes/applications.ts", pages: "apps/web/pages/apply/" },
  "database":          { schema: "apps/api/prisma/schema.prisma" },
  "reporting":         { pages: "apps/web/pages/manager/dashboard/" },
  "scheduling":        { services: "apps/api/src/services/scheduling.service.ts", workflows: "apps/api/src/workflows/scheduling.workflow.ts" },
  "search":            { services: "apps/api/src/services/search.service.ts" },
  "navigation":        { pages: "apps/web/pages/", styles: "apps/web/styles/globals.css" },
  "ui-polish":         { styles: "apps/web/styles/globals.css" },
};

function inferFilesToModify(productArea, noteType, scopeSize) {
  var files = [];
  var areaFiles = AREA_FILE_MAP[productArea] || {};

  if (noteType === "bug" || noteType === "ui_polish") {
    // UI fixes: pages + styles
    if (areaFiles.pages) files.push(areaFiles.pages);
    if (areaFiles.styles) files.push(areaFiles.styles);
    if (noteType === "bug" && areaFiles.routes) files.push(areaFiles.routes);
    if (noteType === "bug" && areaFiles.services) files.push(areaFiles.services);
  } else if (noteType === "reporting") {
    if (areaFiles.pages) files.push(areaFiles.pages);
    if (areaFiles.services) files.push(areaFiles.services);
  } else {
    // Feature work: full stack
    if (scopeSize === "small") {
      // Probably just one layer
      if (areaFiles.pages) files.push(areaFiles.pages);
      else if (areaFiles.routes) files.push(areaFiles.routes);
    } else {
      // Medium/large: routes → services → repos → pages
      if (areaFiles.repos) files.push(areaFiles.repos);
      if (areaFiles.services) files.push(areaFiles.services);
      if (areaFiles.workflows) files.push(areaFiles.workflows);
      if (areaFiles.routes) files.push(areaFiles.routes);
      if (areaFiles.pages) files.push(areaFiles.pages);
    }
  }

  // Schema changes for large/epic scope
  if (scopeSize === "large" || scopeSize === "epic") {
    files.unshift("apps/api/prisma/schema.prisma");
  }
  // DTO / api-client for anything that touches routes
  if (areaFiles.routes && noteType !== "ui_polish") {
    files.push("packages/api-client/src/");
  }

  return files.length > 0 ? files : ["(needs manual file identification)"];
}

// ─── Acceptance criteria generator ────────────────────────────

function generateAcceptanceCriteria(title, noteType, rawText, scopeSize) {
  var criteria = [];
  var t = (title || "").toLowerCase();
  var r = (rawText || "").toLowerCase();

  if (noteType === "bug") {
    criteria.push("The reported bug no longer reproduces");
    criteria.push("No regressions in related functionality");
    if (/pdf|render|display|show/i.test(r)) criteria.push("Output renders correctly with edge-case data");
    if (/special\s*char|unicode|accent/i.test(r)) criteria.push("Special characters handled correctly");
  } else if (noteType === "ui_polish") {
    criteria.push("Visual change matches design intent");
    criteria.push("Responsive across standard breakpoints");
    criteria.push("No regressions in adjacent UI components");
  } else {
    criteria.push("Feature works as described in scope");
    if (scopeSize !== "small") criteria.push("All listed in_scope items implemented");
    criteria.push("Edge cases handled gracefully (empty state, missing data, permissions)");
  }

  // Extract action verbs from the title for specific criteria
  if (/add|create|new/i.test(t)) criteria.push("New functionality is accessible and discoverable");
  if (/filter|search|sort/i.test(t)) criteria.push("Filter/search returns correct results");
  if (/notification|alert|email/i.test(t)) criteria.push("Notifications delivered correctly");
  if (/export|pdf|csv/i.test(t)) criteria.push("Export output is well-formatted and complete");
  if (/validation|validate/i.test(t)) criteria.push("Validation rules enforced on both client and server");

  return criteria.length > 0 ? criteria : ["Feature works as described"];
}

// ─── Test plan generator ──────────────────────────────────────

function generateTestPlan(title, noteType, productArea, files) {
  var tests = [];

  if (noteType === "bug") {
    tests.push("Regression test: reproduce original bug scenario → verify fixed");
  }

  // Infer tests from file types
  var hasRoutes = files.some(function(f) { return /routes/i.test(f); });
  var hasServices = files.some(function(f) { return /services/i.test(f); });
  var hasWorkflows = files.some(function(f) { return /workflows/i.test(f); });
  var hasPages = files.some(function(f) { return /pages/i.test(f); });

  if (hasRoutes) tests.push("API contract test: verify request/response shape");
  if (hasServices) tests.push("Service unit test: verify business logic");
  if (hasWorkflows) tests.push("Workflow integration test: verify status transitions");
  if (hasPages) tests.push("UI smoke test: verify page renders without errors");

  if (tests.length === 0) tests.push("Verify feature works per acceptance criteria");
  tests.push("No regressions in existing test suite (npm test)");

  return tests;
}

// ─── Canonical implementation prompt ──────────────────────────

function generateImplementationPrompt(draft) {
  var lines = [];
  lines.push("## Ticket: " + (draft.title || "Untitled"));
  lines.push("");
  lines.push("**Goal:** " + (draft.goal || "Implement the feature as described."));
  lines.push("");
  lines.push("**Phase:** " + (draft.phase || "TBD") + " | **Area:** " + (draft.product_area || "TBD"));
  if (draft.parent_feature_id) {
    lines.push("**Parent Feature:** " + draft.parent_feature_id);
  }
  lines.push("");

  if (draft.in_scope && draft.in_scope.length > 0) {
    lines.push("### In Scope");
    for (var i = 0; i < draft.in_scope.length; i++) {
      lines.push("- " + draft.in_scope[i]);
    }
    lines.push("");
  }

  if (draft.out_of_scope && draft.out_of_scope.length > 0) {
    lines.push("### Out of Scope");
    for (var j = 0; j < draft.out_of_scope.length; j++) {
      lines.push("- " + draft.out_of_scope[j]);
    }
    lines.push("");
  }

  if (draft.files_to_modify && draft.files_to_modify.length > 0) {
    lines.push("### Files to Modify (in order)");
    for (var k = 0; k < draft.files_to_modify.length; k++) {
      lines.push((k + 1) + ". `" + draft.files_to_modify[k] + "`");
    }
    lines.push("");
  }

  if (draft.depends_on && draft.depends_on.length > 0) {
    lines.push("### Dependencies");
    for (var d = 0; d < draft.depends_on.length; d++) {
      lines.push("- " + draft.depends_on[d]);
    }
    lines.push("");
  }

  lines.push("### Acceptance Criteria");
  var ac = draft.acceptance_criteria || ["Feature works as described"];
  for (var a = 0; a < ac.length; a++) {
    lines.push("- [ ] " + ac[a]);
  }
  lines.push("");

  lines.push("### Test Plan");
  var tests = draft.tests_to_add_or_update || [];
  for (var t = 0; t < tests.length; t++) {
    lines.push("- " + tests[t]);
  }
  lines.push("");

  lines.push("### Test Protocol");
  var tp = draft.test_protocol || [];
  for (var p = 0; p < tp.length; p++) {
    lines.push((p + 1) + ". " + tp[p]);
  }
  lines.push("");

  lines.push("### Validation Checklist");
  var vc = draft.validation_checklist || [];
  for (var v = 0; v < vc.length; v++) {
    lines.push("- [ ] " + vc[v]);
  }
  lines.push("");

  lines.push("### Post-Validation Updates");
  var pv = draft.post_validation_updates || [];
  for (var u = 0; u < pv.length; u++) {
    lines.push("- " + pv[u]);
  }

  return lines.join("\n");
}

// ─── Scope inference ──────────────────────────────────────────

function inferInScope(title, rawText, noteType) {
  var scope = [];
  var t = (title || "").toLowerCase();
  var r = (rawText || "").toLowerCase();

  // Extract concrete deliverables from the text
  if (/add|create|implement|build/i.test(t)) {
    scope.push("Implement " + (title || "described feature"));
  } else if (/fix|repair|resolve/i.test(t)) {
    scope.push("Fix " + (title || "reported issue"));
  } else {
    scope.push((title || "Described work"));
  }

  // Check for specific verbs/nouns in raw text
  if (/endpoint|api|route/i.test(r)) scope.push("API endpoint changes");
  if (/page|view|screen|ui/i.test(r)) scope.push("UI/page updates");
  if (/migration|schema/i.test(r)) scope.push("Database schema changes");
  if (/test|spec/i.test(r)) scope.push("Test coverage updates");
  if (/notification|email|sms/i.test(r)) scope.push("Notification delivery");
  if (/validation|validate/i.test(r)) scope.push("Input validation");

  return scope;
}

function inferOutOfScope(title, noteType, scopeSize, splitPlan) {
  var outScope = [];

  // Standard exclusions based on scope
  if (scopeSize === "small") {
    outScope.push("Refactoring unrelated code");
    outScope.push("New model/migration creation");
  } else if (scopeSize === "medium") {
    outScope.push("Cross-portal changes (unless explicitly listed)");
    outScope.push("Performance optimization (separate ticket)");
  }

  // If there was a split plan, the other parts are out of scope
  if (splitPlan && splitPlan.length > 0) {
    for (var i = 0; i < splitPlan.length; i++) {
      outScope.push("Split item: " + splitPlan[i].title + " (handled in separate draft)");
    }
  }

  if (noteType === "bug") {
    outScope.push("Feature enhancements beyond the fix");
    outScope.push("Refactoring the surrounding module");
  }

  return outScope;
}

// ─── Default test protocol ────────────────────────────────────

var DEFAULT_DRAFT_TEST_PROTOCOL = [
  "npx tsc --noEmit — zero TypeScript errors",
  "npm test — all tests pass",
  "npm run blueprint — architecture docs sync",
  "Ticket-specific verification: verify acceptance criteria manually",
  "Regression checks: verify adjacent features still work",
  "API contract sync: if API changed, verify DTOs/OpenAPI/api-client match",
  "UI verification: if UI changed, manual check in browser",
  "Edge cases: verify behavior with missing/null data",
];

var DEFAULT_DRAFT_VALIDATION_CHECKLIST = [
  "All acceptance criteria verified",
  "No TypeScript errors (npx tsc --noEmit)",
  "All tests pass (npm test)",
  "No layer violations introduced",
  "Blueprint regenerated (npm run blueprint)",
];

var DEFAULT_DRAFT_POST_VALIDATION = [
  "Refresh docs/blueprint.html — cd apps/api && node blueprint.js",
  "Refresh docs/roadmap.html — node scripts/generate-roadmap.js",
  "Review PROJECT_STATE.md — update if architecture decisions changed",
  "Review ARCHITECTURE_LOW_CONTEXT_GUIDE.md — update if auth/layers touched",
  "Review docs/AUDIT.md — mark resolved findings, add new ones",
  "Review SCHEMA_REFERENCE.md — update if schema changed",
  "Commit: npx tsc --noEmit → npm test → npm run blueprint",
];

// ─── Core promotion function ──────────────────────────────────

/**
 * promoteIntakeItem(item, triageResult, context)
 *
 * Takes a triaged intake item and its triage result, returns an array
 * of fully-scoped draft ticket specs ready for human review.
 *
 * @param {object} item - The intake item
 * @param {object} triage - The triage result from triageIntakeItem()
 * @param {object} context - { features, custom_items, intake_items }
 * @returns {object} { action, drafts: [...], notes, linked_duplicate }
 */
function promoteIntakeItem(item, triage, context) {
  var action = triage.recommended_action || "execute";
  var drafts = [];
  var notes = [];

  // ── Duplicate: link only, no new drafts ──
  if (action === "duplicate") {
    notes.push("Marked as duplicate of " + (triage.duplicate_of || "unknown") + ". No draft created.");
    return { action: "duplicate", drafts: [], notes: notes.join(" | "), linked_duplicate: triage.duplicate_of };
  }

  // ── Park: too vague/blocked for any drafts ──
  if (action === "park") {
    notes.push("Parked — epic scope with unresolved blockers. Re-triage when dependencies are resolved.");
    return { action: "park", drafts: [], notes: notes.join(" | "), linked_duplicate: null };
  }

  // ── Helper to build one draft ──
  function buildDraft(title, goal, rawText, orderNum, overrides) {
    overrides = overrides || {};
    var area = overrides.product_area || triage.product_area || item.product_area || "";
    var noteType = overrides.note_type || triage.note_type || "feature_request";
    var scope = overrides.scope_size || triage.scope_size || "medium";
    var phase = overrides.phase || triage.proposed_phase || item.proposed_phase || "P1";
    var ppfRaw = triage.proposed_parent_feature;
    var parentFeature = overrides.parent_feature_id || (ppfRaw ? (typeof ppfRaw === "string" ? ppfRaw : ppfRaw.id) : null) || null;
    var deps = overrides.depends_on || triage.dependencies || [];

    var files = inferFilesToModify(area, noteType, scope);
    var ac = generateAcceptanceCriteria(title, noteType, rawText, scope);
    var tests = generateTestPlan(title, noteType, area, files);
    var inScope = inferInScope(title, rawText, noteType);
    var outScope = inferOutOfScope(title, noteType, scope, overrides.otherSplitItems || []);

    var draft = {
      source_intake_ids: [item.id],
      title: title,
      goal: goal || "Implement: " + title,
      phase: phase,
      order: orderNum,
      status: "draft",
      product_area: area,
      parent_feature_id: parentFeature,
      depends_on: deps,
      files_to_modify: files,
      in_scope: inScope,
      out_of_scope: outScope,
      acceptance_criteria: ac,
      tests_to_add_or_update: tests,
      test_protocol: DEFAULT_DRAFT_TEST_PROTOCOL.slice(),
      validation_checklist: DEFAULT_DRAFT_VALIDATION_CHECKLIST.slice(),
      post_validation_updates: DEFAULT_DRAFT_POST_VALIDATION.slice(),
    };
    // Generate canonical implementation prompt
    draft.canonical_implementation_prompt = generateImplementationPrompt(draft);
    return draft;
  }

  // ── Execute: single atomic draft ──
  if (action === "execute") {
    var goal = "Implement: " + (item.title || normalizeTitle(item.raw_text));
    if (triage.note_type === "bug") {
      goal = "Fix: " + (item.title || normalizeTitle(item.raw_text));
    }
    drafts.push(buildDraft(
      item.title || normalizeTitle(item.raw_text),
      goal,
      item.raw_text,
      1
    ));
    notes.push("Single executable draft created.");
  }

  // ── Split: multiple drafts from split plan or decomposition ──
  else if (action === "split") {
    var plan = triage.proposed_split_plan || [];
    if (plan.length >= 2) {
      for (var si = 0; si < plan.length; si++) {
        var partTitle = plan[si].title || ("Part " + (si + 1) + " of: " + (item.title || ""));
        // Build the out_of_scope as the other split parts
        var otherParts = plan.filter(function(_, idx) { return idx !== si; });
        drafts.push(buildDraft(
          partTitle,
          "Implement: " + partTitle,
          plan[si].title || item.raw_text,
          si + 1,
          { otherSplitItems: otherParts }
        ));
      }
      notes.push("Split into " + plan.length + " focused drafts from split plan.");
    } else {
      // Epic without a split plan — generate a single "spike" draft to decompose
      drafts.push(buildDraft(
        "[Spike] Decompose: " + (item.title || normalizeTitle(item.raw_text)),
        "Analyze and break down this epic-sized item into actionable sub-tickets with clear scope.",
        item.raw_text,
        1,
        { note_type: "feature_request", scope_size: "medium" }
      ));
      notes.push("Epic without split plan — created spike draft for decomposition.");
    }
  }

  // ── Attach: single draft with parent feature ──
  else if (action === "attach") {
    var ppf = triage.proposed_parent_feature;
    var parentId = ppf ? (typeof ppf === "string" ? ppf : ppf.id) : null;
    var parentTitle = ppf ? (typeof ppf === "string" ? ppf : (ppf.title || "")) : "";
    drafts.push(buildDraft(
      item.title || normalizeTitle(item.raw_text),
      "Extend " + (parentTitle || parentId || "parent feature") + ": " + (item.title || normalizeTitle(item.raw_text)),
      item.raw_text,
      1,
      { parent_feature_id: parentId }
    ));
    notes.push("Attached to " + (parentId || "related feature") + " (" + String(parentTitle).substring(0, 50) + ").");
  }

  // ── Blocked: create blocked draft + prerequisite if identifiable ──
  else if (action === "blocked") {
    var blockerDeps = triage.dependencies || [];

    // Create the main ticket as blocked
    var mainDraft = buildDraft(
      item.title || normalizeTitle(item.raw_text),
      "Implement (blocked): " + (item.title || normalizeTitle(item.raw_text)),
      item.raw_text,
      2
    );
    mainDraft.status = "draft"; // will be blocked once deps exist

    // Create prerequisite tickets for each unresolved dependency
    for (var bi = 0; bi < blockerDeps.length; bi++) {
      var depTitle = "[Prerequisite] " + blockerDeps[bi];
      var prereqDraft = buildDraft(
        depTitle,
        "Resolve prerequisite: " + blockerDeps[bi],
        "This prerequisite must be resolved before: " + (item.title || "the blocked item"),
        1,
        { scope_size: "medium", depends_on: [] }
      );
      drafts.push(prereqDraft);
    }

    // Main draft depends on prerequisites (IDs assigned by server)
    drafts.push(mainDraft);
    notes.push("Created " + blockerDeps.length + " prerequisite draft(s) + 1 blocked main draft.");
  }

  return {
    action: action,
    drafts: drafts,
    notes: notes.join(" | "),
    linked_duplicate: null,
  };
}

/**
 * promoteAll(intakeItems, context)
 *
 * Batch promote all triaged intake items that have a recommended_action.
 * Skips items already drafted/promoted, duplicates, and parked.
 *
 * @returns {{ promotable: number, promoted: number, results: Object.<string, object> }}
 */
function promoteAll(intakeItems, context) {
  var results = {};
  var promotable = 0;
  var promoted = 0;

  for (var i = 0; i < intakeItems.length; i++) {
    var item = intakeItems[i];
    // Only promote triaged items
    if (item.status !== "triaged") continue;
    if (!item.recommended_action) continue;
    // Skip duplicates and parked — these shouldn't produce drafts
    if (item.recommended_action === "duplicate" || item.recommended_action === "park") continue;
    promotable++;

    // Run triage to get fresh result (or use stored data)
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

    var result = promoteIntakeItem(item, triage, context);
    if (result.drafts.length > 0) {
      promoted++;
    }
    results[item.id] = result;
  }

  return { promotable: promotable, promoted: promoted, results: results };
}

// ─── Draft Refinement Engine ──────────────────────────────────
//
// Enriches a draft ticket using project context (codebase docs,
// sibling relationships, audit findings, architecture guide).
//
// Core principle: A refined draft retains clear linkage to its
// parent story and sibling tickets. It becomes materially more
// actionable without losing the original narrative context.
//
// Idempotent: does not overwrite manually-edited fields unless
// they are empty or contain only auto-generated defaults.

var REFINEMENT_STATUS = {
  UNREFINED: "unrefined",
  REFINED: "refined",
  REFINED_BLOCKED: "refined_blocked",
  READY_CANDIDATE: "ready_candidate",
};

/**
 * refineDraft(draft, projectContext)
 *
 * @param {object} draft - The draft ticket to refine
 * @param {object} projectContext - {
 *   projectState: string,       // PROJECT_STATE.md content
 *   architectureGuide: string,  // ARCHITECTURE_LOW_CONTEXT_GUIDE.md content
 *   auditDoc: string,           // docs/AUDIT.md content
 *   features: array,            // roadmap features[]
 *   customItems: array,         // roadmap custom_items[]
 *   intakeItems: array,         // roadmap intake_items[]
 *   draftTickets: array,        // roadmap draft_tickets[]
 *   models: array,              // Prisma model names
 *   enums: array,               // Prisma enum names
 *   workflows: array,           // workflow .ts files
 *   routes: array,              // route .ts files
 *   services: array,            // service .ts files
 * }
 * @returns {object} { draft, changes[], refinement_status, notes }
 */
function refineDraft(draft, ctx) {
  var changes = [];
  var notes = [];

  // ── 1. Resolve parent story context ──────────────────────────

  var sourceIntakeIds = draft.source_intake_ids || [];
  var parentItems = [];
  for (var si = 0; si < sourceIntakeIds.length; si++) {
    var srcId = sourceIntakeIds[si];
    var found = (ctx.intakeItems || []).find(function(it) { return it.id === srcId; });
    if (found) parentItems.push(found);
  }

  // Populate parent_story fields if we have source intake
  if (parentItems.length > 0 && !draft.parent_story_id) {
    var primary = parentItems[0];
    draft.parent_story_id = primary.id;
    draft.parent_story_title = primary.title || normalizeTitle(primary.raw_text || "");
    draft.parent_story_raw_text = (primary.raw_text || "").substring(0, 500);
    changes.push("Added parent_story context from " + primary.id);
  }

  // ── 2. Resolve sibling tickets ───────────────────────────────

  var siblingIds = [];
  for (var pi = 0; pi < parentItems.length; pi++) {
    var parentDraftIds = parentItems[pi].draft_ticket_ids || [];
    for (var pdi = 0; pdi < parentDraftIds.length; pdi++) {
      if (parentDraftIds[pdi] !== draft.id && siblingIds.indexOf(parentDraftIds[pdi]) === -1) {
        siblingIds.push(parentDraftIds[pdi]);
      }
    }
  }
  if (siblingIds.length > 0 && (!draft.sibling_ticket_ids || draft.sibling_ticket_ids.length === 0)) {
    draft.sibling_ticket_ids = siblingIds;
    changes.push("Linked " + siblingIds.length + " sibling ticket(s): " + siblingIds.join(", "));
  }

  // Add "why this slice exists" note if from a split
  if (siblingIds.length > 0 && !draft.slice_rationale) {
    var siblingTitles = [];
    for (var sti = 0; sti < siblingIds.length; sti++) {
      var sib = (ctx.draftTickets || []).find(function(d) { return d.id === siblingIds[sti]; });
      if (sib) siblingTitles.push(sib.title);
    }
    draft.slice_rationale = "This ticket was split from parent story " +
      (draft.parent_story_id || "unknown") + ". Sibling slices cover: " +
      (siblingTitles.length > 0 ? siblingTitles.map(function(t) { return '"' + t.substring(0, 60) + '"'; }).join(", ") : "see sibling IDs") +
      ". This slice focuses on: " + (draft.title || "").substring(0, 80);
    changes.push("Added slice_rationale explaining split context");
  }

  // ── 3. Infer sequence_role ───────────────────────────────────

  if (!draft.sequence_role) {
    draft.sequence_role = inferSequenceRole(draft, ctx);
    changes.push("Inferred sequence_role: " + draft.sequence_role);
  }

  // ── 4. Enrich goal if weak ──────────────────────────────────

  var goalIsWeak = !draft.goal || draft.goal.length < 30 ||
    /^Implement:\s|^Fix:\s|^Implement \(blocked\):\s/.test(draft.goal);
  if (goalIsWeak) {
    var enrichedGoal = enrichGoal(draft, ctx);
    if (enrichedGoal && enrichedGoal !== draft.goal) {
      draft.goal = enrichedGoal;
      changes.push("Enriched goal with project context");
    }
  }

  // ── 5. Add story_intent + story_success_outcome ─────────────

  if (!draft.story_intent) {
    draft.story_intent = inferStoryIntent(draft, parentItems);
    changes.push("Inferred story_intent");
  }
  if (!draft.story_success_outcome) {
    draft.story_success_outcome = inferSuccessOutcome(draft, parentItems);
    changes.push("Inferred story_success_outcome");
  }

  // ── 6. Enrich files_to_modify + files_to_inspect ────────────

  if (!draft.files_to_modify || draft.files_to_modify.length === 0 || onlyHasPlaceholderFiles(draft.files_to_modify)) {
    var area = draft.product_area || "";
    var noteType = inferNoteTypeFromDraft(draft);
    var scope = inferScopeFromDraft(draft);
    draft.files_to_modify = inferFilesToModify(area, noteType, scope);
    changes.push("Inferred files_to_modify from product_area + scope");
  }

  if (!draft.files_to_inspect || draft.files_to_inspect.length === 0) {
    draft.files_to_inspect = inferFilesToInspect(draft, ctx);
    changes.push("Inferred files_to_inspect for review context");
  }

  // ── 7. Enrich in_scope + out_of_scope if sparse ────────────

  if (!draft.in_scope || draft.in_scope.length <= 1) {
    var noteType2 = inferNoteTypeFromDraft(draft);
    draft.in_scope = inferInScope(draft.title, draft.parent_story_raw_text || "", noteType2);
    changes.push("Enriched in_scope");
  }
  if (!draft.out_of_scope || draft.out_of_scope.length === 0) {
    var scope2 = inferScopeFromDraft(draft);
    var noteType3 = inferNoteTypeFromDraft(draft);
    var siblingItems = [];
    for (var ooi = 0; ooi < siblingIds.length; ooi++) {
      var sibDraft = (ctx.draftTickets || []).find(function(d) { return d.id === siblingIds[ooi]; });
      if (sibDraft) siblingItems.push({ title: sibDraft.title });
    }
    draft.out_of_scope = inferOutOfScope(draft.title, noteType3, scope2, siblingItems);
    changes.push("Enriched out_of_scope");
  }

  // ── 8. Enrich acceptance_criteria if weak ───────────────────

  if (!draft.acceptance_criteria || draft.acceptance_criteria.length <= 1) {
    var noteType4 = inferNoteTypeFromDraft(draft);
    var scope3 = inferScopeFromDraft(draft);
    draft.acceptance_criteria = generateAcceptanceCriteria(
      draft.title, noteType4, draft.parent_story_raw_text || draft.goal, scope3
    );
    changes.push("Enriched acceptance_criteria");
  }

  // ── 9. Infer implementation_shape ───────────────────────────

  if (!draft.implementation_shape) {
    draft.implementation_shape = inferImplementationShape(draft, ctx);
    changes.push("Inferred implementation_shape: " + draft.implementation_shape);
  }

  // ── 10. Scan audit findings for risk_notes ──────────────────

  if (!draft.risk_notes || draft.risk_notes.length === 0) {
    var risks = scanAuditForRisks(draft, ctx.auditDoc || "");
    if (risks.length > 0) {
      draft.risk_notes = risks;
      changes.push("Found " + risks.length + " related audit finding(s)");
    }
  }

  // ── 11. Build context_bundle ────────────────────────────────

  if (!draft.context_bundle) {
    draft.context_bundle = buildContextBundle(draft, ctx);
    changes.push("Built context_bundle with shared constraints");
  }

  // ── 12. Enrich testing metadata ─────────────────────────────

  if (!draft.tests_to_add || draft.tests_to_add.length === 0) {
    draft.tests_to_add = draft.tests_to_add_or_update ? draft.tests_to_add_or_update.slice() : [];
    if (draft.tests_to_add.length === 0) {
      var noteType5 = inferNoteTypeFromDraft(draft);
      draft.tests_to_add = generateTestPlan(draft.title, noteType5, draft.product_area || "", draft.files_to_modify || []);
    }
    changes.push("Populated tests_to_add");
  }
  if (!draft.tests_to_update || draft.tests_to_update.length === 0) {
    draft.tests_to_update = inferTestsToUpdate(draft, ctx);
    if (draft.tests_to_update.length > 0) changes.push("Inferred tests_to_update");
  }
  if (!draft.regression_checks || draft.regression_checks.length === 0) {
    draft.regression_checks = inferRegressionChecks(draft, ctx);
    if (draft.regression_checks.length > 0) changes.push("Inferred regression_checks");
  }

  // ── 13. Enrich dependencies if empty ────────────────────────

  if (!draft.depends_on || draft.depends_on.length === 0) {
    var deps = detectDependencies(draft.title + " " + (draft.goal || ""));
    if (deps.length > 0) {
      draft.depends_on = deps;
      changes.push("Detected " + deps.length + " dependency(ies)");
    }
  }

  // ── 14. Determine refinement_status ─────────────────────────

  var readinessResult = assessReadiness(draft, ctx);
  draft.refinement_status = readinessResult.status;
  draft.refinement_notes = readinessResult.notes;
  notes = notes.concat(readinessResult.notes);

  // ── 15. Mark as refined ─────────────────────────────────────

  draft.refined_at = new Date().toISOString();

  return {
    draft: draft,
    changes: changes,
    refinement_status: draft.refinement_status,
    notes: notes,
  };
}

// ─── Refinement Helpers ───────────────────────────────────────

function inferSequenceRole(draft, ctx) {
  var t = (draft.title || "").toLowerCase();
  var g = (draft.goal || "").toLowerCase();
  var combined = t + " " + g;

  if (/schema|migration|model|prisma/i.test(combined)) return "foundation";
  if (/prerequisite|unblock|enable|prepare/i.test(combined)) return "enabler";
  if (/page|view|screen|ui|frontend|display/i.test(combined)) return "ui_followup";
  if (/workflow|transition|lifecycle|automat/i.test(combined)) return "workflow";
  if (/polish|style|css|visual|cleanup|refactor/i.test(combined)) return "polish";

  // If depends_on has items, likely it's a followup
  if (draft.depends_on && draft.depends_on.length > 0) return "ui_followup";
  return "workflow";
}

function enrichGoal(draft, ctx) {
  var title = draft.title || "";
  var area = draft.product_area || "";
  var parentRaw = draft.parent_story_raw_text || "";

  // Build a richer goal from what we know
  var parts = [];

  // What are we doing
  if (/fix|bug|repair/i.test(title)) {
    parts.push("Fix the issue described in");
  } else if (/add|create|implement|build/i.test(title)) {
    parts.push("Implement");
  } else if (/refactor|extract|move/i.test(title)) {
    parts.push("Refactor");
  } else {
    parts.push("Deliver");
  }

  // The core work
  parts.push('"' + title + '"');

  // Where it fits
  if (area) parts.push("in the " + area + " domain");

  // Why (from parent story)
  if (parentRaw && parentRaw.length > 20) {
    var parentSummary = parentRaw.substring(0, 120).replace(/\n/g, " ").trim();
    parts.push("to fulfill the original request: " + parentSummary);
  }

  // Layer touch
  var shape = draft.implementation_shape || inferImplementationShape(draft, ctx);
  if (shape === "full_stack") parts.push("(full-stack: API + UI)");
  else if (shape === "backend_only") parts.push("(backend changes only)");
  else if (shape === "ui_only") parts.push("(UI/frontend changes only)");

  return parts.join(" ") + ".";
}

function inferStoryIntent(draft, parentItems) {
  if (parentItems.length > 0) {
    var p = parentItems[0];
    var rawSnippet = (p.raw_text || "").substring(0, 200).replace(/\n/g, " ").trim();
    return "Originating from intake " + p.id + ": " + (p.title || rawSnippet || "untitled story");
  }
  return "Standalone ticket — " + (draft.title || "");
}

function inferSuccessOutcome(draft, parentItems) {
  var t = (draft.title || "").toLowerCase();
  var parts = [];

  if (/fix|bug/i.test(t)) {
    parts.push("The reported issue no longer reproduces");
    parts.push("No regressions in related functionality");
  } else {
    parts.push("Feature is functional and accessible to target users");
  }

  if (parentItems.length > 0) {
    parts.push("Parent story intent (" + parentItems[0].id + ") is partially fulfilled by this slice");
  }

  parts.push("All acceptance criteria pass");
  parts.push("CI green (tsc + tests + blueprint)");

  return parts.join(". ") + ".";
}

function onlyHasPlaceholderFiles(files) {
  if (!files || files.length === 0) return true;
  return files.length === 1 && /^\(needs manual|^\(tbd\)/i.test(files[0]);
}

function inferNoteTypeFromDraft(draft) {
  var t = (draft.title || "").toLowerCase() + " " + (draft.goal || "").toLowerCase();
  if (/\bbug\b|fix|broken|crash|error/i.test(t)) return "bug";
  if (/polish|style|css|visual|ui tweak/i.test(t)) return "ui_polish";
  if (/report|dashboard|analytics/i.test(t)) return "reporting";
  return "feature_request";
}

function inferScopeFromDraft(draft) {
  // Heuristic: count how many layers we touch
  var files = draft.files_to_modify || [];
  var hasBackend = files.some(function(f) { return /routes|services|workflows|repositories|prisma/i.test(f); });
  var hasFrontend = files.some(function(f) { return /pages|web|components/i.test(f); });
  var hasSchema = files.some(function(f) { return /schema\.prisma/i.test(f); });

  if (hasSchema) return "large";
  if (hasBackend && hasFrontend) return "medium";
  return "small";
}

function inferImplementationShape(draft, ctx) {
  var files = draft.files_to_modify || [];
  var title = (draft.title || "").toLowerCase();
  var hasBackend = files.some(function(f) { return /routes|services|workflows|repositories|prisma|api\/src/i.test(f); });
  var hasFrontend = files.some(function(f) { return /pages|web\/|components|styles/i.test(f); });
  var deps = draft.depends_on || [];

  // Check if blocked
  if (deps.length > 0) {
    // See if any dependency is unresolved
    var allDrafts = ctx.draftTickets || [];
    for (var di = 0; di < deps.length; di++) {
      var depDraft = allDrafts.find(function(d) { return d.id === deps[di]; });
      if (depDraft && depDraft.status === "draft" && depDraft.refinement_status !== "ready_candidate") {
        return "blocked";
      }
    }
  }

  if (/\bblocked\b|\bwait\b|\bdepends\b/i.test(title)) return "blocked";
  if (hasBackend && hasFrontend) return "full_stack";
  if (hasBackend) return "backend_only";
  if (hasFrontend) return "ui_only";

  // Infer from area/title keywords
  if (/page|view|screen|dashboard|ui/i.test(title)) return "ui_only";
  if (/api|endpoint|service|migration|schema/i.test(title)) return "backend_only";

  return "full_stack";
}

function inferFilesToInspect(draft, ctx) {
  var files = [];
  var area = (draft.product_area || "").toLowerCase();

  // Always suggest reading project context
  files.push("PROJECT_STATE.md (guardrails section)");
  files.push("apps/api/src/ARCHITECTURE_LOW_CONTEXT_GUIDE.md");

  // If there's a product area, suggest reading the architecture guide section
  if (area) {
    var areaFiles = AREA_FILE_MAP[area] || {};
    if (areaFiles.routes) files.push(areaFiles.routes + " (existing route patterns)");
    if (areaFiles.services) files.push(areaFiles.services + " (existing service patterns)");
    if (areaFiles.repos) files.push(areaFiles.repos + " (canonical includes)");
  }

  // If touching schema
  if ((draft.files_to_modify || []).some(function(f) { return /schema\.prisma/i.test(f); })) {
    files.push("SCHEMA_REFERENCE.md");
    files.push("apps/api/prisma/schema.prisma (current schema)");
  }

  // If touching auth
  if ((draft.files_to_modify || []).some(function(f) { return /authz|auth\./i.test(f); })) {
    files.push("apps/api/src/authz.ts (auth helpers)");
  }

  return files;
}

function scanAuditForRisks(draft, auditDoc) {
  if (!auditDoc) return [];
  var risks = [];
  var area = (draft.product_area || "").toLowerCase();
  var title = (draft.title || "").toLowerCase();
  var filesStr = (draft.files_to_modify || []).join(" ").toLowerCase();

  // Extract audit finding IDs and descriptions
  var findingPattern = /### ((?:CQ|TC|SI|SA)-\d+)\s*·\s*(.+?)(?:\s*\((?:HIGH|MEDIUM|LOW|CRITICAL)\))/gm;
  var match;
  while ((match = findingPattern.exec(auditDoc)) !== null) {
    var findingId = match[1];
    var findingDesc = match[2].toLowerCase();

    // Skip resolved findings
    var resolvedIdx = auditDoc.indexOf(findingId);
    if (resolvedIdx >= 0) {
      var nearbyText = auditDoc.substring(resolvedIdx, resolvedIdx + 500);
      if (/✅\s*Resolved|Status:\s*✅/i.test(nearbyText)) continue;
    }

    // Check if finding overlaps with this draft's area
    var overlaps = false;
    if (area && findingDesc.indexOf(area) >= 0) overlaps = true;
    if (filesStr && (
      findingDesc.indexOf("routes/") >= 0 && filesStr.indexOf("routes/") >= 0 ||
      findingDesc.indexOf("legal") >= 0 && (filesStr.indexOf("legal") >= 0 || area === "legal-engine") ||
      findingDesc.indexOf("invoice") >= 0 && (filesStr.indexOf("invoice") >= 0 || area === "invoicing") ||
      findingDesc.indexOf("tenant") >= 0 && (filesStr.indexOf("tenant") >= 0 || area === "tenant-portal") ||
      findingDesc.indexOf("lease") >= 0 && (filesStr.indexOf("lease") >= 0 || area === "leases")
    )) overlaps = true;
    if (title && findingDesc.indexOf(title.substring(0, 20)) >= 0) overlaps = true;

    if (overlaps) {
      risks.push(findingId + ": " + match[2].trim());
    }
  }

  return risks;
}

function buildContextBundle(draft, ctx) {
  var bundle = {
    architectural_constraints: [],
    shared_files: [],
    shared_assumptions: [],
    sibling_dependencies: [],
  };

  // Layer rules always apply
  bundle.architectural_constraints.push("routes → workflows → services → repositories → Prisma (never skip)");
  bundle.architectural_constraints.push("Canonical includes required (G9) — no ad-hoc include trees");

  var shape = draft.implementation_shape || "";
  if (shape === "full_stack" || shape === "backend_only") {
    bundle.architectural_constraints.push("Schema changes require migration (G1) — never db push");
    bundle.architectural_constraints.push("New fields: update schema → migration → repo include → DTO → OpenAPI → api-client → tests (G2)");
  }

  // Shared files with siblings
  var sibFiles = [];
  var sibIds = draft.sibling_ticket_ids || [];
  for (var sfi = 0; sfi < sibIds.length; sfi++) {
    var sibDraft = (ctx.draftTickets || []).find(function(d) { return d.id === sibIds[sfi]; });
    if (!sibDraft) continue;
    var sibFileList = sibDraft.files_to_modify || [];
    for (var sfj = 0; sfj < sibFileList.length; sfj++) {
      if ((draft.files_to_modify || []).indexOf(sibFileList[sfj]) >= 0 && sibFiles.indexOf(sibFileList[sfj]) < 0) {
        sibFiles.push(sibFileList[sfj]);
      }
    }
    // Track sibling as dependency if it's a foundation/enabler
    if (sibDraft.sequence_role === "foundation" || sibDraft.sequence_role === "enabler") {
      bundle.sibling_dependencies.push(sibDraft.id + " (" + sibDraft.sequence_role + "): " + (sibDraft.title || "").substring(0, 60));
    }
  }
  bundle.shared_files = sibFiles;

  // Assumptions based on product area
  var area = (draft.product_area || "").toLowerCase();
  if (area === "tenant-portal") {
    bundle.shared_assumptions.push("Tenant routes require requireTenantSession() — never accept tenantId as query param");
  }
  if (area === "invoicing" || area === "jobs" || area === "requests") {
    bundle.shared_assumptions.push("Status transitions must go through transitions.ts — never inline status checks");
  }
  if (area === "legal-engine") {
    bundle.shared_assumptions.push("Legal models are jurisdiction-scoped, not org-scoped (SI-11)");
  }

  return bundle;
}

function inferTestsToUpdate(draft, ctx) {
  var tests = [];
  var files = draft.files_to_modify || [];

  for (var fi = 0; fi < files.length; fi++) {
    var f = files[fi].toLowerCase();
    if (f.indexOf("routes/requests") >= 0) tests.push("apps/api/src/__tests__/contracts.test.ts (request contract)");
    if (f.indexOf("routes/invoices") >= 0) tests.push("apps/api/src/__tests__/contracts.test.ts (invoice contract)");
    if (f.indexOf("routes/jobs") >= 0) tests.push("apps/api/src/__tests__/contracts.test.ts (job contract)");
    if (f.indexOf("routes/leases") >= 0) tests.push("apps/api/src/__tests__/contracts.test.ts (lease contract)");
    if (f.indexOf("authz") >= 0) tests.push("apps/api/src/__tests__/auth.manager-gates.test.ts");
    if (f.indexOf("transitions") >= 0) tests.push("apps/api/src/__tests__/transitions.test.ts");
  }

  return tests;
}

function inferRegressionChecks(draft, ctx) {
  var checks = [];
  var area = (draft.product_area || "").toLowerCase();

  checks.push("npm test — full suite passes");
  checks.push("npx tsc --noEmit — zero type errors");

  if (area === "invoicing") checks.push("Verify invoice lifecycle: DRAFT → ISSUED → APPROVED → PAID");
  if (area === "jobs") checks.push("Verify job lifecycle: PENDING → IN_PROGRESS → COMPLETED → INVOICED");
  if (area === "requests") checks.push("Verify request lifecycle including auto-approval + owner flow");
  if (area === "leases") checks.push("Verify lease lifecycle: DRAFT → READY_TO_SIGN → SIGNED → ACTIVE");
  if (area === "tenant-portal") checks.push("Verify tenant portal auth (requireTenantSession)");

  return checks;
}

function assessReadiness(draft, ctx) {
  var issues = [];

  // Check for missing critical fields
  if (!draft.goal || draft.goal.length < 20) issues.push("Goal is too brief");
  if (!draft.acceptance_criteria || draft.acceptance_criteria.length === 0) issues.push("No acceptance criteria");
  if (!draft.files_to_modify || draft.files_to_modify.length === 0 || onlyHasPlaceholderFiles(draft.files_to_modify)) {
    issues.push("No concrete files_to_modify");
  }
  if (!draft.in_scope || draft.in_scope.length === 0) issues.push("No in_scope defined");

  // Check if blocked
  var isBlocked = false;
  var deps = draft.depends_on || [];
  for (var di = 0; di < deps.length; di++) {
    var depDraft = (ctx.draftTickets || []).find(function(d) { return d.id === deps[di]; });
    if (depDraft && depDraft.status !== "promoted" && depDraft.status !== "ready") {
      issues.push("Blocked by " + deps[di] + " (status: " + (depDraft ? depDraft.status : "unknown") + ")");
      isBlocked = true;
    }
  }

  // Check if still too broad (epic-like)
  var title = (draft.title || "").toLowerCase();
  if (/\band\b.*\band\b/i.test(title) || title.length > 150) {
    issues.push("Title suggests multiple concerns — consider further splitting");
  }
  if ((draft.in_scope || []).length > 6) {
    issues.push("Large in_scope list (" + draft.in_scope.length + " items) — may still be epic-sized");
  }

  // Determine status
  var status;
  if (isBlocked) {
    status = REFINEMENT_STATUS.REFINED_BLOCKED;
  } else if (issues.length === 0) {
    status = REFINEMENT_STATUS.READY_CANDIDATE;
  } else {
    status = REFINEMENT_STATUS.REFINED;
  }

  return { status: status, notes: issues };
}

// ─── Prompt F — Refine All From Epic ──────────────────────────
//
// Batch-refine all child drafts from a parent intake/story,
// sharing a common context bundle to reduce redundancy.

function refineAllFromEpic(parentItem, childDrafts, projectContext) {
  var results = [];
  var summary = {
    refined_count: 0,
    blocked_count: 0,
    thin_warnings: [],
    merge_suggestions: [],
  };

  if (!parentItem || !childDrafts || childDrafts.length === 0) {
    return { results: results, summary: summary };
  }

  // Build shared context bundle once
  var sharedBundle = {
    parent_story_id: parentItem.id,
    parent_story_title: parentItem.title || normalizeTitle(parentItem.raw_text || ""),
    parent_story_raw_text: (parentItem.raw_text || "").substring(0, 800),
    story_intent: "Originating from intake " + parentItem.id + ": " + (parentItem.title || normalizeTitle(parentItem.raw_text || "")),
    story_success_outcome: "All sibling slices from " + parentItem.id + " are implemented and validated together.",
    shared_constraints: [],
    shared_files: [],
    shared_dependencies: parentItem.dependencies || [],
    sibling_ids: childDrafts.map(function(d) { return d.id; }),
  };

  // Detect shared files across children
  var fileFreq = {};
  for (var fi = 0; fi < childDrafts.length; fi++) {
    var files = childDrafts[fi].files_to_modify || [];
    for (var fj = 0; fj < files.length; fj++) {
      fileFreq[files[fj]] = (fileFreq[files[fj]] || 0) + 1;
    }
  }
  for (var fk in fileFreq) {
    if (fileFreq[fk] > 1) sharedBundle.shared_files.push(fk);
  }

  // Inject shared context before refining each child
  for (var ci = 0; ci < childDrafts.length; ci++) {
    var draft = childDrafts[ci];

    // Pre-populate shared fields if empty
    if (!draft.parent_story_id) draft.parent_story_id = sharedBundle.parent_story_id;
    if (!draft.parent_story_title) draft.parent_story_title = sharedBundle.parent_story_title;
    if (!draft.parent_story_raw_text) draft.parent_story_raw_text = sharedBundle.parent_story_raw_text;
    if (!draft.sibling_ticket_ids || draft.sibling_ticket_ids.length === 0) {
      draft.sibling_ticket_ids = sharedBundle.sibling_ids.filter(function(id) { return id !== draft.id; });
    }

    // Run individual refinement
    var result = refineDraft(draft, projectContext);
    results.push(result);

    if (result.refinement_status === REFINEMENT_STATUS.REFINED_BLOCKED) {
      summary.blocked_count++;
    } else {
      summary.refined_count++;
    }

    // Detect thin children
    if (detectThinChild(draft.title, parentItem.raw_text || "")) {
      summary.thin_warnings.push(draft.id + ": " + (draft.title || "").substring(0, 60) + " — may be too thin for independent validation");
    }
  }

  // Detect potential merges (children with very similar titles or overlapping scope)
  for (var mi = 0; mi < childDrafts.length; mi++) {
    for (var mj = mi + 1; mj < childDrafts.length; mj++) {
      var dA = childDrafts[mi];
      var dB = childDrafts[mj];
      var titleSim = jaccard(
        wordSet((dA.title || "") + " " + (dA.goal || "")),
        wordSet((dB.title || "") + " " + (dB.goal || ""))
      );
      if (titleSim >= 0.5) {
        summary.merge_suggestions.push("Consider merging " + dA.id + " and " + dB.id + " (similarity: " + Math.round(titleSim * 100) + "%)");
      }
    }
  }

  return { results: results, summary: summary, shared_bundle: sharedBundle };
}

// ─── Prompt C — Draft Readiness Validation ────────────────────
//
// Validates that a draft ticket is complete and context-preserving
// before marking it as "ready" for Copilot execution.

function validateDraftReadiness(draft, ctx) {
  var issues = [];

  // Required field checks
  if (!draft.title || draft.title.trim().length < 10) issues.push("Title is missing or too brief");
  if (!draft.goal || draft.goal.length < 20) issues.push("Goal is missing or too brief");
  if (!draft.story_intent) issues.push("Missing story_intent");
  if (!draft.story_success_outcome) issues.push("Missing story_success_outcome");
  if (!draft.in_scope || draft.in_scope.length === 0) issues.push("No in_scope defined");
  if (!draft.out_of_scope || draft.out_of_scope.length === 0) issues.push("No out_of_scope defined");
  if (!draft.acceptance_criteria || draft.acceptance_criteria.length === 0) issues.push("No acceptance_criteria");
  if (!draft.files_to_modify || draft.files_to_modify.length === 0 || onlyHasPlaceholderFiles(draft.files_to_modify)) {
    issues.push("No concrete files_to_modify");
  }
  if (!draft.files_to_inspect || draft.files_to_inspect.length === 0) issues.push("No files_to_inspect");
  if (!draft.test_protocol || draft.test_protocol.length === 0) issues.push("No test_protocol");

  // Anti-fragmentation checks
  var fromSplit = (draft.source_intake_ids && draft.source_intake_ids.length > 0) ||
    (draft.sibling_ticket_ids && draft.sibling_ticket_ids.length > 0);

  if (fromSplit && !draft.parent_story_id) {
    issues.push("Ticket came from a split but has no parent_story_id — context is lost");
  }
  if (fromSplit && !draft.slice_rationale) {
    issues.push("Ticket from a split is missing slice_rationale — no explanation of why this slice exists");
  }

  // Too-thin check: reject tickets that are purely mechanical without user-visible purpose
  if (draft.title && detectThinChild(draft.title, draft.parent_story_raw_text || "")) {
    issues.push("Ticket appears too thin — no clear user-visible or system-visible outcome");
  }

  // Overlap check: detect if this draft substantially duplicates a sibling
  if (draft.sibling_ticket_ids && draft.sibling_ticket_ids.length > 0) {
    var allDrafts = ctx.draftTickets || [];
    for (var si = 0; si < draft.sibling_ticket_ids.length; si++) {
      var sib = allDrafts.find(function(d) { return d.id === draft.sibling_ticket_ids[si]; });
      if (sib) {
        var overlap = jaccard(
          wordSet((draft.title || "") + " " + (draft.goal || "")),
          wordSet((sib.title || "") + " " + (sib.goal || ""))
        );
        if (overlap >= 0.6) {
          issues.push("Substantial overlap with sibling " + sib.id + " (" + Math.round(overlap * 100) + "% similarity)");
        }
      }
    }
  }

  // Test completeness (Prompt D integration)
  var testResult = validateTestCompleteness(draft, ctx);
  issues = issues.concat(testResult.issues);

  return { ready: issues.length === 0, issues: issues };
}

/**
 * generateCanonicalCopilotPrompt(draft, ctx) — Prompt C
 *
 * Generates the full Copilot-ready implementation prompt.
 * Includes architecture preamble, story context, scope, files, tests.
 */
function generateCanonicalCopilotPrompt(draft, ctx) {
  var lines = [];

  // Preamble
  lines.push("Read PROJECT_STATE.md, apps/api/src/ARCHITECTURE_LOW_CONTEXT_GUIDE.md, docs/AUDIT.md, and blueprint.js first and obey all guardrails exactly. Preserve existing behavior unless explicitly required for consistency or safety.");
  lines.push("");

  // Slice name + goal
  lines.push("## Slice: " + (draft.title || "Untitled"));
  lines.push("");
  lines.push("**Goal:** " + (draft.goal || "Implement as described."));
  lines.push("");

  // Parent story context
  if (draft.parent_story_id || draft.slice_rationale) {
    lines.push("### Parent Story Context");
    if (draft.parent_story_id) {
      lines.push("**Parent:** " + draft.parent_story_id + (draft.parent_story_title ? " — " + draft.parent_story_title : ""));
    }
    if (draft.slice_rationale) {
      lines.push("**Why this slice exists:** " + draft.slice_rationale);
    }
    if (draft.sibling_ticket_ids && draft.sibling_ticket_ids.length > 0) {
      lines.push("**Sibling tickets:** " + draft.sibling_ticket_ids.join(", "));
    }
    if (draft.sequence_role) {
      lines.push("**Sequence role:** " + draft.sequence_role);
    }
    lines.push("");
  }

  // Files to inspect
  if (draft.files_to_inspect && draft.files_to_inspect.length > 0) {
    lines.push("### Files to Inspect (read before coding)");
    for (var ii = 0; ii < draft.files_to_inspect.length; ii++) {
      lines.push("- " + draft.files_to_inspect[ii]);
    }
    lines.push("");
  }

  // Files to modify
  if (draft.files_to_modify && draft.files_to_modify.length > 0) {
    lines.push("### Files to Modify (in order)");
    for (var mi = 0; mi < draft.files_to_modify.length; mi++) {
      lines.push((mi + 1) + ". `" + draft.files_to_modify[mi] + "`");
    }
    lines.push("");
  }

  // Architecture rules
  lines.push("### Architecture Rules");
  lines.push("- Layer order: routes → workflows → services → repositories → Prisma (never skip)");
  lines.push("- Canonical includes required — no ad-hoc include trees");
  lines.push("- Schema changes require migration — never db push");
  lines.push("- Routes: thin HTTP handlers only, no business logic");
  lines.push("- Status transitions: transitions.ts only");
  if (draft.context_bundle && draft.context_bundle.shared_assumptions) {
    for (var ai = 0; ai < draft.context_bundle.shared_assumptions.length; ai++) {
      lines.push("- " + draft.context_bundle.shared_assumptions[ai]);
    }
  }
  lines.push("");

  // In scope / out of scope
  if (draft.in_scope && draft.in_scope.length > 0) {
    lines.push("### In Scope");
    for (var si2 = 0; si2 < draft.in_scope.length; si2++) {
      lines.push("- " + draft.in_scope[si2]);
    }
    lines.push("");
  }
  if (draft.out_of_scope && draft.out_of_scope.length > 0) {
    lines.push("### Out of Scope");
    for (var oi = 0; oi < draft.out_of_scope.length; oi++) {
      lines.push("- " + draft.out_of_scope[oi]);
    }
    lines.push("");
  }

  // Dependencies
  if (draft.depends_on && draft.depends_on.length > 0) {
    lines.push("### Dependencies");
    for (var di = 0; di < draft.depends_on.length; di++) {
      lines.push("- " + draft.depends_on[di]);
    }
    lines.push("");
  }

  // Risk notes
  if (draft.risk_notes && draft.risk_notes.length > 0) {
    lines.push("### Risk Notes (from AUDIT.md)");
    for (var ri = 0; ri < draft.risk_notes.length; ri++) {
      lines.push("- ⚠ " + draft.risk_notes[ri]);
    }
    lines.push("");
  }

  // Implementation requirements
  lines.push("### Required Output Before Code");
  lines.push("1. Output a short implementation plan listing files and changes");
  lines.push("2. Confirm no guardrail violations");
  lines.push("3. Proceed with implementation");
  lines.push("");

  // Acceptance criteria
  lines.push("### Definition of Done / Acceptance Criteria");
  var ac = draft.acceptance_criteria || ["Feature works as described"];
  for (var aci = 0; aci < ac.length; aci++) {
    lines.push("- [ ] " + ac[aci]);
  }
  lines.push("");

  // Tests
  if (draft.tests_to_add && draft.tests_to_add.length > 0) {
    lines.push("### Tests to Add");
    for (var ti = 0; ti < draft.tests_to_add.length; ti++) {
      lines.push("- " + draft.tests_to_add[ti]);
    }
    lines.push("");
  }
  if (draft.tests_to_update && draft.tests_to_update.length > 0) {
    lines.push("### Tests to Update");
    for (var tu = 0; tu < draft.tests_to_update.length; tu++) {
      lines.push("- " + draft.tests_to_update[tu]);
    }
    lines.push("");
  }

  // Test protocol
  if (draft.test_protocol && draft.test_protocol.length > 0) {
    lines.push("### Test Protocol");
    for (var tpi = 0; tpi < draft.test_protocol.length; tpi++) {
      lines.push((tpi + 1) + ". " + draft.test_protocol[tpi]);
    }
    lines.push("");
  }

  // Regression checks
  if (draft.regression_checks && draft.regression_checks.length > 0) {
    lines.push("### Regression Checks");
    for (var rci = 0; rci < draft.regression_checks.length; rci++) {
      lines.push("- " + draft.regression_checks[rci]);
    }
    lines.push("");
  }

  // Story-level regression (Prompt D)
  if (draft.story_level_regression_note) {
    lines.push("### Story-Level Regression");
    lines.push(draft.story_level_regression_note);
    lines.push("");
  }

  // Post-validation updates
  if (draft.post_validation_updates && draft.post_validation_updates.length > 0) {
    lines.push("### Post-Validation Updates");
    for (var pvi = 0; pvi < draft.post_validation_updates.length; pvi++) {
      lines.push("- " + draft.post_validation_updates[pvi]);
    }
    lines.push("");
  }

  // Validation checklist
  if (draft.validation_checklist && draft.validation_checklist.length > 0) {
    lines.push("### Validation Checklist");
    for (var vi = 0; vi < draft.validation_checklist.length; vi++) {
      lines.push("- [ ] " + draft.validation_checklist[vi]);
    }
  }

  return lines.join("\n");
}

// ─── Prompt D — Test Completeness Validation ──────────────────

function validateTestCompleteness(draft, ctx) {
  var issues = [];

  // Must have test protocol
  if (!draft.test_protocol || draft.test_protocol.length === 0) {
    issues.push("Missing test_protocol");
  }

  // Must have at least some tests defined
  var hasTests = (draft.tests_to_add && draft.tests_to_add.length > 0) ||
    (draft.tests_to_add_or_update && draft.tests_to_add_or_update.length > 0);
  if (!hasTests) {
    issues.push("No tests_to_add defined");
  }

  // Backend changes need unit/integration tests
  var files = draft.files_to_modify || [];
  var hasBackendFiles = files.some(function(f) { return /routes|services|workflows|repositories|prisma/i.test(f); });
  if (hasBackendFiles && !hasTests) {
    issues.push("Backend changes require unit/integration tests");
  }

  // Contract changes need DTO/OpenAPI/api-client updates
  var hasContractChange = files.some(function(f) { return /routes\/|api-client/i.test(f); });
  if (hasContractChange) {
    var hasContractTest = (draft.tests_to_update || []).some(function(t) { return /contract/i.test(t); });
    if (!hasContractTest) {
      issues.push("Contract change detected but no contract test update listed");
    }
  }

  // Split story regression check (Prompt D)
  var fromSplit = (draft.sibling_ticket_ids && draft.sibling_ticket_ids.length > 0) ||
    (draft.source_intake_ids && draft.source_intake_ids.length > 0 && draft.parent_story_id);
  if (fromSplit) {
    var hasRegressionCheck = (draft.regression_checks && draft.regression_checks.length > 0);
    if (!hasRegressionCheck) {
      issues.push("Part of a split story but has no regression_checks — broader story integrity may be at risk");
    }
    // Ensure story_level_regression_note exists
    if (!draft.story_level_regression_note) {
      draft.story_level_regression_note = generateStoryRegressionNote(draft, ctx);
    }
  }

  return { complete: issues.length === 0, issues: issues };
}

function generateStoryRegressionNote(draft, ctx) {
  var parts = [];
  parts.push("After completing this slice, verify that the broader story (" + (draft.parent_story_id || "parent") + ") still makes sense.");

  if (draft.sibling_ticket_ids && draft.sibling_ticket_ids.length > 0) {
    parts.push("Sibling slices (" + draft.sibling_ticket_ids.join(", ") + ") should not be broken by changes in this slice.");
  }

  var area = (draft.product_area || "").toLowerCase();
  if (area === "invoicing") parts.push("Verify invoice lifecycle still works end-to-end.");
  if (area === "jobs") parts.push("Verify job lifecycle still works end-to-end.");
  if (area === "requests") parts.push("Verify request lifecycle including approval flow.");
  if (area === "leases") parts.push("Verify lease lifecycle including signing flow.");

  if (draft.sequence_role === "foundation") {
    parts.push("CRITICAL: This is a foundational slice — downstream siblings depend on it. Run full test suite.");
  }

  return parts.join(" ");
}

// ─── Prompt E — Story Progress Computation ────────────────────

function computeStoryProgress(parentIntakeId, draftTickets, customItems) {
  if (!parentIntakeId) return null;

  var childDrafts = (draftTickets || []).filter(function(d) {
    return d.source_intake_ids && d.source_intake_ids.indexOf(parentIntakeId) >= 0;
  });

  if (childDrafts.length === 0) return null;

  var total = childDrafts.length;
  var promoted = 0;
  var ready = 0;
  var draft = 0;
  var blocked = 0;
  var done = 0;

  for (var i = 0; i < childDrafts.length; i++) {
    var d = childDrafts[i];
    if (d.status === "promoted") {
      promoted++;
      // Check if the promoted custom_item is done
      if (d.promoted_to) {
        var ci = (customItems || []).find(function(c) { return c.id === d.promoted_to; });
        if (ci && ci.status === "done") done++;
      }
    } else if (d.status === "ready") { ready++; }
    else if (d.refinement_status === "refined_blocked") { blocked++; }
    else { draft++; }
  }

  var state = "in_progress";
  if (done === total) state = "complete";
  else if (done > 0 || promoted > 0) state = "partially_shipped";
  else if (ready > 0) state = "ready_for_execution";
  else state = "drafting";

  return {
    parent_intake_id: parentIntakeId,
    total_children: total,
    done: done,
    promoted: promoted,
    ready: ready,
    draft: draft,
    blocked: blocked,
    state: state,
    progress_pct: total > 0 ? Math.round((done / total) * 100) : 0,
    child_ids: childDrafts.map(function(d) { return d.id; }),
  };
}

function determineParentStoryState(intake, draftTickets, customItems) {
  var progress = computeStoryProgress(intake.id, draftTickets, customItems);
  if (!progress) return intake.status;
  return progress.state;
}

// ─── Prompt J — Next Ticket Selection ─────────────────────────
//
// Selects the best next ready ticket for execution.
// Prefers: earliest phase → earliest order → smallest meaningful ticket
// that advances a coherent story. Skips done/blocked/context-thin tickets.

function selectNextTicket(customItems, draftTickets, intakeItems) {
  // First look for promoted ready tickets in custom_items
  var candidates = (customItems || []).filter(function(c) {
    return c.status === "planned" || c.status === "in_progress";
  });

  // Sort by phase (ascending), then order
  candidates.sort(function(a, b) {
    var pa = (a.phase || "P9").replace(/[^0-9]/g, "");
    var pb = (b.phase || "P9").replace(/[^0-9]/g, "");
    if (pa !== pb) return parseInt(pa) - parseInt(pb);
    return (a.order || 999) - (b.order || 999);
  });

  // Check for blocked tickets
  var unblocked = candidates.filter(function(c) {
    if (!c.depends_on || c.depends_on.length === 0) return true;
    return c.depends_on.every(function(dep) {
      var depTicket = (customItems || []).find(function(t) { return t.id === dep; });
      return depTicket && depTicket.status === "done";
    });
  });

  if (unblocked.length === 0 && candidates.length > 0) {
    return { ticket: null, reason: "All planned tickets are blocked by dependencies" };
  }
  if (unblocked.length === 0) {
    // Fall back to ready draft tickets
    var readyDrafts = (draftTickets || []).filter(function(d) {
      return d.status === "ready" && d.refinement_status !== "refined_blocked";
    });
    readyDrafts.sort(function(a, b) {
      var pa = (a.phase || "P9").replace(/[^0-9]/g, "");
      var pb = (b.phase || "P9").replace(/[^0-9]/g, "");
      if (pa !== pb) return parseInt(pa) - parseInt(pb);
      return (a.order || 999) - (b.order || 999);
    });
    if (readyDrafts.length > 0) {
      return {
        ticket: readyDrafts[0],
        source: "draft",
        reason: "No promoted tickets available; selected earliest ready draft: " + readyDrafts[0].id,
      };
    }
    return { ticket: null, reason: "No planned or ready tickets found" };
  }

  var selected = unblocked[0];

  // Build parent story context if available
  var parentContext = null;
  if (selected.implementation_prompt) {
    // Find source draft
    var sourceDraft = (draftTickets || []).find(function(d) { return d.promoted_to === selected.id; });
    if (sourceDraft && sourceDraft.parent_story_id) {
      var parentIntake = (intakeItems || []).find(function(it) { return it.id === sourceDraft.parent_story_id; });
      if (parentIntake) {
        parentContext = {
          parent_story_id: parentIntake.id,
          parent_story_title: parentIntake.title || normalizeTitle(parentIntake.raw_text || ""),
          sibling_ids: sourceDraft.sibling_ticket_ids || [],
          story_progress: computeStoryProgress(parentIntake.id, draftTickets, customItems),
        };
      }
    }
  }

  return {
    ticket: selected,
    source: "custom_item",
    reason: "Selected " + selected.id + " (" + selected.phase + " #" + (selected.order || "?") + "): " + (selected.title || "").substring(0, 60),
    parent_context: parentContext,
  };
}

// ─── Concern Keyword Extraction ───────────────────────────────
//
// Splits raw text into sentences and extracts the main verb+object
// phrase from each (first 5–6 words after stripping bullet markers).
// Returns up to 4 phrases.

function extractConcernKeywords(rawText) {
  if (!rawText || !rawText.trim()) return [];
  // Split on sentence-ending punctuation, commas (clause separators), bullet markers, and newlines
  var parts = rawText.split(/[.!?]\s+|,\s+|[\n\r]+/).map(function(s) { return s.trim(); }).filter(function(s) { return s.length > 5; });
  var phrases = [];
  for (var i = 0; i < parts.length && phrases.length < 4; i++) {
    var cleaned = parts[i]
      .replace(/^(?:\d+[.)]\s*|[-•*]\s*|>\s*|also\s+|and\s+|then\s+|but\s+)/i, '')
      .trim();
    if (!cleaned || cleaned.length < 4) continue;
    // Take first 6 words as the concern phrase
    var words = cleaned.split(/\s+/).slice(0, 6);
    var phrase = words.join(' ').replace(/[.,;:!?]+$/, '').trim();
    // Normalize: lowercase first word only if it looks like a verb
    if (/^[A-Z][a-z]/.test(phrase) && /^(should|must|need|want|can|add|allow|enable|create|build|implement|show|display|support|fix|remove|update|make)/i.test(phrase)) {
      phrase = phrase[0].toLowerCase() + phrase.slice(1);
    }
    // Avoid duplicating very similar phrases
    var dominated = false;
    for (var j = 0; j < phrases.length; j++) {
      if (phrases[j].toLowerCase() === phrase.toLowerCase()) { dominated = true; break; }
    }
    if (!dominated && phrase.length > 3) phrases.push(phrase);
  }
  return phrases;
}

// ─── Clarify Question Generator ───────────────────────────────
//
// Inspects an intake item and the full roadmap context to produce
// 1–3 targeted, conversational questions based on what is missing,
// ambiguous, or conflicting in the item's current state.
//
// Rules are evaluated in order. Each rule fires at most once.
// Generation stops at 3 questions.

function generateClarifyQuestions(item, context) {
  var questions = [];
  var features = context.features || [];

  // Helper to look up a feature title by ID
  function featureTitle(fid) {
    for (var i = 0; i < features.length; i++) {
      if (features[i].id === fid) return features[i].title || fid;
    }
    return fid;
  }

  // RULE 1 — Multiple concerns, no split plan yet
  if (questions.length < 3
    && item.split_recommended === true
    && (!item.proposed_split_plan || item.proposed_split_plan.length < 2)) {
    var keywords = extractConcernKeywords(item.raw_text || '');
    var listing = keywords.length > 0
      ? keywords.slice(0, 3).join(', ')
      : 'several things';
    questions.push({
      id: 'q' + (questions.length + 1),
      text: 'Your note covers several things \u2014 ' + listing + '. Which matters most to deliver first? Can any of these go in parallel, or does one need to be done before the others?',
      reason: 'multiple_concerns',
      fills: ['proposed_split_plan', 'proposed_phase']
    });
  }

  // RULE 2 — No product area matched
  if (questions.length < 3
    && (!item.product_area || item.product_area === 'general')) {
    questions.push({
      id: 'q' + (questions.length + 1),
      text: 'Which part of the system is this for? For example: tenant portal, manager dashboard, invoicing, lease management, work requests, or something else.',
      reason: 'no_product_area',
      fills: ['product_area']
    });
  }

  // RULE 3 — Persona unknown and note is feature-type
  if (questions.length < 3
    && !item.persona
    && item.note_type === 'feature_request'
    && item.scope_size !== 'small') {
    questions.push({
      id: 'q' + (questions.length + 1),
      text: 'Who is the primary user for this \u2014 a tenant, property manager, building owner, or contractor?',
      reason: 'persona_unknown',
      fills: ['persona']
    });
  }

  // RULE 4 — Epic scope, no success outcome
  if (questions.length < 3
    && (item.scope_size === 'epic'
        || (item.split_recommended && !item.story_success_outcome))) {
    questions.push({
      id: 'q' + (questions.length + 1),
      text: 'What does success look like once this is fully done? What will the user be able to do that they cannot do today?',
      reason: 'missing_success_outcome',
      fills: ['story_success_outcome', 'story_intent']
    });
  }

  // RULE 5 — Bug with unknown severity
  if (questions.length < 3
    && item.note_type === 'bug'
    && !item.triage_notes) {
    questions.push({
      id: 'q' + (questions.length + 1),
      text: 'Is this blocking a specific user right now, or is it a quality issue you want fixed before the next release?',
      reason: 'bug_severity_unknown',
      fills: ['proposed_phase', 'scope_size']
    });
  }

  // RULE 6 — Related feature found in roadmap
  if (questions.length < 3
    && item.related_feature_ids && item.related_feature_ids.length > 0
    && !item.triage_notes) {
    var relId = item.related_feature_ids[0];
    var relTitle = featureTitle(relId);
    questions.push({
      id: 'q' + (questions.length + 1),
      text: 'This looks related to an existing feature: ' + relId + ' \u2014 ' + relTitle + '. Should this extend that feature, or is it a separate thing that happens to touch the same area?',
      reason: 'related_feature_found',
      fills: ['parent_feature_id', 'related_feature_ids']
    });
  }

  // RULE 7 — Dependency hint detected but no depends_on
  if (questions.length < 3
    && item.dependencies && item.dependencies.length > 0
    && (!item.depends_on || item.depends_on.length === 0)) {
    var matchingDep = null;
    for (var di = 0; di < item.dependencies.length; di++) {
      if (/needs analysis|tbd|not yet/i.test(item.dependencies[di])) {
        matchingDep = item.dependencies[di];
        break;
      }
    }
    if (matchingDep) {
      questions.push({
        id: 'q' + (questions.length + 1),
        text: 'You mentioned this depends on something not yet in place: "' + matchingDep + '". Is that something already captured in the backlog, or should we add it as a prerequisite item?',
        reason: 'unresolved_dependency',
        fills: ['depends_on']
      });
    }
  }

  // RULE 8 — Fallback (nothing else fired)
  if (questions.length === 0) {
    questions.push({
      id: 'q1',
      text: 'What is the main business goal here \u2014 what problem does this solve for the user, and how will you know when it is done?',
      reason: 'fallback',
      fills: ['story_intent', 'story_success_outcome']
    });
  }

  // Build summary
  var summary = questions.length + ' question' + (questions.length !== 1 ? 's' : '') + ' \u2014 '
    + questions.map(function(q) { return q.reason.replace(/_/g, ' '); }).join(', ');

  return { questions: questions, summary: summary };
}

// ─── Answer-to-Fields Parser ──────────────────────────────────
//
// Parses a free-text answer from the user and fills specific intake
// item fields based on which questions were asked. Only fills fields
// that are currently empty on the item (never overwrites triage data).

function parseAnswerIntoFields(answer, questions, item, context) {
  var filled = [];
  if (!answer || !answer.trim() || !questions || questions.length === 0) return filled;
  var text = answer.trim();
  var textLower = text.toLowerCase();

  // Collect all fills from all questions
  var allFills = {};
  for (var qi = 0; qi < questions.length; qi++) {
    var q = questions[qi];
    if (!q.fills) continue;
    for (var fi = 0; fi < q.fills.length; fi++) {
      allFills[q.fills[fi]] = true;
    }
  }

  // product_area — match against AREA_RULES
  if (allFills['product_area'] && !item.product_area) {
    for (var ai = 0; ai < AREA_RULES.length; ai++) {
      if (AREA_RULES[ai].pattern.test(text)) {
        item.product_area = AREA_RULES[ai].area;
        filled.push('product_area');
        break;
      }
    }
  }

  // persona — match against known personas
  if (allFills['persona'] && !item.persona) {
    var personaPatterns = [
      { pattern: /\bmanager\b/i, value: 'manager' },
      { pattern: /\btenant\b/i, value: 'tenant' },
      { pattern: /\bowner\b/i, value: 'owner' },
      { pattern: /\bcontractor\b/i, value: 'contractor' },
    ];
    for (var pi = 0; pi < personaPatterns.length; pi++) {
      if (personaPatterns[pi].pattern.test(text)) {
        item.persona = personaPatterns[pi].value;
        filled.push('persona');
        break;
      }
    }
  }

  // proposed_phase — priority keywords
  if (allFills['proposed_phase'] && !item.proposed_phase) {
    if (/\burgent\b|\bblocking\b|\bnow\b|\basap\b/i.test(textLower)) {
      item.proposed_phase = 'P0';
      filled.push('proposed_phase');
    } else if (/\bnext release\b|\bsoon\b|\bimportant\b/i.test(textLower)) {
      item.proposed_phase = 'P1';
      filled.push('proposed_phase');
    } else if (/\blater\b|\bbacklog\b|\bfuture\b/i.test(textLower)) {
      item.proposed_phase = 'P2';
      filled.push('proposed_phase');
    }
  }

  // story_success_outcome — store full answer text
  if (allFills['story_success_outcome'] && !item.story_success_outcome) {
    item.story_success_outcome = text;
    filled.push('story_success_outcome');
  }

  // story_intent — store full answer text (if no success outcome asked separately)
  if (allFills['story_intent'] && !item.story_intent && filled.indexOf('story_success_outcome') === -1) {
    item.story_intent = text;
    filled.push('story_intent');
  }

  // proposed_split_plan — parse numbered points or "first...then" patterns
  if (allFills['proposed_split_plan']
    && (!item.proposed_split_plan || item.proposed_split_plan.length === 0)) {
    var plan = [];
    // Try numbered list: "1. foo  2. bar  3. baz"
    var numbered = text.match(/\d+[.)]\s*[^\n\d]+/g);
    if (numbered && numbered.length >= 2) {
      for (var ni = 0; ni < numbered.length; ni++) {
        var cleanTitle = numbered[ni].replace(/^\d+[.)]\s*/, '').trim();
        if (cleanTitle) plan.push({ title: cleanTitle, scope_hint: 'tbd' });
      }
    }
    // Try "first...then..." pattern
    if (plan.length === 0) {
      var firstThen = text.match(/first\s+(.+?)(?:,?\s*then\s+(.+?))?(?:,?\s*(?:and\s+)?(?:finally|after\s+that|then)\s+(.+))?$/i);
      if (firstThen) {
        if (firstThen[1]) plan.push({ title: firstThen[1].trim().replace(/[.,;]+$/, ''), scope_hint: 'tbd' });
        if (firstThen[2]) plan.push({ title: firstThen[2].trim().replace(/[.,;]+$/, ''), scope_hint: 'tbd' });
        if (firstThen[3]) plan.push({ title: firstThen[3].trim().replace(/[.,;]+$/, ''), scope_hint: 'tbd' });
      }
    }
    if (plan.length >= 2) {
      item.proposed_split_plan = plan;
      filled.push('proposed_split_plan');
    }
  }

  // parent_feature_id — if answer references existing feature relationship
  if (allFills['parent_feature_id'] && !item.parent_feature_id) {
    if (/\bextend\b|\bpart of\b|\bsub[\s-]*task\b|\bchild\b|\bbelongs?\b/i.test(textLower)) {
      if (item.related_feature_ids && item.related_feature_ids.length > 0) {
        item.parent_feature_id = item.related_feature_ids[0];
        filled.push('parent_feature_id');
      }
    }
  }

  // depends_on — if answer indicates backlog item
  if (allFills['depends_on'] && (!item.depends_on || item.depends_on.length === 0)) {
    if (/\balready\s+(?:captured|in\s+the\s+backlog|there|tracked)\b/i.test(textLower)) {
      // User says it's already captured — note but don't create
      item.depends_on = item.dependencies ? item.dependencies.slice() : [];
      if (item.depends_on.length > 0) filled.push('depends_on');
    } else if (/\badd\b|\bcreate\b|\bnew\b|\bshould\b/i.test(textLower)) {
      item.depends_on = item.dependencies ? item.dependencies.slice() : [];
      if (item.depends_on.length > 0) filled.push('depends_on');
    }
  }

  // scope_size — from bug severity answer
  if (allFills['scope_size'] && !item.scope_size) {
    if (/\bblocking\b|\bcritical\b|\bdown\b|\bcan.?t\s+use\b/i.test(textLower)) {
      item.scope_size = 'small';
      filled.push('scope_size');
    } else if (/\bquality\b|\bbefore\s+(?:the\s+)?next\s+release\b|\bnot\s+urgent\b/i.test(textLower)) {
      item.scope_size = 'medium';
      filled.push('scope_size');
    }
  }

  return filled;
}

// ─── Exports ──────────────────────────────────────────────────

module.exports = {
  parseIntakeBlob,
  triageIntakeItem,
  triageAll,
  promoteIntakeItem,
  promoteAll,
  generateImplementationPrompt,
  generateSplitPlan,
  refineDraft,
  REFINEMENT_STATUS,
  AREA_RULES,
  TYPE_RULES,
  inferNoteType,
  inferProductArea,
  inferAreaFromHeading,
  detectDependencies,
  detectSplitRecommended,
  normalizeTitle,
  // Prompt G
  assessSplitDecision,
  detectThinChild,
  detectFoundationalChild,
  // Prompt F
  refineAllFromEpic,
  // Prompt C
  validateDraftReadiness,
  generateCanonicalCopilotPrompt,
  // Prompt D
  validateTestCompleteness,
  generateStoryRegressionNote,
  // Prompt E
  computeStoryProgress,
  determineParentStoryState,
  // Prompt J
  selectNextTicket,
  // Prompt K — Clarify questions
  extractConcernKeywords,
  generateClarifyQuestions,
  parseAnswerIntoFields,
};
