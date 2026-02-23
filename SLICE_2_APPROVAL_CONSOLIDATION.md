# Slice 2: Approval Rules Consolidation

## Problem Statement

There are currently **two separate approval systems** that accomplish similar goals:

1. **Org-Level Auto-Approval** (`OrgConfig.autoApproveLimit`)
2. **Building-Level Approval Rules** (`ApprovalRule` model)

Both auto-approve requests based on conditions, creating confusion and code redundancy.

## Current Systems

### System 1: Org-Level Auto-Approval (Slice 8.1)
**Location:** `apps/api/src/services/requests.ts` → `decideRequestStatus()`

**Scope:** Organization-wide
- Threshold: `OrgConfig.autoApproveLimit` (default 200 CHF)
- Logic: If `request.estimatedCost <= autoApproveLimit` → AUTO_APPROVED
- Simple binary decision based on cost only

**Database Model:**
```prisma
model OrgConfig {
  autoApproveLimit Int @default(200) // CHF
}
```

**Implementation:**
```typescript
function decideRequestStatus(estimatedCost: number, orgAutoApproveLimit: number) {
  return estimatedCost <= orgAutoApproveLimit ? "AUTO_APPROVED" : "PENDING_REVIEW";
}
```

### System 2: Building-Level Approval Rules (Earlier implementation)
**Location:** `apps/api/src/services/approvalRules.ts`

**Scope:** Per-building (optional) and per-org
- Conditions: Complex JSON-based rules
- Actions: Multiple possible actions (not just approve)
- Priority-based evaluation
- Can override org-level settings

**Database Model:**
```prisma
model ApprovalRule {
  id         String
  orgId      String
  buildingId String?        // NULL = org-wide, value = building-specific
  name       String
  priority   Int            // Lower = higher priority
  isActive   Boolean
  conditions String         // JSON: RuleCondition[]
  action     RuleAction     // APPROVE, REJECT, etc.
  createdAt  DateTime
}

model Building {
  approvalRules ApprovalRule[]
}
```

**Features:**
- Multiple conditions (category, cost, unitType, etc.)
- Priority-based evaluation (first match wins)
- Building-specific or org-wide scope
- More extensible for complex business rules

## The Redundancy Problem

| Aspect | autoApproveLimit | ApprovalRules |
|--------|------------------|---------------|
| Scope | Org-wide only | Org or Building |
| Condition | Cost threshold | Multiple conditions |
| Extensibility | Low | High |
| UI Support | Simple threshold | Complex rules UI |
| Current Usage | ✅ Active (Slice 8.1) | ⚠️ Exists but underutilized |

### Example Conflict
If org has `autoApproveLimit = 200 CHF` AND a building rule "auto-approve all dishwasher repairs regardless of cost":
- System 1 would reject a 500 CHF dishwasher repair
- System 2 would approve it (per building rule)
- **Unclear which takes precedence**

## Impact Assessment

### Affected Code
- `apps/api/src/services/requests.ts` → `decideRequestStatus()`
- `apps/api/src/services/approvalRules.ts` → Rule evaluation logic
- `apps/api/src/server.ts` → Both endpoints/handlers
- `apps/api/src/validation/approvalRules.ts` → Zod schemas
- `apps/web/pages/manager/work-requests.js` → UI for thresholds
- `apps/web/pages/admin-inventory.js` → UI for building policies
- Database migrations (would need compatibility migration)

### Test Coverage
- `apps/api/src/__tests__/requests.test.ts` - Tests for auto-approval
- `apps/api/src/__tests__/approvalRules.test.ts` - Tests for rules (if exists)

## Recommended Solution: Option A (Preferred)

**Deprecate `autoApproveLimit` - Use ApprovalRules only**

### Rationale
1. **ApprovalRules are more powerful** - covers all use cases of autoApproveLimit
2. **Single source of truth** - one approval system to maintain
3. **Better flexibility** - allows per-building or org-wide rules
4. **More granular control** - conditions beyond just cost

### Implementation Steps

**Phase 1: Migration (in Slice 2)**
1. Create migration to convert existing `autoApproveLimit` values → ApprovalRule entries
   - For each org with autoApproveLimit, create a default rule:
     - `name: "Default Cost Threshold"`
     - `buildingId: NULL` (org-wide)
     - `priority: 1000` (lowest, evaluated last)
     - `condition: { type: "costThreshold", value: autoApproveLimit }`
     - `action: "APPROVE"`

2. Update `decideRequestStatus()` to use ApprovalRules instead of autoApproveLimit

3. Mark `OrgConfig.autoApproveLimit` as deprecated (keep for backward compatibility for 1 release)

**Phase 2: UI Consolidation**
1. Remove "Auto-approval threshold" from work-requests page
2. Redirect users to building policies for approval rules management
3. Show org-wide default rules on org config page

**Phase 3: Cleanup**
1. Remove `autoApproveLimit` column from database (1 release after Phase 1)
2. Remove legacy code paths

### Migration SQL Example
```sql
INSERT INTO ApprovalRule (id, orgId, buildingId, name, priority, isActive, conditions, action, createdAt)
SELECT 
  uuid_generate_v4(),
  oc.orgId,
  NULL,
  'Default Cost Threshold (Migrated)',
  1000,
  true,
  jsonb_build_object(
    'type', 'costThreshold',
    'value', oc.autoApproveLimit
  )::text,
  'APPROVE',
  NOW()
FROM OrgConfig oc
WHERE oc.autoApproveLimit IS NOT NULL;
```

## Alternative Solutions

### Option B: Hybrid Approach (ApprovalRules as primary, autoApproveLimit as fallback)
- Keep both systems
- ApprovalRules evaluated first
- autoApproveLimit used only if no rules match
- **Pros:** No data migration needed
- **Cons:** More code, complexity, potential bugs

### Option C: Keep Separate (Status Quo)
- Maintain both systems independently
- **Pros:** No refactoring needed
- **Cons:** Technical debt increases, confusion for users

## Recommendation

**Implement Option A in Slice 2** - Full consolidation to ApprovalRules

**Timeline:** 3 sprints
- Sprint 1: Migration + code changes
- Sprint 2: UI consolidation + testing
- Sprint 3: Deprecation period + cleanup

**Effort:** Medium (2-3 developer weeks)

**Risk:** Low (clear migration path, backward compatible)

## Acceptance Criteria

- [ ] All existing `autoApproveLimit` values migrated to ApprovalRules
- [ ] `decideRequestStatus()` uses ApprovalRules exclusively
- [ ] All tests passing with new logic
- [ ] UI shows consolidated approval management (no duplicate threshold settings)
- [ ] Migration script tested on staging database
- [ ] User documentation updated
- [ ] Backward compatibility warning in release notes

## Related Files

**Backend Services:**
- [approvalRules.ts](../../apps/api/src/services/approvalRules.ts)
- [requests.ts](../../apps/api/src/services/requests.ts)
- [approvalRules validation](../../apps/api/src/validation/approvalRules.ts)

**Database:**
- [schema.prisma](../../apps/api/prisma/schema.prisma) - ApprovalRule & OrgConfig models

**API Endpoints:**
- `GET /approval-rules` - List rules
- `POST /approval-rules` - Create rule
- `PUT /approval-rules/:id` - Update rule
- `DELETE /approval-rules/:id` - Delete rule

**Frontend:**
- [work-requests.js](../../apps/web/pages/manager/work-requests.js) - Current threshold UI
- [admin-inventory.js](../../apps/web/pages/admin-inventory.js) - Building policies UI
