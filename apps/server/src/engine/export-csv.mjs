// export-csv.mjs — pure CSV builders for PnL / tax export (no I/O). Fields are quoted safely.

function csvCell(v) {
  const s = v === null || v === undefined ? '' : String(v);
  return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

export function toCsv(headers, rows) {
  const lines = [headers.join(',')];
  for (const r of rows) lines.push(headers.map((h) => csvCell(r[h])).join(','));
  return lines.join('\n');
}

/** Closed positions, each joined with its buy cost / sell proceeds from the trade ledger.
 *  realized_usd is the position's stored net P&L (sums partial exits). One row per closed lot. */
export function positionsCsv(state) {
  const byPos = new Map();
  for (const t of state?.trades || []) {
    if (!t.position_id) continue;
    const e = byPos.get(t.position_id) || { cost_usd: 0, proceeds_usd: 0 };
    if (t.side === 'buy') e.cost_usd += Number(t.value_usd) || 0;
    else if (t.side === 'sell') e.proceeds_usd += Number(t.value_usd) || 0;
    byPos.set(t.position_id, e);
  }
  const headers = ['position_id', 'simulated', 'leader_address', 'token_mint', 'copy_mode', 'entry_ts', 'closed_at', 'cost_usd', 'proceeds_usd', 'realized_usd'];
  const rows = (state?.positions || [])
    .filter((p) => p.position_state === 'CLOSED')
    .map((p) => {
      const t = byPos.get(p.position_id) || { cost_usd: 0, proceeds_usd: 0 };
      return {
        position_id: p.position_id, simulated: p.simulated, leader_address: p.leader_address,
        token_mint: p.token_mint, copy_mode: p.copy_mode, entry_ts: p.entry_ts, closed_at: p.closed_at,
        cost_usd: round2(t.cost_usd), proceeds_usd: round2(t.proceeds_usd),
        realized_usd: Number.isFinite(p.realized_usd) ? round2(p.realized_usd) : '',
      };
    });
  return toCsv(headers, rows);
}

/** Full trade ledger (every buy + sell). */
export function tradesCsv(state) {
  const headers = ['trade_id', 'ts', 'simulated', 'position_id', 'side', 'token_mint', 'qty_ui', 'price_usd', 'value_usd', 'reason'];
  const rows = (state?.trades || []).map((t) => ({
    trade_id: t.trade_id, ts: t.ts, simulated: t.simulated, position_id: t.position_id, side: t.side,
    token_mint: t.token_mint, qty_ui: t.qty_ui, price_usd: t.price_usd, value_usd: t.value_usd, reason: t.reason,
  }));
  return toCsv(headers, rows);
}

function round2(n) { return Math.round((Number(n) || 0) * 100) / 100; }
