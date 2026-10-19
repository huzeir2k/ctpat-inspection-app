# Supabase setup for sign-up, Google sign-in and password reset

The app creates accounts, sends the verification code, signs people in with Google and
resets passwords through **Supabase Auth**. The emails come from Supabase, not from this project's backend, so
everything below is set in the Supabase dashboard. Menu names move around between
dashboard versions; the setting names stay the same.

Do these in order. Without step 1 and step 4 the screens work but no real user gets an email.

## 1. Email provider and confirmation (required)

Authentication > Sign In / Providers > Email:

- Email provider: **on**.
- **Confirm email: on.** If this is off, new accounts are signed in immediately with an
  unverified address and the code screen is skipped.

## 2. Password rules (required)

Same page. The app checks these rules too, but only Supabase enforces them: anyone can
call Supabase directly and skip the app.

- Minimum password length: **8**.
- Required characters: **lowercase, uppercase letters, digits and symbols**. Supabase has
  no option for "capital + number + symbol" alone, so a lowercase letter is required as
  well, and the app's checklist shows it.

## 3. Email templates: send a code, not a link (required)

The app asks the user to type a code, so both templates must contain `{{ .Token }}`.
The default templates contain only a link, which the app cannot use.

Authentication > Email Templates:

**Confirm signup** - subject: `You are invited to try CTPAT Inspection`. This is the email a
new user gets after registering by email; make it read like an invitation.

```html
<h2>You are invited to try CTPAT Inspection</h2>
<p>Enter this code in the app to confirm your email address. Then sign in with the email
and password you chose:</p>
<p style="font-size: 28px; letter-spacing: 6px;"><strong>{{ .Token }}</strong></p>
<p>The code expires soon. If you did not create an account, ignore this email.</p>
```

**Reset password** - subject: `Your CTPAT Inspection password reset code`

```html
<h2>Reset your password</h2>
<p>Enter this code in the app to choose a new password:</p>
<p style="font-size: 28px; letter-spacing: 6px;"><strong>{{ .Token }}</strong></p>
<p>If you did not ask for this, ignore this email. Your password has not changed.</p>
```

How sign-up flows: the user registers, receives this email, enters the code in the app, and
is then taken to the sign-in screen (email already filled in) to sign in with their
credentials. Confirming does not sign them in by itself.

The code length (default 6) and lifetime are set under Authentication > Sign In /
Providers > Email ("Email OTP Length", "Email OTP Expiration"). The app expects the
length in `VERIFICATION_CODE_LENGTH` in `app/models/accountFields.ts`; change both
together. A shorter lifetime (10 to 15 minutes) is safer than the default hour.


## 3b. Google sign-in (switched off until you set it up)

**Off by default.** The app hides "Continue with Google" and everything about it until a build
is made with the setting `EXPO_PUBLIC_GOOGLE_SIGN_IN=true`. Nothing here is needed to run the
app with email sign-up only. When Google Cloud and Supabase are ready:

1. Do the steps below.
2. In `ctpat-inspection/eas.json`, add `"EXPO_PUBLIC_GOOGLE_SIGN_IN": "true"` to the `env` block
   of the build profile you use.
3. Build again. The button appears on the sign-in and sign-up screens.

On iPhone, Apple's App Review rule 4.8 asks for an equivalent login option (such as Sign in
with Apple) when an app offers Google, so decide how to handle that before an iOS release.

The steps:

"Continue with Google" appears on the sign-in and sign-up screens. It opens Google in the
phone's browser and returns to the app. It needs a Google OAuth client and two Supabase
settings. No Android fingerprint or iOS client is needed, because Supabase does the
Google step itself.

1. Google Cloud Console > APIs & Services > **OAuth consent screen**: choose External,
   set the app name and a support email, and add the scopes `openid`, `email` and
   `profile`. While the app is in "Testing" only the test users you list can sign in:
   publish it before real users try it.
2. Google Cloud Console > APIs & Services > Credentials > **Create credentials > OAuth
   client ID**, type **Web application**. Under "Authorized redirect URIs" add
   `https://<your-project-ref>.supabase.co/auth/v1/callback`. Copy the client ID and secret.
3. Supabase > Authentication > Sign In / Providers > **Google**: turn it on and paste the
   client ID and secret.
4. Supabase > Authentication > URL Configuration > **Redirect URLs**: add
   `ctpatinspection://auth-callback`. Without this Supabase refuses to send the user back
   to the app. (To try it in Expo Go, also add `exp://**`.)

A Google user needs no email code (Google has verified the address) and no password. Their
account is created the first time they use the button. Because of that, **anyone with a
Google account can register**; see section 5.

## 4. Custom SMTP (required for real users)

Supabase's built-in email sender only delivers to **members of your Supabase
organization** and is heavily rate limited. It is meant for testing. Until a custom
SMTP server is configured, a driver who signs up will never receive a code.

Authentication > Emails > SMTP Settings (or Settings > Auth > SMTP): enable custom SMTP
with the host, port, username, password and sender address of a mail service (a
transactional email provider, or your company's mail system). Supabase connects to it
itself, so this works from any Render plan.

Use a sender address on a domain you control and add the provider's SPF and DKIM DNS
records, or the codes land in spam.

After enabling it, review Authentication > Rate Limits: the default allows few emails
per hour.

## 5. Before opening sign-up to the public

Anyone with the app can now create an account, and the backend accepts every verified
Supabase user. Decide who may register:

- Restrict to your own staff: turn sign-ups off and create users by invitation from
  Authentication > Users.
- Or keep it open and add a CAPTCHA (Authentication > Bot and Abuse Protection) and
  per-user limits in the backend.

If only certain people may register, a Supabase "before user created" auth hook can allow
only approved emails or domains (check that your plan includes hooks); it covers both
email and Google sign-ups.

For email sign-ups the name and truck number are saved in the account's user metadata. Google
users have the name Google gives, and no truck number. The user can edit
that metadata, so treat it as a label and never as proof of identity or permission.

## Testing the real flow

1. Add your own email address as a member of the Supabase organization (works even
   before custom SMTP).
2. Create an account in the app with that address.
3. Read the code from the email, enter it, and confirm you land on the home screen.
4. Use "Forgot password?" with the same address and set a new password.
5. Try an address that has no account: the app must show the same screens, and no
   email arrives.
6. Tap "Continue with Google" on a phone with a build that has the app's `ctpatinspection`
   link scheme (an EAS build, not the browser): choose an account and confirm you land on
   the home screen. Closing Google's window must return to the sign-in screen quietly.
