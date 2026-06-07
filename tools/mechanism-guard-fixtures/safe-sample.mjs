// SAFE sample for the mechanism guard self-test. Inert: never imported or executed.
// Demonstrates patterns that MUST NOT trip the guard (comments + governed strings).
//
// Prohibition comments are fine: no signTransaction, no sendTransaction, no KeyManager here.
import { something } from '../../packages/ssot-types/src/core-enums.mjs';

// Governed SSOT command-name STRING (allowed; not a live mechanism call):
const COMMAND_VALUES = ['activate_real_live', 'drain_execution_wallet'];

// A registry's refusal list as STRINGS (key material is refused, not used):
const FORBIDDEN_FIELDS = ['private_key', 'secretKey', 'mnemonic', 'keypair'];

// A non-import string that merely mentions a module name must NOT count as an import:
const note = '@solana/web3.js is forbidden as an import';

export { something, COMMAND_VALUES, FORBIDDEN_FIELDS, note };
