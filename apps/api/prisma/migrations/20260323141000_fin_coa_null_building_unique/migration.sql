-- FIN-COA-01 fix: PostgreSQL NULL uniqueness
-- The composite unique index on (orgId, expenseTypeId, buildingId) does not
-- enforce uniqueness when buildingId IS NULL (NULL ≠ NULL in SQL).
-- Add a partial unique index covering the NULL-building case.

CREATE UNIQUE INDEX "ExpenseMapping_orgId_expenseTypeId_nullBuilding_key"
  ON "ExpenseMapping" ("orgId", "expenseTypeId")
  WHERE "buildingId" IS NULL;
