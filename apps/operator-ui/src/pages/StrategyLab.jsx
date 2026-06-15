import { useEffect, useMemo, useState } from 'react';
import { useI18n } from '../i18n/index.jsx';
import PageHead from '../components/PageHead.jsx';
import { Card, Badge, DangerNote, EmptyState, MiniChart } from '../components/index.jsx';
import { api } from '../api/client.js';
import { useBackend } from '../api/useBackend.jsx';

// Strategy Lab — deterministic, honest strategy preview. It does NOT use or invent market data:
// it runs the candidate exit strategy through the EXACT engine exit logic (server-side
// strategy-sim, which reuses exit-rules.mjs) over a hypothetical price scenario the operator
// picks — a what-if calculator, clearly labelled as hypothetical.

const NUM = (v) => (v === '' || v == null ? null : Number(v));
const pct = (v) => (v == null || !Number.isFinite(v) ? '—' : `${v >= 0 ? '+' : ''}${v.toFixed(1)}%`);

const REASON_LABEL = {
  take_profit_hit: { en: 'Full take-profit', ar: 'جني ربح كامل', tone: 'ok' },
  take_profit_tier1: { en: 'Partial TP (tier 1)', ar: 'جني جزئي (المستوى 1)', tone: 'info' },
  trailing_stop_hit: { en: 'Trailing stop', ar: 'وقف متحرك', tone: 'warn' },
  breakeven_stop: { en: 'Break-even stop', ar: 'وقف التعادل', tone: 'warn' },
  stop_loss_hit: { en: 'Stop-loss', ar: 'وقف خسارة', tone: 'danger' },
};

export default function StrategyLab() {
  const { t, lang } = useI18n();
  const ar = lang === 'ar';
  const { connected } = useBackend();

  const [strat, setStrat] = useState({
    take_profit_pct: 50, stop_loss_pct: 30, trailing_stop_pct: '', tp1_pct: '', tp1_sell_pct: 50, breakeven_after_tp1: false,
  });
  const [scenarios, setScenarios] = useState([]);
  const [scenario, setScenario] = useState('pump_then_dump');
  const [res, setRes] = useState(null);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState(null);
  const [loadedFromConfig, setLoadedFromConfig] = useState(false);

  // hydrate scenario catalog + the live config's copy_defaults once connected
  useEffect(() => {
    if (!connected) return;
    let alive = true;
    (async () => {
      const sc = await api.strategyScenarios();
      if (alive && sc.ok) setScenarios(sc.data.scenarios || []);
      const cfg = await api.config();
      if (alive && cfg.ok) {
        const cd = cfg.data?.copy_defaults || {};
        setStrat({
          take_profit_pct: cd.take_profit_pct ?? 50,
          stop_loss_pct: cd.stop_loss_pct ?? 30,
          trailing_stop_pct: cd.trailing_stop_pct ?? '',
          tp1_pct: cd.tp1_pct ?? '',
          tp1_sell_pct: cd.tp1_sell_pct ?? 50,
          breakeven_after_tp1: cd.breakeven_after_tp1 === true,
        });
        setLoadedFromConfig(true);
      }
    })();
    return () => { alive = false; };
  }, [connected]);

  const candidate = useMemo(() => ({
    take_profit_pct: NUM(strat.take_profit_pct),
    stop_loss_pct: NUM(strat.stop_loss_pct),
    trailing_stop_pct: NUM(strat.trailing_stop_pct),
    tp1_pct: NUM(strat.tp1_pct),
    tp1_sell_pct: NUM(strat.tp1_sell_pct),
    breakeven_after_tp1: strat.breakeven_after_tp1 === true,
  }), [strat]);

  async function run() {
    setBusy(true); setMsg(null);
    const r = await api.simulateStrategy(candidate, scenario);
    setBusy(false);
    if (r.ok && r.data?.ok) setRes(r.data);
    else setMsg({ tone: 'danger', text: r.data?.error || (ar ? 'فشلت المحاكاة' : 'simulation failed') });
  }

  // auto-run when scenario changes (and once after config hydration)
  useEffect(() => { if (connected && loadedFromConfig) run(); /* eslint-disable-next-line */ }, [scenario, loadedFromConfig]);

  async function applyToConfig() {
    if (!window.confirm(ar ? 'تطبيق هذه الاستراتيجية على الإعداد الحيّ (copy_defaults)؟' : 'Apply this strategy to the live config (copy_defaults)?')) return;
    setBusy(true);
    const r = await api.updateConfig({ copy_defaults: candidate });
    setBusy(false);
    if (r.ok && r.data?.ok) setMsg({ tone: 'ok', text: ar ? 'طُبِّقت على الإعداد الحيّ ✓' : 'Applied to live config ✓' });
    else setMsg({ tone: 'danger', text: (r.data?.errors && r.data.errors.join(' · ')) || r.data?.error || (ar ? 'فشل التطبيق' : 'apply failed') });
  }

  const set = (k, v) => setStrat((s) => ({ ...s, [k]: v }));

  if (!connected) {
    return (
      <div className="stack">
        <PageHead title={ar ? 'مختبر الاستراتيجيات' : 'Strategy Lab'} sub={ar ? 'عاين سلوك استراتيجيتك قبل المخاطرة بالمال' : 'Preview your strategy behavior before risking money'} />
        <EmptyState message={ar ? 'الخادم غير متصل — شغّل START.bat' : 'Server offline — run START.bat'} />
      </div>
    );
  }

  const result = res?.result;
  const buyHold = result?.final_pnl_pct;
  const beatsHold = result && buyHold != null && result.marked_pct > buyHold;

  return (
    <div className="stack">
      <PageHead title={ar ? 'مختبر الاستراتيجيات' : 'Strategy Lab'}
        sub={ar ? 'محاكاة حتمية تستخدم نفس منطق الخروج الفعلي للمحرّك على سيناريو سعري افتراضي — ليست بيانات سوق.' : 'Deterministic preview using the engine’s exact exit logic over a hypothetical price scenario — not market data.'} />

      <DangerNote tone="info">
        {ar
          ? 'هذه معاينة افتراضية «ماذا لو»: تطبّق منطق TP/SL/الوقف المتحرك/الجني الجزئي/التعادل تماماً كما يفعل المحرّك، على مسار سعري تختاره. لا تتنبأ بالسوق ولا تستخدم أسعاراً حقيقية.'
          : 'This is a hypothetical what-if: it applies your TP / SL / trailing / partial-TP / break-even rules exactly as the engine would, over a price path you pick. It does not predict markets or use real prices.'}
      </DangerNote>

      <div className="workspace">
        {/* ---- strategy editor ---- */}
        <Card title={ar ? 'الاستراتيجية المرشّحة' : 'Candidate strategy'}
          right={loadedFromConfig && <span className="muted fs-xs">{ar ? 'محمّلة من الإعداد الحيّ' : 'loaded from live config'}</span>}>
          <div className="grid cols-2" style={{ gap: 'var(--s-3)' }}>
            <Field label={ar ? 'جني الربح %' : 'Take-profit %'} value={strat.take_profit_pct} onChange={(v) => set('take_profit_pct', v)} />
            <Field label={ar ? 'وقف الخسارة %' : 'Stop-loss %'} value={strat.stop_loss_pct} onChange={(v) => set('stop_loss_pct', v)} />
            <Field label={ar ? 'وقف متحرك % (فارغ=معطّل)' : 'Trailing stop % (blank=off)'} value={strat.trailing_stop_pct} onChange={(v) => set('trailing_stop_pct', v)} />
            <Field label={ar ? 'جني جزئي عند % (فارغ=معطّل)' : 'Partial TP at % (blank=off)'} value={strat.tp1_pct} onChange={(v) => set('tp1_pct', v)} />
            <Field label={ar ? 'نسبة البيع الجزئي %' : 'Partial sell %'} value={strat.tp1_sell_pct} onChange={(v) => set('tp1_sell_pct', v)} />
            <label className="row" style={{ gap: 8, alignSelf: 'end' }}>
              <input type="checkbox" checked={strat.breakeven_after_tp1} onChange={(e) => set('breakeven_after_tp1', e.target.checked)} />
              <span>{ar ? 'تعادل بعد الجني الجزئي' : 'Break-even after partial TP'}</span>
            </label>
          </div>
          <div className="row" style={{ marginBlockStart: 'var(--s-3)', flexWrap: 'wrap', gap: 'var(--s-2)' }}>
            <label className="muted fs-xs">{ar ? 'السيناريو' : 'Scenario'}</label>
            <select className="search" style={{ flex: '1 1 220px' }} value={scenario} onChange={(e) => setScenario(e.target.value)}>
              {scenarios.map((s) => <option key={s.key} value={s.key}>{s.label}</option>)}
            </select>
            <button className="btn primary" onClick={run} disabled={busy}>{ar ? 'تشغيل المعاينة' : 'Run preview'}</button>
            <button className="btn" onClick={applyToConfig} disabled={busy}>{ar ? 'تطبيق على الإعداد الحيّ' : 'Apply to live config'}</button>
          </div>
          {msg && <div style={{ marginBlockStart: 8 }}><Badge tone={msg.tone}>{msg.text}</Badge></div>}
        </Card>

        {/* ---- outcome ---- */}
        <div className="detail-pane stack" style={{ gap: 'var(--s-3)' }}>
          {!result ? (
            <EmptyState message={ar ? 'شغّل المعاينة لرؤية النتيجة' : 'Run a preview to see the outcome'} />
          ) : (
            <>
              <Card title={<span>{ar ? 'النتيجة' : 'Outcome'} · <span className="muted fs-xs">{res.label}</span></span>}>
                <div className="kpi-strip" style={{ margin: 0, gridTemplateColumns: 'repeat(2, 1fr)' }}>
                  <div className="stattile">
                    <span className="lbl">{ar ? 'نتيجة الاستراتيجية' : 'Strategy result'}</span>
                    <span className={`val ${result.marked_pct >= 0 ? 'pos' : 'neg'}`} style={{ fontSize: 'var(--fs-lg)' }}>{pct(result.marked_pct)}</span>
                  </div>
                  <div className="stattile">
                    <span className="lbl">{ar ? 'شراء واحتفاظ' : 'Buy & hold'}</span>
                    <span className={`val ${(buyHold ?? 0) >= 0 ? 'pos' : 'neg'}`} style={{ fontSize: 'var(--fs-lg)' }}>{pct(buyHold)}</span>
                  </div>
                  <div className="stattile">
                    <span className="lbl">{ar ? 'محقّق' : 'Realized'}</span>
                    <span className={`val ${result.realized_pct >= 0 ? 'pos' : 'neg'}`}>{pct(result.realized_pct)}</span>
                  </div>
                  <div className="stattile">
                    <span className="lbl">{ar ? 'الحالة' : 'Status'}</span>
                    <span className="val" style={{ fontSize: 'var(--fs-md)' }}>
                      {result.closed
                        ? <Badge tone={REASON_LABEL[result.exit_reason]?.tone || 'neutral'}>{(ar ? REASON_LABEL[result.exit_reason]?.ar : REASON_LABEL[result.exit_reason]?.en) || result.exit_reason}</Badge>
                        : <Badge tone="info">{ar ? `مفتوح (${Math.round(result.remaining * 100)}%)` : `open (${Math.round(result.remaining * 100)}%)`}</Badge>}
                    </span>
                  </div>
                </div>
                {beatsHold
                  ? <p className="fs-xs" style={{ color: 'var(--c-ok)', marginBlockStart: 8 }}>{ar ? '✓ الاستراتيجية تفوّقت على الاحتفاظ في هذا السيناريو' : '✓ Strategy beat buy & hold in this scenario'}</p>
                  : <p className="fs-xs muted" style={{ marginBlockStart: 8 }}>{ar ? 'الاحتفاظ كان مساوياً أو أفضل في هذا السيناريو' : 'Buy & hold matched or beat the strategy in this scenario'}</p>}
              </Card>

              <Card title={ar ? 'منحنى رأس المال (% من التكلفة)' : 'Equity curve (% of cost)'}>
                <MiniChart data={result.equity_curve} tone={result.marked_pct >= 0 ? 'pos' : 'neg'} height={90}
                  label={ar ? `استراتيجية · ${result.equity_curve.length} خطوة` : `strategy · ${result.equity_curve.length} steps`}
                  emptyLabel={ar ? 'لا بيانات' : 'no data'} />
                <MiniChart data={res.price_path} tone="muted" height={70}
                  label={ar ? 'مسار السعر الافتراضي (شراء واحتفاظ)' : 'hypothetical price path (buy & hold)'}
                  emptyLabel={ar ? 'لا بيانات' : 'no data'} />
              </Card>

              <Card title={ar ? `أحداث الخروج (${result.events.length})` : `Exit events (${result.events.length})`}>
                {result.events.length === 0
                  ? <p className="muted fs-xs">{ar ? 'لا أحداث خروج — بقي المركز مفتوحاً طوال السيناريو' : 'No exit events — the position stayed open through the scenario'}</p>
                  : (
                    <table className="data"><tbody>
                      {result.events.map((e, i) => (
                        <tr key={`${e.i}-${e.reason}-${i}`}>
                          <td className="mono faint fs-xs">#{e.i}</td>
                          <td><Badge tone={REASON_LABEL[e.reason]?.tone || 'neutral'}>{e.action === 'partial_tp' ? (ar ? 'جزئي' : 'partial') : (ar ? 'كامل' : 'full')}</Badge></td>
                          <td className="fs-xs">{(ar ? REASON_LABEL[e.reason]?.ar : REASON_LABEL[e.reason]?.en) || e.reason}</td>
                          <td className="num mono fs-xs">{pct(e.pnl_pct)}</td>
                          <td className="num mono faint fs-xs">{ar ? 'بِيع' : 'sold'} {Math.round(e.fraction * 100)}%</td>
                        </tr>
                      ))}
                    </tbody></table>
                  )}
              </Card>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

function Field({ label, value, onChange }) {
  return (
    <label className="stack" style={{ gap: 4 }}>
      <span className="muted fs-xs">{label}</span>
      <input className="search" type="number" inputMode="decimal" step="any" dir="ltr" value={value} onChange={(e) => onChange(e.target.value)} />
    </label>
  );
}
