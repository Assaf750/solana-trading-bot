// Types for redis-adapter.mjs. Projection/cache only — no event bus, no secrets.

export interface RedisProjectionAdapter {
  readonly namespaces: readonly string[];
  set(namespace: string, key: string, value: unknown): void;
  get(namespace: string, key: string): unknown;
  has(namespace: string, key: string): boolean;
  /** Discard a namespace so it can be rebuilt from its source. */
  rebuild(namespace: string): void;
  rebuildSource(namespace: string): string;
  // No publish / subscribe / exec channel.
}

export function createRedisProjectionAdapter(): RedisProjectionAdapter;
