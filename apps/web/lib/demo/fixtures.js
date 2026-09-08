/* GENERATED — do not edit by hand.
 * Frozen output of the real ingestion + reporting pipeline.
 * Regenerate: npx tsx apps/api/scripts/generate-demo-fixtures.ts [package-dir]
 */
export default {
  "meta": {
    "generatedAt": "2026-09-08T12:58:51.744Z",
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
        "createdAt": "2026-09-08T12:57:01.702Z",
        "updatedAt": "2026-09-08T12:58:49.890Z",
        "isActive": true,
        "managerId": null,
        "manager": null,
        "owners": [
          {
            "id": "1c612939-dd2c-4531-a8fd-f342a72c30c1",
            "name": "Demo Owner",
            "email": "demo-owner@stoneiq.local"
          }
        ],
        "tenants": [
          {
            "tenantId": "236f06b6-15c9-4c30-a803-101f1731b50a",
            "name": "MARCHAND Sylvie",
            "phone": "+41964780911",
            "email": null,
            "unitNumber": "0001",
            "unitId": "demo-unit-0001",
            "moveInDate": "2018-04-01T00:00:00.000Z",
            "source": "BOTH"
          },
          {
            "tenantId": "872f7fca-4d9a-40f6-bb8b-eb222b2313f5",
            "name": "BRUNNER Thomas",
            "phone": "+41891712795",
            "email": null,
            "unitNumber": "0002",
            "unitId": "demo-unit-0002",
            "moveInDate": "2021-09-01T00:00:00.000Z",
            "source": "BOTH"
          },
          {
            "tenantId": "aca5bfc1-3b6f-4fb8-a93a-5efd29d98d41",
            "name": "DA SILVA Marco",
            "phone": "+41563497841",
            "email": null,
            "unitNumber": "0003",
            "unitId": "demo-unit-0003",
            "moveInDate": "2016-07-15T00:00:00.000Z",
            "source": "BOTH"
          },
          {
            "tenantId": "4c0820a2-5998-42db-8178-f0be43d27bc7",
            "name": "KELLER Andrea",
            "phone": "+41896705063",
            "email": null,
            "unitNumber": "0004",
            "unitId": "demo-unit-0004",
            "moveInDate": "2020-02-01T00:00:00.000Z",
            "source": "BOTH"
          },
          {
            "tenantId": "e06774f8-6c19-4980-a4c0-4f852065640d",
            "name": "NGUYEN Thi Lan",
            "phone": "+41212117483",
            "email": null,
            "unitNumber": "0005",
            "unitId": "demo-unit-0005",
            "moveInDate": "2019-11-01T00:00:00.000Z",
            "source": "BOTH"
          },
          {
            "tenantId": "10da3f2f-55dc-45c8-b767-fcdc822c4972",
            "name": "ROSSI Giulia",
            "phone": "+41656803302",
            "email": null,
            "unitNumber": "0006",
            "unitId": "demo-unit-0006",
            "moveInDate": "2023-06-01T00:00:00.000Z",
            "source": "BOTH"
          },
          {
            "tenantId": "92489514-3d25-4d8a-ae3b-cfc93a1557e3",
            "name": "FAVRE Olivier",
            "phone": "+41178647985",
            "email": null,
            "unitNumber": "0007",
            "unitId": "demo-unit-0007",
            "moveInDate": "2017-03-01T00:00:00.000Z",
            "source": "BOTH"
          },
          {
            "tenantId": "236f06b6-15c9-4c30-a803-101f1731b50a",
            "name": "MARCHAND Sylvie",
            "phone": "+41964780911",
            "email": null,
            "unitNumber": "9001",
            "unitId": "demo-unit-9001",
            "moveInDate": "2018-04-01T00:00:00.000Z",
            "source": "BOTH"
          },
          {
            "tenantId": "aca5bfc1-3b6f-4fb8-a93a-5efd29d98d41",
            "name": "DA SILVA Marco",
            "phone": "+41563497841",
            "email": null,
            "unitNumber": "9002",
            "unitId": "demo-unit-9002",
            "moveInDate": "2016-07-15T00:00:00.000Z",
            "source": "BOTH"
          },
          {
            "tenantId": "e06774f8-6c19-4980-a4c0-4f852065640d",
            "name": "NGUYEN Thi Lan",
            "phone": "+41212117483",
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
          "createdAt": "2026-09-08T12:57:01.748Z",
          "updatedAt": "2026-09-08T12:58:49.896Z",
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
          "createdAt": "2026-09-08T12:57:01.783Z",
          "updatedAt": "2026-09-08T12:58:49.898Z",
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
          "createdAt": "2026-09-08T12:57:01.813Z",
          "updatedAt": "2026-09-08T12:58:49.899Z",
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
          "createdAt": "2026-09-08T12:57:01.853Z",
          "updatedAt": "2026-09-08T12:58:49.900Z",
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
          "createdAt": "2026-09-08T12:57:01.867Z",
          "updatedAt": "2026-09-08T12:58:49.901Z",
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
          "createdAt": "2026-09-08T12:57:01.882Z",
          "updatedAt": "2026-09-08T12:58:49.902Z",
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
          "createdAt": "2026-09-08T12:57:01.912Z",
          "updatedAt": "2026-09-08T12:58:49.903Z",
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
          "createdAt": "2026-09-08T12:57:01.923Z",
          "updatedAt": "2026-09-08T12:58:49.904Z",
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
          "createdAt": "2026-09-08T12:57:01.951Z",
          "updatedAt": "2026-09-08T12:58:49.904Z",
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
          "createdAt": "2026-09-08T12:57:01.965Z",
          "updatedAt": "2026-09-08T12:58:49.906Z",
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
          "createdAt": "2026-09-08T12:57:01.976Z",
          "updatedAt": "2026-09-08T12:58:49.906Z",
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
          "createdAt": "2026-09-08T12:57:01.983Z",
          "updatedAt": "2026-09-08T12:58:49.907Z",
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
              "accountId": "34005f70-403b-4beb-a9c6-a1ab0fd5f828",
              "accountName": "Chauffage et eau chaude",
              "accountCode": "60100",
              "totalCents": 1935000,
              "category": "RECOVERABLE"
            },
            {
              "accountId": "fe2e4a4c-211c-4cfb-8c93-3cfa3d879280",
              "accountName": "Conciergerie et nettoyage",
              "accountCode": "61100",
              "totalCents": 1440000,
              "category": "RECOVERABLE"
            },
            {
              "accountId": "fbc4851f-4b63-4db9-8d07-4692770f55ad",
              "accountName": "Honoraires de gérance",
              "accountCode": "63100",
              "totalCents": 1148000,
              "category": "OWNER_OPEX"
            },
            {
              "accountId": "94e141bc-b96d-476c-8761-8d89cf7116c3",
              "accountName": "Entretien des appartements",
              "accountCode": "61200",
              "totalCents": 704000,
              "category": "OWNER_OPEX"
            },
            {
              "accountId": "1f843b34-84e8-4bf4-9ccd-0c1e4e6ffd6b",
              "accountName": "Assurances immeuble",
              "accountCode": "62100",
              "totalCents": 542000,
              "category": "OWNER_OPEX"
            },
            {
              "accountId": "335c23d4-b720-4690-afc1-4dd45a086a04",
              "accountName": "Entretien parties communes",
              "accountCode": "61300",
              "totalCents": 538000,
              "category": "OWNER_OPEX"
            },
            {
              "accountId": "2878857f-c35b-4bad-a5f2-ee38885c32b8",
              "accountName": "Eau et épuration",
              "accountCode": "60200",
              "totalCents": 535000,
              "category": "RECOVERABLE"
            },
            {
              "accountId": "ae14b263-1597-4000-80b7-b32ebd430fbc",
              "accountName": "Impôts et taxes",
              "accountCode": "64100",
              "totalCents": 324000,
              "category": "OWNER_OPEX"
            },
            {
              "accountId": "9e36378c-864b-4cdc-87f9-82b4d985dd16",
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
              "accountId": "34005f70-403b-4beb-a9c6-a1ab0fd5f828",
              "accountName": "Chauffage et eau chaude",
              "accountCode": "60100",
              "totalCents": 1929713,
              "category": "RECOVERABLE"
            },
            {
              "accountId": "fe2e4a4c-211c-4cfb-8c93-3cfa3d879280",
              "accountName": "Conciergerie et nettoyage",
              "accountCode": "61100",
              "totalCents": 1436066,
              "category": "RECOVERABLE"
            },
            {
              "accountId": "fbc4851f-4b63-4db9-8d07-4692770f55ad",
              "accountName": "Honoraires de gérance",
              "accountCode": "63100",
              "totalCents": 1144863,
              "category": "OWNER_OPEX"
            },
            {
              "accountId": "94e141bc-b96d-476c-8761-8d89cf7116c3",
              "accountName": "Entretien des appartements",
              "accountCode": "61200",
              "totalCents": 702077,
              "category": "OWNER_OPEX"
            },
            {
              "accountId": "1f843b34-84e8-4bf4-9ccd-0c1e4e6ffd6b",
              "accountName": "Assurances immeuble",
              "accountCode": "62100",
              "totalCents": 540519,
              "category": "OWNER_OPEX"
            },
            {
              "accountId": "335c23d4-b720-4690-afc1-4dd45a086a04",
              "accountName": "Entretien parties communes",
              "accountCode": "61300",
              "totalCents": 536530,
              "category": "OWNER_OPEX"
            },
            {
              "accountId": "2878857f-c35b-4bad-a5f2-ee38885c32b8",
              "accountName": "Eau et épuration",
              "accountCode": "60200",
              "totalCents": 533538,
              "category": "RECOVERABLE"
            },
            {
              "accountId": "ae14b263-1597-4000-80b7-b32ebd430fbc",
              "accountName": "Impôts et taxes",
              "accountCode": "64100",
              "totalCents": 323115,
              "category": "OWNER_OPEX"
            },
            {
              "accountId": "9e36378c-864b-4cdc-87f9-82b4d985dd16",
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
            "id": "b089cd45-f5fa-4db4-ac71-403514729e47",
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
          "contractorId": "9b3800bf-01bd-483e-ba79-1f21b1b54aae",
          "vendorName": "SIG Genève",
          "totalCents": 2640000,
          "invoiceCount": 8
        },
        {
          "contractorId": "5085e545-3ed6-4475-9972-cce47c6dc055",
          "vendorName": "Net & Clair Sàrl",
          "totalCents": 1440000,
          "invoiceCount": 4
        },
        {
          "contractorId": "03b6d15a-e272-4c45-b509-c37c62b20f58",
          "vendorName": "Régie Léman SA",
          "totalCents": 1148000,
          "invoiceCount": 4
        },
        {
          "contractorId": "5eea126b-2686-4bb7-b4b9-39c93e2a6c3c",
          "vendorName": "Bâloise Assurances",
          "totalCents": 542000,
          "invoiceCount": 1
        },
        {
          "contractorId": "16b14a6f-87ea-4d80-9343-a5079233e44a",
          "vendorName": "Peinture Dubois",
          "totalCents": 425000,
          "invoiceCount": 1
        },
        {
          "contractorId": "a4d7a568-e389-4d37-b84b-f4c15de5de13",
          "vendorName": "État de Genève",
          "totalCents": 324000,
          "invoiceCount": 1
        },
        {
          "contractorId": "04e08544-436e-4ba9-9cef-bbce10af484f",
          "vendorName": "Ascenseurs Schindler",
          "totalCents": 298000,
          "invoiceCount": 1
        },
        {
          "contractorId": "4f2c9a9c-1273-46ff-baca-e778d0aac88e",
          "vendorName": "Jardins du Léman",
          "totalCents": 164000,
          "invoiceCount": 1
        },
        {
          "contractorId": "8774c04f-e01f-4112-bea5-0b050cf7be81",
          "vendorName": "Vitrerie Genevoise",
          "totalCents": 118000,
          "invoiceCount": 1
        },
        {
          "contractorId": "2a163ec2-16b5-4e86-a9f5-84ee021b2266",
          "vendorName": "Sanitaires Perret SA",
          "totalCents": 107000,
          "invoiceCount": 2
        },
        {
          "contractorId": "122f5569-d8df-4c87-b7e4-b15bf1c82f44",
          "vendorName": "Électricité Moret",
          "totalCents": 76000,
          "invoiceCount": 1
        },
        {
          "contractorId": "0d9f86fa-6949-424b-931d-b5954251b2f7",
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
          "assetId": "b69ee2a2-213e-4b22-b601-ab857ec7c1d6",
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
          "assetId": "810ba743-1a27-48fe-b326-33183f74754b",
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
          "assetId": "a0345d17-a405-4bab-a0e9-117c91256a37",
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
          "lastConditionStatus": null,
          "lastConditionAt": null,
          "lastConditionReportType": null,
          "lastConditionValidated": false,
          "currentLease": null,
          "unitId": "demo-unit-0008",
          "unitNumber": "0008"
        },
        {
          "assetId": "aa1e5f48-3995-4414-905f-eafe6207ea12",
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
          "assetId": "40a31223-d8f1-41a2-964d-853c62365f4c",
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
          "assetId": "8c0c1cd8-d2a9-4370-8f2e-4715f2461451",
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
          "assetId": "b2487276-dd27-46e9-a9f8-5d6a0171ae2d",
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
          "assetId": "b7a27822-5660-4d4a-aebc-4e54c1970386",
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
          "assetId": "63a9b2bb-ec4f-4b71-9538-e606b7f80070",
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
          "assetId": "1dff6cb4-1f36-49d0-a049-79d32dd344eb",
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
          "assetId": "760e2773-ab88-408a-a0a2-b9b271c9b84d",
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
          "assetId": "6004c6f3-e2f1-4ead-b1be-4e6fc91521bb",
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
          "assetId": "f6a01996-4f9c-46a7-86ac-cc5b19fc88b9",
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
          "assetId": "38f106c6-440d-4799-bffa-00c2daeae3e6",
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
          "assetId": "9154bb61-a9ee-477a-9db4-87697de4b73d",
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
          "assetId": "70eff972-0eb2-468e-85b2-97c17f1bad8f",
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
          "assetId": "972ca36a-ea0d-4212-9f63-ff32556cac0d",
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
          "assetId": "ad578c8d-179f-437a-84ce-d9dd16a55b03",
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
          "assetId": "929f5bc8-9e3e-4bed-a3ba-9e267296e0e9",
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
          "assetId": "10e11f5d-059b-44f0-b3bc-1ed7b1137c33",
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
          "assetId": "91fbe53c-072e-4846-a315-dc430ab0b0a7",
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
          "assetId": "055418f0-43c5-481d-9225-aba3bd6babc9",
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
          "assetId": "226e8a03-9daa-4560-802c-ff48b1d3eed7",
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
          "assetId": "85ff6500-271b-414f-a194-d71ba536c327",
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
          "assetId": "8af96294-0bc0-43d7-9768-c1952c0ecda6",
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
          "assetId": "8512137c-9252-46b1-af45-4769b43114e0",
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
          "assetId": "506eaef0-8daa-4ed6-8d40-f83820bac2bf",
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
          "assetId": "3a33e13f-367b-4a81-8808-260b8607f4b5",
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
          "assetId": "76504672-e5fe-434a-a9e8-502fdab4da87",
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
          "assetId": "12e4dd99-34f9-461c-bd3c-b02c6a10a760",
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
          "assetId": "255e76a2-3782-4021-bb89-d96b92fe067b",
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
          "assetId": "e1b21693-e749-4c67-850d-1aa24a1ec5ab",
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
          "assetId": "309b679c-1e65-43b0-b0cf-ec1d9f1a8f3c",
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
          "assetId": "fde3d1f3-8cf0-429e-a126-4769e3aabd83",
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
          "assetId": "c86bd441-9757-4625-98f9-b6506982c547",
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
          "assetId": "36ae25f1-e8a1-4b0a-bd60-aebd88e65167",
          "assetName": "Kitchen cabinets (chipboard)",
          "applianceName": "Kitchen cabinets (chipboard)",
          "assetType": "FIXTURE",
          "topic": "KITCHEN_CABINET_CHIPBOARD",
          "installedAt": "2014-09-08T00:00:00.000Z",
          "ageMonths": 144,
          "usefulLifeMonths": 180,
          "depreciationPct": 80,
          "residualPct": 20,
          "remainingLifeMonths": 36,
          "cumulativeRepairCostChf": 0,
          "estimatedReplacementCostChf": 4500,
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
            "tenantName": "ROSSI Giulia",
            "netRentChf": 1648,
            "endDate": null,
            "remainingMonths": null
          },
          "unitId": "demo-unit-0006",
          "unitNumber": "0006"
        },
        {
          "assetId": "11866cc2-d29a-4175-8b0d-5e60f1c5f64a",
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
          "assetId": "c75ab1a7-afb4-43b8-a082-9a5f3e4e2440",
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
          "assetId": "5a2c90fa-661f-4af6-aec3-7f31e9003b48",
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
          "assetId": "8adb5bf1-0108-4800-baf2-21319f55b8f6",
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
          "assetId": "12bf1e5b-d6d4-423b-b295-851ed9ac5509",
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
          "assetId": "61b4b99a-503c-483f-9b92-030bca5c7c3e",
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
          "assetId": "04469e50-2abf-4b7b-ac10-eeb4633a14ce",
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
          "assetId": "4fc308c1-87b5-403b-9c01-04aae843ac12",
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
          "assetId": "07a85932-f5dc-4dae-8ee3-178169da0058",
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
          "assetId": "ffa81f1d-937f-4fd8-b1e4-f3507883d1b6",
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
          "currentLease": null,
          "unitId": "demo-unit-0008",
          "unitNumber": "0008"
        },
        {
          "assetId": "56be3dfa-c953-4ff4-9e17-d54520df9a4f",
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
          "assetId": "97af7310-942f-4e83-9e87-40ecd9b0166f",
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
          "assetId": "1c947ca6-4c0b-4aab-94db-ee298555c5d9",
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
          "assetId": "bca9bcb5-5ac6-4455-b37b-d47c4c564de7",
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
          "assetId": "873afa78-0b19-4d30-be5b-c3bf599135ee",
          "assetName": "Sanitary ceramics (WC/basin)",
          "applianceName": "Sanitary ceramics (WC/basin)",
          "assetType": "FIXTURE",
          "topic": "SANITARY_CERAMIC",
          "installedAt": "2000-10-08T00:00:00.000Z",
          "ageMonths": 311,
          "usefulLifeMonths": 420,
          "depreciationPct": 74,
          "residualPct": 26,
          "remainingLifeMonths": 109,
          "cumulativeRepairCostChf": 0,
          "estimatedReplacementCostChf": 1200,
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
            "tenantName": "ROSSI Giulia",
            "netRentChf": 1648,
            "endDate": null,
            "remainingMonths": null
          },
          "unitId": "demo-unit-0006",
          "unitNumber": "0006"
        },
        {
          "assetId": "7ab49bfd-389a-40dd-b1d0-60e259d52c50",
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
          "assetId": "51547374-27b8-4836-929a-15fc1f3bf5fc",
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
          "assetId": "39104edb-59ff-4e29-a920-3dbcd12931b6",
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
          "assetId": "906b22fb-ca51-4603-9ab0-7aa09e759957",
          "assetName": "Sanitary ceramics (WC/basin)",
          "applianceName": "Sanitary ceramics (WC/basin)",
          "assetType": "FIXTURE",
          "topic": "SANITARY_CERAMIC",
          "installedAt": "2000-10-08T00:00:00.000Z",
          "ageMonths": 311,
          "usefulLifeMonths": 420,
          "depreciationPct": 74,
          "residualPct": 26,
          "remainingLifeMonths": 109,
          "cumulativeRepairCostChf": 0,
          "estimatedReplacementCostChf": 1200,
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
                "assetId": "b69ee2a2-213e-4b22-b601-ab857ec7c1d6",
                "unitId": "demo-unit-0003",
                "label": "Insulated windows (PVC/wood) — 0003",
                "costChf": 1100,
                "annualUpliftChf": 22,
                "deltaValueChf": 715,
                "marginalYieldPct": 3.08,
                "accretive": true
              },
              {
                "assetId": "810ba743-1a27-48fe-b326-33183f74754b",
                "unitId": "demo-unit-0005",
                "label": "Parquet flooring (mosaic) — 0005",
                "costChf": 3500,
                "annualUpliftChf": 43.75,
                "deltaValueChf": 2275,
                "marginalYieldPct": 1.92,
                "accretive": false
              },
              {
                "assetId": "a0345d17-a405-4bab-a0e9-117c91256a37",
                "unitId": "demo-unit-0008",
                "label": "Kitchen cabinets (chipboard) — 0008",
                "costChf": 4500,
                "annualUpliftChf": 150,
                "deltaValueChf": 2925,
                "marginalYieldPct": 5.13,
                "accretive": true
              },
              {
                "assetId": "aa1e5f48-3995-4414-905f-eafe6207ea12",
                "unitId": "demo-unit-0003",
                "label": "Kitchen cabinets (chipboard) — 0003",
                "costChf": 4500,
                "annualUpliftChf": 150,
                "deltaValueChf": 2925,
                "marginalYieldPct": 5.13,
                "accretive": true
              },
              {
                "assetId": "40a31223-d8f1-41a2-964d-853c62365f4c",
                "unitId": "demo-unit-0006",
                "label": "Interior doors (chipboard) — 0006",
                "costChf": 450,
                "annualUpliftChf": 9,
                "deltaValueChf": 292.5,
                "marginalYieldPct": 3.08,
                "accretive": true
              },
              {
                "assetId": "8c0c1cd8-d2a9-4370-8f2e-4715f2461451",
                "unitId": "demo-unit-0006",
                "label": "Roller shutters (plastic) — 0006",
                "costChf": 550,
                "annualUpliftChf": 13.75,
                "deltaValueChf": 357.5,
                "marginalYieldPct": 3.85,
                "accretive": true
              },
              {
                "assetId": "b2487276-dd27-46e9-a9f8-5d6a0171ae2d",
                "unitId": "demo-unit-0006",
                "label": "Wall paint (dispersion) — 0006",
                "costChf": 2200,
                "annualUpliftChf": 137.5,
                "deltaValueChf": 1430,
                "marginalYieldPct": 9.62,
                "accretive": true
              },
              {
                "assetId": "b7a27822-5660-4d4a-aebc-4e54c1970386",
                "unitId": "demo-unit-0008",
                "label": "Power sockets — 0008",
                "costChf": 130,
                "annualUpliftChf": 4.33,
                "deltaValueChf": 84.5,
                "marginalYieldPct": 5.13,
                "accretive": true
              },
              {
                "assetId": "63a9b2bb-ec4f-4b71-9538-e606b7f80070",
                "unitId": "demo-unit-0001",
                "label": "Kitchen tap — 0001",
                "costChf": 400,
                "annualUpliftChf": 10,
                "deltaValueChf": 260,
                "marginalYieldPct": 3.85,
                "accretive": true
              },
              {
                "assetId": "1dff6cb4-1f36-49d0-a049-79d32dd344eb",
                "unitId": "demo-unit-0002",
                "label": "Power sockets — 0002",
                "costChf": 130,
                "annualUpliftChf": 4.33,
                "deltaValueChf": 84.5,
                "marginalYieldPct": 5.13,
                "accretive": true
              },
              {
                "assetId": "760e2773-ab88-408a-a0a2-b9b271c9b84d",
                "unitId": "demo-unit-0005",
                "label": "Bathroom tap — 0005",
                "costChf": 400,
                "annualUpliftChf": 10,
                "deltaValueChf": 260,
                "marginalYieldPct": 3.85,
                "accretive": true
              },
              {
                "assetId": "6004c6f3-e2f1-4ead-b1be-4e6fc91521bb",
                "unitId": "demo-unit-0002",
                "label": "Kitchen worktop (synthetic) — 0002",
                "costChf": 1200,
                "annualUpliftChf": 40,
                "deltaValueChf": 780,
                "marginalYieldPct": 5.13,
                "accretive": true
              },
              {
                "assetId": "f6a01996-4f9c-46a7-86ac-cc5b19fc88b9",
                "unitId": "demo-unit-0003",
                "label": "Bathroom tap — 0003",
                "costChf": 400,
                "annualUpliftChf": 10,
                "deltaValueChf": 260,
                "marginalYieldPct": 3.85,
                "accretive": true
              },
              {
                "assetId": "38f106c6-440d-4799-bffa-00c2daeae3e6",
                "unitId": "demo-unit-0004",
                "label": "Roller shutters (plastic) — 0004",
                "costChf": 550,
                "annualUpliftChf": 13.75,
                "deltaValueChf": 357.5,
                "marginalYieldPct": 3.85,
                "accretive": true
              },
              {
                "assetId": "9154bb61-a9ee-477a-9db4-87697de4b73d",
                "unitId": "demo-unit-0004",
                "label": "Wall paint (dispersion) — 0004",
                "costChf": 2200,
                "annualUpliftChf": 137.5,
                "deltaValueChf": 1430,
                "marginalYieldPct": 9.62,
                "accretive": true
              },
              {
                "assetId": "70eff972-0eb2-468e-85b2-97c17f1bad8f",
                "unitId": "demo-unit-0005",
                "label": "Light switches — 0005",
                "costChf": 70,
                "annualUpliftChf": 2.33,
                "deltaValueChf": 45.5,
                "marginalYieldPct": 5.13,
                "accretive": true
              },
              {
                "assetId": "972ca36a-ea0d-4212-9f63-ff32556cac0d",
                "unitId": "demo-unit-0007",
                "label": "Sanitary ceramics (WC/basin) — 0007",
                "costChf": 1200,
                "annualUpliftChf": 17.14,
                "deltaValueChf": 780,
                "marginalYieldPct": 2.2,
                "accretive": false
              },
              {
                "assetId": "ad578c8d-179f-437a-84ce-d9dd16a55b03",
                "unitId": "demo-unit-0008",
                "label": "Balcony railing (metal) — 0008",
                "costChf": 800,
                "annualUpliftChf": 13.33,
                "deltaValueChf": 520,
                "marginalYieldPct": 2.56,
                "accretive": false
              },
              {
                "assetId": "929f5bc8-9e3e-4bed-a3ba-9e267296e0e9",
                "unitId": "demo-unit-0008",
                "label": "Bathroom tiles (ceramic) — 0008",
                "costChf": 2200,
                "annualUpliftChf": 36.67,
                "deltaValueChf": 1430,
                "marginalYieldPct": 2.56,
                "accretive": false
              },
              {
                "assetId": "10e11f5d-059b-44f0-b3bc-1ed7b1137c33",
                "unitId": "demo-unit-0001",
                "label": "Kitchen worktop (synthetic) — 0001",
                "costChf": 1200,
                "annualUpliftChf": 40,
                "deltaValueChf": 780,
                "marginalYieldPct": 5.13,
                "accretive": true
              },
              {
                "assetId": "91fbe53c-072e-4846-a315-dc430ab0b0a7",
                "unitId": "demo-unit-0001",
                "label": "Insulated windows (PVC/wood) — 0001",
                "costChf": 1100,
                "annualUpliftChf": 22,
                "deltaValueChf": 715,
                "marginalYieldPct": 3.08,
                "accretive": true
              },
              {
                "assetId": "055418f0-43c5-481d-9225-aba3bd6babc9",
                "unitId": "demo-unit-0002",
                "label": "Bathtub (acrylic) — 0002",
                "costChf": 900,
                "annualUpliftChf": 18,
                "deltaValueChf": 585,
                "marginalYieldPct": 3.08,
                "accretive": true
              },
              {
                "assetId": "226e8a03-9daa-4560-802c-ff48b1d3eed7",
                "unitId": "demo-unit-0003",
                "label": "Roller shutters (plastic) — 0003",
                "costChf": 550,
                "annualUpliftChf": 13.75,
                "deltaValueChf": 357.5,
                "marginalYieldPct": 3.85,
                "accretive": true
              },
              {
                "assetId": "85ff6500-271b-414f-a194-d71ba536c327",
                "unitId": "demo-unit-0003",
                "label": "Wall paint (dispersion) — 0003",
                "costChf": 2200,
                "annualUpliftChf": 137.5,
                "deltaValueChf": 1430,
                "marginalYieldPct": 9.62,
                "accretive": true
              },
              {
                "assetId": "8af96294-0bc0-43d7-9768-c1952c0ecda6",
                "unitId": "demo-unit-0003",
                "label": "Power sockets — 0003",
                "costChf": 130,
                "annualUpliftChf": 4.33,
                "deltaValueChf": 84.5,
                "marginalYieldPct": 5.13,
                "accretive": true
              },
              {
                "assetId": "8512137c-9252-46b1-af45-4769b43114e0",
                "unitId": "demo-unit-0006",
                "label": "Bathroom tap — 0006",
                "costChf": 400,
                "annualUpliftChf": 10,
                "deltaValueChf": 260,
                "marginalYieldPct": 3.85,
                "accretive": true
              },
              {
                "assetId": "506eaef0-8daa-4ed6-8d40-f83820bac2bf",
                "unitId": "demo-unit-0006",
                "label": "Bathtub (acrylic) — 0006",
                "costChf": 900,
                "annualUpliftChf": 18,
                "deltaValueChf": 585,
                "marginalYieldPct": 3.08,
                "accretive": true
              },
              {
                "assetId": "3a33e13f-367b-4a81-8808-260b8607f4b5",
                "unitId": "demo-unit-0006",
                "label": "Kitchen tap — 0006",
                "costChf": 400,
                "annualUpliftChf": 10,
                "deltaValueChf": 260,
                "marginalYieldPct": 3.85,
                "accretive": true
              },
              {
                "assetId": "76504672-e5fe-434a-a9e8-502fdab4da87",
                "unitId": "demo-unit-0006",
                "label": "Light switches — 0006",
                "costChf": 70,
                "annualUpliftChf": 2.33,
                "deltaValueChf": 45.5,
                "marginalYieldPct": 5.13,
                "accretive": true
              },
              {
                "assetId": "12e4dd99-34f9-461c-bd3c-b02c6a10a760",
                "unitId": "demo-unit-0007",
                "label": "Interior doors (chipboard) — 0007",
                "costChf": 450,
                "annualUpliftChf": 9,
                "deltaValueChf": 292.5,
                "marginalYieldPct": 3.08,
                "accretive": true
              },
              {
                "assetId": "255e76a2-3782-4021-bb89-d96b92fe067b",
                "unitId": "demo-unit-0007",
                "label": "Bathroom tiles (ceramic) — 0007",
                "costChf": 2200,
                "annualUpliftChf": 36.67,
                "deltaValueChf": 1430,
                "marginalYieldPct": 2.56,
                "accretive": false
              },
              {
                "assetId": "e1b21693-e749-4c67-850d-1aa24a1ec5ab",
                "unitId": "demo-unit-0008",
                "label": "Balcony (metal) — 0008",
                "costChf": 4500,
                "annualUpliftChf": 56.25,
                "deltaValueChf": 2925,
                "marginalYieldPct": 1.92,
                "accretive": false
              },
              {
                "assetId": "309b679c-1e65-43b0-b0cf-ec1d9f1a8f3c",
                "unitId": "demo-unit-0001",
                "label": "Kitchen tiles (ceramic) — 0001",
                "costChf": 1600,
                "annualUpliftChf": 26.67,
                "deltaValueChf": 1040,
                "marginalYieldPct": 2.56,
                "accretive": false
              },
              {
                "assetId": "fde3d1f3-8cf0-429e-a126-4769e3aabd83",
                "unitId": "demo-unit-0003",
                "label": "Balcony railing (metal) — 0003",
                "costChf": 800,
                "annualUpliftChf": 13.33,
                "deltaValueChf": 520,
                "marginalYieldPct": 2.56,
                "accretive": false
              },
              {
                "assetId": "c86bd441-9757-4625-98f9-b6506982c547",
                "unitId": "demo-unit-0003",
                "label": "Kitchen worktop (synthetic) — 0003",
                "costChf": 1200,
                "annualUpliftChf": 40,
                "deltaValueChf": 780,
                "marginalYieldPct": 5.13,
                "accretive": true
              },
              {
                "assetId": "36ae25f1-e8a1-4b0a-bd60-aebd88e65167",
                "unitId": "demo-unit-0006",
                "label": "Kitchen cabinets (chipboard) — 0006",
                "costChf": 4500,
                "annualUpliftChf": 150,
                "deltaValueChf": 2925,
                "marginalYieldPct": 5.13,
                "accretive": true
              },
              {
                "assetId": "11866cc2-d29a-4175-8b0d-5e60f1c5f64a",
                "unitId": "demo-unit-0007",
                "label": "Roller shutters (plastic) — 0007",
                "costChf": 550,
                "annualUpliftChf": 13.75,
                "deltaValueChf": 357.5,
                "marginalYieldPct": 3.85,
                "accretive": true
              },
              {
                "assetId": "c75ab1a7-afb4-43b8-a082-9a5f3e4e2440",
                "unitId": "demo-unit-0007",
                "label": "Wall paint (dispersion) — 0007",
                "costChf": 2200,
                "annualUpliftChf": 137.5,
                "deltaValueChf": 1430,
                "marginalYieldPct": 9.62,
                "accretive": true
              },
              {
                "assetId": "5a2c90fa-661f-4af6-aec3-7f31e9003b48",
                "unitId": "demo-unit-0008",
                "label": "Bathroom tap — 0008",
                "costChf": 400,
                "annualUpliftChf": 10,
                "deltaValueChf": 260,
                "marginalYieldPct": 3.85,
                "accretive": true
              },
              {
                "assetId": "8adb5bf1-0108-4800-baf2-21319f55b8f6",
                "unitId": "demo-unit-0001",
                "label": "Balcony (metal) — 0001",
                "costChf": 4500,
                "annualUpliftChf": 56.25,
                "deltaValueChf": 2925,
                "marginalYieldPct": 1.92,
                "accretive": false
              },
              {
                "assetId": "12bf1e5b-d6d4-423b-b295-851ed9ac5509",
                "unitId": "demo-unit-0002",
                "label": "Parquet flooring (mosaic) — 0002",
                "costChf": 3500,
                "annualUpliftChf": 43.75,
                "deltaValueChf": 2275,
                "marginalYieldPct": 1.92,
                "accretive": false
              },
              {
                "assetId": "61b4b99a-503c-483f-9b92-030bca5c7c3e",
                "unitId": "demo-unit-0004",
                "label": "Balcony railing (metal) — 0004",
                "costChf": 800,
                "annualUpliftChf": 13.33,
                "deltaValueChf": 520,
                "marginalYieldPct": 2.56,
                "accretive": false
              },
              {
                "assetId": "04469e50-2abf-4b7b-ac10-eeb4633a14ce",
                "unitId": "demo-unit-0005",
                "label": "Kitchen cabinets (chipboard) — 0005",
                "costChf": 4500,
                "annualUpliftChf": 150,
                "deltaValueChf": 2925,
                "marginalYieldPct": 5.13,
                "accretive": true
              },
              {
                "assetId": "4fc308c1-87b5-403b-9c01-04aae843ac12",
                "unitId": "demo-unit-0006",
                "label": "Insulated windows (PVC/wood) — 0006",
                "costChf": 1100,
                "annualUpliftChf": 22,
                "deltaValueChf": 715,
                "marginalYieldPct": 3.08,
                "accretive": true
              },
              {
                "assetId": "07a85932-f5dc-4dae-8ee3-178169da0058",
                "unitId": "demo-unit-0007",
                "label": "Bathroom tap — 0007",
                "costChf": 400,
                "annualUpliftChf": 10,
                "deltaValueChf": 260,
                "marginalYieldPct": 3.85,
                "accretive": true
              },
              {
                "assetId": "ffa81f1d-937f-4fd8-b1e4-f3507883d1b6",
                "unitId": "demo-unit-0008",
                "label": "Parquet flooring (mosaic) — 0008",
                "costChf": 3500,
                "annualUpliftChf": 43.75,
                "deltaValueChf": 2275,
                "marginalYieldPct": 1.92,
                "accretive": false
              },
              {
                "assetId": "56be3dfa-c953-4ff4-9e17-d54520df9a4f",
                "unitId": "demo-unit-0001",
                "label": "Balcony railing (metal) — 0001",
                "costChf": 800,
                "annualUpliftChf": 13.33,
                "deltaValueChf": 520,
                "marginalYieldPct": 2.56,
                "accretive": false
              },
              {
                "assetId": "97af7310-942f-4e83-9e87-40ecd9b0166f",
                "unitId": "demo-unit-0004",
                "label": "Bathtub (acrylic) — 0004",
                "costChf": 900,
                "annualUpliftChf": 18,
                "deltaValueChf": 585,
                "marginalYieldPct": 3.08,
                "accretive": true
              },
              {
                "assetId": "1c947ca6-4c0b-4aab-94db-ee298555c5d9",
                "unitId": "demo-unit-0004",
                "label": "Kitchen tap — 0004",
                "costChf": 400,
                "annualUpliftChf": 10,
                "deltaValueChf": 260,
                "marginalYieldPct": 3.85,
                "accretive": true
              },
              {
                "assetId": "bca9bcb5-5ac6-4455-b37b-d47c4c564de7",
                "unitId": "demo-unit-0005",
                "label": "Kitchen tiles (ceramic) — 0005",
                "costChf": 1600,
                "annualUpliftChf": 26.67,
                "deltaValueChf": 1040,
                "marginalYieldPct": 2.56,
                "accretive": false
              },
              {
                "assetId": "873afa78-0b19-4d30-be5b-c3bf599135ee",
                "unitId": "demo-unit-0006",
                "label": "Sanitary ceramics (WC/basin) — 0006",
                "costChf": 1200,
                "annualUpliftChf": 17.14,
                "deltaValueChf": 780,
                "marginalYieldPct": 2.2,
                "accretive": false
              },
              {
                "assetId": "7ab49bfd-389a-40dd-b1d0-60e259d52c50",
                "unitId": "demo-unit-0007",
                "label": "Insulated windows (PVC/wood) — 0007",
                "costChf": 1100,
                "annualUpliftChf": 22,
                "deltaValueChf": 715,
                "marginalYieldPct": 3.08,
                "accretive": true
              },
              {
                "assetId": "51547374-27b8-4836-929a-15fc1f3bf5fc",
                "unitId": "demo-unit-0007",
                "label": "Power sockets — 0007",
                "costChf": 130,
                "annualUpliftChf": 4.33,
                "deltaValueChf": 84.5,
                "marginalYieldPct": 5.13,
                "accretive": true
              },
              {
                "assetId": "39104edb-59ff-4e29-a920-3dbcd12931b6",
                "unitId": "demo-unit-0008",
                "label": "Kitchen tap — 0008",
                "costChf": 400,
                "annualUpliftChf": 10,
                "deltaValueChf": 260,
                "marginalYieldPct": 3.85,
                "accretive": true
              },
              {
                "assetId": "906b22fb-ca51-4603-9ab0-7aa09e759957",
                "unitId": "demo-unit-0008",
                "label": "Sanitary ceramics (WC/basin) — 0008",
                "costChf": 1200,
                "annualUpliftChf": 17.14,
                "deltaValueChf": 780,
                "marginalYieldPct": 2.2,
                "accretive": false
              }
            ],
            "accretiveCount": 39,
            "ceilingYieldPct": 2.59,
            "feasible": false,
            "offStrategy": false,
            "capexChf": 44860,
            "annualUpliftChf": 1596.98,
            "deltaValueChf": 29159
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
          "lastComputedAt": "2026-09-08T12:57:16.742Z",
          "discountRatePct": 4,
          "capRatePct": 4.5,
          "deferYears": 3,
          "propertyValueChf": 6450000,
          "lastVerdictScenario": "invest",
          "lastVerdictAt": "2026-09-08T12:57:17.664Z",
          "createdAt": "2026-09-08T12:57:03.630Z",
          "updatedAt": "2026-09-08T12:57:17.666Z",
          "building": {
            "id": "demo-building",
            "name": "Résidence des Charmilles",
            "canton": null
          },
          "overrides": [
            {
              "id": "1d4acfc6-3bed-4113-b8f7-370b6c4aef0d",
              "planId": "demo-plan",
              "assetId": "810ba743-1a27-48fe-b326-33183f74754b",
              "originalYear": 2026,
              "overriddenYear": 2026,
              "costChf": 9500,
              "rentUpliftChfPerMonth": 40,
              "riskAvoidedChfPerYear": 900,
              "vacancyDays": 0,
              "oblfPassthroughPct": 60,
              "createdAt": "2026-09-08T12:57:03.630Z",
              "asset": {
                "id": "810ba743-1a27-48fe-b326-33183f74754b",
                "name": "Parquet flooring (mosaic)",
                "type": "FINISH",
                "topic": "PARQUET_MOSAIC",
                "unitId": "demo-unit-0005"
              }
            },
            {
              "id": "c205f553-6b01-4cf5-82f9-1e04732832c7",
              "planId": "demo-plan",
              "assetId": "b69ee2a2-213e-4b22-b601-ab857ec7c1d6",
              "originalYear": 2026,
              "overriddenYear": 2027,
              "costChf": 9500,
              "rentUpliftChfPerMonth": 40,
              "riskAvoidedChfPerYear": 900,
              "vacancyDays": 0,
              "oblfPassthroughPct": 60,
              "createdAt": "2026-09-08T12:57:03.630Z",
              "asset": {
                "id": "b69ee2a2-213e-4b22-b601-ab857ec7c1d6",
                "name": "Insulated windows (PVC/wood)",
                "type": "FIXTURE",
                "topic": "WINDOW_INSULATED_PLASTIC_WOOD",
                "unitId": "demo-unit-0003"
              }
            },
            {
              "id": "0ef18b5a-54e3-4997-9f58-107f881de8ad",
              "planId": "demo-plan",
              "assetId": "a0345d17-a405-4bab-a0e9-117c91256a37",
              "originalYear": 2026,
              "overriddenYear": 2028,
              "costChf": 24000,
              "rentUpliftChfPerMonth": 95,
              "riskAvoidedChfPerYear": 900,
              "vacancyDays": 21,
              "oblfPassthroughPct": 60,
              "createdAt": "2026-09-08T12:57:03.630Z",
              "asset": {
                "id": "a0345d17-a405-4bab-a0e9-117c91256a37",
                "name": "Kitchen cabinets (chipboard)",
                "type": "FIXTURE",
                "topic": "KITCHEN_CABINET_CHIPBOARD",
                "unitId": "demo-unit-0008"
              }
            },
            {
              "id": "865c6c5a-cf74-4246-8adb-4849c8fc6b7f",
              "planId": "demo-plan",
              "assetId": "6556fbb3-0f9e-41e8-a847-094c67aafe9b",
              "originalYear": 2026,
              "overriddenYear": 2026,
              "costChf": 78000,
              "rentUpliftChfPerMonth": 0,
              "riskAvoidedChfPerYear": 6500,
              "vacancyDays": 0,
              "oblfPassthroughPct": 60,
              "createdAt": "2026-09-08T12:57:03.630Z",
              "asset": {
                "id": "6556fbb3-0f9e-41e8-a847-094c67aafe9b",
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
        "lastComputedAt": "2026-09-08T12:57:16.742Z",
        "discountRatePct": 4,
        "capRatePct": 4.5,
        "deferYears": 3,
        "propertyValueChf": 6450000,
        "lastVerdictScenario": "invest",
        "lastVerdictAt": "2026-09-08T12:57:17.664Z",
        "createdAt": "2026-09-08T12:57:03.630Z",
        "updatedAt": "2026-09-08T12:57:17.666Z",
        "building": {
          "id": "demo-building",
          "name": "Résidence des Charmilles",
          "canton": null
        },
        "overrides": [
          {
            "id": "1d4acfc6-3bed-4113-b8f7-370b6c4aef0d",
            "planId": "demo-plan",
            "assetId": "810ba743-1a27-48fe-b326-33183f74754b",
            "originalYear": 2026,
            "overriddenYear": 2026,
            "costChf": 9500,
            "rentUpliftChfPerMonth": 40,
            "riskAvoidedChfPerYear": 900,
            "vacancyDays": 0,
            "oblfPassthroughPct": 60,
            "createdAt": "2026-09-08T12:57:03.630Z",
            "asset": {
              "id": "810ba743-1a27-48fe-b326-33183f74754b",
              "name": "Parquet flooring (mosaic)",
              "type": "FINISH",
              "topic": "PARQUET_MOSAIC",
              "unitId": "demo-unit-0005"
            }
          },
          {
            "id": "c205f553-6b01-4cf5-82f9-1e04732832c7",
            "planId": "demo-plan",
            "assetId": "b69ee2a2-213e-4b22-b601-ab857ec7c1d6",
            "originalYear": 2026,
            "overriddenYear": 2027,
            "costChf": 9500,
            "rentUpliftChfPerMonth": 40,
            "riskAvoidedChfPerYear": 900,
            "vacancyDays": 0,
            "oblfPassthroughPct": 60,
            "createdAt": "2026-09-08T12:57:03.630Z",
            "asset": {
              "id": "b69ee2a2-213e-4b22-b601-ab857ec7c1d6",
              "name": "Insulated windows (PVC/wood)",
              "type": "FIXTURE",
              "topic": "WINDOW_INSULATED_PLASTIC_WOOD",
              "unitId": "demo-unit-0003"
            }
          },
          {
            "id": "0ef18b5a-54e3-4997-9f58-107f881de8ad",
            "planId": "demo-plan",
            "assetId": "a0345d17-a405-4bab-a0e9-117c91256a37",
            "originalYear": 2026,
            "overriddenYear": 2028,
            "costChf": 24000,
            "rentUpliftChfPerMonth": 95,
            "riskAvoidedChfPerYear": 900,
            "vacancyDays": 21,
            "oblfPassthroughPct": 60,
            "createdAt": "2026-09-08T12:57:03.630Z",
            "asset": {
              "id": "a0345d17-a405-4bab-a0e9-117c91256a37",
              "name": "Kitchen cabinets (chipboard)",
              "type": "FIXTURE",
              "topic": "KITCHEN_CABINET_CHIPBOARD",
              "unitId": "demo-unit-0008"
            }
          },
          {
            "id": "865c6c5a-cf74-4246-8adb-4849c8fc6b7f",
            "planId": "demo-plan",
            "assetId": "6556fbb3-0f9e-41e8-a847-094c67aafe9b",
            "originalYear": 2026,
            "overriddenYear": 2026,
            "costChf": 78000,
            "rentUpliftChfPerMonth": 0,
            "riskAvoidedChfPerYear": 6500,
            "vacancyDays": 0,
            "oblfPassthroughPct": 60,
            "createdAt": "2026-09-08T12:57:03.630Z",
            "asset": {
              "id": "6556fbb3-0f9e-41e8-a847-094c67aafe9b",
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
                  "assetId": "810ba743-1a27-48fe-b326-33183f74754b",
                  "assetName": "Parquet flooring (mosaic)",
                  "estimatedCostCents": 350000,
                  "isOverridden": true,
                  "tradeGroup": "HVAC / electrical",
                  "bundleId": "2026-2027"
                },
                {
                  "assetId": "6556fbb3-0f9e-41e8-a847-094c67aafe9b",
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
                  "assetId": "b69ee2a2-213e-4b22-b601-ab857ec7c1d6",
                  "assetName": "Insulated windows (PVC/wood)",
                  "estimatedCostCents": 110000,
                  "isOverridden": true,
                  "tradeGroup": "HVAC / electrical",
                  "bundleId": "2026-2027"
                },
                {
                  "assetId": "b2487276-dd27-46e9-a9f8-5d6a0171ae2d",
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
                  "assetId": "a0345d17-a405-4bab-a0e9-117c91256a37",
                  "assetName": "Kitchen cabinets (chipboard)",
                  "estimatedCostCents": 450000,
                  "isOverridden": true,
                  "tradeGroup": "HVAC / electrical",
                  "bundleId": "2026-2027"
                },
                {
                  "assetId": "aa1e5f48-3995-4414-905f-eafe6207ea12",
                  "assetName": "Kitchen cabinets (chipboard)",
                  "estimatedCostCents": 450000,
                  "isOverridden": false,
                  "tradeGroup": "Appliance technician",
                  "bundleId": "2028-2029"
                },
                {
                  "assetId": "8c0c1cd8-d2a9-4370-8f2e-4715f2461451",
                  "assetName": "Roller shutters (plastic)",
                  "estimatedCostCents": 55000,
                  "isOverridden": false,
                  "tradeGroup": "Appliance technician",
                  "bundleId": "2028-2029"
                },
                {
                  "assetId": "85ff6500-271b-414f-a194-d71ba536c327",
                  "assetName": "Wall paint (dispersion)",
                  "estimatedCostCents": 220000,
                  "isOverridden": false,
                  "tradeGroup": "Appliance technician",
                  "bundleId": "2028-2029"
                },
                {
                  "assetId": "9154bb61-a9ee-477a-9db4-87697de4b73d",
                  "assetName": "Wall paint (dispersion)",
                  "estimatedCostCents": 220000,
                  "isOverridden": false,
                  "tradeGroup": "Appliance technician",
                  "bundleId": "2028-2029"
                },
                {
                  "assetId": "c75ab1a7-afb4-43b8-a082-9a5f3e4e2440",
                  "assetName": "Wall paint (dispersion)",
                  "estimatedCostCents": 220000,
                  "isOverridden": false,
                  "tradeGroup": "Appliance technician",
                  "bundleId": "2028-2029"
                },
                {
                  "assetId": "1dff6cb4-1f36-49d0-a049-79d32dd344eb",
                  "assetName": "Power sockets",
                  "estimatedCostCents": 13000,
                  "isOverridden": false,
                  "tradeGroup": "Appliance technician",
                  "bundleId": "2028-2029"
                },
                {
                  "assetId": "b7a27822-5660-4d4a-aebc-4e54c1970386",
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
                  "assetId": "6462a897-075e-42a5-bb1a-7de409f44b37",
                  "assetName": "Dryer (common)",
                  "estimatedCostCents": 110000,
                  "isOverridden": false,
                  "tradeGroup": "Appliance technician",
                  "bundleId": "2029-2030"
                },
                {
                  "assetId": "f6a01996-4f9c-46a7-86ac-cc5b19fc88b9",
                  "assetName": "Bathroom tap",
                  "estimatedCostCents": 40000,
                  "isOverridden": false,
                  "tradeGroup": "Appliance technician",
                  "bundleId": "2029-2030"
                },
                {
                  "assetId": "760e2773-ab88-408a-a0a2-b9b271c9b84d",
                  "assetName": "Bathroom tap",
                  "estimatedCostCents": 40000,
                  "isOverridden": false,
                  "tradeGroup": "Appliance technician",
                  "bundleId": "2029-2030"
                },
                {
                  "assetId": "10e11f5d-059b-44f0-b3bc-1ed7b1137c33",
                  "assetName": "Kitchen worktop (synthetic)",
                  "estimatedCostCents": 120000,
                  "isOverridden": false,
                  "tradeGroup": "Appliance technician",
                  "bundleId": "2029-2030"
                },
                {
                  "assetId": "6004c6f3-e2f1-4ead-b1be-4e6fc91521bb",
                  "assetName": "Kitchen worktop (synthetic)",
                  "estimatedCostCents": 120000,
                  "isOverridden": false,
                  "tradeGroup": "Appliance technician",
                  "bundleId": "2029-2030"
                },
                {
                  "assetId": "c86bd441-9757-4625-98f9-b6506982c547",
                  "assetName": "Kitchen worktop (synthetic)",
                  "estimatedCostCents": 120000,
                  "isOverridden": false,
                  "tradeGroup": "Appliance technician",
                  "bundleId": "2029-2030"
                },
                {
                  "assetId": "40a31223-d8f1-41a2-964d-853c62365f4c",
                  "assetName": "Interior doors (chipboard)",
                  "estimatedCostCents": 45000,
                  "isOverridden": false,
                  "tradeGroup": "Appliance technician",
                  "bundleId": "2029-2030"
                },
                {
                  "assetId": "36ae25f1-e8a1-4b0a-bd60-aebd88e65167",
                  "assetName": "Kitchen cabinets (chipboard)",
                  "estimatedCostCents": 450000,
                  "isOverridden": false,
                  "tradeGroup": "Appliance technician",
                  "bundleId": "2029-2030"
                },
                {
                  "assetId": "63a9b2bb-ec4f-4b71-9538-e606b7f80070",
                  "assetName": "Kitchen tap",
                  "estimatedCostCents": 40000,
                  "isOverridden": false,
                  "tradeGroup": "Appliance technician",
                  "bundleId": "2029-2030"
                },
                {
                  "assetId": "38f106c6-440d-4799-bffa-00c2daeae3e6",
                  "assetName": "Roller shutters (plastic)",
                  "estimatedCostCents": 55000,
                  "isOverridden": false,
                  "tradeGroup": "Appliance technician",
                  "bundleId": "2029-2030"
                },
                {
                  "assetId": "bef4d37f-3f9f-46ae-a801-60ec1ff04563",
                  "assetName": "Wall paint (dispersion)",
                  "estimatedCostCents": 220000,
                  "isOverridden": false,
                  "tradeGroup": "Appliance technician",
                  "bundleId": "2029-2030"
                },
                {
                  "assetId": "2823df74-6e72-4ae0-b1c8-0322c5311dfc",
                  "assetName": "Intercom system",
                  "estimatedCostCents": 300000,
                  "isOverridden": false,
                  "tradeGroup": "Appliance technician",
                  "bundleId": "2029-2030"
                },
                {
                  "assetId": "8af96294-0bc0-43d7-9768-c1952c0ecda6",
                  "assetName": "Power sockets",
                  "estimatedCostCents": 13000,
                  "isOverridden": false,
                  "tradeGroup": "Appliance technician",
                  "bundleId": "2029-2030"
                },
                {
                  "assetId": "76504672-e5fe-434a-a9e8-502fdab4da87",
                  "assetName": "Light switches",
                  "estimatedCostCents": 7000,
                  "isOverridden": false,
                  "tradeGroup": "Appliance technician",
                  "bundleId": "2029-2030"
                },
                {
                  "assetId": "70eff972-0eb2-468e-85b2-97c17f1bad8f",
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
                  "assetId": "5a2c90fa-661f-4af6-aec3-7f31e9003b48",
                  "assetName": "Bathroom tap",
                  "estimatedCostCents": 40000,
                  "isOverridden": false,
                  "tradeGroup": "HVAC / electrical",
                  "bundleId": "2030-2031"
                },
                {
                  "assetId": "8512137c-9252-46b1-af45-4769b43114e0",
                  "assetName": "Bathroom tap",
                  "estimatedCostCents": 40000,
                  "isOverridden": false,
                  "tradeGroup": "HVAC / electrical",
                  "bundleId": "2030-2031"
                },
                {
                  "assetId": "04469e50-2abf-4b7b-ac10-eeb4633a14ce",
                  "assetName": "Kitchen cabinets (chipboard)",
                  "estimatedCostCents": 450000,
                  "isOverridden": false,
                  "tradeGroup": "HVAC / electrical",
                  "bundleId": "2030-2031"
                },
                {
                  "assetId": "3a33e13f-367b-4a81-8808-260b8607f4b5",
                  "assetName": "Kitchen tap",
                  "estimatedCostCents": 40000,
                  "isOverridden": false,
                  "tradeGroup": "HVAC / electrical",
                  "bundleId": "2030-2031"
                },
                {
                  "assetId": "226e8a03-9daa-4560-802c-ff48b1d3eed7",
                  "assetName": "Roller shutters (plastic)",
                  "estimatedCostCents": 55000,
                  "isOverridden": false,
                  "tradeGroup": "HVAC / electrical",
                  "bundleId": "2030-2031"
                },
                {
                  "assetId": "11866cc2-d29a-4175-8b0d-5e60f1c5f64a",
                  "assetName": "Roller shutters (plastic)",
                  "estimatedCostCents": 55000,
                  "isOverridden": false,
                  "tradeGroup": "HVAC / electrical",
                  "bundleId": "2030-2031"
                },
                {
                  "assetId": "1591b534-098e-41ff-aa5f-f74ff84f15ae",
                  "assetName": "Wall paint (dispersion)",
                  "estimatedCostCents": 220000,
                  "isOverridden": false,
                  "tradeGroup": "HVAC / electrical",
                  "bundleId": "2030-2031"
                },
                {
                  "assetId": "8a864ff1-eebf-4a40-babf-1df73e80af3a",
                  "assetName": "Circulation pump",
                  "estimatedCostCents": 110000,
                  "isOverridden": false,
                  "tradeGroup": "HVAC / electrical",
                  "bundleId": "2030-2031"
                },
                {
                  "assetId": "91afbe21-f399-4bf1-937d-31c5c317f55b",
                  "assetName": "Heating control",
                  "estimatedCostCents": 320000,
                  "isOverridden": false,
                  "tradeGroup": "HVAC / electrical",
                  "bundleId": "2030-2031"
                },
                {
                  "assetId": "51547374-27b8-4836-929a-15fc1f3bf5fc",
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
                  "assetId": "ad578c8d-179f-437a-84ce-d9dd16a55b03",
                  "assetName": "Balcony railing (metal)",
                  "estimatedCostCents": 80000,
                  "isOverridden": false,
                  "tradeGroup": "HVAC / electrical",
                  "bundleId": "2031-2032"
                },
                {
                  "assetId": "07a85932-f5dc-4dae-8ee3-178169da0058",
                  "assetName": "Bathroom tap",
                  "estimatedCostCents": 40000,
                  "isOverridden": false,
                  "tradeGroup": "HVAC / electrical",
                  "bundleId": "2031-2032"
                },
                {
                  "assetId": "506eaef0-8daa-4ed6-8d40-f83820bac2bf",
                  "assetName": "Bathtub (acrylic)",
                  "estimatedCostCents": 90000,
                  "isOverridden": false,
                  "tradeGroup": "HVAC / electrical",
                  "bundleId": "2031-2032"
                },
                {
                  "assetId": "055418f0-43c5-481d-9225-aba3bd6babc9",
                  "assetName": "Bathtub (acrylic)",
                  "estimatedCostCents": 90000,
                  "isOverridden": false,
                  "tradeGroup": "HVAC / electrical",
                  "bundleId": "2031-2032"
                },
                {
                  "assetId": "12e4dd99-34f9-461c-bd3c-b02c6a10a760",
                  "assetName": "Interior doors (chipboard)",
                  "estimatedCostCents": 45000,
                  "isOverridden": false,
                  "tradeGroup": "HVAC / electrical",
                  "bundleId": "2031-2032"
                },
                {
                  "assetId": "972ca36a-ea0d-4212-9f63-ff32556cac0d",
                  "assetName": "Sanitary ceramics (WC/basin)",
                  "estimatedCostCents": 120000,
                  "isOverridden": false,
                  "tradeGroup": "HVAC / electrical",
                  "bundleId": "2031-2032"
                },
                {
                  "assetId": "91fbe53c-072e-4846-a315-dc430ab0b0a7",
                  "assetName": "Insulated windows (PVC/wood)",
                  "estimatedCostCents": 110000,
                  "isOverridden": false,
                  "tradeGroup": "HVAC / electrical",
                  "bundleId": "2031-2032"
                },
                {
                  "assetId": "929f5bc8-9e3e-4bed-a3ba-9e267296e0e9",
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
                  "assetId": "fde3d1f3-8cf0-429e-a126-4769e3aabd83",
                  "assetName": "Balcony railing (metal)",
                  "estimatedCostCents": 80000,
                  "isOverridden": false,
                  "tradeGroup": "Appliance technician",
                  "bundleId": "2032-2033"
                },
                {
                  "assetId": "39104edb-59ff-4e29-a920-3dbcd12931b6",
                  "assetName": "Kitchen tap",
                  "estimatedCostCents": 40000,
                  "isOverridden": false,
                  "tradeGroup": "Appliance technician",
                  "bundleId": "2032-2033"
                },
                {
                  "assetId": "1c947ca6-4c0b-4aab-94db-ee298555c5d9",
                  "assetName": "Kitchen tap",
                  "estimatedCostCents": 40000,
                  "isOverridden": false,
                  "tradeGroup": "Appliance technician",
                  "bundleId": "2032-2033"
                },
                {
                  "assetId": "4fc308c1-87b5-403b-9c01-04aae843ac12",
                  "assetName": "Insulated windows (PVC/wood)",
                  "estimatedCostCents": 110000,
                  "isOverridden": false,
                  "tradeGroup": "Appliance technician",
                  "bundleId": "2032-2033"
                },
                {
                  "assetId": "255e76a2-3782-4021-bb89-d96b92fe067b",
                  "assetName": "Bathroom tiles (ceramic)",
                  "estimatedCostCents": 220000,
                  "isOverridden": false,
                  "tradeGroup": "Appliance technician",
                  "bundleId": "2032-2033"
                },
                {
                  "assetId": "309b679c-1e65-43b0-b0cf-ec1d9f1a8f3c",
                  "assetName": "Kitchen tiles (ceramic)",
                  "estimatedCostCents": 160000,
                  "isOverridden": false,
                  "tradeGroup": "Appliance technician",
                  "bundleId": "2032-2033"
                },
                {
                  "assetId": "d8f8237b-331b-4972-b561-7d180851d1d1",
                  "assetName": "Wall paint (dispersion)",
                  "estimatedCostCents": 220000,
                  "isOverridden": false,
                  "tradeGroup": "Appliance technician",
                  "bundleId": "2032-2033"
                },
                {
                  "assetId": "f1427c20-9f61-41d9-b6b2-65d20b47ac90",
                  "assetName": "Wall paint (dispersion)",
                  "estimatedCostCents": 220000,
                  "isOverridden": false,
                  "tradeGroup": "Appliance technician",
                  "bundleId": "2032-2033"
                },
                {
                  "assetId": "13d33401-9fee-4ab3-9075-ee3348807b02",
                  "assetName": "Elevator",
                  "estimatedCostCents": 11000000,
                  "isOverridden": false,
                  "tradeGroup": "Appliance technician",
                  "bundleId": "2032-2033"
                },
                {
                  "assetId": "ff5e1e6c-8e96-40fc-a513-344f8d6c5dd7",
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
                  "assetId": "70f19646-015a-40f4-98ef-c5d46e2a8078",
                  "assetName": "Washing machine (common)",
                  "estimatedCostCents": 110000,
                  "isOverridden": false,
                  "tradeGroup": "Appliance technician",
                  "bundleId": "2033-2034"
                },
                {
                  "assetId": "61b4b99a-503c-483f-9b92-030bca5c7c3e",
                  "assetName": "Balcony railing (metal)",
                  "estimatedCostCents": 80000,
                  "isOverridden": false,
                  "tradeGroup": "Appliance technician",
                  "bundleId": "2033-2034"
                },
                {
                  "assetId": "97af7310-942f-4e83-9e87-40ecd9b0166f",
                  "assetName": "Bathtub (acrylic)",
                  "estimatedCostCents": 90000,
                  "isOverridden": false,
                  "tradeGroup": "Appliance technician",
                  "bundleId": "2033-2034"
                },
                {
                  "assetId": "e288b712-dfa9-439f-a43e-576a95f8a3d8",
                  "assetName": "Kitchen cabinets (chipboard)",
                  "estimatedCostCents": 450000,
                  "isOverridden": false,
                  "tradeGroup": "Appliance technician",
                  "bundleId": "2033-2034"
                },
                {
                  "assetId": "7ab49bfd-389a-40dd-b1d0-60e259d52c50",
                  "assetName": "Insulated windows (PVC/wood)",
                  "estimatedCostCents": 110000,
                  "isOverridden": false,
                  "tradeGroup": "Appliance technician",
                  "bundleId": "2033-2034"
                },
                {
                  "assetId": "e1b21693-e749-4c67-850d-1aa24a1ec5ab",
                  "assetName": "Balcony (metal)",
                  "estimatedCostCents": 450000,
                  "isOverridden": false,
                  "tradeGroup": "Appliance technician",
                  "bundleId": "2033-2034"
                },
                {
                  "assetId": "0e8898a1-d6af-4408-92b2-f7a87d088070",
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
                  "assetId": "56be3dfa-c953-4ff4-9e17-d54520df9a4f",
                  "assetName": "Balcony railing (metal)",
                  "estimatedCostCents": 80000,
                  "isOverridden": false,
                  "tradeGroup": "General contractor",
                  "bundleId": "2034-2035"
                },
                {
                  "assetId": "977ba0ec-80cb-4ebf-bd58-7316953d0ff4",
                  "assetName": "Kitchen worktop (synthetic)",
                  "estimatedCostCents": 120000,
                  "isOverridden": false,
                  "tradeGroup": "General contractor",
                  "bundleId": "2034-2035"
                },
                {
                  "assetId": "368dc6da-c250-4f39-b744-7cc739f47acc",
                  "assetName": "Kitchen cabinets (chipboard)",
                  "estimatedCostCents": 450000,
                  "isOverridden": false,
                  "tradeGroup": "General contractor",
                  "bundleId": "2034-2035"
                },
                {
                  "assetId": "40acc2d4-e1e0-440c-a69b-052bb8be5276",
                  "assetName": "Kitchen tap",
                  "estimatedCostCents": 40000,
                  "isOverridden": false,
                  "tradeGroup": "General contractor",
                  "bundleId": "2034-2035"
                },
                {
                  "assetId": "27dc96bf-a251-48d1-a6f0-b8278f838542",
                  "assetName": "Roller shutters (plastic)",
                  "estimatedCostCents": 55000,
                  "isOverridden": false,
                  "tradeGroup": "General contractor",
                  "bundleId": "2034-2035"
                },
                {
                  "assetId": "bca9bcb5-5ac6-4455-b37b-d47c4c564de7",
                  "assetName": "Kitchen tiles (ceramic)",
                  "estimatedCostCents": 160000,
                  "isOverridden": false,
                  "tradeGroup": "General contractor",
                  "bundleId": "2034-2035"
                },
                {
                  "assetId": "3ac3fb53-934a-42ec-a758-d0a63ac1f581",
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
                  "assetId": "7186a21f-f80e-4eb0-b0ab-6de6d809723f",
                  "assetName": "Kitchen worktop (synthetic)",
                  "estimatedCostCents": 120000,
                  "isOverridden": false,
                  "tradeGroup": "General contractor",
                  "bundleId": "2035-2036"
                },
                {
                  "assetId": "d606cf41-eb4a-42fe-ad1c-2acf39a9a4aa",
                  "assetName": "Roller shutters (plastic)",
                  "estimatedCostCents": 55000,
                  "isOverridden": false,
                  "tradeGroup": "General contractor",
                  "bundleId": "2035-2036"
                },
                {
                  "assetId": "12bf1e5b-d6d4-423b-b295-851ed9ac5509",
                  "assetName": "Parquet flooring (mosaic)",
                  "estimatedCostCents": 350000,
                  "isOverridden": false,
                  "tradeGroup": "General contractor",
                  "bundleId": "2035-2036"
                },
                {
                  "assetId": "ffa81f1d-937f-4fd8-b1e4-f3507883d1b6",
                  "assetName": "Parquet flooring (mosaic)",
                  "estimatedCostCents": 350000,
                  "isOverridden": false,
                  "tradeGroup": "General contractor",
                  "bundleId": "2035-2036"
                },
                {
                  "assetId": "8adb5bf1-0108-4800-baf2-21319f55b8f6",
                  "assetName": "Balcony (metal)",
                  "estimatedCostCents": 450000,
                  "isOverridden": false,
                  "tradeGroup": "General contractor",
                  "bundleId": "2035-2036"
                },
                {
                  "assetId": "0b241cab-2a05-4239-9acc-c45ca3700356",
                  "assetName": "Power sockets",
                  "estimatedCostCents": 13000,
                  "isOverridden": false,
                  "tradeGroup": "General contractor",
                  "bundleId": "2035-2036"
                },
                {
                  "assetId": "cfb4e000-1ba2-4880-ab1b-bbc8fbe65a48",
                  "assetName": "Light switches",
                  "estimatedCostCents": 7000,
                  "isOverridden": false,
                  "tradeGroup": "General contractor",
                  "bundleId": "2035-2036"
                },
                {
                  "assetId": "26e2009f-0b98-4ff6-853c-39a1cdb2643c",
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
                  "assetId": "ee2cb058-ba5a-4d57-bcec-0602ab768fe3",
                  "assetName": "Bathroom tap",
                  "estimatedCostCents": 40000,
                  "isOverridden": false,
                  "tradeGroup": "General contractor",
                  "bundleId": "2035-2036"
                },
                {
                  "assetId": "442df839-889a-4021-9ac6-6058752873a5",
                  "assetName": "Kitchen worktop (synthetic)",
                  "estimatedCostCents": 120000,
                  "isOverridden": false,
                  "tradeGroup": "General contractor",
                  "bundleId": "2035-2036"
                },
                {
                  "assetId": "15273640-7a79-4d32-94a7-71539bf1f86d",
                  "assetName": "Kitchen cabinets (chipboard)",
                  "estimatedCostCents": 450000,
                  "isOverridden": false,
                  "tradeGroup": "General contractor",
                  "bundleId": "2035-2036"
                },
                {
                  "assetId": "873afa78-0b19-4d30-be5b-c3bf599135ee",
                  "assetName": "Sanitary ceramics (WC/basin)",
                  "estimatedCostCents": 120000,
                  "isOverridden": false,
                  "tradeGroup": "General contractor",
                  "bundleId": "2035-2036"
                },
                {
                  "assetId": "906b22fb-ca51-4603-9ab0-7aa09e759957",
                  "assetName": "Sanitary ceramics (WC/basin)",
                  "estimatedCostCents": 120000,
                  "isOverridden": false,
                  "tradeGroup": "General contractor",
                  "bundleId": "2035-2036"
                },
                {
                  "assetId": "02c552c9-422b-4350-ab98-38c2e32bfafd",
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
              "assetId": "aa1e5f48-3995-4414-905f-eafe6207ea12",
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
              "assetId": "b2487276-dd27-46e9-a9f8-5d6a0171ae2d",
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
              "assetId": "85ff6500-271b-414f-a194-d71ba536c327",
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
            },
            {
              "buildingId": "demo-building",
              "buildingName": "Résidence des Charmilles",
              "assetId": "9154bb61-a9ee-477a-9db4-87697de4b73d",
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
              "assetId": "c75ab1a7-afb4-43b8-a082-9a5f3e4e2440",
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
            }
          ]
        },
        "strategyOverlay": {
          "archetypeLabel": "Value Builder",
          "primaryArchetype": "value_builder",
          "secondaryArchetype": "opportunistic_repositioner",
          "alignedCount": 0,
          "reviewCount": 23,
          "lowPriorityCount": 60,
          "deprioritizationNote": "Minimal repairs without long-term value creation may not serve your appreciation goals.",
          "items": [
            {
              "assetId": "810ba743-1a27-48fe-b326-33183f74754b",
              "assetName": "Parquet flooring (mosaic)",
              "tag": "review",
              "score": 53,
              "explanation": "Mixed alignment with your Value Builder strategy. Long-term value ~, Regulatory compliance ~, Lifecycle extension ✓. Worth reviewing whether this fits your priorities.",
              "topDimensions": [
                {
                  "name": "totalValueCreation",
                  "label": "Long-term value",
                  "itemScore": 40,
                  "weight": 1
                },
                {
                  "name": "complianceNeed",
                  "label": "Regulatory compliance",
                  "itemScore": 50,
                  "weight": 0.95
                },
                {
                  "name": "lifecycleExtension",
                  "label": "Lifecycle extension",
                  "itemScore": 70,
                  "weight": 0.95
                }
              ]
            },
            {
              "assetId": "6556fbb3-0f9e-41e8-a847-094c67aafe9b",
              "assetName": "Boiler",
              "tag": "review",
              "score": 53,
              "explanation": "Mixed alignment with your Value Builder strategy. Long-term value ~, Regulatory compliance ~, Lifecycle extension ✓. Worth reviewing whether this fits your priorities.",
              "topDimensions": [
                {
                  "name": "totalValueCreation",
                  "label": "Long-term value",
                  "itemScore": 40,
                  "weight": 1
                },
                {
                  "name": "complianceNeed",
                  "label": "Regulatory compliance",
                  "itemScore": 50,
                  "weight": 0.95
                },
                {
                  "name": "lifecycleExtension",
                  "label": "Lifecycle extension",
                  "itemScore": 70,
                  "weight": 0.95
                }
              ]
            },
            {
              "assetId": "b69ee2a2-213e-4b22-b601-ab857ec7c1d6",
              "assetName": "Insulated windows (PVC/wood)",
              "tag": "review",
              "score": 53,
              "explanation": "Mixed alignment with your Value Builder strategy. Long-term value ~, Regulatory compliance ~, Lifecycle extension ✓. Worth reviewing whether this fits your priorities.",
              "topDimensions": [
                {
                  "name": "totalValueCreation",
                  "label": "Long-term value",
                  "itemScore": 40,
                  "weight": 1
                },
                {
                  "name": "complianceNeed",
                  "label": "Regulatory compliance",
                  "itemScore": 50,
                  "weight": 0.95
                },
                {
                  "name": "lifecycleExtension",
                  "label": "Lifecycle extension",
                  "itemScore": 70,
                  "weight": 0.95
                }
              ]
            },
            {
              "assetId": "b2487276-dd27-46e9-a9f8-5d6a0171ae2d",
              "assetName": "Wall paint (dispersion)",
              "tag": "review",
              "score": 53,
              "explanation": "Mixed alignment with your Value Builder strategy. Long-term value ~, Regulatory compliance ~, Lifecycle extension ✓. Worth reviewing whether this fits your priorities.",
              "topDimensions": [
                {
                  "name": "totalValueCreation",
                  "label": "Long-term value",
                  "itemScore": 40,
                  "weight": 1
                },
                {
                  "name": "complianceNeed",
                  "label": "Regulatory compliance",
                  "itemScore": 50,
                  "weight": 0.95
                },
                {
                  "name": "lifecycleExtension",
                  "label": "Lifecycle extension",
                  "itemScore": 70,
                  "weight": 0.95
                }
              ]
            },
            {
              "assetId": "a0345d17-a405-4bab-a0e9-117c91256a37",
              "assetName": "Kitchen cabinets (chipboard)",
              "tag": "review",
              "score": 53,
              "explanation": "Mixed alignment with your Value Builder strategy. Long-term value ~, Regulatory compliance ~, Lifecycle extension ✓. Worth reviewing whether this fits your priorities.",
              "topDimensions": [
                {
                  "name": "totalValueCreation",
                  "label": "Long-term value",
                  "itemScore": 40,
                  "weight": 1
                },
                {
                  "name": "complianceNeed",
                  "label": "Regulatory compliance",
                  "itemScore": 50,
                  "weight": 0.95
                },
                {
                  "name": "lifecycleExtension",
                  "label": "Lifecycle extension",
                  "itemScore": 70,
                  "weight": 0.95
                }
              ]
            },
            {
              "assetId": "aa1e5f48-3995-4414-905f-eafe6207ea12",
              "assetName": "Kitchen cabinets (chipboard)",
              "tag": "low_priority",
              "score": 37,
              "explanation": "Low alignment with your Value Builder priorities. Long-term value ~, Regulatory compliance ✗, Lifecycle extension ~. Consider deferring or finding alternatives.",
              "topDimensions": [
                {
                  "name": "totalValueCreation",
                  "label": "Long-term value",
                  "itemScore": 40,
                  "weight": 1
                },
                {
                  "name": "complianceNeed",
                  "label": "Regulatory compliance",
                  "itemScore": 30,
                  "weight": 0.95
                },
                {
                  "name": "lifecycleExtension",
                  "label": "Lifecycle extension",
                  "itemScore": 40,
                  "weight": 0.95
                }
              ]
            },
            {
              "assetId": "8c0c1cd8-d2a9-4370-8f2e-4715f2461451",
              "assetName": "Roller shutters (plastic)",
              "tag": "low_priority",
              "score": 37,
              "explanation": "Low alignment with your Value Builder priorities. Long-term value ~, Regulatory compliance ✗, Lifecycle extension ~. Consider deferring or finding alternatives.",
              "topDimensions": [
                {
                  "name": "totalValueCreation",
                  "label": "Long-term value",
                  "itemScore": 40,
                  "weight": 1
                },
                {
                  "name": "complianceNeed",
                  "label": "Regulatory compliance",
                  "itemScore": 30,
                  "weight": 0.95
                },
                {
                  "name": "lifecycleExtension",
                  "label": "Lifecycle extension",
                  "itemScore": 40,
                  "weight": 0.95
                }
              ]
            },
            {
              "assetId": "85ff6500-271b-414f-a194-d71ba536c327",
              "assetName": "Wall paint (dispersion)",
              "tag": "low_priority",
              "score": 37,
              "explanation": "Low alignment with your Value Builder priorities. Long-term value ~, Regulatory compliance ✗, Lifecycle extension ~. Consider deferring or finding alternatives.",
              "topDimensions": [
                {
                  "name": "totalValueCreation",
                  "label": "Long-term value",
                  "itemScore": 40,
                  "weight": 1
                },
                {
                  "name": "complianceNeed",
                  "label": "Regulatory compliance",
                  "itemScore": 30,
                  "weight": 0.95
                },
                {
                  "name": "lifecycleExtension",
                  "label": "Lifecycle extension",
                  "itemScore": 40,
                  "weight": 0.95
                }
              ]
            },
            {
              "assetId": "9154bb61-a9ee-477a-9db4-87697de4b73d",
              "assetName": "Wall paint (dispersion)",
              "tag": "low_priority",
              "score": 37,
              "explanation": "Low alignment with your Value Builder priorities. Long-term value ~, Regulatory compliance ✗, Lifecycle extension ~. Consider deferring or finding alternatives.",
              "topDimensions": [
                {
                  "name": "totalValueCreation",
                  "label": "Long-term value",
                  "itemScore": 40,
                  "weight": 1
                },
                {
                  "name": "complianceNeed",
                  "label": "Regulatory compliance",
                  "itemScore": 30,
                  "weight": 0.95
                },
                {
                  "name": "lifecycleExtension",
                  "label": "Lifecycle extension",
                  "itemScore": 40,
                  "weight": 0.95
                }
              ]
            },
            {
              "assetId": "c75ab1a7-afb4-43b8-a082-9a5f3e4e2440",
              "assetName": "Wall paint (dispersion)",
              "tag": "low_priority",
              "score": 37,
              "explanation": "Low alignment with your Value Builder priorities. Long-term value ~, Regulatory compliance ✗, Lifecycle extension ~. Consider deferring or finding alternatives.",
              "topDimensions": [
                {
                  "name": "totalValueCreation",
                  "label": "Long-term value",
                  "itemScore": 40,
                  "weight": 1
                },
                {
                  "name": "complianceNeed",
                  "label": "Regulatory compliance",
                  "itemScore": 30,
                  "weight": 0.95
                },
                {
                  "name": "lifecycleExtension",
                  "label": "Lifecycle extension",
                  "itemScore": 40,
                  "weight": 0.95
                }
              ]
            },
            {
              "assetId": "1dff6cb4-1f36-49d0-a049-79d32dd344eb",
              "assetName": "Power sockets",
              "tag": "low_priority",
              "score": 37,
              "explanation": "Low alignment with your Value Builder priorities. Long-term value ~, Regulatory compliance ✗, Lifecycle extension ~. Consider deferring or finding alternatives.",
              "topDimensions": [
                {
                  "name": "totalValueCreation",
                  "label": "Long-term value",
                  "itemScore": 40,
                  "weight": 1
                },
                {
                  "name": "complianceNeed",
                  "label": "Regulatory compliance",
                  "itemScore": 30,
                  "weight": 0.95
                },
                {
                  "name": "lifecycleExtension",
                  "label": "Lifecycle extension",
                  "itemScore": 40,
                  "weight": 0.95
                }
              ]
            },
            {
              "assetId": "b7a27822-5660-4d4a-aebc-4e54c1970386",
              "assetName": "Power sockets",
              "tag": "low_priority",
              "score": 37,
              "explanation": "Low alignment with your Value Builder priorities. Long-term value ~, Regulatory compliance ✗, Lifecycle extension ~. Consider deferring or finding alternatives.",
              "topDimensions": [
                {
                  "name": "totalValueCreation",
                  "label": "Long-term value",
                  "itemScore": 40,
                  "weight": 1
                },
                {
                  "name": "complianceNeed",
                  "label": "Regulatory compliance",
                  "itemScore": 30,
                  "weight": 0.95
                },
                {
                  "name": "lifecycleExtension",
                  "label": "Lifecycle extension",
                  "itemScore": 40,
                  "weight": 0.95
                }
              ]
            },
            {
              "assetId": "6462a897-075e-42a5-bb1a-7de409f44b37",
              "assetName": "Dryer (common)",
              "tag": "low_priority",
              "score": 37,
              "explanation": "Low alignment with your Value Builder priorities. Long-term value ~, Regulatory compliance ✗, Lifecycle extension ~. Consider deferring or finding alternatives.",
              "topDimensions": [
                {
                  "name": "totalValueCreation",
                  "label": "Long-term value",
                  "itemScore": 40,
                  "weight": 1
                },
                {
                  "name": "complianceNeed",
                  "label": "Regulatory compliance",
                  "itemScore": 30,
                  "weight": 0.95
                },
                {
                  "name": "lifecycleExtension",
                  "label": "Lifecycle extension",
                  "itemScore": 40,
                  "weight": 0.95
                }
              ]
            },
            {
              "assetId": "f6a01996-4f9c-46a7-86ac-cc5b19fc88b9",
              "assetName": "Bathroom tap",
              "tag": "low_priority",
              "score": 37,
              "explanation": "Low alignment with your Value Builder priorities. Long-term value ~, Regulatory compliance ✗, Lifecycle extension ~. Consider deferring or finding alternatives.",
              "topDimensions": [
                {
                  "name": "totalValueCreation",
                  "label": "Long-term value",
                  "itemScore": 40,
                  "weight": 1
                },
                {
                  "name": "complianceNeed",
                  "label": "Regulatory compliance",
                  "itemScore": 30,
                  "weight": 0.95
                },
                {
                  "name": "lifecycleExtension",
                  "label": "Lifecycle extension",
                  "itemScore": 40,
                  "weight": 0.95
                }
              ]
            },
            {
              "assetId": "760e2773-ab88-408a-a0a2-b9b271c9b84d",
              "assetName": "Bathroom tap",
              "tag": "low_priority",
              "score": 37,
              "explanation": "Low alignment with your Value Builder priorities. Long-term value ~, Regulatory compliance ✗, Lifecycle extension ~. Consider deferring or finding alternatives.",
              "topDimensions": [
                {
                  "name": "totalValueCreation",
                  "label": "Long-term value",
                  "itemScore": 40,
                  "weight": 1
                },
                {
                  "name": "complianceNeed",
                  "label": "Regulatory compliance",
                  "itemScore": 30,
                  "weight": 0.95
                },
                {
                  "name": "lifecycleExtension",
                  "label": "Lifecycle extension",
                  "itemScore": 40,
                  "weight": 0.95
                }
              ]
            },
            {
              "assetId": "10e11f5d-059b-44f0-b3bc-1ed7b1137c33",
              "assetName": "Kitchen worktop (synthetic)",
              "tag": "low_priority",
              "score": 37,
              "explanation": "Low alignment with your Value Builder priorities. Long-term value ~, Regulatory compliance ✗, Lifecycle extension ~. Consider deferring or finding alternatives.",
              "topDimensions": [
                {
                  "name": "totalValueCreation",
                  "label": "Long-term value",
                  "itemScore": 40,
                  "weight": 1
                },
                {
                  "name": "complianceNeed",
                  "label": "Regulatory compliance",
                  "itemScore": 30,
                  "weight": 0.95
                },
                {
                  "name": "lifecycleExtension",
                  "label": "Lifecycle extension",
                  "itemScore": 40,
                  "weight": 0.95
                }
              ]
            },
            {
              "assetId": "6004c6f3-e2f1-4ead-b1be-4e6fc91521bb",
              "assetName": "Kitchen worktop (synthetic)",
              "tag": "low_priority",
              "score": 37,
              "explanation": "Low alignment with your Value Builder priorities. Long-term value ~, Regulatory compliance ✗, Lifecycle extension ~. Consider deferring or finding alternatives.",
              "topDimensions": [
                {
                  "name": "totalValueCreation",
                  "label": "Long-term value",
                  "itemScore": 40,
                  "weight": 1
                },
                {
                  "name": "complianceNeed",
                  "label": "Regulatory compliance",
                  "itemScore": 30,
                  "weight": 0.95
                },
                {
                  "name": "lifecycleExtension",
                  "label": "Lifecycle extension",
                  "itemScore": 40,
                  "weight": 0.95
                }
              ]
            },
            {
              "assetId": "c86bd441-9757-4625-98f9-b6506982c547",
              "assetName": "Kitchen worktop (synthetic)",
              "tag": "low_priority",
              "score": 37,
              "explanation": "Low alignment with your Value Builder priorities. Long-term value ~, Regulatory compliance ✗, Lifecycle extension ~. Consider deferring or finding alternatives.",
              "topDimensions": [
                {
                  "name": "totalValueCreation",
                  "label": "Long-term value",
                  "itemScore": 40,
                  "weight": 1
                },
                {
                  "name": "complianceNeed",
                  "label": "Regulatory compliance",
                  "itemScore": 30,
                  "weight": 0.95
                },
                {
                  "name": "lifecycleExtension",
                  "label": "Lifecycle extension",
                  "itemScore": 40,
                  "weight": 0.95
                }
              ]
            },
            {
              "assetId": "40a31223-d8f1-41a2-964d-853c62365f4c",
              "assetName": "Interior doors (chipboard)",
              "tag": "low_priority",
              "score": 37,
              "explanation": "Low alignment with your Value Builder priorities. Long-term value ~, Regulatory compliance ✗, Lifecycle extension ~. Consider deferring or finding alternatives.",
              "topDimensions": [
                {
                  "name": "totalValueCreation",
                  "label": "Long-term value",
                  "itemScore": 40,
                  "weight": 1
                },
                {
                  "name": "complianceNeed",
                  "label": "Regulatory compliance",
                  "itemScore": 30,
                  "weight": 0.95
                },
                {
                  "name": "lifecycleExtension",
                  "label": "Lifecycle extension",
                  "itemScore": 40,
                  "weight": 0.95
                }
              ]
            },
            {
              "assetId": "36ae25f1-e8a1-4b0a-bd60-aebd88e65167",
              "assetName": "Kitchen cabinets (chipboard)",
              "tag": "low_priority",
              "score": 37,
              "explanation": "Low alignment with your Value Builder priorities. Long-term value ~, Regulatory compliance ✗, Lifecycle extension ~. Consider deferring or finding alternatives.",
              "topDimensions": [
                {
                  "name": "totalValueCreation",
                  "label": "Long-term value",
                  "itemScore": 40,
                  "weight": 1
                },
                {
                  "name": "complianceNeed",
                  "label": "Regulatory compliance",
                  "itemScore": 30,
                  "weight": 0.95
                },
                {
                  "name": "lifecycleExtension",
                  "label": "Lifecycle extension",
                  "itemScore": 40,
                  "weight": 0.95
                }
              ]
            },
            {
              "assetId": "63a9b2bb-ec4f-4b71-9538-e606b7f80070",
              "assetName": "Kitchen tap",
              "tag": "low_priority",
              "score": 37,
              "explanation": "Low alignment with your Value Builder priorities. Long-term value ~, Regulatory compliance ✗, Lifecycle extension ~. Consider deferring or finding alternatives.",
              "topDimensions": [
                {
                  "name": "totalValueCreation",
                  "label": "Long-term value",
                  "itemScore": 40,
                  "weight": 1
                },
                {
                  "name": "complianceNeed",
                  "label": "Regulatory compliance",
                  "itemScore": 30,
                  "weight": 0.95
                },
                {
                  "name": "lifecycleExtension",
                  "label": "Lifecycle extension",
                  "itemScore": 40,
                  "weight": 0.95
                }
              ]
            },
            {
              "assetId": "38f106c6-440d-4799-bffa-00c2daeae3e6",
              "assetName": "Roller shutters (plastic)",
              "tag": "low_priority",
              "score": 37,
              "explanation": "Low alignment with your Value Builder priorities. Long-term value ~, Regulatory compliance ✗, Lifecycle extension ~. Consider deferring or finding alternatives.",
              "topDimensions": [
                {
                  "name": "totalValueCreation",
                  "label": "Long-term value",
                  "itemScore": 40,
                  "weight": 1
                },
                {
                  "name": "complianceNeed",
                  "label": "Regulatory compliance",
                  "itemScore": 30,
                  "weight": 0.95
                },
                {
                  "name": "lifecycleExtension",
                  "label": "Lifecycle extension",
                  "itemScore": 40,
                  "weight": 0.95
                }
              ]
            },
            {
              "assetId": "bef4d37f-3f9f-46ae-a801-60ec1ff04563",
              "assetName": "Wall paint (dispersion)",
              "tag": "low_priority",
              "score": 37,
              "explanation": "Low alignment with your Value Builder priorities. Long-term value ~, Regulatory compliance ✗, Lifecycle extension ~. Consider deferring or finding alternatives.",
              "topDimensions": [
                {
                  "name": "totalValueCreation",
                  "label": "Long-term value",
                  "itemScore": 40,
                  "weight": 1
                },
                {
                  "name": "complianceNeed",
                  "label": "Regulatory compliance",
                  "itemScore": 30,
                  "weight": 0.95
                },
                {
                  "name": "lifecycleExtension",
                  "label": "Lifecycle extension",
                  "itemScore": 40,
                  "weight": 0.95
                }
              ]
            },
            {
              "assetId": "2823df74-6e72-4ae0-b1c8-0322c5311dfc",
              "assetName": "Intercom system",
              "tag": "low_priority",
              "score": 37,
              "explanation": "Low alignment with your Value Builder priorities. Long-term value ~, Regulatory compliance ✗, Lifecycle extension ~. Consider deferring or finding alternatives.",
              "topDimensions": [
                {
                  "name": "totalValueCreation",
                  "label": "Long-term value",
                  "itemScore": 40,
                  "weight": 1
                },
                {
                  "name": "complianceNeed",
                  "label": "Regulatory compliance",
                  "itemScore": 30,
                  "weight": 0.95
                },
                {
                  "name": "lifecycleExtension",
                  "label": "Lifecycle extension",
                  "itemScore": 40,
                  "weight": 0.95
                }
              ]
            },
            {
              "assetId": "8af96294-0bc0-43d7-9768-c1952c0ecda6",
              "assetName": "Power sockets",
              "tag": "low_priority",
              "score": 37,
              "explanation": "Low alignment with your Value Builder priorities. Long-term value ~, Regulatory compliance ✗, Lifecycle extension ~. Consider deferring or finding alternatives.",
              "topDimensions": [
                {
                  "name": "totalValueCreation",
                  "label": "Long-term value",
                  "itemScore": 40,
                  "weight": 1
                },
                {
                  "name": "complianceNeed",
                  "label": "Regulatory compliance",
                  "itemScore": 30,
                  "weight": 0.95
                },
                {
                  "name": "lifecycleExtension",
                  "label": "Lifecycle extension",
                  "itemScore": 40,
                  "weight": 0.95
                }
              ]
            },
            {
              "assetId": "76504672-e5fe-434a-a9e8-502fdab4da87",
              "assetName": "Light switches",
              "tag": "low_priority",
              "score": 37,
              "explanation": "Low alignment with your Value Builder priorities. Long-term value ~, Regulatory compliance ✗, Lifecycle extension ~. Consider deferring or finding alternatives.",
              "topDimensions": [
                {
                  "name": "totalValueCreation",
                  "label": "Long-term value",
                  "itemScore": 40,
                  "weight": 1
                },
                {
                  "name": "complianceNeed",
                  "label": "Regulatory compliance",
                  "itemScore": 30,
                  "weight": 0.95
                },
                {
                  "name": "lifecycleExtension",
                  "label": "Lifecycle extension",
                  "itemScore": 40,
                  "weight": 0.95
                }
              ]
            },
            {
              "assetId": "70eff972-0eb2-468e-85b2-97c17f1bad8f",
              "assetName": "Light switches",
              "tag": "low_priority",
              "score": 37,
              "explanation": "Low alignment with your Value Builder priorities. Long-term value ~, Regulatory compliance ✗, Lifecycle extension ~. Consider deferring or finding alternatives.",
              "topDimensions": [
                {
                  "name": "totalValueCreation",
                  "label": "Long-term value",
                  "itemScore": 40,
                  "weight": 1
                },
                {
                  "name": "complianceNeed",
                  "label": "Regulatory compliance",
                  "itemScore": 30,
                  "weight": 0.95
                },
                {
                  "name": "lifecycleExtension",
                  "label": "Lifecycle extension",
                  "itemScore": 40,
                  "weight": 0.95
                }
              ]
            },
            {
              "assetId": "5a2c90fa-661f-4af6-aec3-7f31e9003b48",
              "assetName": "Bathroom tap",
              "tag": "review",
              "score": 53,
              "explanation": "Mixed alignment with your Value Builder strategy. Long-term value ~, Regulatory compliance ~, Lifecycle extension ✓. Worth reviewing whether this fits your priorities.",
              "topDimensions": [
                {
                  "name": "totalValueCreation",
                  "label": "Long-term value",
                  "itemScore": 40,
                  "weight": 1
                },
                {
                  "name": "complianceNeed",
                  "label": "Regulatory compliance",
                  "itemScore": 50,
                  "weight": 0.95
                },
                {
                  "name": "lifecycleExtension",
                  "label": "Lifecycle extension",
                  "itemScore": 70,
                  "weight": 0.95
                }
              ]
            },
            {
              "assetId": "8512137c-9252-46b1-af45-4769b43114e0",
              "assetName": "Bathroom tap",
              "tag": "review",
              "score": 53,
              "explanation": "Mixed alignment with your Value Builder strategy. Long-term value ~, Regulatory compliance ~, Lifecycle extension ✓. Worth reviewing whether this fits your priorities.",
              "topDimensions": [
                {
                  "name": "totalValueCreation",
                  "label": "Long-term value",
                  "itemScore": 40,
                  "weight": 1
                },
                {
                  "name": "complianceNeed",
                  "label": "Regulatory compliance",
                  "itemScore": 50,
                  "weight": 0.95
                },
                {
                  "name": "lifecycleExtension",
                  "label": "Lifecycle extension",
                  "itemScore": 70,
                  "weight": 0.95
                }
              ]
            },
            {
              "assetId": "04469e50-2abf-4b7b-ac10-eeb4633a14ce",
              "assetName": "Kitchen cabinets (chipboard)",
              "tag": "review",
              "score": 53,
              "explanation": "Mixed alignment with your Value Builder strategy. Long-term value ~, Regulatory compliance ~, Lifecycle extension ✓. Worth reviewing whether this fits your priorities.",
              "topDimensions": [
                {
                  "name": "totalValueCreation",
                  "label": "Long-term value",
                  "itemScore": 40,
                  "weight": 1
                },
                {
                  "name": "complianceNeed",
                  "label": "Regulatory compliance",
                  "itemScore": 50,
                  "weight": 0.95
                },
                {
                  "name": "lifecycleExtension",
                  "label": "Lifecycle extension",
                  "itemScore": 70,
                  "weight": 0.95
                }
              ]
            },
            {
              "assetId": "3a33e13f-367b-4a81-8808-260b8607f4b5",
              "assetName": "Kitchen tap",
              "tag": "review",
              "score": 53,
              "explanation": "Mixed alignment with your Value Builder strategy. Long-term value ~, Regulatory compliance ~, Lifecycle extension ✓. Worth reviewing whether this fits your priorities.",
              "topDimensions": [
                {
                  "name": "totalValueCreation",
                  "label": "Long-term value",
                  "itemScore": 40,
                  "weight": 1
                },
                {
                  "name": "complianceNeed",
                  "label": "Regulatory compliance",
                  "itemScore": 50,
                  "weight": 0.95
                },
                {
                  "name": "lifecycleExtension",
                  "label": "Lifecycle extension",
                  "itemScore": 70,
                  "weight": 0.95
                }
              ]
            },
            {
              "assetId": "226e8a03-9daa-4560-802c-ff48b1d3eed7",
              "assetName": "Roller shutters (plastic)",
              "tag": "review",
              "score": 53,
              "explanation": "Mixed alignment with your Value Builder strategy. Long-term value ~, Regulatory compliance ~, Lifecycle extension ✓. Worth reviewing whether this fits your priorities.",
              "topDimensions": [
                {
                  "name": "totalValueCreation",
                  "label": "Long-term value",
                  "itemScore": 40,
                  "weight": 1
                },
                {
                  "name": "complianceNeed",
                  "label": "Regulatory compliance",
                  "itemScore": 50,
                  "weight": 0.95
                },
                {
                  "name": "lifecycleExtension",
                  "label": "Lifecycle extension",
                  "itemScore": 70,
                  "weight": 0.95
                }
              ]
            },
            {
              "assetId": "11866cc2-d29a-4175-8b0d-5e60f1c5f64a",
              "assetName": "Roller shutters (plastic)",
              "tag": "review",
              "score": 53,
              "explanation": "Mixed alignment with your Value Builder strategy. Long-term value ~, Regulatory compliance ~, Lifecycle extension ✓. Worth reviewing whether this fits your priorities.",
              "topDimensions": [
                {
                  "name": "totalValueCreation",
                  "label": "Long-term value",
                  "itemScore": 40,
                  "weight": 1
                },
                {
                  "name": "complianceNeed",
                  "label": "Regulatory compliance",
                  "itemScore": 50,
                  "weight": 0.95
                },
                {
                  "name": "lifecycleExtension",
                  "label": "Lifecycle extension",
                  "itemScore": 70,
                  "weight": 0.95
                }
              ]
            },
            {
              "assetId": "1591b534-098e-41ff-aa5f-f74ff84f15ae",
              "assetName": "Wall paint (dispersion)",
              "tag": "review",
              "score": 53,
              "explanation": "Mixed alignment with your Value Builder strategy. Long-term value ~, Regulatory compliance ~, Lifecycle extension ✓. Worth reviewing whether this fits your priorities.",
              "topDimensions": [
                {
                  "name": "totalValueCreation",
                  "label": "Long-term value",
                  "itemScore": 40,
                  "weight": 1
                },
                {
                  "name": "complianceNeed",
                  "label": "Regulatory compliance",
                  "itemScore": 50,
                  "weight": 0.95
                },
                {
                  "name": "lifecycleExtension",
                  "label": "Lifecycle extension",
                  "itemScore": 70,
                  "weight": 0.95
                }
              ]
            },
            {
              "assetId": "8a864ff1-eebf-4a40-babf-1df73e80af3a",
              "assetName": "Circulation pump",
              "tag": "review",
              "score": 53,
              "explanation": "Mixed alignment with your Value Builder strategy. Long-term value ~, Regulatory compliance ~, Lifecycle extension ✓. Worth reviewing whether this fits your priorities.",
              "topDimensions": [
                {
                  "name": "totalValueCreation",
                  "label": "Long-term value",
                  "itemScore": 40,
                  "weight": 1
                },
                {
                  "name": "complianceNeed",
                  "label": "Regulatory compliance",
                  "itemScore": 50,
                  "weight": 0.95
                },
                {
                  "name": "lifecycleExtension",
                  "label": "Lifecycle extension",
                  "itemScore": 70,
                  "weight": 0.95
                }
              ]
            },
            {
              "assetId": "91afbe21-f399-4bf1-937d-31c5c317f55b",
              "assetName": "Heating control",
              "tag": "review",
              "score": 53,
              "explanation": "Mixed alignment with your Value Builder strategy. Long-term value ~, Regulatory compliance ~, Lifecycle extension ✓. Worth reviewing whether this fits your priorities.",
              "topDimensions": [
                {
                  "name": "totalValueCreation",
                  "label": "Long-term value",
                  "itemScore": 40,
                  "weight": 1
                },
                {
                  "name": "complianceNeed",
                  "label": "Regulatory compliance",
                  "itemScore": 50,
                  "weight": 0.95
                },
                {
                  "name": "lifecycleExtension",
                  "label": "Lifecycle extension",
                  "itemScore": 70,
                  "weight": 0.95
                }
              ]
            },
            {
              "assetId": "51547374-27b8-4836-929a-15fc1f3bf5fc",
              "assetName": "Power sockets",
              "tag": "review",
              "score": 53,
              "explanation": "Mixed alignment with your Value Builder strategy. Long-term value ~, Regulatory compliance ~, Lifecycle extension ✓. Worth reviewing whether this fits your priorities.",
              "topDimensions": [
                {
                  "name": "totalValueCreation",
                  "label": "Long-term value",
                  "itemScore": 40,
                  "weight": 1
                },
                {
                  "name": "complianceNeed",
                  "label": "Regulatory compliance",
                  "itemScore": 50,
                  "weight": 0.95
                },
                {
                  "name": "lifecycleExtension",
                  "label": "Lifecycle extension",
                  "itemScore": 70,
                  "weight": 0.95
                }
              ]
            },
            {
              "assetId": "ad578c8d-179f-437a-84ce-d9dd16a55b03",
              "assetName": "Balcony railing (metal)",
              "tag": "review",
              "score": 53,
              "explanation": "Mixed alignment with your Value Builder strategy. Long-term value ~, Regulatory compliance ~, Lifecycle extension ✓. Worth reviewing whether this fits your priorities.",
              "topDimensions": [
                {
                  "name": "totalValueCreation",
                  "label": "Long-term value",
                  "itemScore": 40,
                  "weight": 1
                },
                {
                  "name": "complianceNeed",
                  "label": "Regulatory compliance",
                  "itemScore": 50,
                  "weight": 0.95
                },
                {
                  "name": "lifecycleExtension",
                  "label": "Lifecycle extension",
                  "itemScore": 70,
                  "weight": 0.95
                }
              ]
            },
            {
              "assetId": "07a85932-f5dc-4dae-8ee3-178169da0058",
              "assetName": "Bathroom tap",
              "tag": "review",
              "score": 53,
              "explanation": "Mixed alignment with your Value Builder strategy. Long-term value ~, Regulatory compliance ~, Lifecycle extension ✓. Worth reviewing whether this fits your priorities.",
              "topDimensions": [
                {
                  "name": "totalValueCreation",
                  "label": "Long-term value",
                  "itemScore": 40,
                  "weight": 1
                },
                {
                  "name": "complianceNeed",
                  "label": "Regulatory compliance",
                  "itemScore": 50,
                  "weight": 0.95
                },
                {
                  "name": "lifecycleExtension",
                  "label": "Lifecycle extension",
                  "itemScore": 70,
                  "weight": 0.95
                }
              ]
            },
            {
              "assetId": "506eaef0-8daa-4ed6-8d40-f83820bac2bf",
              "assetName": "Bathtub (acrylic)",
              "tag": "review",
              "score": 53,
              "explanation": "Mixed alignment with your Value Builder strategy. Long-term value ~, Regulatory compliance ~, Lifecycle extension ✓. Worth reviewing whether this fits your priorities.",
              "topDimensions": [
                {
                  "name": "totalValueCreation",
                  "label": "Long-term value",
                  "itemScore": 40,
                  "weight": 1
                },
                {
                  "name": "complianceNeed",
                  "label": "Regulatory compliance",
                  "itemScore": 50,
                  "weight": 0.95
                },
                {
                  "name": "lifecycleExtension",
                  "label": "Lifecycle extension",
                  "itemScore": 70,
                  "weight": 0.95
                }
              ]
            },
            {
              "assetId": "055418f0-43c5-481d-9225-aba3bd6babc9",
              "assetName": "Bathtub (acrylic)",
              "tag": "review",
              "score": 53,
              "explanation": "Mixed alignment with your Value Builder strategy. Long-term value ~, Regulatory compliance ~, Lifecycle extension ✓. Worth reviewing whether this fits your priorities.",
              "topDimensions": [
                {
                  "name": "totalValueCreation",
                  "label": "Long-term value",
                  "itemScore": 40,
                  "weight": 1
                },
                {
                  "name": "complianceNeed",
                  "label": "Regulatory compliance",
                  "itemScore": 50,
                  "weight": 0.95
                },
                {
                  "name": "lifecycleExtension",
                  "label": "Lifecycle extension",
                  "itemScore": 70,
                  "weight": 0.95
                }
              ]
            },
            {
              "assetId": "12e4dd99-34f9-461c-bd3c-b02c6a10a760",
              "assetName": "Interior doors (chipboard)",
              "tag": "review",
              "score": 53,
              "explanation": "Mixed alignment with your Value Builder strategy. Long-term value ~, Regulatory compliance ~, Lifecycle extension ✓. Worth reviewing whether this fits your priorities.",
              "topDimensions": [
                {
                  "name": "totalValueCreation",
                  "label": "Long-term value",
                  "itemScore": 40,
                  "weight": 1
                },
                {
                  "name": "complianceNeed",
                  "label": "Regulatory compliance",
                  "itemScore": 50,
                  "weight": 0.95
                },
                {
                  "name": "lifecycleExtension",
                  "label": "Lifecycle extension",
                  "itemScore": 70,
                  "weight": 0.95
                }
              ]
            },
            {
              "assetId": "972ca36a-ea0d-4212-9f63-ff32556cac0d",
              "assetName": "Sanitary ceramics (WC/basin)",
              "tag": "review",
              "score": 53,
              "explanation": "Mixed alignment with your Value Builder strategy. Long-term value ~, Regulatory compliance ~, Lifecycle extension ✓. Worth reviewing whether this fits your priorities.",
              "topDimensions": [
                {
                  "name": "totalValueCreation",
                  "label": "Long-term value",
                  "itemScore": 40,
                  "weight": 1
                },
                {
                  "name": "complianceNeed",
                  "label": "Regulatory compliance",
                  "itemScore": 50,
                  "weight": 0.95
                },
                {
                  "name": "lifecycleExtension",
                  "label": "Lifecycle extension",
                  "itemScore": 70,
                  "weight": 0.95
                }
              ]
            },
            {
              "assetId": "91fbe53c-072e-4846-a315-dc430ab0b0a7",
              "assetName": "Insulated windows (PVC/wood)",
              "tag": "review",
              "score": 53,
              "explanation": "Mixed alignment with your Value Builder strategy. Long-term value ~, Regulatory compliance ~, Lifecycle extension ✓. Worth reviewing whether this fits your priorities.",
              "topDimensions": [
                {
                  "name": "totalValueCreation",
                  "label": "Long-term value",
                  "itemScore": 40,
                  "weight": 1
                },
                {
                  "name": "complianceNeed",
                  "label": "Regulatory compliance",
                  "itemScore": 50,
                  "weight": 0.95
                },
                {
                  "name": "lifecycleExtension",
                  "label": "Lifecycle extension",
                  "itemScore": 70,
                  "weight": 0.95
                }
              ]
            },
            {
              "assetId": "929f5bc8-9e3e-4bed-a3ba-9e267296e0e9",
              "assetName": "Bathroom tiles (ceramic)",
              "tag": "review",
              "score": 53,
              "explanation": "Mixed alignment with your Value Builder strategy. Long-term value ~, Regulatory compliance ~, Lifecycle extension ✓. Worth reviewing whether this fits your priorities.",
              "topDimensions": [
                {
                  "name": "totalValueCreation",
                  "label": "Long-term value",
                  "itemScore": 40,
                  "weight": 1
                },
                {
                  "name": "complianceNeed",
                  "label": "Regulatory compliance",
                  "itemScore": 50,
                  "weight": 0.95
                },
                {
                  "name": "lifecycleExtension",
                  "label": "Lifecycle extension",
                  "itemScore": 70,
                  "weight": 0.95
                }
              ]
            },
            {
              "assetId": "fde3d1f3-8cf0-429e-a126-4769e3aabd83",
              "assetName": "Balcony railing (metal)",
              "tag": "low_priority",
              "score": 37,
              "explanation": "Low alignment with your Value Builder priorities. Long-term value ~, Regulatory compliance ✗, Lifecycle extension ~. Consider deferring or finding alternatives.",
              "topDimensions": [
                {
                  "name": "totalValueCreation",
                  "label": "Long-term value",
                  "itemScore": 40,
                  "weight": 1
                },
                {
                  "name": "complianceNeed",
                  "label": "Regulatory compliance",
                  "itemScore": 30,
                  "weight": 0.95
                },
                {
                  "name": "lifecycleExtension",
                  "label": "Lifecycle extension",
                  "itemScore": 40,
                  "weight": 0.95
                }
              ]
            },
            {
              "assetId": "39104edb-59ff-4e29-a920-3dbcd12931b6",
              "assetName": "Kitchen tap",
              "tag": "low_priority",
              "score": 37,
              "explanation": "Low alignment with your Value Builder priorities. Long-term value ~, Regulatory compliance ✗, Lifecycle extension ~. Consider deferring or finding alternatives.",
              "topDimensions": [
                {
                  "name": "totalValueCreation",
                  "label": "Long-term value",
                  "itemScore": 40,
                  "weight": 1
                },
                {
                  "name": "complianceNeed",
                  "label": "Regulatory compliance",
                  "itemScore": 30,
                  "weight": 0.95
                },
                {
                  "name": "lifecycleExtension",
                  "label": "Lifecycle extension",
                  "itemScore": 40,
                  "weight": 0.95
                }
              ]
            },
            {
              "assetId": "1c947ca6-4c0b-4aab-94db-ee298555c5d9",
              "assetName": "Kitchen tap",
              "tag": "low_priority",
              "score": 37,
              "explanation": "Low alignment with your Value Builder priorities. Long-term value ~, Regulatory compliance ✗, Lifecycle extension ~. Consider deferring or finding alternatives.",
              "topDimensions": [
                {
                  "name": "totalValueCreation",
                  "label": "Long-term value",
                  "itemScore": 40,
                  "weight": 1
                },
                {
                  "name": "complianceNeed",
                  "label": "Regulatory compliance",
                  "itemScore": 30,
                  "weight": 0.95
                },
                {
                  "name": "lifecycleExtension",
                  "label": "Lifecycle extension",
                  "itemScore": 40,
                  "weight": 0.95
                }
              ]
            },
            {
              "assetId": "4fc308c1-87b5-403b-9c01-04aae843ac12",
              "assetName": "Insulated windows (PVC/wood)",
              "tag": "low_priority",
              "score": 37,
              "explanation": "Low alignment with your Value Builder priorities. Long-term value ~, Regulatory compliance ✗, Lifecycle extension ~. Consider deferring or finding alternatives.",
              "topDimensions": [
                {
                  "name": "totalValueCreation",
                  "label": "Long-term value",
                  "itemScore": 40,
                  "weight": 1
                },
                {
                  "name": "complianceNeed",
                  "label": "Regulatory compliance",
                  "itemScore": 30,
                  "weight": 0.95
                },
                {
                  "name": "lifecycleExtension",
                  "label": "Lifecycle extension",
                  "itemScore": 40,
                  "weight": 0.95
                }
              ]
            },
            {
              "assetId": "255e76a2-3782-4021-bb89-d96b92fe067b",
              "assetName": "Bathroom tiles (ceramic)",
              "tag": "low_priority",
              "score": 37,
              "explanation": "Low alignment with your Value Builder priorities. Long-term value ~, Regulatory compliance ✗, Lifecycle extension ~. Consider deferring or finding alternatives.",
              "topDimensions": [
                {
                  "name": "totalValueCreation",
                  "label": "Long-term value",
                  "itemScore": 40,
                  "weight": 1
                },
                {
                  "name": "complianceNeed",
                  "label": "Regulatory compliance",
                  "itemScore": 30,
                  "weight": 0.95
                },
                {
                  "name": "lifecycleExtension",
                  "label": "Lifecycle extension",
                  "itemScore": 40,
                  "weight": 0.95
                }
              ]
            },
            {
              "assetId": "309b679c-1e65-43b0-b0cf-ec1d9f1a8f3c",
              "assetName": "Kitchen tiles (ceramic)",
              "tag": "low_priority",
              "score": 37,
              "explanation": "Low alignment with your Value Builder priorities. Long-term value ~, Regulatory compliance ✗, Lifecycle extension ~. Consider deferring or finding alternatives.",
              "topDimensions": [
                {
                  "name": "totalValueCreation",
                  "label": "Long-term value",
                  "itemScore": 40,
                  "weight": 1
                },
                {
                  "name": "complianceNeed",
                  "label": "Regulatory compliance",
                  "itemScore": 30,
                  "weight": 0.95
                },
                {
                  "name": "lifecycleExtension",
                  "label": "Lifecycle extension",
                  "itemScore": 40,
                  "weight": 0.95
                }
              ]
            },
            {
              "assetId": "d8f8237b-331b-4972-b561-7d180851d1d1",
              "assetName": "Wall paint (dispersion)",
              "tag": "low_priority",
              "score": 37,
              "explanation": "Low alignment with your Value Builder priorities. Long-term value ~, Regulatory compliance ✗, Lifecycle extension ~. Consider deferring or finding alternatives.",
              "topDimensions": [
                {
                  "name": "totalValueCreation",
                  "label": "Long-term value",
                  "itemScore": 40,
                  "weight": 1
                },
                {
                  "name": "complianceNeed",
                  "label": "Regulatory compliance",
                  "itemScore": 30,
                  "weight": 0.95
                },
                {
                  "name": "lifecycleExtension",
                  "label": "Lifecycle extension",
                  "itemScore": 40,
                  "weight": 0.95
                }
              ]
            },
            {
              "assetId": "f1427c20-9f61-41d9-b6b2-65d20b47ac90",
              "assetName": "Wall paint (dispersion)",
              "tag": "low_priority",
              "score": 37,
              "explanation": "Low alignment with your Value Builder priorities. Long-term value ~, Regulatory compliance ✗, Lifecycle extension ~. Consider deferring or finding alternatives.",
              "topDimensions": [
                {
                  "name": "totalValueCreation",
                  "label": "Long-term value",
                  "itemScore": 40,
                  "weight": 1
                },
                {
                  "name": "complianceNeed",
                  "label": "Regulatory compliance",
                  "itemScore": 30,
                  "weight": 0.95
                },
                {
                  "name": "lifecycleExtension",
                  "label": "Lifecycle extension",
                  "itemScore": 40,
                  "weight": 0.95
                }
              ]
            },
            {
              "assetId": "13d33401-9fee-4ab3-9075-ee3348807b02",
              "assetName": "Elevator",
              "tag": "low_priority",
              "score": 37,
              "explanation": "Low alignment with your Value Builder priorities. Long-term value ~, Regulatory compliance ✗, Lifecycle extension ~. Consider deferring or finding alternatives.",
              "topDimensions": [
                {
                  "name": "totalValueCreation",
                  "label": "Long-term value",
                  "itemScore": 40,
                  "weight": 1
                },
                {
                  "name": "complianceNeed",
                  "label": "Regulatory compliance",
                  "itemScore": 30,
                  "weight": 0.95
                },
                {
                  "name": "lifecycleExtension",
                  "label": "Lifecycle extension",
                  "itemScore": 40,
                  "weight": 0.95
                }
              ]
            },
            {
              "assetId": "ff5e1e6c-8e96-40fc-a513-344f8d6c5dd7",
              "assetName": "Light switches",
              "tag": "low_priority",
              "score": 37,
              "explanation": "Low alignment with your Value Builder priorities. Long-term value ~, Regulatory compliance ✗, Lifecycle extension ~. Consider deferring or finding alternatives.",
              "topDimensions": [
                {
                  "name": "totalValueCreation",
                  "label": "Long-term value",
                  "itemScore": 40,
                  "weight": 1
                },
                {
                  "name": "complianceNeed",
                  "label": "Regulatory compliance",
                  "itemScore": 30,
                  "weight": 0.95
                },
                {
                  "name": "lifecycleExtension",
                  "label": "Lifecycle extension",
                  "itemScore": 40,
                  "weight": 0.95
                }
              ]
            },
            {
              "assetId": "70f19646-015a-40f4-98ef-c5d46e2a8078",
              "assetName": "Washing machine (common)",
              "tag": "low_priority",
              "score": 37,
              "explanation": "Low alignment with your Value Builder priorities. Long-term value ~, Regulatory compliance ✗, Lifecycle extension ~. Consider deferring or finding alternatives.",
              "topDimensions": [
                {
                  "name": "totalValueCreation",
                  "label": "Long-term value",
                  "itemScore": 40,
                  "weight": 1
                },
                {
                  "name": "complianceNeed",
                  "label": "Regulatory compliance",
                  "itemScore": 30,
                  "weight": 0.95
                },
                {
                  "name": "lifecycleExtension",
                  "label": "Lifecycle extension",
                  "itemScore": 40,
                  "weight": 0.95
                }
              ]
            },
            {
              "assetId": "61b4b99a-503c-483f-9b92-030bca5c7c3e",
              "assetName": "Balcony railing (metal)",
              "tag": "low_priority",
              "score": 37,
              "explanation": "Low alignment with your Value Builder priorities. Long-term value ~, Regulatory compliance ✗, Lifecycle extension ~. Consider deferring or finding alternatives.",
              "topDimensions": [
                {
                  "name": "totalValueCreation",
                  "label": "Long-term value",
                  "itemScore": 40,
                  "weight": 1
                },
                {
                  "name": "complianceNeed",
                  "label": "Regulatory compliance",
                  "itemScore": 30,
                  "weight": 0.95
                },
                {
                  "name": "lifecycleExtension",
                  "label": "Lifecycle extension",
                  "itemScore": 40,
                  "weight": 0.95
                }
              ]
            },
            {
              "assetId": "97af7310-942f-4e83-9e87-40ecd9b0166f",
              "assetName": "Bathtub (acrylic)",
              "tag": "low_priority",
              "score": 37,
              "explanation": "Low alignment with your Value Builder priorities. Long-term value ~, Regulatory compliance ✗, Lifecycle extension ~. Consider deferring or finding alternatives.",
              "topDimensions": [
                {
                  "name": "totalValueCreation",
                  "label": "Long-term value",
                  "itemScore": 40,
                  "weight": 1
                },
                {
                  "name": "complianceNeed",
                  "label": "Regulatory compliance",
                  "itemScore": 30,
                  "weight": 0.95
                },
                {
                  "name": "lifecycleExtension",
                  "label": "Lifecycle extension",
                  "itemScore": 40,
                  "weight": 0.95
                }
              ]
            },
            {
              "assetId": "e288b712-dfa9-439f-a43e-576a95f8a3d8",
              "assetName": "Kitchen cabinets (chipboard)",
              "tag": "low_priority",
              "score": 37,
              "explanation": "Low alignment with your Value Builder priorities. Long-term value ~, Regulatory compliance ✗, Lifecycle extension ~. Consider deferring or finding alternatives.",
              "topDimensions": [
                {
                  "name": "totalValueCreation",
                  "label": "Long-term value",
                  "itemScore": 40,
                  "weight": 1
                },
                {
                  "name": "complianceNeed",
                  "label": "Regulatory compliance",
                  "itemScore": 30,
                  "weight": 0.95
                },
                {
                  "name": "lifecycleExtension",
                  "label": "Lifecycle extension",
                  "itemScore": 40,
                  "weight": 0.95
                }
              ]
            },
            {
              "assetId": "7ab49bfd-389a-40dd-b1d0-60e259d52c50",
              "assetName": "Insulated windows (PVC/wood)",
              "tag": "low_priority",
              "score": 37,
              "explanation": "Low alignment with your Value Builder priorities. Long-term value ~, Regulatory compliance ✗, Lifecycle extension ~. Consider deferring or finding alternatives.",
              "topDimensions": [
                {
                  "name": "totalValueCreation",
                  "label": "Long-term value",
                  "itemScore": 40,
                  "weight": 1
                },
                {
                  "name": "complianceNeed",
                  "label": "Regulatory compliance",
                  "itemScore": 30,
                  "weight": 0.95
                },
                {
                  "name": "lifecycleExtension",
                  "label": "Lifecycle extension",
                  "itemScore": 40,
                  "weight": 0.95
                }
              ]
            },
            {
              "assetId": "e1b21693-e749-4c67-850d-1aa24a1ec5ab",
              "assetName": "Balcony (metal)",
              "tag": "low_priority",
              "score": 37,
              "explanation": "Low alignment with your Value Builder priorities. Long-term value ~, Regulatory compliance ✗, Lifecycle extension ~. Consider deferring or finding alternatives.",
              "topDimensions": [
                {
                  "name": "totalValueCreation",
                  "label": "Long-term value",
                  "itemScore": 40,
                  "weight": 1
                },
                {
                  "name": "complianceNeed",
                  "label": "Regulatory compliance",
                  "itemScore": 30,
                  "weight": 0.95
                },
                {
                  "name": "lifecycleExtension",
                  "label": "Lifecycle extension",
                  "itemScore": 40,
                  "weight": 0.95
                }
              ]
            },
            {
              "assetId": "0e8898a1-d6af-4408-92b2-f7a87d088070",
              "assetName": "Power sockets",
              "tag": "low_priority",
              "score": 37,
              "explanation": "Low alignment with your Value Builder priorities. Long-term value ~, Regulatory compliance ✗, Lifecycle extension ~. Consider deferring or finding alternatives.",
              "topDimensions": [
                {
                  "name": "totalValueCreation",
                  "label": "Long-term value",
                  "itemScore": 40,
                  "weight": 1
                },
                {
                  "name": "complianceNeed",
                  "label": "Regulatory compliance",
                  "itemScore": 30,
                  "weight": 0.95
                },
                {
                  "name": "lifecycleExtension",
                  "label": "Lifecycle extension",
                  "itemScore": 40,
                  "weight": 0.95
                }
              ]
            },
            {
              "assetId": "56be3dfa-c953-4ff4-9e17-d54520df9a4f",
              "assetName": "Balcony railing (metal)",
              "tag": "low_priority",
              "score": 37,
              "explanation": "Low alignment with your Value Builder priorities. Long-term value ~, Regulatory compliance ✗, Lifecycle extension ~. Consider deferring or finding alternatives.",
              "topDimensions": [
                {
                  "name": "totalValueCreation",
                  "label": "Long-term value",
                  "itemScore": 40,
                  "weight": 1
                },
                {
                  "name": "complianceNeed",
                  "label": "Regulatory compliance",
                  "itemScore": 30,
                  "weight": 0.95
                },
                {
                  "name": "lifecycleExtension",
                  "label": "Lifecycle extension",
                  "itemScore": 40,
                  "weight": 0.95
                }
              ]
            },
            {
              "assetId": "977ba0ec-80cb-4ebf-bd58-7316953d0ff4",
              "assetName": "Kitchen worktop (synthetic)",
              "tag": "low_priority",
              "score": 37,
              "explanation": "Low alignment with your Value Builder priorities. Long-term value ~, Regulatory compliance ✗, Lifecycle extension ~. Consider deferring or finding alternatives.",
              "topDimensions": [
                {
                  "name": "totalValueCreation",
                  "label": "Long-term value",
                  "itemScore": 40,
                  "weight": 1
                },
                {
                  "name": "complianceNeed",
                  "label": "Regulatory compliance",
                  "itemScore": 30,
                  "weight": 0.95
                },
                {
                  "name": "lifecycleExtension",
                  "label": "Lifecycle extension",
                  "itemScore": 40,
                  "weight": 0.95
                }
              ]
            },
            {
              "assetId": "368dc6da-c250-4f39-b744-7cc739f47acc",
              "assetName": "Kitchen cabinets (chipboard)",
              "tag": "low_priority",
              "score": 37,
              "explanation": "Low alignment with your Value Builder priorities. Long-term value ~, Regulatory compliance ✗, Lifecycle extension ~. Consider deferring or finding alternatives.",
              "topDimensions": [
                {
                  "name": "totalValueCreation",
                  "label": "Long-term value",
                  "itemScore": 40,
                  "weight": 1
                },
                {
                  "name": "complianceNeed",
                  "label": "Regulatory compliance",
                  "itemScore": 30,
                  "weight": 0.95
                },
                {
                  "name": "lifecycleExtension",
                  "label": "Lifecycle extension",
                  "itemScore": 40,
                  "weight": 0.95
                }
              ]
            },
            {
              "assetId": "40acc2d4-e1e0-440c-a69b-052bb8be5276",
              "assetName": "Kitchen tap",
              "tag": "low_priority",
              "score": 37,
              "explanation": "Low alignment with your Value Builder priorities. Long-term value ~, Regulatory compliance ✗, Lifecycle extension ~. Consider deferring or finding alternatives.",
              "topDimensions": [
                {
                  "name": "totalValueCreation",
                  "label": "Long-term value",
                  "itemScore": 40,
                  "weight": 1
                },
                {
                  "name": "complianceNeed",
                  "label": "Regulatory compliance",
                  "itemScore": 30,
                  "weight": 0.95
                },
                {
                  "name": "lifecycleExtension",
                  "label": "Lifecycle extension",
                  "itemScore": 40,
                  "weight": 0.95
                }
              ]
            },
            {
              "assetId": "27dc96bf-a251-48d1-a6f0-b8278f838542",
              "assetName": "Roller shutters (plastic)",
              "tag": "low_priority",
              "score": 37,
              "explanation": "Low alignment with your Value Builder priorities. Long-term value ~, Regulatory compliance ✗, Lifecycle extension ~. Consider deferring or finding alternatives.",
              "topDimensions": [
                {
                  "name": "totalValueCreation",
                  "label": "Long-term value",
                  "itemScore": 40,
                  "weight": 1
                },
                {
                  "name": "complianceNeed",
                  "label": "Regulatory compliance",
                  "itemScore": 30,
                  "weight": 0.95
                },
                {
                  "name": "lifecycleExtension",
                  "label": "Lifecycle extension",
                  "itemScore": 40,
                  "weight": 0.95
                }
              ]
            },
            {
              "assetId": "bca9bcb5-5ac6-4455-b37b-d47c4c564de7",
              "assetName": "Kitchen tiles (ceramic)",
              "tag": "low_priority",
              "score": 37,
              "explanation": "Low alignment with your Value Builder priorities. Long-term value ~, Regulatory compliance ✗, Lifecycle extension ~. Consider deferring or finding alternatives.",
              "topDimensions": [
                {
                  "name": "totalValueCreation",
                  "label": "Long-term value",
                  "itemScore": 40,
                  "weight": 1
                },
                {
                  "name": "complianceNeed",
                  "label": "Regulatory compliance",
                  "itemScore": 30,
                  "weight": 0.95
                },
                {
                  "name": "lifecycleExtension",
                  "label": "Lifecycle extension",
                  "itemScore": 40,
                  "weight": 0.95
                }
              ]
            },
            {
              "assetId": "3ac3fb53-934a-42ec-a758-d0a63ac1f581",
              "assetName": "Light switches",
              "tag": "low_priority",
              "score": 37,
              "explanation": "Low alignment with your Value Builder priorities. Long-term value ~, Regulatory compliance ✗, Lifecycle extension ~. Consider deferring or finding alternatives.",
              "topDimensions": [
                {
                  "name": "totalValueCreation",
                  "label": "Long-term value",
                  "itemScore": 40,
                  "weight": 1
                },
                {
                  "name": "complianceNeed",
                  "label": "Regulatory compliance",
                  "itemScore": 30,
                  "weight": 0.95
                },
                {
                  "name": "lifecycleExtension",
                  "label": "Lifecycle extension",
                  "itemScore": 40,
                  "weight": 0.95
                }
              ]
            },
            {
              "assetId": "7186a21f-f80e-4eb0-b0ab-6de6d809723f",
              "assetName": "Kitchen worktop (synthetic)",
              "tag": "low_priority",
              "score": 37,
              "explanation": "Low alignment with your Value Builder priorities. Long-term value ~, Regulatory compliance ✗, Lifecycle extension ~. Consider deferring or finding alternatives.",
              "topDimensions": [
                {
                  "name": "totalValueCreation",
                  "label": "Long-term value",
                  "itemScore": 40,
                  "weight": 1
                },
                {
                  "name": "complianceNeed",
                  "label": "Regulatory compliance",
                  "itemScore": 30,
                  "weight": 0.95
                },
                {
                  "name": "lifecycleExtension",
                  "label": "Lifecycle extension",
                  "itemScore": 40,
                  "weight": 0.95
                }
              ]
            },
            {
              "assetId": "d606cf41-eb4a-42fe-ad1c-2acf39a9a4aa",
              "assetName": "Roller shutters (plastic)",
              "tag": "low_priority",
              "score": 37,
              "explanation": "Low alignment with your Value Builder priorities. Long-term value ~, Regulatory compliance ✗, Lifecycle extension ~. Consider deferring or finding alternatives.",
              "topDimensions": [
                {
                  "name": "totalValueCreation",
                  "label": "Long-term value",
                  "itemScore": 40,
                  "weight": 1
                },
                {
                  "name": "complianceNeed",
                  "label": "Regulatory compliance",
                  "itemScore": 30,
                  "weight": 0.95
                },
                {
                  "name": "lifecycleExtension",
                  "label": "Lifecycle extension",
                  "itemScore": 40,
                  "weight": 0.95
                }
              ]
            },
            {
              "assetId": "12bf1e5b-d6d4-423b-b295-851ed9ac5509",
              "assetName": "Parquet flooring (mosaic)",
              "tag": "low_priority",
              "score": 37,
              "explanation": "Low alignment with your Value Builder priorities. Long-term value ~, Regulatory compliance ✗, Lifecycle extension ~. Consider deferring or finding alternatives.",
              "topDimensions": [
                {
                  "name": "totalValueCreation",
                  "label": "Long-term value",
                  "itemScore": 40,
                  "weight": 1
                },
                {
                  "name": "complianceNeed",
                  "label": "Regulatory compliance",
                  "itemScore": 30,
                  "weight": 0.95
                },
                {
                  "name": "lifecycleExtension",
                  "label": "Lifecycle extension",
                  "itemScore": 40,
                  "weight": 0.95
                }
              ]
            },
            {
              "assetId": "ffa81f1d-937f-4fd8-b1e4-f3507883d1b6",
              "assetName": "Parquet flooring (mosaic)",
              "tag": "low_priority",
              "score": 37,
              "explanation": "Low alignment with your Value Builder priorities. Long-term value ~, Regulatory compliance ✗, Lifecycle extension ~. Consider deferring or finding alternatives.",
              "topDimensions": [
                {
                  "name": "totalValueCreation",
                  "label": "Long-term value",
                  "itemScore": 40,
                  "weight": 1
                },
                {
                  "name": "complianceNeed",
                  "label": "Regulatory compliance",
                  "itemScore": 30,
                  "weight": 0.95
                },
                {
                  "name": "lifecycleExtension",
                  "label": "Lifecycle extension",
                  "itemScore": 40,
                  "weight": 0.95
                }
              ]
            },
            {
              "assetId": "8adb5bf1-0108-4800-baf2-21319f55b8f6",
              "assetName": "Balcony (metal)",
              "tag": "low_priority",
              "score": 37,
              "explanation": "Low alignment with your Value Builder priorities. Long-term value ~, Regulatory compliance ✗, Lifecycle extension ~. Consider deferring or finding alternatives.",
              "topDimensions": [
                {
                  "name": "totalValueCreation",
                  "label": "Long-term value",
                  "itemScore": 40,
                  "weight": 1
                },
                {
                  "name": "complianceNeed",
                  "label": "Regulatory compliance",
                  "itemScore": 30,
                  "weight": 0.95
                },
                {
                  "name": "lifecycleExtension",
                  "label": "Lifecycle extension",
                  "itemScore": 40,
                  "weight": 0.95
                }
              ]
            },
            {
              "assetId": "0b241cab-2a05-4239-9acc-c45ca3700356",
              "assetName": "Power sockets",
              "tag": "low_priority",
              "score": 37,
              "explanation": "Low alignment with your Value Builder priorities. Long-term value ~, Regulatory compliance ✗, Lifecycle extension ~. Consider deferring or finding alternatives.",
              "topDimensions": [
                {
                  "name": "totalValueCreation",
                  "label": "Long-term value",
                  "itemScore": 40,
                  "weight": 1
                },
                {
                  "name": "complianceNeed",
                  "label": "Regulatory compliance",
                  "itemScore": 30,
                  "weight": 0.95
                },
                {
                  "name": "lifecycleExtension",
                  "label": "Lifecycle extension",
                  "itemScore": 40,
                  "weight": 0.95
                }
              ]
            },
            {
              "assetId": "cfb4e000-1ba2-4880-ab1b-bbc8fbe65a48",
              "assetName": "Light switches",
              "tag": "low_priority",
              "score": 37,
              "explanation": "Low alignment with your Value Builder priorities. Long-term value ~, Regulatory compliance ✗, Lifecycle extension ~. Consider deferring or finding alternatives.",
              "topDimensions": [
                {
                  "name": "totalValueCreation",
                  "label": "Long-term value",
                  "itemScore": 40,
                  "weight": 1
                },
                {
                  "name": "complianceNeed",
                  "label": "Regulatory compliance",
                  "itemScore": 30,
                  "weight": 0.95
                },
                {
                  "name": "lifecycleExtension",
                  "label": "Lifecycle extension",
                  "itemScore": 40,
                  "weight": 0.95
                }
              ]
            },
            {
              "assetId": "26e2009f-0b98-4ff6-853c-39a1cdb2643c",
              "assetName": "Light switches",
              "tag": "low_priority",
              "score": 37,
              "explanation": "Low alignment with your Value Builder priorities. Long-term value ~, Regulatory compliance ✗, Lifecycle extension ~. Consider deferring or finding alternatives.",
              "topDimensions": [
                {
                  "name": "totalValueCreation",
                  "label": "Long-term value",
                  "itemScore": 40,
                  "weight": 1
                },
                {
                  "name": "complianceNeed",
                  "label": "Regulatory compliance",
                  "itemScore": 30,
                  "weight": 0.95
                },
                {
                  "name": "lifecycleExtension",
                  "label": "Lifecycle extension",
                  "itemScore": 40,
                  "weight": 0.95
                }
              ]
            },
            {
              "assetId": "ee2cb058-ba5a-4d57-bcec-0602ab768fe3",
              "assetName": "Bathroom tap",
              "tag": "low_priority",
              "score": 37,
              "explanation": "Low alignment with your Value Builder priorities. Long-term value ~, Regulatory compliance ✗, Lifecycle extension ~. Consider deferring or finding alternatives.",
              "topDimensions": [
                {
                  "name": "totalValueCreation",
                  "label": "Long-term value",
                  "itemScore": 40,
                  "weight": 1
                },
                {
                  "name": "complianceNeed",
                  "label": "Regulatory compliance",
                  "itemScore": 30,
                  "weight": 0.95
                },
                {
                  "name": "lifecycleExtension",
                  "label": "Lifecycle extension",
                  "itemScore": 40,
                  "weight": 0.95
                }
              ]
            },
            {
              "assetId": "442df839-889a-4021-9ac6-6058752873a5",
              "assetName": "Kitchen worktop (synthetic)",
              "tag": "low_priority",
              "score": 37,
              "explanation": "Low alignment with your Value Builder priorities. Long-term value ~, Regulatory compliance ✗, Lifecycle extension ~. Consider deferring or finding alternatives.",
              "topDimensions": [
                {
                  "name": "totalValueCreation",
                  "label": "Long-term value",
                  "itemScore": 40,
                  "weight": 1
                },
                {
                  "name": "complianceNeed",
                  "label": "Regulatory compliance",
                  "itemScore": 30,
                  "weight": 0.95
                },
                {
                  "name": "lifecycleExtension",
                  "label": "Lifecycle extension",
                  "itemScore": 40,
                  "weight": 0.95
                }
              ]
            },
            {
              "assetId": "15273640-7a79-4d32-94a7-71539bf1f86d",
              "assetName": "Kitchen cabinets (chipboard)",
              "tag": "low_priority",
              "score": 37,
              "explanation": "Low alignment with your Value Builder priorities. Long-term value ~, Regulatory compliance ✗, Lifecycle extension ~. Consider deferring or finding alternatives.",
              "topDimensions": [
                {
                  "name": "totalValueCreation",
                  "label": "Long-term value",
                  "itemScore": 40,
                  "weight": 1
                },
                {
                  "name": "complianceNeed",
                  "label": "Regulatory compliance",
                  "itemScore": 30,
                  "weight": 0.95
                },
                {
                  "name": "lifecycleExtension",
                  "label": "Lifecycle extension",
                  "itemScore": 40,
                  "weight": 0.95
                }
              ]
            },
            {
              "assetId": "873afa78-0b19-4d30-be5b-c3bf599135ee",
              "assetName": "Sanitary ceramics (WC/basin)",
              "tag": "low_priority",
              "score": 37,
              "explanation": "Low alignment with your Value Builder priorities. Long-term value ~, Regulatory compliance ✗, Lifecycle extension ~. Consider deferring or finding alternatives.",
              "topDimensions": [
                {
                  "name": "totalValueCreation",
                  "label": "Long-term value",
                  "itemScore": 40,
                  "weight": 1
                },
                {
                  "name": "complianceNeed",
                  "label": "Regulatory compliance",
                  "itemScore": 30,
                  "weight": 0.95
                },
                {
                  "name": "lifecycleExtension",
                  "label": "Lifecycle extension",
                  "itemScore": 40,
                  "weight": 0.95
                }
              ]
            },
            {
              "assetId": "906b22fb-ca51-4603-9ab0-7aa09e759957",
              "assetName": "Sanitary ceramics (WC/basin)",
              "tag": "low_priority",
              "score": 37,
              "explanation": "Low alignment with your Value Builder priorities. Long-term value ~, Regulatory compliance ✗, Lifecycle extension ~. Consider deferring or finding alternatives.",
              "topDimensions": [
                {
                  "name": "totalValueCreation",
                  "label": "Long-term value",
                  "itemScore": 40,
                  "weight": 1
                },
                {
                  "name": "complianceNeed",
                  "label": "Regulatory compliance",
                  "itemScore": 30,
                  "weight": 0.95
                },
                {
                  "name": "lifecycleExtension",
                  "label": "Lifecycle extension",
                  "itemScore": 40,
                  "weight": 0.95
                }
              ]
            },
            {
              "assetId": "02c552c9-422b-4350-ab98-38c2e32bfafd",
              "assetName": "Power sockets",
              "tag": "low_priority",
              "score": 37,
              "explanation": "Low alignment with your Value Builder priorities. Long-term value ~, Regulatory compliance ✗, Lifecycle extension ~. Consider deferring or finding alternatives.",
              "topDimensions": [
                {
                  "name": "totalValueCreation",
                  "label": "Long-term value",
                  "itemScore": 40,
                  "weight": 1
                },
                {
                  "name": "complianceNeed",
                  "label": "Regulatory compliance",
                  "itemScore": 30,
                  "weight": 0.95
                },
                {
                  "name": "lifecycleExtension",
                  "label": "Lifecycle extension",
                  "itemScore": 40,
                  "weight": 0.95
                }
              ]
            }
          ]
        }
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
          "roleIntent": "reposition",
          "recommendedScenario": "invest",
          "rationale": "Value-builder profile — full investment on schedule maximises long-term equity and NPV."
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
            "id": "182ed4b0-8d10-4e14-81fc-1d3c2088ef43",
            "kind": "invoice",
            "date": "2025-09-17",
            "vendor": "Sanitaires Perret SA",
            "description": "Sanitaires Perret SA / Détartrage chauffe-eau",
            "accountCode": "61200",
            "accountName": "Entretien des appartements",
            "reference": null,
            "amountCents": 39000,
            "invoiceId": "182ed4b0-8d10-4e14-81fc-1d3c2088ef43"
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
            "id": "4a62cc17-3344-446a-9dd1-2a0f347359ae",
            "kind": "invoice",
            "date": "2025-02-11",
            "vendor": "Sanitaires Perret SA",
            "description": "Sanitaires Perret SA / Remplacement mitigeur cuisine",
            "accountCode": "61200",
            "accountName": "Entretien des appartements",
            "reference": null,
            "amountCents": 68000,
            "invoiceId": "4a62cc17-3344-446a-9dd1-2a0f347359ae"
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
            "id": "7091180c-a943-4996-af94-50e47a8e5fff",
            "kind": "invoice",
            "date": "2025-05-22",
            "vendor": "ACE Électroménager",
            "description": "ACE Électroménager / Réparation lave-vaisselle",
            "accountCode": "61200",
            "accountName": "Entretien des appartements",
            "reference": null,
            "amountCents": 54000,
            "invoiceId": "7091180c-a943-4996-af94-50e47a8e5fff"
          }
        ]
      }
    },
    "/units/demo-unit-0006/condition-reports": {
      "data": [
        {
          "id": "111afb64-8735-4ea7-a7c7-11f3924744a9",
          "type": "MOVE_IN",
          "status": "APPROVED",
          "dueAt": null,
          "submittedAt": "2024-09-08T00:00:00.000Z",
          "approvedAt": "2024-09-08T00:00:00.000Z",
          "itemCount": 4,
          "tenant": {
            "id": "10da3f2f-55dc-45c8-b767-fcdc822c4972",
            "name": "ROSSI Giulia"
          },
          "createdAt": "2026-09-08T12:57:03.626Z"
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
            "id": "716d254e-8ea4-43ec-a6d2-64e2d33eb011",
            "kind": "invoice",
            "date": "2025-11-26",
            "vendor": "Vitrerie Genevoise",
            "description": "Vitrerie Genevoise / Remplacement double vitrage",
            "accountCode": "61200",
            "accountName": "Entretien des appartements",
            "reference": null,
            "amountCents": 118000,
            "invoiceId": "716d254e-8ea4-43ec-a6d2-64e2d33eb011"
          }
        ]
      }
    },
    "/units/demo-unit-0008/condition-reports": {
      "data": [
        {
          "id": "addd7e5c-b599-4e42-b074-13200f4c94e7",
          "type": "MOVE_OUT",
          "status": "APPROVED",
          "dueAt": null,
          "submittedAt": "2025-09-08T00:00:00.000Z",
          "approvedAt": "2025-09-08T00:00:00.000Z",
          "itemCount": 4,
          "tenant": {
            "id": "64bf4856-a161-48e7-b20c-cdc3bd0d25fd",
            "name": "PERRET Claude"
          },
          "createdAt": "2026-09-08T12:57:03.618Z"
        }
      ]
    },
    "/units/demo-unit-0008/expense-lines": {
      "data": {
        "unitId": "demo-unit-0008",
        "totalCents": 425000,
        "lines": [
          {
            "id": "338fd38b-16c8-49fd-b9c2-1f09324961eb",
            "kind": "invoice",
            "date": "2025-07-09",
            "vendor": "Peinture Dubois",
            "description": "Peinture Dubois / Remise en état après départ",
            "accountCode": "61200",
            "accountName": "Entretien des appartements",
            "reference": null,
            "amountCents": 425000,
            "invoiceId": "338fd38b-16c8-49fd-b9c2-1f09324961eb"
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
                  "assetId": "b69ee2a2-213e-4b22-b601-ab857ec7c1d6",
                  "unitId": "demo-unit-0003",
                  "label": "Insulated windows (PVC/wood) — 0003",
                  "costChf": 1100,
                  "annualUpliftChf": 22,
                  "deltaValueChf": 715,
                  "marginalYieldPct": 3.08,
                  "accretive": true
                },
                {
                  "assetId": "810ba743-1a27-48fe-b326-33183f74754b",
                  "unitId": "demo-unit-0005",
                  "label": "Parquet flooring (mosaic) — 0005",
                  "costChf": 3500,
                  "annualUpliftChf": 43.75,
                  "deltaValueChf": 2275,
                  "marginalYieldPct": 1.92,
                  "accretive": false
                },
                {
                  "assetId": "a0345d17-a405-4bab-a0e9-117c91256a37",
                  "unitId": "demo-unit-0008",
                  "label": "Kitchen cabinets (chipboard) — 0008",
                  "costChf": 4500,
                  "annualUpliftChf": 150,
                  "deltaValueChf": 2925,
                  "marginalYieldPct": 5.13,
                  "accretive": true
                },
                {
                  "assetId": "aa1e5f48-3995-4414-905f-eafe6207ea12",
                  "unitId": "demo-unit-0003",
                  "label": "Kitchen cabinets (chipboard) — 0003",
                  "costChf": 4500,
                  "annualUpliftChf": 150,
                  "deltaValueChf": 2925,
                  "marginalYieldPct": 5.13,
                  "accretive": true
                },
                {
                  "assetId": "40a31223-d8f1-41a2-964d-853c62365f4c",
                  "unitId": "demo-unit-0006",
                  "label": "Interior doors (chipboard) — 0006",
                  "costChf": 450,
                  "annualUpliftChf": 9,
                  "deltaValueChf": 292.5,
                  "marginalYieldPct": 3.08,
                  "accretive": true
                },
                {
                  "assetId": "8c0c1cd8-d2a9-4370-8f2e-4715f2461451",
                  "unitId": "demo-unit-0006",
                  "label": "Roller shutters (plastic) — 0006",
                  "costChf": 550,
                  "annualUpliftChf": 13.75,
                  "deltaValueChf": 357.5,
                  "marginalYieldPct": 3.85,
                  "accretive": true
                },
                {
                  "assetId": "b2487276-dd27-46e9-a9f8-5d6a0171ae2d",
                  "unitId": "demo-unit-0006",
                  "label": "Wall paint (dispersion) — 0006",
                  "costChf": 2200,
                  "annualUpliftChf": 137.5,
                  "deltaValueChf": 1430,
                  "marginalYieldPct": 9.62,
                  "accretive": true
                },
                {
                  "assetId": "b7a27822-5660-4d4a-aebc-4e54c1970386",
                  "unitId": "demo-unit-0008",
                  "label": "Power sockets — 0008",
                  "costChf": 130,
                  "annualUpliftChf": 4.33,
                  "deltaValueChf": 84.5,
                  "marginalYieldPct": 5.13,
                  "accretive": true
                },
                {
                  "assetId": "63a9b2bb-ec4f-4b71-9538-e606b7f80070",
                  "unitId": "demo-unit-0001",
                  "label": "Kitchen tap — 0001",
                  "costChf": 400,
                  "annualUpliftChf": 10,
                  "deltaValueChf": 260,
                  "marginalYieldPct": 3.85,
                  "accretive": true
                },
                {
                  "assetId": "1dff6cb4-1f36-49d0-a049-79d32dd344eb",
                  "unitId": "demo-unit-0002",
                  "label": "Power sockets — 0002",
                  "costChf": 130,
                  "annualUpliftChf": 4.33,
                  "deltaValueChf": 84.5,
                  "marginalYieldPct": 5.13,
                  "accretive": true
                },
                {
                  "assetId": "760e2773-ab88-408a-a0a2-b9b271c9b84d",
                  "unitId": "demo-unit-0005",
                  "label": "Bathroom tap — 0005",
                  "costChf": 400,
                  "annualUpliftChf": 10,
                  "deltaValueChf": 260,
                  "marginalYieldPct": 3.85,
                  "accretive": true
                },
                {
                  "assetId": "6004c6f3-e2f1-4ead-b1be-4e6fc91521bb",
                  "unitId": "demo-unit-0002",
                  "label": "Kitchen worktop (synthetic) — 0002",
                  "costChf": 1200,
                  "annualUpliftChf": 40,
                  "deltaValueChf": 780,
                  "marginalYieldPct": 5.13,
                  "accretive": true
                },
                {
                  "assetId": "f6a01996-4f9c-46a7-86ac-cc5b19fc88b9",
                  "unitId": "demo-unit-0003",
                  "label": "Bathroom tap — 0003",
                  "costChf": 400,
                  "annualUpliftChf": 10,
                  "deltaValueChf": 260,
                  "marginalYieldPct": 3.85,
                  "accretive": true
                },
                {
                  "assetId": "38f106c6-440d-4799-bffa-00c2daeae3e6",
                  "unitId": "demo-unit-0004",
                  "label": "Roller shutters (plastic) — 0004",
                  "costChf": 550,
                  "annualUpliftChf": 13.75,
                  "deltaValueChf": 357.5,
                  "marginalYieldPct": 3.85,
                  "accretive": true
                },
                {
                  "assetId": "9154bb61-a9ee-477a-9db4-87697de4b73d",
                  "unitId": "demo-unit-0004",
                  "label": "Wall paint (dispersion) — 0004",
                  "costChf": 2200,
                  "annualUpliftChf": 137.5,
                  "deltaValueChf": 1430,
                  "marginalYieldPct": 9.62,
                  "accretive": true
                },
                {
                  "assetId": "70eff972-0eb2-468e-85b2-97c17f1bad8f",
                  "unitId": "demo-unit-0005",
                  "label": "Light switches — 0005",
                  "costChf": 70,
                  "annualUpliftChf": 2.33,
                  "deltaValueChf": 45.5,
                  "marginalYieldPct": 5.13,
                  "accretive": true
                },
                {
                  "assetId": "972ca36a-ea0d-4212-9f63-ff32556cac0d",
                  "unitId": "demo-unit-0007",
                  "label": "Sanitary ceramics (WC/basin) — 0007",
                  "costChf": 1200,
                  "annualUpliftChf": 17.14,
                  "deltaValueChf": 780,
                  "marginalYieldPct": 2.2,
                  "accretive": false
                },
                {
                  "assetId": "ad578c8d-179f-437a-84ce-d9dd16a55b03",
                  "unitId": "demo-unit-0008",
                  "label": "Balcony railing (metal) — 0008",
                  "costChf": 800,
                  "annualUpliftChf": 13.33,
                  "deltaValueChf": 520,
                  "marginalYieldPct": 2.56,
                  "accretive": false
                },
                {
                  "assetId": "929f5bc8-9e3e-4bed-a3ba-9e267296e0e9",
                  "unitId": "demo-unit-0008",
                  "label": "Bathroom tiles (ceramic) — 0008",
                  "costChf": 2200,
                  "annualUpliftChf": 36.67,
                  "deltaValueChf": 1430,
                  "marginalYieldPct": 2.56,
                  "accretive": false
                },
                {
                  "assetId": "10e11f5d-059b-44f0-b3bc-1ed7b1137c33",
                  "unitId": "demo-unit-0001",
                  "label": "Kitchen worktop (synthetic) — 0001",
                  "costChf": 1200,
                  "annualUpliftChf": 40,
                  "deltaValueChf": 780,
                  "marginalYieldPct": 5.13,
                  "accretive": true
                },
                {
                  "assetId": "91fbe53c-072e-4846-a315-dc430ab0b0a7",
                  "unitId": "demo-unit-0001",
                  "label": "Insulated windows (PVC/wood) — 0001",
                  "costChf": 1100,
                  "annualUpliftChf": 22,
                  "deltaValueChf": 715,
                  "marginalYieldPct": 3.08,
                  "accretive": true
                },
                {
                  "assetId": "055418f0-43c5-481d-9225-aba3bd6babc9",
                  "unitId": "demo-unit-0002",
                  "label": "Bathtub (acrylic) — 0002",
                  "costChf": 900,
                  "annualUpliftChf": 18,
                  "deltaValueChf": 585,
                  "marginalYieldPct": 3.08,
                  "accretive": true
                },
                {
                  "assetId": "226e8a03-9daa-4560-802c-ff48b1d3eed7",
                  "unitId": "demo-unit-0003",
                  "label": "Roller shutters (plastic) — 0003",
                  "costChf": 550,
                  "annualUpliftChf": 13.75,
                  "deltaValueChf": 357.5,
                  "marginalYieldPct": 3.85,
                  "accretive": true
                },
                {
                  "assetId": "85ff6500-271b-414f-a194-d71ba536c327",
                  "unitId": "demo-unit-0003",
                  "label": "Wall paint (dispersion) — 0003",
                  "costChf": 2200,
                  "annualUpliftChf": 137.5,
                  "deltaValueChf": 1430,
                  "marginalYieldPct": 9.62,
                  "accretive": true
                },
                {
                  "assetId": "8af96294-0bc0-43d7-9768-c1952c0ecda6",
                  "unitId": "demo-unit-0003",
                  "label": "Power sockets — 0003",
                  "costChf": 130,
                  "annualUpliftChf": 4.33,
                  "deltaValueChf": 84.5,
                  "marginalYieldPct": 5.13,
                  "accretive": true
                },
                {
                  "assetId": "8512137c-9252-46b1-af45-4769b43114e0",
                  "unitId": "demo-unit-0006",
                  "label": "Bathroom tap — 0006",
                  "costChf": 400,
                  "annualUpliftChf": 10,
                  "deltaValueChf": 260,
                  "marginalYieldPct": 3.85,
                  "accretive": true
                },
                {
                  "assetId": "506eaef0-8daa-4ed6-8d40-f83820bac2bf",
                  "unitId": "demo-unit-0006",
                  "label": "Bathtub (acrylic) — 0006",
                  "costChf": 900,
                  "annualUpliftChf": 18,
                  "deltaValueChf": 585,
                  "marginalYieldPct": 3.08,
                  "accretive": true
                },
                {
                  "assetId": "3a33e13f-367b-4a81-8808-260b8607f4b5",
                  "unitId": "demo-unit-0006",
                  "label": "Kitchen tap — 0006",
                  "costChf": 400,
                  "annualUpliftChf": 10,
                  "deltaValueChf": 260,
                  "marginalYieldPct": 3.85,
                  "accretive": true
                },
                {
                  "assetId": "76504672-e5fe-434a-a9e8-502fdab4da87",
                  "unitId": "demo-unit-0006",
                  "label": "Light switches — 0006",
                  "costChf": 70,
                  "annualUpliftChf": 2.33,
                  "deltaValueChf": 45.5,
                  "marginalYieldPct": 5.13,
                  "accretive": true
                },
                {
                  "assetId": "12e4dd99-34f9-461c-bd3c-b02c6a10a760",
                  "unitId": "demo-unit-0007",
                  "label": "Interior doors (chipboard) — 0007",
                  "costChf": 450,
                  "annualUpliftChf": 9,
                  "deltaValueChf": 292.5,
                  "marginalYieldPct": 3.08,
                  "accretive": true
                },
                {
                  "assetId": "255e76a2-3782-4021-bb89-d96b92fe067b",
                  "unitId": "demo-unit-0007",
                  "label": "Bathroom tiles (ceramic) — 0007",
                  "costChf": 2200,
                  "annualUpliftChf": 36.67,
                  "deltaValueChf": 1430,
                  "marginalYieldPct": 2.56,
                  "accretive": false
                },
                {
                  "assetId": "e1b21693-e749-4c67-850d-1aa24a1ec5ab",
                  "unitId": "demo-unit-0008",
                  "label": "Balcony (metal) — 0008",
                  "costChf": 4500,
                  "annualUpliftChf": 56.25,
                  "deltaValueChf": 2925,
                  "marginalYieldPct": 1.92,
                  "accretive": false
                },
                {
                  "assetId": "309b679c-1e65-43b0-b0cf-ec1d9f1a8f3c",
                  "unitId": "demo-unit-0001",
                  "label": "Kitchen tiles (ceramic) — 0001",
                  "costChf": 1600,
                  "annualUpliftChf": 26.67,
                  "deltaValueChf": 1040,
                  "marginalYieldPct": 2.56,
                  "accretive": false
                },
                {
                  "assetId": "fde3d1f3-8cf0-429e-a126-4769e3aabd83",
                  "unitId": "demo-unit-0003",
                  "label": "Balcony railing (metal) — 0003",
                  "costChf": 800,
                  "annualUpliftChf": 13.33,
                  "deltaValueChf": 520,
                  "marginalYieldPct": 2.56,
                  "accretive": false
                },
                {
                  "assetId": "c86bd441-9757-4625-98f9-b6506982c547",
                  "unitId": "demo-unit-0003",
                  "label": "Kitchen worktop (synthetic) — 0003",
                  "costChf": 1200,
                  "annualUpliftChf": 40,
                  "deltaValueChf": 780,
                  "marginalYieldPct": 5.13,
                  "accretive": true
                },
                {
                  "assetId": "36ae25f1-e8a1-4b0a-bd60-aebd88e65167",
                  "unitId": "demo-unit-0006",
                  "label": "Kitchen cabinets (chipboard) — 0006",
                  "costChf": 4500,
                  "annualUpliftChf": 150,
                  "deltaValueChf": 2925,
                  "marginalYieldPct": 5.13,
                  "accretive": true
                },
                {
                  "assetId": "11866cc2-d29a-4175-8b0d-5e60f1c5f64a",
                  "unitId": "demo-unit-0007",
                  "label": "Roller shutters (plastic) — 0007",
                  "costChf": 550,
                  "annualUpliftChf": 13.75,
                  "deltaValueChf": 357.5,
                  "marginalYieldPct": 3.85,
                  "accretive": true
                },
                {
                  "assetId": "c75ab1a7-afb4-43b8-a082-9a5f3e4e2440",
                  "unitId": "demo-unit-0007",
                  "label": "Wall paint (dispersion) — 0007",
                  "costChf": 2200,
                  "annualUpliftChf": 137.5,
                  "deltaValueChf": 1430,
                  "marginalYieldPct": 9.62,
                  "accretive": true
                },
                {
                  "assetId": "5a2c90fa-661f-4af6-aec3-7f31e9003b48",
                  "unitId": "demo-unit-0008",
                  "label": "Bathroom tap — 0008",
                  "costChf": 400,
                  "annualUpliftChf": 10,
                  "deltaValueChf": 260,
                  "marginalYieldPct": 3.85,
                  "accretive": true
                },
                {
                  "assetId": "8adb5bf1-0108-4800-baf2-21319f55b8f6",
                  "unitId": "demo-unit-0001",
                  "label": "Balcony (metal) — 0001",
                  "costChf": 4500,
                  "annualUpliftChf": 56.25,
                  "deltaValueChf": 2925,
                  "marginalYieldPct": 1.92,
                  "accretive": false
                },
                {
                  "assetId": "12bf1e5b-d6d4-423b-b295-851ed9ac5509",
                  "unitId": "demo-unit-0002",
                  "label": "Parquet flooring (mosaic) — 0002",
                  "costChf": 3500,
                  "annualUpliftChf": 43.75,
                  "deltaValueChf": 2275,
                  "marginalYieldPct": 1.92,
                  "accretive": false
                },
                {
                  "assetId": "61b4b99a-503c-483f-9b92-030bca5c7c3e",
                  "unitId": "demo-unit-0004",
                  "label": "Balcony railing (metal) — 0004",
                  "costChf": 800,
                  "annualUpliftChf": 13.33,
                  "deltaValueChf": 520,
                  "marginalYieldPct": 2.56,
                  "accretive": false
                },
                {
                  "assetId": "04469e50-2abf-4b7b-ac10-eeb4633a14ce",
                  "unitId": "demo-unit-0005",
                  "label": "Kitchen cabinets (chipboard) — 0005",
                  "costChf": 4500,
                  "annualUpliftChf": 150,
                  "deltaValueChf": 2925,
                  "marginalYieldPct": 5.13,
                  "accretive": true
                },
                {
                  "assetId": "4fc308c1-87b5-403b-9c01-04aae843ac12",
                  "unitId": "demo-unit-0006",
                  "label": "Insulated windows (PVC/wood) — 0006",
                  "costChf": 1100,
                  "annualUpliftChf": 22,
                  "deltaValueChf": 715,
                  "marginalYieldPct": 3.08,
                  "accretive": true
                },
                {
                  "assetId": "07a85932-f5dc-4dae-8ee3-178169da0058",
                  "unitId": "demo-unit-0007",
                  "label": "Bathroom tap — 0007",
                  "costChf": 400,
                  "annualUpliftChf": 10,
                  "deltaValueChf": 260,
                  "marginalYieldPct": 3.85,
                  "accretive": true
                },
                {
                  "assetId": "ffa81f1d-937f-4fd8-b1e4-f3507883d1b6",
                  "unitId": "demo-unit-0008",
                  "label": "Parquet flooring (mosaic) — 0008",
                  "costChf": 3500,
                  "annualUpliftChf": 43.75,
                  "deltaValueChf": 2275,
                  "marginalYieldPct": 1.92,
                  "accretive": false
                },
                {
                  "assetId": "56be3dfa-c953-4ff4-9e17-d54520df9a4f",
                  "unitId": "demo-unit-0001",
                  "label": "Balcony railing (metal) — 0001",
                  "costChf": 800,
                  "annualUpliftChf": 13.33,
                  "deltaValueChf": 520,
                  "marginalYieldPct": 2.56,
                  "accretive": false
                },
                {
                  "assetId": "97af7310-942f-4e83-9e87-40ecd9b0166f",
                  "unitId": "demo-unit-0004",
                  "label": "Bathtub (acrylic) — 0004",
                  "costChf": 900,
                  "annualUpliftChf": 18,
                  "deltaValueChf": 585,
                  "marginalYieldPct": 3.08,
                  "accretive": true
                },
                {
                  "assetId": "1c947ca6-4c0b-4aab-94db-ee298555c5d9",
                  "unitId": "demo-unit-0004",
                  "label": "Kitchen tap — 0004",
                  "costChf": 400,
                  "annualUpliftChf": 10,
                  "deltaValueChf": 260,
                  "marginalYieldPct": 3.85,
                  "accretive": true
                },
                {
                  "assetId": "bca9bcb5-5ac6-4455-b37b-d47c4c564de7",
                  "unitId": "demo-unit-0005",
                  "label": "Kitchen tiles (ceramic) — 0005",
                  "costChf": 1600,
                  "annualUpliftChf": 26.67,
                  "deltaValueChf": 1040,
                  "marginalYieldPct": 2.56,
                  "accretive": false
                },
                {
                  "assetId": "873afa78-0b19-4d30-be5b-c3bf599135ee",
                  "unitId": "demo-unit-0006",
                  "label": "Sanitary ceramics (WC/basin) — 0006",
                  "costChf": 1200,
                  "annualUpliftChf": 17.14,
                  "deltaValueChf": 780,
                  "marginalYieldPct": 2.2,
                  "accretive": false
                },
                {
                  "assetId": "7ab49bfd-389a-40dd-b1d0-60e259d52c50",
                  "unitId": "demo-unit-0007",
                  "label": "Insulated windows (PVC/wood) — 0007",
                  "costChf": 1100,
                  "annualUpliftChf": 22,
                  "deltaValueChf": 715,
                  "marginalYieldPct": 3.08,
                  "accretive": true
                },
                {
                  "assetId": "51547374-27b8-4836-929a-15fc1f3bf5fc",
                  "unitId": "demo-unit-0007",
                  "label": "Power sockets — 0007",
                  "costChf": 130,
                  "annualUpliftChf": 4.33,
                  "deltaValueChf": 84.5,
                  "marginalYieldPct": 5.13,
                  "accretive": true
                },
                {
                  "assetId": "39104edb-59ff-4e29-a920-3dbcd12931b6",
                  "unitId": "demo-unit-0008",
                  "label": "Kitchen tap — 0008",
                  "costChf": 400,
                  "annualUpliftChf": 10,
                  "deltaValueChf": 260,
                  "marginalYieldPct": 3.85,
                  "accretive": true
                },
                {
                  "assetId": "906b22fb-ca51-4603-9ab0-7aa09e759957",
                  "unitId": "demo-unit-0008",
                  "label": "Sanitary ceramics (WC/basin) — 0008",
                  "costChf": 1200,
                  "annualUpliftChf": 17.14,
                  "deltaValueChf": 780,
                  "marginalYieldPct": 2.2,
                  "accretive": false
                }
              ],
              "accretiveCount": 39,
              "ceilingYieldPct": 2.59,
              "feasible": false,
              "offStrategy": false,
              "capexChf": 44860,
              "annualUpliftChf": 1596.98,
              "deltaValueChf": 29159
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
                  "assetId": "b69ee2a2-213e-4b22-b601-ab857ec7c1d6",
                  "unitId": "demo-unit-0003",
                  "label": "Insulated windows (PVC/wood) — 0003",
                  "costChf": 1100,
                  "annualUpliftChf": 22,
                  "deltaValueChf": 715,
                  "marginalYieldPct": 3.08,
                  "accretive": true
                },
                {
                  "assetId": "810ba743-1a27-48fe-b326-33183f74754b",
                  "unitId": "demo-unit-0005",
                  "label": "Parquet flooring (mosaic) — 0005",
                  "costChf": 3500,
                  "annualUpliftChf": 43.75,
                  "deltaValueChf": 2275,
                  "marginalYieldPct": 1.92,
                  "accretive": false
                },
                {
                  "assetId": "a0345d17-a405-4bab-a0e9-117c91256a37",
                  "unitId": "demo-unit-0008",
                  "label": "Kitchen cabinets (chipboard) — 0008",
                  "costChf": 4500,
                  "annualUpliftChf": 150,
                  "deltaValueChf": 2925,
                  "marginalYieldPct": 5.13,
                  "accretive": true
                },
                {
                  "assetId": "aa1e5f48-3995-4414-905f-eafe6207ea12",
                  "unitId": "demo-unit-0003",
                  "label": "Kitchen cabinets (chipboard) — 0003",
                  "costChf": 4500,
                  "annualUpliftChf": 150,
                  "deltaValueChf": 2925,
                  "marginalYieldPct": 5.13,
                  "accretive": true
                },
                {
                  "assetId": "40a31223-d8f1-41a2-964d-853c62365f4c",
                  "unitId": "demo-unit-0006",
                  "label": "Interior doors (chipboard) — 0006",
                  "costChf": 450,
                  "annualUpliftChf": 9,
                  "deltaValueChf": 292.5,
                  "marginalYieldPct": 3.08,
                  "accretive": true
                },
                {
                  "assetId": "8c0c1cd8-d2a9-4370-8f2e-4715f2461451",
                  "unitId": "demo-unit-0006",
                  "label": "Roller shutters (plastic) — 0006",
                  "costChf": 550,
                  "annualUpliftChf": 13.75,
                  "deltaValueChf": 357.5,
                  "marginalYieldPct": 3.85,
                  "accretive": true
                },
                {
                  "assetId": "b2487276-dd27-46e9-a9f8-5d6a0171ae2d",
                  "unitId": "demo-unit-0006",
                  "label": "Wall paint (dispersion) — 0006",
                  "costChf": 2200,
                  "annualUpliftChf": 137.5,
                  "deltaValueChf": 1430,
                  "marginalYieldPct": 9.62,
                  "accretive": true
                },
                {
                  "assetId": "b7a27822-5660-4d4a-aebc-4e54c1970386",
                  "unitId": "demo-unit-0008",
                  "label": "Power sockets — 0008",
                  "costChf": 130,
                  "annualUpliftChf": 4.33,
                  "deltaValueChf": 84.5,
                  "marginalYieldPct": 5.13,
                  "accretive": true
                },
                {
                  "assetId": "63a9b2bb-ec4f-4b71-9538-e606b7f80070",
                  "unitId": "demo-unit-0001",
                  "label": "Kitchen tap — 0001",
                  "costChf": 400,
                  "annualUpliftChf": 10,
                  "deltaValueChf": 260,
                  "marginalYieldPct": 3.85,
                  "accretive": true
                },
                {
                  "assetId": "1dff6cb4-1f36-49d0-a049-79d32dd344eb",
                  "unitId": "demo-unit-0002",
                  "label": "Power sockets — 0002",
                  "costChf": 130,
                  "annualUpliftChf": 4.33,
                  "deltaValueChf": 84.5,
                  "marginalYieldPct": 5.13,
                  "accretive": true
                },
                {
                  "assetId": "760e2773-ab88-408a-a0a2-b9b271c9b84d",
                  "unitId": "demo-unit-0005",
                  "label": "Bathroom tap — 0005",
                  "costChf": 400,
                  "annualUpliftChf": 10,
                  "deltaValueChf": 260,
                  "marginalYieldPct": 3.85,
                  "accretive": true
                },
                {
                  "assetId": "6004c6f3-e2f1-4ead-b1be-4e6fc91521bb",
                  "unitId": "demo-unit-0002",
                  "label": "Kitchen worktop (synthetic) — 0002",
                  "costChf": 1200,
                  "annualUpliftChf": 40,
                  "deltaValueChf": 780,
                  "marginalYieldPct": 5.13,
                  "accretive": true
                },
                {
                  "assetId": "f6a01996-4f9c-46a7-86ac-cc5b19fc88b9",
                  "unitId": "demo-unit-0003",
                  "label": "Bathroom tap — 0003",
                  "costChf": 400,
                  "annualUpliftChf": 10,
                  "deltaValueChf": 260,
                  "marginalYieldPct": 3.85,
                  "accretive": true
                },
                {
                  "assetId": "38f106c6-440d-4799-bffa-00c2daeae3e6",
                  "unitId": "demo-unit-0004",
                  "label": "Roller shutters (plastic) — 0004",
                  "costChf": 550,
                  "annualUpliftChf": 13.75,
                  "deltaValueChf": 357.5,
                  "marginalYieldPct": 3.85,
                  "accretive": true
                },
                {
                  "assetId": "9154bb61-a9ee-477a-9db4-87697de4b73d",
                  "unitId": "demo-unit-0004",
                  "label": "Wall paint (dispersion) — 0004",
                  "costChf": 2200,
                  "annualUpliftChf": 137.5,
                  "deltaValueChf": 1430,
                  "marginalYieldPct": 9.62,
                  "accretive": true
                },
                {
                  "assetId": "70eff972-0eb2-468e-85b2-97c17f1bad8f",
                  "unitId": "demo-unit-0005",
                  "label": "Light switches — 0005",
                  "costChf": 70,
                  "annualUpliftChf": 2.33,
                  "deltaValueChf": 45.5,
                  "marginalYieldPct": 5.13,
                  "accretive": true
                },
                {
                  "assetId": "972ca36a-ea0d-4212-9f63-ff32556cac0d",
                  "unitId": "demo-unit-0007",
                  "label": "Sanitary ceramics (WC/basin) — 0007",
                  "costChf": 1200,
                  "annualUpliftChf": 17.14,
                  "deltaValueChf": 780,
                  "marginalYieldPct": 2.2,
                  "accretive": false
                },
                {
                  "assetId": "ad578c8d-179f-437a-84ce-d9dd16a55b03",
                  "unitId": "demo-unit-0008",
                  "label": "Balcony railing (metal) — 0008",
                  "costChf": 800,
                  "annualUpliftChf": 13.33,
                  "deltaValueChf": 520,
                  "marginalYieldPct": 2.56,
                  "accretive": false
                },
                {
                  "assetId": "929f5bc8-9e3e-4bed-a3ba-9e267296e0e9",
                  "unitId": "demo-unit-0008",
                  "label": "Bathroom tiles (ceramic) — 0008",
                  "costChf": 2200,
                  "annualUpliftChf": 36.67,
                  "deltaValueChf": 1430,
                  "marginalYieldPct": 2.56,
                  "accretive": false
                },
                {
                  "assetId": "10e11f5d-059b-44f0-b3bc-1ed7b1137c33",
                  "unitId": "demo-unit-0001",
                  "label": "Kitchen worktop (synthetic) — 0001",
                  "costChf": 1200,
                  "annualUpliftChf": 40,
                  "deltaValueChf": 780,
                  "marginalYieldPct": 5.13,
                  "accretive": true
                },
                {
                  "assetId": "91fbe53c-072e-4846-a315-dc430ab0b0a7",
                  "unitId": "demo-unit-0001",
                  "label": "Insulated windows (PVC/wood) — 0001",
                  "costChf": 1100,
                  "annualUpliftChf": 22,
                  "deltaValueChf": 715,
                  "marginalYieldPct": 3.08,
                  "accretive": true
                },
                {
                  "assetId": "055418f0-43c5-481d-9225-aba3bd6babc9",
                  "unitId": "demo-unit-0002",
                  "label": "Bathtub (acrylic) — 0002",
                  "costChf": 900,
                  "annualUpliftChf": 18,
                  "deltaValueChf": 585,
                  "marginalYieldPct": 3.08,
                  "accretive": true
                },
                {
                  "assetId": "226e8a03-9daa-4560-802c-ff48b1d3eed7",
                  "unitId": "demo-unit-0003",
                  "label": "Roller shutters (plastic) — 0003",
                  "costChf": 550,
                  "annualUpliftChf": 13.75,
                  "deltaValueChf": 357.5,
                  "marginalYieldPct": 3.85,
                  "accretive": true
                },
                {
                  "assetId": "85ff6500-271b-414f-a194-d71ba536c327",
                  "unitId": "demo-unit-0003",
                  "label": "Wall paint (dispersion) — 0003",
                  "costChf": 2200,
                  "annualUpliftChf": 137.5,
                  "deltaValueChf": 1430,
                  "marginalYieldPct": 9.62,
                  "accretive": true
                },
                {
                  "assetId": "8af96294-0bc0-43d7-9768-c1952c0ecda6",
                  "unitId": "demo-unit-0003",
                  "label": "Power sockets — 0003",
                  "costChf": 130,
                  "annualUpliftChf": 4.33,
                  "deltaValueChf": 84.5,
                  "marginalYieldPct": 5.13,
                  "accretive": true
                },
                {
                  "assetId": "8512137c-9252-46b1-af45-4769b43114e0",
                  "unitId": "demo-unit-0006",
                  "label": "Bathroom tap — 0006",
                  "costChf": 400,
                  "annualUpliftChf": 10,
                  "deltaValueChf": 260,
                  "marginalYieldPct": 3.85,
                  "accretive": true
                },
                {
                  "assetId": "506eaef0-8daa-4ed6-8d40-f83820bac2bf",
                  "unitId": "demo-unit-0006",
                  "label": "Bathtub (acrylic) — 0006",
                  "costChf": 900,
                  "annualUpliftChf": 18,
                  "deltaValueChf": 585,
                  "marginalYieldPct": 3.08,
                  "accretive": true
                },
                {
                  "assetId": "3a33e13f-367b-4a81-8808-260b8607f4b5",
                  "unitId": "demo-unit-0006",
                  "label": "Kitchen tap — 0006",
                  "costChf": 400,
                  "annualUpliftChf": 10,
                  "deltaValueChf": 260,
                  "marginalYieldPct": 3.85,
                  "accretive": true
                },
                {
                  "assetId": "76504672-e5fe-434a-a9e8-502fdab4da87",
                  "unitId": "demo-unit-0006",
                  "label": "Light switches — 0006",
                  "costChf": 70,
                  "annualUpliftChf": 2.33,
                  "deltaValueChf": 45.5,
                  "marginalYieldPct": 5.13,
                  "accretive": true
                },
                {
                  "assetId": "12e4dd99-34f9-461c-bd3c-b02c6a10a760",
                  "unitId": "demo-unit-0007",
                  "label": "Interior doors (chipboard) — 0007",
                  "costChf": 450,
                  "annualUpliftChf": 9,
                  "deltaValueChf": 292.5,
                  "marginalYieldPct": 3.08,
                  "accretive": true
                },
                {
                  "assetId": "255e76a2-3782-4021-bb89-d96b92fe067b",
                  "unitId": "demo-unit-0007",
                  "label": "Bathroom tiles (ceramic) — 0007",
                  "costChf": 2200,
                  "annualUpliftChf": 36.67,
                  "deltaValueChf": 1430,
                  "marginalYieldPct": 2.56,
                  "accretive": false
                },
                {
                  "assetId": "e1b21693-e749-4c67-850d-1aa24a1ec5ab",
                  "unitId": "demo-unit-0008",
                  "label": "Balcony (metal) — 0008",
                  "costChf": 4500,
                  "annualUpliftChf": 56.25,
                  "deltaValueChf": 2925,
                  "marginalYieldPct": 1.92,
                  "accretive": false
                },
                {
                  "assetId": "309b679c-1e65-43b0-b0cf-ec1d9f1a8f3c",
                  "unitId": "demo-unit-0001",
                  "label": "Kitchen tiles (ceramic) — 0001",
                  "costChf": 1600,
                  "annualUpliftChf": 26.67,
                  "deltaValueChf": 1040,
                  "marginalYieldPct": 2.56,
                  "accretive": false
                },
                {
                  "assetId": "fde3d1f3-8cf0-429e-a126-4769e3aabd83",
                  "unitId": "demo-unit-0003",
                  "label": "Balcony railing (metal) — 0003",
                  "costChf": 800,
                  "annualUpliftChf": 13.33,
                  "deltaValueChf": 520,
                  "marginalYieldPct": 2.56,
                  "accretive": false
                },
                {
                  "assetId": "c86bd441-9757-4625-98f9-b6506982c547",
                  "unitId": "demo-unit-0003",
                  "label": "Kitchen worktop (synthetic) — 0003",
                  "costChf": 1200,
                  "annualUpliftChf": 40,
                  "deltaValueChf": 780,
                  "marginalYieldPct": 5.13,
                  "accretive": true
                },
                {
                  "assetId": "36ae25f1-e8a1-4b0a-bd60-aebd88e65167",
                  "unitId": "demo-unit-0006",
                  "label": "Kitchen cabinets (chipboard) — 0006",
                  "costChf": 4500,
                  "annualUpliftChf": 150,
                  "deltaValueChf": 2925,
                  "marginalYieldPct": 5.13,
                  "accretive": true
                },
                {
                  "assetId": "11866cc2-d29a-4175-8b0d-5e60f1c5f64a",
                  "unitId": "demo-unit-0007",
                  "label": "Roller shutters (plastic) — 0007",
                  "costChf": 550,
                  "annualUpliftChf": 13.75,
                  "deltaValueChf": 357.5,
                  "marginalYieldPct": 3.85,
                  "accretive": true
                },
                {
                  "assetId": "c75ab1a7-afb4-43b8-a082-9a5f3e4e2440",
                  "unitId": "demo-unit-0007",
                  "label": "Wall paint (dispersion) — 0007",
                  "costChf": 2200,
                  "annualUpliftChf": 137.5,
                  "deltaValueChf": 1430,
                  "marginalYieldPct": 9.62,
                  "accretive": true
                },
                {
                  "assetId": "5a2c90fa-661f-4af6-aec3-7f31e9003b48",
                  "unitId": "demo-unit-0008",
                  "label": "Bathroom tap — 0008",
                  "costChf": 400,
                  "annualUpliftChf": 10,
                  "deltaValueChf": 260,
                  "marginalYieldPct": 3.85,
                  "accretive": true
                },
                {
                  "assetId": "8adb5bf1-0108-4800-baf2-21319f55b8f6",
                  "unitId": "demo-unit-0001",
                  "label": "Balcony (metal) — 0001",
                  "costChf": 4500,
                  "annualUpliftChf": 56.25,
                  "deltaValueChf": 2925,
                  "marginalYieldPct": 1.92,
                  "accretive": false
                },
                {
                  "assetId": "12bf1e5b-d6d4-423b-b295-851ed9ac5509",
                  "unitId": "demo-unit-0002",
                  "label": "Parquet flooring (mosaic) — 0002",
                  "costChf": 3500,
                  "annualUpliftChf": 43.75,
                  "deltaValueChf": 2275,
                  "marginalYieldPct": 1.92,
                  "accretive": false
                },
                {
                  "assetId": "61b4b99a-503c-483f-9b92-030bca5c7c3e",
                  "unitId": "demo-unit-0004",
                  "label": "Balcony railing (metal) — 0004",
                  "costChf": 800,
                  "annualUpliftChf": 13.33,
                  "deltaValueChf": 520,
                  "marginalYieldPct": 2.56,
                  "accretive": false
                },
                {
                  "assetId": "04469e50-2abf-4b7b-ac10-eeb4633a14ce",
                  "unitId": "demo-unit-0005",
                  "label": "Kitchen cabinets (chipboard) — 0005",
                  "costChf": 4500,
                  "annualUpliftChf": 150,
                  "deltaValueChf": 2925,
                  "marginalYieldPct": 5.13,
                  "accretive": true
                },
                {
                  "assetId": "4fc308c1-87b5-403b-9c01-04aae843ac12",
                  "unitId": "demo-unit-0006",
                  "label": "Insulated windows (PVC/wood) — 0006",
                  "costChf": 1100,
                  "annualUpliftChf": 22,
                  "deltaValueChf": 715,
                  "marginalYieldPct": 3.08,
                  "accretive": true
                },
                {
                  "assetId": "07a85932-f5dc-4dae-8ee3-178169da0058",
                  "unitId": "demo-unit-0007",
                  "label": "Bathroom tap — 0007",
                  "costChf": 400,
                  "annualUpliftChf": 10,
                  "deltaValueChf": 260,
                  "marginalYieldPct": 3.85,
                  "accretive": true
                },
                {
                  "assetId": "ffa81f1d-937f-4fd8-b1e4-f3507883d1b6",
                  "unitId": "demo-unit-0008",
                  "label": "Parquet flooring (mosaic) — 0008",
                  "costChf": 3500,
                  "annualUpliftChf": 43.75,
                  "deltaValueChf": 2275,
                  "marginalYieldPct": 1.92,
                  "accretive": false
                },
                {
                  "assetId": "56be3dfa-c953-4ff4-9e17-d54520df9a4f",
                  "unitId": "demo-unit-0001",
                  "label": "Balcony railing (metal) — 0001",
                  "costChf": 800,
                  "annualUpliftChf": 13.33,
                  "deltaValueChf": 520,
                  "marginalYieldPct": 2.56,
                  "accretive": false
                },
                {
                  "assetId": "97af7310-942f-4e83-9e87-40ecd9b0166f",
                  "unitId": "demo-unit-0004",
                  "label": "Bathtub (acrylic) — 0004",
                  "costChf": 900,
                  "annualUpliftChf": 18,
                  "deltaValueChf": 585,
                  "marginalYieldPct": 3.08,
                  "accretive": true
                },
                {
                  "assetId": "1c947ca6-4c0b-4aab-94db-ee298555c5d9",
                  "unitId": "demo-unit-0004",
                  "label": "Kitchen tap — 0004",
                  "costChf": 400,
                  "annualUpliftChf": 10,
                  "deltaValueChf": 260,
                  "marginalYieldPct": 3.85,
                  "accretive": true
                },
                {
                  "assetId": "bca9bcb5-5ac6-4455-b37b-d47c4c564de7",
                  "unitId": "demo-unit-0005",
                  "label": "Kitchen tiles (ceramic) — 0005",
                  "costChf": 1600,
                  "annualUpliftChf": 26.67,
                  "deltaValueChf": 1040,
                  "marginalYieldPct": 2.56,
                  "accretive": false
                },
                {
                  "assetId": "873afa78-0b19-4d30-be5b-c3bf599135ee",
                  "unitId": "demo-unit-0006",
                  "label": "Sanitary ceramics (WC/basin) — 0006",
                  "costChf": 1200,
                  "annualUpliftChf": 17.14,
                  "deltaValueChf": 780,
                  "marginalYieldPct": 2.2,
                  "accretive": false
                },
                {
                  "assetId": "7ab49bfd-389a-40dd-b1d0-60e259d52c50",
                  "unitId": "demo-unit-0007",
                  "label": "Insulated windows (PVC/wood) — 0007",
                  "costChf": 1100,
                  "annualUpliftChf": 22,
                  "deltaValueChf": 715,
                  "marginalYieldPct": 3.08,
                  "accretive": true
                },
                {
                  "assetId": "51547374-27b8-4836-929a-15fc1f3bf5fc",
                  "unitId": "demo-unit-0007",
                  "label": "Power sockets — 0007",
                  "costChf": 130,
                  "annualUpliftChf": 4.33,
                  "deltaValueChf": 84.5,
                  "marginalYieldPct": 5.13,
                  "accretive": true
                },
                {
                  "assetId": "39104edb-59ff-4e29-a920-3dbcd12931b6",
                  "unitId": "demo-unit-0008",
                  "label": "Kitchen tap — 0008",
                  "costChf": 400,
                  "annualUpliftChf": 10,
                  "deltaValueChf": 260,
                  "marginalYieldPct": 3.85,
                  "accretive": true
                },
                {
                  "assetId": "906b22fb-ca51-4603-9ab0-7aa09e759957",
                  "unitId": "demo-unit-0008",
                  "label": "Sanitary ceramics (WC/basin) — 0008",
                  "costChf": 1200,
                  "annualUpliftChf": 17.14,
                  "deltaValueChf": 780,
                  "marginalYieldPct": 2.2,
                  "accretive": false
                }
              ],
              "accretiveCount": 39,
              "ceilingYieldPct": 2.59,
              "feasible": false,
              "offStrategy": false,
              "capexChf": 44860,
              "annualUpliftChf": 1596.98,
              "deltaValueChf": 29159
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
                  "assetId": "b69ee2a2-213e-4b22-b601-ab857ec7c1d6",
                  "unitId": "demo-unit-0003",
                  "label": "Insulated windows (PVC/wood) — 0003",
                  "costChf": 1100,
                  "annualUpliftChf": 22,
                  "deltaValueChf": 715,
                  "marginalYieldPct": 3.08,
                  "accretive": true
                },
                {
                  "assetId": "810ba743-1a27-48fe-b326-33183f74754b",
                  "unitId": "demo-unit-0005",
                  "label": "Parquet flooring (mosaic) — 0005",
                  "costChf": 3500,
                  "annualUpliftChf": 43.75,
                  "deltaValueChf": 2275,
                  "marginalYieldPct": 1.92,
                  "accretive": false
                },
                {
                  "assetId": "a0345d17-a405-4bab-a0e9-117c91256a37",
                  "unitId": "demo-unit-0008",
                  "label": "Kitchen cabinets (chipboard) — 0008",
                  "costChf": 4500,
                  "annualUpliftChf": 150,
                  "deltaValueChf": 2925,
                  "marginalYieldPct": 5.13,
                  "accretive": true
                },
                {
                  "assetId": "aa1e5f48-3995-4414-905f-eafe6207ea12",
                  "unitId": "demo-unit-0003",
                  "label": "Kitchen cabinets (chipboard) — 0003",
                  "costChf": 4500,
                  "annualUpliftChf": 150,
                  "deltaValueChf": 2925,
                  "marginalYieldPct": 5.13,
                  "accretive": true
                },
                {
                  "assetId": "40a31223-d8f1-41a2-964d-853c62365f4c",
                  "unitId": "demo-unit-0006",
                  "label": "Interior doors (chipboard) — 0006",
                  "costChf": 450,
                  "annualUpliftChf": 9,
                  "deltaValueChf": 292.5,
                  "marginalYieldPct": 3.08,
                  "accretive": true
                },
                {
                  "assetId": "8c0c1cd8-d2a9-4370-8f2e-4715f2461451",
                  "unitId": "demo-unit-0006",
                  "label": "Roller shutters (plastic) — 0006",
                  "costChf": 550,
                  "annualUpliftChf": 13.75,
                  "deltaValueChf": 357.5,
                  "marginalYieldPct": 3.85,
                  "accretive": true
                },
                {
                  "assetId": "b2487276-dd27-46e9-a9f8-5d6a0171ae2d",
                  "unitId": "demo-unit-0006",
                  "label": "Wall paint (dispersion) — 0006",
                  "costChf": 2200,
                  "annualUpliftChf": 137.5,
                  "deltaValueChf": 1430,
                  "marginalYieldPct": 9.62,
                  "accretive": true
                },
                {
                  "assetId": "b7a27822-5660-4d4a-aebc-4e54c1970386",
                  "unitId": "demo-unit-0008",
                  "label": "Power sockets — 0008",
                  "costChf": 130,
                  "annualUpliftChf": 4.33,
                  "deltaValueChf": 84.5,
                  "marginalYieldPct": 5.13,
                  "accretive": true
                },
                {
                  "assetId": "63a9b2bb-ec4f-4b71-9538-e606b7f80070",
                  "unitId": "demo-unit-0001",
                  "label": "Kitchen tap — 0001",
                  "costChf": 400,
                  "annualUpliftChf": 10,
                  "deltaValueChf": 260,
                  "marginalYieldPct": 3.85,
                  "accretive": true
                },
                {
                  "assetId": "1dff6cb4-1f36-49d0-a049-79d32dd344eb",
                  "unitId": "demo-unit-0002",
                  "label": "Power sockets — 0002",
                  "costChf": 130,
                  "annualUpliftChf": 4.33,
                  "deltaValueChf": 84.5,
                  "marginalYieldPct": 5.13,
                  "accretive": true
                },
                {
                  "assetId": "760e2773-ab88-408a-a0a2-b9b271c9b84d",
                  "unitId": "demo-unit-0005",
                  "label": "Bathroom tap — 0005",
                  "costChf": 400,
                  "annualUpliftChf": 10,
                  "deltaValueChf": 260,
                  "marginalYieldPct": 3.85,
                  "accretive": true
                },
                {
                  "assetId": "6004c6f3-e2f1-4ead-b1be-4e6fc91521bb",
                  "unitId": "demo-unit-0002",
                  "label": "Kitchen worktop (synthetic) — 0002",
                  "costChf": 1200,
                  "annualUpliftChf": 40,
                  "deltaValueChf": 780,
                  "marginalYieldPct": 5.13,
                  "accretive": true
                },
                {
                  "assetId": "f6a01996-4f9c-46a7-86ac-cc5b19fc88b9",
                  "unitId": "demo-unit-0003",
                  "label": "Bathroom tap — 0003",
                  "costChf": 400,
                  "annualUpliftChf": 10,
                  "deltaValueChf": 260,
                  "marginalYieldPct": 3.85,
                  "accretive": true
                },
                {
                  "assetId": "38f106c6-440d-4799-bffa-00c2daeae3e6",
                  "unitId": "demo-unit-0004",
                  "label": "Roller shutters (plastic) — 0004",
                  "costChf": 550,
                  "annualUpliftChf": 13.75,
                  "deltaValueChf": 357.5,
                  "marginalYieldPct": 3.85,
                  "accretive": true
                },
                {
                  "assetId": "9154bb61-a9ee-477a-9db4-87697de4b73d",
                  "unitId": "demo-unit-0004",
                  "label": "Wall paint (dispersion) — 0004",
                  "costChf": 2200,
                  "annualUpliftChf": 137.5,
                  "deltaValueChf": 1430,
                  "marginalYieldPct": 9.62,
                  "accretive": true
                },
                {
                  "assetId": "70eff972-0eb2-468e-85b2-97c17f1bad8f",
                  "unitId": "demo-unit-0005",
                  "label": "Light switches — 0005",
                  "costChf": 70,
                  "annualUpliftChf": 2.33,
                  "deltaValueChf": 45.5,
                  "marginalYieldPct": 5.13,
                  "accretive": true
                },
                {
                  "assetId": "972ca36a-ea0d-4212-9f63-ff32556cac0d",
                  "unitId": "demo-unit-0007",
                  "label": "Sanitary ceramics (WC/basin) — 0007",
                  "costChf": 1200,
                  "annualUpliftChf": 17.14,
                  "deltaValueChf": 780,
                  "marginalYieldPct": 2.2,
                  "accretive": false
                },
                {
                  "assetId": "ad578c8d-179f-437a-84ce-d9dd16a55b03",
                  "unitId": "demo-unit-0008",
                  "label": "Balcony railing (metal) — 0008",
                  "costChf": 800,
                  "annualUpliftChf": 13.33,
                  "deltaValueChf": 520,
                  "marginalYieldPct": 2.56,
                  "accretive": false
                },
                {
                  "assetId": "929f5bc8-9e3e-4bed-a3ba-9e267296e0e9",
                  "unitId": "demo-unit-0008",
                  "label": "Bathroom tiles (ceramic) — 0008",
                  "costChf": 2200,
                  "annualUpliftChf": 36.67,
                  "deltaValueChf": 1430,
                  "marginalYieldPct": 2.56,
                  "accretive": false
                },
                {
                  "assetId": "10e11f5d-059b-44f0-b3bc-1ed7b1137c33",
                  "unitId": "demo-unit-0001",
                  "label": "Kitchen worktop (synthetic) — 0001",
                  "costChf": 1200,
                  "annualUpliftChf": 40,
                  "deltaValueChf": 780,
                  "marginalYieldPct": 5.13,
                  "accretive": true
                },
                {
                  "assetId": "91fbe53c-072e-4846-a315-dc430ab0b0a7",
                  "unitId": "demo-unit-0001",
                  "label": "Insulated windows (PVC/wood) — 0001",
                  "costChf": 1100,
                  "annualUpliftChf": 22,
                  "deltaValueChf": 715,
                  "marginalYieldPct": 3.08,
                  "accretive": true
                },
                {
                  "assetId": "055418f0-43c5-481d-9225-aba3bd6babc9",
                  "unitId": "demo-unit-0002",
                  "label": "Bathtub (acrylic) — 0002",
                  "costChf": 900,
                  "annualUpliftChf": 18,
                  "deltaValueChf": 585,
                  "marginalYieldPct": 3.08,
                  "accretive": true
                },
                {
                  "assetId": "226e8a03-9daa-4560-802c-ff48b1d3eed7",
                  "unitId": "demo-unit-0003",
                  "label": "Roller shutters (plastic) — 0003",
                  "costChf": 550,
                  "annualUpliftChf": 13.75,
                  "deltaValueChf": 357.5,
                  "marginalYieldPct": 3.85,
                  "accretive": true
                },
                {
                  "assetId": "85ff6500-271b-414f-a194-d71ba536c327",
                  "unitId": "demo-unit-0003",
                  "label": "Wall paint (dispersion) — 0003",
                  "costChf": 2200,
                  "annualUpliftChf": 137.5,
                  "deltaValueChf": 1430,
                  "marginalYieldPct": 9.62,
                  "accretive": true
                },
                {
                  "assetId": "8af96294-0bc0-43d7-9768-c1952c0ecda6",
                  "unitId": "demo-unit-0003",
                  "label": "Power sockets — 0003",
                  "costChf": 130,
                  "annualUpliftChf": 4.33,
                  "deltaValueChf": 84.5,
                  "marginalYieldPct": 5.13,
                  "accretive": true
                },
                {
                  "assetId": "8512137c-9252-46b1-af45-4769b43114e0",
                  "unitId": "demo-unit-0006",
                  "label": "Bathroom tap — 0006",
                  "costChf": 400,
                  "annualUpliftChf": 10,
                  "deltaValueChf": 260,
                  "marginalYieldPct": 3.85,
                  "accretive": true
                },
                {
                  "assetId": "506eaef0-8daa-4ed6-8d40-f83820bac2bf",
                  "unitId": "demo-unit-0006",
                  "label": "Bathtub (acrylic) — 0006",
                  "costChf": 900,
                  "annualUpliftChf": 18,
                  "deltaValueChf": 585,
                  "marginalYieldPct": 3.08,
                  "accretive": true
                },
                {
                  "assetId": "3a33e13f-367b-4a81-8808-260b8607f4b5",
                  "unitId": "demo-unit-0006",
                  "label": "Kitchen tap — 0006",
                  "costChf": 400,
                  "annualUpliftChf": 10,
                  "deltaValueChf": 260,
                  "marginalYieldPct": 3.85,
                  "accretive": true
                },
                {
                  "assetId": "76504672-e5fe-434a-a9e8-502fdab4da87",
                  "unitId": "demo-unit-0006",
                  "label": "Light switches — 0006",
                  "costChf": 70,
                  "annualUpliftChf": 2.33,
                  "deltaValueChf": 45.5,
                  "marginalYieldPct": 5.13,
                  "accretive": true
                },
                {
                  "assetId": "12e4dd99-34f9-461c-bd3c-b02c6a10a760",
                  "unitId": "demo-unit-0007",
                  "label": "Interior doors (chipboard) — 0007",
                  "costChf": 450,
                  "annualUpliftChf": 9,
                  "deltaValueChf": 292.5,
                  "marginalYieldPct": 3.08,
                  "accretive": true
                },
                {
                  "assetId": "255e76a2-3782-4021-bb89-d96b92fe067b",
                  "unitId": "demo-unit-0007",
                  "label": "Bathroom tiles (ceramic) — 0007",
                  "costChf": 2200,
                  "annualUpliftChf": 36.67,
                  "deltaValueChf": 1430,
                  "marginalYieldPct": 2.56,
                  "accretive": false
                },
                {
                  "assetId": "e1b21693-e749-4c67-850d-1aa24a1ec5ab",
                  "unitId": "demo-unit-0008",
                  "label": "Balcony (metal) — 0008",
                  "costChf": 4500,
                  "annualUpliftChf": 56.25,
                  "deltaValueChf": 2925,
                  "marginalYieldPct": 1.92,
                  "accretive": false
                },
                {
                  "assetId": "309b679c-1e65-43b0-b0cf-ec1d9f1a8f3c",
                  "unitId": "demo-unit-0001",
                  "label": "Kitchen tiles (ceramic) — 0001",
                  "costChf": 1600,
                  "annualUpliftChf": 26.67,
                  "deltaValueChf": 1040,
                  "marginalYieldPct": 2.56,
                  "accretive": false
                },
                {
                  "assetId": "fde3d1f3-8cf0-429e-a126-4769e3aabd83",
                  "unitId": "demo-unit-0003",
                  "label": "Balcony railing (metal) — 0003",
                  "costChf": 800,
                  "annualUpliftChf": 13.33,
                  "deltaValueChf": 520,
                  "marginalYieldPct": 2.56,
                  "accretive": false
                },
                {
                  "assetId": "c86bd441-9757-4625-98f9-b6506982c547",
                  "unitId": "demo-unit-0003",
                  "label": "Kitchen worktop (synthetic) — 0003",
                  "costChf": 1200,
                  "annualUpliftChf": 40,
                  "deltaValueChf": 780,
                  "marginalYieldPct": 5.13,
                  "accretive": true
                },
                {
                  "assetId": "36ae25f1-e8a1-4b0a-bd60-aebd88e65167",
                  "unitId": "demo-unit-0006",
                  "label": "Kitchen cabinets (chipboard) — 0006",
                  "costChf": 4500,
                  "annualUpliftChf": 150,
                  "deltaValueChf": 2925,
                  "marginalYieldPct": 5.13,
                  "accretive": true
                },
                {
                  "assetId": "11866cc2-d29a-4175-8b0d-5e60f1c5f64a",
                  "unitId": "demo-unit-0007",
                  "label": "Roller shutters (plastic) — 0007",
                  "costChf": 550,
                  "annualUpliftChf": 13.75,
                  "deltaValueChf": 357.5,
                  "marginalYieldPct": 3.85,
                  "accretive": true
                },
                {
                  "assetId": "c75ab1a7-afb4-43b8-a082-9a5f3e4e2440",
                  "unitId": "demo-unit-0007",
                  "label": "Wall paint (dispersion) — 0007",
                  "costChf": 2200,
                  "annualUpliftChf": 137.5,
                  "deltaValueChf": 1430,
                  "marginalYieldPct": 9.62,
                  "accretive": true
                },
                {
                  "assetId": "5a2c90fa-661f-4af6-aec3-7f31e9003b48",
                  "unitId": "demo-unit-0008",
                  "label": "Bathroom tap — 0008",
                  "costChf": 400,
                  "annualUpliftChf": 10,
                  "deltaValueChf": 260,
                  "marginalYieldPct": 3.85,
                  "accretive": true
                },
                {
                  "assetId": "8adb5bf1-0108-4800-baf2-21319f55b8f6",
                  "unitId": "demo-unit-0001",
                  "label": "Balcony (metal) — 0001",
                  "costChf": 4500,
                  "annualUpliftChf": 56.25,
                  "deltaValueChf": 2925,
                  "marginalYieldPct": 1.92,
                  "accretive": false
                },
                {
                  "assetId": "12bf1e5b-d6d4-423b-b295-851ed9ac5509",
                  "unitId": "demo-unit-0002",
                  "label": "Parquet flooring (mosaic) — 0002",
                  "costChf": 3500,
                  "annualUpliftChf": 43.75,
                  "deltaValueChf": 2275,
                  "marginalYieldPct": 1.92,
                  "accretive": false
                },
                {
                  "assetId": "61b4b99a-503c-483f-9b92-030bca5c7c3e",
                  "unitId": "demo-unit-0004",
                  "label": "Balcony railing (metal) — 0004",
                  "costChf": 800,
                  "annualUpliftChf": 13.33,
                  "deltaValueChf": 520,
                  "marginalYieldPct": 2.56,
                  "accretive": false
                },
                {
                  "assetId": "04469e50-2abf-4b7b-ac10-eeb4633a14ce",
                  "unitId": "demo-unit-0005",
                  "label": "Kitchen cabinets (chipboard) — 0005",
                  "costChf": 4500,
                  "annualUpliftChf": 150,
                  "deltaValueChf": 2925,
                  "marginalYieldPct": 5.13,
                  "accretive": true
                },
                {
                  "assetId": "4fc308c1-87b5-403b-9c01-04aae843ac12",
                  "unitId": "demo-unit-0006",
                  "label": "Insulated windows (PVC/wood) — 0006",
                  "costChf": 1100,
                  "annualUpliftChf": 22,
                  "deltaValueChf": 715,
                  "marginalYieldPct": 3.08,
                  "accretive": true
                },
                {
                  "assetId": "07a85932-f5dc-4dae-8ee3-178169da0058",
                  "unitId": "demo-unit-0007",
                  "label": "Bathroom tap — 0007",
                  "costChf": 400,
                  "annualUpliftChf": 10,
                  "deltaValueChf": 260,
                  "marginalYieldPct": 3.85,
                  "accretive": true
                },
                {
                  "assetId": "ffa81f1d-937f-4fd8-b1e4-f3507883d1b6",
                  "unitId": "demo-unit-0008",
                  "label": "Parquet flooring (mosaic) — 0008",
                  "costChf": 3500,
                  "annualUpliftChf": 43.75,
                  "deltaValueChf": 2275,
                  "marginalYieldPct": 1.92,
                  "accretive": false
                },
                {
                  "assetId": "56be3dfa-c953-4ff4-9e17-d54520df9a4f",
                  "unitId": "demo-unit-0001",
                  "label": "Balcony railing (metal) — 0001",
                  "costChf": 800,
                  "annualUpliftChf": 13.33,
                  "deltaValueChf": 520,
                  "marginalYieldPct": 2.56,
                  "accretive": false
                },
                {
                  "assetId": "97af7310-942f-4e83-9e87-40ecd9b0166f",
                  "unitId": "demo-unit-0004",
                  "label": "Bathtub (acrylic) — 0004",
                  "costChf": 900,
                  "annualUpliftChf": 18,
                  "deltaValueChf": 585,
                  "marginalYieldPct": 3.08,
                  "accretive": true
                },
                {
                  "assetId": "1c947ca6-4c0b-4aab-94db-ee298555c5d9",
                  "unitId": "demo-unit-0004",
                  "label": "Kitchen tap — 0004",
                  "costChf": 400,
                  "annualUpliftChf": 10,
                  "deltaValueChf": 260,
                  "marginalYieldPct": 3.85,
                  "accretive": true
                },
                {
                  "assetId": "bca9bcb5-5ac6-4455-b37b-d47c4c564de7",
                  "unitId": "demo-unit-0005",
                  "label": "Kitchen tiles (ceramic) — 0005",
                  "costChf": 1600,
                  "annualUpliftChf": 26.67,
                  "deltaValueChf": 1040,
                  "marginalYieldPct": 2.56,
                  "accretive": false
                },
                {
                  "assetId": "873afa78-0b19-4d30-be5b-c3bf599135ee",
                  "unitId": "demo-unit-0006",
                  "label": "Sanitary ceramics (WC/basin) — 0006",
                  "costChf": 1200,
                  "annualUpliftChf": 17.14,
                  "deltaValueChf": 780,
                  "marginalYieldPct": 2.2,
                  "accretive": false
                },
                {
                  "assetId": "7ab49bfd-389a-40dd-b1d0-60e259d52c50",
                  "unitId": "demo-unit-0007",
                  "label": "Insulated windows (PVC/wood) — 0007",
                  "costChf": 1100,
                  "annualUpliftChf": 22,
                  "deltaValueChf": 715,
                  "marginalYieldPct": 3.08,
                  "accretive": true
                },
                {
                  "assetId": "51547374-27b8-4836-929a-15fc1f3bf5fc",
                  "unitId": "demo-unit-0007",
                  "label": "Power sockets — 0007",
                  "costChf": 130,
                  "annualUpliftChf": 4.33,
                  "deltaValueChf": 84.5,
                  "marginalYieldPct": 5.13,
                  "accretive": true
                },
                {
                  "assetId": "39104edb-59ff-4e29-a920-3dbcd12931b6",
                  "unitId": "demo-unit-0008",
                  "label": "Kitchen tap — 0008",
                  "costChf": 400,
                  "annualUpliftChf": 10,
                  "deltaValueChf": 260,
                  "marginalYieldPct": 3.85,
                  "accretive": true
                },
                {
                  "assetId": "906b22fb-ca51-4603-9ab0-7aa09e759957",
                  "unitId": "demo-unit-0008",
                  "label": "Sanitary ceramics (WC/basin) — 0008",
                  "costChf": 1200,
                  "annualUpliftChf": 17.14,
                  "deltaValueChf": 780,
                  "marginalYieldPct": 2.2,
                  "accretive": false
                }
              ],
              "accretiveCount": 39,
              "ceilingYieldPct": 2.59,
              "feasible": false,
              "offStrategy": false,
              "capexChf": 44860,
              "annualUpliftChf": 1596.98,
              "deltaValueChf": 29159
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
                  "assetId": "b69ee2a2-213e-4b22-b601-ab857ec7c1d6",
                  "unitId": "demo-unit-0003",
                  "label": "Insulated windows (PVC/wood) — 0003",
                  "costChf": 1100,
                  "annualUpliftChf": 22,
                  "deltaValueChf": 715,
                  "marginalYieldPct": 3.08,
                  "accretive": true
                },
                {
                  "assetId": "810ba743-1a27-48fe-b326-33183f74754b",
                  "unitId": "demo-unit-0005",
                  "label": "Parquet flooring (mosaic) — 0005",
                  "costChf": 3500,
                  "annualUpliftChf": 43.75,
                  "deltaValueChf": 2275,
                  "marginalYieldPct": 1.92,
                  "accretive": false
                },
                {
                  "assetId": "a0345d17-a405-4bab-a0e9-117c91256a37",
                  "unitId": "demo-unit-0008",
                  "label": "Kitchen cabinets (chipboard) — 0008",
                  "costChf": 4500,
                  "annualUpliftChf": 150,
                  "deltaValueChf": 2925,
                  "marginalYieldPct": 5.13,
                  "accretive": true
                },
                {
                  "assetId": "aa1e5f48-3995-4414-905f-eafe6207ea12",
                  "unitId": "demo-unit-0003",
                  "label": "Kitchen cabinets (chipboard) — 0003",
                  "costChf": 4500,
                  "annualUpliftChf": 150,
                  "deltaValueChf": 2925,
                  "marginalYieldPct": 5.13,
                  "accretive": true
                },
                {
                  "assetId": "40a31223-d8f1-41a2-964d-853c62365f4c",
                  "unitId": "demo-unit-0006",
                  "label": "Interior doors (chipboard) — 0006",
                  "costChf": 450,
                  "annualUpliftChf": 9,
                  "deltaValueChf": 292.5,
                  "marginalYieldPct": 3.08,
                  "accretive": true
                },
                {
                  "assetId": "8c0c1cd8-d2a9-4370-8f2e-4715f2461451",
                  "unitId": "demo-unit-0006",
                  "label": "Roller shutters (plastic) — 0006",
                  "costChf": 550,
                  "annualUpliftChf": 13.75,
                  "deltaValueChf": 357.5,
                  "marginalYieldPct": 3.85,
                  "accretive": true
                },
                {
                  "assetId": "b2487276-dd27-46e9-a9f8-5d6a0171ae2d",
                  "unitId": "demo-unit-0006",
                  "label": "Wall paint (dispersion) — 0006",
                  "costChf": 2200,
                  "annualUpliftChf": 137.5,
                  "deltaValueChf": 1430,
                  "marginalYieldPct": 9.62,
                  "accretive": true
                },
                {
                  "assetId": "b7a27822-5660-4d4a-aebc-4e54c1970386",
                  "unitId": "demo-unit-0008",
                  "label": "Power sockets — 0008",
                  "costChf": 130,
                  "annualUpliftChf": 4.33,
                  "deltaValueChf": 84.5,
                  "marginalYieldPct": 5.13,
                  "accretive": true
                },
                {
                  "assetId": "63a9b2bb-ec4f-4b71-9538-e606b7f80070",
                  "unitId": "demo-unit-0001",
                  "label": "Kitchen tap — 0001",
                  "costChf": 400,
                  "annualUpliftChf": 10,
                  "deltaValueChf": 260,
                  "marginalYieldPct": 3.85,
                  "accretive": true
                },
                {
                  "assetId": "1dff6cb4-1f36-49d0-a049-79d32dd344eb",
                  "unitId": "demo-unit-0002",
                  "label": "Power sockets — 0002",
                  "costChf": 130,
                  "annualUpliftChf": 4.33,
                  "deltaValueChf": 84.5,
                  "marginalYieldPct": 5.13,
                  "accretive": true
                },
                {
                  "assetId": "760e2773-ab88-408a-a0a2-b9b271c9b84d",
                  "unitId": "demo-unit-0005",
                  "label": "Bathroom tap — 0005",
                  "costChf": 400,
                  "annualUpliftChf": 10,
                  "deltaValueChf": 260,
                  "marginalYieldPct": 3.85,
                  "accretive": true
                },
                {
                  "assetId": "6004c6f3-e2f1-4ead-b1be-4e6fc91521bb",
                  "unitId": "demo-unit-0002",
                  "label": "Kitchen worktop (synthetic) — 0002",
                  "costChf": 1200,
                  "annualUpliftChf": 40,
                  "deltaValueChf": 780,
                  "marginalYieldPct": 5.13,
                  "accretive": true
                },
                {
                  "assetId": "f6a01996-4f9c-46a7-86ac-cc5b19fc88b9",
                  "unitId": "demo-unit-0003",
                  "label": "Bathroom tap — 0003",
                  "costChf": 400,
                  "annualUpliftChf": 10,
                  "deltaValueChf": 260,
                  "marginalYieldPct": 3.85,
                  "accretive": true
                },
                {
                  "assetId": "38f106c6-440d-4799-bffa-00c2daeae3e6",
                  "unitId": "demo-unit-0004",
                  "label": "Roller shutters (plastic) — 0004",
                  "costChf": 550,
                  "annualUpliftChf": 13.75,
                  "deltaValueChf": 357.5,
                  "marginalYieldPct": 3.85,
                  "accretive": true
                },
                {
                  "assetId": "9154bb61-a9ee-477a-9db4-87697de4b73d",
                  "unitId": "demo-unit-0004",
                  "label": "Wall paint (dispersion) — 0004",
                  "costChf": 2200,
                  "annualUpliftChf": 137.5,
                  "deltaValueChf": 1430,
                  "marginalYieldPct": 9.62,
                  "accretive": true
                },
                {
                  "assetId": "70eff972-0eb2-468e-85b2-97c17f1bad8f",
                  "unitId": "demo-unit-0005",
                  "label": "Light switches — 0005",
                  "costChf": 70,
                  "annualUpliftChf": 2.33,
                  "deltaValueChf": 45.5,
                  "marginalYieldPct": 5.13,
                  "accretive": true
                },
                {
                  "assetId": "972ca36a-ea0d-4212-9f63-ff32556cac0d",
                  "unitId": "demo-unit-0007",
                  "label": "Sanitary ceramics (WC/basin) — 0007",
                  "costChf": 1200,
                  "annualUpliftChf": 17.14,
                  "deltaValueChf": 780,
                  "marginalYieldPct": 2.2,
                  "accretive": false
                },
                {
                  "assetId": "ad578c8d-179f-437a-84ce-d9dd16a55b03",
                  "unitId": "demo-unit-0008",
                  "label": "Balcony railing (metal) — 0008",
                  "costChf": 800,
                  "annualUpliftChf": 13.33,
                  "deltaValueChf": 520,
                  "marginalYieldPct": 2.56,
                  "accretive": false
                },
                {
                  "assetId": "929f5bc8-9e3e-4bed-a3ba-9e267296e0e9",
                  "unitId": "demo-unit-0008",
                  "label": "Bathroom tiles (ceramic) — 0008",
                  "costChf": 2200,
                  "annualUpliftChf": 36.67,
                  "deltaValueChf": 1430,
                  "marginalYieldPct": 2.56,
                  "accretive": false
                },
                {
                  "assetId": "10e11f5d-059b-44f0-b3bc-1ed7b1137c33",
                  "unitId": "demo-unit-0001",
                  "label": "Kitchen worktop (synthetic) — 0001",
                  "costChf": 1200,
                  "annualUpliftChf": 40,
                  "deltaValueChf": 780,
                  "marginalYieldPct": 5.13,
                  "accretive": true
                },
                {
                  "assetId": "91fbe53c-072e-4846-a315-dc430ab0b0a7",
                  "unitId": "demo-unit-0001",
                  "label": "Insulated windows (PVC/wood) — 0001",
                  "costChf": 1100,
                  "annualUpliftChf": 22,
                  "deltaValueChf": 715,
                  "marginalYieldPct": 3.08,
                  "accretive": true
                },
                {
                  "assetId": "055418f0-43c5-481d-9225-aba3bd6babc9",
                  "unitId": "demo-unit-0002",
                  "label": "Bathtub (acrylic) — 0002",
                  "costChf": 900,
                  "annualUpliftChf": 18,
                  "deltaValueChf": 585,
                  "marginalYieldPct": 3.08,
                  "accretive": true
                },
                {
                  "assetId": "226e8a03-9daa-4560-802c-ff48b1d3eed7",
                  "unitId": "demo-unit-0003",
                  "label": "Roller shutters (plastic) — 0003",
                  "costChf": 550,
                  "annualUpliftChf": 13.75,
                  "deltaValueChf": 357.5,
                  "marginalYieldPct": 3.85,
                  "accretive": true
                },
                {
                  "assetId": "85ff6500-271b-414f-a194-d71ba536c327",
                  "unitId": "demo-unit-0003",
                  "label": "Wall paint (dispersion) — 0003",
                  "costChf": 2200,
                  "annualUpliftChf": 137.5,
                  "deltaValueChf": 1430,
                  "marginalYieldPct": 9.62,
                  "accretive": true
                },
                {
                  "assetId": "8af96294-0bc0-43d7-9768-c1952c0ecda6",
                  "unitId": "demo-unit-0003",
                  "label": "Power sockets — 0003",
                  "costChf": 130,
                  "annualUpliftChf": 4.33,
                  "deltaValueChf": 84.5,
                  "marginalYieldPct": 5.13,
                  "accretive": true
                },
                {
                  "assetId": "8512137c-9252-46b1-af45-4769b43114e0",
                  "unitId": "demo-unit-0006",
                  "label": "Bathroom tap — 0006",
                  "costChf": 400,
                  "annualUpliftChf": 10,
                  "deltaValueChf": 260,
                  "marginalYieldPct": 3.85,
                  "accretive": true
                },
                {
                  "assetId": "506eaef0-8daa-4ed6-8d40-f83820bac2bf",
                  "unitId": "demo-unit-0006",
                  "label": "Bathtub (acrylic) — 0006",
                  "costChf": 900,
                  "annualUpliftChf": 18,
                  "deltaValueChf": 585,
                  "marginalYieldPct": 3.08,
                  "accretive": true
                },
                {
                  "assetId": "3a33e13f-367b-4a81-8808-260b8607f4b5",
                  "unitId": "demo-unit-0006",
                  "label": "Kitchen tap — 0006",
                  "costChf": 400,
                  "annualUpliftChf": 10,
                  "deltaValueChf": 260,
                  "marginalYieldPct": 3.85,
                  "accretive": true
                },
                {
                  "assetId": "76504672-e5fe-434a-a9e8-502fdab4da87",
                  "unitId": "demo-unit-0006",
                  "label": "Light switches — 0006",
                  "costChf": 70,
                  "annualUpliftChf": 2.33,
                  "deltaValueChf": 45.5,
                  "marginalYieldPct": 5.13,
                  "accretive": true
                },
                {
                  "assetId": "12e4dd99-34f9-461c-bd3c-b02c6a10a760",
                  "unitId": "demo-unit-0007",
                  "label": "Interior doors (chipboard) — 0007",
                  "costChf": 450,
                  "annualUpliftChf": 9,
                  "deltaValueChf": 292.5,
                  "marginalYieldPct": 3.08,
                  "accretive": true
                },
                {
                  "assetId": "255e76a2-3782-4021-bb89-d96b92fe067b",
                  "unitId": "demo-unit-0007",
                  "label": "Bathroom tiles (ceramic) — 0007",
                  "costChf": 2200,
                  "annualUpliftChf": 36.67,
                  "deltaValueChf": 1430,
                  "marginalYieldPct": 2.56,
                  "accretive": false
                },
                {
                  "assetId": "e1b21693-e749-4c67-850d-1aa24a1ec5ab",
                  "unitId": "demo-unit-0008",
                  "label": "Balcony (metal) — 0008",
                  "costChf": 4500,
                  "annualUpliftChf": 56.25,
                  "deltaValueChf": 2925,
                  "marginalYieldPct": 1.92,
                  "accretive": false
                },
                {
                  "assetId": "309b679c-1e65-43b0-b0cf-ec1d9f1a8f3c",
                  "unitId": "demo-unit-0001",
                  "label": "Kitchen tiles (ceramic) — 0001",
                  "costChf": 1600,
                  "annualUpliftChf": 26.67,
                  "deltaValueChf": 1040,
                  "marginalYieldPct": 2.56,
                  "accretive": false
                },
                {
                  "assetId": "fde3d1f3-8cf0-429e-a126-4769e3aabd83",
                  "unitId": "demo-unit-0003",
                  "label": "Balcony railing (metal) — 0003",
                  "costChf": 800,
                  "annualUpliftChf": 13.33,
                  "deltaValueChf": 520,
                  "marginalYieldPct": 2.56,
                  "accretive": false
                },
                {
                  "assetId": "c86bd441-9757-4625-98f9-b6506982c547",
                  "unitId": "demo-unit-0003",
                  "label": "Kitchen worktop (synthetic) — 0003",
                  "costChf": 1200,
                  "annualUpliftChf": 40,
                  "deltaValueChf": 780,
                  "marginalYieldPct": 5.13,
                  "accretive": true
                },
                {
                  "assetId": "36ae25f1-e8a1-4b0a-bd60-aebd88e65167",
                  "unitId": "demo-unit-0006",
                  "label": "Kitchen cabinets (chipboard) — 0006",
                  "costChf": 4500,
                  "annualUpliftChf": 150,
                  "deltaValueChf": 2925,
                  "marginalYieldPct": 5.13,
                  "accretive": true
                },
                {
                  "assetId": "11866cc2-d29a-4175-8b0d-5e60f1c5f64a",
                  "unitId": "demo-unit-0007",
                  "label": "Roller shutters (plastic) — 0007",
                  "costChf": 550,
                  "annualUpliftChf": 13.75,
                  "deltaValueChf": 357.5,
                  "marginalYieldPct": 3.85,
                  "accretive": true
                },
                {
                  "assetId": "c75ab1a7-afb4-43b8-a082-9a5f3e4e2440",
                  "unitId": "demo-unit-0007",
                  "label": "Wall paint (dispersion) — 0007",
                  "costChf": 2200,
                  "annualUpliftChf": 137.5,
                  "deltaValueChf": 1430,
                  "marginalYieldPct": 9.62,
                  "accretive": true
                },
                {
                  "assetId": "5a2c90fa-661f-4af6-aec3-7f31e9003b48",
                  "unitId": "demo-unit-0008",
                  "label": "Bathroom tap — 0008",
                  "costChf": 400,
                  "annualUpliftChf": 10,
                  "deltaValueChf": 260,
                  "marginalYieldPct": 3.85,
                  "accretive": true
                },
                {
                  "assetId": "8adb5bf1-0108-4800-baf2-21319f55b8f6",
                  "unitId": "demo-unit-0001",
                  "label": "Balcony (metal) — 0001",
                  "costChf": 4500,
                  "annualUpliftChf": 56.25,
                  "deltaValueChf": 2925,
                  "marginalYieldPct": 1.92,
                  "accretive": false
                },
                {
                  "assetId": "12bf1e5b-d6d4-423b-b295-851ed9ac5509",
                  "unitId": "demo-unit-0002",
                  "label": "Parquet flooring (mosaic) — 0002",
                  "costChf": 3500,
                  "annualUpliftChf": 43.75,
                  "deltaValueChf": 2275,
                  "marginalYieldPct": 1.92,
                  "accretive": false
                },
                {
                  "assetId": "61b4b99a-503c-483f-9b92-030bca5c7c3e",
                  "unitId": "demo-unit-0004",
                  "label": "Balcony railing (metal) — 0004",
                  "costChf": 800,
                  "annualUpliftChf": 13.33,
                  "deltaValueChf": 520,
                  "marginalYieldPct": 2.56,
                  "accretive": false
                },
                {
                  "assetId": "04469e50-2abf-4b7b-ac10-eeb4633a14ce",
                  "unitId": "demo-unit-0005",
                  "label": "Kitchen cabinets (chipboard) — 0005",
                  "costChf": 4500,
                  "annualUpliftChf": 150,
                  "deltaValueChf": 2925,
                  "marginalYieldPct": 5.13,
                  "accretive": true
                },
                {
                  "assetId": "4fc308c1-87b5-403b-9c01-04aae843ac12",
                  "unitId": "demo-unit-0006",
                  "label": "Insulated windows (PVC/wood) — 0006",
                  "costChf": 1100,
                  "annualUpliftChf": 22,
                  "deltaValueChf": 715,
                  "marginalYieldPct": 3.08,
                  "accretive": true
                },
                {
                  "assetId": "07a85932-f5dc-4dae-8ee3-178169da0058",
                  "unitId": "demo-unit-0007",
                  "label": "Bathroom tap — 0007",
                  "costChf": 400,
                  "annualUpliftChf": 10,
                  "deltaValueChf": 260,
                  "marginalYieldPct": 3.85,
                  "accretive": true
                },
                {
                  "assetId": "ffa81f1d-937f-4fd8-b1e4-f3507883d1b6",
                  "unitId": "demo-unit-0008",
                  "label": "Parquet flooring (mosaic) — 0008",
                  "costChf": 3500,
                  "annualUpliftChf": 43.75,
                  "deltaValueChf": 2275,
                  "marginalYieldPct": 1.92,
                  "accretive": false
                },
                {
                  "assetId": "56be3dfa-c953-4ff4-9e17-d54520df9a4f",
                  "unitId": "demo-unit-0001",
                  "label": "Balcony railing (metal) — 0001",
                  "costChf": 800,
                  "annualUpliftChf": 13.33,
                  "deltaValueChf": 520,
                  "marginalYieldPct": 2.56,
                  "accretive": false
                },
                {
                  "assetId": "97af7310-942f-4e83-9e87-40ecd9b0166f",
                  "unitId": "demo-unit-0004",
                  "label": "Bathtub (acrylic) — 0004",
                  "costChf": 900,
                  "annualUpliftChf": 18,
                  "deltaValueChf": 585,
                  "marginalYieldPct": 3.08,
                  "accretive": true
                },
                {
                  "assetId": "1c947ca6-4c0b-4aab-94db-ee298555c5d9",
                  "unitId": "demo-unit-0004",
                  "label": "Kitchen tap — 0004",
                  "costChf": 400,
                  "annualUpliftChf": 10,
                  "deltaValueChf": 260,
                  "marginalYieldPct": 3.85,
                  "accretive": true
                },
                {
                  "assetId": "bca9bcb5-5ac6-4455-b37b-d47c4c564de7",
                  "unitId": "demo-unit-0005",
                  "label": "Kitchen tiles (ceramic) — 0005",
                  "costChf": 1600,
                  "annualUpliftChf": 26.67,
                  "deltaValueChf": 1040,
                  "marginalYieldPct": 2.56,
                  "accretive": false
                },
                {
                  "assetId": "873afa78-0b19-4d30-be5b-c3bf599135ee",
                  "unitId": "demo-unit-0006",
                  "label": "Sanitary ceramics (WC/basin) — 0006",
                  "costChf": 1200,
                  "annualUpliftChf": 17.14,
                  "deltaValueChf": 780,
                  "marginalYieldPct": 2.2,
                  "accretive": false
                },
                {
                  "assetId": "7ab49bfd-389a-40dd-b1d0-60e259d52c50",
                  "unitId": "demo-unit-0007",
                  "label": "Insulated windows (PVC/wood) — 0007",
                  "costChf": 1100,
                  "annualUpliftChf": 22,
                  "deltaValueChf": 715,
                  "marginalYieldPct": 3.08,
                  "accretive": true
                },
                {
                  "assetId": "51547374-27b8-4836-929a-15fc1f3bf5fc",
                  "unitId": "demo-unit-0007",
                  "label": "Power sockets — 0007",
                  "costChf": 130,
                  "annualUpliftChf": 4.33,
                  "deltaValueChf": 84.5,
                  "marginalYieldPct": 5.13,
                  "accretive": true
                },
                {
                  "assetId": "39104edb-59ff-4e29-a920-3dbcd12931b6",
                  "unitId": "demo-unit-0008",
                  "label": "Kitchen tap — 0008",
                  "costChf": 400,
                  "annualUpliftChf": 10,
                  "deltaValueChf": 260,
                  "marginalYieldPct": 3.85,
                  "accretive": true
                },
                {
                  "assetId": "906b22fb-ca51-4603-9ab0-7aa09e759957",
                  "unitId": "demo-unit-0008",
                  "label": "Sanitary ceramics (WC/basin) — 0008",
                  "costChf": 1200,
                  "annualUpliftChf": 17.14,
                  "deltaValueChf": 780,
                  "marginalYieldPct": 2.2,
                  "accretive": false
                }
              ],
              "accretiveCount": 39,
              "ceilingYieldPct": 2.59,
              "feasible": false,
              "offStrategy": true,
              "capexChf": 44860,
              "annualUpliftChf": 1596.98,
              "deltaValueChf": 29159
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
                  "assetId": "b69ee2a2-213e-4b22-b601-ab857ec7c1d6",
                  "unitId": "demo-unit-0003",
                  "label": "Insulated windows (PVC/wood) — 0003",
                  "costChf": 1100,
                  "annualUpliftChf": 22,
                  "deltaValueChf": 715,
                  "marginalYieldPct": 3.08,
                  "accretive": true
                },
                {
                  "assetId": "810ba743-1a27-48fe-b326-33183f74754b",
                  "unitId": "demo-unit-0005",
                  "label": "Parquet flooring (mosaic) — 0005",
                  "costChf": 3500,
                  "annualUpliftChf": 43.75,
                  "deltaValueChf": 2275,
                  "marginalYieldPct": 1.92,
                  "accretive": false
                },
                {
                  "assetId": "a0345d17-a405-4bab-a0e9-117c91256a37",
                  "unitId": "demo-unit-0008",
                  "label": "Kitchen cabinets (chipboard) — 0008",
                  "costChf": 4500,
                  "annualUpliftChf": 150,
                  "deltaValueChf": 2925,
                  "marginalYieldPct": 5.13,
                  "accretive": true
                },
                {
                  "assetId": "aa1e5f48-3995-4414-905f-eafe6207ea12",
                  "unitId": "demo-unit-0003",
                  "label": "Kitchen cabinets (chipboard) — 0003",
                  "costChf": 4500,
                  "annualUpliftChf": 150,
                  "deltaValueChf": 2925,
                  "marginalYieldPct": 5.13,
                  "accretive": true
                },
                {
                  "assetId": "40a31223-d8f1-41a2-964d-853c62365f4c",
                  "unitId": "demo-unit-0006",
                  "label": "Interior doors (chipboard) — 0006",
                  "costChf": 450,
                  "annualUpliftChf": 9,
                  "deltaValueChf": 292.5,
                  "marginalYieldPct": 3.08,
                  "accretive": true
                },
                {
                  "assetId": "8c0c1cd8-d2a9-4370-8f2e-4715f2461451",
                  "unitId": "demo-unit-0006",
                  "label": "Roller shutters (plastic) — 0006",
                  "costChf": 550,
                  "annualUpliftChf": 13.75,
                  "deltaValueChf": 357.5,
                  "marginalYieldPct": 3.85,
                  "accretive": true
                },
                {
                  "assetId": "b2487276-dd27-46e9-a9f8-5d6a0171ae2d",
                  "unitId": "demo-unit-0006",
                  "label": "Wall paint (dispersion) — 0006",
                  "costChf": 2200,
                  "annualUpliftChf": 137.5,
                  "deltaValueChf": 1430,
                  "marginalYieldPct": 9.62,
                  "accretive": true
                },
                {
                  "assetId": "b7a27822-5660-4d4a-aebc-4e54c1970386",
                  "unitId": "demo-unit-0008",
                  "label": "Power sockets — 0008",
                  "costChf": 130,
                  "annualUpliftChf": 4.33,
                  "deltaValueChf": 84.5,
                  "marginalYieldPct": 5.13,
                  "accretive": true
                },
                {
                  "assetId": "63a9b2bb-ec4f-4b71-9538-e606b7f80070",
                  "unitId": "demo-unit-0001",
                  "label": "Kitchen tap — 0001",
                  "costChf": 400,
                  "annualUpliftChf": 10,
                  "deltaValueChf": 260,
                  "marginalYieldPct": 3.85,
                  "accretive": true
                },
                {
                  "assetId": "1dff6cb4-1f36-49d0-a049-79d32dd344eb",
                  "unitId": "demo-unit-0002",
                  "label": "Power sockets — 0002",
                  "costChf": 130,
                  "annualUpliftChf": 4.33,
                  "deltaValueChf": 84.5,
                  "marginalYieldPct": 5.13,
                  "accretive": true
                },
                {
                  "assetId": "760e2773-ab88-408a-a0a2-b9b271c9b84d",
                  "unitId": "demo-unit-0005",
                  "label": "Bathroom tap — 0005",
                  "costChf": 400,
                  "annualUpliftChf": 10,
                  "deltaValueChf": 260,
                  "marginalYieldPct": 3.85,
                  "accretive": true
                },
                {
                  "assetId": "6004c6f3-e2f1-4ead-b1be-4e6fc91521bb",
                  "unitId": "demo-unit-0002",
                  "label": "Kitchen worktop (synthetic) — 0002",
                  "costChf": 1200,
                  "annualUpliftChf": 40,
                  "deltaValueChf": 780,
                  "marginalYieldPct": 5.13,
                  "accretive": true
                },
                {
                  "assetId": "f6a01996-4f9c-46a7-86ac-cc5b19fc88b9",
                  "unitId": "demo-unit-0003",
                  "label": "Bathroom tap — 0003",
                  "costChf": 400,
                  "annualUpliftChf": 10,
                  "deltaValueChf": 260,
                  "marginalYieldPct": 3.85,
                  "accretive": true
                },
                {
                  "assetId": "38f106c6-440d-4799-bffa-00c2daeae3e6",
                  "unitId": "demo-unit-0004",
                  "label": "Roller shutters (plastic) — 0004",
                  "costChf": 550,
                  "annualUpliftChf": 13.75,
                  "deltaValueChf": 357.5,
                  "marginalYieldPct": 3.85,
                  "accretive": true
                },
                {
                  "assetId": "9154bb61-a9ee-477a-9db4-87697de4b73d",
                  "unitId": "demo-unit-0004",
                  "label": "Wall paint (dispersion) — 0004",
                  "costChf": 2200,
                  "annualUpliftChf": 137.5,
                  "deltaValueChf": 1430,
                  "marginalYieldPct": 9.62,
                  "accretive": true
                },
                {
                  "assetId": "70eff972-0eb2-468e-85b2-97c17f1bad8f",
                  "unitId": "demo-unit-0005",
                  "label": "Light switches — 0005",
                  "costChf": 70,
                  "annualUpliftChf": 2.33,
                  "deltaValueChf": 45.5,
                  "marginalYieldPct": 5.13,
                  "accretive": true
                },
                {
                  "assetId": "972ca36a-ea0d-4212-9f63-ff32556cac0d",
                  "unitId": "demo-unit-0007",
                  "label": "Sanitary ceramics (WC/basin) — 0007",
                  "costChf": 1200,
                  "annualUpliftChf": 17.14,
                  "deltaValueChf": 780,
                  "marginalYieldPct": 2.2,
                  "accretive": false
                },
                {
                  "assetId": "ad578c8d-179f-437a-84ce-d9dd16a55b03",
                  "unitId": "demo-unit-0008",
                  "label": "Balcony railing (metal) — 0008",
                  "costChf": 800,
                  "annualUpliftChf": 13.33,
                  "deltaValueChf": 520,
                  "marginalYieldPct": 2.56,
                  "accretive": false
                },
                {
                  "assetId": "929f5bc8-9e3e-4bed-a3ba-9e267296e0e9",
                  "unitId": "demo-unit-0008",
                  "label": "Bathroom tiles (ceramic) — 0008",
                  "costChf": 2200,
                  "annualUpliftChf": 36.67,
                  "deltaValueChf": 1430,
                  "marginalYieldPct": 2.56,
                  "accretive": false
                },
                {
                  "assetId": "10e11f5d-059b-44f0-b3bc-1ed7b1137c33",
                  "unitId": "demo-unit-0001",
                  "label": "Kitchen worktop (synthetic) — 0001",
                  "costChf": 1200,
                  "annualUpliftChf": 40,
                  "deltaValueChf": 780,
                  "marginalYieldPct": 5.13,
                  "accretive": true
                },
                {
                  "assetId": "91fbe53c-072e-4846-a315-dc430ab0b0a7",
                  "unitId": "demo-unit-0001",
                  "label": "Insulated windows (PVC/wood) — 0001",
                  "costChf": 1100,
                  "annualUpliftChf": 22,
                  "deltaValueChf": 715,
                  "marginalYieldPct": 3.08,
                  "accretive": true
                },
                {
                  "assetId": "055418f0-43c5-481d-9225-aba3bd6babc9",
                  "unitId": "demo-unit-0002",
                  "label": "Bathtub (acrylic) — 0002",
                  "costChf": 900,
                  "annualUpliftChf": 18,
                  "deltaValueChf": 585,
                  "marginalYieldPct": 3.08,
                  "accretive": true
                },
                {
                  "assetId": "226e8a03-9daa-4560-802c-ff48b1d3eed7",
                  "unitId": "demo-unit-0003",
                  "label": "Roller shutters (plastic) — 0003",
                  "costChf": 550,
                  "annualUpliftChf": 13.75,
                  "deltaValueChf": 357.5,
                  "marginalYieldPct": 3.85,
                  "accretive": true
                },
                {
                  "assetId": "85ff6500-271b-414f-a194-d71ba536c327",
                  "unitId": "demo-unit-0003",
                  "label": "Wall paint (dispersion) — 0003",
                  "costChf": 2200,
                  "annualUpliftChf": 137.5,
                  "deltaValueChf": 1430,
                  "marginalYieldPct": 9.62,
                  "accretive": true
                },
                {
                  "assetId": "8af96294-0bc0-43d7-9768-c1952c0ecda6",
                  "unitId": "demo-unit-0003",
                  "label": "Power sockets — 0003",
                  "costChf": 130,
                  "annualUpliftChf": 4.33,
                  "deltaValueChf": 84.5,
                  "marginalYieldPct": 5.13,
                  "accretive": true
                },
                {
                  "assetId": "8512137c-9252-46b1-af45-4769b43114e0",
                  "unitId": "demo-unit-0006",
                  "label": "Bathroom tap — 0006",
                  "costChf": 400,
                  "annualUpliftChf": 10,
                  "deltaValueChf": 260,
                  "marginalYieldPct": 3.85,
                  "accretive": true
                },
                {
                  "assetId": "506eaef0-8daa-4ed6-8d40-f83820bac2bf",
                  "unitId": "demo-unit-0006",
                  "label": "Bathtub (acrylic) — 0006",
                  "costChf": 900,
                  "annualUpliftChf": 18,
                  "deltaValueChf": 585,
                  "marginalYieldPct": 3.08,
                  "accretive": true
                },
                {
                  "assetId": "3a33e13f-367b-4a81-8808-260b8607f4b5",
                  "unitId": "demo-unit-0006",
                  "label": "Kitchen tap — 0006",
                  "costChf": 400,
                  "annualUpliftChf": 10,
                  "deltaValueChf": 260,
                  "marginalYieldPct": 3.85,
                  "accretive": true
                },
                {
                  "assetId": "76504672-e5fe-434a-a9e8-502fdab4da87",
                  "unitId": "demo-unit-0006",
                  "label": "Light switches — 0006",
                  "costChf": 70,
                  "annualUpliftChf": 2.33,
                  "deltaValueChf": 45.5,
                  "marginalYieldPct": 5.13,
                  "accretive": true
                },
                {
                  "assetId": "12e4dd99-34f9-461c-bd3c-b02c6a10a760",
                  "unitId": "demo-unit-0007",
                  "label": "Interior doors (chipboard) — 0007",
                  "costChf": 450,
                  "annualUpliftChf": 9,
                  "deltaValueChf": 292.5,
                  "marginalYieldPct": 3.08,
                  "accretive": true
                },
                {
                  "assetId": "255e76a2-3782-4021-bb89-d96b92fe067b",
                  "unitId": "demo-unit-0007",
                  "label": "Bathroom tiles (ceramic) — 0007",
                  "costChf": 2200,
                  "annualUpliftChf": 36.67,
                  "deltaValueChf": 1430,
                  "marginalYieldPct": 2.56,
                  "accretive": false
                },
                {
                  "assetId": "e1b21693-e749-4c67-850d-1aa24a1ec5ab",
                  "unitId": "demo-unit-0008",
                  "label": "Balcony (metal) — 0008",
                  "costChf": 4500,
                  "annualUpliftChf": 56.25,
                  "deltaValueChf": 2925,
                  "marginalYieldPct": 1.92,
                  "accretive": false
                },
                {
                  "assetId": "309b679c-1e65-43b0-b0cf-ec1d9f1a8f3c",
                  "unitId": "demo-unit-0001",
                  "label": "Kitchen tiles (ceramic) — 0001",
                  "costChf": 1600,
                  "annualUpliftChf": 26.67,
                  "deltaValueChf": 1040,
                  "marginalYieldPct": 2.56,
                  "accretive": false
                },
                {
                  "assetId": "fde3d1f3-8cf0-429e-a126-4769e3aabd83",
                  "unitId": "demo-unit-0003",
                  "label": "Balcony railing (metal) — 0003",
                  "costChf": 800,
                  "annualUpliftChf": 13.33,
                  "deltaValueChf": 520,
                  "marginalYieldPct": 2.56,
                  "accretive": false
                },
                {
                  "assetId": "c86bd441-9757-4625-98f9-b6506982c547",
                  "unitId": "demo-unit-0003",
                  "label": "Kitchen worktop (synthetic) — 0003",
                  "costChf": 1200,
                  "annualUpliftChf": 40,
                  "deltaValueChf": 780,
                  "marginalYieldPct": 5.13,
                  "accretive": true
                },
                {
                  "assetId": "36ae25f1-e8a1-4b0a-bd60-aebd88e65167",
                  "unitId": "demo-unit-0006",
                  "label": "Kitchen cabinets (chipboard) — 0006",
                  "costChf": 4500,
                  "annualUpliftChf": 150,
                  "deltaValueChf": 2925,
                  "marginalYieldPct": 5.13,
                  "accretive": true
                },
                {
                  "assetId": "11866cc2-d29a-4175-8b0d-5e60f1c5f64a",
                  "unitId": "demo-unit-0007",
                  "label": "Roller shutters (plastic) — 0007",
                  "costChf": 550,
                  "annualUpliftChf": 13.75,
                  "deltaValueChf": 357.5,
                  "marginalYieldPct": 3.85,
                  "accretive": true
                },
                {
                  "assetId": "c75ab1a7-afb4-43b8-a082-9a5f3e4e2440",
                  "unitId": "demo-unit-0007",
                  "label": "Wall paint (dispersion) — 0007",
                  "costChf": 2200,
                  "annualUpliftChf": 137.5,
                  "deltaValueChf": 1430,
                  "marginalYieldPct": 9.62,
                  "accretive": true
                },
                {
                  "assetId": "5a2c90fa-661f-4af6-aec3-7f31e9003b48",
                  "unitId": "demo-unit-0008",
                  "label": "Bathroom tap — 0008",
                  "costChf": 400,
                  "annualUpliftChf": 10,
                  "deltaValueChf": 260,
                  "marginalYieldPct": 3.85,
                  "accretive": true
                },
                {
                  "assetId": "8adb5bf1-0108-4800-baf2-21319f55b8f6",
                  "unitId": "demo-unit-0001",
                  "label": "Balcony (metal) — 0001",
                  "costChf": 4500,
                  "annualUpliftChf": 56.25,
                  "deltaValueChf": 2925,
                  "marginalYieldPct": 1.92,
                  "accretive": false
                },
                {
                  "assetId": "12bf1e5b-d6d4-423b-b295-851ed9ac5509",
                  "unitId": "demo-unit-0002",
                  "label": "Parquet flooring (mosaic) — 0002",
                  "costChf": 3500,
                  "annualUpliftChf": 43.75,
                  "deltaValueChf": 2275,
                  "marginalYieldPct": 1.92,
                  "accretive": false
                },
                {
                  "assetId": "61b4b99a-503c-483f-9b92-030bca5c7c3e",
                  "unitId": "demo-unit-0004",
                  "label": "Balcony railing (metal) — 0004",
                  "costChf": 800,
                  "annualUpliftChf": 13.33,
                  "deltaValueChf": 520,
                  "marginalYieldPct": 2.56,
                  "accretive": false
                },
                {
                  "assetId": "04469e50-2abf-4b7b-ac10-eeb4633a14ce",
                  "unitId": "demo-unit-0005",
                  "label": "Kitchen cabinets (chipboard) — 0005",
                  "costChf": 4500,
                  "annualUpliftChf": 150,
                  "deltaValueChf": 2925,
                  "marginalYieldPct": 5.13,
                  "accretive": true
                },
                {
                  "assetId": "4fc308c1-87b5-403b-9c01-04aae843ac12",
                  "unitId": "demo-unit-0006",
                  "label": "Insulated windows (PVC/wood) — 0006",
                  "costChf": 1100,
                  "annualUpliftChf": 22,
                  "deltaValueChf": 715,
                  "marginalYieldPct": 3.08,
                  "accretive": true
                },
                {
                  "assetId": "07a85932-f5dc-4dae-8ee3-178169da0058",
                  "unitId": "demo-unit-0007",
                  "label": "Bathroom tap — 0007",
                  "costChf": 400,
                  "annualUpliftChf": 10,
                  "deltaValueChf": 260,
                  "marginalYieldPct": 3.85,
                  "accretive": true
                },
                {
                  "assetId": "ffa81f1d-937f-4fd8-b1e4-f3507883d1b6",
                  "unitId": "demo-unit-0008",
                  "label": "Parquet flooring (mosaic) — 0008",
                  "costChf": 3500,
                  "annualUpliftChf": 43.75,
                  "deltaValueChf": 2275,
                  "marginalYieldPct": 1.92,
                  "accretive": false
                },
                {
                  "assetId": "56be3dfa-c953-4ff4-9e17-d54520df9a4f",
                  "unitId": "demo-unit-0001",
                  "label": "Balcony railing (metal) — 0001",
                  "costChf": 800,
                  "annualUpliftChf": 13.33,
                  "deltaValueChf": 520,
                  "marginalYieldPct": 2.56,
                  "accretive": false
                },
                {
                  "assetId": "97af7310-942f-4e83-9e87-40ecd9b0166f",
                  "unitId": "demo-unit-0004",
                  "label": "Bathtub (acrylic) — 0004",
                  "costChf": 900,
                  "annualUpliftChf": 18,
                  "deltaValueChf": 585,
                  "marginalYieldPct": 3.08,
                  "accretive": true
                },
                {
                  "assetId": "1c947ca6-4c0b-4aab-94db-ee298555c5d9",
                  "unitId": "demo-unit-0004",
                  "label": "Kitchen tap — 0004",
                  "costChf": 400,
                  "annualUpliftChf": 10,
                  "deltaValueChf": 260,
                  "marginalYieldPct": 3.85,
                  "accretive": true
                },
                {
                  "assetId": "bca9bcb5-5ac6-4455-b37b-d47c4c564de7",
                  "unitId": "demo-unit-0005",
                  "label": "Kitchen tiles (ceramic) — 0005",
                  "costChf": 1600,
                  "annualUpliftChf": 26.67,
                  "deltaValueChf": 1040,
                  "marginalYieldPct": 2.56,
                  "accretive": false
                },
                {
                  "assetId": "873afa78-0b19-4d30-be5b-c3bf599135ee",
                  "unitId": "demo-unit-0006",
                  "label": "Sanitary ceramics (WC/basin) — 0006",
                  "costChf": 1200,
                  "annualUpliftChf": 17.14,
                  "deltaValueChf": 780,
                  "marginalYieldPct": 2.2,
                  "accretive": false
                },
                {
                  "assetId": "7ab49bfd-389a-40dd-b1d0-60e259d52c50",
                  "unitId": "demo-unit-0007",
                  "label": "Insulated windows (PVC/wood) — 0007",
                  "costChf": 1100,
                  "annualUpliftChf": 22,
                  "deltaValueChf": 715,
                  "marginalYieldPct": 3.08,
                  "accretive": true
                },
                {
                  "assetId": "51547374-27b8-4836-929a-15fc1f3bf5fc",
                  "unitId": "demo-unit-0007",
                  "label": "Power sockets — 0007",
                  "costChf": 130,
                  "annualUpliftChf": 4.33,
                  "deltaValueChf": 84.5,
                  "marginalYieldPct": 5.13,
                  "accretive": true
                },
                {
                  "assetId": "39104edb-59ff-4e29-a920-3dbcd12931b6",
                  "unitId": "demo-unit-0008",
                  "label": "Kitchen tap — 0008",
                  "costChf": 400,
                  "annualUpliftChf": 10,
                  "deltaValueChf": 260,
                  "marginalYieldPct": 3.85,
                  "accretive": true
                },
                {
                  "assetId": "906b22fb-ca51-4603-9ab0-7aa09e759957",
                  "unitId": "demo-unit-0008",
                  "label": "Sanitary ceramics (WC/basin) — 0008",
                  "costChf": 1200,
                  "annualUpliftChf": 17.14,
                  "deltaValueChf": 780,
                  "marginalYieldPct": 2.2,
                  "accretive": false
                }
              ],
              "accretiveCount": 39,
              "ceilingYieldPct": 2.59,
              "feasible": false,
              "offStrategy": false,
              "capexChf": 44860,
              "annualUpliftChf": 1596.98,
              "deltaValueChf": 29159
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
