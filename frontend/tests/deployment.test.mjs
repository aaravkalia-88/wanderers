import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {spawnSync} from 'node:child_process';

const root = new URL('../../', import.meta.url);
const configuration = async () => JSON.parse(await readFile(new URL('vercel.json', root), 'utf8'));

test('Vercel serves frontend page links without rewriting API or asset requests', async () => {
  const config = await configuration();
  const rewrite = path => config.rewrites.find(rule => new RegExp(`^${rule.source}$`).test(path))?.destination;
  for (const path of ['/', '/passport', '/places/2', '/community', '/settings', '/unknown-page']) {
    assert.equal(rewrite(path), '/index.html', path);
  }
  for (const path of ['/api', '/api/v1/auth/guest', '/assets', '/assets/missing.js']) {
    assert.equal(rewrite(path), undefined, path);
  }
});

test('the Vercel build targets the frontend from the repository root', async () => {
  const config = await configuration();
  const frontend = JSON.parse(await readFile(new URL('frontend/package.json', root), 'utf8'));
  assert.equal(config.framework, 'vite');
  assert.match(config.installCommand, /\bnpm ci\b.*--prefix frontend\b/);
  assert.match(config.buildCommand, /\bnpm --prefix frontend run build\b/);
  assert.equal(config.outputDirectory, 'frontend/dist');
  assert.match(frontend.scripts.build, /\bvite build\b/);
});

test('deployment dependencies are locked, tracked and include the source-map security fix', async () => {
  const ignored = spawnSync('git', ['check-ignore', 'frontend/package-lock.json'], {cwd: root});
  assert.equal(ignored.status, 1, 'The frontend lockfile must not be ignored');
  const lock = JSON.parse(await readFile(new URL('frontend/package-lock.json', root), 'utf8'));
  assert(lock.lockfileVersion >= 3);
  const versions = Object.entries(lock.packages).filter(([name]) => name.endsWith('/source-map-js'));
  assert(versions.length > 0);
  for (const [, entry] of versions) {
    const [major, minor, patch] = entry.version.split('.').map(Number);
    assert(major > 1 || major === 1 && (minor > 2 || minor === 2 && patch >= 2), entry.version);
  }
});
