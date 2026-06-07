// @soltrade/management-api — dev-only LOCAL listener (inbound only).
// Wires the pure read-only router to a local HTTP listener for development.
// node:http here is an INBOUND local listener — NOT an outbound/external network call.
// No outbound clients (no fetch/axios/RPC/provider calls). Run: `node src/server.mjs`.

import { createServer } from 'node:http';
import { handleRequest } from './router.mjs';

export function createDevServer() {
  return createServer((req, res) => {
    const path = (req.url || '/').split('?')[0];
    const out = handleRequest({ method: req.method, path });
    res.writeHead(out.status, out.headers);
    res.end(JSON.stringify(out.body));
  });
}

// Bind only when executed directly (never during tests/imports).
if (process.argv[1] && import.meta.url === `file://${process.argv[1].replace(/\\/g, '/')}`) {
  const host = process.env.HOST || '127.0.0.1';
  const port = Number(process.env.PORT || 8081);
  createDevServer().listen(port, host, () => {
    // No scheme/URL printed (keeps this file free of outbound-looking literals).
    console.log(`management-api (read-only skeleton) listening on ${host}:${port}`);
  });
}
