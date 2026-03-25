/**
 * COA Validation Schemas (Zod)
 *
 * Input validation for Chart of Accounts endpoints.
 */

import { z } from "zod";

// ─── ExpenseType ───────────────────────────────────────────────

export const CreateExpenseTypeSchema = z.object({
  name: z
    .string()
    .min(1, "Name is required")
    .max(200, "Name must be ≤ 200 characters"),
  description: z.string().max(1000).optional(),
  code: z
    .string()
    .max(50, "Code must be ≤ 50 characters")
    .optional(),
});

export const UpdateExpenseTypeSchema = z.object({
  name: z.string().min(1).max(200).optional(),
  description: z.string().max(1000).optional(),
  code: z.string().max(50).optional(),
  isActive: z.boolean().optional(),
});

// ─── Account ───────────────────────────────────────────────────

export const CreateAccountSchema = z.object({
  name: z
    .string()
    .min(1, "Name is required")
    .max(200, "Name must be ≤ 200 characters"),
  code: z
    .string()
    .max(50, "Code must be ≤ 50 characters")
    .optional(),
  accountType: z
    .enum(["EXPENSE", "REVENUE", "ASSET"])
    .optional()
    .default("EXPENSE"),
});

export const UpdateAccountSchema = z.object({
  name: z.string().min(1).max(200).optional(),
  code: z.string().max(50).optional(),
  accountType: z.enum(["EXPENSE", "REVENUE", "ASSET"]).optional(),
  isActive: z.boolean().optional(),
});

// ─── ExpenseMapping ────────────────────────────────────────────

export const CreateExpenseMappingSchema = z.object({
  expenseTypeId: z.string().uuid("expenseTypeId must be a valid UUID"),
  accountId: z.string().uuid("accountId must be a valid UUID"),
  buildingId: z
    .string()
    .uuid("buildingId must be a valid UUID")
    .nullable()
    .optional(),
});
