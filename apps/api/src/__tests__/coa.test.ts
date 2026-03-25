/**
 * FIN-COA-01: Chart of Accounts Foundation — Integration Tests
 *
 * Tests the full stack: seed → CRUD for ExpenseType, Account, ExpenseMapping.
 * Uses the service layer directly (same pattern as financials.test.ts).
 */
import { PrismaClient } from "@prisma/client";
import {
  listExpenseTypes,
  getExpenseType,
  createExpenseType,
  updateExpenseType,
  listAccounts,
  getAccount,
  createAccount,
  updateAccount,
  listExpenseMappings,
  createExpenseMapping,
  deleteExpenseMapping,
  seedSwissTaxonomy,
  NotFoundError,
  ConflictError,
} from "../services/coaService";

const prisma = new PrismaClient();

describe("Chart of Accounts (FIN-COA-01)", () => {
  let orgId: string;
  let org2Id: string;

  beforeAll(async () => {
    const org = await prisma.org.create({ data: { name: `COA Test Org ${Date.now()}` } });
    orgId = org.id;
    const org2 = await prisma.org.create({ data: { name: `COA Isolation Org ${Date.now()}` } });
    org2Id = org2.id;
  });

  afterAll(async () => {
    // Clean up in reverse FK order
    await prisma.expenseMapping.deleteMany({ where: { orgId: { in: [orgId, org2Id] } } });
    await prisma.expenseType.deleteMany({ where: { orgId: { in: [orgId, org2Id] } } });
    await prisma.account.deleteMany({ where: { orgId: { in: [orgId, org2Id] } } });
    await prisma.org.deleteMany({ where: { id: { in: [orgId, org2Id] } } });
    await prisma.$disconnect();
  });

  // ═══════════════════════════════════════════════════════════
  // Seed
  // ═══════════════════════════════════════════════════════════

  describe("seedSwissTaxonomy", () => {
    it("populates canonical expense types, accounts, and default mappings", async () => {
      const result = await seedSwissTaxonomy(prisma, orgId);
      expect(result.expenseTypes).toBeGreaterThanOrEqual(8);
      expect(result.accounts).toBeGreaterThanOrEqual(2);
      expect(result.mappings).toBeGreaterThanOrEqual(8);
    });

    it("is idempotent — running again does not create duplicates", async () => {
      const result = await seedSwissTaxonomy(prisma, orgId);
      // Upserts don't create new rows, and duplicate mappings are skipped
      expect(result.expenseTypes).toBeGreaterThanOrEqual(8);
      expect(result.mappings).toBe(0); // all mappings already exist
    });
  });

  // ═══════════════════════════════════════════════════════════
  // ExpenseType CRUD
  // ═══════════════════════════════════════════════════════════

  describe("ExpenseType", () => {
    it("listExpenseTypes returns seeded types sorted by name", async () => {
      const types = await listExpenseTypes(prisma, orgId);
      expect(types.length).toBeGreaterThanOrEqual(8);
      // Check sorted
      const names = types.map((t) => t.name);
      const sorted = [...names].sort((a, b) => a.localeCompare(b, "en-US"));
      expect(names).toEqual(sorted);
    });

    it("createExpenseType creates a new type", async () => {
      const et = await createExpenseType(prisma, orgId, {
        name: "Custom Test Type",
        description: "A test type",
        code: "TEST-1",
      });
      expect(et.name).toBe("Custom Test Type");
      expect(et.description).toBe("A test type");
      expect(et.code).toBe("TEST-1");
      expect(et.orgId).toBe(orgId);
      expect(et.isActive).toBe(true);
      expect(et.id).toBeDefined();
    });

    it("createExpenseType returns 409 on duplicate name within org", async () => {
      await expect(
        createExpenseType(prisma, orgId, { name: "Custom Test Type" }),
      ).rejects.toThrow(ConflictError);
    });

    it("allows same name in different org", async () => {
      const et = await createExpenseType(prisma, org2Id, {
        name: "Custom Test Type",
      });
      expect(et.orgId).toBe(org2Id);
    });

    it("getExpenseType returns a specific type", async () => {
      const types = await listExpenseTypes(prisma, orgId);
      const et = await getExpenseType(prisma, types[0].id);
      expect(et.id).toBe(types[0].id);
      expect(et.name).toBeDefined();
    });

    it("getExpenseType throws NotFoundError for missing ID", async () => {
      await expect(
        getExpenseType(prisma, "00000000-0000-0000-0000-000000000000"),
      ).rejects.toThrow(NotFoundError);
    });

    it("updateExpenseType modifies fields", async () => {
      const et = await createExpenseType(prisma, orgId, { name: "To Rename" });
      const updated = await updateExpenseType(prisma, et.id, orgId, {
        name: "Renamed Type",
        isActive: false,
      });
      expect(updated.name).toBe("Renamed Type");
      expect(updated.isActive).toBe(false);
    });
  });

  // ═══════════════════════════════════════════════════════════
  // Account CRUD
  // ═══════════════════════════════════════════════════════════

  describe("Account", () => {
    it("listAccounts returns seeded accounts sorted by name", async () => {
      const accounts = await listAccounts(prisma, orgId);
      expect(accounts.length).toBeGreaterThanOrEqual(2);
      const names = accounts.map((a) => a.name);
      const sorted = [...names].sort((a, b) => a.localeCompare(b, "en-US"));
      expect(names).toEqual(sorted);
    });

    it("createAccount creates a new account", async () => {
      const a = await createAccount(prisma, orgId, {
        name: "Test Revenue Account",
        code: "9000",
        accountType: "REVENUE",
      });
      expect(a.name).toBe("Test Revenue Account");
      expect(a.code).toBe("9000");
      expect(a.accountType).toBe("REVENUE");
      expect(a.orgId).toBe(orgId);
    });

    it("createAccount returns 409 on duplicate name within org", async () => {
      await expect(
        createAccount(prisma, orgId, { name: "Test Revenue Account" }),
      ).rejects.toThrow(ConflictError);
    });

    it("getAccount returns a specific account", async () => {
      const accounts = await listAccounts(prisma, orgId);
      const a = await getAccount(prisma, accounts[0].id);
      expect(a.id).toBe(accounts[0].id);
    });

    it("getAccount throws NotFoundError for missing ID", async () => {
      await expect(
        getAccount(prisma, "00000000-0000-0000-0000-000000000000"),
      ).rejects.toThrow(NotFoundError);
    });

    it("updateAccount modifies fields", async () => {
      const a = await createAccount(prisma, orgId, { name: "To Update Account" });
      const updated = await updateAccount(prisma, a.id, orgId, {
        code: "UPDATED",
        isActive: false,
      });
      expect(updated.code).toBe("UPDATED");
      expect(updated.isActive).toBe(false);
    });
  });

  // ═══════════════════════════════════════════════════════════
  // ExpenseMapping CRUD
  // ═══════════════════════════════════════════════════════════

  describe("ExpenseMapping", () => {
    it("listExpenseMappings returns seeded mappings with joined data", async () => {
      const mappings = await listExpenseMappings(prisma, orgId);
      expect(mappings.length).toBeGreaterThanOrEqual(8);
      // Check joined fields are populated
      const first = mappings[0];
      expect(first.expenseType).toBeDefined();
      expect(first.expenseType!.name).toBeDefined();
      expect(first.account).toBeDefined();
      expect(first.account!.name).toBeDefined();
    });

    it("createExpenseMapping creates a new mapping", async () => {
      const et = await createExpenseType(prisma, orgId, { name: "Mapping Test Type" });
      const accounts = await listAccounts(prisma, orgId);

      const mapping = await createExpenseMapping(prisma, orgId, {
        expenseTypeId: et.id,
        accountId: accounts[0].id,
      });
      expect(mapping.expenseTypeId).toBe(et.id);
      expect(mapping.accountId).toBe(accounts[0].id);
      expect(mapping.buildingId).toBeNull();
      expect(mapping.orgId).toBe(orgId);
    });

    it("createExpenseMapping returns 409 on duplicate (same expense type + null building)", async () => {
      const et = await createExpenseType(prisma, orgId, { name: "Dup Mapping Type" });
      const accounts = await listAccounts(prisma, orgId);

      await createExpenseMapping(prisma, orgId, {
        expenseTypeId: et.id,
        accountId: accounts[0].id,
      });

      await expect(
        createExpenseMapping(prisma, orgId, {
          expenseTypeId: et.id,
          accountId: accounts[1]?.id || accounts[0].id,
        }),
      ).rejects.toThrow(ConflictError);
    });

    it("createExpenseMapping throws NotFoundError for invalid expenseTypeId", async () => {
      const accounts = await listAccounts(prisma, orgId);
      await expect(
        createExpenseMapping(prisma, orgId, {
          expenseTypeId: "00000000-0000-0000-0000-000000000000",
          accountId: accounts[0].id,
        }),
      ).rejects.toThrow(NotFoundError);
    });

    it("createExpenseMapping throws NotFoundError for invalid accountId", async () => {
      const types = await listExpenseTypes(prisma, orgId);
      await expect(
        createExpenseMapping(prisma, orgId, {
          expenseTypeId: types[0].id,
          accountId: "00000000-0000-0000-0000-000000000000",
        }),
      ).rejects.toThrow(NotFoundError);
    });

    it("deleteExpenseMapping removes the mapping", async () => {
      const et = await createExpenseType(prisma, orgId, { name: "Delete Test Type" });
      const accounts = await listAccounts(prisma, orgId);
      const mapping = await createExpenseMapping(prisma, orgId, {
        expenseTypeId: et.id,
        accountId: accounts[0].id,
      });

      await deleteExpenseMapping(prisma, mapping.id, orgId);

      // Verify it's gone
      const all = await listExpenseMappings(prisma, orgId);
      expect(all.find((m) => m.id === mapping.id)).toBeUndefined();
    });

    it("deleteExpenseMapping throws NotFoundError for missing mapping", async () => {
      await expect(
        deleteExpenseMapping(prisma, "00000000-0000-0000-0000-000000000000", orgId),
      ).rejects.toThrow(NotFoundError);
    });
  });

  // ═══════════════════════════════════════════════════════════
  // Org isolation
  // ═══════════════════════════════════════════════════════════

  describe("Org isolation", () => {
    it("listExpenseTypes only returns types for the requested org", async () => {
      const org1Types = await listExpenseTypes(prisma, orgId);
      const org2Types = await listExpenseTypes(prisma, org2Id);

      // org1 has seeded + custom types; org2 has only the cross-org duplicate
      expect(org1Types.length).toBeGreaterThan(org2Types.length);
      // No cross-contamination
      const org1Ids = new Set(org1Types.map((t) => t.id));
      for (const t of org2Types) {
        expect(org1Ids.has(t.id)).toBe(false);
      }
    });

    it("updateExpenseType rejects cross-org access", async () => {
      const org2Types = await listExpenseTypes(prisma, org2Id);
      if (org2Types.length === 0) return; // skip if no data
      await expect(
        updateExpenseType(prisma, org2Types[0].id, orgId, { name: "Hijacked" }),
      ).rejects.toThrow(NotFoundError);
    });
  });
});
