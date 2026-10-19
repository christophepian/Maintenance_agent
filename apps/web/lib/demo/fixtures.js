/* GENERATED — do not edit by hand.
 * Frozen output of the real ingestion + reporting pipeline.
 * Regenerate: npx tsx apps/api/scripts/generate-demo-fixtures.ts [package-dir]
 */
export default {
  "meta": {
    "generatedAt": "2026-09-08T13:12:21.373Z",
    "source": "synthetic",
    "fiscalYear": 2025,
    "from": "2025-01-01",
    "to": "2025-12-31",
    "buildingId": "demo-building"
  },
  "routes": {
    "/buildings/demo-building": {
      "data": {
        "id": "demo-building",
        "orgId": "demo-fixture-org",
        "name": "Résidence des Charmilles",
        "address": "18 rue des Charmilles, 1203 Genève",
        "city": "Genève",
        "postalCode": "1203",
        "yearBuilt": 1974,
        "hasElevator": true,
        "hasConcierge": true,
        "managedSince": null,
        "canton": null,
        "parcelNumber": null,
        "easementsText": null,
        "ecaVolumeM3": null,
        "netAreaSqm": null,
        "weightedAreaSqm": null,
        "lotsApartments": null,
        "lotsGarages": null,
        "lotsExteriorParking": null,
        "constructionDate": "1974-05-01T00:00:00.000Z",
        "lastRenovationDate": "2009-09-01T00:00:00.000Z",
        "fiscalValueChf": 4820000,
        "insuranceValueChf": 7100000,
        "ppeEstimateChf": 6180000,
        "etatLocatifNetChf": 175296,
        "createdAt": "2026-09-08T13:12:18.443Z",
        "updatedAt": "2026-09-08T13:12:19.612Z",
        "isActive": true,
        "managerId": null,
        "manager": null,
        "owners": [
          {
            "id": "2b85b877-4075-43a3-b5d7-ac2b8e277538",
            "name": "Demo Owner",
            "email": "demo-owner@stoneiq.local"
          }
        ],
        "tenants": [
          {
            "tenantId": "62a0ab73-4c13-48a5-90fa-048c71773b29",
            "name": "MARCHAND Sylvie",
            "phone": "+41422831626",
            "email": null,
            "unitNumber": "0001",
            "unitId": "demo-unit-0001",
            "moveInDate": "2018-04-01T00:00:00.000Z",
            "source": "BOTH"
          },
          {
            "tenantId": "fa6e4ee1-1ecb-482d-bf34-be28750d528c",
            "name": "BRUNNER Thomas",
            "phone": "+41874230560",
            "email": null,
            "unitNumber": "0002",
            "unitId": "demo-unit-0002",
            "moveInDate": "2021-09-01T00:00:00.000Z",
            "source": "BOTH"
          },
          {
            "tenantId": "068a4df8-cddb-476e-9ac5-877af7e11639",
            "name": "DA SILVA Marco",
            "phone": "+41546015606",
            "email": null,
            "unitNumber": "0003",
            "unitId": "demo-unit-0003",
            "moveInDate": "2016-07-15T00:00:00.000Z",
            "source": "BOTH"
          },
          {
            "tenantId": "318f1116-034f-429c-962a-7726000fe04c",
            "name": "KELLER Andrea",
            "phone": "+41112898434",
            "email": null,
            "unitNumber": "0004",
            "unitId": "demo-unit-0004",
            "moveInDate": "2020-02-01T00:00:00.000Z",
            "source": "BOTH"
          },
          {
            "tenantId": "4fba14e0-f296-4607-a982-0d0bb6759548",
            "name": "NGUYEN Thi Lan",
            "phone": "+41194635248",
            "email": null,
            "unitNumber": "0005",
            "unitId": "demo-unit-0005",
            "moveInDate": "2019-11-01T00:00:00.000Z",
            "source": "BOTH"
          },
          {
            "tenantId": "9d15d37a-79b3-4b49-8943-3315bc6ecabe",
            "name": "ROSSI Giulia",
            "phone": "+41005388075",
            "email": null,
            "unitNumber": "0006",
            "unitId": "demo-unit-0006",
            "moveInDate": "2023-06-01T00:00:00.000Z",
            "source": "BOTH"
          },
          {
            "tenantId": "dd70f871-e83a-46ed-b841-918d40e5fc68",
            "name": "FAVRE Olivier",
            "phone": "+41394841356",
            "email": null,
            "unitNumber": "0007",
            "unitId": "demo-unit-0007",
            "moveInDate": "2017-03-01T00:00:00.000Z",
            "source": "BOTH"
          },
          {
            "tenantId": "62a0ab73-4c13-48a5-90fa-048c71773b29",
            "name": "MARCHAND Sylvie",
            "phone": "+41422831626",
            "email": null,
            "unitNumber": "9001",
            "unitId": "demo-unit-9001",
            "moveInDate": "2018-04-01T00:00:00.000Z",
            "source": "BOTH"
          },
          {
            "tenantId": "068a4df8-cddb-476e-9ac5-877af7e11639",
            "name": "DA SILVA Marco",
            "phone": "+41546015606",
            "email": null,
            "unitNumber": "9002",
            "unitId": "demo-unit-9002",
            "moveInDate": "2016-07-15T00:00:00.000Z",
            "source": "BOTH"
          },
          {
            "tenantId": "4fba14e0-f296-4607-a982-0d0bb6759548",
            "name": "NGUYEN Thi Lan",
            "phone": "+41194635248",
            "email": null,
            "unitNumber": "9003",
            "unitId": "demo-unit-9003",
            "moveInDate": "2019-11-01T00:00:00.000Z",
            "source": "BOTH"
          }
        ]
      }
    },
    "/buildings/demo-building/kpis": {
      "data": {
        "openRequests": 0,
        "openJobs": 0
      }
    },
    "/buildings/demo-building/units": {
      "data": [
        {
          "id": "demo-unit-0001",
          "buildingId": "demo-building",
          "orgId": "demo-fixture-org",
          "unitNumber": "0001",
          "floor": "rez-de-chaussée",
          "type": "RESIDENTIAL",
          "parkingKind": null,
          "linkedFlatId": null,
          "isActive": true,
          "isVacant": false,
          "monthlyRentChf": 1931,
          "monthlyChargesChf": 180,
          "livingAreaSqm": 78,
          "rooms": 3.5,
          "hasBalcony": false,
          "hasTerrace": false,
          "hasParking": false,
          "createdAt": "2026-09-08T13:12:18.476Z",
          "updatedAt": "2026-09-08T13:12:19.617Z",
          "occupancyStatus": "OCCUPIED",
          "listed": false,
          "tenantName": "MARCHAND Sylvie",
          "moveInDate": "2018-04-01T00:00:00.000Z"
        },
        {
          "id": "demo-unit-0002",
          "buildingId": "demo-building",
          "orgId": "demo-fixture-org",
          "unitNumber": "0002",
          "floor": "rez-de-chaussée",
          "type": "RESIDENTIAL",
          "parkingKind": null,
          "linkedFlatId": null,
          "isActive": true,
          "isVacant": false,
          "monthlyRentChf": 1570,
          "monthlyChargesChf": 140,
          "livingAreaSqm": 58,
          "rooms": 2.5,
          "hasBalcony": false,
          "hasTerrace": false,
          "hasParking": false,
          "createdAt": "2026-09-08T13:12:18.506Z",
          "updatedAt": "2026-09-08T13:12:19.618Z",
          "occupancyStatus": "OCCUPIED",
          "listed": false,
          "tenantName": "BRUNNER Thomas",
          "moveInDate": "2021-09-01T00:00:00.000Z"
        },
        {
          "id": "demo-unit-0003",
          "buildingId": "demo-building",
          "orgId": "demo-fixture-org",
          "unitNumber": "0003",
          "floor": "1er étage",
          "type": "RESIDENTIAL",
          "parkingKind": null,
          "linkedFlatId": null,
          "isActive": true,
          "isVacant": false,
          "monthlyRentChf": 2477,
          "monthlyChargesChf": 220,
          "livingAreaSqm": 102,
          "rooms": 4.5,
          "hasBalcony": false,
          "hasTerrace": false,
          "hasParking": false,
          "createdAt": "2026-09-08T13:12:18.530Z",
          "updatedAt": "2026-09-08T13:12:19.619Z",
          "occupancyStatus": "OCCUPIED",
          "listed": false,
          "tenantName": "DA SILVA Marco",
          "moveInDate": "2016-07-15T00:00:00.000Z"
        },
        {
          "id": "demo-unit-0004",
          "buildingId": "demo-building",
          "orgId": "demo-fixture-org",
          "unitNumber": "0004",
          "floor": "1er étage",
          "type": "RESIDENTIAL",
          "parkingKind": null,
          "linkedFlatId": null,
          "isActive": true,
          "isVacant": false,
          "monthlyRentChf": 1999,
          "monthlyChargesChf": 180,
          "livingAreaSqm": 80,
          "rooms": 3.5,
          "hasBalcony": false,
          "hasTerrace": false,
          "hasParking": false,
          "createdAt": "2026-09-08T13:12:18.554Z",
          "updatedAt": "2026-09-08T13:12:19.620Z",
          "occupancyStatus": "OCCUPIED",
          "listed": false,
          "tenantName": "KELLER Andrea",
          "moveInDate": "2020-02-01T00:00:00.000Z"
        },
        {
          "id": "demo-unit-0005",
          "buildingId": "demo-building",
          "orgId": "demo-fixture-org",
          "unitNumber": "0005",
          "floor": "2e étage",
          "type": "RESIDENTIAL",
          "parkingKind": null,
          "linkedFlatId": null,
          "isActive": true,
          "isVacant": false,
          "monthlyRentChf": 2555,
          "monthlyChargesChf": 220,
          "livingAreaSqm": 104,
          "rooms": 4.5,
          "hasBalcony": false,
          "hasTerrace": false,
          "hasParking": false,
          "createdAt": "2026-09-08T13:12:18.563Z",
          "updatedAt": "2026-09-08T13:12:19.621Z",
          "occupancyStatus": "OCCUPIED",
          "listed": false,
          "tenantName": "NGUYEN Thi Lan",
          "moveInDate": "2019-11-01T00:00:00.000Z"
        },
        {
          "id": "demo-unit-0006",
          "buildingId": "demo-building",
          "orgId": "demo-fixture-org",
          "unitNumber": "0006",
          "floor": "2e étage",
          "type": "RESIDENTIAL",
          "parkingKind": null,
          "linkedFlatId": null,
          "isActive": true,
          "isVacant": false,
          "monthlyRentChf": 1648,
          "monthlyChargesChf": 140,
          "livingAreaSqm": 56,
          "rooms": 2.5,
          "hasBalcony": false,
          "hasTerrace": false,
          "hasParking": false,
          "createdAt": "2026-09-08T13:12:18.587Z",
          "updatedAt": "2026-09-08T13:12:19.622Z",
          "occupancyStatus": "OCCUPIED",
          "listed": false,
          "tenantName": "ROSSI Giulia",
          "moveInDate": "2023-06-01T00:00:00.000Z"
        },
        {
          "id": "demo-unit-0007",
          "buildingId": "demo-building",
          "orgId": "demo-fixture-org",
          "unitNumber": "0007",
          "floor": "3e étage",
          "type": "RESIDENTIAL",
          "parkingKind": null,
          "linkedFlatId": null,
          "isActive": true,
          "isVacant": false,
          "monthlyRentChf": 1960,
          "monthlyChargesChf": 180,
          "livingAreaSqm": 79,
          "rooms": 3.5,
          "hasBalcony": false,
          "hasTerrace": false,
          "hasParking": false,
          "createdAt": "2026-09-08T13:12:18.596Z",
          "updatedAt": "2026-09-08T13:12:19.623Z",
          "occupancyStatus": "OCCUPIED",
          "listed": false,
          "tenantName": "FAVRE Olivier",
          "moveInDate": "2017-03-01T00:00:00.000Z"
        },
        {
          "id": "demo-unit-0008",
          "buildingId": "demo-building",
          "orgId": "demo-fixture-org",
          "unitNumber": "0008",
          "floor": "3e étage",
          "type": "RESIDENTIAL",
          "parkingKind": null,
          "linkedFlatId": null,
          "isActive": true,
          "isVacant": true,
          "monthlyRentChf": 2516,
          "monthlyChargesChf": 220,
          "livingAreaSqm": 101,
          "rooms": 4.5,
          "hasBalcony": false,
          "hasTerrace": false,
          "hasParking": false,
          "createdAt": "2026-09-08T13:12:18.603Z",
          "updatedAt": "2026-09-08T13:12:19.624Z",
          "occupancyStatus": "VACANT",
          "listed": true,
          "tenantName": null,
          "moveInDate": null
        },
        {
          "id": "demo-unit-9001",
          "buildingId": "demo-building",
          "orgId": "demo-fixture-org",
          "unitNumber": "9001",
          "floor": "sous-sol",
          "type": "PARKING",
          "parkingKind": "GARAGE",
          "linkedFlatId": "demo-unit-0001",
          "isActive": true,
          "isVacant": false,
          "monthlyRentChf": 156,
          "monthlyChargesChf": 0,
          "livingAreaSqm": null,
          "rooms": null,
          "hasBalcony": false,
          "hasTerrace": false,
          "hasParking": false,
          "createdAt": "2026-09-08T13:12:18.631Z",
          "updatedAt": "2026-09-08T13:12:19.625Z",
          "occupancyStatus": "OCCUPIED",
          "listed": false,
          "tenantName": "MARCHAND Sylvie",
          "moveInDate": "2018-04-01T00:00:00.000Z"
        },
        {
          "id": "demo-unit-9002",
          "buildingId": "demo-building",
          "orgId": "demo-fixture-org",
          "unitNumber": "9002",
          "floor": "sous-sol",
          "type": "PARKING",
          "parkingKind": "GARAGE",
          "linkedFlatId": "demo-unit-0003",
          "isActive": true,
          "isVacant": false,
          "monthlyRentChf": 156,
          "monthlyChargesChf": 0,
          "livingAreaSqm": null,
          "rooms": null,
          "hasBalcony": false,
          "hasTerrace": false,
          "hasParking": false,
          "createdAt": "2026-09-08T13:12:18.644Z",
          "updatedAt": "2026-09-08T13:12:19.626Z",
          "occupancyStatus": "OCCUPIED",
          "listed": false,
          "tenantName": "DA SILVA Marco",
          "moveInDate": "2016-07-15T00:00:00.000Z"
        },
        {
          "id": "demo-unit-9003",
          "buildingId": "demo-building",
          "orgId": "demo-fixture-org",
          "unitNumber": "9003",
          "floor": "sous-sol",
          "type": "PARKING",
          "parkingKind": "GARAGE",
          "linkedFlatId": "demo-unit-0005",
          "isActive": true,
          "isVacant": false,
          "monthlyRentChf": 156,
          "monthlyChargesChf": 0,
          "livingAreaSqm": null,
          "rooms": null,
          "hasBalcony": false,
          "hasTerrace": false,
          "hasParking": false,
          "createdAt": "2026-09-08T13:12:18.658Z",
          "updatedAt": "2026-09-08T13:12:19.627Z",
          "occupancyStatus": "OCCUPIED",
          "listed": false,
          "tenantName": "NGUYEN Thi Lan",
          "moveInDate": "2019-11-01T00:00:00.000Z"
        },
        {
          "id": "demo-unit-9004",
          "buildingId": "demo-building",
          "orgId": "demo-fixture-org",
          "unitNumber": "9004",
          "floor": "sous-sol",
          "type": "PARKING",
          "parkingKind": "GARAGE",
          "linkedFlatId": null,
          "isActive": true,
          "isVacant": true,
          "monthlyRentChf": 156,
          "monthlyChargesChf": 0,
          "livingAreaSqm": null,
          "rooms": null,
          "hasBalcony": false,
          "hasTerrace": false,
          "hasParking": false,
          "createdAt": "2026-09-08T13:12:18.665Z",
          "updatedAt": "2026-09-08T13:12:19.627Z",
          "occupancyStatus": "VACANT",
          "listed": true,
          "tenantName": null,
          "moveInDate": null
        }
      ]
    },
    "/buildings/demo-building/period-report": {
      "data": {
        "financials": {
          "buildingId": "demo-building",
          "buildingName": "Résidence des Charmilles",
          "from": "2025-01-01",
          "to": "2025-12-31",
          "collectedIncomeCents": 19488000,
          "accruedIncomeCents": 19488000,
          "expensesTotalCents": 7336000,
          "maintenanceTotalCents": 0,
          "capexTotalCents": 0,
          "operatingTotalCents": 7336000,
          "netIncomeCents": 12152000,
          "netOperatingIncomeCents": 12152000,
          "financingTotalCents": 0,
          "recoverableAncillaryCents": 4080000,
          "tenantRechargeCents": 0,
          "rentalIncomeCents": 19488000,
          "serviceChargeIncomeCents": 0,
          "receivablesCents": 0,
          "payablesCents": 0,
          "openingReceivablesCents": 1420100,
          "openingPayablesCents": 1320400,
          "maintenanceRatio": 0,
          "costPerUnitCents": 611333,
          "collectionRate": 1,
          "invoicedForPeriodCents": 19488000,
          "paidForPeriodCents": 19488000,
          "activeUnitsCount": 11,
          "totalUnitsCount": 12,
          "expensesByCategory": [],
          "topContractorsBySpend": [],
          "expensesByAccount": [
            {
              "accountId": "b599dbc0-037f-467e-a35b-0aa699240be6",
              "accountName": "Chauffage et eau chaude",
              "accountCode": "60100",
              "totalCents": 1935000,
              "category": "RECOVERABLE"
            },
            {
              "accountId": "532dc76c-ed03-4041-8751-90d7c2ce4c6d",
              "accountName": "Conciergerie et nettoyage",
              "accountCode": "61100",
              "totalCents": 1440000,
              "category": "RECOVERABLE"
            },
            {
              "accountId": "3c7474de-42f2-4454-b809-a127e5b36065",
              "accountName": "Honoraires de gérance",
              "accountCode": "63100",
              "totalCents": 1148000,
              "category": "OWNER_OPEX"
            },
            {
              "accountId": "cae58932-de55-4dab-a532-8ba9f3e2a6a2",
              "accountName": "Entretien des appartements",
              "accountCode": "61200",
              "totalCents": 704000,
              "category": "OWNER_OPEX"
            },
            {
              "accountId": "0efce5b5-6a19-4c77-a8a4-afff5e29c296",
              "accountName": "Assurances immeuble",
              "accountCode": "62100",
              "totalCents": 542000,
              "category": "OWNER_OPEX"
            },
            {
              "accountId": "d78d579e-43f6-46f2-be88-1958687191ae",
              "accountName": "Entretien parties communes",
              "accountCode": "61300",
              "totalCents": 538000,
              "category": "OWNER_OPEX"
            },
            {
              "accountId": "aad74f6b-eb6c-4106-99f6-4f780c96d359",
              "accountName": "Eau et épuration",
              "accountCode": "60200",
              "totalCents": 535000,
              "category": "RECOVERABLE"
            },
            {
              "accountId": "84d01b2d-6c9e-4dcf-9bf3-2f7a96dbcebb",
              "accountName": "Impôts et taxes",
              "accountCode": "64100",
              "totalCents": 324000,
              "category": "OWNER_OPEX"
            },
            {
              "accountId": "acb44931-7665-4dec-ace9-1a570a5ed9d6",
              "accountName": "Électricité communs",
              "accountCode": "60300",
              "totalCents": 170000,
              "category": "RECOVERABLE"
            }
          ],
          "source": "imported"
        },
        "prevFinancials": {
          "buildingId": "demo-building",
          "buildingName": "Résidence des Charmilles",
          "from": "2024-01-02",
          "to": "2024-12-31",
          "collectedIncomeCents": 18948885,
          "accruedIncomeCents": 18948885,
          "expensesTotalCents": 7315956,
          "maintenanceTotalCents": 0,
          "capexTotalCents": 0,
          "operatingTotalCents": 7315956,
          "netIncomeCents": 11632929,
          "netOperatingIncomeCents": 11632929,
          "financingTotalCents": 0,
          "recoverableAncillaryCents": 4068852,
          "tenantRechargeCents": 0,
          "rentalIncomeCents": 18948885,
          "serviceChargeIncomeCents": 0,
          "receivablesCents": 0,
          "payablesCents": 0,
          "openingReceivablesCents": 701100,
          "openingPayablesCents": 660200,
          "maintenanceRatio": 0,
          "costPerUnitCents": 609663,
          "collectionRate": 1,
          "invoicedForPeriodCents": 18948885,
          "paidForPeriodCents": 18948885,
          "activeUnitsCount": 11,
          "totalUnitsCount": 12,
          "expensesByCategory": [],
          "topContractorsBySpend": [],
          "expensesByAccount": [
            {
              "accountId": "b599dbc0-037f-467e-a35b-0aa699240be6",
              "accountName": "Chauffage et eau chaude",
              "accountCode": "60100",
              "totalCents": 1929713,
              "category": "RECOVERABLE"
            },
            {
              "accountId": "532dc76c-ed03-4041-8751-90d7c2ce4c6d",
              "accountName": "Conciergerie et nettoyage",
              "accountCode": "61100",
              "totalCents": 1436066,
              "category": "RECOVERABLE"
            },
            {
              "accountId": "3c7474de-42f2-4454-b809-a127e5b36065",
              "accountName": "Honoraires de gérance",
              "accountCode": "63100",
              "totalCents": 1144863,
              "category": "OWNER_OPEX"
            },
            {
              "accountId": "cae58932-de55-4dab-a532-8ba9f3e2a6a2",
              "accountName": "Entretien des appartements",
              "accountCode": "61200",
              "totalCents": 702077,
              "category": "OWNER_OPEX"
            },
            {
              "accountId": "0efce5b5-6a19-4c77-a8a4-afff5e29c296",
              "accountName": "Assurances immeuble",
              "accountCode": "62100",
              "totalCents": 540519,
              "category": "OWNER_OPEX"
            },
            {
              "accountId": "d78d579e-43f6-46f2-be88-1958687191ae",
              "accountName": "Entretien parties communes",
              "accountCode": "61300",
              "totalCents": 536530,
              "category": "OWNER_OPEX"
            },
            {
              "accountId": "aad74f6b-eb6c-4106-99f6-4f780c96d359",
              "accountName": "Eau et épuration",
              "accountCode": "60200",
              "totalCents": 533538,
              "category": "RECOVERABLE"
            },
            {
              "accountId": "84d01b2d-6c9e-4dcf-9bf3-2f7a96dbcebb",
              "accountName": "Impôts et taxes",
              "accountCode": "64100",
              "totalCents": 323115,
              "category": "OWNER_OPEX"
            },
            {
              "accountId": "acb44931-7665-4dec-ace9-1a570a5ed9d6",
              "accountName": "Électricité communs",
              "accountCode": "60300",
              "totalCents": 169536,
              "category": "RECOVERABLE"
            }
          ],
          "source": "imported"
        },
        "arrears": {
          "currentCents": 0,
          "overdue1to30Cents": 0,
          "overdue31to60Cents": 0,
          "overdue61plusCents": 0,
          "totalOverdueCents": 0
        },
        "moveIns": [],
        "moveOuts": [
          {
            "id": "a9fc1b96-ce15-49b9-805c-fa555bad62cd",
            "unitId": "demo-unit-0008",
            "unitNumber": "0008",
            "tenantName": "PERRET Claude",
            "endDate": "2025-09-08"
          }
        ],
        "monthlyData": [
          {
            "month": 1,
            "collectedIncomeCents": 1624000,
            "expensesTotalCents": 611333,
            "noiCents": 1012666,
            "collectionRate": 1
          },
          {
            "month": 2,
            "collectedIncomeCents": 1624000,
            "expensesTotalCents": 611333,
            "noiCents": 1012666,
            "collectionRate": 1
          },
          {
            "month": 3,
            "collectedIncomeCents": 1624000,
            "expensesTotalCents": 611333,
            "noiCents": 1012666,
            "collectionRate": 1
          },
          {
            "month": 4,
            "collectedIncomeCents": 1624000,
            "expensesTotalCents": 611333,
            "noiCents": 1012666,
            "collectionRate": 1
          },
          {
            "month": 5,
            "collectedIncomeCents": 1624000,
            "expensesTotalCents": 611333,
            "noiCents": 1012666,
            "collectionRate": 1
          },
          {
            "month": 6,
            "collectedIncomeCents": 1624000,
            "expensesTotalCents": 611333,
            "noiCents": 1012666,
            "collectionRate": 1
          },
          {
            "month": 7,
            "collectedIncomeCents": 1624000,
            "expensesTotalCents": 611333,
            "noiCents": 1012666,
            "collectionRate": 1
          },
          {
            "month": 8,
            "collectedIncomeCents": 1624000,
            "expensesTotalCents": 611333,
            "noiCents": 1012666,
            "collectionRate": 1
          },
          {
            "month": 9,
            "collectedIncomeCents": 1624000,
            "expensesTotalCents": 611333,
            "noiCents": 1012666,
            "collectionRate": 1
          },
          {
            "month": 10,
            "collectedIncomeCents": 1624000,
            "expensesTotalCents": 611333,
            "noiCents": 1012666,
            "collectionRate": 1
          },
          {
            "month": 11,
            "collectedIncomeCents": 1624000,
            "expensesTotalCents": 611333,
            "noiCents": 1012666,
            "collectionRate": 1
          },
          {
            "month": 12,
            "collectedIncomeCents": 1624000,
            "expensesTotalCents": 611337,
            "noiCents": 1012674,
            "collectionRate": 1
          }
        ],
        "leaseExpiries": [],
        "ledgerImbalanceCents": 0
      }
    },
    "/buildings/demo-building/unit-financials": {
      "data": [
        {
          "unitId": "demo-unit-0001",
          "unitNumber": "0001",
          "floor": "rez-de-chaussée",
          "tenantName": "MARCHAND Sylvie",
          "accruedIncomeCents": 2317200,
          "collectedIncomeCents": 2317200,
          "expensesCents": 39000,
          "apportionedChargesCents": 0,
          "netIncomeCents": 2278200,
          "collectionRate": 1,
          "occupancyRate": 1,
          "monthlyRentChf": 1931
        },
        {
          "unitId": "demo-unit-0002",
          "unitNumber": "0002",
          "floor": "rez-de-chaussée",
          "tenantName": "BRUNNER Thomas",
          "accruedIncomeCents": 1884000,
          "collectedIncomeCents": 1884000,
          "expensesCents": 0,
          "apportionedChargesCents": 0,
          "netIncomeCents": 1884000,
          "collectionRate": 1,
          "occupancyRate": 1,
          "monthlyRentChf": 1570
        },
        {
          "unitId": "demo-unit-0003",
          "unitNumber": "0003",
          "floor": "1er étage",
          "tenantName": "DA SILVA Marco",
          "accruedIncomeCents": 2972400,
          "collectedIncomeCents": 2972400,
          "expensesCents": 68000,
          "apportionedChargesCents": 0,
          "netIncomeCents": 2904400,
          "collectionRate": 1,
          "occupancyRate": 1,
          "monthlyRentChf": 2477
        },
        {
          "unitId": "demo-unit-0004",
          "unitNumber": "0004",
          "floor": "1er étage",
          "tenantName": "KELLER Andrea",
          "accruedIncomeCents": 2398800,
          "collectedIncomeCents": 2398800,
          "expensesCents": 0,
          "apportionedChargesCents": 0,
          "netIncomeCents": 2398800,
          "collectionRate": 1,
          "occupancyRate": 1,
          "monthlyRentChf": 1999
        },
        {
          "unitId": "demo-unit-0005",
          "unitNumber": "0005",
          "floor": "2e étage",
          "tenantName": "NGUYEN Thi Lan",
          "accruedIncomeCents": 3066000,
          "collectedIncomeCents": 3066000,
          "expensesCents": 54000,
          "apportionedChargesCents": 0,
          "netIncomeCents": 3012000,
          "collectionRate": 1,
          "occupancyRate": 1,
          "monthlyRentChf": 2555
        },
        {
          "unitId": "demo-unit-0006",
          "unitNumber": "0006",
          "floor": "2e étage",
          "tenantName": "ROSSI Giulia",
          "accruedIncomeCents": 1977600,
          "collectedIncomeCents": 1977600,
          "expensesCents": 0,
          "apportionedChargesCents": 0,
          "netIncomeCents": 1977600,
          "collectionRate": 1,
          "occupancyRate": 1,
          "monthlyRentChf": 1648
        },
        {
          "unitId": "demo-unit-0007",
          "unitNumber": "0007",
          "floor": "3e étage",
          "tenantName": "FAVRE Olivier",
          "accruedIncomeCents": 2352000,
          "collectedIncomeCents": 2352000,
          "expensesCents": 118000,
          "apportionedChargesCents": 0,
          "netIncomeCents": 2234000,
          "collectionRate": 1,
          "occupancyRate": 1,
          "monthlyRentChf": 1960
        },
        {
          "unitId": "demo-unit-0008",
          "unitNumber": "0008",
          "floor": "3e étage",
          "tenantName": null,
          "accruedIncomeCents": 0,
          "collectedIncomeCents": 0,
          "expensesCents": 425000,
          "apportionedChargesCents": 0,
          "netIncomeCents": -425000,
          "collectionRate": 0,
          "occupancyRate": 0,
          "monthlyRentChf": 2516
        },
        {
          "unitId": "demo-unit-9001",
          "unitNumber": "9001",
          "floor": "sous-sol",
          "tenantName": "MARCHAND Sylvie",
          "accruedIncomeCents": 187200,
          "collectedIncomeCents": 187200,
          "expensesCents": 0,
          "apportionedChargesCents": 0,
          "netIncomeCents": 187200,
          "collectionRate": 1,
          "occupancyRate": 1,
          "monthlyRentChf": 156
        },
        {
          "unitId": "demo-unit-9002",
          "unitNumber": "9002",
          "floor": "sous-sol",
          "tenantName": "DA SILVA Marco",
          "accruedIncomeCents": 187200,
          "collectedIncomeCents": 187200,
          "expensesCents": 0,
          "apportionedChargesCents": 0,
          "netIncomeCents": 187200,
          "collectionRate": 1,
          "occupancyRate": 1,
          "monthlyRentChf": 156
        },
        {
          "unitId": "demo-unit-9003",
          "unitNumber": "9003",
          "floor": "sous-sol",
          "tenantName": "NGUYEN Thi Lan",
          "accruedIncomeCents": 187200,
          "collectedIncomeCents": 187200,
          "expensesCents": 0,
          "apportionedChargesCents": 0,
          "netIncomeCents": 187200,
          "collectionRate": 1,
          "occupancyRate": 1,
          "monthlyRentChf": 156
        },
        {
          "unitId": "demo-unit-9004",
          "unitNumber": "9004",
          "floor": "sous-sol",
          "tenantName": null,
          "accruedIncomeCents": 0,
          "collectedIncomeCents": 0,
          "expensesCents": 0,
          "apportionedChargesCents": 0,
          "netIncomeCents": 0,
          "collectionRate": 0,
          "occupancyRate": 0,
          "monthlyRentChf": 156
        }
      ]
    },
    "/buildings/demo-building/vendor-spend": {
      "data": [
        {
          "contractorId": "207a2d82-b568-4d7e-ac01-25c98ceb2fe6",
          "vendorName": "SIG Genève",
          "totalCents": 2640000,
          "invoiceCount": 8
        },
        {
          "contractorId": "97a4964c-5635-420e-8430-9c0cf4574810",
          "vendorName": "Net & Clair Sàrl",
          "totalCents": 1440000,
          "invoiceCount": 4
        },
        {
          "contractorId": "2321ddfc-293f-45c4-9e74-f4be29d27523",
          "vendorName": "Régie Léman SA",
          "totalCents": 1148000,
          "invoiceCount": 4
        },
        {
          "contractorId": "5e12d243-3041-43b9-a19d-f75411e8ad31",
          "vendorName": "Bâloise Assurances",
          "totalCents": 542000,
          "invoiceCount": 1
        },
        {
          "contractorId": "35c18f43-5325-4537-a625-bad4c427bf62",
          "vendorName": "Peinture Dubois",
          "totalCents": 425000,
          "invoiceCount": 1
        },
        {
          "contractorId": "fd9ed207-e7d1-4352-8523-6ddde931710b",
          "vendorName": "État de Genève",
          "totalCents": 324000,
          "invoiceCount": 1
        },
        {
          "contractorId": "51430aa2-7274-4ccf-a26d-1b739020d7e5",
          "vendorName": "Ascenseurs Schindler",
          "totalCents": 298000,
          "invoiceCount": 1
        },
        {
          "contractorId": "15e9c765-8d5f-4ff6-accc-3772b754e325",
          "vendorName": "Jardins du Léman",
          "totalCents": 164000,
          "invoiceCount": 1
        },
        {
          "contractorId": "806c9316-35bb-48fb-894a-641176677970",
          "vendorName": "Vitrerie Genevoise",
          "totalCents": 118000,
          "invoiceCount": 1
        },
        {
          "contractorId": "bd2cb511-94c6-4107-8c7a-62bcb2b9c2fc",
          "vendorName": "Sanitaires Perret SA",
          "totalCents": 107000,
          "invoiceCount": 2
        },
        {
          "contractorId": "a5c9979f-58df-4a30-81f0-e3ad80b86eb6",
          "vendorName": "Électricité Moret",
          "totalCents": 76000,
          "invoiceCount": 1
        },
        {
          "contractorId": "85e46ff9-916f-4881-931d-cad8ed51189a",
          "vendorName": "ACE Électroménager",
          "totalCents": 54000,
          "invoiceCount": 1
        }
      ]
    },
    "/buildings/demo-building/unit-profitability": {
      "data": {
        "buildingId": "demo-building",
        "buildingName": "Résidence des Charmilles",
        "from": "2025-01-01",
        "to": "2025-12-31",
        "periodDays": 365,
        "rows": [
          {
            "unitId": "demo-unit-9001",
            "unitNumber": "9001",
            "floor": "sous-sol",
            "tenantName": "MARCHAND Sylvie",
            "occupancyRate": 1,
            "monthlyRentChf": 156,
            "allocatedOverheadCents": 0,
            "annualNoiCents": 187200,
            "noiContributionPct": 1.11,
            "intrinsicValueChf": 35000,
            "valueSharePct": 0.54,
            "netYieldOnIntrinsicPct": 5.35,
            "sellCandidate": false
          },
          {
            "unitId": "demo-unit-9002",
            "unitNumber": "9002",
            "floor": "sous-sol",
            "tenantName": "DA SILVA Marco",
            "occupancyRate": 1,
            "monthlyRentChf": 156,
            "allocatedOverheadCents": 0,
            "annualNoiCents": 187200,
            "noiContributionPct": 1.11,
            "intrinsicValueChf": 35000,
            "valueSharePct": 0.54,
            "netYieldOnIntrinsicPct": 5.35,
            "sellCandidate": false
          },
          {
            "unitId": "demo-unit-9003",
            "unitNumber": "9003",
            "floor": "sous-sol",
            "tenantName": "NGUYEN Thi Lan",
            "occupancyRate": 1,
            "monthlyRentChf": 156,
            "allocatedOverheadCents": 0,
            "annualNoiCents": 187200,
            "noiContributionPct": 1.11,
            "intrinsicValueChf": 35000,
            "valueSharePct": 0.54,
            "netYieldOnIntrinsicPct": 5.35,
            "sellCandidate": false
          },
          {
            "unitId": "demo-unit-0006",
            "unitNumber": "0006",
            "floor": "2e étage",
            "tenantName": "ROSSI Giulia",
            "occupancyRate": 1,
            "monthlyRentChf": 1648,
            "allocatedOverheadCents": 0,
            "annualNoiCents": 1977600,
            "noiContributionPct": 11.75,
            "intrinsicValueChf": 514080,
            "valueSharePct": 7.87,
            "netYieldOnIntrinsicPct": 3.85,
            "sellCandidate": false
          },
          {
            "unitId": "demo-unit-0002",
            "unitNumber": "0002",
            "floor": "rez-de-chaussée",
            "tenantName": "BRUNNER Thomas",
            "occupancyRate": 1,
            "monthlyRentChf": 1570,
            "allocatedOverheadCents": 0,
            "annualNoiCents": 1884000,
            "noiContributionPct": 11.2,
            "intrinsicValueChf": 555930,
            "valueSharePct": 8.51,
            "netYieldOnIntrinsicPct": 3.39,
            "sellCandidate": false
          },
          {
            "unitId": "demo-unit-0003",
            "unitNumber": "0003",
            "floor": "1er étage",
            "tenantName": "DA SILVA Marco",
            "occupancyRate": 1,
            "monthlyRentChf": 2477,
            "allocatedOverheadCents": 0,
            "annualNoiCents": 2904400,
            "noiContributionPct": 17.26,
            "intrinsicValueChf": 936360,
            "valueSharePct": 14.33,
            "netYieldOnIntrinsicPct": 3.1,
            "sellCandidate": false
          },
          {
            "unitId": "demo-unit-0005",
            "unitNumber": "0005",
            "floor": "2e étage",
            "tenantName": "NGUYEN Thi Lan",
            "occupancyRate": 1,
            "monthlyRentChf": 2555,
            "allocatedOverheadCents": 0,
            "annualNoiCents": 3012000,
            "noiContributionPct": 17.9,
            "intrinsicValueChf": 996840,
            "valueSharePct": 15.25,
            "netYieldOnIntrinsicPct": 3.02,
            "sellCandidate": false
          },
          {
            "unitId": "demo-unit-0004",
            "unitNumber": "0004",
            "floor": "1er étage",
            "tenantName": "KELLER Andrea",
            "occupancyRate": 1,
            "monthlyRentChf": 1999,
            "allocatedOverheadCents": 0,
            "annualNoiCents": 2398800,
            "noiContributionPct": 14.26,
            "intrinsicValueChf": 799200,
            "valueSharePct": 12.23,
            "netYieldOnIntrinsicPct": 3,
            "sellCandidate": false
          },
          {
            "unitId": "demo-unit-0007",
            "unitNumber": "0007",
            "floor": "3e étage",
            "tenantName": "FAVRE Olivier",
            "occupancyRate": 1,
            "monthlyRentChf": 1960,
            "allocatedOverheadCents": 0,
            "annualNoiCents": 2234000,
            "noiContributionPct": 13.28,
            "intrinsicValueChf": 789210,
            "valueSharePct": 12.08,
            "netYieldOnIntrinsicPct": 2.83,
            "sellCandidate": false
          },
          {
            "unitId": "demo-unit-0001",
            "unitNumber": "0001",
            "floor": "rez-de-chaussée",
            "tenantName": "MARCHAND Sylvie",
            "occupancyRate": 1,
            "monthlyRentChf": 1931,
            "allocatedOverheadCents": 0,
            "annualNoiCents": 2278200,
            "noiContributionPct": 13.54,
            "intrinsicValueChf": 835920,
            "valueSharePct": 12.79,
            "netYieldOnIntrinsicPct": 2.73,
            "sellCandidate": false
          },
          {
            "unitId": "demo-unit-9004",
            "unitNumber": "9004",
            "floor": "sous-sol",
            "tenantName": null,
            "occupancyRate": 0,
            "monthlyRentChf": 156,
            "allocatedOverheadCents": 0,
            "annualNoiCents": 0,
            "noiContributionPct": 0,
            "intrinsicValueChf": 35000,
            "valueSharePct": 0.54,
            "netYieldOnIntrinsicPct": 0,
            "sellCandidate": true
          },
          {
            "unitId": "demo-unit-0008",
            "unitNumber": "0008",
            "floor": "3e étage",
            "tenantName": null,
            "occupancyRate": 0,
            "monthlyRentChf": 2516,
            "allocatedOverheadCents": 0,
            "annualNoiCents": -425000,
            "noiContributionPct": -2.53,
            "intrinsicValueChf": 968085,
            "valueSharePct": 14.81,
            "netYieldOnIntrinsicPct": -0.44,
            "sellCandidate": true
          }
        ],
        "totalAnnualNoiCents": 16825600,
        "buildingIntrinsicValueChf": 6535625,
        "buildingNetYieldPct": 2.57,
        "buildingNetYieldBasis": "intrinsic",
        "ppeEstimateChf": 6180000,
        "marketValueChf": 6450000,
        "totalDebtChf": 3900000,
        "navChf": 2635625,
        "buildingLevelCostsCents": 4673600,
        "buildingOperatingNoiCents": 12152000,
        "allocationKey": "livingAreaSqm",
        "reconciliation": {
          "sumUnitIncomeCents": 17529600,
          "buildingIncomeCents": 19488000,
          "buildingNoiCents": 12152000,
          "incomeDeltaCents": 1958400,
          "reconciled": false
        }
      }
    },
    "/buildings/demo-building/timeseries": {
      "data": {
        "buildingId": "demo-building",
        "range": "year",
        "points": [
          {
            "periodStart": "2017-01-01",
            "periodEnd": "2017-12-31",
            "label": "2017",
            "noiCents": 0,
            "collectedIncomeCents": 0,
            "expensesCents": 0,
            "collectionRate": 0,
            "noiMarginPct": null,
            "opexRatioPct": null,
            "occupancyRate": 0.25
          },
          {
            "periodStart": "2018-01-01",
            "periodEnd": "2018-12-31",
            "label": "2018",
            "noiCents": 0,
            "collectedIncomeCents": 0,
            "expensesCents": 0,
            "collectionRate": 0,
            "noiMarginPct": null,
            "opexRatioPct": null,
            "occupancyRate": 0.5
          },
          {
            "periodStart": "2019-01-01",
            "periodEnd": "2019-12-31",
            "label": "2019",
            "noiCents": 0,
            "collectedIncomeCents": 0,
            "expensesCents": 0,
            "collectionRate": 0,
            "noiMarginPct": null,
            "opexRatioPct": null,
            "occupancyRate": 0.6667
          },
          {
            "periodStart": "2020-01-01",
            "periodEnd": "2020-12-31",
            "label": "2020",
            "noiCents": 0,
            "collectedIncomeCents": 0,
            "expensesCents": 0,
            "collectionRate": 0,
            "noiMarginPct": null,
            "opexRatioPct": null,
            "occupancyRate": 0.75
          },
          {
            "periodStart": "2021-01-01",
            "periodEnd": "2021-12-31",
            "label": "2021",
            "noiCents": 0,
            "collectedIncomeCents": 0,
            "expensesCents": 0,
            "collectionRate": 0,
            "noiMarginPct": null,
            "opexRatioPct": null,
            "occupancyRate": 0.8333
          },
          {
            "periodStart": "2022-01-01",
            "periodEnd": "2022-12-31",
            "label": "2022",
            "noiCents": 0,
            "collectedIncomeCents": 0,
            "expensesCents": 0,
            "collectionRate": 0,
            "noiMarginPct": null,
            "opexRatioPct": null,
            "occupancyRate": 0.8333
          },
          {
            "periodStart": "2023-01-01",
            "periodEnd": "2023-12-31",
            "label": "2023",
            "noiCents": 0,
            "collectedIncomeCents": 0,
            "expensesCents": 0,
            "collectionRate": 0,
            "noiMarginPct": null,
            "opexRatioPct": null,
            "occupancyRate": 0.9167
          },
          {
            "periodStart": "2024-01-01",
            "periodEnd": "2024-12-31",
            "label": "2024",
            "noiCents": 11664800,
            "collectedIncomeCents": 19000800,
            "expensesCents": 7336000,
            "collectionRate": 1,
            "noiMarginPct": 0.6139,
            "opexRatioPct": 0.3861,
            "occupancyRate": 0.9167
          },
          {
            "periodStart": "2025-01-01",
            "periodEnd": "2025-12-31",
            "label": "2025",
            "noiCents": 12152000,
            "collectedIncomeCents": 19488000,
            "expensesCents": 7336000,
            "collectionRate": 1,
            "noiMarginPct": 0.6236,
            "opexRatioPct": 0.3764,
            "occupancyRate": 0.9167
          },
          {
            "periodStart": "2026-01-01",
            "periodEnd": "2026-09-08",
            "label": "2026",
            "noiCents": 0,
            "collectedIncomeCents": 0,
            "expensesCents": 0,
            "collectionRate": 0,
            "noiMarginPct": null,
            "opexRatioPct": null,
            "occupancyRate": 0.8333
          }
        ],
        "earliestDate": "2017-01-01"
      }
    },
    "/buildings/demo-building/renovation-opportunities": {
      "data": [
        {
          "assetId": "6c634239-94ee-4688-b976-03d81ce89ec2",
          "assetName": "Insulated windows (PVC/wood)",
          "applianceName": "Insulated windows (PVC/wood)",
          "assetType": "FIXTURE",
          "topic": "WINDOW_INSULATED_PLASTIC_WOOD",
          "installedAt": "1999-09-08T00:00:00.000Z",
          "ageMonths": 324,
          "usefulLifeMonths": 300,
          "depreciationPct": 100,
          "residualPct": 0,
          "remainingLifeMonths": 0,
          "cumulativeRepairCostChf": 0,
          "estimatedReplacementCostChf": 1100,
          "replacementCostConfidence": 0.6,
          "repairToReplacementRatio": 0,
          "annualRepairRate": 0,
          "breakEvenMonths": null,
          "warrantyOffsetMonths": 24,
          "recommendation": "REPLACE",
          "recommendationReason": "Asset has reached end of useful life.",
          "lastConditionStatus": null,
          "lastConditionAt": null,
          "lastConditionReportType": null,
          "lastConditionValidated": false,
          "currentLease": {
            "tenantName": "DA SILVA Marco",
            "netRentChf": 2477,
            "endDate": null,
            "remainingMonths": null
          },
          "unitId": "demo-unit-0003",
          "unitNumber": "0003"
        },
        {
          "assetId": "dada94b5-2ae5-4989-8868-fccf5373a595",
          "assetName": "Parquet flooring (mosaic)",
          "applianceName": "Parquet flooring (mosaic)",
          "assetType": "FINISH",
          "topic": "PARQUET_MOSAIC",
          "installedAt": "1983-07-08T00:00:00.000Z",
          "ageMonths": 518,
          "usefulLifeMonths": 480,
          "depreciationPct": 100,
          "residualPct": 0,
          "remainingLifeMonths": 0,
          "cumulativeRepairCostChf": 0,
          "estimatedReplacementCostChf": 3500,
          "replacementCostConfidence": 0.6,
          "repairToReplacementRatio": 0,
          "annualRepairRate": 0,
          "breakEvenMonths": null,
          "warrantyOffsetMonths": 24,
          "recommendation": "REPLACE",
          "recommendationReason": "Asset has reached end of useful life.",
          "lastConditionStatus": null,
          "lastConditionAt": null,
          "lastConditionReportType": null,
          "lastConditionValidated": false,
          "currentLease": {
            "tenantName": "NGUYEN Thi Lan",
            "netRentChf": 2555,
            "endDate": null,
            "remainingMonths": null
          },
          "unitId": "demo-unit-0005",
          "unitNumber": "0005"
        },
        {
          "assetId": "a40eef84-b8e4-44a9-957e-fa408f9da8de",
          "assetName": "Kitchen cabinets (chipboard)",
          "applianceName": "Kitchen cabinets (chipboard)",
          "assetType": "FIXTURE",
          "topic": "KITCHEN_CABINET_CHIPBOARD",
          "installedAt": "2010-07-08T00:00:00.000Z",
          "ageMonths": 194,
          "usefulLifeMonths": 180,
          "depreciationPct": 100,
          "residualPct": 0,
          "remainingLifeMonths": 0,
          "cumulativeRepairCostChf": 0,
          "estimatedReplacementCostChf": 4500,
          "replacementCostConfidence": 0.6,
          "repairToReplacementRatio": 0,
          "annualRepairRate": 0,
          "breakEvenMonths": null,
          "warrantyOffsetMonths": 24,
          "recommendation": "REPLACE",
          "recommendationReason": "Asset has reached end of useful life.",
          "lastConditionStatus": "DAMAGED",
          "lastConditionAt": "2025-09-08T00:00:00.000Z",
          "lastConditionReportType": "MOVE_OUT",
          "lastConditionValidated": true,
          "currentLease": null,
          "unitId": "demo-unit-0008",
          "unitNumber": "0008"
        },
        {
          "assetId": "50d1b281-b019-4f7e-bdaf-294af8355edc",
          "assetName": "Kitchen cabinets (chipboard)",
          "applianceName": "Kitchen cabinets (chipboard)",
          "assetType": "FIXTURE",
          "topic": "KITCHEN_CABINET_CHIPBOARD",
          "installedAt": "2013-01-08T00:00:00.000Z",
          "ageMonths": 164,
          "usefulLifeMonths": 180,
          "depreciationPct": 91,
          "residualPct": 9,
          "remainingLifeMonths": 16,
          "cumulativeRepairCostChf": 0,
          "estimatedReplacementCostChf": 4500,
          "replacementCostConfidence": 0.6,
          "repairToReplacementRatio": 0,
          "annualRepairRate": 0,
          "breakEvenMonths": null,
          "warrantyOffsetMonths": 24,
          "recommendation": "PLAN_REPLACEMENT",
          "recommendationReason": "Asset is 91% depreciated — nearing end of life.",
          "lastConditionStatus": null,
          "lastConditionAt": null,
          "lastConditionReportType": null,
          "lastConditionValidated": false,
          "currentLease": {
            "tenantName": "DA SILVA Marco",
            "netRentChf": 2477,
            "endDate": null,
            "remainingMonths": null
          },
          "unitId": "demo-unit-0003",
          "unitNumber": "0003"
        },
        {
          "assetId": "45ed30a9-f059-4cb0-9e2f-bfad84b311f9",
          "assetName": "Interior doors (chipboard)",
          "applianceName": "Interior doors (chipboard)",
          "assetType": "FIXTURE",
          "topic": "DOOR_CHIPBOARD",
          "installedAt": "2003-12-08T00:00:00.000Z",
          "ageMonths": 273,
          "usefulLifeMonths": 300,
          "depreciationPct": 91,
          "residualPct": 9,
          "remainingLifeMonths": 27,
          "cumulativeRepairCostChf": 0,
          "estimatedReplacementCostChf": 450,
          "replacementCostConfidence": 0.6,
          "repairToReplacementRatio": 0,
          "annualRepairRate": 0,
          "breakEvenMonths": null,
          "warrantyOffsetMonths": 24,
          "recommendation": "PLAN_REPLACEMENT",
          "recommendationReason": "Asset is 91% depreciated — nearing end of life.",
          "lastConditionStatus": null,
          "lastConditionAt": null,
          "lastConditionReportType": null,
          "lastConditionValidated": false,
          "currentLease": {
            "tenantName": "ROSSI Giulia",
            "netRentChf": 1648,
            "endDate": null,
            "remainingMonths": null
          },
          "unitId": "demo-unit-0006",
          "unitNumber": "0006"
        },
        {
          "assetId": "9850ddb9-679f-44dc-9ac3-c696192ab7f2",
          "assetName": "Roller shutters (plastic)",
          "applianceName": "Roller shutters (plastic)",
          "assetType": "FIXTURE",
          "topic": "ROLLER_SHUTTER_PLASTIC",
          "installedAt": "2008-07-08T00:00:00.000Z",
          "ageMonths": 218,
          "usefulLifeMonths": 240,
          "depreciationPct": 91,
          "residualPct": 9,
          "remainingLifeMonths": 22,
          "cumulativeRepairCostChf": 0,
          "estimatedReplacementCostChf": 550,
          "replacementCostConfidence": 0.6,
          "repairToReplacementRatio": 0,
          "annualRepairRate": 0,
          "breakEvenMonths": null,
          "warrantyOffsetMonths": 24,
          "recommendation": "PLAN_REPLACEMENT",
          "recommendationReason": "Asset is 91% depreciated — nearing end of life.",
          "lastConditionStatus": null,
          "lastConditionAt": null,
          "lastConditionReportType": null,
          "lastConditionValidated": false,
          "currentLease": {
            "tenantName": "ROSSI Giulia",
            "netRentChf": 1648,
            "endDate": null,
            "remainingMonths": null
          },
          "unitId": "demo-unit-0006",
          "unitNumber": "0006"
        },
        {
          "assetId": "0581e949-581f-4a4a-ae0c-f7da89f0de3f",
          "assetName": "Power sockets",
          "applianceName": "Power sockets",
          "assetType": "SYSTEM",
          "topic": "POWER_SOCKET",
          "installedAt": "2013-01-08T00:00:00.000Z",
          "ageMonths": 164,
          "usefulLifeMonths": 180,
          "depreciationPct": 91,
          "residualPct": 9,
          "remainingLifeMonths": 16,
          "cumulativeRepairCostChf": 0,
          "estimatedReplacementCostChf": 130,
          "replacementCostConfidence": 0.6,
          "repairToReplacementRatio": 0,
          "annualRepairRate": 0,
          "breakEvenMonths": null,
          "warrantyOffsetMonths": 24,
          "recommendation": "PLAN_REPLACEMENT",
          "recommendationReason": "Asset is 91% depreciated — nearing end of life.",
          "lastConditionStatus": null,
          "lastConditionAt": null,
          "lastConditionReportType": null,
          "lastConditionValidated": false,
          "currentLease": null,
          "unitId": "demo-unit-0008",
          "unitNumber": "0008"
        },
        {
          "assetId": "dc4ce34d-f394-4d4d-b771-a7b0baafca8d",
          "assetName": "Kitchen tap",
          "applianceName": "Kitchen tap",
          "assetType": "FIXTURE",
          "topic": "KITCHEN_TAP",
          "installedAt": "2008-11-08T00:00:00.000Z",
          "ageMonths": 214,
          "usefulLifeMonths": 240,
          "depreciationPct": 89,
          "residualPct": 11,
          "remainingLifeMonths": 26,
          "cumulativeRepairCostChf": 0,
          "estimatedReplacementCostChf": 400,
          "replacementCostConfidence": 0.6,
          "repairToReplacementRatio": 0,
          "annualRepairRate": 0,
          "breakEvenMonths": null,
          "warrantyOffsetMonths": 24,
          "recommendation": "PLAN_REPLACEMENT",
          "recommendationReason": "Asset is 89% depreciated — nearing end of life.",
          "lastConditionStatus": null,
          "lastConditionAt": null,
          "lastConditionReportType": null,
          "lastConditionValidated": false,
          "currentLease": {
            "tenantName": "MARCHAND Sylvie",
            "netRentChf": 1931,
            "endDate": null,
            "remainingMonths": null
          },
          "unitId": "demo-unit-0001",
          "unitNumber": "0001"
        },
        {
          "assetId": "61216168-5e7e-431e-8cc7-3ba4d3b80073",
          "assetName": "Power sockets",
          "applianceName": "Power sockets",
          "assetType": "SYSTEM",
          "topic": "POWER_SOCKET",
          "installedAt": "2013-05-08T00:00:00.000Z",
          "ageMonths": 160,
          "usefulLifeMonths": 180,
          "depreciationPct": 89,
          "residualPct": 11,
          "remainingLifeMonths": 20,
          "cumulativeRepairCostChf": 0,
          "estimatedReplacementCostChf": 130,
          "replacementCostConfidence": 0.6,
          "repairToReplacementRatio": 0,
          "annualRepairRate": 0,
          "breakEvenMonths": null,
          "warrantyOffsetMonths": 24,
          "recommendation": "PLAN_REPLACEMENT",
          "recommendationReason": "Asset is 89% depreciated — nearing end of life.",
          "lastConditionStatus": null,
          "lastConditionAt": null,
          "lastConditionReportType": null,
          "lastConditionValidated": false,
          "currentLease": {
            "tenantName": "BRUNNER Thomas",
            "netRentChf": 1570,
            "endDate": null,
            "remainingMonths": null
          },
          "unitId": "demo-unit-0002",
          "unitNumber": "0002"
        },
        {
          "assetId": "91b041f9-cd2c-408a-a929-94a53c03f89f",
          "assetName": "Bathroom tap",
          "applianceName": "Bathroom tap",
          "assetType": "FIXTURE",
          "topic": "BATHROOM_TAP",
          "installedAt": "2008-11-08T00:00:00.000Z",
          "ageMonths": 214,
          "usefulLifeMonths": 240,
          "depreciationPct": 89,
          "residualPct": 11,
          "remainingLifeMonths": 26,
          "cumulativeRepairCostChf": 0,
          "estimatedReplacementCostChf": 400,
          "replacementCostConfidence": 0.6,
          "repairToReplacementRatio": 0,
          "annualRepairRate": 0,
          "breakEvenMonths": null,
          "warrantyOffsetMonths": 24,
          "recommendation": "PLAN_REPLACEMENT",
          "recommendationReason": "Asset is 89% depreciated — nearing end of life.",
          "lastConditionStatus": null,
          "lastConditionAt": null,
          "lastConditionReportType": null,
          "lastConditionValidated": false,
          "currentLease": {
            "tenantName": "NGUYEN Thi Lan",
            "netRentChf": 2555,
            "endDate": null,
            "remainingMonths": null
          },
          "unitId": "demo-unit-0005",
          "unitNumber": "0005"
        },
        {
          "assetId": "c7cf90f2-0c6c-43d9-9b62-02ee6049b2e0",
          "assetName": "Kitchen worktop (synthetic)",
          "applianceName": "Kitchen worktop (synthetic)",
          "assetType": "FIXTURE",
          "topic": "COUNTERTOP_SYNTHETIC",
          "installedAt": "2013-10-08T00:00:00.000Z",
          "ageMonths": 155,
          "usefulLifeMonths": 180,
          "depreciationPct": 86,
          "residualPct": 14,
          "remainingLifeMonths": 25,
          "cumulativeRepairCostChf": 0,
          "estimatedReplacementCostChf": 1200,
          "replacementCostConfidence": 0.6,
          "repairToReplacementRatio": 0,
          "annualRepairRate": 0,
          "breakEvenMonths": null,
          "warrantyOffsetMonths": 24,
          "recommendation": "PLAN_REPLACEMENT",
          "recommendationReason": "Asset is 86% depreciated — nearing end of life.",
          "lastConditionStatus": null,
          "lastConditionAt": null,
          "lastConditionReportType": null,
          "lastConditionValidated": false,
          "currentLease": {
            "tenantName": "BRUNNER Thomas",
            "netRentChf": 1570,
            "endDate": null,
            "remainingMonths": null
          },
          "unitId": "demo-unit-0002",
          "unitNumber": "0002"
        },
        {
          "assetId": "bac575dc-2bff-432a-8f72-535b77cccadc",
          "assetName": "Bathroom tap",
          "applianceName": "Bathroom tap",
          "assetType": "FIXTURE",
          "topic": "BATHROOM_TAP",
          "installedAt": "2009-07-08T00:00:00.000Z",
          "ageMonths": 206,
          "usefulLifeMonths": 240,
          "depreciationPct": 86,
          "residualPct": 14,
          "remainingLifeMonths": 34,
          "cumulativeRepairCostChf": 0,
          "estimatedReplacementCostChf": 400,
          "replacementCostConfidence": 0.6,
          "repairToReplacementRatio": 0,
          "annualRepairRate": 0,
          "breakEvenMonths": null,
          "warrantyOffsetMonths": 24,
          "recommendation": "PLAN_REPLACEMENT",
          "recommendationReason": "Asset is 86% depreciated — nearing end of life.",
          "lastConditionStatus": null,
          "lastConditionAt": null,
          "lastConditionReportType": null,
          "lastConditionValidated": false,
          "currentLease": {
            "tenantName": "DA SILVA Marco",
            "netRentChf": 2477,
            "endDate": null,
            "remainingMonths": null
          },
          "unitId": "demo-unit-0003",
          "unitNumber": "0003"
        },
        {
          "assetId": "02c95df5-f3c1-4072-b96a-6bcbcd0dc684",
          "assetName": "Roller shutters (plastic)",
          "applianceName": "Roller shutters (plastic)",
          "assetType": "FIXTURE",
          "topic": "ROLLER_SHUTTER_PLASTIC",
          "installedAt": "2009-07-08T00:00:00.000Z",
          "ageMonths": 206,
          "usefulLifeMonths": 240,
          "depreciationPct": 86,
          "residualPct": 14,
          "remainingLifeMonths": 34,
          "cumulativeRepairCostChf": 0,
          "estimatedReplacementCostChf": 550,
          "replacementCostConfidence": 0.6,
          "repairToReplacementRatio": 0,
          "annualRepairRate": 0,
          "breakEvenMonths": null,
          "warrantyOffsetMonths": 24,
          "recommendation": "PLAN_REPLACEMENT",
          "recommendationReason": "Asset is 86% depreciated — nearing end of life.",
          "lastConditionStatus": null,
          "lastConditionAt": null,
          "lastConditionReportType": null,
          "lastConditionValidated": false,
          "currentLease": {
            "tenantName": "KELLER Andrea",
            "netRentChf": 1999,
            "endDate": null,
            "remainingMonths": null
          },
          "unitId": "demo-unit-0004",
          "unitNumber": "0004"
        },
        {
          "assetId": "55f097f4-fcc6-4ca4-a643-58e2bb025b00",
          "assetName": "Wall paint (dispersion)",
          "applianceName": "Wall paint (dispersion)",
          "assetType": "FINISH",
          "topic": "PAINT_WALLS_DISPERSION",
          "installedAt": "2019-10-08T00:00:00.000Z",
          "ageMonths": 83,
          "usefulLifeMonths": 96,
          "depreciationPct": 86,
          "residualPct": 14,
          "remainingLifeMonths": 13,
          "cumulativeRepairCostChf": 0,
          "estimatedReplacementCostChf": 2200,
          "replacementCostConfidence": 0.6,
          "repairToReplacementRatio": 0,
          "annualRepairRate": 0,
          "breakEvenMonths": null,
          "warrantyOffsetMonths": 24,
          "recommendation": "PLAN_REPLACEMENT",
          "recommendationReason": "Asset is 86% depreciated — nearing end of life.",
          "lastConditionStatus": null,
          "lastConditionAt": null,
          "lastConditionReportType": null,
          "lastConditionValidated": false,
          "currentLease": {
            "tenantName": "KELLER Andrea",
            "netRentChf": 1999,
            "endDate": null,
            "remainingMonths": null
          },
          "unitId": "demo-unit-0004",
          "unitNumber": "0004"
        },
        {
          "assetId": "ac41b933-be89-48e0-82a3-ee702f81d509",
          "assetName": "Light switches",
          "applianceName": "Light switches",
          "assetType": "SYSTEM",
          "topic": "SWITCH",
          "installedAt": "2013-10-08T00:00:00.000Z",
          "ageMonths": 155,
          "usefulLifeMonths": 180,
          "depreciationPct": 86,
          "residualPct": 14,
          "remainingLifeMonths": 25,
          "cumulativeRepairCostChf": 0,
          "estimatedReplacementCostChf": 70,
          "replacementCostConfidence": 0.6,
          "repairToReplacementRatio": 0,
          "annualRepairRate": 0,
          "breakEvenMonths": null,
          "warrantyOffsetMonths": 24,
          "recommendation": "PLAN_REPLACEMENT",
          "recommendationReason": "Asset is 86% depreciated — nearing end of life.",
          "lastConditionStatus": null,
          "lastConditionAt": null,
          "lastConditionReportType": null,
          "lastConditionValidated": false,
          "currentLease": {
            "tenantName": "NGUYEN Thi Lan",
            "netRentChf": 2555,
            "endDate": null,
            "remainingMonths": null
          },
          "unitId": "demo-unit-0005",
          "unitNumber": "0005"
        },
        {
          "assetId": "58733997-0f0a-43e6-96e0-493710dfc4ba",
          "assetName": "Sanitary ceramics (WC/basin)",
          "applianceName": "Sanitary ceramics (WC/basin)",
          "assetType": "FIXTURE",
          "topic": "SANITARY_CERAMIC",
          "installedAt": "1996-08-08T00:00:00.000Z",
          "ageMonths": 361,
          "usefulLifeMonths": 420,
          "depreciationPct": 86,
          "residualPct": 14,
          "remainingLifeMonths": 59,
          "cumulativeRepairCostChf": 0,
          "estimatedReplacementCostChf": 1200,
          "replacementCostConfidence": 0.6,
          "repairToReplacementRatio": 0,
          "annualRepairRate": 0,
          "breakEvenMonths": null,
          "warrantyOffsetMonths": 24,
          "recommendation": "PLAN_REPLACEMENT",
          "recommendationReason": "Asset is 86% depreciated — nearing end of life.",
          "lastConditionStatus": null,
          "lastConditionAt": null,
          "lastConditionReportType": null,
          "lastConditionValidated": false,
          "currentLease": {
            "tenantName": "FAVRE Olivier",
            "netRentChf": 1960,
            "endDate": null,
            "remainingMonths": null
          },
          "unitId": "demo-unit-0007",
          "unitNumber": "0007"
        },
        {
          "assetId": "ca58ae14-5da2-4143-ac28-6facf4dd5e0f",
          "assetName": "Balcony railing (metal)",
          "applianceName": "Balcony railing (metal)",
          "assetType": "FIXTURE",
          "topic": "BALCONY_RAILING_METAL",
          "installedAt": "2000-11-08T00:00:00.000Z",
          "ageMonths": 310,
          "usefulLifeMonths": 360,
          "depreciationPct": 86,
          "residualPct": 14,
          "remainingLifeMonths": 50,
          "cumulativeRepairCostChf": 0,
          "estimatedReplacementCostChf": 800,
          "replacementCostConfidence": 0.6,
          "repairToReplacementRatio": 0,
          "annualRepairRate": 0,
          "breakEvenMonths": null,
          "warrantyOffsetMonths": 24,
          "recommendation": "PLAN_REPLACEMENT",
          "recommendationReason": "Asset is 86% depreciated — nearing end of life.",
          "lastConditionStatus": null,
          "lastConditionAt": null,
          "lastConditionReportType": null,
          "lastConditionValidated": false,
          "currentLease": null,
          "unitId": "demo-unit-0008",
          "unitNumber": "0008"
        },
        {
          "assetId": "2e9fbb78-1b17-42cb-b283-1c49f74dfb1a",
          "assetName": "Bathroom tiles (ceramic)",
          "applianceName": "Bathroom tiles (ceramic)",
          "assetType": "FINISH",
          "topic": "BATHROOM_TILES_CERAMIC",
          "installedAt": "2000-11-08T00:00:00.000Z",
          "ageMonths": 310,
          "usefulLifeMonths": 360,
          "depreciationPct": 86,
          "residualPct": 14,
          "remainingLifeMonths": 50,
          "cumulativeRepairCostChf": 0,
          "estimatedReplacementCostChf": 2200,
          "replacementCostConfidence": 0.6,
          "repairToReplacementRatio": 0,
          "annualRepairRate": 0,
          "breakEvenMonths": null,
          "warrantyOffsetMonths": 24,
          "recommendation": "PLAN_REPLACEMENT",
          "recommendationReason": "Asset is 86% depreciated — nearing end of life.",
          "lastConditionStatus": null,
          "lastConditionAt": null,
          "lastConditionReportType": null,
          "lastConditionValidated": false,
          "currentLease": null,
          "unitId": "demo-unit-0008",
          "unitNumber": "0008"
        },
        {
          "assetId": "e29c9d98-9f30-4e86-bfa0-38595f75afe3",
          "assetName": "Wall paint (dispersion)",
          "applianceName": "Wall paint (dispersion)",
          "assetType": "FINISH",
          "topic": "PAINT_WALLS_DISPERSION",
          "installedAt": "2019-06-08T00:00:00.000Z",
          "ageMonths": 87,
          "usefulLifeMonths": 96,
          "depreciationPct": 91,
          "residualPct": 9,
          "remainingLifeMonths": 9,
          "cumulativeRepairCostChf": 0,
          "estimatedReplacementCostChf": 2200,
          "replacementCostConfidence": 0.6,
          "repairToReplacementRatio": 0,
          "annualRepairRate": 0,
          "breakEvenMonths": null,
          "warrantyOffsetMonths": 24,
          "recommendation": "MONITOR",
          "recommendationReason": "Asset is 91% depreciated — nearing end of life. Last inspection rated GOOD — replacement may be deferred despite age.",
          "lastConditionStatus": "GOOD",
          "lastConditionAt": "2024-09-08T00:00:00.000Z",
          "lastConditionReportType": "MOVE_IN",
          "lastConditionValidated": true,
          "currentLease": {
            "tenantName": "ROSSI Giulia",
            "netRentChf": 1648,
            "endDate": null,
            "remainingMonths": null
          },
          "unitId": "demo-unit-0006",
          "unitNumber": "0006"
        },
        {
          "assetId": "cdcd4dd1-604c-4dce-a25d-fd25c2cb8c0e",
          "assetName": "Kitchen worktop (synthetic)",
          "applianceName": "Kitchen worktop (synthetic)",
          "assetType": "FIXTURE",
          "topic": "COUNTERTOP_SYNTHETIC",
          "installedAt": "2014-04-08T00:00:00.000Z",
          "ageMonths": 149,
          "usefulLifeMonths": 180,
          "depreciationPct": 83,
          "residualPct": 17,
          "remainingLifeMonths": 31,
          "cumulativeRepairCostChf": 0,
          "estimatedReplacementCostChf": 1200,
          "replacementCostConfidence": 0.6,
          "repairToReplacementRatio": 0,
          "annualRepairRate": 0,
          "breakEvenMonths": null,
          "warrantyOffsetMonths": 24,
          "recommendation": "MONITOR",
          "recommendationReason": "Asset is 83% depreciated — monitor for increasing repair frequency.",
          "lastConditionStatus": null,
          "lastConditionAt": null,
          "lastConditionReportType": null,
          "lastConditionValidated": false,
          "currentLease": {
            "tenantName": "MARCHAND Sylvie",
            "netRentChf": 1931,
            "endDate": null,
            "remainingMonths": null
          },
          "unitId": "demo-unit-0001",
          "unitNumber": "0001"
        },
        {
          "assetId": "dc7ed960-a649-4727-9652-c847277e5cff",
          "assetName": "Insulated windows (PVC/wood)",
          "applianceName": "Insulated windows (PVC/wood)",
          "assetType": "FIXTURE",
          "topic": "WINDOW_INSULATED_PLASTIC_WOOD",
          "installedAt": "2005-12-08T00:00:00.000Z",
          "ageMonths": 249,
          "usefulLifeMonths": 300,
          "depreciationPct": 83,
          "residualPct": 17,
          "remainingLifeMonths": 51,
          "cumulativeRepairCostChf": 0,
          "estimatedReplacementCostChf": 1100,
          "replacementCostConfidence": 0.6,
          "repairToReplacementRatio": 0,
          "annualRepairRate": 0,
          "breakEvenMonths": null,
          "warrantyOffsetMonths": 24,
          "recommendation": "MONITOR",
          "recommendationReason": "Asset is 83% depreciated — monitor for increasing repair frequency.",
          "lastConditionStatus": null,
          "lastConditionAt": null,
          "lastConditionReportType": null,
          "lastConditionValidated": false,
          "currentLease": {
            "tenantName": "MARCHAND Sylvie",
            "netRentChf": 1931,
            "endDate": null,
            "remainingMonths": null
          },
          "unitId": "demo-unit-0001",
          "unitNumber": "0001"
        },
        {
          "assetId": "9a85dc6c-88c1-4fbe-bf56-603a60abf0a7",
          "assetName": "Bathtub (acrylic)",
          "applianceName": "Bathtub (acrylic)",
          "assetType": "FIXTURE",
          "topic": "BATHTUB_ACRYLIC",
          "installedAt": "2005-12-08T00:00:00.000Z",
          "ageMonths": 249,
          "usefulLifeMonths": 300,
          "depreciationPct": 83,
          "residualPct": 17,
          "remainingLifeMonths": 51,
          "cumulativeRepairCostChf": 0,
          "estimatedReplacementCostChf": 900,
          "replacementCostConfidence": 0.6,
          "repairToReplacementRatio": 0,
          "annualRepairRate": 0,
          "breakEvenMonths": null,
          "warrantyOffsetMonths": 24,
          "recommendation": "MONITOR",
          "recommendationReason": "Asset is 83% depreciated — monitor for increasing repair frequency.",
          "lastConditionStatus": null,
          "lastConditionAt": null,
          "lastConditionReportType": null,
          "lastConditionValidated": false,
          "currentLease": {
            "tenantName": "BRUNNER Thomas",
            "netRentChf": 1570,
            "endDate": null,
            "remainingMonths": null
          },
          "unitId": "demo-unit-0002",
          "unitNumber": "0002"
        },
        {
          "assetId": "41d16db4-e57d-40a5-b27b-eec76be78f29",
          "assetName": "Roller shutters (plastic)",
          "applianceName": "Roller shutters (plastic)",
          "assetType": "FIXTURE",
          "topic": "ROLLER_SHUTTER_PLASTIC",
          "installedAt": "2010-02-08T00:00:00.000Z",
          "ageMonths": 199,
          "usefulLifeMonths": 240,
          "depreciationPct": 83,
          "residualPct": 17,
          "remainingLifeMonths": 41,
          "cumulativeRepairCostChf": 0,
          "estimatedReplacementCostChf": 550,
          "replacementCostConfidence": 0.6,
          "repairToReplacementRatio": 0,
          "annualRepairRate": 0,
          "breakEvenMonths": null,
          "warrantyOffsetMonths": 24,
          "recommendation": "MONITOR",
          "recommendationReason": "Asset is 83% depreciated — monitor for increasing repair frequency.",
          "lastConditionStatus": null,
          "lastConditionAt": null,
          "lastConditionReportType": null,
          "lastConditionValidated": false,
          "currentLease": {
            "tenantName": "DA SILVA Marco",
            "netRentChf": 2477,
            "endDate": null,
            "remainingMonths": null
          },
          "unitId": "demo-unit-0003",
          "unitNumber": "0003"
        },
        {
          "assetId": "4731f5fb-707c-4cae-a81f-d497b47e202a",
          "assetName": "Wall paint (dispersion)",
          "applianceName": "Wall paint (dispersion)",
          "assetType": "FINISH",
          "topic": "PAINT_WALLS_DISPERSION",
          "installedAt": "2020-01-08T00:00:00.000Z",
          "ageMonths": 80,
          "usefulLifeMonths": 96,
          "depreciationPct": 83,
          "residualPct": 17,
          "remainingLifeMonths": 16,
          "cumulativeRepairCostChf": 0,
          "estimatedReplacementCostChf": 2200,
          "replacementCostConfidence": 0.6,
          "repairToReplacementRatio": 0,
          "annualRepairRate": 0,
          "breakEvenMonths": null,
          "warrantyOffsetMonths": 24,
          "recommendation": "MONITOR",
          "recommendationReason": "Asset is 83% depreciated — monitor for increasing repair frequency.",
          "lastConditionStatus": null,
          "lastConditionAt": null,
          "lastConditionReportType": null,
          "lastConditionValidated": false,
          "currentLease": {
            "tenantName": "DA SILVA Marco",
            "netRentChf": 2477,
            "endDate": null,
            "remainingMonths": null
          },
          "unitId": "demo-unit-0003",
          "unitNumber": "0003"
        },
        {
          "assetId": "33e4f919-5713-41cf-a138-ce49e9977bf2",
          "assetName": "Power sockets",
          "applianceName": "Power sockets",
          "assetType": "SYSTEM",
          "topic": "POWER_SOCKET",
          "installedAt": "2014-04-08T00:00:00.000Z",
          "ageMonths": 149,
          "usefulLifeMonths": 180,
          "depreciationPct": 83,
          "residualPct": 17,
          "remainingLifeMonths": 31,
          "cumulativeRepairCostChf": 0,
          "estimatedReplacementCostChf": 130,
          "replacementCostConfidence": 0.6,
          "repairToReplacementRatio": 0,
          "annualRepairRate": 0,
          "breakEvenMonths": null,
          "warrantyOffsetMonths": 24,
          "recommendation": "MONITOR",
          "recommendationReason": "Asset is 83% depreciated — monitor for increasing repair frequency.",
          "lastConditionStatus": null,
          "lastConditionAt": null,
          "lastConditionReportType": null,
          "lastConditionValidated": false,
          "currentLease": {
            "tenantName": "DA SILVA Marco",
            "netRentChf": 2477,
            "endDate": null,
            "remainingMonths": null
          },
          "unitId": "demo-unit-0003",
          "unitNumber": "0003"
        },
        {
          "assetId": "87fa03d4-bcde-4366-8042-93d7435bbe1d",
          "assetName": "Bathroom tap",
          "applianceName": "Bathroom tap",
          "assetType": "FIXTURE",
          "topic": "BATHROOM_TAP",
          "installedAt": "2010-02-08T00:00:00.000Z",
          "ageMonths": 199,
          "usefulLifeMonths": 240,
          "depreciationPct": 83,
          "residualPct": 17,
          "remainingLifeMonths": 41,
          "cumulativeRepairCostChf": 0,
          "estimatedReplacementCostChf": 400,
          "replacementCostConfidence": 0.6,
          "repairToReplacementRatio": 0,
          "annualRepairRate": 0,
          "breakEvenMonths": null,
          "warrantyOffsetMonths": 24,
          "recommendation": "MONITOR",
          "recommendationReason": "Asset is 83% depreciated — monitor for increasing repair frequency.",
          "lastConditionStatus": null,
          "lastConditionAt": null,
          "lastConditionReportType": null,
          "lastConditionValidated": false,
          "currentLease": {
            "tenantName": "ROSSI Giulia",
            "netRentChf": 1648,
            "endDate": null,
            "remainingMonths": null
          },
          "unitId": "demo-unit-0006",
          "unitNumber": "0006"
        },
        {
          "assetId": "5deed3d2-85f9-4338-89ed-c47dbefce005",
          "assetName": "Bathtub (acrylic)",
          "applianceName": "Bathtub (acrylic)",
          "assetType": "FIXTURE",
          "topic": "BATHTUB_ACRYLIC",
          "installedAt": "2005-12-08T00:00:00.000Z",
          "ageMonths": 249,
          "usefulLifeMonths": 300,
          "depreciationPct": 83,
          "residualPct": 17,
          "remainingLifeMonths": 51,
          "cumulativeRepairCostChf": 0,
          "estimatedReplacementCostChf": 900,
          "replacementCostConfidence": 0.6,
          "repairToReplacementRatio": 0,
          "annualRepairRate": 0,
          "breakEvenMonths": null,
          "warrantyOffsetMonths": 24,
          "recommendation": "MONITOR",
          "recommendationReason": "Asset is 83% depreciated — monitor for increasing repair frequency.",
          "lastConditionStatus": null,
          "lastConditionAt": null,
          "lastConditionReportType": null,
          "lastConditionValidated": false,
          "currentLease": {
            "tenantName": "ROSSI Giulia",
            "netRentChf": 1648,
            "endDate": null,
            "remainingMonths": null
          },
          "unitId": "demo-unit-0006",
          "unitNumber": "0006"
        },
        {
          "assetId": "e4275079-9010-446e-91dd-f7a61e8157fb",
          "assetName": "Kitchen tap",
          "applianceName": "Kitchen tap",
          "assetType": "FIXTURE",
          "topic": "KITCHEN_TAP",
          "installedAt": "2010-02-08T00:00:00.000Z",
          "ageMonths": 199,
          "usefulLifeMonths": 240,
          "depreciationPct": 83,
          "residualPct": 17,
          "remainingLifeMonths": 41,
          "cumulativeRepairCostChf": 0,
          "estimatedReplacementCostChf": 400,
          "replacementCostConfidence": 0.6,
          "repairToReplacementRatio": 0,
          "annualRepairRate": 0,
          "breakEvenMonths": null,
          "warrantyOffsetMonths": 24,
          "recommendation": "MONITOR",
          "recommendationReason": "Asset is 83% depreciated — monitor for increasing repair frequency.",
          "lastConditionStatus": null,
          "lastConditionAt": null,
          "lastConditionReportType": null,
          "lastConditionValidated": false,
          "currentLease": {
            "tenantName": "ROSSI Giulia",
            "netRentChf": 1648,
            "endDate": null,
            "remainingMonths": null
          },
          "unitId": "demo-unit-0006",
          "unitNumber": "0006"
        },
        {
          "assetId": "b6111e02-6a28-4a94-bbfa-227b79f1e24a",
          "assetName": "Light switches",
          "applianceName": "Light switches",
          "assetType": "SYSTEM",
          "topic": "SWITCH",
          "installedAt": "2014-04-08T00:00:00.000Z",
          "ageMonths": 149,
          "usefulLifeMonths": 180,
          "depreciationPct": 83,
          "residualPct": 17,
          "remainingLifeMonths": 31,
          "cumulativeRepairCostChf": 0,
          "estimatedReplacementCostChf": 70,
          "replacementCostConfidence": 0.6,
          "repairToReplacementRatio": 0,
          "annualRepairRate": 0,
          "breakEvenMonths": null,
          "warrantyOffsetMonths": 24,
          "recommendation": "MONITOR",
          "recommendationReason": "Asset is 83% depreciated — monitor for increasing repair frequency.",
          "lastConditionStatus": null,
          "lastConditionAt": null,
          "lastConditionReportType": null,
          "lastConditionValidated": false,
          "currentLease": {
            "tenantName": "ROSSI Giulia",
            "netRentChf": 1648,
            "endDate": null,
            "remainingMonths": null
          },
          "unitId": "demo-unit-0006",
          "unitNumber": "0006"
        },
        {
          "assetId": "f77ae1ad-4ce9-4a8a-8163-02f139db7763",
          "assetName": "Interior doors (chipboard)",
          "applianceName": "Interior doors (chipboard)",
          "assetType": "FIXTURE",
          "topic": "DOOR_CHIPBOARD",
          "installedAt": "2005-12-08T00:00:00.000Z",
          "ageMonths": 249,
          "usefulLifeMonths": 300,
          "depreciationPct": 83,
          "residualPct": 17,
          "remainingLifeMonths": 51,
          "cumulativeRepairCostChf": 0,
          "estimatedReplacementCostChf": 450,
          "replacementCostConfidence": 0.6,
          "repairToReplacementRatio": 0,
          "annualRepairRate": 0,
          "breakEvenMonths": null,
          "warrantyOffsetMonths": 24,
          "recommendation": "MONITOR",
          "recommendationReason": "Asset is 83% depreciated — monitor for increasing repair frequency.",
          "lastConditionStatus": null,
          "lastConditionAt": null,
          "lastConditionReportType": null,
          "lastConditionValidated": false,
          "currentLease": {
            "tenantName": "FAVRE Olivier",
            "netRentChf": 1960,
            "endDate": null,
            "remainingMonths": null
          },
          "unitId": "demo-unit-0007",
          "unitNumber": "0007"
        },
        {
          "assetId": "6d7aaa72-8631-4b77-8bf8-7c7feaccaa85",
          "assetName": "Bathroom tiles (ceramic)",
          "applianceName": "Bathroom tiles (ceramic)",
          "assetType": "FINISH",
          "topic": "BATHROOM_TILES_CERAMIC",
          "installedAt": "2001-10-08T00:00:00.000Z",
          "ageMonths": 299,
          "usefulLifeMonths": 360,
          "depreciationPct": 83,
          "residualPct": 17,
          "remainingLifeMonths": 61,
          "cumulativeRepairCostChf": 0,
          "estimatedReplacementCostChf": 2200,
          "replacementCostConfidence": 0.6,
          "repairToReplacementRatio": 0,
          "annualRepairRate": 0,
          "breakEvenMonths": null,
          "warrantyOffsetMonths": 24,
          "recommendation": "MONITOR",
          "recommendationReason": "Asset is 83% depreciated — monitor for increasing repair frequency.",
          "lastConditionStatus": null,
          "lastConditionAt": null,
          "lastConditionReportType": null,
          "lastConditionValidated": false,
          "currentLease": {
            "tenantName": "FAVRE Olivier",
            "netRentChf": 1960,
            "endDate": null,
            "remainingMonths": null
          },
          "unitId": "demo-unit-0007",
          "unitNumber": "0007"
        },
        {
          "assetId": "96a56bb1-5085-4a5c-9df1-a3af9fb2c26a",
          "assetName": "Balcony (metal)",
          "applianceName": "Balcony (metal)",
          "assetType": "STRUCTURAL",
          "topic": "BALCONY_METAL",
          "installedAt": "1993-07-08T00:00:00.000Z",
          "ageMonths": 398,
          "usefulLifeMonths": 480,
          "depreciationPct": 83,
          "residualPct": 17,
          "remainingLifeMonths": 82,
          "cumulativeRepairCostChf": 0,
          "estimatedReplacementCostChf": 4500,
          "replacementCostConfidence": 0.6,
          "repairToReplacementRatio": 0,
          "annualRepairRate": 0,
          "breakEvenMonths": null,
          "warrantyOffsetMonths": 24,
          "recommendation": "MONITOR",
          "recommendationReason": "Asset is 83% depreciated — monitor for increasing repair frequency.",
          "lastConditionStatus": null,
          "lastConditionAt": null,
          "lastConditionReportType": null,
          "lastConditionValidated": false,
          "currentLease": null,
          "unitId": "demo-unit-0008",
          "unitNumber": "0008"
        },
        {
          "assetId": "347394e1-bdaa-4774-8845-60fd14753ade",
          "assetName": "Kitchen tiles (ceramic)",
          "applianceName": "Kitchen tiles (ceramic)",
          "assetType": "FINISH",
          "topic": "KITCHEN_TILES_CERAMIC",
          "installedAt": "2002-09-08T00:00:00.000Z",
          "ageMonths": 288,
          "usefulLifeMonths": 360,
          "depreciationPct": 80,
          "residualPct": 20,
          "remainingLifeMonths": 72,
          "cumulativeRepairCostChf": 0,
          "estimatedReplacementCostChf": 1600,
          "replacementCostConfidence": 0.6,
          "repairToReplacementRatio": 0,
          "annualRepairRate": 0,
          "breakEvenMonths": null,
          "warrantyOffsetMonths": 24,
          "recommendation": "MONITOR",
          "recommendationReason": "Asset is 80% depreciated — monitor for increasing repair frequency.",
          "lastConditionStatus": null,
          "lastConditionAt": null,
          "lastConditionReportType": null,
          "lastConditionValidated": false,
          "currentLease": {
            "tenantName": "MARCHAND Sylvie",
            "netRentChf": 1931,
            "endDate": null,
            "remainingMonths": null
          },
          "unitId": "demo-unit-0001",
          "unitNumber": "0001"
        },
        {
          "assetId": "f3bbaccd-5ff8-46ac-93ca-4d13471c4786",
          "assetName": "Balcony railing (metal)",
          "applianceName": "Balcony railing (metal)",
          "assetType": "FIXTURE",
          "topic": "BALCONY_RAILING_METAL",
          "installedAt": "2002-09-08T00:00:00.000Z",
          "ageMonths": 288,
          "usefulLifeMonths": 360,
          "depreciationPct": 80,
          "residualPct": 20,
          "remainingLifeMonths": 72,
          "cumulativeRepairCostChf": 0,
          "estimatedReplacementCostChf": 800,
          "replacementCostConfidence": 0.6,
          "repairToReplacementRatio": 0,
          "annualRepairRate": 0,
          "breakEvenMonths": null,
          "warrantyOffsetMonths": 24,
          "recommendation": "MONITOR",
          "recommendationReason": "Asset is 80% depreciated — monitor for increasing repair frequency.",
          "lastConditionStatus": null,
          "lastConditionAt": null,
          "lastConditionReportType": null,
          "lastConditionValidated": false,
          "currentLease": {
            "tenantName": "DA SILVA Marco",
            "netRentChf": 2477,
            "endDate": null,
            "remainingMonths": null
          },
          "unitId": "demo-unit-0003",
          "unitNumber": "0003"
        },
        {
          "assetId": "50d4329b-50c3-48cf-b25f-28f1d397a119",
          "assetName": "Kitchen worktop (synthetic)",
          "applianceName": "Kitchen worktop (synthetic)",
          "assetType": "FIXTURE",
          "topic": "COUNTERTOP_SYNTHETIC",
          "installedAt": "2014-09-08T00:00:00.000Z",
          "ageMonths": 144,
          "usefulLifeMonths": 180,
          "depreciationPct": 80,
          "residualPct": 20,
          "remainingLifeMonths": 36,
          "cumulativeRepairCostChf": 0,
          "estimatedReplacementCostChf": 1200,
          "replacementCostConfidence": 0.6,
          "repairToReplacementRatio": 0,
          "annualRepairRate": 0,
          "breakEvenMonths": null,
          "warrantyOffsetMonths": 24,
          "recommendation": "MONITOR",
          "recommendationReason": "Asset is 80% depreciated — monitor for increasing repair frequency.",
          "lastConditionStatus": null,
          "lastConditionAt": null,
          "lastConditionReportType": null,
          "lastConditionValidated": false,
          "currentLease": {
            "tenantName": "DA SILVA Marco",
            "netRentChf": 2477,
            "endDate": null,
            "remainingMonths": null
          },
          "unitId": "demo-unit-0003",
          "unitNumber": "0003"
        },
        {
          "assetId": "82fe8641-7a63-4de3-a70c-14152b2e9fe7",
          "assetName": "Roller shutters (plastic)",
          "applianceName": "Roller shutters (plastic)",
          "assetType": "FIXTURE",
          "topic": "ROLLER_SHUTTER_PLASTIC",
          "installedAt": "2010-09-08T00:00:00.000Z",
          "ageMonths": 192,
          "usefulLifeMonths": 240,
          "depreciationPct": 80,
          "residualPct": 20,
          "remainingLifeMonths": 48,
          "cumulativeRepairCostChf": 0,
          "estimatedReplacementCostChf": 550,
          "replacementCostConfidence": 0.6,
          "repairToReplacementRatio": 0,
          "annualRepairRate": 0,
          "breakEvenMonths": null,
          "warrantyOffsetMonths": 24,
          "recommendation": "MONITOR",
          "recommendationReason": "Asset is 80% depreciated — monitor for increasing repair frequency.",
          "lastConditionStatus": null,
          "lastConditionAt": null,
          "lastConditionReportType": null,
          "lastConditionValidated": false,
          "currentLease": {
            "tenantName": "FAVRE Olivier",
            "netRentChf": 1960,
            "endDate": null,
            "remainingMonths": null
          },
          "unitId": "demo-unit-0007",
          "unitNumber": "0007"
        },
        {
          "assetId": "29743c70-02ea-40f1-8a8c-f288eefd82f0",
          "assetName": "Wall paint (dispersion)",
          "applianceName": "Wall paint (dispersion)",
          "assetType": "FINISH",
          "topic": "PAINT_WALLS_DISPERSION",
          "installedAt": "2020-04-08T00:00:00.000Z",
          "ageMonths": 77,
          "usefulLifeMonths": 96,
          "depreciationPct": 80,
          "residualPct": 20,
          "remainingLifeMonths": 19,
          "cumulativeRepairCostChf": 0,
          "estimatedReplacementCostChf": 2200,
          "replacementCostConfidence": 0.6,
          "repairToReplacementRatio": 0,
          "annualRepairRate": 0,
          "breakEvenMonths": null,
          "warrantyOffsetMonths": 24,
          "recommendation": "MONITOR",
          "recommendationReason": "Asset is 80% depreciated — monitor for increasing repair frequency.",
          "lastConditionStatus": null,
          "lastConditionAt": null,
          "lastConditionReportType": null,
          "lastConditionValidated": false,
          "currentLease": {
            "tenantName": "FAVRE Olivier",
            "netRentChf": 1960,
            "endDate": null,
            "remainingMonths": null
          },
          "unitId": "demo-unit-0007",
          "unitNumber": "0007"
        },
        {
          "assetId": "597b7d69-524b-44a5-9993-b5888438b8bf",
          "assetName": "Bathroom tap",
          "applianceName": "Bathroom tap",
          "assetType": "FIXTURE",
          "topic": "BATHROOM_TAP",
          "installedAt": "2010-09-08T00:00:00.000Z",
          "ageMonths": 192,
          "usefulLifeMonths": 240,
          "depreciationPct": 80,
          "residualPct": 20,
          "remainingLifeMonths": 48,
          "cumulativeRepairCostChf": 0,
          "estimatedReplacementCostChf": 400,
          "replacementCostConfidence": 0.6,
          "repairToReplacementRatio": 0,
          "annualRepairRate": 0,
          "breakEvenMonths": null,
          "warrantyOffsetMonths": 24,
          "recommendation": "MONITOR",
          "recommendationReason": "Asset is 80% depreciated — monitor for increasing repair frequency.",
          "lastConditionStatus": null,
          "lastConditionAt": null,
          "lastConditionReportType": null,
          "lastConditionValidated": false,
          "currentLease": null,
          "unitId": "demo-unit-0008",
          "unitNumber": "0008"
        },
        {
          "assetId": "f8d26c10-749f-4cf7-8ab7-0fdf66e160e0",
          "assetName": "Balcony (metal)",
          "applianceName": "Balcony (metal)",
          "assetType": "STRUCTURAL",
          "topic": "BALCONY_METAL",
          "installedAt": "1995-07-08T00:00:00.000Z",
          "ageMonths": 374,
          "usefulLifeMonths": 480,
          "depreciationPct": 78,
          "residualPct": 22,
          "remainingLifeMonths": 106,
          "cumulativeRepairCostChf": 0,
          "estimatedReplacementCostChf": 4500,
          "replacementCostConfidence": 0.6,
          "repairToReplacementRatio": 0,
          "annualRepairRate": 0,
          "breakEvenMonths": null,
          "warrantyOffsetMonths": 24,
          "recommendation": "MONITOR",
          "recommendationReason": "Asset is 78% depreciated — monitor for increasing repair frequency.",
          "lastConditionStatus": null,
          "lastConditionAt": null,
          "lastConditionReportType": null,
          "lastConditionValidated": false,
          "currentLease": {
            "tenantName": "MARCHAND Sylvie",
            "netRentChf": 1931,
            "endDate": null,
            "remainingMonths": null
          },
          "unitId": "demo-unit-0001",
          "unitNumber": "0001"
        },
        {
          "assetId": "fed929a9-6bb4-4d5a-8d9d-ffd3faa52618",
          "assetName": "Parquet flooring (mosaic)",
          "applianceName": "Parquet flooring (mosaic)",
          "assetType": "FINISH",
          "topic": "PARQUET_MOSAIC",
          "installedAt": "1995-07-08T00:00:00.000Z",
          "ageMonths": 374,
          "usefulLifeMonths": 480,
          "depreciationPct": 78,
          "residualPct": 22,
          "remainingLifeMonths": 106,
          "cumulativeRepairCostChf": 0,
          "estimatedReplacementCostChf": 3500,
          "replacementCostConfidence": 0.6,
          "repairToReplacementRatio": 0,
          "annualRepairRate": 0,
          "breakEvenMonths": null,
          "warrantyOffsetMonths": 24,
          "recommendation": "MONITOR",
          "recommendationReason": "Asset is 78% depreciated — monitor for increasing repair frequency.",
          "lastConditionStatus": null,
          "lastConditionAt": null,
          "lastConditionReportType": null,
          "lastConditionValidated": false,
          "currentLease": {
            "tenantName": "BRUNNER Thomas",
            "netRentChf": 1570,
            "endDate": null,
            "remainingMonths": null
          },
          "unitId": "demo-unit-0002",
          "unitNumber": "0002"
        },
        {
          "assetId": "15bddbbb-3b21-4889-afdd-faad0b69445b",
          "assetName": "Balcony railing (metal)",
          "applianceName": "Balcony railing (metal)",
          "assetType": "FIXTURE",
          "topic": "BALCONY_RAILING_METAL",
          "installedAt": "2003-04-08T00:00:00.000Z",
          "ageMonths": 281,
          "usefulLifeMonths": 360,
          "depreciationPct": 78,
          "residualPct": 22,
          "remainingLifeMonths": 79,
          "cumulativeRepairCostChf": 0,
          "estimatedReplacementCostChf": 800,
          "replacementCostConfidence": 0.6,
          "repairToReplacementRatio": 0,
          "annualRepairRate": 0,
          "breakEvenMonths": null,
          "warrantyOffsetMonths": 24,
          "recommendation": "MONITOR",
          "recommendationReason": "Asset is 78% depreciated — monitor for increasing repair frequency.",
          "lastConditionStatus": null,
          "lastConditionAt": null,
          "lastConditionReportType": null,
          "lastConditionValidated": false,
          "currentLease": {
            "tenantName": "KELLER Andrea",
            "netRentChf": 1999,
            "endDate": null,
            "remainingMonths": null
          },
          "unitId": "demo-unit-0004",
          "unitNumber": "0004"
        },
        {
          "assetId": "6eb046ea-15c7-4bea-94a5-edf1298e0efd",
          "assetName": "Kitchen cabinets (chipboard)",
          "applianceName": "Kitchen cabinets (chipboard)",
          "assetType": "FIXTURE",
          "topic": "KITCHEN_CABINET_CHIPBOARD",
          "installedAt": "2015-01-08T00:00:00.000Z",
          "ageMonths": 140,
          "usefulLifeMonths": 180,
          "depreciationPct": 78,
          "residualPct": 22,
          "remainingLifeMonths": 40,
          "cumulativeRepairCostChf": 0,
          "estimatedReplacementCostChf": 4500,
          "replacementCostConfidence": 0.6,
          "repairToReplacementRatio": 0,
          "annualRepairRate": 0,
          "breakEvenMonths": null,
          "warrantyOffsetMonths": 24,
          "recommendation": "MONITOR",
          "recommendationReason": "Asset is 78% depreciated — monitor for increasing repair frequency.",
          "lastConditionStatus": null,
          "lastConditionAt": null,
          "lastConditionReportType": null,
          "lastConditionValidated": false,
          "currentLease": {
            "tenantName": "NGUYEN Thi Lan",
            "netRentChf": 2555,
            "endDate": null,
            "remainingMonths": null
          },
          "unitId": "demo-unit-0005",
          "unitNumber": "0005"
        },
        {
          "assetId": "792f3563-0ea1-453b-b6a5-5833772b99c6",
          "assetName": "Insulated windows (PVC/wood)",
          "applianceName": "Insulated windows (PVC/wood)",
          "assetType": "FIXTURE",
          "topic": "WINDOW_INSULATED_PLASTIC_WOOD",
          "installedAt": "2007-03-08T00:00:00.000Z",
          "ageMonths": 234,
          "usefulLifeMonths": 300,
          "depreciationPct": 78,
          "residualPct": 22,
          "remainingLifeMonths": 66,
          "cumulativeRepairCostChf": 0,
          "estimatedReplacementCostChf": 1100,
          "replacementCostConfidence": 0.6,
          "repairToReplacementRatio": 0,
          "annualRepairRate": 0,
          "breakEvenMonths": null,
          "warrantyOffsetMonths": 24,
          "recommendation": "MONITOR",
          "recommendationReason": "Asset is 78% depreciated — monitor for increasing repair frequency.",
          "lastConditionStatus": null,
          "lastConditionAt": null,
          "lastConditionReportType": null,
          "lastConditionValidated": false,
          "currentLease": {
            "tenantName": "ROSSI Giulia",
            "netRentChf": 1648,
            "endDate": null,
            "remainingMonths": null
          },
          "unitId": "demo-unit-0006",
          "unitNumber": "0006"
        },
        {
          "assetId": "08fcba5d-ce14-4a56-a79d-a0b8162d88ba",
          "assetName": "Bathroom tap",
          "applianceName": "Bathroom tap",
          "assetType": "FIXTURE",
          "topic": "BATHROOM_TAP",
          "installedAt": "2011-02-08T00:00:00.000Z",
          "ageMonths": 187,
          "usefulLifeMonths": 240,
          "depreciationPct": 78,
          "residualPct": 22,
          "remainingLifeMonths": 53,
          "cumulativeRepairCostChf": 0,
          "estimatedReplacementCostChf": 400,
          "replacementCostConfidence": 0.6,
          "repairToReplacementRatio": 0,
          "annualRepairRate": 0,
          "breakEvenMonths": null,
          "warrantyOffsetMonths": 24,
          "recommendation": "MONITOR",
          "recommendationReason": "Asset is 78% depreciated — monitor for increasing repair frequency.",
          "lastConditionStatus": null,
          "lastConditionAt": null,
          "lastConditionReportType": null,
          "lastConditionValidated": false,
          "currentLease": {
            "tenantName": "FAVRE Olivier",
            "netRentChf": 1960,
            "endDate": null,
            "remainingMonths": null
          },
          "unitId": "demo-unit-0007",
          "unitNumber": "0007"
        },
        {
          "assetId": "03f837b4-5c88-4273-89f6-20196359864f",
          "assetName": "Parquet flooring (mosaic)",
          "applianceName": "Parquet flooring (mosaic)",
          "assetType": "FINISH",
          "topic": "PARQUET_MOSAIC",
          "installedAt": "1995-07-08T00:00:00.000Z",
          "ageMonths": 374,
          "usefulLifeMonths": 480,
          "depreciationPct": 78,
          "residualPct": 22,
          "remainingLifeMonths": 106,
          "cumulativeRepairCostChf": 0,
          "estimatedReplacementCostChf": 3500,
          "replacementCostConfidence": 0.6,
          "repairToReplacementRatio": 0,
          "annualRepairRate": 0,
          "breakEvenMonths": null,
          "warrantyOffsetMonths": 24,
          "recommendation": "MONITOR",
          "recommendationReason": "Asset is 78% depreciated — monitor for increasing repair frequency.",
          "lastConditionStatus": "FAIR",
          "lastConditionAt": "2025-09-08T00:00:00.000Z",
          "lastConditionReportType": "MOVE_OUT",
          "lastConditionValidated": true,
          "currentLease": null,
          "unitId": "demo-unit-0008",
          "unitNumber": "0008"
        },
        {
          "assetId": "a3ae7efb-bb6d-4ac7-87e0-9780a24736f9",
          "assetName": "Balcony railing (metal)",
          "applianceName": "Balcony railing (metal)",
          "assetType": "FIXTURE",
          "topic": "BALCONY_RAILING_METAL",
          "installedAt": "2004-07-08T00:00:00.000Z",
          "ageMonths": 266,
          "usefulLifeMonths": 360,
          "depreciationPct": 74,
          "residualPct": 26,
          "remainingLifeMonths": 94,
          "cumulativeRepairCostChf": 0,
          "estimatedReplacementCostChf": 800,
          "replacementCostConfidence": 0.6,
          "repairToReplacementRatio": 0,
          "annualRepairRate": 0,
          "breakEvenMonths": null,
          "warrantyOffsetMonths": 24,
          "recommendation": "MONITOR",
          "recommendationReason": "Asset is 74% depreciated — monitor for increasing repair frequency.",
          "lastConditionStatus": null,
          "lastConditionAt": null,
          "lastConditionReportType": null,
          "lastConditionValidated": false,
          "currentLease": {
            "tenantName": "MARCHAND Sylvie",
            "netRentChf": 1931,
            "endDate": null,
            "remainingMonths": null
          },
          "unitId": "demo-unit-0001",
          "unitNumber": "0001"
        },
        {
          "assetId": "0bf59d2d-31b7-450c-a0dc-d955e1845461",
          "assetName": "Bathtub (acrylic)",
          "applianceName": "Bathtub (acrylic)",
          "assetType": "FIXTURE",
          "topic": "BATHTUB_ACRYLIC",
          "installedAt": "2008-03-08T00:00:00.000Z",
          "ageMonths": 222,
          "usefulLifeMonths": 300,
          "depreciationPct": 74,
          "residualPct": 26,
          "remainingLifeMonths": 78,
          "cumulativeRepairCostChf": 0,
          "estimatedReplacementCostChf": 900,
          "replacementCostConfidence": 0.6,
          "repairToReplacementRatio": 0,
          "annualRepairRate": 0,
          "breakEvenMonths": null,
          "warrantyOffsetMonths": 24,
          "recommendation": "MONITOR",
          "recommendationReason": "Asset is 74% depreciated — monitor for increasing repair frequency.",
          "lastConditionStatus": null,
          "lastConditionAt": null,
          "lastConditionReportType": null,
          "lastConditionValidated": false,
          "currentLease": {
            "tenantName": "KELLER Andrea",
            "netRentChf": 1999,
            "endDate": null,
            "remainingMonths": null
          },
          "unitId": "demo-unit-0004",
          "unitNumber": "0004"
        },
        {
          "assetId": "f7040c38-9a3a-44d4-a62d-2617c7cce8e7",
          "assetName": "Kitchen tap",
          "applianceName": "Kitchen tap",
          "assetType": "FIXTURE",
          "topic": "KITCHEN_TAP",
          "installedAt": "2011-11-08T00:00:00.000Z",
          "ageMonths": 178,
          "usefulLifeMonths": 240,
          "depreciationPct": 74,
          "residualPct": 26,
          "remainingLifeMonths": 62,
          "cumulativeRepairCostChf": 0,
          "estimatedReplacementCostChf": 400,
          "replacementCostConfidence": 0.6,
          "repairToReplacementRatio": 0,
          "annualRepairRate": 0,
          "breakEvenMonths": null,
          "warrantyOffsetMonths": 24,
          "recommendation": "MONITOR",
          "recommendationReason": "Asset is 74% depreciated — monitor for increasing repair frequency.",
          "lastConditionStatus": null,
          "lastConditionAt": null,
          "lastConditionReportType": null,
          "lastConditionValidated": false,
          "currentLease": {
            "tenantName": "KELLER Andrea",
            "netRentChf": 1999,
            "endDate": null,
            "remainingMonths": null
          },
          "unitId": "demo-unit-0004",
          "unitNumber": "0004"
        },
        {
          "assetId": "3f1a28ca-2d61-4f95-a3b4-9508beb16d9b",
          "assetName": "Kitchen tiles (ceramic)",
          "applianceName": "Kitchen tiles (ceramic)",
          "assetType": "FINISH",
          "topic": "KITCHEN_TILES_CERAMIC",
          "installedAt": "2004-07-08T00:00:00.000Z",
          "ageMonths": 266,
          "usefulLifeMonths": 360,
          "depreciationPct": 74,
          "residualPct": 26,
          "remainingLifeMonths": 94,
          "cumulativeRepairCostChf": 0,
          "estimatedReplacementCostChf": 1600,
          "replacementCostConfidence": 0.6,
          "repairToReplacementRatio": 0,
          "annualRepairRate": 0,
          "breakEvenMonths": null,
          "warrantyOffsetMonths": 24,
          "recommendation": "MONITOR",
          "recommendationReason": "Asset is 74% depreciated — monitor for increasing repair frequency.",
          "lastConditionStatus": null,
          "lastConditionAt": null,
          "lastConditionReportType": null,
          "lastConditionValidated": false,
          "currentLease": {
            "tenantName": "NGUYEN Thi Lan",
            "netRentChf": 2555,
            "endDate": null,
            "remainingMonths": null
          },
          "unitId": "demo-unit-0005",
          "unitNumber": "0005"
        },
        {
          "assetId": "3a7024af-7bc7-4ec1-abf3-adb5741758a1",
          "assetName": "Insulated windows (PVC/wood)",
          "applianceName": "Insulated windows (PVC/wood)",
          "assetType": "FIXTURE",
          "topic": "WINDOW_INSULATED_PLASTIC_WOOD",
          "installedAt": "2008-03-08T00:00:00.000Z",
          "ageMonths": 222,
          "usefulLifeMonths": 300,
          "depreciationPct": 74,
          "residualPct": 26,
          "remainingLifeMonths": 78,
          "cumulativeRepairCostChf": 0,
          "estimatedReplacementCostChf": 1100,
          "replacementCostConfidence": 0.6,
          "repairToReplacementRatio": 0,
          "annualRepairRate": 0,
          "breakEvenMonths": null,
          "warrantyOffsetMonths": 24,
          "recommendation": "MONITOR",
          "recommendationReason": "Asset is 74% depreciated — monitor for increasing repair frequency.",
          "lastConditionStatus": null,
          "lastConditionAt": null,
          "lastConditionReportType": null,
          "lastConditionValidated": false,
          "currentLease": {
            "tenantName": "FAVRE Olivier",
            "netRentChf": 1960,
            "endDate": null,
            "remainingMonths": null
          },
          "unitId": "demo-unit-0007",
          "unitNumber": "0007"
        },
        {
          "assetId": "a3f412c3-d042-423e-b3cb-5838c784d157",
          "assetName": "Power sockets",
          "applianceName": "Power sockets",
          "assetType": "SYSTEM",
          "topic": "POWER_SOCKET",
          "installedAt": "2015-08-08T00:00:00.000Z",
          "ageMonths": 133,
          "usefulLifeMonths": 180,
          "depreciationPct": 74,
          "residualPct": 26,
          "remainingLifeMonths": 47,
          "cumulativeRepairCostChf": 0,
          "estimatedReplacementCostChf": 130,
          "replacementCostConfidence": 0.6,
          "repairToReplacementRatio": 0,
          "annualRepairRate": 0,
          "breakEvenMonths": null,
          "warrantyOffsetMonths": 24,
          "recommendation": "MONITOR",
          "recommendationReason": "Asset is 74% depreciated — monitor for increasing repair frequency.",
          "lastConditionStatus": null,
          "lastConditionAt": null,
          "lastConditionReportType": null,
          "lastConditionValidated": false,
          "currentLease": {
            "tenantName": "FAVRE Olivier",
            "netRentChf": 1960,
            "endDate": null,
            "remainingMonths": null
          },
          "unitId": "demo-unit-0007",
          "unitNumber": "0007"
        },
        {
          "assetId": "f835d7c4-588f-4095-86ae-1d20f6115a1f",
          "assetName": "Kitchen tap",
          "applianceName": "Kitchen tap",
          "assetType": "FIXTURE",
          "topic": "KITCHEN_TAP",
          "installedAt": "2011-11-08T00:00:00.000Z",
          "ageMonths": 178,
          "usefulLifeMonths": 240,
          "depreciationPct": 74,
          "residualPct": 26,
          "remainingLifeMonths": 62,
          "cumulativeRepairCostChf": 0,
          "estimatedReplacementCostChf": 400,
          "replacementCostConfidence": 0.6,
          "repairToReplacementRatio": 0,
          "annualRepairRate": 0,
          "breakEvenMonths": null,
          "warrantyOffsetMonths": 24,
          "recommendation": "MONITOR",
          "recommendationReason": "Asset is 74% depreciated — monitor for increasing repair frequency.",
          "lastConditionStatus": null,
          "lastConditionAt": null,
          "lastConditionReportType": null,
          "lastConditionValidated": false,
          "currentLease": null,
          "unitId": "demo-unit-0008",
          "unitNumber": "0008"
        },
        {
          "assetId": "09f5897d-1e6c-4675-8294-c8972adb606a",
          "assetName": "Wall paint (dispersion)",
          "applianceName": "Wall paint (dispersion)",
          "assetType": "FINISH",
          "topic": "PAINT_WALLS_DISPERSION",
          "installedAt": "2024-06-08T00:00:00.000Z",
          "ageMonths": 27,
          "usefulLifeMonths": 96,
          "depreciationPct": 28,
          "residualPct": 72,
          "remainingLifeMonths": 69,
          "cumulativeRepairCostChf": 0,
          "estimatedReplacementCostChf": 2200,
          "replacementCostConfidence": 0.6,
          "repairToReplacementRatio": 0,
          "annualRepairRate": 0,
          "breakEvenMonths": null,
          "warrantyOffsetMonths": 24,
          "recommendation": "MONITOR",
          "recommendationReason": "Asset is in good condition relative to its useful life. Last inspection rated POOR — condition warrants earlier intervention.",
          "lastConditionStatus": "POOR",
          "lastConditionAt": "2025-09-08T00:00:00.000Z",
          "lastConditionReportType": "MOVE_OUT",
          "lastConditionValidated": true,
          "currentLease": null,
          "unitId": "demo-unit-0008",
          "unitNumber": "0008"
        }
      ]
    },
    "/buildings/demo-building/yield-goalseek": {
      "data": {
        "currentYieldPct": 2.57,
        "targetYieldPct": 3,
        "valueChf": 6535625,
        "currentNoiChf": 168256,
        "rentRollChf": 207360,
        "occupancyRate": 0.8333,
        "requiredNoiChf": 196068.75,
        "gapChf": 27812.75,
        "met": false,
        "strategySource": "none",
        "strategyFlags": null,
        "strategyLabel": null,
        "levers": {
          "rent": {
            "deltaMonthlyChf": 2317.73,
            "pctOfRentRoll": 0.1341,
            "marketGapAnnualChf": 59685,
            "avgLeaseRemainingMonths": null,
            "feasible": true,
            "offStrategy": false
          },
          "opex": {
            "requiredReductionChf": 27812.75,
            "operatingCostChf": 61880,
            "headroomChf": 3094,
            "feasible": false,
            "offStrategy": false
          },
          "occupancy": {
            "requiredOccupancyRate": 0.9451,
            "feasible": true,
            "offStrategy": false
          },
          "mgmtFee": {
            "feeChf": 11487.74,
            "ppOfYield": 0.176,
            "gapCoverPct": 0.413,
            "selfManage": false,
            "feasible": true,
            "offStrategy": false
          },
          "renovation": {
            "lines": [
              {
                "assetId": "6c634239-94ee-4688-b976-03d81ce89ec2",
                "unitId": "demo-unit-0003",
                "label": "Insulated windows (PVC/wood) — 0003",
                "costChf": 1100,
                "annualUpliftChf": 22,
                "deltaValueChf": 715,
                "marginalYieldPct": 3.08,
                "accretive": true
              },
              {
                "assetId": "dada94b5-2ae5-4989-8868-fccf5373a595",
                "unitId": "demo-unit-0005",
                "label": "Parquet flooring (mosaic) — 0005",
                "costChf": 3500,
                "annualUpliftChf": 43.75,
                "deltaValueChf": 2275,
                "marginalYieldPct": 1.92,
                "accretive": false
              },
              {
                "assetId": "a40eef84-b8e4-44a9-957e-fa408f9da8de",
                "unitId": "demo-unit-0008",
                "label": "Kitchen cabinets (chipboard) — 0008",
                "costChf": 4500,
                "annualUpliftChf": 150,
                "deltaValueChf": 2925,
                "marginalYieldPct": 5.13,
                "accretive": true
              },
              {
                "assetId": "50d1b281-b019-4f7e-bdaf-294af8355edc",
                "unitId": "demo-unit-0003",
                "label": "Kitchen cabinets (chipboard) — 0003",
                "costChf": 4500,
                "annualUpliftChf": 150,
                "deltaValueChf": 2925,
                "marginalYieldPct": 5.13,
                "accretive": true
              },
              {
                "assetId": "45ed30a9-f059-4cb0-9e2f-bfad84b311f9",
                "unitId": "demo-unit-0006",
                "label": "Interior doors (chipboard) — 0006",
                "costChf": 450,
                "annualUpliftChf": 9,
                "deltaValueChf": 292.5,
                "marginalYieldPct": 3.08,
                "accretive": true
              },
              {
                "assetId": "9850ddb9-679f-44dc-9ac3-c696192ab7f2",
                "unitId": "demo-unit-0006",
                "label": "Roller shutters (plastic) — 0006",
                "costChf": 550,
                "annualUpliftChf": 13.75,
                "deltaValueChf": 357.5,
                "marginalYieldPct": 3.85,
                "accretive": true
              },
              {
                "assetId": "0581e949-581f-4a4a-ae0c-f7da89f0de3f",
                "unitId": "demo-unit-0008",
                "label": "Power sockets — 0008",
                "costChf": 130,
                "annualUpliftChf": 4.33,
                "deltaValueChf": 84.5,
                "marginalYieldPct": 5.13,
                "accretive": true
              },
              {
                "assetId": "dc4ce34d-f394-4d4d-b771-a7b0baafca8d",
                "unitId": "demo-unit-0001",
                "label": "Kitchen tap — 0001",
                "costChf": 400,
                "annualUpliftChf": 10,
                "deltaValueChf": 260,
                "marginalYieldPct": 3.85,
                "accretive": true
              },
              {
                "assetId": "61216168-5e7e-431e-8cc7-3ba4d3b80073",
                "unitId": "demo-unit-0002",
                "label": "Power sockets — 0002",
                "costChf": 130,
                "annualUpliftChf": 4.33,
                "deltaValueChf": 84.5,
                "marginalYieldPct": 5.13,
                "accretive": true
              },
              {
                "assetId": "91b041f9-cd2c-408a-a929-94a53c03f89f",
                "unitId": "demo-unit-0005",
                "label": "Bathroom tap — 0005",
                "costChf": 400,
                "annualUpliftChf": 10,
                "deltaValueChf": 260,
                "marginalYieldPct": 3.85,
                "accretive": true
              },
              {
                "assetId": "c7cf90f2-0c6c-43d9-9b62-02ee6049b2e0",
                "unitId": "demo-unit-0002",
                "label": "Kitchen worktop (synthetic) — 0002",
                "costChf": 1200,
                "annualUpliftChf": 40,
                "deltaValueChf": 780,
                "marginalYieldPct": 5.13,
                "accretive": true
              },
              {
                "assetId": "bac575dc-2bff-432a-8f72-535b77cccadc",
                "unitId": "demo-unit-0003",
                "label": "Bathroom tap — 0003",
                "costChf": 400,
                "annualUpliftChf": 10,
                "deltaValueChf": 260,
                "marginalYieldPct": 3.85,
                "accretive": true
              },
              {
                "assetId": "02c95df5-f3c1-4072-b96a-6bcbcd0dc684",
                "unitId": "demo-unit-0004",
                "label": "Roller shutters (plastic) — 0004",
                "costChf": 550,
                "annualUpliftChf": 13.75,
                "deltaValueChf": 357.5,
                "marginalYieldPct": 3.85,
                "accretive": true
              },
              {
                "assetId": "55f097f4-fcc6-4ca4-a643-58e2bb025b00",
                "unitId": "demo-unit-0004",
                "label": "Wall paint (dispersion) — 0004",
                "costChf": 2200,
                "annualUpliftChf": 137.5,
                "deltaValueChf": 1430,
                "marginalYieldPct": 9.62,
                "accretive": true
              },
              {
                "assetId": "ac41b933-be89-48e0-82a3-ee702f81d509",
                "unitId": "demo-unit-0005",
                "label": "Light switches — 0005",
                "costChf": 70,
                "annualUpliftChf": 2.33,
                "deltaValueChf": 45.5,
                "marginalYieldPct": 5.13,
                "accretive": true
              },
              {
                "assetId": "58733997-0f0a-43e6-96e0-493710dfc4ba",
                "unitId": "demo-unit-0007",
                "label": "Sanitary ceramics (WC/basin) — 0007",
                "costChf": 1200,
                "annualUpliftChf": 17.14,
                "deltaValueChf": 780,
                "marginalYieldPct": 2.2,
                "accretive": false
              },
              {
                "assetId": "ca58ae14-5da2-4143-ac28-6facf4dd5e0f",
                "unitId": "demo-unit-0008",
                "label": "Balcony railing (metal) — 0008",
                "costChf": 800,
                "annualUpliftChf": 13.33,
                "deltaValueChf": 520,
                "marginalYieldPct": 2.56,
                "accretive": false
              },
              {
                "assetId": "2e9fbb78-1b17-42cb-b283-1c49f74dfb1a",
                "unitId": "demo-unit-0008",
                "label": "Bathroom tiles (ceramic) — 0008",
                "costChf": 2200,
                "annualUpliftChf": 36.67,
                "deltaValueChf": 1430,
                "marginalYieldPct": 2.56,
                "accretive": false
              },
              {
                "assetId": "e29c9d98-9f30-4e86-bfa0-38595f75afe3",
                "unitId": "demo-unit-0006",
                "label": "Wall paint (dispersion) — 0006",
                "costChf": 2200,
                "annualUpliftChf": 137.5,
                "deltaValueChf": 1430,
                "marginalYieldPct": 9.62,
                "accretive": true
              },
              {
                "assetId": "cdcd4dd1-604c-4dce-a25d-fd25c2cb8c0e",
                "unitId": "demo-unit-0001",
                "label": "Kitchen worktop (synthetic) — 0001",
                "costChf": 1200,
                "annualUpliftChf": 40,
                "deltaValueChf": 780,
                "marginalYieldPct": 5.13,
                "accretive": true
              },
              {
                "assetId": "dc7ed960-a649-4727-9652-c847277e5cff",
                "unitId": "demo-unit-0001",
                "label": "Insulated windows (PVC/wood) — 0001",
                "costChf": 1100,
                "annualUpliftChf": 22,
                "deltaValueChf": 715,
                "marginalYieldPct": 3.08,
                "accretive": true
              },
              {
                "assetId": "9a85dc6c-88c1-4fbe-bf56-603a60abf0a7",
                "unitId": "demo-unit-0002",
                "label": "Bathtub (acrylic) — 0002",
                "costChf": 900,
                "annualUpliftChf": 18,
                "deltaValueChf": 585,
                "marginalYieldPct": 3.08,
                "accretive": true
              },
              {
                "assetId": "41d16db4-e57d-40a5-b27b-eec76be78f29",
                "unitId": "demo-unit-0003",
                "label": "Roller shutters (plastic) — 0003",
                "costChf": 550,
                "annualUpliftChf": 13.75,
                "deltaValueChf": 357.5,
                "marginalYieldPct": 3.85,
                "accretive": true
              },
              {
                "assetId": "4731f5fb-707c-4cae-a81f-d497b47e202a",
                "unitId": "demo-unit-0003",
                "label": "Wall paint (dispersion) — 0003",
                "costChf": 2200,
                "annualUpliftChf": 137.5,
                "deltaValueChf": 1430,
                "marginalYieldPct": 9.62,
                "accretive": true
              },
              {
                "assetId": "33e4f919-5713-41cf-a138-ce49e9977bf2",
                "unitId": "demo-unit-0003",
                "label": "Power sockets — 0003",
                "costChf": 130,
                "annualUpliftChf": 4.33,
                "deltaValueChf": 84.5,
                "marginalYieldPct": 5.13,
                "accretive": true
              },
              {
                "assetId": "87fa03d4-bcde-4366-8042-93d7435bbe1d",
                "unitId": "demo-unit-0006",
                "label": "Bathroom tap — 0006",
                "costChf": 400,
                "annualUpliftChf": 10,
                "deltaValueChf": 260,
                "marginalYieldPct": 3.85,
                "accretive": true
              },
              {
                "assetId": "5deed3d2-85f9-4338-89ed-c47dbefce005",
                "unitId": "demo-unit-0006",
                "label": "Bathtub (acrylic) — 0006",
                "costChf": 900,
                "annualUpliftChf": 18,
                "deltaValueChf": 585,
                "marginalYieldPct": 3.08,
                "accretive": true
              },
              {
                "assetId": "e4275079-9010-446e-91dd-f7a61e8157fb",
                "unitId": "demo-unit-0006",
                "label": "Kitchen tap — 0006",
                "costChf": 400,
                "annualUpliftChf": 10,
                "deltaValueChf": 260,
                "marginalYieldPct": 3.85,
                "accretive": true
              },
              {
                "assetId": "b6111e02-6a28-4a94-bbfa-227b79f1e24a",
                "unitId": "demo-unit-0006",
                "label": "Light switches — 0006",
                "costChf": 70,
                "annualUpliftChf": 2.33,
                "deltaValueChf": 45.5,
                "marginalYieldPct": 5.13,
                "accretive": true
              },
              {
                "assetId": "f77ae1ad-4ce9-4a8a-8163-02f139db7763",
                "unitId": "demo-unit-0007",
                "label": "Interior doors (chipboard) — 0007",
                "costChf": 450,
                "annualUpliftChf": 9,
                "deltaValueChf": 292.5,
                "marginalYieldPct": 3.08,
                "accretive": true
              },
              {
                "assetId": "6d7aaa72-8631-4b77-8bf8-7c7feaccaa85",
                "unitId": "demo-unit-0007",
                "label": "Bathroom tiles (ceramic) — 0007",
                "costChf": 2200,
                "annualUpliftChf": 36.67,
                "deltaValueChf": 1430,
                "marginalYieldPct": 2.56,
                "accretive": false
              },
              {
                "assetId": "96a56bb1-5085-4a5c-9df1-a3af9fb2c26a",
                "unitId": "demo-unit-0008",
                "label": "Balcony (metal) — 0008",
                "costChf": 4500,
                "annualUpliftChf": 56.25,
                "deltaValueChf": 2925,
                "marginalYieldPct": 1.92,
                "accretive": false
              },
              {
                "assetId": "347394e1-bdaa-4774-8845-60fd14753ade",
                "unitId": "demo-unit-0001",
                "label": "Kitchen tiles (ceramic) — 0001",
                "costChf": 1600,
                "annualUpliftChf": 26.67,
                "deltaValueChf": 1040,
                "marginalYieldPct": 2.56,
                "accretive": false
              },
              {
                "assetId": "f3bbaccd-5ff8-46ac-93ca-4d13471c4786",
                "unitId": "demo-unit-0003",
                "label": "Balcony railing (metal) — 0003",
                "costChf": 800,
                "annualUpliftChf": 13.33,
                "deltaValueChf": 520,
                "marginalYieldPct": 2.56,
                "accretive": false
              },
              {
                "assetId": "50d4329b-50c3-48cf-b25f-28f1d397a119",
                "unitId": "demo-unit-0003",
                "label": "Kitchen worktop (synthetic) — 0003",
                "costChf": 1200,
                "annualUpliftChf": 40,
                "deltaValueChf": 780,
                "marginalYieldPct": 5.13,
                "accretive": true
              },
              {
                "assetId": "82fe8641-7a63-4de3-a70c-14152b2e9fe7",
                "unitId": "demo-unit-0007",
                "label": "Roller shutters (plastic) — 0007",
                "costChf": 550,
                "annualUpliftChf": 13.75,
                "deltaValueChf": 357.5,
                "marginalYieldPct": 3.85,
                "accretive": true
              },
              {
                "assetId": "29743c70-02ea-40f1-8a8c-f288eefd82f0",
                "unitId": "demo-unit-0007",
                "label": "Wall paint (dispersion) — 0007",
                "costChf": 2200,
                "annualUpliftChf": 137.5,
                "deltaValueChf": 1430,
                "marginalYieldPct": 9.62,
                "accretive": true
              },
              {
                "assetId": "597b7d69-524b-44a5-9993-b5888438b8bf",
                "unitId": "demo-unit-0008",
                "label": "Bathroom tap — 0008",
                "costChf": 400,
                "annualUpliftChf": 10,
                "deltaValueChf": 260,
                "marginalYieldPct": 3.85,
                "accretive": true
              },
              {
                "assetId": "f8d26c10-749f-4cf7-8ab7-0fdf66e160e0",
                "unitId": "demo-unit-0001",
                "label": "Balcony (metal) — 0001",
                "costChf": 4500,
                "annualUpliftChf": 56.25,
                "deltaValueChf": 2925,
                "marginalYieldPct": 1.92,
                "accretive": false
              },
              {
                "assetId": "fed929a9-6bb4-4d5a-8d9d-ffd3faa52618",
                "unitId": "demo-unit-0002",
                "label": "Parquet flooring (mosaic) — 0002",
                "costChf": 3500,
                "annualUpliftChf": 43.75,
                "deltaValueChf": 2275,
                "marginalYieldPct": 1.92,
                "accretive": false
              },
              {
                "assetId": "15bddbbb-3b21-4889-afdd-faad0b69445b",
                "unitId": "demo-unit-0004",
                "label": "Balcony railing (metal) — 0004",
                "costChf": 800,
                "annualUpliftChf": 13.33,
                "deltaValueChf": 520,
                "marginalYieldPct": 2.56,
                "accretive": false
              },
              {
                "assetId": "6eb046ea-15c7-4bea-94a5-edf1298e0efd",
                "unitId": "demo-unit-0005",
                "label": "Kitchen cabinets (chipboard) — 0005",
                "costChf": 4500,
                "annualUpliftChf": 150,
                "deltaValueChf": 2925,
                "marginalYieldPct": 5.13,
                "accretive": true
              },
              {
                "assetId": "792f3563-0ea1-453b-b6a5-5833772b99c6",
                "unitId": "demo-unit-0006",
                "label": "Insulated windows (PVC/wood) — 0006",
                "costChf": 1100,
                "annualUpliftChf": 22,
                "deltaValueChf": 715,
                "marginalYieldPct": 3.08,
                "accretive": true
              },
              {
                "assetId": "08fcba5d-ce14-4a56-a79d-a0b8162d88ba",
                "unitId": "demo-unit-0007",
                "label": "Bathroom tap — 0007",
                "costChf": 400,
                "annualUpliftChf": 10,
                "deltaValueChf": 260,
                "marginalYieldPct": 3.85,
                "accretive": true
              },
              {
                "assetId": "03f837b4-5c88-4273-89f6-20196359864f",
                "unitId": "demo-unit-0008",
                "label": "Parquet flooring (mosaic) — 0008",
                "costChf": 3500,
                "annualUpliftChf": 43.75,
                "deltaValueChf": 2275,
                "marginalYieldPct": 1.92,
                "accretive": false
              },
              {
                "assetId": "a3ae7efb-bb6d-4ac7-87e0-9780a24736f9",
                "unitId": "demo-unit-0001",
                "label": "Balcony railing (metal) — 0001",
                "costChf": 800,
                "annualUpliftChf": 13.33,
                "deltaValueChf": 520,
                "marginalYieldPct": 2.56,
                "accretive": false
              },
              {
                "assetId": "0bf59d2d-31b7-450c-a0dc-d955e1845461",
                "unitId": "demo-unit-0004",
                "label": "Bathtub (acrylic) — 0004",
                "costChf": 900,
                "annualUpliftChf": 18,
                "deltaValueChf": 585,
                "marginalYieldPct": 3.08,
                "accretive": true
              },
              {
                "assetId": "f7040c38-9a3a-44d4-a62d-2617c7cce8e7",
                "unitId": "demo-unit-0004",
                "label": "Kitchen tap — 0004",
                "costChf": 400,
                "annualUpliftChf": 10,
                "deltaValueChf": 260,
                "marginalYieldPct": 3.85,
                "accretive": true
              },
              {
                "assetId": "3f1a28ca-2d61-4f95-a3b4-9508beb16d9b",
                "unitId": "demo-unit-0005",
                "label": "Kitchen tiles (ceramic) — 0005",
                "costChf": 1600,
                "annualUpliftChf": 26.67,
                "deltaValueChf": 1040,
                "marginalYieldPct": 2.56,
                "accretive": false
              },
              {
                "assetId": "3a7024af-7bc7-4ec1-abf3-adb5741758a1",
                "unitId": "demo-unit-0007",
                "label": "Insulated windows (PVC/wood) — 0007",
                "costChf": 1100,
                "annualUpliftChf": 22,
                "deltaValueChf": 715,
                "marginalYieldPct": 3.08,
                "accretive": true
              },
              {
                "assetId": "a3f412c3-d042-423e-b3cb-5838c784d157",
                "unitId": "demo-unit-0007",
                "label": "Power sockets — 0007",
                "costChf": 130,
                "annualUpliftChf": 4.33,
                "deltaValueChf": 84.5,
                "marginalYieldPct": 5.13,
                "accretive": true
              },
              {
                "assetId": "f835d7c4-588f-4095-86ae-1d20f6115a1f",
                "unitId": "demo-unit-0008",
                "label": "Kitchen tap — 0008",
                "costChf": 400,
                "annualUpliftChf": 10,
                "deltaValueChf": 260,
                "marginalYieldPct": 3.85,
                "accretive": true
              },
              {
                "assetId": "09f5897d-1e6c-4675-8294-c8972adb606a",
                "unitId": "demo-unit-0008",
                "label": "Wall paint (dispersion) — 0008",
                "costChf": 2200,
                "annualUpliftChf": 137.5,
                "deltaValueChf": 1430,
                "marginalYieldPct": 9.62,
                "accretive": true
              }
            ],
            "accretiveCount": 39,
            "ceilingYieldPct": 2.59,
            "feasible": false,
            "offStrategy": false,
            "capexChf": 42560,
            "annualUpliftChf": 1584.48,
            "deltaValueChf": 27664
          }
        },
        "synthesis": {
          "withinStrategyYieldPct": 4.31,
          "withRenovationYieldPct": 4.32,
          "withSelfManageYieldPct": 4.35
        },
        "currentFeePct": 5.54,
        "feeSource": "statements",
        "opexDrivers": [
          {
            "label": "Chauffage et eau chaude",
            "annualChf": 19350,
            "category": "RECOVERABLE"
          },
          {
            "label": "Conciergerie et nettoyage",
            "annualChf": 14400,
            "category": "RECOVERABLE"
          },
          {
            "label": "Entretien des appartements",
            "annualChf": 7040,
            "category": "OWNER_OPEX"
          },
          {
            "label": "Assurances immeuble",
            "annualChf": 5420,
            "category": "OWNER_OPEX"
          },
          {
            "label": "Entretien parties communes",
            "annualChf": 5380,
            "category": "OWNER_OPEX"
          },
          {
            "label": "Eau et épuration",
            "annualChf": 5350,
            "category": "RECOVERABLE"
          }
        ],
        "strategyOwnerName": null,
        "occupancyGainAnnualChf": 32064,
        "vacantUnits": [
          {
            "label": "9004",
            "kind": "parking",
            "expectedAnnualChf": 1872,
            "hasAskingRent": true
          },
          {
            "label": "0008",
            "kind": "residential",
            "expectedAnnualChf": 30192,
            "hasAskingRent": true
          }
        ],
        "rentMarketDetail": [
          {
            "label": "0005",
            "livingAreaSqm": 104,
            "pricePerSqmChf": 13500,
            "grossYieldPct": 3.3,
            "vetustePct": 29,
            "currentAnnualChf": 30660,
            "marketAnnualChf": 40957,
            "gapChf": 10297
          },
          {
            "label": "0003",
            "livingAreaSqm": 102,
            "pricePerSqmChf": 13500,
            "grossYieldPct": 3.3,
            "vetustePct": 32,
            "currentAnnualChf": 29724,
            "marketAnnualChf": 39625,
            "gapChf": 9901
          },
          {
            "label": "0008",
            "livingAreaSqm": 101,
            "pricePerSqmChf": 13500,
            "grossYieldPct": 3.3,
            "vetustePct": 29,
            "currentAnnualChf": 30192,
            "marketAnnualChf": 39776,
            "gapChf": 9584
          },
          {
            "label": "0007",
            "livingAreaSqm": 79,
            "pricePerSqmChf": 13500,
            "grossYieldPct": 3.3,
            "vetustePct": 26,
            "currentAnnualChf": 23520,
            "marketAnnualChf": 31534,
            "gapChf": 8014
          },
          {
            "label": "0001",
            "livingAreaSqm": 78,
            "pricePerSqmChf": 13500,
            "grossYieldPct": 3.3,
            "vetustePct": 26,
            "currentAnnualChf": 23172,
            "marketAnnualChf": 31135,
            "gapChf": 7963
          },
          {
            "label": "0004",
            "livingAreaSqm": 80,
            "pricePerSqmChf": 13500,
            "grossYieldPct": 3.3,
            "vetustePct": 26,
            "currentAnnualChf": 23988,
            "marketAnnualChf": 31933,
            "gapChf": 7945
          },
          {
            "label": "0002",
            "livingAreaSqm": 58,
            "pricePerSqmChf": 13500,
            "grossYieldPct": 3.3,
            "vetustePct": 29,
            "currentAnnualChf": 18840,
            "marketAnnualChf": 22842,
            "gapChf": 4002
          },
          {
            "label": "0006",
            "livingAreaSqm": 56,
            "pricePerSqmChf": 13500,
            "grossYieldPct": 3.3,
            "vetustePct": 32,
            "currentAnnualChf": 19776,
            "marketAnnualChf": 21755,
            "gapChf": 1979
          }
        ],
        "rentMarketBasis": {
          "grossYieldPct": 3.3,
          "vetusteCoeffPct": 40,
          "pricePerSqmSource": "intrinsic"
        },
        "periodFrom": "2025-01-01",
        "periodTo": "2025-12-31"
      }
    },
    "/cashflow-plans": {
      "data": [
        {
          "id": "demo-plan",
          "orgId": "demo-fixture-org",
          "buildingId": "demo-building",
          "name": "Envelope & kitchens — 3-year programme",
          "status": "DRAFT",
          "incomeGrowthRatePct": 1,
          "openingBalanceCents": null,
          "horizonMonths": 120,
          "lastComputedAt": null,
          "discountRatePct": 4,
          "capRatePct": 4.5,
          "deferYears": 3,
          "propertyValueChf": 6450000,
          "lastVerdictScenario": null,
          "lastVerdictAt": null,
          "createdAt": "2026-09-08T13:12:20.119Z",
          "updatedAt": "2026-09-08T13:12:20.119Z",
          "building": {
            "id": "demo-building",
            "name": "Résidence des Charmilles",
            "canton": null
          },
          "overrides": [
            {
              "id": "6599f2b9-e3b1-49ad-b786-6bccf3589a86",
              "planId": "demo-plan",
              "assetId": "dada94b5-2ae5-4989-8868-fccf5373a595",
              "originalYear": 2026,
              "overriddenYear": 2026,
              "costChf": 9500,
              "rentUpliftChfPerMonth": 40,
              "riskAvoidedChfPerYear": 900,
              "vacancyDays": 0,
              "oblfPassthroughPct": 60,
              "createdAt": "2026-09-08T13:12:20.119Z",
              "asset": {
                "id": "dada94b5-2ae5-4989-8868-fccf5373a595",
                "name": "Parquet flooring (mosaic)",
                "type": "FINISH",
                "topic": "PARQUET_MOSAIC",
                "unitId": "demo-unit-0005"
              }
            },
            {
              "id": "bc49d844-4e98-4220-932e-5b545106e720",
              "planId": "demo-plan",
              "assetId": "6c634239-94ee-4688-b976-03d81ce89ec2",
              "originalYear": 2026,
              "overriddenYear": 2027,
              "costChf": 9500,
              "rentUpliftChfPerMonth": 40,
              "riskAvoidedChfPerYear": 900,
              "vacancyDays": 0,
              "oblfPassthroughPct": 60,
              "createdAt": "2026-09-08T13:12:20.119Z",
              "asset": {
                "id": "6c634239-94ee-4688-b976-03d81ce89ec2",
                "name": "Insulated windows (PVC/wood)",
                "type": "FIXTURE",
                "topic": "WINDOW_INSULATED_PLASTIC_WOOD",
                "unitId": "demo-unit-0003"
              }
            },
            {
              "id": "b9b7cb27-f876-4e0f-ba66-116448fe4380",
              "planId": "demo-plan",
              "assetId": "a40eef84-b8e4-44a9-957e-fa408f9da8de",
              "originalYear": 2026,
              "overriddenYear": 2028,
              "costChf": 24000,
              "rentUpliftChfPerMonth": 95,
              "riskAvoidedChfPerYear": 900,
              "vacancyDays": 21,
              "oblfPassthroughPct": 60,
              "createdAt": "2026-09-08T13:12:20.119Z",
              "asset": {
                "id": "a40eef84-b8e4-44a9-957e-fa408f9da8de",
                "name": "Kitchen cabinets (chipboard)",
                "type": "FIXTURE",
                "topic": "KITCHEN_CABINET_CHIPBOARD",
                "unitId": "demo-unit-0008"
              }
            },
            {
              "id": "0f787e2b-61ea-4809-8ef2-b769f9dad210",
              "planId": "demo-plan",
              "assetId": "6e74af8a-594c-4269-87b6-096ae16270b6",
              "originalYear": 2026,
              "overriddenYear": 2026,
              "costChf": 78000,
              "rentUpliftChfPerMonth": 0,
              "riskAvoidedChfPerYear": 6500,
              "vacancyDays": 0,
              "oblfPassthroughPct": 60,
              "createdAt": "2026-09-08T13:12:20.119Z",
              "asset": {
                "id": "6e74af8a-594c-4269-87b6-096ae16270b6",
                "name": "Boiler",
                "type": "SYSTEM",
                "topic": "BOILER",
                "unitId": null
              }
            }
          ]
        }
      ]
    },
    "/cashflow-plans/demo-plan": {
      "data": {
        "id": "demo-plan",
        "orgId": "demo-fixture-org",
        "buildingId": "demo-building",
        "name": "Envelope & kitchens — 3-year programme",
        "status": "DRAFT",
        "incomeGrowthRatePct": 1,
        "openingBalanceCents": null,
        "horizonMonths": 120,
        "lastComputedAt": null,
        "discountRatePct": 4,
        "capRatePct": 4.5,
        "deferYears": 3,
        "propertyValueChf": 6450000,
        "lastVerdictScenario": null,
        "lastVerdictAt": null,
        "createdAt": "2026-09-08T13:12:20.119Z",
        "updatedAt": "2026-09-08T13:12:20.119Z",
        "building": {
          "id": "demo-building",
          "name": "Résidence des Charmilles",
          "canton": null
        },
        "overrides": [
          {
            "id": "6599f2b9-e3b1-49ad-b786-6bccf3589a86",
            "planId": "demo-plan",
            "assetId": "dada94b5-2ae5-4989-8868-fccf5373a595",
            "originalYear": 2026,
            "overriddenYear": 2026,
            "costChf": 9500,
            "rentUpliftChfPerMonth": 40,
            "riskAvoidedChfPerYear": 900,
            "vacancyDays": 0,
            "oblfPassthroughPct": 60,
            "createdAt": "2026-09-08T13:12:20.119Z",
            "asset": {
              "id": "dada94b5-2ae5-4989-8868-fccf5373a595",
              "name": "Parquet flooring (mosaic)",
              "type": "FINISH",
              "topic": "PARQUET_MOSAIC",
              "unitId": "demo-unit-0005"
            }
          },
          {
            "id": "bc49d844-4e98-4220-932e-5b545106e720",
            "planId": "demo-plan",
            "assetId": "6c634239-94ee-4688-b976-03d81ce89ec2",
            "originalYear": 2026,
            "overriddenYear": 2027,
            "costChf": 9500,
            "rentUpliftChfPerMonth": 40,
            "riskAvoidedChfPerYear": 900,
            "vacancyDays": 0,
            "oblfPassthroughPct": 60,
            "createdAt": "2026-09-08T13:12:20.119Z",
            "asset": {
              "id": "6c634239-94ee-4688-b976-03d81ce89ec2",
              "name": "Insulated windows (PVC/wood)",
              "type": "FIXTURE",
              "topic": "WINDOW_INSULATED_PLASTIC_WOOD",
              "unitId": "demo-unit-0003"
            }
          },
          {
            "id": "b9b7cb27-f876-4e0f-ba66-116448fe4380",
            "planId": "demo-plan",
            "assetId": "a40eef84-b8e4-44a9-957e-fa408f9da8de",
            "originalYear": 2026,
            "overriddenYear": 2028,
            "costChf": 24000,
            "rentUpliftChfPerMonth": 95,
            "riskAvoidedChfPerYear": 900,
            "vacancyDays": 21,
            "oblfPassthroughPct": 60,
            "createdAt": "2026-09-08T13:12:20.119Z",
            "asset": {
              "id": "a40eef84-b8e4-44a9-957e-fa408f9da8de",
              "name": "Kitchen cabinets (chipboard)",
              "type": "FIXTURE",
              "topic": "KITCHEN_CABINET_CHIPBOARD",
              "unitId": "demo-unit-0008"
            }
          },
          {
            "id": "0f787e2b-61ea-4809-8ef2-b769f9dad210",
            "planId": "demo-plan",
            "assetId": "6e74af8a-594c-4269-87b6-096ae16270b6",
            "originalYear": 2026,
            "overriddenYear": 2026,
            "costChf": 78000,
            "rentUpliftChfPerMonth": 0,
            "riskAvoidedChfPerYear": 6500,
            "vacancyDays": 0,
            "oblfPassthroughPct": 60,
            "createdAt": "2026-09-08T13:12:20.119Z",
            "asset": {
              "id": "6e74af8a-594c-4269-87b6-096ae16270b6",
              "name": "Boiler",
              "type": "SYSTEM",
              "topic": "BOILER",
              "unitId": null
            }
          }
        ],
        "cashflow": {
          "hasOpeningBalance": false,
          "buckets": [
            {
              "year": 2025,
              "month": 1,
              "isActual": false,
              "accruedIncomeCents": 1586800,
              "projectedOpexCents": 0,
              "scheduledCapexCents": 0,
              "netCents": 1586800,
              "cumulativeBalanceCents": 1586800,
              "capexItems": []
            },
            {
              "year": 2025,
              "month": 2,
              "isActual": false,
              "accruedIncomeCents": 1586800,
              "projectedOpexCents": 0,
              "scheduledCapexCents": 0,
              "netCents": 1586800,
              "cumulativeBalanceCents": 3173600,
              "capexItems": []
            },
            {
              "year": 2025,
              "month": 3,
              "isActual": false,
              "accruedIncomeCents": 1586800,
              "projectedOpexCents": 0,
              "scheduledCapexCents": 0,
              "netCents": 1586800,
              "cumulativeBalanceCents": 4760400,
              "capexItems": []
            },
            {
              "year": 2025,
              "month": 4,
              "isActual": false,
              "accruedIncomeCents": 1586800,
              "projectedOpexCents": 0,
              "scheduledCapexCents": 0,
              "netCents": 1586800,
              "cumulativeBalanceCents": 6347200,
              "capexItems": []
            },
            {
              "year": 2025,
              "month": 5,
              "isActual": false,
              "accruedIncomeCents": 1586800,
              "projectedOpexCents": 0,
              "scheduledCapexCents": 0,
              "netCents": 1586800,
              "cumulativeBalanceCents": 7934000,
              "capexItems": []
            },
            {
              "year": 2025,
              "month": 6,
              "isActual": false,
              "accruedIncomeCents": 1586800,
              "projectedOpexCents": 0,
              "scheduledCapexCents": 0,
              "netCents": 1586800,
              "cumulativeBalanceCents": 9520800,
              "capexItems": []
            },
            {
              "year": 2025,
              "month": 7,
              "isActual": false,
              "accruedIncomeCents": 1586800,
              "projectedOpexCents": 0,
              "scheduledCapexCents": 0,
              "netCents": 1586800,
              "cumulativeBalanceCents": 11107600,
              "capexItems": []
            },
            {
              "year": 2025,
              "month": 8,
              "isActual": false,
              "accruedIncomeCents": 1586800,
              "projectedOpexCents": 0,
              "scheduledCapexCents": 0,
              "netCents": 1586800,
              "cumulativeBalanceCents": 12694400,
              "capexItems": []
            },
            {
              "year": 2025,
              "month": 9,
              "isActual": false,
              "accruedIncomeCents": 1586800,
              "projectedOpexCents": 0,
              "scheduledCapexCents": 0,
              "netCents": 1586800,
              "cumulativeBalanceCents": 14281200,
              "capexItems": []
            },
            {
              "year": 2025,
              "month": 10,
              "isActual": false,
              "accruedIncomeCents": 1586800,
              "projectedOpexCents": 0,
              "scheduledCapexCents": 0,
              "netCents": 1586800,
              "cumulativeBalanceCents": 15868000,
              "capexItems": []
            },
            {
              "year": 2025,
              "month": 11,
              "isActual": false,
              "accruedIncomeCents": 1586800,
              "projectedOpexCents": 0,
              "scheduledCapexCents": 0,
              "netCents": 1586800,
              "cumulativeBalanceCents": 17454800,
              "capexItems": []
            },
            {
              "year": 2025,
              "month": 12,
              "isActual": false,
              "accruedIncomeCents": 1586800,
              "projectedOpexCents": 0,
              "scheduledCapexCents": 0,
              "netCents": 1586800,
              "cumulativeBalanceCents": 19041600,
              "capexItems": []
            },
            {
              "year": 2026,
              "month": 1,
              "isActual": true,
              "accruedIncomeCents": 0,
              "projectedOpexCents": 0,
              "scheduledCapexCents": 0,
              "netCents": 0,
              "cumulativeBalanceCents": 19041600,
              "capexItems": []
            },
            {
              "year": 2026,
              "month": 2,
              "isActual": false,
              "accruedIncomeCents": 1586800,
              "projectedOpexCents": 0,
              "scheduledCapexCents": 0,
              "netCents": 1586800,
              "cumulativeBalanceCents": 20628400,
              "capexItems": []
            },
            {
              "year": 2026,
              "month": 3,
              "isActual": false,
              "accruedIncomeCents": 1586800,
              "projectedOpexCents": 0,
              "scheduledCapexCents": 0,
              "netCents": 1586800,
              "cumulativeBalanceCents": 22215200,
              "capexItems": []
            },
            {
              "year": 2026,
              "month": 4,
              "isActual": true,
              "accruedIncomeCents": 0,
              "projectedOpexCents": 0,
              "scheduledCapexCents": 0,
              "netCents": 0,
              "cumulativeBalanceCents": 22215200,
              "capexItems": []
            },
            {
              "year": 2026,
              "month": 5,
              "isActual": false,
              "accruedIncomeCents": 1586800,
              "projectedOpexCents": 0,
              "scheduledCapexCents": 0,
              "netCents": 1586800,
              "cumulativeBalanceCents": 23802000,
              "capexItems": []
            },
            {
              "year": 2026,
              "month": 6,
              "isActual": false,
              "accruedIncomeCents": 1586800,
              "projectedOpexCents": 0,
              "scheduledCapexCents": 0,
              "netCents": 1586800,
              "cumulativeBalanceCents": 25388800,
              "capexItems": []
            },
            {
              "year": 2026,
              "month": 7,
              "isActual": true,
              "accruedIncomeCents": 0,
              "projectedOpexCents": 0,
              "scheduledCapexCents": 0,
              "netCents": 0,
              "cumulativeBalanceCents": 25388800,
              "capexItems": [
                {
                  "assetId": "dada94b5-2ae5-4989-8868-fccf5373a595",
                  "assetName": "Parquet flooring (mosaic)",
                  "estimatedCostCents": 350000,
                  "isOverridden": true,
                  "tradeGroup": "HVAC / electrical",
                  "bundleId": "2026-2027"
                },
                {
                  "assetId": "6e74af8a-594c-4269-87b6-096ae16270b6",
                  "assetName": "Boiler",
                  "estimatedCostCents": 750000,
                  "isOverridden": true,
                  "tradeGroup": "HVAC / electrical",
                  "bundleId": "2026-2027"
                }
              ]
            },
            {
              "year": 2026,
              "month": 8,
              "isActual": false,
              "accruedIncomeCents": 1586800,
              "projectedOpexCents": 0,
              "scheduledCapexCents": 0,
              "netCents": 1586800,
              "cumulativeBalanceCents": 26975600,
              "capexItems": []
            },
            {
              "year": 2026,
              "month": 9,
              "isActual": false,
              "accruedIncomeCents": 1586800,
              "projectedOpexCents": 0,
              "scheduledCapexCents": 0,
              "netCents": 1586800,
              "cumulativeBalanceCents": 28562400,
              "capexItems": []
            },
            {
              "year": 2026,
              "month": 10,
              "isActual": false,
              "accruedIncomeCents": 1588116,
              "projectedOpexCents": 0,
              "scheduledCapexCents": 0,
              "netCents": 1588116,
              "cumulativeBalanceCents": 30150516,
              "capexItems": []
            },
            {
              "year": 2026,
              "month": 11,
              "isActual": false,
              "accruedIncomeCents": 1589434,
              "projectedOpexCents": 0,
              "scheduledCapexCents": 0,
              "netCents": 1589434,
              "cumulativeBalanceCents": 31739950,
              "capexItems": []
            },
            {
              "year": 2026,
              "month": 12,
              "isActual": false,
              "accruedIncomeCents": 1590752,
              "projectedOpexCents": 0,
              "scheduledCapexCents": 0,
              "netCents": 1590752,
              "cumulativeBalanceCents": 33330702,
              "capexItems": []
            },
            {
              "year": 2027,
              "month": 1,
              "isActual": false,
              "accruedIncomeCents": 1592072,
              "projectedOpexCents": 0,
              "scheduledCapexCents": 0,
              "netCents": 1592072,
              "cumulativeBalanceCents": 34922774,
              "capexItems": []
            },
            {
              "year": 2027,
              "month": 2,
              "isActual": false,
              "accruedIncomeCents": 1593392,
              "projectedOpexCents": 0,
              "scheduledCapexCents": 0,
              "netCents": 1593392,
              "cumulativeBalanceCents": 36516166,
              "capexItems": []
            },
            {
              "year": 2027,
              "month": 3,
              "isActual": false,
              "accruedIncomeCents": 1594714,
              "projectedOpexCents": 0,
              "scheduledCapexCents": 0,
              "netCents": 1594714,
              "cumulativeBalanceCents": 38110880,
              "capexItems": []
            },
            {
              "year": 2027,
              "month": 4,
              "isActual": false,
              "accruedIncomeCents": 1596037,
              "projectedOpexCents": 0,
              "scheduledCapexCents": 0,
              "netCents": 1596037,
              "cumulativeBalanceCents": 39706917,
              "capexItems": []
            },
            {
              "year": 2027,
              "month": 5,
              "isActual": false,
              "accruedIncomeCents": 1597361,
              "projectedOpexCents": 0,
              "scheduledCapexCents": 0,
              "netCents": 1597361,
              "cumulativeBalanceCents": 41304278,
              "capexItems": []
            },
            {
              "year": 2027,
              "month": 6,
              "isActual": false,
              "accruedIncomeCents": 1598686,
              "projectedOpexCents": 0,
              "scheduledCapexCents": 0,
              "netCents": 1598686,
              "cumulativeBalanceCents": 42902964,
              "capexItems": []
            },
            {
              "year": 2027,
              "month": 7,
              "isActual": false,
              "accruedIncomeCents": 1600012,
              "projectedOpexCents": 0,
              "scheduledCapexCents": 330000,
              "netCents": 1270012,
              "cumulativeBalanceCents": 44172976,
              "capexItems": [
                {
                  "assetId": "6c634239-94ee-4688-b976-03d81ce89ec2",
                  "assetName": "Insulated windows (PVC/wood)",
                  "estimatedCostCents": 110000,
                  "isOverridden": true,
                  "tradeGroup": "HVAC / electrical",
                  "bundleId": "2026-2027"
                },
                {
                  "assetId": "e29c9d98-9f30-4e86-bfa0-38595f75afe3",
                  "assetName": "Wall paint (dispersion)",
                  "estimatedCostCents": 220000,
                  "isOverridden": false,
                  "tradeGroup": "HVAC / electrical",
                  "bundleId": "2027-2028"
                }
              ]
            },
            {
              "year": 2027,
              "month": 8,
              "isActual": false,
              "accruedIncomeCents": 1601340,
              "projectedOpexCents": 0,
              "scheduledCapexCents": 0,
              "netCents": 1601340,
              "cumulativeBalanceCents": 45774316,
              "capexItems": []
            },
            {
              "year": 2027,
              "month": 9,
              "isActual": false,
              "accruedIncomeCents": 1602668,
              "projectedOpexCents": 0,
              "scheduledCapexCents": 0,
              "netCents": 1602668,
              "cumulativeBalanceCents": 47376984,
              "capexItems": []
            },
            {
              "year": 2027,
              "month": 10,
              "isActual": false,
              "accruedIncomeCents": 1603997,
              "projectedOpexCents": 0,
              "scheduledCapexCents": 0,
              "netCents": 1603997,
              "cumulativeBalanceCents": 48980981,
              "capexItems": []
            },
            {
              "year": 2027,
              "month": 11,
              "isActual": false,
              "accruedIncomeCents": 1605328,
              "projectedOpexCents": 0,
              "scheduledCapexCents": 0,
              "netCents": 1605328,
              "cumulativeBalanceCents": 50586309,
              "capexItems": []
            },
            {
              "year": 2027,
              "month": 12,
              "isActual": false,
              "accruedIncomeCents": 1606660,
              "projectedOpexCents": 0,
              "scheduledCapexCents": 0,
              "netCents": 1606660,
              "cumulativeBalanceCents": 52192969,
              "capexItems": []
            },
            {
              "year": 2028,
              "month": 1,
              "isActual": false,
              "accruedIncomeCents": 1607993,
              "projectedOpexCents": 0,
              "scheduledCapexCents": 0,
              "netCents": 1607993,
              "cumulativeBalanceCents": 53800962,
              "capexItems": []
            },
            {
              "year": 2028,
              "month": 2,
              "isActual": false,
              "accruedIncomeCents": 1609326,
              "projectedOpexCents": 0,
              "scheduledCapexCents": 0,
              "netCents": 1609326,
              "cumulativeBalanceCents": 55410288,
              "capexItems": []
            },
            {
              "year": 2028,
              "month": 3,
              "isActual": false,
              "accruedIncomeCents": 1610661,
              "projectedOpexCents": 0,
              "scheduledCapexCents": 0,
              "netCents": 1610661,
              "cumulativeBalanceCents": 57020949,
              "capexItems": []
            },
            {
              "year": 2028,
              "month": 4,
              "isActual": false,
              "accruedIncomeCents": 1611998,
              "projectedOpexCents": 0,
              "scheduledCapexCents": 0,
              "netCents": 1611998,
              "cumulativeBalanceCents": 58632947,
              "capexItems": []
            },
            {
              "year": 2028,
              "month": 5,
              "isActual": false,
              "accruedIncomeCents": 1613335,
              "projectedOpexCents": 0,
              "scheduledCapexCents": 0,
              "netCents": 1613335,
              "cumulativeBalanceCents": 60246282,
              "capexItems": []
            },
            {
              "year": 2028,
              "month": 6,
              "isActual": false,
              "accruedIncomeCents": 1614673,
              "projectedOpexCents": 0,
              "scheduledCapexCents": 0,
              "netCents": 1614673,
              "cumulativeBalanceCents": 61860955,
              "capexItems": []
            },
            {
              "year": 2028,
              "month": 7,
              "isActual": false,
              "accruedIncomeCents": 1616012,
              "projectedOpexCents": 0,
              "scheduledCapexCents": 1641000,
              "netCents": -24988,
              "cumulativeBalanceCents": 61835967,
              "capexItems": [
                {
                  "assetId": "a40eef84-b8e4-44a9-957e-fa408f9da8de",
                  "assetName": "Kitchen cabinets (chipboard)",
                  "estimatedCostCents": 450000,
                  "isOverridden": true,
                  "tradeGroup": "HVAC / electrical",
                  "bundleId": "2026-2027"
                },
                {
                  "assetId": "50d1b281-b019-4f7e-bdaf-294af8355edc",
                  "assetName": "Kitchen cabinets (chipboard)",
                  "estimatedCostCents": 450000,
                  "isOverridden": false,
                  "tradeGroup": "Appliance technician",
                  "bundleId": "2028-2029"
                },
                {
                  "assetId": "9850ddb9-679f-44dc-9ac3-c696192ab7f2",
                  "assetName": "Roller shutters (plastic)",
                  "estimatedCostCents": 55000,
                  "isOverridden": false,
                  "tradeGroup": "Appliance technician",
                  "bundleId": "2028-2029"
                },
                {
                  "assetId": "29743c70-02ea-40f1-8a8c-f288eefd82f0",
                  "assetName": "Wall paint (dispersion)",
                  "estimatedCostCents": 220000,
                  "isOverridden": false,
                  "tradeGroup": "Appliance technician",
                  "bundleId": "2028-2029"
                },
                {
                  "assetId": "55f097f4-fcc6-4ca4-a643-58e2bb025b00",
                  "assetName": "Wall paint (dispersion)",
                  "estimatedCostCents": 220000,
                  "isOverridden": false,
                  "tradeGroup": "Appliance technician",
                  "bundleId": "2028-2029"
                },
                {
                  "assetId": "4731f5fb-707c-4cae-a81f-d497b47e202a",
                  "assetName": "Wall paint (dispersion)",
                  "estimatedCostCents": 220000,
                  "isOverridden": false,
                  "tradeGroup": "Appliance technician",
                  "bundleId": "2028-2029"
                },
                {
                  "assetId": "0581e949-581f-4a4a-ae0c-f7da89f0de3f",
                  "assetName": "Power sockets",
                  "estimatedCostCents": 13000,
                  "isOverridden": false,
                  "tradeGroup": "Appliance technician",
                  "bundleId": "2028-2029"
                },
                {
                  "assetId": "61216168-5e7e-431e-8cc7-3ba4d3b80073",
                  "assetName": "Power sockets",
                  "estimatedCostCents": 13000,
                  "isOverridden": false,
                  "tradeGroup": "Appliance technician",
                  "bundleId": "2028-2029"
                }
              ]
            },
            {
              "year": 2028,
              "month": 8,
              "isActual": false,
              "accruedIncomeCents": 1617353,
              "projectedOpexCents": 0,
              "scheduledCapexCents": 0,
              "netCents": 1617353,
              "cumulativeBalanceCents": 63453320,
              "capexItems": []
            },
            {
              "year": 2028,
              "month": 9,
              "isActual": false,
              "accruedIncomeCents": 1618695,
              "projectedOpexCents": 0,
              "scheduledCapexCents": 0,
              "netCents": 1618695,
              "cumulativeBalanceCents": 65072015,
              "capexItems": []
            },
            {
              "year": 2028,
              "month": 10,
              "isActual": false,
              "accruedIncomeCents": 1620037,
              "projectedOpexCents": 0,
              "scheduledCapexCents": 0,
              "netCents": 1620037,
              "cumulativeBalanceCents": 66692052,
              "capexItems": []
            },
            {
              "year": 2028,
              "month": 11,
              "isActual": false,
              "accruedIncomeCents": 1621381,
              "projectedOpexCents": 0,
              "scheduledCapexCents": 0,
              "netCents": 1621381,
              "cumulativeBalanceCents": 68313433,
              "capexItems": []
            },
            {
              "year": 2028,
              "month": 12,
              "isActual": false,
              "accruedIncomeCents": 1622726,
              "projectedOpexCents": 0,
              "scheduledCapexCents": 0,
              "netCents": 1622726,
              "cumulativeBalanceCents": 69936159,
              "capexItems": []
            },
            {
              "year": 2029,
              "month": 1,
              "isActual": false,
              "accruedIncomeCents": 1624072,
              "projectedOpexCents": 0,
              "scheduledCapexCents": 0,
              "netCents": 1624072,
              "cumulativeBalanceCents": 71560231,
              "capexItems": []
            },
            {
              "year": 2029,
              "month": 2,
              "isActual": false,
              "accruedIncomeCents": 1625420,
              "projectedOpexCents": 0,
              "scheduledCapexCents": 0,
              "netCents": 1625420,
              "cumulativeBalanceCents": 73185651,
              "capexItems": []
            },
            {
              "year": 2029,
              "month": 3,
              "isActual": false,
              "accruedIncomeCents": 1626768,
              "projectedOpexCents": 0,
              "scheduledCapexCents": 0,
              "netCents": 1626768,
              "cumulativeBalanceCents": 74812419,
              "capexItems": []
            },
            {
              "year": 2029,
              "month": 4,
              "isActual": false,
              "accruedIncomeCents": 1628117,
              "projectedOpexCents": 0,
              "scheduledCapexCents": 0,
              "netCents": 1628117,
              "cumulativeBalanceCents": 76440536,
              "capexItems": []
            },
            {
              "year": 2029,
              "month": 5,
              "isActual": false,
              "accruedIncomeCents": 1629468,
              "projectedOpexCents": 0,
              "scheduledCapexCents": 0,
              "netCents": 1629468,
              "cumulativeBalanceCents": 78070004,
              "capexItems": []
            },
            {
              "year": 2029,
              "month": 6,
              "isActual": false,
              "accruedIncomeCents": 1630820,
              "projectedOpexCents": 0,
              "scheduledCapexCents": 0,
              "netCents": 1630820,
              "cumulativeBalanceCents": 79700824,
              "capexItems": []
            },
            {
              "year": 2029,
              "month": 7,
              "isActual": false,
              "accruedIncomeCents": 1632173,
              "projectedOpexCents": 0,
              "scheduledCapexCents": 1687000,
              "netCents": -54827,
              "cumulativeBalanceCents": 79645997,
              "capexItems": [
                {
                  "assetId": "ee7ad1ba-b8c7-470e-a654-36d32bf3ab12",
                  "assetName": "Dryer (common)",
                  "estimatedCostCents": 110000,
                  "isOverridden": false,
                  "tradeGroup": "Appliance technician",
                  "bundleId": "2029-2030"
                },
                {
                  "assetId": "bac575dc-2bff-432a-8f72-535b77cccadc",
                  "assetName": "Bathroom tap",
                  "estimatedCostCents": 40000,
                  "isOverridden": false,
                  "tradeGroup": "Appliance technician",
                  "bundleId": "2029-2030"
                },
                {
                  "assetId": "91b041f9-cd2c-408a-a929-94a53c03f89f",
                  "assetName": "Bathroom tap",
                  "estimatedCostCents": 40000,
                  "isOverridden": false,
                  "tradeGroup": "Appliance technician",
                  "bundleId": "2029-2030"
                },
                {
                  "assetId": "c7cf90f2-0c6c-43d9-9b62-02ee6049b2e0",
                  "assetName": "Kitchen worktop (synthetic)",
                  "estimatedCostCents": 120000,
                  "isOverridden": false,
                  "tradeGroup": "Appliance technician",
                  "bundleId": "2029-2030"
                },
                {
                  "assetId": "50d4329b-50c3-48cf-b25f-28f1d397a119",
                  "assetName": "Kitchen worktop (synthetic)",
                  "estimatedCostCents": 120000,
                  "isOverridden": false,
                  "tradeGroup": "Appliance technician",
                  "bundleId": "2029-2030"
                },
                {
                  "assetId": "cdcd4dd1-604c-4dce-a25d-fd25c2cb8c0e",
                  "assetName": "Kitchen worktop (synthetic)",
                  "estimatedCostCents": 120000,
                  "isOverridden": false,
                  "tradeGroup": "Appliance technician",
                  "bundleId": "2029-2030"
                },
                {
                  "assetId": "45ed30a9-f059-4cb0-9e2f-bfad84b311f9",
                  "assetName": "Interior doors (chipboard)",
                  "estimatedCostCents": 45000,
                  "isOverridden": false,
                  "tradeGroup": "Appliance technician",
                  "bundleId": "2029-2030"
                },
                {
                  "assetId": "75ea3a4e-602e-4d2a-912b-30d8f583847b",
                  "assetName": "Kitchen cabinets (chipboard)",
                  "estimatedCostCents": 450000,
                  "isOverridden": false,
                  "tradeGroup": "Appliance technician",
                  "bundleId": "2029-2030"
                },
                {
                  "assetId": "dc4ce34d-f394-4d4d-b771-a7b0baafca8d",
                  "assetName": "Kitchen tap",
                  "estimatedCostCents": 40000,
                  "isOverridden": false,
                  "tradeGroup": "Appliance technician",
                  "bundleId": "2029-2030"
                },
                {
                  "assetId": "02c95df5-f3c1-4072-b96a-6bcbcd0dc684",
                  "assetName": "Roller shutters (plastic)",
                  "estimatedCostCents": 55000,
                  "isOverridden": false,
                  "tradeGroup": "Appliance technician",
                  "bundleId": "2029-2030"
                },
                {
                  "assetId": "1ea4efad-c1d6-4940-affa-396bc494babd",
                  "assetName": "Wall paint (dispersion)",
                  "estimatedCostCents": 220000,
                  "isOverridden": false,
                  "tradeGroup": "Appliance technician",
                  "bundleId": "2029-2030"
                },
                {
                  "assetId": "f84df345-6ab0-4b68-ab3d-83b2d442c259",
                  "assetName": "Intercom system",
                  "estimatedCostCents": 300000,
                  "isOverridden": false,
                  "tradeGroup": "Appliance technician",
                  "bundleId": "2029-2030"
                },
                {
                  "assetId": "33e4f919-5713-41cf-a138-ce49e9977bf2",
                  "assetName": "Power sockets",
                  "estimatedCostCents": 13000,
                  "isOverridden": false,
                  "tradeGroup": "Appliance technician",
                  "bundleId": "2029-2030"
                },
                {
                  "assetId": "ac41b933-be89-48e0-82a3-ee702f81d509",
                  "assetName": "Light switches",
                  "estimatedCostCents": 7000,
                  "isOverridden": false,
                  "tradeGroup": "Appliance technician",
                  "bundleId": "2029-2030"
                },
                {
                  "assetId": "b6111e02-6a28-4a94-bbfa-227b79f1e24a",
                  "assetName": "Light switches",
                  "estimatedCostCents": 7000,
                  "isOverridden": false,
                  "tradeGroup": "Appliance technician",
                  "bundleId": "2029-2030"
                }
              ]
            },
            {
              "year": 2029,
              "month": 8,
              "isActual": false,
              "accruedIncomeCents": 1633527,
              "projectedOpexCents": 0,
              "scheduledCapexCents": 0,
              "netCents": 1633527,
              "cumulativeBalanceCents": 81279524,
              "capexItems": []
            },
            {
              "year": 2029,
              "month": 9,
              "isActual": false,
              "accruedIncomeCents": 1634882,
              "projectedOpexCents": 0,
              "scheduledCapexCents": 0,
              "netCents": 1634882,
              "cumulativeBalanceCents": 82914406,
              "capexItems": []
            },
            {
              "year": 2029,
              "month": 10,
              "isActual": false,
              "accruedIncomeCents": 1636238,
              "projectedOpexCents": 0,
              "scheduledCapexCents": 0,
              "netCents": 1636238,
              "cumulativeBalanceCents": 84550644,
              "capexItems": []
            },
            {
              "year": 2029,
              "month": 11,
              "isActual": false,
              "accruedIncomeCents": 1637595,
              "projectedOpexCents": 0,
              "scheduledCapexCents": 0,
              "netCents": 1637595,
              "cumulativeBalanceCents": 86188239,
              "capexItems": []
            },
            {
              "year": 2029,
              "month": 12,
              "isActual": false,
              "accruedIncomeCents": 1638954,
              "projectedOpexCents": 0,
              "scheduledCapexCents": 0,
              "netCents": 1638954,
              "cumulativeBalanceCents": 87827193,
              "capexItems": []
            },
            {
              "year": 2030,
              "month": 1,
              "isActual": false,
              "accruedIncomeCents": 1640313,
              "projectedOpexCents": 0,
              "scheduledCapexCents": 0,
              "netCents": 1640313,
              "cumulativeBalanceCents": 89467506,
              "capexItems": []
            },
            {
              "year": 2030,
              "month": 2,
              "isActual": false,
              "accruedIncomeCents": 1641674,
              "projectedOpexCents": 0,
              "scheduledCapexCents": 0,
              "netCents": 1641674,
              "cumulativeBalanceCents": 91109180,
              "capexItems": []
            },
            {
              "year": 2030,
              "month": 3,
              "isActual": false,
              "accruedIncomeCents": 1643036,
              "projectedOpexCents": 0,
              "scheduledCapexCents": 0,
              "netCents": 1643036,
              "cumulativeBalanceCents": 92752216,
              "capexItems": []
            },
            {
              "year": 2030,
              "month": 4,
              "isActual": false,
              "accruedIncomeCents": 1644399,
              "projectedOpexCents": 0,
              "scheduledCapexCents": 0,
              "netCents": 1644399,
              "cumulativeBalanceCents": 94396615,
              "capexItems": []
            },
            {
              "year": 2030,
              "month": 5,
              "isActual": false,
              "accruedIncomeCents": 1645763,
              "projectedOpexCents": 0,
              "scheduledCapexCents": 0,
              "netCents": 1645763,
              "cumulativeBalanceCents": 96042378,
              "capexItems": []
            },
            {
              "year": 2030,
              "month": 6,
              "isActual": false,
              "accruedIncomeCents": 1647128,
              "projectedOpexCents": 0,
              "scheduledCapexCents": 0,
              "netCents": 1647128,
              "cumulativeBalanceCents": 97689506,
              "capexItems": []
            },
            {
              "year": 2030,
              "month": 7,
              "isActual": false,
              "accruedIncomeCents": 1648494,
              "projectedOpexCents": 0,
              "scheduledCapexCents": 1343000,
              "netCents": 305494,
              "cumulativeBalanceCents": 97995000,
              "capexItems": [
                {
                  "assetId": "597b7d69-524b-44a5-9993-b5888438b8bf",
                  "assetName": "Bathroom tap",
                  "estimatedCostCents": 40000,
                  "isOverridden": false,
                  "tradeGroup": "HVAC / electrical",
                  "bundleId": "2030-2031"
                },
                {
                  "assetId": "87fa03d4-bcde-4366-8042-93d7435bbe1d",
                  "assetName": "Bathroom tap",
                  "estimatedCostCents": 40000,
                  "isOverridden": false,
                  "tradeGroup": "HVAC / electrical",
                  "bundleId": "2030-2031"
                },
                {
                  "assetId": "6eb046ea-15c7-4bea-94a5-edf1298e0efd",
                  "assetName": "Kitchen cabinets (chipboard)",
                  "estimatedCostCents": 450000,
                  "isOverridden": false,
                  "tradeGroup": "HVAC / electrical",
                  "bundleId": "2030-2031"
                },
                {
                  "assetId": "e4275079-9010-446e-91dd-f7a61e8157fb",
                  "assetName": "Kitchen tap",
                  "estimatedCostCents": 40000,
                  "isOverridden": false,
                  "tradeGroup": "HVAC / electrical",
                  "bundleId": "2030-2031"
                },
                {
                  "assetId": "41d16db4-e57d-40a5-b27b-eec76be78f29",
                  "assetName": "Roller shutters (plastic)",
                  "estimatedCostCents": 55000,
                  "isOverridden": false,
                  "tradeGroup": "HVAC / electrical",
                  "bundleId": "2030-2031"
                },
                {
                  "assetId": "82fe8641-7a63-4de3-a70c-14152b2e9fe7",
                  "assetName": "Roller shutters (plastic)",
                  "estimatedCostCents": 55000,
                  "isOverridden": false,
                  "tradeGroup": "HVAC / electrical",
                  "bundleId": "2030-2031"
                },
                {
                  "assetId": "c4703d94-22ec-4085-911e-91a7b48404e1",
                  "assetName": "Wall paint (dispersion)",
                  "estimatedCostCents": 220000,
                  "isOverridden": false,
                  "tradeGroup": "HVAC / electrical",
                  "bundleId": "2030-2031"
                },
                {
                  "assetId": "5507bf64-2452-464a-8ff5-717a1d392cf5",
                  "assetName": "Circulation pump",
                  "estimatedCostCents": 110000,
                  "isOverridden": false,
                  "tradeGroup": "HVAC / electrical",
                  "bundleId": "2030-2031"
                },
                {
                  "assetId": "757a8b3e-444d-4aa4-8360-8ac86c12377d",
                  "assetName": "Heating control",
                  "estimatedCostCents": 320000,
                  "isOverridden": false,
                  "tradeGroup": "HVAC / electrical",
                  "bundleId": "2030-2031"
                },
                {
                  "assetId": "a3f412c3-d042-423e-b3cb-5838c784d157",
                  "assetName": "Power sockets",
                  "estimatedCostCents": 13000,
                  "isOverridden": false,
                  "tradeGroup": "HVAC / electrical",
                  "bundleId": "2030-2031"
                }
              ]
            },
            {
              "year": 2030,
              "month": 8,
              "isActual": false,
              "accruedIncomeCents": 1649862,
              "projectedOpexCents": 0,
              "scheduledCapexCents": 0,
              "netCents": 1649862,
              "cumulativeBalanceCents": 99644862,
              "capexItems": []
            },
            {
              "year": 2030,
              "month": 9,
              "isActual": false,
              "accruedIncomeCents": 1651230,
              "projectedOpexCents": 0,
              "scheduledCapexCents": 0,
              "netCents": 1651230,
              "cumulativeBalanceCents": 101296092,
              "capexItems": []
            },
            {
              "year": 2030,
              "month": 10,
              "isActual": false,
              "accruedIncomeCents": 1652600,
              "projectedOpexCents": 0,
              "scheduledCapexCents": 0,
              "netCents": 1652600,
              "cumulativeBalanceCents": 102948692,
              "capexItems": []
            },
            {
              "year": 2030,
              "month": 11,
              "isActual": false,
              "accruedIncomeCents": 1653971,
              "projectedOpexCents": 0,
              "scheduledCapexCents": 0,
              "netCents": 1653971,
              "cumulativeBalanceCents": 104602663,
              "capexItems": []
            },
            {
              "year": 2030,
              "month": 12,
              "isActual": false,
              "accruedIncomeCents": 1655343,
              "projectedOpexCents": 0,
              "scheduledCapexCents": 0,
              "netCents": 1655343,
              "cumulativeBalanceCents": 106258006,
              "capexItems": []
            },
            {
              "year": 2031,
              "month": 1,
              "isActual": false,
              "accruedIncomeCents": 1656716,
              "projectedOpexCents": 0,
              "scheduledCapexCents": 0,
              "netCents": 1656716,
              "cumulativeBalanceCents": 107914722,
              "capexItems": []
            },
            {
              "year": 2031,
              "month": 2,
              "isActual": false,
              "accruedIncomeCents": 1658091,
              "projectedOpexCents": 0,
              "scheduledCapexCents": 0,
              "netCents": 1658091,
              "cumulativeBalanceCents": 109572813,
              "capexItems": []
            },
            {
              "year": 2031,
              "month": 3,
              "isActual": false,
              "accruedIncomeCents": 1659466,
              "projectedOpexCents": 0,
              "scheduledCapexCents": 0,
              "netCents": 1659466,
              "cumulativeBalanceCents": 111232279,
              "capexItems": []
            },
            {
              "year": 2031,
              "month": 4,
              "isActual": false,
              "accruedIncomeCents": 1660843,
              "projectedOpexCents": 0,
              "scheduledCapexCents": 0,
              "netCents": 1660843,
              "cumulativeBalanceCents": 112893122,
              "capexItems": []
            },
            {
              "year": 2031,
              "month": 5,
              "isActual": false,
              "accruedIncomeCents": 1662220,
              "projectedOpexCents": 0,
              "scheduledCapexCents": 0,
              "netCents": 1662220,
              "cumulativeBalanceCents": 114555342,
              "capexItems": []
            },
            {
              "year": 2031,
              "month": 6,
              "isActual": false,
              "accruedIncomeCents": 1663599,
              "projectedOpexCents": 0,
              "scheduledCapexCents": 0,
              "netCents": 1663599,
              "cumulativeBalanceCents": 116218941,
              "capexItems": []
            },
            {
              "year": 2031,
              "month": 7,
              "isActual": false,
              "accruedIncomeCents": 1664979,
              "projectedOpexCents": 0,
              "scheduledCapexCents": 795000,
              "netCents": 869979,
              "cumulativeBalanceCents": 117088920,
              "capexItems": [
                {
                  "assetId": "ca58ae14-5da2-4143-ac28-6facf4dd5e0f",
                  "assetName": "Balcony railing (metal)",
                  "estimatedCostCents": 80000,
                  "isOverridden": false,
                  "tradeGroup": "HVAC / electrical",
                  "bundleId": "2031-2032"
                },
                {
                  "assetId": "08fcba5d-ce14-4a56-a79d-a0b8162d88ba",
                  "assetName": "Bathroom tap",
                  "estimatedCostCents": 40000,
                  "isOverridden": false,
                  "tradeGroup": "HVAC / electrical",
                  "bundleId": "2031-2032"
                },
                {
                  "assetId": "9a85dc6c-88c1-4fbe-bf56-603a60abf0a7",
                  "assetName": "Bathtub (acrylic)",
                  "estimatedCostCents": 90000,
                  "isOverridden": false,
                  "tradeGroup": "HVAC / electrical",
                  "bundleId": "2031-2032"
                },
                {
                  "assetId": "5deed3d2-85f9-4338-89ed-c47dbefce005",
                  "assetName": "Bathtub (acrylic)",
                  "estimatedCostCents": 90000,
                  "isOverridden": false,
                  "tradeGroup": "HVAC / electrical",
                  "bundleId": "2031-2032"
                },
                {
                  "assetId": "f77ae1ad-4ce9-4a8a-8163-02f139db7763",
                  "assetName": "Interior doors (chipboard)",
                  "estimatedCostCents": 45000,
                  "isOverridden": false,
                  "tradeGroup": "HVAC / electrical",
                  "bundleId": "2031-2032"
                },
                {
                  "assetId": "58733997-0f0a-43e6-96e0-493710dfc4ba",
                  "assetName": "Sanitary ceramics (WC/basin)",
                  "estimatedCostCents": 120000,
                  "isOverridden": false,
                  "tradeGroup": "HVAC / electrical",
                  "bundleId": "2031-2032"
                },
                {
                  "assetId": "dc7ed960-a649-4727-9652-c847277e5cff",
                  "assetName": "Insulated windows (PVC/wood)",
                  "estimatedCostCents": 110000,
                  "isOverridden": false,
                  "tradeGroup": "HVAC / electrical",
                  "bundleId": "2031-2032"
                },
                {
                  "assetId": "2e9fbb78-1b17-42cb-b283-1c49f74dfb1a",
                  "assetName": "Bathroom tiles (ceramic)",
                  "estimatedCostCents": 220000,
                  "isOverridden": false,
                  "tradeGroup": "HVAC / electrical",
                  "bundleId": "2031-2032"
                }
              ]
            },
            {
              "year": 2031,
              "month": 8,
              "isActual": false,
              "accruedIncomeCents": 1666360,
              "projectedOpexCents": 0,
              "scheduledCapexCents": 0,
              "netCents": 1666360,
              "cumulativeBalanceCents": 118755280,
              "capexItems": []
            },
            {
              "year": 2031,
              "month": 9,
              "isActual": false,
              "accruedIncomeCents": 1667743,
              "projectedOpexCents": 0,
              "scheduledCapexCents": 0,
              "netCents": 1667743,
              "cumulativeBalanceCents": 120423023,
              "capexItems": []
            },
            {
              "year": 2031,
              "month": 10,
              "isActual": false,
              "accruedIncomeCents": 1669126,
              "projectedOpexCents": 0,
              "scheduledCapexCents": 0,
              "netCents": 1669126,
              "cumulativeBalanceCents": 122092149,
              "capexItems": []
            },
            {
              "year": 2031,
              "month": 11,
              "isActual": false,
              "accruedIncomeCents": 1670511,
              "projectedOpexCents": 0,
              "scheduledCapexCents": 0,
              "netCents": 1670511,
              "cumulativeBalanceCents": 123762660,
              "capexItems": []
            },
            {
              "year": 2031,
              "month": 12,
              "isActual": false,
              "accruedIncomeCents": 1671897,
              "projectedOpexCents": 0,
              "scheduledCapexCents": 0,
              "netCents": 1671897,
              "cumulativeBalanceCents": 125434557,
              "capexItems": []
            },
            {
              "year": 2032,
              "month": 1,
              "isActual": false,
              "accruedIncomeCents": 1673283,
              "projectedOpexCents": 0,
              "scheduledCapexCents": 0,
              "netCents": 1673283,
              "cumulativeBalanceCents": 127107840,
              "capexItems": []
            },
            {
              "year": 2032,
              "month": 2,
              "isActual": false,
              "accruedIncomeCents": 1674672,
              "projectedOpexCents": 0,
              "scheduledCapexCents": 0,
              "netCents": 1674672,
              "cumulativeBalanceCents": 128782512,
              "capexItems": []
            },
            {
              "year": 2032,
              "month": 3,
              "isActual": false,
              "accruedIncomeCents": 1676061,
              "projectedOpexCents": 0,
              "scheduledCapexCents": 0,
              "netCents": 1676061,
              "cumulativeBalanceCents": 130458573,
              "capexItems": []
            },
            {
              "year": 2032,
              "month": 4,
              "isActual": false,
              "accruedIncomeCents": 1677451,
              "projectedOpexCents": 0,
              "scheduledCapexCents": 0,
              "netCents": 1677451,
              "cumulativeBalanceCents": 132136024,
              "capexItems": []
            },
            {
              "year": 2032,
              "month": 5,
              "isActual": false,
              "accruedIncomeCents": 1678843,
              "projectedOpexCents": 0,
              "scheduledCapexCents": 0,
              "netCents": 1678843,
              "cumulativeBalanceCents": 133814867,
              "capexItems": []
            },
            {
              "year": 2032,
              "month": 6,
              "isActual": false,
              "accruedIncomeCents": 1680235,
              "projectedOpexCents": 0,
              "scheduledCapexCents": 0,
              "netCents": 1680235,
              "cumulativeBalanceCents": 135495102,
              "capexItems": []
            },
            {
              "year": 2032,
              "month": 7,
              "isActual": false,
              "accruedIncomeCents": 1681629,
              "projectedOpexCents": 0,
              "scheduledCapexCents": 12097000,
              "netCents": -10415371,
              "cumulativeBalanceCents": 125079731,
              "capexItems": [
                {
                  "assetId": "f3bbaccd-5ff8-46ac-93ca-4d13471c4786",
                  "assetName": "Balcony railing (metal)",
                  "estimatedCostCents": 80000,
                  "isOverridden": false,
                  "tradeGroup": "Appliance technician",
                  "bundleId": "2032-2033"
                },
                {
                  "assetId": "f7040c38-9a3a-44d4-a62d-2617c7cce8e7",
                  "assetName": "Kitchen tap",
                  "estimatedCostCents": 40000,
                  "isOverridden": false,
                  "tradeGroup": "Appliance technician",
                  "bundleId": "2032-2033"
                },
                {
                  "assetId": "f835d7c4-588f-4095-86ae-1d20f6115a1f",
                  "assetName": "Kitchen tap",
                  "estimatedCostCents": 40000,
                  "isOverridden": false,
                  "tradeGroup": "Appliance technician",
                  "bundleId": "2032-2033"
                },
                {
                  "assetId": "792f3563-0ea1-453b-b6a5-5833772b99c6",
                  "assetName": "Insulated windows (PVC/wood)",
                  "estimatedCostCents": 110000,
                  "isOverridden": false,
                  "tradeGroup": "Appliance technician",
                  "bundleId": "2032-2033"
                },
                {
                  "assetId": "6d7aaa72-8631-4b77-8bf8-7c7feaccaa85",
                  "assetName": "Bathroom tiles (ceramic)",
                  "estimatedCostCents": 220000,
                  "isOverridden": false,
                  "tradeGroup": "Appliance technician",
                  "bundleId": "2032-2033"
                },
                {
                  "assetId": "347394e1-bdaa-4774-8845-60fd14753ade",
                  "assetName": "Kitchen tiles (ceramic)",
                  "estimatedCostCents": 160000,
                  "isOverridden": false,
                  "tradeGroup": "Appliance technician",
                  "bundleId": "2032-2033"
                },
                {
                  "assetId": "09f5897d-1e6c-4675-8294-c8972adb606a",
                  "assetName": "Wall paint (dispersion)",
                  "estimatedCostCents": 220000,
                  "isOverridden": false,
                  "tradeGroup": "Appliance technician",
                  "bundleId": "2032-2033"
                },
                {
                  "assetId": "c6dcc11a-93d5-4762-851e-b4599cda01a4",
                  "assetName": "Wall paint (dispersion)",
                  "estimatedCostCents": 220000,
                  "isOverridden": false,
                  "tradeGroup": "Appliance technician",
                  "bundleId": "2032-2033"
                },
                {
                  "assetId": "7903953a-35b0-434d-bae7-f7ab917224bc",
                  "assetName": "Elevator",
                  "estimatedCostCents": 11000000,
                  "isOverridden": false,
                  "tradeGroup": "Appliance technician",
                  "bundleId": "2032-2033"
                },
                {
                  "assetId": "89da908b-ca65-4443-afa0-574310115f7d",
                  "assetName": "Light switches",
                  "estimatedCostCents": 7000,
                  "isOverridden": false,
                  "tradeGroup": "Appliance technician",
                  "bundleId": "2032-2033"
                }
              ]
            },
            {
              "year": 2032,
              "month": 8,
              "isActual": false,
              "accruedIncomeCents": 1683024,
              "projectedOpexCents": 0,
              "scheduledCapexCents": 0,
              "netCents": 1683024,
              "cumulativeBalanceCents": 126762755,
              "capexItems": []
            },
            {
              "year": 2032,
              "month": 9,
              "isActual": false,
              "accruedIncomeCents": 1684420,
              "projectedOpexCents": 0,
              "scheduledCapexCents": 0,
              "netCents": 1684420,
              "cumulativeBalanceCents": 128447175,
              "capexItems": []
            },
            {
              "year": 2032,
              "month": 10,
              "isActual": false,
              "accruedIncomeCents": 1685817,
              "projectedOpexCents": 0,
              "scheduledCapexCents": 0,
              "netCents": 1685817,
              "cumulativeBalanceCents": 130132992,
              "capexItems": []
            },
            {
              "year": 2032,
              "month": 11,
              "isActual": false,
              "accruedIncomeCents": 1687216,
              "projectedOpexCents": 0,
              "scheduledCapexCents": 0,
              "netCents": 1687216,
              "cumulativeBalanceCents": 131820208,
              "capexItems": []
            },
            {
              "year": 2032,
              "month": 12,
              "isActual": false,
              "accruedIncomeCents": 1688616,
              "projectedOpexCents": 0,
              "scheduledCapexCents": 0,
              "netCents": 1688616,
              "cumulativeBalanceCents": 133508824,
              "capexItems": []
            },
            {
              "year": 2033,
              "month": 1,
              "isActual": false,
              "accruedIncomeCents": 1690016,
              "projectedOpexCents": 0,
              "scheduledCapexCents": 0,
              "netCents": 1690016,
              "cumulativeBalanceCents": 135198840,
              "capexItems": []
            },
            {
              "year": 2033,
              "month": 2,
              "isActual": false,
              "accruedIncomeCents": 1691418,
              "projectedOpexCents": 0,
              "scheduledCapexCents": 0,
              "netCents": 1691418,
              "cumulativeBalanceCents": 136890258,
              "capexItems": []
            },
            {
              "year": 2033,
              "month": 3,
              "isActual": false,
              "accruedIncomeCents": 1692821,
              "projectedOpexCents": 0,
              "scheduledCapexCents": 0,
              "netCents": 1692821,
              "cumulativeBalanceCents": 138583079,
              "capexItems": []
            },
            {
              "year": 2033,
              "month": 4,
              "isActual": false,
              "accruedIncomeCents": 1694226,
              "projectedOpexCents": 0,
              "scheduledCapexCents": 0,
              "netCents": 1694226,
              "cumulativeBalanceCents": 140277305,
              "capexItems": []
            },
            {
              "year": 2033,
              "month": 5,
              "isActual": false,
              "accruedIncomeCents": 1695631,
              "projectedOpexCents": 0,
              "scheduledCapexCents": 0,
              "netCents": 1695631,
              "cumulativeBalanceCents": 141972936,
              "capexItems": []
            },
            {
              "year": 2033,
              "month": 6,
              "isActual": false,
              "accruedIncomeCents": 1697038,
              "projectedOpexCents": 0,
              "scheduledCapexCents": 0,
              "netCents": 1697038,
              "cumulativeBalanceCents": 143669974,
              "capexItems": []
            },
            {
              "year": 2033,
              "month": 7,
              "isActual": false,
              "accruedIncomeCents": 1698445,
              "projectedOpexCents": 0,
              "scheduledCapexCents": 1303000,
              "netCents": 395445,
              "cumulativeBalanceCents": 144065419,
              "capexItems": [
                {
                  "assetId": "47a744d8-eedc-46d6-bf90-d32c7d072088",
                  "assetName": "Washing machine (common)",
                  "estimatedCostCents": 110000,
                  "isOverridden": false,
                  "tradeGroup": "Appliance technician",
                  "bundleId": "2033-2034"
                },
                {
                  "assetId": "15bddbbb-3b21-4889-afdd-faad0b69445b",
                  "assetName": "Balcony railing (metal)",
                  "estimatedCostCents": 80000,
                  "isOverridden": false,
                  "tradeGroup": "Appliance technician",
                  "bundleId": "2033-2034"
                },
                {
                  "assetId": "0bf59d2d-31b7-450c-a0dc-d955e1845461",
                  "assetName": "Bathtub (acrylic)",
                  "estimatedCostCents": 90000,
                  "isOverridden": false,
                  "tradeGroup": "Appliance technician",
                  "bundleId": "2033-2034"
                },
                {
                  "assetId": "c6196a49-fe91-4971-b736-975b1f19d95b",
                  "assetName": "Kitchen cabinets (chipboard)",
                  "estimatedCostCents": 450000,
                  "isOverridden": false,
                  "tradeGroup": "Appliance technician",
                  "bundleId": "2033-2034"
                },
                {
                  "assetId": "3a7024af-7bc7-4ec1-abf3-adb5741758a1",
                  "assetName": "Insulated windows (PVC/wood)",
                  "estimatedCostCents": 110000,
                  "isOverridden": false,
                  "tradeGroup": "Appliance technician",
                  "bundleId": "2033-2034"
                },
                {
                  "assetId": "96a56bb1-5085-4a5c-9df1-a3af9fb2c26a",
                  "assetName": "Balcony (metal)",
                  "estimatedCostCents": 450000,
                  "isOverridden": false,
                  "tradeGroup": "Appliance technician",
                  "bundleId": "2033-2034"
                },
                {
                  "assetId": "09dbd4ab-5691-4722-a7ee-75f09474c5ff",
                  "assetName": "Power sockets",
                  "estimatedCostCents": 13000,
                  "isOverridden": false,
                  "tradeGroup": "Appliance technician",
                  "bundleId": "2033-2034"
                }
              ]
            },
            {
              "year": 2033,
              "month": 8,
              "isActual": false,
              "accruedIncomeCents": 1699854,
              "projectedOpexCents": 0,
              "scheduledCapexCents": 0,
              "netCents": 1699854,
              "cumulativeBalanceCents": 145765273,
              "capexItems": []
            },
            {
              "year": 2033,
              "month": 9,
              "isActual": false,
              "accruedIncomeCents": 1701264,
              "projectedOpexCents": 0,
              "scheduledCapexCents": 0,
              "netCents": 1701264,
              "cumulativeBalanceCents": 147466537,
              "capexItems": []
            },
            {
              "year": 2033,
              "month": 10,
              "isActual": false,
              "accruedIncomeCents": 1702676,
              "projectedOpexCents": 0,
              "scheduledCapexCents": 0,
              "netCents": 1702676,
              "cumulativeBalanceCents": 149169213,
              "capexItems": []
            },
            {
              "year": 2033,
              "month": 11,
              "isActual": false,
              "accruedIncomeCents": 1704088,
              "projectedOpexCents": 0,
              "scheduledCapexCents": 0,
              "netCents": 1704088,
              "cumulativeBalanceCents": 150873301,
              "capexItems": []
            },
            {
              "year": 2033,
              "month": 12,
              "isActual": false,
              "accruedIncomeCents": 1705502,
              "projectedOpexCents": 0,
              "scheduledCapexCents": 0,
              "netCents": 1705502,
              "cumulativeBalanceCents": 152578803,
              "capexItems": []
            },
            {
              "year": 2034,
              "month": 1,
              "isActual": false,
              "accruedIncomeCents": 1706916,
              "projectedOpexCents": 0,
              "scheduledCapexCents": 0,
              "netCents": 1706916,
              "cumulativeBalanceCents": 154285719,
              "capexItems": []
            },
            {
              "year": 2034,
              "month": 2,
              "isActual": false,
              "accruedIncomeCents": 1708332,
              "projectedOpexCents": 0,
              "scheduledCapexCents": 0,
              "netCents": 1708332,
              "cumulativeBalanceCents": 155994051,
              "capexItems": []
            },
            {
              "year": 2034,
              "month": 3,
              "isActual": false,
              "accruedIncomeCents": 1709750,
              "projectedOpexCents": 0,
              "scheduledCapexCents": 0,
              "netCents": 1709750,
              "cumulativeBalanceCents": 157703801,
              "capexItems": []
            },
            {
              "year": 2034,
              "month": 4,
              "isActual": false,
              "accruedIncomeCents": 1711168,
              "projectedOpexCents": 0,
              "scheduledCapexCents": 0,
              "netCents": 1711168,
              "cumulativeBalanceCents": 159414969,
              "capexItems": []
            },
            {
              "year": 2034,
              "month": 5,
              "isActual": false,
              "accruedIncomeCents": 1712587,
              "projectedOpexCents": 0,
              "scheduledCapexCents": 0,
              "netCents": 1712587,
              "cumulativeBalanceCents": 161127556,
              "capexItems": []
            },
            {
              "year": 2034,
              "month": 6,
              "isActual": false,
              "accruedIncomeCents": 1714008,
              "projectedOpexCents": 0,
              "scheduledCapexCents": 0,
              "netCents": 1714008,
              "cumulativeBalanceCents": 162841564,
              "capexItems": []
            },
            {
              "year": 2034,
              "month": 7,
              "isActual": false,
              "accruedIncomeCents": 1715430,
              "projectedOpexCents": 0,
              "scheduledCapexCents": 912000,
              "netCents": 803430,
              "cumulativeBalanceCents": 163644994,
              "capexItems": [
                {
                  "assetId": "a3ae7efb-bb6d-4ac7-87e0-9780a24736f9",
                  "assetName": "Balcony railing (metal)",
                  "estimatedCostCents": 80000,
                  "isOverridden": false,
                  "tradeGroup": "General contractor",
                  "bundleId": "2034-2035"
                },
                {
                  "assetId": "61aec5e4-c435-4f59-9412-12187aa27cd4",
                  "assetName": "Kitchen worktop (synthetic)",
                  "estimatedCostCents": 120000,
                  "isOverridden": false,
                  "tradeGroup": "General contractor",
                  "bundleId": "2034-2035"
                },
                {
                  "assetId": "4be8e003-10fc-4639-b391-3f556e49b74d",
                  "assetName": "Kitchen cabinets (chipboard)",
                  "estimatedCostCents": 450000,
                  "isOverridden": false,
                  "tradeGroup": "General contractor",
                  "bundleId": "2034-2035"
                },
                {
                  "assetId": "38337095-571a-4f21-81c8-53b8f7ae2e92",
                  "assetName": "Kitchen tap",
                  "estimatedCostCents": 40000,
                  "isOverridden": false,
                  "tradeGroup": "General contractor",
                  "bundleId": "2034-2035"
                },
                {
                  "assetId": "77fc672b-4f86-4e73-ac2f-8ed4cb6ef9ca",
                  "assetName": "Roller shutters (plastic)",
                  "estimatedCostCents": 55000,
                  "isOverridden": false,
                  "tradeGroup": "General contractor",
                  "bundleId": "2034-2035"
                },
                {
                  "assetId": "3f1a28ca-2d61-4f95-a3b4-9508beb16d9b",
                  "assetName": "Kitchen tiles (ceramic)",
                  "estimatedCostCents": 160000,
                  "isOverridden": false,
                  "tradeGroup": "General contractor",
                  "bundleId": "2034-2035"
                },
                {
                  "assetId": "688db0f8-affb-473c-9b3d-1dd5feecea64",
                  "assetName": "Light switches",
                  "estimatedCostCents": 7000,
                  "isOverridden": false,
                  "tradeGroup": "General contractor",
                  "bundleId": "2034-2035"
                }
              ]
            },
            {
              "year": 2034,
              "month": 8,
              "isActual": false,
              "accruedIncomeCents": 1716853,
              "projectedOpexCents": 0,
              "scheduledCapexCents": 0,
              "netCents": 1716853,
              "cumulativeBalanceCents": 165361847,
              "capexItems": []
            },
            {
              "year": 2034,
              "month": 9,
              "isActual": false,
              "accruedIncomeCents": 1718277,
              "projectedOpexCents": 0,
              "scheduledCapexCents": 0,
              "netCents": 1718277,
              "cumulativeBalanceCents": 167080124,
              "capexItems": []
            },
            {
              "year": 2034,
              "month": 10,
              "isActual": false,
              "accruedIncomeCents": 1719702,
              "projectedOpexCents": 0,
              "scheduledCapexCents": 0,
              "netCents": 1719702,
              "cumulativeBalanceCents": 168799826,
              "capexItems": []
            },
            {
              "year": 2034,
              "month": 11,
              "isActual": false,
              "accruedIncomeCents": 1721129,
              "projectedOpexCents": 0,
              "scheduledCapexCents": 0,
              "netCents": 1721129,
              "cumulativeBalanceCents": 170520955,
              "capexItems": []
            },
            {
              "year": 2034,
              "month": 12,
              "isActual": false,
              "accruedIncomeCents": 1722557,
              "projectedOpexCents": 0,
              "scheduledCapexCents": 0,
              "netCents": 1722557,
              "cumulativeBalanceCents": 172243512,
              "capexItems": []
            },
            {
              "year": 2035,
              "month": 1,
              "isActual": false,
              "accruedIncomeCents": 1723986,
              "projectedOpexCents": 0,
              "scheduledCapexCents": 0,
              "netCents": 1723986,
              "cumulativeBalanceCents": 173967498,
              "capexItems": []
            },
            {
              "year": 2035,
              "month": 2,
              "isActual": false,
              "accruedIncomeCents": 1725416,
              "projectedOpexCents": 0,
              "scheduledCapexCents": 0,
              "netCents": 1725416,
              "cumulativeBalanceCents": 175692914,
              "capexItems": []
            },
            {
              "year": 2035,
              "month": 3,
              "isActual": false,
              "accruedIncomeCents": 1726847,
              "projectedOpexCents": 0,
              "scheduledCapexCents": 0,
              "netCents": 1726847,
              "cumulativeBalanceCents": 177419761,
              "capexItems": []
            },
            {
              "year": 2035,
              "month": 4,
              "isActual": false,
              "accruedIncomeCents": 1728280,
              "projectedOpexCents": 0,
              "scheduledCapexCents": 0,
              "netCents": 1728280,
              "cumulativeBalanceCents": 179148041,
              "capexItems": []
            },
            {
              "year": 2035,
              "month": 5,
              "isActual": false,
              "accruedIncomeCents": 1729713,
              "projectedOpexCents": 0,
              "scheduledCapexCents": 0,
              "netCents": 1729713,
              "cumulativeBalanceCents": 180877754,
              "capexItems": []
            },
            {
              "year": 2035,
              "month": 6,
              "isActual": false,
              "accruedIncomeCents": 1731148,
              "projectedOpexCents": 0,
              "scheduledCapexCents": 0,
              "netCents": 1731148,
              "cumulativeBalanceCents": 182608902,
              "capexItems": []
            },
            {
              "year": 2035,
              "month": 7,
              "isActual": false,
              "accruedIncomeCents": 1732584,
              "projectedOpexCents": 0,
              "scheduledCapexCents": 1352000,
              "netCents": 380584,
              "cumulativeBalanceCents": 182989486,
              "capexItems": [
                {
                  "assetId": "7fbbc9b8-fd7d-4c1c-8750-a362bcc58510",
                  "assetName": "Kitchen worktop (synthetic)",
                  "estimatedCostCents": 120000,
                  "isOverridden": false,
                  "tradeGroup": "General contractor",
                  "bundleId": "2035-2036"
                },
                {
                  "assetId": "2fd90fa6-aab8-42dd-9368-e49a75f98952",
                  "assetName": "Roller shutters (plastic)",
                  "estimatedCostCents": 55000,
                  "isOverridden": false,
                  "tradeGroup": "General contractor",
                  "bundleId": "2035-2036"
                },
                {
                  "assetId": "fed929a9-6bb4-4d5a-8d9d-ffd3faa52618",
                  "assetName": "Parquet flooring (mosaic)",
                  "estimatedCostCents": 350000,
                  "isOverridden": false,
                  "tradeGroup": "General contractor",
                  "bundleId": "2035-2036"
                },
                {
                  "assetId": "03f837b4-5c88-4273-89f6-20196359864f",
                  "assetName": "Parquet flooring (mosaic)",
                  "estimatedCostCents": 350000,
                  "isOverridden": false,
                  "tradeGroup": "General contractor",
                  "bundleId": "2035-2036"
                },
                {
                  "assetId": "f8d26c10-749f-4cf7-8ab7-0fdf66e160e0",
                  "assetName": "Balcony (metal)",
                  "estimatedCostCents": 450000,
                  "isOverridden": false,
                  "tradeGroup": "General contractor",
                  "bundleId": "2035-2036"
                },
                {
                  "assetId": "694af99e-c3d7-45bd-ac13-35bb0d9816c5",
                  "assetName": "Power sockets",
                  "estimatedCostCents": 13000,
                  "isOverridden": false,
                  "tradeGroup": "General contractor",
                  "bundleId": "2035-2036"
                },
                {
                  "assetId": "13b66f2c-a78d-470d-ae97-2751c4808c9e",
                  "assetName": "Light switches",
                  "estimatedCostCents": 7000,
                  "isOverridden": false,
                  "tradeGroup": "General contractor",
                  "bundleId": "2035-2036"
                },
                {
                  "assetId": "f21c61f0-6aa4-4cbb-811b-0b2f4f941080",
                  "assetName": "Light switches",
                  "estimatedCostCents": 7000,
                  "isOverridden": false,
                  "tradeGroup": "General contractor",
                  "bundleId": "2035-2036"
                }
              ]
            },
            {
              "year": 2035,
              "month": 8,
              "isActual": false,
              "accruedIncomeCents": 1734021,
              "projectedOpexCents": 0,
              "scheduledCapexCents": 0,
              "netCents": 1734021,
              "cumulativeBalanceCents": 184723507,
              "capexItems": []
            },
            {
              "year": 2035,
              "month": 9,
              "isActual": false,
              "accruedIncomeCents": 1735460,
              "projectedOpexCents": 0,
              "scheduledCapexCents": 0,
              "netCents": 1735460,
              "cumulativeBalanceCents": 186458967,
              "capexItems": []
            },
            {
              "year": 2035,
              "month": 10,
              "isActual": false,
              "accruedIncomeCents": 1736899,
              "projectedOpexCents": 0,
              "scheduledCapexCents": 0,
              "netCents": 1736899,
              "cumulativeBalanceCents": 188195866,
              "capexItems": []
            },
            {
              "year": 2035,
              "month": 11,
              "isActual": false,
              "accruedIncomeCents": 1738340,
              "projectedOpexCents": 0,
              "scheduledCapexCents": 0,
              "netCents": 1738340,
              "cumulativeBalanceCents": 189934206,
              "capexItems": []
            },
            {
              "year": 2035,
              "month": 12,
              "isActual": false,
              "accruedIncomeCents": 1739782,
              "projectedOpexCents": 0,
              "scheduledCapexCents": 0,
              "netCents": 1739782,
              "cumulativeBalanceCents": 191673988,
              "capexItems": []
            },
            {
              "year": 2036,
              "month": 1,
              "isActual": false,
              "accruedIncomeCents": 1741225,
              "projectedOpexCents": 0,
              "scheduledCapexCents": 0,
              "netCents": 1741225,
              "cumulativeBalanceCents": 193415213,
              "capexItems": []
            },
            {
              "year": 2036,
              "month": 2,
              "isActual": false,
              "accruedIncomeCents": 1742670,
              "projectedOpexCents": 0,
              "scheduledCapexCents": 0,
              "netCents": 1742670,
              "cumulativeBalanceCents": 195157883,
              "capexItems": []
            },
            {
              "year": 2036,
              "month": 3,
              "isActual": false,
              "accruedIncomeCents": 1744116,
              "projectedOpexCents": 0,
              "scheduledCapexCents": 0,
              "netCents": 1744116,
              "cumulativeBalanceCents": 196901999,
              "capexItems": []
            },
            {
              "year": 2036,
              "month": 4,
              "isActual": false,
              "accruedIncomeCents": 1745562,
              "projectedOpexCents": 0,
              "scheduledCapexCents": 0,
              "netCents": 1745562,
              "cumulativeBalanceCents": 198647561,
              "capexItems": []
            },
            {
              "year": 2036,
              "month": 5,
              "isActual": false,
              "accruedIncomeCents": 1747010,
              "projectedOpexCents": 0,
              "scheduledCapexCents": 0,
              "netCents": 1747010,
              "cumulativeBalanceCents": 200394571,
              "capexItems": []
            },
            {
              "year": 2036,
              "month": 6,
              "isActual": false,
              "accruedIncomeCents": 1748460,
              "projectedOpexCents": 0,
              "scheduledCapexCents": 0,
              "netCents": 1748460,
              "cumulativeBalanceCents": 202143031,
              "capexItems": []
            },
            {
              "year": 2036,
              "month": 7,
              "isActual": false,
              "accruedIncomeCents": 1749910,
              "projectedOpexCents": 0,
              "scheduledCapexCents": 863000,
              "netCents": 886910,
              "cumulativeBalanceCents": 203029941,
              "capexItems": [
                {
                  "assetId": "36fd7755-fc72-41bb-a2bd-171d5fb6d991",
                  "assetName": "Bathroom tap",
                  "estimatedCostCents": 40000,
                  "isOverridden": false,
                  "tradeGroup": "General contractor",
                  "bundleId": "2035-2036"
                },
                {
                  "assetId": "5c18b355-7254-4462-9745-0b5f07815d73",
                  "assetName": "Kitchen worktop (synthetic)",
                  "estimatedCostCents": 120000,
                  "isOverridden": false,
                  "tradeGroup": "General contractor",
                  "bundleId": "2035-2036"
                },
                {
                  "assetId": "e9b4baab-9bcd-4b2d-801c-13b228413954",
                  "assetName": "Kitchen cabinets (chipboard)",
                  "estimatedCostCents": 450000,
                  "isOverridden": false,
                  "tradeGroup": "General contractor",
                  "bundleId": "2035-2036"
                },
                {
                  "assetId": "0c4cac7b-d7d1-4b01-883f-2a3669fc91e0",
                  "assetName": "Sanitary ceramics (WC/basin)",
                  "estimatedCostCents": 120000,
                  "isOverridden": false,
                  "tradeGroup": "General contractor",
                  "bundleId": "2035-2036"
                },
                {
                  "assetId": "218ae29e-1349-4323-875f-d071227ecbc2",
                  "assetName": "Sanitary ceramics (WC/basin)",
                  "estimatedCostCents": 120000,
                  "isOverridden": false,
                  "tradeGroup": "General contractor",
                  "bundleId": "2035-2036"
                },
                {
                  "assetId": "848fea49-e9a7-4d95-a33e-898676953723",
                  "assetName": "Power sockets",
                  "estimatedCostCents": 13000,
                  "isOverridden": false,
                  "tradeGroup": "General contractor",
                  "bundleId": "2035-2036"
                }
              ]
            },
            {
              "year": 2036,
              "month": 8,
              "isActual": false,
              "accruedIncomeCents": 1751362,
              "projectedOpexCents": 0,
              "scheduledCapexCents": 0,
              "netCents": 1751362,
              "cumulativeBalanceCents": 204781303,
              "capexItems": []
            },
            {
              "year": 2036,
              "month": 9,
              "isActual": false,
              "accruedIncomeCents": 1752814,
              "projectedOpexCents": 0,
              "scheduledCapexCents": 0,
              "netCents": 1752814,
              "cumulativeBalanceCents": 206534117,
              "capexItems": []
            },
            {
              "year": 2036,
              "month": 10,
              "isActual": false,
              "accruedIncomeCents": 1754268,
              "projectedOpexCents": 0,
              "scheduledCapexCents": 0,
              "netCents": 1754268,
              "cumulativeBalanceCents": 208288385,
              "capexItems": []
            },
            {
              "year": 2036,
              "month": 11,
              "isActual": false,
              "accruedIncomeCents": 1755724,
              "projectedOpexCents": 0,
              "scheduledCapexCents": 0,
              "netCents": 1755724,
              "cumulativeBalanceCents": 210044109,
              "capexItems": []
            },
            {
              "year": 2036,
              "month": 12,
              "isActual": false,
              "accruedIncomeCents": 1757180,
              "projectedOpexCents": 0,
              "scheduledCapexCents": 0,
              "netCents": 1757180,
              "cumulativeBalanceCents": 211801289,
              "capexItems": []
            }
          ],
          "timingRecommendations": [
            {
              "buildingId": "demo-building",
              "buildingName": "Résidence des Charmilles",
              "assetId": "50d1b281-b019-4f7e-bdaf-294af8355edc",
              "assetName": "Kitchen cabinets (chipboard)",
              "assetType": "FIXTURE",
              "topic": "KITCHEN_CABINET_CHIPBOARD",
              "unitNumber": "0003",
              "scheduledYear": 2028,
              "recommendedYear": 2026,
              "direction": "advance",
              "estimatedCostChf": 4500,
              "isDeductible": true,
              "deductiblePct": 100,
              "ownerMarginalTaxRate": null,
              "estimatedTaxSavingChf": 1192,
              "rationale": "Advance kitchen cabinets (chipboard) replacement by 2 years to 2026 when projected rental income is 0% above average. Deductible portion: CHF 4’500 at default 25% marginal rate yields ~CHF 1’192 tax shield.",
              "scheduledYearIncomeChf": 0,
              "recommendedYearIncomeChf": 63472,
              "taxSavingScheduledChf": 1058,
              "taxSavingRecommendedChf": 1192,
              "additionalSavingChf": 134,
              "scheduledYearMarginalPct": 23.52,
              "recommendedYearMarginalPct": 26.49,
              "bracketSource": "Federal 2026 brackets + est. cantonal"
            },
            {
              "buildingId": "demo-building",
              "buildingName": "Résidence des Charmilles",
              "assetId": "e29c9d98-9f30-4e86-bfa0-38595f75afe3",
              "assetName": "Wall paint (dispersion)",
              "assetType": "FINISH",
              "topic": "PAINT_WALLS_DISPERSION",
              "unitNumber": "0006",
              "scheduledYear": 2027,
              "recommendedYear": 2026,
              "direction": "advance",
              "estimatedCostChf": 2200,
              "isDeductible": true,
              "deductiblePct": 100,
              "ownerMarginalTaxRate": null,
              "estimatedTaxSavingChf": 583,
              "rationale": "Advance wall paint (dispersion) replacement by 1 year to 2026 when projected rental income is 0% above average. Deductible portion: CHF 2’200 at default 25% marginal rate yields ~CHF 583 tax shield.",
              "scheduledYearIncomeChf": 0,
              "recommendedYearIncomeChf": 63472,
              "taxSavingScheduledChf": 517,
              "taxSavingRecommendedChf": 583,
              "additionalSavingChf": 66,
              "scheduledYearMarginalPct": 23.52,
              "recommendedYearMarginalPct": 26.49,
              "bracketSource": "Federal 2026 brackets + est. cantonal"
            },
            {
              "buildingId": "demo-building",
              "buildingName": "Résidence des Charmilles",
              "assetId": "29743c70-02ea-40f1-8a8c-f288eefd82f0",
              "assetName": "Wall paint (dispersion)",
              "assetType": "FINISH",
              "topic": "PAINT_WALLS_DISPERSION",
              "unitNumber": "0007",
              "scheduledYear": 2028,
              "recommendedYear": 2026,
              "direction": "advance",
              "estimatedCostChf": 2200,
              "isDeductible": true,
              "deductiblePct": 100,
              "ownerMarginalTaxRate": null,
              "estimatedTaxSavingChf": 583,
              "rationale": "Advance wall paint (dispersion) replacement by 2 years to 2026 when projected rental income is 0% above average. Deductible portion: CHF 2’200 at default 25% marginal rate yields ~CHF 583 tax shield.",
              "scheduledYearIncomeChf": 0,
              "recommendedYearIncomeChf": 63472,
              "taxSavingScheduledChf": 517,
              "taxSavingRecommendedChf": 583,
              "additionalSavingChf": 66,
              "scheduledYearMarginalPct": 23.52,
              "recommendedYearMarginalPct": 26.49,
              "bracketSource": "Federal 2026 brackets + est. cantonal"
            },
            {
              "buildingId": "demo-building",
              "buildingName": "Résidence des Charmilles",
              "assetId": "55f097f4-fcc6-4ca4-a643-58e2bb025b00",
              "assetName": "Wall paint (dispersion)",
              "assetType": "FINISH",
              "topic": "PAINT_WALLS_DISPERSION",
              "unitNumber": "0004",
              "scheduledYear": 2028,
              "recommendedYear": 2026,
              "direction": "advance",
              "estimatedCostChf": 2200,
              "isDeductible": true,
              "deductiblePct": 100,
              "ownerMarginalTaxRate": null,
              "estimatedTaxSavingChf": 583,
              "rationale": "Advance wall paint (dispersion) replacement by 2 years to 2026 when projected rental income is 0% above average. Deductible portion: CHF 2’200 at default 25% marginal rate yields ~CHF 583 tax shield.",
              "scheduledYearIncomeChf": 0,
              "recommendedYearIncomeChf": 63472,
              "taxSavingScheduledChf": 517,
              "taxSavingRecommendedChf": 583,
              "additionalSavingChf": 66,
              "scheduledYearMarginalPct": 23.52,
              "recommendedYearMarginalPct": 26.49,
              "bracketSource": "Federal 2026 brackets + est. cantonal"
            },
            {
              "buildingId": "demo-building",
              "buildingName": "Résidence des Charmilles",
              "assetId": "4731f5fb-707c-4cae-a81f-d497b47e202a",
              "assetName": "Wall paint (dispersion)",
              "assetType": "FINISH",
              "topic": "PAINT_WALLS_DISPERSION",
              "unitNumber": "0003",
              "scheduledYear": 2028,
              "recommendedYear": 2026,
              "direction": "advance",
              "estimatedCostChf": 2200,
              "isDeductible": true,
              "deductiblePct": 100,
              "ownerMarginalTaxRate": null,
              "estimatedTaxSavingChf": 583,
              "rationale": "Advance wall paint (dispersion) replacement by 2 years to 2026 when projected rental income is 0% above average. Deductible portion: CHF 2’200 at default 25% marginal rate yields ~CHF 583 tax shield.",
              "scheduledYearIncomeChf": 0,
              "recommendedYearIncomeChf": 63472,
              "taxSavingScheduledChf": 517,
              "taxSavingRecommendedChf": 583,
              "additionalSavingChf": 66,
              "scheduledYearMarginalPct": 23.52,
              "recommendedYearMarginalPct": 26.49,
              "bracketSource": "Federal 2026 brackets + est. cantonal"
            }
          ]
        },
        "strategyOverlay": null
      }
    },
    "/cashflow-plans/demo-plan/npv-scenarios": {
      "data": {
        "buildingId": "demo-building",
        "buildingName": "Résidence des Charmilles",
        "discountRatePct": 4,
        "incomeGrowthRatePct": 1,
        "horizonYears": 10,
        "deferYears": 3,
        "baseAnnualNoiChf": 190416,
        "noIncomeData": false,
        "noiEstimatedFromRent": true,
        "fromYear": 2026,
        "toYear": 2035,
        "scenarios": {
          "invest": {
            "npvChf": 5740238,
            "totalCapexChf": 330000,
            "totalTaxShieldChf": 55692,
            "totalNoiChf": 1996412,
            "terminalValuePvChf": 4357389,
            "yearlyFlows": [
              {
                "year": 2026,
                "projectedNoiChf": 181216,
                "capexChf": 87500,
                "taxShieldChf": 12125,
                "netCashFlowChf": 105841,
                "discountFactor": 0.9615,
                "pvChf": 101770,
                "cumulativePvChf": 101770
              },
              {
                "year": 2027,
                "projectedNoiChf": 191000,
                "capexChf": 11700,
                "taxShieldChf": 2925,
                "netCashFlowChf": 182225,
                "discountFactor": 0.9246,
                "pvChf": 168477,
                "cumulativePvChf": 270247
              },
              {
                "year": 2028,
                "projectedNoiChf": 194303,
                "capexChf": 35910,
                "taxShieldChf": 8945,
                "netCashFlowChf": 167338,
                "discountFactor": 0.889,
                "pvChf": 148763,
                "cumulativePvChf": 419010
              },
              {
                "year": 2029,
                "projectedNoiChf": 198286,
                "capexChf": 16870,
                "taxShieldChf": 3810,
                "netCashFlowChf": 185226,
                "discountFactor": 0.8548,
                "pvChf": 158332,
                "cumulativePvChf": 577342
              },
              {
                "year": 2030,
                "projectedNoiChf": 200248,
                "capexChf": 13430,
                "taxShieldChf": 2805,
                "netCashFlowChf": 189623,
                "discountFactor": 0.8219,
                "pvChf": 155856,
                "cumulativePvChf": 733198
              },
              {
                "year": 2031,
                "projectedNoiChf": 202229,
                "capexChf": 7950,
                "taxShieldChf": 1988,
                "netCashFlowChf": 196267,
                "discountFactor": 0.7903,
                "pvChf": 155113,
                "cumulativePvChf": 888311
              },
              {
                "year": 2032,
                "projectedNoiChf": 204230,
                "capexChf": 120970,
                "taxShieldChf": 16484,
                "netCashFlowChf": 99744,
                "discountFactor": 0.7599,
                "pvChf": 75797,
                "cumulativePvChf": 964108
              },
              {
                "year": 2033,
                "projectedNoiChf": 206252,
                "capexChf": 13030,
                "taxShieldChf": 2116,
                "netCashFlowChf": 195338,
                "discountFactor": 0.7307,
                "pvChf": 142732,
                "cumulativePvChf": 1106840
              },
              {
                "year": 2034,
                "projectedNoiChf": 208293,
                "capexChf": 9120,
                "taxShieldChf": 2272,
                "netCashFlowChf": 201445,
                "discountFactor": 0.7026,
                "pvChf": 141533,
                "cumulativePvChf": 1248373
              },
              {
                "year": 2035,
                "projectedNoiChf": 210355,
                "capexChf": 13520,
                "taxShieldChf": 2222,
                "netCashFlowChf": 199057,
                "discountFactor": 0.6756,
                "pvChf": 134476,
                "cumulativePvChf": 1382849
              }
            ],
            "levered": {
              "equityNpvChf": -95052,
              "equityIrrPct": 3.67,
              "minDscr": 0.6,
              "avgDscr": 0.66,
              "dscrByYear": [
                0.6,
                0.64,
                0.65,
                0.66,
                0.67,
                0.67,
                0.68,
                0.69,
                0.69,
                0.7
              ]
            }
          },
          "defer": {
            "npvChf": 5722246,
            "totalCapexChf": 330000,
            "totalTaxShieldChf": 55692,
            "totalNoiChf": 1962512,
            "terminalValuePvChf": 4357389,
            "yearlyFlows": [
              {
                "year": 2026,
                "projectedNoiChf": 181216,
                "capexChf": 0,
                "taxShieldChf": 0,
                "netCashFlowChf": 181216,
                "discountFactor": 0.9615,
                "pvChf": 174246,
                "cumulativePvChf": 174246
              },
              {
                "year": 2027,
                "projectedNoiChf": 183120,
                "capexChf": 0,
                "taxShieldChf": 0,
                "netCashFlowChf": 183120,
                "discountFactor": 0.9246,
                "pvChf": 169305,
                "cumulativePvChf": 343551
              },
              {
                "year": 2028,
                "projectedNoiChf": 185043,
                "capexChf": 0,
                "taxShieldChf": 0,
                "netCashFlowChf": 185043,
                "discountFactor": 0.889,
                "pvChf": 164503,
                "cumulativePvChf": 508054
              },
              {
                "year": 2029,
                "projectedNoiChf": 186986,
                "capexChf": 104370,
                "taxShieldChf": 15935,
                "netCashFlowChf": 98551,
                "discountFactor": 0.8548,
                "pvChf": 84242,
                "cumulativePvChf": 592296
              },
              {
                "year": 2030,
                "projectedNoiChf": 196828,
                "capexChf": 25130,
                "taxShieldChf": 5730,
                "netCashFlowChf": 177428,
                "discountFactor": 0.8219,
                "pvChf": 145833,
                "cumulativePvChf": 738129
              },
              {
                "year": 2031,
                "projectedNoiChf": 200189,
                "capexChf": 43860,
                "taxShieldChf": 10933,
                "netCashFlowChf": 167262,
                "discountFactor": 0.7903,
                "pvChf": 132190,
                "cumulativePvChf": 870319
              },
              {
                "year": 2032,
                "projectedNoiChf": 204230,
                "capexChf": 120970,
                "taxShieldChf": 16484,
                "netCashFlowChf": 99744,
                "discountFactor": 0.7599,
                "pvChf": 75797,
                "cumulativePvChf": 946116
              },
              {
                "year": 2033,
                "projectedNoiChf": 206252,
                "capexChf": 13030,
                "taxShieldChf": 2116,
                "netCashFlowChf": 195338,
                "discountFactor": 0.7307,
                "pvChf": 142732,
                "cumulativePvChf": 1088848
              },
              {
                "year": 2034,
                "projectedNoiChf": 208293,
                "capexChf": 9120,
                "taxShieldChf": 2272,
                "netCashFlowChf": 201445,
                "discountFactor": 0.7026,
                "pvChf": 141533,
                "cumulativePvChf": 1230381
              },
              {
                "year": 2035,
                "projectedNoiChf": 210355,
                "capexChf": 13520,
                "taxShieldChf": 2222,
                "netCashFlowChf": 199057,
                "discountFactor": 0.6756,
                "pvChf": 134476,
                "cumulativePvChf": 1364857
              }
            ],
            "levered": {
              "equityNpvChf": -113045,
              "equityIrrPct": 3.6,
              "minDscr": 0.6,
              "avgDscr": 0.65,
              "dscrByYear": [
                0.6,
                0.61,
                0.62,
                0.62,
                0.66,
                0.67,
                0.68,
                0.69,
                0.69,
                0.7
              ]
            }
          },
          "neglect": {
            "npvChf": 5639928,
            "totalCapexChf": 0,
            "totalTaxShieldChf": 0,
            "totalNoiChf": 1857868,
            "terminalValuePvChf": 4134453,
            "yearlyFlows": [
              {
                "year": 2026,
                "projectedNoiChf": 181216,
                "capexChf": 0,
                "taxShieldChf": 0,
                "netCashFlowChf": 181216,
                "discountFactor": 0.9615,
                "pvChf": 174246,
                "cumulativePvChf": 174246
              },
              {
                "year": 2027,
                "projectedNoiChf": 183120,
                "capexChf": 0,
                "taxShieldChf": 0,
                "netCashFlowChf": 183120,
                "discountFactor": 0.9246,
                "pvChf": 169305,
                "cumulativePvChf": 343551
              },
              {
                "year": 2028,
                "projectedNoiChf": 185043,
                "capexChf": 0,
                "taxShieldChf": 0,
                "netCashFlowChf": 185043,
                "discountFactor": 0.889,
                "pvChf": 164503,
                "cumulativePvChf": 508054
              },
              {
                "year": 2029,
                "projectedNoiChf": 186986,
                "capexChf": 0,
                "taxShieldChf": 0,
                "netCashFlowChf": 186986,
                "discountFactor": 0.8548,
                "pvChf": 159836,
                "cumulativePvChf": 667890
              },
              {
                "year": 2030,
                "projectedNoiChf": 186966,
                "capexChf": 0,
                "taxShieldChf": 0,
                "netCashFlowChf": 186966,
                "discountFactor": 0.8219,
                "pvChf": 153672,
                "cumulativePvChf": 821562
              },
              {
                "year": 2031,
                "projectedNoiChf": 186947,
                "capexChf": 0,
                "taxShieldChf": 0,
                "netCashFlowChf": 186947,
                "discountFactor": 0.7903,
                "pvChf": 147747,
                "cumulativePvChf": 969309
              },
              {
                "year": 2032,
                "projectedNoiChf": 186927,
                "capexChf": 0,
                "taxShieldChf": 0,
                "netCashFlowChf": 186927,
                "discountFactor": 0.7599,
                "pvChf": 142049,
                "cumulativePvChf": 1111358
              },
              {
                "year": 2033,
                "projectedNoiChf": 186907,
                "capexChf": 0,
                "taxShieldChf": 0,
                "netCashFlowChf": 186907,
                "discountFactor": 0.7307,
                "pvChf": 136571,
                "cumulativePvChf": 1247929
              },
              {
                "year": 2034,
                "projectedNoiChf": 186888,
                "capexChf": 0,
                "taxShieldChf": 0,
                "netCashFlowChf": 186888,
                "discountFactor": 0.7026,
                "pvChf": 131305,
                "cumulativePvChf": 1379234
              },
              {
                "year": 2035,
                "projectedNoiChf": 186868,
                "capexChf": 0,
                "taxShieldChf": 0,
                "netCashFlowChf": 186868,
                "discountFactor": 0.6756,
                "pvChf": 126241,
                "cumulativePvChf": 1505475
              }
            ],
            "levered": {
              "equityNpvChf": -195361,
              "equityIrrPct": 3.29,
              "minDscr": 0.6,
              "avgDscr": 0.62,
              "dscrByYear": [
                0.6,
                0.61,
                0.62,
                0.62,
                0.62,
                0.62,
                0.62,
                0.62,
                0.62,
                0.62
              ]
            }
          }
        },
        "terminalValueModeled": true,
        "propertyValueChf": 6450000,
        "neglectNoiErosionRatePct": 1,
        "ownerMarginalTaxRatePct": 25,
        "ownerTaxRateIsDefault": true,
        "fciCurrentPct": 4,
        "fciNeglectHorizonPct": 79.9,
        "totalReplacementValueChf": 412800,
        "debt": {
          "totalDebtChf": 3900000,
          "weightedCostOfDebtPct": 1.85,
          "ltvPct": 60.5,
          "waccPct": 2.42,
          "currentEquityChf": 2550000,
          "marketValueChf": 6450000,
          "costOfEquityPct": 4
        },
        "strategyContext": {
          "hasProfile": false,
          "source": "none"
        }
      }
    },
    "/units/demo-unit-0001/condition-reports": {
      "data": []
    },
    "/units/demo-unit-0001/expense-lines": {
      "data": {
        "unitId": "demo-unit-0001",
        "totalCents": 39000,
        "lines": [
          {
            "id": "6905fa9a-3f3a-411a-a52d-964323aaecf9",
            "kind": "invoice",
            "date": "2025-09-17",
            "vendor": "Sanitaires Perret SA",
            "description": "Sanitaires Perret SA / Détartrage chauffe-eau",
            "accountCode": "61200",
            "accountName": "Entretien des appartements",
            "reference": null,
            "amountCents": 39000,
            "invoiceId": "6905fa9a-3f3a-411a-a52d-964323aaecf9"
          }
        ]
      }
    },
    "/units/demo-unit-0002/condition-reports": {
      "data": []
    },
    "/units/demo-unit-0002/expense-lines": {
      "data": {
        "unitId": "demo-unit-0002",
        "totalCents": 0,
        "lines": []
      }
    },
    "/units/demo-unit-0003/condition-reports": {
      "data": []
    },
    "/units/demo-unit-0003/expense-lines": {
      "data": {
        "unitId": "demo-unit-0003",
        "totalCents": 68000,
        "lines": [
          {
            "id": "ad1a8e61-6fca-4b6b-aa86-4cc006c1ebfe",
            "kind": "invoice",
            "date": "2025-02-11",
            "vendor": "Sanitaires Perret SA",
            "description": "Sanitaires Perret SA / Remplacement mitigeur cuisine",
            "accountCode": "61200",
            "accountName": "Entretien des appartements",
            "reference": null,
            "amountCents": 68000,
            "invoiceId": "ad1a8e61-6fca-4b6b-aa86-4cc006c1ebfe"
          }
        ]
      }
    },
    "/units/demo-unit-0004/condition-reports": {
      "data": []
    },
    "/units/demo-unit-0004/expense-lines": {
      "data": {
        "unitId": "demo-unit-0004",
        "totalCents": 0,
        "lines": []
      }
    },
    "/units/demo-unit-0005/condition-reports": {
      "data": []
    },
    "/units/demo-unit-0005/expense-lines": {
      "data": {
        "unitId": "demo-unit-0005",
        "totalCents": 54000,
        "lines": [
          {
            "id": "2a97d8fa-99a1-4af1-a8ad-a7c5e2786ab5",
            "kind": "invoice",
            "date": "2025-05-22",
            "vendor": "ACE Électroménager",
            "description": "ACE Électroménager / Réparation lave-vaisselle",
            "accountCode": "61200",
            "accountName": "Entretien des appartements",
            "reference": null,
            "amountCents": 54000,
            "invoiceId": "2a97d8fa-99a1-4af1-a8ad-a7c5e2786ab5"
          }
        ]
      }
    },
    "/units/demo-unit-0006/condition-reports": {
      "data": [
        {
          "id": "33e461a4-23cc-4480-9acf-5e7400725671",
          "type": "MOVE_IN",
          "status": "APPROVED",
          "dueAt": null,
          "submittedAt": "2024-09-08T00:00:00.000Z",
          "approvedAt": "2024-09-08T00:00:00.000Z",
          "itemCount": 4,
          "tenant": {
            "id": "9d15d37a-79b3-4b49-8943-3315bc6ecabe",
            "name": "ROSSI Giulia"
          },
          "createdAt": "2026-09-08T13:12:20.116Z"
        }
      ]
    },
    "/units/demo-unit-0006/expense-lines": {
      "data": {
        "unitId": "demo-unit-0006",
        "totalCents": 0,
        "lines": []
      }
    },
    "/units/demo-unit-0007/condition-reports": {
      "data": []
    },
    "/units/demo-unit-0007/expense-lines": {
      "data": {
        "unitId": "demo-unit-0007",
        "totalCents": 118000,
        "lines": [
          {
            "id": "49cb529c-8c1f-4f30-996a-2ec0886c718e",
            "kind": "invoice",
            "date": "2025-11-26",
            "vendor": "Vitrerie Genevoise",
            "description": "Vitrerie Genevoise / Remplacement double vitrage",
            "accountCode": "61200",
            "accountName": "Entretien des appartements",
            "reference": null,
            "amountCents": 118000,
            "invoiceId": "49cb529c-8c1f-4f30-996a-2ec0886c718e"
          }
        ]
      }
    },
    "/units/demo-unit-0008/condition-reports": {
      "data": [
        {
          "id": "f831f5f1-3a9e-409b-a8c2-c39767034aa5",
          "type": "MOVE_OUT",
          "status": "APPROVED",
          "dueAt": null,
          "submittedAt": "2025-09-08T00:00:00.000Z",
          "approvedAt": "2025-09-08T00:00:00.000Z",
          "itemCount": 5,
          "tenant": {
            "id": "bb9f1bfb-8e2a-4717-a050-d6164d02bde5",
            "name": "PERRET Claude"
          },
          "createdAt": "2026-09-08T13:12:20.111Z"
        }
      ]
    },
    "/units/demo-unit-0008/expense-lines": {
      "data": {
        "unitId": "demo-unit-0008",
        "totalCents": 425000,
        "lines": [
          {
            "id": "286a5379-a470-4789-817f-173e8ee34364",
            "kind": "invoice",
            "date": "2025-07-09",
            "vendor": "Peinture Dubois",
            "description": "Peinture Dubois / Remise en état après départ",
            "accountCode": "61200",
            "accountName": "Entretien des appartements",
            "reference": null,
            "amountCents": 425000,
            "invoiceId": "286a5379-a470-4789-817f-173e8ee34364"
          }
        ]
      }
    },
    "/units/demo-unit-9001/condition-reports": {
      "data": []
    },
    "/units/demo-unit-9001/expense-lines": {
      "data": {
        "unitId": "demo-unit-9001",
        "totalCents": 0,
        "lines": []
      }
    },
    "/units/demo-unit-9002/condition-reports": {
      "data": []
    },
    "/units/demo-unit-9002/expense-lines": {
      "data": {
        "unitId": "demo-unit-9002",
        "totalCents": 0,
        "lines": []
      }
    },
    "/units/demo-unit-9003/condition-reports": {
      "data": []
    },
    "/units/demo-unit-9003/expense-lines": {
      "data": {
        "unitId": "demo-unit-9003",
        "totalCents": 0,
        "lines": []
      }
    },
    "/units/demo-unit-9004/condition-reports": {
      "data": []
    },
    "/units/demo-unit-9004/expense-lines": {
      "data": {
        "unitId": "demo-unit-9004",
        "totalCents": 0,
        "lines": []
      }
    }
  },
  "variants": {
    "1": {
      "/buildings/demo-building/yield-goalseek": {
        "data": {
          "currentYieldPct": 2.57,
          "targetYieldPct": 3,
          "valueChf": 6535625,
          "currentNoiChf": 168256,
          "rentRollChf": 207360,
          "occupancyRate": 0.8333,
          "requiredNoiChf": 196068.75,
          "gapChf": 27812.75,
          "met": false,
          "strategySource": "building",
          "strategyFlags": {
            "renovation": false,
            "rentAggressive": false,
            "selfManage": false
          },
          "strategyLabel": "exit_optimizer",
          "levers": {
            "rent": {
              "deltaMonthlyChf": 2317.73,
              "pctOfRentRoll": 0.1341,
              "marketGapAnnualChf": 59685,
              "avgLeaseRemainingMonths": null,
              "feasible": true,
              "offStrategy": false
            },
            "opex": {
              "requiredReductionChf": 27812.75,
              "operatingCostChf": 61880,
              "headroomChf": 3094,
              "feasible": false,
              "offStrategy": false
            },
            "occupancy": {
              "requiredOccupancyRate": 0.9451,
              "feasible": true,
              "offStrategy": false
            },
            "mgmtFee": {
              "feeChf": 11487.74,
              "ppOfYield": 0.176,
              "gapCoverPct": 0.413,
              "selfManage": false,
              "feasible": true,
              "offStrategy": false
            },
            "renovation": {
              "lines": [
                {
                  "assetId": "6c634239-94ee-4688-b976-03d81ce89ec2",
                  "unitId": "demo-unit-0003",
                  "label": "Insulated windows (PVC/wood) — 0003",
                  "costChf": 1100,
                  "annualUpliftChf": 22,
                  "deltaValueChf": 715,
                  "marginalYieldPct": 3.08,
                  "accretive": true
                },
                {
                  "assetId": "dada94b5-2ae5-4989-8868-fccf5373a595",
                  "unitId": "demo-unit-0005",
                  "label": "Parquet flooring (mosaic) — 0005",
                  "costChf": 3500,
                  "annualUpliftChf": 43.75,
                  "deltaValueChf": 2275,
                  "marginalYieldPct": 1.92,
                  "accretive": false
                },
                {
                  "assetId": "a40eef84-b8e4-44a9-957e-fa408f9da8de",
                  "unitId": "demo-unit-0008",
                  "label": "Kitchen cabinets (chipboard) — 0008",
                  "costChf": 4500,
                  "annualUpliftChf": 150,
                  "deltaValueChf": 2925,
                  "marginalYieldPct": 5.13,
                  "accretive": true
                },
                {
                  "assetId": "50d1b281-b019-4f7e-bdaf-294af8355edc",
                  "unitId": "demo-unit-0003",
                  "label": "Kitchen cabinets (chipboard) — 0003",
                  "costChf": 4500,
                  "annualUpliftChf": 150,
                  "deltaValueChf": 2925,
                  "marginalYieldPct": 5.13,
                  "accretive": true
                },
                {
                  "assetId": "45ed30a9-f059-4cb0-9e2f-bfad84b311f9",
                  "unitId": "demo-unit-0006",
                  "label": "Interior doors (chipboard) — 0006",
                  "costChf": 450,
                  "annualUpliftChf": 9,
                  "deltaValueChf": 292.5,
                  "marginalYieldPct": 3.08,
                  "accretive": true
                },
                {
                  "assetId": "9850ddb9-679f-44dc-9ac3-c696192ab7f2",
                  "unitId": "demo-unit-0006",
                  "label": "Roller shutters (plastic) — 0006",
                  "costChf": 550,
                  "annualUpliftChf": 13.75,
                  "deltaValueChf": 357.5,
                  "marginalYieldPct": 3.85,
                  "accretive": true
                },
                {
                  "assetId": "0581e949-581f-4a4a-ae0c-f7da89f0de3f",
                  "unitId": "demo-unit-0008",
                  "label": "Power sockets — 0008",
                  "costChf": 130,
                  "annualUpliftChf": 4.33,
                  "deltaValueChf": 84.5,
                  "marginalYieldPct": 5.13,
                  "accretive": true
                },
                {
                  "assetId": "dc4ce34d-f394-4d4d-b771-a7b0baafca8d",
                  "unitId": "demo-unit-0001",
                  "label": "Kitchen tap — 0001",
                  "costChf": 400,
                  "annualUpliftChf": 10,
                  "deltaValueChf": 260,
                  "marginalYieldPct": 3.85,
                  "accretive": true
                },
                {
                  "assetId": "61216168-5e7e-431e-8cc7-3ba4d3b80073",
                  "unitId": "demo-unit-0002",
                  "label": "Power sockets — 0002",
                  "costChf": 130,
                  "annualUpliftChf": 4.33,
                  "deltaValueChf": 84.5,
                  "marginalYieldPct": 5.13,
                  "accretive": true
                },
                {
                  "assetId": "91b041f9-cd2c-408a-a929-94a53c03f89f",
                  "unitId": "demo-unit-0005",
                  "label": "Bathroom tap — 0005",
                  "costChf": 400,
                  "annualUpliftChf": 10,
                  "deltaValueChf": 260,
                  "marginalYieldPct": 3.85,
                  "accretive": true
                },
                {
                  "assetId": "c7cf90f2-0c6c-43d9-9b62-02ee6049b2e0",
                  "unitId": "demo-unit-0002",
                  "label": "Kitchen worktop (synthetic) — 0002",
                  "costChf": 1200,
                  "annualUpliftChf": 40,
                  "deltaValueChf": 780,
                  "marginalYieldPct": 5.13,
                  "accretive": true
                },
                {
                  "assetId": "bac575dc-2bff-432a-8f72-535b77cccadc",
                  "unitId": "demo-unit-0003",
                  "label": "Bathroom tap — 0003",
                  "costChf": 400,
                  "annualUpliftChf": 10,
                  "deltaValueChf": 260,
                  "marginalYieldPct": 3.85,
                  "accretive": true
                },
                {
                  "assetId": "02c95df5-f3c1-4072-b96a-6bcbcd0dc684",
                  "unitId": "demo-unit-0004",
                  "label": "Roller shutters (plastic) — 0004",
                  "costChf": 550,
                  "annualUpliftChf": 13.75,
                  "deltaValueChf": 357.5,
                  "marginalYieldPct": 3.85,
                  "accretive": true
                },
                {
                  "assetId": "55f097f4-fcc6-4ca4-a643-58e2bb025b00",
                  "unitId": "demo-unit-0004",
                  "label": "Wall paint (dispersion) — 0004",
                  "costChf": 2200,
                  "annualUpliftChf": 137.5,
                  "deltaValueChf": 1430,
                  "marginalYieldPct": 9.62,
                  "accretive": true
                },
                {
                  "assetId": "ac41b933-be89-48e0-82a3-ee702f81d509",
                  "unitId": "demo-unit-0005",
                  "label": "Light switches — 0005",
                  "costChf": 70,
                  "annualUpliftChf": 2.33,
                  "deltaValueChf": 45.5,
                  "marginalYieldPct": 5.13,
                  "accretive": true
                },
                {
                  "assetId": "58733997-0f0a-43e6-96e0-493710dfc4ba",
                  "unitId": "demo-unit-0007",
                  "label": "Sanitary ceramics (WC/basin) — 0007",
                  "costChf": 1200,
                  "annualUpliftChf": 17.14,
                  "deltaValueChf": 780,
                  "marginalYieldPct": 2.2,
                  "accretive": false
                },
                {
                  "assetId": "ca58ae14-5da2-4143-ac28-6facf4dd5e0f",
                  "unitId": "demo-unit-0008",
                  "label": "Balcony railing (metal) — 0008",
                  "costChf": 800,
                  "annualUpliftChf": 13.33,
                  "deltaValueChf": 520,
                  "marginalYieldPct": 2.56,
                  "accretive": false
                },
                {
                  "assetId": "2e9fbb78-1b17-42cb-b283-1c49f74dfb1a",
                  "unitId": "demo-unit-0008",
                  "label": "Bathroom tiles (ceramic) — 0008",
                  "costChf": 2200,
                  "annualUpliftChf": 36.67,
                  "deltaValueChf": 1430,
                  "marginalYieldPct": 2.56,
                  "accretive": false
                },
                {
                  "assetId": "e29c9d98-9f30-4e86-bfa0-38595f75afe3",
                  "unitId": "demo-unit-0006",
                  "label": "Wall paint (dispersion) — 0006",
                  "costChf": 2200,
                  "annualUpliftChf": 137.5,
                  "deltaValueChf": 1430,
                  "marginalYieldPct": 9.62,
                  "accretive": true
                },
                {
                  "assetId": "cdcd4dd1-604c-4dce-a25d-fd25c2cb8c0e",
                  "unitId": "demo-unit-0001",
                  "label": "Kitchen worktop (synthetic) — 0001",
                  "costChf": 1200,
                  "annualUpliftChf": 40,
                  "deltaValueChf": 780,
                  "marginalYieldPct": 5.13,
                  "accretive": true
                },
                {
                  "assetId": "dc7ed960-a649-4727-9652-c847277e5cff",
                  "unitId": "demo-unit-0001",
                  "label": "Insulated windows (PVC/wood) — 0001",
                  "costChf": 1100,
                  "annualUpliftChf": 22,
                  "deltaValueChf": 715,
                  "marginalYieldPct": 3.08,
                  "accretive": true
                },
                {
                  "assetId": "9a85dc6c-88c1-4fbe-bf56-603a60abf0a7",
                  "unitId": "demo-unit-0002",
                  "label": "Bathtub (acrylic) — 0002",
                  "costChf": 900,
                  "annualUpliftChf": 18,
                  "deltaValueChf": 585,
                  "marginalYieldPct": 3.08,
                  "accretive": true
                },
                {
                  "assetId": "41d16db4-e57d-40a5-b27b-eec76be78f29",
                  "unitId": "demo-unit-0003",
                  "label": "Roller shutters (plastic) — 0003",
                  "costChf": 550,
                  "annualUpliftChf": 13.75,
                  "deltaValueChf": 357.5,
                  "marginalYieldPct": 3.85,
                  "accretive": true
                },
                {
                  "assetId": "4731f5fb-707c-4cae-a81f-d497b47e202a",
                  "unitId": "demo-unit-0003",
                  "label": "Wall paint (dispersion) — 0003",
                  "costChf": 2200,
                  "annualUpliftChf": 137.5,
                  "deltaValueChf": 1430,
                  "marginalYieldPct": 9.62,
                  "accretive": true
                },
                {
                  "assetId": "33e4f919-5713-41cf-a138-ce49e9977bf2",
                  "unitId": "demo-unit-0003",
                  "label": "Power sockets — 0003",
                  "costChf": 130,
                  "annualUpliftChf": 4.33,
                  "deltaValueChf": 84.5,
                  "marginalYieldPct": 5.13,
                  "accretive": true
                },
                {
                  "assetId": "87fa03d4-bcde-4366-8042-93d7435bbe1d",
                  "unitId": "demo-unit-0006",
                  "label": "Bathroom tap — 0006",
                  "costChf": 400,
                  "annualUpliftChf": 10,
                  "deltaValueChf": 260,
                  "marginalYieldPct": 3.85,
                  "accretive": true
                },
                {
                  "assetId": "5deed3d2-85f9-4338-89ed-c47dbefce005",
                  "unitId": "demo-unit-0006",
                  "label": "Bathtub (acrylic) — 0006",
                  "costChf": 900,
                  "annualUpliftChf": 18,
                  "deltaValueChf": 585,
                  "marginalYieldPct": 3.08,
                  "accretive": true
                },
                {
                  "assetId": "e4275079-9010-446e-91dd-f7a61e8157fb",
                  "unitId": "demo-unit-0006",
                  "label": "Kitchen tap — 0006",
                  "costChf": 400,
                  "annualUpliftChf": 10,
                  "deltaValueChf": 260,
                  "marginalYieldPct": 3.85,
                  "accretive": true
                },
                {
                  "assetId": "b6111e02-6a28-4a94-bbfa-227b79f1e24a",
                  "unitId": "demo-unit-0006",
                  "label": "Light switches — 0006",
                  "costChf": 70,
                  "annualUpliftChf": 2.33,
                  "deltaValueChf": 45.5,
                  "marginalYieldPct": 5.13,
                  "accretive": true
                },
                {
                  "assetId": "f77ae1ad-4ce9-4a8a-8163-02f139db7763",
                  "unitId": "demo-unit-0007",
                  "label": "Interior doors (chipboard) — 0007",
                  "costChf": 450,
                  "annualUpliftChf": 9,
                  "deltaValueChf": 292.5,
                  "marginalYieldPct": 3.08,
                  "accretive": true
                },
                {
                  "assetId": "6d7aaa72-8631-4b77-8bf8-7c7feaccaa85",
                  "unitId": "demo-unit-0007",
                  "label": "Bathroom tiles (ceramic) — 0007",
                  "costChf": 2200,
                  "annualUpliftChf": 36.67,
                  "deltaValueChf": 1430,
                  "marginalYieldPct": 2.56,
                  "accretive": false
                },
                {
                  "assetId": "96a56bb1-5085-4a5c-9df1-a3af9fb2c26a",
                  "unitId": "demo-unit-0008",
                  "label": "Balcony (metal) — 0008",
                  "costChf": 4500,
                  "annualUpliftChf": 56.25,
                  "deltaValueChf": 2925,
                  "marginalYieldPct": 1.92,
                  "accretive": false
                },
                {
                  "assetId": "347394e1-bdaa-4774-8845-60fd14753ade",
                  "unitId": "demo-unit-0001",
                  "label": "Kitchen tiles (ceramic) — 0001",
                  "costChf": 1600,
                  "annualUpliftChf": 26.67,
                  "deltaValueChf": 1040,
                  "marginalYieldPct": 2.56,
                  "accretive": false
                },
                {
                  "assetId": "f3bbaccd-5ff8-46ac-93ca-4d13471c4786",
                  "unitId": "demo-unit-0003",
                  "label": "Balcony railing (metal) — 0003",
                  "costChf": 800,
                  "annualUpliftChf": 13.33,
                  "deltaValueChf": 520,
                  "marginalYieldPct": 2.56,
                  "accretive": false
                },
                {
                  "assetId": "50d4329b-50c3-48cf-b25f-28f1d397a119",
                  "unitId": "demo-unit-0003",
                  "label": "Kitchen worktop (synthetic) — 0003",
                  "costChf": 1200,
                  "annualUpliftChf": 40,
                  "deltaValueChf": 780,
                  "marginalYieldPct": 5.13,
                  "accretive": true
                },
                {
                  "assetId": "82fe8641-7a63-4de3-a70c-14152b2e9fe7",
                  "unitId": "demo-unit-0007",
                  "label": "Roller shutters (plastic) — 0007",
                  "costChf": 550,
                  "annualUpliftChf": 13.75,
                  "deltaValueChf": 357.5,
                  "marginalYieldPct": 3.85,
                  "accretive": true
                },
                {
                  "assetId": "29743c70-02ea-40f1-8a8c-f288eefd82f0",
                  "unitId": "demo-unit-0007",
                  "label": "Wall paint (dispersion) — 0007",
                  "costChf": 2200,
                  "annualUpliftChf": 137.5,
                  "deltaValueChf": 1430,
                  "marginalYieldPct": 9.62,
                  "accretive": true
                },
                {
                  "assetId": "597b7d69-524b-44a5-9993-b5888438b8bf",
                  "unitId": "demo-unit-0008",
                  "label": "Bathroom tap — 0008",
                  "costChf": 400,
                  "annualUpliftChf": 10,
                  "deltaValueChf": 260,
                  "marginalYieldPct": 3.85,
                  "accretive": true
                },
                {
                  "assetId": "f8d26c10-749f-4cf7-8ab7-0fdf66e160e0",
                  "unitId": "demo-unit-0001",
                  "label": "Balcony (metal) — 0001",
                  "costChf": 4500,
                  "annualUpliftChf": 56.25,
                  "deltaValueChf": 2925,
                  "marginalYieldPct": 1.92,
                  "accretive": false
                },
                {
                  "assetId": "fed929a9-6bb4-4d5a-8d9d-ffd3faa52618",
                  "unitId": "demo-unit-0002",
                  "label": "Parquet flooring (mosaic) — 0002",
                  "costChf": 3500,
                  "annualUpliftChf": 43.75,
                  "deltaValueChf": 2275,
                  "marginalYieldPct": 1.92,
                  "accretive": false
                },
                {
                  "assetId": "15bddbbb-3b21-4889-afdd-faad0b69445b",
                  "unitId": "demo-unit-0004",
                  "label": "Balcony railing (metal) — 0004",
                  "costChf": 800,
                  "annualUpliftChf": 13.33,
                  "deltaValueChf": 520,
                  "marginalYieldPct": 2.56,
                  "accretive": false
                },
                {
                  "assetId": "6eb046ea-15c7-4bea-94a5-edf1298e0efd",
                  "unitId": "demo-unit-0005",
                  "label": "Kitchen cabinets (chipboard) — 0005",
                  "costChf": 4500,
                  "annualUpliftChf": 150,
                  "deltaValueChf": 2925,
                  "marginalYieldPct": 5.13,
                  "accretive": true
                },
                {
                  "assetId": "792f3563-0ea1-453b-b6a5-5833772b99c6",
                  "unitId": "demo-unit-0006",
                  "label": "Insulated windows (PVC/wood) — 0006",
                  "costChf": 1100,
                  "annualUpliftChf": 22,
                  "deltaValueChf": 715,
                  "marginalYieldPct": 3.08,
                  "accretive": true
                },
                {
                  "assetId": "08fcba5d-ce14-4a56-a79d-a0b8162d88ba",
                  "unitId": "demo-unit-0007",
                  "label": "Bathroom tap — 0007",
                  "costChf": 400,
                  "annualUpliftChf": 10,
                  "deltaValueChf": 260,
                  "marginalYieldPct": 3.85,
                  "accretive": true
                },
                {
                  "assetId": "03f837b4-5c88-4273-89f6-20196359864f",
                  "unitId": "demo-unit-0008",
                  "label": "Parquet flooring (mosaic) — 0008",
                  "costChf": 3500,
                  "annualUpliftChf": 43.75,
                  "deltaValueChf": 2275,
                  "marginalYieldPct": 1.92,
                  "accretive": false
                },
                {
                  "assetId": "a3ae7efb-bb6d-4ac7-87e0-9780a24736f9",
                  "unitId": "demo-unit-0001",
                  "label": "Balcony railing (metal) — 0001",
                  "costChf": 800,
                  "annualUpliftChf": 13.33,
                  "deltaValueChf": 520,
                  "marginalYieldPct": 2.56,
                  "accretive": false
                },
                {
                  "assetId": "0bf59d2d-31b7-450c-a0dc-d955e1845461",
                  "unitId": "demo-unit-0004",
                  "label": "Bathtub (acrylic) — 0004",
                  "costChf": 900,
                  "annualUpliftChf": 18,
                  "deltaValueChf": 585,
                  "marginalYieldPct": 3.08,
                  "accretive": true
                },
                {
                  "assetId": "f7040c38-9a3a-44d4-a62d-2617c7cce8e7",
                  "unitId": "demo-unit-0004",
                  "label": "Kitchen tap — 0004",
                  "costChf": 400,
                  "annualUpliftChf": 10,
                  "deltaValueChf": 260,
                  "marginalYieldPct": 3.85,
                  "accretive": true
                },
                {
                  "assetId": "3f1a28ca-2d61-4f95-a3b4-9508beb16d9b",
                  "unitId": "demo-unit-0005",
                  "label": "Kitchen tiles (ceramic) — 0005",
                  "costChf": 1600,
                  "annualUpliftChf": 26.67,
                  "deltaValueChf": 1040,
                  "marginalYieldPct": 2.56,
                  "accretive": false
                },
                {
                  "assetId": "3a7024af-7bc7-4ec1-abf3-adb5741758a1",
                  "unitId": "demo-unit-0007",
                  "label": "Insulated windows (PVC/wood) — 0007",
                  "costChf": 1100,
                  "annualUpliftChf": 22,
                  "deltaValueChf": 715,
                  "marginalYieldPct": 3.08,
                  "accretive": true
                },
                {
                  "assetId": "a3f412c3-d042-423e-b3cb-5838c784d157",
                  "unitId": "demo-unit-0007",
                  "label": "Power sockets — 0007",
                  "costChf": 130,
                  "annualUpliftChf": 4.33,
                  "deltaValueChf": 84.5,
                  "marginalYieldPct": 5.13,
                  "accretive": true
                },
                {
                  "assetId": "f835d7c4-588f-4095-86ae-1d20f6115a1f",
                  "unitId": "demo-unit-0008",
                  "label": "Kitchen tap — 0008",
                  "costChf": 400,
                  "annualUpliftChf": 10,
                  "deltaValueChf": 260,
                  "marginalYieldPct": 3.85,
                  "accretive": true
                },
                {
                  "assetId": "09f5897d-1e6c-4675-8294-c8972adb606a",
                  "unitId": "demo-unit-0008",
                  "label": "Wall paint (dispersion) — 0008",
                  "costChf": 2200,
                  "annualUpliftChf": 137.5,
                  "deltaValueChf": 1430,
                  "marginalYieldPct": 9.62,
                  "accretive": true
                }
              ],
              "accretiveCount": 39,
              "ceilingYieldPct": 2.59,
              "feasible": false,
              "offStrategy": false,
              "capexChf": 42560,
              "annualUpliftChf": 1584.48,
              "deltaValueChf": 27664
            }
          },
          "synthesis": {
            "withinStrategyYieldPct": 4.31,
            "withRenovationYieldPct": 4.32,
            "withSelfManageYieldPct": 4.35
          },
          "currentFeePct": 5.54,
          "feeSource": "statements",
          "opexDrivers": [
            {
              "label": "Chauffage et eau chaude",
              "annualChf": 19350,
              "category": "RECOVERABLE"
            },
            {
              "label": "Conciergerie et nettoyage",
              "annualChf": 14400,
              "category": "RECOVERABLE"
            },
            {
              "label": "Entretien des appartements",
              "annualChf": 7040,
              "category": "OWNER_OPEX"
            },
            {
              "label": "Assurances immeuble",
              "annualChf": 5420,
              "category": "OWNER_OPEX"
            },
            {
              "label": "Entretien parties communes",
              "annualChf": 5380,
              "category": "OWNER_OPEX"
            },
            {
              "label": "Eau et épuration",
              "annualChf": 5350,
              "category": "RECOVERABLE"
            }
          ],
          "strategyOwnerName": null,
          "occupancyGainAnnualChf": 32064,
          "vacantUnits": [
            {
              "label": "9004",
              "kind": "parking",
              "expectedAnnualChf": 1872,
              "hasAskingRent": true
            },
            {
              "label": "0008",
              "kind": "residential",
              "expectedAnnualChf": 30192,
              "hasAskingRent": true
            }
          ],
          "rentMarketDetail": [
            {
              "label": "0005",
              "livingAreaSqm": 104,
              "pricePerSqmChf": 13500,
              "grossYieldPct": 3.3,
              "vetustePct": 29,
              "currentAnnualChf": 30660,
              "marketAnnualChf": 40957,
              "gapChf": 10297
            },
            {
              "label": "0003",
              "livingAreaSqm": 102,
              "pricePerSqmChf": 13500,
              "grossYieldPct": 3.3,
              "vetustePct": 32,
              "currentAnnualChf": 29724,
              "marketAnnualChf": 39625,
              "gapChf": 9901
            },
            {
              "label": "0008",
              "livingAreaSqm": 101,
              "pricePerSqmChf": 13500,
              "grossYieldPct": 3.3,
              "vetustePct": 29,
              "currentAnnualChf": 30192,
              "marketAnnualChf": 39776,
              "gapChf": 9584
            },
            {
              "label": "0007",
              "livingAreaSqm": 79,
              "pricePerSqmChf": 13500,
              "grossYieldPct": 3.3,
              "vetustePct": 26,
              "currentAnnualChf": 23520,
              "marketAnnualChf": 31534,
              "gapChf": 8014
            },
            {
              "label": "0001",
              "livingAreaSqm": 78,
              "pricePerSqmChf": 13500,
              "grossYieldPct": 3.3,
              "vetustePct": 26,
              "currentAnnualChf": 23172,
              "marketAnnualChf": 31135,
              "gapChf": 7963
            },
            {
              "label": "0004",
              "livingAreaSqm": 80,
              "pricePerSqmChf": 13500,
              "grossYieldPct": 3.3,
              "vetustePct": 26,
              "currentAnnualChf": 23988,
              "marketAnnualChf": 31933,
              "gapChf": 7945
            },
            {
              "label": "0002",
              "livingAreaSqm": 58,
              "pricePerSqmChf": 13500,
              "grossYieldPct": 3.3,
              "vetustePct": 29,
              "currentAnnualChf": 18840,
              "marketAnnualChf": 22842,
              "gapChf": 4002
            },
            {
              "label": "0006",
              "livingAreaSqm": 56,
              "pricePerSqmChf": 13500,
              "grossYieldPct": 3.3,
              "vetustePct": 32,
              "currentAnnualChf": 19776,
              "marketAnnualChf": 21755,
              "gapChf": 1979
            }
          ],
          "rentMarketBasis": {
            "grossYieldPct": 3.3,
            "vetusteCoeffPct": 40,
            "pricePerSqmSource": "intrinsic"
          },
          "periodFrom": "2025-01-01",
          "periodTo": "2025-12-31"
        }
      },
      "/cashflow-plans/demo-plan/npv-scenarios": {
        "data": {
          "buildingId": "demo-building",
          "buildingName": "Résidence des Charmilles",
          "discountRatePct": 4,
          "incomeGrowthRatePct": 1,
          "horizonYears": 10,
          "deferYears": 3,
          "baseAnnualNoiChf": 190416,
          "noIncomeData": false,
          "noiEstimatedFromRent": true,
          "fromYear": 2026,
          "toYear": 2035,
          "scenarios": {
            "invest": {
              "npvChf": 5740238,
              "totalCapexChf": 330000,
              "totalTaxShieldChf": 55692,
              "totalNoiChf": 1996412,
              "terminalValuePvChf": 4357389,
              "yearlyFlows": [
                {
                  "year": 2026,
                  "projectedNoiChf": 181216,
                  "capexChf": 87500,
                  "taxShieldChf": 12125,
                  "netCashFlowChf": 105841,
                  "discountFactor": 0.9615,
                  "pvChf": 101770,
                  "cumulativePvChf": 101770
                },
                {
                  "year": 2027,
                  "projectedNoiChf": 191000,
                  "capexChf": 11700,
                  "taxShieldChf": 2925,
                  "netCashFlowChf": 182225,
                  "discountFactor": 0.9246,
                  "pvChf": 168477,
                  "cumulativePvChf": 270247
                },
                {
                  "year": 2028,
                  "projectedNoiChf": 194303,
                  "capexChf": 35910,
                  "taxShieldChf": 8945,
                  "netCashFlowChf": 167338,
                  "discountFactor": 0.889,
                  "pvChf": 148763,
                  "cumulativePvChf": 419010
                },
                {
                  "year": 2029,
                  "projectedNoiChf": 198286,
                  "capexChf": 16870,
                  "taxShieldChf": 3810,
                  "netCashFlowChf": 185226,
                  "discountFactor": 0.8548,
                  "pvChf": 158332,
                  "cumulativePvChf": 577342
                },
                {
                  "year": 2030,
                  "projectedNoiChf": 200248,
                  "capexChf": 13430,
                  "taxShieldChf": 2805,
                  "netCashFlowChf": 189623,
                  "discountFactor": 0.8219,
                  "pvChf": 155856,
                  "cumulativePvChf": 733198
                },
                {
                  "year": 2031,
                  "projectedNoiChf": 202229,
                  "capexChf": 7950,
                  "taxShieldChf": 1988,
                  "netCashFlowChf": 196267,
                  "discountFactor": 0.7903,
                  "pvChf": 155113,
                  "cumulativePvChf": 888311
                },
                {
                  "year": 2032,
                  "projectedNoiChf": 204230,
                  "capexChf": 120970,
                  "taxShieldChf": 16484,
                  "netCashFlowChf": 99744,
                  "discountFactor": 0.7599,
                  "pvChf": 75797,
                  "cumulativePvChf": 964108
                },
                {
                  "year": 2033,
                  "projectedNoiChf": 206252,
                  "capexChf": 13030,
                  "taxShieldChf": 2116,
                  "netCashFlowChf": 195338,
                  "discountFactor": 0.7307,
                  "pvChf": 142732,
                  "cumulativePvChf": 1106840
                },
                {
                  "year": 2034,
                  "projectedNoiChf": 208293,
                  "capexChf": 9120,
                  "taxShieldChf": 2272,
                  "netCashFlowChf": 201445,
                  "discountFactor": 0.7026,
                  "pvChf": 141533,
                  "cumulativePvChf": 1248373
                },
                {
                  "year": 2035,
                  "projectedNoiChf": 210355,
                  "capexChf": 13520,
                  "taxShieldChf": 2222,
                  "netCashFlowChf": 199057,
                  "discountFactor": 0.6756,
                  "pvChf": 134476,
                  "cumulativePvChf": 1382849
                }
              ],
              "levered": {
                "equityNpvChf": -95052,
                "equityIrrPct": 3.67,
                "minDscr": 0.6,
                "avgDscr": 0.66,
                "dscrByYear": [
                  0.6,
                  0.64,
                  0.65,
                  0.66,
                  0.67,
                  0.67,
                  0.68,
                  0.69,
                  0.69,
                  0.7
                ]
              }
            },
            "defer": {
              "npvChf": 5722246,
              "totalCapexChf": 330000,
              "totalTaxShieldChf": 55692,
              "totalNoiChf": 1962512,
              "terminalValuePvChf": 4357389,
              "yearlyFlows": [
                {
                  "year": 2026,
                  "projectedNoiChf": 181216,
                  "capexChf": 0,
                  "taxShieldChf": 0,
                  "netCashFlowChf": 181216,
                  "discountFactor": 0.9615,
                  "pvChf": 174246,
                  "cumulativePvChf": 174246
                },
                {
                  "year": 2027,
                  "projectedNoiChf": 183120,
                  "capexChf": 0,
                  "taxShieldChf": 0,
                  "netCashFlowChf": 183120,
                  "discountFactor": 0.9246,
                  "pvChf": 169305,
                  "cumulativePvChf": 343551
                },
                {
                  "year": 2028,
                  "projectedNoiChf": 185043,
                  "capexChf": 0,
                  "taxShieldChf": 0,
                  "netCashFlowChf": 185043,
                  "discountFactor": 0.889,
                  "pvChf": 164503,
                  "cumulativePvChf": 508054
                },
                {
                  "year": 2029,
                  "projectedNoiChf": 186986,
                  "capexChf": 104370,
                  "taxShieldChf": 15935,
                  "netCashFlowChf": 98551,
                  "discountFactor": 0.8548,
                  "pvChf": 84242,
                  "cumulativePvChf": 592296
                },
                {
                  "year": 2030,
                  "projectedNoiChf": 196828,
                  "capexChf": 25130,
                  "taxShieldChf": 5730,
                  "netCashFlowChf": 177428,
                  "discountFactor": 0.8219,
                  "pvChf": 145833,
                  "cumulativePvChf": 738129
                },
                {
                  "year": 2031,
                  "projectedNoiChf": 200189,
                  "capexChf": 43860,
                  "taxShieldChf": 10933,
                  "netCashFlowChf": 167262,
                  "discountFactor": 0.7903,
                  "pvChf": 132190,
                  "cumulativePvChf": 870319
                },
                {
                  "year": 2032,
                  "projectedNoiChf": 204230,
                  "capexChf": 120970,
                  "taxShieldChf": 16484,
                  "netCashFlowChf": 99744,
                  "discountFactor": 0.7599,
                  "pvChf": 75797,
                  "cumulativePvChf": 946116
                },
                {
                  "year": 2033,
                  "projectedNoiChf": 206252,
                  "capexChf": 13030,
                  "taxShieldChf": 2116,
                  "netCashFlowChf": 195338,
                  "discountFactor": 0.7307,
                  "pvChf": 142732,
                  "cumulativePvChf": 1088848
                },
                {
                  "year": 2034,
                  "projectedNoiChf": 208293,
                  "capexChf": 9120,
                  "taxShieldChf": 2272,
                  "netCashFlowChf": 201445,
                  "discountFactor": 0.7026,
                  "pvChf": 141533,
                  "cumulativePvChf": 1230381
                },
                {
                  "year": 2035,
                  "projectedNoiChf": 210355,
                  "capexChf": 13520,
                  "taxShieldChf": 2222,
                  "netCashFlowChf": 199057,
                  "discountFactor": 0.6756,
                  "pvChf": 134476,
                  "cumulativePvChf": 1364857
                }
              ],
              "levered": {
                "equityNpvChf": -113045,
                "equityIrrPct": 3.6,
                "minDscr": 0.6,
                "avgDscr": 0.65,
                "dscrByYear": [
                  0.6,
                  0.61,
                  0.62,
                  0.62,
                  0.66,
                  0.67,
                  0.68,
                  0.69,
                  0.69,
                  0.7
                ]
              }
            },
            "neglect": {
              "npvChf": 5639928,
              "totalCapexChf": 0,
              "totalTaxShieldChf": 0,
              "totalNoiChf": 1857868,
              "terminalValuePvChf": 4134453,
              "yearlyFlows": [
                {
                  "year": 2026,
                  "projectedNoiChf": 181216,
                  "capexChf": 0,
                  "taxShieldChf": 0,
                  "netCashFlowChf": 181216,
                  "discountFactor": 0.9615,
                  "pvChf": 174246,
                  "cumulativePvChf": 174246
                },
                {
                  "year": 2027,
                  "projectedNoiChf": 183120,
                  "capexChf": 0,
                  "taxShieldChf": 0,
                  "netCashFlowChf": 183120,
                  "discountFactor": 0.9246,
                  "pvChf": 169305,
                  "cumulativePvChf": 343551
                },
                {
                  "year": 2028,
                  "projectedNoiChf": 185043,
                  "capexChf": 0,
                  "taxShieldChf": 0,
                  "netCashFlowChf": 185043,
                  "discountFactor": 0.889,
                  "pvChf": 164503,
                  "cumulativePvChf": 508054
                },
                {
                  "year": 2029,
                  "projectedNoiChf": 186986,
                  "capexChf": 0,
                  "taxShieldChf": 0,
                  "netCashFlowChf": 186986,
                  "discountFactor": 0.8548,
                  "pvChf": 159836,
                  "cumulativePvChf": 667890
                },
                {
                  "year": 2030,
                  "projectedNoiChf": 186966,
                  "capexChf": 0,
                  "taxShieldChf": 0,
                  "netCashFlowChf": 186966,
                  "discountFactor": 0.8219,
                  "pvChf": 153672,
                  "cumulativePvChf": 821562
                },
                {
                  "year": 2031,
                  "projectedNoiChf": 186947,
                  "capexChf": 0,
                  "taxShieldChf": 0,
                  "netCashFlowChf": 186947,
                  "discountFactor": 0.7903,
                  "pvChf": 147747,
                  "cumulativePvChf": 969309
                },
                {
                  "year": 2032,
                  "projectedNoiChf": 186927,
                  "capexChf": 0,
                  "taxShieldChf": 0,
                  "netCashFlowChf": 186927,
                  "discountFactor": 0.7599,
                  "pvChf": 142049,
                  "cumulativePvChf": 1111358
                },
                {
                  "year": 2033,
                  "projectedNoiChf": 186907,
                  "capexChf": 0,
                  "taxShieldChf": 0,
                  "netCashFlowChf": 186907,
                  "discountFactor": 0.7307,
                  "pvChf": 136571,
                  "cumulativePvChf": 1247929
                },
                {
                  "year": 2034,
                  "projectedNoiChf": 186888,
                  "capexChf": 0,
                  "taxShieldChf": 0,
                  "netCashFlowChf": 186888,
                  "discountFactor": 0.7026,
                  "pvChf": 131305,
                  "cumulativePvChf": 1379234
                },
                {
                  "year": 2035,
                  "projectedNoiChf": 186868,
                  "capexChf": 0,
                  "taxShieldChf": 0,
                  "netCashFlowChf": 186868,
                  "discountFactor": 0.6756,
                  "pvChf": 126241,
                  "cumulativePvChf": 1505475
                }
              ],
              "levered": {
                "equityNpvChf": -195361,
                "equityIrrPct": 3.29,
                "minDscr": 0.6,
                "avgDscr": 0.62,
                "dscrByYear": [
                  0.6,
                  0.61,
                  0.62,
                  0.62,
                  0.62,
                  0.62,
                  0.62,
                  0.62,
                  0.62,
                  0.62
                ]
              }
            }
          },
          "terminalValueModeled": true,
          "propertyValueChf": 6450000,
          "neglectNoiErosionRatePct": 1,
          "ownerMarginalTaxRatePct": 25,
          "ownerTaxRateIsDefault": true,
          "fciCurrentPct": 4,
          "fciNeglectHorizonPct": 79.9,
          "totalReplacementValueChf": 412800,
          "debt": {
            "totalDebtChf": 3900000,
            "weightedCostOfDebtPct": 1.85,
            "ltvPct": 60.5,
            "waccPct": 2.42,
            "currentEquityChf": 2550000,
            "marketValueChf": 6450000,
            "costOfEquityPct": 4
          },
          "strategyContext": {
            "hasProfile": true,
            "source": "building",
            "archetype": "exit_optimizer",
            "roleIntent": "sell",
            "recommendedScenario": "defer",
            "rationale": "Exit-oriented profile with high sale readiness — minimising near-term capex preserves liquidity for a planned exit."
          }
        }
      }
    },
    "2": {
      "/buildings/demo-building/yield-goalseek": {
        "data": {
          "currentYieldPct": 2.57,
          "targetYieldPct": 3,
          "valueChf": 6535625,
          "currentNoiChf": 168256,
          "rentRollChf": 207360,
          "occupancyRate": 0.8333,
          "requiredNoiChf": 196068.75,
          "gapChf": 27812.75,
          "met": false,
          "strategySource": "building",
          "strategyFlags": {
            "renovation": false,
            "rentAggressive": true,
            "selfManage": false
          },
          "strategyLabel": "yield_maximizer",
          "levers": {
            "rent": {
              "deltaMonthlyChf": 2317.73,
              "pctOfRentRoll": 0.1341,
              "marketGapAnnualChf": 59685,
              "avgLeaseRemainingMonths": null,
              "feasible": true,
              "offStrategy": true
            },
            "opex": {
              "requiredReductionChf": 27812.75,
              "operatingCostChf": 61880,
              "headroomChf": 3094,
              "feasible": false,
              "offStrategy": false
            },
            "occupancy": {
              "requiredOccupancyRate": 0.9451,
              "feasible": true,
              "offStrategy": false
            },
            "mgmtFee": {
              "feeChf": 11487.74,
              "ppOfYield": 0.176,
              "gapCoverPct": 0.413,
              "selfManage": false,
              "feasible": true,
              "offStrategy": false
            },
            "renovation": {
              "lines": [
                {
                  "assetId": "6c634239-94ee-4688-b976-03d81ce89ec2",
                  "unitId": "demo-unit-0003",
                  "label": "Insulated windows (PVC/wood) — 0003",
                  "costChf": 1100,
                  "annualUpliftChf": 22,
                  "deltaValueChf": 715,
                  "marginalYieldPct": 3.08,
                  "accretive": true
                },
                {
                  "assetId": "dada94b5-2ae5-4989-8868-fccf5373a595",
                  "unitId": "demo-unit-0005",
                  "label": "Parquet flooring (mosaic) — 0005",
                  "costChf": 3500,
                  "annualUpliftChf": 43.75,
                  "deltaValueChf": 2275,
                  "marginalYieldPct": 1.92,
                  "accretive": false
                },
                {
                  "assetId": "a40eef84-b8e4-44a9-957e-fa408f9da8de",
                  "unitId": "demo-unit-0008",
                  "label": "Kitchen cabinets (chipboard) — 0008",
                  "costChf": 4500,
                  "annualUpliftChf": 150,
                  "deltaValueChf": 2925,
                  "marginalYieldPct": 5.13,
                  "accretive": true
                },
                {
                  "assetId": "50d1b281-b019-4f7e-bdaf-294af8355edc",
                  "unitId": "demo-unit-0003",
                  "label": "Kitchen cabinets (chipboard) — 0003",
                  "costChf": 4500,
                  "annualUpliftChf": 150,
                  "deltaValueChf": 2925,
                  "marginalYieldPct": 5.13,
                  "accretive": true
                },
                {
                  "assetId": "45ed30a9-f059-4cb0-9e2f-bfad84b311f9",
                  "unitId": "demo-unit-0006",
                  "label": "Interior doors (chipboard) — 0006",
                  "costChf": 450,
                  "annualUpliftChf": 9,
                  "deltaValueChf": 292.5,
                  "marginalYieldPct": 3.08,
                  "accretive": true
                },
                {
                  "assetId": "9850ddb9-679f-44dc-9ac3-c696192ab7f2",
                  "unitId": "demo-unit-0006",
                  "label": "Roller shutters (plastic) — 0006",
                  "costChf": 550,
                  "annualUpliftChf": 13.75,
                  "deltaValueChf": 357.5,
                  "marginalYieldPct": 3.85,
                  "accretive": true
                },
                {
                  "assetId": "0581e949-581f-4a4a-ae0c-f7da89f0de3f",
                  "unitId": "demo-unit-0008",
                  "label": "Power sockets — 0008",
                  "costChf": 130,
                  "annualUpliftChf": 4.33,
                  "deltaValueChf": 84.5,
                  "marginalYieldPct": 5.13,
                  "accretive": true
                },
                {
                  "assetId": "dc4ce34d-f394-4d4d-b771-a7b0baafca8d",
                  "unitId": "demo-unit-0001",
                  "label": "Kitchen tap — 0001",
                  "costChf": 400,
                  "annualUpliftChf": 10,
                  "deltaValueChf": 260,
                  "marginalYieldPct": 3.85,
                  "accretive": true
                },
                {
                  "assetId": "61216168-5e7e-431e-8cc7-3ba4d3b80073",
                  "unitId": "demo-unit-0002",
                  "label": "Power sockets — 0002",
                  "costChf": 130,
                  "annualUpliftChf": 4.33,
                  "deltaValueChf": 84.5,
                  "marginalYieldPct": 5.13,
                  "accretive": true
                },
                {
                  "assetId": "91b041f9-cd2c-408a-a929-94a53c03f89f",
                  "unitId": "demo-unit-0005",
                  "label": "Bathroom tap — 0005",
                  "costChf": 400,
                  "annualUpliftChf": 10,
                  "deltaValueChf": 260,
                  "marginalYieldPct": 3.85,
                  "accretive": true
                },
                {
                  "assetId": "c7cf90f2-0c6c-43d9-9b62-02ee6049b2e0",
                  "unitId": "demo-unit-0002",
                  "label": "Kitchen worktop (synthetic) — 0002",
                  "costChf": 1200,
                  "annualUpliftChf": 40,
                  "deltaValueChf": 780,
                  "marginalYieldPct": 5.13,
                  "accretive": true
                },
                {
                  "assetId": "bac575dc-2bff-432a-8f72-535b77cccadc",
                  "unitId": "demo-unit-0003",
                  "label": "Bathroom tap — 0003",
                  "costChf": 400,
                  "annualUpliftChf": 10,
                  "deltaValueChf": 260,
                  "marginalYieldPct": 3.85,
                  "accretive": true
                },
                {
                  "assetId": "02c95df5-f3c1-4072-b96a-6bcbcd0dc684",
                  "unitId": "demo-unit-0004",
                  "label": "Roller shutters (plastic) — 0004",
                  "costChf": 550,
                  "annualUpliftChf": 13.75,
                  "deltaValueChf": 357.5,
                  "marginalYieldPct": 3.85,
                  "accretive": true
                },
                {
                  "assetId": "55f097f4-fcc6-4ca4-a643-58e2bb025b00",
                  "unitId": "demo-unit-0004",
                  "label": "Wall paint (dispersion) — 0004",
                  "costChf": 2200,
                  "annualUpliftChf": 137.5,
                  "deltaValueChf": 1430,
                  "marginalYieldPct": 9.62,
                  "accretive": true
                },
                {
                  "assetId": "ac41b933-be89-48e0-82a3-ee702f81d509",
                  "unitId": "demo-unit-0005",
                  "label": "Light switches — 0005",
                  "costChf": 70,
                  "annualUpliftChf": 2.33,
                  "deltaValueChf": 45.5,
                  "marginalYieldPct": 5.13,
                  "accretive": true
                },
                {
                  "assetId": "58733997-0f0a-43e6-96e0-493710dfc4ba",
                  "unitId": "demo-unit-0007",
                  "label": "Sanitary ceramics (WC/basin) — 0007",
                  "costChf": 1200,
                  "annualUpliftChf": 17.14,
                  "deltaValueChf": 780,
                  "marginalYieldPct": 2.2,
                  "accretive": false
                },
                {
                  "assetId": "ca58ae14-5da2-4143-ac28-6facf4dd5e0f",
                  "unitId": "demo-unit-0008",
                  "label": "Balcony railing (metal) — 0008",
                  "costChf": 800,
                  "annualUpliftChf": 13.33,
                  "deltaValueChf": 520,
                  "marginalYieldPct": 2.56,
                  "accretive": false
                },
                {
                  "assetId": "2e9fbb78-1b17-42cb-b283-1c49f74dfb1a",
                  "unitId": "demo-unit-0008",
                  "label": "Bathroom tiles (ceramic) — 0008",
                  "costChf": 2200,
                  "annualUpliftChf": 36.67,
                  "deltaValueChf": 1430,
                  "marginalYieldPct": 2.56,
                  "accretive": false
                },
                {
                  "assetId": "e29c9d98-9f30-4e86-bfa0-38595f75afe3",
                  "unitId": "demo-unit-0006",
                  "label": "Wall paint (dispersion) — 0006",
                  "costChf": 2200,
                  "annualUpliftChf": 137.5,
                  "deltaValueChf": 1430,
                  "marginalYieldPct": 9.62,
                  "accretive": true
                },
                {
                  "assetId": "cdcd4dd1-604c-4dce-a25d-fd25c2cb8c0e",
                  "unitId": "demo-unit-0001",
                  "label": "Kitchen worktop (synthetic) — 0001",
                  "costChf": 1200,
                  "annualUpliftChf": 40,
                  "deltaValueChf": 780,
                  "marginalYieldPct": 5.13,
                  "accretive": true
                },
                {
                  "assetId": "dc7ed960-a649-4727-9652-c847277e5cff",
                  "unitId": "demo-unit-0001",
                  "label": "Insulated windows (PVC/wood) — 0001",
                  "costChf": 1100,
                  "annualUpliftChf": 22,
                  "deltaValueChf": 715,
                  "marginalYieldPct": 3.08,
                  "accretive": true
                },
                {
                  "assetId": "9a85dc6c-88c1-4fbe-bf56-603a60abf0a7",
                  "unitId": "demo-unit-0002",
                  "label": "Bathtub (acrylic) — 0002",
                  "costChf": 900,
                  "annualUpliftChf": 18,
                  "deltaValueChf": 585,
                  "marginalYieldPct": 3.08,
                  "accretive": true
                },
                {
                  "assetId": "41d16db4-e57d-40a5-b27b-eec76be78f29",
                  "unitId": "demo-unit-0003",
                  "label": "Roller shutters (plastic) — 0003",
                  "costChf": 550,
                  "annualUpliftChf": 13.75,
                  "deltaValueChf": 357.5,
                  "marginalYieldPct": 3.85,
                  "accretive": true
                },
                {
                  "assetId": "4731f5fb-707c-4cae-a81f-d497b47e202a",
                  "unitId": "demo-unit-0003",
                  "label": "Wall paint (dispersion) — 0003",
                  "costChf": 2200,
                  "annualUpliftChf": 137.5,
                  "deltaValueChf": 1430,
                  "marginalYieldPct": 9.62,
                  "accretive": true
                },
                {
                  "assetId": "33e4f919-5713-41cf-a138-ce49e9977bf2",
                  "unitId": "demo-unit-0003",
                  "label": "Power sockets — 0003",
                  "costChf": 130,
                  "annualUpliftChf": 4.33,
                  "deltaValueChf": 84.5,
                  "marginalYieldPct": 5.13,
                  "accretive": true
                },
                {
                  "assetId": "87fa03d4-bcde-4366-8042-93d7435bbe1d",
                  "unitId": "demo-unit-0006",
                  "label": "Bathroom tap — 0006",
                  "costChf": 400,
                  "annualUpliftChf": 10,
                  "deltaValueChf": 260,
                  "marginalYieldPct": 3.85,
                  "accretive": true
                },
                {
                  "assetId": "5deed3d2-85f9-4338-89ed-c47dbefce005",
                  "unitId": "demo-unit-0006",
                  "label": "Bathtub (acrylic) — 0006",
                  "costChf": 900,
                  "annualUpliftChf": 18,
                  "deltaValueChf": 585,
                  "marginalYieldPct": 3.08,
                  "accretive": true
                },
                {
                  "assetId": "e4275079-9010-446e-91dd-f7a61e8157fb",
                  "unitId": "demo-unit-0006",
                  "label": "Kitchen tap — 0006",
                  "costChf": 400,
                  "annualUpliftChf": 10,
                  "deltaValueChf": 260,
                  "marginalYieldPct": 3.85,
                  "accretive": true
                },
                {
                  "assetId": "b6111e02-6a28-4a94-bbfa-227b79f1e24a",
                  "unitId": "demo-unit-0006",
                  "label": "Light switches — 0006",
                  "costChf": 70,
                  "annualUpliftChf": 2.33,
                  "deltaValueChf": 45.5,
                  "marginalYieldPct": 5.13,
                  "accretive": true
                },
                {
                  "assetId": "f77ae1ad-4ce9-4a8a-8163-02f139db7763",
                  "unitId": "demo-unit-0007",
                  "label": "Interior doors (chipboard) — 0007",
                  "costChf": 450,
                  "annualUpliftChf": 9,
                  "deltaValueChf": 292.5,
                  "marginalYieldPct": 3.08,
                  "accretive": true
                },
                {
                  "assetId": "6d7aaa72-8631-4b77-8bf8-7c7feaccaa85",
                  "unitId": "demo-unit-0007",
                  "label": "Bathroom tiles (ceramic) — 0007",
                  "costChf": 2200,
                  "annualUpliftChf": 36.67,
                  "deltaValueChf": 1430,
                  "marginalYieldPct": 2.56,
                  "accretive": false
                },
                {
                  "assetId": "96a56bb1-5085-4a5c-9df1-a3af9fb2c26a",
                  "unitId": "demo-unit-0008",
                  "label": "Balcony (metal) — 0008",
                  "costChf": 4500,
                  "annualUpliftChf": 56.25,
                  "deltaValueChf": 2925,
                  "marginalYieldPct": 1.92,
                  "accretive": false
                },
                {
                  "assetId": "347394e1-bdaa-4774-8845-60fd14753ade",
                  "unitId": "demo-unit-0001",
                  "label": "Kitchen tiles (ceramic) — 0001",
                  "costChf": 1600,
                  "annualUpliftChf": 26.67,
                  "deltaValueChf": 1040,
                  "marginalYieldPct": 2.56,
                  "accretive": false
                },
                {
                  "assetId": "f3bbaccd-5ff8-46ac-93ca-4d13471c4786",
                  "unitId": "demo-unit-0003",
                  "label": "Balcony railing (metal) — 0003",
                  "costChf": 800,
                  "annualUpliftChf": 13.33,
                  "deltaValueChf": 520,
                  "marginalYieldPct": 2.56,
                  "accretive": false
                },
                {
                  "assetId": "50d4329b-50c3-48cf-b25f-28f1d397a119",
                  "unitId": "demo-unit-0003",
                  "label": "Kitchen worktop (synthetic) — 0003",
                  "costChf": 1200,
                  "annualUpliftChf": 40,
                  "deltaValueChf": 780,
                  "marginalYieldPct": 5.13,
                  "accretive": true
                },
                {
                  "assetId": "82fe8641-7a63-4de3-a70c-14152b2e9fe7",
                  "unitId": "demo-unit-0007",
                  "label": "Roller shutters (plastic) — 0007",
                  "costChf": 550,
                  "annualUpliftChf": 13.75,
                  "deltaValueChf": 357.5,
                  "marginalYieldPct": 3.85,
                  "accretive": true
                },
                {
                  "assetId": "29743c70-02ea-40f1-8a8c-f288eefd82f0",
                  "unitId": "demo-unit-0007",
                  "label": "Wall paint (dispersion) — 0007",
                  "costChf": 2200,
                  "annualUpliftChf": 137.5,
                  "deltaValueChf": 1430,
                  "marginalYieldPct": 9.62,
                  "accretive": true
                },
                {
                  "assetId": "597b7d69-524b-44a5-9993-b5888438b8bf",
                  "unitId": "demo-unit-0008",
                  "label": "Bathroom tap — 0008",
                  "costChf": 400,
                  "annualUpliftChf": 10,
                  "deltaValueChf": 260,
                  "marginalYieldPct": 3.85,
                  "accretive": true
                },
                {
                  "assetId": "f8d26c10-749f-4cf7-8ab7-0fdf66e160e0",
                  "unitId": "demo-unit-0001",
                  "label": "Balcony (metal) — 0001",
                  "costChf": 4500,
                  "annualUpliftChf": 56.25,
                  "deltaValueChf": 2925,
                  "marginalYieldPct": 1.92,
                  "accretive": false
                },
                {
                  "assetId": "fed929a9-6bb4-4d5a-8d9d-ffd3faa52618",
                  "unitId": "demo-unit-0002",
                  "label": "Parquet flooring (mosaic) — 0002",
                  "costChf": 3500,
                  "annualUpliftChf": 43.75,
                  "deltaValueChf": 2275,
                  "marginalYieldPct": 1.92,
                  "accretive": false
                },
                {
                  "assetId": "15bddbbb-3b21-4889-afdd-faad0b69445b",
                  "unitId": "demo-unit-0004",
                  "label": "Balcony railing (metal) — 0004",
                  "costChf": 800,
                  "annualUpliftChf": 13.33,
                  "deltaValueChf": 520,
                  "marginalYieldPct": 2.56,
                  "accretive": false
                },
                {
                  "assetId": "6eb046ea-15c7-4bea-94a5-edf1298e0efd",
                  "unitId": "demo-unit-0005",
                  "label": "Kitchen cabinets (chipboard) — 0005",
                  "costChf": 4500,
                  "annualUpliftChf": 150,
                  "deltaValueChf": 2925,
                  "marginalYieldPct": 5.13,
                  "accretive": true
                },
                {
                  "assetId": "792f3563-0ea1-453b-b6a5-5833772b99c6",
                  "unitId": "demo-unit-0006",
                  "label": "Insulated windows (PVC/wood) — 0006",
                  "costChf": 1100,
                  "annualUpliftChf": 22,
                  "deltaValueChf": 715,
                  "marginalYieldPct": 3.08,
                  "accretive": true
                },
                {
                  "assetId": "08fcba5d-ce14-4a56-a79d-a0b8162d88ba",
                  "unitId": "demo-unit-0007",
                  "label": "Bathroom tap — 0007",
                  "costChf": 400,
                  "annualUpliftChf": 10,
                  "deltaValueChf": 260,
                  "marginalYieldPct": 3.85,
                  "accretive": true
                },
                {
                  "assetId": "03f837b4-5c88-4273-89f6-20196359864f",
                  "unitId": "demo-unit-0008",
                  "label": "Parquet flooring (mosaic) — 0008",
                  "costChf": 3500,
                  "annualUpliftChf": 43.75,
                  "deltaValueChf": 2275,
                  "marginalYieldPct": 1.92,
                  "accretive": false
                },
                {
                  "assetId": "a3ae7efb-bb6d-4ac7-87e0-9780a24736f9",
                  "unitId": "demo-unit-0001",
                  "label": "Balcony railing (metal) — 0001",
                  "costChf": 800,
                  "annualUpliftChf": 13.33,
                  "deltaValueChf": 520,
                  "marginalYieldPct": 2.56,
                  "accretive": false
                },
                {
                  "assetId": "0bf59d2d-31b7-450c-a0dc-d955e1845461",
                  "unitId": "demo-unit-0004",
                  "label": "Bathtub (acrylic) — 0004",
                  "costChf": 900,
                  "annualUpliftChf": 18,
                  "deltaValueChf": 585,
                  "marginalYieldPct": 3.08,
                  "accretive": true
                },
                {
                  "assetId": "f7040c38-9a3a-44d4-a62d-2617c7cce8e7",
                  "unitId": "demo-unit-0004",
                  "label": "Kitchen tap — 0004",
                  "costChf": 400,
                  "annualUpliftChf": 10,
                  "deltaValueChf": 260,
                  "marginalYieldPct": 3.85,
                  "accretive": true
                },
                {
                  "assetId": "3f1a28ca-2d61-4f95-a3b4-9508beb16d9b",
                  "unitId": "demo-unit-0005",
                  "label": "Kitchen tiles (ceramic) — 0005",
                  "costChf": 1600,
                  "annualUpliftChf": 26.67,
                  "deltaValueChf": 1040,
                  "marginalYieldPct": 2.56,
                  "accretive": false
                },
                {
                  "assetId": "3a7024af-7bc7-4ec1-abf3-adb5741758a1",
                  "unitId": "demo-unit-0007",
                  "label": "Insulated windows (PVC/wood) — 0007",
                  "costChf": 1100,
                  "annualUpliftChf": 22,
                  "deltaValueChf": 715,
                  "marginalYieldPct": 3.08,
                  "accretive": true
                },
                {
                  "assetId": "a3f412c3-d042-423e-b3cb-5838c784d157",
                  "unitId": "demo-unit-0007",
                  "label": "Power sockets — 0007",
                  "costChf": 130,
                  "annualUpliftChf": 4.33,
                  "deltaValueChf": 84.5,
                  "marginalYieldPct": 5.13,
                  "accretive": true
                },
                {
                  "assetId": "f835d7c4-588f-4095-86ae-1d20f6115a1f",
                  "unitId": "demo-unit-0008",
                  "label": "Kitchen tap — 0008",
                  "costChf": 400,
                  "annualUpliftChf": 10,
                  "deltaValueChf": 260,
                  "marginalYieldPct": 3.85,
                  "accretive": true
                },
                {
                  "assetId": "09f5897d-1e6c-4675-8294-c8972adb606a",
                  "unitId": "demo-unit-0008",
                  "label": "Wall paint (dispersion) — 0008",
                  "costChf": 2200,
                  "annualUpliftChf": 137.5,
                  "deltaValueChf": 1430,
                  "marginalYieldPct": 9.62,
                  "accretive": true
                }
              ],
              "accretiveCount": 39,
              "ceilingYieldPct": 2.59,
              "feasible": false,
              "offStrategy": false,
              "capexChf": 42560,
              "annualUpliftChf": 1584.48,
              "deltaValueChf": 27664
            }
          },
          "synthesis": {
            "withinStrategyYieldPct": 3.4,
            "withRenovationYieldPct": 3.41,
            "withSelfManageYieldPct": 3.44
          },
          "currentFeePct": 5.54,
          "feeSource": "statements",
          "opexDrivers": [
            {
              "label": "Chauffage et eau chaude",
              "annualChf": 19350,
              "category": "RECOVERABLE"
            },
            {
              "label": "Conciergerie et nettoyage",
              "annualChf": 14400,
              "category": "RECOVERABLE"
            },
            {
              "label": "Entretien des appartements",
              "annualChf": 7040,
              "category": "OWNER_OPEX"
            },
            {
              "label": "Assurances immeuble",
              "annualChf": 5420,
              "category": "OWNER_OPEX"
            },
            {
              "label": "Entretien parties communes",
              "annualChf": 5380,
              "category": "OWNER_OPEX"
            },
            {
              "label": "Eau et épuration",
              "annualChf": 5350,
              "category": "RECOVERABLE"
            }
          ],
          "strategyOwnerName": null,
          "occupancyGainAnnualChf": 32064,
          "vacantUnits": [
            {
              "label": "9004",
              "kind": "parking",
              "expectedAnnualChf": 1872,
              "hasAskingRent": true
            },
            {
              "label": "0008",
              "kind": "residential",
              "expectedAnnualChf": 30192,
              "hasAskingRent": true
            }
          ],
          "rentMarketDetail": [
            {
              "label": "0005",
              "livingAreaSqm": 104,
              "pricePerSqmChf": 13500,
              "grossYieldPct": 3.3,
              "vetustePct": 29,
              "currentAnnualChf": 30660,
              "marketAnnualChf": 40957,
              "gapChf": 10297
            },
            {
              "label": "0003",
              "livingAreaSqm": 102,
              "pricePerSqmChf": 13500,
              "grossYieldPct": 3.3,
              "vetustePct": 32,
              "currentAnnualChf": 29724,
              "marketAnnualChf": 39625,
              "gapChf": 9901
            },
            {
              "label": "0008",
              "livingAreaSqm": 101,
              "pricePerSqmChf": 13500,
              "grossYieldPct": 3.3,
              "vetustePct": 29,
              "currentAnnualChf": 30192,
              "marketAnnualChf": 39776,
              "gapChf": 9584
            },
            {
              "label": "0007",
              "livingAreaSqm": 79,
              "pricePerSqmChf": 13500,
              "grossYieldPct": 3.3,
              "vetustePct": 26,
              "currentAnnualChf": 23520,
              "marketAnnualChf": 31534,
              "gapChf": 8014
            },
            {
              "label": "0001",
              "livingAreaSqm": 78,
              "pricePerSqmChf": 13500,
              "grossYieldPct": 3.3,
              "vetustePct": 26,
              "currentAnnualChf": 23172,
              "marketAnnualChf": 31135,
              "gapChf": 7963
            },
            {
              "label": "0004",
              "livingAreaSqm": 80,
              "pricePerSqmChf": 13500,
              "grossYieldPct": 3.3,
              "vetustePct": 26,
              "currentAnnualChf": 23988,
              "marketAnnualChf": 31933,
              "gapChf": 7945
            },
            {
              "label": "0002",
              "livingAreaSqm": 58,
              "pricePerSqmChf": 13500,
              "grossYieldPct": 3.3,
              "vetustePct": 29,
              "currentAnnualChf": 18840,
              "marketAnnualChf": 22842,
              "gapChf": 4002
            },
            {
              "label": "0006",
              "livingAreaSqm": 56,
              "pricePerSqmChf": 13500,
              "grossYieldPct": 3.3,
              "vetustePct": 32,
              "currentAnnualChf": 19776,
              "marketAnnualChf": 21755,
              "gapChf": 1979
            }
          ],
          "rentMarketBasis": {
            "grossYieldPct": 3.3,
            "vetusteCoeffPct": 40,
            "pricePerSqmSource": "intrinsic"
          },
          "periodFrom": "2025-01-01",
          "periodTo": "2025-12-31"
        }
      },
      "/cashflow-plans/demo-plan/npv-scenarios": {
        "data": {
          "buildingId": "demo-building",
          "buildingName": "Résidence des Charmilles",
          "discountRatePct": 4,
          "incomeGrowthRatePct": 1,
          "horizonYears": 10,
          "deferYears": 3,
          "baseAnnualNoiChf": 190416,
          "noIncomeData": false,
          "noiEstimatedFromRent": true,
          "fromYear": 2026,
          "toYear": 2035,
          "scenarios": {
            "invest": {
              "npvChf": 5740238,
              "totalCapexChf": 330000,
              "totalTaxShieldChf": 55692,
              "totalNoiChf": 1996412,
              "terminalValuePvChf": 4357389,
              "yearlyFlows": [
                {
                  "year": 2026,
                  "projectedNoiChf": 181216,
                  "capexChf": 87500,
                  "taxShieldChf": 12125,
                  "netCashFlowChf": 105841,
                  "discountFactor": 0.9615,
                  "pvChf": 101770,
                  "cumulativePvChf": 101770
                },
                {
                  "year": 2027,
                  "projectedNoiChf": 191000,
                  "capexChf": 11700,
                  "taxShieldChf": 2925,
                  "netCashFlowChf": 182225,
                  "discountFactor": 0.9246,
                  "pvChf": 168477,
                  "cumulativePvChf": 270247
                },
                {
                  "year": 2028,
                  "projectedNoiChf": 194303,
                  "capexChf": 35910,
                  "taxShieldChf": 8945,
                  "netCashFlowChf": 167338,
                  "discountFactor": 0.889,
                  "pvChf": 148763,
                  "cumulativePvChf": 419010
                },
                {
                  "year": 2029,
                  "projectedNoiChf": 198286,
                  "capexChf": 16870,
                  "taxShieldChf": 3810,
                  "netCashFlowChf": 185226,
                  "discountFactor": 0.8548,
                  "pvChf": 158332,
                  "cumulativePvChf": 577342
                },
                {
                  "year": 2030,
                  "projectedNoiChf": 200248,
                  "capexChf": 13430,
                  "taxShieldChf": 2805,
                  "netCashFlowChf": 189623,
                  "discountFactor": 0.8219,
                  "pvChf": 155856,
                  "cumulativePvChf": 733198
                },
                {
                  "year": 2031,
                  "projectedNoiChf": 202229,
                  "capexChf": 7950,
                  "taxShieldChf": 1988,
                  "netCashFlowChf": 196267,
                  "discountFactor": 0.7903,
                  "pvChf": 155113,
                  "cumulativePvChf": 888311
                },
                {
                  "year": 2032,
                  "projectedNoiChf": 204230,
                  "capexChf": 120970,
                  "taxShieldChf": 16484,
                  "netCashFlowChf": 99744,
                  "discountFactor": 0.7599,
                  "pvChf": 75797,
                  "cumulativePvChf": 964108
                },
                {
                  "year": 2033,
                  "projectedNoiChf": 206252,
                  "capexChf": 13030,
                  "taxShieldChf": 2116,
                  "netCashFlowChf": 195338,
                  "discountFactor": 0.7307,
                  "pvChf": 142732,
                  "cumulativePvChf": 1106840
                },
                {
                  "year": 2034,
                  "projectedNoiChf": 208293,
                  "capexChf": 9120,
                  "taxShieldChf": 2272,
                  "netCashFlowChf": 201445,
                  "discountFactor": 0.7026,
                  "pvChf": 141533,
                  "cumulativePvChf": 1248373
                },
                {
                  "year": 2035,
                  "projectedNoiChf": 210355,
                  "capexChf": 13520,
                  "taxShieldChf": 2222,
                  "netCashFlowChf": 199057,
                  "discountFactor": 0.6756,
                  "pvChf": 134476,
                  "cumulativePvChf": 1382849
                }
              ],
              "levered": {
                "equityNpvChf": -95052,
                "equityIrrPct": 3.67,
                "minDscr": 0.6,
                "avgDscr": 0.66,
                "dscrByYear": [
                  0.6,
                  0.64,
                  0.65,
                  0.66,
                  0.67,
                  0.67,
                  0.68,
                  0.69,
                  0.69,
                  0.7
                ]
              }
            },
            "defer": {
              "npvChf": 5722246,
              "totalCapexChf": 330000,
              "totalTaxShieldChf": 55692,
              "totalNoiChf": 1962512,
              "terminalValuePvChf": 4357389,
              "yearlyFlows": [
                {
                  "year": 2026,
                  "projectedNoiChf": 181216,
                  "capexChf": 0,
                  "taxShieldChf": 0,
                  "netCashFlowChf": 181216,
                  "discountFactor": 0.9615,
                  "pvChf": 174246,
                  "cumulativePvChf": 174246
                },
                {
                  "year": 2027,
                  "projectedNoiChf": 183120,
                  "capexChf": 0,
                  "taxShieldChf": 0,
                  "netCashFlowChf": 183120,
                  "discountFactor": 0.9246,
                  "pvChf": 169305,
                  "cumulativePvChf": 343551
                },
                {
                  "year": 2028,
                  "projectedNoiChf": 185043,
                  "capexChf": 0,
                  "taxShieldChf": 0,
                  "netCashFlowChf": 185043,
                  "discountFactor": 0.889,
                  "pvChf": 164503,
                  "cumulativePvChf": 508054
                },
                {
                  "year": 2029,
                  "projectedNoiChf": 186986,
                  "capexChf": 104370,
                  "taxShieldChf": 15935,
                  "netCashFlowChf": 98551,
                  "discountFactor": 0.8548,
                  "pvChf": 84242,
                  "cumulativePvChf": 592296
                },
                {
                  "year": 2030,
                  "projectedNoiChf": 196828,
                  "capexChf": 25130,
                  "taxShieldChf": 5730,
                  "netCashFlowChf": 177428,
                  "discountFactor": 0.8219,
                  "pvChf": 145833,
                  "cumulativePvChf": 738129
                },
                {
                  "year": 2031,
                  "projectedNoiChf": 200189,
                  "capexChf": 43860,
                  "taxShieldChf": 10933,
                  "netCashFlowChf": 167262,
                  "discountFactor": 0.7903,
                  "pvChf": 132190,
                  "cumulativePvChf": 870319
                },
                {
                  "year": 2032,
                  "projectedNoiChf": 204230,
                  "capexChf": 120970,
                  "taxShieldChf": 16484,
                  "netCashFlowChf": 99744,
                  "discountFactor": 0.7599,
                  "pvChf": 75797,
                  "cumulativePvChf": 946116
                },
                {
                  "year": 2033,
                  "projectedNoiChf": 206252,
                  "capexChf": 13030,
                  "taxShieldChf": 2116,
                  "netCashFlowChf": 195338,
                  "discountFactor": 0.7307,
                  "pvChf": 142732,
                  "cumulativePvChf": 1088848
                },
                {
                  "year": 2034,
                  "projectedNoiChf": 208293,
                  "capexChf": 9120,
                  "taxShieldChf": 2272,
                  "netCashFlowChf": 201445,
                  "discountFactor": 0.7026,
                  "pvChf": 141533,
                  "cumulativePvChf": 1230381
                },
                {
                  "year": 2035,
                  "projectedNoiChf": 210355,
                  "capexChf": 13520,
                  "taxShieldChf": 2222,
                  "netCashFlowChf": 199057,
                  "discountFactor": 0.6756,
                  "pvChf": 134476,
                  "cumulativePvChf": 1364857
                }
              ],
              "levered": {
                "equityNpvChf": -113045,
                "equityIrrPct": 3.6,
                "minDscr": 0.6,
                "avgDscr": 0.65,
                "dscrByYear": [
                  0.6,
                  0.61,
                  0.62,
                  0.62,
                  0.66,
                  0.67,
                  0.68,
                  0.69,
                  0.69,
                  0.7
                ]
              }
            },
            "neglect": {
              "npvChf": 5639928,
              "totalCapexChf": 0,
              "totalTaxShieldChf": 0,
              "totalNoiChf": 1857868,
              "terminalValuePvChf": 4134453,
              "yearlyFlows": [
                {
                  "year": 2026,
                  "projectedNoiChf": 181216,
                  "capexChf": 0,
                  "taxShieldChf": 0,
                  "netCashFlowChf": 181216,
                  "discountFactor": 0.9615,
                  "pvChf": 174246,
                  "cumulativePvChf": 174246
                },
                {
                  "year": 2027,
                  "projectedNoiChf": 183120,
                  "capexChf": 0,
                  "taxShieldChf": 0,
                  "netCashFlowChf": 183120,
                  "discountFactor": 0.9246,
                  "pvChf": 169305,
                  "cumulativePvChf": 343551
                },
                {
                  "year": 2028,
                  "projectedNoiChf": 185043,
                  "capexChf": 0,
                  "taxShieldChf": 0,
                  "netCashFlowChf": 185043,
                  "discountFactor": 0.889,
                  "pvChf": 164503,
                  "cumulativePvChf": 508054
                },
                {
                  "year": 2029,
                  "projectedNoiChf": 186986,
                  "capexChf": 0,
                  "taxShieldChf": 0,
                  "netCashFlowChf": 186986,
                  "discountFactor": 0.8548,
                  "pvChf": 159836,
                  "cumulativePvChf": 667890
                },
                {
                  "year": 2030,
                  "projectedNoiChf": 186966,
                  "capexChf": 0,
                  "taxShieldChf": 0,
                  "netCashFlowChf": 186966,
                  "discountFactor": 0.8219,
                  "pvChf": 153672,
                  "cumulativePvChf": 821562
                },
                {
                  "year": 2031,
                  "projectedNoiChf": 186947,
                  "capexChf": 0,
                  "taxShieldChf": 0,
                  "netCashFlowChf": 186947,
                  "discountFactor": 0.7903,
                  "pvChf": 147747,
                  "cumulativePvChf": 969309
                },
                {
                  "year": 2032,
                  "projectedNoiChf": 186927,
                  "capexChf": 0,
                  "taxShieldChf": 0,
                  "netCashFlowChf": 186927,
                  "discountFactor": 0.7599,
                  "pvChf": 142049,
                  "cumulativePvChf": 1111358
                },
                {
                  "year": 2033,
                  "projectedNoiChf": 186907,
                  "capexChf": 0,
                  "taxShieldChf": 0,
                  "netCashFlowChf": 186907,
                  "discountFactor": 0.7307,
                  "pvChf": 136571,
                  "cumulativePvChf": 1247929
                },
                {
                  "year": 2034,
                  "projectedNoiChf": 186888,
                  "capexChf": 0,
                  "taxShieldChf": 0,
                  "netCashFlowChf": 186888,
                  "discountFactor": 0.7026,
                  "pvChf": 131305,
                  "cumulativePvChf": 1379234
                },
                {
                  "year": 2035,
                  "projectedNoiChf": 186868,
                  "capexChf": 0,
                  "taxShieldChf": 0,
                  "netCashFlowChf": 186868,
                  "discountFactor": 0.6756,
                  "pvChf": 126241,
                  "cumulativePvChf": 1505475
                }
              ],
              "levered": {
                "equityNpvChf": -195361,
                "equityIrrPct": 3.29,
                "minDscr": 0.6,
                "avgDscr": 0.62,
                "dscrByYear": [
                  0.6,
                  0.61,
                  0.62,
                  0.62,
                  0.62,
                  0.62,
                  0.62,
                  0.62,
                  0.62,
                  0.62
                ]
              }
            }
          },
          "terminalValueModeled": true,
          "propertyValueChf": 6450000,
          "neglectNoiErosionRatePct": 1,
          "ownerMarginalTaxRatePct": 25,
          "ownerTaxRateIsDefault": true,
          "fciCurrentPct": 4,
          "fciNeglectHorizonPct": 79.9,
          "totalReplacementValueChf": 412800,
          "debt": {
            "totalDebtChf": 3900000,
            "weightedCostOfDebtPct": 1.85,
            "ltvPct": 60.5,
            "waccPct": 2.42,
            "currentEquityChf": 2550000,
            "marketValueChf": 6450000,
            "costOfEquityPct": 4
          },
          "strategyContext": {
            "hasProfile": true,
            "source": "building",
            "archetype": "yield_maximizer",
            "roleIntent": "income",
            "recommendedScenario": "invest",
            "rationale": "Yield-maximiser profile — executing capex on schedule protects rental income and prevents NOI erosion."
          }
        }
      }
    },
    "3": {
      "/buildings/demo-building/yield-goalseek": {
        "data": {
          "currentYieldPct": 2.57,
          "targetYieldPct": 3,
          "valueChf": 6535625,
          "currentNoiChf": 168256,
          "rentRollChf": 207360,
          "occupancyRate": 0.8333,
          "requiredNoiChf": 196068.75,
          "gapChf": 27812.75,
          "met": false,
          "strategySource": "building",
          "strategyFlags": {
            "renovation": false,
            "rentAggressive": false,
            "selfManage": false
          },
          "strategyLabel": "value_builder",
          "levers": {
            "rent": {
              "deltaMonthlyChf": 2317.73,
              "pctOfRentRoll": 0.1341,
              "marketGapAnnualChf": 59685,
              "avgLeaseRemainingMonths": null,
              "feasible": true,
              "offStrategy": false
            },
            "opex": {
              "requiredReductionChf": 27812.75,
              "operatingCostChf": 61880,
              "headroomChf": 3094,
              "feasible": false,
              "offStrategy": false
            },
            "occupancy": {
              "requiredOccupancyRate": 0.9451,
              "feasible": true,
              "offStrategy": false
            },
            "mgmtFee": {
              "feeChf": 11487.74,
              "ppOfYield": 0.176,
              "gapCoverPct": 0.413,
              "selfManage": false,
              "feasible": true,
              "offStrategy": false
            },
            "renovation": {
              "lines": [
                {
                  "assetId": "6c634239-94ee-4688-b976-03d81ce89ec2",
                  "unitId": "demo-unit-0003",
                  "label": "Insulated windows (PVC/wood) — 0003",
                  "costChf": 1100,
                  "annualUpliftChf": 22,
                  "deltaValueChf": 715,
                  "marginalYieldPct": 3.08,
                  "accretive": true
                },
                {
                  "assetId": "dada94b5-2ae5-4989-8868-fccf5373a595",
                  "unitId": "demo-unit-0005",
                  "label": "Parquet flooring (mosaic) — 0005",
                  "costChf": 3500,
                  "annualUpliftChf": 43.75,
                  "deltaValueChf": 2275,
                  "marginalYieldPct": 1.92,
                  "accretive": false
                },
                {
                  "assetId": "a40eef84-b8e4-44a9-957e-fa408f9da8de",
                  "unitId": "demo-unit-0008",
                  "label": "Kitchen cabinets (chipboard) — 0008",
                  "costChf": 4500,
                  "annualUpliftChf": 150,
                  "deltaValueChf": 2925,
                  "marginalYieldPct": 5.13,
                  "accretive": true
                },
                {
                  "assetId": "50d1b281-b019-4f7e-bdaf-294af8355edc",
                  "unitId": "demo-unit-0003",
                  "label": "Kitchen cabinets (chipboard) — 0003",
                  "costChf": 4500,
                  "annualUpliftChf": 150,
                  "deltaValueChf": 2925,
                  "marginalYieldPct": 5.13,
                  "accretive": true
                },
                {
                  "assetId": "45ed30a9-f059-4cb0-9e2f-bfad84b311f9",
                  "unitId": "demo-unit-0006",
                  "label": "Interior doors (chipboard) — 0006",
                  "costChf": 450,
                  "annualUpliftChf": 9,
                  "deltaValueChf": 292.5,
                  "marginalYieldPct": 3.08,
                  "accretive": true
                },
                {
                  "assetId": "9850ddb9-679f-44dc-9ac3-c696192ab7f2",
                  "unitId": "demo-unit-0006",
                  "label": "Roller shutters (plastic) — 0006",
                  "costChf": 550,
                  "annualUpliftChf": 13.75,
                  "deltaValueChf": 357.5,
                  "marginalYieldPct": 3.85,
                  "accretive": true
                },
                {
                  "assetId": "0581e949-581f-4a4a-ae0c-f7da89f0de3f",
                  "unitId": "demo-unit-0008",
                  "label": "Power sockets — 0008",
                  "costChf": 130,
                  "annualUpliftChf": 4.33,
                  "deltaValueChf": 84.5,
                  "marginalYieldPct": 5.13,
                  "accretive": true
                },
                {
                  "assetId": "dc4ce34d-f394-4d4d-b771-a7b0baafca8d",
                  "unitId": "demo-unit-0001",
                  "label": "Kitchen tap — 0001",
                  "costChf": 400,
                  "annualUpliftChf": 10,
                  "deltaValueChf": 260,
                  "marginalYieldPct": 3.85,
                  "accretive": true
                },
                {
                  "assetId": "61216168-5e7e-431e-8cc7-3ba4d3b80073",
                  "unitId": "demo-unit-0002",
                  "label": "Power sockets — 0002",
                  "costChf": 130,
                  "annualUpliftChf": 4.33,
                  "deltaValueChf": 84.5,
                  "marginalYieldPct": 5.13,
                  "accretive": true
                },
                {
                  "assetId": "91b041f9-cd2c-408a-a929-94a53c03f89f",
                  "unitId": "demo-unit-0005",
                  "label": "Bathroom tap — 0005",
                  "costChf": 400,
                  "annualUpliftChf": 10,
                  "deltaValueChf": 260,
                  "marginalYieldPct": 3.85,
                  "accretive": true
                },
                {
                  "assetId": "c7cf90f2-0c6c-43d9-9b62-02ee6049b2e0",
                  "unitId": "demo-unit-0002",
                  "label": "Kitchen worktop (synthetic) — 0002",
                  "costChf": 1200,
                  "annualUpliftChf": 40,
                  "deltaValueChf": 780,
                  "marginalYieldPct": 5.13,
                  "accretive": true
                },
                {
                  "assetId": "bac575dc-2bff-432a-8f72-535b77cccadc",
                  "unitId": "demo-unit-0003",
                  "label": "Bathroom tap — 0003",
                  "costChf": 400,
                  "annualUpliftChf": 10,
                  "deltaValueChf": 260,
                  "marginalYieldPct": 3.85,
                  "accretive": true
                },
                {
                  "assetId": "02c95df5-f3c1-4072-b96a-6bcbcd0dc684",
                  "unitId": "demo-unit-0004",
                  "label": "Roller shutters (plastic) — 0004",
                  "costChf": 550,
                  "annualUpliftChf": 13.75,
                  "deltaValueChf": 357.5,
                  "marginalYieldPct": 3.85,
                  "accretive": true
                },
                {
                  "assetId": "55f097f4-fcc6-4ca4-a643-58e2bb025b00",
                  "unitId": "demo-unit-0004",
                  "label": "Wall paint (dispersion) — 0004",
                  "costChf": 2200,
                  "annualUpliftChf": 137.5,
                  "deltaValueChf": 1430,
                  "marginalYieldPct": 9.62,
                  "accretive": true
                },
                {
                  "assetId": "ac41b933-be89-48e0-82a3-ee702f81d509",
                  "unitId": "demo-unit-0005",
                  "label": "Light switches — 0005",
                  "costChf": 70,
                  "annualUpliftChf": 2.33,
                  "deltaValueChf": 45.5,
                  "marginalYieldPct": 5.13,
                  "accretive": true
                },
                {
                  "assetId": "58733997-0f0a-43e6-96e0-493710dfc4ba",
                  "unitId": "demo-unit-0007",
                  "label": "Sanitary ceramics (WC/basin) — 0007",
                  "costChf": 1200,
                  "annualUpliftChf": 17.14,
                  "deltaValueChf": 780,
                  "marginalYieldPct": 2.2,
                  "accretive": false
                },
                {
                  "assetId": "ca58ae14-5da2-4143-ac28-6facf4dd5e0f",
                  "unitId": "demo-unit-0008",
                  "label": "Balcony railing (metal) — 0008",
                  "costChf": 800,
                  "annualUpliftChf": 13.33,
                  "deltaValueChf": 520,
                  "marginalYieldPct": 2.56,
                  "accretive": false
                },
                {
                  "assetId": "2e9fbb78-1b17-42cb-b283-1c49f74dfb1a",
                  "unitId": "demo-unit-0008",
                  "label": "Bathroom tiles (ceramic) — 0008",
                  "costChf": 2200,
                  "annualUpliftChf": 36.67,
                  "deltaValueChf": 1430,
                  "marginalYieldPct": 2.56,
                  "accretive": false
                },
                {
                  "assetId": "e29c9d98-9f30-4e86-bfa0-38595f75afe3",
                  "unitId": "demo-unit-0006",
                  "label": "Wall paint (dispersion) — 0006",
                  "costChf": 2200,
                  "annualUpliftChf": 137.5,
                  "deltaValueChf": 1430,
                  "marginalYieldPct": 9.62,
                  "accretive": true
                },
                {
                  "assetId": "cdcd4dd1-604c-4dce-a25d-fd25c2cb8c0e",
                  "unitId": "demo-unit-0001",
                  "label": "Kitchen worktop (synthetic) — 0001",
                  "costChf": 1200,
                  "annualUpliftChf": 40,
                  "deltaValueChf": 780,
                  "marginalYieldPct": 5.13,
                  "accretive": true
                },
                {
                  "assetId": "dc7ed960-a649-4727-9652-c847277e5cff",
                  "unitId": "demo-unit-0001",
                  "label": "Insulated windows (PVC/wood) — 0001",
                  "costChf": 1100,
                  "annualUpliftChf": 22,
                  "deltaValueChf": 715,
                  "marginalYieldPct": 3.08,
                  "accretive": true
                },
                {
                  "assetId": "9a85dc6c-88c1-4fbe-bf56-603a60abf0a7",
                  "unitId": "demo-unit-0002",
                  "label": "Bathtub (acrylic) — 0002",
                  "costChf": 900,
                  "annualUpliftChf": 18,
                  "deltaValueChf": 585,
                  "marginalYieldPct": 3.08,
                  "accretive": true
                },
                {
                  "assetId": "41d16db4-e57d-40a5-b27b-eec76be78f29",
                  "unitId": "demo-unit-0003",
                  "label": "Roller shutters (plastic) — 0003",
                  "costChf": 550,
                  "annualUpliftChf": 13.75,
                  "deltaValueChf": 357.5,
                  "marginalYieldPct": 3.85,
                  "accretive": true
                },
                {
                  "assetId": "4731f5fb-707c-4cae-a81f-d497b47e202a",
                  "unitId": "demo-unit-0003",
                  "label": "Wall paint (dispersion) — 0003",
                  "costChf": 2200,
                  "annualUpliftChf": 137.5,
                  "deltaValueChf": 1430,
                  "marginalYieldPct": 9.62,
                  "accretive": true
                },
                {
                  "assetId": "33e4f919-5713-41cf-a138-ce49e9977bf2",
                  "unitId": "demo-unit-0003",
                  "label": "Power sockets — 0003",
                  "costChf": 130,
                  "annualUpliftChf": 4.33,
                  "deltaValueChf": 84.5,
                  "marginalYieldPct": 5.13,
                  "accretive": true
                },
                {
                  "assetId": "87fa03d4-bcde-4366-8042-93d7435bbe1d",
                  "unitId": "demo-unit-0006",
                  "label": "Bathroom tap — 0006",
                  "costChf": 400,
                  "annualUpliftChf": 10,
                  "deltaValueChf": 260,
                  "marginalYieldPct": 3.85,
                  "accretive": true
                },
                {
                  "assetId": "5deed3d2-85f9-4338-89ed-c47dbefce005",
                  "unitId": "demo-unit-0006",
                  "label": "Bathtub (acrylic) — 0006",
                  "costChf": 900,
                  "annualUpliftChf": 18,
                  "deltaValueChf": 585,
                  "marginalYieldPct": 3.08,
                  "accretive": true
                },
                {
                  "assetId": "e4275079-9010-446e-91dd-f7a61e8157fb",
                  "unitId": "demo-unit-0006",
                  "label": "Kitchen tap — 0006",
                  "costChf": 400,
                  "annualUpliftChf": 10,
                  "deltaValueChf": 260,
                  "marginalYieldPct": 3.85,
                  "accretive": true
                },
                {
                  "assetId": "b6111e02-6a28-4a94-bbfa-227b79f1e24a",
                  "unitId": "demo-unit-0006",
                  "label": "Light switches — 0006",
                  "costChf": 70,
                  "annualUpliftChf": 2.33,
                  "deltaValueChf": 45.5,
                  "marginalYieldPct": 5.13,
                  "accretive": true
                },
                {
                  "assetId": "f77ae1ad-4ce9-4a8a-8163-02f139db7763",
                  "unitId": "demo-unit-0007",
                  "label": "Interior doors (chipboard) — 0007",
                  "costChf": 450,
                  "annualUpliftChf": 9,
                  "deltaValueChf": 292.5,
                  "marginalYieldPct": 3.08,
                  "accretive": true
                },
                {
                  "assetId": "6d7aaa72-8631-4b77-8bf8-7c7feaccaa85",
                  "unitId": "demo-unit-0007",
                  "label": "Bathroom tiles (ceramic) — 0007",
                  "costChf": 2200,
                  "annualUpliftChf": 36.67,
                  "deltaValueChf": 1430,
                  "marginalYieldPct": 2.56,
                  "accretive": false
                },
                {
                  "assetId": "96a56bb1-5085-4a5c-9df1-a3af9fb2c26a",
                  "unitId": "demo-unit-0008",
                  "label": "Balcony (metal) — 0008",
                  "costChf": 4500,
                  "annualUpliftChf": 56.25,
                  "deltaValueChf": 2925,
                  "marginalYieldPct": 1.92,
                  "accretive": false
                },
                {
                  "assetId": "347394e1-bdaa-4774-8845-60fd14753ade",
                  "unitId": "demo-unit-0001",
                  "label": "Kitchen tiles (ceramic) — 0001",
                  "costChf": 1600,
                  "annualUpliftChf": 26.67,
                  "deltaValueChf": 1040,
                  "marginalYieldPct": 2.56,
                  "accretive": false
                },
                {
                  "assetId": "f3bbaccd-5ff8-46ac-93ca-4d13471c4786",
                  "unitId": "demo-unit-0003",
                  "label": "Balcony railing (metal) — 0003",
                  "costChf": 800,
                  "annualUpliftChf": 13.33,
                  "deltaValueChf": 520,
                  "marginalYieldPct": 2.56,
                  "accretive": false
                },
                {
                  "assetId": "50d4329b-50c3-48cf-b25f-28f1d397a119",
                  "unitId": "demo-unit-0003",
                  "label": "Kitchen worktop (synthetic) — 0003",
                  "costChf": 1200,
                  "annualUpliftChf": 40,
                  "deltaValueChf": 780,
                  "marginalYieldPct": 5.13,
                  "accretive": true
                },
                {
                  "assetId": "82fe8641-7a63-4de3-a70c-14152b2e9fe7",
                  "unitId": "demo-unit-0007",
                  "label": "Roller shutters (plastic) — 0007",
                  "costChf": 550,
                  "annualUpliftChf": 13.75,
                  "deltaValueChf": 357.5,
                  "marginalYieldPct": 3.85,
                  "accretive": true
                },
                {
                  "assetId": "29743c70-02ea-40f1-8a8c-f288eefd82f0",
                  "unitId": "demo-unit-0007",
                  "label": "Wall paint (dispersion) — 0007",
                  "costChf": 2200,
                  "annualUpliftChf": 137.5,
                  "deltaValueChf": 1430,
                  "marginalYieldPct": 9.62,
                  "accretive": true
                },
                {
                  "assetId": "597b7d69-524b-44a5-9993-b5888438b8bf",
                  "unitId": "demo-unit-0008",
                  "label": "Bathroom tap — 0008",
                  "costChf": 400,
                  "annualUpliftChf": 10,
                  "deltaValueChf": 260,
                  "marginalYieldPct": 3.85,
                  "accretive": true
                },
                {
                  "assetId": "f8d26c10-749f-4cf7-8ab7-0fdf66e160e0",
                  "unitId": "demo-unit-0001",
                  "label": "Balcony (metal) — 0001",
                  "costChf": 4500,
                  "annualUpliftChf": 56.25,
                  "deltaValueChf": 2925,
                  "marginalYieldPct": 1.92,
                  "accretive": false
                },
                {
                  "assetId": "fed929a9-6bb4-4d5a-8d9d-ffd3faa52618",
                  "unitId": "demo-unit-0002",
                  "label": "Parquet flooring (mosaic) — 0002",
                  "costChf": 3500,
                  "annualUpliftChf": 43.75,
                  "deltaValueChf": 2275,
                  "marginalYieldPct": 1.92,
                  "accretive": false
                },
                {
                  "assetId": "15bddbbb-3b21-4889-afdd-faad0b69445b",
                  "unitId": "demo-unit-0004",
                  "label": "Balcony railing (metal) — 0004",
                  "costChf": 800,
                  "annualUpliftChf": 13.33,
                  "deltaValueChf": 520,
                  "marginalYieldPct": 2.56,
                  "accretive": false
                },
                {
                  "assetId": "6eb046ea-15c7-4bea-94a5-edf1298e0efd",
                  "unitId": "demo-unit-0005",
                  "label": "Kitchen cabinets (chipboard) — 0005",
                  "costChf": 4500,
                  "annualUpliftChf": 150,
                  "deltaValueChf": 2925,
                  "marginalYieldPct": 5.13,
                  "accretive": true
                },
                {
                  "assetId": "792f3563-0ea1-453b-b6a5-5833772b99c6",
                  "unitId": "demo-unit-0006",
                  "label": "Insulated windows (PVC/wood) — 0006",
                  "costChf": 1100,
                  "annualUpliftChf": 22,
                  "deltaValueChf": 715,
                  "marginalYieldPct": 3.08,
                  "accretive": true
                },
                {
                  "assetId": "08fcba5d-ce14-4a56-a79d-a0b8162d88ba",
                  "unitId": "demo-unit-0007",
                  "label": "Bathroom tap — 0007",
                  "costChf": 400,
                  "annualUpliftChf": 10,
                  "deltaValueChf": 260,
                  "marginalYieldPct": 3.85,
                  "accretive": true
                },
                {
                  "assetId": "03f837b4-5c88-4273-89f6-20196359864f",
                  "unitId": "demo-unit-0008",
                  "label": "Parquet flooring (mosaic) — 0008",
                  "costChf": 3500,
                  "annualUpliftChf": 43.75,
                  "deltaValueChf": 2275,
                  "marginalYieldPct": 1.92,
                  "accretive": false
                },
                {
                  "assetId": "a3ae7efb-bb6d-4ac7-87e0-9780a24736f9",
                  "unitId": "demo-unit-0001",
                  "label": "Balcony railing (metal) — 0001",
                  "costChf": 800,
                  "annualUpliftChf": 13.33,
                  "deltaValueChf": 520,
                  "marginalYieldPct": 2.56,
                  "accretive": false
                },
                {
                  "assetId": "0bf59d2d-31b7-450c-a0dc-d955e1845461",
                  "unitId": "demo-unit-0004",
                  "label": "Bathtub (acrylic) — 0004",
                  "costChf": 900,
                  "annualUpliftChf": 18,
                  "deltaValueChf": 585,
                  "marginalYieldPct": 3.08,
                  "accretive": true
                },
                {
                  "assetId": "f7040c38-9a3a-44d4-a62d-2617c7cce8e7",
                  "unitId": "demo-unit-0004",
                  "label": "Kitchen tap — 0004",
                  "costChf": 400,
                  "annualUpliftChf": 10,
                  "deltaValueChf": 260,
                  "marginalYieldPct": 3.85,
                  "accretive": true
                },
                {
                  "assetId": "3f1a28ca-2d61-4f95-a3b4-9508beb16d9b",
                  "unitId": "demo-unit-0005",
                  "label": "Kitchen tiles (ceramic) — 0005",
                  "costChf": 1600,
                  "annualUpliftChf": 26.67,
                  "deltaValueChf": 1040,
                  "marginalYieldPct": 2.56,
                  "accretive": false
                },
                {
                  "assetId": "3a7024af-7bc7-4ec1-abf3-adb5741758a1",
                  "unitId": "demo-unit-0007",
                  "label": "Insulated windows (PVC/wood) — 0007",
                  "costChf": 1100,
                  "annualUpliftChf": 22,
                  "deltaValueChf": 715,
                  "marginalYieldPct": 3.08,
                  "accretive": true
                },
                {
                  "assetId": "a3f412c3-d042-423e-b3cb-5838c784d157",
                  "unitId": "demo-unit-0007",
                  "label": "Power sockets — 0007",
                  "costChf": 130,
                  "annualUpliftChf": 4.33,
                  "deltaValueChf": 84.5,
                  "marginalYieldPct": 5.13,
                  "accretive": true
                },
                {
                  "assetId": "f835d7c4-588f-4095-86ae-1d20f6115a1f",
                  "unitId": "demo-unit-0008",
                  "label": "Kitchen tap — 0008",
                  "costChf": 400,
                  "annualUpliftChf": 10,
                  "deltaValueChf": 260,
                  "marginalYieldPct": 3.85,
                  "accretive": true
                },
                {
                  "assetId": "09f5897d-1e6c-4675-8294-c8972adb606a",
                  "unitId": "demo-unit-0008",
                  "label": "Wall paint (dispersion) — 0008",
                  "costChf": 2200,
                  "annualUpliftChf": 137.5,
                  "deltaValueChf": 1430,
                  "marginalYieldPct": 9.62,
                  "accretive": true
                }
              ],
              "accretiveCount": 39,
              "ceilingYieldPct": 2.59,
              "feasible": false,
              "offStrategy": false,
              "capexChf": 42560,
              "annualUpliftChf": 1584.48,
              "deltaValueChf": 27664
            }
          },
          "synthesis": {
            "withinStrategyYieldPct": 4.31,
            "withRenovationYieldPct": 4.32,
            "withSelfManageYieldPct": 4.35
          },
          "currentFeePct": 5.54,
          "feeSource": "statements",
          "opexDrivers": [
            {
              "label": "Chauffage et eau chaude",
              "annualChf": 19350,
              "category": "RECOVERABLE"
            },
            {
              "label": "Conciergerie et nettoyage",
              "annualChf": 14400,
              "category": "RECOVERABLE"
            },
            {
              "label": "Entretien des appartements",
              "annualChf": 7040,
              "category": "OWNER_OPEX"
            },
            {
              "label": "Assurances immeuble",
              "annualChf": 5420,
              "category": "OWNER_OPEX"
            },
            {
              "label": "Entretien parties communes",
              "annualChf": 5380,
              "category": "OWNER_OPEX"
            },
            {
              "label": "Eau et épuration",
              "annualChf": 5350,
              "category": "RECOVERABLE"
            }
          ],
          "strategyOwnerName": null,
          "occupancyGainAnnualChf": 32064,
          "vacantUnits": [
            {
              "label": "9004",
              "kind": "parking",
              "expectedAnnualChf": 1872,
              "hasAskingRent": true
            },
            {
              "label": "0008",
              "kind": "residential",
              "expectedAnnualChf": 30192,
              "hasAskingRent": true
            }
          ],
          "rentMarketDetail": [
            {
              "label": "0005",
              "livingAreaSqm": 104,
              "pricePerSqmChf": 13500,
              "grossYieldPct": 3.3,
              "vetustePct": 29,
              "currentAnnualChf": 30660,
              "marketAnnualChf": 40957,
              "gapChf": 10297
            },
            {
              "label": "0003",
              "livingAreaSqm": 102,
              "pricePerSqmChf": 13500,
              "grossYieldPct": 3.3,
              "vetustePct": 32,
              "currentAnnualChf": 29724,
              "marketAnnualChf": 39625,
              "gapChf": 9901
            },
            {
              "label": "0008",
              "livingAreaSqm": 101,
              "pricePerSqmChf": 13500,
              "grossYieldPct": 3.3,
              "vetustePct": 29,
              "currentAnnualChf": 30192,
              "marketAnnualChf": 39776,
              "gapChf": 9584
            },
            {
              "label": "0007",
              "livingAreaSqm": 79,
              "pricePerSqmChf": 13500,
              "grossYieldPct": 3.3,
              "vetustePct": 26,
              "currentAnnualChf": 23520,
              "marketAnnualChf": 31534,
              "gapChf": 8014
            },
            {
              "label": "0001",
              "livingAreaSqm": 78,
              "pricePerSqmChf": 13500,
              "grossYieldPct": 3.3,
              "vetustePct": 26,
              "currentAnnualChf": 23172,
              "marketAnnualChf": 31135,
              "gapChf": 7963
            },
            {
              "label": "0004",
              "livingAreaSqm": 80,
              "pricePerSqmChf": 13500,
              "grossYieldPct": 3.3,
              "vetustePct": 26,
              "currentAnnualChf": 23988,
              "marketAnnualChf": 31933,
              "gapChf": 7945
            },
            {
              "label": "0002",
              "livingAreaSqm": 58,
              "pricePerSqmChf": 13500,
              "grossYieldPct": 3.3,
              "vetustePct": 29,
              "currentAnnualChf": 18840,
              "marketAnnualChf": 22842,
              "gapChf": 4002
            },
            {
              "label": "0006",
              "livingAreaSqm": 56,
              "pricePerSqmChf": 13500,
              "grossYieldPct": 3.3,
              "vetustePct": 32,
              "currentAnnualChf": 19776,
              "marketAnnualChf": 21755,
              "gapChf": 1979
            }
          ],
          "rentMarketBasis": {
            "grossYieldPct": 3.3,
            "vetusteCoeffPct": 40,
            "pricePerSqmSource": "intrinsic"
          },
          "periodFrom": "2025-01-01",
          "periodTo": "2025-12-31"
        }
      },
      "/cashflow-plans/demo-plan/npv-scenarios": {
        "data": {
          "buildingId": "demo-building",
          "buildingName": "Résidence des Charmilles",
          "discountRatePct": 4,
          "incomeGrowthRatePct": 1,
          "horizonYears": 10,
          "deferYears": 3,
          "baseAnnualNoiChf": 190416,
          "noIncomeData": false,
          "noiEstimatedFromRent": true,
          "fromYear": 2026,
          "toYear": 2035,
          "scenarios": {
            "invest": {
              "npvChf": 5740238,
              "totalCapexChf": 330000,
              "totalTaxShieldChf": 55692,
              "totalNoiChf": 1996412,
              "terminalValuePvChf": 4357389,
              "yearlyFlows": [
                {
                  "year": 2026,
                  "projectedNoiChf": 181216,
                  "capexChf": 87500,
                  "taxShieldChf": 12125,
                  "netCashFlowChf": 105841,
                  "discountFactor": 0.9615,
                  "pvChf": 101770,
                  "cumulativePvChf": 101770
                },
                {
                  "year": 2027,
                  "projectedNoiChf": 191000,
                  "capexChf": 11700,
                  "taxShieldChf": 2925,
                  "netCashFlowChf": 182225,
                  "discountFactor": 0.9246,
                  "pvChf": 168477,
                  "cumulativePvChf": 270247
                },
                {
                  "year": 2028,
                  "projectedNoiChf": 194303,
                  "capexChf": 35910,
                  "taxShieldChf": 8945,
                  "netCashFlowChf": 167338,
                  "discountFactor": 0.889,
                  "pvChf": 148763,
                  "cumulativePvChf": 419010
                },
                {
                  "year": 2029,
                  "projectedNoiChf": 198286,
                  "capexChf": 16870,
                  "taxShieldChf": 3810,
                  "netCashFlowChf": 185226,
                  "discountFactor": 0.8548,
                  "pvChf": 158332,
                  "cumulativePvChf": 577342
                },
                {
                  "year": 2030,
                  "projectedNoiChf": 200248,
                  "capexChf": 13430,
                  "taxShieldChf": 2805,
                  "netCashFlowChf": 189623,
                  "discountFactor": 0.8219,
                  "pvChf": 155856,
                  "cumulativePvChf": 733198
                },
                {
                  "year": 2031,
                  "projectedNoiChf": 202229,
                  "capexChf": 7950,
                  "taxShieldChf": 1988,
                  "netCashFlowChf": 196267,
                  "discountFactor": 0.7903,
                  "pvChf": 155113,
                  "cumulativePvChf": 888311
                },
                {
                  "year": 2032,
                  "projectedNoiChf": 204230,
                  "capexChf": 120970,
                  "taxShieldChf": 16484,
                  "netCashFlowChf": 99744,
                  "discountFactor": 0.7599,
                  "pvChf": 75797,
                  "cumulativePvChf": 964108
                },
                {
                  "year": 2033,
                  "projectedNoiChf": 206252,
                  "capexChf": 13030,
                  "taxShieldChf": 2116,
                  "netCashFlowChf": 195338,
                  "discountFactor": 0.7307,
                  "pvChf": 142732,
                  "cumulativePvChf": 1106840
                },
                {
                  "year": 2034,
                  "projectedNoiChf": 208293,
                  "capexChf": 9120,
                  "taxShieldChf": 2272,
                  "netCashFlowChf": 201445,
                  "discountFactor": 0.7026,
                  "pvChf": 141533,
                  "cumulativePvChf": 1248373
                },
                {
                  "year": 2035,
                  "projectedNoiChf": 210355,
                  "capexChf": 13520,
                  "taxShieldChf": 2222,
                  "netCashFlowChf": 199057,
                  "discountFactor": 0.6756,
                  "pvChf": 134476,
                  "cumulativePvChf": 1382849
                }
              ],
              "levered": {
                "equityNpvChf": -95052,
                "equityIrrPct": 3.67,
                "minDscr": 0.6,
                "avgDscr": 0.66,
                "dscrByYear": [
                  0.6,
                  0.64,
                  0.65,
                  0.66,
                  0.67,
                  0.67,
                  0.68,
                  0.69,
                  0.69,
                  0.7
                ]
              }
            },
            "defer": {
              "npvChf": 5722246,
              "totalCapexChf": 330000,
              "totalTaxShieldChf": 55692,
              "totalNoiChf": 1962512,
              "terminalValuePvChf": 4357389,
              "yearlyFlows": [
                {
                  "year": 2026,
                  "projectedNoiChf": 181216,
                  "capexChf": 0,
                  "taxShieldChf": 0,
                  "netCashFlowChf": 181216,
                  "discountFactor": 0.9615,
                  "pvChf": 174246,
                  "cumulativePvChf": 174246
                },
                {
                  "year": 2027,
                  "projectedNoiChf": 183120,
                  "capexChf": 0,
                  "taxShieldChf": 0,
                  "netCashFlowChf": 183120,
                  "discountFactor": 0.9246,
                  "pvChf": 169305,
                  "cumulativePvChf": 343551
                },
                {
                  "year": 2028,
                  "projectedNoiChf": 185043,
                  "capexChf": 0,
                  "taxShieldChf": 0,
                  "netCashFlowChf": 185043,
                  "discountFactor": 0.889,
                  "pvChf": 164503,
                  "cumulativePvChf": 508054
                },
                {
                  "year": 2029,
                  "projectedNoiChf": 186986,
                  "capexChf": 104370,
                  "taxShieldChf": 15935,
                  "netCashFlowChf": 98551,
                  "discountFactor": 0.8548,
                  "pvChf": 84242,
                  "cumulativePvChf": 592296
                },
                {
                  "year": 2030,
                  "projectedNoiChf": 196828,
                  "capexChf": 25130,
                  "taxShieldChf": 5730,
                  "netCashFlowChf": 177428,
                  "discountFactor": 0.8219,
                  "pvChf": 145833,
                  "cumulativePvChf": 738129
                },
                {
                  "year": 2031,
                  "projectedNoiChf": 200189,
                  "capexChf": 43860,
                  "taxShieldChf": 10933,
                  "netCashFlowChf": 167262,
                  "discountFactor": 0.7903,
                  "pvChf": 132190,
                  "cumulativePvChf": 870319
                },
                {
                  "year": 2032,
                  "projectedNoiChf": 204230,
                  "capexChf": 120970,
                  "taxShieldChf": 16484,
                  "netCashFlowChf": 99744,
                  "discountFactor": 0.7599,
                  "pvChf": 75797,
                  "cumulativePvChf": 946116
                },
                {
                  "year": 2033,
                  "projectedNoiChf": 206252,
                  "capexChf": 13030,
                  "taxShieldChf": 2116,
                  "netCashFlowChf": 195338,
                  "discountFactor": 0.7307,
                  "pvChf": 142732,
                  "cumulativePvChf": 1088848
                },
                {
                  "year": 2034,
                  "projectedNoiChf": 208293,
                  "capexChf": 9120,
                  "taxShieldChf": 2272,
                  "netCashFlowChf": 201445,
                  "discountFactor": 0.7026,
                  "pvChf": 141533,
                  "cumulativePvChf": 1230381
                },
                {
                  "year": 2035,
                  "projectedNoiChf": 210355,
                  "capexChf": 13520,
                  "taxShieldChf": 2222,
                  "netCashFlowChf": 199057,
                  "discountFactor": 0.6756,
                  "pvChf": 134476,
                  "cumulativePvChf": 1364857
                }
              ],
              "levered": {
                "equityNpvChf": -113045,
                "equityIrrPct": 3.6,
                "minDscr": 0.6,
                "avgDscr": 0.65,
                "dscrByYear": [
                  0.6,
                  0.61,
                  0.62,
                  0.62,
                  0.66,
                  0.67,
                  0.68,
                  0.69,
                  0.69,
                  0.7
                ]
              }
            },
            "neglect": {
              "npvChf": 5639928,
              "totalCapexChf": 0,
              "totalTaxShieldChf": 0,
              "totalNoiChf": 1857868,
              "terminalValuePvChf": 4134453,
              "yearlyFlows": [
                {
                  "year": 2026,
                  "projectedNoiChf": 181216,
                  "capexChf": 0,
                  "taxShieldChf": 0,
                  "netCashFlowChf": 181216,
                  "discountFactor": 0.9615,
                  "pvChf": 174246,
                  "cumulativePvChf": 174246
                },
                {
                  "year": 2027,
                  "projectedNoiChf": 183120,
                  "capexChf": 0,
                  "taxShieldChf": 0,
                  "netCashFlowChf": 183120,
                  "discountFactor": 0.9246,
                  "pvChf": 169305,
                  "cumulativePvChf": 343551
                },
                {
                  "year": 2028,
                  "projectedNoiChf": 185043,
                  "capexChf": 0,
                  "taxShieldChf": 0,
                  "netCashFlowChf": 185043,
                  "discountFactor": 0.889,
                  "pvChf": 164503,
                  "cumulativePvChf": 508054
                },
                {
                  "year": 2029,
                  "projectedNoiChf": 186986,
                  "capexChf": 0,
                  "taxShieldChf": 0,
                  "netCashFlowChf": 186986,
                  "discountFactor": 0.8548,
                  "pvChf": 159836,
                  "cumulativePvChf": 667890
                },
                {
                  "year": 2030,
                  "projectedNoiChf": 186966,
                  "capexChf": 0,
                  "taxShieldChf": 0,
                  "netCashFlowChf": 186966,
                  "discountFactor": 0.8219,
                  "pvChf": 153672,
                  "cumulativePvChf": 821562
                },
                {
                  "year": 2031,
                  "projectedNoiChf": 186947,
                  "capexChf": 0,
                  "taxShieldChf": 0,
                  "netCashFlowChf": 186947,
                  "discountFactor": 0.7903,
                  "pvChf": 147747,
                  "cumulativePvChf": 969309
                },
                {
                  "year": 2032,
                  "projectedNoiChf": 186927,
                  "capexChf": 0,
                  "taxShieldChf": 0,
                  "netCashFlowChf": 186927,
                  "discountFactor": 0.7599,
                  "pvChf": 142049,
                  "cumulativePvChf": 1111358
                },
                {
                  "year": 2033,
                  "projectedNoiChf": 186907,
                  "capexChf": 0,
                  "taxShieldChf": 0,
                  "netCashFlowChf": 186907,
                  "discountFactor": 0.7307,
                  "pvChf": 136571,
                  "cumulativePvChf": 1247929
                },
                {
                  "year": 2034,
                  "projectedNoiChf": 186888,
                  "capexChf": 0,
                  "taxShieldChf": 0,
                  "netCashFlowChf": 186888,
                  "discountFactor": 0.7026,
                  "pvChf": 131305,
                  "cumulativePvChf": 1379234
                },
                {
                  "year": 2035,
                  "projectedNoiChf": 186868,
                  "capexChf": 0,
                  "taxShieldChf": 0,
                  "netCashFlowChf": 186868,
                  "discountFactor": 0.6756,
                  "pvChf": 126241,
                  "cumulativePvChf": 1505475
                }
              ],
              "levered": {
                "equityNpvChf": -195361,
                "equityIrrPct": 3.29,
                "minDscr": 0.6,
                "avgDscr": 0.62,
                "dscrByYear": [
                  0.6,
                  0.61,
                  0.62,
                  0.62,
                  0.62,
                  0.62,
                  0.62,
                  0.62,
                  0.62,
                  0.62
                ]
              }
            }
          },
          "terminalValueModeled": true,
          "propertyValueChf": 6450000,
          "neglectNoiErosionRatePct": 1,
          "ownerMarginalTaxRatePct": 25,
          "ownerTaxRateIsDefault": true,
          "fciCurrentPct": 4,
          "fciNeglectHorizonPct": 79.9,
          "totalReplacementValueChf": 412800,
          "debt": {
            "totalDebtChf": 3900000,
            "weightedCostOfDebtPct": 1.85,
            "ltvPct": 60.5,
            "waccPct": 2.42,
            "currentEquityChf": 2550000,
            "marketValueChf": 6450000,
            "costOfEquityPct": 4
          },
          "strategyContext": {
            "hasProfile": true,
            "source": "building",
            "archetype": "value_builder",
            "roleIntent": "long_term_quality",
            "recommendedScenario": "invest",
            "rationale": "Value-builder profile — full investment on schedule maximises long-term equity and NPV."
          }
        }
      }
    },
    "4": {
      "/buildings/demo-building/yield-goalseek": {
        "data": {
          "currentYieldPct": 2.57,
          "targetYieldPct": 3,
          "valueChf": 6535625,
          "currentNoiChf": 168256,
          "rentRollChf": 207360,
          "occupancyRate": 0.8333,
          "requiredNoiChf": 196068.75,
          "gapChf": 27812.75,
          "met": false,
          "strategySource": "building",
          "strategyFlags": {
            "renovation": true,
            "rentAggressive": true,
            "selfManage": false
          },
          "strategyLabel": "capital_preserver",
          "levers": {
            "rent": {
              "deltaMonthlyChf": 2317.73,
              "pctOfRentRoll": 0.1341,
              "marketGapAnnualChf": 59685,
              "avgLeaseRemainingMonths": null,
              "feasible": true,
              "offStrategy": true
            },
            "opex": {
              "requiredReductionChf": 27812.75,
              "operatingCostChf": 61880,
              "headroomChf": 3094,
              "feasible": false,
              "offStrategy": false
            },
            "occupancy": {
              "requiredOccupancyRate": 0.9451,
              "feasible": true,
              "offStrategy": false
            },
            "mgmtFee": {
              "feeChf": 11487.74,
              "ppOfYield": 0.176,
              "gapCoverPct": 0.413,
              "selfManage": false,
              "feasible": true,
              "offStrategy": false
            },
            "renovation": {
              "lines": [
                {
                  "assetId": "6c634239-94ee-4688-b976-03d81ce89ec2",
                  "unitId": "demo-unit-0003",
                  "label": "Insulated windows (PVC/wood) — 0003",
                  "costChf": 1100,
                  "annualUpliftChf": 22,
                  "deltaValueChf": 715,
                  "marginalYieldPct": 3.08,
                  "accretive": true
                },
                {
                  "assetId": "dada94b5-2ae5-4989-8868-fccf5373a595",
                  "unitId": "demo-unit-0005",
                  "label": "Parquet flooring (mosaic) — 0005",
                  "costChf": 3500,
                  "annualUpliftChf": 43.75,
                  "deltaValueChf": 2275,
                  "marginalYieldPct": 1.92,
                  "accretive": false
                },
                {
                  "assetId": "a40eef84-b8e4-44a9-957e-fa408f9da8de",
                  "unitId": "demo-unit-0008",
                  "label": "Kitchen cabinets (chipboard) — 0008",
                  "costChf": 4500,
                  "annualUpliftChf": 150,
                  "deltaValueChf": 2925,
                  "marginalYieldPct": 5.13,
                  "accretive": true
                },
                {
                  "assetId": "50d1b281-b019-4f7e-bdaf-294af8355edc",
                  "unitId": "demo-unit-0003",
                  "label": "Kitchen cabinets (chipboard) — 0003",
                  "costChf": 4500,
                  "annualUpliftChf": 150,
                  "deltaValueChf": 2925,
                  "marginalYieldPct": 5.13,
                  "accretive": true
                },
                {
                  "assetId": "45ed30a9-f059-4cb0-9e2f-bfad84b311f9",
                  "unitId": "demo-unit-0006",
                  "label": "Interior doors (chipboard) — 0006",
                  "costChf": 450,
                  "annualUpliftChf": 9,
                  "deltaValueChf": 292.5,
                  "marginalYieldPct": 3.08,
                  "accretive": true
                },
                {
                  "assetId": "9850ddb9-679f-44dc-9ac3-c696192ab7f2",
                  "unitId": "demo-unit-0006",
                  "label": "Roller shutters (plastic) — 0006",
                  "costChf": 550,
                  "annualUpliftChf": 13.75,
                  "deltaValueChf": 357.5,
                  "marginalYieldPct": 3.85,
                  "accretive": true
                },
                {
                  "assetId": "0581e949-581f-4a4a-ae0c-f7da89f0de3f",
                  "unitId": "demo-unit-0008",
                  "label": "Power sockets — 0008",
                  "costChf": 130,
                  "annualUpliftChf": 4.33,
                  "deltaValueChf": 84.5,
                  "marginalYieldPct": 5.13,
                  "accretive": true
                },
                {
                  "assetId": "dc4ce34d-f394-4d4d-b771-a7b0baafca8d",
                  "unitId": "demo-unit-0001",
                  "label": "Kitchen tap — 0001",
                  "costChf": 400,
                  "annualUpliftChf": 10,
                  "deltaValueChf": 260,
                  "marginalYieldPct": 3.85,
                  "accretive": true
                },
                {
                  "assetId": "61216168-5e7e-431e-8cc7-3ba4d3b80073",
                  "unitId": "demo-unit-0002",
                  "label": "Power sockets — 0002",
                  "costChf": 130,
                  "annualUpliftChf": 4.33,
                  "deltaValueChf": 84.5,
                  "marginalYieldPct": 5.13,
                  "accretive": true
                },
                {
                  "assetId": "91b041f9-cd2c-408a-a929-94a53c03f89f",
                  "unitId": "demo-unit-0005",
                  "label": "Bathroom tap — 0005",
                  "costChf": 400,
                  "annualUpliftChf": 10,
                  "deltaValueChf": 260,
                  "marginalYieldPct": 3.85,
                  "accretive": true
                },
                {
                  "assetId": "c7cf90f2-0c6c-43d9-9b62-02ee6049b2e0",
                  "unitId": "demo-unit-0002",
                  "label": "Kitchen worktop (synthetic) — 0002",
                  "costChf": 1200,
                  "annualUpliftChf": 40,
                  "deltaValueChf": 780,
                  "marginalYieldPct": 5.13,
                  "accretive": true
                },
                {
                  "assetId": "bac575dc-2bff-432a-8f72-535b77cccadc",
                  "unitId": "demo-unit-0003",
                  "label": "Bathroom tap — 0003",
                  "costChf": 400,
                  "annualUpliftChf": 10,
                  "deltaValueChf": 260,
                  "marginalYieldPct": 3.85,
                  "accretive": true
                },
                {
                  "assetId": "02c95df5-f3c1-4072-b96a-6bcbcd0dc684",
                  "unitId": "demo-unit-0004",
                  "label": "Roller shutters (plastic) — 0004",
                  "costChf": 550,
                  "annualUpliftChf": 13.75,
                  "deltaValueChf": 357.5,
                  "marginalYieldPct": 3.85,
                  "accretive": true
                },
                {
                  "assetId": "55f097f4-fcc6-4ca4-a643-58e2bb025b00",
                  "unitId": "demo-unit-0004",
                  "label": "Wall paint (dispersion) — 0004",
                  "costChf": 2200,
                  "annualUpliftChf": 137.5,
                  "deltaValueChf": 1430,
                  "marginalYieldPct": 9.62,
                  "accretive": true
                },
                {
                  "assetId": "ac41b933-be89-48e0-82a3-ee702f81d509",
                  "unitId": "demo-unit-0005",
                  "label": "Light switches — 0005",
                  "costChf": 70,
                  "annualUpliftChf": 2.33,
                  "deltaValueChf": 45.5,
                  "marginalYieldPct": 5.13,
                  "accretive": true
                },
                {
                  "assetId": "58733997-0f0a-43e6-96e0-493710dfc4ba",
                  "unitId": "demo-unit-0007",
                  "label": "Sanitary ceramics (WC/basin) — 0007",
                  "costChf": 1200,
                  "annualUpliftChf": 17.14,
                  "deltaValueChf": 780,
                  "marginalYieldPct": 2.2,
                  "accretive": false
                },
                {
                  "assetId": "ca58ae14-5da2-4143-ac28-6facf4dd5e0f",
                  "unitId": "demo-unit-0008",
                  "label": "Balcony railing (metal) — 0008",
                  "costChf": 800,
                  "annualUpliftChf": 13.33,
                  "deltaValueChf": 520,
                  "marginalYieldPct": 2.56,
                  "accretive": false
                },
                {
                  "assetId": "2e9fbb78-1b17-42cb-b283-1c49f74dfb1a",
                  "unitId": "demo-unit-0008",
                  "label": "Bathroom tiles (ceramic) — 0008",
                  "costChf": 2200,
                  "annualUpliftChf": 36.67,
                  "deltaValueChf": 1430,
                  "marginalYieldPct": 2.56,
                  "accretive": false
                },
                {
                  "assetId": "e29c9d98-9f30-4e86-bfa0-38595f75afe3",
                  "unitId": "demo-unit-0006",
                  "label": "Wall paint (dispersion) — 0006",
                  "costChf": 2200,
                  "annualUpliftChf": 137.5,
                  "deltaValueChf": 1430,
                  "marginalYieldPct": 9.62,
                  "accretive": true
                },
                {
                  "assetId": "cdcd4dd1-604c-4dce-a25d-fd25c2cb8c0e",
                  "unitId": "demo-unit-0001",
                  "label": "Kitchen worktop (synthetic) — 0001",
                  "costChf": 1200,
                  "annualUpliftChf": 40,
                  "deltaValueChf": 780,
                  "marginalYieldPct": 5.13,
                  "accretive": true
                },
                {
                  "assetId": "dc7ed960-a649-4727-9652-c847277e5cff",
                  "unitId": "demo-unit-0001",
                  "label": "Insulated windows (PVC/wood) — 0001",
                  "costChf": 1100,
                  "annualUpliftChf": 22,
                  "deltaValueChf": 715,
                  "marginalYieldPct": 3.08,
                  "accretive": true
                },
                {
                  "assetId": "9a85dc6c-88c1-4fbe-bf56-603a60abf0a7",
                  "unitId": "demo-unit-0002",
                  "label": "Bathtub (acrylic) — 0002",
                  "costChf": 900,
                  "annualUpliftChf": 18,
                  "deltaValueChf": 585,
                  "marginalYieldPct": 3.08,
                  "accretive": true
                },
                {
                  "assetId": "41d16db4-e57d-40a5-b27b-eec76be78f29",
                  "unitId": "demo-unit-0003",
                  "label": "Roller shutters (plastic) — 0003",
                  "costChf": 550,
                  "annualUpliftChf": 13.75,
                  "deltaValueChf": 357.5,
                  "marginalYieldPct": 3.85,
                  "accretive": true
                },
                {
                  "assetId": "4731f5fb-707c-4cae-a81f-d497b47e202a",
                  "unitId": "demo-unit-0003",
                  "label": "Wall paint (dispersion) — 0003",
                  "costChf": 2200,
                  "annualUpliftChf": 137.5,
                  "deltaValueChf": 1430,
                  "marginalYieldPct": 9.62,
                  "accretive": true
                },
                {
                  "assetId": "33e4f919-5713-41cf-a138-ce49e9977bf2",
                  "unitId": "demo-unit-0003",
                  "label": "Power sockets — 0003",
                  "costChf": 130,
                  "annualUpliftChf": 4.33,
                  "deltaValueChf": 84.5,
                  "marginalYieldPct": 5.13,
                  "accretive": true
                },
                {
                  "assetId": "87fa03d4-bcde-4366-8042-93d7435bbe1d",
                  "unitId": "demo-unit-0006",
                  "label": "Bathroom tap — 0006",
                  "costChf": 400,
                  "annualUpliftChf": 10,
                  "deltaValueChf": 260,
                  "marginalYieldPct": 3.85,
                  "accretive": true
                },
                {
                  "assetId": "5deed3d2-85f9-4338-89ed-c47dbefce005",
                  "unitId": "demo-unit-0006",
                  "label": "Bathtub (acrylic) — 0006",
                  "costChf": 900,
                  "annualUpliftChf": 18,
                  "deltaValueChf": 585,
                  "marginalYieldPct": 3.08,
                  "accretive": true
                },
                {
                  "assetId": "e4275079-9010-446e-91dd-f7a61e8157fb",
                  "unitId": "demo-unit-0006",
                  "label": "Kitchen tap — 0006",
                  "costChf": 400,
                  "annualUpliftChf": 10,
                  "deltaValueChf": 260,
                  "marginalYieldPct": 3.85,
                  "accretive": true
                },
                {
                  "assetId": "b6111e02-6a28-4a94-bbfa-227b79f1e24a",
                  "unitId": "demo-unit-0006",
                  "label": "Light switches — 0006",
                  "costChf": 70,
                  "annualUpliftChf": 2.33,
                  "deltaValueChf": 45.5,
                  "marginalYieldPct": 5.13,
                  "accretive": true
                },
                {
                  "assetId": "f77ae1ad-4ce9-4a8a-8163-02f139db7763",
                  "unitId": "demo-unit-0007",
                  "label": "Interior doors (chipboard) — 0007",
                  "costChf": 450,
                  "annualUpliftChf": 9,
                  "deltaValueChf": 292.5,
                  "marginalYieldPct": 3.08,
                  "accretive": true
                },
                {
                  "assetId": "6d7aaa72-8631-4b77-8bf8-7c7feaccaa85",
                  "unitId": "demo-unit-0007",
                  "label": "Bathroom tiles (ceramic) — 0007",
                  "costChf": 2200,
                  "annualUpliftChf": 36.67,
                  "deltaValueChf": 1430,
                  "marginalYieldPct": 2.56,
                  "accretive": false
                },
                {
                  "assetId": "96a56bb1-5085-4a5c-9df1-a3af9fb2c26a",
                  "unitId": "demo-unit-0008",
                  "label": "Balcony (metal) — 0008",
                  "costChf": 4500,
                  "annualUpliftChf": 56.25,
                  "deltaValueChf": 2925,
                  "marginalYieldPct": 1.92,
                  "accretive": false
                },
                {
                  "assetId": "347394e1-bdaa-4774-8845-60fd14753ade",
                  "unitId": "demo-unit-0001",
                  "label": "Kitchen tiles (ceramic) — 0001",
                  "costChf": 1600,
                  "annualUpliftChf": 26.67,
                  "deltaValueChf": 1040,
                  "marginalYieldPct": 2.56,
                  "accretive": false
                },
                {
                  "assetId": "f3bbaccd-5ff8-46ac-93ca-4d13471c4786",
                  "unitId": "demo-unit-0003",
                  "label": "Balcony railing (metal) — 0003",
                  "costChf": 800,
                  "annualUpliftChf": 13.33,
                  "deltaValueChf": 520,
                  "marginalYieldPct": 2.56,
                  "accretive": false
                },
                {
                  "assetId": "50d4329b-50c3-48cf-b25f-28f1d397a119",
                  "unitId": "demo-unit-0003",
                  "label": "Kitchen worktop (synthetic) — 0003",
                  "costChf": 1200,
                  "annualUpliftChf": 40,
                  "deltaValueChf": 780,
                  "marginalYieldPct": 5.13,
                  "accretive": true
                },
                {
                  "assetId": "82fe8641-7a63-4de3-a70c-14152b2e9fe7",
                  "unitId": "demo-unit-0007",
                  "label": "Roller shutters (plastic) — 0007",
                  "costChf": 550,
                  "annualUpliftChf": 13.75,
                  "deltaValueChf": 357.5,
                  "marginalYieldPct": 3.85,
                  "accretive": true
                },
                {
                  "assetId": "29743c70-02ea-40f1-8a8c-f288eefd82f0",
                  "unitId": "demo-unit-0007",
                  "label": "Wall paint (dispersion) — 0007",
                  "costChf": 2200,
                  "annualUpliftChf": 137.5,
                  "deltaValueChf": 1430,
                  "marginalYieldPct": 9.62,
                  "accretive": true
                },
                {
                  "assetId": "597b7d69-524b-44a5-9993-b5888438b8bf",
                  "unitId": "demo-unit-0008",
                  "label": "Bathroom tap — 0008",
                  "costChf": 400,
                  "annualUpliftChf": 10,
                  "deltaValueChf": 260,
                  "marginalYieldPct": 3.85,
                  "accretive": true
                },
                {
                  "assetId": "f8d26c10-749f-4cf7-8ab7-0fdf66e160e0",
                  "unitId": "demo-unit-0001",
                  "label": "Balcony (metal) — 0001",
                  "costChf": 4500,
                  "annualUpliftChf": 56.25,
                  "deltaValueChf": 2925,
                  "marginalYieldPct": 1.92,
                  "accretive": false
                },
                {
                  "assetId": "fed929a9-6bb4-4d5a-8d9d-ffd3faa52618",
                  "unitId": "demo-unit-0002",
                  "label": "Parquet flooring (mosaic) — 0002",
                  "costChf": 3500,
                  "annualUpliftChf": 43.75,
                  "deltaValueChf": 2275,
                  "marginalYieldPct": 1.92,
                  "accretive": false
                },
                {
                  "assetId": "15bddbbb-3b21-4889-afdd-faad0b69445b",
                  "unitId": "demo-unit-0004",
                  "label": "Balcony railing (metal) — 0004",
                  "costChf": 800,
                  "annualUpliftChf": 13.33,
                  "deltaValueChf": 520,
                  "marginalYieldPct": 2.56,
                  "accretive": false
                },
                {
                  "assetId": "6eb046ea-15c7-4bea-94a5-edf1298e0efd",
                  "unitId": "demo-unit-0005",
                  "label": "Kitchen cabinets (chipboard) — 0005",
                  "costChf": 4500,
                  "annualUpliftChf": 150,
                  "deltaValueChf": 2925,
                  "marginalYieldPct": 5.13,
                  "accretive": true
                },
                {
                  "assetId": "792f3563-0ea1-453b-b6a5-5833772b99c6",
                  "unitId": "demo-unit-0006",
                  "label": "Insulated windows (PVC/wood) — 0006",
                  "costChf": 1100,
                  "annualUpliftChf": 22,
                  "deltaValueChf": 715,
                  "marginalYieldPct": 3.08,
                  "accretive": true
                },
                {
                  "assetId": "08fcba5d-ce14-4a56-a79d-a0b8162d88ba",
                  "unitId": "demo-unit-0007",
                  "label": "Bathroom tap — 0007",
                  "costChf": 400,
                  "annualUpliftChf": 10,
                  "deltaValueChf": 260,
                  "marginalYieldPct": 3.85,
                  "accretive": true
                },
                {
                  "assetId": "03f837b4-5c88-4273-89f6-20196359864f",
                  "unitId": "demo-unit-0008",
                  "label": "Parquet flooring (mosaic) — 0008",
                  "costChf": 3500,
                  "annualUpliftChf": 43.75,
                  "deltaValueChf": 2275,
                  "marginalYieldPct": 1.92,
                  "accretive": false
                },
                {
                  "assetId": "a3ae7efb-bb6d-4ac7-87e0-9780a24736f9",
                  "unitId": "demo-unit-0001",
                  "label": "Balcony railing (metal) — 0001",
                  "costChf": 800,
                  "annualUpliftChf": 13.33,
                  "deltaValueChf": 520,
                  "marginalYieldPct": 2.56,
                  "accretive": false
                },
                {
                  "assetId": "0bf59d2d-31b7-450c-a0dc-d955e1845461",
                  "unitId": "demo-unit-0004",
                  "label": "Bathtub (acrylic) — 0004",
                  "costChf": 900,
                  "annualUpliftChf": 18,
                  "deltaValueChf": 585,
                  "marginalYieldPct": 3.08,
                  "accretive": true
                },
                {
                  "assetId": "f7040c38-9a3a-44d4-a62d-2617c7cce8e7",
                  "unitId": "demo-unit-0004",
                  "label": "Kitchen tap — 0004",
                  "costChf": 400,
                  "annualUpliftChf": 10,
                  "deltaValueChf": 260,
                  "marginalYieldPct": 3.85,
                  "accretive": true
                },
                {
                  "assetId": "3f1a28ca-2d61-4f95-a3b4-9508beb16d9b",
                  "unitId": "demo-unit-0005",
                  "label": "Kitchen tiles (ceramic) — 0005",
                  "costChf": 1600,
                  "annualUpliftChf": 26.67,
                  "deltaValueChf": 1040,
                  "marginalYieldPct": 2.56,
                  "accretive": false
                },
                {
                  "assetId": "3a7024af-7bc7-4ec1-abf3-adb5741758a1",
                  "unitId": "demo-unit-0007",
                  "label": "Insulated windows (PVC/wood) — 0007",
                  "costChf": 1100,
                  "annualUpliftChf": 22,
                  "deltaValueChf": 715,
                  "marginalYieldPct": 3.08,
                  "accretive": true
                },
                {
                  "assetId": "a3f412c3-d042-423e-b3cb-5838c784d157",
                  "unitId": "demo-unit-0007",
                  "label": "Power sockets — 0007",
                  "costChf": 130,
                  "annualUpliftChf": 4.33,
                  "deltaValueChf": 84.5,
                  "marginalYieldPct": 5.13,
                  "accretive": true
                },
                {
                  "assetId": "f835d7c4-588f-4095-86ae-1d20f6115a1f",
                  "unitId": "demo-unit-0008",
                  "label": "Kitchen tap — 0008",
                  "costChf": 400,
                  "annualUpliftChf": 10,
                  "deltaValueChf": 260,
                  "marginalYieldPct": 3.85,
                  "accretive": true
                },
                {
                  "assetId": "09f5897d-1e6c-4675-8294-c8972adb606a",
                  "unitId": "demo-unit-0008",
                  "label": "Wall paint (dispersion) — 0008",
                  "costChf": 2200,
                  "annualUpliftChf": 137.5,
                  "deltaValueChf": 1430,
                  "marginalYieldPct": 9.62,
                  "accretive": true
                }
              ],
              "accretiveCount": 39,
              "ceilingYieldPct": 2.59,
              "feasible": false,
              "offStrategy": true,
              "capexChf": 42560,
              "annualUpliftChf": 1584.48,
              "deltaValueChf": 27664
            }
          },
          "synthesis": {
            "withinStrategyYieldPct": 3.4,
            "withRenovationYieldPct": 3.41,
            "withSelfManageYieldPct": 3.44
          },
          "currentFeePct": 5.54,
          "feeSource": "statements",
          "opexDrivers": [
            {
              "label": "Chauffage et eau chaude",
              "annualChf": 19350,
              "category": "RECOVERABLE"
            },
            {
              "label": "Conciergerie et nettoyage",
              "annualChf": 14400,
              "category": "RECOVERABLE"
            },
            {
              "label": "Entretien des appartements",
              "annualChf": 7040,
              "category": "OWNER_OPEX"
            },
            {
              "label": "Assurances immeuble",
              "annualChf": 5420,
              "category": "OWNER_OPEX"
            },
            {
              "label": "Entretien parties communes",
              "annualChf": 5380,
              "category": "OWNER_OPEX"
            },
            {
              "label": "Eau et épuration",
              "annualChf": 5350,
              "category": "RECOVERABLE"
            }
          ],
          "strategyOwnerName": null,
          "occupancyGainAnnualChf": 32064,
          "vacantUnits": [
            {
              "label": "9004",
              "kind": "parking",
              "expectedAnnualChf": 1872,
              "hasAskingRent": true
            },
            {
              "label": "0008",
              "kind": "residential",
              "expectedAnnualChf": 30192,
              "hasAskingRent": true
            }
          ],
          "rentMarketDetail": [
            {
              "label": "0005",
              "livingAreaSqm": 104,
              "pricePerSqmChf": 13500,
              "grossYieldPct": 3.3,
              "vetustePct": 29,
              "currentAnnualChf": 30660,
              "marketAnnualChf": 40957,
              "gapChf": 10297
            },
            {
              "label": "0003",
              "livingAreaSqm": 102,
              "pricePerSqmChf": 13500,
              "grossYieldPct": 3.3,
              "vetustePct": 32,
              "currentAnnualChf": 29724,
              "marketAnnualChf": 39625,
              "gapChf": 9901
            },
            {
              "label": "0008",
              "livingAreaSqm": 101,
              "pricePerSqmChf": 13500,
              "grossYieldPct": 3.3,
              "vetustePct": 29,
              "currentAnnualChf": 30192,
              "marketAnnualChf": 39776,
              "gapChf": 9584
            },
            {
              "label": "0007",
              "livingAreaSqm": 79,
              "pricePerSqmChf": 13500,
              "grossYieldPct": 3.3,
              "vetustePct": 26,
              "currentAnnualChf": 23520,
              "marketAnnualChf": 31534,
              "gapChf": 8014
            },
            {
              "label": "0001",
              "livingAreaSqm": 78,
              "pricePerSqmChf": 13500,
              "grossYieldPct": 3.3,
              "vetustePct": 26,
              "currentAnnualChf": 23172,
              "marketAnnualChf": 31135,
              "gapChf": 7963
            },
            {
              "label": "0004",
              "livingAreaSqm": 80,
              "pricePerSqmChf": 13500,
              "grossYieldPct": 3.3,
              "vetustePct": 26,
              "currentAnnualChf": 23988,
              "marketAnnualChf": 31933,
              "gapChf": 7945
            },
            {
              "label": "0002",
              "livingAreaSqm": 58,
              "pricePerSqmChf": 13500,
              "grossYieldPct": 3.3,
              "vetustePct": 29,
              "currentAnnualChf": 18840,
              "marketAnnualChf": 22842,
              "gapChf": 4002
            },
            {
              "label": "0006",
              "livingAreaSqm": 56,
              "pricePerSqmChf": 13500,
              "grossYieldPct": 3.3,
              "vetustePct": 32,
              "currentAnnualChf": 19776,
              "marketAnnualChf": 21755,
              "gapChf": 1979
            }
          ],
          "rentMarketBasis": {
            "grossYieldPct": 3.3,
            "vetusteCoeffPct": 40,
            "pricePerSqmSource": "intrinsic"
          },
          "periodFrom": "2025-01-01",
          "periodTo": "2025-12-31"
        }
      },
      "/cashflow-plans/demo-plan/npv-scenarios": {
        "data": {
          "buildingId": "demo-building",
          "buildingName": "Résidence des Charmilles",
          "discountRatePct": 4,
          "incomeGrowthRatePct": 1,
          "horizonYears": 10,
          "deferYears": 3,
          "baseAnnualNoiChf": 190416,
          "noIncomeData": false,
          "noiEstimatedFromRent": true,
          "fromYear": 2026,
          "toYear": 2035,
          "scenarios": {
            "invest": {
              "npvChf": 5740238,
              "totalCapexChf": 330000,
              "totalTaxShieldChf": 55692,
              "totalNoiChf": 1996412,
              "terminalValuePvChf": 4357389,
              "yearlyFlows": [
                {
                  "year": 2026,
                  "projectedNoiChf": 181216,
                  "capexChf": 87500,
                  "taxShieldChf": 12125,
                  "netCashFlowChf": 105841,
                  "discountFactor": 0.9615,
                  "pvChf": 101770,
                  "cumulativePvChf": 101770
                },
                {
                  "year": 2027,
                  "projectedNoiChf": 191000,
                  "capexChf": 11700,
                  "taxShieldChf": 2925,
                  "netCashFlowChf": 182225,
                  "discountFactor": 0.9246,
                  "pvChf": 168477,
                  "cumulativePvChf": 270247
                },
                {
                  "year": 2028,
                  "projectedNoiChf": 194303,
                  "capexChf": 35910,
                  "taxShieldChf": 8945,
                  "netCashFlowChf": 167338,
                  "discountFactor": 0.889,
                  "pvChf": 148763,
                  "cumulativePvChf": 419010
                },
                {
                  "year": 2029,
                  "projectedNoiChf": 198286,
                  "capexChf": 16870,
                  "taxShieldChf": 3810,
                  "netCashFlowChf": 185226,
                  "discountFactor": 0.8548,
                  "pvChf": 158332,
                  "cumulativePvChf": 577342
                },
                {
                  "year": 2030,
                  "projectedNoiChf": 200248,
                  "capexChf": 13430,
                  "taxShieldChf": 2805,
                  "netCashFlowChf": 189623,
                  "discountFactor": 0.8219,
                  "pvChf": 155856,
                  "cumulativePvChf": 733198
                },
                {
                  "year": 2031,
                  "projectedNoiChf": 202229,
                  "capexChf": 7950,
                  "taxShieldChf": 1988,
                  "netCashFlowChf": 196267,
                  "discountFactor": 0.7903,
                  "pvChf": 155113,
                  "cumulativePvChf": 888311
                },
                {
                  "year": 2032,
                  "projectedNoiChf": 204230,
                  "capexChf": 120970,
                  "taxShieldChf": 16484,
                  "netCashFlowChf": 99744,
                  "discountFactor": 0.7599,
                  "pvChf": 75797,
                  "cumulativePvChf": 964108
                },
                {
                  "year": 2033,
                  "projectedNoiChf": 206252,
                  "capexChf": 13030,
                  "taxShieldChf": 2116,
                  "netCashFlowChf": 195338,
                  "discountFactor": 0.7307,
                  "pvChf": 142732,
                  "cumulativePvChf": 1106840
                },
                {
                  "year": 2034,
                  "projectedNoiChf": 208293,
                  "capexChf": 9120,
                  "taxShieldChf": 2272,
                  "netCashFlowChf": 201445,
                  "discountFactor": 0.7026,
                  "pvChf": 141533,
                  "cumulativePvChf": 1248373
                },
                {
                  "year": 2035,
                  "projectedNoiChf": 210355,
                  "capexChf": 13520,
                  "taxShieldChf": 2222,
                  "netCashFlowChf": 199057,
                  "discountFactor": 0.6756,
                  "pvChf": 134476,
                  "cumulativePvChf": 1382849
                }
              ],
              "levered": {
                "equityNpvChf": -95052,
                "equityIrrPct": 3.67,
                "minDscr": 0.6,
                "avgDscr": 0.66,
                "dscrByYear": [
                  0.6,
                  0.64,
                  0.65,
                  0.66,
                  0.67,
                  0.67,
                  0.68,
                  0.69,
                  0.69,
                  0.7
                ]
              }
            },
            "defer": {
              "npvChf": 5722246,
              "totalCapexChf": 330000,
              "totalTaxShieldChf": 55692,
              "totalNoiChf": 1962512,
              "terminalValuePvChf": 4357389,
              "yearlyFlows": [
                {
                  "year": 2026,
                  "projectedNoiChf": 181216,
                  "capexChf": 0,
                  "taxShieldChf": 0,
                  "netCashFlowChf": 181216,
                  "discountFactor": 0.9615,
                  "pvChf": 174246,
                  "cumulativePvChf": 174246
                },
                {
                  "year": 2027,
                  "projectedNoiChf": 183120,
                  "capexChf": 0,
                  "taxShieldChf": 0,
                  "netCashFlowChf": 183120,
                  "discountFactor": 0.9246,
                  "pvChf": 169305,
                  "cumulativePvChf": 343551
                },
                {
                  "year": 2028,
                  "projectedNoiChf": 185043,
                  "capexChf": 0,
                  "taxShieldChf": 0,
                  "netCashFlowChf": 185043,
                  "discountFactor": 0.889,
                  "pvChf": 164503,
                  "cumulativePvChf": 508054
                },
                {
                  "year": 2029,
                  "projectedNoiChf": 186986,
                  "capexChf": 104370,
                  "taxShieldChf": 15935,
                  "netCashFlowChf": 98551,
                  "discountFactor": 0.8548,
                  "pvChf": 84242,
                  "cumulativePvChf": 592296
                },
                {
                  "year": 2030,
                  "projectedNoiChf": 196828,
                  "capexChf": 25130,
                  "taxShieldChf": 5730,
                  "netCashFlowChf": 177428,
                  "discountFactor": 0.8219,
                  "pvChf": 145833,
                  "cumulativePvChf": 738129
                },
                {
                  "year": 2031,
                  "projectedNoiChf": 200189,
                  "capexChf": 43860,
                  "taxShieldChf": 10933,
                  "netCashFlowChf": 167262,
                  "discountFactor": 0.7903,
                  "pvChf": 132190,
                  "cumulativePvChf": 870319
                },
                {
                  "year": 2032,
                  "projectedNoiChf": 204230,
                  "capexChf": 120970,
                  "taxShieldChf": 16484,
                  "netCashFlowChf": 99744,
                  "discountFactor": 0.7599,
                  "pvChf": 75797,
                  "cumulativePvChf": 946116
                },
                {
                  "year": 2033,
                  "projectedNoiChf": 206252,
                  "capexChf": 13030,
                  "taxShieldChf": 2116,
                  "netCashFlowChf": 195338,
                  "discountFactor": 0.7307,
                  "pvChf": 142732,
                  "cumulativePvChf": 1088848
                },
                {
                  "year": 2034,
                  "projectedNoiChf": 208293,
                  "capexChf": 9120,
                  "taxShieldChf": 2272,
                  "netCashFlowChf": 201445,
                  "discountFactor": 0.7026,
                  "pvChf": 141533,
                  "cumulativePvChf": 1230381
                },
                {
                  "year": 2035,
                  "projectedNoiChf": 210355,
                  "capexChf": 13520,
                  "taxShieldChf": 2222,
                  "netCashFlowChf": 199057,
                  "discountFactor": 0.6756,
                  "pvChf": 134476,
                  "cumulativePvChf": 1364857
                }
              ],
              "levered": {
                "equityNpvChf": -113045,
                "equityIrrPct": 3.6,
                "minDscr": 0.6,
                "avgDscr": 0.65,
                "dscrByYear": [
                  0.6,
                  0.61,
                  0.62,
                  0.62,
                  0.66,
                  0.67,
                  0.68,
                  0.69,
                  0.69,
                  0.7
                ]
              }
            },
            "neglect": {
              "npvChf": 5639928,
              "totalCapexChf": 0,
              "totalTaxShieldChf": 0,
              "totalNoiChf": 1857868,
              "terminalValuePvChf": 4134453,
              "yearlyFlows": [
                {
                  "year": 2026,
                  "projectedNoiChf": 181216,
                  "capexChf": 0,
                  "taxShieldChf": 0,
                  "netCashFlowChf": 181216,
                  "discountFactor": 0.9615,
                  "pvChf": 174246,
                  "cumulativePvChf": 174246
                },
                {
                  "year": 2027,
                  "projectedNoiChf": 183120,
                  "capexChf": 0,
                  "taxShieldChf": 0,
                  "netCashFlowChf": 183120,
                  "discountFactor": 0.9246,
                  "pvChf": 169305,
                  "cumulativePvChf": 343551
                },
                {
                  "year": 2028,
                  "projectedNoiChf": 185043,
                  "capexChf": 0,
                  "taxShieldChf": 0,
                  "netCashFlowChf": 185043,
                  "discountFactor": 0.889,
                  "pvChf": 164503,
                  "cumulativePvChf": 508054
                },
                {
                  "year": 2029,
                  "projectedNoiChf": 186986,
                  "capexChf": 0,
                  "taxShieldChf": 0,
                  "netCashFlowChf": 186986,
                  "discountFactor": 0.8548,
                  "pvChf": 159836,
                  "cumulativePvChf": 667890
                },
                {
                  "year": 2030,
                  "projectedNoiChf": 186966,
                  "capexChf": 0,
                  "taxShieldChf": 0,
                  "netCashFlowChf": 186966,
                  "discountFactor": 0.8219,
                  "pvChf": 153672,
                  "cumulativePvChf": 821562
                },
                {
                  "year": 2031,
                  "projectedNoiChf": 186947,
                  "capexChf": 0,
                  "taxShieldChf": 0,
                  "netCashFlowChf": 186947,
                  "discountFactor": 0.7903,
                  "pvChf": 147747,
                  "cumulativePvChf": 969309
                },
                {
                  "year": 2032,
                  "projectedNoiChf": 186927,
                  "capexChf": 0,
                  "taxShieldChf": 0,
                  "netCashFlowChf": 186927,
                  "discountFactor": 0.7599,
                  "pvChf": 142049,
                  "cumulativePvChf": 1111358
                },
                {
                  "year": 2033,
                  "projectedNoiChf": 186907,
                  "capexChf": 0,
                  "taxShieldChf": 0,
                  "netCashFlowChf": 186907,
                  "discountFactor": 0.7307,
                  "pvChf": 136571,
                  "cumulativePvChf": 1247929
                },
                {
                  "year": 2034,
                  "projectedNoiChf": 186888,
                  "capexChf": 0,
                  "taxShieldChf": 0,
                  "netCashFlowChf": 186888,
                  "discountFactor": 0.7026,
                  "pvChf": 131305,
                  "cumulativePvChf": 1379234
                },
                {
                  "year": 2035,
                  "projectedNoiChf": 186868,
                  "capexChf": 0,
                  "taxShieldChf": 0,
                  "netCashFlowChf": 186868,
                  "discountFactor": 0.6756,
                  "pvChf": 126241,
                  "cumulativePvChf": 1505475
                }
              ],
              "levered": {
                "equityNpvChf": -195361,
                "equityIrrPct": 3.29,
                "minDscr": 0.6,
                "avgDscr": 0.62,
                "dscrByYear": [
                  0.6,
                  0.61,
                  0.62,
                  0.62,
                  0.62,
                  0.62,
                  0.62,
                  0.62,
                  0.62,
                  0.62
                ]
              }
            }
          },
          "terminalValueModeled": true,
          "propertyValueChf": 6450000,
          "neglectNoiErosionRatePct": 1,
          "ownerMarginalTaxRatePct": 25,
          "ownerTaxRateIsDefault": true,
          "fciCurrentPct": 4,
          "fciNeglectHorizonPct": 79.9,
          "totalReplacementValueChf": 412800,
          "debt": {
            "totalDebtChf": 3900000,
            "weightedCostOfDebtPct": 1.85,
            "ltvPct": 60.5,
            "waccPct": 2.42,
            "currentEquityChf": 2550000,
            "marketValueChf": 6450000,
            "costOfEquityPct": 4
          },
          "strategyContext": {
            "hasProfile": true,
            "source": "building",
            "archetype": "capital_preserver",
            "roleIntent": "stable_hold",
            "recommendedScenario": "defer",
            "rationale": "Capital-preserver profile — good facility condition allows near-term deferral without material risk."
          }
        }
      }
    },
    "5": {
      "/buildings/demo-building/yield-goalseek": {
        "data": {
          "currentYieldPct": 2.57,
          "targetYieldPct": 3,
          "valueChf": 6535625,
          "currentNoiChf": 168256,
          "rentRollChf": 207360,
          "occupancyRate": 0.8333,
          "requiredNoiChf": 196068.75,
          "gapChf": 27812.75,
          "met": false,
          "strategySource": "building",
          "strategyFlags": {
            "renovation": false,
            "rentAggressive": false,
            "selfManage": false
          },
          "strategyLabel": "value_builder",
          "levers": {
            "rent": {
              "deltaMonthlyChf": 2317.73,
              "pctOfRentRoll": 0.1341,
              "marketGapAnnualChf": 59685,
              "avgLeaseRemainingMonths": null,
              "feasible": true,
              "offStrategy": false
            },
            "opex": {
              "requiredReductionChf": 27812.75,
              "operatingCostChf": 61880,
              "headroomChf": 3094,
              "feasible": false,
              "offStrategy": false
            },
            "occupancy": {
              "requiredOccupancyRate": 0.9451,
              "feasible": true,
              "offStrategy": false
            },
            "mgmtFee": {
              "feeChf": 11487.74,
              "ppOfYield": 0.176,
              "gapCoverPct": 0.413,
              "selfManage": false,
              "feasible": true,
              "offStrategy": false
            },
            "renovation": {
              "lines": [
                {
                  "assetId": "6c634239-94ee-4688-b976-03d81ce89ec2",
                  "unitId": "demo-unit-0003",
                  "label": "Insulated windows (PVC/wood) — 0003",
                  "costChf": 1100,
                  "annualUpliftChf": 22,
                  "deltaValueChf": 715,
                  "marginalYieldPct": 3.08,
                  "accretive": true
                },
                {
                  "assetId": "dada94b5-2ae5-4989-8868-fccf5373a595",
                  "unitId": "demo-unit-0005",
                  "label": "Parquet flooring (mosaic) — 0005",
                  "costChf": 3500,
                  "annualUpliftChf": 43.75,
                  "deltaValueChf": 2275,
                  "marginalYieldPct": 1.92,
                  "accretive": false
                },
                {
                  "assetId": "a40eef84-b8e4-44a9-957e-fa408f9da8de",
                  "unitId": "demo-unit-0008",
                  "label": "Kitchen cabinets (chipboard) — 0008",
                  "costChf": 4500,
                  "annualUpliftChf": 150,
                  "deltaValueChf": 2925,
                  "marginalYieldPct": 5.13,
                  "accretive": true
                },
                {
                  "assetId": "50d1b281-b019-4f7e-bdaf-294af8355edc",
                  "unitId": "demo-unit-0003",
                  "label": "Kitchen cabinets (chipboard) — 0003",
                  "costChf": 4500,
                  "annualUpliftChf": 150,
                  "deltaValueChf": 2925,
                  "marginalYieldPct": 5.13,
                  "accretive": true
                },
                {
                  "assetId": "45ed30a9-f059-4cb0-9e2f-bfad84b311f9",
                  "unitId": "demo-unit-0006",
                  "label": "Interior doors (chipboard) — 0006",
                  "costChf": 450,
                  "annualUpliftChf": 9,
                  "deltaValueChf": 292.5,
                  "marginalYieldPct": 3.08,
                  "accretive": true
                },
                {
                  "assetId": "9850ddb9-679f-44dc-9ac3-c696192ab7f2",
                  "unitId": "demo-unit-0006",
                  "label": "Roller shutters (plastic) — 0006",
                  "costChf": 550,
                  "annualUpliftChf": 13.75,
                  "deltaValueChf": 357.5,
                  "marginalYieldPct": 3.85,
                  "accretive": true
                },
                {
                  "assetId": "0581e949-581f-4a4a-ae0c-f7da89f0de3f",
                  "unitId": "demo-unit-0008",
                  "label": "Power sockets — 0008",
                  "costChf": 130,
                  "annualUpliftChf": 4.33,
                  "deltaValueChf": 84.5,
                  "marginalYieldPct": 5.13,
                  "accretive": true
                },
                {
                  "assetId": "dc4ce34d-f394-4d4d-b771-a7b0baafca8d",
                  "unitId": "demo-unit-0001",
                  "label": "Kitchen tap — 0001",
                  "costChf": 400,
                  "annualUpliftChf": 10,
                  "deltaValueChf": 260,
                  "marginalYieldPct": 3.85,
                  "accretive": true
                },
                {
                  "assetId": "61216168-5e7e-431e-8cc7-3ba4d3b80073",
                  "unitId": "demo-unit-0002",
                  "label": "Power sockets — 0002",
                  "costChf": 130,
                  "annualUpliftChf": 4.33,
                  "deltaValueChf": 84.5,
                  "marginalYieldPct": 5.13,
                  "accretive": true
                },
                {
                  "assetId": "91b041f9-cd2c-408a-a929-94a53c03f89f",
                  "unitId": "demo-unit-0005",
                  "label": "Bathroom tap — 0005",
                  "costChf": 400,
                  "annualUpliftChf": 10,
                  "deltaValueChf": 260,
                  "marginalYieldPct": 3.85,
                  "accretive": true
                },
                {
                  "assetId": "c7cf90f2-0c6c-43d9-9b62-02ee6049b2e0",
                  "unitId": "demo-unit-0002",
                  "label": "Kitchen worktop (synthetic) — 0002",
                  "costChf": 1200,
                  "annualUpliftChf": 40,
                  "deltaValueChf": 780,
                  "marginalYieldPct": 5.13,
                  "accretive": true
                },
                {
                  "assetId": "bac575dc-2bff-432a-8f72-535b77cccadc",
                  "unitId": "demo-unit-0003",
                  "label": "Bathroom tap — 0003",
                  "costChf": 400,
                  "annualUpliftChf": 10,
                  "deltaValueChf": 260,
                  "marginalYieldPct": 3.85,
                  "accretive": true
                },
                {
                  "assetId": "02c95df5-f3c1-4072-b96a-6bcbcd0dc684",
                  "unitId": "demo-unit-0004",
                  "label": "Roller shutters (plastic) — 0004",
                  "costChf": 550,
                  "annualUpliftChf": 13.75,
                  "deltaValueChf": 357.5,
                  "marginalYieldPct": 3.85,
                  "accretive": true
                },
                {
                  "assetId": "55f097f4-fcc6-4ca4-a643-58e2bb025b00",
                  "unitId": "demo-unit-0004",
                  "label": "Wall paint (dispersion) — 0004",
                  "costChf": 2200,
                  "annualUpliftChf": 137.5,
                  "deltaValueChf": 1430,
                  "marginalYieldPct": 9.62,
                  "accretive": true
                },
                {
                  "assetId": "ac41b933-be89-48e0-82a3-ee702f81d509",
                  "unitId": "demo-unit-0005",
                  "label": "Light switches — 0005",
                  "costChf": 70,
                  "annualUpliftChf": 2.33,
                  "deltaValueChf": 45.5,
                  "marginalYieldPct": 5.13,
                  "accretive": true
                },
                {
                  "assetId": "58733997-0f0a-43e6-96e0-493710dfc4ba",
                  "unitId": "demo-unit-0007",
                  "label": "Sanitary ceramics (WC/basin) — 0007",
                  "costChf": 1200,
                  "annualUpliftChf": 17.14,
                  "deltaValueChf": 780,
                  "marginalYieldPct": 2.2,
                  "accretive": false
                },
                {
                  "assetId": "ca58ae14-5da2-4143-ac28-6facf4dd5e0f",
                  "unitId": "demo-unit-0008",
                  "label": "Balcony railing (metal) — 0008",
                  "costChf": 800,
                  "annualUpliftChf": 13.33,
                  "deltaValueChf": 520,
                  "marginalYieldPct": 2.56,
                  "accretive": false
                },
                {
                  "assetId": "2e9fbb78-1b17-42cb-b283-1c49f74dfb1a",
                  "unitId": "demo-unit-0008",
                  "label": "Bathroom tiles (ceramic) — 0008",
                  "costChf": 2200,
                  "annualUpliftChf": 36.67,
                  "deltaValueChf": 1430,
                  "marginalYieldPct": 2.56,
                  "accretive": false
                },
                {
                  "assetId": "e29c9d98-9f30-4e86-bfa0-38595f75afe3",
                  "unitId": "demo-unit-0006",
                  "label": "Wall paint (dispersion) — 0006",
                  "costChf": 2200,
                  "annualUpliftChf": 137.5,
                  "deltaValueChf": 1430,
                  "marginalYieldPct": 9.62,
                  "accretive": true
                },
                {
                  "assetId": "cdcd4dd1-604c-4dce-a25d-fd25c2cb8c0e",
                  "unitId": "demo-unit-0001",
                  "label": "Kitchen worktop (synthetic) — 0001",
                  "costChf": 1200,
                  "annualUpliftChf": 40,
                  "deltaValueChf": 780,
                  "marginalYieldPct": 5.13,
                  "accretive": true
                },
                {
                  "assetId": "dc7ed960-a649-4727-9652-c847277e5cff",
                  "unitId": "demo-unit-0001",
                  "label": "Insulated windows (PVC/wood) — 0001",
                  "costChf": 1100,
                  "annualUpliftChf": 22,
                  "deltaValueChf": 715,
                  "marginalYieldPct": 3.08,
                  "accretive": true
                },
                {
                  "assetId": "9a85dc6c-88c1-4fbe-bf56-603a60abf0a7",
                  "unitId": "demo-unit-0002",
                  "label": "Bathtub (acrylic) — 0002",
                  "costChf": 900,
                  "annualUpliftChf": 18,
                  "deltaValueChf": 585,
                  "marginalYieldPct": 3.08,
                  "accretive": true
                },
                {
                  "assetId": "41d16db4-e57d-40a5-b27b-eec76be78f29",
                  "unitId": "demo-unit-0003",
                  "label": "Roller shutters (plastic) — 0003",
                  "costChf": 550,
                  "annualUpliftChf": 13.75,
                  "deltaValueChf": 357.5,
                  "marginalYieldPct": 3.85,
                  "accretive": true
                },
                {
                  "assetId": "4731f5fb-707c-4cae-a81f-d497b47e202a",
                  "unitId": "demo-unit-0003",
                  "label": "Wall paint (dispersion) — 0003",
                  "costChf": 2200,
                  "annualUpliftChf": 137.5,
                  "deltaValueChf": 1430,
                  "marginalYieldPct": 9.62,
                  "accretive": true
                },
                {
                  "assetId": "33e4f919-5713-41cf-a138-ce49e9977bf2",
                  "unitId": "demo-unit-0003",
                  "label": "Power sockets — 0003",
                  "costChf": 130,
                  "annualUpliftChf": 4.33,
                  "deltaValueChf": 84.5,
                  "marginalYieldPct": 5.13,
                  "accretive": true
                },
                {
                  "assetId": "87fa03d4-bcde-4366-8042-93d7435bbe1d",
                  "unitId": "demo-unit-0006",
                  "label": "Bathroom tap — 0006",
                  "costChf": 400,
                  "annualUpliftChf": 10,
                  "deltaValueChf": 260,
                  "marginalYieldPct": 3.85,
                  "accretive": true
                },
                {
                  "assetId": "5deed3d2-85f9-4338-89ed-c47dbefce005",
                  "unitId": "demo-unit-0006",
                  "label": "Bathtub (acrylic) — 0006",
                  "costChf": 900,
                  "annualUpliftChf": 18,
                  "deltaValueChf": 585,
                  "marginalYieldPct": 3.08,
                  "accretive": true
                },
                {
                  "assetId": "e4275079-9010-446e-91dd-f7a61e8157fb",
                  "unitId": "demo-unit-0006",
                  "label": "Kitchen tap — 0006",
                  "costChf": 400,
                  "annualUpliftChf": 10,
                  "deltaValueChf": 260,
                  "marginalYieldPct": 3.85,
                  "accretive": true
                },
                {
                  "assetId": "b6111e02-6a28-4a94-bbfa-227b79f1e24a",
                  "unitId": "demo-unit-0006",
                  "label": "Light switches — 0006",
                  "costChf": 70,
                  "annualUpliftChf": 2.33,
                  "deltaValueChf": 45.5,
                  "marginalYieldPct": 5.13,
                  "accretive": true
                },
                {
                  "assetId": "f77ae1ad-4ce9-4a8a-8163-02f139db7763",
                  "unitId": "demo-unit-0007",
                  "label": "Interior doors (chipboard) — 0007",
                  "costChf": 450,
                  "annualUpliftChf": 9,
                  "deltaValueChf": 292.5,
                  "marginalYieldPct": 3.08,
                  "accretive": true
                },
                {
                  "assetId": "6d7aaa72-8631-4b77-8bf8-7c7feaccaa85",
                  "unitId": "demo-unit-0007",
                  "label": "Bathroom tiles (ceramic) — 0007",
                  "costChf": 2200,
                  "annualUpliftChf": 36.67,
                  "deltaValueChf": 1430,
                  "marginalYieldPct": 2.56,
                  "accretive": false
                },
                {
                  "assetId": "96a56bb1-5085-4a5c-9df1-a3af9fb2c26a",
                  "unitId": "demo-unit-0008",
                  "label": "Balcony (metal) — 0008",
                  "costChf": 4500,
                  "annualUpliftChf": 56.25,
                  "deltaValueChf": 2925,
                  "marginalYieldPct": 1.92,
                  "accretive": false
                },
                {
                  "assetId": "347394e1-bdaa-4774-8845-60fd14753ade",
                  "unitId": "demo-unit-0001",
                  "label": "Kitchen tiles (ceramic) — 0001",
                  "costChf": 1600,
                  "annualUpliftChf": 26.67,
                  "deltaValueChf": 1040,
                  "marginalYieldPct": 2.56,
                  "accretive": false
                },
                {
                  "assetId": "f3bbaccd-5ff8-46ac-93ca-4d13471c4786",
                  "unitId": "demo-unit-0003",
                  "label": "Balcony railing (metal) — 0003",
                  "costChf": 800,
                  "annualUpliftChf": 13.33,
                  "deltaValueChf": 520,
                  "marginalYieldPct": 2.56,
                  "accretive": false
                },
                {
                  "assetId": "50d4329b-50c3-48cf-b25f-28f1d397a119",
                  "unitId": "demo-unit-0003",
                  "label": "Kitchen worktop (synthetic) — 0003",
                  "costChf": 1200,
                  "annualUpliftChf": 40,
                  "deltaValueChf": 780,
                  "marginalYieldPct": 5.13,
                  "accretive": true
                },
                {
                  "assetId": "82fe8641-7a63-4de3-a70c-14152b2e9fe7",
                  "unitId": "demo-unit-0007",
                  "label": "Roller shutters (plastic) — 0007",
                  "costChf": 550,
                  "annualUpliftChf": 13.75,
                  "deltaValueChf": 357.5,
                  "marginalYieldPct": 3.85,
                  "accretive": true
                },
                {
                  "assetId": "29743c70-02ea-40f1-8a8c-f288eefd82f0",
                  "unitId": "demo-unit-0007",
                  "label": "Wall paint (dispersion) — 0007",
                  "costChf": 2200,
                  "annualUpliftChf": 137.5,
                  "deltaValueChf": 1430,
                  "marginalYieldPct": 9.62,
                  "accretive": true
                },
                {
                  "assetId": "597b7d69-524b-44a5-9993-b5888438b8bf",
                  "unitId": "demo-unit-0008",
                  "label": "Bathroom tap — 0008",
                  "costChf": 400,
                  "annualUpliftChf": 10,
                  "deltaValueChf": 260,
                  "marginalYieldPct": 3.85,
                  "accretive": true
                },
                {
                  "assetId": "f8d26c10-749f-4cf7-8ab7-0fdf66e160e0",
                  "unitId": "demo-unit-0001",
                  "label": "Balcony (metal) — 0001",
                  "costChf": 4500,
                  "annualUpliftChf": 56.25,
                  "deltaValueChf": 2925,
                  "marginalYieldPct": 1.92,
                  "accretive": false
                },
                {
                  "assetId": "fed929a9-6bb4-4d5a-8d9d-ffd3faa52618",
                  "unitId": "demo-unit-0002",
                  "label": "Parquet flooring (mosaic) — 0002",
                  "costChf": 3500,
                  "annualUpliftChf": 43.75,
                  "deltaValueChf": 2275,
                  "marginalYieldPct": 1.92,
                  "accretive": false
                },
                {
                  "assetId": "15bddbbb-3b21-4889-afdd-faad0b69445b",
                  "unitId": "demo-unit-0004",
                  "label": "Balcony railing (metal) — 0004",
                  "costChf": 800,
                  "annualUpliftChf": 13.33,
                  "deltaValueChf": 520,
                  "marginalYieldPct": 2.56,
                  "accretive": false
                },
                {
                  "assetId": "6eb046ea-15c7-4bea-94a5-edf1298e0efd",
                  "unitId": "demo-unit-0005",
                  "label": "Kitchen cabinets (chipboard) — 0005",
                  "costChf": 4500,
                  "annualUpliftChf": 150,
                  "deltaValueChf": 2925,
                  "marginalYieldPct": 5.13,
                  "accretive": true
                },
                {
                  "assetId": "792f3563-0ea1-453b-b6a5-5833772b99c6",
                  "unitId": "demo-unit-0006",
                  "label": "Insulated windows (PVC/wood) — 0006",
                  "costChf": 1100,
                  "annualUpliftChf": 22,
                  "deltaValueChf": 715,
                  "marginalYieldPct": 3.08,
                  "accretive": true
                },
                {
                  "assetId": "08fcba5d-ce14-4a56-a79d-a0b8162d88ba",
                  "unitId": "demo-unit-0007",
                  "label": "Bathroom tap — 0007",
                  "costChf": 400,
                  "annualUpliftChf": 10,
                  "deltaValueChf": 260,
                  "marginalYieldPct": 3.85,
                  "accretive": true
                },
                {
                  "assetId": "03f837b4-5c88-4273-89f6-20196359864f",
                  "unitId": "demo-unit-0008",
                  "label": "Parquet flooring (mosaic) — 0008",
                  "costChf": 3500,
                  "annualUpliftChf": 43.75,
                  "deltaValueChf": 2275,
                  "marginalYieldPct": 1.92,
                  "accretive": false
                },
                {
                  "assetId": "a3ae7efb-bb6d-4ac7-87e0-9780a24736f9",
                  "unitId": "demo-unit-0001",
                  "label": "Balcony railing (metal) — 0001",
                  "costChf": 800,
                  "annualUpliftChf": 13.33,
                  "deltaValueChf": 520,
                  "marginalYieldPct": 2.56,
                  "accretive": false
                },
                {
                  "assetId": "0bf59d2d-31b7-450c-a0dc-d955e1845461",
                  "unitId": "demo-unit-0004",
                  "label": "Bathtub (acrylic) — 0004",
                  "costChf": 900,
                  "annualUpliftChf": 18,
                  "deltaValueChf": 585,
                  "marginalYieldPct": 3.08,
                  "accretive": true
                },
                {
                  "assetId": "f7040c38-9a3a-44d4-a62d-2617c7cce8e7",
                  "unitId": "demo-unit-0004",
                  "label": "Kitchen tap — 0004",
                  "costChf": 400,
                  "annualUpliftChf": 10,
                  "deltaValueChf": 260,
                  "marginalYieldPct": 3.85,
                  "accretive": true
                },
                {
                  "assetId": "3f1a28ca-2d61-4f95-a3b4-9508beb16d9b",
                  "unitId": "demo-unit-0005",
                  "label": "Kitchen tiles (ceramic) — 0005",
                  "costChf": 1600,
                  "annualUpliftChf": 26.67,
                  "deltaValueChf": 1040,
                  "marginalYieldPct": 2.56,
                  "accretive": false
                },
                {
                  "assetId": "3a7024af-7bc7-4ec1-abf3-adb5741758a1",
                  "unitId": "demo-unit-0007",
                  "label": "Insulated windows (PVC/wood) — 0007",
                  "costChf": 1100,
                  "annualUpliftChf": 22,
                  "deltaValueChf": 715,
                  "marginalYieldPct": 3.08,
                  "accretive": true
                },
                {
                  "assetId": "a3f412c3-d042-423e-b3cb-5838c784d157",
                  "unitId": "demo-unit-0007",
                  "label": "Power sockets — 0007",
                  "costChf": 130,
                  "annualUpliftChf": 4.33,
                  "deltaValueChf": 84.5,
                  "marginalYieldPct": 5.13,
                  "accretive": true
                },
                {
                  "assetId": "f835d7c4-588f-4095-86ae-1d20f6115a1f",
                  "unitId": "demo-unit-0008",
                  "label": "Kitchen tap — 0008",
                  "costChf": 400,
                  "annualUpliftChf": 10,
                  "deltaValueChf": 260,
                  "marginalYieldPct": 3.85,
                  "accretive": true
                },
                {
                  "assetId": "09f5897d-1e6c-4675-8294-c8972adb606a",
                  "unitId": "demo-unit-0008",
                  "label": "Wall paint (dispersion) — 0008",
                  "costChf": 2200,
                  "annualUpliftChf": 137.5,
                  "deltaValueChf": 1430,
                  "marginalYieldPct": 9.62,
                  "accretive": true
                }
              ],
              "accretiveCount": 39,
              "ceilingYieldPct": 2.59,
              "feasible": false,
              "offStrategy": false,
              "capexChf": 42560,
              "annualUpliftChf": 1584.48,
              "deltaValueChf": 27664
            }
          },
          "synthesis": {
            "withinStrategyYieldPct": 4.31,
            "withRenovationYieldPct": 4.32,
            "withSelfManageYieldPct": 4.35
          },
          "currentFeePct": 5.54,
          "feeSource": "statements",
          "opexDrivers": [
            {
              "label": "Chauffage et eau chaude",
              "annualChf": 19350,
              "category": "RECOVERABLE"
            },
            {
              "label": "Conciergerie et nettoyage",
              "annualChf": 14400,
              "category": "RECOVERABLE"
            },
            {
              "label": "Entretien des appartements",
              "annualChf": 7040,
              "category": "OWNER_OPEX"
            },
            {
              "label": "Assurances immeuble",
              "annualChf": 5420,
              "category": "OWNER_OPEX"
            },
            {
              "label": "Entretien parties communes",
              "annualChf": 5380,
              "category": "OWNER_OPEX"
            },
            {
              "label": "Eau et épuration",
              "annualChf": 5350,
              "category": "RECOVERABLE"
            }
          ],
          "strategyOwnerName": null,
          "occupancyGainAnnualChf": 32064,
          "vacantUnits": [
            {
              "label": "9004",
              "kind": "parking",
              "expectedAnnualChf": 1872,
              "hasAskingRent": true
            },
            {
              "label": "0008",
              "kind": "residential",
              "expectedAnnualChf": 30192,
              "hasAskingRent": true
            }
          ],
          "rentMarketDetail": [
            {
              "label": "0005",
              "livingAreaSqm": 104,
              "pricePerSqmChf": 13500,
              "grossYieldPct": 3.3,
              "vetustePct": 29,
              "currentAnnualChf": 30660,
              "marketAnnualChf": 40957,
              "gapChf": 10297
            },
            {
              "label": "0003",
              "livingAreaSqm": 102,
              "pricePerSqmChf": 13500,
              "grossYieldPct": 3.3,
              "vetustePct": 32,
              "currentAnnualChf": 29724,
              "marketAnnualChf": 39625,
              "gapChf": 9901
            },
            {
              "label": "0008",
              "livingAreaSqm": 101,
              "pricePerSqmChf": 13500,
              "grossYieldPct": 3.3,
              "vetustePct": 29,
              "currentAnnualChf": 30192,
              "marketAnnualChf": 39776,
              "gapChf": 9584
            },
            {
              "label": "0007",
              "livingAreaSqm": 79,
              "pricePerSqmChf": 13500,
              "grossYieldPct": 3.3,
              "vetustePct": 26,
              "currentAnnualChf": 23520,
              "marketAnnualChf": 31534,
              "gapChf": 8014
            },
            {
              "label": "0001",
              "livingAreaSqm": 78,
              "pricePerSqmChf": 13500,
              "grossYieldPct": 3.3,
              "vetustePct": 26,
              "currentAnnualChf": 23172,
              "marketAnnualChf": 31135,
              "gapChf": 7963
            },
            {
              "label": "0004",
              "livingAreaSqm": 80,
              "pricePerSqmChf": 13500,
              "grossYieldPct": 3.3,
              "vetustePct": 26,
              "currentAnnualChf": 23988,
              "marketAnnualChf": 31933,
              "gapChf": 7945
            },
            {
              "label": "0002",
              "livingAreaSqm": 58,
              "pricePerSqmChf": 13500,
              "grossYieldPct": 3.3,
              "vetustePct": 29,
              "currentAnnualChf": 18840,
              "marketAnnualChf": 22842,
              "gapChf": 4002
            },
            {
              "label": "0006",
              "livingAreaSqm": 56,
              "pricePerSqmChf": 13500,
              "grossYieldPct": 3.3,
              "vetustePct": 32,
              "currentAnnualChf": 19776,
              "marketAnnualChf": 21755,
              "gapChf": 1979
            }
          ],
          "rentMarketBasis": {
            "grossYieldPct": 3.3,
            "vetusteCoeffPct": 40,
            "pricePerSqmSource": "intrinsic"
          },
          "periodFrom": "2025-01-01",
          "periodTo": "2025-12-31"
        }
      },
      "/cashflow-plans/demo-plan/npv-scenarios": {
        "data": {
          "buildingId": "demo-building",
          "buildingName": "Résidence des Charmilles",
          "discountRatePct": 4,
          "incomeGrowthRatePct": 1,
          "horizonYears": 10,
          "deferYears": 3,
          "baseAnnualNoiChf": 190416,
          "noIncomeData": false,
          "noiEstimatedFromRent": true,
          "fromYear": 2026,
          "toYear": 2035,
          "scenarios": {
            "invest": {
              "npvChf": 5740238,
              "totalCapexChf": 330000,
              "totalTaxShieldChf": 55692,
              "totalNoiChf": 1996412,
              "terminalValuePvChf": 4357389,
              "yearlyFlows": [
                {
                  "year": 2026,
                  "projectedNoiChf": 181216,
                  "capexChf": 87500,
                  "taxShieldChf": 12125,
                  "netCashFlowChf": 105841,
                  "discountFactor": 0.9615,
                  "pvChf": 101770,
                  "cumulativePvChf": 101770
                },
                {
                  "year": 2027,
                  "projectedNoiChf": 191000,
                  "capexChf": 11700,
                  "taxShieldChf": 2925,
                  "netCashFlowChf": 182225,
                  "discountFactor": 0.9246,
                  "pvChf": 168477,
                  "cumulativePvChf": 270247
                },
                {
                  "year": 2028,
                  "projectedNoiChf": 194303,
                  "capexChf": 35910,
                  "taxShieldChf": 8945,
                  "netCashFlowChf": 167338,
                  "discountFactor": 0.889,
                  "pvChf": 148763,
                  "cumulativePvChf": 419010
                },
                {
                  "year": 2029,
                  "projectedNoiChf": 198286,
                  "capexChf": 16870,
                  "taxShieldChf": 3810,
                  "netCashFlowChf": 185226,
                  "discountFactor": 0.8548,
                  "pvChf": 158332,
                  "cumulativePvChf": 577342
                },
                {
                  "year": 2030,
                  "projectedNoiChf": 200248,
                  "capexChf": 13430,
                  "taxShieldChf": 2805,
                  "netCashFlowChf": 189623,
                  "discountFactor": 0.8219,
                  "pvChf": 155856,
                  "cumulativePvChf": 733198
                },
                {
                  "year": 2031,
                  "projectedNoiChf": 202229,
                  "capexChf": 7950,
                  "taxShieldChf": 1988,
                  "netCashFlowChf": 196267,
                  "discountFactor": 0.7903,
                  "pvChf": 155113,
                  "cumulativePvChf": 888311
                },
                {
                  "year": 2032,
                  "projectedNoiChf": 204230,
                  "capexChf": 120970,
                  "taxShieldChf": 16484,
                  "netCashFlowChf": 99744,
                  "discountFactor": 0.7599,
                  "pvChf": 75797,
                  "cumulativePvChf": 964108
                },
                {
                  "year": 2033,
                  "projectedNoiChf": 206252,
                  "capexChf": 13030,
                  "taxShieldChf": 2116,
                  "netCashFlowChf": 195338,
                  "discountFactor": 0.7307,
                  "pvChf": 142732,
                  "cumulativePvChf": 1106840
                },
                {
                  "year": 2034,
                  "projectedNoiChf": 208293,
                  "capexChf": 9120,
                  "taxShieldChf": 2272,
                  "netCashFlowChf": 201445,
                  "discountFactor": 0.7026,
                  "pvChf": 141533,
                  "cumulativePvChf": 1248373
                },
                {
                  "year": 2035,
                  "projectedNoiChf": 210355,
                  "capexChf": 13520,
                  "taxShieldChf": 2222,
                  "netCashFlowChf": 199057,
                  "discountFactor": 0.6756,
                  "pvChf": 134476,
                  "cumulativePvChf": 1382849
                }
              ],
              "levered": {
                "equityNpvChf": -95052,
                "equityIrrPct": 3.67,
                "minDscr": 0.6,
                "avgDscr": 0.66,
                "dscrByYear": [
                  0.6,
                  0.64,
                  0.65,
                  0.66,
                  0.67,
                  0.67,
                  0.68,
                  0.69,
                  0.69,
                  0.7
                ]
              }
            },
            "defer": {
              "npvChf": 5722246,
              "totalCapexChf": 330000,
              "totalTaxShieldChf": 55692,
              "totalNoiChf": 1962512,
              "terminalValuePvChf": 4357389,
              "yearlyFlows": [
                {
                  "year": 2026,
                  "projectedNoiChf": 181216,
                  "capexChf": 0,
                  "taxShieldChf": 0,
                  "netCashFlowChf": 181216,
                  "discountFactor": 0.9615,
                  "pvChf": 174246,
                  "cumulativePvChf": 174246
                },
                {
                  "year": 2027,
                  "projectedNoiChf": 183120,
                  "capexChf": 0,
                  "taxShieldChf": 0,
                  "netCashFlowChf": 183120,
                  "discountFactor": 0.9246,
                  "pvChf": 169305,
                  "cumulativePvChf": 343551
                },
                {
                  "year": 2028,
                  "projectedNoiChf": 185043,
                  "capexChf": 0,
                  "taxShieldChf": 0,
                  "netCashFlowChf": 185043,
                  "discountFactor": 0.889,
                  "pvChf": 164503,
                  "cumulativePvChf": 508054
                },
                {
                  "year": 2029,
                  "projectedNoiChf": 186986,
                  "capexChf": 104370,
                  "taxShieldChf": 15935,
                  "netCashFlowChf": 98551,
                  "discountFactor": 0.8548,
                  "pvChf": 84242,
                  "cumulativePvChf": 592296
                },
                {
                  "year": 2030,
                  "projectedNoiChf": 196828,
                  "capexChf": 25130,
                  "taxShieldChf": 5730,
                  "netCashFlowChf": 177428,
                  "discountFactor": 0.8219,
                  "pvChf": 145833,
                  "cumulativePvChf": 738129
                },
                {
                  "year": 2031,
                  "projectedNoiChf": 200189,
                  "capexChf": 43860,
                  "taxShieldChf": 10933,
                  "netCashFlowChf": 167262,
                  "discountFactor": 0.7903,
                  "pvChf": 132190,
                  "cumulativePvChf": 870319
                },
                {
                  "year": 2032,
                  "projectedNoiChf": 204230,
                  "capexChf": 120970,
                  "taxShieldChf": 16484,
                  "netCashFlowChf": 99744,
                  "discountFactor": 0.7599,
                  "pvChf": 75797,
                  "cumulativePvChf": 946116
                },
                {
                  "year": 2033,
                  "projectedNoiChf": 206252,
                  "capexChf": 13030,
                  "taxShieldChf": 2116,
                  "netCashFlowChf": 195338,
                  "discountFactor": 0.7307,
                  "pvChf": 142732,
                  "cumulativePvChf": 1088848
                },
                {
                  "year": 2034,
                  "projectedNoiChf": 208293,
                  "capexChf": 9120,
                  "taxShieldChf": 2272,
                  "netCashFlowChf": 201445,
                  "discountFactor": 0.7026,
                  "pvChf": 141533,
                  "cumulativePvChf": 1230381
                },
                {
                  "year": 2035,
                  "projectedNoiChf": 210355,
                  "capexChf": 13520,
                  "taxShieldChf": 2222,
                  "netCashFlowChf": 199057,
                  "discountFactor": 0.6756,
                  "pvChf": 134476,
                  "cumulativePvChf": 1364857
                }
              ],
              "levered": {
                "equityNpvChf": -113045,
                "equityIrrPct": 3.6,
                "minDscr": 0.6,
                "avgDscr": 0.65,
                "dscrByYear": [
                  0.6,
                  0.61,
                  0.62,
                  0.62,
                  0.66,
                  0.67,
                  0.68,
                  0.69,
                  0.69,
                  0.7
                ]
              }
            },
            "neglect": {
              "npvChf": 5639928,
              "totalCapexChf": 0,
              "totalTaxShieldChf": 0,
              "totalNoiChf": 1857868,
              "terminalValuePvChf": 4134453,
              "yearlyFlows": [
                {
                  "year": 2026,
                  "projectedNoiChf": 181216,
                  "capexChf": 0,
                  "taxShieldChf": 0,
                  "netCashFlowChf": 181216,
                  "discountFactor": 0.9615,
                  "pvChf": 174246,
                  "cumulativePvChf": 174246
                },
                {
                  "year": 2027,
                  "projectedNoiChf": 183120,
                  "capexChf": 0,
                  "taxShieldChf": 0,
                  "netCashFlowChf": 183120,
                  "discountFactor": 0.9246,
                  "pvChf": 169305,
                  "cumulativePvChf": 343551
                },
                {
                  "year": 2028,
                  "projectedNoiChf": 185043,
                  "capexChf": 0,
                  "taxShieldChf": 0,
                  "netCashFlowChf": 185043,
                  "discountFactor": 0.889,
                  "pvChf": 164503,
                  "cumulativePvChf": 508054
                },
                {
                  "year": 2029,
                  "projectedNoiChf": 186986,
                  "capexChf": 0,
                  "taxShieldChf": 0,
                  "netCashFlowChf": 186986,
                  "discountFactor": 0.8548,
                  "pvChf": 159836,
                  "cumulativePvChf": 667890
                },
                {
                  "year": 2030,
                  "projectedNoiChf": 186966,
                  "capexChf": 0,
                  "taxShieldChf": 0,
                  "netCashFlowChf": 186966,
                  "discountFactor": 0.8219,
                  "pvChf": 153672,
                  "cumulativePvChf": 821562
                },
                {
                  "year": 2031,
                  "projectedNoiChf": 186947,
                  "capexChf": 0,
                  "taxShieldChf": 0,
                  "netCashFlowChf": 186947,
                  "discountFactor": 0.7903,
                  "pvChf": 147747,
                  "cumulativePvChf": 969309
                },
                {
                  "year": 2032,
                  "projectedNoiChf": 186927,
                  "capexChf": 0,
                  "taxShieldChf": 0,
                  "netCashFlowChf": 186927,
                  "discountFactor": 0.7599,
                  "pvChf": 142049,
                  "cumulativePvChf": 1111358
                },
                {
                  "year": 2033,
                  "projectedNoiChf": 186907,
                  "capexChf": 0,
                  "taxShieldChf": 0,
                  "netCashFlowChf": 186907,
                  "discountFactor": 0.7307,
                  "pvChf": 136571,
                  "cumulativePvChf": 1247929
                },
                {
                  "year": 2034,
                  "projectedNoiChf": 186888,
                  "capexChf": 0,
                  "taxShieldChf": 0,
                  "netCashFlowChf": 186888,
                  "discountFactor": 0.7026,
                  "pvChf": 131305,
                  "cumulativePvChf": 1379234
                },
                {
                  "year": 2035,
                  "projectedNoiChf": 186868,
                  "capexChf": 0,
                  "taxShieldChf": 0,
                  "netCashFlowChf": 186868,
                  "discountFactor": 0.6756,
                  "pvChf": 126241,
                  "cumulativePvChf": 1505475
                }
              ],
              "levered": {
                "equityNpvChf": -195361,
                "equityIrrPct": 3.29,
                "minDscr": 0.6,
                "avgDscr": 0.62,
                "dscrByYear": [
                  0.6,
                  0.61,
                  0.62,
                  0.62,
                  0.62,
                  0.62,
                  0.62,
                  0.62,
                  0.62,
                  0.62
                ]
              }
            }
          },
          "terminalValueModeled": true,
          "propertyValueChf": 6450000,
          "neglectNoiErosionRatePct": 1,
          "ownerMarginalTaxRatePct": 25,
          "ownerTaxRateIsDefault": true,
          "fciCurrentPct": 4,
          "fciNeglectHorizonPct": 79.9,
          "totalReplacementValueChf": 412800,
          "debt": {
            "totalDebtChf": 3900000,
            "weightedCostOfDebtPct": 1.85,
            "ltvPct": 60.5,
            "waccPct": 2.42,
            "currentEquityChf": 2550000,
            "marketValueChf": 6450000,
            "costOfEquityPct": 4
          },
          "strategyContext": {
            "hasProfile": true,
            "source": "building",
            "archetype": "value_builder",
            "roleIntent": "long_term_quality",
            "recommendedScenario": "invest",
            "rationale": "Value-builder profile — full investment on schedule maximises long-term equity and NPV."
          }
        }
      }
    }
  }
};
