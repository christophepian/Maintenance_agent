# Unit Number Matching in Approval Rules

## Overview
Approval rules can now match on unit numbers in addition to unit types. This allows you to create rules specific to certain apartments or rooms.

## New Field: UNIT_NUMBER

The `UNIT_NUMBER` field enables pattern matching on unit numbers.

## Available Operators for Unit Numbers

| Operator | Description | Example | Matches |
|----------|-------------|---------|---------|
| **EQUALS** | Exact match | "101" | Unit 101 only |
| **NOT_EQUALS** | Not equal to | "101" | Any unit except 101 |
| **CONTAINS** | Contains substring | "1" | Units 101, 110, 210, 311, etc. |
| **STARTS_WITH** | Starts with prefix | "1" | Units 101, 102, 103, 110, etc. |
| **ENDS_WITH** | Ends with suffix | "01" | Units 101, 201, 301, 401, etc. |

## Use Cases

### 1. Higher Approval Threshold for Premium Units
```json
{
  "name": "Premium Units Higher Threshold",
  "buildingId": "building-123",
  "conditions": [
    {
      "field": "UNIT_NUMBER",
      "operator": "STARTS_WITH",
      "value": "5"
    },
    {
      "field": "ESTIMATED_COST",
      "operator": "LESS_THAN_OR_EQUAL",
      "value": 1000
    }
  ],
  "action": "AUTO_APPROVE"
}
```
**Effect**: Auto-approve maintenance ≤ $1000 for units starting with "5" (500+, typically higher floors)

### 2. Different Rules for Specific Unit
```json
{
  "name": "Penthouse Special Handling",
  "buildingId": "building-123",
  "conditions": [
    {
      "field": "UNIT_NUMBER",
      "operator": "EQUALS",
      "value": "1001"
    }
  ],
  "action": "REQUIRE_OWNER_APPROVAL"
}
```
**Effect**: Always require owner approval for penthouse unit 1001

### 3. Exclude Certain Units from Auto-Approval
```json
{
  "name": "Common Areas Need Review",
  "buildingId": "building-123",
  "conditions": [
    {
      "field": "UNIT_NUMBER",
      "operator": "CONTAINS",
      "value": "COMMON"
    }
  ],
  "action": "REQUIRE_MANAGER_REVIEW"
}
```
**Effect**: Always require manager review for common areas

### 4. Combine Multiple Conditions
```json
{
  "name": "Luxury Units High Costs",
  "buildingId": "building-123",
  "conditions": [
    {
      "field": "UNIT_NUMBER",
      "operator": "STARTS_WITH",
      "value": "9"
    },
    {
      "field": "ESTIMATED_COST",
      "operator": "GREATER_THAN_OR_EQUAL",
      "value": 500
    }
  ],
  "action": "REQUIRE_OWNER_APPROVAL"
}
```
**Effect**: Require owner approval for maintenance ≥ $500 in units 900-999

## API Examples

### Create Rule with Unit Number Matching

```bash
curl -X POST http://localhost:3001/approval-rules \
  -H "Authorization: Bearer TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Units 101-110 Auto-Approve",
    "buildingId": "building-xyz",
    "priority": 10,
    "conditions": [
      {
        "field": "UNIT_NUMBER",
        "operator": "STARTS_WITH",
        "value": "10"
      },
      {
        "field": "ESTIMATED_COST",
        "operator": "LESS_THAN_OR_EQUAL",
        "value": 500
      }
    ],
    "action": "AUTO_APPROVE"
  }'
```

### Get All Rules for Building

```bash
curl -X GET "http://localhost:3001/approval-rules?buildingId=building-xyz" \
  -H "Authorization: Bearer TOKEN"
```

Response shows all rules including those with unit number conditions.

## Matching Examples

Given units: 101, 102, 110, 201, 210, COMMON-LOBBY, PARKING-B1

### EQUALS "101"
✅ Matches: 101  
❌ Does NOT match: 102, 110, 201, COMMON-LOBBY

### NOT_EQUALS "101"
✅ Matches: 102, 110, 201, 210, COMMON-LOBBY, PARKING-B1  
❌ Does NOT match: 101

### CONTAINS "1"
✅ Matches: 101, 102, 110, 201, 210, COMMON-LOBBY  
❌ Does NOT match: PARKING-B1

### STARTS_WITH "1"
✅ Matches: 101, 102, 110  
❌ Does NOT match: 201, 210, COMMON-LOBBY, PARKING-B1

### STARTS_WITH "10"
✅ Matches: 101, 102, 110  
❌ Does NOT match: 201, COMMON-LOBBY, PARKING-B1

### ENDS_WITH "01"
✅ Matches: 101, 201  
❌ Does NOT match: 102, 110, 210, COMMON-LOBBY, PARKING-B1

## Combined Conditions

When a rule has BOTH unit number and type conditions:
```json
{
  "conditions": [
    {
      "field": "UNIT_NUMBER",
      "operator": "STARTS_WITH",
      "value": "2"
    },
    {
      "field": "UNIT_TYPE",
      "operator": "EQUALS",
      "value": "RESIDENTIAL"
    },
    {
      "field": "CATEGORY",
      "operator": "EQUALS",
      "value": "bathroom"
    }
  ],
  "action": "AUTO_APPROVE"
}
```
**Logic**: ALL conditions must match for the rule to apply
- Unit number starts with "2" (floors 2xx)
- AND unit type is RESIDENTIAL
- AND maintenance category is "bathroom"

## Priority and Precedence

Rules are evaluated in priority order (highest first). The first matching rule wins.

Example with 3 rules:

```
Rule 1: Priority 100, Unit 101 → AUTO_APPROVE
Rule 2: Priority 50, Unit 1xx + Cost ≤ 300 → AUTO_APPROVE
Rule 3: Priority 10, All units → REQUIRE_REVIEW
```

If maintenance request for Unit 101 with cost $200:
1. Check Rule 1: Unit 101 EQUALS 101 ✅ → **AUTO_APPROVE** (STOP)
2. (Rules 2 and 3 not evaluated)

If maintenance request for Unit 105 with cost $200:
1. Check Rule 1: Unit 105 EQUALS 101 ❌ → Continue
2. Check Rule 2: Unit 105 STARTS_WITH 1 ✅ AND Cost 200 ≤ 300 ✅ → **AUTO_APPROVE** (STOP)
3. (Rule 3 not evaluated)

If maintenance request for Unit 205 with cost $200:
1. Check Rule 1: Unit 205 EQUALS 101 ❌ → Continue
2. Check Rule 2: Unit 205 STARTS_WITH 1 ❌ → Continue
3. Check Rule 3: All units match → **REQUIRE_REVIEW** (STOP)

## Common Patterns

### "PH" = Penthouse
```json
{
  "field": "UNIT_NUMBER",
  "operator": "STARTS_WITH",
  "value": "PH"
}
```

### "COMMON" = Common Areas
```json
{
  "field": "UNIT_NUMBER",
  "operator": "CONTAINS",
  "value": "COMMON"
}
```

### "B" = Basement
```json
{
  "field": "UNIT_NUMBER",
  "operator": "STARTS_WITH",
  "value": "B"
}
```

### "2nd Floor" = Units 2xx
```json
{
  "field": "UNIT_NUMBER",
  "operator": "STARTS_WITH",
  "value": "2"
}
```

## Notes

- Unit numbers are case-sensitive
- Pattern matching is always string-based
- Numeric operators (LESS_THAN, GREATER_THAN) work only with ESTIMATED_COST and UNIT_TYPE (not recommended for unit numbers)
- Combine unit number matching with other conditions for fine-grained control
- Rules apply only to their scope: org-level rules apply to all buildings, building-level rules apply only to that building

---

**Status**: ✅ Unit number matching is fully implemented and ready to use

When creating maintenance rules, you can now use unit numbers (e.g., "101", "202", "COMMON-LOBBY") alongside existing conditions like category, cost, and unit type.
