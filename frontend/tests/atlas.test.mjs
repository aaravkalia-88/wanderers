import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import ts from 'typescript';
const source = await readFile(new URL('../src/components/atlas/projection.ts', import.meta.url), 'utf8');
const built = ts.transpileModule(source, {compilerOptions: {target: ts.ScriptTarget.ES2020, module: ts.ModuleKind.ESNext}});
const {projectLocation, getRegionalElevation, normalizeState} = await import('data:text/javascript;base64,' + Buffer.from(built.outputText).toString('base64'));
test('map projection aligns pins and boundaries, clamps poles and rejects invalid input', async () => {
  assert.deepEqual(projectLocation(23, 82), [0, -0]);
  const delhi = projectLocation(28.6139, 77.209);
  const mumbai = projectLocation(19.076, 72.8777);
  assert(delhi[0] > mumbai[0] && delhi[1] < mumbai[1]);
  for (const latitude of [-90, 90]) assert(projectLocation(latitude, 0).every(Number.isFinite));
  for (const point of [[NaN, 0], [0, Infinity], [91, 0], [0, -181]]) assert.throws(() => projectLocation(...point));
  const data = JSON.parse(await readFile(new URL('../public/india-states.geojson', import.meta.url)));
  const names = data.features.map(feature => feature.properties.ST_NM);
  assert.equal(new Set(names).size, 36);
  assert(names.includes('Ladakh') && names.includes('Jammu & Kashmir'));
  for (const feature of data.features) for (const polygon of feature.geometry.coordinates) for (const ring of polygon) {
    assert(ring.length >= 4, 'A polygon ring must have at least four coordinates');
    assert.deepEqual(ring[0], ring.at(-1), 'Polygon rings must close');
    for (const [longitude, latitude] of ring) assert(projectLocation(latitude, longitude).every(Number.isFinite));
  }
});


test('relief tiers and catalog corridors include every destination without duplicate stops', async () => {
  assert.equal(normalizeState('Jammu & Kashmir'), 'Jammu and Kashmir');
  assert.deepEqual(getRegionalElevation('Jammu & Kashmir'), getRegionalElevation('Jammu and Kashmir'));
  assert(getRegionalElevation('Ladakh').depth > getRegionalElevation('Maharashtra').depth);
  assert(getRegionalElevation('Maharashtra').depth > getRegionalElevation('Goa').depth);
  const journey = await readFile(new URL('../src/data/state-journey.ts', import.meta.url), 'utf8');
  const compiled = ts.transpileModule(journey, {compilerOptions: {target: ts.ScriptTarget.ES2020, module: ts.ModuleKind.ESNext}});
  const {buildJourney, corridors} = await import('data:text/javascript;base64,' + Buffer.from(compiled.outputText).toString('base64'));
  const places = JSON.parse(await readFile(new URL('../src/data/destinations.json', import.meta.url)));
  const chapters = buildJourney(places);
  assert.equal(corridors.length, 6);
  assert.equal(chapters.length, places.length);
  assert.equal(new Set(chapters.map(c => c.place.id)).size, places.length);
  assert(chapters.every(c => c.corridor >= 0));
  assert.equal(buildJourney([{...places[0], id: 999, state: 'New region'}])[0].place.id, 999);
  assert.deepEqual(buildJourney([]), []);
});
