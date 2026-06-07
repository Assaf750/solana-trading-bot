// Types for validate.mjs.

export interface ConfigValidationResult {
  /** 'invalid' (errors or unknown names) | 'warning' | 'valid' (SSOT Group 10 validation_status). */
  validation_status: 'valid' | 'warning' | 'invalid';
  /** true only if no errors/unknown names AND all Hard Risk limits present (SSOT Group 10). */
  real_live_config_valid: boolean;
  errors: string[];
  warnings: string[];
  unknown_names: string[];
}

export function validateConfig(config: unknown): ConfigValidationResult;
