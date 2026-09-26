const puppeteer = require('puppeteer');
const assert = require('node:assert/strict');
const path = require('node:path');
const base = process.env.WANDERER_URL || 'http://127.0.0.1:5173';
(async () => {
  const browser = await puppeteer.launch({channel: 'chrome', headless: true});
  try {
    const page = await browser.newPage();
    const errors = [];
    page.on('pageerror', error => errors.push(error.message));
    await page.setViewport({width: 1440, height: 1000});
    await page.evaluateOnNewDocument(() => localStorage.setItem('wanderer-preferences', JSON.stringify({theme: 'light', navigation: 'both'})));
    // No real user session or passport writes are required to explore the journey.
    await page.setRequestInterception(true);
    page.on('request', request => request.url().includes('/api/v1/') ? request.respond({status: 503, contentType: 'application/json', body: JSON.stringify({detail: 'Offline preview'})}) : request.continue());
    await page.goto(base + '/journey', {waitUntil: 'networkidle2'});
    await page.waitForSelector('canvas[data-atlas-ready]', {timeout: 45000});
    const shot = name => page.screenshot({path: path.resolve(__dirname, '../artifacts/' + name + '.png')});
    await shot('journey-himachal-desktop');
    await page.$eval('#journey-chapter-1', element => element.scrollIntoView({behavior: 'instant'}));
    await page.waitForFunction(() => document.querySelector('.journey-cartography')?.getAttribute('aria-label').includes('Rajasthan'));
    await shot('journey-rajasthan-desktop');
    assert(await page.$eval('#journey-chapter-1', element => element.textContent.includes('Jaipur')));
    await page.select('[aria-label="Jump to state"]', '5');
    await page.waitForFunction(() => document.querySelector('.journey-cartography')?.getAttribute('aria-label').includes('Kerala'));
    await page.waitForFunction(() => Math.abs(document.getElementById('journey-chapter-5').getBoundingClientRect().top) < 3);
    await shot('journey-kerala-desktop');
    await page.click('#journey-chapter-5 .journey-discovery');
    await page.waitForSelector('dialog[open]');
    assert(await page.$eval('dialog', element => element.textContent.includes('Gavi')));
    await page.keyboard.press('Escape');
    assert.equal(new URL(page.url()).pathname, '/journey');
    await page.setViewport({width: 390, height: 844});
    await page.goto(base + '/journey', {waitUntil: 'networkidle2'});
    await page.waitForSelector('canvas[data-atlas-ready]');
    assert(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth));
    await shot('journey-himachal-mobile');
    await page.$eval('#journey-chapter-3', element => element.scrollIntoView({behavior: 'instant'}));
    await page.waitForFunction(() => document.querySelector('.journey-cartography')?.getAttribute('aria-label').includes('Maharashtra'));
    await shot('journey-maharashtra-mobile');
    await page.evaluate(() => {localStorage.setItem('wanderer-preferences', JSON.stringify({theme: 'dark', navigation: 'both'}));});
    // Emulation exercises text/navigation accessibility without continuous camera animation.
    await page.emulateMediaFeatures([{name: 'prefers-reduced-motion', value: 'reduce'}]);
    await page.reload({waitUntil: 'networkidle2'});
    await page.select('[aria-label="Jump to state"]', '7');
    await page.waitForFunction(() => document.querySelector('.journey-cartography')?.getAttribute('aria-label').includes('Meghalaya'));
    await shot('journey-meghalaya-mobile');
    assert.deepEqual(errors, []);
    console.log('PASS: full-page scroll, state changes, capital/landscape info, state jumps, detail modal/return path, mobile overflow, reduced motion.');
  } finally {await browser.close();}
})().catch(error => {console.error(error); process.exitCode = 1;});
