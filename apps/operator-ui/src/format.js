// format.js — shared display formatters for the operator UI (single source of truth so the
// address-abbreviation format can't drift across pages).
export const shortMint = (a) => (a ? `${String(a).slice(0, 4)}…${String(a).slice(-4)}` : '');
