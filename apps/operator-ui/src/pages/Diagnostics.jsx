import { useState, useEffect } from 'react';
import { useI18n } from '../i18n/index.jsx';
import PageHead from '../components/PageHead.jsx';
import { Card, Badge, DangerNote, EmptyState } from '../components/index.jsx';
import { api } from '../api/client.js';
import { useBackend } from '../api/useBackend.jsx';

// Diagnostics — operator entry for the DiagnosticExecutionAdapter (ADR-0001 Phase 5B).
// READ-ONLY pre-flight: it exercises the live providers (RPC / quote / route / simulation /
// priority-fee / sellability / provider-health) WITHOUT trading. It never opens a position, never
// claims an intent, and never broadcasts a transaction. Requires the server to run with
// DIAGNOSTIC_BACKEND=package; otherwise the endpoints return 404 and this page shows a disabled note.

const STATUS_TONE = { pass: 'ok', warn: 'warn', fail: 'danger' };
const OVERALL = {
  pass: { en: 'PASS', ar: 'ناجح', tone: 'ok' },
  warn: { en: 'WARNING', ar: 'تحذير', tone: 'warn' },
  fail: { en: 'FAIL', ar: 'فشل', tone: 'danger' },
};
const CHECK_LABEL = {
  connectivity: { en: 'RPC connectivity', ar: 'اتصال RPC' },
  provider_health: { en: 'Provider health', ar: 'صحة المزوّدين' },
  priority_fee: { en: 'Priority fee / tip', ar: 'رسوم الأولوية / البقشيش' },
  quote: { en: 'Quote', ar: 'التسعير' },
  route: { en: 'Route availability', ar: 'توفّر المسار' },
  sellability: { en: 'Token sellability', ar: 'قابلية البيع' },
  simulation: { en: 'Transaction simulation', ar: 'محاكاة المعاملة' },
};
// open-by-design capability vocabulary (Phase 8A-R): available | degraded | unavailable | not_configured
const RUNTIME_TONE = { ready: 'ok', degraded: 'warn', unavailable: 'danger', not_configured: 'neutral' };
const BACKEND_TONE = { available: 'ok', degraded: 'warn', unavailable: 'danger', not_configured: 'neutral' };

// one-line, human summary per check (kept defensive: only reads fields the adapter actually returns)
function detailOf(c, ar) {
  if (c.error) return c.error;
  if (c.detail?.error) return c.detail.error; // connectivity surfaces its failure reason here
  switch (c.name) {
    case 'connectivity': return c.detail?.solana_core ? `solana-core ${c.detail.solana_core} · slot ${c.detail.current_slot ?? '—'}` : (ar ? 'متصل' : 'connected');
    case 'priority_fee': return `${c.tip_lamports ?? '—'} lamports · ${c.source || '—'}`;
    case 'quote': return c.out_amount ? `out ${c.out_amount}` : '';
    case 'route': return c.available ? (ar ? 'متوفّر' : 'available') : (ar ? 'غير متوفّر' : 'unavailable');
    case 'sellability': return c.sellable ? `≈ $${c.usd ?? '—'}` : (ar ? 'لا مسار بيع' : 'no sell route');
    case 'simulation': return c.simulated_ok ? (ar ? 'نجحت المحاكاة' : 'simulated ok') : (ar ? 'فشلت' : 'failed');
    case 'provider_health': return c.degraded ? (ar ? 'متدهور' : 'degraded') : (ar ? 'سليم' : 'healthy');
    default: return '';
  }
}

export default function Diagnostics() {
  const { lang } = useI18n();
  const ar = lang === 'ar';
  const { connected } = useBackend();

  const [run, setRun] = useState(null);
  const [summary, setSummary] = useState(null); // { overall, safe_to_run_live }
  const [safety, setSafety] = useState(null); // server-declared guarantees (Phase 5C)
  const [provider, setProvider] = useState(null); // dedicated provider-test result
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState(null);
  const [disabled, setDisabled] = useState(false);
  const [runtime, setRuntime] = useState(null); // GET /api/runtime/readiness (Phase 8A)

  async function loadRuntime() {
    const r = await api.runtimeReadiness();
    if (r.ok && r.data) setRuntime(r.data);
  }
  // load the runtime-readiness summary once connected (read-only; never opens live)
  useEffect(() => { if (connected) loadRuntime(); /* eslint-disable-next-line */ }, [connected]);

  async function runTest() {
    setBusy(true); setMsg(null);
    const r = await api.runDiagnostics({});
    setBusy(false);
    if (r.status === 404) { setDisabled(true); setRun(null); return; }
    setDisabled(false);
    if (r.ok && r.data?.ok) {
      setRun(r.data.run);
      setSummary({ overall: r.data.overall, safe_to_run_live: r.data.safe_to_run_live });
      setSafety(r.data.safety || null);
    } else {
      setMsg({ tone: 'danger', text: r.data?.error || (ar ? 'فشل التشخيص' : 'diagnostic failed') });
    }
  }

  async function providerTest() {
    setBusy(true); setMsg(null);
    const r = await api.diagnosticsProviderTest();
    setBusy(false);
    if (r.status === 404) { setDisabled(true); return; }
    setDisabled(false);
    if (r.ok && r.data?.ok) { setProvider(r.data); setSafety(r.data.safety || null); }
    else setMsg({ tone: 'danger', text: r.data?.error || (ar ? 'فشل فحص المزوّدين' : 'provider test failed') });
  }

  if (!connected) {
    return (
      <div className="stack">
        <PageHead title={ar ? 'التشخيص' : 'Diagnostics'} sub={ar ? 'فحص الجاهزية قبل التداول — دون إرسال أي معاملة' : 'Pre-flight readiness checks — no transaction is ever sent'} />
        <EmptyState message={ar ? 'الخادم غير متصل — شغّل START.bat' : 'Server offline — run START.bat'} />
      </div>
    );
  }

  const checks = run?.checks || [];
  const providerHealth = checks.find((c) => c.name === 'provider_health');
  const providers = providerHealth?.providers || {};

  return (
    <div className="stack">
      <PageHead title={ar ? 'التشخيص' : 'Diagnostics'}
        sub={ar ? 'يختبر مسار التنفيذ الحيّ (RPC/تسعير/مسار/محاكاة/رسوم/قابلية بيع/صحة المزوّدين) دون فتح مركز أو إرسال معاملة.' : 'Exercises the live execution path (RPC / quote / route / simulation / fees / sellability / provider health) without opening a position or sending a transaction.'} />

      <DangerNote tone="warn">
        {ar ? '🔬 تشخيص فقط — لن تُرسَل أي معاملة. لا يفتح مركزًا، ولا يسجّل نيّة تنفيذ، ولا يبثّ أي معاملة على الشبكة.'
            : '🔬 Diagnostic only — no transaction will be sent. It never opens a position, claims an execution intent, or broadcasts to the network.'}
      </DangerNote>

      {/* Runtime readiness (Phase 8A) — read-only health across storage / cache / analytics / providers / activation */}
      <Card title={ar ? 'جاهزية النظام (Runtime)' : 'Runtime readiness'}
        right={runtime && <Badge tone={RUNTIME_TONE[runtime.overall] || 'neutral'}>{(runtime.overall || '').toUpperCase()}</Badge>}>
        {!runtime ? (
          <p className="muted fs-xs">{ar ? 'لا توجد بيانات جاهزية بعد' : 'no readiness data yet'}</p>
        ) : (
          <>
            <div className="kpi-strip" style={{ margin: 0, gridTemplateColumns: 'repeat(4, 1fr)' }}>
              {[['storage', runtime.storage], ['hot_state', runtime.hot_state], ['event_sink', runtime.event_sink], ['live_execution', { backend: '', status: runtime.live_execution?.status }]].map(([k, v]) => (
                <div className="stattile" key={k}>
                  <span className="lbl">{k.replace(/_/g, ' ')}{v?.backend ? <span className="muted"> · {v.backend}</span> : null}</span>
                  <span className="val" style={{ fontSize: 'var(--fs-md)' }}><Badge tone={BACKEND_TONE[v?.status] || 'neutral'}>{v?.status || '—'}</Badge></span>
                </div>
              ))}
            </div>
            <div className="row" style={{ gap: 'var(--s-2)', flexWrap: 'wrap', marginBlockStart: 'var(--s-2)', alignItems: 'center' }}>
              <span className="muted fs-xs">{ar ? 'المزوّدون' : 'providers'}:</span>
              {Object.keys(runtime.providers || {}).length === 0
                ? <span className="muted fs-xs">—</span>
                : Object.entries(runtime.providers).map(([n, s]) => (
                  <Badge key={n} tone={BACKEND_TONE[s] || 'neutral'}>{n}: {s}</Badge>
                ))}
              <span className="muted fs-xs" style={{ marginInlineStart: 'var(--s-2)' }}>signer:</span>
              <Badge tone={BACKEND_TONE[runtime.signer?.status] || 'neutral'}>{runtime.signer?.status || '—'}</Badge>
              <span className="muted fs-xs">{ar ? 'يمكنه التوقيع' : 'can sign'}: {runtime.signer?.can_sign ? (ar ? 'نعم' : 'yes') : (ar ? 'لا' : 'no')}</span>
            </div>
            {runtime.live_execution?.missing_config?.length > 0 && (
              <p className="fs-xs muted" style={{ marginBlockStart: 6 }}>
                {ar ? 'إعداد مطلوب لتفعيل التنفيذ الحيّ' : 'configure to enable live execution'}: {runtime.live_execution.missing_config.join(' · ')}
              </p>
            )}
            {runtime.unavailable_dependencies?.length > 0 && (
              <p className="fs-xs" style={{ color: 'var(--c-warn)', marginBlockStart: 4 }}>
                {ar ? 'تبعيات غير متوفرة' : 'unavailable dependencies'}: {runtime.unavailable_dependencies.join(' · ')}
              </p>
            )}
            <DangerNote tone="info">
              {ar ? 'هذه الصفحة للمراقبة فقط. تصبح القدرات متاحة عند توفّر الإعداد والمتطلبات. لا تفرض هذه الصفحة أي قيود.'
                  : 'Runtime readiness is informational. Capabilities become available when configured. This page does not enforce gates.'}
            </DangerNote>
            <div className="row" style={{ gap: 'var(--s-2)', flexWrap: 'wrap', alignItems: 'center' }}>
              <button className="btn" onClick={loadRuntime}>{ar ? 'تحديث' : 'Refresh'}</button>
            </div>
          </>
        )}
      </Card>

      <Card title={ar ? 'اختبار التنفيذ (Pre-flight)' : 'Execution test (pre-flight)'}
        right={summary && <Badge tone={OVERALL[summary.overall]?.tone || 'neutral'}>{(ar ? OVERALL[summary.overall]?.ar : OVERALL[summary.overall]?.en) || summary.overall}</Badge>}>
        <div className="row" style={{ gap: 'var(--s-2)', flexWrap: 'wrap', alignItems: 'center' }}>
          <button className="btn primary" onClick={runTest} disabled={busy}>
            {busy ? (ar ? 'جارٍ التشغيل…' : 'Running…') : (ar ? 'تشغيل اختبار التنفيذ' : 'Run Execution Test')}
          </button>
          <button className="btn" onClick={providerTest} disabled={busy}>{ar ? 'فحص المزوّدين' : 'Provider test'}</button>
          {provider && <Badge tone={STATUS_TONE[provider.overall] || 'neutral'}>{ar ? 'المزوّدون' : 'providers'}: {(provider.overall || '').toUpperCase()}</Badge>}
          {run?.created_at && <span className="muted fs-xs">{ar ? 'آخر تشغيل' : 'last run'}: <span className="mono" dir="ltr">{run.created_at}</span></span>}
          {summary && (
            <span className="muted fs-xs">
              {ar ? 'آمن للتشغيل الحيّ (استشاري)' : 'safe to run live (advisory)'}:{' '}
              <Badge tone={summary.safe_to_run_live ? 'ok' : 'warn'}>{summary.safe_to_run_live ? (ar ? 'نعم' : 'yes') : (ar ? 'لا' : 'no')}</Badge>
            </span>
          )}
        </div>
        {safety && (
          <div className="row fs-xs muted" style={{ gap: 'var(--s-2)', flexWrap: 'wrap', marginBlockStart: 8 }} aria-label={ar ? 'ضمانات الأمان' : 'safety guarantees'}>
            {safety.diagnostic_only && <Badge tone="sim">{ar ? 'تشخيص فقط' : 'diagnostic only'}</Badge>}
            {safety.no_transaction_sent && <Badge tone="sim">{ar ? 'لا معاملة' : 'no transaction sent'}</Badge>}
            {safety.no_position_opened && <Badge tone="sim">{ar ? 'لا مركز' : 'no position opened'}</Badge>}
            {safety.no_intent_claimed && <Badge tone="sim">{ar ? 'لا نيّة تنفيذ' : 'no intent claimed'}</Badge>}
          </div>
        )}
        {msg && <div style={{ marginBlockStart: 8 }}><Badge tone={msg.tone}>{msg.text}</Badge></div>}
        {disabled && (
          <div style={{ marginBlockStart: 'var(--s-3)' }}>
            <DangerNote tone="info">
              {ar ? 'التشخيص غير مُفعّل. شغّل الخادم بـ DIAGNOSTIC_BACKEND=package لتمكين هذه الفحوص.'
                  : 'Diagnostics are disabled. Start the server with DIAGNOSTIC_BACKEND=package to enable these checks.'}
            </DangerNote>
          </div>
        )}
      </Card>

      {run && (
        <div className="workspace">
          {/* check-by-check */}
          <Card title={ar ? `الفحوص (${checks.length})` : `Checks (${checks.length})`}>
            {checks.length === 0
              ? <EmptyState message={ar ? 'لا فحوص' : 'no checks'} />
              : (
                <table className="data"><tbody>
                  {checks.map((c, i) => (
                    <tr key={`${c.name}-${i}`}>
                      <td className="fs-xs">{(ar ? CHECK_LABEL[c.name]?.ar : CHECK_LABEL[c.name]?.en) || c.name}</td>
                      <td><Badge tone={STATUS_TONE[c.status] || 'neutral'}>{(c.status || '').toUpperCase()}</Badge></td>
                      <td className="fs-xs muted" dir={ar ? 'rtl' : 'ltr'}>{detailOf(c, ar)}</td>
                    </tr>
                  ))}
                </tbody></table>
              )}
          </Card>

          {/* provider health rollup */}
          <div className="detail-pane stack" style={{ gap: 'var(--s-3)' }}>
            <Card title={ar ? 'صحة المزوّدين' : 'Provider health'}>
              {Object.keys(providers).length === 0
                ? <p className="muted fs-xs">{ar ? 'لا بيانات صحة بعد — شغّل المحرّك أولاً' : 'no health data yet — run the engine first'}</p>
                : (
                  <table className="data"><tbody>
                    {Object.entries(providers).map(([name, p]) => (
                      <tr key={name}>
                        <td className="fs-xs mono" dir="ltr">{name}</td>
                        <td><Badge tone={p.status === 'down' ? 'danger' : p.status === 'degraded' ? 'warn' : 'ok'}>{p.status || '—'}</Badge></td>
                        <td className="num mono faint fs-xs">{p.error_pct ?? 0}% err</td>
                        <td className="num mono faint fs-xs">{p.p90_ms ?? '—'}ms p90</td>
                      </tr>
                    ))}
                  </tbody></table>
                )}
            </Card>
          </div>
        </div>
      )}
    </div>
  );
}
