import { PrismaClient, OrgMode } from "@prisma/client";
import { computeEffectiveUnitConfig } from "../services/unitConfig";

describe("Unit-Level Override Cascade Logic", () => {
  let prisma: PrismaClient;

  beforeAll(async () => {
    prisma = new PrismaClient();
  });

  afterAll(async () => {
    await prisma.$disconnect();
  });

  it("should cascade from Org > Building > Unit with proper precedence", async () => {
    // Create test org with default config (200)
    const org = await prisma.org.create({
      data: {
        name: "Test Org - Cascade",
        mode: OrgMode.MANAGED,
        config: {
          create: {
            autoApproveLimit: 200,
          },
        },
      },
    });

    // Create a building with custom limit (300)
    const building = await prisma.building.create({
      data: {
        orgId: org.id,
        name: "Test Building",
        address: "123 Test St",
        config: {
          create: {
            orgId: org.id,
            autoApproveLimit: 300,
            emergencyAutoDispatch: true,
          },
        },
      },
    });

    // Create a unit under the building
    const unit = await prisma.unit.create({
      data: {
        orgId: org.id,
        buildingId: building.id,
        type: "RESIDENTIAL",
        unitNumber: "101",
      },
    });

    // Test 1: Unit inherits building config (no unit-specific config)
    let effectiveConfig = await computeEffectiveUnitConfig(prisma, org.id, unit.id);
    expect(effectiveConfig.effectiveAutoApproveLimit).toBe(300);
    expect(effectiveConfig.effectiveEmergencyAutoDispatch).toBe(true);
    expect(effectiveConfig.unit).toBeNull();

    // Test 2: Unit overrides building limit (400)
    const unitConfig = await prisma.unitConfig.create({
      data: {
        orgId: org.id,
        unitId: unit.id,
        autoApproveLimit: 400,
        emergencyAutoDispatch: false,
      },
    });

    effectiveConfig = await computeEffectiveUnitConfig(prisma, org.id, unit.id);
    expect(effectiveConfig.effectiveAutoApproveLimit).toBe(400);
    expect(effectiveConfig.effectiveEmergencyAutoDispatch).toBe(false);
    expect(effectiveConfig.unit?.autoApproveLimit).toBe(400);

    // Test 3: Unit partial override (only set autoApproveLimit)
    await prisma.unitConfig.update({
      where: { unitId: unit.id },
      data: {
        emergencyAutoDispatch: null,
      },
    });

    effectiveConfig = await computeEffectiveUnitConfig(prisma, org.id, unit.id);
    expect(effectiveConfig.effectiveAutoApproveLimit).toBe(400);
    expect(effectiveConfig.effectiveEmergencyAutoDispatch).toBe(true); // Falls back to building

    // Test 4: Fallback to org when building and unit both null
    const building2 = await prisma.building.create({
      data: {
        orgId: org.id,
        name: "Test Building 2",
        address: "456 Test Ave",
      },
    });

    const unit2 = await prisma.unit.create({
      data: {
        orgId: org.id,
        buildingId: building2.id,
        type: "RESIDENTIAL",
        unitNumber: "202",
      },
    });

    effectiveConfig = await computeEffectiveUnitConfig(prisma, org.id, unit2.id);
    expect(effectiveConfig.effectiveAutoApproveLimit).toBe(200); // Falls back to org default
    expect(effectiveConfig.effectiveEmergencyAutoDispatch).toBe(false); // Falls back to org default

    // Cleanup
    await prisma.unit.delete({ where: { id: unit.id } });
    await prisma.unit.delete({ where: { id: unit2.id } });
    await prisma.building.delete({ where: { id: building.id } });
    await prisma.building.delete({ where: { id: building2.id } });
    await prisma.org.delete({ where: { id: org.id } });
  });

  it("should handle deletion of unit config and revert to building/org defaults", async () => {
    // Setup
    const org = await prisma.org.create({
      data: {
        name: "Test Org - Delete",
        mode: OrgMode.MANAGED,
        config: {
          create: {
            autoApproveLimit: 200,
          },
        },
      },
    });

    const building = await prisma.building.create({
      data: {
        orgId: org.id,
        name: "Test Building",
        address: "789 Test Blvd",
        config: {
          create: {
            orgId: org.id,
            autoApproveLimit: 350,
          },
        },
      },
    });

    const unit = await prisma.unit.create({
      data: {
        orgId: org.id,
        buildingId: building.id,
        type: "RESIDENTIAL",
        unitNumber: "303",
      },
    });

    // Create unit-specific config
    const unitConfig = await prisma.unitConfig.create({
      data: {
        orgId: org.id,
        unitId: unit.id,
        autoApproveLimit: 500,
      },
    });

    let effectiveConfig = await computeEffectiveUnitConfig(prisma, org.id, unit.id);
    expect(effectiveConfig.effectiveAutoApproveLimit).toBe(500);

    // Delete unit config
    await prisma.unitConfig.delete({ where: { unitId: unit.id } });

    // Should revert to building config
    effectiveConfig = await computeEffectiveUnitConfig(prisma, org.id, unit.id);
    expect(effectiveConfig.effectiveAutoApproveLimit).toBe(350);
    expect(effectiveConfig.unit).toBeNull();

    // Cleanup
    await prisma.unit.delete({ where: { id: unit.id } });
    await prisma.building.delete({ where: { id: building.id } });
    await prisma.org.delete({ where: { id: org.id } });
  });
});
