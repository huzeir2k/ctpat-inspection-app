const test = require('node:test');
const assert = require('node:assert/strict');
const { listForms, getForm } = require('../src/forms');
const { validateSubmission } = require('../src/validators/submissionValidator');
const { sampleSubmission, sampleSignaturePng } = require('../scripts/sampleData');

const fresh = (formId) => structuredClone(sampleSubmission(getForm(formId)));
const messagesOf = (fn) => {
  try {
    fn();
  } catch (error) {
    return error.details || [error.message];
  }
  return null;
};

test('a complete sample submission is accepted for every form', () => {
  for (const form of listForms()) {
    assert.doesNotThrow(() => validateSubmission(form, sampleSubmission(form)), form.id);
  }
});

test('every checklist item and "Passed" check must be ticked', () => {
  const form = getForm('container-7-8');
  const body = fresh(form.id);
  body.checklist.floor = false;
  body.values.securityPassed = false;
  const problems = messagesOf(() => validateSubmission(form, body));
  assert.equal(problems.length, 2);
});

test('unknown checklist items and fields are rejected', () => {
  const form = getForm('flatbed-6');
  const body = fresh(form.id);
  body.checklist.extraItem = true;
  body.values.sealNumber = 'S-1'; // flatbed has no seal
  const problems = messagesOf(() => validateSubmission(form, body));
  assert.equal(problems.length, 2);
});

test('Cross-Dock direction is required only when Cross-Dock is "yes"', () => {
  const form = getForm('container-7-8');

  const yesWithoutDirection = fresh(form.id);
  delete yesWithoutDirection.values.crossDockDirection;
  assert.ok(messagesOf(() => validateSubmission(form, yesWithoutDirection)));

  const noWithDirection = fresh(form.id);
  noWithDirection.values.crossDock = 'no';
  assert.ok(messagesOf(() => validateSubmission(form, noWithDirection)));

  delete noWithDirection.values.crossDockDirection;
  assert.doesNotThrow(() => validateSubmission(form, noWithDirection));
});

test('VVTT accepts "passed" or "na_domestic" only', () => {
  const form = getForm('cargo-van-7-8');
  const body = fresh(form.id);
  body.values.vvtt = 'na_domestic';
  assert.doesNotThrow(() => validateSubmission(form, body));
  body.values.vvtt = 'both';
  assert.ok(messagesOf(() => validateSubmission(form, body)));
});

test('text is limited in length and to printable Latin-1 characters', () => {
  const form = getForm('container-7-8');
  const tooLong = 'x'.repeat(21);
  for (const bad of [tooLong, '😀', 'line\nbreak', '\u0000']) {
    const body = fresh(form.id);
    body.values.containerNumber = bad;
    assert.ok(messagesOf(() => validateSubmission(form, body)), JSON.stringify(bad));
  }
  const accented = fresh(form.id);
  accented.values.printName = 'José Núñez';
  assert.doesNotThrow(() => validateSubmission(form, accented));
});

test('dates and times must be real and correctly formatted', () => {
  const form = getForm('flatbed-6');
  for (const [key, bad] of [['date', '02/30/2026'], ['date', '2026-10-05'], ['time', '25:00'], ['time', '2:30 PM']]) {
    const body = fresh(form.id);
    body.values[key] = bad;
    assert.ok(messagesOf(() => validateSubmission(form, body)), `${key}=${bad}`);
  }
});

test('signatures must be PNG images of limited size', () => {
  const form = getForm('flatbed-6');

  const notPng = fresh(form.id);
  notPng.values.inspectorSignature = Buffer.from('<svg></svg> not a png at all').toString('base64');
  assert.ok(messagesOf(() => validateSubmission(form, notPng)));

  const huge = fresh(form.id);
  huge.values.inspectorSignature = 'A'.repeat(200004);
  assert.ok(messagesOf(() => validateSubmission(form, huge)));

  const fine = fresh(form.id);
  fine.values.inspectorSignature = sampleSignaturePng();
  assert.doesNotThrow(() => validateSubmission(form, fine));
});

test('a template version mismatch asks the user to update the app', () => {
  const form = getForm('flatbed-6');
  const body = fresh(form.id);
  body.templateVersion = 99;
  assert.match(messagesOf(() => validateSubmission(form, body)).join(), /update the app/i);
});

test('booleans must be real booleans, not strings', () => {
  const form = getForm('flatbed-6');
  const body = fresh(form.id);
  body.values.securityPassed = 'true';
  assert.ok(messagesOf(() => validateSubmission(form, body)));
});

test('a partial preview is accepted when complete=false, but still rejects bad data', () => {
  const form = getForm('container-7-8');
  const partial = { formId: form.id, templateVersion: form.version, checklist: { floor: true }, values: { sealNumber: 'S-1' } };
  assert.doesNotThrow(() => validateSubmission(form, partial, { complete: false }));
  assert.ok(messagesOf(() => validateSubmission(form, partial)), 'strict mode still requires everything');

  partial.checklist.notAnItem = true;
  assert.ok(messagesOf(() => validateSubmission(form, partial, { complete: false })));
});

test('error messages do not echo submitted values', () => {
  const form = getForm('container-7-8');
  const body = fresh(form.id);
  body.values.containerNumber = 'SECRET😀VALUE';
  assert.ok(!messagesOf(() => validateSubmission(form, body)).join().includes('SECRET'));
});
