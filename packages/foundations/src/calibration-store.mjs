// @soltrade/foundations — CalibrationStore (Build Order #2).
// SOURCE: docs/00-ARCHITECTURE.md §9 (CalibrationRecord) + Calibration Finality Policy
// ("only finalized records enter priors"). In-memory dev abstraction; deterministic;
// NO external calls. Field names are ARCHITECTURE-defined internal CalibrationRecord
// fields (internal-only; not SSOT API/data names).
//
// FAIL-SAFE: non-finalized records are excluded from priors; with no real data yet
// (pure PAPER) priors start PESSIMISTIC, not optimistic.

const isNum = (v) => typeof v === 'number' && Number.isFinite(v);

// Pessimistic starting priors (PAPER, no real_* yet). Conservative defaults.
const PESSIMISTIC_PRIORS = Object.freeze({ p_fill: 0, p_exit_success: 0, route_failure_flag_rate: 1 });

export function createCalibrationStore() {
  const records = []; // append-only list of CalibrationRecord

  function bucketKey(r) {
    return [r.brain, r.signal_bucket, r.wallet_cluster, r.token_risk_bucket]
      .map((x) => (x == null ? '∅' : String(x))).join('|');
  }

  // A record is finalized only when both processed and confirmed timestamps exist.
  function isFinalized(r) {
    return r != null && r.timestamp_processed != null && r.timestamp_confirmed != null;
  }

  return Object.freeze({
    add(record) {
      if (record == null || typeof record !== 'object') throw new Error('calibration record must be an object');
      records.push(Object.freeze({ ...record }));
      return records.length - 1;
    },
    /** Priors for a cohort bucket. Only finalized records contribute; otherwise pessimistic. */
    getPriors(bucket) {
      const key = bucketKey(bucket || {});
      const finalized = records.filter((r) => isFinalized(r) && bucketKey(r) === key);
      if (finalized.length === 0) return { ...PESSIMISTIC_PRIORS, sample_size: 0, source: 'pessimistic_default' };
      const fills = finalized.filter((r) => isNum(r.real_fill_price)).length;
      const exits = finalized.filter((r) => r.real_exit != null).length;
      const routeFailures = finalized.filter((r) => r.route_failure_flag === true).length;
      return {
        p_fill: fills / finalized.length,
        p_exit_success: exits / finalized.length,
        route_failure_flag_rate: routeFailures / finalized.length,
        sample_size: finalized.length,
        source: 'finalized_records',
      };
    },
    finalizedCount() {
      return records.filter(isFinalized).length;
    },
    get length() {
      return records.length;
    },
  });
}

export const CALIBRATION_PESSIMISTIC_PRIORS = PESSIMISTIC_PRIORS;
