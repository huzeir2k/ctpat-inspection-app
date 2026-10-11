/**
 * Writes the form definitions the mobile app bundles (no PDF layout data) to
 * ctpat-inspection/app/models/forms.generated.json, so the app works offline
 * and never needs a second hand-written copy of the checklists.
 *
 *   npm run forms:export          write the file
 *   npm run forms:export -- --check   exit 1 if the file is out of date
 */

const fs = require('fs');
const path = require('path');
const { listForms, toPublicForm } = require('../src/forms');

const OUTPUT_FILE = path.resolve(__dirname, '../../ctpat-inspection/app/models/forms.generated.json');

const buildExport = () => `${JSON.stringify({ forms: listForms().map(toPublicForm) }, null, 2)}\n`;

if (require.main === module) {
  const expected = buildExport();

  if (process.argv.includes('--check')) {
    const actual = fs.existsSync(OUTPUT_FILE) ? fs.readFileSync(OUTPUT_FILE, 'utf8') : '';
    if (actual !== expected) {
      console.error('forms.generated.json is out of date. Run: npm run forms:export');
      process.exit(1);
    }
    console.log('forms.generated.json is up to date');
  } else {
    fs.writeFileSync(OUTPUT_FILE, expected);
    console.log(`Wrote ${OUTPUT_FILE}`);
  }
}

module.exports = { buildExport, OUTPUT_FILE };
