const { test } = require('node:test');
const assert = require('node:assert/strict');
const crypto = require('node:crypto');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const ts = require('typescript');

function load(file, imports = {}) {
  const exports = {};
  const source = fs.readFileSync(path.join(__dirname, '..', file), 'utf8');
  vm.runInNewContext(ts.transpileModule(source, {
    compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.CommonJS },
  }).outputText, { exports, Error, console, Buffer, Date, JSON, URLSearchParams, require(name) {
    if (!(name in imports)) throw new Error(`Forbidden import: ${name}`);
    return imports[name];
  } });
  return exports;
}

const graph = load('src/features/email/graph-transport.ts', { 'node:crypto': crypto });

// Self-signed test certificate generated on the fly, never stored.
function makeTestCertificate() {
  const { privateKey, publicKey } = crypto.generateKeyPairSync('rsa', { modulusLength: 2048 });
  const pem = (b64, label) => `-----BEGIN ${label}-----\n${b64.match(/.{1,64}/g).join('\n')}\n-----END ${label}-----`;
  // Minimal DER builder for a self-signed X.509 v3 certificate.
  const len = (n) => (n < 128 ? Buffer.from([n]) : n < 256 ? Buffer.from([0x81, n]) : Buffer.from([0x82, n >> 8, n & 255]));
  const tlv = (tag, body) => Buffer.concat([Buffer.from([tag]), len(body.length), body]);
  const seq = (...parts) => tlv(0x30, Buffer.concat(parts));
  const oid = (hex) => tlv(0x06, Buffer.from(hex, 'hex'));
  const sha256WithRsa = seq(oid('2a864886f70d01010b'), Buffer.from([0x05, 0x00]));
  const name = seq(tlv(0x31, seq(oid('550403'), tlv(0x0c, Buffer.from('iqkids-test')))));
  const time = (d) => tlv(0x17, Buffer.from(d.toISOString().replace(/[-:T]/g, '').slice(2, 14) + 'Z'));
  const now = new Date();
  const tbs = seq(
    tlv(0xa0, tlv(0x02, Buffer.from([2]))),
    tlv(0x02, Buffer.from([1])),
    sha256WithRsa,
    name,
    seq(time(now), time(new Date(now.getTime() + 86400000))),
    name,
    publicKey.export({ type: 'spki', format: 'der' }),
  );
  const signature = crypto.sign('sha256', tbs, privateKey);
  const der = seq(tbs, sha256WithRsa, tlv(0x03, Buffer.concat([Buffer.from([0]), signature])));
  return {
    certificatePem: pem(der.toString('base64'), 'CERTIFICATE'),
    privateKeyPem: privateKey.export({ type: 'pkcs8', format: 'pem' }),
    publicKey,
    der,
  };
}

test('normaliza PEM guardados en una línea con \n literales', () => {
  assert.equal(graph.normalizePem('-----BEGIN X-----\nabc\n-----END X-----\n'), '-----BEGIN X-----\nabc\n-----END X-----');
});

test('arma la client assertion firmada con el certificado', () => {
  const cert = makeTestCertificate();
  const config = {
    tenantId: 'tenant-123',
    clientId: 'client-456',
    senderEmail: 'notificaciones@iqkids.com.ar',
    certificatePem: cert.certificatePem.replace(/\n/g, '\n'),
    privateKeyPem: cert.privateKeyPem,
  };
  const jwt = graph.buildClientAssertion(config, Date.UTC(2026, 9, 22, 12, 0, 0));
  const [header, payload, signature] = jwt.split('.');
  const decode = (part) => JSON.parse(Buffer.from(part, 'base64url').toString('utf8'));

  const expectedThumbprint = crypto.createHash('sha1').update(cert.der).digest('base64url');
  assert.deepEqual(decode(header), { alg: 'RS256', typ: 'JWT', x5t: expectedThumbprint });
  const claims = decode(payload);
  assert.equal(claims.aud, 'https://login.microsoftonline.com/tenant-123/oauth2/v2.0/token');
  assert.equal(claims.iss, 'client-456');
  assert.equal(claims.sub, 'client-456');
  assert.equal(claims.exp - claims.nbf, 600);
  assert.ok(claims.jti);
  assert.equal(
    crypto.verify('RSA-SHA256', Buffer.from(`${header}.${payload}`), cert.publicKey, Buffer.from(signature, 'base64url')),
    true,
  );
});

test('el mensaje de Graph usa el buzón remitente, no guarda copia y filtra headers no permitidos', () => {
  const body = JSON.parse(JSON.stringify(graph.buildGraphMessage({
    senderName: 'IQ Kids Mayoristas',
    replyToEmail: 'cliente@example.com',
    to: 'nicolas@ikifoods.com.ar',
    subject: 'Nueva consulta',
    html: '<p>Hola</p>',
    bccEmail: '  ',
    headers: { 'List-Unsubscribe': '<https://x>', 'X-IQ-Source': 'web' },
  }, 'notificaciones@iqkids.com.ar')));

  assert.equal(body.saveToSentItems, false);
  assert.deepEqual(body.message.from, { emailAddress: { address: 'notificaciones@iqkids.com.ar', name: 'IQ Kids Mayoristas' } });
  assert.deepEqual(body.message.toRecipients, [{ emailAddress: { address: 'nicolas@ikifoods.com.ar' } }]);
  assert.deepEqual(body.message.replyTo, [{ emailAddress: { address: 'cliente@example.com' } }]);
  assert.equal(body.message.bccRecipients, undefined);
  assert.deepEqual(body.message.internetMessageHeaders, [{ name: 'X-IQ-Source', value: 'web' }]);
  assert.deepEqual(body.message.body, { contentType: 'HTML', content: '<p>Hola</p>' });
});
