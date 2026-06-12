// designPrefs.jsx — operator-controlled visual tweaks (accent / surface / corners /
// density / theme / type-scale / live-data toggles). Applied to <html> data-* attributes
// and persisted to localStorage. Pure presentation — touches no risk/exec/signer state.
import { createContext, useContext, useEffect, useState, useMemo, useCallback } from 'react';

const KEY = 'soltrade.design.prefs.v1';

export const DEFAULTS = Object.freeze({
  accent: 'mint',        // mint · amber · cyan · blue · magenta
  surface: 'obsidian',   // obsidian · oled · navy
  corners: 'soft',       // sharp · soft · rounded
  density: 'comfortable',// compact · comfortable · ultra
  theme: 'dark',         // dark · light
  typeScale: 1,          // 0.9 – 1.2
  spark: true,           // inline sparklines
  glow: true,            // ambient glow
  motion: true,          // live motion (flash + breathe)
  grid: false            // table grid lines
});

const Ctx = createContext(null);

function load() {
  try {
    return { ...DEFAULTS, ...JSON.parse(localStorage.getItem(KEY) || '{}') };
  } catch {
    return { ...DEFAULTS };
  }
}

export function DesignPrefsProvider({ children }) {
  const [prefs, setPrefs] = useState(load);

  useEffect(() => {
    const r = document.documentElement;
    r.dataset.theme = prefs.theme;
    r.dataset.density = prefs.density;
    r.dataset.accent = prefs.accent;
    r.dataset.surface = prefs.surface;
    r.dataset.corners = prefs.corners;
    r.dataset.spark = prefs.spark ? 'on' : 'off';
    r.dataset.glow = prefs.glow ? 'on' : 'off';
    r.dataset.motion = prefs.motion ? 'on' : 'off';
    r.dataset.grid = prefs.grid ? 'on' : 'off';
    r.style.setProperty('--type-scale', String(prefs.typeScale));
    try { localStorage.setItem(KEY, JSON.stringify(prefs)); } catch { /* ignore */ }
  }, [prefs]);

  const set = useCallback((patch) => setPrefs((p) => ({ ...p, ...patch })), []);
  const reset = useCallback(() => setPrefs({ ...DEFAULTS }), []);

  const value = useMemo(() => ({ prefs, set, reset }), [prefs, set, reset]);
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useDesignPrefs() {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error('useDesignPrefs must be used within DesignPrefsProvider');
  return ctx;
}
