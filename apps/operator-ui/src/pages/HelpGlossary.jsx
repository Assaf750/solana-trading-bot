import { useState } from 'react';
import { useI18n } from '../i18n/index.jsx';
import PageHead from '../components/PageHead.jsx';
import { Card, Badge, EmptyState } from '../components/index.jsx';
import { GLOSSARY } from '../fixtures/index.js';

const HOWTO = [
  {
    q_ar: 'كيف أبدأ من الصفر؟', q_en: 'How do I start from zero?',
    a_ar: 'افتح «معالج الإعداد»: أنشئ الخزنة → الصق مفتاح RPC من Helius → طبّق حدود البداية الآمنة → تابِع محفظة رابحة. عندها يبدأ التداول الورقي تلقائياً بأسعار حقيقية.',
    a_en: 'Open the Setup Wizard: create the vault → paste your Helius RPC → apply safe starter limits → follow a winning wallet. Paper trading then starts automatically at real prices.',
  },
  {
    q_ar: 'كيف أحلّل محفظة قبل نسخها؟', q_en: 'How do I analyze a wallet before copying?',
    a_ar: 'في «كونسول المحافظ» اضغط «🔍 تحليل» — يمسح تاريخ المحفظة من السلسلة ويحسب نسبة الربح، الربح المحقّق، توزيع النتائج، وإشارات البوت. كله من بيانات حقيقية، لا تُختلق.',
    a_en: 'On the Wallet Workspace press “🔍 Analyze” — it scans the wallet’s on-chain history and computes win rate, realized PnL, outcome distribution, and bot signals. All from real data, never fabricated.',
  },
  {
    q_ar: 'كيف أوقف كل شيء فوراً؟', q_en: 'How do I stop everything instantly?',
    a_ar: 'زر الإيقاف ⛔ في صفحة «التنبيهات» يوقف كل التداول فوراً، يقفل الموقّع، وينقل النظام إلى KILLED. حالته محفوظة — إعادة التشغيل لا تلغيه. للفك: اكتب DISENGAGE.',
    a_en: 'The ⛔ button on the Alerts page halts all trading instantly, locks the signer, and moves the system to KILLED. Persisted — a restart will not clear it. To clear: type DISENGAGE.',
  },
  {
    q_ar: 'كيف أنتقل للتداول الحقيقي؟', q_en: 'How do I go to real trading?',
    a_ar: 'خطوة منفصلة بقرارك (مثل «إيداع» في باينانس): موّل محفظة تنفيذ مخصّصة → استورد مفتاحها في «محافظي والأموال» → افتح جلسة توقيع بحدود آمنة → في «الإعدادات والأمان» اكتب ACTIVATE-REAL-LIVE. يصبح التنفيذ الحقيقي متاحًا بعد ضبط هذه المتطلبات؛ أنت من يقرّر متى تبدأ وتبقى متحكّمًا في أموالك الحقيقية.',
    a_en: 'A separate step you control (like a Binance “deposit”): fund a dedicated execution wallet → import its key on My Wallets & Funds → open a signing session with safe bounds → on Settings & Safety type ACTIVATE-REAL-LIVE. Real execution becomes available once these are configured; you decide when to start, and you stay in control of real money.',
  },
  {
    q_ar: 'لماذا تُعرض بعض المقاييس «غير متوفّر»؟', q_en: 'Why do some metrics show “unavailable”?',
    a_ar: 'لأن البيانات الكافية لم تتراكم بعد. التطبيق لا يختلق رقماً أبداً — يعرض «غير متوفّر» حتى تتوفّر بيانات حقيقية. هذه ميزة ثقة.',
    a_en: 'Because enough data has not accrued yet. The app never fabricates a number — it shows “unavailable” until real data exists. That is a trust feature.',
  },
];

export default function HelpGlossary() {
  const { t, lang } = useI18n();
  const ar = lang === 'ar';
  const [q, setQ] = useState('');

  const rows = (GLOSSARY || [])
    .map((g) => ({ ...g, definition: ar ? g.def_ar : g.def_en }))
    .filter((g) => {
      if (!q.trim()) return true;
      const s = q.trim().toLowerCase();
      return `${g.term} ${g.ssot} ${g.definition}`.toLowerCase().includes(s);
    });

  return (
    <div className="stack">
      <PageHead title={ar ? 'المساعدة والمسرد' : 'Help & Glossary'} sub={ar ? 'كيف تستخدم التطبيق + معاني المصطلحات' : 'How to use the app + what the terms mean'} />

      <Card title={ar ? '❔ كيف أفعل…؟' : '❔ How do I…?'}>
        {HOWTO.map((h, i) => (
          <details key={i} open={i === 0} style={{ padding: '8px 0', borderBottom: '1px solid var(--c-border)' }}>
            <summary style={{ cursor: 'pointer', fontWeight: 650, color: 'var(--c-brand)' }}>{ar ? h.q_ar : h.q_en}</summary>
            <p className="muted" style={{ fontSize: 'var(--fs-sm)', marginBlockStart: 6 }}>{ar ? h.a_ar : h.a_en}</p>
          </details>
        ))}
      </Card>

      <Card title={ar ? 'المسرد' : 'Glossary'} right={<Badge tone="info">SSOT-aligned</Badge>}>
        <div className="filterbar" style={{ margin: 0, marginBlockEnd: 'var(--s-3)', background: 'transparent', border: 0, padding: 0 }}>
          <input className="search grow" placeholder={ar ? 'بحث في المصطلحات…' : 'Search terms…'} value={q} onChange={(e) => setQ(e.target.value)} />
          <span className="muted fs-xs">{rows.length}</span>
        </div>
        {rows.length === 0 ? <EmptyState message={ar ? 'لا نتائج' : 'No matches'} /> : (
          <div className="table-wrap">
            <table className="data">
              <thead><tr><th className="nosort">{ar ? 'المصطلح' : 'term'}</th><th className="nosort">source_of_truth_field</th><th className="nosort">{ar ? 'التعريف' : 'definition'}</th></tr></thead>
              <tbody>
                {rows.map((g) => (
                  <tr key={g.term}>
                    <td style={{ fontWeight: 600 }}>{g.term}</td>
                    <td className="mono faint fs-xs">{g.ssot}</td>
                    <td style={{ whiteSpace: 'normal' }}>{g.definition}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>
    </div>
  );
}
