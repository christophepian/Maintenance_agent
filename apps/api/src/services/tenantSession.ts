import type { PrismaClient } from "@prisma/client";
import { normalizePhoneToE164 } from "../utils/phoneNormalization";

export type TenantSessionResult = {
  tenant: {
    id: string;
    name?: string | null;
    phone: string;
    email?: string | null;
    unitId?: string | null;
  };
  unit?: {
    id: string;
    unitNumber: string;
    floor?: string | null;
  } | null;
  building?: {
    id: string;
    name: string;
    address: string;
  } | null;
  appliances: Array<{
    id: string;
    name: string;
    serial?: string | null;
    assetModelId?: string | null;
    assetModel?: {
      id: string;
      manufacturer: string;
      model: string;
      category: string;
    } | null;
  }>;
};

export async function getTenantSession(
  prisma: PrismaClient,
  orgId: string,
  phone: string
): Promise<TenantSessionResult | null> {
  const normalizedPhone = normalizePhoneToE164(phone);
  if (!normalizedPhone) {
    throw new Error("Invalid phone number format");
  }

  const tenant = await prisma.tenant.findUnique({
    where: {
      orgId_phone: {
        orgId,
        phone: normalizedPhone,
      },
    },
    include: {
      unit: {
        include: {
          building: true,
          appliances: {
            include: {
              assetModel: true,
            },
          },
        },
      },
    },
  });

  if (!tenant) return null;

  return {
    tenant: {
      id: tenant.id,
      name: tenant.name ?? null,
      phone: tenant.phone,
      email: tenant.email ?? null,
      unitId: tenant.unitId ?? null,
    },
    unit: tenant.unit
      ? {
          id: tenant.unit.id,
          unitNumber: tenant.unit.unitNumber,
          floor: tenant.unit.floor ?? null,
        }
      : null,
    building: tenant.unit?.building
      ? {
          id: tenant.unit.building.id,
          name: tenant.unit.building.name,
          address: tenant.unit.building.address,
        }
      : null,
    appliances: tenant.unit?.appliances
      ? tenant.unit.appliances.map((appliance) => ({
          id: appliance.id,
          name: appliance.name,
          serial: appliance.serial ?? null,
          assetModelId: appliance.assetModelId ?? null,
          assetModel: appliance.assetModel
            ? {
                id: appliance.assetModel.id,
                manufacturer: appliance.assetModel.manufacturer,
                model: appliance.assetModel.model,
                category: appliance.assetModel.category,
              }
            : null,
        }))
      : [],
  };
}
