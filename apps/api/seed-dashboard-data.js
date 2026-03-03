const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function seedDashboardData() {
  console.log('🌱 Seeding dashboard data...\n');

  // Get existing units and buildings
  const units = await prisma.unit.findMany({ take: 5 });
  const buildings = await prisma.building.findMany({ take: 2 });
  
  if (units.length === 0) {
    console.log('❌ No units found. Please ensure buildings and units exist first.');
    return;
  }

  console.log(`Found ${units.length} units to work with\n`);

  // Check for existing data
  const existingInvoices = await prisma.invoice.count({ where: { orgId: 'default-org' } });
  const existingLeases = await prisma.lease.count({ where: { orgId: 'default-org' } });
  const existingTenants = await prisma.tenant.count({ where: { orgId: 'default-org' } });
  
  if (existingInvoices > 0 || existingLeases > 0 || existingTenants > 0) {
    console.log(`Found existing data: ${existingTenants} tenants, ${existingLeases} leases, ${existingInvoices} invoices`);
    console.log('Deleting existing test data to start fresh...\n');
    
    // Clean up existing data (respecting foreign key constraints)
    await prisma.signatureRequest.deleteMany({ where: { orgId: 'default-org' } });
    await prisma.invoice.deleteMany({ where: { orgId: 'default-org' } });
    await prisma.lease.deleteMany({ where: { orgId: 'default-org' } });
    await prisma.occupancy.deleteMany({ where: { unit: { orgId: 'default-org' } } });
    await prisma.tenant.deleteMany({ where: { orgId: 'default-org' } });
    
    console.log('✅ Cleaned up existing data\n');
  }

  // Create 5 tenants
  const tenantData = [
    { name: 'Maria Schmidt', email: 'maria.schmidt@example.ch', phone: '+41791234567' },
    { name: 'Thomas Müller', email: 'thomas.mueller@example.ch', phone: '+41792345678' },
    { name: 'Sophie Bernard', email: 'sophie.bernard@example.ch', phone: '+41793456789' },
    { name: 'Luca Rossi', email: 'luca.rossi@example.ch', phone: '+41794567890' },
    { name: 'Emma Weber', email: 'emma.weber@example.ch', phone: '+41795678901' }
  ];

  const tenants = [];
  for (const tenant of tenantData) {
    const created = await prisma.tenant.create({
      data: {
        name: tenant.name,
        email: tenant.email,
        phone: tenant.phone,
        orgId: 'default-org'
      }
    });
    tenants.push(created);
    console.log(`✅ Created tenant: ${created.name}`);
  }

  console.log('\n📋 Creating active leases...\n');

  // Create occupancy records and leases
  for (let i = 0; i < 3 && i < units.length; i++) {
    // Create occupancy (tenant assigned to unit)
    await prisma.occupancy.create({
      data: {
        unitId: units[i].id,
        tenantId: tenants[i].id
      }
    });
    console.log(`✅ Created occupancy for ${tenants[i].name} in unit ${units[i].unitNumber || units[i].id}`);
    
    // Create active lease
    const monthlyRent = 1500 + (i * 250); // 1500, 1750, 2000 CHF
    const lease = await prisma.lease.create({
      data: {
        orgId: 'default-org',
        unitId: units[i].id,
        status: 'ACTIVE',
        startDate: new Date('2025-01-01'),
        endDate: new Date('2026-12-31'),
        
        // Landlord info (from OrgConfig or default)
        landlordName: 'Property Management AG',
        landlordAddress: 'Hauptstrasse 123',
        landlordZipCity: '8001 Zürich',
        landlordPhone: '+41 44 123 45 67',
        landlordEmail: 'info@property-management.ch',
        
        // Tenant info
        tenantName: tenants[i].name,
        tenantPhone: tenants[i].phone,
        tenantEmail: tenants[i].email,
        
        // Rent details
        netRentChf: monthlyRent,
        rentTotalChf: monthlyRent,
        depositChf: monthlyRent * 2,
        
        // Activated
        activatedAt: new Date('2025-01-01')
      }
    });
    console.log(`✅ Created ACTIVE lease for ${tenants[i].name} - ${monthlyRent.toFixed(2)} CHF/month`);
  }

  console.log('\n💰 Creating invoices...\n');

  // First create some jobs (invoices require jobId)
  const jobs = [];
  const jobData = [
    { title: 'Plumbing Repair - Building A', cost: 450 },
    { title: 'Electrical Work - Unit 3A', cost: 320 },
    { title: 'Painting Services - Building B', cost: 1280 },
    { title: 'HVAC Maintenance', cost: 670 },
    { title: 'Emergency Locksmith - Unit 2B', cost: 180 }
  ];

  // Create maintenance requests and jobs for the invoices
  const contractor = await prisma.contractor.findFirst({ where: { orgId: 'default-org' } });
  if (!contractor) {
    console.log('⚠️  No contractor found - skipping job and invoice creation');
  } else {
    for (const jobInfo of jobData) {
      // Create a request first
      const request = await prisma.request.create({
        data: {
          unitId: units[0].id,
          tenantId: tenants[0].id,
          category: 'lighting',
          description: jobInfo.title,
          estimatedCost: jobInfo.cost,
          status: 'COMPLETED',
          completedAt: new Date('2026-02-20')
        }
      });

      // Create a job for the request
      const job = await prisma.job.create({
        data: {
          orgId: 'default-org',
          requestId: request.id,
          contractorId: contractor.id,
          status: 'COMPLETED',
          actualCost: jobInfo.cost
        }
      });
      jobs.push(job);
    }
    console.log(`✅ Created ${jobs.length} jobs\n`);

    // Create some DRAFT invoices (for pending approvals)
    const draftInvoice1 = await prisma.invoice.create({
      data: {
        orgId: 'default-org',
        jobId: jobs[0].id,
        status: 'DRAFT',
        dueDate: new Date('2026-03-15'),
        
        // Recipient (property management)
        recipientName: 'Property Management AG',
        recipientAddressLine1: 'Hauptstrasse 123',
        recipientPostalCode: '8001',
        recipientCity: 'Zürich',
        recipientCountry: 'CH',
        
        // Amounts (450 CHF total)
        subtotalAmount: 41806, // cents (450 / 1.077)
        vatAmount: 3194, // cents (7.7%)
        totalAmount: 45000, // cents
        amount: 450, // CHF (legacy field)
        description: 'Plumbing Repair - Building A',
        
        // Line items
        lineItems: {
          create: [
            { description: 'Labor', quantity: 3, unitPrice: 12000, vatRate: 7.7, lineTotal: 38772 },
            { description: 'Parts', quantity: 1, unitPrice: 9000, vatRate: 7.7, lineTotal: 9693 }
          ]
        }
      }
    });
    console.log(`✅ Created DRAFT invoice: ${draftInvoice1.description} - ${(draftInvoice1.totalAmount / 100).toFixed(2)} CHF`);

    const draftInvoice2 = await prisma.invoice.create({
      data: {
        orgId: 'default-org',
        jobId: jobs[1].id,
        status: 'DRAFT',
        dueDate: new Date('2026-03-20'),
        
        recipientName: 'Property Management AG',
        recipientAddressLine1: 'Hauptstrasse 123',
        recipientPostalCode: '8001',
        recipientCity: 'Zürich',
        recipientCountry: 'CH',
        
        // Amounts (320 CHF total)
        subtotalAmount: 29713,
        vatAmount: 2287,
        totalAmount: 32000,
        amount: 320,
        description: 'Electrical Work - Unit 3A',
        
        lineItems: {
          create: [
            { description: 'Installation', quantity: 2, unitPrice: 16000, vatRate: 7.7, lineTotal: 34464 }
          ]
        }
      }
    });
    console.log(`✅ Created DRAFT invoice: ${draftInvoice2.description} - ${(draftInvoice2.totalAmount / 100).toFixed(2)} CHF`);

    // Create APPROVED invoices (for outstanding liabilities)
    const approvedInvoice1 = await prisma.invoice.create({
      data: {
        orgId: 'default-org',
        jobId: jobs[2].id,
        status: 'APPROVED',
        dueDate: new Date('2026-03-10'),
        approvedAt: new Date('2026-02-25'),
        
        recipientName: 'Property Management AG',
        recipientAddressLine1: 'Hauptstrasse 123',
        recipientPostalCode: '8001',
        recipientCity: 'Zürich',
        recipientCountry: 'CH',
        
        // Amounts (1280 CHF total)
        subtotalAmount: 118849,
        vatAmount: 9151,
        totalAmount: 128000,
        amount: 1280,
        description: 'Painting Services - Building B',
        
        lineItems: {
          create: [
            { description: 'Interior painting', quantity: 8, unitPrice: 16000, vatRate: 7.7, lineTotal: 137856 }
          ]
        }
      }
    });
    console.log(`✅ Created APPROVED invoice: ${approvedInvoice1.description} - ${(approvedInvoice1.totalAmount / 100).toFixed(2)} CHF`);

    const approvedInvoice2 = await prisma.invoice.create({
      data: {
        orgId: 'default-org',
        jobId: jobs[3].id,
        status: 'APPROVED',
        dueDate: new Date('2026-03-05'),
        approvedAt: new Date('2026-02-23'),
        
        recipientName: 'Property Management AG',
        recipientAddressLine1: 'Hauptstrasse 123',
        recipientPostalCode: '8001',
        recipientCity: 'Zürich',
        recipientCountry: 'CH',
        
        // Amounts (670 CHF total)
        subtotalAmount: 62210,
        vatAmount: 4790,
        totalAmount: 67000,
        amount: 670,
        description: 'HVAC Maintenance',
        
        lineItems: {
          create: [
            { description: 'Service call', quantity: 1, unitPrice: 15000, vatRate: 7.7, lineTotal: 16155 },
            { description: 'Filter replacement', quantity: 4, unitPrice: 13000, vatRate: 7.7, lineTotal: 56004 }
          ]
        }
      }
    });
    console.log(`✅ Created APPROVED invoice: ${approvedInvoice2.description} - ${(approvedInvoice2.totalAmount / 100).toFixed(2)} CHF`);

    // Create a PAID invoice (for history)
    const paidInvoice = await prisma.invoice.create({
      data: {
        orgId: 'default-org',
        jobId: jobs[4].id,
        status: 'PAID',
        dueDate: new Date('2026-02-15'),
        approvedAt: new Date('2026-02-10'),
        paidAt: new Date('2026-02-14'),
        
        recipientName: 'Property Management AG',
        recipientAddressLine1: 'Hauptstrasse 123',
        recipientPostalCode: '8001',
        recipientCity: 'Zürich',
        recipientCountry: 'CH',
        
        // Amounts (180 CHF total)
        subtotalAmount: 16713,
        vatAmount: 1287,
        totalAmount: 18000,
        amount: 180,
        description: 'Emergency Locksmith - Unit 2B',
        
        lineItems: {
          create: [
            { description: 'Lock replacement', quantity: 1, unitPrice: 18000, vatRate: 7.7, lineTotal: 19386 }
          ]
        }
      }
    });
    console.log(`✅ Created PAID invoice: ${paidInvoice.description} - ${(paidInvoice.totalAmount / 100).toFixed(2)} CHF`);
  }

  console.log('\n🎉 Dashboard data seeding complete!\n');
  console.log('Summary:');
  console.log(`- Tenants created: ${tenants.length}`);
  console.log(`- Active leases: 3 (vacancy rate should now be ~40%)`);
  if (jobs.length > 0) {
    console.log(`- Jobs created: ${jobs.length}`);
    console.log(`- DRAFT invoices: 2 (total: 770.00 CHF)`);
    console.log(`- APPROVED invoices: 2 (liabilities: 1950.00 CHF)`);
    console.log(`- PAID invoices: 1`);
  }
}

seedDashboardData()
  .catch(e => {
    console.error('❌ Error seeding data:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
