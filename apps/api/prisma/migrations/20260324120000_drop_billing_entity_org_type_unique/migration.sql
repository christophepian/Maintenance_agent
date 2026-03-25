-- Drop overly-broad unique constraint that prevented multiple contractor billing entities per org.
-- Per-contractor uniqueness is already enforced by the contractorId @unique field.
DROP INDEX "BillingEntity_orgId_type_key";
