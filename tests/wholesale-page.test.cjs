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
  }).outputText, { exports, Error, console, Buffer, Date, Intl, require(name) {
    if (!(name in imports)) throw new Error(`Forbidden import: ${name}`);
    return imports[name];
  } });
  return exports;
}

const { DEFAULT_WHOLESALE_CONTENT } = load('src/features/wholesale/content.ts');
const { wholesaleContentSchema } = load('src/lib/validations/wholesale-page.ts', { zod: require('zod') });
const clone = () => JSON.parse(JSON.stringify(DEFAULT_WHOLESALE_CONTENT));

test('el contenido por defecto de /mayoristas es válido', () => {
  const parsed = wholesaleContentSchema.safeParse(clone());
  assert.equal(parsed.success, true, parsed.success ? '' : parsed.error.issues[0].message);
});

test('rechaza un título de portada vacío', () => {
  const content = clone();
  content.hero.title = '   ';
  const parsed = wholesaleContentSchema.safeParse(content);
  assert.equal(parsed.success, false);
  assert.match(parsed.error.issues[0].message, /Portada · título/);
});

test('rechaza productos sin imagen', () => {
  const content = clone();
  content.products.items[0].imageUrl = '';
  assert.equal(wholesaleContentSchema.safeParse(content).success, false);
});

test('el contenido guardado con precios de planes y pedido rápido sigue siendo válido y los descarta', () => {
  const content = clone();
  content.conditions.plans[0].price = 16000;
  content.conditions.plans[0].priceUnit = '/ display';
  Object.assign(content.contact, { orderEnabled: true, orderTitle: 'Pedido', minDisplays: 10, orderItems: [{ name: 'Maní', price: 16000 }] });
  const parsed = wholesaleContentSchema.safeParse(content);
  assert.equal(parsed.success, true, parsed.success ? '' : parsed.error.issues[0].message);
  assert.equal('price' in parsed.data.conditions.plans[0], false);
  assert.equal('orderItems' in parsed.data.contact, false);
});

test('permite listas vacías en secciones opcionales (se ocultan)', () => {
  const content = clone();
  content.testimonials.items = [];
  content.stats = [];
  content.contact.monthlyVolumes = [];
  assert.equal(wholesaleContentSchema.safeParse(content).success, true);
});

const { wholesaleLeadSchema } = load('src/lib/validations/wholesale-lead.ts', { zod: require('zod') });
const { buildWholesaleLeadEmail, toArgentineWhatsappNumber } = load('src/features/wholesale/lead-email.ts');

const validLead = () => ({
  nombre: 'Ana', telefono: '11 2345 6789', email: 'ANA@Ejemplo.com', negocio: '', tipo: 'Dietética', cuit: '20-12345678-9',
  calle: 'Corrientes 1234', piso: '', ciudad: 'CABA', provincia: 'Buenos Aires (CABA)', cp: '1043', zona: '', cantidad: '', mensaje: 'Hola', consentimiento: true,
});

test('consulta mayorista válida: normaliza email, CUIT y opcionales vacíos', () => {
  const parsed = wholesaleLeadSchema.safeParse(validLead());
  assert.equal(parsed.success, true);
  assert.equal(parsed.data.email, 'ana@ejemplo.com');
  assert.equal(parsed.data.cuit, '20123456789');
  assert.equal(parsed.data.negocio, null);
});

test('consulta mayorista: exige consentimiento, CUIT de 11 dígitos y campos obligatorios', () => {
  assert.match(wholesaleLeadSchema.safeParse({ ...validLead(), consentimiento: false }).error.issues[0].message, /privacidad/);
  assert.match(wholesaleLeadSchema.safeParse({ ...validLead(), cuit: '123' }).error.issues[0].message, /11 dígitos/);
  assert.match(wholesaleLeadSchema.safeParse({ ...validLead(), calle: ' ' }).error.issues[0].message, /calle/);
  assert.equal(wholesaleLeadSchema.safeParse(null).success, false);
});

test('email de aviso: incluye los datos cargados y escapa HTML', () => {
  const email = buildWholesaleLeadEmail({
    name: 'Ana <b>', phone: '1123456789', email: 'ana@ejemplo.com', businessName: 'La Hoja', businessType: 'Dietética', cuit: null,
    street: 'Corrientes 1234', floor: null, city: 'CABA', province: 'Buenos Aires (CABA)', postalCode: '1043', reference: null,
    monthlyVolume: '5 a 20 displays por mes', message: 'Quiero lista de precios', createdAt: new Date('2026-10-21T15:00:00Z'),
  }, { adminUrl: 'https://iqkids.com.ar/admin/mayoristas/consultas', whatsappUrl: 'https://wa.me/5491123456789' });
  assert.equal(email.subject, 'Nueva consulta mayorista: La Hoja (Dietética)');
  assert.match(email.html, /Ana &lt;b&gt;/);
  assert.doesNotMatch(email.html, /CUIT/);
  assert.match(email.text, /Cantidad estimada: 5 a 20 displays por mes/);
  assert.match(email.text, /Mensaje: Quiero lista de precios/);
  assert.match(email.text, /Dirección de entrega: Corrientes 1234, CABA, Buenos Aires \(CABA\), CP 1043/);
});

test('teléfonos argentinos escritos a mano se llevan al formato de WhatsApp', () => {
  assert.equal(toArgentineWhatsappNumber('11 2345 6789'), '5491123456789');
  assert.equal(toArgentineWhatsappNumber('011 15 2345-6789'), '5491123456789');
  assert.equal(toArgentineWhatsappNumber('+54 9 351 555-1234'), '5493515551234');
  assert.equal(toArgentineWhatsappNumber('0351 15 555 1234'), '5493515551234');
});

const access = load('src/features/wholesale/access.ts', {
  'node:crypto': require('node:crypto'),
  'next/headers': { cookies: async () => ({ get: () => undefined }) },
  '@/lib/env': { env: { ADMIN_SESSION_SECRET: 'test-secret-1234567890' } },
});

const passwordHash = access.hashWholesalePassword('unaClave123.');

test('/mayoristas arranca sin contraseña: los precios son públicos', () => {
  assert.equal(DEFAULT_WHOLESALE_CONTENT.accessPasswordHash, '');
});

test('contraseña de /mayoristas: valida la correcta y rechaza otra', () => {
  assert.equal(access.verifyWholesalePassword('unaClave123.', passwordHash), true);
  assert.equal(access.verifyWholesalePassword('unaClave123', passwordHash), false);
  assert.equal(access.verifyWholesalePassword('cualquiera', ''), false);
});

test('cambiar la contraseña invalida el token de acceso anterior', () => {
  const nuevo = access.hashWholesalePassword('otraClave99');
  assert.equal(access.verifyWholesalePassword('otraClave99', nuevo), true);
  assert.notEqual(access.buildWholesaleAccessToken(nuevo), access.buildWholesaleAccessToken(passwordHash));
});

test('sin cookie no hay acceso si la página tiene contraseña', async () => {
  assert.equal(await access.hasWholesaleAccess({ accessPasswordHash: passwordHash }), false);
  assert.equal(await access.hasWholesaleAccess({ accessPasswordHash: '' }), true);
});

test('el contenido guardado antes del carrusel sigue siendo válido y toma valores por defecto', () => {
  const content = clone();
  delete content.hero.backgroundImageUrl;
  delete content.hero.backgroundMobileImageUrl;
  delete content.hero.slides;
  delete content.hero.intervalSeconds;
  const parsed = wholesaleContentSchema.safeParse(content);
  assert.equal(parsed.success, true, parsed.success ? '' : parsed.error.issues[0].message);
  assert.deepEqual(parsed.data.hero.slides, []);
  assert.equal(parsed.data.hero.backgroundImageUrl, '');
  assert.equal(parsed.data.hero.intervalSeconds, 7);
});

test('el carrusel de la portada acepta slides con foto y rechaza los que no tienen', () => {
  const content = clone();
  content.hero.slides = [{ imageUrl: '/uploads/wholesale/slide.jpg', title: 'Nuevo sabor', ctaLabel: 'Ver precios', ctaUrl: '#productos' }];
  const parsed = wholesaleContentSchema.safeParse(content);
  assert.equal(parsed.success, true, parsed.success ? '' : parsed.error.issues[0].message);
  assert.equal(parsed.data.hero.slides[0].overlay, true);

  content.hero.slides = [{ imageUrl: '', title: 'Sin foto' }];
  assert.equal(wholesaleContentSchema.safeParse(content).success, false);
});

test('rechaza un link del carrusel que no es una ruta ni una dirección web', () => {
  const content = clone();
  content.hero.slides = [{ imageUrl: '/uploads/wholesale/slide.jpg', ctaUrl: 'javascript:alert(1)' }];
  assert.equal(wholesaleContentSchema.safeParse(content).success, false);
});
