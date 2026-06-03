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

  // DEV: Seed the dev-user that matches the AUTH_OPTIONAL identity.
  // Required for notifications and auth-gated API calls to work without a login flow.
  await prisma.user.upsert({
    where: { id: 'dev-user' },
    update: {},
    create: {
      id: 'dev-user',
      orgId,
      name: 'Dev Manager',
      email: 'dev@local',
      role: 'MANAGER',
      passwordHash: 'not-used-in-dev',
    },
  });

  await prisma.user.upsert({
    where: { id: 'dev-owner' },
    update: {},
    create: {
      id: 'dev-owner',
      orgId,
      name: 'Dev Owner',
      email: 'dev-owner@local',
      role: 'OWNER',
      passwordHash: 'not-used-in-dev',
    },
  });

  await prisma.user.upsert({
    where: { id: 'dev-vendor' },
    update: {},
    create: {
      id: 'dev-vendor',
      orgId,
      name: 'Dev Vendor',
      email: 'dev-vendor@local',
      role: 'VENDOR',
      passwordHash: 'not-used-in-dev',
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

  // Create or find a seed Asset (replaces legacy Appliance)
  let asset = await prisma.asset.findFirst({
    where: { unitId: unit.id, name: "Kitchen Oven" },
  });
  if (!asset) {
    asset = await prisma.asset.create({
      data: {
        unitId: unit.id,
        orgId,
        name: "Kitchen Oven",
        type: "APPLIANCE",
        category: "EQUIPMENT",
        topic: "kitchen_oven",
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
          orgId,
          tenantId: tenant.id,
          unitId: unit.id,
          assetId: asset.id,
          assignedContractorId: contractor.id,
        },
      });
    }
  }

  // ── Replacement benchmarks (Swiss industry costs, HEV 2024) ───────────────
  const benchmarks: Array<{
    assetType: "SYSTEM" | "STRUCTURAL" | "FIXTURE" | "FINISH" | "APPLIANCE" | "OTHER";
    topic: string;
    lowChf: number;
    medianChf: number;
    highChf: number;
    sourceNotes?: string;
  }> = [
    { assetType: "SYSTEM",     topic: "ELEVATOR",                     lowChf: 70000, medianChf: 110000, highChf: 160000, sourceNotes: "Full elevator replacement — HEV/SIA 2024" },
    { assetType: "SYSTEM",     topic: "ELEVATOR_ELECTRICS",           lowChf: 8000,  medianChf: 16000,  highChf: 28000,  sourceNotes: "Elevator electrical systems — HEV 2024" },
    { assetType: "SYSTEM",     topic: "CENTRAL_HEATING",              lowChf: 12000, medianChf: 22000,  highChf: 38000,  sourceNotes: "Central heating replacement — HEV 2024" },
    { assetType: "SYSTEM",     topic: "BOILER",                       lowChf: 4500,  medianChf: 7500,   highChf: 12000,  sourceNotes: "Gas/oil boiler replacement — HEV 2024" },
    { assetType: "SYSTEM",     topic: "CIRCULATION_PUMP",             lowChf: 600,   medianChf: 1100,   highChf: 1800,   sourceNotes: "Heating circulation pump — HEV 2024" },
    { assetType: "SYSTEM",     topic: "HEATING_CONTROL",              lowChf: 1800,  medianChf: 3200,   highChf: 5500,   sourceNotes: "Heating control system — HEV 2024" },
    { assetType: "SYSTEM",     topic: "WATER_PIPES",                  lowChf: 7000,  medianChf: 14000,  highChf: 24000,  sourceNotes: "Building water pipe replacement — HEV 2024" },
    { assetType: "SYSTEM",     topic: "PIPE_COLD_COPPER",             lowChf: 5000,  medianChf: 9000,   highChf: 16000,  sourceNotes: "Cold water copper pipes — HEV 2024" },
    { assetType: "SYSTEM",     topic: "PIPE_HOT_COPPER_INSULATED",    lowChf: 6000,  medianChf: 11000,  highChf: 19000,  sourceNotes: "Insulated hot water copper pipes — HEV 2024" },
    { assetType: "SYSTEM",     topic: "ELECTRICAL_INSTALLATION",      lowChf: 10000, medianChf: 20000,  highChf: 35000,  sourceNotes: "Full electrical installation — HEV 2024" },
    { assetType: "SYSTEM",     topic: "ELECTRICAL_CABLES",            lowChf: 8000,  medianChf: 16000,  highChf: 28000,  sourceNotes: "Electrical cable replacement — HEV 2024" },
    { assetType: "SYSTEM",     topic: "INTERCOM",                     lowChf: 1500,  medianChf: 3000,   highChf: 5500,   sourceNotes: "Intercom/videophone system — HEV 2024" },
    { assetType: "SYSTEM",     topic: "POWER_SOCKET",                 lowChf: 80,    medianChf: 130,    highChf: 220,    sourceNotes: "Power socket replacement — HEV 2024" },
    { assetType: "SYSTEM",     topic: "SWITCH",                       lowChf: 40,    medianChf: 70,     highChf: 120,    sourceNotes: "Light switch replacement — HEV 2024" },
    { assetType: "STRUCTURAL", topic: "STAIRCASE",                    lowChf: 15000, medianChf: 35000,  highChf: 65000,  sourceNotes: "Staircase renovation — HEV 2024" },
    { assetType: "STRUCTURAL", topic: "ROOF_COVERING",                lowChf: 18000, medianChf: 38000,  highChf: 65000,  sourceNotes: "Roof covering replacement — HEV/SIA 2024" },
    { assetType: "STRUCTURAL", topic: "PITCHED_ROOF_TILES",           lowChf: 20000, medianChf: 42000,  highChf: 72000,  sourceNotes: "Pitched roof tile replacement — HEV 2024" },
    { assetType: "STRUCTURAL", topic: "EXTERIOR_WALL_COATING",        lowChf: 15000, medianChf: 30000,  highChf: 52000,  sourceNotes: "Exterior facade re-coating — HEV 2024" },
    { assetType: "STRUCTURAL", topic: "RENDER_MINERAL",               lowChf: 12000, medianChf: 25000,  highChf: 44000,  sourceNotes: "Mineral facade render — HEV 2024" },
    { assetType: "STRUCTURAL", topic: "BALCONY_METAL",                lowChf: 2500,  medianChf: 4500,   highChf: 8000,   sourceNotes: "Metal balcony replacement — HEV 2024" },
    { assetType: "FIXTURE",    topic: "ENTRANCE_DOOR",                lowChf: 2500,  medianChf: 4500,   highChf: 7500,   sourceNotes: "Building entrance door — HEV 2024" },
    { assetType: "FIXTURE",    topic: "WINDOW_INSULATED_PLASTIC_WOOD",lowChf: 700,   medianChf: 1100,   highChf: 1800,   sourceNotes: "Per insulated window — HEV 2024" },
    { assetType: "FIXTURE",    topic: "ROLLER_SHUTTER_PLASTIC",       lowChf: 350,   medianChf: 550,    highChf: 900,    sourceNotes: "Plastic roller shutter — HEV 2024" },
    { assetType: "FIXTURE",    topic: "DOOR_CHIPBOARD",               lowChf: 250,   medianChf: 450,    highChf: 750,    sourceNotes: "Interior chipboard door — HEV 2024" },
    { assetType: "FIXTURE",    topic: "KITCHEN_CABINET_CHIPBOARD",    lowChf: 2500,  medianChf: 4500,   highChf: 8000,   sourceNotes: "Kitchen cabinet set (chipboard) — HEV 2024" },
    { assetType: "FIXTURE",    topic: "COUNTERTOP_SYNTHETIC",         lowChf: 700,   medianChf: 1200,   highChf: 2200,   sourceNotes: "Synthetic kitchen countertop — HEV 2024" },
    { assetType: "FIXTURE",    topic: "KITCHEN_TAP",                  lowChf: 200,   medianChf: 400,    highChf: 700,    sourceNotes: "Kitchen tap — HEV 2024" },
    { assetType: "FIXTURE",    topic: "BATHTUB_ACRYLIC",              lowChf: 500,   medianChf: 900,    highChf: 1600,   sourceNotes: "Acrylic bathtub incl. fitting — HEV 2024" },
    { assetType: "FIXTURE",    topic: "SANITARY_CERAMIC",             lowChf: 600,   medianChf: 1200,   highChf: 2000,   sourceNotes: "WC + basin sanitary set — HEV 2024" },
    { assetType: "FIXTURE",    topic: "BATHROOM_TAP",                 lowChf: 200,   medianChf: 400,    highChf: 700,    sourceNotes: "Bathroom tap — HEV 2024" },
    { assetType: "FIXTURE",    topic: "BALCONY_RAILING_METAL",        lowChf: 400,   medianChf: 800,    highChf: 1400,   sourceNotes: "Metal balcony railing — HEV 2024" },
    { assetType: "FIXTURE",    topic: "COMBINED_LOCK_SYSTEM",         lowChf: 1200,  medianChf: 2200,   highChf: 3800,   sourceNotes: "Combined lock system — HEV 2024" },
    { assetType: "FINISH",     topic: "PAINT_WALLS_DISPERSION",       lowChf: 1200,  medianChf: 2200,   highChf: 3800,   sourceNotes: "Wall paint (dispersion) per unit — HEV 2024" },
    { assetType: "FINISH",     topic: "PARQUET_MOSAIC",               lowChf: 2000,  medianChf: 3500,   highChf: 6000,   sourceNotes: "Mosaic parquet per unit — HEV 2024" },
    { assetType: "FINISH",     topic: "KITCHEN_TILES_CERAMIC",        lowChf: 800,   medianChf: 1600,   highChf: 2800,   sourceNotes: "Kitchen ceramic tiles per unit — HEV 2024" },
    { assetType: "FINISH",     topic: "BATHROOM_TILES_CERAMIC",       lowChf: 1200,  medianChf: 2200,   highChf: 3800,   sourceNotes: "Bathroom ceramic tiles per unit — HEV 2024" },
    { assetType: "APPLIANCE",  topic: "WASHING_MACHINE_COMMON",       lowChf: 700,   medianChf: 1100,   highChf: 1800,   sourceNotes: "Common laundry washing machine — HEV 2024" },
    { assetType: "APPLIANCE",  topic: "DRYER_COMMON",                 lowChf: 700,   medianChf: 1100,   highChf: 1800,   sourceNotes: "Common laundry dryer — HEV 2024" },
  ];

  for (const b of benchmarks) {
    await prisma.replacementBenchmark.upsert({
      where: { assetType_topic: { assetType: b.assetType, topic: b.topic } },
      update: { lowChf: b.lowChf, medianChf: b.medianChf, highChf: b.highChf, sourceNotes: b.sourceNotes },
      create: b,
    });
  }

  // ── Depreciation standards (Swiss HEV 2024 useful lives) ─────────────────
  const depStandards: Array<{
    assetType: "SYSTEM" | "STRUCTURAL" | "FIXTURE" | "FINISH" | "APPLIANCE" | "OTHER";
    topic: string;
    usefulLifeMonths: number;
    notes?: string;
  }> = [
    { assetType: "SYSTEM",     topic: "ELEVATOR",                      usefulLifeMonths: 300, notes: "HEV 2024: 25 yr" },
    { assetType: "SYSTEM",     topic: "ELEVATOR_ELECTRICS",            usefulLifeMonths: 240, notes: "HEV 2024: 20 yr" },
    { assetType: "SYSTEM",     topic: "CENTRAL_HEATING",               usefulLifeMonths: 300, notes: "HEV 2024: 25 yr" },
    { assetType: "SYSTEM",     topic: "BOILER",                        usefulLifeMonths: 240, notes: "HEV 2024: 20 yr" },
    { assetType: "SYSTEM",     topic: "CIRCULATION_PUMP",              usefulLifeMonths: 180, notes: "HEV 2024: 15 yr" },
    { assetType: "SYSTEM",     topic: "HEATING_CONTROL",               usefulLifeMonths: 180, notes: "HEV 2024: 15 yr" },
    { assetType: "SYSTEM",     topic: "WATER_PIPES",                   usefulLifeMonths: 360, notes: "HEV 2024: 30 yr" },
    { assetType: "SYSTEM",     topic: "PIPE_COLD_COPPER",              usefulLifeMonths: 360, notes: "HEV 2024: 30 yr" },
    { assetType: "SYSTEM",     topic: "PIPE_HOT_COPPER_INSULATED",     usefulLifeMonths: 360, notes: "HEV 2024: 30 yr" },
    { assetType: "SYSTEM",     topic: "ELECTRICAL_INSTALLATION",       usefulLifeMonths: 300, notes: "HEV 2024: 25 yr" },
    { assetType: "SYSTEM",     topic: "ELECTRICAL_CABLES",             usefulLifeMonths: 360, notes: "HEV 2024: 30 yr" },
    { assetType: "SYSTEM",     topic: "INTERCOM",                      usefulLifeMonths: 180, notes: "HEV 2024: 15 yr" },
    { assetType: "SYSTEM",     topic: "POWER_SOCKET",                  usefulLifeMonths: 240, notes: "HEV 2024: 20 yr" },
    { assetType: "SYSTEM",     topic: "SWITCH",                        usefulLifeMonths: 240, notes: "HEV 2024: 20 yr" },
    { assetType: "STRUCTURAL", topic: "STAIRCASE",                     usefulLifeMonths: 480, notes: "HEV 2024: 40 yr" },
    { assetType: "STRUCTURAL", topic: "ROOF_COVERING",                 usefulLifeMonths: 360, notes: "HEV 2024: 30 yr" },
    { assetType: "STRUCTURAL", topic: "PITCHED_ROOF_TILES",            usefulLifeMonths: 480, notes: "HEV 2024: 40 yr" },
    { assetType: "STRUCTURAL", topic: "EXTERIOR_WALL_COATING",         usefulLifeMonths: 240, notes: "HEV 2024: 20 yr" },
    { assetType: "STRUCTURAL", topic: "RENDER_MINERAL",                usefulLifeMonths: 300, notes: "HEV 2024: 25 yr" },
    { assetType: "STRUCTURAL", topic: "BALCONY_METAL",                 usefulLifeMonths: 300, notes: "HEV 2024: 25 yr" },
    { assetType: "FIXTURE",    topic: "ENTRANCE_DOOR",                 usefulLifeMonths: 360, notes: "HEV 2024: 30 yr" },
    { assetType: "FIXTURE",    topic: "WINDOW_INSULATED_PLASTIC_WOOD", usefulLifeMonths: 300, notes: "HEV 2024: 25 yr" },
    { assetType: "FIXTURE",    topic: "ROLLER_SHUTTER_PLASTIC",        usefulLifeMonths: 240, notes: "HEV 2024: 20 yr" },
    { assetType: "FIXTURE",    topic: "DOOR_CHIPBOARD",                usefulLifeMonths: 240, notes: "HEV 2024: 20 yr" },
    { assetType: "FIXTURE",    topic: "KITCHEN_CABINET_CHIPBOARD",     usefulLifeMonths: 240, notes: "HEV 2024: 20 yr" },
    { assetType: "FIXTURE",    topic: "COUNTERTOP_SYNTHETIC",          usefulLifeMonths: 240, notes: "HEV 2024: 20 yr" },
    { assetType: "FIXTURE",    topic: "KITCHEN_TAP",                   usefulLifeMonths: 180, notes: "HEV 2024: 15 yr" },
    { assetType: "FIXTURE",    topic: "BATHTUB_ACRYLIC",               usefulLifeMonths: 240, notes: "HEV 2024: 20 yr" },
    { assetType: "FIXTURE",    topic: "SANITARY_CERAMIC",              usefulLifeMonths: 300, notes: "HEV 2024: 25 yr" },
    { assetType: "FIXTURE",    topic: "BATHROOM_TAP",                  usefulLifeMonths: 180, notes: "HEV 2024: 15 yr" },
    { assetType: "FIXTURE",    topic: "BALCONY_RAILING_METAL",         usefulLifeMonths: 300, notes: "HEV 2024: 25 yr" },
    { assetType: "FIXTURE",    topic: "COMBINED_LOCK_SYSTEM",          usefulLifeMonths: 180, notes: "HEV 2024: 15 yr" },
    { assetType: "FINISH",     topic: "PAINT_WALLS_DISPERSION",        usefulLifeMonths: 120, notes: "HEV 2024: 10 yr" },
    { assetType: "FINISH",     topic: "PARQUET_MOSAIC",                usefulLifeMonths: 360, notes: "HEV 2024: 30 yr" },
    { assetType: "FINISH",     topic: "KITCHEN_TILES_CERAMIC",         usefulLifeMonths: 240, notes: "HEV 2024: 20 yr" },
    { assetType: "FINISH",     topic: "BATHROOM_TILES_CERAMIC",        usefulLifeMonths: 240, notes: "HEV 2024: 20 yr" },
    { assetType: "APPLIANCE",  topic: "WASHING_MACHINE_COMMON",        usefulLifeMonths: 144, notes: "HEV 2024: 12 yr" },
    { assetType: "APPLIANCE",  topic: "DRYER_COMMON",                  usefulLifeMonths: 144, notes: "HEV 2024: 12 yr" },
  ];

  for (const s of depStandards) {
    // Prisma upsert cannot match on null in composite unique constraints —
    // use findFirst + create instead.
    const existing = await prisma.depreciationStandard.findFirst({
      where: { jurisdiction: "CH", canton: null, assetType: s.assetType, topic: s.topic },
    });
    if (!existing) {
      await prisma.depreciationStandard.create({
        data: {
          jurisdiction: "CH",
          canton: null,
          assetType: s.assetType,
          topic: s.topic,
          usefulLifeMonths: s.usefulLifeMonths,
          notes: s.notes,
        },
      });
    } else {
      await prisma.depreciationStandard.update({
        where: { id: existing.id },
        data: { usefulLifeMonths: s.usefulLifeMonths, notes: s.notes },
      });
    }
  }

  console.log("Seed complete:");
  console.log({
    orgId,
    buildingId: building.id,
    unitId: unit.id,
    assetId: asset.id,
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
