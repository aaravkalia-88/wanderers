// Fixture-only: no TinyFish calls, billing, real guest records or supplier requests.
const puppeteer = require('puppeteer');
const assert = require('node:assert/strict');
const path = require('node:path');
const fs = require('node:fs');
const catalog = require('../frontend/src/data/destinations.json');
const root = process.env.WANDERER_URL || 'http://127.0.0.1:5175';
const chrome = process.env.CHROME_PATH || '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';

(async () => {
  const browser = await puppeteer.launch({executablePath: chrome, headless: true});
  try {
    const page = await browser.newPage();
    await page.setViewport({width: 1440, height: 1100});
    await page.emulateMediaFeatures([{name: 'prefers-reduced-motion', value: 'reduce'}, {name: 'prefers-color-scheme', value: 'light'}]);
    const errors = [], jobs = new Map();
    let count = 0, posts = 0, polls = 0, failNext = false, slowNext = false;
    page.on('pageerror', error => errors.push(error.message));
    await page.setRequestInterception(true);
    const json = async (request, data, status = 200) => request.respond({status, contentType: 'application/json', body: JSON.stringify(data)}).catch(() => {});
    const sources = category => category === 'essentials' ? [{id: 'official', label: 'Official visitor information', url: 'https://www.incredibleindia.gov.in/', live_enabled: false}] : category === 'stays' ? [
      {id: 'booking', label: 'Booking.com', url: 'https://www.booking.com/', live_enabled: true},
      {id: 'makemytrip', label: 'MakeMyTrip', url: 'https://www.makemytrip.com/hotels/', live_enabled: true},
    ] : [{id: 'thrillophilia', label: 'Thrillophilia', url: 'https://www.thrillophilia.com/', live_enabled: true}];
    const response = (input, id, status = 'COMPLETE') => ({id, status, category: input.category, mode: input.mode,
      checked_at: Date.now() / 1000, expires_at: Date.now() / 1000 + 900, sources: sources(input.category),
      notice: status === 'PARTIAL' ? 'Some sources could not be checked.' : status === 'CANCELLED' ? 'Check cancelled.' : '',
      cards: status === 'RUNNING' || status === 'CANCELLED' ? [] : [{title: input.category === 'essentials' ? 'Official visitor information <script>window.injection=true</script>' : 'Fixture ' + input.category,
        description: 'Source-backed information for ' + catalog.find(place => place.id === input.place_id).name,
        excerpt: 'A readable excerpt from the source. Always confirm details with the supplier.', topic: input.category,
        url: input.category === 'essentials' ? 'https://www.incredibleindia.gov.in/place' : input.category === 'stays' ? 'https://www.booking.com/hotel/in/fixture.html' : 'https://www.thrillophilia.com/fixture',
        source: input.source || (input.category === 'essentials' ? 'official' : input.category === 'stays' ? 'booking' : 'thrillophilia'),
        checked_at: Date.now() / 1000, date_checked: input.mode === 'live', availability: input.mode === 'live' ? 'available' : 'not_confirmed',
        price: input.mode === 'live' ? {amount: '2500', currency: 'INR', basis: 'per night', taxes: '', cancellation: ''} : null}]});
    page.on('request', async request => {
      const url = new URL(request.url());
      if (url.pathname.startsWith('/api/v1/')) {
        if (url.pathname === '/api/v1/auth/guest') return json(request, {access_token: 'fixture-session', token_type: 'bearer'});
        if (url.pathname === '/api/v1/passport') return json(request, {username: 'Fixture guest', is_guest: true, entries: [], xp: 0, states: 0, visited: 0, achievements: [], tier: 'Tier III', floor: 0, next_xp: 1000});
        if (url.pathname === '/api/v1/trips') return json(request, []);
        if (url.pathname === '/api/v1/destinations/' || url.pathname === '/api/v1/destinations') return json(request, catalog);
        if (url.pathname === '/api/v1/research' && request.method() === 'POST') {
          posts++;
          if (failNext) {failNext = false; return json(request, {detail: 'Live checks are temporarily unavailable.'}, 429);}
          const input = JSON.parse(request.postData()), id = 'fixture-job-' + ++count;
          jobs.set(id, {input, polls: 0, cancelled: false});
          if (slowNext) {slowNext = false; await new Promise(resolve => setTimeout(resolve, 1200));}
          return json(request, response(input, id, input.mode === 'live' ? 'RUNNING' : input.category === 'essentials' ? 'PARTIAL' : 'COMPLETE'));
        }
        const match = url.pathname.match(/^\/api\/v1\/research\/([^/]+)(\/cancel)?$/);
        if (match) {
          const job = jobs.get(match[1]);
          if (!job) return json(request, {detail: 'Research not found'}, 404);
          if (match[2]) job.cancelled = true;
          else {polls++; job.polls++;}
          return json(request, response(job.input, match[1], job.cancelled ? 'CANCELLED' : job.input.mode === 'live' && job.polls < 2 ? 'RUNNING' : 'COMPLETE'));
        }
        return json(request, {detail: 'Fixture endpoint unavailable'}, 503);
      }
      if (url.origin === root || url.protocol === 'data:') return request.continue().catch(() => {});
      return request.abort().catch(() => {});
    });
    const click = async (selector, text) => {
      const handle = await page.evaluateHandle(({selector, text}) => [...document.querySelectorAll(selector)].find(node => node.textContent.trim().startsWith(text)), {selector, text});
      assert(handle.asElement(), 'Missing control: ' + text);
      await handle.asElement().click(); await handle.dispose();
    };
    const waitText = text => page.waitForFunction(text => document.querySelector('.trip-research')?.textContent.includes(text), {timeout: 15000}, text).catch(async error => {
      error.message += '\nResearch panel: ' + await page.$eval('.trip-research', node => node.textContent);
      throw error;
    });
    await page.goto(root + '/planner', {waitUntil: 'networkidle0'});
    await page.waitForSelector('.trip-research');
    await click('#essentials-panel button', 'Find sources');
    await waitText('Official visitor information <script>');
    assert.equal(await page.evaluate(() => window.injection), undefined, 'External text must never execute');
    await waitText('Some sources could not be checked.');
    await page.click('#essentials-tab'); await page.keyboard.press('End');
    assert.equal(await page.$eval('#compare-tab', node => node.getAttribute('aria-selected')), 'true');
    await page.keyboard.press('Home');
    assert.equal(await page.$eval('#essentials-tab', node => node.getAttribute('aria-selected')), 'true');
    await page.click('#compare-tab');
    const categories = '#compare-panel .research-category';
    await click(categories + ':nth-of-type(1) button', 'Find sources');
    await waitText('Fixture stays');
    assert(await page.$eval('#compare-panel', node => node.textContent.includes('Price: Not confirmed')));
    failNext = true;
    await click(categories + ':nth-of-type(1) .research-sources button', 'Check live options');
    await waitText('Live checks are temporarily unavailable.');
    await click(categories + ':nth-of-type(1) .research-error button', 'Retry');
    await page.waitForSelector('.research-loading progress');
    assert.equal(await page.$eval('.research-loading progress', node => node.hasAttribute('value')), false);
    await page.waitForFunction(() => Object.keys(sessionStorage).some(key => key.startsWith('wanderer-research:') && sessionStorage.getItem(key) === 'fixture-job-3'));
    const beforeReload = posts;
    await page.reload({waitUntil: 'networkidle0'});
    await page.click('#compare-tab');
    await waitText('Date-checked offer');
    assert.equal(posts, beforeReload, 'Reload must resume jobs without another paid creation');
    await waitText('Taxes: Not confirmed');
    assert(await page.$eval('#compare-panel', node => node.textContent.includes('INR 2,500')));
    await click(categories + ':nth-of-type(2) button', 'Find sources');
    await waitText('Fixture experiences');
    await click(categories + ':nth-of-type(2) .research-sources button', 'Check live options');
    await page.waitForFunction(() => [...document.querySelectorAll('#compare-panel .research-category:nth-of-type(2) button')].some(node => node.textContent === 'Cancel check'));
    await click(categories + ':nth-of-type(2) button', 'Cancel check');
    await waitText('Check cancelled.');
    await page.evaluate(() => {window.fixtureHidden = true; Object.defineProperty(document, 'hidden', {configurable: true, get: () => window.fixtureHidden});});
    const hiddenPolls = polls;
    await new Promise(resolve => setTimeout(resolve, 3400));
    assert.equal(polls, hiddenPolls, 'Hidden research panels must not poll');
    await page.evaluate(() => {window.fixtureHidden = false;});
    const artifact = path.resolve(__dirname, '../artifacts'); fs.mkdirSync(artifact, {recursive: true});
    await (await page.$('.trip-research')).screenshot({path: path.join(artifact, 'research-desktop.png')});
    await page.setViewport({width: 390, height: 844});
    assert(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), 'Mobile horizontal overflow');
    await (await page.$('.trip-research')).screenshot({path: path.join(artifact, 'research-mobile.png')});
    await page.evaluate(() => document.documentElement.dataset.theme = 'dark');
    await (await page.$('.trip-research')).screenshot({path: path.join(artifact, 'research-dark-mobile.png')});
    // A delayed result for a previous destination must never enter the new trip.
    await page.click('#essentials-tab'); slowNext = true;
    await click('#essentials-panel button', 'Check sources');
    const previous = await page.$eval('.planner-form select', select => select.value);
    const next = catalog.find(place => String(place.id) !== previous);
    await page.select('.planner-form select', String(next.id));
    await new Promise(resolve => setTimeout(resolve, 1500));
    assert.equal(await page.$$eval('.research-cards article', nodes => nodes.length), 0, 'Old trip results must be discarded');
    await click('#essentials-panel button', 'Find sources');
    await waitText('Source-backed information for ' + next.name);
    assert.equal(await page.$$eval('.trip-research a', nodes => nodes.filter(node => node.target === '_blank' && !node.rel.includes('noreferrer')).length), 0);
    assert.equal(await page.$eval('.trip-research', node => /upgrade|subscribe|buy credits|\$9|balance/i.test(node.textContent)), false);
    assert.deepEqual(errors, [], 'Browser errors');
    console.log('PASS: research/discovery, partial results, safe text, keyboard tabs, live checks, retry, reload recovery, cancellation, hidden polling, stale results, desktop/mobile/dark layouts.');
  } finally {await browser.close();}
})().catch(error => {console.error(error); process.exitCode = 1;});
