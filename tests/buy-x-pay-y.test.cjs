const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const ts = require('typescript');

// Runs the real modules with every import replaced, so no Prisma, env or network is touched.
function load(file, imports = {}) {
  const exports = {};
  const source = fs.readFileSync(path.join(__dirname, '..', file), 'utf8');
  vm.runInNewContext(ts.transpileModule(source, {
    compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.CommonJS },
  }).outputText, { exports, Math, Date, Error, Number, Array, Intl, require(name) {
    if (!(name in imports)) throw new Error(`Forbidden import: ${name}`);
    return imports[name];
  } });
  return exports;
}

const discount = load('src/features/catalog/lib/product-discount.ts');
const appError = load('src/lib/errors/app-error.ts');
const currency = load('src/lib/utils/currency.ts');
const coupons = load('src/features/coupons/lib/coupon-pricing.ts', {
  '@/features/catalog/lib/product-discount': discount,
  '@/lib/errors/app-error': appError,
  '@/lib/utils/currency': currency,
});
const shipping = load('src/features/cart/lib/shipping.ts', {
  '@/lib/constants/provinces': { normalizeProvinceName: (value) => value.trim().toLowerCase() },
});
const zod = require('zod');
const couponValidation = load('src/lib/validations/coupon.ts', { zod, '@/features/catalog/lib/product-discount': discount });
const productDiscountValidation = load('src/lib/validations/product-discount.ts', {
  zod,
  '@/features/catalog/lib/product-discount': discount,
});

const NOW = new Date('2026-11-30T12:00:00Z');
const PRICE = 21660;
const nxmProduct = (buy, pay, extra = {}) => ({
  priceArs: PRICE,
  discountType: 'BUY_X_PAY_Y',
  discountPercentage: null,
  discountBuyQuantity: buy,
  discountPayQuantity: pay,
  discountFreeUnitsCountForFreeShipping: true,
  discountStartsAt: null,
  discountEndsAt: null,
  ...extra,
});

// ---------- buy X pay Y basics ----------

test('only whole numbers with 1 <= pay < buy are valid promos', () => {
  assert.equal(discount.isValidBuyXPayY(3, 2), true);
  assert.equal(discount.isValidBuyXPayY(2, 1), true);
  assert.equal(discount.isValidBuyXPayY(6, 4), true);
  assert.equal(discount.isValidBuyXPayY(2, 2), false);
  assert.equal(discount.isValidBuyXPayY(1, 0), false);
  assert.equal(discount.isValidBuyXPayY(3, 0), false);
  assert.equal(discount.isValidBuyXPayY(3.5, 2), false);
  assert.equal(discount.isValidBuyXPayY(21, 20), false);
  assert.equal(discount.isValidBuyXPayY(null, 2), false);
});

test('free units are given only for complete groups', () => {
  assert.equal(discount.calculateBuyXPayYFreeUnits(2, 3, 2), 0);
  assert.equal(discount.calculateBuyXPayYFreeUnits(3, 3, 2), 1);
  assert.equal(discount.calculateBuyXPayYFreeUnits(5, 3, 2), 1);
  assert.equal(discount.calculateBuyXPayYFreeUnits(6, 3, 2), 2);
  assert.equal(discount.calculateBuyXPayYFreeUnits(4, 2, 1), 2);
  assert.equal(discount.calculateBuyXPayYFreeUnits(12, 6, 4), 4);
  assert.equal(discount.calculateBuyXPayYFreeUnits(9, 3, 3), 0);
});

// ---------- product promo ----------

test('an active product 3x2 keeps the unit price and exposes the promo', () => {
  const priced = discount.applyProductDiscount(nxmProduct(3, 2), NOW);
  assert.equal(priced.priceArs, PRICE);
  assert.equal(priced.listPriceArs, null);
  assert.equal(priced.activeDiscountPercentage, null);
  assert.equal(priced.activeBuyQuantity, 3);
  assert.equal(priced.activePayQuantity, 2);
  assert.equal(discount.getProductDiscountStatus(nxmProduct(3, 2), NOW), 'active');
});

test('scheduled, expired or broken product promos do nothing', () => {
  const scheduled = nxmProduct(3, 2, { discountStartsAt: new Date('2026-12-01T03:00:00Z') });
  const expired = nxmProduct(3, 2, { discountEndsAt: new Date('2026-11-29T02:59:59Z') });
  assert.equal(discount.getProductDiscountStatus(scheduled, NOW), 'scheduled');
  assert.equal(discount.getProductDiscountStatus(expired, NOW), 'expired');
  assert.equal(discount.applyProductDiscount(scheduled, NOW).activeBuyQuantity, null);
  assert.equal(discount.applyProductDiscount(expired, NOW).activeBuyQuantity, null);
  assert.equal(discount.getProductDiscountStatus(nxmProduct(2, 2), NOW), 'none');
  assert.equal(discount.applyProductDiscount(nxmProduct(null, null), NOW).priceArs, PRICE);
});

test('a NxM product ignores a leftover percentage and percentage products ignore leftover quantities', () => {
  const nxmWithPercentage = discount.applyProductDiscount(nxmProduct(3, 2, { discountPercentage: 30 }), NOW);
  assert.equal(nxmWithPercentage.priceArs, PRICE);
  assert.equal(nxmWithPercentage.activeDiscountPercentage, null);
  const percentageWithQuantities = discount.applyProductDiscount(
    { ...nxmProduct(3, 2), discountType: 'PERCENTAGE', discountPercentage: 20 },
    NOW,
  );
  assert.equal(percentageWithQuantities.priceArs, 17328);
  assert.equal(percentageWithQuantities.activeBuyQuantity, null);
});

test('products saved before the migration (no type) keep working as percentage discounts', () => {
  const legacy = discount.applyProductDiscount(
    { priceArs: PRICE, discountPercentage: 20, discountStartsAt: null, discountEndsAt: null },
    NOW,
  );
  assert.equal(legacy.priceArs, 17328);
  assert.equal(legacy.activeBuyQuantity, null);
  assert.equal(legacy.activeFreeUnitsCountForFreeShipping, true);
});

test('line pricing charges pay units per group', () => {
  const product = discount.applyProductDiscount(nxmProduct(3, 2), NOW);
  const line = discount.getProductLinePricing({ ...product, quantity: 7 });
  assert.equal(line.freeUnits, 2);
  assert.equal(line.lineTotalArs, PRICE * 5);
  assert.equal(line.listLineTotalArs, PRICE * 7);
  assert.equal(line.promoLabel, '3x2');
  assert.equal(discount.getProductLinePricing({ ...product, quantity: 2 }).promoLabel, null);
});

test('product free units count for free shipping only when the box is ticked', () => {
  const counts = discount.applyProductDiscount(nxmProduct(3, 2), NOW);
  const notCounts = discount.applyProductDiscount(nxmProduct(3, 2, { discountFreeUnitsCountForFreeShipping: false }), NOW);
  const regular = discount.applyProductDiscount({ priceArs: 10000, discountPercentage: null, discountStartsAt: null, discountEndsAt: null }, NOW);

  const withFlag = discount.summarizeProductLines([{ ...counts, quantity: 3 }, { ...regular, quantity: 1 }]);
  assert.equal(withFlag.subtotalArs, PRICE * 2 + 10000);
  assert.equal(withFlag.freeShippingSubtotalArs, PRICE * 3 + 10000);
  assert.equal(withFlag.productPromoSavingsArs, PRICE);

  const withoutFlag = discount.summarizeProductLines([{ ...notCounts, quantity: 3 }, { ...regular, quantity: 1 }]);
  assert.equal(withoutFlag.subtotalArs, PRICE * 2 + 10000);
  assert.equal(withoutFlag.freeShippingSubtotalArs, PRICE * 2 + 10000);
});

test('coupons skip lines that have a product NxM, like percentage discounts', () => {
  const promo = { ...discount.applyProductDiscount(nxmProduct(3, 2), NOW), quantity: 3 };
  const regular = { ...discount.applyProductDiscount({ priceArs: 10000, discountPercentage: null, discountStartsAt: null, discountEndsAt: null }, NOW), quantity: 2 };
  assert.equal(discount.getCouponEligibleSubtotal([promo, regular]), 20000);
  assert.deepEqual(discount.getCouponEligibleLines([promo, regular]).map((line) => line.quantity), [2]);
  assert.equal(discount.hasActiveProductPromo(promo), true);
  assert.equal(discount.hasActiveProductPromo(regular), false);
});

// ---------- coupon NxM ----------

const coupon = (overrides = {}) => ({
  id: 'c1',
  code: 'CYBER3X2',
  discountType: 'BUY_X_PAY_Y',
  discountPercentage: 0,
  fixedDiscountArs: null,
  usageType: 'UNLIMITED',
  buyQuantity: 3,
  payQuantity: 2,
  freeUnitsCountForFreeShipping: true,
  buyXPayYSameProductOnly: false,
  ...overrides,
});

test('coupon 3x2 mixes products and gives the cheapest unit of each group', () => {
  // Units sorted: 300, 200, 200 | 100, 100, 50 -> free 200 and 50.
  const result = coupons.calculateBuyXPayYCouponDiscount(
    [
      { unitPriceArs: 200, quantity: 2 },
      { unitPriceArs: 300, quantity: 1 },
      { unitPriceArs: 100, quantity: 2 },
      { unitPriceArs: 50, quantity: 1 },
    ],
    3,
    2,
  );
  assert.deepEqual({ ...result }, { discountArs: 250, freeUnits: 2 });
});

test('coupon 2x1 and incomplete groups', () => {
  assert.deepEqual({ ...coupons.calculateBuyXPayYCouponDiscount([{ unitPriceArs: 1000, quantity: 5 }], 2, 1) }, { discountArs: 2000, freeUnits: 2 });
  assert.deepEqual({ ...coupons.calculateBuyXPayYCouponDiscount([{ unitPriceArs: 1000, quantity: 2 }], 3, 2) }, { discountArs: 0, freeUnits: 0 });
  assert.deepEqual({ ...coupons.calculateBuyXPayYCouponDiscount([{ unitPriceArs: 1000, quantity: 3 }], 3, 3) }, { discountArs: 0, freeUnits: 0 });
});

test('coupon summary for a 3x2 whose free unit counts for free shipping', () => {
  const lines = [{ unitPriceArs: PRICE, quantity: 3 }];
  const summary = coupons.buildCouponSummary(coupon(), PRICE * 3, lines);
  assert.equal(summary.discountArs, PRICE);
  assert.equal(summary.freeUnits, 1);
  assert.equal(summary.subtotalWithDiscountArs, PRICE * 2);
  assert.equal(summary.freeShippingDeductionArs, 0);
  assert.equal(summary.discountPercentage, 0);
  assert.equal(coupons.getCouponDiscountLabel(summary), '3x2');
});

test('coupon summary for a 3x2 whose free unit must not count for free shipping', () => {
  const lines = [{ unitPriceArs: PRICE, quantity: 3 }];
  const summary = coupons.buildCouponSummary(coupon({ freeUnitsCountForFreeShipping: false }), PRICE * 3, lines);
  assert.equal(summary.discountArs, PRICE);
  assert.equal(summary.freeShippingDeductionArs, PRICE);
});

test('a NxM coupon without enough units explains how to use it', () => {
  assert.throws(
    () => coupons.buildCouponSummary(coupon(), PRICE * 2, [{ unitPriceArs: PRICE, quantity: 2 }]),
    /3x2: sumá al menos 3 unidades/,
  );
  assert.throws(() => coupons.buildCouponSummary(coupon({ payQuantity: 3 }), PRICE * 3, [{ unitPriceArs: PRICE, quantity: 3 }]), /no está bien configurado/);
});

test('percentage and fixed coupons behave exactly as before and never touch free shipping', () => {
  const percentage = coupons.buildCouponSummary(coupon({ discountType: 'PERCENTAGE', discountPercentage: 10, buyQuantity: null, payQuantity: null, freeUnitsCountForFreeShipping: false }), 50000);
  assert.equal(percentage.discountArs, 5000);
  assert.equal(percentage.freeShippingDeductionArs, 0);
  assert.equal(percentage.buyQuantity, null);
  const fixed = coupons.buildCouponSummary(coupon({ discountType: 'FIXED_AMOUNT', fixedDiscountArs: 60000 }), 50000);
  assert.equal(fixed.discountArs, 50000);
  assert.equal(fixed.freeShippingDeductionArs, 0);
});

test('a mixed NxM coupon groups different flavors; a same-product one does not', () => {
  const threeFlavors = [
    { productId: 'cacao', unitPriceArs: PRICE, quantity: 1 },
    { productId: 'banana', unitPriceArs: PRICE, quantity: 1 },
    { productId: 'mani', unitPriceArs: PRICE, quantity: 1 },
  ];
  assert.equal(coupons.buildCouponSummary(coupon(), PRICE * 3, threeFlavors).freeUnits, 1);
  assert.throws(
    () => coupons.buildCouponSummary(coupon({ buyXPayYSameProductOnly: true }), PRICE * 3, threeFlavors),
    /3x2 por producto: sumá al menos 3 unidades del mismo producto/,
  );
  const summary = coupons.buildCouponSummary(coupon({ buyXPayYSameProductOnly: true }), PRICE * 5, [
    { productId: 'cacao', unitPriceArs: PRICE, quantity: 3 },
    { productId: 'banana', unitPriceArs: PRICE, quantity: 2 },
  ]);
  assert.equal(summary.freeUnits, 1);
  assert.equal(summary.discountArs, PRICE);
  assert.equal(summary.sameProductOnly, true);
});

test('per product grouping merges repeated lines of the same product', () => {
  const result = coupons.calculateBuyXPayYCouponDiscountPerProduct(
    [
      { productId: 'cacao', unitPriceArs: 1000, quantity: 2 },
      { productId: 'cacao', unitPriceArs: 1000, quantity: 2 },
      { productId: 'banana', unitPriceArs: 500, quantity: 2 },
    ],
    2,
    1,
  );
  assert.deepEqual({ ...result }, { discountArs: 2500, freeUnits: 3 });
});

const PACK_ID = '11111111-2222-4333-8444-555555555555';
const pack = (unitsPerPack) => [{ productId: PACK_ID, unitsPerPack }];

test('a 3 display pack with a 3x2 gets a third off with a single unit', () => {
  const lines = [{ productId: PACK_ID, unitPriceArs: 71100, quantity: 1 }];
  const summary = coupons.buildCouponSummary(coupon({ buyXPayYPackUnits: pack(3) }), 71100, lines);
  assert.equal(summary.discountArs, 23700);
  assert.equal(summary.freeUnits, 1);
  const two = coupons.buildCouponSummary(coupon({ buyXPayYPackUnits: pack(3), buyXPayYSameProductOnly: true }), 142200, [
    { productId: PACK_ID, unitPriceArs: 71100, quantity: 2 },
  ]);
  assert.equal(two.discountArs, 47400);
});

test('without the pack setting the pack counts as one unit and needs 3 packs', () => {
  assert.throws(
    () => coupons.buildCouponSummary(coupon(), 71100, [{ productId: PACK_ID, unitPriceArs: 71100, quantity: 1 }]),
    /sumá al menos 3 unidades/,
  );
  const three = coupons.buildCouponSummary(coupon(), 213300, [{ productId: PACK_ID, unitPriceArs: 71100, quantity: 3 }]);
  assert.equal(three.discountArs, 71100);
});

test('pack units mix with loose products and round to whole pesos', () => {
  // 2x1 with a pack of 3 at 1000 (333.33 each) + 1 loose at 500: units 500, 333.33 x3 -> free 333.33 + 333.33.
  const summary = coupons.buildCouponSummary(coupon({ buyQuantity: 2, payQuantity: 1, buyXPayYPackUnits: pack(3) }), 1500, [
    { productId: PACK_ID, unitPriceArs: 1000, quantity: 1 },
    { productId: 'loose', unitPriceArs: 500, quantity: 1 },
  ]);
  assert.equal(summary.discountArs, 667);
  assert.equal(summary.freeUnits, 2);
});

test('malformed pack data is ignored', () => {
  assert.deepEqual(
    coupons.parseCouponPackUnits([
      { productId: PACK_ID, unitsPerPack: 3 },
      { productId: PACK_ID, unitsPerPack: 6 },
      { productId: 'x', unitsPerPack: 1 },
      { productId: 'y', unitsPerPack: 2.5 },
      null,
      'nope',
    ]).map((entry) => ({ ...entry })),
    [{ productId: PACK_ID, unitsPerPack: 3 }],
  );
  assert.equal(coupons.parseCouponPackUnits(null).length, 0);
  assert.equal(coupons.parseCouponPackUnits({}).length, 0);
});

// ---------- free shipping threshold ----------

const settings = {
  minimumOrderAmount: 0,
  freeShippingThreshold: 60000,
  flatShippingPrice: 5000,
  shippingMode: 'FLAT',
  activeShippingRule: null,
};

test('free shipping uses the threshold base, and defaults to the subtotal', () => {
  assert.equal(shipping.calculateShippingQuote(43320, 'Buenos Aires', settings).shippingArs, 5000);
  assert.equal(shipping.calculateShippingQuote(43320, 'Buenos Aires', settings, 64980).freeShippingReached, true);
  assert.equal(shipping.calculateShippingQuote(64980, 'Buenos Aires', settings, 43320).shippingArs, 5000);
  assert.equal(shipping.calculateShippingQuote(64980, 'Buenos Aires', settings).shippingArs, 0);
});

test('end to end: 3 boxes with a 3x2 coupon, with and without the free box counting', () => {
  const productTotals = discount.summarizeProductLines([{ priceArs: PRICE, quantity: 3 }]);
  const lines = [{ unitPriceArs: PRICE, quantity: 3 }];

  const counts = coupons.buildCouponSummary(coupon(), productTotals.subtotalArs, lines);
  const base1 = productTotals.freeShippingSubtotalArs - counts.freeShippingDeductionArs;
  assert.equal(base1, 64980);
  assert.equal(shipping.calculateShippingQuote(productTotals.subtotalArs, 'x', settings, base1).shippingArs, 0);

  const notCounts = coupons.buildCouponSummary(coupon({ freeUnitsCountForFreeShipping: false }), productTotals.subtotalArs, lines);
  const base2 = productTotals.freeShippingSubtotalArs - notCounts.freeShippingDeductionArs;
  assert.equal(base2, 43320);
  assert.equal(shipping.calculateShippingQuote(productTotals.subtotalArs, 'x', settings, base2).shippingArs, 5000);
});

// ---------- admin validation ----------

const baseCoupon = { code: 'CYBER3X2', active: true, discountType: 'BUY_X_PAY_Y' };

test('coupon form accepts a valid NxM and rejects broken ones', () => {
  const ok = couponValidation.couponFormSchema.safeParse({ ...baseCoupon, buyQuantity: '3', payQuantity: '2', freeUnitsCountForFreeShipping: false });
  assert.equal(ok.success, true);
  assert.equal(ok.data.buyQuantity, 3);
  assert.equal(ok.data.freeUnitsCountForFreeShipping, false);
  assert.equal(ok.data.buyXPayYSameProductOnly, false);
  assert.equal(ok.data.buyXPayYPackUnits.length, 0);
  const withPack = couponValidation.couponFormSchema.safeParse({ ...baseCoupon, buyQuantity: 3, payQuantity: 2, buyXPayYPackUnits: [{ productId: PACK_ID, unitsPerPack: '3' }] });
  assert.equal(withPack.success, true);
  assert.equal(withPack.data.buyXPayYPackUnits[0].unitsPerPack, 3);
  assert.equal(couponValidation.couponFormSchema.safeParse({ ...baseCoupon, buyQuantity: 3, payQuantity: 2, buyXPayYPackUnits: [{ productId: PACK_ID, unitsPerPack: 1 }] }).success, false);
  assert.equal(
    couponValidation.couponFormSchema.safeParse({ ...baseCoupon, buyQuantity: 3, payQuantity: 2, buyXPayYPackUnits: [{ productId: PACK_ID, unitsPerPack: 3 }, { productId: PACK_ID, unitsPerPack: 6 }] }).success,
    false,
  );
  assert.equal(
    couponValidation.couponFormSchema.safeParse({ ...baseCoupon, buyQuantity: 3, payQuantity: 2, buyXPayYSameProductOnly: true }).data.buyXPayYSameProductOnly,
    true,
  );
  assert.equal(couponValidation.couponFormSchema.safeParse({ ...baseCoupon, buyQuantity: 2, payQuantity: 2 }).success, false);
  assert.equal(couponValidation.couponFormSchema.safeParse({ ...baseCoupon }).success, false);
  assert.equal(
    couponValidation.couponFormSchema.safeParse({ ...baseCoupon, buyQuantity: 3, payQuantity: 2, entries: [{ code: 'AAA111', discountPercentage: 5 }] }).success,
    false,
  );
});

test('existing percentage coupon payloads still validate and default the new tick to true', () => {
  const parsed = couponValidation.couponFormSchema.safeParse({ code: 'HOLA10', active: true, discountType: 'PERCENTAGE', discountPercentage: 10 });
  assert.equal(parsed.success, true);
  assert.equal(parsed.data.freeUnitsCountForFreeShipping, true);
});

test('coupon preview accepts cart items and stays compatible without them', () => {
  assert.equal(couponValidation.couponPreviewSchema.safeParse({ code: 'CYBER3X2', subtotalArs: 1000 }).success, true);
  assert.equal(
    couponValidation.couponPreviewSchema.safeParse({
      code: 'CYBER3X2',
      subtotalArs: 1000,
      items: [{ productId: '7d1b2c7e-2a4f-4a53-9c1e-1f2a3b4c5d6e', quantity: 3 }],
    }).success,
    true,
  );
  assert.equal(
    couponValidation.couponPreviewSchema.safeParse({ code: 'CYBER3X2', subtotalArs: 1000, items: [{ productId: 'nope', quantity: 3 }] }).success,
    false,
  );
});

test('product discount form: old payloads, NxM and removal', () => {
  const legacy = productDiscountValidation.productDiscountFormSchema.safeParse({ discountPercentage: 15, startsOn: '', endsOn: '' });
  assert.equal(legacy.success, true);
  assert.equal(legacy.data.discountType, 'PERCENTAGE');
  const nxm = productDiscountValidation.productDiscountFormSchema.safeParse({ discountType: 'BUY_X_PAY_Y', buyQuantity: 3, payQuantity: 2, freeUnitsCountForFreeShipping: false });
  assert.equal(nxm.success, true);
  assert.equal(productDiscountValidation.productDiscountFormSchema.safeParse({ discountType: 'BUY_X_PAY_Y', buyQuantity: 3, payQuantity: 3 }).success, false);
  assert.equal(productDiscountValidation.productDiscountFormSchema.safeParse({ discountType: 'BUY_X_PAY_Y', buyQuantity: 3, payQuantity: null }).success, false);
  assert.equal(productDiscountValidation.productDiscountFormSchema.safeParse({ discountType: 'BUY_X_PAY_Y', buyQuantity: null, payQuantity: null }).success, true);
});
