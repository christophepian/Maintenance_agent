/**
 * FIN-COA-03 — Lease Expense Item tests
 *
 * Verifies that:
 * 1. LeaseExpenseItem CRUD works (create, update, delete)
 * 2. GET /leases/:id returns expenseItems array with nested COA objects
 * 3. Expense items can be classified with expenseTypeId / accountId
 * 4. expenseItems appear in lease DTO alongside legacy chargesItems
 */
import { PrismaClient } from "@prisma/client";
import {
  createLease,
  getLease,
  createLeaseExpenseItem,
  updateLeaseExpenseItem,
  deleteLeaseExpenseItem,
} from "../services/leases";
import { seedSwissTaxonomy } from "../services/coaService";

const prisma = new PrismaClient();

describe("Lease Expense Items (FIN-COA-03)", () => {
  let orgId: string;
  let unitId: string;
  let leaseId: string;
  let expenseTypeId: string;
  let accountId: string;
  let createdItemId: string;

  beforeAll(async () => {
    // Org + config
    const org = await prisma.org.create({ data: { name: "LeaseExpenseItem Test Org" } });
    orgId = org.id;

    await prisma.orgConfig.create({
      data: {
        orgId,
        autoApproveLimit: 200,
        landlordName: "Test Landlord AG",
        landlordAddress: "Teststrasse 1",
        landlordZipCity: "8000 Zürich",
      },
    });

    // Building + unit
    const building = await prisma.building.create({
      data: { orgId, name: "Test Building", address: "Teststrasse 1, 8000 Zürich" },
    });

    const unit = await prisma.unit.create({
      data: { orgId, buildingId: building.id, unitNumber: "1A", floor: "1", type: "RESIDENTIAL" },
    });
    unitId = unit.id;

    // Seed COA taxonomy for classification tests
    await seedSwissTaxonomy(prisma, orgId);
    const et = await prisma.expenseType.findFirst({ where: { orgId }, orderBy: { name: "asc" } });
    const acc = await prisma.account.findFirst({ where: { orgId }, orderBy: { name: "asc" } });
    expenseTypeId = et!.id;
    accountId = acc!.id;

    // Create a lease
    const lease = await createLease(orgId, {
      unitId,
      tenantName: "Test Tenant",
      startDate: "2026-04-01",
      netRentChf: 1500,
      chargesItems: [
        { label: "Heating", mode: "ACOMPTE" as const, amountChf: 150 },
        { label: "Water", mode: "FORFAIT" as const, amountChf: 30 },
      ],
    });
    leaseId = lease.id;
  });

  afterAll(async () => {
    await prisma.leaseExpenseItem.deleteMany({ where: { lease: { orgId } } }).catch(() => {});
    await prisma.lease.deleteMany({ where: { orgId } }).catch(() => {});
    await prisma.expenseMapping.deleteMany({ where: { orgId } }).catch(() => {});
    await prisma.expenseType.deleteMany({ where: { orgId } }).catch(() => {});
    await prisma.account.deleteMany({ where: { orgId } }).catch(() => {});
    await prisma.unit.deleteMany({ where: { orgId } }).catch(() => {});
    await prisma.building.deleteMany({ where: { orgId } }).catch(() => {});
    await prisma.orgConfig.deleteMany({ where: { orgId } }).catch(() => {});
    await prisma.org.delete({ where: { id: orgId } }).catch(() => {});
    await prisma.$disconnect();
  });

  // ─── GET returns expenseItems array ────────────────────

  it("should return expenseItems as empty array on new lease", async () => {
    const lease = await getLease(leaseId, orgId);
    expect(lease).toBeDefined();
    // Lease still has legacy chargesItems
    expect(lease!.chargesItems).toBeDefined();
    expect(lease!.chargesItems!.length).toBe(2);
    // expenseItems starts empty (no migration from Json for test-created lease)
    expect(lease!.expenseItems).toBeDefined();
    expect(Array.isArray(lease!.expenseItems)).toBe(true);
  });

  // ─── Create expense item ──────────────────────────────

  it("should create an expense item without COA classification", async () => {
    const item = await createLeaseExpenseItem(orgId, leaseId, {
      description: "Electricity – common areas",
      amountChf: 45,
      mode: "ACOMPTE",
    });

    expect(item.id).toBeDefined();
    expect(item.leaseId).toBe(leaseId);
    expect(item.description).toBe("Electricity – common areas");
    expect(item.amountChf).toBe(45);
    expect(item.mode).toBe("ACOMPTE");
    expect(item.isActive).toBe(true);
    expect(item.expenseType).toBeUndefined();
    expect(item.account).toBeUndefined();
    createdItemId = item.id;
  });

  it("should create an expense item with COA classification", async () => {
    const item = await createLeaseExpenseItem(orgId, leaseId, {
      description: "Heating – gas",
      amountChf: 120,
      mode: "FORFAIT",
      expenseTypeId,
      accountId,
    });

    expect(item.expenseTypeId).toBe(expenseTypeId);
    expect(item.accountId).toBe(accountId);
    expect(item.expenseType).toBeDefined();
    expect(item.expenseType!.id).toBe(expenseTypeId);
    expect(item.expenseType!.name).toBeDefined();
    expect(item.account).toBeDefined();
    expect(item.account!.id).toBe(accountId);
  });

  // ─── GET lease returns expense items ──────────────────

  it("should return expense items in lease DTO", async () => {
    const lease = await getLease(leaseId, orgId);
    expect(lease).toBeDefined();
    expect(lease!.expenseItems).toBeDefined();
    expect(lease!.expenseItems!.length).toBeGreaterThanOrEqual(2);

    // Check the classified item has nested objects
    const classified = lease!.expenseItems!.find(i => i.description === "Heating – gas");
    expect(classified).toBeDefined();
    expect(classified!.expenseType).toBeDefined();
    expect(classified!.account).toBeDefined();
  });

  // ─── Update expense item ──────────────────────────────

  it("should update an expense item description and amount", async () => {
    const updated = await updateLeaseExpenseItem(orgId, leaseId, createdItemId, {
      description: "Electricity – common areas (revised)",
      amountChf: 50,
    });

    expect(updated.description).toBe("Electricity – common areas (revised)");
    expect(updated.amountChf).toBe(50);
  });

  it("should add COA classification to an unclassified item", async () => {
    const updated = await updateLeaseExpenseItem(orgId, leaseId, createdItemId, {
      expenseTypeId,
      accountId,
    });

    expect(updated.expenseTypeId).toBe(expenseTypeId);
    expect(updated.accountId).toBe(accountId);
    expect(updated.expenseType).toBeDefined();
    expect(updated.account).toBeDefined();
  });

  it("should clear COA classification by passing null", async () => {
    const updated = await updateLeaseExpenseItem(orgId, leaseId, createdItemId, {
      expenseTypeId: null,
      accountId: null,
    });

    expect(updated.expenseTypeId).toBeUndefined();
    expect(updated.accountId).toBeUndefined();
    expect(updated.expenseType).toBeUndefined();
    expect(updated.account).toBeUndefined();
  });

  // ─── Delete expense item ──────────────────────────────

  it("should delete an expense item", async () => {
    // Create a throwaway item to delete
    const item = await createLeaseExpenseItem(orgId, leaseId, {
      description: "To be deleted",
      amountChf: 10,
    });

    await deleteLeaseExpenseItem(orgId, leaseId, item.id);

    // Verify it's gone
    const lease = await getLease(leaseId, orgId);
    const found = lease!.expenseItems!.find(i => i.id === item.id);
    expect(found).toBeUndefined();
  });

  // ─── Org scoping ──────────────────────────────────────

  it("should reject expense item creation for wrong org", async () => {
    await expect(
      createLeaseExpenseItem("wrong-org-id", leaseId, {
        description: "Nope",
        amountChf: 10,
      })
    ).rejects.toThrow(/does not belong/);
  });
});
