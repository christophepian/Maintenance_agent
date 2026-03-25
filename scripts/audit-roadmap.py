#!/usr/bin/env python3
"""Audit ROADMAP.json detection signals vs actual backend state."""
import json, os, re

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
os.chdir(ROOT)

SCHEMA = open("apps/api/prisma/schema.prisma").read()
WORKFLOWS = os.listdir("apps/api/src/workflows") if os.path.isdir("apps/api/src/workflows") else []
SERVICES = os.listdir("apps/api/src/services") if os.path.isdir("apps/api/src/services") else []

models = set(re.findall(r'^model\s+(\w+)', SCHEMA, re.M))
enums = set(re.findall(r'^enum\s+(\w+)', SCHEMA, re.M))
wf = {f.replace('.ts','') for f in WORKFLOWS if f.endswith('.ts')}

env_keys = set()
for env_file in ['.env', '.env.local', '.env.production']:
    try:
        for line in open(env_file):
            m = re.match(r'^([A-Z_][A-Z0-9_]*)=', line)
            if m:
                env_keys.add(m.group(1))
    except FileNotFoundError:
        pass

with open('ROADMAP.json') as f:
    roadmap = json.load(f)

def check_signal(sig):
    t = sig.get('type', '')
    v = sig.get('value') or sig.get('path') or sig.get('name') or sig.get('key') or sig.get('field') or ''
    if t in ('file_exists', 'page_exists'):
        p = sig.get('path') or v
        return os.path.exists(p), f"{t}: {p}"
    elif t == 'model_exists':
        n = sig.get('name') or v
        return n in models, f"model_exists: {n}"
    elif t == 'model_field':
        fld = sig.get('field') or ''
        mdl = sig.get('model') or ''
        if not fld and '.' in v:
            mdl, fld = v.split('.', 1)
        if mdl:
            ok = bool(re.search(rf'model\s+{mdl}\s*\{{[^}}]*{fld}', SCHEMA, re.M | re.S))
        else:
            ok = fld in SCHEMA
        return ok, f"model_field: {mdl}.{fld}"
    elif t == 'enum_exists':
        n = sig.get('name') or v
        return n in enums, f"enum_exists: {n}"
    elif t == 'workflow_exists':
        n = sig.get('name') or v
        return n in wf, f"workflow_exists: {n}"
    elif t == 'env_key':
        k = sig.get('key') or v
        return k in env_keys, f"env_key: {k}"
    return False, f"unknown: {t}"

print("=" * 70)
print("ROADMAP vs BACKEND AUDIT")
print("=" * 70)

mismatches = []

for feat in roadmap.get('features', []):
    det = feat.get('detection', {})
    checks = det.get('checks', [])
    title = feat.get('title', '')[:55]
    slices = feat.get('slices', [])

    # Feature-level checks
    feat_results = [check_signal(c) for c in checks]
    feat_pass = sum(1 for ok, _ in feat_results if ok)
    feat_total = len(feat_results)
    if feat_total > 0:
        feat_status = 'done' if feat_pass == feat_total else ('in_progress' if feat_pass > 0 else 'planned')
    else:
        feat_status = 'no-checks'

    print(f"\n{feat['id']}: {title}")
    print(f"  Feature detection: {feat_pass}/{feat_total} -> {feat_status}")
    for ok, desc in feat_results:
        print(f"    {'V' if ok else 'X'} {desc}")

    # Slices
    for s in slices:
        sigs = s.get('completion_signals', [])
        manual = s.get('status', 'planned')
        sig_results = [check_signal(sig) for sig in sigs]
        passed = sum(1 for ok, _ in sig_results if ok)
        total = len(sig_results)

        if total > 0:
            computed = 'done' if passed == total else ('in_progress' if passed > 0 else 'planned')
        else:
            computed = manual

        flag = ''
        if manual == 'done' and computed != 'done' and total > 0:
            flag = ' !! STALE: manual=done but signals=' + computed
            mismatches.append(f"{s['id']}: manual=done but signals={computed}")
        elif manual != 'done' and computed == 'done' and total > 0:
            flag = ' !! BEHIND: signals=done but manual=' + manual
            mismatches.append(f"{s['id']}: signals=done but manual={manual}")

        print(f"  Slice {s['id']}: manual={manual} computed={computed}{flag}")
        for ok, desc in sig_results:
            print(f"    {'V' if ok else 'X'} {desc}")

print("\n" + "=" * 70)
print("EXISTING BACKEND FILES (for reference)")
print("=" * 70)
print(f"  Services: {len([s for s in SERVICES if s.endswith('.ts')])} files")
print(f"  Workflows: {len([w for w in WORKFLOWS if w.endswith('.ts')])} files")
print(f"  Models: {len(models)}, Enums: {len(enums)}, Migrations: {len(os.listdir('apps/api/prisma/migrations'))}")
print(f"  Env keys: {sorted(env_keys) if env_keys else '(none found)'}")

if mismatches:
    print("\n" + "=" * 70)
    print(f"MISMATCHES FOUND: {len(mismatches)}")
    print("=" * 70)
    for m in mismatches:
        print(f"  !! {m}")
else:
    print("\n  No mismatches between manual status and signal detection.")
