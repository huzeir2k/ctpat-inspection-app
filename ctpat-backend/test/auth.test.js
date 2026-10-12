const test = require('node:test');
const assert = require('node:assert/strict');
const http = require('node:http');
const { SignJWT, generateKeyPair, exportJWK } = require('jose');
const { createAuthMiddleware } = require('../src/middleware/auth');

const SECRET = 'a-shared-secret-of-reasonable-length-123';
const KID = 'test-key-1';
const USER = '11111111-1111-4111-8111-111111111111';

let server;
let supabaseUrl;
let signingKey; // private half of the key the JWKS endpoint publishes
let otherKey; // a key Supabase does NOT publish

test.before(async () => {
  const pair = await generateKeyPair('ES256');
  otherKey = (await generateKeyPair('ES256')).privateKey;
  signingKey = pair.privateKey;
  const jwk = { ...(await exportJWK(pair.publicKey)), kid: KID, alg: 'ES256', use: 'sig' };

  // Stands in for https://<project>.supabase.co/auth/v1/.well-known/jwks.json
  server = http.createServer((req, res) => {
    if (req.url === '/auth/v1/.well-known/jwks.json') {
      res.writeHead(200, { 'Content-Type': 'application/json' }).end(JSON.stringify({ keys: [jwk] }));
    } else {
      res.writeHead(404).end();
    }
  });
  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
  supabaseUrl = `http://127.0.0.1:${server.address().port}`;
});

test.after(() => server.close());

const issuer = () => `${supabaseUrl}/auth/v1`;

const sign = ({ key = signingKey, alg = 'ES256', kid = KID, claims = {}, aud = 'authenticated', iss = issuer(), exp = '1h' } = {}) =>
  new SignJWT({ email: 'x@example.com', role: 'authenticated', ...claims })
    .setProtectedHeader({ alg, kid, typ: 'JWT' })
    .setSubject(USER)
    .setAudience(aud)
    .setIssuer(iss)
    .setIssuedAt()
    .setExpirationTime(exp)
    .sign(key);

const hsKey = new TextEncoder().encode(SECRET);

/** Runs the middleware against a fake request and reports what it did. */
const run = async (middleware, authorization) => {
  const req = { headers: authorization ? { authorization } : {} };
  let error;
  await new Promise((resolve) => {
    middleware(req, {}, (err) => {
      error = err;
      resolve();
    });
  });
  return { user: req.user, status: error?.statusCode, message: error?.message };
};

const withConfig = (config) => createAuthMiddleware(() => config);

test('accepts a token signed with the project ES256 key and sets req.user', async () => {
  const result = await run(withConfig({ supabaseUrl }), `Bearer ${await sign()}`);
  assert.equal(result.status, undefined);
  assert.deepEqual(result.user, { id: USER, email: 'x@example.com', role: 'authenticated' });
});

test('rejects a token signed with a key Supabase does not publish', async () => {
  const result = await run(withConfig({ supabaseUrl }), `Bearer ${await sign({ key: otherKey })}`);
  assert.equal(result.status, 401);
});

test('rejects expired tokens', async () => {
  const result = await run(withConfig({ supabaseUrl }), `Bearer ${await sign({ exp: Math.floor(Date.now() / 1000) - 60 })}`);
  assert.equal(result.status, 401);
});

test('rejects tokens for another audience, such as the anon role', async () => {
  const result = await run(withConfig({ supabaseUrl }), `Bearer ${await sign({ aud: 'anon' })}`);
  assert.equal(result.status, 401);
});

test('rejects tokens issued by a different project', async () => {
  const result = await run(withConfig({ supabaseUrl }), `Bearer ${await sign({ iss: 'https://other.supabase.co/auth/v1' })}`);
  assert.equal(result.status, 401);
});

test('accepts HS256 tokens only when a shared secret is configured', async () => {
  const token = await sign({ key: hsKey, alg: 'HS256' });
  assert.equal((await run(withConfig({ supabaseUrl, jwtSecret: SECRET }), `Bearer ${token}`)).user?.id, USER);
  assert.equal((await run(withConfig({ supabaseUrl }), `Bearer ${token}`)).status, 401);
});

test('an HS256 token cannot be forged by using the public key as the secret', async () => {
  const forged = await sign({ key: new TextEncoder().encode(KID), alg: 'HS256' });
  assert.equal((await run(withConfig({ supabaseUrl }), `Bearer ${forged}`)).status, 401);
});

test('rejects unsigned tokens (alg "none")', async () => {
  const encode = (value) => Buffer.from(JSON.stringify(value)).toString('base64url');
  const unsigned = `${encode({ alg: 'none', typ: 'JWT' })}.${encode({ sub: USER, aud: 'authenticated', iss: issuer() })}.`;
  assert.equal((await run(withConfig({ supabaseUrl, jwtSecret: SECRET }), `Bearer ${unsigned}`)).status, 401);
});

test('rejects malformed and missing credentials', async () => {
  const middleware = withConfig({ supabaseUrl });
  assert.equal((await run(middleware)).status, 401);
  assert.equal((await run(middleware, 'Basic abc')).status, 401);
  assert.equal((await run(middleware, 'Bearer not-a-jwt')).status, 401);
});

test('fails closed with a 500 when no verification method is configured', async () => {
  const quiet = console.error;
  console.error = () => {};
  try {
    const result = await run(withConfig({}), `Bearer ${await sign()}`);
    assert.equal(result.status, 500);
  } finally {
    console.error = quiet;
  }
});
