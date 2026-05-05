#!/usr/bin/env python3
"""
Comprehensive audit: find ALL t() key references in pages,
then cross-check against locale files to find missing keys.
"""
import json, re, os

BASE = "apps/web"
LOCALES = f"{BASE}/public/locales"

# Gather all t("ns:path.to.key") references from pages
refs = {}  # "ns:section.sub.key" -> set of files

for root, dirs, files in os.walk(f"{BASE}/pages"):
    for fn in files:
        if not fn.endswith('.js'):
            continue
        path = os.path.join(root, fn)
        content = open(path).read()
        # Static string keys: t("ns:path.key")
        for m in re.finditer(r't\("([a-z]+:[^"]+)"', content):
            key = m.group(1)
            refs.setdefault(key, set()).add(path)
        # Template literal keys: t(`ns:sec.tabs.${x}`) — capture pattern only
        for m in re.finditer(r't\(`([a-z]+:[^`$]+)\$\{([^}]+)\}`\)', content):
            prefix = m.group(1)  # e.g. "manager:requests.tabs."
            refs.setdefault(f"__TEMPLATE__{prefix}", set()).add(path)

# Load all locale data
def load_locale(ns, lang):
    path = f"{LOCALES}/{lang}/{ns}.json"
    if not os.path.exists(path):
        return {}
    return json.load(open(path))

NAMESPACES = ["common", "manager", "owner", "contractor", "tenant"]
locales = {}
for ns in NAMESPACES:
    for lang in ["en", "fr"]:
        locales[f"{lang}/{ns}"] = load_locale(ns, lang)


def get_nested(data, path_parts):
    """Navigate nested dict by list of keys."""
    cur = data
    for p in path_parts:
        if not isinstance(cur, dict):
            return None
        cur = cur.get(p)
    return cur


missing = {}  # key -> {lang: ..., in_file: ...}

for full_key, files in sorted(refs.items()):
    if full_key.startswith("__TEMPLATE__"):
        continue  # skip template patterns
    parts = full_key.split(":")
    if len(parts) != 2:
        continue
    ns = parts[0]
    path = parts[1]
    path_parts = path.split(".")

    for lang in ["en", "fr"]:
        locale_data = locales.get(f"{lang}/{ns}", {})
        val = get_nested(locale_data, path_parts)
        if val is None:
            key = f"{lang}:{full_key}"
            missing.setdefault(full_key, {})[lang] = True

# Print missing keys grouped by namespace
by_ns = {}
for key, langs in sorted(missing.items()):
    ns = key.split(":")[0]
    by_ns.setdefault(ns, []).append((key, langs))

for ns, items in sorted(by_ns.items()):
    print(f"\n=== {ns} namespace — {len(items)} missing keys ===")
    for key, langs in items[:50]:
        lang_str = "+".join(sorted(langs.keys()))
        print(f"  [{lang_str}] {key}")
    if len(items) > 50:
        print(f"  ... and {len(items)-50} more")

print(f"\nTotal missing: {sum(len(v) for v in by_ns.values())} keys across all namespaces")
