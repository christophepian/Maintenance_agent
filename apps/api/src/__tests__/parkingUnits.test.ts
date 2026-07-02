/**
 * Parking units (Phase 1): a parking spot is a first-class Unit (type=PARKING)
 * with a parkingKind and an optional linkedFlatId pointing at the flat it is by
 * default assigned to. The link must be another unit in the same building.
 */

import { PrismaClient } from "@prisma/client";
import { createUnit, updateUnit, getUnitById } from "../services/inventory";

const prisma = new PrismaClient();

describe("parking units — create + link validation", () => {
  const orgId = "default-org";
  let buildingId: string;
  let otherBuildingId: string;
  let flatId: string;

  beforeAll(async () => {
    await prisma.org.upsert({ where: { id: orgId }, create: { id: orgId, name: "Parking Test Org" }, update: {} });
    const b = await prisma.building.create({ data: { orgId, name: `Parking Bldg ${Date.now()}`, address: "P St 1", canton: "ZH" } });
    buildingId = b.id;
    const b2 = await prisma.building.create({ data: { orgId, name: `Other Bldg ${Date.now()}`, address: "O St 2", canton: "ZH" } });
    otherBuildingId = b2.id;
    const flat = await prisma.unit.create({ data: { orgId, buildingId, unitNumber: `FLAT-${Date.now()}`, type: "RESIDENTIAL" } });
    flatId = flat.id;
  }, 30000);

  afterAll(async () => {
    await prisma.unit.deleteMany({ where: { buildingId } }).catch(() => {});
    await prisma.unit.deleteMany({ where: { buildingId: otherBuildingId } }).catch(() => {});
    await prisma.building.delete({ where: { id: buildingId } }).catch(() => {});
    await prisma.building.delete({ where: { id: otherBuildingId } }).catch(() => {});
    await prisma.$disconnect();
  });

  it("creates a PARKING unit linked to a flat in the same building", async () => {
    const spot = await createUnit(orgId, buildingId, {
      unitNumber: `P-${Date.now()}`, type: "PARKING", parkingKind: "GARAGE", linkedFlatId: flatId,
    });
    expect(spot?.type).toBe("PARKING");
    expect(spot?.parkingKind).toBe("GARAGE");
    expect(spot?.linkedFlatId).toBe(flatId);

    // Flat exposes the linked spot; the spot exposes its flat.
    const flat = await getUnitById(orgId, flatId);
    expect((flat as any)?.parkingSpots?.some((p: any) => p.id === spot!.id)).toBe(true);
    const reloaded = await getUnitById(orgId, spot!.id);
    expect((reloaded as any)?.linkedFlat?.id).toBe(flatId);
  });

  it("rejects linking a parking spot to a unit in a different building", async () => {
    const otherFlat = await prisma.unit.create({ data: { orgId, buildingId: otherBuildingId, unitNumber: `X-${Date.now()}`, type: "RESIDENTIAL" } });
    await expect(
      createUnit(orgId, buildingId, { unitNumber: `P2-${Date.now()}`, type: "PARKING", parkingKind: "EXTERIOR", linkedFlatId: otherFlat.id }),
    ).rejects.toThrow("INVALID_LINKED_FLAT");
  });

  it("rejects linking a unit to itself on update", async () => {
    const spot = await createUnit(orgId, buildingId, { unitNumber: `P3-${Date.now()}`, type: "PARKING", parkingKind: "EXTERIOR" });
    await expect(updateUnit(orgId, spot!.id, { linkedFlatId: spot!.id })).rejects.toThrow("INVALID_LINKED_FLAT");
  });
});
