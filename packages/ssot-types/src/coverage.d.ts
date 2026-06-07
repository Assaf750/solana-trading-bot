// Types for coverage.mjs — SSOT coverage manifest.

export const SSOT_GROUPS_CONSUMED: Readonly<{
  full: readonly number[];
  partial: readonly number[];
  candidate_partial: readonly number[];
}>;

/** Candidate enums registered in SSOT but explicitly NOT yet included (deferred_candidate). */
export const DEFERRED_CANDIDATES: readonly `candidate_${string}`[];

/** Always false while any candidate is deferred. */
export const CLAIMS_FULL_SSOT_COVERAGE: boolean;
