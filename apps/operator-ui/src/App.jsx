import { useState, useEffect } from 'react';
import { NavLink, Routes, Route, Navigate } from 'react-router-dom';
import { useI18n } from './i18n/index.jsx';
import { Badge } from './components/index.jsx';
import { CommandPalette } from './components/CommandPalette.jsx';
import { TweaksPanel } from './components/TweaksPanel.jsx';
import { useDesignPrefs } from './components/designPrefs.jsx';
import { useBackend } from './api/useBackend.jsx';

import SetupWizard from './pages/SetupWizard.jsx';
import CommandCenter from './pages/CommandCenter.jsx';
import TradingWorkspace from './pages/TradingWorkspace.jsx';
import NewCoinRadar from './pages/NewCoinRadar.jsx';
import TokenAnalysis from './pages/TokenAnalysis.jsx';
import WalletIntelligence from './pages/WalletIntelligence.jsx';
import AnalyticsReports from './pages/AnalyticsReports.jsx';
import MyWalletsFunds from './pages/MyWalletsFunds.jsx';
import SettingsSafety from './pages/SettingsSafety.jsx';
import Alerts from './pages/Alerts.jsx';
import HelpGlossary from './pages/HelpGlossary.jsx';

const NAV = [
  { sec: { en: 'Overview', ar: 'النظرة العامة' } },
  { to: '/command', key: 'command', ico: '◈' },
  { sec: { en: 'Trading', ar: 'التداول' } },
  { to: '/workspace', key: 'workspace', ico: '▤' },
  { to: '/radar', key: 'radar', ico: '◎' },
  { to: '/tokens', key: 'tokens', ico: '⬡' },
  { to: '/wallets', key: 'wallets', ico: '◇' },
  { to: '/analytics', key: 'analytics', ico: '▦' },
  { sec: { en: 'Setup & System', ar: 'الإعداد والنظام' } },
  { to: '/setup', key: 'setup', ico: '✦' },
  { to: '/funds', key: 'funds', ico: '◰' },
  { to: '/settings', key: 'settings', ico: '⚙' },
  { to: '/alerts', key: 'alerts', ico: '⚑' },
  { to: '/help', key: 'help', ico: '?' }
];

function TopBar({ onOpenCmdk, onOpenTweaks }) {
  const { t, lang, setLang } = useI18n();
  const { status, connected } = useBackend();
  const { prefs, set } = useDesignPrefs();
  const density = prefs.density;
  const theme = prefs.theme;

  const opState = connected ? status?.operating_state?.operating_state || '—' : 'OFFLINE';
  const mode = connected ? status?.mode : null;
  const ar = lang === 'ar';

  return (
    <div className="topbar">
      <div className="topbar-row">
        <div className="global-banner" role="status">
          {connected ? (
            <>
              <span aria-hidden>{mode === 'real_live' ? '🔴' : '🟠'}</span>
              <span>{mode === 'real_live'
                ? (ar ? 'وضع حقيقي — أموال حقيقية' : 'REAL-LIVE MODE — real funds')
                : (ar ? 'وضع ورقي (PAPER) — لا أموال حقيقية' : 'PAPER MODE — no real funds')}</span>
              <span className="sep">·</span>
              <span style={{ fontWeight: 400 }}>
                {ar ? 'الخادم المحلي متصل' : 'local server connected'}
              </span>
            </>
          ) : (
            <>
              <span aria-hidden>⚠️</span>
              <span>{ar ? 'الخادم غير متصل — شغّل START.bat' : 'SERVER OFFLINE — run START.bat'}</span>
              <span className="sep">·</span>
              <span style={{ fontWeight: 400 }}>{ar ? 'لا بيانات حيّة بدون الخادم' : 'no live data without the server'}</span>
            </>
          )}
        </div>
        <span className="topbar-spacer" />
        <span className="status-chip">
          <span className="muted">{t('app.operatingState')}:</span>
          <Badge tone={opState === 'ACTIVE' ? 'ok' : opState === 'KILLED' || opState === 'OFFLINE' ? 'danger' : 'warn'}>
            {opState}
          </Badge>
        </span>
        <span className="status-chip">
          <span className="muted">{t('app.realLive')}:</span>
          {mode === 'real_live'
            ? <Badge tone="danger">{ar ? 'مفعّل' : 'ACTIVE'}</Badge>
            : <Badge tone="danger">{t('app.blocked')}</Badge>}
        </span>
      </div>
      <div className="topbar-row statbar">
        {connected ? (
          <>
            <span className="pill"><span className={`led ${status?.engine?.paper_engine === 'active' ? 'ok live' : 'warn'}`} /> {ar ? 'المحرك' : 'engine'} <b>{status?.engine?.paper_engine || '—'}</b></span>
            <span className="pill"><span className={`led ${status?.vault?.vault_unlocked ? 'ok' : status?.vault?.vault_exists ? 'warn' : 'danger'}`} /> {ar ? 'الخزنة' : 'vault'} <b>{status?.vault?.vault_unlocked ? (ar ? 'مفتوحة' : 'unlocked') : status?.vault?.vault_exists ? (ar ? 'مقفلة' : 'locked') : (ar ? 'غير منشأة' : 'none')}</b></span>
            <span className="pill"><span className={`led ${status?.signer?.signer_status === 'ready' ? 'ok' : status?.signer?.signer_status === 'missing' ? 'danger' : 'warn'}`} /> signer <b>{status?.signer?.signer_status || '—'}</b></span>
            <span className="pill"><span className={`led ${status?.kill_switch?.global?.engaged === false ? 'ok' : 'danger'}`} /> kill <b>{status?.kill_switch?.global?.engaged === false ? 'off' : 'ON'}</b></span>
            <span className="pill"><span className={`led ${status?.readiness?.blockers?.length ? 'warn' : 'ok'}`} /> {ar ? 'حواجز' : 'blockers'} <b>{status?.readiness?.blockers?.length ?? '—'}</b></span>
          </>
        ) : (
          <span className="pill"><span className="led danger" /> {ar ? 'الخادم غير متصل' : 'server offline'}</span>
        )}
        <span className="topbar-spacer" />
        <button className="icon-btn" onClick={onOpenCmdk} aria-label={lang === 'ar' ? 'لوحة الأوامر' : 'Command palette'}>
          <span aria-hidden>⌘</span>
          <span>{lang === 'ar' ? 'الأوامر' : 'Command'}</span>
          <span className="kbd">Ctrl K</span>
        </button>
        <button className="icon-btn" onClick={onOpenTweaks} aria-label={lang === 'ar' ? 'التخصيص' : 'Tweaks'}>
          <span aria-hidden>🎛</span>
          <span>{lang === 'ar' ? 'تخصيص' : 'Tweaks'}</span>
        </button>
        <span className="muted" style={{ fontSize: 'var(--fs-xs)' }}>{t('app.language')}</span>
        <div className="seg" role="group" aria-label={t('app.language')}>
          <button className={lang === 'en' ? 'on' : ''} onClick={() => setLang('en')}>EN</button>
          <button className={lang === 'ar' ? 'on' : ''} onClick={() => setLang('ar')}>ع</button>
        </div>
        <span className="muted" style={{ fontSize: 'var(--fs-xs)' }}>{t('app.density')}</span>
        <div className="seg" role="group" aria-label={t('app.density')}>
          <button className={density === 'compact' ? 'on' : ''} onClick={() => set({ density: 'compact' })}>{t('app.compact')}</button>
          <button className={density === 'comfortable' ? 'on' : ''} onClick={() => set({ density: 'comfortable' })}>{t('app.comfortable')}</button>
          <button className={density === 'ultra' ? 'on' : ''} onClick={() => set({ density: 'ultra' })}>{t('app.ultra')}</button>
        </div>
        <span className="muted" style={{ fontSize: 'var(--fs-xs)' }}>{t('app.theme')}</span>
        <div className="seg" role="group" aria-label={t('app.theme')}>
          <button className={theme === 'dark' ? 'on' : ''} onClick={() => set({ theme: 'dark' })}>{t('app.dark')}</button>
          <button className={theme === 'light' ? 'on' : ''} onClick={() => set({ theme: 'light' })}>{t('app.light')}</button>
        </div>
      </div>
    </div>
  );
}

function Nav() {
  const { t, lang } = useI18n();
  return (
    <nav className="nav" aria-label="primary">
      <div className="nav-brand">
        <span style={{ display: 'flex', flexDirection: 'column' }}>
          {t('app.brand')}
          <small>{t('app.brandSub')}</small>
        </span>
      </div>
      <ul className="nav-list">
        {NAV.map((n, i) => (
          n.sec
            ? <li className="nav-sec" key={`sec-${i}`}>{lang === 'ar' ? n.sec.ar : n.sec.en}</li>
            : (
              <li className="nav-item" key={n.key}>
                <NavLink to={n.to} className={({ isActive }) => (isActive ? 'active' : '')}>
                  <span className="nav-ico" aria-hidden>{n.ico}</span>
                  {t(`nav.${n.key}`)}
                </NavLink>
              </li>
            )
        ))}
      </ul>
    </nav>
  );
}

export default function App() {
  const [cmdkOpen, setCmdkOpen] = useState(false);
  const [tweaksOpen, setTweaksOpen] = useState(false);

  useEffect(() => {
    const onKey = (e) => {
      if ((e.metaKey || e.ctrlKey) && (e.key === 'k' || e.key === 'K')) {
        e.preventDefault();
        setCmdkOpen((o) => !o);
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  return (
    <div className="app-shell">
      <Nav />
      <div className="main">
        <TopBar onOpenCmdk={() => setCmdkOpen(true)} onOpenTweaks={() => setTweaksOpen(true)} />
        <main className="content">
          <Routes>
            <Route path="/" element={<Navigate to="/command" replace />} />
            <Route path="/setup" element={<SetupWizard />} />
            <Route path="/command" element={<CommandCenter />} />
            <Route path="/workspace" element={<TradingWorkspace />} />
            <Route path="/radar" element={<NewCoinRadar />} />
            <Route path="/tokens" element={<TokenAnalysis />} />
            <Route path="/wallets" element={<WalletIntelligence />} />
            <Route path="/analytics" element={<AnalyticsReports />} />
            <Route path="/funds" element={<MyWalletsFunds />} />
            <Route path="/settings" element={<SettingsSafety />} />
            <Route path="/alerts" element={<Alerts />} />
            <Route path="/help" element={<HelpGlossary />} />
            <Route path="*" element={<Navigate to="/command" replace />} />
          </Routes>
        </main>
      </div>
      <CommandPalette open={cmdkOpen} setOpen={setCmdkOpen} onOpenTweaks={() => setTweaksOpen(true)} />
      <TweaksPanel open={tweaksOpen} setOpen={setTweaksOpen} />
    </div>
  );
}
