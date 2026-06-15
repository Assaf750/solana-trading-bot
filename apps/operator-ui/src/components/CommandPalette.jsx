// CommandPalette.jsx — ⌘K / Ctrl+K palette: jump to any screen or run a quick action.
// Keyboard-navigable (↑↓ ⏎ esc). Pure navigation/preferences — no trading actions.
import { useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useI18n } from '../i18n/index.jsx';
import { useDesignPrefs } from './designPrefs.jsx';

const SCREENS = [
  { to: '/command', key: 'command', ico: '◈', kbd: 'g c' },
  { to: '/workspace', key: 'workspace', ico: '▤', kbd: 'g w' },
  { to: '/radar', key: 'radar', ico: '◎', kbd: 'g r' },
  { to: '/tokens', key: 'tokens', ico: '⬡', kbd: 'g t' },
  { to: '/wallets', key: 'wallets', ico: '◇', kbd: 'g i' },
  { to: '/analytics', key: 'analytics', ico: '▦', kbd: 'g a' },
  { to: '/funds', key: 'funds', ico: '◰', kbd: 'g f' },
  { to: '/settings', key: 'settings', ico: '⚙', kbd: 'g s' },
  { to: '/alerts', key: 'alerts', ico: '⚑', kbd: 'g l' },
  { to: '/setup', key: 'setup', ico: '✦', kbd: 'g u' },
  { to: '/help', key: 'help', ico: '?', kbd: 'g h' }
];

export function CommandPalette({ open, setOpen, onOpenTweaks }) {
  const { t, lang, setLang } = useI18n();
  const { prefs, set } = useDesignPrefs();
  const navigate = useNavigate();
  const ar = lang === 'ar';
  const [q, setQ] = useState('');
  const [idx, setIdx] = useState(0);
  const inputRef = useRef(null);
  const listRef = useRef(null);
  const restoreRef = useRef(null); // element to return focus to on close

  // close just flips `open`; reset + focus-restore happen in the [open] effect so EVERY close
  // path (Escape, overlay click, item run, and the App-level Ctrl+K toggle) behaves identically.
  const close = () => setOpen(false);

  const groups = useMemo(() => {
    const screens = SCREENS.map((s) => ({
      group: ar ? 'الشاشات' : 'Screens',
      label: t(`nav.${s.key}`),
      ico: s.ico,
      kbd: s.kbd,
      run: () => { navigate(s.to); close(); }
    }));
    const actions = [
      {
        group: ar ? 'إجراءات' : 'Actions',
        label: lang === 'en' ? (ar ? 'التبديل إلى العربية' : 'Switch to Arabic · العربية') : 'Switch to English · EN',
        ico: '⇄',
        run: () => { setLang(lang === 'en' ? 'ar' : 'en'); close(); }
      },
      {
        group: ar ? 'إجراءات' : 'Actions',
        label: prefs.theme === 'dark' ? (ar ? 'السمة الفاتحة' : 'Switch to light theme') : (ar ? 'السمة الداكنة' : 'Switch to dark theme'),
        ico: prefs.theme === 'dark' ? '☀' : '☾',
        run: () => { set({ theme: prefs.theme === 'dark' ? 'light' : 'dark' }); close(); }
      },
      {
        group: ar ? 'إجراءات' : 'Actions',
        label: ar ? 'الكثافة · فائقة' : 'Density · Ultra (tightest)',
        ico: '▤',
        run: () => { set({ density: 'ultra' }); close(); }
      },
      {
        group: ar ? 'إجراءات' : 'Actions',
        label: ar ? 'فتح لوحة التخصيص' : 'Open Tweaks panel',
        ico: '🎛',
        run: () => { close(); if (onOpenTweaks) onOpenTweaks(); }
      }
    ];
    return [...screens, ...actions];
  }, [ar, lang, prefs.theme, t, setLang, set, navigate, onOpenTweaks]);

  const filtered = useMemo(() => {
    const raw = q.trim();
    const query = raw.toLowerCase();
    // unified search: a pasted base58 mint/address routes straight to analysis
    const isAddr = /^[1-9A-HJ-NP-Za-km-z]{32,44}$/.test(raw);
    const short = isAddr ? `${raw.slice(0, 4)}…${raw.slice(-4)}` : '';
    const addrActions = isAddr ? [
      { group: ar ? 'بحث' : 'Search', label: `${ar ? 'تحليل توكن' : 'Analyze token'}: ${short}`, ico: '⬡', run: () => { navigate(`/tokens?mint=${raw}`); setOpen(false); } },
      { group: ar ? 'بحث' : 'Search', label: `${ar ? 'تحليل محفظة' : 'Analyze wallet'}: ${short}`, ico: '◇', run: () => { navigate(`/wallets?address=${raw}`); setOpen(false); } },
    ] : [];
    if (!query) return groups;
    return [...addrActions, ...groups.filter((g) => g.label.toLowerCase().includes(query))];
  }, [groups, q, ar, navigate, setOpen]);

  useEffect(() => { setIdx(0); }, [q]);
  useEffect(() => {
    if (open) {
      // Reset on every open so any close path (incl. the Ctrl+K toggle in App) starts clean.
      restoreRef.current = document.activeElement; // remember the trigger for focus restore
      setQ('');
      setIdx(0);
      const id = setTimeout(() => inputRef.current?.focus(), 20);
      return () => clearTimeout(id);
    }
    // closed (any path): return focus to whatever opened the palette
    restoreRef.current?.focus?.();
    restoreRef.current = null;
    return undefined;
  }, [open]);
  // Keep the highlighted row visible when navigating with the arrow keys.
  useEffect(() => {
    listRef.current?.querySelector('.cmdk-item.active')?.scrollIntoView({ block: 'nearest' });
  }, [idx, q]);

  if (!open) return null;

  const onKey = (e) => {
    if (e.key === 'Escape') { e.preventDefault(); close(); }
    else if (e.key === 'ArrowDown') { e.preventDefault(); setIdx((i) => Math.max(0, Math.min(filtered.length - 1, i + 1))); }
    else if (e.key === 'ArrowUp') { e.preventDefault(); setIdx((i) => Math.max(0, i - 1)); }
    else if (e.key === 'Enter') { e.preventDefault(); filtered[idx]?.run(); }
    // focus trap: the input is the only keyboard-interactive control, so keep focus on it
    else if (e.key === 'Tab') { e.preventDefault(); }
  };

  let lastGroup = null;
  return (
    <div className="cmdk-overlay" onMouseDown={close}>
      <div className="cmdk" role="dialog" aria-modal="true" aria-label="Command palette"
        onMouseDown={(e) => e.stopPropagation()}>
        <div className="cmdk-input-row">
          <span aria-hidden style={{ color: 'var(--c-text-faint)' }}>⌘</span>
          <input
            ref={inputRef}
            className="cmdk-input"
            placeholder={ar ? 'شاشة، أمر، أو الصق عنوان توكن/محفظة…' : 'Screen, command, or paste a token/wallet address…'}
            value={q}
            onChange={(e) => setQ(e.target.value)}
            onKeyDown={onKey}
            aria-label={ar ? 'بحث الأوامر' : 'Search commands'}
            role="combobox"
            aria-expanded="true"
            aria-controls="cmdk-listbox"
            aria-activedescendant={filtered[idx] ? `cmdk-opt-${idx}` : undefined}
          />
        </div>
        <div className="cmdk-list" ref={listRef} id="cmdk-listbox" role="listbox">
          {filtered.length === 0 && (
            <div className="cmdk-empty">{ar ? 'لا نتائج' : 'No results'}</div>
          )}
          {filtered.map((it, i) => {
            const head = it.group !== lastGroup ? it.group : null;
            lastGroup = it.group;
            return (
              <div key={`${it.label}-${i}`}>
                {head && <div className="cmdk-group-label">{head}</div>}
                <div
                  id={`cmdk-opt-${i}`}
                  className={`cmdk-item ${i === idx ? 'active' : ''}`}
                  role="option"
                  aria-selected={i === idx}
                  onMouseEnter={() => setIdx(i)}
                  onClick={() => it.run()}
                >
                  <span className="cmdk-ico" aria-hidden>{it.ico}</span>
                  <span className="cmdk-label">{it.label}</span>
                  {it.kbd && <span className="kbd">{it.kbd}</span>}
                </div>
              </div>
            );
          })}
        </div>
        <div className="cmdk-hint">
          <span><span className="kbd">↑</span> <span className="kbd">↓</span> {ar ? 'تنقّل' : 'navigate'}</span>
          <span><span className="kbd">⏎</span> {ar ? 'تنفيذ' : 'select'}</span>
          <span><span className="kbd">esc</span> {ar ? 'إغلاق' : 'close'}</span>
        </div>
      </div>
    </div>
  );
}
