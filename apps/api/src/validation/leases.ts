import { z } from 'zod';

export const CreateLeaseSchema = z.object({
  unitId: z.string().uuid('Invalid unit ID'),

  // Parties — §1.1 Landlord (can override org defaults)
  landlordName: z.string().min(1).max(200).optional(),
  landlordAddress: z.string().min(1).max(300).optional(),
  landlordZipCity: z.string().min(1).max(200).optional(),
  landlordPhone: z.string().max(30).optional(),
  landlordEmail: z.string().email().optional(),
  landlordRepresentedBy: z.string().max(200).optional(),

  // Parties — §1.2 Tenant
  tenantName: z.string().min(1, 'Tenant name is required').max(200),
  tenantAddress: z.string().max(300).optional(),
  tenantZipCity: z.string().max(200).optional(),
  tenantPhone: z.string().max(30).optional(),
  tenantEmail: z.string().email().optional(),
  coTenantName: z.string().max(200).optional(),

  // Object — §2
  objectType: z.enum(['APPARTEMENT', 'MAISON', 'CHAMBRE_MEUBLEE']).optional(),
  roomsCount: z.string().max(10).optional(),
  floor: z.string().max(10).optional(),
  usageFlags: z.record(z.string(), z.boolean()).optional(),
  serviceSpaces: z.record(z.string(), z.any()).optional(),
  commonInstallations: z.record(z.string(), z.any()).optional(),

  // Dates — §3–4
  startDate: z.string().refine(
    (val) => !isNaN(Date.parse(val)),
    { message: 'Invalid start date' }
  ),
  isFixedTerm: z.boolean().optional(),
  endDate: z.string().refine(
    (val) => !isNaN(Date.parse(val)),
    { message: 'Invalid end date' }
  ).optional(),
  firstTerminationDate: z.string().refine(
    (val) => !isNaN(Date.parse(val)),
    { message: 'Invalid first termination date' }
  ).optional(),
  noticeRule: z.enum(['3_MONTHS', 'EXTENDED', '2_WEEKS']).optional(),
  extendedNoticeText: z.string().max(500).optional(),
  terminationDatesRule: z.enum(['END_OF_MONTH_EXCEPT_31_12', 'CUSTOM']).optional(),
  terminationDatesCustomText: z.string().max(500).optional(),

  // Rent & charges — §5–6
  netRentChf: z.number().int().min(0).max(100000),
  garageRentChf: z.number().int().min(0).max(100000).optional(),
  otherServiceRentChf: z.number().int().min(0).max(100000).optional(),
  chargesItems: z.array(
    z.object({
      label: z.string().min(1),
      mode: z.enum(['ACOMPTE', 'FORFAIT']),
      amountChf: z.number().int().min(0),
    })
  ).optional(),
  chargesTotalChf: z.number().int().min(0).max(100000).optional(),
  chargesSettlementDate: z.string().max(50).optional(),
  paymentDueDayOfMonth: z.number().int().min(1).max(31).optional(),
  paymentRecipient: z.string().max(300).optional(),
  paymentInstitution: z.string().max(300).optional(),
  paymentAccountNumber: z.string().max(50).optional(),
  paymentIban: z.string().max(50).optional(),
  referenceRatePercent: z.string().max(20).optional(),
  referenceRateDate: z.string().max(20).optional(),

  // Deposit — §7
  depositChf: z.number().int().min(0).max(100000).optional(),
  depositDueRule: z.enum(['AT_SIGNATURE', 'BY_START', 'BY_DATE']).optional(),
  depositDueDate: z.string().refine(
    (val) => !isNaN(Date.parse(val)),
    { message: 'Invalid deposit due date' }
  ).optional(),

  // §15
  otherStipulations: z.string().max(5000).optional(),
  includesHouseRules: z.boolean().optional(),
  otherAnnexesText: z.string().max(2000).optional(),
});

export const UpdateLeaseSchema = z.object({
  // Parties
  tenantName: z.string().min(1).max(200).optional(),
  tenantAddress: z.string().max(300).nullable().optional(),
  tenantZipCity: z.string().max(200).nullable().optional(),
  tenantPhone: z.string().max(30).nullable().optional(),
  tenantEmail: z.string().email().nullable().optional(),
  coTenantName: z.string().max(200).nullable().optional(),

  landlordName: z.string().min(1).max(200).optional(),
  landlordAddress: z.string().min(1).max(300).optional(),
  landlordZipCity: z.string().min(1).max(200).optional(),
  landlordPhone: z.string().max(30).nullable().optional(),
  landlordEmail: z.string().email().nullable().optional(),
  landlordRepresentedBy: z.string().max(200).nullable().optional(),

  // Object
  objectType: z.enum(['APPARTEMENT', 'MAISON', 'CHAMBRE_MEUBLEE']).optional(),
  roomsCount: z.string().max(10).nullable().optional(),
  floor: z.string().max(10).nullable().optional(),
  usageFlags: z.record(z.string(), z.boolean()).nullable().optional(),
  serviceSpaces: z.record(z.string(), z.any()).nullable().optional(),
  commonInstallations: z.record(z.string(), z.any()).nullable().optional(),

  // Dates
  startDate: z.string().refine(
    (val) => !isNaN(Date.parse(val)),
    { message: 'Invalid start date' }
  ).optional(),
  isFixedTerm: z.boolean().optional(),
  endDate: z.string().refine(
    (val) => !isNaN(Date.parse(val)),
    { message: 'Invalid end date' }
  ).nullable().optional(),
  firstTerminationDate: z.string().refine(
    (val) => !isNaN(Date.parse(val)),
    { message: 'Invalid first termination date' }
  ).nullable().optional(),
  noticeRule: z.enum(['3_MONTHS', 'EXTENDED', '2_WEEKS']).optional(),
  extendedNoticeText: z.string().max(500).nullable().optional(),
  terminationDatesRule: z.enum(['END_OF_MONTH_EXCEPT_31_12', 'CUSTOM']).optional(),
  terminationDatesCustomText: z.string().max(500).nullable().optional(),

  // Rent & charges
  netRentChf: z.number().int().min(0).max(100000).optional(),
  garageRentChf: z.number().int().min(0).max(100000).nullable().optional(),
  otherServiceRentChf: z.number().int().min(0).max(100000).nullable().optional(),
  chargesItems: z.array(
    z.object({
      label: z.string().min(1),
      mode: z.enum(['ACOMPTE', 'FORFAIT']),
      amountChf: z.number().int().min(0),
    })
  ).nullable().optional(),
  chargesTotalChf: z.number().int().min(0).max(100000).nullable().optional(),
  chargesSettlementDate: z.string().max(50).nullable().optional(),
  paymentDueDayOfMonth: z.number().int().min(1).max(31).nullable().optional(),
  paymentRecipient: z.string().max(300).nullable().optional(),
  paymentInstitution: z.string().max(300).nullable().optional(),
  paymentAccountNumber: z.string().max(50).nullable().optional(),
  paymentIban: z.string().max(50).nullable().optional(),
  referenceRatePercent: z.string().max(20).nullable().optional(),
  referenceRateDate: z.string().max(20).nullable().optional(),

  // Deposit
  depositChf: z.number().int().min(0).max(100000).nullable().optional(),
  depositDueRule: z.enum(['AT_SIGNATURE', 'BY_START', 'BY_DATE']).optional(),
  depositDueDate: z.string().refine(
    (val) => !isNaN(Date.parse(val)),
    { message: 'Invalid deposit due date' }
  ).nullable().optional(),

  // Stipulations
  otherStipulations: z.string().max(5000).nullable().optional(),
  includesHouseRules: z.boolean().optional(),
  otherAnnexesText: z.string().max(2000).nullable().optional(),
});

export const ReadyToSignSchema = z.object({
  level: z.enum(['SES', 'AES', 'QES']).optional().default('SES'),
  signers: z.array(z.object({
    role: z.enum(['TENANT', 'CO_TENANT', 'LANDLORD']),
    name: z.string().min(1),
    email: z.string().email(),
    phone: z.string().optional(),
  })).min(1, 'At least one signer is required').optional(),
});

export type CreateLeasePayload = z.infer<typeof CreateLeaseSchema>;
export type UpdateLeasePayload = z.infer<typeof UpdateLeaseSchema>;
export type ReadyToSignPayload = z.infer<typeof ReadyToSignSchema>;

// ─── LeaseExpenseItem schemas ────────────────────────────

export const CreateExpenseItemSchema = z.object({
  description: z.string().min(1, "description is required"),
  amountChf: z.number().positive("amountChf must be positive"),
  mode: z.enum(["ACOMPTE", "FORFAIT"]).optional(),
  expenseTypeId: z.string().uuid().optional(),
  accountId: z.string().uuid().optional(),
});

export const UpdateExpenseItemSchema = z.object({
  description: z.string().min(1).optional(),
  amountChf: z.number().positive().optional(),
  mode: z.enum(["ACOMPTE", "FORFAIT"]).optional(),
  expenseTypeId: z.string().uuid().nullable().optional(),
  accountId: z.string().uuid().nullable().optional(),
  isActive: z.boolean().optional(),
});

export type CreateExpenseItemPayload = z.infer<typeof CreateExpenseItemSchema>;
export type UpdateExpenseItemPayload = z.infer<typeof UpdateExpenseItemSchema>;
