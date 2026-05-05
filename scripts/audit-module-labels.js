#!/usr/bin/env node
/**
 * Audit module-level arrays with hardcoded label: "..." strings.
 * These are outside components so can't use t() directly.
 * Pattern: const TABS/COLS/STEPS = [{ key: ..., label: "..." }]
 * defined before `export default function`
 */
const fs = require('fs');
const path = require('path');

const pagesDir = path.join(__dirname, '../apps/web/pages');

function walk(dir) {
  const results = [];
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) results.push(...walk(full));
    else if (entry.name.endsWith('.js') && !entry.name.startsWith('_')) results.push(full);
  }
  return results;
}

const findings = [];

for (const file of walk(pagesDir)) {
  const content = fs.readFileSync(file, 'utf8');
  const lines = content.split('\n');
  
  // Find export default position
  const exportLine = lines.findIndex(l => l.match(/^export default function/));
  if (exportLine === -1) continue;
  
  // Look for label: "..." in module scope (before export default)
  const moduleLines = lines.slice(0, exportLine);
  const labelMatches = [];
  moduleLines.forEach((line, i) => {
    const m = line.match(/label:\s*["']([A-Z][^"']{1,40})["']/);
    if (m && !line.trim().startsWith('//')) {
      labelMatches.push({ line: i + 1, text: m[1] });
    }
  });
  
  if (labelMatches.length > 0) {
    const rel = path.relative(path.join(__dirname, '..'), file);
    findings.push({ file: rel, labels: labelMatches });
  }
}

console.log(`Found ${findings.length} files with module-level hardcoded labels:\n`);
for (const f of findings) {
  console.log(`  ${f.file}`);
  for (const l of f.labels) {
    console.log(`    L${l.line}: "${l.text}"`);
  }
}
