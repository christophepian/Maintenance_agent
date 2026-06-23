#!/usr/bin/env bash
# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
# Guardrail Enforcement Script
# Runs locally (pre-commit) and in CI. Checks G8, F-UI4, F-UI4a, G9, G20, G3,
# F-UI9, G18, G16, G17, G19.
# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
ERRORS=0
WARNINGS=0

red()    { printf "\033[31m%s\033[0m\n" "$*"; }
yellow() { printf "\033[33m%s\033[0m\n" "$*"; }
green()  { printf "\033[32m%s\033[0m\n" "$*"; }

fail() { red "  ❌ ERROR: $*"; ERRORS=$((ERRORS + 1)); }
warn() { yellow "  ⚠️  WARNING: $*"; WARNINGS=$((WARNINGS + 1)); }
pass() { green "  ✅ $*"; }

# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
# Known false positives — add entries here with a one-line justification.
# Each entry is a basename checked with `[[ ... == ... ]]` in the relevant
# rule section below.  Keep sorted alphabetically within each rule.
# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

# G3: Route files that call mapXToDTO but legitimately have no _INCLUDE import
#   completion.ts — mapper uses typed RatingWithJob, which is Prisma.GetPayload<{ include: typeof RATING_INCLUDE }> from ratingRepository
#   legal.ts     — mapLegalSourceToDTO maps flat LegalSource model (no relations)
G3_WHITELIST="helpers.ts completion.ts legal.ts"

# ─── G8: Ban `prisma db push` ────────────────────────────────────────────
echo ""
echo "━━━ G8: Checking for banned 'prisma db push' ━━━"

G8_HITS=$(grep -rn "db push" \
  "$ROOT/apps/api/package.json" \
  "$ROOT/.github/workflows/" \
  "$ROOT/package.json" \
  --include="*.json" --include="*.yml" --include="*.yaml" --include="*.sh" --include="*.ts" --include="*.js" \
  2>/dev/null | grep -v "guardrails.sh" | grep -v "# G8" | grep -v "never.*db push" | grep -v "No.*db push" || true)

if [ -n "$G8_HITS" ]; then
  fail "G8 VIOLATION: 'prisma db push' found in project files:"
  echo "$G8_HITS" | while read -r line; do echo "    $line"; done
else
  pass "No 'prisma db push' references"
fi

# Also check staged files if running as pre-commit
if git rev-parse --git-dir > /dev/null 2>&1; then
  G8_STAGED=$(git diff --cached --diff-filter=ACMR -S "db push" -- '*.ts' '*.json' '*.yml' 2>/dev/null | grep "+.*db push" | grep -v "guardrails" | grep -v "never.*db push" || true)
  if [ -n "$G8_STAGED" ]; then
    fail "G8 VIOLATION: staged changes contain 'prisma db push'"
    echo "$G8_STAGED" | while read -r line; do echo "    $line"; done
  fi
fi

# ─── F-UI4: Ban template-literal className ───────────────────────────────
echo ""
echo "━━━ F-UI4: Checking for banned className template literals ━━━"

# Pattern: className={`  (backtick after className={)
FUI4_HITS=$(grep -rn 'className={`' \
  "$ROOT/apps/web/pages/" \
  "$ROOT/apps/web/components/" \
  --include="*.js" --include="*.jsx" --include="*.tsx" \
  2>/dev/null || true)

if [ -n "$FUI4_HITS" ]; then
  fail "F-UI4 VIOLATION: Template-literal className found (use cn() instead):"
  echo "$FUI4_HITS" | while read -r line; do echo "    $line"; done
else
  pass "No template-literal className usage"
fi

# ─── F-UI4a: Ban per-file STATUS_COLORS / URGENCY_COLORS maps ───────────
echo ""
echo "━━━ F-UI4a: Checking for banned inline color maps ━━━"

FUI4A_HITS=$(grep -rn 'STATUS_COLORS\|URGENCY_COLORS\|STATUS_COLOR_MAP\|PRIORITY_COLORS' \
  "$ROOT/apps/web/pages/" \
  "$ROOT/apps/web/components/" \
  --include="*.js" --include="*.jsx" --include="*.tsx" \
  2>/dev/null | grep -v 'statusVariants' | grep -v '// guardrail-ignore' || true)

if [ -n "$FUI4A_HITS" ]; then
  warn "F-UI4a: Inline status color maps found (use statusVariants.js + Badge):"
  echo "$FUI4A_HITS" | while read -r line; do echo "    $line"; done
else
  pass "No inline status color maps"
fi

# ─── G9: Detect ad-hoc Prisma include trees ──────────────────────────────
echo ""
echo "━━━ G9: Checking for ad-hoc Prisma include trees ━━━"

# Detect: include: { in route files (should use imported constants)
G9_HITS=$(grep -rn 'include: {' \
  "$ROOT/apps/api/src/routes/" \
  --include="*.ts" \
  2>/dev/null | grep -v '_INCLUDE' | grep -v '// guardrail-ignore' | grep -v 'helpers.ts' || true)

if [ -n "$G9_HITS" ]; then
  warn "G9: Ad-hoc 'include: {' in route files (use canonical _INCLUDE constants):"
  echo "$G9_HITS" | head -10 | while read -r line; do echo "    $line"; done
  COUNT=$(echo "$G9_HITS" | wc -l | tr -d ' ')
  if [ "$COUNT" -gt 10 ]; then
    echo "    ... and $((COUNT - 10)) more"
  fi
else
  pass "No ad-hoc include trees in routes"
fi

# ─── G20: No NEW direct Prisma access in services (ARCH-1 enforcement) ────
# Architecture rule: services contain domain logic only; all DB access routes
# through repositories. ~219 direct `prisma.*` calls across 28 service files
# remain as grandfathered debt (the ARCH-1 epic was declared complete but
# regressed — see CRITICAL_AUDIT_2026-06-23). This ratchet BLOCKS any increase:
# no new prisma-using service file AND no new prisma.* call in an existing one.
# Burndown: when you remove calls, LOWER the baselines below so the ratchet
# tightens. Goal: both → 0, at which point flip this to a zero-tolerance check.
echo ""
echo "━━━ G20: Checking for new direct Prisma access in services ━━━"
G20_BASELINE_FILES=28
G20_BASELINE_LINES=219
G20_CUR_FILES=$(grep -rl 'prisma\.' "$ROOT/apps/api/src/services" --include="*.ts" 2>/dev/null | wc -l | tr -d ' ')
G20_CUR_LINES=$(grep -rho 'prisma\.' "$ROOT/apps/api/src/services" --include="*.ts" 2>/dev/null | wc -l | tr -d ' ')
if [ "$G20_CUR_FILES" -gt "$G20_BASELINE_FILES" ] || [ "$G20_CUR_LINES" -gt "$G20_BASELINE_LINES" ]; then
  fail "G20: direct Prisma access in services increased (files $G20_CUR_FILES vs baseline $G20_BASELINE_FILES, calls $G20_CUR_LINES vs baseline $G20_BASELINE_LINES)."
  echo "    Services must not call Prisma directly — add the query to a repository (apps/api/src/repositories/)"
  echo "    and call it from the service. If you legitimately REMOVED calls, lower G20_BASELINE_FILES /"
  echo "    G20_BASELINE_LINES in scripts/guardrails.sh to match the new (lower) count."
elif [ "$G20_CUR_FILES" -lt "$G20_BASELINE_FILES" ] || [ "$G20_CUR_LINES" -lt "$G20_BASELINE_LINES" ]; then
  warn "G20: service Prisma debt decreased (files $G20_CUR_FILES≤$G20_BASELINE_FILES, calls $G20_CUR_LINES≤$G20_BASELINE_LINES) — lower the baselines in scripts/guardrails.sh to lock in the win."
else
  pass "G20: no new direct Prisma access in services (baseline $G20_BASELINE_FILES files / $G20_BASELINE_LINES calls held)"
fi

# ─── G3 (light): Detect likely DTO/include mismatches ────────────────────
echo ""
echo "━━━ G3: Checking for DTO mapper calls without include ━━━"

# Heuristic: find mapXToDTO( calls in files that don't import/define an _INCLUDE
G3_HITS=""
for f in "$ROOT"/apps/api/src/routes/*.ts; do
  [ -f "$f" ] || continue
  basename=$(basename "$f")
  # Skip known false positives (see G3_WHITELIST at top of file)
  case " $G3_WHITELIST " in *" $basename "*) continue ;; esac
  # Check if file calls a mapXToDTO function
  if grep -q 'map[A-Z].*ToDTO\|map[A-Z].*toDTO' "$f" 2>/dev/null; then
    # Check if it also has an _INCLUDE import or definition
    if ! grep -q '_INCLUDE\|INCLUDE' "$f" 2>/dev/null; then
      G3_HITS="$G3_HITS\n    $f: calls DTO mapper but no _INCLUDE constant found"
    fi
  fi
done

if [ -n "$G3_HITS" ]; then
  warn "G3: Route files call DTO mappers without visible _INCLUDE constants:"
  echo -e "$G3_HITS"
else
  pass "All DTO mapper calls appear to have matching includes"
fi

# ─── F-UI9: No Panel wrapping ConfigurableTable ───────────────────────────
# Panel adds bg-surface-raised (slate-50). ConfigurableTable self-borders and
# must never sit inside a Panel. The canonical smell is bodyClassName="p-0"
# used to flush a table/list component into a Panel card.
#
# Whitelist: files where Panel bodyClassName="p-0" is intentional (detail-page
# sub-sections that embed inline tables for compact related-record display, not
# full hub tables). Add with a one-line justification.
FUI9_WHITELIST="
  leases/[id].js        -- Signature Requests / Invoices / Rent Adjustments sub-tables in detail panel
  invoices/[id].js      -- Line Items sub-table inside invoice detail card
  requests/[id].js      -- Legal Analysis panel body uses p-0 for flush display
  rfps/[id].js          -- Quotes table inside RFP detail card
  units/[id].js         -- Nebenkosten / Income sub-tables inside unit detail card
  buildings/[id].js     -- Tenants sub-table inside building detail card
  cashflow/[id].js      -- Monthly cashflow sub-table inside plan detail card
  _template_detail.js   -- Template scaffold — intentional example
  _template_hub.js      -- Template scaffold — intentional example
  chart-of-accounts.js  -- Account-tree tables are structural sub-panels, not hub tables
  BuildingFinancialsView.jsx  -- Component: financial sub-tables inside building detail context
  BillingEntityManager.js     -- Component: billing entity sub-tables, used inside detail context
  tenants/[id].js       -- Contracts / Invoices sub-tables in tenant detail panel (same pattern as leases/[id].js)
"

FUI9_HITS=""
while IFS= read -r f; do
  # Check whitelist by path substring — skip if any whitelist pattern matches the file path
  skip=false
  while IFS= read -r entry; do
    wl_pat=$(echo "$entry" | awk '{print $1}' | xargs)
    [[ -z "$wl_pat" ]] && continue
    [[ "$f" == *"$wl_pat"* ]] && skip=true && break
  done <<< "$FUI9_WHITELIST"
  $skip && continue

  if grep -q 'bodyClassName="p-0"' "$f" && grep -q 'ConfigurableTable\|CashflowPlansList\|inline-table\|data-table' "$f"; then
    FUI9_HITS="${FUI9_HITS}\n  $f"
  fi
done < <(find "$ROOT/apps/web/pages" "$ROOT/apps/web/components" -name "*.js" -o -name "*.jsx" | grep -v node_modules)

if [ -n "$FUI9_HITS" ]; then
  warn "F-UI9: Panel bodyClassName=\"p-0\" may be wrapping a table component (ConfigurableTable / inline-table)."
  echo "  Tables must NOT sit inside a Panel — use Section headings or plain divs."
  echo -e "$FUI9_HITS"
else
  pass "F-UI9: No Panel-wrapping-table violations detected"
fi

# ─── G18: Detect staged secrets / hardcoded credentials ─────────────────
echo ""
echo "━━━ G18: Checking staged files for hardcoded secrets ━━━"

if git rev-parse --git-dir > /dev/null 2>&1; then

  # Check 1: staged .env files (anything matching .env* except .env.example)
  ENV_STAGED=$(git diff --cached --name-only --diff-filter=ACMR 2>/dev/null \
    | grep -E '(^|/)\.env' \
    | grep -v '\.env\.example$' || true)
  if [ -n "$ENV_STAGED" ]; then
    fail "G18 VIOLATION: .env file(s) staged for commit — secrets must never be committed:"
    echo "$ENV_STAGED" | while read -r f; do echo "    $f"; done
    echo "    Only .env.example (placeholder values only) should ever be committed."
    echo "    Real secrets belong in .env.local (local dev) or your deployment platform (Render / Vercel)."
  else
    pass "No .env files staged"
  fi

  # Check 2: high-confidence secret patterns in any staged source file
  # Patterns covered:
  #   sk-ant-api…        — Anthropic / Claude API key
  #   sb_secret_…        — Supabase new-format secret key
  #   sb_publishable_…   — Supabase new-format publishable key
  #   eyJhbGci…          — JWT / legacy Supabase service-role token (base64 header)
  #   AZURE_*_KEY=<val>  — Azure cognitive services key (long alphanumeric after =)
  SECRET_PATTERN='sk-ant-api[0-9A-Za-z_-]{20,}|sb_secret_[0-9A-Za-z_-]{10,}|sb_publishable_[0-9A-Za-z_-]{10,}|eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9\.[A-Za-z0-9_-]{20,}\.[A-Za-z0-9_-]{20,}|AZURE_[A-Z_]*KEY=[0-9A-Za-z]{32,}'
  SECRET_HITS=$(git diff --cached --diff-filter=ACMR \
      -- '*.ts' '*.js' '*.json' '*.yaml' '*.yml' '*.toml' '*.sh' \
      2>/dev/null \
    | grep '^+' \
    | grep -v '^+++' \
    | grep -E "$SECRET_PATTERN" \
    | grep -v '# guardrail-ignore' \
    || true)
  if [ -n "$SECRET_HITS" ]; then
    fail "G18 VIOLATION: Hardcoded secret pattern detected in staged files:"
    echo "$SECRET_HITS" | head -5 | while read -r line; do echo "    $line"; done
    echo "    Move secrets to .env.local (local) or your deployment platform env vars."
    echo "    Never embed live keys in source code."
  else
    pass "No hardcoded secret patterns in staged source files"
  fi

fi

# ─── G16: Ban MyApp.getInitialProps in _app.js ──────────────────────────
echo ""
echo "━━━ G16: Checking for banned MyApp.getInitialProps in _app.js ━━━"

APP_FILE="$ROOT/apps/web/pages/_app.js"
if [ -f "$APP_FILE" ]; then
  G16_HITS=$(grep -n "getInitialProps" "$APP_FILE" 2>/dev/null || true)
  if [ -n "$G16_HITS" ]; then
    fail "G16 VIOLATION: MyApp.getInitialProps found in _app.js — this forces ALL pages through Node.js SSR"
    echo "  This caused a half-day production outage on 2026-05-04 (FUNCTION_INVOCATION_FAILED)."
    echo "  Fix: use getServerSideProps on individual pages, or dynamic() with ssr:false for browser-only components."
    echo "$G16_HITS" | while read -r line; do echo "    $_app.js:$line"; done
  else
    pass "G16: No MyApp.getInitialProps in _app.js"
  fi
fi

# ─── G17: Warn on hardcoded user-facing strings in frontend files ────────
# Policy: every user-facing label in pages/ and components/ must go through
# next-i18next t() so FR/EN translations work seamlessly. Never hardcode
# visible text as a string literal directly in JSX.
#
# Detection: staged .js files in apps/web/pages/ or apps/web/components/ that
# contain text-like string literals (2+ words, starts with capital) inside JSX
# — i.e. lines with quoted strings that aren't inside a t() call and aren't
# purely structural (className, href, aria-*, key, type, etc.).
echo ""
echo "━━━ G17: Checking for hardcoded labels (should use t()) ━━━"

STAGED_FRONTEND=$(git diff --cached --name-only | grep -E "^apps/web/(pages|components)/.*\.js$" || true)

if [ -z "$STAGED_FRONTEND" ]; then
  pass "G17: No staged frontend files to check"
else
  G17_HITS=""
  while IFS= read -r file; do
    # Look for lines with quoted strings of 2+ English words that don't use t()
    # Exclude: comments, import lines, className, href, aria-*, key=, type=, style=, placeholder (handled separately), and lines that already call t(
    HITS=$(grep -n '"[A-Z][a-zA-Z]* [a-zA-Z]' "$ROOT/$file" 2>/dev/null \
      | grep -v "//\|import \|className\|href=\| key=\|type=\| id=\|style=\|aria-\|data-\|rel=\|method=\|target=\|name=\|role=\|tabIndex\|autoComplete\|defaultValue\|accept=\|encType\|action=\| t(\|console\.\|error\.\| code:\| message:\|@\|http" \
      | grep -v "^ *\*\|^ *//" \
      || true)
    if [ -n "$HITS" ]; then
      G17_HITS="${G17_HITS}  ${file}:\n${HITS}\n"
    fi
  done <<< "$STAGED_FRONTEND"

  if [ -n "$G17_HITS" ]; then
    warn "G17: Possible hardcoded labels found — wrap in t() and add keys to locale files:"
    echo -e "$G17_HITS" | head -30
  else
    pass "G17: No obvious hardcoded labels detected"
  fi
fi

# ─── G19: Mirrored docs must stay byte-identical ─────────────────────────
# Every doc that exists in BOTH docs/ (root) and apps/web/public/docs/ (the
# copy actually SERVED at /docs/...) must be byte-identical — they are two
# copies of the same page. Auto-discovers the shared set (top-level files in
# both dirs); root-only dev docs (AUDIT.md, *.sql, etc.) are ignored.
# On 2026-06-18 a commit "re-synced" pitchdeck.html from the STALE root copy,
# silently reverting ~2,100 lines of committed content inside an unrelated
# feature commit. This guard blocks any commit where a shared doc diverges,
# so a stale-source overwrite can never ship unnoticed. Always edit BOTH
# copies in the same commit.
echo ""
echo "━━━ G19: Checking mirrored docs (docs/ vs apps/web/public/docs/) are in sync ━━━"

G19_DIR_A="$ROOT/docs"
G19_DIR_B="$ROOT/apps/web/public/docs"
G19_VIOL=""
if [ -d "$G19_DIR_A" ] && [ -d "$G19_DIR_B" ]; then
  while IFS= read -r rel; do
    [ -z "$rel" ] && continue
    cmp -s "$G19_DIR_A/$rel" "$G19_DIR_B/$rel" || G19_VIOL="${G19_VIOL}\n    $rel — docs/ and apps/web/public/docs/ differ"
  done < <(comm -12 \
    <(find "$G19_DIR_A" -maxdepth 1 -type f -exec basename {} \; | sort) \
    <(find "$G19_DIR_B" -maxdepth 1 -type f -exec basename {} \; | sort))
fi

if [ -n "$G19_VIOL" ]; then
  fail "G19 VIOLATION: mirrored doc(s) out of sync — update BOTH copies in the same commit:"
  echo -e "$G19_VIOL"
  echo "    Fix: copy the INTENDED-newer file over the other, then re-stage both."
  echo "    (2026-06-18 incident: a stale-source re-sync silently reverted committed content.)"
else
  pass "G19: all mirrored docs are identical"
fi

# ─── Summary ─────────────────────────────────────────────────────────────
echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
if [ "$ERRORS" -gt 0 ]; then
  red "FAILED: $ERRORS error(s), $WARNINGS warning(s)"
  echo "Fix all errors before committing."
  exit 1
elif [ "$WARNINGS" -gt 0 ]; then
  yellow "PASSED with $WARNINGS warning(s)"
  echo "Warnings should be addressed but won't block commit."
  exit 0
else
  green "ALL GUARDRAILS PASSED"
  exit 0
fi
