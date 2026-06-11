import { useI18n } from '../i18n/index.jsx';
import PageHead from '../components/PageHead.jsx';
import { Card, Badge, DangerNote, DataTable, UnavailableValue, PreviewDisabledAction, toneFor } from '../components/index.jsx';
import { WALLETS } from '../fixtures/index.js';

const STATUS_TONE = { copy_allowed: 'ok', watch_only: 'warn', candidate: 'info', degraded: 'warn', banned: 'danger' };
const pct = (v) => `${(v * 100).toFixed(0)}%`;
const ratio = (v) => v.toFixed(2);

export default function WalletIntelligence() {
  const { t } = useI18n();
  return (
    <div className="stack">
      <PageHead title={t('wallets.title')} sub={t('wallets.sub')} />

      <DangerNote tone="info">{t('wallets.profitFactorNote')}</DangerNote>

      <Card title={t('wallets.tracked')} right={<Badge tone="sim">{t('app.simulated')}</Badge>}>
        <DataTable
          searchKeys={['address', 'wallet_type', 'tracked_wallet_status', 'advisory']}
          initialSort={{ key: 'profitability_win_rate', dir: 'desc' }}
          columns={[
            { key: 'address', label: t('common.wallet'), render: (v) => <span className="mono">{v}</span> },
            { key: 'wallet_type', label: t('wallets.walletType'), render: (v) => <span className="mono faint" style={{ fontSize: 'var(--fs-xs)' }}>{v}</span> },
            { key: 'tracked_wallet_status', label: t('wallets.walletStatus'), render: (v) => <Badge tone={STATUS_TONE[v] || 'neutral'}>{v}</Badge> },
            { key: 'copyability_by_brain', label: t('wallets.copyability'), render: (v, r) => (
                <span className="row" style={{ gap: 4 }}>
                  <Badge tone={v === 'none' ? 'danger' : v === 'both' ? 'ok' : 'info'}>{v}</Badge>
                  {r.copyability_component_veto && <Badge tone="danger">veto</Badge>}
                </span>
              ) },
            { key: 'copyability_veto_reason', label: t('wallets.vetoReason'), render: (v) => <UnavailableValue value={v} format={(x) => <span className="mono neg">{x}</span>} /> },
            { key: 'profitability_win_rate', label: t('wallets.winRate'), cellClass: 'num', render: (v) => <UnavailableValue value={v} format={pct} /> },
            { key: 'profitability_win_loss_ratio', label: t('wallets.winLoss'), cellClass: 'num', render: (v) => <UnavailableValue value={v} format={ratio} /> },
            { key: 'profitability_profit_factor', label: t('wallets.profitFactor'), cellClass: 'num', render: (v) => <UnavailableValue value={v} format={ratio} /> },
            { key: 'advisory', label: t('wallets.advisory'), render: (v) => <Badge tone="info">{v.replace('PROFITABILITY_ADVISORY_', '')}</Badge> },
            { key: 'drift_flag', label: t('wallets.drift'), render: (v, r) => v ? <Badge tone="warn">{r.drift_reason}</Badge> : <span className="faint">—</span> },
            { key: '__act', label: '', sortable: false, render: () => (
                <span className="row" style={{ gap: 4 }}>
                  <PreviewDisabledAction label="disable_wallet_follow" />
                </span>
              ) }
          ]}
          rows={WALLETS}
        />
      </Card>

      <Card title={t('wallets.profitability')} sub="profitability-intelligence read-model — advisory tokens; counts-based win/loss; profit_factor never reconstructed.">
        <div className="grid cols-2">
          {WALLETS.map((w) => (
            <div key={w.id} className="card" style={{ background: 'var(--c-bg-elev-2)' }}>
              <div className="card-head">
                <h3 className="mono" style={{ fontSize: 'var(--fs-md)' }}>{w.address}</h3>
                <span className="card-head-spacer" />
                <Badge tone={STATUS_TONE[w.tracked_wallet_status] || 'neutral'}>{w.tracked_wallet_status}</Badge>
              </div>
              <dl className="kv">
                <dt>win_rate</dt><dd><UnavailableValue value={w.profitability_win_rate} format={pct} /></dd>
                <dt>win_loss_ratio</dt><dd><UnavailableValue value={w.profitability_win_loss_ratio} format={ratio} /></dd>
                <dt>profit_factor</dt><dd><UnavailableValue value={w.profitability_profit_factor} format={ratio} /></dd>
                <dt>advisory</dt><dd className="mono" style={{ fontSize: 'var(--fs-xs)' }}>{w.advisory}</dd>
              </dl>
            </div>
          ))}
        </div>
      </Card>
    </div>
  );
}
