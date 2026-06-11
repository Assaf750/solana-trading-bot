import { useState } from 'react';
import { useI18n } from '../i18n/index.jsx';
import PageHead from '../components/PageHead.jsx';
import TraceTimeline from '../components/TraceTimeline.jsx';
import { Card, Badge, DangerNote, DataTable, UnavailableValue } from '../components/index.jsx';
import { OPPORTUNITIES, traceFor } from '../fixtures/index.js';

const HUNT_TONE = {
  accepted: 'ok', entered: 'ok', ranked: 'info', discovered: 'info',
  gated: 'warn', watch_only: 'warn', rejected: 'danger', expired: 'neutral'
};

export default function NewCoinRadar() {
  const { t } = useI18n();
  const [selected, setSelected] = useState(OPPORTUNITIES[0]);

  const rows = OPPORTUNITIES.map((o) => ({
    ...o,
    __onClick: () => setSelected(o),
    __selected: selected && selected.id === o.id
  }));

  return (
    <div className="stack">
      <PageHead title={t('radar.title')} sub={t('radar.sub')} />

      <DangerNote tone="warn" locked>{t('radar.rankingOnly')}</DangerNote>
      <DangerNote tone="info">{t('radar.noBuy')}</DangerNote>

      <Card title={t('radar.title')} right={<Badge tone="sim">{t('app.simulated')}</Badge>}>
        <DataTable
          searchKeys={['symbol', 'hunt_status', 'rejected_reason', 'accepted_reason']}
          initialSort={{ key: 'new_token_priority_score', dir: 'desc' }}
          columns={[
            { key: 'new_token_priority_score', label: t('radar.priorityScore'), cellClass: 'num', render: (v) => <span className="mono">{v.toFixed(2)}</span> },
            { key: 'symbol', label: t('common.token'), render: (v, r) => (<span><b>{v}</b> <span className="faint mono" style={{ fontSize: 'var(--fs-xs)' }}>{r.mint}</span></span>) },
            { key: 'hunt_status', label: t('radar.huntStatus'), render: (v) => <Badge tone={HUNT_TONE[v] || 'neutral'}>{v}</Badge> },
            { key: 'quote_mint', label: t('radar.quoteMint'), render: (v) => <Badge tone={v === 'unknown' ? 'danger' : 'neutral'}>{v}</Badge> },
            { key: 'accepted_reason', label: t('radar.acceptedReason'), render: (v) => <UnavailableValue value={v} format={(x) => <span className="mono pos">{x}</span>} /> },
            { key: 'rejected_reason', label: t('radar.rejectedReason'), render: (v) => <UnavailableValue value={v} format={(x) => <span className="mono neg">{x}</span>} /> }
          ]}
          rows={rows}
        />
        <p className="faint" style={{ fontSize: 'var(--fs-xs)', marginBlockEnd: 0 }}>
          {t('radar.selectHint')}
        </p>
      </Card>

      {selected && (
        <Card title={`${t('radar.perOppTrace')} — ${selected.symbol}`} right={<Badge tone={HUNT_TONE[selected.hunt_status]}>{selected.hunt_status}</Badge>}>
          <TraceTimeline trace={traceFor(selected.trace)} />
        </Card>
      )}
    </div>
  );
}
