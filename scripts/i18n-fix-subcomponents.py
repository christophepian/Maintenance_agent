#!/usr/bin/env python3
"""
Find named sub-component functions that use t("ns:...) but lack useTranslation.
Injects const { t } = useTranslation(ns) at the top of each such function body.
"""
import re
from pathlib import Path

ROOT = Path("/Users/christophepian/Documents/Maintenance_Agent/apps/web/pages")
T_CALL_RE = re.compile(r't\("(manager|owner|contractor|tenant):')


def fix_file_v2(path):
    src = path.read_text()
    if not T_CALL_RE.search(src):
        return 0
    
    ns_match = T_CALL_RE.search(src)
    ns = ns_match.group(1)
    
    # Find sub-component functions: "function FuncName(" or "function funcName("
    # that contain t("ns: but not "useTranslation" in same body
    # Strategy: find all "function X(...) {" blocks and check each
    
    fn_re = re.compile(r'\n(?:export (?:default )?)?function (\w+)\s*\(')

    result = src
    offset = 0

    for m in fn_re.finditer(src):
        # Find the closing ) of the parameter list
        paren_start = src.index('(', m.start())
        depth_p = 1
        pos_p = paren_start + 1
        while pos_p < len(src) and depth_p > 0:
            if src[pos_p] == '(':
                depth_p += 1
            elif src[pos_p] == ')':
                depth_p -= 1
            pos_p += 1
        # pos_p is now right after the closing )
        # The function body { should be the next non-whitespace char
        brace_open_idx = src.index('{', pos_p - 1)
        
        # Walk to find matching closing brace
        depth = 1
        pos = brace_open_idx + 1
        while pos < len(src) and depth > 0:
            if src[pos] == '{':
                depth += 1
            elif src[pos] == '}':
                depth -= 1
            pos += 1
        fn_body = src[brace_open_idx:pos]

        # Check if this function uses t() but lacks useTranslation AND t is not a param
        param_region = src[paren_start:brace_open_idx]
        t_is_param = bool(re.search(r'\bt\b', param_region))
        if T_CALL_RE.search(fn_body) and 'useTranslation' not in fn_body and not t_is_param:
            inject = '\n  const { t } = useTranslation("' + ns + '");'
            insert_pos = brace_open_idx + 1 + offset
            result = result[:insert_pos] + inject + result[insert_pos:]
            offset += len(inject)
    
    if result != src:
        path.write_text(result)
        count = result.count(f'const {{ t }} = useTranslation("{ns}")') - src.count(f'const {{ t }} = useTranslation("{ns}")')
        return count
    return 0


pages_dir = ROOT
total = 0
for js in sorted(pages_dir.rglob("*.js")):
    rel = str(js.relative_to(ROOT.parent.parent))
    if "/api/" in rel:
        continue
    n = fix_file_v2(js)
    if n:
        print(f"  +{n} useTranslation injections in {rel}")
        total += n

print(f"\nTotal injections: {total}")
