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
const customerValidation = load('src/lib/validations/wholesale-customer.ts', { zod, '@/lib/utils/cuit': cuit });
const orderValidation = load('src/lib/validations/wholesale-order.ts', {
  zod,
  '@/features/wholesale/pricing': pricing,
  '@/lib/utils/cuit': cuit,
  '@/lib/validations/wholesale-customer': customerValidation,
});
const { wholesaleRegistrationSchema } = load('src/lib/validations/wholesale-registration.ts', {
  zod,
  '@/lib/validations/wholesale-customer': customerValidation,
  '@/lib/validations/wholesale-order': orderValidation,
});
const emails = load('src/features/wholesale/registration-email.ts');

const validRegistration = () => ({
  contactName: ' Ana Pérez ',
  phone: '11 2345-6789',
  email: 'Ana@Dietetica.com',
  businessName: 'Dietética La Hoja',
  legalName: '',
  businessType: 'Dietética',
  cuit: '20-12345678-6',
  taxCondition: 'MONOTRIBUTO',
  street: 'Av. Corrientes 1234',
  floor: '',
  city: 'CABA',
  province: 'Ciudad Autónoma de Buenos Aires',
  postalCode: '1043',
  reference: '',
  monthlyVolume: '5 a 20 displays por mes',
  message: '',
  consent: true,
  website: '',
});

test('registro mayorista: normaliza email, CUIT y opcionales vacíos', () => {
  const parsed = wholesaleRegistrationSchema.safeParse(validRegistration());
  assert.equal(parsed.success, true, parsed.success ? '' : parsed.error.issues[0].message);
  assert.equal(parsed.data.email, 'ana@dietetica.com');
  assert.equal(parsed.data.cuit, '20123456786');
  assert.equal(parsed.data.contactName, 'Ana Pérez');
  assert.equal(parsed.data.legalName, null);
  assert.equal(parsed.data.floor, null);
});

test('registro mayorista: exige CUIT válido, condición de IVA, tipo de negocio y consentimiento', () => {
  const issue = (patch) => wholesaleRegistrationSchema.safeParse({ ...validRegistration(), ...patch }).error.issues[0].message;
  assert.match(issue({ cuit: '20123456787' }), /CUIT no es válido/);
  assert.match(issue({ cuit: '' }), /CUIT/);
  assert.match(issue({ taxCondition: '' }), /IVA/);
  assert.match(issue({ businessType: ' ' }), /tipo de negocio/);
  assert.match(issue({ consent: false }), /privacidad/);
  assert.match(issue({ phone: '123' }), /teléfono/);
  assert.equal(wholesaleRegistrationSchema.safeParse(null).success, false);
});

const emailData = {
  contactName: 'Ana Pérez',
  email: 'ana@dietetica.com',
  phone: '11 2345-6789',
  businessName: 'Dietética <La Hoja>',
  legalName: null,
  businessType: 'Dietética',
  cuit: '20-12345678-6',
  taxConditionLabel: 'Monotributo',
  address: 'Av. Corrientes 1234, CABA, CP 1043',
  reference: null,
  monthlyVolume: '5 a 20 displays por mes',
  message: null,
  createdAt: new Date('2026-11-03T15:00:00Z'),
};

test('mail de bienvenida: saluda por el nombre, muestra mínimo y medios de pago y escapa HTML', () => {
  const email = emails.buildWholesaleRegistrationCustomerEmail(emailData, {
    shopUrl: 'https://iqkids.com.ar/mayoristas#productos',
    minDisplays: 10,
    paymentMethods: ['Mercado Pago', 'transferencia', 'eCheq'],
    whatsappUrl: 'https://wa.me/5491100000000',
  });
  assert.match(email.html, /¡Gracias por registrarte, Ana!/);
  assert.match(email.text, /mínimo es de 10 displays/);
  assert.match(email.text, /Pagás con Mercado Pago, transferencia o eCheq\./);
  assert.match(email.html, /Dietética &lt;La Hoja&gt;/);
  assert.doesNotMatch(email.html, /<La Hoja>/);
  assert.match(email.html, /https:\/\/iqkids\.com\.ar\/mayoristas#productos/);
});

test('mail de bienvenida: sin medios de pago habilitados no menciona el pago', () => {
  const email = emails.buildWholesaleRegistrationCustomerEmail(emailData, { shopUrl: 'x', minDisplays: 10, paymentMethods: [], whatsappUrl: 'y' });
  assert.doesNotMatch(email.text, /Pagás con/);
});

test('aviso interno de registro: asunto con negocio y tipo, solo filas completas y link a la ficha', () => {
  const email = emails.buildWholesaleRegistrationAdminEmail(emailData, {
    adminUrl: 'https://iqkids.com.ar/admin/mayoristas/clientes/abc',
    whatsappUrl: 'https://wa.me/5491123456789',
  });
  assert.equal(email.subject, 'Nuevo cliente mayorista: Dietética <La Hoja> (Dietética)');
  assert.match(email.text, /CUIT: 20-12345678-6/);
  assert.match(email.text, /Cantidad estimada: 5 a 20 displays por mes/);
  assert.doesNotMatch(email.text, /Razón social/);
  assert.match(email.html, /admin\/mayoristas\/clientes\/abc/);
});
