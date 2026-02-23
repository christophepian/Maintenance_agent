/**
 * Approval rule enums - TypeScript definitions
 * These are NOT Prisma enums since they're used only in JSON fields
 */

export enum RuleConditionField {
  CATEGORY = "CATEGORY",
  ESTIMATED_COST = "ESTIMATED_COST",
  UNIT_TYPE = "UNIT_TYPE",
  UNIT_NUMBER = "UNIT_NUMBER",
}

export enum RuleConditionOperator {
  EQUALS = "EQUALS",
  NOT_EQUALS = "NOT_EQUALS",
  LESS_THAN = "LESS_THAN",
  LESS_THAN_OR_EQUAL = "LESS_THAN_OR_EQUAL",
  GREATER_THAN = "GREATER_THAN",
  GREATER_THAN_OR_EQUAL = "GREATER_THAN_OR_EQUAL",
  CONTAINS = "CONTAINS",
  STARTS_WITH = "STARTS_WITH",
  ENDS_WITH = "ENDS_WITH",
}

export type RuleCondition = {
  field: RuleConditionField;
  operator: RuleConditionOperator;
  value: string | number;
};
