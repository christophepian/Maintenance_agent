#!/usr/bin/env python3
"""
Deduplicate ROADMAP.json — 2026-04-04

Rules:
1. Promoted intake items whose draft ticket is the canonical version → close intake as "promoted_to_draft"
2. Promoted intake items whose draft is already done → close intake as "done"  
3. Explicit duplicate_of items → close as "discarded"
4. FIN-COA sub-story fragments (INT-056/057/063/067/069/081/096/099) → close as done (FIN-COA is implemented)
5. INT-108 duplicate of INT-050 → discard
6. INT-078 duplicate of INT-075 → discard
7. INT-110 same as DT-110..113 (test helpers) → close intake, keep drafts
8. INT-113 "Next stories 25.03.26" — empty capture, discard
9. INT-109 same as audit item API-03 → keep as-is (actionable)
10. INT-111 "Building financial summary API" — check if it maps to INT-033/DT-013
11. TASK-003 "Automatic Monthly Rent Invoice Generation" — recurring billing is done → close
12. INT-050 has DT-114 → close intake, keep draft
13. INT-051 epic wrapper for FIN-COA → close (FIN-COA done)
14. DT-025 — INT-016 and INT-031 are done, only INT-017 residual remains → update DT-025 scope
15. INT-015 "Expected monthly rent widget link" — check if done via INT-014 widget clickability
"""
import json

ROADMAP = '/Users/christophepian/Documents/Maintenance_Agent/ROADMAP.json'

with open(ROADMAP) as f:
    data = json.load(f)

changes = []

# --- Helper ---
def close_intake(iid, status, note):
    for item in data['intake_items']:
        if item['id'] == iid:
            old = item.get('status', '?')
            if old in ('done', 'discarded'):
                return  # already closed
            item['status'] = status
            item['resolved_date'] = '2026-04-04'
            item['resolution_note'] = note
            changes.append(f"  {iid}: {old} -> {status} | {note[:70]}")
            return

def close_backlog(tid, note):
    for item in data['custom_items']:
        if item['id'] == tid:
            old = item.get('status', '?')
            item['status'] = 'done'
            item['resolved_date'] = '2026-04-04'
            item['resolution_note'] = note
            changes.append(f"  {tid}: {old} -> done | {note[:70]}")
            return

# === 1. Promoted intake with active draft → close intake as promoted_to_draft ===
promoted_with_active_draft = {
    'INT-001': 'DT-016/DT-017',
    'INT-002': 'DT-022/DT-023',
    'INT-004': 'DT-020',
    'INT-005': 'DT-021',
    'INT-033': 'DT-013',
    'INT-034': 'DT-001',
    'INT-035': 'DT-002',
    'INT-036': 'DT-003',
    'INT-037': 'DT-004',
    'INT-038': 'DT-005',
    'INT-039': 'DT-006',
    'INT-040': 'DT-007',
    'INT-041': 'DT-008',
    'INT-043': 'DT-009',
    'INT-044': 'DT-014',
    'INT-045': 'DT-010',
    'INT-046': 'DT-011',
    'INT-047': 'DT-015',
    'INT-048': 'DT-012',
}

for iid, dts in promoted_with_active_draft.items():
    close_intake(iid, 'done', f'Promoted to draft {dts} — intake is redundant')

# === 2. Promoted intake whose drafts are all done → close intake ===
fin_coa_done_intake = ['INT-051', 'INT-075', 'INT-098', 'INT-100', 'INT-102', 'INT-104']
for iid in fin_coa_done_intake:
    close_intake(iid, 'done', 'FIN-COA epic fully implemented — draft ticket is done')

# === 3. Explicit duplicates ===
close_intake('INT-078', 'discarded', 'Duplicate of INT-075 (FIN-COA-01)')
close_intake('INT-108', 'discarded', 'Duplicate of INT-050 (Tax Statement)')

# === 4. FIN-COA sub-story fragments — all done ===
fin_coa_fragments = {
    'INT-056': 'FIN-COA fragment (ExpenseType schema) — implemented in FIN-COA epic',
    'INT-057': 'FIN-COA fragment (Account schema) — implemented in FIN-COA epic',
    'INT-063': 'FIN-COA story 2 (account structure) — implemented in FIN-COA epic',
    'INT-067': 'FIN-COA story 4 (invoice integration) — implemented in FIN-COA epic',
    'INT-069': 'FIN-COA story 5 (lease/service expense) — implemented in FIN-COA epic',
    'INT-081': 'FIN-COA epic description (accounting config layer) — implemented',
    'INT-096': 'FIN-COA cross-cutting concern (OpenAPI/DTO/tests together) — done',
    'INT-099': 'FIN-COA invoice DTO extension for expenseTypeId/accountId — done',
}
for iid, note in fin_coa_fragments.items():
    close_intake(iid, 'done', note)

# === 5. INT-110 same as DT-110 test helpers → close intake ===
close_intake('INT-110', 'done', 'Promoted to DT-110..113 (test helper slices)')

# === 6. INT-050 has DT-114 → close intake ===
close_intake('INT-050', 'done', 'Promoted to DT-114 (Tax Statement Journey)')

# === 7. INT-113 empty capture "Next stories" → discard ===
close_intake('INT-113', 'discarded', 'Empty capture note "Next stories 25.03.26" — no actionable content')

# === 8. TASK-003 recurring billing → done ===
close_backlog('TASK-003', 'Recurring billing engine fully implemented (recurringBillingService.ts)')

# === 9. INT-017 "inactive review button" — keep (residual of DT-025) ===
# Already promoted, leave as-is — it feeds DT-025

# === 10. INT-111 "Building financial summary API" — keep if unique ===
# This is a prompted task for building-level financial summary. DT-013 is owner dashboard.
# They're different — keep INT-111

# === 11. INT-015 "Expected monthly rent widget link" ===
# INT-014 (clickable widgets) was closed as done, but INT-015 specifically asks
# about linking to DETAILS of the expected rent calculation. Different scope — keep.

print(f"Applied {len(changes)} dedup changes:")
for c in changes:
    print(c)

# === Final counts ===
active_intake = [i for i in data['intake_items'] if i.get('status') not in ('done', 'discarded')]
active_drafts = [d for d in data['draft_tickets'] if d.get('status') not in ('done', 'discarded')]
active_backlog = [t for t in data['custom_items'] if t.get('status') not in ('done', 'discarded')]
total = len(active_backlog) + len(active_drafts) + len(active_intake)

print(f"\nRemaining active: {len(active_backlog)} backlog + {len(active_drafts)} drafts + {len(active_intake)} intake = {total} total")

# List what remains
print("\n=== REMAINING BACKLOG ===")
for t in active_backlog:
    print(f"  {t['id']} | {t['title'][:90]}")

print("\n=== REMAINING DRAFTS ===")
for d in active_drafts:
    print(f"  {d['id']} | {d.get('status'):10} | {d['title'][:90]}")

print("\n=== REMAINING INTAKE ===")
for i in active_intake:
    title = (i.get('title') or i.get('raw_text') or '(empty)')[:90]
    print(f"  {i['id']} | {i.get('status'):10} | {title}")

with open(ROADMAP, 'w') as f:
    json.dump(data, f, indent=2, ensure_ascii=False)
    f.write('\n')

print("\nROADMAP.json updated.")
