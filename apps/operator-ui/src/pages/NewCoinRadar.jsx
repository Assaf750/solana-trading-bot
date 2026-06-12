import { useI18n } from '../i18n/index.jsx';
import PageHead from '../components/PageHead.jsx';
import { Card, Badge, DangerNote, EmptyState } from '../components/index.jsx';
import { Link } from 'react-router-dom';

export default function NewCoinRadar() {
  const { lang } = useI18n();
  const ar = lang === 'ar';
  return (
    <div className="stack">
      <PageHead
        title={ar ? 'رادار العملات الجديدة' : 'New Coin Radar'}
        sub={ar ? 'اكتشاف وترتيب الفرص — عرض/قراءة فقط، ليس إشارة شراء' : 'Discover & rank opportunities — read-only, not a buy signal'}
      />

      <DangerNote tone="info">
        {ar
          ? 'الرادار قراءة وترتيب فقط — لا زرّ شراء، واكتشاف عملة وحده ليس إشارة تنفيذ. التنفيذ يبقى wallet/signal-led عبر كونسول المحافظ.'
          : 'The radar is read/rank only — no buy button, and discovering a mint is not an execution signal. Execution stays wallet/signal-led via the Wallet Workspace.'}
      </DangerNote>

      <Card title={ar ? 'محرّك الاكتشاف' : 'Discovery engine'} right={<Badge tone="warn">{ar ? 'المرحلة 3' : 'Phase 3'}</Badge>}>
        <EmptyState message={ar
          ? 'محرّك اكتشاف العملات الجديدة قيد البناء (المرحلة 3) — يتطلّب مصدر بيانات. لن تُعرض فرص مختلقة قبل توفّر مصدر حقيقي.'
          : 'The new-coin discovery engine is being built (Phase 3) — it needs a data source. No fabricated opportunities are shown before a real source exists.'} />
        <div className="row" style={{ marginBlockStart: 'var(--s-3)' }}>
          <Link className="btn primary" to="/wallets">{ar ? 'كونسول المحافظ ←' : 'Wallet Workspace →'}</Link>
          <span className="muted" style={{ fontSize: 'var(--fs-sm)' }}>
            {ar ? 'حالياً: اكتشف وانسخ عبر تحليل المحافظ الرابحة.' : 'For now: discover & copy via winning-wallet analysis.'}
          </span>
        </div>
      </Card>
    </div>
  );
}
