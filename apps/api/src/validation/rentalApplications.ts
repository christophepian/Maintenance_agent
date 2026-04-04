import { z } from "zod";

/* ── Helpers ───────────────────────────────────────────────── */

function trimStr(s: string): string {
  return (s || "").trim().replace(/\s+/g, " ");
}

/* ── Enums (must match Prisma schema) ──────────────────────── */

export const APPLICANT_ROLES = ["PRIMARY", "CO_APPLICANT"] as const;

export const RENTAL_DOC_TYPES = [
  "IDENTITY",
  "SALARY_PROOF",
  "PERMIT",
  "DEBT_ENFORCEMENT_EXTRACT",
  "HOUSEHOLD_INSURANCE",
  "PARKING_DOCS",
] as const;

/** Required docs that every applicant must provide */
export const REQUIRED_DOC_TYPES: readonly (typeof RENTAL_DOC_TYPES)[number][] = [
  "IDENTITY",
  "SALARY_PROOF",
  "DEBT_ENFORCEMENT_EXTRACT",
];

/* ── Applicant sub-schema ──────────────────────────────────── */

export const ApplicantSchema = z.object({
  role: z.enum(APPLICANT_ROLES).default("PRIMARY"),

  // Identity (mandatory for submission)
  firstName: z.string().transform(trimStr).refine((s) => s.length >= 1, { message: "firstName required" }),
  lastName: z.string().transform(trimStr).refine((s) => s.length >= 1, { message: "lastName required" }),
  birthdate: z.string().datetime({ offset: true }).optional().or(z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional()),
  nationality: z.string().transform(trimStr).optional(),
  civilStatus: z.string().transform(trimStr).optional(),
  permitType: z.string().transform(trimStr).optional(),

  // Contact
  phone: z.string().transform(trimStr).optional(),
  email: z.preprocess(
    (v) => (typeof v === "string" && v.trim() === "" ? undefined : v),
    z.string().email().optional(),
  ),

  // Address
  currentAddress: z.string().transform(trimStr).optional(),
  currentZipCity: z.string().transform(trimStr).optional(),

  // Employment
  employer: z.string().transform(trimStr).optional(),
  jobTitle: z.string().transform(trimStr).optional(),
  workLocation: z.string().transform(trimStr).optional(),
  employedSince: z.string().optional(),
  netMonthlyIncome: z.number().int().min(0).max(1_000_000).optional(),

  // Debt enforcement
  hasDebtEnforcement: z.boolean().default(false),
});

export type ApplicantInput = z.infer<typeof ApplicantSchema>;

/* ── Create Draft ──────────────────────────────────────────── */

/**
 * Minimal payload to create a draft application.
 * Most fields are optional at draft time; they become mandatory on submit.
 */
export const CreateRentalApplicationSchema = z.object({
  // At least one applicant (primary) required
  applicants: z
    .array(ApplicantSchema)
    .min(1, { message: "At least one applicant is required" }),

  // Unit selection (at least one vacant unit)
  unitIds: z
    .array(z.string().uuid())
    .min(1, { message: "At least one unit must be selected" }),

  // Current housing
  currentLandlordName: z.string().transform(trimStr).optional(),
  currentLandlordAddress: z.string().transform(trimStr).optional(),
  currentLandlordPhone: z.string().transform(trimStr).optional(),
  reasonForLeaving: z.string().transform(trimStr).optional(),
  desiredMoveInDate: z.string().optional(),

  // Household
  householdSize: z.number().int().min(1).max(20).optional(),
  hasPets: z.boolean().optional(),
  petsDescription: z.string().transform(trimStr).optional(),
  hasRcInsurance: z.boolean().optional(),
  rcInsuranceCompany: z.string().transform(trimStr).optional(),
  hasVehicle: z.boolean().optional(),
  vehicleDescription: z.string().transform(trimStr).optional(),
  needsParking: z.boolean().optional(),
  remarks: z.string().transform(trimStr).optional(),
});

export type CreateRentalApplicationInput = z.infer<typeof CreateRentalApplicationSchema>;

/* ── Submit (signature required) ───────────────────────────── */

/**
 * Validates the full payload required for submission.
 * All mandatory fields enforced here.
 */
export const SubmitRentalApplicationSchema = z.object({
  signedName: z
    .string()
    .transform(trimStr)
    .refine((s) => s.length >= 2, { message: "Signature name must be at least 2 characters" }),
});

export type SubmitRentalApplicationInput = z.infer<typeof SubmitRentalApplicationSchema>;

/* ── Upload Attachment ─────────────────────────────────────── */

export const UploadAttachmentMetaSchema = z.object({
  applicantId: z.string().uuid(),
  docType: z.enum(RENTAL_DOC_TYPES),
});

export type UploadAttachmentMeta = z.infer<typeof UploadAttachmentMetaSchema>;

/* ── Owner Selection ───────────────────────────────────────── */

export const OwnerSelectionSchema = z.object({
  primaryApplicationUnitId: z.string().uuid(),
  backup1ApplicationUnitId: z.string().uuid().optional(),
  backup2ApplicationUnitId: z.string().uuid().optional(),
});

export type OwnerSelectionInput = z.infer<typeof OwnerSelectionSchema>;

/* ── Manager Score Adjustment ──────────────────────────────── */

export const AdjustScoreSchema = z.object({
  scoreDelta: z.number().int().min(-100).max(100),
  reason: z
    .string()
    .transform(trimStr)
    .refine((s) => s.length >= 3, { message: "Reason must be at least 3 characters" }),
  overrideJson: z.record(z.string(), z.any()).optional(),
});

export type AdjustScoreInput = z.infer<typeof AdjustScoreSchema>;

/* ── Disqualification Override ─────────────────────────────── */

export const OverrideDisqualificationSchema = z.object({
  reason: z
    .string()
    .transform(trimStr)
    .refine((s) => s.length >= 3, { message: "Reason must be at least 3 characters" }),
});

export type OverrideDisqualificationInput = z.infer<typeof OverrideDisqualificationSchema>;
