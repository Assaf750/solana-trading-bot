// server.mjs — node:http adapter: localhost-only listener, JSON body limit,
// SSE event stream, static serving of the built operator UI. Zero dependencies.
import { createServer } from 'node:http';
import { readFileSync, existsSync, statSync } from 'node:fs';
import { join, extname, normalize } from 'node:path';
import { REPO_ROOT } from './util.mjs';

const UI_DIST = join(REPO_ROOT, 'apps', 'operator-ui', 'dist');
const BODY_LIMIT = 64 * 1024;
const MIME = {
  '.html': 'text/html; charset=utf-8', '.js': 'text/javascript', '.css': 'text/css',
  '.json': 'application/json', '.svg': 'image/svg+xml', '.png': 'image/png', '.ico': 'image/x-icon',
};

export function startServer({ api, host = '127.0.0.1', port = 8787 }) {
  const sseClients = new Set();

  function broadcast(payload) {
    const line = `data: ${JSON.stringify({ event_timestamp: new Date().toISOString(), ...payload })}\n\n`;
    for (const res of sseClients) {
      try { res.write(line); } catch { sseClients.delete(res); }
    }
  }

  const server = createServer(async (req, res) => {
    const url = new URL(req.url, `http://${req.headers.host || 'localhost'}`);
    const path = url.pathname + (url.search || '');

    // dev CORS: allow the Vite dev server on localhost only
    const origin = req.headers.origin;
    if (origin && /^https?:\/\/(localhost|127\.0\.0\.1):\d+$/.test(origin)) {
      res.setHeader('Access-Control-Allow-Origin', origin);
      res.setHeader('Access-Control-Allow-Methods', 'GET,POST,DELETE,OPTIONS');
      res.setHeader('Access-Control-Allow-Headers', 'content-type');
    }
    if (req.method === 'OPTIONS') { res.writeHead(204); res.end(); return; }

    // SSE stream
    if (url.pathname === '/api/stream') {
      res.writeHead(200, {
        'content-type': 'text/event-stream', 'cache-control': 'no-cache', connection: 'keep-alive',
      });
      res.write(`data: ${JSON.stringify({ event_type: 'health_update', hello: true })}\n\n`);
      sseClients.add(res);
      req.on('close', () => sseClients.delete(res));
      return;
    }

    // API
    if (url.pathname.startsWith('/api/')) {
      let body = null;
      if (req.method === 'POST' || req.method === 'DELETE') {
        body = await readBody(req).catch(() => undefined);
        if (body === undefined) { sendJson(res, 413, { ok: false, error_message: 'body_too_large_or_invalid' }); return; }
      }
      const out = await api.handle({ method: req.method, path, body });
      sendJson(res, out.status, out.body);
      return;
    }

    // Static UI (SPA fallback to index.html)
    serveStatic(url.pathname, res);
  });

  server.listen(port, host);
  return { server, broadcast, url: `http://${host}:${port}` };
}

function readBody(req) {
  return new Promise((resolve, reject) => {
    let size = 0;
    const chunks = [];
    req.on('data', (c) => {
      size += c.length;
      if (size > BODY_LIMIT) { reject(new Error('too_large')); req.destroy(); return; }
      chunks.push(c);
    });
    req.on('end', () => {
      if (!chunks.length) { resolve(null); return; }
      try { resolve(JSON.parse(Buffer.concat(chunks).toString('utf8'))); }
      catch { resolve(null); }
    });
    req.on('error', reject);
  });
}

function sendJson(res, status, body) {
  const payload = JSON.stringify(body ?? {});
  res.writeHead(status, { 'content-type': 'application/json; charset=utf-8' });
  res.end(payload);
}

function serveStatic(pathname, res) {
  if (!existsSync(UI_DIST)) {
    res.writeHead(503, { 'content-type': 'text/html; charset=utf-8' });
    res.end('<h1>UI not built</h1><p>Run: <code>cd apps/operator-ui && npm install && npm run build</code></p>');
    return;
  }
  let rel = pathname === '/' ? '/index.html' : pathname;
  // path traversal guard
  const safe = normalize(join(UI_DIST, rel));
  if (!safe.startsWith(UI_DIST)) { res.writeHead(403); res.end(); return; }
  let file = safe;
  if (!existsSync(file) || !statSync(file).isFile()) file = join(UI_DIST, 'index.html'); // SPA fallback
  const mime = MIME[extname(file)] || 'application/octet-stream';
  // hashed assets (Vite emits content-hashed filenames) are immutable; index.html must
  // never be cached so a rebuilt UI loads immediately (no stale bundle after upgrades).
  const isHashedAsset = /\/assets\/.+\.[0-9a-zA-Z_-]{8,}\.(js|css)$/.test(file.replace(/\\/g, '/'));
  const cache = isHashedAsset ? 'public, max-age=31536000, immutable' : 'no-cache, must-revalidate';
  res.writeHead(200, { 'content-type': mime, 'cache-control': cache });
  res.end(readFileSync(file));
}
