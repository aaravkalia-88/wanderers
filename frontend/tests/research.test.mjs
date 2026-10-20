import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import ts from 'typescript';

async function helpers() {
  const source = await readFile(new URL('../src/api/research.ts', import.meta.url), 'utf8');
  const built = ts.transpileModule(source.replace(/import \{[^}]+\} from '\.\/travel';/, 'const api = () => {}; const ensureSession = async () => {}; const token = () => "";'),
    {compilerOptions: {target: ts.ScriptTarget.ES2020, module: ts.ModuleKind.ESNext}});
  return import('data:text/javascript;base64,' + Buffer.from(built.outputText).toString('base64'));
}

test('check-out defaults handle one-day trips and month/year boundaries without timezone drift', async () => {
  const {defaultCheckout} = await helpers();
  assert.equal(defaultCheckout('2026-10-20', 1), '2026-10-21');
  assert.equal(defaultCheckout('2026-10-20', 3), '2026-10-22');
  assert.equal(defaultCheckout('2026-12-31', 3), '2027-01-02');
  assert.equal(defaultCheckout('2028-02-28', 3), '2028-03-01');
});

test('resume keys isolate sessions and trip inputs without storing credentials in the key', async () => {
  const {researchKey} = await helpers();
  const input = {place_id: 1, start: '2026-12-01', category: 'stays'};
  const key = await researchKey(input, 'private-token-a');
  assert(!key.includes('private-token-a'));
  assert.equal(key, await researchKey(input, 'private-token-a'));
  assert.notEqual(key, await researchKey(input, 'private-token-b'));
  assert.notEqual(key, await researchKey({...input, start: '2026-12-02'}, 'private-token-a'));
});
