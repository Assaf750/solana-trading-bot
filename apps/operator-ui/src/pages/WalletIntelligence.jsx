import { useEffect, useState } from 'react';
import { useI18n } from '../i18n/index.jsx';
import PageHead from '../components/PageHead.jsx';
import { Card, Badge, DangerNote, EmptyState } from '../components/index.jsx';
import { api } from '../api/client.js';
import { useBackend } from '../api/useBackend.jsx';

export default function WalletIntelligence() {
  const { t, lang } = useI18n();
  const ar = lang === 'ar';
  const { connected } = useBackend();
  const [wallets, setWallets] = useState([]);
  const [addr, setAddr] = useState('');
  const [label, setLabel] = useState('');
  const [mode, setMode] = useState('follow_entry_user_exit');
  const [msg, setMsg] = useState(null);
  const [analysis, setAnalysis] = useState({}); // wallet_id -> {loading|data}

  async function load() {
    const r = await api.wallets();
    if (r.ok) setWallets(r.data.wallets || []);
  }
  useEffect(() => { if (connected) load(); }, [connected]);

  async function register() {
    setMsg(null);
    const r = await api.registerWallet({ tracked_wallet_address: addr.trim(), label: label.trim(), copy_mode: mode });
    if (r.ok) {
      setAddr(''); setLabel('');
      setMsg({ tone: 'ok', text: ar ? 'سُجلت المحفظة ✓ (المتابعة OFF افتراضياً — فعّلها بنفسك)' : 'Wallet registered ✓ (follow defaults OFF — enable it yourself)' });
    } else {
      setMsg({ tone: 'danger', text: `${r.data?.error || r.data?.api_error_code || 'rejected'}` });
    }
    load();
  }

  async function toggleFollow(w) {
    await api.setFollow(w.wallet_id, !w.follow_enabled);
    load();
  }

  async function remove(w) {
    await api.removeWallet(w.wallet_id);
    load();
  }

  async function analyze(w) {
    setAnalysis((a) => ({ ...a, [w.wallet_id]: { loading: true } }));
    const r = await api.analyzeWallet(w.tracked_wallet_address);
    setAnalysis((a) => ({ ...a, [w.wallet_id]: r.ok ? { data: r.data } : { error: r.data?.error || 'failed' } }));
  }

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
      <PageHead title={t('wallets.title')} sub={ar ? 'سجّل المحافظ الرابحة التي تريد نسخها وتحكم في متابعتها' : 'Register the winning wallets you want to copy and control following'} />

      <Card title={ar ? '➕ تسجيل محفظة متبوعة' : '➕ Register tracked wallet'}>
        <div className="row" style={{ flexWrap: 'wrap' }}>
          <input
            className="search" dir="ltr" style={{ flex: '2 1 320px' }}
            placeholder={ar ? 'عنوان المحفظة (base58)' : 'wallet address (base58)'}
            value={addr} onChange={(e) => setAddr(e.target.value)}
          />
          <input
            className="search" style={{ flex: '1 1 140px' }}
            placeholder={ar ? 'اسم وصفي (اختياري)' : 'label (optional)'}
            value={label} onChange={(e) => setLabel(e.target.value)}
          />
          <div className="seg" role="group">
            <button className={mode === 'follow_entry_user_exit' ? 'on' : ''} onClick={() => setMode('follow_entry_user_exit')}>follow_entry</button>
            <button className={mode === 'full_mirror' ? 'on' : ''} onClick={() => setMode('full_mirror')}>full_mirror</button>
          </div>
          <button className="btn" onClick={register} disabled={!addr.trim()}>{ar ? 'تسجيل' : 'Register'}</button>
        </div>
        {mode === 'full_mirror' && (
          <DangerNote tone="warn" locked>
            {ar ? 'full_mirror وضع متقدم: ينسخ البيع والشراء نسبياً. الافتراضي الآمن هو follow_entry_user_exit.' : 'full_mirror is advanced: mirrors buys AND sells proportionally. The safe default is follow_entry_user_exit.'}
          </DangerNote>
        )}
        {msg && <div style={{ marginBlockStart: 8 }}><Badge tone={msg.tone}>{msg.text}</Badge></div>}
      </Card>

      <Card title={ar ? `المحافظ المسجلة (${wallets.length})` : `Registered wallets (${wallets.length})`}>
        {wallets.length === 0 ? (
          <EmptyState message={ar ? 'لا محافظ مسجلة بعد — سجّل أول محفظة أعلاه' : 'No wallets yet — register your first one above'} />
        ) : (
          <div className="table-wrap">
            <table className="data">
              <thead>
                <tr>
                  <th className="nosort">{t('common.wallet')}</th>
                  <th className="nosort">label</th>
                  <th className="nosort">copy_mode</th>
                  <th className="nosort">{ar ? 'المتابعة' : 'follow'}</th>
                  <th className="nosort"></th>
                </tr>
              </thead>
              <tbody>
                {wallets.map((w) => (
                  <tr key={w.wallet_id}>
                    <td className="mono" dir="ltr">{w.tracked_wallet_address.slice(0, 6)}…{w.tracked_wallet_address.slice(-6)}</td>
                    <td>{w.label || <span className="faint">—</span>}</td>
                    <td><Badge tone={w.copy_mode === 'full_mirror' ? 'warn' : 'info'}>{w.copy_mode}</Badge></td>
                    <td>
                      <button className={`btn toggle ${w.follow_enabled ? 'on' : ''}`} onClick={() => toggleFollow(w)}>
                        {w.follow_enabled ? (ar ? 'متابَعة ✓' : 'following ✓') : (ar ? 'متوقفة' : 'off')}
                      </button>
                    </td>
                    <td>
                      <span className="row" style={{ gap: 4 }}>
                        <button className="btn" onClick={() => analyze(w)}>{ar ? '🔍 تحليل' : '🔍 Analyze'}</button>
                        <button className="btn" onClick={() => remove(w)}>{ar ? 'حذف' : 'Remove'}</button>
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      {wallets.map((w) => {
        const a = analysis[w.wallet_id];
        if (!a) return null;
        return (
          <Card key={`an-${w.wallet_id}`}
            title={<span>{ar ? '🔍 تحليل المحفظة (تاريخي، on-chain)' : '🔍 Wallet analysis (historical, on-chain)'} · <span className="mono" dir="ltr">{w.label || w.tracked_wallet_address.slice(0, 6) + '…'}</span></span>}>
            {a.loading && <p className="muted">{ar ? 'جارٍ مسح آخر معاملات المحفظة من السلسلة…' : 'Scanning the wallet’s recent on-chain transactions…'}</p>}
            {a.error && <Badge tone="danger">{a.error === 'vault_locked' ? (ar ? 'افتح الخزنة أولاً (تحتاج مفتاح RPC)' : 'Unlock the vault first (needs RPC key)') : a.error}</Badge>}
            {a.data && <WalletAnalysis ar={ar} res={a.data} />}
          </Card>
        );
      })}

      <DangerNote tone="info">
        {ar
          ? 'تحليلات الربحية وقابلية النسخ (copyability/veto/drift) تُحسب من بيانات السوق الحية بعد تشغيل محرك الورق (M3) — لن تُختلق أرقام قبل توفر دليل حقيقي.'
          : 'Profitability and copyability analytics (veto/drift) are computed from live market data once the paper engine (M3) runs — numbers are never fabricated before real evidence exists.'}
      </DangerNote>
    </div>
  );
}

function Stat({ label, value, tone }) {
  return (
    <div className="card" style={{ background: 'var(--c-bg-elev-2)', minWidth: 130 }}>
      <div className="muted" style={{ fontSize: 'var(--fs-xs)' }}>{label}</div>
      <div className="mono" style={{ fontSize: 'var(--fs-lg)', color: tone === 'ok' ? 'var(--c-ok,#46a758)' : tone === 'danger' ? 'var(--c-danger,#e5484d)' : 'inherit' }}>{value}</div>
    </div>
  );
}

function WalletAnalysis({ ar, res }) {
  const s = res.stats || {};
  if (s.status === 'insufficient_evidence') {
    return <EmptyState message={ar ? `لا صفقات قابلة للتحليل في آخر ${res.signatures_scanned || 0} معاملة (قد تكون محفظة جديدة أو غير متداولة).` : `No analyzable trades in the last ${res.signatures_scanned || 0} txs (may be new or inactive).`} />;
  }
  const wr = s.win_rate != null ? `${(s.win_rate * 100).toFixed(1)}%` : (ar ? 'غير متوفر' : 'unavailable');
  const pnlUsd = s.realized_pnl_usd != null ? `$${s.realized_pnl_usd}` : `${s.realized_pnl_sol} SOL`;
  const hold = s.avg_hold_seconds != null ? `${Math.round(s.avg_hold_seconds / 60)} min` : '—';
  const bot = s.bot_signals || {};
  const rapidTone = bot.rapid_flip_ratio > 0.4 ? 'danger' : bot.rapid_flip_ratio > 0.15 ? 'warn' : 'ok';
  return (
    <div className="stack" style={{ gap: 'var(--s-3)' }}>
      {s.status === 'low_confidence' && (
        <Badge tone="warn">{ar ? `ثقة منخفضة — عيّنة صغيرة (${s.trades_closed} صفقة مغلقة)` : `low confidence — small sample (${s.trades_closed} closed)`}</Badge>
      )}
      <div className="row" style={{ gap: 'var(--s-3)', flexWrap: 'wrap' }}>
        <Stat label={ar ? 'نسبة الربح' : 'Win rate'} value={wr} tone={s.win_rate >= 0.5 ? 'ok' : 'danger'} />
        <Stat label={ar ? 'الربح المحقّق' : 'Realized PnL'} value={pnlUsd} tone={(s.realized_pnl_sol || 0) >= 0 ? 'ok' : 'danger'} />
        <Stat label={ar ? 'صفقات مغلقة' : 'Closed trades'} value={s.trades_closed} />
        <Stat label={ar ? 'توكنات' : 'Tokens'} value={s.distinct_tokens} />
        <Stat label={ar ? 'متوسط الاحتفاظ' : 'Avg hold'} value={hold} />
      </div>

      <div className="grid cols-2">
        <div>
          <div className="muted" style={{ fontSize: 'var(--fs-sm)', marginBlockEnd: 4 }}>{ar ? 'توزيع نتائج الصفقات' : 'Trade-outcome distribution'}</div>
          <table className="data"><tbody>
            {s.outcome_distribution.map((b) => (
              <tr key={b.key}><td className="mono">{b.label}</td><td className="num mono">{b.count}</td></tr>
            ))}
          </tbody></table>
        </div>
        <div>
          <div className="muted" style={{ fontSize: 'var(--fs-sm)', marginBlockEnd: 4 }}>{ar ? 'إشارات البوت/الغش' : 'Bot / wash signals'}</div>
          <dl className="kv">
            <dt>{ar ? 'بيع/شراء خلال 5ث' : 'buy/sell within 5s'}</dt>
            <dd><Badge tone={rapidTone}>{bot.rapid_buy_sell_within_5s} ({((bot.rapid_flip_ratio || 0) * 100).toFixed(0)}%)</Badge></dd>
            <dt>{ar ? 'بيع أكثر من شراء' : 'sold > bought'}</dt>
            <dd><Badge tone={bot.sold_more_than_bought_tokens > 0 ? 'warn' : 'ok'}>{bot.sold_more_than_bought_tokens}</Badge></dd>
          </dl>
        </div>
      </div>

      <p className="faint" style={{ fontSize: 'var(--fs-xs)' }}>
        {ar
          ? `مصدر: السلسلة مباشرة · عيّنة: ${s.sample_size} حدث من ${res.signatures_scanned} معاملة حديثة · ${s.cost_basis_note}`
          : `source: on-chain · sample: ${s.sample_size} events from ${res.signatures_scanned} recent txs · ${s.cost_basis_note}`}
      </p>
    </div>
  );
}
