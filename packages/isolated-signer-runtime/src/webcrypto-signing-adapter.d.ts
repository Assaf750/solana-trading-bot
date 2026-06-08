// Type declarations for the E2-C3-2 WebCrypto sign-only adapter SKELETON.
// Skeleton only: WebCrypto local capability; no project signing, no key, no key export, no execution authority.

export interface WebcryptoSigningAdapterDescriptor {
  readonly component: 'isolated-signer-webcrypto-adapter';
  readonly status: 'skeleton';
  readonly backend: 'webcrypto';
  readonly algorithm: 'Ed25519';
  readonly can_sign: false;
  readonly can_send: false;
  readonly holds_key_material: false;
  readonly can_export_key: false;
  readonly is_live: false;
  readonly wired_to_custody: false;
  readonly wired_to_preflight: false;
  readonly note: string;
}

export interface WebcryptoSignFailClosedResult {
  readonly ok: false;
  readonly status: 'skeleton';
  readonly signed: false;
  readonly signature: null;
  readonly can_send: false;
  readonly reason: string;
}

export interface WebcryptoSigningAdapter {
  describe(): WebcryptoSigningAdapterDescriptor;
  readonly status: 'skeleton';
  probeSupport(): Promise<boolean>;
  attemptSign(request?: unknown): WebcryptoSignFailClosedResult;
}

export function describeWebcryptoSigningAdapter(): WebcryptoSigningAdapterDescriptor;
export function probeWebcryptoEd25519Support(): Promise<boolean>;
export function createWebcryptoSigningAdapter(): WebcryptoSigningAdapter;
export const WEBCRYPTO_SIGNING_ADAPTER_STATUS: 'skeleton';
