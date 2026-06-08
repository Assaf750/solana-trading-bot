// @soltrade/isolated-signer-runtime — Mock Signer Adapter WIRING (Gate E / E2-C2).
// SOURCE: docs/00-ARCHITECTURE.md §4.3 + docs/09-THREAT-SECURITY §3/§7 + reports/E2-C plan (E2-C2: test-only
//   mock signer inside the allowlisted path; NO real key, NO crypto, NO real signature).
//
// MOCK ONLY — NO crypto, NO real signing, NO key. This wires the existing signing PREFLIGHT gate (E2-C0/D/E:
// preflight + readiness + audit before/after) to the signing-adapter CONTRACT (E2-C1). It runs a MOCK signer
// ONLY after preflight_ok===true, and even then produces NO real signature (signed:false / signature:null /
// can_send:false). The contract's no-op adapter stays fail-closed throughout.
//
// ABSENT BY DESIGN (and forbidden here): crypto/signing library, KMS/vault, KeyManager, key material,
// transaction building/serialisation, real signing/sending, RPC/provider, DB, REAL-LIVE activation, execution
// authority.

import { createSigningPreflightGate } from './signing-preflight-gate.mjs';
import {
  describeSigningAdapterContract,
  createNoopSigningAdapter,
} from '../../signing-adapter-contract/src/index.mjs';

const STATUS = 'mock';

// Read-only descriptor: every execution capability false; explicitly does NOT produce a real signature.
export function describeMockSigner() {
  return Object.freeze({
    component: 'isolated-signer-mock-signer',
    status: STATUS,
    can_sign: false,
    can_send: false,
    has_key_material: false,
    holds_key_material: false,
    produces_real_signature: false,
    is_live: false,
    contract: describeSigningAdapterContract(),
    note: 'E2-C2 mock signer wiring: runs only after preflight_ok; produces NO real signature; real signing '
      + 'requires separate E2-C3 approval. No crypto, no key, no KMS, no send.',
  });
}

// Create the mock signer adapter. Routes through the preflight gate (preflight + readiness + before/after
// audit). On preflight_ok it returns a MOCK result with NO real signature. The contract no-op adapter is held
// and stays fail-closed (proving the contract invariant) even when the preflight is valid.
export function createMockSignerAdapter({ auditLog } = {}) {
  const gate = createSigningPreflightGate({ auditLog });
  const noop = createNoopSigningAdapter();

  return Object.freeze({
    describeMockSigner,
    contractNoop: noop, // the contract's fail-closed adapter; never signs
    status: STATUS,

    // Attempt a MOCK sign. Never produces a real signature. Runs the mock branch ONLY when preflight_ok.
    attemptMockSign(input = {}) {
      // Gate: preflight + readiness + key-material refusal + audit before/after. Never signs.
      const result = gate.evaluate(input);

      // Preflight failed -> return the blocked envelope; the mock signer does NOT attempt anything.
      if (result.preflight_ok !== true) {
        return Object.freeze({ ...result, mock: true, adapter_status: STATUS });
      }

      // Preflight ok: the CONTRACT no-op adapter STILL fails closed (invariant: contracts never sign).
      const contractNoopResult = noop.sign({ preflight: result });

      // The MOCK signer returns a mock result — NO real signature, NO send, NO bytes.
      return Object.freeze({
        ok: true,
        mock: true,
        adapter_status: STATUS,
        preflight_ok: true,
        can_attempt_signing: false,
        signed: false,
        signature: null,
        can_send: false,
        contract_noop_ok: contractNoopResult.ok, // false: the contract adapter never signs
        note: 'mock signer ran after preflight_ok; NO real signature; real signing requires separate E2-C3 approval',
      });
    },
  });
}

export const MOCK_SIGNER_STATUS = STATUS;
