import {test} from 'node:test';
import assert from 'node:assert/strict';
import {createCipheriv, randomBytes} from 'node:crypto';
import {mkdtempSync, writeFileSync, rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';

const load = () => import('../config/carto-env.mjs');
const definition = 'import.meta.env.VITE_CARTO_API_KEY';
const sample = 'test-carto-key';

function fixture(t) {
  const directory = mkdtempSync(join(tmpdir(), 'wanderers-carto-'));
  t.after(() => rmSync(directory, {recursive: true, force: true}));
  const keyFile = join(directory, 'carto-env.key');
  const key = randomBytes(32);
  writeFileSync(keyFile, key, {mode: 0o600});
  const iv = randomBytes(12);
  const cipher = createCipheriv('aes-256-gcm', key, iv);
  const ciphertext = Buffer.concat([cipher.update(sample, 'utf8'), cipher.final()]);
  const envelope = Buffer.concat([iv, cipher.getAuthTag(), ciphertext]);
  return {keyFile, envelope, env: {CARTO_API_KEY_ENCRYPTED: envelope.toString('base64')}};
}

test('encrypted CARTO configuration supplies the existing map key without exposing encryption material', async t => {
  const {cartoKeyDefine} = await load();
  const {env, keyFile} = fixture(t);
  assert.deepEqual(cartoKeyDefine(env, keyFile), {[definition]: JSON.stringify(sample)});
});

test('unconfigured checkouts and public deployment keys do not require a local encryption key', async () => {
  const {cartoKeyDefine} = await load();
  assert.deepEqual(cartoKeyDefine({}, '/missing-key'), {});
  assert.deepEqual(cartoKeyDefine({VITE_CARTO_API_KEY: 'deployment-key', CARTO_API_KEY_ENCRYPTED: 'invalid'}, '/missing-key'), {});
});

for (const problem of ['missing key', 'wrong key', 'damaged ciphertext', 'invalid envelope']) {
  test(`encrypted CARTO configuration rejects ${problem} without logging secrets or falling back`, async t => {
    const {cartoKeyDefine} = await load();
    const {env, keyFile, envelope} = fixture(t);
    let file = keyFile;
    if (problem === 'missing key') file += '.missing';
    if (problem === 'wrong key') writeFileSync(keyFile, randomBytes(32));
    if (problem === 'damaged ciphertext') {
      envelope[envelope.length - 1] ^= 1;
      env.CARTO_API_KEY_ENCRYPTED = envelope.toString('base64');
    }
    if (problem === 'invalid envelope') env.CARTO_API_KEY_ENCRYPTED = 'invalid';
    assert.throws(() => cartoKeyDefine(env, file), error => {
      assert.equal(error.message, 'Cannot decrypt CARTO configuration. Restore .runtime/carto-env.key or configure VITE_CARTO_API_KEY.');
      assert(!error.message.includes(sample));
      assert(!error.message.includes(env.CARTO_API_KEY_ENCRYPTED));
      assert.equal(error.cause, undefined);
      return true;
    });
  });
}
