import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { useI18n } from '../i18n/index.jsx';
import PageHead from '../components/PageHead.jsx';
import { Card, Badge, DangerNote, EmptyState, SimulatedBadge, Sparkline, MiniChart, FlashValue } from '../components/index.jsx';
import { api } from '../api/client.js';
import { useBackend } from '../api/useBackend.jsx';

const usd = (v) => `$${Number(v ?? 0).toFixed(2)}`;
const shortMint = (m) => `${String(m).slice(0, 4)}…${String(m).slice(-4)}`;

export default function AnalyticsReports() {
  const { lang } = useI18n();
  const ar = lang === 'ar';
  const { status, connected } = useBackend();
  const live = status?.mode === 'real_live';
  const [summary, setSummary] = useState(null);
  const [trades, setTrades] = useState([]);
  const [positions, setPositions] = useState([]);
  const [insights, setInsights] = useState(null);

  async function load() {
    const ins = await api.leaderInsights();
    if (ins.ok) setInsights(ins.data || null);
    if (live) {
      const lp = await api.livePositions();
      if (lp.ok) { setSummary(lp.data.summary || null); setPositions(lp.data.positions || []); setTrades(lp.data.trades || []); }
      return;
    }
    const [p, tr] = await Promise.all([api.positions(), api.trades()]);
    if (p.ok) { setSummary(p.data.summary || null); setPositions(p.data.positions || []); }
    if (tr.ok) setTrades(tr.data.trades || []);
  }
  useEffect(() => {
    if (!connected) return undefined;
    load();
    const iv = setInterval(load, 10000);
    return () => clearInterval(iv);
  }, [connected, live]);

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

  // real cumulative-realized equity curve from closed positions (uses stored realized_usd + closed_at)
  const closedR = useMemo(() => positions
    .filter((p) => p.position_state !== 'OPEN' && Number.isFinite(p.realized_usd) && p.closed_at)
    .sort((a, b) => (a.closed_at < b.closed_at ? -1 : 1)), [positions]);
  const equity = useMemo(() => {
    let acc = 0; const pts = [0];
    for (const p of closedR) { acc += p.realized_usd; pts.push(Math.round(acc * 100) / 100); }
    return pts;
  }, [closedR]);
  const realizedVals = closedR.map((p) => p.realized_usd);
  const winsN = realizedVals.filter((x) => x > 0).length;
  const winRate = realizedVals.length ? winsN / realizedVals.length : null;
  const grossProfit = realizedVals.filter((x) => x > 0).reduce((a, b) => a + b, 0);
  const grossLoss = -realizedVals.filter((x) => x < 0).reduce((a, b) => a + b, 0);
  const profitFactor = grossLoss > 0 ? grossProfit / grossLoss : (grossProfit > 0 ? Infinity : null);
  const peak = equity.length ? Math.max(...equity) : 0;
  const maxDD = equity.reduce((mx, v, i) => Math.max(mx, Math.max(...equity.slice(0, i + 1)) - v), 0);

  const byLeader = (insights?.leaders || []).filter((l) => l.trades > 0).slice(0, 8);

  if (!connected) {
    return (
      <div className="stack">
        <PageHead title={ar ? 'التحليلات والتقارير' : 'Analytics & Reports'} sub={ar ? 'الأداء' : 'Performance'} />
        <EmptyState message={ar ? 'الخادم غير متصل — شغّل START.bat' : 'Server offline — run START.bat'} />
      </div>
    );
  }

  return (
    <div className="stack">
      <PageHead title={ar ? 'التحليلات والتقارير' : 'Analytics & Reports'} sub={live ? (ar ? 'أداء حقيقي من بيانات السلسلة' : 'Real-live performance from on-chain data') : (ar ? 'أداء التداول الورقي من بيانات حقيقية — لا أرقام مختلقة' : 'Paper performance from real data — no fabricated numbers')} />

      <div className="kpi-strip">
        <div className="stattile">
          <span className="lbl">{ar ? 'محقّق' : 'Realized'} {!live && <SimulatedBadge />}</span>
          <FlashValue className={`val ${(summary?.realized_pnl_usd ?? 0) >= 0 ? 'pos' : 'neg'}`} value={Number(summary?.realized_pnl_usd ?? 0)} format={usd} />
          <Sparkline data={equity.length > 1 ? equity : undefined} seed="analytics-realized" tone={(summary?.realized_pnl_usd ?? 0) >= 0 ? 'pos' : 'neg'} bias={(summary?.realized_pnl_usd ?? 0) >= 0 ? 1 : -1} width={130} height={24} points={32} />
        </div>
        <div className="stattile"><span className="lbl">{ar ? 'غير محقّق' : 'Unrealized'} {!live && <SimulatedBadge />}</span><FlashValue className={`val ${(summary?.unrealized_pnl_usd ?? 0) >= 0 ? 'pos' : 'neg'}`} value={Number(summary?.unrealized_pnl_usd ?? 0)} format={usd} /></div>
        <div className="stattile"><span className="lbl">{ar ? 'نسبة الفوز' : 'Win rate'}</span><span className={`val ${winRate == null ? '' : winRate >= 0.5 ? 'pos' : 'neg'}`}>{winRate == null ? '—' : `${(winRate * 100).toFixed(0)}%`}</span><span className="sub">{winsN}/{realizedVals.length} {ar ? 'مغلق' : 'closed'}</span></div>
        <div className="stattile"><span className="lbl">{ar ? 'عامل الربح' : 'Profit factor'}</span><span className={`val ${profitFactor == null ? '' : profitFactor >= 1.2 ? 'pos' : 'neg'}`}>{profitFactor == null ? '—' : profitFactor === Infinity ? '∞' : profitFactor.toFixed(2)}</span></div>
        <div className="stattile"><span className="lbl">{ar ? 'أقصى تراجع' : 'Max drawdown'}</span><span className="val neg">{maxDD > 0 ? `-${usd(maxDD)}` : usd(0)}</span><span className="sub">{ar ? 'قمة' : 'peak'} {usd(peak)}</span></div>
        <div className="stattile"><span className="lbl">{ar ? 'توكنات' : 'Tokens'}</span><span className="val">{byToken.length}</span><span className="sub">{trades.length} {ar ? 'صفقة' : 'trades'}</span></div>
      </div>

      <DangerNote tone={live ? 'danger' : 'sim'}>
        {live
          ? (ar ? '🔴 وضع حقيقي — نتائج تداول فعلي بمالك على السلسلة. المقياس غير المتوفّر يُعرض «غير متوفّر».' : '🔴 REAL-LIVE — actual on-chain results with your funds. Unavailable metrics are shown as “unavailable”.')
          : (ar ? 'كل الأرقام محاكاة (paper) بأسعار سوق حقيقية — لا تُخلط بنتائج حقيقية.' : 'All numbers are simulated (paper) at real prices — never mixed with live results.')}
      </DangerNote>

      <Card title={<span>{ar ? 'منحنى الأرباح المحقّقة' : 'Realized equity curve'} {!live && <SimulatedBadge />}</span>}
        right={<span className="muted fs-xs">{closedR.length} {ar ? 'مركز مغلق' : 'closed positions'}</span>}>
        {equity.length <= 1
          ? <EmptyState message={ar ? 'لا مراكز مغلقة بعد — يُبنى المنحنى من الأرباح المحقّقة الفعلية' : 'No closed positions yet — the curve builds from real realized P&L'} />
          : <MiniChart data={equity} tone={equity[equity.length - 1] >= 0 ? 'pos' : 'neg'} height={120} label={ar ? `محقّق تراكمي · ${closedR.length} مركز` : `cumulative realized · ${closedR.length} positions`} />}
      </Card>

      <div className="workspace">
        <Card title={<span>{ar ? 'الأداء حسب التوكن' : 'Performance by token'} {!live && <SimulatedBadge />}</span>}>
          {byToken.length === 0 ? (
            <EmptyState message={ar ? 'لا صفقات بعد — تتراكم البيانات مع نشاط القادة المتابَعين' : 'No trades yet — data accumulates as followed leaders act'} />
          ) : (
            <div className="table-wrap">
              <table className="data">
                <thead><tr><th className="nosort">token</th><th className="nosort trend-col">{ar ? 'الاتجاه' : 'trend'}</th><th className="nosort num">{ar ? 'صفقات' : 'trades'}</th><th className="nosort num">{ar ? 'شراء' : 'buys'}</th><th className="nosort num">{ar ? 'بيع' : 'sells'}</th><th className="nosort num">net</th></tr></thead>
                <tbody>
                  {byToken.map((e) => (
                    <tr key={e.mint}>
                      <td className="mono" dir="ltr">{shortMint(e.mint)}</td>
                      <td className="trend-col"><Sparkline seed={e.mint} tone={e.net >= 0 ? 'pos' : 'neg'} bias={e.net >= 0 ? 1 : -1} width={62} height={20} /></td>
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
          <Card title={ar ? 'الأداء حسب القائد' : 'Performance by leader'}
            right={<Link to="/wallets" className="mono fs-xs">{ar ? 'الكل ←' : 'all →'}</Link>}>
            {byLeader.length === 0 ? <p className="muted">{ar ? 'لا بيانات قادة بعد' : 'No leader data yet'}</p> : (
              <table className="data">
                <thead><tr><th className="nosort">{ar ? 'القائد' : 'leader'}</th><th className="nosort num">win%</th><th className="nosort num">PF</th><th className="nosort num">PnL</th></tr></thead>
                <tbody>
                  {byLeader.map((l) => (
                    <tr key={l.wallet_id}>
                      <td><span className="lab">{l.label || shortMint(l.leader)}</span> <Badge tone={l.recommendation === 'follow' ? 'ok' : l.recommendation === 'drop' ? 'danger' : 'warn'} className="sm">{l.recommendation}</Badge></td>
                      <td className="num mono">{(l.win_rate * 100).toFixed(0)}%</td>
                      <td className="num mono">{l.profit_factor == null ? '∞' : l.profit_factor}</td>
                      <td className="num mono" style={{ color: l.total_realized_usd >= 0 ? 'var(--c-ok)' : 'var(--c-danger)' }}>{l.total_realized_usd >= 0 ? '+' : ''}${l.total_realized_usd}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </Card>

          <Card title={<span>{ar ? 'آخر الصفقات' : 'Recent trades'} {!live && <SimulatedBadge />}</span>}>
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
