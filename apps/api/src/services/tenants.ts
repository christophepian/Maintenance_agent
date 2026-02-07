import { PrismaClient } from "@prisma/client";
import { normalizePhoneToE164 } from "../utils/phoneNormalization";
import {
  CreateTenantInput,
  UpdateTenantInput,
  GetTenantByPhoneInput,
  createTenantSchema,
  getTenantByPhoneSchema,
  updateTenantSchema,
} from "../validation/tenants";

const prisma = new PrismaClient();

/**
 * DTO for tenant response - excludes internal fields
 */
export interface TenantDTO {
  id: string;
  orgId: string;
  name?: string;
  phone: string;
  email?: string;
  unitId?: string;
  unit?: {
    id: string;
    buildingId: string;
    unitNumber: string;
    floor?: string;
  };
  appliances?: Array<{
    id: string;
    name: string;
    serial?: string;
    assetModelId?: string;
    assetModel?: {
      id: string;
      manufacturer: string;
      model: string;
      category: string;
    };
  }>;
  createdAt: Date;
  updatedAt: Date;
}

/**
 * Transform database tenant record to DTO
 */
function tenantToDTO(tenant: any): TenantDTO {
  const primaryUnit = tenant.occupancies?.[0]?.unit;
  return {
    id: tenant.id,
    orgId: tenant.orgId,
    name: tenant.name || undefined,
    phone: tenant.phone,
    email: tenant.email || undefined,
    unitId: primaryUnit?.id || undefined,
    unit: primaryUnit
      ? {
          id: primaryUnit.id,
          buildingId: primaryUnit.buildingId,
          unitNumber: primaryUnit.unitNumber,
          floor: primaryUnit.floor || undefined,
        }
      : undefined,
    appliances: primaryUnit?.appliances
      ? primaryUnit.appliances.map((appliance: any) => ({
          id: appliance.id,
          name: appliance.name,
          serial: appliance.serial || undefined,
          assetModelId: appliance.assetModelId || undefined,
          assetModel: appliance.assetModel
            ? {
                id: appliance.assetModel.id,
                manufacturer: appliance.assetModel.manufacturer,
                model: appliance.assetModel.model,
                category: appliance.assetModel.category,
              }
            : undefined,
        }))
      : undefined,
    createdAt: tenant.createdAt,
    updatedAt: tenant.updatedAt,
  };
}

/**
 * Create or fetch tenant by phone number
 * Returns existing tenant if found, creates new one if not
 */
export async function createOrGetTenant(
  input: CreateTenantInput
): Promise<TenantDTO> {
  const validated = createTenantSchema.parse(input);

  // Normalize phone to E.164
  const normalizedPhone = normalizePhoneToE164(input.phone);
  if (!normalizedPhone) {
    throw new Error("Invalid phone number format");
  }

  // Check if tenant already exists by phone in this org
  const existingTenant = await prisma.tenant.findUnique({
    where: {
      orgId_phone: {
        orgId: validated.orgId,
        phone: normalizedPhone,
      },
    },
    include: {
      occupancies: {
        include: {
          unit: {
            include: {
              appliances: {
                include: {
                  assetModel: true,
                },
              },
            },
          },
        },
      },
    },
  });

  if (existingTenant) {
    return tenantToDTO(existingTenant);
  }

  // Create new tenant
  const newTenant = await prisma.tenant.create({
    data: {
      orgId: validated.orgId,
      phone: normalizedPhone,
      name: validated.name || null,
      email: validated.email || null,
    },
  });

  if (validated.unitId) {
    await prisma.occupancy.create({
      data: {
        tenantId: newTenant.id,
        unitId: validated.unitId,
      },
    });
  }

  const loadedTenant = await prisma.tenant.findUnique({
    where: { id: newTenant.id },
    include: {
      occupancies: {
        include: {
          unit: {
            include: {
              appliances: {
                include: {
                  assetModel: true,
                },
              },
            },
          },
        },
      },
    },
  });

  if (!loadedTenant) throw new Error("Failed to load tenant");
  return tenantToDTO(loadedTenant);
}

/**
 * Get tenant by phone number and org
 */
export async function getTenantByPhone(
  input: GetTenantByPhoneInput
): Promise<TenantDTO | null> {
  const validated = getTenantByPhoneSchema.parse(input);

  // Normalize phone to E.164
  const normalizedPhone = normalizePhoneToE164(input.phone);
  if (!normalizedPhone) {
    throw new Error("Invalid phone number format");
  }

  const tenant = await prisma.tenant.findUnique({
    where: {
      orgId_phone: {
        orgId: validated.orgId,
        phone: normalizedPhone,
      },
    },
    include: {
      occupancies: {
        include: {
          unit: {
            include: {
              appliances: {
                include: {
                  assetModel: true,
                },
              },
            },
          },
        },
      },
    },
  });

  return tenant ? tenantToDTO(tenant) : null;
}

/**
 * Get tenant by ID
 */
export async function getTenantById(id: string): Promise<TenantDTO | null> {
  const tenant = await prisma.tenant.findUnique({
    where: { id },
    include: {
      occupancies: {
        include: {
          unit: {
            include: {
              appliances: {
                include: {
                  assetModel: true,
                },
              },
            },
          },
        },
      },
    },
  });

  return tenant ? tenantToDTO(tenant) : null;
}

/**
 * Update tenant information
 */
export async function updateTenant(
  id: string,
  input: UpdateTenantInput
): Promise<TenantDTO> {
  const validated = updateTenantSchema.parse(input);

  const tenant = await prisma.tenant.update({
    where: { id },
    data: {
      name: validated.name !== undefined ? validated.name : undefined,
      email: validated.email !== undefined ? validated.email : undefined,
    },
  });

  if (validated.unitId) {
    await prisma.occupancy.upsert({
      where: {
        tenantId_unitId: {
          tenantId: tenant.id,
          unitId: validated.unitId,
        },
      },
      update: {},
      create: {
        tenantId: tenant.id,
        unitId: validated.unitId,
      },
    });
  }

  const loadedTenant = await prisma.tenant.findUnique({
    where: { id: tenant.id },
    include: {
      occupancies: {
        include: {
          unit: {
            include: {
              appliances: {
                include: {
                  assetModel: true,
                },
              },
            },
          },
        },
      },
    },
  });

  if (!loadedTenant) throw new Error("Failed to load tenant");
  return tenantToDTO(loadedTenant);
}

/**
 * List tenants in org
 */
export async function listTenants(orgId: string): Promise<TenantDTO[]> {
  const tenants = await prisma.tenant.findMany({
    where: { orgId },
    include: {
      occupancies: {
        include: {
          unit: {
            include: {
              appliances: {
                include: {
                  assetModel: true,
                },
              },
            },
          },
        },
      },
    },
    orderBy: { createdAt: "desc" },
  });

  return tenants.map(tenantToDTO);
}
