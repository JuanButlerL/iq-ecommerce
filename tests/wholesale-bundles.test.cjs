const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const ts = require('typescript');

function load(file, imports = {}) {
  const exports = {};
  const source = fs.readFileSync(path.join(__dirname, '..', file), 'utf8');
  vm.runInNewContext(ts.transpileModule(source, {
    compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.CommonJS },
  }).outputText, { exports, Error, console, Number, Math, Map, Set, Array, Object, require(name) {
    if (!(name in imports)) throw new Error(`Forbidden import: ${name}`);
    return imports[name];
  } });
  return exports;
}

// Los objetos del módulo vienen de otro contexto de vm: se comparan como datos planos.
const plain = (value) => JSON.parse(JSON.stringify(value));

const zod = require('zod');
const bundles = load('src/features/wholesale/bundles.ts');
const { wholesaleProductSchema } = load('src/lib/validations/wholesale-product.ts', { zod, '@/features/wholesale/bundles': bundles });

const BANANA = '11111111-1111-4111-8111-111111111111';
const CACAO = '22222222-2222-4222-8222-222222222222';
const MANI = '33333333-3333-4333-8333-333333333333';
const MIX = '44444444-4444-4444-8444-444444444444';
const names = {
  [BANANA]: 'Caja Barritas Banana x 12 unidades',
  [CACAO]: 'Caja Barritas Cacao x 12 unidades',
  [MANI]: 'Caja Barritas Mani x 12 unidades',
  [MIX]: 'Caja Mix x 12 unidades',
};
const component = (productId, quantity) => ({ productId, name: names[productId], quantity });
const bultoMix = [component(BANANA, 3), component(CACAO, 3), component(MANI, 3), component(MIX, 1)];

test('nombres cortos y composición legible', () => {
  assert.equal(bundles.shortProductName('Caja Barritas Cacao x 12 unidades'), 'Cacao');
  assert.equal(bundles.shortProductName('Caja Mix x 12 unidades'), 'Mix');
  assert.equal(bundles.shortProductName('Display Banana'), 'Banana');
  assert.equal(bundles.shortProductName('Mix'), 'Mix');
  assert.equal(bundles.describeComposition(bultoMix), '3 Banana · 3 Cacao · 3 Mani · 1 Mix');
});

test('displays por unidad y etiqueta de venta', () => {
  assert.equal(bundles.displaysPerUnit({ kind: 'FIXED', boxDisplays: 10, components: bultoMix }), 10);
  assert.equal(bundles.displaysPerUnit({ kind: 'FIXED', boxDisplays: 10, components: [component(MIX, 10)] }), 10);
  assert.equal(bundles.displaysPerUnit({ kind: 'CUSTOM', boxDisplays: 12, components: [component(BANANA, 0)] }), 12);
  assert.equal(bundles.saleUnitLabel({ kind: 'FIXED', boxDisplays: 10, components: [component(BANANA, 1)] }), 'Display');
  assert.equal(bundles.saleUnitLabel({ kind: 'FIXED', boxDisplays: 10, components: bultoMix }), 'Bulto · 10 displays');
  assert.equal(bundles.saleUnitLabel({ kind: 'CUSTOM', boxDisplays: 10, components: [] }), 'Armá tu caja · 10 displays');
});

test('el nombre del ítem conserva el formato de siempre para un display suelto', () => {
  const product = { name: 'Banana', kind: 'FIXED', unitsPerDisplay: 12 };
  assert.equal(bundles.buildOrderItemName(product, [component(BANANA, 1)]), 'Banana (display x12)');
  assert.equal(
    bundles.buildOrderItemName({ ...product, name: 'Bulto Mix' }, bultoMix),
    'Bulto Mix (10 displays: 3 Banana · 3 Cacao · 3 Mani · 1 Mix)',
  );
});

test('armá tu caja: valida sabores y tamaño de la caja', () => {
  const allowed = [component(BANANA, 0), component(CACAO, 0), component(MANI, 0)];
  const ok = bundles.resolveCustomSelection(
    [{ productId: MANI, quantity: 3 }, { productId: BANANA, quantity: 4 }, { productId: CACAO, quantity: 3 }, { productId: CACAO, quantity: 0 }],
    allowed,
    10,
  );
  assert.equal(ok.ok, true);
  // En el orden del admin y con los nombres de la tienda.
  assert.deepEqual(plain(ok.components.map((c) => [c.productId, c.quantity])), [[BANANA, 4], [CACAO, 3], [MANI, 3]]);

  const short = bundles.resolveCustomSelection([{ productId: BANANA, quantity: 9 }], allowed, 10);
  assert.equal(short.ok, false);
  assert.match(short.error, /10 displays/);

  const notAllowed = bundles.resolveCustomSelection([{ productId: MIX, quantity: 10 }], allowed, 10);
  assert.equal(notAllowed.ok, false);

  // Repetidos se suman.
  const repeated = bundles.resolveCustomSelection([{ productId: BANANA, quantity: 5 }, { productId: BANANA, quantity: 5 }], allowed, 10);
  assert.equal(repeated.ok, true);
  assert.deepEqual(plain(repeated.components.map((c) => c.quantity)), [10]);
});

test('la clave del carrito separa cajas con distinta combinación', () => {
  const a = bundles.buildCartKey('box', [{ productId: BANANA, quantity: 5 }, { productId: CACAO, quantity: 5 }]);
  const b = bundles.buildCartKey('box', [{ productId: CACAO, quantity: 5 }, { productId: BANANA, quantity: 5 }]);
  const c = bundles.buildCartKey('box', [{ productId: BANANA, quantity: 6 }, { productId: CACAO, quantity: 4 }]);
  assert.equal(a, b);
  assert.notEqual(a, c);
  assert.equal(bundles.buildCartKey('display'), 'display');
});

test('el carrito cruza bultos, cajas y displays con lo que está a la venta', () => {
  const products = [
    { id: 'banana', kind: 'FIXED', boxDisplays: 10, priceArs: 10000, soldOut: false, components: [component(BANANA, 1)] },
    { id: 'bulto', kind: 'FIXED', boxDisplays: 10, priceArs: 95000, soldOut: false, components: bultoMix },
    { id: 'caja', kind: 'CUSTOM', boxDisplays: 10, priceArs: 97000, soldOut: false, components: [component(BANANA, 0), component(CACAO, 0)] },
  ];
  const lines = bundles.resolveCartLines(
    [
      { key: 'banana', productId: 'banana', quantity: 3 },
      { key: 'bulto', productId: 'bulto', quantity: 2 },
      { key: 'caja|x', productId: 'caja', quantity: 1, selection: [{ productId: BANANA, quantity: 6 }, { productId: CACAO, quantity: 4 }] },
      { key: 'caja|y', productId: 'caja', quantity: 1, selection: [{ productId: BANANA, quantity: 6 }] },
      { key: 'gone', productId: 'gone', quantity: 1 },
    ],
    products,
  );
  assert.equal(lines.length, 4);
  assert.deepEqual(plain(lines.map((line) => line.displays)), [3, 20, 10, 10]);
  assert.deepEqual(plain(lines.map((line) => line.lineTotalArs)), [30000, 190000, 97000, 97000]);
  assert.equal(lines[2].problem, null);
  // Una caja guardada que ya no cierra no se compra.
  assert.ok(lines[3].problem);
});

test('la sincronización abre el bulto en displays base sin perder un peso', () => {
  const rows = bundles.explodeOrderItem({
    id: 'item-1',
    quantity: 2,
    unitPriceArs: 95000,
    lineTotalArs: 190000,
    productNameSnapshot: 'Bulto Mix (10 displays: 3 Banana · 3 Cacao · 3 Mani · 1 Mix)',
    components: bultoMix,
  });
  assert.deepEqual(plain(rows.map((row) => [row.key, row.productId, row.quantity])), [
    ['item-1-1', BANANA, 6],
    ['item-1-2', CACAO, 6],
    ['item-1-3', MANI, 6],
    ['item-1-4', MIX, 2],
  ]);
  assert.equal(rows[0].unitPrice, 9500);
  assert.equal(rows[0].name, 'Caja Barritas Banana x 12 unidades · Bulto Mix');
  assert.equal(rows.reduce((sum, row) => sum + row.lineTotal, 0), 190000);

  // Precios que no dividen exacto: la suma igual da el total del ítem.
  const odd = bundles.explodeOrderItem({
    id: 'item-2',
    quantity: 1,
    unitPriceArs: 100001,
    lineTotalArs: 100001,
    productNameSnapshot: 'Caja (7 displays: 3 Banana · 4 Cacao)',
    components: [component(BANANA, 3), component(CACAO, 4)],
  });
  assert.equal(Math.round(odd.reduce((sum, row) => sum + row.lineTotal, 0) * 100), 10000100);
  assert.equal(odd[0].unitPrice, 14285.86);
});

test('un display suelto viaja igual que antes de los bultos', () => {
  const rows = bundles.explodeOrderItem({
    id: 'item-3',
    quantity: 4,
    unitPriceArs: 16000,
    lineTotalArs: 64000,
    productNameSnapshot: 'Banana (display x12)',
    components: [component(BANANA, 1)],
  });
  assert.deepEqual(plain(rows), [{ key: 'item-3', productId: BANANA, name: 'Banana (display x12)', quantity: 4, unitPrice: 16000, lineTotal: 64000 }]);
});

test('composición guardada mal formada se ignora', () => {
  assert.equal(bundles.parseComponentsSnapshot(null), null);
  assert.equal(bundles.parseComponentsSnapshot([]), null);
  assert.equal(bundles.parseComponentsSnapshot([{ productId: BANANA, quantity: 0 }]), null);
  assert.equal(bundles.parseComponentsSnapshot([{ productId: BANANA, quantity: 1.5 }]), null);
  assert.deepEqual(plain(bundles.parseComponentsSnapshot([{ productId: BANANA, name: 'B', quantity: 2 }])), [{ productId: BANANA, name: 'B', quantity: 2 }]);
});

test('admin: valida la composición del producto mayorista', () => {
  const base = { name: 'Bulto Mix', description: '', imageUrl: '', imageAlt: '', priceArs: 95000, unitsPerDisplay: 12, active: true, soldOut: false, boxDisplays: 10 };
  const fixed = wholesaleProductSchema.parse({
    ...base,
    kind: 'FIXED',
    components: [{ productId: BANANA, quantity: 3 }, { productId: CACAO, quantity: 0 }, { productId: BANANA, quantity: 5 }],
  });
  // Sin ceros ni repetidos.
  assert.deepEqual(plain(fixed.components), [{ productId: BANANA, quantity: 3 }]);

  const custom = wholesaleProductSchema.parse({ ...base, kind: 'CUSTOM', components: [{ productId: BANANA, quantity: 4 }, { productId: CACAO, quantity: 0 }] });
  assert.deepEqual(plain(custom.components.map((c) => c.quantity)), [0, 0]);

  assert.equal(wholesaleProductSchema.safeParse({ ...base, kind: 'FIXED', components: [] }).success, false);
  assert.equal(wholesaleProductSchema.safeParse({ ...base, kind: 'FIXED', active: false, components: [] }).success, true);
  assert.equal(wholesaleProductSchema.safeParse({ ...base, kind: 'CUSTOM', boxDisplays: 0, components: [{ productId: BANANA, quantity: 0 }] }).success, false);
});
