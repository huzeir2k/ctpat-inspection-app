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

test('signatures may be PNG/JPEG images or typed text, and nothing else', () => {
  const form = getForm('flatbed-6');
  const withSignature = (signature) => {
    const body = fresh(form.id);
    body.values.inspectorSignature = signature;
    return body;
  };
  const accepted = (signature) => assert.doesNotThrow(() => validateSubmission(form, withSignature(signature)));
  const rejected = (signature) => assert.ok(messagesOf(() => validateSubmission(form, withSignature(signature))), JSON.stringify(signature).slice(0, 60));

  accepted({ type: 'image', data: sampleSignaturePng() });
  accepted({ type: 'image', data: Buffer.from([0xff, 0xd8, 0xff, 0xe0, 0, 16, 0x4a, 0x46, 0x49, 0x46, 0, 1]).toString('base64') });
  accepted({ type: 'typed', text: 'Nandu Peña' });

  rejected(sampleSignaturePng()); // a bare string is no longer a signature
  rejected({ type: 'image', data: Buffer.from('<svg></svg> not an image at all').toString('base64') });
  rejected({ type: 'image', data: 'A'.repeat(600004) });
  rejected({ type: 'image', text: 'Jane' });
  rejected({ type: 'typed', data: sampleSignaturePng() });
  rejected({ type: 'typed', text: '😀' });
  rejected({ type: 'typed', text: 'x'.repeat(41) });
  rejected({ type: 'scribble', data: 'x' });
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

test('every form requires a freight bill number', () => {
  for (const form of listForms()) {
    const body = fresh(form.id);
    delete body.values.freightBillNumber;
    const messages = messagesOf(() => validateSubmission(form, body));
    assert.ok(messages?.some((m) => m.includes('Freight Bill Number')), form.id);
  }
});

test('the freight bill number only accepts letters, digits, space and . _ / -', () => {
  const form = getForm('flatbed-6');
  for (const good of ['FB-0012345', 'a/b_c.d 9']) {
    const body = fresh(form.id);
    body.values.freightBillNumber = good;
    assert.doesNotThrow(() => validateSubmission(form, body), good);
  }
  for (const bad of ['FB#1', 'FB;DROP', 'x'.repeat(31), '   ', '日本']) {
    const body = fresh(form.id);
    body.values.freightBillNumber = bad;
    assert.ok(messagesOf(() => validateSubmission(form, body)), `rejects "${bad}"`);
  }
});
