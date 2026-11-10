const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const ts = require('typescript');

function load(file, imports = {}, globals = {}) {
  const exports = {};
  const source = fs.readFileSync(path.join(__dirname, '..', file), 'utf8');
  vm.runInNewContext(ts.transpileModule(source, {
    compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.CommonJS },
  }).outputText, { exports, Error, console, Math, Number, ...globals, require(name) {
    if (!(name in imports)) throw new Error(`Forbidden import: ${name}`);
    return imports[name];
  } });
  return exports;
}

const events = load('src/lib/wholesale-meta-events.ts');
const eventIds = load('src/lib/meta-event-id.ts');

function loadTracking() {
  const calls = [];
  const window = { fbq: (...args) => calls.push(args) };
  const pixel = load('src/lib/pixel.ts', {}, { window, process: { env: { NEXT_PUBLIC_FB_PIXEL_ID: '123456' } } });
  const tracking = load('src/lib/integrations/wholesale-commerce-tracking.ts', {
    '@/lib/pixel': pixel,
    '@/lib/wholesale-meta-events': events,
  });
  return { calls, pixel, tracking };
}

test('los eventos mayoristas son propios: no pisan los estándar de la tienda', () => {
  const standard = ['ViewContent', 'AddToCart', 'InitiateCheckout', 'Purchase'];
  for (const name of Object.values(events.WHOLESALE_META_EVENTS)) {
    assert.ok(!standard.includes(name), name);
    assert.match(name, /Mayorista$/);
  }
});

test('agregar al carrito mayorista manda trackCustom con el canal, no el AddToCart estándar', () => {
  const { calls, tracking } = loadTracking();
  tracking.trackWholesaleAddToCart({ productId: 'p1', productName: 'Cacao', priceArs: 16000, quantity: 2 });

  assert.equal(calls.length, 1);
  const [method, name, params] = calls[0];
  assert.equal(method, 'trackCustom');
  assert.equal(name, 'AddToCartMayorista');
  assert.equal(params.value, 32000);
  assert.equal(params.num_items, 2);
  assert.equal(params.channel, 'mayorista');
  assert.deepEqual(JSON.parse(JSON.stringify(params.content_ids)), ['p1']);
});

test('el evento estándar de la tienda sigue saliendo con track', () => {
  const { calls, pixel } = loadTracking();
  pixel.event('Purchase', { value: 1 });
  assert.equal(calls[0][0], 'track');
});

test('la compra mayorista usa un id propio para deduplicar navegador y servidor', () => {
  assert.equal(eventIds.buildWholesaleMetaPurchaseEventId('26111000'), 'purchase-mayorista:26111000');
  assert.notEqual(eventIds.buildWholesaleMetaPurchaseEventId('26111000'), eventIds.buildMetaPurchaseEventId('26111000'));
});
