// @soltrade/positions — storage interface + adapters (ADR-0001 Phase 2B).
// A store exposes read() -> { value, corrupt } and write(value). Same shape as decision-ledger so
// the Postgres migration (Phase 4) swaps the adapter without touching the book logic.

/** In-memory store — tests and ephemeral use. */
export function createMemoryPositionStore(initial = null) {
  let state = initial;
  return {
    read() { return { value: state, corrupt: false }; },
    write(value) { state = value; },
  };
}

/**
 * JSON-file store — wraps the host's atomic readJson/writeJson helpers. readJson is expected to
 * return { value, corrupt } (apps/server util.mjs shape). The legacy book reads with fallback null,
 * so the default fallback here is null to preserve byte-parity.
 */
export function createJsonPositionStore({ file, readJson, writeJson, fallback = null } = {}) {
  if (!file || typeof readJson !== 'function' || typeof writeJson !== 'function') {
    throw new Error('json_position_store_requires_file_and_io');
  }
  return {
    read() {
      const r = readJson(file, fallback);
      if (r && typeof r === 'object' && 'value' in r) return { value: r.value, corrupt: !!r.corrupt };
      return { value: r, corrupt: false };
    },
    write(value) { writeJson(file, value); },
  };
}
