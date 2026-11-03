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
  }).outputText, { exports, Error, console, Buffer, Date, Intl, Number, require(name) {
    if (!(name in imports)) throw new Error(`Forbidden import: ${name}`);
    return imports[name];
  } });
  return exports;
}

const cuit = load('src/lib/utils/cuit.ts');
const { wholesaleCustomerSchema } = load('src/lib/validations/wholesale-customer.ts', { zod: require('zod'), '@/lib/utils/cuit': cuit });
const { wholesaleSettingsSchema } = load('src/lib/validations/wholesale-settings.ts', { zod: require('zod') });

const validCustomer = () => ({
  email: 'Compras@Dietetica.com ',
  phone: '11 5555-1234',
  contactName: 'Ana',
  businessName: 'Dietética Ana',
  legalName: '',
  businessType: 'Dietética',
  cuit: '20-12345678-6',
  taxCondition: 'MONOTRIBUTO',
  street: 'Av. Siempre Viva 123',
  floor: '',
  city: 'Palermo',
  province: 'CABA',
  postalCode: '1414',
  reference: '',
  allowDeferredPayment: false,
  extraDiscountPercentage: 5,
  active: true,
  adminNotes: '',
  leadId: null,
});

test('valida el dígito verificador del CUIT', () => {
  assert.equal(cuit.isValidCuit('20-12345678-6'), true);
  assert.equal(cuit.isValidCuit('30-71234567-1'), true);
  assert.equal(cuit.isValidCuit('20-12345678-5'), false);
  assert.equal(cuit.isValidCuit('2012345678'), false);
  assert.equal(cuit.formatCuit('20123456786'), '20-12345678-6');
});

test('normaliza email y CUIT del cliente mayorista', () => {
  const parsed = wholesaleCustomerSchema.safeParse(validCustomer());
  assert.equal(parsed.success, true, parsed.success ? '' : parsed.error.issues[0].message);
  assert.equal(parsed.data.email, 'compras@dietetica.com');
  assert.equal(parsed.data.cuit, '20123456786');
  assert.equal(parsed.data.legalName, null);
});

test('rechaza un CUIT inválido y un descuento extra fuera de rango', () => {
  assert.equal(wholesaleCustomerSchema.safeParse({ ...validCustomer(), cuit: '20-12345678-5' }).success, false);
  assert.equal(wholesaleCustomerSchema.safeParse({ ...validCustomer(), extraDiscountPercentage: 80 }).success, false);
});

test('las condiciones exigen al menos un medio de pago', () => {
  const settings = {
    minDisplays: 10,
    enableMercadoPago: false,
    enableBankTransfer: false,
    enableEcheq: false,
    echeqMaxDays: 15,
    echeqInstructions: '',
    enableBankTransferDiscount: false,
    bankTransferDiscountPercentage: 0,
    freeShippingThresholdArs: null,
    orderNotificationEmails: [],
  };
  assert.equal(wholesaleSettingsSchema.safeParse(settings).success, false);
  assert.equal(wholesaleSettingsSchema.safeParse({ ...settings, enableEcheq: true }).success, true);
});
