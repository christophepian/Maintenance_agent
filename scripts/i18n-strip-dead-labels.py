#!/usr/bin/env python3
"""
Strip dead label: "..." fields from tab/step arrays where the render
already resolves labels via t() by key lookup.
This makes the arrays key-only, removing the audit noise.
"""
import re, os

BASE = "/Users/christophepian/Documents/Maintenance_Agent/apps/web"

# Files where tab array label fields are dead code (render uses t() by key)
# Format: (filepath, array_const_names...)
TAB_FILES = [
    ("pages/contractor/invoices.js", ["STATUS_TABS"]),
    ("pages/contractor/jobs.js", ["TABS"]),
    ("pages/contractor/rfps.js", ["STATUS_TABS"]),
    ("pages/manager/billing-schedules.js", ["TABS"]),
    ("pages/manager/charge-reconciliations/index.js", ["TABS"]),
    ("pages/manager/contractor-billing-schedules/index.js", ["TABS"]),
    ("pages/manager/finance/charges.js", ["TABS"]),
    ("pages/manager/finance/chart-of-accounts.js", ["TABS"]),
    ("pages/manager/finance/index.js", ["FINANCE_TABS"]),
    ("pages/manager/finance/invoices.js", ["INCOMING_STATUS_TABS", "OUTGOING_STATUS_TABS"]),
    ("pages/manager/leases/index.js", ["TABS"]),
    ("pages/manager/rfps.js", ["STATUS_TABS"]),
    ("pages/manager/settings.js", ["SETTINGS_TABS"]),
    ("pages/owner/finance.js", ["FINANCE_TABS", "STATUS_TABS", "DIRECTION_TABS"]),
    ("pages/owner/invoices.js", ["STATUS_TABS"]),
    ("pages/owner/settings.js", ["SETTINGS_TABS"]),
    ("pages/owner/work-requests.js", ["STATUS_TABS"]),
    ("pages/manager/requests.js", ["STATUS_TABS"]),
    ("pages/manager/people/index.js", ["PEOPLE_TABS"]),
    ("pages/manager/rent-adjustments/index.js", ["TABS"]),
]


def find_const_array_bounds(content, const_name):
    """Find start and end of `const NAME = [...]` declaration."""
    pattern = rf'const {re.escape(const_name)}\s*=\s*\['
    m = re.search(pattern, content)
    if not m:
        return None, None
    bracket_start = m.end() - 1
    depth = 0
    in_string = False
    string_char = None
    i = bracket_start
    while i < len(content):
        c = content[i]
        if in_string:
            if c == '\\':
                i += 2
                continue
            if c == string_char:
                in_string = False
        else:
            if c in ('"', "'", '`'):
                in_string = True
                string_char = c
            elif c == '[':
                depth += 1
            elif c == ']':
                depth -= 1
                if depth == 0:
                    return m.start(), i + 1
        i += 1
    return None, None


def strip_label_from_array(array_text):
    """
    Remove label: "..." fields from an array of objects.
    Handles both multi-line format:
        label: "Value",
    and inline format:
        { key: "X", label: "Value" }
    """
    # Multi-line format: standalone label: "..." line
    result = re.sub(r'[ \t]*label:\s*"[^"]*",?\n', '', array_text)
    # Inline format: , label: "..." (trailing comma optional, with surrounding space)
    result = re.sub(r',\s*label:\s*"[^"]*"', '', result)
    return result


def process_file(rel_path, const_names):
    filepath = os.path.join(BASE, rel_path)
    if not os.path.exists(filepath):
        print(f"  SKIP (not found): {rel_path}")
        return

    with open(filepath, 'r', encoding='utf-8') as f:
        content = f.read()

    original = content
    stripped_any = False

    for const_name in const_names:
        start, end = find_const_array_bounds(content, const_name)
        if start is None:
            print(f"  SKIP const {const_name} not found in {rel_path}")
            continue

        array_text = content[start:end]
        new_array_text = strip_label_from_array(array_text)

        if new_array_text != array_text:
            content = content[:start] + new_array_text + content[end:]
            stripped_any = True
            removed = array_text.count('label:') - new_array_text.count('label:')
            print(f"  ✓ Stripped {removed} label fields from {const_name} in {rel_path}")
        else:
            print(f"  ∅ No label fields to strip in {const_name}")

    if content != original:
        with open(filepath, 'w', encoding='utf-8') as f:
            f.write(content)


def main():
    for rel_path, const_names in TAB_FILES:
        process_file(rel_path, const_names)

    print("\n✅ Dead label fields stripped from tab arrays.")


if __name__ == "__main__":
    main()
