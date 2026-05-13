-- Enable Row Level Security on all tables in the public schema.
--
-- Why: Supabase exposes the public schema via PostgREST. Without RLS any caller
-- that holds the anon key can read or write every table directly — bypassing the
-- application's auth layer entirely.
--
-- Effect: All direct PostgREST access is blocked for the anon / authenticated
-- roles. The backend API connects through the service_role connection string
-- which has BYPASSRLS in Supabase, so no application queries are affected.
-- No policies are needed because this app never reads/writes data through
-- PostgREST — all data access goes via the Node.js API server.

ALTER TABLE "public"."Account"                       ENABLE ROW LEVEL SECURITY;
ALTER TABLE "public"."AppointmentSlot"               ENABLE ROW LEVEL SECURITY;
ALTER TABLE "public"."ApprovalRule"                  ENABLE ROW LEVEL SECURITY;
ALTER TABLE "public"."Asset"                         ENABLE ROW LEVEL SECURITY;
ALTER TABLE "public"."AssetIntervention"             ENABLE ROW LEVEL SECURITY;
ALTER TABLE "public"."AssetModel"                    ENABLE ROW LEVEL SECURITY;
ALTER TABLE "public"."BillingEntity"                 ENABLE ROW LEVEL SECURITY;
ALTER TABLE "public"."Building"                      ENABLE ROW LEVEL SECURITY;
ALTER TABLE "public"."BuildingConfig"                ENABLE ROW LEVEL SECURITY;
ALTER TABLE "public"."BuildingFinancialSnapshot"     ENABLE ROW LEVEL SECURITY;
ALTER TABLE "public"."BuildingOwner"                 ENABLE ROW LEVEL SECURITY;
ALTER TABLE "public"."BuildingStrategyProfile"       ENABLE ROW LEVEL SECURITY;
ALTER TABLE "public"."CaptureSession"                ENABLE ROW LEVEL SECURITY;
ALTER TABLE "public"."CashflowOverride"              ENABLE ROW LEVEL SECURITY;
ALTER TABLE "public"."CashflowPlan"                  ENABLE ROW LEVEL SECURITY;
ALTER TABLE "public"."ChargeReconciliation"          ENABLE ROW LEVEL SECURITY;
ALTER TABLE "public"."ChargeReconciliationLine"      ENABLE ROW LEVEL SECURITY;
ALTER TABLE "public"."Contractor"                    ENABLE ROW LEVEL SECURITY;
ALTER TABLE "public"."ContractorBillingSchedule"     ENABLE ROW LEVEL SECURITY;
ALTER TABLE "public"."ConversationMessage"           ENABLE ROW LEVEL SECURITY;
ALTER TABLE "public"."ConversationThread"            ENABLE ROW LEVEL SECURITY;
ALTER TABLE "public"."DepreciationStandard"          ENABLE ROW LEVEL SECURITY;
ALTER TABLE "public"."EmailOutbox"                   ENABLE ROW LEVEL SECURITY;
ALTER TABLE "public"."Event"                         ENABLE ROW LEVEL SECURITY;
ALTER TABLE "public"."ExpenseMapping"                ENABLE ROW LEVEL SECURITY;
ALTER TABLE "public"."ExpenseType"                   ENABLE ROW LEVEL SECURITY;
ALTER TABLE "public"."ImportedAccountBalance"        ENABLE ROW LEVEL SECURITY;
ALTER TABLE "public"."ImportedStatement"             ENABLE ROW LEVEL SECURITY;
ALTER TABLE "public"."Invoice"                       ENABLE ROW LEVEL SECURITY;
ALTER TABLE "public"."InvoiceLineItem"               ENABLE ROW LEVEL SECURITY;
ALTER TABLE "public"."Job"                           ENABLE ROW LEVEL SECURITY;
ALTER TABLE "public"."JobRating"                     ENABLE ROW LEVEL SECURITY;
ALTER TABLE "public"."Lease"                         ENABLE ROW LEVEL SECURITY;
ALTER TABLE "public"."LeaseExpenseItem"              ENABLE ROW LEVEL SECURITY;
ALTER TABLE "public"."LedgerEntry"                   ENABLE ROW LEVEL SECURITY;
ALTER TABLE "public"."LegalCategoryMapping"          ENABLE ROW LEVEL SECURITY;
ALTER TABLE "public"."LegalEvaluationLog"            ENABLE ROW LEVEL SECURITY;
ALTER TABLE "public"."LegalRule"                     ENABLE ROW LEVEL SECURITY;
ALTER TABLE "public"."LegalRuleVersion"              ENABLE ROW LEVEL SECURITY;
ALTER TABLE "public"."LegalSource"                   ENABLE ROW LEVEL SECURITY;
ALTER TABLE "public"."LegalVariable"                 ENABLE ROW LEVEL SECURITY;
ALTER TABLE "public"."LegalVariableVersion"          ENABLE ROW LEVEL SECURITY;
ALTER TABLE "public"."MaintenanceAttachment"         ENABLE ROW LEVEL SECURITY;
ALTER TABLE "public"."MaintenanceDecisionOption"     ENABLE ROW LEVEL SECURITY;
ALTER TABLE "public"."Notification"                  ENABLE ROW LEVEL SECURITY;
ALTER TABLE "public"."Occupancy"                     ENABLE ROW LEVEL SECURITY;
ALTER TABLE "public"."Org"                           ENABLE ROW LEVEL SECURITY;
ALTER TABLE "public"."OrgConfig"                     ENABLE ROW LEVEL SECURITY;
ALTER TABLE "public"."OwnerStrategyProfile"          ENABLE ROW LEVEL SECURITY;
ALTER TABLE "public"."RecommendationResult"          ENABLE ROW LEVEL SECURITY;
ALTER TABLE "public"."RecurringBillingSchedule"      ENABLE ROW LEVEL SECURITY;
ALTER TABLE "public"."RentAdjustment"                ENABLE ROW LEVEL SECURITY;
ALTER TABLE "public"."RentEstimationConfig"          ENABLE ROW LEVEL SECURITY;
ALTER TABLE "public"."RentalApplicant"               ENABLE ROW LEVEL SECURITY;
ALTER TABLE "public"."RentalApplication"             ENABLE ROW LEVEL SECURITY;
ALTER TABLE "public"."RentalApplicationUnit"         ENABLE ROW LEVEL SECURITY;
ALTER TABLE "public"."RentalAttachment"              ENABLE ROW LEVEL SECURITY;
ALTER TABLE "public"."RentalOwnerSelection"          ENABLE ROW LEVEL SECURITY;
ALTER TABLE "public"."ReplacementBenchmark"          ENABLE ROW LEVEL SECURITY;
ALTER TABLE "public"."Request"                       ENABLE ROW LEVEL SECURITY;
ALTER TABLE "public"."RequestEvent"                  ENABLE ROW LEVEL SECURITY;
ALTER TABLE "public"."Rfp"                           ENABLE ROW LEVEL SECURITY;
ALTER TABLE "public"."RfpInvite"                     ENABLE ROW LEVEL SECURITY;
ALTER TABLE "public"."RfpQuote"                      ENABLE ROW LEVEL SECURITY;
ALTER TABLE "public"."SignatureRequest"              ENABLE ROW LEVEL SECURITY;
ALTER TABLE "public"."StrategyQuestionnaireAnswer"   ENABLE ROW LEVEL SECURITY;
ALTER TABLE "public"."TaxRule"                       ENABLE ROW LEVEL SECURITY;
ALTER TABLE "public"."TaxRuleVersion"                ENABLE ROW LEVEL SECURITY;
ALTER TABLE "public"."Tenant"                        ENABLE ROW LEVEL SECURITY;
ALTER TABLE "public"."Unit"                          ENABLE ROW LEVEL SECURITY;
ALTER TABLE "public"."UnitConfig"                    ENABLE ROW LEVEL SECURITY;
ALTER TABLE "public"."User"                          ENABLE ROW LEVEL SECURITY;
