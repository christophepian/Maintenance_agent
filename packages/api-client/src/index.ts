/**
 * Maintenance Agent — Typed API Client
 *
 * Zero-dependency, fetch-based client generated from the OpenAPI 3.1 spec.
 * Provides full TypeScript type coverage for all API endpoints.
 *
 * Usage:
 *   import { createApiClient } from "./apiClient";
 *   const api = createApiClient("http://localhost:3001");
 *   const { data } = await api.requests.list({ limit: 10 });
 */

/* Re-export legal domain types (Phase D) */
export * from "./legal";

/* Re-export strategy engine types (Phase 1) */
export * from "./strategy";

/* Re-export recommendation types (Phase 2) */
export * from "./recommendations";

/* ═══════════════════════════════════════════════════════════════
 * Enums
 * ═══════════════════════════════════════════════════════════════ */

export type RequestStatus =
  | "PENDING_REVIEW"
  | "PENDING_OWNER_APPROVAL"
  | "AUTO_APPROVED"
  | "APPROVED"
  | "ASSIGNED"
  | "RFP_PENDING"
  | "IN_PROGRESS"
  | "COMPLETED"
  | "REJECTED";

export type PayingParty = "LANDLORD" | "TENANT";

export type JobStatus = "PENDING" | "IN_PROGRESS" | "COMPLETED" | "INVOICED";

export type InvoiceStatus = "DRAFT" | "APPROVED" | "PAID" | "DISPUTED" | "ISSUED";

export type InvoiceDirection = "OUTGOING" | "INCOMING";

export type InvoiceSourceChannel = "MANUAL" | "BROWSER_UPLOAD" | "EMAIL_PDF" | "MOBILE_CAPTURE";

export type IngestionStatus = "PENDING_REVIEW" | "CONFIRMED" | "AUTO_CONFIRMED" | "REJECTED";

export type CaptureSessionStatus = "CREATED" | "ACTIVE" | "COMPLETED" | "EXPIRED" | "CANCELLED";

export type LeaseStatus =
  | "DRAFT"
  | "READY_TO_SIGN"
  | "SIGNED"
  | "ACTIVE"
  | "TERMINATED"
  | "CANCELLED";

export type SignatureRequestStatus =
  | "DRAFT"
  | "SENT"
  | "SIGNED"
  | "DECLINED"
  | "EXPIRED"
  | "ERROR";

export type RequestEventType =
  | "ARRIVED"
  | "PARTS_ORDERED"
  | "COMPLETED"
  | "OWNER_APPROVED"
  | "REJECTED"
  | "NOTE"
  | "OTHER";

export type RuleAction =
  | "AUTO_APPROVE"
  | "REQUIRE_MANAGER_REVIEW"
  | "REQUIRE_OWNER_APPROVAL";

export type BillingEntityType = "CONTRACTOR" | "ORG" | "OWNER";

export type UnitType = "RESIDENTIAL" | "COMMON_AREA";

export type Role = "TENANT" | "CONTRACTOR" | "MANAGER" | "OWNER";

export type RentalApplicationStatus = "DRAFT" | "SUBMITTED";

export type ApplicantRole = "PRIMARY" | "CO_APPLICANT";

export type RentalDocType =
  | "IDENTITY"
  | "SALARY_PROOF"
  | "PERMIT"
  | "DEBT_ENFORCEMENT_EXTRACT"
  | "HOUSEHOLD_INSURANCE"
  | "PARKING_DOCS";

export type RentalApplicationUnitStatus =
  | "SUBMITTED"
  | "REJECTED"
  | "SELECTED_PRIMARY"
  | "SELECTED_BACKUP_1"
  | "SELECTED_BACKUP_2"
  | "AWAITING_SIGNATURE"
  | "SIGNED"
  | "VOIDED";

export type RentalOwnerSelectionStatus =
  | "AWAITING_SIGNATURE"
  | "SIGNED"
  | "VOIDED"
  | "FALLBACK_1"
  | "FALLBACK_2"
  | "EXHAUSTED";

export type LocationSegment = "PRIME" | "STANDARD" | "PERIPHERY";

export type InsulationQuality = "UNKNOWN" | "POOR" | "AVERAGE" | "GOOD" | "EXCELLENT";

export type EnergyLabel = "A" | "B" | "C" | "D" | "E" | "F" | "G";

export type HeatingType = "HEAT_PUMP" | "DISTRICT" | "GAS" | "OIL" | "ELECTRIC" | "UNKNOWN";

export type EmailOutboxStatus = "PENDING" | "SENT" | "FAILED";

export type EmailTemplate = "MISSING_DOCS" | "REJECTED" | "SELECTED_LEASE_LINK";

export type AssetType = "APPLIANCE" | "FIXTURE" | "FINISH" | "STRUCTURAL" | "SYSTEM" | "OTHER";

export type AssetInterventionType = "REPAIR" | "REPLACEMENT";

export type RfpStatus = "DRAFT" | "OPEN" | "CLOSED" | "AWARDED" | "CANCELLED" | "PENDING_OWNER_APPROVAL";

export type RfpQuoteStatus = "SUBMITTED" | "AWARDED" | "REJECTED";

export type RfpInviteStatus = "INVITED" | "DECLINED" | "RESPONDED";

export type LegalObligation =
  | "NONE"
  | "UNKNOWN"
  | "MAINTENANCE_OBLIGATION"
  | "OWNER_OBLIGATION"
  | "TENANT_OBLIGATION"
  | "SHARED";

export type ExpenseCategory =
  | "MAINTENANCE"
  | "UTILITIES"
  | "CLEANING"
  | "INSURANCE"
  | "TAX"
  | "ADMIN"
  | "CAPEX"
  | "OTHER";

/* ═══════════════════════════════════════════════════════════════
 * DTO Interfaces
 * ═══════════════════════════════════════════════════════════════ */

export interface ContractorSummary {
  id: string;
  name: string;
  phone: string;
  email: string;
  hourlyRate?: number;
}

export interface TenantSummary {
  id: string;
  name: string | null;
  phone: string;
  email: string | null;
}

export interface UnitSummary {
  id: string;
  unitNumber: string;
  floor?: string;
  type?: string;
  building?: {
    id: string;
    name: string;
    address: string;
  };
}

export interface ApplianceSummary {
  id: string;
  category: string;
  serial?: string;
}

export interface MaintenanceRequestDTO {
  id: string;
  requestNumber: number;
  description: string;
  category: string | null;
  estimatedCost: number | null;
  status: RequestStatus;
  contactPhone?: string | null;
  tenantId?: string | null;
  unitId?: string | null;
  applianceId?: string | null;
  approvalSource?: string | null;
  rejectionReason?: string | null;
  payingParty?: PayingParty;
  assignedContractor: ContractorSummary | null;
  tenant?: TenantSummary | null;
  unit?: UnitSummary | null;
  appliance?: ApplianceSummary | null;
  createdAt: string;
}

/**
 * H5: Lightweight DTO for request list endpoints.
 * Reduces payload size by flattening nested relations to scalar fields.
 */
export interface MaintenanceRequestSummaryDTO {
  id: string;
  requestNumber: number;
  status: RequestStatus;
  createdAt: string;
  description: string;
  estimatedCost?: number | null;
  category?: string | null;
  unitNumber?: string | null;
  buildingName?: string | null;
  assignedContractorName?: string | null;
  payingParty?: PayingParty;
  approvalSource?: string | null;
}

export interface RequestEventDTO {
  id: string;
  requestId: string;
  contractorId: string;
  type: RequestEventType;
  message: string;
  timestamp: string;
}

export interface JobDTO {
  id: string;
  orgId: string;
  requestId: string;
  contractorId: string;
  status: JobStatus;
  actualCost?: number;
  startedAt?: string;
  completedAt?: string;
  createdAt: string;
  updatedAt: string;
  request?: {
    description: string;
    category?: string;
    contactPhone?: string;
    tenant?: TenantSummary;
    unit?: UnitSummary;
    appliance?: ApplianceSummary;
  };
  contractor?: ContractorSummary;
  appointmentSlots?: Array<{
    id: string;
    startTime: string;
    endTime: string;
    status: string;
  }>;
}

/**
 * H5: Lightweight DTO for job list endpoints.
 * Reduces payload size by omitting nested relations.
 */
export interface JobSummaryDTO {
  id: string;
  orgId: string;
  requestId: string;
  contractorId: string;
  status: JobStatus;
  actualCost?: number;
  startedAt?: string;
  completedAt?: string;
  createdAt: string;
  updatedAt: string;
  contractorName?: string;
  requestDescription?: string;
  unitNumber?: string;
  buildingName?: string;
}

export interface InvoiceLineItemDTO {
  id: string;
  description: string;
  quantity: number;
  unitPrice: number;
  vatRate: number;
  lineTotal: number;
}

export interface InvoiceDTO {
  id: string;
  orgId: string;
  jobId: string | null;
  amount: number;
  description?: string;
  issuerBillingEntityId?: string;
  recipientName: string;
  recipientAddressLine1: string;
  recipientAddressLine2?: string;
  recipientPostalCode: string;
  recipientCity: string;
  recipientCountry: string;
  issueDate?: string;
  dueDate?: string;
  invoiceNumber?: string;
  invoiceNumberFormat: string;
  subtotalAmount: number;
  vatAmount: number;
  totalAmount: number;
  currency: string;
  vatRate: number;
  paymentReference?: string;
  iban?: string;
  status: InvoiceStatus;
  lockedAt?: string;
  submittedAt?: string;
  approvedAt?: string;
  paidAt?: string;
  createdAt: string;
  updatedAt: string;
  lineItems: InvoiceLineItemDTO[];
  expenseCategory?: ExpenseCategory | null;
  expenseTypeId?: string | null;
  accountId?: string | null;
  expenseType?: { id: string; name: string; code: string | null } | null;
  account?: { id: string; name: string; code: string | null } | null;
  // INV-HUB ingestion fields
  direction: InvoiceDirection;
  sourceChannel: InvoiceSourceChannel;
  ingestionStatus?: IngestionStatus | null;
  rawOcrText?: string | null;
  ocrConfidence?: number | null;
  sourceFileUrl?: string | null;
  matchedJobId?: string | null;
  matchedLeaseId?: string | null;
  matchedBuildingId?: string | null;
  // Recurring billing fields
  isBackfilled: boolean;
  billingPeriodStart?: string | null;
  billingPeriodEnd?: string | null;
  billingScheduleId?: string | null;
}

/**
 * H5: Lightweight DTO for invoice list endpoints.
 * Reduces payload size by omitting line items and detailed billing fields.
 */
export interface InvoiceSummaryDTO {
  id: string;
  orgId: string;
  jobId: string | null;
  status: InvoiceStatus;
  invoiceNumber?: string | null;
  totalAmount: number;
  dueDate?: string | null;
  paidAt?: string | null;
  createdAt: string;
  description?: string;
  expenseCategory?: ExpenseCategory | null;
  // INV-HUB ingestion fields
  direction: InvoiceDirection;
  sourceChannel: InvoiceSourceChannel;
  ingestionStatus?: IngestionStatus | null;
  // Recurring billing fields
  isBackfilled: boolean;
  billingPeriodStart?: string | null;
  billingPeriodEnd?: string | null;
  billingScheduleId?: string | null;
}

/** Result from POST /invoices/ingest */
export interface IngestInvoiceResult {
  data: InvoiceDTO;
  scanResult: {
    docType: string;
    confidence: number;
    fields: Record<string, string | number | boolean | null>;
    summary: string;
  };
  ingestionStatus: IngestionStatus;
}

/** DTO returned by capture-session endpoints */
export interface CaptureSessionDTO {
  id: string;
  orgId: string;
  createdBy: string;
  status: CaptureSessionStatus;
  expiresAt: string;
  targetType: string;
  uploadedFileUrls: string[];
  createdInvoiceId: string | null;
  mobileUrl?: string;
  createdAt: string;
}

export interface LeaseDTO {
  id: string;
  orgId: string;
  status: LeaseStatus;
  applicationId?: string;
  unitId: string;
  landlordName: string;
  landlordAddress: string;
  landlordZipCity: string;
  landlordPhone?: string;
  landlordEmail?: string;
  landlordRepresentedBy?: string;
  tenantName: string;
  tenantAddress?: string;
  tenantZipCity?: string;
  tenantPhone?: string;
  tenantEmail?: string;
  coTenantName?: string;
  objectType: string;
  roomsCount?: string;
  floor?: string;
  buildingAddressLines?: string[];
  usageFlags?: Record<string, boolean>;
  serviceSpaces?: Record<string, unknown>;
  commonInstallations?: Record<string, unknown>;
  startDate: string;
  isFixedTerm: boolean;
  endDate?: string;
  firstTerminationDate?: string;
  noticeRule: string;
  extendedNoticeText?: string;
  terminationDatesRule: string;
  terminationDatesCustomText?: string;
  netRentChf: number;
  garageRentChf?: number;
  otherServiceRentChf?: number;
  chargesItems?: Array<{ label: string; mode: string; amountChf: number }>;
  chargesTotalChf?: number;
  rentTotalChf?: number;
  chargesSettlementDate?: string;
  paymentDueDayOfMonth?: number;
  paymentRecipient?: string;
  paymentInstitution?: string;
  paymentAccountNumber?: string;
  paymentIban?: string;
  referenceRatePercent?: string;
  referenceRateDate?: string;
  depositChf?: number;
  depositDueRule: string;
  depositDueDate?: string;
  otherStipulations?: string;
  includesHouseRules: boolean;
  otherAnnexesText?: string;
  draftPdfStorageKey?: string;
  draftPdfSha256?: string;
  signedPdfStorageKey?: string;
  signedPdfSha256?: string;
  depositPaidAt?: string;
  depositConfirmedBy?: string;
  depositBankRef?: string;
  activatedAt?: string;
  terminatedAt?: string;
  terminationReason?: string;
  terminationNotice?: string;
  archivedAt?: string;
  sentForSignatureAt?: string;
  createdAt: string;
  updatedAt: string;
  unit?: UnitSummary;
  expenseItems?: LeaseExpenseItemDTO[];
}

export interface LeaseExpenseItemDTO {
  id: string;
  leaseId: string;
  description: string;
  amountChf: number;
  mode: 'ACOMPTE' | 'FORFAIT';
  expenseTypeId?: string;
  accountId?: string;
  expenseType?: { id: string; name: string; code?: string };
  account?: { id: string; name: string; code?: string };
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface SignatureRequestDTO {
  id: string;
  leaseId: string;
  provider?: string;
  level?: string;
  status: SignatureRequestStatus;
  sentAt?: string;
  signedAt?: string;
  expiresAt?: string;
  createdAt: string;
  updatedAt: string;
}

export interface OrgConfigDTO {
  id: string;
  orgId: string;
  autoApproveLimit: number;
  autoLegalRouting: boolean;
  invoiceLeadTimeDays: number;
  mode: string;
  landlordName?: string;
  landlordAddress?: string;
  landlordZipCity?: string;
  landlordPhone?: string;
  landlordEmail?: string;
  landlordRepresentedBy?: string;
}

export type BillingScheduleStatus = "ACTIVE" | "PAUSED" | "COMPLETED";

export interface BillingScheduleDTO {
  id: string;
  orgId: string;
  leaseId: string;
  status: BillingScheduleStatus;
  anchorDay: number;
  nextPeriodStart: string;
  lastGeneratedPeriod: string | null;
  baseRentCents: number;
  totalChargesCents: number;
  createdAt: string;
  updatedAt: string;
  completedAt: string | null;
  completionReason: string | null;
  lease: {
    id: string;
    tenantName: string;
    startDate: string;
    endDate: string | null;
    status: string;
    netRentChf: number;
    chargesTotalChf: number;
    unitId: string;
  } | null;
}

export interface BuildingConfigDTO {
  id: string;
  buildingId: string;
  orgId: string;
}

export interface UnitConfigDTO {
  id: string;
  unitId: string;
  orgId: string;
}

export interface ApprovalRuleDTO {
  id: string;
  orgId: string;
  buildingId?: string;
  name: string;
  priority: number;
  isActive: boolean;
  conditions: string;
  action: RuleAction;
  createdAt: string;
  updatedAt: string;
}

export interface BillingEntityDTO {
  id: string;
  orgId: string;
  type: BillingEntityType;
  name: string;
  addressLine1?: string;
  addressLine2?: string;
  postalCode?: string;
  city?: string;
  country?: string;
  iban?: string;
  vatNumber?: string;
  isDefault?: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface BuildingDTO {
  id: string;
  orgId: string;
  name: string;
  address: string;
  city?: string;
  postalCode?: string;
  yearBuilt?: number;
  hasElevator?: boolean;
  hasConcierge?: boolean;
  createdAt: string;
}

export interface UnitDTO {
  id: string;
  orgId: string;
  buildingId: string;
  unitNumber: string;
  floor?: string;
  type: UnitType;
  livingAreaSqm?: number;
  rooms?: number;
  hasBalcony?: boolean;
  hasTerrace?: boolean;
  hasParking?: boolean;
  locationSegment?: LocationSegment;
  lastRenovationYear?: number;
  insulationQuality?: InsulationQuality;
  energyLabel?: EnergyLabel;
  heatingType?: HeatingType;
  building?: {
    id: string;
    name: string;
    address: string;
  };
}

export interface ApplianceDTO {
  id: string;
  unitId: string;
  orgId: string;
  category: string;
  serial?: string;
  assetModelId?: string;
  installedDate?: string;
  lastServiceDate?: string;
  assetModel?: AssetModelDTO;
}

export interface AssetModelDTO {
  id: string;
  orgId: string;
  brand: string;
  model: string;
  category: string;
  expectedLifespanYears?: number;
}

export interface AssetInterventionDTO {
  id: string;
  type: AssetInterventionType;
  interventionDate: string;
  costChf?: number;
  jobId?: string;
  jobStatus?: string;
  notes?: string;
  createdAt: string;
}

export interface DepreciationInfoDTO {
  usefulLifeMonths: number;
  ageMonths: number;
  depreciationPct: number;
  residualPct: number;
  clockStart: string | null;
  standardId: string | null;
}

export interface AssetInventoryItemDTO {
  id: string;
  orgId: string;
  unitId: string;
  type: AssetType;
  topic: string;
  name: string;
  brand?: string;
  modelNumber?: string;
  serialNumber?: string;
  notes?: string;
  assetModelId?: string;
  installedAt?: string;
  lastRenovatedAt?: string;
  replacedAt?: string;
  isPresent: boolean;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
  depreciation: DepreciationInfoDTO | null;
  interventions: AssetInterventionDTO[];
  unit?: { id: string; unitNumber: string };
}

export interface UpsertAssetBody {
  unitId: string;
  type: AssetType;
  topic: string;
  name: string;
  assetModelId?: string;
  installedAt?: string;
  lastRenovatedAt?: string;
  replacedAt?: string;
  brand?: string;
  modelNumber?: string;
  serialNumber?: string;
  notes?: string;
  isPresent?: boolean;
}

export interface AddInterventionBody {
  type: AssetInterventionType;
  interventionDate: string;
  costChf?: number;
  jobId?: string;
  notes?: string;
}

export interface TenantDTO {
  id: string;
  orgId: string;
  name: string;
  phone: string;
  email?: string;
  unitId?: string;
}

export interface RentEstimationConfigDTO {
  id: string;
  orgId: string;
  canton: string | null;
  baseRentPerSqmChfMonthly: number;
  locationCoefPrime: number;
  locationCoefStandard: number;
  locationCoefPeriphery: number;
  ageCoefNew: number;
  ageCoefMid: number;
  ageCoefOld: number;
  ageCoefVeryOld: number;
  energyCoefJson: Record<string, number>;
  chargesBaseOptimistic: number;
  chargesBasePessimistic: number;
  heatingChargeAdjJson: Record<string, number>;
  serviceChargeAdjElevator: number;
  serviceChargeAdjConcierge: number;
  chargesMinClamp: number;
  chargesMaxClamp: number;
  createdAt: string;
  updatedAt: string;
}

export interface RentEstimateDTO {
  unitId: string;
  netRentChfMonthly: number;
  chargesOptimisticChfMonthly: number;
  chargesPessimisticChfMonthly: number;
  totalOptimisticChfMonthly: number;
  totalPessimisticChfMonthly: number;
  appliedCoefficients: {
    baseRentPerSqm: number;
    locationCoef: number;
    ageCoef: number;
    energyCoef: number;
    chargesRateOptimistic: number;
    chargesRatePessimistic: number;
    heatingAdj: number;
    serviceAdj: number;
    clampsApplied?: { optimistic?: boolean; pessimistic?: boolean };
  };
  inputsUsed: {
    livingAreaSqm: number;
    segment: string;
    effectiveYear: number | null;
    energyLabel: string | null;
    heatingType: string | null;
    hasElevator: boolean;
    hasConcierge: boolean;
  };
  warnings: string[];
}

export interface ContractorDTO {
  id: string;
  orgId: string;
  name: string;
  phone: string;
  email?: string;
  specialties?: string[];
  hourlyRate?: number;
}

export interface NotificationDTO {
  id: string;
  orgId: string;
  eventType: string;
  message: string;
  isRead: boolean;
  requestId?: string;
  jobId?: string;
  invoiceId?: string;
  actorName?: string;
  metadata?: Record<string, unknown>;
  createdAt: string;
}

/* ═══════════════════════════════════════════════════════════════
 * Rental Application DTOs
 * ═══════════════════════════════════════════════════════════════ */

export interface RentalApplicantDTO {
  id: string;
  role: ApplicantRole;
  firstName: string;
  lastName: string;
  birthdate?: string;
  nationality?: string;
  civilStatus?: string;
  permitType?: string;
  phone?: string;
  email?: string;
  currentAddress?: string;
  currentZipCity?: string;
  employer?: string;
  jobTitle?: string;
  workLocation?: string;
  employedSince?: string;
  netMonthlyIncome?: number;
  hasDebtEnforcement?: boolean;
  attachments?: RentalAttachmentDTO[];
}

export interface RentalAttachmentDTO {
  id: string;
  applicantId: string;
  docType: RentalDocType;
  fileName: string;
  fileSizeBytes: number;
  mimeType: string;
  uploadedAt: string;
}

export interface RentalApplicationUnitDTO {
  id: string;
  applicationId: string;
  unitId: string;
  status: RentalApplicationUnitStatus;
  scoreTotal?: number;
  confidenceScore?: number;
  disqualified: boolean;
  disqualifiedReasons?: unknown;
  rank?: number;
  managerScoreDelta?: number;
  managerOverrideReason?: string;
  createdAt: string;
  unit?: {
    id: string;
    unitNumber: string;
    monthlyRentChf?: number;
    monthlyChargesChf?: number;
    building?: { id: string; name: string; address: string };
  };
}

export interface RentalApplicationDTO {
  id: string;
  orgId: string;
  status: RentalApplicationStatus;
  createdAt: string;
  updatedAt: string;
  submittedAt?: string;
  signedName?: string;
  signedAt?: string;
  currentLandlordName?: string;
  currentLandlordAddress?: string;
  currentLandlordPhone?: string;
  reasonForLeaving?: string;
  desiredMoveInDate?: string;
  householdSize?: number;
  hasPets?: boolean;
  petsDescription?: string;
  hasRcInsurance?: boolean;
  rcInsuranceCompany?: string;
  hasVehicle?: boolean;
  vehicleDescription?: string;
  needsParking?: boolean;
  remarks?: string;
  applicants?: RentalApplicantDTO[];
  applicationUnits?: RentalApplicationUnitDTO[];
}

export interface RentalApplicationSummaryDTO {
  id: string;
  orgId: string;
  status: RentalApplicationStatus;
  createdAt: string;
  submittedAt?: string;
  householdSize?: number;
  primaryApplicantName?: string;
  totalMonthlyIncome?: number;
  applicantCount: number;
  unitApplications: {
    id: string;
    unitId: string;
    status: RentalApplicationUnitStatus;
    scoreTotal?: number;
    confidenceScore?: number;
    disqualified: boolean;
    rank?: number;
  }[];
}

export interface RentalOwnerSelectionDTO {
  id: string;
  unitId: string;
  status: RentalOwnerSelectionStatus;
  createdAt: string;
  decidedAt?: string;
  deadlineAt: string;
  primaryApplicationUnitId: string;
  backup1ApplicationUnitId?: string;
  backup2ApplicationUnitId?: string;
}

export interface EmailOutboxDTO {
  id: string;
  orgId: string;
  toEmail: string;
  template: EmailTemplate;
  subject: string;
  bodyText: string;
  status: EmailOutboxStatus;
  metaJson?: unknown;
  createdAt: string;
}

export interface VacantUnitDTO {
  id: string;
  unitNumber: string;
  floor?: string;
  monthlyRentChf?: number;
  monthlyChargesChf?: number;
  building?: { id: string; name: string; address: string };
}

/* ═══════════════════════════════════════════════════════════════
 * Common types
 * ═══════════════════════════════════════════════════════════════ */

export interface PaginatedList<T> {
  data: T[];
  total: number;
  limit: number;
  offset: number;
}

export interface ApiError {
  error: {
    code: string;
    message: string;
    details?: unknown;
  };
}

export interface PaginationParams {
  limit?: number;
  offset?: number;
  order?: "asc" | "desc";
  status?: string;
}

/* ═══════════════════════════════════════════════════════════════
 * Client implementation
 * ═══════════════════════════════════════════════════════════════ */

export class ApiClientError extends Error {
  constructor(
    public readonly status: number,
    public readonly body: ApiError,
  ) {
    super(body.error?.message ?? `HTTP ${status}`);
    this.name = "ApiClientError";
  }

  get code(): string {
    return this.body.error?.code ?? "UNKNOWN";
  }
}

interface ClientOptions {
  baseUrl: string;
  headers?: Record<string, string>;
}

async function request<T>(
  opts: ClientOptions,
  method: string,
  path: string,
  body?: unknown,
  query?: Record<string, string | number | boolean | undefined>,
): Promise<T> {
  const url = new URL(path, opts.baseUrl);
  if (query) {
    for (const [k, v] of Object.entries(query)) {
      if (v !== undefined) url.searchParams.set(k, String(v));
    }
  }

  const headers: Record<string, string> = {
    ...opts.headers,
  };
  if (body !== undefined) {
    headers["content-type"] = "application/json";
  }

  let res: Response;
  try {
    res = await fetch(url.toString(), {
      method,
      headers,
      body: body !== undefined ? JSON.stringify(body) : undefined,
    });
  } catch (networkError: unknown) {
    // Network-level failure (ECONNREFUSED, DNS failure, offline, etc.)
    const msg = networkError instanceof Error ? networkError.message : String(networkError);
    throw new ApiClientError(0, {
      error: { code: "NETWORK_ERROR", message: `Unable to connect to API: ${msg}` },
    });
  }

  if (!res.ok) {
    let errorBody: ApiError;
    try {
      errorBody = await res.json();
    } catch {
      errorBody = {
        error: { code: "UNKNOWN", message: res.statusText },
      };
    }
    throw new ApiClientError(res.status, errorBody);
  }

  // 204 No Content
  if (res.status === 204) return undefined as T;

  const contentType = res.headers.get("content-type") ?? "";
  if (contentType.includes("application/json")) {
    return res.json();
  }

  // Binary responses (PDF, PNG)
  return res.blob() as Promise<T>;
}

/* ═══════════════════════════════════════════════════════════════
 * Resource namespaces
 * ═══════════════════════════════════════════════════════════════ */

function buildRequestsApi(opts: ClientOptions) {
  return {
    list: (params?: PaginationParams & { view?: "summary" | "full" }) =>
      request<PaginatedList<MaintenanceRequestDTO | MaintenanceRequestSummaryDTO>>(opts, "GET", "/requests", undefined, params as Record<string, string | number | boolean | undefined>),

    get: (id: string) =>
      request<MaintenanceRequestDTO>(opts, "GET", `/requests/${id}`),

    create: (body: {
      description: string;
      category?: string;
      estimatedCost?: number;
      contactPhone?: string;
      tenantId?: string;
      unitId?: string;
      applianceId?: string;
    }) => request<MaintenanceRequestDTO>(opts, "POST", "/requests", body),

    listEvents: (id: string) =>
      request<RequestEventDTO[]>(opts, "GET", `/requests/${id}/events`),

    createEvent: (id: string, body: { type: RequestEventType; message: string; contractorId: string }) =>
      request<RequestEventDTO>(opts, "POST", `/requests/${id}/events`, body),

    ownerApprove: (id: string) =>
      request<MaintenanceRequestDTO>(opts, "POST", `/requests/${id}/owner-approve`, {}),

    ownerReject: (id: string, body?: { reason?: string }) =>
      request<MaintenanceRequestDTO>(opts, "POST", `/requests/${id}/owner-reject`, body ?? {}),

    updateStatus: (id: string, body: { status: RequestStatus }) =>
      request<MaintenanceRequestDTO>(opts, "PATCH", `/requests/${id}/status`, body),

    assign: (id: string, body: { contractorId: string }) =>
      request<unknown>(opts, "POST", `/requests/${id}/assign`, body),

    unassign: (id: string) =>
      request<unknown>(opts, "DELETE", `/requests/${id}/assign`),

    suggestContractor: (id: string) =>
      request<unknown>(opts, "GET", `/requests/${id}/suggest-contractor`),

    listByContractor: (contractorId: string) =>
      request<MaintenanceRequestDTO[]>(opts, "GET", `/requests/contractor/${contractorId}`),

    listContractorRequests: (params?: { limit?: number; offset?: number }) =>
      request<MaintenanceRequestDTO[]>(opts, "GET", "/requests/contractor", undefined, params as Record<string, string | number | boolean | undefined>),

    listOwnerPendingApprovals: (params?: { limit?: number; offset?: number }) =>
      request<{ data: MaintenanceRequestDTO[]; total: number }>(opts, "GET", "/owner/pending-approvals", undefined, params as Record<string, string | number | boolean | undefined>),

    matchContractors: (params?: { category?: string }) =>
      request<ContractorDTO[]>(opts, "GET", "/contractors/match", undefined, params as Record<string, string | number | boolean | undefined>),
  };
}

function buildWorkRequestsApi(opts: ClientOptions) {
  return {
    list: (params?: { limit?: number; offset?: number }) =>
      request<MaintenanceRequestDTO[]>(opts, "GET", "/work-requests", undefined, params as Record<string, string | number | boolean | undefined>),

    get: (id: string) =>
      request<MaintenanceRequestDTO>(opts, "GET", `/work-requests/${id}`),

    create: (body: {
      description: string;
      category?: string;
      estimatedCost?: number;
      contactPhone?: string;
      tenantId?: string;
      unitId?: string;
      applianceId?: string;
    }) => request<MaintenanceRequestDTO>(opts, "POST", "/work-requests", body),
  };
}

function buildJobsApi(opts: ClientOptions) {
  return {
    list: (params?: PaginationParams & { view?: "summary" | "full" }) =>
      request<PaginatedList<JobDTO | JobSummaryDTO>>(opts, "GET", "/jobs", undefined, params as Record<string, string | number | boolean | undefined>),

    get: (id: string) =>
      request<JobDTO>(opts, "GET", `/jobs/${id}`),

    update: (id: string, body: { status?: JobStatus; actualCost?: number }) =>
      request<JobDTO>(opts, "PATCH", `/jobs/${id}`, body),
  };
}

function buildInvoicesApi(opts: ClientOptions) {
  return {
    list: (params?: PaginationParams & { view?: "summary" | "full" }) =>
      request<PaginatedList<InvoiceDTO | InvoiceSummaryDTO>>(opts, "GET", "/invoices", undefined, params as Record<string, string | number | boolean | undefined>),

    get: (id: string) =>
      request<InvoiceDTO>(opts, "GET", `/invoices/${id}`),

    create: (body: {
      jobId: string;
      description?: string;
      expenseTypeId?: string;
      accountId?: string;
      lineItems?: Array<{
        description: string;
        quantity: number;
        unitPrice: number;
        vatRate?: number;
      }>;
    }) => request<InvoiceDTO>(opts, "POST", "/invoices", body),

    issue: (id: string) =>
      request<InvoiceDTO>(opts, "POST", `/invoices/${id}/issue`, {}),

    approve: (id: string) =>
      request<InvoiceDTO>(opts, "POST", `/invoices/${id}/approve`, {}),

    markPaid: (id: string) =>
      request<InvoiceDTO>(opts, "POST", `/invoices/${id}/mark-paid`, {}),

    dispute: (id: string, body?: { reason?: string }) =>
      request<InvoiceDTO>(opts, "POST", `/invoices/${id}/dispute`, body ?? {}),

    listOwnerInvoices: (params?: { limit?: number; offset?: number }) =>
      request<{ data: InvoiceDTO[]; total: number }>(opts, "GET", "/owner/invoices", undefined, params as Record<string, string | number | boolean | undefined>),

    getQrBill: (id: string) =>
      request<unknown>(opts, "GET", `/invoices/${id}/qr-bill`),

    getPdf: (id: string, includeQRBill?: boolean) =>
      request<Blob>(opts, "GET", `/invoices/${id}/pdf`, undefined, { includeQRBill }),

    setExpenseCategory: (id: string, body: { expenseCategory: ExpenseCategory }) =>
      request<{ data: { id: string; expenseCategory: ExpenseCategory } }>(
        opts, "POST", `/invoices/${id}/set-expense-category`, body,
      ),

    /**
     * Ingest an invoice document via OCR scanning.
     * Requires multipart/form-data with a "file" field.
     * Optional form fields: sourceChannel, direction, hintDocType.
     *
     * Usage:
     *   const formData = new FormData();
     *   formData.append("file", file);
     *   formData.append("sourceChannel", "BROWSER_UPLOAD");
     *   formData.append("direction", "INCOMING");
     *   const result = await api.invoices.ingest(formData);
     */
    ingest: async (formData: FormData): Promise<IngestInvoiceResult> => {
      const url = new URL("/invoices/ingest", opts.baseUrl);
      const headers: Record<string, string> = { ...opts.headers };
      // Do NOT set content-type — browser will auto-set with boundary for FormData
      delete headers["content-type"];

      const res = await fetch(url.toString(), {
        method: "POST",
        headers,
        body: formData,
      });

      if (!res.ok) {
        let errorBody;
        try { errorBody = await res.json(); } catch { errorBody = { error: { code: "UNKNOWN", message: res.statusText } }; }
        throw new ApiClientError(res.status, errorBody);
      }

      return res.json();
    },
  };
}

/* ─── Contractor RFP DTOs ───────────────────────────────────── */

export interface ContractorRfpRequestSummaryDTO {
  id: string;
  requestNumber: number;
  description: string;
  category: string | null;
  createdAt: string;
  attachmentCount: number;
}

export interface ContractorRfpDTO {
  id: string;
  category: string;
  legalObligation: LegalObligation;
  status: RfpStatus;
  inviteCount: number;
  deadlineAt: string | null;
  createdAt: string;
  updatedAt: string;
  postalCode: string | null;
  buildingName: string | null;
  unitNumber: string | null;
  request: ContractorRfpRequestSummaryDTO | null;
  isInvited: boolean;
  quoteCount: number;
  myQuote: RfpQuoteDTO | null;
  /** Job ID — only populated when RFP is AWARDED and a Job was created. */
  jobId: string | null;
}

export interface RfpQuoteDTO {
  id: string;
  rfpId: string;
  contractorId: string;
  amountCents: number;
  currency: string;
  vatIncluded: boolean;
  estimatedDurationDays: number | null;
  earliestAvailability: string | null;
  lineItems: any;
  workPlan: string | null;
  assumptions: string | null;
  validUntil: string | null;
  notes: string | null;
  status: RfpQuoteStatus;
  submittedAt: string;
  contractor?: { id: string; name: string };
}

export interface SubmitQuoteInput {
  amountCents: number;
  currency?: string;
  vatIncluded?: boolean;
  estimatedDurationDays?: number;
  earliestAvailability?: string;
  lineItems?: Array<{ description: string; amountCents: number }>;
  workPlan: string;
  assumptions?: string;
  validUntil?: string;
  notes?: string;
}

function buildContractorApi(opts: ClientOptions) {
  return {
    jobs: (params?: PaginationParams & { contractorId?: string; view?: "summary" | "full" }) =>
      request<PaginatedList<JobDTO | JobSummaryDTO>>(opts, "GET", "/contractor/jobs", undefined, params as Record<string, string | number | boolean | undefined>),

    getJob: (id: string) =>
      request<JobDTO>(opts, "GET", `/contractor/jobs/${id}`),

    invoices: (params?: PaginationParams & { contractorId?: string; view?: "summary" | "full" }) =>
      request<PaginatedList<InvoiceDTO | InvoiceSummaryDTO>>(opts, "GET", "/contractor/invoices", undefined, params as Record<string, string | number | boolean | undefined>),

    getInvoice: (id: string) =>
      request<InvoiceDTO>(opts, "GET", `/contractor/invoices/${id}`),

    rfps: (params?: PaginationParams & { contractorId?: string; status?: RfpStatus }) =>
      request<PaginatedList<ContractorRfpDTO>>(opts, "GET", "/contractor/rfps", undefined, params as Record<string, string | number | boolean | undefined>),

    getRfp: (id: string, params?: { contractorId?: string }) =>
      request<{ data: ContractorRfpDTO }>(opts, "GET", `/contractor/rfps/${id}`, undefined, params as Record<string, string | number | boolean | undefined>),

    submitQuote: (rfpId: string, body: SubmitQuoteInput, params?: { contractorId?: string }) =>
      request<{ data: RfpQuoteDTO }>(opts, "POST", `/contractor/rfps/${rfpId}/quotes`, body, params as Record<string, string | number | boolean | undefined>),
  };
}

/* ─── Manager / Owner RFP DTOs ──────────────────────────────── */

export interface ManagerRfpInviteDTO {
  id: string;
  rfpId: string;
  contractorId: string;
  status: string;
  createdAt: string;
  contractor?: { id: string; name: string; phone: string; email: string };
}

export interface ManagerRfpQuoteDTO {
  id: string;
  rfpId: string;
  contractorId: string;
  amountCents: number;
  currency: string;
  vatIncluded: boolean;
  estimatedDurationDays: number | null;
  earliestAvailability: string | null;
  lineItems: any;
  workPlan: string | null;
  assumptions: string | null;
  validUntil: string | null;
  notes: string | null;
  status: RfpQuoteStatus;
  submittedAt: string;
  contractor?: { id: string; name: string };
}

export interface ManagerRfpDTO {
  id: string;
  orgId: string;
  buildingId: string;
  unitId: string | null;
  requestId: string | null;
  cashflowPlanId: string | null;
  cashflowGroupKey: string | null;
  category: string;
  legalObligation: LegalObligation;
  status: RfpStatus;
  inviteCount: number;
  deadlineAt: string | null;
  awardedContractorId: string | null;
  awardedQuoteId: string | null;
  createdAt: string;
  updatedAt: string;
  building?: { id: string; name: string; address: string };
  unit?: { id: string; unitNumber: string } | null;
  awardedContractor?: { id: string; name: string } | null;
  request?: { id: string; requestNumber: number; description: string; category: string | null; createdAt: string; attachmentCount: number } | null;
  invites: ManagerRfpInviteDTO[];
  quotes: ManagerRfpQuoteDTO[];
  quoteCount: number;
}

export interface AwardQuoteInput {
  quoteId: string;
}

export interface AwardQuoteResult {
  rfpId: string;
  quoteId: string;
  status: "AWARDED" | "PENDING_OWNER_APPROVAL";
  awardedContractorId: string | null;
  ownerApprovalRequired: boolean;
}

function buildRfpsApi(opts: ClientOptions) {
  return {
    list: (params?: PaginationParams & { status?: RfpStatus }) =>
      request<PaginatedList<ManagerRfpDTO>>(opts, "GET", "/rfps", undefined, params as Record<string, string | number | boolean | undefined>),

    get: (id: string) =>
      request<{ data: ManagerRfpDTO }>(opts, "GET", `/rfps/${id}`),

    awardQuote: (rfpId: string, body: AwardQuoteInput) =>
      request<{ data: AwardQuoteResult }>(opts, "POST", `/rfps/${rfpId}/award`, body),
  };
}

function buildLeasesApi(opts: ClientOptions) {
  return {
    list: (params?: PaginationParams) =>
      request<PaginatedList<LeaseDTO>>(opts, "GET", "/leases", undefined, params as Record<string, string | number | boolean | undefined>),

    get: (id: string) =>
      request<LeaseDTO>(opts, "GET", `/leases/${id}`),

    create: (body: {
      unitId: string;
      tenantName: string;
      objectType: string;
      startDate: string;
      netRentChf: number;
      [key: string]: unknown;
    }) => request<LeaseDTO>(opts, "POST", "/leases", body),

    update: (id: string, body: Record<string, unknown>) =>
      request<LeaseDTO>(opts, "PATCH", `/leases/${id}`, body),

    generatePdf: (id: string) =>
      request<{ pdfStorageKey: string; sha256: string }>(opts, "POST", `/leases/${id}/generate-pdf`, {}),

    readyToSign: (id: string) =>
      request<LeaseDTO>(opts, "POST", `/leases/${id}/ready-to-sign`, {}),

    cancel: (id: string) =>
      request<LeaseDTO>(opts, "POST", `/leases/${id}/cancel`, {}),

    storeSignedPdf: (id: string, body: { pdfStorageKey: string; sha256: string }) =>
      request<LeaseDTO>(opts, "POST", `/leases/${id}/store-signed-pdf`, body),

    confirmDeposit: (id: string, body?: { bankRef?: string }) =>
      request<LeaseDTO>(opts, "POST", `/leases/${id}/confirm-deposit`, body ?? {}),

    activate: (id: string) =>
      request<LeaseDTO>(opts, "POST", `/leases/${id}/activate`, {}),

    terminate: (id: string, body?: { reason?: string; notice?: string }) =>
      request<LeaseDTO>(opts, "POST", `/leases/${id}/terminate`, body ?? {}),

    archive: (id: string) =>
      request<LeaseDTO>(opts, "POST", `/leases/${id}/archive`, {}),

    listInvoices: (id: string) =>
      request<InvoiceDTO[]>(opts, "GET", `/leases/${id}/invoices`),

    createInvoice: (id: string, body: Record<string, unknown>) =>
      request<InvoiceDTO>(opts, "POST", `/leases/${id}/invoices`, body),

    // Lease expense items
    createExpenseItem: (leaseId: string, body: { description: string; amountChf: number; mode?: 'ACOMPTE' | 'FORFAIT'; expenseTypeId?: string; accountId?: string }) =>
      request<LeaseExpenseItemDTO>(opts, "POST", `/leases/${leaseId}/expense-items`, body),

    updateExpenseItem: (leaseId: string, itemId: string, body: Partial<{ description: string; amountChf: number; mode: 'ACOMPTE' | 'FORFAIT'; expenseTypeId: string | null; accountId: string | null; isActive: boolean }>) =>
      request<LeaseExpenseItemDTO>(opts, "PATCH", `/leases/${leaseId}/expense-items/${itemId}`, body),

    deleteExpenseItem: (leaseId: string, itemId: string) =>
      request<{ success: boolean }>(opts, "DELETE", `/leases/${leaseId}/expense-items/${itemId}`),
  };
}

function buildSignatureRequestsApi(opts: ClientOptions) {
  return {
    list: (params?: { limit?: number; offset?: number }) =>
      request<SignatureRequestDTO[]>(opts, "GET", "/signature-requests", undefined, params as Record<string, string | number | boolean | undefined>),

    get: (id: string) =>
      request<SignatureRequestDTO>(opts, "GET", `/signature-requests/${id}`),

    send: (id: string) =>
      request<SignatureRequestDTO>(opts, "POST", `/signature-requests/${id}/send`, {}),

    markSigned: (id: string) =>
      request<SignatureRequestDTO>(opts, "POST", `/signature-requests/${id}/mark-signed`, {}),
  };
}

function buildConfigApi(opts: ClientOptions) {
  return {
    getOrgConfig: () =>
      request<OrgConfigDTO>(opts, "GET", "/org-config"),

    updateOrgConfig: (body: Partial<Omit<OrgConfigDTO, "id" | "orgId">>) =>
      request<OrgConfigDTO>(opts, "PUT", "/org-config", body),

    getBuildingConfig: (id: string) =>
      request<BuildingConfigDTO>(opts, "GET", `/buildings/${id}/config`),

    updateBuildingConfig: (id: string, body: Record<string, unknown>) =>
      request<BuildingConfigDTO>(opts, "PUT", `/buildings/${id}/config`, body),

    getUnitConfig: (id: string) =>
      request<UnitConfigDTO>(opts, "GET", `/units/${id}/config`),

    updateUnitConfig: (id: string, body: Record<string, unknown>) =>
      request<UnitConfigDTO>(opts, "PUT", `/units/${id}/config`, body),

    deleteUnitConfig: (id: string) =>
      request<void>(opts, "DELETE", `/units/${id}/config`),
  };
}

function buildBillingSchedulesApi(opts: ClientOptions) {
  return {
    list: (params?: { status?: BillingScheduleStatus }) =>
      request<{ data: BillingScheduleDTO[] }>(opts, "GET", "/billing-schedules", undefined, params as Record<string, string | number | boolean | undefined>),

    get: (id: string) =>
      request<BillingScheduleDTO>(opts, "GET", `/billing-schedules/${id}`),

    pause: (id: string) =>
      request<BillingScheduleDTO>(opts, "POST", `/billing-schedules/${id}/pause`, {}),

    resume: (id: string) =>
      request<BillingScheduleDTO>(opts, "POST", `/billing-schedules/${id}/resume`, {}),
  };
}

// ─── Charge Reconciliation DTOs ────────────────────────────────

export interface ChargeReconciliationLineDTO {
  id: string;
  description: string;
  chargeMode: string;
  acomptePaidCents: number;
  actualCostCents: number;
  balanceCents: number;
}

export interface ChargeReconciliationDTO {
  id: string;
  orgId: string;
  leaseId: string;
  fiscalYear: number;
  status: string;
  totalAcomptePaidCents: number;
  totalActualCostsCents: number;
  balanceCents: number;
  settlementInvoiceId: string | null;
  settledAt: string | null;
  createdAt: string;
  updatedAt: string;
  lineItems: ChargeReconciliationLineDTO[];
  lease: {
    id: string;
    tenantName: string;
    startDate: string;
    endDate: string | null;
    status: string;
    netRentChf: number;
    chargesTotalChf: number;
    unitId: string;
  } | null;
  settlementInvoice: {
    id: string;
    invoiceNumber: string | null;
    status: string;
    totalAmount: number;
    description: string;
  } | null;
}

export type ChargeReconciliationStatus = "DRAFT" | "FINALIZED" | "SETTLED";

function buildChargeReconciliationsApi(opts: ClientOptions) {
  return {
    list: (params?: { status?: ChargeReconciliationStatus; leaseId?: string; fiscalYear?: number }) =>
      request<{ data: ChargeReconciliationDTO[] }>(opts, "GET", "/charge-reconciliations", undefined, params as Record<string, string | number | boolean | undefined>),

    get: (id: string) =>
      request<ChargeReconciliationDTO>(opts, "GET", `/charge-reconciliations/${id}`),

    create: (body: { leaseId: string; fiscalYear: number }) =>
      request<ChargeReconciliationDTO>(opts, "POST", "/charge-reconciliations", body),

    updateLine: (reconciliationId: string, lineId: string, body: { actualCostCents: number }) =>
      request<ChargeReconciliationDTO>(opts, "PUT", `/charge-reconciliations/${reconciliationId}/lines/${lineId}`, body),

    finalize: (id: string) =>
      request<ChargeReconciliationDTO>(opts, "POST", `/charge-reconciliations/${id}/finalize`, {}),

    settle: (id: string) =>
      request<ChargeReconciliationDTO>(opts, "POST", `/charge-reconciliations/${id}/settle`, {}),

    reopen: (id: string) =>
      request<ChargeReconciliationDTO>(opts, "POST", `/charge-reconciliations/${id}/reopen`, {}),

    delete: (id: string) =>
      request<{ success: boolean }>(opts, "DELETE", `/charge-reconciliations/${id}`),
  };
}

// ─── Rent Adjustment DTOs ───────────────────────────────────

export interface RentAdjustmentDTO {
  id: string;
  orgId: string;
  leaseId: string;
  adjustmentType: RentAdjustmentType;
  status: RentAdjustmentStatus;
  effectiveDate: string;
  previousRentCents: number;
  newRentCents: number;
  adjustmentCents: number;
  cpiOldIndex: number | null;
  cpiNewIndex: number | null;
  referenceRateOld: string | null;
  referenceRateNew: string | null;
  calculationDetails: any;
  approvedAt: string | null;
  appliedAt: string | null;
  rejectedAt: string | null;
  rejectionReason: string | null;
  createdAt: string;
  updatedAt: string;
  lease: {
    id: string;
    tenantName: string;
    netRentChf: number;
    startDate: string;
    endDate: string | null;
    status: string;
    indexClauseType: string;
    cpiBaseIndex: number | null;
    initialNetRentChf: number | null;
    lastIndexationDate: string | null;
  };
}

export type RentAdjustmentType = "CPI_INDEXATION" | "REFERENCE_RATE_CHANGE" | "MANUAL";
export type RentAdjustmentStatus = "DRAFT" | "APPROVED" | "APPLIED" | "REJECTED";

function buildRentAdjustmentsApi(opts: ClientOptions) {
  return {
    list: (params?: { status?: string; leaseId?: string; adjustmentType?: string }) =>
      request<{ data: RentAdjustmentDTO[] }>(opts, "GET", "/rent-adjustments", undefined, params as Record<string, string | number | boolean | undefined>),

    get: (id: string) =>
      request<{ data: RentAdjustmentDTO }>(opts, "GET", `/rent-adjustments/${id}`),

    compute: (body: { leaseId: string; cpiNewIndex: number; effectiveDate: string; referenceRateNew?: string }) =>
      request<{ data: RentAdjustmentDTO }>(opts, "POST", "/rent-adjustments/compute", body),

    manual: (body: { leaseId: string; newRentCents: number; effectiveDate: string; reason?: string }) =>
      request<{ data: RentAdjustmentDTO }>(opts, "POST", "/rent-adjustments/manual", body),

    approve: (id: string) =>
      request<{ data: RentAdjustmentDTO }>(opts, "POST", `/rent-adjustments/${id}/approve`, {}),

    apply: (id: string) =>
      request<{ data: RentAdjustmentDTO }>(opts, "POST", `/rent-adjustments/${id}/apply`, {}),

    reject: (id: string, reason?: string) =>
      request<{ data: RentAdjustmentDTO }>(opts, "POST", `/rent-adjustments/${id}/reject`, { reason }),

    delete: (id: string) =>
      request<{ success: boolean }>(opts, "DELETE", `/rent-adjustments/${id}`),
  };
}

// ─── Contractor Billing Schedule DTOs ─────────────────────────

export interface ContractorBillingScheduleDTO {
  id: string;
  orgId: string;
  contractorId: string;
  status: string;
  description: string;
  frequency: string;
  anchorDay: number;
  nextPeriodStart: string;
  lastGeneratedPeriod: string | null;
  amountCents: number;
  vatRate: number;
  buildingId: string | null;
  completedAt: string | null;
  completionReason: string | null;
  createdAt: string;
  updatedAt: string;
  contractor: {
    id: string;
    name: string;
    email: string;
    phone: string;
    iban: string | null;
    vatNumber: string | null;
    defaultVatRate: number | null;
    isActive: boolean;
  };
  building: { id: string; name: string; address: string } | null;
}

export type BillingFrequency = "MONTHLY" | "QUARTERLY" | "SEMI_ANNUAL" | "ANNUAL";

function buildContractorBillingApi(opts: ClientOptions) {
  return {
    list: (params?: { status?: string; contractorId?: string; buildingId?: string; frequency?: string }) =>
      request<{ data: ContractorBillingScheduleDTO[] }>(opts, "GET", "/contractor-billing-schedules", undefined, params as Record<string, string | number | boolean | undefined>),

    get: (id: string) =>
      request<{ data: ContractorBillingScheduleDTO }>(opts, "GET", `/contractor-billing-schedules/${id}`),

    create: (body: { contractorId: string; description: string; amountCents: number; startDate: string; frequency?: string; vatRate?: number; anchorDay?: number; buildingId?: string }) =>
      request<{ data: ContractorBillingScheduleDTO }>(opts, "POST", "/contractor-billing-schedules", body),

    update: (id: string, body: { description?: string; amountCents?: number; vatRate?: number; frequency?: string; buildingId?: string | null }) =>
      request<{ data: ContractorBillingScheduleDTO }>(opts, "PUT", `/contractor-billing-schedules/${id}`, body),

    pause: (id: string) =>
      request<{ data: ContractorBillingScheduleDTO }>(opts, "POST", `/contractor-billing-schedules/${id}/pause`, {}),

    resume: (id: string) =>
      request<{ data: ContractorBillingScheduleDTO }>(opts, "POST", `/contractor-billing-schedules/${id}/resume`, {}),

    stop: (id: string, reason?: string) =>
      request<{ data: ContractorBillingScheduleDTO }>(opts, "POST", `/contractor-billing-schedules/${id}/stop`, { reason }),

    generate: (id: string) =>
      request<{ data: { invoiceId: string; nextPeriodStart: string } }>(opts, "POST", `/contractor-billing-schedules/${id}/generate`, {}),

    delete: (id: string) =>
      request<{ success: boolean }>(opts, "DELETE", `/contractor-billing-schedules/${id}`),
  };
}

function buildApprovalRulesApi(opts: ClientOptions) {
  return {
    list: (params?: { limit?: number; offset?: number }) =>
      request<ApprovalRuleDTO[]>(opts, "GET", "/approval-rules", undefined, params as Record<string, string | number | boolean | undefined>),

    get: (id: string) =>
      request<ApprovalRuleDTO>(opts, "GET", `/approval-rules/${id}`),

    create: (body: {
      name: string;
      conditions: string;
      action: RuleAction;
      buildingId?: string;
      priority?: number;
      isActive?: boolean;
    }) => request<ApprovalRuleDTO>(opts, "POST", "/approval-rules", body),

    update: (id: string, body: Partial<Pick<ApprovalRuleDTO, "name" | "priority" | "isActive" | "conditions" | "action">>) =>
      request<ApprovalRuleDTO>(opts, "PATCH", `/approval-rules/${id}`, body),

    delete: (id: string) =>
      request<void>(opts, "DELETE", `/approval-rules/${id}`),
  };
}

function buildBillingEntitiesApi(opts: ClientOptions) {
  return {
    list: (params?: { limit?: number; offset?: number }) =>
      request<BillingEntityDTO[]>(opts, "GET", "/billing-entities", undefined, params as Record<string, string | number | boolean | undefined>),

    get: (id: string) =>
      request<BillingEntityDTO>(opts, "GET", `/billing-entities/${id}`),

    create: (body: {
      type: BillingEntityType;
      name: string;
      addressLine1?: string;
      addressLine2?: string;
      postalCode?: string;
      city?: string;
      country?: string;
      iban?: string;
      vatNumber?: string;
      isDefault?: boolean;
    }) => request<BillingEntityDTO>(opts, "POST", "/billing-entities", body),

    update: (id: string, body: Partial<Omit<BillingEntityDTO, "id" | "orgId" | "createdAt" | "updatedAt">>) =>
      request<BillingEntityDTO>(opts, "PATCH", `/billing-entities/${id}`, body),

    delete: (id: string) =>
      request<void>(opts, "DELETE", `/billing-entities/${id}`),
  };
}

function buildInventoryApi(opts: ClientOptions) {
  return {
    /* Properties */
    listProperties: (params?: { limit?: number; offset?: number }) =>
      request<unknown[]>(opts, "GET", "/properties", undefined, params as Record<string, string | number | boolean | undefined>),

    listPropertyUnits: (id: string, params?: { limit?: number; offset?: number }) =>
      request<UnitDTO[]>(opts, "GET", `/properties/${id}/units`, undefined, params as Record<string, string | number | boolean | undefined>),

    /* Buildings */
    listBuildings: (params?: { limit?: number; offset?: number }) =>
      request<BuildingDTO[]>(opts, "GET", "/buildings", undefined, params as Record<string, string | number | boolean | undefined>),

    getBuilding: (id: string) =>
      request<BuildingDTO>(opts, "GET", `/buildings/${id}`),

    createBuilding: (body: { name: string; address: string; city?: string; postalCode?: string }) =>
      request<BuildingDTO>(opts, "POST", "/buildings", body),

    updateBuilding: (id: string, body: Partial<Pick<BuildingDTO, "name" | "address" | "city" | "postalCode" | "yearBuilt" | "hasElevator" | "hasConcierge">>) =>
      request<BuildingDTO>(opts, "PATCH", `/buildings/${id}`, body),

    deleteBuilding: (id: string) =>
      request<void>(opts, "DELETE", `/buildings/${id}`),

    listBuildingUnits: (id: string, params?: { limit?: number; offset?: number }) =>
      request<UnitDTO[]>(opts, "GET", `/buildings/${id}/units`, undefined, params as Record<string, string | number | boolean | undefined>),

    createBuildingUnit: (id: string, body: { unitNumber: string; floor?: string; type?: UnitType }) =>
      request<UnitDTO>(opts, "POST", `/buildings/${id}/units`, body),

    listBuildingOwners: (id: string) =>
      request<{ data: Array<{ id: string; name: string; email: string; role: string }> }>(opts, "GET", `/buildings/${id}/owners`),

    listBuildingOwnerCandidates: (id: string) =>
      request<{ data: Array<{ id: string; name: string; email: string }> }>(opts, "GET", `/buildings/${id}/owners/candidates`),

    addBuildingOwner: (id: string, body: { userId: string }) =>
      request<{ data: { id: string } }>(opts, "POST", `/buildings/${id}/owners`, body),

    removeBuildingOwner: (buildingId: string, userId: string) =>
      request<void>(opts, "DELETE", `/buildings/${buildingId}/owners/${userId}`),

    /* Units */
    listUnits: (params?: { limit?: number; offset?: number; buildingId?: string }) =>
      request<UnitDTO[]>(opts, "GET", "/units", undefined, params as Record<string, string | number | boolean | undefined>),

    getUnit: (id: string) =>
      request<UnitDTO>(opts, "GET", `/units/${id}`),

    updateUnit: (id: string, body: Partial<Pick<UnitDTO, "unitNumber" | "floor" | "type" | "livingAreaSqm" | "rooms" | "hasBalcony" | "hasTerrace" | "hasParking" | "locationSegment" | "lastRenovationYear" | "insulationQuality" | "energyLabel" | "heatingType">>) =>
      request<UnitDTO>(opts, "PATCH", `/units/${id}`, body),

    deleteUnit: (id: string) =>
      request<void>(opts, "DELETE", `/units/${id}`),

    /* Appliances */
    listUnitAppliances: (unitId: string, params?: { limit?: number; offset?: number }) =>
      request<ApplianceDTO[]>(opts, "GET", `/units/${unitId}/appliances`, undefined, params as Record<string, string | number | boolean | undefined>),

    createUnitAppliance: (unitId: string, body: { category: string; serial?: string; assetModelId?: string; installedDate?: string }) =>
      request<ApplianceDTO>(opts, "POST", `/units/${unitId}/appliances`, body),

    updateAppliance: (id: string, body: Partial<Pick<ApplianceDTO, "category" | "serial" | "assetModelId">>) =>
      request<ApplianceDTO>(opts, "PATCH", `/appliances/${id}`, body),

    deleteAppliance: (id: string) =>
      request<void>(opts, "DELETE", `/appliances/${id}`),

    /* Asset Models */
    listAssetModels: (params?: { limit?: number; offset?: number }) =>
      request<AssetModelDTO[]>(opts, "GET", "/asset-models", undefined, params as Record<string, string | number | boolean | undefined>),

    createAssetModel: (body: { brand: string; model: string; category: string; expectedLifespanYears?: number }) =>
      request<AssetModelDTO>(opts, "POST", "/asset-models", body),

    updateAssetModel: (id: string, body: Partial<Pick<AssetModelDTO, "brand" | "model" | "category" | "expectedLifespanYears">>) =>
      request<AssetModelDTO>(opts, "PATCH", `/asset-models/${id}`, body),

    deleteAssetModel: (id: string) =>
      request<void>(opts, "DELETE", `/asset-models/${id}`),

    /* Occupancies (unit tenants) */
    listUnitTenants: (unitId: string) =>
      request<TenantDTO[]>(opts, "GET", `/units/${unitId}/tenants`),

    assignUnitTenant: (unitId: string, body: { tenantId: string }) =>
      request<unknown>(opts, "POST", `/units/${unitId}/tenants`, body),

    removeUnitTenant: (unitId: string, tenantId: string) =>
      request<void>(opts, "DELETE", `/units/${unitId}/tenants/${tenantId}`),

    /* Asset Inventory */
    getUnitAssetInventory: (unitId: string, params?: { canton?: string }) =>
      request<AssetInventoryItemDTO[]>(opts, "GET", `/units/${unitId}/asset-inventory`, undefined, params as Record<string, string | number | boolean | undefined>),

    createUnitAsset: (unitId: string, body: Omit<UpsertAssetBody, "unitId">) =>
      request<unknown>(opts, "POST", `/units/${unitId}/assets`, body),

    getBuildingAssetInventory: (buildingId: string, params?: { canton?: string; buildingLevelOnly?: boolean }) =>
      request<AssetInventoryItemDTO[]>(opts, "GET", `/buildings/${buildingId}/asset-inventory`, undefined, params as Record<string, string | number | boolean | undefined>),

    createBuildingAsset: (buildingId: string, body: UpsertAssetBody) =>
      request<unknown>(opts, "POST", `/buildings/${buildingId}/assets`, body),

    addAssetIntervention: (assetId: string, body: AddInterventionBody) =>
      request<unknown>(opts, "POST", `/assets/${assetId}/interventions`, body),
  };
}

function buildRentEstimationApi(opts: ClientOptions) {
  return {
    getConfig: () =>
      request<RentEstimationConfigDTO>(opts, "GET", "/rent-estimation/config"),

    upsertConfig: (body: Partial<Omit<RentEstimationConfigDTO, "id" | "orgId" | "canton" | "createdAt" | "updatedAt">>) =>
      request<RentEstimationConfigDTO>(opts, "PUT", "/rent-estimation/config", body),

    upsertCantonConfig: (canton: string, body: Partial<Omit<RentEstimationConfigDTO, "id" | "orgId" | "canton" | "createdAt" | "updatedAt">>) =>
      request<RentEstimationConfigDTO>(opts, "PUT", `/rent-estimation/config/${canton}`, body),

    estimateUnit: (unitId: string) =>
      request<RentEstimateDTO>(opts, "GET", `/units/${unitId}/rent-estimate`),

    bulkEstimate: (body: { unitIds?: string[]; buildingId?: string }) =>
      request<RentEstimateDTO[]>(opts, "POST", "/rent-estimation/bulk", body),
  };
}

function buildTenantsApi(opts: ClientOptions) {
  return {
    list: (params?: { limit?: number; offset?: number }) =>
      request<TenantDTO[]>(opts, "GET", "/tenants", undefined, params as Record<string, string | number | boolean | undefined>),

    get: (id: string) =>
      request<TenantDTO>(opts, "GET", `/tenants/${id}`),

    create: (body: { name: string; phone: string; email?: string }) =>
      request<TenantDTO>(opts, "POST", "/tenants", body),

    update: (id: string, body: Partial<Pick<TenantDTO, "name" | "phone" | "email">>) =>
      request<TenantDTO>(opts, "PATCH", `/tenants/${id}`, body),

    delete: (id: string) =>
      request<void>(opts, "DELETE", `/tenants/${id}`),

    listPeopleTenants: (params?: { limit?: number; offset?: number }) =>
      request<TenantDTO[]>(opts, "GET", "/people/tenants", undefined, params as Record<string, string | number | boolean | undefined>),

    listPeopleVendors: () =>
      request<ContractorDTO[]>(opts, "GET", "/people/vendors"),
  };
}

function buildContractorsApi(opts: ClientOptions) {
  return {
    list: () =>
      request<ContractorDTO[]>(opts, "GET", "/contractors"),

    get: (id: string) =>
      request<ContractorDTO>(opts, "GET", `/contractors/${id}`),

    create: (body: { name: string; phone: string; email?: string; specialties?: string[]; hourlyRate?: number }) =>
      request<ContractorDTO>(opts, "POST", "/contractors", body),

    update: (id: string, body: Partial<Pick<ContractorDTO, "name" | "phone" | "email" | "specialties" | "hourlyRate">>) =>
      request<ContractorDTO>(opts, "PATCH", `/contractors/${id}`, body),

    delete: (id: string) =>
      request<void>(opts, "DELETE", `/contractors/${id}`),
  };
}

function buildNotificationsApi(opts: ClientOptions) {
  return {
    list: (params?: { limit?: number; offset?: number }) =>
      request<{ data: NotificationDTO[]; total: number }>(opts, "GET", "/notifications", undefined, params as Record<string, string | number | boolean | undefined>),

    getUnreadCount: () =>
      request<{ count: number }>(opts, "GET", "/notifications/unread-count"),

    markRead: (id: string) =>
      request<unknown>(opts, "POST", `/notifications/${id}/read`, {}),

    markAllRead: () =>
      request<unknown>(opts, "POST", "/notifications/mark-all-read", {}),

    delete: (id: string) =>
      request<void>(opts, "DELETE", `/notifications/${id}`),
  };
}

function buildAuthApi(opts: ClientOptions) {
  return {
    createTenantSession: (body: { phone: string }) =>
      request<unknown>(opts, "POST", "/tenant-session", body),

    listTenantPortalLeases: (params?: { limit?: number; offset?: number }) =>
      request<LeaseDTO[]>(opts, "GET", "/tenant-portal/leases", undefined, params as Record<string, string | number | boolean | undefined>),

    getTenantPortalLease: (id: string) =>
      request<LeaseDTO>(opts, "GET", `/tenant-portal/leases/${id}`),

    acceptTenantPortalLease: (id: string, body?: Record<string, unknown>) =>
      request<unknown>(opts, "POST", `/tenant-portal/leases/${id}/accept`, body ?? {}),

    listTenantPortalRequests: () =>
      request<{ data: Array<{ id: string; description: string; category: string | null; status: RequestStatus; payingParty: PayingParty; rejectionReason: string | null; unitNumber: string | null; buildingName: string | null; assignedContractorName: string | null; createdAt: string }> }>(opts, "GET", "/tenant-portal/requests"),

    tenantSelfPay: (requestId: string) =>
      request<{ data: MaintenanceRequestDTO; rfpId: string }>(opts, "POST", `/tenant-portal/requests/${requestId}/self-pay`, {}),

    triage: (body: { text: string }) =>
      request<unknown>(opts, "POST", "/triage", body),

    register: (body: { name: string; email: string; password: string; role: Role }) =>
      request<{ id: string; token: string }>(opts, "POST", "/auth/register", body),

    login: (body: { email: string; password: string }) =>
      request<{ token: string; user: unknown }>(opts, "POST", "/auth/login", body),
  };
}

function buildRentalsApi(opts: ClientOptions) {
  return {
    /* ── Public (tenant-facing) ── */

    /** List vacant units available for rental applications. */
    listVacantUnits: () =>
      request<{ data: VacantUnitDTO[] }>(opts, "GET", "/vacant-units"),

    /** Create a new rental application draft. */
    createApplication: (body: {
      applicants: Array<{
        role?: ApplicantRole;
        firstName: string;
        lastName: string;
        birthdate?: string;
        nationality?: string;
        civilStatus?: string;
        permitType?: string;
        phone?: string;
        email?: string;
        currentAddress?: string;
        currentZipCity?: string;
        employer?: string;
        jobTitle?: string;
        workLocation?: string;
        employedSince?: string;
        netMonthlyIncome?: number;
        hasDebtEnforcement?: boolean;
      }>;
      unitIds: string[];
      currentLandlordName?: string;
      currentLandlordAddress?: string;
      currentLandlordPhone?: string;
      reasonForLeaving?: string;
      desiredMoveInDate?: string;
      householdSize?: number;
      hasPets?: boolean;
      petsDescription?: string;
      hasRcInsurance?: boolean;
      rcInsuranceCompany?: string;
      hasVehicle?: boolean;
      vehicleDescription?: string;
      needsParking?: boolean;
      remarks?: string;
    }) =>
      request<{ data: RentalApplicationDTO }>(opts, "POST", "/rental-applications", body),

    /** Submit (finalise) a rental application with signature. */
    submitApplication: (id: string, body: { signedName: string }) =>
      request<{ data: RentalApplicationDTO }>(opts, "POST", `/rental-applications/${id}/submit`, body),

    /** Upload an attachment (for programmatic callers; multipart handled externally). */
    // Note: real upload requires multipart; this is a typed hint.
    // Use fetch directly with FormData for actual file uploads.

    /* ── Manager ── */

    /** List rental applications for a unit (manager dashboard). */
    listApplicationsForUnit: (unitId: string, params?: { view?: "summary" | "full" }) =>
      request<{ data: (RentalApplicationSummaryDTO | RentalApplicationDTO)[] }>(
        opts, "GET", "/manager/rental-applications", undefined,
        { unitId, ...params } as Record<string, string | number | boolean | undefined>,
      ),

    /** Get a single rental application by ID. */
    getApplication: (id: string) =>
      request<{ data: RentalApplicationDTO }>(opts, "GET", `/manager/rental-applications/${id}`),

    /** Adjust evaluation score for an application-unit (manager override). */
    adjustScore: (applicationUnitId: string, body: { scoreDelta: number; reason: string; overrideJson?: Record<string, unknown> }) =>
      request<{ data: RentalApplicationUnitDTO }>(opts, "POST", `/manager/rental-application-units/${applicationUnitId}/adjust-score`, body),

    /* ── Owner ── */

    /** List rental applications for owner review. */
    listOwnerApplications: (unitId: string) =>
      request<{ data: RentalApplicationSummaryDTO[] }>(
        opts, "GET", "/owner/rental-applications", undefined,
        { unitId } as Record<string, string | number | boolean | undefined>,
      ),

    /** Owner selects primary + backup candidates for a unit. */
    selectCandidates: (unitId: string, body: {
      primaryApplicationUnitId: string;
      backup1ApplicationUnitId?: string;
      backup2ApplicationUnitId?: string;
    }) =>
      request<{ data: RentalOwnerSelectionDTO }>(opts, "POST", `/owner/units/${unitId}/select-tenants`, body),

    /* ── Dev email sink ── */

    /** List enqueued emails. */
    listEmails: (params?: { status?: EmailOutboxStatus }) =>
      request<{ data: EmailOutboxDTO[] }>(
        opts, "GET", "/dev/emails", undefined,
        params as Record<string, string | number | boolean | undefined>,
      ),

    /** Get a single email by ID. */
    getEmail: (id: string) =>
      request<{ data: EmailOutboxDTO }>(opts, "GET", `/dev/emails/${id}`),
  };
}

/* ═══════════════════════════════════════════════════════════════
 * Financial DTOs
 * ═══════════════════════════════════════════════════════════════ */

export interface ExpenseCategoryTotalDTO {
  category: ExpenseCategory;
  totalCents: number;
}

export interface ContractorSpendDTO {
  contractorId: string;
  contractorName: string;
  totalCents: number;
}

export interface AccountTotalDTO {
  accountId: string;
  accountName: string;
  accountCode: string | null;
  totalCents: number;
}

export interface BuildingFinancialsDTO {
  buildingId: string;
  buildingName: string;
  from: string;
  to: string;
  earnedIncomeCents: number;
  projectedIncomeCents: number;
  expensesTotalCents: number;
  maintenanceTotalCents: number;
  capexTotalCents: number;
  operatingTotalCents: number;
  netIncomeCents: number;
  netOperatingIncomeCents: number;
  /** Projected rent component (netRent + garageRent + otherServiceRent), prorated over range */
  rentalIncomeCents: number;
  /** Projected service-charge component (chargesTotalChf), prorated over range */
  serviceChargeIncomeCents: number;
  /** Point-in-time: ISSUED unpaid lease invoices */
  receivablesCents: number;
  /** Point-in-time: ISSUED/APPROVED unpaid job invoices */
  payablesCents: number;
  maintenanceRatio: number;
  costPerUnitCents: number;
  collectionRate: number;
  activeUnitsCount: number;
  expensesByCategory: ExpenseCategoryTotalDTO[];
  topContractorsBySpend: ContractorSpendDTO[];
  expensesByAccount?: AccountTotalDTO[];
}

export interface BuildingSummaryDTO {
  buildingId: string;
  buildingName: string;
  health: "green" | "amber" | "red";
  earnedIncomeCents: number;
  expensesTotalCents: number;
  netIncomeCents: number;
  collectionRate: number;
  maintenanceRatio: number;
  activeUnitsCount: number;
  receivablesCents: number;
  payablesCents: number;
}

export interface PortfolioSummaryDTO {
  from: string;
  to: string;
  totalEarnedIncomeCents: number;
  totalExpensesCents: number;
  totalNetIncomeCents: number;
  avgCollectionRate: number;
  avgMaintenanceRatio: number;
  totalActiveUnits: number;
  buildingsInRed: number;
  buildingCount: number;
  totalReceivablesCents: number;
  totalPayablesCents: number;
  buildings: BuildingSummaryDTO[];
}

function buildFinancialsApi(opts: ClientOptions) {
  return {
    /** Get building financial performance KPIs for a date range. */
    getBuildingFinancials: (
      buildingId: string,
      params: { from: string; to: string; forceRefresh?: boolean; groupByAccount?: boolean },
    ) =>
      request<{ data: BuildingFinancialsDTO }>(
        opts,
        "GET",
        `/buildings/${buildingId}/financials`,
        undefined,
        {
          from: params.from,
          to: params.to,
          ...(params.forceRefresh ? { forceRefresh: "true" } : {}),
          ...(params.groupByAccount ? { groupByAccount: "true" } : {}),
        },
      ),

    /** Get building financial summary including income breakdown, receivables, and payables. */
    getBuildingFinancialSummary: (
      buildingId: string,
      params: { from: string; to: string; forceRefresh?: boolean; groupByAccount?: boolean },
    ) =>
      request<{ data: BuildingFinancialsDTO }>(
        opts,
        "GET",
        `/buildings/${buildingId}/financial-summary`,
        undefined,
        {
          from: params.from,
          to: params.to,
          ...(params.forceRefresh ? { forceRefresh: "true" } : {}),
          ...(params.groupByAccount ? { groupByAccount: "true" } : {}),
        },
      ),

    /** Get portfolio-level financial summary across all buildings. */
    getPortfolioSummary: (params: { from: string; to: string }) =>
      request<{ data: PortfolioSummaryDTO }>(
        opts,
        "GET",
        `/financials/portfolio-summary`,
        undefined,
        { from: params.from, to: params.to },
      ),
  };
}

/* ═══════════════════════════════════════════════════════════════
 * Chart of Accounts (FIN-COA)
 * ═══════════════════════════════════════════════════════════════ */

export interface ExpenseTypeDTO {
  id: string;
  orgId: string;
  name: string;
  description: string | null;
  code: string | null;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface AccountDTO {
  id: string;
  orgId: string;
  name: string;
  code: string | null;
  accountType: string;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface ExpenseMappingDTO {
  id: string;
  orgId: string;
  expenseTypeId: string;
  accountId: string;
  buildingId: string | null;
  expenseType: { id: string; name: string } | null;
  account: { id: string; name: string } | null;
  building: { id: string; name: string } | null;
  createdAt: string;
  updatedAt: string;
}

export interface SeedResultDTO {
  expenseTypes: number;
  accounts: number;
  mappings: number;
}

function buildCoaApi(opts: ClientOptions) {
  return {
    /** List expense types for the authenticated org. */
    listExpenseTypes: () =>
      request<{ data: ExpenseTypeDTO[] }>(opts, "GET", "/coa/expense-types"),

    /** Get a single expense type. */
    getExpenseType: (id: string) =>
      request<{ data: ExpenseTypeDTO }>(opts, "GET", `/coa/expense-types/${id}`),

    /** Create a new expense type. */
    createExpenseType: (body: { name: string; description?: string; code?: string }) =>
      request<{ data: ExpenseTypeDTO }>(opts, "POST", "/coa/expense-types", body),

    /** Update an expense type. */
    updateExpenseType: (id: string, body: { name?: string; description?: string; code?: string; isActive?: boolean }) =>
      request<{ data: ExpenseTypeDTO }>(opts, "PATCH", `/coa/expense-types/${id}`, body),

    /** List accounts for the authenticated org. */
    listAccounts: () =>
      request<{ data: AccountDTO[] }>(opts, "GET", "/coa/accounts"),

    /** Get a single account. */
    getAccount: (id: string) =>
      request<{ data: AccountDTO }>(opts, "GET", `/coa/accounts/${id}`),

    /** Create a new account. */
    createAccount: (body: { name: string; code?: string; accountType?: string }) =>
      request<{ data: AccountDTO }>(opts, "POST", "/coa/accounts", body),

    /** Update an account. */
    updateAccount: (id: string, body: { name?: string; code?: string; accountType?: string; isActive?: boolean }) =>
      request<{ data: AccountDTO }>(opts, "PATCH", `/coa/accounts/${id}`, body),

    /** List expense mappings for the authenticated org. */
    listExpenseMappings: () =>
      request<{ data: ExpenseMappingDTO[] }>(opts, "GET", "/coa/expense-mappings"),

    /** Create an expense mapping (expense type → account). */
    createExpenseMapping: (body: { expenseTypeId: string; accountId: string; buildingId?: string | null }) =>
      request<{ data: ExpenseMappingDTO }>(opts, "POST", "/coa/expense-mappings", body),

    /** Delete an expense mapping. */
    deleteExpenseMapping: (id: string) =>
      request<{ data: { success: boolean } }>(opts, "DELETE", `/coa/expense-mappings/${id}`),

    /** Seed the canonical Swiss residential expense taxonomy. */
    seed: () =>
      request<{ data: SeedResultDTO }>(opts, "POST", "/coa/seed", {}),

    /** Backfill COA and historical ledger entries for the org. */
    backfillLedger: (body?: { seedCoa?: boolean; issueDrafts?: boolean }) =>
      request<{ data: { coaSeeded: boolean; coaAccounts: number; invoicesIssued: number; invoicesIssuedErrors: number; ledgerIssuedPosted: number; ledgerIssuedSkipped: number; ledgerPaidPosted: number; ledgerPaidSkipped: number } }>(opts, "POST", "/ledger/backfill", body ?? {}),
  };
}

/* ═══════════════════════════════════════════════════════════════
 * Scheduling (Slice 6: appointment handshake)
 * ═══════════════════════════════════════════════════════════════ */

export interface AppointmentSlotDTO {
  id: string;
  jobId: string;
  startTime: string;
  endTime: string;
  status: "PROPOSED" | "ACCEPTED" | "DECLINED";
  respondedAt: string | null;
  createdAt: string;
}

export interface ProposeSlotsResult {
  slots: AppointmentSlotDTO[];
  schedulingExpiresAt: string;
}

function buildSchedulingApi(opts: ClientOptions) {
  return {
    /** Contractor proposes appointment slots for a job. */
    proposeSlots: (jobId: string, contractorId: string, slots: { startTime: string; endTime: string }[]) =>
      request<{ data: ProposeSlotsResult }>(
        opts, "POST", `/contractor/jobs/${jobId}/slots`, { slots },
        { contractorId },
      ),

    /** Contractor lists slots for a job. */
    listContractorSlots: (jobId: string, contractorId: string) =>
      request<{ data: AppointmentSlotDTO[] }>(
        opts, "GET", `/contractor/jobs/${jobId}/slots`,
        undefined, { contractorId },
      ),

    /** Tenant views proposed slots for a request. */
    listTenantSlots: (requestId: string) =>
      request<{ data: AppointmentSlotDTO[] }>(
        opts, "GET", `/tenant-portal/requests/${requestId}/slots`,
      ),

    /** Tenant accepts a proposed slot. */
    acceptSlot: (slotId: string) =>
      request<{ data: AppointmentSlotDTO }>(
        opts, "POST", `/tenant-portal/slots/${slotId}/accept`, {},
      ),

    /** Tenant declines a proposed slot. */
    declineSlot: (slotId: string) =>
      request<{ data: AppointmentSlotDTO }>(
        opts, "POST", `/tenant-portal/slots/${slotId}/decline`, {},
      ),
  };
}

/* ═══════════════════════════════════════════════════════════════
 * Capture Sessions (INV-HUB: mobile invoice capture)
 * ═══════════════════════════════════════════════════════════════ */

function buildCaptureSessionsApi(opts: ClientOptions) {
  return {
    /** Create a new capture session — returns session + mobileUrl + token. */
    create: () =>
      request<{ data: CaptureSessionDTO & { token: string; mobileUrl: string } }>(
        opts, "POST", "/capture-sessions", {},
      ),

    /** Poll a session by ID (manager view). */
    get: (id: string) =>
      request<{ data: CaptureSessionDTO }>(
        opts, "GET", `/capture-sessions/${id}`,
      ),

    /** Validate a token (public / mobile). */
    validate: (token: string) =>
      request<{ data: CaptureSessionDTO }>(
        opts, "GET", `/capture-sessions/validate/${token}`,
      ),

    /**
     * Upload a file to a capture session (public / mobile, token-gated).
     * Accepts FormData with a "file" field.
     */
    upload: async (token: string, formData: FormData): Promise<{ data: CaptureSessionDTO }> => {
      const url = new URL(`/capture-sessions/${token}/upload`, opts.baseUrl);
      const headers: Record<string, string> = { ...opts.headers };
      delete headers["content-type"];

      const res = await fetch(url.toString(), {
        method: "POST",
        headers,
        body: formData,
      });

      if (!res.ok) {
        let errorBody;
        try { errorBody = await res.json(); } catch { errorBody = { error: { code: "UNKNOWN", message: res.statusText } }; }
        throw new ApiClientError(res.status, errorBody);
      }

      return res.json();
    },

    /** Complete a capture session — triggers ingestion pipeline. */
    complete: (token: string) =>
      request<{ data: CaptureSessionDTO; ingestionResults?: IngestInvoiceResult[] }>(
        opts, "POST", `/capture-sessions/${token}/complete`, {},
      ),
  };
}

/* ═══════════════════════════════════════════════════════════════
 * Legal Engine (Phase D)
 * ═══════════════════════════════════════════════════════════════ */

export interface LegalDecisionClientDTO {
  requestId: string;
  legalTopic: string | null;
  legalObligation: string;
  confidence: number;
  reasons: string[];
  citations: Array<{ article: string; text: string; authority: string }>;
  depreciationSignal: unknown;
  matchedReductions: unknown[];
  defectSignals: unknown;
  defectMatches: unknown[];
  rentReductionEstimate: unknown;
  recommendedActions: string[];
  rfpId: string | null;
  evaluationLogId: string;
}

export interface ClaimAnalysisClientDTO {
  requestId: string;
  requestDescription: string;
  category: string | null;
  buildingName: string | null;
  unitNumber: string | null;
  canton: string | null;
  defectSignals: unknown;
  legalObligation: string;
  legalTopic: string | null;
  confidence: number;
  matchedDefects: Array<{
    rank: number;
    ruleKey: string;
    defect: string;
    category: string;
    reductionPercent: number;
    reductionMax?: number;
    matchConfidence: number;
    matchReasons: string[];
  }>;
  rentReduction: {
    netRentChf: number;
    totalReductionPercent: number;
    totalReductionChf: number;
    capApplied: boolean;
  } | null;
  legalBasis: Array<{ article: string; text: string; authority: string; relevance: string }>;
  tenantGuidance: { summary: string; nextSteps: string[]; deadlines: string[]; escalation: string };
  landlordObligations: { summary: string; requiredActions: string[]; timeline: string };
  temporalContext: {
    defectOngoingSince?: string;
    durationMonths?: number;
    seasonalAdjustment: boolean;
    proRatedPercent?: number;
    backdatedReductionChf?: number;
  };
  evaluationLogId: string;
  analysedAt: string;
}

function buildLegalApi(opts: ClientOptions) {
  return {
    /** GET /requests/:id/legal-decision */
    getDecision: (requestId: string) =>
      request<{ data: LegalDecisionClientDTO }>(opts, "GET", `/requests/${requestId}/legal-decision`),

    /** GET /requests/:id/claim-analysis */
    getClaimAnalysis: (requestId: string) =>
      request<{ data: ClaimAnalysisClientDTO }>(opts, "GET", `/requests/${requestId}/claim-analysis`),

    /** GET /legal/sources */
    listSources: () =>
      request<{ data: unknown[] }>(opts, "GET", "/legal/sources"),

    /** GET /legal/variables */
    listVariables: () =>
      request<{ data: unknown[] }>(opts, "GET", "/legal/variables"),

    /** GET /legal/rules */
    listRules: () =>
      request<{ data: unknown[] }>(opts, "GET", "/legal/rules"),

    /** GET /legal/category-mappings */
    listCategoryMappings: () =>
      request<{ data: unknown[] }>(opts, "GET", "/legal/category-mappings"),

    /** GET /legal/category-mappings/coverage */
    getMappingCoverage: () =>
      request<unknown>(opts, "GET", "/legal/category-mappings/coverage"),

    /** GET /legal/evaluations */
    listEvaluations: (params?: PaginationParams & { obligation?: string; category?: string }) =>
      request<{ data: unknown[]; total: number }>(opts, "GET", "/legal/evaluations", undefined, params as Record<string, string | number | boolean | undefined>),

    /** GET /legal/depreciation-standards */
    listDepreciationStandards: () =>
      request<{ data: unknown[] }>(opts, "GET", "/legal/depreciation-standards"),

    /** POST /legal/ingestion/trigger */
    triggerIngestion: (sourceId?: string) =>
      request<{ data: unknown[] }>(opts, "POST", "/legal/ingest", sourceId ? { sourceId } : {}),
  };
}

function buildDevApi(opts: ClientOptions) {
  return {
    /** Trigger background job: process expired selection timeouts + attachment retention. */
    runBackgroundJobs: () =>
      request<{ timeoutsProcessed: number; attachmentsDeleted: number }>(
        opts, "POST", "/__dev/rental/run-jobs", {},
      ),
  };
}

/* ═══════════════════════════════════════════════════════════════
 * Completion & Ratings (Slice 7: job-completion-ratings)
 * ═══════════════════════════════════════════════════════════════ */

export interface JobRatingDTO {
  id: string;
  jobId: string;
  raterRole: "CONTRACTOR" | "TENANT";
  score: number;
  comment: string | null;
  createdAt: string;
  job?: {
    id: string;
    requestId: string;
    contractorId: string;
    description: string | null;
    building: string | null;
    unit: string | null;
  } | null;
}

export interface ContractorRatingsResult {
  data: JobRatingDTO[];
  pagination: { total: number; limit: number; offset: number };
}

function buildCompletionApi(opts: ClientOptions) {
  return {
    /** Contractor marks a job as completed. */
    contractorComplete: (jobId: string, contractorId: string, body?: { actualCost?: number; completedAt?: string; notes?: string }) =>
      request<{ data: any }>(
        opts, "POST", `/contractor/jobs/${jobId}/complete`, body ?? {},
        { contractorId },
      ),

    /** Contractor submits a rating for a completed job. */
    contractorRate: (jobId: string, contractorId: string, body: { score: number; comment?: string }) =>
      request<{ data: JobRatingDTO }>(
        opts, "POST", `/contractor/jobs/${jobId}/rate`, body,
        { contractorId },
      ),

    /** Tenant confirms job completion. */
    tenantConfirm: (jobId: string) =>
      request<{ data: any }>(
        opts, "POST", `/tenant-portal/jobs/${jobId}/confirm`, {},
      ),

    /** Tenant submits a rating for a completed job. */
    tenantRate: (jobId: string, body: { score: number; comment?: string }) =>
      request<{ data: JobRatingDTO }>(
        opts, "POST", `/tenant-portal/jobs/${jobId}/rate`, body,
      ),

    /** Get contractor rating history (manager/owner read). */
    getContractorRatings: (contractorId: string, opts2?: { limit?: number; offset?: number }) =>
      request<ContractorRatingsResult>(
        opts, "GET", `/contractors/${contractorId}/ratings`,
        undefined, opts2 as Record<string, any>,
      ),
  };
}

/* ═══════════════════════════════════════════════════════════════
 * Cashflow Planning
 * ═══════════════════════════════════════════════════════════════ */

export type CashflowPlanStatus = "DRAFT" | "SUBMITTED" | "APPROVED";

export interface CashflowOverrideDTO {
  id: string;
  planId: string;
  assetId: string;
  originalYear: number;
  overriddenYear: number;
}

export interface CashflowPlanDTO {
  id: string;
  orgId: string;
  buildingId: string | null;
  name: string;
  status: CashflowPlanStatus;
  incomeGrowthRatePct: number;
  openingBalanceCents: number | null;
  horizonMonths: number;
  lastComputedAt: string | null;
  createdAt: string;
  updatedAt: string;
  overrides: CashflowOverrideDTO[];
}

export interface MonthlyBucketDTO {
  year: number;
  month: number;                  // 1-12
  isActual: boolean;              // true for historical months with snapshot data
  projectedIncomeCents: number;
  projectedOpexCents: number;
  scheduledCapexCents: number;
  netCents: number;
  cumulativeBalanceCents: number;
  capexItems: Array<{ assetId: string; assetName: string; costCents: number }>;
}

export interface TimingRecommendationDTO {
  assetId: string;
  assetName: string;
  buildingId: string;
  buildingName?: string;
  assetType?: string;
  topic?: string;
  unitNumber?: string | null;
  scheduledYear: number;
  recommendedYear: number;
  direction: "advance" | "defer";
  estimatedCostChf: number;
  isDeductible?: boolean;
  deductiblePct?: number;
  ownerMarginalTaxRate?: number | null;
  estimatedTaxSavingChf: number;
  rationale: string;
  // Bracket-based comparison fields
  scheduledYearIncomeChf?: number;
  recommendedYearIncomeChf?: number;
  taxSavingScheduledChf?: number;
  taxSavingRecommendedChf?: number;
  additionalSavingChf?: number;
  scheduledYearMarginalPct?: number;
  recommendedYearMarginalPct?: number;
  bracketSource?: string;
}

export interface CashflowResultDTO {
  hasOpeningBalance: boolean;
  buckets: MonthlyBucketDTO[];
  timingRecommendations: TimingRecommendationDTO[];
}

export interface CashflowPlanDetailDTO extends CashflowPlanDTO {
  cashflow: CashflowResultDTO;
}

export interface RfpCandidateDTO {
  assetId: string;
  assetName: string;
  tradeGroup: string;
  effectiveYear: number;
  estimatedCostChf: number;
  suggestedRfpSendDate: string; // ISO date
}

// ─── Swiss Renovation Classification DTOs ──────────────────────

export type TaxCategoryDTO = "WERTERHALTEND" | "WERTVERMEHREND" | "MIXED" | "ENERGY_ENVIRONMENT";
export type AccountingTreatmentDTO = "IMMEDIATE_DEDUCTION" | "CAPITALIZED" | "SPLIT" | "ENERGY_DEDUCTION";
export type TimingSensitivityDTO = "HIGH" | "MODERATE" | "LOW";
export type BuildingSystemDTO =
  | "FACADE" | "WINDOWS" | "ROOF" | "INTERIOR" | "COMMON_AREAS"
  | "BATHROOM" | "KITCHEN" | "APPLIANCES" | "MEP" | "EXTERIOR" | "LAUNDRY";

export interface RenovationCatalogEntryDTO {
  code: string;
  label: string;
  aliases: string[];
  buildingSystem: BuildingSystemDTO;
  taxCategory: TaxCategoryDTO;
  accountingTreatment: AccountingTreatmentDTO;
  typicalDeductibility: string;
  deductiblePct: number;
  notes: string;
  assetLinkable: boolean;
  timingSensitivity: TimingSensitivityDTO;
  assetMappings?: Array<{ assetType: string; topic: string }>;
}

export interface CreateCashflowPlanInput {
  name: string;
  buildingId?: string;
  incomeGrowthRatePct?: number;
  openingBalanceCents?: number;
  horizonMonths?: number;
}

export interface UpdateCashflowPlanInput {
  name?: string;
  incomeGrowthRatePct?: number;
  openingBalanceCents?: number | null;
  horizonMonths?: number;
}

export interface AddCashflowOverrideInput {
  assetId: string;
  originalYear: number;
  overriddenYear: number;
}

function buildCashflowPlansApi(opts: ClientOptions) {
  return {
    /** List all cashflow plans for the org, optionally filtered by buildingId. */
    list: (params?: { buildingId?: string }) =>
      request<{ data: CashflowPlanDTO[] }>(opts, "GET", "/cashflow-plans", undefined, params as Record<string, any>),

    /** Create a new cashflow plan. */
    create: (input: CreateCashflowPlanInput) =>
      request<{ data: CashflowPlanDTO }>(opts, "POST", "/cashflow-plans", input),

    /** Get a plan with computed monthly cashflow. */
    get: (id: string) =>
      request<{ data: CashflowPlanDetailDTO }>(opts, "GET", `/cashflow-plans/${id}`),

    /** Update plan metadata. */
    update: (id: string, input: UpdateCashflowPlanInput) =>
      request<{ data: CashflowPlanDTO }>(opts, "PUT", `/cashflow-plans/${id}`, input),

    /** Add a year override for an asset. */
    addOverride: (id: string, input: AddCashflowOverrideInput) =>
      request<{ data: CashflowOverrideDTO }>(opts, "POST", `/cashflow-plans/${id}/overrides`, input),

    /** Remove a year override. */
    removeOverride: (id: string, overrideId: string) =>
      request<{ data: { deleted: boolean } }>(opts, "DELETE", `/cashflow-plans/${id}/overrides/${overrideId}`),

    /** Submit a plan for approval. */
    submit: (id: string) =>
      request<{ data: CashflowPlanDTO }>(opts, "POST", `/cashflow-plans/${id}/submit`, {}),

    /** Approve a plan (manager/owner role). */
    approve: (id: string) =>
      request<{ data: CashflowPlanDTO }>(opts, "POST", `/cashflow-plans/${id}/approve`, {}),

    /** Get suggested RFP candidates for a plan. */
    getRfpCandidates: (id: string) =>
      request<{ data: RfpCandidateDTO[] }>(opts, "GET", `/cashflow-plans/${id}/rfp-candidates`),

    /** Create an RFP from a candidate trade-group (idempotent). */
    createRfpFromGroup: (id: string, groupKey: string) =>
      request<{ data: { rfpId: string; title?: string; scopeDescription?: string; alreadyExisted: boolean } }>(
        opts,
        "POST",
        `/cashflow-plans/${id}/rfp-candidates/${encodeURIComponent(groupKey)}/create-rfp`,
        {},
      ),
  };
}

/* ═══════════════════════════════════════════════════════════════
 * Public factory
 * ═══════════════════════════════════════════════════════════════ */

export interface ApiClient {
  requests: ReturnType<typeof buildRequestsApi>;
  workRequests: ReturnType<typeof buildWorkRequestsApi>;
  jobs: ReturnType<typeof buildJobsApi>;
  invoices: ReturnType<typeof buildInvoicesApi>;
  contractor: ReturnType<typeof buildContractorApi>;
  rfps: ReturnType<typeof buildRfpsApi>;
  leases: ReturnType<typeof buildLeasesApi>;
  signatureRequests: ReturnType<typeof buildSignatureRequestsApi>;
  config: ReturnType<typeof buildConfigApi>;
  approvalRules: ReturnType<typeof buildApprovalRulesApi>;
  billingEntities: ReturnType<typeof buildBillingEntitiesApi>;
  inventory: ReturnType<typeof buildInventoryApi>;
  tenants: ReturnType<typeof buildTenantsApi>;
  contractors: ReturnType<typeof buildContractorsApi>;
  notifications: ReturnType<typeof buildNotificationsApi>;
  auth: ReturnType<typeof buildAuthApi>;
  rentals: ReturnType<typeof buildRentalsApi>;
  rentEstimation: ReturnType<typeof buildRentEstimationApi>;
  financials: ReturnType<typeof buildFinancialsApi>;
  coa: ReturnType<typeof buildCoaApi>;
  scheduling: ReturnType<typeof buildSchedulingApi>;
  completion: ReturnType<typeof buildCompletionApi>;
  captureSessions: ReturnType<typeof buildCaptureSessionsApi>;
  cashflowPlans: ReturnType<typeof buildCashflowPlansApi>;
  billingSchedules: ReturnType<typeof buildBillingSchedulesApi>;
  chargeReconciliations: ReturnType<typeof buildChargeReconciliationsApi>;
  rentAdjustments: ReturnType<typeof buildRentAdjustmentsApi>;
  contractorBilling: ReturnType<typeof buildContractorBillingApi>;
  legal: ReturnType<typeof buildLegalApi>;
  dev: ReturnType<typeof buildDevApi>;
}

/**
 * Create a typed API client.
 *
 * @param baseUrl  The base URL of the API (e.g., "http://localhost:3001")
 * @param headers  Optional default headers (e.g., Authorization)
 */
export function createApiClient(
  baseUrl: string,
  headers?: Record<string, string>,
): ApiClient {
  const opts: ClientOptions = { baseUrl, headers };
  return {
    requests: buildRequestsApi(opts),
    workRequests: buildWorkRequestsApi(opts),
    jobs: buildJobsApi(opts),
    invoices: buildInvoicesApi(opts),
    contractor: buildContractorApi(opts),
    rfps: buildRfpsApi(opts),
    leases: buildLeasesApi(opts),
    signatureRequests: buildSignatureRequestsApi(opts),
    config: buildConfigApi(opts),
    approvalRules: buildApprovalRulesApi(opts),
    billingEntities: buildBillingEntitiesApi(opts),
    inventory: buildInventoryApi(opts),
    tenants: buildTenantsApi(opts),
    contractors: buildContractorsApi(opts),
    notifications: buildNotificationsApi(opts),
    auth: buildAuthApi(opts),
    rentals: buildRentalsApi(opts),
    rentEstimation: buildRentEstimationApi(opts),
    financials: buildFinancialsApi(opts),
    coa: buildCoaApi(opts),
    scheduling: buildSchedulingApi(opts),
    completion: buildCompletionApi(opts),
    captureSessions: buildCaptureSessionsApi(opts),
    cashflowPlans: buildCashflowPlansApi(opts),
    billingSchedules: buildBillingSchedulesApi(opts),
    chargeReconciliations: buildChargeReconciliationsApi(opts),
    rentAdjustments: buildRentAdjustmentsApi(opts),
    contractorBilling: buildContractorBillingApi(opts),
    legal: buildLegalApi(opts),
    dev: buildDevApi(opts),
  };
}
