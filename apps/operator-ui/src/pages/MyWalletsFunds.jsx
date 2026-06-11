import { useI18n } from '../i18n/index.jsx';
import PageHead from '../components/PageHead.jsx';
import { Card, Metric, Badge, DangerNote, DataTable, PreviewDisabledAction, toneFor } from '../components/index.jsx';
import { EXECUTION_WALLETS, SETTLEMENT_WALLET, FUNDING_WALLET } from '../fixtures/index.js';

const sol = (v) => `${Number(v).toFixed(2)} SOL`;
const SIGNER_TONE = { ACTIVE: 'ok', DISABLED: 'neutral', DEGRADED: 'warn', REVOKED: 'danger' };

export default function MyWalletsFunds() {
  const { t } = useI18n();
  return (
    <div className="stack">
      <PageHead title={t('funds.title')} sub={t('funds.sub')} />

      <DangerNote tone="danger" locked>{t('funds.keyNote')}</DangerNote>

      <div className="grid cols-2">
        <Card title={t('funds.settlement')} right={<Badge tone="sim">{t('app.simulated')}</Badge>}>
          <div className="grid cols-2">
            <Metric label={t('funds.balance')} value={sol(SETTLEMENT_WALLET.balance_sol)} mono />
            <Metric label="address" value={<span className="mono" style={{ fontSize: 'var(--fs-md)' }}>{SETTLEMENT_WALLET.address}</span>} />
            <Metric label={t('funds.assignment')} value={<span className="mono" style={{ fontSize: 'var(--fs-md)' }}>{SETTLEMENT_WALLET.assignment_policy}</span>} />
            <Metric label={t('funds.sweepPolicy')} value={<span className="mono" style={{ fontSize: 'var(--fs-md)' }}>{SETTLEMENT_WALLET.sweep_policy}</span>} />
          </div>
        </Card>
        <Card title={t('funds.funding')} right={<Badge tone="sim">{t('app.simulated')}</Badge>}>
          <div className="grid cols-2">
            <Metric label={t('funds.balance')} value={sol(FUNDING_WALLET.balance_sol)} mono />
            <Metric label="address" value={<span className="mono" style={{ fontSize: 'var(--fs-md)' }}>{FUNDING_WALLET.address}</span>} />
          </div>
        </Card>
      </div>

      <Card title={t('funds.executionWallets')} right={<Badge tone="sim">{t('app.simulated')}</Badge>}>
        <DataTable
          searchKeys={['address', 'execution_wallet_status', 'key_custody_mode']}
          columns={[
            { key: 'address', label: t('common.wallet'), render: (v) => <span className="mono">{v}</span> },
            { key: 'execution_wallet_status', label: t('funds.walletState'), render: (v) => <Badge tone={toneFor(v)}>{v}</Badge> },
            { key: 'key_custody_mode', label: t('funds.keyCustody'), render: (v) => <span className="mono">{v}</span> },
            { key: 'signer_profile_status', label: t('funds.signerStatus'), render: (v) => <Badge tone={SIGNER_TONE[v] || 'neutral'}>{v}</Badge> },
            { key: 'balance_sol', label: t('funds.balance'), cellClass: 'num', render: sol },
            { key: 'provider_key_ref', label: t('funds.providerKey'), render: (v) => <span className="mono faint" title="by-reference placeholder only — never a raw key">🔒 {v}</span> },
            { key: '__act', label: '', sortable: false, render: () => (
                <span className="row" style={{ gap: 4 }}>
                  <PreviewDisabledAction label="activate_execution_wallet" />
                  <PreviewDisabledAction label="revoke_execution_wallet" danger />
                </span>
              ) }
          ]}
          rows={EXECUTION_WALLETS}
        />
        <div className="row" style={{ gap: 'var(--s-4)', marginBlockStart: 'var(--s-4)' }}>
          <PreviewDisabledAction label="create_asset_transfer_intent" />
          <PreviewDisabledAction label="rotate_execution_wallet" />
          <PreviewDisabledAction label="sweep_profits" />
        </div>
      </Card>
    </div>
  );
}
