#!/usr/bin/env python3
"""Diagnose t() calls outside function bodies that have useTranslation."""
import re
from pathlib import Path

FILE = Path("/Users/christophepian/Documents/Maintenance_Agent/apps/web/pages/manager/finance/invoices.js")
src = FILE.read_text()
lines = src.split("\n")

T_RE = re.compile(r't\("(manager|owner|contractor|tenant):')

# Find all functions with useTranslation and their line ranges
fn_ranges = []  # (start_line, end_line, fn_name)
fn_re = re.compile(r'\nfunction (\w+)\s*\(')
for m in fn_re.finditer(src):
    fn_name = m.group(1)
    # Find param closing )
    paren_start = src.index('(', m.start())
    depth = 1
    pos = paren_start + 1
    while pos < len(src) and depth > 0:
        if src[pos] == '(': depth += 1
        elif src[pos] == ')': depth -= 1
        pos += 1
    brace_open = src.index('{', pos - 1)
    # Walk to find closing }
    depth = 1
    pos2 = brace_open + 1
    while pos2 < len(src) and depth > 0:
        if src[pos2] == '{': depth += 1
        elif src[pos2] == '}': depth -= 1
        pos2 += 1
    fn_body = src[brace_open:pos2]
    has_ut = 'useTranslation' in fn_body
    has_t = bool(T_RE.search(fn_body))
    start_line = src[:m.start()].count('\n') + 1
    end_line = src[:pos2].count('\n') + 1
    fn_ranges.append((start_line, end_line, fn_name, has_ut, has_t))
    print(f"  {fn_name}: lines {start_line}-{end_line}, has_useTranslation={has_ut}, has_t_calls={has_t}")

print()
# Check each t() call line and see which function it's in
for i, line in enumerate(lines, 1):
    if T_RE.search(line):
        owner = None
        for (sl, el, name, has_ut, _) in fn_ranges:
            if sl <= i <= el:
                owner = (name, has_ut)
                break
        if owner and not owner[1]:
            print(f"  LINE {i}: t() in '{owner[0]}' which lacks useTranslation: {line.strip()[:80]}")
        elif not owner:
            print(f"  LINE {i}: t() at MODULE SCOPE: {line.strip()[:80]}")
