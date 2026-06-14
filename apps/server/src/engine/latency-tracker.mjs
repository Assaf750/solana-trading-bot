// latency-tracker.mjs — Phase 0 measurement gate of the restructuring plan.
// Records pipeline-latency samples so the Rust hot-executor / ShredStream investment
// is justified by DATA, not assumption. The decisive metric is `ingestion_lag_ms`
// (leader tx block time -> our receipt): if it is large, a gRPC/ShredStream upgrade
// pays off; if small, latency is NOT the binding constraint. Pure ring buffer + pctiles.
import { readJson, writeJson, nowIso } from '../util.mjs';

const FILE = 'latency-samples.json';
const MAX_SAMPLES = 500;
const METRICS = ['ingestion_lag_ms', 'decision_ms', 'submit_ms', 'total_ms'];

export function createLatencyTracker({ file = FILE, max = MAX_SAMPLES } = {}) {
  function load() { return readJson(file, { samples: [] }).value; }
  function save(s) { writeJson(file, s); }

  /** Record one pipeline observation. Each metric is kept only when finite & sane;
   *  a sample with no usable metric is dropped (never persists junk). */
  function record(sample) {
    const clean = {};
    for (const k of METRICS) {
      const v = Number(sample?.[k]);
      // bound to a sane window: drop negatives (clock skew) and absurd outliers
      if (Number.isFinite(v) && v >= 0 && v < 600000) clean[k] = v;
    }
    if (Object.keys(clean).length === 0) return false;
    const s = load();
    clean.ts = nowIso();
    s.samples.push(clean);
    if (s.samples.length > max) s.samples.splice(0, s.samples.length - max);
    save(s);
    return true;
  }

  function pct(sortedAsc, p) {
    if (!sortedAsc.length) return null;
    const idx = Math.min(sortedAsc.length - 1, Math.max(0, Math.ceil((p / 100) * sortedAsc.length) - 1));
    return Math.round(sortedAsc[idx]);
  }

  function summary() {
    const s = load();
    const out = { count: s.samples.length, metrics: {} };
    for (const m of METRICS) {
      const vals = s.samples.map((x) => x[m]).filter((v) => Number.isFinite(v)).sort((a, b) => a - b);
      if (!vals.length) continue;
      out.metrics[m] = {
        n: vals.length,
        p50: pct(vals, 50), p90: pct(vals, 90), p99: pct(vals, 99),
        max: Math.round(vals[vals.length - 1]),
      };
    }
    return out;
  }

  return { record, summary };
}
