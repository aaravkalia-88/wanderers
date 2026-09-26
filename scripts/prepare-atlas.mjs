// Run after mapshaper simplification: node scripts/prepare-atlas.mjs
import {readFileSync, writeFileSync} from 'node:fs';
import {fileURLToPath} from 'node:url';
const directory = fileURLToPath(new URL('../frontend/public/', import.meta.url));
const collection = JSON.parse(readFileSync(directory + 'india-states.geojson', 'utf8'));
const states = new Map();
for (const feature of collection.features) {
  // Empty offshore fragments can be removed by the simplification tool.
  if (!feature.geometry) continue;
  let name = feature.properties.ST_NM;
  if (['Daman & Diu', 'Dadara & Nagar Havelli'].includes(name)) name = 'Dadra and Nagar Haveli and Daman and Diu';
  const polygons = feature.geometry.type === 'Polygon' ? [feature.geometry.coordinates] : feature.geometry.coordinates;
  if (!states.has(name)) states.set(name, []);
  states.get(name).push(...polygons);
}
const features = [...states].map(([name, coordinates]) => ({type: 'Feature', properties: {ST_NM: name}, geometry: {type: 'MultiPolygon', coordinates}}));
writeFileSync(directory + 'india-states.geojson', JSON.stringify({type: 'FeatureCollection', features}));
const palette = ['#ccd6c4', '#e6d7b9', '#bbccbd', '#d9c4aa', '#d8dfcb', '#c2d0c5'];
const paths = features.map((feature, index) => {
  const d = feature.geometry.coordinates.flatMap(polygon => polygon.map(ring => ring.map(([lng, lat], i) => `${i ? 'L' : 'M'}${((lng - 67) * 18).toFixed(1)},${(590 - (Math.log(Math.tan(Math.PI / 4 + lat * Math.PI / 360)) * 180 / Math.PI - 6) * 16).toFixed(1)}`).join('') + 'Z')).join('');
  return `<path d="${d}" fill="${palette[index % palette.length]}"/>`;
}).join('');
writeFileSync(directory + 'india-atlas.svg', `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 600 620"><title>India discovery atlas</title><g fill-rule="evenodd" stroke="#f5f1e8" stroke-width=".8">${paths}</g></svg>`);
console.log(`Prepared ${features.length} state/UT meshes and the static atlas fallback.`);
