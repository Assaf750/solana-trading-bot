import { useState } from 'react';
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
  const [state, setState] = useState(null); // {loading|data|error}
  const [analysis, setAnalysis] = useState({}); // address -> {loading|data}
  const [followed, setFollowed] = useState({}); // address -> true

  async function discover() {
    setState({ loading: true });
    const r = await api.discoverTokenTraders(mint.trim());
    setState(r.ok ? { data: r.data } : { error: r.data?.error || 'failed' });
  }
  async function analyze(addr) {
    setAnalysis((a) => ({ ...a, [addr]: { loading: true } }));
    const r = await api.analyzeWallet(addr);
    setAnalysis((a) => ({ ...a, [addr]: r.ok ? { data: r.data.stats } : { error: r.data?.error } }));
  }
  async function follow(addr) {
    const r = await api.registerWallet({ tracked_wallet_address: addr, label: '' });
    if (r.ok) { await api.setFollow(r.data.wallet.wallet_id, true); setFollowed((f) => ({ ...f, [addr]: true })); }
    else if (r.data?.api_error_code === 'IDEMPOTENCY_CONFLICT') setFollowed((f) => ({ ...f, [addr]: true }));
  }

  if (!connected) {
    return (
      <div className="stack">
        <PageHead title={ar ? 'رادار العملات الجديدة' : 'New Coin Radar'} sub={ar ? 'اكتشاف' : 'Discovery'} />
        <EmptyState message={ar ? 'الخادم غير متصل — شغّل START.bat' : 'Server offline — run START.bat'} />
      </div>
    );
  }

  const traders = state?.data?.traders || [];

  return (
    <div className="stack">
      <PageHead
        title={ar ? 'اكتشاف المحافظ' : 'Wallet Discovery'}
        sub={ar ? 'الصق عنوان توكن → اكتشف المحافظ التي تتداوله → حلّلها وتابِعها' : 'Paste a token mint → discover the wallets trading it → analyze and follow'}
      />

      <DangerNote tone="info">
        {ar
          ? 'اكتشاف من السلسلة مباشرة (قراءة فقط) — ليس إشارة شراء. التنفيذ يبقى wallet-led: تحلّل المحفظة ثم تقرّر متابعتها.'
          : 'On-chain discovery (read-only) — not a buy signal. Execution stays wallet-led: you analyze a wallet, then decide to follow it.'}
      </DangerNote>

      <div className="filterbar">
        <input className="search grow" dir="ltr" placeholder={ar ? 'عنوان التوكن (mint)…' : 'token mint address…'} value={mint} onChange={(e) => setMint(e.target.value)} />
        <button className="btn primary" onClick={discover} disabled={!mint.trim() || state?.loading}>{ar ? '🔭 اكتشف المتداولين' : '🔭 Discover traders'}</button>
      </div>

      {state?.loading && <Card title={ar ? 'جارٍ المسح…' : 'Scanning…'}><p className="muted">{ar ? 'أمسح آخر معاملات التوكن من السلسلة لاستخراج المحافظ النشطة فيه.' : 'Scanning the token’s recent on-chain transactions to surface active wallets.'}</p></Card>}
      {state?.error && <Card title="—"><Badge tone="danger">{state.error === 'vault_locked' ? (ar ? 'افتح الخزنة أولاً' : 'Unlock vault first') : state.error}</Badge></Card>}

      {state?.data && (
        <Card title={ar ? `محافظ تتداول هذا التوكن (${traders.length})` : `Wallets trading this token (${traders.length})`}
          right={<span className="muted fs-xs">{ar ? `مُسِح ${state.data.scanned} معاملة` : `scanned ${state.data.scanned} txs`}</span>}>
          {traders.length === 0 ? (
            <EmptyState message={ar ? 'لم تُرصد محافظ — جرّب توكناً أكثر نشاطاً' : 'No wallets found — try a more active token'} />
          ) : (
            <div className="wlist">
              <div className="wlist-head" style={{ gridTemplateColumns: '1.4fr 0.7fr 1fr auto' }}>
                <span>{ar ? 'المحفظة' : 'wallet'}</span><span className="num">{ar ? 'صفقات' : 'swaps'}</span><span>{ar ? 'تحليل' : 'analysis'}</span><span></span>
              </div>
              {traders.map((tr) => {
                const a = analysis[tr.address];
                const s = a?.data;
                return (
                  <div key={tr.address} className="wrow" style={{ gridTemplateColumns: '1.4fr 0.7fr 1fr auto', cursor: 'default' }}>
                    <span className="mono" dir="ltr">{short(tr.address)}</span>
                    <span className="num mono">{tr.swaps_seen}</span>
                    <span>
                      {!a ? <span className="faint">—</span>
                        : a.loading ? <span className="muted">{ar ? 'جارٍ…' : '…'}</span>
                        : a.error ? <Badge tone="danger">{a.error === 'vault_locked' ? 'vault' : 'err'}</Badge>
                        : s?.status === 'insufficient_evidence' ? <span className="faint">{ar ? 'لا دليل' : 'no data'}</span>
                        : <span className="mono fs-xs" style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
                            <Sparkline seed={tr.address} tone={s.win_rate != null ? (s.win_rate >= 0.5 ? 'pos' : 'neg') : 'muted'} bias={s.win_rate != null ? (s.win_rate >= 0.5 ? 1 : -1) : 0} width={46} height={16} />
                            <span style={{ color: s.win_rate == null ? 'var(--c-text-faint)' : s.win_rate >= 0.5 ? 'var(--c-ok)' : 'var(--c-danger)' }}>{s.win_rate != null ? `${(s.win_rate * 100).toFixed(0)}%` : '—'}</span>
                            {' · '}<span style={{ color: (s.realized_pnl_sol || 0) >= 0 ? 'var(--c-ok)' : 'var(--c-danger)' }}>{s.realized_pnl_sol > 0 ? '+' : ''}{s.realized_pnl_sol}◎</span>
                            {' · '}{s.trades_closed}t
                          </span>}
                    </span>
                    <span className="row" style={{ gap: 4, justifyContent: 'flex-end' }}>
                      <button className="btn" onClick={() => analyze(tr.address)}>{ar ? '🔍' : '🔍'}</button>
                      <button className={`btn ${followed[tr.address] ? '' : 'primary'}`} onClick={() => follow(tr.address)} disabled={followed[tr.address]}>
                        {followed[tr.address] ? (ar ? 'متابَعة ✓' : 'following ✓') : (ar ? 'تابِع' : 'Follow')}
                      </button>
                    </span>
                  </div>
                );
              })}
            </div>
          )}
          <p className="faint" style={{ fontSize: 'var(--fs-xs)', marginBlockStart: 'var(--s-3)' }}>
            {ar ? 'حلّل أي محفظة لرؤية أدائها التاريخي، ثم تابِعها لتبدأ نسخها — تظهر في كونسول المحافظ.' : 'Analyze any wallet for its historical performance, then follow to start copying — it appears in the Wallet Workspace.'}
            {' '}<Link to="/wallets">{ar ? 'كونسول المحافظ ←' : 'Wallet Workspace →'}</Link>
          </p>
        </Card>
      )}
    </div>
  );
}
