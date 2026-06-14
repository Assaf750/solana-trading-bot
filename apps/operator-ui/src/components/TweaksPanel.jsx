// TweaksPanel.jsx — live visual customization (accent / surface depth / corners /
// density / type scale / live-data toggles). Presentation only; persisted via useDesignPrefs.
import { useEffect, useRef } from 'react';
import { useI18n } from '../i18n/index.jsx';
import { useDesignPrefs } from './designPrefs.jsx';

const ACCENTS = [
  { id: 'mint', color: '#3ddc97' },
  { id: 'amber', color: '#ffc233' },
  { id: 'cyan', color: '#34e0e0' },
  { id: 'blue', color: '#4d8dff' },
  { id: 'magenta', color: '#ff5db1' }
];
const SURFACES = [
  { id: 'obsidian', color: '#0a0b0d' },
  { id: 'oled', color: '#000000' },
  { id: 'navy', color: '#0a0e1a' }
];

function Toggle({ on, onClick, label }) {
  return (
    <div className="tw-toggle-row">
      <span>{label}</span>
      <button
        type="button"
        className={`switch ${on ? 'on' : ''}`}
        role="switch"
        aria-checked={on}
        aria-label={label}
        onClick={onClick}
      >
        <span className="knob" />
      </button>
    </div>
  );
}

export function TweaksPanel({ open, setOpen }) {
  const { prefs, set, reset } = useDesignPrefs();
  const { lang } = useI18n();
  const ar = lang === 'ar';
  const panelRef = useRef(null);
  const restoreRef = useRef(null); // element to return focus to on close

  useEffect(() => {
    if (!open) return undefined;
    restoreRef.current = document.activeElement;
    const focusables = () => (panelRef.current
      ? Array.from(panelRef.current.querySelectorAll('button, input, select, textarea, [tabindex]:not([tabindex="-1"])'))
        .filter((el) => !el.disabled && el.offsetParent !== null)
      : []);
    const id = setTimeout(() => { const f = focusables(); (f[0] || panelRef.current)?.focus?.(); }, 20);
    const onKey = (e) => {
      if (e.key === 'Escape') { e.preventDefault(); setOpen(false); return; }
      if (e.key === 'Tab') { // focus trap: cycle within the panel
        const f = focusables();
        if (!f.length) return;
        const first = f[0]; const last = f[f.length - 1];
        if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
        else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
      }
    };
    window.addEventListener('keydown', onKey);
    return () => { clearTimeout(id); window.removeEventListener('keydown', onKey); restoreRef.current?.focus?.(); };
  }, [open, setOpen]);

  if (!open) return null;

  const L = ar
    ? { title: 'التخصيص', identity: 'الهوية', accent: 'اللون', surface: 'عمق السطح', corners: 'الزوايا', sharp: 'حادة', soft: 'ناعمة', rounded: 'دائرية', scale: 'الكثافة والمقياس', density: 'الكثافة', compact: 'مضغوط', comfortable: 'مريح', ultra: 'فائق', type: 'مقياس الخط', live: 'البيانات الحية', spark: 'الرسوم المصغّرة', glow: 'التوهّج', motion: 'الحركة الحية', grid: 'خطوط الجدول', reset: 'استعادة الافتراضي', close: 'إغلاق' }
    : { title: 'Tweaks', identity: 'Identity', accent: 'Accent', surface: 'Surface depth', corners: 'Corners', sharp: 'Sharp', soft: 'Soft', rounded: 'Rounded', scale: 'Density & scale', density: 'Density', compact: 'Compact', comfortable: 'Comfortable', ultra: 'Ultra', type: 'Type scale', live: 'Live data', spark: 'Inline sparklines', glow: 'Ambient glow', motion: 'Live motion', grid: 'Table grid lines', reset: 'Reset to defaults', close: 'Close' };

  return (
    <aside className="tweaks-panel" role="dialog" aria-modal="true" aria-label={L.title} ref={panelRef} tabIndex={-1}>
      <div className="tweaks-head">
        <strong>{L.title}</strong>
        <button className="btn sm" onClick={() => setOpen(false)} aria-label={L.close}>✕</button>
      </div>

      <div className="tweaks-sec">
        <div className="tweaks-sec-label">{L.identity}</div>
        <div className="tw-field-label">{L.accent}</div>
        <div className="swatches">
          {ACCENTS.map((a) => (
            <button
              key={a.id}
              type="button"
              className={`swatch ${prefs.accent === a.id ? 'sel' : ''}`}
              style={{ background: a.color }}
              aria-label={a.id}
              aria-pressed={prefs.accent === a.id}
              onClick={() => set({ accent: a.id })}
            >
              {prefs.accent === a.id && <span className="swatch-check" aria-hidden>✓</span>}
            </button>
          ))}
        </div>

        {prefs.theme === 'dark' && (
          <>
            <div className="tw-field-label" style={{ marginBlockStart: 'var(--s-3)' }}>{L.surface}</div>
            <div className="swatches">
              {SURFACES.map((s) => (
                <button
                  key={s.id}
                  type="button"
                  className={`swatch wide ${prefs.surface === s.id ? 'sel' : ''}`}
                  style={{ background: s.color, borderColor: 'var(--c-border-strong)' }}
                  aria-label={s.id}
                  aria-pressed={prefs.surface === s.id}
                  onClick={() => set({ surface: s.id })}
                >
                  {prefs.surface === s.id && <span className="swatch-check" aria-hidden>✓</span>}
                </button>
              ))}
            </div>
          </>
        )}

        <div className="tw-field-label" style={{ marginBlockStart: 'var(--s-3)' }}>{L.corners}</div>
        <div className="seg" role="group" aria-label={L.corners}>
          {[['sharp', L.sharp], ['soft', L.soft], ['rounded', L.rounded]].map(([id, lbl]) => (
            <button key={id} className={prefs.corners === id ? 'on' : ''} onClick={() => set({ corners: id })}>{lbl}</button>
          ))}
        </div>
      </div>

      <div className="tweaks-sec">
        <div className="tweaks-sec-label">{L.scale}</div>
        <div className="tw-field-label">{L.density}</div>
        <div className="seg" role="group" aria-label={L.density}>
          {[['compact', L.compact], ['comfortable', L.comfortable], ['ultra', L.ultra]].map(([id, lbl]) => (
            <button key={id} className={prefs.density === id ? 'on' : ''} onClick={() => set({ density: id })}>{lbl}</button>
          ))}
        </div>
        <div className="tw-field-label" style={{ marginBlockStart: 'var(--s-3)' }}>{L.type} · {prefs.typeScale.toFixed(2)}×</div>
        <input
          type="range" min="0.9" max="1.2" step="0.05" value={prefs.typeScale}
          className="tw-range" aria-label={L.type}
          onChange={(e) => set({ typeScale: Number(e.target.value) })}
        />
      </div>

      <div className="tweaks-sec">
        <div className="tweaks-sec-label">{L.live}</div>
        <Toggle on={prefs.spark} label={L.spark} onClick={() => set({ spark: !prefs.spark })} />
        <Toggle on={prefs.glow} label={L.glow} onClick={() => set({ glow: !prefs.glow })} />
        <Toggle on={prefs.motion} label={L.motion} onClick={() => set({ motion: !prefs.motion })} />
        <Toggle on={prefs.grid} label={L.grid} onClick={() => set({ grid: !prefs.grid })} />
      </div>

      <button className="btn" onClick={reset} style={{ marginBlockStart: 'auto' }}>{L.reset}</button>
    </aside>
  );
}
