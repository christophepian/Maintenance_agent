#!/usr/bin/env node
/**
 * generate-roadmap.js
 *
 * Zero-dependency roadmap generator for Maintenance Agent.
 * Reads ROADMAP.json + scans codebase → outputs docs/roadmap.html
 *
 * Produces the same IBM Plex dark-grid visual design as the architecture blueprint.
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

// ─── HTML Helpers ─────────────────────────────────────────────

function esc(s) {
  return String(s || "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}

// ─── CSS ──────────────────────────────────────────────────────

const CSS = `
@import url('https://fonts.googleapis.com/css2?family=IBM+Plex+Mono:wght@400;500;600&family=IBM+Plex+Sans:wght@300;400;500;600&display=swap');
:root{--bg:#0a0c10;--surface:#111318;--surface2:#181c24;--border:#1e2433;--border2:#2a3045;--text:#c8d0e0;--text-dim:#5a6580;--text-bright:#eef0f5;--accent-blue:#3d7eff;--accent-cyan:#00d4c8;--line:rgba(255,255,255,.06);--p0:#2ecc8a;--p1:#3d7eff;--p2:#9b6dff;--p3:#f5a623;--p4:#ff7c3a}
*{margin:0;padding:0;box-sizing:border-box}
body{background:var(--bg);color:var(--text);font-family:'IBM Plex Sans',sans-serif;font-size:13px;line-height:1.5}
body::before{content:'';position:fixed;inset:0;background-image:linear-gradient(var(--line) 1px,transparent 1px),linear-gradient(90deg,var(--line) 1px,transparent 1px);background-size:40px 40px;pointer-events:none;z-index:0}
.page{position:relative;z-index:1;max-width:1400px;margin:0 auto;padding:40px 32px 80px}
.header{display:flex;align-items:flex-start;justify-content:space-between;margin-bottom:28px;padding-bottom:20px;border-bottom:1px solid var(--border2)}
.doc-label{font-family:'IBM Plex Mono',monospace;font-size:10px;letter-spacing:.2em;text-transform:uppercase;color:var(--accent-blue);margin-bottom:8px}
.doc-title{font-size:26px;font-weight:600;color:var(--text-bright);letter-spacing:-.02em}
.doc-subtitle{font-size:13px;color:var(--text-dim);margin-top:4px}
.header-meta{text-align:right;font-family:'IBM Plex Mono',monospace;font-size:11px;color:var(--text-dim);line-height:1.8}
.meta-val{color:var(--text)}
.live-badge{display:inline-flex;align-items:center;gap:5px;background:rgba(46,204,138,.1);border:1px solid rgba(46,204,138,.3);border-radius:3px;padding:2px 8px;font-size:10px;color:#5ed9a0;font-family:'IBM Plex Mono',monospace;margin-bottom:6px}
.live-dot{width:6px;height:6px;border-radius:50%;background:#2ecc8a;animation:pulse 2s infinite}
@keyframes pulse{0%,100%{opacity:1}50%{opacity:.4}}
.stat-grid{display:grid;grid-template-columns:repeat(6,1fr);gap:1px;background:var(--border);border:1px solid var(--border);border-radius:6px;overflow:hidden;margin-bottom:28px}
.stat-cell{background:var(--surface);padding:14px;text-align:center}
.stat-num{font-family:'IBM Plex Mono',monospace;font-size:22px;font-weight:600;display:block;line-height:1;margin-bottom:4px}
.stat-label{font-size:10px;color:var(--text-dim);letter-spacing:.08em;text-transform:uppercase}
.tab-nav{display:flex;gap:2px;margin-bottom:20px;border-bottom:1px solid var(--border2)}
.tab-btn{padding:7px 14px;font-size:11px;font-weight:500;letter-spacing:.06em;text-transform:uppercase;color:var(--text-dim);cursor:pointer;border:none;background:none;border-bottom:2px solid transparent;margin-bottom:-1px;font-family:'IBM Plex Mono',monospace;transition:all .1s}
.tab-btn:hover{color:var(--text)}.tab-btn.active{color:var(--accent-blue);border-bottom-color:var(--accent-blue)}
.tab-pane{display:none}.tab-pane.active{display:block}
.filter-bar{display:flex;gap:6px;margin-bottom:16px;flex-wrap:wrap;align-items:center}
.filter-btn{padding:4px 10px;font-family:'IBM Plex Mono',monospace;font-size:10px;border:1px solid var(--border2);border-radius:3px;background:var(--surface);color:var(--text-dim);cursor:pointer;transition:all .1s}
.filter-btn:hover{color:var(--text)}.filter-btn.active{color:var(--accent-blue);border-color:rgba(61,126,255,.4);background:rgba(61,126,255,.08)}
.phase-block{border:1px solid var(--border);border-radius:6px;overflow:hidden;margin-bottom:14px}
.phase-head{display:flex;align-items:center;gap:12px;padding:10px 16px}
.phase-badge{font-family:'IBM Plex Mono',monospace;font-size:9px;font-weight:600;letter-spacing:.15em;padding:2px 7px;border-radius:2px;border:1px solid}
.phase-title{font-size:14px;font-weight:600;color:var(--text-bright)}
.phase-window{font-family:'IBM Plex Mono',monospace;font-size:10px;color:var(--text-dim)}
.phase-goal{font-size:11px;color:var(--text-dim);padding:8px 16px;background:var(--surface2);font-style:italic;border-bottom:1px solid var(--border)}
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
.feature-name{font-size:12px;font-weight:600;color:var(--text-bright);flex:1}
.feature-type{font-family:'IBM Plex Mono',monospace;font-size:9px;padding:1px 5px;border-radius:2px;border:1px solid;white-space:nowrap;flex-shrink:0;margin-top:2px}
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
.feature-desc{font-size:11px;color:var(--text-dim);line-height:1.5;margin-bottom:7px}
.feature-hooks{display:flex;flex-wrap:wrap;gap:4px}
.hook{font-family:'IBM Plex Mono',monospace;font-size:9px;padding:2px 5px;border-radius:2px;background:rgba(255,255,255,.04);border:1px solid var(--border2);color:var(--text-dim)}
.hook.exists{color:#5ed9a0;border-color:rgba(46,204,138,.25);background:rgba(46,204,138,.06)}
.hook.new{color:#f5c060;border-color:rgba(245,166,35,.25);background:rgba(245,166,35,.06)}
.hook.blocked{color:#ff8080;border-color:rgba(255,90,90,.25);background:rgba(255,90,90,.06)}
.custom-items-block{border-top:1px solid var(--border);margin-top:10px;padding-top:10px}
.custom-item{background:var(--bg);border:1px solid var(--border);border-radius:4px;padding:9px 12px;margin-bottom:6px}
.custom-item-head{display:flex;align-items:center;gap:8px;margin-bottom:5px;flex-wrap:wrap}
.custom-item-type{font-family:'IBM Plex Mono',monospace;font-size:9px;padding:1px 5px;border-radius:2px;border:1px solid}
.custom-item-persona{font-family:'IBM Plex Mono',monospace;font-size:10px;color:var(--accent-cyan);background:rgba(0,212,200,.08);border:1px solid rgba(0,212,200,.2);padding:1px 5px;border-radius:2px}
.custom-item-ticket{font-family:'IBM Plex Mono',monospace;font-size:10px;color:var(--accent-blue);background:rgba(61,126,255,.08);border:1px solid rgba(61,126,255,.2);padding:1px 5px;border-radius:2px}
.custom-item-title{font-size:12px;font-weight:500;color:var(--text-bright);margin-bottom:4px}
.custom-item-notes{font-size:11px;color:var(--text-dim);font-style:italic}
.panel{background:var(--surface);border:1px solid var(--border);border-radius:6px;overflow:hidden;margin-bottom:16px}
.panel-head{padding:9px 13px;background:var(--surface2);border-bottom:1px solid var(--border);display:flex;align-items:center;gap:8px}
.panel-head-dot{width:7px;height:7px;border-radius:50%;flex-shrink:0}
.panel-head-title{font-size:11px;font-weight:600;letter-spacing:.08em;text-transform:uppercase;color:var(--text-bright)}
.panel-body{padding:12px 14px}
.signal-table{width:100%;border-collapse:collapse}
.signal-table th{text-align:left;padding:6px 10px;background:var(--surface2);border-bottom:1px solid var(--border2);font-family:'IBM Plex Mono',monospace;font-size:9px;letter-spacing:.1em;color:var(--text-dim);text-transform:uppercase}
.signal-table td{padding:6px 10px;border-bottom:1px solid var(--border);font-family:'IBM Plex Mono',monospace;font-size:10px}
.signal-table tr:last-child td{border-bottom:none}
.three-col{display:grid;grid-template-columns:1fr 1fr 1fr;gap:12px}
.note-box{background:rgba(245,166,35,.06);border:1px solid rgba(245,166,35,.2);border-radius:4px;padding:7px 11px;font-size:11px;color:#c8a050;font-family:'IBM Plex Mono',monospace;margin-bottom:16px}
.note-box::before{content:'\u26A0  '}
.howto-code{background:var(--surface2);border:1px solid var(--border);border-radius:4px;padding:12px;margin:8px 0;color:var(--accent-cyan);font-family:'IBM Plex Mono',monospace;font-size:11px;line-height:1.9}
.footer{margin-top:40px;padding-top:16px;border-top:1px solid var(--border);display:flex;justify-content:space-between;align-items:center;font-family:'IBM Plex Mono',monospace;font-size:10px;color:var(--text-dim)}
`;

// ─── HTML Generator ───────────────────────────────────────────

function generateHtml(roadmap, signals, git) {
  const features = roadmap.features || [];
  const phases = roadmap.phases || [];
  const customItems = roadmap.custom_items || [];
  const project = roadmap.project || {};

  // Compute statuses for all features
  const computed = features.map(f => {
    const det = getFeatureStatus(f.detection, signals);
    return { ...f, computedStatus: det.status, signal: det.signal };
  });

  const doneCount = computed.filter(f => f.computedStatus === "done").length;
  const inProgressCount = computed.filter(f => f.computedStatus === "in_progress").length;
  const plannedCount = computed.length - doneCount - inProgressCount;
  const pct = computed.length > 0 ? Math.round((doneCount / computed.length) * 100) : 0;
  const now = new Date().toISOString().replace("T", " ").slice(0, 19) + " UTC";

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

  // Phase status label
  function phaseStatusLabel(phase, phaseFeatures) {
    const done = phaseFeatures.filter(f => f.computedStatus === "done").length;
    if (done === phaseFeatures.length && phaseFeatures.length > 0) return "DONE";
    if (phase.status === "in_progress" || phaseFeatures.some(f => f.computedStatus === "in_progress" || f.computedStatus === "done")) return "IN PROGRESS";
    if (phase.status === "planned" && phase.id === "P5") return "FUTURE";
    return "PLANNED";
  }

  // ─── Build phase blocks ───
  let phasesHtml = "";
  for (const phase of phases) {
    const pf = computed.filter(f => f.phase === phase.id);
    const pc = customItems.filter(c => c.phase === phase.id);
    const pfDone = pf.filter(f => f.computedStatus === "done").length;
    const pfInProgress = pf.filter(f => f.computedStatus === "in_progress").length;
    const pfPct = pf.length > 0 ? Math.round((pfDone / pf.length) * 100) : 0;
    const colorVar = phaseColorVar[phase.id] || "--text-dim";
    const phaseStatus = phaseStatusLabel(phase, pf);
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
      <span style="font-family:'IBM Plex Mono',monospace;font-size:9px;color:${statusTextColor(f.computedStatus)}">${statusLabel(f.computedStatus)}</span>
      <span style="font-family:'IBM Plex Mono',monospace;font-size:9px;color:var(--text-dim)">${esc(f.id)}</span>
      <span style="font-family:'IBM Plex Mono',monospace;font-size:9px;color:var(--text-dim);overflow:hidden;text-overflow:ellipsis;white-space:nowrap" title="${esc(f.signal)}">${esc(f.signal)}</span>
    </div>
    <div class="feature-desc">${esc(f.description)}</div>
    <div class="feature-hooks">${hooksExisting}${hooksNew}${hooksBlocked}</div>
  </div>`;
    }

    // Custom items within phase
    let customBlock = "";
    if (pc.length > 0) {
      customBlock = `<div class="custom-items-block">`;
      for (const c of pc) {
        const typeClass = `type-${c.type === "user_story" ? "story" : c.type}`;
        customBlock += `<div class="custom-item">
      <div class="custom-item-head">
        <div class="status-dot" style="background:${statusDotColor(c.status)};width:6px;height:6px"></div>
        <span class="custom-item-type ${typeClass}">${esc(c.type)}</span>
        ${c.persona ? `<span class="custom-item-persona">${esc(c.persona)}</span>` : ""}
        ${c.ticket ? `<span class="custom-item-ticket">${esc(c.ticket)}</span>` : ""}
        <span style="font-family:'IBM Plex Mono',monospace;font-size:9px;color:${statusTextColor(c.status)}">${statusLabel(c.status)}</span>
      </div>
      <div class="custom-item-title">${esc(c.title)}</div>
      ${c.notes ? `<div class="custom-item-notes">${esc(c.notes)}</div>` : ""}
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
        <div style="margin-left:auto;font-family:'IBM Plex Mono',monospace;font-size:10px;color:${phaseStatusColor}">${phaseStatus}</div>
      </div>
      <div class="phase-goal">${esc(phase.goal)}</div>
      <div class="phase-progress">
    <div class="phase-progress-bar"><div class="phase-progress-fill" style="width:${pfPct}%"></div></div>
    <span style="font-family:'IBM Plex Mono',monospace;font-size:10px;color:var(--text-dim)">${pfDone}/${pf.length} done \u00B7 ${pfInProgress} in progress \u00B7 ${pfPct}%</span>
  </div>
      <div class="phase-body">
        <div class="feature-grid">${featureCards}</div>
        ${customBlock}
      </div>
    </div>`;
  }

  // ─── Custom items tab ───
  let customTabHtml = "";
  if (customItems.length > 0) {
    for (const c of customItems) {
      const typeClass = `type-${c.type === "user_story" ? "story" : c.type}`;
      customTabHtml += `<div class="custom-item" style="margin-bottom:8px">
      <div class="custom-item-head">
        <div class="status-dot" style="background:${statusDotColor(c.status)};width:6px;height:6px"></div>
        <span style="font-family:'IBM Plex Mono',monospace;font-size:10px;color:var(--text-dim)">${esc(c.id)}</span>
        <span style="font-family:'IBM Plex Mono',monospace;font-size:10px;color:var(--text-dim)">${esc(c.phase)}</span>
        <span class="custom-item-type ${typeClass}">${esc(c.type)}</span>
        ${c.persona ? `<span class="custom-item-persona">${esc(c.persona)}</span>` : ""}
        ${c.ticket ? `<span class="custom-item-ticket">${esc(c.ticket)}</span>` : ""}
        <span style="font-family:'IBM Plex Mono',monospace;font-size:9px;color:${statusTextColor(c.status)};margin-left:auto">${statusLabel(c.status)}</span>
      </div>
      <div class="custom-item-title">${esc(c.title)}</div>
      ${c.notes ? `<div class="custom-item-notes">${esc(c.notes)}</div>` : ""}
    </div>`;
    }
  } else {
    customTabHtml = `<div style="padding:40px;text-align:center;color:var(--text-dim);font-family:'IBM Plex Mono',monospace;font-size:12px">No custom items yet.<br><br>Add entries to custom_items[] in ROADMAP.json<br>then run: <span style="color:var(--accent-cyan)">npm run roadmap</span></div>`;
  }

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

  // ─── Full HTML ───
  return `<!DOCTYPE html>
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
  <div class="stat-cell"><span class="stat-num" style="color:var(--p0)">${doneCount}</span><span class="stat-label">Done</span></div>
  <div class="stat-cell"><span class="stat-num" style="color:var(--p3)">${inProgressCount}</span><span class="stat-label">In Progress</span></div>
  <div class="stat-cell"><span class="stat-num" style="color:var(--text-dim)">${plannedCount}</span><span class="stat-label">Planned</span></div>
  <div class="stat-cell"><span class="stat-num" style="color:var(--text-bright)">${computed.length}</span><span class="stat-label">Total Features</span></div>
  <div class="stat-cell"><span class="stat-num" style="color:var(--accent-cyan)">${customItems.length}</span><span class="stat-label">Custom Items</span></div>
  <div class="stat-cell"><span class="stat-num" style="color:var(--text-bright)">${pct}%</span><span class="stat-label">Complete</span></div>
</div>

<div class="tab-nav">
  <button class="tab-btn active" onclick="switchTab('phases',this)">Phases</button>
  <button class="tab-btn" onclick="switchTab('custom',this)">Custom Items</button>
  <button class="tab-btn" onclick="switchTab('signals',this)">Codebase Signals</button>
  <button class="tab-btn" onclick="switchTab('howto',this)">How to Use</button>
</div>

<div class="tab-pane active" id="tab-phases">
  <div class="filter-bar">
    <span style="font-family:'IBM Plex Mono',monospace;font-size:10px;color:var(--text-dim)">Filter:</span>
    <button class="filter-btn active" onclick="filterPhases('all',this)">ALL</button>
    <button class="filter-btn" onclick="filterPhases('in_progress',this)">IN PROGRESS</button>
    <button class="filter-btn" onclick="filterPhases('planned',this)">PLANNED</button>
    <button class="filter-btn" onclick="filterPhases('done',this)" style="color:var(--p0)">DONE</button>
  </div>
  ${phasesHtml}
</div>

<div class="tab-pane" id="tab-custom">
  <div class="note-box">Edit custom_items[] in ROADMAP.json \u00B7 run npm run roadmap to regenerate \u00B7 Types: user_story \u00B7 task \u00B7 bug \u00B7 spike</div>
  ${customTabHtml}
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
      <div class="panel-body" style="font-family:'IBM Plex Mono',monospace;font-size:10px;color:var(--text-dim);line-height:1.8">${modelsListHtml}</div>
    </div>
    <div class="panel">
      <div class="panel-head"><div class="panel-head-dot" style="background:var(--p1)"></div><div class="panel-head-title">Workflows (${signals.workflows.length})</div></div>
      <div class="panel-body" style="font-family:'IBM Plex Mono',monospace;font-size:10px;color:var(--text-dim);line-height:1.8">${workflowsListHtml}</div>
    </div>
    <div class="panel">
      <div class="panel-head"><div class="panel-head-dot" style="background:var(--p2)"></div><div class="panel-head-title">Routes (${signals.routes.length})</div></div>
      <div class="panel-body" style="font-family:'IBM Plex Mono',monospace;font-size:10px;color:var(--text-dim);line-height:1.8">${routesListHtml}</div>
    </div>
  </div>
</div>

<div class="tab-pane" id="tab-howto">
  <div class="panel"><div class="panel-body" style="font-family:'IBM Plex Mono',monospace;font-size:11px;line-height:2.2;color:var(--text)">
    <span style="color:var(--p0)">\u25A0</span> <strong>Auto-detection</strong> \u2014 features update automatically when you ship code.<br>
    &nbsp;&nbsp;Script reads schema.prisma \u00B7 workflows/ \u00B7 services/ \u00B7 .env files.<br>
    &nbsp;&nbsp;When a signal is found in your codebase, the card auto-marks DONE.<br><br>
    <span style="color:var(--p1)">\u25A0</span> <strong>Adding a user story or task</strong> \u2014 edit ROADMAP.json \u2192 custom_items[]:<br>
    <div class="howto-code">  {<br>
&nbsp;&nbsp;"id": "US-001",&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;<span style="color:var(--text-dim)">// US-XXX | DISC-XXX | BUG-XXX | SPK-XXX</span><br>
&nbsp;&nbsp;"phase": "P1",&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;<span style="color:var(--text-dim)">// P0 | P1 | P2 | P3 | P4 | P5</span><br>
&nbsp;&nbsp;"title": "As a landlord, I want ...",<br>
&nbsp;&nbsp;"type": "user_story",&nbsp;<span style="color:var(--text-dim)">// user_story | task | bug | spike</span><br>
&nbsp;&nbsp;"persona": "owner",&nbsp;&nbsp;&nbsp;<span style="color:var(--text-dim)">// owner | tenant | manager | contractor</span><br>
&nbsp;&nbsp;"ticket": "GH-142",&nbsp;&nbsp;<span style="color:var(--text-dim)">// GitHub / Linear / Jira ref, or null</span><br>
&nbsp;&nbsp;"status": "planned",&nbsp;&nbsp;<span style="color:var(--text-dim)">// planned | in_progress | done | blocked</span><br>
&nbsp;&nbsp;"notes": "acceptance criteria or context"<br>
  }</div>
    <span style="color:var(--p2)">\u25A0</span> <strong>Regenerating</strong><br>
    &nbsp;&nbsp;<span style="color:var(--accent-cyan)">node scripts/generate-roadmap.js</span> \u2014 generate once<br>
    &nbsp;&nbsp;<span style="color:var(--accent-cyan)">npm run roadmap:watch</span> \u2014 watch mode (auto-regenerates on schema or ROADMAP.json change)<br>
    &nbsp;&nbsp;Open <span style="color:var(--accent-cyan)">docs/roadmap.html</span> with VS Code Live Server \u2192 auto-refreshes every generation.<br><br>
    <span style="color:var(--p3)">\u25A0</span> <strong>Wiring a new feature for auto-detection</strong> \u2014 add a detection block to features[] in ROADMAP.json:<br>
    &nbsp;&nbsp;model_exists \u00B7 model_field \u00B7 enum_exists \u00B7 workflow_exists \u00B7 file_exists \u00B7 page_exists \u00B7 env_key
  </div></div>
</div>

<div class="footer">
  <div>${esc(project.name || "Maintenance Agent")} \u00B7 ${now} \u00B7 ${esc(git.branch)}@${esc(git.commit)} \u00B7 scripts/generate-roadmap.js</div>
  <div style="display:flex;gap:14px"><span style="color:var(--p0)">\u25CF Done</span><span style="color:var(--p3)">\u25CF In Progress</span><span style="color:var(--text-dim)">\u25CF Planned</span><span style="color:#ff5a5a">\u25CF Blocked</span></div>
</div>

</div>
<script>
function switchTab(id,btn){document.querySelectorAll('.tab-btn').forEach(b=>b.classList.remove('active'));document.querySelectorAll('.tab-pane').forEach(p=>p.classList.remove('active'));document.getElementById('tab-'+id).classList.add('active');btn.classList.add('active')}
function filterPhases(filter,btn){document.querySelectorAll('.filter-btn').forEach(b=>b.classList.remove('active'));btn.classList.add('active');document.querySelectorAll('.phase-block').forEach(block=>{if(filter==='all'){block.style.display='';return}const s=block.dataset.status;const hasFeatureMatch=[...block.querySelectorAll('.feature-card')].some(c=>c.dataset.status===filter);block.style.display=(s===filter||hasFeatureMatch)?'':'none'})}
</script>
</body>
</html>`;
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
  const html = generateHtml(roadmap, signals, git);

  const docsDir = path.dirname(OUTPUT_PATH);
  if (!fs.existsSync(docsDir)) fs.mkdirSync(docsDir, { recursive: true });

  fs.writeFileSync(OUTPUT_PATH, html, "utf8");
  console.log(`\u2705 Written \u2192 ${path.relative(ROOT, OUTPUT_PATH)}`);
}

main();
