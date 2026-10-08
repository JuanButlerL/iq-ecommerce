const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const ts = require('typescript');

const exportsObj = {};
const source = fs.readFileSync(path.join(__dirname, '..', 'src/features/cart/lib/preset-cart.ts'), 'utf8');
vm.runInNewContext(ts.transpileModule(source, { compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.CommonJS } }).outputText, { exports: exportsObj, Number, Math, Map, Array });
const { parsePresetCart } = exportsObj;

const products = [
  { id: 'p-mani', slug: 'caja-barritas-mani-x-12', active: true, visible: true, manualSoldOut: false },
  { id: 'p-cacao', slug: 'caja-barritas-cacao-x-12', active: true, visible: true, manualSoldOut: false },
  { id: 'p-banana', slug: 'caja-barritas-banana-x-12', active: true, visible: true, manualSoldOut: false },
  { id: 'p-hidden', slug: 'oculto', active: true, visible: false, manualSoldOut: false },
  { id: 'p-soldout', slug: 'agotado', active: true, visible: true, manualSoldOut: true },
];
const plain = value => JSON.parse(JSON.stringify(value));

test('three products, one unit each', () => {
  assert.deepEqual(plain(parsePresetCart('caja-barritas-mani-x-12,caja-barritas-cacao-x-12,caja-barritas-banana-x-12', products)), [
    { productId: 'p-mani', quantity: 1 }, { productId: 'p-cacao', quantity: 1 }, { productId: 'p-banana', quantity: 1 },
  ]);
});

test('quantities, duplicates merged, case and spaces tolerated', () => {
  assert.deepEqual(plain(parsePresetCart(' CAJA-BARRITAS-MANI-X-12:2 , caja-barritas-mani-x-12:1', products)), [{ productId: 'p-mani', quantity: 3 }]);
});

test('unknown, hidden and sold-out products are ignored; quantities are clamped', () => {
  assert.deepEqual(plain(parsePresetCart('no-existe,oculto,agotado,caja-barritas-cacao-x-12:999,caja-barritas-banana-x-12:-4', products)), [
    { productId: 'p-cacao', quantity: 20 }, { productId: 'p-banana', quantity: 1 },
  ]);
  assert.deepEqual(plain(parsePresetCart('', products)), []);
  assert.deepEqual(plain(parsePresetCart(undefined, products)), []);
});
