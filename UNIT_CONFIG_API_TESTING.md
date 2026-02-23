# Unit Config API Testing Guide

## Prerequisites
- Backend running on `http://localhost:3001`
- Valid Bearer token for authorization
- A unit ID to test with

## API Endpoints

### 1. Get Unit Config (with cascade information)

**Endpoint**: `GET /units/{unitId}/config`

**Description**: Retrieves the effective configuration for a unit, showing the full cascade hierarchy from Org → Building → Unit.

**Authorization**: Requires `ROLE_ORG_VIEWER` or higher

**Example Request**:
```bash
curl -X GET "http://localhost:3001/units/550e8400-e29b-41d4-a716-446655440000/config" \
  -H "Authorization: Bearer <TOKEN>"
```

**Example Response (200 OK)**:
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
      "id": "550e8400-e29b-41d4-a716-446655440001",
      "orgId": "org-550e8400",
      "unitId": "550e8400-e29b-41d4-a716-446655440000",
      "autoApproveLimit": 400,
      "emergencyAutoDispatch": null,
      "requireOwnerApprovalAbove": null,
      "createdAt": "2026-02-11T17:38:38.000Z",
      "updatedAt": "2026-02-11T17:38:38.000Z"
    },
    "effectiveAutoApproveLimit": 400,
    "effectiveEmergencyAutoDispatch": true,
    "effectiveRequireOwnerApprovalAbove": 200
  }
}
```

**What This Shows**:
- `org`: Org-level defaults (fallback)
- `building`: Building-level overrides (if exist)
- `unit`: Unit-specific overrides (if exist)
- `effectiveAutoApproveLimit`: Final value after cascade (Unit 400 wins)
- `effectiveEmergencyAutoDispatch`: Building value (true) since unit is null
- `effectiveRequireOwnerApprovalAbove`: Org value (200) since building is null

---

### 2. Update/Create Unit Config

**Endpoint**: `PUT /units/{unitId}/config`

**Description**: Creates or updates unit-specific policy overrides. Any field can be omitted (will use building/org default).

**Authorization**: Requires `ROLE_GOVERNANCE` or higher (role-based access control)

**Request Body** (all fields optional):
```json
{
  "autoApproveLimit": 500,
  "emergencyAutoDispatch": false,
  "requireOwnerApprovalAbove": 1000
}
```

**Example Request**:
```bash
curl -X PUT "http://localhost:3001/units/550e8400-e29b-41d4-a716-446655440000/config" \
  -H "Authorization: Bearer <TOKEN>" \
  -H "Content-Type: application/json" \
  -d '{
    "autoApproveLimit": 500,
    "emergencyAutoDispatch": false
  }'
```

**Example Response (200 OK)**:
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
      "id": "550e8400-e29b-41d4-a716-446655440001",
      "orgId": "org-550e8400",
      "unitId": "550e8400-e29b-41d4-a716-446655440000",
      "autoApproveLimit": 500,
      "emergencyAutoDispatch": false,
      "requireOwnerApprovalAbove": null,
      "createdAt": "2026-02-11T17:38:38.000Z",
      "updatedAt": "2026-02-11T17:45:20.000Z"
    },
    "effectiveAutoApproveLimit": 500,
    "effectiveEmergencyAutoDispatch": false,
    "effectiveRequireOwnerApprovalAbove": 200
  }
}
```

**Partial Override Example**:
```bash
# Set only autoApproveLimit, keep emergencyAutoDispatch from building (true)
curl -X PUT "http://localhost:3001/units/550e8400-e29b-41d4-a716-446655440000/config" \
  -H "Authorization: Bearer <TOKEN>" \
  -H "Content-Type: application/json" \
  -d '{
    "autoApproveLimit": 600
  }'
```

**Validation Errors** (400 Bad Request):
```bash
# Too high
curl -X PUT "http://localhost:3001/units/550e8400-e29b-41d4-a716-446655440000/config" \
  -H "Authorization: Bearer <TOKEN>" \
  -H "Content-Type: application/json" \
  -d '{"autoApproveLimit": 999999}'

# Response:
{
  "error": "VALIDATION_ERROR",
  "message": "Invalid unit config",
  "details": {
    "fieldErrors": {
      "autoApproveLimit": ["autoApproveLimit must be <= 100000"]
    }
  }
}
```

---

### 3. Delete Unit Config (Revert to Building/Org)

**Endpoint**: `DELETE /units/{unitId}/config`

**Description**: Removes unit-specific overrides. The unit will now inherit from building/org defaults.

**Authorization**: Requires `ROLE_GOVERNANCE` or higher

**Example Request**:
```bash
curl -X DELETE "http://localhost:3001/units/550e8400-e29b-41d4-a716-446655440000/config" \
  -H "Authorization: Bearer <TOKEN>"
```

**Example Response (200 OK)** - After deletion, unit config is null:
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
    "unit": null,
    "effectiveAutoApproveLimit": 300,
    "effectiveEmergencyAutoDispatch": true,
    "effectiveRequireOwnerApprovalAbove": 200
  }
}
```

**Note**: effectiveAutoApproveLimit is now 300 (building level) instead of 500.

---

## Error Responses

### 404 Not Found
```bash
# Unit doesn't exist
curl -X GET "http://localhost:3001/units/nonexistent-uuid/config" \
  -H "Authorization: Bearer <TOKEN>"

# Response:
{
  "error": "NOT_FOUND",
  "message": "Unit not found"
}
```

### 403 Forbidden
```bash
# User doesn't have governance access
curl -X PUT "http://localhost:3001/units/550e8400-e29b-41d4-a716-446655440000/config" \
  -H "Authorization: Bearer <VIEWER_TOKEN>" \
  -H "Content-Type: application/json" \
  -d '{"autoApproveLimit": 500}'

# Response:
{
  "error": "UNAUTHORIZED",
  "message": "Insufficient permissions"
}
```

### 400 Validation Error
```bash
# Invalid input type
curl -X PUT "http://localhost:3001/units/550e8400-e29b-41d4-a716-446655440000/config" \
  -H "Authorization: Bearer <TOKEN>" \
  -H "Content-Type: application/json" \
  -d '{"autoApproveLimit": "not-a-number"}'

# Response:
{
  "error": "VALIDATION_ERROR",
  "message": "Invalid unit config",
  "details": {
    "fieldErrors": {
      "autoApproveLimit": ["Expected number, received string"]
    }
  }
}
```

---

## Testing Scenarios

### Scenario 1: Complete Cascade Override
```bash
# Org default: 200
# Building override: 300
# Unit override: 500
# Expected effective: 500 ✓

curl -X GET "http://localhost:3001/units/{unitId}/config" \
  -H "Authorization: Bearer <TOKEN>"
# Check effectiveAutoApproveLimit = 500
```

### Scenario 2: Partial Cascade (No Unit Override)
```bash
# Org default: 200
# Building override: 300
# Unit override: (none)
# Expected effective: 300 ✓

curl -X DELETE "http://localhost:3001/units/{unitId}/config" \
  -H "Authorization: Bearer <TOKEN>"

curl -X GET "http://localhost:3001/units/{unitId}/config" \
  -H "Authorization: Bearer <TOKEN>"
# Check effectiveAutoApproveLimit = 300
```

### Scenario 3: Fallback to Org
```bash
# Org default: 200
# Building override: (none)
# Unit override: (none)
# Expected effective: 200 ✓

# Unit in building without building config
curl -X GET "http://localhost:3001/units/{unitId2}/config" \
  -H "Authorization: Bearer <TOKEN>"
# Check building = null, effectiveAutoApproveLimit = 200
```

### Scenario 4: Approval Impact
```bash
# Request for unit with 450 CHF cost
# Unit limit: 500 → AUTO_APPROVED ✓
# Building limit: 300 → PENDING_REVIEW ✓
# Org limit: 200 → PENDING_REVIEW ✓

# New maintenance request should use unit config's effective limit
POST /requests
  category: "bathroom"
  estimatedCost: 450
  unitId: "550e8400-e29b-41d4-a716-446655440000"

# Response should show status: AUTO_APPROVED
```

---

## Integration with Request Approval

When a maintenance request is submitted for a unit, the approval engine:

1. Fetches the unit's effective config (calling `computeEffectiveUnitConfig`)
2. Uses the effective auto-approve limit to decide approval status
3. Cascade hierarchy ensures unit-specific policies take precedence

Example request submission:
```bash
curl -X POST "http://localhost:3001/requests" \
  -H "Authorization: Bearer <TOKEN>" \
  -H "Content-Type: application/json" \
  -d '{
    "description": "Fix leaky bathroom faucet",
    "category": "bathroom",
    "estimatedCost": 450,
    "unitId": "550e8400-e29b-41d4-a716-446655440000"
  }'

# Response (assuming unit config autoApproveLimit: 500):
{
  "data": {
    "id": "request-uuid",
    "status": "AUTO_APPROVED",  # ← Uses unit's effective limit
    "estimatedCost": 450,
    "unitId": "550e8400-e29b-41d4-a716-446655440000",
    ...
  }
}
```

---

## Notes

- **Read Access**: `ROLE_ORG_VIEWER` and above
- **Write Access**: `ROLE_GOVERNANCE` (role-based access control via `requireGovernanceAccess`)
- **All numeric fields**: Must be integers in range 0-100000 (CHF)
- **Cascade Logic**: Unit > Building > Org (first non-null value wins)
- **Deletion**: Removes unit config entirely, doesn't set fields to null
- **Database**: Uses PostgreSQL with Prisma ORM, cascade deletes ensure cleanup
