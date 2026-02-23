# Unit Config - Architecture Diagram

## Data Flow: Three-Tier Cascade

```
┌─────────────────────────────────────────────────────────────────┐
│  Maintenance Request Submission                                 │
│  POST /requests { unitId: "unit-123", estimatedCost: 550 }     │
└──────────────────────────┬──────────────────────────────────────┘
                           │
                           ▼
         ┌─────────────────────────────────┐
         │ decideRequestStatusWithRules()   │
         │ (autoApproval.ts)               │
         └──────────────────┬──────────────┘
                            │
                   ┌────────┴────────┐
                   │                 │
                   ▼                 ▼
        ┌──────────────────┐  ┌──────────────────────┐
        │ evaluateRules()  │  │ computeEffectiveUnitConfig()
        │ (if rules exist) │  │ (unitConfig.ts) ← NEW
        └──────────────────┘  └──────────────────────┘
                                      │
                    ┌─────────────────┼─────────────────┐
                    │                 │                 │
                    ▼                 ▼                 ▼
           ┌────────────────┐ ┌────────────────┐ ┌────────────────┐
           │ UnitConfig?    │ │BuildingConfig? │ │ OrgConfig?     │
           │ (if set)       │ │ (if set)       │ │ (always set)   │
           │ {              │ │ {              │ │ {              │
           │  autoApprove   │ │  autoApprove   │ │  autoApprove   │
           │  Limit: 600    │ │  Limit: 400    │ │  Limit: 200    │
           │ }              │ │ }              │ │ }              │
           └────────────────┘ └────────────────┘ └────────────────┘
                    │                 │                 │
                    └─────────────────┼─────────────────┘
                                      │
                  ┌───────────────────▼────────────────────┐
                  │ EFFECTIVE LIMIT = 600                  │
                  │ (Unit config wins!)                    │
                  └───────────────────┬────────────────────┘
                                      │
                                      ▼
                  ┌───────────────────────────────────┐
                  │ 550 ≤ 600?                        │
                  │ YES → AUTO_APPROVED               │
                  │ (Request created with status OK)  │
                  └───────────────────────────────────┘
```

## Database Schema Relationships

```
┌──────────────┐
│    Org       │
├──────────────┤
│ id (PK)      │
│ name         │
│ mode         │
└──────────────┘
      │
      │ 1:N (unitConfigs)
      │
      ▼
┌──────────────────────┐         ┌──────────────┐
│   OrgConfig          │         │ UnitConfig   │
├──────────────────────┤         ├──────────────┤
│ id (PK)              │         │ id (PK)      │◄──┐
│ orgId (FK)           │         │ orgId (FK)   │   │
│ autoApproveLimit     │         │ unitId (FK)  │   │
│ ...                  │         │ auto...      │   │
└──────────────────────┘         │ ...          │   │
                                 └──────────────┘   │
                                      ▲             │
                                      │             │
                                      │ 1:1         │
      ┌──────────────┐               │             │
      │  Building    │       ┌───────┴─────┐       │
      ├──────────────┤       │    Unit     │───────┘
      │ id (PK)      │       ├─────────────┤
      │ orgId (FK)   │       │ id (PK)     │
      └──────────────┘       │ orgId (FK)  │
            │ 1:N            │ buildingId  │
            │                │ config (1:1)│
            │                └─────────────┘
            │                      │
            ▼                       │
   ┌──────────────────┐            │
   │ BuildingConfig   │            │
   ├──────────────────┤            │
   │ id (PK)          │            │
   │ buildingId (FK)  │            │
   │ autoApproveLimit │            │
   │ ...              │            │
   └──────────────────┘            │
                                   │
        (New relationship)◄─────────┘
```

## API Endpoint Flow

```
REQUEST: PUT /units/abc-123/config
BODY: { "autoApproveLimit": 600 }
HEADERS: Authorization: Bearer TOKEN

                ▼
        ┌───────────────────┐
        │ matchUnitConfig() │ → Extract unitId "abc-123"
        └────────┬──────────┘
                 │
                 ▼
        ┌───────────────────────────┐
        │ Authorization Check       │
        │ - requireOrgViewer()      │ ✅ PASS
        │ - requireGovernanceAccess()
        └────────┬──────────────────┘
                 │
                 ▼
        ┌────────────────────┐
        │ Zod Validation     │
        │ UnitConfigSchema   │ ✅ PASS
        └────────┬───────────┘
                 │
                 ▼
        ┌───────────────────────────┐
        │ upsertUnitConfig()        │
        │ - Check unit exists       │ ✅ FOUND
        │ - Create/update config    │ ✅ DONE
        └────────┬──────────────────┘
                 │
                 ▼
        ┌──────────────────────────────┐
        │ computeEffectiveUnitConfig() │
        │ - Fetch org/building/unit    │
        │ - Merge with cascade logic   │
        │ - Return full response       │
        └────────┬─────────────────────┘
                 │
                 ▼
        RESPONSE: 200 OK
        {
          "data": {
            "org": { ... },
            "building": { ... },
            "unit": { "autoApproveLimit": 600, ... },
            "effectiveAutoApproveLimit": 600,
            ...
          }
        }
```

## Cascade Logic Decision Tree

```
computeEffectiveUnitConfig(orgId: string, unitId: string)
┌───────────────────────────────────────────────────────┐
│ For EACH config field (autoApproveLimit, etc.):       │
└─────────────────────────┬───────────────────────────┘
                          │
                          ▼
            ┌─────────────────────────┐
            │ Unit config set?        │
            └────┬────────────────────┘
                 │
        ┌────────┴────────┐
        │ YES             │ NO
        ▼                 ▼
    ┌─────┐          ┌────────────────┐
    │USE  │          │ Building config│
    │UNIT │          │ set?           │
    │VALUE│          └────┬───────────┘
    └─────┘               │
                 ┌────────┴────────┐
                 │ YES             │ NO
                 ▼                 ▼
             ┌─────┐          ┌──────────┐
             │USE  │          │ Org      │
             │BUILD│          │ config   │
             │VALUE│          │ set?     │
             └─────┘          └────┬─────┘
                                   │
                          ┌────────┴────────┐
                          │ YES             │ NO
                          ▼                 ▼
                      ┌─────┐          ┌────────┐
                      │USE  │          │USE     │
                      │ORG  │          │DEFAULT │
                      │VALUE│          │FALSE/0 │
                      └─────┘          └────────┘
```

## Request Approval With Unit Policy

```
┌──────────────────────────────────────────────┐
│ New Maintenance Request                      │
│ Category: "bathroom"                         │
│ Estimated Cost: 550 CHF                      │
│ Unit ID: "unit-abc123"                       │
└──────────────────────────┬───────────────────┘
                           │
                 ┌─────────┴─────────┐
                 │                   │
         ┌───────▼────────┐  ┌──────▼──────┐
         │ Evaluate Rules │  │ Get Unit    │
         │                │  │ Effective   │
         │ (if exist)     │  │ Config      │
         └────┬───────────┘  └──────┬──────┘
              │                     │
         ┌────┴─────────────────────┴─────┐
         │ Rule matched?                   │
         └────┬────────────────────────┬──┘
              │ YES                    │ NO
              │                        │
          ┌───▼───┐          ┌────────▼────────┐
          │USE    │          │ Use Threshold   │
          │RULE   │          │ Logic           │
          │STATUS │          │ 550 ≤ 600?      │
          └───┬───┘          └────────┬────────┘
              │                       │
              └───────────┬───────────┘
                          │
                    ┌─────▼─────┐
                    │ APPROVED  │
                    │ or        │
                    │ PENDING   │
                    └───────────┘
```

## Cascade Priority Visualization

```
Request for Unit: "Apartment 305"
Building: "Main Complex"
Organization: "PropertyCorp"

When determining approval limit:

                PRIORITY
                  ↓
        ┌─────────────────────┐
        │ Unit Override?      │ ← Highest Priority
        │ autoApprove: 600    │
        └─────────────────────┘
                  │
                  ▼
        ┌─────────────────────┐
        │ Building Override?  │ ← Medium Priority
        │ autoApprove: 400    │
        └─────────────────────┘
                  │
                  ▼
        ┌─────────────────────┐
        │ Org Default?        │ ← Low Priority
        │ autoApprove: 200    │
        └─────────────────────┘
                  │
                  ▼
        ┌─────────────────────┐
        │ System Default?     │ ← Fallback
        │ autoApprove: 200    │
        └─────────────────────┘

RESULT: Use HIGHEST found value = 600

For Emergency Dispatch (boolean):
Unit: null (not set)
Building: true  ← Found, use this
Org: (doesn't matter)
Result: true

For Owner Approval Threshold:
Unit: null (not set)
Building: null (not set)
Org: 200    ← Found, use this
Result: 200
```

## File Structure

```
apps/api/
├── prisma/
│   ├── schema.prisma              [UPDATED] Added UnitConfig model
│   └── migrations/
│       └── 20260211163838.../     [NEW] UnitConfig migration
│
├── src/
│   ├── server.ts                  [UPDATED] Added 3 endpoints + matcher
│   ├── services/
│   │   ├── unitConfig.ts          [NEW] Cascade logic + CRUD
│   │   └── autoApproval.ts        [UPDATED] Unit-level lookup
│   ├── validation/
│   │   └── unitConfig.ts          [NEW] Zod schema
│   └── __tests__/
│       └── unitConfig.cascade...  [NEW] Integration tests
│
├── dist/                          [COMPILED] All above files compiled
└── dist/services/unitConfig.js    [COMPILED OUTPUT]
```

## Authorization Matrix

```
┌──────────────────────────────┬────────────┬────────────┬──────────────┐
│ Operation                    │ GET /conf  │ PUT /conf  │ DELETE /conf │
├──────────────────────────────┼────────────┼────────────┼──────────────┤
│ ROLE_ORG_VIEWER              │     ✅     │     ❌     │      ❌      │
│ ROLE_GOVERNANCE              │     ✅     │     ✅     │      ✅      │
│ ROLE_OWNER_DIRECT            │     ✅     │     ✅     │      ✅      │
│ ROLE_ADMIN                   │     ✅     │     ✅     │      ✅      │
│ Anonymous                    │     ❌     │     ❌     │      ❌      │
└──────────────────────────────┴────────────┴────────────┴──────────────┘

Legend: ✅ Allowed  |  ❌ Denied
```

---

**Diagram Date**: February 11, 2026  
**System**: Unit-Level Policy Overrides  
**Status**: ✅ Complete
