const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');
const { listForms, getForm, toPublicForm } = require('../src/forms');
const { buildExport, OUTPUT_FILE } = require('../scripts/export-forms');

test('the five CTPAT forms are registered with the expected checklist sizes', () => {
  const sizes = Object.fromEntries(listForms().map((f) => [f.id, f.checklist.length]));
  assert.deepEqual(sizes, {
    'truck-trailer-17-18': 18,
    'container-7-8': 8,
    'straight-truck-7-8': 8,
    'cargo-van-7-8': 8,
    'flatbed-6': 6,
  });
});

test('every form has a template file, a unique id and a primary identifier field', () => {
  const ids = new Set();
  for (const form of listForms()) {
    assert.ok(!ids.has(form.id), `duplicate form id ${form.id}`);
    ids.add(form.id);
    assert.ok(fs.existsSync(path.join(__dirname, '../assets/forms', form.template)), `${form.template} missing`);
    assert.ok(form.fields.some((f) => f.key === form.primaryIdKey && f.type === 'text'), `${form.id} primaryIdKey`);
  }
});

test('forms share the same sign-off fields', () => {
  for (const form of listForms()) {
    const keys = form.fields.map((f) => f.key);
    for (const shared of ['securityPassed', 'agriculturalPassed', 'date', 'time', 'printName', 'inspectorSignature']) {
      assert.ok(keys.includes(shared), `${form.id} is missing ${shared}`);
    }
  }
});

test('the flatbed form has no seal or VVTT; the others do', () => {
  const keysOf = (id) => getForm(id).fields.map((f) => f.key);
  assert.ok(!keysOf('flatbed-6').includes('sealNumber'));
  assert.ok(!keysOf('flatbed-6').includes('vvtt'));
  for (const id of ['container-7-8', 'straight-truck-7-8', 'cargo-van-7-8', 'truck-trailer-17-18']) {
    assert.ok(keysOf(id).includes('sealNumber') && keysOf(id).includes('vvtt'), id);
  }
});

test('only container and truck/trailer forms have Cross-Dock', () => {
  const withCrossDock = listForms().filter((f) => f.fields.some((x) => x.key === 'crossDock')).map((f) => f.id);
  assert.deepEqual(withCrossDock.sort(), ['container-7-8', 'truck-trailer-17-18']);
});

test('public form data never includes PDF layout', () => {
  for (const form of listForms()) {
    const publicForm = toPublicForm(form);
    assert.equal(publicForm.layout, undefined);
    assert.equal(publicForm.template, undefined);
  }
});

test('the app bundle forms.generated.json is up to date (run: npm run forms:export)', (t) => {
  if (!fs.existsSync(path.dirname(OUTPUT_FILE))) return t.skip('frontend folder not present');
  assert.equal(fs.readFileSync(OUTPUT_FILE, 'utf8'), buildExport());
});
