import { useI18n } from '../i18n/index.jsx';
import { SimulatedBadge, ReadOnlyBadge, StalenessTag } from './index.jsx';

export default function PageHead({ title, sub, fresh = true }) {
  const { t } = useI18n();
  return (
    <header className="page-head">
      <h1>{title}</h1>
      {sub && <div className="sub">{sub}</div>}
      <div className="page-head-tags">
        <SimulatedBadge />
        <ReadOnlyBadge />
        <span className="faint" style={{ fontSize: 'var(--fs-xs)' }}>
          {t('notice.truthMode')}: {t('notice.simulatedTag')}
        </span>
        <StalenessTag fresh={fresh} />
      </div>
    </header>
  );
}
