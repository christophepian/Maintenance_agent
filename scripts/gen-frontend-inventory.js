#!/usr/bin/env node
/**
 * Frontend inventory generator.
 *
 * Regenerates docs/FRONTEND_INVENTORY.md from the filesystem so the page list
 * and counts can never silently go stale (the prior hand-maintained tables were
 * last accurate 2026-05-04 — see CRITICAL_AUDIT_2026-06-23). Run on demand:
 *
 *   npm run inventory
 *
 * Derives, per UI page: persona (first path segment), whether it renders an
 * EmptyState, and whether it has a loading state. Counts API proxy files
 * separately. Pass a date via INVENTORY_DATE=YYYY-MM-DD for reproducible output
 * (defaults to today).
 */
const fs = require("fs");
const path = require("path");

const ROOT = path.join(__dirname, "..");
const PAGES = path.join(ROOT, "apps/web/pages");
const OUT = path.join(ROOT, "docs/FRONTEND_INVENTORY.md");
const DATE = process.env.INVENTORY_DATE || new Date().toISOString().slice(0, 10);

const SKIP = /^(_app|_document|_error|404|500)\.|^_template/;

function walk(dir, base = "") {
  const out = [];
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const rel = path.join(base, entry.name);
    if (entry.isDirectory()) {
      out.push(...walk(path.join(dir, entry.name), rel));
    } else if (/\.(js|jsx)$/.test(entry.name)) {
      out.push(rel);
    }
  }
  return out;
}

const all = walk(PAGES);
const apiProxies = all.filter((p) => p.startsWith("api" + path.sep));
const uiPages = all
  .filter((p) => !p.startsWith("api" + path.sep))
  .filter((p) => !SKIP.test(path.basename(p)));

function routePath(rel) {
  return "/" + rel.replace(/\\/g, "/").replace(/\.(js|jsx)$/, "").replace(/\/index$/, "");
}
function persona(rel) {
  const seg = rel.replace(/\\/g, "/").split("/")[0];
  return seg.endsWith(".js") || seg.endsWith(".jsx") ? "(root)" : seg;
}

const rows = uiPages.map((rel) => {
  const src = fs.readFileSync(path.join(PAGES, rel), "utf8");
  const hasEmpty = /EmptyState|empty-state|No .* (yet|found)/.test(src);
  const hasLoading = /ResourceShell|useDetailResource|isLoading|loading|Skeleton/.test(src);
  return { route: routePath(rel) || "/", persona: persona(rel), hasEmpty, hasLoading };
});

const byPersona = {};
for (const r of rows) (byPersona[r.persona] ||= []).push(r);
const personas = Object.keys(byPersona).sort((a, b) => byPersona[b].length - byPersona[a].length);

let md = `# Frontend Page Inventory

> **Generated** ${DATE} by \`scripts/gen-frontend-inventory.js\` — do not hand-edit.
> Re-run with \`npm run inventory\` after adding/removing pages.

---

## Summary

| Persona / area | UI pages |
|---|---|
`;
for (const p of personas) md += `| ${p} | ${byPersona[p].length} |\n`;
md += `\n**Totals:** ${uiPages.length} UI pages · ${apiProxies.length} API proxy files (\`apps/web/pages/api/\`).\n\n`;
md += `Empty-state / loading-state columns are heuristic (token/component grep), useful as a coverage signal, not a guarantee.\n\n---\n\n## Full Page List\n`;

for (const p of personas) {
  md += `\n### ${p} (${byPersona[p].length})\n\n`;
  md += `| Route | Empty state | Loading state |\n|---|---|---|\n`;
  for (const r of byPersona[p].sort((a, b) => a.route.localeCompare(b.route))) {
    md += `| ${r.route} | ${r.hasEmpty ? "yes" : "—"} | ${r.hasLoading ? "yes" : "—"} |\n`;
  }
}

fs.writeFileSync(OUT, md, "utf8");
console.log(`📄 FRONTEND_INVENTORY.md regenerated: ${uiPages.length} UI pages, ${apiProxies.length} proxies, ${personas.length} areas (${DATE}).`);
