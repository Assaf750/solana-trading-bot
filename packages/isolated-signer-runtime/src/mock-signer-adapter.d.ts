// Type declarations for the E2-C2 mock signer adapter wiring (mock only, no crypto, no real signing).

import type { SigningAdapterContractDescriptor, NoopSigningAdapter } from '../../signing-adapter-contract/src/signing-adapter-contract';

export interface MockSignerDescriptor {
  readonly component: 'isolated-signer-mock-signer';
  readonly status: 'mock';
  readonly can_sign: false;
  readonly can_send: false;
  readonly has_key_material: false;
  readonly holds_key_material: false;
  readonly produces_real_signature: false;
  readonly is_live: false;
  readonly contract: SigningAdapterContractDescriptor;
  readonly note: string;
}

export interface MockSignResult {
  readonly ok?: boolean;
  readonly mock: true;
  readonly adapter_status: 'mock';
  readonly preflight_ok: boolean;
  readonly can_attempt_signing: false;
  readonly signed: false;
  readonly signature: null;
  readonly can_send: false;
  readonly blockers?: readonly string[];
  readonly contract_noop_ok?: false;
  readonly recommended_signer_profile_status?: 'DEGRADED';
  readonly note?: string;
}

export interface MockSignerAdapter {
  describeMockSigner(): MockSignerDescriptor;
  readonly contractNoop: NoopSigningAdapter;
  readonly status: 'mock';
  attemptMockSign(input?: Record<string, unknown>): MockSignResult;
}

export function describeMockSigner(): MockSignerDescriptor;
export function createMockSignerAdapter(opts?: { auditLog?: unknown }): MockSignerAdapter;
export const MOCK_SIGNER_STATUS: 'mock';
