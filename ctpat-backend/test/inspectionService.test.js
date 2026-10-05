const test = require('node:test');
const assert = require('node:assert/strict');
const { getForm } = require('../src/forms');
const PdfFillerService = require('../src/services/PdfFillerService');
const { createInspectionService } = require('../src/services/InspectionService');
const { sampleSubmission } = require('../scripts/sampleData');
const { createFakeInspectionModel, createFakeStorage } = require('./helpers/fakes');

const ALICE = 'aaaaaaaa-0000-4000-8000-000000000001';
const BOB = 'bbbbbbbb-0000-4000-8000-000000000002';

const setup = (overrides = {}) => {
  const Inspection = createFakeInspectionModel();
  const storage = createFakeStorage();
  const sent = [];
  const emailer = { sendInspectionReport: async (args) => { sent.push(args); return { messageId: 'm1', recipient: args.to }; } };
  const service = createInspectionService({
    Inspection,
    storage,
    pdfFiller: PdfFillerService,
    emailer,
    getForm,
    logger: { error() {} },
    ...overrides,
  });
  return { service, Inspection, storage, sent };
};

const body = (formId = 'container-7-8') => sampleSubmission(getForm(formId));

test('create renders a PDF, stores it privately and saves the record', async () => {
  const { service, Inspection, storage } = setup();
  const { inspection, isDuplicate } = await service.create(ALICE, body());

  assert.equal(isDuplicate, false);
  assert.equal(inspection.createdBy, ALICE);
  assert.equal(inspection.formId, 'container-7-8');
  assert.equal(inspection.summaryId, 'MSKU1234567');
  assert.equal(inspection.checklist.length, 8);
  assert.equal(inspection.values.printName, 'Nandu Peña');
  assert.equal(inspection.values.inspectorSignature, undefined, 'signatures are not stored with the answers');
  assert.ok(inspection.signatures.inspectorSignature);

  assert.ok(inspection.pdfStoragePath.startsWith(`inspections/${ALICE}/`));
  assert.equal(storage.files.get(inspection.pdfStoragePath).subarray(0, 5).toString(), '%PDF-');
  assert.equal(Inspection.store.length, 1);
});

test('forms without a vehicle number are identified by their seal number', async () => {
  const { service } = setup();
  const { inspection } = await service.create(ALICE, body('cargo-van-7-8'));
  assert.equal(inspection.summaryId, 'SL-7788123');
});

test('invalid submissions are rejected before anything is stored', async () => {
  const { service, storage, Inspection } = setup();
  const bad = body();
  bad.values.sealNumber = '';
  await assert.rejects(service.create(ALICE, bad), { statusCode: 400 });
  await assert.rejects(service.create(ALICE, { ...body(), formId: 'nope' }), { statusCode: 400 });
  await assert.rejects(service.create(ALICE, undefined), { statusCode: 400 });
  assert.equal(storage.files.size, 0);
  assert.equal(Inspection.store.length, 0);
});

test('the same idempotency key returns the original record', async () => {
  const { service, Inspection } = setup();
  const first = await service.create(ALICE, body(), 'key-12345678');
  const second = await service.create(ALICE, body(), 'key-12345678');

  assert.equal(second.isDuplicate, true);
  assert.equal(second.inspection.inspectionId, first.inspection.inspectionId);
  assert.equal(Inspection.store.length, 1);
});

test('idempotency keys are private to each user', async () => {
  const { service, Inspection } = setup();
  await service.create(ALICE, body(), 'shared-key-1');
  const bobs = await service.create(BOB, body(), 'shared-key-1');
  assert.equal(bobs.isDuplicate, false);
  assert.equal(Inspection.store.length, 2);
});

test('a failed database save removes the stored PDF', async () => {
  const { service, storage, Inspection } = setup();
  Inspection.create = async () => { throw new Error('db down'); };
  await assert.rejects(service.create(ALICE, body()), /db down/);
  assert.equal(storage.files.size, 0);
});

test('a storage failure stops the save', async () => {
  const { service, storage, Inspection } = setup();
  storage.failNextSave = true;
  await assert.rejects(service.create(ALICE, body()), /storage down/);
  assert.equal(Inspection.store.length, 0);
});

test('users only ever see their own inspections', async () => {
  const { service } = setup();
  const alices = (await service.create(ALICE, body())).inspection;
  await service.create(BOB, body('flatbed-6'));

  const list = await service.list(ALICE, { page: 1, limit: 20 });
  assert.equal(list.pagination.total, 1);
  assert.equal(list.inspections[0].inspectionId, alices.inspectionId);
  assert.equal(list.inspections[0].signatures, undefined);

  await assert.rejects(service.get(BOB, alices.inspectionId), { statusCode: 404 });
  await assert.rejects(service.getPdf(BOB, alices.inspectionId), { statusCode: 404 });
  await assert.rejects(service.remove(BOB, alices.inspectionId), { statusCode: 404 });
  await assert.rejects(service.sendEmail(BOB, alices.inspectionId, 'a@b.com'), { statusCode: 404 });
  assert.equal((await service.stats(BOB)).total, 1);
  assert.equal((await service.stats(ALICE)).total, 1);

  assert.ok(await service.get(ALICE, alices.inspectionId));
});

test('list can be filtered by form and paginated', async () => {
  const { service } = setup();
  await service.create(ALICE, body('container-7-8'));
  await service.create(ALICE, body('flatbed-6'));
  await service.create(ALICE, body('flatbed-6'));

  assert.equal((await service.list(ALICE, { page: 1, limit: 20, formId: 'flatbed-6' })).pagination.total, 2);
  const page2 = await service.list(ALICE, { page: 2, limit: 2 });
  assert.equal(page2.inspections.length, 1);
  assert.equal(page2.pagination.pages, 2);
});

test('remove deletes the record and its PDF', async () => {
  const { service, storage, Inspection } = setup();
  const { inspection } = await service.create(ALICE, body());
  await service.remove(ALICE, inspection.inspectionId);
  assert.equal(Inspection.store.length, 0);
  assert.equal(storage.files.size, 0);
});

test('email sends the stored PDF to the recipient and is audited', async () => {
  const { service, sent, Inspection } = setup();
  const { inspection } = await service.create(ALICE, body());
  await service.sendEmail(ALICE, inspection.inspectionId, 'dispatch@example.com');

  assert.equal(sent.length, 1);
  assert.equal(sent[0].to, 'dispatch@example.com');
  assert.equal(sent[0].pdf.subarray(0, 5).toString(), '%PDF-');
  assert.equal(Inspection.store[0].auditLog.at(-1).action, 'emailed');
});

test('email honours the allowed-domain list', async () => {
  const { service, sent } = setup({ allowedEmailDomains: ['company.com'] });
  const { inspection } = await service.create(ALICE, body());

  await assert.rejects(service.sendEmail(ALICE, inspection.inspectionId, 'x@evil.com'), { statusCode: 403 });
  await service.sendEmail(ALICE, inspection.inspectionId, 'x@company.com');
  assert.equal(sent.length, 1);
});

test('an email failure is reported without internal details', async () => {
  const emailer = { sendInspectionReport: async () => { throw new Error('smtp password wrong for host x'); } };
  const { service } = setup({ emailer });
  const { inspection } = await service.create(ALICE, body());
  await assert.rejects(service.sendEmail(ALICE, inspection.inspectionId, 'a@b.com'), (error) => {
    assert.equal(error.statusCode, 502);
    assert.ok(!/password|host/.test(error.message));
    return true;
  });
});

test('preview accepts partial data and stores nothing', async () => {
  const { service, storage, Inspection } = setup();
  const pdf = await service.preview({ formId: 'flatbed-6', templateVersion: 1, checklist: { 'deck-floor': true }, values: {} });
  assert.equal(pdf.subarray(0, 5).toString(), '%PDF-');
  assert.equal(storage.files.size + Inspection.store.length, 0);
});
