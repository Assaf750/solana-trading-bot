import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { useI18n } from '../i18n/index.jsx';
import PageHead from '../components/PageHead.jsx';
import { Card, Badge, DangerNote, EmptyState } from '../components/index.jsx';
import { api } from '../api/client.js';
import { useBackend } from '../api/useBackend.jsx';

// Conservative starter Hard-Risk preset (owner can tune later on Settings & Safety).
const SAFE_PRESET = {
  hard_risk: {
    max_daily_loss_pct: 5, max_daily_loss_usdt: 50, max_total_drawdown_pct: 20,
    max_open_positions: 3, max_position_size_pct: 5, max_token_exposure_pct: 5,
    max_creator_exposure_pct: 5, max_cluster_exposure_pct: 5, max_correlated_meme_exposure_pct: 10,
  },
  execution: { capital_limit: 200, sizing_mode: 'fixed_usd', sizing_value: 10 },
};

function StepShell({ n, title, done, active, children }) {
  return (
    <Card
      title={<span><span aria-hidden style={{ marginInlineEnd: 8 }}>{done ? '✅' : active ? '▶️' : `${n}️⃣`}</span>{title}</span>}
      right={done ? <Badge tone="ok">✓</Badge> : active ? <Badge tone="warn">now</Badge> : <Badge tone="neutral">—</Badge>}
      className={active ? 'elev' : ''}
    >
      {children}
    </Card>
  );
}

export default function SetupWizard() {
  const { t, lang } = useI18n();
  const ar = lang === 'ar';
  const { status, connected, refresh } = useBackend();

  const [pass, setPass] = useState('');
  const [rpc, setRpc] = useState('');
  const [walletAddr, setWalletAddr] = useState('');
  const [walletLabel, setWalletLabel] = useState('');
  const [msg, setMsg] = useState(null);
  const [connTest, setConnTest] = useState(null);
  const [wallets, setWallets] = useState([]);

  async function loadWallets() {
    const r = await api.wallets();
    if (r.ok) setWallets(r.data.wallets || []);
  }
  useEffect(() => { if (connected) loadWallets(); }, [connected, status]);

  function note(tone, a, e) { setMsg({ tone, text: ar ? a : e }); }

  if (!connected) {
    return (
      <div className="stack">
        <PageHead title={ar ? 'معالج الإعداد' : 'Setup Wizard'} sub={ar ? 'خطوة بخطوة حتى أول تداول' : 'Step by step to your first trade'} />
        <EmptyState message={ar ? 'الخادم غير متصل — شغّل START.bat ثم أعد التحميل' : 'Server offline — run START.bat, then reload'} />
      </div>
    );
  }

  const vault = status?.vault || {};
  const readiness = status?.readiness || {};
  const blockers = (readiness.blockers || []).map((b) => b.blocker);
  const engine = status?.engine || {};

  const step1Done = vault.vault_exists && vault.vault_unlocked;
  const rpcDone = !blockers.includes('rpc_provider_not_configured');
  const limitsDone = !blockers.includes('hard_risk_incomplete') && !blockers.includes('capital_limit_missing_or_invalid');
  const followed = wallets.filter((w) => w.follow_enabled).length;
  const walletDone = followed > 0;

  const activeStep = !step1Done ? 1 : !rpcDone ? 2 : !limitsDone ? 3 : !walletDone ? 4 : 5;

  // actions
  async function doVault() {
    setMsg(null);
    const r = vault.vault_exists ? await api.vaultUnlock(pass) : await api.vaultCreate(pass);
    if (r.ok) { setPass(''); note('ok', 'الخزنة جاهزة ✓', 'Vault ready ✓'); } else note('danger', `فشل: ${r.data?.error || ''}`, `Failed: ${r.data?.error || ''}`);
    refresh();
  }
  async function doRpc() {
    setMsg(null);
    if (!rpc.trim()) return;
    const s = await api.storeSecret('helius_rpc_url', rpc.trim());
    if (!s.ok) { note('danger', `رفض: ${s.data?.error || ''}`, `Refused: ${s.data?.error || ''}`); return; }
    await api.updateConfig({ providers: { rpc_url_ref: s.data.ref } });
    setRpc('');
    note('ok', `حُفظ مشفّراً (${s.data.masked}) ✓`, `Stored encrypted (${s.data.masked}) ✓`);
    refresh();
  }
  async function doTest() {
    setConnTest({ testing: true });
    const r = await api.testProviderConnection();
    setConnTest(r.data);
  }
  async function doPreset() {
    setMsg(null);
    const r = await api.updateConfig(SAFE_PRESET);
    if (r.ok) note('ok', 'طُبِّقت حدود البداية الآمنة ✓ (يمكنك تعديلها لاحقاً)', 'Safe starter limits applied ✓ (tune later)');
    else note('danger', 'رفض الحفظ', 'Save rejected');
    refresh();
  }
  async function doWallet() {
    setMsg(null);
    const r = await api.registerWallet({ tracked_wallet_address: walletAddr.trim(), label: walletLabel.trim() });
    if (!r.ok) { note('danger', `${r.data?.error || r.data?.api_error_code || 'rejected'}`, `${r.data?.error || r.data?.api_error_code || 'rejected'}`); return; }
    await api.setFollow(r.data.wallet.wallet_id, true);
    setWalletAddr(''); setWalletLabel('');
    note('ok', 'سُجّلت المحفظة وفُعّلت المتابعة ✓', 'Wallet registered and follow enabled ✓');
    refresh(); loadWallets();
  }

  const pct = Math.round(((activeStep - 1) / 4) * 100);

  return (
    <div className="stack">
      <PageHead
        title={ar ? '🚀 معالج الإعداد' : '🚀 Setup Wizard'}
        sub={ar ? 'أربع خطوات حتى يبدأ التداول الورقي تلقائياً — كل سرّ يُشفَّر على جهازك' : 'Four steps until paper trading starts automatically — every secret encrypted on your machine'}
      />

      <Card title={ar ? `التقدّم: ${activeStep > 4 ? 'مكتمل' : `الخطوة ${activeStep} من 4`}` : `Progress: ${activeStep > 4 ? 'complete' : `step ${activeStep} of 4`}`}>
        <div style={{ background: 'var(--c-bg-elev-2)', borderRadius: 8, height: 10, overflow: 'hidden' }}>
          <div style={{ width: `${pct}%`, height: '100%', background: 'var(--c-ok, #46a758)', transition: 'width .3s' }} />
        </div>
        {msg && <div style={{ marginBlockStart: 10 }}><Badge tone={msg.tone}>{msg.text}</Badge></div>}
      </Card>

      <StepShell n={1} title={ar ? 'إنشاء الخزنة المشفّرة' : 'Create the encrypted vault'} done={step1Done} active={activeStep === 1}>
        <p className="muted">{ar ? 'عبارة مرور تحمي كل مفاتيحك على جهازك (8+ أحرف). احفظها — لا يمكن استرجاعها.' : 'A passphrase that protects all your keys locally (8+ chars). Save it — it cannot be recovered.'}</p>
        {!step1Done && (
          <div className="row">
            <input className="search" type="password" dir="ltr" style={{ width: 260 }}
              placeholder={ar ? 'عبارة المرور' : 'passphrase'} value={pass} onChange={(e) => setPass(e.target.value)} />
            <button className="btn" onClick={doVault} disabled={pass.length < 8}>
              {vault.vault_exists ? (ar ? 'فتح الخزنة' : 'Unlock') : (ar ? 'إنشاء الخزنة' : 'Create vault')}
            </button>
          </div>
        )}
      </StepShell>

      <StepShell n={2} title={ar ? 'مفتاح RPC (Helius)' : 'RPC key (Helius)'} done={rpcDone} active={activeStep === 2}>
        <p className="muted">
          {ar ? 'سجّل دخولك في Helius من متصفّحك، انسخ رابط RPC الخاص بك، والصقه هنا. يُشفَّر فوراً ولا يُعرض بعدها.' : 'Log into Helius in your browser, copy your RPC URL, paste it here. Encrypted immediately, never shown again.'}
        </p>
        <div className="row" style={{ flexWrap: 'wrap' }}>
          <input className="search" type="password" dir="ltr" style={{ flex: '1 1 320px' }}
            placeholder="https://mainnet.helius-rpc.com/?api-key=…" value={rpc} onChange={(e) => setRpc(e.target.value)}
            disabled={!step1Done} />
          <button className="btn" onClick={doRpc} disabled={!step1Done || !rpc.trim()}>{ar ? 'حفظ مشفّراً' : 'Store encrypted'}</button>
          <button className="btn" onClick={doTest} disabled={!step1Done || !rpcDone}>{ar ? '🔌 اختبار' : '🔌 Test'}</button>
        </div>
        {connTest?.testing && <p className="muted">{ar ? 'جارٍ الاختبار…' : 'testing…'}</p>}
        {connTest && !connTest.testing && (connTest.ok
          ? <Badge tone="ok">{ar ? `متصل ✓ · ${connTest.provider === 'helius' ? 'Helius (بث محسّن)' : 'RPC عام'} · slot ${connTest.current_slot} · ${connTest.latency_ms}ms` : `connected ✓ · ${connTest.provider} · slot ${connTest.current_slot} · ${connTest.latency_ms}ms`}</Badge>
          : <Badge tone="danger">{ar ? `فشل: ${connTest.error}` : `failed: ${connTest.error}`}</Badge>)}
      </StepShell>

      <StepShell n={3} title={ar ? 'حدود المخاطر' : 'Risk limits'} done={limitsDone} active={activeStep === 3}>
        <p className="muted">
          {ar ? 'حدود ملزمة تحمي رأس مالك. اضغط لتطبيق حدود بداية آمنة (خسارة يومية 5%/$50، 3 مراكز، $10 للصفقة، رأس مال $200) — عدّلها لاحقاً في الإعدادات.' : 'Binding limits that protect your capital. Apply safe starter limits (5%/$50 daily loss, 3 positions, $10/trade, $200 capital) — tune later in Settings.'}
        </p>
        {!limitsDone && <button className="btn" onClick={doPreset} disabled={!step1Done}>{ar ? 'تطبيق حدود البداية الآمنة' : 'Apply safe starter limits'}</button>}
        {limitsDone && <p className="muted"><Link to="/settings">{ar ? 'تعديل الحدود في الإعدادات والأمان ←' : 'Adjust limits on Settings & Safety →'}</Link></p>}
      </StepShell>

      <StepShell n={4} title={ar ? 'أول محفظة متبوعة' : 'First tracked wallet'} done={walletDone} active={activeStep === 4}>
        <p className="muted">{ar ? 'الصق عنوان محفظة رابحة تريد نسخها. تبدأ المتابعة فوراً (نمط آمن: follow_entry).' : 'Paste a winning wallet address to copy. Following starts immediately (safe mode: follow_entry).'}</p>
        <div className="row" style={{ flexWrap: 'wrap' }}>
          <input className="search" dir="ltr" style={{ flex: '2 1 300px' }} placeholder={ar ? 'عنوان المحفظة (base58)' : 'wallet address (base58)'}
            value={walletAddr} onChange={(e) => setWalletAddr(e.target.value)} disabled={!step1Done} />
          <input className="search" style={{ flex: '1 1 120px' }} placeholder={ar ? 'اسم (اختياري)' : 'label (optional)'}
            value={walletLabel} onChange={(e) => setWalletLabel(e.target.value)} disabled={!step1Done} />
          <button className="btn" onClick={doWallet} disabled={!step1Done || !walletAddr.trim()}>{ar ? 'تسجيل ومتابعة' : 'Register & follow'}</button>
        </div>
        {followed > 0 && <p className="muted">{ar ? `محافظ متابَعة: ${followed}` : `followed wallets: ${followed}`}</p>}
      </StepShell>

      {activeStep > 4 && (
        <Card title={ar ? '🎉 جاهز — التداول الورقي يعمل الآن' : '🎉 Ready — paper trading is now running'}>
          <p>
            {ar
              ? `محرك الورق: ${engine.paper_engine}. النظام يراقب محافظك ويتداول ورقياً بأسعار حقيقية. راقب النتائج في مساحة التداول لأيام قبل التفكير في المال الحقيقي.`
              : `Paper engine: ${engine.paper_engine}. The system watches your wallets and trades on paper at real prices. Watch results in Trading Workspace for days before considering real money.`}
          </p>
          <div className="row" style={{ gap: 'var(--s-4)' }}>
            <Link className="btn" to="/workspace">{ar ? 'مساحة التداول ←' : 'Trading Workspace →'}</Link>
            <Link className="btn" to="/command">{ar ? 'مركز القيادة ←' : 'Command Center →'}</Link>
          </div>
          <DangerNote tone="danger" locked>
            {ar
              ? 'التداول الحقيقي (REAL-LIVE) خطوة منفصلة بقرارك وحدك في صفحة الإعدادات والأمان — يتطلب محفظة تنفيذ مموَّلة ومفتاح توقيع وكتابة ACTIVATE-REAL-LIVE.'
              : 'REAL-LIVE is a separate, owner-only step on Settings & Safety — needs a funded execution wallet, a signer key, and typing ACTIVATE-REAL-LIVE.'}
          </DangerNote>
        </Card>
      )}
    </div>
  );
}
