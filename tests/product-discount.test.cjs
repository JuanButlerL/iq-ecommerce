const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const ts = require('typescript');

const exportsObj = {};
const source = fs.readFileSync(path.join(__dirname, '..', 'src/features/catalog/lib/product-discount.ts'), 'utf8');
vm.runInNewContext(ts.transpileModule(source, { compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.CommonJS } }).outputText, { exports: exportsObj, Math, Date });
const { applyProductDiscount, getCouponEligibleSubtotal, getProductDiscountStatus } = exportsObj;

const NOW = new Date('2026-10-15T12:00:00Z');
const product = (discountPercentage, discountStartsAt = null, discountEndsAt = null) =>
  ({ priceArs: 21660, discountPercentage, discountStartsAt, discountEndsAt });

test('active discount lowers the price and keeps the list price', () => {
  const priced = applyProductDiscount(product(20), NOW);
  assert.equal(priced.priceArs, 17328);
  assert.equal(priced.listPriceArs, 21660);
  assert.equal(priced.activeDiscountPercentage, 20);
});

test('scheduled and expired discounts keep the regular price', () => {
  assert.equal(getProductDiscountStatus(product(10, new Date('2026-11-01T03:00:00Z')), NOW), 'scheduled');
  assert.equal(getProductDiscountStatus(product(25, null, new Date('2026-10-01T02:59:59Z')), NOW), 'expired');
  const expired = applyProductDiscount(product(25, null, new Date('2026-10-01T02:59:59Z')), NOW);
  assert.equal(expired.priceArs, 21660);
  assert.equal(expired.listPriceArs, null);
});

test('coupons only count lines without a product discount', () => {
  const discounted = { ...applyProductDiscount(product(20), NOW), quantity: 2 };
  const regular = { ...applyProductDiscount(product(null), NOW), quantity: 1 };
  assert.equal(getCouponEligibleSubtotal([discounted, regular]), 21660);
  assert.equal(getCouponEligibleSubtotal([regular, { ...regular, quantity: 2 }]), 21660 * 3);
});

test('a cart made only of discounted products has nothing for the coupon', () => {
  const discounted = { ...applyProductDiscount(product(15), NOW), quantity: 1 };
  assert.equal(getCouponEligibleSubtotal([discounted]), 0);
  assert.equal(getCouponEligibleSubtotal([]), 0);
});
