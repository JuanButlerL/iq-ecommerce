const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const ts = require('typescript');
const { randomUUID } = require('node:crypto');
const now = Date.parse('2026-09-23T12:00:00Z');
class FixedDate extends Date {
  constructor(...args) { super(...(args.length ? args : [now])); }
  static now() { return now; }
}

// Execute the real service with ALL imports replaced. No env files, network,
// Prisma client, SMTP transport or real provider can be loaded by these tests.
function load(file, imports = {}) {
  const exports = {};
  const source = fs.readFileSync(path.join(__dirname, '..', file), 'utf8');
  vm.runInNewContext(ts.transpileModule(source, {
    compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.CommonJS },
  }).outputText, { exports, Date: FixedDate, Math, Error, console, require(name) {
    if (!(name in imports)) throw new Error(`Forbidden import: ${name}`);
    return imports[name];
  } });
  return exports;
}
const policy = load('src/features/email/post-purchase-policy.ts');
const cutoff = '2026-09-22T12:00:00Z';
const after = new Date('2026-09-22T13:00:00Z');
const before = new Date('2026-09-21T13:00:00Z');
const statuses = Object.fromEntries(['POST_PURCHASE', 'ORDER_CREATED', 'WELCOME_LEAD', 'CART_ABANDONED', 'SENT', 'ERROR', 'SKIPPED', 'PAID', 'PROOF_UPLOADED', 'CANCELLED', 'EXPIRED'].map(s => [s, s]));
class UniqueError extends Error { code = 'P2002'; }

// Minimal relational predicate evaluator; notably filters BEFORE applying take.
function matches(row, where) {
  return Object.entries(where).every(([key, value]) => {
    if (key === 'OR') return value.some(clause => matches(row, clause));
    if (key === 'AND') return value.every(clause => matches(row, clause));
    const actual = row[key];
    if (value === null || typeof value !== 'object') return actual === value;
    return Object.entries(value).every(([op, operand]) => {
      switch (op) {
        case 'in': return operand.includes(actual);
        case 'notIn': return !operand.includes(actual);
        case 'gte': return actual != null && actual >= operand;
        case 'lte': return actual != null && actual <= operand;
        case 'gt': return actual != null && actual > operand;
        case 'none': return !actual.some(item => matches(item, operand));
        case 'some': return actual.some(item => matches(item, operand));
        case 'startsWith': return actual.startsWith(operand);
        default: throw new Error(`Unsupported predicate ${op}`);
      }
    });
  });
}
function order(id, extra = {}) {
  return { id, createdAt: after, paidAt: after, paymentProofs: [], paymentStatus: 'PAID', orderStatus: 'PAID', customerEmail: `${id}@example.invalid`, customerFirstName: 'Test', publicOrderNumber: id, totalArs: 100, ...extra };
}
function harness(orders, options = {}) {
  const logs = [...(options.logs || [])];
  const calls = [];
  const automation = { id: 'automation', name: 'Post compra', trigger: 'POST_PURCHASE', activatedAt: before, delayHours: 0, subject: 'Pedido', bodyText: 'Confirmado', ...options.automation };
  const env = { canSendEmail: true, EMAIL_POST_PURCHASE_SEND_FROM: cutoff, NEXT_PUBLIC_SITE_URL: 'https://example.invalid', ...options.env };
  const prisma = {
    emailAutomation: { findMany: async () => [automation] },
    order: { findMany: async ({ where, take }) => orders.map(o => ({ ...o, emailLogs: logs.filter(l => l.orderId === o.id) })).filter(o => matches(o, where)).slice(0, take) },
    emailSendLog: {
      findFirst: async ({ where }) => logs.filter(l => matches(l, where)).at(-1) || null,
      create: async ({ data }) => {
        if (logs.some(l => l.automationId === data.automationId && l.targetType === data.targetType && l.targetId === data.targetId)) throw new UniqueError();
        const row = { ...data, createdAt: new Date() };
        logs.push(row);
        return row;
      },
      update: async ({ where, data }) => {
        if (options.failSentLog && data.status === 'SENT') throw new Error('DB unavailable after send');
        Object.assign(logs.find(l => l.id === where.id), data);
      },
    },
  };
  const service = load('src/features/email/automation-service.ts', {
    crypto: { randomUUID },
    '@prisma/client': { EmailAutomationTrigger: statuses, EmailSendStatus: statuses, NewsletterSubscriberStatus: statuses, OrderStatus: statuses, PaymentStatus: statuses, Prisma: { PrismaClientKnownRequestError: UniqueError } },
    '@/features/email/provider': { sendEmail: async input => {
      if (automation.trigger === 'POST_PURCHASE') {
        assert.ok(logs.some(l => l.recipientEmail === input.to && l.status === 'SKIPPED'), 'durable reservation before provider');
      }
      calls.push(input);
      if (options.failProvider) throw new Error('Timeout: acceptance unknown');
      return { providerMessageId: 'synthetic-provider-id' };
    } },
    '@/features/email/post-purchase-policy': policy,
    '@/features/email/render': { renderTemplate: s => s, renderMarketingEmail: () => '<p>test</p>' },
    '@/features/email/newsletter-service': { isEmailUnsubscribed: async () => !!options.unsubscribed },
    '@/features/cart-recovery/free-shipping-service': {},
    '@/features/email/system-automations': { WELCOME_POPUP_IMMEDIATE_AUTOMATION_ID: 'popup' },
    '@/lib/db/prisma': { prisma },
    '@/lib/env': { env },
    '@/lib/utils/currency': { formatArs: String },
  });
  return { run: service.processEmailAutomations, logs, calls };
}

test('missing, malformed or impossible cutover blocks all post-purchase sends', async () => {
  for (const value of [undefined, '', 'yesterday', '2026-09-22', '2026-02-30T00:00:00Z']) {
    const h = harness([order('new')], { env: { EMAIL_POST_PURCHASE_SEND_FROM: value } });
    assert.ok((await h.run())[0].blockedReason);
    assert.equal(h.calls.length, 0);
    assert.equal(h.logs.length, 0);
  }
});
test('missing activation or disabled provider does not consume orders', async () => {
  for (const options of [{ automation: { activatedAt: null } }, { env: { canSendEmail: false } }]) {
    const h = harness([order('new')], options);
    assert.ok((await h.run())[0].blockedReason);
    assert.equal(h.logs.length, 0);
  }
});
test('301 previously processed orders do not starve new orders; repeat sends nothing', async () => {
  const orders = Array.from({ length: 302 }, (_, i) => order(`order-${i}`));
  const logs = orders.slice(0, 301).map(o => ({ automationId: 'automation', targetType: 'order', targetId: o.id, orderId: o.id, status: 'SENT' }));
  const h = harness(orders, { logs });
  assert.equal((await h.run())[0].sent, 1);
  assert.equal(h.calls[0].to, 'order-301@example.invalid');
  assert.equal((await h.run())[0].sent, 0);
});
test('batch limit progresses through more than 100 NEW orders', async () => {
  const h = harness(Array.from({ length: 105 }, (_, i) => order(`new-${i}`)));
  assert.equal((await h.run())[0].sent, 100);
  assert.equal((await h.run())[0].sent, 5);
  assert.equal((await h.run())[0].sent, 0);
  assert.equal(h.calls.length, 105);
});
test('historical, cancelled, unpaid and not-yet-due orders never send', async () => {
  const future = new Date(now + 86400000);
  const h = harness([
    order('old', { paidAt: before }),
    order('old-proof', { paidAt: null, paymentProofs: [{ uploadedAt: before }] }),
    order('old-paid-new-proof', { paidAt: before, paymentProofs: [{ uploadedAt: after }] }),
    order('cancelled', { orderStatus: 'CANCELLED' }),
    order('unpaid', { paymentStatus: 'PENDING', paidAt: null }),
    order('later', { paidAt: future }),
    order('newer-proof-later', { paidAt: null, paymentProofs: [{ uploadedAt: after }, { uploadedAt: future }] }),
    order('new-proof', { paidAt: null, paymentProofs: [{ uploadedAt: after }] }),
  ]);
  assert.equal((await h.run())[0].sent, 1);
  assert.equal(h.calls[0].to, 'new-proof@example.invalid');
});
test('later activation and configured delay remain enforced', async () => {
  const h = harness([order('before-reactivation')], { automation: { activatedAt: new Date('2026-09-22T14:00:00Z') } });
  assert.equal((await h.run())[0].sent, 0);
  const delayed = harness([order('waiting', { paidAt: new Date(now) })], { automation: { delayHours: 24 } });
  assert.equal((await delayed.run())[0].sent, 0);
});
test('concurrent cron/admin executions contact provider only once', async () => {
  const h = harness([order('concurrent')]);
  await Promise.all([h.run(), h.run()]);
  assert.equal(h.calls.length, 1);
  assert.equal(h.logs.length, 1);
  assert.equal(h.logs[0].status, 'SENT');
});
test('provider timeout and accepted send with failed local logging never retry', async () => {
  for (const options of [{ failProvider: true }, { failSentLog: true }]) {
    const h = harness([order('ambiguous')], options);
    assert.equal((await h.run())[0].errors, 1);
    assert.equal((await h.run())[0].sent, 0);
    assert.equal(h.calls.length, 1);
    assert.equal(h.logs[0].status, 'ERROR');
    if (options.failSentLog) assert.equal(h.logs[0].providerMessageId, 'synthetic-provider-id');
  }
});

test('ORDER_CREATED retains its behavior without the post-purchase cutover', async () => {
  const h = harness([order('created')], {
    automation: { trigger: 'ORDER_CREATED' },
    env: { EMAIL_POST_PURCHASE_SEND_FROM: undefined },
  });
  assert.equal((await h.run())[0].sent, 1);
  assert.equal((await h.run())[0].sent, 0);
  assert.equal(h.calls.length, 1);
});
test('unsubscribe and existing errors/reservations/retry logs prevent sends', async () => {
  const unsubscribed = harness([order('unsubscribed')], { unsubscribed: true });
  assert.equal((await unsubscribed.run())[0].skipped, 1);
  assert.equal(unsubscribed.calls.length, 0);
  for (const status of ['SENT', 'ERROR', 'SKIPPED']) {
    const h = harness([order('logged')], { logs: [{ automationId: 'automation', orderId: 'logged', targetType: 'order', targetId: 'logged:retry:123', status }] });
    assert.equal((await h.run())[0].sent, 0);
    assert.equal(h.calls.length, 0);
  }
});
