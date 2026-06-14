// TokenLabel — renders a token's symbol + logo for a mint, falling back to the short
// mint address when metadata isn't known. Resolution is batched/cached via useTokenMeta.
import { useTokenMeta } from '../api/useTokenMeta.js';
import { shortMint } from '../format.js';

export default function TokenLabel({ mint, showIcon = true, showMint = true, className = '' }) {
  const meta = useTokenMeta(mint ? [mint] : [])[mint];
  const sym = meta?.symbol;
  return (
    <span className={`token-label ${className}`} title={meta?.name || mint || ''} dir="ltr">
      {showIcon && meta?.icon && (
        <img className="token-ico" src={meta.icon} alt="" loading="lazy" onError={(e) => { e.currentTarget.style.display = 'none'; }} />
      )}
      {sym
        ? <span className="token-sym">{sym}</span>
        : <span className="mono">{mint ? shortMint(mint) : '—'}</span>}
      {showMint && sym && <span className="token-addr mono">{shortMint(mint)}</span>}
    </span>
  );
}
