// Type surface for the hot-state store (ADR-0001 Phase 6A). Hand-written to match hot-state.mjs.
// The Redis-backed store in apps/server implements this same interface. Hot-state is cache-only.

export interface HotStateStore {
  readonly backend: string;
  get(key: string): Promise<string | null>;
  set(key: string, value: string | number, ttlMs?: number): Promise<{ ok: boolean }>;
  del(key: string): Promise<{ ok: boolean }>;
  /** Acquire a lock; ok=false when already held (and unexpired). */
  lock(key: string, ttlMs: number): Promise<{ ok: boolean; token: string | null }>;
  /** Release a lock; only succeeds when token matches (or token omitted). */
  unlock(key: string, token?: string | null): Promise<{ ok: boolean }>;
  /** Increment a rate-limit counter for the current window; returns the new count. */
  incrRateLimit(key: string, ttlMs: number): Promise<number>;
  getCursor(name: string): Promise<string | null>;
  setCursor(name: string, value: string | number): Promise<{ ok: boolean }>;
  /** First claim wins; a duplicate returns the previously-stored result (idempotent replay). */
  claimIdempotencyKey(key: string, ttlMs: number, value?: unknown): Promise<{ claimed: boolean; existing: unknown | null }>;
  readIdempotencyKey(key: string): Promise<unknown | null>;
  releaseIdempotencyKey(key: string): Promise<{ ok: boolean }>;
  getProviderHealth(): Promise<unknown | null>;
  setProviderHealth(snapshot: unknown, ttlMs?: number): Promise<{ ok: boolean }>;
  getReadiness(): Promise<unknown | null>;
  setReadiness(obj: unknown, ttlMs?: number): Promise<{ ok: boolean }>;
}

export interface MemoryHotStateDeps {
  now?: () => number;
  genToken?: () => string;
}

export function createMemoryHotStateStore(deps?: MemoryHotStateDeps): HotStateStore;
