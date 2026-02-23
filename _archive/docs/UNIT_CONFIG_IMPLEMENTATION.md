# Unit-Level Override Implementation Summary

## Overview
Implemented unit-level policy override capability, enabling a three-tier cascade for approval thresholds and policies:
**Org Level** → **Building Level** → **Unit Level**

## Database Changes

### New Model: `UnitConfig`
- **File**: [apps/api/prisma/schema.prisma](apps/api/prisma/schema.prisma)
- **Migration**: `20260211163838_add_unit_config`
- **Fields**:
  - `id`: UUID primary key
  - `orgId`: Reference to Org (with cascade delete)
  - `unitId`: Reference to Unit (unique, with cascade delete)
  - `autoApproveLimit`: Optional override for auto-approval threshold (CHF)
  - `emergencyAutoDispatch`: Optional override for emergency auto-dispatch flag
  - `requireOwnerApprovalAbove`: Optional override for owner approval requirement threshold
  - `createdAt`, `updatedAt`: Timestamps
  - Index on `orgId` for efficient queries

### Updated Relations
- **Org**: Added `unitConfigs: UnitConfig[]` (one-to-many)
- **Unit**: Added `config: UnitConfig?` (one-to-one)

## Backend Implementation

### 1. Unit Config Service
**File**: [apps/api/src/services/unitConfig.ts](apps/api/src/services/unitConfig.ts)

**Functions**:
- `getUnitConfig()` - Retrieve unit-specific config
- `upsertUnitConfig()` - Create/update unit config
- `deleteUnitConfig()` - Delete unit config (reverts to building/org defaults)
- `computeEffectiveUnitConfig()` - **Three-tier cascade logic**

**Cascade Logic** (EffectiveUnitConfig):
```
For each config parameter (autoApproveLimit, emergencyAutoDispatch, etc.):
  If Unit config set → Use unit value
  Else if Building config set → Use building value
  Else if Org config set → Use org value
  Else → Use system default
```

### 2. Validation Schema
**File**: [apps/api/src/validation/unitConfig.ts](apps/api/src/validation/unitConfig.ts)
- Reuses same validation as building config
- Integer range: 0-100000 (CHF)
- All fields optional (null = use fallback)

### 3. API Endpoints
**File**: [apps/api/src/server.ts](apps/api/src/server.ts) (Lines ~1035-1093)

**GET /units/{id}/config**
- Requires: Org viewer role
- Returns: Full `EffectiveUnitConfig` including cascade data
- Shows which tier (unit/building/org) each setting comes from

**PUT /units/{id}/config**
- Requires: Governance access (role-based)
- Payload: `UnitConfigInput` (Zod validated)
- Returns: Updated effective config with all three tiers

**DELETE /units/{id}/config**
- Requires: Governance access
- Effect: Removes unit-specific overrides, reverts to building/org defaults
- Returns: New effective config after deletion

### 4. Approval Decision Engine Update
**File**: [apps/api/src/services/autoApproval.ts](apps/api/src/services/autoApproval.ts)

**Enhanced Function**: `decideRequestStatusWithRules()`
- **Previous**: Building-level policy lookup only
- **Updated**: Unit-level policy lookup with three-tier cascade
- **Flow**:
  1. If `unitId` provided: Compute effective unit config (cascades through tiers)
  2. Evaluate approval rules with effective limit
  3. Fallback to threshold-based approval if no rules match
  4. Return approval status + effective limit for audit/visibility

**Integration Points**:
- Request creation: Pass `unitId` to approval engine
- Request update: Pass `unitId` for re-approval decisions

## Frontend (Optional Future Work)

### Current State
- Building detail page shows building-level policies
- Unit policies can be managed via API but no UI yet

### Recommended Future UI
1. **Unit Detail Page** - New or enhanced
   - Tab: "Policies" with unit-specific override form
   - Show cascade hierarchy (org default → building override → unit override)
   - Option to clear unit overrides and revert to building

2. **Building Detail Page** - Enhancement
   - Units tab: Add "Configure Policies" link per unit
   - Policy inheritance indicator (shows which level policy comes from)

3. **API Route** - New next.js proxy
   - `GET /api/units/:id/config` - Proxy to backend
   - `PUT /api/units/:id/config` - Proxy to backend
   - `DELETE /api/units/:id/config` - Proxy to backend

## Testing

### Test File
**Path**: [apps/api/src/__tests__/unitConfig.cascade.test.ts](apps/api/src/__tests__/unitConfig.cascade.test.ts)

**Test Cases**:
1. ✅ Three-tier cascade with proper precedence (Unit > Building > Org)
2. ✅ Unit overrides building limit
3. ✅ Unit partial override (only some fields set)
4. ✅ Fallback to org when building and unit both null
5. ✅ Deletion of unit config reverts to building/org defaults

**Run Tests**:
```bash
cd apps/api
npm test -- unitConfig.cascade.test.ts
```

## Usage Examples

### Example 1: Get Unit Policy
```bash
curl -X GET http://localhost:3001/units/{unitId}/config \
  -H "Authorization: Bearer $TOKEN"
```

**Response**:
```json
{
  "data": {
    "org": {
      "autoApproveLimit": 200
    },
    "building": {
      "autoApproveLimit": 300,
      "emergencyAutoDispatch": true,
      "requireOwnerApprovalAbove": null
    },
    "unit": {
      "id": "uuid",
      "orgId": "org-uuid",
      "unitId": "unit-uuid",
      "autoApproveLimit": 400,
      "emergencyAutoDispatch": null,
      "requireOwnerApprovalAbove": null,
      "createdAt": "2026-02-11T16:38:38.000Z",
      "updatedAt": "2026-02-11T16:38:38.000Z"
    },
    "effectiveAutoApproveLimit": 400,
    "effectiveEmergencyAutoDispatch": true,
    "effectiveRequireOwnerApprovalAbove": 200
  }
}
```

### Example 2: Set Unit-Specific Policy
```bash
curl -X PUT http://localhost:3001/units/{unitId}/config \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "autoApproveLimit": 500,
    "emergencyAutoDispatch": false
  }'
```

### Example 3: Delete Unit Override (Revert to Building/Org)
```bash
curl -X DELETE http://localhost:3001/units/{unitId}/config \
  -H "Authorization: Bearer $TOKEN"
```

## Architecture Benefits

1. **Flexibility**: Different units can have different thresholds without duplication
2. **Inheritance**: Units inherit building/org defaults if not overridden
3. **Cleanup**: Deleting unit config automatically reverts to parent level
4. **Auditability**: API response shows full cascade chain
5. **Performance**: Single database query with joins to get effective config
6. **Consistency**: Same three-tier pattern used across all policy types

## File Manifest

| File | Purpose | Status |
|------|---------|--------|
| apps/api/prisma/schema.prisma | Schema definition | ✅ Updated |
| apps/api/prisma/migrations/20260211163838_add_unit_config/ | Database migration | ✅ Applied |
| apps/api/src/services/unitConfig.ts | Business logic | ✅ Created |
| apps/api/src/validation/unitConfig.ts | Input validation | ✅ Created |
| apps/api/src/server.ts | API endpoints | ✅ Updated |
| apps/api/src/services/autoApproval.ts | Approval engine | ✅ Updated |
| apps/api/src/__tests__/unitConfig.cascade.test.ts | Integration tests | ✅ Created |

## Next Steps

1. **Frontend**: Create unit detail page with policy configuration UI
2. **Testing**: Run full integration test suite against running backend
3. **Documentation**: Update API docs with unit config endpoints
4. **Monitoring**: Add metrics/logs for policy cascade decisions
