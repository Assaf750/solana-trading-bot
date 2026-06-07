// @soltrade/foundations — CostPipeline (Build Order #1).
// SOURCE: docs/00-ARCHITECTURE.md §9 (CostEstimate) + "Cost Pipeline <-> Hot Path" rule.
// Deterministic, local, NO external calls. Field names are the ARCHITECTURE-defined
// internal CostEstimate fields (internal-only; not SSOT API/data names). `platform_fee_bps`
// is the only config/SSOT name consumed (G8). No P&L names; no rejected names.
//
// FAIL-SAFE: a missing or stale critical cost input => NOT priceable (reject) — never
// assume 0 / never "continue with a stale value" (ARCHITECTURE: reject or EXITS_ONLY).

// Critical inputs that must be present AND fresh to price a trade (deterministic cost).
const CRITICAL_INPUTS = Object.freeze([
  'entry_slippage_bps', 'price_impact_bps', 'base_fee_lamports', 'priority_fee_lamports',
  'compute_unit_limit', 'compute_unit_price', 'est_exit_slippage_bps', 'est_exit_cost',
]);

const isNum = (v) => typeof v === 'number' && Number.isFinite(v);

/**
 * Deterministically estimate trade cost from a CostEstimate input (ARCH §9).
 * @param input CostEstimate fields + optional `stale` set/array marking stale critical caches.
 * @returns { priceable, reason?, total_cost_lamports?, breakdown? }
 */
export function estimateCost(input) {
  if (input == null || typeof input !== 'object') {
    return { priceable: false, reason: 'cost_input_missing' };
  }
  const stale = new Set(input.stale || []); // caller marks stale caches (TTL handled upstream)

  for (const key of CRITICAL_INPUTS) {
    if (!isNum(input[key])) return { priceable: false, reason: `missing_critical_input:${key}` };
    if (stale.has(key)) return { priceable: false, reason: `stale_critical_input:${key}` };
  }

  // Optional inputs default to 0 ONLY when explicitly absent and non-critical.
  const n = (k) => (isNum(input[k]) ? input[k] : 0);
  const platform_fee_bps = n('platform_fee_bps'); // SSOT G8 (default 0)

  // Lamport-denominated deterministic components.
  const compute_fee_lamports = input.compute_unit_limit * input.compute_unit_price;
  const ata_net_lamports = n('ata_rent_lamports') - n('ata_close_recovery');
  const jito_tip_lamports = n('jito_tip_lamports'); // may legitimately be 0 (not always paid)

  const breakdown = {
    base_fee_lamports: input.base_fee_lamports,
    priority_fee_lamports: input.priority_fee_lamports,
    compute_fee_lamports,
    jito_tip_lamports,
    ata_net_lamports,
    est_exit_cost: input.est_exit_cost,
    // bps components are surfaced for EV math downstream (not summed into lamports here).
    entry_slippage_bps: input.entry_slippage_bps,
    price_impact_bps: input.price_impact_bps,
    est_exit_slippage_bps: input.est_exit_slippage_bps,
    platform_fee_bps,
  };

  const total_cost_lamports =
    input.base_fee_lamports + input.priority_fee_lamports + compute_fee_lamports +
    jito_tip_lamports + ata_net_lamports + input.est_exit_cost;

  return { priceable: true, total_cost_lamports, breakdown };
}

export const COST_CRITICAL_INPUTS = CRITICAL_INPUTS;
