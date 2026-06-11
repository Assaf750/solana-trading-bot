import { useState, useEffect } from 'react';
import { NavLink, Routes, Route, Navigate } from 'react-router-dom';
import { useI18n } from './i18n/index.jsx';
import { Badge } from './components/index.jsx';
import { useBackend } from './api/useBackend.jsx';

import CommandCenter from './pages/CommandCenter.jsx';
import TradingWorkspace from './pages/TradingWorkspace.jsx';
import NewCoinRadar from './pages/NewCoinRadar.jsx';
import WalletIntelligence from './pages/WalletIntelligence.jsx';
import AnalyticsReports from './pages/AnalyticsReports.jsx';
import MyWalletsFunds from './pages/MyWalletsFunds.jsx';
import SettingsSafety from './pages/SettingsSafety.jsx';
import Alerts from './pages/Alerts.jsx';
import HelpGlossary from './pages/HelpGlossary.jsx';

const NAV = [
  { to: '/command', key: 'command', ico: '◈' },
  { to: '/workspace', key: 'workspace', ico: '▤' },
  { to: '/radar', key: 'radar', ico: '◎' },
  { to: '/wallets', key: 'wallets', ico: '◇' },
  { to: '/analytics', key: 'analytics', ico: '▦' },
  { to: '/funds', key: 'funds', ico: '◰' },
  { to: '/settings', key: 'settings', ico: '⚙' },
  { to: '/alerts', key: 'alerts', ico: '⚑' },
  { to: '/help', key: 'help', ico: '?' }
];

function TopBar() {
  const { t, lang, setLang } = useI18n();
  const { status, connected } = useBackend();
  const [density, setDensity] = useState('comfortable');
  const [theme, setTheme] = useState('dark');

  useEffect(() => {
    document.documentElement.dataset.density = density;
  }, [density]);
  useEffect(() => {
    document.documentElement.dataset.theme = theme;
  }, [theme]);

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
      <div className="topbar-row">
        <span className="muted" style={{ fontSize: 'var(--fs-xs)' }}>{t('app.language')}</span>
        <div className="seg" role="group" aria-label={t('app.language')}>
          <button className={lang === 'en' ? 'on' : ''} onClick={() => setLang('en')}>EN</button>
          <button className={lang === 'ar' ? 'on' : ''} onClick={() => setLang('ar')}>ع</button>
        </div>
        <span className="muted" style={{ fontSize: 'var(--fs-xs)' }}>{t('app.density')}</span>
        <div className="seg" role="group" aria-label={t('app.density')}>
          <button className={density === 'compact' ? 'on' : ''} onClick={() => setDensity('compact')}>{t('app.compact')}</button>
          <button className={density === 'comfortable' ? 'on' : ''} onClick={() => setDensity('comfortable')}>{t('app.comfortable')}</button>
        </div>
        <span className="muted" style={{ fontSize: 'var(--fs-xs)' }}>{t('app.theme')}</span>
        <div className="seg" role="group" aria-label={t('app.theme')}>
          <button className={theme === 'dark' ? 'on' : ''} onClick={() => setTheme('dark')}>{t('app.dark')}</button>
          <button className={theme === 'light' ? 'on' : ''} onClick={() => setTheme('light')}>{t('app.light')}</button>
        </div>
      </div>
    </div>
  );
}

function Nav() {
  const { t } = useI18n();
  return (
    <nav className="nav" aria-label="primary">
      <div className="nav-brand">
        {t('app.brand')}
        <small>{t('app.brandSub')}</small>
      </div>
      <ul className="nav-list">
        {NAV.map((n) => (
          <li className="nav-item" key={n.key}>
            <NavLink to={n.to} className={({ isActive }) => (isActive ? 'active' : '')}>
              <span className="nav-ico" aria-hidden>{n.ico}</span>
              {t(`nav.${n.key}`)}
            </NavLink>
          </li>
        ))}
      </ul>
    </nav>
  );
}

export default function App() {
  return (
    <div className="app-shell">
      <Nav />
      <div className="main">
        <TopBar />
        <main className="content">
          <Routes>
            <Route path="/" element={<Navigate to="/command" replace />} />
            <Route path="/command" element={<CommandCenter />} />
            <Route path="/workspace" element={<TradingWorkspace />} />
            <Route path="/radar" element={<NewCoinRadar />} />
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
    </div>
  );
}
