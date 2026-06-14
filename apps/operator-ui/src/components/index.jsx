import { useState, useMemo, useEffect, useRef, useId } from 'react';
import { useI18n } from '../i18n/index.jsx';

// ---------- Badge ----------
export function Badge({ tone = 'neutral', children, dot = true }) {
  return (
    <span className={`badge ${tone}`}>
      {dot && <span className="dot" />}
      {children}
    </span>
  );
}

// ---------- SimulatedBadge ----------
export function SimulatedBadge() {
  const { t } = useI18n();
  return <Badge tone="sim">{t('app.simulated')}</Badge>;
}

export function ReadOnlyBadge() {
  const { t } = useI18n();
  return <Badge tone="info">{t('app.readOnly')}</Badge>;
}

// ---------- UnavailableValue ----------
// Renders the i18n "unavailable" string for null/undefined — NEVER 0-as-unknown.
export function UnavailableValue({ value, format, suffix = '' }) {
  const { t } = useI18n();
  if (value === null || value === undefined || value === '') {
    return <span className="unavailable">{t('common.unavailable')}</span>;
  }
  const out = format ? format(value) : value;
  return (
    <span>
      {out}
      {suffix}
    </span>
  );
}

// ---------- Card ----------
export function Card({ title, sub, right, children, className = '' }) {
  return (
    <section className={`card ${className}`}>
      {(title || right) && (
        <div className="card-head">
          {title && <h3>{title}</h3>}
          <span className="card-head-spacer" />
          {right}
        </div>
      )}
      {sub && <div className="card-sub">{sub}</div>}
      {children}
    </section>
  );
}

// ---------- Metric tile ----------
export function Metric({ label, value, mono = false, tone }) {
  return (
    <div className="metric">
      <span className="label">{label}</span>
      <span className={`value ${mono ? 'mono' : ''} ${tone || ''}`}>{value}</span>
    </div>
  );
}

// ---------- StatusChip ----------
const STATE_TONE = {
  ACTIVE: 'ok',
  WARMING_UP: 'warn',
  PAUSED: 'warn',
  EXITS_ONLY: 'warn',
  KILLED: 'danger',
  DISABLED: 'neutral',
  DRAINING: 'warn',
  RETIRED: 'neutral',
  REVOKED: 'danger',
  DEGRADED: 'warn',
  green: 'ok',
  changed: 'danger',
  ready: 'ok',
  pending: 'warn',
  degraded: 'warn',
  unavailable: 'neutral'
};
export function toneFor(state) {
  return STATE_TONE[state] || 'neutral';
}

export function StatusChip({ label, state }) {
  return (
    <span className="status-chip">
      {label && <span className="muted">{label}:</span>}
      <Badge tone={toneFor(state)}>{state}</Badge>
    </span>
  );
}

// ---------- StalenessTag ----------
export function StalenessTag({ fresh = true }) {
  const { t } = useI18n();
  if (fresh) return <Badge tone="ok">{t('common.fresh')}</Badge>;
  return <span className="stale-tag">⚠ {t('common.stale')}</span>;
}

// ---------- DangerNote (security/critical — always visible, cannot collapse) ----------
export function DangerNote({ tone = 'danger', children, locked = false }) {
  const { t } = useI18n();
  const ico = tone === 'danger' ? '⛔' : tone === 'warn' ? '⚠' : tone === 'sim' ? '🧪' : 'ℹ';
  return (
    <div className={`note ${tone} ${locked ? 'locked' : ''}`} role={tone === 'danger' ? 'alert' : 'note'}>
      <span className="note-ico" aria-hidden>{ico}</span>
      <div>{children}</div>
      {locked && <span className="lock-tag">🔒 {t('notice.advisory')}</span>}
    </div>
  );
}

// ---------- EmptyState ----------
export function EmptyState({ message }) {
  const { t } = useI18n();
  return (
    <div className="empty-state">
      <div className="es-ico" aria-hidden>∅</div>
      <div>{message || t('common.empty')}</div>
    </div>
  );
}

// ---------- PreviewDisabledAction ----------
// A spec command surface rendered visibly DISABLED with the "not executable" caption.
export function PreviewDisabledAction({ label, danger = false, onPreview }) {
  const { t } = useI18n();
  return (
    <span className="preview-action">
      <button
        className="btn"
        disabled
        aria-disabled="true"
        title={t('notice.notExecutable')}
        style={danger ? { borderColor: 'var(--c-danger)', color: 'var(--c-danger)' } : undefined}
        onClick={(e) => {
          e.preventDefault();
          if (onPreview) onPreview();
        }}
      >
        {danger ? '⛔ ' : ''}
        {label}
      </button>
      <span className="pa-caption">{t('notice.notExecutable')}</span>
    </span>
  );
}

// ---------- Timeline ----------
export function Timeline({ entries }) {
  return (
    <ol className="timeline">
      {entries.map((e, i) => (
        <li key={i}>
          <span className={`tl-dot ${e.tone || 'neutral'}`} />
          <div className="tl-stage">
            {e.title}
            {e.badge}
          </div>
          {e.meta && <div className="tl-meta">{e.meta}</div>}
        </li>
      ))}
    </ol>
  );
}

// ---------- DataTable (sort / filter / search) ----------
export function DataTable({ columns, rows, searchKeys, initialSort }) {
  const { t } = useI18n();
  const [query, setQuery] = useState('');
  const [sort, setSort] = useState(initialSort || null); // {key, dir}

  const filtered = useMemo(() => {
    let r = rows;
    if (query && searchKeys && searchKeys.length) {
      const q = query.toLowerCase();
      r = r.filter((row) =>
        searchKeys.some((k) => {
          const v = row[k];
          return v != null && String(v).toLowerCase().includes(q);
        })
      );
    }
    if (sort) {
      const { key, dir } = sort;
      r = [...r].sort((a, b) => {
        const av = a[key];
        const bv = b[key];
        if (av == null && bv == null) return 0;
        if (av == null) return 1;
        if (bv == null) return -1;
        if (typeof av === 'number' && typeof bv === 'number') return dir === 'asc' ? av - bv : bv - av;
        return dir === 'asc' ? String(av).localeCompare(String(bv)) : String(bv).localeCompare(String(av));
      });
    }
    return r;
  }, [rows, query, sort, searchKeys]);

  const toggleSort = (key, sortable) => {
    if (sortable === false) return;
    setSort((s) => {
      if (!s || s.key !== key) return { key, dir: 'asc' };
      if (s.dir === 'asc') return { key, dir: 'desc' };
      return null;
    });
  };

  return (
    <div>
      {searchKeys && searchKeys.length > 0 && (
        <div className="table-toolbar">
          <input
            className="search"
            placeholder={`${t('common.search')}…`}
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            aria-label={t('common.search')}
          />
          <span className="faint">{filtered.length} / {rows.length}</span>
        </div>
      )}
      <div className="table-wrap">
        <table className="data">
          <thead>
            <tr>
              {columns.map((c) => (
                <th
                  key={c.key}
                  className={c.sortable === false ? 'nosort' : ''}
                  onClick={() => toggleSort(c.key, c.sortable)}
                  scope="col"
                >
                  {c.label}
                  {sort && sort.key === c.key ? (sort.dir === 'asc' ? ' ▲' : ' ▼') : ''}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {filtered.length === 0 ? (
              <tr>
                <td colSpan={columns.length}>
                  <EmptyState />
                </td>
              </tr>
            ) : (
              filtered.map((row, ri) => (
                <tr
                  key={row.id || ri}
                  onClick={row.__onClick}
                  style={row.__onClick ? { cursor: 'pointer' } : undefined}
                  className={row.__selected ? 'selected' : ''}
                >
                  {columns.map((c) => (
                    <td key={c.key} className={c.cellClass || ''}>
                      {c.render ? c.render(row[c.key], row) : row[c.key]}
                    </td>
                  ))}
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

// ---------- Modal (danger / confirmation pattern — never executes) ----------
export function NotExecutableModal({ open, title, onClose, body }) {
  const { t } = useI18n();
  if (!open) return null;
  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal" onClick={(e) => e.stopPropagation()} role="dialog" aria-modal="true">
        <h3>{title}</h3>
        <DangerNote tone="warn">
          {body || t('notice.notExecutable')}
        </DangerNote>
        <p className="muted fs-sm">
          {t('notice.readOnly')}
        </p>
        <div className="modal-actions">
          <button className="btn" onClick={onClose}>{t('common.close')}</button>
          <button className="btn" disabled aria-disabled="true" title={t('notice.notExecutable')}>
            {t('common.confirm')}
          </button>
        </div>
      </div>
    </div>
  );
}

// ---------- Deterministic series (seeded — stable per token, no real history) ----------
// Used to render illustrative sparklines/mini-charts. NOT real price history; purely a
// visual trend hint derived from a stable seed so the same token always draws the same line.
export function genSeries(seed, n = 24, bias = 0) {
  let h = 2166136261;
  const s = String(seed);
  for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619); }
  let state = (h >>> 0) || 1;
  const rnd = () => { state = (Math.imul(state, 1664525) + 1013904223) >>> 0; return state / 4294967296; };
  const out = [];
  let v = 40 + rnd() * 25;
  for (let i = 0; i < n; i++) {
    v += (rnd() - 0.5) * 14 + bias;
    v = Math.max(4, Math.min(96, v));
    out.push(v);
  }
  return out;
}

// ---------- Shared SVG path geometry (line + filled area + last point) ----------
// `pad` is the vertical inset on both top and bottom. Guards length 0/1 so a single
// (or empty) series never divides by zero or produces NaN/Infinity path coordinates.
function buildPath(pts, width, height, pad) {
  const safe = (pts && pts.length) ? pts : [height / 2];
  const min = Math.min(...safe);
  const max = Math.max(...safe);
  const span = (max - min) || 1;
  const stepX = safe.length > 1 ? width / (safe.length - 1) : 0;
  const coords = safe.map((v, i) => [i * stepX, height - ((v - min) / span) * (height - pad * 2) - pad]);
  const line = coords.map((c, i) => `${i ? 'L' : 'M'}${c[0].toFixed(1)} ${c[1].toFixed(1)}`).join(' ');
  const area = `${line} L${width} ${height} L0 ${height} Z`;
  const last = coords[coords.length - 1] || [0, height / 2];
  return { line, area, last };
}

// ---------- Sparkline (inline SVG trend) ----------
export function Sparkline({ data, tone, width = 64, height = 20, seed, bias = 0, points = 24 }) {
  const { line, area, last } = useMemo(() => {
    const pts = (data && data.length) ? data : genSeries(seed ?? 'spark', points, bias);
    return buildPath(pts, width, height, 1.5);
  }, [data, seed, bias, points, width, height]);
  const cls = tone === 'pos' ? 'pos' : tone === 'neg' ? 'neg' : tone === 'muted' ? 'muted' : '';
  return (
    <span className={`spark ${cls}`} aria-hidden>
      <svg width={width} height={height} viewBox={`0 0 ${width} ${height}`}>
        <path className="spark-area" d={area} />
        <path className="spark-line" d={line} />
        <circle className="spark-dot" cx={last[0].toFixed(1)} cy={last[1].toFixed(1)} r="1.7" />
      </svg>
    </span>
  );
}

// ---------- MiniChart (area chart for detail panels) ----------
export function MiniChart({ data, tone, seed, bias = 0, height = 60, points = 40, label }) {
  const rawId = useId();
  const gid = 'mc' + rawId.replace(/[^a-zA-Z0-9]/g, '');
  const width = 260;
  const { line, area, last } = useMemo(() => {
    const pts = (data && data.length) ? data : genSeries(seed ?? 'mc', points, bias);
    return buildPath(pts, width, height, 4);
  }, [data, seed, bias, points, height]);
  const cls = tone === 'pos' ? 'pos' : tone === 'neg' ? 'neg' : tone === 'muted' ? 'muted' : '';
  return (
    <div className={`minichart ${cls}`}>
      {label && <div className="minichart-label">{label}</div>}
      <svg viewBox={`0 0 ${width} ${height}`} width="100%" height={height} preserveAspectRatio="none" aria-hidden>
        <defs>
          <linearGradient id={gid} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" className="mc-stop-top" />
            <stop offset="100%" className="mc-stop-bottom" />
          </linearGradient>
        </defs>
        <path className="mc-area" style={{ fill: `url(#${gid})` }} d={area} />
        <path className="mc-line" vectorEffect="non-scaling-stroke" d={line} />
        <circle className="mc-dot" cx={last[0].toFixed(1)} cy={last[1].toFixed(1)} r="2.4" />
      </svg>
    </div>
  );
}

// ---------- FlashValue (flashes green/red when the value changes) ----------
export function FlashValue({ value, format, className = '' }) {
  const prev = useRef(value);
  const [flash, setFlash] = useState('');
  useEffect(() => {
    const cur = prev.current;
    // Only flash on a real, finite change — NaN/Infinity never trigger a (perpetual) flash.
    if (Number.isFinite(cur) && Number.isFinite(value) && value !== cur) {
      setFlash(value > cur ? 'flash-up' : 'flash-down');
      const id = setTimeout(() => setFlash(''), 650);
      prev.current = value;
      return () => clearTimeout(id);
    }
    prev.current = value;
    return undefined;
  }, [value]);
  const out = format ? format(value) : value;
  return <span className={`${className} ${flash}`.trim()}>{out}</span>;
}
