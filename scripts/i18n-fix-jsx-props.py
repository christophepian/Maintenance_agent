#!/usr/bin/env python3
"""Fix JSX props that got t() without curly braces: attr=t(...) → attr={t(...)}"""
import re
from pathlib import Path

FILES = [
    "apps/web/pages/manager/index.js",
    "apps/web/pages/owner/index.js",
]

ROOT = Path("/Users/christophepian/Documents/Maintenance_Agent")

# Match: word chars (the attr name), = then t(  but NOT already ={
# Pattern: (\w[\w-]*)=t( → \1={t(
PATTERN = re.compile(r'([\w-]+=)t\(("(?:manager|owner):[^"]+")(\))')

for rel in FILES:
    p = ROOT / rel
    src = p.read_text()
    # Fix: attr=t("ns:key") → attr={t("ns:key")}
    fixed = PATTERN.sub(r'\1{t(\2\3}', src)
    if fixed != src:
        p.write_text(fixed)
        count = len(PATTERN.findall(src))
        print(f"Fixed {count} occurrences in {rel}")
    else:
        print(f"No changes needed in {rel}")
