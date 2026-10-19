/**
 * Unit test for the code that reads Google's return address. The app's TypeScript is
 * compiled on the fly, so the real file is tested, not a copy.
 */
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const ts = require('../../ctpat-inspection/node_modules/typescript');

const source = fs.readFileSync(path.join(__dirname, '../../ctpat-inspection/app/models/authRedirect.ts'), 'utf8');
const compiled = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 } }).outputText;
const moduleExports = {};
new Function('exports', compiled)(moduleExports);
const { parseAuthRedirect } = moduleExports;

test('reads the tokens Supabase puts after the #', () => {
  const result = parseAuthRedirect('ctpatinspection://auth-callback#access_token=a.b.c&refresh_token=r-1&expires_in=3600&token_type=bearer');
  assert.deepEqual(result, { accessToken: 'a.b.c', refreshToken: 'r-1', error: undefined });
});

test('reads an https return address as well (web)', () => {
  const result = parseAuthRedirect('http://localhost:8081/auth-callback#access_token=a&refresh_token=b');
  assert.equal(result.accessToken, 'a');
  assert.equal(result.refreshToken, 'b');
});

test('reports a refusal with its readable description', () => {
  const result = parseAuthRedirect('ctpatinspection://auth-callback#error=access_denied&error_description=Access+was+denied');
  assert.equal(result.accessToken, undefined);
  assert.equal(result.error, 'Access was denied');
});

test('reads errors that arrive after a ? instead', () => {
  assert.equal(parseAuthRedirect('ctpatinspection://auth-callback?error=server_error').error, 'server_error');
});

test('decodes percent-escapes', () => {
  assert.equal(parseAuthRedirect('x://y#error_description=Bad%20thing%3A%20no').error, 'Bad thing: no');
});

test('an address with nothing useful gives no tokens and no crash', () => {
  for (const url of ['', 'ctpatinspection://auth-callback', 'ctpatinspection://auth-callback#', 'ctpatinspection://auth-callback#%E0%A4%A', 'x://y#=&&=']) {
    const result = parseAuthRedirect(url);
    assert.equal(result.accessToken, undefined, url);
    assert.equal(result.refreshToken, undefined, url);
  }
});

test('the fragment wins over the query, so a forged query cannot replace the tokens', () => {
  const result = parseAuthRedirect('x://y?access_token=forged#access_token=real&refresh_token=r');
  assert.equal(result.accessToken, 'real');
});
