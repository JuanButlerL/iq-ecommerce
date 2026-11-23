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
  }).outputText, { exports, Error, Date, Map, Set, Math, Number, String, JSON, Buffer, URLSearchParams, console, AbortSignal, setTimeout, require(name) {
    if (!(name in imports)) throw new Error(`Forbidden import: ${name}`);
    return imports[name];
  } });
  return exports;
}

const types = load('src/lib/integrations/logistics/types.ts', { '@prisma/client': {} });
const http = load('src/lib/integrations/logistics/http.ts', { '@/lib/integrations/logistics/types': types });
const provinces = load('src/lib/constants/provinces.ts');
const config = { getAndreaniConfig: () => ({}), getCorreoConfig: () => ({}) };
const andreani = load('src/lib/integrations/logistics/andreani.ts', {
  '@/lib/integrations/logistics/config': config,
  '@/lib/integrations/logistics/http': http,
  '@/lib/integrations/logistics/types': types,
});
const correo = load('src/lib/integrations/logistics/correo-argentino.ts', {
  '@/lib/integrations/logistics/config': config,
  '@/lib/integrations/logistics/http': http,
  '@/lib/integrations/logistics/types': types,
  '@/lib/constants/provinces': provinces,
});
const pkg = load('src/features/logistics/package.ts');
const email = load('src/features/logistics/shipping-email.ts');

const plain = (value) => JSON.parse(JSON.stringify(value));
const defaults = { defaultUnitWeightGrams: 400, defaultUnitLengthCm: 20, defaultUnitWidthCm: 15, defaultUnitHeightCm: 10 };

test('paquete: suma pesos, apila por volumen y usa los valores por defecto', () => {
  const p = pkg.computePackage([
    { quantity: 2, unit: { weightGrams: 300, lengthCm: 20, widthCm: 15, heightCm: 5 } },
    { quantity: 1, unit: { weightGrams: null, lengthCm: null, widthCm: null, heightCm: null } },
  ], defaults);
  assert.equal(p.weightGrams, 1000);
  assert.equal(p.lengthCm, 20);
  assert.equal(p.widthCm, 15);
  assert.equal(p.heightCm, 20); // 2*5 + 10
});

test('paquete: un bulto mayorista sin medidas se arma con sus displays', () => {
  const display = { weightGrams: 500, lengthCm: 20, widthCm: 15, heightCm: 10 };
  const p = pkg.computePackage([
    { quantity: 2, unit: { weightGrams: null, lengthCm: null, widthCm: null, heightCm: null }, components: [{ quantity: 5, unit: display }] },
  ], defaults);
  assert.equal(p.weightGrams, 5000);
  assert.equal(p.heightCm, 100);
});

test('cotización guardada: paquetes parecidos comparten precio', () => {
  assert.deepEqual(plain(pkg.quoteBucket({ weightGrams: 1001, lengthCm: 20, widthCm: 15, heightCm: 10 })), { weight: 1500, volume: 4000 });
  assert.deepEqual(plain(pkg.quoteBucket({ weightGrams: 1400, lengthCm: 20, widthCm: 15, heightCm: 10 })), { weight: 1500, volume: 4000 });
});

test('Andreani: tarifa con IVA redondeada hacia arriba', () => {
  assert.equal(andreani.parseAndreaniQuote({ tarifaConIva: { total: '8123.4' } }).priceArs, 8124);
  assert.throws(() => andreani.parseAndreaniQuote({}), /no devolvió una tarifa/);
});

test('Andreani: alta devuelve número de envío; sin número es ambiguo', () => {
  const created = andreani.parseAndreaniCreated({ estado: 'Creada', agrupadorDeBultos: 'AG1', bultos: [{ numeroDeEnvio: '360000123' }] });
  assert.equal(created.trackingNumber, '360000123');
  assert.equal(created.carrierShipmentId, 'AG1');
  assert.equal(created.labelReady, true);
  assert.equal(andreani.parseAndreaniCreated({ estado: 'Pendiente', bultos: [{ numeroDeEnvio: '1' }] }).labelReady, false);
  try {
    andreani.parseAndreaniCreated({ estado: 'Creada' });
    assert.fail('debería fallar');
  } catch (error) {
    assert.equal(error.kind, 'AMBIGUOUS');
  }
});

test('Andreani: sucursales solo las que entregan', () => {
  const list = andreani.parseAndreaniBranches([
    { id: 'A1', descripcion: 'Palermo', direccion: { calle: 'Santa Fe', numero: '3000', localidad: 'CABA', codigoPostal: '1425' } },
    { id: 'A2', descripcion: 'Solo despacho', datosAdicionales: { entregaEnvios: false } },
  ]);
  assert.equal(list.length, 1);
  assert.equal(list[0].address, 'Santa Fe 3000');
});

test('Andreani: orden con sucursal o domicilio y referencia del pedido', () => {
  const base = {
    reference: '2611-0001', deliveryType: 'HOME', branchId: null,
    sender: { fullName: 'IQ Kids', email: 'a@b.c', phone: '11 5555-0000', taxId: '30-71234567-8' },
    origin: { street: 'Calle', number: '1', locality: 'CABA', province: 'CABA', postalCode: '1000' },
    recipient: { fullName: 'Ana Pérez', email: 'ana@x.com', phone: '+54 9 11 4444-3333', taxId: '30111222' },
    destination: { street: 'Otra', number: '2', floor: '3B', locality: 'Rosario', province: 'Santa Fe', postalCode: '2000' },
    pkg: { weightGrams: 1234, lengthCm: 20, widthCm: 15, heightCm: 10, declaredValueArs: 25000 },
  };
  const home = andreani.buildAndreaniOrder(base, 'C1');
  assert.equal(home.destino.postal.codigoPostal, '2000');
  assert.equal(home.destinatario[0].documentoTipo, 'DNI');
  assert.equal(home.remitente.documentoNumero, '30712345678');
  assert.equal(home.bultos[0].kilos, 1.23);
  assert.equal(home.bultos[0].referencias[0].contenido, '2611-0001');
  const branch = andreani.buildAndreaniOrder({ ...base, deliveryType: 'BRANCH', branchId: 'S9' }, 'C2');
  assert.deepEqual(JSON.parse(JSON.stringify(branch.destino)), { sucursal: { id: 'S9' } });
});

test('Correo: tarifa del tipo pedido (la más barata) y días', () => {
  const quote = correo.parseCorreoRates({ rates: [
    { deliveredType: 'D', price: 9000, deliveryTimeMin: '2', deliveryTimeMax: '5' },
    { deliveredType: 'D', price: 7000.2, deliveryTimeMin: '3', deliveryTimeMax: '6' },
    { deliveredType: 'S', price: 5000 },
  ] }, 'D');
  assert.equal(quote.priceArs, 7001);
  assert.equal(quote.deliveryDaysMin, 3);
  assert.throws(() => correo.parseCorreoRates({ rates: [] }, 'S'), /no devolvió una tarifa/);
});

test('Correo: códigos de provincia (GBA es Buenos Aires)', () => {
  assert.equal(correo.provinceCode('CABA'), 'C');
  assert.equal(correo.provinceCode('GBA'), 'B');
  assert.equal(correo.provinceCode('Cordoba'), 'X');
});

test('Correo: import a sucursal lleva agency y no dirección', () => {
  const req = {
    reference: 'R1', deliveryType: 'BRANCH', branchId: 'B123',
    sender: { fullName: 'IQ', email: 'a@b.c', phone: '1', taxId: null },
    origin: { street: 'C', number: '1', locality: 'CABA', province: 'CABA', postalCode: '1000' },
    recipient: { fullName: 'X', email: 'x@y.z', phone: '2', taxId: null },
    destination: { street: 'D', number: '2', locality: 'Mendoza', province: 'Mendoza', postalCode: '5500' },
    pkg: { weightGrams: 800, lengthCm: 20, widthCm: 15, heightCm: 10, declaredValueArs: 1000 },
  };
  const body = correo.buildCorreoImport(req, 'CUST');
  assert.equal(body.shipping.deliveryType, 'S');
  assert.equal(body.shipping.agency, 'B123');
  assert.equal(body.shipping.address, undefined);
  assert.equal(body.sender.originAddress.provinceCode, 'C');
});

test('http: redact oculta credenciales', () => {
  assert.deepEqual(plain(http.redact({ user: 'u', password: 'p', nested: { apiKey: 'k', token: 't', ok: 1 } })), { user: 'u', password: '[oculto]', nested: { apiKey: '[oculto]', token: '[oculto]', ok: 1 } });
});

test('mail de envío: seguimiento, despacho y destino', () => {
  const mail = email.buildShipmentConfirmedEmail({
    firstName: 'Ana', orderNumber: '2611-0001', carrierLabel: 'Andreani · a domicilio', isOwnDelivery: false, deliveryType: 'HOME',
    trackingNumber: '360000123', trackingUrl: email.trackingUrlFor('ANDREANI', '360000123'), dispatchDateLabel: 'jueves 26/11',
    deliveryWindowLabel: null, destination: 'Otra 2, Rosario', orderUrl: 'https://iqkids.com.ar/checkout/confirmacion/2611-0001',
  });
  assert.match(mail.subject, /2611-0001/);
  assert.match(mail.html, /360000123/);
  assert.match(mail.text, /Despachamos el jueves 26\/11/);
  assert.equal(email.trackingUrlFor('OWN', '2611-0001'), null);
});

test('mail de rechazo escapa HTML del motivo', () => {
  const mail = email.buildProofRejectedEmail({ firstName: 'Ana', orderNumber: 'X', reason: '<b>monto</b>', uploadUrl: 'https://x' });
  assert.ok(!mail.html.includes('<b>monto</b>'));
  assert.match(mail.html, /&lt;b&gt;monto/);
});
