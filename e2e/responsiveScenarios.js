/**
 * Layout checks across window sizes, from the smallest phone to an unfolded foldable.
 *
 * Sizes are in CSS pixels, which the app treats as density-independent points, so they
 * are the sizes that matter (not the screens' physical pixel counts).
 *
 * For every screen at every size it checks that:
 *   - nothing sticks out past the window edge (no sideways scrolling);
 *   - every button, tab and checkbox is at least 44 points tall and wide.
 * And it checks the wide-window layout: centred content, and checklist and sign-off
 * shown side by side instead of tabs, without losing anything typed when the window resizes.
 *
 * It cannot check what only a phone has: safe areas, the on-screen keyboard, and the
 * system's larger-text setting.
 */
const fs = require('fs');
const path = require('path');
const assert = require('node:assert/strict');
const { WEB_PORT } = require('./config');
const { sessionScript } = require('./session');

const APP = `http://localhost:${WEB_PORT}`;
const OUTPUT = path.join(__dirname, 'screenshots', 'responsive');
const EXPANDED_MIN_WIDTH = 600; // keep in step with EXPANDED_MIN_WIDTH in app/models/theme.ts
const MIN_TARGET = 44;

const SIZES = [
  { name: '320x640 smallest, large display size', width: 320, height: 640 },
  { name: '360x640 compact', width: 360, height: 640 },
  { name: '360x800 budget Android', width: 360, height: 800 },
  { name: '390x844 iPhone', width: 390, height: 844 },
  { name: '412x915 Pixel', width: 412, height: 915 },
  { name: '440x956 iPhone Pro Max', width: 440, height: 956 },
  { name: '600x900 expanded threshold', width: 600, height: 900 },
  { name: '840x800 foldable, inner screen', width: 840, height: 800 },
];

const visible = (locator) => locator.locator('visible=true');
const slug = (text) => text.replace(/[^a-z0-9]+/gi, '-').toLowerCase();

/** Elements that stick out past the left or right edge of the window. */
const findOverflow = (page) =>
  page.evaluate(() => {
    const windowWidth = document.documentElement.clientWidth;
    const found = [];
    for (const element of document.querySelectorAll('body *')) {
      const box = element.getBoundingClientRect();
      if (box.width === 0 || box.height === 0) continue;
      const style = getComputedStyle(element);
      if (style.display === 'none' || style.visibility === 'hidden') continue;
      if (box.right > windowWidth + 1 || box.left < -1) {
        found.push(`${element.tagName.toLowerCase()} "${(element.textContent || '').trim().slice(0, 30)}" spans ${Math.round(box.left)}..${Math.round(box.right)}`);
      }
    }
    if (document.documentElement.scrollWidth > windowWidth) found.push(`page scrolls sideways (${document.documentElement.scrollWidth} > ${windowWidth})`);
    return found.slice(0, 5);
  });

/** Buttons, tabs and checkboxes smaller than the minimum tap size. */
const findSmallTargets = (page) =>
  page.evaluate((minimum) => {
    const found = [];
    for (const element of document.querySelectorAll('[role="button"], [role="tab"], [role="checkbox"]')) {
      const box = element.getBoundingClientRect();
      if (box.width === 0 || box.height === 0) continue;
      const style = getComputedStyle(element);
      if (style.display === 'none' || style.visibility === 'hidden') continue;
      if (box.height < minimum - 0.5 || box.width < minimum - 0.5) {
        found.push(`"${(element.textContent || element.getAttribute('aria-label') || '').trim().slice(0, 30)}" is ${Math.round(box.width)}x${Math.round(box.height)}`);
      }
    }
    return found.slice(0, 5);
  }, MIN_TARGET);

// Layout problems are collected and reported together at the end, so one run shows everything to fix.
const problems = new Set();

const checkLayout = async (page, size, screen) => {
  const where = `${size.name} / ${screen}`;
  for (const overflow of await findOverflow(page)) problems.add(`${where}: sticks out past the window edge: ${overflow}`);
  for (const target of await findSmallTargets(page)) problems.add(`${where}: tap target under ${MIN_TARGET}: ${target}`);
  await page.screenshot({ path: path.join(OUTPUT, `${slug(size.name)}--${slug(screen)}.png`) });
};

const chooseFirstForm = async (page) => {
  await visible(page.getByRole('button', { name: 'Choose inspection type' })).click();
  await visible(page.getByText('17/18-Point Truck & Trailer', { exact: true })).click();
  await visible(page.getByText(/^Checklist \(0\/18\)$/)).first().waitFor();
  // Let the dialog finish fading out, so screenshots show the screen itself.
  await page.getByText('Choose Inspection Type').waitFor({ state: 'detached' });
};

/** Centred means the same space on both sides, within a pixel or two. */
const assertCentred = async (locator, windowWidth, what) => {
  const box = await locator.boundingBox();
  assert.ok(Math.abs(box.x - (windowWidth - (box.x + box.width))) <= 2, `${what} is centred`);
};

// ---------------------------------------------------------------------------

const signedOutScreens = async (browser, size) => {
  const context = await browser.newContext({ viewport: { width: size.width, height: size.height } });
  const page = await context.newPage();
  await page.goto(APP);
  await visible(page.getByRole('heading', { name: 'CTPAT Inspection' })).waitFor();
  await checkLayout(page, size, 'login');

  await visible(page.getByRole('button', { name: 'Create account', exact: true })).click();
  await visible(page.getByRole('heading', { name: 'Create account' })).waitFor();
  await checkLayout(page, size, 'sign-up');
  await context.close();
};

const signedInScreens = async (browser, size, accessToken) => {
  const context = await browser.newContext({ viewport: { width: size.width, height: size.height } });
  await context.addInitScript(sessionScript(accessToken));
  const page = await context.newPage();
  const isWide = size.width >= EXPANDED_MIN_WIDTH;

  await page.goto(APP);
  const start = visible(page.getByText('Start Inspection', { exact: true }));
  await start.waitFor();
  await checkLayout(page, size, 'home');
  if (isWide) await assertCentred(visible(page.getByRole('button', { name: 'Start Inspection' })), size.width, `${size.name}: Home button`);

  await start.click();
  await visible(page.getByRole('heading', { name: 'CTPAT Inspection' })).waitFor();
  await checkLayout(page, size, 'inspection: choose a form');

  await chooseFirstForm(page);
  const tabs = visible(page.getByRole('tab'));
  if (isWide) {
    assert.equal(await tabs.count(), 0, `${size.name}: no tabs when the window is wide`);
    // Both halves are on screen at once.
    await visible(page.getByText('Freight Bill Number *', { exact: true })).waitFor();
    await visible(page.getByText(/^1\. Bumper/)).waitFor();
    await checkLayout(page, size, 'inspection: side by side');
  } else {
    assert.equal(await tabs.count(), 2, `${size.name}: checklist and sign-off tabs`);
    await checkLayout(page, size, 'inspection: checklist');
    await visible(page.getByRole('tab', { name: 'Sign Off' })).click();
    await visible(page.getByText('Freight Bill Number *', { exact: true })).waitFor();
    await checkLayout(page, size, 'inspection: sign-off');
  }

  await page.goBack();
  await visible(page.getByText('Start Inspection', { exact: true })).waitFor();
  await visible(page.getByText('View Inspection History', { exact: true })).click();
  await visible(page.getByRole('heading', { name: 'Inspection History' })).waitFor();
  await visible(page.getByText('Freight Bill:').first()).waitFor();
  await checkLayout(page, size, 'history');

  await page.goBack();
  await visible(page.getByText('Settings', { exact: true })).click();
  await visible(page.getByRole('heading', { name: 'Settings' })).waitFor();
  await checkLayout(page, size, 'settings');
  await context.close();
};

/** Typing survives the window changing size, as when a foldable is opened or closed. */
const resizeKeepsDraft = async (browser, accessToken) => {
  const context = await browser.newContext({ viewport: { width: 430, height: 932 } });
  await context.addInitScript(sessionScript(accessToken));
  const page = await context.newPage();
  await page.goto(APP);
  await visible(page.getByText('Start Inspection', { exact: true })).click();
  await chooseFirstForm(page);

  await visible(page.getByRole('checkbox')).first().click();
  await visible(page.getByRole('tab', { name: 'Sign Off' })).click();
  const input = visible(page.getByText('Freight Bill Number *', { exact: true })).locator('xpath=following-sibling::input[1]');
  await input.fill('FB-RESIZE-1');

  // Unfold.
  await page.setViewportSize({ width: 840, height: 800 });
  const wideInput = visible(page.getByText('Freight Bill Number *', { exact: true })).locator('xpath=following-sibling::input[1]');
  await wideInput.waitFor();
  assert.equal(await wideInput.inputValue(), 'FB-RESIZE-1', 'typed text survives unfolding');
  // A ticked item shows a check mark.
  assert.match(await visible(page.getByRole('checkbox')).first().innerText(), /✓/, 'ticked items survive unfolding');
  assert.equal(await visible(page.getByRole('tab')).count(), 0);

  // Fold again.
  await page.setViewportSize({ width: 360, height: 800 });
  const narrowInput = visible(page.getByText('Freight Bill Number *', { exact: true })).locator('xpath=following-sibling::input[1]');
  await narrowInput.waitFor();
  assert.equal(await narrowInput.inputValue(), 'FB-RESIZE-1', 'typed text survives folding');
  await context.close();
};

const responsiveScenarios = async (browser, accessToken) => {
  fs.mkdirSync(OUTPUT, { recursive: true });
  for (const size of SIZES) {
    await signedOutScreens(browser, size);
    await signedInScreens(browser, size, accessToken);
  }
  console.log(`checked ${SIZES.length} window sizes: ${SIZES.map((size) => size.width).join(', ')}`);
  await resizeKeepsDraft(browser, accessToken);
  console.log('ok  resizing between folded and unfolded keeps what was typed and ticked');

  if (problems.size > 0) {
    throw new Error(`Layout problems (${problems.size}):\n  ${[...problems].join('\n  ')}`);
  }
};

module.exports = { responsiveScenarios };
