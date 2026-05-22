import { z } from "zod";
import { ExpenseCategory } from "@prisma/client";

// ── GET /buildings/:id/financials query params ──────────────

/** ISO date string YYYY-MM-DD */
const isoDate = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/, "Expected YYYY-MM-DD format");

export const GetBuildingFinancialsSchema = z.object({
  from: isoDate,
  to: isoDate,
  forceRefresh: z
    .enum(["true", "false"])
    .optional()
    .transform((v) => v === "true"),
  groupByAccount: z
    .enum(["true", "false"])
    .optional()
    .transform((v) => v === "true"),
});

export type GetBuildingFinancialsQuery = z.infer<
  typeof GetBuildingFinancialsSchema
>;

// ── POST /invoices/:id/set-expense-category body ────────────

export const SetExpenseCategorySchema = z.object({
  expenseCategory: z.nativeEnum(ExpenseCategory, {
    message: `Must be one of: ${Object.values(ExpenseCategory).join(", ")}`,
  }),
});

export type SetExpenseCategoryBody = z.infer<typeof SetExpenseCategorySchema>;

// ── POST /buildings/:id/financial-snapshots/refresh body ────

export const RefreshSnapshotsSchema = z.object({
  years: z
    .number()
    .int()
    .min(1)
    .max(20)
    .optional()
    .default(5),
});

export type RefreshSnapshotsBody = z.infer<typeof RefreshSnapshotsSchema>;

// ── GET /financials/portfolio-summary query params ──────────

export const PortfolioSummarySchema = z.object({
  from: isoDate,
  to: isoDate,
});

export type PortfolioSummaryQuery = z.infer<typeof PortfolioSummarySchema>;
