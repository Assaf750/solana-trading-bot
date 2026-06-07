// @soltrade/management-api — read-only router (skeleton, Gate A).
// SOURCE: docs/03-API-CONTRACT.md §4/§8/§13 + docs/01-SSOT.md Groups 10/11.
// READ-ONLY: only GET. No command_type. No opportunity execution. No write/exec path.
// Deterministic mocks; NO external network calls. No new api_error_code.
//
// Health is NOT trading readiness. /ready is a diagnostic only — REAL-LIVE is a separate,
// user-gated decision and is never enabled here.

import { RESOURCE_TYPE, API_ERROR_CODE } from '../../../packages/contracts/src/api-vocabulary.mjs';

const RT = new Set(RESOURCE_TYPE);
const ERR = new Set(API_ERROR_CODE);

// Read-only resource routes -> resource_type (must be a registered SSOT value).
const READ_ROUTES = Object.freeze({
  '/api/config': 'config',
  '/api/positions': 'position',
  '/api/intents': 'intent',
  '/api/readiness': 'readiness',
  '/api/health': 'health',
  '/api/audit': 'audit',
  '/api/opportunities': 'opportunity',
});

// Validate at module load that every route maps to a real resource_type and our only
// error code is registered (fail fast on drift).
for (const rt of Object.values(READ_ROUTES)) if (!RT.has(rt)) throw new Error(`route resource_type not in SSOT: ${rt}`);
if (!ERR.has('RESOURCE_NOT_FOUND')) throw new Error('RESOURCE_NOT_FOUND not in api_error_code');

const json = (status, body) => ({ status, headers: { 'content-type': 'application/json' }, body });

function readOnlyWriteRejected() {
  // No new api_error_code: transport-level 405 with a message only. No command executed.
  return json(405, { error_message: 'read-only skeleton (Gate A): write/command operations are not available' });
}

/**
 * Pure request handler. @param req { method, path } @returns { status, headers, body }.
 * No side effects, no I/O, no network.
 */
export function handleRequest(req = {}) {
  const method = String(req.method || 'GET').toUpperCase();
  const path = String(req.path || '/');

  // Infra probes (operational; not SSOT resources). GET only.
  if (path === '/health') {
    if (method !== 'GET') return readOnlyWriteRejected();
    return json(200, { status: 'ok', note: 'liveness only — does NOT mean trading readiness' });
  }
  if (path === '/ready') {
    if (method !== 'GET') return readOnlyWriteRejected();
    return json(200, {
      operating_state: 'WARMING_UP',         // SSOT G1 (mock; Gate A non-trading)
      real_live_config_valid: false,         // SSOT G10
      validation_status: 'invalid',          // SSOT G10
      warning: 'WARNING_CRITICAL',           // SSOT G5
      note: 'readiness diagnostic only — NOT trading readiness; REAL-LIVE is a separate user-gated decision',
    });
  }

  // Read-only resource models.
  if (path in READ_ROUTES) {
    if (method !== 'GET') return readOnlyWriteRejected();
    return json(200, { resource_type: READ_ROUTES[path], read_only: true, data: [] });
  }

  return json(404, { api_error_code: 'RESOURCE_NOT_FOUND', error_message: `unknown resource: ${path}` });
}

export const READ_ONLY_ROUTES = Object.freeze(['/health', '/ready', ...Object.keys(READ_ROUTES)]);
export const ROUTE_RESOURCE_TYPES = READ_ROUTES;
