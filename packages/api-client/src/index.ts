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
  | "IN_PROGRESS"
  | "COMPLETED";

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
  description: string;
  category: string | null;
  estimatedCost: number | null;
  status: RequestStatus;
  contactPhone?: string | null;
  tenantId?: string | null;
  unitId?: string | null;
  applianceId?: string | null;
  assignedContractor: ContractorSummary | null;
  tenant?: TenantSummary | null;
  unit?: UnitSummary | null;
  appliance?: ApplianceSummary | null;
  createdAt: string;
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
  createdAt: string;
}

export interface UnitDTO {
  id: string;
  orgId: string;
  buildingId: string;
  unitNumber: string;
  floor?: string;
  type: UnitType;
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

export interface TenantDTO {
  id: string;
  orgId: string;
  name: string;
  phone: string;
  email?: string;
  unitId?: string;
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

  const res = await fetch(url.toString(), {
    method,
    headers,
    body: body !== undefined ? JSON.stringify(body) : undefined,
  });

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
    list: (params?: PaginationParams) =>
      request<PaginatedList<MaintenanceRequestDTO>>(opts, "GET", "/requests", undefined, params as Record<string, string | number | boolean | undefined>),

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
    list: (params?: PaginationParams) =>
      request<PaginatedList<JobDTO>>(opts, "GET", "/jobs", undefined, params as Record<string, string | number | boolean | undefined>),

    get: (id: string) =>
      request<JobDTO>(opts, "GET", `/jobs/${id}`),

    update: (id: string, body: { status?: JobStatus; actualCost?: number }) =>
      request<JobDTO>(opts, "PATCH", `/jobs/${id}`, body),
  };
}

function buildInvoicesApi(opts: ClientOptions) {
  return {
    list: (params?: PaginationParams) =>
      request<PaginatedList<InvoiceDTO>>(opts, "GET", "/invoices", undefined, params as Record<string, string | number | boolean | undefined>),

    get: (id: string) =>
      request<InvoiceDTO>(opts, "GET", `/invoices/${id}`),

    create: (body: {
      jobId: string;
      description?: string;
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

    updateBuilding: (id: string, body: Partial<Pick<BuildingDTO, "name" | "address" | "city" | "postalCode">>) =>
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

    updateUnit: (id: string, body: Partial<Pick<UnitDTO, "unitNumber" | "floor" | "type">>) =>
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

    triage: (body: { text: string }) =>
      request<unknown>(opts, "POST", "/triage", body),

    register: (body: { name: string; email: string; password: string; role: Role }) =>
      request<{ id: string; token: string }>(opts, "POST", "/auth/register", body),

    login: (body: { email: string; password: string }) =>
      request<{ token: string; user: unknown }>(opts, "POST", "/auth/login", body),
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
  };
}
