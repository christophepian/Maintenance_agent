/**
 * WS-D: CAPEX capitalization + straight-line depreciation.
 *
 * Capitalizing a CAPEX invoice moves cost to the balance sheet (1500); the
 * depreciation run posts Dr 4700 / Cr 1509 and reduces book value. Both are
 * idempotent.
 */
import { PrismaClient } from "@prisma/client";
import {
  capitalizeInvoice,
  runDepreciation,
  listFixedAssets,
} from "../services/fixedAssetService";
import { getBalanceSheet } from "../services/ledgerService";

const prisma = new PrismaClient();

describe("Fixed assets — capitalization + depreciation (WS-D)", () => {
  let orgId: string;
  let buildingId: string;

  const invoice = () => ({
    id: "cap-inv-1",
    invoiceNumber: "CAP-001",
    expenseCategory: "CAPEX",
    totalAmount: 1200, // CHF → 120000 cents
    buildingId,
    unitId: null,
    accountId: null, // falls back to 4200
    issueDate: "2024-01-15T00:00:00.000Z",
  });

  beforeAll(async () => {
    const org = await prisma.org.create({ data: { name: "FA Test Org" } });
    orgId = org.id;
    const b = await prisma.building.create({ data: { orgId, name: "FA Bldg", address: "2 Rue" } });
    buildingId = b.id;
    // expense account the capitalization will credit
    await prisma.account.create({ data: { orgId, name: "Maintenance & Repairs", code: "4200", accountType: "EXPENSE" } });
  });

  afterAll(async () => {
    await prisma.ledgerEntry.deleteMany({ where: { orgId } }).catch(() => {});
    await prisma.fixedAsset.deleteMany({ where: { orgId } }).catch(() => {});
    await prisma.account.deleteMany({ where: { orgId } }).catch(() => {});
    await prisma.building.delete({ where: { id: buildingId } }).catch(() => {});
    await prisma.org.delete({ where: { id: orgId } }).catch(() => {});
    await prisma.$disconnect();
  });

  it("capitalizes a CAPEX invoice to the balance sheet", async () => {
    const asset = await capitalizeInvoice(prisma, orgId, invoice());
    expect(asset).not.toBeNull();
    expect(asset!.costCents).toBe(120000);
    expect(asset!.bookValueCents).toBe(120000);

    const bs = await getBalanceSheet(prisma, orgId, buildingId, new Date("2024-02-01T00:00:00Z"));
    const fixed = bs.assets.find((a) => a.accountCode === "1500");
    expect(fixed?.displayCents).toBe(120000);
  });

  it("is idempotent — re-capitalizing the same invoice does not duplicate", async () => {
    await capitalizeInvoice(prisma, orgId, invoice());
    const assets = await listFixedAssets(prisma, orgId, buildingId);
    expect(assets).toHaveLength(1);
  });

  it("skips non-CAPEX invoices", async () => {
    const res = await capitalizeInvoice(prisma, orgId, { ...invoice(), id: "other", expenseCategory: "MAINTENANCE" });
    expect(res).toBeNull();
  });

  it("posts straight-line depreciation due and reduces book value", async () => {
    // 12 months after acquisition; 10-yr life → 12/120 of 120000 = 12000
    const r = await runDepreciation(prisma, orgId, new Date("2025-01-15T00:00:00Z"));
    expect(r.assetsDepreciated).toBe(1);
    expect(r.totalCents).toBe(12000);

    const assets = await listFixedAssets(prisma, orgId, buildingId);
    expect(assets[0].accumulatedDepreciationCents).toBe(12000);
    expect(assets[0].bookValueCents).toBe(108000);

    const bs = await getBalanceSheet(prisma, orgId, buildingId, new Date("2025-01-15T00:00:00Z"));
    const accum = bs.assets.find((a) => a.accountCode === "1509");
    expect(accum?.displayCents).toBe(-12000); // contra-asset
  });

  it("is idempotent — re-running depreciation for the same date posts nothing new", async () => {
    const r = await runDepreciation(prisma, orgId, new Date("2025-01-15T00:00:00Z"));
    expect(r.assetsDepreciated).toBe(0);
    expect(r.totalCents).toBe(0);
  });
});
