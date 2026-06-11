import { useI18n } from '../i18n/index.jsx';
import PageHead from '../components/PageHead.jsx';
import TraceTimeline from '../components/TraceTimeline.jsx';
import {
  Card, Metric, Badge, DangerNote, DataTable, UnavailableValue, PreviewDisabledAction, toneFor
} from '../components/index.jsx';
import { DECISION_TRACE, POSITIONS, INTENTS, TRADES, PAPER_PNL } from '../fixtures/index.js';

const usd = (v) => `$${Number(v).toFixed(2)}`;

const EXIT_TONE = { feasible: 'ok', thin_liquidity: 'warn', route_unhealthy: 'danger', dust: 'neutral' };

export default function TradingWorkspace() {
  const { t } = useI18n();
  const markValid = PAPER_PNL.candidate_mark_status === 'valid';

  return (
    <div className="stack">
      <PageHead title={t('workspace.title')} sub={t('workspace.sub')} />
      <DangerNote tone="sim">{t('workspace.actionsDisabled')}</DangerNote>

      <Card title={t('workspace.decisionTrace')}>
        <TraceTimeline trace={DECISION_TRACE} />
      </Card>

      <Card title={t('workspace.paperPnl')} right={<Badge tone="sim">{t('app.simulated')}</Badge>}
        sub={`candidate_mark_status: ${PAPER_PNL.candidate_mark_status}`}>
        <div className="grid cols-4">
          <Metric label={t('workspace.realized')} value={usd(PAPER_PNL.candidate_realized_pnl)} mono tone="pos" />
          <Metric label={t('workspace.paperNet')} value={usd(PAPER_PNL.candidate_paper_pnl)} mono tone="pos" />
          <Metric label={t('workspace.fees')} value={usd(PAPER_PNL.candidate_fees_total)} mono />
          <Metric label={t('workspace.slippage')} value={usd(PAPER_PNL.candidate_slippage_cost)} mono />
        </div>
        <div className="grid cols-3" style={{ marginBlockStart: 'var(--s-4)' }}>
          <div className="metric">
            <span className="label">candidate_unrealized_pnl</span>
            <span className="value mono">
              <UnavailableValue value={markValid ? PAPER_PNL.candidate_unrealized_pnl : null} format={usd} />
            </span>
          </div>
          <PnlBreakdown title="candidate_pnl_by_copy_mode" map={PAPER_PNL.candidate_pnl_by_copy_mode} />
          <PnlBreakdown title="candidate_pnl_by_brain" map={PAPER_PNL.candidate_pnl_by_brain} />
        </div>
      </Card>

      <div className="grid cols-2">
        <Card title={t('workspace.positions')}>
          <DataTable
            searchKeys={['symbol', 'position_state']}
            initialSort={{ key: 'symbol', dir: 'asc' }}
            columns={[
              { key: 'symbol', label: t('common.token'), render: (v, r) => (<span><b>{v}</b> <span className="faint mono" style={{ fontSize: 'var(--fs-xs)' }}>{r.mint}</span></span>) },
              { key: 'position_state', label: t('common.state'), render: (v) => <Badge tone={toneFor(v)}>{v}</Badge> },
              { key: 'current_control_brain', label: 'brain', render: (v) => <span className="mono">{v}</span> },
              { key: 'copy_mode', label: 'copy_mode', render: (v) => <span className="mono">{v}</span> },
              { key: 'exit_feasibility', label: t('workspace.exitFeasibility'), render: (v) => <Badge tone={EXIT_TONE[v] || 'neutral'}>{v}</Badge> },
              { key: '__act', label: '', sortable: false, render: () => <PreviewDisabledAction label="manual_exit_position" /> }
            ]}
            rows={POSITIONS}
          />
        </Card>

        <Card title={t('workspace.intents')}>
          <DataTable
            searchKeys={['intent_type', 'bundle_status', 'failure_type']}
            columns={[
              { key: 'id', label: 'id', render: (v) => <span className="mono">{v}</span> },
              { key: 'intent_type', label: t('common.type'), render: (v) => <span className="mono">{v}</span> },
              { key: 'issuing_brain', label: 'brain', render: (v) => <span className="mono">{v}</span> },
              { key: 'bundle_status', label: 'bundle_status', render: (v) => <Badge tone={v === 'Landed' ? 'ok' : v === 'Pending' ? 'warn' : 'danger'}>{v}</Badge> },
              { key: 'failure_type', label: 'failure_type', render: (v) => <UnavailableValue value={v} /> },
              { key: '__act', label: '', sortable: false, render: () => <PreviewDisabledAction label="cancel_intent" /> }
            ]}
            rows={INTENTS}
          />
        </Card>
      </div>

      <Card title={t('workspace.trades')} right={<Badge tone="sim">{t('app.simulated')}</Badge>}>
        <DataTable
          searchKeys={['symbol', 'side']}
          columns={[
            { key: 'id', label: 'id', render: (v) => <span className="mono">{v}</span> },
            { key: 'symbol', label: t('common.token') },
            { key: 'side', label: 'side', render: (v) => <Badge tone={v === 'buy' ? 'info' : 'neutral'}>{v}</Badge> },
            { key: 'qty', label: 'qty', cellClass: 'num', render: (v) => v.toLocaleString() },
            { key: 'fill_price', label: 'fill_price', cellClass: 'num', render: (v) => v.toFixed(7) },
            { key: 'fees', label: 'fees', cellClass: 'num', render: usd },
            { key: 'slippage', label: 'slippage', cellClass: 'num', render: usd }
          ]}
          rows={TRADES}
        />
      </Card>

      <Card title={t('workspace.exitFeasibility')} sub="Per-position exit routing health (advisory). stop_loss never guarantees an exit in thin liquidity.">
        <div className="row" style={{ gap: 'var(--s-4)' }}>
          {POSITIONS.map((p) => (
            <span key={p.id} className="status-chip">
              <span className="mono">{p.symbol}</span>
              <Badge tone={EXIT_TONE[p.exit_feasibility] || 'neutral'}>{p.exit_feasibility}</Badge>
            </span>
          ))}
        </div>
        <div className="row" style={{ gap: 'var(--s-4)', marginBlockStart: 'var(--s-4)' }}>
          <PreviewDisabledAction label="emergency_exit_position" danger />
          <PreviewDisabledAction label="preview_batch_exit (per-position)" />
        </div>
      </Card>
    </div>
  );
}

function PnlBreakdown({ title, map }) {
  return (
    <div className="metric">
      <span className="label">{title}</span>
      <dl className="kv" style={{ marginBlockStart: 4 }}>
        {Object.entries(map).map(([k, v]) => (
          <div key={k} style={{ display: 'contents' }}>
            <dt className="mono">{k}</dt>
            <dd className={v >= 0 ? 'pos' : 'neg'}>{usd(v)}</dd>
          </div>
        ))}
      </dl>
    </div>
  );
}
