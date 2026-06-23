#!/usr/bin/env bash
# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
# Code-quality report (added 2026-06-22).
#
# Produces a digest of quality signals: ESLint warnings, `any` usage, raw
# `console.*` calls, TODO/FIXME markers, and oversized files. Run manually
# (`npm run quality:report`) or weekly by the code-quality routine, which
# diffs the digest against the committed baseline and alerts on regression.
#
# Exit code: 0 by default (report mode — used by the weekly alert routine).
# With `--strict` (or QUALITY_STRICT=1) it becomes a GATE: exit 1 if any metric
# regressed above docs/quality-baseline.json. CI runs it in strict mode so debt
# can't grow silently; the weekly routine runs it report-only.
# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
set -uo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

STRICT=0
[ "${QUALITY_STRICT:-0}" = "1" ] && STRICT=1
for arg in "$@"; do [ "$arg" = "--strict" ] && STRICT=1; done

API_SRC="apps/api/src"
WEB_SRC="apps/web"

# ── ESLint warning/error counts (report-only config) ──
ESLINT_OUT="$(mktemp)"
npx eslint . --format json > "$ESLINT_OUT" 2>/dev/null
ESLINT_WARN=$(node -e "const r=JSON.parse(require('fs').readFileSync(process.argv[1],'utf8')||'[]');console.log(r.reduce((a,f)=>a+f.warningCount,0))" "$ESLINT_OUT" 2>/dev/null || echo '?')
ESLINT_ERR=$(node -e "const r=JSON.parse(require('fs').readFileSync(process.argv[1],'utf8')||'[]');console.log(r.reduce((a,f)=>a+f.errorCount,0))" "$ESLINT_OUT" 2>/dev/null || echo '?')
rm -f "$ESLINT_OUT"

# ── Raw metrics (production code only, tests excluded) ──
# Note: `grep -c` exits non-zero on zero matches but still prints "0", so we do
# NOT chain `|| echo 0` (that would append a second count). `| tail -1` guards
# the piped greps where the first stage may emit nothing.
ANY_COUNT=$(grep -rEn ': any|<any>|as any' "$API_SRC" --include='*.ts' 2>/dev/null | grep -vc '\.test\.' | tail -1)
CONSOLE_COUNT=$(grep -rEn 'console\.(log|error|warn|info|debug)' "$API_SRC" --include='*.ts' 2>/dev/null | grep -vc '\.test' | tail -1)
TODO_COUNT=$(grep -rEn 'TODO|FIXME|HACK|XXX' "$API_SRC" "$WEB_SRC/pages" "$WEB_SRC/components" 2>/dev/null | grep -vc '\.test\.' | tail -1)
SUPPRESS_COUNT=$(grep -rEn '@ts-ignore|@ts-nocheck|eslint-disable' "$API_SRC" "$WEB_SRC/pages" "$WEB_SRC/components" "$WEB_SRC/lib" 2>/dev/null | grep -vc '\.test\.' | tail -1)
BIG_FILES=$(find "$API_SRC" -name '*.ts' ! -name '*.test.ts' -exec wc -l {} + 2>/dev/null | awk '$1>800{c++} END{print c+0}')

# ── TypeScript errors ──
# The Prisma client (node_modules/.prisma/client) is gitignored, so a fresh
# clone has none — tsc would then report hundreds of phantom "no exported
# member" errors for any schema type. Generate it first so the tsc count
# reflects real type errors, not a stale/missing client. (CI does the same via
# its "G7: Prisma generate" step.)
( cd apps/api && npx prisma generate ) >/dev/null 2>&1 || true
TSC_ERRORS=$(npx tsc --noEmit --project apps/api/tsconfig.json 2>&1 | grep -c 'error TS')

cat <<EOF
═══════════════════════════════════════════════
 CODE-QUALITY REPORT
═══════════════════════════════════════════════
 ESLint errors          : ${ESLINT_ERR}
 ESLint warnings        : ${ESLINT_WARN}
 TypeScript errors      : ${TSC_ERRORS}
 \`any\` usages (backend)  : ${ANY_COUNT}
 raw console.* (backend) : ${CONSOLE_COUNT}
 TODO/FIXME/HACK markers : ${TODO_COUNT}
 ts/eslint suppressions  : ${SUPPRESS_COUNT}
 files > 800 LOC         : ${BIG_FILES}
═══════════════════════════════════════════════
EOF

# Emit a machine-readable line for the routine to diff against baseline.
echo "QUALITY_METRICS eslint_err=${ESLINT_ERR} eslint_warn=${ESLINT_WARN} tsc=${TSC_ERRORS} any=${ANY_COUNT} console=${CONSOLE_COUNT} todo=${TODO_COUNT} suppress=${SUPPRESS_COUNT} bigfiles=${BIG_FILES}"

# ── Regression check against committed baseline ──────────────────
BASELINE="$ROOT/docs/quality-baseline.json"
if [ -f "$BASELINE" ]; then
  E="$ESLINT_ERR" W="$ESLINT_WARN" T="$TSC_ERRORS" A="$ANY_COUNT" \
  C="$CONSOLE_COUNT" D="$TODO_COUNT" S="$SUPPRESS_COUNT" B="$BIG_FILES" \
  node -e '
    const fs=require("fs");
    const b=JSON.parse(fs.readFileSync(process.argv[1],"utf8")).metrics;
    const cur={eslint_err:+process.env.E,eslint_warn:+process.env.W,tsc:+process.env.T,any:+process.env.A,console:+process.env.C,todo:+process.env.D,suppress:+process.env.S,bigfiles:+process.env.B};
    const regressions=[];
    for(const k of Object.keys(b)){ if(Number.isFinite(cur[k]) && cur[k]>b[k]) regressions.push(`${k}: ${b[k]} -> ${cur[k]} (+${cur[k]-b[k]})`); }
    if(regressions.length){
      console.log("\nQUALITY_ALERT REGRESSION DETECTED:");
      regressions.forEach(r=>console.log("  ⬆ "+r));
      process.exit(2);
    } else {
      console.log("\nQUALITY_OK no regressions vs baseline ("+new Date().toISOString().slice(0,10)+")");
    }
  ' "$BASELINE"
  RC=$?
  if [ "$RC" -eq 2 ] && [ "$STRICT" -eq 1 ]; then
    echo ""
    echo "QUALITY GATE FAILED (strict mode): a metric regressed above docs/quality-baseline.json."
    echo "Burn the debt back down, or update the baseline deliberately in the same commit."
    exit 1
  fi
fi
