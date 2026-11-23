const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const ts = require('typescript');

// Loads the real Apps Script provider with its imports stubbed: no network or env.
function load(file, imports = {}) {
  const exports = {};
  const source = fs.readFileSync(path.join(__dirname, '..', file), 'utf8');
  vm.runInNewContext(ts.transpileModule(source, {
    compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.CommonJS },
  }).outputText, { exports, Error, JSON, console, AbortSignal, require(name) {
    if (!(name in imports)) throw new Error(`Forbidden import: ${name}`);
    return imports[name];
  } });
  return exports;
}

const { evaluateAppsScriptResponse } = load('src/lib/integrations/sheets/providers/apps-script.ts', {
  '@prisma/client': { SyncProvider: { APPS_SCRIPT: 'APPS_SCRIPT' } },
  '@/lib/env': { env: {}, requireServerEnv: () => 'https://example.invalid' },
});

const payload = { provider: 'APPS_SCRIPT', order: { order_id: 'o1', estado: 'PROOF_UPLOADED' }, items: [] };

test('ok:true from Apps Script counts as synced', () => {
  const r = evaluateAppsScriptResponse(200, true, { ok: true, mode: 'upsert' }, payload, 'APPS_SCRIPT');
  assert.equal(r.success, true);
});

test('HTTP 200 with ok:false (lock timeout) is a failure, not a success', () => {
  const r = evaluateAppsScriptResponse(200, true, { ok: false, error: 'Exception: Lock timeout' }, payload, 'APPS_SCRIPT');
  assert.equal(r.success, false);
  assert.match(r.errorMessage, /Lock timeout/);
});

test('HTML page with 200 is a failure', () => {
  const r = evaluateAppsScriptResponse(200, true, '<html>Sign in</html>', payload, 'APPS_SCRIPT');
  assert.equal(r.success, false);
});

test('non-2xx is a failure', () => {
  const r = evaluateAppsScriptResponse(500, false, { ok: true }, payload, 'APPS_SCRIPT');
  assert.equal(r.success, false);
  assert.match(r.errorMessage, /500/);
});

const { isOutOfSync } = load('src/features/orders/services/sync-service.ts', {
  '@prisma/client': {
    OrderStatus: { PAID: 'PAID', PROOF_UPLOADED: 'PROOF_UPLOADED' },
    SyncProvider: { APPS_SCRIPT: 'APPS_SCRIPT' },
    SyncJobStatus: {}, SyncLogStatus: { SUCCESS: 'SUCCESS' }, SyncStatus: {}, Prisma: {},
  },
  '@/lib/env': { env: {} },
  '@/lib/db/prisma': { prisma: {} },
  '@/lib/integrations/sheets/factory': {},
  '@/features/wholesale/bundles': {},
  '@/features/wholesale/tax-condition': {},
  '@/lib/storage/payment-proofs': {},
  '@/lib/storage/shipping-labels': {},
  '@/lib/utils/datetime': {},
});

const job = (estado, response) => ({ provider: 'APPS_SCRIPT', logs: [{ requestPayload: { order: { estado } }, responsePayload: response }] });

test('paid order whose last confirmed send matches is in sync', () => {
  assert.equal(isOutOfSync('PROOF_UPLOADED', job('PROOF_UPLOADED', { ok: true })), false);
});

test('marked as sent but Apps Script answered ok:false is out of sync', () => {
  assert.equal(isOutOfSync('PAID', job('PAID', { ok: false, error: 'Lock timeout' })), true);
});

test('sheet got an older status (PENDING_PAYMENT) is out of sync', () => {
  assert.equal(isOutOfSync('PAID', job('PENDING_PAYMENT', { ok: true })), true);
});

test('never sent is out of sync', () => {
  assert.equal(isOutOfSync('PAID', undefined), true);
  assert.equal(isOutOfSync('PAID', { provider: 'APPS_SCRIPT', logs: [] }), true);
});
