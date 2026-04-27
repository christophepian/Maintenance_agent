#!/usr/bin/env bash
# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
# Guardrail Enforcement Script
# Runs locally (pre-commit) and in CI. Checks G8, F-UI4, F-UI4a, G9, G3.
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
