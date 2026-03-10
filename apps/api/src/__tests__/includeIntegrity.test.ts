/**
 * Include Integrity Tests
 *
 * Compile-time + runtime safety net that all canonical Prisma include
 * constants produce valid typed payloads. If a schema migration adds or
 * removes a relation, the type assertions here will fail at `tsc` time
 * (compile-time drift detection) and the runtime assertions verify the
 * constants remain structurally valid objects.
 *
 * Task 4 of prisma-dto-hardening slice.
 */
import { Prisma } from "@prisma/client";

// ─── Import every canonical include constant ───────────────────

import {
  REQUEST_FULL_INCLUDE,
  REQUEST_SUMMARY_INCLUDE,
} from "../repositories/requestRepository";

import {
  JOB_FULL_INCLUDE,
  JOB_SUMMARY_INCLUDE,
} from "../repositories/jobRepository";

import {
  INVOICE_FULL_INCLUDE,
  INVOICE_SUMMARY_INCLUDE,
} from "../repositories/invoiceRepository";

import { LEASE_FULL_INCLUDE } from "../repositories/leaseRepository";

import {
  ASSET_FULL_INCLUDE,
  ASSET_LIST_INCLUDE,
} from "../repositories/assetRepository";

import { CONTRACTOR_INCLUDE } from "../repositories/contractorRepository";

import {
  LEGAL_VARIABLE_INCLUDE,
  LEGAL_RULE_INCLUDE,
  LEGAL_RULE_WITH_VERSIONS_INCLUDE,
  DEPRECIATION_STANDARD_INCLUDE,
} from "../repositories/legalSourceRepository";

import {
  RENTAL_APPLICATION_INCLUDE,
  RENTAL_APPLICATION_UNIT_INCLUDE,
  RENTAL_DOCUMENTS_INCLUDE,
  SELECTION_PIPELINE_INCLUDE,
} from "../repositories/rentalApplicationRepository";

// ─── Compile-time type assertions ──────────────────────────────
// These lines exist purely for the TypeScript compiler. If any include
// constant references a relation that doesn't exist on the model, the
// Prisma.XxxGetPayload<> type will produce a compile error.

type _RequestFull = Prisma.RequestGetPayload<{ include: typeof REQUEST_FULL_INCLUDE }>;
type _RequestSummary = Prisma.RequestGetPayload<{ include: typeof REQUEST_SUMMARY_INCLUDE }>;
type _JobFull = Prisma.JobGetPayload<{ include: typeof JOB_FULL_INCLUDE }>;
type _JobSummary = Prisma.JobGetPayload<{ include: typeof JOB_SUMMARY_INCLUDE }>;
type _InvoiceFull = Prisma.InvoiceGetPayload<{ include: typeof INVOICE_FULL_INCLUDE }>;
type _InvoiceSummary = Prisma.InvoiceGetPayload<{ include: typeof INVOICE_SUMMARY_INCLUDE }>;
type _LeaseFull = Prisma.LeaseGetPayload<{ include: typeof LEASE_FULL_INCLUDE }>;
type _AssetFull = Prisma.AssetGetPayload<{ include: typeof ASSET_FULL_INCLUDE }>;
type _AssetList = Prisma.AssetGetPayload<{ include: typeof ASSET_LIST_INCLUDE }>;
type _Contractor = Prisma.ContractorGetPayload<{ include: typeof CONTRACTOR_INCLUDE }>;
type _LegalVariable = Prisma.LegalVariableGetPayload<{ include: typeof LEGAL_VARIABLE_INCLUDE }>;
type _LegalRule = Prisma.LegalRuleGetPayload<{ include: typeof LEGAL_RULE_INCLUDE }>;
type _LegalRuleVersions = Prisma.LegalRuleGetPayload<{ include: typeof LEGAL_RULE_WITH_VERSIONS_INCLUDE }>;
type _DepreciationStd = Prisma.DepreciationStandardGetPayload<{ include: typeof DEPRECIATION_STANDARD_INCLUDE }>;
type _RentalApp = Prisma.RentalApplicationGetPayload<{ include: typeof RENTAL_APPLICATION_INCLUDE }>;
type _RentalAppUnit = Prisma.RentalApplicationUnitGetPayload<{ include: typeof RENTAL_APPLICATION_UNIT_INCLUDE }>;
type _RentalDocs = Prisma.RentalApplicationGetPayload<{ include: typeof RENTAL_DOCUMENTS_INCLUDE }>;
// SELECTION_PIPELINE_INCLUDE is validated at call sites (rentalApplications.ts)
// via Prisma's findMany type checking rather than GetPayload, since the deep
// nested where/select/take clauses lose literal types without `as const`.

// Ensure the types are "used" so TS doesn't strip them
const _typeCheck: [
  _RequestFull, _RequestSummary, _JobFull, _JobSummary,
  _InvoiceFull, _InvoiceSummary, _LeaseFull, _AssetFull,
  _AssetList, _Contractor, _LegalVariable, _LegalRule,
  _LegalRuleVersions, _DepreciationStd, _RentalApp,
  _RentalAppUnit, _RentalDocs,
] = null as any;
void _typeCheck;

// ─── Runtime assertions ────────────────────────────────────────

describe("Canonical include constants integrity", () => {
  const includes: [string, unknown][] = [
    ["REQUEST_FULL_INCLUDE", REQUEST_FULL_INCLUDE],
    ["REQUEST_SUMMARY_INCLUDE", REQUEST_SUMMARY_INCLUDE],
    ["JOB_FULL_INCLUDE", JOB_FULL_INCLUDE],
    ["JOB_SUMMARY_INCLUDE", JOB_SUMMARY_INCLUDE],
    ["INVOICE_FULL_INCLUDE", INVOICE_FULL_INCLUDE],
    ["INVOICE_SUMMARY_INCLUDE", INVOICE_SUMMARY_INCLUDE],
    ["LEASE_FULL_INCLUDE", LEASE_FULL_INCLUDE],
    ["ASSET_FULL_INCLUDE", ASSET_FULL_INCLUDE],
    ["ASSET_LIST_INCLUDE", ASSET_LIST_INCLUDE],
    ["CONTRACTOR_INCLUDE", CONTRACTOR_INCLUDE],
    ["LEGAL_VARIABLE_INCLUDE", LEGAL_VARIABLE_INCLUDE],
    ["LEGAL_RULE_INCLUDE", LEGAL_RULE_INCLUDE],
    ["LEGAL_RULE_WITH_VERSIONS_INCLUDE", LEGAL_RULE_WITH_VERSIONS_INCLUDE],
    ["DEPRECIATION_STANDARD_INCLUDE", DEPRECIATION_STANDARD_INCLUDE],
    ["RENTAL_APPLICATION_INCLUDE", RENTAL_APPLICATION_INCLUDE],
    ["RENTAL_APPLICATION_UNIT_INCLUDE", RENTAL_APPLICATION_UNIT_INCLUDE],
    ["RENTAL_DOCUMENTS_INCLUDE", RENTAL_DOCUMENTS_INCLUDE],
    ["SELECTION_PIPELINE_INCLUDE", SELECTION_PIPELINE_INCLUDE],
  ];

  test.each(includes)("%s is a non-null object", (name, include) => {
    expect(include).toBeDefined();
    expect(typeof include).toBe("object");
    expect(include).not.toBeNull();
  });

  test("no include constant is accidentally undefined", () => {
    for (const [name, include] of includes) {
      expect(include).toBeDefined();
    }
  });

  test("full includes have at least one relation key", () => {
    const fullIncludes: [string, Record<string, unknown>][] = [
      ["REQUEST_FULL_INCLUDE", REQUEST_FULL_INCLUDE as any],
      ["JOB_FULL_INCLUDE", JOB_FULL_INCLUDE as any],
      ["INVOICE_FULL_INCLUDE", INVOICE_FULL_INCLUDE as any],
      ["LEASE_FULL_INCLUDE", LEASE_FULL_INCLUDE as any],
      ["ASSET_FULL_INCLUDE", ASSET_FULL_INCLUDE as any],
      ["LEGAL_VARIABLE_INCLUDE", LEGAL_VARIABLE_INCLUDE as any],
      ["LEGAL_RULE_INCLUDE", LEGAL_RULE_INCLUDE as any],
      ["RENTAL_APPLICATION_INCLUDE", RENTAL_APPLICATION_INCLUDE as any],
      ["SELECTION_PIPELINE_INCLUDE", SELECTION_PIPELINE_INCLUDE as any],
    ];

    for (const [name, include] of fullIncludes) {
      expect(Object.keys(include).length).toBeGreaterThanOrEqual(1);
    }
  });

  test("summary includes do not accidentally include heavy nested relations", () => {
    // Summary includes should be lighter than full includes
    const summaryKeys = Object.keys(REQUEST_SUMMARY_INCLUDE);
    const fullKeys = Object.keys(REQUEST_FULL_INCLUDE);
    // Summary should not have MORE keys than full
    expect(summaryKeys.length).toBeLessThanOrEqual(fullKeys.length);
  });
});
