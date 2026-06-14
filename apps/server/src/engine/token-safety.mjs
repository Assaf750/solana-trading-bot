// token-safety.mjs — pre-trade rug/honeypot screen. Reads the token mint account and flags the
// standard rug vectors before any copy entry:
//   - live MINT authority      -> creator can dilute supply
//   - live FREEZE authority    -> creator can freeze your tokens (soft honeypot)
//   - Token-2022 PermanentDelegate extension -> creator can seize tokens at will
// Fail-closed: an unreadable / non-mint / uncertain account is treated as UNSAFE.

/** Returns { safe: boolean, reasons: string[] }. cfg.safety toggles each check (default ON). */
export async function checkTokenSafety({ mint, rpc, cfg }) {
  const s = cfg?.safety || {};
  if (s.enabled === false) return { safe: true, reasons: [] };

  const res = await rpc.rpc('getAccountInfo', [mint, { encoding: 'jsonParsed', commitment: 'confirmed' }]);
  const parsed = res.ok ? res.result?.value?.data?.parsed : null;
  if (!res.ok || !parsed || parsed.type !== 'mint') {
    return { safe: false, reasons: ['safety_check_unavailable'] }; // fail-closed
  }

  const info = parsed.info || {};
  const reasons = [];
  if (s.require_mint_revoked !== false && info.mintAuthority) reasons.push('mint_authority_not_revoked');
  if (s.require_freeze_revoked !== false && info.freezeAuthority) reasons.push('freeze_authority_not_revoked');
  if (s.block_permanent_delegate !== false) {
    const pd = (info.extensions || []).find((e) => e.extension === 'permanentDelegate');
    if (pd && pd.state?.delegate) reasons.push('token2022_permanent_delegate');
  }
  return { safe: reasons.length === 0, reasons };
}
