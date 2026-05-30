#!/usr/bin/env node
/**
 * migrate-tokens.js
 *
 * Replaces hardcoded Tailwind color utilities with semantic design token
 * equivalents across all JSX/JS files in apps/web/pages/ and apps/web/components/.
 *
 * Usage:
 *   node scripts/migrate-tokens.js --dry   # print diffs, no writes
 *   node scripts/migrate-tokens.js         # apply changes
 */

const fs   = require('fs');
const path = require('path');

const DRY_RUN = process.argv.includes('--dry');

// ── Mapping: hardcoded class → semantic token class ──────────────────────────
// Order matters: more specific patterns first to avoid partial matches.
// bg-slate-200 → bg-surface-border for hover states, badges, dividers, and toggle tracks.
// Progress bar track instances are fixed manually to bg-track after the codemod runs.
const REPLACEMENTS = [
  // Text hierarchy
  ['text-slate-900', 'text-foreground'],
  ['text-slate-800', 'text-foreground'],
  ['text-slate-700', 'text-muted-dark'],
  ['text-slate-600', 'text-muted-text'],
  ['text-slate-500', 'text-muted'],
  ['text-slate-400', 'text-foreground-dim'],
  ['text-slate-300', 'text-foreground-dim'],
  ['text-slate-200', 'text-foreground-dim'],

  // Backgrounds
  ['bg-white',      'bg-surface'],
  ['bg-slate-50',   'bg-surface-subtle'],
  ['bg-slate-100',  'bg-surface-hover'],
  ['bg-slate-200',  'bg-surface-border'],
  ['bg-slate-300',  'bg-muted-ring'],

  // Borders
  ['border-slate-200', 'border-surface-border'],
  ['border-slate-300', 'border-muted-ring'],
  ['border-slate-100', 'border-surface-divider'],
];

// Build a single regex that matches any optional variant prefix chain + one of
// our target classes, with an optional opacity modifier (/NN).
//
// Variant prefix: zero or more "<word>:" segments (e.g. "hover:", "sm:hover:")
// Opacity suffix: optional "/<digits>" (e.g. "/80")
// Word boundary after: must be followed by whitespace, quote, backtick, or end
const escapeRegex = (s) => s.replace(/[-[\]/{}()*+?.\\^$|]/g, '\\$&');

const targets  = REPLACEMENTS.map(([from]) => escapeRegex(from));
const variantPrefix = '(?:(?:[a-zA-Z][a-zA-Z0-9-]*):)*';
const boundary = '(?=[\\s"\'`{}\\]\\[),;]|$)';

// Group 1: variant prefix chain (e.g. "hover:" or "sm:hover:")
// Group 2: the target class name
// Group 3: optional opacity modifier (e.g. "/80")
const MASTER_RE = new RegExp(
  `(${variantPrefix})(${targets.join('|')})(\\/[0-9]+)?${boundary}`,
  'g'
);

const CLASS_MAP = Object.fromEntries(REPLACEMENTS);

function migrateContent(src) {
  // Process line-by-line so that lines marked `/* no-token: */` are never touched.
  return src.split('\n').map(line => {
    if (line.includes('/* no-token:')) return line;
    return line.replace(MASTER_RE, (match, prefix, cls, opacity) => {
      const replacement = CLASS_MAP[cls];
      if (!replacement) return match; // shouldn't happen
      return `${prefix}${replacement}${opacity || ''}`;
    });
  }).join('\n');
}

// ── File discovery ────────────────────────────────────────────────────────────
const ROOT = path.join(__dirname, '..', 'apps', 'web');
const DIRS = [
  path.join(ROOT, 'pages'),
  path.join(ROOT, 'components'),
];

function walkDir(dir, files = []) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      walkDir(full, files);
    } else if (/\.(js|jsx|ts|tsx)$/.test(entry.name)) {
      files.push(full);
    }
  }
  return files;
}

const allFiles = DIRS.flatMap(d => (fs.existsSync(d) ? walkDir(d) : []));

// ── Process ───────────────────────────────────────────────────────────────────
let changedCount = 0;
let totalReplacements = 0;

for (const file of allFiles) {
  const original = fs.readFileSync(file, 'utf8');
  const migrated = migrateContent(original);

  if (migrated === original) continue;

  // Count replacements in this file
  let count = 0;
  const re = new RegExp(MASTER_RE.source, MASTER_RE.flags);
  let m;
  while ((m = re.exec(original)) !== null) count++;

  changedCount++;
  totalReplacements += count;
  const rel = path.relative(process.cwd(), file);

  if (DRY_RUN) {
    console.log(`\n── ${rel} (${count} replacement${count !== 1 ? 's' : ''}) ──`);
    // Show a simple diff: lines that changed
    const origLines = original.split('\n');
    const newLines  = migrated.split('\n');
    for (let i = 0; i < origLines.length; i++) {
      if (origLines[i] !== newLines[i]) {
        console.log(`  L${i + 1} - ${origLines[i].trim()}`);
        console.log(`  L${i + 1} + ${newLines[i].trim()}`);
      }
    }
  } else {
    fs.writeFileSync(file, migrated, 'utf8');
    console.log(`  ✓  ${rel} (${count})`);
  }
}

const mode = DRY_RUN ? '[DRY RUN]' : '[APPLIED]';
console.log(`\n${mode} ${changedCount} files · ${totalReplacements} replacements`);
