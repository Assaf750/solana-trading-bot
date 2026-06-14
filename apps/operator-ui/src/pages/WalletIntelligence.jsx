import { useEffect, useMemo, useState } from 'react';
import { useI18n } from '../i18n/index.jsx';
import PageHead from '../components/PageHead.jsx';
import { Card, Badge, DangerNote, EmptyState, Sparkline } from '../components/index.jsx';
import { api } from '../api/client.js';
import { useBackend } from '../api/useBackend.jsx';

const short = (a) => `${a.slice(0, 4)}…${a.slice(-4)}`;

export default function WalletIntelligence() {
  const { t, lang } = useI18n();
  const ar = lang === 'ar';
  const { status, connected } = useBackend();

  const [wallets, setWallets] = useState([]);
  const [analysis, setAnalysis] = useState({}); // wallet_id -> {loading|data|error}
  const [selectedId, setSelectedId] = useState(null);
  const [search, setSearch] = useState('');
  const [filter, setFilter] = useState('all'); // all | followed | off | analyzed
  const [sortKey, setSortKey] = useState('recent'); // recent | win | pnl | trades
  const [msg, setMsg] = useState(null);

  // register form
  const [addr, setAddr] = useState('');
  const [label, setLabel] = useState('');
  const [regMode, setRegMode] = useState('follow_entry_user_exit');
  const [showAdd, setShowAdd] = useState(false);

  async function load() {
    const r = await api.wallets();
    if (r.ok) {
      setWallets(r.data.wallets || []);
      if (!selectedId && r.data.wallets?.length) setSelectedId(r.data.wallets[0].wallet_id);
    }
  }
  useEffect(() => { if (connected) load(); }, [connected]);

  function note(tone, a, e) { setMsg({ tone, text: ar ? a : e }); }
  const statsOf = (w) => analysis[w.wallet_id]?.data?.stats;

  async function register() {
    setMsg(null);
    const r = await api.registerWallet({ tracked_wallet_address: addr.trim(), label: label.trim(), copy_mode: regMode });
    if (r.ok) { setAddr(''); setLabel(''); setShowAdd(false); setSelectedId(r.data.wallet.wallet_id); note('ok', 'سُجّلت المحفظة ✓', 'Registered ✓'); }
    else note('danger', r.data?.error || r.data?.api_error_code || 'rejected', r.data?.error || r.data?.api_error_code || 'rejected');
    load();
  }
  async function toggleFollow(w) { await api.setFollow(w.wallet_id, !w.follow_enabled); load(); }
  async function setCopyMode(w, mode) { await api.updateWalletConfig(w.wallet_id, { copy_mode: mode }); load(); }
  async function remove(w) { await api.removeWallet(w.wallet_id); if (selectedId === w.wallet_id) setSelectedId(null); load(); }

  async function analyze(w) {
    setAnalysis((a) => ({ ...a, [w.wallet_id]: { loading: true } }));
    const r = await api.analyzeWallet(w.tracked_wallet_address);
    setAnalysis((a) => ({ ...a, [w.wallet_id]: r.ok ? { data: r.data } : { error: r.data?.error || 'failed' } }));
  }
  async function analyzeAll() {
    // analyze the currently SHOWN wallets (honors search/filter) so candidates can be
    // ranked BEFORE following — not only already-followed ones.
    for (const w of view) { await analyze(w); } // sequential — respects RPC budget
  }

  const view = useMemo(() => {
    let list = wallets.slice();
    if (search.trim()) {
      const q = search.trim().toLowerCase();
      list = list.filter((w) => w.tracked_wallet_address.toLowerCase().includes(q) || (w.label || '').toLowerCase().includes(q));
    }
    if (filter === 'followed') list = list.filter((w) => w.follow_enabled);
    else if (filter === 'off') list = list.filter((w) => !w.follow_enabled);
    else if (filter === 'analyzed') list = list.filter((w) => statsOf(w));
    const num = (w, k) => {
      const s = statsOf(w);
      if (!s) return -Infinity;
      if (k === 'pnl') return s.realized_pnl_sol ?? -Infinity;
      if (k === 'trades') return s.trades_closed ?? -Infinity;
      // win: discount low-sample win rates (trades<3) so a lucky 1-trade 100% doesn't outrank a solid record
      if (s.win_rate == null) return -Infinity;
      return s.win_rate * Math.min(1, (s.trades_closed || 0) / 3);
    };
    if (sortKey !== 'recent') list.sort((a, b) => num(b, sortKey) - num(a, sortKey));
    return list;
  }, [wallets, search, filter, sortKey, analysis]);

  const selected = wallets.find((w) => w.wallet_id === selectedId) || null;
  const followedCount = wallets.filter((w) => w.follow_enabled).length;
  const analyzedStats = wallets.map(statsOf).filter(Boolean);
  // average only over wallets that actually have a win rate (exclude null/no-closed-trades)
  const ranked = analyzedStats.filter((s) => s.win_rate != null);
  const avgWin = ranked.length ? ranked.reduce((a, s) => a + s.win_rate, 0) / ranked.length : null;

  if (!connected) {
    return (
      <div className="stack">
        <PageHead title={t('wallets.title')} sub={t('wallets.sub')} />
        <EmptyState message={ar ? 'الخادم غير متصل — شغّل START.bat' : 'Server offline — run START.bat'} />
      </div>
    );
  }

  return (
    <div className="stack">
      <PageHead title={ar ? 'كونسول المحافظ' : 'Wallet Workspace'} sub={ar ? 'ابحث · صفِّ · افحص · انسخ · راقب — كل ذلك من شاشة واحدة' : 'Search · filter · analyze · copy · monitor — all from one console'} />

      <div className="kpi-strip">
        <div className="stattile"><span className="lbl">{ar ? 'محافظ' : 'Wallets'}</span><span className="val">{wallets.length}</span></div>
        <div className="stattile"><span className="lbl">{ar ? 'متابَعة' : 'Following'}</span><span className="val brand">{followedCount}</span></div>
        <div className="stattile"><span className="lbl">{ar ? 'متوسط win rate' : 'Avg win rate'}</span><span className={`val ${avgWin >= 0.5 ? 'pos' : avgWin != null ? 'neg' : ''}`}>{avgWin != null ? `${(avgWin * 100).toFixed(1)}%` : '—'}</span><span className="sub">{ar ? `${analyzedStats.length} محلَّلة` : `${analyzedStats.length} analyzed`}</span></div>
        <div className="stattile"><span className="lbl">{ar ? 'المحرّك' : 'Engine'}</span><span className="val" style={{ fontSize: 'var(--fs-md)' }}>{status?.engine?.paper_engine || '—'}</span></div>
      </div>

      <div className="filterbar">
        <input className="search grow" placeholder={ar ? 'بحث بالعنوان أو الاسم…' : 'Search address or label…'} value={search} onChange={(e) => setSearch(e.target.value)} dir="ltr" />
        <div className="sep" />
        <div className="seg">
          {['all', 'followed', 'off', 'analyzed'].map((f) => (
            <button key={f} className={filter === f ? 'on' : ''} onClick={() => setFilter(f)}>
              {ar ? { all: 'الكل', followed: 'متابَعة', off: 'متوقفة', analyzed: 'محلَّلة' }[f] : f}
            </button>
          ))}
        </div>
        <div className="sep" />
        <label>{ar ? 'فرز' : 'Sort'}</label>
        <div className="seg">
          {['recent', 'win', 'pnl', 'trades'].map((s) => (
            <button key={s} className={sortKey === s ? 'on' : ''} onClick={() => setSortKey(s)}>
              {ar ? { recent: 'الأحدث', win: 'الربح%', pnl: 'PnL', trades: 'صفقات' }[s] : s}
            </button>
          ))}
        </div>
        <div className="sep" />
        <button className="btn" onClick={analyzeAll} disabled={!view.length}>{ar ? '🔍 تحليل المعروضة' : '🔍 Analyze shown'}</button>
        <button className="btn primary" onClick={() => setShowAdd((v) => !v)}>{ar ? '＋ محفظة' : '＋ Wallet'}</button>
      </div>

      {showAdd && (
        <Card title={ar ? 'تسجيل محفظة متبوعة' : 'Register tracked wallet'}>
          <div className="row" style={{ flexWrap: 'wrap' }}>
            <input className="search" dir="ltr" style={{ flex: '2 1 320px' }} placeholder={ar ? 'عنوان (base58)' : 'address (base58)'} value={addr} onChange={(e) => setAddr(e.target.value)} />
            <input className="search" style={{ flex: '1 1 140px' }} placeholder={ar ? 'اسم (اختياري)' : 'label (optional)'} value={label} onChange={(e) => setLabel(e.target.value)} />
            <div className="seg">
              <button className={regMode === 'follow_entry_user_exit' ? 'on' : ''} onClick={() => setRegMode('follow_entry_user_exit')}>follow_entry</button>
              <button className={regMode === 'full_mirror' ? 'on' : ''} onClick={() => setRegMode('full_mirror')}>full_mirror</button>
            </div>
            <button className="btn primary" onClick={register} disabled={!addr.trim()}>{ar ? 'تسجيل' : 'Register'}</button>
          </div>
          {msg && <div style={{ marginBlockStart: 8 }}><Badge tone={msg.tone}>{msg.text}</Badge></div>}
        </Card>
      )}

      {wallets.length === 0 ? (
        <EmptyState message={ar ? 'لا محافظ بعد — أضف أول محفظة بزر «＋ محفظة»' : 'No wallets yet — add your first with “＋ Wallet”'} />
      ) : (
        <div className="workspace">
          <div className="wlist has-trend">
            <div className="wlist-head">
              <span>{ar ? 'المحفظة' : 'Wallet'}</span><span className="trend-col">{ar ? 'الاتجاه' : 'trend'}</span><span>mode</span>
              <span className="num">win%</span><span className="num">PnL</span><span className="num">{ar ? 'صفقات' : 'trades'}</span><span>{ar ? 'متابعة' : 'follow'}</span>
            </div>
            {view.map((w) => {
              const s = statsOf(w);
              return (
                <div key={w.wallet_id} className={`wrow ${selectedId === w.wallet_id ? 'sel' : ''}`}
                  role="button" tabIndex={0} aria-pressed={selectedId === w.wallet_id}
                  aria-label={`${ar ? 'اختر محفظة' : 'select wallet'} ${w.label || short(w.tracked_wallet_address)}`}
                  onClick={() => setSelectedId(w.wallet_id)}
                  onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); setSelectedId(w.wallet_id); } }}>
                  <span className="wname"><span className="lab">{w.label || short(w.tracked_wallet_address)}</span><span className="addr" dir="ltr">{short(w.tracked_wallet_address)}</span></span>
                  <span className="trend-cell">
                    <Sparkline seed={w.tracked_wallet_address} tone={s && s.win_rate != null ? (s.win_rate >= 0.5 ? 'pos' : 'neg') : 'muted'} bias={s && s.win_rate != null ? (s.win_rate >= 0.5 ? 1 : -1) : 0} width={60} height={20} />
                  </span>
                  <span><Badge tone={w.copy_mode === 'full_mirror' ? 'warn' : 'info'}>{w.copy_mode === 'full_mirror' ? 'mirror' : 'follow'}</Badge></span>
                  <span className="num" style={{ color: s && s.win_rate != null ? (s.win_rate >= 0.5 ? 'var(--c-ok)' : 'var(--c-danger)') : 'var(--c-text-faint)' }}>{s ? (s.win_rate != null ? `${(s.win_rate * 100).toFixed(0)}%` : '—') : '·'}</span>
                  <span className="num" style={{ color: s ? ((s.realized_pnl_sol || 0) >= 0 ? 'var(--c-ok)' : 'var(--c-danger)') : 'var(--c-text-faint)' }}>{s ? `${s.realized_pnl_sol > 0 ? '+' : ''}${s.realized_pnl_sol}◎` : '·'}</span>
                  <span className="num faint">{s ? s.trades_closed : '·'}</span>
                  <span><button className={`btn toggle ${w.follow_enabled ? 'on' : ''}`} onClick={(e) => { e.stopPropagation(); toggleFollow(w); }}>{w.follow_enabled ? '✓' : 'off'}</button></span>
                </div>
              );
            })}
            {view.length === 0 && <div style={{ padding: 16 }} className="muted">{ar ? 'لا نتائج للفلتر الحالي' : 'No matches for current filter'}</div>}
          </div>

          <div className="detail-pane stack" style={{ gap: 'var(--s-3)' }}>
            {!selected ? <EmptyState message={ar ? 'اختر محفظة لعرض التفاصيل' : 'Select a wallet to see details'} /> : (
              <>
                <Card title={<span className="mono" dir="ltr">{selected.label || short(selected.tracked_wallet_address)}</span>}
                  right={<Badge tone={selected.follow_enabled ? 'ok' : 'neutral'}>{selected.follow_enabled ? (ar ? 'متابَعة' : 'following') : (ar ? 'متوقفة' : 'off')}</Badge>}>
                  <div className="kv" style={{ marginBlockEnd: 'var(--s-3)' }}>
                    <dt>{ar ? 'العنوان' : 'address'}</dt><dd className="mono" dir="ltr" style={{ fontSize: 'var(--fs-xs)', wordBreak: 'break-all' }}>{selected.tracked_wallet_address}</dd>
                  </div>
                  <div className="row" style={{ marginBlockEnd: 'var(--s-2)' }}>
                    <span className="muted fs-xs">{ar ? 'نمط النسخ' : 'copy mode'}</span>
                    <div className="seg">
                      <button className={selected.copy_mode === 'follow_entry_user_exit' ? 'on' : ''} onClick={() => setCopyMode(selected, 'follow_entry_user_exit')}>follow_entry</button>
                      <button className={selected.copy_mode === 'full_mirror' ? 'on' : ''} onClick={() => setCopyMode(selected, 'full_mirror')}>full_mirror</button>
                    </div>
                  </div>
                  <div className="row">
                    <button className={`btn ${selected.follow_enabled ? '' : 'primary'}`} onClick={() => toggleFollow(selected)}>{selected.follow_enabled ? (ar ? 'إيقاف المتابعة' : 'Unfollow') : (ar ? 'متابعة (نسخ)' : 'Follow (copy)')}</button>
                    <button className="btn" onClick={() => analyze(selected)}>{ar ? '🔍 تحليل' : '🔍 Analyze'}</button>
                    <button className="btn danger" onClick={() => remove(selected)}>{ar ? 'حذف' : 'Remove'}</button>
                  </div>
                  {selected.copy_mode === 'full_mirror' && (
                    <DangerNote tone="warn" locked>{ar ? 'full_mirror متقدم: ينسخ البيع والشراء نسبياً.' : 'full_mirror is advanced: mirrors buys and sells.'}</DangerNote>
                  )}
                </Card>

                <Card title={ar ? 'التحليل التاريخي (on-chain)' : 'Historical analysis (on-chain)'}>
                  {(() => {
                    const a = analysis[selected.wallet_id];
                    if (!a) return <p className="muted">{ar ? 'اضغط «تحليل» لمسح تاريخ المحفظة من السلسلة.' : 'Press “Analyze” to scan the wallet’s on-chain history.'}</p>;
                    if (a.loading) return <p className="muted">{ar ? 'جارٍ المسح…' : 'Scanning…'}</p>;
                    if (a.error) return <Badge tone="danger">{a.error === 'vault_locked' ? (ar ? 'افتح الخزنة أولاً' : 'Unlock vault first') : a.error}</Badge>;
                    return <WalletAnalysis ar={ar} res={a.data} />;
                  })()}
                </Card>
              </>
            )}
          </div>
        </div>
      )}

      <DangerNote tone="info">
        {ar
          ? 'الأرقام تُحسب من تاريخ السلسلة الحقيقي عند الطلب — لا تُختلق. اكتشاف محافظ جديدة من leaderboard عام مرحلة لاحقة (يحتاج مصدر بيانات).'
          : 'Numbers are computed from real on-chain history on demand — never fabricated. Discovering new wallets from a public leaderboard is a later phase (needs a data source).'}
      </DangerNote>
    </div>
  );
}

function Stat({ label, value, tone }) {
  return (
    <div className="stattile">
      <span className="lbl">{label}</span>
      <span className={`val ${tone || ''}`} style={{ fontSize: 'var(--fs-lg)' }}>{value}</span>
    </div>
  );
}

function WalletAnalysis({ ar, res }) {
  const s = res.stats || {};
  if (s.status === 'insufficient_evidence') {
    return <EmptyState message={ar ? `لا صفقات قابلة للتحليل في آخر ${res.signatures_scanned || 0} معاملة.` : `No analyzable trades in the last ${res.signatures_scanned || 0} txs.`} />;
  }
  const wr = s.win_rate != null ? `${(s.win_rate * 100).toFixed(1)}%` : (ar ? 'غير متوفر' : 'unavailable');
  const pnlUsd = s.realized_pnl_usd != null ? `$${s.realized_pnl_usd}` : `${s.realized_pnl_sol}◎`;
  const hold = s.avg_hold_seconds != null ? `${Math.round(s.avg_hold_seconds / 60)} min` : '—';
  const bot = s.bot_signals || {};
  const rapidTone = bot.rapid_flip_ratio > 0.4 ? 'danger' : bot.rapid_flip_ratio > 0.15 ? 'warn' : 'ok';
  return (
    <div className="stack" style={{ gap: 'var(--s-3)' }}>
      {s.status === 'low_confidence' && <Badge tone="warn">{ar ? `ثقة منخفضة (${s.trades_closed} صفقة)` : `low confidence (${s.trades_closed})`}</Badge>}
      <div className="kpi-strip" style={{ margin: 0 }}>
        <Stat label={ar ? 'الربح' : 'Win rate'} value={wr} tone={s.win_rate >= 0.5 ? 'pos' : 'neg'} />
        <Stat label={ar ? 'محقّق' : 'Realized'} value={pnlUsd} tone={(s.realized_pnl_sol || 0) >= 0 ? 'pos' : 'neg'} />
        <Stat label={ar ? 'صفقات' : 'Closed'} value={s.trades_closed} />
        <Stat label={ar ? 'احتفاظ' : 'Avg hold'} value={hold} />
      </div>
      <div>
        <div className="muted" style={{ fontSize: 'var(--fs-sm)', marginBlockEnd: 4 }}>{ar ? 'توزيع نتائج الصفقات' : 'Outcome distribution'}</div>
        <table className="data"><tbody>
          {s.outcome_distribution.map((b) => (<tr key={b.key}><td className="mono">{b.label}</td><td className="num mono">{b.count}</td></tr>))}
        </tbody></table>
      </div>
      <div>
        <div className="muted" style={{ fontSize: 'var(--fs-sm)', marginBlockEnd: 4 }}>{ar ? 'إشارات البوت/الغش' : 'Bot / wash signals'}</div>
        <dl className="kv">
          <dt>{ar ? 'بيع/شراء خلال 5ث' : 'buy/sell within 5s'}</dt><dd><Badge tone={rapidTone}>{bot.rapid_buy_sell_within_5s} ({((bot.rapid_flip_ratio || 0) * 100).toFixed(0)}%)</Badge></dd>
          <dt>{ar ? 'بيع أكثر من شراء' : 'sold > bought'}</dt><dd><Badge tone={bot.sold_more_than_bought_tokens > 0 ? 'warn' : 'ok'}>{bot.sold_more_than_bought_tokens}</Badge></dd>
        </dl>
      </div>
      <p className="faint fs-xs">
        {ar ? `on-chain · ${s.sample_size} حدث من ${res.signatures_scanned} معاملة · FIFO, تقديري` : `on-chain · ${s.sample_size} events / ${res.signatures_scanned} txs · FIFO, directional`}
      </p>
    </div>
  );
}
