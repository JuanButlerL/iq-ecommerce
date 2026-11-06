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
  }).outputText, { exports, Error, console, Buffer, Date, Intl, Number, Math, require(name) {
    if (!(name in imports)) throw new Error(`Forbidden import: ${name}`);
    return imports[name];
  } });
  return exports;
}

const zod = require('zod');
const cuit = load('src/lib/utils/cuit.ts');
const pricing = load('src/features/wholesale/pricing.ts');
const provinces = load('src/lib/constants/provinces.ts');
const { calculateShippingQuote } = load('src/features/cart/lib/shipping.ts', { '@/lib/constants/provinces': provinces });
const customerValidation = load('src/lib/validations/wholesale-customer.ts', { zod, '@/lib/utils/cuit': cuit });
const { wholesaleOrderSchema, wholesaleIdentifySchema } = load('src/lib/validations/wholesale-order.ts', {
  zod,
  '@/features/wholesale/pricing': pricing,
  '@/lib/utils/cuit': cuit,
  '@/lib/validations/wholesale-customer': customerValidation,
});
const emails = load('src/features/wholesale/order-email.ts', { '@/features/wholesale/pricing': pricing });

const lines = [
  { priceArs: 16000, quantity: 6 },
  { priceArs: 16000, quantity: 4 },
];
const base = { lines, extraDiscountPercentage: 0, paymentMethod: 'MERCADO_PAGO', enableBankTransferDiscount: true, bankTransferDiscountPercentage: 10, shippingArs: 5000 };

test('precio mayorista: suma displays, subtotal y envío', () => {
  const result = pricing.calculateWholesalePricing(base);
  assert.equal(result.displays, 10);
  assert.equal(result.subtotalArs, 160000);
  assert.equal(result.transferDiscountArs, 0);
  assert.equal(result.totalArs, 165000);
});

test('el descuento por transferencia se aplica sobre el subtotal ya bonificado por CUIT y nunca sobre el envío', () => {
  const result = pricing.calculateWholesalePricing({ ...base, extraDiscountPercentage: 5, paymentMethod: 'BANK_TRANSFER' });
  assert.equal(result.extraDiscountArs, 8000);
  assert.equal(result.transferDiscountArs, 15200);
  assert.equal(result.totalArs, 160000 - 8000 - 15200 + 5000);
});

test('sin descuento por transferencia si está deshabilitado o el medio es otro', () => {
  assert.equal(pricing.calculateWholesalePricing({ ...base, paymentMethod: 'BANK_TRANSFER', enableBankTransferDiscount: false }).transferDiscountArs, 0);
  assert.equal(pricing.calculateWholesalePricing({ ...base, paymentMethod: 'ECHEQ' }).transferDiscountArs, 0);
});

test('dirección del maestro: ignora mayúsculas, tildes y espacios, pero detecta cambios', () => {
  const master = { street: 'Av. Córdoba 1234', floor: '2B', city: 'Palermo', province: 'CABA', postalCode: '1414' };
  assert.equal(pricing.isSameDeliveryAddress(master, { ...master, street: 'av cordoba  1234', floor: '2 b' }), true);
  assert.equal(pricing.isSameDeliveryAddress(master, { ...master, floor: null }), false);
  assert.equal(pricing.isSameDeliveryAddress(master, { ...master, street: 'Av. Córdoba 1235' }), false);
});

test('envío mayorista: tabla por provincia y envío gratis solo si hay umbral', () => {
  const rule = {
    mode: 'PROVINCE',
    flatPrice: 9000,
    discountThresholdArs: null,
    discountPercentage: null,
    provinces: [{ active: true, provinceName: 'CABA', shippingPrice: 4000 }],
  };
  assert.equal(calculateShippingQuote(160000, 'CABA', pricing.buildWholesaleShippingSettings(rule, null)).shippingArs, 4000);
  assert.equal(calculateShippingQuote(160000, 'Salta', pricing.buildWholesaleShippingSettings(rule, null)).shippingArs, 9000);
  assert.equal(calculateShippingQuote(160000, 'Salta', pricing.buildWholesaleShippingSettings(rule, 150000)).shippingArs, 0);
});

const validOrder = () => ({
  checkoutRequestKey: 'key-12345678',
  items: [{ wholesaleProductId: '6f1c1b1e-1111-4a4a-9a9a-123456789abc', quantity: 10 }],
  customer: { mode: 'new', email: ' Compras@Dietetica.com', cuit: '20-12345678-6', legalName: '', businessName: 'Dietética Ana', businessType: '' },
  taxCondition: 'MONOTRIBUTO',
  delivery: { contactName: 'Ana', phone: '11 5555 1234', street: 'Av. Siempre Viva 123', floor: '', city: 'Palermo', province: 'CABA', postalCode: '1414', reference: '' },
  paymentMethod: 'ECHEQ',
  notes: '',
});

test('pedido mayorista válido: normaliza email, CUIT y opcionales vacíos', () => {
  const parsed = wholesaleOrderSchema.safeParse(validOrder());
  assert.equal(parsed.success, true, parsed.success ? '' : parsed.error.issues[0].message);
  assert.equal(parsed.data.customer.email, 'compras@dietetica.com');
  assert.equal(parsed.data.customer.cuit, '20123456786');
  assert.equal(parsed.data.customer.legalName, null);
  assert.equal(parsed.data.delivery.floor, null);
});

test('pedido mayorista: rechaza CUIT inválido, sin condición de IVA o con un medio de pago desconocido', () => {
  assert.equal(wholesaleOrderSchema.safeParse({ ...validOrder(), customer: { ...validOrder().customer, cuit: '20-12345678-5' } }).success, false);
  assert.equal(wholesaleOrderSchema.safeParse({ ...validOrder(), taxCondition: '' }).success, false);
  assert.equal(wholesaleOrderSchema.safeParse({ ...validOrder(), paymentMethod: 'EFECTIVO' }).success, false);
  assert.equal(wholesaleOrderSchema.safeParse({ ...validOrder(), items: [] }).success, false);
});

test('guardar los datos requiere aceptación explícita: sin el check no se recuerda', () => {
  assert.equal(wholesaleIdentifySchema.parse({ email: 'a@b.com' }).remember, false);
  assert.equal(wholesaleIdentifySchema.parse({ email: 'a@b.com', remember: true }).remember, true);
  assert.equal(wholesaleIdentifySchema.safeParse({ email: 'a@b.com', remember: 'si' }).success, false);
});

test('un cliente existente se manda solo con su id', () => {
  const parsed = wholesaleOrderSchema.safeParse({ ...validOrder(), customer: { mode: 'existing', customerId: '6f1c1b1e-2222-4a4a-9a9a-123456789abc' } });
  assert.equal(parsed.success, true);
  assert.equal(wholesaleIdentifySchema.safeParse({ email: 'no-es-un-email' }).success, false);
});

const emailData = {
  orderNumber: 'MAY-0001',
  createdAt: new Date('2026-11-03T15:00:00Z'),
  contactName: 'Ana <b>',
  email: 'compras@dietetica.com',
  phone: '11 5555 1234',
  cuit: '20-12345678-6',
  businessName: 'Dietética Ana',
  taxConditionLabel: 'Responsable Inscripto',
  invoiceType: 'A',
  address: 'Av. Siempre Viva 123, Palermo, CABA (1414)',
  reference: null,
  notes: null,
  paymentMethod: 'ECHEQ',
  items: [{ name: 'Maní (display x12)', quantity: 10, unitPriceArs: 16000, lineTotalArs: 160000 }],
  subtotalArs: 160000,
  extraDiscountArs: 8000,
  extraDiscountPercentage: 5,
  transferDiscountArs: 0,
  shippingArs: 0,
  totalArs: 152000,
  isNewCustomer: true,
  deliveryAddressChanged: true,
};

test('mail al cliente: detalle, próximo paso del eCheq y HTML escapado', () => {
  const mail = emails.buildWholesaleOrderCustomerEmail(emailData, { orderUrl: 'https://iqkids.com.ar/mayoristas/pedido/MAY-0001' });
  assert.match(mail.subject, /MAY-0001/);
  assert.match(mail.html, /Ana &lt;b&gt;/);
  assert.match(mail.html, /Descuento especial \(5%\)/);
  assert.match(mail.text, /eCheq/);
  assert.match(mail.text, /Envío: Sin cargo/);
});

test('mail interno: avisa cliente nuevo, cambio de dirección y tipo de factura', () => {
  const mail = emails.buildWholesaleOrderAdminEmail(emailData, { adminUrl: 'https://iqkids.com.ar/admin/pedidos/1' });
  assert.match(mail.text, /Cliente nuevo/);
  assert.match(mail.text, /dirección de entrega es distinta/);
  assert.match(mail.html, /factura A/);
});
