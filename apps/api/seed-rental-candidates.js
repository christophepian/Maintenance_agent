/**
 * Seed script: creates 6 rental application candidates for the vacant units.
 * Run: node apps/api/seed-rental-candidates.js
 */
const API = "http://127.0.0.1:3001";

const candidates = [
  { first: "Sophie", last: "Müller", email: "sophie.muller@example.com", income: 8500, employer: "Google Switzerland", household: 2, pets: false, debt: false },
  { first: "Marc", last: "Dubois", email: "marc.dubois@example.com", income: 6200, employer: "UBS AG", household: 1, pets: false, debt: false },
  { first: "Anna", last: "Keller", email: "anna.keller@example.com", income: 4800, employer: "Migros", household: 3, pets: true, debt: false },
  { first: "Luca", last: "Bernasconi", email: "luca.bernasconi@example.com", income: 3200, employer: "Self-employed", household: 1, pets: false, debt: true },
  { first: "Elena", last: "Weber", email: "elena.weber@example.com", income: 9100, employer: "Novartis", household: 2, pets: false, debt: false },
  { first: "Thomas", last: "Fischer", email: "thomas.fischer@example.com", income: 5500, employer: "Swiss Re", household: 1, pets: false, debt: false },
];

async function main() {
  // 1. Get vacant units
  const unitsRes = await fetch(`${API}/vacant-units`);
  const units = (await unitsRes.json()).data;
  if (!units.length) {
    console.error("No vacant units found!");
    process.exit(1);
  }
  console.log(`Found ${units.length} vacant unit(s):`);
  units.forEach(u => console.log(`  ${u.unitNumber} (${u.building?.name}) → ${u.id}`));

  const allUnitIds = units.map(u => u.id);

  for (const c of candidates) {
    // Alternate which units each candidate applies to
    const unitIds = c.income > 6000 ? allUnitIds : [allUnitIds[0]];

    console.log(`\nCreating ${c.first} ${c.last} (CHF ${c.income}/mo, ${c.employer})...`);

    // Create draft
    const createRes = await fetch(`${API}/rental-applications`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        unitIds,
        applicants: [{
          role: "PRIMARY",
          firstName: c.first,
          lastName: c.last,
          email: c.email,
          phone: `+41 79 ${String(Math.random()).slice(2,5)} ${String(Math.random()).slice(2,4)} ${String(Math.random()).slice(2,4)}`,
          nationality: "CH",
          civilStatus: "SINGLE",
          employer: c.employer,
          jobTitle: "Employee",
          workLocation: "Zurich",
          employedSince: "2022-01-15",
          netMonthlyIncome: c.income,
          hasDebtEnforcement: c.debt,
          currentAddress: "Bahnhofstrasse 1",
          currentZipCity: "8001 Zurich",
        }],
        currentLandlordName: "Immobilien AG",
        currentLandlordAddress: "Seestrasse 10, 8002 Zurich",
        currentLandlordPhone: "+41 44 123 45 67",
        reasonForLeaving: "Relocation",
        desiredMoveInDate: "2026-04-01",
        householdSize: c.household,
        hasPets: c.pets,
        petsDescription: c.pets ? "One cat" : "",
        hasRcInsurance: true,
        rcInsuranceCompany: "Mobiliar",
        hasVehicle: false,
        needsParking: false,
      }),
    });

    const createData = await createRes.json();
    if (!createRes.ok) {
      console.error(`  ❌ Create failed:`, createData);
      continue;
    }
    const appId = createData.data.id;
    console.log(`  Draft: ${appId}`);

    // Submit
    const submitRes = await fetch(`${API}/rental-applications/${appId}/submit`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ signedName: `${c.first} ${c.last}` }),
    });
    const submitData = await submitRes.json();
    if (!submitRes.ok) {
      console.error(`  ❌ Submit failed:`, submitData);
      continue;
    }
    console.log(`  ✅ Submitted → ${submitData.data.status}`);
  }

  console.log("\n🎉 Done — 6 candidates seeded!");
}

main().catch(e => { console.error(e); process.exit(1); });
