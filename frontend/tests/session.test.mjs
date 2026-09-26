import {test, beforeEach, after} from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import ts from 'typescript';

const originalFetch = globalThis.fetch;
const source = await readFile(new URL('../src/api/travel.ts', import.meta.url), 'utf8');
const built = ts.transpileModule(source.replace('import.meta.env.VITE_API_BASE_URL', 'undefined'), {compilerOptions: {target: ts.ScriptTarget.ES2020, module: ts.ModuleKind.ESNext}});
let moduleId = 0;
let requests;
let handler;
let expiredEvents;
beforeEach(() => {
  for (const name of ['localStorage', 'sessionStorage']) {
    const values = new Map();
    globalThis[name] = {getItem: key => values.get(key) ?? null, setItem: (key, value) => values.set(key, String(value)), removeItem: key => values.delete(key)};
  }
  globalThis.window = new EventTarget();
  expiredEvents = 0;
  window.addEventListener('wanderer-session-expired', () => expiredEvents++);
  requests = [];
  handler = () => {throw new Error('Unexpected network request');};
  globalThis.fetch = async (url, options) => {requests.push({url, options}); return handler(url, options);};
});
after(() => {globalThis.fetch = originalFetch; delete globalThis.localStorage; delete globalThis.sessionStorage; delete globalThis.window;});
const client = () => import('data:text/javascript;base64,' + Buffer.from(built.outputText).toString('base64') + '#' + moduleId++);
const json = (body, status = 200) => new Response(JSON.stringify(body), {status, headers: {'Content-Type': 'application/json'}});

test('an invalid stored session becomes a sign-in error without silently creating a new passport', async () => {
  const api = await client();
  localStorage.setItem('wanderer-token', 'old-session');
  handler = () => json({detail: 'Please sign in again'}, 401);
  await assert.rejects(api.api('/passport'), error => error instanceof api.ApiError && error.status === 401);
  assert.equal(expiredEvents, 1);
  await assert.rejects(api.ensureSession(), error => error.status === 401);
  assert.equal(requests.length, 1, 'Reconnect must not keep sending the rejected token');
  assert.equal(api.token(), 'old-session', 'Do not discard the existing passport credential');
});

test('explicit guest recovery sends no rejected credential and coalesces concurrent attempts', async () => {
  const api = await client();
  localStorage.setItem('wanderer-token', 'old-session');
  let finish;
  handler = () => new Promise(resolve => {finish = resolve;});
  const first = api.startGuestSession();
  const second = api.startGuestSession();
  assert.equal(requests.length, 1);
  assert.equal(requests[0].url, '/api/v1/auth/guest');
  assert.equal(requests[0].options.headers.has('Authorization'), false);
  assert.equal(api.token(), 'old-session');
  finish(json({access_token: 'new-guest-session'}));
  await Promise.all([first, second]);
  assert.equal(api.token(), 'new-guest-session');
  handler = () => json({entries: [{place_id: 2, status: 'Saved'}]});
  const passport = await api.api('/passport');
  assert.equal(passport.entries[0].place_id, 2);
  assert.equal(requests[1].options.headers.get('Authorization'), 'Bearer new-guest-session');
});

test('failed guest recovery preserves the current credential and can be retried', async () => {
  const api = await client();
  localStorage.setItem('wanderer-token', 'existing-session');
  handler = () => json({detail: 'Temporarily unavailable'}, 503);
  await assert.rejects(api.startGuestSession(), error => error.status === 503);
  assert.equal(api.token(), 'existing-session');
  handler = () => json({access_token: 'recovered-session'});
  await api.startGuestSession();
  assert.equal(api.token(), 'recovered-session');
});

test('a temporary network failure can retry the same passport without an auth reset', async () => {
  const api = await client();
  localStorage.setItem('wanderer-token', 'valid-session');
  handler = () => {throw new TypeError('Failed to fetch');};
  await assert.rejects(api.api('/passport'), error => error.status === 0);
  assert.equal(expiredEvents, 0);
  await api.ensureSession();
  assert.equal(requests.length, 1);
  handler = () => json({entries: [{place_id: 3, notes: 'Keep this memory'}]});
  assert.equal((await api.api('/passport')).entries[0].notes, 'Keep this memory');
  assert.equal(api.token(), 'valid-session');
});

test('a successful sign-in replaces the rejected session and can load the original passport', async () => {
  const api = await client();
  localStorage.setItem('wanderer-token', 'rejected-session');
  handler = () => json({}, 401);
  await assert.rejects(api.api('/passport'));
  api.setSessionToken('signed-in-session');
  await api.ensureSession();
  handler = () => json({xp: 400, entries: [{place_id: 2, status: 'Visited'}]});
  assert.equal((await api.api('/passport')).xp, 400);
  assert.equal(requests.length, 2, 'Signing in must not create an unrelated guest');
});

test('a late failure from an old session cannot invalidate a newer sign-in', async () => {
  const api = await client();
  localStorage.setItem('wanderer-token', 'old-session');
  let finish;
  handler = () => new Promise(resolve => {finish = resolve;});
  const pending = api.api('/passport');
  api.setSessionToken('new-login');
  finish(json({}, 401));
  await assert.rejects(pending);
  assert.equal(expiredEvents, 0);
  await api.ensureSession();
  assert.equal(api.token(), 'new-login');
});

test('guest creation cannot overwrite a sign-in completed while its request was pending', async () => {
  const api = await client();
  let finish;
  handler = () => new Promise(resolve => {finish = resolve;});
  const pending = api.ensureSession();
  localStorage.setItem('wanderer-token', 'account-session');
  finish(json({access_token: 'late-guest-session'}));
  await pending;
  assert.equal(api.token(), 'account-session');
});

test('an unexpected HTML response is reported as a service failure', async () => {
  const api = await client();
  handler = () => new Response('<html>wrong service</html>', {status: 200});
  await assert.rejects(api.api('/passport'), error => error.status === 502);
  assert.equal(expiredEvents, 0);
});

test('sign-in remembers only the session token and restores it without another login', async () => {
  const api = await client();
  localStorage.setItem('wanderer-token', 'guest-session');
  handler = () => json({access_token: 'account-session', token_type: 'bearer'});
  assert.equal(await api.signIn(' User@Example.com ', 'a password', true), true);
  assert.equal(requests[0].url, '/api/v1/auth/login/access-token');
  assert.equal(requests[0].options.headers.has('Authorization'), false);
  assert.equal(requests[0].options.headers.get('Content-Type'), 'application/x-www-form-urlencoded');
  assert.equal(requests[0].options.body.get('username'), 'user@example.com');
  assert.equal(localStorage.getItem('wanderer-token'), 'account-session');
  assert.equal(sessionStorage.getItem('wanderer-token'), 'account-session');
  const reloaded = await client();
  await reloaded.ensureSession();
  assert.equal(reloaded.token(), 'account-session');
  assert.equal(reloaded.isTabSession(), true);
  assert.equal(requests.length, 1);
});

test('unchecking remember and logout preserve another tab’s remembered account', async () => {
  const api = await client();
  localStorage.setItem('wanderer-token', 'remembered-guest');
  assert.equal(api.setSessionToken('temporary-account', false), true);
  assert.equal(localStorage.getItem('wanderer-token'), 'remembered-guest');
  assert.equal(sessionStorage.getItem('wanderer-token'), 'temporary-account');
  const reloaded = await client();
  assert.equal(reloaded.token(), 'temporary-account');
  assert.equal(reloaded.isTabSession(), true);
  localStorage.setItem('wanderer-token', 'another-tab-account');
  assert.equal(reloaded.token(), 'temporary-account', 'Another tab must not replace a tab-only login');
  reloaded.clearSessionToken();
  assert.equal(reloaded.token(), '');
  assert.equal(localStorage.getItem('wanderer-token'), 'another-tab-account');
  assert.equal(sessionStorage.getItem('wanderer-token'), '');
  assert.equal((await client()).token(), '', 'Reloading after logout must not fall through to another account');
});

test('failed or malformed sign-in responses preserve the current passport', async () => {
  const api = await client();
  localStorage.setItem('wanderer-token', 'existing-passport');
  handler = () => json({detail: 'Incorrect email or password'}, 400);
  await assert.rejects(api.signIn('user@example.com', 'wrong'), /Incorrect email or password/);
  for (const access_token of [undefined, null, {}, 'undefined', 'token with spaces']) {
    handler = () => json({access_token});
    await assert.rejects(api.signIn('user@example.com', 'password'), error => error.status === 502);
    assert.equal(api.token(), 'existing-passport');
  }
  assert.equal(expiredEvents, 0);
});

test('blocked browser storage keeps a usable session in memory and can sign out', async () => {
  const blocked = () => {throw new Error('Storage is blocked');};
  globalThis.localStorage = globalThis.sessionStorage = {getItem: blocked, setItem: blocked, removeItem: blocked};
  const api = await client();
  assert.equal(api.token(), '');
  assert.equal(api.setSessionToken('memory-account'), false);
  assert.equal(api.isTabSession(), true);
  await api.ensureSession();
  handler = () => json({xp: 900});
  assert.equal((await api.api('/passport')).xp, 900);
  assert.equal(requests[0].options.headers.get('Authorization'), 'Bearer memory-account');
  api.clearSessionToken();
  assert.equal(api.token(), '');
});

test('corrupt browser credentials are ignored without throwing', async () => {
  const api = await client();
  localStorage.setItem('wanderer-token', '[object Object]');
  sessionStorage.setItem('wanderer-token', 'undefined');
  assert.equal(api.token(), '');
  handler = () => json({access_token: 'new-guest'});
  await api.ensureSession();
  assert.equal(api.token(), 'new-guest');
});

test('a stale store that cannot be cleared is overridden without promising persistent sign-in', async () => {
  const api = await client();
  sessionStorage.setItem('wanderer-token', 'old-tab-account');
  sessionStorage.setItem = () => {throw new Error('Storage is read-only');};
  assert.equal(api.setSessionToken('new-account'), false);
  assert.equal(api.token(), 'new-account');
  api.clearSessionToken();
  assert.equal(api.token(), '', 'Sign out must not expose the uncleared credential');
});

test('logout invalidates guest creation and an old completion cannot release a newer pending request', async () => {
  const api = await client();
  const completions = [];
  handler = () => new Promise(resolve => completions.push(resolve));
  const first = api.ensureSession();
  api.clearSessionToken();
  const second = api.ensureSession();
  completions[0](json({access_token: 'old-guest'}));
  await first;
  assert.equal(api.token(), '');
  const third = api.ensureSession();
  assert.equal(requests.length, 2, 'The newer pending guest request must still be coalesced');
  completions[1](json({access_token: 'new-guest'}));
  await Promise.all([second, third]);
  assert.equal(api.token(), 'new-guest');
});

test('an older pending sign-in cannot replace a newer sign-in or undo logout', async () => {
  const api = await client();
  const completions = [];
  handler = () => new Promise(resolve => completions.push(resolve));
  const first = api.signIn('first@example.com', 'password');
  const second = api.signIn('second@example.com', 'password', false);
  completions[1](json({access_token: 'new-account'}));
  await second;
  completions[0](json({access_token: 'old-account'}));
  await assert.rejects(first, error => error.status === 409);
  assert.equal(api.token(), 'new-account');
  const third = api.signIn('first@example.com', 'password');
  api.clearSessionToken();
  completions[2](json({access_token: 'logged-out-account'}));
  await assert.rejects(third, error => error.status === 409);
  assert.equal(api.token(), '');
});

test('background guest creation finishing first does not cancel an intentional sign-in', async () => {
  const api = await client();
  const completions = [];
  handler = () => new Promise(resolve => completions.push(resolve));
  const guest = api.ensureSession();
  const login = api.signIn('user@example.com', 'password');
  completions[0](json({access_token: 'background-guest'}));
  await guest;
  completions[1](json({access_token: 'chosen-account'}));
  await login;
  assert.equal(api.token(), 'chosen-account');
});

test('validation failures show the server message without exposing submitted values', async () => {
  const api = await client();
  handler = () => json({detail: [{loc: ['body', 'email'], msg: 'Value error, Use your own email address; guest.local is reserved', input: 'private-input'}]}, 422);
  await assert.rejects(api.api('/auth/register', {method: 'POST'}), error => error.message === 'Use your own email address; guest.local is reserved');
});

test('passport account status takes precedence over the display name and supports older APIs', async () => {
  const {isGuestPassport} = await client();
  assert.equal(isGuestPassport({username: 'Wanderer-Avery', is_guest: false}), false);
  assert.equal(isGuestPassport({username: 'Avery', is_guest: true}), true);
  assert.equal(isGuestPassport({username: 'Wanderer-old-api'}), true);
  assert.equal(isGuestPassport({username: 'Avery'}), false);
});


test('remembered accounts stay pinned across other-tab login and logout events', async () => {
  const api = await client();
  localStorage.setItem('wanderer-token', 'account-a');
  assert.equal(api.token(), 'account-a');
  localStorage.setItem('wanderer-token', 'account-b');
  assert.equal(api.token(), 'account-a');
  handler = () => json({username: 'Account A'});
  await api.api('/passport');
  assert.equal(requests[0].options.headers.get('Authorization'), 'Bearer account-a');
  api.clearSessionToken();
  assert.equal(localStorage.getItem('wanderer-token'), 'account-b');
  assert.equal(api.token(), '');
});

test('sign-in defaults to a private tab without changing a remembered account', async () => {
  const api = await client();
  localStorage.setItem('wanderer-token', 'account-a');
  handler = () => json({access_token: 'account-b'});
  await api.signIn('b@example.com', 'password');
  assert.equal(localStorage.getItem('wanderer-token'), 'account-a');
  assert.equal(api.token(), 'account-b');
});
