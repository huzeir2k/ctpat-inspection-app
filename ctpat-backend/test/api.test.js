const test = require('node:test');
const assert = require('node:assert/strict');

process.env.SUPABASE_JWT_SECRET = 'test-secret-test-secret-test-secret';
process.env.NODE_ENV = 'test';

const jwt = require('jsonwebtoken');
const { createApp } = require('../src/app');
const { getForm } = require('../src/forms');
const PdfFillerService = require('../src/services/PdfFillerService');
const { createInspectionService } = require('../src/services/InspectionService');
const { sampleSubmission } = require('../scripts/sampleData');
const { createFakeInspectionModel, createFakeStorage } = require('./helpers/fakes');

const tokenFor = (sub) => jwt.sign({ sub, email: `${sub}@example.com` }, process.env.SUPABASE_JWT_SECRET, { algorithm: 'HS256' });
const ALICE = tokenFor('aaaaaaaa-0000-4000-8000-000000000001');
const BOB = tokenFor('bbbbbbbb-0000-4000-8000-000000000002');

const startServer = async () => {
  const service = createInspectionService({
    Inspection: createFakeInspectionModel(),
    storage: createFakeStorage(),
    pdfFiller: PdfFillerService,
    emailer: { sendInspectionReport: async ({ to }) => ({ messageId: 'm', recipient: to }) },
    getForm,
    logger: { error() {} },
  });
  const server = createApp({ inspectionService: service }).listen(0);
  const baseUrl = `http://127.0.0.1:${server.address().port}`;

  const call = (method, path, { token, body, headers } = {}) =>
    fetch(baseUrl + path, {
      method,
      headers: { ...(token && { Authorization: `Bearer ${token}` }), ...(body && { 'Content-Type': 'application/json' }), ...headers },
      body: body && JSON.stringify(body),
    });

  return { call, close: () => server.close() };
};

test('API', async (t) => {
  const { call, close } = await startServer();
  t.after(close);
  const submission = sampleSubmission(getForm('truck-trailer-17-18'));
  let inspectionId;

  await t.test('health is public; /api requires a valid token', async () => {
    assert.equal((await call('GET', '/health')).status, 200);
    assert.equal((await call('GET', '/api/inspections')).status, 401);
    assert.equal((await call('GET', '/api/inspections', { token: 'garbage' })).status, 401);
    const forged = jwt.sign({ sub: 'x' }, 'another-secret-another-secret-123456', { algorithm: 'HS256' });
    assert.equal((await call('GET', '/api/inspections', { token: forged })).status, 401);
  });

  await t.test('creating an inspection returns a summary without signatures', async () => {
    const response = await call('POST', '/api/inspections', { token: ALICE, body: submission });
    assert.equal(response.status, 201);
    const { data } = await response.json();
    inspectionId = data.inspectionId;
    assert.equal(data.formId, 'truck-trailer-17-18');
    assert.equal(data.summaryId, 'T-4821 / TR-90713');
    assert.equal(JSON.stringify(data).includes('Signature'), false);
  });

  await t.test('invalid submissions get a 400 with details', async () => {
    const bad = structuredClone(submission);
    bad.values.sealNumber = '';
    const response = await call('POST', '/api/inspections', { token: ALICE, body: bad });
    assert.equal(response.status, 400);
    assert.ok((await response.json()).error.details.length > 0);
  });

  await t.test('a malformed Idempotency-Key is rejected', async () => {
    const response = await call('POST', '/api/inspections', { token: ALICE, body: submission, headers: { 'Idempotency-Key': 'bad key!' } });
    assert.equal(response.status, 400);
  });

  await t.test('the owner can read details and download the PDF', async () => {
    const detail = await (await call('GET', `/api/inspections/${inspectionId}`, { token: ALICE })).json();
    assert.equal(detail.data.checklist.length, 18);
    assert.equal(detail.data.signatures, undefined);
    assert.equal(JSON.stringify(detail).includes('iVBOR'), false, 'no signature image data');

    const pdf = await call('GET', `/api/inspections/${inspectionId}/pdf`, { token: ALICE });
    assert.equal(pdf.status, 200);
    assert.equal(pdf.headers.get('content-type'), 'application/pdf');
    assert.match(pdf.headers.get('content-disposition'), /^inline; filename="CTPAT_[A-Za-z0-9._-]+\.pdf"$/);
    const bytes = Buffer.from(await pdf.arrayBuffer());
    assert.equal(bytes.subarray(0, 5).toString(), '%PDF-');
  });

  await t.test("another user cannot read, download, email or delete the owner's inspection", async () => {
    for (const [method, suffix, body] of [['GET', ''], ['GET', '/pdf'], ['POST', '/send-email', { recipientEmail: 'a@b.com' }], ['DELETE', '']]) {
      const response = await call(method, `/api/inspections/${inspectionId}${suffix}`, { token: BOB, body });
      assert.equal(response.status, 404, `${method} ${suffix}`);
    }
    const list = await (await call('GET', '/api/inspections', { token: BOB })).json();
    assert.equal(list.data.pagination.total, 0);
  });

  await t.test('ids that are not UUIDs are "not found"', async () => {
    assert.equal((await call('GET', '/api/inspections/not-a-uuid', { token: ALICE })).status, 404);
    assert.equal((await call('GET', '/api/inspections/..%2F..%2Fetc', { token: ALICE })).status, 404);
  });

  await t.test('list rejects unknown forms and oversize pages', async () => {
    assert.equal((await call('GET', '/api/inspections?formId=bogus', { token: ALICE })).status, 400);
    assert.equal((await call('GET', '/api/inspections?limit=1000', { token: ALICE })).status, 400);
    assert.equal((await call('GET', '/api/inspections?formId=truck-trailer-17-18', { token: ALICE })).status, 200);
  });

  await t.test('email needs a valid recipient and uses the stored PDF', async () => {
    assert.equal((await call('POST', `/api/inspections/${inspectionId}/send-email`, { token: ALICE, body: { recipientEmail: 'nope' } })).status, 400);
    const ok = await call('POST', `/api/inspections/${inspectionId}/send-email`, { token: ALICE, body: { recipientEmail: 'Dispatch@Example.com' } });
    assert.equal(ok.status, 200);
    assert.equal((await ok.json()).data.recipient, 'dispatch@example.com');
  });

  await t.test('a client cannot supply SMTP settings', async () => {
    const response = await call('POST', `/api/inspections/${inspectionId}/send-email`, {
      token: ALICE,
      body: { recipientEmail: 'a@b.com', smtpConfig: { host: 'internal.example', port: 25 } },
    });
    assert.equal(response.status, 400);
  });

  await t.test('preview returns a PDF for partial data', async () => {
    const response = await call('POST', '/api/inspections/preview', {
      token: ALICE,
      body: { formId: 'flatbed-6', templateVersion: 1, checklist: {}, values: { unitNumber: 'FB-1' } },
    });
    assert.equal(response.status, 200);
    assert.equal(response.headers.get('content-type'), 'application/pdf');
  });

  await t.test('request bodies over 1 MB are refused', async () => {
    const response = await call('POST', '/api/inspections', { token: ALICE, body: { padding: 'x'.repeat(1100000) } });
    assert.equal(response.status, 413);
  });

  await t.test('the old unauthenticated PDF routes are gone', async () => {
    assert.equal((await call('POST', '/api/inspections/generate-pdf', { body: {} })).status, 401);
    assert.equal((await call('POST', '/api/inspections/generate-pdf', { token: ALICE, body: {} })).status, 404);
  });

  await t.test('owner can delete', async () => {
    assert.equal((await call('DELETE', `/api/inspections/${inspectionId}`, { token: ALICE })).status, 200);
    assert.equal((await call('GET', `/api/inspections/${inspectionId}`, { token: ALICE })).status, 404);
  });
});
