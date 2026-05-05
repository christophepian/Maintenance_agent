#!/usr/bin/env python3
"""
For each template t(`ns:section.tabs.${tab.key.toLowerCase()}`) call,
find the associated array in that file, extract all keys, and check
whether the locale files have all those keys.
"""
import json, re, os

BASE = "apps/web"
LOCALES = f"{BASE}/public/locales"

def load_locale(ns, lang):
    path = f"{LOCALES}/{lang}/{ns}.json"
    if not os.path.exists(path): return {}
    return json.load(open(path))

def get_nested(data, path_parts):
    cur = data
    for p in path_parts:
        if not isinstance(cur, dict): return None
        cur = cur.get(p)
    return cur

NAMESPACES = ["common", "manager", "owner", "contractor", "tenant"]
locales = {}
for ns in NAMESPACES:
    for lang in ["en", "fr"]:
        locales[f"{lang}/{ns}"] = load_locale(ns, lang)

# For each page, find template t() + associated array keys
missing_tab_keys = []

def find_array_keys(content, array_name):
    """Extract all key: "VALUE" from a named array."""
    pattern = rf'const {re.escape(array_name)}\s*=\s*\['
    m = re.search(pattern, content)
    if not m: return []
    # Find matching ]
    depth = 0
    in_str = False
    sc = None
    i = m.end() - 1
    while i < len(content):
        c = content[i]
        if in_str:
            if c == '\\': i += 2; continue
            if c == sc: in_str = False
        else:
            if c in ('"', "'", '`'): in_str = True; sc = c
            elif c == '[': depth += 1
            elif c == ']':
                depth -= 1
                if depth == 0:
                    arr_text = content[m.start():i+1]
                    keys = re.findall(r'key:\s*"([^"]+)"', arr_text)
                    return [k.lower() for k in keys]
        i += 1
    return []

for root, dirs, files in os.walk(f"{BASE}/pages"):
    for fn in files:
        if not fn.endswith('.js'): continue
        path = os.path.join(root, fn)
        content = open(path).read()
        
        # Find template t() calls for tabs
        for m in re.finditer(r't\(`([a-z]+):([^`$]+)\.tabs\.\$\{([^}]+\.key[^}]*)\}`\)', content):
            ns = m.group(1)
            section = m.group(2)
            expr = m.group(3)  # e.g. "tab.key.toLowerCase()"
            
            # Try to find what array variable "tab" comes from
            # Look for .map((tab, or .map((t, or similar before this line
            line_start = content.rfind('\n', 0, m.start())
            context_before = content[max(0, m.start()-500):m.start()]
            
            # Find array names used in map calls nearby
            array_matches = re.findall(r'(\w+_?TABS?\b|\w+TABS?\b)\.map\(', context_before)
            
            if not array_matches:
                # Also search wider
                array_matches = re.findall(r'(\w+_?TABS?\b|\w+TABS?\b)\.map\(', content[:m.start()])
            
            if not array_matches:
                print(f"  NO ARRAY FOUND for {ns}:{section}.tabs in {path.replace(BASE+'/', '')}")
                continue
            
            array_name = array_matches[-1]  # most recent
            keys = find_array_keys(content, array_name)
            
            if not keys:
                print(f"  NO KEYS for {array_name} in {path.replace(BASE+'/', '')}")
                continue
            
            # Check locale files
            section_parts = section.split(".")
            for lang in ["en", "fr"]:
                locale = locales.get(f"{lang}/{ns}", {})
                tabs_obj = get_nested(locale, section_parts + ["tabs"])
                
                for key in keys:
                    if tabs_obj is None or key not in tabs_obj:
                        missing_tab_keys.append({
                            "lang": lang,
                            "ns": ns,
                            "section": section,
                            "key": key,
                            "file": path.replace(BASE+'/', ''),
                            "array": array_name,
                        })

# Deduplicate
seen = set()
unique_missing = []
for m in missing_tab_keys:
    k = f"{m['lang']}:{m['ns']}:{m['section']}.tabs.{m['key']}"
    if k not in seen:
        seen.add(k)
        unique_missing.append(m)

# Group by ns:section
by_section = {}
for m in unique_missing:
    k = f"{m['lang']}:{m['ns']}:{m['section']}"
    by_section.setdefault(k, []).append(m['key'])

print(f"Missing tab keys: {len(unique_missing)}")
for sec, keys in sorted(by_section.items()):
    print(f"  {sec}.tabs: {sorted(set(keys))}")
