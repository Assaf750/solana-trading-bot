// @soltrade/provider-adapters — provider-health monitor (ADR-0001 Phase 2D).
// Byte-for-byte port of apps/server engine/provider-health.mjs. In-memory rolling health over a
// sliding window; no persistence (live operational health, resets on restart).

const WINDOW = 120;
const DEGRADED_PCT = 10;
const DOWN_PCT = 50;

export function createProviderHealthMonitor({ window = WINDOW, now = () => Date.now() } = {}) {
  const providers = new Map();

  function record(provider, ok, ms, error) {
    if (!provider) return;
    let p = providers.get(provider);
    if (!p) { p = { outcomes: [], lastError: null, lastErrorTs: null }; providers.set(provider, p); }
    p.outcomes.push({ ok: !!ok, ms: Number.isFinite(ms) ? ms : null, error: ok ? null : (error || 'error'), ts: now() });
    if (p.outcomes.length > window) p.outcomes.shift();
    if (!ok) { p.lastError = error || 'error'; p.lastErrorTs = now(); }
  }

  function pctile(sortedAsc, p) {
    if (!sortedAsc.length) return null;
    const idx = Math.min(sortedAsc.length - 1, Math.floor((p / 100) * sortedAsc.length));
    return sortedAsc[idx];
  }

  function statusOf(errPct, calls) {
    if (calls === 0) return 'unknown';
    if (errPct >= DOWN_PCT) return 'down';
    if (errPct >= DEGRADED_PCT) return 'degraded';
    return 'healthy';
  }

  function snapshot() {
    const out = {};
    for (const [name, p] of providers) {
      const calls = p.outcomes.length;
      const oks = p.outcomes.reduce((a, o) => a + (o.ok ? 1 : 0), 0);
      const errors = calls - oks;
      const errPct = calls ? Math.round((errors / calls) * 1000) / 10 : 0;
      const lat = p.outcomes.map((o) => o.ms).filter((m) => Number.isFinite(m)).sort((a, b) => a - b);
      out[name] = {
        calls,
        ok: oks,
        errors,
        error_pct: errPct,
        p50_ms: pctile(lat, 50),
        p90_ms: pctile(lat, 90),
        last_error: p.lastError,
        last_error_ts: p.lastErrorTs,
        status: statusOf(errPct, calls),
      };
    }
    return out;
  }

  return { record, snapshot };
}
