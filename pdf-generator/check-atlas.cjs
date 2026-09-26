const puppeteer = require('puppeteer');
const assert = require('node:assert/strict');
const path = require('node:path');
const catalog = require('../frontend/src/data/destinations.json');
const base = process.env.WANDERER_URL || 'http://127.0.0.1:5173';

// Fixture-only UI writes: this check never modifies a real passport.
(async () => {
  const browser = await puppeteer.launch({channel: 'chrome', headless: true});
  try {
    const page = await browser.newPage();
    await page.setViewport({width: 1440, height: 1000});
    await page.emulateMediaFeatures([{name: 'prefers-color-scheme', value: 'light'}]);
    const errors = [];
    page.on('pageerror', error => errors.push(error.message));
    const passport = {is_guest: true, username: 'Wanderer-atlas-check', entries: [], xp: 0, tier: 'Tier III Wanderer', floor: 0, next_xp: 1000, states: 0, visited: 0, achievements: []};
    let failSave = true;
    let saved = 0;
    await page.setRequestInterception(true);
    page.on('request', request => {
      const url = new URL(request.url());
      const reply = (data, status = 200) => request.respond({status, contentType: 'application/json', body: JSON.stringify(data)});
      if (!url.pathname.startsWith('/api/v1/')) return request.continue();
      const route = url.pathname.slice(7);
      if (route === '/auth/guest') return reply({access_token: 'atlas-check'});
      if (route === '/passport') return reply(passport);
      if (route === '/trips') return reply([]);
      if (route === '/destinations/') return reply(catalog);
      if (route.startsWith('/passport/places/')) {
        if (failSave) {failSave = false; return reply({detail: 'Connection interrupted.'}, 503);}
        const entry = JSON.parse(request.postData());
        passport.entries = [{...entry, place_id: Number(route.split('/').at(-1)), stamp_id: 'TEST-ATLAS'}];
        Object.assign(passport, {xp: 400, visited: 1, states: 1});
        saved++;
        return reply(passport);
      }
      return reply({detail: 'Weather unavailable in this deterministic check'}, 503);
    });
    const shot = name => page.screenshot({path: path.resolve(__dirname, '../artifacts/' + name + '.png'), fullPage: true});
    const click = async (selector, text) => {
      const handle = await page.evaluateHandle(({selector, text}) => [...document.querySelectorAll(selector)].find(element => element.textContent.trim().startsWith(text)), {selector, text});
      assert(handle.asElement(), 'Missing control: ' + text);
      await handle.asElement().evaluate(element => element.scrollIntoView({block: 'center', behavior: 'instant'}));
      await handle.asElement().click(); await handle.dispose();
    };
    const noOverflow = async () => assert(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), 'Horizontal overflow: ' + page.url());
    await page.goto(base + '/map', {waitUntil: 'networkidle2'});
    await page.waitForSelector('.atlas canvas', {timeout: 45000});
    await page.waitForFunction(() => document.querySelector('.atlas-pin-label'));
    await noOverflow(); await shot('atlas-map-desktop');
    await page.click('[aria-label="Zoom in on India"]');
    await page.click('[aria-label="Reset India map view"]');
    await page.select('[aria-label="Choose an atlas destination"]', '14');
    await page.click('[aria-label^="Explore "][aria-label$="from atlas"]');
    await page.waitForSelector('dialog[open]');
    await click('dialog button', 'Mark as visited');
    await page.waitForSelector('.visit-form');
    await page.$eval('.visit-form input[type="date"]', input => {input.value = '2099-01-01'; input.dispatchEvent(new Event('input', {bubbles: true}));});
    // React controlled input is checked with its native setter.
    const setDate = value => page.$eval('.visit-form input[type="date"]', (input, next) => {
      Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value').set.call(input, next);
      input.dispatchEvent(new Event('input', {bubbles: true}));
    }, value);
    await setDate('2099-01-01');
    await click('.visit-form button', 'Stamp my passport');
    await page.waitForSelector('#visit-date-error');
    await setDate('2025-01-01');
    await page.type('.visit-form textarea', 'The sunrise I want to remember.');
    await click('.visit-form button', 'Stamp my passport');
    await page.waitForFunction(() => document.querySelector('.visit-form')?.textContent.includes('Retry saving memory'));
    assert.equal(await page.$eval('.visit-form textarea', element => element.value), 'The sunrise I want to remember.');
    await shot('atlas-visit-retry');
    await click('.visit-form button', 'Retry saving memory');
    await page.waitForFunction(() => !document.querySelector('dialog[open]'));
    assert.equal(saved, 1);
    await page.goto(base + '/passport', {waitUntil: 'networkidle2'});
    await page.waitForSelector('.postage-stamp.stamped');
    assert((await page.$eval('.postage-stamp.stamped', element => element.textContent)).includes('The sunrise I want to remember.'));
    await shot('atlas-passport-desktop');
    await page.goto(base + '/map', {waitUntil: 'networkidle2'});
    await page.waitForSelector('.atlas canvas');
    await click('.map-mode-switch button', 'Street map');
    await page.waitForSelector('.leaflet-container');
    await click('.map-mode-switch button', '3D atlas');
    await page.waitForSelector('.atlas canvas');
    await page.waitForSelector('.atlas canvas[data-atlas-ready]');
    await page.$eval('.atlas canvas', canvas => canvas.dispatchEvent(new Event('webglcontextlost', {cancelable: true})));
    await page.waitForFunction(() => document.querySelector('.atlas')?.textContent.includes('Retry 3D map'));
    await page.select('[aria-label="Choose an atlas destination"]', '2');
    await page.click('[aria-label^="Explore "][aria-label$="from atlas"]');
    await page.waitForSelector('dialog[open]');
    await page.keyboard.press('Escape');
    await click('.atlas button', 'Retry 3D map');
    await page.waitForSelector('.atlas canvas');
    await page.setViewport({width: 390, height: 844});
    await page.goto(base + '/map', {waitUntil: 'networkidle2'});
    assert.equal(await page.$('.atlas canvas'), null, 'Mobile must not eagerly load WebGL');
    await noOverflow(); await shot('atlas-map-mobile');
    await page.click('[aria-label="Switch to dark mode"]');
    await shot('atlas-map-mobile-dark');
    await page.goto(base + '/passport', {waitUntil: 'networkidle2'});
    await page.waitForSelector('.postage-stamp.stamped'); await noOverflow(); await shot('atlas-passport-mobile-dark');
    await page.emulateMediaFeatures([{name: 'prefers-reduced-motion', value: 'reduce'}]);
    await page.setViewport({width: 1440, height: 1000});
    await page.goto(base + '/map', {waitUntil: 'networkidle2'});
    assert.equal(await page.$('.atlas canvas'), null, 'Reduced motion defaults to static atlas');
    assert.deepEqual(errors, []);
    console.log('PASS: atlas rendering, zoom/reset, destinations, inline validation, retry/persistence, street map, context loss/retry, mobile, dark mode, reduced motion.');
  } finally {await browser.close();}
})().catch(error => {console.error(error); process.exitCode = 1;});
