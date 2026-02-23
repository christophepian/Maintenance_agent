import { PrismaClient, BillingEntityType } from "@prisma/client";
import {
  createBillingEntity,
  listBillingEntities,
  getBillingEntity,
  updateBillingEntity,
  deleteBillingEntity,
} from "../services/billingEntities";

const prisma = new PrismaClient();

describe("Billing Entities", () => {
  let orgId: string;
  let otherOrgId: string;
  let billingEntityId: string;
  let contractorId: string;

  beforeAll(async () => {
    const org = await prisma.org.create({ data: { name: "Billing Entity Org" } });
    orgId = org.id;

    const contractor = await prisma.contractor.create({
      data: {
        orgId,
        name: "Test Contractor",
        phone: "+41791234567",
        email: "billing@test.dev",
        serviceCategories: JSON.stringify(["plumbing"]),
      },
    });
    contractorId = contractor.id;

    const otherOrg = await prisma.org.create({ data: { name: "Other Org" } });
    otherOrgId = otherOrg.id;

    const otherEntity = await prisma.billingEntity.create({
      data: {
        orgId: otherOrgId,
        type: BillingEntityType.OWNER,
        name: "Other Owner",
        addressLine1: "Other Street 1",
        postalCode: "8001",
        city: "Zurich",
        country: "CH",
        iban: "CH9300762011623852957",
        defaultVatRate: 7.7,
      },
    });

    expect(otherEntity).toBeDefined();
  });

  afterAll(async () => {
    await prisma.billingEntity.deleteMany({ where: { orgId } }).catch(() => {});
    await prisma.contractor.deleteMany({ where: { id: contractorId } }).catch(() => {});
    await prisma.billingEntity.deleteMany({ where: { orgId: otherOrgId } }).catch(() => {});
    await prisma.org.deleteMany({ where: { id: orgId } }).catch(() => {});
    await prisma.org.deleteMany({ where: { id: otherOrgId } }).catch(() => {});
    await prisma.$disconnect();
  });

  it("creates a billing entity", async () => {
    const created = await createBillingEntity({
      orgId,
      type: BillingEntityType.ORG,
      name: "Test Org Billing",
      addressLine1: "Main Street 1",
      addressLine2: "Suite 2",
      postalCode: "8000",
      city: "Zurich",
      country: "CH",
      iban: "CH9300762011623852957",
      vatNumber: "CHE-123.456.789",
      defaultVatRate: 7.7,
    });

    billingEntityId = created.id;
    expect(created.orgId).toBe(orgId);
    expect(created.type).toBe(BillingEntityType.ORG);
    expect(created.name).toBe("Test Org Billing");
  });

  it("rejects duplicate billing entity type per org", async () => {
    await expect(
      createBillingEntity({
        orgId,
        type: BillingEntityType.ORG,
        name: "Duplicate Org Billing",
        addressLine1: "Main Street 9",
        postalCode: "8000",
        city: "Zurich",
        country: "CH",
        iban: "CH9300762011623852957",
      })
    ).rejects.toThrow("BILLING_ENTITY_TYPE_EXISTS");
  });

  it("lists billing entities for an org", async () => {
    const entities = await listBillingEntities(orgId);
    expect(Array.isArray(entities)).toBe(true);
    expect(entities.find((e) => e.id === billingEntityId)).toBeDefined();
    expect(entities.every((e) => e.orgId === orgId)).toBe(true);
  });

  it("filters billing entities by type", async () => {
    const entities = await listBillingEntities(orgId, { type: BillingEntityType.ORG });
    expect(entities.length).toBe(1);
    expect(entities[0].type).toBe(BillingEntityType.ORG);
  });

  it("fetches a billing entity by id", async () => {
    const entity = await getBillingEntity(orgId, billingEntityId);
    expect(entity).toBeDefined();
    expect(entity?.id).toBe(billingEntityId);
  });

  it("updates a billing entity", async () => {
    const updated = await updateBillingEntity(orgId, billingEntityId, {
      name: "Updated Billing Name",
      vatNumber: null,
    });

    expect(updated).toBeDefined();
    expect(updated?.name).toBe("Updated Billing Name");
    expect(updated?.vatNumber).toBeUndefined();
  });

  it("links a contractor to a billing entity", async () => {
    const linked = await createBillingEntity({
      orgId,
      type: BillingEntityType.CONTRACTOR,
      contractorId,
      name: "Contractor Billing",
      addressLine1: "Contractor Street 10",
      postalCode: "8001",
      city: "Zurich",
      country: "CH",
      iban: "CH9300762011623852957",
    });

    expect(linked.contractorId).toBe(contractorId);
    expect(linked.type).toBe(BillingEntityType.CONTRACTOR);
  });

  it("does not leak billing entities across orgs", async () => {
    const entities = await listBillingEntities(orgId);
    expect(entities.some((e) => e.orgId === otherOrgId)).toBe(false);
  });

  it("deletes a billing entity", async () => {
    const deleted = await deleteBillingEntity(orgId, billingEntityId);
    expect(deleted).toBe(true);

    const entity = await getBillingEntity(orgId, billingEntityId);
    expect(entity).toBeNull();
  });
});
