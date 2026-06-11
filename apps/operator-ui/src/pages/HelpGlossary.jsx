import { useState } from 'react';
import { useI18n } from '../i18n/index.jsx';
import PageHead from '../components/PageHead.jsx';
import { Card, Badge, DataTable } from '../components/index.jsx';
import { GLOSSARY } from '../fixtures/index.js';

export default function HelpGlossary() {
  const { t, lang } = useI18n();
  const [open, setOpen] = useState(null);

  const rows = GLOSSARY.map((g) => ({
    ...g,
    definition: lang === 'ar' ? g.def_ar : g.def_en
  }));

  return (
    <div className="stack">
      <PageHead title={t('help.title')} sub={t('help.sub')} />

      <Card title={t('help.howto')}>
        <details open>
          <summary style={{ cursor: 'pointer', fontWeight: 600 }}>
            {lang === 'ar' ? 'كيف أُصلح مفتاح مزوّد؟' : 'How do I fix a provider key?'}
          </summary>
          <p className="muted" style={{ fontSize: 'var(--fs-sm)' }}>
            {lang === 'ar'
              ? 'الواجهة تعرض مرجعاً مُقنّعاً فقط (مثل provider_key_ref: ****). لا يوجد حقل مفتاح خام. يُحدَّث السرّ المُشار إليه خارج الواجهة؛ ثم يعرض النظام حالة الاتصال الجديدة.'
              : 'The UI shows only a masked reference (e.g. provider_key_ref: ****). There is no raw key field. Update the referenced secret out-of-band; the system then reflects the new connection status. The raw key never appears in UI, logs, exports or backups.'}
          </p>
        </details>
        <details>
          <summary style={{ cursor: 'pointer', fontWeight: 600 }}>
            {lang === 'ar' ? 'ماذا يعني rejected_reason؟' : 'What does rejected_reason mean?'}
          </summary>
          <p className="muted" style={{ fontSize: 'var(--fs-sm)' }}>
            {lang === 'ar'
              ? 'سبب عدم المضي بفرصة (مثل token2022_dangerous_extension أو unknown_quote_mint). يعكس قراراً ولا يحجب بنفسه، والاكتشاف ليس إشارة شراء.'
              : 'Why an opportunity did not proceed (e.g. token2022_dangerous_extension, unknown_quote_mint, dex_only_signal). It reflects a decision and does not block by itself; discovery alone is never a buy signal.'}
          </p>
        </details>
        <details>
          <summary style={{ cursor: 'pointer', fontWeight: 600 }}>
            {lang === 'ar' ? 'لماذا التشغيل الحي محجوب؟' : 'Why is REAL-LIVE blocked?'}
          </summary>
          <p className="muted" style={{ fontSize: 'var(--fs-sm)' }}>
            {lang === 'ar'
              ? 'هذه النسخة قراءة فقط فوق بيانات محاكاة، ووصلة التفعيل لا تحمل أي عنصر حي ولا يمكن أن تكون جاهزة أبداً. activation_performed قيمة ثابتة false.'
              : 'This build is read-only over simulated data, and the activation seam carries no live primitive — it can never be ready. activation_performed is a fixed literal false.'}
          </p>
        </details>
      </Card>

      <Card title={t('help.glossary')} right={<Badge tone="info">SSOT-aligned</Badge>}>
        <DataTable
          searchKeys={['term', 'ssot', 'definition']}
          columns={[
            { key: 'term', label: t('help.term'), render: (v, r) => (
                <button className="btn" style={{ textAlign: 'start' }} onClick={() => setOpen(open === r.term ? null : r.term)}>{v}</button>
              ) },
            { key: 'ssot', label: t('help.ssotField'), render: (v) => <span className="mono faint">{v}</span> },
            { key: 'definition', label: t('help.definition'), render: (v, r) => (
                <span style={{ whiteSpace: 'normal', display: 'inline-block', maxWidth: 560 }}>
                  {open === r.term ? v : `${v.slice(0, 90)}${v.length > 90 ? '…' : ''}`}
                </span>
              ) }
          ]}
          rows={rows}
        />
      </Card>
    </div>
  );
}
