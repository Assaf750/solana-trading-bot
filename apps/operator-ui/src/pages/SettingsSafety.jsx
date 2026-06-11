import { useI18n } from '../i18n/index.jsx';
import PageHead from '../components/PageHead.jsx';
import { Card, Badge, DangerNote, UnavailableValue, PreviewDisabledAction } from '../components/index.jsx';
import { HARD_RISK, EV_GATE, READINESS, ACTIVATION_SEAM } from '../fixtures/index.js';

export default function SettingsSafety() {
  const { t } = useI18n();
  const missing = HARD_RISK.filter((h) => h.value === null || h.value === undefined);
  const complete = missing.length === 0;

  return (
    <div className="stack">
      <PageHead title={t('settings.title')} sub={t('settings.sub')} />

      <DangerNote tone="warn" locked>{t('settings.hardRiskNote')}</DangerNote>

      <Card
        title={t('settings.hardRisk')}
        right={<Badge tone={complete ? 'ok' : 'danger'}>{t('settings.completeness')}: {complete ? t('settings.complete') : t('settings.incomplete')}</Badge>}
      >
        <div className="table-wrap">
          <table className="data">
            <thead>
              <tr>
                <th className="nosort">field</th>
                <th className="nosort">{t('common.value')}</th>
                <th className="nosort">{t('common.status')}</th>
              </tr>
            </thead>
            <tbody>
              {HARD_RISK.map((h) => {
                const isMissing = h.value === null || h.value === undefined;
                return (
                  <tr key={h.field}>
                    <td className="mono">{h.field}</td>
                    <td className="num">
                      <UnavailableValue value={h.value} suffix={h.value != null ? ` ${h.unit}` : ''} />
                    </td>
                    <td>
                      {isMissing
                        ? <Badge tone="danger">{t('settings.limitMissing')}</Badge>
                        : <Badge tone="ok">set</Badge>}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </Card>

      <div className="grid cols-2">
        <Card title={t('settings.evGate')}>
          <div className="row">
            <span className="muted">ev_gate_mode:</span>
            <Badge tone={EV_GATE.ev_gate_mode === 'strict' ? 'ok' : 'warn'}>{EV_GATE.ev_gate_mode}</Badge>
          </div>
          <p className="muted" style={{ fontSize: 'var(--fs-sm)' }}>
            warning_only never relaxes a Hard-Risk limit or a kill switch.
          </p>
          <PreviewDisabledAction label="preview_config_update" />
        </Card>

        <Card title={t('settings.realLive')} right={<Badge tone="danger">{t('app.blocked')}</Badge>}>
          <div className="row" style={{ marginBlockEnd: 'var(--s-2)' }}>
            <span className="muted">ready:</span>
            <Badge tone="danger">{String(READINESS.ready)}</Badge>
            <span className="muted">prerequisite_for:</span>
            <span className="mono">{READINESS.prerequisite_for}</span>
          </div>
          <span className="muted">{t('settings.blockers')}:</span>
          <ul style={{ margin: '6px 0 0', paddingInlineStart: 18 }}>
            {READINESS.blockers.map((b) => (
              <li key={b.code}>
                <span className="mono neg">{b.code}</span>
                {b.detail && <span className="faint"> — {b.detail}</span>}
              </li>
            ))}
          </ul>
        </Card>
      </div>

      <Card title={t('settings.seam')} right={<Badge tone="danger">never-ready</Badge>}>
        <DangerNote tone="danger" locked>{t('settings.seamNote')}</DangerNote>
        <dl className="kv" style={{ marginBlockEnd: 'var(--s-4)' }}>
          <dt className="mono">activation_performed</dt><dd><Badge tone="danger">{String(ACTIVATION_SEAM.activation_performed)}</Badge></dd>
          <dt className="mono">real_live_activated</dt><dd><Badge tone="danger">{String(ACTIVATION_SEAM.real_live_activated)}</Badge></dd>
          <dt className="mono">seam_ready</dt><dd><Badge tone="danger">{String(ACTIVATION_SEAM.seam_ready)}</Badge></dd>
          <dt className="mono">live_quote_enabled</dt><dd><Badge tone="danger">{String(ACTIVATION_SEAM.live_quote_enabled)}</Badge></dd>
        </dl>
        <span className="muted">{t('settings.ownerChecklist')}:</span>
        <ul style={{ listStyle: 'none', padding: 0, margin: '6px 0 0' }}>
          {ACTIVATION_SEAM.owner_checklist.map((c) => (
            <li key={c.code} className="row" style={{ justifyContent: 'space-between', padding: '5px 0', borderBottom: '1px solid var(--c-border)' }}>
              <span className="mono">{c.code}</span>
              <Badge tone={c.satisfied ? 'ok' : 'danger'}>{c.satisfied ? t('common.yes') : t('common.no')}</Badge>
            </li>
          ))}
        </ul>
        <div className="row" style={{ marginBlockStart: 'var(--s-4)' }}>
          <PreviewDisabledAction label="activate_real_live" danger />
        </div>
      </Card>
    </div>
  );
}
