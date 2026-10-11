/**
 * Browser run: opens the real app (web build), signs in with an injected
 * session, and for each of the five forms picks it from the dropdown, ticks the
 * checklist, fills every sign-off field, submits, and then checks what the
 * server stored (record, PDF text) and what the history screen shows.
 *
 *   npm run build-web   (once, and after changing the app)
 *   npm test
 */
const fs = require('fs');
const os = require('os');
const path = require('path');
const assert = require('node:assert/strict');
const { execFileSync } = require('child_process');
const { chromium } = require('playwright-core');
const { WEB_PORT, SUPABASE_URL, USER_ID } = require('./config');
const { startServers } = require('./server');

const backend = path.resolve(__dirname, '../ctpat-backend');
const { listForms } = require(path.join(backend, 'src/forms'));

const SCREENSHOTS = path.join(__dirname, 'screenshots');
const APP = `http://localhost:${WEB_PORT}`;
const FREIGHT_BILL = 'FB-0012345';
const SAMPLE = { text: 'T-4821', date: '10/05/2026', time: '14:30', name: 'Maria Gonzalez' };

/** The browser to use: $CHROME_PATH, else the one playwright installed. */
const launch = () =>
  chromium.launch({ executablePath: process.env.CHROME_PATH || undefined, args: ['--no-sandbox'] });

/** supabase-js keeps its session in localStorage under sb-<host>-auth-token. */
const sessionScript = (accessToken) => {
  const key = `sb-${new URL(SUPABASE_URL).hostname.split('.')[0]}-auth-token`;
  const session = {
    access_token: accessToken,
    refresh_token: 'e2e-refresh',
    token_type: 'bearer',
    expires_in: 3600,
    expires_at: Math.floor(Date.now() / 1000) + 3600,
    user: { id: USER_ID, email: 'e2e@example.com', aud: 'authenticated', role: 'authenticated', app_metadata: {}, user_metadata: {}, created_at: new Date().toISOString() },
  };
  return `localStorage.setItem(${JSON.stringify(key)}, ${JSON.stringify(JSON.stringify(session))});`;
};

const pdfText = (buffer) => {
  const file = path.join(os.tmpdir(), `e2e-${process.pid}.pdf`);
  fs.writeFileSync(file, buffer);
  try {
    return execFileSync('pdftotext', ['-layout', file, '-'], { encoding: 'utf8' });
  } finally {
    fs.rmSync(file, { force: true });
  }
};

// ---------------------------------------------------------------------------
// Filling the form the way a person would, driven by the form definition.
// ---------------------------------------------------------------------------

const labelOf = (page, field) => page.getByText(`${field.label} *`, { exact: true });

const valueFor = (field) => {
  if (field.key === 'freightBillNumber') return FREIGHT_BILL;
  if (field.type === 'date') return SAMPLE.date;
  if (field.type === 'time') return SAMPLE.time;
  return field.key.endsWith('Name') ? SAMPLE.name : SAMPLE.text;
};

const fillField = async (page, field, selectedChoices) => {
  const label = labelOf(page, field);
  switch (field.type) {
    case 'text':
    case 'date':
    case 'time':
      await label.locator('xpath=following-sibling::input[1]').fill(valueFor(field));
      break;
    case 'boolean':
      await label.locator('xpath=following-sibling::*[1]').click();
      break;
    case 'choice': {
      const option = field.options[0]; // first option, so dependent fields (Cross-Dock direction) appear
      selectedChoices[field.key] = option.value;
      await label.locator('xpath=..').getByText(option.label, { exact: true }).click();
      break;
    }
    case 'signature': {
      const group = label.locator('xpath=..');
      await group.getByText('✍️ Add Signature').click();
      await page.getByPlaceholder('Type your signature here...').fill(SAMPLE.name);
      await page.getByText('Save Signature', { exact: true }).click();
      await group.getByText(`✓ Signed: ${SAMPLE.name}`).waitFor(); // scoped: a form has two signatures
      // Wait for the modal's slide-out to finish; input typed while it closes can be lost.
      await page.getByPlaceholder('Type your signature here...').waitFor({ state: 'detached' });
      break;
    }
    default:
      throw new Error(`Test cannot fill field type ${field.type}`);
  }
};

const isVisible = (field, chosen) => !field.showWhen || chosen[field.showWhen.field] === field.showWhen.equals;

const chooseForm = async (page, form) => {
  await page.getByLabel('Choose inspection type').click();
  await page.getByText(form.label, { exact: true }).click();
  await page.getByText(`Checklist (0/${form.checklist.length})`).waitFor();
};

const tickChecklist = async (page, form) => {
  const boxes = page.getByRole('checkbox');
  assert.equal(await boxes.count(), form.checklist.length, `${form.id}: one checkbox per checklist item`);
  for (let i = 0; i < form.checklist.length; i += 1) await boxes.nth(i).click();
  await page.getByText(`Checklist (${form.checklist.length}/${form.checklist.length})`).waitFor();
};

const fillSignoff = async (page, form) => {
  await page.getByText('Sign Off', { exact: true }).click();
  const chosen = {};
  // Re-check visibility after every choice: some fields only appear once another is answered.
  for (const field of form.fields) {
    if (!isVisible(field, chosen)) continue;
    await fillField(page, field, chosen);
  }
  return chosen;
};

const submit = async (page) => {
  const responsePromise = page.waitForResponse((r) => r.url().endsWith('/api/inspections') && r.request().method() === 'POST');
  await page.getByText('Submit Inspection', { exact: true }).click();
  return responsePromise;
};

// ---------------------------------------------------------------------------

const run = async () => {
  fs.mkdirSync(SCREENSHOTS, { recursive: true });
  const servers = await startServers();
  const browser = await launch();
  const problems = [];
  let failed = false;

  try {
    const context = await browser.newContext({ viewport: { width: 430, height: 932 } });
    await context.addInitScript(sessionScript(servers.accessToken));
    const page = await context.newPage();
    page.on('pageerror', (error) => problems.push(`pageerror: ${error.message}`));
    page.on('console', (m) => m.type() === 'error' && problems.push(`console: ${m.text()}`));

    for (const form of listForms()) {
      await page.goto(APP);
      await page.getByText('Start Inspection', { exact: true }).click();
      await chooseForm(page, form);
      await tickChecklist(page, form);
      await page.screenshot({ path: path.join(SCREENSHOTS, `${form.id}-checklist.png`), fullPage: true });

      // Required-field check: submitting without a freight bill must not reach the server.
      await fillSignoff(page, form);
      const freightInput = labelOf(page, form.fields.find((f) => f.key === 'freightBillNumber')).locator('xpath=following-sibling::input[1]');
      await freightInput.fill('');
      let reachedServer = false;
      const watch = (request) => request.method() === 'POST' && request.url().endsWith('/api/inspections') && (reachedServer = true);
      page.on('request', watch);
      await page.getByText('Submit Inspection', { exact: true }).click();
      await page.waitForTimeout(400);
      page.off('request', watch);
      assert.equal(reachedServer, false, `${form.id}: blank freight bill must be stopped by the app`);

      await freightInput.fill(FREIGHT_BILL);
      await page.screenshot({ path: path.join(SCREENSHOTS, `${form.id}-signoff.png`), fullPage: true });
      const response = await submit(page);
      assert.equal(response.status(), 201, `${form.id}: server accepted the submission (${await response.text()})`);

      const record = servers.Inspection.store.at(-1);
      assert.equal(record.formId, form.id);
      assert.equal(record.createdBy, USER_ID);
      assert.equal(record.values.freightBillNumber, FREIGHT_BILL);
      assert.ok(record.checklist.every((item) => item.checked), `${form.id}: every checklist item stored as checked`);
      assert.equal(record.checklist.length, form.checklist.length);

      const printed = pdfText(await servers.storage.read(record.pdfStoragePath));
      assert.match(printed, new RegExp(`Freight Bill #:\\s*${FREIGHT_BILL}`), `${form.id}: freight bill printed on the PDF`);
      console.log(`ok  ${form.id}: ${form.checklist.length} checklist items, PDF contains freight bill`);
    }

    // History screen reads from the real API.
    await page.goto(`${APP}/history`);
    await page.getByText(`Freight Bill:`).first().waitFor();
    assert.equal(await page.getByText(FREIGHT_BILL).count(), listForms().length, 'history lists every submission with its freight bill');
    await page.screenshot({ path: path.join(SCREENSHOTS, 'history.png'), fullPage: true });
    console.log('ok  history shows all five inspections with their freight bill numbers');
  } catch (error) {
    failed = true;
    console.error('FAILED:', error.message);
  } finally {
    await browser.close();
    await servers.close();
  }

  if (problems.length) console.log(`\nBrowser errors seen (${problems.length}):\n${[...new Set(problems)].map((p) => `  ${p}`).join('\n')}`);
  process.exit(failed ? 1 : 0);
};

run();
