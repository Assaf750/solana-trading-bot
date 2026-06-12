import { useEffect, useMemo, useState } from 'react';
import { useI18n } from '../i18n/index.jsx';
import PageHead from '../components/PageHead.jsx';
import { Card, Badge, DangerNote, EmptyState, SimulatedBadge } from '../components/index.jsx';
import { api } from '../api/client.js';
import { useBackend } from '../api/useBackend.jsx';

const usd = (v) => `$${Number(v ?? 0).toFixed(2)}`;
const shortMint = (m) => `${String(m).slice(0, 4)}…${String(m).slice(-4)}`;

export default function AnalyticsReports() {
  const { t, lang } = useI18n();
  const ar = lang === 'ar';
  const { connected } = useBackend();
  const [summary, setSummary] = useState(null);
  const [trades, setTrades] = useState([]);
  const [positions, setPositions] = useState([]);

  async function load() {
    const [p, tr] = await Promise.all([api.positions(), api.trades()]);
    if (p.ok) { setSummary(p.data.summary || null); setPositions(p.data.positions || []); }
    if (tr.ok) setTrades(tr.data.trades || []);
  }
  useEffect(() => {
    if (!connected) return undefined;
    load();
    const iv = setInterval(load, 10000);
    return () => clearInterval(iv);
  }, [connected]);

  const byToken = useMemo(() => {
    const m = new Map();
    for (const tr of trades) {
      const k = tr.token_mint;
      if (!m.has(k)) m.set(k, { mint: k, buys: 0, sells: 0, count: 0 });
      const e = m.get(k);
      e.count += 1;
      if (tr.side === 'buy') e.buys += tr.value_usd; else e.sells += tr.value_usd;
    }
    return [...m.values()].map((e) => ({ ...e, net: e.sells - e.buys })).sort((a, b) => b.net - a.net);
  }, [trades]);

  const closed = positions.filter((p) => p.position_state !== 'OPEN');
  const wins = trades.filter((tr) => tr.side === 'sell' && /take_profit|full_exit|partial/.test(tr.reason || '')).length;

  if (!connected) {
    return (
      <div className="stack">
        <PageHead title={t('analytics.title')} sub={t('analytics.sub')} />
        <EmptyState message={ar ? 'الخادم غير متصل — شغّل START.bat' : 'Server offline — run START.bat'} />
      </div>
    );
  }

  return (
    <div className="stack">
      <PageHead title={ar ? 'التحليلات والتقارير' : 'Analytics & Reports'} sub={ar ? 'أداء التداول الورقي من بيانات حقيقية — لا أرقام مختلقة' : 'Paper performance from real data — no fabricated numbers'} />

      <div className="kpi-strip">
        <div className="stattile"><span className="lbl">{ar ? 'محقّق' : 'Realized'} <SimulatedBadge /></span><span className={`val ${(summary?.realized_pnl_usd ?? 0) >= 0 ? 'pos' : 'neg'}`}>{usd(summary?.realized_pnl_usd)}</span></div>
        <div className="stattile"><span className="lbl">{ar ? 'غير محقّق' : 'Unrealized'} <SimulatedBadge /></span><span className={`val ${(summary?.unrealized_pnl_usd ?? 0) >= 0 ? 'pos' : 'neg'}`}>{usd(summary?.unrealized_pnl_usd)}</span></div>
        <div className="stattile"><span className="lbl">{ar ? 'مراكز مغلقة' : 'Closed'}</span><span className="val">{closed.length}</span></div>
        <div className="stattile"><span className="lbl">{ar ? 'صفقات' : 'Trades'}</span><span className="val">{trades.length}</span></div>
        <div className="stattile"><span className="lbl">{ar ? 'توكنات' : 'Tokens'}</span><span className="val">{byToken.length}</span></div>
        <div className="stattile"><span className="lbl">{ar ? 'خروج رابح' : 'Winning exits'}</span><span className="val pos">{wins}</span></div>
      </div>

      <DangerNote tone="sim">
        {ar ? 'كل الأرقام محاكاة (paper) بأسعار سوق حقيقية — لا تُخلط بنتائج حقيقية، ولا تُختلق المقاييس غير المتوفّرة.' : 'All numbers are simulated (paper) at real prices — never mixed with live results; unavailable metrics are never fabricated.'}
      </DangerNote>

      <div className="workspace">
        <Card title={<span>{ar ? 'الأداء حسب التوكن' : 'Performance by token'} <SimulatedBadge /></span>}>
          {byToken.length === 0 ? (
            <EmptyState message={ar ? 'لا صفقات بعد — تتراكم البيانات مع نشاط القادة المتابَعين' : 'No trades yet — data accumulates as followed leaders act'} />
          ) : (
            <div className="table-wrap">
              <table className="data">
                <thead><tr><th className="nosort">token</th><th className="nosort">{ar ? 'صفقات' : 'trades'}</th><th className="nosort">{ar ? 'شراء' : 'buys'}</th><th className="nosort">{ar ? 'بيع' : 'sells'}</th><th className="nosort">net</th></tr></thead>
                <tbody>
                  {byToken.map((e) => (
                    <tr key={e.mint}>
                      <td className="mono" dir="ltr">{shortMint(e.mint)}</td>
                      <td className="num mono">{e.count}</td>
                      <td className="num mono">{usd(e.buys)}</td>
                      <td className="num mono">{usd(e.sells)}</td>
                      <td className="num mono" style={{ color: e.net >= 0 ? 'var(--c-ok)' : 'var(--c-danger)' }}>{e.net >= 0 ? '+' : ''}{usd(e.net)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </Card>

        <div className="detail-pane stack" style={{ gap: 'var(--s-3)' }}>
          <Card title={ar ? 'تقارير' : 'Reports'}>
            <ul style={{ listStyle: 'none', padding: 0, margin: 0 }}>
              {[
                { k: ar ? 'تجميع الورقي (per-wallet/mode)' : 'Paper aggregation (per-wallet/mode)', avail: trades.length > 0 },
                { k: ar ? 'انحراف Paper↔Real (معايرة)' : 'Paper↔Real divergence', avail: false },
                { k: ar ? 'الربح التجاري الصافي' : 'Net business P&L', avail: false },
                { k: ar ? 'تقرير الفرص المرفوضة' : 'Rejected-opportunity report', avail: false },
              ].map((r) => (
                <li key={r.k} className="row" style={{ justifyContent: 'space-between', padding: '7px 0', borderBottom: '1px solid var(--c-border)' }}>
                  <span>{r.k}</span>
                  {r.avail ? <Badge tone="ok">{ar ? 'متاح' : 'available'}</Badge> : <Badge tone="neutral">{ar ? 'يحتاج بيانات أكثر' : 'needs more data'}</Badge>}
                </li>
              ))}
            </ul>
            <p className="faint" style={{ fontSize: 'var(--fs-xs)', marginBlockStart: 8 }}>
              {ar ? 'التقارير تظهر «غير متوفّر» حتى تتراكم بيانات كافية — لا تُختلق.' : 'Reports show “unavailable” until enough data accrues — never fabricated.'}
            </p>
          </Card>

          <Card title={<span>{ar ? 'آخر الصفقات' : 'Recent trades'} <SimulatedBadge /></span>}>
            {trades.length === 0 ? <p className="muted">{ar ? 'لا صفقات' : 'No trades'}</p> : (
              <table className="data"><tbody>
                {trades.slice(-12).reverse().map((tr) => (
                  <tr key={tr.trade_id}>
                    <td><Badge tone={tr.side === 'buy' ? 'info' : 'warn'}>{tr.side}</Badge></td>
                    <td className="mono" dir="ltr" style={{ fontSize: 'var(--fs-xs)' }}>{shortMint(tr.token_mint)}</td>
                    <td className="num mono">{usd(tr.value_usd)}</td>
                  </tr>
                ))}
              </tbody></table>
            )}
          </Card>
        </div>
      </div>
    </div>
  );
}
