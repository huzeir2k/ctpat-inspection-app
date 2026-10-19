/**
 * Browser scenarios for account creation and password reset: the sign-up form and its
 * password checklist, the emailed code, an address that already has an account, and the
 * forgot-password flow including its failure paths.
 */
const assert = require('node:assert/strict');
const { WEB_PORT, SUPABASE_URL } = require('./config');

const APP = `http://localhost:${WEB_PORT}`;
const SESSION_KEY = `sb-${new URL(SUPABASE_URL).hostname.split('.')[0]}-auth-token`;
const NEW_USER = {
  firstName: 'Maria',
  lastName: 'Gonzalez',
  email: 'new.driver@example.com',
  truckNumber: 't-4821',
  password: 'Str0ng!Pass',
};

// Earlier screens stay mounted (but hidden) underneath the current one, so only look at visible elements.
const visible = (locator) => locator.locator('visible=true');
const field = (page, label) => visible(page.getByLabel(label, { exact: true }));
const button = (page, name) => visible(page.getByRole('button', { name, exact: true }));
const heading = (page, name) => visible(page.getByRole('heading', { name }));
const home = (page) => visible(page.getByText('Start Inspection', { exact: true }));

const expectBanner = async (page, pattern) => {
  const banner = visible(page.getByRole('alert'));
  await banner.waitFor();
  assert.match(await banner.innerText(), pattern);
};

const newPage = async (browser) => {
  const context = await browser.newContext({ viewport: { width: 430, height: 932 } });
  const page = await context.newPage();
  await page.goto(APP);
  await heading(page, 'CTPAT Inspection').waitFor();
  return { context, page };
};

const waitUntil = async (condition, message) => {
  for (let i = 0; i < 100; i += 1) {
    if (condition()) return;
    await new Promise((resolve) => setTimeout(resolve, 50));
  }
  throw new Error(`Timed out waiting for: ${message}`);
};

const fillSignUp = async (page, details) => {
  await field(page, 'First name').fill(details.firstName);
  await field(page, 'Last name').fill(details.lastName);
  await field(page, 'Email').fill(details.email);
  await field(page, 'Truck number').fill(details.truckNumber);
  await field(page, 'Password').fill(details.password);
};

// ---------------------------------------------------------------------------

const signUpScenario = async (browser, fake) => {
  const { context, page } = await newPage(browser);
  await button(page, 'Create account').click();
  await heading(page, 'Create account').waitFor();

  // The checklist follows what is typed.
  await field(page, 'Password').fill('abc');
  await page.getByText('○ One capital letter').waitFor();
  await field(page, 'Password').fill('Abcdef1!');
  for (const rule of ['At least 8 characters', 'One capital letter', 'One lowercase letter', 'One number', 'One special character (! @ # $ % ...)']) {
    await page.getByText(`✓ ${rule}`).waitFor();
  }

  // Problems are reported before anything is sent to the server.
  await field(page, 'Password').fill('');
  await button(page, 'Create account').click();
  await expectBanner(page, /Enter your first name/);
  await fillSignUp(page, { ...NEW_USER, password: 'abcdefgh' });
  await button(page, 'Create account').click();
  await expectBanner(page, /does not meet all the requirements/);
  assert.equal(fake.log.includes('signup'), false, 'an invalid form is never sent');

  await field(page, 'Password').fill(NEW_USER.password);
  await button(page, 'Create account').click();
  await heading(page, 'Confirm your email').waitFor();

  const account = fake.users.get(NEW_USER.email);
  assert.deepEqual(account.metadata, { first_name: 'Maria', last_name: 'Gonzalez', truck_number: 'T-4821' }, 'name and truck number are saved with the account');
  assert.equal(account.confirmed, false, 'the account is unconfirmed until the code is entered');
  assert.ok(fake.latestCode('signup', NEW_USER.email), 'a code was emailed');

  // Resend is held back for a minute.
  const resend = visible(page.getByRole('button', { name: /Resend code \(\d+s\)/ }));
  await resend.waitFor();
  assert.equal(await resend.getAttribute('aria-disabled'), 'true');

  // Signing in is refused until the address is confirmed.
  await field(page, 'Code').fill('000000');
  await button(page, 'Confirm email').click();
  await expectBanner(page, /incorrect or has expired/);
  assert.equal(await home(page).count(), 0, 'a wrong code does not sign the user in');

  await field(page, 'Code').fill(fake.latestCode('signup', NEW_USER.email));
  await button(page, 'Confirm email').click();

  // Confirmed, but not signed in: the user goes to the sign-in screen, email already filled in.
  await heading(page, 'CTPAT Inspection').waitFor();
  await expectBanner(page, /Email confirmed/);
  assert.equal(await field(page, 'Email').inputValue(), NEW_USER.email, 'the email is filled in on the sign-in screen');
  assert.equal(await home(page).count(), 0, 'confirming does not sign the user in');
  assert.equal(await page.evaluate((key) => localStorage.getItem(key), SESSION_KEY), null, 'no session is kept after confirming');
  assert.equal(fake.users.get(NEW_USER.email).confirmed, true);

  await field(page, 'Password').fill(NEW_USER.password);
  await button(page, 'Sign In').click();
  await home(page).waitFor();
  console.log('ok  sign-up: checklist, validation, code by email, wrong code refused, confirm, then sign in with the chosen password');
  await context.close();
};

const existingAddressScenario = async (browser, fake) => {
  const { context, page } = await newPage(browser);
  const before = fake.outbox.length;
  await button(page, 'Create account').click();
  await fillSignUp(page, { ...NEW_USER, password: 'An0ther!Pass' });
  await button(page, 'Create account').click();

  // Same screen as a brand-new address: the form does not reveal that an account exists.
  await heading(page, 'Confirm your email').waitFor();
  assert.equal(fake.outbox.length, before, 'nothing is emailed for an address that already has an account');
  assert.equal(fake.users.get(NEW_USER.email).password, NEW_USER.password, 'the existing account is untouched');
  console.log('ok  sign-up with an existing address: same screen, nothing sent, account untouched');
  await context.close();
};

const passwordResetScenario = async (browser, fake) => {
  const { context, page } = await newPage(browser);
  const requestCode = async (email) => {
    await button(page, 'Forgot password?').click();
    await field(page, 'Email').fill(email);
    await button(page, 'Send reset code').click();
    await heading(page, 'Choose a new password').waitFor();
  };

  // An unknown address gets the same screen and no email.
  const before = fake.outbox.length;
  await requestCode('nobody@example.com');
  assert.equal(fake.outbox.length, before, 'no email is sent to an unknown address');

  await button(page, 'Back to sign in').click();
  await requestCode(NEW_USER.email);
  assert.ok(fake.latestCode('recovery', NEW_USER.email), 'a reset code was emailed');

  await field(page, 'Code').fill('000000');
  await field(page, 'New password').fill('N3w!Passw0rd');
  await button(page, 'Set new password').click();
  await expectBanner(page, /incorrect or has expired/);

  await field(page, 'Code').fill(fake.latestCode('recovery', NEW_USER.email));
  await field(page, 'New password').fill('weakpass');
  await button(page, 'Set new password').click();
  await expectBanner(page, /does not meet all the requirements/);

  // The server can still refuse a password the app accepted. Nobody may be left signed in.
  await field(page, 'New password').fill(fake.SERVER_REJECTED_PASSWORD);
  await button(page, 'Set new password').click();
  await expectBanner(page, /does not meet the requirements/);
  assert.equal(await home(page).count(), 0, 'the user is not signed in after a failed reset');
  assert.equal(await page.evaluate((key) => localStorage.getItem(key), SESSION_KEY), null, 'no session is kept after a failed reset');
  assert.equal(fake.users.get(NEW_USER.email).password, NEW_USER.password, 'the old password still works after a failed reset');

  // The code was used up, so ask for another, as a real user would.
  await button(page, 'Back to sign in').click();
  await requestCode(NEW_USER.email);
  await field(page, 'Code').fill(fake.latestCode('recovery', NEW_USER.email));
  await field(page, 'New password').fill('N3w!Passw0rd');

  // While the new password is being saved the user must stay on this screen.
  fake.options.userUpdateDelayMs = 700;
  await button(page, 'Set new password').click();
  await waitUntil(() => fake.log.at(-1) === 'update:user', 'the password update to start');
  assert.equal(await home(page).count(), 0, 'the home screen stays hidden until the new password is saved');
  await heading(page, 'Choose a new password').waitFor();
  await home(page).waitFor();
  fake.options.userUpdateDelayMs = 0;
  assert.equal(fake.users.get(NEW_USER.email).password, 'N3w!Passw0rd', 'the new password was saved');
  await context.close();

  // The new password works, the old one does not.
  const again = await newPage(browser);
  await field(again.page, 'Email').fill(NEW_USER.email);
  await field(again.page, 'Password').fill(NEW_USER.password);
  await button(again.page, 'Sign In').click();
  await expectBanner(again.page, /Incorrect email or password/);
  await field(again.page, 'Password').fill('N3w!Passw0rd');
  await button(again.page, 'Sign In').click();
  await home(again.page).waitFor();
  console.log('ok  password reset: neutral for unknown address, wrong code, weak and server-refused passwords, stays put while saving, new password works');
  await again.context.close();
};


/** Opens Google's sign-in window from the button and returns it, as the browser would. */
const startGoogle = async (page) => {
  const popup = page.waitForEvent('popup');
  await button(page, 'Continue with Google').click();
  return popup;
};

const googleScenario = async (browser, fake) => {
  // Sign-up screen and sign-in screen both offer it; a new Google user gets an account and lands on home.
  const first = await newPage(browser);
  await button(first.page, 'Create account').click();
  await heading(first.page, 'Create account').waitFor();
  assert.equal(await button(first.page, 'Continue with Google').count(), 1, 'the sign-up screen offers Google');
  await button(first.page, 'I already have an account').click();
  await heading(first.page, 'CTPAT Inspection').waitFor();

  await startGoogle(first.page);
  await home(first.page).waitFor();
  assert.ok(fake.log.includes('authorize:google'), 'the app asked Supabase to start the Google sign-in');
  assert.equal(fake.users.get('google.user@example.com').confirmed, true, 'the Google account exists and needs no email code');
  await first.context.close();

  // Closing Google's window is not an error.
  const second = await newPage(browser);
  const popup = await startGoogle(second.page);
  await popup.close();
  await second.page.waitForTimeout(1200);
  assert.equal(await visible(second.page.getByRole('alert')).count(), 0, 'closing the Google window shows no error');
  assert.equal(await home(second.page).count(), 0, 'and does not sign the user in');
  await second.context.close();

  // Google refusing (or Supabase failing) is explained, and nothing is signed in.
  fake.options.googleDenies = true;
  const third = await newPage(browser);
  await startGoogle(third.page);
  await expectBanner(third.page, /Google sign-in did not complete/);
  assert.equal(await home(third.page).count(), 0);
  fake.options.googleDenies = false;
  await third.context.close();
  console.log('ok  google: button on both screens, new account signs in, cancel is quiet, refusal is explained');
};

const accountScenarios = async (browser, fake) => {
  await signUpScenario(browser, fake);
  await existingAddressScenario(browser, fake);
  await passwordResetScenario(browser, fake);
  await googleScenario(browser, fake);
};

module.exports = { accountScenarios };
