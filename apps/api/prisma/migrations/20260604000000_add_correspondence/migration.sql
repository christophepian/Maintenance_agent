-- AddCorrespondence: Letter, LetterRecipient, LetterResponse + TENANT_LETTER email template

-- New enums
CREATE TYPE "LetterStatus" AS ENUM ('DRAFT', 'SENT', 'ARCHIVED');
CREATE TYPE "LetterTemplateType" AS ENUM ('GENERAL', 'MAINTENANCE_NOTICE', 'COMPLIANCE_REQUEST', 'FINANCIAL_NOTICE', 'SEASONAL', 'LEASE_ADMIN');

-- Extend existing EmailTemplate enum
ALTER TYPE "EmailTemplate" ADD VALUE 'TENANT_LETTER';

-- Letter table
CREATE TABLE "Letter" (
  "id"              TEXT NOT NULL,
  "orgId"           TEXT NOT NULL,
  "subject"         TEXT NOT NULL,
  "body"            TEXT NOT NULL DEFAULT '',
  "templateType"    "LetterTemplateType" NOT NULL DEFAULT 'GENERAL',
  "status"          "LetterStatus" NOT NULL DEFAULT 'DRAFT',
  "lang"            TEXT NOT NULL DEFAULT 'fr',
  "createdByUserId" TEXT,
  "sentAt"          TIMESTAMP(3),
  "createdAt"       TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt"       TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "Letter_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "Letter_orgId_fkey" FOREIGN KEY ("orgId") REFERENCES "Org"("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- LetterRecipient table
CREATE TABLE "LetterRecipient" (
  "id"           TEXT NOT NULL,
  "letterId"     TEXT NOT NULL,
  "tenantId"     TEXT NOT NULL,
  "readAt"       TIMESTAMP(3),
  "emailSentAt"  TIMESTAMP(3),
  CONSTRAINT "LetterRecipient_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "LetterRecipient_letterId_fkey" FOREIGN KEY ("letterId") REFERENCES "Letter"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "LetterRecipient_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "LetterRecipient_letterId_tenantId_key" UNIQUE ("letterId", "tenantId")
);

-- LetterResponse table
CREATE TABLE "LetterResponse" (
  "id"        TEXT NOT NULL,
  "letterId"  TEXT NOT NULL,
  "tenantId"  TEXT NOT NULL,
  "content"   TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "LetterResponse_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "LetterResponse_letterId_fkey" FOREIGN KEY ("letterId") REFERENCES "Letter"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "LetterResponse_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- Indexes
CREATE INDEX "Letter_orgId_idx" ON "Letter"("orgId");
CREATE INDEX "Letter_orgId_status_idx" ON "Letter"("orgId", "status");
CREATE INDEX "LetterRecipient_letterId_idx" ON "LetterRecipient"("letterId");
CREATE INDEX "LetterRecipient_tenantId_idx" ON "LetterRecipient"("tenantId");
CREATE INDEX "LetterResponse_letterId_idx" ON "LetterResponse"("letterId");
CREATE INDEX "LetterResponse_tenantId_idx" ON "LetterResponse"("tenantId");
