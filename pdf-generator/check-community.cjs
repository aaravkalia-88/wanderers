const {createRequire} = require('node:module');
const path = require('node:path');
const fs = require('node:fs');
const assert = require('node:assert/strict');
const root = process.env.WANDERER_TEST_ROOT || path.resolve(__dirname, '..');
const puppeteer = createRequire(path.join(root, 'pdf-generator/package.json'))('puppeteer');
const base = process.env.WANDERER_URL || 'http://127.0.0.1:4174';
if (process.env.WANDERER_TEST_ISOLATED !== '1') throw new Error('Run against an isolated test database and set WANDERER_TEST_ISOLATED=1. This check creates test accounts and stories.');
const artifacts = process.env.WANDERER_ARTIFACTS || path.join(root, 'artifacts');
fs.mkdirSync(artifacts, {recursive: true});
(async () => {
  const browser = await puppeteer.launch({channel: 'chrome', headless: true});
  try {
    const page = await browser.newPage();
    const errors = [];
    page.on('pageerror', error => errors.push(error.message));
    page.on('dialog', dialog => dialog.accept());
    await page.setViewport({width: 1440, height: 1050});
    await page.goto(base + '/community', {waitUntil: 'networkidle0'});
    await page.waitForSelector('.community-empty');
    if (await page.evaluate(() => document.documentElement.dataset.theme === 'dark')) await page.click('.theme-toggle');
    await page.screenshot({path: path.join(artifacts, 'community-desktop.png'), fullPage: true});
    const result = await page.evaluate(async () => {
      const request = async (route, options={}) => {
        const response = await fetch('/api/v1' + route, options);
        const data = await response.json();
        if (!response.ok) throw new Error(JSON.stringify(data));
        return data;
      };
      const {access_token} = await request('/auth/guest', {method: 'POST'});
      const suffix = Date.now();
      const username = 'BrowserWriter' + suffix;
      await request('/auth/register', {method: 'POST', headers: {'Content-Type': 'application/json', Authorization: 'Bearer ' + access_token}, body: JSON.stringify({username, email: `browser${suffix}@example.test`, password: 'test-password-123'})});
      sessionStorage.setItem('wanderer-token', access_token);
      return {username, access_token};
    });
    await page.goto(base + '/profile', {waitUntil: 'networkidle0'});
    await page.waitForSelector('.community-profile-settings form');
    await page.$eval('.community-profile-settings input[type=checkbox]', el => {if(el.checked) throw new Error('Profile must be private by default');});
    const inputs = await page.$$('.community-profile-settings input');
    await inputs[0].click(); await page.keyboard.down('Meta'); await page.keyboard.press('a'); await page.keyboard.up('Meta'); await page.keyboard.press('Backspace'); await inputs[0].type('The slow way home');
    await inputs[1].type('Himachal Pradesh');
    await page.type('.community-profile-settings textarea', 'Field notes, morning chai, and the roads less hurried.');
    await page.click('.community-profile-settings input[type=checkbox]');
    await page.click('.community-profile-settings button.primary');
    await page.waitForFunction(() => document.body.innerText.includes('Community profile saved.'));
    await page.goto(base + '/write', {waitUntil: 'networkidle0'});
    await page.click('.community-hero button.primary');
    await page.waitForSelector('.editor-body');
    const storyId = new URL(page.url()).pathname.split('/').at(-1);
    await page.type('.story-editor .community-form>label:first-child input', 'The turn we almost missed');
    await page.type('.story-editor .community-form>label:nth-child(2) input', 'A quiet morning, a shared cup of chai, and a trail beyond the usual.');
    await page.select('.story-editor .community-form>label:nth-child(3) select', '2');
    await page.type('.editor-body', '# A slower morning\n\nWe followed the **long way home**. A local tea stall became our favourite stop.\n\n> Leave enough time to listen.\n\n- Carry your litter back\n- Respect the village\n\n<script>window.communityUnsafe=true</script>');
    await page.waitForFunction(() => document.querySelector('.editor-save-state').textContent.includes('saved automatically'));
    await page.reload({waitUntil: 'networkidle0'});
    await page.waitForSelector('.editor-body');
    assert((await page.$eval('.editor-body', el => el.value)).includes('A slower morning'));
    // Force a save failure, then verify immediate local recovery across refresh.
    let failSave = true;
    await page.setRequestInterception(true);
    page.on('request', request => request.method() === 'PATCH' && new URL(request.url()).pathname === `/api/v1/blogs/${storyId}` && failSave ? request.abort() : request.continue());
    await page.type('.editor-body', '\n\nRecovery survives a connection failure.');
    await page.waitForFunction(() => document.body.innerText.includes('We could not reach Wanderer'));
    failSave = false;
    await page.reload({waitUntil: 'networkidle0'});
    await page.waitForSelector('.editor-body');
    assert((await page.$eval('.editor-body', el => el.value)).includes('Recovery survives'));
    await page.waitForFunction(() => document.querySelector('.editor-save-state').textContent.includes('saved automatically'));
    await page.screenshot({path: path.join(artifacts, 'community-editor-desktop.png'), fullPage: true});
    // A second tab saves first. This editor must not overwrite that revision.
    await page.evaluate(async ({storyId, access_token}) => {
      const headers = {'Content-Type': 'application/json', Authorization: 'Bearer ' + access_token};
      const current = await (await fetch(`/api/v1/blogs/${storyId}/edit`, {headers})).json();
      const {title, subtitle, place_id, status, version, body} = current;
      const result = await fetch(`/api/v1/blogs/${storyId}`, {method: 'PATCH', headers, body: JSON.stringify({title, subtitle, place_id, status, version, body: body + '\n\nSaved in another tab.'})});
      if (!result.ok) throw new Error('Second tab save failed');
    }, {storyId, access_token: result.access_token});
    await page.type('.editor-body', '\n\nThis tab still has its own words.');
    await page.waitForFunction(() => document.body.innerText.includes('changed in another tab'));
    assert((await page.$eval('.editor-body', el => el.value)).includes('its own words'));
    const preserved = await page.evaluate(async storyId => (await (await fetch(`/api/v1/blogs/${storyId}/edit`, {headers: {Authorization: 'Bearer ' + sessionStorage.getItem('wanderer-token')}})).json()).body, storyId);
    assert(preserved.includes('Saved in another tab.')); assert(!preserved.includes('its own words'));
    await page.reload({waitUntil: 'networkidle0'});
    await page.waitForFunction(() => document.body.innerText.includes('Automatic saving is paused'));
    await page.evaluate(({username, storyId}) => localStorage.removeItem(`wanderer-story:${username}:${storyId}`), {username: result.username, storyId});
    await page.reload({waitUntil: 'networkidle0'});
    await page.waitForSelector('.editor-body');
    await page.click('.editor-publish button.primary');
    await page.waitForFunction(() => document.querySelector('.editor-save-state').textContent.includes('Story published.'));
    await page.goto(base + '/blogs/' + storyId, {waitUntil: 'networkidle0'});
    await page.waitForSelector('.community-prose');
    assert.equal(await page.evaluate(() => window.communityUnsafe), undefined);
    assert(await page.$('.community-prose strong'));
    assert(await page.$('.community-prose blockquote'));
    await page.screenshot({path: path.join(artifacts, 'community-story-desktop.png'), fullPage: true});
    await page.goto(base + '/community', {waitUntil: 'networkidle0'});
    await page.waitForSelector('.community-card');
    assert((await page.$eval('.community-card', el => el.textContent)).includes('The turn we almost missed'));
    await page.screenshot({path: path.join(artifacts, 'community-feed-desktop.png'), fullPage: true});
    // Mobile routes and both themes must fit without horizontal scrolling.
    await page.setViewport({width: 390, height: 844, isMobile: true, deviceScaleFactor: 1});
    for (const route of ['/community', '/blogs/' + storyId, '/write/' + storyId, '/u/' + result.username, '/community-guidelines']) {
      await page.goto(base + route, {waitUntil: 'networkidle0'});
      assert(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1), `Mobile overflow on ${route}`);
    }
    await page.goto(base + '/community', {waitUntil: 'networkidle0'});
    const nav = await page.$$eval('.bottom-nav button', buttons => buttons.map(button => button.innerText));
    assert.deepEqual(nav, ['Home', 'Explore', '3D Map', 'Trips', 'Community', 'Passport', 'About', 'Profile', 'Settings']);
    await page.screenshot({path: path.join(artifacts, 'community-mobile.png'), fullPage: true});
    await page.click('.theme-toggle');
    await page.screenshot({path: path.join(artifacts, 'community-mobile-dark.png'), fullPage: true});
    // Privacy changes remove both profile and published story from public requests.
    await page.evaluate(async () => {
      const headers = {'Content-Type': 'application/json', Authorization: 'Bearer ' + sessionStorage.getItem('wanderer-token')};
      const {user_id, username, ...profile} = await (await fetch('/api/v1/profiles/me', {headers})).json();
      await fetch('/api/v1/profiles/me', {method: 'PATCH', headers, body: JSON.stringify({...profile, is_public: false})});
    });
    const privateStatus = await page.evaluate(async storyId => (await fetch(`/api/v1/blogs/${storyId}`)).status, storyId);
    assert.equal(privateStatus, 404);
    await page.goto(base + '/write/' + storyId, {waitUntil: 'networkidle0'});
    await page.waitForSelector('.editor-delete button');
    await page.click('.editor-delete button');
    await page.click('.editor-delete button.secondary');
    await page.waitForFunction(() => location.pathname === '/write');
    assert.deepEqual(errors, []);
    console.log('PASS: public profile, real story creation, draft autosave/recovery, conflict protection, publishing, safe rendering, public feed, mobile routes/themes, privacy.');
  } finally {await browser.close();}
})().catch(error => {console.error(error); process.exitCode = 1;});
