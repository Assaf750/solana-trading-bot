import { useEffect, useState } from 'react';
import { useI18n } from '../i18n/index.jsx';
import PageHead from '../components/PageHead.jsx';
import { Card, Badge, DangerNote, EmptyState } from '../components/index.jsx';
import { api } from '../api/client.js';
import { useBackend } from '../api/useBackend.jsx';

const PROVIDER_SLOTS = [
  { name: 'helius_rpc_url', cfgKey: 'rpc_url_ref', ar: 'رابط RPC (Helius أو غيره)', en: 'RPC URL (Helius or other)', ph: 'https://mainnet.helius-rpc.com/?api-key=…' },
  { name: 'stream_endpoint', cfgKey: 'stream_ref', ar: 'رابط البث (LaserStream/WS)', en: 'Stream endpoint (LaserStream/WS)', ph: 'wss://…' },
  { name: 'jupiter_api_key', cfgKey: 'jupiter_key_ref', ar: 'مفتاح Jupiter API', en: 'Jupiter API key', ph: 'jup_…' },
];

export default function MyWalletsFunds() {
  const { t, lang } = useI18n();
  const ar = lang === 'ar';
  const { status, connected, refresh } = useBackend();
  const [secrets, setSecrets] = useState([]);
  const [pass, setPass] = useState('');
  const [msg, setMsg] = useState(null);
  const [inputs, setInputs] = useState({});
  const [signerKey, setSignerKey] = useState('');
  const [bounds, setBounds] = useState({ idle_timeout_ms: '', max_session_ms: '', max_session_notional_usd: '', lock_after_n_risk_rejections: '' });
  const [connTest, setConnTest] = useState(null);
  const [walletInfo, setWalletInfo] = useState(null);

  async function loadSecrets() {
    const r = await api.secrets();
    if (r.ok) setSecrets(r.data.secrets || []);
  }
  async function loadBounds() {
    const r = await api.config();
    if (r.ok) {
      const ss = r.data.signer_session || {};
      setBounds({
        idle_timeout_ms: ss.idle_timeout_ms ?? '',
        max_session_ms: ss.max_session_ms ?? '',
        max_session_notional_usd: ss.max_session_notional_usd ?? '',
        lock_after_n_risk_rejections: ss.lock_after_n_risk_rejections ?? '',
      });
    }
  }
  useEffect(() => { if (connected) { loadSecrets(); loadBounds(); } }, [connected]);

  function note(tone, arText, enText) { setMsg({ tone, text: ar ? arText : enText }); }

  async function vaultAction(kind) {
    setMsg(null);
    const r = kind === 'create' ? await api.vaultCreate(pass)
      : kind === 'unlock' ? await api.vaultUnlock(pass)
      : await api.vaultLock();
    if (r.ok) { setPass(''); note('ok', 'تم ✓', 'Done ✓'); }
    else note('danger', `فشل: ${r.data?.error || ''}`, `Failed: ${r.data?.error || ''}`);
    refresh(); loadSecrets();
  }

  async function storeProvider(slot) {
    setMsg(null);
    const value = inputs[slot.name];
    if (!value) return;
    const r = await api.storeSecret(slot.name, value);
    if (!r.ok) { note('danger', `رفض التخزين: ${r.data?.error || ''}`, `Store refused: ${r.data?.error || ''}`); return; }
    const r2 = await api.updateConfig({ providers: { [slot.cfgKey]: r.data.ref } });
    if (r2.ok) {
      setInputs({ ...inputs, [slot.name]: '' });
      note('ok', `حُفظ المفتاح مشفّراً (${r.data.masked}) وربط المرجع ✓`, `Key stored encrypted (${r.data.masked}) and ref linked ✓`);
    }
    refresh(); loadSecrets();
  }

  async function testConnection() {
    setConnTest({ testing: true });
    const r = await api.testProviderConnection();
    setConnTest(r.data);
  }

  async function checkWallet() {
    setWalletInfo({ checking: true });
    const r = await api.signerWallet();
    setWalletInfo(r.data);
  }
  // auto-check when a signer key is present
  useEffect(() => { if (connected && status?.signer?.key_imported) checkWallet(); }, [connected, status?.signer?.key_imported, status?.signer?.session_active]);

  async function importSigner() {
    setMsg(null);
    const r = await api.signerImportKey(signerKey);
    setSignerKey('');
    if (r.ok) note('ok', 'استُورد مفتاح التوقيع إلى الخزنة المشفّرة — لن يُعرض مرة أخرى أبداً.', 'Signer key imported into the encrypted vault — it will never be displayed again.');
    else note('danger', `رفض الاستيراد: ${r.data?.error || ''}`, `Import refused: ${r.data?.error || ''}`);
    refresh();
  }

  async function saveBounds() {
    const patch = { signer_session: Object.fromEntries(Object.entries(bounds).map(([k, v]) => [k, v === '' ? null : Number(v)])) };
    const r = await api.updateConfig(patch);
    if (r.ok) note('ok', 'حُفظت حدود الجلسة ✓', 'Session bounds saved ✓');
    else note('danger', 'رفض الحفظ — تحقق من القيم', 'Save rejected — check values');
    refresh();
  }

  async function applySafeSessionDefaults() {
    const safe = { idle_timeout_ms: 600000, max_session_ms: 3600000, max_session_notional_usd: 100, lock_after_n_risk_rejections: 3 };
    setBounds(Object.fromEntries(Object.entries(safe).map(([k, v]) => [k, String(v)])));
    const r = await api.updateConfig({ signer_session: safe });
    if (r.ok) note('ok', 'طُبِّقت حدود جلسة آمنة ✓ (قفل بعد 10د خمول / ساعة كحد أقصى / سقف $100 / 3 رفض)', 'Safe session bounds applied ✓ (lock after 10m idle / 1h max / $100 cap / 3 rejections)');
    else note('danger', 'رفض الحفظ', 'Save rejected');
    refresh();
  }

  async function sessionAction(open) {
    const r = open ? await api.signerOpenSession() : await api.signerLock();
    if (!r.ok) note('danger', `رفض: ${r.data?.error || ''}`, `Refused: ${r.data?.error || ''}`);
    refresh();
  }

  if (!connected) {
    return (
      <div className="stack">
        <PageHead title={t('funds.title')} sub={t('funds.sub')} />
        <EmptyState message={ar ? 'الخادم غير متصل — شغّل START.bat' : 'Server offline — run START.bat'} />
      </div>
    );
  }

  const vault = status?.vault || {};
  const signer = status?.signer || {};
  const signerTone = { ready: 'ok', degraded: 'warn', locked: 'warn', missing: 'danger', failed: 'danger' }[signer.signer_status] || 'neutral';

  return (
    <div className="stack">
      <PageHead title={t('funds.title')} sub={ar ? 'الخزنة المشفّرة · مفاتيح المزوّدين · مفتاح التوقيع — كل الأسرار محلية ومشفّرة' : 'Encrypted vault · provider keys · signer key — all secrets local and encrypted'} />

      <DangerNote tone="danger" locked>
        {ar
          ? 'الأسرار تُخزَّن مشفّرة على جهازك فقط (scrypt + AES-256-GCM). لا يُعرض أي سر خام بعد إدخاله — تظهر المراجع المقنّعة فقط. لا تشارك عبارة المرور مع أحد.'
          : 'Secrets are stored encrypted on YOUR machine only (scrypt + AES-256-GCM). No raw secret is ever displayed after entry — only masked refs. Never share your passphrase.'}
      </DangerNote>

      <Card title={ar ? '🔐 الخزنة (Vault)' : '🔐 Vault'} right={
        <Badge tone={vault.vault_unlocked ? 'ok' : vault.vault_exists ? 'warn' : 'danger'}>
          {vault.vault_unlocked ? (ar ? 'مفتوحة' : 'unlocked') : vault.vault_exists ? (ar ? 'مقفلة' : 'locked') : (ar ? 'غير منشأة' : 'not created')}
        </Badge>
      }>
        <div className="row">
          <input
            className="search" type="password" dir="ltr" style={{ width: 240 }}
            placeholder={ar ? 'عبارة المرور (8+ أحرف)' : 'passphrase (8+ chars)'}
            value={pass} onChange={(e) => setPass(e.target.value)}
          />
          {!vault.vault_exists && <button className="btn" onClick={() => vaultAction('create')} disabled={pass.length < 8}>{ar ? 'إنشاء الخزنة' : 'Create vault'}</button>}
          {vault.vault_exists && !vault.vault_unlocked && <button className="btn" onClick={() => vaultAction('unlock')} disabled={!pass}>{ar ? 'فتح' : 'Unlock'}</button>}
          {vault.vault_unlocked && <button className="btn" onClick={() => vaultAction('lock')}>{ar ? 'قفل' : 'Lock'}</button>}
          {msg && <Badge tone={msg.tone}>{msg.text}</Badge>}
        </div>
        <p className="muted" style={{ fontSize: 'var(--fs-sm)', marginBlockStart: 8 }}>
          {ar ? `أسرار مخزّنة: ${vault.secret_count ?? 0}` : `Stored secrets: ${vault.secret_count ?? 0}`}
        </p>
      </Card>

      <Card title={ar ? '🔑 مفاتيح المزوّدين (بالمرجع فقط)' : '🔑 Provider keys (by reference only)'}
        sub={ar ? 'أدخل المفتاح مرة واحدة؛ يُخزَّن مشفّراً ويُستخدم بالمرجع provider_key_ref. يتطلب خزنة مفتوحة.' : 'Enter once; stored encrypted, used via provider_key_ref. Requires unlocked vault.'}>
        {PROVIDER_SLOTS.map((slot) => {
          const stored = secrets.find((s) => s.name === slot.name);
          return (
            <div className="row" key={slot.name} style={{ padding: '8px 0', borderBottom: '1px solid var(--c-border)', flexWrap: 'wrap' }}>
              <span style={{ minWidth: 220 }}>{ar ? slot.ar : slot.en}</span>
              {stored
                ? <><Badge tone="ok">{stored.masked}</Badge><span className="mono muted" style={{ fontSize: 'var(--fs-xs)' }}>{`vault:${slot.name}`}</span></>
                : <Badge tone="danger">{ar ? 'غير مُدخل' : 'not set'}</Badge>}
              <input
                className="search" type="password" dir="ltr" style={{ flex: '1 1 220px' }}
                placeholder={slot.ph}
                value={inputs[slot.name] || ''}
                onChange={(e) => setInputs({ ...inputs, [slot.name]: e.target.value })}
                disabled={!vault.vault_unlocked}
              />
              <button className="btn" onClick={() => storeProvider(slot)} disabled={!vault.vault_unlocked || !inputs[slot.name]}>
                {stored ? (ar ? 'استبدال' : 'Replace') : (ar ? 'حفظ مشفّراً' : 'Store encrypted')}
              </button>
            </div>
          );
        })}
        <div className="row" style={{ marginBlockStart: 10 }}>
          <button className="btn" onClick={testConnection} disabled={!vault.vault_unlocked}>
            {ar ? '🔌 اختبار اتصال RPC' : '🔌 Test RPC connection'}
          </button>
          {connTest?.testing && <span className="muted">{ar ? 'جارٍ الاختبار…' : 'testing…'}</span>}
          {connTest && !connTest.testing && (
            connTest.ok
              ? <Badge tone="ok">{ar ? `متصل ✓ · ${connTest.provider === 'helius' ? 'Helius (بث محسّن)' : 'RPC عام'} · slot ${connTest.current_slot} · ${connTest.latency_ms}ms` : `connected ✓ · ${connTest.provider} · slot ${connTest.current_slot} · ${connTest.latency_ms}ms`}</Badge>
              : <Badge tone="danger">{ar ? `فشل: ${connTest.error}` : `failed: ${connTest.error}`}</Badge>
          )}
        </div>
        {connTest?.ok && connTest.enhanced_stream && (
          <p className="muted" style={{ fontSize: 'var(--fs-sm)', marginBlockStart: 6 }}>
            {ar ? 'مزوّد Helius مكتشف — سيُستخدم البث المحسّن transactionSubscribe (اشتراك واحد لكل المحافظ، معاملات فورية، استهلاك أقل).' : 'Helius detected — enhanced transactionSubscribe stream will be used (one subscription, inline transactions, fewer credits).'}
          </p>
        )}
      </Card>

      <Card title={ar ? '✍️ مفتاح التوقيع (Signer)' : '✍️ Signer key'} right={<Badge tone={signerTone}>{signer.signer_status || '—'}</Badge>}>
        {/* Execution wallet status — confirm a wallet exists & is connected */}
        <div className="stattile" style={{ marginBlockEnd: 'var(--s-3)', flexDirection: 'row', alignItems: 'center', gap: 'var(--s-3)', flexWrap: 'wrap' }}>
          {!signer.key_imported ? (
            <Badge tone="danger">{ar ? '⛔ لا توجد محفظة — لم يُستورد مفتاح' : '⛔ No wallet — no key imported'}</Badge>
          ) : walletInfo?.checking ? (
            <span className="muted">{ar ? 'جارٍ التحقّق…' : 'checking…'}</span>
          ) : walletInfo?.connected ? (
            <>
              <Badge tone="ok">{ar ? '✓ محفظة متصلة' : '✓ Wallet connected'}</Badge>
              <span className="mono" dir="ltr" style={{ fontSize: 'var(--fs-xs)' }}>{walletInfo.address?.slice(0, 6)}…{walletInfo.address?.slice(-6)}</span>
              <span className="mono" style={{ fontWeight: 700, color: (walletInfo.balance_sol ?? 0) > 0 ? 'var(--c-ok)' : 'var(--c-warn)' }}>
                {walletInfo.balance_sol != null ? `${walletInfo.balance_sol.toFixed(4)} SOL` : (ar ? 'الرصيد غير متوفّر' : 'balance n/a')}
              </span>
              {(walletInfo.balance_sol ?? 0) === 0 && <Badge tone="warn">{ar ? 'غير مموّلة' : 'unfunded'}</Badge>}
            </>
          ) : walletInfo ? (
            <Badge tone="warn">{ar ? `محفظة موجودة لكن غير متصلة (${walletInfo.reason || 'تحقّق RPC'})` : `wallet present but not connected (${walletInfo.reason || 'check RPC'})`}</Badge>
          ) : (
            <Badge tone="neutral">{ar ? 'اضغط «تحقّق من المحفظة»' : 'press “Check wallet”'}</Badge>
          )}
          <span className="topbar-spacer" />
          <button className="btn" onClick={checkWallet} disabled={!signer.key_imported}>{ar ? '🔄 تحقّق من المحفظة' : '🔄 Check wallet'}</button>
        </div>

        <DangerNote tone="warn" locked>
          {ar
            ? 'يقبل base58 أو مصفوفة JSON. يُستورد مرة واحدة إلى الخزنة ولا يُعرض مرة أخرى أبداً. لا تستخدم محفظتك الرئيسية — أنشئ محفظة تنفيذ مخصصة وموّلها بما تحتمل خسارته فقط.'
            : 'Accepts base58 or JSON array. Imported once into the vault and NEVER displayed again. Do not use your main wallet — create a dedicated execution wallet funded only with what you can afford to lose.'}
        </DangerNote>
        <details style={{ marginBlockStart: 8 }}>
          <summary style={{ cursor: 'pointer', color: 'var(--c-info, #4493f8)' }}>
            {ar ? '❔ من أين أجلب هذا المفتاح؟' : '❔ Where do I get this key?'}
          </summary>
          <div className="muted" style={{ fontSize: 'var(--fs-sm)', marginBlockStart: 8, lineHeight: 1.8 }}>
            <b>{ar ? 'الأسهل — محفظة Phantom:' : 'Easiest — Phantom wallet:'}</b>
            <ol style={{ margin: '4px 0', paddingInlineStart: 20 }}>
              <li>{ar ? 'ثبّت إضافة Phantom (phantom.app) في متصفّحك.' : 'Install the Phantom extension (phantom.app).'}</li>
              <li>{ar ? 'أنشئ حساباً جديداً مخصّصاً للبوت (Add / Create Account) — ليس محفظتك الرئيسية.' : 'Create a NEW account for the bot (Add / Create Account) — not your main wallet.'}</li>
              <li>{ar ? 'أرسل إليه SOL يحتمل خسارته (مثلاً 0.5–1 SOL) — هذا «الإيداع».' : 'Send it SOL you can lose (e.g. 0.5–1 SOL) — this is the "deposit".'}</li>
              <li>{ar ? 'Settings → Security & Privacy → Export Private Key → انسخ النص (base58) والصقه أدناه.' : 'Settings → Security & Privacy → Export Private Key → copy the base58 string and paste below.'}</li>
            </ol>
            <b>{ar ? 'أو عبر Solana CLI:' : 'Or via Solana CLI:'}</b>{' '}
            <code>solana-keygen new --outfile bot.json</code>{' '}
            {ar ? '→ انسخ مصفوفة الأرقام الـ64 من الملف والصقها (العنوان للتمويل: ' : '→ paste the 64-number array from the file (funding address: '}
            <code>solana-keygen pubkey bot.json</code>{ar ? ').' : ').'}
            <br />
            <span style={{ color: 'var(--c-danger, #e5484d)' }}>
              {ar ? '⚠ الصق المفتاح هنا فقط — لا ترسله لأحد. وتأكّد أن المحفظة فيها SOL كافٍ للصفقات والرسوم.' : '⚠ Paste the key here only — never send it to anyone. Ensure the wallet holds enough SOL for trades and fees.'}
            </span>
          </div>
        </details>
        <div className="row" style={{ marginBlockStart: 8 }}>
          <input
            className="search" type="password" dir="ltr" style={{ flex: '1 1 300px' }}
            placeholder={ar ? 'المفتاح الخاص لمحفظة التنفيذ' : 'execution wallet private key'}
            value={signerKey} onChange={(e) => setSignerKey(e.target.value)}
            disabled={!vault.vault_unlocked}
          />
          <button className="btn" onClick={importSigner} disabled={!vault.vault_unlocked || !signerKey}>
            {signer.key_imported ? (ar ? 'استبدال المفتاح' : 'Replace key') : (ar ? 'استيراد إلى الخزنة' : 'Import to vault')}
          </button>
        </div>

        <h4 style={{ margin: '14px 0 6px' }}>{ar ? 'حدود جلسة التوقيع (كلها إلزامية)' : 'Signing session bounds (all mandatory)'}</h4>
        <div className="grid cols-2">
          {[
            ['idle_timeout_ms', ar ? 'مهلة الخمول (ms)' : 'idle timeout (ms)', '600000'],
            ['max_session_ms', ar ? 'أقصى مدة جلسة (ms)' : 'max session (ms)', '3600000'],
            ['max_session_notional_usd', ar ? 'سقف القيمة الموقعة بالجلسة ($)' : 'session notional cap ($)', '500'],
            ['lock_after_n_risk_rejections', ar ? 'قفل بعد N رفض مخاطر' : 'lock after N risk rejections', '3'],
          ].map(([k, label, ph]) => (
            <div className="row" key={k}>
              <span className="muted" style={{ minWidth: 200 }}>{label}</span>
              <input
                className="search" type="number" dir="ltr" style={{ width: 130 }} placeholder={ph}
                value={bounds[k]} onChange={(e) => setBounds({ ...bounds, [k]: e.target.value })}
              />
            </div>
          ))}
        </div>
        <div className="row" style={{ marginBlockStart: 10 }}>
          <button className="btn" onClick={applySafeSessionDefaults}>{ar ? '⚡ حدود آمنة بنقرة' : '⚡ Safe defaults'}</button>
          <button className="btn" onClick={saveBounds}>{ar ? 'حفظ الحدود' : 'Save bounds'}</button>
          <button className="btn" onClick={() => sessionAction(true)} disabled={signer.signer_status !== 'locked' || !signer.session_bounds_configured || !signer.key_imported}>
            {ar ? 'فتح جلسة توقيع' : 'Open signing session'}
          </button>
          <button className="btn" onClick={() => sessionAction(false)} disabled={!signer.session_active}>
            {ar ? 'قفل الجلسة' : 'Lock session'}
          </button>
        </div>
        {signer.session_active && (
          <p className="muted" style={{ fontSize: 'var(--fs-sm)', marginBlockStart: 8 }}>
            {ar ? `جلسة نشطة منذ ${signer.session_opened_at} · قيمة موقعة: $${signer.session_signed_notional_usd}` : `Session active since ${signer.session_opened_at} · signed notional: $${signer.session_signed_notional_usd}`}
          </p>
        )}
      </Card>
    </div>
  );
}
