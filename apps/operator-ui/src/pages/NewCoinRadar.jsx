import { useEffect, useMemo, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { useI18n } from '../i18n/index.jsx';
import PageHead from '../components/PageHead.jsx';
import { Card, Badge, DangerNote, EmptyState, Sparkline } from '../components/index.jsx';
import { api } from '../api/client.js';
import { useBackend } from '../api/useBackend.jsx';
import { shortMint as short } from '../format.js';

// quality verdict from an on-chain analysis — the differentiator: a real tier, not just raw counts
function tier(s, ar) {
  if (!s || s.status === 'insufficient_evidence' || s.win_rate == null) return null;
  const wr = s.win_rate; const n = s.trades_closed || 0; const pnl = s.realized_pnl_sol || 0;
  if (n < 3) return { k: ar ? 'غير مُثبت' : 'unproven', tone: 'neutral', rank: 0 };
  if (wr >= 0.6 && pnl > 0) return { k: ar ? 'قوي' : 'strong', tone: 'ok', rank: 3 };
  if (wr >= 0.45 && pnl >= 0) return { k: ar ? 'مقبول' : 'decent', tone: 'warn', rank: 2 };
  return { k: ar ? 'ضعيف' : 'weak', tone: 'danger', rank: 1 };
}
const MEDAL = ['🥇', '🥈', '🥉'];

export default function NewCoinRadar() {
  const { lang } = useI18n();
  const ar = lang === 'ar';
  const { connected } = useBackend();
  const [mint, setMint] = useState('');
  const [state, setState] = useState(null); // {loading} | {data, mode} | {error}
  const [analysis, setAnalysis] = useState({});
  const [followed, setFollowed] = useState({});
  const [regMode, setRegMode] = useState('follow_entry_user_exit');
  const [sortBy, setSortBy] = useState('activity');
  const scanId = useRef(0);

  useEffect(() => {
    if (!connected) return;
    api.wallets().then((r) => {
      if (!r.ok) return;
      const m = {};
      for (const w of (r.data.wallets || [])) if (w.follow_enabled) m[w.tracked_wallet_address] = true;
      setFollowed(m);
    });
  }, [connected]);

  async function discover() {
    setState({ loading: true }); setAnalysis({}); scanId.current += 1;
    const r = await api.discoverTokenTraders(mint.trim());
    setState(r.ok && r.data ? { data: r.data, mode: 'token' } : { error: r.data?.error || 'failed' });
  }
  async function autoDiscover() {
    setState({ loading: true }); setAnalysis({}); scanId.current += 1;
    const r = await api.discoverFromLeaders();
    setState(r.ok && r.data ? { data: r.data, mode: 'leaders' } : { error: r.data?.error || 'failed' });
  }
  async function analyze(addr) {
    setAnalysis((a) => ({ ...a, [addr]: { loading: true } }));
    const r = await api.analyzeWallet(addr);
    setAnalysis((a) => ({ ...a, [addr]: r.ok && r.data ? { data: r.data.stats } : { error: r.data?.error || 'failed' } }));
  }
  async function analyzeAll() {
    const my = scanId.current;
    for (const tr of (state?.data?.traders || [])) {
      if (scanId.current !== my) break;
      await analyze(tr.address);
    }
  }
  async function follow(addr) {
    const r = await api.registerWallet({ tracked_wallet_address: addr, label: '', copy_mode: regMode });
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
        return s.win_rate * Math.min(1, (s.trades_closed || 0) / 3) * 1000 + (s.realized_pnl_sol || 0);
      };
      list.sort((x, y) => q(y.address) - q(x.address));
    }
    return list;
  }, [state, analysis, sortBy]);
  const metric = (tr) => (tr.swaps_seen ?? tr.shared_tokens ?? 0);
  const analyzedCount = traders.filter((t) => analysis[t.address]?.data).length;
  const followedCount = traders.filter((t) => followed[t.address] === true).length;
  const anyAnalyzed = analyzedCount > 0;

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
        title={ar ? 'رادار المحافظ الذكية' : 'Smart-Money Radar'}
        sub={ar ? 'اكتشف → حلّل → رتّب بالجودة → تابِع الأفضل. مصدر الإشارة: السلسلة مباشرة.' : 'Discover → analyze → rank by quality → follow the best. Signal source: the chain itself.'}
      />

      {/* discovery launcher — two clear entry points (benchmark: a real discovery funnel) */}
      <div className="grid cols-2">
        <Card title={ar ? '① ابحث بعقد العملة' : '① Search by contract'}
          sub={ar ? 'الصق عقد عملة لرؤية كل المحافظ التي تداولتها — لإيجاد القادة من رمز رابح.' : 'Paste a coin mint to surface every wallet that traded it — find leaders from a winning token.'}>
          <div className="row">
            <input className="search grow" dir="ltr" placeholder={ar ? 'عقد العملة (mint)…' : 'coin contract (mint)…'} value={mint} onChange={(e) => setMint(e.target.value)} onKeyDown={(e) => { if (e.key === 'Enter' && mint.trim()) discover(); }} />
            <button className="btn primary" onClick={discover} disabled={!mint.trim() || state?.loading}>{ar ? '🔭 اكتشف' : '🔭 Scan'}</button>
          </div>
        </Card>
        <Card title={ar ? '② بحث تلقائي من قادتك' : '② Auto-discover from leaders'}
          sub={ar ? 'يمسح الشبكة انطلاقاً من المحافظ التي تتابعها ويجد من يتداول مثلها — لا عقد مطلوب.' : 'Scans the chain from the wallets you already follow and finds who trades like them — no contract needed.'}>
          <button className="btn primary" onClick={autoDiscover} disabled={state?.loading}>{ar ? '🛰 اكتشف تلقائياً' : '🛰 Auto-discover'}</button>
        </Card>
      </div>

      <DangerNote tone="info">
        {ar
          ? 'اكتشاف من السلسلة (قراءة فقط) — ليس إشارة شراء. التنفيذ يبقى wallet-led: تحلّل المحفظة ثم تقرّر متابعتها.'
          : 'On-chain discovery (read-only) — not a buy signal. Execution stays wallet-led: analyze a wallet, then decide to follow.'}
      </DangerNote>

      {state?.loading && (
        <Card title={ar ? 'جارٍ المسح…' : 'Scanning the chain…'}>
          <div className="stack" style={{ gap: 8 }}>
            {[0, 1, 2, 3].map((i) => <div key={i} className="skeleton" style={{ height: 34 }} />)}
          </div>
        </Card>
      )}
      {state?.error && (
        <Card title="—">
          <Badge tone="danger">{state.error === 'vault_locked' ? (ar ? 'افتح الخزنة أولاً' : 'Unlock vault first') : state.error === 'rpc_fetch_failed' ? (ar ? 'فشل جلب البيانات من RPC — تحقّق من المزوّد' : 'RPC fetch failed — check provider') : state.error}</Badge>
        </Card>
      )}

      {state?.data && (
        <Card
          title={leaderMode
            ? (ar ? 'محافظ تتداول مثل قادتك' : 'Wallets that trade like your leaders')
            : (ar ? 'محافظ تتداول هذا العقد' : 'Wallets trading this coin')}
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
              <div className="kpi-strip" style={{ marginBlockEnd: 'var(--s-3)' }}>
                <div className="stattile"><span className="lbl">{ar ? 'محافظ' : 'wallets'}</span><span className="val">{traders.length}</span></div>
                <div className="stattile"><span className="lbl">{ar ? 'محلَّلة' : 'analyzed'}</span><span className="val">{analyzedCount}</span><span className="sub">{traders.length - analyzedCount} {ar ? 'متبقّ' : 'left'}</span></div>
                <div className="stattile"><span className="lbl">{ar ? 'متابَعة' : 'following'}</span><span className="val brand">{followedCount}</span></div>
              </div>

              <div className="filterbar" style={{ marginBlockEnd: 'var(--s-3)' }}>
                <span className="muted fs-xs">{ar ? 'نمط النسخ عند المتابعة' : 'copy mode on follow'}</span>
                <div className="seg">
                  <button className={regMode === 'follow_entry_user_exit' ? 'on' : ''} onClick={() => setRegMode('follow_entry_user_exit')}>follow_entry</button>
                  <button className={regMode === 'full_mirror' ? 'on' : ''} onClick={() => setRegMode('full_mirror')}>full_mirror</button>
                </div>
                <span className="sep" />
                <span className="muted fs-xs">{ar ? 'فرز' : 'sort'}</span>
                <div className="seg">
                  <button className={sortBy === 'activity' ? 'on' : ''} onClick={() => setSortBy('activity')}>{ar ? 'النشاط' : 'activity'}</button>
                  <button className={sortBy === 'quality' ? 'on' : ''} onClick={() => setSortBy('quality')}>{ar ? 'الجودة' : 'quality'}</button>
                </div>
                <button className="btn" onClick={analyzeAll} disabled={state?.loading}>{ar ? '🔍 حلّل الكل' : '🔍 Analyze all'}</button>
                {sortBy === 'quality' && !anyAnalyzed && <span className="faint fs-xs">{ar ? 'حلّل أولاً للترتيب بالجودة' : 'analyze first to rank by quality'}</span>}
              </div>

              <div className="table-wrap">
                <table className="data">
                  <thead><tr>
                    <th className="nosort">#</th>
                    <th className="nosort">{ar ? 'المحفظة' : 'wallet'}</th>
                    <th className="nosort num">{leaderMode ? (ar ? 'مشترك' : 'shared') : (ar ? 'صفقات' : 'swaps')}</th>
                    <th className="nosort">{ar ? 'التقييم' : 'verdict'}</th>
                    <th className="nosort num">win%</th>
                    <th className="nosort num">PnL ◎</th>
                    <th className="nosort num">{ar ? 'صفقات' : 'trades'}</th>
                    <th className="nosort">{ar ? 'الاتجاه' : 'trend'}</th>
                    <th className="nosort"></th>
                  </tr></thead>
                  <tbody>
                    {tradersView.map((tr, i) => {
                      const a = analysis[tr.address];
                      const s = a?.data;
                      const tv = tier(s, ar);
                      const showMedal = sortBy === 'quality' && s && i < 3;
                      return (
                        <tr key={tr.address}>
                          <td className="mono faint">{showMedal ? MEDAL[i] : i + 1}</td>
                          <td className="mono" dir="ltr">{short(tr.address)}</td>
                          <td className="num mono">{metric(tr)}</td>
                          <td>
                            {!a ? <span className="faint">—</span>
                              : a.loading ? <span className="muted">{ar ? 'جارٍ…' : '…'}</span>
                              : a.error ? <Badge tone="danger">{a.error === 'vault_locked' ? 'vault' : 'err'}</Badge>
                              : s?.status === 'insufficient_evidence' ? <span className="faint fs-xs">{ar ? 'لا دليل' : 'no data'}</span>
                              : tv ? <Badge tone={tv.tone}>{tv.k}</Badge>
                              : <span className="faint">—</span>}
                          </td>
                          <td className="num mono" style={{ color: s?.win_rate == null ? 'var(--c-text-faint)' : s.win_rate >= 0.5 ? 'var(--c-ok)' : 'var(--c-danger)' }}>{s?.win_rate != null ? `${(s.win_rate * 100).toFixed(0)}%` : '—'}</td>
                          <td className="num mono" style={{ color: s ? ((s.realized_pnl_sol || 0) >= 0 ? 'var(--c-ok)' : 'var(--c-danger)') : 'var(--c-text-faint)' }}>{s ? `${s.realized_pnl_sol > 0 ? '+' : ''}${s.realized_pnl_sol}` : '—'}</td>
                          <td className="num mono faint">{s ? s.trades_closed : '—'}</td>
                          <td>{s && s.win_rate != null
                            ? <Sparkline seed={tr.address} tone={s.win_rate >= 0.5 ? 'pos' : 'neg'} bias={s.win_rate >= 0.5 ? 1 : -1} width={52} height={16} />
                            : <span className="faint">—</span>}</td>
                          <td>
                            <span className="row" style={{ gap: 4, justifyContent: 'flex-end', flexWrap: 'nowrap' }}>
                              {followed[tr.address] === 'error' && <span className="neg fs-xs">{ar ? 'فشل' : 'err'}</span>}
                              <button className="btn sm" onClick={() => analyze(tr.address)} title={ar ? 'تحليل' : 'analyze'}>🔍</button>
                              <button className={`btn sm ${followed[tr.address] === true ? '' : 'primary'}`} onClick={() => follow(tr.address)} disabled={followed[tr.address] === true}>
                                {followed[tr.address] === true ? (ar ? '✓' : '✓') : (ar ? 'تابِع' : 'Follow')}
                              </button>
                            </span>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>

              <p className="faint" style={{ fontSize: 'var(--fs-xs)', marginBlockStart: 'var(--s-3)' }}>
                {ar ? 'حلّل الكل ورتّب بالجودة لاختيار الأفضل، ثم تابِع — تظهر في كونسول المحافظ.' : 'Analyze all and sort by quality to pick the best, then follow — they appear in the Wallet Workspace.'}
                {' '}<Link to="/wallets">{ar ? 'كونسول المحافظ ←' : 'Wallet Workspace →'}</Link>
              </p>
            </>
          )}
        </Card>
      )}
    </div>
  );
}
