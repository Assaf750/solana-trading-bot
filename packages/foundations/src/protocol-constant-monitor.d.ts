// Types for protocol-constant-monitor.mjs. Output uses SSOT G5 protocol_constant_status.

import type { ProtocolConstantStatus } from '../../ssot-types/src/core-enums';

export interface ProtocolConstantResult {
  protocol_constant_status: ProtocolConstantStatus; // 'green' | 'changed'
  changed_keys: string[];
  killed: boolean;
  reason?: string;
}

export function evaluateProtocolConstants(
  observed: Record<string, unknown>,
  baseline: Record<string, unknown>,
): ProtocolConstantResult;
