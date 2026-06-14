import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { useI18n } from '../i18n/index.jsx';
import PageHead from '../components/PageHead.jsx';
import { Card, Badge, DangerNote, EmptyState, Sparkline } from '../components/index.jsx';
import { api } from '../api/client.js';
import { useBackend } from '../api/useBackend.jsx';

const short = (a) => `${a.slice(0, 4)}…${a.slice(-4)}`;

export default function NewCoinRadar() {
  const { lang } = useI18n();
  const ar = lang === 'ar';
  const { connected } = useBackend();
  const [mint, setMint] = useState('');
  const [state, setState] = useState(null); // {loading} | {data, mode} | {error}
  const [analysis, setAnalysis] = useState({}); // address -> {loading|data|error}
  const [followed, setFollowed] = useState({}); // address -> true | 'error'
  const [regMode, setRegMode] = useState('follow_entry_user_exit'); // copy mode applied on Follow
  const [sortBy, setSortBy] = useState('activity'); // activity | quality

  async function discover() {
    setState({ loading: true });
    const r = await api.discoverTokenTraders(mint.trim());
    setState(r.ok && r.data ? { data: r.data, mode: 'token' } : { error: r.data?.error || 'failed' });
  }
  async function autoDiscover() {
    setState({ loading: true });
    const r = await api.discoverFromLeaders();
    setState(r.ok && r.data ? { data: r.data, mode: 'leaders' } : { error: r.data?.error || 'failed' });
  }
  async function analyze(addr) {
    setAnalysis((a) => ({ ...a, [addr]: { loading: true } }));
    const r = await api.analyzeWallet(addr);
    // always store a string error so a failed analysis never looks like "not yet analyzed"
    setAnalysis((a) => ({ ...a, [addr]: r.ok && r.data ? { data: r.data.stats } : { error: r.data?.error || 'failed' } }));
  }
  async function analyzeAll() {
    for (const tr of (state?.data?.traders || [])) { await analyze(tr.address); } // sequential — respects RPC budget
  }
  async function follow(addr) {
    const r = await api.registerWallet({ tracked_wallet_address: addr, label: '', copy_mode: regMode });
    // backend returns the wallet on success AND on IDEMPOTENCY_CONFLICT, so we can always
    // recover the id and actually enable follow (a prior bug left it unfollowed silently).
    const wallet = r.data?.wallet;
    if (!wallet?.wallet_id) { setFollowed((f) => ({ ...f, [addr]: 'error' })); return; }
    const res = await api.setFollow(wallet.wallet_id, true);
    setFollowed((f) => ({ ...f, [addr]: res.ok ? true : 'error' }));
  }

  const leaderMode = state?.mode === 'leaders';
  const traders = state?.data?.traders || [];
  const tradersView = useMemo(() => {
    const list = (state?.data?.traders || []).slice();
    if (sortBy === 'quality') {
      const q = (addr) => {
        const s = analysis[addr]?.data;
        if (!s || s.win_rate == null) return -Infinity;
        // confidence-discounted win rate (trades<3 penalised), PnL as tiebreak
        return s.win_rate * Math.min(1, (s.trades_closed || 0) / 3) * 1000 + (s.realized_pnl_sol || 0);
      };
      list.sort((x, y) => q(y.address) - q(x.address));
    }
    return list;
  }, [state, analysis, sortBy]);
  const metric = (tr) => (tr.swaps_seen ?? tr.shared_tokens ?? 0);

  if (!connected) {
    return (
      <div className="stack">
        <PageHead title={ar ? 'اكتشاف المحافظ' : 'Wallet Discovery'} sub={ar ? 'اكتشاف' : 'Discovery'} />
        <EmptyState message={ar ? 'الخادم غير متصل — شغّل START.bat' : 'Server offline — run START.bat'} />
      </div>
    );
  }

  return (
    <div className="stack">
      <PageHead
        title={ar ? 'اكتشاف المحافظ' : 'Wallet Discovery'}
        sub={ar ? 'ابحث تلقائياً من قادتك أو الصق عقد عملة → اكتشف المحافظ → حلّلها ورتّبها → تابِع الأفضل' : 'Auto-search from your leaders or paste a coin contract → discover wallets → analyze & rank → follow the best'}
      />

      <DangerNote tone="info">
        {ar
          ? 'اكتشاف من السلسلة مباشرة (قراءة فقط) — ليس إشارة شراء. التنفيذ يبقى wallet-led: تحلّل المحفظة ثم تقرّر متابعتها.'
          : 'On-chain discovery (read-only) — not a buy signal. Execution stays wallet-led: you analyze a wallet, then decide to follow it.'}
      </DangerNote>

      <div className="filterbar">
        <input className="search grow" dir="ltr" placeholder={ar ? 'عقد العملة (mint)…' : 'coin contract (mint)…'} value={mint} onChange={(e) => setMint(e.target.value)} />
        <button className="btn primary" onClick={discover} disabled={!mint.trim() || state?.loading}>{ar ? '🔭 اكتشف بالعقد' : '🔭 Search by contract'}</button>
        <div className="sep" />
        <button className="btn" onClick={autoDiscover} disabled={state?.loading} title={ar ? 'يمسح الشبكة انطلاقاً من المحافظ التي تتابعها' : 'Scans the chain starting from the wallets you follow'}>{ar ? '🛰 بحث تلقائي من قادتي' : '🛰 Auto-search from my leaders'}</button>
      </div>

      {state?.loading && <Card title={ar ? 'جارٍ المسح…' : 'Scanning…'}><p className="muted">{ar ? 'أمسح معاملات السلسلة لاستخراج المحافظ النشطة (قد يستغرق لحظات).' : 'Scanning on-chain transactions to surface active wallets (may take a moment).'}</p></Card>}
      {state?.error && <Card title="—"><Badge tone="danger">{state.error === 'vault_locked' ? (ar ? 'افتح الخزنة أولاً' : 'Unlock vault first') : state.error === 'rpc_fetch_failed' ? (ar ? 'فشل جلب البيانات من RPC — تحقّق من المزوّد' : 'RPC fetch failed — check provider') : state.error}</Badge></Card>}

      {state?.data && (
        <Card
          title={leaderMode
            ? (ar ? `محافظ تتداول مثل قادتك (${traders.length})` : `Wallets that trade like your leaders (${traders.length})`)
            : (ar ? `محافظ تتداول هذا العقد (${traders.length})` : `Wallets trading this coin (${traders.length})`)}
          right={<span className="muted fs-xs">{leaderMode
            ? (ar ? `${state.data.scanned_leaders} قائد · ${state.data.mints_seen} عملة` : `${state.data.scanned_leaders} leaders · ${state.data.mints_seen} tokens`)
            : (ar ? `مُسِح ${state.data.scanned} معاملة` : `scanned ${state.data.scanned} txs`)}</span>}
        >
          {traders.length === 0 ? (
            <EmptyState message={leaderMode
              ? (state.data.mints_seen === 0
                ? (ar ? 'تابِع محفظة قائدة واحدة على الأقل أولاً ليبدأ البحث التلقائي' : 'Follow at least one leader wallet first to seed auto-search')
                : (ar ? 'لم تُرصد محافظ متطابقة بعد' : 'No matching wallets surfaced yet'))
              : (ar ? 'لم تُرصد محافظ — جرّب عقداً أكثر نشاطاً' : 'No wallets found — try a more active coin')} />
          ) : (
            <>
              <div className="row" style={{ justifyContent: 'space-between', marginBlockEnd: 'var(--s-2)', flexWrap: 'wrap', gap: 8 }}>
                <div className="row" style={{ gap: 6, alignItems: 'center' }}>
                  <span className="muted fs-xs">{ar ? 'نمط النسخ' : 'copy mode'}</span>
                  <div className="seg">
                    <button className={regMode === 'follow_entry_user_exit' ? 'on' : ''} onClick={() => setRegMode('follow_entry_user_exit')}>follow_entry</button>
                    <button className={regMode === 'full_mirror' ? 'on' : ''} onClick={() => setRegMode('full_mirror')}>full_mirror</button>
                  </div>
                </div>
                <div className="row" style={{ gap: 6, alignItems: 'center' }}>
                  <span className="muted fs-xs">{ar ? 'فرز' : 'sort'}</span>
                  <div className="seg">
                    <button className={sortBy === 'activity' ? 'on' : ''} onClick={() => setSortBy('activity')}>{ar ? 'النشاط' : 'activity'}</button>
                    <button className={sortBy === 'quality' ? 'on' : ''} onClick={() => setSortBy('quality')}>{ar ? 'الجودة' : 'quality'}</button>
                  </div>
                  <button className="btn" onClick={analyzeAll}>{ar ? '🔍 حلّل الكل' : '🔍 Analyze all'}</button>
                </div>
              </div>
              <div className="wlist">
                <div className="wlist-head" style={{ gridTemplateColumns: '1.4fr 0.7fr 1fr auto' }}>
                  <span>{ar ? 'المحفظة' : 'wallet'}</span>
                  <span className="num">{leaderMode ? (ar ? 'مشترك' : 'shared') : (ar ? 'صفقات' : 'swaps')}</span>
                  <span>{ar ? 'تحليل' : 'analysis'}</span><span></span>
                </div>
                {tradersView.map((tr) => {
                  const a = analysis[tr.address];
                  const s = a?.data;
                  return (
                    <div key={tr.address} className="wrow" style={{ gridTemplateColumns: '1.4fr 0.7fr 1fr auto', cursor: 'default' }}>
                      <span className="mono" dir="ltr">{short(tr.address)}</span>
                      <span className="num mono">{metric(tr)}</span>
                      <span>
                        {!a ? <span className="faint">—</span>
                          : a.loading ? <span className="muted">{ar ? 'جارٍ…' : '…'}</span>
                          : a.error ? <Badge tone="danger">{a.error === 'vault_locked' ? 'vault' : 'err'}</Badge>
                          : s?.status === 'insufficient_evidence' ? <span className="faint">{ar ? 'لا دليل' : 'no data'}</span>
                          : !s ? <span className="faint">—</span>
                          : <span className="mono fs-xs" style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
                              <Sparkline seed={tr.address} tone={s.win_rate != null ? (s.win_rate >= 0.5 ? 'pos' : 'neg') : 'muted'} bias={s.win_rate != null ? (s.win_rate >= 0.5 ? 1 : -1) : 0} width={46} height={16} />
                              <span style={{ color: s.win_rate == null ? 'var(--c-text-faint)' : s.win_rate >= 0.5 ? 'var(--c-ok)' : 'var(--c-danger)' }}>{s.win_rate != null ? `${(s.win_rate * 100).toFixed(0)}%` : '—'}</span>
                              {' · '}<span style={{ color: (s.realized_pnl_sol || 0) >= 0 ? 'var(--c-ok)' : 'var(--c-danger)' }}>{s.realized_pnl_sol > 0 ? '+' : ''}{s.realized_pnl_sol}◎</span>
                              {' · '}{s.trades_closed}t
                            </span>}
                      </span>
                      <span className="row" style={{ gap: 4, justifyContent: 'flex-end', alignItems: 'center' }}>
                        {followed[tr.address] === 'error' && <span className="neg fs-xs">{ar ? 'فشل' : 'err'}</span>}
                        <button className="btn" onClick={() => analyze(tr.address)}>🔍</button>
                        <button className={`btn ${followed[tr.address] === true ? '' : 'primary'}`} onClick={() => follow(tr.address)} disabled={followed[tr.address] === true}>
                          {followed[tr.address] === true ? (ar ? 'متابَعة ✓' : 'following ✓') : (ar ? 'تابِع' : 'Follow')}
                        </button>
                      </span>
                    </div>
                  );
                })}
              </div>
            </>
          )}
          <p className="faint" style={{ fontSize: 'var(--fs-xs)', marginBlockStart: 'var(--s-3)' }}>
            {ar ? 'حلّل الكل ورتّب بالجودة لاختيار الأفضل، ثم تابِع — تظهر في كونسول المحافظ.' : 'Analyze all and sort by quality to pick the best, then follow — it appears in the Wallet Workspace.'}
            {' '}<Link to="/wallets">{ar ? 'كونسول المحافظ ←' : 'Wallet Workspace →'}</Link>
          </p>
        </Card>
      )}
    </div>
  );
}
