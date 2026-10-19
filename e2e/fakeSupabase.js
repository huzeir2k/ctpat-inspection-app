/**
 * A stand-in for the parts of Supabase Auth the app uses, so the browser test can run
 * sign-in, sign-up, email codes and password reset without a Supabase project.
 *
 * It behaves like the real service where it matters to the app:
 *  - an unconfirmed account cannot sign in;
 *  - sign-up and "forgot password" answer the same for unknown / existing addresses, and
 *    send nothing in those cases;
 *  - codes are random six digits, and a wrong one gets the same 403 Supabase sends.
 *
 * `outbox` plays the part of the user's inbox: the test reads codes from it.
 */
const crypto = require('crypto');
const { TEST_LOGIN, USER_ID } = require('./config');

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'apikey, authorization, content-type, x-client-info, x-supabase-api-version',
  'Access-Control-Allow-Methods': 'GET, POST, PUT, OPTIONS',
};

// A password the fake server refuses even though it passes the app's own rules, to
// exercise the "server said no" path.
const SERVER_REJECTED_PASSWORD = 'Server!Rejects1';

const createFakeSupabase = ({ signToken }) => {
  const users = new Map([
    [
      TEST_LOGIN.email,
      { id: USER_ID, email: TEST_LOGIN.email, password: TEST_LOGIN.password, confirmed: true, metadata: {} },
    ],
  ]);
  const outbox = []; // { type: 'signup' | 'recovery', email, code }
  const log = []; // requests received, in order, e.g. 'verify:recovery'
  const options = { userUpdateDelayMs: 0, googleDenies: false };

  const publicUser = (user) => ({
    id: user.id,
    email: user.email,
    aud: 'authenticated',
    role: 'authenticated',
    email_confirmed_at: user.confirmed ? new Date().toISOString() : null,
    app_metadata: {},
    user_metadata: user.metadata,
    created_at: new Date().toISOString(),
  });

  const sessionFor = (user) => {
    const now = Math.floor(Date.now() / 1000);
    return {
      access_token: signToken(user),
      token_type: 'bearer',
      expires_in: 3600,
      expires_at: now + 3600,
      refresh_token: `e2e-refresh-${user.id}`,
      user: publicUser(user),
    };
  };

  const sendCode = (type, email) => {
    outbox.push({ type, email, code: String(crypto.randomInt(100000, 1000000)) });
  };
  const latestMessage = (type, email) => [...outbox].reverse().find((m) => m.type === type && m.email === email);
  // A code that was already used no longer counts, like a real one-time code.
  const latestCode = (type, email) => {
    const message = latestMessage(type, email);
    return message && !message.used ? message.code : undefined;
  };

  const handlers = {
    // Where "Continue with Google" starts. The real Supabase sends the browser to Google and
    // back; this goes straight back, carrying the session (or the error) after the "#".
    'GET /auth/v1/authorize': (body, send, url, req, res) => {
      log.push(`authorize:${url.searchParams.get('provider')}`);
      const redirectTo = url.searchParams.get('redirect_to');
      const back = (fragment) => res.writeHead(302, { Location: `${redirectTo}#${fragment}` }).end();

      if (options.googleDenies) return back('error=access_denied&error_description=Access+was+denied');

      const email = 'google.user@example.com';
      let user = users.get(email);
      if (!user) {
        user = { id: crypto.randomUUID(), email, password: null, confirmed: true, metadata: { full_name: 'Gina Google' } };
        users.set(email, user);
      }
      const session = sessionFor(user);
      back(`access_token=${session.access_token}&refresh_token=${session.refresh_token}&expires_in=3600&token_type=bearer`);
    },

    'POST /auth/v1/token': (body, send, url) => {
      if (url.searchParams.get('grant_type') !== 'password') return send(400, { error_code: 'unsupported_grant_type' });
      const user = users.get(String(body.email || '').toLowerCase());
      if (!user || user.password !== body.password) {
        return send(400, { code: 400, error_code: 'invalid_credentials', msg: 'Invalid login credentials' });
      }
      if (!user.confirmed) return send(400, { code: 400, error_code: 'email_not_confirmed', msg: 'Email not confirmed' });
      send(200, sessionFor(user));
    },

    'POST /auth/v1/signup': (body, send) => {
      log.push('signup');
      const email = String(body.email || '').toLowerCase();
      const existing = users.get(email);
      if (existing) {
        // Like Supabase with "Confirm email" on: looks like success, sends nothing.
        return send(200, publicUser({ ...existing, id: crypto.randomUUID(), confirmed: false }));
      }
      const user = { id: crypto.randomUUID(), email, password: body.password, confirmed: false, metadata: body.data || {} };
      users.set(email, user);
      sendCode('signup', email);
      send(200, publicUser(user));
    },

    'POST /auth/v1/resend': (body, send) => {
      log.push(`resend:${body.type}`);
      const user = users.get(String(body.email || '').toLowerCase());
      if (user && !user.confirmed) sendCode('signup', user.email);
      send(200, {});
    },

    'POST /auth/v1/recover': (body, send) => {
      log.push('recover');
      const user = users.get(String(body.email || '').toLowerCase());
      if (user && user.confirmed) sendCode('recovery', user.email);
      send(200, {});
    },

    'POST /auth/v1/verify': (body, send) => {
      log.push(`verify:${body.type}`);
      const email = String(body.email || '').toLowerCase();
      const user = users.get(email);
      if (!user || !body.token || body.token !== latestCode(body.type, email)) {
        return send(403, { code: 403, error_code: 'otp_expired', msg: 'Token has expired or is invalid' });
      }
      latestMessage(body.type, email).used = true;
      user.confirmed = true;
      send(200, sessionFor(user));
    },

    // setSession() asks who the token belongs to.
    'GET /auth/v1/user': (body, send, url, req) => {
      const token = String(req.headers.authorization || '').replace(/^Bearer /, '');
      const user = [...users.values()].find((candidate) => signToken.matches(token, candidate));
      if (!user) return send(401, { code: 401, error_code: 'bad_jwt', msg: 'invalid JWT' });
      send(200, publicUser(user));
    },

    'PUT /auth/v1/user': async (body, send, url, req) => {
      log.push('update:user');
      const token = String(req.headers.authorization || '').replace(/^Bearer /, '');
      const user = [...users.values()].find((candidate) => signToken.matches(token, candidate));
      if (!user) return send(401, { code: 401, error_code: 'bad_jwt', msg: 'invalid JWT' });
      if (options.userUpdateDelayMs) await new Promise((resolve) => setTimeout(resolve, options.userUpdateDelayMs));
      if (body.password === SERVER_REJECTED_PASSWORD) {
        return send(422, { code: 422, error_code: 'weak_password', msg: 'Password is too weak', weak_password: { reasons: ['pwned'] } });
      }
      if (body.password) user.password = body.password;
      send(200, publicUser(user));
    },
  };

  const handle = (req, res) => {
    if (req.method === 'OPTIONS') return res.writeHead(204, CORS).end();

    const url = new URL(req.url, 'http://x');
    const handler = handlers[`${req.method} ${url.pathname}`];
    const send = (status, json) => res.writeHead(status, { ...CORS, 'Content-Type': 'application/json' }).end(JSON.stringify(json));
    if (!handler) return send(404, { msg: 'not found' });

    let raw = '';
    req.on('data', (chunk) => (raw += chunk));
    req.on('end', async () => {
      let body = {};
      try {
        body = raw ? JSON.parse(raw) : {};
      } catch {
        /* an unreadable body is treated as empty */
      }
      await handler(body, send, url, req, res);
    });
  };

  return { handle, users, outbox, log, options, latestCode, SERVER_REJECTED_PASSWORD };
};

module.exports = { createFakeSupabase, SERVER_REJECTED_PASSWORD };
