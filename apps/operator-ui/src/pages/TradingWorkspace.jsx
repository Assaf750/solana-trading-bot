import { useEffect, useMemo, useState } from 'react';
import { useI18n } from '../i18n/index.jsx';
import PageHead from '../components/PageHead.jsx';
import { Card, Badge, DangerNote, EmptyState, SimulatedBadge, Sparkline, MiniChart, FlashValue } from '../components/index.jsx';
import { api } from '../api/client.js';
import { useBackend } from '../api/useBackend.jsx';

const usd = (v) => `$${Number(v ?? 0).toFixed(2)}`;
const shortMint = (m) => `${String(m).slice(0, 4)}…${String(m).slice(-4)}`;
const ago = (ts) => {
  if (!ts) return '—';
  const s = Math.max(0, (Date.now() - new Date(ts).getTime()) / 1000);
  if (s < 60) return `${Math.round(s)}s`;
  if (s < 3600) return `${Math.round(s / 60)}m`;
  if (s < 86400) return `${Math.round(s / 3600)}h`;
  return `${Math.round(s / 86400)}d`;
};

export default function TradingWorkspace() {
  const { t, lang } = useI18n();
  const ar = lang === 'ar';
  const { status, connected } = useBackend();
  const [positions, setPositions] = useState([]);
  const [summary, setSummary] = useState(null);
  const [trades, setTrades] = useState([]);
  const [events, setEvents] = useState([]);
  const [selectedId, setSelectedId] = useState(null);
  const [posFilter, setPosFilter] = useState('open'); // open | closed | all
  const [latency, setLatency] = useState(null);
  const [intents, setIntents] = useState([]);

  const live = status?.mode === 'real_live';

  async function load() {
    const ev = await api.engineEvents();
    if (ev.ok) setEvents((ev.data.events || []).slice().reverse());
    const [lat, intn] = await Promise.all([api.latency(), api.intents()]);
    if (lat.ok) setLatency(lat.data || null);
    if (intn.ok) setIntents((intn.data.intents || []).slice().reverse());
    // REAL-LIVE -> show the real book; PAPER -> the simulated book
    if (live) {
      const lp = await api.livePositions();
      if (lp.ok) {
        setPositions(lp.data.positions || []);
        setSummary(lp.data.summary || null);
        setTrades((lp.data.trades || []).slice().reverse());
        if (!selectedId) {
          const open = (lp.data.positions || []).filter((x) => x.position_state === 'OPEN');
          if (open.length) setSelectedId(open[open.length - 1].position_id);
        }
      }
      return;
    }
    const [p, tr] = await Promise.all([api.positions(), api.trades()]);
    if (p.ok) {
      setPositions(p.data.positions || []);
      setSummary(p.data.summary || null);
      if (!selectedId) {
        const open = (p.data.positions || []).filter((x) => x.position_state === 'OPEN');
        if (open.length) setSelectedId(open[open.length - 1].position_id);
      }
    }
    if (tr.ok) setTrades((tr.data.trades || []).slice().reverse());
  }
  useEffect(() => {
    if (!connected) return undefined;
    setSelectedId(null);
    load();
    const iv = setInterval(load, 8000);
    return () => clearInterval(iv);
  }, [connected, live]);

  const view = useMemo(() => {
    let list = positions.slice().reverse();
    if (posFilter === 'open') list = list.filter((p) => p.position_state === 'OPEN');
    else if (posFilter === 'closed') list = list.filter((p) => p.position_state !== 'OPEN');
    return list;
  }, [positions, posFilter]);

  const selected = positions.find((p) => p.position_id === selectedId) || null;
  const selTrades = selected ? trades.filter((tr) => tr.position_id === selected.position_id) : [];

  if (!connected) {
    return (
      <div className="stack">
        <PageHead title={t('workspace.title')} sub={t('workspace.sub')} />
        <EmptyState message={ar ? 'الخادم غير متصل — شغّل START.bat' : 'Server offline — run START.bat'} />
      </div>
    );
  }

  const engine = status?.engine || {};
  const openCount = positions.filter((p) => p.position_state === 'OPEN').length;
  const engineTone = engine.paper_engine === 'active' ? 'ok'
    : ['connecting', 'no_followed_wallets', 'waiting_rpc_config', 'waiting_vault_unlock'].includes(engine.paper_engine) ? 'warn' : 'danger';
  const engineHint = {
    waiting_vault_unlock: ar ? 'افتح الخزنة (محافظي والأموال)' : 'Unlock the vault (My Wallets & Funds)',
    waiting_rpc_config: ar ? 'أدخل مفتاح RPC (محافظي والأموال)' : 'Enter your RPC key (My Wallets & Funds)',
    no_followed_wallets: ar ? 'فعّل متابعة محفظة (كونسول المحافظ)' : 'Enable follow on a wallet (Wallet Workspace)',
    paused_by_operator: ar ? 'النظام موقوف — استأنف من التنبيهات' : 'Paused — resume from Alerts',
    stopped_killed: ar ? 'مفتاح الإيقاف مفعّل' : 'Kill switch engaged',
    exits_only_stream_gap: ar ? 'انقطاع بث — خروج فقط حتى يعود' : 'Stream gap — exits only until recovery',
  }[engine.paper_engine];

  return (
    <div className="stack">
      <PageHead title={ar ? 'مساحة التداول' : 'Trading Workspace'} sub={ar ? 'مراكز حيّة بأسعار حقيقية · قرارات المحرك لحظياً' : 'Live positions at real prices · engine decisions as they happen'} />

      <div className="kpi-strip">
        <div className="stattile"><span className="lbl">{ar ? 'المحرّك' : 'Engine'}</span><span className="val" style={{ fontSize: 'var(--fs-md)' }}><Badge tone={engineTone}>{engine.paper_engine || '—'}</Badge></span></div>
        <div className="stattile"><span className="lbl">{ar ? 'مراكز مفتوحة' : 'Open positions'}</span><span className="val">{openCount}</span></div>
        <div className="stattile"><span className="lbl">{ar ? 'محقّق' : 'Realized'} {!live && <SimulatedBadge />}</span><span className={`val ${(summary?.realized_pnl_usd ?? 0) >= 0 ? 'pos' : 'neg'}`}>{usd(summary?.realized_pnl_usd)}</span></div>
        <div className="stattile"><span className="lbl">{ar ? 'غير محقّق' : 'Unrealized'} {!live && <SimulatedBadge />}</span><span className={`val ${(summary?.unrealized_pnl_usd ?? 0) >= 0 ? 'pos' : 'neg'}`}>{usd(summary?.unrealized_pnl_usd)}</span></div>
        <div className="stattile"><span className="lbl">{ar ? 'اليوم' : 'Today'}</span><span className={`val ${(summary?.daily_realized_pnl_usd ?? 0) >= 0 ? 'pos' : 'neg'}`}>{usd(summary?.daily_realized_pnl_usd)}</span></div>
        <div className="stattile"><span className="lbl">{ar ? 'صفقات' : 'Trades'}</span><span className="val">{summary?.trade_count ?? 0}</span></div>
      </div>

      {engineHint && <DangerNote tone="warn">{engineHint}</DangerNote>}
      {summary?.entries_blocked && (
        <DangerNote tone="danger" locked>{ar ? 'حد الخسارة اليومي مضروب — لا دخول جديد اليوم (خروج فقط)' : 'Daily loss limit hit — no new entries today (exits only)'}</DangerNote>
      )}

      <div className="filterbar">
        <label>{ar ? 'المراكز' : 'Positions'}</label>
        <div className="seg">
          {['open', 'closed', 'all'].map((f) => (
            <button key={f} className={posFilter === f ? 'on' : ''} onClick={() => setPosFilter(f)}>
              {ar ? { open: 'مفتوحة', closed: 'مغلقة', all: 'الكل' }[f] : f}
            </button>
          ))}
        </div>
        <span className="topbar-spacer" />
        <span className="muted fs-xs">{ar ? `${view.length} مركز` : `${view.length} positions`}</span>
      </div>

      <div className="workspace">
        <div className="stack" style={{ gap: 'var(--s-3)' }}>
          <div className="wlist has-trend">
            <div className="wlist-head">
              <span>token / leader</span><span className="trend-col">{ar ? 'الاتجاه' : 'trend'}</span><span>state</span>
              <span className="num">cost</span><span className="num">mark</span><span className="num">P&L</span><span>TP/SL</span>
            </div>
            {view.length === 0 && (
              <div style={{ padding: 18 }} className="muted">
                {posFilter === 'open'
                  ? (ar ? 'لا مراكز مفتوحة — تُفتح تلقائياً عند شراء قائد متابَع' : 'No open positions — they open automatically when a followed leader buys')
                  : (ar ? 'لا شيء هنا بعد' : 'Nothing here yet')}
              </div>
            )}
            {view.map((p) => {
              const mark = p.mark_status === 'valid' ? p.mark_usd : null;
              const pnl = (mark ?? p.cost_usd) - p.cost_usd;
              const pnlPct = p.cost_usd > 0 ? (pnl / p.cost_usd) * 100 : 0;
              return (
                <div key={p.position_id} className={`wrow ${selectedId === p.position_id ? 'sel' : ''}`}
                  role="button" tabIndex={0} aria-pressed={selectedId === p.position_id}
                  aria-label={`${ar ? 'افحص مركز' : 'inspect position'} ${shortMint(p.token_mint)}`}
                  onClick={() => setSelectedId(p.position_id)}
                  onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); setSelectedId(p.position_id); } }}>
                  <span className="wname">
                    <span className="lab mono" dir="ltr">{shortMint(p.token_mint)}</span>
                    <span className="addr" dir="ltr">{ar ? 'قائد' : 'leader'} {shortMint(p.leader_address)} · {ago(p.entry_ts)}</span>
                  </span>
                  <span className="trend-cell">
                    <Sparkline data={p.mark_history} seed={p.token_mint} tone={mark == null ? 'muted' : pnl >= 0 ? 'pos' : 'neg'} bias={mark == null ? 0 : pnl >= 0 ? 1.1 : -1.1} width={66} height={22} />
                  </span>
                  <span><Badge tone={p.position_state === 'OPEN' ? 'ok' : 'neutral'}>{p.position_state === 'OPEN' ? 'OPEN' : 'CLOSED'}</Badge></span>
                  <span className="num">{usd(p.cost_usd)}</span>
                  <span className="num">{mark != null ? usd(mark) : <span className="faint">{ar ? 'غير متوفر' : 'n/a'}</span>}</span>
                  <span className="num" style={{ color: pnl >= 0 ? 'var(--c-ok)' : 'var(--c-danger)' }}>
                    {p.position_state === 'OPEN' ? `${pnl >= 0 ? '+' : ''}${pnlPct.toFixed(1)}%` : '—'}
                  </span>
                  <span className="mono faint fs-xs">+{p.tp_pct}/-{p.sl_pct}</span>
                </div>
              );
            })}
          </div>

          <Card title={ar ? 'قرارات المحرك الحية' : 'Live engine decisions'}>
            {events.length === 0 ? <EmptyState message={ar ? 'لا أحداث بعد' : 'No events yet'} /> : (
              <ul style={{ listStyle: 'none', padding: 0, margin: 0, maxHeight: 300, overflow: 'auto' }}>
                {events.slice(0, 40).map((e, i) => (
                  <li key={i} style={{ padding: '5px 0', borderBottom: '1px solid var(--c-border)', display: 'flex', gap: 8, alignItems: 'baseline', flexWrap: 'wrap' }}>
                    <span className="mono faint" dir="ltr" style={{ fontSize: 'var(--fs-xs)' }}>{(e.ts || '').slice(11, 19)}</span>
                    <Badge tone={e.kind?.includes('rejected') || e.kind?.includes('gap') || e.kind?.includes('refused') ? 'danger' : e.kind?.includes('exit') ? 'warn' : e.kind?.includes('entry') ? 'ok' : 'info'}>{e.kind}</Badge>
                    {e.mint && <span className="mono" dir="ltr" style={{ fontSize: 'var(--fs-xs)' }}>{shortMint(e.mint)}</span>}
                    {e.size_usd != null && <span className="mono fs-xs">{usd(e.size_usd)}</span>}
                    {e.rejections && <span className="mono neg fs-xs">{e.rejections.join(' · ')}</span>}
                  </li>
                ))}
              </ul>
            )}
          </Card>
        </div>

        <div className="detail-pane stack" style={{ gap: 'var(--s-3)' }}>
          {!selected ? (
            <EmptyState message={ar ? 'اختر مركزاً لعرض تفاصيله' : 'Select a position to inspect'} />
          ) : (
            <>
              <Card
                title={<span className="mono" dir="ltr">{shortMint(selected.token_mint)}</span>}
                right={<Badge tone={selected.position_state === 'OPEN' ? 'ok' : 'neutral'}>{selected.position_state}</Badge>}
              >
                {(() => {
                  const mark = selected.mark_status === 'valid' ? selected.mark_usd : null;
                  const pnl = (mark ?? selected.cost_usd) - selected.cost_usd;
                  const pnlPct = selected.cost_usd > 0 ? (pnl / selected.cost_usd) * 100 : 0;
                  return (
                    <div className="kpi-strip" style={{ margin: 0, gridTemplateColumns: 'repeat(2, 1fr)' }}>
                      <div className="stattile"><span className="lbl">{ar ? 'التكلفة' : 'Cost'}</span><span className="val" style={{ fontSize: 'var(--fs-lg)' }}>{usd(selected.cost_usd)}</span></div>
                      <div className="stattile"><span className="lbl">mark</span><span className="val" style={{ fontSize: 'var(--fs-lg)' }}>{mark != null ? usd(mark) : (ar ? 'غير متوفر' : 'n/a')}</span></div>
                      <div className="stattile"><span className="lbl">P&L</span><span className={`val ${pnl >= 0 ? 'pos' : 'neg'}`} style={{ fontSize: 'var(--fs-lg)' }}>{selected.position_state === 'OPEN' ? `${usd(pnl)} (${pnlPct.toFixed(1)}%)` : '—'}</span></div>
                      <div className="stattile"><span className="lbl">TP / SL</span><span className="val" style={{ fontSize: 'var(--fs-lg)' }}>+{selected.tp_pct}% / -{selected.sl_pct}%</span></div>
                    </div>
                  );
                })()}
                {(() => {
                  const mk = selected.mark_status === 'valid' ? selected.mark_usd : null;
                  const dPnl = (mk ?? selected.cost_usd) - selected.cost_usd;
                  return (
                    <div style={{ marginBlockStart: 'var(--s-3)' }}>
                      <MiniChart data={selected.mark_history} seed={selected.token_mint} tone={mk == null ? 'muted' : dPnl >= 0 ? 'pos' : 'neg'} bias={mk == null ? 0 : dPnl >= 0 ? 0.8 : -0.8} height={64} points={48} label={ar ? `mark · ${selected.mark_history?.length || 0} نقطة حقيقية` : `mark · ${selected.mark_history?.length || 0} real ticks`} />
                    </div>
                  );
                })()}
                <dl className="kv" style={{ marginBlockStart: 'var(--s-3)' }}>
                  <dt>{ar ? 'الكمية' : 'qty'}</dt><dd className="mono" dir="ltr">{Number(selected.qty_ui).toLocaleString()}</dd>
                  <dt>{ar ? 'القائد' : 'leader'}</dt><dd className="mono" dir="ltr" style={{ fontSize: 'var(--fs-xs)' }}>{selected.leader_address}</dd>
                  <dt>mint</dt><dd className="mono" dir="ltr" style={{ fontSize: 'var(--fs-xs)', wordBreak: 'break-all' }}>{selected.token_mint}</dd>
                  <dt>{ar ? 'الدخول' : 'entered'}</dt><dd className="mono" dir="ltr">{(selected.entry_ts || '').replace('T', ' ').slice(0, 19)}</dd>
                  <dt>{ar ? 'النمط' : 'mode'}</dt><dd><Badge tone={selected.copy_mode === 'full_mirror' ? 'warn' : 'info'}>{selected.copy_mode}</Badge></dd>
                  <dt>mark status</dt><dd><Badge tone={selected.mark_status === 'valid' ? 'ok' : 'warn'}>{selected.mark_status}</Badge></dd>
                </dl>
              </Card>

              {selected.position_state === 'OPEN' && <PositionActions ar={ar} position={selected} onDone={load} />}

              <Card title={ar ? `صفقات المركز (${selTrades.length})` : `Position trades (${selTrades.length})`} right={!live && <SimulatedBadge />}>
                {selTrades.length === 0 ? <p className="muted">{ar ? 'لا صفقات' : 'No trades'}</p> : (
                  <table className="data"><tbody>
                    {selTrades.map((tr) => (
                      <tr key={tr.trade_id}>
                        <td><Badge tone={tr.side === 'buy' ? 'info' : 'warn'}>{tr.side}</Badge></td>
                        <td className="num mono">{usd(tr.value_usd)}</td>
                        <td className="mono faint fs-xs">{tr.reason}</td>
                        <td className="mono faint" dir="ltr" style={{ fontSize: 'var(--fs-xs)' }}>{(tr.ts || '').slice(11, 19)}</td>
                      </tr>
                    ))}
                  </tbody></table>
                )}
              </Card>
            </>
          )}
        </div>
      </div>

      <div className="grid cols-2">
        <Card title={ar ? 'زمن استجابة المسار' : 'Pipeline latency'} sub={ar ? 'p50 / p90 / p99 (مللي ثانية)' : 'p50 / p90 / p99 (ms)'}>
          {!latency || !latency.count ? <p className="muted">{ar ? 'لا عيّنات بعد' : 'No samples yet'}</p> : (
            <table className="data">
              <thead><tr><th className="nosort">metric</th><th className="nosort num">p50</th><th className="nosort num">p90</th><th className="nosort num">p99</th><th className="nosort num">max</th></tr></thead>
              <tbody>
                {Object.entries(latency.metrics || {}).map(([m, s]) => (
                  <tr key={m}><td className="mono fs-xs">{m}</td><td className="num mono">{s.p50}</td><td className="num mono">{s.p90}</td><td className="num mono">{s.p99}</td><td className="num mono">{s.max}</td></tr>
                ))}
              </tbody>
            </table>
          )}
          <p className="faint fs-xs" style={{ marginBlockStart: 6 }}>{ar ? `العيّنات: ${latency?.count ?? 0} · ingestion_lag على مسار logsSubscribe فقط` : `samples: ${latency?.count ?? 0} · ingestion_lag only on the logsSubscribe path`}</p>
        </Card>
        <Card title={ar ? 'النوايا الحيّة' : 'Live intents'} sub={ar ? 'دورة حياة معاملات المال الحقيقي' : 'real-money tx lifecycle'}>
          {intents.length === 0 ? <p className="muted">{ar ? 'لا نوايا حيّة' : 'No live intents'}</p> : (
            <table className="data"><tbody>
              {intents.slice(0, 12).map((it) => (
                <tr key={it.intent_id}>
                  <td><Badge tone={it.status === 'CONFIRMED' ? 'ok' : String(it.status).startsWith('FAILED') ? 'danger' : String(it.status).includes('UNCONFIRMED') ? 'warn' : 'info'}>{it.status}</Badge></td>
                  <td className="mono faint fs-xs" dir="ltr">{String(it.signature || it.intent_id || '').slice(0, 12)}…</td>
                </tr>
              ))}
            </tbody></table>
          )}
        </Card>
      </div>

      <DangerNote tone={live ? 'danger' : 'info'}>
        {live
          ? (ar ? '🔴 وضع حقيقي — هذه مراكز وصفقات بمالك الحقيقي على السلسلة. زر الإيقاف في التنبيهات يوقف كل شيء فوراً.'
                : '🔴 REAL-LIVE — these are real positions/trades with your funds on-chain. The kill switch on Alerts stops everything instantly.')
          : (ar ? 'كل الأرقام من أسعار سوق حقيقية (Jupiter) — الأموال محاكاة في وضع الورق، ولا يُرسل شيء على السلسلة.'
                : 'All numbers come from real market prices (Jupiter) — money is simulated in paper mode; nothing is sent on-chain.')}
      </DangerNote>
    </div>
  );
}

// Operator actions on an OPEN position: manual close, or resolve a needs_reconciliation position
// (book the real proceeds read off an explorer). Both confirm before acting.
function PositionActions({ ar, position, onDone }) {
  const flagged = Boolean(position.needs_reconciliation);
  const [proceeds, setProceeds] = useState('');
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState(null);

  async function close() {
    if (!window.confirm(ar ? 'إغلاق هذا المركز بسعر السوق الآن؟' : 'Close this position at market now?')) return;
    setBusy(true);
    const r = await api.closePosition(position.position_id);
    setBusy(false);
    if (r.ok && r.data?.ok) { setMsg({ tone: 'ok', text: ar ? 'أُغلق ✓' : 'Closed ✓' }); onDone?.(); }
    else setMsg({ tone: 'danger', text: r.data?.error || (ar ? 'فشل الإغلاق' : 'close failed') });
  }
  async function resolve() {
    const v = Number(proceeds);
    if (!Number.isFinite(v) || v < 0) { setMsg({ tone: 'danger', text: ar ? 'أدخل عائداً صحيحاً ($)' : 'Enter valid proceeds ($)' }); return; }
    setBusy(true);
    const r = await api.resolvePosition(position.position_id, v);
    setBusy(false);
    if (r.ok && r.data?.ok) { setMsg({ tone: 'ok', text: ar ? 'سُوِّيت ✓' : 'Resolved ✓' }); onDone?.(); }
    else setMsg({ tone: 'danger', text: r.data?.error || (ar ? 'فشلت التسوية' : 'resolve failed') });
  }

  return (
    <Card title={ar ? 'إجراءات المركز' : 'Position actions'}>
      {flagged ? (
        <div className="stack" style={{ gap: 'var(--s-2)' }}>
          <DangerNote tone="warn" locked>
            {ar ? 'هذا المركز يحتاج تسوية يدوية: خروجه تأكّد على السلسلة لكن العائد غير مقروء. أدخل العائد الفعلي بالدولار من المستكشف.'
                : 'This position needs manual reconciliation: its exit confirmed on-chain but the proceeds were unreadable. Enter the real USD proceeds from an explorer.'}
          </DangerNote>
          <div className="row">
            <input className="search" type="number" inputMode="decimal" placeholder={ar ? 'العائد بالدولار' : 'proceeds (USD)'} value={proceeds} onChange={(e) => setProceeds(e.target.value)} dir="ltr" />
            <button className="btn primary" onClick={resolve} disabled={busy}>{ar ? 'تسوية المركز' : 'Resolve position'}</button>
          </div>
        </div>
      ) : (
        <div className="row">
          <button className="btn danger" onClick={close} disabled={busy}>{ar ? 'إغلاق المركز الآن' : 'Close position now'}</button>
          <span className="muted fs-xs">{ar ? 'تصفية يدوية مستقلة عن TP/SL/القائد' : 'manual liquidation, independent of TP/SL/leader'}</span>
        </div>
      )}
      {msg && <div style={{ marginBlockStart: 8 }}><Badge tone={msg.tone}>{msg.text}</Badge></div>}
    </Card>
  );
}
