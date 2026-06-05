-- AddConditionReports: UnitConditionReport, UnitConditionReportItem, UnitConditionReportPhoto
-- Plus conditionReportDeadlineDays on BuildingConfig

-- New enums
CREATE TYPE "ConditionReportType"   AS ENUM ('MOVE_IN', 'MOVE_OUT');
CREATE TYPE "ConditionReportStatus" AS ENUM ('PENDING', 'SUBMITTED', 'APPROVED');
CREATE TYPE "ItemCondition"         AS ENUM ('GOOD', 'FAIR', 'POOR', 'DAMAGED');

-- BuildingConfig: add deadline field
ALTER TABLE "BuildingConfig"
  ADD COLUMN "conditionReportDeadlineDays" INTEGER NOT NULL DEFAULT 7;

-- UnitConditionReport
CREATE TABLE "UnitConditionReport" (
  "id"               TEXT         NOT NULL,
  "orgId"            TEXT         NOT NULL,
  "unitId"           TEXT         NOT NULL,
  "tenantId"         TEXT         NOT NULL,
  "leaseId"          TEXT         NOT NULL,
  "type"             "ConditionReportType"   NOT NULL,
  "status"           "ConditionReportStatus" NOT NULL DEFAULT 'PENDING',
  "dueAt"            TIMESTAMP(3),
  "submittedAt"      TIMESTAMP(3),
  "approvedAt"       TIMESTAMP(3),
  "approvedByUserId" TEXT,
  "managerNotes"     TEXT,
  "createdAt"        TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt"        TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "UnitConditionReport_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "UnitConditionReport_orgId_fkey"            FOREIGN KEY ("orgId")            REFERENCES "Org"("id")    ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "UnitConditionReport_unitId_fkey"           FOREIGN KEY ("unitId")           REFERENCES "Unit"("id")   ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "UnitConditionReport_tenantId_fkey"         FOREIGN KEY ("tenantId")         REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "UnitConditionReport_leaseId_fkey"          FOREIGN KEY ("leaseId")          REFERENCES "Lease"("id")  ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "UnitConditionReport_approvedByUserId_fkey" FOREIGN KEY ("approvedByUserId") REFERENCES "User"("id")   ON DELETE SET NULL ON UPDATE CASCADE
);

CREATE INDEX "UnitConditionReport_orgId_idx"    ON "UnitConditionReport"("orgId");
CREATE INDEX "UnitConditionReport_unitId_idx"   ON "UnitConditionReport"("unitId");
CREATE INDEX "UnitConditionReport_tenantId_idx" ON "UnitConditionReport"("tenantId");
CREATE INDEX "UnitConditionReport_leaseId_idx"  ON "UnitConditionReport"("leaseId");

-- UnitConditionReportItem
CREATE TABLE "UnitConditionReportItem" (
  "id"        TEXT           NOT NULL,
  "reportId"  TEXT           NOT NULL,
  "assetId"   TEXT,
  "roomLabel" TEXT           NOT NULL,
  "itemLabel" TEXT           NOT NULL,
  "condition" "ItemCondition" NOT NULL,
  "notes"     TEXT,
  CONSTRAINT "UnitConditionReportItem_pkey"     PRIMARY KEY ("id"),
  CONSTRAINT "UnitConditionReportItem_reportId_fkey" FOREIGN KEY ("reportId") REFERENCES "UnitConditionReport"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "UnitConditionReportItem_assetId_fkey"  FOREIGN KEY ("assetId")  REFERENCES "Asset"("id")              ON DELETE SET NULL ON UPDATE CASCADE
);

CREATE INDEX "UnitConditionReportItem_reportId_idx" ON "UnitConditionReportItem"("reportId");
CREATE INDEX "UnitConditionReportItem_assetId_idx"  ON "UnitConditionReportItem"("assetId");

-- UnitConditionReportPhoto
CREATE TABLE "UnitConditionReportPhoto" (
  "id"         TEXT         NOT NULL,
  "itemId"     TEXT         NOT NULL,
  "storageKey" TEXT         NOT NULL,
  "caption"    TEXT,
  "createdAt"  TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "UnitConditionReportPhoto_pkey"       PRIMARY KEY ("id"),
  CONSTRAINT "UnitConditionReportPhoto_itemId_fkey" FOREIGN KEY ("itemId") REFERENCES "UnitConditionReportItem"("id") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE INDEX "UnitConditionReportPhoto_itemId_idx" ON "UnitConditionReportPhoto"("itemId");
