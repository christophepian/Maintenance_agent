jest.mock("../services/prismaClient", () => ({ __esModule: true, default: {} }));
jest.mock("../repositories/leaseRepository");
jest.mock("../repositories/tenantRepository");
jest.mock("../repositories/inventoryRepository");

import { removeBuildingTenantEntries } from "../services/tenants";
import * as leaseRepo from "../repositories/leaseRepository";
import * as tenantRepo from "../repositories/tenantRepository";
import * as inventoryRepo from "../repositories/inventoryRepository";

const mock = (fn: unknown) => fn as jest.Mock;

describe("removeBuildingTenantEntries", () => {
  beforeEach(() => jest.clearAllMocks());

  it("removes a lease-only entry with no real billing (soft-deletes the lease)", async () => {
    mock(inventoryRepo.findUnitByIdAndOrg).mockResolvedValue({ buildingId: "b1" });
    mock(leaseRepo.listInvoicesByLease).mockResolvedValue([{ status: "DRAFT" }]);
    mock(leaseRepo.softDeleteLeaseInOrg).mockResolvedValue(1);

    const r = await removeBuildingTenantEntries("o1", "b1", [{ unitId: "u1", tenantId: "lease:L1" }]);

    expect(r).toMatchObject({ removed: 1, keptBilling: 0, notFound: 0 });
    expect(leaseRepo.softDeleteLeaseInOrg).toHaveBeenCalledWith(expect.anything(), "L1", "o1");
  });

  it("keeps a lease-only entry that has real (non-DRAFT) billing", async () => {
    mock(inventoryRepo.findUnitByIdAndOrg).mockResolvedValue({ buildingId: "b1" });
    mock(leaseRepo.listInvoicesByLease).mockResolvedValue([{ status: "ISSUED" }]);

    const r = await removeBuildingTenantEntries("o1", "b1", [{ unitId: "u1", tenantId: "lease:L1" }]);

    expect(r).toMatchObject({ removed: 0, keptBilling: 1 });
    expect(leaseRepo.softDeleteLeaseInOrg).not.toHaveBeenCalled();
  });

  it("removes an occupancy entry: soft-deletes its leases, deletes the occupancy, deactivates the now-orphaned tenant", async () => {
    mock(inventoryRepo.findUnitByIdAndOrg).mockResolvedValue({ buildingId: "b1" });
    mock(tenantRepo.findTenantByOrgAndId).mockResolvedValue({ id: "T1", phone: "+41790000000" });
    mock(leaseRepo.findActiveLeasesForUnitPhone).mockResolvedValue([{ id: "L2" }]);
    mock(leaseRepo.listInvoicesByLease).mockResolvedValue([]);
    mock(leaseRepo.softDeleteLeaseInOrg).mockResolvedValue(1);
    mock(tenantRepo.deleteOccupancies).mockResolvedValue({ count: 1 });
    mock(tenantRepo.countTenantOccupancies).mockResolvedValue(0);
    mock(tenantRepo.updateTenantRecord).mockResolvedValue({});

    const r = await removeBuildingTenantEntries("o1", "b1", [{ unitId: "u1", tenantId: "T1" }]);

    expect(r).toMatchObject({ removed: 1 });
    expect(leaseRepo.softDeleteLeaseInOrg).toHaveBeenCalledWith(expect.anything(), "L2", "o1");
    expect(tenantRepo.deleteOccupancies).toHaveBeenCalledWith(expect.anything(), "T1", "u1");
    expect(tenantRepo.updateTenantRecord).toHaveBeenCalledWith(expect.anything(), "T1", { isActive: false });
  });

  it("does NOT deactivate a tenant that still occupies another unit", async () => {
    mock(inventoryRepo.findUnitByIdAndOrg).mockResolvedValue({ buildingId: "b1" });
    mock(tenantRepo.findTenantByOrgAndId).mockResolvedValue({ id: "T1", phone: "+41790000000" });
    mock(leaseRepo.findActiveLeasesForUnitPhone).mockResolvedValue([]);
    mock(tenantRepo.deleteOccupancies).mockResolvedValue({ count: 1 });
    mock(tenantRepo.countTenantOccupancies).mockResolvedValue(1); // still elsewhere

    const r = await removeBuildingTenantEntries("o1", "b1", [{ unitId: "u1", tenantId: "T1" }]);

    expect(r).toMatchObject({ removed: 1 });
    expect(tenantRepo.updateTenantRecord).not.toHaveBeenCalled();
  });

  it("reports not_found when the unit is not in this building (org/building scope)", async () => {
    mock(inventoryRepo.findUnitByIdAndOrg).mockResolvedValue({ buildingId: "OTHER" });

    const r = await removeBuildingTenantEntries("o1", "b1", [{ unitId: "u1", tenantId: "T1" }]);

    expect(r).toMatchObject({ removed: 0, notFound: 1 });
    expect(leaseRepo.softDeleteLeaseInOrg).not.toHaveBeenCalled();
    expect(tenantRepo.deleteOccupancies).not.toHaveBeenCalled();
  });
});
