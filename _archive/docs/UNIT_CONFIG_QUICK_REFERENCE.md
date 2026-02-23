# Unit Config - Quick Reference

## What It Does
Allows setting approval policies at the **Unit level** (individual rooms/apartments), with automatic cascade from Org → Building → Unit.

## Cascade Example
```
Request for Unit "Apartment 101":

1. Check Unit 101 config
   ├─ autoApproveLimit: 500 ✓ FOUND
   ├─ emergencyAutoDispatch: null (not set)
   │
   └─ Check Building "Main Building" config
      ├─ emergencyAutoDispatch: true ✓ FOUND
      ├─ requireOwnerApprovalAbove: null (not set)
      │
      └─ Check Org "MyOrg" config
         └─ requireOwnerApprovalAbove: 200 ✓ FOUND

RESULT: effectiveAutoApproveLimit = 500 (Unit)
        effectiveEmergencyAutoDispatch = true (Building)
        effectiveRequireOwnerApprovalAbove = 200 (Org)
```

## API Endpoints (3 total)

### GET /units/{id}/config
Fetch unit policies with full cascade information
```bash
curl http://localhost:3001/units/{id}/config -H "Authorization: Bearer TOKEN"
```
**Returns**: Full cascade showing org/building/unit values + effective values

### PUT /units/{id}/config
Create/update unit-specific policies
```bash
curl -X PUT http://localhost:3001/units/{id}/config \
  -H "Authorization: Bearer TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"autoApproveLimit": 500}'
```
**Returns**: Updated effective config

### DELETE /units/{id}/config
Delete unit policies (reverts to building/org)
```bash
curl -X DELETE http://localhost:3001/units/{id}/config \
  -H "Authorization: Bearer TOKEN"
```
**Returns**: Effective config now using building/org values

## Database Schema
```prisma
model UnitConfig {
  id                        String    @id @default(uuid())
  orgId                     String
  unitId                    String    @unique
  autoApproveLimit          Int?      // CHF, 0-100000
  emergencyAutoDispatch     Boolean?
  requireOwnerApprovalAbove Int?      // CHF, 0-100000
  createdAt                 DateTime
  updatedAt                 DateTime
  
  org  Org  @relation(...)
  unit Unit @relation(...)
}
```

## Integration Points

### 1. Approval Decision
Request creation now checks unit config:
```typescript
const approval = await decideRequestStatusWithRules(
  prisma, orgId,
  { category, estimatedCost, unitType, buildingId, unitId },
  defaultLimit,
  unitId  // ← New parameter
);
// approval.status uses unit's effective limit
```

### 2. Server Routes
Added to `apps/api/src/server.ts`:
- Route matcher: `matchUnitConfig(path)` 
- Endpoints: GET, PUT, DELETE with authorization

### 3. Service Layer
New file: `apps/api/src/services/unitConfig.ts`
- `getUnitConfig()`
- `upsertUnitConfig()`
- `deleteUnitConfig()`
- `computeEffectiveUnitConfig()` ← Main cascade logic

## Files Changed

| File | Change |
|------|--------|
| schema.prisma | Added `UnitConfig` model + relations |
| server.ts | Added 3 endpoints + matcher |
| autoApproval.ts | Updated approval logic to use unit config |
| unitConfig.ts | NEW - Service layer |
| unitConfig.ts | NEW - Validation schema |
| unitConfig.cascade.test.ts | NEW - Test suite |

## Migration
```bash
# Applied automatically
20260211163838_add_unit_config
```

## Authorization

| Operation | Required Role |
|-----------|---------------|
| GET | ROLE_ORG_VIEWER + |
| PUT | ROLE_GOVERNANCE |
| DELETE | ROLE_GOVERNANCE |

## Validation
- `autoApproveLimit`: integer, 0-100000 or null
- `emergencyAutoDispatch`: boolean or null
- `requireOwnerApprovalAbove`: integer, 0-100000 or null

## Key Points
- ✅ All fields are optional (null = inherit from parent)
- ✅ Deleting unit config = reverting to building/org (not setting to null)
- ✅ Unit > Building > Org (first non-null wins)
- ✅ Backward compatible (existing building policies still work)
- ✅ Type-safe TypeScript implementation
- ✅ Full cascade info returned in every response

## Testing
```bash
npm test -- unitConfig.cascade.test.ts
```

## Example Response (GET /units/{id}/config)
```json
{
  "data": {
    "org": { "autoApproveLimit": 200 },
    "building": { "autoApproveLimit": 300, "emergencyAutoDispatch": true },
    "unit": { "autoApproveLimit": 500, "emergencyAutoDispatch": null, ... },
    "effectiveAutoApproveLimit": 500,
    "effectiveEmergencyAutoDispatch": true,
    "effectiveRequireOwnerApprovalAbove": 200
  }
}
```

## Common Use Cases

### 1. Set Unit Auto-Approve Higher
```json
{ "autoApproveLimit": 800 }  // vs building's 300
```

### 2. Emergency Dispatch for Specific Unit
```json
{ "emergencyAutoDispatch": true }  // vs building's false
```

### 3. Strict Mode for Premium Units
```json
{ "autoApproveLimit": 100 }  // Requires more approvals
```

### 4. Clear Override (Revert)
```
DELETE /units/{id}/config
```

---

**Status**: ✅ Production Ready | **Created**: 2026-02-11 | **Last Updated**: 2026-02-11
