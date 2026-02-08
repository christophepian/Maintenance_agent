import { MaintenanceRequestDTO } from "../maintenanceRequests";

export type WorkRequestDTO = {
  id: string;
  description: string;
  category: string | null;
  estimatedCost: number | null;
  status: string;
  createdAt: string;
  property?: {
    id: string;
    name: string;
    address?: string | null;
  } | null;
  unit?: {
    id: string;
    unitNumber: string;
    floor?: string | null;
  } | null;
  asset?: {
    id: string;
    name: string;
    serial?: string | null;
    model?: {
      id: string;
      manufacturer: string;
      model: string;
      category: string;
    } | null;
  } | null;
  createdBy?: {
    tenantId?: string | null;
    contactPhone?: string | null;
  } | null;
  assignedVendor?: {
    id: string;
    name: string;
    phone: string;
    email: string;
    hourlyRate: number;
  } | null;
};

export function workRequestFromRequest(req: MaintenanceRequestDTO): WorkRequestDTO {
  const unit = req.unit as any | null;
  const building = unit?.building ?? null;
  const appliance = req.appliance as any | null;

  return {
    id: req.id,
    description: req.description,
    category: req.category ?? null,
    estimatedCost: req.estimatedCost ?? null,
    status: String(req.status),
    createdAt: req.createdAt,
    property: building
      ? {
          id: building.id,
          name: building.name,
          address: building.address ?? null,
        }
      : null,
    unit: unit
      ? {
          id: unit.id,
          unitNumber: unit.unitNumber,
          floor: unit.floor ?? null,
        }
      : null,
    asset: appliance
      ? {
          id: appliance.id,
          name: appliance.name,
          serial: appliance.serial ?? null,
          model: appliance.assetModel
            ? {
                id: appliance.assetModel.id,
                manufacturer: appliance.assetModel.manufacturer,
                model: appliance.assetModel.model,
                category: appliance.assetModel.category,
              }
            : null,
        }
      : null,
    createdBy: {
      tenantId: req.tenantId ?? null,
      contactPhone: req.contactPhone ?? null,
    },
    assignedVendor: req.assignedContractor
      ? {
          id: req.assignedContractor.id,
          name: req.assignedContractor.name,
          phone: req.assignedContractor.phone,
          email: req.assignedContractor.email,
          hourlyRate: req.assignedContractor.hourlyRate,
        }
      : null,
  };
}
