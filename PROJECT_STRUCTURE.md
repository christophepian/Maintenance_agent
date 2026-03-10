# Project Structure

> Maintenance Agent — Swiss Property Management Platform (Monorepo)
>
> Last updated: 2026-03-10

```
Maintenance_Agent/
├── .github/
│   ├── copilot-instructions.md
│   └── workflows/
│       └── ci.yml
├── .vscode/
│   ├── settings.json
│   └── tasks.json
├── .gitignore
├── package.json
├── tsconfig.json
│
├── ── Documentation ──────────────────────────────
├── BUILDING_FINANCIAL_PERFORMANCE_EPIC.md
├── EPIC_HISTORY.md
├── FINANCE_AUDIT.md
├── LEGAL_ENGINE_EPIC.md
├── PROJECT_STATE.md
├── SCHEMA_REFERENCE.md
│
├── docs/
│   ├── DEV_COMMANDS.md
│   ├── Dev commands
│   ├── UI_AUDIT_2026-03-08.md
│   └── cleanup_dev_db.sql
│
├── backups/
│   └── .gitkeep
│
├── ── Infrastructure ─────────────────────────────
├── infra/
│   └── docker-compose.yml          # PostgreSQL on port 5432
│
├── ── Packages ───────────────────────────────────
├── packages/
│   ├── package.json
│   ├── readme.md
│   └── api-client/                 # (shared API client — contents omitted)
│
├── ── Backend API (apps/api) ─────────────────────
├── apps/
│   ├── package.json
│   ├── scripts.js/
│   │   └── blueprint.js
│   │
│   └── api/
│       ├── .env
│       ├── .env.example
│       ├── .env.test
│       ├── jest.config.js
│       ├── openapi.yaml
│       ├── package.json
│       ├── tsconfig.json
│       │
│       ├── ── Seed Scripts ───────────────────────
│       ├── seed-category-mappings.js
│       ├── seed-comprehensive-assets.js
│       ├── seed-dashboard-data.js
│       ├── seed-fedlex-sources.js
│       ├── seed-legal-demo.js
│       ├── seed-legal-rules.js
│       ├── seed-test-legal-rule.js
│       ├── seed-vacant-listings.ts
│       │
│       ├── ── Prisma / Database ──────────────────
│       ├── prisma/
│       │   ├── schema.prisma
│       │   ├── seed.ts
│       │   └── migrations/
│       │       ├── migration_lock.toml
│       │       ├── 20260201170725_add_request/
│       │       ├── 20260201183713_create_request/
│       │       ├── 20260202145328_add_auto_approval/
│       │       ├── 20260202150816_make_estimated_cost_nullable/
│       │       ├── 20260202171821_add_approved_status/
│       │       ├── 20260203102333_add_contractor_model/
│       │       ├── 20260203105656_add_contractor_status/
│       │       ├── 20260203112038_add_tenant_asset_context/
│       │       ├── 20260203183219_add_request_contact_phone/
│       │       ├── 20260205142350_add_auth_to_user/
│       │       ├── 20260205153654_contractor_portal_lifecycle/
│       │       ├── 20260207110745_add_inventory_admin_expansion/
│       │       ├── 20260210150110_add_owner_direct_foundation/
│       │       ├── 20260210160000_add_owner_role/
│       │       ├── 20260210195235_add_approval_rules/
│       │       ├── 20260210202241_fix_approval_rule_relation_and_add_owner_approval/
│       │       ├── 20260211085910_add_job_and_invoice_models/
│       │       ├── 20260211163838_add_unit_config/
│       │       ├── 20260211172723_add_notifications/
│       │       ├── 20260212120000_add_billing_entity/
│       │       ├── 20260212123000_add_billing_entity_contractor_link/
│       │       ├── 20260212130000_add_contractor_billing_fields/
│       │       ├── 20260212133000_invoice_model_upgrade/
│       │       ├── 20260228120000_add_rental_models/
│       │       ├── 20260303225836_add_rent_estimation_fields/
│       │       ├── 20260304115550_add_lease_soft_delete/
│       │       ├── 20260305100000_add_financial_snapshots_and_invoice_expense_category/
│       │       ├── 20260308_add_legal_source_scope/
│       │       ├── 20260309131839_add_building_managed_since/
│       │       ├── 20260310100000_add_asset_intervention_and_extend_asset/
│       │       └── 20260311100000_add_building_owner/
│       │
│       ├── ── Source Code ────────────────────────
│       └── src/
│           ├── ARCHITECTURE_LOW_CONTEXT_GUIDE.md
│           ├── server.ts               # Raw HTTP server entry point (port 3001)
│           ├── auth.ts                 # Authentication middleware
│           ├── authz.ts                # Authorization middleware
│           │
│           ├── dto/
│           │   ├── buildingDetail.ts
│           │   └── unitList.ts
│           │
│           ├── events/
│           │   ├── bus.ts
│           │   ├── handlers.ts
│           │   ├── index.ts
│           │   └── types.ts
│           │
│           ├── governance/
│           │   └── orgScope.ts
│           │
│           ├── http/
│           │   ├── body.ts             # readJson() utility
│           │   ├── errors.ts           # sendError() utility
│           │   ├── json.ts             # sendJson() utility
│           │   ├── query.ts            # parseUrl() / query parsing
│           │   ├── routeProtection.ts
│           │   └── router.ts
│           │
│           ├── repositories/
│           │   ├── index.ts
│           │   ├── assetRepository.ts
│           │   ├── inventoryRepository.ts
│           │   ├── invoiceRepository.ts
│           │   ├── jobRepository.ts
│           │   ├── leaseRepository.ts
│           │   ├── legalSourceRepository.ts
│           │   ├── rentalApplicationRepository.ts
│           │   └── requestRepository.ts
│           │
│           ├── routes/
│           │   ├── auth.ts
│           │   ├── config.ts
│           │   ├── contractor.ts
│           │   ├── financials.ts
│           │   ├── helpers.ts
│           │   ├── inventory.ts
│           │   ├── invoices.ts
│           │   ├── leases.ts
│           │   ├── legal.ts
│           │   ├── notifications.ts
│           │   ├── rentEstimation.ts
│           │   ├── rentalApplications.ts
│           │   ├── requests.ts
│           │   └── tenants.ts
│           │
│           ├── services/
│           │   ├── prismaClient.ts
│           │   ├── approvalRules.ts
│           │   ├── assetInventory.ts
│           │   ├── auth.ts
│           │   ├── autoApproval.ts
│           │   ├── billingEntities.ts
│           │   ├── buildingConfig.ts
│           │   ├── cantonMapping.ts
│           │   ├── contractorRequests.ts
│           │   ├── contractors.ts
│           │   ├── depreciation.ts
│           │   ├── documentScan.ts
│           │   ├── emailOutbox.ts
│           │   ├── financials.ts
│           │   ├── inventory.ts
│           │   ├── invoicePDF.ts
│           │   ├── invoiceQRBill.ts
│           │   ├── invoices.ts
│           │   ├── jobs.ts
│           │   ├── leasePDFRenderer.ts
│           │   ├── leases.ts
│           │   ├── legalDecisionEngine.ts
│           │   ├── legalIncludes.ts
│           │   ├── legalIngestion.ts
│           │   ├── maintenanceRequests.ts
│           │   ├── notifications.ts
│           │   ├── occupancies.ts
│           │   ├── orgConfig.ts
│           │   ├── ownerSelection.ts
│           │   ├── qrBill.ts
│           │   ├── rentEstimation.ts
│           │   ├── rentalApplications.ts
│           │   ├── rentalIncludes.ts
│           │   ├── rentalRules.ts
│           │   ├── requestAssignment.ts
│           │   ├── rfps.ts
│           │   ├── signatureRequests.ts
│           │   ├── tenantPortal.ts
│           │   ├── tenantSession.ts
│           │   ├── tenants.ts
│           │   ├── triage.ts
│           │   ├── unitConfig.ts
│           │   └── adapters/
│           │       ├── assetAdapter.ts
│           │       ├── contactAdapter.ts
│           │       ├── propertyAdapter.ts
│           │       └── workRequestAdapter.ts
│           │
│           ├── storage/
│           │   └── attachments.ts
│           │
│           ├── types/
│           │   └── approvalRules.ts
│           │
│           ├── utils/
│           │   └── phoneNormalization.ts
│           │
│           ├── validation/
│           │   ├── appliances.ts
│           │   ├── approvalRules.ts
│           │   ├── assetModels.ts
│           │   ├── assets.ts
│           │   ├── auth.ts
│           │   ├── billingEntities.ts
│           │   ├── buildingConfig.ts
│           │   ├── buildings.ts
│           │   ├── categories.ts
│           │   ├── contractors.ts
│           │   ├── financials.ts
│           │   ├── invoicePDF.ts
│           │   ├── invoices.ts
│           │   ├── jobs.ts
│           │   ├── leases.ts
│           │   ├── legal.ts
│           │   ├── notifications.ts
│           │   ├── occupancies.ts
│           │   ├── orgConfig.ts
│           │   ├── qrBill.ts
│           │   ├── rentEstimation.ts
│           │   ├── rentalApplications.ts
│           │   ├── requestAssignment.ts
│           │   ├── requestStatus.ts
│           │   ├── requests.ts
│           │   ├── tenantSession.ts
│           │   ├── tenants.ts
│           │   ├── triage.ts
│           │   ├── unitConfig.ts
│           │   └── units.ts
│           │
│           ├── workflows/
│           │   ├── index.ts
│           │   ├── context.ts
│           │   ├── transitions.ts
│           │   ├── activateLeaseWorkflow.ts
│           │   ├── approveInvoiceWorkflow.ts
│           │   ├── approveRequestWorkflow.ts
│           │   ├── assignContractorWorkflow.ts
│           │   ├── completeJobWorkflow.ts
│           │   ├── createRequestWorkflow.ts
│           │   ├── disputeInvoiceWorkflow.ts
│           │   ├── evaluateLegalRoutingWorkflow.ts
│           │   ├── issueInvoiceWorkflow.ts
│           │   ├── markLeaseReadyWorkflow.ts
│           │   ├── payInvoiceWorkflow.ts
│           │   ├── submitRentalApplicationWorkflow.ts
│           │   ├── terminateLeaseWorkflow.ts
│           │   └── unassignContractorWorkflow.ts
│           │
│           └── __tests__/
│               ├── testHelpers.ts
│               ├── assetInventory.test.ts
│               ├── auth.manager-gates.test.ts
│               ├── billingEntities.test.ts
│               ├── contracts.test.ts
│               ├── domainEvents.test.ts
│               ├── financials.test.ts
│               ├── httpErrors.test.ts
│               ├── ia.test.ts
│               ├── inventory.test.ts
│               ├── invoicePDF.test.ts
│               ├── jobs.and.invoices.test.ts
│               ├── leases.test.ts
│               ├── legalEngine.test.ts
│               ├── notifications.test.ts
│               ├── openApiSync.test.ts
│               ├── orgIsolation.test.ts
│               ├── ownerDirect.foundation.test.ts
│               ├── ownerDirect.governance.test.ts
│               ├── qrBill.test.ts
│               ├── rentEstimation.test.ts
│               ├── rentalContracts.test.ts
│               ├── rentalIntegration.test.ts
│               ├── requests.test.ts
│               ├── routeProtection.test.ts
│               ├── tenantSession.test.ts
│               ├── triage.test.ts
│               ├── unitConfig.cascade.test.ts
│               └── workflows.test.ts
│
├── ── Frontend (apps/web) ────────────────────────
│
└── apps/web/
    ├── .env.local
    ├── jsconfig.json
    ├── next-env.d.ts
    ├── package.json
    ├── postcss.config.js
    ├── tailwind.config.js
    ├── tsconfig.json
    │
    ├── styles/
    │   ├── global.css
    │   ├── globals.css
    │   └── managerStyles.js
    │
    ├── lib/
    │   ├── api.js                  # authHeaders(), fetch helpers
    │   ├── categories.js
    │   ├── format.js
    │   ├── formatDisqualificationReasons.js
    │   ├── proxy.js                # Backend proxy utility
    │   └── utils.js
    │
    ├── components/
    │   ├── AppShell.js             # Main layout shell (role-based sidebar)
    │   ├── AssetInventoryPanel.js
    │   ├── BillingEntityManager.js
    │   ├── ContractorPicker.js
    │   ├── DocumentsPanel.js
    │   ├── ManagerSidebar.js       # Accordion sidebar for MANAGER role
    │   ├── NotificationBell.js
    │   ├── layout/
    │   │   ├── PageContent.jsx
    │   │   ├── PageHeader.jsx
    │   │   ├── PageShell.jsx
    │   │   ├── Panel.jsx
    │   │   ├── Section.jsx
    │   │   └── SidebarLayout.jsx
    │   └── ui/
    │       ├── UndoToast.js
    │       └── navigation-menu.tsx
    │
    └── pages/
        ├── _app.js
        ├── index.js                # Landing / login redirect
        ├── login.js
        ├── apply.js                # Public rental application
        ├── listings.js             # Public vacant unit listings
        ├── contractors.js
        ├── tenant-chat.js
        ├── tenant-form.js
        ├── tenant.js
        │
        ├── ── Admin Inventory ────────────────────
        ├── admin-inventory.js
        ├── admin-inventory/
        │   ├── asset-models.js
        │   ├── buildings/
        │   │   ├── index.js
        │   │   └── [id].js
        │   └── units/
        │       └── [id].js
        │
        ├── ── Contractor Portal ──────────────────
        ├── contractor/
        │   ├── index.js
        │   ├── estimates.js
        │   ├── invoices.js
        │   ├── jobs.js
        │   ├── jobs/
        │   │   └── [id].js
        │   └── status-updates.js
        │
        ├── ── Manager Portal ─────────────────────
        ├── manager/
        │   ├── index.js            # Manager dashboard
        │   ├── assets.js
        │   ├── emails.js
        │   ├── legal.js
        │   ├── properties.js
        │   ├── reports.js
        │   ├── requests.js
        │   ├── rfps.js
        │   ├── settings.js
        │   ├── work-requests.js
        │   │
        │   ├── buildings/
        │   │   └── [id]/
        │   │       └── financials.js
        │   │
        │   ├── finance/
        │   │   ├── index.js
        │   │   ├── billing-entities.js
        │   │   ├── charges.js
        │   │   ├── expenses.js
        │   │   ├── invoices.js
        │   │   ├── ledger.js
        │   │   └── payments.js
        │   │
        │   ├── leases/
        │   │   ├── index.js
        │   │   ├── [id].js
        │   │   └── templates.js
        │   │
        │   ├── legal/
        │   │   ├── depreciation.js
        │   │   ├── evaluations.js
        │   │   ├── mappings.js
        │   │   └── rules.js
        │   │
        │   ├── operations/
        │   │   ├── contractors.js  # Redirect stub → /manager/people/vendors
        │   │   ├── inventory.js
        │   │   └── tenants.js      # Redirect stub → /manager/people/tenants
        │   │
        │   ├── people/
        │   │   ├── index.js        # People hub page
        │   │   ├── tenants.js      # Tenant list page
        │   │   ├── vendors.js      # Vendor/contractor list page
        │   │   ├── tenants/
        │   │   │   └── [id].js     # Tenant detail page
        │   │   └── vendors/
        │   │       └── [id].js     # Vendor detail page
        │   │
        │   ├── rental-applications/
        │   │   └── [applicationId].js
        │   │
        │   └── vacancies/
        │       ├── index.js
        │       └── [unitId]/
        │           └── applications.js
        │
        ├── ── Owner Portal ───────────────────────
        ├── owner/
        │   ├── index.js            # Owner dashboard
        │   ├── approvals.js
        │   ├── billing-entities.js
        │   ├── invoices.js
        │   ├── jobs.js
        │   ├── vacancies.js
        │   └── vacancies/
        │       └── [unitId]/
        │           ├── candidates.js
        │           └── fill.js
        │
        ├── ── Tenant Portal ──────────────────────
        ├── tenant/
        │   ├── assets.js
        │   ├── inbox.js
        │   ├── invoices.js
        │   └── leases/
        │       ├── index.js
        │       └── [id].js
        │
        └── ── API Proxy Routes ───────────────────
        └── api/
            ├── appliances/
            │   └── [id].js
            ├── approval-rules.js
            ├── approval-rules/
            │   └── [id].js
            ├── asset-models.js
            ├── asset-models/
            │   └── [id].js
            ├── assets/
            │   └── [id]/
            │       └── interventions.js
            ├── auth/
            │   ├── login.js
            │   └── register.js
            ├── billing-entities/
            │   ├── index.js
            │   └── [id].js
            ├── buildings.js
            ├── buildings/
            │   └── [id].js
            │   └── [id]/
            │       ├── asset-inventory.js
            │       ├── assets.js
            │       ├── config.js
            │       ├── financials.js
            │       ├── units.js
            │       └── owners/
            │           ├── index.js
            │           ├── candidates.js
            │           └── [userId].js
            ├── contractor/
            │   ├── invoices.js
            │   ├── invoices/
            │   │   └── [id].js
            │   ├── jobs.js
            │   └── jobs/
            │       └── [id].js
            ├── contractors.js
            ├── contractors/
            │   └── [id].js
            ├── dev/
            │   └── emails/
            │       ├── index.js
            │       └── [id].js
            ├── document-scan.js
            ├── financials/
            │   └── portfolio-summary.js
            ├── invoices.js
            ├── invoices/
            │   ├── index.js
            │   ├── [id].js
            │   └── [id]/
            │       └── [action].js
            ├── jobs.js
            ├── jobs/
            │   └── [id].js
            ├── lease-templates/
            │   ├── index.js
            │   ├── from-lease.js
            │   └── [id]/
            │       ├── index.js
            │       ├── create-lease.js
            │       └── restore.js
            ├── leases/
            │   ├── index.js
            │   └── [...id].js
            ├── legal/
            │   ├── category-mappings.js
            │   ├── category-mappings/
            │   │   ├── [id].js
            │   │   └── coverage.js
            │   ├── depreciation-standards.js
            │   ├── evaluations.js
            │   ├── ingestion/
            │   │   └── trigger.js
            │   ├── rules.js
            │   ├── rules/
            │   │   └── [id]/
            │   │       └── versions.js
            │   ├── sources.js
            │   ├── sources/
            │   │   └── [id].js
            │   └── variables.js
            ├── manager/
            │   ├── rental-application-units/
            │   │   └── [id]/
            │   │       ├── adjust-score.js
            │   │       └── override-disqualification.js
            │   ├── rental-applications/
            │   │   ├── index.js
            │   │   └── [id].js
            │   └── selections.js
            ├── notifications/
            │   ├── index.js
            │   ├── mark-all-read.js
            │   ├── unread-count.js
            │   └── [id]/
            │       ├── index.js
            │       └── read.js
            ├── org-config.js
            ├── owner/
            │   ├── approvals.js
            │   ├── invoices.js
            │   ├── rental-application-units/
            │   │   └── [id]/
            │   │       └── override-disqualification.js
            │   ├── rental-applications.js
            │   ├── selections.js
            │   └── units/
            │       └── [unitId]/
            │           └── select-tenants.js
            ├── people/
            │   ├── tenants.js
            │   └── vendors.js
            ├── properties.js
            ├── properties/
            │   └── [id]/
            │       └── units.js
            ├── rent-estimation/
            │   ├── bulk.js
            │   ├── config.js
            │   └── config/
            │       └── [canton].js
            ├── rental-applications/
            │   ├── index.js
            │   ├── [...id].js
            │   └── [id]/
            │       └── submit.js
            ├── rental-attachments/
            │   └── [attachmentId]/
            │       └── download.js
            ├── requests.js
            ├── requests/
            │   ├── approve.js
            │   ├── contractor.js
            │   └── [id].js
            │   └── [id]/
            │       ├── assign.js
            │       ├── events.js
            │       ├── legal-decision.js
            │       ├── owner-approve.js
            │       ├── status.js
            │       └── suggest-contractor.js
            ├── rfps/
            │   ├── index.js
            │   └── [id].js
            ├── signature-requests/
            │   ├── index.js
            │   └── [...id].js
            ├── tenant-portal/
            │   ├── invoices.js
            │   ├── leases/
            │   │   ├── index.js
            │   │   └── [...id].js
            │   └── notifications/
            │       ├── index.js
            │       ├── mark-all-read.js
            │       ├── unread-count.js
            │       └── [id]/
            │           ├── index.js
            │           └── [...action].js
            ├── tenant-session.js
            ├── tenants.js
            ├── tenants/
            │   └── [id].js
            ├── triage.js
            ├── units/
            │   ├── index.js
            │   └── [id].js
            │   └── [id]/
            │       ├── appliances.js
            │       ├── asset-inventory.js
            │       ├── assets.js
            │       ├── rent-estimate.js
            │       ├── tenants.js
            │       └── tenants/
            │           └── [tenantId].js
            ├── vacant-units.js
            ├── work-requests.js
            └── work-requests/
                └── [id].js
```

## Quick Stats

| Area | Count |
|------|-------|
| Backend source files (`src/`) | ~95 `.ts` files |
| Backend tests | 28 test files |
| Backend routes | 14 route modules |
| Backend services | 38 service files |
| Backend validations | 27 validation schemas |
| Backend workflows | 14 workflow files |
| Backend repositories | 8 repository files |
| Database migrations | 28 migrations |
| Frontend pages | ~75 page files |
| Frontend API proxy routes | ~100 proxy files |
| Frontend components | ~15 component files |
| Frontend lib utilities | 6 shared modules |

## Excluded from Tree

- `node_modules/` — dependency directories
- `.next/` — Next.js build cache
- `apps/api/dist/` — compiled JS output
- `apps/api/.data/uploads/` — runtime file uploads
- `_archive/` — legacy docs and scripts
- `*.traineddata` — OCR training data (Tesseract)
- `package-lock.json` — lock files
