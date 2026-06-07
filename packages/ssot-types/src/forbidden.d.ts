// Types for forbidden.mjs.

export interface ForbiddenEntry {
  /** The rejected/forbidden name — must never be a real field/enum/command/value. */
  name: string;
  /** Approved replacement, or null if forbidden forever. */
  canonical: string | null;
  /** Why it is rejected. */
  reason: string;
}

export const FORBIDDEN: readonly ForbiddenEntry[];
export const FORBIDDEN_NAMES: readonly string[];
