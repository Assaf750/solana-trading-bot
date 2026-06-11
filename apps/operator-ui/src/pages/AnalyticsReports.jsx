import { useI18n } from '../i18n/index.jsx';
import PageHead from '../components/PageHead.jsx';
import { Card, Badge, DangerNote, DataTable, UnavailableValue, PreviewDisabledAction } from '../components/index.jsx';
import { PAPER_AGGREGATION, DIVERGENCE, NET_BUSINESS } from '../fixtures/index.js';

const pct = (v) => `${(v * 100).toFixed(0)}%`;
const num = (v) => v.toFixed(2);
const usd = (v) => `$${Number(v).toFixed(2)}`;
const DIV_TONE = { within_band: 'ok', elevated: 'warn', high: 'danger' };

export default function AnalyticsReports() {
  const { t } = useI18n();
  return (
    <div className="stack">
      <PageHead title={t('analytics.title')} sub={t('analytics.sub')} />

      <DangerNote tone="warn" locked>{t('analytics.disclaimer')}</DangerNote>

      <Card title={t('analytics.paperAgg')} right={<Badge tone="sim">{t('app.simulated')}</Badge>}>
        <DataTable
          searchKeys={['wallet']}
          columns={[
            { key: 'wallet', label: t('common.wallet'), render: (v) => <span className="mono">{v}</span> },
            { key: 'max_drawdown', label: 'max_drawdown', cellClass: 'num', render: (v) => <UnavailableValue value={v} format={pct} /> },
            { key: 'win_rate', label: 'win_rate', cellClass: 'num', render: (v) => <UnavailableValue value={v} format={pct} /> },
            { key: 'avg_win', label: 'avg_win', cellClass: 'num', render: (v) => <UnavailableValue value={v} format={usd} /> },
            { key: 'avg_loss', label: 'avg_loss', cellClass: 'num', render: (v) => <UnavailableValue value={v} format={usd} /> },
            { key: 'expectancy', label: 'expectancy', cellClass: 'num', render: (v) => <UnavailableValue value={v} format={num} /> },
            { key: 'profit_factor', label: 'profit_factor', cellClass: 'num', render: (v) => <UnavailableValue value={v} format={num} /> },
            { key: 'failed_trade_rate', label: 'failed_trade_rate', cellClass: 'num', render: (v) => <UnavailableValue value={v} format={pct} /> }
          ]}
          rows={PAPER_AGGREGATION}
        />
      </Card>

      <div className="grid cols-2">
        <Card title={t('analytics.divergence')} right={<Badge tone="sim">{t('app.simulated')}</Badge>} sub={t('analytics.divergenceNote')}>
          <ul style={{ listStyle: 'none', padding: 0, margin: 0 }}>
            {DIVERGENCE.map((d) => (
              <li key={d.dimension} className="row" style={{ justifyContent: 'space-between', padding: '7px 0', borderBottom: '1px solid var(--c-border)' }}>
                <span className="mono">{d.dimension}</span>
                <Badge tone={DIV_TONE[d.status]}>{d.status}</Badge>
              </li>
            ))}
          </ul>
        </Card>

        <Card title={t('analytics.netBusiness')} right={<Badge tone="sim">{t('app.simulated')}</Badge>}
          sub="positive trade P&L ≠ positive business P&L">
          <div className="metric" style={{ marginBlockEnd: 'var(--s-3)' }}>
            <span className="label">trade_net_pnl</span>
            <span className="value mono pos">{usd(NET_BUSINESS.trade_net_pnl)}</span>
          </div>
          <div className="row" style={{ marginBlockEnd: 'var(--s-3)' }}>
            <span className="muted">candidate_net_business_pnl_status:</span>
            <Badge tone={NET_BUSINESS.status === 'complete' ? 'ok' : 'warn'}>{NET_BUSINESS.status}</Badge>
          </div>
          <dl className="kv">
            {NET_BUSINESS.components.map((c) => (
              <div key={c.component} style={{ display: 'contents' }}>
                <dt className="mono" style={{ fontSize: 'var(--fs-xs)' }}>{c.component}</dt>
                <dd className={c.value == null ? '' : 'neg'}>
                  <UnavailableValue value={c.value} format={usd} />
                </dd>
              </div>
            ))}
          </dl>
        </Card>
      </div>

      <Card title="Export (advisory)" sub="Exports are redacted and provenance-tagged; missing metrics render unavailable. Start-export is a candidate capability — preview only.">
        <div className="row" style={{ gap: 'var(--s-4)' }}>
          <PreviewDisabledAction label="start_export_job (markdown)" />
          <PreviewDisabledAction label="start_export_job (csv)" />
        </div>
      </Card>
    </div>
  );
}
