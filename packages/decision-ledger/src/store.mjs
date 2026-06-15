// @soltrade/decision-ledger — storage interface + adapters (ADR-0001 Phase 2A).
// A store exposes read() -> { value, corrupt } and write(value). Backend-agnostic so the
// ledger logic stays identical across the JSON adapter (today) and Postgres (Phase 4).

/** In-memory store — for tests and ephemeral use. */
export function createMemoryIntentStore(initial) {
  let state = (initial && typeof initial === 'object') ? initial : { intents: {} };
  return {
    read() { return { value: state, corrupt: false }; },
    write(value) { state = value; },
  };
}

/**
 * JSON-file store — wraps the host's atomic readJson/writeJson helpers so the package never
 * touches the filesystem directly. readJson is expected to return { value, corrupt } (apps/server
 * util.mjs shape); a plain value is also tolerated. `corrupt` is surfaced so the canonical API
 * can fail closed on a damaged ledger file.
 */
export function createJsonIntentStore({ file, readJson, writeJson, fallback = { intents: {} } } = {}) {
  if (!file || typeof readJson !== 'function' || typeof writeJson !== 'function') {
    throw new Error('json_intent_store_requires_file_and_io');
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
