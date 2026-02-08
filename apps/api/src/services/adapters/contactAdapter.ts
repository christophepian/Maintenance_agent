import { ContractorDTO } from "../contractors";
import { TenantDTO } from "../tenants";

export type ContactRole = "TENANT" | "CONTRACTOR" | "MANAGER" | "OWNER";

export type ContactDTO = {
  id: string;
  role: ContactRole;
  name?: string | null;
  phone?: string | null;
  email?: string | null;
  unitId?: string | null;
  unit?: {
    id: string;
    buildingId: string;
    unitNumber: string;
    floor?: string | null;
  } | null;
  hourlyRate?: number | null;
  serviceCategories?: string[] | null;
};

export function contactFromTenant(tenant: TenantDTO): ContactDTO {
  return {
    id: tenant.id,
    role: "TENANT",
    name: tenant.name ?? null,
    phone: tenant.phone ?? null,
    email: tenant.email ?? null,
    unitId: tenant.unitId ?? null,
    unit: tenant.unit
      ? {
          id: tenant.unit.id,
          buildingId: tenant.unit.buildingId,
          unitNumber: tenant.unit.unitNumber,
          floor: tenant.unit.floor ?? null,
        }
      : null,
  };
}

export function contactFromContractor(contractor: ContractorDTO): ContactDTO {
  return {
    id: contractor.id,
    role: "CONTRACTOR",
    name: contractor.name,
    phone: contractor.phone,
    email: contractor.email,
    hourlyRate: contractor.hourlyRate,
    serviceCategories: contractor.serviceCategories,
  };
}
