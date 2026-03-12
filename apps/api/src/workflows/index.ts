/**
 * Workflows barrel export.
 *
 * Each workflow is the canonical entry point for one business action.
 * Route handlers call workflows; workflows orchestrate services.
 *
 * Usage:
 *   import { createRequestWorkflow } from "../workflows";
 */

export { createRequestWorkflow } from "./createRequestWorkflow";
export type { CreateRequestWorkflowInput, CreateRequestWorkflowResult } from "./createRequestWorkflow";

export { approveRequestWorkflow } from "./approveRequestWorkflow";
export type { ApproveRequestInput, ApproveRequestResult } from "./approveRequestWorkflow";

export { assignContractorWorkflow } from "./assignContractorWorkflow";
export type { AssignContractorInput, AssignContractorResult } from "./assignContractorWorkflow";

export { unassignContractorWorkflow } from "./unassignContractorWorkflow";
export type { UnassignContractorInput, UnassignContractorResult } from "./unassignContractorWorkflow";

export { ownerRejectWorkflow } from "./ownerRejectWorkflow";
export type { OwnerRejectInput, OwnerRejectResult } from "./ownerRejectWorkflow";

export { completeJobWorkflow } from "./completeJobWorkflow";
export type { CompleteJobInput, CompleteJobResult } from "./completeJobWorkflow";

export { issueInvoiceWorkflow } from "./issueInvoiceWorkflow";
export type { IssueInvoiceInput, IssueInvoiceResult } from "./issueInvoiceWorkflow";

export { evaluateLegalRoutingWorkflow } from "./evaluateLegalRoutingWorkflow";
export type { EvaluateLegalRoutingInput, EvaluateLegalRoutingResult } from "./evaluateLegalRoutingWorkflow";

export { approveInvoiceWorkflow } from "./approveInvoiceWorkflow";
export type { ApproveInvoiceInput, ApproveInvoiceResult } from "./approveInvoiceWorkflow";

export { disputeInvoiceWorkflow } from "./disputeInvoiceWorkflow";
export type { DisputeInvoiceInput, DisputeInvoiceResult } from "./disputeInvoiceWorkflow";

export { payInvoiceWorkflow } from "./payInvoiceWorkflow";
export type { PayInvoiceInput, PayInvoiceResult } from "./payInvoiceWorkflow";

export { activateLeaseWorkflow } from "./activateLeaseWorkflow";
export type { ActivateLeaseInput, ActivateLeaseResult } from "./activateLeaseWorkflow";

export { terminateLeaseWorkflow } from "./terminateLeaseWorkflow";
export type { TerminateLeaseInput, TerminateLeaseResult } from "./terminateLeaseWorkflow";

export { markLeaseReadyWorkflow } from "./markLeaseReadyWorkflow";
export type { MarkLeaseReadyInput, MarkLeaseReadyResult } from "./markLeaseReadyWorkflow";

export { submitRentalApplicationWorkflow } from "./submitRentalApplicationWorkflow";
export type { SubmitRentalApplicationInput, SubmitRentalApplicationResult } from "./submitRentalApplicationWorkflow";

export { uploadMaintenanceAttachmentWorkflow } from "./uploadMaintenanceAttachmentWorkflow";
export type { UploadMaintenanceAttachmentInput } from "./uploadMaintenanceAttachmentWorkflow";

export { tenantSelfPayWorkflow } from "./tenantSelfPayWorkflow";
export type { TenantSelfPayInput, TenantSelfPayResult } from "./tenantSelfPayWorkflow";

export type { WorkflowContext } from "./context";

export {
  InvalidTransitionError,
  assertRequestTransition,
  assertJobTransition,
  assertInvoiceTransition,
  assertLeaseTransition,
  assertRentalApplicationTransition,
  canTransitionRequest,
  canTransitionJob,
  canTransitionInvoice,
  canTransitionLease,
  canTransitionRentalApplication,
} from "./transitions";
