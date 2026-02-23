import { z } from "zod";
import { RuleAction } from "@prisma/client";
import { RuleConditionField, RuleConditionOperator } from "../types/approvalRules";

export const RuleConditionSchema = z.object({
  field: z.nativeEnum(RuleConditionField),
  operator: z.nativeEnum(RuleConditionOperator),
  value: z.union([z.string().min(1), z.number()]), // value is required
});

export const CreateApprovalRuleSchema = z.object({
  buildingId: z.string().uuid().optional().nullable(),
  name: z.string().min(1).max(200),
  priority: z.number().int().min(0).max(100).optional(),
  conditions: z.array(RuleConditionSchema).min(1).max(10),
  action: z.nativeEnum(RuleAction),
});

export const UpdateApprovalRuleSchema = z.object({
  name: z.string().min(1).max(200).optional(),
  priority: z.number().int().min(0).max(100).optional(),
  isActive: z.boolean().optional(),
  conditions: z.array(RuleConditionSchema).min(1).max(10).optional(),
  action: z.nativeEnum(RuleAction).optional(),
});

export type CreateApprovalRuleDTO = z.infer<typeof CreateApprovalRuleSchema>;
export type UpdateApprovalRuleDTO = z.infer<typeof UpdateApprovalRuleSchema>;
