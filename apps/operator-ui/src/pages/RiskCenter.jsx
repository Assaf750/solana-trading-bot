import { useEffect, useState } from 'react';
import { useI18n } from '../i18n/index.jsx';
import PageHead from '../components/PageHead.jsx';
import { Card, Badge, EmptyState } from '../components/index.jsx';
import { api } from '../api/client.js';
import { useBackend } from '../api/useBackend.jsx';

const SEV = {
  block: { ar: 'حظر', en: 'BLOCK', tone: 'danger' },
  warn: { ar: 'تحذير', en: 'WARN', tone: 'warn' },
  watch: { ar: 'مراقبة', en: 'WATCH', tone: 'info' },
  info: { ar: 'معلومة', en: 'INFO', tone: 'neutral' },
  ok: { ar: 'سليم', en: 'OK', tone: 'ok' },
};
const POSTURE = {
  blocked: { ar: 'محظور', en: 'BLOCKED', tone: 'danger' },
  caution: { ar: 'حذر', en: 'CAUTION', tone: 'warn' },
  ok: { ar: 'سليم', en: 'OK', tone: 'ok' },
};
const AREA = {
  general: { ar: 'عام', en: 'General' }, token: { ar: 'التوكن', en: 'Token' }, authority: { ar: 'الصلاحيات', en: 'Authorities' },
  token2022: { ar: 'Token-2022', en: 'Token-2022' }, slippage: { ar: 'الانزلاق', en: 'Slippage' }, exit: { ar: 'الخروج', en: 'Exit' },
  concentration: { ar: 'التركّز', en: 'Concentration' }, data: { ar: 'البيانات', en: 'Data' }, network: { ar: 'الشبكة', en: 'Network' },
  providers: { ar: 'المزوّدون', en: 'Providers' },
};
const PROV_TONE = { healthy: 'ok', degraded: 'warn', down: 'danger', unknown: 'neutral' };

export default function RiskCenter() {
  const { lang } = useI18n();
  const ar = lang === 'ar';
  const { connected, status } = useBackend();
  const [risk, setRisk] = useState(null);

  async function load() { const r = await api.risk(); if (r.ok) setRisk(r.data); }
  useEffect(() => {
    if (!connected) return undefined;
    load();
    const iv = setInterval(load, 12000);
    return () => clearInterval(iv);
  }, [connected]);

  if (!connected) {
    return (
      <div className="stack">
        <PageHead title={ar ? 'مركز المخاطر' : 'Risk Center'} sub={ar ? 'صورة المخاطر العامة' : 'System-wide risk posture'} />
        <EmptyState message={ar ? 'الخادم غير متصل — شغّل START.bat' : 'Server offline — run START.bat'} />
      </div>
    );
  }

  const posture = risk ? (POSTURE[risk.posture] || POSTURE.ok) : null;
  const byArea = {};
  for (const f of risk?.findings || []) { (byArea[f.area] = byArea[f.area] || []).push(f); }
  const c = risk?.counts || {};

  return (
    <div className="stack">
      <PageHead title={ar ? 'مركز المخاطر' : 'Risk Center'} sub={ar ? 'صورة المخاطر مشتقّة من الإعدادات والحالة الحقيقية — قرارات حظر/تحذير/مراقبة.' : 'Risk posture derived from real config & state — block / warn / watch decisions.'} />

      {risk && (
        <div className="kpi-strip">
          <div className="stattile"><span className="lbl">{ar ? 'الوضعية' : 'Posture'}</span><span className="val" style={{ fontSize: 'var(--fs-md)' }}><Badge tone={posture.tone}>{ar ? posture.ar : posture.en}</Badge></span></div>
          <div className="stattile"><span className="lbl">{ar ? 'حظر' : 'Block'}</span><span className="val neg">{c.block || 0}</span></div>
          <div className="stattile"><span className="lbl">{ar ? 'تحذير' : 'Warn'}</span><span className="val" style={{ color: 'var(--c-warn)' }}>{c.warn || 0}</span></div>
          <div className="stattile"><span className="lbl">{ar ? 'مراقبة' : 'Watch'}</span><span className="val">{c.watch || 0}</span></div>
        </div>
      )}

      {!risk ? <Card title={ar ? 'جارٍ القراءة…' : 'Reading…'}><div className="skeleton-row" /><div className="skeleton-row" /></Card> : (
        Object.keys(byArea).length === 0 ? <EmptyState message={ar ? 'لا إشارات مخاطر' : 'No risk signals'} /> : (
          <div className="workspace">
            {Object.entries(byArea).map(([area, items]) => (
              <Card key={area} title={ar ? (AREA[area]?.ar || area) : (AREA[area]?.en || area)}>
                <ul style={{ listStyle: 'none', padding: 0, margin: 0 }}>
                  {items.map((f) => (
                    <li key={f.code} style={{ display: 'flex', gap: 8, alignItems: 'baseline', padding: '5px 0', borderBottom: '1px solid var(--c-border)' }}>
                      <Badge tone={SEV[f.severity]?.tone || 'neutral'}>{ar ? SEV[f.severity]?.ar : SEV[f.severity]?.en}</Badge>
                      <span className="fs-sm">{f.text}</span>
                    </li>
                  ))}
                </ul>
              </Card>
            ))}
          </div>
        )
      )}

      <ProviderHealth ar={ar} providers={status?.providers} />

      <p className="faint fs-xs">{ar ? 'مشتقّ من الحالة والإعدادات الحقيقية — لا أرقام مختلقة. للضوابط استخدم الإعدادات والأمان، وللإيقاف الفوري صفحة التنبيهات.' : 'Derived from real state & config — no fabricated numbers. Tune controls on Settings & Safety; the kill switch is on Alerts.'}</p>
    </div>
  );
}

// Live external-provider health (measured success/error + latency of the real Jupiter & RPC calls).
function ProviderHealth({ ar, providers }) {
  const rows = Object.entries(providers || {}).filter(([, p]) => p && p.calls > 0);
  return (
    <Card title={ar ? 'صحّة المزوّدين' : 'Provider health'}
      right={<span className="muted fs-xs">{ar ? 'من نتائج الاستدعاءات الفعلية' : 'from real call outcomes'}</span>}>
      {rows.length === 0 ? (
        <p className="muted fs-xs">{ar ? 'لا استدعاءات بعد — افتح الخزنة وحلّل توكناً لتجميع البيانات.' : 'No calls yet — unlock the vault and analyze a token to gather data.'}</p>
      ) : (
        <table className="data">
          <thead><tr><th className="nosort">{ar ? 'المزوّد' : 'provider'}</th><th className="nosort">{ar ? 'الحالة' : 'status'}</th><th className="nosort num">{ar ? 'استدعاءات' : 'calls'}</th><th className="nosort num">{ar ? 'أخطاء' : 'err%'}</th><th className="nosort num">p50</th><th className="nosort num">p90</th><th className="nosort">{ar ? 'آخر خطأ' : 'last error'}</th></tr></thead>
          <tbody>
            {rows.map(([name, p]) => (
              <tr key={name}>
                <td className="mono">{name}</td>
                <td><Badge tone={PROV_TONE[p.status] || 'neutral'}>{p.status}</Badge></td>
                <td className="num mono">{p.calls}</td>
                <td className="num mono" style={{ color: p.error_pct >= 10 ? 'var(--c-danger)' : p.error_pct > 0 ? 'var(--c-warn)' : 'var(--c-text-faint)' }}>{p.error_pct}%</td>
                <td className="num mono faint">{p.p50_ms != null ? `${p.p50_ms}ms` : '—'}</td>
                <td className="num mono faint">{p.p90_ms != null ? `${p.p90_ms}ms` : '—'}</td>
                <td className="mono faint fs-xs">{p.last_error || '—'}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </Card>
  );
}
