BEGIN;

-- Rental applications & selections
DELETE FROM "RentalOwnerSelection";
DELETE FROM "RentalApplicationUnit";
DELETE FROM "RentalAttachment";
DELETE FROM "RentalApplicant";
DELETE FROM "RentalApplication";
DELETE FROM "EmailOutbox";

-- Assets & depreciation
DELETE FROM "AssetIntervention";
DELETE FROM "Asset";

-- Finance
DELETE FROM "InvoiceLineItem";
DELETE FROM "Invoice";
DELETE FROM "BuildingFinancialSnapshot";
DELETE FROM "BillingEntity";

-- Jobs & RFPs
DELETE FROM "Job";
DELETE FROM "RfpQuote";
DELETE FROM "RfpInvite";
DELETE FROM "Rfp";

-- Legal evaluation logs (preserve sources, rules, standards, mappings)
DELETE FROM "LegalEvaluationLog";

-- Requests & events
DELETE FROM "RequestEvent";
DELETE FROM "Event";
DELETE FROM "Notification";
DELETE FROM "Request";

-- Leases & signatures
DELETE FROM "SignatureRequest";
DELETE FROM "Lease";

-- People
DELETE FROM "Occupancy";
DELETE FROM "Tenant";
DELETE FROM "Contractor";
DELETE FROM "User";

-- Inventory
DELETE FROM "Appliance";
DELETE FROM "AssetModel";
DELETE FROM "UnitConfig";
DELETE FROM "Unit";
DELETE FROM "ApprovalRule";
DELETE FROM "BuildingConfig";
DELETE FROM "RentEstimationConfig";
DELETE FROM "Building";

-- Org config (keep Org itself)
DELETE FROM "OrgConfig";
-- DELETE FROM "Org";

COMMIT;
