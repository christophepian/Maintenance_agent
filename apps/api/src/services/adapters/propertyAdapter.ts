export type PropertyDTO = {
  id: string;
  name: string;
  address?: string | null;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
};

export function propertyFromBuilding(building: {
  id: string;
  name: string;
  address?: string | null;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}): PropertyDTO {
  return {
    id: building.id,
    name: building.name,
    address: building.address ?? null,
    isActive: building.isActive,
    createdAt: building.createdAt.toISOString(),
    updatedAt: building.updatedAt.toISOString(),
  };
}
