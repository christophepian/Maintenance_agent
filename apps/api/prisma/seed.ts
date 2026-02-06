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
        name: "Kitchen Oven",
      },
    });
  }

  const normalizedPhone = normalizePhoneToE164("+41790000000");
  if (!normalizedPhone) {
    throw new Error("Failed to normalize demo phone");
  }

  await prisma.tenant.upsert({
    where: {
      orgId_phone: {
        orgId,
        phone: normalizedPhone,
      },
    },
    update: {
      name: "Test Tenant",
      unitId: unit.id,
    },
    create: {
      orgId,
      phone: normalizedPhone,
      name: "Test Tenant",
      unitId: unit.id,
    },
  });

  console.log("Seed complete:");
  console.log({
    orgId,
    buildingId: building.id,
    unitId: unit.id,
    applianceId: appliance.id,
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
