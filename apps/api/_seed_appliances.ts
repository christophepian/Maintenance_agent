import { PrismaClient } from '@prisma/client';
const p = new PrismaClient();

async function main() {
  const buildingId = '00aa5355-fca3-4378-bf86-fdf348067ca8';

  // Find a unit in this building
  let unit = await p.unit.findFirst({ where: { buildingId } });
  if (!unit) {
    // Create a unit
    unit = await p.unit.create({
      data: {
        buildingId,
        orgId: 'default-org',
        name: 'Unit 101',
        type: 'APARTMENT',
      },
    });
    console.log('Created unit:', unit.id);
  } else {
    console.log('Found unit:', unit.id, unit.name);
  }

  // Create asset models if needed
  const models = [
    { name: 'Gas Boiler', assetType: 'HVAC', usefulLifeYears: 20, replacementCostCents: 1500000, tradeGroup: 'Mechanical' },
    { name: 'Flat Roof Membrane', assetType: 'STRUCTURAL', usefulLifeYears: 25, replacementCostCents: 4500000, tradeGroup: 'Structural' },
    { name: 'Kitchen Appliances Set', assetType: 'APPLIANCE', usefulLifeYears: 15, replacementCostCents: 800000, tradeGroup: 'Finish' },
    { name: 'Elevator System', assetType: 'MECHANICAL', usefulLifeYears: 30, replacementCostCents: 12000000, tradeGroup: 'Mechanical' },
    { name: 'Solar Panel Array', assetType: 'ENERGY', usefulLifeYears: 25, replacementCostCents: 3500000, tradeGroup: 'Energy' },
  ];

  for (const m of models) {
    // Check if model exists
    let model = await p.assetModel.findFirst({ where: { name: m.name, orgId: 'default-org' } });
    if (!model) {
      model = await p.assetModel.create({
        data: {
          orgId: 'default-org',
          name: m.name,
          category: m.assetType,
          usefulLifeYears: m.usefulLifeYears,
          replacementCostCents: m.replacementCostCents,
        },
      });
      console.log('Created model:', model.name, model.id);
    }

    // Create appliance linked to unit
    const existingAppliance = await p.appliance.findFirst({
      where: { unitId: unit.id, assetModelId: model.id },
    });
    if (!existingAppliance) {
      const installDate = new Date(2015, 0, 1);
      const appliance = await p.appliance.create({
        data: {
          orgId: 'default-org',
          unitId: unit.id,
          assetModelId: model.id,
          name: m.name,
          installDate,
          tradeGroup: m.tradeGroup,
        },
      });
      console.log('Created appliance:', appliance.name, appliance.id);
    } else {
      console.log('Appliance exists:', existingAppliance.name);
    }
  }

  console.log('Done seeding appliances');
  await p.$disconnect();
}

main().catch(e => { console.error(e); process.exit(1); });
