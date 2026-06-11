import { useEffect, useState } from 'react';
import { useI18n } from '../i18n/index.jsx';
import PageHead from '../components/PageHead.jsx';
import { Card, Badge, DangerNote, EmptyState } from '../components/index.jsx';
import { api } from '../api/client.js';
import { useBackend } from '../api/useBackend.jsx';

export default function WalletIntelligence() {
  const { t, lang } = useI18n();
  const ar = lang === 'ar';
  const { connected } = useBackend();
  const [wallets, setWallets] = useState([]);
  const [addr, setAddr] = useState('');
  const [label, setLabel] = useState('');
  const [mode, setMode] = useState('follow_entry_user_exit');
  const [msg, setMsg] = useState(null);

  async function load() {
    const r = await api.wallets();
    if (r.ok) setWallets(r.data.wallets || []);
  }
  useEffect(() => { if (connected) load(); }, [connected]);

  async function register() {
    setMsg(null);
    const r = await api.registerWallet({ tracked_wallet_address: addr.trim(), label: label.trim(), copy_mode: mode });
    if (r.ok) {
      setAddr(''); setLabel('');
      setMsg({ tone: 'ok', text: ar ? 'سُجلت المحفظة ✓ (المتابعة OFF افتراضياً — فعّلها بنفسك)' : 'Wallet registered ✓ (follow defaults OFF — enable it yourself)' });
    } else {
      setMsg({ tone: 'danger', text: `${r.data?.error || r.data?.api_error_code || 'rejected'}` });
    }
    load();
  }

  async function toggleFollow(w) {
    await api.setFollow(w.wallet_id, !w.follow_enabled);
    load();
  }

  async function remove(w) {
    await api.removeWallet(w.wallet_id);
    load();
  }

  if (!connected) {
    return (
      <div className="stack">
        <PageHead title={t('wallets.title')} sub={t('wallets.sub')} />
        <EmptyState message={ar ? 'الخادم غير متصل — شغّل START.bat' : 'Server offline — run START.bat'} />
      </div>
    );
  }

  return (
    <div className="stack">
      <PageHead title={t('wallets.title')} sub={ar ? 'سجّل المحافظ الرابحة التي تريد نسخها وتحكم في متابعتها' : 'Register the winning wallets you want to copy and control following'} />

      <Card title={ar ? '➕ تسجيل محفظة متبوعة' : '➕ Register tracked wallet'}>
        <div className="row" style={{ flexWrap: 'wrap' }}>
          <input
            className="search" dir="ltr" style={{ flex: '2 1 320px' }}
            placeholder={ar ? 'عنوان المحفظة (base58)' : 'wallet address (base58)'}
            value={addr} onChange={(e) => setAddr(e.target.value)}
          />
          <input
            className="search" style={{ flex: '1 1 140px' }}
            placeholder={ar ? 'اسم وصفي (اختياري)' : 'label (optional)'}
            value={label} onChange={(e) => setLabel(e.target.value)}
          />
          <div className="seg" role="group">
            <button className={mode === 'follow_entry_user_exit' ? 'on' : ''} onClick={() => setMode('follow_entry_user_exit')}>follow_entry</button>
            <button className={mode === 'full_mirror' ? 'on' : ''} onClick={() => setMode('full_mirror')}>full_mirror</button>
          </div>
          <button className="btn" onClick={register} disabled={!addr.trim()}>{ar ? 'تسجيل' : 'Register'}</button>
        </div>
        {mode === 'full_mirror' && (
          <DangerNote tone="warn" locked>
            {ar ? 'full_mirror وضع متقدم: ينسخ البيع والشراء نسبياً. الافتراضي الآمن هو follow_entry_user_exit.' : 'full_mirror is advanced: mirrors buys AND sells proportionally. The safe default is follow_entry_user_exit.'}
          </DangerNote>
        )}
        {msg && <div style={{ marginBlockStart: 8 }}><Badge tone={msg.tone}>{msg.text}</Badge></div>}
      </Card>

      <Card title={ar ? `المحافظ المسجلة (${wallets.length})` : `Registered wallets (${wallets.length})`}>
        {wallets.length === 0 ? (
          <EmptyState message={ar ? 'لا محافظ مسجلة بعد — سجّل أول محفظة أعلاه' : 'No wallets yet — register your first one above'} />
        ) : (
          <div className="table-wrap">
            <table className="data">
              <thead>
                <tr>
                  <th className="nosort">{t('common.wallet')}</th>
                  <th className="nosort">label</th>
                  <th className="nosort">copy_mode</th>
                  <th className="nosort">{ar ? 'المتابعة' : 'follow'}</th>
                  <th className="nosort"></th>
                </tr>
              </thead>
              <tbody>
                {wallets.map((w) => (
                  <tr key={w.wallet_id}>
                    <td className="mono" dir="ltr">{w.tracked_wallet_address.slice(0, 6)}…{w.tracked_wallet_address.slice(-6)}</td>
                    <td>{w.label || <span className="faint">—</span>}</td>
                    <td><Badge tone={w.copy_mode === 'full_mirror' ? 'warn' : 'info'}>{w.copy_mode}</Badge></td>
                    <td>
                      <button className={`btn toggle ${w.follow_enabled ? 'on' : ''}`} onClick={() => toggleFollow(w)}>
                        {w.follow_enabled ? (ar ? 'متابَعة ✓' : 'following ✓') : (ar ? 'متوقفة' : 'off')}
                      </button>
                    </td>
                    <td>
                      <button className="btn" onClick={() => remove(w)}>{ar ? 'حذف' : 'Remove'}</button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      <DangerNote tone="info">
        {ar
          ? 'تحليلات الربحية وقابلية النسخ (copyability/veto/drift) تُحسب من بيانات السوق الحية بعد تشغيل محرك الورق (M3) — لن تُختلق أرقام قبل توفر دليل حقيقي.'
          : 'Profitability and copyability analytics (veto/drift) are computed from live market data once the paper engine (M3) runs — numbers are never fabricated before real evidence exists.'}
      </DangerNote>
    </div>
  );
}
