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
  | "OWNER_REJECTED";

export type PayingParty = "LANDLORD" | "TENANT";

export type JobStatus = "PENDING" | "IN_PROGRESS" | "COMPLETED" | "INVOICED";

export type InvoiceStatus = "DRAFT" | "APPROVED" | "PAID" | "DISPUTED";

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
  | "OWNER_REJECTED"
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
  | "STUDENT_PROOF"
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
  jobId: string;
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
}

/**
 * H5: Lightweight DTO for invoice list endpoints.
 * Reduces payload size by omitting line items and detailed billing fields.
 */
export interface InvoiceSummaryDTO {
  id: string;
  orgId: string;
  jobId: string;
  status: InvoiceStatus;
  invoiceNumber?: string | null;
  totalAmount: number;
  dueDate?: string | null;
  paidAt?: string | null;
  createdAt: string;
  description?: string;
  expenseCategory?: ExpenseCategory | null;
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
  landlordName?: string;
  landlordAddress?: string;
  landlordZipCity?: string;
  landlordPhone?: string;
  landlordEmail?: string;
  landlordRepresentedBy?: string;
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
    dev: buildDevApi(opts),
  };
}
