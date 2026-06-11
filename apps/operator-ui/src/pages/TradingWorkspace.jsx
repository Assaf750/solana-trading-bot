import { useEffect, useState } from 'react';
import { useI18n } from '../i18n/index.jsx';
import PageHead from '../components/PageHead.jsx';
import { Card, Metric, Badge, DangerNote, EmptyState, SimulatedBadge } from '../components/index.jsx';
import { api } from '../api/client.js';
import { useBackend } from '../api/useBackend.jsx';

const usd = (v) => `$${Number(v ?? 0).toFixed(2)}`;
const shortMint = (m) => `${String(m).slice(0, 4)}…${String(m).slice(-4)}`;

export default function TradingWorkspace() {
  const { t, lang } = useI18n();
  const ar = lang === 'ar';
  const { status, connected } = useBackend();
  const [positions, setPositions] = useState([]);
  const [summary, setSummary] = useState(null);
  const [trades, setTrades] = useState([]);
  const [events, setEvents] = useState([]);

  async function load() {
    const [p, tr, ev] = await Promise.all([api.positions(), api.trades(), api.engineEvents()]);
    if (p.ok) { setPositions(p.data.positions || []); setSummary(p.data.summary || null); }
    if (tr.ok) setTrades((tr.data.trades || []).slice().reverse());
    if (ev.ok) setEvents((ev.data.events || []).slice().reverse());
  }
  useEffect(() => {
    if (!connected) return undefined;
    load();
    const iv = setInterval(load, 8000);
    return () => clearInterval(iv);
  }, [connected]);

  if (!connected) {
    return (
      <div className="stack">
        <PageHead title={t('workspace.title')} sub={t('workspace.sub')} />
        <EmptyState message={ar ? 'الخادم غير متصل — شغّل START.bat' : 'Server offline — run START.bat'} />
      </div>
    );
  }

  const engine = status?.engine || {};
  const open = positions.filter((p) => p.position_state === 'OPEN');
  const engineTone = engine.paper_engine === 'active' ? 'ok'
    : ['connecting', 'no_followed_wallets', 'waiting_rpc_config', 'waiting_vault_unlock'].includes(engine.paper_engine) ? 'warn' : 'danger';
  const engineHint = {
    waiting_vault_unlock: ar ? 'افتح الخزنة من صفحة المحافظ والأموال' : 'Unlock the vault on My Wallets & Funds',
    waiting_rpc_config: ar ? 'أدخل مفتاح RPC من صفحة المحافظ والأموال' : 'Enter your RPC key on My Wallets & Funds',
    no_followed_wallets: ar ? 'سجّل محفظة وفعّل المتابعة من صفحة ذكاء المحافظ' : 'Register a wallet and enable follow on Wallet Intelligence',
    paused_by_operator: ar ? 'النظام موقوف — استأنف من صفحة التنبيهات' : 'System paused — resume from Alerts',
    stopped_killed: ar ? 'مفتاح الإيقاف مفعّل' : 'Kill switch engaged',
    exits_only_stream_gap: ar ? 'انقطاع البث — خروج فقط حتى يعود' : 'Stream gap — exits only until it recovers',
  }[engine.paper_engine];

  return (
    <div className="stack">
      <PageHead title={t('workspace.title')} sub={ar ? 'التداول الورقي الحي — أسعار حقيقية، أموال محاكاة' : 'Live paper trading — real prices, simulated money'} />

      <Card title={ar ? 'محرك الورق' : 'Paper engine'} right={<Badge tone={engineTone}>{engine.paper_engine || '—'}</Badge>}>
        <div className="row" style={{ flexWrap: 'wrap', gap: 'var(--s-4)' }}>
          <Metric label={ar ? 'محافظ متابَعة' : 'followed'} value={engine.followed_wallets ?? 0} mono />
          <Metric label={ar ? 'مراكز مفتوحة' : 'open positions'} value={summary?.open_positions ?? 0} mono />
          <Metric label={<span>{ar ? 'ربح محقق' : 'realized P&L'} <SimulatedBadge /></span>} value={usd(summary?.realized_pnl_usd)} mono tone={(summary?.realized_pnl_usd ?? 0) >= 0 ? 'ok' : 'danger'} />
          <Metric label={<span>{ar ? 'ربح غير محقق' : 'unrealized'} <SimulatedBadge /></span>} value={usd(summary?.unrealized_pnl_usd)} mono tone={(summary?.unrealized_pnl_usd ?? 0) >= 0 ? 'ok' : 'danger'} />
          <Metric label={ar ? 'اليوم' : 'today'} value={usd(summary?.daily_realized_pnl_usd)} mono />
        </div>
        {engineHint && <DangerNote tone="warn">{engineHint}</DangerNote>}
        {summary?.entries_blocked && (
          <DangerNote tone="danger" locked>{ar ? 'حد الخسارة اليومي مضروب — لا دخول جديد اليوم (خروج فقط)' : 'Daily loss limit hit — no new entries today (exits only)'}</DangerNote>
        )}
      </Card>

      <Card title={ar ? `المراكز المفتوحة (${open.length})` : `Open positions (${open.length})`} right={<SimulatedBadge />}>
        {open.length === 0 ? (
          <EmptyState message={ar ? 'لا مراكز مفتوحة — تُفتح تلقائياً عند شراء قائد متابَع' : 'No open positions — they open automatically when a followed leader buys'} />
        ) : (
          <div className="table-wrap">
            <table className="data">
              <thead>
                <tr>
                  <th className="nosort">token</th>
                  <th className="nosort">{ar ? 'القائد' : 'leader'}</th>
                  <th className="nosort">{ar ? 'التكلفة' : 'cost'}</th>
                  <th className="nosort">mark</th>
                  <th className="nosort">P&L</th>
                  <th className="nosort">TP/SL</th>
                </tr>
              </thead>
              <tbody>
                {open.map((p) => {
                  const pnl = (p.mark_status === 'valid' ? p.mark_usd : p.cost_usd) - p.cost_usd;
                  const pnlPct = p.cost_usd > 0 ? (pnl / p.cost_usd) * 100 : 0;
                  return (
                    <tr key={p.position_id}>
                      <td className="mono" dir="ltr">{shortMint(p.token_mint)}</td>
                      <td className="mono" dir="ltr">{shortMint(p.leader_address)}</td>
                      <td className="num mono">{usd(p.cost_usd)}</td>
                      <td className="num mono">
                        {p.mark_status === 'valid' ? usd(p.mark_usd) : <Badge tone="warn">{ar ? 'غير متوفر' : 'unavailable'}</Badge>}
                      </td>
                      <td className="num mono" style={{ color: pnl >= 0 ? 'var(--c-ok, #46a758)' : 'var(--c-danger, #e5484d)' }}>
                        {usd(pnl)} ({pnlPct.toFixed(1)}%)
                      </td>
                      <td className="mono" style={{ fontSize: 'var(--fs-xs)' }}>+{p.tp_pct}% / -{p.sl_pct}%</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      <div className="grid cols-2">
        <Card title={ar ? 'الصفقات الأخيرة' : 'Recent trades'} right={<SimulatedBadge />}>
          {trades.length === 0 ? <EmptyState message={ar ? 'لا صفقات بعد' : 'No trades yet'} /> : (
            <div className="table-wrap">
              <table className="data">
                <thead><tr><th className="nosort">side</th><th className="nosort">token</th><th className="nosort">value</th><th className="nosort">{ar ? 'السبب' : 'reason'}</th></tr></thead>
                <tbody>
                  {trades.slice(0, 20).map((tr) => (
                    <tr key={tr.trade_id}>
                      <td><Badge tone={tr.side === 'buy' ? 'info' : 'warn'}>{tr.side}</Badge></td>
                      <td className="mono" dir="ltr">{shortMint(tr.token_mint)}</td>
                      <td className="num mono">{usd(tr.value_usd)}</td>
                      <td className="mono faint" style={{ fontSize: 'var(--fs-xs)' }}>{tr.reason}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </Card>

        <Card title={ar ? 'أحداث المحرك (قرارات + رفض)' : 'Engine events (decisions + rejections)'}>
          {events.length === 0 ? <EmptyState message={ar ? 'لا أحداث بعد' : 'No events yet'} /> : (
            <ul style={{ listStyle: 'none', padding: 0, margin: 0, maxHeight: 360, overflow: 'auto' }}>
              {events.slice(0, 30).map((e, i) => (
                <li key={i} style={{ padding: '5px 0', borderBottom: '1px solid var(--c-border)' }}>
                  <span className="mono faint" dir="ltr" style={{ fontSize: 'var(--fs-xs)' }}>{(e.ts || '').slice(11, 19)}</span>{' '}
                  <Badge tone={e.kind?.includes('rejected') || e.kind?.includes('gap') ? 'danger' : e.kind?.includes('exit') ? 'warn' : 'info'}>{e.kind}</Badge>{' '}
                  {e.rejections && <span className="mono" style={{ fontSize: 'var(--fs-xs)' }}>{e.rejections.join(' · ')}</span>}
                  {e.size_usd != null && <span className="mono" style={{ fontSize: 'var(--fs-xs)' }}>{usd(e.size_usd)}</span>}
                </li>
              ))}
            </ul>
          )}
        </Card>
      </div>

      <DangerNote tone="info">
        {ar
          ? 'كل الأرقام هنا من أسعار سوق حقيقية (Jupiter quotes) لكن الأموال محاكاة — لا يُرسل أي أمر على السلسلة في وضع الورق.'
          : 'All numbers come from real market prices (Jupiter quotes) but the money is simulated — nothing is sent on-chain in paper mode.'}
      </DangerNote>
    </div>
  );
}
