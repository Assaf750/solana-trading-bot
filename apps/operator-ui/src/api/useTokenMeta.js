// useTokenMeta — shared, batched mint -> {symbol,name,icon} resolver for the whole UI.
// Many components ask for token labels independently; this collects their requests, fetches
// them in ONE backend call per ~80ms tick, caches the result process-wide, and notifies
// subscribers when answers arrive. Display-only — a miss simply renders the short mint.
import { useEffect, useState } from 'react';
import { api } from './client.js';

const cache = new Map(); // mint -> {symbol,name,icon} | null (null = known-miss, do not refetch)
const queue = new Set(); // mints awaiting the next batch
const subs = new Set();  // re-render callbacks
let timer = null;

function notify() { for (const cb of subs) cb(); }

async function flush() {
  timer = null;
  // drop any already-resolved stragglers, then take at most 100 for this request
  for (const m of [...queue]) if (cache.has(m)) queue.delete(m);
  const batch = [...queue].slice(0, 100);
  for (const m of batch) queue.delete(m); // leave the overflow (>100) queued
  if (!batch.length) { if (queue.size) timer = setTimeout(flush, 80); return; }
  const r = await api.tokenMeta(batch);
  if (!r.ok) {
    // transient failure (call() returns {ok:false}, never throws): re-queue and retry with
    // backoff instead of permanently negative-caching every mint in the batch.
    for (const m of batch) queue.add(m);
    timer = setTimeout(flush, 2000);
    return;
  }
  const tokens = r.data?.tokens || {};
  // cache misses as null too, so we don't loop re-requesting an unknown mint this session
  for (const m of batch) cache.set(m, tokens[m] || null);
  notify();
  if (queue.size) timer = setTimeout(flush, 80); // process the overflow next tick
}

export function requestTokenMeta(mints) {
  let added = false;
  for (const m of mints || []) {
    if (m && !cache.has(m) && !queue.has(m)) { queue.add(m); added = true; }
  }
  if (added && !timer) timer = setTimeout(flush, 80);
}

// Returns a { mint: {symbol,name,icon} } map for the mints currently resolved.
export function useTokenMeta(mints) {
  const list = Array.isArray(mints) ? mints.filter(Boolean) : [];
  const key = list.join(',');
  const [, force] = useState(0);
  useEffect(() => {
    const cb = () => force((n) => n + 1);
    subs.add(cb);
    requestTokenMeta(list);
    return () => { subs.delete(cb); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key]);
  const out = {};
  for (const m of list) { const c = cache.get(m); if (c) out[m] = c; }
  return out;
}
