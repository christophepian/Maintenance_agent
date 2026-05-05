#!/usr/bin/env node
/**
 * Adds `withTranslations` to all UI pages that don't yet have
 * getStaticProps / getServerSideProps.
 *
 * Run from monorepo root:
 *   node scripts/add-translations.js
 */

const fs = require("fs");
const path = require("path");
const { execSync } = require("child_process");

const PAGES_DIR = path.join(__dirname, "../apps/web/pages");

// Determine which namespaces to load based on page path
function namespacesFor(rel) {
  if (rel.startsWith("manager/") || rel.startsWith("admin-inventory/")) {
    return ["common", "manager"];
  }
  if (rel.startsWith("owner/")) {
    return ["common", "owner"];
  }
  if (rel.startsWith("contractor/")) {
    return ["common", "contractor"];
  }
  if (rel.startsWith("tenant") ) {
    return ["common", "tenant"];
  }
  return ["common"];
}

// Recursively collect all .js UI pages
function collectPages(dir, base = "") {
  const entries = fs.readdirSync(dir, { withFileTypes: true });
  const results = [];
  for (const e of entries) {
    const rel = base ? `${base}/${e.name}` : e.name;
    const full = path.join(dir, e.name);
    if (e.isDirectory()) {
      if (e.name === "api") continue; // skip API routes
      results.push(...collectPages(full, rel));
    } else if (e.name.endsWith(".js") && !e.name.startsWith("_")) {
      results.push({ rel, full });
    }
  }
  return results;
}

const pages = collectPages(PAGES_DIR);
let patched = 0;
let skipped = 0;

for (const { rel, full } of pages) {
  const src = fs.readFileSync(full, "utf8");

  // Skip if already has getStaticProps / getServerSideProps
  if (/export\s+(async\s+)?function\s+(getStaticProps|getServerSideProps)|export\s+const\s+(getStaticProps|getServerSideProps)/.test(src)) {
    skipped++;
    continue;
  }

  // Skip redirect-only / no-render pages
  if (src.trim().length < 50) {
    skipped++;
    continue;
  }

  const ns = namespacesFor(rel);
  const nsStr = JSON.stringify(ns);

  // Add import at top (after any existing imports block)
  const importLine = `import { withTranslations } from "../../lib/i18n";`;

  // Calculate correct relative path depth
  const depth = rel.split("/").length - 1; // 0 = root, 1 = one deep, etc.
  const prefix = "../".repeat(depth + 1); // +1 because pages/ itself is one level under web/
  const importLineResolved = `import { withTranslations } from "${prefix}lib/i18n";`;

  // Check if already imported
  if (src.includes("withTranslations") || src.includes("composeWithTranslations")) {
    skipped++;
    continue;
  }

  const exportLine = `\nexport const getStaticProps = withTranslations(${nsStr});\n`;

  // Insert import after last import statement
  let newSrc;
  const importBlockEnd = (() => {
    const lines = src.split("\n");
    let lastImport = -1;
    for (let i = 0; i < lines.length; i++) {
      if (/^import\s/.test(lines[i])) lastImport = i;
    }
    return lastImport;
  })();

  if (importBlockEnd === -1) {
    newSrc = importLineResolved + "\n" + src + exportLine;
  } else {
    const lines = src.split("\n");
    lines.splice(importBlockEnd + 1, 0, importLineResolved);
    newSrc = lines.join("\n") + exportLine;
  }

  fs.writeFileSync(full, newSrc, "utf8");
  patched++;
  console.log(`✓ ${rel}  [${ns.join(", ")}]`);
}

console.log(`\nDone: ${patched} patched, ${skipped} skipped.`);
