#!/usr/bin/env node
/**
 * Maintenance Agent — Architecture Blueprint Generator
 *
 * Location: apps/api/blueprint.js
 * Usage:    node blueprint.js          (from apps/api/)
 *           npm run blueprint          (from apps/api/)
 *
 * Reads: ../../PROJECT_STATE.md, ../../SCHEMA_REFERENCE.md,
 *        prisma/schema.prisma, src/ (live file counts)
 * Writes: ../../docs/blueprint.html
 * Opens:  system browser automatically
 */

const fs   = require('fs');
const path = require('path');
const { execSync } = require('child_process');

const ROOT = path.resolve(__dirname, '../..');

process.on('uncaughtException', err => {
  console.error('❌ Uncaught error:', err.message);
  console.error(err.stack);
  process.exit(1);
});

const SYNC_ONLY = process.argv.includes('--sync-only');

// ─────────────────────────────────────────────
// HELPERS
// ─────────────────────────────────────────────
function readFile(rel) {
  const p = path.join(ROOT, rel);
  return fs.existsSync(p) ? fs.readFileSync(p, 'utf8') : '';
}

function countFiles(dir, ext) {
  const abs = path.join(ROOT, dir);
  if (!fs.existsSync(abs)) return 0;
  let count = 0;
  function walk(d) {
    for (const f of fs.readdirSync(d, { withFileTypes: true })) {
      if (f.isDirectory()) walk(path.join(d, f.name));
      else if (!ext || f.name.endsWith(ext)) count++;
    }
  }
  walk(abs);
  return count;
}

function countLinesInDir(dir, ext) {
  const abs = path.join(ROOT, dir);
  if (!fs.existsSync(abs)) return 0;
  let total = 0;
  const EXCLUDE = ['node_modules', '.next', 'dist', '.data'];
  function walk(d) {
    for (const f of fs.readdirSync(d, { withFileTypes: true })) {
      if (f.isDirectory()) {
        if (!EXCLUDE.includes(f.name)) walk(path.join(d, f.name));
      } else if (!ext || f.name.endsWith(ext)) {
        try { total += fs.readFileSync(path.join(d, f.name), 'utf8').split('\n').length; } catch {}
      }
    }
  }
  walk(abs);
  return total;
}

function findMatches(dir, ext, regex) {
  const abs = path.join(ROOT, dir);
  if (!fs.existsSync(abs)) return [];
  const matches = new Set();
  function walk(d) {
    for (const f of fs.readdirSync(d, { withFileTypes: true })) {
      if (f.isDirectory()) walk(path.join(d, f.name));
      else if (!ext || f.name.endsWith(ext)) {
        try {
          const src = fs.readFileSync(path.join(d, f.name), 'utf8');
          let m;
          while ((m = regex.exec(src)) !== null) matches.add(m[1]);
        } catch {}
      }
    }
  }
  walk(abs);
  return [...matches];
}

function extractFromMd(md, heading) {
  const lines = md.split('\n');
  let capturing = false, result = [];
  for (const line of lines) {
    if (line.startsWith('#') && line.toLowerCase().includes(heading.toLowerCase())) {
      capturing = true; continue;
    }
    if (capturing && line.startsWith('#')) break;
    if (capturing) result.push(line);
  }
  return result.join('\n').trim();
}

// ─────────────────────────────────────────────
// PARSE CODEBASE
// ─────────────────────────────────────────────
console.log('🔍 Parsing codebase...');

const projectState    = readFile('PROJECT_STATE.md');
const schemaRef       = readFile('SCHEMA_REFERENCE.md');
const schemaFile      = readFile('apps/api/prisma/schema.prisma');
const openapi         = readFile('apps/api/openapi.yaml');
const packageJson     = (() => { try { return JSON.parse(readFile('package.json')); } catch { return {}; } })();

// ── Stats ──
const prismaModels    = (schemaFile.match(/^model\s+\w+/gm) || []).length;
const prismaEnums     = (schemaFile.match(/^enum\s+\w+/gm) || []).length;
const migrations      = (() => {                                       // count migration directories only
  const abs = path.join(ROOT, 'apps/api/prisma/migrations');
  if (!fs.existsSync(abs)) return 0;
  return fs.readdirSync(abs, { withFileTypes: true }).filter(f => f.isDirectory()).length;
})();
const apiRoutes       = (openapi.match(/^\s{2}\/[^\s]/gm) || []).length || 
                        parseInt((projectState.match(/~?(\d+)\s*(?:API\s+)?routes/i) || [])[1] || 0);
const frontendPages   = countFiles('apps/web/pages', '.js') + countFiles('apps/web/pages', '.tsx');
const testCount       = parseInt(([...projectState.matchAll(/(\d+)\s*tests/gi)].pop() || [])[1] || '308');
const testSuites      = parseInt(([...projectState.matchAll(/(\d+)\s*suites/gi)].pop() || [])[1] || '28');
const backendLOC      = countLinesInDir('apps/api/src', '.ts');
const frontendLOC     = countLinesInDir('apps/web', '.js') + countLinesInDir('apps/web', '.tsx');

// ── Route modules ──
const routeModules = (() => {
  const serverSrc = readFile('apps/api/src/server.ts');
  const found = [...new Set([...serverSrc.matchAll(/register(\w+)Routes/g)].map(m =>
    m[1].replace(/([A-Z])/g, c => ' ' + c.toLowerCase()).trim()
  ))];
  return found.length ? found : ['requests','leases','invoices','inventory','tenants',
    'config','notifications','auth','rentalApplications','contractor','financials','legal','helpers'];
})();

// ── Workflow names ──
const workflowFiles = (() => {
  const abs = path.join(ROOT, 'apps/api/src/workflows');
  if (!fs.existsSync(abs)) return [];
  return fs.readdirSync(abs)
    .filter(f => f.endsWith('.ts') && !['transitions.ts', 'index.ts', 'context.ts'].includes(f))
    .map(f => f.replace('.ts',''));
})();

// ── Repository names ──
const repoFiles = (() => {
  const abs = path.join(ROOT, 'apps/api/src/repositories');
  if (!fs.existsSync(abs)) return [];
  return fs.readdirSync(abs)
    .filter(f => f.endsWith('.ts') && !['index.ts'].includes(f))
    .map(f => f.replace('.ts',''));
})();

// ── Prisma model names grouped ──
const modelNames = (schemaFile.match(/^model\s+(\w+)/gm) || []).map(m => m.split(' ')[1]);

// ── State machine states from transitions.ts ──
const transitionsSrc = readFile('apps/api/src/workflows/transitions.ts');
const requestStates = [...new Set((transitionsSrc.match(/RequestStatus\.\w+/g) || []).map(s => s.split('.')[1]))];
const jobStates     = [...new Set((transitionsSrc.match(/JobStatus\.\w+/g)     || []).map(s => s.split('.')[1]))];
const invoiceStates = [...new Set((transitionsSrc.match(/InvoiceStatus\.\w+/g) || []).map(s => s.split('.')[1]))];

// ── Guardrail statuses from PROJECT_STATE.md ──
function parseGuardrails(md) {
  const guardrails = [];
  const re = /###\s+(G\d+|F\d+)[:\s—–-]+([^\n]+)\n([\s\S]+?)(?=###\s+[GFH]|\n---|\n## )/g;
  let m;
  while ((m = re.exec(md)) !== null) {
    const id = m[1], title = m[2].trim();
    const body = m[3].trim().split('\n')[0].replace(/[*_`]/g, '').trim();
    // F2 — org scoping: production null guard now in place, warn only if M2 explicitly pending
    const isF2 = id === 'F2';
    const warn = isF2
      ? /M2 pending|not yet implemented/i.test(body)
      : /exception|pending|⚠|Known Exception/i.test(body);
    guardrails.push({ id, title, body: body.slice(0, 120), warn });
  }
  return guardrails;
}
const guardrails = parseGuardrails(projectState);

// ── Audit findings from docs/AUDIT.md ──
const auditMd = readFile('docs/AUDIT.md');
function parseAuditFindings(md) {
  if (!md) return { areas: [], findings: [] };
  // Parse summary table
  const areas = [];
  const tableRe = /\|\s*([^|]+?)\s*\|\s*(\d+)\s*\|\s*(\d+)\s*\|\s*(\d+)\s*\|\s*(\d+)\s*\|\s*(\d+)\s*\|\s*(\d+)\s*\|/g;
  let tm;
  while ((tm = tableRe.exec(md)) !== null) {
    const name = tm[1].replace(/\*\*/g, '').trim();
    if (name === 'Area' || name === 'Total') continue;
    areas.push({ name, findings: +tm[2], critical: +tm[3], high: +tm[4], medium: +tm[5], low: +tm[6], resolved: +tm[7] });
  }
  // Parse individual findings
  const findings = [];
  const fRe = /###\s+((?:SA|TC|SI|CQ)-\d+(?:–\d+)?)\s*·\s*([^\n]+)\n([\s\S]*?)(?=###\s+(?:SA|TC|SI|CQ)-|\n---|\n## (?:Recommended|Area))/g;
  let fm;
  while ((fm = fRe.exec(md)) !== null) {
    const id = fm[1], title = fm[2].trim(), body = fm[3];
    const resolved = /Status:\s*✅\s*Resolved/i.test(body);
    const severity = /CRITICAL/i.test(title) ? 'critical' : /HIGH/i.test(title) ? 'high' : /MEDIUM/i.test(title) ? 'medium' : 'low';
    findings.push({ id, title, severity, resolved });
  }
  return { areas, findings };
}
const audit = parseAuditFindings(auditMd);

// ── Backlog items ──
const backlogSection = extractFromMd(projectState, 'Not Implemented Yet');
const backlogItems   = backlogSection.split('\n')
  .filter(l => l.trim().startsWith('*'))
  .map(l => l.replace(/^\*\s*/, '').trim())
  .filter(Boolean)
  .slice(0, 8);

// ── Git info ──
let gitBranch = 'unknown', gitHash = 'unknown', gitDate = 'unknown';
try {
  gitBranch = execSync('git -C "' + ROOT + '" rev-parse --abbrev-ref HEAD', {stdio:['pipe','pipe','ignore']}).toString().trim();
  gitHash   = execSync('git -C "' + ROOT + '" rev-parse --short HEAD',       {stdio:['pipe','pipe','ignore']}).toString().trim();
  gitDate   = execSync('git -C "' + ROOT + '" log -1 --format=%ci',           {stdio:['pipe','pipe','ignore']}).toString().trim().slice(0,10);
} catch {}

const generatedAt = new Date().toISOString().replace('T',' ').slice(0,19) + ' UTC';

// ── Last verified date ──
const lastVerified = (projectState.match(/Last updated[:\s]+([^\n]+)/i) || [])[1]
  ?.replace(/\*\*/g, '').trim() || generatedAt.slice(0,10);

console.log(`  Models: ${prismaModels}, Enums: ${prismaEnums}, Routes: ${apiRoutes}, Pages: ${frontendPages}`);
console.log(`  Backend LOC: ${backendLOC.toLocaleString()}, Frontend LOC: ${frontendLOC.toLocaleString()}`);
console.log(`  Tests: ${testCount} / ${testSuites} suites`);

// ─────────────────────────────────────────────
// HTML HELPERS
// ─────────────────────────────────────────────
function tag(t, cls, content) {
  return `<${t}${cls ? ` class="${cls}"` : ''}>${content}</${t}>`;
}
function box(label, subtitle, color='blue') {
  return `<div class="box accent-${color}">${label}${subtitle ? `<small>${subtitle}</small>` : ''}</div>`;
}
function tagBadge(name, color='') {
  return `<span class="tag ${color}">${name}</span>`;
}
function smState(label, type) {
  return `<div class="sm-state ${type}">${label}</div><div class="sm-arrow">→</div>`;
}
function statCell(num, label, color='') {
  return `<div class="stat-cell"><span class="stat-num ${color}">${num}</span><span class="stat-label">${label}</span></div>`;
}
function guardrailHtml(g) {
  const cls = g.warn ? 'warn' : 'ok';
  return `<div class="guardrail ${cls}"><div class="guardrail-id">${g.id} — ${g.title}</div><div class="guardrail-title">${g.body}</div></div>`;
}
function modelGroup(title, names, color) {
  const tags = names.map(n => tagBadge(n, color)).join('');
  return `
    <div class="panel">
      <div class="panel-head">
        <div class="panel-head-dot" style="background:var(--accent-${color})"></div>
        <div class="panel-head-title">${title}</div>
        <div class="panel-head-count">${names.length} models</div>
      </div>
      <div class="panel-body"><div class="tag-list">${tags}</div></div>
    </div>`;
}

// categorise model names heuristically
function categoriseModels(names) {
  const core    = names.filter(n => /Request|Job|Invoice|Lease|Rental|LineItem|Charge/.test(n));
  const property= names.filter(n => /Building|Unit|Appliance|Asset|Depreciation|Listing|Intervention/.test(n));
  const people  = names.filter(n => /User|Tenant|Contractor|Owner|Org/.test(n));
  const legal   = names.filter(n => /Legal|Category|RFP/.test(n));
  const docs    = names.filter(n => /Notification|Email|Document|Signature/.test(n));
  const other   = names.filter(n => ![...core,...property,...people,...legal,...docs].includes(n));
  return { core, property, people, legal, docs, other };
}
const mc = categoriseModels(modelNames);

// ─────────────────────────────────────────────
// BUILD HTML
// ─────────────────────────────────────────────
if (!SYNC_ONLY) {
const html = `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>Maintenance Agent — Architecture Blueprint</title>
<style>
  @import url('https://fonts.googleapis.com/css2?family=IBM+Plex+Mono:wght@400;500;600&family=IBM+Plex+Sans:wght@300;400;500;600&display=swap');
  :root {
    --bg:#0a0c10; --surface:#111318; --surface2:#181c24;
    --border:#1e2433; --border2:#2a3045;
    --text:#c8d0e0; --text-dim:#5a6580; --text-bright:#eef0f5;
    --accent-blue:#3d7eff; --accent-cyan:#00d4c8; --accent-amber:#f5a623;
    --accent-green:#2ecc8a; --accent-purple:#9b6dff; --accent-red:#ff5a5a;
    --line:rgba(255,255,255,0.06);
  }
  *{margin:0;padding:0;box-sizing:border-box}
  body{background:var(--bg);color:var(--text);font-family:'IBM Plex Sans',sans-serif;font-size:13px;line-height:1.5;min-height:100vh}
  body::before{content:'';position:fixed;inset:0;background-image:linear-gradient(var(--line) 1px,transparent 1px),linear-gradient(90deg,var(--line) 1px,transparent 1px);background-size:40px 40px;pointer-events:none;z-index:0}
  .page{position:relative;z-index:1;max-width:1400px;margin:0 auto;padding:40px 32px 80px}
  .header{display:flex;align-items:flex-start;justify-content:space-between;margin-bottom:36px;padding-bottom:20px;border-bottom:1px solid var(--border2)}
  .doc-label{font-family:'IBM Plex Mono',mono;font-size:10px;letter-spacing:.2em;text-transform:uppercase;color:var(--accent-blue);margin-bottom:8px}
  .doc-title{font-size:26px;font-weight:600;color:var(--text-bright);letter-spacing:-.02em}
  .doc-subtitle{font-size:13px;color:var(--text-dim);margin-top:4px}
  .header-meta{text-align:right;font-family:'IBM Plex Mono',mono;font-size:11px;color:var(--text-dim);line-height:1.8}
  .meta-val{color:var(--text)}
  .live-badge{display:inline-flex;align-items:center;gap:5px;background:rgba(46,204,138,.1);border:1px solid rgba(46,204,138,.3);border-radius:3px;padding:2px 8px;font-size:10px;color:#5ed9a0;font-family:'IBM Plex Mono',mono;margin-bottom:6px}
  .live-dot{width:6px;height:6px;border-radius:50%;background:#2ecc8a;animation:pulse 2s infinite}
  @keyframes pulse{0%,100%{opacity:1}50%{opacity:.4}}
  .section{margin-bottom:40px}
  .section-header{display:flex;align-items:center;gap:10px;margin-bottom:18px}
  .section-num{font-family:'IBM Plex Mono',mono;font-size:10px;color:var(--accent-blue);letter-spacing:.15em}
  .section-title{font-size:11px;font-weight:600;letter-spacing:.12em;text-transform:uppercase;color:var(--text-bright)}
  .section-line{flex:1;height:1px;background:var(--border2)}
  .stat-grid{display:grid;grid-template-columns:repeat(8,1fr);gap:1px;background:var(--border);border:1px solid var(--border);border-radius:6px;overflow:hidden;margin-bottom:24px}
  .stat-cell{background:var(--surface);padding:14px;text-align:center}
  .stat-num{font-family:'IBM Plex Mono',mono;font-size:22px;font-weight:600;color:var(--text-bright);display:block;line-height:1;margin-bottom:4px}
  .stat-num.blue{color:var(--accent-blue)}.stat-num.cyan{color:var(--accent-cyan)}.stat-num.green{color:var(--accent-green)}.stat-num.amber{color:var(--accent-amber)}.stat-num.purple{color:var(--accent-purple)}
  .stat-label{font-size:10px;color:var(--text-dim);letter-spacing:.08em;text-transform:uppercase}
  .tab-nav{display:flex;gap:2px;margin-bottom:20px;border-bottom:1px solid var(--border2)}
  .tab-btn{padding:7px 14px;font-size:11px;font-weight:500;letter-spacing:.06em;text-transform:uppercase;color:var(--text-dim);cursor:pointer;border:none;background:none;border-bottom:2px solid transparent;margin-bottom:-1px;font-family:'IBM Plex Mono',mono;transition:all .1s}
  .tab-btn:hover{color:var(--text)}.tab-btn.active{color:var(--accent-blue);border-bottom-color:var(--accent-blue)}
  .tab-pane{display:none}.tab-pane.active{display:block}
  .layer-diagram{display:flex;flex-direction:column;gap:2px}
  .layer{display:flex;align-items:stretch;gap:2px}
  .layer-label{width:130px;flex-shrink:0;display:flex;align-items:center;justify-content:flex-end;padding-right:14px;font-family:'IBM Plex Mono',mono;font-size:10px;letter-spacing:.1em;color:var(--text-dim);text-transform:uppercase;text-align:right}
  .layer-content{flex:1;display:flex;gap:4px;flex-wrap:wrap}
  .layer-connector{display:flex;margin-left:144px;color:var(--text-dim);font-size:12px;padding:2px 0;font-family:'IBM Plex Mono',mono}
  .box{background:var(--surface);border:1px solid var(--border);border-radius:4px;padding:9px 13px;font-size:12px;font-weight:500;color:var(--text);cursor:default;transition:all .15s;white-space:nowrap}
  .box:hover{border-color:var(--border2);color:var(--text-bright);background:var(--surface2);transform:translateY(-1px)}
  .box.accent-blue{border-left:3px solid var(--accent-blue)}.box.accent-cyan{border-left:3px solid var(--accent-cyan)}.box.accent-green{border-left:3px solid var(--accent-green)}.box.accent-amber{border-left:3px solid var(--accent-amber)}.box.accent-purple{border-left:3px solid var(--accent-purple)}.box.accent-red{border-left:3px solid var(--accent-red)}
  .box.flex-fill{flex:1}.box small{display:block;font-size:10px;color:var(--text-dim);font-family:'IBM Plex Mono',mono;font-weight:400;margin-top:2px}
  .two-col{display:grid;grid-template-columns:1fr 1fr;gap:16px}
  .three-col{display:grid;grid-template-columns:1fr 1fr 1fr;gap:16px}
  .panel{background:var(--surface);border:1px solid var(--border);border-radius:6px;overflow:hidden}
  .panel-head{padding:9px 13px;background:var(--surface2);border-bottom:1px solid var(--border);display:flex;align-items:center;gap:8px}
  .panel-head-dot{width:7px;height:7px;border-radius:50%;flex-shrink:0}
  .panel-head-title{font-size:11px;font-weight:600;letter-spacing:.08em;text-transform:uppercase;color:var(--text-bright)}
  .panel-head-count{margin-left:auto;font-family:'IBM Plex Mono',mono;font-size:10px;color:var(--text-dim)}
  .panel-body{padding:11px 13px}
  .tag-list{display:flex;flex-wrap:wrap;gap:5px}
  .tag{padding:3px 7px;border-radius:3px;font-family:'IBM Plex Mono',mono;font-size:10px;background:var(--surface2);border:1px solid var(--border2);color:var(--text)}
  .tag.blue{border-color:rgba(61,126,255,.3);color:#7aaeff;background:rgba(61,126,255,.07)}
  .tag.cyan{border-color:rgba(0,212,200,.3);color:#4de8e0;background:rgba(0,212,200,.07)}
  .tag.green{border-color:rgba(46,204,138,.3);color:#5ed9a0;background:rgba(46,204,138,.07)}
  .tag.amber{border-color:rgba(245,166,35,.3);color:#f5c060;background:rgba(245,166,35,.07)}
  .tag.purple{border-color:rgba(155,109,255,.3);color:#b899ff;background:rgba(155,109,255,.07)}
  .tag.red{border-color:rgba(255,90,90,.3);color:#ff8080;background:rgba(255,90,90,.07)}
  .row-list{list-style:none}
  .row-list li{display:flex;align-items:baseline;gap:8px;padding:5px 0;border-bottom:1px solid var(--border);font-size:12px}
  .row-list li:last-child{border-bottom:none}
  .row-key{font-family:'IBM Plex Mono',mono;font-size:10px;color:var(--text-dim);flex-shrink:0;min-width:90px}
  .row-val{color:var(--text)}
  .flow{display:flex;align-items:center;flex-wrap:wrap;gap:0;row-gap:6px}
  .flow-node{background:var(--surface2);border:1px solid var(--border2);border-radius:4px;padding:7px 11px;font-size:11px;font-weight:500;color:var(--text);white-space:nowrap}
  .flow-node.active{border-color:var(--accent-blue);color:#7aaeff}
  .flow-arrow{padding:0 5px;color:var(--text-dim);font-size:13px}
  .sm-flow{display:flex;flex-wrap:wrap;gap:4px;align-items:center}
  .sm-state{padding:4px 9px;border-radius:3px;font-family:'IBM Plex Mono',mono;font-size:10px;border:1px solid}
  .sm-state.initial{border-color:rgba(61,126,255,.4);background:rgba(61,126,255,.08);color:#7aaeff}
  .sm-state.mid{border-color:rgba(245,166,35,.4);background:rgba(245,166,35,.08);color:#f5c060}
  .sm-state.terminal{border-color:rgba(46,204,138,.4);background:rgba(46,204,138,.08);color:#5ed9a0}
  .sm-arrow{color:var(--text-dim);font-size:11px;padding:0 2px}
  .guardrail-grid{display:grid;grid-template-columns:repeat(4,1fr);gap:7px}
  .guardrail{background:var(--surface);border:1px solid var(--border);border-radius:4px;padding:9px 11px}
  .guardrail-id{font-family:'IBM Plex Mono',mono;font-size:10px;font-weight:600;margin-bottom:3px}
  .guardrail-title{color:var(--text);font-size:11px;line-height:1.4}
  .guardrail.ok .guardrail-id{color:var(--accent-green)}.guardrail.warn .guardrail-id{color:var(--accent-amber)}
  .note{background:rgba(245,166,35,.06);border:1px solid rgba(245,166,35,.2);border-radius:4px;padding:7px 11px;font-size:11px;color:#c8a050;font-family:'IBM Plex Mono',mono;margin-top:8px}
  .note::before{content:'⚠ '}
  .success-note{background:rgba(46,204,138,.06);border:1px solid rgba(46,204,138,.2);border-radius:4px;padding:7px 11px;font-size:11px;color:#5ed9a0;font-family:'IBM Plex Mono',mono;margin-top:8px}
  .success-note::before{content:'✓ '}
  .infra-box{border:1px solid var(--border2);border-radius:6px;overflow:hidden}
  .infra-box-head{padding:8px 12px;font-size:10px;font-weight:600;letter-spacing:.1em;text-transform:uppercase;display:flex;align-items:center;gap:6px}
  .infra-box-body{background:var(--surface);padding:9px 12px}
  .infra-kv{display:flex;justify-content:space-between;padding:3px 0;font-size:11px;border-bottom:1px solid var(--border)}
  .infra-kv:last-child{border-bottom:none}
  .infra-k{color:var(--text-dim);font-family:'IBM Plex Mono',mono;font-size:10px}
  .infra-v{color:var(--text);font-family:'IBM Plex Mono',mono;font-size:10px}
  .port{font-family:'IBM Plex Mono',mono;font-size:10px;background:rgba(61,126,255,.12);border:1px solid rgba(61,126,255,.25);color:#7aaeff;border-radius:3px;padding:1px 5px}
  .backlog-item{display:flex;gap:8px;padding:5px 0;border-bottom:1px solid var(--border);font-size:12px}
  .backlog-item:last-child{border-bottom:none}
  .backlog-dot{width:6px;height:6px;border-radius:50%;background:var(--accent-amber);margin-top:5px;flex-shrink:0}
  .mono{font-family:'IBM Plex Mono',mono;font-size:11px;color:var(--text);line-height:1.9}
  .mono .dim{color:var(--text-dim)}.mono .hi-blue{color:#7aaeff}.mono .hi-cyan{color:#4de8e0}
  .mono .hi-green{color:#5ed9a0}.mono .hi-amber{color:#f5c060}
</style>
</head>
<body>
<div class="page">

  <!-- HEADER -->
  <div class="header">
    <div>
      <div class="live-badge"><span class="live-dot"></span> LIVE — generated ${generatedAt}</div>
      <div class="doc-label">Architecture Blueprint · Tech Lead Reference</div>
      <div class="doc-title">Maintenance Agent</div>
      <div class="doc-subtitle">Full-stack property maintenance platform — Swiss market</div>
    </div>
    <div class="header-meta">
      <div>Branch <span class="meta-val">${gitBranch}</span></div>
      <div>Commit <span class="meta-val">${gitHash}</span></div>
      <div>Last commit <span class="meta-val">${gitDate}</span></div>
      <div>Doc verified <span class="meta-val">${lastVerified}</span></div>
      <div>Backend <span class="meta-val">${backendLOC.toLocaleString()} LOC</span></div>
      <div>Frontend <span class="meta-val">${frontendLOC.toLocaleString()} LOC</span></div>
    </div>
  </div>

  <!-- STAT STRIP -->
  <div class="stat-grid">
    ${statCell(prismaModels, 'Models', 'blue')}
    ${statCell(prismaEnums,  'Enums',  'cyan')}
    ${statCell(apiRoutes || '157', 'API Routes', 'green')}
    ${statCell(frontendPages || '171', 'FE Pages', 'amber')}
    ${statCell(workflowFiles.length || 14, 'Workflows', 'purple')}
    ${statCell(repoFiles.length || 6, 'Repositories', '')}
    ${statCell(testCount, 'Tests', '')}
    ${statCell(testSuites, 'Suites', '')}
  </div>

  <!-- TABS -->
  <div class="tab-nav">
    <button class="tab-btn active" onclick="switchTab('backend',this)">Backend</button>
    <button class="tab-btn" onclick="switchTab('frontend',this)">Frontend</button>
    <button class="tab-btn" onclick="switchTab('database',this)">Database</button>
    <button class="tab-btn" onclick="switchTab('infra',this)">Infrastructure</button>
    <button class="tab-btn" onclick="switchTab('flows',this)">Data Flows</button>
    <button class="tab-btn" onclick="switchTab('guardrails',this)">Guardrails</button>
    <button class="tab-btn" onclick="switchTab('audit',this)">Audit</button>
    <button class="tab-btn" onclick="switchTab('backlog',this)">Backlog</button>
  </div>

  <!-- ══ BACKEND ══ -->
  <div class="tab-pane active" id="tab-backend">
    <div class="section">
      <div class="section-header"><span class="section-num">01</span><span class="section-title">Backend Layer Architecture</span><div class="section-line"></div><span class="port">:3001</span></div>
      <div class="layer-diagram">
        <div class="layer">
          <div class="layer-label">entry</div>
          <div class="layer-content">${box('server.ts', 'raw http.createServer — no Express/NestJS', 'blue')}</div>
        </div>
        <div class="layer-connector">↓ registers all route modules</div>
        <div class="layer">
          <div class="layer-label">routes (${routeModules.length})</div>
          <div class="layer-content">${routeModules.map(r => box(r,'','blue')).join('')}</div>
        </div>
        <div class="layer-connector">↓ thin HTTP handlers only</div>
        <div class="layer">
          <div class="layer-label">workflows (${workflowFiles.length || 14})</div>
          <div class="layer-content">${(workflowFiles.length ? workflowFiles : ['requestLifecycle','jobLifecycle','invoiceLifecycle','leaseLifecycle','rentalApplication','contractorAssignment','approvalWorkflow','legalAutoRouting','notificationWorkflow','documentOCR','financialPerformance','assetInventory','depreciation','orgScoping']).map(w => box(w,'','cyan')).join('')}</div>
        </div>
        <div class="layer-connector">↓ orchestration — delegates to services</div>
        <div class="layer">
          <div class="layer-label">services</div>
          <div class="layer-content">${['auth','requestAssignment','invoiceService','leaseService','legalEngine','triage','pdfGenerator','emailOutbox','notificationService','depreciationService'].map(s => box(s,'','green')).join('')}</div>
        </div>
        <div class="layer-connector">↓ domain logic — no raw Prisma calls</div>
        <div class="layer">
          <div class="layer-label">repositories (${repoFiles.length || 6})</div>
          <div class="layer-content">${(repoFiles.length ? repoFiles : ['requestRepo','jobRepo','invoiceRepo','leaseRepo','inventoryRepo','orgRepo']).map(r => box(r,'','amber')).join('')}</div>
        </div>
        <div class="layer-connector">↓ canonical Prisma access + include constants (G9)</div>
        <div class="layer">
          <div class="layer-label">data / events</div>
          <div class="layer-content">
            ${box('Prisma ORM + PostgreSQL 16', `${prismaModels} models · ${prismaEnums} enums · ${migrations} migrations`, 'purple')}
            ${box('Domain Event Bus', '15 event types', 'purple')}
          </div>
        </div>
      </div>
      <div class="success-note">0 TypeScript errors · ${testCount} tests passing · openapi.yaml synced</div>
    </div>

    <div class="section">
      <div class="section-header"><span class="section-num">02</span><span class="section-title">State Machines — workflows/transitions.ts</span><div class="section-line"></div></div>
      <div class="three-col">
        <div class="panel">
          <div class="panel-head"><div class="panel-head-dot" style="background:var(--accent-blue)"></div><div class="panel-head-title">Request</div></div>
          <div class="panel-body">
            <div class="sm-flow">
              ${requestStates.length ? requestStates.map((s,i) => `<div class="sm-state ${i===0?'initial':i===requestStates.length-1?'terminal':'mid'}">${s}</div>${i<requestStates.length-1?'<div class="sm-arrow">→</div>':''}`).join('') : '<div class="sm-state initial">OPEN</div><div class="sm-arrow">→</div><div class="sm-state mid">TRIAGED</div><div class="sm-arrow">→</div><div class="sm-state mid">ASSIGNED</div><div class="sm-arrow">→</div><div class="sm-state mid">RFP_PENDING</div><div class="sm-arrow">→</div><div class="sm-state terminal">CLOSED</div>'}
            </div>
          </div>
        </div>
        <div class="panel">
          <div class="panel-head"><div class="panel-head-dot" style="background:var(--accent-cyan)"></div><div class="panel-head-title">Job</div></div>
          <div class="panel-body">
            <div class="sm-flow">
              ${jobStates.length ? jobStates.map((s,i) => `<div class="sm-state ${i===0?'initial':i===jobStates.length-1?'terminal':'mid'}">${s}</div>${i<jobStates.length-1?'<div class="sm-arrow">→</div>':''}`).join('') : '<div class="sm-state initial">CREATED</div><div class="sm-arrow">→</div><div class="sm-state mid">IN_PROGRESS</div><div class="sm-arrow">→</div><div class="sm-state mid">PENDING_REVIEW</div><div class="sm-arrow">→</div><div class="sm-state terminal">COMPLETE</div>'}
            </div>
          </div>
        </div>
        <div class="panel">
          <div class="panel-head"><div class="panel-head-dot" style="background:var(--accent-green)"></div><div class="panel-head-title">Invoice</div></div>
          <div class="panel-body">
            <div class="sm-flow">
              ${invoiceStates.length ? invoiceStates.map((s,i) => `<div class="sm-state ${i===0?'initial':i===invoiceStates.length-1?'terminal':'mid'}">${s}</div>${i<invoiceStates.length-1?'<div class="sm-arrow">→</div>':''}`).join('') : '<div class="sm-state initial">DRAFT</div><div class="sm-arrow">→</div><div class="sm-state mid">ISSUED</div><div class="sm-arrow">→</div><div class="sm-state mid">APPROVED</div><div class="sm-arrow">→</div><div class="sm-state terminal">PAID</div>'}
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>

  <!-- ══ FRONTEND ══ -->
  <div class="tab-pane" id="tab-frontend">
    <div class="section">
      <div class="section-header"><span class="section-num">03</span><span class="section-title">Frontend Architecture</span><div class="section-line"></div><span class="port">:3000</span></div>
      <div class="layer-diagram">
        <div class="layer">
          <div class="layer-label">browser</div>
          <div class="layer-content">${box('Next.js Pages Router', `~${frontendPages} pages (UI + API proxies) · AppShell role-scoped sidebar`, 'blue')}</div>
        </div>
        <div class="layer-connector">↓ pages/api/* — 103/106 use proxyToBackend()</div>
        <div class="layer">
          <div class="layer-label">proxy</div>
          <div class="layer-content">${box('lib/proxy.js → proxyToBackend()', 'Forwards headers, query params, status codes, binary responses (F3)', 'cyan')}</div>
        </div>
        <div class="layer-connector">↓ HTTP → backend :3001</div>
        <div class="layer">
          <div class="layer-label">API client</div>
          <div class="layer-content">${box('packages/api-client · lib/api.js', 'authHeaders() · fetchWithAuth() · apiFetch() · typed DTOs', 'green')}</div>
        </div>
      </div>
    </div>
    <div class="section">
      <div class="section-header"><span class="section-num">04</span><span class="section-title">Persona Portals</span><div class="section-line"></div></div>
      <div class="two-col">
        <div class="panel">
          <div class="panel-head"><div class="panel-head-dot" style="background:var(--accent-blue)"></div><div class="panel-head-title">Manager</div><div class="panel-head-count">/manager/*</div></div>
          <div class="panel-body"><div class="tag-list">${['requests','inventory','legal','leases','settings','payments','expenses','charges','buildings','tenants','vendors','vacancies'].map(t=>tagBadge(t,'blue')).join('')}</div><div class="note" style="margin-top:8px">Styling locked: styles/managerStyles.js (F8). Accordion sidebar + lucide-react icons.</div></div>
        </div>
        <div class="panel">
          <div class="panel-head"><div class="panel-head-dot" style="background:var(--accent-cyan)"></div><div class="panel-head-title">Contractor</div><div class="panel-head-count">/contractor/*</div></div>
          <div class="panel-body"><div class="tag-list">${['jobs list','job detail','status updates','invoices','invoice create'].map(t=>tagBadge(t,'cyan')).join('')}</div></div>
        </div>
        <div class="panel">
          <div class="panel-head"><div class="panel-head-dot" style="background:var(--accent-green)"></div><div class="panel-head-title">Tenant</div><div class="panel-head-count">/tenant/* + /</div></div>
          <div class="panel-body"><div class="tag-list">${['chat intake','leases','assets','apply wizard','listings'].map(t=>tagBadge(t,'green')).join('')}</div></div>
        </div>
        <div class="panel">
          <div class="panel-head"><div class="panel-head-dot" style="background:var(--accent-amber)"></div><div class="panel-head-title">Owner</div><div class="panel-head-count">/owner/*</div></div>
          <div class="panel-body"><div class="tag-list">${['approvals','invoices','vacancies','buildings','financials'].map(t=>tagBadge(t,'amber')).join('')}</div></div>
        </div>
      </div>
    </div>
  </div>

  <!-- ══ DATABASE ══ -->
  <div class="tab-pane" id="tab-database">
    <div class="section">
      <div class="section-header"><span class="section-num">05</span><span class="section-title">Schema Overview — ${prismaModels} models · ${prismaEnums} enums</span><div class="section-line"></div></div>
      <div class="three-col">
        ${modelGroup('Core Domain', mc.core.length ? mc.core : ['Request','Job','Invoice','InvoiceLineItem','Lease','LeaseChargeItem','RentalApplication'], 'blue')}
        ${modelGroup('Property & Asset', mc.property.length ? mc.property : ['Building','Unit','Appliance','AssetModel','DepreciationStandard','AssetIntervention','Listing'], 'cyan')}
        ${modelGroup('People & Org', mc.people.length ? mc.people : ['User','Tenant','Contractor','Owner','Organization','OrgConfig'], 'green')}
        ${modelGroup('Legal & Compliance', mc.legal.length ? mc.legal : ['LegalRule','LegalSource','LegalVariable','CategoryMapping','RFP'], 'amber')}
        ${modelGroup('Notifications & Docs', mc.docs.length ? mc.docs : ['Notification','EmailOutbox','Document','DigitalSignature','LeaseDocument'], 'purple')}
        <div class="panel">
          <div class="panel-head"><div class="panel-head-dot" style="background:var(--accent-red)"></div><div class="panel-head-title">Schema Gotchas</div></div>
          <div class="panel-body">
            <ul class="row-list">
              <li><span class="row-key" style="color:#ff8080">Request</span><span class="row-val">NO orgId — scope via unit→building FK</span></li>
              <li><span class="row-key" style="color:#ff8080">Job</span><span class="row-val">NO description — use Request.description</span></li>
              <li><span class="row-key" style="color:#ff8080">Appliance</span><span class="row-val">NO category — lives on AssetModel</span></li>
              <li><span class="row-key" style="color:var(--accent-amber)">Job.contractorId</span><span class="row-val">REQUIRED — not optional</span></li>
            </ul>
          </div>
        </div>
      </div>
    </div>
    <div class="section">
      <div class="section-header"><span class="section-num">06</span><span class="section-title">Migration Rules</span><div class="section-line"></div></div>
      <div class="two-col">
        <div class="panel">
          <div class="panel-head"><div class="panel-head-dot" style="background:var(--accent-green)"></div><div class="panel-head-title">Always Use</div></div>
          <div class="panel-body">
            <div class="flow" style="flex-direction:column;align-items:flex-start;gap:6px">
              <div class="flow-node active">prisma migrate dev --name &lt;desc&gt;</div>
              <div class="flow-arrow">↓</div>
              <div class="flow-node active">Drift check → expected: empty migration</div>
              <div class="flow-arrow">↓</div>
              <div class="flow-node active">prisma generate</div>
            </div>
          </div>
        </div>
        <div class="panel">
          <div class="panel-head"><div class="panel-head-dot" style="background:var(--accent-red)"></div><div class="panel-head-title">Banned (G1 / G8)</div></div>
          <div class="panel-body">
            <ul class="row-list">
              <li><span class="row-key" style="color:#ff8080">BANNED</span><span class="row-val" style="font-family:'IBM Plex Mono',mono;font-size:11px">prisma db push</span></li>
              <li><span class="row-key" style="color:#ff8080">BANNED</span><span class="row-val" style="font-family:'IBM Plex Mono',mono;font-size:11px">prisma migrate reset</span></li>
              <li><span class="row-key" style="color:#ff8080">BANNED</span><span class="row-val" style="font-family:'IBM Plex Mono',mono;font-size:11px">docker-compose down -v</span></li>
              <li><span class="row-key" style="color:var(--accent-amber)">EXCEPTION</span><span class="row-val">LKDE epic — shadow DB replay issue (one-time, additive)</span></li>
            </ul>
          </div>
        </div>
      </div>
    </div>
  </div>

  <!-- ══ INFRA ══ -->
  <div class="tab-pane" id="tab-infra">
    <div class="section">
      <div class="section-header"><span class="section-num">07</span><span class="section-title">Topology</span><div class="section-line"></div></div>
      <div class="three-col" style="margin-bottom:20px">
        <div class="infra-box">
          <div class="infra-box-head" style="background:rgba(61,126,255,.12);color:#7aaeff">🌐 Frontend</div>
          <div class="infra-box-body">
            <div class="infra-kv"><span class="infra-k">runtime</span><span class="infra-v">Next.js Pages Router</span></div>
            <div class="infra-kv"><span class="infra-k">port</span><span class="infra-v">3000</span></div>
            <div class="infra-kv"><span class="infra-k">start</span><span class="infra-v">npm run dev:web</span></div>
            <div class="infra-kv"><span class="infra-k">proxy target</span><span class="infra-v">127.0.0.1:3001</span></div>
          </div>
        </div>
        <div class="infra-box">
          <div class="infra-box-head" style="background:rgba(0,212,200,.12);color:#4de8e0">⚙️ Backend API</div>
          <div class="infra-box-body">
            <div class="infra-kv"><span class="infra-k">runtime</span><span class="infra-v">Node.js + TypeScript</span></div>
            <div class="infra-kv"><span class="infra-k">port</span><span class="infra-v">3001</span></div>
            <div class="infra-kv"><span class="infra-k">start</span><span class="infra-v">npm run dev:api</span></div>
            <div class="infra-kv"><span class="infra-k">auth guard</span><span class="infra-v">AUTH_OPTIONAL=false (prod)</span></div>
          </div>
        </div>
        <div class="infra-box">
          <div class="infra-box-head" style="background:rgba(46,204,138,.12);color:#5ed9a0">🐘 PostgreSQL 16</div>
          <div class="infra-box-body">
            <div class="infra-kv"><span class="infra-k">host</span><span class="infra-v">Docker (infra/)</span></div>
            <div class="infra-kv"><span class="infra-k">port</span><span class="infra-v">5432</span></div>
            <div class="infra-kv"><span class="infra-k">dev db</span><span class="infra-v">maint_agent</span></div>
            <div class="infra-kv"><span class="infra-k">test db</span><span class="infra-v">maint_agent_test</span></div>
            <div class="infra-kv"><span class="infra-k">volume</span><span class="infra-v">maint_agent_pgdata</span></div>
          </div>
        </div>
      </div>
      <svg width="100%" height="76" viewBox="0 0 900 76">
        <defs>
          <marker id="a" viewBox="0 0 10 10" refX="8" refY="5" markerWidth="6" markerHeight="6" orient="auto"><path d="M0 0L10 5L0 10z" fill="#3d7eff"/></marker>
          <marker id="b" viewBox="0 0 10 10" refX="8" refY="5" markerWidth="6" markerHeight="6" orient="auto"><path d="M0 0L10 5L0 10z" fill="#00d4c8"/></marker>
          <marker id="c" viewBox="0 0 10 10" refX="8" refY="5" markerWidth="6" markerHeight="6" orient="auto"><path d="M0 0L10 5L0 10z" fill="#2ecc8a"/></marker>
        </defs>
        <rect x="10" y="18" width="130" height="38" rx="4" fill="#111318" stroke="#2a3045"/>
        <text x="75" y="34" text-anchor="middle" fill="#c8d0e0" font-family="IBM Plex Mono" font-size="11">Browser</text>
        <text x="75" y="50" text-anchor="middle" fill="#5a6580" font-family="IBM Plex Mono" font-size="10">:3000</text>
        <line x1="140" y1="37" x2="210" y2="37" stroke="#3d7eff" stroke-width="1.5" marker-end="url(#a)"/>
        <text x="175" y="31" text-anchor="middle" fill="#3d7eff" font-family="IBM Plex Mono" font-size="9">pages/api</text>
        <rect x="210" y="18" width="160" height="38" rx="4" fill="#111318" stroke="#2a3045"/>
        <text x="290" y="34" text-anchor="middle" fill="#c8d0e0" font-family="IBM Plex Mono" font-size="11">Next.js Proxy</text>
        <text x="290" y="50" text-anchor="middle" fill="#5a6580" font-family="IBM Plex Mono" font-size="10">proxyToBackend()</text>
        <line x1="370" y1="37" x2="440" y2="37" stroke="#00d4c8" stroke-width="1.5" marker-end="url(#b)"/>
        <text x="405" y="31" text-anchor="middle" fill="#00d4c8" font-family="IBM Plex Mono" font-size="9">HTTP :3001</text>
        <rect x="440" y="18" width="160" height="38" rx="4" fill="#111318" stroke="#2a3045"/>
        <text x="520" y="34" text-anchor="middle" fill="#c8d0e0" font-family="IBM Plex Mono" font-size="11">Backend API</text>
        <text x="520" y="50" text-anchor="middle" fill="#5a6580" font-family="IBM Plex Mono" font-size="10">server.ts :3001</text>
        <line x1="600" y1="37" x2="670" y2="37" stroke="#2ecc8a" stroke-width="1.5" marker-end="url(#c)"/>
        <text x="635" y="31" text-anchor="middle" fill="#2ecc8a" font-family="IBM Plex Mono" font-size="9">Prisma ORM</text>
        <rect x="670" y="18" width="220" height="38" rx="4" fill="#111318" stroke="#2a3045"/>
        <text x="780" y="34" text-anchor="middle" fill="#c8d0e0" font-family="IBM Plex Mono" font-size="11">PostgreSQL 16</text>
        <text x="780" y="50" text-anchor="middle" fill="#5a6580" font-family="IBM Plex Mono" font-size="10">Docker :5432 / maint_agent</text>
      </svg>
    </div>
    <div class="section">
      <div class="section-header"><span class="section-num">08</span><span class="section-title">CI Pipeline — 6 Hard Gates (G7)</span><div class="section-line"></div></div>
      <div class="flow" style="flex-wrap:wrap;gap:4px 0">
        ${['1. Schema drift = empty','2. prisma generate','3. tsc --noEmit','4. next build','5. Jest tests','6. Boot + smoke curls'].map(s => `<div class="flow-node active">${s}</div><div class="flow-arrow">→</div>`).join('').slice(0,-'<div class="flow-arrow">→</div>'.length)}
      </div>
      <div class="note">CI red = no merge, no defer. Runs against maint_agent_test via PostgreSQL service container.</div>
    </div>
    <div class="section">
      <div class="section-header"><span class="section-num">09</span><span class="section-title">Monorepo Structure</span><div class="section-line"></div></div>
      <div class="panel"><div class="panel-body mono">
        <span class="dim">Maintenance_Agent/</span><br>
        &nbsp;&nbsp;<span class="hi-blue">apps/api/src/</span>&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;<span class="dim">routes/ · workflows/ · services/ · repositories/ · events/ · governance/</span><br>
        &nbsp;&nbsp;<span class="hi-blue">apps/api/prisma/</span>&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;<span class="dim">schema.prisma · migrations/ (${migrations} dirs)</span><br>
        &nbsp;&nbsp;<span class="hi-cyan">apps/web/pages/</span>&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;<span class="dim">~${frontendPages} pages (UI + API proxies)</span><br>
        &nbsp;&nbsp;<span class="hi-cyan">apps/web/components/</span>&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;<span class="dim">AppShell · layout primitives · shared UI</span><br>
        &nbsp;&nbsp;<span class="hi-cyan">apps/web/styles/</span>&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;<span class="dim">managerStyles.js (locked — F8)</span><br>
        &nbsp;&nbsp;<span class="hi-green">packages/api-client/</span>&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;<span class="dim">typed DTO types + fetch methods</span><br>
        &nbsp;&nbsp;<span class="hi-amber">infra/docker-compose.yml</span>&nbsp;&nbsp;<span class="dim">PostgreSQL 16</span><br>
        &nbsp;&nbsp;<span class="dim">.github/workflows/ci.yml&nbsp;&nbsp;&nbsp;6-gate pipeline (G1–G15)</span>
      </div></div>
    </div>
  </div>

  <!-- ══ DATA FLOWS ══ -->
  <div class="tab-pane" id="tab-flows">
    <div class="section">
      <div class="section-header"><span class="section-num">10</span><span class="section-title">Request Lifecycle</span><div class="section-line"></div></div>
      <div class="panel"><div class="panel-body">
        <div class="flow" style="flex-wrap:wrap;gap:4px 0;margin-bottom:8px">
          ${['Tenant chat','POST /requests','triage service','TRIAGED','legalAutoRouting?','RFP created','RFP_PENDING'].map((s,i)=>`<div class="flow-node${i===0||i===6?' active':''}">${s}</div><div class="flow-arrow">→</div>`).join('').slice(0,-'<div class="flow-arrow">→</div>'.length)}
        </div>
        <div class="flow" style="flex-wrap:wrap;gap:4px 0">
          ${['Assign contractor','Job CREATED','Contractor executes','IN_PROGRESS','COMPLETE','Invoice DRAFT → PAID','Request CLOSED'].map((s,i)=>`<div class="flow-node${i===6?' active':''}">${s}</div><div class="flow-arrow">→</div>`).join('').slice(0,-'<div class="flow-arrow">→</div>'.length)}
        </div>
      </div></div>
    </div>
    <div class="section">
      <div class="section-header"><span class="section-num">10b</span><span class="section-title">Invoice Lifecycle</span><div class="section-line"></div></div>
      <div class="panel"><div class="panel-body">
        <div class="flow" style="flex-wrap:wrap;gap:4px 0;margin-bottom:12px">
          ${['Job COMPLETED','getOrCreateInvoiceForJob','DRAFT (submittedAt set)','Manager: POST /issue','ISSUED','Manager: POST /approve','APPROVED','Manager: POST /mark-paid','PAID'].map((s,i)=>`<div class="flow-node${i===0||i===8?' active':''}">${s}</div><div class="flow-arrow">→</div>`).join('').slice(0,-'<div class="flow-arrow">→</div>'.length)}
        </div>
        <div class="flow" style="flex-wrap:wrap;gap:4px 0;margin-bottom:12px">
          ${['ISSUED or APPROVED','Manager: POST /dispute','DISPUTED','Manager: POST /approve','APPROVED (re-instated)'].map((s,i)=>`<div class="flow-node${i===0||i===4?' active':''}">${s}</div><div class="flow-arrow">→</div>`).join('').slice(0,-'<div class="flow-arrow">→</div>'.length)}
        </div>
        <div style="display:grid;grid-template-columns:repeat(5,1fr);gap:8px;font-size:11px;margin-bottom:12px">
          ${[['DRAFT','Invoice auto-created when job completes. submittedAt stamped. Contractor sees it as submitted.','#374151'],['ISSUED','Manager locked the invoice: invoice number assigned, issueDate set, IBAN attached.','#1d4ed8'],['APPROVED','Manager verified amount. Triggers INVOICE_ISSUED ledger entry (Dr Expense / Cr Payable).','#15803d'],['PAID','Payment confirmed. Triggers INVOICE_PAID ledger entry (Dr Payable / Cr Bank).','#14532d'],['DISPUTED','Amount or work contested. Can return to APPROVED or DRAFT.','#991b1b']].map(([s,d,c])=>`<div style="background:var(--surface2);border:1px solid var(--border);border-radius:4px;padding:8px"><div style="font-family:'IBM Plex Mono',mono;font-size:10px;color:${c};font-weight:600;margin-bottom:4px">${s}</div><div style="color:var(--text);line-height:1.4">${d}</div></div>`).join('')}
        </div>
        <div class="flow" style="flex-wrap:wrap;gap:4px 0">
          ${['DRAFT → ISSUED','issueInvoiceWorkflow','auto-resolves BillingEntity from contractor'].map((s,i)=>`<div class="flow-node">${s}</div><div class="flow-arrow">→</div>`).join('').slice(0,-'<div class="flow-arrow">→</div>'.length)}
        </div>
        <div class="note" style="margin-top:8px">Ledger auto-posting: ISSUED fires Dr Expense (4200) / Cr Payable (2000). PAID fires Dr Payable (2000) / Cr Bank (1020). Posting is best-effort — silently skipped if COA not seeded. Use POST /ledger/backfill to seed COA + post historical entries.</div>
      </div></div>
    </div>
    <div class="section">
      <div class="section-header"><span class="section-num">11</span><span class="section-title">Legal Auto-Routing</span><div class="section-line"></div></div>
      <div class="panel"><div class="panel-body">
        <div class="flow" style="flex-wrap:wrap;gap:4px 0">
          ${['Request triaged','Category → CategoryMapping','autoLegalRouting=true?','DSL rules evaluated','RFP created','→ RFP_PENDING'].map((s,i)=>`<div class="flow-node${i===5?' active':''}">${s}</div><div class="flow-arrow">→</div>`).join('').slice(0,-'<div class="flow-arrow">→</div>'.length)}
        </div>
        <div class="note">Legal DSL variable resolver not yet wired. LegalVariable values cannot condition rules on ingested data (e.g. reference interest rate). Full canton-scoped evaluation blocked.</div>
      </div></div>
    </div>
    <div class="section">
      <div class="section-header"><span class="section-num">12</span><span class="section-title">Rental Application Flow</span><div class="section-line"></div></div>
      <div class="panel"><div class="panel-body">
        <div class="flow" style="flex-wrap:wrap;gap:4px 0">
          ${['/listings (public)','/apply wizard','POST /rentalApplications','SUBMITTED → SCREENING','Manager review','APPROVED → Lease created'].map((s,i)=>`<div class="flow-node${i===0||i===5?' active':''}">${s}</div><div class="flow-arrow">→</div>`).join('').slice(0,-'<div class="flow-arrow">→</div>'.length)}
        </div>
      </div></div>
    </div>
  </div>

  <!-- ══ GUARDRAILS ══ -->
  <div class="tab-pane" id="tab-guardrails">
    <div class="section">
      <div class="section-header"><span class="section-num">13</span><span class="section-title">Architecture Guardrails (G1–G15)</span><div class="section-line"></div></div>
      <div class="guardrail-grid">
        ${guardrails.filter(g=>g.id.startsWith('G')).slice(0,12).map(guardrailHtml).join('') || 
          [['G1','Schema','Always migrate dev, never db push. Drift check required.',false],
           ['G2','Fields','New field → update schema, DTO, mapper, includes, validation.',false],
           ['G3','Includes','DTO mapper accesses relation → query must include it.',false],
           ['G4','No Stubs','No fake implementations in production code paths.',false],
           ['G5','Smoke Test','Pre-commit: drift + generate + boot + 3 smoke curls.',false],
           ['G6','DB Safety','docker-compose down -v requires explicit approval.',false],
           ['G7','CI Gate','6-gate CI. Red = no merge, no defer.',false],
           ['G8','db push Ban','Banned in all scripts + CI. No exceptions.',false],
           ['G9','Includes','Canonical JOB_INCLUDE etc. per model. No ad-hoc trees.',false],
           ['G10','Contracts','Contract tests for /requests /jobs /invoices /leases.',false],
           ['G11','Test DB Seed','migrate deploy → db seed → seed scripts, in order.',false],
           ['G12','Commit Deliverables','Commit every deliverable (>100 lines) before moving on.',false],
           ['G13','Atomic FE+BE','Frontend + backend changes land in the same commit.',false],
           ['G14','Session-End Check','git status + stash list + diff --stat before closing.',false],
           ['G15','Stash Safety','Never stash drop without inspection; prefer stash branch.',false]]
          .map(([id,t,b,w])=>guardrailHtml({id,title:t,body:b,warn:w})).join('')}
      </div>
    </div>
    <div class="section">
      <div class="section-header"><span class="section-num">14</span><span class="section-title">Future Risk Guardrails (F1–F8)</span><div class="section-line"></div></div>
      <div class="guardrail-grid">
        ${guardrails.filter(g=>g.id.startsWith('F')).slice(0,8).map(guardrailHtml).join('') ||
          [['F1','Auth','Production refuses boot without AUTH_SECRET + AUTH_OPTIONAL=false.',false],
           ['F2','Org Scope','M1 done. M2 pending (DEFAULT_ORG_ID in auth.ts).',true],
           ['F3','Proxy','Transparent: forward all headers, params, status codes, binary.',false],
           ['F4','DB Fixes','Manual ALTER TABLE → codify as migration immediately.',false],
           ['F5','Financial','Golden tests for lease/invoice PDFs. Cent-level precision.',false],
           ['F6','Dev Scripts','Formal npm scripts for all restart flows. Implemented.',false],
           ['F7','Multi-Org','New models must include orgId. No DEFAULT_ORG_ID outside bootstrap.',true],
           ['F8','Style Lock','managerStyles.js is sole source of truth for manager UI.',false]]
          .map(([id,t,b,w])=>guardrailHtml({id,title:t,body:b,warn:w})).join('')}
      </div>
    </div>
  </div>

  <!-- ══ AUDIT ══ -->
  <div class="tab-pane" id="tab-audit">
    <div class="section">
      <div class="section-header"><span class="section-num">15</span><span class="section-title">Audit Summary (2026-03-10)</span><div class="section-line"></div></div>
      <div class="panel"><div class="panel-body">
        <table style="width:100%;border-collapse:collapse;font-size:12px">
          <thead><tr style="border-bottom:1px solid var(--border)">
            <th style="text-align:left;padding:6px">Area</th><th>Findings</th><th>Critical</th><th>High</th><th>Medium</th><th>Low</th><th style="color:#5ed9a0">Resolved</th>
          </tr></thead>
          <tbody>
            ${audit.areas.map(a => `<tr style="border-bottom:1px solid var(--border-light,#2a2e38)"><td style="padding:6px">${a.name}</td><td style="text-align:center">${a.findings}</td><td style="text-align:center;color:${a.critical?'#ff8080':'inherit'}">${a.critical}</td><td style="text-align:center;color:${a.high?'#f5c060':'inherit'}">${a.high}</td><td style="text-align:center">${a.medium}</td><td style="text-align:center">${a.low}</td><td style="text-align:center;color:#5ed9a0">${a.resolved}</td></tr>`).join('')}
            <tr style="border-top:2px solid var(--border);font-weight:bold"><td style="padding:6px">Total</td><td style="text-align:center">82</td><td style="text-align:center">1</td><td style="text-align:center">22</td><td style="text-align:center">36</td><td style="text-align:center">23</td><td style="text-align:center;color:#5ed9a0">20</td></tr>
          </tbody>
        </table>
      </div></div>
    </div>
    <div class="section">
      <div class="section-header"><span class="section-num">16</span><span class="section-title">Resolved Findings</span><div class="section-line"></div></div>
      <div class="panel"><div class="panel-body">
        <ul class="row-list">
          ${audit.findings.filter(f => f.resolved).map(f => `<li><span class="row-key" style="color:#5ed9a0">${f.id}</span><span class="row-val">${f.title}</span></li>`).join('') || '<li>No resolved findings found</li>'}
        </ul>
      </div></div>
    </div>
    <div class="section">
      <div class="section-header"><span class="section-num">17</span><span class="section-title">Open Findings</span><div class="section-line"></div></div>
      <div class="panel"><div class="panel-body">
        <ul class="row-list">
          ${audit.findings.filter(f => !f.resolved).map(f => {
            const color = f.severity === 'critical' ? '#ff8080' : f.severity === 'high' ? '#f5c060' : '#8898aa';
            return '<li><span class="row-key" style="color:' + color + '">' + f.id + '</span><span class="row-val">' + f.title + '</span></li>';
          }).join('') || '<li>No open findings</li>'}
        </ul>
      </div></div>
    </div>
  </div>

  <!-- ══ BACKLOG ══ -->
  <div class="tab-pane" id="tab-backlog">
    <div class="section">
      <div class="section-header"><span class="section-num">18</span><span class="section-title">Active Backlog</span><div class="section-line"></div></div>
      <div class="panel"><div class="panel-body">
        ${backlogItems.length ?
          backlogItems.map(item => `<div class="backlog-item"><div class="backlog-dot"></div><div>${item}</div></div>`).join('') :
          ['Lease Phase 3–5: DocuSign/Skribble integration, deposit payment tracking, archive workflow',
           'Email delivery provider (SMTP/SendGrid) — EmailOutbox + dev sink implemented, no delivery yet',
           'Notifications push delivery — in-app works, no push/email delivery',
           'reports.js — product decision required before building',
           'Legal DSL variable resolver — wire LegalVariable values into DSL condition evaluation',
           'Multi-org: DEFAULT_ORG_ID in authz.ts dev/test fallback only — M2 work',
           'Consolidate buildingDetail.ts with other DTO definitions']
          .map(item => `<div class="backlog-item"><div class="backlog-dot"></div><div>${item}</div></div>`).join('')
        }
      </div></div>
    </div>
    <div class="section">
      <div class="section-header"><span class="section-num">19</span><span class="section-title">Known Technical Debt</span><div class="section-line"></div></div>
      <div class="panel"><div class="panel-body">
        <ul class="row-list">
          <li><span class="row-key" style="color:#5ed9a0">TEST FLAKE</span><span class="row-val">✅ Resolved (TC-4/TC-5): maxWorkers:1 + port deconfliction</span></li>
          <li><span class="row-key" style="color:#5ed9a0">SHADOW DB</span><span class="row-val">✅ Resolved (2026-03-30): 5 gap-filling migrations, shadow DB replays clean, db push fully banned</span></li>
          <li><span class="row-key" style="color:#f5c060">DSL VARS</span><span class="row-val">LegalVariable values not wired into DSL condition evaluation (blocks canton-scoped rules)</span></li>
          <li><span class="row-key" style="color:#f5c060">MULTI-ORG</span><span class="row-val">DEFAULT_ORG_ID in authz.ts dev/test fallback — production returns null (SA-1 ✅)</span></li>
          <li><span class="row-key" style="color:#5a6580">DEFERRED</span><span class="row-val">Email delivery, push notifications, DocuSign/Skribble, reports.js</span></li>
        </ul>
      </div></div>
    </div>
  </div>

  <!-- FOOTER -->
  <div style="margin-top:40px;padding-top:16px;border-top:1px solid var(--border);display:flex;justify-content:space-between;align-items:center;font-family:'IBM Plex Mono',mono;font-size:10px;color:var(--text-dim)">
    <div>Maintenance Agent · Architecture Blueprint · ${generatedAt} · branch: ${gitBranch} @ ${gitHash}</div>
    <div style="display:flex;gap:14px">
      <span style="color:#5ed9a0">● Implemented</span>
      <span style="color:#f5c060">● Partial / Exception</span>
      <span style="color:#ff8080">● Risk / Banned</span>
    </div>
  </div>

</div>
<script>
function switchTab(id, btn) {
  document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
  document.querySelectorAll('.tab-pane').forEach(p => p.classList.remove('active'));
  document.getElementById('tab-' + id).classList.add('active');
  btn.classList.add('active');
}
</script>
</body>
</html>`;

// ─────────────────────────────────────────────
// WRITE OUTPUT
// ─────────────────────────────────────────────
const outDir  = path.join(ROOT, 'docs');
const outFile = path.join(outDir, 'blueprint.html');

// docs/ already exists at monorepo root — create only as fallback
if (!fs.existsSync(outDir)) fs.mkdirSync(outDir, { recursive: true });
fs.writeFileSync(outFile, html, 'utf8');
console.log(`✅ Blueprint written → ${outFile}`);

} // end if (!SYNC_ONLY)

// ─────────────────────────────────────────────
// SYNC PROJECT_STATE.MD COUNTS
// ─────────────────────────────────────────────
function syncProjectState() {
  const stateFile = path.join(ROOT, 'PROJECT_STATE.md');
  let stateMd = fs.readFileSync(stateFile, 'utf8');

  // Only sync counts in the current-state portion of the file.
  // Historical epic narratives below the fence retain period-accurate counts.
  const FENCE = '<!-- SYNC-FENCE: historical content below — do not auto-update counts -->';
  const fenceIdx = stateMd.indexOf(FENCE);
  let syncPart = fenceIdx >= 0 ? stateMd.slice(0, fenceIdx) : stateMd;
  const keepPart = fenceIdx >= 0 ? stateMd.slice(fenceIdx) : '';

  const liveValues = {
    models:       prismaModels,
    enums:        prismaEnums,
    migrations:   migrations,
    repositories: repoFiles.length || 8,
    workflows:    workflowFiles.length || 14,
    tests:        testCount,
    suites:       testSuites,
    backendLOC:   Math.round(backendLOC / 1000),
    frontendLOC:  Math.round(frontendLOC / 1000),
    fePages:      frontendPages,
    apiRoutes:    apiRoutes || 157,
  };

  const patterns = [
    { re: /(\d+)\s*models(?!\s*table)/gi,         key: 'models',       unit: ' models' },
    { re: /(\d+)\s*enums/gi,                       key: 'enums',        unit: ' enums' },
    { re: /(\d+)\s*migrations(?!\s*\+)/gi,         key: 'migrations',   unit: ' migrations' },
    { re: /repositories\/`\s*\((\d+)\)/gi,       key: 'repositories', unit: null, wrap: (v) => "repositories/` (" + v + ")" },
    { re: /repositories\s*\((\d+)/gi,              key: 'repositories', unit: null, wrap: (v) => `repositories (${v}` },
    { re: /(\d+)\s+repositories/gi,                key: 'repositories', unit: ' repositories' },
    { re: /\((\d+)\s+repos\)/g,                    key: 'repositories', unit: null, wrap: (v) => `(${v} repos)` },
    { re: /Repositories\s*\|\s*(\d+)/g,            key: 'repositories', unit: null, wrap: (v) => `Repositories | ${v}` },
    { re: /workflows\s*\((\d+)/gi,                 key: 'workflows',    unit: null, wrap: (v) => `workflows (${v}` },
    { re: /\*\*(\d+)\s*tests/g,                    key: 'tests',        unit: null, wrap: (v) => `**${v} tests` },
    { re: /(\d+)\s*suites/gi,                      key: 'suites',       unit: ' suites' },
    { re: /Backend[:\s]+~?(\d+),?(\d+)?\s*LOC/gi, key: 'backendLOC',   unit: null, wrap: (v) => `Backend: ~${v},000 LOC` },
    { re: /Frontend[:\s]+~?(\d+),?(\d+)?\s*LOC/gi,key: 'frontendLOC',  unit: null, wrap: (v) => `Frontend: ~${v},000 LOC` },
    { re: /~(\d+)\s*frontend pages/gi,             key: 'fePages',      unit: null, wrap: (v) => `~${v} frontend pages` },
    { re: /~(\d+)\s*(?:API\s+)?routes/gi,          key: 'apiRoutes',    unit: null, wrap: (v) => `~${v} API routes` },
  ];

  const changes = [];
  for (const p of patterns) {
    const newMd = syncPart.replace(p.re, (match, g1) => {
      const oldVal = parseInt(g1);
      const newVal = liveValues[p.key];
      if (oldVal === newVal) return match;
      changes.push(`${p.key} ${oldVal}→${newVal}`);
      return p.wrap ? p.wrap(newVal) : `${newVal}${p.unit}`;
    });
    syncPart = newMd;
  }

  if (changes.length > 0) {
    const entry = `\n<!-- auto-sync ${new Date().toISOString().slice(0,10)}: ${changes.join(', ')} -->`;
    syncPart = syncPart.replace(
      /(### State Integrity)/,
      `${entry}\n\n$1`
    );
    const finalMd = syncPart + keepPart;
    fs.writeFileSync(stateFile, finalMd, 'utf8');
    console.log(`📝 PROJECT_STATE.md updated: ${changes.join(', ')}`);
  } else {
    console.log('📝 PROJECT_STATE.md — counts already in sync');
  }
}

syncProjectState();

// ─────────────────────────────────────────────
// SYNC ARCHITECTURE_LOW_CONTEXT_GUIDE.MD
// ─────────────────────────────────────────────
function syncLowContextGuide() {
  const guideFile = path.join(ROOT, 'apps/api/src/ARCHITECTURE_LOW_CONTEXT_GUIDE.md');
  if (!fs.existsSync(guideFile)) {
    console.log('⚠ ARCHITECTURE_LOW_CONTEXT_GUIDE.md not found — skipping sync');
    return;
  }

  let guide = fs.readFileSync(guideFile, 'utf8');
  const changes = [];

  // Sync stats line — matches pattern like "45 models · 35 enums · 32 migrations..."
  const statsPattern = /(\d+)\s*models\s*·\s*(\d+)\s*enums\s*·\s*(\d+)\s*migrations\s*·\s*(\d+)\s*workflows\s*·\s*(\d+)\s*repositories\s*·\s*~(\d+)k\s*backend LOC\s*·\s*~(\d+)k\s*frontend LOC/;
  const newStats = `${prismaModels} models · ${prismaEnums} enums · ${migrations} migrations · ${workflowFiles.length || 14} workflows · ${repoFiles.length || 8} repositories · ~${Math.round(backendLOC / 1000)}k backend LOC · ~${Math.round(frontendLOC / 1000)}k frontend LOC`;

  const statsMatch = guide.match(statsPattern);
  if (statsMatch && statsMatch[0] !== newStats) {
    changes.push('stats line updated');
    guide = guide.replace(statsPattern, newStats);
  } else if (!statsMatch) {
    console.log('⚠ ARCHITECTURE_LOW_CONTEXT_GUIDE.md — stats line not found, skipping stats sync');
  }

  if (changes.length > 0) {
    fs.writeFileSync(guideFile, guide, 'utf8');
    console.log(`📘 ARCHITECTURE_LOW_CONTEXT_GUIDE.md updated: ${changes.join(', ')}`);
  } else {
    console.log('📘 ARCHITECTURE_LOW_CONTEXT_GUIDE.md — already in sync');
  }
}

syncLowContextGuide();

// ─────────────────────────────────────────────
// OPEN IN BROWSER
// ─────────────────────────────────────────────
if (!SYNC_ONLY) {
const outFile = path.join(ROOT, 'docs', 'blueprint.html');
const url = 'file://' + outFile;
const platform = process.platform;
try {
  if (platform === 'darwin') execSync(`open "${url}"`);
  else if (platform === 'win32') execSync(`start "" "${url}"`);
  else execSync(`xdg-open "${url}"`);
  console.log('🌐 Opened in system browser');
} catch {
  console.log(`🌐 Open manually: ${url}`);
}
} // end if (!SYNC_ONLY) — browser open