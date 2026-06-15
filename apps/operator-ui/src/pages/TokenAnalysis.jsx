import { useEffect, useState } from 'react';
import { useI18n } from '../i18n/index.jsx';
import PageHead from '../components/PageHead.jsx';
import { Card, Badge, DangerNote, EmptyState } from '../components/index.jsx';
import { api } from '../api/client.js';
import { useBackend } from '../api/useBackend.jsx';
import { shortMint } from '../format.js';

const MINT_RE = /^[1-9A-HJ-NP-Za-km-z]{32,44}$/;
const usd = (v) => (v == null ? '—' : v >= 1 ? `$${Number(v).toLocaleString(undefined, { maximumFractionDigits: 2 })}` : `$${Number(v).toPrecision(4)}`);
const VERDICT = {
  suitable: { ar: 'مناسب', en: 'Suitable', tone: 'ok' },
  watch: { ar: 'مراقبة', en: 'Watch', tone: 'warn' },
  high_risk: { ar: 'عالي المخاطر', en: 'High risk', tone: 'danger' },
  weak: { ar: 'ضعيف', en: 'Weak', tone: 'neutral' },
  unanalyzable: { ar: 'غير قابل للتحليل', en: 'Unanalyzable', tone: 'neutral' },
};
const sevTone = (s) => (s === 'high' ? 'danger' : s === 'med' ? 'warn' : s === 'low' ? 'info' : 'neutral');

function Stat({ label, value, tone }) {
  return (
    <div className="stattile">
      <span className="lbl">{label}</span>
      <span className={`val ${tone || ''}`} style={{ fontSize: 'var(--fs-lg)' }}>{value}</span>
    </div>
  );
}
function Score({ label, value, invert }) {
  const tone = value == null ? '' : invert ? (value >= 70 ? 'neg' : value >= 40 ? 'warn' : 'pos') : (value >= 60 ? 'pos' : value >= 35 ? 'warn' : 'neg');
  return <Stat label={label} value={value == null ? '—' : `${value}/100`} tone={tone} />;
}

export default function TokenAnalysis() {
  const { lang } = useI18n();
  const ar = lang === 'ar';
  const { connected } = useBackend();
  const [mint, setMint] = useState('');
  const [busy, setBusy] = useState(false);
  const [res, setRes] = useState(null);
  const [err, setErr] = useState(null);

  // deep-link: #/tokens?mint=... (from Radar / unified search)
  useEffect(() => {
    const q = new URLSearchParams((window.location.hash.split('?')[1]) || '');
    const m = q.get('mint');
    if (m && MINT_RE.test(m)) { setMint(m); run(m); }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function run(addr) {
    const m = (addr ?? mint).trim();
    if (!MINT_RE.test(m)) { setErr(ar ? 'عنوان توكن غير صالح' : 'Invalid token mint'); return; }
    setErr(null); setBusy(true); setRes(null);
    const r = await api.analyzeToken(m);
    setBusy(false);
    if (r.ok && r.data?.ok) setRes(r.data);
    else setErr(r.data?.error === 'vault_locked' ? (ar ? 'افتح الخزنة أولاً (محافظي والأموال)' : 'Unlock the vault first (My Wallets & Funds)') : (r.data?.error || (ar ? 'فشل التحليل' : 'analysis failed')));
  }

  if (!connected) {
    return (
      <div className="stack">
        <PageHead title={ar ? 'تحليل التوكنات' : 'Token Analysis'} sub={ar ? 'تحليل أي توكن على سولانا' : 'Analyze any Solana token'} />
        <EmptyState message={ar ? 'الخادم غير متصل — شغّل START.bat' : 'Server offline — run START.bat'} />
      </div>
    );
  }

  const id = res?.token_identity;
  const md = res?.market_data;
  const liq = res?.liquidity_data;
  const ha = res?.holder_analysis;
  const au = res?.authority_analysis;
  const t22 = res?.token_2022_analysis;
  const verdict = res ? (VERDICT[res.final_verdict] || VERDICT.unanalyzable) : null;

  return (
    <div className="stack">
      <PageHead title={ar ? 'تحليل التوكنات' : 'Token Analysis'} sub={ar ? 'الصق عنوان عقد توكن (mint) لتقرير كامل: الهوية، السوق، السيولة، الحائزون، الصلاحيات، Token-2022، المخاطر، والقرار.' : 'Paste a token mint for a full report: identity, market, liquidity, holders, authorities, Token-2022, risk & verdict.'} />

      <Card title={ar ? 'فحص توكن' : 'Analyze a token'}>
        <div className="row" style={{ flexWrap: 'wrap' }}>
          <input className="search" dir="ltr" style={{ flex: '2 1 360px' }} placeholder={ar ? 'عنوان التوكن (mint)…' : 'token mint address…'}
            value={mint} onChange={(e) => setMint(e.target.value)} onKeyDown={(e) => { if (e.key === 'Enter') run(); }} />
          <button className="btn primary" onClick={() => run()} disabled={busy || !MINT_RE.test(mint.trim())}>{busy ? (ar ? 'جارٍ التحليل…' : 'analyzing…') : (ar ? '🔬 حلّل' : '🔬 Analyze')}</button>
        </div>
        {err && <div style={{ marginBlockStart: 8 }}><Badge tone="danger">{err}</Badge></div>}
        <p className="faint fs-xs" style={{ marginBlockStart: 6 }}>{ar ? 'قراءة فقط من السلسلة — لا أوامر شراء هنا. يتطلب خزنة مفتوحة (مفتاح RPC).' : 'Read-only on-chain — no buy action here. Requires an unlocked vault (RPC key).'}</p>
      </Card>

      {busy && <Card title={ar ? 'جارٍ القراءة من السلسلة…' : 'Reading on-chain…'}><div className="skeleton-row" /><div className="skeleton-row" /><div className="skeleton-row" /></Card>}

      {res && (
        <>
          <Card
            title={<span className="token-label" dir="ltr">{id?.icon && <img className="token-ico" src={id.icon} alt="" />}<span className="token-sym">{id?.symbol || shortMint(res.mint)}</span>{id?.name && <span className="muted fs-sm">{id.name}</span>}</span>}
            right={<Badge tone={verdict.tone}>{ar ? verdict.ar : verdict.en}</Badge>}
          >
            <div className="kpi-strip" style={{ margin: 0 }}>
              <Score label={ar ? 'المخاطر' : 'Risk'} value={res.risk_score} invert />
              <Score label={ar ? 'الفرصة' : 'Opportunity'} value={res.opportunity_score} />
              <Score label={ar ? 'قابلية النسخ' : 'Copyability'} value={res.copyability_score} />
              <Stat label={ar ? 'السعر' : 'Price'} value={usd(md?.price_usd)} />
              <Stat label="FDV" value={usd(md?.fdv_usd)} />
              <Stat label={ar ? 'انزلاق ذهاب-عودة' : 'Round-trip slip'} value={liq?.round_trip_slippage_pct != null ? `${liq.round_trip_slippage_pct}%` : '—'} tone={liq?.round_trip_slippage_pct >= 20 ? 'neg' : 'pos'} />
            </div>
            <div className="kv" style={{ marginBlockStart: 'var(--s-3)' }}>
              <dt>mint</dt><dd className="mono" dir="ltr" style={{ wordBreak: 'break-all', fontSize: 'var(--fs-xs)' }}>{res.mint}</dd>
              <dt>{ar ? 'البرنامج' : 'program'}</dt><dd>{t22?.is_token_2022 ? <Badge tone="warn">Token-2022</Badge> : <Badge tone="neutral">SPL Token</Badge>}</dd>
              <dt>decimals</dt><dd className="mono">{id?.decimals ?? '—'}</dd>
              <dt>supply</dt><dd className="mono">{id?.supply_ui != null ? Number(id.supply_ui).toLocaleString() : '—'}</dd>
              <dt>{ar ? 'آخر نشاط' : 'last activity'}</dt><dd className="mono fs-xs" dir="ltr">{md?.last_activity ? md.last_activity.replace('T', ' ').slice(0, 19) : '—'}</dd>
              <dt>{ar ? 'قابل للبيع' : 'sellable'}</dt><dd>{liq?.sellable == null ? <Badge tone="neutral">{ar ? 'غير معروف' : 'unknown'}</Badge> : liq.sellable ? <Badge tone="ok">{ar ? 'نعم' : 'yes'}</Badge> : <Badge tone="danger">{ar ? 'لا (honeypot؟)' : 'no (honeypot?)'}</Badge>}</dd>
            </div>
          </Card>

          <div className="workspace">
            <Card title={ar ? 'القرار والأسباب' : 'Verdict & reasons'}>
              <div className="row" style={{ marginBlockEnd: 'var(--s-2)' }}><Badge tone={verdict.tone}>{ar ? verdict.ar : verdict.en}</Badge></div>
              {res.reasons?.length ? (
                <ul style={{ listStyle: 'none', padding: 0, margin: 0 }}>
                  {res.reasons.map((r, i) => (
                    <li key={i} style={{ padding: '5px 0', borderBottom: '1px solid var(--c-border)', display: 'flex', gap: 8, alignItems: 'baseline' }}>
                      <Badge tone={sevTone(r.severity)}>{r.severity}</Badge>
                      <span className="fs-sm">{r.text}</span>
                    </li>
                  ))}
                </ul>
              ) : <p className="muted">{ar ? 'لا إشارات مخاطر بارزة.' : 'No notable risk signals.'}</p>}
            </Card>

            <div className="detail-pane stack" style={{ gap: 'var(--s-3)' }}>
              <Card title={ar ? 'الصلاحيات' : 'Authorities'}>
                <div className="kv">
                  <dt>mint authority</dt><dd>{au?.mint_revoked ? <Badge tone="ok">{ar ? 'مُلغاة ✓' : 'revoked ✓'}</Badge> : <Badge tone="danger">{ar ? 'فعّالة ⚠' : 'active ⚠'}</Badge>}</dd>
                  <dt>freeze authority</dt><dd>{au?.freeze_revoked ? <Badge tone="ok">{ar ? 'مُلغاة ✓' : 'revoked ✓'}</Badge> : <Badge tone="danger">{ar ? 'فعّالة ⚠' : 'active ⚠'}</Badge>}</dd>
                </div>
              </Card>
              {t22?.is_token_2022 && (
                <Card title={ar ? 'امتدادات Token-2022' : 'Token-2022 extensions'}>
                  {t22.extensions?.length ? t22.extensions.map((e) => (
                    <div key={e.key} className="row" style={{ gap: 8, padding: '4px 0', borderBottom: '1px solid var(--c-border)', flexWrap: 'wrap' }}>
                      <Badge tone={sevTone(e.risk)}>{e.label}</Badge>
                      <span className="muted fs-xs">{e.meaning}</span>
                    </div>
                  )) : <p className="muted">{ar ? 'لا امتدادات' : 'no extensions'}</p>}
                </Card>
              )}
            </div>
          </div>

          <Card title={ar ? 'الحائزون والتركّز' : 'Holders & concentration'}
            right={<span className="muted fs-xs">{ar ? 'حائزون' : 'holders'}: {ha?.holder_count ?? '—'} · {ar ? 'أكبر حساب' : 'top'}: {ha?.top_holder_pct != null ? `${ha.top_holder_pct}%` : '—'}</span>}>
            {ha?.top_holders?.length ? (
              <div className="table-wrap">
                <table className="data">
                  <thead><tr><th className="nosort">#</th><th className="nosort">{ar ? 'الحساب' : 'account'}</th><th className="nosort num">{ar ? 'الكمية' : 'amount'}</th><th className="nosort num">% {ar ? 'من العرض' : 'of supply'}</th></tr></thead>
                  <tbody>
                    {ha.top_holders.map((h, i) => (
                      <tr key={h.address}>
                        <td className="mono">{i + 1}{i === 0 ? <span className="faint fs-xs"> {ar ? '(قد تكون البِركة)' : '(may be LP)'}</span> : ''}</td>
                        <td className="mono fs-xs" dir="ltr">{shortMint(h.address)}</td>
                        <td className="num mono">{Number(h.amount_ui).toLocaleString(undefined, { maximumFractionDigits: 2 })}</td>
                        <td className="num mono" style={{ color: h.pct >= 50 ? 'var(--c-danger)' : h.pct >= 20 ? 'var(--c-warn)' : 'var(--c-text)' }}>{h.pct.toFixed(1)}%</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : <EmptyState message={ar ? 'بيانات الحائزين غير متوفّرة' : 'Holder data unavailable'} />}
          </Card>

          {res.smart_money_relation?.trader_count != null && (
            <Card title={ar ? 'علاقة المال الذكي' : 'Smart-money relation'} right={<span className="muted fs-xs">{res.smart_money_relation.trader_count} {ar ? 'محفظة' : 'wallets'}</span>}>
              {res.smart_money_relation.traders?.length ? (
                <div className="row" style={{ gap: 'var(--s-2)', flexWrap: 'wrap' }}>
                  {res.smart_money_relation.traders.map((t) => <span key={t.address} className="mono fs-xs" dir="ltr" style={{ background: 'var(--c-bg-elev-2)', padding: '3px 7px', borderRadius: 'var(--radius-sm)' }}>{shortMint(t.address)} · {t.swaps_seen}×</span>)}
                </div>
              ) : <p className="muted">{ar ? 'لا محافظ مكتشفة لهذا التوكن (قد يكون خاملاً).' : 'No wallets discovered for this token (may be inactive).'}</p>}
            </Card>
          )}

          <DangerNote tone="info">
            {ar ? `المصادر: ${(res.evidence_sources || []).join('، ') || '—'}.` : `Sources: ${(res.evidence_sources || []).join(', ') || '—'}.`}
            {res.missing_data?.length ? (ar ? ` · بيانات ناقصة: ${res.missing_data.join('، ')}.` : ` · Missing: ${res.missing_data.join(', ')}.`) : ''}
            {res.opportunity_confidence === 'low' ? (ar ? ' · درجة الفرصة تقديرية منخفضة الثقة (لا تغذية زخم).' : ' · Opportunity score is low-confidence heuristic (no momentum feed).') : ''}
          </DangerNote>
        </>
      )}
    </div>
  );
}
