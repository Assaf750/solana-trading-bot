// Types for schema.mjs. Config names owned by docs/02-CONFIG + docs/01-SSOT.

export type RuleKind =
  | 'bool' | 'enum' | 'string' | 'number' | 'number_pos' | 'number_nonneg'
  | 'pct_pos' | 'pct_nonneg' | 'pct_open100' | 'usdt_pos'
  | 'int_pos' | 'int_nonneg' | 'duration_nonneg' | 'auto';

export interface FieldDef {
  rule: RuleKind;
  enumRef?: string;
  default?: unknown;
  scope: string;
  mutable_when_open: 'yes' | 'no' | 'n/a' | 'frozen_at_entry' | 'fixed' | 'asymmetric';
  applies_to_existing: string;
  safety_critical: 'yes' | 'no' | 'partial';
  required?: boolean;
  reference?: boolean;
}

export const ENUM_REFS: Readonly<Record<string, readonly string[]>>;
export const FIELDS: Readonly<Record<string, Readonly<Record<string, FieldDef>>>>;
export const CONFIG_OBJECTS: readonly string[];
export const HARD_RISK_FIELDS: readonly string[];
export const EV_FIELDS: readonly string[];
export const PARTIAL_SELL_ORDER: readonly string[];
