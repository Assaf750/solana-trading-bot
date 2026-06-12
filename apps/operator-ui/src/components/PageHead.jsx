import { useI18n } from '../i18n/index.jsx';
import { Badge, StalenessTag } from './index.jsx';
import { useBackend } from '../api/useBackend.jsx';

// Mode-aware page header. Reflects the ACTUAL operating mode instead of a hardcoded
// "SIMULATED / READ-ONLY" tag: PAPER while simulated, REAL-LIVE once the owner
// activates real trading, OFFLINE when the server is unreachable.
export default function PageHead({ title, sub, fresh = true }) {
  const { lang } = useI18n();
  const ar = lang === 'ar';
  const { status, connected } = useBackend();
  const live = status?.mode === 'real_live';
  return (
    <header className="page-head">
      <h1>{title}</h1>
      {sub && <div className="sub">{sub}</div>}
      <div className="page-head-tags">
        {!connected ? (
          <Badge tone="danger">{ar ? 'غير متصل' : 'OFFLINE'}</Badge>
        ) : live ? (
          <Badge tone="danger">{ar ? '🔴 تداول حقيقي' : '🔴 REAL-LIVE'}</Badge>
        ) : (
          <Badge tone="sim">{ar ? 'ورقي · محاكاة' : 'PAPER · simulated'}</Badge>
        )}
        <StalenessTag fresh={fresh} />
      </div>
    </header>
  );
}
