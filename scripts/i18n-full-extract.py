#!/usr/bin/env python3
"""
Full i18n extraction pass — replaces hardcoded visible strings in JSX with t() calls.

Targets:
  - JSX text nodes:   >Some visible text<   →  >{t("ns:scope.key")}<
  - label/title/placeholder props (string literals) already handled by earlier codemod
  - <th>, <td>, <h1-h6>, <p>, <span>, <button>, <option> text content
  - heading= and title= props on section/panel components

Run:
  python3 scripts/i18n-full-extract.py [--dry-run] [--ns manager|owner|contractor|tenant]
"""
import re, json, os, sys, argparse, copy
from pathlib import Path

ROOT = Path(__file__).parent.parent / "apps/web"
PAGES = ROOT / "pages"
LOCALES = ROOT / "public/locales"

# ── helpers ──────────────────────────────────────────────────────────────────

def to_camel(text: str) -> str:
    """'Some Label Text' → 'someLabelText'"""
    words = re.sub(r"[^a-zA-Z0-9 ]", "", text).strip().split()
    if not words:
        return "unknown"
    return words[0][0].lower() + words[0][1:] + "".join(w.capitalize() for w in words[1:])

def namespace_for(rel: str) -> str:
    if rel.startswith("manager/"): return "manager"
    if rel.startswith("owner/"): return "owner"
    if rel.startswith("contractor/"): return "contractor"
    if rel.startswith("tenant/"): return "tenant"
    return "common"

def page_scope(rel: str, ns: str) -> str:
    """manager/finance/invoices.js → 'financeInvoices'"""
    parts = Path(rel).with_suffix("").parts
    # strip the namespace folder
    try:
        idx = parts.index(ns)
        parts = parts[idx+1:]
    except ValueError:
        parts = parts[1:]
    if not parts:
        return "index"
    # join remaining, camelCase
    joined = "".join(p.replace("[","").replace("]","").replace("-","_").title() for p in parts)
    return joined[0].lower() + joined[1:]

def load_json(path: Path) -> dict:
    if path.exists():
        return json.loads(path.read_text(encoding="utf-8"))
    return {}

def save_json(path: Path, data: dict):
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(json.dumps(data, indent=2, ensure_ascii=False) + "\n", encoding="utf-8")

def set_nested(d: dict, keys: list, value):
    for k in keys[:-1]:
        d = d.setdefault(k, {})
    if keys[-1] not in d:
        d[keys[-1]] = value

def get_nested(d: dict, keys: list):
    for k in keys:
        if not isinstance(d, dict) or k not in d:
            return None
        d = d[k]
    return d

# ── skip heuristics ───────────────────────────────────────────────────────────

SKIP_EXACT = {
    "", " ", "  ", "   ",
    "...", "→", "←", "↑", "↓", "×", "✓", "✕",
    "CHF", "USD", "EUR",
    "\u2014", "—", "–",
    "&hellip;", "&mdash;", "&ndash;", "&amp;", "&lt;", "&gt;",
    "Select&hellip;",
}

SKIP_PATTERNS = [
    r"^\d[\d\s.,:/%-]*$",          # numbers / dates
    r"^[A-Z_]{2,}$",               # enum values like PENDING, IN_PROGRESS
    r"^[a-z]+$",                    # single lowercase word (likely a key/prop)
    r"^[\W\s]+$",                   # only punctuation/whitespace
    r"https?://",                   # URLs
    r"^\+\d",                       # phone patterns like +41
    r"^[a-z][\w-]+\.[a-z]",        # likely email/domain
    r"^CH[0-9 ]{5,}",              # IBAN
    r"^CHE-",                       # VAT
    r"^[A-Z]{2}\d",                 # codes
    r"^\{\{",                       # i18next interpolation
    r"^[<>{}()\[\]]+$",             # JSX brackets
]

def should_skip(text: str) -> bool:
    s = text.strip()
    if not s or s in SKIP_EXACT:
        return True
    for pat in SKIP_PATTERNS:
        if re.match(pat, s):
            return True
    # Must contain at least one letter
    if not re.search(r"[a-zA-Z]", s):
        return True
    # Reject code-like content (JS expressions leaked through comparison operators or ternaries)
    if re.search(r"[()&|?]", s):
        return True
    if re.search(r"\b[a-z]+\.[a-zA-Z]", s):  # method calls: x.toUpperCase()
        return True
    if re.search(r"\\u[0-9a-fA-F]{4}", s):  # raw unicode escapes in source
        return True
    # HTML entities that aren't real text
    if re.match(r"^&[a-z]+;$", s):
        return True
    return False

# ── extraction regexes ────────────────────────────────────────────────────────

# JSX text node: content between a closing tag angle and next opening angle
# Captures text that is direct children of elements
JSX_TEXT_RE = re.compile(
    r"""(>)([ \t]*)([^<>{}\n\r]+?)([ \t]*)(</|<[A-Za-z/])""",
)

# Inline expression text that produces a string — e.g. {"Some text"}
JSX_EXPR_STRING_RE = re.compile(r'\{("([^"\\]+)"|\'([^\'\\]+)\')\}')

# String prop values for common label-like props
PROP_STR_RE = re.compile(
    r"""((?:heading|title|label|sectionTitle|emptyMessage|placeholder|aria-label|noDataMessage|description)\s*=\s*)"([^"\\{][^"]*)"(?!\s*\{)"""
)

def is_already_translated(text: str) -> bool:
    """Text already contains a t() call or interpolation."""
    return "t(" in text or "{{" in text or "{" in text


# ── main extraction ───────────────────────────────────────────────────────────

def extract_file(path: Path, ns: str, scope: str, en_data: dict, fr_data: dict,
                 dry_run: bool) -> int:
    src = path.read_text(encoding="utf-8")

    # Check that the file has useTranslation already
    if f'useTranslation("{ns}")' not in src and f"useTranslation('{ns}')" not in src:
        return 0

    replacements = 0
    new_src = src

    def make_key_and_register(text, prefix):
        """
        Given human text, create a key, register in EN/FR json,
        return the t() expression to use.
        """
        s = text.strip()
        if should_skip(s):
            return None
        key = to_camel(s)
        if not key or key == "unknown":
            return None
        full_keys = [scope, prefix, key]
        # Avoid overwriting existing different value
        existing_en = get_nested(en_data, full_keys)
        if existing_en and existing_en != s:
            # key collision — suffix with underscore count to disambiguate
            for i in range(2, 10):
                alt = full_keys[:-1] + [f"{key}{i}"]
                e2 = get_nested(en_data, alt)
                if e2 == s:
                    full_keys = alt
                    break
                if e2 is None:
                    full_keys = alt
                    break
        set_nested(en_data, full_keys, s)
        # FR — only set if not already there (preserve human-written FR)
        if get_nested(fr_data, full_keys) is None:
            set_nested(fr_data, full_keys, s)  # placeholder = EN until translated
        dot_path = ".".join(full_keys)
        return f'{ns}:{dot_path}'

    # Pass 1: JSX text nodes
    def replace_jsx_text(m: re.Match) -> str:
        open_angle, leading, content, trailing, close = m.groups()
        stripped = content.strip()
        if is_already_translated(stripped):
            return m.group(0)
        key_path = make_key_and_register(stripped, "text")
        if not key_path:
            return m.group(0)
        nonlocal replacements
        replacements += 1
        return f'{open_angle}{leading}{{t("{key_path}")}}{trailing}{close}'

    new_src = JSX_TEXT_RE.sub(replace_jsx_text, new_src)

    # Pass 2: string prop values (heading=, title=, label=, etc.)
    def replace_prop(m: re.Match) -> str:
        prop_name, value = m.group(1), m.group(2)
        if is_already_translated(value):
            return m.group(0)
        key_path = make_key_and_register(value, "prop")
        if not key_path:
            return m.group(0)
        nonlocal replacements
        replacements += 1
        return f'{prop_name}{{t("{key_path}")}}'

    new_src = PROP_STR_RE.sub(replace_prop, new_src)

    if replacements > 0 and not dry_run:
        path.write_text(new_src, encoding="utf-8")

    return replacements


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--dry-run", action="store_true")
    ap.add_argument("--ns", default=None, help="Only process this namespace")
    args = ap.parse_args()

    namespaces = ["manager", "owner", "contractor", "tenant"]
    if args.ns:
        namespaces = [args.ns]

    total_replacements = 0
    total_files = 0

    for ns in namespaces:
        ns_dir = PAGES / ns
        if not ns_dir.exists():
            continue

        en_path = LOCALES / "en" / f"{ns}.json"
        fr_path = LOCALES / "fr" / f"{ns}.json"
        en_data = load_json(en_path)
        fr_data = load_json(fr_path)

        for js_file in sorted(ns_dir.rglob("*.js")):
            rel = str(js_file.relative_to(PAGES))
            scope = page_scope(rel, ns)
            n = extract_file(js_file, ns, scope, en_data, fr_data, args.dry_run)
            if n > 0:
                total_files += 1
                total_replacements += n
                print(f"  [{ns}] {rel}: +{n}")

        if not args.dry_run:
            save_json(en_path, en_data)
            save_json(fr_path, fr_data)
            print(f"→ saved {en_path.name} (EN + FR placeholder)")

    print(f"\nTotal: {total_replacements} replacements in {total_files} files")
    if args.dry_run:
        print("(dry-run — no files written)")


if __name__ == "__main__":
    main()
