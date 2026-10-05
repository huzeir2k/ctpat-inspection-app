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
