// history.mjs — append-only operator activity log (token/wallet analyses, radar scans, …).
// Ring-buffered + persisted, read-only consumers. Distinct from the audit log (which records
// command attempts): this is the user-facing "what did I look at" trail that feeds the Reports
// "recent activity" view and the Mission Control counts.
import { readJson, writeJson, newId, nowIso } from '../util.mjs';

const FILE = 'history.json';
const MAX = 300;

export function createHistory({ file = FILE } = {}) {
  function load() { return readJson(file, { events: [] }).value; }

  function record(entry) {
    if (!entry || typeof entry.type !== 'string') return;
    const s = load();
    s.events.push({ id: newId('h'), ts: nowIso(), ...entry });
    if (s.events.length > MAX) s.events.splice(0, s.events.length - MAX);
    writeJson(file, s);
  }

  function list({ limit = 100, type = null } = {}) {
    let e = load().events.slice().reverse(); // newest first
    if (type) e = e.filter((x) => x.type === type);
    return e.slice(0, Math.min(500, Math.max(1, limit)));
  }

  function counts() {
    const e = load().events;
    const by_type = {};
    for (const x of e) by_type[x.type] = (by_type[x.type] || 0) + 1;
    return { total: e.length, by_type };
  }

  return { record, list, counts };
}
