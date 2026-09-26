const assert = require('node:assert/strict');
const path = require('node:path');
const fs = require('node:fs');
const puppeteer = require('puppeteer');

(async () => {
  const browser = await puppeteer.launch({channel: 'chrome', headless: true});
  const output = path.resolve(__dirname, '../artifacts/glass');
  fs.mkdirSync(output, {recursive: true});
  try {
    const page = await browser.newPage();
    const errors = [];
    page.on('pageerror', error => errors.push(error.message));
    await page.setRequestInterception(true);
    page.on('request', request => new URL(request.url()).pathname.startsWith('/api/') ? request.abort() : request.continue());
    const base = process.env.BASE_URL || 'http://127.0.0.1:5174';
    const glass = selector => page.$eval(selector, element => getComputedStyle(element).backdropFilter);
    for (const width of [1440, 390]) {
      await page.setViewport({width, height: 900, deviceScaleFactor: 1});
      for (const theme of ['light', 'dark']) {
        await page.emulateMediaFeatures([{name: 'prefers-color-scheme', value: theme}, {name: 'prefers-reduced-motion', value: 'reduce'}]);
        await page.goto(base + '/settings', {waitUntil: 'networkidle2'});
        await page.waitForSelector('.settings-panel');
        await page.waitForFunction(theme => document.documentElement.dataset.theme === theme, {}, theme);
        assert.match(await glass('.settings-panel'), /blur\(24px\)/);
        assert.match(await glass('.bottom-nav'), /blur\(24px\)/);
        assert(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), 'Horizontal overflow');
        await page.screenshot({path: path.join(output, `settings-${theme}-${width}.png`)});
      }
    }
    await page.goto(base + '/explore', {waitUntil: 'networkidle2'});
    assert.match(await glass('.search-input'), /blur\(24px\)/);
    await page.goto(base + '/places/1', {waitUntil: 'networkidle2'});
    await page.waitForSelector('dialog[open]');
    assert.match(await glass('.modal'), /blur\(24px\)/);
    await page.keyboard.press('Escape');
    await page.waitForFunction(() => !document.querySelector('dialog[open]'));
    await page.goto(base, {waitUntil: 'networkidle2'});
    await page.waitForSelector('.journey-header');
    assert.match(await glass('.journey-header'), /blur\(24px\)/);
    assert.match(await glass('.journey-discovery'), /blur\(24px\)/);
    await page.screenshot({path: path.join(output, 'home-dark-mobile.png')});
    const client = await page.createCDPSession();
    await client.send('Emulation.setEmulatedMedia', {features: [{name: 'prefers-reduced-transparency', value: 'reduce'}]});
    assert(await page.evaluate(() => matchMedia('(prefers-reduced-transparency: reduce)').matches));
    assert.equal(await glass('.bottom-nav'), 'none');
    assert.equal(await glass('.journey-header'), 'none');
    assert.equal(await page.$eval('.bottom-nav', element => getComputedStyle(element).backgroundColor), 'rgb(44, 48, 57)');
    assert.deepEqual(errors, []);
    console.log('PASS: desktop/mobile, light/dark glass, journey controls, search, dialog dismissal, and reduced-transparency fallback.');
  } finally { await browser.close(); }
})().catch(error => { console.error(error); process.exitCode = 1; });
