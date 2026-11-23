const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const ts = require('typescript');

function load(file) {
  const exports = {};
  const source = fs.readFileSync(path.join(__dirname, '..', file), 'utf8');
  vm.runInNewContext(ts.transpileModule(source, {
    compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.CommonJS },
  }).outputText, { exports, Error, Date, Map, Set, Math, Number, String, require() { throw new Error('no imports'); } });
  return exports;
}

const bd = load('src/features/logistics/business-days.ts');
const none = { extraHolidays: new Set() };
const rules = { cutoffHour: 13, cutoffMinute: 0, preparationBusinessDays: 0 };
// 10:00 en Argentina = 13:00 UTC
const ar = (key, hh, mm = 0) => new Date(`${key}T${String(hh + 3).padStart(2, '0')}:${String(mm).padStart(2, '0')}:00Z`);

test('Pascua y feriados móviles 2026', () => {
  assert.equal(bd.easterSunday(2026), '2026-04-05');
  assert.equal(bd.easterSunday(2027), '2027-03-28');
  const h = bd.nationalHolidays(2026);
  assert.ok(h.has('2026-02-16') && h.has('2026-02-17'), 'carnaval');
  assert.ok(h.has('2026-04-03'), 'viernes santo');
  assert.ok(h.has('2026-06-15'), 'Güemes miércoles 17 pasa al lunes 15');
  assert.ok(h.has('2026-11-23'), 'Soberanía viernes 20 pasa al lunes 23');
  assert.ok(!h.has('2026-11-20'));
});

test('antes del corte sale el mismo día hábil', () => {
  assert.equal(bd.computeDispatchDate(ar('2026-11-24', 10), rules, none), '2026-11-24');
});

test('después del corte sale el día hábil siguiente', () => {
  assert.equal(bd.computeDispatchDate(ar('2026-11-24', 13, 0), rules, none), '2026-11-25');
});

test('viernes a la tarde sale el lunes; sábado y domingo también', () => {
  assert.equal(bd.computeDispatchDate(ar('2026-11-27', 15), rules, none), '2026-11-30');
  assert.equal(bd.computeDispatchDate(ar('2026-11-28', 9), rules, none), '2026-11-30');
  assert.equal(bd.computeDispatchDate(ar('2026-11-29', 9), rules, none), '2026-11-30');
});

test('salta feriados nacionales y los cargados en el admin', () => {
  // viernes 20/11 a la tarde: lunes 23 es feriado trasladado -> martes 24
  assert.equal(bd.computeDispatchDate(ar('2026-11-20', 16), rules, none), '2026-11-24');
  const extra = { extraHolidays: new Set(['2026-11-24']) };
  assert.equal(bd.computeDispatchDate(ar('2026-11-20', 16), rules, extra), '2026-11-25');
});

test('días de preparación', () => {
  assert.equal(bd.computeDispatchDate(ar('2026-11-24', 10), { ...rules, preparationBusinessDays: 2 }, none), '2026-11-26');
  assert.equal(bd.computeDispatchDate(ar('2026-11-26', 15), { ...rules, preparationBusinessDays: 1 }, none), '2026-11-30');
});

test('hora Argentina: 01:00 UTC del martes sigue siendo lunes en Argentina', () => {
  assert.equal(bd.toArgentinaDateKey(new Date('2026-11-25T01:00:00Z')), '2026-11-24');
});

test('formato para el cliente', () => {
  assert.equal(bd.formatDispatchDate('2026-11-26'), 'jueves 26/11');
});
