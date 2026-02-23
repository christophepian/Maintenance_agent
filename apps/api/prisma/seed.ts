import { PrismaClient } from "@prisma/client";
import { DEFAULT_ORG_ID } from "../src/services/orgConfig";
import { normalizePhoneToE164 } from "../src/utils/phoneNormalization";

const prisma = new PrismaClient();

async function main() {
  const orgId = DEFAULT_ORG_ID;

  await prisma.org.upsert({
    where: { id: orgId },
    update: {},
    create: {
      id: orgId,
      name: "Default Org",
    },
  });

  await prisma.orgConfig.upsert({
    where: { orgId },
    update: {},
    create: {
      orgId,
      autoApproveLimit: 200,
    },
  });

  let building = await prisma.building.findFirst({
    where: { orgId, name: "Demo Building" },
  });
  if (!building) {
    building = await prisma.building.create({
      data: {
        orgId,
        name: "Demo Building",
        address: "Demo St 1",
      },
    });
  }

  let unit = await prisma.unit.findFirst({
    where: { buildingId: building.id, unitNumber: "1A" },
  });
  if (!unit) {
    unit = await prisma.unit.create({
      data: {
        buildingId: building.id,
        orgId,
        unitNumber: "1A",
        floor: "1",
      },
    });
  }

  let appliance = await prisma.appliance.findFirst({
    where: { unitId: unit.id, name: "Kitchen Oven" },
  });
  if (!appliance) {
    appliance = await prisma.appliance.create({
      data: {
        unitId: unit.id,
        orgId,
        name: "Kitchen Oven",
      },
    });
  }

  const normalizedPhone = normalizePhoneToE164("+41790000000");
  if (!normalizedPhone) {
    throw new Error("Failed to normalize demo phone");
  }

  const tenant = await prisma.tenant.upsert({
    where: {
      orgId_phone: {
        orgId,
        phone: normalizedPhone,
      },
    },
    update: {
      name: "Test Tenant",
    },
    create: {
      orgId,
      phone: normalizedPhone,
      name: "Test Tenant",
    },
  });

  await prisma.occupancy.upsert({
    where: {
      tenantId_unitId: {
        tenantId: tenant.id,
        unitId: unit.id,
      },
    },
    update: {},
    create: {
      tenantId: tenant.id,
      unitId: unit.id,
    },
  });

  // Create a test contractor
  let contractor = await prisma.contractor.findFirst({
    where: { orgId, name: "Test Contractor" },
  });
  if (!contractor) {
    contractor = await prisma.contractor.create({
      data: {
        orgId,
        name: "Test Contractor",
        phone: normalizePhoneToE164("+41791234567") || "+41791234567",
        email: "contractor@test.com",
        hourlyRate: 100,
        serviceCategories: JSON.stringify(["plumbing", "oven", "stove", "dishwasher", "bathroom", "lighting"]),
      },
    });
  }

  // Create a billing entity for the contractor
  let billingEntity = await prisma.billingEntity.findFirst({
    where: { orgId, contractorId: contractor.id },
  });
  if (!billingEntity) {
    billingEntity = await prisma.billingEntity.create({
      data: {
        orgId,
        type: "CONTRACTOR",
        contractorId: contractor.id,
        name: "Test Contractor",
        addressLine1: "Main Street 1",
        postalCode: "8000",
        city: "Zurich",
        country: "CH",
        iban: "CH9300762011623852957",
        vatNumber: "CHE-123.456.789",
        defaultVatRate: 7.7,
      },
    });
  }

  // Create test requests
  const requestDescriptions = [
    { description: "Leaking pipe in kitchen", category: "plumbing", estimatedCost: 250 },
    { description: "Oven not heating properly", category: "oven", estimatedCost: 180 },
    { description: "Dishwasher making noise", category: "dishwasher", estimatedCost: 120 },
    { description: "Bathroom tap dripping", category: "plumbing", estimatedCost: 80 },
    { description: "Light fixtures broken", category: "lighting", estimatedCost: 150 },
  ];

  for (const req of requestDescriptions) {
    const existing = await prisma.request.findFirst({
      where: {
        description: req.description,
        tenantId: tenant.id,
      },
    });

    if (!existing) {
      await prisma.request.create({
        data: {
          description: req.description,
          category: req.category,
          estimatedCost: req.estimatedCost,
          status: "APPROVED",
          tenantId: tenant.id,
          unitId: unit.id,
          applianceId: appliance.id,
          assignedContractorId: contractor.id,
        },
      });
    }
  }

  console.log("Seed complete:");
  console.log({
    orgId,
    buildingId: building.id,
    unitId: unit.id,
    applianceId: appliance.id,
    tenantId: tenant.id,
    contractorId: contractor.id,
    billingEntityId: billingEntity.id,
    phone: normalizedPhone,
  });
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
