const puppeteer = require('puppeteer');
const path = require('node:path');
const assert = require('node:assert/strict');
const {existsSync} = require('node:fs');
const catalog = require('../frontend/src/data/destinations.json');
const baseURL = process.env.WANDERER_URL || 'http://127.0.0.1:5173';

// Deterministic UI check: exercises the real app without touching anyone's journal.
(async () => {
  const bundledChrome = path.resolve(__dirname, 'chrome/mac_arm-153.0.8010.36/chrome-mac-arm64/Google Chrome for Testing.app/Contents/MacOS/Google Chrome for Testing');
  const browser = await puppeteer.launch({...existsSync(bundledChrome) ? {executablePath: bundledChrome} : {channel: 'chrome'}, headless: true});
  try {
    const page = await browser.newPage();
    const errors = [];
    page.on('pageerror', error => errors.push(error.message));
    const entries = [
      {place_id: 2, status: 'Visited', visit_date: '2026-08-20', notes: 'Chai beside the river.', rating: 5, stamp_id: 'TEST-002'},
      {place_id: 14, status: 'Visited', visit_date: '2026-08-25', notes: 'Sunset at the canyon.', rating: 4, stamp_id: 'TEST-014'},
      {place_id: 21, status: 'Saved', visit_date: null, notes: '', rating: 5, stamp_id: null},
    ];
    const fixture = {is_guest: true, username: 'Wanderer-preview', entries, xp: 800, tier: 'Tier III Wanderer', floor: 0, next_xp: 1000, states: 2, visited: 2, achievements: [{name: 'First Journey', count: 2, target: 1, unlocked: true}, {name: 'State Hopper', count: 2, target: 5, unlocked: false}]};
    const trip = {id: 12, place_id: 2, start: '2026-10-01', origin: 'Delhi', days: 3, travelers: 2, budget: 15000, mode: 'driving', style: 'Slow travel'};
    const heldPassports = [];
    let firstPassportRequest;
    const passportStarted = new Promise(resolve => {firstPassportRequest = resolve;});
    let pausePassport = true;
    let registered = false;
    await page.setRequestInterception(true);
    page.on('request', async request => {
      const url = new URL(request.url());
      const json = (value, status = 200) => request.respond({status, contentType: 'application/json', body: JSON.stringify(value)});
      if (url.pathname.startsWith('/api/v1/')) {
        const route = url.pathname.slice('/api/v1'.length);
        if (route === '/auth/guest') return json({access_token: 'guest-preview'});
        if (route === '/auth/login/access-token') {
          const values = new URLSearchParams(request.postData());
          return values.get('password') === 'test-password' ? json({access_token: 'account-preview'}) : json({detail: 'Incorrect email or password'}, 400);
        }
        if (route === '/auth/register') {registered = true; return json({username: 'Wanderer-Avery'});}
        if (route === '/passport') {
          if (pausePassport) await new Promise(resolve => {heldPassports.push(resolve);firstPassportRequest();});
          return json({...fixture, is_guest: !(registered || request.headers().authorization === 'Bearer account-preview'), username: registered || request.headers().authorization === 'Bearer account-preview' ? 'Wanderer-Avery' : fixture.username});
        }
        if (route.startsWith('/passport/places/') && request.method() === 'PUT') {
          const id = +route.split('/').at(-1);
          const change = JSON.parse(request.postData());
          const entry = fixture.entries.find(e => e.place_id === id);
          if (entry) Object.assign(entry, change);
          return json({...fixture, is_guest: false, username: 'Wanderer-Avery'});
        }
        if (route === '/trips') return json([trip]);
        if (route === '/destinations/') return json(catalog);
        return json({detail: 'Provider unavailable in deterministic UI check'}, 503);
      }
      if (url.origin !== new URL(baseURL).origin) return request.abort();
      return request.continue();
    });
    const clickText = async (selector, text) => {
      const handle = await page.evaluateHandle(({selector, text}) => [...document.querySelectorAll(selector)].find(e => e.textContent.trim().startsWith(text)), {selector, text});
      assert(handle.asElement(), 'Missing control: ' + text);
      await handle.asElement().evaluate(e => e.scrollIntoView({block: 'center', behavior: 'instant'}));
      await handle.asElement().click(); await handle.dispose();
    };
    const shot = name => page.screenshot({path: path.resolve(__dirname, '../artifacts/' + name + '.png'), fullPage: true});
    const noOverflow = async () => assert(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), 'Horizontal overflow: ' + page.url());
    await page.setViewport({width: 1440, height: 1050, deviceScaleFactor: 1});
    await page.emulateMediaFeatures([{name: 'prefers-color-scheme', value: 'light'}]);
    await page.goto(baseURL + '/passport', {waitUntil: 'domcontentloaded'});
    await page.waitForSelector('.journey-loading');
    await shot('passport-loading-desktop');
    const fact = await page.$eval('.journey-fact>p', e => e.textContent);
    await page.click('.journey-fact-controls>button:first-child');
    assert.notEqual(await page.$eval('.journey-fact>p', e => e.textContent), fact);
    await page.click('[aria-label="Pause automatic facts"]');
    assert.equal(await page.$eval('[aria-label="Resume automatic facts"]', e => e.getAttribute('aria-pressed')), 'true');
    await passportStarted;
    pausePassport = false;
    heldPassports.forEach(resolve => resolve());
    await page.waitForSelector('.ph-stamp');
    assert((await page.$eval('.ph-xp', e => e.textContent)).includes('800'));
    await shot('passport-updated-desktop');
    await noOverflow();

    // Passport section selectors below deliberately use their accessible labels.
    await page.type('input[aria-label="Search stamps"]', 'canyon');
    await page.waitForFunction(() => document.querySelectorAll('.ph-stamp').length === 1);
    assert((await page.$eval('.ph-stamp', e => e.textContent)).includes('Gandikota'));
    await page.$eval('input[aria-label="Search stamps"]', e => {const set = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value').set; set.call(e, '');e.dispatchEvent(new Event('input', {bubbles: true}));});
    await clickText('.ph-tabs button', 'Saved');
    await page.waitForSelector('.destination-card');
    assert((await page.$eval('.destination-card', e => e.textContent)).includes('Mawphlang'));
    await clickText('.ph-tabs button', 'Trips');
    await page.waitForSelector('.ph-trips>button');
    await page.click('.ph-trips>button');
    await page.waitForSelector('.planner-form');
    assert(page.url().endsWith('/planner'));
    await page.goto(baseURL + '/passport', {waitUntil: 'networkidle2'});
    await clickText('.ph-tabs button', 'Achievements');
    await page.waitForSelector('.ph-achievements article');
    await clickText('.ph-tabs button', 'Stamps');
    await clickText('.passport-hub button', 'Sign in');
    await page.waitForSelector('.auth-form');
    await page.type('#auth-email', 'avery@example.test');
    await page.type('#auth-password', 'bad-password');
    await page.click('[aria-label="Show password"]');
    assert.equal(await page.$eval('#auth-password', e => e.type), 'text');
    await page.click('.auth-submit');
    await page.waitForSelector('.auth-error');
    assert((await page.$eval('.auth-error', e => e.textContent)).includes('Incorrect email'));
    await page.waitForFunction(() => document.activeElement?.classList.contains('auth-error'));
    assert.equal(await page.$eval('#auth-password', e => e.type), 'password');
    await page.$eval('#auth-password', e => {e.value = 'test-password';});
    await shot('passport-login-desktop');
    await page.click('.auth-submit');
    await page.waitForFunction(() => !document.querySelector('dialog'));
    await page.waitForFunction(() => localStorage.getItem('wanderer-token') === 'account-preview');
    assert.equal(await page.evaluate(() => sessionStorage.getItem('wanderer-token')), null);
    await page.reload({waitUntil: 'networkidle2'});
    await page.waitForFunction(() => document.querySelector('.passport-hub')?.textContent.includes('Wanderer-Avery'));
    await clickText('.passport-hub button', 'Sign out');
    await page.waitForFunction(() => localStorage.getItem('wanderer-token') === 'guest-preview');
    await clickText('.passport-hub button', 'Sign in');
    await page.type('#auth-email', 'avery@example.test');await page.type('#auth-password', 'test-password');
    await page.click('.auth-remember input');await page.click('.auth-submit');
    await page.waitForFunction(() => sessionStorage.getItem('wanderer-token') === 'account-preview');
    assert.equal(await page.evaluate(() => localStorage.getItem('wanderer-token')), null);
    await page.reload({waitUntil: 'networkidle2'});
    await page.waitForFunction(() => document.querySelector('.passport-hub')?.textContent.includes('Wanderer-Avery'));
    assert.equal(await page.evaluate(() => JSON.stringify({...localStorage, ...sessionStorage}).includes('test-password')), false);

    for (const route of ['/this-trail-does-not-exist', '/places/99999', '/404']) {
      await page.goto(baseURL + route, {waitUntil: 'networkidle2'});
      await page.waitForSelector('.detour-page');
      assert.equal(await page.$('.hero'), null);
    }
    await shot('wanderer-404-desktop');
    await clickText('.detour-actions button', 'Back home');
    await page.waitForSelector('.hero');
    assert(new URL(page.url()).pathname === '/');
    await page.goBack({waitUntil: 'networkidle2'});await page.waitForSelector('.detour-page');
    await page.goto(baseURL + '/places/2', {waitUntil: 'networkidle2'});
    await page.waitForSelector('dialog[open]');await page.keyboard.press('Escape');
    assert.equal(await page.$('dialog[open]'), null);

    await page.setViewport({width: 390, height: 844, deviceScaleFactor: 1});
    for (const theme of ['light', 'dark']) {
      await page.emulateMediaFeatures([{name: 'prefers-color-scheme', value: theme}, {name: 'prefers-reduced-motion', value: 'reduce'}]);
      for (const route of ['/passport', '/404', '/loading']) {
        await page.goto(baseURL + route, {waitUntil: 'networkidle2'});
        await noOverflow(); await shot(route.slice(1) + '-' + theme + '-updated-mobile');
        if (route === '/passport') {
          if (await page.evaluate(() => [...document.querySelectorAll('.passport-hub button')].some(e => e.textContent.trim().startsWith('Sign out')))) {
            await clickText('.passport-hub button', 'Sign out');
            await page.waitForFunction(() => localStorage.getItem('wanderer-token') === 'guest-preview');
          }
          await clickText('.passport-hub button', 'Sign in');
          await page.type('#auth-email', 'avery@example.test');
          await page.type('#auth-password', 'bad-password');
          await page.click('.auth-submit');
          await page.waitForFunction(() => document.activeElement?.classList.contains('auth-error'));
          await noOverflow();
          await shot('login-error-' + theme + '-mobile');
        }
        if (route === '/loading') assert(await page.$('[aria-label="Resume automatic facts"]'));
      }
    }
    assert.deepEqual(errors, []);
    console.log('PASS: real loading state, random facts and pause, passport search/tabs/trips, login errors/password visibility, remembered and tab-only sessions, logout, reload, 404/deep links, and light/dark mobile overflow.');
  } catch (error) {
    const page = (await browser.pages()).at(-1);
    console.error(await page.evaluate(() => document.body.innerText));
    await page.screenshot({path: path.resolve(__dirname, '../artifacts/login-check-failure.png'), fullPage: true});
    throw error;
  } finally {await browser.close();}
})().catch(error => {console.error(error); process.exit(1);});
