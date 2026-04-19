/**
 * Org Isolation Tests
 *
 * Verifies that the org scope resolver and assertion logic in
 * governance/orgScope.ts correctly enforces cross-org isolation
 * for Request, Job, Invoice, and Lease entities.
 *
 * These are unit tests using mocked Prisma calls — no live DB needed.
 */

import {
  resolveRequestOrg,
  resolveJobOrg,
  resolveInvoiceOrg,
  resolveLeaseOrg,
  resolveApplianceOrg,
  resolveAssetOrg,
  assertOrgScope,
  OrgScopeMismatchError,
  OrgResolution,
} from "../governance/orgScope";
import { resolveAndScopeRequest } from "../repositories/requestRepository";

// ────────────── Helpers ──────────────────────────────────────

const ORG_A = "org-aaaa-aaaa";
const ORG_B = "org-bbbb-bbbb";

function mockPrisma(overrides: Record<string, any> = {}): any {
  return {
    request: {
      findUnique: overrides.requestFindUnique ?? jest.fn().mockResolvedValue(null),
    },
    job: {
      findUnique: overrides.jobFindUnique ?? jest.fn().mockResolvedValue(null),
    },
    invoice: {
      findUnique: overrides.invoiceFindUnique ?? jest.fn().mockResolvedValue(null),
    },
    lease: {
      findUnique: overrides.leaseFindUnique ?? jest.fn().mockResolvedValue(null),
    },
    appliance: {
      findUnique: overrides.applianceFindUnique ?? jest.fn().mockResolvedValue(null),
    },
    asset: {
      findUnique: overrides.assetFindUnique ?? jest.fn().mockResolvedValue(null),
    },
  };
}

// ────────────── resolveAndScopeRequest (direct FK path) ──────

describe("resolveAndScopeRequest", () => {
  it("returns { id } when request is in scope", async () => {
    const prisma: any = {
      request: {
        findFirst: jest.fn().mockResolvedValue({ id: "req-uuid-1" }),
        findUnique: jest.fn().mockResolvedValue(null), // not a numeric param
      },
    };
    const result = await resolveAndScopeRequest(prisma, "req-uuid-1", ORG_A);
    expect(result).toEqual({ id: "req-uuid-1" });
    expect(prisma.request.findFirst).toHaveBeenCalledWith({
      where: { id: "req-uuid-1", orgId: ORG_A },
      select: { id: true },
    });
  });

  it("returns null when request belongs to a different org (cross-org block)", async () => {
    const prisma: any = {
      request: {
        findFirst: jest.fn().mockResolvedValue(null), // orgId mismatch → no row
        findUnique: jest.fn().mockResolvedValue(null),
      },
    };
    const result = await resolveAndScopeRequest(prisma, "req-uuid-2", ORG_B);
    expect(result).toBeNull();
  });

  it("returns null when request does not exist", async () => {
    const prisma: any = {
      request: {
        findFirst: jest.fn().mockResolvedValue(null),
        findUnique: jest.fn().mockResolvedValue(null),
      },
    };
    const result = await resolveAndScopeRequest(prisma, "nonexistent-id", ORG_A);
    expect(result).toBeNull();
  });

  it("resolves by requestNumber (numeric param) then scopes by orgId", async () => {
    const prisma: any = {
      request: {
        findUnique: jest.fn().mockResolvedValue({ id: "req-uuid-3" }), // numeric lookup
        findFirst: jest.fn().mockResolvedValue({ id: "req-uuid-3" }),
      },
    };
    const result = await resolveAndScopeRequest(prisma, "42", ORG_A);
    expect(result).toEqual({ id: "req-uuid-3" });
    expect(prisma.request.findUnique).toHaveBeenCalledWith({
      where: { requestNumber: 42 },
      select: { id: true },
    });
  });

  it("returns null when requestNumber not found", async () => {
    const prisma: any = {
      request: {
        findUnique: jest.fn().mockResolvedValue(null), // requestNumber not found
        findFirst: jest.fn(),
      },
    };
    const result = await resolveAndScopeRequest(prisma, "999", ORG_A);
    expect(result).toBeNull();
    expect(prisma.request.findFirst).not.toHaveBeenCalled();
  });
});

// ────────────── resolveRequestOrg ────────────────────────────

describe("resolveRequestOrg", () => {
  it("resolves via unit.orgId when present", async () => {
    const prisma = mockPrisma({
      requestFindUnique: jest.fn().mockResolvedValue({
        unitId: "u1",
        tenantId: "t1",
        applianceId: null,
        assignedContractorId: null,
        unit: { orgId: ORG_A },
        tenant: { orgId: ORG_A },
        appliance: null,
        assignedContractor: null,
      }),
    });

    const result = await resolveRequestOrg(prisma, "req-1");
    expect(result).toEqual({ resolved: true, orgId: ORG_A, via: "unit" });
  });

  it("falls back to tenant.orgId when unit is null", async () => {
    const prisma = mockPrisma({
      requestFindUnique: jest.fn().mockResolvedValue({
        unitId: null,
        tenantId: "t1",
        applianceId: null,
        assignedContractorId: null,
        unit: null,
        tenant: { orgId: ORG_B },
        appliance: null,
        assignedContractor: null,
      }),
    });

    const result = await resolveRequestOrg(prisma, "req-2");
    expect(result).toEqual({ resolved: true, orgId: ORG_B, via: "tenant" });
  });

  it("falls back to appliance.orgId", async () => {
    const prisma = mockPrisma({
      requestFindUnique: jest.fn().mockResolvedValue({
        unitId: null,
        tenantId: null,
        applianceId: "a1",
        assignedContractorId: null,
        unit: null,
        tenant: null,
        appliance: { orgId: ORG_A },
        assignedContractor: null,
      }),
    });

    const result = await resolveRequestOrg(prisma, "req-3");
    expect(result).toEqual({ resolved: true, orgId: ORG_A, via: "appliance" });
  });

  it("falls back to contractor.orgId", async () => {
    const prisma = mockPrisma({
      requestFindUnique: jest.fn().mockResolvedValue({
        unitId: null,
        tenantId: null,
        applianceId: null,
        assignedContractorId: "c1",
        unit: null,
        tenant: null,
        appliance: null,
        assignedContractor: { orgId: ORG_B },
      }),
    });

    const result = await resolveRequestOrg(prisma, "req-4");
    expect(result).toEqual({ resolved: true, orgId: ORG_B, via: "contractor" });
  });

  it("returns unresolved when all FKs are null", async () => {
    const prisma = mockPrisma({
      requestFindUnique: jest.fn().mockResolvedValue({
        unitId: null,
        tenantId: null,
        applianceId: null,
        assignedContractorId: null,
        unit: null,
        tenant: null,
        appliance: null,
        assignedContractor: null,
      }),
    });

    const result = await resolveRequestOrg(prisma, "req-5");
    expect(result).toEqual({ resolved: false, orgId: null, via: "none" });
  });

  it("returns unresolved when request does not exist", async () => {
    const prisma = mockPrisma(); // findUnique returns null
    const result = await resolveRequestOrg(prisma, "nonexistent");
    expect(result).toEqual({ resolved: false, orgId: null, via: "none" });
  });

  it("resolves directly from request.orgId (DT-114 direct column path)", async () => {
    const prisma = mockPrisma({
      requestFindUnique: jest.fn().mockResolvedValue({
        orgId: ORG_A,
        unitId: null,
        tenantId: null,
        applianceId: null,
        assignedContractorId: null,
        unit: null,
        tenant: null,
        appliance: null,
        assignedContractor: null,
      }),
    });
    const result = await resolveRequestOrg(prisma, "req-direct");
    expect(result).toEqual({ resolved: true, orgId: ORG_A, via: "request" });
  });

  it("direct orgId takes priority over FK chains", async () => {
    const prisma = mockPrisma({
      requestFindUnique: jest.fn().mockResolvedValue({
        orgId: ORG_A,
        unitId: "u1",
        tenantId: null,
        applianceId: null,
        assignedContractorId: null,
        unit: { orgId: ORG_B }, // different org — should be ignored
        tenant: null,
        appliance: null,
        assignedContractor: null,
      }),
    });
    const result = await resolveRequestOrg(prisma, "req-priority");
    expect(result).toEqual({ resolved: true, orgId: ORG_A, via: "request" });
  });
});

// ────────────── resolveJobOrg ────────────────────────────────

describe("resolveJobOrg", () => {
  it("resolves directly from job.orgId", async () => {
    const prisma = mockPrisma({
      jobFindUnique: jest.fn().mockResolvedValue({ orgId: ORG_A }),
    });
    const result = await resolveJobOrg(prisma, "job-1");
    expect(result).toEqual({ resolved: true, orgId: ORG_A, via: "job" });
  });

  it("returns unresolved when job not found", async () => {
    const prisma = mockPrisma();
    const result = await resolveJobOrg(prisma, "nonexistent");
    expect(result).toEqual({ resolved: false, orgId: null, via: "none" });
  });
});

// ────────────── resolveInvoiceOrg ────────────────────────────

describe("resolveInvoiceOrg", () => {
  it("resolves directly from invoice.orgId", async () => {
    const prisma = mockPrisma({
      invoiceFindUnique: jest.fn().mockResolvedValue({ orgId: ORG_B }),
    });
    const result = await resolveInvoiceOrg(prisma, "inv-1");
    expect(result).toEqual({ resolved: true, orgId: ORG_B, via: "invoice" });
  });

  it("returns unresolved when invoice not found", async () => {
    const prisma = mockPrisma();
    const result = await resolveInvoiceOrg(prisma, "nonexistent");
    expect(result).toEqual({ resolved: false, orgId: null, via: "none" });
  });
});

// ────────────── resolveLeaseOrg ──────────────────────────────

describe("resolveLeaseOrg", () => {
  it("resolves directly from lease.orgId", async () => {
    const prisma = mockPrisma({
      leaseFindUnique: jest.fn().mockResolvedValue({ orgId: ORG_A }),
    });
    const result = await resolveLeaseOrg(prisma, "lease-1");
    expect(result).toEqual({ resolved: true, orgId: ORG_A, via: "lease" });
  });

  it("returns unresolved when lease not found", async () => {
    const prisma = mockPrisma();
    const result = await resolveLeaseOrg(prisma, "nonexistent");
    expect(result).toEqual({ resolved: false, orgId: null, via: "none" });
  });
});

// ────────────── resolveApplianceOrg ──────────────────────────

describe("resolveApplianceOrg", () => {
  it("resolves directly from appliance.orgId", async () => {
    const prisma = mockPrisma({
      applianceFindUnique: jest.fn().mockResolvedValue({ orgId: ORG_A }),
    });
    const result = await resolveApplianceOrg(prisma, "appl-1");
    expect(result).toEqual({ resolved: true, orgId: ORG_A, via: "appliance" });
  });

  it("returns unresolved when appliance not found", async () => {
    const prisma = mockPrisma();
    const result = await resolveApplianceOrg(prisma, "nonexistent");
    expect(result).toEqual({ resolved: false, orgId: null, via: "none" });
  });
});

// ────────────── resolveAssetOrg ──────────────────────────────

describe("resolveAssetOrg", () => {
  it("resolves directly from asset.orgId", async () => {
    const prisma = mockPrisma({
      assetFindUnique: jest.fn().mockResolvedValue({ orgId: ORG_B }),
    });
    const result = await resolveAssetOrg(prisma, "asset-1");
    expect(result).toEqual({ resolved: true, orgId: ORG_B, via: "asset" });
  });

  it("returns unresolved when asset not found", async () => {
    const prisma = mockPrisma();
    const result = await resolveAssetOrg(prisma, "nonexistent");
    expect(result).toEqual({ resolved: false, orgId: null, via: "none" });
  });
});

// ────────────── assertOrgScope ───────────────────────────────

describe("assertOrgScope", () => {
  it("allows access when resolved org matches caller", () => {
    const resolution: OrgResolution = { resolved: true, orgId: ORG_A, via: "unit" };
    expect(() => assertOrgScope(ORG_A, resolution)).not.toThrow();
  });

  it("throws OrgScopeMismatchError on cross-org access", () => {
    const resolution: OrgResolution = { resolved: true, orgId: ORG_A, via: "unit" };
    expect(() => assertOrgScope(ORG_B, resolution)).toThrow(OrgScopeMismatchError);
  });

  it("the mismatch error contains caller and entity org IDs", () => {
    const resolution: OrgResolution = { resolved: true, orgId: ORG_A, via: "tenant" };
    try {
      assertOrgScope(ORG_B, resolution);
      fail("Expected OrgScopeMismatchError");
    } catch (e) {
      expect(e).toBeInstanceOf(OrgScopeMismatchError);
      const err = e as OrgScopeMismatchError;
      expect(err.callerOrgId).toBe(ORG_B);
      expect(err.entityOrgId).toBe(ORG_A);
      expect(err.via).toBe("tenant");
    }
  });

  it("allows orphan requests in dev mode", () => {
    const resolution: OrgResolution = { resolved: false, orgId: null, via: "none" };
    // NODE_ENV is "test" in jest, which is not "production"
    expect(() => assertOrgScope(ORG_A, resolution)).not.toThrow();
  });

  it("rejects orphan requests in production", () => {
    const origEnv = process.env.NODE_ENV;
    process.env.NODE_ENV = "production";
    try {
      const resolution: OrgResolution = { resolved: false, orgId: null, via: "none" };
      expect(() => assertOrgScope(ORG_A, resolution)).toThrow(OrgScopeMismatchError);
    } finally {
      process.env.NODE_ENV = origEnv;
    }
  });
});

// ────────────── Cross-org matrix (end-to-end resolver + assertion) ───

describe("cross-org isolation matrix", () => {
  const scenarios = [
    {
      name: "Request via unit in Org A accessed by Org B → blocked",
      setup: {
        requestFindUnique: jest.fn().mockResolvedValue({
          unitId: "u1", tenantId: null, applianceId: null, assignedContractorId: null,
          unit: { orgId: ORG_A }, tenant: null, appliance: null, assignedContractor: null,
        }),
      },
      entity: "request" as const,
      entityId: "req-cross-1",
      callerOrg: ORG_B,
      shouldBlock: true,
    },
    {
      name: "Request via tenant in Org B accessed by Org B → allowed",
      setup: {
        requestFindUnique: jest.fn().mockResolvedValue({
          unitId: null, tenantId: "t1", applianceId: null, assignedContractorId: null,
          unit: null, tenant: { orgId: ORG_B }, appliance: null, assignedContractor: null,
        }),
      },
      entity: "request" as const,
      entityId: "req-cross-2",
      callerOrg: ORG_B,
      shouldBlock: false,
    },
    {
      name: "Job in Org A accessed by Org B → blocked",
      setup: { jobFindUnique: jest.fn().mockResolvedValue({ orgId: ORG_A }) },
      entity: "job" as const,
      entityId: "job-cross-1",
      callerOrg: ORG_B,
      shouldBlock: true,
    },
    {
      name: "Invoice in Org A accessed by Org A → allowed",
      setup: { invoiceFindUnique: jest.fn().mockResolvedValue({ orgId: ORG_A }) },
      entity: "invoice" as const,
      entityId: "inv-cross-1",
      callerOrg: ORG_A,
      shouldBlock: false,
    },
    {
      name: "Lease in Org B accessed by Org A → blocked",
      setup: { leaseFindUnique: jest.fn().mockResolvedValue({ orgId: ORG_B }) },
      entity: "lease" as const,
      entityId: "lease-cross-1",
      callerOrg: ORG_A,
      shouldBlock: true,
    },
    {
      name: "Appliance in Org A accessed by Org B → blocked",
      setup: { applianceFindUnique: jest.fn().mockResolvedValue({ orgId: ORG_A }) },
      entity: "appliance" as const,
      entityId: "appl-cross-1",
      callerOrg: ORG_B,
      shouldBlock: true,
    },
    {
      name: "Appliance in Org A accessed by Org A → allowed",
      setup: { applianceFindUnique: jest.fn().mockResolvedValue({ orgId: ORG_A }) },
      entity: "appliance" as const,
      entityId: "appl-cross-2",
      callerOrg: ORG_A,
      shouldBlock: false,
    },
    {
      name: "Asset in Org B accessed by Org A → blocked",
      setup: { assetFindUnique: jest.fn().mockResolvedValue({ orgId: ORG_B }) },
      entity: "asset" as const,
      entityId: "asset-cross-1",
      callerOrg: ORG_A,
      shouldBlock: true,
    },
    {
      name: "Asset in Org B accessed by Org B → allowed",
      setup: { assetFindUnique: jest.fn().mockResolvedValue({ orgId: ORG_B }) },
      entity: "asset" as const,
      entityId: "asset-cross-2",
      callerOrg: ORG_B,
      shouldBlock: false,
    },
  ];

  const resolverMap = {
    request: resolveRequestOrg,
    job: resolveJobOrg,
    invoice: resolveInvoiceOrg,
    lease: resolveLeaseOrg,
    appliance: resolveApplianceOrg,
    asset: resolveAssetOrg,
  } as const;

  for (const scenario of scenarios) {
    it(scenario.name, async () => {
      const prisma = mockPrisma(scenario.setup);
      const resolver = resolverMap[scenario.entity];
      const resolution = await resolver(prisma, scenario.entityId);

      if (scenario.shouldBlock) {
        expect(() => assertOrgScope(scenario.callerOrg, resolution)).toThrow(OrgScopeMismatchError);
      } else {
        expect(() => assertOrgScope(scenario.callerOrg, resolution)).not.toThrow();
      }
    });
  }
});
