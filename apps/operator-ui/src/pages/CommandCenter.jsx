import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useI18n } from '../i18n/index.jsx';
import PageHead from '../components/PageHead.jsx';
import { Card, Badge, DangerNote, EmptyState, Sparkline, FlashValue } from '../components/index.jsx';
import { api } from '../api/client.js';
import { useBackend } from '../api/useBackend.jsx';

const usd = (v) => `$${Number(v ?? 0).toFixed(2)}`;
const shortMint = (m) => `${String(m).slice(0, 4)}…${String(m).slice(-4)}`;

export default function CommandCenter() {
  const { lang } = useI18n();
  const ar = lang === 'ar';
  const { status, connected, refresh } = useBackend();
  const nav = useNavigate();
  const [events, setEvents] = useState([]);
  const [summary, setSummary] = useState(null);
  const [positions, setPositions] = useState([]);
  const [insights, setInsights] = useState(null);
  const [cfg, setCfg] = useState(null);
  const [busy, setBusy] = useState(false);

  const live = status?.mode === 'real_live';
  async function load() {
    const [ev, ins, cf] = await Promise.all([api.engineEvents(), api.leaderInsights(), api.config()]);
    if (ev.ok) setEvents((ev.data.events || []).slice().reverse());
    if (ins.ok) setInsights(ins.data || null);
    if (cf.ok) setCfg(cf.data || null);
    const p = live ? await api.livePositions() : await api.positions();
    if (p.ok) { setSummary(p.data.summary || null); setPositions(p.data.positions || []); }
  }
  useEffect(() => {
    if (!connected) return undefined;
    load();
    const iv = setInterval(load, 8000);
    return () => clearInterval(iv);
  }, [connected, live]);

  if (!connected) {
    return (
      <div className="stack">
        <PageHead title={ar ? 'مركز القيادة' : 'Mission Control'} sub={ar ? 'الحالة الحية للنظام من الخادم المحلي' : 'Live system state from the local server'} />
        <DangerNote tone="danger" locked>
          {ar ? 'الخادم المحلي غير متصل. شغّل START.bat ثم أعد تحميل الصفحة.' : 'Local server offline. Run START.bat, then reload.'}
        </DangerNote>
        <EmptyState message={ar ? 'لا بيانات بدون الخادم — لا شيء يُختلق' : 'No data without the server — nothing is fabricated'} />
      </div>
    );
  }

  const op = status.operating_state || {};
  const readiness = status.readiness || {};
  const signer = status.signer || {};
  const vault = status.vault || {};
  const ks = status.kill_switch || {};
  const engine = status.engine || {};
  const globalKill = ks.global?.engaged !== false;
  const opTone = op.operating_state === 'ACTIVE' ? 'ok' : op.operating_state === 'KILLED' ? 'danger' : 'warn';

  const open = positions.filter((p) => p.position_state === 'OPEN');
  const recs = (insights?.leaders || []).filter((l) => l.trades > 0).slice(0, 6);

  const steps = [
    { done: vault.vault_exists, label: ar ? 'إنشاء الخزنة' : 'Create vault', to: '/funds' },
    { done: Boolean(status.config_version > 1), label: ar ? 'حدود المخاطر' : 'Risk limits', to: '/settings' },
    { done: !readiness.blockers?.some((b) => b.blocker === 'rpc_provider_not_configured'), label: ar ? 'مفتاح RPC' : 'RPC key', to: '/funds' },
    { done: engine.followed_wallets > 0, label: ar ? 'متابعة محفظة' : 'Follow a wallet', to: '/wallets' },
  ];
  const doneCount = steps.filter((s) => s.done).length;
  const setupComplete = doneCount === steps.length;

  // active protections / strategy — surfaced from config so the operator SEES what's on
  const cd = cfg?.copy_defaults || {}; const ex = cfg?.execution || {}; const pv = cfg?.providers || {}; const sf = cfg?.safety || {};
  const onN = (v) => Number.isFinite(v) && v > 0;
  const chips = cfg ? [
    { on: sf.enabled !== false, label: ar ? 'حماية rug' : 'anti-rug', v: sf.enabled !== false ? (ar ? 'مفعّل' : 'on') : (ar ? 'مطفأ' : 'off') },
    { on: onN(cd.max_entry_drift_pct), label: ar ? 'حارس الانحراف' : 'drift guard', v: onN(cd.max_entry_drift_pct) ? `${cd.max_entry_drift_pct}% · ${cd.drift_action || 'skip'}` : (ar ? 'مطفأ' : 'off') },
    { on: Boolean(cd.exit_on_leader_sell), label: ar ? 'خروج عند بيع القائد' : 'leader-sell exit', v: cd.exit_on_leader_sell ? (ar ? 'مفعّل' : 'on') : (ar ? 'مطفأ' : 'off') },
    { on: onN(cd.auto_pause_after_losses), label: ar ? 'إيقاف تلقائي' : 'auto-pause', v: onN(cd.auto_pause_after_losses) ? `${cd.auto_pause_after_losses} ${ar ? 'خسائر' : 'losses'}` : (ar ? 'مطفأ' : 'off') },
    { on: (cfg.ev?.ev_gate_mode) === 'strict', label: ar ? 'بوّابة EV' : 'EV gate', v: cfg.ev?.ev_gate_mode || 'strict' },
    { on: Boolean(pv.grpc_url_ref), label: ar ? 'الاستقبال' : 'ingest', v: pv.grpc_url_ref ? 'gRPC' : 'WebSocket' },
    { on: (ex.submit_backend) === 'jito', label: ar ? 'الإرسال' : 'submit', v: ex.submit_backend || 'rpc' },
    { on: (ex.signer_backend) === 'rust', label: ar ? 'الموقّع' : 'signer', v: ex.signer_backend || 'node' },
  ] : [];

  async function doKill() {
    if (!window.confirm(ar ? 'إيقاف كل التداول فوراً؟' : 'Halt ALL trading now?')) return;
    setBusy(true); await api.triggerKill('global', null, 'operator manual stop'); setBusy(false); refresh(); load();
  }
  async function doDisengage() {
    setBusy(true); await api.killDisengage('global', null, 'DISENGAGE'); setBusy(false); refresh(); load();
  }

  return (
    <div className="stack">
      <PageHead title={ar ? 'مركز القيادة' : 'Mission Control'} sub={ar ? 'كل ما تحتاجه في شاشة واحدة — الحالة الحية، التوصيات، المراكز، والإجراءات.' : 'Everything in one screen — live state, recommendations, positions, and actions.'} />

      {globalKill && (
        <DangerNote tone="danger" locked>
          {ar ? 'مفتاح الإيقاف مفعّل — كل التداول موقوف.' : 'Kill switch ENGAGED — all trading halted.'}
        </DangerNote>
      )}

      {/* quick actions — the core verbs, always one click (benchmark: action-first terminals) */}
      <div className="filterbar" style={{ marginBlockEnd: 0 }}>
        <span className="muted fs-xs" style={{ fontWeight: 700, letterSpacing: '.06em', textTransform: 'uppercase' }}>{ar ? 'إجراءات' : 'Actions'}</span>
        <button className="btn primary" onClick={() => nav('/radar')}>◎ {ar ? 'اكتشاف محافظ' : 'Discover wallets'}</button>
        <button className="btn" onClick={() => nav('/workspace')}>▤ {ar ? 'المراكز الحية' : 'Live positions'}</button>
        <button className="btn" onClick={() => nav('/wallets')}>◇ {ar ? 'القادة' : 'Leaders'}</button>
        <button className="btn" onClick={() => nav('/settings')}>⚙ {ar ? 'الاستراتيجية والأمان' : 'Strategy & safety'}</button>
        <span className="topbar-spacer" />
        {globalKill
          ? <button className="btn" onClick={doDisengage} disabled={busy}>{ar ? 'فكّ الإيقاف' : 'Disengage kill'}</button>
          : <button className="btn danger" onClick={doKill} disabled={busy}>⛔ {ar ? 'إيقاف فوري' : 'Kill switch'}</button>}
      </div>

      <div className="kpi-strip">
        <div className="stattile"><span className="lbl">{ar ? 'الحالة' : 'State'}</span><span className="val" style={{ fontSize: 'var(--fs-md)' }}><Badge tone={opTone}>{op.operating_state}</Badge></span><span className="sub">{ar ? 'الوضع' : 'mode'}: {status.mode}</span></div>
        <div className="stattile"><span className="lbl">{ar ? 'المحرّك' : 'Engine'}</span><span className="val" style={{ fontSize: 'var(--fs-md)' }}>{engine.paper_engine || '—'}</span><span className="sub">{engine.followed_wallets ?? 0} {ar ? 'متابَعة' : 'followed'}</span></div>
        <div className="stattile">
          <span className="lbl">{ar ? 'محقّق اليوم' : 'Realized today'}</span>
          <FlashValue className={`val ${(summary?.daily_realized_pnl_usd ?? 0) >= 0 ? 'pos' : 'neg'}`} value={Number(summary?.daily_realized_pnl_usd ?? 0)} format={usd} />
          <Sparkline seed="realized-today" tone={(summary?.daily_realized_pnl_usd ?? 0) >= 0 ? 'pos' : 'neg'} bias={(summary?.daily_realized_pnl_usd ?? 0) >= 0 ? 1 : -1} width={130} height={26} points={32} />
        </div>
        <div className="stattile"><span className="lbl">{ar ? 'مفتوح' : 'Open'}</span><span className="val">{open.length}</span><span className="sub">{ar ? 'إجمالي محقّق' : 'total realized'}: {usd(summary?.realized_pnl_usd)}</span></div>
        <div className="stattile"><span className="lbl">{ar ? 'الخزنة' : 'Vault'}</span><span className="val" style={{ fontSize: 'var(--fs-md)' }}><Badge tone={vault.vault_unlocked ? 'ok' : vault.vault_exists ? 'warn' : 'danger'}>{vault.vault_unlocked ? (ar ? 'مفتوحة' : 'unlocked') : vault.vault_exists ? (ar ? 'مقفلة' : 'locked') : (ar ? 'غير منشأة' : 'none')}</Badge></span><span className="sub">signer: {signer.signer_status}</span></div>
        <div className="stattile"><span className="lbl">REAL-LIVE</span><span className="val" style={{ fontSize: 'var(--fs-md)' }}>{readiness.real_live_ready ? <Badge tone="warn">{ar ? 'بانتظارك' : 'awaiting you'}</Badge> : <Badge tone="danger">{ar ? 'محجوب' : 'blocked'}</Badge>}</span><span className="sub">{(readiness.blockers || []).length} {ar ? 'حاجز' : 'blockers'}</span></div>
      </div>

      {/* active strategy / protections — feature surfacing + a path to customize */}
      {cfg && (
        <Card title={<span>{ar ? 'الاستراتيجية والحمايات النشطة' : 'Active strategy & protections'}</span>}
          right={<Link to="/settings" className="mono fs-xs">{ar ? 'تخصيص ←' : 'customize →'}</Link>}>
          <div className="row" style={{ gap: 'var(--s-2)' }}>
            {chips.map((c) => (
              <span key={c.label} className={`badge ${c.on ? 'brand' : 'neutral'}`} title={c.label}>
                <span className="dot" />{c.label}: <b style={{ fontFamily: 'var(--mono)', marginInlineStart: 4 }}>{c.v}</b>
              </span>
            ))}
          </div>
        </Card>
      )}

      <div className="workspace">
        <div className="stack" style={{ gap: 'var(--s-3)' }}>
          <Card title={ar ? 'توصيات القادة' : 'Leader recommendations'}
            right={<Link to="/wallets" className="mono fs-xs">{ar ? 'الكل ←' : 'all →'}</Link>}>
            {recs.length === 0 ? (
              <EmptyState message={ar ? 'لا بيانات أداء بعد — تابع محافظ وادعها تتداول لتظهر التوصيات' : 'No performance data yet — follow wallets and let them trade to see ranked recommendations'} />
            ) : (
              <table className="data"><thead><tr>
                <th className="nosort">{ar ? 'القائد' : 'leader'}</th><th className="nosort">rec</th>
                <th className="nosort num">win%</th><th className="nosort num">PF</th><th className="nosort num">realized</th><th className="nosort"></th>
              </tr></thead><tbody>
                {recs.map((l) => (
                  <tr key={l.wallet_id}>
                    <td><span className="lab">{l.label || shortMint(l.leader)}</span></td>
                    <td><Badge tone={l.recommendation === 'follow' ? 'ok' : l.recommendation === 'drop' ? 'danger' : 'warn'}>{l.recommendation}</Badge></td>
                    <td className="num mono">{(l.win_rate * 100).toFixed(0)}%</td>
                    <td className="num mono">{l.profit_factor == null ? '∞' : l.profit_factor}</td>
                    <td className="num mono" style={{ color: l.total_realized_usd >= 0 ? 'var(--c-ok)' : 'var(--c-danger)' }}>{l.total_realized_usd >= 0 ? '+' : ''}${l.total_realized_usd}</td>
                    <td>{l.recommendation === 'drop' && l.follow_enabled && (
                      <button className="btn sm danger" onClick={async () => { await api.setFollow(l.wallet_id, false); load(); }}>{ar ? 'إيقاف' : 'unfollow'}</button>
                    )}</td>
                  </tr>
                ))}
              </tbody></table>
            )}
          </Card>

          <Card title={<span>{ar ? 'قرارات المحرك الحية' : 'Live engine tape'}</span>}>
            {events.length === 0 ? (
              <EmptyState message={ar ? 'لا أحداث بعد — تظهر عند نشاط القادة المتابَعين' : 'No events yet — they appear when followed leaders act'} />
            ) : (
              <ul style={{ listStyle: 'none', padding: 0, margin: 0, maxHeight: 320, overflow: 'auto' }}>
                {events.slice(0, 40).map((e, i) => (
                  <li key={i} style={{ padding: '6px 0', borderBottom: '1px solid var(--c-border)', display: 'flex', gap: 8, alignItems: 'baseline', flexWrap: 'wrap' }}>
                    <span className="mono faint" dir="ltr" style={{ fontSize: 'var(--fs-xs)' }}>{(e.ts || '').slice(11, 19)}</span>
                    <Badge tone={String(e.kind).includes('rejected') || String(e.kind).includes('gap') || String(e.kind).includes('refused') ? 'danger' : String(e.kind).includes('exit') ? 'warn' : String(e.kind).includes('entry') ? 'ok' : 'info'}>{e.kind}</Badge>
                    {e.mint && <span className="mono" dir="ltr" style={{ fontSize: 'var(--fs-xs)' }}>{shortMint(e.mint)}</span>}
                    {e.rejections && <span className="mono neg fs-xs">{e.rejections.join(' · ')}</span>}
                  </li>
                ))}
              </ul>
            )}
          </Card>
        </div>

        <div className="detail-pane stack" style={{ gap: 'var(--s-3)' }}>
          <Card title={ar ? 'المراكز المفتوحة' : 'Open positions'}
            right={<Link to="/workspace" className="mono fs-xs">{ar ? 'الكل ←' : 'all →'}</Link>}>
            {open.length === 0 ? <p className="muted">{ar ? 'لا مراكز مفتوحة' : 'No open positions'}</p> : (
              <ul style={{ listStyle: 'none', padding: 0, margin: 0 }}>
                {open.slice(0, 6).map((p) => {
                  const mark = p.mark_status === 'valid' ? p.mark_usd : null;
                  const pnlPct = p.cost_usd > 0 && mark != null ? ((mark - p.cost_usd) / p.cost_usd) * 100 : null;
                  return (
                    <li key={p.position_id} className="list-row">
                      <span className="mono fs-xs" dir="ltr">{shortMint(p.token_mint)}</span>
                      <span className="row" style={{ gap: 8 }}>
                        <Sparkline data={p.mark_history} seed={p.token_mint} tone={pnlPct == null ? 'muted' : pnlPct >= 0 ? 'pos' : 'neg'} width={48} height={16} />
                        <span className="mono fs-sm" style={{ color: pnlPct == null ? 'var(--c-text-faint)' : pnlPct >= 0 ? 'var(--c-ok)' : 'var(--c-danger)' }}>{pnlPct == null ? '—' : `${pnlPct >= 0 ? '+' : ''}${pnlPct.toFixed(1)}%`}</span>
                      </span>
                    </li>
                  );
                })}
              </ul>
            )}
          </Card>

          {!setupComplete && (
            <Card title={<span>🚀 {ar ? 'خطوات البدء' : 'Getting started'} <span className="faint fs-sm">{doneCount}/4</span></span>}>
              <ul style={{ listStyle: 'none', padding: 0, margin: 0 }}>
                {steps.map((s, i) => (
                  <li key={i} className="list-row">
                    <span><span aria-hidden style={{ marginInlineEnd: 8 }}>{s.done ? '✅' : '⬜'}</span>{s.label}</span>
                    <Link to={s.to} className="mono fs-xs">{ar ? 'اذهب ←' : 'go →'}</Link>
                  </li>
                ))}
              </ul>
            </Card>
          )}

          {(readiness.blockers || []).length > 0 && (
            <Card title={ar ? 'حواجز التشغيل الحقيقي' : 'REAL-LIVE blockers'}>
              <ul style={{ listStyle: 'none', padding: 0, margin: 0 }}>
                {readiness.blockers.map((b, i) => (
                  <li key={i} className="list-row"><span className="mono fs-xs">{b.blocker}</span><Badge tone="danger">{ar ? 'ناقص' : 'missing'}</Badge></li>
                ))}
              </ul>
            </Card>
          )}
        </div>
      </div>
    </div>
  );
}
