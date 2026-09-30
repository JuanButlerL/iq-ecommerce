const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const ts = require('typescript');
const { randomUUID } = require('node:crypto');

// Execute the real modules with ALL imports replaced. No env files, network,
// Prisma client or email provider can be loaded by these tests.
const NOW_MS = Date.parse('2026-10-01T12:00:00Z');
class FixedDate extends Date {
  constructor(...args) { super(...(args.length ? args : [NOW_MS])); }
  static now() { return NOW_MS; }
}

function load(file, imports = {}) {
  const exports = {};
  const source = fs.readFileSync(path.join(__dirname, '..', file), 'utf8');
  vm.runInNewContext(ts.transpileModule(source, {
    compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.CommonJS },
  }).outputText, { exports, Date: FixedDate, Math, Error, console, URL, Intl, setTimeout: fn => fn(), require(name) {
    if (!(name in imports)) throw new Error(`Forbidden import: ${name}`);
    return imports[name];
  } });
  return exports;
}

const content = load('src/features/newsletter/content.ts');
const render = load('src/features/newsletter/render-email.ts', { '@/features/newsletter/content': content });
const validations = load('src/lib/validations/newsletter.ts', { zod: require('zod'), '@/features/newsletter/content': content });
const enums = Object.fromEntries(['DRAFT', 'SCHEDULED', 'SENDING', 'PAUSED', 'SENT', 'NEEDS_REVIEW', 'PENDING', 'RESERVED', 'SKIPPED', 'ERROR', 'SUBSCRIBED', 'UNSUBSCRIBED'].map(s => [s, s]));

const NOW = new Date('2026-10-01T12:00:00Z');
const SITE = 'https://iqkids.example';

function matches(row, where) {
  return Object.entries(where).every(([key, value]) => {
    if (key === 'OR') return value.some(clause => matches(row, clause));
    if (key === 'AND') return value.every(clause => matches(row, clause));
    const actual = row[key];
    if (value === null || typeof value !== 'object' || value instanceof Date) {
      return actual instanceof Date && value instanceof Date ? actual.getTime() === value.getTime() : actual === value;
    }
    return Object.entries(value).every(([op, operand]) => {
      switch (op) {
        case 'in': return operand.includes(actual);
        case 'not': return operand === null ? actual !== null && actual !== undefined : actual !== operand;
        case 'gte': return actual != null && actual >= operand;
        case 'lte': return actual != null && actual <= operand;
        case 'none': return !actual.some(item => matches(item, operand));
        default: throw new Error(`Unsupported predicate ${op}`);
      }
    });
  });
}

function newsletterRow(extra = {}) {
  const base = {
    id: 'nl-1', slug: 'edicion-octubre', title: 'Edición de octubre', subtitle: null, excerpt: 'Ideas para la vianda de octubre.',
    coverImageUrl: '/uploads/newsletters/cover.jpg', coverImageAlt: 'Portada', emailSubject: 'Ideas para octubre', emailPreviewText: 'Tres ideas simples para la vianda',
    blocks: [{ id: 'b1', type: 'paragraph', text: 'Hola! Mirá [las barritas](/productos).' }, { id: 'b2', type: 'button', label: 'Comprar', url: 'https://iqkids.example/productos' }],
    status: 'SCHEDULED', webVisible: true, publishedAt: null, scheduledAt: new Date(NOW.getTime() - 60_000), approvedAt: new Date(NOW.getTime() - 3_600_000),
    approvedBy: 'admin@iqkids.example', approvedRecipientCount: 3, contentHash: 'hash-1', lastTestContentHash: 'hash-1', contentLockedAt: null,
    emailSnapshot: null, currentWave: 0, reviewReason: null, sendingStartedAt: null, sentAt: null, archivedAt: null,
  };
  return { ...base, ...extra };
}

function harness(options = {}) {
  const db = {
    newsletters: (options.newsletters ?? [newsletterRow()]).map(row => ({ ...row })),
    subscribers: (options.subscribers ?? ['ana@example.invalid', 'beto@example.invalid', 'caro@example.invalid']).map((email, index) => ({ id: `sub-${index}`, email, status: 'SUBSCRIBED', consentedAt: new Date(2026, 0, index + 1) })),
    deliveries: [...(options.deliveries ?? [])],
    audit: [],
    automationSentToday: options.automationSentToday ?? 0,
  };
  const calls = [];
  const settings = { newsletterSenderName: 'IQ Kids', newsletterFromEmail: 'no-reply@iqkids.example', newsletterReplyToEmail: null, newsletterTestRecipients: options.testRecipients ?? ['equipo@iqkids.example'], newsletterDailyLimit: options.dailyLimit ?? 80 };
  const env = { newsletterSendingEnabled: true, canSendEmail: true, isProduction: true, NEWSLETTER_BATCH_SIZE: 40, NEWSLETTER_LATE_MARGIN_HOURS: 12, NEXT_PUBLIC_SITE_URL: SITE, EMAIL_FROM_DEFAULT: 'no-reply@iqkids.example', ...options.env };
  const subscribersWithDeliveries = () => db.subscribers.map(s => ({ ...s, deliveries: db.deliveries.filter(d => d.subscriberId === s.id) }));
  const applyUpdate = (rows, where, data) => {
    const targets = rows.filter(row => matches(row, where));
    targets.forEach(row => Object.assign(row, data));
    return { count: targets.length };
  };

  const prisma = {
    storeSettings: { findUnique: async () => settings },
    newsletter: {
      findMany: async ({ where, take }) => db.newsletters.filter(n => matches(n, where)).slice(0, take ?? Infinity).map(n => ({ ...n })),
      findUnique: async ({ where }) => { const n = db.newsletters.find(row => row.id === where.id); return n ? { ...n } : null; },
      updateMany: async ({ where, data }) => applyUpdate(db.newsletters, where, data),
    },
    newsletterSubscriber: {
      findMany: async ({ where }) => subscribersWithDeliveries().filter(s => matches(s, where)).map(({ id, email }) => ({ id, email })),
      count: async ({ where }) => subscribersWithDeliveries().filter(s => matches(s, where)).length,
    },
    newsletterDelivery: {
      createMany: async ({ data, skipDuplicates }) => {
        let count = 0;
        for (const row of data) {
          if (db.deliveries.some(d => d.newsletterId === row.newsletterId && d.recipientEmail === row.recipientEmail)) {
            if (!skipDuplicates) throw new Error('unique violation');
            continue;
          }
          db.deliveries.push({ id: randomUUID(), createdAt: new Date(), reservedAt: null, sentAt: null, ...row });
          count += 1;
        }
        return { count };
      },
      findMany: async ({ where, take }) => db.deliveries.filter(d => matches(d, where)).slice(0, take ?? Infinity).map(d => ({ ...d })),
      updateMany: async ({ where, data }) => applyUpdate(db.deliveries, where, data),
      update: async ({ where, data }) => {
        if (options.failSentWrite && data.status === 'SENT') throw new Error('DB unavailable after send');
        Object.assign(db.deliveries.find(d => d.id === where.id), data);
      },
      count: async ({ where }) => db.deliveries.filter(d => matches(d, where)).length,
    },
    emailSendLog: { count: async () => db.automationSentToday },
    newsletterAuditEvent: { create: async ({ data }) => db.audit.push(data) },
    $transaction: async fn => fn(prisma),
  };

  const buildSnapshot = async row => render.buildNewsletterEmailSnapshot({
    content: { slug: row.slug, title: row.title, subtitle: row.subtitle, excerpt: row.excerpt, coverImageUrl: row.coverImageUrl, coverImageAlt: row.coverImageAlt, blocks: row.blocks, emailSubject: row.emailSubject, emailPreviewText: row.emailPreviewText },
    products: {}, siteUrl: SITE, webUrl: `${SITE}/newsletter/${row.slug}`,
  });

  const service = load('src/features/newsletter/send-service.ts', {
    'node:crypto': { randomUUID },
    '@prisma/client': { EmailSendStatus: enums, NewsletterDeliveryStatus: enums, NewsletterStatus: enums, NewsletterSubscriberStatus: enums, Prisma: {} },
    '@/features/email/newsletter-service': { isEmailUnsubscribed: async (_db, email) => (options.unsubscribed ?? []).includes(email) },
    '@/features/email/provider': { sendEmail: async input => {
      const delivery = db.deliveries.find(d => d.recipientEmail === input.to && d.newsletterId === 'nl-1');
      if (delivery && !input.subject.startsWith('[PRUEBA]')) assert.equal(delivery.status, 'RESERVED', 'row reserved before contacting provider');
      calls.push(input);
      if (options.onSend) await options.onSend(input, db);
      if ((options.failProviderFor ?? []).includes(input.to)) throw new Error('Provider rejected');
      return { providerMessageId: `msg-${calls.length}` };
    } },
    '@/features/newsletter/audit': { recordNewsletterAudit: async (_db, event) => db.audit.push(event) },
    '@/features/newsletter/render-email': render,
    '@/features/newsletter/server-content': { buildSnapshotForNewsletter: buildSnapshot },
    '@/lib/db/prisma': { prisma },
    '@/lib/env': { env },
    '@/lib/errors/app-error': { AppError: class AppError extends Error {} },
  });

  return { db, calls, run: () => service.processNewsletterQueue({ now: NOW }), sendTest: () => service.sendNewsletterTest('nl-1', 'admin@iqkids.example') };
}

test('server switch off: nothing is created or sent', async () => {
  const h = harness({ env: { newsletterSendingEnabled: false } });
  const result = await h.run();
  assert.equal(result.enabled, false);
  assert.equal(h.calls.length, 0);
  assert.equal(h.db.deliveries.length, 0);
  assert.equal(h.db.newsletters[0].status, 'SCHEDULED');
});

test('drafts, unapproved, paused, archived or future newsletters never send', async () => {
  const cases = [
    { status: 'DRAFT' },
    { approvedAt: null },
    { status: 'PAUSED' },
    { archivedAt: new Date(NOW.getTime() - 1000) },
    { scheduledAt: new Date(NOW.getTime() + 60_000) },
  ];
  for (const extra of cases) {
    const h = harness({ newsletters: [newsletterRow(extra)] });
    await h.run();
    assert.equal(h.calls.length, 0, JSON.stringify(extra));
    assert.equal(h.db.deliveries.length, 0, JSON.stringify(extra));
  }
});

test('a schedule missed by more than the margin goes to review without sending', async () => {
  const h = harness({ newsletters: [newsletterRow({ scheduledAt: new Date(NOW.getTime() - 13 * 3_600_000) })] });
  const result = await h.run();
  assert.equal(h.db.newsletters[0].status, 'NEEDS_REVIEW');
  assert.equal(h.db.newsletters[0].reviewReason, 'late');
  assert.deepEqual([...result.review.map(r => r.reason)], ['late']);
  assert.equal(h.calls.length, 0);
  assert.equal(h.db.deliveries.length, 0);
});

test('an audience that grew beyond the approval goes to review without sending', async () => {
  const subscribers = Array.from({ length: 20 }, (_, i) => `s${i}@example.invalid`);
  const h = harness({ subscribers, newsletters: [newsletterRow({ approvedRecipientCount: 3 })] });
  await h.run();
  assert.equal(h.db.newsletters[0].status, 'NEEDS_REVIEW');
  assert.equal(h.db.newsletters[0].reviewReason, 'audience_grew');
  assert.equal(h.calls.length, 0);
});

test('happy path: one tracked email per subscriber, then SENT; a second run sends nothing', async () => {
  const h = harness();
  const result = await h.run();
  assert.equal(result.sent, 3);
  assert.equal(h.calls.length, 3);
  assert.deepEqual(h.calls.map(c => c.to).sort(), ['ana@example.invalid', 'beto@example.invalid', 'caro@example.invalid']);
  assert.ok(h.db.deliveries.every(d => d.status === 'SENT' && d.wave === 1));
  assert.equal(h.db.newsletters[0].status, 'SENT');
  assert.ok(h.db.newsletters[0].emailSnapshot, 'content frozen at dispatch');

  const [first] = h.calls;
  const delivery = h.db.deliveries.find(d => d.recipientEmail === first.to);
  assert.match(first.headers['List-Unsubscribe'], new RegExp(`/api/newsletter/unsubscribe/${delivery.unsubscribeToken}`));
  assert.equal(first.headers['List-Unsubscribe-Post'], 'List-Unsubscribe=One-Click');
  assert.ok(first.html.includes(`/api/newsletter/click/${delivery.clickToken}?l=`), 'links are tracked per recipient');
  assert.ok(first.html.includes(`/api/newsletter/open/${delivery.openToken}`), 'open pixel per recipient');
  assert.ok(!first.html.includes('{{'), 'no placeholders left');
  assert.ok(h.db.newsletters[0].emailSnapshot.links.some(link => link.includes('utm_source=newsletter')), 'own links carry UTM');

  await h.run();
  assert.equal(h.calls.length, 3, 'nothing is sent twice');
});

test('two concurrent cron runs never email the same person twice', async () => {
  const h = harness();
  await Promise.all([h.run(), h.run(), h.run()]);
  const recipients = h.calls.map(c => c.to);
  assert.equal(recipients.length, 3);
  assert.equal(new Set(recipients).size, 3);
  assert.equal(h.db.deliveries.length, 3);
});

test('complementary send reaches only people without a delivery for that newsletter', async () => {
  const h = harness();
  await h.run();
  h.db.subscribers.push({ id: 'sub-new', email: 'nueva@example.invalid', status: 'SUBSCRIBED', consentedAt: NOW });
  Object.assign(h.db.newsletters[0], { status: 'SCHEDULED', scheduledAt: new Date(NOW.getTime() - 1000), approvedAt: NOW, approvedRecipientCount: 1 });
  await h.run();
  assert.equal(h.calls.length, 4);
  assert.equal(h.calls[3].to, 'nueva@example.invalid');
  assert.equal(h.db.deliveries.find(d => d.recipientEmail === 'nueva@example.invalid').wave, 2);
  assert.equal(h.db.newsletters[0].status, 'SENT');
});

test('complementary send with nobody new goes to review instead of sending', async () => {
  const h = harness();
  await h.run();
  Object.assign(h.db.newsletters[0], { status: 'SCHEDULED', scheduledAt: new Date(NOW.getTime() - 1000), approvedAt: NOW, approvedRecipientCount: 0 });
  await h.run();
  assert.equal(h.calls.length, 3);
  assert.equal(h.db.newsletters[0].status, 'NEEDS_REVIEW');
  assert.equal(h.db.newsletters[0].reviewReason, 'no_recipients');
});

test('people who unsubscribed before their turn are skipped, not emailed', async () => {
  const h = harness({ unsubscribed: ['beto@example.invalid'] });
  await h.run();
  assert.deepEqual(h.calls.map(c => c.to).sort(), ['ana@example.invalid', 'caro@example.invalid']);
  const beto = h.db.deliveries.find(d => d.recipientEmail === 'beto@example.invalid');
  assert.equal(beto.status, 'SKIPPED');
  assert.equal(beto.skipReason, 'unsubscribed');
});

test('provider errors stay in ERROR and are never retried automatically', async () => {
  const h = harness({ failProviderFor: ['beto@example.invalid'] });
  await h.run();
  const beto = h.db.deliveries.find(d => d.recipientEmail === 'beto@example.invalid');
  assert.equal(beto.status, 'ERROR');
  assert.match(beto.errorMessage, /Provider rejected/);
  await h.run();
  assert.equal(h.calls.filter(c => c.to === 'beto@example.invalid').length, 1);
});

test('accepted by the provider but not recorded stays RESERVED for manual reconciliation', async () => {
  const h = harness({ failSentWrite: true, subscribers: ['ana@example.invalid'], newsletters: [newsletterRow({ approvedRecipientCount: 1 })] });
  const result = await h.run();
  assert.equal(result.errors, 1);
  assert.equal(h.db.deliveries[0].status, 'RESERVED');
  await h.run();
  assert.equal(h.calls.length, 1, 'a RESERVED row is never sent again');
});

test('outside production only the test inboxes receive real sends', async () => {
  const h = harness({ env: { isProduction: false }, subscribers: ['equipo@iqkids.example', 'cliente@example.invalid'], newsletters: [newsletterRow({ approvedRecipientCount: 2 })] });
  await h.run();
  assert.deepEqual(h.calls.map(c => c.to), ['equipo@iqkids.example']);
  const customer = h.db.deliveries.find(d => d.recipientEmail === 'cliente@example.invalid');
  assert.equal(customer.status, 'SKIPPED');
  assert.equal(customer.skipReason, 'non_production');
});

test('the daily limit (shared with automations) caps each run', async () => {
  const h = harness({ dailyLimit: 3, automationSentToday: 2 });
  const result = await h.run();
  assert.equal(h.calls.length, 1);
  assert.equal(h.db.deliveries.filter(d => d.status === 'PENDING').length, 2);
  assert.equal(h.db.newsletters[0].status, 'SENDING');
  const second = await h.run();
  assert.equal(second.stoppedByDailyLimit, true);
  assert.equal(h.calls.length, 1);
  assert.equal(result.sent, 1);
});

test('pausing from admin stops the batch before the next email', async () => {
  const h = harness({ onSend: async (_input, db) => { db.newsletters[0].status = 'PAUSED'; } });
  await h.run();
  assert.equal(h.calls.length, 1);
  assert.equal(h.db.deliveries.filter(d => d.status === 'PENDING').length, 2);
  assert.equal(h.db.newsletters[0].status, 'PAUSED');
});

test('test sends go only to the test inboxes and never create deliveries', async () => {
  const h = harness({ newsletters: [newsletterRow({ status: 'DRAFT', approvedAt: null, lastTestContentHash: null })] });
  const result = await h.sendTest();
  assert.deepEqual([...result.recipients], ['equipo@iqkids.example']);
  assert.equal(h.calls.length, 1);
  assert.match(h.calls[0].subject, /^\[PRUEBA\] /);
  assert.equal(h.db.deliveries.length, 0);
  assert.equal(h.db.newsletters[0].lastTestContentHash, 'hash-1');
});

test('block validation rejects HTML and dangerous links', () => {
  const { newsletterBlockSchema } = validations;
  assert.equal(newsletterBlockSchema.safeParse({ id: 'x', type: 'paragraph', text: 'Hola <script>alert(1)</script>' }).success, false);
  assert.equal(newsletterBlockSchema.safeParse({ id: 'x', type: 'button', label: 'Ir', url: 'javascript:alert(1)' }).success, false);
  assert.equal(newsletterBlockSchema.safeParse({ id: 'x', type: 'button', label: 'Ir', url: '//evil.example' }).success, false);
  assert.equal(newsletterBlockSchema.safeParse({ id: 'x', type: 'image', url: 'data:image/png;base64,AAAA', alt: 'Foto' }).success, false);
  assert.equal(newsletterBlockSchema.safeParse({ id: 'x', type: 'image', url: '/uploads/newsletters/a.jpg', alt: '' }).success, false, 'alt required');
  assert.equal(newsletterBlockSchema.safeParse({ id: 'x', type: 'button', label: 'Ver', url: '/productos' }).success, true);
  assert.equal(newsletterBlockSchema.safeParse({ id: 'x', type: 'paragraph', text: 'Texto con **negrita** y [link](https://iqkids.example)' }).success, true);
});

test('inline links with unsafe URLs render as plain text and UTMs only touch our domain', () => {
  const tokens = content.parseInline('Mirá [esto](javascript:alert(1)) y [aquello](https://iqkids.example/productos)');
  assert.deepEqual([...tokens.filter(t => t.type === 'link').map(t => t.url)], ['https://iqkids.example/productos']);
  assert.match(content.withNewsletterUtm('/productos', SITE, 'octubre'), /utm_source=newsletter&utm_medium=email&utm_campaign=octubre/);
  assert.equal(content.withNewsletterUtm('https://instagram.com/iqkids', SITE, 'octubre'), 'https://instagram.com/iqkids');
});

test('the email escapes user text', () => {
  const snapshot = render.buildNewsletterEmailSnapshot({
    content: { slug: 's', title: '<b>Hola</b>', excerpt: 'Resumen de prueba', blocks: [{ id: '1', type: 'quote', text: '"><img src=x onerror=alert(1)>' }], emailSubject: 'Asunto' },
    products: {}, siteUrl: SITE, webUrl: null,
  });
  assert.ok(!snapshot.html.includes('<b>Hola</b>'));
  assert.ok(!snapshot.html.includes('<img src=x'));
});

test('a test send only counts for the exact content that was tested', () => {
  const draft = { slug: 's', title: 'Título', excerpt: 'Resumen suficientemente largo', coverImageUrl: '/uploads/a.jpg', coverImageAlt: 'Portada', blocks: [{ id: '1', type: 'paragraph', text: 'Hola' }], emailSubject: 'Asunto', emailPreviewText: 'Vista previa del mail' };
  const tested = content.computeNewsletterContentHash(draft);
  const ready = content.getNewsletterChecklist(draft, { contentHash: tested, lastTestContentHash: tested, testRecipientsCount: 1 });
  assert.ok(ready.every(item => item.ok));
  const edited = { ...draft, blocks: [{ id: '1', type: 'paragraph', text: 'Hola, cambié algo' }] };
  const afterEdit = content.getNewsletterChecklist(edited, { contentHash: content.computeNewsletterContentHash(edited), lastTestContentHash: tested, testRecipientsCount: 1 });
  assert.equal(afterEdit.find(item => item.id === 'test').ok, false);
});

test('editorial blocks validate and render safely in the email', () => {
  const { newsletterBlockSchema } = validations;
  const blocks = [
    { id: 's', type: 'stats', tone: 'cyan', items: [{ value: '35%', label: 'de las calorías vienen de ultraprocesados' }, { value: '+8.000', label: 'aditivos aprobados' }] },
    { id: 'p', type: 'steps', tone: 'pink', items: [{ title: 'Ingredientes que reconocés', text: 'Sin **jarabes**.', marker: 'number' }, { title: 'Negociar', text: '', marker: 'cross' }] },
    { id: 't', type: 'testimonial', quote: 'La prefiere antes que una dona.', author: 'Flor', detail: 'Mamá de Emma, 3 años' },
    { id: 'f', type: 'sources', label: 'Fuentes', text: 'UNICEF Argentina (2024).' },
    { id: 'q', type: 'quote', text: 'La alimentación es un pilar.', author: 'Carina Castro Fumero', role: 'Neuropsicóloga Pediátrica', tone: 'cyan' },
    { id: 'b', type: 'button', label: 'Ver productos', url: '/productos', note: 'Caja Mix · 12 barritas', tone: 'cyan' },
    { id: 'h', type: 'tip', tone: 'pink', text: 'Sin título también vale.' },
  ];
  for (const block of blocks) assert.equal(newsletterBlockSchema.safeParse(block).success, true, block.type);
  assert.equal(newsletterBlockSchema.safeParse({ id: 'x', type: 'stats', tone: 'cyan', items: [] }).success, false, 'stats need items');
  assert.equal(newsletterBlockSchema.safeParse({ id: 'x', type: 'steps', tone: 'pink', items: [{ title: 'Paso <b>1</b>', text: '', marker: 'number' }] }).success, false, 'no HTML in steps');
  assert.equal(newsletterBlockSchema.safeParse({ id: 'x', type: 'testimonial', quote: 'Hola', author: 'Ana', imageUrl: 'javascript:alert(1)' }).success, false, 'unsafe testimonial photo');

  const snapshot = render.buildNewsletterEmailSnapshot({
    content: { slug: 's', title: 'Título', excerpt: 'Resumen de prueba', category: 'Nutrición e infancia', headerTag: 'Lo que vale la pena saber', blocks, emailSubject: 'Asunto' },
    products: {}, siteUrl: SITE, webUrl: null,
  });
  for (const text of ['35%', 'Ingredientes que reconocés', 'Flor', 'Mamá de Emma, 3 años', 'UNICEF Argentina', 'Neuropsicóloga Pediátrica', 'Caja Mix · 12 barritas', 'Nutrición e infancia', 'Lo que vale la pena saber']) {
    assert.ok(snapshot.html.includes(text), text);
  }
  assert.ok(snapshot.html.includes('<strong>jarabes</strong>'), 'inline formatting inside steps');
  assert.ok(snapshot.text.includes('35%: de las calorías'), 'plain text version includes stats');
});

test('category and header tag are part of the tested content', () => {
  const base = { slug: 's', title: 'T', excerpt: 'Resumen suficiente', blocks: [], emailSubject: 'A' };
  assert.notEqual(content.computeNewsletterContentHash(base), content.computeNewsletterContentHash({ ...base, category: 'Nutrición' }));
  assert.notEqual(content.computeNewsletterContentHash(base), content.computeNewsletterContentHash({ ...base, headerTag: 'Para celebrar' }));
});

test('three consecutive provider errors pause the newsletter instead of burning the list', async () => {
  const subscribers = Array.from({ length: 8 }, (_, i) => `p${i}@example.invalid`);
  const h = harness({ subscribers, newsletters: [newsletterRow({ approvedRecipientCount: 8 })], failProviderFor: subscribers });
  await h.run();
  assert.equal(h.calls.length, 3, 'stops after 3 consecutive failures');
  assert.equal(h.db.newsletters[0].status, 'PAUSED');
  assert.equal(h.db.newsletters[0].reviewReason, 'provider_errors');
  assert.equal(h.db.deliveries.filter(d => d.status === 'PENDING').length, 5, 'the rest stays pending, untouched');
  await h.run();
  assert.equal(h.calls.length, 3, 'a paused newsletter sends nothing on the next run');
});

test('schedule payload: send now needs no client date, a date must be a valid instant', () => {
  const { newsletterScheduleSchema } = validations;
  assert.equal(newsletterScheduleSchema.safeParse({ sendNow: true, confirmation: 'ENVIAR' }).success, true);
  assert.equal(newsletterScheduleSchema.safeParse({ scheduledAt: '2026-10-01T12:00:00.000Z', confirmation: 'ENVIAR' }).success, true);
  assert.equal(newsletterScheduleSchema.safeParse({ confirmation: 'ENVIAR' }).success, false, 'date or send now required');
  assert.equal(newsletterScheduleSchema.safeParse({ sendNow: true, confirmation: 'enviar ya' }).success, false, 'exact confirmation word');
});

test('Buenos Aires wall time converts to the right instant and back', () => {
  const labels = load('src/features/newsletter/components/newsletter-admin-labels.ts');
  assert.equal(labels.argentinaLocalInputToIso('2026-10-01T09:00'), '2026-10-01T12:00:00.000Z');
  assert.equal(labels.argentinaLocalInputToIso('2026-12-31T23:30'), '2027-01-01T02:30:00.000Z', 'crosses midnight and year');
  assert.equal(labels.isoToArgentinaLocalInput('2026-10-01T12:00:00.000Z'), '2026-10-01T09:00');
  assert.equal(labels.argentinaLocalInputToIso('no-es-fecha'), null);
  assert.match(labels.formatArgentinaLongDateTime('2026-10-01T12:00:00.000Z'), /1 de octubre de 2026.*09:00/);
});
