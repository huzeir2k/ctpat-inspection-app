/**
 * Fills every form with sample data and writes the PDFs to ./preview-output
 * (git-ignored) so the layout can be checked by eye:
 *
 *   npm run forms:preview
 *
 * If poppler's `pdftoppm` is installed, a PNG of each form is rendered too.
 */

const fs = require('fs');
const path = require('path');
const { execFileSync } = require('child_process');
const { listForms } = require('../src/forms');
const { validateSubmission } = require('../src/validators/submissionValidator');
const PdfFillerService = require('../src/services/PdfFillerService');
const { sampleSubmission } = require('./sampleData');

const OUTPUT_DIR = path.join(__dirname, '../preview-output');

const main = async () => {
  fs.mkdirSync(OUTPUT_DIR, { recursive: true });

  for (const form of listForms()) {
    // Variant 0 selects every first option, variant 1 every second option.
    for (const optionIndex of [0, 1]) {
      const name = optionIndex === 0 ? form.id : `${form.id}.alt`;
      const submission = sampleSubmission(form, { optionIndex });
      const pdf = await PdfFillerService.generate(form, validateSubmission(form, submission));
      const pdfPath = path.join(OUTPUT_DIR, `${name}.pdf`);
      fs.writeFileSync(pdfPath, pdf);
      console.log(`Wrote ${pdfPath}`);

      try {
        execFileSync('pdftoppm', ['-png', '-r', '110', '-singlefile', pdfPath, path.join(OUTPUT_DIR, name)]);
      } catch {
        console.log('  (pdftoppm not available - skipped PNG)');
      }
    }
  }
};

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
