const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const ts = require('typescript');

function load(file) {
  const exports = {};
  const source = fs.readFileSync(path.join(__dirname, '..', file), 'utf8');
  vm.runInNewContext(ts.transpileModule(source, {
    compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.CommonJS },
  }).outputText, { exports, Date, Math, Map, Set, JSON, Number, String, require(name) { throw new Error(`Forbidden import: ${name}`); } });
  return exports;
}

const { buildNewsletterResults } = load('src/features/newsletter/results.ts');
const d = (value) => new Date(value);
const newsletter = { id: 'n1', slug: 'cyber-dia-1', previousSlugs: ['cyber-borrador'], title: 'Cyber día 1', emailSubject: 'Arrancó el Cyber', startedAt: d('2026-11-02T13:00:00Z') };

function delivery(email, extra = {}) {
  return { recipientEmail: email, sentAt: d('2026-11-02T13:01:00Z'), openCount: 0, firstOpenedAt: null, clickCount: 0, firstClickedAt: null, unsubscribedAt: null, ...extra };
}
let seq = 0;
function order(email, createdAt, extra = {}) {
  seq += 1;
  return { id: `o${seq}`, publicOrderNumber: `IQ-${seq}`, customerEmail: email, customerName: 'Ana Pérez', createdAt: d(createdAt), totalArs: 50000, discountArs: 0, couponCode: null, marketingSessionId: null, marketingVisitorId: null, ...extra };
}

function run({ deliveries, orders, visits = [], history = new Map() }) {
  return buildNewsletterResults({ newsletter, deliveries, orders, visits, previousPurchaseDates: history });
}

test('a recipient who clicked and bought within 7 days counts as a sale, even from another device', () => {
  const result = run({
    deliveries: [delivery('Ana@Mail.com', { openCount: 2, firstOpenedAt: d('2026-11-02T14:00:00Z'), clickCount: 1, firstClickedAt: d('2026-11-02T14:05:00Z') })],
    orders: [order('ana@mail.com', '2026-11-04T10:00:00Z', { couponCode: 'cyber20', discountArs: 10000 })],
  });
  const [person] = result.people;
  assert.equal(person.status, 'BOUGHT');
  assert.deepEqual([...person.orders[0].via], ['click']);
  assert.equal(person.orders[0].newCustomer, true);
  assert.equal(result.summary.buyers, 1);
  assert.equal(result.summary.revenueArs, 50000);
  assert.equal(result.summary.coupons[0].code, 'CYBER20');
});

test('a purchase after the 7-day window does not count', () => {
  const result = run({
    deliveries: [delivery('ana@mail.com', { firstOpenedAt: d('2026-11-02T14:00:00Z'), firstClickedAt: d('2026-11-02T14:05:00Z'), clickCount: 1 })],
    orders: [order('ana@mail.com', '2026-11-10T10:00:00Z')],
  });
  assert.equal(result.people[0].status, 'CLICKED');
  assert.equal(result.summary.orders, 0);
});

test('opened without click and bought is shown apart and not counted as a sale', () => {
  const result = run({
    deliveries: [delivery('ana@mail.com', { openCount: 1, firstOpenedAt: d('2026-11-02T14:00:00Z') })],
    orders: [order('ana@mail.com', '2026-11-03T10:00:00Z')],
  });
  assert.equal(result.people[0].status, 'BOUGHT_AFTER_OPEN');
  assert.equal(result.summary.boughtAfterOpen, 1);
  assert.equal(result.summary.orders, 0);
  assert.equal(result.summary.revenueArs, 0);
});

test('a buyer who did not receive the email but came through its link counts as forwarded', () => {
  const result = run({
    deliveries: [delivery('ana@mail.com')],
    visits: [{ id: 's1', visitorId: 'v1', email: null, firstSeenAt: d('2026-11-02T15:00:00Z') }],
    orders: [order('beto@mail.com', '2026-11-02T15:30:00Z', { marketingSessionId: 's1' }), order('caro@mail.com', '2026-11-02T16:00:00Z')],
  });
  const forwarded = result.people.find((person) => person.email === 'beto@mail.com');
  assert.equal(forwarded.status, 'FORWARDED_BUYER');
  assert.equal(forwarded.received, false);
  assert.equal(result.people.some((person) => person.email === 'caro@mail.com'), false);
  assert.equal(result.summary.orders, 1);
  assert.equal(result.summary.sent, 1);
});

test('repeat customers, rates and unsubscribes', () => {
  const history = new Map([['ana@mail.com', [d('2026-09-01T10:00:00Z')]]]);
  const result = run({
    history,
    deliveries: [
      delivery('ana@mail.com', { firstOpenedAt: d('2026-11-02T14:00:00Z'), firstClickedAt: d('2026-11-02T14:05:00Z'), clickCount: 1 }),
      delivery('beto@mail.com', { firstOpenedAt: d('2026-11-02T14:00:00Z') }),
      delivery('caro@mail.com', { unsubscribedAt: d('2026-11-03T10:00:00Z') }),
      delivery('dani@mail.com'),
    ],
    orders: [order('ana@mail.com', '2026-11-02T20:05:00Z'), order('ana@mail.com', '2026-10-30T10:00:00Z')],
  });
  assert.equal(result.summary.sent, 4);
  assert.equal(result.summary.openRate, 0.5);
  assert.equal(result.summary.clickRate, 0.25);
  assert.equal(result.summary.conversionRate, 0.25);
  assert.equal(result.summary.newCustomers, 0);
  assert.equal(result.summary.unsubscribed, 1);
  assert.equal(result.summary.medianHoursToBuy, 6);
  assert.equal(result.summary.revenuePerEmailArs, 12500);
  assert.deepEqual([...result.people.map((person) => person.status)], ['BOUGHT', 'OPENED', 'NOT_OPENED', 'NOT_OPENED']);
});
