const test = require('node:test');
const assert = require('node:assert/strict');
const { PDFDocument } = require('pdf-lib');
const { listForms } = require('../src/forms');
const { validateSubmission } = require('../src/validators/submissionValidator');
const PdfFillerService = require('../src/services/PdfFillerService');
const { sampleSubmission } = require('../scripts/sampleData');

const render = (form, options) => PdfFillerService.generate(form, validateSubmission(form, sampleSubmission(form, options)));

// Checks the structure strict readers (such as Foxit) care about.
const assertStrictPdfStructure = (buffer) => {
  const text = buffer.toString('latin1');
  assert.match(text, /^%PDF-1\.\d/);
  assert.match(text.trimEnd(), /%%EOF$/);
  assert.ok(!text.includes('/ObjStm'), 'object streams are avoided');
  assert.ok(!/\/Type\s*\/XRef/.test(text), 'a classic xref table is used');

  const startxref = Number(/startxref\s+(\d+)\s+%%EOF\s*$/.exec(text)[1]);
  assert.equal(text.slice(startxref, startxref + 4), 'xref', 'startxref points at the xref table');
};

test('every form renders to a valid single-page PDF', async () => {
  for (const form of listForms()) {
    for (const optionIndex of [0, 1]) {
      const pdf = await render(form, { optionIndex });
      assertStrictPdfStructure(pdf);

      const reloaded = await PDFDocument.load(pdf, { throwOnInvalidObject: true });
      assert.equal(reloaded.getPageCount(), 1, form.id);
      assert.deepEqual(
        [reloaded.getPage(0).getWidth(), reloaded.getPage(0).getHeight()],
        [612, 792],
        `${form.id} keeps the template page size`
      );
    }
  }
});

test('filling a form adds content to the template', async () => {
  const form = listForms()[0];
  const filled = await render(form);
  const blank = require('fs').readFileSync(require('path').join(__dirname, '../assets/forms', form.template));
  assert.ok(filled.length > blank.length * 0.9);
  assert.notDeepEqual(filled, blank);
});

test('long text is shrunk to fit instead of failing', async () => {
  const form = listForms().find((f) => f.id === 'container-7-8');
  const submission = sampleSubmission(form);
  submission.values.containerNumber = 'W'.repeat(20);
  await assert.doesNotReject(PdfFillerService.generate(form, validateSubmission(form, submission)));
});

const TINY_JPEG = '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';

test('JPEG and typed signatures are drawn; unreadable images give a clear 400', async () => {
  const form = listForms().find((f) => f.id === 'flatbed-6');
  const withSignature = (signature) => {
    const submission = sampleSubmission(form);
    submission.values.inspectorSignature = signature;
    return PdfFillerService.generate(form, validateSubmission(form, submission));
  };

  assertStrictPdfStructure(await withSignature({ type: 'image', data: TINY_JPEG }));
  assertStrictPdfStructure(await withSignature({ type: 'typed', text: 'Nandu Peña' }));

  // Has PNG magic bytes but is not a decodable PNG.
  const brokenPng = Buffer.concat([Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]), Buffer.from('garbage-garbage')]);
  await assert.rejects(withSignature({ type: 'image', data: brokenPng.toString('base64') }), { statusCode: 400 });
});

test('the freight bill number is printed on every form', async () => {
  const { execFileSync } = require('node:child_process');
  const fs = require('node:fs');
  const os = require('node:os');
  const path = require('node:path');

  for (const form of listForms()) {
    const file = path.join(os.tmpdir(), `freight-${form.id}-${process.pid}.pdf`);
    fs.writeFileSync(file, await render(form));
    try {
      const printed = execFileSync('pdftotext', ['-layout', file, '-'], { encoding: 'utf8' });
      assert.match(printed, /Freight Bill #:\s*FB-0012345/, form.id);
    } finally {
      fs.rmSync(file, { force: true });
    }
  }
});
